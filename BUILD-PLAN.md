# INTACT — build plan

Companion to `DESIGN.md`. Repository `/home/user/special` (`venividis/Special`, `main`), whose root already holds IPSEITY's `tools/compile.mjs`, `evm.mjs`, `forge.mjs`, `selftest.mjs`, `rpc.mjs`, `foundry.toml`, `remappings.txt`, `package.json` (solc 0.8.36, viaIR, cancun, `@ethereumjs/vm`), `src/Placeholder.sol`, `test/Placeholder.t.sol` and `research/`. Donor paths: **I** `/home/user/Most-Advanced-NFT-Possible`, **A** `/home/user/Cutting-edge-technologically-advanced-NFT`, **G** `/home/user/Pixel-Garden`, **M** `/home/user/MASTER-NFT-PROJECT/legacy/anima-v7`. Effort: **S** ≤ half a session, **M** one session, **L** a full session for one agent. Each unit is sized so one agent completes it in one session (2–6 contracts or one subsystem). Done-criteria name commands, byte and gas ceilings; test names are the sentences they prove.

## Waves and file ownership

Units in one wave touch disjoint files. Interfaces are frozen in wave 0 so every later wave compiles against `src/interfaces/*` without waiting for the implementations.

| Wave | Units (parallel) | Files owned |
|---|---|---|
| **0** (serial, first) | U0 | `src/lib/*`, `src/interfaces/*`, `src/vendor/*`, `tools/facets.mjs`, `tools/gas.mjs`, `tools/static-audit.mjs`, `test/Ratchet.t.sol`, `test/Transient.t.sol`, `test/mocks/*`, `package.json`, `docs/INVARIANTS.md` skeleton |
| **1** (MVB core) | U1 hub · U2 accounts · U3 pool · U4 social · U5 vault/steward/timelock · U6 launch | `src/hub/**`, `test/{Update,Approvals,Fingerprint,Mint,Rights,Panic,Diamond,Gas}.t.sol` · `src/Reach.sol`, `src/Grip.sol`, `test/{Reach,Reach7739,Sessions,Ledger}.t.sol`, `tools/verify-vault.mjs` · `src/Pool.sol`, `src/lib/Curve.sol`, `test/{Pool,PoolReenter}.t.sol`, `tools/verify-pool.mjs`, `tools/fuzz.mjs` · `src/{Parley,Roster,Postage,KeyRegistry}.sol`, `test/{Parley,Postage}.t.sol`, `tools/verify-parley.mjs`, `engine/whispers.mjs` · `src/{Locks,Steward,Timelock}.sol`, `test/{Locks,Steward}.t.sol`, `tools/verify-steward.mjs`, `tools/verify-timelock.mjs` · `src/{Kiln,Coin,Launchpad}.sol`, `test/Launchpad.t.sol`, `tools/verify-launch.mjs` |
| **2** (MVB site + router + deploy) | U7 site bytes · U8 router · U9 app shell + panels · U10 deploy/records | `src/{Engine,Renderer,Crest,Premises,Catalog}.sol`, `tools/build-app.mjs`, `tools/verify.mjs`, `tools/verify-premises.mjs` · `src/Router.sol`, `test/Router.t.sol` · `engine/app.html`, `engine/panels/*.js`, `engine/app.css`, `tools/verify-site.mjs` · `tools/deploy.mjs`, `tools/recover-record.mjs`, `tools/gateway.mjs`, `src/lib/Create3Factory.sol`, `deployments/` |
| **3** (MVB proof) | U11 console journeys · U12 battery + docs · U13 testnet rehearsal | `tools/verify-console.mjs`, `tools/testnet-drive.mjs` · `tools/{verify-findings,agents,invariants-check}.mjs`, `docs/{INVARIANTS,SECURITY,DEPLOYMENT,CONSOLE,AGENT}.md`, `README.md`, `CLAUDE.md` · `tools/testnet.mjs`, `tools/verify-gateway.mjs`, `deployments/84532.json` |
| **4** (post-MVB) | U14 v4 launch · U15 market · U16 roles · U17 agent surfaces · U18 nameplate · U19 audits + mainnet | `src/{LaunchHook,LPCustodian}.sol`, `test/Hook.t.sol` · `src/Market.sol`, `test/Market.t.sol` · `src/Roles.sol`, `test/Roles.t.sol` · `src/AgentCard.sol`, `engine/panels/agent.js`, `sdk/mcp.mjs`, `sdk/mcp.test.mjs` · `src/Nameplate.sol`, `tools/verify-plate.mjs` · `deployments/{8453,1}.json`, `docs/AUDITS.md` |

Cross-wave contract: U1 may not change `src/interfaces/IIntact.sol` after U0 without a note in `docs/INTERFACE-CHANGES.md` and a rerun of every wave-1 suite; the same for `IReach`, `IPool`, `IParley`, `ILaunchpad`, `ISteward`, `IPostage`, `ILocks`.

---

## Wave 0

