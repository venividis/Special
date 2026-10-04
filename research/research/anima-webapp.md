# ANIMA (Cutting-edge-technologically-advanced-NFT) — web app / Sanctuary site / CLI dossier

Repository: `/home/user/Cutting-edge-technologically-advanced-NFT`, default branch `main` at `e345828` (Merge PR #42, 2026-09-16). Read-only review; every file in the assigned area was read in full (`index.html`, `src/**`, `public/**`, `vite.config.js`, `cli/**`, `examples/**`, `schemas/**`, `package.json`, `.github/workflows/**`, the README sections on the Sanctuary and GUI access), plus the on-chain renderer `contracts/web/AnimaWeb3Renderer.sol` and its deploy script/test/workflow because they are the only part of this repo that actually serves a UI *from chain*, and the unmerged UI branches (`upgrade/sanctuary-commons-3d-20260904`, `fix/utility-workflows-20260904`, `codex/find-access-method-for-nft-gui`). Line numbers below are `file:line` on `main` unless a branch is named.

---

## 1. Executive answer: how the web UI is delivered, and how ownership is verified

ANIMA has **three distinct human surfaces**, delivered three different ways, with three different ownership-verification stories. None of them matches the GOAL's "the NFT mints a website that verifies you hold the NFT" end to end, but one of them (the ERC-4804 renderer) is the right skeleton.

| Surface | Delivery | Where the code lives | Ownership / access check |
|---|---|---|---|
| **The Sanctuary** (`index.html` + `src/main.js` + `src/style.css`) | **Static site**: Vite build → GitHub Pages at `https://venividis.github.io/Cutting-edge-technologically-advanced-NFT/` (`.github/workflows/pages.yml`), or `npm run ui` locally. Fonts from Google Fonts CDN. Not on chain, not on IPFS. | `src/main.js` (26,881 bytes), `src/style.css` (17,569 bytes), `index.html` (1,955 bytes) | **Client-side enumeration**: after `eth_requestAccounts`, `discover()` (`src/main.js:178`) reads `totalMinted()` and calls `ownerOf(id)` for every id `1..total`, keeping ids whose owner equals the connected address. No signature challenge, no server, no SIWE. The "gate" is purely presentational; the real gate is the contract's `_requireOwnerOf`/`_requireController` which `simulateContract` surfaces before the wallet is asked to sign (`src/main.js:180`). A read-only "inspect any agent by token ID" path needs no wallet (`src/main.js:187`). |
| **The on-chain console** (`contracts/web/AnimaWeb3Renderer.sol`) | **From chain, ERC-4804 manual mode**: a stateless, ownerless contract whose `fallback(bytes path)` returns an ABI-encoded HTML string for `/token/{id}/live`. Reachable at `web3://0x9160bE4d…:84532/token/{id}/live` or through the w3link gateway `https://0x9160be4d943516a2463ac5f3abac5f5cce7975cd.basesep.w3link.io/token/{id}/live` (`public/.well-known/anima.json:60-64`). **But** its embedded `<script type="module">` imports viem from `https://esm.sh/viem@2.55.19` (`AnimaWeb3Renderer.sol:128`), so the page is only *partly* on chain: markup, CSS and app logic are on chain; the ABI coder/RPC client is a CDN dependency. | `contracts/web/AnimaWeb3Renderer.sol` (138 lines; 22,592 runtime bytes; served token page ≈15.8 KB of literal HTML/CSS/JS) | **No viewer gating at all**: every visitor gets the same page with owner/account/fingerprint for the token. Writes (`setStatus`, `deployAccount`, `setGuardian`, `setOperator`, arbitrary signature) go through `simulateContract({account:user})` then `writeContract` (`AnimaWeb3Renderer.sol:134-135`); authorisation is entirely the token contract's. |
| **The ENS terminal** (`cli/anima.mjs`) | Node CLI (`npm run anima`), interactive readline wizard. | `cli/anima.mjs` (190 lines, 10,855 bytes) | **On-chain controller check**: `isController(agentId, signer)` must be true (`cli/anima.mjs:123-125`); permanent ENS custody additionally requires `ownerOf(id) == signer` and home chain `== 1` (`cli/anima.mjs:145-151`). |

A fourth surface exists only on an unmerged branch: the **Sanctuary Commons** 3D social client plus the `AnimaCommons` contract (`origin/upgrade/sanctuary-commons-3d-20260904`), reviewed in §10 because it is the only "messaging / crypto-social" UI work in this repo and it is directly relevant to the GOAL.

Bottom line for the design team: **ANIMA's token metadata (`tokenURI`) is a plain stored string** (`contracts/core/AnimaAgent.sol:360-363`, `contracts/diamond/AnimaBase.sol:204-207`); the Sanctuary's mint path stuffs a self-contained `data:application/json` + `data:image/svg+xml` into it (`src/main.js:147-154`), so wallets can render the NFT without a server, but the *website* is not minted with the token. The website is either a GitHub Pages bundle or a separate ERC-4804 renderer contract that any token id can be routed through. The renderer is the piece to keep and harden; the Sanctuary is a reference for UX copy and wallet flows but should not be reused as-is.

---

## 2. Inventory of the area

| Path | Bytes | What it is | Verdict |
|---|---:|---|---|
| `index.html` | 1,955 | Vite entry: SEO/OG meta, JSON-LD `SoftwareSourceCode`, Google Fonts link, `<div id="app">`, `<script type="module" src="/src/main.js">` | drop (replace with chain-served HTML) |
| `vite.config.js` | 236 | `base: './'` so one build works on localhost, an IPFS directory and GitHub Pages | adapt (keep relative-base idea for any static fallback) |
| `src/main.js` | 26,881 | Landing page + Sanctuary owner portal + mint + console, viem, Base Sepolia only | adapt (wallet/mint/console flows), rewrite UI |
| `src/style.css` | 17,569 | Editorial dark theme (Playfair/Manrope/DM Mono), landing + sanctuary + console styles | drop/adapt (fonts are CDN) |
| `public/.well-known/anima.json` | 3,763 | Machine directory: chain, every contract address, standards list, discovery pointers, renderer URL templates, safety rules | adapt (good pattern; regenerate) |
| `public/llms.txt` | 2,706 | LLM-oriented index of docs; integration recipe (hash-before-parse) | adapt |
| `public/anima-functions.json` | 451,868 | Generated ABI index: 29 contracts, 657 functions, selectors, mutability, Base Sepolia addresses | adapt (regenerate from merged ABIs) |
| `public/robots.txt`, `public/sitemap.xml` | 115 / 213 | Trivial | drop |
| `cli/anima.mjs` | 10,855 | `/bind` wizard: ENS addr/text/contenthash via resolver `multicall`, optional custody transfer into the agent's ERC-6551 account | reuse-verbatim (helpers) / adapt (wizard) |
| `examples/manifests/base-sepolia-example.json` | 1,622 | ERC-8004 registration-v1 example with `anima.gui` block pointing at the renderer | adapt |
| `schemas/anima-agent-manifest-v1.schema.json` | 8,108 | Strict (`additionalProperties:false`) JSON Schema 2020-12 for the manifest incl. `gui`, `mcp`, `pricing`, `model`, `mesh`, `handles`, `markets` | adapt |
| `schemas/anima-directory-v1.schema.json` | 1,749 | Schema for `.well-known/anima.json` | adapt |
| `package.json` scripts | 2,177 | `ui`, `ui:build`, `ui:preview`, `anima`, `test:cli`, `test:manifest-schema`, `testnet:web3-renderer`, `testnet:batch-mint`, `testnet:batch-exercise`, `catalog:generate` | adapt |
| `.github/workflows/pages.yml` | 922 | Build + deploy `dist/` to GitHub Pages on push to main | drop (GOAL forbids a static host as the primary) |
| `.github/workflows/deploy-web3-renderer.yml` | 1,470 | Manual workflow: deploy/reuse renderer, commit address to `deployments/84532.json` | adapt |
| `.github/workflows/ci.yml` | 369 | `npm ci`, `audit:prod`, `hardhat build`, `hardhat test` | adapt |
| `contracts/web/AnimaWeb3Renderer.sol` | 22,592 runtime bytes | ERC-4804 manual-mode HTML renderer | adapt (the keeper) |
| `scripts/deploy-web3-renderer.ts` | 3,328 | Deploys/reuses renderer, keeps `web3RendererHistory`, prints w3link URLs, writes GitHub step summary | adapt |
| `scripts/testnet-batch-mint.ts` | 7,096 | Resumable batch mint with checkpoint in the deployment record | adapt |
| `scripts/testnet-batch-exercise.ts` | 12,006 | 32-tx lifecycle run across ten Sepolia agents with read-back audit | adapt (as a test harness pattern) |
| `scripts/generate-agent-function-index.mjs` | 3,151 | Builds `anima-functions.json` from Hardhat artifacts | adapt |
| `test/Web3Renderer.test.ts`, `test/Cli.test.mjs`, `test/ManifestSchema.test.mjs` | 2,157 / 1,246 / 2,502 | The only tests covering this area (2 + 3 + 4 tests) | adapt |

---

## 3. `src/main.js` — the Sanctuary (static, Base Sepolia only)

### 3.1 Structure

A single ES module (191 lines, many of them 1–2 KB minified-style one-liners) that renders the whole page into `#app` with a template literal (`src/main.js:34-94`) and then wires handlers.

**Landing page (marketing, fictional data).** `beings` (`src/main.js:5-11`) is a hard-coded array of five fictional agents with fake bonds (`'18.4 ETH'`) and trust scores (`98`); the hero shows `231 proofs passed`, `24.8Ξ highest bond`, `∞ possible selves` (`src/main.js:50`). A daily-autonomy slider is purely cosmetic (`value*0.057` ETH, `src/main.js:113`). Sound buttons just toast "will awaken in the full experience" (`src/main.js:115`). The unmerged commons branch explicitly calls these out as misleading and relabels them `bond:'Sample', trust:'Not verified'` (branch `src/legacy.js`). **Do not carry any of this forward.**

**The Sanctuary aside** (`src/main.js:84-93`): a full-screen overlay with a *portal stage* ("OWNER PORTAL · BASE SEPOLIA", "Connect the wallet holding your NFT. No account. No email. Your signature on the chain is the key." — `src/main.js:87-88`) offering three entries: **Connect wallet**, **I need to mint one first**, **or inspect any agent by token ID**; and an *owner stage* with a wallet pill, ownership summary, owned-agent grid and an `.agent-console` region.

### 3.2 Chain binding and ABI

- `ANIMA = '0xb3d92c766e3cb356db381feb21958a9ebb974365'` (`src/main.js:120`) — this is the **second** Base Sepolia deployment (deployer `0xc591…`, record `deployments/84532-0xc591c669162cd4da8ab9bfa2c2e68d538a312c00.json`), *not* the `0x0aeb6f78…` deployment that `deployments/84532.json`, CLAUDE.md and the README's "Live on Base Sepolia" table describe. It was switched in commit `9cb1ebb` ("Link onchain NFT pages to owner console", 2026-09-16). README step 5 (`README.md:466-468`) still tells users to import contract `0x0aeb6f78…` — a documentation/code mismatch.
- Single public RPC `http('https://sepolia.base.org')` (`src/main.js:141`), explorer `https://sepolia.basescan.org`.
- Hand-written ABI subset (`src/main.js:124-140`): `totalMinted`, `ownerOf`, `tokenURI`, `modelOf` (tuple `weightsRoot,runtimeMeasurement,attestationKind,modelId`), `statusOf`, `sealPolicyOf`, `brainEpoch`, `accountOf`, `locked`, `getStateFingerprint`, `policyOf` (tuple `perTxWei,dailyWei,expiry,allowDelegateCall,allowUnlistedTargets,targetsRoot`), `setStatus(uint256,uint8)`, `deployAccount(uint256)`, `mintAgent(to,agentURI,manifestHash,model,shards[],seal,metadata[])`, event `Transfer`.
- Labels: `statuses = ['Dormant','Awake','Paused','Disputed','Retired']` (`src/main.js:122`) maps correctly onto `IAnima.AgentStatus {Inactive,Active,Paused,Disputed,Retired}` (`contracts/interfaces/IAnima.sol:12-18`); `seals = ['Public','Committed','Re-keyed','Sealed TEE','Sealed ZK','Threshold']` (`src/main.js:123`) maps correctly onto `SealPolicy {None,Committed,ReKeyed,SealedTEE,SealedZK,Threshold}` (`IAnima.sol:27-35`). (The renderer gets this wrong — see §4.)

### 3.3 Ownership discovery — the access-control algorithm, verbatim logic

`discover()` (`src/main.js:178`):
1. `total = read('totalMinted')`.
2. `Promise.all` over ids `1..total`: `getAddress(await read('ownerOf',[id])) === getAddress(walletAddress) ? id : null`, with per-id `try/catch → null` (burned/nonexistent ids are silently skipped).
3. `owned = Promise.all(ids.map(loadAgent))`.
4. Renders `"NN sovereign beings recognize this wallet — Ownership verified from Base Sepolia just now"`, the owned grid, or an empty state with a **Mint my testnet agent** button; if exactly one agent is owned it auto-opens the console.
5. Any throw → `toast('The Base Sepolia RPC did not answer. Please retry.')` (note the stray second argument `,true` — `toast` takes one parameter).

Properties worth recording:
- **O(totalMinted) RPC calls per connect**, all fired concurrently. Fine at 32 tokens; hostile at 4,096 and against a public rate-limited endpoint. The unmerged `codex/find-access-method-for-nft-gui` branch rewrote this as a *sequential* loop with `readOwner(id, attempts=3)` exponential retry and a "Ownership could not be verified… Retry discovery" state instead of silently dropping ids (branch diff of `src/main.js:142-178`). That branch's `waitForSuccessfulTransaction(hash)` also checks `receipt.status !== 'success'` and `onReplaced` reasons — `main` does neither (`src/main.js:180-181` never inspect `receipt.status`).
- No proof of key possession beyond `eth_requestAccounts`; a wallet that lies about its address only sees a UI it could have seen via "inspect by token ID" anyway. Nothing sensitive is gated client-side.
- Operators, ERC-4907 users, guardians and ERC-7432 role holders are **not** discovered — only `ownerOf`. The CLI's `isController` is the better predicate for "authorised by its holder".

`loadAgent(id)` (`src/main.js:168-174`) issues nine reads in parallel plus `getCode(account)` to decide `deployed`, and derives a deterministic hue `(id*47+32) % 360`.

### 3.4 Wallet connect

`connect()` (`src/main.js:179`): requires `window.ethereum`; `createWalletClient({chain:baseSepolia, transport:custom(window.ethereum)})`; `requestAddresses()`; if `getChainId() !== 84532` tries `switchChain`, and on failure `wallet_addEthereumChain` with the hard-coded Base Sepolia params (`chainId:'0x14a34'`, RPC `https://sepolia.base.org`, explorer). Then `discover()`.

### 3.5 The command chamber (console)

`showConsole(a)` (`src/main.js:177`) renders: state fingerprint (short), `seal / EPOCH n`, the ERC-6551 account (`◆ LIVE ERC-6551 ADDRESS` vs `◇ ADDRESS RESERVED` from `getCode`), daily horizon `formatEther(policy.dailyWei)`, a copy-address row, and actions: **Pause safely / Awaken agent** (`setStatus(id, status===1?2:1)`), **Activate web3 address** (`deployAccount`, only if not deployed), **Add NFT to Brave** (`wallet_watchAsset` ERC721, `src/main.js:156-162`), and an explorer link. The copy says "Every command is simulated before your wallet is asked to sign" and "NO PRIVATE KEYS ENTER THIS PAGE".

`transact(button)` (`src/main.js:180`): `simulateContract({account:walletAddress})` → `writeContract(request)` → `waitForTransactionReceipt` → reload. Button text cycles `Simulating… / Confirm in wallet… / Becoming onchain…`.

### 3.6 Mint path and the self-contained metadata

`mintAgent()` (`src/main.js:181`):
- `window.prompt('Name your testnet agent','Astra')`.
- `seed = ANIMA:<wallet>:<name>:<Date.now()>`; `predictedId = totalMinted()+1` (used only for hue — a benign read-before-write race).
- `model = {weightsRoot: keccak256(seed:model), runtimeMeasurement: 0x0, attestationKind: 0, modelId: 'anima/<slug>'}`.
- one shard `{dataHash: keccak256(seed:memory), keyCommitment: 0x0, size: utf8len(seed), kind: 1, uri: '', description: 'Genesis memory commitment'}`.
- `uri = metadataURI(name, hue)` and **`manifestHash = keccak256(toHex(uri))`** — i.e. the hash of the URI *string*, not of the bytes the URI resolves to. ANIMA's own verification rule is "keccak256 over the exact bytes served by the URI" (`docs/AGENT_INTEGRATION.md:13-14`, `public/.well-known/anima.json:53`), so Sanctuary-minted tokens carry a commitment that `verifyManifest(id, decodedBytes)` will **reject**. This is a real bug for anything that later verifies manifests.
- `mintAgent(wallet, uri, hash, model, shards, 0 /*SealPolicy.None*/, [])`, token id taken from the `Transfer` log (`from == 0x0`) — the repo's "take ids from receipt logs" rule.
- Second transaction `deployAccount(id)`; failure is tolerated ("Its reserved address can be activated later").
- Then `discover()`, `showConsole`, `addNFTToWallet`.

`metadataURI(name,hue)` (`src/main.js:147-154`) — load-bearing comment: *"The metadata is stored with the token instead of pointing at this website. Wallets such as Brave can therefore render a freshly minted ANIMA without an IPFS gateway or hosted API."* It builds a 1000×1000 SVG sigil (name HTML-escaped via `safe()`), wraps it as `data:image/svg+xml;charset=utf-8,<encodeURIComponent>` and returns `data:application/json;charset=utf-8,<encodeURIComponent(JSON)>` with `name:"ANIMA — <name>"`, a description, `external_url: location.origin+location.pathname` (**bakes the GitHub Pages URL into on-chain metadata**), and attributes `Network: Base Sepolia`, `Account standard: ERC-6551`, `Memory: Genesis commitment`. This is the only "fully on-chain, no server" artefact the Sanctuary produces, and it is produced client-side at mint time, not by the contract.

### 3.7 Deep link and read-only inspection

`inspectAgent(id)` (`src/main.js:187`) loads an agent without a wallet and shows owner/account/status/seal/epoch with a **Manage this agent** button that merely opens the Sanctuary with the id pre-filled. `?agent=<digits>` (`src/main.js:190-191`) opens the Sanctuary and inspects that id — added in `9cb1ebb` so the on-chain renderer could link back to the static console; the renderer later dropped that link (`20bfda6`), and `test/Web3Renderer.test.ts:30` now asserts `doesNotMatch(html, /github\.io/)`.

### 3.8 XSS posture

`safe()` escapes `& < > " '` and is applied to `modelId` and names; addresses/bigints are interpolated raw (acceptable since they come from `getAddress`/BigInt). The commons branch tests escaping explicitly; `main` has no UI tests at all.

### 3.9 `src/style.css`

Three very long lines for the landing page (`:root` tokens `--ink/--muted/--night/--line/--gold`, `.grain` SVG-noise overlay, hero orbit animations, card track, steward section, dialog, toast, reveal transitions), an 800px breakpoint, a `prefers-reduced-motion` block, then the Sanctuary section (`src/style.css:5-7`: fixed overlay, portal stage, owner stage, owned-grid, console metrics/actions) and later additions (`:9-12`: `[hidden]` guard, `.mint-entry`, `.web3-address`). Depends on Google Fonts (`Playfair Display`, `Manrope`, `DM Mono`) loaded in `index.html:33` — an external request a chain-served page must not make.

### 3.10 Tests

None for `src/main.js` or `src/style.css` on `main`. The commons branch adds `test/CommonsModel.test.mjs` (19 pure-JS tests) and a Playwright runner for its own client.

---

## 4. `contracts/web/AnimaWeb3Renderer.sol` — the on-chain console (ERC-4804 manual mode)

### 4.1 Purpose and design statement (verbatim)

```
 * @title AnimaWeb3Renderer
 * @notice ERC-4804 manual-mode pages for ANIMA agents.
 * @dev A Web3URL client sends the URL path as raw fallback calldata. The fallback response is an
 *      ABI-encoded string, as required by manual mode. Keeping this separate from the immutable
 *      ANIMA diamond lets an existing collection gain a browser without changing token logic.
```
(`AnimaWeb3Renderer.sol:11-17`). And from the deploy script: *"The renderer is immutable, stateless and has no privileged owner. Any funded account may deploy it, which makes recovery possible without the original collection deployer key."* (`scripts/deploy-web3-renderer.ts:36-37`). This is exactly the right instinct given that the first deployment's key was destroyed (CLAUDE.md "Live chains").

### 4.2 Public API

```solidity
interface IAnimaWeb3View { function ownerOf(uint256) external view returns (address); function accountOf(uint256) external view returns (address); }
IAnimaWeb3View public immutable ANIMA;                       // :22
error ZeroAddress();                                          // :24
constructor(IAnimaWeb3View anima_);                           // :26-29, reverts ZeroAddress on 0
function resolveMode() external pure returns (bytes32);       // :32-34, returns bytes32("manual")
fallback(bytes calldata path) external returns (bytes memory);// :37-47
```
Routing (`:37-47`): path `"/"` → `_index()`; `_tokenPath` must match `^/token/[0-9]+/live$` (prefix/suffix byte compare, digits accumulated into `tokenId` with no overflow guard — a 78+ digit path would panic rather than 404, `:49-64`); then `try ANIMA.ownerOf(tokenId)` → `_token(id, owner, ANIMA.accountOf(id))`, catch → `_notFound()`. Every response is `abi.encode(string)`.

Storage: exactly one `immutable`; no state, no owner, no events. Gas: pure view path; w3link/eth_call only.

### 4.3 What the token page contains (`_token`, `:76-99`)

- `<header>`: brand, chain pill (`_chainName`: `84532→"BASE SEPOLIA"`, `11155111→"ETHEREUM SEPOLIA"`, else `"CHAIN n"`, `:101-105`), `#connect` button.
- `<main id="app" data-token=… data-contract=… data-chain=block.chainid>` — the script reads its configuration from these attributes, so the same bytecode works on any chain it is deployed to.
- Hero copy "Not merely owned. Fully alive."
- Four tabs: **OVERVIEW** (owner, ERC-6551 account, collection, state fingerprint, each with COPY; a "capabilities" chip list `ERC-721 IDENTITY · ERC-6551 WALLET · ENCRYPTED MEMORY · AUTONOMY POLICY · GUARDIAN · REPUTATION · VALIDATION · BONDS · MARKET · LEASES · OMNICHAIN · PAID COMMS` — **badges only; none of those modules has UI here**), **IDENTITY** (model, brain root, epoch, seal, manifest URI, transfer lock), **CONTROL** (ACTIVATE ACCOUNT → `deployAccount`; AWAKEN/PAUSE/RETIRE → `setStatus(id,1|2|4)`; SET GUARDIAN; ALLOW/REVOKE operator), **ADVANCED** ("Simulate any ANIMA function": a function-signature input defaulting to `setStatus(uint256,uint8)` and JSON args `[id,1]`, parsed with `parseAbiItem`, simulated, then sent).
- Footer "ERC-4804 ONCHAIN INTERFACE" with explorer link; `#toast`.

### 4.4 The embedded client (`_script`, `:126-137`)

- `import{createPublicClient,createWalletClient,custom,http,parseAbi,parseAbiItem,encodeFunctionData,formatEther}from"https://esm.sh/viem@2.55.19"` (`:128`). **This is the single largest deviation from "everything on chain": the page is inert without esm.sh.**
- RPC map `{11155111:"https://ethereum-sepolia-rpc.publicnode.com", 84532:"https://sepolia.base.org"}` and explorer map (`:129`) — hard-coded; any other chain yields `rpc === undefined` and the page silently fails to read.
- 14-entry ABI (`:130`): `ownerOf, accountOf, statusOf, getStateFingerprint, modelOf, brainRoot, brainEpoch, sealPolicyOf, tokenURI, locked, deployAccount, setStatus, setGuardian, setOperator`.
- `refresh()` (`:131`) reads ten views with per-call `.catch(()=>null)` and paints `UNAVAILABLE/UNDECLARED/EMPTY/UNSET`. **Bug:** seal labels are `["NONE","SEALED TEE","ZK RE-ENCRYPTED"]` — three entries for a six-value enum, so `Committed` displays as "SEALED TEE" and `ReKeyed` as "ZK RE-ENCRYPTED" (compare `IAnima.sol:27-35`).
- `connect()` (`:133`): `eth_requestAccounts`, `switchChain` or `wallet_addEthereumChain`; button shows the short address.
- `send(fn,args)` (`:134`): connect → simulate (`account:user`) → write → wait receipt → refresh; errors toasted via `shortMessage`.
- Raw console (`:135`): `parseAbiItem("function "+signature)`, `JSON.parse(args)`, simulate, send, prints block number and tx link.

### 4.5 Sizes and measured numbers

- Runtime bytecode **22,592 bytes** (initcode 22,757) from `artifacts/contracts/web/AnimaWeb3Renderer.sol/AnimaWeb3Renderer.json` — **1,984 bytes under EIP-170**. Almost all of it is string data: `_style` 5,843 bytes, `_script` 5,483 bytes, `_token` markup 4,291 bytes, `_head` 169, `_index` 233, `_notFound` 138 (16,157 literal bytes total; a token page ≈ 15.8 KB before the dynamic addresses). There is no room to add module UIs (swap/launchpad/vault/messaging) inside this one contract; a multi-contract or SSTORE2-shard design is mandatory.
- Deployed on Base Sepolia at `0x9160bE4d943516a2463Ac5f3ABAc5F5cce7975Cd` against ANIMA `0xb3d92c76…` (`deployments/84532-0xc591….json contracts.web3Renderer`), with two superseded renderers kept in `web3RendererHistory`: `0xbD714258d540F1b720466e95724b9a00d05C3A29`, `0x1E07De2923542769Cc72a43a024d7c5AABDf5bC8` (three iterations in one day, 2026-09-16: `2d74176` static view → `9cb1ebb` link to Sanctuary → `20bfda6` full console).
- Chain-name support: 84532 and 11155111 only.

### 4.6 Tests (`test/Web3Renderer.test.ts`, 2 tests)

`page()` helper sends `eth_call` with `data: toHex(path)` and decodes `string` (`:6-10`) — a faithful emulation of a manual-mode gateway. Test 1 asserts `resolveMode()=="manual"`, that `/token/<id>/live` contains `<!doctype html>`, "Not merely owned", all four `data-panel`s, `ACTIVATE ACCOUNT`, `SIMULATE &amp; EXECUTE`, `createWalletClient`, `simulateContract`, **no `github.io`**, and the lower-cased owner and `accountOf` addresses (`:13-33`). Test 2 asserts `/` mentions `/token/{id}/live`, and both `/token/999/live` and `/bad/path` return "Agent not found" without reverting (`:35-42`). Nothing tests the JS (it never executes in tests), the esm.sh dependency, or the seal labels.

### 4.7 Deployment tooling

- `scripts/deploy-web3-renderer.ts`: loads `deployments/<chainId>.json` (or `ANIMA_DEPLOYMENT`), checks chain and that ANIMA has code (`:22-28`); reuses `contracts.web3Renderer` if it has code unless `ANIMA_REDEPLOY_RENDERER=true`, pushing the old address into `web3RendererHistory` (`:30-47`); prints `https://<renderer>.<sep|basesep>.w3link.io/token/<n>/live` for every minted token (`:49-57`); writes `GITHUB_OUTPUT`/`GITHUB_STEP_SUMMARY` (`:59-70`).
- `.github/workflows/deploy-web3-renderer.yml`: `workflow_dispatch`, environment `base-sepolia`, requires secret `DEPLOYER_PRIVATE_KEY`, runs the script with `--network baseSepolia`, and commits `deployments/84532.json` as `github-actions[bot]` if it changed (`:29-48`). Note it targets `deployments/84532.json` (the `0x0aeb…` record) while the renderer that is actually recorded lives in the `84532-0xc591…` file — the workflow would deploy a renderer for the *historical* collection unless `ANIMA_DEPLOYMENT` is set.
- `docs/DEPLOYMENT.md:128-152` describes it as "an immutable, trustless, self-rendering agent console… It does not redirect owners to GitHub Pages."

---

## 5. `cli/anima.mjs` — the ENS binding terminal

### 5.1 Public API (exported, unit-tested)

```js
export function encodeContenthash(uri)        // :70-81
export function assertMainnetEnsCustody(chainId) // :83-87
```
`encodeContenthash`: accepts a pre-encoded `0x…` (must be even-length hex) or `ipfs://<CIDv1 base32 starting with 'b'>[/path]`; base32-decodes (`:50-67`), requires `bytes[0]===1` (CIDv1), returns `0xe301 + cidHex` (comment `:69`: "ENS contenthash is varint(ipfs-ns = 0xe3) followed by the CID bytes."). Rejects CIDv0 (`Qm…`), `https://`, malformed hex. `assertMainnetEnsCustody` throws unless `chainId === 1`.

### 5.2 The `/bind` wizard (`:98-166`)

Constants: ENS Registry `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`, BaseRegistrar `0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85`, NameWrapper `0xD4416b13d2b3a9aBae7AcD5A6bF1c4945aE05Dd6` (`:12-14`). ABIs via `parseAbi` for registry (`resolver`, `owner`), resolver (`multicall`, `setAddr`, `setText`, `setContenthash`), ANIMA (`ownerOf`, `accountOf`, `isController`), ERC-721 registrar (`ownerOf`, `reclaim`, `safeTransferFrom`), wrapper (`balanceOf`, `safeTransferFrom` 1155).

Flow:
1. Prompts: agent-chain RPC (`ANIMA_RPC_URL`), ENS RPC (`ENS_RPC_URL`), contract (`ANIMA_CONTRACT`), token id, `.eth` name (`normalize`d, must end `.eth`, no empty labels), optional GUI content URI, optional `https://` fallback. Key only from `ANIMA_PRIVATE_KEY` ("the terminal will not echo or save keys", `:110-111`).
2. Checks ENS RPC is chain 1 (`:117-118`); reads home `chainId`, `ownerOf`, `accountOf`, `isController(id, signer)` in parallel; **refuses unless controller** (`:119-125`).
3. Reads resolver and registry owner for `namehash(name)`; refuses if no resolver (`:126-131`).
4. Prints a review block and the identity string **`eip155:<chainId>:<contract>:<id>`** (`:132-133`).
5. One atomic resolver `multicall` (`:136-143`): `setAddr(node, agentAccount)`, `setText(node,"com.anima.agent",identity)`, `setText(node,"com.anima.account",agentAccount)`, optional `setText(node,"url",https)`, optional `setContenthash(node, encodeContenthash(uri))`. Each tx is simulated, submitted, receipt-checked (`send`, `:89-96`).
6. Optional custody for second-level names (`:145-164`): `assertMainnetEnsCustody(homeChainId)`; signer must be the NFT **owner** (not merely controller); user must retype the name; wrapped names → NameWrapper `safeTransferFrom(signer, agentAccount, uint256(node), 1, "")`; unwrapped → BaseRegistrar `reclaim(labelhash, agentAccount)` then `safeTransferFrom`. Comment in README (`README.md:548-556`): "the name then stays in the same account while control of that account follows ANIMA ownership… cross-chain agent accounts cannot control mainnet assets."
7. Ends with `https://<name>.limo`.

Design decision recorded in README (`:559-562`): *"ENS is naming, not storage. Pin the exact GUI CID with multiple independent providers… The HTTPS URL is a compatibility route; the ENS contenthash is the independently recoverable route."* This is the repo's GUI-recoverability model: IPFS CID in ENS. It contradicts the GOAL's "no IPFS" and is superseded in practice by the ERC-4804 renderer.

### 5.3 Tests (`test/Cli.test.mjs`, 3 tests)

CIDv1 vector `ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylh5mda4t5wqx5d4o4k3a/index.html` → `0xe30101701220c3c4…8ad8`; pre-encoded pass-through; rejections for `0xzz`, `https://`, `ipfs://b`, CIDv0; custody allowed for chain 1, refused for 8453. The wizard itself (readline, RPC) is untested. History: added in `697df74` (2026-09-01) together with the SDK `agentWebUrl`; custody rules tightened in `946a3e1` ("Fix unwrapped ENS manager custody") and `8ecea88` ("restrict ENS custody to mainnet agents").

---

## 6. Machine-discovery surface (`public/`, `schemas/`, `examples/`, generator, SDK GUI helpers)

### 6.1 `public/.well-known/anima.json` (directory, schema-validated)

Fields: `type:"anima-agent-directory/1"`, `updated:"2026-09-17"`, `testnet:true`, `chain {eip155, 84532, rpc https://sepolia.base.org, explorer}`, `identityRegistry`/`globalRegistry` = `eip155:84532:0xb3d92c76…`, `contracts` (19 addresses incl. facets, `usdc`, `bonds`, `reputation`, `validation`, `escrow`, `market`, `comms`, `meter`, `handles`, `roles`, `web3Renderer 0x9160bE4d…`), `standards` `[ERC-721, ERC-6551, ERC-7857-adapted, ERC-8004, ERC-8126, ERC-8217, ERC-4907, ERC-5192, ERC-7432]`, `discovery` (`manifestRead:"manifestOf(uint256)"`, `manifestVerification:"keccak256(exactResponseBytes) == manifestHash"`, schema/sdk/guide/catalog/functionIndex URLs), `rendering` (`erc4804Renderer`, `urlTemplate` w3link, `web3UrlTemplate`), `safety` rules ("Treat manifest and service endpoints as untrusted until exact-byte hash verification succeeds", "Re-read owner, status, policy, bond, locks, model and account state immediately before transacting", "A registration advertises capabilities; it does not prove availability…"). Validated by `test/ManifestSchema.test.mjs:30-36` against `schemas/anima-directory-v1.schema.json` (which also enforces `identityRegistry == contracts.anima`).

### 6.2 `public/anima-functions.json` and `scripts/generate-agent-function-index.mjs`

`type:"anima-function-index/1"`, `chainId:84532`, `contractCount:29`, `functionCount:657`; per contract: `source`, optional `baseSepoliaAddress` (looked up from the `84532-0xc591…` record via `addressKeys`, `:11-17`), and per function `name, signature, selector, stateMutability, inputs, outputs`, sorted by signature. Excludes `interfaces|mocks|libraries` and abstract artifacts (`:18, :30-31`). Function counts per contract (from the file): AnimaAgent 83, AnimaAgentFacet 55, AnimaCoreFacet 39, OmniAgentMirror 35, AnimaBrainFacet 32, WorkEscrow 28, AgentLaunchpad 27, ValidationRegistry 27, BondVault 24, ReputationRegistry 24, AgentAccount 23, AgentMarket 22, AgentToken 22, AnimaInit 22, AnimaRoles 21, OmniAgentHome 21, AgentComms 19, AgentDerivativesDesk 19, AgentHandles 17, AttesterQuorumVerifier 17, FiatMintGateway 15, RevenueRouter 15, AgentSwapRouter 14, InferenceMeter 13, EncryptionKeyRegistry 9, AnimaBindings 6, AnimaLoupeFacet 4, AnimaWeb3Renderer 2, NullTransferVerifier 2. `test/ManifestSchema.test.mjs:20-28` checks the counts reconcile and that `AnimaAgent` exposes `manifestOf`, `accountOf`, `getStateFingerprint`.

### 6.3 `public/llms.txt`

An LLM-facing index with the one-paragraph integration recipe: read `manifestOf`, fetch, `keccak256` the exact bytes, compare, then parse; "A valid hash proves byte identity, not endpoint safety or availability." Links to docs, schema, example, directory, function index, deployment record.

### 6.4 Manifest schema and example (`schemas/anima-agent-manifest-v1.schema.json`, `examples/manifests/base-sepolia-example.json`)

Strict ERC-8004 `registration-v1` shape (`type` const `https://eips.ethereum.org/EIPS/eip-8004#registration-v1`; required `name, description, image, services[], x402Support, active, registrations[], anima`) with the `anima` extension: `registry` (`eip155:<id>:<addr>`), `agentId` (decimal string, no leading zeros), `mcp[]` (`streamable-http|stdio|sse`), `pricing`, `model`, **`gui {canonical: https URL, contentUri, entrypoint, version, modules[]}`** (`:171-206`), `mesh`, `handles[]`, `markets[]`. The example's `gui` (`:25-31`) points `canonical` at the w3link gateway URL for token 2, `contentUri` at `web3://0x9160bE4d…:84532/token/2/live`, `entrypoint:"/token/2/live"`, `modules:["overview","identity","control","advanced"]` — i.e. the manifest advertises the on-chain renderer as the agent's GUI. Tests (`ManifestSchema.test.mjs:13-18, 38-44`) validate the example and reject unknown fields and `agentId:"02"`.

### 6.5 SDK GUI helpers (`sdk/src/index.ts:179-204`)

`interface AgentGui { canonical; contentUri /* "Immutable GUI bundle, normally an ipfs:// or ar:// URI" */; entrypoint; version; modules? /* "Optional declarative console modules; never executable manifest code." */ }` and `agentWebUrl(origin, chainId, contract, agentId)` which produces `https://<origin>/<chainId>/<lowercase contract>/<id>` and rejects non-https origins, credentials/query/fragment, `chainId<=0`, non-integer ids (`test/Sdk.test.ts:32-41`). Design note from `docs/AGENT_ECOSYSTEM_RESEARCH_2026-09-17.md:76-78`: "The right next implementation is an optional ERC-7656-style module service with immutable package hashes, declared permissions, bounded recovery and explicit transaction review — not loading arbitrary manifest JavaScript into the agent wallet." ERC-5169 (token scripts) was *rejected* as primary discovery because "mutable executable pointers widen supply-chain risk" (`:32`).

---

## 7. Operational scripts touching the UI's chain state

- **`scripts/testnet-batch-mint.ts`**: `ANIMA_MINT_COUNT` 1–100 (default 10), six testnets, proxy-aware `undici` dispatcher; refuses unless `record.deployer == signer` (`:82`, the "operators only" rule the README cites); checkpoints `tokenIds`/`transactions` in `record.batchMint` after every receipt so reruns resume (`:86-96, :128`); mints with `agentURI ipfs://anima/testnet-batch/<chain>/<n>.json`, `manifestHash keccak("anima-testnet-manifest:<chain>:<n>")`, `attestationKind 0`, no shards, `SealPolicy.None`; then **waits until the RPC's head reaches the last receipt block** (`:132-140`, comment: "Public RPC URLs commonly sit in front of nodes at different heights…") and re-reads every `ownerOf` with 40 retries. Recorded result on Base Sepolia (0xc591 record): 3 tokens `30,31,32` to `0xb88Fbf05…`; on Sepolia: 10 tokens `14..23` to the deployer.
- **`scripts/testnet-batch-exercise.ts`**: assigns each of the ten Sepolia agents a lifecycle concern (URI/metadata/model/manifest/brain; account+policy+operator+guardian+guardian-pause; ERC-4907 lease; approve+transfer; both `safeTransferFrom` overloads; approvalForAll + `setApprovalForAllUntil` + `revokeAllApprovals`; EIP-712 `AgentWalletBinding` (`domain AnimaAgent/1`, types `agentId,wallet,nonce,deadline`, `:143-152`); royalty; activate/pause/retire; sale-reset composition) and then audits 13 reads in one `Promise.all` (`:164-181`). Recorded: `batchExercise.completed:true` at `2026-09-15T20:53:03Z`, 32 evidence transactions, 8 assertion groups.
- **`scripts/deploy-web3-renderer.ts`**: §4.7.

---

## 8. Workflows and hosting

- `pages.yml` (`:31-41`): `npm ci && npm run ui:build` → `actions/upload-pages-artifact` from `dist` → `deploy-pages`; concurrency group `pages`. README `:483-507` gives click-by-click instructions for enabling Pages ("Source → GitHub Actions"). This is the production delivery of the Sanctuary — a centralised static host.
- `deploy-web3-renderer.yml`: §4.7.
- `ci.yml`: `npm run audit:prod` (`npm audit --omit=dev --audit-level=high`), `npx hardhat build`, `npx hardhat test` on every push/PR. Does **not** run `test:cli`, `test:manifest-schema`, `test:diamond`, or any UI build.

---

## 9. Other branches touching this area (surveyed)

- `origin/codex/find-access-method-for-nft-gui` (+30/−10 in `src/main.js`, unmerged): sequential `readOwner` with retry, `waitForSuccessfulTransaction` (checks `receipt.status` and replacement reason), an explicit "Ownership could not be verified… Retry discovery" state, and an XSS-safe `showShowcaseBeing`. Worth folding in conceptually.
- `origin/codex/design-beautiful-nft-user-interface` (`facf63b`), `origin/rebuild/human-interface-20260904`, `origin/codex/find-how-to-access-minted-nft-gui`: tips equal their merge-bases; no unmerged content.
- `origin/build/idfbi-isolated-toolchain-20260904`: adds only a CI workflow.
- `origin/claude/nft-standard-ai-agents-2y8ngz`: adds `test/Swarm.test.ts` (agent economy); not UI.
- `origin/fix/utility-workflows-20260904`: a superset of the commons branch (36 files) — same UI content.

---

## 10. Unmerged: `upgrade/sanctuary-commons-3d-20260904` — Sanctuary Commons (social layer + 3D client)

Branched from `35a725e` (2026-09-04), 28 files, +2,086/−178. It replaces `src/main.js` with `import './commons/app.js'`, moves the old console to `console.html` → `src/legacy.js` (fictional bond/trust relabelled, `ANIMA` reverted to `0x0aeb…`), and adds a new contract. Everything is local-only: "The new Commons contract is tested locally, **not deployed publicly**" (branch README). This is the only messaging/social work in the repo and it maps directly onto the GOAL's "messaging / crypto-social layer".

### 10.1 `contracts/comms/AnimaCommons.sol` (314 lines, 12,941 runtime bytes)

Header comment (verbatim): *"Additive social layer. Does not custody funds, grant account permissions, modify the token, or replace AgentComms' paid/private transport. All text, membership and moderation are PUBLIC. Tombstones hide text in conforming clients; they cannot erase storage or transaction history. A wallet is the social principal. An optional agent badge is authenticated at publication and pinned to a state fingerprint; buying a token does not buy its previous operator's human profile, circle role, or correspondence."*

Storage (`:23-70`): `MAX_BODY_BYTES = 1024`, `MAX_PAGE = 50`, immutables `ANIMA`, `WORK`; `nextCircleId=1`, `nextPostId=1`; `_circles[id] → Circle{steward,pendingSteward,name,purpose,rules,rulesHash,slowMode,members,inviteOnly,archived}`; `_posts[id] → Post{circleId,parentId,agentId,author,agentOwnerAtPublication,agentState,createdAt,revision,kind,hidden,withdrawn,body}`; `_postIds[circle][]`; mappings `isMember, isInvited, isModerator, isBanned, lastPublication[circle][addr], acceptedReply[q]→reply, linkedJob[post]→job, reactionOf[post][addr]→uint8, reactionCount[post][reaction], historyRoot[circle]`.

Events (`:72-86`): `CircleCreated, MemberChanged, InvitationChanged, ModeratorChanged, BanChanged, StewardProposed, StewardChanged, CircleConfigured, PostPublished(postId,circleId,author,parentId,agentId,agentState,kind,body), PostRevised, PostVisibility, ReactionChanged, ReplyAccepted, JobLinked, HistoryAdvanced(circleId, root)`. Errors (`:88-98`): `UnknownCircle, UnknownPost, Unauthorized, BadInput, NotMember, InvitationRequired, CircleUnavailable, SlowMode(uint256 availableAt), StateChanged, InvalidThread, InvalidJob`.

API: `circleOf, postOf, postCount, postsPage(circle,cursor,limit≤50) → (ids,nextCursor)`; `createCircle(name≤64B, purpose≤256B, rules 1..2048B, inviteOnly, slowMode≤1 day)`; `configureCircle` (steward); `invite` (moderator); `join` (consumes invitation, increments members); `leave` (clears moderator and pending-steward); `setModerator` (steward, member only); `ban` (moderator; cannot ban steward or, unless steward, another moderator; clears invite/mod/membership); `proposeSteward`/`acceptSteward` (two-step); **`publish(circleId,parentId,agentId,expectedAgentState,kind,body)`** (`:210-235`): member, body bounds, parent must be visible and in-circle, slow-mode, and if `agentId != 0` requires `ANIMA.isController(agentId,msg.sender)` **and** `getStateFingerprint(agentId) == expectedAgentState != 0`, recording `ownerOf` at publication; `revise` (author only, not withdrawn/hidden/job-linked, re-checks controller + fingerprint, slow-mode); `withdraw` (author, always); `moderate(id,hidden,reason≠0)` (moderator); `react(id, 0..3)` (replacement semantics); `acceptReply` (question author, direct visible reply); **`attachJob(postId, jobId)`** (`:281-290`): author must be the WorkEscrow `client`, job must exist, `specHash == keccak256(post.body)` — comment: *"A clickable work card is evidence-linked, not a self-asserted 'paid' badge."* `_advance` (`:309-313`) chains `historyRoot = keccak256(abi.encode(keccak256("anima.commons.history.v1"), chainid, this, circleId, prevRoot, leaf))` for publish/revise/withdraw/moderate.

Tests: `test/Commons.test.ts` — 29 sentence-named cases ("NFT transfer does not transfer human posts, circle roles, or moderation", "A to B to A does not revive a stale agent-authored draft", "hiding content is a tombstone, not a false deletion claim", "hash-chain publication commits to chain, module, circle, author and bytes", "job link requires an actual client-matching, exact-body WorkEscrow record", "checks bytes rather than characters" with 256×🪴). Branch verification doc: 322 pass on monolith and 322 on diamond (baseline 273), 37 Chromium checks, AnimaCommons 12,941 bytes.

### 10.2 The client (`src/commons/*`)

- `abi.js` (6,356 B): generated by `scripts/commons-check.mjs` from artifacts; CI asserts `git diff --exit-code -- src/commons/abi.js` and that every ABI's contract is ≤ 24,576 bytes.
- `bridge.js` (10,159 B): `HISTORICAL` config (`chainId 84532`, ANIMA `0x0aeb…`, WorkEscrow `0xFBA8…`, commons `''`); `validateConfig` allows only chains 84532/31337, https or loopback http, no credentials; `configure()` verifies chain id, bytecode at every address, `WorkEscrow.ANIMA()==anima`, `Commons.ANIMA()/WORK()` bindings (`:16-26`); `requireWrite()` demands verified config + explicit wallet + matching chain (`:37`); reads are **block-pinned** (`getBlockNumber({cacheTime:0})` then `readContract({blockNumber})`) and bounded (20 circles/posts per page, newest first, `:38-58`); `agent(id)` reads owner/account/status/locked/brainRoot/fingerprint/policy/model/manifest plus `BondVault.availableCoverage` and `ReputationRegistry.attestedSummaryOf` (`:59-66`); `prepare()` simulates and captures an epoch snapshot; `commit()` re-checks `eth_accounts`/`eth_chainId`, **re-simulates immediately before sending**, and rejects if the epoch moved (`:69-82`). Comment: "The browser pass found a real cache issue: a freshly confirmed publication could be followed by a cached older head read. Client/block-number caching is now disabled for these snapshots."
- `model.js` (7,253 B): pure presentation model; versioned `restoreState` that filters localStorage defensively; `byteLength`, `validateBody` (1,024 UTF-8 bytes), `escapeHTML`, `safeHttp` (https only, no credentials), `parseTokenId` (regex + BigInt, never floats), `visiblePosts`, `catchUp` (≤5 items), `workBrief` (decimal strings, future deadline, 1–720h review).
- `scene.js` (14,293 B): dependency-free WebGL scene with a CPU painter fallback; procedural geometry for six "stations" (home, circles, work, agents, tools, saved); `makeGeometry()` asserts >10,000 floats, unit normals.
- `app.js` (50,517 B): the six-section SPA ("Sanctuary", "Circles", "Work atelier", "Observatory", "Tool garden", "Your library"), local-rehearsal mode vs live mode, review-then-confirm dialog listing chain id, signer, contract, native value and calldata, moderation/report export, settings with network form.
- `style.css` (18,723 B): no external fonts (the branch removed the Google Fonts link from `index.html`).
- `scripts/commons-local.ts`: loopback JSON-RPC proxy (port 18745, method allowlist) over Hardhat's in-process EVM, seeds a circle with 22 posts; `scripts/commons-preview.mjs`: esbuild single-file build → `dist/ANIMA_Sanctuary_3D.html` ≈ 443 KB; `scripts/commons-browser-check.py`: Playwright runner with EIP-1193 shim executing real transactions.

The branch's own `DEPLOYMENT.md` is candid: "Website HTML, CSS and JavaScript… **not deployed on-chain by this release**… The approximately 443 KB standalone output is input to such a pipeline, not evidence that it has already happened."

---

## 11. Access-control matrix (who can do what, and where it is enforced)

| Action | Sanctuary (`src/main.js`) | On-chain console (renderer) | CLI | Commons branch |
|---|---|---|---|---|
| View agent state | anyone (inspect by id) | anyone | n/a | anyone (read mode needs explicit RPC config) |
| List "my" agents | `ownerOf` scan vs connected address | not offered (one token per URL) | n/a | not offered |
| `setStatus`/`deployAccount` | owner/controller, enforced by contract via simulate | same | n/a | n/a |
| `setGuardian`/`setOperator` | not offered | offered | n/a | n/a |
| Arbitrary function | not offered | offered (ADVANCED) | n/a | n/a |
| Mint | anyone (permissionless `mintAgent`) | not offered | n/a | not offered |
| ENS records/custody | n/a | n/a | `isController`; custody needs `ownerOf` + chain 1 | n/a |
| Post as agent | n/a | n/a | n/a | `isController` + fingerprint pin |

There is **no SIWE/EIP-4361 session, no signature challenge, no server**, anywhere. All authorisation is on-chain and surfaced to the user through `simulateContract` before signing. That is correct for a serverless design and should be preserved.

---

## 12. Measured numbers (all from files in this checkout)

- `src/main.js` 26,881 B; `src/style.css` 17,569 B; `index.html` 1,955 B; `cli/anima.mjs` 10,855 B; `public/anima-functions.json` 451,868 B (29 contracts, 657 functions); schema 8,108 B.
- `AnimaWeb3Renderer` runtime 22,592 B / initcode 22,757 B (artifact); literal HTML/CSS/JS 16,157 B (`_style` 5,843, `_script` 5,483, `_token` 4,291); token page ≈ 15.8 KB. `AnimaAgent` 23,971 B (605 under EIP-170). `AgentComms` 7,368 B.
- Base Sepolia (Sanctuary target) ANIMA `0xb3d92c766e3cb356db381feb21958a9ebb974365`, deployer `0xc591C669162cD4da8aB9BfA2c2e68d538A312C00`, renderer `0x9160bE4d943516a2463Ac5f3ABAc5F5cce7975Cd` (history `0xbD714258…`, `0x1E07De29…`), batch tokens 30–32, `townRun` 130 successful tx / 48 expected reverts with 12 resident agents (ids 18–29), `extended` run includes launchpad `0x5ed9230C…`, swapRouter `0x6DF96605…`, derivatives `0x1177cFBe…`, bindings `0x4e044685…`.
- Base Sepolia historical ANIMA `0x0aeb6f783ebade8fd5ffca74317266d4ea3e71b3` (deployer `0xb76d6333…`, key destroyed; README "Live on Base Sepolia"; deploy cost 0.00628 ETH).
- Sepolia ANIMA `0xbbd203d76eb2a2e493f458dff74b10c6659d12a3`, batch tokens 14–23, `batchExercise` 32 tx completed 2026-09-15.
- Tests in area: Web3Renderer 2, Cli 3, ManifestSchema 4, Sdk `agentWebUrl` 1. Repo-wide counts drift: README says 279 per mode; CLAUDE.md says 268; commit `697df74` said 235; commons branch measured 322 (incl. 29 Commons + 19 model).
- Commons branch: AnimaCommons 12,941 B; standalone HTML ≈ 443 KB; 37 Chromium checks; Node 22.16.0, Vite 7.3.6, viem 2.55.19, OZ 5.6.1.
- ENS: registry `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`, BaseRegistrar `0x57f1887a…`, NameWrapper `0xD4416b13…`; contenthash prefix `0xe301`.

---

## 13. Known weaknesses, bugs and TODOs

1. **Website not on chain.** The Sanctuary is a GitHub Pages bundle with Google Fonts; `external_url` in minted metadata points at it (`src/main.js:153`).
2. **Renderer depends on `https://esm.sh/viem@2.55.19`** (`AnimaWeb3Renderer.sol:128`) — a CDN supply-chain and availability dependency inside an "immutable, trustless" page. Must be replaced by an on-chain (SSTORE2) copy of a minimal ABI coder/RPC client or hand-rolled encoding.
3. **Renderer seal labels wrong** (3 labels for 6 enum values, `:131`).
4. **Renderer hard-codes RPC/explorer for two chains** (`:129`); other chains render but cannot read.
5. **Renderer has no module UI** — chips only; 1,984 bytes of headroom; cannot host swap/launchpad/vault/messaging panels.
6. **`manifestHash` committed by the Sanctuary mint is `keccak256(uriString)`**, not of the served bytes (`src/main.js:181`), so `verifyManifest` fails for Sanctuary-minted tokens.
7. **Ownership discovery is O(totalMinted) concurrent `ownerOf` calls** with silent per-id failure (`:178`); no `isController`/role/lease awareness.
8. **`waitForTransactionReceipt` without `status` check** in both `transact` and `mintAgent` (`:180-181`); a reverted mint would be reported as success until `parseEventLogs` finds no `Transfer`.
9. **Address/doc drift**: `src/main.js` targets `0xb3d9…`; README step 5, CLAUDE.md, `deployments/84532.json` and the commons branch's `HISTORICAL` describe `0x0aeb…`; `deploy-web3-renderer.yml` defaults to `deployments/84532.json`.
10. **No UI tests on `main`**; CI does not run `test:cli`, `test:manifest-schema` or the Vite build.
11. **Fictional marketing data** on the landing page (bond/trust/"231 proofs").
12. **CLI** pins the GUI via IPFS CID in ENS contenthash (contradicts "no IPFS"), only supports `.eth`, and requires mainnet for custody; untested interactive path.
13. **Commons contract** is unaudited, undeployed, public-only (no encryption, by design), Sybil-exposed reactions, and relies on EOA/account addresses as social principals ("when the social principal is itself a transferable token-bound account, control of that address can follow its owning token" — branch ARCHITECTURE §3).
14. `_tokenPath` has no overflow guard on the decimal parse (`:58-62`).

---

## 14. Reuse verdicts relative to the GOAL

**GOAL recap**: one ERC-721; swap + messaging/social + launchpad + vault *inside* the NFT; the token mints a website served from chain; the visitor connects a wallet, is verified as holder (or holder-authorised), then uses everything; no server, no IPFS.

- **`AnimaWeb3Renderer.sol` — ADAPT (keeper).** Correct architecture: stateless, ownerless, separate from the token, ERC-4804 manual mode, configuration read from `data-*` attributes so one bytecode serves any chain, simulate-before-sign client. Changes required: remove esm.sh (embed a minimal coder or load it from SSTORE2 shards referenced by address), fix seal labels, pass RPC/explorer from chain id via an on-chain table or let the wallet provider be the transport (`custom(window.ethereum)` for reads too), split into a router + per-module page contracts (overview/identity/control/**swap/launchpad/vault/messaging**) because 22.6 KB of 24.5 KB is already used, add a holder/controller gate in the client (`isController(id, user)` and ERC-7432 roles) that hides write panels for non-holders while the contract remains the enforcement point, and consider ERC-5219 `request()` routing like IPSEITY's `Premises` for multi-page sites.
- **`src/main.js` wallet/mint/console flows — ADAPT the flows, REWRITE the page.** Keep: `wallet_addEthereumChain` fallback, `wallet_watchAsset` after mint, token-id-from-`Transfer`-log, the "simulate → confirm → wait → reload" pattern, the self-contained `data:` metadata idea (but generate it **in the contract**, not in the browser, and hash manifests over served bytes). Drop: the landing page, fictional data, O(n) ownership scan (replace with ERC-721 `balanceOf` + an on-chain enumerator or per-token URLs), Google Fonts, GitHub Pages.
- **`src/style.css` — DROP** (CDN fonts, marketing layout); borrow the dark editorial tokens if desired.
- **`cli/anima.mjs` — REUSE `encodeContenthash`/`assertMainnetEnsCustody` verbatim; ADAPT the wizard** to write an ERC-4804 `web3://` reference (ENS contenthash supports it via the `0xe3`/`0xe4`-style codecs or a `text` record) instead of an IPFS CID, and to accept `isController`-based authority for records while keeping owner-only custody.
- **`public/.well-known/anima.json`, `llms.txt`, `anima-functions.json` + generator, schemas, example manifest — ADAPT.** The exact-bytes manifest commitment and the strict schema with a `gui` block are good patterns; regenerate for the merged protocol and consider serving `.well-known` from the renderer's `/` route instead of a static host.
- **`scripts/deploy-web3-renderer.ts` + workflow — ADAPT** (keep the history array and "wait for code / ids from logs / block-lag" defences); point at the right deployment record by default.
- **`scripts/testnet-batch-*.ts` — ADAPT** as the template for checkpointed live rehearsals.
- **`pages.yml`, `index.html`, `vite.config.js`, `robots.txt`, `sitemap.xml` — DROP** for the primary surface (a static mirror can remain as a convenience, built from the same on-chain HTML).
- **`AnimaCommons.sol` (branch) — ADAPT** as the social layer's contract: circles/posts/moderation/slow-mode/history-root/evidence-linked work are exactly the public social primitives the GOAL asks for, already tested against both token builds. Add: holder-gated circles keyed on the unified NFT, per-token "home circle" creation at mint, event-log back-links in the IPSEITY `Parley` style for indexer-free history, and a separate encrypted DM path (the branch deliberately refused to fake one). Keep the fingerprint-pinned agent badge and the "sale does not transfer social office" invariant.
- **`src/commons/bridge.js` + `model.js` — ADAPT** (block-pinned bounded reads, epoch-guarded review/re-simulate/commit, byte-length validation, defensive storage restore); **`scene.js`/`app.js` — DROP or heavily trim** (50 KB SPA + 14 KB WebGL scene is too large and too opinionated for chain storage; the six-place IA and copy are worth keeping as a design reference).
- **Branch verification tooling (`commons-local.ts` loopback RPC with method allowlist, `commons-browser-check.py` with EIP-1193 shim, `commons-check.mjs` ABI-drift + EIP-170 gate) — ADAPT**; these are the only browser-level tests in the repo.

---

## 15. Pitfalls for the design team

- Two Base Sepolia deployments with different keys; the one the UI points at (`0xb3d9…`) is not the one the README/CLAUDE.md narrate (`0x0aeb…`, key destroyed). Verify addresses from `deployments/*.json`, never from prose.
- "On-chain console" today still needs a CDN (esm.sh) and a gateway (w3link) to be usable in a normal browser; `web3://` needs an ERC-4804-aware browser/extension.
- The renderer's `fallback` is non-view by necessity; gateways use `eth_call`, so never put state writes in it.
- `tokenURI` is a free-form string set by the controller; nothing on chain validates or generates metadata — the "Brave-ready" SVG is a client convention.
- Minting is permissionless on the token (`mintAgent(to,…)` from any EOA); the Sanctuary's "mint my testnet agent" relies on that. A unified protocol will need mint gating/pricing and must regenerate the function index afterwards.
- Hardhat 3 + viem toolbox; UI uses the same `viem@2.55.19` as the renderer's CDN import — pin the same version if embedding.
- `expectRevert` in tests matches 4-byte selectors because facet errors cannot be decoded through the diamond; any new renderer/commons tests should follow that helper.
- Public RPC lag bit this project repeatedly: wait for code before constructor inspection, take ids from logs, block until the endpoint reaches the receipt block (`testnet-batch-mint.ts:132-140`).
