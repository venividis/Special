# Pixel-Garden — web host, launcher, SDK, tools (research report)

Repo: `/home/user/Pixel-Garden` (default branch, 60 commits, 2026-09-25 "Initialize Pixel Garden cartridge build" → 2026-09-29 codex security-fix merges). Area read in full: `web/**` (kernel/, launcher/, legacy host), `sdk/**`, `tools/**`, `ops/**`, `package.json`, plus the kernel entry points those files depend on (`src/PixelGardenKernel.sol` `freezeHost`/`document`/`tokenURI`/`isCanonicalAccount`, `src/cartridges/ContentCartridge.sol` `gardenMetadata`, `src/storage/*` reader ABI) and the docs/evidence that record measurements. The area is 28,612 lines of JS across `web/kernel/*.mjs`, `sdk/*.mjs`, `sdk/archive/*.mjs`, `tools/*.mjs`, `web/*.mjs`, `web/launcher/*.mjs` (`wc -l`). Nothing was modified, installed, built or run.

The GOAL this is measured against: one NFT that mints a website with a swap, a messaging/social layer, a launchpad and a vault, all on chain, where the site verifies NFT ownership before the holder can use it.

---

## 1. The two explicit questions, answered first

### 1.1 How is the web UI delivered?

Three distinct delivery surfaces exist, and only the first is "from chain".

**(a) The immutable on-chain host (canonical).** The host is a single HTML document built by `tools/build-kernel.mjs` and published as a raw archive through `ArchiveFactory` data chunks (each chunk contract is `0x00` STOP + payload, ≤23,000 bytes; `OnchainApp` leaves hold ≤32 chunks; `OnchainAppDirectory` holds ≤16 leaves = 512 chunks = 11,776,000 bytes). The kernel pins it once:

- `src/PixelGardenKernel.sol:229 freezeHost(ArchiveTypes.Archive calldata archive)` — publisher only, before the first mint, `compression` must be raw, `expandedBytes ≤ 196,608`. One-way.
- `src/PixelGardenKernel.sol:247 document(uint256 id)` — `readAll()` of the frozen archive concatenated with `<script>window.PIXEL_CONTEXT={"chainId":...,"contract":...,"tokenId":...};</script></body></html>`. The build deliberately omits the closing tags: `tools/build-kernel.mjs` comment, verbatim: "Optional closing tags are supplied by Kernel.document, after its bound identity context."
- `src/PixelGardenKernel.sol:244 document(uint256 id, string calldata)` — the ERC-6860 overload so `web3://KERNEL:CHAIN/document/ID/string!index.html` resolves with an HTML MIME hint. `web/launcher/main.mjs:154` labels this the "web3:// address" of each token card.
- `src/PixelGardenKernel.sol:799 tokenURI(id)` → `ContentCartridge.gardenMetadata` (`src/cartridges/ContentCartridge.sol:79`) which returns a **percent-encoded** `data:application/json,` envelope whose `animation_url` is `data:text/html;base64,<document(id)>` and whose `external_url` is the `web3://` address. Load-bearing comment, verbatim: "Percent-encode the small JSON envelope once. The base64 HTML alphabet is URI-safe. Re-encoding the entire HTML a second time would exceed ordinary RPC gas caps." Without a frozen host it falls back to a small base64 JSON with `reach`/`grip` fields.

So the website is literally inside the token's metadata: a marketplace or wallet that renders `animation_url` runs the whole app, and a `web3://` gateway serves it as a page.

**Transport inside the host.** The host JS/CSS is gzipped and encoded in a custom radix-85 alphabet (`tools/host-encoding.mjs:2` — printable ASCII 33..126 minus `" ' \ < > \``, first 85 symbols) so the payload is safe inside an HTML `<script>` without escaping. The bootstrap, built as a string in `tools/build-kernel.mjs`, waits for `DOMContentLoaded`, decodes, inflates through `DecompressionStream('gzip')`, and appends a `<script>` element; on failure it writes "Host recovery failed: " + message. Measured: host 196,273 of 196,608 bytes at the OTC Board 21 checkpoint (`docs/evidence/otc-board-21.json`, SHA-256 `22644b25713826906da032846629ec3b5b0078a80bdc805c0f9dcefea5b95117`), 196,543 after the dependency-bound fix — 99.8% full, which is why so much UI lives in separately archived "trusted workspaces" and sandboxed cartridges (see 5.4).

**(b) The HTTPS reader / launcher (`web/launcher`, built by `tools/build-launcher.mjs` to `dist/launcher.html` + `launcher-chunks/*` + `garden-sw.js` + `garden.webmanifest`).** This is a conventional static site whose only job is to *recover* the on-chain host and verify it before running it. `web/launcher/main.mjs:406` refuses to start unless `(await client.core.hostArchive()).expandedHash.toLowerCase() === __HOST_HASH__` (a build-time constant), and `open(v)` (`main.mjs:186`) calls `recoverGardenHost(core, factory, identity, __HOST_HASH__)` (`sdk/launcher.mjs:78`), reconstructs the exact document with `recoveredHostDocument` (`sdk/archive/host-document.mjs:5`, comment: "Rebuilding it from verified inputs avoids trusting a separate RPC response for active HTML."), then swaps the DOM *without* `document.write`:

> `web/launcher/main.mjs:186-209` — "Only an exact build-pinned host can run on this origin. Neither arbitrary token metadata nor query-provided HTML is executable. Cartridges stay sandboxed." … "document.write/open removes wallet message listeners. Replace the inert DOM and explicitly start only the already verified bootstrap, preserving providers." Implementation: `new DOMParser().parseFromString(host + "</body></html>", "text/html")`, `document.head.replaceWith(dom.head)`, `document.body.replaceWith(dom.body)`, then every inert `<script>` is re-created as a live script element (`inert.replaceWith(script)`, L208).

