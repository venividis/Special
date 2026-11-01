# W13 · the console suites' waits, made honest

V2 integration, unit W13: requests L1 and L2 of `docs/v2/INTEGRATION.md`.
W11 found the hole (`docs/v2/W11-social.md` §6, request 10). The shim's
`page.until` returned `false` on a timeout and threw nothing, and almost
every wait in the site suite dropped that answer. So a claim that only a
wait checked could not fail: W11's mutant W8 survived exactly that way.
Separately, `tools/verify-console.mjs`'s `visible()` called a field inside
a closed `<details>` visible (W12, `docs/v2/W12-studio.md` §6 item 7).

This unit owns `tools/dom-shim.mjs`, `tools/verify-site.mjs`,
`tools/verify-site/*.mjs`, `tools/verify-console.mjs` and this report. It
was built on 80ae2d1 on 2026-10-19. Every number below was measured on
this tree, and each says which run printed it.

## 1. What changed

### 1.1 A wait that times out throws, by name

`page.until(cond, tries = 200, { soft })` (`tools/dom-shim.mjs`) still
settles the page between polls. When `cond` is still falsy after `tries`
settles, it now throws an `UntilTimeout`. The message names:
- the number of settles;
- the group (the runner calls `setGroup(g)` before each group);
- the lines of the group file that waited: the helper that holds the wait
  (`press`, `sign`), then its caller. The stack is taken when the wait
  starts, while the helper is still on it;
- the condition's source, cut to one line;
- what the ticker read.

The group stops at the first wait that times out. The runner's catch prints
the message as that group's one failed line. This is one the
classification run printed, before the fix in §3:

```
until timed out after 160 settles in group vault, waiting at
tools/verify-site/vault.mjs:156 ← tools/verify-site/vault.mjs:468:
() => W.sent() === n && tick(page) !== before && /landed in block|reverted in block/.test(tick(page))
· the ticker reads "ownership or epoch changed — review again"
```

`{ soft: true }` keeps the old answer: `cond()`'s last value, and no
throw. It is for a wait whose caller reads the answer itself, or a
deliberate pause before a negative assertion. Each soft call says why in a
comment, and there are two (§2).

### 1.2 `visible()` is honest about a fold

`pg.visible(s)` and `pg.visibleAll(s)` (`tools/verify-console.mjs`) still
require a box with client rects and `visibility` not `hidden`. They now
also ask `checkVisibility({ visibilityProperty: true })`, and walk the
ancestors: under a closed `<details>`, only that details' own `<summary>`
is shown. Chromium hides a closed details' content with
`content-visibility` and keeps its client rects. That is why the box test
alone said yes. The walk says the same in plain DOM terms, so the rule does
not lean on one browser API.

### 1.3 Both changes prove themselves

- The boot group's new block W (`tools/verify-site/boot.mjs`) times out a
  wait on purpose. Its two sentences:
  - *"a wait that times out throws, naming its settles, its group, the
    lines that waited and its condition"*;
  - *"the soft form answers false where the wait would throw, and a wait
    that is met answers true"*.
- verify-console's boot group opens the mint slab, whose *the facts it
  signs* is a closed `<details>`. It reads the folded `To` row, opens the
  details by its summary, reads the row again, and closes it. Its sentence:
  *"the harness's visible() reads a row inside the slab's closed details as
  not visible, the details' summary and the gas row as visible, and the row
  as visible once the details is opened"*. With HEAD's `visible()` put back,
  this sentence fails (§8).

## 2. The waits, counted

The inventory is every `.until(` call site at 80ae2d1, counted by a scratch
script (§8) and cross-checked by `grep -o`.

