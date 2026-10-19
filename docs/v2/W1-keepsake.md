# W1 — Keepsake (bundles you keep or give, that free slowly and sell slowly)

V2 wave 1, unit W1 (docs/V2.md §3.1). Branch `worktree-agent-a1b85fac1a36cc6cd`,
from the wave-0 head b676ee0 ("V2 wave 0 freezes eight interfaces…").
Files owned and written, all new:

| File | What it is |
|---|---|
| `src/Keepsake.sol` | the contract: `IKeepsake` exactly as frozen in wave 0, on `ERC721Base` |
| `src/KeepsakeArt.sol` | its stateless renderer: the orb, the arc, the HTML page |
| `test/Keepsake.t.sol` | the suite, 47 tests (2 fuzzed) |
| `test/mocks/KeepsakeFixtures.sol` | `KeepsakeHolder` (a contract holder that refuses ETH or re-enters) and `KeepsakeShortPool` (a venue that ignores `minOut`) |
| `tools/verify-keepsake.mjs` | the verifier, 81 sentences |
| `docs/v2/W1-keepsake.md` | this report |

No frozen file was edited. No interface changed. The transient slot
(`Transient.KEEPSAKE_LOCK`, `intact.keepsake.lock`) was registered in wave 0.

## What was built

A keepsake is an ERC-721 (ERC721Base, ids from 1) whose token holds 1–8
assets — native ETH as `address(0)`, ERC-20s pulled by exact delta — under
one schedule. Nothing frees before `cliff`; from the cliff the line runs from
`start` to `end`, rounded down; everything is free at `end`. Whoever holds the
token is paid what has freed.

- `wrap(Wrap)` payable → id. 1..8 assets (`NoAssets`, `TooManyAssets`), each
  amount > 0 (`ZeroAmount`), distinct tokens (`DuplicateAsset(token)`), ETH
  equal to `msg.value` to the wei, zero when there is no ETH asset
  (`WrongValue(expected, provided)`), ERC-20s by `ExactERC20.transferFromExact`
  (a fee-on-transfer token is refused `InexactERC20Transfer`, never recorded
  short), `to` neither zero nor the Keepsake itself (`ZeroRecipient`),
  message ≤ 280 bytes (`MessageTooLong(length)`). Schedule: `start == 0` →
  now, `cliff == 0` → start, `end` through `Ratchet.raise(0, end, MAX_TERM)`,
  then `start ≥ now` and `start ≤ cliff ≤ end` (`BadSchedule`). A drip at
  wrap (`drip.floor != 0`) only when `to == msg.sender` (`BadDrip`). The mint
  is ERC721Base `_mint`: no receiver is asked, so a gift is never refused by
  the code it is given to (a Reach, a multisig, a 7702 account, a contract
  with no `onERC721Received` — `test_aGiftIsNeverRefusedByTheRecipientsCode`).
  `Wrapped(id, creator, to, start, cliff, end, assets, message)`.
- `swapAndWrap(SwapAndWrap)` payable → (id, out). The input is the market's
  base when `baseIn`, else its quote; native input is `msg.value == amountIn`,
  an ERC-20 input `msg.value == 0` and an exact pull; an exact approval to the
  Pool, proved spent (this contract's input balance fell by exactly
  `amountIn`, else `TransferFailed`) and proved zero after; `Pool.swapExactIn(…,
  to = this, deadline)`; `out` by balance delta, > 0 and ≥ `minOut`; one asset
  `(tokenOut, out)` wrapped with the same schedule, message and drip rules
  (`drip.asset` must be 0, and a drip only for `to == msg.sender`).
- `claim(id)` — anyone; pays `ownerOf(id)` every freed amount
  (`freed − paid − sold`) and every proceed; `NothingFreed` when all are zero;
  `Paid(id, holder, token, amount)` per payment; ETH by call, and a holder
  that refuses ETH reverts the claim `TransferFailed`. An ERC-20 that will not
  move is left owed and the rest of the claim goes on (see the decision below).
  Returns what it paid.
- `claimable(id)` → (per asset: token and what a claim would pay now; every
  registered proceeds token and its amount).
- `extend(id, newEnd)` — the holder only (`ownerOf == msg.sender`; an approved
  operator is refused `NotHolder`); refused once the end has passed
  (`BadSchedule`); `Ratchet.raise(end, newEnd, MAX_TERM)` (`RatchetOnly`,
  `TooLong`); a cliff equal to the end moves with it; moves the holder's
  commitment; `Extended(id, previous, new)`.
- `setDrip(id, DripTerms)` / `clearDrip(id)` — the holder only. Valid terms:
  `floor > 0`, `maxPerDrip > 0`, `asset < n` (`BadDrip`), the market open with
  the asset's token on one side (`WrongMarket(market)`); the other side is
  registered as a proceeds token, at most 8 per keepsake (`TooManyAssets`).
  Clearing nothing is `NoDrip`. Both move the holder's commitment; `DripSet`,
  `DripCleared`.
