# U15 — Market (listing is a seal)

Branch `wave4/u15` from the integrated head 40a678f. Files owned and
touched: `src/Market.sol` (new), `test/Market.t.sol` (new),
`test/mocks/MarketClaimant.sol` (new), `test/mocks/MaliciousSeller.sol`
(one relay function added, everything else verbatim), this report. No
interface changed; `test/Transient.t.sol` untouched (the Market's one
transient slot, `intact.market.lock`, was already registered in wave 0).

## What was built

`src/Market.sol` implements `IMarket` exactly as frozen in wave 0
(DESIGN.md §3 row 28, §11.3, §15.28; BUILD-PLAN U15), from the three donor
ideas adapted and nothing imported: ANIMA `AgentMarket.sol:238-274` (the
fingerprint pin and deliver-before-pay), IPSEITY `Consign.sol` (the `owed`
ledger, credited never pushed), Pixel-Garden `EstateCartridge` (≤ 64
balance floors, read before the payment and again after the move).

- `list(id, price, expiresAt, fingerprint, floors[])` — strict `holds`
  (`hub.ownerOf(id) == msg.sender`; the Reach, an operator, a renter, a
  guardian and a session key are all refused `NotHolder`); `expiresAt` in
  the future and at most `MAX_LISTING` = 365 days away (`BadExpiry`); at
  most `MAX_FLOORS` = 64 floors (`TooManyFloors`); one listing per token
  (`AlreadyListed`); `Reach(account(id)).sealedUntil() ≥ expiresAt` and
  (`!Pool.marketOf(id).open || Pool.marketOf(id).sealUntil ≥ expiresAt`),
  else `SealsTooShort(reachSealedUntil, marketSealedUntil, expiresAt)`;
  the fingerprint presented must equal the live `getStateFingerprint(id)`
  (`FingerprintMoved`: a seller lists what they saw); every floor must
  hold at listing time (`FloorBroken`: a floor the Reach does not meet is
  a typo, not a promise). Stores `(seller, price, expiresAt, epoch =
  custodyEpoch(id), fingerprint, floors)`, takes `hub.moduleLock(id)`,
  and pins the fingerprint read AFTER the lock — the lock count is part of
  the Core the fingerprint covers, so the value a buyer must present is
  the post-lock one; `OrderPosted` carries it.
- `delist(id)` — `holds` while the listing is live; clears, `moduleUnlock`,
  `Delisted`. See the decision below on dead listings.