The service worker (`garden-sw.js`, 1,254 bytes) caches only the reader shell, never RPC responses or token HTML. Mobile pairing uses `@metamask/connect-evm` (`web/launcher/mobile.mjs`). Measured reader artifacts (`docs/evidence/mint-to-app.json`): largest chunks `chunk-2ZJJTRCP.js` 131,344 B and `dist-GPW3B4BE.js` 128,374 B (ethers 6.17.0 and SDK), `chunk-55OQZF7Q.js` 16,297 B, `dist-37ZUQPPM.js` 10,953 B.

**(c) The legacy integrated host (`web/host.mjs`, `web/finance.mjs`, `web/journal.mjs`, `web/garden-game.mjs`, `web/rpc.mjs`, `web/cartridge-api.mjs`, built by `tools/build.mjs`, cap 98,304 bytes at `tools/build.mjs:24`).** Selected with `LEGACY_HOST=1`; targets the pre-kernel `PixelGarden.sol`. Historical; documented as not migrated (`docs/ACCOUNT-FOUNDATION.md`).

### 1.2 How does the site verify NFT ownership?

There is no login, no signed nonce, no backend. Ownership is read from chain and enforced by chain:

1. Wallet discovery: EIP-6963 `eth:requestProvider` events plus `window.ethereum` fallback (`web/kernel/wallet-choice.mjs`; `test/worlds.test.mjs:112` "wallet discovery bounds untrusted metadata and deduplicates provider identity"). `GardenClient.connect()` (`web/kernel/client.mjs:159`) uses `eth_accounts` silently or `eth_requestAccounts` on gesture and checks `eth_chainId` against `PIXEL_CONTEXT.chainId`.
2. `GardenClient.refresh()` (`client.mjs:120-152`) reads in one batch `ownerOf(token)` (L131), `custodyEpoch(token)` (L132), `account(token)`/`grip(token)`, `accountReady(token)` (L135), `displayName`, `visualSeed`, and then **refuses to proceed unless both ERC-6551 accounts are canonical**: `if (!ready || !(await this.core.isCanonicalAccount(reach, token, false)) || !(await this.core.isCanonicalAccount(grip, token, true))) throw Error("Account binding failed")` (L141-142). `isCanonicalAccount` (`PixelGardenKernel.sol:281`) recomputes the CREATE2 address and compares the exact ERC-1167 runtime hash (registry `0x000000006551c19487814612e58FE06813775758`, runtime hash `0xda1d5b06e579f9e42e59b00fbc22939896ecb38dc8830d40de0a2508fecd6735`, salts `keccak256("pixel.garden.reach.v1")` / `keccak256("pixel.garden.grip.v1")`).
3. `get owns()` (`client.mjs:153`): `return !!this.account && this.account.toLowerCase() === this.owner?.toLowerCase();`. Every owner-only control is rendered disabled when `!owns`.
4. Every write passes through `operation(title, details, work, { ins, ownerRequired = true })` (`client.mjs:206`) which re-reads chain state, re-checks chain id, connected account, `custodyEpoch` and (for cartridges) the edition's activation epoch, simulates with `eth_call`/`estimateGas`, and only then sends through `send()` (`client.mjs:286`) into the durable transaction journal. Content editions are additionally checked to be held by the Reach: `if ((await this.contents.ownerOf(edition)) !== this.reach.target)` (L819).
5. The real gate is on chain: kernel `onlyOwner`-style checks, Reach `authorized(epoch, msg.sender)` on every typed withdrawal/session/seal (`src/accounts/ReachAccount.sol:119-237`), and the custody epoch that increments on **every** transfer including self-transfer so a buyer's UI can never replay a seller's prepared call. The docs state the consequence plainly (`docs/evidence/mint-to-app.json` limits): "Public onchain HTML is readable by everyone. Contract-enforced current ownership controls management; connecting or installing grants no spending authority."

Public reads (holdings, rooms, history) never need a wallet; `web/kernel/read-console.mjs` is a send-less console that pins every result to a block and rejects reorganizations (`test/worlds.test.mjs:83,92`).

**Verdict for the GOAL:** this is the right model — gate in the UI for UX, gate on chain for authority, and derive "you own it" from `ownerOf` + canonical TBA, never from a signature the site could be tricked into accepting.

---

## 2. `tools/` — build, fixture, recovery, keeper

| File | Lines | Purpose |
|---|---:|---|
| `tools/compile.mjs` | 259 | solc-js 0.8.36 compile of `src/`, pins runtime hashes, EIP-170 gate |
| `tools/host-encoding.mjs` | 31 | radix-85 codec shared by build and bootstrap |
| `tools/build.mjs` | 63 | legacy host build (96 KiB cap) |
| `tools/build-kernel.mjs` | 208 | kernel host build, cartridge packaging, trusted digests |
| `tools/build-launcher.mjs` | 63 | HTTPS reader build (esbuild, SW, manifest) |
| `tools/dev.mjs` | 82 | dev server over the local fixture |
| `tools/fixture-kernel.mjs` | 298 | deploys everything to Hardhat 31337, freezes host, mints, asserts `document` round-trip |
| `tools/fixture.mjs` | 84 | legacy fixture |
| `tools/recover.mjs` / `recover-cartridges.mjs` | 55 / 410 | CLI recovery of host + every installed cartridge + history |
| `tools/verify-source.mjs` | 93 | recompiles a source and compares exact runtime bytes |
| `tools/package-cartridge.mjs` | 133 | package a third-party module app into the release format |
| `tools/rpc-relay.mjs` | 77 | allowlisted read-only JSON-RPC relay for browser tests |
| `tools/maturity-keeper.mjs` | 120 | CLI for the beneficiary maturity keeper (`ops/maturity-keeper.service`) |

### 2.1 `tools/compile.mjs` (`compile({tests})`, L6)

