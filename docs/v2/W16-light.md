# W16 · the light's own sentences: F9–F13 in Chromium

V2 integration, unit W16. W7 measured the living-light shell's promises by
hand (`docs/v2/W7-shell.md`, decisions 9, 11 and 14, §6, and §8 requests 3
and 6). This unit turns those probes into sentences of the battery, for
INVARIANTS rows F9–F13. It also answers W7's request 6, the viewer's button
sweep, and takes two small items W17 asked of this file (Item 7). It was
built on fe96c8e on 2026-10-20.

This unit owns:
- `tools/verify-console.mjs`;
- this report.

Every number below was measured on this tree, and each says which run
printed it. The machine was shared: until the container restarted, another
unit's forge run and two verify-site groups ran beside these, and after it
the load was lower. So each timing is quoted with the load average the run
ended at.

## 1. What was built, and what this Chromium can be asked

**A twelfth group, `light`.** `tools/verify-console.mjs` gains
`groupLight`, appended to `GROUPS` and `RUNNERS`, so the `verify:console`
step of `npm run check` runs it with every other group, and
`--group light` runs it alone. It holds 15 sentences: four for F9, four
for F10, three for F11, one for F12 and three for F13.
- It runs on a chain of its own with the AgentCard at its pin, as the
  agent group does, so both sheets (identity and the agent's door) are
  in the dock.
- The cast is W7's (§7): #1 with an open WETH/ETH market, a funded
  Reach and two words in the commons; #2 beside it.
- Every sentence reads state: classes, attributes, `getAnimations()`,
  and counters kept in the page. None reads how long a frame took.
  Where a sentence wants frames, it waits for a few (3, or 20) with ten
  seconds to get them; where it wants none, a slow machine cannot add
  one. So the machine's load moves how long a sentence takes, not what
  it answers.

**The light's eyes, `lightInit`.** An init script, installed before any
document on the light group's pages only. `document.open()` erases a
window's listeners but never its properties or a prototype, so all of
it outlives the loader's rewrite. It records:
- every `getContext`, and whether `INTACT.ui.ready` had resolved when it
  was asked. The state object and its `ui` are caught as the page
  assigns them, so `ready` is watched from the moment it exists. What
  stood when it resolved (a `#soul`, a WebGL context) is written down in
  the same microtask;
- how many times `readPixels` (the timed frame's two syncs),
  `drawArrays` (the sky's frames) and `requestAnimationFrame` (anything
  that loops on frames) were called;
- with `gpu`, W7's probe (decision 9): `UNMASKED_RENDERER_WEBGL`
  (0x9246) names that GPU and `readPixels` does nothing, so the timed
  frame passes as it does on a fast GPU.

**Three additive harness options.** `openBrowser({ args })` passes
Chromium's own switches. `openPage` takes `viewport`, `reducedMotion` and
`init`. `tools/testnet-drive.mjs` imports both and passes none of them, so
the drive is unchanged.

**What the battery's Chromium answers.** Measured with a scratch probe on
Chromium 141.0.7390.37, before any sentence was written:
- **The renderer** is named *ANGLE (Google, Vulkan 1.3.0 (SwiftShader
  Device (Subzero) (0x0000C0DE)), SwiftShader driver)*. The shell's
  pattern names it, so the battery's soul is always the software still.
- **`--disable-webgl`** (and `--disable-3d-apis`) make
  `getContext("webgl")` answer `null`. So "without WebGL" is a real
  Chromium with its WebGL switched off, launched for one page.
- **No page is ever hidden.** Every attempt left `visibilityState`
  *visible* and fired no `visibilitychange`:
  - a minimised window (`Browser.setWindowBounds`);
  - a second page brought to the front (`bringToFront`);
  - a second tab in the same window (`Target.createTarget` with
    `newWindow: false`, its window id checked), activated over the first
    and back (`Target.activateTarget`);
  - each of those again, with Playwright's anti-backgrounding switches
    removed (`--disable-backgrounding-occluded-windows`,
    `--disable-renderer-backgrounding`,
    `--disable-background-timer-throttling`).

  CDP has no visibility emulation either. So the hidden-tab sentence
  tells the page it is hidden, as Chromium tells a background tab:
  `document.hidden`, `visibilityState` and one `visibilitychange`. That is
  everything the shell reads (`run()` reads `D.hidden` on the event).

## 2. The items, each with its sentences and its mutants

**How each mutant was run.** HEAD was exported into a scratchpad with
`git archive`, `node_modules` linked and `out/` copied so the compile cache
hit, and this unit's `tools/verify-console.mjs` copied in. A driver (kept
in the scratchpad, not committed) did the rest for each mutant:
- it replaced one exact text in `engine/app.html` or `engine/app.css`
  (for Item 7, `engine/panels/vault.js`), which had to occur exactly
  once;
- it ran `node tools/verify-console.mjs --group light` in the copy (for
  Item 7, `--group swap` or `--group vault`);
- it restored the file in a `finally` (and on SIGINT), and proved it equal
  to the original by sha256.

There were six passes. Each one after the first answered what the one
before it showed:

| Pass | Mutants | What it showed | What changed after it |
|---|---|---|---|
| 1 | m1–m20, against the walk's first form, forward only | 19 killed; **m17 survived**: with html's 84 px cut to 4 px, every sentence held | the walk goes back too (Item 4) |
| 2 | the 20, two one-character variants (m5b, m12b) and W7's no-padding case (m16b) | 23 killed. But under m12b, where the revert celebrated in the landing's place, the landing's sentence held on the revert's class and canvas: it read the whole class log | F11's sentences read from a mark taken just before the press |
| 3 | F11's six | 6 killed. But m12 failed the landing's sentence too, by its check that no `#spark` stood before the press: the revert's canvas stood, though the landing celebrated as it should | a canvas that stands is no burst either way: the sentence counts the frames asked for since the press, and m14b is added for that clause |
| 4 | F11's seven | 7 killed. But under m12b the count read 70: the revert's sparks were still flying when the mark was taken | the sentence asks that the page asked for no frame in the half second before the mark |
| 5 | F11's seven | 7 killed. But m12 failed the landing's sentence by that half second, for the same reason | the quiet half second is waited for (up to ten seconds), then read |
| 6 | F11's seven, and Item 7's o1 and c1, against the file committed | below | — |

Every line in Items 1, 2, 4 and 5 is the second pass's, and every line in
Items 3 and 7 is the sixth's. Between the two passes the light group
changed only inside F11's block (its section C): the marks, the frames and
the quiet half second. (The second pass's first three mutants ran before
one comment in the walk block was made exact; no code differs.)

The container restarted during the fourth pass, while m12 ran, so that
mutant's restore never ran. Its mutant was found in the copy's
`engine/app.html` (line 818, `if (1) celebrate();`). The file was restored
from HEAD and its sha256 checked, and all 458 files HEAD tracks were
compared with the copy's, byte for byte: none differed but this unit's
`tools/verify-console.mjs`. The pass then resumed at m12.

Apart from that interrupted run, every mutant was restored byte for byte
by the driver itself, in every pass. A change marked ¹ is one character;
every other one is one token. The group's line is the copy's
`N assertions in T s`, then its last line (which includes the run's three
build lines, so a group of 15 reads 18 in all).

### Item 1 · F9: the soul

The holder's page at 1200 × 900 on the battery's own GL, and the holder's
phone page (390 × 844) under `reducedMotion: "reduce"` with a GPU named.

- *"the soul never starts before ready: the first WebGL context is asked
  for after INTACT.ui.ready resolved, when no #soul stood yet, and the
  canvas it makes is #soul"*. The first `getContext("webgl")` record says
  `ready` had resolved. When `ready` resolved, no `#soul` stood and no
  WebGL context had been asked for. `#soul.on` stands afterwards.
- *"on the battery's software rasteriser the soul is named, not timed:
  SwiftShader keeps one still at a quarter of the window, drawn once, with
  no readPixels, no html.alive and no frame asked for"*. The renderer a
  fresh context names is SwiftShader. Measured: `#soul` 300 × 225 of
  1200 × 900, one `drawArrays`, no `readPixels`, no `html.alive`, and no
  `requestAnimationFrame` in an idle second.
- *"under reduced motion the soul keeps one still even where a GPU is
  named: drawn once at 0.55× and never timed, with no html.alive and no
  frame asked for"*. The media query matches and the renderer is the
  spoof. Measured: `#soul` 215 × 465 of 390 × 844, one draw, no
  `readPixels`, no `html.alive`, no frame.
- *"without WebGL the soul is absent: Chromium answers no context, no #soul
  is made, the CSS sky stands, and nothing threw"*. A second Chromium
  with `--disable-webgl`, for this one page. The soul asked once, after
  `ready`, and got `null`. There is no canvas in the document,
  `body::before` is the CSS sky's radial gradient, and the holder reads
  rights 1.

**Mutants.**

| Mutant | The change in `engine/app.html` | It fails | The group's line |
|---|---|---|---|
| m1 · the ready gate | the boot's first statement `home();` → `soul();`, so the soul starts before the wallet, the chain check and `ready` | *"the soul never starts before ready: …"*: the first context was asked with `ready` unresolved, and when `ready` resolved a `#soul` stood and one context had been asked. Five more fail with it, because the soul then starts twice (two draws) | 15 assertions in 66.5 s · 12 passed, 6 failed |
| m2 · the still condition | `still = true, SC = .25` → `still = false, SC = .25` | *"on the battery's software rasteriser the soul is named, not timed: …"*, alone: the named rasteriser was timed (2 `readPixels`, 2 draws), and its slow frame kept the still, so only "not timed" sees it | 15 assertions in 75.5 s · 17 passed, 1 failed |
| m3 · the name¹ | `/swiftshader\|llvmpipe\|software/i` → `/swiftshadex\|…/i` | the same sentence, alone: the canvas is 660 × 496 (0.55×) and timed | 15 assertions in 65.0 s · 17 passed, 1 failed |
| m4 · reduced motion | `still = RM` → `still = 0` | *"under reduced motion the soul keeps one still even where a GPU is named: …"*: timed (2 `readPixels`), `html.alive` set, 19 draws, 13 frames in the idle second. F10's reduced-motion sentence and F11's reduced-motion landing fail with it, since both see the loop | 15 assertions in 76.5 s · 15 passed, 3 failed |
| m5 · no WebGL | in `soul()`, `if (!g) return;` → `if (!g) 0;` | *"without WebGL the soul is absent: …"*, alone, by its "nothing threw": *TypeError: Cannot read properties of null (reading 'createProgram')* | 15 assertions in 64.8 s · 17 passed, 1 failed |
| m5b · no WebGL¹ | the same guard inverted: `if (!g) return;` → `if (g) return;` | *"without WebGL the soul is absent: …"* by the same TypeError, and six more, because every page with WebGL now has no soul at all: no `#soul` (so *"the soul never starts before ready: …"* fails by its "the canvas it makes is #soul"), no draws, no `html.alive` under the GPU | 15 assertions in 109.9 s · 11 passed, 7 failed |

The first sentence's "before ready" clause falls to m1, a one-token change.
No one-character change of the shell starts the soul before `ready` that I
could find, since the call is placed after `readyRes()`: moving it is the
honest mutant, and m1 is its one-token form. m5b fails the sentence by its
other clause.

### Item 2 · F10: nothing loops without `html.alive`

- *"on software GL nothing loops: in every room and under an open slab no
  endless animation runs — the frame's spin and the Sign button's flow wait
  paused — no frame is asked for in an idle second, and html.alive is
  unset"*. The holder's desktop page walks every room and both sheets,
  then holds a slab open with Sign enabled (the shell's own `hub.mint`
  row, estimated). `document.getAnimations()` holds no endless animation
  that is running, anywhere. Under the slab the frame's `spin` and the
  Sign button's `flow` are present and paused, so the check is not
  vacuous. Measured under the slab: eight animations, five finite
  transitions, the finished `arrive`, `spin` paused and `flow` paused.
- *"under a spoofed GPU the timed frame passes and html.alive is set: the
  soul's loop asks for frames, and the frame's spin and the Sign button's
  flow run"*. A phone page with the GPU named. `html.alive` is set, the
  timed frame's two `readPixels` happened, the canvas is 0.55×, the frame
  counter grows by at least three more, and `spin` and `flow` are running.
  This page is kept short, because the battery's SwiftShader then draws
  every frame of the sky.
- *"a hidden tab pauses both: told it is hidden, as Chromium tells a
  background tab, the soul stops asking for frames, html.alive drops and
  the spin and the flow pause; shown again, they resume"*. The same page
  with the slab open. Told hidden: no `html.alive`, no frame asked for in
  800 ms, `spin` and `flow` paused. Told shown: `html.alive` again, the
  frames grow again, both running.
- *"under reduced motion nothing animates, a spoofed GPU too: no CSS
  animation exists in any room or under an open slab, every transition is
  a fade, no frame is asked for, and html.alive is unset"*. The reduced-
  motion page walks every room and holds a slab open. Every animation
  Chromium reports is an opacity transition. Measured: none in each room,
  two fades under the slab, no frame, one draw.

**Mutants.**

| Mutant | The change | It fails | The group's line |
|---|---|---|---|
| m6 · the toggle¹ | `engine/app.html` `run()`: `HC.toggle("alive", !!raf)` → `HC.toggle("alive", !raf)` | every sentence that reads `html.alive`, six: on software GL the frame spins in every room and both sheets (*"on software GL nothing loops: …"*); under the spoofed GPU `html.alive` is unset and the spin and the flow wait paused (*"under a spoofed GPU …"*); hidden and shown trade places; and F9's two stills and the reduced-motion sentence read `html.alive` set | 15 assertions in 84.2 s · 12 passed, 6 failed |
| m7 · the `.alive` selector¹ | `engine/app.css`: `.alive #frame,…` → `.alivx #frame,…` | *"under a spoofed GPU …"* and *"a hidden tab pauses both: …"*: `html.alive` is set, yet the spin waits paused while the flow runs | 15 assertions in 66.6 s · 16 passed, 2 failed |
| m8 · the spin's default | `engine/app.css` `#frame`: `animation:spin 9s linear infinite paused` → `… infinite running` | *"on software GL nothing loops: …"*: the frame spins in every room and both sheets; and *"a hidden tab pauses both: …"*: it spins while hidden | 15 assertions in 69.1 s · 16 passed, 2 failed |
| m9 · the hidden tab¹ | `engine/app.html`: `D.addEventListener("visibilitychange", run)` → `"visibilitychangx"` | *"a hidden tab pauses both: …"*, alone: told hidden, the sky asked for 8 more frames in 800 ms and both animations ran | 15 assertions in 64.4 s · 17 passed, 1 failed |
| m10 · reduced motion's rule¹ | `engine/app.css`: `@media(prefers-reduced-motion:reduce)` → `…:reducx)`, an invalid value, so the rule never applies | *"under reduced motion nothing animates, …"*, alone: `arrive` and the frame's `spin` exist on Home, and `#lit`'s transform and the links' colours transition in the rooms | 15 assertions in 58.1 s · 17 passed, 1 failed |

Item 1's m1, m4 and m5b fail F10's sentences too, wherever those count
the sky's draws or read `html.alive`.

### Item 3 · F11: a landing celebrates, a revert does not

**The revert is the chain's own.** The page's speak slab is estimated
while the commons is open to #1. Then #1 speaks from the chain in the same
block, so the page's word arrives inside the commons' two blocks. Parley
refuses it with `Cooldown(21000006)`, the receipt's status is 0x0, and the
shell says *reverted in block 21000004; nothing changed*. Nothing is
overridden and no receipt is forged.

- *"a revert does none of it: the ticker says reverted in block <n>;
  nothing changed, html.landed is never set, and no #spark is made"*. The
  ticker's log (W14's `__ticks`) holds the revert sentence with the
  receipt's block, and no landing. A `MutationObserver` on `html`'s class
  saw no change at all, and there is no `#spark`.
