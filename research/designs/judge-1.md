# Judge 1 — verdict on Designs A (KEEP, minimal delta), B (INTACT, clean-room diamond), C (KEEP, product-first)

Weighting per instruction: criteria 2 (authority model), 3 (security) and 4 (feasibility) carry double weight. Every byte and gas figure below was recomputed against the measured sizes in the dossiers (`out/solc.json` for IPSEITY, re-listed from the checkout: Ipseity 19,316; Renderer 20,747; Premises 15,372; PageManifest 23,105; Pool 11,626; IpseityAccount 13,461; GripVault 1,933; Parley 6,379; Kiln 13,709; Succession 6,457; ANIMA monolith 23,971; AgentLaunchpad 16,396; AgentComms 7,368; AnimaRoles 5,107; Garden kernel 23,785, Reach 17,714, Market 24,340). Bug claims were checked against the IPSEITY dossier §10 (C1 `Pool.sol:356-378`, C2 `Pool.sol:560-565`, C5) and against `src/Pool.sol`, `src/Ipseity.sol`, `src/IpseityAccount.sol`, `src/GripVault.sol`, `src/Succession.sol`, `src/Parley.sol`, ANIMA `AnimaAgent._update`/`unlockAgent`/`AnimaRoles`, and Garden `PixelGardenKernel._beforeTokenTransfer`.

## 1. Scores

| # | Criterion | A | B | C |
|---|---|---|---|---|
| 1 | Fidelity to GOAL | 8 | 7 | 9 |
| 2 | Authority model (×2) | 6 | 8 | 7 |
| 3 | Security (×2) | 6 | 8 | 7 |
| 4 | Feasibility (×2) | 5 | 8 | 5 |
| 5 | Reuse vs novelty | 9 | 7 | 8 |
| 6 | Differentiation | 7 | 8 | 8 |
| 7 | Build plan | 8 | 7 | 8 |
| 8 | Clarity/completeness | 7 | 8 | 8 |
| | Unweighted | 56 | 61 | 60 |
| | **Weighted (2,3,4 doubled)** | **73** | **85** | **79** |

**Ranking: B > C > A.**

## 2. Justifications

### Design A — KEEP, minimal delta

**Fidelity 8.** All four pillars plus the two surfaces are present and the MVB (units 1–10) ships Kiln/GateFacet/Planner, the Pool, Parley and the vault; the raise (`Raise`) and `Postage`/`Conduit` are phase 2. The viewer/live split and `rightsOf` gate (§4.2, §4.4) satisfy "wallet-verified". Loses a point because the launchpad in the MVB is instant-only and depends on live Uniswap v4 periphery for the fee-stream story (§7.3), which the in-container harness can only mock.

**Authority 6.** The custody epoch, `_update` roll, per-owner `approvalEpoch` and `mayActAs = ownerOf || account(id)` (§3.2–3.3, §5.4) are correct and verbatim from proven sources. Three defects pull it down. (i) *Three delegation models coexist*: a hub ERC-4907 `user` field, a `leaseAgentOf` pointer, and ERC-7432 `Roles` in phase 2 (§2 rows 1, 22, 23) — the brief's MUST 11 asks for one. (ii) *A use-lever leaks to renters and approvees*: §4.4 says "`USE` opens trait edits" while §2 says "owner: traits"; A's hub skeleton is `Ipseity.sol`, where `setTrait` is `onlyOperator(id)` (line 602/312), a modifier that admits the owner, any `isApprovedForAll` operator, the single approvee **and a live renter**. A makes `curve` a trait that `Pool.syncCurve(id)` copies with no `expected` argument (§5.1). That is IPSEITY's B2 ("renter front-runs the owner's sync") transplanted onto the owned pool, and it additionally hands a custody-only approvee a pricing lever. (iii) *The Steward moves the token through a standing single-token approval* (§8.6: "claim moves the token through a single-token `approve`") — IPSEITY `Succession.sol:263,320` confirmed. Any marketplace `approve(X, id)` silently overwrites it; the brief lists lingering approvals (Gondi, PPv2) as the class to eliminate, and B/C both use a pinned-module hub entry instead.