Settings: `optimizer:{enabled:true,runs:1}, viaIR:true, evmVersion:"cancun", metadata:{bytecodeHash:"none"}`. `bytecodeHash:"none"` is what makes runtime hashes reproducible across machines, which the kernel constructor depends on: the kernel is constructed with `keccak256(runtime)` of each cartridge family so it can refuse any runtime that is not the exact pinned build. Comment, verbatim: "Pin the exact Content runtime without embedding another complete copy in Kernel initcode. Compile from the same sources/settings; never accept a caller-supplied identity hash." Size gates at L179 and L193: `if (artifact.runtimeBytes > 24576 || artifact.initcodeBytes > 49152) throw`. Output line format at L238/L255 (`${name}: ${runtimeBytes}/24576 runtime bytes; ${initcodeBytes}/49152 initcode bytes`). Reuse: **adapt** — the pinning idea (constructor takes runtime hashes, compile step produces them, no caller-supplied hash) is directly applicable to a modular NFT whose kernel must only talk to known cartridges.

### 2.2 `tools/host-encoding.mjs`

`alphabet` (L2): `Array.from({length:94},(_, i)=>String.fromCharCode(i+33))` filtered of `"'\\<>` and backtick, sliced to 85. `encode85(bytes)` (L6) packs 4 bytes → 5 symbols; `decode85(text,length,alphabet)` (L20) is stringified into the bootstrap so the on-chain HTML carries its own decoder. Net effect: gzip ratio minus ~25% expansion, far better than base64 + no escaping hazards. Reuse: **reuse-verbatim**.

### 2.3 `tools/build-kernel.mjs`

Bundles `web/kernel/host.mjs` with esbuild (iife, minified), gzips, radix-85 encodes, emits the bootstrap string (quoted in 1.1). Then packages each cartridge (`market`, `locks`, `journal`, `garden-game`, `studio`, `moonlit-archives`, `nexus-grove`, `social`, `continuity`, `estate`, `otc`, `presale`, `launchpad`, `curve`, `liquidity`) with a 262,144-byte cap (L163: `if (Buffer.byteLength(html) > 262144) throw Error(name + " exceeds 256 KiB")`) and the host with a 196,608-byte cap (L184). It computes the trusted-workspace digests written to `web/kernel/trusted.json` (SHA-256 + byte count per native extension) that the host later pins. Comment on the sandbox allowlist, verbatim: "Only these exact sandbox entrypoints may request unpublished local trade memories." Measured cartridge sizes at Board 21: market 78,815 B, studio 75,505, garden-game 60,858, moonlit-archives 60,860, nexus-grove 60,853, journal 37,524, locks 34,968, and ~23.3–23.5 KB each for social/continuity/estate/otc/presale/launchpad/curve/liquidity (these are thin launchers that load a trusted workspace). Trusted workspaces: social 196,001 B, continuity 272,242, estate 293,236, locks 190,624, analytics 315,104, presale 153,676, finance 269,380, workspace 321,866, experience 345,673. Reuse: **adapt** (pipeline shape is excellent; the cartridge list is project-specific).

### 2.4 `tools/build-launcher.mjs`

esbuild `web/launcher/main.mjs` → `dist/launcher.html` with `__HOST_HASH__` injected from the kernel build, chunked output in `launcher-chunks/`, `garden-sw.js`, `garden.webmanifest`, `garden-icon.svg`. The hash injection is what makes the reader a *verifier* rather than a mirror. Reuse: **adapt**.

### 2.5 `tools/fixture-kernel.mjs`

Deploys ERC-6551 registry runtime from `test/fixtures/erc6551-registry.json` at the canonical address, `ArchiveFactory`, `ContentCartridge`, all runtime cartridges, then the kernel with constructor `[10000, content.target, keccak(Market), keccak(Locks), keccak(Social), keccak(Continuity), keccak(Estate), keccak(Presale)]`, publishes and freezes the host, mints, and asserts the round trip by parsing `decodeURIComponent(tokenURI.split(",").slice(1).join(","))`, base64-decoding `animation_url` and checking `document.startsWith(html)`. Writes `dist/deployment.json` (`fixture:true`). Comment: "Development-only connection metadata is outside the immutable production host." Reuse: **adapt** — this is the template for a "mint → tokenURI → run" integration test.

### 2.6 `tools/recover-cartridges.mjs` (`recoverGarden(core, tokenId, outputDirectory)`, L15)

Independent CLI that, with only an RPC and a token id, writes the host document, every installed cartridge's recovered files, journal, social rooms, locks, presales, OTC deals, launches and history to disk — the "the project can die and the app survives" proof. Reuse: **adapt** (keep the principle: every feature has a no-UI recovery path).

### 2.7 `tools/verify-source.mjs` (`verifySourceBuild`, L6)

Recompiles a single contract from supplied source with the pinned compiler version and compares to a runtime hex (`L19` rejects malformed hex or > 24,576 bytes). Used by Hook Inspector to let a user verify a hook's runtime matches claimed source without an explorer. Reuse: **reuse-verbatim**.

### 2.8 `tools/package-cartridge.mjs` (`packageModuleApplication`, L11)

Turns a directory + entry HTML + metadata into the `pixel.garden.release/1` manifest and chunk plan. Reuse: **adapt**.

### 2.9 `tools/rpc-relay.mjs`

Allowlisted read-only relay (`eth_call`, `eth_getLogs`, `eth_blockNumber`, `eth_getBlockByNumber`, …) so Playwright pages can hit a real node without exposing write methods. Reuse: **reuse-verbatim** for test infra.

### 2.10 `tools/maturity-keeper.mjs` + `ops/maturity-keeper.service`

CLI around `sdk/maturity-keeper.mjs` (`maturityKeeper`, L86): watches vesting-sale schedules, and when a schedule matures it signs **only** `executeSale` for the recorded recipe, journals before broadcast, enforces solvency/status/chain/fee/gas/balance/daily caps, and never resends a lost broadcast. Comment, verbatim: "One gas payer, one durable journal. Never authorizes, changes a route, or pays a different recipient." The systemd unit runs it as a long-lived service with a state directory. `test/maturity-keeper.test.mjs` has 12 tests including "keeper signs only executeSale, journals before broadcast and recovers without a second submission", "lost broadcast response persists its known hash and never automatically resends", "journal cannot substitute a schedule, recipient, raw transaction or gas reservation". Reuse: **adapt** — a safe pattern for any off-chain automation the GOAL may need (e.g., auto-settling matured locks).