- *"a landing celebrates: the ticker says landed in block <n> — <the slab's
  sentence>, html.landed is set and taken away again, and #spark bursts
  over the window"*. Two blocks on, through the same composer. Everything
  is read from a mark taken just before the press, so it is this
  landing's own:
  - the log holds exactly `landed in block <n> — ` and the slab's
    `[data-sentence]` (*says, as #1, in the commons, forever: a word that
    lands*);
  - the class log since the mark shows `landed` set, then removed;
  - `#spark` stands, 1200 × 900 (the window times `devicePixelRatio`),
    `aria-hidden`;
  - its sparks fly. Before the mark the page went half a second asking
    for no frame: that is waited for (a celebration before this one may
    still be flying), then read. So every frame counted from the mark is
    this landing's. The sparks' loop asks for one on every frame until
    the last spark dies, 84 in all on any machine (a spark's life falls
    by .012 a frame), and the press's own pointer for one or two. The
    sentence asks for 20 since the press. Measured in a probe run of the
    final file: none in the half second before the mark, and 31 since
    the press by the time the sentence read them, after `landed` had
    come and gone;
  - nothing threw.
- *"under reduced motion a landing is the glow alone: html.landed is set
  and taken away again, no #spark is made, and no frame is asked for"*.
  On the reduced-motion page: the landing sentence, `landed` set and
  removed, no `#spark`, and the frame counter unchanged across the
  landing.

