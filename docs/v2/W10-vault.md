# W10 · the Vault lane: Keepsakes

V2 wave 2, unit W10 (docs/V2.md §0 row 4, §2, §3.1, §5.3). The owner asked to
"lock coins together as bundles and be able to gift them and allow for slow
release as well", in an interface that is "extremely user friendly, art
within art". The Keepsake (W1) does it on chain; this unit puts it in the
console's Vault room. Files: `engine/panels/vault.js`,
`tools/verify-site/vault.mjs`, the vault group of `tools/verify-console.mjs`,
this report and `docs/v2/shots/vault-*.png`. Base: 2f17d92 (the tuple
encoder). Every number below was measured on this tree on 2026-10-19, and
each says which run printed it.

## 1. What the lane does

A **Keepsakes** section now opens the Vault, before the Reach. It exists
only where the Keepsake reports (`S.bits.keepsake` by `S.reported` and
`S.absent`). Anywhere else it is the §6.3 chip, *keepsake: not deployed on
this chain*, and the lane sends no read to the codeless address.

**Your keepsakes.** One `eth_getLogs` over the Keepsake finds every
`Transfer` to the connected wallet or to this token's Reach (topic 2 is an
"any of" list), and each id is kept only while `ownerOf` still names one of
the two. A range the endpoint refuses is a sentence: *the keepsakes could
not be found on this endpoint: …*, never an empty list. Each keepsake is a
card:

- **the orb**: its own `tokenURI` image (KeepsakeArt's orb, a colour per
  coin, the freed share as an arc), accepted only as a base64
  `data:image/svg+xml` and shown in an `<img>`, so nothing in it can run;
- *made by you · held by you*, or *a gift from 0x5CbD … 07FB · held by
  you*;
- its note, in quotes;
- one row per coin, with the symbol and decimals read live, showing what it
  still holds;
- the schedule as a bar and a sentence on the chain's clock (`ui.clock`):
  *15 % free · fully free on 2025-01-29 20:53 UTC* (the card screenshot),
  or *0 % free · nothing frees before … · fully free on …*;
- what a claim pays now (`claimable`): *ready to claim now: 0.03 ETH, 75
  USDC and 0.45 WETH* (the same card), or *nothing to claim yet*;
- its slow sale in words: *sells slowly, never below 0.0004 ETH per USDC ·
  at most 50 USDC each time, in market #1*, or *no slow sale*.

**Actions.**
- **Claim** is offered to every connected account whenever something is
  claimable. Its sentence says who is paid, as in the claim-slab
  screenshot: *pays keepsake #2's holder, you, what has freed — now 75
  USDC; whoever presses is paid nothing*. For a stranger pressing the
  Reach's keepsake it begins *pays keepsake #3's holder, #1's Reach, …*.
