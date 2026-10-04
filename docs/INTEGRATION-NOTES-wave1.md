# Wave-1 integration notes (collected from unit reports)

## U5 — Locks, Steward, Timelock (unit/U5, 9ccceb2)
- Sizes: Steward 8,748 (≤9,000), Locks 5,404 (≤7,000), Timelock 1,634 (donor 1,675 measured with CBOR metadata; ours uses bytecodeHash none — identical body).
- Tests: 15 new + U0's 5 = 20 passing; verify-timelock 34, verify-steward 87 assertions.
- Both suites and verifiers use test/mocks/MockHubForVault.sol in place of the hub. After U1 lands, re-point verify-timelock.mjs and verify-steward.mjs at the real hub (artifact + constructor args), keep the walk.
- Decision recorded, not made: Timelock.execute is onlyAdmin (donor verbatim, BUILD-PLAN) vs DESIGN §3 row 27 "anyone executes". DECISION: anyone executes (DESIGN wins; a stranger executing a ripe operation is harmless and removes a liveness dependency). Change the one word, update verify-timelock's assertion and the Timelock size record.
- ISteward.summon(id, heir, salt) has no tokenN parameter; implemented instrument heirs as heir = address(uint160(tokenN)) with both preimage shapes tried. Acceptable for MVB; log in docs/INTERFACE-CHANGES.md as a known wart; v2 may add summonToken.
- ISteward has no revoke(); a holder erases a plan only by re-arranging. Log as v2.

## U6 — Kiln, Coin, Launchpad (unit/U6, 09469c8)
- Sizes: Launchpad 15,983 (≤17,500), Kiln 9,904 (≤14,500), Coin 3,145 (≤6,000), Gate 967.
- Tests: 34 new (1 fuzz) → 39 passing with U0; verify-launch 123 assertions; Kiln.mine over 60,000 salts = 2,066,915 gas.
- Seam: Kiln.launch calls Launchpad.recordLaunch(id, by, coin, raiseShare) through a local ILaunchClock in src/Kiln.sol. Add recordLaunch to ILaunchpad (additive) in the integration pass.
- Local errors not in the interface: Launchpad NotEnoughCredit(uint256,uint256), Insolvent(), NotKiln(); Kiln BadDecimals() (MAX_DECIMALS 36). Add to the interface events/errors files (additive).
- ILaunchpad.Launch lacks graduationTarget → public mapping graduationTargetOf(launchId). Fine.
- Assumptions to verify against U3/U5: IPool.openSealed pulls amountBase from msg.sender by transferFrom (Launchpad approves exactly, zeroes, re-measures delta); ILocks.lock pulls ERC-20 by transferFrom from msg.sender.
- test/mocks/LaunchFixtures.sol (LaunchHub, LaunchPool, LaunchLocks, LaunchWiring) stands in for hub, Pool, Locks. After merge, wire verify-launch to the real Pool/Locks/hub where the ABIs match and keep the fixtures for the isolated tests.
- Target.UniswapV4 reverts NotYet (U14). docs/INVARIANTS.md rows D1–D5 not written (U12 owns the file).

