// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  Create3Factory — one address per salt, on every band, whatever the code

  Origin: the CREATE3 shape Solady's `CREATE3.sol` made standard, written
  out here by hand (INTACT U10, DESIGN.md §12 "Addresses"); no import, as
  src/ has no external Solidity dependencies anywhere.

  The problem it solves. CREATE2 lands at keccak(0xff ‖ deployer ‖ salt ‖
  keccak(initcode)): the ADDRESS DEPENDS ON THE INITCODE, and INTACT's
  initcode differs per band — every satellite takes the band's bounds or
  the band's Uniswap addresses as constructor arguments. So CREATE2 alone
  would give `Pool` three addresses on three chains. CREATE3 puts one hop
  in between: CREATE2 deploys a tiny PROXY whose initcode is a fixed
  sixteen bytes, so the proxy's address is a function of (factory, salt)
  only; the proxy then CREATEs the real contract from its own nonce, which
  is 1 for a fresh contract, so the real address is keccak(rlp([proxy,1]))
  — also a function of (factory, salt) only. The constructor arguments can
  be anything; the address does not move.

  The proxy. Its initcode is
      67 363d3d37363d34f0   PUSH8 <the eight-byte runtime>
      3d 52                 RETURNDATASIZE MSTORE      (store it at 24..32)
      60 08 60 18 f3        PUSH1 8 PUSH1 24 RETURN    (return those 8 bytes)
  and the eight bytes it returns, the proxy's whole runtime, are
      36 3d 3d 37           CALLDATASIZE RETURNDATASIZE RETURNDATASIZE CALLDATACOPY
      36 3d 34 f0           CALLDATASIZE RETURNDATASIZE CALLVALUE CREATE
  — copy the calldata (the real initcode) to memory, CREATE it with the
  value that came along, and stop. It keeps no code path for a second
  call: with its nonce now 2 it could only ever create at a different
  address, and nothing calls it again anyway.

  Who deploys the factory decides every address. The factory is itself
  deployed by plain CREATE from a FRESH burner at nonce 0, so
  `factory = keccak(rlp([burner, 0]))`; the same burner key on every band
  gives the same factory, and so every salt gives the same address on
  every band. That is why the deployer does NOT enter the salt here, where
  Solady's `deployDeterministic` callers usually mix it in: mixing the
  sender in would make the addresses depend on who sends the transaction,
  and the whole point is that they depend only on the burner that made
  the factory and on the name of the contract.

  Who may deploy through it. The first version of this file let anyone
  call `deploy`, arguing that the script checks what landed. It does, but
  the hub does not: `IntactBase` pins `MARKET`, `ROLES` and the Renderer,
  Catalog and Premises pin `AGENTCARD` as CREATE3 predictions that are
  CODELESS on every band at the MVB (deployments/README.md
  `placeholders`), and `CoreLogic.moduleTransfer` trusts `msg.sender ==
  _MARKET` with no codehash check. So the first stranger to call
  `deploy(keccak("intact.v1.market"), theirCode)` after the burner was
  destroyed would have become the hub's market and moved every unlocked,
  unsealed token; under the roles salt they could have locked every
  token for good; under the agentCard salt they would have served their
  own bytes on /.well-known/* and face 2 of every tokenURI. A reviewer
  proved it on the in-process EVM (U10 review: mallory, never the
  deployer, took token #1 from alice in three transactions). The second
  prong was cheaper still: one stranger's transaction under any of the
  twenty-seven public salts, on a band whose factory had just landed,
  would have burned that address on that band forever.

  So `deploy` admits exactly two callers, both fixed at construction and
  neither of them an admin: DEPLOYER, the burner that created the factory
  (`msg.sender` in the constructor), and TIMELOCK, the address the
  "intact.v1.timelock" salt lands at — computed here from `predict`, so it
  is right before the Timelock exists and does not depend on the burner
  keeping any promise. The burner lands the MVB; once it is destroyed,
  every later satellite lands only through the Timelock's own seven-day
  public queue (`Timelock.execute(factory, value, deploy(...))`, open to
  anyone once ripe), which is where DESIGN.md §12 already puts every
  privileged action. Neither address moves a prediction: `predict`
  depends on `address(this)` and the salt alone, so every address on
  every band is what it was before the gate existed. There is no setter,
  no second role and no way to widen the pair.

  Refusals: a caller that is neither the deployer nor the Timelock
  (`NotDeployer`), a salt whose address already holds code (`SaltUsed`),
  a proxy that did not deploy or a constructor that reverted or returned
  no code (`DeploymentFailed`) — the transaction reverts, so nothing
  half-lands and the salt stays usable.

  Measured (tools/compile.mjs, solc 0.8.36, viaIR, 800 runs, bytecodeHash
  none): 1,103 bytes of runtime (1,418 of initcode), 4.5 % of EIP-170.
───────────────────────────────────────────────────────────────────────────*/
contract Create3Factory {
    /// @notice A contract landed at `addr` under `salt`.
    event Deployed(bytes32 indexed salt, address indexed addr);

    error NotDeployer();
    error SaltUsed();
    error DeploymentFailed();

    /// @notice The burner that created this factory: the only caller of
    ///         `deploy` until the Timelock exists, and the one that lands
    ///         the MVB.
    address public immutable DEPLOYER;
    /// @notice Where keccak("intact.v1.timelock") lands from this factory:
    ///         the only other caller of `deploy`, for every satellite that
    ///         comes after the burner is gone.
    address public immutable TIMELOCK;
    bytes32 public constant TIMELOCK_SALT = keccak256("intact.v1.timelock");

    constructor() {
        DEPLOYER = msg.sender;
        TIMELOCK = predict(TIMELOCK_SALT);
    }

    /// @dev The sixteen-byte proxy initcode, right-aligned in a word, and
    ///      its keccak — the constant every CREATE2 prediction uses.
    uint256 private constant PROXY_INITCODE = 0x67363d3d37363d34f03d5260086018f3;
    bytes32 public constant PROXY_INITCODE_HASH =
        0x21c35dbe1b344a2488cf3321d6ce542f8e9f305544ff09e4993a62319a497c1f;

    /// @notice Deploy `creationCode` at the address `salt` names, forwarding
    ///         `msg.value` to its constructor.
    /// @dev    Order matters: the salt is checked against code at the
    ///         PREDICTED address, not the proxy's, because a proxy that
    ///         exists means a deployment already happened (the two are made
    ///         in one transaction or not at all).
    function deploy(bytes32 salt, bytes memory creationCode) external payable returns (address deployed) {
        if (msg.sender != DEPLOYER && msg.sender != TIMELOCK) revert NotDeployer();
        deployed = predict(salt);
        if (deployed.code.length != 0) revert SaltUsed();

        address proxy;
        assembly ("memory-safe") {
            mstore(0x00, PROXY_INITCODE)
            proxy := create2(0, 0x10, 0x10, salt)
        }
        if (proxy == address(0)) revert DeploymentFailed();

        // The proxy CREATEs whatever it is sent and keeps nothing of the
        // outcome; the only evidence is code at the predicted address.
        (bool ok,) = proxy.call{value: msg.value}(creationCode);
        if (!ok || deployed.code.length == 0) revert DeploymentFailed();
        emit Deployed(salt, deployed);
    }

    /// @notice Where `salt` lands from this factory, before or after the
    ///         fact, for any initcode.
    function predict(bytes32 salt) public view returns (address deployed) {
        address proxy = address(uint160(uint256(
            keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, PROXY_INITCODE_HASH)))));
        // rlp([proxy, 1]) = 0xd6 0x94 <20 bytes> 0x01: a fresh contract's first CREATE
        deployed = address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", proxy, hex"01")))));
    }
}
