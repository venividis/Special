# IPSEITY (Most-Advanced-NFT-Possible) — the fully on-chain token, renderer and engine

Reader area: `src/Ipseity.sol`, `src/Engine.sol`, `src/Renderer.sol`, `src/Sigil.sol`, `src/lib/*`, `engine/ipseity.html`, `tools/build-engine.mjs`, plus the tooling and tests that pin them (`tools/verify.mjs`, `tools/gas.mjs`, `tools/selftest.mjs`, `tools/glsl-check.mjs`, `test/Ipseity.t.sol`).

Checkout: `/home/user/Most-Advanced-NFT-Possible`, HEAD `297e936` (2026-09-23, "Merge pull request #40 … run-complete-testnet-on-sepolia"), 103 commits on the default line running 2026-08-20 → 2026-09-23. 45 remote branches exist (mostly `codex/*` single-fix branches and dependabot); **`git log --all --not HEAD -- <my files>` is empty** — no branch carries changes to any file in this area that is not already on HEAD. The last commits that touched my files are `fe990f7` ("Make IPSEITY Ethereum-only", 2026-09-18 — removed six chains from the engine's `CHAINS` table), `cb0767c` ("Isolate nested token documents from wallet origin" — dropped `allow-same-origin` from the Nest iframe), `42dc541` ("Validate attestation digest before rendering"), `f89abc2` ("/connect lands in the console").

Everything below was read from source; numbers marked *(README, past run)* are quoted from the repository's own measured runs and should be re-measured before being cited again (the repo's own CLAUDE.md warns that its numbers drift, and they do — see §11).

---

## 1. The pipeline in one paragraph

`Ipseity.mint()` draws a 256-bit **section word** (six 16-bit plane angles, a 16-bit `w` offset, an 8-bit solid index, an 8-bit hue) from the block seed and stores it in one slot. `Ipseity.tokenURI(id)` builds a `TokenView` struct (owner, word, seed, both ERC-6551 addresses, both implementations, pool, counters, lock, kernel status) and hands it to `Renderer.facetURI(view, face)`. For face 0 the renderer concatenates `Engine.headBytes()` + a `<script>window.IPSE={…}</script>` state block + `Engine.bodyBytes()` where the Engine holds the HTML document as SSTORE2 shards (gzip by default), wraps the body in a small `DecompressionStream` loader, base64s the whole document into `animation_url`, base64s `Sigil.svg(...)` (a Solidity 4-D wireframe projector) into `image`, and base64s the JSON. The browser inflates the document, the document reads `window.IPSE`, draws the 4-D section with a WebGL2 raymarcher, discovers a wallet via EIP-6963, reads the contract by `eth_call` using its own keccak/ABI coder, and signs transactions back against the contract that emitted it — including `commit(id, word)`, which rewrites what the next `tokenURI` renders. The same document is also served unwrapped at `web3://<premises>/token/<id>/live` (ERC-5219) so a wallet extension can inject into it.

---

## 2. `src/Ipseity.sol` — the hub (1,145 lines, 53,384 bytes source; deployed 18,718 B = 76 % of EIP-170 *(README, past run)*)

### 2.1 Purpose
The ERC-721 itself: identity, the mutable section word, the operation counters, the two ERC-6551 hands, lending, soulbinding, the sealed kernel, royalties, curation, and 13 ERC-165 interface ids. It owns no rendering code — `IRenderer` (`src/Ipseity.sol:12-18`) is a four-function interface and the renderer pointer is settable until `sealRenderer()`.

### 2.2 Public API (full signatures, with line numbers)

Issuance
- `mint() external payable returns (uint256 id)` :352 — `msg.value >= price`, issues to `msg.sender`.
- `mintTo(address to) external payable returns (uint256 id)` :356.
- internal `_issue(address to)` :367 — `id = FIRST_ID + totalSupply`; seed = `keccak256(blockhash(n-1), prevrandao, timestamp, msg.sender, this, id)`; word packed from the seed (6 angles from bytes 0-11, `w` from bytes 12-13, `solid = seed[14] % 8`, `hue = seed[15]`); `Stats{open: BORN_OPEN, mintBlock, lastOp}`; emits `Transfer` and `Committed(id, word, 0)`.

The token acting on itself
- `commit(uint256 id, uint256 word) external onlyOperator(id)` :409 — `Section.valid(word)` or `BadSection`; increments `strata` (saturating uint32) and `ops`; emits `Committed`, `MetadataUpdate` (ERC-4906), `TraitUpdated("solid")`, `TraitUpdated("hue")`.
- `openNode(uint256 id, uint8 node) external payable onlyHolder(id) nonReentrant` :422 — `node < 12`, `msg.value >= openFee`, bit not already set; sets bit permanently; `NodeOpened`, `MetadataUpdate`.
- `embody(uint256 id) external returns (address)` :446 — `REGISTRY.createAccount(ACCOUNT_IMPL, REACH_SALT, chainid, this, id)`; **deliberately does not bump `ops`/`lastOp`** (see §2.7).
- `embodyGrip(uint256 id) external returns (address)` :480 — same with `GRIP_IMPL, GRIP_SALT`.
- `record(uint256 id) external` :454 — owner or the token's own Reach stamps `ops/lastOp`.
- `account(uint256 id) public view returns (address)` :468 — the Reach, via `REGISTRY.account(...)`.
- `grip(uint256 id) public view returns (address)` :473 — the Grip.

Reading
- `statsOf(uint256) → (ops, xfers, strata, open)` :488; `detailOf(uint256) → (lastOp, mintBlock, isLocked, kernelStatus)` :495; `viewOf(uint256) → TokenView` :505 (reverts `Nonexistent`).
- `sectionOf(uint256) → uint256`, `seedOf(uint256) → bytes32`, `parentOf(uint256) → uint256`, `leaseAgentOf(uint256) → address` (public mappings).

Metadata (ERC-721 / 7160 / 7572 / 7496)
- `tokenURI(uint256) → string` :520 — pinned face or face 0.
- `tokenURIs(uint256) → (uint256 index, string[] uris, bool pinned)` :528 — every face (expensive, see §10).
- `tokenURIAt(uint256 id, uint256 index) → string` :543 — one face; `BadIndex` past `facetCount()`.
- `pinTokenURI(uint256,uint256) onlyHolder` :548; `unpinTokenURI(uint256) onlyHolder` :555; `hasPinnedTokenURI(uint256) → bool` :561.
- `contractURI() → string` :565 → `renderer.collectionURI(this, totalSupply, MAX_SUPPLY)`.
- `getTraitValue(uint256, bytes32 key) → bytes32` :571 — keys `solid, hue, w, ops, strata, xfers, nodes (popcount), locked, kernel, section`; `getTraitValues` :588; `getTraitMetadataURI()` :595; `setTrait(uint256, bytes32 key, bytes32 value) onlyOperator` :602 — **only `"hue"`** is settable (`TraitNotSettable` otherwise), value ≤ 255.

Lending (ERC-4907 + lease agent)
- `setUser(uint256, address user, uint64 expires) onlyHolder` :616; `userOf` :673 (zero once expired); `userExpires` :678; `rawUserOf` :685 (stored user even after expiry — for rental escrows to authenticate their record).
- `setLeaseAgent(uint256 id, address agent)` :657 — **strict owner** (not approvee); `setUserVia(uint256,address,uint64)` :665 — only `leaseAgentOf[id]`; both cleared on transfer.

Binding (ERC-5192 / 6454)
- `lock(uint256) onlyOwner` :691; `unlock(uint256) onlyOwner` :697; `locked(uint256) → bool` :707; `isTransferable(uint256 id, address from, address to) → bool` :712 — false for `to==0` ("nothing is burned here"), true for mint, **false for `to == account(id) || to == grip(id)`** when the registry has code, else `!_locked[id]`.

Sealed kernel (ERC-7857 in spirit)
- `setVerifier(IDataVerifier v) onlyCurator` :761 — once, from zero, never again (`VerifierFixed`).
- `sealKernel(uint256 id, bytes32[] hashes, bytes32 to_) onlyHolder` :770 — records hashes, `sealedTo`, `sealedOwner = ownerOf`, `proved=false`, `version++`.
- `transferWithKernel(address to, uint256 id, bytes proof)` :787 — plain `transferFrom` if no kernel; else `_check` then re-seal + transfer atomically.
- `cloneWithKernel(address to, uint256 id, bytes proof) payable → uint256 child` :821 — strict owner, **costs `price`**, kernel must be active, child gets fresh seed/word, `parentOf[child]=id`.
- `_check(id, recipient, proof)` :844 — `verifier.verifyTransfer(id, recipient, proof)`; old hashes must equal stored hashes element-wise; new hashes non-empty.
- `authorizeUsage(uint256, address user)` :865 — strict owner; `usageAuthorised(uint256,address) → bool` :878 — true only while `_usageMark == _ownerEpoch` (epoch bumps on every transfer).
- `dataHashesOf` :882, `sealedTo` :886, `kernelStatus(uint256) → uint8` :915 (`0 absent · 1 current · 2 stale`, derived as `ownerOf == sealedOwner`), `kernelProved(uint256) → bool` :924, `hasVerifier() → bool` :931.

