# Design B — Clean-room best-of-breed: **INTACT**

Architect B. Lens: ignore provenance, take the single best-proven implementation of each capability from the four dossiers and the research brief's MUST list, and compose them under one authority model. Every contract names its origin file or is marked NEW with a justification. Sizes are runtime-byte budgets derived from the measured sizes in the dossiers (IPSEITY `out/solc.json`, ANIMA `artifacts/`, Garden `docs/evidence`, MASTER `reports/contract-sizes.json`) plus the measured cost of the additions; they are targets to be re-measured by `tools/compile.mjs`, never quoted as facts.

---

## 1. Thesis and name

One ERC-721 token is one *whole* thing: an acting account (the Reach), a receive-only account (the Grip), an owned market, a social identity with an inbox, a launch desk whose fee streams pay the account, a timelocked vault, a steward for succession, and a website that the token itself serves and verifies. The property the whole design exists to prove is that the bundle moves **intact**: a sale carries every asset, position, stream and seal to the buyer in one transaction, strips every authority the seller ever delegated in the same transaction, and leaves nothing an admin could later remove, because there is no admin. Six things are singular on purpose: **one rights predicate** (`rightsOf`) that every contract consumes and none re-derives; **one custody epoch** that every delegated right is stamped with; **one key registry** (typed, epoch-bound, two namespaces); **one ratchet rule** for every time promise; **one steward** for succession and recovery; and **one byte-stream** served twice (`tokenURI` and `web3://…/token/<id>/live`) with equality asserted in CI. The packaging is ANIMA's immutable EIP-2535 diamond — facets wired in the constructor, no `diamondCut`, no initializer, no owner of the routing table — because the hub's union of responsibilities is ~45 KB of logic that cannot fit one EIP-170 unit, and a satellite-only decomposition (IPSEITY) would force the rights predicate, the custody epoch and the fingerprint to live in three different contracts.

**Name: INTACT.** One word; Latin *intactus*, "untouched, whole". It names the guarantee rather than the technology: the bundle transfers intact, the holder's guarantees stay intact because no key can touch them, and the site is served intact because its hash manifest is part of the token. It is also the word a buyer wants to hear before paying for an NFT that carries a vault.

---

## 2. Contract inventory (30 deployable contracts)

