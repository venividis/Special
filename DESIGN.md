# INTACT — the unified on-chain NFT protocol: final specification

Synthesised 2026-10-04 from designs A, B and C, the two judge verdicts, the research brief and the four dossiers. Implementation repository: `/home/user/special` (GitHub `venividis/Special`, branch `main`), IPSEITY's layout (`src/`, `test/`, `tools/`, `engine/`, `deployments/`, `docs/`). Donor trees: IPSEITY `/home/user/Most-Advanced-NFT-Possible` (**I**), ANIMA `/home/user/Cutting-edge-technologically-advanced-NFT` (**A**), Pixel-Garden `/home/user/Pixel-Garden` (**G**), MASTER `/home/user/MASTER-NFT-PROJECT/legacy/anima-v7` (**M**; the MASTER dossier's paths are relative to that prefix). Every byte and gas figure below is a *budget* derived from measured origins; `tools/compile.mjs` and `tools/gas.mjs` re-measure them and the docs are updated only after a run.

---

## 0. Name and thesis

**INTACT.** The hub contract is `Intact.sol`; the holder's bundle is "an Intact"; the acting account is the Reach, the receive-only account is the Grip, the website is the Premises. Judge 1's collision argument decided the name: KEEP is Keep Network's ticker (tBTC, 2020–23, merged into Threshold) and an unsearchable common word; a web search on 2026-10-04 for "INTACT" with crypto, token, protocol and NFT qualifiers found no crypto project of that name (only INT Chain's `INT`, a different word, and a non-crypto GitHub credential proxy). `web3://intact.eth/token/7/live` reads as intended; salts and EIP-712 domains carry `intact.v1.<name>`.

**Thesis.** One ERC-721 token is one whole thing: an acting ERC-6551 account with a measured seal, a receive-only account whose security is the absence of a spend function, an owned market whose sole liquidity provider is whoever holds the token, a social identity with a sealed inbox and a public archive the chain itself indexes, a launch desk whose fee streams pay the token's own account, a timelocked vault, a steward for succession, and a website the token serves and verifies from its own bytecode. The property the whole design proves is that the bundle moves **intact**: a sale carries every asset, position, stream and seal to the buyer in one transaction, strips every authority the seller ever delegated in that same transaction, and leaves nothing an admin could later remove, because after deployment there is no admin. Six things are singular on purpose: one rights predicate (`rightsOf`) that every contract consumes and none re-derives; one custody epoch every delegated right is stamped with; one key registry; one ratchet rule for every time promise; one steward; one byte-stream served twice (`tokenURI` and `web3://…/token/<id>/live`) with equality asserted in CI.

**Base and packaging (decided).** The skeleton is IPSEITY's lineage on IPSEITY's Node toolchain (Judge 2): the 22 verifiers and 149 tests are the specification of Pool, Reach, Parley, Premises and the engine, and they port only if those ABIs survive. Onto it are grafted B's authority model (single `rightsOf` with `acts`/`holds`, `Ratchet` and `Transient` libraries, `stewardTransfer` hub entry, `totalReserved` C5 guard, `expectedKeyId`, explicit `Reach.state()`, B's launch unit), and C's product rules (refuse any canonical account of this collection as a transfer recipient; sealed markets inside `Pool` with permissionless `collect` to the token's account; `syncCurve(id, expected)` writable by `mayActAs` only; `Market` where listing is a seal, post-MVB; guardian co-sign for a token's first agent-initiated launch). The hub is written ANIMA-style from day one — one shared abstract base plus facets that partition the ABI — so the **same source** builds both a monolith (`Intact`) and an immutable EIP-2535 diamond (`IntactDiamond`, facets wired in the constructor, no `diamondCut`, no owner over the routing table). `tools/facets.mjs` (ported from A `sdk/src/index.ts:679 deriveFacetCut`) derives the cut and refuses unrouted, extra or duplicate selectors; CI builds and tests both via `INTACT_IMPL=monolith|diamond`. **Ship rule:** the monolith ships if its measured runtime is ≤ 24,000 bytes; otherwise the diamond ships. Both artifacts are always built, tested and recorded, so the choice is a flag at deployment, never a rewrite.

---

## 1. What the holder gets, and the holder's journey

A holder mints one token and receives, at zero further cost until used: the Reach (`account(id)`) and the Grip (`grip(id)`), both created in the mint transaction through the canonical ERC-6551 registry and verified by codehash; a market slot in `Pool` keyed by the token id; a home room in `Parley` whose key is derived (`keccak(3, id)`) and costs nothing until the first word; an inbox configuration that defaults to open and free; a launch slot; a vault policy (seal, locks, steward) that starts empty; and a website at `web3://<PREMISES>:<chainid>/token/<id>/live` plus the same shell inside `tokenURI`.

**Screens** (one document, fragment-routed; `R` read, `S` signed through the confirm slab):

- **Home / crest** (always): id, chain, holder (ENS when reported), custody epoch, status, "sealed until", "market: closed / open / sealed until", `reported` chips ("not reported" ≠ "0"), fingerprint, "verified against chain at block N", and in viewer mode the `web3://` link, an `https://` gateway twin and a self-drawn SVG QR.
- **Swap** (`#swap`): *Your market* — open (S `openMarket`), deposit/withdraw (S), swap card quoting `Pool.quote` with the floor stated in words (S `swapExactIn`/`swapExactOut`, exact-amount approval as a step, never unlimited), fee/curve/seal/sniper settings (S, hidden under a live seal), directory from `/open`; *Elsewhere* — `Router.quoteExactIn` quote-by-revert beside the owned quote, the venue manifest in `hooklist` shape, swaps through the Reach (S `Reach.execute(ROUTER, …)`); hidden on a band without a Router.
- **Social** (`#social`): Commons (room 0), Home room (followers = `Roster.membersOf`), Rooms, DMs (sealed when both keys exist; key re-read before every send), Inbox (priced mail from strangers), reactions via the ERC-7409 singleton when present. The composer appears only with `R_HOLD|R_ACCOUNT`; a renter sees the walk and the sentence that says why they cannot speak.
- **Launch** (`#launch`): Coin (S `Kiln.launch`, `coinAt` preview), Raise (S `Launchpad.create`; buyers see the curve, the decaying tax as a countdown and `floorPerToken`), Graduate (permissionless), Positions/Collect (sealed markets; v4 positions post-MVB), Locks.
- **Vault** (`#vault`): Reach (holdings, manifest, pieces, seal with the ratchet warning, `execute`/`executeBatch` composer, open-approval ledger with one-click revoke), Grip (address, QR, permanence warning before any transfer in), Sessions (allowlist or recipe, caps, exposure printed), Steward (will, guardians, heartbeat, `wouldPass` in words), Panic (one red button, double confirm, lists what it revokes).
- **Identity** (`#identity`): traits, status (with the Active/Paused rule printed: *sessions act only while Active; a sale pauses the token; re-arm to let your keys act*), guardian, agent wallet (two-step), encryption key (`bindKey`), rights of any address, fingerprint diff, 7702 delegate status, hash manifest, ENS binding (band 0).
- **Agent** (`#agent`, post-MVB): services catalogue, session grants with on-chain-hashed selector chips, the `/k/<id>/<key>` door, audit walk.

**Flows.** *Mint* → the receipt's `Transfer(0,…)` log gives the id → open `/token/<id>/live`. *Open from a marketplace* → viewer mode: the shell renders baked state, link and QR; if a provider is injected it may `eth_call` and load panels, and it never asks to sign. *Connect* → EIP-6963 picker, `eth_chainId` compared before any read, `eth_accounts` quietly, `eth_requestAccounts` on a gesture, `eth_getCode(holder)` delegate check, then one free `rightsOf(id, account)`; panels render from the bits. *Act* → every write goes through the slab: `eth_estimateGas` first (custom errors decoded from the `err` table), To / Value / Function / arguments / calldata digest / engine hash, one press, a three-minute receipt watcher, then `rightsOf` and `custodyEpoch` re-read ("ownership or epoch changed — review again"). *Delegate* → Vault › Sessions grants a key; the agent opens the `/k` door. *Sell* → the Vault screen renders the "what survives / what is revoked" checklist before any `transferFrom` the page proposes; a listing on `Market` is a seal to the listing's expiry.

---

## 2. Authority model

**Vocabulary.** `holds(id, who) = ownerOf(id) == who`. `acts(id, who) = holds || who == account(id)` — the holder or the token's Reach, never a renter, operator, approvee or session key *directly* (a session acts only as the Reach through `executeAsSession`). Every satellite uses one of these two words and re-derives nothing else. Strict `holds` is required for: granting sessions, sealing, arranging the steward, binding keys, setting guardian/user/agent wallet, the first launch of a token, listing on `Market`, and every curator-free money path in Steward/Market.

**Rights bits** (constants in `src/lib/Rights.sol`, mirrored into the catalog):

```
R_HOLD=1  R_ACCOUNT=2  R_USE=4  R_CUSTODY=8  R_ROLE=16  R_DELEGATE=32  R_GUARDIAN=64  R_SESSION=128
function rightsOf(uint256 id, address actor) external view returns (uint16 bits, uint64 epoch, address holder);
```

