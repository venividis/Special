# W14 · the polish pass: the shell, the slab and the lanes

V2 integration, unit W14. It answers the lanes' requests L3, L4, L6, L7,
L13 and L15 of `docs/v2/INTEGRATION.md`, and W12's requests 2, 3, 6 and 9
(`docs/v2/W12-studio.md` §6). It was built on cd5ef1f on 2026-10-19.

This unit owns:
- `engine/app.html` and `engine/app.css`;
- the lane panels an item needed: swap, social, launch, vault, identity
  and gallery (the agent panel is untouched);
- `tools/verify-site/*.mjs` and `tools/verify-console.mjs`;
- `tools/testnet-drive.mjs`, for items 8 and 9;
- this report.

Every number below was measured on this tree, and each says which run
printed it.

## 1. The items, each with its proof

**How each item was proved.** The tree was copied into a scratchpad, with
`node_modules` linked and `out/` copied so the compile cache hit. In that
copy, the item's change was undone by its exact text. The groups that hold
the item were then run there, and the sentence below failed. Items whose
sentences sit in different groups or blocks were undone together in one
batch. Every failure in a batch belongs to exactly one undone item or is
an aggregate of it, and §8 lists the batches.

### Item 1 · L3: a full address wraps on a 390 px screen

**What changed.** `engine/app.css`: `#cslab [data-sentence]` gains
`overflow-wrap:anywhere`, merged into its existing rule. `#cslab .k` gains
the same, for item 4: a tuple's type in a row's key has no space to break
at.

**Sentence.** `tools/verify-console.mjs` · boot R, on the mint's slab,
whose sentence carries the minter's full address, at 390 × 844 after the
sheet's slide:
- *"at 390 px a signing sentence that carries a full address wraps inside
  the sheet: its box does not overflow and no word runs past the edge"*.

**Proof.** Undone, boot read 37 passed, 3 failed. This sentence failed
with `"sw":490,"cw":348,"textRight":511,"slabRight":390`: the address ran
121 px past the sheet's edge. The other two failures are item 9's, from
the same batch.

### Item 2 · L4: the panels' styles move into the shell

**Swap.** `engine/panels/swap.js` no longer writes `<style id=swap-style>`.
Its five rules are now in `engine/app.css`, under a new section, "the
lanes' own light":
- `button[role=switch]`, and its `::after` knob;
- `[role=switch][aria-checked=true]::after`;
- `#swap-say`;
- `#swap-kept .keepsake::before`.

Two of these stay narrow on purpose:
- The switch is shared vocabulary for a *button* with role=switch. The
  Gallery's include-OpenSea control is a disabled checkbox input with the
  same role, and the selector leaves that input's look alone.
- The orb stays scoped to `#swap-kept`. The Vault's `.keepsake` is a card
  that carries the real orb, an image, and a global rule would draw a
  second one.

**Social.** In `engine/panels/social.js`, the Agora row's `style.cssText`
becomes the class `post`. `app.css` draws it:
`.post{padding:10px 0;border-bottom:1px solid var(--line)}`.

**Sentences.**
- `tools/verify-site/swap.mjs` · V1: *"the lane writes no stylesheet of its
  own: the switch's knob, the one breath and the keepsake's orb are rules
  of the shell's"*.
- `tools/verify-site/social.mjs` · A: *"an Agora post is drawn by the
  shell's .post rule: the row carries the class and no style of its own"*.
- `tools/verify-console.mjs` · swap V: *"in Chromium the switch is the
  shell's: a row with its knob 40 × 22 px, on the token's two hues once
  turned on, the one breath at 17 px, and the panel wrote no stylesheet"*.
- `tools/verify-console.mjs` · social A: *"in Chromium an Agora post is
  drawn by the shell's .post rule: 10 px above and below, a rule beneath,
  and no style of the row's own"*.

**Proof.** The change was undone both ways: the panel's style restored,
and the shell's rules removed.
- verify-site: swap read 145 passed, 1 failed (`#swap-style true · 2 style
  element(s)`), and social 124 passed, 1 failed.
- verify-console: swap read 32 passed, 1 failed. Every computed value
  matched the shell's rules (`flex`, `12px 14px`, knob `40px 22px`, on,
  `17px`), and only `styles 2, own true` differed. So the move kept the
  look exactly.
- verify-console: social read 31 passed, 1 failed. The inline style was
  back, and the computed `10px / 0px / 1px solid` were the same.

### Item 3 · W12-2 and W12-3: the Studio's line, and a QR in a lane

**W12-2, what changed.** `ROOMS.launch` now reads *"Launch a collection of
websites, or a coin."*