Vocabulary: **hub** = the `Intact` diamond; **Reach** = acting ERC-6551 account; **Grip** = receive-only ERC-6551 account; `acts(id, who)` = `rightsOf(id, who) & (R_HOLD | R_ACCOUNT) != 0` (holder or the token's Reach — never renter, operator or approvee); `holds(id, who)` = `R_HOLD` only (strict owner). Origins: **I** = IPSEITY `/home/user/Most-Advanced-NFT-Possible`, **A** = ANIMA `/home/user/Cutting-edge-technologically-advanced-NFT`, **G** = Pixel-Garden, **M** = MASTER-NFT-PROJECT. "V" = reuse-verbatim (renames only), "Ad" = adapt.

| # | Contract | Origin | Budget | Responsibilities | Who may call what |
|---|---|---|---|---|---|
| 1 | `Intact` (diamond) | A `contracts/diamond/AnimaDiamond.sol` V | 0.4 KB | Constructor wires facets, checks every cut is `Add`, every facet has code and the same `intactConfigHash()`, writes initial namespaced storage itself (no init contract), re-reads every routed selector (`RoutingTampered`); `fallback` delegatecalls; **no `diamondCut`** | Anyone calls through; no owner exists |
| 2 | `CoreFacet` | A `AnimaCoreFacet.sol` + I `Ipseity.sol` + G `PixelGardenKernel.sol` Ad | 13 KB | ERC-721 (Solady vendored) + per-owner index for `tokenOfOwnerByIndex`; `custodyEpoch`; time-boxed `setApprovalForAllUntil` + `approvalEpoch` (O(1) `revokeAllApprovals`); counted `lockCount`/`disputeCount` from constructor-pinned modules; `sealTransfer` ratchet; cycle guard; sealed `_update`; `panic`; ERC-2981/4906/5192/6454; `stewardTransfer` | Transfer: `holds`/`R_CUSTODY`; lock/unlock: pinned modules only; `panic`: holder or guardian; `stewardTransfer`: `STEWARD` only |
| 3 | `RightsFacet` | NEW (predicate) + A `AnimaRoles.sol` + A `AnimaAgentFacet.sol` Ad | 11 KB | `rightsOf(id, actor)`; ERC-7432 roles stamped with epoch, lock-not-escrow for irrevocable roles (≤365 d); ERC-4907 shim (`userOf = recipientOf(USER)`); guardian; agent wallet (ERC-8004 `setAgentWallet` with EIP-712/1271 proof); status Active/Paused | Roles/guardian/wallet: `holds`; status: `acts`; pause: guardian |
| 4 | `MintFacet` | G kernel mint + A `AnimaBrainFacet.sol` mint + M `IDontFuckingBelieveIt` endowment idea Ad | 6 KB | Band-deterministic mint at `PRICE`, creates Reach and Grip through the canonical registry, verifies both by codehash, `custodyEpoch = 1`, `Minted` | Anyone, payable |
| 5 | `SiteFacet` | I `Ipseity.sol` `viewOf` + A `getStateFingerprint` + NEW traits Ad | 14 KB | `tokenURI`/`tokenURIAt(id, face)` (ERC-7160), `contractURI` (7572), `scriptURI` (5169), ERC-7496 traits incl. `validateOnSale`, ERC-5646 `getStateFingerprint`, `stateOf(id)` gather-once view with `reported` bits, ERC-8004 identity views | Read-only |
| 6 | `LoupeFacet` | A `AnimaLoupeFacet.sol` V | 1.7 KB | EIP-2535 loupe | Read-only |
| 7 | `Reach` (6551 impl) | I `IpseityAccount.sol` Ad (+A `AgentAccount.sol` audit root/guardian revoke, +A branch `grantScopedSession`, +M net-debit measurement) | 18.5 KB | Measured seal; manifest/pieces; `execute` CALL-only; batch; two session kinds (allowlist, recipe); native + ERC-20 session caps by delta; epoch-stamped sessions; open-approval ledger; domain-separated ERC-1271 attestation only; `state()`/`auditRoot` | `onlySigner` = `holds`; sessions via `executeAsSession`; guardian may `revokeAllSessions`/`seal(max)` |
| 8 | `Grip` (6551 impl) | G `accounts/GripAccount.sol` + `GardenAccount.sol` + `AccountBinding.sol` V | 2 KB | Receives ETH/721/1155; `state()=0`; no spend selector exists; 1271 → `0xffffffff` | Nobody can spend |
| 9 | `Engine` | I `src/Engine.sol` V + `loadPanel` | 3.5 KB | Head/body gzip shards with the state gap; six hash-pinned panel shards; one-way `freeze()` | Curator until `freeze()`; reads public |
| 10 | `Renderer` | I `src/Renderer.sol` Ad | 16 KB | `document(id)` = head ‖ state gap ‖ body; `INFLATE` loader; faces 0/1/2; JSON metadata; `collectionURI` | Read-only |
| 11 | `Crest` | NEW (replaces I `Sigil.sol`; technique from M `OnchainRenderer`) | 4 KB | Deterministic ≤4 KB SVG still from seed and epoch, labels escaped | Read-only |
| 12 | `Premises` | I `src/Premises.sol` Ad | 14 KB | ERC-5219 router, `resolveMode()="5219"`, route table of §4, 404-not-revert, one URL per resource, hash manifest | Read-only, stateless |
| 13 | `Catalog` | I `Desk.sol` `_sel` + I `PageManifest.sol` Ad | 12 KB | Every selector/topic the app sends, hashed on chain; `services.json`; known-good EIP-7702 delegate codehashes; `catalogHash()` | Read-only |
| 14 | `AgentCard` | NEW (A `sdk` manifest rules + brief §4.5) | 12 KB | ERC-8004 `registration-v1` JSON, A2A `AgentCard`, `llms.txt`, all derived from chain state | Read-only |
| 15 | `Pool` | I `src/Pool.sol` + `lib/Curve.sol` Ad | 14 KB | One anchored market per id; native or ERC-20 quote; `swapExactIn`/`swapExactOut`; market seal ratchet; decaying sniper fee; cross-market solvency guard; no admin | Open/deposit/withdraw/sync/seal: `acts`; swap: anyone |
| 16 | `VaultRouter` | A `AgentSwapRouter.sol` + G `MarketCartridge.sol` paths Ad | 13 KB | Ownerless router to constructor-pinned venues (own `Pool`, Uniswap v3 SwapRouter02, hookless v4 PoolManager), codehash-checked, balance-delta verified, exact-approve-then-zero, native leg, quote-by-revert | `msg.sender` must be a Reach (`R_ACCOUNT`) |
| 17 | `Parley` | I `src/Parley.sol` Ad (+G `SocialCartridge` cooldown/blocks/tombstone, +A `AgentComms` postage) | 14 KB | Back-linked log speech; commons/groups/pairs; epoch-keyed stewards; `replyTo`; follows (≤256); `hidden` tombstones; per-room cooldown; `knock` with native postage escrow and reply-or-refund | Speak/found/follow/announce: `acts`; `knock`: any token's `acts`; `refund`: anyone after window |
| 18 | `Roster` | I `src/Roster.sol` V | 3.3 KB | 256-bit membership windows, `NO_ROOM` | Read-only |
| 19 | `SealedRooms` | M `extensions/privacy/MLSGroupChat.sol` Ad | 10 KB | RFC 9420 ordered transport: key packages, invitations, consent, roster commits, two confirmations, reorg freeze; identity = token id | Members by `acts` |
| 20 | `KeyRegistry` | A `core/EncryptionKeyRegistry.sol` Ad (+G epoch binding) | 3 KB | Typed keys (X25519/secp256k1/P-256/ML-KEM-768/MLS-package); token namespace stamped with epoch; wallet namespace; `keyIdOf`; ERC-7627 view | Token keys: `acts`; wallet keys: the wallet |
| 21 | `Launchpad` | A `market/AgentLaunchpad.sol` Ad (+branch `createLaunchChecked`, +G Curve "no prelaunch resale") | 17 KB | Curve raise in credits (non-transferable), time-decaying snipe tax with clamp, tax → `Coin` treasury floor, creator vest via `Locks`, permissionless price-faithful graduation into `Kiln.seed`, per-launch balance isolation, per-token rate limit | `create`: `acts` (first launch `holds`); buy/sell: anyone; graduate: anyone |
| 22 | `Kiln` | I `src/Kiln.sol` (`Kiln`, `Gate`) + G `LaunchpadCartridge` flag check Ad | 14 KB | CREATE2 `Coin` with sender-mixed salt; `mine()` hook salts as a view; `deployHook` + `WrongFlags`; `seed(launchId)` initialises the v4 pool keyed to `LaunchHook` and mints LP to `LPCustodian` | `launchInstant`: `acts`; `seed`: `Launchpad` only |
| 23 | `Coin` (per launch) | A `market/AgentToken.sol` V | 5.4 KB | Fixed supply, no owner, permit, burn-to-redeem treasury floor, `floorPerToken` | Anyone |
| 24 | `LaunchHook` (per launch) | I `Kiln.sol` `Gate` + I branch `GateFacet` + M `PhoenixLaunchHook` fee ramp Ad | 3.5 KB | `onlyPoolManager`; `beforeInitialize` accepts only its `PoolKey`; `beforeSwap` refuses before `OPENS`, returns decaying override fee (`startFee → floorFee` over `DECAY`); `beforeRemoveLiquidity` blocks negative deltas before `UNLOCKS`; no delta returns; all immutable | PoolManager only |
| 25 | `LPCustodian` | NEW (brief §2.17; M `GenesisV4Position` `collectFees` idea) | 4 KB | Holds each launch's v4 position; permissionless `collect(launchId)` pays `accountOf(id)`; principal to Reach only after `unlocksAt` by `acts` | `collect`: anyone; `withdraw`: `acts` after unlock |
| 26 | `Locks` | M `protocol/TimeVault.sol` Ad | 6.5 KB | Cliff/linear locks, native + ERC-20 by exact delta, fixed beneficiary (the Reach by default), `extend` forward-only, permissionless `release` | `lock`: anyone; `release`: anyone (pays beneficiary); `extend`: depositor or beneficiary's `acts` |
| 27 | `Steward` | I `src/Succession.sol` Ad + NEW (ERC-7878 views, guardian recovery, duress) | 8 KB | Two triggers (silence, ≥2-of-N guardians), one cancellable notice, hashed heir, `stillHereUnderDuress`, void on transfer, moves the token only via `hub.stewardTransfer` | `arrange/stillHere/cancel`: `holds`; `summon/execute`: anyone when due; `attest`: named guardians |
| 28 | `BondVault` (post-MVB) | A `registry/BondVault.sol` Ad | 6 KB | Slashable stake, reserved-not-counted coverage, unbonding stays slashable, constructor-pinned module/arbiter | `pledge`: `holds`; reserve/release: `WorkEscrow`; slash: pinned arbiter |
| 29 | `WorkEscrow` (post-MVB) | A `work/WorkEscrow.sol` Ad (+`SelfHire` fix, +receipt-grounded feedback) | 12 KB | Hire→deliver→settle/dispute with default winners; emits receipts; `publishFeedback(receiptId)` ledger with O(1) aggregate | Offer: anyone; accept/deliver: `acts`; settle: client; feedback: receipt holder |
| 30 | `IntactMonolith` (reference, not deployable today) | NEW assembly of 2–6 | ~45 KB | The monolith the suite also runs against; the deployment artifact for an EIP-7954 chain | — |

Not counted: the canonical ERC-6551 registry `0x000000006551c19487814612e58FE06813775758` (pre-existing), the ERC-7409 emote singleton (external, optional, `extcodesize`-guarded), mocks and test fixtures. Hand-rolled libraries (no deployed bytes): `Ratchet`, `Transient`, `Rights` (bit constants + `acts/holds` helpers), I `lib/SSTORE2`, `Base64`, `Web`, `Mul`, `Tick`, `LibNum`; vendored Solady `ERC721` (MIT, from G `src/vendor/`). **No import from outside `src/` anywhere**; ANIMA's OZ dependencies (`ReentrancyGuardTransient`, `SignatureChecker`, `MerkleProof`) are replaced by `Transient`, by I's `_signedByHolder` + ERC-6492 (A `libraries/ERC6492.sol`, inlined) and by dropping merkle target roots (allowlists are explicit, ≤16).

**Why a diamond, with numbers.** The hub must hold: ERC-721 with per-owner index (~4 KB), custody/approval epochs and counted locks (~3 KB), the sealed `_update` with cycle guard (~2 KB), ERC-7432 roles + 4907 shim (~5 KB, AnimaRoles is 5,107 B standalone), guardian/wallet/status (~2 KB), `rightsOf` (~1 KB), mint with two account creations and codehash checks (~5 KB), traits + fingerprint + `stateOf` gather with `reported` bits (~7 KB), the `tokenURI`/faces/contractURI/scriptURI string surface (~7 KB), ERC-165 for thirteen ids, and a loupe (1.7 KB) — ~45 KB against a 24,576-byte ceiling. IPSEITY's hub is 19,316 B *without* roles, traits, fingerprint or counted locks; ANIMA's monolith is 23,971 B *without* a site surface, two accounts or bands. The alternative — a monolith hub plus satellites holding roles/traits/fingerprint — puts the rights predicate in a satellite the Reach, Pool and Parley must all trust and makes the fingerprint a cross-contract read. The diamond costs ~4,300–5,400 gas per external call (ANIMA `Gas.test.ts`, bounded at ≤25 % or ≤6,000 gas) and buys one address, one storage namespace per concern, and no size wall for a decade of EIP-170. **If EIP-7954 (64 KiB) reaches the target chain**, the `IntactMonolith` reference — already compiled and already the subject of the same suite — is deployed instead; every satellite holds `HUB` as an immutable and every selector is identical, so nothing else changes and ~5k gas per call is returned to users.

---

## 3. The token

### 3.1 Mint

`MintFacet.mint(address to) external payable returns (uint256 id)`:

1. `if (msg.value != PRICE) revert WrongPrice();` `PRICE` and `MINT_RECIPIENT` are constructor immutables (there is no team key; proceeds go to an address fixed at deployment, named in the deployment record).
2. `id = BAND_START + minted; if (id > BAND_END) revert BandExhausted(); minted++;` — counters before any external call; `nonReentrant` through `Transient`.
3. `reach = REGISTRY.createAccount(REACH_IMPL, REACH_SALT, chainid, address(this), id)` and `grip = REGISTRY.createAccount(GRIP_IMPL, GRIP_SALT, …)`; both are verified with G's `AccountBinding`: `code.length == 173` and `codehash == keccak(runtime(impl, salt, chainid, this, id))` — a reported `token()` is never trusted.
4. `$.custodyEpoch[id] = 1; $.createdAt[id] = uint64(block.timestamp); $.status[id] = Paused;`
5. `emit Minted(id, reach, grip, BAND)`; `emit CustodyEpoch(id, 1)`.
6. `_safeMint(to, id)` **last**, so the receiver callback sees a complete token and cannot re-enter a half-made one.

Gas estimate: ~300k (Garden measured 299,485 for a mint creating both accounts; ours adds two codehash checks and one more SSTORE). Nothing else is deployed at mint: the market, inbox, launches, locks and steward arrangement are per-id state in shared immutable contracts and cost nothing until used. Burn does not exist: a token that owns a market and a vault has no burn path, by construction.

### 3.2 `_update` (sealed, non-virtual, in `CoreFacet` via the shared `IntactBase`)

```solidity
function _update(address to, uint256 id, address auth) internal override returns (address from) {
    address prev = _ownerOf(id);
    if (prev != address(0)) {
        if (_locked(id)) revert Locked(id);                          // lockCount | disputeCount
        if ($.transferSealUntil[id] > block.timestamp) revert TransferSealed(id);
        if (to == address(0)) revert NoBurn();
        _refuseCycle(id, to);   // to ∉ {this, reach(id), grip(id), REACH_IMPL, GRIP_IMPL};
                                // if AccountBinding.token(to) names this collection with id k,
                                // require ownerOf(k) ∉ {reach(id), grip(id)}  (depth-2 cycle)
    }
    from = super._update(to, id, auth);
    if (prev != address(0)) {                                        // every custody change, incl. self-transfer
        $.custodyEpoch[id] += 1;                                     // checked; never wraps
        delete $.guardian[id]; delete $.agentWallet[id]; delete $.lease[id];
        $.status[id] = Paused;
        emit IERC4907.UpdateUser(id, address(0), 0);
        emit GuardianSet(id, address(0)); emit AgentWalletSet(id, address(0));
        emit CustodyEpoch(id, $.custodyEpoch[id]);
    }
}
```

Everything else dies by **epoch, not by deletion**: ERC-7432 roles, Reach sessions, Parley sealing keys, SealedRooms memberships, the Steward arrangement, open-approval ledger freshness and the agent card's `registrations[]` all store the epoch at grant and compare it live. There is nothing to forget. What survives: the Reach's seal and manifest, the market and its seal, `Locks` whose beneficiary is the Reach, the LP position in `LPCustodian`, the Grip's contents, the public archive. `panic(id)` (holder or guardian) bumps `custodyEpoch[id]` **and** `approvalEpoch[owner]`, calls `Reach.sealMax()` and `Reach.revokeAllSessions()`, sets `Paused`, and emits `Panicked(id, epoch)` — one call kills every delegated right, tested.

### 3.3 Custody epoch

`uint64 custodyEpoch[id]`, starts at 1, incremented in `_update` on every transfer including `A→A` and steward transfers; checked arithmetic (G's rule: fail closed at exhaustion, never saturate — IPSEITY's `xfers` counter is not carried). It is the only clock any delegated right keys off, and it is the serverless session invalidator in the page: the shell re-reads it on every `accountsChanged`/`chainChanged` and before every send.

### 3.4 ERC-5646 fingerprint (normative field order, append-only)

```solidity
function getStateFingerprint(uint256 id) external view returns (bytes32) {
    return keccak256(abi.encode(
        ownerOf(id), $.custodyEpoch[id],
        Core({guardian, status, lockCount, disputeCount, transferSealUntil, createdAt, launchCount, rolesRoot}),
        $.lease[id], $.agentWallet[id],
        IReach(reach(id)).state(), IReach(reach(id)).sealedUntil(), IReach(reach(id)).openApprovalsRoot(),
        IPool(POOL).marketHash(id),            // base, quote, reserves, feeBps, sealUntil, curveBps, anchors
        ILocks(LOCKS).commitmentOf(reach(id)), // rolling hash of every lock touch (M TimeVault.accountCommitment)
        ILaunchpad(LAUNCHPAD).launchRoot(id)   // launch ids + LPCustodian unlock times
    ));
}
```

A buyer who pins this value pays for exactly what they inspected (brief MUST 3; SIP-15 covers traits only). Satellite reads use `extcodesize` + `try/catch`; a missing satellite contributes zero *and* flips a bit in `stateOf(id).reported`, so "zero" and "no answer" stay different facts. `getStateFingerprint`, `custodyEpoch` and `sealedUntil` are also exposed as ERC-7496 traits flagged `validateOnSale`.

### 3.5 `tokenURI`

`tokenURIAt(id, 0)` = `data:application/json;base64,{name, description, image: data:image/svg+xml;base64,<Crest>, animation_url: data:text/html;base64,<Renderer.document(id)>, attributes: [custodyEpoch, sealedUntil, fingerprint, market, launches, band], external_url: web3://<PREMISES>:<chainid>/token/<id>/live}`. Face 1 = the Crest SVG alone (≤4 KB, cheap for cautious clients). Face 2 = `AgentCard.registration(id)` — the ERC-8004 `registration-v1` document as `data:application/json`. `tokenURI(id)` returns face 0. `contractURI()` carries `engineHash`, `catalogHash`, the route table and the band map. `scriptURI()` (ERC-5169) returns the canonical `web3://` origin.

---

## 4. The website

### 4.1 Bytes

IPSEITY's mechanism, lifted whole: `Engine` stores the shell as gzip SSTORE2 shards in two runs, **head** (`<!doctype …</head>`) and **body**, with a gap. `Renderer.document(id)` = `head ‖ <script>self.$INTACT=[<quoted state script>,"<base64 gzip>"]</script> ‖ INFLATE loader`; the loader declares **no global** (I's `verify.mjs` grep is kept), inflates via `DecompressionStream("gzip")`, splices `<script>window.INTACT={…}</script>` before `</head>` and `document.open()/write()/close()`. The state script is built on chain by `Renderer._state(stateOf(id))` with `Web.jsonEsc` (`"`, `\`, `<` → `\x3c`): `{id, chainId, hub, reach, grip, reachImpl, gripImpl, pool, parley, launchpad, kiln, locks, steward, keys, router, catalog, owner, epoch, status, sealedUntil, marketOpen, launches, reported, sel:{…}, topics:{…}, panels:{swap:"sha256…", social:…}, rpcHint}` — every selector and topic computed by `Catalog` on chain (`bytes4(keccak256(sig))`), so the browser ships **no keccak, no ABI coder, no float**; amounts are BigInt (I `Desk.CORE_JS` discipline).

**Panels.** The shell (wallet library + Home + rights gate + confirm slab, ~14 KB gzip) is what `tokenURI` carries. The six screens are separate hash-pinned SSTORE2 shards in `Engine.panel(i)`; the shell loads a panel on demand by `eth_call` through the connected EIP-1193 provider, verifies `sha256(bytes) == INTACT.panels[name]` (a dependency-free SHA-256 as M `chain-loader.mjs:2`, because SubtleCrypto is unavailable in opaque origins), and only then evaluates it — G's `verifyHostModule` rule. This keeps `tokenURI` ≈ 6 M gas (estimate; I measured 190 gas per output byte for the nested-base64 path, so a 30 KB output lands near 6 M against the 16,777,216 cap) and keeps "two surfaces, one byte-stream" exact: `/token/<id>/live` returns the **identical** `Renderer.document(id)` bytes as `text/html` (≈1.5 M gas), and both surfaces load panels the same way.

### 4.2 Two surfaces and three boot modes

- `tokenURI` → `data:` document: opaque origin. The shell detects it (`localStorage` throws), reads everything baked into the state gap without any network, renders Home with the crest, facts, rights hints and a QR/link to the live origin; if an EIP-1193 provider is present it may `eth_call` (read methods need no account) and load panels; it never asks to sign (MetaMask PR #46186 refuses, Brave does not inject).
- `web3://<PREMISES>:<chainid>/token/<id>/live` through a gateway (`w3link.io` serves Base mainnet; `tools/gateway.mjs` self-hosts) or a native client: real origin, EIP-6963 wallets inject, everything works.
- Native `web3://` client: same as the gateway minus the gateway trust; the footer prints "verified against chain at block N" after the shell has re-hashed its own bytes against `/manifest`.

### 4.3 Route table (`Premises.request`)

| Route | Body | Served by |
|---|---|---|
| `/` | collection document (shell, no token; Home lists `openIds`, recent launches, commons heads) | Renderer |
| `/token/<id>/live` | `Renderer.document(id)`, `text/html` | Premises itself (never through a page) |
| `/token/<id>/raw` · `/face/<n>` · `/crest.svg` · `/state.json` · `/hash` | faces, the state block as JSON, `keccak256(document(id))` | Premises itself |
| `/panel/<swap\|social\|launch\|vault\|identity\|agent>` | panel JS, `Content-Type: text/javascript`, `ETag` = sha256 | Engine |
| `/services.json` · `/token/<id>/services.json` | `Catalog` (selectors, routes, archive walk rule, venue manifest) | Catalog |
| `/.well-known/agent-registration.json` · `/.well-known/agent-card.json` · `/llms.txt` · `/token/<id>/llms.txt` | AgentCard | AgentCard |
| `/manifest` | `{engineHash, shardHashes[], panelHashes{}, catalogHash, routes[]:{path, keccak}}` | Premises |
| anything else | 404 document that never echoes the path | Premises |

Rules kept from I: `resolveMode()` returns `"5219"` and is never removed; artwork routes are answered by the router from the hub and renderer, never through a page contract; one resource, one URL (trailing slash dropped, leading zeros refused); `Cache-Control: public, max-age=15` on documents, 86,400 on immutable bytes; ERC-7774 `ClearPathCache` emitted by the hub on state changes. The route table is the only thing that changed.

### 4.4 Rights gate in the page

Discovery: EIP-6963 announcements frozen and deduplicated by `rdns`, a picker whenever more than one announces, never auto-selected, choice remembered in `localStorage` as a convenience only; `eth_accounts` for quiet reconnect, `eth_requestAccounts` on a gesture; `eth_chainId` compared to `INTACT.chainId` **before any read**. Then one free call: `rightsOf(id, account) → (bits, epoch, holder)`. Bits (constants in `Rights.sol`, mirrored into the catalog):

```
R_HOLD=1  R_ACCOUNT=2  R_USE=4  R_CUSTODY=8  R_ROLE=16  R_DELEGATE=32  R_GUARDIAN=64  R_SESSION=128
```

The shell renders by bits: `R_HOLD` shows every control; `R_ACCOUNT` is never a browser wallet; `R_USE` shows "you are the user until T"; `R_CUSTODY` shows "you may transfer only"; `R_GUARDIAN` shows the pause/panic buttons; `R_SESSION` (the connected key is a live Reach session, reported as a hint; the Reach is the enforcer) opens the agent door with the key's allowlist printed. Nothing is stored; closing the tab is logout; the gate is recomputed on every account/chain change and `custodyEpoch` is re-read immediately before every send ("ownership or epoch changed — review again"). Every write goes through the confirm slab: `eth_estimateGas` first so a non-holder sees the custom error before the wallet opens, then To / Value / Function / decoded arguments (from the catalog's `kind` and arg names) / calldata digest / engine hash, then one press, then a receipt watcher for three minutes. On connect the shell also `eth_getCode(holder)`: a `0xef0100` prefix names the delegate and compares its codehash to `Catalog.knownDelegates()`; an unknown delegate hides spend buttons until acknowledged.