| File | Call sites | Statements that drop the answer | Answer read |
|---|---|---|---|
| `tools/verify-site.mjs` (the runner's `lane`) | 1 | 1 | 0 |
| `tools/verify-site/agent.mjs` | 24 | 22 | 2 returned by helpers (`waitVerdict`, `ready`), whose callers drop them |
| `tools/verify-site/boot.mjs` | 6 | 5 | 1 raced against a propose |
| `tools/verify-site/gallery.mjs` | 24 | 24 | 0 |
| `tools/verify-site/identity.mjs` | 59 | 59 | 0 |
| `tools/verify-site/launch.mjs` | 90 | 90 | 0 |
| `tools/verify-site/social.mjs` | 69 | 69 | 0 |
| `tools/verify-site/swap.mjs` | 51 | 50 | 1 assigned and read |
| `tools/verify-site/vault.mjs` | 56 | 55 | 1 returned by `ready`, whose callers drop it |
| **verify-site** | **380** | **375** | 5 |
| `tools/verify-console.mjs` (its own `until`, Playwright's `waitForFunction`) | 129 | 122 | 7 |

W11 counted 279 dropped answers on the tree before W8 and W12 landed. The
brief said about 330. This tree has 375.

What became of the 380:

| Outcome | Call sites (of 380) | Where |
|---|---|---|
| Throw on a timeout, condition unchanged | 374 | every other call site |
| Soft | 2 | boot G′, the wait raced against `ui.propose` (a wait that loses the race must not throw after it; the next line reads `slabOpen()`). swap V5, `offered` (read by the next sentence, which then fails by name) |
| Longer | 0 | none timed out for want of settles |
| Condition corrected (the page was right, the wait was not) | 4 | the `sign` helpers of identity, vault and gallery, which take `moved` for the four calls of §3, and launch M's spacing wait: the five timeouts of §3 |
| Hid a real failure of a panel or the shell | **0** | §3 |

Every wait but the two soft ones throws. In Chromium, verify-console's own
129 waits are unchanged (§6).

The claims that only a wait had checked are now sentences: **22**, listed
in §4. Of these, 18 are existing sentences that already claimed what their
wait checked, and their conditions now check it too. The sentence texts
are unchanged, so nothing that `docs/INVARIANTS.md` or DESIGN §14 cites
moved. The other 4 are new sentences for claims that no sentence stated.
Beside them come the 3 self-check sentences of §1.3.

## 3. Every wait that timed out, classified

A run of verify-site on the throwing shim, with a temporary switch that
logged each timed-out wait and went on (never committed), found five. The
suite as it stood then printed *799 passed, 0 failed*, so every one had been
hidden.

None of the five is any of the brief's three kinds:
- not (a): the claim was false, but because the wait's condition was
  wrong, not because a panel or the shell was;
- not (b): no number of settles would have met these conditions;
- not (c): none was a pause before a negative check.

I call them (d): **the wait named an end state the page by design does not
stay in.** Each condition was corrected to name the state the page is
specified to reach, and the correction is strict. A `moved` sign that
lands on the plain landing sentence now fails.

| # | Group, wait | What the page showed | Why the page is right | The correction |
|---|---|---|---|---|
| 1 | vault L, `sign` after the holder's panic (vault.mjs:468) | *ownership or epoch changed — review again* | CONSOLE §4.7: after a receipt the shell re-reads coreOf and rightsOf, and if either moved, the ticker says so after *landed in block N*. A panic moves the epoch | the helper takes `moved`; such a call waits for exactly that sentence |
| 2 | vault L, `sign` after the guardian's panic (vault.mjs:521) | the same | the same | the same |
| 3 | identity F, `sign` after the Market buy (identity.mjs:657) | the same | the buy moves #1's epoch and the buyer's rights | the same |
| 4 | gallery F, `sign` after the Seaport buy of #1 (gallery.mjs:337) | the same | the same, on #1's own page | the same |
| 5 | launch M, the coin lane after *A coin* is pressed (launch.mjs:878) | *a launch may be made now* | the panel's spacing row has three sentences, and S's warp had run #1's spacing out; the wait named only *next launch in* and *none yet* | the wait names all three, anchored |

In each case the sentences after the wait had passed. They read the chain,
the facts or the form, never the ticker or the spacing row. The wait was
the only thing that was wrong, and only a wait that throws could show it.

**The design question behind 1–4, for the integrator, not a bug.** After a
person's own panic or buy lands, the ticker's landing sentence is replaced
within the same receipt by a red *ownership or epoch changed — review
again*. That is the specified behaviour: CONSOLE §4.7 (item 7 of the
confirm slab's list), and W7 §4 decision 11, where it "still follows when
it applies". Whether a person's own epoch-moving transaction should keep
its landing sentence is a shell decision, not this unit's. The suites now
hold the behaviour as specified.

## 4. The claims that only a wait had checked

Each sentence below claimed what only the wait before it had checked. The
condition now checks it too, and the sentence is unchanged:

| Group · block | Sentence (verbatim) | Its condition now also checks |
|---|---|---|
| agent · F | *F1 the viewer reads the card and the key's envelope, offers no control, prompts for nothing and fetches nothing — the one sentence* | face 2 parses as registration-v1; the key's facts read the SESSION right |
| gallery · L | *the viewer draws the gallery and its story from the chain, prompts nothing and renders no control that signs* | the art is drawn; the archive line is there |
| identity · E | *the viewer reads every fact and the rights of any address, offers no control, …* | the status fact |
| identity · F | *where both are deployed the holder reads not listed, the two seals, no live role and no USER role, and is offered the listing form* | *not listed*, a role count of 0, the list control |
| identity · F | *a fingerprint that moves between the estimate and Sign is caught by the re-read: nothing is sent and the slab closes* | the slab closed |
| launch · G | *the guardian is offered the co-sign and no coin form* | the co-sign control |
| launch · F | *past its deadline short of its target, anyone is offered to fail it, and nobody to graduate it* | the fail control |
| launch · O | *with rights that could not be read the lane still reads every raise, offers nothing to press, and says why once* | the raises |
| launch · W | *#1's collections list it: its terms, 0 of 100 minted, nothing owed, …* | one row, *0 of 100* minted |
| launch · W | *only the holder or its Reach is offered the form: a stranger reads the gate once, every collection, and a mint* | both rows and both mints |
| launch · W | *the viewer reads every collection, its link and its QR, and offers nothing to press* | both rows and both QRs |
| social · D | *a number typed after the renter's own leaves nothing behind: …, and the pair's walk and the user's sentence stand alone* | the walk's status, *nothing whispered yet* |
| social · I | *sealed only when both keys exist: …; both bound, the key must be derived first and nothing is offered in the clear* | the derive control |
| social · A | *both personas bound: the key is derived first and nothing is offered in the clear* | the derive control |
| swap · G | *the epoch is re-read immediately before Sign, and a changed epoch closes the slab unsent* | the slab closed |
| swap · V1 | *after the receipt a second slab offers the memory: Journal.inscribe(hub, #1, TRADE, the words, the swap's transaction), …* | the slab is open, and its function is `inscribe` |
| vault · O | *the viewer reads the vault and offers no control, with the one sentence; the key field is a read* | the holdings and the plan |
| vault · V6 | *the viewer reads the keepsakes and offers no control: no form, no claim, no change* | the Reach's keepsake and what it pays |

Four waits checked a claim of the lane that no sentence stated. Each now
has its own sentence:

| Group · block | New sentence |
|---|---|
| launch · W | *after the claim lands, #1's row owes 0 ETH and offers no claim* |
| launch · W | *after Tide lands, #1's collections list both, Tide among them* |
| social · K′ | *the expire lands: the stamp's row reads refunded, expire is no longer offered, and the refund is offered to claim* |
| swap · H | *after the exact-out approve lands the same button is the swap, and 0.01 is still typed* |

The audit read all 380 waits against the sentences after them. The rest
are one of three things:
- a precondition of the next action, which a throwing wait now enforces
  (the slab open before Sign, a control before its press);
- a claim the next sentence re-checks;
- a wait whose answer is read.

## 5. Measured

| Run | Before (80ae2d1) | After (this tree) |
|---|---|---|
| `node tools/verify-site.mjs` (all groups, after `node tools/build-app.mjs`) | **799 passed, 0 failed**, 285 s. boot 131, swap 136, social 117, launch 107, vault 103, identity 88, agent 68, gallery 42 | **805 passed, 0 failed**, 264 s (the final run; the first on this code took 259 s). boot 133, swap 137, social 118, launch 109, vault 103, identity 88, agent 68, gallery 42 |
| the same, throwing, before the §3 corrections (logged and continued) | — | 799 passed, 0 failed, and 5 waits timed out (§3) |
| `node tools/verify-console.mjs` (all groups, Chromium 141.0.7390.37) | **214 passed, 0 failed**, 379 s (HEAD's file, instrumented as §6 says). boot 32, viewer 14, session 9, agent 6, swap 29, social 28, identity 13, vault 29, launch 17, journey 28, gallery 5 | **215 passed, 0 failed**, 379 s. boot 33, every other group as before |
| `node tools/static-audit.mjs` | — | *static audit passed — 10 Solidity rules, 4 JS rules* |
| `node tools/invariants-check.mjs` | — | **225 passed, 0 failed** |

verify-site gains 6 assertions: the 4 new claims of §4 and the 2
self-checks. verify-console gains 1, the `visible()` self-check.

## 6. verify-console, measured

HEAD's verify-console was run once with temporary instrumentation (a copy
of the file, never committed). Its answers were unchanged; it also logged
three things:
- every one of its own waits that timed out;
- every wait that took more than half its timeout;
- every `visible()` or `visibleAll()` call that the honest check would
  answer differently.

The run printed *214 passed, 0 failed* and **not one such line**:
- the honest `visible()` moves no outcome on this suite: no element it is
  asked about sits in a closed `<details>`. The self-check of §1.3 is the
  one sentence that tells the two functions apart, and it fails with the
  old one put back (C0 in §8);
- none of verify-console's 129 waits timed out, and none used half its
  timeout, at a load average near 2.

So making verify-console's own `until` throw would change no result today.
It was not done here, and §7 says why.

`visibleAll` is also used for negative claims. *the vault lane's spending
controls are hidden the same way, by the shell* passes when every
`[data-spend]` reads not visible. Since this change, a control folded in a
closed `<details>` also reads not visible, and none of that group's
controls is folded (it runs on a V1 band, where the vault draws no keepsake
card). If a lane ever folds a spending control, that sentence should ask
`pg.hidden(…)`, the shell's own `[hidden]`, instead.

## 7. Requests for files and decisions this unit does not own

1. **`CLAUDE.md`, a trap.** *The shim's `page.until` throws on a timeout,
   naming the group, the lines and the condition, and the group stops
   there. `{ soft: true }` is for a wait whose answer the caller reads, or
   a deliberate pause. A wait raced against another promise must be soft:
   one that loses the race and throws later is an unhandled rejection, and
   solc's handler kills the run before its summary (W12's trap). A `sign`
   after a transaction that moves the epoch or the wallet's rights (a
   panic, a buy) ends on "ownership or epoch changed — review again"
   (CONSOLE §4.7), so the helpers take `moved`.*
2. **verify-console's own `until`, a follow-up unit.** It has the same
   defect: it catches every error, timeouts included, and returns false;
   122 of its 129 waits drop the answer. §6 measured no hidden failure
   today. I did not convert it here, for two reasons.
   - **testnet-drive.** `tools/testnet-drive.mjs` runs `journey()` from
     this file over a real wire, so the change would alter that tool's
     behaviour too. It catches a thrown journey as *the journey threw: …*,
     which would be honest, but it cannot be run in this container.
   - **Two signs pass by a race.** `pg.sign` waits 20 s for *landed in
     block*, and two of its calls follow epoch-moving transactions: the
     Market buy (identity M, `pb.sign(WB, 1)`) and the holder's panic
     (vault L, `pg.sign(W, 1)`). There *landed in block* is on screen only
     while the receipt's `coreOf` and `rightsOf` re-reads cross to Node and
     back, before *review again* replaces it. That is read from the shell's
     code; the window was not timed. They pass because the 40 ms poll
     catches that window. When the poll misses, the wait today burns 20 s
     and returns false in silence. A throwing `until` would need the same
     `moved` correction as §3 first.
3. **`docs/INVARIANTS.md` and DESIGN §14 (the integration's files), if
   the integrator wants the harness held by rows.** A proposed row: *a
   wait in the shim that times out throws by name, and its soft form
   answers false*, cited at `tools/verify-site/boot.mjs` by the two
   sentences of §1.3. A second: *the console's visible() reads a folded
   field as not visible*, cited at `tools/verify-console.mjs` by its
   self-check. The mutants that kill them are in §8. Status: pending, for
   the integrator to make live once the battery runs them.
4. **The shell (W7's file, the integrator's decision).** §3's design
   question: whether a person's own epoch-moving transaction keeps its
   landing sentence.

## 8. How it was proved

- **The inventory.** A scratch counter (not committed) walks every
  `.until(` and finds its closing parenthesis. It classifies each by what
  precedes it: `await` as a statement, `= await`, `=>` or `return`, or
  inside `Promise.race`. A `grep -o` of the baseline files gives the same
  totals: 380 call sites, 376 awaited, 1 assigned.
- **No sentence renamed.** A scratch check took every quoted string of 12
  or more characters, with a space, from the baseline files (3,540 of them)
  and found each verbatim in this tree. The one exception was a fragment of
  code between two quotes on a line that was split. `tools/invariants-check.mjs`
  agrees: 225 passed, 0 failed.
- **Mutations of the harness changes.** A scratch probe ran each mutant
  the same way:
  - wrote it over the file;
  - ran the one group that holds it;
  - kept the failed sentences;
  - restored the file and compared it byte for byte with the copy taken
    first (*restored: true* every time).

  | Mutant | The change | Run | Result |
  |---|---|---|---|
  | S1 | `tools/dom-shim.mjs`: `if (last \|\| o.soft) return last;` → `if (last \|\| !o.soft) …` (a timed-out wait answers again, the soft one throws) | `verify-site.mjs --group boot` | killed, *128 passed, 2 failed*: *a wait that times out throws, …*, then the group threw at the soft wait |
  | S2 | `tools/dom-shim.mjs`: `group: opts.group \|\| GROUP` → `opts.group && GROUP` (the page forgets its group) | the same | killed, *138 passed, 1 failed*: *a wait that times out throws, …* |
  | C1 | `tools/verify-console.mjs`, `visible()`: `!e.checkVisibility(…)` → `e.checkVisibility(…)` | `verify-console.mjs --group boot` | killed, *31 passed, 5 failed*: the self-check and the four boot sentences that ask `visible()` |
  | C2 | the same function's walk: `!d.open` → `d.open` | the same | killed, *35 passed, 1 failed*: the self-check |
  | C0 | HEAD's `visible()` put back whole (not a one-token mutant) | the same | killed, *35 passed, 1 failed*: the self-check |

  C2 first **survived**. The first form of the self-check read only the
  closed details, and `checkVisibility()` reports a fold whatever the walk
  says. So the self-check now also opens the details and reads the row
  again, and that kills C2. The walk is what this browser does not need and
  another may.

Reproduce:

```sh
node tools/build-app.mjs && node tools/verify-site.mjs        # 805 passed, 0 failed
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/verify-console.mjs   # 215 passed, 0 failed
node tools/verify-site.mjs --group boot                       # block W: the shim's own waits
node tools/static-audit.mjs && node tools/invariants-check.mjs
```
