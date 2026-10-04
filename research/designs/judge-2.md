# Judge 2 — verdict on designs A, B and C

Weighting per brief: criteria 1, 5, 6, 7 and 8. Method: read all three designs and the research brief in full; walked the holder and agent journeys step by step; checked every byte count, branch name, PR/commit, line citation and function name a design relies on against the four dossiers and the four source trees (read-only). Facts established by those checks and used below:

- IPSEITY sizes, branches and line numbers verify: `8vvyc8` carries a 53,097-byte `console-lanes.js` and `ConsoleRead.sels()`; `hciyvv` carries `GateFacet.sol` whose `syncFee()` takes **no** argument; PR #36's branch has `Facet.syncFee(uint256 expectedSection)`; `PoolReenter.sol` and `poc-pool.mjs` exist. `ipseity.html` lines 1859–2396 are exactly 24,449 bytes (A exact; B's "≈25 KB" fine; C's "≈38 KB" inflated). `Chrome.WALLET_JS` is 2,600 characters.
- IPSEITY's Reach has **no `state()`**; `Succession` has no guardians, hashed heir or 7878 views; `Pool` has no `swapExactOut`; the hub has no `rightsOf`/`panic`/`custodyEpoch` (it has `_ownerEpoch`, bumped `unchecked`) but **already has** ERC-7496 traits; `Renderer.document` takes a `TokenView`.
- ANIMA: `approvalEpoch`, `setApprovalForAllUntil`, `revokeAllApprovals`, counted locks, `getStateFingerprint`, `_update` (line 729), `isApprovedForAll` (841) exist; `koorbx` really has `SessionScope`, `grantScopedSession`, `EmptyBatch`; `AnimaDiamond`'s constructor takes an init contract; `AgentAccount.grantSession` is native-only; `AgentComms.refund` is a push.
- Garden: `isCanonicalAccount` (kernel 281-299), `_perform` (Reach 389), `Call{…, spend[], receiveMin[]}`, recipe `grantSession`, `whispers.mjs`, `sessionExposure` exist; the Garden Reach has no ERC-1271.
- MASTER's cited files live under `legacy/anima-v7/`. `OfficialV4QuoteLens.sol` is **MIT** (BUSL attaches to Doppler, not the lens). `TimeVault` has `accountCommitment`; `MLSGroupChat` has a per-group manager role.
- The working repository already contains IPSEITY's `tools/{compile,evm,forge,rpc,selftest}.mjs` and calls itself "KEEP (working name)".
- Measured ratio: `tokenURI()` 19.99 M / 103,808 B ≈ 192 gas per output byte; `/live` 4.48 M / 54,432 B ≈ 82.

## 1. Scores

| Criterion | A (KEEP, minimal delta) | B (INTACT, clean-room diamond) | C (KEEP, product-first) |
|---|---|---|---|
| 1 Fidelity to GOAL | 7 | 7 | 7 |
| 2 Authority model | 7 | 9 | 7 |
| 3 Security | 7 | 8 | 6 |
| 4 Feasibility | 5 | 7 | 6 |
| 5 Reuse vs novelty | 9 | 6 | 8 |
| 6 Differentiation | 7 | 8 | 7 |
| 7 Build plan | 7 | 7 | 8 |
| 8 Clarity | 8 | 8 | 7 |
| **Total /80** | **57** | **60** | **56** |
| Weighted sum (1,5,6,7,8) /50 | **38** | 36 | 37 |

### Justifications

**1. Fidelity.** *A (7):* all five pillars are contracts in the MVB (18 units), but the build plan ships the MAKE and ACT lanes in phase 2, so the MVB's "launchpad" and "agent" have no UI; the viewer reads through "a user-typed RPC", which bends hard constraint 1 ("the user's wallet's RPC and nothing else"); v4 LP goes to the Reach, not a custodian. *B (7):* the fullest design against the brief (agent card, LPCustodian, credits, steward with duress), but its MVB (units 1–9) has **no launchpad and no router** — the third pillar is unit 11; its viewer is the only constraint-1-compliant one ("reads everything baked into the state gap without any network") at the price of showing only Home where no provider injects. *C (7):* the only MVB that delivers mint→site→connect→swap→speak→launch→vault **with screens** (units 1–8), and sealed markets make fee streams work without v4; but the viewer "read-only through a public RPC the state block names per band" bakes an external service into the token, violating constraint 1, and the `Router` is "anyone; no owner" rather than 6551-only.