- The holder's changes sit in four disclosures under the card:
  - **lengthen it**: a number of days added to the end. The sentence says
    *it only lengthens, never shortens*, and a count below one is refused
    in words before any slab;
  - **sell it slowly as it frees**: the coin by its symbol, a Pool market
    (this token's own by default), the price as *P OUT per one IN*, and
    the most each time. A **stop the slow sale** button is added while one
    is set;
  - **give it**: *gives keepsake #1 to 0x5CbD … 07FB: the keepsake and
    everything in it becomes theirs*;
  - **write a memory into it**: a Journal note in the keepsake's own
    journal, *public and for good*.

  For a keepsake the wallet holds, these go straight to the Keepsake. For
  one the Reach holds they go through `reach.execute`, which needs `HOLD`
  and is marked `[data-spend]`, as every execute is.

**Make a keepsake.**
- **Assets:** ETH, and up to seven coins by address. As an address is
  typed, its symbol and decimals are read live (*USDC · 6 decimals*).
- **Schedule:** *locked for N days, then frees slowly over M days*.
- **Recipient:** leave it empty to keep the keepsake, or give an address
  for a gift, with a note of at most 280 bytes.
- **Slow sale:** optional, in a disclosure, and only on a keepsake you
  keep.
- **Signing:** the first press lays each coin's exact approval through
  `ui.approveExactThen`, one press per coin. The next press is `wrap` with
  `value` the ETH to the wei, and its sentence reads first: *You lock 0.2
  ETH and 500 USDC for 30 days, then they free slowly over 60 days; it is
  a gift to 0x5CbD … 07FB with your note.*
- **The new number:** read from the receipt's `Wrapped` log, never from a
  read after it: *keepsake #2 is made, a gift to 0x5CbD … 07FB · its number
  from the Wrapped log*.

**W7's observation, fixed.** The Grip's copy button no longer throws in a
`data:` frame, where `navigator.clipboard` is undefined. It says so instead:
*copying is not available in this frame; select the address above to copy
it*.

### Screenshots

They were taken in Playwright's Chromium, against the built document served
the way `tools/verify-console.mjs` serves it: its own `fresh({ v2: true })`,
`deploySite` from `dist/` with the V2 satellites, the in-process gateway on
127.0.0.1, and the shim's wallet over EIP-6963. The script is W10's scratch
`shots.mjs`, not in the tree. The cast is #1 with a USDC/ETH market and
three keepsakes, photographed nine days after they were made:
- #1 is the holder's own: 0.2 ETH, 500 USDC and 3 WETH over 60 days, with
  a slow sale on its USDC;
- #2 is a gift to the holder, 250 USDC over 30 days, with a note;
- #3 is in the Reach, 2 WETH, locked for ten days and so still locked.

Each view was taken at phone 390×844 and desktop 1440×900, in
`docs/v2/shots/`:

| View | Files |
|---|---|
| the section and the first card | `vault-phone-keepsakes.png`, `vault-desktop-keepsakes.png` |
| a card's coins, schedule, claimable and slow sale | `vault-phone-card.png`, `vault-desktop-card.png` |
| the make form, filled for a gift | `vault-phone-make.png`, `vault-desktop-make.png` |
| the gift's slab: the sentence first, then the facts | `vault-phone-gift-slab.png`, `vault-desktop-gift-slab.png` |
| a card's "lengthen it" disclosure open | `vault-phone-manage.png`, `vault-desktop-manage.png` |
| the claim's slab | `vault-phone-claim-slab.png`, `vault-desktop-claim-slab.png` |
| a gift just landed: the made line, the ticker, the celebration | `vault-phone-made.png`, `vault-desktop-made.png` |

This headless Chromium draws WebGL through SwiftShader, so the sky is the
still frame W7 describes.

## 2. Decisions, each with its reason

1. **The section leads the lane.** Bundles, gifts and slow release are what
   the owner asked the Vault to do (V2 §0 row 4). The V1 sections are
   unchanged and follow in their order. In the V1 world the section is a
   single chip.
2. **V2 rows are declared only where each satellite reports.** `ui.rows`
   throws on a key the Catalog does not serve. Declaring `keepsake.*` and
   `journal.inscribe` unconditionally would stop the whole lane from
   opening on a band whose Catalog predates them. They are declared behind
   `S.reported & S.bits.keepsake` (and `…journal`).
3. **`ownerOf` and `tokenURI` have no `keepsake.*` row.** `CatalogRowsV2`
   serves `keepsakeOf`, `claimable` and the writes, but neither of these.
   - `ownerOf(uint256)` is read at the Keepsake through the hub's own
     ERC-721 row. It is the same signature, and `ui.rows` holds its
     selector to the chain's.
   - `tokenURI(uint256)`'s calldata is laid by hand (`0xc87b56dd`; the suite
     recomputes the selector) and sent through `ui.request("eth_call")`.
     CONSOLE §5 names `request` as the path for reads `data`/`read` cannot
     express.
   - Request 3 asks for both rows, so the lane can use their own names.
