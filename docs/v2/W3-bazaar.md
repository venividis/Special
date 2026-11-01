# W3 — the Bazaar and Bridges (V2 wave 1)

docs/V2.md §3.3. The Bazaar publishes Seaport 1.6 orders on chain and is
the Seaport zone INTACT orders name; Bridges is the Timelock-written record
of the one off-chain door the viewer may open. This file is the unit's
report: what was built, every decision and its reason, the evidence, and
what the integration and later waves need. Every count and gas number
below is **measured** and names the run it came from.

## 1. What was built

| File | What it is |
|---|---|
| `src/Bazaar.sol` | Publisher and zone. `publish` validates on Seaport and emits `Published` per NFT; for an INTACT order it pins `(id, fingerprint, floors)` under the order's `zoneHash`. `authorizeOrder` (before any transfer) and `validateOrder` (after every transfer) hold a fill to the pin. `check` is the page's "still good" line. SIP-5 metadata. No owner, no setter, no ether, no fulfilment. |
| `src/Bridges.sol` | `setEndpoint(name, url)` from the Timelock only, the URL rules, `endpointOf`, `names()`. |
| `test/Bazaar.t.sol` | 53 tests against `test/mocks/BazaarFixtures.sol` (53 passed in the run of §4). |
| `test/Bridges.t.sol` | 14 tests against the real `src/Timelock.sol` (14 passed in the run of §4). |
| `test/mocks/BazaarFixtures.sol` | A hub whose fingerprint hashes the real hub's terms, a Reach, a Pool, tokens, a contract seller, and Seaport 1.6's standard path — including the conduit path's order of transfers. |
| `tools/verify-bazaar.mjs` | The in-process proof: the real site, Seaport 1.6's probed runtime at its canonical address, an in-process conduit from the probed ConduitController, real EIP-712 signatures. Exports the Seaport codec the fork proof uses. |
| `tools/verify-bazaar-fork.mjs` | `--probe`: reads Seaport, the controller and OpenSea's conduit from Base Sepolia at one pinned block and writes the fixture. Default: the fork proof on a hardhat fork of Base Sepolia (port 8549). |
| `tools/fixtures/seaport-1.6/` | `probe.json` (the evidence), `seaport.runtime.hex`, `conduit-controller.runtime.hex` (the bytes `eth_getCode` returned). |

## 2. Decisions, each with its reason

