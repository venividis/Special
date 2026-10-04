# IPSEITY (Most-Advanced-NFT-Possible) — the web3:// site, pages, desks and console

Repository: `/home/user/Most-Advanced-NFT-Possible` (default branch, HEAD `297e936`, 2026-09-24).
Area: `src/Premises.sol`, `src/Chrome.sol`, `src/Desk*.sol` (10 files), `src/Page*.sol` (20 files incl. `PageConsole.sol`), `src/ConsoleRead.sol`, `src/ConsoleSkin.sol`, `src/interfaces/Site.sol`, `engine/console.js`, `engine/console-lanes.js`, `engine/console.css`, `CONSOLE.md`, `INTERFACE.md`, `tools/site.mjs`, `tools/gateway.mjs`. Every file was read in full; supporting reads: `src/lib/Web.sol`, `src/lib/LibNum.sol`, `src/lib/Assets.sol`, `src/lib/Hook.sol` (API), `src/LaunchView.sol`, `src/Parley.sol` (`mayActAs`), `src/Ipseity.sol` (`onlyOwner`), `tools/verify-premises.mjs`, `tools/verify-console.mjs`, `tools/verify-site.mjs` (selected sections of 3,195 lines), `tools/gas.mjs`, `tools/redeploy-site.mjs`, `tools/preview-site.mjs`, `tools/site-viewer.mjs`, `tools/testnet-drive.mjs`, `README.md`, `INVARIANTS.md`, `DEPLOYMENTS.md`, `AGENT.md`, `deployments/*.json`, `out/solc.json`, `foundry.toml`, `package.json`, `.github/workflows/ci.yml`, and `git log`/`git diff` against unmerged branches.

Measurement provenance: "runtime bytes" below were read from `out/solc.json` (compiled in this checkout on 2026-10-02 18:22 UTC by solc 0.8.36, viaIR, optimizer 800 runs, cancun — the settings in `foundry.toml`). Gas figures are quoted from a past run of `tools/gas.mjs` as recorded in `README.md:973` and `tools/site-viewer.mjs:27-40`; nothing was built or run for this report. Assertion counts are quoted from the newest commit messages (`git log`) rather than from `README.md:1303-1308`, which is stale.

---

## 0. Executive answers

### 0.1 How is the web UI delivered?

Entirely from chain, in two distinct surfaces, with no server, no IPFS, no CDN and no fetch of any kind:

1. **The instrument** (outside this report's area, but the context): `Ipseity.tokenURI` returns a `data:` URI whose `animation_url` is a ~104 KB WebGL2 application stored as contract bytecode (`Engine.sol` shards). It carries its own keccak, ABI coder and wallet client.
2. **The site** (this report): `Premises.request(string[] resource, KeyValue[] params)` (`src/Premises.sol:251`) is an ERC-5219 HTTP handler written in Solidity. It returns `(uint16 statusCode, string body, KeyValue[] headers)`. Every page body is assembled by `string.concat` inside `view` functions of 20 page contracts, each an `immutable` constructor argument of `Premises` (`src/Premises.sol:158-226`). The browser JavaScript is shipped as Solidity `string internal constant`s inside the `Desk*.sol` contracts (e.g. `Desk.CORE_JS` at `src/Desk.sol:212`), or — for the console — as raw bytes in two SSTORE2 data contracts (`ConsoleSkin` instances holding `engine/console.css` and `console.js + console-lanes.js`, loaded and frozen by `tools/site.mjs:712-745`).

Reaching it: a `web3://` client (ERC-4804/ERC-6860) calls `resolveMode()` (`src/Premises.sol:244`, returns the exact word `"5219"`) and then `request()`; an ENS name reaches the contract through the ERC-6821 `contentcontract` TEXT record that `Nameplate` serves (`src/PageName.sol:150-169` explains; `tools/site.mjs:773-781` deploys it). An HTTP gateway is a pure convenience: `tools/gateway.mjs:120-130` maps every `GET /a/b` to one `eth_call` of `request(["a","b"], [])` and relays the status, `Content-Type` and `Cache-Control` the contract chose; `w3link.io` does the same publicly (`DEPLOYMENTS.md:18-20`). "Stop this process and nothing is lost, because nothing is here" (`tools/gateway.mjs:143-144`).

The artwork routes (`/`, `/token/<id>/raw|live|face/<n>|sigil.svg`) are answered by `Premises` itself from the hub and renderer and never pass through a page contract (`src/Premises.sol:274-283, 494-543`). This is the site's whole safety argument (§1.3).

### 0.2 How does it verify NFT ownership for access?

**Reading is never gated, anywhere.** Every page renders fully for an anonymous `eth_call` (the contract cannot know who is asking; `msg.sender` inside a page is the `Premises` address, which is why `CHROME.foot(msg.sender, block.chainid)` prints the router's own address). The gate is a courtesy that hides composers, not a lock — `src/Chrome.sol:224-228`: "The gate is a courtesy, not a secret: everything behind it is public data on a public chain. What ownership actually gates is writing, and that is gated by the contract."

**Client-side recognition** (what "connect your wallet and it verifies you have the NFT" means here):

- Wallet discovery: `Chrome.WALLET_JS` (`src/Chrome.sol:280-324`) collects every EIP-6963 announcer keyed by `rdns`, remembers the person's choice in `localStorage['ipse.wallet']`, and exposes `window.IPW`. `Desk.CORE_JS` (`src/Desk.sol:212-350`) builds `window.IP` on top: `connect()` calls `eth_requestAccounts`, then `onChain(p)` compares `eth_chainId` with the page's `D.chain` and throws on mismatch.
- Holding check: the client calls the hub's `balanceOf(address)` and then walks `tokenOfOwnerByIndex(address,i)` (cap 64) — `DeskTalk.TALK_JS` `held()` (`src/DeskTalk.sol:160-165`) and `DeskTerm.TERM_JS` `mine()` (`src/DeskTerm.sol:180-185`). The result is the `MINE` list; `become(id)` sets `ME` (remembered in `localStorage['ipse.me']`), toggles `body.held`, and `.gate{…} body.held .gate{display:none}` / `body:not(.held) .only{display:none}` (`src/Chrome.sol:229-231`) swap the connect card for the composer. The door page lists the held tokens with links to each token's console (`src/DeskTalk.sol:308-347`).
- Console: `PageConsole` server-renders `ownerOf(id)` into the crest and seed (`src/PageConsole.sol:175-197, 388-400`); `engine/console.js:180-201` rewrites HELD to "you" when `eth_accounts[0]` equals `C.owner`; `engine/console-lanes.js:203-213` `onlyHolder()` prints "You are reading somebody else's token. Nothing here will sign." and returns false, so holder-only controls are not painted for strangers (while the state above them still renders).
- The granted-key door `/k/<id>/<key>` checks `eth_requestAccounts[0] == key` before it will send `executeAsSession` (`src/PageKey.sol:212-262`).

**Server-side enforcement** (the only thing that actually holds): the contracts the pages build calldata for decide. The hub's `onlyOwner(id)` admits the ERC-721 owner or the token's own ERC-6551 Reach account and nobody else (`src/Ipseity.sol:291-299`); `Parley.mayActAs(token, who)` is the owner or the Reach — deliberately not the renter (`src/Parley.sol:168-173`); `Lease`, `Consign`, `Succession` take strict-owner doors; session keys are checked by the account's `sessionAllows` on every call. Pages render holder controls for everyone "and the contract will refuse them" (`src/PagePool.sol:74-83`, `src/PageServices.sol:128-131`, `src/PageRooms.sol:147-150`) — the stated rule is "controls are shown and refused by the chain, never hidden" (`INTERFACE.md:108-110`).

So: the NFT "verifies you" in the browser by enumerating your tokens through the collection itself (no list, no signature challenge, no session cookie), and on chain by every write's `msg.sender` check. There is no login, no SIWE, no server session.

---

## 1. Premises — the ERC-5219 router (`src/Premises.sol`, 683 lines)

### 1.1 Purpose
"The front door" — the one contract a `web3://` client or gateway talks to. Routes a path to a page contract, or answers the artwork routes itself. Header comment (lines 64-150) argues the design; the route table in it is normative.

### 1.2 Public API
```solidity
contract Premises {
  IHub public immutable HUB; IChrome public immutable CHROME;
  IPageDoor P_DOOR; IPageToken P_TOKEN; IPageMarket P_MARKET; IPagePool P_POOL;
  IPageServices P_SERVICES; IPageManifest P_MANIFEST; IPageTalk P_TALK; IPageRooms P_ROOMS;
  IPageTerminal P_TERMINAL; IPageSwap P_SWAP; IPageGallery P_GALLERY; IPageLaunch P_LAUNCH;
  IPageLock P_LOCK; IPageHook P_HOOK; IPageCast P_CAST; IPageSeal P_SEAL; IPageKeys P_KEYS;
  IPageName P_NAME; IPageEstate P_ESTATE; IConsole P_CONSOLE; IPageKey P_KEY;   // all public immutable, lines 158-180
  struct KeyValue { string key; string value; }
  struct Pages { door, token, market, pool, services, manifest, talk, rooms, terminal, swap, gallery, launch, lock, hook, cast, seal, keys, name, estate, console, keyDoor }  // lines 186-198
  constructor(IHub hub, IChrome chrome, Pages memory p);                         // line 202
  function resolveMode() external pure returns (bytes32);                        // line 244, returns "5219"
  function request(string[] memory resource, KeyValue[] memory params)
      external view returns (uint16 statusCode, string memory body, KeyValue[] memory headers); // line 251
}
```
Private helpers: `_toAddr` (42-char hex → address, `canon` flag for lower-case; line ~560), `_moved(to)` (301 + `Location`, `Cache-Control: public, max-age=86400`), `_notFound()` (404 HTML, path never echoed), `_headers(ct)` (`Content-Type` + `Cache-Control: public, max-age=15`, line 184), `_exists(id)` (staticcall `ownerOf`, non-zero), `_eq`, `_toUint` (1-10 decimal digits, no leading zero).

### 1.3 Storage, events, errors, access control
No storage beyond immutables; no events; **no custom errors** — a bad path is a 404 document, never a revert ("A 404 rather than a revert. A client asking for nonsense deserves an answer, and the path is never echoed back — the one thing on this page an attacker could have chosen is the one thing that would be rendered", lines 549-552). No state-changing function at all — asserted by `tools/verify-premises.mjs:197-203` ("there is no state-changing function at all", "nothing that could hold or move an asset") and the engine-bytes check ("it holds none of the artwork's bytes", lines 205-212).

### 1.4 Routes (normative table, lines 100-130; dispatch lines 269-543)
| path | handler | content-type |
|---|---|---|
| `/` | `Renderer.document(HUB.viewOf(tokenByIndex(0)))` — the live instrument; before the first mint `P_DOOR.door()` | html |
| `/door` | `P_DOOR.door()` | html |
| `/chat`, `/rooms`, `/room/<n>` (n≥1), `/dm/<id>` (id must exist) | `P_TALK.chat()`, `P_ROOMS.rooms()`, `P_ROOMS.room(n)`, `P_TALK.dm(id)` | html |
| `/terminal`, `/swap`, `/gallery[/<p>]`, `/launch`, `/lock`, `/projector`, `/seal`, `/keys`, `/name`, `/estate` | one page each | html |
| `/c`, `/c/<id>`, `/c/<id>/<verb>` | `P_CONSOLE.doc(FIRST_ID or id, verbOf(word))`; unknown verb → verb 0, not 404 (lines 396-418) | html |
| `/k/<id>/<key>` | `P_KEY.keyPage(id, key)`; mixed-case key → 301 to lower-case (lines 420-434) | html |
| `/hook[/<address>]` | `P_HOOK.hook(addr)`; mixed-case → 301 | html |
| `/open[/<p>]` | `P_MARKET.open(p)` | html |
| `/services.json[/<p>]` | `P_MANIFEST.index(p)` | json |
| `/token/<id>` | `P_TOKEN.token(id)` | html |
| `/token/<id>/raw` | `HUB.tokenURI(id)` | text/plain |
| `/token/<id>/live` | `Renderer.document(viewOf(id))` — same bytes `tokenURI` base64s, one step earlier | html |
| `/token/<id>/sigil.svg` | `Sigil.svg(id, word, seed, strata)` | image/svg+xml |
| `/token/<id>/face/<n>` | `HUB.tokenURIAt(id, n)` if `n < facetCount()` | text/plain |
| `/token/<id>/faces|market|pool|rent|vault|services.json` | PageToken/PageMarket/PagePool/PageServices/PageManifest | html / json |

### 1.5 Design decisions and why (quoted)
- **Never serve the artwork through a page**: "Premises never serves the artwork through a page contract. `/raw` and `/live` are handled here, in this file, from the hub and the renderer directly. Every other route delegates to a page contract, and every page contract is an immutable constructor argument. That split is the whole safety argument." (lines 78-84). And the honest limit: "a compromised front door controls pages that link to and frame the artwork, and cannot alter one byte of the artwork itself, because it does not hold those bytes" (lines 91-95).
- **`resolveMode` is load-bearing**: "Not optional, and its absence is silent. ERC-6860 resolves the mode by calling this and treating a revert as 'auto' — and in auto mode `web3://<addr>/` is an empty call to a contract with no fallback … Without these four bytes … the site is reachable only from a gateway that happens to hard-code ERC-5219 for this address. Which is a server, which is the thing this contract exists not to need." (lines 231-243). Tested by exact-word comparison (`tools/verify-site.mjs:388-402`).
- **One resource, one URL**: trailing slash dropped; leaf routes refuse extra segments; leading zeros refused — "Every response carries a Cache-Control, so 'the same page at any URL you like' is an invitation to fill a gateway's cache with distinct entries for one document until the real ones are evicted." (lines 259-267, 658-670). INVARIANTS.md #73.
- **`/` is the instrument**: "the token is the interface, and a visitor who clicks a link to an NFT should arrive at the NFT" (lines 274-287).
- **`/live` exists for one reason**: "A `data:` document gets an opaque origin, and wallet extensions do not inject into one — so an instrument embedded in a frame renders perfectly and cannot connect to anything. It can be looked at and not used. Served here it has a real origin under `web3://`, EIP-6963 discovery works" (lines 504-512). INVARIANTS.md #9d.
- **The still is its own request**: the counter used to iframe the instrument: "21M gas of `eth_call` for the shopfront, against 0.2M for every other service page" (lines 519-529). INVARIANTS.md #73.
- **`face` gate is exact-length** because "the latter lets `/token/1/face` through to read `resource[3]` and panic. A 404 and an out-of-bounds panic look nothing alike to a client" (lines 483-490).
- **17 flat constructor args → struct**: "Seventeen flat addresses is past what even viaIR keeps on a stack; a named struct is the same calldata, one memory pointer." (lines 200-201).
- **`/c/<id>/<verb>` is a real URL**: "a walk into somebody else's token [is] a thing you can send to them rather than a thing that only exists inside one tab's history" (lines 388-395).
- Short cache: "half of what this site reports is a live balance and a cached market is a market that quotes last minute's price" (line 184).

### 1.6 Gas/size
Runtime 15,372 B (62.5% of EIP-170). Per-route `eth_call` gas from a past `tools/gas.mjs` run: `/token/1/live` 4.48M (54,432 B) vs `tokenURI()` 19.99M (`README.md:973`); `/` ≈ /live; flat pages 0.08M–0.31M; `/token/1/sigil.svg` 3.32M (`tools/site-viewer.mjs:27-40`). `/estate` body 36,792 B (`DEPLOYMENTS.md:439`). The console route was estimated at 0.6–1.2M in `CONSOLE.md` §H.6 and not re-measured in the gas tool (its route list `tools/gas.mjs:188-214` does not include `/c`).

### 1.7 Tests
`tools/verify-premises.mjs` (30 assertions): root is the instrument; `/door` lists recent; `/raw` equals `tokenURI`; `/live` equals the inner document byte for byte; six nonsense paths are 404 not revert; ABI has no writes; code holds no engine bytes. `tools/verify-site.mjs:343-435`: 34 routes answer 200 with the right type; `resolveMode` exact word; trailing slash / junk / leading-zero / face-arity cases. `tools/verify-console.mjs:200-248`: `/c` shapes, typo verb → 200, `/c/9999` → 404. `tools/verify-recover.mjs` reads `P_*()` back (`PAGES` table `tools/site.mjs:382-391`).

### 1.8 Weaknesses
- `CONSOLE.md` §H.1 planned 302 redirects of 18 old routes to `/c`; none exist — both route families are live, and the nav (`Chrome.navTop`) still advertises 14 flat pages while `/door` points newcomers at `/c`.
- `request` ignores `params` entirely (no query API) — fine, but a gateway that forwards `?x=…` gets the same cached page.
- `/c` with no mint is 404 while `/` degrades to `/door`; minor inconsistency.
- `_exists` uses a raw staticcall to tolerate a reverting `ownerOf`; good.

### 1.9 Reuse verdict: **adapt**
The router pattern (ERC-5219 + `resolveMode` + immutable page table + artwork never through a page + one-URL canonicalisation + 404-not-revert) is exactly what the unified protocol needs and is the strongest piece in this area. Adapt the route table to the merged protocol's surfaces (swap / social / launchpad / vault / console), keep the four invariants verbatim.

---

## 2. `src/interfaces/Site.sol` (226 lines)

Purpose: "Five contracts render this site, and they read the same eight or nine things. Declaring those once is not tidiness — a page that declares its own copy of an interface is a page that keeps compiling after the contract it reads has changed shape, and then serves a number that means something else." (lines 6-14).

Declares: `IHub` (20 views: `totalSupply, tokenByIndex, MAX_SUPPLY, COLLECTION, FIRST_ID, LAST_ID, price, ownerOf, tokenURI, tokenURIAt, hasPinnedTokenURI, sectionOf, kernelStatus, locked, account, grip, viewOf, renderer, userOf, userExpires, leaseAgentOf, pool` — lines 16-39), `ISigilDraw.svg(id, word, seed, strata)` (41), `IRendererDoc.document(TokenView)/sigil()/facetCount()` (46), `struct MarketView` (14 fields, lines 58-73 — "`market()` returns twelve values, and a page that wants to print all twelve alongside four ERC-20 metadata reads runs out of stack even through the IR pipeline. One memory struct is one stack slot"), `IPoolRead` (`market, quote, isBonded, paused, pendingCurve, openCount, openIds` — 75-94), `ILeaseRead` (`listing` 9-tuple, `cost`, `MAX_DAYS` — 96-107), `IDesk` (`config(id), bare(), core(), swap(), pool(), rent()` — 109-116), `IParley` (120-137, incl. `mayActAs`, `sealX`, `stateOf` 9-tuple, `topics()` 5 topics), `ITalkDesk` (139-145), `struct Look` and `struct PoolState` (Uniswap v3 reads, 155-181), `IVenue` (183-217), `IChrome` (219-226).

Verdict: **adapt** — the practice (one shared read-interface file for the site, memory structs to dodge stack limits) carries over; the specific shapes follow whatever hub/pool/lease the merged protocol has. Note `MarketView.open` etc. are the site's view only; peripheral contracts deliberately declare their own minimal interfaces (CLAUDE.md conventions).

---

## 3. Chrome — the shared shell (`src/Chrome.sol`, 421 lines)

### 3.1 API (all `external pure`)
`head(string title)` (line 25) — doctype, viewport, `<title>`, inline `<style>` with the whole stylesheet `CSS` (lines 33-274); `wallet()` (276) — `<script>` with `WALLET_JS`; `nav(uint256 id, uint8 here)` (326) — per-token nav: index, token, instrument, market, rent, vault, message (`/dm/<id>`), json; `tabs(string t, uint8 here)` (344) — swap/pool/rent/vault; `navTop(uint8 here)` (360) — 14 site tabs (instrument, door, terminal, swap, launch, lock, social, market=/gallery, projector, name, keys, seal, estate, manifest); `foot(address premises, uint256 chainId)` (391) — "about this page" paragraph naming the ERC-5219 address, a `<div id=s>` status line, and the lore-chip script that folds `p.e:not(.w)` paragraphs behind a `✦` button.

### 3.2 WALLET_JS (`window.IPW`, lines 280-324)
Collects EIP-6963 `announceProvider` events into a `Map` by `rdns`; `pick()` = stored choice (`localStorage 'ipse.wallet'`) → sole announcer → null; `pv()` = chosen provider or first announcer or `window.ethereum` (reads may use any); `choose()` raises a picker overlay (`.wals/.walc/.walb`) when >1 announcer and nothing stored; `drop()` forgets. Why: "Phantom and Keplr race to announce, and MetaMask loses the sprint on every page load. … Desk chooses one before a read can determine a transaction: otherwise one wallet could supply the terms and another could be asked to sign them." (lines 264-274). Icons only if `data:image/`; names via `textContent`. INVARIANTS.md #79 and #99.

### 3.3 Size and status
Runtime **23,310 B (94.8%)** — near the ceiling (README's table at `README.md:1038` still says 13,816 B; the stylesheet has since grown: swap card, chart, chat, wallet picker, terminal, gallery, lore, tesseract (dead), projector studio, range bars). `CONSOLE.md` §H.1 rules "Chrome.sol is retired entirely" for the console; the console has its own stylesheet (`engine/console.css`) and does not use Chrome at all.

### 3.4 Weaknesses
- The `.tess4/.tdoor` CSS (lines 237-243) survives although the tesseract door was deleted (`PageDoor` 142-146, INVARIANTS #147).
- Two visual languages now coexist (Chrome's serif/gold vs the console's mono/hue) — the spec says the console replaces Chrome, the code keeps both.

### 3.5 Verdict: **rewrite**
Keep the ideas (EIP-6963 chosen-not-raced wallet, lore folding, `.gate/.only` courtesy gating, `foot(msg.sender)` self-naming), but the merged protocol should have one shell, and the console's stylesheet is the one the owner's spec chose. The 23 KB of flat-site CSS should not be carried.

---

## 4. Desk — the application client (`src/Desk.sol`, 493 lines; runtime 23,401 B, 95.2%)

### 4.1 API
`constructor(IHub, IPoolRead, ILeaseRead)` (54); `config(uint256 id) external view` (69) — `<script type="application/json" id="D">` with `chain, id, hub, pool, open, fee, feeCap:500, spot, maxBaseOut, maxQuoteOut, rBase, rQuote, base{a,s,d}, quote{a,s,d}, sel{12}, lease{a,open,why,perDay,min,max,renter,until,vested,sel{8}}|null`; `bare()` (104) — the same with `id:0` and no market; `selectors()` (146) — `quote, swap, approve, allowance, balanceOf, deposit, withdraw, setFee, bond, syncCurve, openMarket, closeMarket`; `leaseSelectors()` (163) — `rent, list, delist, collect, endLease, settle, claim, agent=setLeaseAgent`; `core()/swap()/pool()/rent()` (191-209) return `<script>` wrappers of `CORE_JS` (212), `SWAP_JS` (353), `POOL_JS` (437), `RENT_JS` (469).

### 4.2 CORE_JS = `window.IP`
`D` (parsed config, with every `s` ticker scrubbed by `TK` whitelist on load — "JSON escaping is not HTML escaping, and `<script>` comes back out of JSON.parse as a literal `<script>`. Any page that then interpolates it into innerHTML … has put a string the token's deployer chose into the DOM of a page a wallet is injected into"), `W(v)` (uint word, refuses >64 hex), `S(v)` (two's-complement signed word — "a client that instead dropped the sign would send a legal tick about nine million times the intended price"), `SW`, `AD` (address), `pad`, `parse(s,d)` (decimal text → BigInt base units, refuses >d places), `fmt(v,d,p)`, `TK`, `STR` (ERC-20 string/bytes32 decoder, len ≤128), `call(to,data,gas)` (chooses wallet via `IW.choose()`, checks chain, `eth_call`), `tryCall`, `word(r,i)`, `connect()`, `send(to,data,value)`, `chainOk()`, `acct()`; generic `[data-call]` buttons with `data-args="id:uint|addr|bool,@:addr"`, `data-read`, `data-out`, `data-value`, `data-valfrom`; `#mkt` picker navigates to `/token/<id>/market`.

### 4.3 Design decisions (quoted)
- "No ABI coder and no keccak-256. Every selector this app needs is computed on chain by the contract that generates the page … a client that computes less is a client that can be wrong about less" (lines 24-32).
- "No floating point, either. … A front end that multiplies a token balance by 1e18 in a double has already lost the last three digits" (34-38). INVARIANTS #76.
- The config block "is written with the JSON escaper, so a token whose symbol is `</script>` cannot end the block" (40-45).
- Past bug recorded in SWAP_JS: "The first version of this set `$('sl').textContent` directly, and the element did not exist — which in a browser is a TypeError inside paint(), thrown before a single listener is attached, so the whole card is dead on arrival" — the origin of the DOM-driving suite (INVARIANTS #75).
- Approve-then-swap is one button whose label is the current step (`'Approve '+TIN().s` vs `'Swap …'`); approvals are unlimited (`(1n<<256n)-1n`) — the console branch later moved to exact-amount approvals.

### 4.4 Verdict: **adapt**
The client discipline (selectors from chain, BigInt-only, whitelist tickers, chain check before read, one-button step machine) is reusable verbatim as a pattern; the concrete selector tables follow the merged protocol's pool/lease ABIs. Prefer the console's ES5 lane style over `CORE_JS`'s minified-in-Solidity style for maintainability.

---

## 5. The other desks

### 5.1 DeskUni (`src/DeskUni.sol`, 349 lines; 17,328 B)
`constructor(IVenue, IPoolRead)`; `SCAN = 32` (72); `config()` (86) emits id="D" with `chain` and `uni{venue, factory, quoter, router, kind, positions, governor, gov, wrapped{a,s,d}, tiers[{fee,sp}×4], assets[], sel}`; `selectors()` (158) = `_selErc` (6) + `_selPool` (10) + `_selSwap` (3: `swapV3` = v3-periphery `exactInputSingle` 8-word struct, `swap02` = SwapRouter02 7-word struct, `quote` = QuoterV2 `quoteExactInputSingle((address,address,uint256,uint24,uint160))` "the struct declaration's order, NOT the NatSpec comment's") + `_selPos` (8) + `_selVenue` (7) + `_selCivic` (16 ERC-4626/governance selectors); `base()` (282) = `BASE_JS` → `window.UNI{U,S,K,meta,pools,slot0,picker,goChain}` — `meta(addr)` asks `decimals()`/`symbol()` of a pasted token (refuses >36 decimals), `pools(x,y)` asks the factory for all four tiers and each pool's `liquidity()`, deepest first; `goChain` = EIP-3326 `wallet_switchEthereumChain` with EIP-3085 fallback.
Why: "Two Uniswap routers have an `exactInputSingle`; their structs differ by one field; the wrong one does not revert, it shifts `recipient` and every amount by a word." (lines 24-30; INVARIANTS #98). Token list is **derived** from the collection's open markets (`lib/Assets.derive`) plus the wrapped native, never fetched (`src/lib/Assets.sol` header).
Weakness: `_selCivic` (ERC-4626/governance) and most of `_selPos` are emitted on every Uniswap page though no page sends them — `CONSOLE.md` §D.9 calls them "Bytes in a byte-budgeted system buying nothing" and rules them deleted; still present.
Verdict: **adapt** (the venue-wiring + derived-asset-list + router-kind pattern is good; drop dead selector tables).

### 5.2 DeskTrade (`src/DeskTrade.sol`, 205 lines; 7,669 B)
`swap()` → `SWAP_JS`: quotes every tier that has a pool through QuoterV2 with a 30,000,000 gas `eth_call` ("QuoterV2 works by making a pool swap and catching the revert"), takes the best unless a tier was forced; builds calldata by `U.kind` (0 → 8 words with deadline; 1 → 7 words, no deadline); refuses `amountIn == 0` ("on SwapRouter02 zero is not 'swap nothing': it is the CONTRACT_BALANCE sentinel") and recipient `0x…01/02` sentinels; single hop only ("a multi-hop path is a `bytes` argument and this client has no ABI coder"). The concentrated-liquidity (limit-order) client described in the trailing comment (lines 150-204) is prose only — no `POS_JS` exists.
Verdict: **adapt** for an external-DEX tab; if the merged protocol's "swap" is its own per-token AMM (as here), this is the secondary surface.

### 5.3 DeskLaunch (`src/DeskLaunch.sol`, 383 lines; 17,079 B)
`launch()` → `LAUNCH_JS`, reads config `K` from `PageLaunch._config` (`src/PageLaunch.sol:133-168`: `kiln, manager, planner, positionManager, permit2, v4, wrapped, dynamicFee=8388608 (0x800000), maxFee=1000000, gateFlags, facetFlags, sel{launch, coinAt, mine, recipeHash, band, facetArg, deployHook, initV4, mintPlan, permitApprove}`). Four steps: (1) `coinAt(...)` preview then `launch(uint256,string,string,uint8,uint256,bytes32)` — two `string`s hand-encoded, names whitelisted to printable ASCII "so one character is one byte and the length the head advertises is the length the tail actually has"; (2) the hook: Gate (opens/unlocks timestamps packed `(opens<<64)|unlocks`) or Facet (token id + fee floor/ceiling packed by `Kiln.facetArg` — "The contract that unpacks it is the one that packs it"); salt mined by `Kiln.mine(bytes32,uint16,uint256,uint256)` as an `eth_call` in windows of 60,000, up to 12 windows per press, 30M gas; `deployHook(kind, salt, arg)`; (3) v4 `initialize((address,address,uint24,int24,address),uint160)` — "six flat words with no offset … the one v4 entry point a client with no ABI coder can build on its own"; guards both hook/fee mismatches ("a dynamic-fee pool starts at zero and only its hook can move it"); (4) the position: `V4PositionPlanner.mintPlan` returns canonical `modifyLiquidities` bytes which the wallet forwards unchanged; Permit2 `approve(address,address,uint160,uint48)`.
Past bug recorded: `psum` warning "asked whether a hook existed rather than whether it sets a fee"; TDZ ordering of `hshow()`.
Verdict: **adapt** — this is the launchpad client; keep the mine-by-eth_call trick and the planner-encodes-nesting split.

### 5.4 DeskTerm (`src/DeskTerm.sol`, 374 lines; **23,908 B, 97.3%**)
`constructor(hub, pool, lease, parley, kiln, locker, roster)`; `config()` (48) emits id="X" with seven addresses and `sel{53 selectors}` (`_sel1` 22 hub selectors + `_sel2` 31 pool/lease/parley/kiln/locker); `core()` (138) → `TERM_JS` = `window.TERM{def, run, commands, me, use}`. 31 built-in words: `help me use mint state turn hue open lock unlock pin unpin embody grip give say dm room rent market approve deposit launch launched lockup lockups redeem go lockgive extend balance`; `DeskRooms` registers `invite evict roster` (3) and `DeskWill` registers `will approve-will alive unwill knock inherit consign window price take home unwindow` (12) through the same `def` — 46 words total (INTERFACE.md says "~35"). `ENC(sel, parts)` is a two-pass dynamic encoder: "Parts in PARAMETER order … All offsets are computed before anything is written: an offset written while the tail is still growing is a lie" (INVARIANTS #95). `run(line)` returns one string — "an agent calls `TERM.run('open 3')` and reads the string that comes back; both are the same code path" (INVARIANTS #94). `commands()` returns `{cmd, usage, what, writes}` as data.
Why split: "DeskTerm is already at the byte ceiling, so the commands that arrived last live in their own contract and register through here — the same answer the wallet client got when Desk filled up" (lines 362-368). `DEPLOYMENTS.md:385-388` records DeskTerm at 25,195 B (103%) before the split.
Weakness: the `go` map (line ~318) is a third hand-written door list; INTERFACE.md:133-136 names a `DeskGo` companion as the fix. The terminal uses `window.IP` (so EIP-6963 picker applies).
Verdict: **adapt** — the "terminal is an API that happens to have a keyboard" idea (one code path for people and agents, `commands()` as data) is unique and worth carrying; regenerate the word table for the merged protocol and keep words in companion contracts from day one.

### 5.5 DeskTalk (`src/DeskTalk.sol`, 455 lines; 20,422 B)
`constructor(IParley, hub, roster)`; `config(room, other, group)` (56) emits id="T": `at, roster, hub, room, other, group, steward, max (=MAX_BODY 1024), said (topic0 of `Said(uint256,uint256,uint64,uint64,uint64,uint8,bytes)`), sel{23}`; `core()` → `TALK_JS` (`window.IPT` + `window.PARL`), `rooms()` → `ROOMS_JS`, `door()` → `DOOR_JS`.
The walk (`back(room, want)`): `stateOf(room).last` → one `eth_getLogs` for exactly that block with `topics:[said, room]` → `READ(log)` decodes `{room, from, prev, prevFrom, seq, kind, body, block, tx}` → follow `prev` while it strictly decreases, guard 64. "the one thing a client must never do to somebody's node is ask forever." Polling: `heads(uint256[])` every 9 s, repaint only when the count moved. Sending: `speak(room, me, kind, body)` or `whisper(me, other, kind, body)` with a `bytes` tail laid out by `ARG`; the body passes through `OUT` (the seal hook). Rendering: four elements per message, all `textContent`; `kind !== 0` renders "• sealed · N bytes" and hands the row to `window.UNSEAL`.
Three refusals (header, lines 15-32): no keccak, no innerHTML for chain strings, no range scans. INVARIANTS #81, #90, #91, #92.
`ROOMS_JS`: `roomsOf(token)` two-array decode; `found(by, name, open)`; join/leave/invite; roster via `Roster.inWindow(room, base)`/`invitedInWindow` in 256-token windows across `totalSupply` (commit `0522015`), with `evict` buttons except in the commons (`T.room==0`).
`DOOR_JS`: held-token rows linking `/c/<t>` first, then `/token/<t>/live`, `/token/<t>`, `/dm/<t>`; instrument iframe only on demand ("It is a 21M gas eth_call to read one").
Verdict: **adapt** — the indexer-free, single-block-walk chat client is a unique asset for the "messaging crypto social layer"; keep it, retarget to the merged Parley ABI.

### 5.6 DeskSeal (`src/DeskSeal.sol`, 145 lines; 4,783 B)
`core()` → `SEAL_JS`. Key derivation: `personal_sign("IPSEITY seal v1 · chain <c> · token <t>")` → SHA-256 → scalar (re-hash while ≥ P-256 order) → PKCS#8 import with the 35-byte fixed header `3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420` ("the browser computes the point itself on import, which is the one way to get curve arithmetic without shipping any"); publish via `Parley.announce(token, x, y)`; pair key = SHA-256(ECDH static-static) → AES-256-GCM; 12-byte IV ‖ ciphertext, kind 1. `Parley.keyOf` returns zero once the publishing wallet no longer owns the token (commit `4fa41d0`), so a sold token drops to plaintext. No forward secrecy, stated. Three recorded fixes in `arm()` (INVARIANTS #113).
Verdict: **adapt** (end-to-end sealed DMs with a wallet-derived key and no stored secret is a real differentiator; tie the sentence to the merged chain/collection).

### 5.7 DeskEstate (`src/DeskEstate.sol`, 232 lines; 11,686 B), DeskWill (169 lines; 9,546 B), DeskRooms (56 lines; 2,106 B)
`DeskEstate.core()` → `ESTATE_JS` for `/estate`: two readers (`qread` for Succession via `planOf/heirOf/wouldPass/knockableAt/opensAt/getApproved`, `cread` for Consign via `noteOf/split/owed/locked`), ten `WHY` strings for `wouldPass` codes, `up()` guard against unmounted pages (INVARIANTS #121), heir field accepting an address or `#token`. Weakness: it listens for `window 'ip:account'` (line 229) and nothing in the repository dispatches that event (grep: single occurrence) — account changes do not refresh the estate page. `DeskWill` carries its own config block `W` (succ, cons, hub, 15 selectors) "rather than asking the terminal to grow one". `DeskRooms` registers three words.
Verdicts: DeskEstate **adapt** if succession/consignment survive the merge (they are good candidates for the "vault" story); DeskWill/DeskRooms **adapt** as the pattern for companion word-contracts.

---

## 6. The pages (`src/Page*.sol`)

All pages are `view`-only (asserted for 32 contracts in `tools/verify-site.mjs:3152-3185`), hold immutables only, emit no events, declare no errors, and compose `CHROME.head → navTop/nav → body → config block → CHROME.wallet → DESK.core → feature script → CHROME.foot(msg.sender, chainid)`. Each carries a JSON config block whose selectors are hashed on chain by a local `_sel(sig)` (every page repeats this 12-line helper). Sizes from `out/solc.json`.

| page | route(s) | runtime B | config id | notable |
|---|---|---|---|---|
| PageDoor (336 l.) | `/door` | 15,388 | D (bare), T, X | `_ways()` server-renders the door map and derives `window.DOORS` from the anchors (INVARIANTS #147); `_mintButton` runs `TERM.run('mint')`; `_chains` says "IPSEITY is Ethereum-only"; `_band` prints "N of 4096 — this chain holds #first–#last"; `_roll` lists the 12 newest. Three past stack-too-deep splits documented (`_ways`, `_mintButton`, `_band`). Embeds the commons log and the terminal. |
| PageToken (269 l.) | `/token/<id>`, `/token/<id>/faces` | 16,273 | — | facts (form, holder, operator=userOf, bound, kernel, reach, grip, word) + live service board (`_tradeRow`, `_rentRow`, give/draw/verify cards) + `<img src=/token/<id>/sigil.svg>` and links to `/live`,`/faces`,`/raw`. ERC-7160 faces page says "the instrument is about 20M gas of eth_call … under the 50M cap geth, erigon and reth use by default". |
| PageMarket (313 l.) | `/token/<id>/market`, `/open[/p]` | 18,917 | D | swap card (`_card`), market `<select id=mkt>` seeded from `POOL.openIds(0, PICK=40)` ("a dropdown offering ten thousand tokens of which four are tradeable is … a lie told four thousand nine hundred and ninety-six times"), `_caution` (holder can move the curve; two-tx first trade), `/open` directory `PAGE=24` with pager that "says what it looked at". INVARIANTS #77, #78. |
| PagePool (206 l.) | `/token/<id>/pool` | 11,961 | D | holder's side: position, add/remove, fee (5% ceiling), bond (ratchet), `_curve` via `POOL.pendingCurve` ("a page that recomputes a contract's own derivation is a page that will one day disagree with it"), open-market form. One provider per market, no LP shares. |
| PageServices (365 l.) | `/token/<id>/rent`, `/token/<id>/vault` | 17,789 | D | rent card with exact-wei cost and `maxPerDay` price guard; holder card (name lease agent, list, collect, end, settle, delist, claim); vault page: Reach/Grip with `code.length` deployed check, `give` via `data-call="0x"` plain value, `draw` calls `Sigil.pathAlong` through `data-read`, `verify` shows the Reach's `domainSeparator()` and ERC-1271 magic `0x1626ba7e`. |
| PageManifest (502 l.) | `/token/<id>/services.json`, `/services.json[/p]` | **23,105 (94.0%)** | — | `SCHEMA = "ipseity.services/2"`; per-token: six services `trade, rent (with use{commit,setTrait}), give, draw, verify, session (grant/act/check/revoke + door "/k/<id>/<key>")`, each with `{sig, selector, kind}`; index: `band`, `EDITION` constant (`[{chainId:1,…,1..4096}]`, checked against `tools/site.mjs BANDS` — INVARIANTS #130), `mint{invoke,on,value}`, `ROUTES` (21 entries), `parley{at,commons,groups,maxBody,said,invoke,asToken,walk}`, `kiln, locker, deskTerm, venue{routerKind…}`, paged `offering[]`. Recorded bugs: `quote` key collision ("a duplicate key is legal JSON that every parser resolves by keeping the last one"), `parts.length` vs literal 5, services joined not concatenated, unterminated lease string. |
| PageTalk (199 l.) | `/chat`, `/dm/<id>` | 10,193 | D, T | gate + `<select id=as>` speaking-as; `_how` explains the single-block walk; dm page renders `#sealbar` and chooses `_sealable`/`_plain` prose by `PARLEY.sealX(other)`; loads `SEAL.core()`. |
| PageRooms (181 l.) | `/rooms`, `/room/<n>` | 9,008 | D, T | `/rooms` is "the only page on this site that cannot be rendered" server-side (needs the speaking token); `/room/<n>`: `groupKey(n)` → `stateOf`, name through `Web.esc`, kind≠1 → `_noRoom` 200; steward panel with invite + roster (`#roster`, `#pend`). |
| PageTerminal (75 l.) | `/terminal` | 3,252 | D, X, W | `_agents()` says "This terminal is an API that happens to have a keyboard." |
| PageSwap (285 l.) | `/swap` | 17,523 | D (uni) | venueless chains get `_noVenue`; `_options()` derived from `Assets.derive(POOL,0,32)` + wrapped + "paste an address…"; `_routerNote` states the SwapRouter02 no-deadline trade-off; `_where` lists factory/quoter/router/positions/venue and the approval boundary (router vs pool). |
| PageGallery (89 l.) | `/gallery[/p]` | 4,857 | — | `PER_PAGE=24`, newest first via `tokenByIndex`, badges `market` / `for rent` / `leased` from live reads, stills lazy-loaded from `/token/<id>/sigil.svg`. |
| PageLaunch (460 l.) | `/launch` | **23,494 (95.6%)** | D (uni), K | four steps, hook prose, `_mining`, `_inspector` (→ `/hook/<addr>`), `_recent()` from `KILN.recent(0, PAGE=20)` with `Web.esc(symbol/name)`, `_where`. Step 4 markup moved to `LaunchView.sol` "solely to stay below EIP-170". |
| PageLock (303 l.) | `/lock` | 15,541 | V | `maxDays = LOCKER.MAX_TERM()/1 days` (3650); 16 selectors incl. `lockWithPermit` and `DOMAIN_SEPARATOR`; `LOCK_JS` tries EIP-2612 permit (`eth_signTypedData_v4`) and falls back to approve+lock; lists this wallet's locks (cap 50) with claim/give. |
| PageHook (125 l.) | `/hook[/<addr>]` | 6,620 | — | reads the 14 permission bits off the address via `lib/Hook` (`flags, inert, touchesSwaps, guardsExits, name, meaning, bit`); "the bits prove a power exists and say nothing about how it is used". Renders with JS off. |
| PageCast (205 l.) | `/projector` | 7,610 | J | `POSE` constant (a 24-cell, documented as taste), `SEED=1`; first SVG drawn **during render** by `SIGIL.svg(0, POSE, SEED, 6)`; sliders redraw via `eth_call` of `svg(uint256,uint256,bytes32,uint32)` with 30M gas, debounced 220 ms; "the one producer this site lets write markup" (the Sigil's own output into `#stage.innerHTML`). No wallet flow. |
| PageSeal (266 l.) | `/seal` | 11,324 | Z | `MAX_DAYS = 365` mirror of `IpseityAccount.MAX_SEAL`; reads `ownerOf, locked, kernelStatus, account, sealedUntil`; `seq` race guard; bolt (`lock/unlock`), embody, `seal(uint64)` ratchet guard before the wallet is asked. |
| PageKeys (438 l.) | `/keys` | 18,868 | K | grant card with chips carrying on-chain-hashed selectors (`bytes4(0)`, transfer, approve, swap, deposit, withdraw, speak, claim); `LIM` read from the account's `MAX_LIST` (16); `enc()` lays out `grantSession(address,uint64,uint128,address[],bytes4[])` by hand — "an address is right-aligned in its word while a bytes4 is left-aligned. Swap those and the transaction still succeeds: it grants a selector nobody chose" (INVARIANTS #111); `cur()` shows "retired when it sold" via `sessionCurrent` (INVARIANTS #126); checker asks `sessionAllows`. |
| PageName (491 l.) | `/name` | 21,567 | N | DNS-wire-format encoding in the browser (`05 alice 03 eth 00`) because "a namehash you could not check is a namehash you should not sign"; `bindByName/unbindByName/claimParentByName/tokenForName/nameStatus/renew`; wildcard-parent card is one-shot and separate; `_absent` on chains without ENS; renewal is permissionless and pays 5% over the quote. INVARIANTS #103, #110, #111a. `contentcontract` text is HTML-escaped client-side (`ESC`). |
| PageEstate (260 l.) | `/estate` | 14,982 | Q | constants `MIN_QUIET_D 30, MAX_QUIET_D 3650, MIN_NOTICE_D 7, MAX_NOTICE_D 365, MAX_TERM_D 730, MAX_CUT_BPS 5000`; will and window cards with warnings in the open ("A page that has to bury what a control gives away is a page describing a control that should not exist"); script lives in `DeskEstate` (split: "six per cent past what a chain will accept"). |
| PageKey (268 l.) | `/k/<id>/<key>` | 11,275 | KEY | `_envelope` reads `sessionOf/sessionCurrent/sealedUntil` behind a `code.length` check ("`try` alone does not survive a codeless address"); allowlists stated as non-enumerable; `KEY_JS` (ES5, `window.ethereum` only) checks `sessionAllows` before building `executeAsSession(to,value,data)` and refuses to send unless `eth_requestAccounts[0]` equals the key. |

Reuse verdicts for pages: PageManifest **adapt** (the machine-readable shopfront with on-chain selectors is unique and directly serves agents); PageDoor/PageToken/PageMarket/PagePool/PageServices/PageTalk/PageRooms/PageSwap/PageLaunch/PageLock/PageKeys/PageKey **adapt** (content and gating patterns survive; markup/CSS should be regenerated in the console's language); PageHook, PageCast **reuse-verbatim-able** as self-contained routes (they depend only on `lib/Hook` and the Sigil); PageGallery, PageTerminal **adapt** (thin); PageName, PageEstate, PageSeal **adapt only if** the merged protocol keeps ENS binding / succession+consignment / the three seals.

---

## 7. The console

### 7.1 PageConsole (`src/PageConsole.sol`, 529 lines; 19,252 B, 78.3%)
`constructor(IHub, ConsoleRead, ConsoleSkin skin, ConsoleSkin core)` (77) — the same data-contract type twice, "One holds the stylesheet, one holds the script; neither knows what it is holding"; `verbName(uint8)` / `verbSub` / `verbWord` / `verbOf(string)` (92-134) — the seven verbs `turn hold trade hand speak make look` with names TURN IT · PUT SOMETHING IN IT · TRADE THROUGH IT · HAND IT ON · SPEAK AS IT · MAKE SOMETHING WITH IT · LOOK AT ANOTHER ONE; `doc(uint256 id, uint8 verb) external view` (137).
Document order: `_head` (inline `SKIN.css()` + `:root{--h:<hue>}`), `<body><div class="sub here" style="--h:…" id=root>`, `_crest` (TOKEN, CHAIN via `_chainName` (1, 8453, 130, 56, 4663, 11155111, 84532), HELD via `_short(owner)`, LED + `#acct` "read only", `#walk` crumb, `#palbtn`), `#col` = `_still` (`<img src=/token/<id>/sigil.svg>` + `see it turning →` to `/live`), `_ident` (three sentences from `form()`, `offsetW()`, `_planeCount`, `_doneTo(ops)`; "Its holder was not reported." when `BIT_OWNER` clear), `_verbs` (seven `<button class=vb data-v data-w>` with `_clock`: HAND shows lease days / "lease ended", TRADE shows "bonded Nd"), `#lane` = `_lane(verb)` (verb 0: three blurb paragraphs; 2: Reach/Grip + permanence sentence; 3: market state or "No market contract answered on this chain. That is not the same as this token having no market"; 4: lease state; plus the `#lane-note` "controls need the console's script, which has not run"), `_foot` (`#tick`, `#cmd` input, `#cbox .slab`), `_seed` = `window.CON={id, chain, hue, word, hub, read, owner, reach, grip, reported, first, last, verb, sel{commit, embody, embodyGrip, xfer, mint, price}}` followed by `<script>` of `CORE.css()` (the client bytes).
Why server-render: "That is what makes the console's degradation honest: when nothing else works, what is left is a correct page about the right token, rather than a skeleton and a spinner over a number nobody read." (lines 51-58). The margin-rule walk design is the owner's own fault report: "its cool but I dont know where they come from or why they are there" (lines 29-50). Stack-too-deep documented twice (`_seed` split, `_sels` separate). `_hue` widening note (`uint8 * 360` widens to uint16).

### 7.2 ConsoleRead (`src/ConsoleRead.sol`, 184 lines; 3,408 B)
`look(uint256 id) external view returns (TokenView v, Clocks c)` (104); `bits() external pure returns (hub=1, pool=2, lease=4, owner=8, user=16)` (178); `struct Clocks {leaseUntil, leaseVested(uint128, saturating), leasePerDay, leaseMinDays, leaseMaxDays, renter, rentable, bondUntil, marketOpen, feeBps, base, quote, userExpires(uint64, saturating), user, reported}` (81-97). Every satellite read is `if (_live(addr)) try … catch {}` where `_live` is `extcodesize > 0` in assembly (66-68): "Solidity inserts an `extcodesize` check before any external call that returns data, and that check reverts BEFORE the call is made — so it is not the call failing, and `catch` never sees it" (53-65; commit `2d73990`). The three-valued rule: "a clear bit means NOBODY ANSWERED; a set bit with a zero value means THE ANSWER WAS ZERO" (26-28). Reads `ownerOf` even after `viewOf` "which has caught a stale index before".
Tested: `tools/verify-console.mjs:147-194` deploys it against `0xdede…` for pool and lease and asserts hub/owner bits set, pool/lease bits clear.

### 7.3 ConsoleSkin (`src/ConsoleSkin.sol`, 122 lines; 1,807 B)
Storage: `address curator` (slot 0), `bool frozen`, `address[] shard`. Errors `NotCurator, IsFrozen, Empty`; events `Loaded(uint256 index, address pointer, uint256 length)`, `Frozen()`. API: `load(bytes) onlyCurator` (SSTORE2 write, push), `dropLast()`, `freeze()` (sets `curator = 0`, one-way), `setCurator`, `css() view returns (bytes)` (concat of shards via EXTCODECOPY), `size()`, `shardCount()`. Why raw, not gzipped: "A `<style>` has to be in the document before the first paint. Inflating one in JavaScript means the document paints once with no stylesheet and again with it — a flash of unstyled console, on every load, forever" (20-31). Deployed twice by `tools/site.mjs:712-745`: `engine/console.css` (18,359 B → 1 shard) and `console.js + "\n" + console-lanes.js` (39,634 B → 2 shards of 24,000), each `freeze()`d.

### 7.4 `engine/console.js` (379 lines, 16,573 B)
`window.CON` consumer. The walk lives in the fragment `#w=id:hue,…` ("ERC-5219 hands `Premises.request` the path and the query and never the hash, so the walk crosses every navigation without costing a contract byte, without reaching a gateway's cache key"; lines 19-28); `MAX_DEPTH = 3` (87); `paintWalk` inserts one `.sub.past` band + `.rung` button per level at 22 px each and sets `--walk`; `walkTo(id)` validates `C.first..C.last` and navigates to `/c/<id>#w=…`; `walkOut(i)`. Wallet: `connect(loud)` via `window.ethereum` only (no EIP-6963 here), `paintAccount` ("read only — connect" cell is the control), `checkChain`/`switchChain` (EIP-3326), repaint on `accountsChanged`/`chainChanged`, "No localStorage" (35-36). `WORDS` and `ALIAS` tables (291-304) held equal to `PageConsole.verbWord` by `tools/verify-console.mjs:82-114`. `run()` accepts `#1024`, `connect`, a verb or digit, or an alias; "Unknown input is an error sentence, never a guess." Keys: Escape closes the lane by navigating to `/c/<id>`, `/` focuses the command line.

### 7.5 `engine/console-lanes.js` (511 lines, 23,060 B)
"the smallest ABI coder": `enc.addr`, `enc.uint`, `wei()`/`eth()` (BigInt; "Dust is still custody … `<0.00001`"). `propose(title, lines, tx, fn)` (108-160): refuses when `C.chainOk === false`, renders the slab with To/Value/Function, sends only on `[data-go]`, then `watch(h)` polls `eth_getTransactionReceipt` every 4 s up to 45 tries (3 min) and says mined/reverted/still not mined. `onlyHolder(parent)`. Lanes: 1 TURN (six plane sliders + cut + hue, live re-tint; slab states deltas in degrees; `commit(uint256,uint256)`), 2 HOLD (balances via `eth_getBalance` → "not reported" on failure; `embody`/`embodyGrip`; pay into Grip = plain value tx), 3 TRADE (`unbuilt` note), 4 HAND (`transferFrom` only; links `/keys` and `/k/<id>/<key>`; `unbuilt` for keys/lease/consign), 5 SPEAK (`unbuilt`), 6 MAKE (`price()` read → mint with value; "a payable mint proposed at zero value reverts"), 7 LOOK (walk by number; nearby chips ±3). Lanes paint only after `C.ready` (the wallet answer) — "a lane painted before that answer told a holder to connect while the crest said 'you'". The layering statement (lines 9-18): no script → correct page; script, no wallet → walk and command line; script and wallet → controls.

### 7.6 `engine/console.css` (300 lines, 18,359 B)
Tokens `--h`, `--a/--a-dim/--a-ghost` derived from the hue; `.sub` re-declares `--a` because "a custom property containing var() is substituted where it is DECLARED" (84-89; "That cost an afternoon" in the spec); `.sub.past{pointer-events:none}` with the recorded bug "setting it to none [on #root] made the entire console unclickable while every screenshot of it looked perfect" (96-104); body fade is a CSS animation, not a class ("a fade that is one exception away from a black page", 47-55); fixed regions `--crest:46px --col:300px --cmd:36px`; `#lane` slides in under 900 px; five type classes; "Everything is 1px. Not one rounded corner except the LED and the scrollbar thumb"; no ambient motion.

### 7.7 CONSOLE.md and INTERFACE.md — spec versus shipped
`CONSOLE.md` (1,211 lines) is the build specification: six rulings (verb-first spine; hue-rule walk; server-rendered first paint; no twelve-node ring; no history except Parley's exact walk; four grafts), the cold open byte budget (~64 KB), 101-action surface map §D, the refused list §D.9, state/failure rules §E (six placeholder strings; `not reported` vs `none`; latent sentences for fresh tokens; wrong-chain; slab), the visual spec §F, voice rules §G (eleven), the build plan §H (14 contracts, gzipped lanes, 302 redirects, CI size gate), and §I not-in-v1.
What actually shipped (commits `62fb8e3`, `2d73990`, `f839fdd`, `ada19f3`, `c42f6a3`): four contracts (PageConsole, ConsoleRead, two ConsoleSkin stores), **raw** JS (not gzipped; no `pull()` loader; no lane blobs), no redirects, no palette overlay, no standing line, no latent sentences, no `/c` wallet-list column (`/c` renders `FIRST_ID`), no `#u=` uncommitted arrival, TRADE/SPEAK/most of HAND and MAKE marked `unbuilt`. `INTERFACE.md:119-137` states this plainly: "The lanes are still thin." The unmerged branch `origin/claude/claude-md-docs-8vvyc8` (6 commits, 2026-08-24) fills TRADE (open market, approve-as-step with exact amounts, quote-at-review swap, fee, bond, sync), HAND and SPEAK (walks the ParleyPort for cross-chain messages), grows `ConsoleRead` (+82 lines) and `PageConsole` (+135), and adds 313 lines to `verify-console.mjs` — it is the console's next tranche and was never merged.

### 7.8 Console verdict: **adapt** (highest-value UI piece)
The console is the surface the GOAL describes: one route per token (`/c/<id>`), seven plain verbs, the token's own colour, server-rendered state, controls that appear once a wallet proves holding, every write through a confirm slab. Carry: the route shape, `ConsoleRead`'s reported-bits reader (generalised to the merged satellites: pool, parley, launchpad, vault), the SSTORE2 skin/core stores, the fragment walk, the slab + receipt watcher, the naming-table test. Fill the lanes from the unmerged branch rather than from scratch. Replace `window.ethereum` with the EIP-6963 chooser so invariant #99 holds on the console too.

---

## 8. tools/site.mjs (818 lines) and tools/gateway.mjs (146 lines)

### 8.1 site.mjs
Exports: `LAYERZERO`/`LAYERZERO_TESTNETS`/`canRead`/`portPeers`/`LZ_COST` (probed LayerZero endpoints and measured fees; out of scope but the comments record real measurements, e.g. "from Unichain, READING Ethereum costs 1.957e-5 ETH and MESSAGING Ethereum costs 3.404e-4 — seventeen times more"); `COLLECTION = 4096`, `BANDS = {1: Ethereum 1..4096}` (Ethereum-only since commit `fe990f7`), `assertTiles(bands)` (runs at import; INVARIANTS #131), `bandFor`, `REHEARSAL_CHAINS = {31337, 11155111}`, `bandOrWhole`, `bandArgs`, `endpointFor`; `UNISWAP` table for chains 1, 8453, 84532, 11155111 (factory, quoter, router, routerKind 1 everywhere, positions, wrapped, poolManager, v4Positions, permit2, ens, nameWrapper) and `NO_VENUE`; `predictCreate(sender, nonce)` (RLP+keccak); `REQUEST` selector, `encRequest(resource)` / `decResponse(hex)` (hand ABI for `string[]` out and `(uint16,string,(string,string)[])` back), `getter(c, premises)`; recovery tables `PAGES` (21 `P_*()` getters), `VIA` (34 pointer routes, several deliberately duplicated as a cross-check), `EXPECTED` (54 contract names); `deploySite(c, A, {hub, pool, lease, sigil, parley?, uniswap})` (lines 473-818).
Deploy order (load-bearing): Chrome → Parley (reused on redeploy: "a new Parley would not migrate the conversation, it would end it") → Kiln → V4PositionPlanner → Locker → Venue → DeskUni → DeskTrade → Desk → Roster → DeskTalk → DeskSeal → PageSwap → PageToken → PageMarket → PagePool → PageServices → DeskTerm → PageManifest ("After DeskTerm, deliberately") → DeskRooms → Succession → Consign → DeskWill → PageTerminal → PageGallery → DeskLaunch → LaunchView → PageLaunch → PageLock → PageHook → PageCast → PageDoor → PageTalk → PageRooms → PageSeal → PageKeys → DeskEstate → PageEstate → ConsoleSkin (+N `load` tx, `freeze`) → ConsoleCore (+N `load`, `freeze`) → ConsoleRead → PageConsole → PageKey → `nameplateWillBe = predictCreate(from, nonce+2)` → PageName → Premises → Nameplate (asserted equal to the prediction). The variable-length SSTORE2 loads must sit before the nonce prediction ("The guard below caught this the first time it was put in the wrong place").
Verdict: **adapt** — keep the single deploy function + recovery tables + nonce prediction + tiling guard; the chain tables are inputs.

### 8.2 gateway.mjs
`GET` → `decodeURIComponent(url).split('/')` → `c.call(PREMISES, encRequest(segments))` → `decResponse` → `res.writeHead(status, headers)`. `POST /__rpc` forwards only an allowlist of 12 read methods (`eth_blockNumber, eth_call, eth_chainId, eth_estimateGas, eth_gasPrice, eth_getBalance, eth_getBlockByNumber, eth_getCode, eth_getLogs, eth_getStorageAt, eth_getTransactionCount, eth_getTransactionReceipt`) — "exposing admin/debug methods (or even eth_sendRawTransaction) would turn a convenience gateway into a public control plane"; `POST /__wallet` signs with hardhat dev keys and refuses any chain but 31337; body cap 128 KB; 502 on node failure; record = `dist/testnet.json` else `deployments/base-sepolia.json`. Tested by `tools/testnet-drive.mjs:40-56` (reads allowed, `eth_sendRawTransaction` and `hardhat_setBalance` refused with -32601).
Verdict: **reuse-verbatim** as the local/dev gateway; production relies on `web3://` clients or w3link.

---

## 9. Cross-cutting invariants and conventions (as enforced, with the test that holds each)

1. **Selectors are computed on chain; the browser ships no keccak and no ABI coder.** Every page/desk hashes signatures in `_sel`/`_s`; `tools/verify-site.mjs:627-681` recomputes each against keccak; `!/keccak|ethers|web3\.js/i` on the market page. The three hand-encoders that exist (`DeskTerm.ENC`, `DeskLaunch` strings, `PageKeys.enc`, `PageName` wire format) are each proven against a contract that does hash (INVARIANTS #95, #110, #111).
2. **No floating point for amounts** — `parse/fmt`, `wei/eth`; checked by typing `1.5` and asserting exactly `1500000000000000000` arrived (INVARIANTS #76).
3. **Nothing from chain becomes markup** — `Web.esc` (printable-ASCII whitelist, five entities) and `Web.jsonEsc` (also escapes `<`, `>`, `&` as `\u00xx`) on chain; `textContent` only in the clients; `ScriptToken` and eight hostile ERC-20s incl. `OffsetBombToken` (2,151M gas memory-expansion bug, fixed by validating `off == 32` before dereference, `src/lib/Web.sol:143-170`) in `tools/verify-site.mjs:217-341` (INVARIANTS #68, #69, #90).
4. **Reading is never gated; holding is never login; controls are shown and refused by the chain** (`INTERFACE.md:106-117`).
5. **Zero and no-answer are different facts** — `ConsoleRead.reported`, "not reported" strings in lanes, `PageKey._envelope`'s "unreadable, which is a different fact".
6. **`try` + `extcodesize`** for every satellite read (`ConsoleRead._live`, `PageKey` `code.length`, `Web._label` `t.code.length == 0`).
7. **One URL per resource; every response has Cache-Control** (15 s pages, 86,400 s redirects).
8. **Every page contract is read-only** — 32 contracts' ABIs checked for zero non-view functions.
9. **Config blocks are `<script type=application/json>` written with `jsonEsc`** so a `</script>` symbol cannot end them; ids: `D` (Desk/DeskUni), `X` (DeskTerm), `T` (DeskTalk), `W` (DeskWill), `Q` (PageEstate), `V` (PageLock), `J` (PageCast), `Z` (PageSeal), `K` (PageKeys and PageLaunch — different pages), `N` (PageName), `KEY` (PageKey), plus `window.CON` for the console.
10. **The signing wallet is chosen, never raced** (Chrome `IPW`; INVARIANTS #79/#99) — but see weakness: the console and `/k` bypass it.
11. **EIP-170 is the design force**: when a contract nears the ceiling, add a companion (DeskRooms/DeskWill via `TERM.def`, DeskEstate, LaunchView) — never grow the file. "Source bytes are not runtime bytes" (CONSOLE.md §H.2).
12. **Stack-too-deep is solved by splitting into private functions and memory structs**, recorded at each site (Premises `Pages`, PageDoor ×3, PageConsole `_seed`/`_sels`, `MarketView`).
13. **The naming tables are held equal by a test** (`verbWord` vs `WORDS`; `window.DOORS` derived from anchors; `EDITION` vs `BANDS`; `ROUTES` vs the router).

---

## 10. ERC standards touched by this area
ERC-5219 (contract-as-HTTP-resource: `request`), ERC-6860/ERC-4804 `web3://` and ERC-6944 `resolveMode` (`"5219"`), ERC-6821 `contentcontract` + ERC-3770 chain-scoped addresses (via Nameplate; pages explain), ERC-137 `addr` fallback, ERC-6963 wallet discovery, EIP-3326/EIP-3085 chain switching, EIP-2612 permit (PageLock), EIP-712 typed data (`eth_signTypedData_v4`), ERC-1271 (`0x1626ba7e`, vault/verify page), ERC-6551 (Reach/Grip addresses, session keys), ERC-4907 (user/renter semantics on the rent pages), ERC-5192 (bound/soulbind), ERC-7160 (faces page, `/face/<n>`), ERC-721 Enumerable (`tokenOfOwnerByIndex` holding check), ERC-20 (symbol/decimals/balance/allowance/approve), Uniswap v3 (QuoterV2, SwapRouter/SwapRouter02, factory, NonfungiblePositionManager selectors) and v4 (PoolManager `initialize`, hook address bits, PositionManager via planner, Permit2), ENS (DNS wire names, ENSIP-10 wildcard, registrar renew), WebCrypto P-256 ECDH + AES-256-GCM (not an ERC), LayerZero V2 tables in `site.mjs`. Explicitly **not** claimed: any "services manifest" standard (`ipseity.services/2` is self-declared), ERC-7857 (see `interfaces/Standards.sol`, outside this area).

---

## 11. Testing and tooling for this area
- `tools/verify-premises.mjs` — 30 assertions (`README.md:1306`).
- `tools/verify-site.mjs` — 3,195 lines; latest recorded run **586 passed** (commit "The expiry clock outlives the wildcard claim"); earlier milestones 324 → 392 → 422 → 550 → 557 → 580 → 584 (`DEPLOYMENTS.md`, git log). Sections: escaping (ScriptToken), eight hostile ERC-20s, 34 routes, ERC-6860 word, one-URL, manifest `/2` (every selector vs keccak; `rent.use`; `session`; `mint`; `deskTerm`; `parley.invoke`; routes incl. `/c/<id>` and `/k/<id>/<key>`; every advertised route answers), `/k` envelope + 301 + 404, config selectors (12 pool + 8 lease), the picker, and a hand-rolled DOM shim (`tools/verify-site.mjs:886-1080`) that mounts each page, runs its scripts against a provider wired to the in-process EVM and drives: the swap card ("1 WETH in, the card says … USDC"), the holder's side, the rental counter, the commons ("every one of them asked for exactly one block"), a DM, the terminal (`TERM.run('mint'|'say …'|'launch …'|'lockup …')` with chain assertions), the Uniswap card on both router shapes, the launchpad, the seals, rooms/roster, the estate, session keys ("the account permits exactly the selector that was chosen"), the name page, the vault, the nameplate, the sealed DM ("derived from a signature, sealed with WebCrypto, bytes to everyone else"), the projector, renting/books solvency, and the read-only ABI sweep.
- `tools/verify-console.mjs` — 534 lines; latest **58/0** (INTERFACE.md says 55): naming tables; ConsoleRead bits against codeless satellites; routes; walk never in a contract-written URL; no iframe / single `/live` link / still as a route reference; `:root{--h:…}` recomputed from `sectionOf`; seven rows and identity server-rendered; `engine/ipseity.html` `LANDING = () => "/c/" + S.id` and `top.location.href`; then **Playwright Chromium** at 420×900 with a stub `window.ethereum`: no page errors, body visible, HELD → "you", lane not asking to connect, controls painted, slab raised, nothing sent before the press, exactly one after; wrong chain 9999 → crest names it, no slab, nothing sent; mint refuses without a price; LOOK chip navigates to `/c/<n>#w=1:<hue>` with two `.sub` rules and two crumbs.
- `tools/gas.mjs` — budgets every artwork read and 22 site routes against 10/30/50/100M caps; fails the build over 50M.
- `tools/verify-recover.mjs` — reads a deployment back through `PAGES`/`VIA`/`EXPECTED`.
- `tools/testnet-drive.mjs` — gateway refusals + a Chromium journey against `hardhat node` + `gateway.mjs`.
- `tools/preview-site.mjs` / `site-viewer.mjs` — dump every route to `dist/site/` and bind them into one viewer with per-route gas.
- No Solidity `.t.sol` covers this area (the 8 suites are Ipseity, Lease, Locker, Mul, Parley, Pool, Timelock, V4PositionPlanner). CI (`.github/workflows/ci.yml`) runs `npm run check` (26 steps, incl. the three verifiers above) with Chromium installed.

---

## 12. Measured numbers (sources named)
- Runtime bytes (`out/solc.json`, 2026-10-02): DeskTerm 23,908 (97.3%); PageLaunch 23,494 (95.6%); Desk 23,401 (95.2%); Chrome 23,310 (94.8%); PageManifest 23,105 (94.0%); PageName 21,567; DeskTalk 20,422; PageConsole 19,252; PageMarket 18,917; PageKeys 18,868; PageServices 17,789; PageSwap 17,523; DeskUni 17,328; DeskLaunch 17,079; PageToken 16,273; PageLock 15,541; PageDoor 15,388; Premises 15,372; PageEstate 14,982; PagePool 11,961; DeskEstate 11,686; PageSeal 11,324; PageKey 11,275; PageTalk 10,193; DeskWill 9,546; PageRooms 9,008; DeskTrade 7,669; PageCast 7,610; PageHook 6,620; PageGallery 4,857; DeskSeal 4,783; ConsoleRead 3,408; PageTerminal 3,252; LaunchView 2,226; DeskRooms 2,106; ConsoleSkin 1,807. Ceiling 24,576.
- Engine files: console.js 16,573 B; console-lanes.js 23,060 B; console.css 18,359 B (deployed as 1 CSS shard + 2 JS shards of ≤24,000 B).
- Gas (past `tools/gas.mjs` run, `README.md:973`, `tools/site-viewer.mjs`): `/token/1/live` 4.48M / 54,432 B; `tokenURI()` 19.99M / 103,808 B; `/` ≈ live; `/door` 0.31M; `/chat` 0.23M; `/rooms` 0.24M; `/room/1` 0.29M; `/dm/2` 0.24M; `/token/1` 0.17M; `/token/1/market` 0.28M; `/token/1/pool` 0.25M; `/token/1/rent` 0.25M; `/token/1/vault` 0.18M; `/open` 0.08M; `/token/1/sigil.svg` 3.32M; `/services.json` 0.11M; `/token/1/services.json` 0.17M; the old iframed counter 21M. `/estate` 36,792 B.
- Constants: `Cache-Control` 15 s / 301s 86,400 s; `PAGE` 24 (market dir, manifest), `PICK` 40, `PER_PAGE` 24, `SCAN` 32, launch `PAGE` 20; `MAX_LABEL` 32; `decimalsOf` stipend 30,000 gas, `_label` 50,000; Parley `MAX_BODY` 1,024, `MAX_NAME` 48, `COMMONS` 0; account `MAX_LIST` 16, `MAX_SESSION` 365 d; `PageSeal.MAX_DAYS` 365; estate 30/3650/7/365/730 d, cut ≤ 5,000 bps; Locker `MAX_TERM` 3,650 d; fee cap 500 bps; `DYNAMIC_FEE` 0x800000; mining window 60,000 × 12 at 30M gas; quoter call 30M gas; held-token scan cap 64; locks list cap 50 (page) / 12 (terminal); roster window 256; chat poll 9 s; receipt watch 4 s × 45; `MAX_DEPTH` 3; 22 px per walk level; crest 46 px, column 300 px, command line 36 px; ticker fade at 7 s; debounces 220/250/260 ms.
- Deployments (JSON is the truth; `DEPLOYMENTS.md` "Live now" lags): Ethereum Sepolia `deployments/eth-sepolia.json` — Premises `0x7e1bdcd82e2a1d197f5792ff41e6548e01ad7a31`, PageConsole `0x975579ec6b68d80775de944947e7915c697504a2`, ConsoleRead `0x6ce50463…`, ConsoleSkin `0x5a3b9f9c…`, ConsoleCore `0xf2b94a81…`, PageKey `0xc8eaa59e…`, Chrome `0xca5cd3b4…`, Desk `0x274c041a…`, DeskTerm `0xaac2eda9…`, DeskTalk `0x2766280c…`, Parley `0x99f5d809…`, 9 holders; `web3://0x7e1b…7a31:11155111/`. Base Sepolia `deployments/base-sepolia.json` — Premises `0xc59f75d298ebf81551aab8d0aa8026b19bf83161`, PageConsole `0x3a2757f9…`. Deploy cost: ~136–138M gas across ~35 tx per chain (`DEPLOYMENTS.md:435, 513`); earlier site-only runs 68.41M.
- Counts: 20 page contracts + 10 desks + Chrome + Premises + ConsoleRead + 2 ConsoleSkin = 35 site-only runtime contracts (44 in `deploySite` incl. Parley, Roster, Kiln, Planner, Locker, Venue, Nameplate, Succession, Consign); 54 names in `EXPECTED`; 21 routes in `ROUTES`; 46 terminal words; 7 verbs; 6 manifest services; 12 pool + 8 lease + 53 terminal + 23 talk + 50 uni selectors emitted.

---

## 13. Known weaknesses, TODOs, drift
1. **Two interfaces, one site.** The flat pages (19 routes, Chrome's serif/gold language) and the console (`/c`, mono/hue) are both live; the spec's redirects and Chrome retirement did not ship. A newcomer at `/door` is sent to `/c`; `navTop` sends them back out.
2. **Console lanes are thin** (TRADE/SPEAK unbuilt; HAND = transfer only; MAKE = mint only) — the fill exists on `origin/claude/claude-md-docs-8vvyc8` and is unmerged (also unmerged there: cross-chain SPEAK via the port, `+82` lines of ConsoleRead, Base Sepolia deployment of the full console).
3. **Four contracts are within 2–6% of EIP-170** (DeskTerm, PageLaunch, Desk, Chrome, PageManifest). Every further feature needs a companion contract; the `go` map and `DeskUni._selCivic` dead weight are the obvious bytes to reclaim.
4. **Wallet discovery is inconsistent**: Chrome/Desk use the EIP-6963 chooser; `console.js`, `console-lanes.js` and `PageKey.KEY_JS` use `window.ethereum` only, so INVARIANTS #99 ("the signing wallet is chosen, never raced") does not hold on the console or the key door.
5. **`DeskEstate` listens for `ip:account` and nothing dispatches it** — the estate page does not refresh on account change.
6. **Unlimited approvals** on the flat swap/pool cards (`(1n<<256n)-1n`); the unmerged console branch moved to exact-amount approvals ("Never unlimited").
7. **Stale docs**: `README.md:1026-1050` size table (Chrome 13,816, "nine contracts serving the site"), test counts (`verify-site` 395 vs 586), `README.md:162` and `INVARIANTS.md` #106 still describe the deleted door tesseract (`window.TESS.doors`, `TESS_JS`) while #147 records its deletion; `CONSOLE.md` §E.5 still describes a five-chain partition after `fe990f7` made the edition Ethereum-only; `AGENT.md:294` still says `ipseity.services/1`.
8. **`/rooms` cannot be server-rendered** (needs the speaking token); the console's SPEAK lane would inherit the same limit.
9. **DeskTrade's limit-order client is prose** (lines 150-204 describe `POS_JS` that does not exist); `DeskUni._selPos` selectors are unused.
10. **Console gas is unmeasured** (`tools/gas.mjs` has no `/c` row; spec estimate 0.6–1.2M). `doc()` uses repeated `string.concat`; the spec's "single `bytes.concat` over a pre-sized buffer" rule (§H.6) is not followed.
11. **Nothing audited** (`MAINNET_READINESS.md`; every page says "Nothing here has been audited").
12. **No Solidity tests for the site**; all coverage is the JS harness + Playwright, which is strong on behaviour but has no coverage tooling.
13. The `/c` bare route 404s before the first mint; `/` falls back to `/door` — inconsistent.
14. `PageKey` and `PageKeys` both use `K`/`KEY` ids; `PageLaunch` also uses `id="K"` — no page carries both, but a future merge of pages would collide.

---

## 14. Branch notes (not merged into the default branch)
- `origin/claude/claude-md-docs-8vvyc8` (6 commits, 2026-08-23/24): fills the console lanes (+692 lines `console-lanes.js`), `PageConsole` +135, `ConsoleRead` +82, `verify-console` +313, `tools/site.mjs` +8, `redeploy-site` +12, docs. Directly relevant; should be the base for any console reuse.
- `origin/codex/list-nft-functions-and-suggest-upgrades-hciyvv` (2 commits, 2026-09-18/19): a larger v4 position lifecycle (`GateFacet.sol`, +272 `V4PositionPlanner`, +115 `LaunchView`, `PageLaunch` restructured, manifest +3, `Site.sol` +2) — superseded in part by the merged `6b89a86`.
- `origin/codex/fix-issues-from-codex-review-#31`: Facet fee sync exposure in DeskLaunch/PageLaunch (unmerged).
- Several `codex/propose-fix-*` branches touch `DeskSeal.sol` and `tools/site.mjs` (custody/ENS fixes); the default branch already carries the merged versions of most (`git log` shows PRs #9–#40 merged).

---

## 15. Reuse summary relative to the GOAL

| component | verdict | why |
|---|---|---|
| Premises (ERC-5219 router, `resolveMode`, artwork-never-through-a-page, one-URL, 404-not-revert) | adapt | the exact "the NFT mints a website" mechanism; only the route table changes |
| PageConsole + ConsoleRead + ConsoleSkin + console.js/lanes/css | adapt | the per-token control room with wallet-aware controls; take the unmerged lane fill; add EIP-6963 |
| PageManifest (`services.json`) | adapt | agent-readable shopfront with on-chain selectors; extend to swap/social/launch/vault services |
| DeskTalk + PageTalk + PageRooms + DeskSeal | adapt | the messaging/social layer client: indexer-free walk, token-as-identity, sealed DMs |
| DeskTerm + DeskRooms + DeskWill + PageTerminal | adapt | agent/human single code path; regenerate words; keep companion-contract registration |
| Desk + PageMarket + PagePool | adapt | per-token AMM client (the "swap" inside the NFT); exact-amount approvals from the branch |
| DeskUni + DeskTrade + PageSwap | adapt | external Uniswap tab; drop dead selector tables; keep router-kind and derived asset list |
| DeskLaunch + PageLaunch + LaunchView + PageHook | adapt | launchpad client incl. hook mining by eth_call and planner-encoded liquidity |
| PageLock, PageServices (vault page), PageKeys, PageKey | adapt | vault/session-key surfaces; `/k/<id>/<key>` is the agent door |
| PageDoor, PageToken, PageGallery | adapt | content survives; render in the console's language; `window.DOORS` one-source pattern |
| PageCast | reuse-verbatim-able | self-contained, depends only on a `pure` renderer |
| PageName, PageEstate, DeskEstate, PageSeal | adapt (conditional) | only if ENS binding / succession+consignment / the three seals are kept in the merge |
| Chrome | rewrite | one shell only; the console's stylesheet should win; 94.8% of the ceiling |
| Site.sol | adapt | keep the shared-read-interface + memory-struct practice |
| tools/site.mjs | adapt | deploy order, nonce prediction, tiling guard, recovery tables |
| tools/gateway.mjs | reuse-verbatim | the dev/local gateway and its read-only RPC relay |
| CONSOLE.md / INTERFACE.md | reuse as design input | the owner's rulings and the refusal lists are decisions already taken |