ERC-721 core: `ownerOf` :945, `balanceOf` :950 (reverts on zero address), `tokenByIndex` :955 (ids are contiguous so it is `FIRST_ID + i`), `tokenOfOwnerByIndex` :961, `approve` :966, `setApprovalForAll` :973, `transferFrom` :978, `safeTransferFrom` ×2 :1011/:1015, `royaltyInfo(uint256, uint256 salePrice)` :937 (`Mul.mulDiv(salePrice, royaltyBps, 10_000)` — full-width so `type(uint256).max` does not overflow).

Curation / ERC-173: `setPool(address)` :1048 and `setRenderer(IRenderer)` :1054 (both refuse after seal, both emit `BatchMetadataUpdate(FIRST_ID, lastIssued)`), `sealRenderer()` :1063 (one-way), `setPricing(uint256 price, uint256 openFee)` :1068, `setRoyalty(address, uint96 bps)` :1073 (**cap 1000 bps**, revert reuses `BadIndex`), `owner()` :1091, `transferOwnership(address)` :1095 (proposes), `acceptOwnership()` :1100, `renounceOwnership()` :1111, `withdraw(address to) nonReentrant` :1117, `supportsInterface(bytes4)` :1124, `receive()`.

### 2.3 Storage layout (declaration order, `src/Ipseity.sol:174-241`, plus :646 and :911-913)
```
sectionOf        mapping(uint256 => uint256)            :174   the section word
seedOf           mapping(uint256 => bytes32)            :175
_stats           mapping(uint256 => Stats)              :185   Stats{uint32 ops, uint32 strata, uint32 xfers, uint16 open, uint64 lastOp, uint64 mintBlock} — one slot
_users           mapping(uint256 => UserInfo)           :188   UserInfo{address user; uint64 expires} — one slot
_locked          mapping(uint256 => bool)               :190
_pinned          mapping(uint256 => uint256)            :191   1-based; 0 = unpinned
_kernel          mapping(uint256 => Kernel)             :207   Kernel{bytes32 sealedTo; uint64 version; bool active; address sealedOwner; bool proved} — two slots
_dataHashes      mapping(uint256 => bytes32[])          :208
_usageAuthorised mapping(uint256 => mapping(address=>bool))     :209
_usageMark       mapping(uint256 => mapping(address=>uint256))  :210
_ownerEpoch      mapping(uint256 => uint256)            :211   bumped on every transferFrom, never saturates
parentOf         mapping(uint256 => uint256) public     :213
verifier         IDataVerifier public                   :214
totalSupply      uint256 public                         :217
_ownerOf / _balanceOf / getApproved / isApprovedForAll  :218-221
_ownedTokens     mapping(address => mapping(uint256=>uint256)) :224   ERC-721Enumerable
_ownedIndex      mapping(uint256 => uint256)            :225
curator / pendingCurator                                :230-231
pool             address public                         :235
renderer         IRenderer public                       :236
rendererSealed   bool public                            :237
price            uint256 public = 0.01 ether            :238
openFee          uint256 public = 0.002 ether           :239
royaltyReceiver  address public                         :240
royaltyBps       uint96 public = 500                    :241
_lock            uint256 private = 1                    :322   reentrancy flag
leaseAgentOf     mapping(uint256 => address) public     :646
```
Immutables: `FIRST_ID`, `LAST_ID`, `MAX_SUPPLY`, `ACCOUNT_IMPL`, `GRIP_IMPL`. Constants: `COLLECTION = 4096`, `BORN_OPEN = 0x987`, `ALL_OPEN = 0xFFF`, `NODE_COUNT = 12`, `REGISTRY = 0x000000006551c19487814612e58FE06813775758`, `REACH_SALT = 0`, `GRIP_SALT = keccak256("IPSEITY.GRIP.v1")`, `ACCOUNT_SALT = REACH_SALT` (alias), `KERNEL_ABSENT/CURRENT/STALE = 0/1/2`.

### 2.4 Events and errors
Own events (:244-250, :648): `Committed(id, word, strata)`, `NodeOpened(id, node, open)`, `Operated(id, ops)`, `Embodied(id, account)`, `RendererChanged`, `RendererSealed`, `OwnershipTransferStarted`, `LeaseAgentSet`. Inherited: ERC-721 `Transfer/Approval/ApprovalForAll`; ERC-4906 `MetadataUpdate/BatchMetadataUpdate`; ERC-4907 `UpdateUser`; ERC-5192 `Locked/Unlocked`; ERC-7160 `TokenUriPinned/TokenUriUnpinned`; ERC-7496 `TraitUpdated` (+ range/list variants declared but unused); ERC-173 `OwnershipTransferred`; kernel `Sealed/Cloned/UsageAuthorised/VerifierUpdated`.

Errors (:110, :253-274, :649): `BadBand, NotCurator, NotHolder, NotOperator, Nonexistent, SoldOut, Underpaid, BadSection, BadNode, AlreadyOpen, IsLocked (declared, unused), NotTransferable, TraitNotSettable, NoRenderer, AlreadySealed, BadIndex, NoVerifier, ProofRejected, KernelInactive, VerifierFixed, ZeroAddress, NotReceiver, Reentrancy, NotLeaseAgent`. Custom errors only, terse nouns — no revert strings anywhere.

### 2.5 Access control — four doors of decreasing width
- `onlyCurator` :276 — `msg.sender == curator`.
- `onlyOwner(id)` :291 — the owner, **or the token's own Reach** (`account(id)`, only if the registry has code). Used by `lock/unlock`. The comment is the record of a real attack: *"an approval is precisely what a phished wallet has already given away, so a bolt an operator can lift is a bolt that stops nobody. Measured before this existed — an approved address could `unlock` and then take the token."*
- `onlyHolder(id)` :301 — owner, `isApprovedForAll`, or `getApproved`. Used by `openNode`, `pin/unpin`, `setUser`, `sealKernel`.
- `onlyOperator(id)` :312 — holder set plus the live ERC-4907 user. Used by `commit` and `setTrait`: *"An instrument that the borrower cannot operate has not really been lent."*
- Strict owner inline (no approvee): `setLeaseAgent`, `authorizeUsage`, `cloneWithKernel`, `record` (owner or Reach). Reasoning quoted at :651-656: an approval is revocable in one tx while a lease agent named under it is not — *"a permission outliving the permission that granted it"*.
- `nonReentrant` :323 on `_mintTo`, `openNode`, `withdraw`.

### 2.6 Invariants (from `INVARIANTS.md` and the code)
- #5 every token is born renderable (`testFuzz_mint_alwaysBornRenderable`); #6 only a renderable section can be committed; #7 the word round-trips.
- #10 `locked()` and `isTransferable()` never disagree — one flag; #11 a bound token does not move; #12 a lease never survives a sale (and nor does the lease agent, :994-1003); #13 renter operates the artwork, never the money.
- #46/47 kernel staleness is derived, never announced; CURRENT and PROVED are two separate questions; #55 a clone costs what it consumes.
- #108 the bolt answers to the holder alone; #109 a token cannot be given to its own hand; #128 no instrument that moves value is born open (`BORN_OPEN = 0x987`); #129 two chains cannot issue the same number (constructor refuses `firstId==0 || lastId<firstId || lastId>4096`).
- Usage grants die with the owner epoch (`test_kernelUsageGrantDoesNotOutliveApprovalOrSale`).
- Two-step ERC-173; royalty ≤ 10 % forever.