### 4.5 Screens

**Home** (crest, facts, rights, `reported` bits as "not reported" strings, custody epoch, fingerprint, QR to live). **Swap** (owned-pool quote beside the router's quote-by-revert; exact-amount approval as the button's current step, never unlimited; holder's side: open/deposit/withdraw/sync/seal/sniper-fee). **Social** (commons/groups/pairs walked by single-block `eth_getLogs`; `heads()` polling; "speaking as" picker from `tokenOfOwnerByIndex`; knock with postage; sealed rooms; reactions via ERC-7409 if present). **Launch** (curve raise in four steps; instant launch with `mine()` under `eth_call`; positions; collect; hook inspector reading permission bits off the address). **Vault** (both hands with `code.length` checks; seal; manifest/pieces; sessions with on-chain-hashed selector chips; open-approval ledger with one-click revoke; locks; steward). **Identity** (traits, roles, guardian, agent wallet, ERC-8004 mirror-registration, ENS `contentcontract` binding instructions). **Agent** (`/k/<id>/<key>` door: refuses a wallet that is not the key, asks `sessionAllows` before building `executeAsSession`; `services.json` viewer; `TERM.run('…')` command line from I `DeskTerm` with `commands()` as data).

### 4.6 Size budget

Shell source ≤ 60 KB (wallet library §7–8 of I `engine/ipseity.html` ≈ 25 KB verbatim, Home/gate/slab ≈ 20 KB, CSS ≈ 10 KB) → ≈ 14 KB gzip → 1 shard. Six panels ≤ 20 KB source each → ≈ 6 KB gzip each → 6 shards. Total on chain ≈ 50 KB (≈ 10 M gas to deploy, ≈ $0.03 on Base, ≈ $12 on mainnet at 0.5 gwei). Build gates (`tools/build-app.mjs`, from I `build-engine.mjs`): terser `reserved: ["INTACT"]`; loader declares nothing global; no `src="https://…"`, no `eval`, no `innerHTML` for chain strings (`textContent` only); CSP meta `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:` in every document.


---

## 5. Swap

### 5.1 The owned pool (`Pool`, from I `src/Pool.sol` + `lib/Curve.sol`)

One market per token id; `ownerOf(id)`'s Reach-or-holder is the sole LP; selling the token sells the market. The struct is I's six-slot `Market` with two changes: `quote == address(0)` means native ETH (measured by `msg.value`), and `curveWord` becomes `uint24 curveBps` (0–80,000), a holder-declared concentration applied only on `syncCurve`, replacing the 4-D section word (the merged token has no artwork signal; the social layer may feed one later, still only applied on explicit `syncCurve`).

```solidity
function openMarket(uint256 id, address base, address quote, uint16 feeBps /*≤500*/, uint24 curveBps) external;  // acts
function deposit(uint256 id, uint256 amountBase, uint256 amountQuote) external payable;                            // acts
function withdraw(uint256 id, uint256 amountBase, uint256 amountQuote, address to) external;                        // acts; never pausable (nothing to pause)
function swapExactIn(uint256 id, bool baseIn, uint256 amountIn, uint256 minOut, address to, uint64 deadline) external payable returns (uint256 out);
function swapExactOut(uint256 id, bool baseIn, uint256 amountOut, uint256 maxIn, address to, uint64 deadline) external payable returns (uint256 inUsed);
function syncCurve(uint256 id, uint24 curveBps) external;        // acts; refused while sealed
function sealMarket(uint256 id, uint64 until) external;          // acts; Ratchet.raise(cur, until, 365 days)
function setSniperFee(uint256 id, uint16 startBps, uint32 decaySeconds) external; // acts; applies from now, decays to feeBps
function quote(uint256 id, bool baseIn, uint256 amountIn) external view returns (uint256 out);
function marketHash(uint256 id) external view returns (bytes32);
function openIds(uint256 from, uint256 count) external view returns (uint256[] memory);
```

**Anchoring** is kept exactly: `Curve.anchor` runs only in `openMarket/deposit/withdraw/syncCurve`, never in a swap (the 400-in → 718-out bug), `amountOut` rounds the remaining balance up, `MAX_OUT_BPS = 5,000` bounds any single trade to half the reserve, `swapExactOut` uses the same pure function inverted with rounding against the trader, and `testFuzz_roundTripNeverProfits` is extended to `swapExactOut` and to dust (0/1/2/9 wei). **Fees**: `feeBps ≤ 500` stays in the reserves (the holder's income travels with the token); the sniper fee is additive, time-decaying, no exemptions, settable only right after `openMarket`/`deposit` (brief SHOULD 46).

**Exact fixes for the known bugs.** C1 (re-entrancy through `closeMarket` leaving reserves that `openMarket` inherits): a single `Transient` lock on *every* state-changing function, and `openMarket` writes `rBase = rQuote = vBase = vQuote = 0` explicitly. C2 (`swap` reads `vIn/vOut` after `_pull`, so a holder-controlled input token can `syncCurve` mid-pull): offsets and reserves are read into memory **before** `_pull`, and `syncCurve` is behind the same lock. C5 (cross-market over-claim with rebasing/fee tokens): `totalReserved[token]` is maintained across markets and every payout is capped at `token.balanceOf(this) − (totalReserved[token] − thisMarket.reserve)`, so a market can never pay with another market's reserves — a guard, not a monitor; the admin `bless`/allowlist/pause switches are deleted (there is no admin; `withdraw` was never pausable anyway). The authority inconsistency (I's `Pool.onlyHolder` was `ownerOf` exactly while Kiln/Parley admitted the Reach): every holder operation is `acts(id, msg.sender)`, so a session key can deposit into its own token's market through the Reach. ERC-20-only pairs: native quote added, with `msg.value` measured as the pulled amount. Rounding: only `Mul.mulDivUp`/`mulDivDown`, direction named at every call site.

### 5.2 The router to external liquidity (`VaultRouter`, NEW from A `AgentSwapRouter` + G `MarketCartridge` paths)

Ownerless. Constructor-pinned venues with their `extcodehash` recorded: the protocol's own `Pool`, Uniswap v3 `SwapRouter02`, the v4 `PoolManager` for **hookless** pools (and pools whose hook codehash equals our `LaunchHook`); no aggregator, no Aerodrome in v1 (upgradeability unreviewed), no owned-pool-as-hook. `msg.sender` must be a Reach (`rightsOf(id, msg.sender) & R_ACCOUNT`, with `id` taken from `AccountBinding.token(msg.sender)`), so every budget lives in the Reach's session policy, not here. Per call: live `deadline`; `tokenIn != tokenOut`; pre-call snapshots of **both** balances segregated from any pre-existing router balance (A's PR #13 refund bug); pull `amountIn` exactly; `approveExact(venue, amountIn)`; venue call with calldata the router *builds itself* from typed parameters (never opaque bytes — the derivatives-desk lesson, `validateTradeCalldata`); `approveExact(venue, 0)` unconditionally; `require(received ≥ minOut)` measured by delta; output and unspent input pushed to the Reach. v3 path: raw validated path (`43–112 B`, `(len−20) % 23 == 0`, endpoints equal to in/out with WETH substituted for native). v4 path: `unlock` with a single-use `Transient` commitment `keccak256(data)` re-checked in `unlockCallback`, exact-input with real `sqrtPriceLimitX96`, `din < 0 && dout > 0`, then `sync/settle/take`. `quoteExactIn(...)` executes the real path inside a `view` and reverts with `QuoteResult(spent, received, sqrtPriceAfter)` — "quote is a settlement" — and the page shows it beside `Pool.quote`. The venue table is printed on every token's site in `hooklist` shape (address, codehash, permission bits, upgradeable?, audit URL) from `Catalog.venues()`.

### 5.3 Authority predicate

Owned pool holder operations: `acts`. Router: `R_ACCOUNT` (a Reach), which means a holder swaps *through their Reach* (`Reach.execute(router, …)`) and a session key swaps through `executeAsSession` under its caps. A swap-and-lock is one `executeBatch([router.swap, locks.lock])` — M's `swapAndLock` as a recipe rather than a contract.

---

## 6. Social and messaging

### 6.1 Speech predicate and spam economics

`mayActAs(token, who) = acts(token, who)` — the holder or the token's Reach; never the renter ("a reputation is not a thing you can hand back at the end of the day"), never an operator, never an approvee. Spam control is holding a token + a per-room cooldown (`cooldown[room] ≤ 7 d`, keyed `keccak(token, epoch)`) + refundable postage for strangers. A wallet without a token cannot speak at all; that is the design, stated on the page.

### 6.2 Rooms, DMs, follows, tombstones (`Parley`, from I `src/Parley.sol`)

The archive is event logs with back-links: `Said(room indexed, from indexed, uint64 prev, uint64 prevFrom, uint64 seq, uint64 replyTo, uint8 kind, bytes body)`; per room only `{last, count, opened, members, kind, open, steward, stewardEpoch, cooldown, index}` and per token `lastSpoke`. A client reads `stateOf(room).last`, asks `eth_getLogs` for exactly that block with `topics:[said, room]`, follows the oldest log's `prev` — fifty messages is fifty single-block queries, no range scan, no indexer. Rooms: the commons (0, anyone speaks), groups (`found(by, name ≤ 48, open)`, key `keccak(1, index)`, steward may `invite/evict`, the token itself must `join`; the steward role is stamped with the steward token's custody epoch — two-sided consent as in M `WorldLedger`), pairs (`whisper(from, to, …)` derives `keccak(2, min, max)`; a raw pair key through `speak` reverts `UseWhisper`). `MAX_BODY = 1,024` public; kinds `PLAIN`, `SEALED` (nonce ‖ AES-GCM, ≤ 4,096 B, stored in a 64-entry ring per pair *in state* as well as logged, because EIP-4444 history expiry must not lose a DM); `heads(rooms[])` is the 9-second poll; `topics()` hashes the event signatures on chain; `hide(room, seq)` by the steward sets a bit in `hidden[room][seq/256]` — a presentation flag, never deletion; `follow(from, to, bool)` keeps `following[from]` as a `uint16[]` ≤ 256 (ids fit in 16 bits for a 4,096 edition) readable in one `eth_call`; `roomsOf(token)` is the only unbounded array and only the token can grow it. Per room the last 32 `(block, seq, keccak(body))` triples are kept in state so a client behind a pruned node can still verify the tail.

**Priced attention** (A `AgentComms`, native-ised): `inbox(id, postage, replyWindow 5 min–30 d, openToFollowers)` set by `acts`; `knock(to, from, body) payable` from a token not in `following[to]` escrows `msg.value == postage` and is bounded by `maxPostage` and `expectedPostage` arguments against mempool repricing; a reply by `to` within the window releases the postage to `accountOf(to)` (money lands where the swap can use it); after the window anyone may `refund(knockId)`; exactly one of `{answered, refunded}` ever becomes true.

**Reactions** call the ERC-7409 emote singleton `0x3110735F0b8e71455bAe1356a33e428843bCb9A1` with `(PARLEY, uint256(keccak256(room, seq)), emoji)` — zero bytes of ours; the page checks `extcodesize` first and shows "reactions unavailable on this chain" otherwise.

### 6.3 Keys and encryption (`KeyRegistry`, from A `EncryptionKeyRegistry`)

One registry, two namespaces: `setTokenKey(uint256 id, uint16 keyType, bytes pubkey)` requires `acts(id)` and stores `(keyType, keyId = keccak(pubkey), epoch = custodyEpoch[id])`; `tokenKeyOf(id)` returns zero unless `epoch == custodyEpoch[id]` — the seller's key dies on sale, the buyer sees a provably fresh inbox; `setWalletKey(keyType, pubkey)` keeps A's per-person directory for strangers and first contact. Key types: X25519=1, secp256k1 ECIES=2, P-256 ECIES=3, ML-KEM-768=4 (reserved), MLS KeyPackage=5. `keyIdOf` is pinned by every sealed send (`whisper(..., expectedKeyId)` reverts on rotation or absence rather than recording an undecryptable message). ERC-7627's `getPublicKeys` view is exposed over both namespaces. Browser crypto comes verbatim from G `sdk/whispers.mjs` (P-256 ECDH → HKDF → AES-256-GCM, AAD bound to chain/contract/both ids/both epochs/key versions, no forward-secrecy claim) with the P-256 scalar derived from `personal_sign("INTACT seal v1 · chain <c> · token <t> · epoch <e>")` so the key is reproducible from the wallet and dies with the epoch.

### 6.4 Sealed rooms (`SealedRooms`, from M `MLSGroupChat`)

RFC 9420 over an immutable ordered-delivery contract: `registerKey` (MLS KeyPackage, through `KeyRegistry` type 5), `create`, `invite`, `accept`, `commit(id, epoch, expectedIndex, roster[], generations[], body, welcome, transcript)`, `post(id, epoch, expectedIndex, body)`; identity is the **token id** (not the wallet, which is M's gap), memberships stamped with custody epochs, two confirmations before state advances, reorg freezes the group, `ts-mls` shipped with its unaudited status printed in the room header. ECIES (`Parley.SEALED`) only for first contact.

### 6.5 Reading without an indexer; federation

Everything above is readable with `eth_call` (`stateOf`, `heads`, `following`, `inWindow` from `Roster`, the DM ring, SealedRooms packets) plus single-block `eth_getLogs`. Federation: none in v1. I's `ParleyPort` (adminless LayerZero V2, room 0 only) is kept as a documented COULD with the brief's DVN rule (`requiredDVNCount ≥ 2` at construction); it would mirror the commons across bands and never custody.

---

## 7. Launchpad

### 7.1 Creation

Two modes behind one record (`Launch{id, token, coin, hook, poolId, terms, state}`), both requiring `acts(id)`, both rate-limited per token (`lastLaunchAt[id] + 1 day`), and the **first** launch of any token requiring `holds` (a Reach session cannot sign it — the Bankr × Grok rule in its simplest form).

- **Instant** (`Kiln.launchInstant(id, Terms)`): CREATE2 `Coin` with `salt' = keccak(msg.sender, salt)` (a mempool watcher cannot take the address); mine the hook salt as a **view** (`mine(initCodeHash, flags, from, tries)` under `eth_call`, exact low-14-bit match); `deployHook` then `require(Hook.flags(hook) == wanted)` or `WrongFlags`; initialise the v4 pool with `PoolKey(currency0, currency1, DYNAMIC_FEE, tickSpacing, hook)` and `sqrtPriceX96` from the terms; mint the LP position via PositionManager (`MINT_POSITION, SETTLE_PAIR, SWEEP`, Permit2 expiry-0 trap noted) to `LPCustodian`; creator allocation ≤ 15 % goes to `Locks` with cliff ≥ 30 d and vest ≥ 365 d, beneficiary = `accountOf(id)`; the rest of the supply is the position.
- **Curve** (`Launchpad.create(Terms)`): A's `AgentLaunchpad` maths — `k = q·b`, `newBase = ceilDiv(k, newQuote)` (round the reserve up so the trader gets less), fair window ≤ 1 day with per-address cap, time-priced snipe tax decaying from `snipeTaxStartBps ≤ 9,900` to zero at `fairWindowEnds` with the clamp `baseBps + snipeBps ≤ 9,900`, backdated starts refused, `virtualQuote != 0`, `graduationTarget != 0`. Changed from A: buyers receive **credits** (`credit[launchId][buyer]`), not tokens — the whole supply sits in the `Launchpad` and nothing is transferable before graduation by any path (Four.meme, March), so a pre-created pair has nothing to receive; sells burn credits; `claim(launchId)` mints the real `Coin` balance after graduation. Fee split is **immutable per launch**: `creatorBps + treasuryBps ≤ 125` (1.25 %), no protocol leg; the creator leg pays `accountOf(id)`, the treasury leg **and the entire snipe tax** go to `Coin.contribute` — every sniper raises every holder's redemption floor; `createLaunchChecked(terms, expectedFeeHash)` pins what the page showed. Balances are isolated per launch (`raised[launchId]` accounting plus a solvency check against the contract balance).

### 7.2 Hooks and graduation

`LaunchHook` is one immutable contract per launch: `OPENS`, `UNLOCKS`, `START_FEE`, `FLOOR_FEE`, `DECAY` immutables; `beforeInitialize` reverts unless the key is its own `PoolKey` and the fee is `DYNAMIC_FEE`; `beforeSwap` reverts `NotOpenYet` before `OPENS` and returns `floor + (start − floor)·max(0, 1 − elapsed/DECAY) | OVERRIDE_FEE`; `beforeRemoveLiquidity` reverts `StillLocked` for negative deltas before `UNLOCKS` (zero-delta fee collection allowed — I's `GateFacet`); `onlyPoolManager` on every entry; permission bits asserted in a test against `getHookPermissions()`; no delta-returning flags, nothing non-essential on the withdraw path. `graduate(launchId)` is permissionless and `nonReentrant` once `raised ≥ graduationTarget || sold ≥ curveSupply`: it computes the terminal curve price, calls `Kiln.seed(launchId, terminalSqrtPriceX96)`; if the pool was pre-initialised by a stranger, `getSlot0` must be within 1 % of terminal or `seed` reverts and the launcher may `resalt` (a new hook salt → a new `PoolKey`); `Graduated(launchId, terminalPrice, sqrtPriceX96)` emits both prices; approvals are zeroed afterwards ("leftover allowance would be a standing claim on the next launch's raise").

### 7.3 Fee routing and what the holder gets that an EOA cannot

Every v4 fee the position earns is collectable by anyone through `LPCustodian.collect(launchId)` and paid to `accountOf(id)`; principal leaves only after `unlocksAt` (ratchet, ≤ 10 y) and only to the Reach on `acts`. Because the Reach follows the token, **selling the NFT sells every stream** — Flaunch's Memestream and Uniswap's `BeneficiaryVault` without a second NFT. What a plain EOA cannot do: launch at all (`acts` only), receive fees into a sealable account whose seal survives sale, have launches appear in the token's traits and fingerprint, launch under a bounded session key with a per-token rate limit, and (v2) use the token as the Sybil cost in a CCA `IValidationHook`.

---

## 8. Vault and accounts

### 8.1 Reach (from I `IpseityAccount.sol`)

Kept whole: `execute(to, value, data, operation)` with `operation == 0` only (`OnlyCall`; no delegatecall ever; no upgrade path, address derived from the implementation); `executeBatch(Call[] ≤ 16)` snapshotting once around the batch with the `EmptyBatch` guard (A `koorbx`); the **measured seal** — before a sealed call snapshot ether, `balanceOf(this)` for every manifest asset (≤ 16) and `ownerOf` for every guarded piece (≤ 8), after it nothing may be smaller (`Shrank`), readable assets may not go blind (`WentBlind`), pieces must still be held (`PieceLeft`), `MEASURED` flags in their own array; deny-by-default on promised targets while sealed (only `transfer`/`transferFrom` may be sent to a manifest asset — the Permit2 lesson); `seal(until)` = `Ratchet.raise(sealedUntil, until, 365 days)`, survives sale; `onlySigner` = `ownerOf(id)` exactly; ERC-1271 valid **only** for `Attestation(purpose, payload, nonce, deadline)` under the `INTACT_ATTESTATION` domain with the account address and `custodyEpoch` in the struct (ERC-7739-shaped binding; a sealed account can prove who it is and is arithmetically incapable of signing a venue order; session keys → `0xffffffff`); `retireAttestations()`; `onERC721Received` refuses a token of this collection whose Reach/Grip would form a cycle (`OwnershipCycle`).

Added: `state()` and `auditRoot = keccak(prev, chainid, this, signer, to, value, selector, dataHash, operation, state, timestamp)` bumped on every state change including grants (A); the **open-approval ledger** — any `_act` whose selector is in the approval family (`approve`, `increaseAllowance`, `setApprovalForAll`, both `permit` shapes, Permit2 `approve`) records `(asset, spender)` in a ≤ 32 set; `revokeOpenApprovals()` sends `approve(spender, 0)`/`setApprovalForAll(false)` with gas-capped low-level calls that never block on a foreign revert; `openApprovalsRoot()` is in the fingerprint; `revokeAllSessions()` and `sealMax()` callable by `guardianOf(id)` as well as the signer.

### 8.2 Sessions — the one system (resolving I vs A vs G vs M)

```solidity
enum SessionKind { Allowlist, Recipe }
struct Session {
    SessionKind kind; uint64 expires; uint64 epoch;          // epoch = HUB.custodyEpoch(id) at grant
    uint128 nativeCap; uint128 nativeSpent;
    uint32 usesLeft; uint32 minInterval; uint64 lastUsed;     // Recipe only (G/M)
    bytes32 dataHash; bytes32 targetCodeHash; address target; uint256 exactValue;   // Recipe only
    uint32 listEpoch;                                          // Allowlist: epoch-keyed target/selector/spender sets ≤ 16 (I)
}
function grantSession(address key, uint64 expires /*≤365 d*/, uint128 nativeCap, AssetCap[] calldata erc20Caps /*≤8*/, address[] targets, bytes4[] selectors) external onlySigner;
function grantRecipe(address key, uint64 expires, address target, bytes32 dataHash, uint256 exactValue, uint32 uses /*1..1024*/, uint32 minInterval) external onlySigner;
function executeAsSession(address to, uint256 value, bytes calldata data) external returns (bytes memory);
function sessionAllows(address key, address to, bytes4 selector) external view returns (bool);
```

Checks on every session call: `epoch == HUB.custodyEpoch(id)` (dead on sale, not revived on buy-back), unexpired, `to != address(this)` and selector not a grant/seal/revoke (`NoPrivilegeEscalation`), status `Active`; Allowlist: target and selector in the epoch-keyed sets, the *actual spender argument* of approval-shaped calls on the target list, cumulative native cap, and **ERC-20 caps measured by balance delta** (`balanceBefore − balanceAfter ≤ cap[asset]`, M's net-debit rule, A's "a cap that stops at `msg.value` is a limit in name only"); Recipe: `keccak(data) == dataHash`, `to == target`, `to.codehash == targetCodeHash`, `value == exactValue`, `usesLeft--`, `lastUsed + minInterval ≤ now`. Worst-case exposure (`cap × uses`) is shown before the holder signs the grant (G `sessionExposure`). Session keys never sign ERC-1271. ERC-4337 is not in v1 (a companion with an immutable EntryPoint v0.9 is the SHOULD path); a Reach is never an EIP-7702 delegate. Size valve if `Reach` exceeds ~20 KB: move the pure policy evaluation into an immutable stateless `SessionPolicy` consulted by `staticcall` — no delegatecall, no upgrade.

### 8.3 Grip, locks, seals

**Grip** (G `GripAccount` on `GardenAccount`, verbatim): receives, `state() == 0`, `isValidSignature → 0xffffffff`, `supportsInterface` omits `0x51945447`; its ABI is enumerated in `verify-vault.mjs` and none of it moves an asset. Mistaken transfers in are permanent and the page says so before building the calldata. **Locks** (M `TimeVault`): `lock(asset, uint112 amount, beneficiary, start, cliff, end ≤ now + 3650 d, linear) payable`, exact-delta pulls, `release(id)` by anyone to the committed beneficiary, `extend` forward-only, `commitmentOf(beneficiary)` rolling hash; the page defaults `beneficiary = reach(id)` so a locked treasury travels with the NFT. **Three seals, one rule** (`Ratchet.raise(current, proposed, cap)`: proposed > current, > now, ≤ now + cap, else `RatchetOnly`/`TooLong`): the Reach seal (365 d), the market seal (365 d), the transfer seal on the hub (365 d); locks are the same rule with a 10-year cap; the Steward's notice can only be lengthened (duress); a behavioural policy (inbox price, sniper fee) changes only forward in time and dies with the epoch. One library, one test file, one word in the UI ("sealed until").

### 8.4 Steward (succession and recovery, one contract)

```solidity
struct Will { bytes32 heirHash; uint64 quiet; uint64 notice; uint64 lastLife; uint64 due; address dest; uint64 epoch;
              address[] guardians /*≤5*/; uint8 threshold /*≥2*/; uint32 nonce; bool duress; }
function arrange(uint256 id, bytes32 heirHash, uint64 quiet /*30–3650 d*/, uint64 notice /*14–365 d*/, address[] guardians, uint8 threshold) external;  // holds
function stillHere(uint256 id) external;                       // holds — the only sign of life
function stillHereUnderDuress(uint256 id) external;            // holds — silently sets notice = 365 d, flags for the heir's page only
function cancel(uint256 id) external;                          // holds, during any notice
function summon(uint256 id, address heir, bytes32 salt) external;   // anyone, after lastLife + quiet; keccak(heir, salt) == heirHash
function attest(uint256 id, address dest, uint32 nonce) external;    // named guardian; one count per guardian per nonce; threshold → notice starts to dest
function execute(uint256 id) external;                        // anyone after `due`: HUB.stewardTransfer(id, dest)
function getWill(uint256 id) / getObit(uint256 id)            // ERC-7878-legible views
```

The hub's `stewardTransfer` accepts only `msg.sender == STEWARD` (an immutable fixed by CREATE3 prediction) and runs the ordinary sealed `_update`, so locks and the transfer seal are respected (an heir waits out a seal; nothing bypasses a ratchet). The arrangement is stamped with the custody epoch and void on any transfer; there is no service guardian (Loopring) and no zero-guardian recovery; heirs may be "whoever holds token N" (`heirHash` of `keccak(address(0), N, salt)`) so estates chain through instruments. A bounty paid from the Reach to whoever executes a matured transfer is a COULD.

### 8.5 What survives the sale, what is revoked

Survives (the buyer's protection): Reach seal, manifest and guarded pieces; market, its reserves, fee income and seal; `Locks` to the Reach; the LP position and its unlock time; Grip contents; the public archive; the open-approval ledger (visible, revocable in one click). Revoked by epoch: every session, every role and the 4907 user, guardian, agent wallet, steward arrangement, Parley/SealedRooms keys and memberships, inbox price (re-set by the buyer), status → `Paused`. Nothing is strandable: no asset depends on an address the seller controls, and `rightsOf` for the seller returns zero bits the block after the sale.

---

## 9. Agents

An AI agent is a holder-authorised key on the Reach and nothing more. **Manifest**: face 2 of `tokenURI` is an ERC-8004 `registration-v1` document generated from chain (`agentId == tokenId`, `services[]` = the token's `web3://` routes and its `/k/<id>/<key>` door, `agentWallet = reach(id)`, `supportedTrust = ["fingerprint-pinned", "settlement-grounded-feedback"]`), hash-pinned by `manifestHash(id)`; `/.well-known/agent-registration.json`, `/.well-known/agent-card.json` (A2A) and `/llms.txt` are served by `Premises` from `AgentCard`. Mirror-registration in the canonical ERC-8004 singleton with an ERC-8217 binding is a holder action on the Identity screen — discovery only, never a correctness dependency. **`services.json`** (`Catalog`) lists every write as `{name, sig, selector, kind, target, args[]}` plus the archive walk rule and the venue manifest; its `catalogHash` is in `contractURI`, and the MCP bridge in `sdk/` refuses a catalog whose hash differs (CVE-2025-54136 class closed by construction). **Session keys**: the agent gets `grantSession` (allowlist, caps) or `grantRecipe` (exact calldata) from the holder; `propose` and `act` are separate tools, `sessionAllows` is checked as a view before any send, the first launch per token must be holder-signed, and `executeAsSession` is the only path. **Invariants tested**: transferring any token to a Reach changes no authority (Bankrbot); reputation exists only as `WorkEscrow.publishFeedback(receiptId)` after a settlement here, with the rated token bound separately from the payee; `getSummary` is never unfiltered. The agent reads the same surfaces a human does — the state block, `rightsOf`, single-block log walks — and the terminal (`TERM.run`) is the same API with a keyboard.

---

## 10. Special features kept (mechanism named)

1. **Fingerprint-bound trades with an open-approval ledger** — `getStateFingerprint` covers both accounts' `state()`, the Reach's `openApprovalsRoot()`, the market hash and lock commitment; exposed as `validateOnSale` traits so SIP-15 marketplaces enforce it; one-click `revokeOpenApprovals()`.
2. **`panic(id)`** — one call bumps `custodyEpoch` and `approvalEpoch`, seals the Reach to max, revokes all sessions, forces `Paused`, emits `Panicked`; tested that no delegated right survives it.
3. **The self-verifying site** — `/manifest` returns engine, shard, panel and per-route hashes; `/token/<id>/hash` the document hash; `contractURI` carries `engineHash` and `catalogHash`; the shell re-hashes itself and prints the block it verified against; `tools/verify-gateway.mjs` diffs a gateway's response against local `eth_call` in CI.
4. **Same address on every band** — hub, engine, premises and every satellite via CREATE3 under fixed salts; `web3://0xSAME:1/`, `:8453/`, `:10/`; ENS `contentcontract` (ERC-6821, `base:0x…`) points at the primary band; `scriptURI()` returns it.
5. **The agent card is minted with the token** — face 2 + `/.well-known/*` from chain state, hash-pinned; `services.json` with on-chain selectors; bridges refuse divergence.
6. **Agent-safe by construction** — receiving a token changes no authority (tested); feedback only via settlement receipts; first launch holder-signed.
7. **Quote is a settlement** — `VaultRouter.quoteExactIn` runs the real path and reverts with `QuoteResult`; the owned pool's pure quote is shown beside it; the venue manifest is printed in `hooklist` shape.
8. **Sell the NFT, sell the streams; the sniper tax raises the floor** — LP fees to `accountOf(id)` through `LPCustodian`; tax and treasury leg into `Coin.contribute` (burn-to-redeem floor); no exemptions, ever.
9. **The inbox that ships with the token** — epoch-bound token keys, `expectedKeyId` pinned, priced `knock` into the Reach, MLS sealed rooms keyed by token id, reactions on ERC-7409; the seller's sealed history severs cleanly.
10. **Clear-signing from chain and 7702 hygiene** — selectors, arg names and `kind` from `Catalog`; the slab renders "swap 1.0 ETH → ≥ 2,400 USDC via this token's pool"; `eth_getCode(holder)` compared to `Catalog.knownDelegates()`.
11. **The Steward** — two triggers, one cancellable notice, hashed heir, duress heartbeat, `stewardTransfer` as its only power, ERC-7878 views.
12. **"Zero" and "no answer" are different facts** — `stateOf(id).reported` bitmask from `extcodesize` + `try/catch` on every satellite; the UI prints "not reported", never 0.

---

## 11. Chain and deployment

**Bands** (edition 4,096, disjoint ids, no token bridge): band 0 **Ethereum mainnet** ids 1–256 (canonical: ENS, `contractURI`, hash manifest; neutrality for high-value custody); band 1 **Base** ids 257–3,328 (primary: v4 PoolManager, EAS, ERC-8004 singleton, RIP-7212 at 3,450 gas, sub-cent speech, `w3link.io` serves Base mainnet); band 2 **OP Mainnet** ids 3,329–4,096 (optional; same fee code and predeploys). Written "band orphaned" rule: a band whose chain dies keeps its tokens; nothing was ever bridged. All three are Cancun (transient storage) with the 2^24 transaction cap; every view is gated at 16,777,216 in CI. **Addresses**: a fresh nonce-0 deployer key per band drives a CREATE3 factory so every contract has the same address on every band; satellite addresses are predicted before the hub is deployed (the hub's `STEWARD`, `POOL`, `PARLEY`, `LAUNCHPAD`, `LOCKS`, `KEYS` immutables point at predictions; `scripts/deploy.mjs` refuses to publish if any prediction misses — I `site.mjs`/G nonce-predicted pattern). Deployer keys are burners destroyed after the deployment record is written; there are no owner functions to reach afterwards. **Cost**: ~30 contracts ≈ 300 KB of runtime ≈ 75 M gas plus constructors ≈ 95 M, engine + panels ≈ 10 M, total ≈ 105 M per band: Base at 0.006 gwei ≈ 0.0007 ETH (≈ $2 incl. L1 data); mainnet at 0.5 gwei ≈ 0.053 ETH (≈ $125) — and mainnet bytes must land **before** Glamsterdam/EIP-8037 (7× repricing, 24 KB chunks no longer fit one transaction). Mint ≈ 300 k gas. **One-way**: `Engine.freeze()`, every immutable, the diamond's routing table, each launch's hook and fee terms, every ratchet; there is no setter anywhere after deployment.

---

## 12. Toolchain

Base: **IPSEITY's** Node toolchain, because the riskiest surface is the website and IPSEITY's battery was built to attack exactly that (DOM shim + wallet shim driving served pages against the in-process EVM, byte-equality of surfaces, gas caps). Measured in this container: solc-js 0.8.36 viaIR compiles the whole IPSEITY tree in 3m57s cold with a content-addressed cache. ANIMA's Hardhat 3 is kept only as `npx hardhat node` (chain 31337, hardfork cancun) for the Chromium journeys; the suite itself is `.t.sol` run by `tools/forge.mjs` (cheatcode precompile, negative-control self-check) plus `verify-*.mjs` on `@ethereumjs/vm`. No external Solidity imports; Solady `ERC721`/`Base64` vendored.

Pipeline (`npm run check`, in order; each a CI step): `compile` (optimizer 800, viaIR, cancun, `bytecodeHash: none`; EIP-170 gate, `IntactMonolith` on an explicit exemption list) → `facets` (`tools/facets.mjs`, ported from A `deriveFacetCut`: every selector of `IIntact` routed exactly once, no `diamondCut` selector in any facet bytecode, equal `intactConfigHash()`, slots 0–2 empty, no plain state variable in any facet) → `selftest` (wallet library against published keccak/ABI/EIP-712/CREATE2-6551 vectors) → `build-app` (minify → gzip → shards; reserved globals; loader declares nothing) → `forge` (both builds via `INTACT_IMPL=diamond|monolith`; gas-drift test ≤ 25 % / ≤ 6,000) → `gas` (every view ≤ 16,777,216; `tokenURI`, `/live`, `/panel/*`, `stateOf`) → `verify` (the equality step: decode `tokenURIAt(id,0)` → `animation_url` → base64 → bytes **equal** `Premises.request(["token","<id>","live"]).body`, and both inflate to `sha256(dist/app.html)`; `/manifest` hashes equal recomputed ones) → `verify-pool` (200-trade walk, k against anchors, dust round-trips, cross-market solvency) → `verify-vault` (Grip ABI, seal, Permit2 shape, sessions die on sale and buy-back, open-approval ledger) → `verify-parley` (single-block walks, pair keys, postage, epoch keys) → `verify-launch` (`MockPoolManager` by real selectors, flags, credits, graduation price check, tax clamp) → `verify-steward` → `verify-premises`/`verify-site` (DOM shim drives every panel) → `fuzz` → `agents` → `verify-console` (Chromium, EIP-6963 picker, three boot modes) → `verify-gateway` (on records) → `recover-record` → `npm audit --audit-level=high`. Counts are written to docs only after a run (every repo's drift trap).

---

## 13. Build plan

MVB = minimum viable bundle (must ship first). Each unit: files → origin → tests → done-criterion.

1. **MVB · Skeleton and libraries** — `tools/compile.mjs`, `evm.mjs`, `forge.mjs`, `gas.mjs` (I, verbatim; add tuple ABI + EIP-7825 assertion); `src/lib/{Ratchet,Transient,Rights,SSTORE2,Base64,Web,Mul,Tick,LibNum}.sol`; vendored Solady ERC721. Tests: `Ratchet.t.sol`, `Transient.t.sol` (registry test: every slot hashed, cleared on exit). Done: `npm run check` skeleton green with the negative-control self-check burning gas.
2. **MVB · Accounts** — `Reach.sol` (I `IpseityAccount.sol`), `Grip.sol` + `AccountBase.sol` + `AccountBinding.sol` (G). Tests: I `verify-vault.mjs` (97 assertions) + G `accounts.test.mjs` ported to `.t.sol`; new: epoch-stamped sessions, ERC-20 delta caps, recipes, `EmptyBatch`, open-approval ledger, 1271 domain binding as a Safe owner. Done: every I vault invariant replays `reproduced`; Grip ABI enumerated.
3. **MVB · Hub diamond** — `Intact.sol`, `IntactBase.sol`, `DiamondStorage.sol`, `LoupeFacet.sol` (A verbatim), `CoreFacet.sol`, `RightsFacet.sol`, `MintFacet.sol`, `IntactStorage.sol`, `IIntact.sol`, `IntactMonolith.sol`; `tools/facets.mjs`. Tests: A `Diamond/Ownership/Deploy/Gas` patterns; new `Rights.t.sol` (every bit, every predicate), `Update.t.sol` (no seller authority survives; cycle guard; locks gate transfer; self-transfer bumps epoch), `Mint.t.sol`. Done: suite passes on both builds; mutation of one facet fails > 100 tests.
4. **MVB · Pool** — `Pool.sol`, `lib/Curve.sol` (I). Tests: I `Pool.t.sol` (28) + `verify-pool.mjs` + fuzz; new: C1/C2/C5 PoCs (finish I's `PoolReenter` mock), native quote, `swapExactOut`, sniper fee, `acts` admits the Reach. Done: PoCs revert on HEAD and pass on the old code.
5. **MVB · Site bytes** — `Engine.sol` (I) + panels, `Renderer.sol` (I adapted), `Crest.sol`, `Catalog.sol`, `Premises.sol` (I adapted), `tools/build-app.mjs`, `engine/app.html` (shell from I §7–8 + console), six panels. Tests: I `verify.mjs`, `verify-premises.mjs`, `selftest.mjs`; new equality step. Done: `tokenURI` ≤ 16.7 M, `/live` bytes equal, panels hash-verified, no global in loader.
6. **MVB · Locks + Steward** — `Locks.sol` (M `TimeVault`), `Steward.sol` (I `Succession` + new). Tests: I `verify-estate.mjs` subset, new `Steward.t.sol` (two triggers, cancel, duress, void on transfer, respects seals), `Locks.t.sol`. Done: `wouldPass` codes exhaustive.
7. **MVB · Parley + Roster + KeyRegistry** — `Parley.sol` (I), `Roster.sol` (I verbatim), `KeyRegistry.sol` (A adapted). Tests: I `Parley.t.sol` (26) + `verify-parley.mjs` (37); new: `replyTo`, follows, tombstones, cooldown, postage reply-or-refund, token key dies on sale. Done: the deliberately second walker reads 405 blocks of history in 3 single-block queries.
8. **MVB · Deployment and records** — `scripts/deploy.mjs` (I `site.mjs` + `testnet.mjs` lag defences + A three-defence helper + M journal/`--confirm`), CREATE3 factory, `recover-record.mjs`. Done: Base Sepolia deployment recovered with 0 disagreeing addresses.
9. **MVB · Console journeys** — `verify-console.mjs` (I branch `claude/claude-md-docs-8vvyc8` lanes as the template, EIP-6963 chooser, three boot modes) under Chromium. Done: ≥ 96 assertions; a non-holder never reaches a wallet prompt.
10. **VaultRouter** — `VaultRouter.sol` (A `AgentSwapRouter` + G `MarketCartridge` v3/v4 paths). Tests: A `SwapRouter.test.ts` (11) ported; G `ReentryRouter`/taxed-token fixtures; quote-by-revert. Done: under-delivering venue caught by delta; no standing approval after any call.
11. **Launchpad + Kiln + Coin + LaunchHook + LPCustodian** — A `AgentLaunchpad`/`AgentToken`, I `Kiln`/`Gate`/branch `GateFacet`/`lib/Hook`, G `HookConfig`. Tests: A `Launchpad.test.ts` (15) ported, I `verify-launch.mjs` (49+) with `MockPoolManager`, new credits/graduation-price/tax-clamp/resalt tests. Done: pre-initialised pool at the wrong price refused; terminal and pool prices emitted equal within 1 %.
12. **SealedRooms** — M `MLSGroupChat` re-keyed to token ids, `ts-mls` client. Tests: M communication suite. Done: replay/reorder fails AAD; reorg freezes.
13. **AgentCard + agent door** — `AgentCard.sol`, `/k/<id>/<key>` panel, `sdk/mcp.mjs` with hash-pinned catalog. Done: bridge refuses a catalog whose hash differs; Bankrbot test green.
14. **Identity screen + ENS** — ERC-7496 traits, ERC-8217 mirror-binding helper, ENS `contentcontract` wizard (I `Nameplate` custody-is-binding as a satellite if wanted). Done: SIP-15 trait validation round-trips.
15. **Accountability (post-MVB)** — `BondVault.sol`, `WorkEscrow.sol` (A) with `SelfHire`, receipts, `publishFeedback`. Done: A `Accountability.test.ts` ported; feedback impossible without a receipt.
16. **Audits and campaigns** — stateful invariant campaigns on Pool/Reach/Launchpad; two independent audits of the deployed commit; mainnet band deployed before Glamsterdam.
17. **COULD** — CCA v2.1.0 with an NFT-gated `IValidationHook`; `ParleyPort` commons federation; ERC-4337 companion; passkey session signers via ERC-7913; estate exchange with inventory digest (G/M).

---

## 14. Risks and open decisions

1. **`tokenURI` gas** — if the measured face 0 exceeds 16,777,216, face 0 becomes loader + Home only and panels stay lazy (already the design); never raise the cap assumption. *Recommend*: measure on Base and a hosted RPC before freezing the engine.
2. **Reach size** (~18.5 KB with additions) — *recommend* the `SessionPolicy` staticcall split only if measured over 21 KB; otherwise keep one contract.
3. **v4 periphery drift** — PositionManager action bytes and limit-price constants differ by version. *Recommend*: pin v4-core/periphery commit hashes per band in the deployment record and assert in `verify-launch`.
4. **MLS library unaudited** — *recommend* ship `ts-mls` with the caveat in the room header; budget a WASM evaluation of an audited library; ECIES for first contact only.
5. **EIP-4444 history** — public speech older than the retention window needs an archive node. *Recommend*: state it in `/llms.txt`; the 32-entry tail in state makes the recent past verifiable from any node.
6. **Mint economics** — price, recipient, per-band supply. *Recommend*: fixed `PRICE`, `MINT_RECIPIENT` = a Grip of token #1 (so proceeds are visible and un-adminned), bands 256/3,072/768.
7. **Paid rentals** — ERC-4907 is a free role grant here; a paid `Lease` market (I) is v2. *Recommend*: ship the role, not the market.
8. **Singleton presence** — ERC-7409 and the ERC-8004 registry are external. *Recommend*: `extcodesize`-guarded, never load-bearing; verify addresses per band at deploy.
9. **Diamond gas overhead** (~5k/call) — *recommend* accept; deploy the monolith if EIP-7954 lands.
10. **Two surfaces, one origin problem** — all consoles under one gateway host share one origin. *Recommend*: CSP + escaping everywhere, document self-hosting, and investigate per-contract subdomains before mainnet.