1. **`validateOrder` re-reads the floors and the pin's residue after the
   transfers.** IBazaar says it "admits what `authorizeOrder` admitted";
   it does — it holds the order to the same floors and the same pinned
   state at the second moment. The reason is a property of Seaport 1.6
   found in its source (seaport-core 1.6.6, `Executor.sol` `_transfer`,
   `OrderFulfiller.sol` `_transferEach`): on the standard and combined
   paths, native currency is pushed to each recipient at once while every
   conduit transfer is accumulated and run at the end. An INTACT listing
   paid in ether through a conduit — OpenSea's ordinary shape — therefore
   calls the seller's `receive` while the seller still holds the token,
   after `authorizeOrder` passed (a seller that is a contract, or an
   account delegated to code under EIP-7702). A sealed Reach polices only its
   manifest; an off-manifest asset can be moved or approved in that
   moment, and an approval outlives the sale. So `validateOrder` measures
   every floor again (the Market's own rule) and requires the pin's
   residue — `keccak(Reach.state(), Pool.marketHash(id))`, stored at
   `publish` — to be unchanged. Both are fingerprint terms the sale itself
   does not move; the Reach bumps `state()` on every act (each call, seal,
   guard, grant, revocation), so a Reach that acted or a market that traded
   inside the fill is refused with `FingerprintMoved`. The residue stored
   at `publish` equals the one `authorizeOrder` saw, because the full
   fingerprint matched there and it hashes both terms. Proven three ways:
   forge (`test_aSellerWhoActsOnTheReachInsideTheFillIsRefusedAfterTheTransfers`,
   `test_aSpenderWhoDrainsAFloorInsideTheFillIsRefusedAfterTheTransfers`,
   `test_aSellerWhoTradesTheMarketInsideTheFillIsRefusedAfterTheTransfers`,
   and the control `test_withoutAConduitTheTokenMovesFirstAndTheSellerHasNoMoment`),
   in-process with the real Seaport runtime and a real conduit, and on
   the fork with OpenSea's real conduit. Basic orders paid in ether move
   the token first (`BasicOrderFulfiller.sol`, "bypassing the
   accumulator") and have no such moment. What is not re-read: the terms a
   sale leaves standing that move no value — traits, launches, locks, the
   steward's plan (and V2's journal root). See §8, request 3.
2. **`Unpriced`.** The zone prices an INTACT order in one currency: the
   priced side (a listing's consideration, a bid's offer) must be all
   native or all one ERC-20. Otherwise the royalty "on the price" is a
   royalty on part of it — 1 wei plus a thousand USDC would owe on 1 wei —
   and an NFT is not a price. Refused at `publish` and at the fill. A
   contract-level error (the Market's `ZeroAddress` precedent); §8
   request 1 asks for the interface row.
3. **A pin is a statement about a token, not about one order.** Any order
   carrying a pinned `zoneHash` is held to the same state, so a seller who
   published once can sign further orders under the pin (a price change,
   an OpenSea copy) with no transaction, and each is still checked for its
   own end time, token, price and royalty. A pin can only be made by
   `publish`, against the live fingerprint.
4. **`publish` checks shape and pin, not the live seals or floors.** The
   lead's decided list, kept: the zone is the guarantee, and `check` is
   what a page reads before offering "buy". A seal cannot be raised under
   a live pin (raising it moves the fingerprint), so an order published
   short is dead on arrival — `check` names it.
5. **The zone requires exactly one plain INTACT ERC-721 at the fill too**
   (`NotIntact`), mirroring `publish`: no second token rides unguarded, no
   unresolved criteria item stands in for the pinned id.
6. **Guarded reads fail closed.** `extcodesize` and a staticcall: a Reach
   that does not answer `sealedUntil` (or answers a word wider than
   uint64) is unsealed; a Pool that does not answer `marketOf` is an open
   market with no seal; an asset that does not answer `balanceOf` holds
   zero. No answer is never a pass. The `extcodesize` half is not
   redundant with the length test: a precompile has no code and still
   answers — SHA-256 at `address(2)` returns one word for any call, so
   without it a floor on `address(2)` would be "met" by a hash
   (`test_aFloorOnAnAddressWithNoCodeIsNoAnswerEvenWhenItAnswers`).
7. **The zone's calls are `view`.** Nothing they read can change and they
   write nothing. The Bazaar calls Seaport's `getCounter`, `getOrderHash`,
   `validate`, `getOrderStatus` and nothing else — never a fulfilment,
   because Seaport skips the zone when the zone is the caller.
8. **SIP-5, as far as it goes.** `getSeaportMetadata()` returns
   `("INTACT Bazaar", [])`: no SIP beyond SIP-5 is implemented. SIP-15
   (dynamic traits) is the nearest and is not claimed — its commitment
   rides in fulfiller-supplied `extraData` and it has no assigned id; the
   Bazaar's rides in the signed `zoneHash`. SIP-5's MUSTs are met: the
   `SeaportCompatibleContractDeployed()` event at construction (in-process
   sentence: *"the Bazaar (runtime 11705 B) emits SIP-5's
   SeaportCompatibleContractDeployed at construction"*) and
   `supportsInterface` true for `0x2e778efc` and for the zone interface.
9. **Both zone interface ids.** The frozen `ISeaportZone` id is
   `0x3822a094`; Seaport 1.6's own `ZoneInterface` (seaport-types 1.6.3)
   re-declares `supportsInterface`, so its id is `0x39dd6933` (computed by
   solc here, `test_theBazaarAnswersSip5AndBothZoneInterfaceIds`). The
   Bazaar answers both, plus ERC-165 and IBazaar.
10. **`Published` prices as the binding event comment says**: a listing at
    the first consideration item's currency summed over the consideration,
    a bid at the first offer item's amount, at `startAmount`, 0 when that
    side is not one currency. One `Pinned` per zoned publish, also when the
    pin was already stored; the pin is stored once.
11. **Bridges.** `names()` returns the names that hold a record now, in
    first-set order (the interface's sentence); a removed name drops out,
    and set again it returns to its first place — the list of names ever
    set only grows. `endpointOf` keeps the time of the last write, a
    removal included: `("", t)` for a removed door, `("", 0)` for one never
    written. The URL rules read "quote" as both quote characters (an HTML
    attribute may be single-quoted), and "begins https://" as the scheme
    plus at least one byte (the scheme alone names no host).

## 3. The Seaport probe (Base Sepolia, read from the chain)

`node tools/verify-bazaar-fork.mjs --probe` (RPC_URL_84532 in the
environment), every read pinned to block **48,309,960**
(`0x0fcc734d8fa39434facf5fccb339994d4fe5a86427bc6f5465a0fe2ce29d01ef`),
probed 2026-10-19. All three addresses the brief named are right.

| | Address | Codehash | Bytes |
|---|---|---|---|
| Seaport 1.6 | `0x0000000000000068F116a894984e2DB1123eB395` | `0x7912af42062ec0080cde88360c1429d58984ae16eb3f17af505b815bf6ffc745` | 23,981 |
| ConduitController | `0x00000000F9490004C11Cef243f5400493c00Ad63` | `0x880348b652e7cce91216153a4d0107e70c77b92192f3d7a127ff1f1351961948` | 8,820 |
| OpenSea's conduit (key `0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000`) | `0x1E0049783F008A0085193E00003D00cd54003c71` | `0x069efdc9b946a332dce9951324fa197268e3ff0e00e44c6bf36049fc53113a41` (the controller's conduit runtime) | 3,190 |

`information()` → version `1.6`, domain separator
`0x4778aa25cd18fc3b8e9d053bb369734ae2ce8511b24dd9b00010466bdb496b45`
(= EIP712Domain("Seaport", "1.6", 84532, its address), recomputed),
the controller above; `name()` → `Seaport`. The controller names the
conduit for OpenSea's key, the conduit's owner is
`0x939c8d89ebc11fa45e576215e2353673ad0ba18a`, it has 3 channels and
Seaport 1.6's is open. The runtime carries Base Sepolia's chain id and
domain separator as immutables, so the codehash is per chain.

## 4. Measured

Every number here is from a run of 2026-10-19, and the row names the run.

| What | The run | Its line |
|---|---|---|
| Runtime sizes | `node tools/compile.mjs` (the worktree, `src/`) | `Bazaar` 11,705 B (48 %), `Bridges` 1,996 B (8 %); `all gated contracts fit under the EIP-170 ceiling of 24576 bytes` |
| Static audit | `node tools/static-audit.mjs` and `--selftest` (the worktree) | `static audit passed — 10 Solidity rules, 4 JS rules`; the selftest's fixture fails on 5 findings and its clean file passes |
| The Bazaar suite | `node tools/forge.mjs --match Bazaar` (`/tmp/v2-bazaar-mut`, the gate's copy, unmutated) | `  53 passed, 0 failed` |
| The Bridges suite | `node tools/forge.mjs --match Bridges` (`/tmp/v2-bridges-mut`, the gate's copy, unmutated) | `  14 passed, 0 failed` |
| In-process proof | `node tools/verify-bazaar.mjs` (the worktree) | `  58 passed, 0 failed` |
| Fork proof | `FORK_URL=<a Base Sepolia endpoint> node tools/verify-bazaar-fork.mjs` (the worktree; hardhat on 127.0.0.1:8549, forked at block 48,312,136; the node was gone from the port after) | `  32 passed, 0 failed` |

Gas, measured in the in-process run (the real site, Seaport 1.6's probed
runtime): publishing an INTACT order 286,758 on average over the run's
nine, a plain order 95,964; filling an INTACT listing in ether 327,990
(an ether floor), 288,884 for a token whose owned market is open and
sealed, 319,297 through a conduit, a plain listing 95,684; accepting an
INTACT WETH bid 327,115; deploying the Bazaar 2,584,511; landing the door
through the Timelock 153,510. The zone alone, as Seaport calls it
(execution gas, one floor): `authorizeOrder` 43,941, `validateOrder`
11,214 — the second moment costs about a quarter of the first.

The fork run, against the real Seaport and OpenSea's real conduit (gas
of each transaction, from its receipt; the hub there is the forge suite's
mock, whose fingerprint is cheaper than the real site's, so these are not
the in-process numbers): publishing the INTACT listing 233,232 and
filling it through OpenSea's conduit, with its 2.5 % fee item, 218,192;
the contract seller's fill through the conduit, nothing done
inside it, 204,508; publishing the OpenSea-shaped plain order 103,207 and
filling it 93,800. The same run proved the probe again against the fork's
state (codehashes, `information()`, the domain separator, the conduit and
its open channel), refused the window fill with `FingerprintMoved`, and
published an order after the seller raised its counter on the real Seaport
— to 77,145,439,741,189,730,427,358,834,442,462,348,627, Seaport 1.6's
block-hash increment, which the in-process chain cannot show.

## 5. The mutation gate

Every guard in `src/Bazaar.sol` and `src/Bridges.sol` was weakened by one
token, one row at a time, in a pruned copy of the tree and never in the
worktree: `/tmp/v2-bazaar-mut` (`src/Bazaar.sol`, `src/interfaces`,
`src/lib`, `test/Bazaar.t.sol`, `test/mocks/BazaarFixtures.sol`,
`lib/forge-std`) and `/tmp/v2-bridges-mut` (`src/Bridges.sol`,
`src/Timelock.sol`, the same libraries, `test/Bridges.t.sol`). For each
row the unit's harness (scratch, not committed; the shape of
`tools/mutations.mjs`) wrote the mutated source over the copy's file, ran
`node tools/forge.mjs --match Bazaar` (or `Bridges`), recorded which named
tests failed, and restored the file in a `finally` and on SIGINT/SIGTERM;
each run ended by proving the copy's source byte-equal to the worktree's
(the one run stopped midway, after Z11, so that the rest would run against
the final suite, was restored by its own SIGTERM handler and compared with
`cmp`). One cold compile per row, measured: 77–154 s for a Bazaar row and
16–23 s for a Bridges row, on four cores the other units' gates were also
using. "Suite" is the number of tests in the suite the row ran against:
Z1–Z11 ran before the last three Bazaar tests were written
(`test_aRoyaltyPaidInAnotherErc20DoesNotCount`,
`test_publishHashesTheOrderAtTheOfferersLiveCounter`,
`test_aFloorOnAnAddressWithNoCodeIsNoAnswerEvenWhenItAnswers`), which
changed no earlier test. After the gate every source file in the two gate
copies was compared byte for byte with the worktree's, as it stood: 14
and 7 files, all equal. (A third copy, `/tmp/v2-bazaar`, which no row
mutated, held the two test files from before the last edits; they were
copied over and its 51 files then matched too.)

**76 rows, 76 killed, 0 survived, 0 not run**: 59 on `src/Bazaar.sol`
(Z1–Z11 against the suite at 50 tests, Z12–Z49 against the final 53) and
17 on `src/Bridges.sol` (against the final 14). The table names at most
two killing tests a row and counts the rest.

| Row | Guard | Mutation | Suite | Killed by |
|---|---|---|---|---|
| Z1 | NotSeaport before the transfers | `if (msg.sender != SEAPORT)` → `if (msg.sender != msg.sender)` | Bazaar 50 | `test_onlySeaportMayAskTheZoneBeforeTheTransfers` |
| Z2 | NotSeaport after the transfers | `if (msg.sender != SEAPORT)` → `if (msg.sender != msg.sender)` | Bazaar 50 | `test_onlySeaportMayAskTheZoneAfterTheTransfers` |
| Z3 | a pin must be present (authorizeOrder) | `if (pin.fingerprint == bytes32(0))` → `if (pin.fingerprint == bytes32(uint256(1)))` | Bazaar 50 | `test_aZoneHashThatPinsNothingIsRefusedAtTheFill` |
| Z4 | a pin must be present (validateOrder) | `if (pin.fingerprint == bytes32(0))` → `if (pin.fingerprint == bytes32(uint256(1)))` | Bazaar 50 | `test_validateOrderRefusesAZoneHashThatPinsNothing` |
| Z5 | the token is the pinned one | `if (id != pin.id)` → `if (id != id)` | Bazaar 50 | `test_anOrderForAnotherTokenUnderAPinIsRefused` |
| Z6 | the fingerprint is the pinned one | `if (live != pin.fingerprint)` → `if (live != live)` | Bazaar 50 | `test_aMovedFingerprintRefusesTheFillAndNothingMoves`, `test_everyTermTheFingerprintHashesRefusesTheFillWhenItMoves` |
| Z7a | Reach seal ≥ endTime (boundary) | `if (reachUntil < endTime)` → `if (reachUntil <= endTime)` | Bazaar 50 | `test_aBidPaysTheRoyaltyFromWhatTheSellerReceivesAndFills`, `test_aBrokenFloorRefusesTheFill` and 19 more |
| Z7b | Reach seal ≥ endTime (present) | `if (reachUntil < endTime)` → `if (reachUntil < reachUntil)` | Bazaar 50 | `test_aReachSealShorterThanTheOrderRefusesTheFill`, `test_aReachThatDoesNotAnswerIsNotSealed` and 2 more |
| Z8a | market seal only when open | `if (open && marketUntil < endTime)` → `if (open \|\| marketUntil < endTime)` | Bazaar 50 | `test_aBidPaysTheRoyaltyFromWhatTheSellerReceivesAndFills`, `test_aBrokenFloorRefusesTheFill` and 20 more |
| Z8b | market seal ≥ endTime (boundary) | `if (open && marketUntil < endTime)` → `if (open && marketUntil <= endTime)` | Bazaar 50 | `test_aSellerWhoActsOnTheReachInsideTheFillIsRefusedAfterTheTransfers`, `test_aSellerWhoTradesTheMarketInsideTheFillIsRefusedAfterTheTransfers` and 4 more |
| Z8c | market seal ≥ endTime (present) | `if (open && marketUntil < endTime)` → `if (open && marketUntil < marketUntil)` | Bazaar 50 | `test_aPoolThatDoesNotAnswerIsNoSeal`, `test_anOpenMarketSealShorterThanTheOrderRefusesTheFill` and 1 more |
| Z9a | each floor ≥ min (boundary, before) | `if (balance < min)` → `if (balance <= min)` | Bazaar 50 | `test_aBrokenFloorRefusesTheFill`, `test_aSellerWhoActsOnTheReachInsideTheFillIsRefusedAfterTheTransfers` and 7 more |
| Z9b | each floor ≥ min (present, before) | `if (balance < min)` → `if (balance < balance)` | Bazaar 50 | `test_aBrokenFloorRefusesTheFill`, `test_checkNamesTheRefusalAPageWouldSee` |
| Z10 | an ether floor reads the Reach's balance | `if (asset == address(0))` → `if (asset != address(0))` | Bazaar 50 | `test_aBrokenFloorRefusesTheFill`, `test_aSellerWhoActsOnTheReachInsideTheFillIsRefusedAfterTheTransfers` and 7 more |
| Z11 | Unpriced: a priced item is fungible | `kind != ItemType.NATIVE && kind != ItemType.ERC20` → `kind != ItemType.NATIVE && kind != kind` | Bazaar 50 | `test_anIntactOrderPricedInTwoCurrenciesOrInAnNFTIsNotPublished` |
| Z12 | Unpriced: one item kind | `\|\| kind != currency \|\|` → `\|\| kind != kind \|\|` | Bazaar 53 | `test_anIntactOrderPricedInTwoCurrenciesOrInAnNFTIsNotPublished` |
| Z13 | Unpriced: one token | `\|\| token != coin) revert Unpriced();` → `\|\| token != token) revert Unpriced();` | Bazaar 53 | `test_anIntactOrderPricedInTwoCurrenciesOrInAnNFTIsNotPublished` |
| Z14a | royalty paid ≥ owed (boundary) | `if (paid < owed)` → `if (paid <= owed)` | Bazaar 53 | `test_aBidPaysTheRoyaltyFromWhatTheSellerReceivesAndFills`, `test_aBrokenFloorRefusesTheFill` and 11 more |
| Z14b | royalty paid ≥ owed (present) | `if (paid < owed)` → `if (paid < paid)` | Bazaar 53 | `test_aRoyaltyPaidInAnotherCurrencyDoesNotCount`, `test_aRoyaltyPaidInAnotherErc20DoesNotCount` and 1 more |
| Z15 | royalty skipped only when nothing is owed | `if (receiver == address(0) \|\| owed == 0)` → `if (receiver == address(0) && owed == 0)` | Bazaar 53 | `test_noRoyaltyIsOwedWhenTheReceiverIsZeroOrTheRateIsZero` |
| Z16 | royalty counts only what the receiver is paid | `k[i].recipient == receiver &&` → `k[i].recipient == k[i].recipient &&` | Bazaar 53 | `test_anOrderShortOfTheRoyaltyIsRefused` |
| Z17 | royalty counts only the price's currency | `&& k[i].token == coin) paid` → `&& k[i].token == k[i].token) paid` | Bazaar 53 | `test_aRoyaltyPaidInAnotherErc20DoesNotCount` |
| Z18 | a bid is priced by its offer | `if (listing)` → `if (!listing)` | Bazaar 53 | `test_aBidPaysTheRoyaltyFromWhatTheSellerReceivesAndFills`, `test_aBrokenFloorRefusesTheFill` and 16 more |
| Z19 | publish: BadPin | `if (p.zoneHash != expected)` → `if (p.zoneHash != p.zoneHash)` | Bazaar 53 | `test_aPinOverOtherFloorsIsRefused`, `test_aPinThatIsNotTheLiveFingerprintIsRefused` |
| Z20 | publish: NotRestricted | `if (p.orderType != OrderType.FULL_RESTRICTED)` → `if (p.orderType != p.orderType)` | Bazaar 53 | `test_aZonedOrderThatIsNotFullRestrictedIsRefused` |
| Z21 | publish: FloorsWithoutZone | `if (floors.length != 0)` → `if (floors.length != floors.length)` | Bazaar 53 | `test_floorsWithoutTheZoneAreRefused` |
| Z22a | publish: TooManyFloors (boundary) | `if (floors.length > MAX_FLOORS)` → `if (floors.length >= MAX_FLOORS)` | Bazaar 53 | `test_moreThanSixteenFloorsAreRefusedAndSixteenArePublished` |
| Z22b | publish: TooManyFloors (present) | `if (floors.length > MAX_FLOORS)` → `if (floors.length > MAX_FLOORS + 1)` | Bazaar 53 | `test_moreThanSixteenFloorsAreRefusedAndSixteenArePublished` |
| Z23a | publish: NotIntact, none | `if (n != 1)` → `if (n > 1)` | Bazaar 53 | `test_aZonedOrderMustTradeExactlyOnePlainIntactToken` |
| Z23b | publish: NotIntact, two | `if (n != 1)` → `if (n < 1)` | Bazaar 53 | `test_aZonedOrderMustTradeExactlyOnePlainIntactToken` |
| Z24 | publish: NotIntact, criteria offered | `if (p.offer[i].itemType != ItemType.ERC721)` → `if (p.offer[i].itemType != p.offer[i].itemType)` | Bazaar 53 | `test_aZonedOrderMustTradeExactlyOnePlainIntactToken` |
| Z25 | publish: NotIntact, criteria asked | `if (p.consideration[i].itemType != ItemType.ERC721)` → `if (p.consideration[i].itemType != p.consideration[i].itemType)` | Bazaar 53 | `test_aZonedOrderMustTradeExactlyOnePlainIntactToken` |
| Z26a | fill: NotIntact, none | `if (n != 1)` → `if (n > 1)` | Bazaar 53 | `test_anOrderUnderAPinThatTradesNoIntactTokenIsRefusedAtTheFill` |
| Z26b | fill: NotIntact, two | `if (n != 1)` → `if (n < 1)` | Bazaar 53 | `test_twoIntactTokensUnderOnePinAreRefusedAtTheFill` |
| Z27 | fill: NotIntact, criteria offered | `if (zp.offer[i].itemType != ItemType.ERC721)` → `if (zp.offer[i].itemType != zp.offer[i].itemType)` | Bazaar 53 | `test_aCriteriaItemOverIntactTokensUnderAPinIsRefusedAtTheFill` |
| Z28 | fill: NotIntact, criteria asked | `if (zp.consideration[i].itemType != ItemType.ERC721)` → `if (zp.consideration[i].itemType != zp.consideration[i].itemType)` | Bazaar 53 | `test_aCriteriaItemOverIntactTokensUnderAPinIsRefusedAtTheFill` |
| Z29a | publish: NotValidated, cancelled | `if (!validated \|\| cancelled)` → `if (!validated \|\| false)` | Bazaar 53 | `test_anOrderSeaportDidNotValidateIsRefused` |
| Z29b | publish: NotValidated, not validated | `if (!validated \|\| cancelled)` → `if (false \|\| cancelled)` | Bazaar 53 | `test_anOrderSeaportDidNotValidateIsRefused` |
| Z30 | publish: NoNFT | `if (!_hasNFT(p))` → `if (_hasNFT(p))` | Bazaar 53 | `test_aBidPaysTheRoyaltyFromWhatTheSellerReceivesAndFills`, `test_aBrokenFloorRefusesTheFill` and 40 more |
| Z31 | publish holds the Bazaar's lock | `Transient.enter(Transient.BAZAAR_LOCK);` → `Transient.exit(Transient.BAZAAR_LOCK);` | Bazaar 53 | `test_publishCannotBeReenteredFromInsideSeaport` |
| Z32 | after the transfers: the residue | `if (_residue(id, reach) != pin.residue)` → `if (pin.residue != pin.residue)` | Bazaar 53 | `test_aSellerWhoActsOnTheReachInsideTheFillIsRefusedAfterTheTransfers`, `test_aSellerWhoTradesTheMarketInsideTheFillIsRefusedAfterTheTransfers` |
| Z33 | after the transfers: each floor | `if (balance < min)` → `if (balance < balance)` | Bazaar 53 | `test_aSpenderWhoDrainsAFloorInsideTheFillIsRefusedAfterTheTransfers` |
| Z33b | after the transfers: each floor (boundary) | `if (balance < min)` → `if (balance <= min)` | Bazaar 53 | `test_aBrokenFloorRefusesTheFill`, `test_aZonedListingFillsAndPaysTheSellerAndTheRoyalty` and 2 more |
| Z34 | a pin is stored once | `if (pin.fingerprint == bytes32(0))` → `if (pin.fingerprint == pin.fingerprint)` | Bazaar 53 | `test_aPinIsStoredOnceAndASecondOrderUnderItIsPublished` |
| Z35 | a seal word wider than uint64 is no seal | `return w > type(uint64).max ? 0 : uint64(w);` → `return w > type(uint256).max ? 0 : uint64(w);` | Bazaar 53 | `test_aReachThatDoesNotAnswerIsNotSealed` |
| Z36 | a Pool that does not answer is an unsealed open market | `if (!ok \|\| ret.length < 32 * 16) return (true, 0);` → `if (!ok \|\| ret.length < 32 * 16) return (false, 0);` | Bazaar 53 | `test_aPoolThatDoesNotAnswerIsNoSeal` |
| Z37 | check: NotPinned | `if (pin.fingerprint == bytes32(0))` → `if (pin.fingerprint == bytes32(uint256(1)))` | Bazaar 53 | `test_checkNamesTheRefusalAPageWouldSee` |
| Z38 | supportsInterface: SIP-5 | `\|\| interfaceId == type(ISIP5).interfaceId` → `\|\| interfaceId == type(IERC165).interfaceId` | Bazaar 53 | `test_theBazaarAnswersSip5AndBothZoneInterfaceIds` |
| Z39 | supportsInterface: Seaport 1.6's ZoneInterface | `\|\| interfaceId == type(ISeaportZoneInterface).interfaceId` → `\|\| interfaceId == type(IERC165).interfaceId` | Bazaar 53 | `test_theBazaarAnswersSip5AndBothZoneInterfaceIds` |
| Z40 | pinHash binds this contract | `abi.encode(address(this), id, fingerprint, floors)` → `abi.encode(address(0), id, fingerprint, floors)` | Bazaar 53 | `test_aPinIsTheInterfaceFormula` |
| Z41 | constructor: a zero Pool | `\|\| pool == address(0)) revert ZeroAddress();` → `\|\| pool == address(1)) revert ZeroAddress();` | Bazaar 53 | `test_theConstructorRefusesAZeroPin` |
| Z42 | royalty on an empty consideration | `if (c.length != 0)` → `if (true)` | Bazaar 53 | `test_anIntactTokenGivenAwayOwesNoRoyaltyAndFills` |
| Z43 | publish: a listing is priced by its consideration | `if (listing)` → `if (!listing)` | Bazaar 53 | `test_aBidPaysTheRoyaltyFromWhatTheSellerReceivesAndFills`, `test_aBrokenFloorRefusesTheFill` and 40 more |
| Z44 | publish: the hash at the offerer's live counter | `_components(p, seaport.getCounter(p.offerer))` → `_components(p, uint256(0))` | Bazaar 53 | `test_publishHashesTheOrderAtTheOfferersLiveCounter` |
| Z45 | the residue holds the Reach's state | `return keccak256(abi.encode(state, market));` → `return keccak256(abi.encode(uint256(0), market));` | Bazaar 53 | `test_aSellerWhoActsOnTheReachInsideTheFillIsRefusedAfterTheTransfers` |
| Z46 | the residue holds the market's hash | `return keccak256(abi.encode(state, market));` → `return keccak256(abi.encode(state, uint256(0)));` | Bazaar 53 | `test_aSellerWhoTradesTheMarketInsideTheFillIsRefusedAfterTheTransfers` |
| Z47 | an address with no code is no answer | `if (target.code.length == 0)` → `if (target.code.length != target.code.length)` | Bazaar 53 | `test_aFloorOnAnAddressWithNoCodeIsNoAnswerEvenWhenItAnswers` |
| Z48 | constructor: a zero Seaport | `if (seaport == address(0) \|\|` → `if (seaport == address(1) \|\|` | Bazaar 53 | `test_theConstructorRefusesAZeroPin` |
| Z49 | constructor: a zero hub | `\|\| hub == address(0) \|\|` → `\|\| hub == address(1) \|\|` | Bazaar 53 | `test_theConstructorRefusesAZeroPin` |
| B1 | NotTimelock | `if (msg.sender != TIMELOCK)` → `if (msg.sender != msg.sender)` | Bridges 14 | `test_onlyTheTimelockWritesADoor` |
| B2a | URL ≤ MAX_URL (boundary) | `if (n > MAX_URL)` → `if (n >= MAX_URL)` | Bridges 14 | `test_aUrlOverMaxUrlBytesIsRefused` |
| B2b | URL ≤ MAX_URL (present) | `if (n > MAX_URL)` → `if (n > MAX_URL + 1)` | Bridges 14 | `test_aUrlOverMaxUrlBytesIsRefused` |
| B3 | a host after https:// | `if (n <= 8 \|\|` → `if (n < 8 \|\|` | Bridges 14 | `test_theSchemeAloneIsRefused` |
| B4 | begins https:// | `bytes8(u[0:8]) != bytes8("https://")` → `bytes8(u[0:8]) != bytes8(u[0:8])` | Bridges 14 | `test_aUrlThatDoesNotBeginHttpsIsRefused` |
| B5 | no space or control byte | `if (c < 0x21 \|\| c > 0x7e)` → `if (c < 0x20 \|\| c > 0x7e)` | Bridges 14 | `test_aSpaceIsRefused` |
| B6 | no DEL or non-ASCII byte | `if (c < 0x21 \|\| c > 0x7e)` → `if (c < 0x21 \|\| c > 0x7f)` | Bridges 14 | `test_aControlByteDeleteOrNonAsciiByteIsRefused` |
| B7 | no double quote | `if (c == 0x22 \|\|` → `if (c == 0x00 \|\|` | Bridges 14 | `test_aQuoteOfEitherKindIsRefused` |
| B8 | no single quote | `\|\| c == 0x27 \|\|` → `\|\| c == 0x00 \|\|` | Bridges 14 | `test_aQuoteOfEitherKindIsRefused` |
| B9 | no backslash | `\|\| c == 0x5c \|\|` → `\|\| c == 0x00 \|\|` | Bridges 14 | `test_aBackslashIsRefused` |
| B10 | no < | `\|\| c == 0x3c \|\|` → `\|\| c == 0x00 \|\|` | Bridges 14 | `test_anAngleBracketIsRefused` |
| B11 | no > | `\|\| c == 0x3e) revert` → `\|\| c == 0x00) revert` | Bridges 14 | `test_anAngleBracketIsRefused` |
| B12 | "" removes | `if (u.length != 0)` → `if (u.length != 1)` | Bridges 14 | `test_anEmptyUrlRemovesTheRecordAndRemembersWhen`, `test_namesListOnlyHeldRecordsInFirstSetOrder` |
| B13 | names lists only held records | `if (bytes(_records[_everSet[i]].url).length != 0)` → `if (bytes(_records[_everSet[i]].url).length != 1)` | Bridges 14 | `test_anEmptyUrlRemovesTheRecordAndRemembersWhen`, `test_namesListOnlyHeldRecordsInFirstSetOrder` |
| B14 | a name is listed once, where first set | `if (!_seen[name])` → `if (!false)` | Bridges 14 | `test_namesListOnlyHeldRecordsInFirstSetOrder` |
| B15 | constructor: a zero Timelock | `if (timelock == address(0))` → `if (timelock == address(1))` | Bridges 14 | `test_theConstructorRefusesAZeroTimelock` |
| B16 | names writes only held records | `if (bytes(_records[name].url).length != 0)` → `if (bytes(_records[name].url).length != 1)` | Bridges 14 | `test_anEmptyUrlRemovesTheRecordAndRemembersWhen`, `test_namesListOnlyHeldRecordsInFirstSetOrder` |

Read with the table:
- Z32, Z45 and Z46 are the window. Remove the re-read after the
  transfers, or either of its two terms, and a fill in which the seller
  acted inside the moment Seaport gave it lands: the tests that kill them
  are the conduit tests of §2.1.
- Z9b, the floors measured before the transfers, is killed only through
  `check`: on a fill the floors are measured again after the transfers
  (Z33, Z33b) and refused with the same revert data, so what the first
  measurement buys is a page whose `check` agrees with the zone, and a
  refusal before anything moves.
- Z47 is the reason for `extcodesize` beside the length test (§2.6): with
  it gone, a floor on the SHA-256 precompile is met by a hash.
- Z44's counter in the mock is a plain increment; Seaport 1.6 raises a
  counter by a block hash's high half, which only the fork run could show
  (§4).
- Z17 was given a test before it ran: until
  `test_aRoyaltyPaidInAnotherErc20DoesNotCount`, every royalty test
  differed from the price in its recipient, its amount or its item type,
  never in the ERC-20 alone. `test_publishHashesTheOrderAtTheOfferersLiveCounter`
  (Z44) and `test_aFloorOnAnAddressWithNoCodeIsNoAnswerEvenWhenItAnswers`
  (Z47) were written the same way, for guards no test held.
- B10 survived the gate's first pass over Bridges: the angle-bracket test
  refused `<script>`, which a `>` also refuses, so no test held `<` alone.
  The test now refuses each bracket alone and `<script>` after them, and
  the second pass (all seventeen rows, the final suite) killed every row.

## 6. Proposed INVARIANTS rows

In the ledger's form, for the integration to number (DESIGN §14 and
docs/INVARIANTS.md must name the same rows). Each cited sentence exists
verbatim in its file; all are **pending (W3)** until the battery runs them.

| Row | Claim | Cited | Status |
|---|---|---|---|
| W3-1 | Only Seaport asks the zone, before and after the transfers; the zone's calls are `view` | `test/Bazaar.t.sol` · `test_onlySeaportMayAskTheZoneBeforeTheTransfers`, `test_onlySeaportMayAskTheZoneAfterTheTransfers`; `tools/verify-bazaar.mjs` · *"asked by Seaport's address, the zone admits the order with each call's own selector"* | pending (W3) |
| W3-2 | A zoned fill needs a stored pin and exactly one plain INTACT ERC-721, the pinned one | `test/Bazaar.t.sol` · `test_aZoneHashThatPinsNothingIsRefusedAtTheFill`, `test_anOrderForAnotherTokenUnderAPinIsRefused`, `test_twoIntactTokensUnderOnePinAreRefusedAtTheFill`, `test_anOrderUnderAPinThatTradesNoIntactTokenIsRefusedAtTheFill`, `test_aCriteriaItemOverIntactTokensUnderAPinIsRefusedAtTheFill`, `test_validateOrderRefusesAZoneHashThatPinsNothing` | pending (W3) |
| W3-3 | The fingerprint pinned at `publish` is recomputed before any item moves; a moved term refuses the fill and nothing moves | `test/Bazaar.t.sol` · `test_aMovedFingerprintRefusesTheFillAndNothingMoves`, `test_everyTermTheFingerprintHashesRefusesTheFillWhenItMoves`; `tools/verify-bazaar.mjs` · *"a listing whose name trait was written after publishing is refused at the fill with FingerprintMoved(pinned, live)"*, *"and the token did not move"* | pending (W3) |
| W3-4 | The Reach's seal, and the owned market's when open, reach the order's end; no answer is no seal | `test/Bazaar.t.sol` · `test_aReachSealShorterThanTheOrderRefusesTheFill`, `test_anOpenMarketSealShorterThanTheOrderRefusesTheFill`, `test_aReachThatDoesNotAnswerIsNotSealed`, `test_aPoolThatDoesNotAnswerIsNoSeal`; `tools/verify-bazaar.mjs` · *"a Reach sealed ten days for a thirty-day order is refused at the fill with ReachSealShort(sealedUntil, endTime)"*, *"an owned market on the real Pool, sealed ten days for a thirty-day order, is refused at the fill with MarketSealShort(sealUntil, endTime)"* | pending (W3) |
| W3-5 | Every floor holds before the transfers and again after them; an asset that does not answer, or has no code, holds zero | `test/Bazaar.t.sol` · `test_aBrokenFloorRefusesTheFill`, `test_anEtherFloorIsTheReachsOwnBalance`, `test_aFloorOnAnAssetThatDoesNotAnswerReadsAsZero`, `test_aFloorOnAnAddressWithNoCodeIsNoAnswerEvenWhenItAnswers`, `test_aSpenderWhoDrainsAFloorInsideTheFillIsRefusedAfterTheTransfers`; `tools/verify-bazaar.mjs` · *"a Reach holding 1 ETH under a 5 ETH floor is refused at the fill with FloorBroken(asset, balance, min)"*, *"but the floor it broke refuses the fill with FloorBroken"* | pending (W3) |
| W3-6 | A seller paid inside the fill gets no moment: the Reach's state and the owned market's hash are read again after the transfers | `test/Bazaar.t.sol` · `test_aSellerWhoActsOnTheReachInsideTheFillIsRefusedAfterTheTransfers`, `test_aSellerWhoTradesTheMarketInsideTheFillIsRefusedAfterTheTransfers`, `test_theSameConduitFillLandsWhenTheSellerDoesNothingInsideIt`, `test_withoutAConduitTheTokenMovesFirstAndTheSellerHasNoMoment`; `tools/verify-bazaar.mjs` · *"a seller whose receive() makes its Reach grant an approval inside a conduit fill is refused by validateOrder after the transfers"*, *"and nothing moved: the token is the seller's and no approval survives"*, *"a token whose owned market on the real Pool is open and sealed to the order's end fills, and the sale leaves the market's hash as it was"*; `tools/verify-bazaar-fork.mjs` (over a wire, not in the battery) · *"paid in ether before OpenSea's conduit moves the token, the seller makes its Reach approve a stranger — and validateOrder refuses the fill with FingerprintMoved"* | pending (W3) |
| W3-7 | The consideration pays the hub's royalty on the whole price, in the price's one currency, to the receiver | `test/Bazaar.t.sol` · `test_anOrderShortOfTheRoyaltyIsRefused`, `test_aRoyaltyPaidInAnotherCurrencyDoesNotCount`, `test_aRoyaltyPaidInAnotherErc20DoesNotCount`, `test_anUnpricedOrderUnderAPinIsRefusedAtTheFill`, `test_aBidPaysTheRoyaltyFromWhatTheSellerReceivesAndFills`, `test_noRoyaltyIsOwedWhenTheReceiverIsZeroOrTheRateIsZero`, `test_anIntactTokenGivenAwayOwesNoRoyaltyAndFills`; `tools/verify-bazaar.mjs` · *"an order with no royalty item is refused at the fill with RoyaltyShort(receiver, paid, owed)"*, *"the royalty is paid in the bid's currency"* | pending (W3) |
| W3-8 | `publish` pins only the live fingerprint, only a FULL_RESTRICTED order naming one plain INTACT token, priced in one currency, with ≤ 16 floors and none without the zone; it holds its lock across Seaport and indexes only what Seaport validated | `test/Bazaar.t.sol` · `test_aPinThatIsNotTheLiveFingerprintIsRefused`, `test_aPinOverOtherFloorsIsRefused`, `test_aZonedOrderThatIsNotFullRestrictedIsRefused`, `test_aZonedOrderMustTradeExactlyOnePlainIntactToken`, `test_anIntactOrderPricedInTwoCurrenciesOrInAnNFTIsNotPublished`, `test_moreThanSixteenFloorsAreRefusedAndSixteenArePublished`, `test_floorsWithoutTheZoneAreRefused`, `test_anOrderSeaportDidNotValidateIsRefused`, `test_publishHashesTheOrderAtTheOfferersLiveCounter`, `test_anOrderWithNoNFTIsRefused`, `test_publishCannotBeReenteredFromInsideSeaport`, `test_aPinIsStoredOnceAndASecondOrderUnderItIsPublished`; `tools/verify-bazaar.mjs` · *"an order carrying a consideration item its offerer never signed is refused by publish with NotValidated"*; `tools/verify-bazaar-fork.mjs` (over a wire, not in the battery) · *"an order signed at the raised counter is published under the hash the real Seaport validated at that counter"* | pending (W3) |
| W3-9 | A listing published through the Bazaar is found from logs and filled with no API and no signature; any NFT is published the same way | `tools/verify-bazaar.mjs` · *"exactly one Published log answers the filter (hub, id)"*, *"the order rebuilt from that log hashes to the published order hash"*, *"a buyer fills the rebuilt order with no signature, and the INTACT token is the buyer's"*, *"a plain MockERC721 listing with no zone is published and found by (token, id)"* | pending (W3) |
| W3-10 | Only the Timelock writes a door, after its seven days | `test/Bridges.t.sol` · `test_onlyTheTimelockWritesADoor`, `test_aDoorSetThroughTheTimelocksQueueIsReadBackAfterSevenDays`; `tools/verify-bazaar.mjs` · *"a direct call to Bridges, even from the Timelock's admin, is refused with NotTimelock"*, *"the door the Timelock queued is the door Bridges reads back"* | pending (W3) |
| W3-11 | A door is `https://` and a host, ≤ 256 printable ASCII bytes with no space, quote, backslash or angle bracket; "" removes it | `test/Bridges.t.sol` · `test_aUrlOverMaxUrlBytesIsRefused`, `test_aUrlThatDoesNotBeginHttpsIsRefused`, `test_theSchemeAloneIsRefused`, `test_aSpaceIsRefused`, `test_aQuoteOfEitherKindIsRefused`, `test_aBackslashIsRefused`, `test_anAngleBracketIsRefused`, `test_aControlByteDeleteOrNonAsciiByteIsRefused`, `test_everyOtherPrintableByteIsAccepted`, `test_anEmptyUrlRemovesTheRecordAndRemembersWhen`, `test_namesListOnlyHeldRecordsInFirstSetOrder` | pending (W3) |

## 7. What later waves must know

**OpenSea's API, and an order zoned to the Bazaar.** What was verified:
Seaport 1.6 and OpenSea's conduit on Base Sepolia (§3); an INTACT-zoned
listing in ether carrying OpenSea's conduit key and an OpenSea-style fee
item fills on the real Seaport through OpenSea's real conduit, and an
unzoned OpenSea-shaped order on a plain NFT does too (§4, the fork run);
and docs.opensea.io (read 2026-10-19) documents
`POST /api/v2/orders/{chain}/{protocol}/listings` with the body
`{parameters, signature, protocol_address}`. What could not be verified:
whether OpenSea's API accepts an order whose `zone` is the Bazaar. From
here the testnets API is refused at the proxy (CONNECT 502) and the
mainnet API answers 401 without a key, and no key was used. Before the
lane posts INTACT orders to OpenSea, ask the API, with a key:
(a) whether a FULL_RESTRICTED order naming a foreign zone is accepted, or
OpenSea requires zone 0 or its own signed zone; (b) which fee items it
requires (its fee recipient and rate per collection, its creator-fee
enforcement); (c) whether it requires its own conduit key; (d) whether
its fills reach the zone (both the basic and the standard paths call
`authorizeOrder` and `validateOrder`). If OpenSea refuses the zone, an
INTACT order is still published on chain through the Bazaar and filled by
anyone from the viewer; an unzoned INTACT listing on OpenSea trades "with
none of these guarantees, and the viewer says so" (IBazaar).

**The venue-table row Seaport needs** (`tools/deploy.mjs` VENUES, a
dated commit with this probe as its evidence): for 84532, `seaport`
`0x0000000000000068F116a894984e2DB1123eB395`, `conduitController`
`0x00000000F9490004C11Cef243f5400493c00Ad63`, `openseaConduitKey`
`0x0000007b…250f0000`, `openseaConduit`
`0x1E0049783F008A0085193E00003D00cd54003c71`, with `probed: { on:
"2026-10-19", block: 48309960, codehashes: { seaport, conduitController,
openseaConduit } }` from §3; and `checkVenues` claims beside the
codehashes: `information()` says `1.6` and names this controller, the
controller's `getConduit(key)` is this conduit, and
`getChannelStatus(conduit, seaport)` is open — the claims
`tools/verify-bazaar-fork.mjs` already makes. Sepolia (11155111) is not
probed here.

**For the lanes (W8–W12).** Selling: seal the Reach to at least the end
(and the owned market, when open); read `getStateFingerprint`; zoneHash =
`pinHash(id, fingerprint, floors)` (or compute it: `pinHashOf` in
tools/verify-bazaar.mjs); build OrderComponents with zone = the Bazaar,
FULL_RESTRICTED, the proceeds, the royalty (`royaltyInfo` on the gross
price) and any fee, all in one currency; sign EIP-712 (`orderHashOf`,
`signOrder` are the reference codec, held to Seaport's `getOrderHash` and
its signature check); `publish`. Buying: `eth_getLogs` on `Published`
filtered by (token, id); rebuild the order from Seaport's
`OrderValidated` (`decodeValidated`); call `check(zoneHash, endTime)` and
show "buy" only on zero; `fulfillOrder` with no signature. Tips: a
fulfiller's tip in the price's currency raises the price the royalty is
owed on; a tip in another currency makes an INTACT order Unpriced. The
viewer adds no tips.

**For W6 (the hub).** The zone's post-transfer residue covers the value
terms (the Reach's state counter covers its seal, ledger, sessions, and
any keepsake that leaves through it; the market hash covers the owned
market). It does not cover a Journal inscription the holder makes
directly, nor the traits, launches, locks and plan. Request 3 below
closes that with one hub view.

**For the deployer.** The Bazaar's POOL must be the hub's POOL (the
in-process run asserts it); the Bazaar is not a hub module and needs no
pin in the hub. Bridges takes the Timelock.

## 8. Requests for frozen files

1. `src/interfaces/IBazaar.sol` (additive, a new INTERFACE-CHANGES
   section): `error Unpriced();` and SIP-5's
   `event SeaportCompatibleContractDeployed();` in `IBazaarEvents`. Both
   are declared in `src/Bazaar.sol` meanwhile (the Market's `ZeroAddress`
   precedent), so the ABI already carries them.
2. `src/interfaces/ISeaport.sol` (additive): Seaport 1.6's own
   `ZoneInterface` re-declares `supportsInterface`, so the id integrators
   compute is `0x39dd6933`, not `type(ISeaportZone).interfaceId`
   (`0x3822a094`). Declare an interface that mirrors seaport-types (as
   `src/Bazaar.sol` does locally) or name the constant beside
   `ISeaportZone`.
3. The hub (W6): a view `residueOf(id)` — keccak of every fingerprint
   term a sale does not move (Core's lockCount, transferSealUntil,
   createdAt, launchCount, curve and nameHash; the Reach's state, seal and
   ledger root; the market hash; the locks commitment; the launch root;
   V2's journal root and keepsake commitment). The Bazaar would store it
   at `publish` and compare it after the transfers, closing §2.1's
   residual; its own two-term residue would go.
4. `tools/deploy.mjs`: the Seaport venue row and its `checkVenues` claims
   (§7); `tools/verify-venues.mjs` re-proves it.
5. `package.json`: `"verify:bazaar": "node tools/verify-bazaar.mjs"` and
   `"verify:bazaar-fork": "node tools/verify-bazaar-fork.mjs"`.
6. `tools/check.mjs`: a `verify:bazaar` step (the in-process proof; its
   summary is `  N passed, M failed`). The probe and the fork proof need
   the network and stay manual.
7. `docs/INVARIANTS.md` and DESIGN.md §14: the rows of §6, pending (W3)
   until the battery runs them.
8. `src/Catalog.sol` (`CatalogRowsPost.SERVICES`, the err table): rows for
   the Bazaar and Bridges, and their errors (IBazaarEvents', `Unpriced`,
   `ZeroAddress`, IBridgesEvents').
9. `tools/mutations.mjs`: the rows of §5 as a W3 table (`src/Bazaar.sol`
   with `--match Bazaar`, `src/Bridges.sol` with `--match Bridges`), so
   the gate can be run again from a checkout; the find/replace pairs are
   the "Mutation" column.