4. **One walk for both hands.** A single filter,
   `topics: [transfer, null, [wallet, reach]]`, finds both hands' keepsakes
   (a node's "any of" rule; `tools/evm.mjs` honours it). The `ownerOf` read
   per id drops what has since been given away; the test gives #1 away and
   watches it leave.
5. **The orb is the chain's picture, and only a picture.** The lane takes
   the `image` out of the `tokenURI` JSON with a pattern that admits only
   `data:image/svg+xml;base64,` followed by base64 characters. It puts it
   in an `<img>`, where an SVG runs no script and loads nothing; the CSP's
   `img-src data:` already allows it. It does not animate. KeepsakeArt
   draws no SMIL, and the lane adds no CSS loop, so nothing moves without
   `html.alive`.
6. **"Locked for N days, then freed over M days" is a delayed line, not a
   cliff.**
   - The schedule is `start = now + N days`, `cliff = start`,
     `end = start + M days`.
   - A cliff at `now + N` with `start = now` would free N/(N+M) of
     everything the moment the lock ended (W1: "a step onto the line").
     That is not what the sentence promises.
   - `N = 0` sends `start = 0` (the block it lands in) and
     `end = clock + M days`.
   - `M = 0` frees everything at once at `start`.
   - Both zero is refused in words.
   - `now` is `ui.clock()`, never `Date.now()`.
7. **The bar is a native `<progress>`.** It uses the token's accent and is
   `aria-hidden`, because the sentence beside it says the same thing in
   words: (now − start) / (end − start), 0 before the cliff, 100 at the end.
   It replaced two styled `div`s for bytes and for free semantics.
8. **Claim is everyone's, and shown only when it pays something.** The
   Keepsake refuses an empty claim (`NothingFreed`), so a button that can
   only revert is not drawn. The sentence names the payee because the
   presser is often not the payee: the test has a stranger claim for the
   Reach.
9. **Extend is "by how many days", not a date.** A count added to the end
   cannot express a shorter end, and a count below one is refused with *a
   keepsake only lengthens, by whole days: it never ends sooner*. The
   Keepsake's own `RatchetOnly`, `TooLong` and `BadSchedule` still reach
   the slab as words if the chain disagrees.
10. **The floor in human terms, one formula both ways.**
    - A person types *P OUT per one IN*. The lane reads the market's pair
      live (`pool.marketOf`) to learn OUT, and reads both decimals live.
    - It sends `floor = ⌈P × 10^decOut × 1e18 / 10^decIn⌉`, rounded up so
      nothing sells below the price typed (W1: the floor is output units
      per 1e18 input units).
    - It reads the floor back with the inverse:
      `fmt(floor × 10^decIn, decOut + 18)`.
    - The suite types 0.0004 ETH per USDC (6 decimals), finds
      `4 × 10^26` in the calldata, and reads *0.0004 ETH per USDC* back
      from the chain.
11. **A slow sale on a gift is refused before anything is read.** The
    Keepsake refuses it too (`BadDrip`). Saying so first costs no estimate
    and teaches the rule: *a giver never sells a recipient's gift*.
12. **A memory is a NOTE with a zero `ref`.** `(Keepsake, id)` already
    names the page, and W2 reserves `ref = keccak(Keepsake, id)` for a
    memory about the keepsake written into another token's journal. The
    body is UTF-8, 1–1,024 bytes, counted as bytes.
13. **The number comes from the receipt.** The `then` of `wrap` finds
    `Wrapped` in `receipt.logs` (address the Keepsake, topic 0 the
    Catalog's `wrapped`) and keeps the sentence across the repaint the
    receipt triggers. No `keepsakeCount` read follows the write (CLAUDE.md:
    ids come from the log).
14. **Sentences carry short addresses; lines carry full ones.**
    - The first screenshot showed a full 42-character address in the
      slab's sentence running off a 390 px sheet. `[data-sentence]` does
      not wrap a long word (request 2).
    - The sentences now say *0x5CbD … 07FB*, as the brief's own example
      does. The `For` and `To` lines, the decoded arguments and the
      calldata carry the full checksummed address beneath.
15. **Progressive depth.** The holder's four changes and the make form's
    slow sale are native `<details>`. A card reads as a list of what can
    be done, and the make form stays short for the common case.
16. **Every field is named.** `ui.field` draws its label as a `div` beside
    the box, not as a `<label>`. The lane's `fld` now also sets that text
    as `aria-label`. The session-key inspector, the one field built without
    `fld`, is named the same way. So every field in the lane, V1's
    included, has an accessible name, with no change to what is seen.
17. **The copy button is guarded, not hidden.** In a `data:` frame the
    button stays; pressing it says that copying is not available there.
    V1's suite requires the Grip's buttons to be `.copy` and at least one,
    and a person in a marketplace frame learns why nothing was copied.
18. **Bytes, and what was not done for them.**
    - The lane went from 8,166 to 12,209 B of gzip (the ceiling is
      12,288). The last 9 B are the session-key inspector's name
      (decision 16).
    - Converting the new code to arrow functions would have saved 13 B
      after gzip (measured on a scratch copy). That is not worth breaking
      the style every panel shares.
    - What was cut instead: a second explanatory note in the make form, a
      raw line per slow-sale term (one *Terms* line carries all four),
      long refusals, a box-shadow on the orb, and a fallback sentence for
      a `wrap` receipt without `Wrapped`. A landed wrap always carries the
      log, and the line is simply left empty otherwise.

## 3. Measured

**Bytes** (`node tools/build-app.mjs`, the final build):
- the vault panel is **12,209 B gzip of 12,288** (79 B under), 33,009 B
  inflated, pin `0x9c2b141aefb38b84…`; it was 8,166 B;
- the other five panels and the shell are unchanged: swap 8,172, social
  8,187, launch 8,155, identity 8,185, agent 4,883, and the shell 22,149 B
  of 24,000.

**The lane's own groups**, the last line of each run on the final panel:
- `node tools/verify-site.mjs --group vault`: **109 passed, 0 failed**. It
  was 74 before this unit (68 in the group and 6 in the runner), so 35 are
  new, in blocks V0–V6.
- `node tools/verify-console.mjs --group vault`: **32 passed, 0 failed**.
  It was 22 before this unit (19 in the group and 3 in the runner), so 10
  are new: the journey, the focus probe (30 controls tabbed at 390×844, none
  hidden, all ringed) and the `data:` copy button.

**The six runs the brief names**, in sequence on the final tree
(2026-10-19, 20:27–20:44), each with its last line:

| Run | Last line |
|---|---|
| `node tools/build-app.mjs` | *wrote dist/shards.json, dist/manifest.json, dist/app.html, dist/panels/\*.js*, after *panel vault 12209 bytes gzip* and *shell gzip 22,149 bytes (ceiling 24,000)*; exit 0 |
| `node tools/selftest.mjs` | **60 passed, 0 failed** |
| `node tools/static-audit.mjs` | **static audit passed — 10 Solidity rules, 4 JS rules; this is not a security audit** |
| `node tools/verify.mjs` | **249 passed, 0 failed** |
| `node tools/verify-site.mjs` (all groups) | **639 passed, 0 failed**, 604 before this unit. Per group: boot 131, swap 84, social 76, launch 82, vault 103, identity 88, agent 68 |
| `node tools/verify-console.mjs` (all groups) | **184 passed, 0 failed**, 174 before this unit; in Chromium 141.0.7390.37. Per group: boot 32, viewer 14, session 9, agent 6, swap 22, social 18, identity 13, vault 29, launch 9, journey 28 |

Two notes on these runs:
- **verify-site was run twice.** Its first run in the sequence ended at
  158 s with exit 143 (*Terminated*) in the social group. Unit W8 has
  confirmed it was their `pkill -f "tools/verify-site.mjs"`, meant for
  their own run, which matched this one. The line above is the plain rerun
  that followed.
- **An earlier battery hit one timeout.** On the panel one label earlier
  (commit 58a4d5e's body), verify-console printed 183 passed, 1 failed.
  The identity group's Market block (not this lane) timed out waiting for
  its own buy button at a load average of 7.6 to 9, and that group then
  passed alone, 16 of 16. The final run above has no failure.

**Mutations of the panel.**
- **Method.** A probe in a copy of the tree wrote one-token mutants of
  `engine/panels/vault.js`, each aimed at one guard. For each it ran that
  copy's vault group (verify-site, or Chromium for the copy button),
  recorded which named assertions failed, and restored the file, proving
  it byte-identical by sha256 (`9508611a02f7…`, the committed panel) after
  every row. The copy was a clone of this worktree with the three changed
  files laid over it, `node_modules` linked and the compile cache copied,
  so nothing in the worktree was ever mutated. The driver is W10's scratch
  `mutate.mjs`.
- **When.** 2026-10-19: the first pass ran 20:05–20:25, and the m14 rerun
  and m19 ran by 20:28. The load average was 7 to 9 on four shared cores.
- **m14 rerun.** m14 was first killed by the group *throwing*: the
  zero-value slab has no `[data-value]` row, and the assertion
  dereferenced it. The V2 assertions were then made null-safe, so a missing
  control fails a sentence instead of crashing the group, and m14 was run
  again. The row below is that rerun.
- **m19** was added after the first pass, for the viewer's row.

| # | Guard | Mutation | Verdict | Named failures (the first) |
|---|---|---|---|---|
| m1 | the slow sale is refused on a gift | `if (gift && dp) throw` → `if (!gift && dp) throw` | killed (105 passed, 4 failed) | *a slow sale on a gift is refused in words before anything is read or built: a giver never sells a recipient's gift*; *the gift's slab names the recipient (in the sentence, and in full on the line beneath it) and the note, and its bytes are the Wrap to that address* |
| m2 | the floor's scale is 10^(decOut + 18) | `ui.parse(P, c.d + 18)` → `ui.parse(P, c.d + 17)` | killed (106 passed, 3 failed) | *a slow sale typed in human terms is found raw in the calldata: 0.0004 ETH per USDC is the floor 0.0004 × 10^18 × 1e18 / 10^6 = 4e26*; *the slow sale is read back from the chain in the same words, and the holder may stop it* |
| m3 | the floor reads back with the same formula | `co.d + 18, co.d + 18)` → `co.d + 17, co.d + 18)` | killed (106 passed, 3 failed) | the same two |
| m4 | ownerOf keeps only what is still held | `return who.some(…)` → `return !who.some(…)` | killed (86 passed, 4 failed) | *the keepsakes are found from the Keepsake's Transfer logs and kept by ownerOf: #1 (this wallet) and #3 (the Reach), never #2 (given away); each orb is its tokenURI image, a data: SVG*; *each keepsake is drawn in words: …* |
| m5 | an extend is refused below one day | `if (d < 1n) throw` → `if (d > 1n) throw` | killed (104 passed, 5 failed) | *a shortening extend is refused in words before any slab*; *an extend carries the end plus the days typed, and its sentence says it only lengthens, never shortens* |
| m6 | an extend adds the days to the end | `n = e + d * 86400n` → `n = e - d * 86400n` | killed (106 passed, 3 failed) | *an extend carries the end plus the days typed, …*; *the end moved out by thirty days on the chain* |
| m7 | the card and the claim name the payee | `same(h, seenAcct) ? "you"` → `!same(h, seenAcct) ? "you"` | killed (103 passed, 6 failed) | *each keepsake is drawn in words: …*; *the claim's sentence says who is paid and what* |
| m8 | the Reach's keepsake goes through execute | `var r = same(k.h, RE);` → `var r = !same(k.h, RE);` | killed (99 passed, 10 failed) | *an extend carries the end plus the days typed, …*; *the end moved out by thirty days on the chain* |
| m9 | every change through the Reach is a spending control | `{ spend: s \|\| !!need }` → `{ spend: s \|\| !need }` | killed (107 passed, 2 failed) | *the Reach's keepsake is changed through the Reach: execute(Keepsake, 0, extend(3, …), 0), the holder's to propose and, as every execute, a spending control* |
| m10 | the orb is only a data: SVG | `(data:image\/svg\+xml;base64,` → `(data:image\/png;base64,` | killed (106 passed, 3 failed) | *the keepsakes are found from the Keepsake's Transfer logs and kept by ownerOf: …; each orb is its tokenURI image, a data: SVG* |
| m11 | the chip where the Keepsake does not report | `three(b, KB, "keepsake")` → `three(b, 0, "keepsake")` | killed (74 passed, 3 failed) | *where the Keepsake is not deployed the section is the not-deployed chip, with no form, and nothing reads the codeless address*; *where the Keepsake reports, the lane walks its Transfer logs … and offers the form* |
| m12 | the walk filters Transfer logs | `topics: [S.topics.transfer, null,` → `topics: [S.topics.wrapped, null,` | killed (85 passed, 5 failed) | *where the Keepsake reports, the lane walks its Transfer logs to the wallet and to the Reach in one filter, …*; *the keepsakes are found from the Keepsake's Transfer logs and kept by ownerOf: …* |
| m13 | the new number is the Wrapped log's topic 1 | `BigInt(w.topics[1])` → `BigInt(w.topics[2])` | killed (105 passed, 4 failed) | *a bundle of ETH and two ERC-20s is made with exact approvals: … and the page names #1 from the Wrapped log*; *a gift to another account: keepsake #2 is minted to them, named from the Wrapped log, and it is not in the giver's list* |
| m14 | the wrap's value is the ETH exactly | `value: eth, need: 0, spend: true,` → `value: 0n, need: 0, spend: true,` | killed (80 passed, 12 failed; the rerun) | *the third press is wrap: its bytes are exactly the Wrap the form says, the value is the ETH to the wei, and the sentence is plain words*; *a bundle of ETH and two ERC-20s is made with exact approvals: …* |
| m15 | each approval names the Keepsake | `spender: KS, amount: a[1]` → `spender: RE, amount: a[1]` | killed (79 passed, 13 failed) | *the first press is the exact approval of the first coin: approve(Keepsake, 500 USDC in base units) and nothing more*; *the third press is wrap: …* |
| m16 | a refused log range is said | `"the keepsakes could not be found on this endpoint: "` → `""` | killed (106 passed, 3 failed) | *a refused log range is a sentence, never an empty list* |
| m17 | the schedule starts after the lock | `st = N ? y[0] + N * 86400n : 0n` → `st = N ? y[0] - N * 86400n : 0n` | killed (79 passed, 5 failed) | *the third press is wrap: its bytes are exactly the Wrap the form says, …*; *a bundle of ETH and two ERC-20s is made with exact approvals: …* |
| m18 | the share freed is a hundredth of the span | `(t - s0) * 100n / (e - s0)` → `(t - s0) * 10n / (e - s0)` | killed (106 passed, 3 failed) | *a quarter of the way along, the bar and the sentence read 25 % free and a quarter of every coin is ready to claim* |
| m19 | the form is for a connected console account, never the viewer | `if (can) make(b);` → `if (!can) make(b);` | killed (75 passed, 2 failed) | *where the Keepsake reports, the lane walks its Transfer logs … and offers the form* (then the group stops, the holder having no form to fill) |
| c1 | the copy button is guarded where navigator.clipboard is undefined | `c ? c.writeText(GR)` → `1 ? c.writeText(GR)` | killed in Chromium (30 passed, 2 failed) | *in a data: frame, where navigator.clipboard is undefined, the Grip's copy button says in words that copying is unavailable, and throws nothing* |

**20 killed, 0 survived, 0 not applied, of 20.** In each row the verdict
is the vault group's own last line on the mutant. The unmutated vault
group prints 109 passed, 0 failed (verify-site) and 32 passed, 0 failed
(Chromium).

## 4. Element ids added

These are also in the panel's header comment. Every one is read scoped to
`#lane-vault`.

- **`#vault-keepsakes`**: the section. Where the Keepsake does not report it
  holds only the chip `.chip[data-state=absent|unread]` *keepsake: …*.
- **`#vault-keepsakes-status`**: *<n> held by this wallet or #<id>'s
  Reach*, *none held by … yet*, or *the keepsakes could not be found on
  this endpoint: …*.
- **`#vault-keepsakes-list .keepsake[data-id=<id>]`**, one card, holding:
  - `img` (the orb, alt *keepsake #<id>'s orb*);
  - `p.k`;
  - `p.s` (*made by … · held by …* / *a gift from … · held by …*);
  - `p.note`;
  - `.kv` per coin;
  - `progress[value]`;
  - `p.free`, `p.claimable`, `p.drip`;
  - `[data-act=claim]`;
  - the holder's `details`:
    - *lengthen it*: `input[name=more]`, `[data-act=extend]`;
    - *sell it slowly as it frees*:
      `input[name=dsell|dmkt|dfloor|dmax]`, `[data-act=setDrip]`, and
      `[data-act=clearDrip]` while a slow sale is set;
    - *give it*: `input[name=give]`, `[data-act=give]`;
    - *write a memory into it*: `input[name=memory]`,
      `[data-act=inscribe]`, or the journal's chip where the Journal does
      not report.
- **`#vault-make`**, the make form:
  - `input[name=eth]`;
  - `.coin` rows of `input[name=token|amount]` with `p.s` (*<SYM> · <d>
    decimals*);
  - `input[name=lock|over|to|note]`;
  - a `details` of `input[name=dsell|dmkt|dfloor|dmax]`.
- **`#vault-make-add`**, **`[data-act=wrap]`**.
- **`#vault-keepsake-made`**: *keepsake #<id> is made[, a gift to 0x… …] ·
  its number from the Wrapped log*.
- `[data-spend]` sits on `wrap`, on `give`, and on every change to a
  keepsake the Reach holds.

## 5. Proposed INVARIANTS rows

These are in the ledger's own columns, so the integration step can copy
them and number them. Every row is **pending (W10)**. A row becomes live
when its file runs in `npm run check`. Each status names the mutants of §3
under which its sentences were seen to fail.

| Row | Claim | Cited by | Status |
|---|---|---|---|
| W10-1 | Where the Keepsake is not deployed, the Vault's Keepsakes section is the §6.3 chip, with no form, and nothing reads the codeless address | `tools/verify-site/vault.mjs` · *"where the Keepsake is not deployed the section is the not-deployed chip, with no form, and nothing reads the codeless address"* | pending (W10); fails under m11 |
| W10-2 | Every coin's approval is exact (one per coin, to the Keepsake, for the amount in base units) and comes before the wrap; the allowances end at zero | `tools/verify-site/vault.mjs` · *"the first press is the exact approval of the first coin: approve(Keepsake, 500 USDC in base units) and nothing more"*, *"a bundle of ETH and two ERC-20s is made with exact approvals: the Keepsake holds exactly what was typed, both allowances are spent to zero, and the page names #1 from the Wrapped log"*; `tools/verify-console.mjs` · *"the first press asks for the exact approval of 100 USDC to the Keepsake"* | pending (W10); fails under m15 and m14 |
| W10-3 | The wrap signed is exactly the Wrap the form shows (assets, schedule on the chain's clock, recipient, note, slow sale), with the ETH as its value to the wei and a plain sentence first | `tools/verify-site/vault.mjs` · *"the third press is wrap: its bytes are exactly the Wrap the form says, the value is the ETH to the wei, and the sentence is plain words"* | pending (W10); fails under m14, m15 and m17 |
| W10-4 | A slow sale on a gift is refused in words before anything is read or built | `tools/verify-site/vault.mjs` · *"a slow sale on a gift is refused in words before anything is read or built: a giver never sells a recipient's gift"* | pending (W10); fails under m1 |
| W10-5 | A new keepsake's number is read from the receipt's Wrapped log, never from a read after the write | `tools/verify-site/vault.mjs` · *"a gift to another account: keepsake #2 is minted to them, named from the Wrapped log, and it is not in the giver's list"* | pending (W10); fails under m13 |
| W10-6 | Keepsakes are found from the Keepsake's Transfer logs to the wallet and to the token's Reach and kept by ownerOf; each orb is its tokenURI image, a data: SVG only | `tools/verify-site/vault.mjs` · *"the keepsakes are found from the Keepsake's Transfer logs and kept by ownerOf: #1 (this wallet) and #3 (the Reach), never #2 (given away); each orb is its tokenURI image, a data: SVG"*, *"given, the keepsake leaves this wallet's list: ownerOf no longer names it"* | pending (W10); fails under m4, m10 and m12 |
| W10-7 | A log range the endpoint refuses is a sentence, never an empty list | `tools/verify-site/vault.mjs` · *"a refused log range is a sentence, never an empty list"* | pending (W10); fails under m16 |
| W10-8 | What has freed is read on the chain's clock and said in words, and a claim, anyone's to press, pays the keepsake's holder | `tools/verify-site/vault.mjs` · *"a quarter of the way along, the bar and the sentence read 25 % free and a quarter of every coin is ready to claim"*, *"the claim's sentence says who is paid and what"*, *"a stranger's claim pays the keepsake's holder, the Reach, and the stranger nothing"* | pending (W10); fails under m18 and m7 (that the Keepsake pays only the holder is K2's, on chain) |
| W10-9 | An extend only lengthens: the end plus whole days, and a count below one is refused in words before any slab | `tools/verify-site/vault.mjs` · *"a shortening extend is refused in words before any slab"*, *"an extend carries the end plus the days typed, and its sentence says it only lengthens, never shortens"* | pending (W10); fails under m5 and m6 |
| W10-10 | A floor typed as a price is the raw floor in the calldata, ⌈P × 10^decOut × 1e18 / 10^decIn⌉, and reads back in the same words | `tools/verify-site/vault.mjs` · *"a slow sale typed in human terms is found raw in the calldata: 0.0004 ETH per USDC is the floor 0.0004 × 10^18 × 1e18 / 10^6 = 4e26"*, *"the slow sale is read back from the chain in the same words, and the holder may stop it"* | pending (W10); fails under m2 and m3 |
| W10-11 | A keepsake the Reach holds is changed only through the Reach's execute, which is the holder's (HOLD) and marked spending | `tools/verify-site/vault.mjs` · *"the Reach's keepsake is changed through the Reach: execute(Keepsake, 0, extend(3, …), 0), the holder's to propose and, as every execute, a spending control"* | pending (W10); fails under m8 and m9 |
| W10-12 | The viewer reads the keepsakes and offers no control | `tools/verify-site/vault.mjs` · *"the viewer reads the keepsakes and offers no control: no form, no claim, no change"* | pending (W10). m19, which flips the form's gate, is killed by the holder's sentence before the viewer's block runs. The controls themselves are kept out of the viewer by the shell's `act()`, so no mutant of this panel fails this sentence alone |
| W10-13 | In Chromium a gift is made with its exact approval, found by its recipient and claimed, by a person's path | `tools/verify-console.mjs` · *"a keepsake made as a gift with its exact approval, found by its recipient and claimed, clicked by a person's path"* | pending (W10); fails under c1 |
| W10-14 | In Chromium at 390×844 every control of the Keepsakes takes focus in view and ringed, never under the crest bar or the dock | `tools/verify-console.mjs` · *"at 390×844 every control of the keepsakes takes focus in view and ringed, never under the crest bar or the dock (${seen.length} tabbed)"* (a template literal; the checker allows the hole) | pending (W10). It is the battery sentence F12 asks for, for one section of one room; the property is the shell's `scroll-padding`, so its mutation belongs to `engine/app.css` |
| W10-15 | Where navigator.clipboard is undefined, the Grip's copy button says so in words and throws nothing | `tools/verify-console.mjs` · *"in a data: frame, where navigator.clipboard is undefined, the Grip's copy button says in words that copying is unavailable, and throws nothing"* | pending (W10); fails under c1 |

## 6. Requests for files this unit does not own

1. **`docs/CONSOLE.md`**
   - §6.2, the vault row: add the ids of §4 above.
   - §5, the `data(key, args)` row: it still says *"Tuples and nested
     arrays are **not** built here"*. Since 959acee `ui.data` and
     `ui.propose({ key, args })` build them. This lane proposes
     `wrap((…)[],…)` and `setDrip(uint256,(…))` by key, and its tuple slabs
     carry every argument in `lines`, as §4.2 asks.
2. **`engine/app.css`** (the shell): `#cslab [data-sentence]{overflow-wrap:anywhere}`.
   - At 390 px a full address in a sentence is one word wider than the
     sheet, and it runs off the right edge. It was measured in this unit's
     first screenshot of the gift's slab.
   - This lane now writes short addresses in its sentences. V1's sentences
     still carry full ones: the transfer's *from 0x… to 0x…*, the grant's
     *lets 0x… act through …*.
   - W10-14 (§5) needs a mutation of `html`'s `scroll-padding` in this file
     to go live: the property it proves is the shell's, not this panel's.
3. **`src/Catalog.sol`, `CatalogRowsV2`**: two rows.
   - `ownerOf|V|ownerOf(uint256)|r|d|;`
   - `tokenURI|V|tokenURI(uint256)|r|d|the orb and the page, data: URIs;`

   The lane could then declare `keepsake.ownerOf` and `keepsake.tokenURI`
   and drop the hub's row and the hand-laid selector (decision 3). This is
   a `src/` change: one recompile, and the drift gate holds the rows to the
   Keepsake's ABI.
4. **`tools/verify-console.mjs`, the viewer group (B′)**, which is not this
   unit's group. The clipboard observation is resolved:
   - its `t.note`, the `clipboard|writeText` filters and the set-aside
     wording can go;
   - the file header's *"the Grip's copy button throws there — recorded as
     an observation, not fixed here"* is no longer true.

   The vault group now proves the fix in a `data:` frame.
5. **`docs/INVARIANTS.md`** and DESIGN §14:
   - the rows of §5;
   - F12 (W7: a focused control is never hidden under the bars) can cite
     W10-14's sentence as the battery sentence it waits for, for the
     Keepsakes section;
   - F10 (nothing loops without `html.alive`) holds in this lane, which
     adds no animation.
6. **`docs/v2/INTEGRATION.md`**:
   - W7-7 (the copy button) is done by W10;
   - W7-8 (endless animation) holds in this lane: it draws nothing that
     loops.
7. **`CLAUDE.md`**, the ceilings trap: the vault panel is 12,209 B of
   12,288, 79 B under. Any fix to it pays in cuts first.
8. **Not built, and why.**
   - Pressing `drip` (anyone's slow sale) is a keeper's act. B4's keeper
     motive in `tools/agents.mjs` is its place, and the lane shows a slow
     sale's terms and proceeds without offering the press.
   - `swapAndWrap` ("lock what I receive") belongs with the swap. The
     Trade lane has the swap form and the market.