**2. Authority.** *A (7):* epoch design is right (self-transfer bumps, buyer starts at own `approvalEpoch`, `panic` rolls both), but §4.4 "`USE` opens trait edits" while §5.1 makes the `curve` trait the pool's input and `syncCurve` takes no expected value — a renter can move the word between the owner's `pendingCurve` read and `syncCurve`, i.e. B2 reborn on the owned pool (and the hub table says "owner: traits", contradicting §4.4). Steward `claim` moves the token "through a single-token `approve`", so any later `approve(marketplace)` silently voids the arrangement. `Reach.state()` is read by the fingerprint but never added. *B (9):* one `rightsOf`, `acts`/`holds` used by every contract, every delegated right dies by epoch, `stewardTransfer` pinned to `STEWARD`, `Ratchet.raise` for every clock, `panic` revokes sessions; only footguns: `setTokenKey` is `acts`, so a session allowed that selector could hijack the inbox (defaults deny), and status is `Paused` at mint. *C (7):* `onlyActor` consistent, `moduleTransfer`, `setShape(id, bps, expectedShape)` closes B2; but `Launch.create` "pulls `curveSupply` from the Reach" — an EOA-signed `create` needs a standing coin approval from the Reach, which C's own open-approval ledger would flag; `Router` is not 6551-gated (MUST 15); `Reach.state()` again unadded; `setKeyFor` by actor has B's footgun.

**3. Security.** *A (7):* C1/C2 fixed with the global transient lock and `delete marketOf[id]`; C5 only monitored (`bless` via Timelock); B1/B3/B4/B5 taken from the right branches; ERC-7739 wrapping, `static-audit.mjs`, transient-slot registry, `EmptyBatch`, revenue-revival replay all present; the trait-race above is a regression of a fixed class. *B (8):* C1/C2/C5 guarded (`totalReserved[token]`), `expectedKeyId` pinned on chain, pre-initialised pool checked within 1 % and `resalt`, LPCustodian CEI, credits, per-launch isolation, permission bits asserted; new surface: runtime panel loading (hash-pinned, but §4.6 says "no `eval`" while §4.1 "evaluates" the panel — the mechanism is unstated), `rpcHint` in the state gap is unexplained, the MLS manager role is unflagged, no explicit `tx.origin`/`extcodesize==0` rule. *C (6):* C1/C2/C5 ✓, but no ERC-7739 (only "domain-separated"), `beforeInitialize` foreign-key refusal and the permission-bit test are not stated, no static audit, a baked public RPC in the viewer, and special feature #13 is unbuildable as written (below).

