# MASTER-NFT-PROJECT (ANIMA v7 Master) — remote branch audit, part 1

Repository: `/home/user/MASTER-NFT-PROJECT` · base: `origin/main` @ `f65fb2c` ("Merge pull request #5 from venividis/codex/propose-fix-for-factory-nonce-vulnerability") · audited 2026-10-03, read-only (`git log` / `git diff` / `git show` against refs; nothing checked out).

| Branch | Ahead | Status | Verdict |
|---|---|---|---|
| `codex/deploy-on-testnet-and-mint-3-nfts` | 0 | merged (PR #2) | nothing to recover |
| `codex/deploy-on-testnet-and-mint-3-nfts-pj8cqs` | 1 | **unmerged** | **valuable** — live Ethereum Sepolia deployment record (collection + 3 minted tokens + full module system, 36 tx hashes) that exists nowhere on main |
| `codex/explain-project-purpose-simply` | 0 | merged (PR #1) | nothing to recover |
| `codex/identify-pending-upgrades-and-tasks` | 0 | merged (PR #4) | nothing to recover |
| `codex/prism-cathedral-simulator` | 3 | **unmerged**, fast-forwardable | **valuable** — "Prism Cathedral II" GUI redesign (Atlas, seven-door Tools, mobile nav, Appearance), an exact local-mint simulator with a read-only RPC bridge, a frozen/hosted replay exporter, and recorded byte-equality evidence |
| `codex/propose-fix-for-factory-nonce-vulnerability` | 0 | merged (PR #5 = main HEAD) | fix is on main |

Four of six are ancestors of `origin/main` (`git merge-base --is-ancestor` confirmed each). The two unmerged branches are both by `venividis`, both later than main, and both touch only files that main has not moved since (main has 0 commits since the merge-base of the Prism branch), so they apply cleanly.

---

## 1. `codex/deploy-on-testnet-and-mint-3-nfts` — merged

Tip `54d26b9` "Support explicit Sepolia mint recipients" is an ancestor of main (merged via PR #2). Zero commits ahead, empty diff. Its `--recipient` flag for `npm run sepolia -- mint` is already on main (`scripts/sepolia.mjs` lines 197–205).

## 2. `codex/deploy-on-testnet-and-mint-3-nfts-pj8cqs` — UNMERGED, valuable (deployment record)

**Commit:** `33f1034` "Record live Sepolia module deployment" — venividis, 2026-09-19.

**Files:** `docs/deployments/sepolia-11155111.json` (new, 215 lines), `docs/SEPOLIA.md` (+5), `scripts/sepolia.mjs` (+6/−4). Three files, +226/−4.

### What is unique

1. **The deployment record itself.** Main has no `docs/deployments/` directory at all (its only deployment JSONs are the imported sibling-repo records under `integrations/github/{cutting-edge,most-advanced}/deployments/`), and `git grep` over `origin/main` finds none of these addresses anywhere. This branch is the only place the live Sepolia ANIMA v7 collection and module system are recorded:

```
schema:   anima.public-deployment/1
network:  Ethereum Sepolia (chainId 11155111)   updatedAt 2026-09-20
deployer: 0xc591C669162cD4da8aB9BfA2c2e68d538A312C00
collection:
  address:                 0xCB8Dc18d3Ca5C9c2aeA16c94fa0af6EF4dfc0aC6
  sovereignAccountFactory: 0xd99D2e1aee792e074ff34495627D6213737e52d2
  tokenIds:                ["1", "2", "3"]          <- the three minted NFTs
moduleSystem (planSha256 0xaeafbf23…4db22):
  ModuleArchiveFactory      0x7751D929adeE4Ec9AA78505d5E9E047a510e27b1   tx 0x5033d3d7…  block 11742089
  ExtensionReleaseRegistry  0x0bBdD0Ac5c95e1Bd42A620BDc5C432aBC2D76e9c   tx 0x003ce099…  block 11742092
  TokenModuleRegistry       0x2ECcA4AE5AE809328703c624e7E82963EF4Ad8e1   tx 0xc4eb0290…  block 11742113
  ModuleStateStore          0xf7acB81FD2610C7887bb1962bfD809a96DcF3264
  ChunkedCartridgeRegistry  0xD66A2D34AFF5d71cA27A80256e0Dfc223Ba5C4E1   tx 0x4916da7c…  block 11742114
  ArtifactBinding           0xCDd59f365788F271e73F366bC4eA2747F9B5f6D9
  WorkbenchArchive          0x5867e5A3B372CC17cc34e4130FdE583DF9822bED   tx 0xde7460b8…  block 11742147
  ModuleWorkbench           0x1d2bad62Fe47a63b7a2e51E03959a50B8767C2aD   tx 0xd6fef91a…  block 11742148
  + 30 "chunk:0x…" transactions (blocks 11742115–11742146) that uploaded the workbench archive chunks
explorer: https://eth-sepolia.blockscout.com
```

The record is explicit that it "contains public addresses and transaction hashes only; it contains no signing key or mint secret."

2. **A SEPOLIA.md paragraph** linking the record and tightening the operator contract:

> `--recipient` is mandatory on both the first invocation and every recovery invocation. The runner checks it against the recovery file before submitting anything, so an operator cannot accidentally resume a mint for a different owner.
>
> The current public Sepolia collection and module-system deployment is recorded in [the live deployment record](deployments/sepolia-11155111.json). That record contains public addresses and transaction hashes only; it contains no signing key or mint secret.

3. **A stricter `scripts/sepolia.mjs` variant.** Main already requires `--recipient` on the first mint but, on a *recovery* invocation, only checks it when supplied (`typeof args.recipient === 'string' && …`). This branch makes it unconditional: `const requestedRecipient = getAddress(required(args,'recipient'))` and `getAddress(recovery.recipient) !== requestedRecipient` → `fail('Mint recovery file does not match this plan, signer, and recipient.')`. Minor hardening; low priority but harmless.

### Caveats for the merge program

- The deployer `0xc591C669…312C00` is the same address that names the Cutting-edge repo's record `integrations/github/cutting-edge/deployments/84532-0xc591c669162cd4da8ab9bfa2c2e68d538a312c00.json`, and that repo's CLAUDE.md says its deployer key was an ephemeral burner that is destroyed. Verify key custody before relying on any owner-only function of this Sepolia deployment; the addresses are still valuable as a reference deployment and as something `tools`-style recover scripts can re-read.
- Blocks 11742089–11742148 on Sepolia; token ids 1–3 are on `0xCB8D…0aC6`.

**Recommendation:** merge (or cherry-pick `33f1034`). It is a 3-file docs/record change with no conflict surface.

## 3. `codex/explain-project-purpose-simply` — merged

Tip `3082033` "Add resumable Ethereum Sepolia deployment workflow" is an ancestor of main (PR #1). Nothing unmerged.

## 4. `codex/identify-pending-upgrades-and-tasks` — merged

Tip `9d9b00a` "Repair release integrity and clarify report scope" is an ancestor of main (PR #4). Nothing unmerged.

## 5. `codex/prism-cathedral-simulator` — UNMERGED, valuable (GUI redesign + mint simulator + evidence)

**Commits (all venividis, 2026-09-24):**
- `1bf0dfc` Preserve Prism Cathedral interface and recovered source
- `01db5a2` Add exact local mint simulator and guarded frozen replay
- `a6b4928` Record full local mint recovery and browser validation evidence

**Scale:** 111 files, +12,382 / −1,149. Merge-base is main's HEAD (`f65fb2c`); main has 0 commits since, so this is a pure fast-forward. Roughly half the file count is regenerated build output (`dist/`, `onchain-app/confluence/modules/**/chunks/*.bin`, `onchain-app/module-workbench/chunks/*.bin`, `SOURCE-SHA256.json`, `package-lock.json`) that the repo tracks deliberately as reproducible immutable bytes.

### 5a. The GUI: "Prism Cathedral II"

README addition (verbatim):

> Prism Cathedral II is the default interface: a seed-bound luminous object, explorable interior, seven instrument tabs, a searchable Atlas, mobile navigation and an integrated module workbench. Appearance controls adjust spectrum intensity, rendering quality and motion; Original keeps the approved blue-object renderer available.
>
> The simulator deploys the real contracts and mints a local NFT, recovers its immutable application and workbench, and refuses any mismatch with the release build. It preserves the actual mint seed, genome and state root. A portable export provides the same recovered GUI and original NFT loader through a strictly read-only snapshot.
>
> See the local mint guide and the hosted replay guide. No public-chain deployment or future mint prediction is implied.

`web/confluence/shell.html` is rewritten: the old "Anima Genesis" dock (Artifact / Swap / Launch / Vault / Worlds / Atlas) and the four orbit nodes are replaced by an identity panel with a **Whole / Interior / Original** mode nav, "Identity & recovery" dossier link, two home cards ("01 / MEMORY — Keep what matters" with a *Write a memory* button; "02 / THE LIVING LIBRARY" with *Module workbench* (Discover · Installed · History · Journal), *Worlds & cartridges*, *Instrument workshop*), an interior toolbar (Return outside / Reset view / Open tools), a `prism-mobile-nav` with **Home / Tools / Memory / Atlas**, and an **Appearance** button in the header next to **Connect NFT ↗**. The external "Compare" link to `awe-confluence.edwincardenas.chatgpt.site` is removed (one fewer off-chain dependency).

New module `web/confluence/prism-presentation.mjs` (206 lines) carries the route vocabulary — "Presentation is shared by the live release and its recovered mint simulator. No chain state or task availability is inferred from this visual vocabulary." — e.g. `v4: ["Exchange, with intention.", "Two currents. One considered choice.", "The Double Current"]`, `launch: ["Give an idea its first light.", …, "The First Branch"]`, `commons: ["A place to belong.", …, "The Constellation Loom"]`, `modules: ["A living library.", "Your tools. Your chosen versions.", "The Living Loom"]`, and the searchable Atlas taxonomy:

```
PRISM_ATLAS_GROUPS = [
  ["Identity", ["identity", "connect", "interior"]],
  ["Create",   ["launch", "participant", "workshop", "modules", "library", "work"]],
  ["Exchange", ["trade", "vault", "exit-live", "routes", "give", "market"]],
  ["Connect",  ["world", "governance", "crosschain", "agents"]],
  ["Explore",  ["cartridges", "memory", "settings"]],
  ["Advanced", ["privacy", "burners", "security", "extensions", "ledger", "lab", "advanced"]],
]
```

`toolsPage()` in `web/confluence/app.js` renders "Seven doors into the same living world." from `PRIMARY_CAPABILITIES` (`web/confluence/capabilities.mjs`): **Swap** ("Exchange assets with an explicit privacy choice"), **Launch**, **Vault** ("Lock assets and inspect release schedules"), **Memory**, **Commons** ("Encrypted conversations and clearly separate public rooms"), **Worlds** ("Play local worlds or load owned content-pinned cartridges") and the module workbench. New catalogue entries: `settings: ["Appearance & settings", "Light, motion, sound and local recovery"]`, `tools: ["Tools", "Seven doors into the same living world"]`; `identity` is re-described as "Inspect your origin, history and recovery". `app.js` adds `settingsPage()`, `applyPrismPreferences()/changePrismPreference()`, `searchAtlas()`, `toggleOriginal()`, and scopes archive storage via `scopeConfluenceArchiveStorage` (tested by `prism-archive-scope.test.mjs`: "simulator archive restoration stays inside one reserved namespace", "archive scope rejects arbitrary keys, mixed identities and unsafe prefixes").

Artwork: `web/genesis/prism-art.mjs` (351 lines) — "deterministic three-dimensional filament geometry. No textures, user text, wallet secrets, services or external dependencies. The same vertices are projected outside and inside the shell." Its `PRISM_MODES` map every route (home/swap/launch/vault/memory/commons/worlds/atlas/modules/identity/privacy/governance/crosschain/agents) to a geometry mode, seeded by an FNV-hash of `domain|seed|genome|root|axes`. `web/modules/app.mjs` (+701) mounts a `PrismArtwork` loom canvas in the workbench with reduced-motion, Resize/IntersectionObserver handling. `surfaces.css` grows by ~1,600 lines; `workbench.css` by ~300. PWA manifest renamed to "ANIMA · Prism Cathedral".

Browser-test harness `test/browser/current-app.mjs` is updated to the new selectors (`.prism-mobile-nav`, `.prism-atlas-group`, `.prism-home-actions`) and asserts the mobile nav reads exactly `['Home','Tools','Memory','Atlas']`.

### 5b. The exact local mint simulator (`docs/PRISM-SIMULATOR.md`, `scripts/lib/prism-simulator.mjs`)

> The simulator mints the real contracts on persistent local chain **31337**, obtains `tokenURI(1)`, recovers its immutable application using the production archive reader, and compares every recovered byte against the built application. It also recovers the immutable module workbench and all installed packages, shared dependencies and module state history.
>
> The default instance is `prism-cathedral`. Its addresses, seed, genome and state root come from the actual local mint. No randomly invented preview identity is substituted. […] this simulator proves the application and recovery path, not that two different mints have the same identity.

Routes served on loopback `127.0.0.1:4173`:

| Route | Result |
|---|---|
| `/` and `/token/1/live` | Mint-bound application recovered from immutable storage |
| `/simulator` | Edition, recovery links and evidence |
| `/token/1/loader` | Original `animation_url` HTML, unchanged |
| `/token/1/recover` | Original loader inside a protected read-only host; leave RPC blank and choose Unfold |
| `/token/1/runtime` | Exact recovered runtime, without a simulator prefix |
| `/token/1/metadata` | Original onchain JSON metadata |
| `/token/1/provenance` | Seed, archive commitments, expanded byte hashes, snapshot block and verification |
| `/modules.html` | Recovered immutable workbench with this NFT's registry parameters |
| `/simulator/snapshot` | Complete verified snapshot for a portable export |

Security posture (doc, verbatim): "The HTTP bridge exposes selected reads only. It rejects accounts, signatures, transaction submission, state overrides, mining, unlocked-account operations, cross-origin requests and non-loopback hosts. Read-only previews cannot impersonate owner approval. Controls that require ownership still use the real application's review and wallet flow and cannot complete through this bridge."

How it is built (code): `parseMintedTokenURI` parses `data:application/json;base64` → `animation_url` `data:text/html;base64` → the leading `<script>window.AWE_CHAIN_IDENTITY={…};</script>` prefix with a regex and strict field/shape checks ("without evaluating any code from a token"), and refuses an identity whose chainId/collection/tokenId differ from the requested mint. `createReadOnlyRequest` whitelists `eth_chainId, eth_blockNumber, eth_call, eth_getBlockByNumber, eth_getCode, eth_getBalance, eth_getTransactionCount, eth_getLogs`, pins every block tag to the snapshot block (`latest/safe/finalized` → pinned; any other block → error), forbids state-override `eth_call` (third param), value-bearing calls, and gas > 90M; everything else returns code `4200` "This simulator provides pinned read-only RPC. Wallet accounts, signatures, transactions and chain mutation are unavailable." `recoverMintSnapshot` recovers the runtime via the production `recoverArchive`, the workbench chunk-by-chunk (`contentSha256/byteLength/chunkCount/readChunk`, ≤1 MiB, ≤64 chunks, ≤23,000 B each), checks `services()` against the record, recovers the token's modules via `packages/modules/chain.mjs`, re-reads the block at the end ("Snapshot changed during recovery.") and emits an `anima.prism-mint-proof/1` provenance object. `installLiveGuard` freezes a non-configurable `window.ethereum` stub, captures `eip6963:announceProvider/requestProvider` at the capture phase, and re-installs those listeners inside a wrapped `document.open` (because `document.open()` clears listeners) — if a wallet extension already installed a non-configurable provider the host stops before writing any application code. The server enforces loopback `Host`, same-origin `Origin`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and a CSP of `connect-src 'self' data: blob:; frame-src 'self' data: blob:; object-src 'none'; base-uri 'self'`.

`scripts/master-local.mjs` is extended so the existing `npm run master:local` path (ganache, chain 31337, the public `test test … junk` mnemonic) can run as the simulator when `ANIMA_PRISM_SIMULATOR=1` (`scripts/prism-simulator.mjs` sets `MASTER_INSTANCE=prism-cathedral` and re-imports it). Stale-edition protection now covers the build manifest, runtime and workbench hashes (`assertLocalEdition`), and an interrupted genesis checkpoint is refused if `onchain-app/confluence/manifest.json`'s sha256 changed.

New npm scripts: `dev` (vite), `simulator:start`, `simulator:export`, `test:simulator`. New devDependency `vite@7.3.6` with `vite.config.mjs` (`root:'dist'`, host `0.0.0.0`, `allowedHosts:['terminal.local']`, port 4173 strict) — note the vite dev server is *not* loopback-only; it is a convenience, separate from the simulator server.

### 5c. Frozen / hosted replay export (`docs/PRISM-FROZEN-EXPORT.md`, `scripts/lib/prism-simulator-export.mjs`)

> `npm run simulator:export -- --output simulator-export` exports the edition currently served by the local mint simulator […] The exporter compares the recovered runtime and workbench with the current checkout's complete release bytes before writing anything.
>
> Serve the resulting directory with a static HTTP server or a static host. Its `index.html` opens the minted application directly. Desktop and Phone controls resize the same application frame, preserving its state; Phone uses a 390-pixel viewport […] "Edition details" links to the original metadata portrait, exact loader, recovered workbench, provenance and SHA-256 manifest.
>
> Only recorded reads can succeed. Missing reads produce an explicit "not recorded" error; the player never fabricates chain results or silently contacts another RPC. Wallet accounts, connections, signatures, chain changes and transaction submission are rejected. […] The exported site is not a public-chain mint and does not demonstrate public-chain gas costs or production service availability.
>
> The frozen host is a playback adapter outside the immutable NFT payload. To inspect the actual originals, download `runtime-source.html`, `workbench-source.html` and `token-1-loader.html` and compare them with the hashes in the manifest. […] No private key, wallet mnemonic or signing capability is included in the frozen package.

`installFrozenGuard` (serialized verbatim into the browser) replays from a `Map` keyed by `rpcRecordKey(method, params, blockNumber)` — hex lower-cased, object keys sorted, `latest/safe/finalized/pending` normalised to the pinned block — allowing only `eth_chainId, eth_blockNumber, eth_getBlockByNumber, eth_getCode, eth_call, eth_getBalance, eth_getStorageAt, eth_getTransactionCount, eth_gasPrice, net_version`; unknown reads throw `-32004` "This read was not recorded in the frozen local mint." The exported host carries a full CSP (`form-action 'none'; base-uri 'none'; object-src 'none'`, `connect-src 'self' data: blob:`).

### 5d. Evidence recorded on the branch (`reports/prism-simulator/`)

`mint-proof.json` (schema `anima.prism-mint-proof/1`, scope "Actual local-chain mint; no public deployment"): chain 31337, collection `0xC976c932092ECcD8f328FfD85066C0c05ED54044`, token 1, block `0x1b7` / hash `0x9f9d164d…c810e`; identity seed `0xb127fc79…989f`, genome `0x7f0286cb…5a3e`, root `0x0b9bd878…fab8`, manifest `0xec827421…573b42363c26`, runtime `0x457ccf29…eafdb`, archiveVersion 3; runtime 8,120,812 bytes (sha256 `0x6a0c5f4c…a0`), workbench 735,615 bytes (sha256 `0x56a0b041…6e`), loader sha256 `0xc1319cc6…e3`; verification `{runtimeByteEquality: true, workbenchByteEquality: true, tokenModuleRecovery: true, installedModules: 3, recoveredPackages: 4, historyEntries: 6}`.

`validation.json`: ui 234/0, confluence 38/0, ownerSafety 8/0, prismFocused 9/0, workbenchFocused 19/0, liveSimulatorFixture 5/0, frozenReplayGuards 6/0, sourceSyntax 1,638 files pass, `staticAudit: "heuristic scan passed; not a security audit"`, `runtimeRecovery: "Complete bytes identical to minted archive"`, `publicDeployment: false`.

`browser-review.json` ("Frozen local mint export via supervised preview"): desktopMintIdentity "Lumin Crown; chain31337; genesis1"; interior "Visible interior and Return outside navigation succeeded"; phone "390px preview, Home/Tools/Memory/Atlas, seven-door Tools dialog"; originalMetadataLoader "Unfold recovered full immutable application and same Lumin Crown identity"; workbench "Recovered workbench rendered; Aurora notebook opened in isolated frame".

New tests (names are the statements they prove): `pinned RPC allows bounded reads and rejects wallet authority, writes, overrides and foreign blocks`; `immutable identity parsing rejects unexpected executable expressions and altered token binding`; `saved editions cannot silently reuse a stale runtime, workbench or build`; `real local NFT mint recovers exact immutable runtime/workbench and HTTP never exposes chain mutation` (180 s, deploys and mints for real); `live replay isolates wallet discovery and reestablishes the barrier after document.open`; `frozen reads use the captured block and reject every account, signature or mutation path`; `EIP-6963 capture barrier survives document.open before any application listeners run`; `nonconfigurable injected wallets fail closed before writing or executing the application`; `export preserves exact runtime, workbench, NFT loader, identity and metadata bytes`; `the complete immutable identity reproduces the same geometry without randomness`; `Atlas navigation has unique real destinations and live operations retain their artwork`.

### Why it matters for the GOAL

- It is the most complete **"mint a website" proof** in this repo: a real `tokenURI` → `animation_url` → immutable-archive recovery, byte-equal to the release build, with the workbench (modules) recovered from the same token. That is precisely the property the unified protocol must demonstrate, and the simulator/export pair is the demonstration harness.
- The GUI already organises the four required surfaces (Swap, Launch, Vault, Commons/Memory messaging) plus modules into a holder-facing shell with wallet gating via **Connect NFT**, a searchable Atlas, and a phone layout — reusable as the unified protocol's front end vocabulary.
- The read-only bridge + EIP-6963 isolation is a reusable, tested pattern for "preview without a wallet" that cannot forge owner approval.
- Caveat: "Original" retains the previous blue-object renderer, so the redesign is additive. The branch bumps tracked build artefacts and `package-lock.json` (+1,155 lines for vite); merging means accepting those regenerated bytes (`SOURCE-SHA256.json` is updated accordingly). No contract (`.sol`) changes.

**Recommendation:** merge (fast-forward). If build output must be regenerated under the merged toolchain, the branch's own `npm run build && npm run archive:confluence && npm run verify:confluence` is the documented path.

## 6. `codex/propose-fix-for-factory-nonce-vulnerability` — merged

Tip `fd1c283` "Verify Sepolia workbench archive commitments" is PR #5, whose merge commit **is** `origin/main`'s HEAD (`f65fb2c`). PR #5 touched `scripts/sepolia.mjs` (+50), `test/sepolia.test.mjs` (+35) and `docs/SEPOLIA.md` (+4). The fix is on main; nothing unmerged.

---

## Highlights

1. Only two of six branches carry unmerged work; both apply cleanly on `f65fb2c` (main has not moved past the Prism branch's merge-base).
2. `codex/deploy-on-testnet-and-mint-3-nfts-pj8cqs` is the sole record of the live **Ethereum Sepolia** ANIMA v7 deployment: collection `0xCB8Dc18d3Ca5C9c2aeA16c94fa0af6EF4dfc0aC6` with tokens 1–3, `sovereignAccountFactory 0xd99D2e1a…52d2`, `ModuleWorkbench 0x1d2bad62…C2aD`, `TokenModuleRegistry 0x2ECcA4AE…Ad8e1`, 36 transactions at blocks 11742089–11742148. Deployer `0xc591C669…312C00` matches the Cutting-edge repo's destroyed burner key, so treat owner functions as possibly unreachable.
3. `codex/prism-cathedral-simulator` delivers the "Prism Cathedral II" holder GUI (Whole/Interior/Original, seven-door Tools, grouped searchable Atlas, Home/Tools/Memory/Atlas mobile nav, Appearance settings) and an exact local mint simulator that recovers the NFT's own application and module workbench byte-for-byte (8,120,812-byte runtime, 735,615-byte workbench) behind a pinned, read-only, wallet-isolated RPC bridge, plus a static "frozen" export that replays recorded reads only. 234 UI + 38 confluence + 8 owner-safety + 19 workbench + 11 simulator/replay checks recorded passing; no Solidity changes; no public-chain claims.
4. The Sepolia `--recipient` hardening on the pj8cqs branch is a stricter superset of what main already has (mandatory on recovery as well as first mint).
5. Nothing in these six branches contains unmerged research/design essays on NFT standards, gamification, fee structures or privacy; the valuable unmerged content is a deployment record and a GUI/simulator implementation with evidence.