---

## 3. `web/launcher` — the HTTPS reader

`index.html` (98 lines) is a shell with a collection card list, a mint form (`initializeSeedMint`, `main.mjs:337`, uses `web/kernel/mint-seed.mjs` `mintWithSeed` with `visualSeed` 1..4294967295), a pending-transaction banner (`pendingTransaction`, L113), and the per-token "open" action. `shelf()` (L164) pages the owner's tokens with `ownedGardenPage` (`sdk/launcher.mjs:46`) which pins a block and reports incomplete coverage rather than guessing (`test/launcher.test.mjs:51` "Owned Garden pages expose incomplete coverage and reject reorganized reads"). `recoverMint()` (L260) finds a prior mint by nonce and `isMintRequest` (L249) so a refreshed page never mints twice; `mintedGarden` (`sdk/launcher.mjs:29`) selects "only the kernel's unique zero-address Transfer" (`test/launcher.test.mjs:31`). `setup()` (L211) runs the starter-content flow (`installStarter`, `sdk/launcher.mjs:118`; starter is opt-in and idempotent per `test/launcher.test.mjs:122`).

URL parsing (`sdk/launcher.mjs:21 parseGardenURL`) has a load-bearing comment: "Deliberately a narrow Garden URL parser, not a general web3 interpreter. Do not use URL.port: EVM chain IDs are not TCP ports and may exceed 65535." (`test/launcher.test.mjs:18`). `recoverGardenHost` comment: "Hash checks detect corrupt recovery; they are not consensus proofs against a lying RPC." — the repo is honest that HTTPS bootstrap and read RPC remain trust dependencies.

Reuse: **adapt**. The GOAL needs exactly this: a tiny static page whose only privileged act is to fetch and verify the on-chain site. Keep the DOM-replacement trick, the pinned host hash, and the SW-caches-shell-only rule.

---

## 4. `web/kernel` — the on-chain host runtime

### 4.1 `web/kernel/host.mjs` (1,250 lines)

Entry point bundled into the frozen host. Creates `const client = new GardenClient(window.PIXEL_CONTEXT || {}, {...})` (L137), renders the workspace menu (24 workspaces, 20 board destinations), holdings, Reach/Grip panels, seal/session controls, content directory, and the cartridge runner.

**Cartridge sandbox (L1078-1195).** Each content cartridge runs in `<iframe sandbox="allow-scripts">` with an injected CSP (L1078): `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'`. The cartridge has **no network**; everything goes over a `MessageChannel` (L1092) established on a `pixel.ready` postMessage from the exact frame (L1088 checks `e.source === activeFrame.contentWindow`), after which the host posts `pixel.connect` with `port2` (L1122). Rate/size limits at L1105: `if (++count > 120 || concurrent >= 4 || json(m).length > 40000)` reject. Bridge methods are typed and gated by the manifest's declared capabilities (`files.read`, `identity.read`, `journal.propose`, `state.read`, `state.write`, `transaction.propose` — `sdk/archive/format.mjs:7`). `transaction.propose` never signs: it hands a reviewed request to `client.operation()` which re-validates and shows the host's own review dialog. Cartridge side is `web/cartridge-api.mjs` (`call(method, params)` with a 180,000 ms timeout).

**Trusted native workspaces.** Because the host is at 99.8% of its cap, large UIs (social, continuity, estate/OTC, locks, analytics, presale, finance, workspace, experience) are archived separately. `web/kernel/trusted-*.mjs` loaders recover the archive, run `verifyHostModule(recovered, path, expected)` (`sdk/host-modules.mjs:3`; comment: "Recovery proves what was published. This separate check proves it is the host author's exact code.") against the build-time digest from `trusted.json`, and only then evaluate with `new Function(source + ";return PixelX;")()` in the host realm. `test/social.test.mjs:458` "native host extensions reject substituted bytes, paths and MIME". This is the project's answer to EIP-170 for front-ends: split the UI into hash-pinned extensions the immutable host can load but never be tricked into replacing.

### 4.2 `web/kernel/client.mjs` (1,537 lines) — `GardenClient`

Public API (selected): `connect(provider, silent)` L159, `refresh()` L120, `get owns` L153, `operation(title, details, work, {ins, ownerRequired})` L206, `send(contract, method, args, title, details, options)` L286, `switchChain`, `simulate`, content helpers (`installContent`, `activate`, `openCartridge`), state save/restore via `sdk/state.mjs`, and transaction journaling via `web/kernel/transaction-store.mjs` + `sdk/transactions.mjs` (`durableRunner`, L114 — "persists exact nonce before wallet access and blocks uncertain replay", `test/transactions.test.mjs:74`). `inspectTransaction` (`sdk/transactions.mjs:43`) classifies submission-unknown / replacement-unknown / pending / replacement-pending / reorganized / replaced / confirmed / reverted; `settledTransaction` L111. Imports are read-only merges that "cannot overwrite a locally tracked transaction" (`test/transactions.test.mjs:99`).

Reuse: **adapt**. The `operation()` guard (chain, account, epoch, activation, simulate, journal) is the single most reusable piece for the GOAL's "connect → verify → use" flow.

### 4.3 Other kernel modules

- `wallet-choice.mjs` — EIP-6963 discovery with bounded, deduplicated provider metadata. **reuse-verbatim**.
- `transaction-store.mjs` — IndexedDB-backed journal under Web Locks `pixel-transactions:{chain}:{from}`. **adapt**.
- `publications.mjs` (`PublicationStore`) — `pixel.garden.publication/1` checkpoints for multi-tx uploads; `sdk/archive/publication.mjs` `publicationRunner` (L184) comment: "Recompute every call from the package, replay confirmed exact calls, and persist BEFORE broadcast." and "Import cannot erase newer local evidence and accidentally mint the same edition twice." **adapt**.
- `mint-seed.mjs` — seeded mint. **reuse-verbatim**.
- `read-console.mjs` — pinned-block, send-less contract console. **reuse-verbatim**.
- `a11y.mjs`, `style.css` (16,163 B), `board.css` (10,589 B), `studio.css` (9,280 B), `worlds.css` (2,869 B) — inert-background mobile menu, Escape-restores-focus, 320/390/768/1500 px audits. **adapt**.
- `workspace.mjs`, `experience.mjs` — 20-board directory. **drop** (project-specific).