**Mutants.**

| Mutant | The change in `engine/app.html` | It fails | The group's line |
|---|---|---|---|
| m11 · the class¹ | `celebrate()`: `HC.add("landed")` → `HC.add("landex")` | *"a landing celebrates: …"* and *"under reduced motion a landing is the glow alone: …"*: the class log since the press reads `landex`, never `landed`. The sparks flew (85 frames since the press, every one of them, since the wait for `landed` ran its full 8 s) | 15 assertions in 58.9 s · 16 passed, 2 failed |
| m12 · the receipt's gate | `watch()`: `if (ok) celebrate();` → `if (1) celebrate();` | *"a revert does none of it: …"*, alone: the revert set `landed` and made `#spark`, though the ticker still said *reverted in block 21000004; nothing changed*. The landing's sentence holds, as it should: the revert's sparks were waited out before its mark | 15 assertions in 50.0 s · 17 passed, 1 failed |
| m12b · the receipt's gate inverted¹ | `watch()`: `if (ok) celebrate();` → `if (!ok) celebrate();` | all three: the revert celebrated (`landed`, `#spark`); the landing set no class and asked for 1 frame since its press; the reduced-motion landing set no class | 15 assertions in 73.6 s · 15 passed, 3 failed |
| m13 · the landing's words¹ | `watch()`: `" — " + tx.sentence` → `" — " + tx.sentencx` | *"a landing celebrates: …"* and the reduced-motion landing: the ticker says *landed in block 21000007 — undefined* | 15 assertions in 45.0 s · 16 passed, 2 failed |
| m14 · the canvas's name¹ | `celebrate()`: `c.id = "spark"` → `c.id = "sparx"` | *"a landing celebrates: …"*, alone: the sentence and the class were right and the sparks flew (40 frames), on a canvas that is not `#spark` | 15 assertions in 43.6 s · 17 passed, 1 failed |
| m14b · the sparks' loop¹ | `fly()`: `if (parts.length) requestAnimationFrame(fly);` → `if (!parts.length) …` | *"a landing celebrates: …"*, alone: `#spark` stood at the window's size, but its sparks were drawn once and never again: 2 frames since the press, none before the mark | 15 assertions in 54.9 s · 17 passed, 1 failed |
| m15 · the sparks under reduced motion | `celebrate()`: `if (RM) return;` → `if (0) return;` | *"under reduced motion a landing is the glow alone: …"*, alone: `#spark` was made and the sparks asked for 82 frames (1 → 83) | 15 assertions in 45.2 s · 17 passed, 1 failed |