### U0 — Skeleton, libraries, interfaces, gates · **M**
- **Depends on:** nothing.
- **Create:** `src/lib/{Ratchet,Transient,Rights,SSTORE2,Base64,Web,Mul,Tick,LibNum,Hook,ExactERC20,ERC6492,AccountBinding}.sol`; `src/vendor/ERC721Minimal.sol` (hand-rolled from I `Ipseity.sol` `_add/_remove` + per-owner index, no OZ); `src/interfaces/{IIntact,IReach,IGrip,IPool,IParley,IPostage,IKeyRegistry,ILaunchpad,IKiln,ILocks,ISteward,IRouter,IMarket,IRoles,Standards,Site}.sol` (every signature of DESIGN §4–§9, normative `Core`); `tools/facets.mjs`, `tools/gas.mjs`, `tools/static-audit.mjs`; `test/Ratchet.t.sol`, `test/Transient.t.sol`; `test/mocks/{MockRegistry6551,HostileToken,RebasingToken,SyncInsidePull,PoolReenter,SealBreaker,Permit2ish,MockPoolManager,ReentryRouter,MaliciousSeller}.sol`; `package.json` scripts (`check`, `forge:monolith`, `forge:diamond`, `gas`, `facets`, `build`, `verify:*`).
- **Origin:** I `src/lib/{SSTORE2,Base64,Web,Mul,Tick,LibNum,Hook}.sol` verbatim; A `contracts/libraries/{ExactERC20,ERC6492}.sol` verbatim; G `src/accounts/AccountBinding.sol` verbatim with salts `intact.reach.v1`/`intact.grip.v1`; A `sdk/src/index.ts:637-765` → `tools/facets.mjs` (JS, reads `out/solc.json`); I `tools/gas.mjs` pattern with caps `{tokenURI: 8_000_000, live: 2_500_000, any: 16_777_216, hard: 50_000_000}`; M `scripts/static-audit.mjs` verbatim (add the `(1n<<256n)-1n` and `eval(` greps); I `test/mocks/*` verbatim; A `contracts/mocks/{MaliciousSeller,MockTaxERC20}.sol`; G `test/contracts/ReentryRouter.sol`. `compile.mjs`: add `metadata.bytecodeHash:"none"`, the single-entry measurement list `["Intact"]` and the `--ship` report. `evm.mjs`/`rpc.mjs`: tuple ABI, EIP-7825 assertion.
- **Tests:** `test_everyRatchetOnlyLengthens`, `test_aRatchetRefusesThePastAndTheCap`, `test_everySlotIsRegisteredAndClearedOnRevert`, `test_twoPurposesNeverShareASlot`; `facets.mjs` self-test on a fixture ABI (`refuses an unrouted selector`, `refuses a duplicate`, `refuses an extra`).
- **Done:** `npm run check` green on the placeholder plus the new libraries with the negative control burning gas; `static-audit` fails on a fixture containing `tx.origin`; `gas.mjs` fails on a fixture view over 16,777,216; `Placeholder.sol` removed.

---

## Wave 1 — MVB core

### U1 — The hub: base, logic mixins, monolith, diamond · **L**
- **Depends on:** U0.
- **Create:** `src/hub/{IntactStorage,IntactBase,CoreLogic,RightsLogic,MintLogic,SiteLogic,Intact,IntactDiamond}.sol`, `src/hub/facets/{CoreFacet,RightsFacet,MintFacet,SiteFacet}.sol`; `test/{Update,Approvals,Fingerprint,Mint,Rights,Panic,Diamond,Gas}.t.sol`; `test/helpers/Deploy.sol` (deploys either build by `INTACT_IMPL`; `forge.mjs` passes it as `vm.envString`).
- **Origin and changes:** I `src/Ipseity.sol` skeleton (lines 147-168 two-salt derivation; 352-407 mint; 978-1010 transfer; ERC-7496 traits; `viewOf`) — drop the section word, `openNode`, the sealed kernel, the two-step curator and `Stats`; A `contracts/core/AnimaAgent.sol:729-755` `_update`, `:796-861` epoch approvals, `lockAgent/unlockAgent` (make unlock-at-zero revert), `:775` fingerprint; A `contracts/diamond/{AnimaDiamond,DiamondStorage,AnimaBase,AnimaLoupeFacet}.sol` — constructor takes `FacetCut[]` only (no init contract; initial storage written by the constructor), loupe views folded into the diamond, `animaConfigHash` → `intactConfigHash`; G `PixelGardenKernel.sol:281-299, 773-797` canonical-account refusal; NEW `rightsOf`, `panic/release/guardianHold`, two-step agent wallet, `stewardTransfer/moduleTransfer`, `feeSink`.
- **Tests (sentence-named):** `test_sellingTheTokenRevokesEverySellerAuthority`, `test_selfTransferBumpsTheEpochAndRevivesNothing`, `test_buyBackRevivesNoSession`, `test_aLockedTokenCannotMove`, `test_onlyPinnedModulesMayLock`, `test_unlockingAtZeroReverts`, `test_revokeAllApprovalsIsOneWrite`, `test_aTimedApprovalExpires`, `test_everyFieldMovesTheFingerprint`, `test_noIntactCanEnterAnyIntactsAccounts`, `test_aGripNeverStrandsAnIntact`, `test_sellingJLeavesKNoSellerSession`, `test_aReentrantMinterSeesACompleteToken`, `test_theBandIsExhaustedNotWrapped`, `test_mintSetsActiveAndSaleSetsPaused`, `test_aDelegatedHolderStillHolds`, `test_aRenterCannotSetATrait`, `test_receivingATokenGrantsNothing`, `test_guardianPanicLeavesOtherTokensOperatorsAlone`, `test_holderPanicKillsEveryDelegatedRight`, `test_stewardTransferRespectsASeal`, `test_theWalletProvesControlByAccepting`; Diamond: `test_partitionsTheMonolithAbiEveryFunctionRoutedOnce`, `test_routesNoDiamondCutAnywhere`, `test_slotsZeroToTwoAreEmpty`, `test_refusesAFacetBuiltAgainstAnotherConfiguration`, `test_everyFacetIsInertWhenCalledDirectly`, `test_theFingerprintIsIdenticalAcrossBuilds`, `test_rejectsAnUnknownSelectorAndBareEth`; Gas: `test_theDiamondOverheadIsBounded` (≤ 25 % / ≤ 6,000), `test_mintIsUnderFourHundredThousand`.
- **Tools:** `tools/facets.mjs` consumed in CI; `tools/compile.mjs --ship` prints the chosen build.
- **Done:** suite passes with `INTACT_IMPL=monolith` and `INTACT_IMPL=diamond`; `CoreFacet ≤ 13,000`, `RightsFacet ≤ 8,000`, `MintFacet ≤ 6,000`, `SiteFacet ≤ 10,000`, `IntactDiamond ≤ 2,500`; `Intact` measured and recorded (ship rule applied); a one-character mutation in any facet fails > 100 tests.

