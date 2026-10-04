# Dossier: MASTER-NFT-PROJECT (ANIMA v7 "Master")

Repository: `/home/user/MASTER-NFT-PROJECT` (GitHub `venividis/MASTER-NFT-PROJECT`), upstream HEAD `f65fb2c` (2026-09-23, "Merge pull request #5 … propose-fix-for-factory-nonce-vulnerability"); the four later commits on the working branch are this program's own `unified/` research notes and are ignored here. `VERSION` = `7.0.0`. Unaudited; on `main` the only certified deployment is a reproducible local Ganache mint (chain 31337); a live Ethereum Sepolia deployment with three minted tokens exists only on an unmerged branch.

This dossier consolidates five reader reports (`master-contracts.md`, `master-onchain-app.md`, `master-docs-pipeline.md`, `master-branches-1.md`, and `master-web.md`, which appeared only after the first draft: sections 4–8 were first built by reading `web/`, `index.html`, `integrations/console/protocol/v4-hook/src/` and `integrations/official-launch/` directly, then reconciled against the web report, whose most important finding — that only part of the app is actually gated by the NFT — is carried into sections 4, 5, 6 and 10). Where readers disagreed, the source was checked: the Sepolia record on branch `codex/deploy-on-testnet-and-mint-3-nfts-pj8cqs` holds **37** transaction entries (one reader said 36); `contracts/src` holds **102** `.sol` files including mocks (one reader counted 100), **12,081** lines; `test/` holds **127** `*.test.mjs` files with **734** literal `test(` calls, while CI reports 760 (loop-generated cases); `WorldLedger` stores message bodies in storage **and** emits them (`WorldLedger.sol:32,49`); the Commons desk ships both the `EpochGroupChat` and the `MLSGroupChat` client; the "Swap" door resolves to the Uniswap-v4 desk (`capabilities.mjs`, `trade → v4`), whose contracts live in `integrations/`, not `contracts/src/`, so they are inventoried here.

Reuse verdicts are relative to the unified GOAL — one ERC-721 whose holder gets, inside the token, a swap, a messaging/crypto-social layer, a launchpad and a vault; the token "mints a website" served from chain; a visitor connects a wallet, is verified as holder (or holder-authorised), and uses all of the above; no server, no IPFS — not relative to MASTER's own goals.

---

## 1. Identity and thesis

### 1.1 What it is

MASTER is the "everything" edition of the **ANIMA Genesis** lineage: an ERC-721 collection named `IDontFuckingBelieveIt` (symbol `IDFBI`, 20,940 deployed bytes) in which every token, at mint, receives a deterministic CREATE2 **NFT account** (`SovereignAccount`, 21,506 bytes) that obeys `ownerOf(tokenId)` at call time, and whose `tokenURI` emits a self-verifying HTML **loader** that recovers a 7,952,983-byte web application from immutable contract bytecode using only the viewer's own RPC. Around that core sit a sealed "Genesis stack" (swap `NativeMarket`, community-sale `GenesisLaunchpad`, `TimeVault`, social ledger `WorldLedger`, journal `MemoryLedger`), a real Uniswap-v4 market and hook (`V4GenesisMarket`, `PhoenixLaunchHook`), a second v4 launch family under `integrations/` (`GenesisV4Launchpad`, `GenesisV4Position`, `GenesisV4Router`, `OwnerV4FeeHook`), a streaming auction, encrypted group chat (custom sender-key and RFC 9420 MLS), an NFT-estate exchange, and — the v7 addition — a **per-NFT installable module system** (`ExtensionReleaseRegistry` → `TokenModuleRegistry` → `ModuleStateStore`, `ModuleWorkbench`, `ChunkedCartridgeRegistry`) with a portable SDK. A long tail (agents, LayerZero, state portal, Groth16 proof, Rust policy kernel, RAILGUN worker, governance, experimental DeFi) is compiled but mostly gated to test networks.

The project's own one-sentence self-description (`README.md:3`): "An Ethereum/EVM NFT with its original blue interface, an NFT-owned account, and owner-selected programs and saved state. The contracts are Solidity. Browser programs are JavaScript/HTML stored as immutable onchain bytes and recovered in the browser."

### 1.2 The thesis, in the code's own words

Three ideas recur in every load-bearing comment:

1. **The NFT is the identity; the account is its hands.** Peripheral contracts never ask the wallet, they ask `collection.accountOf(identity) == msg.sender` (`ProtocolPrimitives.sol:62-65`: "Zero means an unbound wallet/contract address, never a claimed NFT identity."). The account obeys only `ownerOf` ("A marketplace approval must never grant ascension, identity or spending authority.", `IDontFuckingBelieveIt.sol:802-816`).
2. **Custody epochs replace revocation lists.** `SovereignAccount.sessionEpoch` is bumped by the collection on every transfer; every grant, invitation, moderator flag, exit plan, listing, module review and chat roster stores the epoch at grant time and re-reads it ("Write membership belongs to consenting custodians, not future NFT buyers.", `WorldLedger.sol:103-118`).
3. **Storage on chain is not execution; recovery must be verifiable.** `OnchainApp.sol`: "Immutable, complete HTML/Wasm/shader archive. Not a mutable URL or an IPFS-only pointer. … Browsers still execute the recovered code offchain; storage being onchain is not execution." Every reader (browser loader, SDK, CLI) pins one block and re-hashes everything before `document.write`.

A fourth, documentary thesis shapes the whole repository: every capability is published with its "actual boundary" (`docs/CAPABILITIES.md` is generated from the same inventory the Atlas UI uses and says "Code presence does not establish public deployment, funding, external service availability or a security certification"), and every validation run is named against a commit, a CI run id and a measured number.

### 1.3 Relationship to ANIMA in `Cutting-edge-technologically-advanced-NFT`

They are **not the same lineage and not a fork**; they are two codebases by the same author (`venividis`) that share the ANIMA brand and a design vocabulary, and MASTER explicitly positions itself as the body that would absorb the other.

- **Separate code.** `Cutting-edge-technologically-advanced-NFT` ("ANIMA — Sovereign Agent Tokens": `AnimaAgent.sol`, canonical ERC-6551 `AgentAccount`, Hardhat 3/viem, solc 0.8.28, 27 contracts, EIP-2535 diamond twin) contains no occurrence of `IDontFuckingBelieveIt`, `IDFBI`, `ConfluenceRenderer`, `SovereignAccount` or `AWE_CHAIN_IDENTITY` (grep over the whole checkout). MASTER's upstream is a different repository, `venividis/ANIMA-NFT-` (`docs/genesis/CONTINUATION.md:7`, "Genesis 5.5 source baseline `062f00d3…`"), with a release history 1.2 → 1.4 → 1.6 → 1.7 → 3.0 → 4.0 → 5.x → 6.0 (`CLEANUP.md`) → 6.1/6.2 → 7.0.
- **MASTER vendors Cutting-edge as a reviewed donor.** `integrations/github/cutting-edge/` is a full copy of the Cutting-edge default branch at commit `35a725e` (2026-09-06), `integrations/github/cutting-edge-commons/` holds its unmerged Commons branch, `integrations/github/most-advanced/` is IPSEITY; `docs/confluence/research/github-audit.md` is MASTER's own audit of both and states the intended relationship: "ANIMA is strongest as an accountable agent protocol. IPSEITY is strongest as an NFT that emits its own executable interface and contains a practical economic system. The requested IDFBI project should remain the visual and ownership foundation. These repositories contribute separable economic and verification components, not a replacement landing page."
- **Convergent design, divergent implementation.** Both have a per-token account whose authority is voided by sale, ERC-8004-style agent binding, ERC-4907 users, LayerZero V2 integration and testnet deployments from the same deployer EOA (`0xc591C669…312C00`, which the Cutting-edge `CLAUDE.md` calls a destroyed burner). But Cutting-edge uses the canonical ERC-6551 registry, custom errors throughout and a size-proved diamond; MASTER uses a bespoke CREATE2 factory (`canonicalERC6551Compliance:false`), mixed `require("STRING")`/custom-error style, solc-js + Ganache, and no diamond.

### 1.4 What v6.2 → v7 added

v6.2 (`docs/RELEASE-6.2.md`) already had: Launch → Create/Manage/Economics (direct v4 pools, community sales, streaming auctions, pinned official Uniswap CCA and Doppler), RFC 9420 MLS Commons, Operating shared ownership (`OperatingNFTGovernance`), cross-chain OFT lanes, Authority & recovery desk, shared worlds server, and the exact-calldata instrument-grant account model ("New NFT editions reject the old selector-only session execution path").