- `drip(id)` — anyone; `NoSuchKeepsake`, `NoDrip`, `OnePerBlock` (per
  keepsake); `sold = min(free, maxPerDrip)`, `NothingFreed` if 0; the market's
  pair re-read and required to be exactly {asset, proceeds token}
  (`WrongMarket`); `minOut = ceil(sold × floor / 1e18)` (`Mul.mulDivUp`);
  `lastDripBlock` and `sold` written before the swap; `_swap` as above (native
  input is the keepsake's own freed ETH, sent as value from this contract's
  balance); `got` by balance delta; `BelowFloor(got, minOut)` when short, beside
  the Pool's own `Slippage`; proceeds credited; `Dripped(id, by, tokenIn, sold,
  tokenOut, got)`. A Pool refusal reverts the drip with the Pool's error.
- `keepsakeOf(id)` → the whole `KeepsakeView`; `commitmentOf(account)`;
  `keepsakeCount()`; `MAX_ASSETS()` 8, `MAX_TERM()` 3,650 days,
  `MAX_MESSAGE()` 280; `POOL()`, `HUB()`, `ART()`; `name()` "Keepsake",
  `symbol()` "KEEPSAKE"; ERC-165 for ERC-165, ERC-721, ERC-721 Metadata and
  `type(IKeepsake).interfaceId`.
- `tokenURI(id)` — ERC-6093's `ERC721NonexistentToken` for an unknown id;
  otherwise the Keepsake reads its own facts (the view, what is free now,
  the freed share in thousandths) and hands them to `KeepsakeArt.render`:
  `data:application/json;base64,` of `{"name":"Keepsake #<id>",
  "description":<the message, Web.jsonEsc>, "image":"data:image/svg+xml;base64,…",
  "animation_url":"data:text/html;base64,…", "attributes":[Assets (number),
  Cliff (date, unix seconds), End (date, unix seconds)]}`. The image is an orb:
  one hue per asset (`keccak256(token) mod 360`) blended into a radial gradient
  and set in orbit, and the freed share of the schedule as an arc from the top
  (`pathLength=1000`, `stroke-dasharray="<permille> 1000"`). The page shows the
  orb, the message (`Web.esc`), "a gift from 0x…" when the creator is not the
  holder, a row per asset (held, free now) and per proceeds token, the release
  line (flat to the cliff, a step onto the line, the line to the end) with a
  marker at now, and no script.
- `receive()` accepts ETH only from the Pool and only inside this contract's
  own lock — a swap's output — and refuses anything else `WrongValue(0, value)`.
- Every door that writes (`wrap`, `swapAndWrap`, `claim`, `extend`, `setDrip`,
  `clearDrip`, `drip`) runs under `Transient.KEEPSAKE_LOCK`. No owner, no fee,
  no pause, no setter, no sweep, no burn, no upgrade.

## Decisions, each with its reason

1. **The art is its own contract** (`src/KeepsakeArt.sol`). With the face
   inside, the Keepsake measured 24,737 B (tools/compile.mjs in the pruned
   copy, 2026-10-19) — 161 B over EIP-170. Shaving the face to fit would have
   left the contract that holds other people's money with no room for its
   guards; split, it sits 8,540 B under the ceiling (sizes below). The renderer is
   pure presentation: no storage, no owner, no pin; `Keepsake.tokenURI` reads
   the ledger and hands it the facts, so the picture can never disagree with
   the books, and a page that calls `render` directly with other facts gets a
   picture of those facts and nothing else. Consequence: the constructor is
   `Keepsake(hub, pool, art)` (the decided "+ the art contract's address"), and
   the contract exposes one getter beyond `IKeepsake`, `ART()`.
2. **Ratchet's errors are raised as Ratchet raises them.** `Ratchet.RatchetOnly()`
   and `Ratchet.TooLong()` have the same selectors as `IKeepsake`'s
   `RatchetOnly()` and `TooLong()`, so the ABI a page decodes names them
   either way; keeping the one rule's own refusal means the page prints the
   one sentence it prints for every seal and lock (an end that is now or past
   → `RatchetOnly`, past ten years → `TooLong`; asserted in
   `test_theScheduleTakesItsDefaultsAndRefusesWhatIsNotASchedule`). The order
   of the three dates is a schedule question and is `BadSchedule`.
3. **The schedule check is `start ≥ now`, `start ≤ cliff ≤ end`.** "`end > start`
   unless all three are equal" is implied: `end == start` squeezes the cliff
   between them. The line's division is reached only when `cliff ≤ now < end`,
   which gives `end > start`, so it never divides by zero.
4. **`extend` is refused once the end has passed** (`BadSchedule`, the
   interface's schedule error; Locks used `UnsupportedSchedule`): a kept
   promise lengthened is a new promise wearing an old id. **A cliff equal to
   the end moves with the end** — Locks' rule for a cliff lock — so a
   keepsake that frees all at once still frees all at once, later
   (`test_aKeepsakeThatFreesAtOnceStillFreesAtOnceWhenExtended`); otherwise
   the start and the cliff stay, the slope flattens, nothing paid is clawed
   back, and what is free reads zero until the new line catches up
   (`test_extendOnlyLengthens`). Either way the freed amount at every moment
   is at most what it was.
5. **One refusing token never locks the bundle beside it.** The decided
   `claim` pays every freed amount and every proceed, ETH by call with
   `TransferFailed` on refusal — kept: a holder that refuses ETH chose that
   code and can move the keepsake to an address that accepts. An ERC-20 that
   will not move is different: it may be paused, or may have frozen this very
   contract (a stablecoin blacklisting the Keepsake), and no holder can fix
   that; with all-or-nothing payouts the ETH and every other token wrapped
   beside it would be frozen with it, for ever. So an ERC-20 is paid by a raw
   `transfer` whose answer is not believed: **what left this contract's
   balance is what is paid** (two one-word `balanceOf` staticcalls under a
   100,000-gas stipend, the transfer's return data never copied). A token
   that reverts, answers false without moving, is frozen, or cannot say its
   balance leaves its amount freed and owed and the claim goes on
   (`test_aRefusingTokenNeverLocksTheRestOfTheBundle`); a token that moves and
   answers `false` is counted by what moved, so it is never paid twice out of
   what other keepsakes hold (`test_aTokenThatMovesAndAnswersFalseIsCountedByWhatMoved`
   — the reason the answer is not believed); a token that moves less than
   asked (a fee switched on later) leaves this contract holding more than it
   owes, never less. A claim that owed something and moved nothing reverts
   `TransferFailed`; one that owed nothing reverts `NothingFreed`. The cost:
   a token that burns all the gas it is given makes the presser pay for it
   (the transfer is not given a stipend, because an honest transfer with
   hooks may need much more than any stipend would allow).
6. **A drip re-reads its market's pair at every drip.** An owned Pool market
   can be emptied, closed and reopened as another pair; the floor is a price
   between exactly two tokens. The pair must be {asset, proceeds token} in
   either orientation, else `WrongMarket(market)` — even when the asset still
   trades there against something else (`test_aDripIntoAMarketWhosePairMovedIsRefused`).
   It costs one `marketOf` read per drip — an external view that copies the
   whole `Market` struct — inside the drip's measured total below.
7. **`minOut` rounds up, and the floor is checked twice.** `ceil(sold × floor /
   1e18)` by `Mul.mulDivUp` (512-bit, so no floor or amount overflows the
   product), handed to the Pool as `minOut` (its `Slippage` refuses a short
   fill first) and checked again against what arrived (`BelowFloor`), which is
   reachable only through a venue that lies — hence `KeepsakeShortPool`.
8. **Proceeds tokens are an append-only list of at most eight per keepsake,**
   registered when a drip names them (`TooManyAssets` past eight); a drip into
   a token already registered reuses its line. A slot is never recycled: a
   list that only grows needs no compaction and cannot be reordered under a
   pending claim. The holder alone grows it.
9. **ETH arrives only as a swap's output** — from the Pool, inside this
   contract's own lock — and anything else is refused `WrongValue(0, value)`
   (the Router's precedent): no function here could ever return a stray
   balance, so refusing beats stranding. `msg.value` at wrap is the ETH asset
   to the wei for the same reason.
10. **The commitment's terms hash is the mutable terms, not the assets.**
    `c[a] = keccak256(abi.encode(c[a], id, keccak256(abi.encode(uint64 start,
    uint64 cliff, uint64 end, uint8 dripAsset, uint256 market, uint256 floor,
    uint256 maxPerDrip))))`, folded on a transfer out (`_beforeMove` with
    `from != 0`, account = `from`) and on `extend`, `setDrip`, `clearDrip`
    (account = the holder), after the change. The assets are fixed under the
    id for ever, so the id stands for them; `paid`, `sold`, `proceeds` and
    `lastDripBlock` are what a stranger can move and are left out. A drip set
    *at* wrap is part of the keepsake's birth — a keepsake arriving — and moves
    nothing. Tests recompute the value by this formula
    (`test_aTransferOutMovesTheSendersCommitment`,
    `test_theCommitmentMovesOnTheHoldersTermsAndNeverOnAStrangersActs`).
11. **This contract is never a holder.** `wrap` refuses it as a recipient
    (`ZeroRecipient`) and a transfer to it is refused in `_beforeMove` with
    ERC-6093's `ERC721InvalidReceiver` — it could claim nothing (its own
    `receive` refuses the ETH), so a keepsake sent there would be lost to
    everyone.
12. **A zero pin at construction is `Keepsake.ZeroAddress()`**, a contract-level
    error as in `Market.sol` (`IKeepsake` declares none for it).
13. **`claimable`'s per-asset figure is what a claim would pay**
    (`freed − paid − sold`), every asset listed with zeros; `keepsakeOf.proceeds`
    lists every registered proceeds token, zeros included, so a page can index
    both by position.
14. **The face escapes by whitelist.** `Web.jsonEsc` and `Web.esc` keep printable
    ASCII and drop everything else, so a message with non-ASCII text loses those
    characters on the face; the raw message stays whole in `keepsakeOf` and in
    `Wrapped`, for a page to render through `textContent`.
15. **The verifier runs on PoolFixtures' hub stand-in**, not `deploySite`. The
    Keepsake asks the hub nothing, and the Pool asks it only `ownerOf`,
    `account` and `feeSink`, which `PoolHub` answers with the hub's semantics;
    the whole site would add a three-minute compile and a `dist/` build for no
    extra evidence about this contract. The real hub meets the Keepsake in W6.

## Measured

All counts and gas figures below are from runs on 2026-10-19 against the
final sources (Keepsake.sol sha256 `2fd313a0…a6e46e`).

| What | Where, and which run | Result |
|---|---|---|
| `node tools/compile.mjs` — all of `src/`, the EIP-170 gate | this worktree, 2026-10-19 13:44 (260.9 s cold) | every gated contract fits under 24,576 B; **Keepsake 16,036 B**, **KeepsakeArt 11,207 B** (the same renderer source measured 11,199 B in the pruned copy's smaller compile: viaIR's output moves a little with the compilation set, so this worktree's figure is the one to quote) |
| `node tools/static-audit.mjs`, and `--selftest` | this worktree, 2026-10-19 | passed (10 Solidity rules, 4 JS rules); the self-test fails its fixture on 5 findings |
| `node tools/forge.mjs --match Keepsake` | the pruned copy `/tmp/v2-keepsake`, 2026-10-19, on the final sources | **47 passed, 0 failed** (the two fuzzed tests 24 runs each, seed 20260727) |
| `node tools/verify-keepsake.mjs` | the pruned copy, and this worktree against all of `src/` and `test/mocks/` (2026-10-19 ≈13:48, after the compile above) | **81 passed, 0 failed** in both |
| the mutation gate (below) | `/tmp/v2-keepsake-mut`, 2026-10-19 05:52:32 – 07:29:31 | **33 killed, 0 survived, 0 not applied** |

Gas, from this worktree's verifier run (2026-10-19 ≈13:48). Transactions are
totals, intrinsic gas included, and every one is under EIP-7825's 2^24; the two
`tokenURI` figures are a view's execution gas, against the 8,000,000 a
`tokenURI` may cost (DESIGN §5.5):

| Operation | Gas |
|---|---|
| `wrap`, three assets (ETH and two ERC-20s), the first keepsake ever wrapped (fresh storage throughout) | 409,621 |
| `claim`, three assets, a stranger pressing | 204,555 |
| `swapAndWrap`, 1 ETH in, TOK locked, a drip set in the same call | 341,533 |
| `drip`, 200 TOK sold for ETH | 172,538 |
| `tokenURI`, the three-asset gift | 406,042 |
| `tokenURI`, eight assets, one of them a token that burns all the gas it is given | 547,280 |

## Tests — `test/Keepsake.t.sol` (47: 45 + 2 fuzzed)

Wrapping and giving: `test_aGiftIsMintedToTheRecipientWithItsMessage`,
`test_aGiftIsNeverRefusedByTheRecipientsCode`,
`test_aGiftDoesNotMoveTheRecipientsCommitment`,
`test_aTransferOutMovesTheSendersCommitment`,
`test_aKeepsakeCannotBeGivenToTheKeepsakeItself`,
`test_theCommitmentMovesOnTheHoldersTermsAndNeverOnAStrangersActs`,
`test_wrapRefusesAWrongEthValue`, `test_wrapRefusesADuplicateAsset`,
`test_wrapTakesEightAssetsAndRefusesNine`,
`test_wrapRefusesAZeroAmountAZeroRecipientAndALongMessage`,
`test_theScheduleTakesItsDefaultsAndRefusesWhatIsNotASchedule`,
`test_aFeeOnTransferTokenIsRefusedNeverRecordedShort`,
`test_aDripAtWrapIsOnlyForAKeepsakeYouKeep`.

Releasing: `test_nothingFreesBeforeTheCliffAndTheLineStartsFromTheStart`,
`test_claimableGrowsLinearlyAndAClaimPaysTheHolderAndNobodyElse`,
`test_everythingFreesAtOnceWhenTheThreeDatesAreEqual`,
`test_aTransferredKeepsakePaysItsNewHolder`,
`test_aRefusingTokenNeverLocksTheRestOfTheBundle`,
`test_aTokenThatMovesAndAnswersFalseIsCountedByWhatMoved`,
`test_aHolderThatRefusesEthRevertsTheClaim`,
`testFuzz_aClaimPaysTheLineAndEverythingByTheEnd` (any schedule, any two
moments: paid is the line rounded down, everything by the end).

The lock: `test_aHostileTokenCannotReenterClaimFromInsideAPull` (HostileToken
mode 7 re-enters `claim` from inside `wrap`'s pull — the frozen mock re-enters
only from `transferFrom`, so the pull is where it can reach claim's lock),
`test_aHostileTokenCannotReenterADripFromInsideAPull`,
`test_aHolderReenteringFromInsideItsOwnClaimIsRefused` (the nested refusal
kept byte for byte: `Reentrancy()`), `test_unsolicitedEthIsRefused`.

The holder's terms: `test_onlyTheHolderMayExtendAndNeverAnOperator`,
`test_extendOnlyLengthens`, `test_aKeepsakeThatFreesAtOnceStillFreesAtOnceWhenExtended`,
`test_onlyTheHolderMaySetOrClearADrip`,
`test_aDripNeedsAFloorAMostAndAMarketThatTradesTheAsset`.

The drip: `test_aDripSellsWhatHasFreedAtOrAboveTheFloor`,
`test_aDripNeverSellsMoreThanHasFreedAndIsUnpaid`,
`test_oneDripPerBlockPerKeepsake`, `test_theFloorRoundsTheMinimumUp` (the
Pool's `Slippage` data names `ceil(sold × floor / 1e18)` exactly),
`test_aDripBelowTheFloorIsRefusedEvenIfTheVenueWouldFillIt` (`BelowFloor` a wei
under, lands at the floor exactly), `test_aDripIntoAMarketWhosePairMovedIsRefused`,
`test_aDripOfNativeEthSellsTheKeepsakesOwnEth`,
`test_aKeepsakeHoldsAtMostEightProceedsTokens`,
`testFuzz_aDripNeverExecutesBelowItsFloor` (floors 50–150 % of the price, any
most, any price move first: a drip lands at or above its floor or sells
nothing).

Swap and wrap: `test_swapAndWrapLocksExactlyWhatTheSwapDelivered`,
`test_swapAndWrapRefusesTheWrongValue`, `test_swapAndWrapRespectsMinOutAndTheDeadline`,
`test_swapAndWrapSetsADripOnlyOnItsOutputAndOnlyForYou`.

Reading: `test_anUnknownKeepsakeIsRefusedByName`, `test_tokenURIIsABase64JsonDocument`
(a HostileToken in mode 6 — burning all gas on any call — never stops the face),
`test_theConstantsAndThePins`, `test_aZeroPinIsRefusedAtConstruction`.

Two harness facts the suite had to respect (CLAUDE.md's traps, met in
practice): every refusal with arguments is asserted from a raw call's data;
and block numbers after a `vm.roll` are read from the Keepsake's own
`lastDripBlock` — a `b0 = block.number` taken before the roll was re-read by
the optimiser after it, and `b0 + 1` named the wrong block.

## Verifier — `tools/verify-keepsake.mjs`

Deploys `PoolHub`, the real `Pool`, `KeepsakeArt`, `Keepsake`, three tokens and
a TOK/ETH market, then walks: a bundle of ETH and two ERC-20s wrapped as a
gift (the id from the mint's `Transfer` log; `Wrapped` read from the logs);
the recipient's and the giver's commitments unmoved; the line at a quarter and
at half; a stranger's claim paying only the holder (three `Paid` logs naming
it); `swapAndWrap` locking exactly what the market quoted, with its drip set in
the same signature and the Pool's allowance back to zero; a drip at or above
`ceil(sold × floor / 1e18)`, the keeper paid nothing, `Dripped` naming both
legs, a second drip in the same block refused `OnePerBlock()`, the next
block's landing; a 200,000-TOK trade moving the price below the floor and the
drip refused by the Pool's `Slippage` naming the rounded-up minimum, selling
nothing; extend and clear moving the holder's commitment and a stranger
refused; both faces decoded — valid JSON, an SVG image that is well formed,
an HTML page that is well formed and carries no script, the message
JSON-escaped and read back whole, HTML-escaped on the page, a token whose
symbol is `<script>alert(1)</script>` printed as text; the books (every
token held equals what every keepsake owes of it); and the ABI, which names
no owner, pause, upgrade, sweep or burn.

## Mutation evidence

One-token mutations of `src/Keepsake.sol`, each aimed at one guard: the
fifteen the brief names — (a) `a`, (b) `b`, (c) `c`, (d) `d`, (e) `e`,
(f) `f`, (g) `g`, (h) `h`, (i) `i`, (j) `j`, (k) `k`, (l) `l`, (m) `m`,
(n) `n`, (o) `o` — each with a second form where one guard has two faces
(`a2`, `b2`, `d2`, `e2`, `f2`, `g2`, `m2`, `n2`, `n3`, `o2`), and eight more
for the guards this unit added (`p`–`w`). A driver (in W1's scratch directory,
not committed) wrote each mutant over the file in `/tmp/v2-keepsake-mut` — a
copy of the pruned tree that nothing else compiles — ran
`node tools/forge.mjs --match Keepsake`, recorded the named tests that failed,
restored the file, and at the end proved it byte-identical by sha256. The
campaign ran from 05:52:32 to 07:29:31 on 2026-10-19 (three to four minutes a
mutant on four shared cores) and wrote its record only under
`scratchpad/w1-keepsake/`. **No row comes from the 05:18–05:42 window** in
which W2's gate and W1's first, abandoned campaign overwrote each other's
`mutations.json` and `mutations.log` in the shared scratchpad's root (see
Observations): that campaign's one result was discarded, and its row `a` was
run again here. After the campaign every Solidity file in both copies — 50 in
each — was compared with this worktree's: identical, nothing left mutated.

| # | Guard | Mutation | Verdict | Killed by |
|---|---|---|---|---|
| a | the cliff comparison | `(block.timestamp < cliff) return 0;` → `(block.timestamp <= cliff) return 0;` | killed (44 passed, 3 failed) | `test_aKeepsakeThatFreesAtOnceStillFreesAtOnceWhenExtended`, `test_everythingFreesAtOnceWhenTheThreeDatesAreEqual`, `test_nothingFreesBeforeTheCliffAndTheLineStartsFromTheStart` |
| a2 | the cliff comparison (the cliff dropped) | `block.timestamp < cliff) return 0;` → `block.timestamp < start) return 0;` | killed (44 passed, 3 failed) | `testFuzz_aClaimPaysTheLineAndEverythingByTheEnd`, `test_aKeepsakeThatFreesAtOnceStillFreesAtOnceWhenExtended`, `test_nothingFreesBeforeTheCliffAndTheLineStartsFromTheStart` |
| b | the linear formula (elapsed from the start) | `block.timestamp - start, end - start)` → `block.timestamp - cliff, end - start)` | killed (45 passed, 2 failed) | `testFuzz_aClaimPaysTheLineAndEverythingByTheEnd`, `test_nothingFreesBeforeTheCliffAndTheLineStartsFromTheStart` |
| b2 | the linear formula (rounded down) | `Mul.mulDivDown(amount, block.tim` → `Mul.mulDivUp(amount, block.tim` | killed (45 passed, 2 failed) | `testFuzz_aClaimPaysTheLineAndEverythingByTheEnd`, `test_nothingFreesBeforeTheCliffAndTheLineStartsFromTheStart` |
| c | holder-only extend | `  if (_holder(id) != msg.sender) reve` → `  if (_holder(id) == msg.sender) reve` | killed (43 passed, 4 failed) | `test_aKeepsakeThatFreesAtOnceStillFreesAtOnceWhenExtended`, `test_extendOnlyLengthens`, `test_onlyTheHolderMayExtendAndNeverAnOperator`, `test_theCommitmentMovesOnTheHoldersTermsAndNeverOnAStrangersActs` |
| d | extend only lengthens | `d = Ratchet.raise(previous, newEnd, MAX_TERM` → `d = Ratchet.raise(0, newEnd, MAX_TERM` | killed (46 passed, 1 failed) | `test_extendOnlyLengthens` |
| d2 | extend refused once the end has passed | `(block.timestamp >= previous) revert ` → `(block.timestamp > previous) revert ` | killed (46 passed, 1 failed) | `test_extendOnlyLengthens` |
| e | holder-only setDrip | `  if (_holder(id) != msg.sender) reve` → `  if (_holder(id) == msg.sender) reve` | killed (36 passed, 11 failed) | `testFuzz_aDripNeverExecutesBelowItsFloor`, `test_aDripIntoAMarketWhosePairMovedIsRefused`, `test_aDripNeedsAFloorAMostAndAMarketThatTradesTheAsset`, `test_aDripNeverSellsMoreThanHasFreedAndIsUnpaid`, `test_aDripSellsWhatHasFreedAtOrAboveTheFloor`, `test_aHostileTokenCannotReenterADripFromInsideAPull`, `test_aKeepsakeHoldsAtMostEightProceedsTokens`, `test_oneDripPerBlockPerKeepsake`, `test_onlyTheHolderMaySetOrClearADrip`, `test_theCommitmentMovesOnTheHoldersTermsAndNeverOnAStrangersActs`, `test_theFloorRoundsTheMinimumUp` |
| e2 | holder-only clearDrip | `  if (_holder(id) != msg.sender) reve` → `  if (_holder(id) == msg.sender) reve` | killed (45 passed, 2 failed) | `test_onlyTheHolderMaySetOrClearADrip`, `test_theCommitmentMovesOnTheHoldersTermsAndNeverOnAStrangersActs` |
| f | the floor's minOut rounds up | `inOut = Mul.mulDivUp(sold, floor, 1e18` → `inOut = Mul.mulDivDown(sold, floor, 1e18` | killed (45 passed, 2 failed) | `test_aDripBelowTheFloorIsRefusedEvenIfTheVenueWouldFillIt`, `test_theFloorRoundsTheMinimumUp` |
| f2 | the floor checked against what arrived | `if (got < minOut) revert BelowFloo` → `if (got < 0) revert BelowFloo` | killed (46 passed, 1 failed) | `test_aDripBelowTheFloorIsRefusedEvenIfTheVenueWouldFillIt` |
| g | one drip per block (the check) | `ripBlock == block.number) revert OnePerBlo` → `ripBlock == block.timestamp) revert OnePerBlo` | killed (46 passed, 1 failed) | `test_oneDripPerBlockPerKeepsake` |
| g2 | one drip per block (the record) | `ck = uint64(block.number);` → `ck = uint64(block.timestamp);` | killed (45 passed, 2 failed) | `test_aDripSellsWhatHasFreedAtOrAboveTheFloor`, `test_oneDripPerBlockPerKeepsake` |
| h | exact ETH value at wrap | `if (msg.value != eth) revert Wrong` → `if (msg.value < eth) revert Wrong` | killed (46 passed, 1 failed) | `test_wrapRefusesAWrongEthValue` |
| i | duplicate-asset refusal | `for (uint256 j; j < i; ++j) {` → `for (uint256 j; j > i; ++j) {` | killed (46 passed, 1 failed) | `test_wrapRefusesADuplicateAsset` |
| j | MAX_ASSETS refusal | `if (n > MAX_ASSETS) rever` → `if (n >= MAX_ASSETS) rever` | killed (46 passed, 1 failed) | `test_wrapTakesEightAssetsAndRefusesNine` |
| k | the commitment moves on a transfer out | `if (from != address(0)) _tou` → `if (from == address(0)) _tou` | killed (46 passed, 1 failed) | `test_aTransferOutMovesTheSendersCommitment` |
| l | the commitment never moves on a transfer in | `ddress(0)) _touch(from, id);` → `ddress(0)) _touch(to, id);` | killed (45 passed, 2 failed) | `test_aGiftDoesNotMoveTheRecipientsCommitment`, `test_aTransferOutMovesTheSendersCommitment` |
| m | claim pays the holder (assets) | ` if (_send(token, holder, a)) {` → ` if (_send(token, msg.sender, a)) {` | killed (36 passed, 11 failed) | `testFuzz_aClaimPaysTheLineAndEverythingByTheEnd`, `test_aDripOfNativeEthSellsTheKeepsakesOwnEth`, `test_aDripSellsWhatHasFreedAtOrAboveTheFloor`, `test_aHolderReenteringFromInsideItsOwnClaimIsRefused`, `test_aHolderThatRefusesEthRevertsTheClaim`, `test_aHostileTokenCannotReenterClaimFromInsideAPull`, `test_aRefusingTokenNeverLocksTheRestOfTheBundle`, `test_aTokenThatMovesAndAnswersFalseIsCountedByWhatMoved`, `test_aTransferredKeepsakePaysItsNewHolder`, `test_claimableGrowsLinearlyAndAClaimPaysTheHolderAndNobodyElse`, `test_extendOnlyLengthens` |
| m2 | claim pays the holder (proceeds) | ` if (_send(token, holder, a)) {` → ` if (_send(token, msg.sender, a)) {` | killed (45 passed, 2 failed) | `test_aDripNeverSellsMoreThanHasFreedAndIsUnpaid`, `test_aDripSellsWhatHasFreedAtOrAboveTheFloor` |
| n | the lock on claim | `t256 id) external locked returns` → `t256 id) external  returns` | killed (45 passed, 2 failed) | `test_aHolderReenteringFromInsideItsOwnClaimIsRefused`, `test_aHostileTokenCannotReenterClaimFromInsideAPull` |
| n2 | the lock on drip | `t256 id) external locked returns` → `t256 id) external  returns` | killed (41 passed, 6 failed) | `test_aDripNeverSellsMoreThanHasFreedAndIsUnpaid`, `test_aDripSellsWhatHasFreedAtOrAboveTheFloor`, `test_aHostileTokenCannotReenterADripFromInsideAPull`, `test_oneDripPerBlockPerKeepsake`, `test_theCommitmentMovesOnTheHoldersTermsAndNeverOnAStrangersActs`, `test_theFloorRoundsTheMinimumUp` |
| n3 | the lock on wrap | ` external payable locked returns` → ` external payable  returns` | killed (45 passed, 2 failed) | `test_aHostileTokenCannotReenterADripFromInsideAPull`, `test_aHostileTokenCannotReenterClaimFromInsideAPull` |
| o | a drip sells at most what is free (the min) | `sold = a < most ? a : most;` → `sold = a > most ? a : most;` | killed (41 passed, 6 failed) | `test_aDripBelowTheFloorIsRefusedEvenIfTheVenueWouldFillIt`, `test_aDripNeverSellsMoreThanHasFreedAndIsUnpaid`, `test_aDripOfNativeEthSellsTheKeepsakesOwnEth`, `test_aDripSellsWhatHasFreedAtOrAboveTheFloor`, `test_oneDripPerBlockPerKeepsake`, `test_theFloorRoundsTheMinimumUp` |
| o2 | free excludes what was sold | `256 used = h.paid + h.sold;` → `256 used = h.paid * h.sold;` | killed (38 passed, 9 failed) | `testFuzz_aClaimPaysTheLineAndEverythingByTheEnd`, `test_aDripNeverSellsMoreThanHasFreedAndIsUnpaid`, `test_aDripOfNativeEthSellsTheKeepsakesOwnEth`, `test_aDripSellsWhatHasFreedAtOrAboveTheFloor`, `test_aRefusingTokenNeverLocksTheRestOfTheBundle`, `test_aTokenThatMovesAndAnswersFalseIsCountedByWhatMoved`, `test_aTransferredKeepsakePaysItsNewHolder`, `test_claimableGrowsLinearlyAndAClaimPaysTheHolderAndNobodyElse`, `test_extendOnlyLengthens` |
| p | the drip re-reads its market's pair | `.quote != tokenIn \|\| mk.base != tokenO` → `.quote != tokenIn && mk.base != tokenO` | killed (46 passed, 1 failed) | `test_aDripIntoAMarketWhosePairMovedIsRefused` |
| q | a refused ERC-20 payout stays owed | `h.paid -= a;              ` → `h.paid += a;              ` | killed (46 passed, 1 failed) | `test_aRefusingTokenNeverLocksTheRestOfTheBundle` |
| r | a payout counts only what left | `nAfter && after_ < before;` → `nAfter && after_ <= before;` | killed (46 passed, 1 failed) | `test_aRefusingTokenNeverLocksTheRestOfTheBundle` |
| s | ETH arrives only inside the lock | `sender != POOL \|\| !Transient.held(Tra` → `sender != POOL \|\| Transient.held(Tra` | killed (40 passed, 7 failed) | `test_aDripNeverSellsMoreThanHasFreedAndIsUnpaid`, `test_aDripSellsWhatHasFreedAtOrAboveTheFloor`, `test_oneDripPerBlockPerKeepsake`, `test_swapAndWrapLocksExactlyWhatTheSwapDelivered`, `test_theCommitmentMovesOnTheHoldersTermsAndNeverOnAStrangersActs`, `test_theFloorRoundsTheMinimumUp`, `test_unsolicitedEthIsRefused` |
| t | a drip at wrap only for a keepsake you keep | `if (w.to != msg.sender) reve` → `if (w.to == msg.sender) reve` | killed (44 passed, 3 failed) | `test_aDripAtWrapIsOnlyForAKeepsakeYouKeep`, `test_aDripBelowTheFloorIsRefusedEvenIfTheVenueWouldFillIt`, `test_aDripOfNativeEthSellsTheKeepsakesOwnEth` |
| u | the message cap | `if (len > MAX_MESSAGE) reve` → `if (len >= MAX_MESSAGE) reve` | killed (46 passed, 1 failed) | `test_wrapRefusesAZeroAmountAZeroRecipientAndALongMessage` |
| v | a start in the past is refused | `if (start < block.timestamp \|\| cliff < start ` → `if (start < 0 \|\| cliff < start ` | killed (46 passed, 1 failed) | `test_theScheduleTakesItsDefaultsAndRefusesWhatIsNotASchedule` |
| w | this contract is never a holder | `if (to == address(this)) revert ERC721In` → `if (to == address(0)) revert ERC721In` | killed (46 passed, 1 failed) | `test_aKeepsakeCannotBeGivenToTheKeepsakeItself` |

33 killed, 0 survived, 0 not applied, of 33.

Every mutant was killed by at least one named test; there is no survivor to
write up as a test request. Two kills are worth reading. `n2` (drip without its
lock) breaks honest drips too: `receive` accepts the Pool's ETH only while this
contract's lock is held, so the lock and the ETH guard hold each other up. And
`p` is killed by one test alone: only a market reopened with the asset still on
one side and a different token on the other makes the two halves of the pair
check disagree, which is why `test_aDripIntoAMarketWhosePairMovedIsRefused`
reopens it as DAI against TOK.

## Proposed INVARIANTS rows

Status for all: **pending (W1)** — each has been seen to fail under a one-token
mutation in the pruned copy (table above); it becomes **live** when
`tools/verify-keepsake.mjs` and `test/Keepsake.t.sol` run in `npm run check`
(wave-3 integration).

| Row | Claim | Cited by |
|---|---|---|
| K1 | Nothing frees before the cliff; from the cliff the line runs from the start to the end, rounded down; everything is free at the end; three equal dates free everything at once | `test/Keepsake.t.sol` · `test_nothingFreesBeforeTheCliffAndTheLineStartsFromTheStart`, `test_everythingFreesAtOnceWhenTheThreeDatesAreEqual`, `testFuzz_aClaimPaysTheLineAndEverythingByTheEnd`; `tools/verify-keepsake.mjs` · *"a quarter of the way along, a quarter of every asset is free"*, *"half of the way, half"* |
| K2 | `claim` is anyone's and pays only `ownerOf(id)` — every freed, unpaid, unsold amount and every proceed | `test/Keepsake.t.sol` · `test_claimableGrowsLinearlyAndAClaimPaysTheHolderAndNobodyElse`, `test_aTransferredKeepsakePaysItsNewHolder`, `test_aDripSellsWhatHasFreedAtOrAboveTheFloor`; `tools/verify-keepsake.mjs` · *"the holder received the free ETH"*, *"the stranger who pressed received nothing"*, *"three Paid logs, each naming the holder"* |
| K3 | What arrives is what is recorded: ERC-20s by exact pull, ETH equal to the ETH asset to the wei, no ETH accepted but a swap's output inside the lock, a swap's output by balance delta; the Keepsake holds exactly what it owes | `test/Keepsake.t.sol` · `test_wrapRefusesAWrongEthValue`, `test_aFeeOnTransferTokenIsRefusedNeverRecordedShort`, `test_unsolicitedEthIsRefused`, `test_swapAndWrapLocksExactlyWhatTheSwapDelivered`; `tools/verify-keepsake.mjs` · *"a wrap whose value is not the ETH asset is refused, naming both"*, *"what is held of ETH is what is owed of it"* |
| K4 | One refusing token never locks the rest of a bundle; an ERC-20 payout counts what left this contract, never what the token answered; a holder refusing ETH refuses its own claim | `test/Keepsake.t.sol` · `test_aRefusingTokenNeverLocksTheRestOfTheBundle`, `test_aTokenThatMovesAndAnswersFalseIsCountedByWhatMoved`, `test_aHolderThatRefusesEthRevertsTheClaim` |
| K5 | Nothing opens early: `extend` is the holder's alone (never an operator's), only lengthens (Ratchet, ≤ 10 y), is refused once the end has passed, and an all-at-once schedule stays all at once | `test/Keepsake.t.sol` · `test_onlyTheHolderMayExtendAndNeverAnOperator`, `test_extendOnlyLengthens`, `test_aKeepsakeThatFreesAtOnceStillFreesAtOnceWhenExtended`; `tools/verify-keepsake.mjs` · *"a stranger cannot extend"*, *"nor shorten, as the holder"* |
| K6 | `commitmentOf(a)` folds `(id, terms)` when a keepsake leaves `a` and when its holder `a` extends, sets or clears a drip; it never moves on a wrap or a transfer to `a`, a claim or a drip | `test/Keepsake.t.sol` · `test_aGiftDoesNotMoveTheRecipientsCommitment`, `test_aTransferOutMovesTheSendersCommitment`, `test_theCommitmentMovesOnTheHoldersTermsAndNeverOnAStrangersActs`; `tools/verify-keepsake.mjs` · *"the recipient's commitment is unmoved by the gift"*, *"the claim moved no commitment"*, *"and the commitment never moved for a drip"*, *"the holder's commitment moved with the terms"* |
| K7 | A drip never executes below its floor (`minOut = ceil(sold × floor / 1e18)`, checked by the Pool and again on arrival), never sells more than is freed and neither paid nor sold, at most `maxPerDrip`, once per block per keepsake, and only into a market that still trades exactly its asset against its proceeds token | `test/Keepsake.t.sol` · `test_aDripNeverSellsMoreThanHasFreedAndIsUnpaid`, `test_oneDripPerBlockPerKeepsake`, `test_theFloorRoundsTheMinimumUp`, `test_aDripBelowTheFloorIsRefusedEvenIfTheVenueWouldFillIt`, `test_aDripIntoAMarketWhosePairMovedIsRefused`, `testFuzz_aDripNeverExecutesBelowItsFloor`; `tools/verify-keepsake.mjs` · *"which is at or above ceil(sold x floor / 1e18)"*, *"a second drip in the same block is refused"*, *"the drip is refused by the Pool, which was asked for ceil(sold x floor / 1e18)"*, *"and sold nothing below it"* |
| K8 | Only the holder sets or clears a drip; at wrap and in `swapAndWrap` a drip is set only on a keepsake you keep, and in `swapAndWrap` only on its output | `test/Keepsake.t.sol` · `test_onlyTheHolderMaySetOrClearADrip`, `test_aDripAtWrapIsOnlyForAKeepsakeYouKeep`, `test_swapAndWrapSetsADripOnlyOnItsOutputAndOnlyForYou`; `tools/verify-keepsake.mjs` · *"a gift that would carry a drip is refused: a giver never sells a recipient's gift"* |
| K9 | One lock on every door: a claim, a drip or a wrap entered from inside a pull or a payout is refused `Reentrancy` | `test/Keepsake.t.sol` · `test_aHostileTokenCannotReenterClaimFromInsideAPull`, `test_aHostileTokenCannotReenterADripFromInsideAPull`, `test_aHolderReenteringFromInsideItsOwnClaimIsRefused` |
| K10 | A bundle is 1..8 distinct assets, each > 0, a message ≤ 280 bytes, a recipient that is neither zero nor the Keepsake, and a schedule that starts now or later with `start ≤ cliff ≤ end`; the mint asks the recipient's code nothing | `test/Keepsake.t.sol` · `test_wrapTakesEightAssetsAndRefusesNine`, `test_wrapRefusesADuplicateAsset`, `test_wrapRefusesAZeroAmountAZeroRecipientAndALongMessage`, `test_theScheduleTakesItsDefaultsAndRefusesWhatIsNotASchedule`, `test_aGiftIsNeverRefusedByTheRecipientsCode`, `test_aKeepsakeCannotBeGivenToTheKeepsakeItself` |
| K11 | The face is a base64 JSON data URI whose image is a well-formed SVG and whose page is well-formed HTML with no script; every chain string reaches it escaped | `test/Keepsake.t.sol` · `test_tokenURIIsABase64JsonDocument`; `tools/verify-keepsake.mjs` · *"keepsake #1: tokenURI is a base64 data URI of valid JSON"*, *"keepsake #1: the page is well formed and carries no script"*, *"the gift's description is its message, JSON-escaped and read back whole"*, *"a token whose symbol is markup is printed as text, never as markup"* |
| K12 | The Keepsake has no switches: no owner, pause, upgrade, sweep or burn, and its only setters are the holder's drip and ERC-721's operator approval | `tools/verify-keepsake.mjs` · *"no selector on the Keepsake names an owner, a pause, an upgrade, a sweep or a burn (30 functions read)"*, *"its only setters are the holder's drip and ERC-721's operator approval"* |

## Requests for frozen files

1. **`package.json`** — `"verify:keepsake": "node tools/verify-keepsake.mjs"`.
2. **`tools/check.mjs`** — a `verify:keepsake` step (summary `  N passed, M failed`)
   beside the other verifiers, so K1–K12 can go live.
3. **`docs/INTERFACE-CHANGES.md`** (a "V2 wave 1" section) — record, additively:
   `Keepsake`'s constructor is `(hub, pool, art)` and the contract adds `ART()`
   beyond `IKeepsake`; `Keepsake.ZeroAddress()` is a constructor-only error;
   `KeepsakeArt.render(uint256, KeepsakeView, Asset[], uint256)` is the
   renderer's surface; and `claim`'s per-asset isolation (decision 5) refines
   `IKeepsake`'s comment "pays the keepsake's holder every freed amount" to
   "every freed amount its token will move; one that will not stays owed".
4. **`test/Ratchet.t.sol`** — add `Keepsake.extend` to
   `test_everyRatchetOnlyLengthens`, as U14 asked for the custodian.
5. **`docs/INVARIANTS.md`** — the K-rows above (the integration step copies them).
   **`tools/invariants-check.mjs`** parses only ids matching `[A-H]\d+`, so a
   `K` row would be skipped, not checked: its id pattern (and its DESIGN §14
   parity walk) must learn V2's letters, and **`DESIGN.md` §14** (or a V2
   table beside it) needs the matching lines. The citations themselves were
   proved against the real checker: the twelve rows appended to a copy of the
   ledger under probe ids H901–H912, marked live, pass 12 of 12 (every test
   name and every sentence found), the one red line being the parity walk's
   "only in INVARIANTS", which is the probe's own doing.
6. **`tools/fuzz.mjs`** — docs/V2.md §8 asks for the drip's own fuzz property
   ("no drip ever executes below the floor"); `testFuzz_aDripNeverExecutesBelowItsFloor`
   is the forge-side version, and the property belongs in the battery's fuzzer too.
7. **`tools/agents.mjs`** — a keeper motive that presses `drip` and `claim` on
   other people's keepsakes, asserting K2 and K7 after every tick.
8. **`CLAUDE.md`** (traps) — one line: *Yul evaluates a call's arguments right
   to left, so `and(staticcall(…), gt(returndatasize(), 31))` reads the size of
   the previous call; bind the call to a variable first.* The suite caught it
   here (decision 5's first draft paid nothing for every honest token).

## What later waves must know

- **Deployment.** `KeepsakeArt()` first (no arguments, no state), then
  `Keepsake(hub, pool, art)`, all three non-zero. The constructor reads
  nothing from the hub or the Pool, so the Keepsake's address can be predicted
  and pinned by the V2 hub before it exists, like V1's satellites; `ART` must
  have code before the first `tokenURI`. The Pool is V1's, on the same band.
- **W6, the fingerprint term.** Read `commitmentOf(account(id))` with the
  `extcodesize` + low-level staticcall pattern (an absent Keepsake is "no
  answer", never a revert and never zero). The formula is decision 10. The
  Reach's own `execute` of `extend`, `setDrip`, `clearDrip` or a keepsake's
  `transferFrom` moves it — a listing then refuses the fill, as intended; a
  gift to the Reach, a claim or a drip by anyone never does. A keepsake in a
  Reach is an ERC-721 the Reach holds, governed by its seal like any other.
- **The console (W10, Vault).** Reads: `keepsakeOf(id)`, `claimable(id)`,
  `commitmentOf(account)`, `keepsakeCount()`, `tokenURI(id)`, the `MAX_*`
  constants, `POOL()`, `ART()`; a holder's keepsakes are found from `Transfer`
  logs (there is no enumeration). Writes: `wrap` (payable: exactly the ETH
  asset), `swapAndWrap`, `claim`, `extend`, `setDrip`, `clearDrip`, `drip`,
  and ERC-721 `transferFrom` (a gift by transfer). ERC-20s need an exact
  approval to the Keepsake (never ≥ 2^255). The floor is raw: output units per
  1e18 input units, so a human price P (output per one input) is
  `P × 10^decOut × 1e18 / 10^decIn`; the sentence before the signature should
  say "never sells below P OUT per IN". The error table needs `IKeepsake`'s
  errors, `Keepsake.ZeroAddress`, `ExactERC20`'s three, the Pool's refusals a
  drip or a swap bubbles up (`Slippage`, `Expired`, `MarketNotOpen`,
  `TradeTooLarge`, `ZeroAmount`), ERC-6093's, and `Mul.MulOverflow` (a floor so
  large its minimum overflows).
- **The Catalog.** A new letter in `CatalogRowsPost.SERVICES` (post-MVB rows
  go there; `B`, for bundle, is free in today's `HPRYTSKNLCOWXEGQMDAUI` — W6's
  choice). Proposed rows, in the table's own shape:

  ```
  wrap|B|wrap(((address,uint256)[],(uint64,uint64,uint64),address,string,(uint8,uint256,uint256,uint256)))|p|d|value is the ETH asset exactly, 0 when none - each ERC-20 needs an exact approval to the Keepsake - a drip only when to is you;
  swapAndWrap|B|swapAndWrap((uint256,bool,uint256,uint256,uint64,(uint64,uint64,uint64),address,string,(uint8,uint256,uint256,uint256)))|p|d|native input: value is amountIn - what is locked is the balance delta - a drip only on asset 0 and only for you;
  claim|B|claim(uint256)|w|d|anyone - pays ownerOf(id) only - a token that will not move stays owed;
  claimable|B|claimable(uint256)|r|d|per asset what a claim pays now - then every proceed;
  extend|B|extend(uint256,uint64)|w|d|holder only - only later - never once the end has passed - moves the commitment;
  setDrip|B|setDrip(uint256,(uint8,uint256,uint256,uint256))|w|d|holder only - floor is output per 1e18 input, never 0 - moves the commitment;
  clearDrip|B|clearDrip(uint256)|w|d|holder only - moves the commitment;
  drip|B|drip(uint256)|w|d|anyone - once per block - never below the floor;
  keepsakeOf|B|keepsakeOf(uint256)|r|d|holder creator createdAt schedule assets paid sold proceeds message drip lastDripBlock;
  commitmentOf|B|commitmentOf(address)|r|d|moves only on a keepsake leaving and on its holder's own term changes;
  keepsakeCount|B|keepsakeCount()|r|d|;
  ```

  The drift gate then holds the rows to the ABI.
- **W2 (Journal).** A memory about a keepsake names it with
  `ref = keccak(Keepsake, id)`; `Wrapped` carries the creator and the
  recipient indexed, so a gift's journal line can be written in the same
  batch as the wrap.
- **W5 (Agora) feed.** "Keepsake gifts by the tokens you follow" is
  `Wrapped` filtered on `creator` (topic 2) = a followed token's Reach.

## Observations

- The measured payout's first draft read `returndatasize()` before its
  `staticcall` ran (Yul's right-to-left arguments); ten tests failed with
  `TransferFailed` on honest tokens, and an in-process trace showed the
  `balanceOf` answering and no `transfer` following. Fixed by binding the call.
- The frozen `HostileToken` re-enters only from `transferFrom`; claim's lock is
  therefore attacked twice — through a pull (a token re-entering `claim` from
  inside `wrap`) and through a payout (a holder contract re-entering from the
  ETH it is paid, `KeepsakeHolder`).
- An ERC-721 whose `transferFrom` moves token 1 passes an exact pull of
  "amount 1" (its `balanceOf` rises by one). It could never be paid out (an
  NFT has no `transfer`), and decision 5 keeps that from locking anything
  else; the page should offer ERC-20s only.
- **The shared scratchpad, and what W1 did to W2's record.** The five units
  share one scratchpad directory. W1's first campaign (launched ≈ 05:40)
  redirected its output to `scratchpad/mutations.log`, truncating that file at
  launch, and wrote `scratchpad/mutations.json` after its first mutant
  (≈ 05:42–05:43) — the same two names W2's gate was writing. W1 killed that
  campaign, discarded its single result, and deleted `scratchpad/mutations.json`
  (≈ 05:47 and ≈ 05:49) when it held only W1's row; the root `mutations.log`
  (last written 05:42:53) was left as it was. Neither root file is evidence for
  W1 or for W2. Every row of W1's table above comes from the campaign started at
  05:52:32 (pid 23839), which wrote only under `scratchpad/w1-keepsake/` and
  mutated only `/tmp/v2-keepsake-mut`, a copy no other unit uses; all of W1's
  scratch files now live in `scratchpad/w1-keepsake/`, `/tmp/v2-keepsake/` and
  `/tmp/v2-keepsake-mut/`.