### U2 — Accounts: Reach and Grip · **L**
- **Depends on:** U0 (uses `IIntact`).
- **Create:** `src/Reach.sol`, `src/Grip.sol`, `src/lib/SessionPolicy.sol` (only if the valve fires); `test/{Reach,Reach7739,Sessions,Ledger}.t.sol`; `tools/verify-vault.mjs`.
- **Origin and changes:** I `src/IpseityAccount.sol` whole (seal, manifest, pieces, batch, sessions `:434-685`, attestation `:979-1110`): `_mark()` reads `HUB.custodyEpoch(id)` instead of `statsOf.xfers`; add `state()`/`auditRoot` (A `AgentAccount.sol:340-351`), `EmptyBatch` (A `koorbx`), recipe sessions and `executeTyped` (G `ReachAccount.sol:214-258, 389` `_perform`; `Call{spend[], receiveMin[]}` from G `interfaces/Applications.sol`), `minInterval/uses` (A `koorbx` `SessionScope`), ERC-20 delta caps (M net-debit), the open-approval ledger, `sealMax`/`revokeAllSessions` for hub and guardian, `Active` check, ERC-7739 wrapping of the attestation digest. I `src/GripVault.sol` verbatim, salt only.
- **Tests:** `test_operationOneIsRefused`, `test_aSessionDiesOnSale`, `test_aSessionDoesNotReviveOnBuyBack`, `test_aPausedTokenFreezesItsKeys`, `test_aSessionCannotGrantASession`, `test_anErc20CapIsMeasuredByDelta`, `test_executeTypedRefusesAShortfall`, `test_aRecipeRunsExactlyItsUses`, `test_permit2ApproveIsRecorded`, `test_aRevertingAssetDoesNotBlockRevokeAll`, `test_attestationVerifiesAsASafeOwnerWithoutReplay`, `test_aSessionKeyNeverSigns`, `test_aSignatureFromOneBandIsInvalidOnAnother`, `test_theGuardianMayRevokeEverySession`, `test_stateBumpsOnEveryGrant`; `verify-vault.mjs` ports all 97 I assertions ("a drainer with a function name no list has still Shrank", "the Grip's ABI has no selector that moves an asset") plus the ledger and epoch cases.
- **Done:** 97 + new assertions `reproduced`; `Reach ≤ 19,000` (valve at 21,000); `Grip == 1,933 ± 50`; storage layout frozen with 16 reserved slots and its hash written to `docs/ACCOUNTS.md`.