---

## 5. `sdk/` — archive format, chain I/O, state, launcher helpers

### 5.1 `sdk/archive/format.mjs` (481 lines)

Constants: `RELEASE_SCHEMA = "pixel.garden.release/1"` (L4), `HOST_API = "pixel.garden.host/2"` (L5), `CAPABILITIES` (L7), `LIMITS` (L15: manifest 16 KiB, 64 releases/graph, depth 16, SDK 64 MiB, browser 8 MiB, file paths via `safePath` L76 rejecting `..`, absolute, control chars). `canonicalJSON` (L52) sorts keys and rejects non-finite numbers so `manifestHash` (L186) is deterministic. `packageFiles` (L278) and `packageHTML` (L294) build manifests; `verifyArchive` (L356) checks stored/expanded SHA-256 and byte counts; `resolveReleaseGraph` (L397) walks dependencies with the bounds above; `planChunks` (L437) splits into ≤23,000-byte chunks and de-duplicates against `existing` chunk addresses (content-addressed chunks are shared across releases); `readVerifiedFile` (L469, `maxBytes = 65536`). Reuse: **reuse-verbatim** (rename schema strings).

### 5.2 `sdk/archive/chain.mjs` (351 lines)

`publishArchive` (L43) creates chunks, leaves and directory with resume support; `recoverArchive(factory, descriptor, {blockTag})` (L118) with comments "Never trust an address from a resume file or mapping without checking exact bytes." and "Recover only canonical readers at a pinned block. No unbounded readAll or execution."; `publishContent` (L180) / `recoverContent` (L232) / `recoverContents` (L239) for content-NFT editions. Reuse: **reuse-verbatim**.

### 5.3 `sdk/archive/publication.mjs` (301 lines) and `sdk/state.mjs`

Publication checkpoints: `PUBLICATION_SCHEMA` L4, `publicationId` L14, `newPublication` L24, `validatePublication` L38, `validateTransactionSteps` L94, `inspectAttempt` L134, `inspectStep` L163, `publicationRunner` L184, `mergePublication` L272. Comments: "Checkpoints are untrusted data. They never contain a wallet key or executable task list." and "A saved hash is evidence to inspect, never authority to skip a transaction." State saves: `STATE_SCHEMA = "pixel.garden.state-save/1"` (L15), `BROWSER_RECOVERY = {maxReleaseBytes: 2097152, maxTotalBytes: 8388608}` (L16), 32 KiB per state blob, `reviewStatePlan` L85, `executeStateSave` L131. `test/publication.test.mjs` ("resumable content publication", 406 lines) and `test/state.test.mjs` ("dependency recovery, staged migration and resumable state", 584 lines). Reuse: **adapt**.

### 5.4 `sdk/launcher.mjs`, `sdk/host-modules.mjs`, `sdk/archive/host-document.mjs`, `sdk/discovery.mjs`, `sdk/packages.mjs`

Covered in 1.1/3. `sdk/packages.mjs` is the legacy 4,096-byte-chunk rolling-keccak package format (`test/client.test.mjs:22` "large packages use bounded 4 KiB chunks and reject excess bytes" — 64 chunks for 262,144 bytes); **drop** in favour of `sdk/archive`. `sdk/discovery.mjs` is the shared pinned-block log pager with `PAGE_LIMITS` 20,000 blocks / 2,000 chunk / 1,000 events and `checkSnapshot` reorg detection; **reuse-verbatim**.

---

## 6. Messaging / social layer

Contracts are out of my area, but the client side is complete and is the most portable messaging stack among the repos.

- `sdk/social.mjs` — EIP-712 identity attestations (`IDENTITY_TYPES` L2, domain `identityDomain(chainId, contract)` L12 = "Pixel Garden Identity" v1) binding a display name/messaging key to a Garden and custody epoch, with retirement; `postObject`/`whisperObject` canonicalisers; `recoverSocial` (L42) replays room/post/reaction logs at a pinned block.
- `sdk/social-board.mjs` — `REACTIONS` (heart/wonder/grow, L14), `validateAttachment` (L19, bounded inline images), `encodeSocialPost`/`decodeSocialPost` (≤2,048-byte posts), `readRoomPage` (L79), `createConversationHistory` (L178), `conversationGroups` (L248). `test/social.test.mjs:129` "room titles reject malformed UTF-8 before persistent storage" (a codex fix).
- `sdk/whispers.mjs` (v1 DMs) — P-256 ECDH (L27) → HKDF-SHA-256 (L46-50) → AES-256-GCM; `whisperScope` (L14) binds chain/kernel/social/garden/epoch into AAD; sender and recipient copies; plaintext ≤1,024, envelope ≤4,096. Key backups: PBKDF2-SHA-256, 310,000 iterations (L120), AES-GCM with scope in AAD (`encryptKeyBackup` L127). Comment: "Browser-native encryption. Private keys never enter an application frame, RPC or contract."
- `sdk/whisper-ratchet.mjs` (v2 DMs) — X25519 (L76) classical Double Ratchet, `MAX_SKIPPED = 64` (L20), offer/accept/complete handshake bound to on-chain participant epochs (`createRatchetOffer` L168, `acceptRatchetOffer` L220, `completeRatchetOffer` L245), `encryptRatchet` L278, `decryptRatchet` L317, `discardSkippedKeys` L359. Header comment: "Interactive chain-authenticated handshake and classical Double Ratchet. State transitions are copy-on-success. The caller MUST durably replace encrypted state before submitting a ciphertext or exposing plaintext…". Tests (`test/whisper-ratchet.test.mjs`): "ratchet handshake binds onchain participant epochs, offer identity and contracts", "ratchet rotates both directions, consumes old keys and rejects replay", "out-of-order ratchet messages remain bounded and old-chain skipped keys are deleted", "authentication failure and skip-budget rejection never mutate durable ratchet state", "restored ratchet state rejects mismatched private and public key material".
- `sdk/sealed-packets.mjs` — `pixel.garden.sealed/1` passphrase-sealed journal packets (`test/sealed-packets.test.mjs`: Unicode round-trip without plaintext in storage; wrong passphrase/scope/epoch/metadata reject; "packet resource bounds and fixed KDF are enforced before decrypting").
- UI: `web/kernel/social.mjs`, `social-board.mjs`, `social-art.mjs`, `whisper-ratchet.mjs` (trusted-social workspace, 196,001 B).