**Security 6.** C1 and C2 fixes are exactly right (§5.2: global transient lock on every state-changing function, `delete marketOf[id]` in `openMarket`, offsets read above `_pull`, `syncCurve` under the lock). C5 is **not fixed** — "stays monitored … with `bless` as the defence" — and the defence is an admin allowlist queued through a Timelock, which is also an admin (`setPaused`, `bless`, `setAllowlistEnforced`, §2 row 10, §11) over the holder's own market; constraint 3 tolerates a documented custody-free pause but A is the only design that keeps one. `unlock` at zero reverts (closes ANIMA's silent return). Session use requires `Active` (§8.2). New surface: `Conduit` (NEW), `Shelf`/`Releases` cartridges with a sandboxed frame (phase 3), Postage↔Parley mutual immutables.

**Feasibility 5.** *Hub*: 19,316 − ≈3.5 KB (section word, `openNode`, kernel) + epoch approvals/`setApprovalForAllUntil` (~0.8 KB) + `lockCount`/module list (~0.5) + guardian/status/panic (~0.6) + `rightsOf` with six guarded satellite reads (~1.2) + the fingerprint with eight guarded reads (~1.5) + `getTraitMetadataURI` JSON and `validateOnSale` (~1.0) ≈ 21.4–22.8 KB; A's "≈21,000, ≤22,500" is optimistic by 1–2 KB but the diamond fallback is named (§14.1). *Manifest*: budgeted ≤22,000 while its origin `PageManifest` is 23,105 B **before** adding `/llms.txt`+`.md`, `/open.json`, the door, `/.well-known/agent-card.json` and the 7702 delegate list — not credible without a split. *`tokenURI` gas*: A budgets ≤8 M. The dossier's measured rate is 19.99 M / 103,808 B ≈ 192 gas per output byte on the nested-base64 path and 4.48 M / 54,432 B ≈ 82 on `/live`. A's document is ≈1.5 KB head + ≈2 KB gap + base64(≤44 KB gzip) ≈ 59 KB + loader ≈ 62 KB; `/live` ≈ 5.1 M (budget ≤5 M, borderline); `tokenURI` output ≈ base64(62 KB) + crest + JSON ≈ 90 KB → 13–17 M allowing for sub-linear memory cost at smaller sizes. **A's 8 M is roughly half the measured-rate estimate**; it is reachable only with Garden's percent-encode lever, which A lists as a fallback (§3.5), not the plan. Toolchain choice (IPSEITY `tools/`) is right and measured in this container.

**Reuse 9.** The most verbatim design: `Engine`, `Grip`, `Roster`, `Locker`, `Timelock`, `Venue`, `KeyRegistry`, `Roles` untouched; NEW only `Crest`, `Conduit`, and `Postage` as an adaptation.

**Differentiation 7.** Twelve features, mostly shared with B and C; the distinctive ones are the curve-as-ERC-7496-trait (which is also the leak above), the Shelf/Releases hash-admitted extension slot, and ERC-6538 stealth registration from the Reach.

**Build plan 8.** Twenty units, MVB of ten, every unit names its ported test file and count and a sentence-shaped done-criterion; phases are honest.

**Clarity 7.** Dense and implementable, but with the §2/§4.4 trait contradiction, the Steward-by-approval vs "module allowlist (Roles, Steward, Lease)" inconsistency (§3.2), and `panic` that bumps the epoch but does not clear the 4907 user or lease agent (§8.5), so a renter keeps `R_USE` after a panic.

### Design B — INTACT, clean-room diamond

**Fidelity 7.** Every pillar is specified in depth, but the MVB (units 1–9, §13) contains **no launchpad and no router**: `Launchpad+Kiln+Coin+LaunchHook+LPCustodian` is unit 11 and `VaultRouter` unit 10. The GOAL names the launchpad as one of four things a mint must give; B's first shippable bundle gives three. The viewer carries the shell only (panels are lazy, §4.1), which is a deliberate and well-argued trade.

