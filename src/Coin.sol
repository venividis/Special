// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// Origin: ANIMA contracts/market/AgentToken.sol, adapted (INTACT U6): the quote
// is native ether instead of an ERC-20, OpenZeppelin's ERC20/ERC20Permit/
// ReentrancyGuardTransient are replaced by a hand-rolled token with CEI, and
// the supply is split at construction between the launching token's Reach
// and the Launchpad. Load-bearing comments kept.

import {ICoin} from "./interfaces/IKiln.sol";
import {Mul} from "./lib/Mul.sol";

/*───────────────────────────────────────────────────────────────────────────
  Coin — a launch token with a floor under it

  The fungible token of a single Intact. Holders share in what the token's
  launch earns, and can always redeem their pro-rata slice of the
  redemption pool by burning.

  The redemption mechanism is lifted from ERC-7641 (Intrinsic RevShare),
  and it is the reason to launch here rather than on a bonding-curve
  casino. A pump.fun-style token is backed by nothing: its price is
  whatever the last buyer paid, and when attention moves on it goes to
  zero. This token's price cannot go below `redemptionPool / totalSupply`,
  because at any lower price anyone can buy tokens, burn them, and take out
  more than they put in. The floor is not a promise or a buyback programme
  someone has to remember to run — it is an arbitrage that enforces itself.

  The pool fills from the launch itself: the floor leg of every curve fee
  and the ENTIRE anti-snipe tax land here at graduation, so every sniper
  raises every holder's floor (DESIGN.md §8.1). Burning is pro-rata over
  `totalSupply`, so redeeming never dilutes the remaining holders: the
  floor per token is invariant across a redemption and strictly increasing
  in contributions.

  ── no owner, and that is the point ──

  Fixed supply minted once in the constructor; no mint, no pause, no
  blacklist, no owner, no upgrade path. Every one of the omitted features
  is a lever the deployer could pull against everybody who bought, and a
  launchpad that offers those levers is a rug factory with a form
  (IPSEITY Kiln.sol's argument, kept). The supply goes where the Kiln
  said: the Reach of the launching token, and the Launchpad for the share
  that will be raised — so no approval from the Reach ever exists.

  ── native quote ──

  ANIMA's token refused ether ("a payable surface on a token contract").
  INTACT's launches are quoted in ether (DESIGN.md §8.2), so the pool is
  ether and `contribute` is payable. The pool is tracked explicitly rather
  than read from `address(this).balance`: ether that arrives by
  SELFDESTRUCT or as a coinbase reward cannot move the floor, so a
  donation-based rounding attack has nothing to grip. There is no
  `receive()` — the only way in is `contribute`, and the only way out is
  `redeem`.
───────────────────────────────────────────────────────────────────────────*/
contract Coin is ICoin {
    /*═══════════════════ ERC-20 ═══════════════════*/

    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /*═══════════════════ provenance ═══════════════════*/

    /// @notice The Intact that launched this coin.
    uint256 public immutable LAUNCHER;
    /// @notice The Kiln that deployed it — the only CREATE2 deployer, so
    ///         `coinAt` can be recomputed by anyone.
    address public immutable KILN;

    /*═══════════════════ the floor ═══════════════════*/

    /// @notice Redeemable ether. Explicit, never `address(this).balance`.
    uint256 public redemptionPool;

    /*═══════════════════ ERC-2612 ═══════════════════*/

    mapping(address => uint256) public nonces;
    bytes32 private immutable _NAME_HASH;
    bytes32 private constant _DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant _VERSION_HASH = keccak256("1");
    bytes32 private constant _PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    /// @dev secp256k1 n/2: a signature with a higher `s` is the same
    ///      signature in another spelling, and a permit that accepted both
    ///      would let one approval be replayed under a second nonce-free
    ///      form. OpenZeppelin's ECDSA makes the same refusal.
    uint256 private constant _HALF_N = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    /*═══════════════════ construction ═══════════════════*/

    /// @param supply     the whole supply, minted once
    /// @param raiseShare the part of it minted to the Launchpad for a raise
    /// @param reach      the launching token's Reach: receives the rest
    /// @param launchpad  where the raise share lands
    /// @param launcher   the launching token's id
    constructor(
        string memory name_, string memory symbol_, uint8 decimals_,
        uint256 supply, uint256 raiseShare, address reach, address launchpad, uint256 launcher
    ) {
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        LAUNCHER = launcher;
        KILN = msg.sender;
        _NAME_HASH = keccak256(bytes(name_));

        // Fixed supply, minted once. There is no mint function, so the floor
        // can never be diluted by issuing more claims against the same pool.
        totalSupply = supply;
        uint256 kept = supply - raiseShare;
        if (kept != 0) {
            balanceOf[reach] = kept;
            emit Transfer(address(0), reach, kept);
        }
        if (raiseShare != 0) {
            balanceOf[launchpad] = raiseShare;
            emit Transfer(address(0), launchpad, raiseShare);
        }
    }

    /*═══════════════════ ERC-20 ═══════════════════*/

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            if (a < amount) revert NotEnough();
            unchecked { allowance[from][msg.sender] = a - amount; }
        }
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) private {
        uint256 b = balanceOf[from];
        if (b < amount) revert NotEnough();
        unchecked { balanceOf[from] = b - amount; balanceOf[to] += amount; }
        emit Transfer(from, to, amount);
    }

    /*═══════════════════ ERC-2612 ═══════════════════*/

    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(abi.encode(_DOMAIN_TYPEHASH, _NAME_HASH, _VERSION_HASH, block.chainid, address(this)));
    }

    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
    {
        if (block.timestamp > deadline) revert Expired();
        if (uint256(s) > _HALF_N) revert BadSignature();
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01", DOMAIN_SEPARATOR(),
            keccak256(abi.encode(_PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline))
        ));
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0) || signer != owner) revert BadSignature();
        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    /*═══════════════════ the floor ═══════════════════*/

    /// @notice Route ether into the redemption pool. Permissionless: the
    ///         Launchpad's fee legs and snipe tax at graduation, the
    ///         token's own Reach, a sponsor. The effect is only ever to
    ///         raise the floor.
    function contribute() external payable {
        if (msg.value == 0) revert ZeroAmount();
        redemptionPool += msg.value;
        emit Contributed(msg.sender, msg.value);
    }

    /// @notice Burn tokens and take the corresponding slice of the pool.
    /// @dev The share is computed against `totalSupply` BEFORE the burn,
    ///      which is what makes redemption neutral for everyone else: floor
    ///      per token is unchanged. Rounds down — the dust stays with the
    ///      holders who did not leave. State is settled before the ether
    ///      moves, so a receiver that re-enters sees a pool that already
    ///      paid it.
    function redeem(uint256 amount) external returns (uint256 paid) {
        if (amount == 0) revert ZeroAmount();
        uint256 supply = totalSupply;
        uint256 pool = redemptionPool;
        paid = Mul.mulDivDown(pool, amount, supply);
        if (paid == 0) revert NotEnough();

        redemptionPool = pool - paid;
        _burn(msg.sender, amount);

        (bool ok, ) = msg.sender.call{value: paid}("");
        if (!ok) revert TransferFailed();
        emit Redeemed(msg.sender, amount, paid);
    }

    /// @notice Burn without redeeming: the pool stays, so every remaining
    ///         holder's floor rises. The Launchpad burns the base a
    ///         graduation does not need at the terminal price.
    function burn(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _burn(msg.sender, amount);
    }

    function _burn(address from, uint256 amount) private {
        uint256 b = balanceOf[from];
        if (b < amount) revert NotEnough();
        unchecked { balanceOf[from] = b - amount; totalSupply -= amount; }
        emit Transfer(from, address(0), amount);
    }

    /// @notice Wei backing one WHOLE token (10**decimals base units): the
    ///         hard floor below which the market price cannot durably trade.
    /// @dev Quoting per whole token rather than per base unit is ANIMA's
    ///      lesson kept: a per-base-unit floor silently truncates to zero
    ///      for realistic parameters (a 1e27 supply puts it at 1e-9 wei).
    ///      `mulDiv` carries the 512-bit intermediate, so a 36-decimal coin
    ///      (the Kiln's ceiling) cannot overflow it.
    function floorPerToken() external view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 ? 0 : Mul.mulDivDown(redemptionPool, 10 ** decimals, supply);
    }
}
