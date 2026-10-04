# IPSEITY (Most-Advanced-NFT-Possible) — accounts, vaults, estate

Reader area: `src/IpseityAccount.sol`, `src/GripVault.sol`, `src/Lease.sol`, `src/Locker.sol`, `src/Consign.sol`, `src/Succession.sol`, `src/V4PositionPlanner.sol`, `src/interfaces/Standards.sol`, `AGENT.md`, plus their tests (`test/Lease.t.sol`, `test/Locker.t.sol`, `test/V4PositionPlanner.t.sol`, `test/Timelock.t.sol`, the account/kernel parts of `test/Ipseity.t.sol`) and the adversarial verifiers that actually exercise them (`tools/verify-vault.mjs`, `tools/verify-estate.mjs`, `tools/verify-timelock.mjs`, `tools/verify-findings.mjs`, the vault / keys / estate / lock drives inside `tools/verify-site.mjs`).

Checkout: `/home/user/Most-Advanced-NFT-Possible`, branch `ccr-931fe287-ijyztq` = the default branch state (HEAD `297e936`, 103 commits). Everything below was read from source; every number is either from a file (cited) or counted by me (said so). Read-only; nothing was compiled or run.

Related readers cover the hub (`Ipseity.sol`), the market (`Pool.sol`), messaging (`Parley*`), the launchpad (`Kiln`/`Facet`) and the site. I quote the hub only where my contracts depend on it.

---

## 0. Executive summary for the design team