Reuse: **reuse-verbatim** for `whispers.mjs`, `whisper-ratchet.mjs`, `sealed-packets.mjs`; **adapt** `social.mjs`/`social-board.mjs` to the new contract ABI. Weakness: no post-quantum layer, no group ratchet (rooms are plaintext on chain by design), ratchet state lives in the browser only (loss = conversation loss unless the sealed backup is exported).

---

## 7. Finance: swap, launchpad, vault

### 7.1 Vault model (Reach / Grip / Locks / seals)

Two ERC-6551 accounts per token. Reach (`src/accounts/ReachAccount.sol`): `withdrawETH/ERC20/ERC721/ERC1155(..., epoch)` L119-181 (owner-only, epoch-checked, exact balance deltas), `sealAsset`/`sealAll(until, epoch)` L191-213 (ratchet: can only extend), `grantSession(key, request, uses, expiry, epoch)` L218 / `revokeSession` L237 bound to `recipeHash` (L214, `"pixel.garden.recipe/1"`, 1–1,024 uses), `executeCartridge(Call, sessionRevision)` L258, `executeSwapToLock` L315. Grip has **no outbound function**. Locks cartridge escrows with vesting (`sdk/locks.mjs`: `lockRecipe` L12, `vestedAmount` L38, `readLock` L50). The SDK never constructs anything but typed recipes: `sdk/financial-recipes.mjs` `CALL_TYPE` L4, `v3Recipe` L16, `v4Recipe` L25, `launchRecipe` L37, `exitRecipe` L52, `recipeHash` L72, `sessionExposure` L81 (computes the worst-case spend a session can authorise so the UI can show it).

### 7.2 Swap

Market family 1: action 1 Uniswap v3 exact-in, action 2 v4 exact-in with hookData, 3 launch, 4 exit. Browser-side quoting uses the Uniswap SDKs (devDeps) against `config/ethereum.json` addresses (v3 quoter `0x61fF…`, v4 quoter `0x52f0…`, PoolManager `0x000000000004444c5dc75cB358380D2e3dE08A90`); every amount is BigInt. `sdk/swap-lock.mjs` (`swapLockTarget` L10, `recoverSwapLock` L40, `verifyTradeNote` L95) implements swap-to-lock: output lands directly in a Locks schedule with a `journalHash` note commitment (`SwapLocked` event). Fork evidence: 45 real-protocol checks at mainnet block 26,059,508 (`test/financial-fork.mjs`, 1,034 lines).

### 7.3 Launchpad

`sdk/launchpad.mjs`: `TOKEN_SPEC` L13 (name 1–64 B, symbol 1–16 B, decimals 0–18, fixed supply to Reach), `HOOK_SPEC` L15, `deploymentRecipe` L19, `hookAddress` L38 (CREATE2 salt binds chain/kernel/garden/nonce/salt), `mineHook` L48 (incremental, cancellable browser search for an address matching the 14 Uniswap v4 flag bits), `recoverDeployments` L67. `sdk/launch.mjs` (`newLaunch` L17, `executeLaunch` L83) and `sdk/liquidity.mjs` `seedPlan` (L4; `test/client.test.mjs:47` proves full-range tick alignment at spacing 60 and integer reserve limits), `sdk/presale.mjs` (`PRESALE_TERMS` L4, `presaleRecipe` L30, `validatePresaleVesting` L46, `allocation` L63, `recoverPresales` L87, attempt reconciliation L178-214), `sdk/pair-liquidity.mjs`, `sdk/position-math.mjs`, `sdk/positions.mjs`, `sdk/liquidity-accounting.mjs`. `test/launchpad.test.mjs`: "no issuance without the Garden owner or an exact delegated recipe", "invalid token configuration rolls back its reserved nonce", "wrong address flags and empty deployed code revert atomically", "constructor callbacks cannot reenter the launch runtime". Docs: `docs/LAUNCHPAD-CREATION.md` (family 9 payload cap 50,176 bytes; Market/Presale/Curve/Liquidity 12,288 encoded bytes for ≤8,192 bytes hookData).

### 7.4 OTC, estate, continuity, vesting sales

`sdk/otc.mjs` (`fundingPlan` L12, `readOTCDeal` L46, `recoverOTC` L64; two external wallets, up to 8 assets per side, ETH/ERC-20/721/1155, broker fee, measured settlement 160,055 gas), `sdk/estate.mjs` (rentals; `visualTraits` L17), `sdk/continuity.mjs` (`CONTINUITY_STATES` L1 — inheritance/dead-man switch), `sdk/vesting-sales.mjs` (`saleRecipe` L21, `saleCommitment` L54, `recoverSale` L95) with the keeper in 2.10. UI: `web/kernel/finance-plus.mjs` (`mountFinance`), `token-launchpad.mjs`, `market.mjs`, `launches.mjs`, `presale.mjs`, `otc*.mjs`, `estate*.mjs`, `continuity.mjs`, `claims.mjs`, `vesting-sales.mjs`, `locks.mjs`.

Reuse: **adapt** all of 7.x. The recipe/session/epoch design is exactly what the GOAL's vault needs; the Uniswap plumbing is mainnet-specific and would need re-targeting per chain.

---

## 8. Analytics readers (`sdk/*-history.mjs`, `*-discovery.mjs`, `*-accounting.mjs`, `hook-inspector.mjs`, …)