### U3 — Pool and Curve · **L**
- **Depends on:** U0 (`IIntact`, `ILaunchpad` for `openSealed`'s caller).
- **Create:** `src/Pool.sol`, `src/lib/Curve.sol`; `test/{Pool,PoolReenter}.t.sol`; `tools/verify-pool.mjs`, `tools/fuzz.mjs` (market properties).
- **Origin and changes:** I `src/Pool.sol` + `src/lib/Curve.sol` — drop `SLICE/FALLOFF` tables (`concentration(bps)` instead), delete the five admin switches, global `Transient` lock, `delete marketOf[id]` in `openMarket`, reads before `_pull`, `totalReserved` cap + `writeDown`, native quote, `swapExactOut`, `syncCurve(id, bps, expected)`, `sealMarket` (rename of `bond`), sniper fee at `openMarket` only, `acts` predicate, sealed markets (`openSealed`, `collect`, `feeBaseOwed/feeQuoteOwed`, `beneficiary`), `marketHash`, `sealedIds`. Finish I `test/mocks/PoolReenter.sol` and `tools/poc-pool.mjs`.
- **Tests:** I `Pool.t.sol` (28 incl. 6 fuzz) ported; `testFuzz_roundTripNeverProfits` extended to `swapExactOut`, native legs and dust; `test_aMarketCannotBeReopenedOverAPhantomReserve`, `test_aSyncInsideThePullReverts`, `test_aMarketCannotPayWithAnotherMarketsReserves`, `test_aDownwardRebaseFailsClosedUntilWriteDown`, `test_withdrawCannotBePaused`, `test_aMovedCurveRefusesTheSync`, `test_theReachMayDepositIntoItsOwnMarket`, `test_theSniperFeeCannotBeReArmedByADeposit`, `test_aSealedMarketNeverWithdrawsPrincipal`, `test_collectConservesValue`, `test_collectPaysTheGripWhenTheBitIsSet`; `verify-pool.mjs` 62 assertions ported ("no selector on Pool names an admin", 200-trade k-walk).
- **Done:** PoCs fail on the old code and pass on HEAD; `Pool ≤ 17,000`; nine fuzz properties hold at 0/1/2/9 wei and 2^64/2^112.

### U4 — Social: Parley, Roster, Postage, KeyRegistry · **L**
- **Depends on:** U0.
- **Create:** `src/{Parley,Roster,Postage,KeyRegistry}.sol`; `test/{Parley,Postage}.t.sol`; `tools/verify-parley.mjs`; `engine/whispers.mjs`.
- **Origin and changes:** I `src/Parley.sol` (`Said` gains `reBlock/reSeq`; `speak` gains the reply pointer; home rooms `keccak(3,id)`; cooldown keyed by `(token, epoch)`; 4-head ring in `stateOf`; `bindKey` (`holds`) replacing `announce`/`keyOf` x,y with `(keyType, keyId)` from `KeyRegistry`; `whisper(..., expectedKeyId, ...)` reverting `KeyMoved`/`NoKey`; `whisperStamped` → `POSTAGE`; `hide`; `SEALED ≤ 4,096`); I `src/Roster.sol` verbatim; A `contracts/comms/AgentComms.sol` → `Postage` (native + ERC-20 via `ExactERC20`, `stamp/settle` from `PARLEY` only, pull `owed`, `expire`, `claimRefund`, `claimSettled`, epoch-stamped `configureInbox`; drop `broadcast`, `sendPrivate`, allowlists by address → by token id); A `contracts/core/EncryptionKeyRegistry.sol` verbatim + `getPublicKeys`; G `sdk/whispers.mjs` verbatim.
- **Tests:** I `Parley.t.sol` (26) ported; `test_aRenterCannotSpeak`, `test_aBuyerIsNotRateLimitedByTheSeller`, `test_aSoldTokenHasNoKey`, `test_aRotatedKeyRefusesTheWhisper`, `test_aReplyPointerIsWalkable`, `test_followIsJoinOfTheHomeRoom`, `test_aRawPairKeyThroughSpeakReverts`, `test_exactlyOneOfSettledOrRefunded`, `test_postageAboveMaxIsRefused`, `test_aHookedFeeTokenCannotReenterParley`, `test_inboxConfigIsStaleAfterSale`; A `Comms.test.ts` (12) rewritten as `.t.sol`; `verify-parley.mjs` 37 ported ("the second walker reads 405 blocks of history in 3 single-block queries").
- **Done:** `Parley ≤ 10,000`, `Postage ≤ 8,500`, `KeyRegistry ≤ 2,500`, `Roster == 3,267 ± 50`; the mutual immutables are predicted and asserted in the test deploy.

### U5 — Vault: Locks, Steward, Timelock · **M**
- **Depends on:** U0.
- **Create:** `src/{Locks,Steward,Timelock}.sol`; `test/{Locks,Steward}.t.sol`; `tools/verify-steward.mjs`, `tools/verify-timelock.mjs`.
- **Origin and changes:** M `contracts/src/protocol/TimeVault.sol` → `Locks` (custom errors, drop `ledger.record`, add `give` into a canonical Reach from I `Locker.sol:126`, `commitmentOf`); I `src/Succession.sol` → `Steward` (hashed heir, guardians + `attest` threshold, `stillHereUnderDuress`, `execute` via `HUB.stewardTransfer`, module lock only during notice, `wouldPass`, `getWill/getObit`, `planHash`; the `AlreadyCalled` and `embody`-is-not-life lessons kept); I `src/lib/Timelock.sol` verbatim.
- **Tests:** `test_aStrangerCannotResetSilence`, `test_summonTwiceReverts`, `test_aPlanIsVoidAfterSale`, `test_oneGuardianCannotRecoverAlone`, `test_theOwnerCancelsDuringNotice`, `test_duressSilentlyMaxesTheNotice`, `test_anHeirWaitsOutASeal`, `test_theHeirMayBeWhoeverHoldsTokenN`, `test_wouldPassCoversEveryStatus`; Locks: `test_releaseGoesOnlyToTheBeneficiary`, `test_extendOnlyLengthens`, `test_giveOnlyIntoACanonicalReach`; I `verify-timelock.mjs` (24) ported; `verify-estate.mjs` succession half ported.
- **Done:** `Steward ≤ 9,000`, `Locks ≤ 7,000`, `Timelock == 1,675`; every curator call reverts without the queue.

### U6 — Launch: Kiln, Coin, Launchpad · **L**
- **Depends on:** U0 (`IPool.openSealed`).
- **Create:** `src/{Kiln,Coin,Launchpad}.sol`; `test/Launchpad.t.sol`; `tools/verify-launch.mjs` (coin + raise half).
- **Origin and changes:** I `src/Kiln.sol` `Kiln` (`launch(id, name, symbol, decimals, supply, salt, raiseShare)` minting to `account(id)` and the raise share to `LAUNCHPAD`; `mine`, `deployHook`, `coinAt`, records; drop `band/facetArg/recipeHash`); A `contracts/market/AgentToken.sol` → `Coin` verbatim with native `contribute{value}`; A `contracts/market/AgentLaunchpad.sol` → `Launchpad` (credits, `fail/refund/claim`, native quote, `createChecked`, first-launch rule + `approveFirstLaunch` by the guardian, 7-day spacing, fee legs pinned, per-launch isolation, `Target` enum with `OwnedPool` implemented and `UniswapV4` reverting `NotYet` until U14, `launchRoot`); OZ replaced by `Transient`/`ExactERC20`.
- **Tests:** A `Launchpad.test.ts` (15) rewritten; `test_nobodyCanWithdrawCurveFunds`, `test_anyoneMayGraduate`, `test_noTokenMovesBeforeGraduation`, `test_aFailedRaiseRefundsEveryWei`, `test_theTaxHasNoExemptionList`, `test_aPayoutNeverExceedsOneHundredPercent`, `test_feeTermsCannotChangeMidLaunch`, `test_anAgentsFirstLaunchNeedsTheGuardian`, `test_launchesAreSevenDaysApart`, `test_graduationOpensASealedMarketAtTheTerminalPrice`, `test_sellingTheTokenMovesTheFeeStream`, `test_theSupplyNeverNeedsAReachApproval`, `test_theSnipeTaxRaisesTheFloor`; `verify-launch.mjs` coin half ("`WrongFlags` on a mis-mined hook", "`coinAt` equals the deployed address").
- **Done:** `Kiln ≤ 14,500`, `Coin ≤ 6,000`, `Launchpad ≤ 17,500`; terminal and sealed-market spot prices emitted equal.

---

## Wave 2 — MVB site, router, deployment

### U7 — Site bytes: Engine, Renderer, Crest, Catalog, Premises · **L**
- **Depends on:** U1 (hub ABI for `Catalog.state`), U0.
- **Create:** `src/{Engine,Renderer,Crest,Catalog,Premises}.sol`; `tools/build-app.mjs`; `tools/verify.mjs`; `tools/verify-premises.mjs`; `test/Premises.t.sol`.
- **Origin and changes:** I `src/Engine.sol` verbatim + `loadPanel(i, chunk)`/`panel(i)` (six hash-pinned shards, frozen with the rest); I `src/Renderer.sol:50-116` (`INFLATE` with `$IPSE` → `$INTACT`, `document(view)`, faces 0/1/2, JSON; drop every art face and the trig); NEW `Crest` (I `Sigil` label-scan escaping rule, ≤ 4 KB SVG); I `src/ConsoleRead.sol:26-68` (`look` → `stateOf` with `reported` bits, `extcodesize` **and** `try/catch`) + I `src/Desk.sol:24-45` (`_sel` config block → `sel`, `err`, `topics`, `panels`) + I `src/PageManifest.sol` services half → `Catalog` (`state(id)` bytes, `services.json`, `/open` from `Pool.openIds`, `venues()`, `knownDelegates()`, `verbWord`, `catalogHash()`); I `src/Premises.sol` (route table of DESIGN §5.3; `/panel/*.js` from Engine with `ETag`; `/manifest` over route templates; 301s; `resolveMode()` kept; 404 never echoes the path). `build-app.mjs` from I `tools/build-engine.mjs`: shell → terser (`reserved:["INTACT"]`) → gzip → head/body shards; panels → terser → gzip → six shards; `dist/manifest.json` with every keccak; greps for a global in the loader, `src="https://`, `eval(`, `new Function`, `(1n<<256n)-1n`, `innerHTML`.
- **Tests:** I `verify.mjs` (121) ported with the new equality step ("the two surfaces are one byte-stream": `animation_url` bytes == `/token/<id>/live` body; `/token/<id>/hash` == keccak of the inflated bytes; `/manifest` hashes == recomputed; 15 ERC ids); I `verify-premises.mjs` (30) ported ("a 404 never echoes the path", "one resource one URL", "artwork is served by the router"); `test_aCoinNamedScriptTagCannotEndTheStateBlock`, `test_anAbsentSatelliteSetsTheReportedBitClear`, `test_manifestHashesRouteTemplatesNotIds`, `test_resolveModeIs5219`.
- **Tools:** `tools/gas.mjs` wired to the routes: `tokenURI ≤ 8,000,000`, `/live ≤ 2,500,000`, `/panel/* ≤ 1,000,000`, `/manifest ≤ 3,000,000`, every view ≤ 16,777,216.
- **Done:** `npm run build && npm run gas && npm run verify` green; `Renderer ≤ 17,000`, `Premises ≤ 16,000`, `Catalog ≤ 16,000`, `Crest ≤ 4,000`, `Engine ≤ 4,000`; shell gzip ≤ 18,000 B; no RPC string anywhere in `dist/`.

### U8 — Router · **M**
- **Depends on:** U0 (`IIntact.isCanonicalAccount`), U3 (own `Pool` as a venue).
- **Create:** `src/Router.sol`; `test/Router.t.sol`; `test/mocks/{MockSwapRouter02,UpgradedVenue,UnderDeliveringVenue}.sol`.
- **Origin and changes:** A `contracts/market/AgentSwapRouter.sol` (`:164 swap(SwapRequest)`, pre-call snapshots, exact-approve-then-zero, delta `minOut`; drop `Ownable`, `setVenue`, `setLimit` — venues are constructor immutables with `extcodehash`, budgets live in the Reach); G `src/cartridges/MarketCartridge.sol` v3 path validator and v4 `unlock`/`unlockCallback` commitment; M `integrations/official-launch/src/OfficialV4QuoteLens.sol` (MIT) quote-by-revert shape → `quoteExactIn` reverting `QuoteResult(spent, received, sqrtPriceAfter)`; `venues()` in `hooklist` shape.
- **Tests:** A `SwapRouter.test.ts` (11) rewritten; `test_anEoaCannotUseTheRouter`, `test_aForeignReachCannotUseTheRouter`, `test_anUpgradedVenueFailsClosed`, `test_anUnderDeliveringVenueIsCaught`, `test_noAllowanceSurvivesACall`, `test_aPreExistingRouterBalanceIsNotRefunded`, `test_quoteEqualsSwapInTheSameBlock`, `test_aHookedKeyIsRefusedUnlessItIsOurHook`, `test_aBadV3PathIsRefused`.
- **Done:** `Router ≤ 12,000`; the Reach's `executeTyped` drives a swap with a receive floor through the Router in `verify-vault`.

### U9 — The app: shell and the four lane panels · **L**
- **Depends on:** U7 (build pipeline, state block shape), U1–U6 ABIs.
- **Create:** `engine/app.html` (shell: wallet library + chooser + Home + rights gate + confirm slab + QR + viewer mode + panel loader), `engine/app.css`, `engine/panels/{swap,social,launch,vault,identity}.js` (`agent.js` is a stub until U17); `tools/verify-site.mjs`.
- **Origin and changes:** I `engine/ipseity.html` lines 1859–2396 (24,449 B: keccak, ABI, EIP-712, EIP-6963, `propose/fire/watch`, CREATE2-6551, sandbox detection) verbatim; I `src/Chrome.sol` `WALLET_JS` (2,600 chars) chooser; I branch `claude/claude-md-docs-8vvyc8` `engine/console.js` + `console-lanes.js` (53 KB filled lanes) as the lane template with `window.ethereum` replaced by the chooser and unlimited approvals replaced by exact amounts; I `src/DeskSeal.sol` seal client with the PR #27 per-send key re-read → `social.js` via `engine/whispers.mjs`; C's self-drawn SVG QR (≈ 3 KB, NEW); panel loader: `fetch('/panel/<n>.js')` or `eth_call Engine.panel(i)` → keccak compare with `INTACT.panels` → Blob script. Rules: BigInt only, `textContent` only, chain check before any read, rights recomputed on `accountsChanged`/`chainChanged`, `custodyEpoch` re-read before every send, the Active/Paused sentence on Identity, "not reported" chips, the sell-time survives/revoked checklist.
- **Tests:** `verify-site.mjs` (from I's 3,195-line DOM + wallet shim against the in-process EVM, split by surface): "the opaque origin boots the viewer and never offers connect", "a tampered panel is refused", "a renter sees the walk and the sentence", "an absent Router hides the tab and sets the chip to not reported", "every approval the slab builds is exact", "a non-holder sees the custom error before the wallet opens", "the swap slab states the floor in words", "the composer appears only for HOLD or ACCOUNT", "the raise shows the tax as a countdown", "the vault lists open approvals and revokes in one press", "panic lists what it revokes"; `selftest.mjs` vectors unchanged.
- **Done:** `npm run build` under the ceilings; `verify-site` ≥ 150 assertions; `gas.mjs` still green after the real shell lands (the 8 M `tokenURI` gate is measured here, not asserted).

### U10 — Deployment, CREATE3, records · **M**
- **Depends on:** U1–U8 (deploys everything), U0.
- **Create:** `src/lib/Create3Factory.sol` (Solady-shape, hand-rolled, no import), `tools/deploy.mjs`, `tools/recover-record.mjs`, `tools/gateway.mjs`, `deployments/README.md`, `deployments/31337.json` fixture.
- **Origin and changes:** I `tools/site.mjs` (`deploySite` ordering, `EXPECTED` list, `predictCreate`, `assertTiles`; fix W1) + I `tools/testnet.mjs` (preflight with PR #25's rollup-fee allowance, journal, read-back) + A `scripts/testnet-*.ts` three lag defences as one helper + M `scripts/sepolia.mjs` literal `--confirm` token and post-condition parsing of creation events; I `tools/recover-record.mjs`/`verify-recover.mjs` (walk immutables back, contradiction detection, `shipBuild` field, facet hashes, shard hashes, panel hashes, mutual-immutable pairs); I `tools/gateway.mjs` verbatim (read-only `/__rpc`).
- **Tests:** `verify-recover.mjs`: "a local full deploy recovers with 0 disagreeing", "a mis-predicted STEWARD refuses to publish", "the same salts give the same addresses on two local chains", "the record names which build shipped and why".
- **Done:** `node tools/deploy.mjs --chain 31337 --confirm DEPLOY_INTACT_LOCAL` then `recover-record` exits 0; order of DESIGN §12 enforced by the script's own assertions.

---

## Wave 3 — MVB proof

### U11 — Console journeys (Chromium) · **M**
- **Depends on:** U9, U10.
- **Create:** `tools/verify-console.mjs`, `tools/testnet-drive.mjs`.
- **Origin:** I branch `claude/claude-md-docs-8vvyc8` `verify-console.mjs` (96 assertions) and I `tools/testnet-drive.mjs` (injected wallet walks the site over `npx hardhat node`).
- **Tests:** three boot modes; "the EIP-6963 picker never auto-selects", "a non-holder never reaches a wallet prompt", "the viewer shows link and QR and nothing signable", "the console re-reads the epoch after every receipt and discards stale slabs", "an unknown 7702 delegate hides spend buttons", "the sealed DM re-reads the key before every send and refuses after rotation", mint → open → connect → swap → speak → launch → seal → sell → the buyer's clean `rightsOf`.
- **Done:** ≥ 110 assertions green under `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; the journey runs over a real wire on `npx hardhat node` (cancun).

### U12 — Adversarial battery, findings replay, documents · **M**
- **Depends on:** U1–U10.
- **Create:** `tools/verify-findings.mjs`, `tools/agents.mjs`, `tools/invariants-check.mjs`, `docs/INVARIANTS.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md`, `docs/CONSOLE.md`, `docs/AGENT.md`, `docs/ACCOUNTS.md`, `README.md`, `CLAUDE.md`.
- **Origin:** I `tools/verify-findings.mjs` (13 claims) extended with C1/C2/C5, B1–B4, A's `EmptyBatch`, handle, revenue-revival, self-hire, derivatives-calldata classes (each `reproduced` on the old code or `refuted` on HEAD); I `tools/agents.mjs` (7 motives × 220 ticks over Pool + Launchpad + Parley); I `INVARIANTS.md` numbering discipline; M "incomplete ≠ pass" rule in `tools/check.mjs` (a missing or duplicated suite summary fails the run).
- **Done:** `invariants-check` passes (every DESIGN §14 row names an assertion string that exists); counts in the docs written only after `npm run check`; `CLAUDE.md` carries the traps (loader globals, `document.write` and EIP-1193 listeners, `try` alone on a codeless address, `bytecodeHash:"none"`, Permit2 expiry 0, ids from the `Transfer` log, counts after runs).

### U13 — Testnet rehearsal · **M**
- **Depends on:** U10, U11, U12.
- **Create:** `tools/testnet.mjs` (public-RPC variant of `deploy.mjs`), `tools/verify-gateway.mjs`, `deployments/84532.json`, `deployments/11155111.json`.
- **Origin:** I `tools/testnet.mjs` + `verify-gateway` idea (brief §4.3; EthStorage's injection finding); self-hosted `ethstorage/web3url-gateway` for Base Sepolia (w3link does not serve it).
- **Done:** every function family exercised live with receipts in the journal (mint, open market, swap both ways, speak, whisper stamped, raise → graduate → collect, lock, seal, session act, panic, steward summon/cancel, sell); `recover-record` on both chains exits 0; `verify-gateway` diff clean; `tokenURI` measured on three public Base Sepolia endpoints and the number written to `docs/DEPLOYMENT.md`; burner keys destroyed.

**MVB done-criterion (all of waves 0–3):** `npm run check` green on both builds; a holder can mint, open the site from a marketplace frame and from `web3://`, connect, swap on the owned market and quote elsewhere, speak and whisper, launch a coin and a raise that graduates into a sealed market whose `collect` pays the Reach, seal, lock, grant a session that dies on sale, and sell the whole bundle with the buyer's `rightsOf` showing the seller holds nothing.

---

## Wave 4 — post-MVB

### U14 — Uniswap v4 launch path: LaunchHook, LPCustodian · **L**
- **Depends on:** U6, U8 (hook codehash in the Router's venue rule).
- **Create:** `src/{LaunchHook,LPCustodian}.sol`; `test/Hook.t.sol`; `tools/verify-launch.mjs` hook half; `Launchpad.Target.UniswapV4` enabled.
- **Origin:** I `src/Kiln.sol` `Gate` (1,008 B) + I branch `codex/…-hciyvv` `src/GateFacet.sol` (zero-delta fee pokes during the lock, `beforeInitialize` refusal) + M `contracts/src/kingdom/PhoenixLaunchHook.sol` fee ramp (no `syncFee` — static band); NEW `LPCustodian` with the PositionManager `MINT_POSITION, SETTLE_PAIR, SWEEP` encoding from I branch `V4PositionPlanner.sol` and M `integrations/console/lib/v4-position-encoder.mjs`, Permit2 expiry normalisation (G), 1 % pre-init check and `resalt`, permissionless `collect` → `feeSink`, unlock ratchet ≤ 10 y; I `lib/Hook.sol` constants re-checked against the pinned v4-core commit per band.
- **Tests:** I `verify-launch.mjs` hook half (49+ with the selector-faithful `MockPoolManager`): "every hook entry refuses a caller that is not the manager", "`getHookPermissions` equals the address bits", "a foreign PoolKey is refused at initialize", "negative deltas are blocked until UNLOCKS and zero-delta pokes pass", "a pre-initialised pool at the wrong price is refused and resalt gives a new key", "collect pays the Reach and principal waits for the unlock", "one mined salt gives the same address on every chain"; A `Launchpad` graduation tests re-run against the v4 target.
- **Done:** `LaunchHook ≤ 4,000`, `LPCustodian ≤ 9,000`; v4-core/periphery commit hashes pinned in the deployment record.

### U15 — Market (listing is a seal) · **M**
- **Depends on:** U1 (`moduleTransfer`, `MARKET` immutable predicted in U10), U2, U3.
- **Create:** `src/Market.sol`; `test/Market.t.sol`.
- **Origin:** A `contracts/market/AgentMarket.sol:238-274` fingerprint pin and `MaliciousSeller` regression; I `src/Consign.sol` pull-payment `owed` ledger; G `EstateCartridge.inventoryDigest` ≤ 64 balance floors re-checked after payment. `list(id, price, expiresAt, fingerprint, floors[])` requires `Reach.sealedUntil ≥ expiresAt` **and** (`!Pool.market(id).open || Pool.sealUntil(id) ≥ expiresAt`), takes the module lock; `buy{value}(id, agreed, fingerprint)` recomputes, checks floors, pays royalty first, credits `owed[seller]`, `moduleTransfer`; `delist` unlocks; `OrderPosted` event so no server distributes orders.
- **Tests:** `test_listWithoutBothSealsReverts`, `test_buyRevertsOnAnyFingerprintChange`, `test_aBrokenFloorRefusesTheSale`, `test_aMaliciousSellerHasNoWindow`, `test_royaltyIsPaidFirstAndProceedsArePulled`, `test_delistUnlocks`, `test_aListingIsStaleAfterPanic`.
- **Done:** `Market ≤ 10,000`; the Vault screen's sell flow proposes `list` with the two seals.

### U16 — Roles (ERC-7432) · **S**
- **Depends on:** U1 (`ROLES` immutable, `moduleLock`, `userOf` shim).
- **Create:** `src/Roles.sol`; `test/Roles.t.sol`.
- **Origin:** A `contracts/registry/AnimaRoles.sol` (revocable-only in v1: `revocable == false` reverts `IrrevocableUnsupported`; grants stamped with the custody epoch; `unlockToken` permissionless when every role is expired or stale; `recipientOf(USER)`).
- **Tests:** A `Roles.test.ts` (14) rewritten; `test_aLiveRoleLocksTheToken`, `test_aStaleRoleUnlocksForAnyone`, `test_panicMakesEveryRoleStale`, `test_theUserShimReadsTheRole`, `test_anIrrevocableRoleIsRefused`.
- **Done:** `Roles ≤ 5,500`; `rightsOf` sets `R_ROLE` and `R_USE` from it.

### U17 — Agent surfaces: AgentCard, the door, the MCP bridge · **M**
- **Depends on:** U7, U9.
- **Create:** `src/AgentCard.sol`; `engine/panels/agent.js`; `sdk/mcp.mjs`, `sdk/mcp.test.mjs`; face 2 wired in `SiteLogic` (already routed; returns face 1 until `AGENTCARD` has code).
- **Origin:** I `src/PageManifest.sol` llms half + A `public/.well-known/anima.json`, `llms.txt` shapes + A `sdk/src/index.ts:250-263` manifest hashing (RFC 8785); I `src/PageKey.sol` `/k` door → session-mode boot; I `src/DeskTerm.sol` `TERM.run`/`commands()` as the terminal (agent.js); C's `services.json` entry shape `{name, contract, sig, selector, kind, via, args, notes}` in `Catalog` (already) plus `AgentCard.registration(id)`, `card(id)`, `llms(id)`, `manifestHash(id)`.
- **Tests:** "a Node agent drives swap and speak through `executeAsSession` using only `services.json` and an RPC", "the bridge refuses a catalog whose hash drifted", "the door refuses a wallet that is not the key", "the Bankrbot transfer changes no bit and no session", "face 2 parses as `registration-v1` with `agentId == tokenId`".
- **Done:** `AgentCard ≤ 12,000`; `/.well-known/*`, `/llms.txt` answer; `verify-console` gains the door journey.

### U18 — Nameplate (band 0) · **S**
- **Depends on:** U7 (Premises address), U10.
- **Create:** `src/Nameplate.sol`; `tools/verify-plate.mjs`; `tools/ens-name.mjs`.
- **Origin:** I `src/Nameplate.sol:38-92, 381-420, 562-612` (custody-is-binding, ERC-6821 `contentcontract` with ERC-3770 prefix, ENSIP-10 numeric wildcard `<id>.intact.eth`, registrar-derived expiry; strip station/gateway tables; I PR #26 Sepolia wrapper `0x0635513f…dfce8`); A `cli/anima.mjs` `encodeContenthash`/`assertMainnetEnsCustody`.
- **Tests:** I `verify-plate.mjs` (~62) ported: "`contentcontract` opens the site", "a counterfeit wrapper cannot bind", "the wildcard resolves every id in the band".
- **Done:** `Nameplate ≤ 10,000`; `web3://intact.eth/token/3073/live` resolves on a local ENS fixture.

### U19 — Audits, mainnet band, Base launch · **L** (calendar-bound)
- **Depends on:** everything above; two independent audits of `Intact`, `Reach`, `Pool`, `Launchpad` on the deployed commit; stateful invariant campaigns on Pool/Reach/Launchpad.
- **Create:** `deployments/8453.json`, `deployments/1.json`, `docs/AUDITS.md`, `docs/MAINNET_READINESS.md` (ten gates, each with its evidence).
- **Done:** engine bytes and every contract on Ethereum (band 0) before Glamsterdam/EIP-8037, ENS `intact.eth` bound, then Base (band 1); `recover-record` exits 0 on both; `/manifest` hashes equal on both; `verify-gateway` clean against `w3link.io`; burner destroyed; Timelock admin handed to the queue-only 2-of-3 or renounced after the first price is set; counts in every doc re-measured after the final run.

---

## Summary table

| Unit | Title | Wave | Effort | MVB |
|---|---|---|---|---|
| U0 | Skeleton, libraries, interfaces, gates | 0 | M | ✓ |
| U1 | Hub: base, mixins, monolith, diamond, `facets.mjs` | 1 | L | ✓ |
| U2 | Reach and Grip | 1 | L | ✓ |
| U3 | Pool and Curve | 1 | L | ✓ |
| U4 | Parley, Roster, Postage, KeyRegistry | 1 | L | ✓ |
| U5 | Locks, Steward, Timelock | 1 | M | ✓ |
| U6 | Kiln, Coin, Launchpad | 1 | L | ✓ |
| U7 | Engine, Renderer, Crest, Catalog, Premises, build pipeline | 2 | L | ✓ |
| U8 | Router | 2 | M | ✓ |
| U9 | App shell and lane panels | 2 | L | ✓ |
| U10 | Deploy, CREATE3, records | 2 | M | ✓ |
| U11 | Console journeys (Chromium) | 3 | M | ✓ |
| U12 | Battery, findings replay, documents | 3 | M | ✓ |
| U13 | Testnet rehearsal | 3 | M | ✓ |
| U14 | LaunchHook, LPCustodian (v4) | 4 | L | post |
| U15 | Market | 4 | M | post |
| U16 | Roles | 4 | S | post |
| U17 | AgentCard, door, MCP bridge | 4 | M | post |
| U18 | Nameplate | 4 | S | post |
| U19 | Audits, mainnet band, Base launch | 4 | L | post |

Fourteen MVB units across four waves; wave 1's six units and wave 2's four units each run in parallel on disjoint files. Byte ceilings are per DESIGN §3; gas ceilings are `tokenURI ≤ 8,000,000`, `/live ≤ 2,500,000`, every view ≤ 16,777,216, mint ≤ 400,000, diamond overhead ≤ 25 % or ≤ 6,000 gas per call. Counts are written to documents only after the suite runs.