m4 (Item 1) also fails the reduced-motion landing, because the sky's loop
then asks for frames across it.

### Item 4 · F12: focus never lands under the bars

**The walk.** A phone page (390 × 844) of the holder, with the ticker made
to speak (`INTACT.ui.say`), so it is in the way wherever it can be. It
covers every room and both sheets: Home, Gallery, Trade, Vault, Social,
Studio, Identity and Agent.
- Each room is walked round once forward (Tab) and once back
  (Shift+Tab), each round starting with focus on the crest's wallet
  cell and stopping when a control comes round again. That last focus
  is sampled too, and counted once.
- **Why both ways.** Measured with a scratch page of 40 buttons at
  390 × 844, under the shell's `scroll-padding: 84px 0 170px`:
  - Chromium leaves a Tab-focused control where it is when the control
    lies wholly inside what the padding leaves of the window (84–674
    px): the sixth button stayed at 624–674, and walking back, one at
    84–134 stayed too;
  - when any of the control lies outside, Chromium centres it there:
    the seventh button went to 354–404.

  So walking forward, the next control rises from the bottom edge and
  meets the clearance below. Only walking back does a control come down
  from the top and meet the clearance above. The first form of this
  sentence walked forward only, and the mutant that cut html's 84 px to
  4 px survived it (m17, first pass); walking back kills it.
- Each focus is sampled as W7's probe did it: a 5 × 5 grid over the
  focused box, each point asked of `elementFromPoint`.
- A point under the speaking ticker is found by the ticker's box. The
  ticker lets the pointer through (`pointer-events: none`), so
  `elementFromPoint` alone would never see it.

The sentence: *"at 390×844 a Tab walk through every room and both sheets,
forward and back, never leaves a focused control wholly hidden under the
crest bar, the dock or the ticker, nor out of view, and outside the sheets
none is even partly covered (398 focuses, a 5×5 grid each)"*. It holds
when:
- every room went round once each way, with at least ten focuses each
  way;
- no focus is wholly hidden with a point under a bar, under the ticker or
  out of view;
- outside the two sheets, no focus has even one such point.