**W12-2, sentence.** `tools/verify-site/launch.mjs` · M: *"the Studio
room's line says what it launches: Launch a collection of websites, or a
coin."*

**W12-2, proof.** Undone, launch read 115 passed, 1 failed. The detail
read the old line.

**W12-3, what changed.**
- The shell's `qr()` names every code it draws with the class `qr`.
- `app.css` adds
  `.qr{display:block;width:184px;max-width:100%;border-radius:16px;background:#fff}`.
- On Home, `#qr svg` keeps its own size inside the white `#qr` card, by
  higher specificity.
- The launch panel drops its `style` attribute.
- W12 proposed `#lane svg[role=img]`. That selector would also whiten the
  Gallery's constellation, which is an `svg[role=img]` in a lane, so the
  hook is the class instead.

**W12-3, sentences.**
- `tools/verify-site/vault.mjs` · K9: *"the Grip's QR carries the shell's qr
  class, the white 184 px card the shipped stylesheet draws under a code
  in a lane"*.
- `tools/verify-site/launch.mjs` · W: *"the QR encodes the mint link,
  decoded apart from the shell, on a light ground"*. The text is
  unchanged. Its condition now reads the class, no style of its own, and
  the shipped `.qr` rule.
- `tools/verify-console.mjs` · vault K: *"in the lane itself the Grip's QR
  is painted on a white card, 184 px square, and the code read off the
  screen where it stands decodes to ethereum:<grip>@1"*. A new helper,
  `qrInPlace`, screenshots the code where it stands. The existing
  `qrDecode` paints a copy on white, so it cannot see a dark ground.
- `tools/verify-console.mjs` · launch W keeps its sentence, *"it landed
  where it was shown, and its row prints the mint link and a QR Chromium
  paints on white and jsqr reads back as the link"*. It reads
  `rgb(255, 255, 255) 184`, now from the shell's rule.