All share one discipline: pinned block, `checkSnapshot` reorg detection, bounded paging (20,000 blocks / 2,000 chunks / 1,000 events), atomic cursors, and replayable `pixel.garden.history-checkpoint/1` digests (`sdk/history-checkpoints.mjs`). `sdk/hook-inspector.mjs` reads a hook's flag bits, EIP-1967/EIP-1167 proxy slots and runtime hash and can call `verifySourceBuild`. `sdk/external-metadata.mjs` and `sdk/asset-details.mjs` parse third-party token metadata with bounded PNG/JPEG/GIF/WebP/SVG validators (`collectibleImage`). Reuse: **adapt** `discovery.mjs` + `history-checkpoints.mjs` + `hook-inspector.mjs`; **drop** the board-specific accounting modules.

---

## 9. Studio, worlds, content (`web/kernel/studio*.mjs`, `worlds.mjs`, `world-*.mjs`, `board-art.mjs`, `crystal.mjs`, `preview-crystal.mjs`)

4D procedural geometry (`test/studio.test.mjs`: "all six 4D planes preserve norm and invert with reverse rotations", "hypercube and 16-cell have their exact edge and vertex counts"), synthesized audio after user gesture, three world cartridges with 8-level breadcrumbs, 64-plot garden. Reuse: **drop** for the GOAL (art direction is project-specific), except the principle that visuals derive from an on-chain `visualSeed` and never from untrusted fields (`test/studio.test.mjs:67` "untrusted seed/fields do not change Garden identity").

---

## 10. Legacy `web/` host

`web/host.mjs` (739), `finance.mjs` (183), `journal.mjs` (31), `rpc.mjs` (84), `cartridge-api.mjs` (58), `garden-game.mjs` (2: `mountWorld('greenhouse')`). `cartridge-api.mjs` is still the live cartridge-side bridge (used by the sandboxed cartridges); the rest is superseded by `web/kernel`. Reuse: `cartridge-api.mjs` **reuse-verbatim**; others **drop**.

---

## 11. Standards touched by this area

ERC-721 (kernel; Solady vendored ERC721), ERC-6551 (Reach/Grip, canonical registry + exact runtime hash check), ERC-4804/ERC-6860 `web3://` with `string!index.html` MIME hint, EIP-1193 provider, EIP-6963 multi-wallet discovery, EIP-712 (identity attestations, keeper domain), ERC-1271 (verified on counterparties, never signed by session keys), ERC-20/721/1155 handling in Reach withdrawals and OTC, EIP-1967/EIP-1167 slot/footer inspection in Hook Inspector, Uniswap v3 (router 0x68b3…, quoter) and v4 (PoolManager, PositionManager, StateView, hooks with 14 flag bits, Permit2), ENS (`sdk/ens.mjs`, `ens-records.mjs`, 3 fork checks), SSTORE2-style data contracts (ArchiveFactory), Web Crypto (ECDH P-256, X25519, HKDF, AES-GCM, PBKDF2).

---

## 12. Tests and tooling

Node `node:test` suites in `test/*.test.mjs` run against the Hardhat 31337 fixture (`npm run check` = compile → build → fixture → unit → browser). Counts recorded in evidence: 289 (mint-to-app checkpoint), 298 automated + 90 local browser checks (launchpad-creation), 396 automated / 70 browser groups / 8 OTC viewport checks (latest AGENTS.md checkpoint). Browser suites (`test/browser-launcher.mjs` 339 lines, `browser-kernel.mjs` 793, `browser-social.mjs` 399, `browser-otc.mjs` 401, …) run Playwright Chromium 153 with a deterministic injected EIP-1193 provider, auditing 24 workspaces at 320/390/768/1500 px. `test/financial-fork.mjs` (1,034 lines) and `test/ens-fork.mjs` run against a mainnet fork at block 26,059,508. `test/keeper-integration.mjs` drives the systemd keeper CLI end-to-end against the fixture (`assert.equal(ctx.fixture, true, "Keeper service integration requires the disposable local fixture")`). CI: `.github/workflows/verify.yml` runs two final-source jobs. Telling names: `test/client.test.mjs:7` "package recovery rejects false full-payload hashes even when upload root is consistent", `:28` "browser host recovery constructs the exact document from verified archive bytes"; `test/transactions.test.mjs:63` "wrong chain, changed snapshot, tampered payload and noncanonical receipt fail closed"; `test/maturity-keeper.test.mjs:184` "keeper refuses a changed kernel, chain or genesis".

---

## 13. Measured numbers (all quoted from evidence JSON / docs, not re-run)

| Item | Value |
|---|---|
| Frozen host | 196,273 / 196,608 B (Board 21), 196,543 B after dependency-bound fix; SHA-256 22644b25… |
| Host cap / cartridge cap / legacy host cap | 196,608 / 262,144 / 98,304 B |
| Archive chunk / leaf / directory | 23,000 B; 32 chunks; 16 leaves = 512 chunks = 11,776,000 B |
| Manifest / state blob / browser recovery | 16 KiB; 32 KiB; 2 MiB per release, 8 MiB total |
| Dependency graph | 64 releases, depth 16, 64 MiB SDK |
| Cartridge bridge | 120 req/min, 4 concurrent, 40,000-char JSON, 180,000 ms call timeout |
| Discovery paging | 20,000 blocks / 2,000 chunk / 1,000 events |
| Kernel | 23,798 / 44,931 B (mint-to-app) → 23,785 / 45,494 B (later) |
| ReachAccount / GripAccount | 17,268 / 17,517 B; 1,933 / 2,106 B |
| ContentCartridge | 8,898 / 17,774 B |
| MarketCartridge | 24,089 / 25,336 B (mint-to-app) → 23,690 / 24,936 B |
| Locks / Social / Continuity / Estate / Presale | 14,275; 13,272; 8,796; 19,044; 16,701 B runtime |
| Curve / Liquidity / OTC | 18,797 / 19,586; 21,673 / 23,593; 15,370 / 16,159 B |
| Trusted workspaces | social 196,001; continuity 272,242; estate 293,236; locks 190,624; analytics 315,104; presale 153,676; finance 269,380; workspace 321,866; experience 345,673 B |
| Reader chunks | 131,344 B + 128,374 B main; SW 1,254 B; manifest 282 B |
| Whispers | plaintext ≤1,024, envelope ≤4,096 B; PBKDF2 310,000 iters; MAX_SKIPPED 64 |
| Launchpad payloads | family 9 ≤50,176 B; others ≤12,288 B (≤8,192 B hookData); initcode ≤49,152 B |
| OTC settlement | 160,055 gas |
| Tests | 289 → 298 → 396 automated; 173 browser functional groups + 116 layout audits + 16 launcher groups; 45 fork + 3 ENS + 17 financial browser checks |
| Fork block | 26,059,508 |
| Keeper | journal cap 1,000 attempts |

