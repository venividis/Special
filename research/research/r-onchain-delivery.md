# Fully on-chain delivery of web apps — research report

Date of research: 2026-10-03. Scope: how a single ERC-721 can carry, serve and run a complete web application (swap, messaging, launchpad, vault) from chain alone — no server, no IPFS — and what the 2025–2026 protocol, marketplace and browser landscape allows. Every number below is either quoted from a primary source fetched today (EIP text, project source, vendor docs), measured directly (one JSON-RPC read against Base at block 52,098,952), or taken from one of the two local repositories' own measured tables. Claims that could not be traced to a primary source are marked **unverified**.

Sources are listed at the end with the date each page carries.

---

## 0. Executive summary (the answers the unified protocol needs)

1. **Storage.** Code-as-storage (SSTORE2) remains the only sane way to hold 100–300 KB on chain. The deployed-code ceiling is still **24,576 bytes** (EIP-170) on mainnet, Base, OP Stack and Arbitrum One. **EIP-7954 raises it to 64 KiB (initcode 128 KiB) and is "Scheduled for Inclusion" in Glamsterdam; Sepolia activates at epoch 353,024 (2026-10-06 13:53:36 UTC); mainnet date not yet set.** EIP-7907 was removed from Fusaka on 2025-07-18, and on 2026-09-29 was rewritten to be metering-only on top of 7954; it is not in the Glamsterdam list. **EOF is in neither Fusaka nor Glamsterdam.** Solady's `SSTORE2` already accepts pointers up to 65,534 bytes, so a chunker written against it needs no change on the day the limit rises.
2. **Delivery.** `tokenURI` → `data:application/json;base64,…` → `animation_url` = `data:text/html;base64,…` with the document stored as **gzip** and inflated by the browser's own `DecompressionStream("gzip")` (Baseline since May 2023). Browser `data:` limits are 512 MB (Chromium, Firefox) and 2 GB (Safari); the binding limit is not the browser, it is **the node's `eth_call` budget**: geth's default `--rpc.gascap` is 50,000,000, EIP-7825 (Fusaka, live since 2025-12-03) caps a *transaction* at 2^24 = 16,777,216 gas, and as of 2026-09-29 geth's Amsterdam/EIP-8037 implementation applies that cap to `eth_call` too (open issue #35838). **Design every single read, `tokenURI` included, to fit under 16.7 M gas**, and use ERC-7617 chunking for anything larger.
3. **Wallet connection inside the NFT.** A `data:` document has an **opaque origin**. Brave blocks the provider in `data:` and sandboxed frames outright; MetaMask's draft PR #46186 (2026-09-04) keeps injecting `window.ethereum` into opaque-origin frames but **refuses the connection**; OpenSea's own docs say HTML `animation_url` pages support scripts "but browser extensions are not". Therefore: **the `tokenURI` document is a viewer; the usable app must also be served on a real origin, which `web3://` (ERC-6860 + ERC-5219/6944) provides without any server**, and which the public gateway `w3link.io` already exposes for Base mainnet (`https://<addr>.base.w3link.io/…`). This is exactly the split IPSEITY already ships (`tokenURI` vs `Premises /token/<id>/live`).
4. **Cost.** Deploying the app bytes on Base today costs about **0.00042 ETH for 300 KB** (13 SSTORE2 chunks, ~69.8 M gas at the measured 0.006 gwei L2 price; the L1 data fee is ~0.000002 ETH because today's L1 base fee is 0.077 gwei and blob fee 0.0048 gwei). On mainnet the same bytes cost **0.0105 ETH at 0.15 gwei to 0.35 ETH at 5 gwei**. Glamsterdam's EIP-8037 (also SFI) raises mainnet *deployment* cost ~8× for a 24 KB contract, which makes the L2 choice decisive. Under the 2^24 per-tx cap, at most **3 chunks fit in one transaction** (3 × 5.37 M = 16.1 M gas); plan 2 per tx for margin.
5. **Blobs** (EIP-4844) are pruned after 4,096 epochs (~18 days); only the KZG commitment persists. They are a transport, not a store. Never put app code in them.

---

## 1. Storage primitives: SSTORE2, SSTORE3, EthFS v2, scripty.sol v2

### 1.1 SSTORE2 (0xsequence → solmate → Solady)

The idea: write data as the *runtime code* of a throwaway contract (prefixed with `STOP` so it can never execute), then read it back with `EXTCODECOPY`. The 0xsequence README's measured table (gas, mainnet rules at the time of writing) is still the canonical justification:

| bytes | SSTORE write | SSTORE2 write | SLOAD read | SSTORE2 read |
|---|---|---|---|---|
| 32 | 44,810 | 41,891 | 4,914 | 3,108 |
| 128 | 111,320 | 61,595 | 11,373 | 3,126 |
| 1,024 | 732,080 | 245,522 | 71,659 | 3,296 |

The write cost is dominated by the EIP-170 code-deposit rule, **200 gas per byte**, plus calldata; the read cost is a near-flat ~3.1 k gas regardless of size (a cold `EXTCODECOPY` is 2,600 + 3 per word). The README states the limit plainly: "Due to contract code limits 24576 bytes is the maximum amount of data that can be written in a single pointer / key."

Solady's `SSTORE2.sol` (fetched today) is the implementation to standardise on. Signatures:

```solidity
function write(bytes memory data) internal returns (address pointer);                       // CREATE
function writeCounterfactual(bytes memory data, bytes32 salt) internal returns (address);  // CREATE2, address = f(data, salt)
function writeDeterministic(bytes memory data, bytes32 salt) internal returns (address);   // CREATE3, address = f(salt) only
function initCodeHash(bytes memory data) internal pure returns (bytes32);
function predictCounterfactualAddress(bytes memory data, bytes32 salt[, address deployer]) internal view returns (address);
function predictDeterministicAddress(bytes32 salt[, address deployer]) internal view returns (address);
function read(address pointer) internal view returns (bytes memory);
function read(address pointer, uint256 start) internal view returns (bytes memory);
function read(address pointer, uint256 start, uint256 end) internal view returns (bytes memory);
error DeploymentFailed();
```

Two details matter for us. First, the init code prefixes the payload with `0x00` (STOP) "to ensure it cannot be called"; every slice offset in a reader must therefore start at byte 1 — IPSEITY's README records a real bug of exactly this kind ("every shard came back with two bytes of init code glued to its front"). Second, Solady's `PUSH2` length encoding allows **up to 65,534 bytes (0xfffe)** per pointer, i.e. it is already sized for EIP-7954's 64 KiB; the limit is enforced by an out-of-gas revert today, not by a check.

`writeDeterministic` (CREATE3) is the one to use for app chunks: the address depends only on the salt, so **the same `web3://` URL resolves on every chain** we deploy to, and a chunk can be re-pointed without touching storage (useful only before `freeze()`; after it, immutability is the feature).

### 1.2 SSTORE3 (Philogy)

SSTORE3 writes the data to *storage* first, then deploys a constant init code through CREATE2 that reads it back — so the deployed address is independent of the data and the pointer can be a small integer packed with other fields. Philogy's benchmarks: "for small datasets (1–3 words) SSTORE2 performs better… at 100+ words SSTORE3 variants often achieve comparable or superior gas efficiency"; reading standalone SSTORE3 is "slightly more expensive than SSTORE2". Pointers must be single-use. **Verdict for us:** irrelevant for 24 KB app chunks (we never pack a chunk pointer with anything), possibly useful for the per-token "published page" idea in §9 where thousands of small pointers live in a mapping.

### 1.3 EthFS v2 (frolic)

EthFS "leans on SSTORE2's strategy… splitting files into 24kb chunks (max contract size) and writing them to deterministic content addresses via Safe Singleton Factory". The `FileStore` is "a minimum viable registry, a global namespace of human-readable filenames". One address everywhere: **`0xFe1411d6864592549AdE050215482e4385dFa0FB`** on Ethereum (mainnet, Sepolia, Holesky), **Base (mainnet, Sepolia)**, Optimism (mainnet, Sepolia), Shape and Zora (mainnet, Sepolia).

Interface (from `IFileStore.sol` and `File.sol`, fetched today):

```solidity
struct BytecodeSlice { address pointer; uint32 start; uint32 end; }
struct File { uint256 size; BytecodeSlice[] slices; }           // read() concatenates slices; readUnchecked() ignores OOB slices

function files(string filename) external view returns (address pointer);
function fileExists(string filename) external view returns (bool);
function getPointer(string filename) external view returns (address pointer);
function getFile(string filename) external view returns (File memory);
function createFile(string filename, string contents[, bytes metadata]) external returns (address pointer, File memory);
function createFileFromChunks(string filename, string[] chunks[, bytes metadata]) …
function createFileFromPointers(string filename, address[] pointers[, bytes metadata]) …
function createFileFromSlices(string filename, BytecodeSlice[] slices[, bytes metadata]) …
event FileCreated(string indexed indexedFilename, address indexed pointer, string filename, uint256 size, bytes metadata);
error FileNotFound(string); error FilenameExists(string); error FileEmpty(); error SliceEmpty(address,uint32,uint32); error InvalidPointer(address);
```

The important design choice is `createFileFromSlices`: a file is a list of `(pointer, start, end)` so one 24 KB pointer can serve several files, and a file can reuse chunks someone else already paid for. Files are content-addressed (Safe Singleton Factory CREATE2), so **a byte-identical library uploaded by anyone is the same address for everyone** — Art Blocks' Dependency Registry (`0x37861f95882ACDba2cCD84F5bFc4598e2ECDDdAF`) put p5.js v1.0.0 on chain in January 2024 "in compressed gzip format across multiple chunks" and their On-Chain Generator (`0x953D288708bB771F969FCfD9BA0819eF506Ac718`) assembles HTML from it with scripty.sol. The EthFS convention for compressed JS is a `<script type="text/javascript+gzip" src="data:text/javascript;base64,…">` tag plus a small on-chain `gunzipScripts-0.0.1.js` (fflate-based) that inflates every such tag — a convention from 2023, before `DecompressionStream` was Baseline (secondary sources only; the file itself was not fetched — **unverified**).

### 1.4 scripty.sol v2 (int.art)

"A gas efficient, storage agnostic, on-chain HTML builder optimised for stitching together large JavaScript based tags." Structs (from `ScriptyStructs.sol`, fetched today):

```solidity
struct HTMLRequest { HTMLTag[] headTags; HTMLTag[] bodyTags; }
enum HTMLTagType { useTagOpenAndClose, script, scriptBase64DataURI, scriptGZIPBase64DataURI, scriptPNGBase64DataURI }
struct HTMLTag { string name; address contractAddress; bytes contractData; HTMLTagType tagType; bytes tagOpen; bytes tagClose; bytes tagContent; }
```

`scriptGZIPBase64DataURI` emits `type="text/javascript+gzip"`; `scriptPNGBase64DataURI` emits `type="text/javascript+png"` (the canvas-decoding trick). Deployed at identical addresses on Ethereum, Sepolia, Holesky, **Base (8453), Base Sepolia (84532)**, Optimism and OP Sepolia: `ScriptyBuilderV2 0xD7587F110E08F4D120A231bA97d3B577A81Df022`, `ScriptyStorageV2 0xbD11994aABB55Da86DC246EBB17C1Be0af5b7699`, `ETHFSV2FileStorage 0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245` (deployment.json). The README says Art Blocks and Alba use it. Audit status: not stated in the README — **unverified**.

**Verdict:** scripty is a builder for *composing* many tags; our document is one self-contained file (IPSEITY's `ipseity.html`, 137 KB source) plus a gap for state, so a 40-line `Renderer` that concatenates head-shard / state / body-shard (what IPSEITY does) is smaller and cheaper than a scripty `HTMLRequest`. Use scripty's *conventions* (the `+gzip` tag type, EthFS pointers) where interoperability with other on-chain libraries is wanted, not its builder.

---

## 2. Delivering the document: data: URIs, compression, limits

### 2.1 What the browser allows

MDN (fetched today): "Chromium and Firefox limit `data` URLs to 512MB, and Safari (WebKit) limits them to 2048MB… Firefox 97 increased the limit from 256KB to 32MB, and Firefox 136 increased it to 512MB." Two further rules decide our architecture:

- "top-level navigation to `data:` URLs is blocked in all modern browsers" (since Firefox 59 / Chrome 60 era), so a `data:` app can only ever live **in an iframe or be opened from a `web3://`/gateway page**;
- "Data URLs are treated as unique opaque origins by modern browsers". No `localStorage`, no cookies, no same-origin anything, and — the wallet consequence — no origin for an extension to grant a permission to (§4).

Browser limits therefore never bind. What binds is the chain read (§3).

### 2.2 Compression and loaders

Three patterns exist in production:

1. **Native inflate.** `DecompressionStream("gzip")` — MDN marks the API "Baseline: Widely available… since May 2023" (Chrome 80, Safari 16.4, Firefox 113 per caniuse). The loader is a few hundred bytes, declares nothing at global scope, and needs no library. This is IPSEITY's choice: "The document is stored as gzip bytes and `tokenURI()` emits a short loader that hands them to `DecompressionStream("gzip")`".
2. **Library inflate.** fflate (~8 KB) stored once on EthFS as `gunzipScripts-0.0.1.js`, re-used by every scripty/EthFS project. Costs a second pointer read per render; worthwhile only if you must support browsers from before 2023 — we should not.
3. **PNG trick.** Bytes packed into a PNG and read back through a canvas (scripty's `scriptPNGBase64DataURI`). Deflate-equivalent ratio, awkward, obsolete now that (1) exists.

Brotli would give roughly 15–20% smaller output than gzip on minified JS (**unverified**, general knowledge), but MDN's constructor page lists `"brotli"` and `"zstd"` as accepted values with the caveat "Some parts of this feature may have varying levels of support", and secondary sources say brotli/zstd decoding is Chromium-only as of 2026. **Gzip is the only format that is cross-browser today.** ERC-7618 (§5) lets a `web3://` server advertise `Content-Encoding: br` and have the *gateway/client* inflate, so brotli is usable on the `web3://` path even though it is not usable inside a `data:` loader.

### 2.3 Measured sizes from a shipping project (IPSEITY README, local repo)

```
document, as written                173,261 bytes
after minifying                     113,379 bytes    65.4%
stored on chain (gzip)               39,501 bytes    22.8%      3 shards
deployment (6 contracts)              12.80M gas
loading the document                   8.86M gas
total to launch                       21.65M gas
tokenURI()                   19.99M gas   103,808 B  (face 0: whole GUI)
tokenURIAt(id, 1)             3.32M gas     8,096 B  (still SVG)
tokenURIs()                  37.06M gas   129,088 B  (ERC-7160, every face)
Premises /token/1/live        4.48M gas    54,432 B  (same page over ERC-5219)
```

"Storing the document as plain text instead costs 23.58M gas to load", i.e. gzip saved ~62% of the load gas and, more importantly, keeps `tokenURI` reads under the 50 M node cap. Note the asymmetry the table exposes: the same bytes cost **19.99 M gas via `tokenURI`** (base64 of base64 of JSON, built in Solidity memory) but **4.48 M gas via the ERC-5219 route**, because the 5219 body is returned once, raw, as HTML. That 4.5× gap is the single strongest argument for making `web3://` the primary surface and `tokenURI` the compatibility surface.

---

## 3. The read-side budget: eth_call caps are the real size limit

- geth: `--rpc.gascap` "Sets a cap on gas that can be used in eth_call/estimateGas (0=infinite)", **default 50,000,000**; `--rpc.evmtimeout` default **5s**. IPSEITY's README adds erigon/reth default 50 M, nethermind 100 M, "hosted providers vary and are often lower" (their claim; provider defaults **unverified**).
- **EIP-7825** (Final; in Fusaka per EIP-7607): per-transaction cap of **16,777,216 gas**; transactions above it are "invalidated (not included in the txpool)". Base enforces the same cap (docs.base.org: "Per-transaction gas maximum: 16,777,216 gas (2^24), enforced via EIP-7825").
- Whether the cap applies to `eth_call` is client policy. geth issue #32625 exempted `eth_call`/`debug_traceCall`; but **geth issue #35838 (2026-09-29)** reports that after Amsterdam (EIP-8037's execution/state gas split) "`eth_call` requests become artificially limited to approximately 16.76M gas… `gasUsed` equals exactly 2^24" — the cap moved into `initRuntimeGasBudget` and no longer checks the simulation flag. Open, PR #35845 linked. IPSEITY hit the same wall with Hardhat under Osaka rules: "`tokenURI()` at 19.99M does not fit inside it."

**Consequence:** treat 16,777,216 as the hard ceiling for *every* view function a wallet, marketplace or gateway will call, and 50 M as the ceiling for nothing. The levers, in order: serve the document raw over ERC-5219 (4.48 M measured), gzip (62% saving), base64 once not twice, keep the JSON small (ERC-7496 traits readable "without parsing a 60 KB data URI"), and for genuinely large assets use **ERC-7617** chunking (`web3-next-chunk` header) so no single call exceeds the budget.

---

## 4. Marketplaces, wallets, sandboxes: who renders what, and who can connect

### 4.1 OpenSea (docs fetched today)

- `tokenURI` "can point to a JSON document or embed metadata onchain" — data URIs are accepted.
- `animation_url` formats: "GLTF, GLB, WEBM, MP4, M4V, OGV, OGG, MP3, WAV, and OGA. It can also point to an HTML page." For HTML: **"Scripts and relative paths within that page are supported, but browser extensions are not."**
- "OpenSea supports externally hosted media up to 300 MB"; SVG images are "cached as PNG". No stated limit for `data:` payloads (**unverified** whether an internal cap exists; IPSEITY's 104 KB face renders there according to its README, which is the only evidence I have).
- The sandbox attributes OpenSea uses are not documented. A 2021 Check Point write-up (summarised by CoinDesk/BleepingComputer; the primary research page was not fetched — **partially verified**) found that an SVG with an `<iframe>` opened on `storage.opensea.io` could reach `window.ethereum`; OpenSea fixed it within an hour of the 2021-09-26 report. Hagen Hübel's 2022-01-27 post (fetched) shows `animation_url` HTML executing arbitrary JS (IP detection) inside OpenSea's storefront iframe. The 2024 *International Journal of Information Security* paper "'Animation' URL in NFT marketplaces considered harmful for privacy" (published 2024-09-17, abstract fetched) shows embedded HTML can "fingerprint users… uniquely associate users with blockchain accounts"; secondary summaries say OpenSea and Rarible auto-load the animation URL while "commonly used wallets prevent the rendering of HTML files" (**unverified** beyond the abstract).

### 4.2 Wallet provider injection into frames (the decisive facts)

- **Brave** (docs fetched): third-party iframes get no provider "UNLESS the iframe has the `allow="ethereum"` attribute"; a first-party sandboxed iframe is blocked "UNLESS `sandbox="allow-same-origin"` is set"; and `data:`/`file:` contexts are "blocked (insecure)". Permissions-policy names: `ethereum`, `solana`.
- **MetaMask extension**, PR #46186 "fix: stop sandboxed frames inheriting the wallet session of the origin that served them" (opened 2026-09-04, Draft as of 2026-09-15): the provider is still injected (`all_frames: true`), but for an opaque `MessageSender.origin` "the connection is refused" — `eth_accounts`/`personal_sign` from a sandboxed child frame fail. Rationale: "sandboxed content cannot reach the parent's provider, which is the point of the sandbox". Until merged, today's behaviour is the *bug* (frames inheriting the parent's session), which is not something to build on.
- **Rainbow extension** issue #1616 (2024-07-04, open): `window.ethereum` not injected into dynamically-added iframes.
- **MetaMask mobile** issue #6200 (2023-04-17, closed "not planned"): base64 `data:` images/`animation_url` not rendered on iOS at the time; desktop renders the image but not the `animation_url`. Current mobile behaviour **unverified**.
- **Rainbow / Rarible** rendering of `data:` metadata and HTML: no primary statement found — **unverified**. Rainbow added a "refresh metadata" option (secondary).
- The **Chrome `web3://` extension** README (fetched) states "No support for wallet connections via `window.ethereum`" under Manifest V3; the Firefox "Web3URL" add-on and EthStorage's EVM Browser exist (not fetched — **unverified** feature set).

Putting it together: **inside any marketplace frame or any `data:` document, nothing can be signed.** IPSEITY's README says the same from experience ("a `data:` frame has an opaque origin and can be looked at but not used") and detects it cheaply ("storage throwing is the cheapest reliable signal") to hide the Connect button rather than offer one that fails. The 2025-11-18 arXiv paper *SecureSign* (fetched) proposes the inverse pattern — a trusted parent emulating an EIP-6963 provider into a sandboxed iframe over `postMessage` — which is precisely what a `web3://` shell page could do for its own `data:` artwork frame (§9).

### 4.3 CSP inside a data: document

A `data:` page cannot receive HTTP headers, but it can self-restrict with `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src *">`. That costs ~150 bytes, blocks any accidental external load, and gives marketplaces (and the privacy paper's reviewers) a mechanical guarantee that the page cannot phone home — the exact attack class the Springer paper documents. `connect-src` must still allow the RPC URL the user configures, or be set per build.

---

## 5. The web3:// stack (what a server-less origin looks like)

| ERC | Title | Status (today) | What we use it for |
|---|---|---|---|
| 4804 | Web3 URL to EVM Call Message Translation | **Final** (created 2022-02-14) | the scheme; `resolveMode()`; manual/auto modes |
| 6860 | Web3 URL to EVM Call Message Translation (update) | Draft | the normative grammar now: `web3://[userinfo@]contractName[:chainid][pathQuery][#fragment]`; `w3://` alias; `?returns=(…)`; adds ints, ABNF |
| 5219 | Contract Resource Requests | **Final** (2022-07-10) | the HTTP-like interface (below) |
| 6944 | ERC-5219 Resolve Mode | Draft | `resolveMode()` MUST return `"5219"` (`0x35323139…`) |
| 6821 | Support ENS Name for Web3 URL | Draft | ENS text record **`contentcontract`**, value `0x…` or ERC-3770 `base:0x…`; fallback to ERC-137 address; zero address → not found |
| 7087 | MIME type for Web3 URL in Auto Mode | Draft | `?mime.content=`, `?mime.type=`, `?mime.dataurl` (last wins; `returns` overrides) |
| 7617 | Chunk support for ERC-5219 mode | Draft (2024-02-08) | `web3-next-chunk` header → client fetches and concatenates until absent |
| 7618 | Content encoding in ERC-5219 mode | Draft (2024-02-08) | `Content-Encoding: gzip|br`; client inflates if it did not `Accept-Encoding` it |
| 7774 | Cache invalidation in ERC-5219 mode | Draft (2024-09-20) | `Cache-Control: evm-events`; contract emits `ClearPathCache` to purge gateway caches |

ERC-5219 interface (asset file fetched verbatim):

```solidity
struct KeyValue { string key; string value; }
interface IDecentralizedApp {
    function request(string[] memory resource, KeyValue[] memory params)
        external view returns (uint16 statusCode, string memory body, KeyValue[] headers);
}
```

Mapping (docs.web3url.io, fetched): `/index/2` → `resource = ["index","2"]`; `?asdf=1234&foo=bar` → `params = [{asdf,1234},{foo,bar}]`; the triple becomes the HTTP response, headers passed through (`Content-Type`, `web3-next-chunk`, `Content-Encoding`, `Cache-Control`). `request` is `view` by design: "read-only… to avoid transaction costs and mining delays". `body` is a `string`, so binary assets must be served base64 or via ERC-7618 compression (gateway inflates).

**Gateways and clients.** `w3link.io` ("all-blockchains", `https://<domainName>.<chainShortName>.w3link.io/<path>`) lists **Base mainnet (`base`/8453)**, Arbitrum One (`arb1`), Optimism (`oeth`), Ethereum (`eth`), Sepolia (`sep`) and 20+ others; **Base Sepolia (84532) is not listed**. `w3eth.io` is mainnet+ENS only. The open-source gateway (`ethstorage/web3url-gateway`) can be self-hosted in all-chains or single-chain mode. Clients: `web3curl`, the Firefox add-on, the Chrome extension (MV3-limited, no `window.ethereum`), EVM Browser.

**What a real origin buys.** Under `https://0x….base.w3link.io/` or in a native `web3://` client the page has a normal origin: EIP-6963 `announceProvider` events fire, `localStorage` works, and MetaMask/Rainbow/Brave inject. IPSEITY's `/token/<id>/live` is exactly this and the suite "asserts those bytes equal what `tokenURI` base64s", so the two surfaces can never drift.

---

## 6. Protocol-level size and gas: where EIP-7907, 7954, 8037 and EOF actually stand

- **EIP-170** (Spurious Dragon, 2016): 24,576-byte runtime code; **EIP-3860**: 49,152-byte initcode, 2 gas per 32-byte word of initcode.
- **EIP-7623** (Final; shipped in Pectra, May 2025 — fork name from memory, EIP page does not say): `tokens = zero_bytes + 4·nonzero_bytes`, cost = `max(4·tokens + execution + creation, 10·tokens)`. For a 24,576-byte SSTORE2 chunk the floor is 983,040 gas vs 393,216 standard, but the 4,915,200-gas code deposit sits in the standard branch, so the floor never binds on chunk deployment. (Glamsterdam's **EIP-7976 "Increase Calldata Floor Cost"** is also SFI — figure not fetched, **unverified**; same reasoning says it still won't bind.)
- **Fusaka**: EIP-7607 is *Final*; mainnet **2025-12-03 at epoch 411,392** (Holešky 2025-10-01, Sepolia 2025-10-14, Hoodi 2025-10-28). Core EIPs: 7594 PeerDAS, 7823, **7825 (tx gas cap 2^24)**, 7883, 7917, 7918, 7934 (RLP block size limit), 7939 CLZ, 7951 secp256r1; plus 7892 BPO forks, 7642, 7910, **7935 (default gas limit 60M)**. Validators crossed 60 M on 2025-11-25 (Cointelegraph/The Block, secondary). Fusaka blob target/max 6/9 (ethereum.org, 2026-05-07).
- **EIP-7907 "Meter Contract Code Size"**: created 2025-03-14; **removed from Fusaka at ACDE #216 on 2025-07-18** ("14 participants favored complete removal; only 6 supported including a modified version"; reasons: testing time, "pricing mechanism is not future compatible"). **On 2026-09-29 PR #12398 (Ben Adams) rewrote it to "defer size-limit increases to EIP-7954"**, keeping "code-loading gas metering, retaining the 24KB threshold and 2 gas per word charge" (`EXCESS_CODE_COST = ceil32(excess) · 2 / 32` on cold load). Status Draft; **not in the Glamsterdam list**. So the answer to "is EIP-7907 in Fusaka?" is **no**, and the thing that actually raises the limit is 7954.
- **EIP-7954 "Increase Maximum Contract Size"** (Review; created 2025-06-09; Rebuffo, Adams): **24 KiB → 64 KiB code, 48 KiB → 128 KiB initcode**, no gas changes. **Scheduled for Inclusion in Glamsterdam (EIP-7773)**; the only activation decided is **Sepolia epoch 353,024 = 2026-10-06 13:53:36 UTC**; Hoodi and mainnet "will be filled as activation times are decided by client teams". Secondary sources expect mainnet in Q4 2026 (**unverified**).
- **EIP-8037 "State Creation Gas Cost Increase"** (Review; created 2025-10-01): also **SFI in Glamsterdam**. `CPSB = 1,530` gas per state byte; new account 25,000 → ~183,600; new slot 20,000 → ~97,920; "Contract deployment costs increase approximately 8× for a 24 kB contract"; introduces a separate state-gas reservoir so that, in principle, deployments larger than the 16.7 M execution cap become possible. This is the item that changes our economics: **on L1 after Glamsterdam, 300 KB of SSTORE2 chunks would cost on the order of 8× today's 67 M gas.** Whether and when OP Stack / Base adopt 7954 and 8037 is undecided (**open question**).
- **EOF (EIP-7692)**: removed from Fusaka on 2025-04-28 (The Defiant, Blockworks — secondary); absent from EIP-7773 (verified by reading the list). Treat as not happening in 2026.
- **EIP-7903 "Remove Initcode Size Limit"**: Stagnant.
- **L2 limits.** *Base*: fully EVM-equivalent, so 24,576 bytes (the Base docs do not restate EIP-170 — **inferred**); block budget ~400 M gas, 2-second blocks, **per-tx 2^24 cap**, min base fee 5,000,000 wei (0.005 gwei). *OP Stack*: inherits geth's `MaxCodeSize` (no separate doc — **inferred**). *Arbitrum One/Nova*: "remain fixed at 24KB without a network-wide upgrade"; custom Arbitrum chains may set `MaxCodeSize` up to 96 KB and `MaxInitCodeSize` up to 192 KB at genesis only ("immutable after deployment"). *Stylus*: WASM "must fit within the 24Kb code size limit… after compression", uncompressed "< 128Kb" — a trick, not a bigger store.

---

## 7. What 100–300 KB costs to deploy in 2026 (computed, inputs stated)

Inputs: per 24,576-byte chunk, gas ≈ 21,000 + 32,000 (CREATE) + 16·bytes calldata + 2·⌈bytes/32⌉ initcode words + 200·bytes deposit + ~10 k overhead = **5,372,952 gas**; gzipped bytes are treated as incompressible for Base's FastLZ estimator. Base oracle **measured 2026-10-03 at block 52,098,952** via `mainnet.base.org`: `baseFeeScalar = 2,269`, `blobBaseFeeScalar = 1,055,762`, `l1BaseFee = 77,062,616 wei`, `blobBaseFee = 4,809,132 wei`, `eth_gasPrice = 6,000,000 wei`. Fjord formula (specs.optimism.io): `estimatedSizeScaled = max(100e6, −42,585,600 + 836,500·fastlzSize)`, `l1FeeScaled = baseFeeScalar·l1BaseFee·16 + blobFeeScalar·blobBaseFee`, `l1Fee = estimatedSizeScaled·l1FeeScaled / 1e12`. USD at an *assumed* $2,350/ETH (the figure ethereum.org used in May 2026).

| payload | chunks | gas | Base total (L2 + L1 data) | mainnet @0.15 gwei | @0.5 | @2 | @5 |
|---|---|---|---|---|---|---|---|
| 100 KB | 5 | 26.9 M | **0.000162 ETH (~$0.38)** | 0.0040 ETH (~$9) | 0.0134 (~$32) | 0.054 (~$126) | 0.134 (~$316) |
| 200 KB | 9 | 48.4 M | **0.000292 ETH (~$0.69)** | 0.0073 (~$17) | 0.0242 (~$57) | 0.097 (~$227) | 0.242 (~$568) |
| 300 KB | 13 | 69.8 M | **0.000421 ETH (~$0.99)** | 0.0105 (~$25) | 0.0349 (~$82) | 0.140 (~$328) | 0.349 (~$821) |

Observations. (1) On Base the L1 data component is ~0.5% of the total today (0.000002 ETH for 300 KB); it scales linearly with L1 base fee and blob fee, and even at 5 gwei / 1 gwei it would be ~0.00003 ETH per chunk. The L2 execution fee (200 gas/byte) dominates, and the L2 gas price is the volatile term (0.006 gwei measured; secondary sources report 0.1 gwei typical and 5–10 gwei during mint spikes — at 0.1 gwei the 300 KB figure becomes 0.007 ETH). (2) Mainnet gas (ethereum.org, 2026-05-07: "standard gas around 0.15 gwei, daily averages near 0.5 gwei") makes L1 deployment *affordable* today, but post-Glamsterdam EIP-8037 multiplies the deposit term ~8×. (3) The 2^24 per-tx cap means **≤3 chunks per transaction** (3 × 5.37 M = 16.12 M; a batching contract's overhead eats the rest). On Base that is 5 transactions for 300 KB; blocks have 400 M gas so inclusion is immediate.

---

## 8. Blobs and why they are not storage

EIP-4844 blobs are "visible to consensus clients for 18 days (4,096 epochs), after which they are pruned"; only the KZG versioned hash is retained by the execution layer. Fusaka raised the target/max to 6/9 per block and EIP-7918 bounds the blob base fee by execution cost. A blob is ~128 KB for a few gwei total today, which is tempting, but: the EVM cannot read blob contents (only `BLOBHASH`), nobody is obliged to keep them past 18 days, and "long-term archival depends on volunteer indexers, rollup teams, or third-party services". EthStorage builds an L2 that pays nodes to retain blob-posted data and exposes it through `web3://` (their gateway is the one above) — a reasonable *archive/mirror* tier, but its liveness is a separate network's economics, not Ethereum's state. **Rule for us:** code and anything the token's guarantees depend on live in contract bytecode; blobs/EthStorage at most for optional history exports (e.g. a chat archive snapshot) that can be lost without breaking anything.

---

## 9. Recommendations for the unified protocol

**MUST**

1. **Two surfaces, one byte-stream.** `tokenURI` returns the gzip-packed document as a `data:` URI for every marketplace and wallet; a `Premises`-style ERC-5219 contract (`resolveMode() == "5219"`) serves the *identical* HTML raw at `web3://<premises>:8453/token/<id>/live` (and `/`, `/swap`, `/chat`, `/launch`, `/vault`). Only the second can connect a wallet; the first must detect `origin === "null"`/storage-throws and present itself as a viewer with a link to the live route. Test that the two byte-streams are equal (IPSEITY does).
2. **Budget every read at 16,777,216 gas**, not 50 M. Gate CI on it (IPSEITY's `tools/gas.mjs` pattern). Keep `tokenURI` under the cap by serving a small face by default (still SVG + JSON) and the full GUI only via `tokenURIAt(id, 0)`/the live route — or get the full face under the cap with a single base64 pass. Serve big assets via ERC-7617 chunks.
3. **gzip + `DecompressionStream`**, loader declaring nothing global, no library, no brotli inside `data:`. Minify with a reserved-globals list. Verify the round trip byte-for-byte in CI.
4. **SSTORE2 via Solady `writeDeterministic` (CREATE3) with fixed salts**, so chunk addresses are identical on every chain; freeze pointers one-way. Also register the same bytes as EthFS files (`createFileFromSlices`) at `0xFe1411…FB` so other projects can import them and so the loader/libraries become a public commons.
5. **Deploy app bytes on Base (or another OP Stack chain) first.** ~0.0004 ETH vs 0.01–0.35 ETH on L1 for 300 KB, and L1 gets ~8× worse at Glamsterdam. Keep L1 for the token-of-record only if the design needs mainnet settlement; the `web3://` URL carries the chain id so the app address is the same either way.
6. **Hard content rules in the document**: `<meta http-equiv="Content-Security-Policy">` with `default-src 'none'`; all chain strings through `textContent`/escapers (`Web.esc`, `Web.jsonEsc`); no `eval`, no external `src`, no fetch except the user's RPC. The 2021 OpenSea SVG/iframe incident and the 2024 fingerprinting paper are the two reasons marketplaces sandbox us; give them nothing to find.
7. **Authorisation in contracts, never in the page.** The page reads `ownerOf`, `isApprovedForAll`, the ERC-6551 account, session keys/roles to decide what to *show*; every write is checked on chain. Holding the token buys the right to write, not to read (public chain).

**SHOULD**

8. Return `Content-Type`, `Content-Encoding: gzip` (ERC-7618) for assets, and `Cache-Control: evm-events` with `ClearPathCache` events (ERC-7774) on state changes, so gateways cache aggressively but refresh instantly.
9. Set the ENS `contentcontract` record (ERC-6821) with an ERC-3770 chain-prefixed value (`base:0x…`) so `web3://name.eth/…` resolves to the Base deployment.
10. Keep a ≤8 KB still face (SVG) as `image` for wallets that never render HTML (MetaMask mobile history), and expose ERC-7496 traits so indexers never parse the big URI.
11. Build the loader against the 64 KiB pointer size now (Solady already supports 0xfffe) so a post-Glamsterdam redeploy halves chunk count without code changes; but do not *depend* on 7954 until it is live on the target chain.
12. Ship a `verify` route (`/token/<id>/hash`) returning `keccak256` of the assembled document and a tiny offline `reconstruct.js` so anyone with an RPC can rebuild and check the page without a gateway.

**COULD**

13. Use ERC-7617 to stream large optional assets (fonts, 3D models) only when the live route is used.
14. Offer a brotli-encoded variant over ERC-7618 for gateway clients (smaller bytes, gateway inflates) while keeping gzip in the `data:` path.
15. Export conversation/market history to blobs or EthStorage as a *convenience archive*, clearly labelled as non-canonical.

**AVOID**

16. Any upgradeable pointer table, any admin key over content, any `src="https://…"`, any IPFS/Arweave fallback, any reliance on marketplace iframes to sign, brotli-only loaders, `eval`-based loaders, `tokenURIs()`-style "everything at once" reads above 16.7 M gas, and blobs for anything that must exist in a year.

---

## 10. Special ideas (what would make this NFT stand out)

- **The token *is* a website with a stable address on five chains.** CREATE3-deterministic Premises + chunks mean `web3://0xSAME:1/`, `:8453/`, `:10/`, `:42161/` all exist; the ENS `contentcontract` record points at the canonical chain. No other NFT collection today publishes a cross-chain-identical origin.
- **A shell that lends the artwork a wallet.** On the live origin, the page hosts its own `tokenURI` artwork in a sandboxed iframe and emulates an EIP-6963 provider into it over `postMessage` (the SecureSign pattern, arXiv 2025-11-18). The *same bytes* a marketplace shows inert become interactive inside the token's own site, with every request passing through the parent's confirmation UI — a demonstrable security story.
- **Holder-published pages inside the token.** `/token/<id>/site` serves bytes the holder wrote into their own SSTORE2 pointer registered under the token's ERC-6551 account (SSTORE3-style small pointers packed with a version). A personal homepage that transfers with the token and can be sealed.
- **Cache-coherent gateways.** Emit `ClearPathCache("/token/42/*")` on every swap/message/launch so `w3link.io` and self-hosted gateways serve fresh pages with HTTP cache semantics — the first NFT to use ERC-7774 in anger.
- **Capability-aware UI.** Three modes detected at boot: opaque origin (viewer; "open live" link + QR), gateway `https` origin (full, EIP-6963), native `web3://` (full, plus `web3://` deep links). State "zero" vs "no answer" distinctly, as IPSEITY's console does.
- **Integrity you can check from a terminal.** `web3curl web3://…/token/42/hash` returns the document hash; `/token/42/raw` returns the `tokenURI`; a one-line script proves they agree. Publish the hash in `contractURI` (ERC-7572).
- **Commons-first libraries.** Upload the loader and shared JS to EthFS under versioned filenames and point scripty-compatible `text/javascript+gzip` tags at them, so other on-chain projects (Art Blocks engine, Alba, fxhash) can reuse ours and we theirs.
- **Glamsterdam-ready chunker.** A chunk size parameter (24,576 today, 65,536 when 7954 is live) with CI that redeploys both layouts and proves identical output.
- **A `/services.json` machine route** describing every function the token offers, so agents (ANIMA's model) and wallets discover capabilities without parsing HTML.

---

## 11. Open questions

1. Will Base/OP Stack adopt EIP-7954 (64 KiB) and EIP-8037 (8× deployment cost), and on what schedule? Base docs do not state code size at all; OP hardforks lag L1 by months.
2. Will MetaMask merge PR #46186 (refuse opaque-origin connections) and will other wallets follow? Either way, `data:` pages can't sign — but the failure mode (silent inherit vs refusal) matters for UX copy.
3. Do hosted RPCs (Alchemy, Infura, QuickNode, Base's public endpoint) apply the 2^24 cap to `eth_call` now? geth #35838 is open; measure against each provider before fixing the `tokenURI` budget.
4. Which wallets render HTML `animation_url` in 2026 (Rainbow, Rabby, Coinbase Wallet, MetaMask mobile)? No primary documentation found; needs a device matrix.
5. Does OpenSea still proxy `animation_url` HTML through its own storage domain, and with which `sandbox` flags? Their docs only say "browser extensions are not" supported.
6. Base Sepolia is absent from `w3link.io`; is a self-hosted `web3url-gateway` acceptable for testnet CI, or should the testnet be OP Sepolia/Sepolia?
7. When does `DecompressionStream("brotli")` reach Safari and Firefox? Until then gzip is the only cross-browser format.
8. EIP-7976's new calldata floor: exact numbers, and whether it ever binds for chunk deployment (it should not, because the 200 gas/byte deposit sits in the standard branch).
9. Does any marketplace impose an internal size cap on `data:` metadata (OpenSea documents 300 MB for *external* media only)? IPSEITY's 104 KB face is the only empirical data point.
10. ERC-7617/7618/7774 support in the Firefox add-on, the Chrome extension and EVM Browser: documented in the gateway docs, but client coverage is unverified.

---

## Sources (with page dates where shown)

Primary (fetched 2026-10-03 unless noted):
- EIP-7907 Meter Contract Code Size — https://eips.ethereum.org/EIPS/eip-7907 (Draft; created 2025-03-14); PR #12398 (merged 2026-09-29) — https://github.com/ethereum/EIPs/pull/12398
- EIP-7954 Increase Maximum Contract Size — https://eips.ethereum.org/EIPS/eip-7954 (Review; created 2025-06-09)
- EIP-7773 Glamsterdam meta — https://eips.ethereum.org/EIPS/eip-7773 (Sepolia epoch 353024, 2026-10-06)
- EIP-7607 Fusaka meta — https://eips.ethereum.org/EIPS/eip-7607 (Final; mainnet 2025-12-03 epoch 411392)
- EIP-7825 — https://eips.ethereum.org/EIPS/eip-7825 ; EIP-7623 — https://eips.ethereum.org/EIPS/eip-7623 ; EIP-8037 — https://eips.ethereum.org/EIPS/eip-8037 (Review; 2025-10-01); EIP-7903 — https://eips.ethereum.org/EIPS/eip-7903 (Stagnant)
- ERC-4804 (Final) — https://eips.ethereum.org/EIPS/eip-4804 ; ERC-6860 — https://eips.ethereum.org/EIPS/eip-6860 ; ERC-5219 (Final) — https://eips.ethereum.org/EIPS/eip-5219 and https://eips.ethereum.org/assets/eip-5219/IDecentralizedApp.sol ; ERC-6944 — https://eips.ethereum.org/EIPS/eip-6944 ; ERC-6821 — https://eips.ethereum.org/EIPS/eip-6821 ; ERC-7087 — https://eips.ethereum.org/EIPS/eip-7087 ; ERC-7617 — https://eips.ethereum.org/EIPS/eip-7617 ; ERC-7618 — https://eips.ethereum.org/EIPS/eip-7618 ; ERC-7774 — https://eips.ethereum.org/EIPS/eip-7774
- web3:// docs — https://docs.web3url.io/web3-clients/https-gateway.md ; https://docs.web3url.io/web3-url-structure/resolve-mode/mode-resource-request.md ; Chrome extension README — https://github.com/ComfyGummy/chrome-web3
- EthFS — https://github.com/frolic/ethfs ; IFileStore.sol and File.sol (raw, main)
- scripty.sol — https://github.com/intartnft/scripty.sol ; ScriptyStructs.sol, ScriptyCore.sol, deployment.json (raw, main)
- Solady SSTORE2.sol — https://github.com/Vectorized/solady/blob/main/src/utils/SSTORE2.sol ; 0xsequence sstore2 — https://github.com/0xsequence/sstore2 ; SSTORE3 — https://github.com/Philogy/sstore3
- Art Blocks on-chain storage — https://docs.artblocks.io/protocol/on-chain-storage/
- OpenSea metadata — https://docs.opensea.io/docs/metadata-standards ; media — https://docs.opensea.io/docs/media-and-traits
- MetaMask extension PR #46186 (2026-09-04) — https://github.com/MetaMask/metamask-extension/pull/46186 ; MetaMask mobile #6200 (2023-04-17) — https://github.com/MetaMask/metamask-mobile/issues/6200 ; Rainbow #1616 (2024-07-04) — https://github.com/rainbow-me/browser-extension/issues/1616 ; Brave provider availability — https://wallet-docs.brave.com/provider-availability/
- geth CLI (rpc.gascap 50,000,000) — https://geth.ethereum.org/docs/fundamentals/command-line-options ; geth issue #35838 (2026-09-29) — https://github.com/ethereum/go-ethereum/issues/35838
- MDN data: URLs — https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/data ; MDN DecompressionStream — https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream
- Base limits — https://docs.base.org/base-chain/network-information/throughput-and-limits ; Base fees — https://docs.base.org/base-chain/network-information/network-fees ; OP Fjord spec — https://specs.optimism.io/protocol/fjord/exec-engine.html ; Base GasPriceOracle values measured via https://mainnet.base.org at block 52,098,952
- Arbitrum size limit — https://docs.arbitrum.io/launch-arbitrum-chain/chain-config/execution/smart-contract-size-limit ; Stylus VALID_WASM — https://github.com/OffchainLabs/cargo-stylus/blob/main/main/VALID_WASM.md
- ACDE #216 minutes (2025-07-18) — https://christinedkim.substack.com/p/acde-216-minutes
- ethereum.org "Building on Ethereum in 2026" (2026-05-07) — https://ethereum.org/latest/building-on-ethereum-in-2026/
- Hübel, "How OpenSea allows XSS" (2022-01-27) — https://0xhagen.medium.com/how-opensea-allows-cross-site-scripting-attacks-xss-bc28265ebdf7
- "'Animation' URL in NFT marketplaces considered harmful for privacy", IJIS (2024-09-17) — https://link.springer.com/article/10.1007/s10207-024-00908-x
- SecureSign (arXiv 2511.14611, 2025-11-18) — https://arxiv.org/abs/2511.14611
- IPSEITY README (local, /home/user/Most-Advanced-NFT-Possible/README.md) — measured sizes and gas

Secondary / not fetched directly (marked unverified in text): Check Point OpenSea research (2021-10-13) via CoinDesk/BleepingComputer; EOF removal (2025-04-28) via The Defiant/Blockworks; 60M gas limit (2025-11-25) via Cointelegraph/The Block; Base typical gas prices via openliquid.io (2026-04-28); caniuse DecompressionStream versions; EthFS `gunzipScripts` convention via ethereumnavi.com (2023).