### 2.7 Design decisions worth quoting (load-bearing comments)
- The split-hand design (:147-162): *"REACH a working account. Trades, signs, claims, can be sealed for a time, and can be emptied by its holder whenever it is not. … GRIP receives and never spends. No execute, no withdraw, no rescue, no admin. What a buyer reads out of it is a floor rather than a snapshot, because the seller has no function with which to move it. … The point is not that the Grip is guarded better than the Reach; it is that the Grip has nothing to guard, because the capability to spend was never written."*
- Why `ACCOUNT_IMPL` is immutable (:138-145): *"a mutable implementation would mean a mutable vault address."*
- Why the token cannot be bridged (:86-98): the 6551 address derives from `block.chainid` and `address(this)`: *"A token that crossed would arrive with correct artwork and empty hands."*
- `BORN_OPEN` (:111-129) records the `0x587` bug: *"every token shipped with the money panel open and the holder was charged to unlock a picture. A suite assertion pinned 0x587 as though it were the design, which is how it survived."*
- `embody` does not bump (:437-445): *"A stamp anyone can set is not a record of what the token did; it is a record of what was done to it, and anything reading `lastOp` as a sign of life could be fed one by a stranger for the price of gas."*
- Lease agent (:619-644): *"Handing a rental contract the right to sell the token in order to let it lend the token is a capability an order of magnitude wider than the thing it authorises."*
- Kernel verifier (:752-760): *"A rotatable verifier is not a verifier. Whoever can swap it can install one that approves anything."*
- `cloneWithKernel` payable (:806-820): *"an adversarial review pulled eight free tokens out of a single mint and the loop had no natural end … a clone consumes a slot out of 4096 exactly as a mint does, and the supply is the scarcer promise."*
- Kernel status derived (:889-909): *"The only half of that comparison a seller controls is the one that has already moved."*
- Two-step ownership (:1078-1089): *"a mistyped address is accepted, emitted, and irreversible."*
- `_check` passes trusted context (:849-851): the verifier receives `tokenId` and `recipient` from the collection, not from proof bytes, so a proof cannot be replayed for another token/recipient (`test_kernelProofIsBoundToTokenAndRecipientContext`).

### 2.8 Standards implemented (all ids recomputed and asserted in `test_supportsInterface` and `tools/verify.mjs`)
ERC-165 `0x01ffc9a7`, ERC-721 `0x80ac58cd`, 721Metadata `0x5b5e139f`, 721Enumerable `0x780e9d63`, ERC-2981 `0x2a55205a`, ERC-4906 `0x49064906`, ERC-4907 `0xad092b5c`, ERC-5192 `0xb45a3c0e`, ERC-6454 `0x91a6262f`, ERC-7572 `0xe8a3d485`, ERC-7160 `0x06e1bc5b`, ERC-7496 `0xaf332f3e`, ERC-173 `0x7f5828d0`. ERC-6551 via the canonical registry (two accounts, two salts). The sealed kernel is explicitly **not** an ERC-7857 claim (`src/interfaces/Standards.sol:146-173` gives three reasons: different selectors, no ERC-165 id, premise is off-chain encrypted metadata). Considered and skipped (README): ERC-5484, ERC-721C, ERC-5643, ERC-5773, Operator Filter Registry.

### 2.9 Gas and size
Mint 0.19M, commit 0.05M *(README, past run; `tools/verify.mjs` prints both on every run)*. ERC-721Enumerable costs real gas per transfer — kept because supply is capped at 4096 and `Premises`/`Nameplate` read it. Deployed 18,718 B (76 % of 24,576). All curve/royalty rounding goes through `Mul.mulDiv`.

### 2.10 Tests
`test/Ipseity.t.sol` (611 lines; 37 `IpseityTest` functions + 5 `SigilTest`), run by `tools/forge.mjs` (the repo cannot install Foundry). Most telling names: `test_commit_rewritesWhatRenders`, `testFuzz_mint_alwaysBornRenderable`, `testFuzz_lockAndTransferableNeverDisagree`, `test_borrowerMayOperateButNotSell`, `test_leaseDoesNotSurviveTheSale`, `test_boundAccountIsDerivedNotAsked` (etches the reference registry at the canonical address and checks `account()` against `createAccount`), `test_sessionPermit2ApprovalChecksTheActualSpender`, `test_kernelTransferNeedsAProofAboutThisPayload`, `test_kernelProofIsBoundToTokenAndRecipientContext`, `test_kernelUsageGrantDoesNotOutliveApprovalOrSale`, `test_cloneRecordsItsParent` (also asserts the underpaid clone reverts), `test_ownershipTakesTwoSteps`, `test_royaltyDoesNotOverflowForMaximumSalePrice`, `test_royaltyHasACeiling`, `test_sealedRendererIsForever`. `tools/verify.mjs` (122 assertions packed / 121 raw *(README)*) re-runs the bolt attack ("the bolt survives a stolen approval"), the self-hand refusal, the band arithmetic (refuses `0..10`, `10..5`, `4000..4097`; deploys `1025..2048` and checks `tokenByIndex(0)==1025`), and every ERC id. `tools/verify-kernel.mjs` (36) covers staleness/proved/verifier-fixed.

### 2.11 Weaknesses / open points
- `verifier` is zero in every deployment: `kernelProved()` is false for every token, `transferWithKernel` on a live kernel reverts `NoVerifier`. The oracle is "deliberately not built" (AGENT.md §"What was deliberately not built").
- Sealing does not make the seller forget the payload (MAINNET_READINESS "non-blocking limitations"); an ordinary `transferFrom` leaves a STALE kernel, visible but not prevented.
- `IsLocked` error is declared and never used; `setRoyalty` reuses `BadIndex` for the cap.
- `openNode` is an irreversible per-token fee that goes to the curator's `withdraw` — fine for art, a product decision for a protocol.
- `Stats.ops/strata/xfers` saturate at `uint32` (display-sized); `_ownerEpoch` does not.
- The constructor still accepts arbitrary bands but `tools/site.mjs` `BANDS` and `Nameplate._bandFirst` are now Ethereum-only (`{1: 1..4096}`); `CLAUDE.md` still says "five chains" — doc drift.
- Curator is a single EOA in all records; MAINNET_READINESS wants a multisig+timelock (a `Timelock` contract exists in `src/lib/`).
- ERC-5192 and ERC-6454 both registered is acknowledged as a smell.

### 2.12 Reuse verdict: **adapt**
The ERC-721 + multi-standard + two-step-173 + two-salt-6551 + lease-agent + epoch-scoped-grants skeleton is exactly what the unified token needs, and it is 76 % of EIP-170 *before* adding anything. The 4-D section word, `openNode`, `Stats` and the kernel are art-specific or optional; replace the word with the unified project's own one-slot state and keep everything else. The pattern "hub holds state, satellites (Pool, Lease, Parley, Premises) hold behaviour, hub exposes `viewOf()`" is the only way four subsystems fit under EIP-170 and is what the GOAL should copy.

---

## 3. `src/Engine.sol` — the document as bytecode (125 lines; deployed 2,724 B)

### Purpose and API
Two runs of SSTORE2 shards with a gap between them. `headBytes()` is `<!DOCTYPE …</head>` (or, when compressed, a tiny plain prologue) and `bodyBytes()` is the rest (or the gzip of the whole document). The header comment (`src/Engine.sol:6-28`) is the spec: *"tokenURI() writes each token's live state into that gap, so the state arrives before the engine's first line runs and no contract ever has to search a string for a marker."*

- `constructor(bool compressed_)` :54 — curator = deployer.
- `loadHead(bytes chunk) onlyCurator` :61 / `loadBody(bytes chunk) onlyCurator` :68 — `SSTORE2.write`, push pointer, `Loaded(isHead, index, pointer, size)`.
- `setInflatedSize(uint32 n) onlyCurator` :77 — recorded so a client can verify what it inflated.
- `dropLast(bool isHead) onlyCurator` :83 — pop while loading.
- `freeze() onlyCurator` :90 — one-way; requires both runs non-empty; emits `Frozen(headBytes, bodyBytes)`.
- `setCurator(address) onlyCurator` :98.
- Views: `headBytes()`, `bodyBytes()` (concatenate via `bytes.concat`), `sizes()`, `shardCount()`, public `head[i]`, `body[i]`, `frozen`, `compressed`, `inflatedSize`, `curator`.

Storage: `curator` (address), `frozen`, `compressed` (bools), `address[] head`, `address[] body`, `uint32 inflatedSize`. Errors: `NotCurator, IsFrozen, NothingLoaded`.

Invariant #3: a frozen engine never changes (`test_engine_frozenIsForever`, `verify.mjs` "a frozen engine refuses more shards"). Gas: loading the packed document 8.86M vs 23.58M raw *(README)*; `tools/build-engine.mjs` estimates per-shard cost as `21000 + 32000 + calldata(16/4 per byte) + 200/byte + 6000`.