---

## 14. Weaknesses and TODOs

1. Host at 99.8% of its 196,608-byte cap; every feature now lands in a trusted extension evaluated with `new Function` — hash-pinned, but it is still `eval` of chain-recovered code in the host realm.
2. HTTPS reader and read RPC are acknowledged trust dependencies; archive hashes "are not independent Ethereum consensus proofs" (evidence limits).
3. No public-chain deployment; all numbers are local fixture / fork.
4. Browser-only secrets: ratchet state, whisper keys and transaction journals live in IndexedDB; loss without an exported sealed backup is unrecoverable.
5. Mainnet-only Uniswap address book (`config/ethereum.json`); swap/launchpad need per-chain configs.
6. `tokenURI` is a percent-encoded JSON data URI with a ~200 KB base64 body — some marketplaces truncate or refuse data URIs of this size; the `web3://` route is the real surface.
7. Sandboxed cartridges have `connect-src 'none'`: good for safety, but any cartridge needing live data must route through the 120 req/min bridge.
8. 20 boards "remain in scope and incomplete" per evidence limits; several UI modules are launchers for workspaces that are only partly built.
9. `tools/fixture.mjs`, `web/host.mjs`, `sdk/packages.mjs` are legacy and still in tree.
10. No multi-chain token partitioning; single-chain kernel.

---

## 15. Unique ideas worth carrying into the GOAL

- `document(id)` = frozen archive bytes + `PIXEL_CONTEXT` + closing tags, so one archive serves every token and the token's identity is injected by the contract, not the client.
- Percent-encode only the JSON envelope; base64 the HTML once (gas-bounded `tokenURI`).
- Radix-85 gzip transport with the decoder stringified into the bootstrap.
- Reader = verifier: `__HOST_HASH__` pinned at build, DOM swap via `DOMParser` + `replaceWith` to keep EIP-1193 listeners alive.
- Hash-pinned trusted extensions to escape EIP-170 for the front-end without an upgrade key.
- Sandboxed cartridges with injected CSP + MessageChannel capability bridge; no network in the frame.
- Canonical-TBA check (`isCanonicalAccount`) before trusting any account address; custody epoch bumps on every transfer so stale UI calls die.
- Exact-recipe sessions (`recipeHash`, bounded uses) instead of general executors; `sessionExposure` shows worst-case spend.
- Swap-to-lock with journal-hash note commitment.
- Durable transaction journal persisted before wallet access; classified `inspectTransaction` states; never auto-resend.
- Chain-authenticated X25519 Double Ratchet DMs and sealed journal packets.
- Independent recovery CLI for every feature; pinned-block, reorg-checked, bounded readers everywhere.

---

## 16. Reuse verdicts

| Component | Verdict |
|---|---|
| `tools/host-encoding.mjs`, `tools/verify-source.mjs`, `tools/rpc-relay.mjs` | reuse-verbatim |
| `sdk/archive/{format,chain,hash,host-document}.mjs`, `sdk/discovery.mjs`, `sdk/whispers.mjs`, `sdk/whisper-ratchet.mjs`, `sdk/sealed-packets.mjs`, `sdk/host-modules.mjs`, `web/kernel/{wallet-choice,read-console,mint-seed}.mjs`, `web/cartridge-api.mjs` | reuse-verbatim |
| `tools/{compile,build-kernel,build-launcher,fixture-kernel,recover-cartridges,package-cartridge,maturity-keeper}.mjs`, `web/launcher/*`, `web/kernel/{host,client,transaction-store,publications,a11y}.mjs`, `sdk/{launcher,transactions,state,social,social-board,financial-recipes,locks,swap-lock,launchpad,launch,liquidity,presale,otc,vesting-sales,maturity-keeper,history-checkpoints,hook-inspector}.mjs`, `sdk/archive/publication.mjs` | adapt |
| Board-specific analytics (`*-accounting`, `owner-performance`, `launch-analytics`, `venue-history`, …), studio/worlds stack, `workspace.mjs`/`experience.mjs` | drop |
| `tools/build.mjs`, `tools/fixture.mjs`, `web/host.mjs`, `web/finance.mjs`, `web/journal.mjs`, `web/rpc.mjs`, `sdk/packages.mjs` | drop (legacy) |

---

## 17. Pitfalls recorded by the project (each cost a fix)

- `document.open/write` after wallet injection drops EIP-1193 listeners; swap DOM nodes instead.
- A loader-side `const` at global scope can collide with the minified host; the bootstrap declares nothing globally.
- Re-base64-ing the whole HTML inside `tokenURI` exceeds RPC gas caps; encode the envelope only.
- `URL.port` cannot carry chain ids > 65,535; parse `web3://` host:chain by hand.
- `try/catch` alone does not survive a codeless address on satellite chains; also check code size.
- Room titles must be validated as UTF-8 before storage (codex fix), inline images must be byte-bounded, dependency recovery must be resource-bounded.
- Transaction import must never overwrite locally tracked records (duplicate-mint hazard).
- Hook mining must be cancellable when the form changes; CREATE2 salts must bind chain/kernel/garden/nonce.
- `bytecodeHash:"none"` is required for reproducible runtime hashes pinned in the kernel constructor.