**Authority 8.** The strongest model: one `rightsOf`, `acts`/`holds` used by every satellite and re-derived by none (§2 vocabulary, §5.3, §6.1); every delegated right (roles, sessions, keys, memberships, steward, inbox) stamped with the epoch and compared live (§3.2); `stewardTransfer` runs the ordinary sealed `_update` so seals and locks are respected (§8.4); `panic` bumps both epochs, seals, **and revokes all sessions** (§3.2); the first launch of a token is `holds`-only (§7.1). Deductions: nesting is permitted with only a depth-2 cycle check (§3.2 `_refuseCycle`), which leaves the two holes traced in §6 below (Grip strand and nested-epoch leak); irrevocable roles lock the token (§2 row 3) so a `panic` kills the role by epoch but the lock persists to expiry; mint sets `Paused` (§3.1) so a fresh minter's sessions are dead until re-armed — correct but unstated friction.

**Security 8.** C1, C2 and C5 are all fixed as *guards* (§5.1): `Transient` lock on every mutator, explicit reserve zeroing, offsets read before `_pull`, and `totalReserved[token]` capping every payout — the only design that turns C5 from a monitor into an invariant. No admin anywhere (Pool switches deleted; "there is no setter anywhere after deployment", §11). `marketHash(id)` folds reserves into the fingerprint (§3.4) so a seller cannot drain the owned market between listing and settlement. Credits-not-tokens before graduation, `LPCustodian` with permissionless `collect`, the router building its own calldata (§5.2), ERC-7739 attestation-only 1271, open-approval ledger. New surface: the diamond's delegatecall fallback (immutable, with ANIMA's tested post-conditions), lazy panel evaluation (see flaw list: "no `eval`" vs "evaluates it"), a 64-entry sealed-DM ring **in state** whose write cost (≈128 slots for a 4 KB body ≈ 2.6 M gas) is never stated, and `WorkEscrow`/`BondVault` post-MVB.

**Feasibility 8.** Facets (13/11/6/14/1.7 KB) each leave ≥10 KB of headroom and the "~45 KB of hub logic" argument is consistent with the measurements (IPSEITY 19,316 without roles/traits/fingerprint/locks; ANIMA 23,971 without a site surface or bands). `tokenURI ≈ 6 M` is the only `tokenURI` budget in the three designs that survives the measured 192 gas/byte rate (≈30–36 KB output → 5–7 M). `/live ≈ 1.5 M` holds. Costs: `tools/facets.mjs` must be ported from ANIMA's TypeScript `deriveFacetCut`, the suite runs twice (diamond and monolith), `compile.mjs` needs an EIP-170 exemption for `IntactMonolith`. Under-budgets: `Catalog` 12 KB + `AgentCard` 12 KB = 24 KB for a shopfront whose IPSEITY ancestors (`PageManifest` 23,105 + `PageServices` 17,789) total 41 KB; `Launchpad` 17 KB against a 16,396-B origin that gains credits, clamp, `seed()` and loses OZ — tight; `Reach` 18.5 KB with a named `SessionPolicy` valve.

**Reuse 7.** Heavier adaptation and more NEW: `RightsFacet`, `AgentCard`, `LPCustodian`, `Crest`, `IntactMonolith`, the `VaultRouter` composition, and a half-new `Steward`. Each is justified in a sentence.

**Differentiation 8.** "The bundle moves intact" is the clearest thesis; the single predicate, `LPCustodian` streams, tax-to-floor, duress heartbeat, `SealedRooms`, and settlement-grounded feedback are defensible and named by mechanism.

**Build plan 7.** Seventeen units with done-criteria and a mutation gate ("one facet change fails >100 tests"), but the MVB omits the launchpad pillar.

**Clarity 8.** Signatures for Pool, Session, Steward and the rights bits; few contradictions (eval; `MINT_RECIPIENT` = a Grip, which makes mint proceeds permanently unspendable — a choice presented as a feature in §14.6 without saying so).