- `buy(id, agreed, fingerprint)` payable, anyone — in this order: listed
  (`NotListed`), in time (`Expired`, `block.timestamp ≥ expiresAt`), same
  custody (`epoch == hub.custodyEpoch(id)` else `Stale(id)`), `agreed ==
  price` and `msg.value == price` (`WrongPrice(expected, provided)`, exact:
  under- and over-payment both refused, nothing refunded because nothing
  is kept), `fingerprint == pinned == hub.getStateFingerprint(id)`
  recomputed live (`FingerprintMoved(expected, actual)`), every floor on
  the Reach (`asset == 0` is `account(id).balance`, otherwise
  `IERC20.balanceOf(account(id))` through `extcodesize` plus a low-level
  staticcall — a codeless or reverting asset reads as zero and fails the
  floor; `FloorBroken(asset, min, actual)`). Then the royalty FIRST —
  `hub.royaltyInfo(id, price)` credited to `owed[receiver]` (skipped when
  the receiver is zero) — the proceeds `price − royalty` credited to
  `owed[seller]`, the listing deleted, `moduleUnlock`,
  `hub.moduleTransfer(id, msg.sender)` (the hub bumps the epoch and strips
  every seller authority through its sealed `_update`), the floors
  re-checked after the move (G's lesson), `Sold`. The seller is never
  called during the fill: there is no callback to attack from.
- `claim()` — pulls `owed[msg.sender]`: `NothingOwed`, zeroed before the
  send, `TransferFailed` on a refused send (the ledger stands), `Claimed`.
- Every door (`list`, `delist`, `buy`, `claim`) runs under the registered
  transient lock `Transient.MARKET_LOCK` (`Reentrancy`), the Pool's
  one-lock-on-every-door discipline.
- Views: `listingOf(id)` (an unlisted id reads as an empty listing, never
  a revert), `owed(payee)`, `MAX_FLOORS`, `MAX_LISTING`, `HUB`, `POOL`.
  No admin, no owner, no setter, no fee: two immutables, two constants.
  The constructor refuses a zero pin with a contract-local `ZeroAddress()`
  (not in the interface: a construction-time error nobody decodes at run
  time).

What makes a listing stale by construction: a holder's or guardian's
`panic` and every custody change bump the epoch; the lock makes every
transfer path revert `IsLocked` while listed, so the only way the epoch
moves under a listing is `panic` — and the holder (unchanged) still
delists. The holder's own `sealTransfer` is honoured by the hub's door:
`buy` reverts `IsTransferSealed` with the buyer paying nothing and the
listing standing (`test_theHoldersTransferSealStopsTheSaleToo`).

## Decisions (for DESIGN §15 if the integrator agrees)

1. **A dead listing may be cleared by anyone.** `delist` is `holds` while
   the listing is live (not expired, same epoch). Once it is dead —
   expired, or stale because the custody epoch moved under it — nothing
   can ever buy it and its module lock protects nobody, so `delist` is
   open to anyone: the Steward's own rule for a void plan's notice
   (DESIGN §9.4 "cancel of a VOID plan is open to anyone"). Without it, a
   holder who lists and then loses the key leaves a token the Steward can
   never move (`stewardTransfer` meets `IsLocked` for ever). Clearing a
   dead listing moves nothing: after a panic only the holder can move the
   token anyway, and after an expiry the holder is unchanged.
   `test_anExpiredOrStaleListingCannotFillAndAnyoneMayClearIt` proves
   both halves and that a live listing is still the holder's alone.
2. **The fingerprint is verified at `list` and pinned after the lock.**
   DESIGN says only that `buy` recomputes. Verifying the seller's value
   against the chain before the lock catches a stale console for free;
   pinning after the lock is forced by `Core.lockCount` being inside the
   fingerprint. A console therefore passes `getStateFingerprint(id)` read
   live to `list`, and `listingOf(id).fingerprint` (equal to the live
   value while nothing moves) to `buy`.
3. **Floors are checked at `list` too** (Pixel-Garden checks at
   `createListing`): a listing the Reach cannot honour on the day it is
   posted is refused with the same `FloorBroken` the buyer would have met.
4. **A royalty larger than the price is not guarded** (Consign's
   `roy >= price → 0`): the hub bounds it at 500 bps, and were it ever
   larger the checked subtraction `price − royalty` would revert the fill
   rather than overdraw the ledger — fail closed by construction.
5. **A zero price and a zero floor are allowed**: there is no error for
   them in the frozen interface and both are harmless (a free listing is
   the seller's explicit choice; a zero floor always holds).

## Measured

`node tools/compile.mjs` on this tree (solc 0.8.36, viaIR, 800 runs,
`bytecodeHash: "none"`; 435.4 s cold on four cores shared with four other
compiles):

- **`Market` 5,930 B** deployed, against the ≤ 10,000 budget of DESIGN §3
  row 28 (59 %). Every other contract measures exactly as before the unit
  (Reach 20,821, Pool 12,606, CoreFacet 12,785, …); all gated contracts fit
  under EIP-170; the ship rule still reads diamond (Intact 25,402 B >
  24,000), unchanged by this unit.

## Tests — `test/Market.t.sol`

Twenty-four sentences, one contract (`MarketTest is BundleFixture`),
deploying the real hub in the build `INTACT_IMPL` names with
`IntactConfig.market` = the Market's predicted address, the real Reach and
Grip implementations behind the real ERC-6551 registry runtime, the real
Pool (`Pool(hubP, pad)`, the launchpad pin never called) and the Market
itself, nonce-predicted from the test contract exactly as `test/Bundle.t.sol`
does, every prediction asserted (`Mispredicted` otherwise). The seven
BUILD-PLAN names are the first seven below.

| Sentence | What it proves |
|---|---|
| `test_listWithoutBothSealsReverts` | no Reach seal → `SealsTooShort(0,0,exp)`; a Reach seal one second short → `SealsTooShort(exp−1,0,exp)`; a covering Reach seal with no owned market lists; an open unsealed market → `SealsTooShort(exp,0,exp)`; a market seal one second short → `SealsTooShort(exp,exp−1,exp)`; both covering list, the listing's fields and lock are right; a listing one second past both seals is refused. Every revert compared as whole data. |
| `test_buyRevertsOnAnyFingerprintChange` | a made-up fingerprint → `FingerprintMoved(pinned, wrong)`; a stale fingerprint is refused at `list` too; then each of a trait set, a seal lengthened (Reach state + seal), an approval through the Reach (ledger root + state), and a stranger's trade on the owned market (reserves → market hash) moves the fingerprint and the buy is refused both with the pinned and with the live value (`FingerprintMoved(pinned, live)` whole); the untouched listing fills. |
| `test_aBrokenFloorRefusesTheSale` | a floor above the Reach's balance is refused at `list` (`FloorBroken(rbs, 11e18, 10e18)`); the floor is stored; a rebase shrinks the balance with no Reach action, the fingerprint provably stands, and the fill is refused `FloorBroken(rbs, 10e18, 9e18)` with nothing kept; restored, it fills and the buyer's Reach holds the floor. |
| `test_aMaliciousSellerHasNoWindow` | an ERC-1271 seller contract seals, lists with a floor, arms itself (ANIMA's approval shape); the fill never calls it (`armed` still true), the token and the Reach move to the buyer with the asset intact; at `claim` the callback fires and the drain, the session grant and `setUser` all fail; `rightsOf(seller) == 0`, the standing approval it gave buys nothing (`NotSigner` on the Reach). |
| `test_royaltyIsPaidFirstAndProceedsArePulled` | with a 5 % royalty the fill moves ether only buyer → Market; `owed[receiver] = 0.5`, `owed[seller] = price − 0.5`, the seller's wallet untouched; each pulls its own in either order, the balance and the ledger agree to the wei, a second claim is `NothingOwed`; with no receiver the whole price is the seller's. |
| `test_delistUnlocks` | `NotListed` before a listing; a live listing refuses `delist` from the Reach (through `execute`), an operator and a stranger (`NotHolder`); the holder's delist unlocks, clears, makes `buy` and a second `delist` `NotListed`, and the token moves freely. |
| `test_aListingIsStaleAfterPanic` | after the holder's panic the buy is `Stale(id)` with either fingerprint, before any other question; the listing still holds its lock; the holder delists, relists under epoch 2 under the seal the panic set, and it fills; a guardian's panic does the same and the hold outlives the listing until `release`. |
| `test_theSaleRevokesTheSellerEverywhere` | a session that worked, a guardian, a user, an approvee and an operator before the sale; after `buy`: epoch 2, `Paused`, unlocked, `rightsOf(seller) == 0`, every delegated bit 0, the operator approval stays alice's and reaches nothing, the session is `SoldOn`, the seller's `execute` is `NotSigner`, a transfer back is `NotAuthorized`, the seal survived and still refuses value. |
| `test_theBuyerCanRelist` | both seals and the owned market survive the sale; the buyer lists under epoch 2, the seller cannot delist it, a third party fills, both sellers are owed, the market's sole LP is the latest holder. |
| `test_theReachCannotList` | `acts` but not `holds`: `list` through `execute` and through a session key is `NotHolder` and nothing is locked. |
| `test_aNonHolderCannotListOrDelist` | an operator, an approvee, a renter, the guardian and a stranger are all `NotHolder` on `list` and on `delist` of a live listing; an unminted id is `NoSuchToken` from the hub. |
| `test_aListedTokenCannotBeListedAgain` | `AlreadyListed`; one listing, one lock. |
| `test_aListedTokenCannotBeTransferredByItsHolder` | `transferFrom`, `safeTransferFrom` and an operator's transfer are `IsLocked` while listed; the `locked` trait reads 1; after `delist` the operator's transfer lands. |
| `test_theHoldersTransferSealStopsTheSaleToo` | with a transfer seal every Market check passes and the hub's door reverts `IsTransferSealed`; the buyer paid nothing, nobody is owed, the listing stands; after the seal runs out the same listing fills. |
| `test_theExactPriceIsRequired` | `agreed ≠ price`, underpayment, overpayment, `agreed > price` and zero value are each `WrongPrice(price, provided)` whole; the exact fill lands and the ledger equals the balance. |
| `test_sixtyFiveFloorsAreRefused` | 65 → `TooManyFloors`; 64 floors on two kinds of asset list and fill; the floors go with the listing. |
| `test_anExpiryPastAYearIsRefused` | a year plus one second, now, and zero are `BadExpiry`; a year exactly under a seal of a year exactly lists. |
| `test_anExpiredOrStaleListingCannotFillAndAnyoneMayClearIt` | one second before expiry a stranger's delist is `NotHolder`; at expiry the buy is `Expired`; a stranger clears the dead listing, the lock goes and the token did not move; a listing made stale by a panic is likewise a stranger's to clear. |
| `test_aNativeFloorIsCheckedOnTheReachsBalance` | an ether floor is read from `account(id).balance`: lowered, `FloorBroken(0, 1e18, 0.5e18)`; restored, it fills and the ether is the buyer's Reach's. |
| `test_anAssetThatDoesNotAnswerReadsAsZeroOnTheFloor` | a codeless asset is `FloorBroken(asset, 1, 0)` at `list`; a token that answers at `list` and reverts on `balanceOf` at the fill is `FloorBroken(asset, 5e18, 0)` — never a foreign revert, never a pass; seeing again, it fills. |
| `test_claimWithNothingOwedReverts` | a stranger, the buyer and a seller already paid are `NothingOwed`. |
| `test_aReenteringClaimantIsRefused` | a payee re-entering `claim` from the payment is paid exactly once and the inner call met `Reentrancy` (the lock), not an empty ledger; the seller's share is untouched. |
| `test_aRefusedPaymentStaysOwed` | a payee whose wallet reverts gets `TransferFailed` and stays owed with the balance intact; accepting later, it is paid; the seller's share was never at risk. |
| `test_theMarketAndTheHubArePinnedToEachOther` | `hub.MARKET()`, `Market.HUB()`, `Market.POOL()`, `hub.POOL()`, `Pool.HUB()`, the two constants; a stranger's `moduleTransfer` is `NotMarket` and `moduleLock` `NotModule`; an unlisted id reads empty. |

Where an error's arguments are the evidence (`SealsTooShort`, `FloorBroken`,
`FingerprintMoved`, `WrongPrice`) the suite makes the call by hand and
compares the revert data whole (`_revertsWith`), because this runner's
`expectRevert(bytes)` matches any revert; selector pins use the `bytes4`
form, which the runner compares.

**Runs in the worktree (`/home/user/Special-wave4/u15`, the proof of
record: 2026-10-13 16:24–16:25 UTC after the container restart, on the
compile cache the cold run of 05:41 UTC had written — the inputs were
unchanged, so every step reused it; the cold figures are in parentheses):**

| Command | Result |
|---|---|
| `node tools/compile.mjs` | `Market` 5,930 B; all gated contracts under EIP-170; ship rule diamond (Intact 25,402 B), unchanged (435.4 s cold at 05:41 UTC, 0.2 s warm at 16:24) |
| `INTACT_IMPL=monolith node tools/forge.mjs --match Market` | **38 passed, 0 failed** — `MarketTest` 24, plus 14 tests of other suites whose names contain "Market" (`PoolTest` 7, `PoolReenterTest` 3, `BundleTest` 3, `LaunchpadTest` 1); the same 38 on the cold run of 05:48 UTC (27 min of compile under four other units' compiles) |
| `INTACT_IMPL=diamond node tools/forge.mjs --match Market` | **38 passed, 0 failed** — the same 24 + 14 on the diamond (27 s; one compile serves both builds) |
| `node tools/forge.mjs --match Bundle` | 7 passed, 0 failed (the hub's lock and transfer rules the Market depends on, with the real wave-1 satellites) |
| `node tools/forge.mjs --match Update` | 10 passed, 0 failed (`_update`, the locks, `moduleTransfer`'s door and the transfer seal) |
| `node tools/static-audit.mjs` | static audit passed — 10 Solidity rules, 4 JS rules (run in the chain at 16:25 and by hand at 05:3x) |

`node tools/forge.mjs --match Transient` was not run: the registry was not
touched (the Market's slot `intact.market.lock` was registered in wave 0
and is the slot `Market` uses).

Earlier, while iterating, the suite ran green in two pruned copies (24
passed, 0 failed in each): one with the full `test/helpers/Deploy.sol`
(651 s) and one with Deploy.sol's unused satellite imports trimmed (521 s),
the copy the mutation gate then ran in.

## Mutation evidence (INVARIANTS discipline)

Discipline (docs/INVARIANTS.md): a guard is proved only when a one-character
or one-token mutation of it makes a named test fail. Each row below was
applied to `src/Market.sol` in a copy of this tree pruned to the hub (both
builds' sources), Reach, Grip, Pool, Market, their libraries, interfaces and
mocks, with `test/helpers/Deploy.sol`'s unused satellite imports trimmed
(`_nextNonce`/`_predict` verbatim; the suite itself unchanged), then
`node tools/forge.mjs --match Market` (the 24 sentences, monolith build) was
run against the mutant and the file restored. The driver, the table and
every mutant's log are `scratchpad/mutate.sh`, `scratchpad/mutations.tsv`
and `scratchpad/mut-M*.log` of this session (2026-10-13 05:40–07:1x UTC,
two lanes). The baseline in that copy is 24 passed, 0 failed. **26
mutations run: 23 killed, 3 survived.** The survivors are the three
doubled guards the design note predicted; each is written below as a test
request, as the ledger's discipline asks, not dropped.

| Mutation | Guard | One-character / one-token change | Verdict (`--match Market`, 24 sentences) |
|---|---|---|---|
| M01-stale | `Stale` (custody epoch) | the line `if (l.epoch != hub.custodyEpoch(id)) revert Stale(id);` deleted | **killed** — 1 failed: `test_aListingIsStaleAfterPanic` |
| M02-fp-live | `FingerprintMoved`, live | the line `if (live != pinned) revert FingerprintMoved(pinned, live);` deleted | **killed** — 1 failed: `test_buyRevertsOnAnyFingerprintChange` |
| M03-fp-presented | `FingerprintMoved`, presented | the line `if (fingerprint != pinned) revert FingerprintMoved(pinned, fingerprint);` deleted | **killed** — 1 failed: `test_buyRevertsOnAnyFingerprintChange` |
| M04-seal-reach | `SealsTooShort`, the Reach seal | `reachUntil < expiresAt` → `reachUntil > expiresAt` (one character) | **killed** — 3 failed: `test_aListingIsStaleAfterPanic`, `test_buyRevertsOnAnyFingerprintChange`, `test_listWithoutBothSealsReverts` |
| M05-seal-market | `SealsTooShort`, the market seal | `m.sealUntil < expiresAt` → `m.sealUntil > expiresAt` (one character) | **killed** — 1 failed: `test_listWithoutBothSealsReverts` |
| M06-floor-cmp | `FloorBroken`, the comparison | `if (actual < f.min)` → `if (actual > f.min)` (one character) | **killed** — 4 failed: `test_aBrokenFloorRefusesTheSale`, `test_aNativeFloorIsCheckedOnTheReachsBalance`, `test_anAssetThatDoesNotAnswerReadsAsZeroOnTheFloor`, `test_sixtyFiveFloorsAreRefused` |
| M07-royalty-first | royalty first: the proceeds | `owed[seller] += price - royalty;` → `owed[seller] += price;` (one token) | **killed** — 2 failed: `test_aRefusedPaymentStaysOwed`, `test_royaltyIsPaidFirstAndProceedsArePulled` |
| M08-royalty-credit | royalty first: the credit | the line `if (royalty != 0) owed[receiver] += royalty;` deleted | **killed** — 3 failed: `test_aReenteringClaimantIsRefused`, `test_aRefusedPaymentStaysOwed`, `test_royaltyIsPaidFirstAndProceedsArePulled` |
| M09-pull-zero | the pull ledger: zero before the send | the line `owed[msg.sender] = 0;` deleted | **killed** — 3 failed: `test_aReenteringClaimantIsRefused`, `test_claimWithNothingOwedReverts`, `test_royaltyIsPaidFirstAndProceedsArePulled` |
| M10-pull-fail | the pull ledger: a refused send | the line `if (!ok) revert TransferFailed();` deleted | **killed** — 1 failed: `test_aRefusedPaymentStaysOwed` |
| M11-lock | the transient lock | the line `Transient.enter(Transient.MARKET_LOCK);` deleted | **killed** — 1 failed: `test_aReenteringClaimantIsRefused` |
| M12-holds-list | `holds` on `list` | the line `if (hub.ownerOf(id) != msg.sender) revert NotHolder();` deleted | **killed** — 2 failed: `test_aNonHolderCannotListOrDelist`, `test_theReachCannotList` |
| M13-delist-dead | a dead listing is anyone's | `if (live && hub.ownerOf(id) != msg.sender)` → `if (hub.ownerOf(id) != msg.sender)` (one token) | **killed** — 1 failed: `test_anExpiredOrStaleListingCannotFillAndAnyoneMayClearIt` |
| M14-delist-live | `holds` on `delist` | the line `if (live && hub.ownerOf(id) != msg.sender) revert NotHolder();` deleted | **killed** — 4 failed: `test_aNonHolderCannotListOrDelist`, `test_anExpiredOrStaleListingCannotFillAndAnyoneMayClearIt`, `test_delistUnlocks`, `test_theBuyerCanRelist` |
| M15-expired | `Expired` | `block.timestamp >= expiresAt` → `block.timestamp > expiresAt` (one character) | **killed** — 1 failed: `test_anExpiredOrStaleListingCannotFillAndAnyoneMayClearIt` |
| M16-expiry-cap | `BadExpiry`, the cap | `expiresAt > block.timestamp + MAX_LISTING` → `>=` (one character) | **killed** — 1 failed: `test_anExpiryPastAYearIsRefused` |
| M17-too-many | `TooManyFloors` | `floors.length > MAX_FLOORS` → `>=` (one character) | **killed** — 1 failed: `test_sixtyFiveFloorsAreRefused` |
| M18-price-value | `WrongPrice`, the value | the line `if (msg.value != price) revert WrongPrice(price, msg.value);` deleted | **killed** — 1 failed: `test_theExactPriceIsRequired` |
| M19-price-agreed | `WrongPrice`, the agreed price | the line `if (agreed != price) revert WrongPrice(price, agreed);` deleted | **killed** — 1 failed: `test_theExactPriceIsRequired` |
| M20-module-lock | the module lock | the line `hub.moduleLock(id);` deleted | **killed** — 21 failed: 21 of the 24 (every sentence that lists or fills) |
| M21-already-listed | `AlreadyListed` | the line `if (l.seller != address(0)) revert AlreadyListed(id);` deleted | **killed** — 1 failed: `test_aListedTokenCannotBeListedAgain` |
| M22-pin-after-lock | the fingerprint pinned after the lock | `bytes32 pinned = hub.getStateFingerprint(id);` → `bytes32 pinned = live;` (the pre-lock value) | **killed** — 16 failed: 16 of the 24 (every sentence that lists or fills) |
| M23-list-floors | floors checked at `list` | the list-time loop `for (…) _requireFloor(reach, floors[i]);` deleted | **killed** — 2 failed: `test_aBrokenFloorRefusesTheSale`, `test_anAssetThatDoesNotAnswerReadsAsZeroOnTheFloor` |
| M24-post-recheck | floors re-checked after the move | the second `_requireFloors(reach, floors);` deleted | **SURVIVED** — 24 passed; a test request, below |
| M25-pre-check | floors checked before the ledger | the first `_requireFloors(reach, floors);` deleted | **SURVIVED** — 24 passed; a test request, below |
| M26-codeless | `extcodesize` before the balance read | the line `if (asset.code.length == 0) return 0;` deleted | **SURVIVED** — 24 passed; a test request, below |

Reading the verdicts: every guard the brief named is killed by the sentence
that owns it — `Stale` by `test_aListingIsStaleAfterPanic`; both
`FingerprintMoved` checks by `test_buyRevertsOnAnyFingerprintChange`; both
halves of `SealsTooShort` by `test_listWithoutBothSealsReverts` (the Reach
half also by the two sentences that list under a seal); `FloorBroken` by all
four floor sentences; the royalty-first order by
`test_royaltyIsPaidFirstAndProceedsArePulled` (and the two ledger sentences
that read the same figures); the pull ledger's zeroing by
`test_claimWithNothingOwedReverts` and the re-entry sentence, its refused
send by `test_aRefusedPaymentStaysOwed`, and the transient lock by
`test_aReenteringClaimantIsRefused` alone — which is why that sentence
asserts the re-entry met `Reentrancy` rather than `NothingOwed`: with CEI
in place the lock is the only guard a test can see. The decision that a
dead listing is anyone's to clear is load-bearing in both directions (M13
and M14); pinning the fingerprint after the lock is what every fill depends
on (M22, 16 sentences).

**The three survivors, as test requests:**

- **M24 (the post-move floor re-check deleted) and M25 (the pre-ledger
  floor check deleted) survive each other.** No callback runs between the
  two reads: the hub's `moduleTransfer` makes none, `moduleUnlock` makes
  none, and an asset's `balanceOf` is a staticcall, so no test in this
  hub can tell the first check from the second — whichever one stands
  refuses the fill with the same `FloorBroken`. The second check is
  Pixel-Garden's rule kept for the day a hub grows a hook (an
  `onERC721Received` on `moduleTransfer`, or a Roles hook). *Test
  request:* when such a hook exists, a seller whose hook moves a floor
  asset out of the Reach during the move must meet `FloorBroken` from the
  re-check (`test_aFloorMovedDuringTheMoveIsCaughtAfterIt`); until then
  the pair is one guard with two lines, and the row's evidence is M06
  (the comparison inside `_requireFloor`, killed by all four floor
  sentences). If the integrator prefers no unkillable line, deleting the
  second call is a two-line change with no observable effect today; I
  kept it as the donor's lesson.
- **M26 (`if (asset.code.length == 0) return 0;` deleted) survives**
  because a staticcall to a codeless address returns success with empty
  data, which the `ret.length == 32` check already reads as zero. The
  line is the CLAUDE.md idiom ("`extcodesize` AND a low-level staticcall")
  and costs ~20 bytes; it is redundant with the length check for every
  codeless target. *Test request:* none can kill it in this form — the
  honest alternatives are to keep it as the idiom (my choice) or to drop
  it; `test_anAssetThatDoesNotAnswerReadsAsZeroOnTheFloor` guards the
  behaviour either way.

## Proposed ledger rows

A new row in the "C. The market" section of `docs/INVARIANTS.md` and of
DESIGN.md §14 (the two must name the same file and sentences):

| # | Invariant | Enforced by | Status |
|---|---|---|---|
| C6 | Market: listing is a seal. `list` is strict `holds` and refused unless the Reach seal and (when the owned market is open) the market seal both reach `expiresAt`; a listing holds the hub's module lock and pins the fingerprint; `buy` fills only at the exact price, under the same custody epoch, against the fingerprint recomputed live, with every balance floor standing; the royalty is credited first and every payee pulls from `owed` (nothing is pushed during the fill); the sale moves the token through `moduleTransfer` so every seller authority dies; `delist` unlocks | `test/Market.t.sol` · `test_listWithoutBothSealsReverts`, `test_buyRevertsOnAnyFingerprintChange`, `test_aBrokenFloorRefusesTheSale`, `test_aMaliciousSellerHasNoWindow`, `test_royaltyIsPaidFirstAndProceedsArePulled`, `test_delistUnlocks`, `test_aListingIsStaleAfterPanic`, `test_theSaleRevokesTheSellerEverywhere`, `test_theReachCannotList`, `test_aReenteringClaimantIsRefused` | proposed live (U15: 24 sentences green on both builds in the worktree; 18 one-character/one-token mutations of `src/Market.sol` each killed by the named sentences — see the unit report `docs/wave4/u15-report.md`); the integrator flips it once the suite has run inside `npm run check` |

DESIGN.md §11 item 3 can add one clause: "(U15) the listing also pins the
fingerprint and ≤ 64 balance floors; a listing is cleared by anyone once
it is dead." DESIGN.md §15 would gain decision 37, ready to paste:

> 37. **Market (U15)** — `delist` is `holds` while a listing is live and
> open to anyone once it is dead (expired, or stale because the custody
> epoch moved): nothing can fill a dead listing and its module lock only
> hurts whoever holds the token now — the Steward's rule for a void
> plan's notice, so a listing a lost key posted can never hold an heir
> off for ever. The seller's fingerprint is verified against the chain
> before the module lock and the fingerprint pinned for the buyer is read
> after it (`lockCount` is in the Core the fingerprint covers); floors are
> checked at `list` as at `buy`; a royalty larger than the price is left
> to the checked subtraction (fail closed); a zero price and a zero floor
> are allowed.

## Catalog service rows (`CatalogRows.SERVICES`, letter `M` = Market)

The integrator has already placed six `market.*` rows under letter `M`
from the frozen interface — `list`, `delist`, `buy`, `claim`, `listingOf`,
`owed`. Checked against the implementation, none needs to change in
signature; the kind/via/note columns that match what the contract does are:

```
"market.list|M|list(uint256,uint256,uint64,bytes32,(address,uint256)[])|w|d|holds - both seals must reach expiresAt; the fingerprint is getStateFingerprint read live; a floor is (asset,min), asset 0 is ether;"
"market.delist|M|delist(uint256)|w|d|holds while live - anyone once expired or stale;"
"market.buy|M|buy(uint256,uint256,bytes32)|p|d|value is the price exactly; the fingerprint is listingOf(id).fingerprint - re-read the epoch and the fingerprint before Sign;"
"market.claim|M|claim()|w|d|pull what a sale owes you;"
"market.listingOf|M|listingOf(uint256)|r|d|seller price expiresAt epoch fingerprint floors - seller 0 means unlisted;"
"market.owed|M|owed(address)|r|d|;"
```

Two things worth saying in the notes if the gas cap allows: `list` wants
the LIVE fingerprint (the console reads `getStateFingerprint(id)` and
sends it unchanged), while `buy` wants the PINNED one
(`listingOf(id).fingerprint`, which equals the live value only while
nothing has moved — the console should compare the two and refuse to
build the slab when they differ, as it does for the epoch under F7); and
`buy` is payable with `value == price` exactly, nothing refunded because
nothing is kept. `MAX_FLOORS`, `MAX_LISTING`, `HUB` and `POOL` need no
row. The error table gains IMarket's fifteen errors; the topic table the
four events (`OrderPosted`, `Delisted`, `Sold`, `Claimed`).

## Interface additions (`docs/INTERFACE-CHANGES.md`)

None. `IMarket.sol` is implemented exactly as frozen. `Market.ZeroAddress()`
is a contract-local constructor error, not an interface change.

## Requests to other files

- **`docs/INVARIANTS.md` and DESIGN.md §14**: the C6 row above (I do not edit either).
- **DESIGN.md §15**: decision 37 — a dead listing is anyone's to clear; the fingerprint is verified before the lock and pinned after it; floors are checked at listing.
- **`src/Catalog.sol` (`CatalogRows.SERVICES`)**: the six `market.*` rows are already placed; only the notes above are suggested, measured against the gas cap; IMarket's errors to the error table.
- **`tools/deploy.mjs` / `deployments/*.json` (U10's file)**: deploy `Market(hub, pool)` with the hub's `IntactConfig.market` set to its predicted address (the Pool exists before the hub, so the only prediction the Market needs is the hub's, which the deployer already makes); record the address, the constructor arguments and the codehash.
- **`test/helpers/Deploy.sol` `bundleConfig`** (U1's file): pin `market: address(theMarket)` once the Market is in the bundle, deploying it after the Pool and before the hub (one more prediction, `n + 6`), so `test/Bundle.t.sol` can add the sale to the holder's journey (`test_sellingTheTokenSells…` through the Market instead of `transferFrom`).
- **`docs/CONSOLE.md` / the vault panel (U9/U17)**: the sell flow proposes `list` with the two seals (BUILD-PLAN's done-criterion for U15 names it): read `getStateFingerprint(id)` live for `list`; for `buy`, read `listingOf(id)`, compare its `fingerprint` with the live one and its `epoch` with `custodyEpoch(id)` immediately before Sign (F7), and send `value = price` exactly. The listing is a token-level object for `Catalog.stateOf` (`listingOf(id)` words: seller, price, expiresAt, epoch, fingerprint).
- **`tools/verify-findings.mjs` (U12's file)**: A's CRITICAL #1 ("a malicious seller strips the agent during settlement") now has a counterpart; the row can be replayed against `Market` as `test_aMaliciousSellerHasNoWindow` does (refuted on HEAD: the seller is never called during the fill; reproduced against a variant that pushes `price − royalty` to the seller before `moduleTransfer`).
- **`tools/forge.mjs` (U0/U12)**: `expectRevert(bytes)` is recorded as `{ any: true }` and so matches any revert, while forge compares the data. Every suite that writes `vm.expectRevert(abi.encodeWithSelector(E.selector, args))` is pinning less than it reads as pinning. A data comparison (`got === expected`, or at least the selector prefix as the `bytes4` form does) would tighten every such assertion in the tree; this suite compares revert data by hand where the arguments are the evidence.

## Observations

- **The fingerprint covers the owned market's reserves**, so while a listed token's market is open, any trade on it — by anyone — moves the fingerprint and refuses the fill until the seller relists (`test_buyRevertsOnAnyFingerprintChange` shows it with a stranger's swap). That is DESIGN §11.1's definition and the buyer's protection, and it is also a cheap way to hold off a sale on a token whose market trades. A v2 could pin a fingerprint that excludes reserves (`marketHash` minus `rBase`/`rQuote`) or let the seller choose which components to pin; v1 states it.
- **The post-move floor re-check is unobservable here.** No callback runs between the first read and the second (the hub's `moduleTransfer` has none; a token's `balanceOf` is a staticcall), so deleting either one of the two `_requireFloors` calls is masked by the other; the guard that the suite kills is the comparison inside `_requireFloor`. The second call is kept as Pixel-Garden's rule for the day a hub grows a hook; it costs one loop.
- **`extcodesize` before the balance staticcall is redundant with the 32-byte length check** for a codeless asset (an empty return is not 32 bytes), and the `ok` flag only matters for a revert whose data is exactly 32 bytes. Both are kept as the CLAUDE.md idiom ("`extcodesize` AND a low-level staticcall"); neither deletion is caught alone.
- **The seal and the floors cover different things.** The Reach's seal polices the manifest; an asset the seller never promised can leave through `execute` under the seal — and that path bumps the Reach's state, so the fingerprint refuses the fill before the floor is even read. A floor earns its keep where a balance moves with no Reach action at all: a rebase, an admin seizure, a pausable token; `test_aBrokenFloorRefusesTheSale` uses `RebasingToken.rebase` for exactly that reason. Ether cannot leave a sealed Reach (`ValueWhileSealed`), so the native floor test lowers the balance with `vm.deal`.
- **A self-purchase is allowed**: it is a custody change like a self-transfer (the epoch moves, nothing revives) and it pays the royalty. Refusing it would need an error the frozen interface lacks.
- **The listing's lock and the Steward.** A live listing blocks `stewardTransfer` (`IsLocked`) exactly as the Steward's own notice blocks a sale; the decision that a dead listing is anyone's to clear is what keeps the two from deadlocking an estate.
- **Gas**: a fill with 64 floors on two kinds of asset runs in the suite (`test_sixtyFiveFloorsAreRefused` fills one); each floor is one `extcodesize` and one staticcall, read twice.