HOLD = `ownerOf`; ACCOUNT = `account(id)` (never a browser wallet); USE = live ERC-4907 user (`userOf` = the hub's user field, or `Roles.recipientOf(USER)` when a Roles satellite is deployed — one read, guarded); CUSTODY = `getApproved(id)` or epoch-keyed `isApprovedForAll` (transfer only, never use); ROLE = any live ERC-7432 role (guarded read); DELEGATE = delegate.xyz v2 `checkDelegateForERC721` behind `extcodesize` + `try/catch` (viewing right only, never a write); GUARDIAN = `guardianOf(id)`; SESSION = `Reach.sessionCurrent(actor)` (a hint; the Reach is the enforcer). Satellite reads use `extcodesize` **and** `try/catch`; an absent satellite clears the bit and never reverts.

**Custody epoch.** `uint64 custodyEpoch[id]`, starts at 1 at mint, `+= 1` (checked, never wraps or saturates) on every custody change including self-transfer, `stewardTransfer` and `moduleTransfer`. It is the only clock a delegated right keys off. Everything delegated dies by **reading the epoch**, not by being cleared: Reach sessions and recipes, Parley key bindings and cooldown buckets, Postage inbox configuration, Roles grants, Steward plans, Launchpad first-launch approvals, and Market listings all store `(id, epoch)` at grant and compare live. Away-and-back revives nothing (ANIMA `RevenueRouter` revival class; tested).

**Approval epoch.** Operators are keyed `keccak256(owner, approvalEpoch[owner], operator)` (A `AnimaAgent.sol:841`); `setApprovalForAll` keeps ERC-721 semantics, `setApprovalForAllUntil(op, expiresAt)` is the timed form, `revokeAllApprovals()` is `++approvalEpoch[msg.sender]` — O(1), the Payment-Processor-class fix. `isApprovedForAll` **must** read this store because `_isAuthorized` depends on it. A single-token `approve` is cleared in `_update`.

**What sale revokes** (`_update`, sealed and non-virtual in `IntactBase`): the single approval; the 4907 user; the guardian; the agent wallet; the pinned face; the fee-sink bit; status → `Paused`; and, by epoch, every session, recipe, role, key binding, inbox price, steward plan, first-launch approval and listing. The seller's `approvalEpoch` is untouched: operator approvals are per owner, the buyer starts with none.

**What survives** (the buyer's protection): the Reach's seal, manifest and guarded pieces; the market with its reserves, fee income and seal; sealed markets' fee streams (paid to `feeSink(id)`, whoever holds it); `Locks` whose beneficiary is the Reach; v4 positions in `LPCustodian`; the Grip's contents; the public archive and home room; the name (custody is the binding); traits; open-approval ledger entries (visible, revocable in one click).

**Transfer rule (the cycle guard, decided for C's rule).** `_update` refuses `to ∈ {address(this), account(id), grip(id), REACH_IMPL, GRIP_IMPL}` and refuses **any** `to` that is a canonical Reach or Grip of this collection: `AccountBinding.token(to)` parses the 173-byte forwarder footer only when `to.code.length == 173`, and `isCanonicalAccount(to, k, role)` recomputes CREATE2 and compares the codehash (G `PixelGardenKernel.sol:281-299, 773-797`). No Intact can ever sit inside another Intact's accounts, so there is no ownership cycle at any depth, no token stranded in a Grip, and no nested-epoch leak (selling *j* can never leave the seller holding *k*'s sessions). Other collections' tokens may enter either account freely; the Reach's `onERC721Received` keeps its own-id `OwnershipCycle` check as a redundant guard. The brief's "≤ 8-hop walk" becomes unnecessary.

**Locks.** `locked(id) = lockCount[id] != 0 || guardianHold[id]`; reported by ERC-5192 `locked()` and ERC-6454 `isTransferable()`; enforced in `_update` for transfer (there is no burn). Only constructor-pinned modules (`STEWARD`, `MARKET`, `ROLES`) may `moduleLock/moduleUnlock`; `moduleUnlock` at zero reverts `NotLocked` (never a silent return). `sealTransfer(id, until)` is the holder's own ratchet (≤ 365 d).

**Each actor stated.**
- *Holder* (`R_HOLD`): everything; the only one who grants, seals, arranges, lists.
- *Reach* (`R_ACCOUNT`): acts in every satellite under `acts`; signs only attestations.
- *Renter* (`R_USE`): renders a sentence ("you are the user until T"); no money, no speech, no traits — the trait race of design A is closed because `setTrait` is `holds`.
- *Role holder* (`R_ROLE`, post-MVB `Roles`): rights live in the role's `data`, read by the page; a live role locks the token (lock-not-escrow); roles are **revocable only** in v1 and epoch-stamped, so `panic` makes every role stale and `Roles.unlockToken(id)` becomes permissionless.
- *Operator / approvee* (`R_CUSTODY`): may transfer only; never acts.
- *Session key* (`R_SESSION`): acts only through `executeAsSession`/`executeTyped`, only while `status == Active`, within caps, never 1271.
- *Guardian* (`R_GUARDIAN`): may `pause`, `panic`, `revokeAllSessions`, `sealMax`, and co-sign a first agent launch; cleared on transfer; nothing else.
- *Steward* (contract): one power — `hub.stewardTransfer(id, dest)` for a matured plan.

**Panic — the per-owner/per-token flaw, fixed.** `panic(id)` by the **holder**: `custodyEpoch[id] += 1`, `approvalEpoch[msg.sender] += 1` (their own choice to drop every operator on every token they hold), `Reach.sealMax()`, `Reach.revokeAllSessions()`, `status = Paused`, `delete getApproved[id]`, `emit Panicked(id, epoch, by)`. `panic(id)` by the **guardian**: the same, except it does **not** touch `approvalEpoch[owner]` (a per-token guardian must not revoke the owner's operators across unrelated tokens); instead it sets `guardianHold[id] = true`, under which `_update` admits only `msg.sender == ownerOf(id)` (no operator or approvee path) until the holder calls `release(id)`. Both forms are one call and both are tested to leave no delegated right alive.

**Status.** Mint sets `Active` (a fresh minter's keys work immediately); every custody change sets `Paused`; `setStatus` is `acts`; `pause` is guardian or holder. Sessions and recipes require `Active`; the holder always can act. The Identity screen prints the rule.

---

## 3. Contract inventory

Thirty deployables in diamond form (twenty-six in monolith form: `Intact` replaces rows 1–5). Origins: I/A/G/M as above; **V** verbatim (renames only), **Ad** adapt, **NEW** with justification. Budgets are runtime bytes; the EIP-170 ceiling is 24,576 on every band. **MVB** marks the minimum viable bundle.

| # | Contract | Origin | Budget (B) | Responsibilities | Callers | MVB |
|---|---|---|---|---|---|---|
| 1 | `IntactDiamond` | A `diamond/AnimaDiamond.sol` Ad (loupe folded in) | ≤ 2,500 (measured 2,004) | Constructor wires facets (`Add` only, code present, equal `intactConfigHash()`), writes initial namespaced storage itself (no init contract), re-reads every routed selector (`RoutingTampered`); `fallback` delegatecalls; implements the EIP-2535 loupe views natively; **no `diamondCut`** | anyone through; nobody owns it | ✓ |
| 2 | `CoreFacet` | I `Ipseity.sol` + A `AnimaCoreFacet.sol` Ad | ≤ 13,000 (measured 12,785) | ERC-721 with per-owner index; `custodyEpoch`; `approvalEpoch`, `setApprovalForAllUntil`, `revokeAllApprovals`; counted locks, `guardianHold`, `sealTransfer`; sealed `_update` with the canonical-account refusal; `transferFrom`/`safeTransferFrom`; `stewardTransfer`, `moduleTransfer`, `panic`, `release`; ERC-2981 (receiver/bps Timelock-set, bps ≤ 500), 5192, 6454 | transfer: `holds`/`R_CUSTODY`; locks: pinned modules; `stewardTransfer`: `STEWARD`; `moduleTransfer`: `MARKET`; `panic`: holder or guardian | ✓ |
| 3 | `RightsFacet` | NEW predicate + A `AnimaAgentFacet.sol` (guardian, status, user, wallet) Ad | ≤ 8,000 (measured 5,034) | `rightsOf`; ERC-4907 `setUser/userOf/userExpires` (+ guarded `Roles.recipientOf`); guardian; status; two-step agent wallet (`proposeAgentWallet` by holder, `acceptAgentWallet` by the wallet — proof of control by sending, no EIP-712 verifier in the hub); `feesToGrip`; `feeSink(id)` | `holds` for grants; `acts` for status; guardian for pause | ✓ |
| 4 | `MintFacet` | I `Ipseity.sol:352-407` + G kernel mint Ad | ≤ 6,000 (measured 5,368) | `mint(to)` at `price` within the band; creates Reach and Grip through the canonical registry; `isCanonicalAccount`; `account(id)`/`grip(id)` pure derivations; Timelock-fronted `setPrice`, `setRoyalty`, `withdraw(to)`, `sealPricing()` | anyone payable; curator via `TIMELOCK` | ✓ |
| 5 | `SiteFacet` | I `Ipseity.sol` `viewOf` + A `getStateFingerprint` + I ERC-7496 Ad | ≤ 10,000 (measured 8,881, with the reverting `setScriptURI`) | `tokenURI`/`tokenURIAt(id, face)` (ERC-7160, `pinFace`), `contractURI` (7572), `scriptURI` (5169), ERC-7496 traits (`curve`, `name`, `validateOnSale` flags), ERC-5646 `getStateFingerprint`, `coreOf(id)`, ERC-4906/7774 events | read-only; `setTrait`: `holds` | ✓ |
| — | `Intact` (monolith) | the same sources assembled | ≤ 24,000 to ship; **measured 25,402** (25,312 before `setScriptURI`), over the rule and over EIP-170: **the diamond ships** (`out/ship.json`) | rows 1–5 in one contract; always built and tested; size-exempt in `compile.mjs` only as a measurement | — | ✓ |
| 6 | `Reach` (6551 impl) | I `IpseityAccount.sol` Ad (+A `koorbx` `SessionScope`, +G `_perform`, +M net-debit) | ≤ 19,000 budget; **measured 20,821, accepted** — under the 21,000 valve, so no `SessionPolicy` split (docs/ACCOUNTS.md) | measured seal; manifest/pieces; `execute` op 0 only; `executeBatch` (`EmptyBatch`); `executeTyped` (spend caps + receive floors); allowlist and recipe sessions stamped with the epoch; ERC-20 delta caps; open-approval ledger; ERC-7739-wrapped attestation-only 1271; `state()`, `auditRoot`; hub/guardian `sealMax`, `revokeAllSessions` | `onlySigner` = `holds`; sessions; hub; guardian | ✓ |
| 7 | `Grip` (6551 impl) | I `GripVault.sol` V (salt string only) | 1,933 (measured 1,937) | receives ETH/721/1155; `state()==0`; `isOneWay()`; no spend selector exists; 1271 → `0xffffffff`; declines `0x51945447` | nobody can spend | ✓ |
| 8 | `Engine` | I `Engine.sol` V + panel shards | ≤ 4,000 | gzip SSTORE2 head/body shards with the state gap; `panel(i)` shards; `freeze()` one-way | curator until frozen | ✓ |
| 9 | `Renderer` | I `Renderer.sol` Ad | ≤ 17,000 | `document(view)` = head ‖ gap ‖ INFLATE; faces 0/1/2; JSON metadata; `collectionURI` | hub, Premises | ✓ |
| 10 | `Crest` | NEW (technique from I `Sigil.sol`, M `OnchainRenderer`) | ≤ 4,000 | deterministic ≤ 4 KB SVG still from `(id, epoch, status, sealed)`; labels escaped | Renderer | ✓ |
| 11 | `Premises` | I `Premises.sol` Ad | ≤ 16,000 | ERC-5219 router; `resolveMode()=="5219"`; route table §5; artwork and `/live` served by itself; `/panel/*.js`; `/manifest`; 404-not-revert; zero state | anyone (view) | ✓ |
| 12 | `Catalog` | I `ConsoleRead.sol` + `Desk.sol` `_sel` + `PageManifest.sol` services half Ad | ≤ 16,000 | the state block builder (`stateOf(id)` gather with `reported` bits, `sel`, `err`, `topics`), `services.json`, venue manifest, `knownDelegates()`, `verbWord`, `catalogHash()` | Renderer, Premises | ✓ |
| 13 | `AgentCard` | NEW (I `PageManifest` llms half + A sdk manifest rules) | ≤ 12,000 | ERC-8004 `registration-v1` (face 2), A2A card, `llms.txt`/`.md`, `/.well-known/*`, `manifestHash(id)` | Premises | post |
| 14 | `Pool` | I `Pool.sol` + `lib/Curve.sol` Ad | ≤ 17,000 (measured 12,606) | owned markets (holder sole LP) **and** sealed markets (graduation liquidity, no LP authority, fees to `feeSink`); anchored curve; native quote; `swapExactIn/Out`; `syncCurve(id, bps, expected)`; market seal ratchet; decaying sniper fee; `totalReserved` guard; no admin | owned ops: `acts`; swap: anyone; `openSealed`: `LAUNCHPAD`; `collect`: anyone | ✓ |
| 15 | `Router` | A `AgentSwapRouter.sol` + G `MarketCartridge` v3/v4 paths + M `OfficialV4QuoteLens` (MIT) Ad | ≤ 12,000 | ownerless router to constructor-pinned venues (own Pool, Uniswap v3 `SwapRouter02`, hookless v4 keys) with `extcodehash` re-check, exact-approve-then-zero, balance-delta `minOut`, calldata built from typed params, `quoteExactIn` by revert | `msg.sender` must be a canonical Reach; `quote*`: anyone | ✓ |
| 16 | `Parley` | I `Parley.sol` Ad | ≤ 10,000 (measured 9,955) | back-linked log speech; commons/home/groups/pairs; `replyTo`; epoch-keyed cooldown; `bindKey`; `whisper(..., expectedKeyId)`; `whisperStamped` → Postage; `heads`, `topics`, 4-head ring | writes: `acts`; `bindKey`: `holds` | ✓ |
| 17 | `Roster` | I `Roster.sol` V | 3,196 measured (3,267 in the donor's table, which still carried the CBOR metadata hash) | 256-bit membership windows; `membersOf` = followers | read-only | ✓ |
| 18 | `Postage` | A `comms/AgentComms.sol` Ad | ≤ 8,500 (measured 6,088) | priced first contact: native/ERC-20 escrow bounded by `maxPostage`/`expectedFeeToken`; reply-or-refund; settlement **pulled** to `feeSink(to)`; epoch-stamped inbox config | `configureInbox`: `holds`; `stamp/settle`: `PARLEY`; `expire`: anyone; `claim*`: payee | ✓ |
| 19 | `KeyRegistry` | A `core/EncryptionKeyRegistry.sol` V + ERC-7627 view | ≤ 2,500 (measured 1,941) | typed keys (X25519=1, secp256k1=2, P-256=3, ML-KEM-768=4 reserved, MLS=5); `keyIdOf`; `getPublicKeys` | any address for itself | ✓ |
| 20 | `Kiln` | I `Kiln.sol` (`Kiln`) Ad | ≤ 14,500 (measured 9,904; `Gate` 967) | CREATE2 `Coin` with sender-mixed salt, supply split between the Reach and the Launchpad; `mine()` as a view; `deployHook` + `WrongFlags`; per-token launch records; `coinAt` | `launch`: `acts` (first: `holds`) | ✓ |
| 21 | `Coin` (per launch) | A `market/AgentToken.sol` V (native quote) | ≤ 6,000 (measured 3,145) | fixed supply, no owner, permit, burn-to-redeem floor (`contribute{value}`, `redeem`, `floorPerToken`) | anyone | ✓ |
| 22 | `Launchpad` | A `market/AgentLaunchpad.sol` Ad (+branch `createLaunchChecked`) | ≤ 17,500 (measured 15,983) | credits raise; snipe tax → floor; `fail`/refund; permissionless `graduate` into `Pool.openSealed` (MVB) or `LPCustodian.seed` (post-MVB); per-launch isolation; 7-day spacing; first-launch rule + guardian co-sign | `create`: `acts`; buy/sell/graduate/fail/claim: anyone | ✓ |
| 23 | `LaunchHook` (per launch) | I `Kiln.sol` `Gate` + branch `GateFacet` + M `PhoenixLaunchHook` Ad | ≤ 4,000 | immutable v4 hook: `onlyPoolManager`, own-`PoolKey`-only `beforeInitialize`, no swaps before `OPENS`, decaying override fee, negative deltas blocked before `UNLOCKS` | PoolManager only | post |
| 24 | `LPCustodian` | NEW (brief MUST 17; M `GenesisV4Position` ideas; I branch `V4PositionPlanner` encoding) | ≤ 9,000 | `seed(launchId, sqrtPrice)` initialises the v4 pool and mints the position to itself (1 % pre-init check, `resalt`); permissionless `collect` → `feeSink(id)`; principal to the Reach after `unlocksAt` by `acts` | `seed`: `LAUNCHPAD`; `collect`: anyone | post |
| 25 | `Locks` | M `protocol/TimeVault.sol` Ad (+I `Locker.give`) | ≤ 7,000 (measured 5,404) | cliff/linear locks, native + ERC-20 by exact delta, fixed beneficiary (Reach by default), `extend` forward-only, permissionless `release`, `commitmentOf` | `lock`: anyone; `release`: anyone | ✓ |
| 26 | `Steward` | I `Succession.sol` Ad + NEW (guardians, hashed heir, duress, 7878 views) | ≤ 9,000 (measured 8,748) | silence or ≥ 2-of-N trigger, one cancellable notice, `stillHereUnderDuress`, void on transfer, `execute` → `hub.stewardTransfer` | `arrange/stillHere/cancel`: `holds`; `summon/execute`: anyone when due; `attest`: named guardians | ✓ |
| 27 | `Timelock` | I `lib/Timelock.sol` V, wired (`execute` opened) | 1,617 measured (1,675 in the donor's table with the CBOR hash; 1,634 verbatim here; −17 for the open `execute`) | 7-day delay, 14-day grace, admin rotates only through its own queue; the only curator | admin queues; anyone executes | ✓ |
| 28 | `Market` | NEW (A `AgentMarket` fingerprint pin + I `Consign` pull-payment + G inventory floors) | ≤ 10,000 | `list` = module lock + requires Reach **and** market seals ≥ `expiresAt`; `buy(id, agreed, fingerprint, floors)`; royalty first; pull `owed`; `moduleTransfer` | `list/delist`: `holds`; `buy`: anyone | post |
| 29 | `Roles` | A `registry/AnimaRoles.sol` Ad (revocable-only, epoch-stamped) | ≤ 5,500 | ERC-7432 roles that lock the token instead of escrowing it; `recipientOf(USER)` feeds the 4907 shim; permissionless `unlockToken` once stale | holder grants; anyone unlocks when stale | post |
| 30 | `Nameplate` | I `Nameplate.sol` Ad (band 0 only) | ≤ 10,000 | adminless ENS resolver: custody-is-binding, ERC-6821 `contentcontract` → Premises, ENSIP-10 wildcard; Sepolia wrapper fix (I PR #26) | anyone resolves | post (band 0) |

Libraries (no deployed bytes): I `SSTORE2`, `Base64`, `Web`, `Mul`, `Tick`, `LibNum`, `Hook`; A `ExactERC20`, `ERC6492`; G `AccountBinding` (salts `intact.reach.v1`/`intact.grip.v1`); NEW `Ratchet`, `Transient`, `Rights`, `IntactBase` (abstract), `IntactStorage` (ERC-7201 `intact.storage.core`/`intact.storage.diamond`). External singletons never deployed by us and never load-bearing: ERC-6551 registry `0x000000006551c19487814612e58FE06813775758` (runtime hash checked at hub construction), ERC-7409 `0x3110735F0b8e71455bAe1356a33e428843bCb9A1`, ERC-6538 `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538`, delegate.xyz v2, Uniswap v3/v4 periphery and Permit2 per band. No import from outside `src/` anywhere; ANIMA's OZ dependencies are replaced by `Transient`, `ExactERC20`, `ERC6492` and explicit ≤ 16 allowlists.

**Measured after wave 1 (the integration pass).** Every size above marked *measured* is `tools/compile.mjs`'s deployed-bytecode count under `bytecodeHash: "none"`, solc 0.8.36, viaIR, 800 runs. The monolith measures 25,402 B, so the ship rule picks the diamond; the facets sum to 32,068 B behind a 2,004-byte dispatcher. `test/Bundle.t.sol` deploys this whole table (rows 1–7, 14, 16–22, 25–27) pinned to one another and walks it end to end in both builds; `tools/verify-{vault,parley,launch,steward,timelock}.mjs` run against the ship build of the hub through `tools/hub.mjs`.

*Residuals, documented rather than fixed:*

- **An Intact sent to the not-yet-deployed canonical account of an unminted id is not classifiable.** `IntactBase._isCanonicalRecipient` recognises a Reach or Grip by its 173-byte forwarder code; before that id is minted the address has no code and is an ordinary recipient. The token would sit at an address that later becomes a Reach, and that Reach's `onERC721Received` cycle guard never ran. The window closes at mint and is reachable only by a deliberate transfer to a precomputed address; the page never builds that calldata.
- **`panic` keeps the guardian.** §2's list of what a panic clears omits the guardian and the hub follows the omission: a safety role is appointed, not delegated, and a guardian who has just panicked a token must still be able to panic it again (`test_aSecondPanicDoesNotRevertOnTheSeal`; `test_panicRevokesAcrossEverySatellite`). A sale clears it as before.
- **ERC-7774 `ClearPathCache` is not emitted on `setUser`, `setStatus` or `pause`** (budget); it is emitted on every custody change, seal, pin and trait write. A gateway caching `/token/<id>/state.json` across a status change serves a stale status until the next custody event; `Catalog.stateOf` is a live read.
- **Postage's payer of record is `HUB.account(from)`**, the sender token's Reach; there is no payer parameter, so a wallet-pays model is unsupported in v1.
- **A home room exists only after its steward's first word there**, so `follow` (`join(homeKey(id), …)`) reverts `NoSuchRoom` for a token that has never spoken at home. The page says so instead of offering the button.
- **`R_ROLE` is read for the USER role only** until U16 gives `IRoles` an any-role view (docs/INTERFACE-CHANGES.md).
- **`Timelock.execute` is open to anyone** (row 27 wins over the donor's `onlyAdmin`); `queue` and `cancel` remain the admin's.

*Constructor shapes, for U10's deploy script (every pin is an immutable; the mutual ones are predicted first):*

```
Reach()  Grip()                                   no constructor: HUB, chain and id come from the forwarder footer
Intact(IntactConfig c, uint256 initialPrice)      the monolith (measured, never shipped on a band where it is over EIP-170)
CoreFacet(IntactConfig c)  RightsFacet(c)  MintFacet(c)  SiteFacet(c)
IntactDiamond(IDiamond.FacetCut[] cuts, uint256 initialPrice)   cuts from tools/facets.mjs hubCut(); Add only
IntactConfig { reachImpl, gripImpl, band, bandLo, bandHi, steward, market, roles, pool, parley,
               launchpad, locks, renderer, catalog, premises, timelock }   (16 fields, this order)
Pool(address hub, address launchpad)               Parley(address hub, address keys, address postage)
Postage(address hub, address parley)               Roster(address parley, address hub)       KeyRegistry()
Locks(address hub)   Steward(address hub)          Timelock(address admin)
Kiln(address hub, address launchpad, address poolManager)
Launchpad(address hub, address kiln, address pool, address locks)        Coin: by the Kiln, CREATE2
```

Mutual pins: hub ↔ {Steward, Pool, Parley, Launchpad, Locks} (the Timelock, Roster and KeyRegistry pin one way), Parley ↔ Postage, Kiln ↔ Launchpad, Pool → Launchpad. The order `test/helpers/Deploy.sol` uses — Locks, Postage, Parley, Roster, Steward, Pool, Kiln, Launchpad, then the hub (four facets and the diamond) — needs three predictions (Parley, Launchpad, hub); `tools/hub.mjs` `predictNext` does the same for a verifier. `REGISTRY` and the two salts are `AccountBinding` constants, the same on every band.

**Dropped as code** (ideas kept where noted): I `Sigil`, `Trig`, the WebGL field, `Chrome`, every `Desk*`/`Page*` but the three sources above, `LaunchView`, `Consign`, `Lease` (v2), `ParleyPort` (v2), `Venue`; A brain/model/seal/verifiers, `BondVault`/`WorkEscrow`/`InferenceMeter`/reputation/validation (v2), derivatives, fiat gateway, omni bridge, `RevenueRouter` (the `feesToGrip` bit does the one job holders want), `AnimaBindings`; G ten-family kernel, cartridges, keeper, storage posts; M proof branch, RAILGUN, governance, OFT lanes, auction, `MLSGroupChat` (v2), every loopback service.

---

## 4. The hub token in detail

### 4.1 Source structure (one source, two builds)

```
src/hub/IntactStorage.sol   ERC-7201 layouts: `intact.storage.core` (token state), `intact.storage.diamond` (routing table)
src/hub/IntactBase.sol      abstract: storage accessors, immutables (REGISTRY, REACH_IMPL, GRIP_IMPL, salts, BAND_LO/HI,
                            STEWARD, MARKET, ROLES, POOL, PARLEY, LAUNCHPAD, LOCKS, RENDERER, CATALOG, TIMELOCK),
                            `intactConfigHash()`, sealed non-virtual `_update`, `_isAuthorized`, the approval store,
                            `acts/holds`, `_locked`, `supportsInterface`
src/hub/CoreLogic.sol       abstract is IntactBase  — rows 2
src/hub/RightsLogic.sol     abstract is IntactBase  — row 3
src/hub/MintLogic.sol       abstract is IntactBase  — row 4
src/hub/SiteLogic.sol       abstract is IntactBase  — row 5
src/hub/Intact.sol          contract Intact is CoreLogic, RightsLogic, MintLogic, SiteLogic   (the monolith)
src/hub/facets/CoreFacet.sol    contract CoreFacet is CoreLogic   (and the other three, thin deployable wrappers)
src/hub/IntactDiamond.sol   the immutable diamond with the loupe views
```

Rules enforced by tests: no facet declares a plain state variable (slots 0–2 asserted empty); every public function of `IIntact` is routed exactly once (`tools/facets.mjs`); every facet reports the same `intactConfigHash()`; no `diamondCut` selector exists in any facet bytecode; the diamond's `fallback` reverts `FunctionNotFound` for unknown selectors and refuses bare ETH exactly as the monolith does; the ERC-5646 fingerprint of an identically-lived token is byte-identical across builds; `test/Gas.t.sol` bounds the diamond's overhead at ≤ 25 % relative or ≤ 6,000 gas absolute per probed call (A `test/Gas.test.ts:25-27`).

### 4.2 Storage layout (`intact.storage.core`, normative order, append-only)

```solidity
struct Core {                 // slot-packed; never reorder — the fingerprint ABI-encodes it wholesale
    Status  status;           // Active | Paused                       (1)
    uint8   pinnedFace;       // ERC-7160 pin, reset on sale          (1)
    uint32  lockCount;        // module locks                         (4)
    uint64  custodyEpoch;     // from 1, checked increments           (8)
    uint64  transferSealUntil;// holder ratchet ≤ 365 d               (8)
    uint64  createdAt;        //                                      (8)  = 30/32
    address guardian;  bool guardianHold; bool feesToGrip; uint32 launchCount;   // slot 2
    address user;      uint64 userExpires;                                       // slot 3 (ERC-4907)
    address agentWallet; address proposedWallet;                                 // slots 4–5
    bytes32 curve;            // slot 6: the ERC-7496 `curve` trait word (concentration bps in the low 17 bits)
    bytes32 nameHash;         // slot 7: keccak of the `name` trait
}
struct Layout {
    mapping(uint256 => address) owner;  mapping(address => uint256) balance;
    mapping(address => mapping(uint256 => uint256)) ownedAt;  mapping(uint256 => uint256) ownedIndex;   // per-owner index
    mapping(uint256 => address) approved;
    mapping(address => uint64) approvalEpoch;  mapping(bytes32 => uint64) operatorUntil;  // keccak(owner, epoch, op) → expiry (max = forever)
    mapping(uint256 => Core) core;
    uint256 minted;  uint256 price;  address royaltyReceiver;  uint16 royaltyBps;  bool pricingSealed;
    mapping(uint256 => string) nameTrait;
}
```

### 4.3 Mint (exact order)

`mint(address to) external payable returns (uint256 id)` — one transaction, `Transient` lock:

1. `if (msg.value != $.price) revert WrongPrice();` `id = BAND_LO + $.minted; if (id > BAND_HI) revert BandExhausted(); $.minted += 1;` — counters before any external call; `seed` is a label (`keccak(chainid, this, id)`), never `block.*`.
2. `_mintBare(to, id)` — ownership and the per-owner index, **no receiver callback yet**; `core.custodyEpoch = 1; core.status = Active; core.createdAt = now`.
3. `reach = REGISTRY.createAccount(REACH_IMPL, REACH_SALT, chainid, this, id)`; `grip = REGISTRY.createAccount(GRIP_IMPL, GRIP_SALT, chainid, this, id)`; then `require(isCanonicalAccount(reach, id, false) && isCanonicalAccount(grip, id, true))` — CREATE2 recomputation **and** the 173-byte forwarder codehash (G `AccountBinding`); a reported `token()` is never trusted.
4. `emit Transfer(0, to, id); emit Minted(id, reach, grip, BAND); emit CustodyEpoch(id, 1); emit MetadataUpdate(id);`
5. `_checkOnERC721Received(to, id)` **last**, so a contract minter sees a complete token and cannot re-enter a half-made one.

Nothing else is deployed at mint: the market, home room, inbox, launches, locks and steward plan are per-id state in shared immutable contracts. Gas: Garden measured 299,485 for a mint creating both accounts through the canonical registry; ours adds two codehash checks and the `Core` write — **estimate 320,000–360,000**, gated ≤ 400,000 in `test/Gas.t.sol`. Burn does not exist.

### 4.4 `_update` (sealed in `IntactBase`)

```solidity
function _update(address to, uint256 id, address auth) internal returns (address from) {
    address prev = $.owner[id];                                    // zero at mint
    if (prev != address(0)) {
        if (_locked(id)) revert Locked(id);                        // lockCount | guardianHold (guardianHold admits prev == msg.sender only)
        if ($.core[id].transferSealUntil > block.timestamp) revert TransferSealed(id);
        if (to == address(0)) revert NoBurn();
        _refuseCanonical(id, to);                                  // §2 transfer rule
        if (auth != address(0)) _checkAuthorized(prev, auth, id);  // owner, approved, or epoch-keyed operator; guardianHold → owner only
    }
    _move(prev, to, id); delete $.approved[id];
    if (prev != address(0)) {
        Core storage c = $.core[id];
        c.custodyEpoch += 1;                                       // checked; every custody change incl. self-transfer and steward moves
        delete c.user; delete c.userExpires; delete c.guardian; delete c.agentWallet; delete c.proposedWallet;
        c.feesToGrip = false; c.pinnedFace = 0; c.status = Paused;
        emit UpdateUser(id, address(0), 0); emit GuardianSet(id, address(0)); emit AgentWalletSet(id, address(0));
        emit CustodyEpoch(id, c.custodyEpoch); emit MetadataUpdate(id); emit ClearPathCache(_paths(id));
    }
    emit Transfer(prev, to, id);
}
```

`stewardTransfer(id, to)` (`msg.sender == STEWARD`) and `moduleTransfer(id, to)` (`msg.sender == MARKET`) call `_update(to, id, address(0))` — the ordinary sealed path, so locks held by *other* modules and the transfer seal are respected (an heir waits out a seal; nothing bypasses a ratchet). The calling module releases its own lock first.

### 4.5 Fingerprint (ERC-5646)

```solidity
function getStateFingerprint(uint256 id) external view returns (bytes32) {
    if ($.owner[id] == address(0)) revert NoSuchToken();
    return keccak256(abi.encode(
        $.owner[id], $.core[id],                                           // whole normative struct
        _traitsRoot(id),                                                   // keccak(curve, nameHash)
        _reach(id).state(), _reach(id).sealedUntil(), _reach(id).openApprovalsRoot(),
        _guarded(POOL, IPool.marketHash, id),            // base, quote, reserves, feeBps, sealUntil, curveBps, anchors
        _guarded(LOCKS, ILocks.commitmentOf, account(id)),
        _guarded(LAUNCHPAD, ILaunchpad.launchRoot, id),  // launch ids, targets, unlock times
        _guarded(STEWARD, ISteward.planHash, id)));
}
```

Guarded reads use `extcodesize` + `try/catch`; a missing satellite contributes zero and flips a `reported` bit in `Catalog.stateOf(id)`. Balances are excluded (inbound transfers must not break a trade); `Market` orders carry explicit floors. A test mutates every field once and asserts the hash moved. `custodyEpoch`, `sealedUntil`, `marketSealedUntil`, `fingerprint` and `locked` are ERC-7496 traits flagged `validateOnSale`.

### 4.6 `tokenURI`, faces, traits, interfaces

`tokenURI(id)` = `tokenURIAt(id, pinnedFace)`; face 0 = `data:application/json;base64,{name:"INTACT #id", description (one fixed sentence), image: data:image/svg+xml;base64,<Crest>, animation_url: data:text/html;base64,<Renderer.document(view)>, external_url: web3://<PREMISES>:<chainid>/token/<id>/live, attributes:[…]}`; face 1 = the Crest JSON alone (cheap); face 2 = `AgentCard.registration(id)` (post-MVB; until then face 2 returns face 1). `scriptURI()` (ERC-5169) returns the `web3://` origin. `contractURI()` carries `engineHash`, `catalogHash`, the route table and the band map. Traits: `curve` (holder-set concentration word, `setTrait` is `holds`, applied to the pool only on `syncCurve(id, bps, expected)`), `name` (≤ 32 bytes, UTF-8 validated, `Web.esc`'d everywhere). Interfaces claimed and recomputed in `Standards.sol`: ERC-165, 721, 721Metadata, 721Enumerable-lite (`tokenOfOwnerByIndex`, `totalSupply`), 2981, 4906, 4907, 5169, 5192, 5646, 6454, 7160, 7496, 7572, 7774. Not claimed: 7857 (`Standards.sol` explains), 721C, 7631.

### 4.7 Curator (bounded, documented, renounced)

`TIMELOCK` (I `lib/Timelock.sol`, 7-day delay, 14-day grace) is the only caller of `setPrice`, `setRoyalty(receiver, bps ≤ 500)`, `withdraw(to)` (mint proceeds) and `sealPricing()` (one-way: freezes price and royalty, leaves `withdraw`). The Timelock admin is a burner at deployment and is handed to a 2-of-3 multisig that can only queue, or renounced, after the first price is set; the deployment record names which. That is the whole of what is curated; `Engine.freeze()` precedes the first mint.

---

## 5. Website delivery

### 5.1 Bytes and the two surfaces

`Engine` stores the **shell** as gzip SSTORE2 shards in two runs — head (`<!doctype…</head>` prologue with the CSP meta) and body — plus six hash-pinned **panel** shards (`panel(i)`: swap, social, launch, vault, identity, agent), each gzip ≤ 8 KB. `Renderer.document(view)` = `head ‖ <script>self.$INTACT=[<quoted state script>,"<base64 gzip body>"]</script> ‖ INFLATE` (I `Renderer.sol:50-60` verbatim, `$IPSE` → `$INTACT`): the loader declares **no global**, inflates with `DecompressionStream("gzip")`, splices `<script>window.INTACT={…}</script>` before `</head>` and `document.open()/write()/close()`s. The state script is built by `Catalog.state(id)`: `{id, chainId, hub, reach, grip, reachImpl, gripImpl, pool, router, parley, roster, postage, keys, kiln, launchpad, locks, steward, market, catalog, premises, owner, epoch, status, clocks:{sealedUntil, marketSealedUntil, userExpires, transferSealUntil}, reported, sel:{…}, err:{"0x…":"NotHolder",…}, topics:{said:"0x…",…}, panels:{swap:"0x<keccak>",…}, engineHash, block}` — every string through `Web.jsonEsc` (`<` → `\x3c`), every selector and topic `bytes4(keccak256(sig))` computed on chain, no RPC URL anywhere.

- **`data:` surface (viewer).** Opaque origin (`localStorage` throws — the detector). The shell renders Home from the baked state: crest, facts, rights hints, custody epoch, fingerprint, the `web3://` link, an `https://` gateway twin and a self-drawn QR. Nothing signable exists in this document; it says so. If an EIP-1193 provider is injected, the shell **may** `eth_call` (`Engine.panel(i)`, `rightsOf`, `Pool.quote`…) and load panels as an enhancement; it never calls `eth_requestAccounts` and never asks to sign. There is no public RPC in any document.
- **`web3://` surface (the console).** `Premises.request(["token","<id>","live"])` returns `Renderer.document(view)` byte-for-byte as `text/html` on a real origin (gateway or native client). Wallets inject, EIP-6963 works, every control renders.

### 5.2 Panels: ordinary resources, hash-checked, no eval

On the live origin, `/panel/<name>.js` is served by Premises from `Engine.panel(i)` (inflated, `Content-Type: text/javascript`, `ETag` = keccak). The shell `fetch`es the panel, computes `keccak256` with the wallet library's own keccak (I `ipseity.html` §7, proven by `selftest.mjs`), compares it to `INTACT.panels[name]` baked in the state gap (which equals `/manifest`'s entry), and only then injects it as `<script src="blob:…">`. In the `data:` viewer with a provider, the same bytes come from `eth_call Engine.panel(i)` and go through the identical check and Blob injection. CSP in the head shard: `default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'self'; form-action 'none'; base-uri 'none'` — no `eval`, no `new Function`, no `src="https://…"`, no `innerHTML` for chain strings (`textContent` only), and `connect-src 'self'` so the only network path is the origin that served the page plus the injected provider.

### 5.3 Route table (`Premises.request`)

| Route | Body | Served by | Gas budget |
|---|---|---|---|
| `/` | collection document (shell, no token; lists `openIds`, recent launches, commons heads) | Renderer | ≤ 2.5 M |
| `/token/<id>/live` | `Renderer.document(view)`, `text/html` | Premises itself (never a page) | ≤ 2.5 M |
| `/token/<id>/raw` · `/face/<n>` · `/crest.svg` · `/state.json` · `/hash` | the data URI, one face, the SVG, the state block, `{document, head, body, state, block}` keccaks | Premises itself | ≤ 8 M / 0.5 M / 0.5 M / 1 M / 2.5 M |
| `/panel/<swap|social|launch|vault|identity|agent>.js` | panel bytes, `ETag` | Premises from Engine | ≤ 1 M |
| `/services.json` · `/token/<id>/services.json` · `/open` | catalog, per-token catalog, open-market directory (48 per page) | Catalog | ≤ 1 M |
| `/.well-known/agent-registration.json` · `/.well-known/agent-card.json` · `/llms.txt` · `/llms.md` · `/token/<id>/llms.txt` | agent surface (post-MVB; 404 until `AGENTCARD` has code) | AgentCard | ≤ 1 M |
| `/manifest` | `{engineHash, shardHashes[], panelHashes{}, catalogHash, routes[]:{template, keccak}}` over route *templates* (not 4,096 ids) | Premises | ≤ 3 M |
| `/k/<id>/<key>` · `/c/<id>` · `/token/<id>` | 301 → `/token/<id>/live?as=<key>` / `/token/<id>/live` | Premises | — |
| anything else | 404 document that never echoes the path | Premises | — |

Rules kept from I: `resolveMode()` returns `"5219"` and is never removed; artwork and `/live` are answered by the router from the hub and renderer, never through a page contract; one resource, one URL (trailing slash dropped, leading zeros refused); `Cache-Control: public, max-age=15` on documents and 86,400 on immutable bytes; ERC-7774 `ClearPathCache` emitted by the hub on state changes; `Link: </token/<id>/services.json>; rel="service-desc"`.

### 5.4 Boot modes, wallet discovery, rights gate

Three boot modes — opaque origin (viewer), gateway `https://` (console), native `web3://` (console; footer prints "verified against chain at block N" after the shell re-hashes its own inflated bytes against `/token/<id>/hash`). Discovery: EIP-6963 announcements frozen and deduplicated by `rdns`, a picker whenever more than one announces, never auto-selected, the choice remembered in `localStorage` as a convenience only (wrapped in try/catch); `window.ethereum` only when none announce; `eth_chainId` compared to `INTACT.chainId` **before any read**, with a switch button on mismatch. On connect: `eth_getCode(holder)`; a `0xef0100` prefix names the delegate and compares its codehash to `Catalog.knownDelegates()` (MetaMask `0x63c0…`, `Simple7702Account`, `SemiModularAccount7702`, Calibur); an unknown delegate hides spend buttons until acknowledged. Then one free `rightsOf(id, account)`; `body.dataset.rights` drives rendering; rights are recomputed on `accountsChanged`/`chainChanged` and `custodyEpoch` is re-read immediately before every send. Nothing is stored; closing the tab is logout; no SIWE, no nonce, no server; delegate.xyz is a viewing right only.

### 5.5 Degradation rules and size budgets

`Catalog.state` reads every satellite behind `extcodesize` **and** `try/catch` (`try` alone reverts on a codeless address) and sets one `reported` bit per contract actually answered. The shell prints a clear bit as "not reported" (grey chip; "not deployed on this chain" when `extcodesize` was zero, "could not be read at block N" when the call reverted) and never as 0. Absent `Router` → the Elsewhere tab is hidden; absent `Nameplate` → no ENS row; absent ERC-7409 → "reactions unavailable on this chain"; the page is never a 500.

Budgets: shell source ≤ 60 KB (wallet library I `ipseity.html` lines 1859–2396 = 24,449 B verbatim; Home/gate/slab/QR ≈ 22 KB; CSS ≈ 10 KB) → ≈ 14 KB gzip → 1 body shard; six panels ≤ 20 KB source each → ≈ 6 KB gzip each. `tools/build-app.mjs` (from I `build-engine.mjs`): terser `reserved:["INTACT"]`, fails if the loader declares a global, if any `src="https://`, `eval(`, `new Function` or `(1n<<256n)-1n` appears, or if the shell gzip exceeds 18,000 B. **Gas gates (CI, `tools/gas.mjs`):** `tokenURI(id)` ≤ **8,000,000** (expected ≈ 6.5 M at the measured 192 gas per output byte for a ≈ 34 KB output); `/token/<id>/live` ≤ 2,500,000 (expected ≈ 1.8 M at 82 gas/byte); every other view ≤ 16,777,216; nothing over 50 M anywhere. The 8 M number is a budget derived from the measured rate, not an aspiration; if a build exceeds it the build fails and the shell shrinks.

---

## 6. Swap

### 6.1 The owned market and sealed markets (`Pool`, from I `Pool.sol` + `lib/Curve.sol`)

```solidity
struct Market {
    address base; address quote;              // address(0) = native ETH on either side
    uint112 rBase; uint112 rQuote;            // real reserves
    uint16  feeBps;                           // ≤ 500
    uint16  sniperBps; uint64 sniperUntil;    // decaying post-open fee ≤ 9,000 bps over ≤ 98 min
    bool    open; bool sealedMarket;          // sealedMarket = graduation liquidity, no LP authority
    uint64  sealUntil;                        // ratchet ≤ 365 d, survives sale (was `bondUntil`)
    uint24  curveBps;                         // concentration 0..80,000, anchored
    uint128 vBase; uint128 vQuote;            // ANCHORED virtual offsets (never written by a trade)
    uint112 feeBaseOwed; uint112 feeQuoteOwed;// sealed markets only
    uint256 beneficiary;                      // sealed markets: the token whose feeSink is paid
}
mapping(uint256 => Market) public marketOf;   // owned: key = id; sealed: key = uint256(keccak256("intact.sealed", launchId))
mapping(address => uint256) public totalReserved;   // Σ reserves of that token across every market

function openMarket(uint256 id, address base, address quote, uint16 feeBps, uint24 curveBps, uint16 sniperBps, uint32 sniperSeconds) external;  // acts
function deposit(uint256 id, uint256 amountBase, uint256 amountQuote) external payable;              // acts
function withdraw(uint256 id, uint256 amountBase, uint256 amountQuote, address to) external;          // acts; never pausable
function closeMarket(uint256 id) external;                                                            // acts; both reserves zero; deletes
function swapExactIn(uint256 key, bool baseIn, uint256 amountIn, uint256 minOut, address to, uint64 deadline) external payable returns (uint256 out);
function swapExactOut(uint256 key, bool baseIn, uint256 amountOut, uint256 maxIn, address to, uint64 deadline) external payable returns (uint256 inUsed);
function quote(uint256 key, bool baseIn, uint256 amountIn) external view returns (uint256 out);
function syncCurve(uint256 id, uint24 curveBps, uint24 expected) external;     // acts; refused under seal; reverts CurveMoved
function setFee(uint256 id, uint16 feeBps) external;                           // acts; refused under seal
function sealMarket(uint256 id, uint64 until) external;                        // acts; Ratchet.raise(cur, until, 365 days)
function openSealed(bytes32 launchKey, address base, address quote, uint16 feeBps, uint256 amountBase, uint256 beneficiary) external payable returns (uint256 key);  // LAUNCHPAD only
function collect(uint256 key) external;                                        // anyone; pays HUB.feeSink(beneficiary)
function writeDown(uint256 id) external;                                       // acts; reserves := min(reserves, solvent share)
function marketHash(uint256 key) external view returns (bytes32);
function openIds(uint256 from, uint256 count) external view returns (uint256[] memory);
function sealedIds(uint256 from, uint256 count) external view returns (uint256[] memory);
```

**Mechanics kept exactly.** `(x+vx)(y+vy)=k`; `Curve.anchor` runs only in `openMarket/deposit/withdraw/syncCurve`, never in a trade (the 400-in → 718-out fuzz-caught bug); `amountOut` rounds the pool's remainder up; `MAX_OUT_BPS = 5,000` bounds any trade to half the real reserve; `swapExactOut` inverts the same `pure` function with `mulDivUp` on the input; `quote` and `swap` share one pure function; only `Mul.mulDivUp/Down`, direction named at every call site; `testFuzz_roundTripNeverProfits` covers both directions at 0/1/2/9 wei and 2^64/2^112. Fees stay in the reserves of an owned market (the holder's income travels with the token); on sealed markets they accrue to `feeBaseOwed/feeQuoteOwed`. The sniper fee is additive, decays linearly to `feeBps`, is settable only in `openMarket` (never re-armed by `deposit`, so a holder cannot re-arm it against standing traders), and has no exemption list because there is no list.

**Exact fixes.** *C1* (`Pool.sol:356-392`): one `Transient` lock (slot `keccak256("intact.pool.lock") − 1`, cleared on every exit) on **every** state-changing function including `openMarket/closeMarket/setFee/sealMarket/syncCurve/openSealed/collect`; `openMarket` begins with `delete marketOf[id]` and then writes, so no struct inherits a phantom reserve; `closeMarket` requires both reserves zero. I's `test/mocks/PoolReenter.sol` and `tools/poc-pool.mjs` are finished as `test_aMarketCannotBeReopenedOverAPhantomReserve`. *C2* (`Pool.sol:560-565`): `rIn, rOut, vIn, vOut` are read into memory **before** `_pull`; `syncCurve` is under the lock, so a `SyncInsidePull` mock token reverts `Reentrancy`. *C5*: `totalReserved[token]` is maintained on every reserve change; every payout is capped at `token.balanceOf(this) − (totalReserved[token] − thisMarket.reserve)`, computed with checked arithmetic so a downward rebase makes the cap zero and `withdraw` reverts `Insolvent` — fail closed, stated and tested; the holder's `writeDown(id)` reduces its own reserves to the solvent share to recover. The admin switches (`setPaused`, `bless`, `setAllowlistEnforced`, `proposeAdmin`) are deleted; there is no admin. *B2* (renter sync race): `syncCurve(id, bps, expected)` takes the value the holder saw and reverts `CurveMoved`; the `curve` trait is `holds`-only, so no renter or approvee has a pricing lever. *Authority*: every holder operation is `acts(id, msg.sender)` (I's `onlyHolder` was `ownerOf` exactly), so a session key can deposit into its own token's market through the Reach. *Native ETH*: `address(0)` on either side; the native leg must equal `msg.value` exactly (`WrongValue`); pushes are `call{value}` reverting `TransferFailed`; the ERC-20 leg is measured on arrival (fee-on-transfer safe).

**Sealed markets** are created only by `Launchpad.graduate`; `rBase/rQuote` are principal nobody can withdraw, ever; `collect(key)` pays accumulated fees to `HUB.feeSink(beneficiary)` — the Reach by default, the Grip if the holder set `feesToGrip` (the page says "income into the Grip is permanently unspendable" before the bit is set). This is the brief's "LP to an immutable custodian with permissionless collect" with the Pool as its own custodian: **selling the Intact sells the launch's fee stream** with no v4 dependency and no second NFT.

**Events:** `MarketOpened(id, base, quote, feeBps, curveBps)`, `SealedOpened(key, launchKey, base, quote, beneficiary)`, `Deposited`, `Withdrawn`, `Swapped(key, trader, baseIn, amountIn, amountOut, fee)`, `CurveSynced(id, curveBps)`, `CurveAnchored(key, vBase, vQuote)`, `MarketSealed(id, until)`, `Collected(key, to, base, quote)`, `WrittenDown(id, base, quote)`. **Errors:** `NotActor`, `MarketNotOpen`, `MarketAlreadyOpen`, `MarketNotEmpty`, `SameToken`, `ZeroAmount`, `FeeTooHigh`, `TradeTooLarge`, `Slippage(got, wanted)`, `Expired`, `WrongValue`, `TransferFailed`, `Reentrancy`, `Sealed(until)`, `RatchetOnly`, `TooLong`, `CurveMoved`, `Insolvent`, `NotLaunchpad`, `SealedMarket`.

### 6.2 The router to external liquidity (`Router`)

Ownerless; venues pinned at construction with their `extcodehash` (own `Pool`, Uniswap v3 `SwapRouter02`, the v4 `PoolManager` for hookless keys and keys whose hook codehash equals our `LaunchHook`); no aggregator, no Aerodrome in v1. **`msg.sender` must be a canonical Reach**: `id = AccountBinding.token(msg.sender)`, `require(HUB.isCanonicalAccount(msg.sender, id, false))` — so every budget lives in the Reach's session policy (MUST 15), and a holder swaps *through* their Reach (`Reach.execute(ROUTER, …)`) or by `executeTyped` with a receive floor. Per call: live `deadline`; `tokenIn != tokenOut`; pre-call snapshots of both balances segregated from any pre-existing router balance (A PR #13); pull `amountIn` exactly; `approveExact(venue, amountIn)`; venue calldata built by the router from typed parameters, never opaque bytes (`validateTradeCalldata` lesson); `approveExact(venue, 0)` unconditionally; `require(received ≥ minOut)` by delta; output and unspent input pushed to the Reach. v3 path validated (`43–112 B`, `(len−20) % 23 == 0`, endpoints equal to in/out with WETH substituted for native). v4: `unlock` with a single-use `Transient` commitment re-checked in `unlockCallback`, real `sqrtPriceLimitX96`, `din < 0 && dout > 0`, then `sync/settle/take`. `quoteExactIn(req)` executes the real path inside a `view` and reverts `QuoteResult(spent, received, sqrtPriceAfter)` — "quote is a settlement" — shown beside `Pool.quote`. `venues()` prints the table in `hooklist` shape for the page.

---

## 7. Social

### 7.1 Speech predicate and spam economics

`Parley.mayActAs(token, who) = who == HUB.ownerOf(token) || who == HUB.account(token)` — `acts`, verbatim from I `Parley.sol:168`; never the ERC-4907 user, an operator, an approvee or a session key directly ("a reputation is not a thing you can hand back at the end of the day"). An agent speaks by having the holder allow `Parley.speak` on its session, so the call arrives from the Reach and the audit log records who spoke. Spam control, no server: (1) speaking requires holding a token of a 4,096-piece edition with a secondary price; (2) a per-room cooldown (`cooldown[room] ≤ 7 d`, steward-set; commons fixed at 2 blocks) keyed by `keccak(token, custodyEpoch)` so a buyer is not rate-limited by the seller's last word; (3) refundable postage for first contact. A wallet without a token cannot write anywhere; the page says so.

### 7.2 Archive, rooms, replies, follows (`Parley`, from I `Parley.sol`)

```solidity
event Said(uint256 indexed room, uint256 indexed from, uint64 prev, uint64 prevFrom, uint64 seq, uint8 kind, uint64 reBlock, uint64 reSeq, bytes body);
function speak(uint256 room, uint256 from, uint8 kind, uint64 reBlock, uint64 reSeq, bytes calldata body) external;
function whisper(uint256 from, uint256 to, uint8 kind, bytes32 expectedKeyId, bytes calldata body) external;
function whisperStamped(uint256 from, uint256 to, uint8 kind, bytes32 expectedKeyId, bytes calldata body, address expectedFeeToken, uint128 maxPostage) external payable;
function found(uint256 by, string calldata name, bool openDoor) external returns (uint256 key);
function invite / join / leave / evict(uint256 room, uint256 by, uint256 token);
function setCooldown(uint256 room, uint256 by, uint32 seconds_) external;        // steward, ≤ 7 d
function hide(uint256 room, uint256 by, uint64 seq) external;                    // steward; presentation bit, never deletion
function bindKey(uint256 token) external;                                        // holds: records (owner, custodyEpoch, KEYS.keyIdOf(owner), keyType)
function keyOf(uint256 token) external view returns (uint16 keyType, bytes32 keyId, bytes memory publicKey);   // zero unless owner and epoch unchanged
function homeKey(uint256 token) public pure returns (uint256);                   // keccak(3, token)
function stateOf(uint256 room) external view returns (uint64 last, uint64 count, uint64 opened, uint32 members, uint8 kind, bool open, uint256 steward, uint256 index, uint32 cooldown, uint64[4] memory headBlocks, uint64[4] memory headSeqs);
function heads(uint256[] calldata rooms) external view returns (uint64[] memory);
function topics() external pure returns (bytes32 said, bytes32 founded, bytes32 invited, bytes32 entered, bytes32 departed);
```

Room kinds: the **commons** (0, everyone); **home rooms** (`keccak(3, token)`, derived, zero gas, the token is steward; `join(homeKey(target), mine)` is "follow"; `Roster.membersOf(homeKey(t))` is the follower list — zero storage of our own); **groups** (`keccak(1, index)`, `found` ≤ 48-byte UTF-8 name, steward may invite/evict, the token itself joins — permission recorded, entry self-performed); **pairs** (`keccak(2, min, max)`, derived by `whisper`; a raw pair key through `speak` reverts `UseWhisper`). `MAX_BODY = 1,024` for `PLAIN`; `SEALED` envelopes ≤ 4,096 B. Bodies are **logs only**; per room the contract keeps `{last, count, opened, members, kind, open, steward, index, cooldown}` plus a ring of the last four `(block, seq)` heads (two slots, ≈ 44 k gas on rotation) — the re-entry points a client needs once EIP-4444 prunes old logs from non-archive nodes; the page says "older messages need an archive node". The 64-entry in-state DM ring of design B is dropped (≈ 2.6 M gas per 4 KB write was never costed). `reBlock/reSeq` name the message answered (zero = none) so threads are walkable in one `eth_getLogs`. Eviction cannot unsay anything; `hide` sets a bit in `hidden[room][seq/256]`.

**Reading without an indexer.** `stateOf(room).last` → `eth_getLogs` for exactly that block with `topics:[said, room]` → follow the oldest log's `prev` → repeat; `prevFrom` walks one token's speech across rooms; `heads(rooms[])` is the 9-second poll. Fifty messages are fifty single-block queries and no range scan anywhere; the walk rule is published as data in `services.json`. The archive lives in this contract and is never redeployed ("a new Parley would not migrate the conversation, it would end it").

### 7.3 Keys and sealing

`KeyRegistry` (A `EncryptionKeyRegistry.sol` verbatim: `setEncryptionKey(uint16 keyType, bytes publicKey)`, `revokeEncryptionKey()`, `keyOf`, `publicKeyOf`, `keyIdOf = keccak(pubkey)`; plus the ERC-7627 `getPublicKeys(address)` view) is the address-keyed typed directory. The token-level binding is three lines in Parley: `bindKey(token)` (**`holds`**, closing B's `setTokenKey`-by-session footgun) records `(ownerOf, custodyEpoch, keyIdOf(owner), keyType)`; `keyOf(token)` answers only while owner **and** epoch are unchanged (I `_sealOwner` lesson, `4fa41d0`), so a sold token has no key until the buyer binds one and a page can never promise privacy to a departed holder. `whisper(..., expectedKeyId, ...)` reverts `KeyMoved` unless `keyOf(to).keyId == expectedKeyId` (A's mempool-rotation guard); a sealed send to a token with no key reverts `NoKey` rather than recording an undecryptable message. Browser crypto: G `sdk/whispers.mjs` verbatim (ephemeral P-256 ECDH → HKDF-SHA-256 → AES-256-GCM, AAD bound to chain/Parley/both ids/both epochs/key versions) with the P-256 scalar derived from `personal_sign("INTACT seal v1 · chain <c> · hub <hub>")` — one key per wallet, never per token or per epoch: `KeyRegistry` stores one record per `msg.sender` address and `setEncryptionKey` takes no token, so a per-token sentence would have a wallet holding #1 and #2 overwrite one binding with the other and derive a scalar `keyOf(1)` no longer names; epoch death is already `Parley.Binding{owner, epoch}`, and `bindKey(id)` binds the wallet's one registry key to each token the holder seals for (U9, D7) — re-read of the recipient's key immediately before every encryption (I B1, PR #27), and the stated absence of forward secrecy. Groups are public in v1; MLS sealed rooms are v2 (§16).

### 7.4 Postage (`Postage`, from A `AgentComms.sol`)

`configureInbox(token, feeToken /*0 = native*/, postage, replyWindow 5 min–30 d, open)` by `holds`, stamped with the epoch (stale after sale; defaults to open, free). `Parley.whisperStamped` forwards value to `Postage.stamp(pairRoom, from, to, expectedFeeToken, maxPostage)`, which escrows against the recipient's **live** configuration and refuses postage above `maxPostage` or a different fee token (A's repricing regressions). The recipient's `whisper` back within the window makes Parley call `Postage.settle(pairRoom)`, which **credits** `owed[feeSink(to)]` — a pull ledger, never a push inside `whisper` (a hooked fee token cannot re-enter Parley); `claimSettled(token)` pays `feeSink(to)`. After `replyBy` anyone may `expire(stampId)`, after which the sender pulls `claimRefund`. Exactly one of `{settled, refunded}` ever becomes true. Postage adds one SLOAD to every whisper. `Postage`'s `PARLEY` and Parley's `POSTAGE` are mutual immutables fixed by CREATE3 prediction and asserted by `recover-record`.

### 7.5 Reactions

Reactions call the ERC-7409 singleton `0x3110735F0b8e71455bAe1356a33e428843bCb9A1` with `(PARLEY, uint256(keccak256(room, seq)), emoji)` for posts and `(HUB, id, emoji)` for tokens — zero bytes of ours; the page checks `extcodesize` first. Federation: none in v1; `ParleyPort` is documented as a v2 option with the brief's DVN rule.

---

## 8. Launchpad

### 8.1 Creation

Two modes behind one record `Launch{id, token, coin, target, terms, state}`, both `acts(id)`, both rate-limited per token (`lastLaunchAt[id] + 7 days`), both named in the token's `launchRoot`. **First-launch rule:** the first launch of any token requires `holds`, **or**, when the call arrives from the Reach (an agent session) and the token has a guardian, a one-time `Launchpad.approveFirstLaunch(id)` by that guardian stamped with the custody epoch (brief §6.12; Bankr × Grok). Thereafter scoped sessions with the per-token spacing suffice.

- **Instant coin** (`Kiln.launch(id, name, symbol, decimals, supply, salt, reachShare)`): CREATE2 `Coin` with `salt' = keccak(msg.sender, salt)` (no address front-running); `coinAt` predicts the address; names ASCII-whitelisted and `Web.esc`'d everywhere; the supply is minted **to `account(id)`** (the Reach) — the vault holds it from block one and it travels with the token. The Kiln records `{launcher: id, coin, launchedAt}`.
- **Raise** (`Launchpad.create(LaunchParams{id, coin, curveSupply, virtualQuote, graduationTarget, startsAt ≥ now, fairWindow ≤ 1 d, maxBuyInWindow, snipeTaxStartBps ≤ 9,900, feeBps ≤ 100, creatorBps ≤ 1,500 of the fee, creatorVestBps ≤ 1,500 of supply, deadline ≤ 30 d, target})` and `createChecked(p, expectedTermsHash)` pinning what the page showed): the Kiln mints `curveSupply + liquiditySupply` **directly to the Launchpad** at `launch` time when a raise is requested (`Kiln.launch(..., raiseShare)`), so no Reach approval exists anywhere (closing C's standing-approval flaw and a sealed Reach can still raise); the creator vest goes to `Locks` with cliff ≥ 30 d and vest ≥ 365 d, beneficiary `account(id)` — never a tax exemption. Terms are written into the struct; no later change can touch a live launch. Fee split immutable per launch: `creatorBps` share of `feeBps` → `feeSink(id)`, remainder **and the entire snipe tax** → `Coin.contribute{value}` (burn-to-redeem floor): every sniper raises every holder's floor. No protocol leg; mint price is the protocol's only revenue (MUST 34).

### 8.2 Credits phase

ANIMA's maths: `k = q·b`, `newBase = ceilDiv(k, q + netIn)`, every rounding against the trader, `uint128` reserves; native quote (`buy{value}(launchId, minBaseOut, deadline, maxFeeBps)`, `sell(launchId, baseIn, minQuoteOut, deadline)`); fair window with `maxBuyInWindow` per address; snipe tax decaying linearly from `snipeTaxStartBps` at `startsAt` to zero at `startsAt + fairWindow`, clamped so `base + snipe ≤ 9,900` (the 102 % payout regression); backdated starts refused (`StartsInThePast`). **Buyers hold credits** (`creditOf[launchId][buyer]`), not tokens, until graduation: nothing ERC-20 moves during the curve, so there is no pre-launch transfer to a predicted pair (Four.meme Mar 2025), nothing anyone can pre-initialise against, and `fail` refunds are exact. Per-launch balances are isolated (`raised[launchId]` plus a solvency check against the contract balance; A `5d21694` class). No withdraw or pause authority exists over curve funds.

### 8.3 Graduation

`graduate(launchId)` is permissionless and locked once `raised ≥ graduationTarget || baseSold ≥ curveSupply`: it computes the terminal curve price and, by the launch's `target`:

- **`Target.OwnedPool` (MVB):** `Pool.openSealed{value: raised}(launchKey, coin, address(0), 100, liquiditySupply, id)` at the terminal price; emits `Graduated(launchId, key, terminalPrice, poolSpot)` with both prices side by side; credits flip to claimable (`claim(launchId, buyer)` by any gas payer, recipient fixed).
- **`Target.UniswapV4` (post-MVB):** `LPCustodian.seed(launchId, terminalSqrtPriceX96)` initialises the v4 pool keyed to the launch's `LaunchHook` and mints the full-range position to the custodian; if the pool was pre-initialised by a stranger, `getSlot0` must be within 1 % of terminal or `seed` reverts and the launcher may `resalt` (new hook salt → new `PoolKey`); `Graduated` emits both prices.

Approvals are zeroed in the same call. If `deadline` passes short of target, `fail(launchId)` opens refunds (`refund(launchId, buyer)` by anyone, recipient fixed) and returns the supply to `account(id)`.

### 8.4 Hooks and the custodian (post-MVB)

`LaunchHook` is one immutable contract per launch: `OPENS`, `UNLOCKS`, `START_FEE`, `FLOOR_FEE`, `DECAY` immutables; `beforeInitialize` reverts unless the key is its own `PoolKey` with `DYNAMIC_FEE` (Cork rule); `beforeSwap` reverts `NotOpenYet` before `OPENS` and returns `floor + (start − floor)·max(0, 1 − elapsed/DECAY) | OVERRIDE_FEE`; `beforeRemoveLiquidity` reverts `StillLocked` for negative deltas before `UNLOCKS` (zero-delta fee pokes allowed — I branch `GateFacet`); `onlyPoolManager` on every entry; no delta-returning flags; `hookData` untrusted; permission bits asserted against `getHookPermissions()`. `Kiln.mine(initCodeHash, flags, from, tries)` walks CREATE2 salts as a view under `eth_call` (60,000 tries per window); `deployHook` reverts `WrongFlags` unless `Hook.flags(hook) == wanted`. **No `syncFee`**: the fee band is static per launch, so PR #36's race cannot exist. `LPCustodian` holds every launch's position; permissionless `collect(launchId)` (`nonReentrant`, CEI) pays `feeSink(id)`; principal leaves only after `unlocksAt` (ratchet ≤ 10 y) and only to the Reach on `acts`. PositionManager action bytes and limit-price constants are pinned per band in the deployment record and asserted in `verify-launch`.

### 8.5 What the token can do that an EOA cannot

Launch *as* the token (`acts`), have the supply land in a sealable vault from block one, receive every fee leg — pool fees, sealed-market fees, v4 fees, postage, creator fee — into `feeSink(id)`, have launches appear in traits and the fingerprint, launch under a bounded session with a per-token rate limit, and sell the coin's market, position and provenance in one `transferFrom`.

---

## 9. Vault and accounts

### 9.1 Reach (from I `IpseityAccount.sol`)

Kept whole: `execute(to, value, data, operation)` with `operation == 0` only (`OnlyCall`; no delegatecall ever; the address derives from the implementation so there is no upgrade path); `executeBatch(Call[] ≤ 16)` snapshotting once around the batch, `EmptyBatch` on `[]` (A `koorbx`); the **measured seal** — before a sealed call snapshot ether, `balanceOf(this)` for every manifest asset (≤ 16) and `ownerOf` for every guarded piece (≤ 8); afterwards nothing may be smaller (`Shrank`), readable assets may not go blind (`WentBlind`), pieces must still be held (`PieceLeft`), `MEASURED` flags in their own array; while sealed, manifest assets accept only `transfer`/`transferFrom` (deny-by-default after Permit2 walked through a blocklist); `seal(until)` = `Ratchet.raise(sealedUntil, until, 365 days)`, survives sale; `onlySigner` = `HUB.ownerOf(id)` exactly; `onERC721Received` keeps `OwnershipCycle` for its own id.

Added: **`state()`** (explicit, bumped on every execute, grant, revoke, seal, manifest change — ANIMA's rule; the fingerprint reads it) and `auditRoot` (`keccak(prev, chainid, this, signer, to, value, selector, dataHash, operation, state, timestamp)`); the **open-approval ledger** — any outgoing call whose selector is in the approval family (`approve`, `increaseAllowance`, `setApprovalForAll`, both `permit` shapes, Permit2 `approve(address,address,uint160,uint48)`) records `(asset, spender)` in a ≤ 32 set (`LedgerFull` on the 33rd until pruned); `revokeOpenApprovals()` sends zeroing calls with gas-capped low-level calls that never block on a foreign revert; `openApprovalsRoot()` is in the fingerprint; `sealMax()` and `revokeAllSessions()` callable by the hub (`panic`) and by `guardianOf(id)` as well as the signer; **ERC-7739**: `isValidSignature` accepts only the `Attestation(purpose, payload, nonce, deadline)` struct under the `INTACT_ATTESTATION` domain with the account address and `custodyEpoch` in the struct, wrapped as ERC-7739 `TypedDataSign` (the verifier's hash is never mutated; `0x7739…` probe → `0x77390001`; tested as a Safe ≥ 1.4.1 owner); session keys → `0xffffffff`; `retireAttestations()` bumps every signature ever given. A sealed account can prove who it is and is arithmetically incapable of signing a venue's order. Stealth receive: the holder registers the Reach on ERC-6538 by `execute(REGISTRY_6538, 0, registerKeys(schemeId, meta), 0)` — the Reach is `msg.sender`, no signature scheme involved, zero bytes of ours (A's shape; C's `registerKeysOnBehalf` + attestation-1271 cannot work).

### 9.2 Sessions — one system

```solidity
enum SessionKind { Allowlist, Recipe }
struct Session {
    SessionKind kind; uint64 expires; uint64 epoch;              // epoch = HUB.custodyEpoch(id) at grant
    uint128 nativeCap; uint128 nativeSpent;
    uint32 usesLeft; uint32 minInterval; uint64 lastUsed;         // Recipe (G/M); optional for Allowlist (koorbx)
    bytes32 dataHash; bytes32 targetCodeHash; address target; uint256 exactValue;   // Recipe only
    uint32 listEpoch;                                             // Allowlist: epoch-keyed target/selector/spender sets ≤ 16 (I)
}
struct AssetCap { address asset; uint128 cap; }                 // ERC-20 caps by balance delta, ≤ 8 per session
struct AssetLimit { address asset; uint256 amount; }
struct TypedCall { address to; uint256 value; bytes data; AssetLimit[] spend; AssetLimit[] receiveMin; uint64 deadline; }   // ≤ 4 each

function grantSession(address key, uint64 expires /*≤365 d*/, uint128 nativeCap, AssetCap[] calldata caps, address[] calldata targets, bytes4[] calldata selectors, uint32 minInterval, uint32 uses) external onlySigner;
function grantRecipe(address key, uint64 expires, address target, bytes32 dataHash, uint256 exactValue, uint32 uses /*1..1024*/, uint32 minInterval) external onlySigner;
function revokeSession(address key) external;                    // signer or guardian
function executeAsSession(address to, uint256 value, bytes calldata data) external returns (bytes memory);
function executeTyped(TypedCall calldata c) external returns (bytes memory);   // signer or session
function sessionAllows(address key, address to, bytes4 selector) external view returns (bool);
function sessionExposure(address key) external view returns (uint256 nativeWorst, AssetCap[] memory);
```

Checks on every session call: `epoch == HUB.custodyEpoch(id)` (dead on sale, not revived on buy-back); unexpired; `HUB.statusOf(id) == Active`; `to != address(this)` and the selector is not a grant/seal/revoke (`NoPrivilegeEscalation`); Allowlist: target and selector in the epoch-keyed sets, the actual spender argument of approval-shaped calls on the target list, cumulative native cap, **ERC-20 caps measured by balance delta** (`before − after ≤ cap[asset]`); Recipe: `keccak(data) == dataHash`, `to == target`, `to.codehash == targetCodeHash`, `value == exactValue`, `usesLeft--`, `lastUsed + minInterval ≤ now`. `executeTyped` (G `_perform`): exact approvals only if the allowance is zero, reset and verified zero afterwards; `spend` balances may fall at most by the cap, `receiveMin` balances must rise by at least the floor; taxed and rebasing tokens revert by construction — "swap exactly this for at least that" is the agent's one shape. Worst-case exposure (`cap × uses`) is printed before the holder signs. Session keys never sign ERC-1271. ERC-4337 is not in v1; a Reach is never an EIP-7702 delegate. Size valve: if `Reach` measures over 21,000 B, the pure policy evaluation moves into an immutable stateless `SessionPolicy` consulted by `staticcall` — no delegatecall, no upgrade.

### 9.3 Grip, Locks, seals

**Grip** (I `GripVault.sol` verbatim, salt `intact.grip.v1`): `receive()`, the three `onERC*Received`, `token()`, `owner()`, `isOneWay() == true`, `state() == 0`, `isValidSignature → 0xffffffff`, `supportsInterface` declines `0x51945447`; `verify-vault.mjs` enumerates every selector against the compiled ABI and asserts none moves an asset. A mistaken transfer in is permanent and the page says so before building the calldata. **Locks** (M `TimeVault`): `lock(asset, uint112 amount, beneficiary, start, cliff, end ≤ now + 3650 d, linear) payable`, exact-delta pulls, `release(id)` by anyone to the committed beneficiary, `extend` forward-only, `commitmentOf(beneficiary)` rolling hash; the page defaults `beneficiary = account(id)` so a locked treasury travels with the token; `give(id, newBeneficiary)` only into a canonical Reach (I `Locker.give`). **One ratchet rule** (`Ratchet.raise(current, proposed, cap)`: `proposed > current && proposed > now && proposed ≤ now + cap`, else `RatchetOnly`/`TooLong`): the Reach seal (365 d), the market seal (365 d), the transfer seal (365 d), locks (10 y), `LPCustodian` unlock (10 y); the Steward's notice can only be lengthened; a behavioural policy (inbox price, sniper fee) changes only forward in time and dies with the epoch. One library, one test file, one word in the UI ("sealed until").

### 9.4 Steward (succession and recovery, one contract)

```solidity
struct Will { bytes32 heirHash; uint64 quiet; uint64 notice; uint64 lastLife; uint64 due; address dest; uint64 epoch;
              address[] guardians /*0 or 2..5*/; uint8 threshold /*≥2*/; uint32 nonce; bool duress; }
function arrange(uint256 id, bytes32 heirHash, uint64 quiet /*30–3650 d*/, uint64 notice /*14–365 d*/, address[] calldata guardians, uint8 threshold) external;  // holds
function stillHere(uint256 id) external;                       // holds — the only sign of life (I `embody` lesson)
function stillHereUnderDuress(uint256 id) external;            // holds — silently sets notice = 365 d, flags for the heir's page only
function cancel(uint256 id) external;                          // holds, during any notice
function summon(uint256 id, address heir, bytes32 salt) external;   // anyone after lastLife + quiet; keccak(heir, salt) == heirHash; twice reverts AlreadyCalled
function attest(uint256 id, address dest, uint32 nonce) external;    // named guardian; one count per guardian per nonce; threshold → notice starts to dest
function execute(uint256 id) external;                        // anyone after `due`: unlock then HUB.stewardTransfer(id, dest)
function wouldPass(uint256 id) external view returns (uint8); // status codes the page renders in words
function getWill(uint256 id) / getObit(uint256 id)            // ERC-7878-legible
function planHash(uint256 id) external view returns (bytes32);
```

The plan is stamped with the custody epoch and void on any transfer; a stranger's action never counts as life; there is no service guardian and no zero-guardian recovery; heirs may be "whoever holds token N" (`heirHash = keccak(address(0), N, salt)`), so estates chain through instruments. `arrange` takes no lock: the token stays transferable while a plan exists (the plan dies with the epoch). The module lock is taken only when `summon` or the guardian threshold starts the notice, and is released by `cancel` or consumed by `execute`. A capped bounty from the Reach for whoever executes a matured transfer is a COULD.

---

## 10. Agents

An AI agent is a holder-authorised key on the Reach and nothing more. **Manifest**: face 2 of `tokenURI` is an ERC-8004 `registration-v1` document generated from chain (`agentId == tokenId`, `services[]` = the token's `web3://` routes and its `/k/<id>/<key>` door, `agentWallet = account(id)`, `supportedTrust = ["custody-epoch","erc-5646"]`, `x402Support: false`), hash-pinned by `AgentCard.manifestHash(id)`; `/.well-known/agent-registration.json`, `/.well-known/agent-card.json` (A2A) and `/llms.txt` are served by Premises from `AgentCard`. Mirror-registration in the canonical ERC-8004 singleton with an ERC-8217 binding is a holder action on the Identity screen — discovery only, never a correctness dependency (the singletons are upgradeable proxies). **`services.json`** (`Catalog`) lists every write as `{name, contract, sig, selector, kind: read|write|payable, via: direct|reach, args[], notes}` plus the archive walk rule, the band table and the venue manifest; `catalogHash` is in `contractURI` and in the state gap; the MCP bridge in `sdk/` refuses a catalog whose hash differs (CVE-2025-54136 closed by construction). **Session keys** are the only agent authority: `grantSession` (allowlist, caps) or `grantRecipe` (exact calldata); `propose` and `act` are separate tools; `sessionAllows` is checked as a view before any send; `executeAsSession`/`executeTyped` is the only path; launches need a scoped grant on `Launchpad.create` and inherit the 7-day spacing and the first-launch rule. **The door**: `/k/<id>/<key>` 301s into `/token/<id>/live?as=<key>`: the same document booted in session mode refuses a wallet whose `eth_requestAccounts[0]` is not the key, shows exactly what the session allows (targets × selectors, caps, expiry, epoch) and offers only those actions. **Invariants tested forever**: transferring any token to a Reach or Grip changes no bit of `rightsOf` and no session (Bankrbot class); no `onERC*Received` grants anything; reputation-shaped data does not exist in v1 (no escrow to ground it — the only unforgeable records are Postage reply receipts and sealed-market `collect` history). **8004 posture**: native (`agentId == tokenId`, emitted from chain) plus optional 8217 mirror; no claim of ERC-7857. MCP bridges never pass wallet tokens or session keys through.

---

## 11. Special features (final list, mechanism named)

1. **Fingerprint-bound trades with an open-approval ledger** — `getStateFingerprint` covers `Core`, traits, both accounts' `state()`, `openApprovalsRoot`, `marketHash`, lock commitment, launch root and plan hash; `validateOnSale` traits for SIP-15 marketplaces; `Market.buy` recomputes; `revokeOpenApprovals()` in one click.
2. **`panic(id)`** — one call kills every delegated right (both epochs for the holder, `guardianHold` for the guardian), seals the Reach to max, revokes all sessions, pauses; tested that nothing survives it.
3. **Listing is a seal** (`Market`, post-MVB) — `list` requires both the Reach seal and the market seal to cover `expiresAt`; the buyer's floor is enforced by the account, not promised by the venue.
4. **Selling the Intact sells the exchange and every fee stream** — the owned market is keyed by token id; sealed markets and `LPCustodian` pay `feeSink(id)`; `_update` strips the seller; no second NFT.
5. **The receive-only Grip and `feesToGrip`** — security by absence of code, ABI-asserted in CI; the holder may route every income leg into the hand that cannot spend.
6. **A home room at mint, indexer-free follows** — `homeKey(id)` derived; follow = `join`; followers = `Roster.membersOf`; the archive is the graph.
7. **The self-verifying site, same bytes twice, same address on every band** — `tokenURI` viewer and `/live` byte-equal in CI; `/token/<id>/hash` vs the shell's own keccak in the crest; `/manifest` route and panel hashes; CREATE3 fixed salts; `verify-gateway.mjs` diffs a gateway's bodies against local `eth_call`.
8. **Panels as hash-checked resources, no eval, no RPC in any document** — §5.2.
9. **Priced attention into the vault; reactions every wallet can read** — Postage pull-settled to `feeSink`; ERC-7409 singleton.
10. **The inbox that ships with the token** — `bindKey` is `holds`, dies with the epoch, `expectedKeyId` pinned; a buyer sees a provably fresh inbox plus the public archive; stealth receive by the Reach calling ERC-6538 directly.
11. **Sniper tax raises the floor; credits until graduation; `fail` refunds** — §8.
12. **Quote is a settlement, plus a venue manifest** — `Router.quoteExactIn` reverts with the real path's result beside `Pool.quote`; `venues()` in `hooklist` shape; the Router is Reach-only.
13. **The Steward** — two triggers, one cancellable notice, hashed heir, duress heartbeat, `stewardTransfer` as its only power, ERC-7878 views.
14. **Clear-signing from chain and 7702 hygiene** — slab sentences built from the `sel`/`err`/arg tables hashed on chain; `eth_getCode(holder)` compared to `knownDelegates()`.
15. **"Zero" and "no answer" are different facts** — `reported` bits from `extcodesize` + `try/catch`; the UI prints "not reported", never 0.
16. **Agent card minted with the token; agent-safe by construction** (post-MVB card; invariants from day one) — §10.
17. **The curve is a trait the holder keeps** — `curve` as ERC-7496 (`holds`-only), applied by `syncCurve(id, bps, expected)` only; `marketSealedUntil`/`sealedUntil` `validateOnSale`.

---

## 12. Chain, bands, addresses, deployment order, costs, one-way operations

**Bands** (edition 4,096; disjoint ids; no token bridge, ever):

| Band | Chain | Ids | Role |
|---|---|---|---|
| 1 (primary, launches first) | Base (8453) | 1–3,072 | the bulk of the edition; owned pools, launches, logs, agents; `w3link.io` serves Base mainnet |
| 0 (canonical) | Ethereum (1) | 3,073–3,584 | high-value custody; ENS `intact.eth`; `Nameplate`; the neutral copy of the engine bytes, deployed **before Glamsterdam/EIP-8037** |
| 2 (reserved) | OP Mainnet (10) | 3,585–4,096 | opened only on a written decision; shares Base's fee code and predeploys |

`BAND_LO/BAND_HI` are hub immutables; `Catalog` carries the table; a written "band orphaned" rule says a band whose chain dies keeps its tokens and loses nothing that was ever bridged. All three chains are Cancun with the 2^24 transaction cap; P-256 is 3,450 gas on Base/OP and 6,900 on mainnet if passkeys are ever added.

**Addresses.** Every deployable is deployed through a fresh nonce-0 burner's CREATE3 factory under fixed salts (`keccak("intact.v1.<key>")`, the key being the record's — `hub`, `pool`, `reachImpl`…), so `Intact`, `Premises`, `Pool`… share one address on every band. Two exceptions, decided in U10 (decision 36): the Engine is the burner's second plain CREATE (nonce 2), because its constructor records `msg.sender` as curator and a CREATE3 proxy could never call `loadHead`; and Engine shards are SSTORE2 pointers at `CREATE(engine, 1 + k)` in load order, not salted — with the Engine at one address and `dist/` byte-identical every pointer is the same everywhere, and the record and recovery predict both. The factory's `deploy` admits only the burner and the Timelock's predicted address (`Create3Factory.NotDeployer`); after the burner is destroyed, every later satellite lands through the Timelock's queue. The hub's module immutables (`STEWARD`, `MARKET`, `ROLES`, `POOL`, `PARLEY`, `LAUNCHPAD`, `LOCKS`, `RENDERER`, `CATALOG`, `TIMELOCK`) and the mutual `PARLEY`↔`POSTAGE`, `POOL`↔`LAUNCHPAD` pairs are **predicted before construction** and asserted after; `tools/deploy.mjs` refuses to publish on any prediction miss. Per-band constructor arguments (band bounds, Uniswap/Permit2 addresses) do not change the address under CREATE3.

**Order** (`tools/deploy.mjs`, resumable, journaled, the three public-RPC lag defences: wait for code before a constructor inspects a fresh deployment; take ids from receipt logs; block until the endpoint reaches the receipt's block): CREATE3 factory → Timelock → Engine (load head, body, six panels; `freeze`) → Crest → Reach impl → Grip impl → Catalog → Renderer → hub (monolith `Intact` **or** facets then `IntactDiamond`, by the ship rule) → KeyRegistry → Roster → Postage (Parley predicted) → Parley → Locks → Pool (Launchpad predicted) → Coin template check → Kiln → Launchpad → Router → Steward → Premises → `recover-record` with 0 disagreements → post-MVB: AgentCard, LaunchHook template, LPCustodian, Market, Roles, Nameplate (band 0) → Timelock admin to the 2-of-3 queue-only multisig or renounced; burner destroyed after the record is written.

**Cost.** ≈ 25 satellites + hub ≈ 280 KB of runtime ≈ 60 M gas of code deposit at ~215 gas/byte, plus ≈ 15 M constructors and wiring, plus ≈ 10 M for the engine shards and panels: **≈ 85–100 M gas per band** (IPSEITY's 46-contract site measured 136 M). Base at 0.005–0.05 gwei: 0.0005–0.005 ETH plus ≈ 0.5 % L1 data (≈ $1–12). Mainnet at 0.5 gwei: ≈ 0.05 ETH (≈ $120); at 5 gwei ≈ $1,200. Mint ≈ 320–360 k gas (≈ $0.003 on Base). The deployer refuses post-EIP-8037 chunks over the 2^24 cap.

**One-way, by construction.** `Engine.freeze()`; every immutable; the diamond's routing table; each launch's hook and fee terms; `Pool` sealed markets (principal never withdraws); `Grip` (no spend path); seals, locks, market seals and `LPCustodian` unlocks only lengthen; `sealPricing()`; Timelock admin renunciation. After `sealPricing` and renunciation there is no setter anywhere.

**If EIP-7954 raises the code limit on a band.** Nothing in the authority model changes; the ship rule picks the monolith (`Intact`, already built and tested); satellites may fold (`Pool + Router`, `Parley + Postage + Roster`, `Renderer + Crest + Catalog`) as a new band's set, never an upgrade of a live one; the shard store already reads 65,534-byte pointers, so the shell could ship as one shard.

---

## 13. Toolchain, CI steps, verification battery, equality assertions

**Base: IPSEITY's `tools/`**, already at the repository root (`compile.mjs`, `evm.mjs`, `forge.mjs`, `selftest.mjs`, `rpc.mjs`; solc-js 0.8.36, viaIR, optimizer 800, cancun; measured 3 m 57 s cold in this container). Why: the riskiest surface is the website and this battery was built to attack exactly that (DOM shim + wallet shim driving served pages against the in-process EVM, byte-equality of surfaces, build-failing gas caps); the 22 verifiers are the specification; no Foundry and no external Solidity dependency are needed. ANIMA's Hardhat is kept only as `npx hardhat node` (chain 31337, hardfork cancun) for the Chromium journeys. `.t.sol` suites run by `tools/forge.mjs` (cheatcode precompile; the 3-byte-REVERT negative control that must burn gas; `expectRevert` matching an error name **or any 4-byte selector of that name**, proved non-vacuous by one mutation per new assertion). Note: `forge.mjs` already deploys with `allowUnlimitedContractSize: true` — the harness is not the size gate; `compile.mjs` is, and it reports the monolith's size against the 24,000-byte ship threshold without failing the build for `Intact` alone (an explicit, single-entry measurement list), while every other contract is hard-gated at 24,576.

**Added tools:** `facets.mjs` (ported `deriveFacetCut`/`cutIsImmutable`; refuses unrouted, extra or duplicate selectors; asserts no `diamondCut` selector in any facet bytecode and equal `intactConfigHash()`), `gas.mjs` (view caps: `tokenURI` ≤ 8,000,000, `/live` ≤ 2,500,000, every view ≤ 16,777,216, nothing ≥ 50 M), `build-app.mjs` (from I `build-engine.mjs`: terser `reserved:["INTACT"]`, gzip ceilings, no-global loader grep, forbidden-token greps), `verify.mjs`, `verify-pool.mjs`, `verify-vault.mjs`, `verify-parley.mjs`, `verify-launch.mjs`, `verify-premises.mjs`, `verify-site.mjs`, `verify-steward.mjs`, `verify-timelock.mjs`, `verify-console.mjs` (Chromium), `verify-gateway.mjs`, `verify-findings.mjs`, `agents.mjs`, `fuzz.mjs`, `static-audit.mjs` (M: forbids `tx.origin`, `selfdestruct`, `.delegatecall(`, raw `sstore`, `extcodesize == 0` idioms), `transient-registry` test (every transient slot hashed, single-purpose, cleared on every exit), `invariants-check.mjs` (every `INVARIANTS.md` entry names an assertion string that exists), `deploy.mjs`, `recover-record.mjs`, `gateway.mjs`. `evm.mjs`/`rpc.mjs` gain tuple ABI encoding and an EIP-7825 assertion; `compile.mjs` gains `metadata.bytecodeHash: "none"` so codehashes are reproducible.

**CI (`npm run check`, in order; fails on the first; counts written to docs only after a run):** `compile` (size gate + ship rule) → `facets` → `selftest` → `build-app` → `forge` with `INTACT_IMPL=monolith` → `forge` with `INTACT_IMPL=diamond` (parallel job; gas-drift test ≤ 25 % / ≤ 6,000) → `gas` → `verify` (**the equality step**: decode `tokenURIAt(id,0)` → `animation_url` → base64 → bytes equal `Premises.request(["token","<id>","live"]).body`; both inflate to `keccak(dist/app.html)`; `/token/<id>/hash` equals the loader's own keccak of the inflated bytes; `/manifest` hashes equal recomputed ones; 15 ERC ids) → `verify-pool` (200-trade k-walk against anchors, dust round-trips both directions, native legs, sealed `collect` conservation, cross-market solvency) → `verify-vault` (Grip ABI, seal, Permit2 shape, sessions die on sale and buy-back, ledger, 7739 as a Safe owner) → `verify-parley` (single-block walks, pair keys, postage, epoch keys) → `verify-launch` (`MockPoolManager` by real selectors, flags, credits, graduation price, tax clamp, fail/refund) → `verify-steward` → `verify-premises`/`verify-site` (DOM shim drives every route and panel) → `fuzz` → `verify-findings` (every historical finding replayed `reproduced`/`refuted`: 13 IPSEITY + C1/C2/C5 + B1–B4 + ANIMA `EmptyBatch`, handle, revenue-revival, self-hire classes) → `agents` → `static-audit` → `transient-registry` → `verify-console` (Chromium: three boot modes, picker, viewer never reaches a wallet prompt, `/k` door) → local deploy + `recover-record` → `invariants-check` → `npm audit --audit-level=high`. Nightly: `verify-gateway` against a self-hosted `web3url-gateway` on Base Sepolia and `w3link.io` on Base mainnet once live. Mutation gate: a one-character change in any facet must fail > 100 tests.

---

## 14. Security checklist → the test that enforces each item

| # | Item | Test file · assertion |
|---|---|---|
| A1 | `_update` bumps `custodyEpoch`, clears approval/user/guardian/wallet/face/feesToGrip, forces `Paused`; no seller authority survives | `test/Update.t.sol` · `test_sellingTheTokenRevokesEverySellerAuthority`, `test_selfTransferBumpsTheEpochAndRevivesNothing`, `test_buyBackRevivesNoSession` |
| A2 | Locked tokens cannot transfer; only pinned modules lock; `moduleUnlock` at zero reverts | `test/Update.t.sol` · `test_aLockedTokenCannotMove`, `test_onlyPinnedModulesMayLock`, `test_unlockingAtZeroReverts` |
| A3 | `isApprovedForAll` reads the epoch store; `revokeAllApprovals` O(1); timed approvals expire | `test/Approvals.t.sol` · `test_revokeAllApprovalsIsOneWrite`, `test_aTimedApprovalExpires` |
| A4 | `Core` append-only; fingerprint moves for every field | `test/Fingerprint.t.sol` · `test_everyFieldMovesTheFingerprint` (one mutation per field) |
| A5 | Canonical-account transfer refusal; no nesting, no strand, no cycle at any depth | `test/Update.t.sol` · `test_noIntactCanEnterAnyIntactsAccounts`, `test_aGripNeverStrandsAnIntact`, `test_sellingJLeavesKNoSellerSession` |
| A6 | Mint: counters before the callback, band bounds, no `block.*` | `test/Mint.t.sol` · `test_aReentrantMinterSeesACompleteToken`, `test_theBandIsExhaustedNotWrapped`; grep gate in `static-audit` |
| A7 | No `tx.origin`, `extcodesize == 0`, "EOA-only"; 7702-delegated holder works | `tools/static-audit.mjs`; `test/Rights.t.sol` · `test_aDelegatedHolderStillHolds` |
| A8 | No initializer/proxy/`diamondCut`/routing owner; cut strict; config hash equal; slots 0–2 empty | `test/Diamond.t.sol` · `test_partitionsTheMonolithAbiEveryFunctionRoutedOnce`, `test_routesNoDiamondCutAnywhere`, `test_slotsZeroToTwoAreEmpty`, `test_refusesAFacetBuiltAgainstAnotherConfiguration`; `tools/facets.mjs` |
| A9 | Every contract ≤ 24,576 on every band; ship rule applied | `tools/compile.mjs` size gate; `deployments/*.json` `shipBuild` field checked by `recover-record` |
| A10 | Guardian panic never revokes the owner's operators on other tokens; holder panic may | `test/Panic.t.sol` · `test_guardianPanicLeavesOtherTokensOperatorsAlone`, `test_holderPanicKillsEveryDelegatedRight` |
| B1 | Grip: every selector enumerated, none moves an asset; `0x51945447` not advertised; `state()==0` | `tools/verify-vault.mjs` · "the Grip's ABI has no selector that moves an asset" |
| B2 | Reach `execute` op 0 only; no delegatecall path | `test/Reach.t.sol` · `test_operationOneIsRefused`; `static-audit` |
| B3 | ERC-7739: `0x7739…` → `0x77390001`; session keys → `0xffffffff`; passes as a Safe ≥ 1.4.1 owner | `test/Reach7739.t.sol` · `test_attestationVerifiesAsASafeOwnerWithoutReplay`, `test_aSessionKeyNeverSigns` |
| B4 | Seal ratchets only ≤ 365 d, survives sale, measurement-enforced, approval family refused | `tools/verify-vault.mjs` · "a drainer with a function name no list has still Shrank"; `test/Ratchet.t.sol` · `test_everyRatchetOnlyLengthens` |
| B5 | Sessions epoch-stamped, `Active` required, no self-call, no sub-grant, ERC-20 delta caps, receive floors | `test/Sessions.t.sol` · `test_aSessionDiesOnSale`, `test_aPausedTokenFreezesItsKeys`, `test_aSessionCannotGrantASession`, `test_anErc20CapIsMeasuredByDelta`, `test_executeTypedRefusesAShortfall` |
| B6 | Open-approval ledger records every approval shape; a foreign revert never blocks revoke | `test/Ledger.t.sol` · `test_permit2ApproveIsRecorded`, `test_aRevertingAssetDoesNotBlockRevokeAll` |
| B7 | Steward: `stewardTransfer` only; void on transfer; ≥ 2 guardians; one count per guardian per nonce; stranger is not life | `test/Steward.t.sol` · `test_aStrangerCannotResetSilence`, `test_aPlanIsVoidAfterSale`, `test_oneGuardianCannotRecoverAlone`, `test_anHeirWaitsOutASeal` |
| C1 | Curve anchors only on liquidity/curve change; never a live read in `swap` | `test/Pool.t.sol` (I, ported) · `testFuzz_roundTripNeverProfits` (both directions, dust) |
| C2 | C1/C2/C5 regressions | `test/PoolReenter.t.sol` · `test_aMarketCannotBeReopenedOverAPhantomReserve`, `test_aSyncInsideThePullReverts`, `test_aMarketCannotPayWithAnotherMarketsReserves`, `test_aDownwardRebaseFailsClosedUntilWriteDown` |
| C3 | Seal never shortens; `withdraw` never pausable; no admin selector exists | `tools/verify-pool.mjs` · "no selector on Pool names an admin"; `test/Pool.t.sol` · `test_withdrawCannotBePaused` |
| C4 | Router: Reach-only, `extcodehash` pinned, exact-then-zero, delta `minOut`, no standing allowance | `test/Router.t.sol` · `test_anEoaCannotUseTheRouter`, `test_anUpgradedVenueFailsClosed`, `test_anUnderDeliveringVenueIsCaught`, `test_noAllowanceSurvivesACall` |
| C5 | `syncCurve(expected)`; `curve` trait is `holds`-only | `test/Pool.t.sol` · `test_aMovedCurveRefusesTheSync`; `test/Rights.t.sol` · `test_aRenterCannotSetATrait` |
| D1 | No withdraw/pause over curve funds; `graduate` permissionless and locked | `test/Launchpad.t.sol` · `test_nobodyCanWithdrawCurveFunds`, `test_anyoneMayGraduate` |
| D2 | Pre-existing pool price within 1 % or revert/resalt; both prices emitted | `tools/verify-launch.mjs` · "a pre-initialised pool at the wrong price is refused" |
| D3 | Credits never move ERC-20 pre-graduation; `fail` refunds exact | `test/Launchpad.t.sol` · `test_noTokenMovesBeforeGraduation`, `test_aFailedRaiseRefundsEveryWei` |
| D4 | Snipe tax decays, no exemptions, clamp; fees immutable per launch ≤ 1.25 % | `test/Launchpad.t.sol` · `test_theTaxHasNoExemptionList`, `test_aPayoutNeverExceedsOneHundredPercent`, `test_feeTermsCannotChangeMidLaunch` |
| D5 | First launch `holds` or guardian co-sign; 7-day spacing; session launch needs the scope | `test/Launchpad.t.sol` · `test_anAgentsFirstLaunchNeedsTheGuardian`, `test_launchesAreSevenDaysApart` |
| D6 | Hooks: `onlyPoolManager` on every entry, foreign `PoolKey` refused, bits asserted | `tools/verify-launch.mjs` · "every hook entry refuses a caller that is not the manager", "`getHookPermissions` equals the address bits" |
| E1 | `mayActAs` on every Parley write; renter cannot speak; keys/cooldowns epoch-keyed | `test/Parley.t.sol` (I, ported) · `test_aRenterCannotSpeak`, `test_aBuyerIsNotRateLimitedByTheSeller`, `test_aSoldTokenHasNoKey` |
| E2 | Body caps; single-block walks; heads ring | `tools/verify-parley.mjs` · "the second walker reads 405 blocks of history in 3 single-block queries" |
| E3 | `expectedKeyId` pinned; postage one-of-settled/refunded; pull settlement | `test/Postage.t.sol` · `test_aRotatedKeyRefusesTheWhisper`, `test_exactlyOneOfSettledOrRefunded`, `test_aHookedFeeTokenCannotReenterParley` |
| F1 | `tokenURI` bytes equal `/live`; `resolveMode()` never removed; artwork by the router | `tools/verify.mjs` · "the two surfaces are one byte-stream"; `tools/verify-premises.mjs` |
| F2 | Every view under its cap; `tokenURI` ≤ 8 M; `/live` ≤ 2.5 M | `tools/gas.mjs` (build-failing) |
| F3 | Loader declares nothing global; no eval/`new Function`/external `src`/unlimited approval; panels hash-checked before injection | `tools/build-app.mjs` greps; `tools/verify-site.mjs` · "a tampered panel is refused" |
| F4 | Escaping everywhere; `textContent` only; CSP meta present | `tools/verify-site.mjs` · "a coin named `</script>` cannot end the state block" |
| F5 | Viewer never asks to sign; picker never auto-selects; rights recomputed on account/chain change | `tools/verify-console.mjs` · "the opaque origin shows the viewer and never a wallet prompt" |
| F6 | Optional dependencies degrade; "zero" ≠ "no answer"; hash-manifest and gateway diff | `tools/verify-site.mjs` · "an absent Router hides the tab and sets the chip to not reported"; `tools/verify-gateway.mjs` |
| G1 | Receiving a token grants no authority; no `onERC*Received` grants anything | `test/Rights.t.sol` · `test_receivingATokenGrantsNothing` |
| G2 | Catalog hashes on chain; bridge refuses mismatch | `sdk/mcp.test.mjs` · "a catalog whose hash drifted is refused" |
| H1 | Transient slots hashed, single-purpose, cleared on every exit incl. revert | `test/Transient.t.sol` · `test_everySlotIsRegisteredAndClearedOnRevert` |
| H2 | All signatures EIP-712 with chainId + verifyingContract + nonce + tokenId + epoch | `test/Reach7739.t.sol` · `test_aSignatureFromOneBandIsInvalidOnAnother` |
| H3 | Deployment records hold salts, facet hashes, shard addresses, gas assumptions; burner deployer | `tools/recover-record.mjs` · "0 disagreeing" |

---

## 15. Decisions log

1. **Name** — INTACT (Judge 1; no crypto collision found 2026-10-04). KEEP survives only as a verb in the docs.
2. **Base** — IPSEITY-lineage skeleton on IPSEITY's toolchain (Judge 2); B's authority model and libraries grafted; C's product rules grafted (as instructed).
3. **Hub packaging** — one source, two builds; ship rule ≤ 24,000 B → monolith, else diamond; both always built and tested; loupe folded into `IntactDiamond` so the diamond form stays at 30 deployables. Expected first measurement: 21.5–24.5 KB — the rule decides, not an estimate.
4. **Transfer rule** — C's canonical-account refusal replaces every depth-N walk; no Intact nests in an Intact.
5. **Panic** — holder bumps both epochs; guardian bumps the custody epoch and sets `guardianHold` (owner-only transfers) instead of the owner's `approvalEpoch`.
6. **Status at mint** — `Active` (C); `Paused` after every custody change (A); sessions require `Active`; the rule is printed on Identity.
7. **Agent wallet proof** — two-step propose/accept instead of an EIP-712/1271 verifier in the hub (bytes, and proof of control by sending is equivalent).
8. **Roles** — ERC-7432 via `Roles` satellite (A `AnimaRoles`), revocable-only in v1, epoch-stamped, permissionless unlock when stale; 4907 shim reads it when present. Paid `Lease` is v2.
9. **Curve source** — holder-set `curve` trait (`holds`), concentration bps ≤ 80,000, applied only by `syncCurve(id, bps, expected)`; no art word, no renter lever.
10. **Sniper fee** — settable only at `openMarket` (C's reasoning over brief SHOULD 46: no re-arming against standing traders).
11. **C5** — guarded by `totalReserved`, fail-closed on downward rebase, `writeDown` by the holder; all Pool admin deleted.
12. **Native quote** — `address(0)` on either side; exact `msg.value`.
13. **Sealed markets** — graduation target in the MVB; v4 `LPCustodian` the post-MVB alternative chosen per launch.
14. **Launch supply custody** — the Kiln mints the raise's share directly to the Launchpad; no Reach approval ever.
15. **Fee legs** — creator ≤ 15 % of a fee ≤ 1 %, treasury leg + whole snipe tax to the floor; no protocol leg; mint price is the revenue (MUST 34).
16. **First launch** — `holds`, or guardian co-sign for an agent's first launch; 7-day per-token spacing.
17. **Router access** — canonical Reach only; `quote*` open; venue table immutable; no Aerodrome, no aggregator, owned pool not a v4 hook in v1.
18. **Postage** — separate contract (one SLOAD per whisper), pull settlement to `feeSink`, mutual immutables by CREATE3 prediction.
19. **DM storage** — logs only, ≤ 4,096 B sealed; 4-head ring per room in state; no 64-entry ring; archive-node caveat stated.
20. **Key binding** — `bindKey` is `holds` (A's shape), closing the session-rotates-inbox footgun; `KeyRegistry` verbatim plus the 7627 view.
21. **Stealth** — the Reach calls ERC-6538 `registerKeys` directly via `execute`; no new code.
22. **MLS** — v2 (`ts-mls` unaudited; a per-group manager role contradicts "no setter"); ECIES pairs only in v1; MUST 22 deviation stated.
23. **Viewer** — no RPC in any document; injected provider only; panels hash-checked and Blob-injected; `tokenURI` ≤ 8 M measured by the gate.
24. **Panels on the live origin** — ordinary `/panel/<name>.js` resources, keccak listed in `/manifest` and in the state gap, checked before use; CSP `script-src 'unsafe-inline' blob:`, `connect-src 'self'`; no eval.
25. **Shopfront split** — `Catalog` (state block, selectors, services, venues, delegates) and `AgentCard` (8004/A2A/llms); `/manifest` and `/` in Premises; `/manifest` hashes route templates, not 4,096 ids.
26. **Mint proceeds** — Timelock-fronted `setPrice/setRoyalty/withdraw` until `sealPricing`; never a Grip (that would burn them).
27. **Steward** — one contract for succession and recovery; `stewardTransfer` through the sealed `_update`; hashed heir; duress; no standing approval anywhere.
28. **Market** — post-MVB; listing requires both seals ≥ `expiresAt`; fingerprint + balance floors; `moduleTransfer`; pull `owed`.
29. **Bands** — Base 1–3,072 first; Ethereum 3,073–3,584 canonical (ENS, Nameplate, before Glamsterdam); OP reserved. No bridge; `ParleyPort` v2.
30. **ERC-8004** — native identity from chain; mirror with 8217 as a holder action; never load-bearing; no ERC-7857 claim.
31. **ERC-4337 / passkeys / 7579** — not v1; the Reach is never a 7702 delegate.
32. **Toolchain** — IPSEITY `tools/` + `facets.mjs` + MASTER `static-audit.mjs`; `forge.mjs`'s unlimited-size harness is acknowledged; `compile.mjs` is the gate; suite runs twice in parallel jobs.
33. **Session caps** — expiry, cumulative native, per-asset ERC-20 delta caps, allowlists, `minInterval`/`uses`; no rolling per-period cap in v1 (MUST 12 partial, stated; the Safe-Allowance divisor bug is the reason to omit rather than ship untested).
34. **Reach storage** — layout frozen at the accounts unit with 16 reserved slots; the implementation hash is part of the edition's identity in `/manifest`.
35. **Audits** — two independent audits of `Intact`, `Reach`, `Pool`, `Launchpad` on the deployed commit before band 1; band 0 after band 1 has run a quarter in public.
36. **Deployment (U10)** — the Engine by plain CREATE at burner nonce 2 and its shards as unsalted SSTORE2 pointers at `CREATE(engine, 1 + k)` (§12 had said CREATE3 and `sha256(payload)`); salts keyed by record key; the CREATE3 factory gated to the burner and the Timelock after a review landed a stranger's contract at the hub's codeless `MARKET` pin and moved a token with it; the record carries no RPC endpoint; `recover-record` keeps IPSEITY's drift/contradiction distinction.

---

## 16. Deferred to v2 (with reasons)

- **`Lease` (paid ERC-4907 rentals)** — a renter cannot speak, swap or launch, so renting buys only the `R_USE` sentence; revisit when a rentable right exists (Roles covers delegation today).
- **`SealedRooms` / MLS** — `ts-mls` unaudited; MASTER's per-group manager role; 10 KB; pairs are sealed in v1 and the UI says groups are public.
- **`ParleyPort` federation** — adminless LZ lane with ≥ 2 DVNs is correct but unneeded until two bands have communities; "a dead lane is a dead mirror, never a loss" stays the rule.
- **`BondVault`, `WorkEscrow`, `InferenceMeter`, reputation/validation registries** — no hire flow in v1; reputation without settlement receipts is worse than none.
- **ERC-4337 companion (EntryPoint v0.9), passkey session signers (ERC-7913, `0x100`), ERC-7579/7821 execution shapes** — interface conformance, not authority; after audits.
- **CCA (MIT v2.1.0) with an NFT-gated `IValidationHook`; Doppler (BUSL)** — a third launch mode after the two ship; Doppler never without a licence grant.
- **Aerodrome in the venue set; owned pool as a v4 hook** — pending a primary read of upgradeability; two High-tier audits respectively.
- **Shelf/Releases hash-admitted cartridges, OTC bundle escrow, EAS attestations, estate inventory-digest exchange, consignment** — extension surface the brief did not ask for; ideas kept.
- **RAILGUN / Privacy Pools adapters** — wallet-layer; never a fork, never with a relayer or fee.
- **Rolling per-period session caps; x402 `PaymentRequirements` in `services.json`; ERC-7540 delayed exits; succession bounty** — small, after the MVB has run in public.
