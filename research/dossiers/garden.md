# Pixel-Garden — consolidated dossier

Repository: `/home/user/Pixel-Garden` (GitHub `venividis/Pixel-Garden`), checkout `aeb0184` ("Merge pull request #9 from venividis/codex/resolve-merge-conflicts"), identical to `main`. 60 commits between 2026-09-25 ("Initialize Pixel Garden cartridge build") and 2026-09-29 (codex security PRs #3–#9). No tags, no divergent branches, no public-chain deployment, no audit. Every number below is from the repository's own evidence (`docs/evidence/*.json`, `docs/BUILD-STATUS.md`) or was re-measured here by reading source; `out/` is gitignored and nothing was compiled or run for this dossier.

This dossier synthesises three reader reports (contracts; web/SDK/tools; docs/boards/research). Where the readers disagreed, the source was checked and the resolution is stated inline. The GOAL it is measured against: one ERC-721 whose mint gives the holder, inside the NFT, a swap, a messaging/crypto-social layer, a launchpad and a vault; the token "mints a website" served from chain over its own metadata/`web3://` surface; a visitor connects a wallet, the app verifies they hold (or are authorised by the holder of) the NFT, and then they use all four; no server, no IPFS.

---

## 1. Identity and thesis

Pixel Garden calls itself "an NFT-owned application environment" (`README.md:3`). One ERC-721 collection, `PixelGardenKernel` ("Pixel Garden" / "GARDEN"), mints "Gardens". In the mint transaction each Garden receives **two canonical ERC-6551 accounts**: **Reach**, a bounded working wallet that can withdraw assets and dispatch one typed call shape into reviewed application contracts, and **Grip**, a receiving-only vault whose security is the literal absence of any outbound function. The kernel also holds one **frozen browser host** (a ≤196,608-byte raw HTML archive pinned once before the first mint and served by `document(id)` and `tokenURI(id)`), an owner-curated **catalog** of "cartridge" NFTs, append-only **state archives** per application namespace, a permanent **position index**, and explicit **ownership-transition grants**.

The unit of extension is the **cartridge**: a separate ERC-721 collection. Content cartridges are archived HTML apps run in sandboxed iframes; runtime cartridges are immutable Solidity contracts admitted into the kernel **by code hash**, never by address or allowlist. Ten runtime families exist: 1 Market, 2 Locks, 3 Social, 4 Continuity, 5 Estate, 6 Presale, 7 Curve, 8 Liquidity, 9 Launchpad, 10 OTC. The thesis that organises everything is repeated in nearly every document and stated as an order in `AGENTS.md:40`: **"Missing Solidity rules cannot be added later with browser code."** That sentence explains why there are ten pinned families instead of one upgradeable module, why the kernel is 791 bytes under EIP-170, why the host has 65 bytes of headroom, and why every feature shipped since 27 September lives in a separately archived, SHA-256-pinned "trusted workspace".

Lineage matters for the merge. `src/storage/OnchainApp.sol` and `OnchainAppDirectory.sol` are derived from IPSEITY-FINAL at commit `c22cd8cb…` (MIT, `THIRD-PARTY-NOTICES.md:19`); `ArchiveFactory` adapts IPSEITY's `ModuleArchiveFactory`; `GardenAccount.sol:7` says "Inspired by IPSEITY-FINAL IpseityAccount/GripVault". `docs/MASTER-PLAN.md` (4,842 lines) carries in Appendix A a full declaration index of that IPSEITY branch, including `src/modules/*`, `ModulePortal.sol` and `src/sovereign/SovereignIpseity.sol`; **none of those files exist in the sibling `/home/user/Most-Advanced-NFT-Possible/src` checkout** (verified: no `src/modules`, no `src/sovereign`). The appendix is therefore the only record in this workspace of IPSEITY's module registry and of the single-contract "SovereignIpseity" design.

Stated product priorities (`docs/REQUIREMENTS.md:14-17`, `docs/LAUNCHPAD-CREATION.md:3`): swaps and launchpad first; new ERC-20 creation and permissionless custom Uniswap v4 hooks mandatory since 28 September 2026. Everything else follows a 20-board reference design plus an approved Board 21 (OTC); the ledger in `docs/BOARD-IMPLEMENTATION.md` claims the software of every board implemented but none "accepted".

Against the GOAL: Pixel Garden already does "mint → the token's own URL serves the app → connect wallet → owner-only controls enforced on chain" and already contains a swap, a social layer with encrypted DMs, a launchpad (token factory + hook factory + three sale modes) and a two-account vault. Its three deliberate differences from the GOAL are: the swap routes to **external Uniswap v3/v4** (no per-token AMM); the social layer keeps **post bodies in storage** (not logs); and the **tested** delivery route is an HTTPS reader that re-verifies the on-chain host (native `web3://` rendering is documented as untested).

---

## 2. Architecture

### 2.1 Text diagram

```
                        ┌──────────────────────────────────────────────────────────┐
                        │  PixelGardenKernel  (ERC-721, 23,785 B, 791 B headroom)   │
                        │  • custodyEpoch[id]  (uint256, ++ on EVERY transfer)      │
                        │  • host: one frozen raw Archive ≤196,608 B (freezeHost)   │
                        │  • document(id) = host.readAll() ‖ <script>PIXEL_CONTEXT  │
                        │  • tokenURI(id)  = data:application/json,%7B… animation_url│
                        │  • runtimeFamily(addr) = f(extcodehash) ∈ 1..10           │
                        │  • applicationAction(app, action) → 0/1/2 policy          │
                        │  • content catalog / application catalog / state archives │
                        │  • positionList, continuity/estate grants, sealTransfer   │
                        └───────┬───────────────────────────────┬──────────────────┘
                 mint creates   │                               │ mint creates
                 (CREATE2 via   ▼                               ▼  (CREATE2 via registry)
     ┌──────────────────────────────┐             ┌────────────────────────────────┐
     │ ReachAccount (17,714 B)      │             │ GripAccount (1,933 B)          │
     │ owner()=ownerOf(id) if ready │             │ receive + ERC721/1155 hooks     │
     │ withdrawETH/ERC20/721/1155   │             │ NO withdraw, execute, approve,  │
     │ sealAsset/sealAll (ratchet)  │             │ upgrade, 1271 — by construction │
     │ grantSession(recipe,uses)    │             └────────────────────────────────┘
     │ executeCartridge(Call,rev)   │
     │ executeSwapToLock(swap,lock) │   holds cartridge editions (ERC-721) in Reach or Grip
     └───────────┬──────────────────┘
                 │ IApplicationNFT.execute{value}(gardenId, Call)   (≤2 spend, ≤2 receiveMin, exact deltas)
                 ▼
 ┌────────────┬────────────┬────────────┬────────────┬────────────┬────────────┬────────────┐
 │ 1 Market   │ 2 Locks    │ 6 Presale  │ 7 Curve    │ 8 Liquidity│ 9 Launchpad│ (3,4,5,10) │
 │ v3/v4 swap │ vesting    │ fixed-price│ lot curve  │ sorted v4  │ ERC-20 +   │ Social,    │
 │ ETH/v4 LP  │ maturity   │ → Market LP│ → Liq. LP  │ pairs, v2  │ v4 hooks   │ Continuity,│
 │ exit       │ sales      │            │            │ fee share  │ (CREATE2)  │ Estate, OTC│
 └─────┬──────┴─────┬──────┴─────┬──────┴─────┬──────┴─────┬──────┴────────────┴────────────┘
       │ commitment handshakes (launchContext / saleContext = keccak(domain, chainid, kernel, …))
       ▼
   Uniswap v3 SwapRouter02 · v4 PoolManager/PositionManager/StateView · Permit2 · WETH · v2 Router
   (config/ethereum.json — mainnet addresses only)

 Families 3,4,5,10 have NO Reach policy: they authenticate ownerOf(gardenId) + live custodyEpoch
 + applicationActive(...) directly, and call back into the kernel only for transitions/rentals.

 ┌──────────────────────────── storage substrate (shared with IPSEITY lineage) ───────────────────┐
 │ ArchiveFactory → AppChunk (0x00‖payload ≤23,000 B, CREATE2 salt = sha256(payload), deduped)     │
 │               → OnchainApp (≤32 chunks, sha256 verified on-chain via precompile 2, readAll())    │
 │               → OnchainAppDirectory (≤16 leaves = 512 chunks = 11,776,000 B, no readAll())      │
 │ ContentCartridge (ERC-721 "SEED"): publish(appKey, schema, content, manifest) → releaseId;       │
 │   mintEdition / openEditions (irreversible) / claimStarter; gardenMetadata() formatter           │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 Browser: frozen host (196,543 B) → trusted-*.js workspaces (SHA-256 pinned at build) → content
 cartridges in <iframe sandbox="allow-scripts"> with CSP connect-src 'none' and a MessageChannel
 capability bridge. HTTPS reader (dist/launcher.html) refuses any host whose expandedHash ≠ __HOST_HASH__.
```

### 2.2 How the pieces connect

**Deployment order** (`docs/FINANCIAL-CARTRIDGES.md:7-9`, `tools/fixture-kernel.mjs`): `ArchiveFactory` → `ContentCartridge(factory)` (its runtime hash is compiled into `src/generated/ContentRuntimeHash.sol` by a two-pass compile) → `PixelGardenKernel(maxSupply, contentCartridges, marketHash, locksHash, socialHash, continuityHash, estateHash, presaleHash)` (families 7–10 come from `src/generated/ExtensionRuntimeHashes.sol`) → publish `dist/kernel-host.html` as a raw archive → `freezeHost` → mint → publish releases → deploy runtime cartridges *after* the kernel (`MarketCartridge(kernel, Config, releaseId)` etc.; only the release publisher can deploy its runtime) → `mintEdition` into Reach or Grip → owner calls `acceptApplication`/`acceptCartridge` → `openEditions`.

**How the token owns things.** Ownership is never an address stored in the kernel. Reach and Grip are CREATE2 derivations through the canonical ERC-6551 registry (`0x000000006551c19487814612e58FE06813775758`, runtime hash `0xda1d…6735` checked at kernel construction and at every mint) with salts `keccak256("pixel.garden.reach.v1")` / `keccak256("pixel.garden.grip.v1")`. `isCanonicalAccount(candidate, id, gripRole)` (`PixelGardenKernel.sol:281-299`) recomputes the address *and* compares `candidate.codehash` to the exact 173-byte ERC-1167 forwarder runtime; a reported `token()` is never trusted. Cartridge editions are ERC-721s *held by* Reach or Grip; acceptance requires the current owner, the live `custodyEpoch`, a ready account, and (for applications) a known family, `app.garden() == kernel`, `app.contentCollection() == contentCartridges`, and an existing release. Acceptance records an `activationEpoch`; "Receipt alone is inert" (`:330`). Positions created by Market/Liquidity are recorded in the kernel's `positionList` so settlement (`applicationAction == 2`) works after the software is disabled, removed, or the Garden sold.

**Three epochs** bind everything: `custodyEpoch` (kernel, per Garden, bumps on every transfer including self-transfer and succession), `activationEpoch` (per installation), `transferEpoch` (per content/runtime edition). Every session, membership, key, plan, offer, listing and grant stores the epochs it was created under and is checked live; "transfer-away-and-back" never revives anything.

**Ownership transitions** are the only path by which software may move the Garden: the owner grants `authorizeContinuity`/`authorizeEstate` to one exact application address of the right family; the application later calls `executeContinuity`/`executeEstate` with the grant's epoch and revision; the kernel sets `transition = 1`, `_safeTransfer`s, and blocks nested transfers while `transition == 2` is inside the receiver callback (`:698-720`). `sealTransfer(until)` is a forward-only ratchet that blocks every parent transfer including succession.

---

## 3. Complete contract / module inventory with reuse verdicts

Sizes are runtime/initcode bytes from `docs/evidence/otc-board-21.json` (latest full artifact table); Social is updated from `docs/BUILD-STATUS.md` after the UTF-8 fix. Line counts were re-measured with `wc -l`.

### 3.1 Solidity (`src/`, 34 files, 8,641 lines)

| File | Lines | Size (rt/init) | Role | Verdict | Reason |
|---|---:|---:|---|---|---|
| `PixelGardenKernel.sol` | 810 | 23,785 / 45,494 | ERC-721 identity core: accounts, epochs, host, catalogs, state, positions, transitions, `tokenURI` | **adapt** | The "mint a website" + two-account core is exactly the GOAL's shape; the ten-family constructor, Uniswap-specific policy table and 791 B headroom require re-cutting |
| `PixelGarden.sol` (legacy) | 847 | 24,331 / 24,997 | Pre-kernel monolith with in-contract treasuries, 4 KiB storage chunks, swaps/launch/vesting | **drop** | Superseded; every idea migrated; kept only for `LEGACY_HOST=1` |
| `accounts/AccountBinding.sol` | 83 | library | ERC-6551 constants, `runtime()`, `predict()`, `token()` footer parser | **reuse-verbatim** | Correct, minimal, registry-codehash-pinned; rename salts |
| `accounts/GardenAccount.sol` | 76 | abstract | `owner()` fails closed unless canonical+ready; `isValidSignature → 0xffffffff`; receivers | **reuse-verbatim** | Shared base for both accounts |
| `accounts/GripAccount.sol` | 13 | 1,933 / 2,106 | Receive-only vault; `state() → 0`; nothing else | **reuse-verbatim** | This *is* the GOAL's vault; security = absence of code |
| `accounts/ReachAccount.sol` | 450 | 17,714 / 17,970 | Typed withdrawals, ratchet seals, exact-recipe sessions, `executeCartridge`, `executeSwapToLock` | **adapt** | Best holder-controlled executor among the repos; needs epoch-bound ERC-1271 and a wider asset envelope for LP |
| `storage/ArchiveTypes.sol` | 15 | struct | `Archive{archive, schema, compression, storedHash, storedBytes, expandedHash, expandedBytes, codeHash}` | **reuse-verbatim** | Descriptor format |
| `storage/OnchainApp.sol` | 78 | 917 / 1,944 (+ AppChunk 16 / 338) | STOP-prefixed data chunks; leaf verifies sha256 in place via precompile 2; `readAll()` | **reuse-verbatim** | Proven; swap `require` strings for custom errors if size matters |
| `storage/OnchainAppDirectory.sol` | 88 | 2,083 / 3,497 | ≤16 leaves, re-verifies leaf codehash per read; **no `readAll`** | **reuse-verbatim** | Add `readAll` only if a directory may ever be a host (see §10) |
| `storage/ArchiveFactory.sol` | 111 | 8,676 / 8,702 | CREATE2 chunk dedupe by sha256, archive/directory creation, `validateArchive` | **reuse-verbatim** | No admin, no mutable reader; adapted from IPSEITY `ModuleArchiveFactory` |
| `cartridges/ContentCartridge.sol` | 219 | 8,898 / 17,774 | Release registry + transferable editions + starter claims + `validateName` (UTF-8) + `gardenMetadata` | **adapt** | Release/edition/starter model is good; the metadata builder is kernel-specific and should be rewritten for the unified token |
| `cartridges/OpenEditionNFT.sol` | 35 | abstract | Irreversible `openEditions`, reentry-safe `claimStarter` | **reuse-verbatim** | Opt-in pattern for third-party apps |
| `cartridges/RuntimeNFT.sol` | 116 | abstract | Shared app-NFT base: identity fields, `guarded`, `_authorize`, exact `_pull`/`_send` | **reuse-verbatim** | Base for every app module in the unified protocol |
| `cartridges/MarketCartridge.sol` | 685 | **24,340 / 25,587** (236 B headroom) | v3 exact-input, v4 exact-input with hookData, ETH/token v4 LP seed, exit; `executeVestingSale`, `executePresaleLaunch` | **adapt** | The swap pillar; at the cap — split v3/v4 or merge with Liquidity |
| `cartridges/LocksCartridge.sol` | 417 | 14,275 / 15,060 | Fixed-beneficiary vesting; beneficiary-authorised maturity sales; aggregate solvency | **adapt** | Vault timelock primitive; keep permissionless `claim`/`executeSale`; drop the off-chain keeper |
| `cartridges/SocialCartridge.sol` | 524 | 16,297 / 17,562 | Rooms (Commons = room 0), posts, reactions, moderation, bans, cooldowns, P-256 key registry, whispers, EIP-712 identity + retirement | **adapt** | The messaging pillar; decide storage-posts vs log-posts (IPSEITY Parley) |
| `cartridges/ContinuityCartridge.sol` | 279 | 8,796 / 9,581 | Dead-man succession with explicit check-in | **adapt (optional, defer)** | Readers split (adapt vs drop); not one of the four pillars but 8.8 KB and self-contained — idea bank, phase 3 |
| `cartridges/EstateCartridge.sol` | 525 | 19,044 / 19,833 | Visual-trait rentals + inventory-digest NFT sale | **adapt sale half / drop rental** | Inventory-digest consignment is valuable for a vault-bearing NFT; rentals are renderer-specific |
| `cartridges/PresaleCartridge.sol` | 430 | 17,886 / 18,675 | Fixed-price ETH presale, fully funded, graduates into Market LP, buyer vesting | **adapt** | Launchpad sale mode A |
| `cartridges/CurveCartridge.sol` | 375 | 19,847 / 20,636 | Ascending-price lot sale (closed-form cumulative cost), ETH or ERC-20 quote, graduates into Liquidity LP | **adapt** | Launchpad sale mode B |
| `cartridges/LiquidityCartridge.sol` | 476 | 22,330 / 24,250 | Sorted v4 pairs (any), v2 swaps, fee share with remainder carry, `graduate` | **adapt** | Best general v4 LP primitive; merge with Market's native path |
| `cartridges/LaunchpadCartridge.sol` | 150 | 9,846 / 10,635 | CREATE2 fixed-supply ERC-20 to Reach; CREATE2 user-authored v4 hook with on-chain flag check | **adapt** | Launchpad "create" core |
| `cartridges/LaunchToken.sol` | 29 | 1,536 / 2,746 | OZ ERC-20, fixed supply, no mint/upgrade/tax | **reuse-verbatim** | |
| `cartridges/OTCCartridge.sol` | 359 | 15,370 / 16,159 | Named-party bundle escrow (≤8 assets/side), broker fee, per-side refunds | **adapt (phase 2)** | Readers split; it is the natural "negotiate in a room, settle on chain" bridge between social and swap |
| `interfaces/Applications.sol` | 67 | — | `Call`, `AssetLimit`, `LockTarget`, `IApplicationNFT`, `IApplicationKernel` | **reuse-verbatim** | The typed-call ABI is the heart of the design |
| `interfaces/HookConfig.sol` | 30 | — | v4 flag mask, four return-delta prerequisites, fee/hookData validation | **reuse-verbatim** | |
| `interfaces/Markets.sol` | 58 | — | PoolKey, IV3Router, IWETH, IPermit2, IPoolManager, IPositionManager, IStateView | **reuse-verbatim** | |
| `interfaces/Liquidity.sol`, `Presales.sol`, `VestingSales.sol` | 73/63/59 | — | Seed structs + commitment domains `pixel.curve.graduation/1`, `pixel.presale.launch/1`, `pixel.garden.vesting-sale/1` | **adapt** | Rename domains |
| `generated/ContentRuntimeHash.sol`, `ExtensionRuntimeHashes.sol` | 4/9 | — | Compiler-written pins | **rewrite** | Regenerate per build |
| `vendor/ERC721.sol`, `Base64.sol` | 913/175 | — | Solady (MIT) | **reuse-verbatim** | |

### 3.2 Browser host, launcher, SDK, tools (28,612 lines of JS)

| Module | Verdict | Reason |
|---|---|---|
| `tools/host-encoding.mjs` (radix-85 codec), `tools/verify-source.mjs`, `tools/rpc-relay.mjs` | **reuse-verbatim** | Small, correct, product-neutral |
| `tools/compile.mjs` (two-pass pin, EIP-170 gate), `tools/build-kernel.mjs`, `tools/build-launcher.mjs`, `tools/fixture-kernel.mjs`, `tools/recover-cartridges.mjs`, `tools/package-cartridge.mjs` | **adapt** | Pipeline shape is excellent; cartridge list and caps are project-specific |
| `tools/maturity-keeper.mjs`, `ops/maturity-keeper.service`, `sdk/maturity-keeper.mjs` | **drop** (pattern only) | A long-running server process contradicts the GOAL; keep permissionless `executeSale` so anyone can run it |
| `sdk/archive/{format,chain,hash,host-document}.mjs`, `sdk/discovery.mjs`, `sdk/host-modules.mjs` | **reuse-verbatim** | Archive format, chunk planning, pinned-block recovery, reorg checks; rename schema strings |
| `sdk/archive/publication.mjs`, `sdk/state.mjs`, `sdk/transactions.mjs`, `web/kernel/transaction-store.mjs`, `web/kernel/publications.mjs` | **adapt** | Durable pre-broadcast journals; the "never auto-resend" discipline |
| `sdk/whispers.mjs`, `sdk/whisper-ratchet.mjs`, `sdk/sealed-packets.mjs` | **reuse-verbatim** | Browser-native P-256 ECDH/HKDF/AES-GCM envelopes, X25519 Double Ratchet, passphrase-sealed backups |
| `sdk/social.mjs`, `sdk/social-board.mjs` | **adapt** | EIP-712 identity, post/whisper canonicalisers, room readers — re-target to the unified ABI |
| `sdk/financial-recipes.mjs`, `sdk/launchpad.mjs` (incl. `mineHook`), `sdk/launch.mjs`, `sdk/liquidity.mjs`, `sdk/presale.mjs`, `sdk/locks.mjs`, `sdk/swap-lock.mjs`, `sdk/otc.mjs`, `sdk/hook-inspector.mjs`, `sdk/history-checkpoints.mjs` | **adapt** | Typed-recipe builders and pinned readers; Uniswap plumbing re-targeted per chain |
| `web/kernel/client.mjs` (`GardenClient`), `web/kernel/host.mjs` (sandbox + bridge), `web/launcher/*` (reader), `web/kernel/a11y.mjs`, CSS | **adapt** | The connect → verify → operate flow and the reader-as-verifier; the 24-workspace shell is far beyond scope |
| `web/kernel/{wallet-choice,read-console,mint-seed}.mjs`, `web/cartridge-api.mjs` | **reuse-verbatim** | EIP-6963 discovery, send-less pinned console, receipt-derived mint id, cartridge-side bridge |
| `web/kernel/studio*`, `worlds*`, `crystal*`, `board-art`, `experience.mjs`, `workspace.mjs`, `*-accounting`, `owner-performance`, `venue-history`, `ens*` | **drop** | Art direction and board-specific analytics |
| `tools/build.mjs`, `tools/fixture.mjs`, `web/host.mjs`, `web/finance.mjs`, `web/journal.mjs`, `web/rpc.mjs`, `sdk/packages.mjs` | **drop** | Legacy host stack |
| `test/contracts/*` (16 adversarial fixtures) | **adapt** | Reentry routers, taxed tokens, forged accounts, receipt-bound receivers, impairment tokens |
| `docs/MASTER-PLAN.md` Appendix A | **reuse-verbatim as reference** | Only surviving index of IPSEITY's module system and `SovereignIpseity` |
| `THIRD-PARTY-NOTICES.md` | **reuse-verbatim** | Clean MIT provenance |

---

## 4. How the website is delivered and how ownership is verified

### 4.1 Delivery — from chain, with an HTTPS verifier as the tested route

**The host is on chain.** `tools/build-kernel.mjs` bundles `web/kernel/host.mjs` with esbuild, gzips it, encodes it in a custom radix-85 alphabet (printable ASCII 33–126 minus `" ' \ < >` and backtick — `tools/host-encoding.mjs:2`), and wraps it in a bootstrap that waits for `DOMContentLoaded`, decodes, inflates through `DecompressionStream('gzip')` and appends a `<script>` (`build-kernel.mjs:182`). The build omits the closing `</body></html>` on purpose and throws if the host exceeds 196,608 bytes (`:184`). The document is published as a raw `ArchiveFactory` archive and pinned once by `PixelGardenKernel.freezeHost` (`:229`): publisher-only, `totalSupply == 0 && host.archive == 0`, `compression == 0`, `expandedBytes ≤ 196608`, `validateArchive` passes. One-way; the first mint closes it forever.

**`document(id)`** (`:247-260`, verified) is `ownerOf(id)` → revert `InvalidHost` if unhosted → `abi.encodePacked(IHostArchive(host.archive).readAll(), '<script>window.PIXEL_CONTEXT={"chainId":"…","contract":"0x…","tokenId":"…"};</script></body></html>')`. One archive serves every token; the contract, not the client, injects identity. (The legacy `PixelGarden.sol` put the context *before* the host bytes; the kernel appends it. Both readers were right about their respective contracts.) `document(uint256,string)` (`:244`) returns identical bytes and exists so `web3://KERNEL:CHAIN/document/ID/string!index.html` resolves under ERC-6860 auto-mode with an HTML MIME hint.

**`tokenURI(id)`** (`:799`) delegates to `ContentCartridge.gardenMetadata` (`ContentCartridge.sol:79-129`, verified). For hosted Gardens it returns a **percent-encoded** `data:application/json,%7B%22name%22…` envelope with `reach`, `grip`, `external_url = web3://<kernel>:<chainid>/document/<id>/string!index.html` and `animation_url = data:text/html;base64,<document(id)>`. Load-bearing comment: "Percent-encode the small JSON envelope once. The base64 HTML alphabet is URI-safe. Re-encoding the entire HTML a second time would exceed ordinary RPC gas caps." Unhosted Gardens fall back to base64 JSON. Consumers must branch on the data-URI encoding; the result is ~262 KB.

**Apps inside the host.** Content cartridges run in `<iframe sandbox="allow-scripts">` (`host.mjs:1076`) with an injected CSP `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'` (`:1078`). The frame has no network; it posts `pixel.ready`, the host checks `e.source === activeFrame.contentWindow` (`:1088`), opens a `MessageChannel` (`:1092`) and sends `pixel.connect` with `port2` (`:1122`). Requests are typed, gated by the manifest's declared capabilities (`files.read`, `identity.read`, `journal.propose`, `state.read`, `state.write`, `transaction.propose`), and bounded to 120 per minute, 4 concurrent, 40,000-char JSON (`:1105`). `transaction.propose` never signs; it hands a request to `client.operation()` for the host's own review dialog.

**Trusted workspaces.** Because the host is at 196,543/196,608 bytes, large UIs (social, continuity, estate/OTC, locks, analytics, presale, finance, workspace, experience — 150–350 KB each) are archived separately. `web/kernel/trusted-*.mjs` recovers the archive, runs `verifyHostModule` (`sdk/host-modules.mjs:3`: "Recovery proves what was published. This separate check proves it is the host author's exact code.") against the build-time SHA-256 in `web/kernel/trusted.json`, and only then evaluates it with `new Function(...)` in the host realm. This is the project's answer to EIP-170 for front-ends: hash-pinned extensions the immutable host can load but never be tricked into replacing.

**The HTTPS reader.** `web/launcher/main.mjs` (built to `dist/launcher.html` by `tools/build-launcher.mjs`) refuses to start unless `(await core.hostArchive()).expandedHash === __HOST_HASH__` (`main.mjs:406`), recovers the host with `recoverGardenHost` (`sdk/launcher.mjs:78`), rebuilds the exact document with `recoveredHostDocument` (`sdk/archive/host-document.mjs:5`: "Rebuilding it from verified inputs avoids trusting a separate RPC response for active HTML"), and swaps the DOM with `DOMParser` + `replaceWith` because "document.write/open removes wallet message listeners" (`main.mjs:186-209`). The service worker caches only the shell. `docs/MINT-TO-APP.md:25` is explicit that native `web3://` clients "need wallet injection, persistent origin storage, Web Locks… and DecompressionStream… the HTTPS reader is the tested compatibility route", and `:35` that this "is not independent Ethereum consensus/proof verification".

**Independent recovery.** `npm run recover:cartridges -- RPC KERNEL ID dir` (`tools/recover-cartridges.mjs`) writes the host, every installed cartridge, journal, rooms, locks, presales, OTC deals and history to disk at one pinned block — the "project can die and the app survives" proof.

### 4.2 Ownership verification — client gate for UX, contract gate for authority

There is no login signature, no nonce, no backend. `docs/MINT-TO-APP.md:43`: "Public website bytes are not private NFT content. Wallet ownership enables management… **No backend login signature is needed for these onchain operations.**"

1. **Wallet discovery**: EIP-6963 announcements with bounded, deduplicated provider metadata (`web/kernel/wallet-choice.mjs`), `window.ethereum` fallback, `@metamask/connect-evm` for mobile QR. `GardenClient.connect()` (`client.mjs:159`) uses `eth_accounts` silently or `eth_requestAccounts` on gesture and requires `eth_chainId == PIXEL_CONTEXT.chainId`.
2. **Binding check**: `refresh()` (`client.mjs:120-152`, verified) reads `ownerOf`, `custodyEpoch`, `account`, `grip`, `accountReady`, `displayName`, `visualSeed` in one batch and throws `"Account binding failed"` unless `isCanonicalAccount` holds for both accounts.
3. **The gate**: `get owns()` (`:153`) is `this.account.toLowerCase() === this.owner?.toLowerCase()`. Every owner control renders disabled when `!owns`; the header shows "OWNER CONNECTED" or "PUBLIC VIEW · EPOCH n".
4. **Before every write**: `operation()` (`:206-235`, verified) re-runs `live()`, throws `"Only the current Garden owner can do this"`, then inside `guard()` re-checks token id, wallet network, wallet account (via `eth_accounts`), and `"Ownership or custody epoch changed. Review again."` immediately before the wallet prompt; it simulates with `eth_call`/`estimateGas` and journals the nonce before broadcast.
5. **On chain is the real gate**: kernel `_controller` (owner + live epoch + ready + not executing; operators excluded), `ReachAccount.authorized(epoch, recipient)`, `SocialCartridge._auth`, `OTC.propose`, Estate `_owner` — every one requires `msg.sender == ownerOf(id)` plus the live `custodyEpoch`. ERC-721 operators are deliberately excluded everywhere; a buyer's UI can never replay a seller's prepared call because the epoch moved.
6. **Non-owner experience**: former owners and strangers get a read-only view; permissionless claims (Locks, Presale, OTC refunds) stay available to any gas payer because the contract, not the UI, decides.
7. **Proof without a transaction**: `SocialCartridge.identityDigest/verifyIdentity` (`:450-520`) is an EIP-712 attestation (`"Pixel Garden Identity"` v1; type `Identity(address kernel,uint256 gardenId,uint256 custodyEpoch,bytes32 purpose,bytes32 challenge,uint256 deadline)`) verified via `SignatureChecker.isValidSignatureNow(ownerOf(id), …)` for EOA and ERC-1271 owners, with owner-retirable digests that outlive software removal.
8. **Delegation**: an agent connects its own wallet and calls `executeCartridge` under an owner-granted exact-recipe session; no agent key is minted by the host.

Verdict for the GOAL: this is the right model. "Authorised by the holder" maps to Reach sessions (spending) and to the EIP-712 identity attestation (proof). What it does not do is serve the site through an ERC-5219 router (IPSEITY's `Premises`), and it has not demonstrated native `web3://` rendering.

---

## 5. Swap

The swap is **family 1, `MarketCartridge`** (685 lines, 24,340 B — 236 bytes under EIP-170), supplemented by family 8 `LiquidityCartridge`'s v2 route. There is no per-token AMM; all price discovery is external Uniswap on mainnet addresses from `config/ethereum.json` (SwapRouter02 `0x68b3…Fc45`, PoolManager `0x0000…08A90`, PositionManager `0xbd21…ee9e`, StateView, Permit2, WETH, v2 Router).

**Call path.** Holder (or a session key) → `ReachAccount.executeCartridge(Call{application, edition, action, custodyEpoch, activationEpoch, deadline, spend[≤2], receiveMin[≤2], data}, sessionRevision)` → policy `kernel.applicationAction(app, action)` (verified table: family 1 actions 1–3 → policy 1 "needs active edition", action 4 → policy 2 "permanent settlement") → `_perform` (`ReachAccount.sol:389-449`): data cap 2,048 B, raised to 12,288 B for families 1/6/7/8 (hookData) and 50,176 B for family 9 (initcode); sorted, unique, disjoint spend/receive sets; per spend asset: not sealed, balance sufficient, native sent as `value`, ERC-20 given an exact approval only if current allowance is zero → `IApplicationNFT(app).execute{value}(gardenId, request)` → afterwards allowances reset and verified zero, spend balance ≥ before − cap, receive balance ≥ before + floor → nonzero `positionId` recorded in the kernel → `ApplicationExecuted`.

**Inside Market** (`MarketCartridge.sol:165-236`): same authorization as `RuntimeNFT._authorize` (caller must be the canonical Reach *and* `isExecuting()`); pulls ERC-20 inputs with exact deltas; native must equal `msg.value`. Action 1 `_swapV3`: SwapRouter02 `exactInput` with a raw validated path (43–112 bytes, `(len−20) % 23 == 0`, endpoints must equal input/output with WETH for native, wrap/unwrap internal, allowance zero before and after). Action 2 `_swapV4`: data = `(PoolKey, bool zeroForOne[, bytes hookData])`, `HookConfig.validate`, `_keyCheck` (sorted, tickSpacing 1..32767), `unlockCommitment = keccak256(data)` then `poolManager.unlock(data)`; `unlockCallback` (`:442-484`) re-checks caller and commitment, swaps exact-input with limit prices `4295128740` / `1461446703485210103287273052203988822378723970341`, requires `din < 0 && dout > 0`, `spent ≤ amount`, `out ≥ minOut`, then `sync/settle/take`. Action 3 `_seed` → `_seedPool` (`:549-635`): v4 `PoolKey(0, asset, fee, tickSpacing, hooks)`, optional `initialize`, `getSlot0` within `[minPrice, maxPrice]`, `validateArchive(terms)`, Permit2 approve → `modifyLiquidities(abi.encode(hex"020d14", params))` (MINT_POSITION, SETTLE_PAIR, SWEEP), approvals cleared and verified (noting "Permit2 normalizes an input expiry of zero to the current block timestamp", `:622`), owner/liquidity verified, `positions[id]` recorded. Action 4 `_exit` (`:636-675`): requires `settlementAllowed`, `receiveMin == [ETH minEth, asset minToken]`, principal only after `unlockAt`, `hex"0111"` (DECREASE_LIQUIDITY, TAKE_PAIR). Finally: "Preserve preexisting balances, return unused inputs, then remit observed outputs to Reach" (`:223`).

**Swap-to-lock.** `ReachAccount.executeSwapToLock(swap, LockTarget)` (`:315-366`) is owner-only, atomically swaps one asset and vests its *entire observed output* into a family-2 schedule with a `journalHash` note commitment, recording `swapLockLink[locks][scheduleId] = {market, recipe, journalHash}`. Measured on fork: v3 777,185 gas, v4 676,056.

**Maturity sales.** Locks' beneficiary can `authorizeSale(scheduleId, revision, Recipe)`; after maturity anyone calls `executeSale`, which reserves entitlement and sets `saleContext`/`executingMarket` *before* external calls (`LocksCartridge.sol:244`) and calls `Market.executeVestingSale` under a `VestingSales.commitment` handshake; "v4 partial fills revert". The documented race: a direct `claim` pre-empts a sale (status 3) — "best-effort execution, not a guaranteed timed sale".

**Liquidity family 8** adds v2 `swapExactTokensForTokens` with 2–5 path tokens and sorted ERC-20/ERC-20 v4 pairs (`hex"020d"` when neither side is ETH), fee-first zero-liquidity decrease, and a fee share to a fixed recipient with mulmod remainder carry (`:398-410`; 23,064 Wolfram-checked cases).

**Measured** (fork block 26,059,508): v4 swap 256,044 gas; v3 swap 309,529; launch 983,099; principal exit 258,209; maturity sale v3 428,658 / v4 383,991. Fixture v3 swap 310,025–313,351.

**Session exposure.** `sdk/financial-recipes.mjs:81 sessionExposure` computes the worst-case spend a session can authorise (cap × uses) so the UI can display it before the owner signs `grantSession`.

**Fit with the GOAL.** Strong as a *router* to external liquidity with exact-delta safety; weak as "a swap inside the NFT" because the venue is outside. The unified protocol should keep this as the external-venue swap module and pair it with a per-token AMM (IPSEITY `Pool`) for the self-contained case.

---

## 6. Messaging / social

**Family 3, `SocialCartridge`** (524 lines, 16,297 B): "Immutable, nonfinancial social software. Installation never authorizes asset spending. Records are public and append-only. Encryption and key backups happen in the trusted browser." Every Reach policy for family 3 is forbidden; `_auth(Auth{gardenId, edition, epoch, activation})` (`:160-167`) requires `kernel.ownerOf(gardenId) == msg.sender`, `accountReady`, `custodyEpoch == epoch`, `applicationActive(...)`.

**Rooms.** Room 0 is "The Commons" — "No moderator can close or erase it" (`:127-128`). `createRoom(Auth, title 1..96 B UTF-8-validated, inviteOnly)`; `invite`, `join`, `closeRoom`; per-member policy (`moderator`, `banned`) and per-room policy (`cooldown ≤ 7 days`, `repliesOnly`); `post(Auth, roomId, parent, bytes body ≤ 2,048)` with cooldown keyed by `keccak(gardenId, epoch)`; `moderate` (hide flag, never delete); `react(Auth, roomId, postId, bytes32 value)` — "Epoch in the identity prevents a reaction being attributed to a future owner" (`:395`). Posts are **stored in full** (`mapping(uint256 => Post[]) posts`, verified `:79`), with `Post{author, epoch, parent, time, bytes body, hidden}`.

**Whispers (DMs).** `announceKey(Auth, expectedVersion, bytes publicKey)` — empty revokes, else exactly 65 bytes starting `0x04` (uncompressed P-256); `currentKey(id)` returns the key only if announced in the current custody epoch. `whisper(Auth, to, expectedEpoch, expectedKey, bytes envelope ≤ 4,096)` requires a current recipient key, respects `setBlocked` (epoch-scoped), dedupes by `sent[keccak(from, fromEpoch, to, toEpoch, keyVersion, envelope)]`, and indexes into both `mail[]` arrays (verified `:435-436`). Browser crypto (`sdk/whispers.mjs`): ephemeral P-256 ECDH → HKDF-SHA-256 → AES-256-GCM, AAD binds chain/kernel/instance/both Garden IDs/both epochs/key versions; cleartext ≤ 1,024 B; keyring backups PBKDF2-SHA-256 310,000 iterations. Honest limit (`docs/SOCIAL-IDENTITY.md:27`): "Ciphertext, participants and timing are public. This design does not provide forward secrecy if a historical recipient key is later compromised." `sdk/whisper-ratchet.mjs` adds an optional X25519 Double Ratchet with a chain-authenticated offer/accept/complete handshake bound to on-chain participant epochs, `MAX_SKIPPED = 64`, copy-on-success state transitions, and five tests (replay rejection, out-of-order bounds, no mutation on auth failure, mismatched key material rejected). `sdk/sealed-packets.mjs` seals journal exports under a passphrase with scope/epoch in the AAD.

**Identity.** `identityDigest(id, epoch, purpose, challenge, deadline)` (`:450-482`), `retireIdentity` (owner-only, works without an active edition — "Revocation remains owner-controlled without an active software edition"), `verifyIdentity(..., signature)` via `SignatureChecker` (EOA or ERC-1271 owners). 15-minute UI expiry.

**Client.** `sdk/social.mjs` (EIP-712 types, `recoverSocial` replays rooms/posts/reactions at a pinned block), `sdk/social-board.mjs` (`REACTIONS` heart/wonder/grow, bounded inline image attachments ≤ 16 KiB, `readRoomPage`, conversation grouping), `web/kernel/social*.mjs` in the 196,001-byte `trusted-social.js` workspace. Recovery defaults: 128 rooms, 2,048 posts, 2,048 messages, 128 keys, 2,048 retired digests.

**Tests.** `test/social.test.mjs` (reader-reported 17 checks; the suite does not use the `check()` helper so the count was not re-verified here): owner/operator separation, stale epochs, no financial policy, ciphertext tampering, wrong keys, signature expiry/domain/custody binding, duplicate sends, substituted trusted-module bytes, malformed UTF-8 titles; `test/whisper-ratchet.test.mjs`; `test/browser-social.mjs` (10 groups).

**Weaknesses.** Storage-resident bodies (2 KiB posts, 4 KiB envelopes, unbounded `members[]`/`mail[]`/`posts[]` arrays) are expensive at scale; only the owner (not Reach or a session) may post; no room-level read ACL (everything is public); no group ratchet; ratchet state lives only in IndexedDB.

**Fit with the GOAL.** This is the richest social layer among the four repos: rooms + moderation + reactions + encrypted DMs + identity attestation with retirement + blocks, all epoch-bound. The storage-vs-logs decision must be taken against IPSEITY's Parley (back-linked event logs walked with single-block `eth_getLogs`): Parley is cheaper to write; Pixel Garden's model is readable with plain `eth_call` paging and supports moderation flags in place. The recommended synthesis is Parley-style log bodies with Pixel Garden's authority model, key registry, blocks, cooldowns and EIP-712 identity kept on chain.

---

## 7. Launchpad

The launchpad is four cooperating families:

**Family 9, `LaunchpadCartridge` + `LaunchToken`** (150 + 29 lines; 9,846 and 1,536 B). "Owner-selected token and custom-hook creation, with permanent Garden discovery." / "User initcode runs in its new contract, never by delegatecall in Garden custody." `deploymentSalt(id, nonce, salt) = keccak(chainid, garden, id, nonce, salt)`; `predictToken(id, TokenSpec)`. Action 1 CREATE2-deploys `LaunchToken(name 1..64, symbol 1..16, decimals ≤ 18, supply > 0, kernel.account(id))` — all supply to the Garden's Reach; OZ ERC-20 with "no additional mint function, upgrade, tax, blacklist or publisher allocation". Action 2 CREATE2-deploys user-authored hook initcode (1..49,152 B) with `msg.value == spec.value` matched by the single native spend; `HookConfig.flagsValid(flags)` and `uint160(created) & MASK == flags` verified on chain; `deploymentByNonce` reserved **before** `create2` ("Reserve before constructor execution. Every external runtime entry remains guarded." `:129`); constructor `msg.sender` is the runtime; empty code, duplicate nonce or flag mismatch reverts; permanent per-Garden record of address, kind, nonce, timestamp, initcode hash, runtime hash. No approval list. Browser-side `sdk/launchpad.mjs:48 mineHook` is an incremental, cancellable CREATE2 salt search for the 14 flag bits; `sdk/hook-inspector.mjs` + `tools/verify-source.mjs` let a user verify a hook's runtime against claimed source offline (16,384 flag combinations tested). Fork evidence: "real v4 initialization, LP mint and swap invoke launcher-authored callbacks with exact hookData and a nonzero afterSwap return-delta fee".

**Family 6, `PresaleCartridge`** (430 lines, 17,886 B): fixed-price ETH presale of an existing token, fully funded from Reach at creation (`spend == (seed.asset, inventory + seed.tokenMax)`), ratio as integer `num/den`, per-wallet allocation `floor(cumulative paid × num/den) − previous` (kills within-wallet partition rounding; creation requires `ceil(hardCap × num/den) ≤ inventory`), soft/hard caps, `opens/closes/finalizeBy ≤ 2^48−1`, optional buyer vesting `finalizeBy ≤ start ≤ cliff ≤ end ≤ 2^48−1` (verified: `PresaleCartridge.sol:231,239`), `finalize` → `Market.executePresaleLaunch{value: ethMax}` under `Presales.commitment` ("Anyone can launch only the immutable recipe. Failure rolls back all state and approvals."), `fail` (cancel before open, fail below minimum, refund after deadline), `claim(saleId, buyer)` by any gas payer, `claimRemainder`. Conservation identities (Wolfram-checked): `ETH raised = LP ETH + proceeds credit`; `funded tokens = LP tokens + buyer allocations + unused credit`. Fork: finalization 955,773 gas. 28 subchecks re-counted in `test/presale.test.mjs`.

**Family 7, `CurveCartridge`** (375 lines, 19,847 B): "Buy-only bootstrap: no prelaunch resale, virtual reserves, issuance or mutable terms." Lot `n` costs `basePrice + slope × n`; `cumulativeCost(lots) = lots·basePrice + lots(lots−1)/2·slope` (`:106-113`) so split purchases cannot change totals; ETH or ERC-20 quote; `buy(id, lots, maximumCost, deadline)`; `finalize` → `Liquidity.graduate{value}` under `Liquidity.commitment` into the committed sorted v4 pair; failed sales refund each buyer's exact paid quote.

**Family 8, `LiquidityCartridge`** (476 lines, 22,330 B): the graduation target and general LP primitive — any sorted pair, permissionless hook selection, LP locks (`unlockAt`), fee share with carry, v2 routes.

**Vesting for teams/buyers** uses family 2 Locks (`Terms{asset, beneficiary, amount, start, cliff, end}`, `claimable = mulDiv(amount, now−start, end−start) − claimed`, full-precision; "Permissionless gas payer; destination and schedule can never be changed.").

**Payload budgets** (`docs/LAUNCHPAD-CREATION.md`): family 9 action data ≤ 50,176 B; families 1/6/7/8 ≤ 12,288 B carrying ≤ 8,192 B hookData.

**Fit with the GOAL.** Complete: create a token (to the holder's own Reach), optionally ship a custom hook, sell via fixed price or ascending curve with escrowed proceeds, graduate into real LP, vest. It is an *escrowed* launchpad with real Uniswap LP, not a virtual-reserve bonding curve with sell-side — safer, but needs Uniswap on the target chain. Merge Presale + Curve into one "sale mode" enum under Launchpad and unify Market's native-pair seed with Liquidity's sorted-pair seed.

---

## 8. Vault / accounts

**Grip** (`GripAccount.sol`, 13 lines, 1,933 B, unchanged across every milestone): `constructor(garden) GardenAccount(garden, true)`; `state() → 0`; inherits `receive()`, `onERC721Received`, `onERC1155Received`, `onERC1155BatchReceived`, `token()`, `owner()`, `isValidSignature → 0xffffffff`, `isValidSigner → invalid`. "Permanent receiving-only custody. No execution, approvals, exits, upgrades or spending signatures." `test/accounts.test.mjs` "Grip rejects all exit/approval/upgrade selectors and retains assets" calls `withdraw*`, `execute`, `approve`, `setApprovalForAll`, `upgradeTo`, `rescue` and asserts every one reverts. Cartridge editions may be held in Grip (acceptance checks "held by canonical Reach **or** Grip") so an app can be installed into the vault without ever being withdrawable.

**Reach** (`ReachAccount.sol`, 450 lines, 17,714 B). Storage: `sessions[key] = {recipe, custodyEpoch, revision, expires, remainingUses}`, `swapLockLink`, `assetSealUntil[bytes32]`, `allSealUntil`, monotonic `state`, `isExecuting`. Modifier `authorized(epoch, recipient)` (`:101-111`): not executing, `msg.sender == owner()`, live epoch, recipient ∉ {0, self}, sets `isExecuting`, `++state`. API (verified signatures): `withdrawETH(address payable recipient, uint256 amount, uint256 epoch)`, `withdrawERC20(asset, recipient, amount, epoch)` with exact deltas on both ends else `InexactTransfer`, `withdrawERC721(asset, recipient, tokenId, epoch)` which calls `garden.invalidateCartridge` *first* so the outgoing callback sees an inactive installation, `withdrawERC1155`; `sealAsset(uint8 kind 0..3, asset, tokenId, until, epoch)` and `sealAll(uint64 until, uint256 epoch)` (`:209`: `until > now && until > allSealUntil`) — forward-only; `recipeHash(Call) = keccak256(abi.encode("pixel.garden.recipe/1", chainid, this, request))`; `grantSession(address key, bytes32 recipe, uint64 expires, uint32 uses 1..1024, uint256 epoch)` (resolves the readers' argument-order disagreement); `revokeSession(key, epoch)` bumps the revision; `executeCartridge(Call, sessionRevision)`; `executeSwapToLock`. `isValidSignature` is deliberately disabled: "Fail closed until a separately reviewed, epoch-bound signature schema exists" (`GardenAccount.sol:32`); `isValidSigner` returns the magic only for Reach and `signer == owner()`.

**Kernel-level vault controls.** `sealTransfer(id, until, epoch)` (`:741`) — "An explicit, non-shortenable lock on every parent NFT transfer, including succession." `_beforeTokenTransfer` (`:773-797`) rejects `to` ∈ {0, kernel, either implementation, own Reach, own Grip, any deployed canonical account of the collection} — no burn, no self-custody, no nesting into another Garden's account; blocks transfers while `minting`, `transition == 2`, or `Reach.isExecuting()`; `++custodyEpoch` ("Checked uint256 arithmetic; never wraps or saturates.").

**Timelocked vaulting** is family 2 Locks (fixed beneficiary, aggregate `escrowed[asset]` solvency, permissionless claims). `docs/AUTOMATIC-SALE-DESIGN.md:35`: "Matured escrow belongs to its fixed beneficiary, while Reach follows current Garden ownership."

**Inventory-bound sale** (Estate, `inventoryDigest(id)` `:355-383`) = keccak of `custodyEpoch, catalogRevision, Reach.state(), transferSealUntil, continuityApproval(+plan hash), rental(+digest), offerRevision, offer`; listing pins the digest plus up to 64 explicit balance floors over Reach/Grip ETH/ERC-20/ERC-721/ERC-1155; `buy` re-checks standing after payment and before `executeEstate`. "Catalog revisions bind every selected release/head and owner-controlled core change. Reach's monotonic state binds all seals, sessions and typed actions. Balances are explicit floors."

**Measured.** Mint creating both accounts: 299,485 gas; kernel deployment including both implementations: 9,431,421 gas; forwarder 173/183 B; registry 571 B.

**Design argument worth keeping** (`docs/MASTER-PLAN.md:154`): "Do not copy IPSEITY's saturating transfer counter as an authority clock; use a non-wrapping epoch and fail closed at exhaustion."

**Fit with the GOAL.** Grip is the vault. Reach is the working wallet with the right posture (typed-only, no arbitrary executor). Gaps: no ERC-1271 (so the Reach cannot sign for marketplaces/Permit2 signature flows), no ERC-4337, sessions keyed by caller address rather than signature, two-asset envelope too narrow for multi-asset LP, 17.7 KB.

---

## 9. The 20 most valuable unique ideas to carry forward

1. **Vault by absence of code.** `GripAccount.sol` (13 lines): a receiving-only ERC-6551 account with zero outbound selectors, verified canonical from the collection. The vault pillar in its cleanest form.
2. **Canonical-account proof without trusting `token()`.** `PixelGardenKernel.isCanonicalAccount` (`:281-299`) recomputes CREATE2 *and* compares the 173-byte forwarder codehash; `AccountBinding.token()` only parses a footer when `code.length == 173`.
3. **Non-wrapping custody epoch threaded through everything.** `custodyEpoch` (uint256, from 1, `++` on every transfer incl. self-transfer and succession) stored in sessions, seals, grants, keys, memberships, reactions, plans, offers, listings; nothing is revived by transfer-back (`test/accounts.test.mjs` "transfer/transfer-back epochs").
4. **Code-hash family admission with a kernel-side policy table.** `runtimeFamily(address) = f(extcodehash)` and `applicationAction(app, action) → {0 forbidden, 1 needs active edition, 2 permanent settlement}` (`:504-535`). Software is NFTs you hold in your own account; the kernel knows only hashes.
5. **One typed call shape with exact-delta reconciliation on both sides.** `ApplicationTypes.Call` (`interfaces/Applications.sol`), ≤2 spend/≤2 receiveMin, exact approvals zeroed and verified after, balance bounds checked by Reach *and* by the app (`RuntimeNFT._pull/_send`). Taxed/rebasing tokens revert by construction.
6. **Exact-recipe sessions with use counts.** `recipeHash` + `grantSession(key, recipe, expires, uses 1..1024, epoch)`; worst-case exposure = cap × uses (`sdk/financial-recipes.mjs:81`). Agent access without target/selector allowlists.
7. **Three ratchets.** `sealAsset` / `sealAll` (Reach) and `sealTransfer` (kernel) — one-way, owner-only, survive sale.
8. **Installation ≠ authority, and withdraw invalidates first.** `acceptCartridge` grants nothing; `withdrawERC721` calls `invalidateCartridge` *before* `safeTransferFrom` so the outgoing receiver callback already sees an inactive installation (`ReachAccount.sol:148`, `PixelGardenKernel.sol:398`).
9. **Freeze-once host + contract-injected identity.** `freezeHost` before the first mint; `document(id)` = archive bytes ‖ `<script>window.PIXEL_CONTEXT=…</script></body></html>` (`:247-260`); the build omits closing tags on purpose.
10. **Percent-encode the envelope, base64 the HTML once.** `ContentCartridge.gardenMetadata` (`:88-90`) — the only way a ~196 KB document fits an ordinary `eth_call` gas cap; `external_url` carries the ERC-6860 `string!index.html` address.
11. **Radix-85 gzip transport with the decoder stringified into the bootstrap.** `tools/host-encoding.mjs`, `tools/build-kernel.mjs:182`; alphabet excludes HTML delimiters, quotes and backslash; no global declarations in the loader.
12. **Hash-pinned trusted extensions to escape EIP-170 for the front-end.** `sdk/host-modules.mjs verifyHostModule` + `web/kernel/trusted.json` compiled into the host: recovered bytes must match a build-time SHA-256 before `new Function`.
13. **Reader = verifier.** `web/launcher/main.mjs:186-209,406`: `__HOST_HASH__` pinned at build, DOM swap via `DOMParser` + `replaceWith` (never `document.write`, which drops EIP-1193 listeners), SW caches shell only, never executes `animation_url`.
14. **Sandboxed cartridges with injected CSP and a capability bridge.** `host.mjs:1076-1122`: `sandbox="allow-scripts"`, `connect-src 'none'`, `MessageChannel` after exact-source `pixel.ready`, manifest-declared capabilities, 120/min, 4 concurrent, 40,000-char limit; `transaction.propose` never signs.
15. **Content-addressed chunks with descriptor pinning and a two-pass compiler pin.** `ArchiveFactory.createChunk` salt = `sha256(payload)`, dedupe, `validateArchive` re-checks reader codehash and stored/expanded hashes; `tools/compile.mjs:82-157` compiles Content first, writes its runtime hash into generated Solidity, verifies the final build matches ("never accept a caller-supplied identity hash").
16. **Commitment handshake between immutable contracts.** `launchContext`/`saleContext = keccak(domain, chainid, kernel, caller, ids, full terms, deadline)` set before the call, recomputed by the callee, `receive()` gated on `executingMarket` while the context is live (`LocksCartridge.sol:218-309`, `PresaleCartridge.finalize`, `CurveCartridge.finalize`).
17. **Receipt-bound safe-transfer callbacks.** OTC sets `receipt = keccak(kind, token, from, id, amount)` immediately before `safeTransferFrom`; `onERC*Received` must match and clear it; batch 1155 receipt reverts (`OTCCartridge.sol`).
18. **Inventory-digest consignment.** `EstateCartridge.inventoryDigest` (`:355-383`) + ≤64 balance floors + re-check after payment: sell the NFT together with a verified commitment to what its accounts hold and which rights are attached.
19. **Rounding that cannot be gamed by splitting.** Presale `floor(cumulative × num/den)` allocation; Curve telescoping `lots·base + lots(lots−1)/2·slope`; Liquidity fee share `floor((f×b + r)/10000)` with carried remainder (`LiquidityCartridge.sol:398-410`).
20. **Permissionless gas payers for fixed recipients, with a documented pre-emption race.** `claim`, `claimRent`, `claimCredit`, `settle`, `refund`, `finalize`, `executeSale` — "Anyone may pay gas but never redirect"; `VestingSales.md:62-69` documents that a direct claim pre-empts an automated sale rather than pretending timed execution is guaranteed.

Honourable mentions: CREATE2 hook deployment with on-chain flag verification and browser-side cancellable salt mining (`LaunchpadCartridge.sol:89-149`, `sdk/launchpad.mjs:48`); swap-to-lock with a journal-hash note commitment; the durable pre-broadcast transaction journal under Web Locks with classified `inspectTransaction` states and "an unknown broadcast is never resent" (`sdk/transactions.mjs`); snapshot-pinned, budget-bounded log readers with reorg detection (`sdk/discovery.mjs`); the independent recovery CLI for every feature (`tools/recover-cartridges.mjs`); `SovereignIpseity`'s per-token internal AMM + `swapMarketAndLock(autoSell)` + Merkle-rooted sessions as indexed in `docs/MASTER-PLAN.md:4607`.

---

## 10. Weaknesses, incompatibilities with the GOAL, and security debt

**Incompatibilities with the GOAL.**
- **No per-token AMM.** The swap is a bounded router to external Uniswap v3/v4/v2 on mainnet addresses (`config/ethereum.json`); chains without those deployments have no swap. The GOAL's "swap inside the NFT" needs an internal pool (IPSEITY `Pool`) alongside this router.
- **The tested delivery route is an HTTPS reader.** `docs/MINT-TO-APP.md:25,35` says native `web3://` rendering, MetaMask tile integration and consensus proofs are unverified; the reader and the read RPC are acknowledged trust dependencies. No ERC-5219 `request()` router exists (IPSEITY `Premises` does this).
- **Off-chain components crept in**: the maturity keeper (`tools/maturity-keeper.mjs`, `ops/maturity-keeper.service`, systemd), Geth `debug_traceTransaction` for internal-ETH history, archive RPCs for analytics. All optional, but they must be dropped, not carried.
- **Storage-resident social bodies** (2 KiB posts, 4 KiB envelopes, unbounded arrays) are costly versus log-based messaging.
- **Single chain, pinned.** `deploymentChainId` immutable; the ERC-6551 registry must exist at `0x0000…5758` with exact codehash `0xda1d…6735` or the kernel refuses to deploy; no multi-chain partitioning, no bridge.
- **Mint is free and permissionless** up to `maxSupply`; no price, no royalties (ERC-2981), no burn.

**Size debt.**
- Kernel 23,785 B (791 B headroom), initcode 45,494/49,152; Market 24,340 B (236 B — nothing can be added); host 196,543/196,608 B (65 B). The repo's own rule (`ESTATE-DESIGN.md:36`): "move pure validation/rendering into an already inventoried immutable component… never remove authorization, accounting or callback rules to fit" — which is how UTF-8 validation and the metadata formatter ended up in `ContentCartridge`.
- Ten families = six constructor hashes + four compiler constants; any new family or any fix to a runtime is a new immutable kernel and a new host freeze; already-minted Gardens cannot adopt new families (`docs/OTC-CARTRIDGE.md:48`).

**Security debt and foot-guns (verified).**
- **Directory host foot-gun.** `freezeHost` calls `validateArchive(archive)`, which accepts whatever `schema` the descriptor claims (`ArchiveFactory.sol:72-91`, `_known(archive, schema)`); `document()` calls `readAll()`, which only `OnchainApp` implements — `OnchainAppDirectory` exposes `readChunk` only (verified). Freezing a schema-2 directory would make `document()` and `tokenURI()` revert forever. One-shot and publisher-only, so low likelihood, but it must be closed (restrict `freezeHost` to schema 1 or add `readAll` to directories).
- **`new Function` on chain-recovered code** in the host realm for trusted workspaces — hash-pinned, but still evaluation of recovered bytes with wallet access.
- **No ERC-1271 on either account** (deliberately failing closed); no ERC-4337; sessions are address-keyed (an agent must transact from the key address).
- **Whispers lack forward secrecy** by default; the ratchet is "unreviewed"; ratchet state, whisper keys and journals live only in IndexedDB — loss without an exported sealed backup is unrecoverable.
- **Mixed error styles**: `OnchainApp`, `OnchainAppDirectory`, `LaunchToken` use `require` strings (`"CHUNK_SIZE"`, `"SHA256_MISMATCH"`, `"LEAF_CODE_CHANGED"`); everything else uses custom errors.
- **Tight coupling**: `EstateCartridge` imports the concrete `PixelGardenKernel` and `ReachAccount`.
- **Hard-coded v4 action bytes** (`0x02 MINT_POSITION, 0x0d SETTLE_PAIR, 0x14 SWEEP, 0x01 DECREASE_LIQUIDITY, 0x11 TAKE_PAIR`) and limit-price constants must be re-verified against the PositionManager version on each target chain.
- **Global single `transition`/`minting` locks** serialise all mints and transitions collection-wide.
- **`tokenURI` ~262 KB** — some marketplaces truncate data URIs; `web3://` is the real surface.
- **Token-compatibility policy**: taxed/rebasing/blacklisting tokens revert where detectable; "a later negative rebase may prevent settlement until solvency is restored"; no rescue path anywhere (deliberate, but a product risk).
- **Unaudited, undeployed.** The last five GitHub Actions runs "failed with empty step lists and no runner identity" (`BUILD-STATUS.md`); local runs are the only evidence. Evidence numbers drift between checkpoints (kernel gas 6.85M → 9.43M; Social 15,853 → 16,297 B); re-measure before quoting.

**Explicitly not implemented** (`docs`): reverse ENS, CCIP/wildcards, third-party marketplace protocols, ERC-7401 nesting, 4337 nonce handling, automatic migrations, runtime ES-module linking, Universal Router command streams, any hosted indexer.

---

## 11. Toolchain and testing approach, with measured numbers

**Toolchain.** solc-js `0.8.36+commit.8a079791`, `optimizer.runs = 1`, `viaIR = true`, `evmVersion = cancun`, `metadata.bytecodeHash = "none"` (`tools/compile.mjs:17-29`) — the last setting makes deployed-bytecode keccak a stable family identity; any whitespace change re-keys a family. Hardhat 2.29.1 is used **only as a chain** (`hardhat.config.cjs`: chainId 31337, `hardfork: "cancun"`, 30M gas, `allowUnlimitedContractSize: false`, optional mainnet fork via `DEV_FORK` + `MAINNET_RPC_URL`); compilation is `tools/compile.mjs`, which gates every `src/` contract at ≤24,576 runtime / ≤49,152 initcode (`:179-196`), compiles `ContentCartridge` and the four extension cartridges first to write `src/generated/*.sol`, then compiles everything and asserts the final hashes equal the pins. Cache keyed on compiler-script sha256, solc version, settings and every source/import hash; `PIXEL_DISABLE_COMPILE_CACHE=1` forces cold. Dependencies: `@openzeppelin/contracts 5.4.0`, `solady 0.1.26`, `ethers 6.17.0`, `@metamask/connect-evm 2.1.1`, `jsbi`; dev: Uniswap `sdk-core 7.19.4`, `v3-sdk 3.31.5`, `v4-sdk 2.4.1`, esbuild 0.25.12, playwright 1.62.1, solc.

**Commands** (`package.json`, verified): `npm run compile`, `npm run build`, `npm test` (`node --test --test-concurrency=1 test/*.test.mjs`), `npm run check` (compile → build → test), `npm run dev` (deploys a fixture, serves `document(1)` at `127.0.0.1:4173`), `npm run recover:cartridges`, per-suite `test:*` aliases, `test:financial-fork` / `test:ens-fork` (require `MAINNET_RPC_URL`, `FORK_BLOCK=26059508`), `keeper`.

**Test shape.** 67 entries under `test/`: 30 `*.test.mjs` node suites, 23 `browser-*.mjs` Playwright journeys, 6 fork runners, `test/contracts/` (16 adversarial Solidity fixtures: `ReentryRouter`, `ForgedAccount`, `AccountReceiver`, `SaleLossToken` with `erase`, `EstateAdversary`, `LaunchHookFixture`, `MultiAssetPoolFixture` with 90% fills — "Disposable accounting model; never counted as real-protocol evidence"), `test/fixtures/erc6551-registry.json` (571-byte canonical registry runtime installed via `hardhat_setCode`). Suites compile with `compile({tests:true})`, deploy with per-contract size assertions, snapshot/revert between checks, and write evidence JSON only after every check passes ("Write evidence only after every account check passed", `accounts.test.mjs:484`). Test names read as statements: "receipt is inert; only the correct Garden owner accepts Reach or Grip editions", "protocol callbacks cannot transfer the parent or exceed the temporary allowance", "wrong chain, changed snapshot, tampered payload and noncanonical receipt fail closed".

**Measured counts.** Latest `npm run check`: **396 automated tests**, zero failures/skips (`BUILD-STATUS.md`, 2026-09-29), progression 13 → … → 370 → 391 → 392 → 396. Re-counted subchecks per suite (`await check(`): accounts 14 (the "13" in one reader came from an older evidence file), cartridges 9, state 11, financial-cartridges 12, swap-lock 14, locks 11, vesting-sales 15, presale 28, finance-plus 24, otc 20; launchpad (8), social (17), continuity (12), estate (13) use a different helper and are reader-reported. Browser: 70 recovered groups (13 OTC, 12 Estate, 17 launcher, 28 host) + 8 OTC layout checks at 320/390/768/1440 px in the OTC Board 21 run; 240 functional groups + 128 layout checks + 3 keeper CLI checks in the earlier board-completion run (different runs, neither a superset). Fork at block 26,059,508: 49 protocol checks + 3 ENS checks (prior checkpoint), 3 focused OTC WETH checks (latest). Wolfram cross-checks: 23,064 fee-carry cases, 15,375 integer-scaling cases; 16,384 hook-flag combinations.

**Measured sizes** (runtime/initcode B): Kernel 23,785/45,494; Reach 17,714/17,970; Grip 1,933/2,106; forwarder 173/183; registry 571; ArchiveFactory 8,676/8,702; ContentCartridge 8,898/17,774; OnchainApp 917/1,944; OnchainAppDirectory 2,083/3,497; AppChunk 16/338 nominal; Market 24,340/25,587; Locks 14,275/15,060; Social 16,297/17,562; Continuity 8,796/9,581; Estate 19,044/19,833; Presale 17,886/18,675; Curve 19,847/20,636; Liquidity 22,330/24,250; Launchpad 9,846/10,635; LaunchToken 1,536/2,746; OTC 15,370/16,159; legacy PixelGarden 24,331/24,997. Host 196,543/196,608 (SHA-256 of the 196,273-byte Board 21 host: `22644b25…5117`). Archived entrypoints: market 78,815; studio 75,505; garden-game 60,858; journal 37,524; locks 34,968; eight launchers ≈ 23.3 KB. Trusted workspaces (Board 21 checkpoint): social 196,001; continuity 272,242; estate/OTC 293,236; locks 190,624; analytics 315,104; presale 153,676; finance 269,380; workspace 321,866; experience 345,673. Reader chunks 131,344 + 128,374 B; SW 1,254 B.

**Measured gas.** Kernel deploy incl. both implementations 9,431,421 (6,846,437 at M1); mint with both accounts 299,485; Market deploy 4,207,940–5,499,663; factory 1,924,941; Content 1,437,269–2,144,146; publication 1,481,342; edition mint 145,795; acceptance 313,438; state record 330,368; multi-leaf publication 9,099,937 for 736,037 B (33 refs, 2 unique chunks — "not a quote for 736 KB of unique code"). Fork: launch 983,099; v4 swap 256,044; v3 swap 309,529; exit 258,209; swap-to-lock 777,185/676,056; maturity sale 428,658/383,991; presale finalize 955,773; OTC propose 576,798 / fund 138,009 / settle 160,055 / refund 82,735.

**Budgets.** Chunk 23,000 B; leaf 32 chunks; directory 16 leaves = 11,776,000 B; expanded 16 MiB; manifest 16 KiB; state blob 32 KiB; browser recovery 2 MiB/release, 8 MiB total; dependency graph 64 releases, depth 16; log scans 20,000 blocks / 2,000-block chunks / 1,000 events; cartridge bridge 120/min, 4 concurrent, 40,000 chars, 180,000 ms timeout; Reach data 2,048 / 12,288 / 50,176 B; sessions 1–1,024 uses.

**CI** (`.github/workflows/verify.yml`): `npm ci` → Playwright Chromium → `npm run check` → dev server + 21 browser journeys + `keeper-integration` → artifact upload; a second `financial-fork` job at `MAINNET_RPC_URL=https://eth.drpc.org FORK_BLOCK=26059508`. The last five runs failed before any recorded step; the repo correctly refuses to count them as either pass or fail.

**Process rules worth copying.** Never write a test count before running the suite; record every size at every checkpoint; keep fixture results separate from fork results and label them; never auto-resend an unknown broadcast; evidence JSON is written only after all checks pass.

---

## 12. Integration plan — what becomes part of the unified protocol, and in what form

The unified protocol has five surfaces: website, swap, social, launchpad, vault. Pixel Garden's strongest contributions are the **vault/account model**, the **launchpad**, the **website delivery mechanics**, and the **social authority/crypto layer**; its swap is a router that complements (not replaces) a per-token AMM.

### 12.1 Verbatim files (copy, rename namespaces, keep tests)

- `src/accounts/AccountBinding.sol`, `GardenAccount.sol`, `GripAccount.sol` — the two-account model and the canonical-account proof. Rename salts to the unified protocol's domain.
- `src/storage/ArchiveTypes.sol`, `ArchiveFactory.sol`, `OnchainApp.sol`, `OnchainAppDirectory.sol` — the storage substrate (shared lineage with IPSEITY; this copy has the factory, dedupe and validation). Convert `require` strings to custom errors; add `readAll()` to directories *or* restrict host freezing to schema 1.
- `src/cartridges/OpenEditionNFT.sol`, `RuntimeNFT.sol` — the base for every app module (identity fields, `guarded`, `_authorize`, exact `_pull/_send`).
- `src/cartridges/LaunchToken.sol`.
- `src/interfaces/Applications.sol`, `HookConfig.sol`, `Markets.sol` — the typed-call ABI and v4 encoding checks.
- `src/vendor/ERC721.sol`, `Base64.sol` (Solady, MIT); `THIRD-PARTY-NOTICES.md` entries.
- `tools/host-encoding.mjs`, `tools/verify-source.mjs`, `tools/rpc-relay.mjs`.
- `sdk/archive/{format,chain,hash,host-document}.mjs`, `sdk/discovery.mjs`, `sdk/host-modules.mjs` (rename `pixel.garden.*` schema strings).
- `sdk/whispers.mjs`, `sdk/whisper-ratchet.mjs`, `sdk/sealed-packets.mjs`.
- `web/kernel/wallet-choice.mjs`, `read-console.mjs`, `mint-seed.mjs`, `web/cartridge-api.mjs`.
- `test/fixtures/erc6551-registry.json` and the adversarial fixtures in `test/contracts/` (`AccountMocks.sol`, `FinancialMocks.sol`, `OTCAdversary.sol`, `EstateAdversary.sol`, `SaleLossToken.sol`, `LaunchHookFixture.sol`, `MultiAssetPoolFixture.sol`).

### 12.2 Adapted modules (keep the design, re-cut the code)

**Kernel → unified token core.** Keep from `PixelGardenKernel.sol`: `_controller` (owner + live epoch + ready + not executing, operators excluded), `custodyEpoch` semantics, `_afterTokenTransfer` account creation before the receiver callback with `accountReady` flipped after, `_beforeTokenTransfer` recipient rejections and the `transition` guard, `isCanonicalAccount`, `freezeHost`/`hostArchive`/`document(uint256)`/`document(uint256,string)`, the content/application catalogs with activation epochs, `saveState`/`migrateState` CAS, `positionList`/`settlementAllowed`, `sealTransfer`, `authorizeContinuity`/`authorizeEstate`/`_transition`. Replace: the six-hash constructor + four compiler constants with a constructor-time array of `(runtimeHash, policyWord)` pairs; the Uniswap-specific `applicationAction` table with a per-family policy word; `tokenURI` delegation to a dedicated renderer. Mint *should install the fixed app set* (swap, social, launchpad, vault modules) so a fresh holder needs no publisher; keep `openEditions`/`claimStarter` for third-party apps. Size strategy: ANIMA's immutable EIP-2535 diamond (facets wired in the constructor, no `diamondCut`) is the better answer to EIP-170 than Pixel Garden's "push helpers into another pinned contract".

**Reach → unified working account.** Keep typed withdrawals, seals, exact-recipe sessions, `executeCartridge`, `executeSwapToLock`. Add an **epoch-bound ERC-1271** (hash must encode `custodyEpoch` and the account; never valid for session keys) so the account can sign Permit2/marketplace flows; widen `_limits` to ≥4 assets for multi-asset LP; consider signature-based sessions so an agent need not transact from the key address.

**Swap module.** `MarketCartridge` split into (a) a v3 exact-input module and (b) a v4 swap + sorted-pair LP module merged with `LiquidityCartridge` (native path = currency0 == 0). Keep the typed path validator, `unlockCommitment` callback, Permit2 cleanup with expiry normalisation, fee-first exit, remainder-carry fee share, position catalog. Per-chain `Config` instead of mainnet-only JSON. Pair it with an internal per-token pool (IPSEITY `Pool`) as the "always available" swap.

**Social module.** Keep `SocialCartridge`'s authority model (`_auth`, owner-only writes, epoch-scoped keys/blocks/reactions, Commons room 0, moderation flags, cooldowns, `identityDigest`/`retireIdentity`/`verifyIdentity`). Move post bodies and whisper envelopes to **events** with `prev` pointers (Parley style) while keeping on-chain indexes for `mail`, `members`, bans and key versions; bound arrays. Keep `sdk/whispers.mjs` and the ratchet unchanged.

**Launchpad module.** Merge `LaunchpadCartridge` (token + hook factory) with a sale-mode enum covering `PresaleCartridge` (fixed price) and `CurveCartridge` (ascending lots), both graduating into the unified LP module via one commitment domain; vesting via `LocksCartridge` (keep `claim`/`executeSale` permissionless; **drop** the keeper). Keep `sdk/launchpad.mjs mineHook`, `sdk/hook-inspector.mjs`, `tools/verify-source.mjs`.

**Vault module.** Grip verbatim; Locks adapted as the timelock; `sealTransfer` kept in the core; Estate's inventory-digest sale adapted as an optional "sell the NFT with its vault" listing (phase 3); rentals dropped.

**OTC** (phase 2): adapt `OTCCartridge` as the social-trade settlement primitive (negotiate in a room, settle with receipt-bound escrow). **Continuity**: idea bank / phase 3.

**Website delivery.** Keep: freeze-once host; `document()` with contract-injected context; percent-encoded envelope with base64 HTML once; radix-85 gzip bootstrap; hash-pinned trusted workspaces; sandboxed app frames with CSP + capability bridge; `GardenClient.operation()` guard (chain, account, epoch, activation, simulate, journal); reader-as-verifier with DOM swap. Add: an ERC-5219 `request()` router (IPSEITY `Premises`) so `web3://` serves pages and artwork routes natively, and target native `web3://` as the primary tested route with the HTTPS reader as fallback. Rewrite the UI: the 24-workspace board shell is far larger than the five surfaces need; the host must start well under its ceiling.

**Tooling.** Adapt `tools/compile.mjs` (two-pass pin, EIP-170 gate, cache), `build-kernel.mjs` (host + cartridge caps, trusted digests), `build-launcher.mjs`, `fixture-kernel.mjs` (as the mint → `tokenURI` → run integration test), `recover-cartridges.mjs` (every feature must have a no-UI recovery path), `package-cartridge.mjs`. Adopt the evidence discipline (`docs/evidence/*.json`, `BUILD-STATUS.md` newest-first, counts only after running).

### 12.3 Ideas only (re-implement, do not port)

- SovereignIpseity's per-token AMM + `swapMarketAndLock(autoSell)` + Merkle-rooted sessions and ModulePortal's ERC-5219 `/services` JSON front door (indexed only in `docs/MASTER-PLAN.md` Appendix A).
- Legacy `research/PixelGarden.extended.sol.txt`: rolling-root chunk commitment, `minRate` session shape.
- Inventory-digest consignment; two-sided escrow with independent per-side refunds; dead-man succession with explicit check-in.
- Non-wrapping epoch rule ("fail closed at exhaustion"); "installation ≠ authority"; "anyone may pay gas but never redirect"; "zero vs no answer are different facts".
- Pitfalls to copy into the unified CLAUDE.md: double-base64 `tokenURI` exceeds RPC gas caps; Permit2 expiry 0 → `block.timestamp`; derive mint ids from the receipt's `Transfer(0, …)`, never `totalSupply`; `document.write` drops EIP-1193 listeners; `URL.port` cannot carry chain ids > 65,535; validate UTF-8 before storing any ABI string; render generations for async reads; `try` alone does not survive a codeless address; `bytecodeHash: "none"` is required for reproducible pins; `allowUnlimitedContractSize` must stay false.

### 12.4 Drop

Legacy `PixelGarden.sol` and its host stack (`tools/build.mjs`, `tools/fixture.mjs`, `web/host.mjs`, `web/finance.mjs`, `web/journal.mjs`, `web/rpc.mjs`, `sdk/packages.mjs`); the maturity keeper and systemd unit; Estate rentals and visual traits; studio/worlds/crystal/board art; board-specific analytics, accounting, venue history, owner performance; ENS renewal; `src/generated/*` (regenerate); `config/ethereum.json` as a single mainnet file.

### 12.5 Sequencing

1. Core: kernel (re-cut, diamond-sized) + AccountBinding/GardenAccount/Grip/Reach + storage substrate + freeze-once host + `document()`/`tokenURI` + fixture-kernel integration test. Close the directory-host foot-gun on day one.
2. Vault + swap: Locks timelock; v3/v4 router module merged with Liquidity; internal pool from IPSEITY; `executeSwapToLock`.
3. Launchpad: token + hook factory; presale and curve sale modes; graduation; hook inspector.
4. Social: authority model + key registry + identity on chain; log-based bodies; whispers/ratchet SDK verbatim.
5. Website: reader-as-verifier, sandboxed frames, trusted workspaces, ERC-5219 router, native `web3://` test.
6. Phase 2/3: OTC, inventory-digest sale, continuity, ERC-1271/4337 on Reach, multi-chain partitioning.
