# Design C — product-first, differentiation-first

Architect C. Lens: start from what a holder sees and does, and from what an AI agent does with the same token; derive the contracts from that; keep only features that earn their bytes. Every contract names its origin file; every number is either measured in a dossier or marked as an estimate.

---

## 1. Thesis and name

A holder mints one ERC-721 and gets a **place**, not a picture: the token's own metadata *is* a web app, served from contract bytecode, that opens inside any marketplace as a viewer and on `web3://` as a working console. Connecting a wallet does not log anyone in; the page asks the chain who the wallet is to this token (`rightsOf`) and renders the controls that answer, while every write is enforced by the contract it goes to. Inside that place the holder runs a market whose sole liquidity provider is whoever holds the token, speaks from an archive the chain itself indexes, launches coins whose fee streams pay the token's own wallet, keeps assets in two accounts (one that acts under a measured seal, one that structurally cannot spend), delegates bounded session keys to agents, and sells the whole bundle — exchange, fee streams, inbox, vault — in one transfer that revokes every authority the seller ever granted. Nothing is hosted, nothing is upgradeable, and the protocol's one invariant is custody: *whatever is inside the token travels with it, and nothing the previous holder did survives the sale.*

**Name: KEEP.** A keep is the inner stronghold of a castle: the place you live, the place you store what matters, and the place you defend. It is also the verb of custody — you *keep* the exchange, *keep* talking, *keep* the fee stream, and selling the keep sells everything inside its walls. One syllable, readable in a URL (`web3://keep.eth/token/7/live`), and it names the invariant rather than the technology. A token is "a Keep"; the two accounts are "the Reach" and "the Grip" (both names are already in the code and well argued); the site is "the Premises".

---

## 2. Contract inventory

26 deployable contracts (plus one per-launch `Coin` instance deployed by the Kiln, counted once as the implementation). Sizes are runtime-byte **budgets**; where an origin file's measured size is known it is given in brackets. Authority vocabulary: *holder* = `ownerOf(id)`; *Reach* = `account(id)`; *actor* = holder **or** Reach (the one speech/launch/market predicate); *module* = an address pinned in the hub's constructor; *anyone* = any gas payer.