**W12-3, proof.** Undone (the class, the rule, and the launch panel's
style restored):
- verify-site: vault read 109 passed, 2 failed (`class "null"`, plus item
  4's line, same batch), and launch read 115 passed, 1 failed.
- verify-console: vault read 32 passed, 2 failed, with
  `"bg":"rgba(0, 0, 0, 0)","w":544,"h":544`, the code 544 px wide, and
  `0 % light`.
- jsqr still decoded that dark-on-dark code, because it also tries the
  inverted image. The white card is therefore held by the computed
  background, the 184 px box and the light-pixel share, not by the decode.

### Item 4 · L7: the slab

**(a) An exact approval names its spender.**

*What changed.* In `approveExactThen`, a step's optional `who` names the
one who pulls: *Lets · `<who>` pull exactly `<amount>`*. Without it, the
line is V1's, *the market*. V1's callers are unchanged: the Pool's
approvals, the social lane's postage and the launch lane's locks. Three
callers now pass a label:
- swap: a locked swap's approval to the Keepsake, *"the Keepsake"*;
- vault: wrap, *"the Keepsake"*;
- gallery: an ERC-20 price, approved to Seaport, *"Seaport"*.

*Sentences.*
- `tools/verify-site/swap.mjs` · F: *"the market's exact approve keeps
  V1's line: Lets · the market pull exactly 1 WETH"*. It holds either
  way: it is the guard that no V1 line moved.
- `tools/verify-site/swap.mjs` · V2: *"locked, the exact approval's line
  names who pulls it: Lets · the Keepsake pull exactly 1 WETH"*.
- `tools/verify-site/vault.mjs` · V1: *"the exact approval's line names
  who pulls it: Lets · the Keepsake pull exactly 500 USDC"*.
- `tools/verify-site/gallery.mjs` · N: *"an NFT priced in WETH asks an
  exact approval first, and its line names who pulls it: Lets · Seaport
  pull exactly 0.05 WETH"*. N is a new block: a MockERC721 listed on
  Seaport for 0.05 WETH, validated from the offerer, and published to the
  Bazaar as an open order. Until N, no suite reached the Gallery's ERC-20
  buy.
- `tools/verify-console.mjs` · vault V: *"in Chromium the exact approval's
  line names who pulls it: Lets · the Keepsake pull exactly 100 USDC"*.

*Proof.* Undone, each of the four read *"the market pull exactly …"*:
- verify-site: swap 145 passed, 1 failed; vault 109 passed, 2 failed (with
  item 3's); gallery 49 passed, 1 failed;
- verify-console: vault 32 passed, 2 failed (with item 3's).

The F sentence held in that batch, as a guard should.

**(b) Argument rows for tuple arguments.**

*What changed.* The slab draws one `[data-arg]` row per argument for every
signature its decoder reads, tuples and arrays of tuples included. The
`simple()` gate is gone, which removes a line from the shell. A tuple's
row is written in brackets, field by field, in the same words as before:
- addresses checksummed;
- numbers decimal;
- booleans as words;
- bytes as their length.

The rows sit inside *the facts it signs*. A 390 px screenshot of an
`executeBatch` slab, with its fold open, showed:
- the row's key, `ARG 0 · (ADDRESS,UINT256,BYTES)[]`, wrapping in its
  45 % column;
- the value wrapping too;
- no `.kv` row overflowing.

*The suites' decoder.* `argWords(sig, calldata)` is exported from
`tools/verify-console.mjs`, and the verify-site groups import it. It is
the suites' own head/tail decoder, apart from the shell's. It was checked
against `tools/evm.mjs`'s encoder on five shapes:
- a static call;
- `executeBatch`;
- `grantSession`;
- `swapAndWrap`'s nested dynamic tuple;
- `(int256, bytes32, string[], uint64[4])`.

`pg.argsAgree(sig)` and each group's `argsAgree` hold the rows to it.

*Assertions.* Eleven assertions held *no rows for a tuple*. Each now holds
the rows to `argWords`:
- verify-site swap (`executeTyped`, `swapAndWrap`);
- verify-site launch (`createChecked`, the Studio's `launch`);
- verify-site vault (K24 `executeBatch`, K13 `grantSession`, `wrap`);
- verify-site gallery (`validate`);
- verify-console swap V, launch W, and the journey's `createChecked`.

Five sentence texts stated the old contract and are restated (§4).

*Proof.* With `simple()` restored, every one of the eleven failed:
- verify-site: swap 143 passed, 3 failed; launch 114 passed, 2 failed;
  vault 105 passed, 6 failed (three row assertions and their aggregates);
  gallery 49 passed, 1 failed;
- verify-console: swap 31 passed, 2 failed, and journey 29 passed, 2
  failed, each the row assertion and its aggregate; launch 20 passed, 2
  failed, the row assertion and item 8's sentence.

### Item 5 · L6: the identity lane on an Agora band

**What changed.** In `engine/panels/identity.js`, where
`S.reported & S.bits.agora`, the lane:
- declares `agora.keyOf` and `agora.bindKey`;
- draws `#identity-agora-key` ("bound key · Agora") under Parley's
  `#identity-key`, in the same words. It reads it from
  `agora.keyOf(persona)`, where persona = `hub << 96 | id`;
- offers `[data-act=agoraBindKey]` beside Parley's `bindKey`, once the
  registry key is published. The act is `agora.bindKey(persona)`, with the
  sentence *"binds this wallet's registry key to #1 in Agora at custody
  epoch 1; a sale or a panic unbinds it"*.

A band without Agora declares nothing of Agora's and draws V1's rows. The
two reads are separate, so one failing never hides the other.

**Sentences.** `tools/verify-site/identity.mjs` · H, a new block:
- *"on a band without Agora the key section is V1's: Parley's bound key
  and no Agora row or control"*;
- *"where Agora reports, the lane reads the token's key there too, under
  its persona: no key bound beside Parley's, and no binding offered before
  a key is published"*;
- *"the Agora binding is bindKey(#1's persona) to Agora, stamped with
  custody epoch 1 in its sentence, beside Parley's bindKey(1)"*;
- *"Sign → Agora's keyOf(persona) answers (3, keccak(pk), pk) and the lane
  reads bound at epoch 1 under Agora, Parley's still unbound"*.

**Proof.** Undone, identity read 95 passed, 2 failed:
- the second sentence failed (`agora "" parley "no key bound"`);
- then the group stopped, by name, at the wait for the
  `agoraBindKey` control.

The first undone run of this block found L15's own fault in my new code:
- The second sentence did not check the Agora row itself; only the wait
  before it did.
- It now checks the row, and that wait is soft, with its reason in a
  comment.

### Item 6 · W12-9: the Gallery takes both forms of `?via=`

**What changed.** In `engine/panels/gallery.js`, a `?via=` below 2^96 is a
hub token's number, which is what the Studio lane's link carries. It is
taken as that token's persona, `hub << 96 | n`. A number at or above 2^96
is a persona as it stands. The two forms never overlap.

**Sentence.** `tools/verify-site/gallery.mjs` · D: *"a link's ?via= that
is a token's number, as the Studio lane's link carries it, names that
token's persona: ?via=2 mints through #2's"*.

**Proof.** Undone, gallery read 49 passed, 1 failed (`"persona 2 (from
the link's ?via=)" · via word 2`).

### Item 7 · L13: the viewer drops the clipboard observation

**What changed.** In verify-console's viewer B′:
- the `t.note`, the `clipboard|writeText` filters and the set-aside clause
  are gone;
- the file header no longer says the Grip's copy button throws there;
- the sentence now also checks that the copy button was among the buttons
  pressed: *"fetch was never called: no http request left the data: page,
  no CSP violation, and no script threw, the Grip's copy button among the
  buttons pressed"*.

**Proof.** This item changes a test, so its proof runs against the fix the
test now holds. W10's guard in `vault.js` was undone (the button calls
`navigator.clipboard.writeText` unguarded). The viewer then read 14
passed, 3 failed:
- this sentence failed with `copy pressed true TypeError: Cannot read
  properties of undefined (reading 'writeText')`;
- F5's two aggregates failed with it.

The observation used to set exactly that error aside.

### Item 8 · W12-6: the coin journey on a Studio band

**What changed.** `tools/verify-console.mjs` exports `toCoin(pg)`:
- Where `INTACT.reported & INTACT.bits.studio`, it presses
  `#lane-launch #launch-mode` *A coin* and waits for the coin form.
- Elsewhere it does nothing, because that room already opens on the coin.

`journey()` takes it before the coin form. `tools/testnet-drive.mjs` runs
`journey()`, so the drive presses it too, and its header says so. No other
change to the drive was needed for this item.

**Sentence.** `tools/verify-console.mjs` · launch W, on that group's
Studio band: *"where the Studio reports, the room opens on A collection
and the coin journey's step presses A coin: the coin form is in view, as
journey() and the drive over a wire take it"*.

**Proof.** With `toCoin` made a no-op, launch read 20 passed, 2 failed
(`opened "A collection" pressed false now "A collection"`), with item 4's
row assertion in the same batch.

### Item 9 · L15: verify-console's own waits, made honest

**It throws by name on a timeout.** `pg.until(cond, arg, ms, { soft })`
throws an `UntilTimeout` when the condition never held. The message names:
- the timeout;
- the group (`setGroup`, set by the runner before each group, and by
  `tools/testnet-drive.mjs` as *the journey over the wire*);
- the file's lines that waited (the helper, then its caller);
- the condition's source;
- what the ticker read.

A Playwright error inside the wait, such as a closed page, throws too,
with the error named. The group stops there, and its one failed line is
the wait's own message.

**A soft form keeps the old answer.** Of verify-console's 136 call sites,
129 throw by name and 7 are soft. `{ soft: true }` is used where the code
reads the answer, and each such call says why in a comment:
- `press`, which throws by its own name, the control pressed;
- social D's `grew`;
- swap V's `offered`;
- swap G's `open2`, raced inside the watcher's two seconds;
- gallery A's steps;
- the boot self-check;
- the `toCoin` proof, whose sentence reads the coin form itself.

verify-site has one more soft wait, in identity H, where the sentence also
reads the rows itself.

**The signs.**
- Every `sign` reads the receipt's sentence from the ticker's log. A
  `MutationObserver` in the page's hooks records every sentence the ticker
  says, in order. The sign no longer polls the text every 40 ms.
- A receipt that moves the epoch or the wallet's rights replaces *"landed
  in block n — …"* with *"ownership or epoch changed — review again"*
  within the same receipt (CONSOLE §4.7). W13's §7 named two such signs
  that passed by catching the landing in that window. They now pass
  `{ moved: true }`, which waits for the review sentence after the
  landing.
- There are four such signs, not two:
  - identity M (the Market buy);
  - vault L (the holder's panic);
  - gallery B (the Seaport buy of #1 on #1's own page, which W13's list
    missed);
  - the journey's sale, which `tools/testnet-drive.mjs` also runs over a
    wire.
- A sign without `moved` whose receipt ends on review again throws by
  name. So every sign says which of the two the page did, and the battery
  confirmed the classification: 225 passed, 0 failed.

**Claims only a wait had checked are now sentences.** All 136 call sites
were read against the sentences after them:
- Eleven existing sentences claimed what their wait checked, and their
  conditions now check it too. Their texts are unchanged:
  - boot B: the late wallet's picker offered both, and the pick connected
    (rights 1);
  - boot N: the `#switch` refresh reads rights 1;
  - agent C: the door's envelope carries *SESSION right yes*;
  - agent D: *SESSION right no*;
  - swap G: the sale under the open slab closed it;
  - swap V: the refusal's words under the switch;
  - social I: the derive control is what is offered;
  - identity M: the listing reads *0.25 ETH until …*;
  - vault K: the list says *nothing may leave*;
  - the journey: the walk shows the word;
  - gallery A: the lane says *listed: it shows above* and offers the
    cancel.
- One claim of the lane that no sentence stated is a new one, launch J:
  *"and once the clock answers as the chain does again, the countdown is
  back on the chain's own clock: about 1000 s, not 900"*.
- The rest are preconditions of the next action, which a throwing wait
  now enforces, or claims the next sentence re-checks.

**Self-checks.** Boot W, a new block, has three sentences:
- *"a wait in Chromium that times out throws, naming its timeout, its
  group, the line that waited and its condition"*;
- *"the soft form answers false where the wait would throw, and a wait
  that is met answers true"*;
- *"the ticker's log keeps a sentence the page replaced within the same
  task, though the ticker itself reads only the second"*.

**Proof.**
- With the old catch-all `until` and no log, boot read 37 passed, 3
  failed: *did not throw*, `[]`, and item 1's.
- With `{ moved: true }` removed from the panic's sign, vault threw:
  *"sign 1 in group vault: the receipt moved the epoch or the rights and
  the ticker said "ownership or epoch changed — review again" after
  "landed in block 21000001 — kills every delegated right on #1 …" — a
  sign after such a transaction passes { moved: true }"*. That message
  quotes both sentences, read from the log.

**The drive.** `tools/testnet-drive.mjs` was not run: it needs `npx
hardhat node`, and W13 noted the same. Over a wire:
- its journey now throws by name on a timeout;
- its sale's sign reads the log, so how fast the node answers the two
  reads after the landing no longer matters;
- it presses *A coin* where its record's Studio reports.

## 2. Bytes

`node tools/build-app.mjs`, before (cd5ef1f) and after (this tree):

| | Before | After | Change | Room under the ceiling |
|---|---|---|---|---|
| shell | 22,224 | 22,400 | +176 | 1,600 of 24,000 |
| swap | 12,044 | 11,650 | −394 | 638 of 12,288 |
| social | 12,160 | 12,114 | −46 | 174 |
| launch | 12,267 | 12,233 | −34 | 55 |
| vault | 12,209 | 12,217 | +8 | 71 |
| gallery | 12,209 | 12,233 | +24 | 55 |
| identity | 8,185 | 8,350 | +165 | 3,938 |
| agent | 4,883 | 4,883 | 0 | 7,405 |

- Swap, social and launch gave back 474 B. The shell's +176 B carries the
  moved rules, the `.qr` rule and class, the `who` label, the key-column
  wrap and the room's longer line, less the `simple()` gate it dropped.
- The vault's +8 and the gallery's +24 are the `who` labels and the
  `?via=` forms. Both panels are still under their ceilings.
- Moving the Gallery's static inline styles into `app.css` would give
  bytes back. That was not this unit's item, and it is a request in §7.

## 3. The suites' lines

| Run | cd5ef1f | This tree |
|---|---|---|
| `node tools/build-app.mjs` | shell 22,224 B | shell 22,400 B |
| `node tools/selftest.mjs` | 60 passed, 0 failed | 60 passed, 0 failed |
| `node tools/verify.mjs` | — | **253 passed, 0 failed** |
| `node tools/verify-site.mjs` | **805 passed, 0 failed** | **818 passed, 0 failed** |
| `node tools/verify-console.mjs` (Chromium 141.0.7390.37) | **215 passed, 0 failed** | **225 passed, 0 failed** |
| `node tools/static-audit.mjs` | static audit passed — 10 Solidity rules, 4 JS rules | the same |
| `node tools/invariants-check.mjs` | 225 passed, 0 failed | 225 passed, 0 failed |

Per group:
- verify-site, before → after: boot 133 → 133, swap 137 → 140, social
  118 → 119, launch 109 → 110, vault 103 → 105, identity 88 → 92, agent
  68 → 68, gallery 42 → 44.
- verify-console, before → after: boot 33 → 37, viewer 14, session 9,
  agent 6, swap 29 → 30, social 28 → 29, identity 13, vault 29 → 31,
  launch 17 → 19, journey 28, gallery 5.

The final full runs, on the tree committed with this report, are quoted
in §8.

## 4. Sentence texts that changed, and why

Item 4b makes the slab draw rows for tuples, so five sentences that stated
the old contract are restated. Each keeps its id and every other clause.

| File | Before | After |
|---|---|---|
| `verify-site/launch.mjs` (V1) | *createChecked carries the termsHash read in the same press; a tuple gets no [data-arg] rows, so every argument is a line* | *createChecked carries the termsHash read in the same press; every argument is a line, and the tuple's [data-arg] row is decoded from the calldata* |
| `verify-site/swap.mjs` (V1) | *spend and receive floors are … — in the bytes and in the words, with no argument rows for the tuple* | *spend and receive floors are … — in the bytes, in the words, and in the tuple's argument row decoded from the bytes* |
| `verify-site/vault.mjs` (V1) | *K24 … with a decoded array length of 2; a tuple gets no [data-arg] rows, so every call is a line* | *K24 … with a decoded array length of 2; every call is a line, and the batch's [data-arg] row is decoded from the calldata* |
| `verify-site/vault.mjs` (V1) | *K13 the exposure is printed before Sign — … — and, the tuple drawing no [data-arg] rows, every argument is a line* | *K13 the exposure is printed before Sign — … — and every argument is a line beside the [data-arg] rows decoded from the calldata* |
| `verify-site/launch.mjs` (W12) | *a tuple draws no [data-arg] rows, so every field of the spec is a line, and the calldata carries the persona and the salt the lines name* | *every field of the spec is a line beside the tuple's [data-arg] row decoded from the calldata, and the calldata carries the persona and the salt the lines name* |

Item 7 restates one more, in `verify-console.mjs` (V1):
- before: *fetch was never called: … and no script threw (the clipboard
  observation set aside)*;
- after: *… and no script threw, the Grip's copy button among the buttons
  pressed*.

Where the six are cited:
- `docs/INVARIANTS.md` and DESIGN §14 cite none of them;
  `tools/invariants-check.mjs` still reads 225 passed, 0 failed.
- A recursive grep of every `.md` file finds one citation only: W12's
  *proposed* row W12-3 (pending, in `docs/v2/W12-studio.md`) cites the
  last launch sentence's old text. §7 asks for its new one.

Every other V1 id and sentence text is as it was. Twelve existing
sentences gained a clause in their conditions (item 9, and the launch QR
of item 3), with their texts unchanged.

## 5. Element ids and names this unit adds

- **Identity** (on an Agora band only): `#identity-agora-key`
  ("bound key · Agora", *no key bound* / *bound at epoch e · P-256 · key
  0x…*) and `[data-act=agoraBindKey]`, need `HOLD`.
- **The shell:**
  - every QR the shell draws carries `class="qr"`;
  - `approveExactThen` steps take `who`;
  - `ROOMS.launch` reads *Launch a collection of websites, or a coin.*;
  - `app.css` gains `.qr`, `.post`, `button[role=switch]` and its knob,
    `#swap-say`, `#swap-kept .keepsake::before` and `#cslab .k`.
- **verify-console's page hooks** (harness only, not the page):
  `window.__ticks`.
- **verify-console's exports:** `argWords`, `qrInPlace`, `toCoin`,
  `setGroup` and `UntilTimeout`.

## 6. Proposed INVARIANTS rows (pending, W14)

| Row | Claim | Enforced by |
|---|---|---|
| W14-1 | A full address in a signing sentence wraps inside a 390 px sheet | `tools/verify-console.mjs` · *"at 390 px a signing sentence that carries a full address wraps inside the sheet: its box does not overflow and no word runs past the edge"* |
| W14-2 | No panel writes a stylesheet: the Trade lane's switch, breath and orb and the Social lane's post are the shell's rules, their look unchanged | `tools/verify-site/swap.mjs` · *"the lane writes no stylesheet of its own: the switch's knob, the one breath and the keepsake's orb are rules of the shell's"*; `tools/verify-site/social.mjs` · *"an Agora post is drawn by the shell's .post rule: the row carries the class and no style of its own"*; `tools/verify-console.mjs` · *"in Chromium the switch is the shell's: a row with its knob 40 × 22 px, on the token's two hues once turned on, the one breath at 17 px, and the panel wrote no stylesheet"*, *"in Chromium an Agora post is drawn by the shell's .post rule: 10 px above and below, a rule beneath, and no style of the row's own"* |
| W14-3 | The Studio room's line names both launches | `tools/verify-site/launch.mjs` · *"the Studio room's line says what it launches: Launch a collection of websites, or a coin."* |
| W14-4 | A QR in a lane is painted on a white card | `tools/verify-site/vault.mjs` · *"the Grip's QR carries the shell's qr class, the white 184 px card the shipped stylesheet draws under a code in a lane"*; `tools/verify-site/launch.mjs` · *"the QR encodes the mint link, decoded apart from the shell, on a light ground"*; `tools/verify-console.mjs` · *"in the lane itself the Grip's QR is painted on a white card, 184 px square, and the code read off the screen where it stands decodes to ethereum:<grip>@1"* |
| W14-5 | An exact approval's line names the one who pulls; a step that names none keeps V1's *the market* | `tools/verify-site/swap.mjs` · *"the market's exact approve keeps V1's line: Lets · the market pull exactly 1 WETH"*, *"locked, the exact approval's line names who pulls it: Lets · the Keepsake pull exactly 1 WETH"*; `tools/verify-site/vault.mjs` · *"the exact approval's line names who pulls it: Lets · the Keepsake pull exactly 500 USDC"*; `tools/verify-site/gallery.mjs` · *"an NFT priced in WETH asks an exact approval first, and its line names who pulls it: Lets · Seaport pull exactly 0.05 WETH"*; `tools/verify-console.mjs` · *"in Chromium the exact approval's line names who pulls it: Lets · the Keepsake pull exactly 100 USDC"* |
| W14-6 | The slab draws one row per argument, tuples and arrays of tuples included, each decoded from the calldata | `tools/verify-site/vault.mjs` · *"K24 two batch rows → executeBatch((address,uint256,bytes)[]) with a decoded array length of 2; every call is a line, and the batch's [data-arg] row is decoded from the calldata"*, *"K13 the exposure is printed before Sign — the native cap and each asset cap in words — and every argument is a line beside the [data-arg] rows decoded from the calldata"*; `tools/verify-site/launch.mjs` · *"createChecked carries the termsHash read in the same press; every argument is a line, and the tuple's [data-arg] row is decoded from the calldata"*; `tools/verify-site/swap.mjs` · *"spend and receive floors are the typed amount and the Router's own quote less half a percent — in the bytes, in the words, and in the tuple's argument row decoded from the bytes"*; `tools/verify-console.mjs` · *"the raise is createChecked with the terms hash read in the same press"* |
| W14-7 | On an Agora band the identity lane reads and binds the token's key through Agora under its persona; a band without Agora keeps V1's key section | `tools/verify-site/identity.mjs` · *"on a band without Agora the key section is V1's: Parley's bound key and no Agora row or control"*, *"where Agora reports, the lane reads the token's key there too, under its persona: no key bound beside Parley's, and no binding offered before a key is published"*, *"the Agora binding is bindKey(#1's persona) to Agora, stamped with custody epoch 1 in its sentence, beside Parley's bindKey(1)"*, *"Sign → Agora's keyOf(persona) answers (3, keccak(pk), pk) and the lane reads bound at epoch 1 under Agora, Parley's still unbound"* |
| W14-8 | The Gallery's mint takes a `?via=` token number as that token's persona | `tools/verify-site/gallery.mjs` · *"a link's ?via= that is a token's number, as the Studio lane's link carries it, names that token's persona: ?via=2 mints through #2's"* |
| W14-9 | In a data: frame the Grip's copy button is pressed and nothing throws | `tools/verify-console.mjs` · *"fetch was never called: no http request left the data: page, no CSP violation, and no script threw, the Grip's copy button among the buttons pressed"* |
| W14-10 | The coin journey reaches the coin form where the Studio reports | `tools/verify-console.mjs` · *"where the Studio reports, the room opens on A collection and the coin journey's step presses A coin: the coin form is in view, as journey() and the drive over a wire take it"* |
| W14-11 | verify-console's waits throw by name, the soft form answers, and a sign reads the ticker's log | `tools/verify-console.mjs` · *"a wait in Chromium that times out throws, naming its timeout, its group, the line that waited and its condition"*, *"the soft form answers false where the wait would throw, and a wait that is met answers true"*, *"the ticker's log keeps a sentence the page replaced within the same task, though the ticker itself reads only the second"* |

Each row's mutant is in §1. Each row is pending until the battery runs
it.

## 7. Requests for files this unit does not own

1. **`docs/CONSOLE.md`**
   - **§4.2:** the argument rows. *"When `sig` carries a tuple or a
     nested array the shell renders no `[data-arg]` rows"* is no longer
     true. Since W14 the shell renders one row per argument for every
     signature its decoder reads, a tuple or an array as brackets field
     by field. Bytes that will not decode draw no row. The panel's
     `lines` still carry every argument in words.
   - **§4, last paragraph, and §5's `approveExactThen` row:** a step's
     optional `who` (*"the Keepsake"*, *"Seaport"*) makes the line
     *Lets · `<who>` pull exactly …*. Without it, the line is *the
     market*.
   - **§6.2:**
     - identity: `#identity-agora-key` and `[data-act=agoraBindKey]`, on
       an Agora band;
     - vault: the Grip's QR is a white card (`.qr`).
   - **§13:** every code `qr()` draws carries `class="qr"`. Outside Home
     that class is its white 184 px card. Home's `#qr` is the card
     itself.
   - **§18:** the Studio room's line. The lanes' shared rules now live in
     `app.css`: the switch, `.post` and `.qr`.
   - **§16, the panels table:** the bytes of §2.
2. **`docs/INVARIANTS.md` and DESIGN §14:**
   - the rows of §6;
   - W12-3, when it lands, cites the restated sentence of §4.
3. **`docs/v2/INTEGRATION.md`:** L3, L4, L6, L7, L13 and L15, and W12's 2,
   3, 6 and 9, are done by W14.
   - L15's decision on testnet-drive holds: it now throws.
   - W13's §7 design question (does a person's own epoch-moving
     transaction keep its landing sentence?) is untouched. The suites now
     hold the specified behaviour in Chromium too, through `moved`.
4. **`CLAUDE.md`**
   - **The ceilings trap:**
     - the shell is 22,400 of 24,000;
     - swap 11,650, social 12,114, launch 12,233, vault 12,217, gallery
       12,233 and identity 8,350 of 12,288.
   - **New trap: a lane's style is the shell's.** A panel writes no
     `<style>` and no `style` attribute for a rule the shell can carry.
     The shared ones are `button[role=switch]`, `.post` and `.qr`.
   - **New trap: verify-console's waits throw by name.**
     - `{ soft: true }` is for a wait whose answer the caller reads.
     - A `sign` after a transaction that moves the epoch or the wallet's
       rights passes `{ moved: true }`. Without it, the sign throws when
       the receipt ends on *review again*, and that is how a sign learns
       which one it is.
     - A sign reads the ticker's log (`window.__ticks`), never one poll of
       its text.
   - **New trap: jsqr decodes an inverted code.** A QR test that wants a
     light ground reads the pixels or the computed background, not the
     decode alone.
5. **`engine/panels/gallery.js` (a later fix round, or W8):** its static
   inline styles could move into `app.css` as the swap's did, giving back
   bytes to a panel 55 B under its ceiling. Candidates:
   - the art's frame;
   - the iframe;
   - the price;
   - the constellation's card;
   - the memory row.
6. **`tools/verify-console.mjs` `journey()` on a V2 band (a follow-up):**
   the coin step is ready. The speak step still assumes Parley. Where
   Agora reports, the social lane opens on the feed, so the journey must
   tap the commons first and count Agora's `stateOf(0)`. Until then the
   drive cannot run the journey against a V2 record.
7. **`tools/testnet-drive.mjs` on a real wire:** it was not run here, as
   it needs `npx hardhat node`. Its first run should confirm the three
   behaviours of item 9.

## 8. How it was proved

**Baselines.** On cd5ef1f, before any change:
- `node tools/build-app.mjs`;
- `node tools/selftest.mjs`;
- `node tools/static-audit.mjs`;
- `node tools/invariants-check.mjs`;
- `node tools/verify-site.mjs`: 805 passed, 0 failed;
- `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/verify-console.mjs`:
  215 passed, 0 failed.

**The undo batches.** Each ran in the scratch copy, with its groups:

| Batch | Undone | Runs |
|---|---|---|
| A | items 2 (both), 3a, 5 (first form) and 6 | verify-site swap, social, launch, identity, gallery |
| B | items 3b, 4a and 5 (second form) | verify-site vault, launch, swap, gallery, identity |
| C | item 4b | verify-site swap, launch, vault, gallery |
| c1 | item 1, and item 9's catch-all `until` and its log | verify-console boot |
| c2 | items 2, 3b and 4a | verify-console swap, social, vault, launch |
| c3 | items 4b and 8 | verify-console swap, launch, journey |
| c4 | W10's copy guard (item 7) | verify-console viewer |
| c5 | item 9's `moved` on the panic | verify-console vault |

The results are in §1. The undo script (`revert.py`, kept in the
scratchpad, not committed) replaced each change by its exact text and
asserted that each text occurred exactly once.

**The final runs, on the committed code (bd95b0b; this report changes no
code):**

```sh
node tools/build-app.mjs            # shell 22,400 B of 24,000; panels as §2
node tools/selftest.mjs             # 60 passed, 0 failed
node tools/verify.mjs               # 253 passed, 0 failed
node tools/verify-site.mjs          # 818 passed, 0 failed (254 s of groups)
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/verify-console.mjs   # 225 passed, 0 failed (368 s of groups)
node tools/static-audit.mjs         # static audit passed — 10 Solidity rules, 4 JS rules
node tools/invariants-check.mjs     # 225 passed, 0 failed
```