1. **The vault is two ERC-6551 accounts per token at two salts.** The **Reach** (`IpseityAccount`) acts and is policed; the **Grip** (`GripVault`) receives and has *no function that spends*. The registry is the canonical singleton (`0x000000006551c19487814612e58FE06813775758`); the implementation is the collection's own. This is the single most reusable idea in the repo for the GOAL's "vault inside the NFT".
2. **The Reach's seal is enforced by measurement, not by a selector blocklist** — it snapshots every manifest asset's `balanceOf(this)` (and ether, and every guarded NFT's `ownerOf`) before a call and reverts if anything fell after. The one thing measurement cannot see (a standing approval) is handled by *deny-by-default*: while sealed, a call to a manifest asset may only be `transfer`/`transferFrom`. Eight separate adversarial findings (bit-255 escape, blind-asset drain, Permit2 approval shape, manifest renumbering mid-call, guarded-NFT drop-after-move, session keys surviving sale, revoke-not-clearing-mappings, replayable attestations) were reproduced and fixed; the fixes are quoted below.
3. **Session keys** (`grantSession`/`executeAsSession`) are the agent surface: bounded by expiry (≤365 d), target allowlist, selector allowlist, cumulative native spend cap; refused by shape from calling the account, from approving unlisted spenders (incl. Permit2's second argument), and retired automatically when the token is sold (stamped with the hub's transfer counter). Revocation is O(1) via per-key epochs.
4. **The estate contracts** (`Lease`, `Locker`, `Consign`, `Succession`) are small, standalone, pull-payment, fee-less, admin-less contracts over the hub. Each solves one real problem: paid rentals whose rent belongs to the *token*; time-locks with no early exit; consignment to a dealer with a floor; inheritance by dead-man's switch. All four are deployed on Base Sepolia and Ethereum Sepolia.
5. **The web UI is served from chain** two ways: `tokenURI` emits the whole WebGL instrument as a `data:` URI (~104 KB, 19.99 M gas), and `Premises` (ERC-5219) serves a multi-page HTML site over `web3://` with JS clients stored as Solidity string constants. **Ownership is verified in the browser only as a courtesy** (`eth_call ownerOf(id)` compared to the connected wallet, EIP-6963 picker + `eth_requestAccounts`); **the enforcement is the contracts' own modifiers** (`onlyOwner`, `onlyHolder`, `onlyOperator`, `onlySigner`). Reads are never gated. See §9.
6. **Reuse verdicts**: Grip reuse-verbatim; Reach adapt (hub coupling via `statsOf` and the 6551 footer); Lease adapt (needs five hub functions); Locker reuse-verbatim; Consign/Succession adapt (optional, high-value); V4PositionPlanner adapt only if the unified launchpad uses Uniswap v4 (and prefer the unmerged branch's authority rule); Standards.sol adapt; Timelock reuse-verbatim; AGENT.md's propose/act pattern adopt.

---

## 1. `src/IpseityAccount.sol` — the Reach (1,119 lines)

### 1.1 Purpose
The ERC-6551 account implementation every token's "acting hand" runs. Same registry, same CREATE2 derivation, same interfaces as the reference account, "One addition: a seal" (L26). Also carries session keys (bounded delegated authority), batching, an NFT identity manifest, and a domain-separated ERC-1271.

The header argues the whole design (L14–75). Load-bearing quotes:

> "Almost everyone passes the reference implementation and inherits its one structural gap: the holder can empty the account at any moment, including between agreeing a price for the token and settling it." (L18–21)

> "Not by listing the calls that move assets. That list cannot be completed: `transfer` and `transferFrom` are on it, but so is any protocol's `withdrawTo(address)`, `redeem`, `exit`, `sweep`, or a function nobody has written yet. A firewall that enumerates is a firewall with a hole in it shaped like whatever it has not heard of." (L37–41)

> "So the account MEASURES. Before a sealed call it records its own ether balance and its balance of every asset on its manifest; after the call it checks that not one of them fell." (L43–45)

> "· MEASURED   nothing may be smaller after the call than before it, whatever the call was · REFUSED    while sealed, no approval-family word executes at all, and no ether leaves" (L57–61)

> "It does not stop the account acting. A sealed vault can still vote, claim, compound, sign, and call anything that leaves it no poorer. That is the whole reason for measuring rather than freezing: a vault that cannot act is not a vault, it is a safe." (L65–68)

### 1.2 Public API (full signatures, with line numbers)

ERC-6551 / identity
- `uint256 public state;` (L80) — bumped on every call (`unchecked { state++; }` at L715, L759).
- `function token() public view returns (uint256 chainId, address tokenContract, uint256 tokenId)` (L178) — reads the proxy footer with `extcodecopy(address(), …, 0x4d, 0x60)`; "The proxy body is 45 bytes, so the three values this needs begin at 0x4d" (L175–177).
- `function owner() public view returns (address)` (L186) — `address(0)` if `chainId != block.chainid`, else `IERC721Min(tokenContract).ownerOf(tokenId)`.
- `function isValidSigner(address signer, bytes calldata) external view returns (bytes4)` (L192).
- `modifier onlySigner()` (L196) — `msg.sender == owner()` and `owner() != address(this)` (reverts `OwnershipCycle`).
- `receive() external payable {}` (L171).

Seal
- `uint64 public sealedUntil;` (L85) · `uint64 public constant MAX_SEAL = 365 days;` (L88) · `uint256 public constant MAX_MANIFEST = 16;` (L93)
- `function seal(uint64 until) external onlySigner` (L210) — ratchet only: `until > block.timestamp`, `until > sealedUntil`, `until ≤ now + MAX_SEAL`.
- `function isSealed() public view returns (bool)` (L218).

Manifest (ERC-20-style, measured by balance)
- `address[] internal _manifest;` `mapping(address => bool) public onManifest;` (L109–110)
- `function guard(address asset) external onlySigner notWhileMeasuring` (L263)
- `function unguard(address asset) external onlySigner notWhileMeasuring` (L286) — free while unsealed; while sealed only if `_measure(asset)` fails (blind asset escape hatch, L289–313).
- `function manifest() external view returns (address[] memory)` (L385)
- `function holdings() external view returns (uint64 until, address[] memory assets, uint256[] memory balances, uint256 ether_)` (L392)
- `function unmeasurable() external view returns (address[] memory assets)` (L938)

Pieces (ERC-721 identity manifest)
- `struct Piece { address collection; uint256 tokenId; }` (L334) · `uint256 public constant MAX_PIECES = 8;` (L336) · `Piece[] internal _pieces;` (L337)
- `function guardNFT(address collection, uint256 tokenId) external onlySigner notWhileMeasuring` (L346) — requires `ownerOf == this` (`NotHeld`).
- `function unguardNFT(uint256 index) external onlySigner notWhileMeasuring` (L355) — while sealed only for a piece no longer held.
- `function pieces() external view returns (Piece[] memory)` (L365)

Session keys
- `struct Session { uint64 expires; uint128 spendCap; uint128 spent; bool active; uint32 mark; }` (L434–457)
- `uint256 public constant MAX_LIST = 16;` (L459) · `uint64 public constant MAX_SESSION = 365 days;` (L467)
- `mapping(address => Session) public sessionOf;` (L469) · `mapping(address => uint256) public sessionEpoch;` (L513)
- `function sessionCurrent(address key) public view returns (bool)` (L488)
- `function sessionTarget(address key, address target) public view returns (bool)` (L517) · `function sessionSelector(address key, bytes4 sel) public view returns (bool)` (L520)
- `function grantSession(address key, uint64 expires, uint128 spendCap, address[] calldata targets, bytes4[] calldata selectors) external onlySigner` (L548)
- `function revokeSession(address key) external onlySigner` (L582)
- `function sessionAllows(address key, address to, bytes4 selector) external view returns (bool)` (L589)
- `function executeAsSession(address to, uint256 value, bytes calldata data) external nonReentrant returns (bytes memory result)` (L599)

Acting
- `struct Call { address to; uint256 value; bytes data; }` (L687) · `uint256 public constant MAX_BATCH = 16;` (L689)
- `function executeBatch(Call[] calldata calls) external payable onlySigner nonReentrant returns (bytes[] memory results)` (L691)
- `function execute(address to, uint256 value, bytes calldata data, uint8 operation) external payable onlySigner nonReentrant returns (bytes memory result)` (L730) — `operation != 0` reverts `OnlyCall` (no delegatecall, ever).

Receiving
- `onERC721Received` (L957, refuses the account's own token: `OwnershipCycle`), `onERC1155Received` (L967), `onERC1155BatchReceived` (L971).

ERC-1271 / attestation
- `uint256 public attestationNonce;` (L1031) · `function retireAttestations() external onlySigner` (L1036)
- `function domainSeparator() public view returns (bytes32)` (L1043) — name `IPSEITY_ATTESTATION`, version `1`, `verifyingContract = address(this)`.
- `function attestationDigest(string memory purpose, bytes32 payload, uint64 deadline) public view returns (bytes32)` (L1049) — typehash `Attestation(string purpose,bytes32 payload,uint256 nonce,uint64 deadline)` (L1028).
- `function decodeAttestation(bytes calldata blob) external pure returns (string memory purpose, bytes32 payload, uint64 deadline, bytes memory inner)` (L1064) — external so it can be `try`-called.
- `function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4)` (L1076).
- `function supportsInterface(bytes4 id) external pure returns (bool)` (L1112): `0x01ffc9a7`, `0x6faff5f1` (IERC6551Account), `0x51945447` (IERC6551Executable), `0x150b7a02`, `0x4e2312e0`.

Internal gauntlet: `_act` (L740), `_refuseUnlessSafe` (L816), `_snapshot` (L834), `_verify` (L860), `_refuseBlindTarget` (L888), `_measure` (L920), `_balance` (L928), `_verifyPieces` (L376), `_ownerOfPiece` (L367), `_mark` (L476), `_signedByHolder` (L1095).

### 1.3 Storage layout (declaration order)
`state` (slot 0) · `sealedUntil` (uint64, slot 1) · `_manifest` (dynamic array) · `onManifest` (mapping) · `_entered` (reentrancy word) · `_measuring` (bool) · `_pieces` (Piece[]) · `sessionOf` · `sessionEpoch` · `_sessionTarget` (key ⇒ epoch ⇒ target ⇒ bool) · `_sessionSelector` (key ⇒ epoch ⇒ bytes4 ⇒ bool) · `attestationNonce`. Constants (`MAX_SEAL`, `MAX_MANIFEST`, `MAX_PIECES`, `MAX_LIST`, `MAX_SESSION`, `MAX_BATCH`, typehashes) occupy no slots. Because the account address derives from the implementation address, **this storage layout and code can never be changed for existing tokens** (L148–161: "the implementation address is an input to every vault's address, so this code is the code forever").

### 1.4 Events and errors
Events: `Sealed(uint64 until)`, `ManifestAdded(address indexed asset)`, `ManifestRemoved(address indexed asset)`, `Executed(address indexed to, uint256 value, bytes4 selector, bool sealedNow)` (L112–115); `PieceGuarded`, `PieceReleased` (L339–340); `SessionGranted(address indexed key, uint64 expires, uint128 spendCap)`, `SessionRevoked(address indexed key)`, `SessionActed(address indexed key, address indexed to, uint256 value, bytes4 selector)` (L524–526); `AttestationsRetired(uint256 nonce)` (L1033).

Errors (all custom, terse nouns): `NotSigner`, `OnlyCall`, `RatchetOnly`, `SealTooLong`, `IsSealed`, `NotSafeWhileSealed(bytes4)`, `ValueWhileSealed`, `Shrank(address,uint256,uint256)`, `ManifestFull`, `AlreadyListed`, `NotListed`, `WentBlind(address)`, `BlindTarget(address)`, `Reentered`, `OwnershipCycle`, `NoSession`, `SessionExpired`, `SessionTooLong`, `WrongChain`, `CannotReadHistory`, `TargetNotAllowed(address)`, `SelectorNotAllowed(bytes4)`, `SpendCapExceeded(uint256,uint256)`, `SpenderNotAllowed(address)`, `NoPrivilegeEscalation`, `ListTooLong` (L117–146); `ManifestBusy` (L257); `PiecesFull`, `NotHeld`, `PieceLeft(address,uint256)` (L342–344); `SoldOn(uint32 granted, uint32 now_)` (L471).

### 1.5 Access control
- Holder paths (`seal`, `guard`, `unguard`, `guardNFT`, `unguardNFT`, `grantSession`, `revokeSession`, `executeBatch`, `execute`, `retireAttestations`): `onlySigner` = exactly `ownerOf(tokenId)` on the hub, on this chain, and not the account itself. **ERC-721 operators, approvees and ERC-4907 renters cannot act through the Reach.**
- Session path (`executeAsSession`): `msg.sender` must have an active, unexpired session whose `mark == hub.statsOf(id).xfers`, with target and selector on the epoch-current allowlists, and may not target the account.
- Anyone: all views, receivers, `receive()`.

### 1.6 The gauntlet, step by step (`_act`, L740–773; `executeBatch`, L691–727)
1. `locked = isSealed()`.
2. If sealed: refuse `value != 0` and `msg.value != 0` (`ValueWhileSealed`); `_refuseUnlessSafe(to, data)`; `_snapshot()`; `_refuseBlindTarget(to, seen)`; set `_measuring = true`.
3. `state++`; `to.call{value}(data)`; bubble the callee's revert verbatim (assembly `revert(add(result,0x20), mload(result))`).
4. If sealed: `_measuring = false`; `_verify(pre, seen, preEth)` — each previously-readable manifest asset must still be readable (`WentBlind`) and not smaller (`Shrank`); ether not smaller; every guarded piece still `ownerOf == this` (`PieceLeft`).
5. Emit `Executed`.

Batch semantics: the snapshot wraps the **whole batch** (one `_snapshot` before, one `_verify` after), so "withdraw from one venue, deposit into another" is allowed; approvals are still refused per call (L667–685). Reasoning quoted: "The seal's promise has always been about the state a transaction leaves behind, not about every instant inside it."

`_refuseUnlessSafe` (L781–832): while sealed, a call whose target is on the manifest **or** is the collection of any guarded piece must carry selector `0xa9059cbb` (`transfer`) or `0x23b872dd` (`transferFrom`); anything else — including `balanceOf`, `claim`, every approval/permit shape — reverts `NotSafeWhileSealed(sel)`. Calls to anything not promised are unrestricted. The cost is stated: "a holder who wants to `claim()` on a promised target while sealed cannot. They can remove its promises before sealing, or not make them."

`_measure` (L920): `staticcall balanceOf(this)`; returns `(0,false)` on revert or short return. "An asset that ANSWERS zero and an asset that DOES NOT ANSWER are not the same fact" (L903).

### 1.7 Design decisions and the bugs they record (verbatim)
- **Bit-255 flag removed** (L95–107): "a guarded token that returns `balance | (1 << 255)` makes the post-call comparison `now_ < pre` unconditionally false … An adversarial review reproduced it — 1,000 tokens walked out of a live seal. … So the flag lives in its own array now."
- **`nonReentrant` on an unupgradeable contract** (L148–161): "cheap insurance against a class of bug is worth more than the gas it costs."
- **`notWhileMeasuring`** (L225–261): "`_snapshot` and `_verify` align `pre[]` and `seen[]` with the manifest BY INDEX. `unguard` removes an entry by swapping the last one into its place, so an `unguard` re-entered from inside a sealed call renumbers the manifest underneath arrays that were taken before it … Measured, not reasoned about … the vault ended with nothing, and `isSealed()` still answered true. … `nonReentrant` does not cover this: the re-entry is into a different function." Only while sealed, because "a batch that acquires a token and guards it in the same transaction is a thing somebody will reasonably want to do."
- **`unguard` while unsealed** (L272–285): append-only forever "had a cost nobody was paying for. Sixteen slots, no removal, and the manifest travels with the token."
- **Blind-asset escape hatch** (L289–309): "a token whose balanceOf reverts on a condition it controls makes EVERY sealed call revert, and a reverted call never persists, so the trap re-arms itself. An adversarial review shut an account for the full length of its seal with no way out … So an asset the account cannot currently read may be removed even while sealed."
- **Identity manifest** (L327–332, L895–900): "`balanceOf(address)` is the same WORD for ERC-20 and ERC-721 and not the same FACT … an adversarial review swapped a valuable NFT out of a sealed vault for a worthless one — one out, one in, count unmoved."
- **Session `mark`** (L439–456): "A session outlived the sale of the token it spends from … The mark is the hub's own transfer counter rather than the holder's address, because an address is not enough: sold to a stranger and bought back, an identity check would let every retired key wake up. A counter only goes forward. Four bytes, in the fifteen this struct was already leaving empty in its second slot."
- **`MAX_SESSION`** (L461–466): "This did not cap at all, and accepted 2^64-1 — a key that outlives everyone who could have revoked it."
- **Epoch-keyed allowlists** (L500–512): "`revokeSession` used to be `delete sessionOf[key]` — which clears the struct and leaves `sessionTarget` and `sessionSelector` standing, because Solidity cannot delete a mapping … Grant [poolA], revoke, re-grant [poolB], and it can still reach poolA."
- **Cross-product allowlists, documented not fixed** (L528–543): "Storing explicit pairs would mean writing up to sixteen-by-sixteen entries in one grant — two hundred and fifty-six SSTOREs, about five million gas — to express something the holder can already express exactly: **one key per pair.** Keys are free; storage is not."
- **Cycle check on the session path** (L602–614): "move the token into its own Reach and every holder path reverts OwnershipCycle forever, while an already-granted session key keeps full spending power that literally nobody can revoke … In that state the assets are stuck, which is bad; they are not stealable, which is the part that matters."
- **Permit2 spender check** (L646–653): "Permit2 approve(address token,address spender,uint160,uint48). The authority is granted to the second address, not the allowlisted Permit2 target and not the first ABI argument."
- **Deny-by-default replaced a six-selector list** (L781–815): "An adversarial review walked straight through it with Permit2's `approve(address,address,uint160,uint48)`. Same standing custody, different word, not on the list. It never would be."
- **`_refuseBlindTarget`** (L872–887): "the call being checked can be a call TO that very asset, which empties it and restores its readability on the way out … reproduced it with a pausable token whose withdrawal function unpauses first."
- **ERC-1271 under seal** (L979–1018): "an account that cannot say anything for a year is not sealed, it is gagged … The resolution is domain separation, and it is arithmetic rather than a list. (Taken from the DAVE V2 design note …) Every venue hashes its orders under its own domain separator … a sealed account is structurally incapable of signing one. Not disallowed: incapable."
- **Nonce + deadline** (L1022–1026): "the first version had neither and a signature therefore authenticated the same statement to everyone, forever."
- Signature malleability: `s` must be ≤ `0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0` (L1105).

### 1.8 Standards
ERC-6551 account (+executable, CALL only), ERC-165, ERC-721/1155 receiver, ERC-1271 (domain-separated under seal), EIP-712 (attestation domain). Deliberately no ERC-4337, no delegatecall, no ERC-6551 `isValidSigner` for operators.

### 1.9 Hub coupling (what a unified hub must provide)
- `ownerOf(uint256)` (L5, used by `owner()`).
- `statsOf(uint256) returns (ops, xfers, strata, open)` (L6–7) — `_mark()` decodes the second word; must be ≥64 bytes or the account fails closed (`CannotReadHistory`). The hub increments `xfers` in `transferFrom` (Ipseity.sol:1000–1001, saturating at `uint32.max`).
- The reference ERC-6551 proxy layout (footer at `0x4d`).
- The hub's `onlyOwner(id)` admits the token's Reach as the holder "wearing its other hand" (Ipseity.sol:291–299), and `isTransferable` refuses transfers to `account(id)` or `grip(id)` (Ipseity.sol:712–728).

### 1.10 Size and gas
- Deployed bytecode **12,315 B (50% of EIP-170)** (README:1039); "the Reach spends 7,302 policing a capability it has" (README:1062).
- Every sealed call costs 2 balance reads per manifest entry (≤16) + 1 `ownerOf` per piece (≤8) + 1 `statsOf` on the session path; this is why the lists are bounded (L90–92, L331–332).
- The Base Sepolia live exercise (DEPLOYMENTS.md:92–116) ran "IX · ERC-6551, the Reach and the Grip", "IX·b — a session key", "IX·c — the token signs", "XI · the Reach guards, then seals", "XI·b — the Grip" (tools/exercise.mjs:357–634) as part of 235 functions / 231 exercised / 159 assertions / 101 transactions.

### 1.11 Tests
- `tools/verify-vault.mjs` (869 lines; README claims 97 assertions, I count 116 assertion call sites some of which are in loops): "the obvious word — transfer", "a word no list has ever heard of" (Drainer.take), "approving a spender to pull later", "permit, which is an approval wearing a signature", "sending the vault's ether", "delegatecall, which would rewrite the account itself", "but an unlisted word said to a promised asset does not", "so ERC-1271 refuses while sealed", "the promise survives the sale", "and the buyer is bound by it too, until it expires", "an asset nobody put on the manifest can still leave — by design", "every state-changing function is a token receiver" (Grip ABI), "a selector it was not granted", "calling the account itself, to grant itself more", "approving a spender nobody named", "the spend cap counts across the whole session, not per call", "GOLD × approve is allowed, whether or not that pair was intended", "a token that stops answering is named", "going blind during a call is refused, not shrugged at", "a blind asset can be let go of; a visible one cannot", "a batch is one act or none", "a sealed vault can say who it is, and cannot promise what it holds", "and one bump retires every signature the account ever gave", "the manifest cannot move while a call is being measured" (SealBreaker), "a guarded piece cannot be dropped from inside the call that moves it", "a session key does not survive the sale" (incl. buy-back).
- `tools/verify-findings.mjs` claims 3, 4, 5, 7, 8, 10, 11, 12 (lines 229–709) reproduce-then-refute each fixed hole; claim 8 includes a control vault that guards only the collection and is shown to swap freely.
- `test/Ipseity.t.sol`: `test_boundAccountIsDerivedNotAsked` (L395), `test_sessionPermit2ApprovalChecksTheActualSpender` (L407).
- `tools/verify-site.mjs` "driving the session keys" (L2103–2173) grants through the `/keys` page and asks the account selector-by-selector; "the session surface is discoverable" / "/k — the one surface where the actor is not the holder" (L603).
- `tools/probe-reach.mjs` (scratch, not in `npm run check`): shows a sealed Reach still approves-for-all on an *unguarded* foreign NFT, can move an unguarded piece, cannot `guardNFT` a contract with no `ownerOf` (ERC-1155 cannot be guarded by identity), and that guarding a collection as if ERC-20 applies the selector allowlist to it.
- Mocks: `Breakable` (balanceOf/transfer that can be switched off), `Drainer`, `Permit2ish`, `SealBreaker` (contract holder that re-enters `unguard`), `Trap` (token that reads `state()` to tell snapshot from verify), `HighBit`, `Broker`, `ERC6551Registry` (reference registry bytecode).

### 1.12 Weaknesses / open items
- Hard dependency on the reference ERC-6551 proxy footer offset `0x4d` and on `statsOf`'s 4-word shape — a unified hub must keep both or re-derive `_mark`.
- ERC-1155 holdings cannot be guarded by identity (`guardNFT` requires `ownerOf`), only by count via `guard(collection)` which is blind to ids.
- `spendCap` counts native value only; ERC-20 outflow under a session is bounded only by allowlists (and by the seal if sealed).
- A sealed Reach cannot sign any venue's EIP-712 order (by design) and cannot `claim()`/`vote()` on a promised asset (documented cost).
- A rebasing-down token on the manifest will make any sealed call that touches nothing still fail `Shrank` if the rebase happens inside the call; between calls it is unaffected (snapshot per call).
- A token transferred into its own Reach via plain `transferFrom` is frozen (hub `isTransferable` now refuses when the registry exists, Ipseity.sol:725–726, but hubs deployed before 2026-08-20 lack it — DEPLOYMENTS.md:313–320).
- Unaudited (INVARIANTS.md "C"; MAINNET_READINESS.md lists an audit of IpseityAccount as a blocking gate).

### 1.13 Reuse verdict: **adapt**
Keep the whole mechanism (seal/manifest/pieces/batch/session/attestation) — it is the best-argued vault in any of the four repos and has survived an adversarial campaign. Adapt: (a) decide what the unified hub's transfer-counter getter is called and keep `_mark` fail-closed; (b) consider whether the unified token wants session keys *here* or in the ANIMA-style `AgentAccount` (another reader's area) — do not ship two session-key systems; (c) keep the ERC-6551 reference proxy so the footer trick holds; (d) `supportsInterface` could add ERC-1271's id; (e) the storage layout is frozen the moment it is deployed, so settle the design before mainnet.

---

## 2. `src/GripVault.sol` — the Grip (162 lines)

### 2.1 Purpose
"A second ERC-6551 account for every token, at a second salt. It receives and it does not spend. There is no `execute`, no `withdraw`, no sweep, no rescue, no owner override, and no admin. Read the ABI: there is no function on this contract that moves an asset out of it, for anybody, ever." (L8–12). Credited to "the Gate from the CONGREGATION meld design — *'Grip → Reach: never. No function exists. Not for the bearer, not for the mind, not for governance.'*" (L30–32).

Why it exists, verbatim (L14–28): "look at what it cost: a manifest, a snapshot, a verification pass, an approval blocklist, a delegatecall ban, an ERC-1271 refusal, and a documented blind spot for assets nobody thought to list. Every one of those exists because the capability to spend exists and is being policed. This contract does not police the capability. It does not have it."

Cost, verbatim (L36–40): "An asset sent here is here until the token that owns it stops existing, which in this collection is never — there is no burn. A mistaken transfer into a Grip is a permanent mistake, and the interface says so before it will build the calldata."

### 2.2 Public API
- `function token() public view returns (uint256 chainId, address tokenContract, uint256 tokenId)` (L72) — same footer read as the Reach.
- `function owner() public view returns (address)` (L82).
- `receive() external payable {}` (L90); `onERC721Received` (L92), `onERC1155Received` (L96), `onERC1155BatchReceived` (L100) — all `pure`, all accept.
- `function holdings(address[] calldata assets) external view returns (uint256 ether_, uint256[] memory balances)` (L112) — unreadable asset ⇒ 0.
- `function isOneWay() external pure returns (bool)` (L126) — always true, "Stated in the ABI as well as the prose".
- `function state() external pure returns (uint256)` (L135) — constant 0.
- `function isValidSigner(address, bytes calldata) external pure returns (bytes4)` (L144) — always `bytes4(0)`.
- `function isValidSignature(bytes32, bytes calldata) external pure returns (bytes4)` (L150) — always `bytes4(0)`.
- `function supportsInterface(bytes4 id) external pure returns (bool)` (L154): `0x01ffc9a7`, `0x6faff5f1`, `0x150b7a02`, `0x4e2312e0` — "deliberately NOT 0x51945447 (IERC6551Executable): a client that checks before calling execute() is told the truth up front" (L159–160).

### 2.3 Storage, events, errors
No state variables, no events, no errors. Nothing to write.

### 2.4 Hub side
`GRIP_SALT = keccak256("IPSEITY.GRIP.v1")`, `REACH_SALT = bytes32(0)`, `ACCOUNT_SALT = REACH_SALT` alias (Ipseity.sol:163–168); `grip(id)` derives, `embodyGrip(id)` creates (anyone may pay; it never stamps `lastOp`) (Ipseity.sol:473–484). Hub `isTransferable` refuses `to == grip(id)` (Ipseity.sol:725–726).

### 2.5 Size / tests / measured
- **1,933 B (8%)** — "the smallest contract in the collection and carries the strongest promise in it" (README:1049, 1059–1062).
- `verify-vault.mjs` L270–330: "a second account, at a second salt", "every state-changing function is a token receiver" (asserted against the compiled ABI: the only non-view functions are the three `onERC…Received`), "there is no execute", "there is no withdraw, sweep, rescue or transfer", "there is no owner override, admin or upgrade path", "it says so itself", "and it declines to advertise IERC6551Executable", "the holder calling execute" refused, "no signer is ever valid", `holdings` reads ether 2e18.
- INVARIANTS 38–40, A0.
- Live: Base Sepolia 0x2e554f5a6680f4a7d2a7b797c5473379faed3ed4; Eth Sepolia 0x6c647713cdb3ed6abfdfb5e7faa9341bb6b761a0 (deployments/*.json).

### 2.6 Weaknesses
Permanence is the feature and the hazard (A0). `holdings` is pull-by-list (caller names the assets). Nothing enumerates NFTs held. No ERC-1271 means the Grip cannot even attest; fine by design.

### 2.7 Reuse verdict: **reuse-verbatim**
Zero dependencies beyond `ownerOf`. Change only the salt string if the collection name changes. The "ABI-shape test" (`verify-vault.mjs` L284–300) should be carried over as-is.

---

## 3. `src/Lease.sol` — paid rental of the instrument (421 lines)

### 3.1 Purpose
A counter for ERC-4907 rentals: "the instrument, rented by the day, by anyone" (L16). The token already had ERC-4907 and an `onlyOperator` that includes the user ("a renter may turn the solid, commit new orientations, set traits — may *drive the instrument* — and may not sell it", L26–28). Lease adds price, escrow and vesting.

Load-bearing decisions (L31–82):
- "Rent accrues to the *token*, not to the address that happens to hold it, and the holder withdraws … sell the token mid-month and the unpaid rent goes with it, because the business was never the seller's, it was the token's."
- "A transfer clears the ERC-4907 user … With money on the table it is a way to take some. So rent is escrowed, not paid, and it vests over the term."
- "'Broken' is not asserted by anyone. It is observed from the raw user and expiry the token still carries."
- "No protocol fee. There is no cut for the curator, no treasury address and no switch to add one later … the argument for adding one is always that it could be small rather than that anyone needs it."
- "No renewals, no auctions, no order book … The complicated versions can be built by a different contract the holder names instead of this one — which is the whole point of `leaseAgentOf` being a per-token address rather than a blessed singleton."

### 3.2 Public API
- `IIpseityLease public immutable HUB;` (L85); `constructor(IIpseityLease hub)` (L176).
- `struct Terms { uint128 perDay; uint32 minDays; uint32 maxDays; bool open; address by; }` (L87–100) — `by` stamps the author so a seller's terms cannot re-arm for a buyer.
- `struct Active { address renter; uint64 start; uint64 until; uint128 paid; uint64 seen; }` (L104–124) — `seen` = last block the lease was observed intact.
- `mapping(uint256 => Terms) public termsOf;` `mapping(uint256 => Active) public activeOf;` `mapping(uint256 => uint256) public earned;` (vested, per token) `mapping(address => uint256) public owed;` (refunds, per renter) (L126–134).
- `uint32 public constant MAX_DAYS = 365;` `uint128 public constant MAX_PER_DAY = 1e30;` (L136–137).
- Holder: `function list(uint256 id, uint128 perDay, uint32 minDays, uint32 maxDays) external onlyOwner(id)` (L186; requires `HUB.leaseAgentOf(id) == this`), `function delist(uint256 id) external onlyOwner(id)` (L198), `function collect(uint256 id, address to) external onlyOwner(id) nonReentrant` (L204), `function endLease(uint256 id) external onlyOwner(id)` (L263).
- Public: `function rent(uint256 id, uint32 dayCount, uint128 maxPerDay) external payable nonReentrant` (L221; exact `msg.value`, `maxPerDay` guards price moves), `function settle(uint256 id) external` (L252; anyone, free), `function claim() external nonReentrant` (L274; renter refund).
- Views: `function cost(uint256 id, uint32 dayCount) public view returns (uint256)` (L340), `function status(uint256 id) public view returns (bool ok, uint8 reason)` (L349; reason 0 rentable · 1 not listed · 2 agent not named · 3 already rented · 4 reserved), `function listing(uint256 id) external view returns (bool rentable, uint8 reason, uint128 perDay, uint32 minDays, uint32 maxDays, address renter, uint64 until, uint256 vested, bool bound)` (L374), `function obligations(uint256[] calldata ids, address[] calldata parties) external view returns (uint256 total)` (L406).
- No `receive()`/`fallback` (L417–420): "Ether arrives through `rent` or it does not arrive".

### 3.3 Events / errors / access
Events: `Listed`, `Delisted`, `Rented(id, renter, until, paid)`, `Settled(id, renter, toToken, toRenter)`, `Collected(id, to, amount)`, `Claimed(who, amount)` (L140–145). Errors: `NotHolder`, `NotAuthorised`, `NotOpen`, `AlreadyRented`, `BadTerm`, `PriceMoved`, `WrongPayment`, `NothingOwed`, `PayoutFailed`, `Reentrant` (L147–156).
`onlyOwner(id)` is strict `msg.sender == HUB.ownerOf(id)` (L166–174): "Ipseity's own `onlyHolder` admits ERC-721 operators, which is right for operating a token and wrong for emptying its account."

### 3.4 The books (`_settle`, L285–336)
Order is the whole fix: intact? → if still running, stamp `seen` and return; if term passed, vest whole. Otherwise (cut short): `end = min(seen, until)`, `keep = paid * (end - start) / span`, holder gets `keep`, renter gets the rest. "'Elapsed' is measured to the last block in which the lease was seen intact, not to now."
`_intact` (L367–371) compares `HUB.userExpires(id) == a.until` **and** `HUB.rawUserOf(id) == a.renter` — the second check was added by commit `f6dcdda` "Authenticate expired lease users" (2026-09-16) after a same-expiry user overwrite was found (test `test_sameExpiryUserOverwriteStillRefundsAfterTheTermHasPassed`, Lease.t.sol:290).

### 3.5 Hub coupling (Ipseity.sol:614–687)
`setUser` (holder/approvee), `leaseAgentOf` mapping + `setLeaseAgent(id, agent)` (**owner only**, not approvee, L651–663), `setUserVia(id,user,expires)` (agent only, `NotLeaseAgent`), `userOf` (zero after expiry), `userExpires`, `rawUserOf` (stored user even after expiry, L682–687), `locked`. `transferFrom` clears both the user and the agent (L989–998). The argument (L621–645): "an approval carries `transferFrom` with it. Handing a rental contract the right to sell the token in order to let it lend the token is a capability an order of magnitude wider than the thing it authorises."

### 3.6 Tests (`test/Lease.t.sol`, 26 tests incl. 2 fuzz)
`test_theAgentMaySetTheUserAndNothingElse`, `test_namingAnAgentIsForTheHolder`, `test_theAgentDoesNotSurviveTheSale`, `test_listingWithoutNamingTheAgentIsRefused`, `test_rentAndDrive`, `test_paymentMustBeExact`, `test_aRaisedPriceMakesTheRentFailRatherThanCostMore`, `test_oneRenterAtATime`, `test_termsAreEnforced`, `test_aTermThatRunsOutVestsWhole`, `test_aSaleMidTermSplitsTheRentByElapsedTime`, `test_theBuyerCollectsTheRentNotTheSeller`, `test_theRenterReclaimsTimeTheyDidNotGet`, `test_theHolderMayEndALeaseAndPaysForIt`, `test_delistingDoesNotEndALeaseAlreadyPaidFor`, `test_nothingToCollectIsAnError`, `test_aLeaseBrokenOnDayOneStillRefundsAfterTheTermHasPassed`, `test_sameExpiryUserOverwriteStillRefundsAfterTheTermHasPassed`, `test_aHolderWhoNeverSettlesIsCreditedOnlyToTheLastLook`, `test_endLeasePaysTheHolderForExactlyTheTimeDelivered`, `test_settlingLateCreditsNoTimeBeyondTheBreak`, `test_theSellersTermsDoNotReArmForTheBuyer`, `test_anApproveeCannotNameALeaseAgent`, `test_obligationsCountsEveryLedger`, `testFuzz_theSplitNeverLosesOrCreatesEther`, `testFuzz_theHolderNeverVestsMoreThanTheTimeDelivered`. Also `verify-site.mjs` L2952–3120 ("driving the rental counter", "a lease agent that wants more than it was given" with `RogueAgent` trying transfer/approve/lock/setUser/re-target — all five fail), INVARIANTS 70–72, B6.

### 3.7 Measured
Bytecode **6,764 B (28%)** (README:1046). Live: Base Sepolia 0x749efb0458d66843c0e0673acd86847c9990570b; Eth Sepolia 0xa4cb5b8eb50e71e93475cba6f95c82033f861aab (block 11768841).

### 3.8 Weaknesses
Native-ETH rent only; one renter; the `seen` bias means a lazy holder forfeits (documented B6); `obligations()` is a helper, not an invariant; `rent` is DoS-able by `delist` front-running (harmless); `until` arithmetic uses `dayCount * 1 days` from `block.timestamp` (no renewal); no event on `seen` stamp.

### 3.9 Reuse verdict: **adapt**
Keep the escrow/vesting/observed-breakage model verbatim; the unified hub must expose `setUserVia`, `leaseAgentOf`, `rawUserOf`, `userExpires`, `locked`, and clear user+agent on transfer. Consider ERC-20 rent and a `renew` path only if a product need appears (the header argues against).

---

## 4. `src/Locker.sol` — time-locked ERC-20 vault (212 lines)

### 4.1 Purpose
"'The team's tokens are locked for two years' is the most broken promise in this industry, because it is usually kept by a multisig, a spreadsheet, or nothing. This contract keeps it the only way a contract can: the tokens sit here, the unlock time is written once, and there is no function that ends a lock early" (L7–12). "A rescue path is an unlock with a nicer name." (L19). Ten-year ceiling: "a lock with no end is a burn wearing a vault's clothing, and burning has an honest address already" (L23–24). Amount recorded is "the balance difference, not the request" (L28–29); rebasing tokens are not accounted for (L30–34).

### 4.2 Public API
- `uint64 public constant MAX_TERM = 3650 days;` (L38)
- `struct Lock { address token; uint64 until; bool taken; address owner; uint256 amount; }` (L40–46); `Lock[] private _locks;` `mapping(address => uint256[]) private _of;` `bool private _entered;` `mapping(address => uint256) public totalLocked;` (L48–53).
- `function lock(address token, uint256 amount, uint64 until) external nonReentrant returns (uint256 id)` (L83)
- `function claim(uint256 id) external nonReentrant` (L108) — owner only, after `until`, once.
- `function give(uint256 id, address to) external` (L126) — transfers the position; "most usefully into a token's own 6551 account, so a locked treasury travels with the NFT when the NFT is sold" (L123–125). `_of[to]` is push-only; stale entries are filtered by the page (L133–137).
- `function extend(uint256 id, uint64 until) external` (L142) — only longer, ≤ now+MAX_TERM.
- `function lockWithPermit(address token, uint256 amount, uint64 until, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external nonReentrant returns (uint256 id)` (L159) — permit failure is swallowed on purpose ("anyone can front-run a permit signature they saw in the mempool", L153–158).
- Views: `count()` (L171), `lockAt(uint256 id) returns (address token, address owner, uint256 amount, uint64 until, bool taken)` (L173), `locksOf(address who) returns (uint256[] memory)` (L183).
- Token I/O tolerant of non-returning / false-returning ERC-20s (`_pull`, `_push`, `_balance`, L193–211).

### 4.3 Events / errors / access
`Locked(id, token, owner, amount, until)`, `Claimed(id, token, amount)`, `Extended(id, until)`, `Given(id, from, to)` (L55–59). Errors `NothingArrived`, `NoTime`, `TooLong`, `NotYours`, `NotYet(uint64)`, `AlreadyClaimed`, `OnlyLonger`, `TransferFailed`, `NobodyThere`, `Reentrant` (L61–70). No owner, no admin, no fee; anyone may lock; only the lock's `owner` may claim/give/extend.

### 4.4 Tests and measured
- `test/Locker.t.sol` (1 test): `test_callbackCannotNestBalanceMeasurement` — an ERC-777-style callback token re-enters `lock` during `transferFrom`; the nested lock is refused with `Reentrant` and `totalLocked == balance`. Added by commit `dfad0c7` "Guard Locker token flows against reentrancy" (2026-09-14) which also added the `nonReentrant` modifier.
- `verify-site.mjs` "driving the vault" (L2504–2633): slider max 3650; approve-then-lock flow; `claim` early refused `0x1c9cc458` (NotYet), to stranger `0x4a636d30` (NotYours), `extend` nearer `0x227d0670` (OnlyLonger), past 10 y `0x4ee45b56` (TooLong), claimed twice `0x646cf558` (AlreadyClaimed); `give` to renter and claim by new owner; `lockWithPermit` with a dead permit proceeds on allowance and refuses `0x90b8ec18` (TransferFailed) without.
- INVARIANTS 101, 102, 104.
- Live: Base Sepolia 0x6c9fc4e5ec467fe47073067cdf126e2c35fe5702 (earlier 0x8886…2632, 0x5101…cbc3 per DEPLOYMENTS.md:194, 234); Eth Sepolia 0xeb509debf410003458fd9cec968708a8eaa1475b (block 11768846). Bytecode size not in README's table (unmeasured in docs).

### 4.5 Weaknesses
ERC-20 only (no ERC-721/1155 or native ETH locks); `_of` index grows and goes stale on `give`; `_balance` reverts `TransferFailed` for a token with no `balanceOf`; `claim` always pays the current `owner` (no `to`); no per-token enumeration beyond `totalLocked`; the `_locks` array is public-less (`lockAt` only).

### 4.6 Reuse verdict: **reuse-verbatim** (extend only if the unified launchpad needs NFT or ETH locks)
It is exactly the "team tokens locked" primitive the launchpad needs, with `give` into a Reach making locked treasuries travel with the NFT.

---

## 5. `src/Consign.sol` — consignment escrow (295 lines)

### 5.1 Purpose
"hand it to a dealer without handing over the sale" (L16). The token is custodied for a term; the agent may price at or above a floor and take a sale; reclaim after term is callable by anyone; early release needs the agent. Costs stated (L34–48): "While it is consigned, this contract owns the token … everything that asks the hub who owns it … will answer with this address instead of theirs." "What is given back is the instrument. The consignor is set as the token's ERC-4907 user for the term." "Money is credited, never pushed: a seller whose wallet reverts on receipt cannot wedge a sale for everybody else." (L55–56)

### 5.2 Public API
- `IHubConsign public immutable HUB;` constants `BPS = 10_000`, `MAX_CUT = 5_000` ("half; past that it is not an agent"), `MIN_TERM = 1 days`, `MAX_TERM = 730 days` (L59–64).
- `struct Note { address seller; address agent; uint96 floor; uint96 ask; uint64 until; uint16 cut; }` (L66–73); `mapping(uint256 => Note) internal _note;` `mapping(address => uint256) public owed;` `_bySeller`, `_byAgent` (L74–80).
- `function consign(uint256 id, address agent, uint96 floor, uint16 cut, uint64 until) external` (L131) — caller must be `ownerOf` **or the token's Reach** (`HUB.account(id)`); refuses zero floor (`NoFloor`), cut > 50% (`TooGreedy`), bolted tokens (`Bolted`); pulls with `transferFrom` (needs a standing approval which the hub clears on transfer) and then `HUB.setUser(id, o, until)`.
- `function ask(uint256 id, uint96 price) external` (L164) — agent only, ≥ floor.
- `function buy(uint256 id, uint96 agreed) external payable once` (L175) — `agreed` must equal current `ask` (`PriceMoved`); ERC-2981 royalty honoured out of the price first (zeroed if receiver is 0/this or ≥ price); agent cut from the rest; seller the remainder; all credited to `owed`; overpayment refunded.
- `function reclaim(uint256 id) external once` (L220) — anyone, after `until`.
- `function release(uint256 id) external once` (L232) — agent only, any time.
- `function withdraw() external once` (L243).
- Views: `noteOf(id) returns (seller, agent, floor, asking, until, cut, user)` (L254), `split(id) returns (price, toSeller, toAgent, royalty)` (L266), `consignedBy(who)`, `heldFor(agent)` (L280–286).
- Deliberately **no `onERC721Received`** (L288–294): "a token that arrived any other way would have no note, and a token with no note has no seller to send it home to."

### 5.3 Events / errors
`Consigned(id, seller, agent, floor, cut, until)`, `Asked(id, ask)`, `Sold(id, buyer, paid, toSeller, toAgent, royalty)`, `Reclaimed(id, to, early)`, `Withdrawn(who, amount)` (L82–88). Errors: `NotYours`, `NotTheAgent`, `NoNote`, `AlreadyHere`, `TooShort`, `TooLong`, `TooGreedy`, `NoFloor`, `BelowFloor`, `NotOffered`, `PriceMoved(uint256)`, `Underpaid(uint256)`, `TermRunning(uint64)`, `TermOver(uint64)`, `Bolted`, `NobodyThere`, `NothingOwed`, `PayFailed`, `Reentrancy` (L90–108).

### 5.4 Hub coupling
`ownerOf`, `account`, `transferFrom`, `setUser`, `userOf`, `locked`, `royaltyInfo` (L4–13).

### 5.5 Tests / measured
`tools/verify-estate.mjs` L326–469: no floor / cut > half / 10-minute term / soulbound refused; token in escrow but `userOf == seller` and seller can still `commit`; seller cannot `reclaim` mid-term; stranger cannot `ask`; agent cannot go below floor; `split` sums to price; underpay refused; **front-run** (agent raises ask under a pending buy) refused; overpayment returned; seller's lease gone with the sale; pull-payment `owed` and `withdraw` once; after term "a stranger can send it home, and home is the seller"; `release` only by agent; `safeTransferFrom` into escrow reverts. INVARIANTS 118–120. `verify-site.mjs` "driving the estate" L2059–2092 drives `consign` through `/estate` (two transactions in one press) and `release`. Commit `15844fe` cites "67 estate assertions pass". Live: Base Sepolia 0x3919fdc54879f99aa402ef7e629b88ea08abc51c; Eth Sepolia 0x7a6347ee6acaff6c1b516cbe23f2ff0518e04ee3 (block 11768863).

### 5.6 Weaknesses
Native-ETH prices only, `uint96` price ceiling; `_bySeller/_byAgent` push-only and stale; the consigned token's Reach cannot act for the term (owner is Consign) — and session keys on that Reach are retired by the transfer-count mark since `transferFrom` bumps `xfers`; no bidding; royalty recipient equal to the agent/seller is not special-cased (fine).

### 5.7 Reuse verdict: **adapt** (optional feature)
Clean, fee-less, and the "title moves, use stays" trick via ERC-4907 is unique. Port with ERC-20 pricing if the unified market is not ETH-denominated.

---

## 6. `src/Succession.sol` — dead-man's-switch inheritance (337 lines)

### 6.1 Purpose
"what happens to the token when nothing happens to it" (L16). "Name where the token should go and how long a silence should mean you are gone … the knock is public and it starts a second clock; touch the token during that clock and the knock is cancelled. Only if both silences run out does the token move." (L29–33). Honest limits (L47–59): cannot move a bolted token; does not survive a sale; "know that you died. It knows the token was not used"; cannot keep the successor secret.

### 6.2 Public API
- Constants: `MIN_QUIET = 30 days`, `MAX_QUIET = 3650 days`, `MIN_NOTICE = 7 days`, `MAX_NOTICE = 365 days` (L68–71).
- `struct Plan { address from; address to; uint64 quiet; uint64 notice; uint64 seen; uint64 called; uint256 toToken; }` (L73–81); `_plan`, `_named` (L82–86).
- `function arrange(uint256 id, address to, uint256 toToken, uint64 quiet, uint64 notice) external onlyOwner(id)` (L129) — `toToken != 0` makes the heir "whoever holds *this* token at the moment it is claimed" (L125–128); refuses self and the same token.
- `function revoke(uint256 id) external onlyOwner(id)` (L158); `function stillHere(uint256 id) external onlyOwner(id)` (L171) — resets `seen`, clears `called`.
- `function summon(uint256 id) external` (L232) — anyone; reverts `Moved` if the token left `from`; `AlreadyCalled` if a knock stands (commit `15844fe`, 2026-09-15: "Reject repeated knocks while a succession notice is active so an unrelated caller cannot continually defer a mature claim"); `StillSpeaking(until)` before `knockableAt`.
- `function claim(uint256 id) external` (L249) — anyone; `NotCalled`, `NotYet(when)`, `Moved`, `NobodyThere`, `SameHands`; `delete _plan[id]; HUB.transferFrom(from, to, id)`.
- Views: `lastSeen(id)` (L208), `knockableAt(id)` (L213), `opensAt(id)` (L220), `heirOf(id)` (L272; resolves `toToken` via `try HUB.ownerOf`), `planOf(id)` (L280), `namedTo(who)` (L292; push-only, stale), `wouldPass(id) returns (uint8)` (L312) with codes `OK=0, NO_PLAN=1, SOLD=2, NO_STANDING=3, BOLTED=4, NO_HEIR=5, BAD_HANDS=6, SPEAKING=7, WAITING=8, KNOCKABLE=9` (L299–308) — "Status codes rather than a bool, because 'this will not work' is useless to somebody who arranged their estate and would like to know which part of it to fix."
- `modifier onlyOwner(uint256 id)` (L114): owner **or the token's Reach**, never an approvee — "An arrangement an approved operator could rewrite is an arrangement a phished approval redirects — the thief would not steal the token, they would simply become the heir and wait."

### 6.3 The griefing bug, verbatim (L181–207)
"`embody` is open to the world … and it stamped the counter. So any stranger could reset the silence, for the price of gas … Measured before it was fixed: after the full quiet period the plan read KNOCKABLE, a passer-by called `embody`, and it read SPEAKING again. … every remaining stamp is reachable by an OPERATOR — an approved address, or a renter under a lease … So the only signal counted here is the owner's own, through `arrange` and `stillHere`." Commit `3d36eda` "A sign of life a stranger could forge" (2026-08-20) also removed the stamp from the hub's `embody` (Ipseity.sol:440–450).

### 6.4 Events / errors / hub coupling
`Arranged`, `Revoked`, `StillHere`, `Summoned(id, by, opensAt)`, `Passed(id, from, to)` (L88–93); errors `NotYours`, `NoPlan`, `NobodyThere`, `SameHands`, `TooShort`, `TooLong`, `StillSpeaking(uint64)`, `NotCalled`, `AlreadyCalled`, `NotYet(uint64)`, `Moved` (L95–105). Hub: `ownerOf`, `account`, `grip`, `detailOf` (for the bolt), `transferFrom`, `getApproved`, `isApprovedForAll` (L4–13). It needs a standing ERC-721 approval to this contract — "That is a narrower grant than an operator approval, and it is still a grant." (L45).

### 6.5 Tests / measured
`verify-estate.mjs` L90–325: approved operator cannot `arrange`/`revoke`/`stillHere`; 1-day and 20-year silences refused; self-naming refused; `summon` before silence refused; `claim` without knock refused; `wouldPass` 7 → 9 after quiet; hub `record` does not count; `stillHere` back to 7; second knock cannot restart (`opensAt` unchanged); claim during notice refused; owner's touch cancels the knock; `embody` by a stranger does not reset; token actually passes, pressed by a stranger; bolted token reports 4 and `claim` reverts; approval withdrawn ⇒ 3; sold ⇒ 2; `toToken` heir follows the named token. `verify-site.mjs` L1968–2057 drives `/estate`: "#2" in the heir box arrives as a token id; `wouldPass` 3 → approve button → 6 (heir token held by owner) → address heir → 7. Commit `3d36eda`: "Estate 56 -> 64"; `15844fe`: 67. INVARIANTS 115–117, 127, 150. Live: Base Sepolia 0x3635ac662a46c3ea786c471dd43f99bec7acff23; Eth Sepolia 0x96fa547a561b7645c34fff20c2bb8e4a32778d47 (block 11768862).

### 6.6 Weaknesses
Requires the holder to call `stillHere` once per quiet period (documented loss); `_named` is push-only; plan survives only while `ownerOf == from`; if the heir token is itself inside Consign at claim time the heir resolves to the Consign contract (BAD_HANDS does not cover that); needs a standing approval which a marketplace `setApprovalForAll` would not provide safely.

### 6.7 Reuse verdict: **adapt** (optional, distinctive)
Port with the two-clock design intact. If the unified hub keeps an operator-proof "owner signal", `lastSeen` could read it, but the file's own argument says not to.

---

## 7. `src/V4PositionPlanner.sol` — non-custodial Uniswap v4 calldata builder (233 lines)

### 7.1 Purpose
"Builds canonical Uniswap v4 PositionManager calldata without ever taking custody, receiving an approval, or executing it. The browser deliberately has no recursive ABI encoder. This contract is the narrow replacement" (L12–19). Added in commit `6b89a86` "Complete non-custodial Uniswap v4 launch liquidity" (2026-09-18) as step four of `/launch` (README:452–458).

### 7.2 Public API
- `interface ILaunchLedger { launchedBy(address coin) → uint256; launcher(address coin) → address; mayActAs(uint256 token, address who) → bool; }` (L7–11) — implemented by `Kiln`.
- `struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }` (L23); `struct MintRequest { PoolKey key; int24 tickLower; int24 tickUpper; uint160 sqrtPriceX96; uint128 amount0Max; uint128 amount1Max; address positionOwner; uint256 deadline; bytes hookData; }` (L31).
- Immutables `KILN`, `POSITION_MANAGER`, `PERMIT2` (L43–45); action bytes `INCREASE_LIQUIDITY=0x00, DECREASE_LIQUIDITY=0x01, MINT_POSITION=0x02, BURN_POSITION=0x03, SETTLE_PAIR=0x0d, TAKE_PAIR=0x11` (L47–52); `MODIFY = modifyLiquidities(bytes,uint256)` (L54).
- `function mintPlan(uint256 token, address coin, MintRequest calldata r) external view returns (uint256 liquidity, uint256 value, bytes memory data)` (L77) — requires `KILN.launchedBy(coin) == token`, `KILN.launcher(coin) == msg.sender` **and** `KILN.mayActAs(token, msg.sender)`.
- `increasePlan(PoolKey, positionId, liquidity, amount0Max, amount1Max, deadline, hookData) → (value, data)` (L105); `decreasePlan(PoolKey, positionId, liquidity, amount0Min, amount1Min, recipient, deadline, hookData) → data` (L126); `collectPlan(PoolKey, positionId, recipient, deadline, hookData) → data` (L147; decrease with zero liquidity); `burnPlan(PoolKey, positionId, amount0Min, amount1Min, recipient, deadline, hookData) → data` (L165).
- `function liquidityForAmounts(uint160 sqrtPriceX96, int24 tickLower, int24 tickUpper, uint128 amount0Max, uint128 amount1Max) public pure returns (uint256)` (L185) — uses `Tick.sqrtAt`, `Mul.mulDiv`.
- Errors: `NotLaunchOwner`, `WrongCoin`, `BadCurrencyOrder`, `BadRange`, `BadSpacing`, `BadPrice`, `ZeroLiquidity`, `ZeroAddress`, `DeadlinePassed` (L56–64). No state, no events.

### 7.3 Tests / measured
`test/V4PositionPlanner.t.sol` (6 tests): `test_mintPlanIsCanonicalAndOwnerControlsPositionAndFees` (decodes `actions == 0x020d` and both params), `test_onlyCurrentLaunchTokenAuthorityCanBuildAdvertisedMint`, `test_nativePairReturnsExactlyTheMaximumAsCallValue`, `test_decreaseChoosesWherePrincipalAndFeesGo` (`0x0111`), `test_collectPokesWithZeroLiquidityAndRoutesFees`, `test_invalidRangeAndExpiredPlanAreRefused`. Also referenced from `verify-launch.mjs`/`verify-site.mjs` (commit stat). Live on Eth Sepolia only: 0xd4ac9d6faee235f0ae2d2e5a66afffda6dcf8b8d (block 11768845); not in the Base Sepolia record. Deployed from `tools/site.mjs:509–512` with `(kiln, uniswap.v4Positions || 0, uniswap.permit2 || 0)`.

### 7.4 The unmerged branch (important)
`origin/codex/list-nft-functions-and-suggest-upgrades-hciyvv` carries two commits not on the default branch (`883df87` "Harden dynamic v4 launch liquidity controls", `9d63d9a` "Complete safe v4 position lifecycle") that rewrite this file: adds `STATE_VIEW` immutable and `livePrice(key, fallback) → (sqrtPriceX96, atBlock)` (reads `getSlot0(keccak256(abi.encode(key)))`); reads each position's `PoolKey` from `POSITION_MANAGER.getPoolAndPositionInfo(positionId)` so `increase/decrease/collect/burn` no longer take a caller-supplied key; and **relaxes `mintPlan` authority to `KILN.mayActAs(token, msg.sender)` only** with the comment "Authority follows the NFT (owner or Reach), not the address that happened to deploy the ERC-20. Otherwise transferring the NFT leaves the old holder unauthorized and the new holder blocked by the historical `launcher` record." That is a real defect in HEAD's version. No other area file differs on any remote branch (I diffed all 44).

### 7.5 Weaknesses
HEAD's `launcher == msg.sender` check breaks after the NFT is sold (fixed on the branch); the caller-supplied `PoolKey` for increase/decrease is not validated against the position (fixed on the branch); the action bytes are pinned to one PositionManager revision; liquidity math is only tested for `> 0`; no fuzz against a reference.

### 7.6 Reuse verdict: **adapt** (only if the unified launchpad targets Uniswap v4; take the branch version)

---

## 8. `src/interfaces/Standards.sol` (220 lines) and `AGENT.md` (328 lines)

### 8.1 Standards.sol
Hand-declared interfaces, "Every identifier below was recomputed from the function selectors rather than copied, and each is asserted against the published value in test/Standards.t.sol" (L7–9) — **note: `test/Standards.t.sol` does not exist**; the assertion actually lives in `test/Ipseity.t.sol::test_supportsInterface` (13 ids). Declares `IERC165`, `IERC721`, `IERC721Metadata`, `IERC721Enumerable`, `IERC721Receiver`, `IERC2981`, `IERC4906` (`0x49064906` fixed by fiat), `IERC4907`, `IERC5192`, `IERC6454`, `IERC7572`, `IERC721MultiMetadata` (ERC-7160), `IERC7496`, `IERC6551Registry`, `IERC173` ("the single most load-bearing omission a fully on-chain collection can make: marketplaces resolve collection-admin rights by staticcalling owner()", L135–137), and the **sealed kernel** `IDataVerifier` / `ISealedKernel` (L145–220).

The ERC-7857 stance, verbatim (L159–173): "1. That specification's normative entry points are iTransfer and iClone(..., TransferValidityProof[]). These are not those functions … 2. The specification defines no ERC-165 interface identifier … 3. Its premise is that the valuable metadata is encrypted and lives off chain behind an executor the specification declines to specify. That is the exact inverse of a work whose entire claim is that nothing is fetched. … A collection that shipped this as 'ERC-7857 compliant' would be making a false claim in an immutable contract." `IDataVerifier.verifyTransfer(tokenId, recipient, proof)` takes trusted context "otherwise a valid re-sealing proof can be replayed for another token or can be paired with a transfer to a different recipient" (L180–184; commit `c56e12a`, 2026-09-15). `ISealedKernel.kernelStatus` 0/1/2 and `kernelProved` are "deliberately separate" (L212–215).

Hub implementation (Ipseity.sol:761–933): `setVerifier` once from zero (`VerifierFixed`), `sealKernel` (holder/approvee; `proved=false`), `transferWithKernel` (plain transfer when no kernel; otherwise `_check` + re-seal + `proved=true`), `cloneWithKernel` payable at mint price (the free-clone hole, L807–820), `authorizeUsage` owner-only and epoch-stamped so grants die on sale (L865–880), `kernelStatus` derived from `sealedOwner == ownerOf`. Tested by `verify-kernel.mjs` (36 assertions; README:1305) and `Ipseity.t.sol` kernel tests (L432–522).

Verdict: **adapt**. Copy the interface file (it is the cheapest way to get thirteen standard ids right), fix the doc pointer to the real test, and keep the kernel naming honest.

### 8.2 AGENT.md
Three answers: ERC-7857 only for the agent's private strategy, never the artwork (§1–2); "Can Claude control some of our executions? Yes, and it already can: `grantSession` on the Reach" (§3); no live GUI — "Claude writes on-chain state that the GUI already draws" (§4). The wiring sketch (L190–215): an MCP signer service holding the session key; four tools `ipseity_read`, `ipseity_propose` ("Never sends"), `ipseity_act`, `ipseity_kernel`; "**`propose` and `act` are separate** … **`sessionAllows(key, to, selector)` is checked client-side before sending**". §4b describes `services.json` (`ipseity.services/1`, now `/2` per INTERFACE.md:77) with on-chain selectors so "An agent holding that selector needs an RPC endpoint and nothing else." §5 "What breaks": the seller does not forget; unproved kernel; "A session key is a hot key"; payload not stored. The service is deliberately not in the repo.

Verdict: **adopt the pattern** (propose/act split, view-precheck, services manifest) in the unified design docs; the prose itself is IPSEITY-specific.

---

## 9. How the web UI is delivered, and how ownership is verified (explicit answer)

**Delivery — entirely from chain, two surfaces, zero servers:**
1. `tokenURI(id)` → JSON whose `animation_url` is the entire WebGL2 instrument (`engine/ipseity.html`, stored as SSTORE2 shards in `Engine`, gzip loader in `Renderer`) as a nested `data:` URI; measured 103,808 B at 19.99 M gas (README:965). The instrument contains its own keccak, ABI coder and wallet client (README:21–22) and reads all state from `window.IPSE` written at render time.
2. `Premises.request(resource, params)` (ERC-5219, `resolveMode()` returns "5219") serves a multi-page HTML site over `web3://<premises>/…`: `Chrome` (stylesheet, nav, EIP-6963 wallet picker script `WALLET_JS`, Chrome.sol:276–320), `Desk` (the shared JS client `IP` with `call/tryCall/connect/send`, Desk.sol:295–349), and immutable `Page*` contracts, each of which emits a JSON config block whose selectors are keccak'd **on chain** (`_sel(...)`) so the browser ships no hashing. Routes in my area: `/token/<id>/vault` (PageServices.vault — the two hands; `give` sends plain value to the Grip with the warning "There is no way to undo it, including for you", L261–275; `verify` shows the Reach's EIP-712 domain, L313–343), `/token/<id>/rent` (PageServices.rent), `/seal` (PageSeal — soulbind + account seal + kernel), `/keys` (PageKeys — grant/revoke session keys, chips carry selectors), `/k/<id>/<key>` (PageKey — the session key's own door), `/estate` (PageEstate + DeskEstate — succession and consignment), `/lock` (PageLock — the Locker), `/c/<id>` (the console). An HTTP gateway (`tools/gateway.mjs`, w3link.io) is "a convenience for everyone else, and stays a convenience" (README:206). `/token/<id>/live` serves the same instrument as a first-class HTML response for 4.48 M gas because "A `data:` document gets an opaque origin and wallet extensions do not inject into one" (README:769–773).

**Ownership verification — in the browser it is a courtesy; on chain it is the law:**
- The pages connect via EIP-6963 (`IW.choose()` → `eth_requestAccounts`, Desk.sol:312–317) and check the wallet's `eth_chainId` against the page's chain before any call (Desk.sol:299–301). They then `eth_call ownerOf(id)` and compare lowercase to the connected account to toggle UI state: `body.held`/`.gate` (Chrome.sol:178–184: "The gate is a courtesy, not a secret: everything behind it is public data on a public chain. What ownership actually gates is writing, and that is gated by the contract."), `MINE` in PageSeal (L173 "The holder seals this"), `mine`/`ag` in DeskEstate (L126–128), the console crest "you" (console.js:196–200), the instrument's `needOwner()` which throws "Only the holder can change this token" (ipseity.html:2585–2589). PageKey additionally refuses a wallet that is not the key address (PageKey.sol:259–260) and tells a key holder to check `sessionAllows` before acting.
- **No SIWE, no signed challenge, no server session, no token-gated bytes.** Reading is never gated (INTERFACE.md:108). The enforcement is the contracts: hub `onlyOwner` (holder or the token's Reach), `onlyHolder` (holder or ERC-721 approvee), `onlyOperator` (adds the live ERC-4907 user) (Ipseity.sol:291–320); the Reach's `onlySigner` (`ownerOf == msg.sender`); strict-owner in Lease/Consign/Succession (owner, or owner-or-Reach). A wrong wallet simply gets a revert the page already predicted.
- The instrument's "connect" verb binds a wallet and *leaves* for the console on the site origin ("A connection is granted to an origin, not to a document", ipseity.html:3810–3812).

Implication for the GOAL: "mint a website → connect wallet → verify holder → use it" is already the shape here, with the verification being `ownerOf` + contract modifiers. The design team should keep that (it is the only verification that cannot be spoofed) and add nothing server-side.

---

## 10. Measured numbers (all cited)
- Bytecode: IpseityAccount 12,315 B (50%); GripVault 1,933 B (8%); Lease 6,764 B (28%) (README:1029–1050). Locker, Consign, Succession, V4PositionPlanner: not in the published table.
- Constants: MAX_SEAL 365 d; MAX_MANIFEST 16; MAX_PIECES 8; MAX_LIST 16; MAX_SESSION 365 d; MAX_BATCH 16; Lease MAX_DAYS 365, MAX_PER_DAY 1e30; Locker MAX_TERM 3650 d; Consign MAX_CUT 50%, term 1–730 d; Succession quiet 30–3650 d, notice 7–365 d; Timelock DELAY 7 d, GRACE 14 d.
- Selectors/ids: transfer 0xa9059cbb, transferFrom 0x23b872dd, approve 0x095ea7b3, increaseAllowance 0x39509351, setApprovalForAll 0xa22cb465, Permit2 approve 0x87517c45, ERC-1271 magic 0x1626ba7e, IERC6551Account 0x6faff5f1, IERC6551Executable 0x51945447; registry 0x000000006551c19487814612e58FE06813775758; footer offset 0x4d; GRIP_SALT keccak256("IPSEITY.GRIP.v1").
- Tests (counted by me): Lease.t.sol 26, Locker.t.sol 1, V4PositionPlanner.t.sol 6, Timelock.t.sol 9, Ipseity.t.sol 42; whole `test/` 149 `test*` functions. README states 158 (L1304) and 135 (L1313); INVARIANTS.md:1560 says 73; commit `c56e12a` says 140 — numbers drift (CLAUDE.md trap 8).
- Verifier assertions as published: verify-vault 97, verify-kernel 36, verify-timelock 24 (README:1305–1306); estate 67 (commit `15844fe`); site 395 (README) / 422 (DEPLOYMENTS.md:223) / 546 (commit `3d36eda`). Static call sites I counted: vault 116, estate 70, timelock 25, kernel 37.
- tokenURI 103,808 B / 19.99 M gas; `/token/1/live` 54,432 B / 4.48 M gas (README:965–973); Eth Sepolia campaign `tokenURISizeKiB: 104.6`, 21/21 deployment checks (deployments/eth-sepolia-campaign-2026-09-24.json).
- Live addresses — Ethereum Sepolia (11155111, deployed 2026-09-24, blocks 11768827–11768874): Ipseity 0x11e79cdf3e84a49d4fd2c12fb8a3be7936e5cb3b, Reach impl 0x640453e89c08bdc5d710962a466ccff8c423c698, Grip impl 0x6c647713cdb3ed6abfdfb5e7faa9341bb6b761a0, Lease 0xa4cb5b8eb50e71e93475cba6f95c82033f861aab, V4PositionPlanner 0xd4ac9d6faee235f0ae2d2e5a66afffda6dcf8b8d, Locker 0xeb509debf410003458fd9cec968708a8eaa1475b, Succession 0x96fa547a561b7645c34fff20c2bb8e4a32778d47, Consign 0x7a6347ee6acaff6c1b516cbe23f2ff0518e04ee3. Base Sepolia (84532): Ipseity 0x36c49f58c6437ee994766ce80f6654c4d797b8db, Reach 0x691e45d10b60ed96ebd5934a9f7979146dd77a85, Grip 0x2e554f5a6680f4a7d2a7b797c5473379faed3ed4, Lease 0x749efb0458d66843c0e0673acd86847c9990570b, Locker 0x6c9fc4e5ec467fe47073067cdf126e2c35fe5702, Succession 0x3635ac662a46c3ea786c471dd43f99bec7acff23, Consign 0x3919fdc54879f99aa402ef7e629b88ea08abc51c. (DEPLOYMENTS.md's "Live now" block names a different Eth Sepolia Ipseity, 0x6ff0…0ec2 — it lags the JSON, as CLAUDE.md trap 6 warns.)
- Deploy cost: Base Sepolia 68.41 M gas/~40 tx (2026-08-18), 136.06 M/~35 tx = 0.0214 ETH; Eth Sepolia 137.86 M = 0.2148 ETH (DEPLOYMENTS.md:56, 435–465, 513–524). Live exercise: 235 functions, 231 exercised, 159 assertions, 101 tx (DEPLOYMENTS.md:94–97).
- Git: all area files created in `f0f2835` "The portal: one door, any chain" (2026-08-20) except V4PositionPlanner (`6b89a86`, 2026-09-18); IpseityAccount 4 commits, Succession 5, Lease 2, Locker 2, Grip/Consign/AGENT.md 1.

---

## 11. Cross-cutting pitfalls for the merge
1. The Reach's storage and code are frozen per deployment (address derives from implementation) — any merge decision about session keys or seals must be final before mainnet.
2. The hub must keep: `statsOf` 4-word shape (or re-point `_mark`), `rawUserOf`/`userExpires`/`setUserVia`/`leaseAgentOf` (Lease), `account`/`grip`/`detailOf`/`royaltyInfo` (estate), transfer-time clearing of user, lease agent, approvals and `_ownerEpoch`.
3. Never let `embody`/`embodyGrip` or any operator-reachable path count as a sign of life for Succession.
4. Keep `isTransferable` refusing transfers to a token's own Reach/Grip.
5. Pages must keep comparing `sessionCurrent`, not only expiry (INVARIANTS 126).
6. `test/Standards.t.sol` is referenced but absent; the published test/assertion counts disagree with each other — re-measure before quoting.
7. The planner on HEAD has the `launcher == msg.sender` defect; the branch version is the one to carry.
8. Nothing here is audited; MAINNET_READINESS.md lists an audit of IpseityAccount and Lease as blocking.