**Reuse verdict: reuse-verbatim.** It is a generic, 2.7 KB, freeze-once shard store with a state gap. The only GOAL-relevant extension is that the site's other assets (console JS/CSS) already use separate SSTORE2 stores loaded by `tools/site.mjs`, so this exact contract can hold the unified app's document.

---

## 4. `src/Renderer.sol` — everything a marketplace is handed (347 lines; deployed 20,747 B = 84 % of EIP-170)

### API
- `constructor(Engine, Sigil)` :62 — both immutable.
- `facetCount() → 3` :69.
- `facetURI(TokenView calldata v, uint256 index) → string` :73 — 1 = still, 2 = quartet, else instrument.
- `document(TokenView memory v) public view → bytes` :85 — **the whole page, byte for byte**; this is what `Premises /token/<id>/live` serves unwrapped.
- `collectionURI(address, uint256 supply, uint256 ceiling) → string` :280 — ERC-7572 JSON with the inline mark SVG; the description states the engine's byte count from `engine.sizes()`.
- `traitMetadataURI() → string` :321 — ERC-7496 trait schema (solid enum of eight, hue 0-255, w 0-65535, strata, ops, xfers, nodes 0-12, locked 0-1, kernel 0-1, section string).

### The state block (`_state` :99, `_who` :103, `_form` :118)
Exactly this object is written into the gap, and it is the contract between chain and engine:
```
window.IPSE={id, collection, chainId, owner, account, grip, reachImpl, gripImpl, pool, seed,
             word, rot:[6×uint16], w, form, hue, ops, strata, xfers, open, locked:0|1, block, depth:0, rpc:""}
```
`depth` is rewritten by the Nest instrument; `rpc` is an optional override the engine falls back to a public endpoint for.

### The compressed path and the loader (`INFLATE` :50-60)
When `engine.compressed()`, `document()` emits `head + <script>self.$IPSE=[<quoted state script>,"<base64 gzip>"];</script> + INFLATE`. The loader is an async IIFE that reads `self.$IPSE`, **deletes it**, inflates with `DecompressionStream("gzip")`, splices the state script before `</head>`, and `document.open()/write()/close()`. The comment records the bug that made every packed token black: *"document.open() clears the document but keeps the Window, and a lexical declaration made before the write is still there after it - so a `const D` here and a `const D` anywhere at the top level of the document being written are the same binding, and the write throws before a pixel is drawn. The engine is minified, and a minifier hands out short top-level names; the collision is not hypothetical."* `tools/verify.mjs` asserts the loader "declares nothing at all in global scope" (regex over everything outside the IIFE). `_quote` :146 escapes `"`, `\` and `<` (→ `\x3c`) so `</script>` inside the state string cannot end the outer script.

### The JSON (`_json` :197, `_attributes` :214)
`name: "IPSEITY #<id>[ - The sigil|The quartet]"`, a fixed `DESCRIPTION`, `animation_url` (face 0 only), `image` (sigil SVG for faces 0/1, quartet for 2), attributes: Solid, Notation, "Turned through w" (`_turnedThroughW` :249 buckets the sum of the three w-plane angles' distance from rest into barely/partly/far/nearly edge on), Hue, Section w, Strata, Operations, Transfers, Nodes open (max 12), Reach, Grip, Bound, Kernel (`none/current/stale` — *"'sealed' would have been a lie on a kernel the token has already outrun"*).

### Why three faces (`:12-27`)
*"Face 1 exists because face 0 is a quarter of a megabyte of base64 and some clients will not touch that. A token that becomes invisible when a client is cautious is not really on chain."*

### Gas and the eth_call ceiling (README "What a read costs", `tools/gas.mjs`)
```
tokenURI()          19.99M gas   103,808 B   the pinned face
tokenURIAt(id,0)    19.94M       103,808 B
tokenURIAt(id,1)     3.32M         8,096 B
tokenURIAt(id,2)    13.72M        17,056 B
tokenURIs()         37.06M       129,088 B   (was 55.19M — over geth's 50M default — before three fixes)
contractURI()        0.28M         2,720 B
viewOf()             0.01M           544 B
Premises /token/1/live  4.48M     54,432 B   same bytes over ERC-5219, no double base64
```
`tools/gas.mjs` measures each read against 10M/30M/50M/100M caps and fails `npm run check` above 50M. **EIP-7825 (Fusaka) caps a transaction at 16,777,216 gas; hardhat's Osaka node applied that to `eth_call` and `tokenURI()` failed with a bare revert while every Premises page answered** (README :1013-1025). The Premises `/live` route (4.48M) is the answer and already the recommendation.

### Tests
`tools/verify.mjs` ("the document that comes back is byte-for-byte the document that went in", "the engine itself did not change — only the state around it", "the loader hands the payload over on a property", "tokenURIAt serves one face without pulling all three", "labels are safe in both formats they are written into"), `tools/shots.mjs` (Chromium: a WebGL2 context on `#field` must exist and every `<img>` must `decode()`), `tools/gas.mjs`.

**Reuse verdict: adapt.** `document()`, `_state`, `_quote`, `INFLATE`, the compressed/raw dual path and the three-face/`tokenURIAt` pattern are the "NFT mints a website" mechanism and should be lifted whole. Replace the description, attributes, trait schema and the sigil-image faces with the unified project's. It is already at 84 % of EIP-170: any extra attributes or a richer state block will need a companion contract (the repo's `TERM.def(...)` / split pattern).

---

## 5. `src/Sigil.sol` — the whole solid, drawn by the chain (478 lines; deployed 14,477 B)

A fixed-point (`ONE = 1e9`) 4-D wireframe projector that emits SVG. `_rot` :51 precomputes six cos/sin pairs from the word; `_turn` :79 applies six Givens rotations in the order xy, xz, yz, xw, yw, zw with the four coordinates held in locals; `_flat` :107 projects R⁴→R³ by dividing through distance along w (eye at `w = 3`, clamped at `ONE/4` so nothing folds through the eye) then a fixed three-quarter view to the 1000×1000 canvas. Forms: `_tesseract` :134 (16 vertices, 32 edges), `_sixteenCell` :156 (8 vertices, 24 edges), `_twentyFourCell` :177 (24 vertices, edges at squared distance 2±tolerance), `_swept` :216 (duocylinder, Clifford torus, tiger, ditorus: `RINGS = 8`, `STEPS = 24`, the 25 inner cos/sin hoisted), `_julia` :261 (quaternion `z ← z² + c`, `c` from seed bytes 0-3, 9 orbits × ≤14 iterations, cut at escape `|z|² > 4`).

Public: `path(uint256 word, bytes32 seed) → bytes` :320, `pathAlong(word, seed, uint8 drop) → bytes` :325 (drop ∈ 0..3 swaps that axis with w before flattening — four elevations), `solidName(uint8)` :353, `solidNotation(uint8)` :357, `svg(id, word, seed, strata) → bytes` :363 (radial gradient tinted by hue, two rings, the w-plane as a dashed line, glow filter, name plate), `quartet(id, word, seed) → bytes` :409.

Load-bearing comments:
- `_turn` :66-78: the nested memory array literal `uint8[2][6] memory ij` *"was rebuilt on every call — … eight hundred for the quartet. Allocating and filling it cost more than the twelve multiplications it was there to index, and came to roughly half the gas of drawing the whole solid."* (−6.6M on `tokenURIs`). *"All 144 drawings the collection can produce were captured before and after and compared byte for byte."*
- `_swept` :224-227: hoisting the inner trig *"four hundred series evaluations to produce fifty distinct numbers. Hoisted, it is fifty."* (−4.8M).
- `SCHLAFLI` :341-347: *"'z<-z2+c' did: a bare `<` is not character data, so the eighth solid's image was not an SVG at all - every client that asked for the thumbnail got a parse error."* Now `unicode"z ← z² + c"`; `verify.mjs` scans all sixteen labels for `<&"\`.

Tests: `SigilTest::test_everySolidProjects`, `test_fourElevationsAllDiffer`, `testFuzz_svgIsWellFormed` (root must start `<svg x`), `test_trig`, `testFuzz_pythagorean`; `verify.mjs` checks every projected coordinate sits on a sane canvas and the quartet has exactly four `<path d="M`.

**Reuse verdict: drop** (as artwork) / **adapt** (as technique). The unified project will not be a 4-polytope viewer. What transfers: on-chain SVG as the cheap ERC-7160 face every cautious client can show; fixed-point trig in `lib/Trig.sol`; the rule that any label dropped into SVG/JSON is scanned by the suite; the lesson about memory array literals in hot loops.

---

## 6. `src/lib/*` — the hand-rolled standard library (no OpenZeppelin, no Uniswap imports, ever)

