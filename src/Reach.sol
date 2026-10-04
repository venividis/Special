// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    IReach, Session, SessionKind, AssetCap, AssetLimit, TypedCall, Call, Piece, OpenApproval
} from "./interfaces/IReach.sol";
import {IIntact, Status} from "./interfaces/IIntact.sol";
import {Ratchet} from "./lib/Ratchet.sol";
import {Transient} from "./lib/Transient.sol";
import {ExactERC20, IERC20Exact} from "./lib/ExactERC20.sol";
import {ERC6492} from "./lib/ERC6492.sol";

/*═══════════════════════════════════════════════════════════════════════════

  THE REACH — the vault, with a promise it can keep

  Origin: IPSEITY src/IpseityAccount.sol, adapted (DESIGN.md §3 row 6,
  §9.1, §9.2; BUILD-PLAN.md U2). Kept whole: the measured seal, the two
  manifests, CALL-only `execute`, the batch wrapped by one measurement, the
  session keys with their epoch-keyed allowlists, and the domain-separated
  ERC-1271. Changed, and recorded where each change lands:

    · sessions and recipes are stamped with the hub's `custodyEpoch` rather
      than IPSEITY's `statsOf.xfers` (same idea, one clock for the protocol);
    · `state()` is explicit and bumps on every execute, grant, revoke, seal
      and manifest change, and `auditRoot` chains every call (ANIMA
      AgentAccount.sol:340-351) — the hub's ERC-5646 fingerprint reads both;
    · `executeBatch([])` reverts `EmptyBatch` (ANIMA `koorbx` 45d10d6: an
      empty batch once advanced the state counter with no authorisation);
    · recipe sessions — exact calldata, pinned target codehash, exact value,
      a use count and a minimum interval (Pixel-Garden ReachAccount.sol
      `grantSession`, ANIMA `koorbx` `SessionScope`) — and `minInterval` /
      `uses` on allowlist sessions too;
    · `executeTyped` — "swap exactly this for at least that" (Garden
      `_perform`): exact approvals only if the allowance is zero, reset and
      verified zero afterwards, spend legs bounded, receive floors enforced;
    · ERC-20 caps on a session, charged by balance DELTA (MASTER's net-debit
      rule), because any implementation that stops at `msg.value` has a
      spending limit in name only;
    · the open-approval ledger: every approval-shaped call the account makes
      is recorded as (asset, spender) and can be zeroed in one call that
      never blocks on a foreign revert; `openApprovalsRoot()` is in the
      fingerprint;
    · `sealMax()` and `revokeAllSessions()` for the hub's `panic` and for the
      token's guardian; sessions require the hub's `Active` status;
    · the attestation digest is wrapped as ERC-7739 `TypedDataSign`;
    · the re-entrancy lock is the registered transient slot
      `Transient.REACH_LOCK`, and the manifest cannot change while it is
      held (which subsumes IPSEITY's `_measuring` flag — see `notInside`).

  ERC-6551 says the registry is canonical and the implementation is a
  parameter. Almost everyone passes the reference implementation and
  inherits its one structural gap: the holder can empty the account at any
  moment, including between agreeing a price for the token and settling it.
  A buyer paying for a token because of what its vault holds has no promise
  at all — the accounting is never violated, the assets are simply gone.

  So this is the implementation instead. Same registry, same CREATE2
  derivation, same interfaces. One addition: a seal.

  ── the seal ──

  SEALED UNTIL a timestamp. It ratchets — it can be pushed further out by
  the holder and lowered by nobody, including through a transfer — so a
  buyer reads one number and knows the floor under it cannot move before
  then. While it holds, nothing this account holds may leave it.

  ── how "nothing leaves" is enforced ──

  Not by listing the calls that move assets. That list cannot be completed:
  `transfer` and `transferFrom` are on it, but so is any protocol's
  `withdrawTo(address)`, `redeem`, `exit`, `sweep`, or a function nobody
  has written yet. A firewall that enumerates is a firewall with a hole in
  it shaped like whatever it has not heard of.

  So the account MEASURES. Before a sealed call it records its own ether
  balance and its balance of every asset on its manifest; after the call it
  checks that not one of them fell. What the call did is irrelevant — what
  matters is what is left. This is the Dave Held Chambers pattern, whose
  hardening pass reached the same conclusion the hard way.

  Measurement alone is still not enough, for one specific reason: an
  approval costs nothing at the moment it is granted. `approve(attacker,
  everything)` moves no balance, passes any measurement, and is drained in
  the next block. Measurement is blind to it precisely because nothing has
  happened yet.

  So the two defences are layered, each covering the other's blind spot:

    · MEASURED   nothing may be smaller after the call than before it,
                 whatever the call was
    · REFUSED    while sealed, a promised asset hears only `transfer` and
                 `transferFrom`, and no ether leaves — because those are the
                 moves whose damage lands outside the window measurement
                 can see

  ── what the seal does not do ──

  It does not stop the account acting. A sealed vault can still vote, claim,
  compound, attest, and call anything that leaves it no poorer. That is the
  whole reason for measuring rather than freezing: a vault that cannot act
  is not a vault, it is a safe.

  It also cannot promise about an asset nobody named. Only the manifest is
  measured. An asset that arrives after the seal, in a token contract that
  was never listed, can leave freely — so `manifest()` is public and a
  buyer should read it, not assume it.

  ── the storage layout is the code forever ──

  The implementation address is an input to every Reach's address, so this
  layout can never change for a deployed band. It is frozen here with
  sixteen reserved slots at the end, and `docs/ACCOUNTS.md` carries the
  compiler's layout hash, which tools/verify-vault.mjs recomputes.

═══════════════════════════════════════════════════════════════════════════*/
contract Reach is IReach {
    /*═══════════════════ storage — frozen, append-only ═══════════════════*/

    struct CapSlot { address asset; uint128 cap; uint128 spent; }
    /// @dev `kind`: 1 = ERC-20 allowance (approve / increaseAllowance /
    ///      either permit), 2 = ERC-721/1155 operator, 3 = Permit2, where
    ///      `via` is the Permit2 contract and `asset` the token it names.
    struct Entry { address asset; uint8 kind; address spender; address via; }

    uint256 private _state;                                               // slot 0
    uint64  private _sealedUntil;                                         // slot 1 ─┐
    uint64  private _serial;                                              //         │ grants ever made
    uint64  private _revokedThrough;                                      //         ┘ grants ≤ this are dead
    uint256 private _attestationNonce;                                    // slot 2
    bytes32 private _auditRoot;                                           // slot 3
    address[] private _manifest;                                          // slot 4
    mapping(address => bool) public onManifest;                           // slot 5
    Piece[] private _pieces;                                              // slot 6
    mapping(address => Session) private _session;                         // slot 7
    mapping(address => uint64) private _grantSerial;                      // slot 8
    mapping(address => mapping(uint32 => mapping(address => bool))) private _target;   // slot 9
    mapping(address => mapping(uint32 => mapping(bytes4 => bool))) private _selector;  // slot 10
    mapping(address => CapSlot[]) private _caps;                          // slot 11
    Entry[] private _ledger;                                              // slot 12
    mapping(bytes32 => uint256) private _ledgerAt;                        // slot 13: entry key → index + 1
    uint256[16] private __gap;                                            // slots 14–29, reserved

    /*═══════════════════ constants (no slots) ═══════════════════*/

    /// @dev A promise nobody can outlive is indistinguishable from a burn.
    uint64  public constant MAX_SEAL = Ratchet.SEAL_CAP;
    /// @dev Bounded because every entry is two balance reads on every
    ///      sealed call, and an unbounded list is an unbounded gas cost
    ///      that eventually makes the account unusable.
    uint256 public constant MAX_MANIFEST = 16;
    uint256 public constant MAX_PIECES = 8;
    /// @dev The seal caps at a year. The market's seal caps at a year. This
    ///      did not cap at all, and accepted 2^64-1 — a key that outlives
    ///      everyone who could have revoked it. An adversarial review
    ///      pointed out it was the only time-promise in the collection
    ///      without a ceiling, which was an oversight rather than a decision.
    uint64  public constant MAX_SESSION = 365 days;
    uint256 public constant MAX_LIST = 16;
    uint256 public constant MAX_BATCH = 16;
    uint256 public constant MAX_LEDGER = 32;
    uint256 private constant MAX_CAPS = 8;
    uint256 private constant MAX_LIMITS = 4;
    uint32  private constant MAX_USES = 1024;
    uint32  private constant UNLIMITED = type(uint32).max;

    /// @notice The hub did not answer a question the account must have
    ///         answered before it acts. Fails closed: an account that
    ///         cannot read its own token's epoch does not get to assume
    ///         it is unchanged.
    error HubUnreadable();

    /*  The Yul optimizer's FunctionSpecializer clones `_read` / `_hubWord` /
        `_word` once per literal selector they are called with. Routing the
        selectors through immutables to defeat it was measured at +340 B —
        the PUSH32s cost more than the clones — so the clones stay.       */
    bytes4 private constant MAGIC = 0x1626ba7e;
    bytes4 private constant LEGACY_MAGIC = 0x20c13b0b;
    bytes4 private constant FAIL = 0xffffffff;
    bytes32 private constant PROBE =
        0x7739773977397739773977397739773977397739773977397739773977397739;

    /*──────────────── the lock ────────────────*/

    /// @dev A lock, on a contract that can never be redeployed.
    ///
    ///      The ownership check already stops the obvious re-entry: a token
    ///      called from inside `_run` that calls back into `execute` arrives
    ///      as itself, not as the holder, and is refused. So this is not
    ///      closing a known hole.
    ///
    ///      It is here because the thing being protected is a *snapshot taken
    ///      around an external call*, and nested snapshots interleave in ways
    ///      that are hard to reason about and impossible to patch afterwards
    ///      — the implementation address is an input to every vault's
    ///      address, so this code is the code forever. On a contract with no
    ///      upgrade path, cheap insurance against a class of bug is worth
    ///      more than the gas it costs. The slot is the one registered for
    ///      this purpose in Transient.sol; a revert releases it.
    modifier nonReentrant() {
        Transient.enter(Transient.REACH_LOCK);
        _;
        Transient.exit(Transient.REACH_LOCK);
    }

    /*═══ the manifest cannot move while a call is in flight ═══

      `_snapshot` and `_verify` align `pre[]` and `seen[]` with the manifest
      BY INDEX. `unguard` removes an entry by swapping the last one into its
      place, so an `unguard` re-entered from inside a sealed call renumbers
      the manifest underneath arrays that were taken before it — and a slot
      whose `seen` flag was false because a BROKEN token used to sit there
      now holds a real one, which `_verify` therefore skips.

      Measured, not reasoned about. A contract holder guarded two assets, a
      breakable one and a thousand GOLD, sealed for thirty days, then made
      the breakable one unreadable and sent one batch: transfer the GOLD
      out, then call back into `unguard` on the blind asset. The transfer
      alone reverts — the control is in the suite. With the `unguard`
      appended it went through, the vault ended with nothing, and
      `isSealed()` still answered true.

      `_pieces` has the same shape and a worse version: `unguardNFT` refuses
      while sealed only for a piece the account STILL HOLDS, so a batch that
      transfers the piece away first is then free to drop it from the list,
      and `_verifyPieces` never looks for it.

      IPSEITY closed both with a `_measuring` flag set only while sealed.
      INTACT's rule is simpler and stricter: the manifest is holder
      bookkeeping and has no business changing while the account is inside
      ANY call it made, sealed or not — the lock is already held for exactly
      the duration of that call, so the flag costs nothing and leaves no
      unsealed edge to reason about. The one thing lost is a contract holder
      guarding an asset from inside its own batch; it guards it in the next
      transaction instead.                                                 */
    modifier notInside() {
        if (Transient.held(Transient.REACH_LOCK)) revert ManifestBusy();
        _;
    }

    receive() external payable {}

    /*═══════════════════ who this account belongs to ═══════════════════*/

    /// @dev The registry appends salt, chainId, tokenContract and tokenId to
    ///      the proxy's runtime code. The proxy body is 45 bytes, so the
    ///      three values this needs begin at 0x4d.
    function token() public view returns (uint256 chainId, address tokenContract, uint256 tokenId) {
        assembly ("memory-safe") {
            let p := mload(0x40)
            extcodecopy(address(), p, 0x4d, 0x60)
            chainId := mload(p)
            tokenContract := and(mload(add(p, 0x20)), 0xffffffffffffffffffffffffffffffffffffffff)
            tokenId := mload(add(p, 0x40))
        }
    }

    function HUB() external view returns (address hub) {
        (, hub, ) = token();
    }

    /// @dev The custody epoch, for a path that ACTS: a hub that does not
    ///      answer (or a wrong chain) is a revert, never a zero.
    function _epoch() internal view returns (uint64 e) {
        (bool ok, uint256 w) = _hubWord(IIntact.custodyEpoch.selector);
        if (!ok) revert HubUnreadable();
        e = uint64(w);
    }

    /// @dev One word, by staticcall, from anybody: the hub, a token's
    ///      `balanceOf`, a collection's `ownerOf`. `ok` is separate because
    ///      "zero" and "no answer" are different facts everywhere in this
    ///      protocol, and a read owes its caller the distinction. One routine
    ///      rather than three, because each is a decoder's worth of bytes.
    function _read(address target, bytes4 s, uint256 arg) internal view returns (bool ok, uint256 word) {
        bytes memory r;
        (ok, r) = target.staticcall(abi.encodeWithSelector(s, arg));
        if (!ok || r.length < 32) return (false, 0);
        word = abi.decode(r, (uint256));
    }

    /// @dev One word from the hub, for a path that READS.
    function _hubWord(bytes4 s) internal view returns (bool ok, uint256 word) {
        (uint256 chain, address hub, uint256 id) = token();
        if (chain != block.chainid) return (false, 0);
        return _read(hub, s, id);
    }

    function owner() public view returns (address) {
        (bool ok, uint256 w) = _hubWord(IIntact.ownerOf.selector);
        return ok ? address(uint160(w)) : address(0);
    }

    function _guardian() internal view returns (address) {
        (bool ok, uint256 w) = _hubWord(IIntact.guardianOf.selector);
        return ok ? address(uint160(w)) : address(0);
    }

    function isValidSigner(address signer, bytes calldata) external view returns (bytes4) {
        address o = owner();
        return (signer == o && o != address(this)) ? this.isValidSigner.selector : bytes4(0);
    }

    /// @dev `onlySigner` = `HUB.ownerOf(id)` exactly. Operators, approvees,
    ///      renters and session keys are not the signer; a session acts
    ///      only through `executeAsSession` / `executeTyped`.
    modifier onlySigner() {
        _signer();
        _;
    }

    function _signer() internal view {
        address o = owner();
        if (msg.sender != o) revert NotSigner();
        // an account that owns its own token can authorise itself forever
        if (o == address(this)) revert OwnershipCycle();
    }

    /// @dev The signer, the token's guardian, or — for `panic` — the hub.
    function _signerGuardianOrHub() internal view {
        address o = owner();
        if (o == address(this)) revert OwnershipCycle();
        if (msg.sender == o) return;
        (, address hub, ) = token();
        if (msg.sender == hub || (msg.sender != address(0) && msg.sender == _guardian())) return;
        revert NotSignerOrGuardian();
    }

    function state() external view returns (uint256) {
        return _state;
    }

    function _bump() internal {
        unchecked { _state++; }
    }

    /*═══════════════════ sealing ═══════════════════*/

    /// @notice Promise that nothing on the manifest leaves before `until`.
    /// @dev    Ratchet-only, and it survives the sale of the token, because
    ///         it is a promise to whoever reads it rather than to whoever
    ///         made it. One rule for every time promise: Ratchet.raise.
    function seal(uint64 until) external onlySigner {
        _sealedUntil = Ratchet.raise(_sealedUntil, until, MAX_SEAL);
        _bump();
        emit Sealed(until);
    }

    /// @notice The longest seal there is, from now. For the holder, the
    ///         guardian, and the hub's `panic`.
    /// @dev    Not `Ratchet.raise`, deliberately: a panic must never fail
    ///         because the seal already stands at the cap. It still only
    ///         lengthens — a shorter promise is never written.
    function sealMax() external {
        _signerGuardianOrHub();
        uint64 until = uint64(block.timestamp) + MAX_SEAL;
        if (until > _sealedUntil) {
            _sealedUntil = until;
            _bump();
            emit Sealed(until);
        }
    }

    function sealedUntil() external view returns (uint64) {
        return _sealedUntil;
    }

    function isSealed() public view returns (bool) {
        return _sealedUntil > block.timestamp;
    }

    /*═══════════════════ the manifest ═══════════════════*/

    /*  There used to be a MEASURED flag packed into bit 255 of each
        snapshot word, on the reasoning that "balances cannot reach 2^255, so
        the bit is free". That was an assumption about somebody else's
        contract, and the assumption was the hole: a guarded token that
        returns `balance | (1 << 255)` makes the post-call comparison
        `now_ < pre` unconditionally false, and the seal silently stops
        constraining that asset. An adversarial review reproduced it —
        1,000 tokens walked out of a live seal.

        Nothing in ERC-20 reserves the high bit. A token may pack a flag
        there, return a scaled internal representation, or simply be
        hostile. So the flag lives in its own array: two allocations
        instead of one, and no bit of the balance is ours to borrow.       */

    /// @notice Put an asset under the seal.
    function guard(address asset) external onlySigner notInside {
        if (onManifest[asset]) revert AlreadyListed();
        if (_manifest.length >= MAX_MANIFEST) revert ManifestFull();
        onManifest[asset] = true;
        _manifest.push(asset);
        _bump();
        emit ManifestAdded(asset);
    }

    /// @notice Take an asset off the manifest. Only while unsealed — or,
    ///         while sealed, only an asset the account can no longer read.
    /// @dev    `guard` used to be additive forever, on the reasoning that an
    ///         asset which could be un-promised makes the manifest emptiable
    ///         instead of the vault. That reasoning is right *while the seal
    ///         holds* and wrong outside it: an unsealed account promises
    ///         nothing, so removing an entry takes nothing away from anybody.
    ///
    ///         The escape hatch, and the reason it does not weaken the seal:
    ///         the account refuses any call that ends with a manifest asset
    ///         unreadable, which is correct — but that rule is a door a
    ///         manifest asset can shut on the account at will. A token whose
    ///         balanceOf reverts on a condition it controls makes EVERY
    ///         sealed call revert, and a reverted call never persists, so the
    ///         trap re-arms itself. An adversarial review shut an account for
    ///         the full length of its seal with no way out.
    ///
    ///         So an asset the account cannot currently read may be removed
    ///         even while sealed. This gives nothing away: the seal was
    ///         already unable to promise anything about an asset it cannot
    ///         measure, and `unmeasurable()` has been saying so publicly the
    ///         whole time. The event is emitted either way, so a buyer
    ///         reading the log sees exactly when the promise narrowed.
    function unguard(address asset) external onlySigner notInside {
        if (!onManifest[asset]) revert NotListed();
        if (isSealed()) {
            (, bool ok) = _measure(asset);
            if (ok) revert IsSealed();
        }
        uint256 n = _manifest.length;
        for (uint256 i; i < n; ++i) {
            if (_manifest[i] == asset) {
                _manifest[i] = _manifest[n - 1];
                _manifest.pop();
                break;
            }
        }
        onManifest[asset] = false;
        _bump();
        emit ManifestRemoved(asset);
    }

    /*═══ the other manifest: NFTs, by identity ═══

      `balanceOf(address)` is the same WORD for ERC-20 and ERC-721 and not
      the same FACT: for a token it is an amount, for an NFT it is a count.
      The manifest used to claim it covered both, and an adversarial review
      swapped a valuable NFT out of a sealed vault for a worthless one — one
      out, one in, count unmoved, nothing to measure. So a guarded NFT is
      named by (collection, tokenId) and measured with `ownerOf`, which is
      exact. Bounded at eight because every entry is a call on every sealed
      action, and unlike balances there is no way to batch them.           */

    function guardNFT(address collection, uint256 tokenId) external onlySigner notInside {
        if (_pieces.length >= MAX_PIECES) revert PiecesFull();
        if (_ownerOfPiece(collection, tokenId) != address(this)) revert NotHeld();
        _pieces.push(Piece(collection, tokenId));
        _bump();
        emit PieceGuarded(collection, tokenId);
    }

    /// @dev Same rule as `unguard`: free while unsealed, and while sealed
    ///      only for a piece the account can no longer see.
    function unguardNFT(uint256 index) external onlySigner notInside {
        Piece memory pc = _pieces[index];
        if (isSealed() && _ownerOfPiece(pc.collection, pc.tokenId) == address(this)) revert IsSealed();
        _pieces[index] = _pieces[_pieces.length - 1];
        _pieces.pop();
        _bump();
        emit PieceReleased(pc.collection, pc.tokenId);
    }

    function manifest() external view returns (address[] memory) {
        return _manifest;
    }

    function pieces() external view returns (Piece[] memory) {
        return _pieces;
    }

    /// @notice Everything a buyer needs before agreeing a price: the assets
    ///         under the seal, what the account holds of each right now, and
    ///         whether each number is a measurement or a shrug.
    function holdings()
        external view
        returns (uint256 ether_, address[] memory assets, uint256[] memory balances, bool[] memory measured)
    {
        ether_ = address(this).balance;
        assets = _manifest;
        balances = new uint256[](assets.length);
        measured = new bool[](assets.length);
        for (uint256 i; i < assets.length; ++i) (balances[i], measured[i]) = _measure(assets[i]);
    }

    /// @notice Which manifest assets this account cannot currently measure —
    ///         and therefore cannot currently promise about.
    /// @dev    A buyer reads this next to `holdings()`. An empty list is the
    ///         seal at full strength; a non-empty one names exactly what has
    ///         fallen out of it, which is the difference between a limitation
    ///         and a lie.
    function unmeasurable() external view returns (address[] memory assets) {
        uint256 n = _manifest.length;
        address[] memory buf = new address[](n);
        uint256 k;
        for (uint256 i; i < n; ++i) {
            (, bool ok) = _measure(_manifest[i]);
            if (!ok) buf[k++] = _manifest[i];
        }
        assets = new address[](k);
        for (uint256 i; i < k; ++i) assets[i] = buf[i];
    }

    /*═══════════════════ acting ═══════════════════*/

    /// @notice ERC-6551 execute. Only CALL; only the holder.
    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external payable onlySigner nonReentrant returns (bytes memory)
    {
        if (operation != 0) revert OnlyCall();
        Guard memory g = _open();
        bytes memory r = _call(g, msg.sender, to, value, data);
        _close(g);
        return r;
    }

    /*═══ BATCHING ═══

      One approval and one action are one act, or neither happened. Without
      this a holder who wants to approve a venue and then use it has to send
      two transactions and live in the gap between them — and under a seal
      the gap is worse than untidy, because the first half can be front-run
      by anything that watches the mempool.

      The measurement wraps the WHOLE batch rather than each call, and that
      is deliberate. Per-call measurement would refuse the ordinary shape of
      real work — withdraw from one venue, deposit into another — because the
      account is genuinely poorer between the two. The seal's promise has
      always been about the state a transaction leaves behind, not about every
      instant inside it. Nothing can observe the middle of a batch except code
      the batch itself called, and that code cannot re-enter (see
      `nonReentrant`) or move an asset the ends do not account for.

      Approvals are still refused call by call, because an approval's damage
      lands in a later block where no end-of-batch measurement can reach it.

      An empty batch is refused. On ANIMA's `main` `executeBatch([])` ran the
      loop zero times and still advanced the state counter — with no
      authorisation at all, so anyone could invalidate every state-pinned
      session. The `koorbx` branch closed it; this inherits the fix.       */
    function executeBatch(Call[] calldata calls)
        external payable onlySigner nonReentrant returns (bytes[] memory)
    {
        uint256 n = calls.length;
        if (n == 0) revert EmptyBatch();
        if (n > MAX_BATCH) revert ListTooLong();
        Guard memory g = _open();
        bytes[] memory results = new bytes[](n);
        for (uint256 i; i < n; ++i) {
            results[i] = _call(g, msg.sender, calls[i].to, calls[i].value, calls[i].data);
        }
        _close(g);
        return results;
    }

    /*  The gauntlet, in three parts, shared by the holder and by every
        session key so that a session is never more trusted than whoever
        granted it. Three parts rather than one `_run(Call[])` because every
        path then hands its calldata straight through: a batch is iterated
        where it lies, and a single call never allocates a one-element array
        to share code — which, measured, was a calldata-to-memory copier for
        nested dynamic structs worth more bytes than the sharing saved.   */

    struct Guard { bool locked; uint256[] pre; bool[] seen; uint256 preEth; }

    function _open() internal view returns (Guard memory g) {
        g.locked = isSealed();
        if (g.locked) {
            // ether is not on any manifest and cannot be measured after the
            // fact against a payable call, so it is simply refused
            if (msg.value != 0) revert ValueWhileSealed();
            (g.pre, g.seen, g.preEth) = _snapshot();
        }
    }

    function _call(Guard memory g, address signer, address to, uint256 value, bytes calldata data)
        internal returns (bytes memory r)
    {
        bytes4 sel = _sel(data);
        if (g.locked) {
            if (value != 0) revert ValueWhileSealed();
            _refuseUnlessSafe(to, sel);
            _refuseBlindTarget(to, g.seen);
        }
        _bump();
        bool ok;
        (ok, r) = to.call{value: value}(data);
        if (!ok) {
            // bubble the callee's own revert rather than flattening it
            assembly ("memory-safe") { revert(add(r, 0x20), mload(r)) }
        }
        _note(to, data, sel);
        _audit(signer, to, value, sel, keccak256(data));
        emit Executed(to, value, sel, g.locked);
    }

    function _close(Guard memory g) internal view {
        if (g.locked) _verify(g.pre, g.seen, g.preEth);
    }

    /// @dev Chains chainId and this address into every link so a record from
    ///      one deployment can never be replayed as evidence about another.
    ///      (ANIMA AgentAccount `_audit`; operation is always 0 here.)
    function _audit(address signer, address to, uint256 value, bytes4 sel, bytes32 dataHash) internal {
        bytes32 prev = _auditRoot;
        bytes32 next = keccak256(abi.encode(
            prev, block.chainid, address(this), signer, to, value, sel, dataHash, uint8(0), _state, block.timestamp));
        _auditRoot = next;
        emit AuditEntry(next, prev, signer, to, value, sel, dataHash, _state);
    }

    function auditRoot() external view returns (bytes32) {
        return _auditRoot;
    }

    function _sel(bytes calldata d) internal pure returns (bytes4) {
        return d.length < 4 ? bytes4(0) : bytes4(d[0:4]);
    }

    /*═══════════════════ the two defences ═══════════════════*/

    /*═══ what a sealed account may say to an asset it has promised ═══

      This used to be a list of six approval selectors, refused by name. The
      file's own header says an enumeration cannot be completed — that is the
      entire argument for measuring balances instead of listing transfer
      words — and then the approval defence was an enumeration anyway,
      because measurement is structurally blind to an authority that moves
      nothing yet.

      An adversarial review walked straight through it with Permit2's
      `approve(address,address,uint160,uint48)`. Same standing custody,
      different word, not on the list. It never would be: the list can only
      contain approval shapes somebody had already thought of.

      So the polarity is inverted, at the one boundary where it can be.
      While sealed, a call to an asset ON THE MANIFEST must carry a selector
      from a short allowlist. Everything else is refused — approvals in every
      shape, permits in every shape, delegations, and words nobody has
      invented yet, all by the same rule and without naming any of them.

      The allowlist is exactly the two words whose damage measurement can
      see, because those are the only ones that need to be allowed:

          transfer(address,uint256)                 0xa9059cbb
          transferFrom(address,address,uint256)     0x23b872dd

      A call to anything NOT on either manifest is unrestricted. A guarded
      piece promises its identity even when its collection is not separately
      on the balance manifest, so calls to that collection receive the same
      defence.

      The cost is real and worth stating: a holder who wants to `claim()` on
      a promised target while sealed cannot. They can remove its promises
      before sealing, or not make them. Deny-by-default means some legitimate
      things are denied; that is what the word default is doing.           */
    function _refuseUnlessSafe(address to, bytes4 sel) internal view {
        bool promised = onManifest[to];
        if (!promised) {
            uint256 n = _pieces.length;
            for (uint256 i; i < n; ++i) {
                if (_pieces[i].collection == to) { promised = true; break; }
            }
        }
        if (!promised) return;                       // not promised, not policed
        if (sel != 0xa9059cbb && sel != 0x23b872dd) revert NotSafeWhileSealed(sel);
    }

    function _snapshot()
        internal view
        returns (uint256[] memory pre, bool[] memory seen, uint256 preEth)
    {
        uint256 n = _manifest.length;
        pre = new uint256[](n);
        seen = new bool[](n);
        for (uint256 i; i < n; ++i) (pre[i], seen[i]) = _measure(_manifest[i]);
        preEth = address(this).balance;
    }

    /// @dev The whole point: what the call *did* does not matter, only what
    ///      is left. A selector nobody has heard of is caught here.
    ///
    ///      An asset that could not be read before the call is not checked
    ///      after it — there is no number to compare against, and inventing
    ///      one would either brick the account or fake a promise. It is named
    ///      by `unmeasurable()` instead.
    ///
    ///      An asset that COULD be read before and cannot be read after is a
    ///      different matter, and it reverts: a call that ends with the
    ///      account unable to see an asset it could see a moment ago has
    ///      moved the account outside what the seal can attest to, and the
    ///      seal refuses rather than shrug.
    function _verify(uint256[] memory pre, bool[] memory seen, uint256 preEth) internal view {
        uint256 n = _manifest.length;
        for (uint256 i; i < n; ++i) {
            if (!seen[i]) continue;                        // was already blind here
            (uint256 now_, bool ok) = _measure(_manifest[i]);
            if (!ok) revert WentBlind(_manifest[i]);
            if (now_ < pre[i]) revert Shrank(_manifest[i], pre[i], now_);
        }
        if (address(this).balance < preEth) revert Shrank(address(0), preEth, address(this).balance);
        n = _pieces.length;
        for (uint256 i; i < n; ++i) {
            Piece memory pc = _pieces[i];
            if (_ownerOfPiece(pc.collection, pc.tokenId) != address(this)) revert PieceLeft(pc.collection, pc.tokenId);
        }
    }

    /*  The other half of the blindness rule, and the half that was missing.

        An asset that could not be read at snapshot time is skipped by
        `_verify`. That is right, and it left a door open: the call being
        checked can be a call TO that very asset, which empties it and
        restores its readability on the way out. Snapshot sees nothing, the
        drain happens, verify skips it. An adversarial review reproduced it
        with a pausable token whose withdrawal function unpauses first.

        So: while sealed, the account will not call an asset it cannot
        currently measure. It is not a rule about what the call might do —
        it is a rule about the account's own eyesight.                    */
    function _refuseBlindTarget(address to, bool[] memory seen) internal view {
        uint256 n = _manifest.length;
        for (uint256 i; i < n; ++i) {
            if (_manifest[i] == to && !seen[i]) revert BlindTarget(to);
        }
    }

    /// @dev `ok` is returned separately, and the distinction is load-bearing.
    ///      An asset that ANSWERS zero and an asset that DOES NOT ANSWER are
    ///      not the same fact, and collapsing them was a silent hole: a token
    ///      whose proxy breaks reads as zero both before and after a call, so
    ///      `now_ < pre` is false and the seal quietly stops promising
    ///      anything about it — with no revert and no event.
    function _measure(address asset) internal view returns (uint256 value, bool ok) {
        (ok, value) = _read(asset, IERC20Exact.balanceOf.selector, uint160(address(this)));
    }

    /// @dev Native or ERC-20, one word; a blind asset reads as zero here,
    ///      which for a CAP is the conservative reading (a fall to "zero"
    ///      charges the whole balance against the cap).
    function _balance(address asset) internal view returns (uint256 v) {
        if (asset == address(0)) return address(this).balance;
        (v, ) = _measure(asset);
    }

    function _ownerOfPiece(address collection, uint256 tokenId) internal view returns (address) {
        (bool ok, uint256 w) = _read(collection, IIntact.ownerOf.selector, tokenId);
        return ok ? address(uint160(w)) : address(0);
    }

    /*═══════════════════ SESSION KEYS — one system ═══════════════════

      A key the holder grants to something that is not them — a bot, a
      keeper, an agent, a model — so it can act on the Reach without
      holding the token.

      Every ALLOWLIST session is bounded, and every bound is checked on
      every call: an expiry it cannot extend, an allowlist of targets it
      cannot widen, an allowlist of selectors it cannot widen, a cumulative
      native cap it cannot raise, per-asset ERC-20 caps charged by what
      actually left, a use count and a minimum interval. A RECIPE session is
      one exact call: target, calldata hash, the target's code hash, exact
      value, a use count and an interval — the permission a page can safely
      request for "swap 1 ETH on my pool once a day".

      Three escalations are refused by shape rather than by budget:

        · a session cannot call this account, and cannot call a grant, seal
          or revoke word on any account. Otherwise its first act is
          grantSession on itself with no limits.
        · a session cannot grant an approval to a spender that is not
          itself on the target allowlist. `approve` is called *on* the
          token contract, so allowlisting the target says nothing about
          who is being trusted — the argument has to be checked, not the
          callee. Permit2's spender is its SECOND argument.
        · a session cannot touch the Grip, because the Grip has no
          function that spends. Nothing enforces this; there is nothing
          to enforce.

      Every session is stamped with the hub's custody epoch at grant and
      compares it live, so a key dies the moment the token changes hands and
      does not revive when it is bought back — a counter only goes forward,
      and an address check would have woken every retired key. Sessions
      also require the token to be `Active`: a sale pauses it, so a buyer's
      inherited keys do nothing until the buyer re-arms.

      The seal composes on top: while the Reach is sealed, a session is
      subject to the same measurement and the same refusals as the holder.
      A session is never *more* trusted than the person who granted it.  */

    /*  Keyed by a list epoch as well as by address, and the epoch is the fix.

        `revokeSession` used to be `delete sessionOf[key]` — which clears the
        struct and leaves the allowlists standing, because Solidity cannot
        delete a mapping. Re-granting the same key wrote its new allowlists
        on top of the old ones, and every permission that key had EVER held
        came back. Grant [poolA], revoke, re-grant [poolB], and it can still
        reach poolA. Bumping `listEpoch` on both grant and revoke retires the
        old entries without enumerating them.

        `revokeAllSessions` has the same shape one level up: a mapping of
        keys cannot be enumerated either. Every grant takes a serial number;
        revoking everything moves `_revokedThrough` up to the latest serial,
        and a session is alive only if its serial is past it. O(1), and the
        Session struct the interface froze stays exactly as it is.         */

    /// @dev The one writer of a grant: the whole struct, every field. Every
    ///      field is a parameter so there is one body to inline (the compiler
    ///      inlines it into both grants anyway — measured, and a version that
    ///      wrote the eight slots in assembly saved 218 B, but tools/
    ///      static-audit.mjs forbids a raw `sstore` with no exemption, which
    ///      is the right rule to lose 218 B to). Returns the fresh list epoch.
    function _store(
        address key, SessionKind kind, uint64 expires, uint128 nativeCap, uint32 uses, uint32 minInterval,
        bytes32 dataHash, bytes32 targetCodeHash, address target, uint256 exactValue
    ) internal returns (uint32 le, uint64 epoch) {
        if (key == address(0) || key == address(this)) revert NoPrivilegeEscalation();
        if (expires > block.timestamp + MAX_SESSION) revert SessionTooLong();
        if (expires <= block.timestamp) revert SessionExpired();
        epoch = _epoch();
        Session storage s = _session[key];
        le = s.listEpoch + 1;    // every grant is a fresh epoch for the lists
        s.kind = kind;
        s.expires = expires;
        s.epoch = epoch;
        s.nativeCap = nativeCap;
        s.nativeSpent = 0;
        s.usesLeft = uses;
        s.minInterval = minInterval;
        s.lastUsed = 0;
        s.dataHash = dataHash;
        s.targetCodeHash = targetCodeHash;
        s.target = target;
        s.exactValue = exactValue;
        s.listEpoch = le;
        s.active = true;
        _grantSerial[key] = ++_serial;
        delete _caps[key];
        _bump();
    }

    /*  Two lists, not a list of pairs — and that is a wider grant than it
        looks. `targets` and `selectors` are checked independently, so a key
        granted [venueA, venueB] × [deposit, withdraw] may withdraw from A
        even if the intent was "deposit to A, withdraw from B".

        It is left this way on purpose. Storing explicit pairs would mean
        writing up to sixteen-by-sixteen entries in one grant — about five
        million gas — to express something the holder can already express
        exactly: **one key per pair**, or one recipe. Keys are free; storage
        is not. `sessionAllows` answers for any combination before you
        grant it.                                                          */
    /// @notice Hand a bounded key to something that is not you.
    /// @dev    Re-granting an existing key overwrites its terms and resets
    ///         what it has spent, which is the only sane reading of
    ///         "these are the new terms". `uses == 0` is unlimited.
    function grantSession(
        address key, uint64 expires, uint128 nativeCap, AssetCap[] calldata caps,
        address[] calldata targets, bytes4[] calldata selectors, uint32 minInterval, uint32 uses
    ) external onlySigner {
        if (targets.length > MAX_LIST || selectors.length > MAX_LIST || caps.length > MAX_CAPS) revert ListTooLong();
        (uint32 le, uint64 epoch) = _store(key, SessionKind.Allowlist, expires, nativeCap,
            uses == 0 ? UNLIMITED : uses, minInterval, 0, 0, address(0), 0);

        for (uint256 i; i < targets.length; ++i) {
            // an allowlist entry pointing back here is the escalation again
            if (targets[i] == address(this)) revert NoPrivilegeEscalation();
            _target[key][le][targets[i]] = true;
        }
        for (uint256 i; i < selectors.length; ++i) _selector[key][le][selectors[i]] = true;
        for (uint256 i; i < caps.length; ++i) _caps[key].push(CapSlot(caps[i].asset, caps[i].cap, 0));

        emit SessionGranted(key, SessionKind.Allowlist, expires, nativeCap, epoch);
    }

    /// @notice One exact call, `uses` times, at most once per `minInterval`.
    /// @dev    The target's code hash is pinned at grant: a proxy upgraded
    ///         under a recipe is a different contract, and the recipe dies
    ///         with the old one rather than running against code nobody
    ///         reviewed.
    function grantRecipe(
        address key, uint64 expires, address target, bytes32 dataHash, uint256 exactValue, uint32 uses, uint32 minInterval
    ) external onlySigner {
        if (uses == 0) revert NoUsesLeft();
        if (uses > MAX_USES) revert ListTooLong();
        if (target == address(this)) revert NoPrivilegeEscalation();
        if (target.code.length == 0) revert TargetNotAllowed(target);
        (, uint64 epoch) = _store(key, SessionKind.Recipe, expires, 0, uses, minInterval,
            dataHash, target.codehash, target, exactValue);
        // the event carries the per-use value (capped); `sessionExposure` is the worst case
        emit SessionGranted(key, SessionKind.Recipe, expires,
            exactValue > type(uint128).max ? type(uint128).max : uint128(exactValue), epoch);
    }

    /// @notice Immediate and unilateral. No delay, no notice, no appeal.
    ///         The holder's, and the guardian's.
    function revokeSession(address key) external {
        _signerGuardianOrHub();
        Session storage s = _session[key];
        s.active = false;
        s.listEpoch += 1;        // and retire the allowlists, which a delete cannot reach
        delete _caps[key];
        _bump();
        emit SessionRevoked(key);
    }

    /// @notice Every key, in one write. For the holder, the guardian, and
    ///         the hub's `panic`.
    function revokeAllSessions() external {
        _signerGuardianOrHub();
        _revokedThrough = _serial;
        _bump();
        emit AllSessionsRevoked(msg.sender);
    }

    /// @dev Alive: granted, not revoked singly or wholesale, unexpired, and
    ///      stamped with the epoch the token is in NOW. Reads, never reverts.
    function _live(address key) internal view returns (bool) {
        Session storage s = _session[key];
        if (!s.active || _grantSerial[key] <= _revokedThrough) return false;
        if (s.expires < block.timestamp) return false;
        if (s.usesLeft == 0) return false;
        (bool ok, uint256 e) = _hubWord(IIntact.custodyEpoch.selector);
        return ok && e == s.epoch;
    }

    /// @notice Whether a key is still the key the current holder inherited,
    ///         rather than one the person before them left running.
    function sessionCurrent(address key) public view returns (bool) {
        return _live(key);
    }

    function sessionAllows(address key, address to, bytes4 selector) external view returns (bool) {
        if (!_live(key) || to == address(this) || _privileged(selector)) return false;
        (bool ok, uint256 st) = _hubWord(IIntact.statusOf.selector);
        if (!ok || st != uint256(Status.Active)) return false;
        Session storage s = _session[key];
        if (s.kind == SessionKind.Recipe) return to == s.target;
        return _target[key][s.listEpoch][to] && _selector[key][s.listEpoch][selector];
    }

    /// @dev The stored terms as they are. `active` is the stored flag, not
    ///      the live answer — `sessionCurrent` folds in expiry, the epoch and
    ///      a wholesale revoke.
    function sessionOf(address key) external view returns (Session memory) {
        return _session[key];
    }

    function _capsView(address key, bool remaining) internal view returns (AssetCap[] memory caps) {
        CapSlot[] storage c = _caps[key];
        caps = new AssetCap[](c.length);
        for (uint256 i; i < c.length; ++i) {
            caps[i] = AssetCap(c[i].asset, remaining ? c[i].cap - c[i].spent : c[i].cap);
        }
    }

    function sessionCaps(address key) external view returns (AssetCap[] memory) {
        return _capsView(key, false);
    }

    /// @notice Worst case, printed before the holder signs: what is left of
    ///         the native cap (or value × uses for a recipe), and what is
    ///         left of every asset cap.
    function sessionExposure(address key) external view returns (uint256 nativeWorst, AssetCap[] memory caps) {
        Session storage s = _session[key];
        if (s.kind == SessionKind.Recipe) nativeWorst = s.exactValue * s.usesLeft;
        else nativeWorst = s.nativeCap - s.nativeSpent;
        caps = _capsView(key, true);
    }

    /// @dev The words a session may never say, to this account or any other
    ///      (a Reach that holds a second token is that token's signer, and a
    ///      session on the first must not reach the second's grants).
    function _privileged(bytes4 sel) internal pure returns (bool) {
        return sel == IReach.grantSession.selector || sel == IReach.grantRecipe.selector
            || sel == IReach.revokeSession.selector || sel == IReach.revokeAllSessions.selector
            || sel == IReach.seal.selector || sel == IReach.sealMax.selector;
    }

    /// @dev Every bound, on every call. Charges the native cap and the use
    ///      count; the asset caps are charged by `_charge` after the call,
    ///      because they are measured, not declared.
    function _authorize(address key, address to, uint256 value, bytes calldata data) internal returns (bytes4 sel) {
        /*  An ownership cycle is checked in `onlySigner`, and this is not
            `onlySigner`. That asymmetry was a hole with no floor under it:
            move the token into its own Reach and every holder path reverts
            OwnershipCycle forever, while an already-granted session key
            keeps full spending power that literally nobody can revoke. So
            the cycle is checked here too; in that state the assets are
            stuck, which is bad, and not stealable, which is what matters. */
        if (owner() == address(this)) revert OwnershipCycle();
        Session storage s = _session[key];
        if (!s.active || _grantSerial[key] <= _revokedThrough) revert NoSession();
        if (s.expires < block.timestamp) revert SessionExpired();
        uint64 e = _epoch();
        if (s.epoch != e) revert SoldOn(s.epoch, e);
        // a paused token has no acting keys: that is what makes the
        // guardian's pause real rather than advisory
        (bool ok, uint256 st) = _hubWord(IIntact.statusOf.selector);
        if (!ok) revert HubUnreadable();
        if (st != uint256(Status.Active)) revert NotActive();
        if (to == address(this)) revert NoPrivilegeEscalation();
        sel = _sel(data);
        if (_privileged(sel)) revert NoPrivilegeEscalation();
        uint64 soon = s.lastUsed + s.minInterval;
        if (soon > block.timestamp) revert TooSoon(soon);
        if (s.usesLeft == 0) revert NoUsesLeft();
        if (s.usesLeft != UNLIMITED) s.usesLeft -= 1;
        s.lastUsed = uint64(block.timestamp);

        if (s.kind == SessionKind.Recipe) {
            if (to != s.target || keccak256(data) != s.dataHash || to.codehash != s.targetCodeHash
                || value != s.exactValue) revert RecipeMismatch();
            return sel;
        }
        uint32 le = s.listEpoch;
        if (!_target[key][le][to]) revert TargetNotAllowed(to);
        if (!_selector[key][le][sel]) revert SelectorNotAllowed(sel);
        // an approval is a standing authority, so the party being trusted
        // has to be one the holder named, not merely the contract it is
        // named on
        (uint8 kind, address spender, , ) = _shape(data, sel);
        if (kind != 0 && !_target[key][le][spender]) revert SpenderNotAllowed(spender);
        if (value != 0) {
            uint256 wanted = uint256(s.nativeSpent) + value;
            if (wanted > s.nativeCap) revert SpendCapExceeded(s.nativeCap, wanted);
            s.nativeSpent = uint128(wanted);
        }
    }

    function _capsBefore(address key) internal view returns (uint256[] memory b) {
        CapSlot[] storage c = _caps[key];
        b = new uint256[](c.length);
        for (uint256 i; i < c.length; ++i) b[i] = _balance(c[i].asset);
    }

    /// @dev Measured, not decoded: whatever left, by whatever word, is
    ///      charged. A capped asset that goes blind inside the call reads as
    ///      having fallen to zero, which charges everything — fail closed.
    function _charge(address key, uint256[] memory b) internal {
        CapSlot[] storage c = _caps[key];
        for (uint256 i; i < c.length; ++i) {
            uint256 a = _balance(c[i].asset);
            if (a >= b[i]) continue;
            uint256 spent = uint256(c[i].spent) + (b[i] - a);
            if (spent > c[i].cap) revert AssetCapExceeded(c[i].asset, c[i].cap, spent);
            c[i].spent = uint128(spent);
        }
    }

    /// @notice Act under a session key rather than as the holder.
    function executeAsSession(address to, uint256 value, bytes calldata data)
        external nonReentrant returns (bytes memory)
    {
        bytes4 sel = _authorize(msg.sender, to, value, data);
        uint256[] memory b = _capsBefore(msg.sender);
        Guard memory g = _open();
        bytes memory r = _call(g, msg.sender, to, value, data);
        _close(g);
        _charge(msg.sender, b);
        emit SessionActed(msg.sender, to, value, sel);
        return r;
    }

    /*═══ "swap exactly this for at least that" — the agent's one shape ═══

      Pixel-Garden's `_perform`, kept as the one typed call: the holder or
      a session names what may leave (at most `amount` of each `spend`
      asset) and what must arrive (at least `amount` of each `receiveMin`
      asset). Approvals are exact, made only when the standing allowance is
      zero, and reset to zero — and PROVED zero — after the call, so no
      venue is ever left holding an allowance. Taxed and rebasing tokens
      revert by construction: the account measures what actually moved.  */
    function executeTyped(TypedCall calldata c) external nonReentrant returns (bytes memory) {
        if (block.timestamp > c.deadline) revert Expired();
        if (c.spend.length > MAX_LIMITS || c.receiveMin.length > MAX_LIMITS) revert ListTooLong();
        address o = owner();
        if (o == address(this)) revert OwnershipCycle();
        bool asSession = msg.sender != o;
        bytes4 sel;
        uint256[] memory b;
        if (asSession) {
            sel = _authorize(msg.sender, c.to, c.value, c.data);
            b = _capsBefore(msg.sender);
        }

        uint256[] memory sPre = new uint256[](c.spend.length);
        for (uint256 i; i < c.spend.length; ++i) {
            AssetLimit calldata l = c.spend[i];
            sPre[i] = _balance(l.asset);
            if (l.asset == address(0)) continue;           // the native leg is `c.value`, measured like the rest
            if (IERC20Exact(l.asset).allowance(address(this), c.to) != 0) revert AllowanceNotZero(l.asset, c.to);
            _approve(l.asset, c.to, l.amount);
        }
        uint256[] memory rPre = new uint256[](c.receiveMin.length);
        for (uint256 i; i < c.receiveMin.length; ++i) rPre[i] = _balance(c.receiveMin[i].asset);

        Guard memory g = _open();
        bytes memory r = _call(g, msg.sender, c.to, c.value, c.data);
        _close(g);

        for (uint256 i; i < c.spend.length; ++i) {
            AssetLimit calldata l = c.spend[i];
            if (l.asset != address(0)) _approve(l.asset, c.to, 0);
            uint256 now_ = _balance(l.asset);
            if (now_ + l.amount < sPre[i]) revert Overspend(l.asset, l.amount, sPre[i] - now_);
        }
        for (uint256 i; i < c.receiveMin.length; ++i) {
            AssetLimit calldata l = c.receiveMin[i];
            uint256 now_ = _balance(l.asset);
            if (now_ < rPre[i] + l.amount) revert Shortfall(l.asset, l.amount, now_ > rPre[i] ? now_ - rPre[i] : 0);
        }
        if (asSession) {
            _charge(msg.sender, b);
            emit SessionActed(msg.sender, c.to, c.value, sel);
        }
        return r;
    }

    /// @dev Exact, and proved: `ExactERC20.approveExact` reads the allowance
    ///      back. One function so the two call sites share its body.
    function _approve(address asset, address spender, uint256 amount) internal {
        ExactERC20.approveExact(asset, spender, amount);
    }

    /*═══════════════════ the open-approval ledger ═══════════════════

      Measurement sees what left; it cannot see what MAY leave. Every
      approval-shaped call the account makes — unsealed, to a promised or an
      unpromised asset — is therefore written down as (asset, spender), so a
      buyer reads the standing authorities beside the balances, the hub's
      fingerprint moves when one is granted, and the holder (or the
      guardian, or a panic) zeroes all of them in one call.

      The zeroing calls are gas-capped low-level calls that never block on a
      foreign revert: a token that refuses `approve(spender, 0)` keeps its
      entry and its event says so, and every other entry is still cleared.
      A ledger that could be bricked by one hostile token would be a ledger
      an attacker could keep an approval alive in.                        */

    /// @dev The approval family, and where each shape names its spender.
    ///      `on` is false for the shapes that REVOKE (amount zero, operator
    ///      false), which prune the ledger instead of growing it.
    function _shape(bytes calldata d, bytes4 sel)
        internal view returns (uint8 kind, address spender, address token_, bool on)
    {
        uint256 si;      // the word that names the spender
        uint256 oi;      // the word that says whether authority is granted or withdrawn
        bool mine;       // permits name their owner first; only ours count
        if (sel == 0x095ea7b3 || sel == 0x39509351) { kind = 1; oi = 1; }            // approve / increaseAllowance
        else if (sel == 0xa22cb465) { kind = 2; oi = 1; }                             // setApprovalForAll
        else if (sel == 0xd505accf) { kind = 1; si = 1; oi = 2; mine = true; }        // permit(owner,spender,value,…)
        else if (sel == 0x8fcbaf0c) { kind = 1; si = 1; oi = 4; mine = true; }        // DAI permit(holder,spender,nonce,expiry,allowed,…)
        else if (sel == 0x87517c45) { kind = 3; si = 1; oi = 2; }                     // Permit2 approve(token,spender,amount,expiration)
        else return (0, address(0), address(0), false);
        address first = d.length < 36 ? address(0) : address(uint160(uint256(bytes32(d[4:36]))));
        spender = address(uint160(_word(d, si)));
        token_ = first;
        on = _word(d, oi) != 0 && (!mine || first == address(this));
    }

    function _word(bytes calldata d, uint256 i) internal pure returns (uint256) {
        uint256 at = 4 + i * 32;
        if (d.length < at + 32) return 0;
        return uint256(bytes32(d[at:at + 32]));
    }

    function _key(Entry memory e) internal pure returns (bytes32) {
        return keccak256(abi.encode(e.asset, e.kind, e.spender, e.via));
    }

    function _note(address to, bytes calldata data, bytes4 sel) internal {
        (uint8 kind, address spender, address token_, bool on) = _shape(data, sel);
        if (kind == 0) return;
        Entry memory e = Entry(kind == 3 ? token_ : to, kind, spender, to);
        bytes32 k = _key(e);
        uint256 at = _ledgerAt[k];
        if (!on) { if (at != 0) _drop(at - 1); return; }
        if (at != 0) return;
        if (_ledger.length >= MAX_LEDGER) revert LedgerFull();
        _ledger.push(e);
        _ledgerAt[k] = _ledger.length;
        emit ApprovalRecorded(e.asset, spender);
    }

    function _drop(uint256 i) internal {
        uint256 last = _ledger.length - 1;
        delete _ledgerAt[_key(_ledger[i])];
        if (i != last) {
            _ledger[i] = _ledger[last];
            _ledgerAt[_key(_ledger[i])] = i + 1;
        }
        _ledger.pop();
    }

    function openApprovals() external view returns (OpenApproval[] memory list) {
        list = new OpenApproval[](_ledger.length);
        for (uint256 i; i < list.length; ++i) list[i] = OpenApproval(_ledger[i].asset, _ledger[i].spender);
    }

    /// @notice Folded into the hub's fingerprint: a standing authority
    ///         granted between a handshake and a settlement moves the hash.
    function openApprovalsRoot() external view returns (bytes32 h) {
        uint256 n = _ledger.length;
        for (uint256 i; i < n; ++i) h = keccak256(abi.encode(h, _key(_ledger[i])));
    }

    /// @notice Zero every recorded approval. One click; never blocked by a
    ///         token that refuses.
    function revokeOpenApprovals() external nonReentrant {
        _signerGuardianOrHub();
        uint256 i = _ledger.length;
        while (i != 0) {
            --i;
            Entry memory e = _ledger[i];
            // `setApprovalForAll(spender, false)` and `approve(spender, 0)` are
            // one ABI shape; Permit2's is the other
            bytes memory call_ = e.kind == 3
                ? abi.encodeWithSelector(0x87517c45, e.asset, e.spender, uint160(0), uint48(0))
                : abi.encodeWithSelector(e.kind == 1 ? bytes4(0x095ea7b3) : bytes4(0xa22cb465), e.spender, uint256(0));
            (bool ok, ) = e.via.call{gas: 150_000}(call_);
            if (ok) _drop(i);
            emit ApprovalRevoked(e.asset, e.spender, ok);
        }
        _bump();
    }

    /*═══════════════════ receiving ═══════════════════*/

    /// @dev Refuses this account's own token. An account that owns the token
    ///      that owns it can authorise itself forever, and no holder function
    ///      can ever run again. The hub's `_update` refuses every canonical
    ///      account of the collection as a recipient (DESIGN.md §2); this is
    ///      the redundant guard at the polite door.
    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external view returns (bytes4) {
        (uint256 chainId, address tokenContract, uint256 id) = token();
        if (msg.sender == tokenContract && tokenId == id && chainId == block.chainid) revert OwnershipCycle();
        return this.onERC721Received.selector;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external pure returns (bytes4)
    {
        return this.onERC1155BatchReceived.selector;
    }

    /*═══════════════════ ERC-1271 — the voice, and its wall ═══════════════

      A sealed account used to return zero to every signature, which is the
      safe answer and the wrong one. A signature is how an account says
      something, and an account that cannot say anything for a year is not
      sealed, it is gagged.

      But the reason for the gag was real: an unrestricted `isValidSignature`
      is a hole straight through the seal. Sign a market order, hand the
      assets over, and no measurement ever runs — because no call was ever
      made to this contract to measure around.

      The resolution is domain separation, and it is arithmetic rather than a
      list. The Reach signs exactly ONE struct, ever:

          Attestation(string purpose, bytes32 payload, uint256 nonce,
                      uint64 deadline, address account, uint256 tokenId,
                      uint64 custodyEpoch)

      under its own INTACT_ATTESTATION domain, wrapped as ERC-7739
      `TypedDataSign` so the account's name, version, chain and address are
      folded into what the holder signs — a holder who owns twelve Intacts
      signs for one of them, and that signature is worth nothing on the
      other eleven, on another band, after a sale (`custodyEpoch`), or after
      `retireAttestations()` (`nonce`).

      Two ways to ask, and the seal decides which is open:

        UNSEALED   the verifier's hash may be the attestation's `payload`:
                   "I, this account, under this epoch and nonce, until this
                   deadline, for this purpose, stand behind THAT hash". That
                   is how the Reach is an owner of a Safe: the Safe asks
                   about its transaction hash, and the Reach's answer is an
                   attestation whose payload is exactly that hash — the
                   verifier's hash is never mutated, only bound.

        SEALED     the verifier's hash must BE the attestation digest. Every
                   venue hashes its orders under its own domain separator, so
                   an order hash can never equal the output of
                   `attestationDigest`, and a sealed account is structurally
                   incapable of signing one. Not disallowed: incapable. It
                   can still say who it is.

      Session keys never sign: only the holder's signature over the digest
      counts, and a holder that is itself a contract (a Safe, a 7702-
      delegated EOA) answers through its own ERC-1271. `0x7739…` with an
      empty signature answers `0x77390001`, the ERC-7739 capability probe.
      Safe ≥ 1.4.1 asks through the legacy `isValidSignature(bytes,bytes)`;
      that overload hashes the bytes and answers with ITS magic.          */

    bytes32 private constant _DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant _NAME_HASH = keccak256("INTACT_ATTESTATION");
    bytes32 private constant _VERSION_HASH = keccak256("1");
    string  private constant _ATTESTATION_TYPE =
        "Attestation(string purpose,bytes32 payload,uint256 nonce,uint64 deadline,address account,uint256 tokenId,uint64 custodyEpoch)";
    bytes32 private constant _ATTESTATION_TYPEHASH = keccak256(bytes(_ATTESTATION_TYPE));
    /// @dev ERC-7739 `TypedDataSign`, with this account's four domain fields
    ///      (no salt) and the Attestation type appended, as the standard
    ///      prescribes for a nested struct.
    bytes32 private constant _TYPED_DATA_SIGN_TYPEHASH = keccak256(abi.encodePacked(
        "TypedDataSign(Attestation contents,string name,string version,uint256 chainId,address verifyingContract)",
        _ATTESTATION_TYPE));

    function attestationNonce() external view returns (uint256) {
        return _attestationNonce;
    }

    /// @notice Invalidate every signature this account has ever given.
    function retireAttestations() external onlySigner {
        unchecked { _attestationNonce += 1; }
        _bump();
        emit AttestationsRetired(_attestationNonce);
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(_DOMAIN_TYPEHASH, _NAME_HASH, _VERSION_HASH, block.chainid, address(this)));
    }

    /// @notice The only digest this account will ever put its name to.
    function attestationDigest(string memory purpose, bytes32 payload, uint64 deadline)
        public view returns (bytes32)
    {
        (, , uint256 id) = token();
        return _digest(keccak256(bytes(purpose)), payload, deadline, id, _epoch());
    }

    function _digest(bytes32 purposeHash, bytes32 payload, uint64 deadline, uint256 id, uint64 epoch)
        internal view returns (bytes32)
    {
        bytes32 contents = keccak256(abi.encode(
            _ATTESTATION_TYPEHASH, purposeHash, payload, _attestationNonce, deadline, address(this), id, epoch));
        bytes32 wrapped = keccak256(abi.encode(
            _TYPED_DATA_SIGN_TYPEHASH, contents, _NAME_HASH, _VERSION_HASH, block.chainid, address(this)));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), wrapped));
    }

    /// @dev The two dynamic fields of the `abi.encode`d envelope — the
    ///      purpose string and the inner signature — by their head words,
    ///      every offset and length checked against the blob. Read by hand
    ///      because ERC-1271 owes its callers a plain no, and `abi.decode` on
    ///      a malformed blob is a revert.
    function _fields(bytes calldata blob) internal pure returns (bool ok, bytes calldata purpose, bytes calldata inner) {
        purpose = blob[0:0];
        inner = blob[0:0];
        for (uint256 headAt; headAt <= 96; headAt += 96) {
            uint256 off = uint256(bytes32(blob[headAt:headAt + 32]));
            if (off > blob.length || blob.length - off < 32) return (false, purpose, inner);
            uint256 len = uint256(bytes32(blob[off:off + 32]));
            if (blob.length - off - 32 < len) return (false, purpose, inner);
            if (headAt == 0) purpose = blob[off + 32:off + 32 + len];
            else inner = blob[off + 32:off + 32 + len];
        }
        ok = true;
    }

    /// @notice ERC-1271.
    /// @param  signature `abi.encode(string purpose, bytes32 payload, uint64
    ///         deadline, bytes inner)` — the preimage, so the account can
    ///         rebuild the digest itself instead of taking a hash on trust;
    ///         `inner` is the holder's signature over `attestationDigest`.
    function isValidSignature(bytes32 hash, bytes calldata signature) public view returns (bytes4) {
        if (hash == PROBE && signature.length == 0) return 0x77390001;
        address o = owner();
        if (o == address(0) || o == address(this) || signature.length < 128) return FAIL;
        (bool ok, uint256 epoch) = _hubWord(IIntact.custodyEpoch.selector);
        if (!ok) return FAIL;
        (bool okF, bytes calldata purpose, bytes calldata inner) = _fields(signature);
        if (!okF) return FAIL;
        bytes32 payload = bytes32(signature[32:64]);
        uint256 deadline = uint256(bytes32(signature[64:96]));
        if (deadline < block.timestamp || deadline > type(uint64).max) return FAIL;
        (, , uint256 id) = token();
        bytes32 d = _digest(keccak256(purpose), payload, uint64(deadline), id, uint64(epoch));
        if (hash != d && (isSealed() || hash != payload)) return FAIL;
        return ERC6492.isValidSignatureNowRaw(o, d, inner) ? MAGIC : FAIL;
    }

    /// @dev The legacy shape Safe 1.3.0 and 1.4.1 ask contract owners with
    ///      (`checkNSignatures` → `isValidSignature(data, sig)`, magic
    ///      `0x20c13b0b`); the hash it asks about is `keccak256(data)`.
    function isValidSignature(bytes calldata data, bytes calldata signature) external view returns (bytes4) {
        return isValidSignature(keccak256(data), signature) == MAGIC ? LEGACY_MAGIC : FAIL;
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7    // ERC-165
            || id == 0x6faff5f1    // IERC6551Account
            || id == 0x51945447    // IERC6551Executable
            || id == 0x150b7a02    // ERC721Receiver
            || id == 0x4e2312e0    // ERC1155Receiver
            || id == 0x1626ba7e;   // ERC-1271
    }
}
