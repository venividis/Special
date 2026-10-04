# Pixel-Garden — docs, boards and research: reader report

Repository: `venividis/Pixel-Garden`, checked out at `/home/user/Pixel-Garden` (branch `ccr-931fe287-ijyztq`, identical to `origin/main`; 60 commits, 2026-09-25 "Initialize Pixel Garden cartridge build" through 2026-09-29+ codex security PRs #3–#9). There are no other feature branches in this checkout; the only "branch" the docs mention is the historical `build/nft-cartridge-archives` draft PR #2, now merged as commit `7e35495`.

Area covered: `docs/**` (40 markdown files + `docs/evidence/`), `research/PixelGarden.extended.sol.txt`, `AGENTS.md`, `README.md`, `THIRD-PARTY-NOTICES.md`. Source files under `src/`, `sdk/`, `web/`, `tools/` and `test/` are cited by path where the docs name them but belong to other readers; where this report gives a function signature from a doc, the doc is the authority and the exact ABI must be confirmed in `src/`. The one piece of real Solidity in my area, `research/PixelGarden.extended.sol.txt`, is reported with exact signatures.

Everything in this repo is a **predeployment development build**. The docs repeat, in nearly every file, that there is no public deployment, no public mint, no real funds, no audit, no merged release, and no complete board. Treat every "verified" claim as "verified on a disposable local Hardhat chain or a disposable mainnet fork at block 26,059,508".

---

## 1. What Pixel Garden is, in one paragraph

Pixel Garden is an "NFT-owned application environment": one ERC-721 collection (`PixelGardenKernel`) where each token ("Garden") owns two canonical ERC-6551 accounts — **Reach** (working wallet, typed withdrawals, bounded application dispatch, sessions, seals) and **Grip** (receiving-only vault with *no* outbound path) — plus an owner-curated catalog of "cartridge" NFTs. Cartridges come in two kinds: **content cartridges** (browser programs stored in immutable on-chain archives, run in sandboxed iframes) and **runtime cartridges** (separately deployed immutable Solidity NFT contracts whose code hash is pinned in the kernel constructor and that Reach may call with bounded inputs). Ten runtime families exist: 1 Market (v3/v4 swaps + ETH/v4 launches), 2 Locks (fixed-beneficiary vesting + maturity sales), 3 Social (rooms, encrypted Whispers, EIP-712 identity), 4 Continuity (succession), 5 Estate (rental/consignment), 6 Presale, 7 Curve, 8 Liquidity (multi-asset v4 + v2 routes + fee sharing), 9 Launchpad (new ERC-20 + permissionless custom v4 hooks), 10 OTC (brokered bundle trades). The browser "host" is a single ≤196,608-byte HTML document frozen into an on-chain archive before the first mint and returned by `document(id)` / `tokenURI(id)`; richer workspaces are separately archived JS files whose SHA-256 is pinned into the host at build time. The product is organised around 20 reference design "boards" (plus an approved Board 21 for OTC), and the docs are a ledger of which board rows are implemented. Priorities stated by the user throughout: **swaps and launchpad first**, then everything else; new ERC-20 creation and permissionless custom hooks were made mandatory on 28 September 2026 (`docs/REQUIREMENTS.md:14-17`, `docs/LAUNCHPAD-CREATION.md:3`).

---

## 2. Architecture as documented (the map the design team needs)

### 2.1 Deployment inventory and order

From `docs/FINANCIAL-CARTRIDGES.md:7-9`, `docs/LOCKS-CARTRIDGE.md:97`, `README.md:96`:

1. `ArchiveFactory` (permissionless, no admin).
2. `ContentCartridge(factory)` — the content-NFT collection; its runtime hash is compiled into `src/generated/ContentRuntimeHash.sol` by a two-pass compiler so the kernel can check it without a supplied-hash override (`docs/SWAP-TO-LOCK.md:29`).
3. `PixelGardenKernel(maxSupply, contentCartridges, marketRuntimeHash, locksRuntimeHash, socialRuntimeHash, continuityRuntimeHash, estateRuntimeHash, presaleRuntimeHash)` — eight arguments; families 7 Curve, 8 Liquidity, 9 Launchpad, 10 OTC are pinned by compiler-generated constants in `src/generated/ExtensionRuntimeHashes.sol` rather than constructor args (`docs/FINANCE-EXTENSIONS.md:3`, `docs/OTC-CARTRIDGE.md:3`). Hashes must be nonzero and pairwise distinct (`docs/ESTATE.md:60`). The kernel constructor itself creates the `ReachAccount` and `GripAccount` implementations (`docs/ACCOUNT-FOUNDATION.md:9-11`).
4. Publish `dist/kernel-host.html` as a canonical **raw** archive and call `freezeHost` before any mint; only the kernel deployer may do this once; publication or the first mint closes setup permanently (`docs/KERNEL-HOST.md:90`).
5. Mint Gardens (free mint; both accounts created atomically through the canonical ERC-6551 registry).
6. Deploy runtime cartridges *after* the kernel: `MarketCartridge(kernel, markets, releaseId)`, `LocksCartridge(kernel, releaseId)`, etc. Each is itself an ERC-721 whose editions are bound to a content release; only the release publisher can deploy its runtime and mint editions (`docs/FINANCIAL-CARTRIDGES.md:9`).
7. Transfer an edition to Reach or Grip; Garden owner calls `acceptApplication` / `acceptCartridge`. "Receipt alone gives no authority."

The "decisive extensibility test" (`docs/MASTER-PLAN.md:325`): deploy Garden + accounts without launch rules, deploy a Launchpad NFT afterwards, have Reach execute a real pool launch on a fork, remove the cartridge, and still recover position claims — with Garden/Reach/Grip code hashes unchanged. This was passed at the financial checkpoint (`docs/BUILD-STATUS.md:383`).

### 2.2 Authority model (the invariants, as the docs state them)

Collected from `AGENTS.md:29-37`, `docs/REQUIREMENTS.md:13-19`, `docs/MASTER-PLAN.md §5`:

- Installation (holding/accepting a cartridge) **never** grants spending authority. "Never treat installation as a spending grant."
- Reach holds working assets; it exposes **typed** withdrawals (`withdrawETH/ERC20/ERC721/ERC1155(..., epoch)`), `executeCartridge(request, sessionRevision)` with at most two sorted input assets and two sorted output assets, ≤2,048 bytes action data (12,288 for Market/Presale/Curve/Liquidity carrying ≤8,192 hookData; 50,176 for Launchpad initcode), exact temporary allowances cleared afterwards, and independent pre/post balance reconciliation.
- Grip has "no withdrawal, rescue, approval, upgrade, destruction or execution entry point, and no valid spending signature" (`docs/ACCOUNT-FOUNDATION.md:53`). It is explicitly *not* advertised as a general ERC-6551 wallet (`:41`).
- A full-width, non-wrapping `custodyEpoch` (uint256, starts at 1) increments on every parent transfer including self-transfer; every session, intent, signature and grant binds to it; transfer-back never revives old authority.
- Custom-error only (`Unauthorized/Invalid/Stale/Locked/Insufficient/Unsupported/Settlement/Reentered/Incomplete/Bounds` in the research candidate).
- No upgradeable proxy, no mutable implementation resolver, no cartridge delegatecall into custody storage, no arbitrary-target executor. "The fixed account-to-implementation delegatecall is the only proxy/delegatecall exception" (`docs/REQUIREMENTS.md:28`).
- `isValidSignature` fails closed on both accounts; `isValidSigner` recognises the current owner on Reach only.
- Seals ratchet forward only; `sealAll` covers every outgoing Reach action including allocations; `sealTransfer` is a separate kernel-level ratchet on the parent NFT.
- Positions, escrow, claims and refunds survive software removal and Garden sale; "Disabling, removing or selling software cannot revoke existing beneficiary claims, refunds or position exits" (`docs/REQUIREMENTS.md:31`).
- Money moves by pull: fixed-recipient credits for broker fees, agent fees, residual inventory, rent and refunds.
- "Missing Solidity rules cannot be added later with browser code." (`AGENTS.md:40`) — this is the repo's single most repeated sentence and the reason it has ten runtime families instead of one upgradeable module.

### 2.3 Size regime

Compiler: solc 0.8.36, optimizer runs 1, viaIR, Cancun (`docs/ACCOUNT-FOUNDATION.md:16`). Gates: 24,576 runtime / 49,152 initcode, `allowUnlimitedContractSize=false` (`README.md:100`). Host raw-archive ceiling 196,608 bytes. The kernel has been within ~1 KB of EIP-170 since the Estate milestone (172 bytes headroom at `docs/BUILD-STATUS.md:291`), which forced two documented moves: UTF-8 name validation and JSON/URI metadata formatting into the already-pinned `ContentCartridge` (`docs/ESTATE.md`, `docs/SWAP-TO-LOCK.md:29`), and shared-helper refactoring of mint/account creation (`docs/BOARD-COMPLETION.md:26`). The host has been within 60–350 bytes of its ceiling for the last ~15 milestones; every new workspace therefore became a separately archived `trusted-*.js` with its SHA-256 pinned into the host (see §4).

---

## 3. Component dossiers

### 3.1 `research/PixelGarden.extended.sol.txt` — the legacy "extended candidate" (noncompiled research)

Path: `/home/user/Pixel-Garden/research/PixelGarden.extended.sol.txt` (305 lines). `README.md:94`: "noncompiled extended candidate retained for the bytecode discussion". `docs/RELEASE-SCOPE.md:103`: "The extended candidate was 27,302 runtime bytes. After removing autonomous sessions, general seals and unspecified mint fees and simplifying metadata/read code, the required treasury/cartridge/swap/launch/vesting core fits. The candidate remains in `research/PixelGarden.extended.sol.txt` as **noncompiled, unverified research**, not a second deployment."

**Purpose.** A single-contract ERC-721 where every token owns an isolated treasury inside the contract (no per-token account), executable cartridge bytes live in contract storage, and swaps/launch/vesting/sessions are built in. Header comment (lines 11–12): "/// @notice One collection, isolated garden treasuries and executable cartridge bytes. /// @dev Existing-token launchpad. No CREATE/CREATE2, proxy, delegatecall or generic executor."

**Imports.** Solady `ERC721` (vendored), OZ `IERC20`, Solady `SafeTransferLib`, vendored `Base64`, `LibString`, and `PoolKey,SwapParams,IV3Router,IWETH,IPermit2,IPoolManager,IPositionManager,IStateView` from `./interfaces/Markets.sol` (line 9).

**Errors (line 17–19).** `Unauthorized, Invalid, Stale, Locked, Insufficient, Unsupported, Settlement, Reentered, Incomplete, Bounds`.

**Storage (lines 21–77).**
- `struct Config { router, weth, permit2, poolManager, positionManager, stateView }`; `Config public markets`; `address immutable publisher`; `uint256 immutable maxSupply, mintPrice`; `totalSupply, hostRelease`; `bool hostFrozen`; `uint256 private entered = 1`; `bool private moving`; `bytes32 private unlockCommitment`.
- Per-garden: `custodyEpoch[id] (uint64)`, `revision[id] (uint64)`, `sealedUntil[id] (uint64)`, `gardenName[id]`, `treasury[id][asset]`, `assetList[id]`/`assetKnown` (max 64 assets).
- Global: `liability[asset]`, `credits[account][asset]`.
- Releases: `MAX_CHUNK=4096`, `MAX_PACKAGE=262144`, `MAX_STATE=4096`; `struct Release { author, packageKey, schema, expectedRoot, payloadHash, rollingRoot, byteLength(u32), written(u32), chunkCount(u16), uploaded(u16), profile(u8), finalized, manifest }`; `chunks[id][index]`; `struct Installation { releaseId, head, enabled }`; `installations[garden][packageKey]`; `packageList` (max 32).
- State: `struct StateRecord { garden, packageKey, schema, parent, epoch(u64), data }`; `states`, `stateHistory[garden][key]`.
- Finance: `struct Vesting { garden, asset, beneficiary, amount(u128), claimed(u128), start, cliff, end (u64) }`; `struct Position { garden, asset, unlockAt, poolId }`; `struct Seed { asset, fee, tickSpacing, tickLower, tickUpper, initialPrice, minPrice, maxPrice (u160), liquidity, ethMax, tokenMax (u128), unlockAt, deadline (u64), initialize }`; `struct Launch { asset, termsHash, positionId, createdAt }`; `struct Session { epoch, expires (u64), actions(u8), assetIn, assetOut, remaining(u128), minRate(u128) }`; `sessions[garden][key]`.

**Events (79–89).** `GardenMinted, TreasuryChanged, ReleaseBegun, ReleaseFinalized, Installed, StateWritten, Swapped, VestingCreated, LiquiditySeeded, LiquidityReturned, SessionSet`.

**Public API (exact).**
```solidity
constructor(Config memory config, uint256 supplyLimit, uint256 price)        // "Zero disables a protocol; nonzero entries must be deployed contracts." (94)
receive() external payable                                                    // only weth/router/poolManager/positionManager may send ETH
function mint(address to) external payable guard returns (uint256 id)         // requires hostFrozen; msg.value == mintPrice; credits publisher
function name()/symbol()                                                      // "Pixel Garden" / "GARDEN"
function setName(uint256 id, string calldata value) external holder(id)       // ≤96 bytes
function seal(uint256 id, uint64 until) external holder(id)                   // ratchet
function deposit(uint256 id, address asset, uint256 amount) external payable guard
function withdraw(uint256 id, address asset, uint256 amount, address to) external guard holder(id)
function claimCredit(address asset, address to) external guard
function assetsOf(uint256 id, uint256 cursor, uint256 limit) view returns (address[])
function beginRelease(bytes32 key, bytes32 schema, uint8 profile, uint32 length, uint16 count, bytes32 root, bytes32 payloadHash, bytes calldata manifest) external returns (uint256 id)
function appendChunk(uint256 id, uint16 index, bytes calldata data) external
function finalizeRelease(uint256 id) external
function chunkOf(uint256 id, uint256 index) view returns (bytes)
function freezeHost(uint256 id) external                                      // publisher only, once; profile 0, ≤98,304 bytes
function install(uint256 id, uint256 releaseId, uint256 head, uint64 expectedRevision) external holder(id)
function disable(uint256 id, bytes32 key) external holder(id)
function packagesOf(uint256 id, uint256 cursor, uint256 limit) view returns (bytes32[])
function writeState(uint256 id, bytes32 key, uint256 expectedHead, uint64 epoch, bytes calldata data) external returns (uint256 stateId)   // owner or session with action bit 1
function stateOf(uint256 stateId) view returns (StateRecord)
function historyOf(uint256 id, bytes32 key, uint256 cursor, uint256 limit) view returns (uint256[])
function grantSession(uint256 id, address key, Session calldata grant) external holder(id)
function createVesting(uint256 id, address asset, address beneficiary, uint128 amount, uint64 start, uint64 cliff, uint64 end) external guard holder(id) returns (uint256)
function claimable(uint256 vestingId) view returns (uint256)
function claimVesting(uint256 vestingId) external guard                       // permissionless; pays fixed beneficiary
function vestingsOf(uint256 id, uint256 cursor, uint256 limit) view returns (uint256[])
function swapV3(uint256 id, address assetIn, address assetOut, uint256 amount, uint256 minOut, uint64 deadline, uint64 epoch, bytes calldata path) external guard returns (uint256 received)
function swapV4(uint256 id, PoolKey calldata key, bool zeroForOne, uint128 amount, uint128 minOut, uint64 deadline, uint64 epoch) external guard returns (uint256 received)
function unlockCallback(bytes calldata data) external returns (bytes memory)  // msg.sender==poolManager && entered==2 && keccak(data)==unlockCommitment
function seedLaunch(uint256 id, Seed calldata s, bytes32 termsHash, uint64 epoch) external guard holder(id) returns (uint256 positionId)
function withdrawLiquidity(uint256 positionId, uint128 amount, uint128 minEth, uint128 minToken, uint64 deadline) external guard returns (uint256 ethAmount, uint256 tokenAmount)
function positionsOf(uint256 id, uint256 cursor, uint256 limit) view returns (uint256[])
function onERC721Received(address,address,uint256,bytes) external view returns (bytes4)  // only positionManager during guarded op
function hostBytes() public view returns (bytes)                              // mcopy-assembled from chunks
function document(uint256 id) public view returns (bytes)                     // '<script>window.PIXEL_CONTEXT={chainId,contract,tokenId}</script>' + hostBytes()
function tokenURI(uint256 id) public view override returns (string)           // data:application/json;base64 with svg image + animation_url data:text/html;base64
```

**Design decisions worth keeping (with the load-bearing lines).**
- Chunk upload with rolling commitment: `r.rollingRoot = keccak256(abi.encodePacked(r.rollingRoot, keccak256(data)))` (line 168), finalize requires `rollingRoot == expectedRoot` and exact `written == byteLength` (172). Comment line 159: "Releases contain executable bytes; finalization verifies the bounded rolling commitment." `docs/ARCHITECTURE.md:80`: "The client also verifies the full payload hash before execution; the contract does **not** recompute that second, full-payload hash during bounded finalization."
- v3 path validation in assembly: `path.length<43||>112||(len-20)%23!=0` and endpoint extraction with `shr(96, calldataload(...))` (220–223); exact `beforeIn - after == amount` check and `safeApproveWithRetry(router, 0)` cleanup (226–229). Line 216: "SwapRouter02 exact-input v3 route, maximum four hops. Native ETH is wrapped/unwrapped internally."
- v4 swap via `unlockCommitment = keccak256(data)` set before `IPoolManager.unlock(data)` and cleared inside the callback; the callback checks `entered==2` and the exact commitment (241–249). Line 236: "A typed no-hook v4 exact-input swap; no Universal Router command stream is accepted." Price limits hardcoded to `4295128740` / `1461446703485210103287273052203988822378723970341` (MIN/MAX sqrt price ± 1). Delta decoding: `int128 d0=int128(packed>>128); int128 d1=int128(packed)`.
- `_keyCheck`: sorted currencies, no self, `hooks==address(0)`, `tickSpacing>0`, `fee<=100000`.
- Seed via `modifyLiquidities(abi.encode(hex"020d14", params), deadline)` (MINT_POSITION, SETTLE_PAIR, SWEEP) with Permit2 approve/clear and `nextTokenId()` prediction (272–278), then `ownerOf==this && getPositionLiquidity==s.liquidity` assertion (279). Exit uses `hex"0111"` (DECREASE_LIQUIDITY, TAKE_PAIR).
- Session profile with `minRate`: `minOut < (amount*s.minRate + 1e18-1)/1e18` → unauthorized (203); `remaining -= amount`.
- `_beforeTokenTransfer`: `if(entered!=1 && !moving) revert Reentered(); ... ++custodyEpoch[id]; ++revision[id];` (111–118) — transfer during guarded financial op blocked; burn and self-custody blocked.
- Solvency: `if(_balance(asset)<liability[asset]) revert Settlement();` after withdraw (149); global `liability` per asset.

**Standards.** ERC-721 (Solady), ERC-20 via SafeTransferLib, Uniswap v3 SwapRouter02 `exactInput`, v4 PoolManager unlock/swap/sync/settle/take, v4 PositionManager/Permit2, `onERC721Received` selector `0x150b7a02`. Data-URI tokenURI with `animation_url`.

**Tests.** None for this file (it never compiled). The *legacy* `src/PixelGarden.sol` it was reduced to has 13 passing checks (`docs/BUILD-STATUS.md:401-405`) and a mainnet-fork run at block 26,058,607 (seed 732,734 gas; v4 swap 163,673; v3 swap 286,486; exit 176,250; runtime 24,331 bytes) in `docs/evidence/mainnet-fork.json`.

**Weaknesses.** 27,302 bytes (over EIP-170); shared contract-wide treasury (one bug drains all gardens); no per-token address; 256 KiB package / 4 KiB state limits; host ≤96 KiB; sessions are a flat `actions` bitmask; `termsHash` is "a commitment, not enforcement" (`docs/ARCHITECTURE.md:114`).

**Reuse verdict: drop as code, mine for patterns.** The two-account kernel replaced it. The rolling-root chunk commitment, the `unlockCommitment` callback pattern, the typed v3 path validator and the `minRate` session shape are all worth re-implementing in the merged protocol; the IPSEITY SSTORE2/OnchainApp archive is the better storage substrate (already adopted in Pixel Garden's `src/storage/`).

---

### 3.2 `PixelGardenKernel` (`src/PixelGardenKernel.sol`) — identity core

Documented in `docs/ACCOUNT-FOUNDATION.md`, `docs/ARCHIVE-CARTRIDGES.md`, `docs/FINANCIAL-CARTRIDGES.md`, `docs/STATE-AND-VERSIONS.md`, `docs/KERNEL-HOST.md`, `docs/MINT-TO-APP.md`, `docs/BOARD-COMPLETION.md`.

**Purpose.** ERC-721 collection; derives and creates both canonical accounts per token; custody epochs; owner-approved content/financial catalog; archive-backed state history; permanent position index; frozen host document; names/seeds/metadata; explicit transfer grants for Continuity/Estate.

**API as documented** (`docs/ACCOUNT-FOUNDATION.md:24-39`, `docs/ARCHIVE-CARTRIDGES.md:22-30`, `docs/STATE-AND-VERSIONS.md:64-70`, `docs/BOARD-COMPLETION.md:14`, `docs/MINT-TO-APP.md:15`, `docs/LOCKS-CARTRIDGE.md:97-101`):
- `mint(address to)`; `mintWithSeed(address,uint32)` (nonzero seed; ordinary mint defaults the seed to the Garden number); both create and verify Reach+Grip in the post-mint hook then call the recipient's ERC-721 callback.
- `account(id)`, `grip(id)` (predictions, valid before mint); `isCanonicalAccount(candidate,id,gripRole)`; `accountReady(id)`; `custodyEpoch(id)` (uint256, starts at 1).
- `acceptCartridge` / `acceptApplication`, `disableCartridge`, `cartridgeActive`, paged `cartridges`, `installation` detail; `selectedContent(garden, contentKey)` with a selection epoch.
- `saveState`, `stateCount`, `stateAt`; owner-only `migrateState` (atomic accept/select target + append migrated record; same-schema appends to the shared namespace).
- `applicationRuntimeHash()`, `locksRuntimeHash()`, `runtimeFamily(address)` → 0 or 1–10; `applicationAction(runtime, action)` policy table consulted by Reach.
- `authorizeContinuity`, `authorizeEstate` (owner-only kernel transfer grants with revision counters); `sealTransfer(until)` ratchet; authoritative rental pointer (runtime + deadline); `catalogRevision` counter.
- `freezeHost(archive)` once, deployer-only, pre-mint; `document(uint256)` and `document(uint256,string)` (same bytes; string overload supplies the ERC-6860 MIME hint); `tokenURI`.
- Display names ≤64 UTF-8 bytes, validated for malformed/overlong/surrogate/out-of-range sequences; stored in kernel but validated in ContentCartridge for size reasons.

**Storage/epochs.** Full-width custody epoch; activation epoch per acceptance pins release, holder, edition transfer epoch and custody epoch (`docs/ARCHIVE-CARTRIDGES.md:32`); content NFTs increment a transfer epoch even on self-transfer; selection epoch per `(collection,publisher,appKey)`; `StateRecord` records release ID and optional source namespace/revision (`docs/STATE-AND-VERSIONS.md:66`); immutable `visualSeed`.

**Access control.** Owner-only management; canonical Reach may call core invalidation before an ERC-721 leaves; a transition guard rejects nested parent transfers, minting and catalog mutation during receiver callbacks (`docs/ESTATE.md:60`); Gardens cannot be minted/transferred into their own Reach/Grip, the kernel, either implementation, or any deployed canonical account of the collection (`docs/ACCOUNT-FOUNDATION.md:55`).

**Invariants/tests.** `test/accounts.test.mjs` 13 scenarios (`docs/evidence/accounts-foundation.json` "checks": distinct accounts, Grip rejects all exit selectors, operators have no spending authority, transfer-back epochs, forged/wrong-salt/copied-runtime binding fails, precreated accounts gain no authority, mint callback cannot reenter, receiver rejection rolls back NFT+epoch+accounts, taxed transfers roll back, wrong registry bytecode blocks deployment). `test/cartridges.test.mjs`, `test/state.test.mjs`, `test/launcher.test.mjs` (receipt-derived mint IDs, paginated ownership, reorg rejection, starter opt-in idempotence).

**Measured.** Runtime/initcode progression: 15,884/37,499 (M1) → 18,024/39,668 → 20,044/41,822 → 23,213/45,161 → 24,404/47,124 (Estate, 172 bytes headroom) → 23,167/43,945 (after moving formatting to Content) → 23,525/44,433 → 23,722/44,855 → 23,798/44,931 → 23,891/45,535 → 23,740/45,391 → **23,785/45,494** (OTC, current). Kernel deployment incl. both implementations: 6,846,437 gas (M1) → 9,431,421 (current fixture). Mint with both accounts: 297,094 → 299,485 gas.

**Weaknesses.** ~790 bytes of EIP-170 headroom; every family admission is a new immutable kernel ("This changes the new development kernel's immutable admission set. It does not upgrade any already deployed immutable kernel." `docs/OTC-CARTRIDGE.md:48`); eight-argument constructor plus generated constants is awkward; metadata formatting was pushed into ContentCartridge as a size hack.

**Reuse verdict: adapt.** The two-account-per-token mint, non-wrapping custody epoch, activation/selection epochs, permanent position index and freeze-once host are exactly what the GOAL needs. Replace "ten pinned families" with a smaller fixed set (swap, launchpad, vault/locks, social), and consider ANIMA's immutable-diamond approach from the sibling repo for the 24 KB problem rather than the Pixel Garden "push helpers into another pinned contract" workaround.

---

### 3.3 `ReachAccount` / `GripAccount` / `AccountBinding` (`src/accounts/`)

**Reach API as documented** (`docs/ACCOUNT-FOUNDATION.md:32-39`, `docs/FINANCIAL-CARTRIDGES.md:26-56`, `docs/SWAP-TO-LOCK.md:7`): `token()`, `owner()` (zero for unready/forged/wrong-chain), `state()` (monotonic on success), `withdrawETH(recipient,amount,epoch)`, `withdrawERC20(asset,recipient,amount,epoch)`, `withdrawERC721(asset,recipient,tokenId,epoch)`, `withdrawERC1155(asset,recipient,tokenId,amount,epoch)`, `executeCartridge(ApplicationTypes.Call request, uint sessionRevision)`, `executeSwapToLock(swap, LockTarget target)` (owner-only; never session), session grant/revoke (one exact recipe hash, expiry, 1–1,024 uses, non-wrapping revision), `sealAsset(kind,asset,tokenId,until,epoch)`, `sealAll(until,epoch)`, `swapLockLink(locks, scheduleId)`, `isValidSigner`, `isValidSignature` (fails closed), ERC-165, receive + NFT receiver hooks. Invalidates kernel catalog before any ERC-721 leaves.

**Grip API.** `token()`, `owner()`, `state()` (always 0), receive/receiver hooks, `isValidSigner` always invalid, `isValidSignature` fails closed. Nothing else. 1,933 runtime bytes, unchanged across every milestone.

**AccountBinding.** Internal library computing CREATE2 addresses and exact runtime hashes for the ERC-6551 registry `0x000000006551c19487814612e58FE06813775758` (required runtime hash `0xda1d5b06e579f9e42e59b00fbc22939896ecb38dc8830d40de0a2508fecd6735`, derived from the EIP-6551 deployment data; local tests install those bytes at that address). Salts: `keccak256("pixel.garden.reach.v1")` and `keccak256("pixel.garden.grip.v1")`. "A reported `token()` or `owner()` is never sufficient." Each account forwarder is 173/183 bytes.

**Design argument (quote).** `docs/MASTER-PLAN.md:154`: "Do not copy IPSEITY's saturating transfer counter as an authority clock; use a non-wrapping epoch and fail closed at exhaustion. Carry the agreed epoch width through state records, signatures and bridge messages without unchecked narrowing casts." And `:164`: "The reference's manifest does not protect assets it never lists; do not advertise an all-assets seal by copying that mechanism unchanged."

**Gotcha recorded.** `docs/FINANCIAL-CARTRIDGES.md:35`: "Permit2 cleanup requires zero amount and no future expiry: its canonical implementation normalizes an input expiry of zero to the current block timestamp". The first fork run failed on exactly this (`docs/BUILD-STATUS.md:381`).

**Measured.** Reach 12,853/13,088 (M1) → 12,937/13,172 → 17,268/17,517 (swap-to-lock) → **17,714/17,970** (launchpad payload budgets). Grip 1,933/2,106.

**Reuse verdict: adapt (Reach), reuse-verbatim in spirit (Grip).** The Grip "vault by absence of code" is the cleanest answer to the GOAL's "vault" requirement; pair it with Reach's seals for a time-locked working vault. Reach's typed-only surface is the right posture for a holder-facing app but its two-asset/2 KB envelope will need widening for a merged launchpad.

---

### 3.4 Archive system: `ArchiveFactory`, `OnchainApp`, `OnchainAppDirectory`, `ArchiveTypes` (`src/storage/`) and `ContentCartridge` (`src/cartridges/ContentCartridge.sol`)

`docs/ARCHIVE-CARTRIDGES.md`, `docs/STATE-AND-VERSIONS.md`, `docs/PUBLICATION-RECOVERY.md`, `THIRD-PARTY-NOTICES.md:19`.

**Provenance.** `OnchainApp.sol` and `OnchainAppDirectory.sol` are derived from the MIT-labelled IPSEITY-FINAL files at commit `c22cd8cb…`; `ArchiveFactory` adapts IPSEITY's `ModuleArchiveFactory` "with canonical chunk creation/deduplication and aligned descriptor limits"; `sdk/archive/format.mjs` and `hash.mjs` adapt `packages/modules/core.mjs`/`hash.mjs`.

**API (documented table, `docs/ARCHIVE-CARTRIDGES.md:22-30`).** Factory: permissionless `createChunk`, `createArchive`, `createDirectory`, public descriptor validation, no admin. Content collection: `publish(appKey, stateSchema, content, manifest)`; publisher-only `mintEdition`; `openEditions(releaseId)` irreversible opt-in; `claimStarter(releaseId, recipient)`; `starterEdition(releaseId, recipient)` (`docs/MINT-TO-APP.md:57-60`). Readers: `chunkCount()`, `readChunk(i)`, `readAll()`, `contentSha256()`, `byteLength()` (from the IPSEITY declarations reproduced in `docs/MASTER-PLAN.md:4363-4440`).

**Limits (`docs/ARCHIVE-CARTRIDGES.md:38-46`).** Data payload 1–23,000 bytes (runtime = STOP + payload); leaf ≤32 chunks with full SHA-256 verified at creation; directory ≤16 leaves, 512 chunks, 11,776,000 stored bytes; expanded ≤16 MiB (SDK); manifest ≤16 KiB canonical / 32 KiB raw; catalog page 1–64; CLI 1,024 catalog entries, 4,096 records per namespace.

**Load-bearing caveat (quote, `:48`).** "Directory creation pins a complete digest but **does not compute the concatenated SHA-256 onchain**. Leaf digests cannot substitute for that calculation. Recovery checks every returned chunk… A false directory digest or expanded descriptor can be committed, but cannot pass verified recovery."

**Dependency closure (`docs/STATE-AND-VERSIONS.md:44-54`).** Dependencies are immutable ContentCartridge release IDs in the same collection; SDK bounds 64 releases, depth 16, 16 MiB per release, 64 MiB aggregate; browser 2 MiB/8 MiB; file bridge `files.list`/`files.read` requires root's `files.read` capability; dependency capabilities never merge into the root's.

**Measured.** ArchiveFactory 8,676/8,702; OnchainApp 917/1,944; OnchainAppDirectory 2,083/3,497; AppChunk nominal 16/338; ContentCartridge 5,630/14,506 → 8,133/17,009 → **8,898/17,774**. Gas: factory deploy 1,924,941; content collection 1,437,269 (2,144,146 in another fixture); compressed content+manifest+release publication 1,481,342; edition mint 145,795; acceptance 313,438; state record 330,368; multi-leaf scenario 736,037 raw bytes / 33 chunk refs / 2 unique chunks / 9,099,937 gas (reuse-heavy, "not a quote for 736 KB of unique code").

**Tests.** `test/cartridges.test.mjs` (compressed recovery, dedup, counterfeit readers, false descriptors, decompression limits, wrong publishers/schemas, Grip loading, withdrawal/return invalidation, independent export); `test/state.test.mjs` (graph budgets/cycles/DAG depth, forged/stale checkpoints, atomic selection); `npm run test:publications` (seven publication stages interrupted independently, exactly one minted edition).

**Reuse verdict: reuse-verbatim.** This is the already-ported, MIT-licensed IPSEITY storage layer with better limits and a factory; it is the natural substrate for "the NFT mints a website". Carry the publication journal rules (persist nonce/calldata before broadcast; never auto-resend unknown broadcasts; Web Locks per wallet/origin) into the merged app.

---

### 3.5 `MarketCartridge` — family 1 (`src/cartridges/MarketCartridge.sol`)

`docs/FINANCIAL-CARTRIDGES.md`, `docs/ECONOMY-WORKFLOWS.md`, `docs/LAUNCH-ANALYTICS.md`, `docs/LAUNCH-ACCOUNTING.md`, `docs/VESTING-SALES.md`, `docs/LAUNCHPAD-CREATION.md:17-25`, `docs/HOOK-INSPECTOR.md`.

**Purpose.** Ported from the legacy core into a separate ERC-721 runtime: typed v3/v4 swaps, existing-token ETH/v4 launches, locked LP custody, fee/principal settlement, `executeVestingSale` entry for Locks, presale/curve graduation entry under a domain-separated commitment.

**Actions (`docs/FINANCIAL-CARTRIDGES.md:39-44`).** 1 v3 swap (raw validated path 1–4 hops); 2 v4 swap (`(PoolKey,bool zeroForOne)` originally; now `(PoolKey, direction, hookData)` ≤8,192 bytes); 3 launch (`(Seed,Archive)` — existing ERC-20 + real ETH, price bounds, ticks/liquidity, LP lock, immutable terms archive); 4 settlement (`Exit(positionId,liquidity,minEth,minToken)`; permanent, needs no active edition). Constructor `MarketCartridge(kernel, markets, releaseId)`; no setters.

**Custom hooks (after 28 Sep).** Nonzero hook must have code and valid 14-bit flags; static fees in protocol range; dynamic fee exactly `0x800000` requires a nonzero hook; initialization has no hookData parameter in Uniswap's interface; swaps/exits accept reviewed hookData (`docs/LAUNCHPAD-CREATION.md:19-23`).

**Invariants.** Exact pre/post balance deltas; v4 partial fills return unused input in ordinary swaps but revert in maturity sales; preexisting runtime balances preserved ("It preserves preexisting runtime balances rather than treating unsolicited deposits as another Garden's funds"); Permit2 and router allowances start and end empty; positions keyed to Garden, exits only by the current owner via canonical Reach; existing positions cannot be acquired by transferring the cartridge.

**Measured.** 18,119/19,365 → 21,359/22,605 (maturity sales) → 23,690/24,936 (presale) → 24,089/25,336 → **24,340/25,587** (custom hooks; 236 bytes headroom). "Market's deterministic NFT metadata uses an unencoded JSON data URI to retain runtime headroom" (`docs/BUILD-STATUS.md:103`). Fork gas (block 26,059,508): launch 983,099; v4 swap 256,044; v3 swap 309,529; principal exit 258,209; swap-to-lock v3 777,185 / v4 676,056; maturity sale v3 428,658 / v4 383,991. Fixture v3 swap 310,025–313,351. Market deployment 4,207,940–5,499,663 gas. Archived cartridge bundle 78,815 bytes; trusted analytics/inspector/accounting workspace 125,250 bytes.

**Tests.** `test/financial-cartridges.test.mjs` 12 scenarios (checks list in `docs/evidence/financial-cartridges.json`: "EOAs, forged accounts, NFT operators and unrelated Gardens cannot invoke another Reach"; "protocol callbacks cannot transfer the parent or exceed the temporary allowance"); `test/financial-fork.mjs` 16→49 checks; `test/browser-financial-fork.mjs`; `test/launch-analytics.test.mjs`, `test/launch-accounting.test.mjs`, `test/hook-inspector.test.mjs` (every one of the 16,384 flag combinations); `test/browser-market-race.mjs`.

**Bug recorded (quote, `docs/LAUNCH-ACCOUNTING.md:76`).** "delayed identity/assets responses could replace the new Swap form and erase an entered amount. Market renders now carry a monotonically increasing generation, checked after each asynchronous read."

**Reuse verdict: adapt.** The swap component of the GOAL. Keep: typed v3 path validator, v4 unlock-commitment callback, exact-delta reconciliation, no router command streams, hook flag validation. Drop: the separate ERC-721-edition licensing around it (unnecessary when the protocol ships one swap module for every holder).

---

### 3.6 `LocksCartridge` — family 2 (`src/cartridges/LocksCartridge.sol`)

`docs/LOCKS-CARTRIDGE.md`, `docs/VESTING-SALES.md`, `docs/AUTOMATIC-SALE-DESIGN.md`, `docs/SWAP-TO-LOCK.md`, `docs/FINANCE-COMPLETION.md`.

**API.** Reach action 1 encodes `(address asset, address beneficiary, uint256 amount, uint64 start, uint64 cliff, uint64 end)`; returns schedule ID; kernel retains `(runtime, scheduleId)`. `claim(scheduleId)` permissionless, no recipient parameter. `beneficiaryCount`/`beneficiaryAt`. `authorizeSale`/`cancelSale` (beneficiary-only), `executeSale(scheduleId, expectedRevision)` (any gas payer at maturity), `saleSettlement`, `recoverSale` exposing `escrowLiability`, `escrowBalance`, `escrowSolvent`, `historyTotal`, `nextCursor`. `VestingSales.commitment` binds chain, kernel, Locks instance, schedule ID, revision, beneficiary, input asset, exact remaining amount and the complete recipe; `VestingSold` event carries both denominations.

**Vesting math (`docs/LOCKS-CARTRIDGE.md:109-113`).** `start <= cliff <= end`, `start < end`, `end > now`; vested = `floor(amount*(now-start)/(end-start))` after the cliff, capped at end; claimed totals update before transfer and roll back on failure; full-precision multiplication.

**Sale state machine (`docs/VESTING-SALES.md:62-69`).** 0 absent, 1 authorized, 2 cancelled, 3 pre-empted, 4 settled, 5 replaced. The documented, intentional race: "**A direct claim can pre-empt a sale**, including a mature sale… This is best-effort execution, not a guaranteed timed sale."

**Escrow boundary (quote, `docs/AUTOMATIC-SALE-DESIGN.md:35`).** "Matured escrow belongs to its fixed beneficiary, while Reach follows current Garden ownership. Do not withdraw the escrow to Reach and then execute an ordinary swap." Hence Market's separate `executeVestingSale` entrypoint and aggregate per-asset liability tracking ("an externally impaired token pool must not pay one schedule from another schedule's backing", `AGENTS.md:76`).

**Measured.** 7,431/8,215 → 13,903/14,687 → **14,275/15,060**. Archived Locks cartridge 34,968 bytes.

**Tests.** `test/locks.test.mjs` 11+1; `test/vesting-sales.test.mjs`; `test/swap-lock.test.mjs` (15 entries, taxed input/output, escrow-only tax, callback reentry); `test/maturity-keeper.test.mjs` + `test/keeper-integration.mjs` (3 CLI checks).

**Reuse verdict: adapt.** Fixed-beneficiary pull-claims and the solvency ledger are good vault primitives; the off-chain keeper (`tools/maturity-keeper.mjs`, `ops/maturity-keeper.service`) must be **dropped** for the GOAL (no server), keeping the permissionless `executeSale` so anyone can run it.

---

### 3.7 `SocialCartridge` — family 3 (`src/cartridges/SocialCartridge.sol`)

`docs/SOCIAL-IDENTITY.md`, `docs/BOARD-COMPLETION.md:12-13`, `docs/IDENTITY-RECOVERY-WORKSPACE.md`, `docs/BUILD-STATUS.md:11-15`.

**Purpose.** Nonfinancial runtime; "Every Reach action policy for Social is forbidden." Rooms (room 0 = public Commons, uncloseable), open/invited rooms with immutable posting policy, membership bound to founder+member custody epochs, posts ≤2,048 bytes stored *in full on chain* with author Garden, epoch, parent, timestamp; reactions keyed by Garden+epoch; moderator hide flag (not deletion); room titles 1–96 bytes with on-chain UTF-8 validation (the only post-merge Solidity change: codex PR #3 "Validate UTF-8 social room titles", `docs/BUILD-STATUS.md:11-15`); member galleries, bans, cooldowns, founder-only threads, reaction totals, ≤16 KiB canonical archive attachments.

**Keys and Whispers.** Owner-only key announcement with compare-and-swap version, 65-byte uncompressed P-256 key format checked on chain, bound to custody epoch; empty announcement revokes. Envelopes: ephemeral P-256 ECDH + HKDF-SHA-256 + AES-256-GCM, independent recipient and sender copies, associated data binds protocol version/chain/kernel/instance/both Garden IDs/both epochs/key versions; cleartext ≤1,024 UTF-8 bytes, envelope ≤4,096 bytes on chain; duplicate envelopes rejected; sender blocks scoped to recipient epoch. Optional interactive X25519 Double Ratchet with read-once display (`docs/BOARD-COMPLETION.md:13`; "not Signal interoperability, X3DH or post-quantum"). Keyring backups: PBKDF2-SHA-256 310,000 iterations, 32-byte salt, AES-256-GCM, 12–1,024-char password, 1–128 historical keys.

**Identity.** EIP-712 attestations (fixed nonfinancial domain, kernel/Garden/epoch, purpose, verifier challenge, 15-minute UI expiry; EOA and ERC-1271 owners); owner-only irreversible retirement of an exact digest, usable after software removal.

**Honest limits (quote, `docs/SOCIAL-IDENTITY.md:27`).** "Ciphertext, participants and timing are public. This design does not provide forward secrecy if a historical recipient key is later compromised."

**Trusted workspace rationale (quote, `:37`).** "Adding social UI and crypto to the monolithic host exceeded the unchanged 196,608-byte archive ceiling. The Social package now carries `trusted-social.js` alongside its HTML entrypoint. The build pins this exact script's SHA-256 and byte count inside the immutable main host."

**Measured.** 12,077/13,341 → 12,867/14,131 → 15,853/17,118 → **16,297/17,562**. Recovery defaults 128 rooms, 2,048 posts, 2,048 messages, 128 keys, 2,048 retired digests.

**Tests.** `test/social.test.mjs` (owner/operator separation, stale epochs, no financial policy, ciphertext tampering, wrong keys, signature expiry/domain/custody binding, duplicate sends, substituted trusted-module bytes); `test/whisper-ratchet.test.mjs`; `test/browser-social.mjs` (10 groups).

**Reuse verdict: adapt.** This is the GOAL's "messaging/crypto social layer". Decision for the design team: Pixel Garden stores posts in storage (expensive, but readable with plain `eth_call` paging) whereas IPSEITY's Parley stores messages as back-linked logs (cheap, indexer-free via single-block `eth_getLogs`). The encryption envelope, epoch-bound keys and EIP-712 identity design are reusable either way.

---

### 3.8 `ContinuityCartridge` — family 4 (`src/cartridges/ContinuityCartridge.sol`)

`docs/CONTINUITY.md`. Owner-only kernel grant `authorizeContinuity` + runtime `arrange` (fixed wallet **or** current holder of another Garden), `checkIn` (only explicit check-in resets the quiet period), heir `startNotice`/`claim`, `revoke`; quiet 30–3,650 days, notice 7–365 days; seven states (0 absent … 6 notice elapsed but transfer seal remains); claim disables the plan before the kernel safe transfer, receiver rejection rolls both back; `sealTransfer` ratchet blocks owner, operator and succession transfers. 8,420/9,204 → **8,796/9,581**. Tests: `test/continuity.test.mjs`, `test/browser-continuity.mjs` (7 groups). **Verdict: drop or defer** — not in the GOAL's four pillars; if kept, it is a small, self-contained pattern and the transfer-seal ratchet belongs with the vault.

### 3.9 `EstateCartridge` — family 5 (`src/cartridges/EstateCartridge.sol`)

`docs/ESTATE.md`, `docs/ESTATE-DESIGN.md`. Paid visual rentals (`ceil(dailyPrice×seconds/86400)`, 60 s–365 d, earned `floor(paid×elapsed/duration)`, early termination credits unearned rent to the renter, six-bit visual mask over the renderer's shape/palette/rotation/speed/section/interior) and inventory-bound sales (kernel `authorizeEstate` grant; listing binds seller, payment, expiry, agent + exact fee, grant revision, custody epoch and an inventory digest covering catalog revision, Reach action state, transfer seal, succession and rental; up to 64 explicit asset conditions; all checks rerun after payment and before transfer). One authoritative rental pointer in the kernel prevents double-leasing across runtime instances. 18,635/19,423 → **19,044/19,833**. Tests: `test/estate.test.mjs` (13 entries), `test/browser-estate.mjs` (10–12 groups). **Verdict: drop** for the GOAL (rental-of-artwork is orthogonal), but the *inventory-digest sale* idea — selling an NFT together with a verified commitment to what its accounts hold — is a strong unique idea for any "NFT that is a wallet" marketplace and should be kept in the idea bank.

### 3.10 `PresaleCartridge` — family 6 (`src/cartridges/PresaleCartridge.sol`)

`docs/PRESALES.md`. Fixed-price existing-token/ETH presale, fully funded from Reach at creation (buyer inventory + separate LP-token reserve), ratio as integer numerator/denominator, per-wallet allocation `floor(cumulative wei × num / den)` (removes within-wallet partition rounding; creation requires `ceil(hardCap×num/den) ≤ inventory`), min/max raise, open/close/finalizeBy, fixed proceeds and unused-inventory recipients, exact committed v4 recipe (now with hook + hookData), optional immutable buyer vesting (`finalizeBy <= start <= cliff <= end`, `end <= 2^48-1`), partial claims via `claim(saleId, buyer)`, failure refunds ignore vesting, Garden-scoped creation nonce. Market records the resulting LP under a domain-separated commitment binding chain/kernel/presale runtime/sale/Garden/Market/recipe/archive/deadline. Accounting identities (Wolfram-checked): raised ETH = LP ETH + proceeds; funded tokens = LP tokens + allocations + unused credit. 15,454/16,241 → 16,313/17,100 → **17,886/18,675**. Fork: finalization 955,773 gas. Recovery schemas `pixel.presale.recovery/2`, `pixel.presale.terms/2`. **Verdict: adapt** (fold into the launchpad).

### 3.11 `CurveCartridge` — family 7 and `LiquidityCartridge` — family 8

`docs/FINANCE-EXTENSIONS.md`, `docs/BOARD-FINANCE-HISTORY.md`. **Curve**: buy-only, fully funded lot sale for an existing ERC-20 — lot `n` costs `basePrice + slope×n`; cumulative `basePrice×n + slope×n(n−1)/2` so split purchases cannot change total cost (telescoping, Wolfram-checked); zero slope = fixed price; ETH or distinct ERC-20 quote; min/cap/open/close/finalizeBy; optional vesting; graduation creates exactly the committed sorted v4 pair and rolls back wholesale on any failure. "There is no prelaunch redemption market, token issuance or virtual collateral." 18,390/19,177 → **19,847/20,636**. **Liquidity**: sorted ETH/ERC-20 and ERC-20/ERC-20 v4 pairs, exact token/Permit2 allowances with final zero checks, LP locks, fee collection as zero-liquidity decrease then optional principal removal, immutable fee-share recipient with carried fractional remainder (`recipient share = floor((f×b + r)/10000)`, 23,064 cases Wolfram-checked), v2 exact-input routes of 2–5 path tokens through the pinned router. 21,279/23,197 → **22,330/24,250**. Tests: `test/finance-plus.test.mjs`, `test/finance-plus-fork.mjs`, `test/browser-finance-plus.mjs`. **Verdict: adapt** (merge Curve into the launchpad's sale modes; the fee-share-with-carry is a reusable creator-revenue primitive).

### 3.12 `LaunchpadCartridge` + `LaunchToken` — family 9

`docs/LAUNCHPAD-CREATION.md`. Action 1 deploys `LaunchToken` (name 1–64 bytes, symbol 1–16, decimals 0–18, positive fixed supply, all to Reach, "no additional mint function, upgrade, tax, blacklist or publisher allocation"); action 2 deploys launcher-authored hook initcode with appended constructor args, caller nonce + mined salt, intended 14-bit permission mask and explicit ETH endowment; CREATE2 salt binds chain, kernel, Garden, nonce and mined salt; on-chain check of address bits and the four return-delta prerequisites; constructor `msg.sender` is the runtime (owner/PoolManager must be explicit args); empty runtime, duplicate nonce or flag mismatch reverts; permanent per-Garden record of address, kind, nonce, timestamp, creation-code hash, runtime hash. No approval list. Launchpad **9,846/10,635**; LaunchToken **1,536/2,746**. Tests: `test/launchpad.test.mjs`, `test/launchpad-fork.mjs`, `test/browser-launchpad.mjs` (7 creation/recovery checks). **Verdict: adapt** — this is the GOAL's launchpad core: fixed-supply ERC-20 factory + permissionless hook deployment + hooked pool launch, with Presale/Curve/Liquidity as its sale modes.

### 3.13 `OTCCartridge` — family 10

`docs/OTC-CARTRIDGE.md`, `docs/OTC-BOARD-21.md`. Owner proposes an immutable agreement: two named wallets, ≤8 assets per side (ETH/ERC-20/ERC-721/ERC-1155, exact base units, same ERC-721 cannot appear on both sides, fungibles transferred in full without netting), expiry, optional fixed fee paid by one side to the arranging owner's wallet. Terms hash binds chain, kernel, runtime, Garden, custody/activation epochs, edition, broker, client nonce, both parties, both bundles, expiry, fee. `fund(dealId, termsHash)` by each party; `settle` by anyone once both funded (atomic, rolls back wholesale); cancel rules (party anytime pre-settlement; broker only before any deposit; anyone after expiry); independent per-side refunds; aggregate per-asset liabilities; expected safe-receiver callbacks bound to exact token/source/id/amount/operator; no Reach action. 15,370/16,159. Fork gas: propose 576,798; fund WETH 138,009; fund ETH 102,370; settle 160,055; claim fee 42,736; refund 82,735. Tests: `test/otc.test.mjs`, `test/otc-fork.mjs`, `test/browser-otc.mjs` (13 groups + 8 viewport). **Verdict: drop** for the GOAL's scope (could be a later module); the two-sided escrow-with-fixed-refund pattern is reusable.

### 3.14 `OpenEditionNFT` / `RuntimeNFT` (`src/cartridges/`)

Abstract compiled components. `OpenEditionNFT` adds publisher `openEditions()` (irreversible), public `claimStarter(recipient)`, `starterEdition(recipient)`; "reserves a claim before the ERC-721 receiver callback" (`docs/MINT-TO-APP.md:64`). `RuntimeNFT` is the shared base binding kernel + content release + publisher-only `mintEdition`. **Verdict: adapt** — the free-starter mechanism is how a fresh holder gets apps without the publisher; in a merged protocol where the mint itself installs everything, this collapses to "mint installs the fixed app set", but keep the irreversible-opt-in idea for third-party apps.

### 3.15 Kernel host, trusted workspaces and the launcher/reader (`web/kernel/`, `web/launcher/`, `tools/build-kernel.mjs`, `tools/build-launcher.mjs`)

See §4 for the website-delivery answer. Documented in `docs/KERNEL-HOST.md`, `docs/MINT-TO-APP.md`, `docs/WORLDS-AND-BOARDS.md`, `docs/STATE-AND-VERSIONS.md:92`, `docs/BOARD-COMPLETION.md`. Fifteen archived entrypoints (market 78,815 B; locks 34,968; journal 37,524; garden-game 60,858; studio 75,505; moonlit-archives 60,860; nexus-grove 60,853; social/continuity/estate/otc/presale/launchpad/curve/liquidity ≈23.3–23.5 KB each) and nine trusted workspaces (Social, Continuity, Estate/OTC 293,236 B, Locks, Analytics 125,250 B, Presale 153,344 B, Finance 184,322 B, Journal workspace 170,915 B, Experience). **Verdict: adapt** the mechanism (frozen host + digest-pinned workspaces + sandboxed cartridges + HTTPS reader fallback), **rewrite** the UI (the 24-workspace board shell is far larger than the GOAL needs).

### 3.16 SDK and tooling named in the docs (`sdk/*.mjs`, `tools/*.mjs`)

`sdk/financial-recipes.mjs` (unsigned recipes, never signs), `sdk/launch.mjs` (durable launch checkpoints), `sdk/state.mjs`, `sdk/archive/publication.mjs`, `sdk/holdings.mjs` (log-based discovery: 2,000-block default, 20,000 max, 1,000-block batches, 256 candidates, 5,000 logs), `sdk/positions.mjs` (v4 principal/fee math from Uniswap v3-sdk 3.31.5 TickMath), `sdk/launch-analytics.mjs`/`launch-accounting.mjs` (snapshot-pinned, reorg-checked, exact rational arithmetic; `(e×s² + t×2¹⁹²)/s²`), `sdk/hook-inspector.mjs`, `sdk/board-history.mjs`, `sdk/vesting-sales.mjs`, `sdk/swap-lock.mjs`, `sdk/locks.mjs`, `sdk/social.mjs`/`whispers.mjs`/`whisper-ratchet.mjs`, `sdk/sealed-packets.mjs`, `sdk/ens.mjs`/`ens-records.mjs`, `sdk/agents.mjs`, `sdk/transactions.mjs`, `sdk/otc.mjs`, `sdk/maturity-keeper.mjs`, `tools/compile.mjs` (two-pass Content pin), `tools/recover-cartridges.mjs`, `tools/verify-source.mjs` (offline exact compiler/runtime match), `tools/rpc-relay.mjs`. **Verdict: adapt selectively** — the snapshot-pinned, budget-bounded log readers and the transaction journal are the right indexer-free client patterns; the analytics/accounting/keeper/ENS-renewal pieces are out of GOAL scope.

### 3.17 `docs/MASTER-PLAN.md` Appendix A — the IPSEITY declaration inventory (lines 393–4818)

A lexical index of every `.sol` under `src/` of IPSEITY-FINAL at commit `c22cd8cb391fa9dd8c48e3bc229f8feb1d2f7dd7`, with per-file source SHA-256. **Important finding:** it indexes 84 files including `src/ModulePortal.sol`, `src/modules/{ArtifactBinding, CartridgeTypes, ChunkedCartridgeRegistry, ExtensionReleaseRegistry, ModuleArchiveFactory, ModuleStateStore, ModuleTypes, ModuleWorkbench, OnchainApp, OnchainAppDirectory, TokenModuleRegistry, vendor/*}` and `src/sovereign/SovereignIpseity.sol` — **none of which exist in the sibling `/home/user/Most-Advanced-NFT-Possible/src` checkout** (verified: `src/modules` and `src/sovereign` are absent there; it has `LaunchView.sol`, `ParleyPort.sol`, `V4PositionPlanner.sol` instead). The appendix is therefore the only record in this workspace of that IPSEITY module system. Key declarations preserved:

- `ChunkedCartridgeRegistry` (`:4138`): ERC-721 cartridge editions; `publishRelease(manifestJSON, chunks[], expectedSha256)`, `acquire(releaseId)`, `contentOf(id)`, `launchManifest(id, player)`, `canLaunch`; constants `MAX_CONTENT_BYTES=1_048_576`, `MAX_CHUNK_BYTES=23_000`, `MAX_CHUNKS=64`, `contentEncoding="rawHTML"`.
- `ExtensionReleaseRegistry` (`:4190`): `publish(ReleaseInput, canonicalManifest)`, `releaseAtVersion`, `moduleKey(publisher, moduleId)`; `serviceType=keccak256("anima.extension-release-registry/1")` — note the `anima.*` domain names: this IPSEITY branch already shared vocabulary with the ANIMA repo.
- `TokenModuleRegistry` (`:4443`): `stageState`, `activate(tokenId, releaseId, expectedRoot, expectedEpoch, expectedStateHead, nextStateHead)`, `writeState`, `disable`, `rootOf`, `custodyEpoch(tokenId)` (uint64), `authorityType=keccak256("ipseity.reach-modules/1")`.
- `ModuleStateStore` (`:4277`): `append(tokenId, moduleKey, schema, parent, epoch, data, archive)`, `MAX_DIRECT_BYTES=32768`.
- `ModulePortal` (`:1450`): an ERC-5219 `request(string[] resource, KeyValue[] params)` router serving `/services` JSON and the packed workbench document from an immutable archive — i.e. a web3:// front door for the module system.
- `SovereignIpseity` (`:4607`): a single-contract "everything" NFT — `MAX_SUPPLY=4096`, loader-only `uploadWebsiteChunk/beginTesting/seal`, `document()`, ERC-4907 `setUser/userOf`, ERC-5192 `setLocked/locked`, `commit(id, word)`, `depositETH/depositERC20/withdraw/liquidBalance/unassigned`, `lockAsset/extendLock/transferLockClaim/claimLock`, an **internal constant-product market per token** (`openMarket(id, base, quote, feeBps)`, `depositMarket`, `quoteMarket`, `swapMarket`, `swapMarketAndLock(..., autoSell, autoSellMinOut, ...)`, `executeAutoSellLock`), `speak(id, room, kind, body)`, `inscribeMemory/readMemory/writeMemory/freezeMemory` with `MemoryMode`, Merkle-rooted sessions (`grantSession(id, key, expires, nativeCap, root)`, `executeSession(..., proof)`), `executeAsToken`, estate (`arrangeEstate/stillHere/summonEstate/claimEstate`), consignment (`consign/revokeConsignment/buy/claimSaleCredit`), `request()`/`resolveMode()` (web3://), `royaltyInfo`, `custodyEpoch` (uint64), per-asset `totalLiability`. This is the closest existing sketch of "one contract = swap + social + vault + launch + website" and is a direct counterpoint to Pixel Garden's ten-family split.
- `Ipseity.sol` (`:899`): `REGISTRY = 0x000000006551c19487814612e58FE06813775758`, `REACH_SALT = bytes32(0)`, `GRIP_SALT = keccak256("IPSEITY.GRIP.v1")`, `BORN_OPEN=0x987`, `ALL_OPEN=0xFFF`, `NODE_COUNT=12`, `price=0.01 ether`, `openFee=0.002 ether`, `royaltyBps=500`, `KERNEL_ABSENT/CURRENT/STALE`, `IDataVerifier verifier`, `IRenderer renderer`+`rendererSealed`, `leaseAgentOf`.

**Reuse verdict: reuse-verbatim as reference** (it is documentation). The design team should read `SovereignIpseity` and `TokenModuleRegistry` from here, since the sibling checkout has lost them.

### 3.18 The board ledger (`docs/BOARD-IMPLEMENTATION.md`) and the 20-board scope

Boards: 01 Assets/Vaults; 02 Locks/Vesting/Seals; 03 Token Market/Liquidity; 04 Commons/Rooms; 05 Whispers/Identity; 06 Mint/Name; 07 Token Launchpad; 08 Hook Inspector; 09 Module Workbench; 10 Publish/Recover/Version; 11 Journal/Memories; 12 Cartridges/Nested Worlds; 13 Explore/Token Profile; 14 Transfer/Rental/Consignment; 15 Succession/Continuity; 16 Session Keys/Agent Access; 17 Instrument Studio/Interior; 18 Advanced Console/Sealed Data; 19 Wallet/Transaction States; 20 Mobile GUI; 21 OTC. Reference PNG SHA-256 fingerprints at `:63-84` and Appendix B. Visual language: "dark navy panels, lavender borders, cyan details, pink primary actions, monospace controls and crystal/garden imagery" (`:21`); "The reference images use IPSEITY branding; the implementation uses Pixel Garden." The "Still to implement" column for every board is now only physical-device/Safari/screen-reader acceptance, independent review, keeper hosting and art direction — i.e. the software scope is claimed implemented but none is "accepted". **Verdict: adapt** — boards 01, 02, 03, 04, 05, 06, 07, 16, 19, 20 map directly onto the GOAL; 08–15, 17, 18, 21 are optional.

### 3.19 `AGENTS.md`, `docs/BUILD-STATUS.md`, `docs/RESUME-BOARD-COMPLETION.md`, `docs/evidence/`

`AGENTS.md` (121 lines, newest-first continuity log) is where the authority rules are stated as orders ("Grip must gain no withdrawal, rescue, upgrade, asset approval, valid spending-signature or execution authority", `:37`). `BUILD-STATUS.md` (417 lines) is a newest-first ledger of every checkpoint with commit, tree, CI run, test counts, sizes and host hash; `docs/evidence/*.json` (47 files, 1.4 MB) hold per-milestone source SHA-256 maps, artifact size tables (`productionArtifactComparison.artifacts`), gas and check lists. The process rules worth copying into the merged project: never write a test count before running the suite; record every size; keep fixture results separate from fork results; CI runs that fail "with empty step lists and no runner identity" are not failures or passes (this happened to the last five CI runs: 36502506823, 36507546886, 36521505530, 36528221289, 36534130709). **Verdict: adapt the discipline, drop the content.**

### 3.20 `THIRD-PARTY-NOTICES.md`

Solady ERC-721 and Base64 vendored unchanged from IPSEITY-FINAL `c22cd8cb…` (MIT); OpenZeppelin 5.4.0 pinned; Solady 0.1.26 `LibString`/`SafeTransferLib`; ethers 6.17.0, Uniswap SDKs (`@uniswap/v3-sdk 3.31.5`, `v4-sdk 2.4.1`, `sdk-core 7.19.4`), JSBI 3.2.5, esbuild 0.25.12, Hardhat 2.29.1, Playwright 1.62.1, solc 0.8.36, `@metamask/connect-evm 2.1.1`; ERC-6551 registry runtime extracted from the EIP's published deployment transaction (`test/fixtures/erc6551-registry.json`). "No Uniswap onchain implementation is copied or deployed by the production application; only interfaces and existing deployment addresses are used." **Verdict: reuse-verbatim** (licensing is clean and attributed).

---

## 4. How the web UI is delivered, and how it verifies NFT ownership

### 4.1 Delivery: from chain, with an HTTPS reader as the *tested* path

1. **The host is on chain.** `dist/kernel-host.html` (built by `tools/build-kernel.mjs`; stylesheet + script gzip-compressed and transported in "a tested printable radix-85 alphabet that excludes HTML delimiters, quotes and backslash", `docs/STATE-AND-VERSIONS.md:92`) is published as a canonical raw archive through `ArchiveFactory` and frozen once with `freezeHost` before the first mint. Ceiling 196,608 bytes; current 196,543. "No hosted JavaScript, fonts, images or CDN is required." (`docs/KERNEL-HOST.md:92`).
2. **`document(id)`** returns the host bytes with chain, kernel and Garden identity appended "before the closing body tags" (the legacy candidate did it as a `<script>window.PIXEL_CONTEXT={chainId,contract,tokenId}</script>` prefix, `research/PixelGarden.extended.sol.txt:300`). `document(uint256,string)` returns identical bytes and exists only to carry the ERC-6860 `.html` MIME hint.
3. **`tokenURI(id)`** is "a percent-encoded JSON data URI containing a Base64 HTML `animation_url`. The envelope is not Base64-encoded again: the full-size fixture exposed that redundant encoding exceeded the ordinary RPC call gas cap." (`docs/KERNEL-HOST.md:94`). Unhosted Gardens keep Base64 JSON. Consumers "must parse the data URI's encoding rather than assume every JSON data URI is Base64."
4. **Canonical address in metadata:** `web3://KERNEL:CHAIN_ID/document/GARDEN_ID/string!index.html` (ERC-4804 + ERC-6860 auto mode, `docs/MINT-TO-APP.md:9-15`). A `returns=(bytes)` query form "would produce JSON, not the rendered page, and is deliberately absent."
5. **But native web3:// is not the tested route.** "Native clients also need the host's browser APIs: wallet injection, persistent origin storage, Web Locks for safe submissions and DecompressionStream for the frozen bootstrap. Returning HTML alone does not establish those capabilities; the HTTPS reader is the tested compatibility route." (`:25`). The reader (`dist/launcher.html`, built separately by `tools/build-launcher.mjs`) pins the exact host SHA-256, reads a same-origin `launcher-config.json` (one collection, one read RPC, ≤32 starters), and before executing checks "the chain, kernel deployment chain, token existence, raw archive bounds, recognized host digest, canonical archive factory validation, archive runtime hash, bounded chunks, stored/expanded lengths and hashes, and the pinned block's continued identity. It never executes metadata's `animation_url`." The verified DOM "is parsed inertly and its verified bootstrap explicitly started. `document.open/write` is avoided because it removes wallet listeners." (`:31-33`). This is explicitly "**not** independent Ethereum consensus/proof verification. A Colibri-style proof adapter remains future work." (`:35`). A PWA manifest/service worker caches only the static shell.
6. **Apps inside the host.** Content cartridges run in `sandbox="allow-scripts"` opaque-origin iframes with an injected CSP denying network, frames, objects, forms and external scripts/styles; a per-frame MessageChannel with typed, capability-checked, size/rate/concurrency-bounded requests; navigation closes the channel (`docs/KERNEL-HOST.md:102`). Workspaces that need wallet/keys (`trusted-social.js`, `trusted-estate.js`, …) are archived with their cartridge but executed natively only after their exact build-pinned SHA-256 and byte length match: "Unknown/modified code is rejected even if its own archive hashes are valid." (`docs/SOCIAL-IDENTITY.md:37`).
7. **Independent recovery.** `npm run recover:cartridges -- RPC KERNEL ID dir` writes `host-archive.html` (exact stored bytes) and `host.html` (bound document) plus every cartridge/state/position archive, verifying at one pinned block (`docs/KERNEL-HOST.md:96`).

### 4.2 Ownership verification for access

- **Reading is public; nothing is gated.** "Public website bytes are not private NFT content. Wallet ownership enables management; the existing kernel/Reach contracts enforce current owner, canonical accounts, custody epochs, installation epochs and reviewed financial actions. Connecting, opening or installing an app grants no spending permission. **No backend login signature is needed for these onchain operations.**" (`docs/MINT-TO-APP.md:43`).
- **Wallet selection:** EIP-6963 announcements with text-only provider names and deduplication; saved provider preference is only a hint; reopening uses `eth_accounts` (no new prompt if still granted) "followed by live chain/account/ownership checks. Account changes, chain changes and provider disconnects clear signing state and close active apps." (`:39`). The reader lazily loads `@metamask/connect-evm 2.1.1` for mobile QR/deeplink.
- **Live checks before any write:** every send "rechecks chain, wallet address, current owner/custody epoch and relevant activation, simulates, and estimates before requesting the wallet. A cancelled review sends nothing. A parent transfer during review invalidates submission." (`docs/KERNEL-HOST.md:100`). A global custody watcher closes workspaces when the Garden is sold (`AGENTS.md:69`).
- **Non-owner experience:** a former owner or stranger gets the "read-only former-owner view" (`docs/evidence/kernel-browser.json` check "mobile navigation, narrow layout and read-only former-owner view"); claim buttons that are permissionless (Locks, Presale, Estate, OTC refunds) stay available to any gas payer because Solidity, not the UI, decides.
- **Mint handoff:** the new Garden ID is derived "from the confirmed receipt's unique kernel `Transfer` from the zero address to the reviewed recipient. They never infer it from `totalSupply`." (`docs/MINT-TO-APP.md:47`). Garden 0 is a non-owner launcher context so an empty collection can accept its first mint.
- **Agents/sessions:** an agent connects its own wallet and calls `executeCartridge` under an owner-granted exact-recipe session; no agent key is created by the host (`docs/IDENTITY-RECOVERY-WORKSPACE.md:25`).

**Net for the GOAL:** Pixel Garden already does "mint → open the token's own URL → connect wallet → owner-only controls enforced on chain". What it does not do is serve the site through an ERC-5219 router (IPSEITY's `Premises`) or prove bytes without trusting the HTTPS reader/RPC.

---

## 5. Measured numbers (consolidated)

**Production artifacts (runtime/initcode bytes, latest = `docs/evidence/otc-cartridge.json`, Social updated by `BUILD-STATUS.md:15`):** PixelGardenKernel 23,785/45,494; ReachAccount 17,714/17,970; GripAccount 1,933/2,106; MarketCartridge 24,340/25,587; LocksCartridge 14,275/15,060; SocialCartridge 16,297/17,562; ContinuityCartridge 8,796/9,581; EstateCartridge 19,044/19,833; PresaleCartridge 17,886/18,675; CurveCartridge 19,847/20,636; LiquidityCartridge 22,330/24,250; LaunchpadCartridge 9,846/10,635; LaunchToken 1,536/2,746; OTCCartridge 15,370/16,159; ContentCartridge 8,898/17,774; ArchiveFactory 8,676/8,702; OnchainApp 917/1,944; OnchainAppDirectory 2,083/3,497; AppChunk 16/338 (nominal); legacy PixelGarden 24,331/24,997; account forwarder 173/183; ERC-6551 registry 571. Legacy extended candidate 27,302 (uncompiled claim).

**Host and archives:** host 196,543/196,608 (newest), ceiling unchanged since the first kernel host; fifteen archived entrypoints (bytes in §3.15); trusted workspaces 125,250 / 153,344 / 184,322 / 170,915 / 293,236 bytes; Studio 75,468.

**Gas (disposable chains):** kernel deploy 6,846,437→9,431,421; mint w/ both accounts 297,094→299,485; Market deploy 4,207,940→5,499,663; factory 1,924,941; Content 1,437,269–2,144,146; publication 1,481,342; edition mint 145,795; acceptance 313,438; state record 330,368; multi-leaf publication 9,099,937 for 736,037 bytes. Fork block 26,059,508: launch 983,099; v4 swap 256,044; v3 swap 309,529; principal exit 258,209; swap-to-lock v3 777,185 / v4 676,056; maturity sale v3 428,658 / v4 383,991; presale finalization 955,773; OTC propose 576,798 / fund WETH 138,009 / fund ETH 102,370 / settle 160,055 / claim fee 42,736 / refund 82,735. Legacy fork block 26,058,607: seed 732,734; v4 swap 163,673; v3 swap 286,486; exit 176,250. IPSEITY reference: max-cartridge publication 24,904,819 → 10,010,926 gas.

**Tests:** 396 automated (newest `npm run check`), 391 (OTC), 370 (board completion), progression 13→49→50→59→63→75→87→98→110→112→125→140→156→163→183→192→206→255→264→274→282→289→298→320→333→347→370→391→392→396; browser 240 functional groups + 128 layout checks; 49 real-protocol fork checks + 3 ENS fork checks + 3 keeper CLI checks; 16,384 hook-flag combinations; Wolfram cross-checks: 23,064 fee-carry cases, 15,375 integer-scaling cases.

**Budgets:** Reach action data 2,048 B (12,288 for families 1/6/7/8 incl. 8,192 hookData; 50,176 for family 9); max two inputs/two outputs; sessions 1–1,024 uses; posts 2,048 B; Whisper cleartext 1,024 B / envelope 4,096 B; display name 64 B; room title 96 B; attachments 16 KiB; state save 32 KiB (browser); prepared package 256 KiB expanded; data chunk 23,000 B; directory 11,776,000 B; expanded 16 MiB; log scans 20,000 blocks / 2,000-block chunks / 1,000 events / 4,096 retained; OTC ≤8 assets per side, 50 deals per page, 4,096 export budget; Continuity quiet 30–3,650 d, notice 7–365 d; Estate lease 60 s–365 d, 64 inventory conditions.

**Addresses:** ERC-6551 registry `0x000000006551c19487814612e58FE06813775758` (runtime hash `0xda1d5b06e579f9e42e59b00fbc22939896ecb38dc8830d40de0a2508fecd6735`); ENS ETHRegistrarController `0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547`. **No contract of this project has a public-chain address.**

---

## 6. Weaknesses and open TODOs (as the docs themselves record them)

1. Never deployed, never audited, never merged to a release: "Independent review remains required before real funds; passing tests is not an audit." Remote CI for the last five sources failed with empty step lists; local runs are the only evidence.
2. Twenty production contracts and ten pinned families; admitting any new family or fixing any runtime means a new immutable kernel. The kernel has ~790 bytes of headroom and already exports pure helpers to `ContentCartridge` to fit.
3. The host has 65 bytes of headroom; every feature since September 27 shipped as a separately archived workspace, which multiplies the number of digest-pinned bundles the host must know about.
4. The tested delivery route is an HTTPS reader that trusts its own bootstrap and the configured RPC; native `web3://` rendering, MetaMask NFT-tile integration and consensus proofs are explicitly unverified.
5. Off-chain dependencies crept in: the maturity keeper (systemd template), Geth `debug_traceTransaction` for internal ETH history, archive-capable RPC for historical analytics, Playwright/Chromium for the full check.
6. Whispers lack forward secrecy by default; the optional ratchet is unreviewed and "old backups/browser memory cannot be securely erased."
7. Social stores full post bytes in contract storage (2,048 B each) — fine for a demo, costly at scale compared with log-based messaging.
8. Explicitly not implemented: reverse ENS writes, wildcard/CCIP, third-party marketplace protocols, native ERC-7401 nesting, generalized account-abstraction nonce handling, automatic migration scripts, ES-module linking at runtime, ERC-1271 spending signatures on accounts, Universal Router command streams, hosted indexers of any kind.
9. Token compatibility: taxed/rebasing/blacklisting tokens revert where detectable; "a later negative rebase may prevent settlement until solvency is restored"; no rescue path anywhere (deliberate, but a product risk).
10. Documentation drift: sizes and counts are quoted per checkpoint and superseded in the next section; `docs/ARCHITECTURE.md` describes the legacy build; `ESTATE-DESIGN.md`/`AUTOMATIC-SALE-DESIGN.md` are historical proposals.

## 7. Pitfalls the project paid for (copy these into the merged project's CLAUDE.md)

- Double Base64 of a ~190 KB host in `tokenURI` exceeded the RPC `eth_call` gas cap; encode the JSON envelope with percent-encoding and only the HTML as Base64 (`docs/KERNEL-HOST.md:94`).
- Permit2 `approve(token, spender, 0, 0)` normalizes expiry 0 to `block.timestamp`; cleanup checks must expect that (`docs/FINANCIAL-CARTRIDGES.md:35`).
- Never derive a minted token ID from `totalSupply`; use the receipt's `Transfer(0, recipient, id)` (`docs/MINT-TO-APP.md:47`).
- `document.open/write` for wallet handoff drops EIP-1193 listeners; parse inertly and start the bootstrap explicitly (`:33`).
- Async reads racing a render erase user input; carry a render generation and discard stale responses (`docs/LAUNCH-ACCOUNTING.md:76`, `docs/BUILD-STATUS.md:109-111`).
- ethers `Contract` responses wrap the runner's `wait`; reconcile the final receipt explicitly or the journal stays "pending" (`AGENTS.md:9`).
- Browser fixtures that initialize a v4 pool leak into later suites unless the chain snapshot is reverted (`docs/LAUNCH-ACCOUNTING.md:74`).
- A compact host ABI that omits events breaks discovery that decodes them; keep full ABIs in `out/` and the generated finance ABI for Liquidity (`docs/BOARD-COMPLETION.md:32`).
- A crafted non-UTF-8 ABI string stored on chain made every ethers-based read of the instance fail; validate UTF-8 before storing (`docs/BUILD-STATUS.md:13`).
- Public RPC fork reads can stall a 35-minute protocol regression; keep focused fork checks separate and labelled (`docs/BUILD-STATUS.md:37`).
- Default 2,000-block analytics scans can cross a local fork boundary the upstream RPC cannot serve; start fork tests after the fork block (`AGENTS.md:86`).
- `try` alone does not survive a codeless address — both this repo's ConsoleRead-style reads and IPSEITY's CLAUDE.md say to pair `try/catch` with `extcodesize`.
- Hardhat's `allowUnlimitedContractSize` must stay false or EIP-170 regressions hide until deployment.

## 8. Unique ideas worth carrying into the unified protocol

1. **Vault by absence**: a receiving-only ERC-6551 account with zero outbound selectors (Grip) alongside a typed-only working account (Reach), both canonical and verifiable from the collection without trusting `token()`/`owner()`.
2. **Non-wrapping custody epoch** threaded through sessions, seals, grants, key announcements, memberships, attestations and listings, so a sale invalidates everything and transfer-back revives nothing.
3. **Pinned-runtime families admitted by code hash, called by the account with an exact two-asset envelope**, with permanent position references kept in the core so settlement outlives the software.
4. **Freeze-once host + digest-pinned trusted workspaces + sandboxed cartridges**, with an HTTPS reader that re-verifies the archive before executing it and never executes `animation_url`.
5. **Exact-recipe sessions** (one recipe hash, N uses, worst-case exposure = cap × uses) as the agent-access primitive, rather than target/selector allowlists.
6. **Ratcheting seals** at three levels: per-asset, global outgoing, and parent-NFT transfer.
7. **Inventory-digest consignment**: sell the NFT with an on-chain commitment to what its accounts hold and what rights are attached, rechecked after payment.
8. **Fixed-beneficiary escrow with aggregate per-asset solvency**, permissionless claims, and the deliberately documented "direct claim pre-empts automation" race.
9. **Swap-to-lock in one transaction** with an append-only link `(locks, scheduleId) → (market, recipeHash, memoryCommitment)` and an optional keccak-committed trade memory published separately to the journal.
10. **Cumulative-allocation presale rounding** (`floor(cumulative×num/den)`) and **telescoping lot curves** so splitting purchases cannot change totals; **fee-share carry** so splitting collections cannot reduce a recipient's share.
11. **CREATE2 hook mining with on-chain flag verification** and no approval list — the launchpad lets holders ship their own v4 hooks.
12. **Receipt-bound mint-to-app** and the shared pre-broadcast transaction journal with Web Locks; the rule "a saved status is never confirmation; an unknown broadcast is never resent".
13. **Snapshot-pinned, budget-bounded log readers** with atomic private cursors and "zero vs no answer" separation — the indexer-free client pattern.
14. **Two-pass compiler pin**: build the helper contract first, write its runtime hash into generated Solidity, verify the final build matches; avoids embedding a second runtime copy in the core's initcode.
15. From the appendix: **SovereignIpseity's per-token internal AMM + `swapMarketAndLock(autoSell)` + Merkle-rooted sessions + ERC-4907/5192 in one contract**, and **ModulePortal's ERC-5219 `/services` JSON front door** — a path to serving the site and its config from the token contract itself.

## 9. Reuse verdict summary relative to the GOAL

| Component | Verdict | Why |
|---|---|---|
| Two-account kernel (`PixelGardenKernel` + Reach + Grip + AccountBinding) | adapt | Exactly the "one NFT owns a wallet and a vault" shape; shrink families, keep epochs/seals/positions |
| Archive layer (`ArchiveFactory`, `OnchainApp`, `OnchainAppDirectory`, `ContentCartridge`, `sdk/archive`) | reuse-verbatim | MIT-ported IPSEITY storage with factory, dedup, bounded recovery and publication journals |
| `MarketCartridge` swaps (v3 typed path, v4 unlock-commitment, hooks) | adapt | The swap pillar; drop the per-edition licensing wrapper |
| `LaunchpadCartridge` + `LaunchToken` + `PresaleCartridge` + `CurveCartridge` + `LiquidityCartridge` | adapt (merge) | The launchpad pillar: token factory, hook factory, sale modes, graduation, fee sharing |
| `LocksCartridge` (vesting, maturity sales) | adapt | Vault/timelock primitive; drop the keeper |
| `SocialCartridge` (rooms, Whispers, EIP-712 identity) | adapt | The messaging/social pillar; decide storage-posts vs log-posts against IPSEITY Parley |
| `ContinuityCartridge`, `EstateCartridge`, `OTCCartridge` | drop (idea bank) | Outside the four pillars; keep inventory-digest sale and two-sided escrow patterns |
| `OpenEditionNFT`/`RuntimeNFT` starter editions | adapt | Collapses to "mint installs everything"; keep irreversible opt-in for third-party apps |
| Kernel host + trusted workspaces + HTTPS reader | adapt mechanism, rewrite UI | Keep freeze-once/digest-pin/sandbox/reader; the 24-workspace shell is far beyond scope |
| SDK readers/journals (`holdings`, `transactions`, `publication`, `state`, `launch`) | adapt | Indexer-free client patterns |
| Analytics/accounting/history/keeper/ENS-renewal SDK | drop | Off-scope or off-chain |
| `research/PixelGarden.extended.sol.txt` | drop (mine patterns) | Superseded single-contract design; keep rolling-root, unlock-commitment, path validator |
| MASTER-PLAN Appendix A (IPSEITY modules + SovereignIpseity index) | reuse-verbatim as reference | Only surviving record of those files in this workspace |
| Board ledger / evidence / AGENTS process rules | adapt discipline | Measure before claiming; label fixture vs fork; never auto-resend |
| THIRD-PARTY-NOTICES | reuse-verbatim | Clean MIT provenance |