| File | Lines | What it is | Verdict |
|---|---|---|---|
| `SSTORE2.sol` | 73 | `write(bytes) → address` deploys `61 <len+1> 80 600c 6000 39 6000 f3 00 <data>` (PUSH2 len, DUP1, PUSH1 **12**, PUSH1 0, CODECOPY, PUSH1 0, RETURN, STOP, data); `read(address)` via `extcodecopy(ptr, out, 1, n)`; `size`. `MAX_SHARD = 24_575`. Errors `ShardTooLarge, ShardEmpty, DeployFailed`. The header (:21-27) records the real bug: *"The PUSH1 at offset 4 is the CODECOPY source offset, and it must be 12 … Get it wrong by two and every shard comes back with the tail of the init code glued to its front and two bytes missing from its end, which is exactly the kind of thing that reads fine and corrupts silently."* README adds the reference implementation it was copied from carries the same error. `test_sstore2_roundTripsExactly` asserts `ptr.code[0] == 0x00`. | **reuse-verbatim** |
| `Base64.sol` | 68 | One assembly loop, 3 bytes in / 4 out, one `mstore(out, shl(224, o))` per group instead of four `mstore8` (−6.6M on `tokenURIs`), `+32` slack allocation, tail padding by `mod 3`. Comment: *"This loop runs once per three bytes of a document measured in tens of kilobytes."* | **reuse-verbatim** |
| `Types.sol` | 87 | `library Section`: bit layout (angles 0-95, w 96-111, solid 112-119, hue 120-127), `angle/offsetW/form/hue/valid/pack`; `valid` = `form < 8 && word >> 128 == 0`. `struct TokenView` (18 fields incl. `reachImpl/gripImpl` *"so the instrument can re-derive both addresses by CREATE2 rather than take this contract's word for them"*, and `uint8 kernel` *"Not a bool, because 'there is a kernel' and 'it is sealed to whoever holds this token' are different facts"*). | **adapt** — keep the `TokenView` "gather once, renderer never calls back" pattern; replace `Section` with the unified state word |
| `Trig.sol` | 84 | `sin/cos` scaled 1e9, quadrant folding, Taylor to x¹³ (six terms). Comment: *"Four left sin(π/2) reading 1.000003543 — 3.5 ppm high … The test asserting 1e9 ± 200 had never been executed … sin²+cos²=1: at four terms it drifted by ~7 ppm, which is a rotation that quietly resizes the solid as it turns."* `fromU16(uint16)` → radians. Tests hold ±10 (×1e-9) and the Pythagorean identity ±100 over ±100 turns. | drop unless an art face is kept; otherwise reuse-verbatim |
| `Curve.sol` | 313 | The per-token AMM invariant `(x+vx)(y+vy)=k` with virtual reserves from the **section** (not a sum of angles — the 90-line header explains why the old rule *"was a control that lied"*: angles (π,π,0) rendered untouched while the market sat at two-thirds concentration). `cutDirection` closed form `u = (−s₃, −s₄c₃, −s₅c₄c₃, c₅c₄c₃)`; `concentration(word) → bps ≤ 80_000` from a measured `SLICE` table (8 solids × 16 cells) × `FALLOFF` (8 × 4 offsets), **deviation from rest, not size**; `anchor(word, rBase, rQuote)` — *"ANCHORING, not deriving … It used to be called on every quote, from the live reserves, and that was a critical bug … 400 units in came back as 718. The fuzz suite found it."*; `amountOut` rounds the pool's remaining balance **up**; `spot`, `invariant`. | **adapt** — the anchored-virtual-reserve mechanics and rounding rules are the swap; the SLICE/FALLOFF tables are art |
| `Tick.sol` | 165 | Uniswap v3 `TickMath.getSqrtRatioAtTick` reproduced (19 magic constants), rounding Q128.128→Q96 **up** so the pool's inverse lands on the same tick; `spacing(fee)`, `usable(tick, sp)` (round to nearest), `meanTick` with the toward-−∞ correction. Header: *"Approximate to choose, exact to display."* | **reuse-verbatim** |
| `Mul.sol` | 110 | Remco Bloemen `mulDiv` (512-bit product, Newton inverse) + `priceFromSqrt(sqrtPriceX96, unit, baseIsToken0)`. Explained line by line *"because assembly that is not explained is assembly nobody can check."* Tested in `test/Mul.t.sol`. | **reuse-verbatim** |
| `Timelock.sol` | 124 | 7-day `DELAY`, 14-day `GRACE`, `queue/execute/cancel/ready/opHash`, admin rotation only via its own queue (`setAdmin` requires `msg.sender == address(this)`), refuses re-queue. *"One admin, one delay, one public queue."* | **reuse-verbatim** (curator should sit behind it) |
| `Web.sol` | 231 | `esc` (HTML, whitelist printable ASCII, five entities), `jsonEsc` (also `</>/&`), `symbolOf/nameOf/decimalsOf` via `staticcall{gas: 50_000/30_000}`, bytes32-tolerant, `MAX_LABEL = 32`, and the offset check **before** the load: *"A token answering with an offset of 0xfffffffe is asking for a load four gigabytes past the buffer, and the EVM charges for memory quadratically … one hostile ERC-20 in one market took every page that listed it out of gas."* `amount()` with thousands separators. Header argues why: `/token/<id>/live` is same-origin with a live wallet client, so any injected script is an origin, not a cosmetic bug. | **reuse-verbatim** |
| `LibNum.sol` | 66 | `str`, `strInt`, `hexAddr`, `hex32`, `fixed1` — "nothing here is allowed to produce a malformed token". | **reuse-verbatim** |
| `Assets.sol` | 80 | Token list **derived** from the pool's open markets (`derive(pool, from, count)`), bounded, deduplicated — the on-chain replacement for tokenlists.org. | **reuse-verbatim** |
| `Hook.sol` | 174 | Uniswap v4 hook permission bits read from the address (`flags/has/inert/touchesSwaps/guardsExits/name/meaning/bit`), `DYNAMIC_FEE`, `OVERRIDE_FEE`, CREATE2 `at()`. *"A hook cannot claim not to intercept swaps while having the swap bit set, because the bit is what makes the interception happen."* | **reuse-verbatim** for the launchpad |

---

## 7. `engine/ipseity.html` — the artwork and the wallet client (4,035 lines, 200,014 bytes raw; `<script>` block 3,561 lines; `<style>` ~24 KB)

This single file is deployable source: no bundler, no imports, no fonts. Build measurement from the README's last run: 173,261 B as written → 113,379 B minified (65.4 %) → 39,501 B gzip (22.8 %), 3 shards. Today's raw file is 200,014 B and `gzip -9` of the *unminified* source is 60,966 B (my measurement; the minified-gzip figure will be smaller and must be re-measured with `node tools/build-engine.mjs`).

### 7.1 Structure (section headers with line numbers)
```
   1-495   <style> + DOM skeleton: #field canvas, #wires svg, #nodes, #plate, #rail (Token / Section / Chain / Connect / 2D / …),
           #tick, #dock (six plane chips + w slider), #coach, #nest (sandboxed iframe), #sheet, #confirm, #pal, #boot, #fatal
 499  0 · STATE          S = Object.assign(defaults, window.IPSE)  :504 ; DEPTH/ROOT :525 ; MODULES[12] :529 ; DOORED :564 ;
                          LANDING :578 ; leave :589 ; FORMS[8] :600 ; u16↔angle/w helpers ; L (live) and C (committed) views
 643  1 · ROTATION       rot4(angles) :  six Givens matrices, column-major, PLANE_IJ
 704  2 · THE FIELD      VS3 :712, HEAD3 :716, FS_FIELD :722 (raymarcher: 8 SDFs, instrument shell, 12 node spheres, shadow, AO,
                          dispersion, w-contours, strata bands, aura, ghost of the committed state, recursion tint), FS_ACC :1056,
                          FS_DOWN :1066, FS_UP :1085 (Kawase bloom), FS_POST :1102 (aberration, ACES, grain, dither)
1146  3 · THE ENGINE     TIERS :1156 (steps 64/96/140/190), HANDHELD/CALM ceilings, IDLE_HZ 10, CONVERGED 96, NEST_HZ 5,
                          initGL :1267 (context-loss handling, RGBA16F probe), allocate, resize
1395  4 · CAMERA         placeNodes (two counter-tilted shells), project/pick, frame :1470 (quality ladder, idle throttle)
1632  5 · OVERLAY        labels tethered to 3-D positions, isOpen(i) = (S.open >> i) & 1
1693  6 · INPUT          orbit, pinch, plane chips, w track, ticker say()
1859  7 · THE CHAIN      keccak-256 :1878/:1892, checksum :1929, ABI encoder :1974/:1986, decoders :2001/:2010, units,
                          CHAINS :2043, NET :2054, EIP-6963 :2077/:2086, SANDBOXED :2104, rpc :2110, connect :2139, requireChain :2172
2196  8 · SIGNING        REG_6551 :2203, propose :2226, fire :2279, watch :2304, EIP-712 :2323-2359, derive6551 :2366
2396  9 · THE CONTRACT   packSection/unpackSection :2409/:2417
2443 10 · THE SHEET      open(i) :2443, plate (sealed node), needWallet :2580, needOwner :2585, txCommit :2596, txOpen :2615
2626 11 · THE TWELVE     BUILD.SELF :2628, ROTATE :2668, SECTION :2707, SEND :2742, ERC20 :2784, CALL :2828, SIGN :2873,
                          SCAN :3006, VAULT :3046, MINT :3339
3380 12 · MARKET         POOL, readMarket :3387, BUILD.MARKET :3415 (open, quote, swap w/ minOut+deadline, bond, deposit, withdraw, syncCurve)
3672 12 · NEST           MAX_DEPTH 3, BUILD.NEST :3688
3738 13 · READING BACK   refresh :3738 (ownerOf / sectionOf / statsOf by eth_call), paintRail :3769
3782 14 · PALETTE        COMMANDS :3782 incl. "connect" (bind wallet then leave(LANDING()))
3973 15 · BOOT           keccak self-check, EIP-6963 discovery, eth_accounts silent reconnect, refresh()
```

