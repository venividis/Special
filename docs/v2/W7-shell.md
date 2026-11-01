# W7 · the shell, as living light

V2 wave 2, unit W7 (`docs/V2.md` §2, §7). The owner asked for an interface the
viewer cannot believe, where every part is art within art. The direction was
settled in `design/v2/prototype.html`. This unit brings it into the real shell,
`engine/app.html` and `engine/app.css`, without breaking a promise the V1
console makes. Every number below was measured on this tree (b676ee0 plus
this unit's changes, 2026-10-19), and the sentence says which run printed it.

## 1. What was done

- **The soul.** A full-viewport WebGL fragment shader sits behind the page.
  It is the prototype's domain-warped fBm aurora. Its palette is the crest's
  own two hues; its flow is seeded by `keccak(fingerprint ‖ the crest's hash
  of the id)`. It renders at 0.55×, breathes, leans toward the pointer and
  blooms when a write lands.
  - Without WebGL, a CSS sky drawn from the same hues stands in.
  - Under `prefers-reduced-motion`, on a software rasteriser, or on a GPU
    too slow to animate it, it keeps a single still frame.
  - It starts only after the first chain check has answered and a frame has
    painted, and it stops while the tab is hidden.
  - **Nothing else loops unless the sky does.** The frame's spin and the
    Sign button's flow wait for `html.alive`, which the shell sets only
    while the soul's loop runs (decision 9).
- **Art within art.** Home draws the token's crest exactly as
  `src/Crest.sol` draws face 1, from the id, the custody epoch, the status
  and the seal. The crest sits in an iridescent conic frame that spins while
  the sky moves and tilts with the pointer or the gyroscope, and a status
  badge rides on the frame. A sale visibly adds a ring and hollows the mark.
- **The dock.** Home, Trade (`#lane-swap`), Vault, Social and Studio
  (`#lane-launch`) sit on a bottom dock with a sliding lit indicator.
  - Identity opens as a settings sheet from the token's own orb in the crest
    bar; the agent lane is a door beside it.
  - The dock **is** `#lanes`: every `#lanes a[data-lane]` is kept, and Home is
    an anchor outside `#lanes`.
- **The slab as a sheet.** `#cbox`/`#cslab` rise as a bottom sheet (centred
  on wide screens). The order is:
  - the clear-signing sentence, first and large;
  - the panel's lines;
  - the ether sent;
  - the facts the wallet signs (To, Function, Selector, the decoded
    arguments, the calldata, its digest and the engine hash), behind one tap
    on **the facts it signs**;
  - the estimate and both buttons, always in view.

  Every row is still in the DOM.
- **The celebration.** It runs after a receipt that landed, and never after
  a revert:
  - the soul blooms and a glow fades over the sky;
  - sparks burst from the ticker for 1.6 s;
  - a phone ticks once, and only after a gesture;
  - the ticker names what changed: `landed in block <n> — <the sentence that
    was signed>`.

  Under reduced motion the glow's fade is all of it.
- **The language.** It is defined as tokens on `:root`:
  - dark only, with system fonts and monospace kept for addresses, hashes
    and calldata;
  - frosted glass under every word;
  - phone first at 390 px with a 16 px gutter;
  - from 1080 px, two columns: the frame held still on the left, the room
    on the right.

  The V1 vocabulary the panels use is restyled, not renamed (`.k .v .s
  .blurb .kv .b .b.g .b.red .chip .gate pre.code h3`, inputs). So all six
  lanes wear the new light without a line of a panel changing.

## 2. Measured

| What | V1 (b676ee0) | V2 (this unit) | Printed by |
|---|---|---|---|
| shell, gzip | 14,955 B | **21,949 B** of 24,000 (2,051 B under) | `node tools/build-app.mjs` |
| — of which CSS / block 1 / block 2 / markup (each gzipped alone) | 1,838 / 1,932 / 10,919 / 616 | 4,274 / 1,932 / 15,305 / 861 | the build's `dist/app.html`, split |
| panels, gzip (unchanged) | swap 8,172 · social 8,187 · launch 8,155 · vault 8,166 · identity 8,185 · agent 4,883 | the same, each under 12,288 | `node tools/build-app.mjs` |
| `node tools/verify-site.mjs` (all groups) | 604 passed, 0 failed | **604 passed, 0 failed** | the last line of each run |
| `node tools/verify-console.mjs` (all groups) | 174 passed, 0 failed | **174 passed, 0 failed** | the last line of each run |
| `node tools/selftest.mjs` | — | 52 passed, 0 failed; chain half keccak `0x35000df5…7352`, the one INVARIANTS F3 records (block 1 untouched) | |
| `node tools/verify.mjs` | — | 235 passed, 0 failed | |
| `node tools/static-audit.mjs` | — | passed (10 Solidity rules, 4 JS rules) | |
| `node tools/gas.mjs`, cold | tokenURI 3.64 M · /token/1/live 1.29 M · /token/1/hash 2.08 M · /token/1/raw 3.80 M · `/` 0.80 M · renderer.document 1.22 M | **tokenURI 4.45 M · /token/1/live 1.47 M · /token/1/hash 2.27 M · /token/1/raw 4.67 M · `/` 0.98 M · renderer.document 1.38 M**; 83 probed cold, every view under its cap | `node tools/gas.mjs` |
| an idle console, CPU of one core (desktop Home · desktop Trade · phone Home, 8 s each) | 1.3 % · 0.0 % · 1.3 % | **0.3 % · 0.3 % · 0.9 %** (85.1 % · 77.3 % · 89.4 % before the motion policy) | a probe: utime + stime from `/proc` of every browser process, in the battery's Chromium, V1 and V2 in one run |
| the soul's start-up, synchronous (six loads) | — | median 23.6 ms, max 55.2 ms | a probe: from `getContext("webgl")` to the canvas taking `on` |
| WCAG contrast of every painted text box (3 tokens × 6 rooms) | — | phone 405 boxes, desktop 550; **0 under AA**; the lowest 4.90:1 | a probe, §6 |
| focus, tabbing every room and both sheets at 390×844 and 1440×900 | — | 496 focuses; **0 wholly hidden, 0 partly covered** (5 wholly hidden and 61 partly covered before the scroll padding) | a probe, decision 14 |

Both suites were run on the untouched tree first, so that any later failure
would be this unit's. The baselines were 604 / 0 and 174 / 0, and the V2
counts are the same assertions passing on the new shell. The probes are this
unit's scratch scripts, not part of the tree; each is described where its
number is used.

### The 24,000 ceiling, derived from the caps (for INVARIANTS F2)

INVARIANTS F2 derived V1's 15,000 ceiling from the gas slopes. The wave-4
Base64 rewrite (DESIGN §15, decision 39) has since cut those slopes, so the
derivation was measured again on this tree.

**Method.** `tools/site.mjs` `deploySite` was run with an in-memory plan, in
the deployment shape `tools/gas.mjs` uses (the AgentCard, the Roles and the
Market). The body was the real 21,949 B shell, then the same shell padded to
exactly 24,000 B with incompressible bytes. Every probe was cold, with a
one-wei transaction before each.

| view (cap) | at 21,949 B | at 24,000 B | slope, gas per gzip byte | crosses its cap at |
|---|---|---|---|---|
| `/token/1/hash` (2.5 M) | 2.273 M | **2.333 M** (93.3 % of the cap) | 29.4 | ≈ 29,685 B |
| `/token/1/live` (2.5 M) | 1.470 M | 1.524 M | 26.3 | ≈ 61,141 B |
| `hub.tokenURI(1)` (8 M) | 4.454 M | 4.706 M | 123.1 | ≈ 50,758 B |
| `/token/1/raw` (8 M) | 4.674 M | 4.946 M | 132.4 | ≈ 47,071 B |
| `/` (2.5 M) | 0.980 M | 1.033 M | 26.0 | ≈ 80,303 B |
| `renderer.document(1)` (2.5 M) | 1.380 M | 1.427 M | 23.1 | ≈ 70,531 B |

The nearest cap is `/token/1/hash`. At the full ceiling it reads 2.333 M of
2.5 M, a margin of 0.167 M, or about 5,700 B of gzip before it crosses
(29,685 B). So 24,000 is the gate and the gas follows it.

The same probe, run from V1's 14,955 B shell to 24,000 B, gave slopes of
118.4 (tokenURI), 28.4 (/hash) and 25.5 (/live), so they hardly depend on
the shell's size.

V1's figures of ≈ 276 and ≈ 68 gas per byte predate the Base64 rewrite and
are retired.

## 3. What changed, file by file

- **`engine/app.html`**
  - **Markup.**
    - The crest bar gains a brand mark.
    - Home gains `#stage > #frame > #art` (the crest) with `#badge`.
    - `#ident` and `#rights-sentence` sit in a glass card `#intro`.
    - `#lane` opens with a room header `#room` (`#room-t`, `#room-s`, and
      `#room-x` to close a sheet).
    - `#verified` moved into the page flow, at the end of every room.
    - `#lanes` moved into `<nav id="dock">`, beside `#home` and the lit
      indicator `#lit`.
    - `#scrim` was added for sheets.
    - `#tick` is `role=status aria-live=polite`.
    - `#cslab` is `role=dialog aria-modal`; `#picker` is `role=dialog`.
  - **Block 1 is untouched** between its markers; only the file's header
    comment outside the slice changed.
  - **Block 2.**
    - The crest's hues are computed as Crest.sol computes them and written
      to `--h` / `--h2` before first paint. This replaces V1's `id × 137`
      accent.
    - One SVG helper `sv()` draws the QR (identical attributes, identical
      order; the module map's pinned keccak still holds), the crest and the
      dock's marks. The namespace literal therefore still occurs exactly
      once in `dist/`.
    - The facts and the slab were restructured: disclosures, order, focus.
    - `art()`, `soul()`, `celebrate()`, the pointer and gyroscope lean, and
      the rooms (`ROOMS`, `ORDER`, `SHEET`, `lit()`, `unsheet()`) were added.
      The soul's `run()` writes `html.alive`.
    - `paintNav()` and `show()` were extended: labels and marks,
      `aria-current`, `#body[data-room]`, the lit indicator, a bloom, scroll
      to top.
    - The wallet cell is a keyboard control outside the viewer, and the
      picker focuses its first wallet.
- **`engine/app.css`** was rewritten. The design is the prototype's,
  adapted. Its prose header states every rule the light keeps (the motion
  policy and the scroll padding among them) and the z-order.
- **`tools/build-app.mjs`** — the two ceilings and their reason only:
  `SHELL_GZIP_CEILING` 15,000 → 24,000 and `PANEL_GZIP_CEILING`
  8,192 → 12,288. The header now records the slopes measured above.
- **`tools/verify-site.mjs`** — the ceiling sentence's number only. It now
  reads `the shell's gzip is under the 24,000 ceiling (${…} B)`, and the
  condition reads `<= 24_000`.
- **`tools/verify-site/boot.mjs:92`** — the coordinator approved this one
  change: the literal `15_000` → `24_000`, kept as a literal (an independent
  copy that catches an accidental raise in build-app.mjs). The sentence's
  text is exactly as it was. This line was a second copy of the ceiling and
  failed any V2 shell.
- **`docs/v2/shots/`** holds 17 PNGs (see §7) and **`docs/v2/W7-shell.md`**
  is this report.

## 4. Design decisions, each with its reason

1. **The dock is `#lanes`, laid out as `display: contents` inside `#dock`.**
   CONSOLE §6.1 promises every `#lanes a[data-lane=<name>]`, and both
   suites count them: five in the console without a card, and none or all
   aria-disabled in the viewer. Making the dock the same links keeps every
   promise. Home is `<a id="home">` outside `#lanes`, so neither count
   moves. The order is fixed by `ORDER`, not by the Engine's panel index.
2. **Identity is a sheet and the agent lane a door, both opened from the
   crest bar.** They are the same `#lanes` links, positioned fixed by the
   stylesheet: the token's own orb for identity, a door glyph for the agent.
   - The dock (z 29) is above the crest bar (z 28), because a fixed child is
     trapped in its fixed parent's stacking context.
   - The dock's glass is on `#dock::before`, not on `#dock`. A
     `backdrop-filter` on `#dock` would make it the containing block of its
     fixed children.
   - On a phone the sheet rises from the bottom over the frame; from 760 px
     it is a drawer on the right.
   - Closing it (✕, the scrim, Escape) returns to the room it was opened
     from.
3. **The room is written on `#body[data-room=home|room|sheet]`** rather than
   inferred with `:has()`. The layout reads one attribute, and the shim (no
   CSS) and the suites never see a difference: `.on` is still the class
   every test reads.
4. **Room titles live in `#room`, outside the lane sections.** Panels
   `replaceChildren()` their host, and the suites read whole-lane
   `textContent` (`#lane-swap` must not contain "function", and must hold
   exactly two 32-byte words on a refusal). So nothing is added inside a
   `#lane-<name>`. Card headings on Home (`at a glance`, `what this chain
   carries`, `open it anywhere`) are CSS-generated for the same reason.
5. **The slab's sentence moved to the top; the technical facts moved behind
   a `<details>`.** This is the V2 §2 order: plain words first, then the
   facts, then one button. Nothing the suites read moved out of `#cslab`:
   - with no lines, the first `.kv .k` is still `To`;
   - a panel's lines still precede `Function`;
   - `unlimited` still occurs once.

   The estimate stays outside the disclosure, because a revert there is the
   reason Sign stays disabled and must be read. **Value** also stays
   outside: money leaving is never one tap away.
6. **Home's facts split the same way.** The facts a person reads first
   (held by, custody epoch, status, locked, seal, market, name) stay in
   view, and the proof (id, chain, Reach, Grip, fingerprint, engine,
   catalog, block) sits in a `<details>`. That disclosure remembers being
   open across the repaints every `rightsOf` triggers. Every `[data-fact]`
   is still under `#facts`, as a text node.
7. **The crest is drawn by the shell, not fetched.** `img-src` admits only
   `data:` and `blob:`. A route fetch is refused in the viewer, and an
   `eth_call` for `tokenURIAt` would add a read the suites count. Drawing it
   from four baked numbers, as Crest.sol does, costs about 400 B. It is also
   the same image the token shows everywhere.
8. **The sky's seed is `keccak(fingerprint ‖ keccak("intact.crest", id))`, not
   the fingerprint alone.** It was measured: #1, #2 and #3 of one holder
   share the fingerprint `0xed15…`, because `getStateFingerprint` hashes
   the holder and the state, not the id. The fingerprint alone would have
   given them one sky. The id makes every sky its own, and a moved
   fingerprint still moves it.
9. **The light moves only where it is cheap, and one class says where.**
   - **A software rasteriser is named, not timed.** When
     `WEBGL_debug_renderer_info` reports SwiftShader, llvmpipe or
     "software", the soul draws one still at 0.25× and times nothing.
     Anywhere else, one frame after a warm-up frame is timed through a
     1-pixel `readPixels`; slower than 22 ms, it keeps that frame as a still
     at 0.55×, and otherwise it runs at about 30 fps.
   - **Why named.** In the battery's SwiftShader the shader compiles in
     about 140 ms and then takes about 395 ms a frame at 0.55× (80 ms at
     0.25×). Timing it there cost about 1.5 s on every page. Named, the
     start-up measured a median of 23.6 ms over six loads (at most
     55.2 ms).
   - **`html.alive` is set exactly while the soul's loop runs**, and the
     stylesheet pauses every endless animation without it: the frame's
     spin and the Sign button's flow. A probe summed the CPU time of every
     browser process (utime and stime from `/proc`) over 6–8 s windows of
     an idle console:
     - with the frame spinning, 75–93 % of a core across seven windows;
     - with the spin made a compositor transform instead of a painted
       custom property, still 76–90 %, because a software compositor
       redraws every frame;
     - with the spin stopped, 0.2–0.3 %;
     - the final build, 0.3–0.9 %, where V1 reads 0.0–1.3 % in the same
       run.
   - **It was checked in Chromium** by a probe that spoofs the renderer
     name and makes `readPixels` a no-op, so the timed frame passes (7
     passed, 0 failed):
     - software GL is a still, with no `html.alive`, and the frame and the
       Sign button paused;
     - a GPU sets `html.alive` and the frame spins and the button flows;
     - a hidden tab pauses both, and they resume when it is shown;
     - a GPU under reduced motion animates nothing.
   - **The battery.** Its ten groups took 299 s on the final build,
     against 197 s for the V1 baseline. The machine was shared: the load
     average was 2.6–3.4 during this run and about 1.5 during the
     baseline.
     - Nine groups took 1.09–1.55× their baseline times.
     - Run alone, the viewer group took 46.0 s, against 12.4 s for V1's
       shell run alone just before it. A probe of its button sweep found
       that 32.5 s of the gap is one harness wait, not the light. When the
       sweep presses a sheet's ✕, the sheet closes, and `textContent()` on
       the next button waits out its default 30 s (request 6).
   - On a real GPU the sky animates and the frame spins. The sparks of a
     celebration (1.6 s) still fly everywhere except under reduced motion.
10. **The shader's palette is computed in GLSL.** A CSS-equivalent `hsl()`
    takes one `vec2` of hues, instead of a JS conversion feeding four
    uniforms. That is smaller, and the colours are exactly the prototype's
    (266/146 for #1).
11. **The celebration's ticker line extends V1's sentence and never replaces
    it.**
    - Every suite matches `landed in block` by regular expression and never
      exactly.
    - Every other ticker sentence is matched exactly, and none of them
      changed.
    - `ownership or epoch changed — review again` still follows when it
      applies.
    - The vibration is guarded by `navigator.userActivation.hasBeenActive`,
      so no browser logs an intervention.
12. **No light theme.** The soul is dark. A light sky would need a second
    palette and every contrast pair re-proved, and "only if it costs
    nothing" was not met.
13. **Bytes.** The first build was 22,479 B. Three things brought it to
    21,793 B:
    - the stylesheet was rewritten with shared gradient stops (`--iri`,
      `--pale`), mono applied by container, and line clamps only where
      measured to be needed;
    - the hue conversion moved into the shader;
    - the room lines were shortened.

    Naming the software rasteriser, the motion policy and the scroll
    padding then added 156 B. The final 21,949 B leaves 2,051 B under the
    ceiling for the lanes still to come.
14. **Focus never lands under the bars.** The crest bar and the dock are
    fixed over the page, and a browser scrolls a newly focused control only
    as far as the window's edge.
    - It was measured by a probe that pressed Tab 60 times in every room at
      390×844 and 1440×900, and sampled a 5×5 grid over each focused box.
    - Before the fix, 5 controls were wholly hidden under the dock on the
      phone (vault and social controls at y 753–831 of 844), and 61 were
      partly covered across both sizes. That fails WCAG 2.2 SC 2.4.11 (AA).
    - `html` now carries a `scroll-padding` equal to the body's own
      clearance (84 px above, 170 px below, plus the safe areas). So every
      scroll into view, by the keyboard or anything else, stops clear of
      the crest bar, the dock and the ticker.
    - After the fix, 496 focuses across the five rooms and both sheets:
      none hidden and none partly covered. It costs 11 B.

## 5. The promises kept

- **textContent only.** Nothing is assigned through `innerHTML`; the shim's
  tripwire count stayed 0 in every group. Chain strings and the crest's text
  go through `textContent`.
- **No host.** `dist/` names no host. `www.w3` occurs once and `fetch(`
  once; the build's scan and verify-site B hold both.
- **The loader and the panel contract** (§5) are unchanged.
- **BigInt and the chain's clock** are untouched. The light uses
  `performance.now` and `requestAnimationFrame` only to animate.
- **CSP.** The meta CSP is unchanged: WebGL and canvas need no new source,
  and no violation was logged in Chromium.
- **The six boot-mode facts hold:** viewer, console, session, the picker,
  the chain gate and the footer.
  - The viewer still has no `#connect`, `#switch`, `[data-go]` or
    `[data-act]`.
  - Pressing every visible button in every lane of the viewer still prompts
    nothing.
  - The picker's backdrop still takes the click at (6, 6), because it is
    z 60.

## 6. Accessibility

- **Contrast**, measured, not assumed. A Chromium probe made every
  text node transparent and screenshotted the bare backgrounds: the frosted
  glass over the real shader sky, or a button's own fill. It then computed
  WCAG contrast against the worst background pixel in each text box, across
  three tokens (three skies) × six rooms. Text inside a closed disclosure
  was excluded, since it is not painted.
  - The first pass found `--dim` labels at 4.29:1. `--dim` was lifted to
    `#c6c0de` and the glass tint to `.75`.
  - The final run, on the final build, measured 405 text boxes at
    390×844 and 550 at 1440×900, and none is under AA. The lowest is
    4.90:1, an 11 px label over #2's sky at phone size.
  - One more box is under AA and not counted: the trade room's "Swap"
    button while it is disabled (opacity .42, before an amount is typed).
    WCAG 1.4.3 exempts an inactive control.
  - Gradient headings are measured against their darkest stop.
- **Focus.**
  - Every control has a 2 px `:focus-visible` ring in the accent.
  - A focused control is never hidden under the crest bar or the dock
    (decision 14).
  - The slab takes focus when it opens (`preventScroll`), and gives it back
    to what opened it.
  - The picker focuses its first wallet.
  - The wallet cell is `role=button tabindex=0` with Enter and Space,
    outside the viewer.
  - Disabled lane links leave the tab order.
- **Names and states.**
  - The dock is `nav[aria-label=rooms]`, and the room in use carries
    `aria-current=true`.
  - The orb and the door carry their names as text (visually hidden) and as
    a tooltip.
  - Marks and canvases are `aria-hidden`; the crest is
    `svg[role=img][aria-label]`.
  - The ticker is a polite live region, and `✕` is labelled "close".
- **Motion.**
  - Under `prefers-reduced-motion` the sky is a still, the frame neither
    spins nor tilts, and sheets appear without sliding.
  - A landing is the glow's fade only. This was measured: no `#spark`
    canvas, `html.landed` set, and 0 animation frames.
  - Where the sky cannot move cheaply, nothing loops (decision 9).
- **Without WebGL** (Chromium with WebGL disabled) the CSS sky stands in, no
  canvas is created and nothing throws.
- **Layout.** At 390 px the document's `scrollWidth` is 390 in every room,
  and at 1440 it is 1440. Inputs are 16 px, so iOS does not zoom on focus.

## 7. Screenshots

Every screenshot is in `docs/v2/shots/`. They were taken with Playwright
against the final built document, served the way `tools/verify-console.mjs`
serves it: its own `fresh()` (an in-process chain, `deploySite` from `dist/`,
the in-process gateway on 127.0.0.1, the shim's wallet over EIP-6963). The
cast: #1 with an open WETH/ETH market, a funded Reach, two words in the
commons, and the AgentCard deployed (so the door shows).

The views were taken at 390×844 and 1440×900:

- `phone-home.png` and `desktop-home.png` show Home: the crest in its frame,
  over the soul.
- `*-trade.png`, `*-vault.png`, `*-social.png` and `*-studio.png` show the
  four rooms.
- `*-identity-sheet.png` shows the identity sheet.
- `*-slab-sheet.png` shows the slab open, and `*-slab-facts.png` the same
  slab with **the facts it signs** expanded.
- `phone-landed.png` shows the celebration: a swap signed and landed, the
  ticker naming it, the sparks in flight.

This headless Chromium renders WebGL through SwiftShader. So the soul holds
a still at 0.25× and the frame's ring rests (decision 9), and the images
show one frame of the sky.

## 8. Requests for files this unit does not own

1. **`docs/CONSOLE.md`**
   - **§6.1, new shell rows:**
     - `#stage`, `#frame`, `#art` (the crest, `svg[role=img]`) and `#badge`;
     - `#intro`;
     - `#room` with `#room-t`, `#room-s` and `#room-x`;
     - `#dock`, `#home` (Home's anchor, outside `#lanes`) and `#lit`;
     - `#scrim`;
     - `#soul` (a canvas, created only with WebGL, after `ready`);
     - `#spark` (a canvas, created at the first celebration);
     - `#body[data-room=home|room|sheet]`;
     - `html.landed` during a celebration;
     - `html.alive` exactly while the soul's loop runs.
   - **§6.1, `#lanes`:** it is inside `#dock`, links are labelled
     Trade/Vault/Social/Studio/Identity/Agent with a mark, and the order is
     swap, vault, social, launch, then identity, agent. Aria-disabled links
     also carry `tabindex=-1`, and the link of the room in use carries
     `aria-current=true`.
   - **§6.1, `#facts`:** a `<details>` "the proof" now holds `id chain reach
     grip fingerprint engine catalog block`.
   - **§4.2:** the slab's order is now `h3`, `[data-sentence]`, the lines,
     `Value`, then `details` "the facts it signs" holding To, Function,
     Selector, args, `[data-calldata]`, Digest and Engine; then Gas, the
     note, `[data-go]` and `[data-no]`. Add that `#cslab` is a dialog that
     takes focus.
   - **§4.6:** a landing reads `landed in block <n> — <tx.sentence>`.
   - **§8:** `#verified` now sits at the end of the page flow.
   - **§16:** the numbers of §2 above.
2. **`CLAUDE.md`**
   - **The rules line.** Change "a shell over 15,000 B gzip or a panel over
     8,192 B" to 24,000 and 12,288.
   - **The ceiling trap.** It currently says "The shell is 45 B under its
     gzip ceiling (14,955 of 15,000) …"; it should say 21,949 of 24,000. The
     identity panel is 8,185 of 12,288.
   - **New trap: the soul runs in the battery.** The battery's Chromium has
     WebGL through SwiftShader, so the soul starts on every page. Naming the
     software rasteriser is what keeps the battery's CPU flat: one still at
     0.25×, no timed frame, no `html.alive`. Time a change to the shader on
     a real GPU as well as here.
   - **New trap: nothing may loop without `html.alive`.** An endless CSS
     animation keeps this Chromium's compositor at about 80 % of a core
     for as long as a page is open (measured, decision 9). Any animation
     added to the shell or a panel that never ends must be paused unless
     `html.alive`.
   - **New trap: Home is outside `#lanes`.** Nothing added to the dock may be
     an `a[data-lane]` inside `#lanes` unless it is a lane, or both suites'
     counts move.
   - **New trap: the bars are fixed over the page.** html's
     `scroll-padding` must keep the body's clearance. If the crest bar or
     the dock grows, both numbers move together, or focus lands under them
     again (decision 14).
3. **`docs/INVARIANTS.md`**
   - **F2.** Rewrite it from §2's derivation (24,000; /hash 2.333 M of 2.5 M
     at the ceiling; slopes 123.1 / 29.4 / 26.3 from 21,949 B). The
     coordinator will do this at integration.
   - **New rows, pending** until a Chromium sentence holds each:
     - the soul never starts before `ready`;
     - it is a still under reduced motion and without a fast GPU, and
       absent without WebGL;
     - nothing loops without `html.alive`, and `html.alive` is unset on
       software GL, under reduced motion and in a hidden tab;
     - a landing celebrates and a revert does not;
     - a focused control is never wholly hidden under the crest bar or the
       dock;
     - `#lanes a[data-lane]` stays the dock.
4. **`src/Engine.sol`**
   - `PANELS = 6` is a constant (line 60). Arrays are sized by it
     (lines 61–62), and it is checked at lines 112, 137, 162, 170, 174 and
     194–197.
   - V2.md §4 makes it an array of up to eight, and the Gallery lane (W8)
     needs a seventh.
   - **`src/Premises.sol`** loops `i < 6` at lines 313 and 415, and
     **`src/Catalog.sol`** at line 1114.
   - **`tools/build-app.mjs`, `tools/site.mjs` and `tools/gas.mjs`** each
     list the six panels by name, and a seventh must be added to all three.
     build-app.mjs is mine only for its ceilings.
   - **The shell itself** needs nothing for a seventh panel: it derives its
     lanes from `INTACT.panels`. The Gallery lane's unit would add one
     `ROOMS`/`ORDER`/`ICON` entry (about 100 B).
5. **`DESIGN.md` §5.5**: the ceilings, 24,000 and 12,288.
6. **`tools/verify-console.mjs`**
   - **B′, the viewer's button sweep (line 757).** `b.textContent()` has
     no timeout, unlike the `click` beside it. In V2 a sheet has a ✕
     button, and pressing it closes the sheet, so the sweep's remaining
     `nth(i)` locators match nothing. The next `textContent()` then waits
     its default 30 s inside the `try`. Measured: 32.5 s of the group's
     46.0 s. Give it `{ timeout: 1500 }` as well, or count the visible
     buttons again after each press.
   - **Chromium sentences for the light**, the rows of request 3. All of
     them are measured here by hand (§6), none by the battery.
     - The motion rows can be taken from decision 9's probe: spoof
       `UNMASKED_RENDERER_WEBGL` (0x9246) in an init script and make
       `readPixels` a no-op, then read `html.alive` and the computed
       `animationPlayState` of `#frame`.
     - The focus row can be taken from decision 14's probe: press Tab
       through each room at 390×844 and sample the focused box with
       `elementFromPoint`.
7. **`engine/panels/vault.js`**: the pre-existing observation the battery
   prints. The Grip's copy button throws in a `data:` frame because
   `navigator.clipboard` is undefined there. It is unchanged by this unit
   and present in the baseline.
8. **The lanes (W8–W12)**:
   - `.card` is available for a lane that wants its own glass.
   - An `h3`-led `div` directly under a lane section is drawn as a soft
     inner well, and a flat lane reads as one glass panel divided by its
     headings.
   - An endless animation must wait for `html.alive` (request 2).
