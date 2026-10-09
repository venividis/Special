# Invariants

Statements that must hold in every reachable state. Each names the test
that tries to break it. If any of these can be made false, that is a bug
regardless of what else passes.

The form is IPSEITY's, which borrowed it from the Dave Held core: an
invariant written down is a claim that can be attacked, where a feature
list is only a claim that something happened. The numbering is DESIGN.md
§14's (A1 … H3), so a security-checklist row and its invariant are the
same line; `tools/invariants-check.mjs` (U12) asserts that every row below
names an assertion string that exists in the named file.

Discipline: a row is **live** only once its test runs in `npm run check`
and has been seen to fail under a one-character mutation. Until then it is
**pending** and names the unit that owns it. Counts and gas numbers are
written here only after a run.

The wave-1 integration flipped the unit rows below on two things: the
units' own mutation evidence, recorded in their commit bodies, and the
integrated runs (237 tests on each build; verify-vault 168, verify-parley
81, verify-launch 123, verify-steward 91, verify-timelock 35 against the
real hub; verify-pool 144 on its stand-in). The `test/Bundle.t.sol`
citations it added beside them are further evidence, not yet mutation-
gated — that gate, with E1/E3's, is U12's.

---

## 0. The foundation (wave 0 — live)

**0.1 Every time promise only lengthens, never names the past, and never
outlives the cap.** The Reach seal, the market seal, the transfer seal
(365 d) and every lock (10 y) move only through `Ratchet.raise`.
→ `test/Ratchet.t.sol` · `test_everyRatchetOnlyLengthens`,
  `testFuzz_everyRatchetOnlyLengthens`, `test_aRatchetRefusesThePastAndTheCap`

**0.2 Every transient slot is registered, derived by one formula, single-
purpose, and clear after every exit including a revert.**
→ `test/Transient.t.sol` · `test_everySlotIsRegisteredAndClearedOnRevert`,
  `test_twoPurposesNeverShareASlot`

**0.3 The diamond's cut is derived, never written: an unrouted, duplicate
or extra selector refuses to produce a cut, and no cut routes `diamondCut`.**
→ `tools/facets.mjs --selftest` · *"refuses an unrouted selector"*,
  *"refuses a duplicate"*, *"refuses an extra"*, *"refuses a cut that routes diamondCut"*

**0.4 No `tx.origin`, `selfdestruct`, Solidity-level `delegatecall`, raw
`sstore`, EOA-only idiom, string revert or external import exists under
`src/`; no `eval`, `new Function`, `(1n<<256n)-1n` or `innerHTML` under
`engine/`, `sdk/` or `tools/`.**
→ `tools/static-audit.mjs` (build-failing), `--selftest` proves the scan
  fails on a fixture containing `tx.origin`

**0.5 Every view is under its cap: `tokenURI` ≤ 8,000,000, `/live` ≤
2,500,000, panels ≤ 1,000,000, `/manifest` ≤ 3,000,000, every other view
≤ 16,777,216, nothing ≥ 50,000,000.**
→ `tools/gas.mjs` (build-failing), `--selftest` proves a fixture view over
  2^24 fails the gate

**0.6 Every deployable fits EIP-170 on every band; the monolith is
measured against the 24,000-byte ship rule rather than gated.**
→ `tools/compile.mjs` size gate; `--ship` prints the decision

**0.7 No transaction the harness sends uses more than 2^24 gas (EIP-7825).**
→ `tools/evm.mjs` `send` assertion; `tools/rpc.mjs` refuses an estimate over the cap

**0.8 The runner runs: a three-byte REVERT probe burns gas and reverts
before any suite is reported on.**
→ `tools/forge.mjs` · *"the runner is not running anything"* self-check

---

## A. The hub