### Design C — KEEP, product-first

**Fidelity 9.** All four pillars in the MVB (units 1–8), including a raise that graduates into a sealed market inside the protocol's own Pool (§7), so the MVB launchpad needs no live Uniswap periphery. Viewer mode with a self-drawn QR, `/live` as the console, `rightsOf` bits, a feature ranking derived from holder value.

**Authority 7.** The best transfer rule of the three: refuse `to` = own accounts **and any address whose `AccountBinding.token()` names this collection** (§3.2) — Garden's rule (`PixelGardenKernel.sol:773-797`), which eliminates ownership cycles at every depth and the Grip-strand and nested-epoch holes that A and B leave open. `moduleTransfer` for Steward and Market, `panic` with both epochs, guardian co-sign for a guarded token's first launch (§9). Deductions: no ERC-7432 roles and no paid lease ("a renter cannot speak, swap or launch, so renting a Keep buys nothing", §2) — consistent, but it drops MUST 11; whether session use requires `Active` is never stated, so `Paused` may be decorative; `Market.list` seals the Reach to expiry but **does not require the Pool bond to cover the listing**, and the fingerprint "deliberately excludes balances" (§3.4) with floors over Reach/Grip only — so a seller can `withdraw` an unbonded owned market after listing without moving the fingerprint; `feesToGrip` routes income into a receive-only account permanently (holder's choice, stated).

**Security 7.** C1, C2, C5 fixed as in B (§5.1, `totalReserved[token]`), Pool admin deleted, credits until graduation, snipe tax to the floor, static hook fee so PR #36's race cannot exist, `moduleTransfer` instead of approvals. New surface: `Market` (NEW), sealed markets as permanent liquidity, `Launch.create` that "pulls `curveSupply` from the Reach" — which needs a Reach-granted approval the seal forbids on manifest assets, so a sealed Reach cannot launch a raise (unstated), and `boundWalletOf` with an EIP-712/1271 proof **inside the hub** (bytes).

**Feasibility 5.** *Hub*: `Keep ≤ 23,000` must carry Enumerable, 7496 traits, the 17-field fingerprint with five satellite reads, `rightsOf` with a delegate.xyz read, `moduleTransfer`, `panic`, fee-sink, and an EIP-712+1271 verifier for `setAgentWallet` — from 19,316 that is 23–24.5 KB; C names the diamond fallback at unit 3, fairly. *`tokenURI`*: C budgets ≤12 M for "a 45–50 KB gzip body plus a 4 KB state block". That is **the same gzip size as IPSEITY's measured page** (39.5–44.3 KB), and C's output (base64 of a ≈69 KB document + an 8 KB card + JSON ≈ 100 KB) is essentially IPSEITY's 103,808 B that cost 19.99 M. At the measured rate C's `tokenURI` is ≈17–20 M, **over the 16,777,216 cap**, and `/live` ≈ 5.7 M against a ≤4 M budget. C's §14.3 fallback (ship the card as face 0 and make `/live` the only app) is sound but is a different product from the one §3.5 promises. *Manifest ≤22,000*: same under-budget as A.

**Reuse 8.** Mostly adapt; NEW only `Market` and `Card`; the sealed-market extension of Pool is the largest new mechanism.

**Differentiation 8.** The ranked table (§10) is the most honest feature audit of the three; sealed markets, seal-as-listing, home rooms and the Grip-first framing are distinctive and buildable.

**Build plan 8.** Nineteen measured units; MVB of eight covers mint→site→connect→swap→speak→launch→vault; `invariants-check` and transient-registry gates.

**Clarity 8.** Struct and API given for Pool and Market; gaps: status/session coupling, `Launch.create` pull path, floor scope.

## 3. Byte budgets recomputed

| Contract | Origin (measured) | A budget | B budget | C budget | Judge's estimate / verdict |
|---|---|---|---|---|---|
| Hub | Ipseity 19,316; ANIMA 23,971 | ≤22,500 (est. 21,000) | facets 13/11/6/14/1.7 KB | ≤23,000 | A ≈21.4–22.8 KB (tight, fallback named); C ≈23–24.5 KB (likely over, fallback named); B comfortable |
| Renderer | 20,747 | ≤18,000 | 16 KB | ≤19,000 | all plausible after dropping art faces |
| Manifest/shopfront | PageManifest 23,105 (+PageServices 17,789) | ≤22,000 | Catalog 12 + AgentCard 12 | ≤22,000 | **all three under-budget**; needs ≥2 contracts (B) or 3 |
| Reach | 13,461 (Garden Reach 17,714) | ≤17,000 | 18.5 KB | ≤18,500 | A's 17 KB with `executeTyped`+ledger+recipes+7739 is tight; B/C plausible; B names a valve |
| Pool | 11,626 | ≤14,500 | 14 KB | ≤17,000 | A/B plausible; C's sealed markets justify 17 KB |
| Parley | 6,379 | ≤8,500 (+Postage 8,000) | 14 KB (postage, rings, follows inside) | ≤9,000 (+Inbox 9,500) | B's single 14 KB is the riskiest; A/C's split is safer |
| Launchpad | AgentLaunchpad 16,396 | Raise ≤17,000 | 17 KB | Launch ≤18,000 | all tight; OZ removal buys ~1 KB |
| Grip | 1,933 | 1,933 | 2 KB | 2,000 | verbatim, fine |

## 4. View gas recomputed (measured rates: 192 gas/output byte nested-base64, 82 gas/byte on `/live`)

| | Document | `/live` est. | `tokenURI` output | `tokenURI` est. | Design's budget |
|---|---|---|---|---|---|
| A | ≈62 KB | ≈5.1 M | ≈90 KB | 13–17 M | ≤5 M / **≤8 M** |
| B | ≈22 KB (shell) | ≈1.8 M | ≈36 KB | 5–7 M | ≈1.5 M / ≈6 M |
| C | ≈69 KB | ≈5.7 M | ≈100 KB | 17–20 M | ≤4 M / **≤12 M** |

B is the only design whose `tokenURI` number is derived from the measured rate rather than asserted. A and C must either adopt Garden's percent-encode-once envelope (removes one base64 pass; ≈8–11 M for A) or B's lazy panels. Mint gas (300–400 k) is consistent with Garden's measured 299,485 in all three.

## 5. The three bugs, checked against the dossier and `src/Pool.sol`

- **C1** (`openMarket` inherits phantom reserves after a `closeMarket` re-entered from `deposit`'s pull; `nonReentrant` only on `deposit/withdraw/swap`; `openMarket` writes `base/quote/feeBps/open/curveWord` without zeroing `rBase/rQuote` — confirmed at lines 356–392). A, B, C all apply the two required parts (global lock on every mutator; explicit zeroing). Correct in all three. A additionally finishes `PoolReenter.sol` as the regression.
- **C2** (`swap` reads `rIn/rOut/vIn/vOut` after `_pull` — confirmed at 560–565; a holder-controlled input token calls unguarded `syncCurve`). All three move the reads above `_pull` and put `syncCurve`/`setShape` under the lock. Correct in all three.
- **C5** (cross-market over-claim with rebasing/sweeping tokens; monitored by `agents.mjs` invariant 63; `bless` is the defence). **A leaves it monitored** and keeps the admin allowlist. B and C add `totalReserved[token]` and cap payouts at `balanceOf(this) − (totalReserved − thisReserve)`. Neither B nor C notes that a downward rebase makes that subtraction underflow and revert, turning theft into a withdraw-DoS for every market in that token — acceptable (fail closed) but it should be a stated and tested property.

## 6. Authority trace

| Path | A | B | C |
|---|---|---|---|
| **Transfer** | epoch++, clears single approval, user, lease agent, guardian; Paused; per-owner `approvalEpoch` untouched (buyer starts clean). Correct. | epoch++ incl. self-transfer and steward moves; clears guardian, agent wallet, lease; Paused; everything else dies by epoch. Correct. | epoch++; clears user, guardian, bound wallet, `feesToGrip`, pinned face; Paused. Correct. |
| **Rental (4907 user)** | `R_USE` → "trait edits" (§4.4); hub skeleton's `setTrait` is `onlyOperator` → renter can set `curve` → `syncCurve` has no `expected` → **B2 on the owned pool**. Renter never speaks/swaps. | USER = `recipientOf(USER)` role, revocable → dies by epoch; `R_USE` renders a sentence only. Correct. | user cleared; renter has no lane; no roles; consistent, drops MUST 11. |
| **ERC-7432 role** | phase 2 `AnimaRoles` verbatim: live role → module lock → transfer reverts; `R_ROLE` bit exists. OK. | roles epoch-stamped; irrevocable ≤365 d locks token; `panic` kills role validity but lock persists to expiry (holder-made, bounded). | none. |
| **Operator approval** | custody only (`R_CUSTODY`); never use. `panic` bumps `approvalEpoch[owner]` → revokes the owner's operators on **every** token they hold, and a per-token guardian can trigger it. | same, same cross-token effect. | same, same cross-token effect. |
| **Session key** | `mark = custodyEpoch`; requires `Active`; never 1271; `executeTyped` deltas. Correct. A session allowed `Pool.withdraw(…, to)` moves reserves the seal does not measure — unstated. | epoch-stamped, `Active` required, ERC-20 delta caps, recipes, guardian may revoke. Correct; same Pool-outside-seal note. | epoch-stamped, four bounds, scoped grants; `Active` requirement unstated. |
| **Guardian** | pause/panic only; cleared on transfer. | pause, `revokeAllSessions`, `sealMax`; cleared. | pause/panic; co-signs first launch; cleared. |
| **Steward** | silence or ≥2-of-N; **standing single-token `approve`** (overwritable by any marketplace approval; a lingering approval by construction). | `hub.stewardTransfer` from a CREATE3-pinned immutable, through sealed `_update`; hashed heir; duress. Best. | `Keep.moduleTransfer` from pinned `STEWARD`; `toToken` heirs. Good. |
| **6551 nesting / cycle** | refuses own `account(id)`/`grip(id)` + depth-2. **Hole 1**: token *k* → `grip(j)` is allowed (Grip's `onERC721Received` accepts everything, `GripVault.sol:92`) and *k* is dead forever. **Hole 2**: token *k* → `reach(j)` is allowed; selling *j* rolls *j*'s epoch, **not *k*'s**, so the seller of *j* keeps every session, key binding and steward plan on *k*. Depth-3 cycles pass the check. | same two holes and depth-3 (§3.2 `_refuseCycle`); Reach's own `onERC721Received` refuses only its own token (IPSEITY line 957). | refuses any canonical account of the collection as `to` (Garden rule): no nesting, no strand, no cycle at any depth. **Correct by construction**; the brief's "≤8-hop walk" becomes unnecessary. |

## 7. Ten ideas the winner (B) lacks

1. **Refuse any canonical account of this collection as a transfer recipient** — C §3.2 (Garden `_beforeTokenTransfer`). Closes both nesting holes and all cycle depths in one `if`.
2. **Sealed markets inside the owned Pool as the graduation target** with permissionless `collect` paying `feeSink(id)` — C §5.1/§7. Puts the launchpad in the MVB without live v4 periphery; `LPCustodian` becomes the v4 option.
3. **`Market`: listing is a seal, `buy(id, agreed, fingerprint)`, `moduleTransfer`, pull `owed`** — C §8 (plus the fix: require Pool bond ≥ `expiresAt`).
4. **Launchpad in the MVB, guardian co-sign on a guarded token's first launch, 7-day per-token spacing** — C §7, §9, §13 unit 8.
5. **`executeTyped` with `spend` caps and `receiveMin` floors** (Garden `_perform`) — A §8.2. B has delta caps but no receive floors; "swap exactly this for at least that" needs both.
6. **`Postage` as its own contract behind `whisperStamped`** — A §6.3, §2 row 15. Keeps `Parley` near its 6,379-B origin instead of B's 14 KB single contract.
7. **Timelock-fronted curator for mint price/royalty/withdraw until sealed** — A §2 row 25, §11. Replaces B's `MINT_RECIPIENT = a Grip` (proceeds unspendable forever) with a bounded, documented lever that renounces.
8. **`err:{selector→name}` table in the state block** so the confirm slab decodes custom errors from `eth_estimateGas` — C §4.1/§4.4.
9. **`feesToGrip` fee-sink bit** — C §2 row 1, §5.1: holder routes every income leg into the receive-only hand.
10. **ERC-6538 stealth meta-address registration from the Reach, no relayer** — A §10.10 (brief SHOULD 50); plus **`Nameplate`** in the inventory with custody-is-binding — C row 25 (B leaves ENS as "if wanted").

Honourable mentions: A's MASTER `static-audit.mjs` + "incomplete ≠ pass" gate (§12); A's Shelf/Releases hash-admitted extension slot as a COULD; C's V×D÷C feature ranking as a doc artefact; A's `Lease` paid-rental as phase 2.

## 8. Flaws and contradictions (adversarial)

**A.**
1. §2 "owner: traits" vs §4.4 "`USE` opens trait edits"; `Ipseity.setTrait` is `onlyOperator` (renter + approvee admitted) and `Pool.syncCurve(id)` takes no `expected` word — B2 reproduced on the owned pool, approvee gets a pricing lever.
2. Steward by standing single-token approval (§8.6) contradicts the module path (§3.2) and re-creates the lingering-approval class.
3. C5 not fixed; Pool admin (`setPaused`, `bless`, allowlist) retained — the only design with an admin over the swap.
4. `tokenURI ≤ 8 M` unsupported by the measured rate (13–17 M); `/live ≤ 5 M` borderline.
5. `Manifest ≤ 22,000` for more content than a 23,105-B contract.
6. Hub estimate 1–2 KB low.
7. Depth-2-only cycle check: Grip strand and nested-epoch leak (table above).
8. `panic` leaves the 4907 user and lease agent in place.
9. Three delegation models (user field, lease agent, Roles).
10. Guardian-triggered `panic` revokes the owner's operators across all their tokens (shared with B, C).
11. Postage↔Parley mutual immutables require CREATE3 prediction in both directions; acknowledged (§14.4) but untested in the plan.
12. "Shelf" cartridges (phase 3) are a new attack surface the brief never asked for.

**B.**
1. MVB has no launchpad and no router — fidelity to the four-pillar GOAL is deferred to units 10–11.
2. §4.6 "no `eval`" vs §4.1 "verifies `sha256(bytes)` … and only then evaluates it": feasible only via an injected inline `<script>` under `'unsafe-inline'`; the mechanism must be named or the CSP weakened.
3. Sealed-DM 64-entry ring **in state** (§6.2): ≈2.6 M gas per 4 KB DM on write, never costed; on mainnet band ≈ $1–4 per message.
4. `MINT_RECIPIENT` = a Grip of token #1 (§14.6): mint proceeds permanently unspendable; presented as "un-adminned" without saying "burned".
5. Depth-2 cycle check only: Grip strand, nested-epoch leak, depth-3 cycles.
6. `Catalog`+`AgentCard` 24 KB vs 41 KB of ancestor shopfront bytes; `Launchpad` 17 KB tight; `Parley` 14 KB carries five grafts.
7. Irrevocable role lock survives `panic`.
8. Mint sets `Paused`: minter must re-arm before any session works; unstated UX.
9. `totalReserved` underflow on a downward rebase → withdraw DoS for that token; unstated.
10. `stateOf` lives in `SiteFacet` while the catalog lives in `Catalog`; the state-block builder's location is split across two sections.
11. Guardian `panic` cross-token operator revocation (shared).
12. The diamond runs the suite twice; CI time doubles against a 4-minute cold compile — not budgeted.

**C.**
1. `tokenURI ≤ 12 M` for a ≈48 KB gzip body is the measured IPSEITY shape at ≈20 M — likely **over the 16,777,216 cap**; `/live ≤ 4 M` vs ≈5.7 M.
2. `Keep ≤ 23,000` with Enumerable, 7496, 17-field fingerprint, delegate.xyz read, `moduleTransfer`, and an EIP-712/1271 verifier for `setAgentWallet` — likely over; fallback named.
3. `Market.list` seals the Reach but not the Pool; fingerprint excludes balances; floors cover Reach/Grip — seller can drain an unbonded owned market after listing.
4. `Launch.create` "pulls `curveSupply` from the Reach": needs a Reach approval the seal forbids; sealed Reaches cannot raise.
5. Session-use `Active` requirement unstated; `Paused` may be decorative.
6. No ERC-7432 roles and no lease — brief MUST 11 dropped (argued, but a fidelity gap).
7. `Manifest ≤ 22,000` under-budget (as A).
8. `feesToGrip` makes income permanently unspendable; holder choice, but the page must say "burned for spending".
9. `boundWalletOf` EIP-712 proof in the hub costs bytes the hub does not have.
10. Guardian `panic` cross-token operator revocation (shared).
11. Sniper fee "only after `openMarket`" diverges from brief SHOULD 46 — but C's reasoning (no re-arm against standing traders) is better than the brief's; keep C's.

## 9. Naming: KEEP vs INTACT → **INTACT**

Two architects converged on KEEP independently, which is a point for it. Against it: **Keep Network** (tBTC's `KEEP` token, 2020–2023, merged into Threshold) is a same-industry collision with a listed ticker; "keep" is also an unsearchable common word. INTACT names the guarantee the buyer pays for and the test suite asserts (the bundle moves intact, the site is served intact, no key can touch the holder's guarantees); it has no crypto collision; `web3://intact.eth/token/7/live` reads as well as `keep.eth`. The mechanisms are name-independent (A §1 says so). Decision: INTACT; keep "Reach"/"Grip"/"Premises" as the sub-names all three share; verify ENS availability before the first salt string is frozen.

## 10. Recommended base and grafts

**Base: Design B** — the immutable diamond hub with one `rightsOf`, epoch-stamped rights, `stewardTransfer`, guarded C1/C2/C5, no admin, `marketHash` in the fingerprint, and the only `tokenURI` budget that survives arithmetic. A and C both admit they may need B's hub anyway ("if `Keep` exceeds … adopt ANIMA's diamond"); starting there avoids a mid-build pivot of the one contract every satellite trusts.

**Grafts, in order of necessity:**
1. C's transfer rule: refuse any canonical account of this collection as `to` (replaces `_refuseCycle`'s depth-2 walk).
2. C's sealed markets in `Pool` as the MVB graduation target; move `Launchpad+Kiln+Coin` into the MVB; keep `LaunchHook`/`LPCustodian` as the v4 unit after it.
3. C's `Market` (seal-as-listing, fingerprint + floors, `moduleTransfer`, pull `owed`) **with** `Pool.sealMarket ≥ expiresAt` required at `list`.
4. A's `Postage` split out of `Parley`; A's `whisperStamped` one-press path.
5. A's `executeTyped` (`spend` caps + `receiveMin` floors) into B's session system.
6. A's Timelock-fronted price/royalty/withdraw until `sealPricing`, replacing `MINT_RECIPIENT = Grip`.
7. C's `err` table and C's guardian co-sign of a guarded token's first launch; C's 7-day per-token launch spacing.
8. C's `feesToGrip`; A's ERC-6538 registration from the Reach; C's `Nameplate` on band 0.
9. Resolve B's panel evaluation explicitly (inline `<script>` injection under `'unsafe-inline'`, no `eval`), cost the DM state ring or drop it to a 32-entry hash tail, and state the `Active`/`Paused` session rule on the Identity screen.
10. Split the shopfront into three contracts (catalog, agent card, llms/well-known) sized from `PageManifest`/`PageServices`, and measure `tokenURI` on three public Base RPCs before `Engine.freeze()`.