Measured: 398 focuses, 199 each way (Home 11, Gallery 10, Trade 26, Vault
47, Social 28, Studio 24, Identity 36, Agent 17). None is wholly hidden
under a bar, under the ticker or out of view, and outside the sheets none
is partly covered. W7's 496 counted 60 presses per room at two sizes,
repeats included; this walk counts each control once each way, at the
size F12 names.

The walk sees two things that are not F12's claim. It prints them as
notes (the harness's `t.note`, for a finding the file may not fix), and §3
has them.

**Mutants.**

| Mutant | The change in `engine/app.css` | It fails | The group's line |
|---|---|---|---|
| m16 · the clearance below¹ | `html{scroll-padding:… calc(env(safe-area-inset-bottom) + 170px)}` → `+ 70px` | the walk's sentence. Nothing is wholly hidden at 70 px, but outside the sheets controls are partly covered, e.g. Trade's `#swap-in` at 724–774 px with 5 of 25 points in view, 10 under the dock and 10 under the ticker. W7's "wholly hidden" alone would let this mutant live; the sentence's "outside the sheets none is even partly covered" kills it | 15 assertions in 54.1 s · 17 passed, 1 failed |
| m16b · no clearance below | the same value → `+ 0px`, W7's case before the fix | the walk's sentence, by "wholly hidden" itself: walking forward, the Vault's `#vault-steward input[g]` at 769–819 px and Social's `#social-inbox input` take focus with all 25 points under the dock, as W7 measured (vault and social controls at y 753–831) | 15 assertions in 55.9 s · 17 passed, 1 failed |
| m17 · the clearance above¹ | `scroll-padding:calc(env(safe-area-inset-top) + 84px) 0 …` → `+ 4px` | the walk's sentence: walking back, Trade's `#swap-your-market input` at 16–66 px and the Vault's `#vault-steward input[g]` take focus with all 25 points under the crest bar. In the first pass, walking forward only, this mutant survived | 15 assertions in 52.0 s · 17 passed, 1 failed |

### Item 5 · F13: `#lanes a[data-lane]` is the dock

- *"#lanes a[data-lane] is the dock: one link per lane, in the order
  gallery, swap, vault, social, launch, then identity and agent, and Home's
  anchor sits outside #lanes"*. On the holder's phone page:
  - the links read gallery, swap, vault, social, launch, identity, agent;
  - the lanes the Engine holds (`INTACT.panels`, in slot order swap,
    social, launch, vault, identity, agent, gallery) are exactly those,
    each once;
  - `#lanes` is a child of `#dock`, and `#home` is a child of `#dock`
    outside `#lanes`;
  - in the console no link is aria-disabled or out of the tab order.
- *"the room in use carries aria-current=true and no other link does, in
  every room and both sheets"*. In each of the eight rooms, exactly one of
  `#home, #lanes a` says `aria-current="true"`, that room's, and every
  other says `"false"`.
- *"in the viewer every lane link is aria-disabled and out of the tab
  order: each carries tabindex=-1"*. The data: viewer without a provider:
  seven links in the same order, each `aria-disabled="true"`,
  `tabindex="-1"` and `.tabIndex === -1`.

**Mutants.**

| Mutant | The change in `engine/app.html` | It fails | The group's line |
|---|---|---|---|
| m18 · `aria-current`¹ | `show()`: `a.setAttribute("aria-current", …)` → `"aria-currenx"` | *"the room in use carries aria-current=true and no other link does, …"*, alone: in every room all eight links carry no `aria-current` at all | 15 assertions in 52.8 s · 17 passed, 1 failed |
| m19 · `tabindex=-1`¹ | `paintNav()`: `a.tabIndex = -1;` → `a.tabIndex = 1;` | *"in the viewer every lane link is aria-disabled and out of the tab order: …"*, alone: each of the seven reads `tabindex="1"` | 15 assertions in 53.0 s · 17 passed, 1 failed |
| m20 · the order¹ | `ORDER = ["gallery", "swap", "vault", …]` → `"vaulx"` | *"#lanes a[data-lane] is the dock: …"*: the links read gallery, swap, social, launch, vault, identity, agent; and the viewer's sentence, which reads the same order | 15 assertions in 53.4 s · 16 passed, 2 failed |

### Item 6 · W7-6: the viewer's button sweep

**Measured first.** The old sweep was instrumented once (the viewer group
alone, load 6.8). Each lane took under a second except the agent sheet:
30,430 ms.
- The sweep counted the page's visible buttons once and pressed them in
  document order.
- In the agent sheet the ✕ (index 0 of 3) came first and closed the sheet
  back to the vault room.
- Index 1 then pressed the vault's *walk the grant log*.
- Index 2 no longer existed, so `textContent()` waited out its default:
  30,002 ms.
- The group took 49.2 s.

So the 30 s was one wait, and the agent sheet's own two buttons were never
pressed at all.

**What changed.** Per lane, the sweep presses that lane's own visible
buttons (`#lane-<name> button:visible`), counted again before each press.
Each read waits at most 1.5 s, as the click beside it does. A sheet's ✕ is
pressed last.

**Result.** The viewer group took 11.5 s in the final full run (load
1.9), and 13.8 s in the earlier one at 2.9, against 43.1 s in the
baseline's (load 2.2). Run alone at a load of 6.4–7.8 it took
18.1–20.9 s, against 49.2 s for the instrumented old sweep at 6.8. The sweep now presses ten buttons, the same ten every run:
- *its own market* (Trade) and *open door* (Social);
- *A collection* and *A coin* (Studio);
- *copy* and *walk the grant log* (Vault);
- *✕* (Identity);
- *propose: read what the grant says*, *which doors does the grant
  open?* and *✕* (Agent).

The agent sheet's two buttons are new to the sweep. The sentence's count
moved from 9 to 10, in its template hole; its text is unchanged, and it
still holds: zero prompts, no slab.

### Item 7 · two of W17's, in the swap and vault groups

The integrator passed these on from W17 during the unit, for this file,
to take if they fit without risk. Both did.

**The keepsake's orb, in Chromium.** W17's mutant f21-orb (in app.css's
`#swap-kept .keepsake::before`, `width:46px` → `4px`) survived the swap
group in Chromium, because no sentence there read the orb. The swap group
gains one sentence, in W17's words, after the locked swap's receipt:
- *"in Chromium the keepsake's orb is the shell's: a 46 × 46 px circle
  before the keepsake's words"*. It reads the card `#swap-kept
  .keepsake` once the locked swap has landed:
  - its `::before` is generated (`content: ""`), 46 px by 46 px,
    `border-radius: 50%`, floated left, and lit by its radial gradient;
  - the card's words begin *keepsake #1 holds what arrived*, the id from
    the Wrapped log;
  - their first line starts 58 px into the card's content box, where the
    orb and its 12 px margin end. That is what "before the words" means
    in layout, and only Chromium can measure it.

  Measured in a probe run: exactly that, with an indent of 58 px.

**F25's first sentence, by name.** In the vault group, the wait before
*"in a data: frame, where navigator.clipboard is undefined, the Grip's
copy button says in words that copying is unavailable, and throws
nothing"* threw. So under W10's c1, where the copy button throws, the
wait's `UntilTimeout` stopped the group before the sentence ran. The
sentence's own condition reads the ticker's exact words and the page's
errors, so the wait is now `{ soft: true }`, with that reason in a
comment. The sentence is unchanged, word for word.

**Mutants** (the sixth pass, against the file committed):

| Mutant | The change | It fails | The group's line |
|---|---|---|---|
| o1 · W17's f21-orb¹ | `engine/app.css`: `#swap-kept .keepsake::before{…width:46px` → `width:4px` | the orb's sentence, alone: the orb reads 4 px wide and the words start 16 px in | 31 assertions in 34.4 s · 33 passed, 1 failed |
| c1 · W10's c1¹ | `engine/panels/vault.js`: `c ? c.writeText(GR)` → `1 ? c.writeText(GR)` | the clipboard sentence, by name: the ticker said nothing and the page threw *TypeError: Cannot read properties of undefined (reading 'writeText')*. The gift journey's sentence fails with it, since each of the journey's steps joins it | 31 assertions in 40.8 s · 32 passed, 2 failed |
| c1, against the wait as it was | the same, with the wait before the sentence not soft (a scratch copy of this file) | no sentence by name: *group vault threw: UntilTimeout: until timed out after 5000 ms in group vault, waiting at tools/verify-console.mjs:1965 … () => /copying is not available/.test(__t("#tick"))*, and the clipboard sentence never ran | 30 assertions in 41.1 s · 32 passed, 1 failed |

## 3. Two findings the walk prints, for the shell's owner

Both are inside the two sheets, and neither is F12's claim as written.
Each is printed as a note on every run until the shell answers it, and
requests 1 and 2 (§6) propose the fix.

1. **Inside a sheet, Tab reaches the dock's links under the sheet
   itself.** On a phone the sheet rises from the bottom (z 30) over the
   dock (z 29). The dock's Home and five room links stay in the tab order,
   so the Tab after the sheet's last control focuses links nobody can see.
   Measured: 24 focuses, forward and back (`#home` and the gallery, swap,
   vault, social and launch links, in each sheet, each way), every grid
   point hitting the sheet.
   WCAG 2.4.11 may allow this, since Escape reveals them without moving
   focus. But a keyboard user tabs on into six invisible stops.
2. **Inside a sheet, a control near the foot takes focus under the
   ticker.** The sheet is its own scroll container, and html's
   `scroll-padding` does not reach it. When the ticker speaks, it (z 45)
   covers the sheet's foot. Measured, six focuses:
   - walking forward, in the identity sheet: `userDays` and
     `setFeesToGrip` with 5 of 25 points in view, `sealDays` 10,
     `setApprovalForAll` and `approvee` 20;
   - walking back, in the agent sheet: `#agent-doors` (*which doors does
     the grant open?*) with 15 of 25.

## 4. Timings

Every run is `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node
tools/verify-console.mjs` on this worktree, Chromium 141.0.7390.37. The
load is the one-minute average when the run ended.

| Run | Last line | Wall | Load |
|---|---|---|---|
| baseline, fe96c8e untouched, all groups | **225 passed, 0 failed** | 376 s | 2.25 |
| an intermediate tree (the first forms: the walk forward only, the sweep unscoped) | **240 passed, 0 failed** | 497 s | ≈ 7 |
| a later tree (F11's marks, before its frames) | **240 passed, 0 failed** | 393 s | 2.91 |
| a later tree, after the container's restart (the quiet half second read but not waited for; before Item 7) | **240 passed, 0 failed** | 345 s | 1.62 |
| **this tree**, the file committed | **241 passed, 0 failed** | **344 s** | 1.89 |

The last run is the one this report quotes. The machine was quieter after
the restart (a load of 1.6–1.9, against 2.9), and that, not the code, is
most of the 48–49 s the last two runs gained on the one before them:
every group ran faster in them, the ones this unit did not touch too.

Per group, in seconds, from the first and last runs above:

| Group | Assertions | Baseline | This tree |
|---|---|---|---|
| boot | 37 | 33.0 | 28.5 |
| viewer | 14 | **43.1** | **11.5** |
| session | 9 | 13.1 | 10.8 |
| agent | 6 | 21.2 | 17.7 |
| swap | 30 → 31 | 39.9 | 35.0 |
| social | 29 | 43.0 | 37.5 |
| identity | 13 | 25.3 | 21.8 |
| vault | 31 | 39.1 | 33.8 |
| launch | 19 | 31.3 | 27.7 |
| journey | 28 | 47.1 | 43.4 |
| gallery | 5 | 34.1 | 29.3 |
| light | 15 | — | **43.4** |
| sum of the groups | 225 → 241 | 370.2 | 340.4 |

Neither log holds a ✗. Every group but the viewer and the light ran 2 to
6 s faster here than in the baseline, the machine's doing, not this
unit's; the viewer gave back 31.6 s, of which about 30 s was the one wait
(Item 6).

- The other groups' sentences are unchanged: the baseline's 225, the
  light group's 15 and the orb's one make 241. Compared line for line,
  the baseline's 221 group sentences and this run's 222 outside the light
  group differ in two template holes (the gateway's port and the sweep's
  count, 9 → 10) and in the orb's new sentence, and nothing else.
- The light group alone took 56.7–60.4 s in four runs while its walk
  went forward only (load 5.1–7.1), then 72.0 s and 55.9 s walking both
  ways (load 7.6 and 5.6), 48.4 s in the run at 2.91, and 43.4 s in the
  last. Most of its time is the pages it opens (the holder at two sizes,
  reduced motion, a spoofed GPU, a Chromium without WebGL, the walk and
  the viewer) and the walk's 398 presses.
- The spoofed GPU's page is the only one that keeps a core busy, because
  SwiftShader then draws the sky; it is open for a few seconds.

## 5. Proposed citations for F9–F13

Each citation below was checked mechanically. The five rows were spliced
into copies of `docs/INVARIANTS.md` and `DESIGN.md`, marked live in the
copy, and the copies were run through `node tools/invariants-check.mjs
--invariants <copy> --design <copy>`: **235 passed, 0 failed**, against
225 on the tracked documents. The negative control holds: with one word
changed in the copy ("stood yet" → "stood then"), F9 and its §14 pairing
fail, 233 passed, 2 failed.

A citation of `tools/verify-console.mjs` must not carry `--group light`.
`invariants-check` reads `--group g` as `tools/<runner>/g.mjs`, and
verify-console has no such directory.

**INVARIANTS (and DESIGN §14 without the status column):**

| Row | Claim | Enforced by |
|---|---|---|
| F9 | The soul never starts before `ready`; it is a still under reduced motion and on a software rasteriser, and absent without WebGL | `tools/verify-console.mjs` · *"the soul never starts before ready: the first WebGL context is asked for after INTACT.ui.ready resolved, when no #soul stood yet, and the canvas it makes is #soul"*, *"on the battery's software rasteriser the soul is named, not timed: SwiftShader keeps one still at a quarter of the window, drawn once, with no readPixels, no html.alive and no frame asked for"*, *"under reduced motion the soul keeps one still even where a GPU is named: drawn once at 0.55× and never timed, with no html.alive and no frame asked for"*, *"without WebGL the soul is absent: Chromium answers no context, no #soul is made, the CSS sky stands, and nothing threw"* |
| F10 | Nothing in the shell or a panel loops without `html.alive`, and `html.alive` is unset on software GL, under reduced motion and in a hidden tab | `tools/verify-console.mjs` · *"on software GL nothing loops: in every room and under an open slab no endless animation runs — the frame's spin and the Sign button's flow wait paused — no frame is asked for in an idle second, and html.alive is unset"*, *"under a spoofed GPU the timed frame passes and html.alive is set: the soul's loop asks for frames, and the frame's spin and the Sign button's flow run"*, *"a hidden tab pauses both: told it is hidden, as Chromium tells a background tab, the soul stops asking for frames, html.alive drops and the spin and the flow pause; shown again, they resume"*, *"under reduced motion nothing animates, a spoofed GPU too: no CSS animation exists in any room or under an open slab, every transition is a fade, no frame is asked for, and html.alive is unset"* |
| F11 | A landing celebrates (the bloom, the particles, the ticker's `landed in block <n>` sentence) and a revert does not | `tools/verify-console.mjs` · *"a landing celebrates: the ticker says landed in block <n> — <the slab's sentence>, html.landed is set and taken away again, and #spark bursts over the window"*, *"a revert does none of it: the ticker says reverted in block <n>; nothing changed, html.landed is never set, and no #spark is made"*, *"under reduced motion a landing is the glow alone: html.landed is set and taken away again, no #spark is made, and no frame is asked for"* |
| F12 | A focused control is never wholly hidden under the crest bar, the dock or the ticker, and outside the two sheets never even partly covered (WCAG 2.2 2.4.11) | `tools/verify-console.mjs` · *"at 390×844 a Tab walk through every room and both sheets, forward and back, never leaves a focused control wholly hidden under the crest bar, the dock or the ticker, nor out of view, and outside the sheets none is even partly covered"* |
| F13 | `#lanes a[data-lane]` stays the dock: one link per lane, `aria-current` on the room in use, `tabindex=-1` on a disabled one | `tools/verify-console.mjs` · *"#lanes a[data-lane] is the dock: one link per lane, in the order gallery, swap, vault, social, launch, then identity and agent, and Home's anchor sits outside #lanes"*, *"the room in use carries aria-current=true and no other link does, in every room and both sheets"*, *"in the viewer every lane link is aria-disabled and out of the tab order: each carries tabindex=-1"* |

**Proposed status for each row:** *live (W16: the light group of
`tools/verify-console.mjs`, in `npm run check` as the `verify:console`
step; every sentence fails under a one-character mutant of
`engine/app.html` or `engine/app.css`, W16 §2)*. Rows go live when the
merged battery is green, the ledger's rule. The one-character mutant for
each sentence, from §2:
- F9: m5b fails the first (by "the canvas it makes is #soul") and the
  fourth; m3 the second; m6 the third. The first's "before ready" clause
  has only m1, one token (Item 1).
- F10: m6 the first and the second; m9 and m7 the third; m10 the fourth.
- F11: m14 and m14b the landing; m12b the revert; m11 and m13 the
  reduced-motion landing.
- F12: m16 and m17.
- F13: m20 the first, m18 the second, m19 the third.

Requests 1 and 2 below are not conditions of F12: its sentence holds on
this tree as written, and the two sheet notes are outside its claim.

F12's claim is proposed in a wider form than W7's: the ticker joins the
crest bar and the dock, and "outside the two sheets never even partly
covered" is added, because the walk measured both on this tree.

## 6. Requests for files this unit does not own

1. **`engine/app.css`: the dock while a sheet is open** (finding 1). Take
   the dock's Home and room links out of view and out of the tab order
   while a sheet is open. For example:
   `[data-room=sheet]~#dock>#home,[data-room=sheet]~#dock #lanes a:not([data-lane=identity]):not([data-lane=agent]){visibility:hidden}`.
   `visibility:hidden` removes a link from sequential focus (measured in
   this Chromium: Tab passes over such a link). The orb and the door stay,
   since they sit in the crest bar. Escape, ✕ and the scrim
   still close the sheet. When it lands, the first note stops printing,
   and F12 can claim that no focus lands under anything.
2. **`engine/app.css`: the ticker over a sheet's foot** (finding 2, both
   sheets). Give the sheet its own clearance, as html has one:
   `[data-room=sheet] #lane{scroll-padding-bottom:calc(env(safe-area-inset-bottom) + 150px)}`.
   The ticker's top edge sits about 137 px above the window's foot (its
   bottom offset of 96 px plus its own 41 px). The drawer from 760 px
   (`bottom: 110px`) is likely to need the same, but this walk measured
   390 × 844 only. When it lands, the second note stops printing, and
   F12's "outside the sheets" can be dropped.
3. **`docs/INVARIANTS.md` and DESIGN §14:** rows F9–F13 as in §5. F14
   (the V1 promises under the light) can quote this tree's run:
   verify-console 241 passed, 0 failed. Its 222 group sentences outside
   the light group are the baseline's 221, line for line, but for two
   template holes (the gateway's port and the sweep's count, 9 → 10), and
   the orb's new sentence (Item 7). The other four lines are the runner's
   own.
4. **`docs/v2/INTEGRATION.md`:**
   - W7-6 is done by W16 (§2, item 6).
   - W7-3's F9–F13 have their sentences.
   - W7-8: F10's sentence now exists.
5. **`docs/CONSOLE.md` §17:** the battery has a twelfth group, `light`.
   Its sentences hold the §18 rows `#soul`, `#spark`, `html.alive` and
   `html.landed`, and `#lanes`'s `aria-current` and `tabindex=-1`. In §18,
   `html.alive`'s "never … in a hidden tab" is proved by telling the page
   it is hidden, since this headless Chromium never hides one (§1).
6. **`CLAUDE.md`, a new trap: this headless Chromium never hides a
   page.** A minimised window and a background tab in the same window
   both stay *visible* and fire nothing, with or without Playwright's
   anti-backgrounding switches, and CDP has no visibility emulation. A
   sentence about a hidden tab tells the page: it overrides
   `document.hidden` and `visibilityState`, and dispatches one
   `visibilitychange`.
7. **`docs/CHECKPOINT.md`**, at the session's end: verify-console's count
   (241) and its twelve groups.
8. **`docs/INVARIANTS.md` F21 and F25** (Item 7, for W17's evidence):
   - F21 may cite the swap group's new sentence beside the switch's and
     the post's: *"in Chromium the keepsake's orb is the shell's: a 46 ×
     46 px circle before the keepsake's words"*. W17's f21-orb (o1 here)
     fails it alone.
   - F25's status can say that the Vault lane's c1 fails its first
     sentence by name in Chromium (c1 in Item 7's table), now that the
     wait before it is soft.

## 7. How it was proved

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/verify-console.mjs                  # baseline 225 passed, 0 failed; this tree 241 passed, 0 failed
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/verify-console.mjs --group light    # 15 assertions, 18 passed, 0 failed
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/verify-console.mjs --group swap     # 31 assertions, 34 passed, 0 failed
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/verify-console.mjs --group vault    # 31 assertions, 34 passed, 0 failed
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/verify-console.mjs --group viewer   # 14 assertions, 17 passed, 0 failed
node tools/static-audit.mjs        # static audit passed — 10 Solidity rules, 4 JS rules
node tools/invariants-check.mjs    # 225 passed, 0 failed (235 with §5's rows spliced into copies; 233 and 2 with one word changed there)
```

The light, swap and vault lines are from runs of this file in the scratch
copy, the swap and light ones with a printed line added for §2's measured
values; the viewer's is from an earlier run of the same sweep. The
scratch scripts (the browser probes of §1, the mutant driver of §2, the
row splicer of §5) stay in the scratchpad and are not committed.