| # | Invariant | Enforced by | Status |
|---|---|---|---|
| A1 | `_update` bumps `custodyEpoch`, clears approval/user/guardian/wallet/face/feesToGrip, forces `Paused`; no seller authority survives | `test/Update.t.sol` · `test_sellingTheTokenRevokesEverySellerAuthority`, `test_selfTransferBumpsTheEpochAndRevivesNothing`, `test_buyBackRevivesNoSession`; `test/Bundle.t.sol` · `test_sellingTheTokenSellsTheMarketTheVoiceTheLaunchFeesAndKillsEverySession`, `test_aBuyBackRevivesNothingAnywhere` | live (U1, integration: both builds; the Bundle rows run the real Reach, Pool, Parley, Postage, Steward and Launchpad against the real hub) |
| A2 | Locked tokens cannot transfer; only pinned modules lock; `moduleUnlock` at zero reverts | `test/Update.t.sol` · `test_aLockedTokenCannotMove`, `test_onlyPinnedModulesMayLock`, `test_unlockingAtZeroReverts`; `test/Bundle.t.sol` · `test_theStewardMovesTheWholeBundle` (the real Steward's lock) | live (U1, integration) |
| A3 | `isApprovedForAll` reads the epoch store; `revokeAllApprovals` is O(1); timed approvals expire | `test/Approvals.t.sol` · `test_revokeAllApprovalsIsOneWrite`, `test_aTimedApprovalExpires` | live (U1) |
| A4 | `Core` is append-only; the fingerprint moves for every field | `test/Fingerprint.t.sol` · `test_everyFieldMovesTheFingerprint`; `test/Bundle.t.sol` · `test_theHolderOpensAMarketSpeaksAndLaunchesFromOneToken` (the market, the Reach's ledger and the launch each move it, read from the real satellites) | live (U1, integration) |
| A5 | Canonical-account transfer refusal; no nesting, no strand, no cycle at any depth | `test/Update.t.sol` · `test_noIntactCanEnterAnyIntactsAccounts`, `test_aGripNeverStrandsAnIntact`, `test_sellingJLeavesKNoSellerSession` | live (U1) |
| A6 | Mint: counters before the callback, band bounds, no `block.*` | `test/Mint.t.sol` · `test_aReentrantMinterSeesACompleteToken`, `test_theBandIsExhaustedNotWrapped`; `tools/static-audit.mjs` | live (U1) |
| A7 | No `tx.origin`, `extcodesize == 0`, EOA-only; a 7702-delegated holder works | `tools/static-audit.mjs` (live); `test/Rights.t.sol` · `test_aDelegatedHolderStillHolds` | live (U1) |
| A8 | No initializer/proxy/`diamondCut`/routing owner; cut strict; config hash equal; slots 0–2 empty | `test/Diamond.t.sol` · `test_partitionsTheMonolithAbiEveryFunctionRoutedOnce`, `test_routesNoDiamondCutAnywhere`, `test_slotsZeroToTwoAreEmpty`, `test_refusesAFacetBuiltAgainstAnotherConfiguration`; `tools/facets.mjs` (live) | live (U1; `allSelectors` is 93 since `setScriptURI`) |
| A9 | Every contract ≤ 24,576 on every band; ship rule applied | `tools/compile.mjs` (live); `tools/recover-record.mjs` · *"shipBuild.build"* (the record's build against the hub's actual form: `facetAddresses()` answers → diamond, reverts → monolith; each facet's codehash and selector set; `facetAddress(diamondCut)` is zero); `tools/verify-recover.mjs` · *"the record names which build shipped and why"*, *"a wrong ship build"* | live (U10): the size gate (Intact 25,402 B → the diamond ships, `out/ship.json`) and the record check (verify-recover 130 assertions; `deployments/31337.json` recovered with 0 disagreeing) |
| A10 | Guardian panic never revokes the owner's operators on other tokens; holder panic may | `test/Panic.t.sol` · `test_guardianPanicLeavesOtherTokensOperatorsAlone`, `test_holderPanicKillsEveryDelegatedRight`; `test/Bundle.t.sol` · `test_panicRevokesAcrossEverySatellite`; `test/Reach.t.sol` · `test_aSecondPanicDoesNotRevertOnTheSeal` | live (U1, integration) |

## B. The accounts

| # | Invariant | Enforced by | Status |
|---|---|---|---|
| B1 | Grip: every selector enumerated, none moves an asset; `0x51945447` not advertised; `state()==0` | `tools/verify-vault.mjs` · *"the Grip's ABI has no selector that moves an asset"* | live (U2; verify-vault runs against the real hub since the integration) |
| B2 | Reach `execute` op 0 only; no delegatecall path | `test/Reach.t.sol` · `test_operationOneIsRefused`; `tools/static-audit.mjs` | live (U2) |
| B3 | ERC-7739: `0x7739…` → `0x77390001`; session keys → `0xffffffff`; passes as a Safe ≥ 1.4.1 owner | `test/Reach7739.t.sol` · `test_attestationVerifiesAsASafeOwnerWithoutReplay`, `test_aSessionKeyNeverSigns` | live (U2) |
| B4 | Seal ratchets only ≤ 365 d, survives sale, measurement-enforced, approval family refused | `tools/verify-vault.mjs` · *"a drainer with a function name no list has still Shrank"*; `test/Ratchet.t.sol` · `test_everyRatchetOnlyLengthens` (live); `test/Bundle.t.sol` · `test_sellingTheTokenSellsTheMarketTheVoiceTheLaunchFeesAndKillsEverySession` (the seal survives the sale) | live (U2, integration) |
| B5 | Sessions epoch-stamped, `Active` required, no self-call, no sub-grant, ERC-20 delta caps, receive floors | `test/Sessions.t.sol` · `test_aSessionDiesOnSale`, `test_aPausedTokenFreezesItsKeys`, `test_aSessionCannotGrantASession`, `test_anErc20CapIsMeasuredByDelta`, `test_executeTypedRefusesAShortfall`; `test/Bundle.t.sol` · `test_aBuyBackRevivesNothingAnywhere` | live (U2, integration) |
| B6 | Open-approval ledger records every approval shape; a foreign revert never blocks revoke | `test/Ledger.t.sol` · `test_permit2ApproveIsRecorded`, `test_aRevertingAssetDoesNotBlockRevokeAll` | live (U2) |
| B7 | Steward: `stewardTransfer` only; void on transfer; ≥ 2 guardians; one count per guardian per nonce; a stranger is not life | `test/Steward.t.sol` · `test_aStrangerCannotResetSilence`, `test_aPlanIsVoidAfterSale`, `test_oneGuardianCannotRecoverAlone`, `test_anHeirWaitsOutASeal`; `tools/verify-steward.mjs` (91 assertions, against the real hub); `test/Bundle.t.sol` · `test_theStewardMovesTheWholeBundle` | live (U5, integration) |

## C. The market

| # | Invariant | Enforced by | Status |
|---|---|---|---|
| C1 | Curve anchors only on liquidity/curve change; never a live read in `swap`; a round trip never profits in either direction, through exact-out, over native legs and at dust | `test/Pool.t.sol` · `testFuzz_roundTripNeverProfits`, `testFuzz_invariantNeverFalls`, `testFuzz_exactOutIsTheInverseOfExactIn`; `tools/fuzz.mjs` · *"a round trip never profits, at any concentration, at any size, in either direction"*, *"buying and selling straight back never comes out ahead"*; `tools/verify-pool.mjs` · *"a trade moves along the curve and never moves the curve"*, *"k never decreased across 200 random trades"* | live (U3: 47 tests, 144 verifier assertions, 9 properties at 0/1/2/9 wei and 2^64/2^112; every mutation in the commit body failed the named test) |
| C2 | C1/C2/C5 regressions: one lock on every door, reads before the pull, no phantom reserve, no market paid with another's reserves, fail closed on a downward rebase until `writeDown` | `test/PoolReenter.t.sol` · `test_aMarketCannotBeReopenedOverAPhantomReserve`, `test_aSyncInsideThePullReverts`, `test_theOneLockHoldsEveryDoor`, `test_aMarketCannotPayWithAnotherMarketsReserves`, `test_aDownwardRebaseFailsClosedUntilWriteDown`, `test_aNativeMarketNeverPaysAnotherMarketsEther`; `tools/verify-pool.mjs` · *"C1: closeMarket re-entered from inside deposit's pull is refused"*, *"C2: a sync from inside the pull, by the token that IS the Reach, is refused"*, *"no market pays with another market's reserves"* | live (U3) |
| C3 | Seal never shortens and survives the sale; `withdraw` never pausable; no admin selector exists; the sniper fee is armed only at open | `tools/verify-pool.mjs` · *"no selector on Pool names an admin"*, *"the state-changing surface is exactly the twelve DESIGN.md names"*; `test/Pool.t.sol` · `test_withdrawCannotBePaused`, `testFuzz_sealOnlyRatchets`, `test_sealSurvivesTheSaleAndBindsTheBuyer`, `test_theSniperFeeCannotBeReArmedByADeposit` | live (U3) |
| C4 | Router: Reach-only, `extcodehash` pinned, exact-then-zero, delta `minOut`, no standing allowance | `test/Router.t.sol` · `test_anEoaCannotUseTheRouter`, `test_anUpgradedVenueFailsClosed`, `test_anUnderDeliveringVenueIsCaught`, `test_noAllowanceSurvivesACall` | live (U8) |
| C5 | `syncCurve(expected)` refuses a moved curve; `curve` trait is `holds`-only; every holder operation is `acts` (holder or Reach, never a renter); sealed markets never withdraw principal and `collect` conserves value to `feeSink` | `test/Pool.t.sol` · `test_aMovedCurveRefusesTheSync`, `test_theReachMayDepositIntoItsOwnMarket`, `test_aSealedMarketNeverWithdrawsPrincipal`, `test_collectConservesValue`, `test_collectPaysTheGripWhenTheBitIsSet`; `test/Rights.t.sol` · `test_aRenterCannotSetATrait`; `test/Bundle.t.sol` · `test_aGraduationOpensASealedMarketWhoseCollectPaysTheReach` (the real Launchpad's graduation into the real Pool, `collect` paid to the real `feeSink`) | live (U3, U1, integration) |

## D. The launchpad

| # | Invariant | Enforced by | Status |
|---|---|---|---|
| D1 | No withdraw/pause over curve funds; `graduate` permissionless and locked | `test/Launchpad.t.sol` · `test_nobodyCanWithdrawCurveFunds`, `test_anyoneMayGraduate`; `test/Bundle.t.sol` · `test_aGraduationOpensASealedMarketWhoseCollectPaysTheReach` | live (U6, integration) |
| D2 | Pre-existing pool price within 1 % or revert/resalt; both prices emitted | `tools/verify-launch.mjs` · *"a pre-initialised pool at the wrong price is refused"* | pending U14 |
| D3 | Credits never move ERC-20 pre-graduation; `fail` refunds exact | `test/Launchpad.t.sol` · `test_noTokenMovesBeforeGraduation`, `test_aFailedRaiseRefundsEveryWei` | live (U6) |
| D4 | Snipe tax decays, no exemptions, clamp; fees immutable per launch ≤ 1.25 % | `test/Launchpad.t.sol` · `test_theTaxHasNoExemptionList`, `test_aPayoutNeverExceedsOneHundredPercent`, `test_feeTermsCannotChangeMidLaunch` | live (U6) |
| D5 | First launch `holds` or guardian co-sign; 7-day spacing; session launch needs the scope | `test/Launchpad.t.sol` · `test_anAgentsFirstLaunchNeedsTheGuardian`, `test_launchesAreSevenDaysApart`; `tools/verify-launch.mjs` (against the real hub) | live (U6, integration) |
| D6 | Hooks: `onlyPoolManager` on every entry, foreign `PoolKey` refused, bits asserted | `tools/verify-launch.mjs` · *"every hook entry refuses a caller that is not the manager"*, *"`getHookPermissions` equals the address bits"* | pending U14 |

## E. Speech

| # | Invariant | Enforced by | Status |
|---|---|---|---|
| E1 | `mayActAs` on every Parley write; a renter cannot speak; keys/cooldowns epoch-keyed | `test/Parley.t.sol` · `test_aRenterCannotSpeak`, `test_aBuyerIsNotRateLimitedByTheSeller`, `test_aSoldTokenHasNoKey` | live (U4, integration: `test/Bundle.t.sol` · `test_sellingTheTokenSellsTheMarketTheVoiceTheLaunchFeesAndKillsEverySession` adds the real hub; the (token, epoch) bucket mutation was seen to fail; the full 16-mutation gate was interrupted in U4, its script did not survive the worktree, and it is still owed by U12) |
| E2 | Body caps; single-block walks; heads ring | `tools/verify-parley.mjs` · *"the second walker reads 405 blocks of history in 3 single-block queries"*; `test/Parley.t.sol` · `test_theRingShiftsOnANewBlockAndNotWithinOne`, `test_aSealedBodyMayBeFourTimesLonger` | live (U4) |
| E3 | `expectedKeyId` pinned; postage one-of-settled/refunded; pull settlement | `test/Parley.t.sol` · `test_aRotatedKeyRefusesTheWhisper`; `test/Postage.t.sol` · `test_exactlyOneOfSettledOrRefunded`, `test_aHookedFeeTokenCannotReenterParley`, `test_settlementIsPulledNotPushed` | live (U4, integration: verify-parley runs against the real hub; mutation gate pending, see E1) |

## F. The site

| # | Invariant | Enforced by | Status |
|---|---|---|---|
| F1 | `tokenURI` bytes equal `/live`; `resolveMode()` never removed; artwork by the router | `tools/verify.mjs` · *"the two surfaces are one byte-stream: animation_url's bytes equal /token/<id>/live's body"*, *"the document that comes back is byte-for-byte the shell that went in"*, *"/token/<id>/hash: document is the keccak of the live body"*, *"the inner base64 is canonical: re-encoding the decoded document reproduces the chain's string byte for byte"*; `tools/verify-premises.mjs` · *"artwork is served by the router: the body is Renderer.document(id) byte for byte"*, *"it holds none of the artwork's bytes"*, *"resolveMode() is \"5219\""*, *"there is no state-changing function at all"*; `test/Premises.t.sol` · `test_theTwoSurfacesAreOneByteStream`, `test_resolveModeIs5219` | live (U7: 14 tests on each build; verify 217, verify-premises 63 assertions, against the placeholder shell until U9, against the real shell since — verify 234, verify-premises 63 on this tree) |
| F2 | Every view under its cap; `tokenURI` ≤ 8 M; `/live` ≤ 2.5 M; panels ≤ 1 M; `/manifest` ≤ 3 M; faces/crest ≤ 0.5 M; state and the JSON directories ≤ 1 M; every probe measured COLD | `tools/gas.mjs` (build-failing; every DESIGN §5.3 route probed with its row's cap, 79 probes, a one-wei transaction between every two so each is the first call after one — the number a node bills); `tools/build-app.mjs` (`SHELL_GZIP_CEILING` 15,000, build-failing); `tools/verify.mjs` · *"tokenURI reads for under 8.00M gas — the build-failing cap"*, *"/live reads for under 2.50M gas"*, *"/manifest reads for under 3.00M gas"*; `tools/verify-site.mjs` (prints the shell's gzip beside the cold `tokenURI` and `/hash` gas on every run; fails the run when the shell is over the ceiling) | live (U7; U9 shell after its fix round and the review of it, cold, through `verify-site` and `gas.mjs` on this tree: shell 14,955 B gzip (14,976 before the fix round, 14,932 after it, +23 B for the review's three fixes), tokenURI 7.64 M of 8 M, /token/1/live 1.74 M, /token/1/hash 2.42 M of 2.5 M, 79 probes cold and every view under its cap. The ceiling is derived from the caps: measured on two shells — the 3,015 B placeholder at 4.34 M / 1.62 M and the 14,976 B shell at 7.64 M / 2.43 M — the slopes are ≈ 276 gas per gzip byte for tokenURI and ≈ 68 for /hash, so /hash crosses its 2.5 M cap at ≈ 16,000 B and tokenURI its 8 M at ≈ 16,300 B; 15,000 leaves ≈ 1,000 B of margin to the first cap. The 14,000 budget line is retired; the ceiling is the gate, and the shell stands 45 B under it) |
| F3 | Loader declares nothing global; no eval/`new Function`/external `src`/unlimited approval; panels hash-checked before injection; the loader keeps the inflated bytes on `INTACT.$doc` so the shell can hash itself; the shell's ERC-6551 derivation equals the contract's | `tools/build-app.mjs` (build-failing: `refuse`, `checkLoader`); `tools/verify.mjs` · *"and declares nothing at all in global scope"*, *"the loader hands the payload over on a property, not a global binding"*, *"the loader keeps the inflated bytes on INTACT.$doc for the shell to hash, immediately before document.open()"*, *"/panel/swap.js: 200, gzip, ETag = keccak of the inflated bytes = the state's pin"* (one row per panel); `test/Premises.t.sol` · `test_aPanelIsServedGzipWithItsHashAsETag`; `test/Binding.t.sol` · `test_theShellsSixFiveFiveOneDerivationIsTheContracts` (token 7, chain 1, zero implementation, collection `0x1234567890AbcdEF1234567890aBcdef12345678` → Reach `0x6aFB0ef97eB85b6742326c7372421a166C5dac1a`, Grip `0xc4392998811A83E714e2E443D5C1f3EC72C55E0A`), `test_theSaltsAreTheKeccaksTheShellHardcodes`; `tools/selftest.mjs` · *"the Reach of token 7 on chain 1 with a zero implementation"* (the same number from the shell's JavaScript; prints the chain half's byte count and keccak — recorded here when the shell lands); `tools/verify-site.mjs --group boot` · *"a tampered panel is refused"* (the inflated bytes' keccak against `INTACT.panels` in the DOM, a one-byte change appends nothing), *"the loader left the inflated bytes on the state object"*, *"the payload property was deleted"*, *"the shim reproduces the collision the loader rule guards against"*, *"a corrupted payload fails in words, not silence"*, *"no panel can reach a provider"*, *"an unlimited approve hidden in a Reach call is still refused"* | live (U7 build gates; U9: the DOM half runs in `npm run check` through `verify:site`; the chain half measures 12,145 B, keccak 0x35000df5286898c97cc976ab4d104fe8ed13d25b80fb090a098d6236b4617352, and the selftest's Reach/Grip vectors equal `test/Binding.t.sol`'s; the five fixture panels are hash-checked exactly as the real ones will be) |
| F4 | Escaping everywhere; `textContent` only; CSP meta present; no RPC string in any document | `test/Premises.t.sol` · `test_aCoinNamedScriptTagCannotEndTheStateBlock`; `tools/verify.mjs` · *"the raw bytes of the document carry no </script> inside the state block"*, *"the document begins with the prologue and its CSP"*, *"no RPC string, no host of any kind, in the served document: the only network path is the origin that served it"*; `tools/verify-site.mjs --group boot` · *"the name trait is text on Home"* (a coin named `</script>x` reaches the DOM as text with no child element), *"the state block still parses with all of it inside"*, *"innerHTML was never assigned"*, *"nothing was assigned through innerHTML, by anybody, all run — and no script threw (end of the boot group)"* (the shim's `innerHTML`/`outerHTML`/`insertAdjacentHTML` setters count and throw), *"no RPC string, no host of any kind"* is `verify.mjs`'s and `build-app`'s host scan is build-failing | live for the shell (U9); each lane panel's group adds its own escaping block when the panel lands |
| F5 | Viewer never asks to sign; picker never auto-selects; rights recomputed on account/chain change | `tools/verify-site.mjs --group boot` · *"the opaque origin boots the viewer and never offers connect"* (no `#connect`, no `[data-go]`, zero prompts after every button and lane), *"a viewer wallet on another chain reads nothing, and is offered no move"*, *"two wallets, a picker, no choice made for you"*, *"a late wallet joins, and the gesture asks"*, *"the wrong chain is refused before any read, and offers the move"*, *"chainChanged recomputes"*, *"accountsChanged recomputes"*, *"no wallet in this browser: Home says so and offers nothing"*, *"a dismissed picker chooses nothing, and the gesture asks again"*, *"a click inside the picker does not spend the dismissal"*, *"clicking your own address drops the wallet into the dismissed state, and a read while the picker is open is refused with the §2 sentence"*, *"after drop-then-dismiss the page is in the dismissed state, and no eth_call reached the dropped wallet"*, *"the picker answered after a drop connects the chosen wallet, and the dropped one is still never asked"*, *"with one announcer, clicking your own address asks that wallet again and stays connected"*, *"with one announcer the page is disconnected while the wallet is asked again, and a decline leaves it so"*, *"a wallet the page dropped moves nothing: its chainChanged and accountsChanged neither move the gate nor cause a read"*, *"a failed eth_chainId is not chain 0: the crest says the chain is unreachable, reads nothing, and offers the move"*, *"a read parked between chainChanged and the re-read is refused by the gate, not answered by the new chain"*, *"only the latest rights read writes the body: an older read landing later is thrown away"*, *"a stale rights read is thrown away whether it answers or rejects, and an answer landing on a wrong chain writes nothing"*, *"a successful #switch refreshes every read once"*; `tools/verify-console.mjs` · *"the opaque origin shows the viewer and never a wallet prompt"* (Chromium, U11) | live through the shim (U9, in `npm run check`: the boot group runs 137 sentences on this tree — 125 at the checkpoint, nine from the shell's fix round, three from the review of it, each reproduced through the shim before its fix; the shim's own rules hold alongside — *"the shim cannot click what a person cannot see: a hidden #connect dispatches nothing"*, and the two overtaking sentences hold the holder's `rightsOf` outside the shim's one-at-a-time queue, since the queue cannot stage a real provider's reordering); the same sentences in a real browser are U11's |
| F6 | Optional dependencies degrade; "zero" ≠ "no answer" ≠ "not deployed"; hash-manifest and gateway diff; the catalog cannot drift from the ABIs | `test/Premises.t.sol` · `test_anAbsentSatelliteSetsTheReportedBitClear`, `test_manifestHashesRouteTemplatesNotIds`; `tools/verify.mjs` · *"the Router did NOT report (bit 128) — there is none on this band, and the block says so rather than 0"*, *"absent: the Router, the Market, the Roles and the AgentCard have no code on this band — 'not deployed', not 'could not be read'"*, *"routes are templates, and there are sixteen of them, not 4,096"*, *"every one of the 159 service rows names a function its contract's ABI serves"*, *"every error a panel-facing contract declares is in the err table (211 entries, 19 contracts)"*, *"and every err entry IS the signature of the error whose selector it is, as some contract's ABI spells it"*, *"state.locks is the Locks ADDRESS (no longer shadowed by the token's lock count)"*, *"state.steward is the Steward ADDRESS (no longer shadowed by wouldPass)"*; `tools/verify-site.mjs --group boot` · *"the state says absent, not zero"*, *"the router chip reads not deployed"* (`router: not deployed on this chain`, `data-state=absent`), *"no clear bit is ever printed as 0"* (`router: could not be read at block <n>`, `data-state=unread`); `tools/verify-gateway.mjs` | partial (U7 live — the first run of the drift gate found 58 errors the table lacked; U9 prep renamed the four token-level keys that shadowed the world's addresses, served every error's whole signature, and added nine rows, each held to the ABI by the same gate; the chips are live through the boot group (U9); the gateway diff is U13) |

## G. Agents

| # | Invariant | Enforced by | Status |
|---|---|---|---|
| G1 | Receiving a token grants no authority; no `onERC*Received` grants anything | `test/Rights.t.sol` · `test_receivingATokenGrantsNothing` | live (U1) |
| G2 | Catalog hashes on chain; the bridge refuses a mismatch | `sdk/mcp.test.mjs` · *"a catalog whose hash drifted is refused"* | pending U17 |

## H. Everywhere

| # | Invariant | Enforced by | Status |
|---|---|---|---|
| H1 | Transient slots hashed, single-purpose, cleared on every exit incl. revert | `test/Transient.t.sol` · `test_everySlotIsRegisteredAndClearedOnRevert` | **live** |
| H2 | All signatures EIP-712 with chainId + verifyingContract + nonce + tokenId + epoch | `test/Reach7739.t.sol` · `test_aSignatureFromOneBandIsInvalidOnAnother` | live (U2) |
| H3 | Deployment records hold salts, facet hashes, shard addresses, gas assumptions; burner deployer; only the burner and the Timelock deploy through the factory | `tools/recover-record.mjs` · *"0 disagreeing"* (every salt as `keccak("intact.v1.<key>")`, every address as `CREATE3(factory, salt)` and as the factory's own `predict`, every pin both ways and against the factory's prediction — a *contradiction* when the chain disagrees with itself — every codehash, the Kiln's `POOL_MANAGER` and the Router's venue addresses and hashes, the Coin template in the Kiln's bytes, every shard pointer at `CREATE(engine, 1 + k)`, the factory at `CREATE(deployer, 0)` with `DEPLOYER` the burner and `TIMELOCK` the timelock salt's address; the record carries no endpoint); `src/lib/Create3Factory.sol` · `NotDeployer` and `test/Create3.t.sol` · `test_aStrangerCannotDeployThroughTheFactory`, `test_aStrangerCannotTakeAPostMvbSaltEither`, `test_theTimelockDeploysThroughItsOwnQueueOnceTheBurnerIsGone`; `tools/deploy.mjs` refuses a used key on a real band, a stranger's code at a prediction, a journal the chain contradicts, a step out of `DEPLOY_ORDER`, and refuses to publish on any miss; `tools/verify-recover.mjs` · *"a local full deploy recovers with 0 disagreeing"*, *"a mis-predicted STEWARD refuses to publish"*, *"the same salts give the same addresses on two local chains"*, *"a stranger's deploy under the market salt reverts (NotDeployer)"*, *"a week later a stranger executes it and the market salt lands where the hub pinned it"*, *"the deploy refuses rather than adopting the stranger's contract"*, *"a placeholder dist/ over a wire to a band is refused before anything is sent"*, *"factory.TIMELOCK against the arithmetic is a contradiction"*, *"a record naming a codeless Engine is walked to the end, not thrown on"*, and the sixteen *"a tampered record is caught by name"* rows | live (U10): `deployments/31337.json` from a hardhat run, 345 fields checked, 0 disagreeing; the in-process suite deploys six bands (31337 four times, Base and OP once each) and recovers 31337 and OP field by field; the review's proof of concept (a stranger landing the market salt and calling `moduleTransfer`) is refused at the factory |