### 7.2 How it reads `window.IPSE`
`const S = Object.assign({…defaults…}, window.IPSE || {})` :504-523. Defaults are a zero token on chain 1 with `open: 0xFFFF` so the file renders standalone. `S.rot` (six uint16) → `L.rot` radians; `S.w` → `[-1.6, 1.6]`; `S.hue` → CSS `--h` so the entire UI is tinted by chain state. `S.reachImpl/gripImpl/collection/chainId/id` feed CREATE2; `S.pool` enables the Market instrument; `S.open` gates which of the 12 nodes are "shut"; `S.depth` sets recursion tint and `ROOT`; `S.rpc` overrides the read endpoint.

### 7.3 The wallet client
- **Discovery** (:2077-2101): an `eip6963:announceProvider` listener installed first and kept forever, keyed by `rdns` (not uuid — *"uuid is regenerated per announcement and using it as the key duplicates wallets"*); `discover()` dispatches `eip6963:requestProvider` and falls back to `window.ethereum` (`providers[]` or single).
- **Sandbox detection** (:2104): `localStorage.getItem` throws in an opaque origin — *"the cheapest reliable way to tell that this document is running inside someone else's frame"*. In that case `connect()` reports "No wallet reaches inside a marketplace frame" and switches to read-only mode.
- **Transport** (:2110-2137): `rpc(method, params)` → `provider.request` if connected, else `fetch(S.rpc || CHAINS[chainId].rpc)` with `mode:"cors", credentials:"omit", cache:"no-store"` (comment: Origin is `null` in a data frame; wildcard CORS answers only without credentials). `CHAINS` now holds only `1` (Ethereum, `eth.llamarpc.com`) and `11155111` (Sepolia) after `fe990f7`.
- **connect(pick)** (:2139): `eth_requestAccounts`, `eth_chainId`, EIP-55 checksum of the account, `accountsChanged`/`chainChanged` listeners → `refresh()`. **requireChain()** (:2172) tries `wallet_switchEthereumChain`, then `wallet_addEthereumChain` on error 4902.
- **Boot** (:3973): checks `keccak256("") == 0xc5d2…a470` before offering to sign anything; silently reconnects if `eth_accounts` is non-empty; else read-only.