| # | Contract | Origin | Budget | Responsibilities | Who may call what |
|---|---|---|---|---|---|
| 1 | `Keep` | adapt `Most-Advanced-NFT-Possible/src/Ipseity.sol` (19,316) skeleton + `Cutting-edge…/contracts/core/AnimaAgent.sol` `_update`, epoch-keyed approvals, counted locks, fingerprint + `Pixel-Garden/src/PixelGardenKernel.sol` `custodyEpoch`, `isCanonicalAccount` | ≤ 23,000 | ERC-721/Enumerable/2981/4906/4907/5192/5646/5169/6454/7160/7496/7572; mint with both 6551 accounts; `custodyEpoch`; `rightsOf`; `panic`; guardian; fee-sink bit; module locks; `tokenURI` delegation | `mint`: anyone (payable). `setUser/setGuardian/setFeeSink/pinFace`: holder. `panic`: holder or guardian. `lock/unlock/moduleTransfer`: pinned modules only. `revokeAllApprovals`: any owner for themselves. Curator (behind `Timelock`): `setRenderer` until `sealRenderer`, `setPrice`, `setRoyalty`, `withdraw` |
| 2 | `Reach` | adapt `src/IpseityAccount.sol` (13,461) + `AgentAccount.sol` `grantedBy`/`state()`/`EmptyBatch` + branch `koorbx` `grantScopedSession` | ≤ 18,500 | acting ERC-6551 account: measured seal, manifest/pieces, `execute`/`executeBatch` (CALL only), four-way-bounded session keys, exact-calldata scoped grants, per-asset ERC-20 caps, open-approval ledger, domain-separated ERC-1271 attestations | `onlySigner` = `ownerOf` exactly for every grant/seal/execute; session keys via `executeAsSession` only; anyone may read |
| 3 | `Grip` | reuse-verbatim `src/GripVault.sol` (1,933) / `Pixel-Garden/src/accounts/GripAccount.sol` | 2,000 | receive-only ERC-6551 account; `isOneWay()`; no execute/withdraw/approve/1271 | nobody may spend; anyone may send |
| 4 | `Steward` | adapt `src/Succession.sol` (6,457) | ≤ 9,000 | succession (quiet → notice → pass) and guardian recovery (≥ 2-of-N → notice → pass) through `Keep.moduleTransfer`; ERC-7878 `getWill/getObit` | `arrange/revoke/stillHere`: holder. `summon`: anyone after `quiet`. `recover`: named guardians. `claim`: anyone after `notice` |
| 5 | `KeyRegistry` | reuse-verbatim `contracts/core/EncryptionKeyRegistry.sol` (1,783) + epoch binding from `Parley.announce` | ≤ 3,000 | typed public keys (X25519/secp256k1/P-256/ML-KEM slot) keyed by token (owner-bound) and by address; `keyIdOf`; ERC-7627 view | `setKeyFor(tokenId)`: actor; `setKey()`: any address for itself |
| 6 | `Engine` | reuse-verbatim `src/Engine.sol` (2,724) | 2,800 | gzip SSTORE2 shards of the app, head/body with a state gap, `freeze()` one-way | curator until frozen; anyone reads |
| 7 | `Renderer` | adapt `src/Renderer.sol` (20,747) | ≤ 19,000 | `document(view)` = head ‖ state ‖ INFLATE loader ‖ body; three faces; JSON + attributes; `contractURI`; trait schema | hub and Premises call it; stateless |
| 8 | `StateBlock` | adapt `src/ConsoleRead.sol` (3,408) + `src/Desk.sol` `_sel` config block | ≤ 12,000 | builds `window.KEEP={…}`: addresses, on-chain-hashed selectors and error selectors, clocks, `reported` bits from every satellite behind `extcodesize` **and** `try/catch` | view only |
| 9 | `Card` | new, technique from `src/Sigil.sol` | ≤ 8,000 | ≤ 8 KB SVG still: id, holder (truncated), epoch, "sealed until", "market open/bonded", launches; face 1 and `image` | view only |
| 10 | `Premises` | adapt `src/Premises.sol` (15,372) | ≤ 16,000 | ERC-5219 router, `resolveMode()="5219"`, route table in §4, artwork routes served by itself, one URL per resource, 404-not-revert, zero state | view only |
| 11 | `Manifest` | adapt `src/PageManifest.sol` (23,105) | ≤ 22,000 | `/services.json`, `/token/<id>/services.json`, `/.well-known/agent-registration.json`, `/.well-known/agent-card.json`, `/llms.txt`, `/manifest` (route hashes), collection landing | view only |
| 12 | `Pool` | adapt `src/Pool.sol` (11,626) + `src/lib/Curve.sol` | ≤ 17,000 | one owned market per token (holder sole LP) **and** sealed markets created by `Launch` (no LP authority, fees to the token's account); anchored virtual reserves; native ETH; bond ratchet; sniper fee; `swapExactOut` | owned markets: actor. `swap*`: anyone. `openSealed`: `Launch` only. `collect`: anyone (pays the beneficiary) |
| 13 | `Router` | adapt `Pixel-Garden/src/cartridges/MarketCartridge.sol` v3/v4 paths + `AgentSwapRouter.sol` rules | ≤ 19,000 | ownerless router to constructor-pinned external venues (Uniswap v3 SwapRouter02; hookless v4 keys); codehash check per call; exact-approve-then-zero; balance-delta output | anyone; no owner |
| 14 | `QuoteLens` | adapt `MASTER…/integrations/official-launch/src/OfficialV4QuoteLens.sol` | ≤ 5,000 | quote-by-revert through the real settlement path: `QuoteResult(spent, received)` | view (via `eth_call`) |
| 15 | `Parley` | adapt `src/Parley.sol` (6,379) | ≤ 9,000 | back-linked log messaging: commons, **home room per token** (derived, zero gas), groups, pairs; reply pointer; steward cooldown; `heads`; `topics()` | writes: actor (`mayActAs`), never renter/operator; `setCooldown`: room steward |
| 16 | `Roster` | reuse-verbatim `src/Roster.sol` (3,267) | 3,400 | 256-bit membership/invite bitmaps; `NO_ROOM` disambiguation | view only |
| 17 | `Inbox` | adapt `contracts/comms/AgentComms.sol` (7,368) | ≤ 9,500 | priced attention: postage (native or ERC-20) escrowed on `send`, released to the token's account on `reply`, refunded after `replyWindow`; ≤ 1,024-byte bodies as logs; per-token paged ids | `configure`: holder (epoch-stamped). `send`: anyone or any actor. `reply`: actor. `refund`: anyone after window |
| 18 | `Kiln` | adapt `src/Kiln.sol` `Kiln` (13,709) | ≤ 14,500 | CREATE2 coin factory (supply to the Reach), `mine()` hook salts as a view, `deployHook` with `WrongFlags`, `coinAt`, `recent` | `launch`: actor; `deployHook`: actor; views: anyone |
| 19 | `Coin` (impl, one per launch) | reuse-verbatim `contracts/market/AgentToken.sol` (5,369), quote made native | ≤ 6,000 | fixed-supply ownerless ERC-20 + Permit + burn-to-redeem treasury floor (`contribute{value}`, `redeem`, `floorPerToken`) | `contribute`: anyone; `redeem`: any holder of the coin; no mint |
| 20 | `Launch` | adapt `contracts/market/AgentLaunchpad.sol` (16,396) | ≤ 18,000 | bonding-curve raise in native ETH with buyer **credits** (no ERC-20 moves before graduation), time-decaying snipe tax → coin floor, fee legs pinned at creation, `graduate` into `Pool.openSealed`, `fail`/refund | `create`: actor (one live launch per token, 7-day spacing). `buy/sell`: anyone. `graduate/fail/claim/refund`: anyone |
| 21 | `GateFacet` | adapt branch `codex/…-hciyvv` `src/GateFacet.sol` + PR #36 `syncFee(expected)` | ≤ 5,000 | immutable Uniswap v4 hook: trading opens at T1, liquidity locked (negative deltas only) until T2, fee band | PoolManager only (`onlyPoolManager` on every entry) |
| 22 | `Planner` | adapt branch `hciyvv` `src/V4PositionPlanner.sol` (5,928) | ≤ 6,500 | view that returns canonical `modifyLiquidities` calldata; authority `mayActAs`; PoolKey from PositionManager; StateView pricing | view only |
| 23 | `Locker` | reuse-verbatim `src/Locker.sol` (2,850) | 3,000 | ERC-20 time-lock, no early exit, `extend` longer only, `give()` into a Reach | `lock`: anyone; `claim/extend/give`: the lock's holder |
| 24 | `Market` | new, from `AgentMarket.sol` fingerprint pin + `src/Consign.sol` pull-payment + Pixel-Garden inventory floors | ≤ 10,000 | on-chain listing of a Keep: `list` locks the token (no escrow, no standing approval) and requires the Reach sealed to expiry; `buy(id, agreed, fingerprint)` re-checks ERC-5646; royalty first; pull `owed` | `list/delist`: holder. `buy`: anyone. `withdraw`: payee |
| 25 | `Nameplate` | adapt `src/Nameplate.sol` (9,957) | ≤ 10,000 | ENS resolver on the mainnet band: custody-is-binding, ERC-6821 `contentcontract`, ENSIP-10 `<id>.keep.eth` wildcard | `bind*`: name owner who holds the token; reads: anyone |
| 26 | `Timelock` | reuse-verbatim `src/lib/Timelock.sol` (1,675) | 1,700 | 7-day delay / 14-day grace in front of every curator function from block one; admin rotates only through its own queue | curator proposes; anyone executes after delay |

Libraries (not deployable): `SSTORE2`, `Base64`, `Web` (`esc`/`jsonEsc`), `Mul`, `Curve` (anchored math, no art tables), `Hook`, `Tick`, `LibNum` (IPSEITY, verbatim); `ExactERC20`, `ERC6492` (ANIMA, verbatim); `AccountBinding` (Pixel-Garden, verbatim; salts renamed `keep.reach.v1` / `keep.grip.v1`). Mocks: IPSEITY `test/mocks/*` (`MockPoolManager`, `SealBreaker`, `Permit2ish`, `PoolReenter`, hostile tokens) and ANIMA `MaliciousSeller`, `MockTaxERC20`.

**Cut, and why.** `RevenueRouter` (a fee-sink bit on the hub does the one job holders want); `Lease` (a renter cannot speak, swap or launch, so renting a Keep buys nothing — revisit when a rentable right exists); `AnimaRoles`/ERC-7432 (the 4907 user, session keys and the delegate.xyz read cover delegation); `BondVault`, `ReputationRegistry`, `ValidationRegistry`, `WorkEscrow`, `InferenceMeter`, `AgentDerivativesDesk` (no hire flow in v1); `ParleyPort` and all LayerZero code (no federation in v1; `OMNICHAIN.md` is the decision record); `MLSGroupChat` (COULD; `ts-mls` unaudited); every `Page*`/`Desk*`/`Chrome` contract (one document replaces the flat site); `Sigil`, `Trig`, WebGL field; RAILGUN worker; ERC-4337 and passkeys (SHOULD/COULD, not v1).

**If `Keep` exceeds 23,000 bytes at unit 3**, it becomes ANIMA's immutable EIP-2535 diamond (`AnimaDiamond.sol` 177 B, no `diamondCut`, `deriveFacetCut` strict) with three facets (core, custody, mint) and the loupe: +4 deployables, 30 total, no change to any other contract. This is a size decision, not an upgradeability one; the diamond has no owner over its routing table.

**If EIP-7954 (64 KiB) reaches the target chain**, nothing merges back; the budgets above simply stop being the design force and `StateBlock` folds into `Renderer`, `QuoteLens` into `Router`. The shard store does not change (Solady's `SSTORE2` already reads 65,534-byte pointers), so the app could ship as one shard.

---

## 3. The token

### 3.1 Mint

`Keep.mint(address to) external payable returns (uint256 id)` — one transaction, one bundle, in this order:

1. `if (msg.value < price) revert Underpaid();` `if (local >= BAND_SIZE) revert SoldOut();` — price and the `treasury` address sit behind `Timelock`; no allowlist, no rarity from `block.*`.
2. `id = BAND_BASE + (++local)`; counters move **before** any external call (`nonReentrant` via one hashed transient slot).
3. `_mint(to, id)` with no receiver callback yet; `custodyEpoch[id] = 1`; `statusOf[id] = Active`.
4. `REGISTRY.createAccount(REACH_IMPL, REACH_SALT, chainid, this, id)` then the same for `GRIP_IMPL/GRIP_SALT` through the canonical registry `0x000000006551c19487814612e58FE06813775758`, whose runtime hash `0xda1d…6735` the constructor checked. Both addresses are pure functions of the token, so `account(id)`/`grip(id)` were already correct before this step; deploying them at mint is a product decision — the vault page works and wallets discover the account on the first visit.
5. `accountReady[id] = true`; `emit Minted(id, to, reach, grip)`.
6. Only now the ERC-721 receiver check (`_checkOnERC721Received`) runs, so a contract minter sees ready accounts and cannot re-enter a half-built token.

Nothing else is opened at mint. The owned market, the home room, the inbox and the steward all cost zero until the holder uses them: the home room key is derived (`keccak(3, id)`), the inbox defaults to "closed, no postage", the market is `open=false`. **Gas estimate**: ERC-721 mint ≈ 60k + two canonical `createAccount` (Pixel-Garden measured 299,485 for a mint creating both) → **≈ 300,000–330,000 gas** ≈ $0.004 on Base at 0.01 gwei, ≈ $0.80 on mainnet at 0.5 gwei.

### 3.2 `_update` — the custody roll

Sealed non-virtual, taken from `AnimaAgent._update` (line 729) and Pixel-Garden's epoch, applied on every owner-to-owner transfer (not on mint; burn does not exist — `to == address(0)` reverts):

- refuse `to ∈ {address(this), account(id), grip(id)}` and any address whose `AccountBinding.token()` names this collection (`OwnershipCycle`), and `to` with code only after a depth-2 `onERC721Received` walk (both IPSEITY #109 and the 6551 cycle section);
- refuse while `lockCount[id] != 0` (`IsLocked`; ERC-5192/6454 report it);
- `custodyEpoch[id] += 1` (uint64, checked, never wraps);
- `delete _user[id]` (ERC-4907), `delete guardianOf[id]`, `delete boundWalletOf[id]` (ERC-8004 agent wallet), `feesToGrip[id] = false`, `pinnedFace[id] = 0`, `statusOf[id] = Paused`;
- emit `CustodyRolled(id, epoch, from, to)`, `UpdateUser(id, 0, 0)`, `MetadataUpdate(id)`.

Everything else dies by **reading the epoch**, not by being cleared: Reach sessions and scoped grants store the epoch they were granted under; Steward plans, Inbox configuration and allowlists, KeyRegistry token keys, Parley cooldown buckets and Launch rate limits all store `(id, epoch)` and compare live. Away-and-back revives nothing (ANIMA's `RevenueRouter` bug, fixed by epoch stamping, is the regression test). What **survives**: the seal (ratchet), the bond (ratchet), Locker locks whose holder is the Reach address, sealed-market fee streams (paid to `account(id)`, whoever holds it), the public archive and home-room history, Grip and Reach contents. That is the whole "selling sells the bundle" guarantee in two lists.

`panic(id)` — holder or guardian: `custodyEpoch[id] += 1` (every delegated right dies), `approvalEpoch[owner] += 1` (every ERC-721 operator of that owner dies in O(1); approvals are keyed `keccak256(owner, approvalEpoch[owner], operator)` and `isApprovedForAll` reads that store), `Reach.sealBy(MAX_SEAL)` (a hub-only entry on the Reach), `statusOf = Paused`, `emit Panicked(id, epoch)`. It is the button a drained holder wishes they had, and it is one call.

### 3.3 Rights, not login

```solidity
uint16 constant R_HOLD=1; R_ACCOUNT=2; R_USE=4; R_CUSTODY=8; R_SESSION=16; R_DELEG=32; R_GUARDIAN=64;
function rightsOf(uint256 id, address actor) external view returns (uint16 bits, uint64 epoch, address holder);
```
HOLD = `ownerOf`; ACCOUNT = `account(id)`; USE = live ERC-4907 user; CUSTODY = `getApproved`/epoch-keyed `isApprovedForAll` (transfer only, never spend); SESSION = `Reach.sessionCurrent(actor)`; DELEG = delegate.xyz v2 `checkDelegateForERC721` read behind `extcodesize` + `try/catch` (absent on a band → bit clear, never a revert); GUARDIAN = `guardianOf`. The page renders from the bits; every contract re-derives its own predicate. There is no SIWE, no nonce, no cookie; closing the tab is logout.

### 3.4 ERC-5646 fingerprint

`getStateFingerprint(id) = keccak256(abi.encode(KeepCore))` where `KeepCore` is a normative, append-only struct: `{owner, custodyEpoch, user, userExpires, guardian, lockCount, status, reachState (Reach.state()), sealedUntil, approvalsRoot (Reach open-approval ledger), pool.open, pool.bondUntil, pool.feeBps, launchCount, stewardPlanHash, feesToGrip, pinnedFace}`. Balances are deliberately excluded (inbound transfers must not break a trade); `Market` orders carry explicit balance floors instead (Pixel-Garden's inventory digest). Reverts for a nonexistent token. A test mutates every field once and asserts the hash moved.

### 3.5 `tokenURI`

Face 0 (default) is a `data:application/json;base64` document: `name` "Keep #id", `description` (one fixed sentence), `image` = `data:image/svg+xml;base64` from `Card`, `animation_url` = `data:text/html;base64` of `Renderer.document(view)`, `external_url` = `web3://<premises>:<chainid>/token/<id>/live`, attributes (`custody epoch`, `sealed until`, `market`, `bonded until`, `launches`, `inbox postage`, `agent status`, each also an ERC-7496 trait; `bonded until` and `sealed until` marked `validateOnSale`). `scriptURI()` (ERC-5169) returns the same `web3://` URL. Face 1 = the SVG card alone (for cautious clients); face 2 = the ERC-8004 `registration-v1` JSON (§9). ERC-7160: the holder may `pinFace(id, n)`; the pin resets on sale. Budget: face 0 ≤ 80,000 bytes and ≤ 12,000,000 gas (IPSEITY's ~104 KB document with its WebGL faces reads at 19.99M; a 45–50 KB gzip body plus a 4 KB state block should read in roughly 9–11M — measured at unit 4 and gated in CI).

---

## 4. The website

### 4.1 Bytes

One document, built once, frozen forever: `engine/keep.html` (source ≤ 180,000 bytes) → terser (toplevel mangle, `reserved: ["KEEP"]`) ≤ 110,000 → gzip ≤ 48,000 bytes → 2–3 SSTORE2 shards in `Engine.body`; `Engine.head` holds the 300-byte plain prologue (`<!DOCTYPE html><html><head><meta charset=utf-8><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src *">…`). `Renderer.document(view)` returns `head ‖ <script>self.$KEEP=[<quoted state>,"<base64 gzip>"]</script> ‖ INFLATE ‖ (nothing)`. The INFLATE loader is IPSEITY's verbatim (`Renderer.sol:50-60`): an async IIFE that reads `self.$KEEP`, deletes it, inflates with `DecompressionStream("gzip")`, splices the state script before `</head>` and `document.open()/write()/close()`s — declaring **nothing** at global scope, because `document.open()` keeps the Window and a loader `const` once collided with the minified engine and rendered every token black while 900 assertions passed. `verify.mjs` greps the loader for lexical declarations and fails the build.

The **state gap** is the contract between chain and app. `StateBlock.state(id)` returns the bytes of `window.KEEP = {id, chain, hub, premises, renderer, owner, epoch, reach, grip, pool, router, parley, roster, inbox, kiln, launch, locker, steward, market, keys, nameplate, rights:{…}, clocks:{sealedUntil, bondUntil, userExpires, marketOpen, feeBps, postage, replyWindow, launches, planState}, reported: <uint16>, sel:{ swap:"0x…", speak:"0x…", … ≈ 60 entries }, err:{"0x…":"NotHolder", …}, topics:{said:"0x…", …}, block}`. Every selector and topic is `bytes4(keccak256(sig))` computed **on chain**, every string passes `Web.jsonEsc` (so a `</script>` in a coin symbol cannot end the block), and the browser ships no keccak, no ABI coder and no floating point for any amount — IPSEITY's `Desk.CORE_JS` discipline, carried whole.

### 4.2 Two surfaces, one byte stream

- **`tokenURI` → `data:` (the viewer).** Opaque origin: no EIP-6963 announcements, `localStorage` throws (the app uses that as its sandbox detector), nothing can be signed. The app boots in **viewer mode**: crest, every panel read-only through a public RPC the state block names per band (`credentials:"omit"`), and a prominent "Open live" card showing `web3://<premises>:<chain>/token/<id>/live`, an `https://` gateway twin (`w3link.io` for Base and mainnet) and a QR code the page draws itself in SVG (≈ 3 KB of JS, no dependency). It can be looked at and not used, and it says so.
- **`web3://…/token/<id>/live` (the console).** `Premises.request(["token","<id>","live"])` returns `Renderer.document(view)` byte-for-byte as `text/html` — the identical document on a real origin, for roughly a fifth of the gas (IPSEITY measured 4.48M vs 19.99M) because there is no double base64. Here wallets inject, EIP-6963 works, and every control renders. CI asserts `base64decode(JSON(tokenURI).animation_url) === request(["token",id,"live"]).body` and that `/token/<id>/hash` equals `keccak256` of both.

### 4.3 Route table (`Premises`)

| Route | Served by | Body |
|---|---|---|
| `/` | `Manifest.door()` | collection landing: edition, bands, links to `/token/<id>/live`, `/open`, `/services.json`, hash of the engine |
| `/token/<id>/live` | `Renderer.document` | **the app**, `text/html`, `Cache-Control: public, max-age=15` |
| `/token/<id>/raw` | `Keep.tokenURI` | the data URI as `text/plain` |
| `/token/<id>/card.svg` | `Card.svg` | the still, `image/svg+xml` |
| `/token/<id>/face/<n>` | `Keep.tokenURIAt` | one face |
| `/token/<id>/hash` | `Renderer` | `{document, head, body, state, block}` keccaks, `application/json` |
| `/token/<id>/services.json`, `/token/<id>/llms.txt` | `Manifest` | the agent shopfront (§9) |
| `/services.json`, `/llms.txt`, `/.well-known/agent-registration.json`, `/.well-known/agent-card.json`, `/manifest` | `Manifest` | collection-level twins; `/manifest` lists every route's body hash |
| `/open` | `Manifest` | JSON directory of open markets from `Pool.openIds` (no indexer) |
| `/k/<id>/<key>` | `Renderer.document` | the same app, booted as the **agent door** (§9) |
| anything else | `Premises` | a 404 document that never echoes the path |

Artwork routes are answered by `Premises` from the hub and renderer, never through a page, so "a compromised front door … cannot alter one byte of the artwork." `resolveMode()` returns `"5219"` and is never removed. One resource has one URL (trailing slash dropped, leading zeros refused).

### 4.4 Wallet discovery and the gate

Boot: detect surface (`location.protocol`, `localStorage` probe, EIP-6963 within 300 ms) → in console mode collect every EIP-6963 announcer keyed by `rdns`, remember the choice in `localStorage['keep.wallet']` (a convenience, never authority), raise a picker when more than one announces → `eth_accounts` silently, `eth_requestAccounts` only on a gesture → compare `eth_chainId` with `KEEP.chain` **before any read** and refuse with a switch button → `eth_getCode(account)`: if it begins `0xef0100`, name the delegate, compare its codehash to `StateBlock.knownDelegates` and withhold spend buttons behind an "unknown delegate" acknowledgement → `rightsOf(id, account)` → `body.dataset.rights` → panels render. Every write goes through the **confirm slab**: `propose(title, lines, tx)` renders To / Value / Function (decoded from `sel`) and a plain-English sentence built from the same calldata, runs `eth_estimateGas` and decodes a custom error by selector from `KEEP.err` ("NotHolder — only the holder may do this"), sends on one explicit press, then `watch(hash)` polls the receipt for three minutes and re-reads `rightsOf` and `custodyEpoch` after it lands ("Ownership or custody epoch changed. Review again." — Pixel-Garden's `operation()` guard). On `accountsChanged`/`chainChanged` the rights are recomputed and every pending slab is discarded.

### 4.5 "Zero" and "no answer", and absent satellites

`StateBlock` reads every satellite behind `extcodesize` **and** `try/catch` (`try` alone reverts on a codeless address before `catch` can see it) and sets one `reported` bit per contract actually called. The app prints a clear bit as **"not reported"** — a grey chip and a collapsed panel saying "not deployed on this chain" when `extcodesize` was zero, or "could not be read at block N" when the call reverted — and a set bit with a zero value as **"none"** / **"0"**. Every client-side `eth_call` follows the same rule: an RPC failure renders "could not read", never a number. On a band without `Router` or `Nameplate` the Swap screen shows only "Your market" and Identity shows no ENS row; the page is never a 500.

### 4.6 Screens

Every screen is one `<section data-lane>`; the crest is always above it; URLs are fragments (`#swap`, `#social`, `#launch`, `#vault`, `#identity`, `#agent`) so one document serves all. **R** = read-only; **S** = signed (through the slab).

- **Crest** (always): id, chain, holder (ENS if reported), custody epoch, "sealed until", "market: closed / open / bonded until", "listed until" (Market), reported chips, "verified against chain at block N" from `/token/<id>/hash` vs the loader's own keccak of the inflated bytes.
- **Swap**: *Your market* — open (R: curve preview; S: `openMarket`), deposit/withdraw (S), swap card quoting `Pool.quote` with a 220 ms debounce and a stated floor (S: `swap` / `swapExactOut`, exact-amount approval as a step, never unlimited), fee/shape/bond/sniper settings (S, hidden under bond), directory from `/open` (R). *Base liquidity* — `QuoteLens` quote-by-revert beside the owned-pool quote, venue manifest printed from `Router.venues()` (R), swap through `Router` from the EOA or, if the Reach is selected as signer, through `Reach.execute` (S).
- **Social**: *Commons* (room 0), *Home* (the token's own room — followers are its members), *Rooms* (groups), *DMs* (pairs; sealed when both keys exist), *Inbox* (priced mail from strangers), *Reactions* (ERC-7409 singleton). Composer appears only with `R_HOLD|R_ACCOUNT`; a renter sees the walk and a sentence saying why they cannot speak.
- **Launch**: *Coin* (S: `Kiln.launch` with `coinAt` preview), *Raise* (S: `Launch.create`; buyers see a curve, the decaying tax as a countdown, and `floorPerToken`), *Graduate* (R/S: permissionless), *Hook* (R: `mine` under `eth_call` 60,000 tries per window; S: `deployHook`), *Positions* (`Planner` calldata → S), *Locks* (`Locker`).
- **Vault**: *Reach* (holdings, manifest, pieces, seal with "until" picker and the ratchet warning, `execute`/`executeBatch` composer, **open approvals** list with one-click `revokeApprovals`), *Grip* (address, QR, balance, the permanence warning before any `give`), *Steward* (will, guardians, heartbeat countdown, `wouldPass` status in words), *Panic* (one red button, double-confirm, lists exactly what it revokes).
- **Identity**: name (Nameplate, mainnet band only), encryption key (set/rotate; "rotating invalidates sealed mail sent to the old key"), rights of any address (R), fingerprint (R, with "changed since you loaded" diff), 7702 delegate status, hash manifest.
- **Agent**: services catalogue (R), session keys (S: `grantSession` with selector chips carrying on-chain-hashed selectors), scoped grants (S), the agent door link `/k/<id>/<key>`, audit log (`Reach` `Executed`/`SessionActed` walk, R).

**Size budget of the app**: HTML+CSS+JS source ≤ 180 KB, of which the zero-dependency wallet library (IPSEITY `ipseity.html` §7–8: keccak, ABI, EIP-712, EIP-6963, `propose/fire/watch`, CREATE2-6551, sandbox detection, self-verified by `selftest.mjs`) ≈ 38 KB, console shell + lanes (from IPSEITY branch `claude/claude-md-docs-8vvyc8`, 53 KB filled) ≈ 60 KB, sealed-DM crypto (`DeskSeal` P-256 ECDH/AES-GCM with per-send key re-read) ≈ 9 KB, QR ≈ 3 KB, CSS ≤ 14 KB. Minified ≤ 110 KB, gzip ≤ 48 KB.

---

## 5. Swap

### 5.1 The owned market

`Pool` keeps IPSEITY's shape — one market per token id, `ownerOf` the sole LP, no LP shares, no oracle, no TWAP, no flash loans — with these changes:

```solidity
struct Market {
  address base; address quote;           // address(0) = native ETH on either side
  uint112 rBase; uint112 rQuote;         // real reserves
  uint16 feeBps;                          // ≤ 500
  uint16 sniperBps; uint64 sniperUntil;  // decaying post-open fee, ≤ 9,000 bps over ≤ 98 min
  bool open; bool sealed;                // sealed = launch graduation, no LP authority
  uint64 bondUntil;                      // ratchet, ≤ 365 d, survives sale
  uint32 shapeBps;                       // concentration 0..80,000, holder-set, anchored
  uint128 vBase; uint128 vQuote;         // ANCHORED virtual offsets
  uint112 feeBaseOwed; uint112 feeQuoteOwed; // sealed markets only
  uint256 beneficiary;                   // sealed markets: the Keep whose account is paid
}
function openMarket(uint256 id, address base, address quote, uint16 feeBps, uint32 shapeBps, uint16 sniperBps, uint32 sniperSeconds) external onlyActor(id);
function deposit(uint256 id, uint256 amountBase, uint256 amountQuote) external payable onlyActor(id);
function withdraw(uint256 id, uint256 amountBase, uint256 amountQuote, address to) external onlyActor(id); // never pausable
function swap(uint256 id, bool baseIn, uint256 amountIn, uint256 minOut, address to, uint256 deadline) external payable returns (uint256 out);
function swapExactOut(uint256 id, bool baseIn, uint256 amountOut, uint256 maxIn, address to, uint256 deadline) external payable returns (uint256 inUsed);
function quote(uint256 id, bool baseIn, uint256 amountIn) external view returns (uint256 out);
function setFee / setShape / bond / closeMarket (onlyActor, blocked under bond except bond itself)
function openSealed(bytes32 key, address base, address quote, uint16 feeBps, uint256 beneficiary) external payable onlyLaunch returns (bytes32);
function collect(bytes32 key) external;  // pays Keep.feeSink(beneficiary): the Reach, or the Grip if the holder set the bit
function market(uint256 id) / openIds(from,count) / sealedIds(from,count) / pendingShape(id)
```

- **Curve.** `(x+vx)(y+vy)=k`, `v = r × shapeBps / 10,000`, anchored only in `openMarket/deposit/withdraw/setShape` — never in `swap` (the 400-in/718-out fuzz-caught bug is the reason, and `testFuzz_roundTripNeverProfits` guards it). The art-derived concentration is replaced by a holder-set `shapeBps`; `setShape` re-anchors and is refused under bond. `quote` and `swap` share one `pure` function; `amountOut` rounds the pool's remaining balance **up**; `swapExactOut` rounds input up; fuzzed at 0/1/2/9 wei and 2^64/2^112.
- **Authority.** `onlyActor(id) = msg.sender == ownerOf(id) || msg.sender == account(id)` — the same predicate as `Kiln` and `Parley`, fixing IPSEITY's inconsistency (a session key on the Reach could launch and speak but not deposit).
- **Native ETH.** `address(0)` on either side; `deposit`/`swap` are `payable` and the native leg must equal `msg.value` exactly (`WrongValue`); pushes use `call{value}` and revert `TransferFailed`; the ERC-20 leg is measured on arrival (`_pull` credits what arrived; fee-on-transfer safe).
- **Sniper fee.** After `openMarket` (and only then — not after `deposit`, so a holder cannot re-arm it against standing traders) the effective fee decays linearly from `sniperBps` to `feeBps` over `sniperSeconds` ≤ 98 min; on owned markets it accrues to reserves (the holder is the LP), on sealed markets to the fee accumulators. No exemptions exist in the ABI.
- **Bond.** Ratchet only, ≤ 365 days, survives sale, freezes `withdraw/setFee/setShape/closeMarket`; additive operations stay open; `withdraw` is never pausable. There is no admin at all: IPSEITY's five switches (`setPaused`, `bless`, allowlist, handover) are gone, and the cross-market isolation they guarded is enforced per market instead (fix C5 below).
- **Sealed markets.** Created only by `Launch.graduate`; `rBase/rQuote` are principal nobody can withdraw; swap fees are accumulated separately in `feeBaseOwed/feeQuoteOwed`; `collect(key)` pays them to `Keep.feeSink(beneficiary)` — the Reach by default, the Grip if the holder set `feesToGrip`. This is the research brief's "LP to an immutable custodian with permissionless collect" with the Pool as its own custodian, and it is how **selling the Keep sells the launch's fee stream** with no second NFT.

**Exact fixes for the known bugs.** C1: one global `nonReentrant` (transient slot `keccak256("keep.pool.lock")`, cleared on every exit) on *every* state-changing function including `openMarket/closeMarket/setFee/bond/setShape`; `openMarket` zeroes `rBase/rQuote/vBase/vQuote/feeBaseOwed/feeQuoteOwed`; `closeMarket` requires both reserves zero and `delete`s. C2: `swap` snapshots `vIn/vOut/rIn/rOut` into memory **before** `_pull`, and `setShape` is under the same lock, so a hostile input token cannot re-anchor the curve the trade is about to use. C5 (cross-market over-claim by rebasing/sweeping tokens): each market's reserves are accounted per market, `withdraw` is capped by `min(rBase, balanceOf(this) − Σ other markets' reserves of that token)` tracked in `totalReserved[token]`, so a market can only ever pay out what it was credited. B2 (renter front-runs curve sync) is moot — there is no live word — but `setShape(id, bps, expectedShape)` still takes the value the holder saw. Verified by porting `Pool.t.sol` (28 tests, 6 fuzz), `verify-pool.mjs` (62 assertions, 200-trade k-walk) and `fuzz.mjs`'s nine market properties, plus new ones for native legs, exact-out, sealed `collect` conservation and the per-token reserve cap.

### 5.2 External liquidity

`Router` is ownerless: venues (Base: Uniswap v3 `SwapRouter02` + `QuoterV2`; v4 `PoolManager` with **hookless** `PoolKey`s only) are constructor immutables with their `extcodehash` pinned and re-checked on every call; input measured on arrival, exact-approve → call → approve zero in the same transaction; output verified by balance delta ≥ `minOut`; `deadline` and `sqrtPriceLimitX96` enforced at our layer; one transient reentrancy slot; no fee, no owner, no allowance left standing. `QuoteLens.quote(...)` runs the real `unlock → swap → settle/take` path and reverts `QuoteResult(spent, received, sqrtPriceAfter)`, so the page cannot show a price it could not have settled at this block (0x's 54.2 %-malicious-hooks finding is the reason hooked keys are refused). The venue table is printed on every token's Swap screen in `hooklist` shape (address, codehash, permission bits, "upgradeable?: yes/no", audit link) so a buyer can diff it against Uniswap's deployments. Aerodrome is deferred pending a primary read of its upgradeability. The Reach uses the Router like any target: a session key can be allowed `Router.swap` with a per-asset cap (§8).

---

## 6. Social and messaging

**Speech predicate**: `Parley.mayActAs(token, who) = who == KEEP.ownerOf(token) || who == KEEP.account(token)` — never the ERC-4907 user, an operator, or a session key *directly* ("a reputation is not a thing you can hand back at the end of the day"). An agent speaks by having the holder allow `Parley.speak` on its session, so the call arrives from the Reach — one predicate, and the audit log records who spoke.

**Rooms.** `Said(uint256 indexed room, uint256 indexed from, uint64 prev, uint64 prevFrom, uint64 seq, uint8 kind, uint64 reBlock, uint64 reSeq, bytes body)` — IPSEITY's log with a reply pointer added (`reBlock/reSeq` name the message replied to; zero means none). Room kinds: the **commons** (0, everyone), **home rooms** (`homeKey(token) = keccak(3, token)`: every Keep has one from the moment it is minted, at zero gas, with the token as steward; `join` is "follow", `Roster.membersOf` is the follower list), **groups** (`found(by, name ≤ 48, openDoor)`, `invite/evict` by steward, `join` self-performed), **pairs** (`whisper(from, to, kind, body)` derives `keccak(2, min, max)`; posting to a pair key through `speak` is refused `UseWhisper`). `MAX_BODY = 1,024` bytes, text only; kinds `PLAIN`, `SEALED` (nonce ‖ AES-GCM). The contract keeps per room only `{last, count, opened, members, kind, open, steward, index, cooldown}` and per token `lastSpoke` and the rooms it entered (growable only by the token itself). `setCooldown(room, by, seconds ≤ 7 d)` by the steward, enforced per `(token, custodyEpoch)` bucket. Eviction cannot unsay anything.

**Reading without an indexer.** `stateOf(room).last` → one `eth_getLogs` for exactly that block with `topics:[said, room]` → follow the oldest log's `prev` → repeat; `prevFrom` walks one token's speech across rooms; `heads(rooms[])` is the 9-second poll. Fifty messages are fifty single-block queries and no range scan anywhere; the walk rule is published as data in `services.json` so any client can reproduce it. `topics()` hashes the event signatures on chain. EIP-4444: heads and `count` live in state; bodies are logs; the archive survives any site redeploy and is never redeployed itself ("a new Parley would not migrate the conversation, it would end it").

**Encryption and keys.** `KeyRegistry` merges the three registries: `setKeyFor(tokenId, keyType, pubkey)` (actor; records `ownerAt`) and `setKey(keyType, pubkey)` (any address); `keyOf(tokenId)` and `keyIdOf` answer zero unless `ownerAt == ownerOf(tokenId)` — a sold token has no key until the buyer sets one, so a page can never promise privacy to a departed holder. Types: X25519 = 1, secp256k1 ECIES = 2, P-256 = 3, ML-KEM-768 = 4 reserved. The shipped client uses P-256 derived from `personal_sign("KEEP seal v1 · chain <c> · token <t> · epoch <e>")` (so the key dies with the epoch by construction), static-static ECDH → HKDF → AES-256-GCM with AAD binding chain, Parley address, both ids and both epochs; it **re-reads the recipient's key immediately before every encryption** (IPSEITY B1) and refuses to send if it changed; it states in the UI that there is no forward secrecy. MLS groups are a COULD. Sealed sends carry `expectedKeyId` and revert `EncryptionKeyChanged` if the key rotated in the mempool.

**Priced attention.** `Inbox` is `AgentComms` made human: `configure(tokenId, feeToken, postage, replyWindow 5 min–30 d, open)` by the holder (epoch-stamped; stale after sale); `send{value}(toTokenId, fromTokenId, threadId, bytes body ≤ 1,024, expectedFeeToken, maxPostage, expectedKeyId)` escrows postage (native or ERC-20 via `ExactERC20`), checked against *live* configuration so a recipient cannot raise the price under a pending send; `reply(messageId, body)` by the recipient's actor releases postage to `Keep.feeSink(toTokenId)` — the money lands where the swap can use it; `refund(messageId)` by anyone after `replyBy`; exactly one of `{answered, refunded}` ever becomes true. Bodies are logs with `prev` pointers per inbox so the Social lane walks them like a room; ids are paged per token (`inboxOf(tokenId, from, count)`), the gap ANIMA left. Allowlists are by token id, not address.

**Reactions and follows.** Reactions call the ERC-7409 singleton `0x3110735F0b8e71455bAe1356a33e428843bCb9A1` with `(parley, uint256(keccak256(room, seq)), emoji)` for posts and `(keep, id, emoji)` for tokens — zero bytes of our budget, visible to any marketplace tooling. Follow = `join(homeKey(target), myToken)`.

**Spam economics.** Writing anywhere needs a Keep; each room has a steward-set cooldown; strangers reach a holder only through postage. Gas on Base is sub-cent, so the token is the Sybil cost (4,096 tokens with a secondary price), not the fee.

**Federation.** None in v1. Each band's commons is local; `ParleyPort` stays a documented option with its no-admin/≥ 2 DVN rules.

---

## 7. Launchpad

**What only a Keep can do.** Launches are signed by the token (`mayActAs`), fees pay the token's account, the launch's liquidity becomes a sealed market whose fee stream follows the token, and the snipe tax raises every buyer's floor. A plain EOA can buy and sell on a curve; it cannot create one.

**Creation.** `Kiln.launch(tokenId, name, symbol, decimals, supply, salt)` CREATE2-deploys a `Coin` with `salt' = keccak(msg.sender, salt)` (no address front-running), mints the whole supply to `account(tokenId)` and records `launcher`; `coinAt` predicts the address so the page shows it before signing. Names and symbols are ASCII-whitelisted and `Web.esc`'d everywhere they are rendered.

**Raise.** `Launch.create(LaunchParams{tokenId, coin, curveSupply, virtualQuote, graduationTarget, startsAt ≥ now, fairWindow ≤ 1 d, perWalletCapDuringWindow, snipeTaxStartBps ≤ 9,900, feeBps ≤ 100, creatorBps ≤ 1,500, deadline ≤ 30 d})` — actor only, pulls `curveSupply` from the Reach into `Launch`, locks `creatorBps` of the supply in `Locker` for ≥ 365 days with the Reach as holder (so a creator allocation exists only as a vested lock and never as a tax exemption), records `treasury` (immutable protocol fee address) and the fee split **into the launch struct** so no later change can touch a live launch. One live launch per token; `lastLaunchAt[tokenId]` enforces a 7-day spacing (the per-NFT rate limit agents need). Backdated starts are refused (`StartsInThePast`).

**Curve.** ANIMA's: `k = q·b`, `newBase = ceilDiv(k, q + netIn)`, every rounding against the trader; `uint128` reserves. Quote is native ETH (`buy{value}`), `buy(launchId, minBaseOut, deadline, maxFeeBps)` pins the fee the buyer reviewed; `sell(launchId, baseIn, minQuoteOut, deadline)` mirrors it. **Buyers hold credits, not tokens, until graduation**: `creditOf[launchId][buyer]` — nothing ERC-20 moves during the curve, so there is no pre-launch transfer to a predicted pair (Four.meme), no pool anyone can pre-initialise against, and `fail` refunds are exact. Snipe tax decays linearly from `snipeTaxStartBps` at `startsAt` to zero at `fairWindowEnds`, clamped so `base + snipe ≤ 9,900` (the 102 % payout bug is the regression), and is **sent to `Coin.contribute{value}`** — the burn-to-redeem treasury — so every sniper raises the floor of everyone they were sniping. Fee legs: `creatorBps` share of `feeBps` → `Keep.feeSink(tokenId)` (the Reach), remainder → `treasury`.

**Graduation.** `graduate(launchId)` is permissionless once `raised ≥ graduationTarget || baseSold ≥ curveSupply`: it computes the terminal curve price, calls `Pool.openSealed{value: raised}(key, coin, address(0), 100, tokenId)` with the unsold supply as `rBase` and `raised` as `rQuote` at that price, emits `Graduated(launchId, key, terminalPrice, poolSpot)` with both prices side by side, and flips credits to claimable (`claim(launchId, buyer)` by any gas payer, recipient fixed). Approvals are zeroed in the same call. If `deadline` passes short of target, `fail` opens refunds and returns the supply to the Reach. No withdraw or pause authority exists over curve funds.

**Hooks (post-MVB).** For holders who want Uniswap v4 liquidity for their coin: `Kiln.mine(initCodeHash, flags, from, tries)` walks CREATE2 salts as a `view` under `eth_call` (the browser has no keccak on purpose; 60,000 tries per window); `deployHook(kind, salt, arg)` then **checks `Hook.flags(hook) == wanted` or reverts `WrongFlags`**; `GateFacet` opens trading at T1 and locks negative liquidity deltas until T2 (fee collection stays possible), both immutable, with a static fee band in place of the art-driven one (nothing to sync, so PR #36's race cannot exist); `Planner.mintPlan` returns canonical `modifyLiquidities` bytes with authority `mayActAs` (not `launcher == msg.sender`, which stranded authority after a sale) and the PoolKey read from `PositionManager`. The page's two-way dynamic-fee guard (a dynamic-fee pool behind a plain gate charges nothing forever) is kept. Hooks are v4 **periphery for the holder's own coin**; the owned Pool is not a v4 hook in v1.

**Not built.** CCA, Doppler (BUSL), team allowlists, mutable fee controllers, points, updatable roots, keeper-driven anything.

---

## 8. Vault and accounts

**Reach** (`IpseityAccount` whole, plus five changes). The seal is enforced by **measurement**: before a sealed call the account snapshots its ether, every manifest asset's `balanceOf(this)` (≤ 16) and every guarded piece's `ownerOf` (≤ 8); afterwards nothing may be smaller (`Shrank`), go blind (`WentBlind`) or leave (`PieceLeft`), and a call to a manifest asset may carry only `transfer`/`transferFrom` — every other word reverts `NotSafeWhileSealed(sel)`, because a six-selector blocklist was once walked through with Permit2's `approve(address,address,uint160,uint48)`. `seal(until)` ratchets only, ≤ 365 d, survives sale; a sealed vault can still vote, claim, compound and attest. `execute` is CALL only; `executeBatch` (≤ 16) snapshots once around the batch and reverts `EmptyBatch` on `[]`. ERC-1271 is domain-separated: the Reach signs only `KEEP_ATTESTATION` typed data `(purpose, payload, nonce, deadline)` and cannot sign a venue's order hash; `retireAttestations()` bumps every signature it ever gave. The five changes: (1) sessions and grants store `KEEP.custodyEpoch(id)` instead of `statsOf.xfers`; (2) **per-asset ERC-20 caps** — `setTokenCap(key, asset, cap)`, charged by decoding `transfer/approve/transferFrom/Permit2.approve` amounts when `to == asset`, because "any implementation that stops at `msg.value` has a spending limit in name only"; (3) **scoped grants** from the `koorbx` branch — `grantScoped(key, Scope{target, dataHash, targetCodeHash, value, callsRemaining, minInterval, expires})`, the exact-calldata permission a site can safely request for "swap 1 ETH on my pool once a day"; (4) the **open-approval ledger** — any `execute` whose selector is in the approval family records `(asset, spender)` (≤ 64), `approvalsRoot()` folds into the fingerprint, `revokeApprovals(idx[])` zeroes them in one batch, and a `Market` listing may require the ledger empty; (5) a hub-only `sealBy(until)` for `panic`. Sessions remain bounded four ways — expiry ≤ 365 d, cumulative native cap, epoch-keyed target and selector allowlists (O(1) revoke), actual-spender check on approval shapes — plus `NoPrivilegeEscalation` (no call to the account, no sub-grant). Storage layout is frozen by the CREATE2 derivation: it is settled and reviewed before the mainnet band, and the implementation address is part of the deployment record.

**Grip** verbatim: `receive()`, the three `onERC…Received`, `token()`, `owner()`, `isOneWay() == true`, `isValidSignature → 0xffffffff`, `supportsInterface` declines `0x51945447`; `verify-vault.mjs` asserts against the compiled ABI that no selector moves an asset. A mistaken transfer in is permanent and the page says so before building the calldata. Holders who want fee income to accumulate untouchably set `feesToGrip`.

**Locks.** `Locker.lock(token, amount, until ≤ 3,650 d)` records what arrived, `claim` after `until`, `extend` longer only, `give(id, to)` — most usefully into the Reach, so a locked treasury travels with the Keep. Used by `Launch` for creator allocations and by holders for team tokens.

**Steward** (succession and recovery in one contract, no standing approval). `arrange(id, heir, toToken, quiet 30–3,650 d, notice 14–365 d, guardians[] (0 or ≥ 2), recoveryTo)` by the holder, stamped with the epoch (void on transfer). Two triggers: silence past `quiet` lets anyone `summon(id)`; or ≥ 2 of the named guardians `recover(id)`. Either starts the single `notice` clock, during which only the holder's `stillHere`/`revoke` cancels it (a stranger's action never counts as life — IPSEITY's `embody` lesson; `summon` twice reverts `AlreadyCalled`). After `notice`, anyone may `claim(id)`, which calls `Keep.moduleTransfer(id, to)` — a hub entry only the pinned `STEWARD` may call and only for a matured plan — so no marketplace-style `setApprovalForAll` is ever needed. `toToken` lets the heir be "whoever holds Keep N". `getWill/getObit` make it ERC-7878-legible; `wouldPass(id)` returns a status code the page renders in words. A capped bounty from the Reach for whoever executes a matured transfer is a COULD.

**Market.** `list(id, price, expiresAt, fingerprint, floors[])` requires `Reach.sealedUntil() ≥ expiresAt` (listing *is* a seal, so the buyer's floor is enforced by the account, not promised by the venue) and locks the token through the module path; `buy{value}(id, agreed, fingerprint)` recomputes `getStateFingerprint`, checks every declared balance floor, pays royalty first, credits `owed[seller]`, and calls `moduleTransfer`; `delist` unlocks. Pull payments only.

**What survives sale / what is revoked** — the two lists in §3.2, rendered on the Vault screen as a checklist before any `transferFrom` the page itself proposes.

---

## 9. Agents

An agent uses the same contracts through the same page, and the page is built to be read by a program as well as a person.

- **Identity minted with the token.** Face 2 of `tokenURI` is an ERC-8004 `registration-v1` document generated from chain state: `agentId == tokenId`, `services[]` = the token's `web3://` routes and its Reach, `supportedTrust` = `["custody-epoch","erc-5646"]`, `x402Support: false`. `boundWalletOf` (ERC-8004 `setAgentWallet`) needs the EIP-712 proof and is cleared in `_update`. Mirror-registration in the canonical singleton (`0x8004A169…`) is a holder's optional transaction; correctness never depends on an upgradeable registry.
- **The shopfront.** `/token/<id>/services.json` (`keep.services/1`) lists every service as `{name, contract, sig, selector, kind: read|write|payable, via: "direct"|"reach", args, notes}` with every selector hashed on chain, the edition, the bands, the Parley walk rule and the inbox terms; `/llms.txt` is its prose twin. `manifestHash(id)` on `Manifest` is the keccak of that document; an MCP bridge that pins the hash refuses a catalogue that drifted (CVE-2025-54136's fix as a product rule). "An agent holding that selector needs an RPC endpoint and nothing else."
- **Session keys** are the only agent authority: the holder grants `grantSession` (targets `Pool`, `Parley`, `Inbox`, `Router`; selectors `swap`, `speak`, `reply`…) or a `grantScoped` exact call; the agent calls `Reach.executeAsSession`; `sessionAllows(key, to, sel)` is checked as a view first (propose), then sent (act) — two tools, never one. Launches by an agent require a scoped grant on `Launch.create` and inherit the 7-day per-token spacing; the first launch of a token with a guardian set requires the guardian's co-sign (`Launch` reads `guardianOf` and a one-time `approveLaunch`). Session keys never sign ERC-1271.
- **The agent door.** `/k/<id>/<key>` boots the same document with `door=key`: it refuses a wallet whose `eth_requestAccounts[0]` is not the key, shows exactly what the session allows (targets × selectors, caps, expiry, epoch), and offers only those actions.
- **Agent-safe by construction**, with two tests that must pass forever: transferring any token to a Keep's accounts changes no bit of `rightsOf` and no session (the Bankrbot class); and no reputation-shaped data exists in the protocol without a settlement receipt — v1 ships none, and the only "reputation" a buyer can read is `Inbox` reply receipts and sealed-market `collect` history, both unforgeable.
- **x402 posture.** The inbox *is* the paid-request primitive; a `PaymentRequirements`-shaped block in `services.json` describing postage is a COULD.

---

## 10. Special features — ranked

Score = holder value (1–5) × defensibility (1–5) ÷ build cost (1–5). The mechanism names the contract that delivers it.

| Rank | Feature | Mechanism | V×D÷C |
|---|---|---|---|
| 1 | **The receive-only Grip** | `Grip`: no spend selector exists; `isOneWay()`; ABI-asserted in CI; `feesToGrip` routes income into it | 4×5÷1 = **20** |
| 2 | **Selling the Keep sells the exchange and the launch fee streams** | owned `Pool` market keyed by token id; sealed markets pay `feeSink(beneficiary)`; `_update` revokes the seller | 5×5÷2 = **12.5** |
| 3 | **Seal-as-listing and `panic()`** | `Market.list` requires the Reach sealed to expiry; `buy` pins ERC-5646 and balance floors; `panic` rolls both epochs and seals in one call | 4×4÷2 = **8** |
| 4 | **A home room at mint, indexer-free** | `Parley.homeKey(id)` derived, zero gas; back-linked logs walked by single-block `eth_getLogs`; followers = `Roster` bitmap | 4×4÷2 = **8** |
| 5 | **The same bytes twice, self-verifying** | `tokenURI` viewer and `/token/<id>/live` byte-equal in CI; `/token/<id>/hash` and the loader's own keccak shown in the crest | 5×4÷3 = **6.7** |
| 6 | **Priced attention into the vault** | `Inbox` postage escrow → `feeSink` on reply, refund on silence, `maxPostage` against repricing | 3×4÷2 = **6** |
| 7 | **Holder-gated lanes, "zero ≠ no answer"** | `rightsOf` bits render controls; `StateBlock.reported` bits; every write re-enforced by its contract | 4×3÷2 = **6** |
| 8 | **The Steward: succession and recovery without a standing approval** | two triggers, one cancellable notice, `Keep.moduleTransfer` pinned at construction, heir may be "whoever holds N" | 3×4÷2 = **6** |
| 9 | **Open-approval ledger with one-click revoke** | `Reach` records approval-family calls; `approvalsRoot` in the fingerprint; listings may require it empty | 3×4÷2 = **6** |
| 10 | **Sniper tax raises the floor; credits until graduation** | `Launch` decaying tax → `Coin.contribute`; `creditOf` so no ERC-20 moves pre-graduation; both prices emitted at `graduate` | 4×4÷3 = **5.3** |
| 11 | **Agent door and `services.json` with on-chain selectors** | `/k/<id>/<key>`, `Manifest.manifestHash`, scoped sessions, propose/act | 4×4÷3 = **5.3** |
| 12 | **Clear-signing from chain and 7702 hygiene** | slab sentences built from `sel`/`err` tables hashed on chain; `eth_getCode` delegate check against `knownDelegates` | 3×3÷2 = **4.5** |
| 13 | **Stealth receive for the Reach** | holder registers the Reach's ERC-6538 meta-address via `registerKeysOnBehalf` + the Reach's attestation 1271; any Umbra-style wallet can pay it privately | 2×3÷1 = **6** (low value, near-zero cost; ships because it is free) |
| 14 | **Every Keep has a name** | `Nameplate`: `<id>.keep.eth` by ENSIP-10 wildcard, `contentcontract` → Premises, custody-is-binding | 3×3÷3 = **3** |
| 15 | **One origin on every band** | CREATE3 fixed salts for every deployable; `web3://0xSAME:1/` and `:8453/` resolve to the same bytes | 2×3÷2 = **3** |

Everything below 3 was cut (MLS groups, federation, ERC-4337, passkeys, roles, bond/reputation, hire escrow, CCA/Doppler, RAILGUN, token bridging).

---

## 11. Chain and deployment

**Bands.** Edition of 4,096 Keeps, partitioned by disjoint id ranges, no token bridge ever (a mirror with no custody is a lie at worst; a bridge is a theft at worst — KelpDAO's $292 M was a bridge):

| Band | Chain | Ids | Role |
|---|---|---|---|
| 1 (primary, launch first) | Base (8453) | 1–3,072 | the bulk of the edition; sub-cent speech; v3/v4 counterparties; `w3link.io` serves Base mainnet |
| 0 (canonical) | Ethereum (1) | 3,073–3,584 | high-value custody; ENS `keep.eth`; the neutral copy of the engine bytes |
| 2 (reserved) | OP Mainnet (10) | 3,585–4,096 | opened only on demand; shares Base's fee code and EAS predeploys; a written "band orphaned" rule says a dead band keeps its Keeps and loses nothing but federation it never had |

**Addresses.** Every deployable (and every engine shard, via Solady `writeDeterministic`) is deployed through a fresh nonce-0 burner's CREATE3 factory under fixed salts (`keccak("keep.v1.<name>")`), so `Keep`, `Premises`, `Pool`… share one address on every band; the hub's module addresses (`MARKET`, `STEWARD`, `LAUNCH`) are predicted before construction and pinned as immutables. The deployment record (`deployments/<chain>.json`) carries every salt, facet-free bytecode hash, shard address and gas assumption, and `recover-record.mjs` re-derives all of it from chain and exits non-zero on drift.

**Cost estimate** (today's schedule, 200 gas/byte, sizes from §2 budgets ≈ 280 KB of runtime code + ≈ 50 KB of gzip shards): ≈ 70M gas of code deposit + ≈ 15M of constructors and wiring ≈ **85M gas per band**. Base at 0.01 gwei plus measured L1 data ≈ 0.0009 ETH + ≈ $0.10 ≈ **$3–5**; mainnet at 0.5 gwei ≈ 0.043 ETH ≈ **$100–120** (≈ $1,000 at 5 gwei). **Deploy the mainnet band before Glamsterdam**: EIP-8037 as drafted reprices code deposit to 1,530 gas/byte (7×) and a 24 KB chunk would exceed the 2^24 per-transaction cap. Mint: ≈ 310k gas. A 200k-gas action on Base ≈ $0.003.

**One-way, by construction.** `Engine.freeze()`; `Keep.sealRenderer()`; the module list, 6551 salts, bands and `treasury` are constructor immutables; `Router`'s venue table is immutable; `Pool` sealed markets never withdraw; `Grip` has no spend path; seals, bonds and locks only lengthen; the `Timelock` admin may be renounced after launch, leaving `setPrice`/`setRoyalty` dead. Cancun transient storage and the 2^24 cap hold on all three chains; P-256 is 3,450 gas on Base/OP and 6,900 on mainnet if passkeys are ever added.

---

## 12. Toolchain

**Base the pipeline on IPSEITY's `tools/`, not Hardhat.** Reason: the website pipeline exists only there — `build-engine.mjs` (minify → gzip → shard, with guards that each encode a shipped bug), `compile.mjs` (solc-js 0.8.36, viaIR, optimizer 800, cancun, content-addressed cache, **EIP-170 gate**), `evm.mjs` (`@ethereumjs/vm` harness whose `getLogs` makes the Parley walk's termination measurable), `forge.mjs` (the `.t.sol` suites without Foundry, with the 3-byte-REVERT self-check), `gas.mjs` (build-failing view-gas gate), `verify-site.mjs` (contract-emitted JS run against a DOM shim and the same EVM), `recover-record.mjs`, and the twin `Chain`/`RpcChain` with the three public-RPC lag defences. It compiles in this container in under four minutes, and KEEP's no-external-imports rule (ANIMA code arrives with OZ replaced from `src/lib/`: `SignatureChecker` → MASTER's `Crypto.sol`, `ReentrancyGuardTransient` → one hashed transient slot, `SafeERC20` → `ExactERC20`) means Hardhat's dependency handling buys nothing. Hardhat 3 stays for one thing: `npx hardhat node` pinned to `cancun` for the live-wire journey. Playwright Chromium (pre-installed at `/opt/pw-browsers`) runs the console journeys.

**Tests.** `.t.sol` suites run by `forge.mjs` (and by real Foundry in CI when available; the suites need only the twelve cheatcodes it implements): IPSEITY `Pool.t.sol`, `Parley.t.sol` and `V4PositionPlanner.t.sol` ported; ANIMA's `_update`, epoch, approval, launchpad, comms and session tests rewritten as `.t.sol` with their sentence names kept. The adversarial `verify-*.mjs` suites on `evm.mjs` are the specification: each begins with the attack that created it (`verify-vault`'s drainer "with a function name no list has", `verify-parley`'s naive walker that loops, `verify-launch`'s selector-faithful `MockPoolManager`, `verify-console`'s three layers: no script → a correct page; script, no wallet → the walk; both → controls); `verify-findings` replays every historical finding as `reproduced`/`refuted`; `fuzz.mjs` is seeded and shrinking; `expectRevert` matches error names or any 4-byte selector of that name, proved non-vacuous by one mutation per new assertion.

**CI (`npm run check`, in order; fails on the first):** compile (size gate) → `selftest` (keccak/EIP-55/ABI/EIP-712/CREATE2-6551 against published vectors) → `build-engine` (reserved globals; loader declares nothing) → `forge` → `gas` (every view ≤ 16,777,216; `tokenURI` ≤ 12,000,000; `/live` ≤ 4,000,000) → `verify` → `verify-pool` → `verify-vault` → `verify-parley` → `verify-launch` → `verify-premises` → `verify-site` → `verify-console` → `fuzz` → `verify-findings` → `agents` → local deploy + `recover-record` → `transient-registry` test (every transient slot hashed, single-purpose, cleared on every exit) → `invariants-check` (every entry in `INVARIANTS.md` names an assertion string that exists). `verify-gateway.mjs` (fetch via `w3link.io`, diff against local `eth_call`) runs against testnet/mainnet deployments only. Counts are written to docs only after the suite runs.

**Equality of the two surfaces** is asserted three ways: byte equality of `animation_url` and `/live`; `/token/<id>/hash` equals the keccak the loader computes over the inflated bytes (the crest shows "verified against chain at block N"); and `recover-record` recomputes every shard's hash from `Engine.head/body` pointers.

---

## 13. Build plan

Units marked **MVB** form the minimum viable bundle (mint → website → connect → swap → speak → launch → vault). Done-criteria are measured, never asserted.

1. **Skeleton and toolchain** — MVB. Copy IPSEITY's `tools/` (the scripts named in §12), `hardhat.config.cjs` (node only) and the libraries listed under §2, plus `Crypto.sol` from MASTER. Done: `npm run compile` and `forge.mjs` self-check pass on an empty suite; the EIP-170 gate fires on a deliberately oversized fixture.
2. **`Curve` and `Pool`** — MVB. Adapt `src/Pool.sol` + `lib/Curve.sol` with §5.1's fixes; port `Pool.t.sol`, `verify-pool.mjs`, `fuzz.mjs` market properties; new tests: native legs, exact-out, sealed `collect` conservation, per-token reserve cap, `PoolReenter` PoC must now fail. Done: all pass; `testFuzz_roundTripNeverProfits` holds at dust for both directions.
3. **`Keep`, `Reach`, `Grip`, `KeyRegistry`** — MVB. Adapt per §2–3; port `_update`/epoch/approval/lock tests from ANIMA as `.t.sol`, `verify-vault.mjs` (+ epoch sessions, token caps, scoped grants, approval ledger, `EmptyBatch`, `panic`); Bankrbot invariant test. Done: `Keep` ≤ 23,000 B (else the diamond decision fires), every `_update` revocation has a failing-before/passing-after test, fingerprint mutation test covers every field.
4. **`Engine`, `Renderer`, `StateBlock`, `Card`, `Premises`, `Manifest` (minimal routes)** — MVB. Adapt per §4; `verify.mjs` surface equality; `verify-premises.mjs`; `gas.mjs` budgets. Done: `tokenURI` ≤ 12M gas, `/live` ≤ 4M, byte-equal, 404 never echoes.
5. **The app document** — MVB. `engine/keep.html` from IPSEITY §7–8 wallet library + console shell and lanes (branch `claude/claude-md-docs-8vvyc8`) + EIP-6963 picker (replacing the console's `window.ethereum`) + slab + QR + viewer mode; Vault and Identity screens first (they need only unit 3). Done: `selftest` vectors; `verify-site` DOM-shim journeys; `verify-console` Chromium three-layer test; opaque-origin boot shows the viewer and never a connect button.
6. **Swap screen** — MVB. Owned-market lane over unit 2. Done: Chromium journey opens a market, deposits, swaps with the floor stated in words, bonds; exact-amount approvals only (grep for `(1n<<256n)-1n` fails the build).
7. **`Parley`, `Roster`, Social screen** — MVB. Adapt per §6 (home rooms, reply pointer, cooldown); port `Parley.t.sol`, `verify-parley.mjs`; `DeskSeal` with per-send key re-read; ERC-7409 reactions. Done: every walk asks for exactly one block per hop; sale invalidates the sealing key; renter cannot speak.
8. **`Kiln`, `Coin`, `Launch`, Launch screen (coin + raise + graduate)** — MVB. Done: credits never move ERC-20 pre-graduation; 102 % payout regression; `graduate` opens a sealed market whose `collect` pays the Keep's Reach; selling the Keep moves the stream (test).
9. **`Locker`, `Steward`, Vault screen completion.** Port `verify-estate.mjs`'s succession half; new recovery tests (≥ 2 guardians, owner cancels, stranger cannot reset silence, plan void on transfer, `moduleTransfer` only from `STEWARD`). Done: `wouldPass` renders all statuses.
10. **`Inbox` and the inbox lane.** Adapt `AgentComms`: native postage, bodies as logs, paged ids, epoch-stamped config, `maxPostage` regression. Done: exactly one of answered/refunded; reply pays `feeSink`.
11. **`Market` (listing = seal).** Done: `buy` reverts on any fingerprint field change and on a broken floor; `list` without a seal reverts; delist unlocks.
12. **`Router` + `QuoteLens` + external tab.** From Pixel-Garden `MarketCartridge` paths and MASTER's lens; venue codehash pinning; hookless-only keys; `MockPoolManager`. Done: under-delivering venue caught by delta; no standing allowance after any call; absent on a band → tab hidden, not a 500.
13. **`GateFacet`, `Planner`, hook lane.** Branch `hciyvv` sources; `verify-launch.mjs` hook half (flags, locked deltas, `WrongFlags`, dynamic-fee guard). Done: one mined salt gives the same address on every chain, recomputed by hand in the test.
14. **Agent surfaces.** `services.json`/`llms.txt`/`.well-known` in `Manifest`, face 2 registration, `/k/` door, scoped-session journey, `manifestHash`. Done: a Node "agent" drives swap and speak through `executeAsSession` using only `services.json` and an RPC.
15. **`Nameplate` (mainnet band).** Adapt with the Sepolia NameWrapper fix; `verify-plate.mjs`. Done: `web3://<name>.eth/token/7/live` resolves on a local ENS fixture; custody-is-binding counterfeit test.
16. **`Timelock` wiring, deployment scripts, records.** `site.mjs` (deploy order, CREATE3 prediction, `assertTiles`), `testnet.mjs` (preflight with rollup fee allowance, journal, read-back, three lag defences), `recover-record.mjs`. Done: a local full deploy recovers with "0 disagreeing"; every curator call fails without the queue.
17. **Adversarial battery and documents.** `verify-findings.mjs` replays every finding in §5.1/§8 of this design and the dossiers' B/C lists; `agents.mjs`; `INVARIANTS.md` (invariant → assertion string), `SECURITY.md` with the "what survives / what is revoked" lists, `CLAUDE.md` traps. Done: `invariants-check` passes; counts written after the run.
18. **Testnet rehearsal.** Base Sepolia (self-hosted `gateway.mjs`, since `w3link.io` does not serve it) and Sepolia; `testnet-drive.mjs` Chromium journey against the live wire; `verify-gateway.mjs`. Done: every function family exercised in a journal with receipts; two independent audits scoped to `Keep`, `Reach`, `Pool`, `Launch`.
19. **Mainnet band, then Base launch.** Engine bytes and all contracts to Ethereum first (before Glamsterdam), ENS `keep.eth` bound, then Base; burner deployer destroyed; `Timelock` admin renounced after the first price is set. Done: both records recover; `/manifest` hashes equal on both bands.

---

## 14. Risks and open decisions

1. **Hub size.** `Keep` carries thirteen standards plus custody logic; the 23,000-byte budget is tight. *Recommendation*: build the monolith first (one address, cheapest reads); if unit 3 exceeds budget, adopt ANIMA's immutable diamond unchanged rather than trimming a guarantee — never a public library (measured +4 KB) or a mutable pointer.
2. **Native-ETH pool math.** New rounding surface (exact-out, native legs, sealed accumulators). *Recommendation*: one shared `pure` pricing function, `mulDivUp/Down` named per site, fuzz at dust and 2^112, and the per-token reserve cap as a hard invariant; no owned-pool v4 hook until two High-tier audits are funded.
3. **`tokenURI` gas on hosted RPCs.** The 12M budget assumes a 45–50 KB gzip body; hosted caps are "often lower" and unverified. *Recommendation*: measure on three providers at unit 4; if any caps below 12M, ship face 1 (card) as default and make `/live` the only app surface — the design already supports it.
4. **Marketplace handling of an 80 KB data URI.** Some truncate. *Recommendation*: keep face 0 ≤ 80 KB, publish ERC-7496 traits so indexers skip the big URI, and treat `web3://` as primary.
5. **Sealed markets as permanent liquidity.** Principal can never be withdrawn; fee streams pay the Keep. Holders may want an exit. *Recommendation*: keep it — it is the anti-rug guarantee buyers price; the holder exits by selling the Keep, which is the thesis.
6. **Credits-until-graduation.** Buyers cannot move curve tokens to other venues before graduation. *Recommendation*: accept; it removes two incident classes (Four.meme ×2) and `sell` on the curve remains open.
7. **Reach storage layout is frozen by CREATE2.** Any later change is a new implementation and a different account address. *Recommendation*: freeze the layout at unit 3, reserve 16 slots, and treat the implementation hash as part of the edition's identity in `/manifest`.
8. **Gateway trust and the shared origin.** All consoles under one `https://` gateway share one origin; a gateway was caught injecting a script. *Recommendation*: CSP in the head shard, `textContent`-only rendering, the hash route in the crest, `verify-gateway.mjs` in release checks, and documentation of self-hosting with `gateway.mjs`.
9. **Delegation standards.** ERC-7432 roles and ERC-8004 mirror registration are deferred. *Recommendation*: ship `rightsOf` with the 4907 user, sessions and the delegate.xyz read; add a `Roles` satellite only if a concrete rentable right appears; mirror-register only if 8004 indexers are confirmed to ignore non-canonical registries.
10. **Audit and legal posture.** Nothing in the four repositories is audited; CLARITY failed cloture; launched coins must carry no anonymity features (AMLR Art. 79). *Recommendation*: two independent audits of the deployed commit for `Keep`/`Reach`/`Pool`/`Launch`; a fixed on-chain disclaimer in `/`; the protocol never promotes a specific launch; no admin, fee or relayer on any path a holder might use for privacy.