## U3 — Pool, Curve (unit/U3, a32f251)
- Pool 12,606 B (≤17,000). 47 tests (36 Pool incl. 8 fuzz, 6 PoolReenter, U0's 5); verify-pool 144 assertions; fuzz.mjs 9 properties.
- Fixture test/mocks/PoolFixtures.sol (PoolHub stand-in, CurveProbe). Re-run against the real Intact in integration/U12.
- openSealed requires quote == address(0) (native raise only; frozen signature has no ERC-20 amount). Launchpad (U6) must call openSealed with native value: check U6's assumption ("openSealed pulls amountBase by transferFrom; quote native via msg.value") — consistent: base pulled by transferFrom, quote = msg.value.
- Sniper window kept in a side mapping (frozen struct carries only sniperUntil).
- Harness artifacts: ethereumjs zeroes gas-refund counter on child revert (REFUND_EXHAUSTED); vm.store not implemented.
- docs/INVARIANTS.md rows C1/C2/C3/C5 updated (file also touched by U4 → merge conflict likely; resolve by union).

## U4 — Parley, Postage, Roster, KeyRegistry (unit/U4, bf90697)
- Parley 9,955 (≤10,000), Postage 6,088 (≤8,500), Roster 3,196 (DESIGN said 3,267±50: update the number), KeyRegistry 1,941 (≤2,500). 65 tests; verify-parley 81 assertions.
- Fixture test/mocks/SocialHub.sol (+ SocialDeploy predicting Parley's CREATE address before Postage). Re-point at the real hub once test/helpers/Deploy.sol lands.
- Errors beyond the interface: Parley PostageDue(uint256,uint128), BadReply(); also reverts IPostageEvents.InboxClosed. Add to IParleyEvents (additive) so Catalog's err table sees them.
- heads(uint256[]) returns head BLOCK per room (not counts) — U9 must call stateOf for counts.
- Postage payer of record = HUB.account(from); no payer parameter (wallet-pays model unsupported) — accepted for MVB.
- Home rooms cannot be followed before the steward's first act (join reverts NoSuchRoom) — page copy: "this token has not spoken yet".
- The 16-mutation gate was interrupted; INVARIANTS rows E1/E3 say so; U12 reruns (script at scratchpad/u4-mutate.sh in the U4 worktree?).
- docs/INVARIANTS.md touched by U3 and U4 (merge by union).

## U2 — Reach, Grip (unit/U2)
- Reach 20,821 B (budget 19,000 missed by 1,821; under the 21,000 valve so no SessionPolicy split), Grip 1,937 B. 41 tests; verify-vault 168 assertions. Storage layout hash in docs/ACCOUNTS.md.
- Suites run against test/mocks/AccountsHub.sol; re-point at src/hub once U1 lands (one-fixture change).
- Additive ABI beyond IReach: error HubUnreadable(); legacy isValidSignature(bytes,bytes) overload (Safe 1.3/1.4 shape). IGrip isValidSignature returns 0xffffffff per interface (donor returned 0).
- docs/INVARIANTS.md rows B1–B6, H2 still read "pending U2" — flip them in integration (assertion strings exist).
- Reach size: DESIGN budget 19,000 vs measured 20,821 — DECISION: accept 20,821 (valve met), record the measured number in DESIGN §3 and docs/ACCOUNTS.md; revisit only if the ship size matters (it is not the hub).

## U1 — hub (unit/U1)
- Monolith Intact 25,312 B (> 24,000 threshold and > EIP-170) → the DIAMOND SHIPS (out/ship.json). Facets: CoreFacet 12,785 (≤13,000), SiteFacet 8,789 (≤10,000), MintFacet 5,368 (≤6,000), RightsFacet 5,034 (≤8,000), IntactDiamond 2,004 (≤2,500). 42 tests both builds; mint 284,915 gas; diamond overhead ≤ +525 gas.
- SEMANTIC REQUIREMENT ON U2: IReach.sealMax() must be idempotent at the cap (hub panic calls sealMax() then revokeAllSessions() unconditionally; a second panic must not revert with RatchetOnly). Verify Reach.sealMax; fix if it ratchets strictly.
- IIntact claims IERC5169 but lacks setScriptURI: add `setScriptURI(string[])` that reverts NotTimelock/NotAuthorized (tiny) so the interface id is honest, if SiteFacet budget allows (8,789 ≤ 10,000).
- R_ROLE is computed from hasRole(id, USER, actor) only (IRoles has no any-role view) — acceptable for MVB (U16 later).
- Constructors: Intact(IntactConfig c, uint256 initialPrice); IntactDiamond(IDiamond.FacetCut[] cuts, uint256 initialPrice); IntactConfig has 16 fields (reachImpl, gripImpl, band, bandLo, bandHi, steward, market, roles, pool, parley, launchpad, locks, renderer, catalog, premises, timelock). REGISTRY + salts are AccountBinding constants. U10 must use these.
- Panic keeps the guardian (not in DESIGN §2's list) — document in DESIGN.
- Residual: an Intact sent to the UNDEPLOYED canonical account of an unminted id is not classifiable; documented in IntactBase._isCanonicalRecipient.
- ERC-7774 ClearPathCache not emitted on setUser/setStatus/pause (budget) — document.
- test/helpers/HubMocks.sol extra; docs/INVARIANTS.md rows A1–A10 pending (U12).
- Integration: re-point U2/U3/U4/U5/U6 fixtures (AccountsHub, PoolFixtures.PoolHub, SocialHub, MockHubForVault, LaunchFixtures.LaunchHub) to the real hub via test/helpers/Deploy.sol where feasible; keep unit fixtures for isolated tests; make tools/verify-*.mjs deploy the real hub (diamond build).