### 7.4 How it encodes calldata
- `keccak256(bytes)` :1892 — Keccak-f[1600] with 64-bit lanes as BigInt, rate 136, `0x01` padding (Ethereum, not SHA-3). `selector(sig) = khex(sig).slice(0,10)`.
- `encodeCall(sig, args)` :1986 — parses `name(type,…)`, canonicalises, checks arity, returns `{data: selector + encodeParams(types,args), sig, types}`. `encodeParams` :1974 does head/tail ABI with `encWord` (address, bool, (u)intN with two's complement, bytesN) and `encDyn` (string, bytes, `T[]` of static T). Structs are hand-encoded where needed (`executeBatch((address,uint256,bytes)[])` at :3346-3362).
- Decoders `decUint/decInt/decAddr/decBool/decString/decStringLoose` (bytes32 symbols accepted).
- EIP-712 (:2323-2361): `typeHash` (dependency sort), `encodeData`, `hashStruct`, `domainSeparator` (field presence driven), `digest712 = keccak(0x1901 ‖ ds ‖ hs)`. Verified by `tools/selftest.mjs` against the EIP's own `Mail` vector.
- ERC-6551 CREATE2 (:2366-2379): builds the ERC-1167 proxy initcode `3d60ad80600a3d3981f3363d3d373d3d3d363d73<impl>5af43d82803e903d91602b57fd5bf3` ‖ `abi.encode(salt, chainId, collection, id)`, hashes it, then `keccak(0xff ‖ registry ‖ salt ‖ hash)`; `GRIP_SALT = khex("IPSEITY.GRIP.v1")` computed by the page's own keccak. `agrees(derived, reported)` compares with the contract's `S.account/S.grip`.
- **propose(tx)** (:2226): renders the plain-English intent, `to`, value, function, selector, every 32-byte word with a decoded reading, the raw hex, a note, and runs `eth_estimateGas` — showing **"would revert"** in red when the chain refuses. **fire()** (:2279): `requireChain()`, `eth_sendTransaction` with 125 % of the estimate; **watch()** polls `eth_getTransactionReceipt` for 3 minutes and runs the module's `then` callback then `refresh()`.

### 7.5 Ownership gating inside the page
- `needWallet()` :2580 — connects or throws.
- `needOwner()` :2585 — `NET.account.toLowerCase() !== String(S.owner).toLowerCase()` → *"Only the holder can change this token. It is held by …"*. `S.owner` is injected by the renderer at `tokenURI` time and refreshed live by `refresh()` (:3738) via `ownerOf(id)` `eth_call`, so a sale is reflected without reloading.
- Which actions call it: `txCommit`, `txOpen`, Reach `execute/executeBatch/guard/unguard/grantSession/revokeSession`, SEND "from the token", Market `openMarket/bond/deposit/withdraw/syncCurve`, "Sign as the vault". Not gated client-side (because the contract allows anyone or the page cannot know): `mint`, `embody/embodyGrip`, swap, sending into the Grip, ERC-20 moves from one's own wallet, raw CALL ("Nothing here was checked for you — read the words").
- This is a UX guard only. **Real enforcement is the contract's modifiers** (§2.5) and the estimate step surfaces the revert before signing. There is no sign-in, no session cookie, no server: "verification" is the chain refusing a non-holder's transaction. Note that `needOwner` is stricter than the chain for `commit` (the chain also admits approvees and the ERC-4907 renter via `onlyOperator`) — a renter using this page gets a client-side refusal despite being allowed on chain.
- The SIGN panel's "Speak as the token" (:3005-3078) builds an `Attestation(string purpose, bytes32 payload)` digest under domain `IPSEITY_ATTESTATION/1/chainId/reach`, compares it to the Reach's `attestationDigest(string,bytes32)` (the `42dc541` fix validates the answer is a bytes32 before rendering), has the wallet sign it, wraps `(purpose, payload, sig)` and calls `isValidSignature(bytes32,bytes)` on the Reach — i.e. ERC-1271 proof that the signer controls the token, usable as a login primitive by any verifier.

### 7.6 The twelve instruments (`MODULES` :529-561; bits of `S.open`)
0 Self, 1 Rotate, 2 Section, 3 Send, 4 Assets (ERC-20), 5 Call, 6 Sign, 7 Scan, 8 Vault, 9 Issue (mint), 10 Market, 11 Nest. Born open = {0,1,2,7,8,11} = `0x987`. A shut node shows "the plate" (what it is, the irreversible cost, one button → `openNode`). The Vault panel is the fullest: derive both addresses, deploy either, read `sealedUntil()`, `manifest()`/`unmeasurable()`, `guard/unguard(address)`, `execute(address,uint256,bytes,uint8)`, `executeBatch`, send into the Grip (with a native `confirm()` warning *before* calldata is built), `grantSession(address,uint64,uint128,address[],bytes4[])` with the selector hashed in front of the user, `revokeSession(address)`.

### 7.7 Nest (`:3672-3734`)
Calls `tokenURI(id)` by `eth_call`, base64-decodes JSON then `animation_url`, rewrites `depth:N` → `depth:N+1`, sets `iframe.srcdoc`. The iframe is `sandbox="allow-scripts" referrerpolicy="no-referrer"` — `cb0767c` removed `allow-same-origin` so the nested document cannot reach the host's wallet; `tools/build-engine.mjs` refuses to build if that attribute pattern is missing. `MAX_DEPTH = 3` because *"Browsers keep somewhere between eight and sixteen live WebGL contexts per page and drop the oldest without raising anything."* The host drops to `NEST_HZ` and tier 0 while an inner section is open.

### 7.8 Leaving for the site (`DOORED` :564, `LANDING` :578, `leave` :589)
When `location.protocol` is `http(s):` or `web3:` the page knows it has an origin; `/connect` (palette) and the `2D` rail button bind a wallet then `top.location.href = "/c/<id>"` (the console). The long comment at :2467-2498 explains why an in-page "deck" of contract-rendered pages was removed: two documents, each raymarching, on one phone thread — *"It was becoming a browser with a picture in it."* The instrument now opens only its own controls; everything else is reached by leaving.

### 7.9 Rendering notes that matter for a product
Quality ladder with asymmetric climb/fall (:1507-1525), ceilings for handheld (`pointer:coarse` or width < 781) and reduced-motion, idle throttle to 10 Hz after 96 converged frames, pause on `visibilitychange`, WebGL context-loss recovery, RGBA16F probe with 8-bit fallback, Halton jitter accumulation, and the field is sized by `calc` not insets (comment: a canvas with left/right/`width:auto` resolves to its 2 px intrinsic width — *"the first build of this laid out an 1180x860 field as 2x2 and drew nothing"*).

### 7.10 Security fixes recorded in git for this file
`cb0767c` nest iframe sandbox (XSS via nested document reaching the wallet origin); `42dc541` attestation digest validated as `^0x[0-9a-fA-F]{64}$` before DOM; `rpc()` uses `credentials:"omit"`; all chain strings reach the DOM through `esc()` or `textContent`; `fe990f7` pruned the chain/RPC table to Ethereum + Sepolia.

**Reuse verdict: adapt.** Lift §7 (chain) and §8 (signing) verbatim as the unified app's zero-dependency wallet library (keccak, ABI, EIP-712, EIP-6963, propose/estimate/fire/watch, CREATE2-6551, sandbox detection). Lift the module/plate/sheet/palette scaffolding as the template for the four required instruments (swap, messaging, launchpad, vault) — the Market and Vault panels are already two of them. Drop or make optional the WebGL 4-D field (it is ~60 % of the bytes and the whole gas budget). Keep the Nest only if the GOAL wants it.

---

## 8. `tools/build-engine.mjs` (214 lines) and its guards

Modes: default **packed** (minify → gzip level 9 of the whole document → body shards; head is a 300-byte plain `PROLOGUE` so a reader whose inflation fails still sees a page), `--raw` (split at `</head>`), `--no-min`, `--chunk N` (default 20,000; refuses > 24,575). Minification: terser `ecma 2022, passes 2, unsafe_arrows, mangle toplevel, reserved: ["IPSE"]`; CSS stripped by regex; result re-parsed with `vm.Script`. Guards before building: refuses if `window.IPSE=` appears in the head (state must be injected by the contract), if the engine never reads `window.IPSE`, if the nest iframe lacks `sandbox="allow-scripts"`, and runs `glsl-check` on all six shaders (a `grad3` signature change once shipped a black screen past 174 assertions). After building: asserts `</head>` and `window.IPSE` survived, and that `gunzip(gzip(doc)) === doc`. Writes `dist/shards.json` (`{mode, minified, chunkBytes, sourceBytes, documentBytes, storedBytes, inflatedSize, head[], body[]}` with per-shard hex and gas estimate) and `dist/ipseity.min.html`. Trap noted in code: replacements use functions because the minified engine contains `"$1"` and a string replacement *"would expand that against this regex, splicing the original unminified script back in."* `dist/` is not present in this checkout (gitignored; a build is required before `verify.mjs`/`gas.mjs`).

`tools/selftest.mjs` lifts the chain half of the engine by marker (`/*── keccak-256` → `10 · THE SHEET`) and checks keccak, nine selectors, EIP-55, ABI encode/decode, `account6551`, the EIP-712 `Mail` vector (55 assertions *(README)*). `tools/glsl-check.mjs` slices `const VS3 = \`` → `const cvs = $("#field")` and parses each shader with `@shaderfrog/glsl-parser`.

**Reuse verdict: reuse-verbatim** (add the unified app's survive-by-name globals to `reserved`, keep every guard).

---

## 9. Explicit answers: web UI delivery and NFT-ownership verification

**How is the web UI delivered?** Entirely from chain, in three equivalent forms, no server, no IPFS:
1. `Ipseity.tokenURI(id)` → `data:application/json;base64,…` whose `animation_url` is `data:text/html;base64,…` = `Renderer.document(viewOf(id))` = Engine head shards + injected `window.IPSE` state + a loader + gzip body shards, inflated by the browser's `DecompressionStream`. ~104 KB response, ~20M gas to read. This is what marketplaces show; it runs in an **opaque-origin** frame, so wallets cannot inject — "it can be looked at and not used".
2. `Premises.request("/token/<id>/live")` (ERC-5219, `src/Premises.sol:509-528`) returns the identical `Renderer.document()` bytes as `text/html` on a real `web3://` origin (e.g. `web3://0x01de…b7b1:84532/token/2/live`, or via the w3link gateway). 4.48M gas, EIP-6963 discovery works, every instrument can sign. `/raw` returns the tokenURI, `/face/<n>` one face, `/sigil.svg` the image. These artwork routes are answered by Premises itself, never through a replaceable page contract.
3. From inside the page, Nest re-fetches `tokenURI` by `eth_call` and mounts it in a sandboxed iframe.
The flat site (`/`, `/c/<id>` console, swap, launch, chat…) is the other readers' area but is served the same way: Premises → immutable page contracts → HTML with JS held as Solidity string constants / SSTORE2 stores.

**How does it verify NFT ownership for access?** There is no access gate on *viewing* — the page renders for anyone, read-only through a public RPC when no wallet is present. Mutation is gated twice: client-side `needOwner()` compares the EIP-6963-connected, EIP-55-checksummed account to `S.owner` (injected at render, refreshed by `ownerOf` `eth_call`), and on chain every write is guarded by `onlyOwner/onlyHolder/onlyOperator` or a strict `msg.sender == _ownerOf[id]` check, with `eth_estimateGas` in the confirm slab surfacing "would revert" before the wallet is asked. Delegated authority is on chain too: ERC-721 approvals (holder-level), ERC-4907 user or `leaseAgentOf` (operate-the-artwork level), the Reach's bounded `grantSession` keys (act-as-the-token level), and `authorizeUsage` (kernel usage, epoch-scoped). The Reach's ERC-1271 `isValidSignature` over an `IPSEITY_ATTESTATION` typed digest is the available "prove you control this token" primitive for any third-party login.

---

## 10. Measured numbers (consolidated; source in brackets)
- Engine source: 200,014 B, 4,035 lines (wc, today); README "Layout" still says 137 KB; README numbers table: 173,261 → 113,379 min → 39,501 gzip, 3 shards *(past run)*. `gzip -9` of today's unminified source: 60,966 B (mine).
- Deployed bytecode *(README)*: Renderer 20,747 B (84 %), Ipseity 18,718 (76 %), Sigil 14,477 (59 %), IpseityAccount 12,315 (50 %), Engine 2,724 (11 %), GripVault 1,933 (8 %); Desk 23,284 (95 %).
- Gas *(README/verify/gas)*: deployment of 6 contracts 12.80M; document load 8.86M packed / 23.58M raw; total launch 21.65M; mint 0.19M; commit 0.05M; reads as in §4; `tokenURIs` 55.19M → 37.06M (−6.6M `_turn`, −4.8M swept hoist, −6.6M Base64).
- Caps: geth/erigon/reth `--rpc.gascap` 50M, nethermind 100M, EIP-7825 tx cap 16,777,216.
- Trig: sin error ≤ 3e-9 (six terms) vs 3.5 ppm (four); sin²+cos² drift 7 ppb vs ~7 ppm.
- Constants: `COLLECTION 4096`, `BORN_OPEN 0x987`, `NODE_COUNT 12`, `price 0.01 ETH`, `openFee 0.002 ETH`, `royaltyBps 500` (cap 1000), `MAX_SHARD 24,575`, `MAX_DEPTH 3`, `MAX_CONCENTRATION 80,000 bps`, `Timelock DELAY 7d / GRACE 14d`, `Web.MAX_LABEL 32`.
- Tests *(README)*: `forge.mjs` 158 Solidity tests (another paragraph says 135 — drift), `selftest` 55, `verify.mjs` 122/121, `verify-kernel` 36, `fuzz.mjs` 14 properties, 979 assertions total. `test/Ipseity.t.sol`: 42 test functions.
- Live addresses (authoritative JSONs): Base Sepolia (84532) `ipseity 0x36c49f58c6437ee994766ce80f6654c4d797b8db`, `engine 0x85f6fa0b9d50178e466ec708674542700d76b54c`, `renderer 0xc1a0d1c61df2f1e92d9fe7c57929d92e67a52252`, `sigil 0x909ebcfd9e1628e1b8cf67a6d8bdc776b6edc64f`, `reach impl 0x691e45d10b60ed96ebd5934a9f7979146dd77a85`, `grip impl 0x2e554f5a6680f4a7d2a7b797c5473379faed3ed4`; Ethereum Sepolia (11155111) `ipseity 0x11e79cdf3e84a49d4fd2c12fb8a3be7936e5cb3b`, `engine 0xfdbf4f93138a369cb869c413c4b9ca517a4c87b8`, `renderer 0x26403973402b85cd88d31a0833e3863466577746`, `sigil 0x424dde7d8c4a584de64969d3da7f8b31cb4e5334`. `DEPLOYMENTS.md` "Live now" lists different `Ipseity`/`Engine` addresses for both chains (e.g. Sepolia Ipseity `0x6ff03e23…`); per CLAUDE.md the JSON files are the truth and the prose lags. ERC-6551 registry `0x000000006551c19487814612e58FE06813775758`. The 2026-09-24 Sepolia exercise record drove mint/commit/record/setTrait/pin/unpin/openNode/lock/unlock/setUser/commit-as-user on token #12.
- Compiler: solc 0.8.36 (foundry.toml; tools/compile.mjs), optimizer 800 runs, **via_ir required** (*"The renderer builds a hundred kilobytes of string in one view call and the sigil turns sixteen four-vectors by six Givens rotations each. Both run out of stack slots without the IR pipeline."*), evm cancun.

---

## 11. Known weaknesses, TODOs and drift
1. `tokenURI()` cannot be served by any node that applies the EIP-7825 16.7M cap to `eth_call`; mitigation is Premises `/live`, but marketplaces call `tokenURI`.
2. Renderer at 84 % and Ipseity at 76 % of EIP-170 leave little room; the GOAL's extra state must go through satellites.
3. No kernel verifier exists; `kernelProved` is universally false; kernel is a stance, not a product feature.
4. Curator is an EOA; `Timelock.sol` exists but is not in front of the hub in any deployment record.
5. `needOwner()` is stricter than `onlyOperator` (renters/approvees are refused client-side for `commit`).
6. Docs drift: five chains vs Ethereum-only; 137 KB vs 200 KB; 158 vs 135 tests; DEPLOYMENTS.md vs JSON addresses; README still references a non-existent `Seal.s.sol`.
7. `dist/` is not committed, so every verification needs a build first; `forge` proper has never been run on this code (README: "forge test itself was not executed").
8. Marketplace frames cannot sign (by design) — the token's instruments only work on a `web3://` origin or gateway.
9. ERC-721Enumerable gas on transfer; two soulbound standards registered.
10. Browser WebGL context limits bound the Nest to depth 3; the raymarcher heats phones (mitigated by ceilings, not solved).

---

## 12. Reuse verdicts relative to the GOAL
| Component | Verdict | Why |
|---|---|---|
| `Ipseity.sol` | adapt | the multi-standard hub + two-salt 6551 + lease agent + epochs are the right skeleton; swap the section word for the unified state; move optional features (kernel, openNode) to satellites or drop |
| `Engine.sol` | reuse-verbatim | generic freeze-once SSTORE2 document store with a state gap |
| `Renderer.sol` | adapt | `document()/_state/_quote/INFLATE/facets/tokenURIAt` are the website mechanism; replace art JSON/faces |
| `Sigil.sol` | drop (keep technique) | art-specific; keep "cheap SVG face" and label-safety rule |
| `lib/SSTORE2, Base64, LibNum, Web, Mul, Tick, Timelock, Assets, Hook` | reuse-verbatim | dependency-free, bug-fixed, tested |
| `lib/Types.sol` | adapt | keep `TokenView` pattern, replace `Section` |
| `lib/Trig.sol` | drop unless an art face is kept | |
| `lib/Curve.sol` | adapt | anchored virtual reserves + rounding-to-pool are the swap's core; the SLICE/FALLOFF tables are art |
| `engine/ipseity.html` §7-8 (chain, signing) | reuse-verbatim | zero-dependency wallet client, self-verifying |
| `engine/ipseity.html` modules/sheet/plate/palette | adapt | template for swap/messaging/launchpad/vault instruments |
| `engine/ipseity.html` WebGL field | drop or optional | ~60 % of bytes; not required by the GOAL |
| `tools/build-engine.mjs` (+glsl-check, selftest, verify, gas) | reuse-verbatim | the guards each encode a shipped bug |

---

## 13. Unique ideas worth carrying into the unified protocol
1. State injected into a gap between head and body shards; the engine reads `window.IPSE` and never searches a string.
2. gzip shards inflated by `DecompressionStream`; the loader passes the payload on a property and declares no global.
3. Three ERC-7160 faces with a cheap SVG face, plus `tokenURIAt` so a client never has to pull everything.
4. Two ERC-6551 accounts at two salts: an acting Reach and a receive-only Grip whose guarantee is "the function was never written".
5. The instrument re-derives CREATE2 addresses and EIP-712 digests and compares them with the contract; it checks its own keccak at boot.
6. "Nothing is signed without showing the bytes": selector, words, decoded args, estimate, plain sentence.
7. Kernel staleness derived from `sealedOwner != ownerOf` with no hook; CURRENT vs PROVED kept apart.
8. Lease agent as a narrow power separate from ERC-721 approval; grants scoped to an owner epoch; strict-owner for anything that outlives an approval.
9. Born-open vs sealed instruments as a bitmask with a permanent, paid unlock.
10. Chain bands partition a global edition without a bridge; the 6551 address is the argument against bridging.
11. `gas.mjs` measures every read against real `eth_call` caps and fails the build; `/live` serves the same bytes for a fifth of the gas.
12. `Web.esc` whitelist + staticcall-tolerant ERC-20 reads with gas stipends and an offset check before any `mload`.
13. The site's token list is derived from the pool, not fetched.
14. Nest: the token opens itself inside itself, sandboxed, depth-limited by WebGL context counts.
15. Timelock with expiring queue and self-only admin rotation; two-step ERC-173.

## 14. Pitfalls the design team must not repeat
- `document.open()` keeps the Window: any global binding in a loader collides with a minified engine.
- SSTORE2 `CODECOPY` offset must equal the init prologue length (12); the reference implementation is wrong.
- A bare `<`/`&` in any label that lands in SVG, or `"`/`\` in JSON, breaks the thumbnail; scan every label.
- Assertions that restate a constant (`0x587`) cannot catch the constant being wrong; derive them from named lists.
- Nested memory array literals and un-hoisted trig in per-point loops cost millions of gas per read.
- Four `mstore8` per base64 group vs one `mstore`.
- Four Taylor terms is 3.5 ppm; a never-executed test asserted otherwise for months.
- Free clones = unlimited mint; `onlyHolder` on a soulbind bolt = a phished approval lifts it; a public `embody` that bumps `lastOp` = forgeable sign of life.
- A token transferred to its own 6551 account is frozen forever — refuse it in `isTransferable`.
- Nested iframes must not get `allow-same-origin`; attestation answers must be validated before rendering; opaque-origin fetches must omit credentials.
- Terser mangles toplevel: list survive-by-name globals in `reserved`; use function replacements because minified code contains `$1`.
- `tokenURIs()` must return every face and was silently over the 50M cap; measure reads, do not reason about them.
- EIP-7825 may make `tokenURI` unservable; design the website route (ERC-5219) as primary.