**4. Feasibility.** *A (5):* "`tokenURI` budgeted at ≤ 8 M" is contradicted by A's own cited numbers: A's document is ≈44 KB gzip, the same size as IPSEITY's (39.5–44 KB), and IPSEITY's reads at 19.99 M; subtracting the SVG/trig face leaves ≈16–17 M for the same path, so the ≤8 M done-criterion in unit 4 will fail (the Garden percent-encode lever in risk 6 is the right fallback, but it is not the budget). `Reach ≤ 17,000` from 13,461 plus `executeTyped`, recipes, koorbx fields, the ledger, 7739 and `state()` is under-budgeted (B and C both budget 18.5 KB). `Manifest ≤ 22,000` from a 23,105-byte `PageManifest` that is at 94 % **and gains** `.well-known`, `llms.txt/.md`, `/open.json`, the door and the 7702 list is not credible without cuts the design does not name. *B (7):* the diamond removes the hub-size risk by construction and the shell-only `tokenURI` (~14 KB gzip → ≈6 M) is the only budget consistent with the measured ratio; but `Kiln 14 KB` from 13,709 while adding `initialize`, PositionManager mint encoding (IPSEITY's `V4PositionPlanner` needs 5,928 B for exactly that), Permit2, `seed` and `resalt` is under-budgeted; the `IntactMonolith` (~45 KB) "the suite also runs against" cannot deploy on the Cancun harness without lifting EIP-170 in `evm.mjs`/`forge.mjs`, which is unstated; the whole suite runs twice. *C (6):* `tokenURI ≤ 12 M` for a 45–50 KB gzip body reads ≈15–17 M by the ratio and `/live ≤ 4 M` for ≈64 KB reads ≈5 M; C has the honest fallback (face 1 default, `/live` primary); `Manifest ≤ 22,000` has A's problem; `Pool ≤ 17,000` with sealed markets is plausible. All three correctly pick IPSEITY's Node toolchain, which the repository already contains; all three mint at ≈300–400 k gas (Garden measured 299,485).

**5. Reuse.** *A (9):* every contract names a single primary origin; verbatim: Engine, Grip, Venue, Roster, KeyRegistry, Locker, Roles, Timelock, Coin, FloorCoin; three NEW (Crest, Conduit, Postage — the last really an AgentComms adapt); IPSEITY ABIs survive, so the 22 verifiers port with the fewest edits. *B (6):* almost every contract merges two to four origins (CoreFacet = A+I+G on a vendored Solady ERC-721, Reach = I+A+branch+M, Parley = I+G+A), so `Ipseity.t.sol`, `verify.mjs` (121) and `verify-vault.mjs` (97) must be re-targeted rather than ported; five NEW (RightsFacet, Crest, AgentCard, LPCustodian, IntactMonolith), each justified; the table labels `Intact` and `Engine` "V" while changing both (no init contract; `loadPanel`). *C (8):* 26 contracts, two NEW (Card, Market), mostly single-origin adaptations; `QuoteLens` from the MIT `OfficialV4QuoteLens`; follow = `Parley.join` + `Roster.membersOf` is the best piece of reuse in any design.

**6. Differentiation.** *A (7):* twelve features; the stealth drop-box is specified correctly (the Reach calls `registerKeys` as `msg.sender`, no 1271 needed); "seal-as-listing" has no listing venue in A, so it is a convention; curve-as-trait is novel but carries the race. *B (8):* the most complete realisation of the brief's fifteen ideas (steward with duress and `attest`, LPCustodian, credits, tax-to-floor, priced `knock`, MLS keyed by token id, "zero ≠ no answer" as a bitmask) and the one real conceptual addition — a single ratchet rule and a single rights predicate; misses ERC-6538 stealth and any curve signal. *C (7):* the ranked V×D÷C table is useful discipline; sealed markets in the owned pool and a real `Market` contract are genuine novelties; but #1 (Grip) is inherited, #13 (stealth) is unbuildable as specified, and MLS, roles and federation are cut.

**7. Build plan.** *A (7):* twenty file-level units with ported suites and counts; but unit 10 lists `/k` refusal as a done-criterion while ACT is "phase 2", and the gas done-criteria (≤8 M, ≤5 M) are wrong. *B (7):* seventeen units, mutation-based done-criteria ("one facet fails > 100 tests"), both builds in CI; MVB honestly stated but without the launchpad; units 3 and 11 are very large. *C (8):* the most honest MVB (all four lanes), measured gates (`grep "(1n<<256n)-1n"` fails the build, `invariants-check`), screens ordered by dependency; agent door post-MVB.

**8. Clarity.** *A (8):* the most line-cited design; an implementer would start, then hit the budget surprises. *B (8):* the clearest vocabulary and ABIs (Session struct, Pool, Steward); unspecified: panel evaluation, monolith harness, `launchInstant` internals, `rpcHint`. *C (7):* screens are the most concrete; gaps on LP recipient for hooks, the supply pull, Router access, hub size.

## 2. Holder and agent journey

Each cell: contract.function the design names → surface status (✓ exists in origin, N = NEW and justified, ✗ = missing/unjustified/contradicted).

| Step | A | B | C |
|---|---|---|---|
| Mint | `Keep.mint/mintTo` (I:352-407 ✓) + canonical registry + `isCanonicalAccount` (G:281 ✓), callback last ✓ | `MintFacet.mint(to)` (G+A adapt ✓), `PRICE` immutable, `_safeMint` last ✓; status **Paused at mint** (holder must re-arm) | `Keep.mint(to)` ✓, `_mint` without callback → accounts → receiver ✓, Active at mint ✓ |
| Open from marketplace | face 0 = `Renderer.document` (origin takes `TokenView`, minor) ✓; viewer via **user-typed RPC** (constraint 1 bent) | shell + lazy panels via wallet `eth_call`, SHA-256 (M `chain-loader` ✓, G `verifyHostModule` ✓); Home only without provider; `rpcHint` unexplained | `Renderer.document(view)` ✓; viewer via **baked public RPC** (constraint 1 ✗) |
| Open on `web3://` | `Premises.request` ✓, `/token/<id>/live` by router ✓, `/manifest` N | `Premises` ✓ + `/panel/*` by Engine (N) ✓ | `Premises` ✓, `/k/<id>/<key>` by `Renderer.document` ✓ |
| Connect | `Chrome.WALLET_JS` (2,600 B ✓) into engine; 7702 list in `Manifest` N | EIP-6963 + `Catalog.knownDelegates()` N | EIP-6963 + `StateBlock.knownDelegates` N |
| Verified | `Keep.rightsOf` N (not in I) ✓ bits | `RightsFacet.rightsOf` N ✓ (flagged NEW) | `Keep.rightsOf` N ✓ + delegate.xyz bit |
| Swap | `Pool.swap` ✓ / `swapExactOut` N; `Conduit` N (phase 2) Reach-only ✓ | `Pool.swapExactIn/Out` N; `VaultRouter` N, Reach-only ✓ (holder swaps via `Reach.execute`) | `Pool.swap/swapExactOut` N; `Router` N **anyone** ✗ (MUST 15); `QuoteLens` (MIT ✓) |
| Post | `Parley.speak/whisper` ✓; home room `keccak(3,id)` N; `re` N; `whisperStamped`→`Postage` N | `Parley` ✓ + `knock` (A `AgentComms` ✓) + `follow` array N + `hide` (G ✓) + DM ring N | `Parley` ✓ + home rooms N + `reBlock/reSeq` N; follow = `join` + `Roster.membersOf` ✓✓; `Inbox` (A ✓) |
| Launch | `Kiln.launch` ✓ (mint to Reach, stated); `mine/deployHook` ✓; `GateFacet` (branch ✓) + PR #36 ✓; `Planner` (branch ✓); `Raise` (A ✓, phase 2); LP → Reach, not custodian ✗ (MUST 17); MAKE lane phase 2 | `Kiln.launchInstant` (adapt, over-budget) + `Launchpad.create` credits N + `LaunchHook` (I Gate + branch + M Phoenix ✓) + `LPCustodian` N + `Locks` (M TimeVault ✓); pre-init check + `resalt` ✓; **post-MVB** | `Kiln.launch` ✓, `Launch.create` (A ✓) credits N, `fail` N, `graduate`→`Pool.openSealed` N ✓, supply pull needs Reach approval ✗; hooks post-MVB, LP recipient unstated |
| Lock | `Locker.lock/give` ✓, `Pool.bond` ✓, `Reach.seal` ✓ | `Locks` (TimeVault ✓), `Ratchet` lib N, three seals | `Locker` ✓, bond, seal ✓ |
| Delegate to agent | `Reach.grantSession` ✓ + `grantRecipe` (G ✓) + `executeTyped` (G `_perform` as idea) + koorbx fields ✓; `/k` 301→`/live?as=` N; `services.json` (PageManifest ✓); ACT lane phase 2 | `grantSession/grantRecipe` N-merge, ERC-20 delta caps (M ✓); Agent panel + `TERM.run` (DeskTerm ✓); unit 13 | `grantSession` ✓ + `setTokenCap` N + `grantScoped` (koorbx ✓); `/k` ✓; unit 14 |
| Sell | `transferFrom` (I:978 ✓) + A `_update` grafts ✓; `custodyEpoch` N replaces `_ownerEpoch` ✓; Steward via **standing approve** ✗ | sealed `_update` (A `AnimaBase` ✓) + `stewardTransfer` N ✓ | `_update` (A:729 ✓) + `moduleTransfer` N ✓; `Market.buy` fingerprint-pinned N ✓ |
| Agent: card/catalog | face 2 8004 N, `servicesHash` trait N, `/.well-known` (Manifest) | `AgentCard` N, `Catalog` N, `catalogHash` | face 2 N, `manifestHash` N |
| Agent: propose/act | `sessionAllows` ✓ view → `executeAsSession` ✓ / `executeTyped` N | `sessionAllows` ✓ → `executeAsSession` ✓ | `sessionAllows` ✓ → `executeAsSession` ✓ |
| Agent: launch | session with `minInterval ≥ 1 d`, `callsRemaining`, token `Active` ✓ | first launch `holds`; 1-day per-token limit ✓ | scoped grant, 7-day spacing, **guardian co-sign** ✓ (brief §6.12) |
| Agent: sale kills key; receiving a token grants nothing | epoch mark ✓; tested ✓ | epoch ✓; tested ✓ | epoch ✓; tested ✓ |

## 3. MUST coverage (brief §2, items 1–35)

Legend: ✓ covered; ◐ partial; ✗ missed.

| MUST | A | B | C | Note |
|---|---|---|---|---|
| 1 both 6551 accounts at mint, hash-verified | ✓ | ✓ | ✓ | |
| 2 custody epoch in `_update`, forced Paused | ✓ | ✓ | ✓ | |
| 3 fingerprint over everything, taken by every buy/fill | ✓ | ◐ | ✓ | B has no in-protocol fill in MVB; relies on SIP-15 marketplaces |
| 4 ERC-7739 on 1271; sessions never 1271; `state()` bumps | ✓ | ✓ | **✗** | C only "domain-separated"; no 7739 wrapper; `state()` not added |
| 5 6492→1271→ecrecover; no `tx.origin`/`extcodesize==0` | ✓ | ◐ | ◐ | A has `static-audit`; B/C state no rule |
| 6 op 0 only; no upgrade/module host/init/`diamondCut` | ✓ | ✓ | ✓ | |
| 7 two surfaces, one byte-stream, CSP, opaque detection | ✓ | ✓ | ✓ | |
| 8 every view ≤ 16,777,216; gzip; no global in loader | ✓ | ✓ | ✓ | A's budget wrong but gated |
| 9 EIP-170 forever; CREATE3/SSTORE2 fixed salts; one-way freeze | ✓ | ✓ | ✓ | |
| 10 gate by reading; 6963; no localStorage authority | ✓ | ✓ | ✓ | |
| 11 ERC-7432 roles + 4907 shim | ✓ (phase 2) | ✓ | **✗** | C cuts roles deliberately |
| 12 sessions: expiry, native+ERC-20 per-tx and per-period caps, allowlists | ◐ | ◐ | ◐ | none keeps a rolling per-period cap |
| 13 no capability from adversary action | ✓ | ✓ | ✓ | |
| 14 owned market, exactOut, anchored, never-pausable withdraw | ✓ | ✓ | ✓ | |
| 15 ownerless router, codehash, delta, 6551-only, limits | ✓ | ✓ | **✗** | C's Router is open to anyone |
| 16 quote by executing; owned quote beside | ✓ | ✓ | ✓ | |
| 17 launch: v4 in launch tx, immutable custodian, permissionless collect, tax, credits, price-faithful graduation | ◐ | ✓ | ◐ | A: LP to Reach, no permissionless collect, four txs; C: custodian only for the raise path, v4 post-MVB |
| 18 hooks: onlyPoolManager, foreign keys refused, bits asserted | ✓ | ✓ | ◐ | C does not state foreign-key refusal or the bits test |
| 19 agent launches only via scoped session + rate limit | ✓ | ✓ | ✓ | |
| 20 one speech predicate; logs ≤1 KB; sealed bounded storage; heads + last N in state | ◐ | ✓ | ◐ | A keeps 4 heads, sealed in logs; C keeps heads only |
| 21 one typed epoch-bound key registry with 7627 view; `expectedKeyId` | ◐ | ✓ | ✓ | A never mentions the 7627 view |
| 22 MLS for groups; ECIES first contact | ✓ (phase 3, stated) | ✓ | **✗** | C cuts to COULD |
| 23 singletons 7409, 5564/6538, EAS | ◐ | ◐ | ◐ | A: 7409+6538, no EAS; B: 7409 only; C: 7409 + a broken 6538 |
| 24 spam = token + cooldown + postage | ✓ | ✓ | ✓ | |
| 25 8004 from chain; reputation only via receipts | ✓ | ✓ | ✓ | |
| 26 hash-pinned catalogs | ✓ | ✓ | ✓ | |
| 27 escaping, textContent, CSP, artwork by router | ✓ | ✓ | ✓ | |
| 28 hash-manifest route + gateway diff in CI | ✓ | ✓ | ✓ | |
| 29 one ratchet rule | ✓ | ✓ (lib) | ✓ | |
| 30 one steward | ✓ (standing approval) | ✓ | ✓ | |
| 31 transient slot registry | ✓ | ✓ | ✓ | |
| 32 LayerZero rules | ✓ | ✓ | ✓ | |
| 33 no admin/fee/relayer on privacy paths | ✓ | ✓ | ✓ | |
| 34 immutable; no team token | ✓ | ✓ | ✓ | C adds an immutable protocol fee leg on raises |
| 35 pull money; gas-capped calls | ✓ | ✓ | ✓ | |

**Missed-MUST counts.** A: **2 clear (17, 23) + 3 partial (12, 20, 21)**. B: **1 clear (23) + 3 partial (3, 5, 12)**. C: **4 clear (4, 11, 15, 22) + 5 partial (12, 17, 18, 20, 23)**.

## 4. Special features: defensibility and buildability

*A.* All twelve are buildable. #10 (stealth) is specified correctly — the Reach calls ERC-6538 `registerKeys` as `msg.sender`, so no signature scheme is involved. #7 (`Conduit.quote` reverting `QuoteResult`) is the MASTER lens shape and works under `eth_call`. #2 "seal-as-listing" is defensible only as a convention in A because A has no listing contract; the seal is a promise the holder makes before listing elsewhere. #8 (curve-as-trait) is the most original idea in A and the only one with a hole (the renter race).

*B.* All twelve are buildable, with two caveats: #3's "the shell re-hashes itself" needs the inflated bytes (it has them) and an RPC for `/manifest` (live origin only); #9's MLS runs on the unaudited `ts-mls`, stated. The strongest defensible claims are structural rather than feature-shaped: one predicate, one epoch, one ratchet, one steward, one byte-stream. B has no stealth receive, no EAS, and no artwork/curve signal; its launch story (#8) is the most complete in any design.

*C.* Fourteen of fifteen are buildable. **#13 is not as written:** C's Reach signs only `KEEP_ATTESTATION` typed data, and ERC-6538 `registerKeysOnBehalf` verifies a signature over the registry's own EIP-712 struct, which an attestation-only `isValidSignature` will refuse by construction; the fix is A's direct `registerKeys` call. #1 (Grip) is IPSEITY's existing contract, not a differentiator of the merge. #2 (sealed markets) and #3 (`Market` listing = seal) are the genuinely new and defensible pieces: fee streams without a v4 dependency, and a listing whose floor the account enforces. #5 claims "the loader's own keccak" while §4.1 says the browser ships no keccak (it does, in the wallet library) — a wording contradiction, not a build problem.

## 5. Ranking

1. **B** (60/80) — most MUSTs covered, best authority model, the only gas and byte arithmetic consistent with the measured numbers, weakest on reuse and with the launchpad outside its MVB.
2. **A** (57/80) — best reuse and citation discipline, highest on the weighted criteria (38/50), undone by three under-budgets (tokenURI gas, Reach, Manifest) and one re-opened race.
3. **C** (56/80) — the best product and MVB shape, the most MUST misses and one unbuildable feature.

On the weighted criteria (1, 5, 6, 7, 8) the order is A 38, C 37, B 36 — which is why §9 takes A as the base and grafts B into it.

## 6. Ten ideas the winner (B) lacks

1. **Sealed markets inside the owned Pool with permissionless `collect` → `feeSink`** (C §5.1, §7): graduation liquidity becomes a market the Pool itself custodies; fees pay the Reach (or the Grip via `feesToGrip`) with no v4 dependency and no second NFT. B's streams exist only through v4 + LPCustodian.
2. **`Market`: listing is a seal** (C §8, feature #3): `list` requires `Reach.sealedUntil ≥ expiresAt`, `buy(id, agreed, fingerprint)` with balance floors, pull `owed`, `moduleTransfer`. B relies on SIP-15 marketplaces for MUST 3.
3. **The curve as an ERC-7496 trait feeding both the owned pool and the hook fee** (A §5.1, §7.2, feature #8) — one holder-set, marketplace-visible parameter for both markets; must take C's `expected` argument and be writable only by `mayActAs`.
4. **Home rooms `keccak(3, id)` + follow = `join` + `Roster.membersOf`** (A §6.1, C §6): zero-storage follow graph, reuses Roster's one-call windows; B stores a `uint16[]` per token.
5. **Stealth drop box via the Reach calling ERC-6538 `registerKeys` directly** (A §10 #10): B omits 6538 entirely.
6. **`fail`/refund path for a launch that never graduates** (C §7): B's Launchpad has `claim` after graduation and nothing for the ANIMA weakness "no cancel/refund for a launch that never graduates".
7. **Guardian co-sign for a token's first agent-initiated launch** (C §9; brief §6.12): B only requires `holds` for the first launch.
8. **`executeTyped` with `spend` caps and `receiveMin` floors** (A §8.2, from Garden `_perform`): B's sessions cap ERC-20 outflow by delta but have no receive floor; "swap exactly this for at least that" is the agent's one shape.
9. **`verify-findings.mjs` replay of every historical finding as `reproduced`/`refuted`, `static-audit.mjs`, and the `grep "(1n<<256n)-1n"` build gate** (A §12, C §13 unit 6): B's CI lacks the findings replay and the static audit.
10. **`/k/<id>/<key>` as a 301 to `/token/<id>/live?as=<key>`** (A §4.3) plus `servicesHash` as a trait (A §9): one document, one byte-stream, session mode by query; B serves a separate Agent panel.

Also worth taking: C's two-reason "not reported" chip (§4.5) and A's `Shelf`/`Releases` bounded extension point (phase 3).

## 7. Flaws and contradictions

### A
1. **tokenURI gas budget wrong by ~2×.** §3.5 cites 19.99 M for IPSEITY's 103 KB and then budgets ≤ 8 M for a document of the same gzip size (≈44 KB, §4.7). By the measured ratio the face-0 read lands at ≈16–17 M, at the EIP-7825 cap; unit 4's done-criterion will fail. The Garden percent-encode lever (risk 6) should be the design, not the fallback.
2. **Renter race on the owned pool (B2 class).** §4.4 "`USE` opens trait edits" + §5.1 `curve` trait as the pool input + `syncCurve` with no `expectedWord` ⇒ a 4907 user can move the word between `pendingCurve` and `syncCurve`. Also contradicts the hub table ("owner: traits").
3. **Steward through a standing single-token approval** (§8.6): voided silently by any later `approve()`, shown as `R_CUSTODY` for the Steward in `rightsOf`; B's `stewardTransfer`/C's `moduleTransfer` is the right shape.
4. **`Reach.state()`** is read by the fingerprint (§3.4) but IPSEITY's Reach has none and §8 does not add it.
5. **Under-budgets**: `Reach ≤ 17,000` (five grafts onto 13,461); `Manifest ≤ 22,000` from a 23,105-byte origin at 94 % that gains routes; hub `≈21,000` est. with ~3 KB of guarded satellite reads in `rightsOf` + fingerprint.
6. **MVB contradiction**: unit 10 defers MAKE/ACT to phase 2 yet its done-criterion includes "`/k` refuses a non-key wallet"; `panic()` (feature 2) is also phase 2.
7. **MUST 17**: LP minted via `Planner` to the Reach, fees collected by the holder's `execute` — not an immutable custodian with permissionless collect; the instant path is four transactions; no defence against a stranger pre-initialising the v4 key at a hostile price (B has one).
8. **Viewer RPC**: "a user-typed RPC" is not "the user's wallet's RPC and nothing else" (constraint 1); CSP `connect-src https:` permits it.
9. **`Postage.settle` pushes** to `account(to)` inside `whisper`; hooked ERC-20 fee tokens could re-enter Parley — make it pull or lock Parley.
10. Minor: `Postage` labelled NEW but is an AgentComms adapt; `/manifest` "every route → keccak" is unbounded over 4,096 ids unless restricted to templates; the ERC-7627 view is never mentioned (MUST 21).

### B
1. **MVB lacks the launchpad and the router** (units 10–11 post-MVB); the GOAL's third pillar is not in the first shippable bundle.
2. **`Kiln 14 KB` under-budgeted**: `launchInstant` now encodes `initialize`, PositionManager actions, Permit2 and `seed`; IPSEITY's planner alone is 5,928 B.
3. **`IntactMonolith` test runs** need EIP-170 lifted in the harness (unstated; Garden's rule is to keep `allowUnlimitedContractSize` false).
4. **"No `eval`" (§4.6) vs "only then evaluates it" (§4.1)**: the panel execution mechanism (script-element injection under `'unsafe-inline'`) is not named.
5. **`rpcHint` in the state gap** (§4.1) is never explained; if it is a baked RPC URL it violates constraint 1 as C does.
6. **Status `Paused` at mint** (§3.1 step 4): a fresh holder's sessions and agent door are dead until `setStatus(Active)`; no screen says so.
7. **Labelling**: `Intact` "V" but its constructor is changed (`AnimaDiamond` takes an init contract); `Engine` "V + loadPanel". §2 says IPSEITY's hub lacks traits — it has ERC-7496, which weakens the "why a diamond" arithmetic by ~2 KB.
8. **`setTokenKey` is `acts`**: a session allowed that selector can rotate the inbox key; the Reach-callable surface of the key registry should be `holds` (A binds the owner's own wallet key instead).
9. **No ERC-6538, no EAS** (MUST 23 ◐); no curve/art signal at all; `SealedRooms`' per-group manager role (`proposeManager/acceptManager` in MLSGroupChat) is unflagged in a design that says "no setter anywhere".
10. **MUST 3/5 partial**: no in-protocol fill takes the fingerprint before unit 15; no stated `tx.origin`/`code.length` rule; "no keccak in the browser" (§4.1) contradicts §4.6's wallet library.
11. **Diamond cost is real**: every satellite hot-path read of the hub pays ≈4,300–5,400 gas (ANIMA measured); CI runs the suite twice.

### C
1. **Constraint 1 violation**: the viewer reads through "a public RPC the state block names per band" — a baked external service; CSP `connect-src *`.
2. **Special feature #13 unbuildable** as written (attestation-only 1271 cannot satisfy ERC-6538 `registerKeysOnBehalf`); fix per A.
3. **No ERC-7739** (MUST 4); `Reach.state()` cited in the fingerprint but not among the five Reach changes.
4. **`Launch.create` pulls `curveSupply` from the Reach**: an EOA-signed `create` needs a standing coin approval from the Reach (an entry in C's own open-approval ledger); have the Kiln/Launch custody the supply as ANIMA does.
5. **`Router` open to anyone** (MUST 15's 6551-only rule) — budgets then live only in sessions that happen to route through the Reach.
6. **Gas budgets optimistic**: tokenURI ≤ 12 M for 45–50 KB gzip (≈15–17 M by ratio), `/live ≤ 4 M` (≈5 M); the fallback is sound.
7. **Hooks**: table #21 cites PR #36's `syncFee(expected)` while §7 says "nothing to sync"; foreign-`PoolKey` refusal and the permission-bit test are not stated (MUST 18); the LP recipient for `Planner.mintPlan` is unspecified.
8. **`creatorBps` means two things** (supply vested *and* fee share); `Inbox.send` "anyone or any actor" is ambiguous about tokenless senders.
9. **`Manifest ≤ 22,000`** has A's problem; hub ≤ 23,000 is tight (diamond fallback stated).
10. **Cuts against the brief**: ERC-7432 roles (MUST 11), MLS (MUST 22), "last N in state" (MUST 20); "no keccak in the browser" (§4.1) vs the keccak the loader computes (#5, §12); `Inbox.reply`/`Pool.collect` ERC-20 pushes without a stated lock.

## 8. Naming: KEEP

KEEP, for three reasons. It names both the invariant (custody: the holder *keeps* the exchange, the streams, the inbox) and the place (the inner stronghold — the site the token serves), while INTACT names only the guarantee. It reads as a noun and a brand ("a Keep", "Keep #7", `web3://keep.eth/token/7/live`) where INTACT does not ("an Intact"). And the repository already carries it: the working README, two of three designs, and the salts/EIP-712 domains they specify. B's word survives as the name of the guarantee in the docs — "the bundle moves intact" — which is exactly what it is good at.

## 9. Recommended base and grafts

**Base: A's skeleton (IPSEITY lineage, 30 contracts, ~18 MVB) on IPSEITY's toolchain, which the repository already contains.** Reason: the 22 verifiers and 149 tests are the specification of Pool, Reach, Parley, Premises and the engine, and they port only if the ABIs survive; A keeps them, B's merged-origin contracts do not. B's strengths are predicates, libraries and three contracts, which graft cleanly onto A; A's strength (proven ABIs) cannot be grafted onto B.

**Grafts from B (authority and arithmetic):**
1. `Rights.sol` bit constants with `acts`/`holds` helpers used by every satellite; `rightsOf` stays in the hub.
2. `Ratchet.raise(current, proposed, cap)` and `Transient` libraries with their registry tests; one word in the UI ("sealed until").
3. `stewardTransfer`/`moduleTransfer` hub entry pinned to `STEWARD` — replaces A's standing approval; B's `Steward` ABI (`attest`, `stillHereUnderDuress`, `getWill/getObit`).
4. `totalReserved[token]` solvency guard in `Pool` — delete `bless`/`setAllowlistEnforced`/`setPaused` (C5 guarded, not monitored).
5. `whisper(…, expectedKeyId)` pinned on chain; keep A's `bindKey` (binds the owner's wallet key, closing B's `setTokenKey` footgun).
6. `Reach.revokeAllSessions()` + `sealMax()` callable by hub (`panic`) and guardian; add `state()` explicitly.
7. Launch unit in B's shape: `LPCustodian` with permissionless `collect` → `account(id)`, credits until graduation, per-launch isolation, pre-initialised-pool price check within 1 % + `resalt`, both prices emitted; `Launchpad` custodies the supply (no Reach approval).
8. `tokenURI` as a hash-pinned shell with lazy panels **or** Garden's single-base64 envelope — decide by measurement at unit 4 before `freeze()`; the budget must be derived from the 192 gas/byte ratio, not asserted.
9. Split `Manifest` into `Catalog` (selectors, `services.json`, known delegates) and `AgentCard` (8004/A2A/llms.txt) — two contracts under the ceiling.
10. `tools/facets.mjs` (ported `deriveFacetCut`) at unit 1 so the diamond fallback for the hub is a flag, not a rewrite; monolith first.

**Grafts from C (product and MVB):**
11. Sealed markets in `Pool` (`openSealed`, `collect`, `feeSink`/`feesToGrip`) so the raise graduates into the token's own market with no v4 dependency.
12. `Market` contract (listing = seal, fingerprint + floors, pull `owed`) — post-MVB, and A's "seal-as-listing" becomes a mechanism.
13. `syncCurve(id, expectedWord)` / `setShape(id, bps, expected)`; the `curve` trait writable by `mayActAs` only, never `R_USE`.
14. Follow = `join(homeKey(target))` + `Roster.membersOf`; home rooms derived.
15. MVB = all four lanes with screens (C units 1–8), agent door next; `fail`/refund on the raise; guardian co-sign for the first agent launch; `grep "(1n<<256n)-1n"` and `invariants-check` CI gates; the two-reason "not reported" chip.

**Drop from A:** the user-typed RPC in the `data:` viewer (viewer = baked state + "open live" + QR, per B; a labelled RPC field only on the live origin); `R_USE` trait edits; the standing-approval steward; the ≤8 M/≤5 M gas done-criteria.

**Keep from A unchanged:** `Conduit` (Reach-only, quote-by-revert, venue manifest), separate `Postage` (one SLOAD per whisper), `KeyRegistry` verbatim + `bindKey`, stealth via direct `registerKeys`, `executeTyped` with `receiveMin`, `/k` as a 301 into session mode, `servicesHash` trait, `verify-findings`/`static-audit`, the Timelock-fronted and then sealed curator, bands and CREATE3 as specified.