v7 (`docs/MODULAR-MEMORY-PLAN.md`, mapped by `docs/MODULES-IMPLEMENTATION.md`, commits `7f2d7f0` → `84961c3`, 2026-09-16) imported the complete 6.2 baseline (`e0d9877`, 3,314 files) and added the **22-item modular memory plan**: `ChunkedCartridgeRegistry` + `ArtifactBinding` (NFT-owned sub-apps ≤1 MiB), the `anima.extension-release/1` manifest and `ExtensionReleaseRegistry`, the per-NFT `TokenModuleRegistry` with atomic release/state activation, `ModuleStateStore` with snapshots stored as `AppChunk` code (the `84961c3` fix: a 32 KiB snapshot fell from 29,172,440 gas to 7,713,661, under EIP-7825's 16,777,216 cap), `ModuleArchiveFactory`, the recoverable 707,014-byte `ModuleWorkbench`, the `anima.host/1` capability bridge and worker-DOM sandbox, migration/history UI, the `@anima/modules` SDK (406,475 B), unsigned deployment plans with journaled receipts, and read-only recovery CLIs. After v7 came four merged Codex PRs and two unmerged branches (the Sepolia deployment record; the "Prism Cathedral II" GUI plus an exact local-mint simulator).

---

## 2. Architecture

### 2.1 Text diagram

```
                     commitAwakening(commitment){value: endowment}  →  2..200 blocks  →  revealAwakening(secret, recipient)
                                                      │
                                                      ▼
┌──────────────────────────────────── THE COLLECTION ────────────────────────────────────┐
│ IDontFuckingBelieveIt (core/, 20,940 B)  ERC-721/165/2981/4906/4907 + "8048" KV metadata │
│   seed = keccak(domain, chainid, this, awakener, recipient, secret, blockhash, prevrandao, id)
│   _isMutableAuthority: account always; owner only while not sovereign; approvals NEVER  │
│   _transfer: ForbiddenTransferTarget (no account/collection/factory), clears 4907 user,  │
│              calls account.invalidateSessionsOnTransfer()  → ++sessionEpoch              │
│   tokenURI(id) → renderer.render(this, id)                                               │
└──────────┬─────────────────────────────────────────────────────┬────────────────────────┘
           │ createAccount(id)  (once, CREATE2, salt = keccak("…_ACCOUNT_V1", chainid, collection, id))
           ▼                                                     ▼
┌─ SovereignAccountFactory (23,423 B) ─┐        ┌─ ConfluenceRenderer (14,772 B) ──────────────────────┐
│ embeds SovereignAccount creationCode │        │ render(): JSON{ image: GenesisSVG,                     │
└──────────┬───────────────────────────┘        │   animation_url: data:text/html;base64(               │
           ▼                                     │     <script>window.AWE_CHAIN_IDENTITY={seed,genome,root,│
┌─ SovereignAccount(tokenId) (21,506 B) ────────┐│      chainId,collection,tokenId,manifest,privacyResource,│
│ Bound mode (onlyController = ownerOf):        ││      runtime,sha256,archiveVersion}</script>           │
│   execute · executeUtility (exact allowance → ││     + loader HTML extcodecopy'd from an AppChunk) }    │
│     call → reset, custody re-check)           │└───────────────┬───────────────────────────────────────┘
│   grantAction/grantInstrument/executeInstrument│                │ loader eth_calls at one pinned block
│     (dataHash-pinned, target codehash pinned,  │                ▼
│      net-debit-by-balance budget, ≤30 d,      │ ┌─ OnchainModuleDirectory (schema 3) ─────────────────┐
│      ≤100 calls, epoch)                        │ │ 20 feature archives, each OnchainApp (≤64 AppChunk) │
│   sessionEpoch (bumped on transfer)            │ │ or OnchainAppDirectory (≤16×32); root commitment    │
│   auditRoot hash chain of every action         │ │ excludes addresses → unchanged features reused      │
│   ERC-1271 (owner sig), ERC-721/1155 receiver  │ │ 101 AppChunks = 2,072,940 B stored → 7,952,983 B   │
│   (refuses own collection)                     │ └─────────────────────────────────────────────────────┘
│ Sovereign mode (ProofRouter + verifier) — DROP │ ┌─ ShardedResource ─ 15.1 MB RAILGUN worker, 7 shards ┐
└──────────┬────────────────────────────────────┘ └─────────────────────────────────────────────────────┘
           │ msg.sender == collection.accountOf(identity)   (ProtocolGuard._identity)
           ▼
┌──────────────── GENESIS STACK (sealed once by WorldLedger.sealModules(market, vault, launchpad)) ───────────────┐
│ WorldLedger (14,233 B)   rooms · posts · reactions · profiles · follow/block · consent-epoch moderation          │
│   record(kind 1..10) accepts ONLY the sealed launchpad/market/vault/estate → trustworthy activity feed          │
│ GenesisLaunchpad (12,964 B) ──seed()──▶ NativeMarket (5,344 B) ──depositFromProtocol()──▶ TimeVault (6,517 B)   │
│   pro-rata batch sale,                   x·y=k, 30 bps, 1-2 hops,     cliff / linear locks, pull release,       │
│   ≥50 % raise → permanent LP,            swap-and-lock (lockUntil)    beneficiary = NFT account                 │
│   founder vest → TimeVault                                                                                        │
│ MemoryLedger (7,243 B) + JournalSwapRouter   public or client-encrypted journal; reflection branches; journaled swaps │
│ VestedExitVault · ConsentGiftRouter · InstrumentRouter · EstateExchange(+CommitmentIndex) · EditionRegistry · …  │
│ GenesisManifest.publish(collection, [market, vault, memory, ledger, cartridges, exit])  ← app service discovery  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────── v4 LANE (optional, needs PoolManager) ─────────────────────────────────────────────────────────────┐
│ V4GenesisMarket (11,453 B; same seed/swap ABI as NativeMarket) + PhoenixLaunchHook (fee ramp 1.00 %→0.30 %)        │
│ integrations/console/protocol/v4-hook: GenesisV4Launchpad → GenesisFixedToken + GenesisV4Position (LP shares),    │
│   GenesisV4HookLaunchpad, GenesisV4Router (exact-input, full-fill), OwnerV4FeeHook (creator fee → OwnerFeeRouter) │
│ integrations/official-launch: pinned Uniswap CCA v2.1.0 + Liquidity Launcher + Doppler (BUSL)                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────── v7 MODULE SYSTEM ("apps installed inside the NFT") ──────────────────────────────────────────────┐
│ ModuleArchiveFactory ─createArchive/createDirectory─▶ OnchainApp/OnchainAppDirectory (only factory-made readers) │
│ ExtensionReleaseRegistry.publish(ReleaseInput, canonicalManifest) → releaseId (publisher-namespaced, immutable)  │
│ TokenModuleRegistry (per NFT): stageState · activate(release, state) · writeState · disable                       │
│   _authorize: accountOf(id)==msg.sender && artifactIdOfAccount(msg.sender)==id && currentOwner()==ownerOf(id)    │
│               && rootOf[id]==expectedRoot && sessionEpoch()==expectedEpoch  (StaleReview)                        │
│   history hash chain rootOf[id]; independent stateModulesOf catalog                                               │
│ ModuleStateStore: ≤32 KiB direct snapshots as 1-2 AppChunks (7.7-7.9 M gas) or factory-validated archives        │
│ ModuleWorkbench: pins the 707,014-byte workbench document; services() = registry/store/document addresses         │
│ ChunkedCartridgeRegistry (ERC-721 "ANIMACART") + ArtifactBinding: NFT-account-owned HTML cartridges ≤1 MiB;       │
│   launchManifest(id, player) → authorized = player == ownerOf(parent NFT)                                         │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Deployment order (the real dependency graph)

From `scripts/lib/genesis-stack.mjs:25-54`: feature chunks → `AppChunk` (one ~23 KB-initcode transaction each) → per-feature archives → `OnchainModuleDirectory`; privacy shards → `ShardedResource`; `GenesisManifest`; `ConfluenceRenderer` (its constructor deploys the loader `AppChunk`); proof router and verifier; the collection; `SovereignAccountFactory` + `setAccountFactory` (once); mint #1; `WorldLedger`, then `NativeMarket`/`TimeVault`/`GenesisLaunchpad`, `MemoryLedger` + `JournalSwapRouter`, the obligations contracts, cartridges, `CommitmentIndex` + `EstateExchange`; **`configureEstateMarket` must precede `sealModules`** ("The market must be installed BEFORE sealing, otherwise completed sales cannot record activity.", line 51); `manifest.publish` (once). A full local mint creates **365** contracts (`reports/master-7.0/local-mint.json`); the v7 module system alone is 37 transactions on Sepolia.

### 2.3 Archive and recovery formats

| Archive | Schema | Expanded | Stored | Chunks | Commitment |
|---|---|---:|---:|---:|---|
| Genesis application `onchain-app/confluence/` | `awe.onchain-runtime/3`, modular-gzip, 20 feature groups, `shellIndex:0` | 7,952,983 B | 2,072,940 B | 101 | directory `479d97b6…`, runtime HTML sha `7ca876f3…` (re-verified by the reader with `sha256sum`) |
| Module Workbench `onchain-app/module-workbench/` | `anima.module-workbench/1`, raw | 707,014 B | 707,014 B | 31 | `ec2a47d8…9dc2b6` (concatenation re-verified) |
| Privacy worker `onchain-app/privacy-worker/` | `anima.onchain-resource/1`, gzip JS | 15,112,663 B | 4,596,329 B | 200 in 7 shards | expanded `40ef8c9a…`, compressed `7fc4f56c…` |
| Historical v1.7 instrument archive | `idfbi/local-onchain-app-preparation/1.7` | 409,658 B | 409,658 B | 18 | `1a08e36a…` |

Per-group versions increment only when the group's expanded SHA-256 changes (`scripts/lib/runtime-modules.mjs:56-60`): in the current edition `core-shell` is v4, `confluence` v3, `extensions` v4, `modules` v8, all others v1 — evidence that unchanged feature archives are reused byte-for-byte across the eight v7 rebuilds.

---

## 3. Complete contract and module inventory with reuse verdicts

Sizes are deployed bytes from `reports/contract-sizes.json` (solc 0.8.30, viaIR, optimizer runs 1,000; EIP-170 limit 24,576). Verdicts: **reuse-verbatim** (copy, rename domains only), **adapt** (keep design, change ABI/dependencies), **rewrite** (keep only the idea), **drop**.

### 3.1 `contracts/src/core/`

| Contract | Bytes | Role | Verdict | Reason |
|---|---:|---|---|---|
| `IDontFuckingBelieveIt` | 20,940 | ERC-721 collection: commit/reveal mint with endowment, account wiring, two authority predicates, forbidden transfer targets, KV metadata, 4907/2981/4906, evolution/ascension, ERC-8004 binding | adapt | Keep mint, `accountOf`/`artifactIdOfAccount`, predicates, transfer hook, metadata; strip evolution/`ascend`/sovereign/lineage/8004 (~a third of the surface); rename; ideally route the account through the canonical ERC-6551 registry |
| `SovereignAccount` | 21,506 | Per-token account: `execute`, `executeUtility`, instrument grants with net-debit budgets, epoch, audit root, 1271, receivers; Sovereign/proof branch | adapt (Bound) / rewrite as ERC-6551 | Bound-mode API is exactly the wallet-in-the-NFT; Sovereign branch is ~40 % of bytecode and must go; legacy `createSession` selectors already revert |
| `SovereignAccountFactory` | 23,423 | CREATE2 deployer embedding the account creation code | rewrite | 1,153 B of headroom; an ERC-6551 registry + proxy removes the size cliff entirely |
| `ProofRouter` | 4,793 | Verifier router with codehash pinning and `frozenAuthority` | drop | Only used by sovereign mode |
| `ThresholdAttestationVerifier` | 2,586 | M-of-N ECDSA over EIP-191 statement, strictly increasing signer order | drop (optional reuse as a guardian quorum) | Clean, but no GOAL feature needs it |
| `SP1ActionVerifier` / `RiscZeroActionVerifier` / `CompositeActionVerifier` | 1,064 / 1,084 / 1,269 | zkVM adapters | drop | Research; `require` strings |
| `OnchainRenderer` | 10,463 | Animated SVG + JSON fallback renderer | adapt | Usable as the still-image fallback when the app cannot load |
| `OmnichainWitnessRegistry` | 2,242 | Cross-chain state witness store | drop | Collection stores it but never calls it |

### 3.2 `interfaces/`, `lib/`

| Item | Verdict | Reason |
|---|---|---|
| `interfaces/Interfaces.sol` (`OrganismRenderData` 17-field struct, `IOrganismCollection`, `ISovereignAccountControl`, …) | adapt | Replace organism fields with the unified token's render data |
| `lib/Administrated.sol` (two-step owner, custom errors) | reuse-verbatim | 39 lines, correct |
| `lib/Base64.sol`, `lib/Strings.sol`, `lib/Crypto.sol` (`ECDSA.tryRecover` low-s, `SignatureChecker` EOA-or-1271) | reuse-verbatim | Standard, audited patterns |

### 3.3 `protocol/` — the sealed Genesis stack

| Contract | Bytes | Role | Verdict | Reason |
|---|---:|---|---|---|
| `ProtocolPrimitives.sol` (`ProtocolAssets`, `ProtocolGuard`, `IWorldLedger`) | lib | Exact-delta `pull`/`push` (rejects fee-on-transfer), `approveExact`, `nonReentrant`, `_identity`, `uint112` amounts | reuse-verbatim | The settlement discipline every module needs |
| `GenesisToken` | 1,676 | Fixed-supply ERC-20, no owner/mint/tax | reuse-verbatim | Add EIP-2612 if wanted |
| `GenesisLaunchpad` | 12,964 | Pro-rata batch sale: immutable terms, refundable failure, ≥50 % of raise to permanent LP at matched price, founder vest + treasury lock in `TimeVault`, activity records | adapt | The community-sale core; contributions keyed by `msg.sender`, no tiers; pair with the auction |
| `NativeMarket` | 5,344 | x·y=k ETH-paired market for launchpad tokens, 30 bps, 1-2 hops, swap-and-lock | adapt | Always-available fallback swap; no LP tokens, no liquidity add/remove |
| `TimeVault` | 6,517 | Fixed-beneficiary cliff/linear locks, pull release, `extend` forward only, `liability[asset]`, `accountCommitment` | reuse-verbatim / light adapt | The vault; only the `ledger.record` dependency needs a decision |
| `VestedExitVault` | 8,199 | Funded, fixed-recipient sell schedules through the reviewed market | adapt (optional) | DCA-out feature; permissionless `executeSlice` means no keeper is strictly required |
| `WorldLedger` | 14,233 | Public rooms, posts (≤1,024 B in storage + event), reactions, profiles, follow/block, consent-epoch membership/moderation, protocol activity feed, sealed module roster | adapt | The public social layer; consider events-only bodies for cost; keep the epoch-consent model and `postWithReceipt` |
| `AppChunk` / `OnchainApp` | 57 / 1,027 | STOP-prefixed data contract (≤23,000 B); ≤64-chunk archive with constructor SHA-256 check | reuse-verbatim | Proven; `require` strings could become custom errors |
| `OnchainAppDirectory` | 2,333 | ≤16 leaves × 32 chunks, codehash + metadata pinning | reuse-verbatim | |
| `OnchainModuleDirectory` | 1,152 | ≤32 versioned feature archives, dependency versions, root commitment excluding addresses | reuse-verbatim | Mirrored byte-for-byte by the loader's JS |
| `ShardedResource` | 1,244 | Gzip resource across ≤64 archives | adapt | Generic large-asset directory even if RAILGUN is dropped |

### 3.4 `confluence/`

| Contract | Bytes | Role | Verdict | Reason |
|---|---:|---|---|---|
| `ConfluenceRenderer` | 14,772 | `tokenURI` producer; deploys the loader `AppChunk` in its constructor; `_boot` prefixes `AWE_CHAIN_IDENTITY` | adapt | The "NFT mints a website" mechanism; regenerate for the new identity fields; drop `GenesisSVG` dependency if art changes |
| `ConfluenceLoader` (generated from `web/confluence/chain-loader.mjs` + `module-loader.mjs`, 15,582 source bytes) | lib | Loader HTML as a string constant | adapt (regenerate) | Selectors are hard-coded; regenerate from the unified ABI |
| `GenesisSVG` | lib | Deterministic "blue body" portrait | adapt / drop | Art decision |
| `GenesisManifest` | 965 | Publish-once six-address service directory per collection | adapt | Generalise to a named service directory |
| `ArtifactBinding` | 1,031 | `artifactIdOfAccount`/`ownerOf`/`ownershipEpoch` adapter | reuse-verbatim | |
| `CartridgeRegistry` | 6,808 | Legacy single-blob cartridge ERC-721 | drop | Superseded by `ChunkedCartridgeRegistry` |
| `CommissionedCartridges` | 3,244 | Escrowed work → frozen cartridge | drop | Depends on `CommissionEscrow` |
| `fees/OwnerFeeRouter` | 7,586 | Immediate-attribution fee splitter, ≤64 recipients, irrevocable `commitSplit`, converter allowlist | adapt | Creator-fee splitter for launches; loop cost scales with recipients |
| `fees/OwnerLaunchFactory` / `OwnerLaunchToken` | 4,158 / 1,698 | Permissionless fixed-supply token launches with hook/pool commitment metadata | adapt | Token factory |
| `vendor/solady` `ERC721`, `Base64` | — | Used by the two cartridge registries | reuse-verbatim | |
| `vendor/solady` `ERC1155`, `ReentrancyGuard`, `SafeTransferLib`, `SignatureCheckerLib` | — | Compiled but imported by nothing | drop | Dead vendored code |

### 3.5 `memory/`

| Contract | Bytes | Role | Verdict | Reason |
|---|---:|---|---|---|
| `MemoryLedger` | 7,243 | Append-only public-or-encrypted journal (≤32,768 B), canonical `head` per identity, former-author `reflectionHead`, journaled swaps, `formRoot` experience traces | adapt | Notes inside the NFT; drop `formRoot`/artwork coupling if not wanted |
| `JournalSwapRouter` | 4,392 | Atomic before-note → exact swap → measured fill binding | adapt | Keeps the fill bound to the note; works with any market sharing the `swap` ABI |

### 3.6 `modules/` — v7

| Contract | Bytes | Role | Verdict | Reason |
|---|---:|---|---|---|
| `ModuleTypes` | lib | `Archive`, `ReleaseInput`, `Release` structs | reuse-verbatim | |
| `ModuleArchiveFactory` | 8,251 | Permissionless CREATE of `OnchainApp`/`OnchainAppDirectory`; `validateArchive` only accepts factory-made readers | adapt | Switch to CREATE2 with content-derived salt to remove the shared-nonce race |
| `ExtensionReleaseRegistry` | 5,922 | Immutable publisher-namespaced releases, sorted exact deps/caps, manifest ≤16 KiB | adapt | |
| `TokenModuleRegistry` | 8,084 | Per-NFT install/state selection with `StaleReview` protection, history hash chain, independent state catalog | adapt | Port `_authorize` to ERC-6551 `token()` + epoch |
| `ModuleStateStore` | 4,951 | Append-only snapshots as `AppChunk` code (≤32 KiB) or archive descriptors | adapt | Gas-measured; registry is the only writer |
| `ModuleWorkbench` | 1,800 | Immutable anchor + `services()` for the second recoverable document | adapt | The pattern for any dapp-specific recoverable page |
| `ChunkedCartridgeRegistry` | 10,969 | ERC-721 of ≤1 MiB HTML editions, `acquire` to `msg.sender`, `contentOf` re-verifies codehash + sha, `launchManifest` authorised = parent NFT owner | adapt | Merge into the module registry rather than keep a second ERC-721 |

### 3.7 `kingdom/` — Uniswap v4 and estate sale

| Contract | Bytes | Role | Verdict | Reason |
|---|---:|---|---|---|
| `V4Boundary.sol` | lib | Self-contained `PoolKey`/`IV4PoolManager` subset reviewed against v4-core `d153b04` | reuse-verbatim (re-review) | Avoids tracking a moving dependency |
| `PhoenixLaunchHook` | 3,300 | Committed init price, fee ramp 1.00 % → 0.30 % over 1 day, seed principal lock that still allows fee pokes, `economicRoot` | adapt | Needs a mined hook address (`HookDeployer`, `npm run hook:mine`) |
| `HookDeployer` | 464 | CREATE2 helper | reuse-verbatim | |
| `V4GenesisMarket` | 11,453 | Real PoolManager market with the same `seed/swap` ABI as `NativeMarket`; full-range LP, callback commitment hash, permissionless `harvest` to creator | adapt | The production swap/liquidity path when a PoolManager exists on the target chain |
| `EstateExchange` | 14,847 | Sell the NFT under a declared-inventory covenant, escrowed, re-verified before and after transfer, royalty, pull proceeds | adapt (optional) | A marketplace that sells the account's contents honestly; ABI-coupled to `TimeVault.lockInfo` returndata length |

### 3.8 `operating/`, `instruments/`

| Contract | Bytes | Verdict | Reason |
|---|---:|---|---|
| `ExperimentGate` | 549 | drop | Chain-allowlisted (31337/84532/11155111) switch; structurally mainnet-disabled |
| `ExperimentCell` / `ExperimentCellFactory` | 10,545 / 12,040 | drop | Isolated side-account for experiments |
| `ReceiverPinnedStrategy` / `FixedBasket` / `MatchedRightsVault` | 3,351 / 6,120 / 3,176 | drop | Experimental DeFi |
| `FixedTermCredit` / `CoveredCallBook` | 5,520 / 5,076 | drop | Out of GOAL |
| `BondedShelf`, `CommissionEscrow`, `EditionRegistry` | 4,284 / 4,950 / 3,637 | drop | Out of GOAL |
| `CommitmentIndex` | 1,531 | drop (idea: adapt) | The "fold every module's `accountCommitment`" idea is worth keeping for an estate sale |
| `InstrumentRouter` | 3,404 | adapt | "Lock exact asset" / "swap exact input and lock the result" — the two recipes the vault UI needs |
| `instruments/ConsentGiftRouter` | 6,426 | adapt | Revocable-until-accepted gift that becomes a `TimeVault` claim on an NFT account — a social-plus-vault feature |

### 3.9 `extensions/`

| Family | Contract | Bytes | Verdict | Reason |
|---|---|---:|---|---|
| access | `GenesisNames` | 4,254 | adapt (optional) | ENS subname `anima-<id>` resolving to the NFT account; avatar text record |
| access | `NamedMintSession` / `NamedMintFactory` | 1,663 / 2,611 | drop | Atomic mint+name convenience |
| access | `SessionSponsor` | 4,812 | drop (optional) | Native gas sponsorship, "not an ERC-4337 paymaster" |
| agents | `AgentCommerce` | 4,970 | drop | ERC-8183 draft lifecycle |
| agents | `AgentPolicyGuard` | 6,749 | optional | Scheduled use of an existing account grant — keeper/automation hook if ever wanted |
| agents | `ProviderDirectory` | 5,291 | drop | Signed provider records |
| crosschain | `LayerZeroInterfaces`, `AnimaOFTSource`, `AnimaOFTComposer` | —, 6,331, 7,692 | drop | ERC-20 OFT lane; single-chain GOAL |
| experimental | `ExperimentalLedger`, `House`, `HouseFeedRatio`, `HouseNativeMarketVenue`, `Wager`, `Wake`, `WakeExitTask` | 10,956 / 2,056 / 2,210 / 12,652 / 8,296 / 1,765 | drop | Testnet-gated; `Wake` is a clean keeper-seat primitive if a scheduler is ever needed |
| governance | `OperatingNFTGovernance` / `OperatingVotingShares` | 24,192 / 2,828 | drop | 384 B of headroom; fractional custody is out of GOAL |
| launch | `LaunchRegistry` | 4,903 | adapt | Append-only launch provenance bound to the payer's owner/epoch |
| launch | `LaunchAllocationComposer` | 6,248 | adapt | One-call v4 launch + vested allocations + record |
| launch | `NFTAuctionFactory` | 10,227 | adapt | CREATE2 auction per seller with `predict` |
| markets | `ContinuousClearingAuction` | 7,900 | adapt | 64-slot streaming uniform-price auction |
| markets | `PublicGoodsMatching` | 4,949 | drop | QF with frozen registrar list |
| markets | `WholeNFTShares` | 8,500 | drop (optional) | Fractionalisation |
| privacy | `PrivacyKeys` | 1,271 | adapt | P-256 public keys with generation counter — the key directory any E2E chat needs |
| privacy | `EpochGroupChat` | 7,031 | adapt | Custom sender-key group chat ≤32 members; frozen on key rotation |
| privacy | `MLSGroupChat` | 10,124 | adapt | RFC 9420 transport: ordered delivery, consent, roster commits |
| privacy | `PrivateMemoryHandover` | 5,966 | optional | Recipient-confirmed encrypted handover atomic with ERC-721 transfer |
| privacy | `AuthenticatedStatePortal` | 12,824 | drop | Read-only LayerZero OApp |
| proof | `NativeQuoteGroth16Verifier` / `NativeQuoteRehearsal` | 2,561 / 5,202 | drop | Dev trusted setup |
| strategies | `V4SettlementConverter` | 3,942 | adapt | `ISettlementConverter` over a v4 pool for the fee router |
| strategies | `V4ScheduledExit` / `V4FeeCompounder` | 8,915 / 6,840 | drop / optional | Keeper-driven |

### 3.10 `integrations/` (vendored, out of the contracts reader's area; inventoried from source here)

| Contract | File | Verdict | Reason |
|---|---|---|---|
Sizes here are from `integrations/console/protocol/v4-hook/artifacts/build-summary.json` (solc 0.8.26, cancun, 200 runs).

| Contract | File | Bytes | Verdict | Reason |
|---|---|---:|---|---|
| `GenesisV4Launchpad` (+ `GenesisFixedToken` 1,554 B, `GenesisV4Position` 15,143 B, `GenesisPayment`) | `integrations/console/protocol/v4-hook/src/GenesisV4Launchpad.sol` (332 lines, imports `@uniswap/v4-core`) | 21,978 | adapt (near-verbatim) | One `launch(Terms)`: CREATE2 fixed token + `GenesisV4Position`, `manager.initialize`, seed liquidity, return unused supply; position = transferable ERC-20 LP shares ("Anima v4 Liquidity"/"ANIMA-LP") with `collectFees`, `redeem`, `addLiquidity`, `reinvestFees`, "no admin or sweep"; `require` strings `TERMS/BUSY/PAIR` |
| `GenesisV4HookLaunchpad` | same dir (56 lines) | 22,376 | adapt | Same with an explicit hook in the deterministic namespace; checks `(hooks & 0x3fff) == 0xc8` and `poolManager()` |
| `GenesisV4Router` | same dir (38 lines) | 3,346 | adapt (near-verbatim) | "ERC20 exact-input v4 swaps, with bounded output, deadline and full-fill enforcement … No owner, NFT identity, ledger, persistent approval or public recipient argument." |
| `OwnerV4FeeHook` | same dir (220 lines) | 6,607 | adapt | `beforeSwap` (exact input, `hookData = abi.encode(uint24 maxFee, uint64 deadline)`, fee minted as ERC-6909 claims, return delta offsets it), `afterSwap` reverts `PartialFillUnsupported`, `flush` only to the recorded recipient, `commitPolicy` irrevocable ceiling; two-step owner |
| `HookCreate2Factory` | same dir (17 lines) | 480 | reuse-verbatim | |
| `OwnerFeeRouter`, `OwnerLaunchFactory`, `ISettlementConverter` | `integrations/console/protocol/fee-router/src/` (0.8.24, Shanghai) | — | see §3.4 | Source twins of `contracts/src/confluence/fees/*` |
| `ArtifactAccount` + `AWEArtifact` | `runtime-contracts/src/AWEArtifact.sol` (142 lines) | — | drop (keep idea) | Earlier "NFT-owned account … not an ERC-6551 implementation", deployed with `new`; its epoch-bound ERC-1271 digest `keccak(AWE_ARTIFACT_SIGNATURE_V1, chainid, this, ownershipEpoch(), hash)` is worth keeping |
| `CartridgeRegistry` (24,576-byte single-slot) / `CreatorItems` (ERC-1155 editions with buyer-pinned token/revision/price) | `runtime-contracts/src/` | — | drop / adapt if item sales wanted | Superseded by `ChunkedCartridgeRegistry` |
| `PrismRelay` | `onchain-game/contracts/PrismRelay.sol` (175 lines) | — | reuse-verbatim (example cartridge) | "No owner, upgrades, fees, stakes, token minting or automated rewards… No server signs or decides the outcome." |
| `EvmAdapter` (`chain-adapters/src/evm.ts`), `v4-position-encoder.mjs` (`console/lib`) | TypeScript / JS | — | adapt / reuse-verbatim | The adapter already prepares the canonical ERC-6551 `execute(address,uint256,bytes,uint8)` shape; the encoder builds PositionManager mint/settle/sweep calldata |
| `console-api.ts` | `console/lib` | — | drop | An off-chain D1/R2 server requiring an OAuth header |
| `OfficialCCALauncher`, `OfficialCreate2`, `OfficialLaunchToken`, `OfficialV4QuoteLens`, `OfficialV4SwapRouter` | `integrations/official-launch/src/` | — | drop (optional later) | Periphery over pinned Uniswap CCA v2.1.0 (`a56d422…`), Liquidity Launcher and Doppler (`5754c7e…`, **BUSL-1.1**); 537 retained upstream files |
| `integrations/dave/*` (50 Foundry files, never compiled here), `integrations/github/*` (364 donor copies) | — | drop | The unified program reads the live sibling repositories |
| `mocks/*`, `test/` harness contracts | — | rewrite | Test-only |

### 3.11 Off-chain modules and web surfaces

| Module | Verdict | Reason |
|---|---|---|
| `web/confluence/chain-loader.mjs` + `module-loader.mjs`; `packages/modules/core.mjs`, `hash.mjs` | reuse-verbatim (regenerate selectors) | Dependency-free SHA-256, pinned-block recovery, import maps; canonical manifests, bounded gunzip, chunk dedupe |
| `scripts/lib/runtime-modules.mjs`, `archive-confluence.mjs`, `verify-confluence.mjs`; `packages/modules/chain.mjs`, `deployment.mjs`, recovery CLIs | adapt | Modular-gzip feature archives with per-group versioning and round-trip checks; ERC-6551 ABIs replace the custom account ABI |
| `web/confluence/wallet.mjs`, `minted-identity.mjs`, `web/launchpad/account-session.mjs`, `chain.mjs`, `web/modules/adapter.mjs` | adapt | The ownership gate, bytecode pinning and receipt discipline (§4.2, §7) |
| `web/modules/host.mjs`, `html-worker.mjs`, `runtime.mjs`, `app.mjs` | adapt | Capability bridge, worker sandbox, typed scenes, migration UI |
| `web/confluence/app.js`, `shell.html`, `web/v4/desk.mjs`, `web/launchpad/desk.mjs`, `web/genesis/atlas.mjs` | rewrite | Shells and routers tied to this visual identity and to EOA signing; keep the lock-everything-on-invalidate and review-dialog patterns |
| `web/genesis/live-desk.mjs`/`live-protocol.mjs`, `web/commons/mls-*.mjs`, `web/memory/*`, `web/launchpad/{hook-client,links,participant,lifecycle,sale,auction}*.mjs`, `web/v4/client.mjs`, `math.mjs` | adapt / reuse-verbatim | The four GOAL surfaces and their clients; `hook-client`, `links`, `normalizeRuntime` and `math` are verbatim |
| `web/commons/desk.mjs` + `client.mjs` (EpochGroupChat), `web/extensions/privacy/*`, `web/burners`, `web/workshop`, `web/worlds`, `web/app.js` (1.2 client) | drop | Legacy or out of scope; keep `web/evm.mjs`'s encoder |
| `packages/communication` | adapt | MLS over on-chain transport with AAD = chain coordinates |
| `packages/privacy`, `packages/crosschain`, `packages/rehearsal-proof`, `proof-kernel/`, `agent/*`, `worlds/` | drop (patterns only) | External services or research; keep SIWE-plus-epoch and the x402 exact flow as ideas |
| `render/*` (C → Wasm 9,794 B and GLSL from one source) | adapt | Deterministic identity → art with CPU/GPU parity tests |
| `scripts/compile.mjs`, `validate-release.mjs` + `lib/local-validation.mjs`, `test-all.mjs`, `static-audit.mjs`, `check-source.mjs`, `source-manifest.mjs` | reuse-verbatim | Best build/validation gate in the four repos |
| `scripts/sepolia.mjs`, `genesis-deployment.mjs`, `modules-deployment.mjs`, `master-local.mjs`, `lib/genesis-stack.mjs`, `lib/modules-stack.mjs` | adapt | Unsigned plans, journals, post-conditions, persistent local chain |
| `scripts/extensions-deployment.mjs`, `genesis-local.mjs`, `Makefile`, ~90 of 115 npm scripts | drop | Superseded or out of scope |
| `system-manifest.json`, `SOURCE-SHA256.json`, `packaging.json`, `docs/CAPABILITIES.md` generator | adapt (practice) | Release-integrity inventory and a generated capability table with an "actual boundary" column |

---

## 4. How the website is delivered and how ownership is verified

(`master-web.md` was absent; this section is from `contracts/src/confluence/*`, `web/confluence/*`, `web/modules/*`, `index.html`, `scripts/serve-confluence.mjs`, and the two readers that covered the loader.)

### 4.1 Delivery: `tokenURI` ships a verifier, not the app

1. `IDontFuckingBelieveIt.tokenURI(id)` delegates to `ConfluenceRenderer.render(collection, id)` (`ConfluenceRenderer.sol:48-53`), which returns `data:application/json;base64,…` with `name` "Anima Genesis #id", `image` = base64 SVG from `GenesisSVG`, `animation_url` = `data:text/html;base64,<boot>`, and attributes `Origin seed` and `Runtime SHA-256`.
2. `<boot>` (`_boot`, lines 55-77) is `<script>window.AWE_CHAIN_IDENTITY={seed,genome,root,chainId,collection,tokenId,manifest,privacyResource,runtime,sha256,archiveVersion};</script>` followed by a ~15 KB loader HTML copied with `extcodecopy` from an `AppChunk` the renderer's constructor created from `ConfluenceLoader.html()` ("Keeping the recovery program in immutable data avoids embedding its complete executable text in every renderer runtime (EIP-170). No URL or mutable loader."). The boot page contains **no application code** — only the identity and the recovery program; `docs/confluence/ARCHITECTURE.md` explains why: "Embedding the full application twice in tokenURI exceeded practical RPC execution limits; the compact loader avoids that large metadata allocation", and warns that "Marketplace viewers without wallet injection require a CORS-enabled read-only RPC and must permit data-HTML execution." Fixtures still call `tokenURI` with `gasLimit: 90_000_000` (`genesis-stack.mjs:55,64`) because of the base64 work; public RPC `eth_call` caps are a real risk.
3. The loader shows "Unfold my artifact", an optional HTTPS/loopback RPC field and "Reading only. No signature or transaction." It uses `window.ethereum.request` or JSON-RPC `fetch`, requires `eth_chainId == config.chainId`, pins `eth_blockNumber`, reads the `OnchainModuleDirectory` (`moduleCount/shellIndex/moduleAt/dependencyCount/dependencyAt`), validates the directory commitment, recovers every feature archive at the same block via `chunkCount()`/`readChunk(i)`, gunzips with `DecompressionStream` bounded by the committed `expandedBytes`, checks each expanded SHA-256 and `sha256(name) == id`, verifies declared dependencies equal actual imports, builds an import map of `data:text/javascript;base64` modules at marker `__ANIMA_VERIFIED_MODULE_IMPORT_MAP_7A9312__`, and finally `document.open(); document.write(html); document.close()` (`chain-loader.mjs:25-62`, `module-loader.mjs:44-61`). SHA-256 is a dependency-free JS implementation because "SHA-256 works in opaque data URLs, where SubtleCrypto may be unavailable" (`chain-loader.mjs:2`); `window.AWE_CHAIN_RPC` keeps the request function for the app.
4. The Module Workbench is a second 707,014-byte document anchored by `ModuleWorkbench.services()` and recovered the same way (also embedded in the app's `modules@8` feature archive, served as `dist/modules.html`). Cartridges (`ChunkedCartridgeRegistry.contentOf`), module releases and module state (`ModuleStateStore.dataOf`) use the same chunk pattern.
5. Measured: workbench plus 7,952,983-byte application recovered byte-exactly in **6,080 ms** in Chromium against a local provider (`docs/MASTER-BUILD.md:38-40`); Node cold recovery 2,275 ms; sampled JS heap peak 11,830,216 B.
6. There is **no `web3://` / ERC-4804 / ERC-6860 route** (`docs/confluence/research/standards.md:33`: "no manual resolver, raw-path fallback, index route, asset routing, or web3 client integration") and no ENS contenthash. The hosted copy (`index.html` = `dist/index.html`, 477,361 bytes, served by `scripts/serve-confluence.mjs` on `127.0.0.1:4173`) is a development convenience; IPFS is not used anywhere. Recovery is **eager** and RPC-trust-based (the loader pins a block number, the SDK a block hash). The data: origin is opaque — no `localStorage`, `document.write` of ~8 MB, no page-level CSP on the shell — and marketplace iframes without `window.ethereum` show only the "Unfold" page.

### 4.2 Ownership verification: client check plus contract enforcement, no SIWE

- **Reading is open.** Anyone with an RPC unfolds the artifact, reads rooms, launch terms, modules and state.
- **Connect NFT** (`web/confluence/wallet.mjs:47-110`, verified): `assertMintBinding(window.AWE_CHAIN_IDENTITY, collection, tokenId[, chainId])` refuses any collection/token/chain other than the page's own baked identity ("Connect the collection and token belonging to this minted Anima.", `minted-identity.mjs:26-40`); `eth_requestAccounts`; at one pinned block `ownerOf`, `accountOf`, `renderSnapshot`; **`if (owner.toLowerCase() !== address.toLowerCase()) throw Error("This wallet does not own the selected NFT.")`**; the account and each of the six manifest modules must have code. `accountsChanged`/`chainChanged` bump `revision` and invalidate. Service addresses come from `AWE_CHAIN_IDENTITY.manifest → GenesisManifest.modulesOf(collection)`. Every prepared review captures `sessionEpoch()`, and `assertOwner()` re-reads chain, `eth_accounts[0]`, `ownerOf` and `mode()==0` immediately before signing.
- **Workbench** (`web/modules/adapter.mjs:11-22`): additionally `readRegistry` must return `owner == wallet.address` and `currentOwner() == owner` on the account, else "Registry identity or current NFT custody does not match."; `fresh()` re-compares `{chainId, registry, collection, tokenId, account, owner, epoch}` before each send. UI copy: "Connecting checks the current owner, account and custody epoch. It does not install or send anything."
- **Launchpad "Use this NFT account"** (`web/launchpad/account-session.mjs`, `NFTAccountSession.connect`): `ownerOf == signer`, the collection's and the account's **runtime bytecode pinned** to the shipped `IDontFuckingBelieveIt`/`SovereignAccount` artifacts with immutables masked ("Pin the whole executable and require every occurrence of each immutable to agree."), `currentOwner == owner`, `mode == 0`, `sessionEpoch` captured; `wrap(plan)` turns an EOA plan into `executeUtility(nonce, deadline, asset, target, value, data, allowance)` — "No delegate is installed: each call is signed by the current NFT owner." The same bytecode-pinning idiom (`normalizeRuntime`/`verifyContract` in `web/v4/client.mjs`, `verifyHookContract`, `verifyCommonsContract`, `verifyGovernanceContract`, `verifyBridgeContract`) guards every desk: "Verify executable runtime rather than accepting an address merely because it implements the ABI."
- **Plan hygiene** (`wallet.mjs:279-572`): `prepare`/`prepareUtility`/`preparePersonal`/`prepareExternal` populate, `eth_call`, estimate gas and bind the plan to `revision` + `sessionEpoch`; `assertReviewContext` re-checks before signing; `send()` refuses plans older than 300,000 ms, applies `gasLimit × 1.2` and parses receipt logs. `ANIMA_SIM_SAMPLE` disables mint binding and must never be set in a shipped build.
- **Chain enforcement.** Nothing trusts the UI. Every write is a transaction from the owner EOA into `SovereignAccount.execute/executeUtility` (or `executeInstrument` by a grantee), where `onlyController` is `msg.sender == IERC721Control(collection).ownerOf(tokenId)` (`SovereignAccount.sol:504-506`); peripheral contracts check `collection.accountOf(identity) == msg.sender` (`ProtocolGuard._identity`); `TokenModuleRegistry._authorize` adds `currentOwner()==ownerOf` and the `sessionEpoch`; `ChunkedCartridgeRegistry.launchManifest(id, player)` returns `authorized = player == ownerOf(parent)` and must be "re-read at launch".
- **"Authorised by the holder."** At contract level: token approval/operator for *transfer only*; exact-calldata **instrument grants** (`grantAction`: target with code, `dataHash`, one asset, `perCall`/`budget` measured as net debit by balance difference, `expires ≤ 30 d`, `maxCalls 1..100`, epoch) usable by a named caller through `executeInstrument`; `AgentPolicyGuard` schedules such a grant; `SessionSponsor` relays one with gas refund. The browser recipes, however, require the exact owner in Bound mode. ERC-4907 `userOf` is decorative (never grants account authority). Off-chain services (the dropped `agent/worlds` server) use SIWE-style sign-in bound to `anima:nft:<chain>:<collection>:<tokenId>:epoch:<sessionEpoch>` re-resolved on every request — the right pattern if any gateway is ever needed.
- **What is actually gated — the gap that matters for the GOAL.** Only the **Live desk** (NativeMarket / TimeVault / MemoryLedger / WorldLedger through `prepareUtility`/`preparePersonal`), the **Module Workbench**, **cartridges**, the **Workshop** and the Launchpad's opt-in **"Use this NFT account"** funding mode run through the NFT account. The **Swap destination (`web/v4/desk.mjs`) has no NFT check at all**: it signs with a RAILGUN shielded wallet by default (`this.private = true`; "Public signing is never used as a fallback.") or an injected public wallet. **Commons/MLS, Governance, Crosschain, Lifecycle and the Launchpad's default "Use wallet funds" mode sign with `LaunchChain`'s EOA**, and the Commons desk says so by design ("Encryption keys belong to your wallet; selling an NFT does not transfer your private history."). The Participant page (`web/launchpad/participant.mjs`) is explicitly for people with no NFT. So "mint → everything inside the NFT" is true for the Live desk and the module system, and only partially true elsewhere; the unified protocol must make the NFT account the default signer everywhere.

---

## 5. Swap (including the privacy route)

The app has **two swap surfaces** and the contracts have **three swap implementations** that share one ABI shape.

### 5.1 In the app

- The **Swap** door (`capabilities.mjs`: "Exchange assets with an explicit privacy choice", route `trade → v4`) opens `web/v4/desk.mjs`, which targets Uniswap v4 on **Ethereum 1, Arbitrum 42161, Polygon 137** (`V4_NETWORKS`, `web/v4/client.mjs:34-48`, official PoolManager/Quoter addresses) through the vendored `GenesisV4Launchpad`/`GenesisV4Router` and `OwnerV4FeeHook` artifacts (`hookedSwapPlan`, `verifyHookContract` from `web/launchpad/hook-client.mjs`). The desk has a **"Private execution"** checkbox (`desk.mjs:234`, **on by default**: `this.private = true`, POI aggregator `https://ppoi.fdi.network`) and a "Private wallet" tab backed by `PrivateVault` (`web/privacy/vault.mjs`, `anima.encrypted-private-wallet/1`, PBKDF2 600,000, AES-256-GCM, Web Locks): private mode has **no public fallback** ("Never silently falls back to public execution", `docs/CAPABILITIES.md`); the desk locks on `visibilitychange`, after 5 minutes idle and on Ctrl+Shift+L, and `onLock` locks every other desk and disconnects the NFT wallet. **This desk performs no NFT ownership check** — the swap is signed by the shielded wallet or the injected EOA, never by the token's account (see §4.2).
- The **Live** desk (`web/genesis/live-desk.mjs`, tabs Swap · Lock · Release · Memory · Commons) drives the sealed `NativeMarket` through the NFT account: "This NativeMarket route records your NFT identity publicly. Choose the v4 exchange for shielded swaps." Every action is "simulated, reviewed and confirmed in your wallet", optionally rehearsed on a disposable fork (`RehearsalClient`).

### 5.2 `NativeMarket` (v1, `contracts/src/protocol/NativeMarket.sol`, 5,344 B)

"Exact-input native-token markets for fixed-supply tokens created by THIS launchpad. Experimental constant-product market, NOT Uniswap v4 … Native liquidity and token reserves have no withdrawal/admin path. Fees remain in reserves." `FEE_BPS = 30`; `seed(token, amount, launchId)` by the launchpad only, once per token; `quote(...) → (output, spotOutput, hops)`; `swap(tokenIn, tokenOut, uint112 amount, uint112 minOut, uint48 deadline, uint256 identity, uint64 lockUntil)` — one or two hops via ETH, and **if `lockUntil != 0` the output goes straight into `TimeVault.depositFromProtocol` for the caller** (swap-and-lock); records activity kind 5. No LP tokens, no add/remove liquidity, ETH pairs only, no TWAP. Tests: `test/exit/contracts.test.mjs`, `test/genesis/live-protocol.test.mjs`.

### 5.3 `V4GenesisMarket` + `PhoenixLaunchHook` (v2, `contracts/src/kingdom/`, 11,453 + 3,300 B)

"Actual v4 PoolManager integration source; not a renamed constant-product AMM. ONLY this launchpad's native/ERC20 pairs; exact input must fill completely or revert. Seed principal and rounding dust have no withdrawal path. Earned LP fees can be harvested permissionlessly to the launch creator." Drop-in `seed/swap` ABI; `installHook` once before sealing; `keyFor(token) = PoolKey(native, token, DYNAMIC_FEE, tickSpacing 60, hook)`; integer-sqrt `sqrtPriceX96`, full-range liquidity with salt = launchId ("omitting the finite-bound correction UNDERfills, never overdraws"); `_unlock` accepts exactly one expected callback payload; ops seed / swap (`PartialFill` if debit ≠ amount) / harvest. The hook (`HOOK_FLAGS = 0x22c0`): committed init price, fee ramp 1.00 % → 0.30 % over one day, `beforeRemoveLiquidity` blocks only the market's negative deltas ("otherwise fee harvesting would be bricked"), `afterSwap` appends an `economicRoot`; "sender is a ROUTER, never assumed to be the end user." Needs a mined address. Tests: 11 Anvil "official-launch" tests, `test/launchpad/private-range.integration.test.mjs`.

### 5.4 `GenesisV4Router` + `OwnerV4FeeHook` (vendored, `integrations/console/protocol/v4-hook/src/`)

`GenesisV4Router.swap(PoolKey, zeroForOne, uint128 amountIn, uint128 minimumOut, uint160 priceLimit, deadline, hookData)` — ERC-20 exact input, output always to the caller, full-fill or revert, no state beyond a reentrancy flag. `OwnerV4FeeHook` — `beforeSwap` requires exact input and `hookData = abi.encode(uint24 maximumFee, uint64 deadline)` with `feePpm <= maximumFee` (a per-swap fee quote the trader consents to), mints the fee to itself as ERC-6909 claims and returns an offsetting `BeforeSwapDelta`; `afterSwap` reverts `PartialFillUnsupported` unless the pool consumed exactly `grossInput − fee`; `flush` forwards a claim only to its recorded recipient, optionally into `OwnerFeeRouter`; `commitPolicy(maximumFee, fixedRecipient, viaSplitter, exactFee)` is an irrevocable ceiling — until it is called with `exactFee`, the two-step owner can still raise the fee up to that maximum. The browser (`web/launchpad/hook-client.mjs`) mines the CREATE2 hook address itself (`mineHookAddress`, no signing), verifies the hook runtime and flags, and builds `hookedSwapPlan`/`hookedLaunchPlan`. Verified against the unmodified official PoolManager (`46c6834…`) in nine Anvil scenarios.

### 5.5 Routers that compose the swap

`JournalSwapRouter.swapAndInscribe(Order, payload)` (account-only, nonce, `plan` hash, asserts `received == quoted`, no stray lock, custody unchanged, then `MemoryLedger.bindFill`) — a swap whose fill is bound to a note. `InstrumentRouter.swapAndLock(input, output, amount, minimum, duration ≤ 3650 d, deadline)`. `VestedExitVault` sells slices through `market.swap` with exact balance accounting. `ConsentGiftRouter.offer` optionally swaps then escrows. All of these only require the shared `swap(...)` ABI, so the constant-product and v4 markets are interchangeable behind them.

### 5.6 The privacy route (RAILGUN) — and why it is dropped

`packages/privacy` bundles `@railgun-community/wallet 10.9.0`, engine 9.6.0, `snarkjs 0.7.6` and a Waku broadcaster client into a 15,112,663-byte worker, stored on chain gzip-compressed (4,596,329 B, 7 shards, 200 chunks) and recovered lazily by `web/privacy/recover-resource.mjs` against the edition's pinned `PRIVACY_RUNTIME.sha256`. `runtime.mjs` builds a RelayAdapt multicall of shield → swap/launch → re-shield, proves twice, finds a Waku broadcaster and waits two confirmations; the wallet DB lives only in worker RAM. Scope is stated honestly: mainnets 1/42161/137 only, "No … funded RAILGUN end-to-end transaction has been performed", 51 advisories in the dependency tree. For the GOAL it contradicts "no external dependency" (POI aggregator, Waku relayers) and adds 15 MB to every edition; keep the **fail-closed privacy switch pattern** and the `ShardedResource` slot, drop the worker.

---

## 6. Messaging and social

### 6.1 `WorldLedger` — the public crypto-social layer (`contracts/src/protocol/WorldLedger.sol`, 14,233 B)

"Entire text, channels, membership, preferences and protocol activity live in EVM state. Public-readable, including member-gated channels. Removal changes FUTURE write access. There is intentionally no claim of encryption, global erasure or Sybil resistance." Room 1 (`WORLD`) is pre-created ("One shared sky. Public, permanent messages."). API: `createRoom(name ≤48, topic ≤256, gated, slow ≤3,600 s, color, identity)`, `setMember`, `setModerator`, `acceptInvitation` ("Invitations are write-access offers, not forced membership or private reading."), `post(room, replyTo, bytes body ≤1,024, identity)` (stored in `Message{…bytes body}` **and** emitted in `MessagePosted`), `postWithReceipt(…, activityId)` (links a message to a recorded trade/lock/launch), `react(id, emoji 0..5)`, `setHidden` ("a presentation flag, never deletion of bytes. World has no global moderator."), `setProfile(alias ≤32, color, flags)`, `setView(who, follow, block)`; `record(kind)` accepted only from the sealed launchpad (1-4), market (5), vault (6-7) and estate exchange (8-10). Consent model: membership and moderator flags store both the grantor's and the recipient's custody epochs and `memberActive` requires both unchanged; "A moderator cannot ban another moderator or change the admin's authority." `_epoch(actor)` staticcalls `sessionEpoch()` only if the actor has code, so EOAs can post too. Cost: ~20k gas per 32 B of body on L1 plus the event. The Live desk exposes the room operations behind an explicit consent checkbox ("I want this text published onchain, where it will be publicly readable.").

### 6.2 Encrypted conversations: `PrivacyKeys` + `EpochGroupChat` (legacy) and `MLSGroupChat` + `packages/communication` (current)

- `PrivacyKeys` (1,271 B): SEC1 P-256 public keys per wallet with a generation counter — the key directory.
- `EpochGroupChat` (7,031 B): "Custom sender-key protocol, NOT RFC9420 MLS." ≤32 members, invitations ≤7 days, manager `rotate` must list the sorted complete roster with key packages 32..2,048 B, `post` (ciphertext 32..8,192 B) is frozen while `dirty` or whenever any member's key generation changed. Not forward secure; "NFT sale does not transfer chat secrets."
- `MLSGroupChat` (10,124 B): "Ordered onchain delivery for RFC 9420 messages. MLS validity is checked by recipients." Key packages 128..4,096 B, groups keyed by bytes32, consent + roster commits ≤32, manager handover, legacy migration pointer. `packages/communication/protocol.mjs` wraps `ts-mls 1.6.4` (ciphersuite `MLS_128_DHKEMP256_AES128GCM_SHA256_P256`, identity = lowercase wallet address, signature key approved against `PrivacyKeys`), `retainKeysForEpochs: 0`, always-pad 256, and — the strongest idea here — **AAD binds every ciphertext to its chain transport coordinates** `["anima.mls.transport/1", chainId, contract, group, index, epoch, sender, kind]` so a replayed or re-ordered message fails authentication; commits must come from the claimed on-chain sender and carry the exact expected roster. Browser bundle `web/commons/mls-protocol.mjs` (150,916 B). Metadata (membership, sender, timing, sizes) is public by design. Both clients ship in the Commons desk (`web/commons/desk.mjs` mounts `MlsCommonsDesk` beside the legacy `CommonsClient`); contract bytecode is verified in the browser against normalized runtime hashes with immutables masked (`verifyCommonsContract`); the MLS client journals pending state in an IndexedDB vault (`anima-mls-v1`) before the wallet request and finalises after 2 confirmations ("MLS state never rolls backwards to handle a reorg"). Two caveats for the GOAL: **the encrypted identity is the EOA, not the NFT** — both desks sign with `LaunchChain`'s wallet, "Encryption keys belong to your wallet; selling an NFT does not transfer your private history" — and there is a **third, older E2EE stack** (`web/extensions/privacy/crypto.mjs`: "Browser-native P-256 ECDH, HKDF-SHA256, AES-256-GCM. This custom protocol is neither HPKE nor MLS.", not forward secure) that should be dropped outright.

### 6.3 Encrypted journals: `MemoryLedger` (7,243 B) + `web/memory/crypto.mjs`

"Append-only PUBLIC storage of explicit public bytes OR client-encrypted bytes. This contract never receives a key… A mode label does not prove the supplied bytes were correctly encrypted. Metadata leaks." `appendPersonal(identity, parent, mode 0 public | 1 encrypted, imprint, expectedHead, payload ≤32,768)` — root entries by the current custodian only; a **former author keeps appending replies into `reflectionHead[identity][author]`** without touching the owner's canonical `head[identity]`; `beforeSwap`/`bindFill` for journaled swaps (`StaleHead` if custody changed). Client side (`web/memory/crypto.mjs`, verified): "Native authenticated encryption only. No homemade cipher or plaintext fallback."; PBKDF2-SHA256 600,000 rounds, AES-GCM, passphrase ≥12 characters, packet ≤16 KiB; "Decryption keys do not transfer automatically with an NFT." `PrivateMemoryHandover` (5,966 B) is the optional recipient-confirmed encrypted delivery atomic with an ERC-721 transfer ("NOT a zero-knowledge/TEE verifier or an ERC-7857 implementation").

### 6.4 Gifts and names

`ConsentGiftRouter` (6,426 B) — "An offer is revocable UNTIL acceptance; acceptance fixes an ordinary TimeVault claim. A recipient NFT account carries the claim across later NFT sales. A personal recipient does not." `GenesisNames` (4,254 B) — ENS subname `anima-<id>` whose `addr` is the NFT account and whose `avatar` text record is `eip155:<chain>/erc721:<collection>/<id>`.

---

## 7. Launchpad

The Launch door ("Launch liquidity, community sales and auctions with your own economics") opens `web/launchpad/desk.mjs` (1,664 lines; tabs create/positions/lifecycle/protocols/strategies/economics/sales/auction/fees/locks/private/settings, grouped as **Create** and **Manage**), driving five mechanisms. Funding defaults to **"Use wallet funds"** (EOA via `LaunchChain`, `web/launchpad/chain.mjs`); **"Use this NFT account"** switches to `NFTAccountSession` so every call is wrapped in `executeUtility`. `LaunchChain`'s discipline is worth copying whole: `reviewNext()` (gas × 1.2, fee data, balance check, fingerprint) → `sendReviewed()` (raw `eth_sendTransaction`) → `finishRecord` (canonical block, `finalized` tag, exactly one `Launched` event matching the predicted token/position) → per-mechanism receipt verifiers → `findReplacement` scans ≤2,048 blocks for a replaced transaction. Launch links (`web/launchpad/links.mjs`, `#launch/(community|auction|pool|record|cca|doppler)/<chainId>/<0x…>`) carry only public identity — "provider credentials and private view settings never travel with a launch" — and the read-only Participant page lets anyone without an NFT contribute via an HTTPS RPC.

### 7.1 Community sale — `GenesisLaunchpad` (12,964 B) + `GenesisToken` + `NativeMarket` + `TimeVault`

"Time-boxed pro-rata batch launches: immutable terms, refundable failure, permissionless settlement, matched-price permanent liquidity, locked treasury and vested founder tokens. This is NOT a continuous clearing auction or a claim of Sybil/MEV resistance." `create(name, symbol, about ≤1,024 B, supply ≥1e18, opens ≤30 d ahead, closes 1 h..30 d after, softCap, hardCap, founderBps ≤2000, liquidityBps 5000..10000, vesting 30..1825 d, identity)` requires `ledger.isSealed()`; allocation `founder = supply·founderBps/1e4`, `public = (supply−founder)·1e4/(1e4+liquidityBps)`, `lp = rest` ("At least half the raise seeds permanent liquidity … no invented price oracle."). `contribute{value}` / `withdrawContribution` while open; `settle` is permissionless: success → `market.seed{value: raised·liquidityBps/1e4}`, founder tokens → `TimeVault` linear vest after a 30-day cliff, treasury ETH → cliff lock to `end`; failure → `claim` refunds; claims pro-rata. Every step is recorded in `WorldLedger` and `create` opens a launch room. Tests: `test/launchpad/sale.integration.test.mjs`, `nft-sale-auction.integration.test.mjs` ("actual minted NFT accounts own community-sale allocations and auction seller/bid/claim rights; transfer invalidates stale reviews"). "Community-sale identity zero deliberately makes no NFT ownership assertion" (`LAUNCHPAD.md:3`).

### 7.2 Direct v4 launches — `GenesisV4Launchpad` / `GenesisV4HookLaunchpad` / `GenesisV4Position` (vendored)

`launch(Terms{name, symbol, supply, quoteToken, tokenBudget, quoteBudget, fee ≤100000, tickSpacing, tickLower, tickUpper, sqrtPriceX96, liquidity, deadline, salt})` in one transaction: CREATE2 `GenesisFixedToken`, CREATE2 `GenesisV4Position(manager, key, range)`, move `tokenBudget` and pull `quoteBudget` into the position, `manager.initialize(key, sqrtPriceX96)`, `position.seed(liquidity, msg.sender)`, return `supply − tokenBudget` to the payer; `predict` gives both addresses beforehand. The position is an ERC-20 of LP shares over an immutable pool and range with `collectFees` (fee-only, principal preserved), `redeem(shares, min0, min1, deadline)`, `addLiquidity`, `reinvestFees`, `previewRedeem`; "LP shares carry their proportional uncollected fees when transferred" (`RELEASE-6.2.md`). The hook variant puts the chosen hook in the deterministic namespace and "only checks manager/permission compatibility; on-chain callers must independently trust their chosen hook." Supported UI networks 1/42161/137; the browser verifies deployed factory/router/hook runtime "against normalized runtime fingerprints from the pinned source" (`runtime-immutables.test.mjs`: "factory, hook and community public verifiers reject forged copies before any reassuring getter can run").

### 7.3 Streaming auction — `ContinuousClearingAuction` (7,900 B) + `NFTAuctionFactory` (10,227 B)

"ANIMA's bounded, streaming uniform-price auction; this is not Uniswap's CCA implementation. Each checkpoint clears cumulative released lots against standing quantity-limit orders. New bids and cancellations checkpoint first, so they cannot change already elapsed allocations." Immutable `seller, saleToken, lotSize, totalLots, startBlock, endBlock, reservePrice`; `fund()`; `releasedLots()` linear per block; `bid(lots, limitPrice){value}` into one of **64 fixed bid slots**; `cancel(slot, expectedSequence)` after checkpoint; `checkpoint()` insertion-sorted clearing at the marginal limit price; `cancelBeforeStart`; pull `claimTokens/claimRefund/claimProceeds`. The factory CREATE2s one per seller with `predict`. Tests `test/extensions/markets.test.mjs` (F01) and the launchpad auction suites.

### 7.4 Composition, provenance, fee streams

- `LaunchAllocationComposer` (6,248 B): one call = v4 factory launch + direct or vested allocations through `TimeVault` + `LaunchRegistry` record; "failed compose leaves no partial state". `LaunchRegistry` (4,903 B): append-only provenance; registrar authorisation bound to the payer's `currentOwner/sessionEpoch`.
- `OwnerFeeRouter` (7,586 B): "Owner-defined fee allocation with earned, independently withdrawable claims. … A later split change cannot rewrite claims." ≤64 recipients, `commitSplit()` irrevocable, converter allowlist (`V4SettlementConverter`), exact conservation with dust to the last recipient. `OwnerV4FeeHook` is the per-pool creator fee that flushes into it; `V4FeeCompounder`/`V4ScheduledExit` are keeper-driven extras.
- `OwnerLaunchFactory`/`OwnerLaunchToken`: permissionless fixed-supply tokens with a recorded hook/pool commitment ("metadata, NOT proof that a v4 pool exists").
- `integrations/official-launch`: pinned Uniswap CCA v2.1.0, Liquidity Launcher and Doppler with a full lifecycle test and conserved economic scenarios — reference only, blocked for production by Doppler's BUSL-1.1 terms and by size.

### 7.5 Launch-related hooks summary

`PhoenixLaunchHook` (fee ramp, seed-principal lock, economic root) is the ANIMA-native hook for the sealed market; `OwnerV4FeeHook` is the configurable creator-fee hook for owner-created pools; both are real `beforeSwap/afterSwap` hooks against the unmodified PoolManager, both need CREATE2-mined addresses (`HookDeployer`, `HookCreate2Factory`), and neither takes custody or exposes an admin fee setter after commitment.

---

## 8. Vault and accounts

### 8.1 `TimeVault` (6,517 B) — the vault

"Fixed-beneficiary native/ERC20 cliff locks and linear vesting. No admin or early exit. Beneficiary=NFT account makes the right follow that NFT. Selling the NFT can sell the right, but cannot accelerate this contract's release schedule. Rebasing assets are unsupported." `deposit(asset, uint112 amount, beneficiary, start, cliff, end ≤ now+3650 d, linear, identity){value}`; `depositFromProtocol(...)` from the sealed market/launchpad only; `release(id)` — "Anyone can trigger release; the recipient is ALWAYS the committed beneficiary."; `extend(id, newEnd)` forward only; `liability[asset]` and `accountCommitment[beneficiary]` (rolling hash of every lock touch, folded into estate snapshots). The Live desk's **Lock** and **Release** tabs are this contract; the Vault door resolves to the same desk.

### 8.2 Scheduled exits and gifts

`VestedExitVault` (8,199 B): the NFT account funds a plan of ≤64 slices `{due 60 s..3650 d, expires ≤ due+365 d, input amount, min out}`; `executeSlice` is permissionless when eligible, calls `market.swap(..., identity 0, lockUntil 0)`, asserts exact balance accounting, `lockId == 0` and unchanged custody before and after the push ("market callback cannot change custody or reenter a funded installment"); `control(pause/resume/cancel/reauthorize)`, `recover` returns matured cancelled slices. `ConsentGiftRouter`: offer → accept → `TimeVault` cliff lock (see §6.4). `InstrumentRouter`: lock exact asset, or swap and lock.

### 8.3 The NFT account — `SovereignAccount` (21,506 B)

Bound mode is the wallet inside the NFT: `execute(target, value, data)` (nonce++, audit append); `executeUtility(...)` — "One approved action: exact allowance -> call -> allowance reset, atomically", with a post-call check that `currentOwner()`, `sessionEpoch` and `mode` are unchanged ("A callback cannot transfer the NFT mid-recipe then continue spending its new owner's funds."); `grantAction`/`grantInstrument` + `executeInstrument` by the named caller with `keccak256(data) == dataHash`, `target.codehash` pinned, epoch match, and the spend **measured as `balanceBefore − balanceAfter`** against `perCall` and `remaining`; `adoptInstrument` with a **7-day** delay; `invalidateSessionsOnTransfer()` (collection only, `++sessionEpoch`); ERC-1271 by the owner's signature; `isValidSigner` only for the controller; `onERC721Received` **rejects tokens from its own collection** ("Same-root-collection safe nesting remains disabled until ownership-cycle rules are separately implemented."); `auditRoot` hash chain of every action. Interface shape is ERC-6551-like (`token()`, `state()`) but "deployed by a purpose-built deterministic factory, not the canonical ERC-6551 registry. This is explicit to avoid a false interoperability claim." (`docs/PROTOCOL.md:87-104`). No ERC-4337.

### 8.4 Locks on the token itself

The collection has no lock counter of the Cutting-edge kind; instead `EstateExchange.list` escrows the token itself ("The NFT is escrowed, so its old owner/sessions cannot spend through its account"), refuses listing while an ERC-4907 user is active, and `buy(id, expectedManifest)` re-runs the declared inventory before and after transfer ("Receiver callbacks cannot remove a declared asset during the purchase transaction."), pays `royaltyInfo` and leaves proceeds to pull. Transfers to any sibling account, the collection or the factory revert (`ForbiddenTransferTarget`).

### 8.5 Module state as per-NFT storage

`TokenModuleRegistry` + `ModuleStateStore` give every NFT an append-only, schema-versioned key-value history per installed module (≤32 KiB direct, more via archives), writable only by the NFT account under `expectedRoot`/`expectedEpoch`; `stateModulesOf` is "an independent recovery index" so a staged snapshot whose receipt is lost is still discoverable. This is the closest thing in the four repositories to "the NFT's own saved state", and it is what the Workbench's Journal/History/Migration views operate on.

---

## 9. The 20 most valuable unique ideas to carry forward

1. **Loader-in-an-`AppChunk`, written by the renderer's constructor and `extcodecopy`'d into `tokenURI`** (`contracts/src/confluence/ConfluenceRenderer.sol:43-45,55-77`) — the recovery program costs no EIP-170 runtime bytes and `tokenURI` carries a verifier instead of the app.
2. **Dependency-free SHA-256 in the loader because SubtleCrypto is unavailable in opaque `data:` origins** (`web/confluence/chain-loader.mjs:2`, duplicated in `packages/modules/hash.mjs`).
3. **STOP-prefixed data contracts with constructor-verified archives** (`contracts/src/protocol/OnchainApp.sol:5-40`: `0x00 ++ payload`, ≤23,000 B, `sha256(full) == expectedSha` in the constructor) and codehash-pinned directories (`OnchainAppDirectory.sol:17-79`).
4. **Schema-3 functional feature archives**: 20 independently gzip-compressed, independently versioned archives under an `OnchainModuleDirectory` whose root commitment excludes addresses so unchanged features are reused byte-for-byte across editions (`OnchainModuleDirectory.sol:14-64`, `scripts/lib/runtime-modules.mjs:56-60`, `docs/FUNCTIONAL-ONCHAIN-MODULES.md`).
5. **"Declared dependencies must equal actual imports" and the round-trip guard** at build time (`runtime-modules.mjs`, `scripts/verify-confluence.mjs:25-80`): an archive that would not rebuild the exact HTML is refused before it is deployed.
6. **Pinned-snapshot recovery and bytecode pinning everywhere** — browser pins a block, SDK pins block hash and re-asserts it after recovery ("Chain snapshot changed during recovery", `packages/modules/chain.mjs`), CLIs allow only seven read methods; and no desk talks to a contract until its runtime, with compiler-declared immutables masked, hashes to the shipped artifact (`normalizeRuntime`/`verifyContract` in `web/v4/client.mjs`, `NFTAccountSession` in `web/launchpad/account-session.mjs`: "Verify executable runtime rather than accepting an address merely because it implements the ABI.").
7. **Custody epoch as the universal revocation primitive** (`SovereignAccount.invalidateSessionsOnTransfer`, consulted by `WorldLedger.memberActive`, `TokenModuleRegistry._authorize`, `VestedExitVault._sameCustody`, `LaunchRegistry._context`, `EstateExchange.snapshot`), including **two-sided consent epochs** for invitations and moderation (`WorldLedger.sol:103-118,149-159`).
8. **Approvals never confer authority; accounts cannot hold their own collection; tokens cannot be sent into sibling accounts** (`IDontFuckingBelieveIt.sol:653-676,802-816`; `SovereignAccount.onERC721Received`).
9. **Net-debit-measured instrument grants** — budget enforced as `balanceBefore − balanceAfter`, calldata hash and target codehash pinned, exact allowance then reset, custody re-checked after the call, 7-day adoption delay (`SovereignAccount.sol` §1.6, `executeUtility`).
10. **Per-NFT module registry with atomic release+state activation, append-only history roots, staging before activation and an independent state-namespace catalog** (`contracts/src/modules/TokenModuleRegistry.sol:144-148`, `ModuleStateStore.sol`).
11. **Snapshots stored as `AppChunk` code instead of SSTORE to fit EIP-7825** — 32 KiB for 7,713,661 gas instead of 29,172,440 (`ModuleStateStore.sol:33-35`, `docs/MODULE-STATE-GAS.md`).
12. **Reflection branches in the journal** — a former owner keeps a thread (`reflectionHead[identity][author]`) without touching the current owner's canonical `head` (`contracts/src/memory/MemoryLedger.sol`), and **journaled swaps** bind the fill to the note (`JournalSwapRouter.sol`).
13. **Sealed Genesis stack with a protocol-attributed activity feed** — `WorldLedger.record` accepts only the sealed launchpad/market/vault/estate and `postWithReceipt` lets a room talk about a specific trade (`WorldLedger.sol`, `genesis-stack.mjs:51`).
14. **Swap-and-lock in one call (`lockUntil`) and one `seed/swap` ABI shared by the constant-product and the v4 market** (`NativeMarket.sol`, `V4GenesisMarket.sol`), so vaults, journal and gift routers are market-agnostic.
15. **Hook economics**: a time-decaying launch fee (1.00 % → 0.30 % over one day), seed-principal lock that still permits zero-delta fee pokes, and a single-use `callbackCommitment` for `unlockCallback` (`contracts/src/kingdom/PhoenixLaunchHook.sol`, `V4GenesisMarket.sol`); `commitPolicy` as an irrevocable fee cap (`OwnerV4FeeHook.sol`).
16. **Community sale that seeds permanent liquidity at the contributors' own clearing price** — `public = (supply−founder)·1e4/(1e4+liquidityBps)`, "no invented price oracle" (`GenesisLaunchpad.sol:33-60`).
17. **64-slot streaming uniform-price auction with checkpoint-first bids** (`extensions/markets/ContinuousClearingAuction.sol`).
18. **MLS over an on-chain transport with AAD = chain coordinates** (`packages/communication/protocol.mjs:73-85`) plus a key directory with generation counters (`PrivacyKeys`) and group freeze on key rotation (`EpochGroupChat`).
19. **Estate sale under a declared-inventory covenant re-verified before and after transfer**, hashing the account's audit root, instrument revision and folded module commitments (`kingdom/EstateExchange.sol`, `operating/CommitmentIndex.sol`).
20. **Validation and deployment discipline**: EIP-170 gate in the compiler (`scripts/compile.mjs:67-81`), input fingerprinting and "incomplete ≠ pass" in the release runner (`scripts/lib/local-validation.mjs`), unsigned plans with journaled receipts, `ArchiveCreated` post-conditions and literal `--confirm` tokens (`scripts/sepolia.mjs:114-186`), a generated capability table with an "actual boundary" column (`scripts/build-capabilities.mjs`), and the read-only, wallet-isolated mint simulator on the Prism branch (`scripts/lib/prism-simulator.mjs`).

---

## 10. Weaknesses, incompatibilities with the GOAL, and security debt

### 10.1 Incompatibilities with the GOAL

1. **No `web3://` surface.** The website is reachable only as a `data:` URL from `tokenURI` (or by recovering it with the CLI and serving locally). The project's own standards review forbids presenting it as live web3 hosting. The unified protocol needs an ERC-5219/4804 router (IPSEITY's `Premises` pattern) on top of the same chunk store.
2. **`tokenURI` is heavy** — fixtures use a 90,000,000-gas `eth_call`; public RPCs may refuse it.
3. **Recovery is eager and the data: origin is opaque** — 8 MB `document.write`, no `localStorage`, no SubtleCrypto guarantee; marketplace iframes without `window.ethereum` show the loader only. The unified app must be far smaller and lazily loaded.
4. **Not canonical ERC-6551** (`canonicalERC6551Compliance:false`); wallets and marketplaces will not discover the account; the module registry assumes `accountOf`/`artifactIdOfAccount`/`currentOwner`/`sessionEpoch`/`mode` rather than `token()`/`state()`.
5. **The surface is enormous**: 204 artifacts, 56 "modules", ~115 npm scripts, 3,483 inventoried files; a quarter of the Solidity (RAILGUN, LayerZero, agents, governance, experimental DeFi, proof) is irrelevant to the GOAL and several pieces need off-chain services (keepers, rehearsal fork, worlds server, proof service, Waku) that contradict "no server".
6. **Swap v1 has no LP layer** (liquidity permanently locked, ETH pairs only); swap v2 needs a PoolManager and a mined hook address; the vendored v4 desk only knows chains 1/42161/137.
7. **Launchpad gaps**: contributions keyed by `msg.sender`; no allowlists/tiers; vesting starts at settle time; the official CCA/Doppler lane carries a BUSL licence.
8. **Message bodies in storage** (1 KiB cap, ~20k gas per 32 B on L1); `_epoch()` staticcalls arbitrary actor code; no deletion, only `hidden`.
9. **Encrypted state does not follow the NFT** — chat secrets and journal passphrases are not transferred on sale (`keyTransferOnNftSale:false`).

### 10.2 Security debt and admin surface

10. **Admin keys exist until frozen**: collection owner (`setAccountFactory` once, royalties), proof router/verifier/witness owners, `WorldLedger` configurator until `sealModules`, `MemoryLedger.installRouter`, `V4GenesisMarket.installHook`, `ExperimentGate` guardian, `OwnerFeeRouter` and `OwnerV4FeeHook` owners until commitment. "Immutable" is a deployment-time discipline (deploy → seal/freeze), not a property of the code.
11. **Size cliffs**: `SovereignAccountFactory` 23,423 B (1,153 B headroom, embeds the account creation code), `OperatingNFTGovernance` 24,192 B (384 B). Any account feature breaks the factory first.
12. **Shared-factory CREATE nonce race**: `ModuleArchiveFactory` uses CREATE, so a concurrent publisher invalidates predicted archive addresses. PR #5 (`fd1c283`, **merged**, main HEAD) adds `verifyStepPostconditions` in `scripts/sepolia.mjs` that parses the unique `ArchiveCreated` event and rejects a front-run substitution (`test/sepolia.test.mjs`: "Sepolia archive receipt verification rejects a front-run address substitution") — detection, not prevention. The real fix is CREATE2 with a content-derived salt.
13. **Mixed error style** (`require("STRING")` in `GenesisToken`, `OnchainApp*`, `ShardedResource`, `V4Strategies`, `GenesisManifest`, `NFTAuctionFactory` and all vendored v4 contracts) and **minified one-line Solidity** across `protocol/`, `operating/` and `extensions/experimental` — hard to audit and diff; NatSpec is sparse.
14. **ABI coupling by returndata length**: `EstateExchange.lockHash` asserts a 320-byte `lockInfo`; `MLSGroupChat.announceMigration` decodes `rooms(uint256)` by first word.
15. **Dependency pins on draft specs**: ERC-8004 (binding never verifies via a registry call per `standards.md`), ERC-8183 ("retrieved 2026-09-12"), ERC-8048 id `0xdf670be1`, LayerZero oft-evm 4.0.1, v4-core `d153b04`/`46c6834`, Doppler BUSL.
16. **Test infrastructure**: ganache 7.9.2 (archived upstream), one Forge fixture, no coverage numbers, no invariant campaigns; viaIR builds "can take hours" in CI; Forge must be the native 1.7.1 binary.
17. **Dead vendored code** (solady `ERC1155`, `ReentrancyGuard`, `SafeTransferLib`, `SignatureCheckerLib`) and **stale manifests** (`PACKAGE-MANIFEST.json` says 6.2.0; `CHANGELOG.md` stops at 5.9; README says no public contracts are deployed while a Sepolia record exists off `main`).
18. **Branding baked into domains**: every hash domain (`IDFBI_MEMORY_1_7`, `IDONTFUCKINGBELIEVEIT_ACCOUNT_V1`, `idfbi/constellation/1.4`, `anima.extension-release/1`, …) and the loader's hard-coded selectors must be re-chosen.
19. **Unmerged work**: the live Sepolia record (`codex/deploy-on-testnet-and-mint-3-nfts-pj8cqs`, one commit, three files) and the Prism Cathedral II GUI + exact mint simulator (`codex/prism-cathedral-simulator`, 3 commits, 111 files, +12,382/−1,149, fast-forwardable, no `.sol` changes). Both apply cleanly; the Sepolia deployer key is the same address as the Cutting-edge burner, so owner functions on that deployment may be unreachable.
20. **Not audited, not funded on a public chain**: every doc repeats "No public-chain deployment, funded public transaction or independent security audit is claimed."

### 10.3 Web-layer findings (from `master-web.md`, verified against `web/`)

21. **The four GOAL features are not uniformly NFT-gated** (§4.2): Swap signs with RAILGUN or an EOA and never checks `ownerOf`; Commons/MLS, Governance, Crosschain, Lifecycle and the default launch funding mode sign with the EOA; only Live/Workbench/cartridges/NFT-funded launches go through the account. Private-by-default swap makes the Swap door unusable without RAILGUN infrastructure, and shielded launches deliberately obscure the creator ("Never infer a creator wallet from that adapter").
22. **Inconsistent chain policy**: `web/evm.mjs` and `experimental.mjs` block mainnet (`TEST_CHAINS = {31337, 11155111, 84532}`) while `V4_NETWORKS` is 1/42161/137 and every planner rejects mainnet.
23. **Hook owner retains fee authority** up to `committedMaximumFee` unless `commitPolicy(…, exactFee=true)` was called; `GenesisV4*` use `require` strings against the custom-error convention.
24. **No page-level CSP** on `index.html`/`shell.html` (only `referrer: no-referrer`); CSPs exist only on the sandboxed cartridge/module/preview iframes, which allow `'unsafe-inline'` scripts behind `connect-src 'none'`.
25. **Hard-coded ABI shapes in the wallet** (`renderSnapshot` 17 words, `modulesOf(address[6])`) and three hand-maintained selector tables (`chain-loader.mjs`, `module-loader.mjs`, `recover-resource.mjs`); ethers is bundled three times (vendor, workbench, RAILGUN worker) and all three copies are stored on chain; `executeUtility` can approve only one ERC-20 per plan.
26. **Loopback services the UI expects** (rehearsal `:8788`, scenario/proof `:8791`, worlds `:8789`, dev server `:4173`), an off-chain `console-api.ts` (D1/R2 with OAuth header), and external links to `*.edwincardenas.chatgpt.site` in `shell.html:26` and `app.js:419` (removed on the Prism branch).

---

## 11. Toolchain and testing approach, with measured numbers

- **Compiler**: solc-js **0.8.30**, `viaIR: true`, optimizer runs **1,000**, `evmVersion` **cancun** by default / **shanghai** for `compile:local` (`IDFBI_EVM_TARGET`), `metadata.bytecodeHash: ipfs`, `immutableReferences` emitted for the deployment planners. `scripts/compile.mjs` regenerates `ConfluenceLoader.sol` from `web/confluence/*.mjs` first, **fails any contract over 24,576 deployed bytes**, writes `reports/contract-sizes.json` (204 artifacts) and swaps artifacts atomically. v4 contracts compile separately with solc 0.8.26 (Cancun); Permit2 with 0.8.17 (London).
- **Sizes**: per-contract bytes are in §3; 204 compiled artifacts; the four largest are OperatingNFTGovernance 24,192, SovereignAccountFactory 23,423, SovereignAccount 21,506 and IDontFuckingBelieveIt 20,940.
- **Gas**: `ModuleStateStore` stage 32,768 B = **7,713,661** (limit 9,461,092 with 20 % headroom), write 32,768 B = **7,871,459** (9,602,817); 23,000 B = 5,442,605; 1 B = 323,341; 0 B = 244,430; EIP-7825 cap 16,777,216; old SSTORE design 29,172,440. Cartridge `contentOf`: 48 KiB = 328,234 view gas; 1 MiB = 13,798,118 view gas (46 chunk refs). Local full-stack mint: recovery 2,275 ms, module setup 16,510 ms, RSS 709,414,912 B.
- **Archives**: app 7,952,983 B expanded / 2,072,940 B stored / 101 chunks / 20 groups / 117 embedded modules; workbench 707,014 B / 31 chunks; privacy worker 15,112,663 B / 4,596,329 B gzip / 200 chunks / 7 shards; loader 15,582 source bytes; SDK bundle 406,475 B (+11,631 core); a full local mint = 365 contract creations; Sepolia module system = 37 transactions (blocks 11,742,089–11,742,148).
- **Tests**: `node --test` + ethers 6.15.0 against **ganache 7.9.2** (chain 31337, Shanghai, 100 M block gas). Locally 127 `*.test.mjs` with 734 `test()` calls (launchpad 75, extensions 84, genesis 69, modules 51, operating 48, memory 44, kingdom 41, privacy 41, confluence 38). CI run 35172184548 on `84961c3` (2026-09-17, 25.6 min): **24/24 validation stages**, **760/760** root JS, **11/11** official-launch (Anvil 1.7.1, real PoolManager), **1/1** MLS, **9/9** Rust, **51/51** module regression (inside the 760), **7 Forge tests + 64 fuzz runs** (`Cartridges.t.sol`, native Forge 1.7.1 required), **17 Chromium scenarios** (7 app, 5 workbench, 1 native lifecycle, 4 complete minted runtime; Chromium 151; the acceptance suite signs 7 reviewed transactions and asserts each gas limit ≤ 16,777,216).
- **Test naming** reads like statements: "native NFT owns module selection, atomic state migration, stale reviews and transfer revocation"; "market callback cannot change custody or reenter a funded installment"; `testChangedChunkCodeWithSameLengthAndChangedLengthBothFailClosed`.
- **Release gate**: `scripts/validate-release.mjs` runs 24 stages (integrity, syntax, static, two compiles, build, javascript, archive, verify-archive, local-mint, master-mint, five v4 suites, official-launch, communication, privacy-offline, native-keccak, rust) with prerequisites and timeouts; hashes authored inputs and fails a run whose inputs changed mid-run; a missing/duplicated/skipped node:test summary is `incomplete`, not passed; evidence under `.local-genesis/validation/<run>/`. Static checks: `check-source.mjs`, `static-audit.mjs` (forbids `tx.origin`, `selfdestruct`, `.delegatecall(`, raw `sstore`; "not a security audit"), `SOURCE-SHA256.json` (3,483 files).
- **CI**: three jobs on `ubuntu-24.04`, Node 24.19.0 — `complete-local-suite` (240 min), `current-browser` (150 min, Playwright), `module-solidity` (20 min, Foundry 1.7.1). "CI never creates an inventory to erase a mismatch."
- **Deployment**: unsigned plans only (`genesis-deployment.mjs`, `modules-deployment.mjs`, …) with predicted CREATE addresses and `--verify` reconstruction; `npm run deploy` always exits 1; the only signing deployer is `scripts/sepolia.mjs` (chain 11155111 hard-coded, literal `--confirm DEPLOY_ANIMA_TO_SEPOLIA`, journal written before waiting, post-condition verification, resumable, reveal secret saved before `commitAwakening`). Mainnet is rejected by every planner.
- **Local playground**: `npm run master:local` (persistent Ganache instance under `.local-genesis/<MASTER_INSTANCE>/`, checkpointed genesis, module system, three example modules, a 49,152-byte cartridge acquired through the NFT account, recovery verified before printing URLs; `--once` for CI).

---

## 12. Integration plan: what from MASTER becomes part of the unified protocol

### 12.1 Take verbatim (rename domains/selectors only)

- `contracts/src/protocol/OnchainApp.sol` (`AppChunk`, `OnchainApp`), `OnchainAppDirectory.sol`, `OnchainModuleDirectory.sol` — the chunk store and versioned directories behind both `tokenURI` recovery and any `web3://` router. Convert `require` strings to custom errors.
- `contracts/src/protocol/ProtocolPrimitives.sol` (`ProtocolAssets`, `ProtocolGuard`) — the settlement library for every module.
- `contracts/src/protocol/GenesisToken.sol`, `contracts/src/protocol/TimeVault.sol` (decide whether `ledger.record` stays), `contracts/src/confluence/ArtifactBinding.sol`, `contracts/src/kingdom/V4Boundary.sol` + `HookDeployer`, `contracts/src/lib/{Administrated,Base64,Strings,Crypto}.sol`, solady `ERC721`/`Base64`, `contracts/src/modules/ModuleTypes.sol`, `integrations/console/protocol/v4-hook/src/HookCreate2Factory.sol`.
- `web/confluence/chain-loader.mjs` core (JS SHA-256, pinned-block `recoverArchive`, HTTPS/loopback RPC rule), `web/confluence/minted-identity.mjs` (`assertMintBinding`), `packages/modules/core.mjs` (canonical manifest, envelope, bounded gunzip, chunk dedupe, `readVerifiedFile`), `packages/modules/hash.mjs`, `web/v4/client.mjs` `normalizeRuntime`/`verifyContract` + `web/v4/math.mjs` (TickMath port), `web/launchpad/hook-client.mjs` (hook verification, browser CREATE2 mining, hooked plans), `web/launchpad/links.mjs`, `integrations/console/lib/v4-position-encoder.mjs`, `web/evm.mjs` (dependency-free keccak/ABI encoder fallback).
- `scripts/compile.mjs` + `scripts/lib/compiler-artifacts.mjs`, `scripts/validate-release.mjs` + `scripts/lib/local-validation.mjs` (stage list rewritten), `scripts/test-all.mjs`, `scripts/static-audit.mjs`, `scripts/check-source.mjs`, `scripts/source-manifest.mjs`, the three-job CI shape.

### 12.2 Adapt as modules of the unified protocol

- **Token + account**: `IDontFuckingBelieveIt` stripped to commit/reveal mint with endowment, `accountOf`/`artifactIdOfAccount`, the two authority predicates, `ForbiddenTransferTarget`, the epoch-rolling transfer hook, KV metadata, ERC-2981/4906/4907; `SovereignAccount` Bound mode (`execute`, `executeUtility`, net-debit instrument grants, epoch, audit root, 1271, receivers) **re-implemented as a canonical ERC-6551 account** so the factory size cliff and the interoperability gap disappear; keep `sessionEpoch`.
- **Website**: `ConfluenceRenderer` + regenerated loader emitting a small identity script plus the verifier, the app split into lazily recovered feature archives (`runtime-modules.mjs`, `archive-confluence.mjs`, `verify-confluence.mjs`); add an ERC-5219/4804 router over the same `OnchainModuleDirectory` so the page is reachable both as `tokenURI` and as `web3://`; pin block hash. `GenesisManifest` generalised to a named service directory; `ModuleWorkbench` as the pattern for any second recoverable page; `render/field.inc` if the unified art wants a deterministic kernel.
- **Ownership gate**: `web/confluence/wallet.mjs` (`ConfluenceWallet`: `assertMintBinding`, pinned-block `ownerOf`/`accountOf`, revision invalidation, epoch-bound `prepare*`/`assertReviewContext`/`send`), `web/launchpad/account-session.mjs` (`NFTAccountSession`: bytecode-pinned collection and account, `wrap(plan)` into the account) and `web/modules/adapter.mjs` (`sameAuthority`) merged into **one wallet object that every desk uses and that is the default signer**, extended with ERC-1271 and session-key delegation for "authorised by the holder"; `web/launchpad/chain.mjs` (`LaunchChain`) supplies the review → send → prove-the-receipt → find-replacement discipline. `V4Desk` and `LaunchDesk` themselves are rewritten around that signer. The `agent/worlds` SIWE-plus-epoch challenge is the pattern if any off-chain gateway ever exists.
- **Swap**: `NativeMarket` as the always-available fallback, `V4GenesisMarket` + `PhoenixLaunchHook` where a PoolManager exists, `GenesisV4Router` + `OwnerV4FeeHook` + `OwnerFeeRouter` + `V4SettlementConverter` for owner-created pools and creator fees, `JournalSwapRouter`/`InstrumentRouter` as recipes; keep the shared `seed/swap` ABI and `lockUntil`; keep the **fail-closed private-mode switch** as a UI contract; drop RAILGUN; the NFT account signs.
- **Messaging/social**: `WorldLedger` (consider events-only bodies; keep rooms, reactions, profiles, follow/block, two-sided consent epochs, activity feed, `postWithReceipt`), `PrivacyKeys` + `MLSGroupChat` + `packages/communication` for private groups **keyed to the NFT account, not the EOA**, `MemoryLedger` (+ `web/memory/crypto.mjs` packet format) for notes, `ConsentGiftRouter` for gifts, `GenesisNames` optional.
- **Launchpad**: `GenesisLaunchpad` (community sale; add allowlists and NFT-keyed contributions), `ContinuousClearingAuction` + `NFTAuctionFactory`, `GenesisV4Launchpad`/`GenesisV4HookLaunchpad`/`GenesisV4Position` (direct v4 launches with LP shares), `LaunchAllocationComposer` + `LaunchRegistry`, `OwnerLaunchFactory`; convert the vendored contracts to custom errors and re-pin v4-core; NFT-account funding becomes the default.
- **Vault**: `TimeVault` (near-verbatim), `VestedExitVault` optional (permissionless slices, no keeper), `InstrumentRouter`, `ConsentGiftRouter`.
- **Per-NFT apps/state**: `ModuleArchiveFactory` (switch to CREATE2 content-salted), `ExtensionReleaseRegistry`, `TokenModuleRegistry`, `ModuleStateStore`, `ChunkedCartridgeRegistry` merged into the registry, `web/modules/host.mjs` + `html-worker.mjs` + `runtime.mjs` (capability bridge with swap/launch/vault proposal capabilities added), `packages/modules/chain.mjs` + `deployment.mjs` + recovery CLIs with ERC-6551 ABIs.
- **Estate sale**: `EstateExchange` + the `CommitmentIndex` folding idea as the honest "sell the NFT with its contents" marketplace, once the inventory ABI is decoupled from returndata lengths.
- **Pipeline**: `scripts/sepolia.mjs` generalised to a chain allowlist with the same journal/post-condition/`--confirm` design; the unsigned-plan planners; `master-local.mjs` + `genesis-stack.mjs` + `modules-stack.mjs` as the template for `unified:local`; `build-capabilities.mjs` for a generated capability table with boundaries; the Prism-branch read-only mint simulator and frozen export as the demonstration harness.

### 12.3 Ideas only (no code carried)

Custody epoch as the universal revocation primitive and two-sided consent epochs; approvals never confer authority; net-debit grant measurement with codehash pinning; AppChunk-backed state to beat EIP-7825; reflection branches; sealed-stack activity attribution; swap-and-lock; the fee ramp and callback commitment; checkpoint-first auction clearing; MLS AAD binding; declared-inventory estate covenant; "actual boundary" documentation; `Wake`'s priced keeper seat and `AgentPolicyGuard`'s scheduled grants if automation is ever wanted; x402 exact-payment flow and bounded-operator loop from `agent/extensions` if the NFT account should ever pay for services; the SIWE-plus-epoch sign-in.

### 12.4 Drop

The sovereign/proof branch and every verifier, `OmnichainWitnessRegistry`, `AuthenticatedStatePortal`, both crosschain packages, RAILGUN (`packages/privacy`, `web/privacy`, the worker archive), `extensions/{agents,experimental,governance}`, `operating/` except `InstrumentRouter`, `PublicGoodsMatching`, `WholeNFTShares`, the legacy cartridge contracts, `NamedMint*`, `SessionSponsor`, `V4ScheduledExit`, `integrations/official-launch` (BUSL; reference only), the `dave`/`github` copies, all `agent/*` services, `worlds/`, dead solady files, `Makefile`, ~90 npm scripts, historical docs and reports.

### 12.5 Two actions before any of this

1. Cherry-pick `33f1034` (Sepolia record) and fast-forward `codex/prism-cathedral-simulator` into the reference checkout so the unified program works from the newest UI vocabulary and has the only public-chain evidence on `main`.
2. Treat the Sepolia deployment (`0xCB8Dc18d3Ca5C9c2aeA16c94fa0af6EF4dfc0aC6`, tokens 1–3) as read-only evidence: its deployer matches the destroyed Cutting-edge burner, so assume its admin functions are unreachable and deploy fresh.
