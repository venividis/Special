# W17 · the console's pending rows, held to one-token mutants

V2 integration, unit W17. `docs/INVARIANTS.md` calls a row live only once its
test runs in `npm run check` and has been seen to fail under a one-character
mutation. Twenty-four console rows ran in the battery without that evidence:

- Y1–Y11, the Gallery (W8; Y11 is W14's);
- F20–F24, S27, S28 and N18, which W14 proved only by undoing a whole change;
- S24, S26, K29, K31 and F25's second sentence, which had no mutant aimed at
  them or none that failed them.

This unit aimed one-token mutants at each row's guard and ran the groups that
hold the row. It was built on fe96c8e (fast-forwarded from 2075a38) on
2026-10-20.

This unit owns this report and, in `tools/verify-site/*.mjs`, only the
sentences it adds. It edited nothing under `engine/`, `src/`,
`tools/verify-console.mjs` or W15's files; every mutant was written in a
scratch copy.

Every number below was printed by a run on this tree or on one of its copies,
and each says which.

## 1. How the mutants were run

**The copies.** Three clones of this worktree (`git clone --no-hardlinks`),
each with `node_modules` linked and `out/` copied so the compile cache hit:

- copy one ran the Gallery's 66 mutants;
- copy two ran the other 30, after the Chromium groups' unmutated lines;
- copy three carried this unit's added sentences, for the second and third
  passes.

No run recompiled Solidity: every mutant is JavaScript or CSS, and the
`src` + `test/mocks` input was the cached one.

**The driver** (scratch, not committed) did this for each mutant:

1. It asserted that the mutant's *from* text occurs exactly once in the copy's
   file. A text that occurs twice or never is "not a mutation".
2. It wrote the mutant over the file.
3. For a file under `engine/`, it ran `node tools/build-app.mjs` and compared
   the hashes the build prints with the unmutated build's: the engine hash,
   each panel's pin and the shell's gzip. A mutant the minifier erases would
   read "not a mutation". None did: every `engine/` mutant moved the build.
4. It ran every group the row holds, each in its own process group with a
   25-minute limit:
   - `node tools/verify-site.mjs --group <g>`;
   - `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/verify-console.mjs --group <g>`.
5. It recorded every ✗ line with the detail under it, the summary line and
   the exit code. A run with no summary, or a non-zero exit, is a failed run.
   A crash is never a survivor (W12's lesson).
6. It restored the file from the bytes it read before the first mutant,
   checked the sha256, and rebuilt `dist/`.

At the end of each campaign it compared every file it touched with those
bytes, and rebuilt `dist/` (§5).

**The verdict column** reads the row's own citations in `docs/INVARIANTS.md`:

- *killed*: a sentence the row cites failed by name.
- *killed, at a wait*: the group stopped at one of the waits that throw by name
  (W13, W14) before the row's sentence was reached. The failed line names the
  wait's file and line; the line numbers are fe96c8e's.
- *killed: the run crashed*: the run ended with no summary.
- *killed, by a sentence the row does not cite*: another sentence of the same
  group failed first.
- *killed, by the sentence W17 adds*: the second and third passes, against
  the sentences of §4.

*vs* is a verify-site group, *vc* a verify-console group (Chromium
141.0.7390.37). A group's line is that run's own last line.

**Two things happened on the way.**

- **The background limit.** At 00:57 the session's 30-minute limit on a
  background command stopped the first two drivers.
  - Each caught SIGTERM, restored its file and exited. The sha256 check
    against this worktree's files read equal for all seven files.
  - Each campaign was resumed with the mutants it had not finished.
  - The two that were running, y4-sealed and f24-words, were run again from
    the start. No verdict comes from an interrupted run.
- **The load.** The four cores were shared with W15's forge run and W16's
  Chromium runs, at a load average of 5 to 9 during the first pass. Every
  kill's failed lines were read. None is a timeout of a wait unrelated to
  its mutant.

## 2. The lines before

On the real tree, fe96c8e, before any mutant:

| Run | Last line |
|---|---|
| `node tools/build-app.mjs` | *wrote dist/shards.json, dist/manifest.json, dist/app.html, dist/panels/\*.js* (shell 22,400 B gzip of 24,000; gallery 12,233 B of 12,288) |
| `node tools/verify-site.mjs` | **818 passed, 0 failed** (4 m 31 s; gallery 44 assertions, swap 140) |
| `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/verify-console.mjs --group gallery` | **8 passed, 0 failed** |
| `node tools/static-audit.mjs` | *static audit passed — 10 Solidity rules, 4 JS rules; this is not a security audit* |
| `node tools/invariants-check.mjs` | **225 passed, 0 failed** |

The unmutated Chromium groups in copy two, each `--group` run with the
runner's 3 assertions, all 0 failed: boot 40, swap 33, social 32, vault 34,
launch 22, journey 31 and viewer 17.

A verify-site `--group` run adds the runner's 6 assertions to the group's
count. On fe96c8e that gives gallery 50, swap 146, social 125, launch 116,
vault 111, identity 98 and boot 139. Every mutant run that went to its end
totals the same.

## 3. The mutants, one table per row family

Each kill was read, and each row has at least one mutant whose cited sentence
fails by name. Each table is in row order, with a row's second- and
third-pass mutants after its first.

### Y1–Y11 · the Gallery

| # | Row | Guard | Mutant (from → to) | Verdict | The sentences that failed | The group's line |
|---|---|---|---|---|---|---|
| y1-face | Y1 | an INTACT token is drawn from face 1, its crest, never face 0 (this console) | `read(HUB, "hub.tokenURIAt", [t.id, 1])` → `read(HUB, "hub.tokenURIAt", [t.id, 0])` | killed | *an on-chain SVG token is drawn from its own data: URI: the image is face 1's, decoded in place, and its name is the metadata's*; *an INTACT token says its own site is this console and runs no copy of it; its holder is ownerOf's* | vs gallery 48 passed, 2 failed |
| y1-decode | Y1 | data: JSON in base64 is decoded in place | `if (/;base64$/i.test(m[1])) t = TX(` → `if (/;base64$/i.test(m[2])) t = TX(` | killed, at a wait | the group stopped at the wait at tools/verify-site/gallery.mjs:143 | vs gallery 7 passed, 1 failed |
| y1-name | Y1 | its name is the metadata's | `j.name.slice(0, 120)` → `j.name.slice(1, 120)` | killed | *an on-chain SVG token is drawn from its own data: URI: the image is face 1's, decoded in place, and its name is the metadata's*; *on-chain JSON whose image lives off chain: the JSON is decoded in place and the image is a link, never loaded*; *a hostile name is text and a javascript: image is neither drawn nor linked* | vs gallery 47 passed, 3 failed |
| y1-hue | Y1 | the frame's colours are rebuilt from the numbers the SVG paints with | `"hsl(" + q[0] % 360 + ","` → `"hsl(" + q[0] % 36 + ","` | killed | *its frame is lit by the colours its own fills and strokes paint with, sampled from the SVG*; *and its image, the Collection's own SVG orb, lights the frame with the orb's own colours* | vs gallery 48 passed, 2 failed |
| y1-chroma | Y1 | only a colour with chroma above 24 lights the frame; else the crest's hues | `return c && c[0] > 24 ?` → `return c && c[0] > 240 ?` | killed | *its frame is lit by the colours its own fills and strokes paint with, sampled from the SVG*; *and its image, the Collection's own SVG orb, lights the frame with the orb's own colours* | vs gallery 48 passed, 2 failed |
| y1-two | Y1 | the frame is lit by two colours, the second distinct from the first | `\|\| c; ↵ return c && c[0] > 24 ? [c[1], d[1]]` → `\|\| c; ↵ return c && c[0] > 24 ? [c[1], c[1]]` | **survived** | none | vs gallery 50 passed, 0 failed |
| y1-sort | Y1 | the two most vivid colours, sorted by chroma | `all.sort(function (a, b) { return b[0] - a[0]; });` → `all.sort(function (a, b) { return a[0] - b[0]; });` | killed | *its frame is lit by the colours its own fills and strokes paint with, sampled from the SVG*; *and its image, the Collection's own SVG orb, lights the frame with the orb's own colours* | vs gallery 48 passed, 2 failed |
| y1-traits | Y1 | each trait is a chip spelled as the metadata spells it | `String(a.trait_type).slice(0, 40) + ": "` → `String(a.trait_type).slice(0, 40) + ":"` | killed | *its attributes are chips, one per trait, each as the metadata spells it*; *on-chain JSON whose image lives off chain: the JSON is decoded in place and the image is a link, never loaded* | vs gallery 48 passed, 2 failed |
| y1-ownsite | Y1 | an INTACT token says its own site is this console | `if (isHub) note(head, "its own site is this console` → `if (!isHub) note(head, "its own site is this console` | killed | *an INTACT token says its own site is this console and runs no copy of it; its holder is ownerOf's* | vs gallery 49 passed, 1 failed |
| y1-holder | Y1 | its holder is ownerOf's | `read(t.c, "hub.ownerOf", [t.id]).then(function (r) { return r.a(0); }` → `read(t.c, "hub.ownerOf", [t.id]).then(function (r) { return r.a(1); }` | killed, at a wait | the group stopped at the wait at tools/verify-site/gallery.mjs:143 | vs gallery 7 passed, 1 failed |
| y1-form | Y1 | the form to open another NFT waits closed above the art | `d.open = cur.id == null;` → `d.open = cur.id != null;` | killed | *the art comes first, then its name, its price while one stands, and its facts; the form to open another NFT waits closed above them* | vs gallery 49 passed, 1 failed |
| y1-price | Y1 | the price strip is hidden while no price stands | `PR.id = "gallery-price"; PR.hidden = true;` → `PR.id = "gallery-price"; PR.hidden = false;` | killed | *the art comes first, then its name, its price while one stands, and its facts; the form to open another NFT waits closed above them*; *the sale enters its story from Seaport's OrderFulfilled, and the listing reads filled* | vs gallery 48 passed, 2 failed |
| y1-two+ (pass 2) | Y1 | the frame is lit by two colours, the second distinct from the first | `\|\| c; ↵ return c && c[0] > 24 ? [c[1], d[1]]` → `\|\| c; ↵ return c && c[0] > 24 ? [c[1], c[1]]` | killed, by the sentence W17 adds | *its frame is lit by two distinct colours, the two most vivid its art paints with, the most vivid first* | vs gallery 53 passed, 1 failed |
| y1-holder2 (pass 2) | Y1 | its holder is ownerOf's | `(owner ? " · held by " + short(owner) :` → `(owner ? " · held by " + short(HUB) :` | killed | *an INTACT token says its own site is this console and runs no copy of it; its holder is ownerOf's*; *after the mint lands the lane opens the token the Transfer log names, the wallet's* | vs gallery 52 passed, 2 failed |
| y1-src (pass 2) | Y1 | the image drawn is the metadata's data: URI | `i.src = img; i.alt = name;` → `i.src = name; i.alt = name;` | killed | *an on-chain SVG token is drawn from its own data: URI: the image is face 1's, decoded in place, and its name is the metadata's*; *its frame is lit by the colours its own fills and strokes paint with, sampled from the SVG*; *its frame is lit by two distinct colours, the two most vivid its art paints with, the most vivid first*; *and its image, the Collection's own SVG orb, lights the frame with the orb's own colours* | vs gallery 50 passed, 4 failed |
| y2-link | Y2 | only https, ipfs and ar become links; anything else is text | `if (!OFF.test(u)) return kv(p, label, u.slice(0, 160));` → `if (OFF.test(u)) return kv(p, label, u.slice(0, 160));` | killed | *a foreign ERC-721 whose metadata lives off chain is shown as a link a person may open, and the page fetches nothing*; *on-chain JSON whose image lives off chain: the JSON is decoded in place and the image is a link, never loaded* | vs gallery 48 passed, 2 failed |
| y2-rel | Y2 | an off-chain link opens with noopener noreferrer | `a.setAttribute("rel", "noopener noreferrer");` → `a.setAttribute("rel", "noopener");` | killed | *a foreign ERC-721 whose metadata lives off chain is shown as a link a person may open, and the page fetches nothing* | vs gallery 49 passed, 1 failed |
| y2-img | Y2 | an off-chain image is a link to that image, never loaded | `link(at, img, "its image lives off chain")` → `link(at, name, "its image lives off chain")` | killed | *on-chain JSON whose image lives off chain: the JSON is decoded in place and the image is a link, never loaded* | vs gallery 49 passed, 1 failed |
| y2-unhandled | Y2 | the one walk of the Bazaar's index never leaves a rejection unhandled | `PUB.catch(function () {});` → `PUB.then(function () {});` | killed: the run crashed | none: the run ended before its summary | vs gallery no summary (crashed) |
| y2-js (pass 3) | Y2 | a URI that is not https, ipfs or ar is text, never an anchor | `if (!OFF.test(u)) return kv(p, label, u.slice(0, 160));` → `if (!OFF.test(u)) kv(p, label, u.slice(0, 160));` | **survived** | none | vs gallery 54 passed, 0 failed |
| y2-js+ (pass 3) | Y2 | a URI that is not https, ipfs or ar is text, never an anchor | `if (!OFF.test(u)) return kv(p, label, u.slice(0, 160));` → `if (!OFF.test(u)) kv(p, label, u.slice(0, 160));` | killed, by the sentence W17 adds | *no link the lane draws carries a javascript: URI: the hostile token's animation is printed as text, never an anchor* | vs gallery 54 passed, 1 failed |
| y3-sandbox | Y3 | the frame's sandbox is allow-scripts and nothing else | `f.setAttribute("sandbox", "allow-scripts");` → `f.setAttribute("sandbox", "allow-scripts allow-same-origin");` | killed | [vs gallery] *a token's data:text/html page runs in an iframe sandboxed to allow-scripts alone, its srcdoc carrying a CSP that refuses every network re…*; [vc gallery] *in Chromium a token's own page runs in an iframe whose sandbox is allow-scripts and nothing else: its script runs, its origin is opaque, …* | vs gallery 49 passed, 1 failed; vc gallery 7 passed, 1 failed |
| y3-csp | Y3 | the srcdoc carries the lane's own CSP meta | `var CSP = "<meta http-equiv=\"Content-Security-Policy\"` → `var CSP = "<meta http-equiv=\"Content-Security-Polic\"` | killed | [vs gallery] *a token's data:text/html page runs in an iframe sandboxed to allow-scripts alone, its srcdoc carrying a CSP that refuses every network re…*; [vc gallery] *in Chromium a token's own page runs in an iframe whose sandbox is allow-scripts and nothing else: its script runs, its origin is opaque, …*; [vc gallery] *and its own fetch is refused by the CSP the lane wrote into its srcdoc: no request leaves the frame* | vs gallery 49 passed, 1 failed; vc gallery 6 passed, 2 failed |
| y3-csp-src | Y3 | the lane's CSP refuses every request: default-src 'none' | `content=\"default-src 'none'; script-src` → `content=\"default-src *; script-src` | killed | [vs gallery] *a token's data:text/html page runs in an iframe sandboxed to allow-scripts alone, its srcdoc carrying a CSP that refuses every network re…*; [vc gallery] *in Chromium a token's own page runs in an iframe whose sandbox is allow-scripts and nothing else: its script runs, its origin is opaque, …*; [vc gallery] *and its own fetch is refused by the CSP the lane wrote into its srcdoc: no request leaves the frame* | vs gallery 49 passed, 1 failed; vc gallery 6 passed, 2 failed |
| y4-owners | Y4 | the owners' walk is filtered by the opened id | `walk(t.c, [S.topics.transfer, null, null, T(t.id)])` → `walk(t.c, [S.topics.transfer, null, null, T(ID)])` | killed | *the owners are walked from Transfer logs filtered by the id: minted to its first holder, then each move, in order* | vs gallery 49 passed, 1 failed |
| y4-order | Y4 | the owners are shown in order, the last twelve | `ls.slice(-12).forEach` → `ls.slice(-1).forEach` | killed | *the owners are walked from Transfer logs filtered by the id: minted to its first holder, then each move, in order* | vs gallery 49 passed, 1 failed |
| y4-owners-refused | Y4 | a refused owners' range is said in words | `}, function (e) { if (g === gen) note(ow, "the Transfer log could not be walked` → `}, function (e) { if (g !== gen) note(ow, "the Transfer log could not be walked` | killed | *a range the endpoint refuses is said in words, for the owners and the memories alike, and never read as none* | vs gallery 49 passed, 1 failed |
| y4-mem-refused | Y4 | a refused memories' range is said in words | `function (e) { if (g === gen) st.textContent = "its memories could not be read: "` → `function (e) { if (g !== gen) st.textContent = "its memories could not be read: "` | killed | *a range the endpoint refuses is said in words, for the owners and the memories alike, and never read as none* | vs gallery 49 passed, 1 failed |
| y4-fold | Y4 | the archive folds every field of each memory, the epoch last | `m.ref, m.author, m.epoch]));` → `m.ref, m.author, m.n]));` | killed | *the archive replays: the Inscribed logs, folded in order in the page, give the Journal's rootOf and countOf*; *a rootOf that disagrees with the logs is named: the archive does not replay, and why* | vs gallery 48 passed, 2 failed |
| y4-sort | Y4 | the memories are folded in order | `return a.n < b.n ? -1 : 1;` → `return a.n > b.n ? -1 : 1;` | killed | *the archive replays: the Inscribed logs, folded in order in the page, give the Journal's rootOf and countOf*; *the constellation draws one star per memory, the sealed one dim, the archive's line between them, and nothing in it loops*; *plain memories are printed as text and a sealed one as a sealed memory, never opened*; *a rootOf that disagrees with the logs is named: the archive does not replay, and why* | vs gallery 46 passed, 4 failed |
| y4-count | Y4 | the archive is held to countOf | `count !== BigInt(ms.length) ?` → `count === BigInt(ms.length) ?` | killed | *the archive replays: the Inscribed logs, folded in order in the page, give the Journal's rootOf and countOf*; *a rootOf that disagrees with the logs is named: the archive does not replay, and why* | vs gallery 48 passed, 2 failed |
| y4-root | Y4 | the archive is held to rootOf, and a disagreement named | `: !same(root, live) ? "the archive does not replay: the logs fold to "` → `: same(root, live) ? "the archive does not replay: the logs fold to "` | killed | *the archive replays: the Inscribed logs, folded in order in the page, give the Journal's rootOf and countOf*; *a rootOf that disagrees with the logs is named: the archive does not replay, and why* | vs gallery 48 passed, 2 failed |
| y4-dim | Y4 | the sealed memory's star is the dim one | `"fill-opacity": m.kind === 4 ? ".3" : "1"` → `"fill-opacity": m.kind === 3 ? ".3" : "1"` | **survived** | none | vs gallery 50 passed, 0 failed |
| y4-line | Y4 | the archive's line joins each star to the one before it | `if (px != null) sv("line"` → `if (px == null) sv("line"` | killed | *the constellation draws one star per memory, the sealed one dim, the archive's line between them, and nothing in it loops* | vs gallery 49 passed, 1 failed |
| y4-sealed | Y4 | a sealed memory is never opened | `m.kind === 4 ? "— a sealed memory —" : TX(m.body)` → `m.kind === 3 ? "— a sealed memory —" : TX(m.body)` | killed | *plain memories are printed as text and a sealed one as a sealed memory, never opened* | vs gallery 49 passed, 1 failed |
| y4-dim+ (pass 2) | Y4 | the sealed memory's star is the dim one | `"fill-opacity": m.kind === 4 ? ".3" : "1"` → `"fill-opacity": m.kind === 3 ? ".3" : "1"` | killed, by the sentence W17 adds | *the dim star is the sealed memory's and no other: the note and the milestone shine at full strength* | vs gallery 53 passed, 1 failed |
| y5-market | Y5 | the owned-market step reads done while the market is closed | `mOk = !isHub \|\| !mk.b(7) \|\| mk.w(9) >= D.end` → `mOk = !isHub \|\| mk.b(7) \|\| mk.w(9) >= D.end` | killed | *the sale is laid out as steps read from the chain: the Reach to seal, the market already closed, then approve, validate and publish, noth…*; the group stopped at the wait at tools/verify-site/gallery.mjs:314 | vs gallery 29 passed, 2 failed |
| y5-seal | Y5 | the Reach is sealed to the order's end | `seal("sealReach", RC, "reach.seal", [D.end]` → `seal("sealReach", RC, "reach.seal", [D.start]` | killed | *the Reach is sealed to the listing's end, on the chain's clock, in a slab that says a seal only lengthens*; the group stopped at the wait at tools/verify-site/gallery.mjs:83 | vs gallery 29 passed, 2 failed |
| y5-end | Y5 | the order's end is the days typed, on the chain's clock | `end: v[1] + BigInt(days) * 86400n` → `end: v[1] + BigInt(days) * 8640n` | killed | *the Reach is sealed to the listing's end, on the chain's clock, in a slab that says a seal only lengthens* | vs gallery 49 passed, 1 failed |
| y5-approve | Y5 | Seaport is approved for the one token, never as an operator | `one = k === 721 && t.id < 1n << 255n` → `one = k === 721 && t.id > 1n << 255n` | killed | [vs gallery] *Seaport is approved for this one token, exactly, never as an operator over all*; [vc gallery] *in Chromium the holder lists #1 from the Gallery by a person's path — review, seal the Reach, let Seaport move it, validate, publish — fo…*; [vc gallery] *in Chromium a second account finds the Gallery listing from the chain's logs, its price under the art, and buys it with one click and one…* | vs gallery 49 passed, 1 failed; vc gallery 6 passed, 2 failed |
| y5-zone | Y5 | an INTACT order names the Bazaar as its zone | `D.p = [acct, isHub ? BZ : ZA,` → `D.p = [acct, isHub ? ZA : ZA,` | killed | *validate carries the order zoned to the Bazaar under pinHash(id, the live fingerprint, no floors), from the wallet, with no signature, ev…*; *a second account finds the listing from the Bazaar's logs, its order rebuilt from Seaport's OrderValidated near its publication and still…*; *buy is Seaport.fulfillOrder(order, 0) with exactly the price as value*; the group stopped at the wait at tools/verify-site/gallery.mjs:83 | vs gallery 33 passed, 4 failed |
| y5-pin | Y5 | the zone hash is bazaar.pinHash of this id and the live fingerprint | `read(BZ, "bazaar.pinHash", [t.id,` → `read(BZ, "bazaar.pinHash", [0n,` | killed | *validate carries the order zoned to the Bazaar under pinHash(id, the live fingerprint, no floors), from the wallet, with no signature, ev…*; *publish goes to the Bazaar with the same order and no floors*; the group stopped at the wait at tools/verify-site/gallery.mjs:83 | vs gallery 31 passed, 3 failed |
| y5-type | Y5 | an INTACT order is FULL_RESTRICTED, so the zone is asked at the fill | `isHub ? 2 : 0, D.start` → `isHub ? 0 : 0, D.start` | killed | *publish goes to the Bazaar with the same order and no floors*; the group stopped at the wait at tools/verify-site/gallery.mjs:83 | vs gallery 32 passed, 2 failed |
| y5-publish | Y5 | publish goes to the Bazaar | `propose({ to: BZ, key: "bazaar.publish"` → `propose({ to: SEA, key: "bazaar.publish"` | killed | *publish goes to the Bazaar with the same order and no floors*; the group stopped at the wait at tools/verify-site/gallery.mjs:83 | vs gallery 32 passed, 2 failed |
| y5-cancel | Y5 | the seller's own live listing offers cancel | `if (same(seller, acct) && s.ok && !s.cancelled` → `if (!same(seller, acct) && s.ok && !s.cancelled` | killed | *an INTACT listing is validated and published from the lane with no signature: Seaport holds it validated, the Bazaar indexed it, and its …* | vs gallery 49 passed, 1 failed |
| y6-window | Y6 | the order is rebuilt from OrderValidated in the 256 blocks before its publication, never a walk from 0 | `hexb(b > 256n ? b - 256n : 0n)` → `hexb(b < 256n ? b - 256n : 0n)` | killed | *a second account finds the listing from the Bazaar's logs, its order rebuilt from Seaport's OrderValidated near its publication and still…* | vs gallery 49 passed, 1 failed |
| y6-check | Y6 | an order zoned to the Bazaar is held to bazaar.check | `same(o.p[1], BZ) && !none(o.p[7]) ? read(BZ, "bazaar.check"` → `!same(o.p[1], BZ) && !none(o.p[7]) ? read(BZ, "bazaar.check"` | killed | *a second account finds the listing from the Bazaar's logs, its order rebuilt from Seaport's OrderValidated near its publication and still…*; the group stopped at the wait at tools/verify-site/gallery.mjs:379 | vs gallery 37 passed, 2 failed |
| y6-check-end | Y6 | bazaar.check is asked at the listing's end | `read(BZ, "bazaar.check", [o.p[7], o.p[6]])` → `read(BZ, "bazaar.check", [o.p[7], o.p[5]])` | **survived** | none | vs gallery 50 passed, 0 failed |
| y6-best | Y6 | a live listing's price stands under the art | `if (word === "live") best(pr.v, c, "on Seaport, until "` → `if (word === "filled") best(pr.v, c, "on Seaport, until "` | killed | [vs gallery] *a second account finds the listing from the Bazaar's logs, its order rebuilt from Seaport's OrderValidated near its publication and still…*; [vs gallery] *the sale enters its story from Seaport's OrderFulfilled, and the listing reads filled*; [vc gallery] *in Chromium a second account finds the Gallery listing from the chain's logs, its price under the art, and buys it with one click and one…* | vs gallery 48 passed, 2 failed; vc gallery 7 passed, 1 failed |
| y6-value | Y6 | the buy sends exactly the price as value | `value: c ? 0n : pr.v,` → `value: c ? 0n : pr.tok,` | killed | *buy is Seaport.fulfillOrder(order, 0) with exactly the price as value*; the group stopped at the wait at tools/verify-site/gallery.mjs:83 | vs gallery 35 passed, 2 failed |
| y6-royalty | Y6 | the royalty item pays the royalty receiver | `[[0, ZA, 0n, roy, roy, D.roy[0]]]` → `[[0, ZA, 0n, roy, roy, acct]]` | killed | *buy is Seaport.fulfillOrder(order, 0) with exactly the price as value*; the group stopped at the wait at tools/verify-site/gallery.mjs:83 | vs gallery 35 passed, 2 failed |
| y6-sold | Y6 | a sale's price is what the consideration paid | `v += W(h, q2 + 3);` → `v += W(h, q2 + 2);` | killed | *the sale enters its story from Seaport's OrderFulfilled, and the listing reads filled*; *and its sale is found by the offerers that published it, though the contract emits no Transfer* | vs gallery 48 passed, 2 failed |
| y6-filled | Y6 | a filled order reads filled | `W(v[1], 2) >= W(v[1], 3)` → `W(v[1], 2) > W(v[1], 3)` | killed | *the sale enters its story from Seaport's OrderFulfilled, and the listing reads filled* | vs gallery 49 passed, 1 failed |
| y6-sellers | Y6 | a sale is found by every offerer that published it | `sellers.push("0x" + l.data.slice(26, 66));` → `sellers.push("0x" + l.data.slice(26, 64));` | killed | *and its sale is found by the offerers that published it, though the contract emits no Transfer* | vs gallery 49 passed, 1 failed |
| y6-mprice | Y6 | the Market's listing is printed as listingOf holds it | `price = L.w(2), until = L.w(3)` → `price = L.w(3), until = L.w(3)` | killed | *the Market's listing is printed as listingOf holds it, its price under the art*; *the Market's buy sends exactly the listed price*; the group stopped at the wait at tools/verify-site/gallery.mjs:83 | vs gallery 43 passed, 3 failed |
| y6-mvalue | Y6 | the Market's buy sends exactly the listed price | `args: [t.id, price, pin], value: price,` → `args: [t.id, price, pin], value: until,` | killed | *the Market's buy sends exactly the listed price*; the group stopped at the wait at tools/verify-site/gallery.mjs:83 | vs gallery 44 passed, 2 failed |
| y6-check-end+ (pass 2) | Y6 | bazaar.check is asked at the listing's end | `read(BZ, "bazaar.check", [o.p[7], o.p[6]])` → `read(BZ, "bazaar.check", [o.p[7], o.p[5]])` | killed, by the sentence W17 adds | *a listing that outlives its Reach's seal is refused in words: bazaar.check is asked at the listing's end and names ReachSealShort, though…* | vs gallery 53 passed, 1 failed |
| y7-words | Y7 | the zone's error is named in words | `n = s.split("(")[0];` → `n = s.split(")")[0];` | killed | [vs gallery] *a moved fingerprint is refused in words: bazaar.check names FingerprintMoved, the lane says the token changed since it was listed, and of…*; [vc gallery] *in Chromium a listing whose token moved since it was listed reads refused by the zone, in words a person can see, and offers no buy* | vs gallery 49 passed, 1 failed; vc gallery 7 passed, 1 failed |
| y7-state | Y7 | a zone that answers anything but zero is refused | `: zone && !/^0+$/.test(zone) ? "refused"` → `: zone && /^0+$/.test(zone) ? "refused"` | killed, at a wait | the group stopped at the wait at tools/verify-site/gallery.mjs:332 | vs gallery 33 passed, 1 failed |
| y8-spec | Y8 | the spec shows the minted count against the cap | `+ " of " + s[3]); kv(sp, "price"` → `+ " of " + s[7]); kv(sp, "price"` | killed | *a Studio collection's spec is read from the chain and shown before anything is signed, with the via the link carries* | vs gallery 49 passed, 1 failed |
| y8-value | Y8 | the mint pays the price exactly | `args: [acct, VIA], value: price,` → `args: [acct, VIA], value: now,` | killed | *the mint's slab sends exactly the price, mints to the connected wallet, and names the link's via*; the group stopped at the wait at tools/verify-site/gallery.mjs:83 | vs gallery 20 passed, 2 failed |
| y8-via | Y8 | the mint names the link's via | `args: [acct, VIA], value` → `args: [acct, 0n], value` | killed | *the mint's slab sends exactly the price, mints to the connected wallet, and names the link's via*; *a link's ?via= that is a token's number, as the Studio lane's link carries it, names that token's persona: ?via=2 mints through #2's* | vs gallery 48 passed, 2 failed |
| y8-to | Y8 | the mint mints to the connected wallet | `args: [acct, VIA], value` → `args: [HUB, VIA], value` | killed | *the mint's slab sends exactly the price, mints to the connected wallet, and names the link's via*; *after the mint lands the lane opens the token the Transfer log names, the wallet's* | vs gallery 48 passed, 2 failed |
| y8-log | Y8 | the minted token is the one the Transfer log names | `cur = { c: t.c, id: BigInt(l.topics[3]) };` → `cur = { c: t.c, id: BigInt(l.topics[2]) };` | killed, at a wait | the group stopped at the wait at tools/verify-site/gallery.mjs:237 | vs gallery 21 passed, 1 failed |
| y8-query | Y8 | via is the link's ?via= | `new URLSearchParams(location.search).get("via")` → `new URLSearchParams(location.search).get("vi")` | killed | *a Studio collection's spec is read from the chain and shown before anything is signed, with the via the link carries*; *the mint's slab sends exactly the price, mints to the connected wallet, and names the link's via*; *a link's ?via= that is a token's number, as the Studio lane's link carries it, names that token's persona: ?via=2 mints through #2's* | vs gallery 47 passed, 3 failed |
| y9-disabled | Y9 | the OpenSea switch is disabled | `sw.disabled = true;` → `sw.disabled = false;` | killed | *include OpenSea reads the door the Timelock wrote and prints it beside a switch that is off and disabled, with the sentence of why, and n…* | vs gallery 49 passed, 1 failed |
| y9-door | Y9 | the door printed is the one the Timelock wrote, opensea.v2 | `ui.khex("opensea.v2")` → `ui.khex("opensea.v1")` | killed | *include OpenSea reads the door the Timelock wrote and prints it beside a switch that is off and disabled, with the sentence of why, and n…* | vs gallery 49 passed, 1 failed |
| y10-chip | Y10 | an absent V2 contract's section is the not-deployed chip | `(S.absent & b ? "not deployed on this chain"` → `(S.reported & b ? "not deployed on this chain"` | killed | *where a V2 contract is not deployed its section is the chip by CONSOLE §6.3, never a zero, and no read is sent to its codeless address* | vs gallery 49 passed, 1 failed |
| y10-codeless | Y10 | no read goes to a codeless Bridges | `if (three(row, "bridges")) return door.remove();` → `if (three(row, "bridges")) door.remove();` | killed | *where a V2 contract is not deployed its section is the chip by CONSOLE §6.3, never a zero, and no read is sent to its codeless address* | vs gallery 49 passed, 1 failed |
| y10-viewer | Y10 | the viewer is offered nothing: can is the console's and a connected account's | `can = ui.mode() === "console" && !!acct;` → `can = ui.mode() === "console" \|\| !!acct;` | **survived** | none | vs gallery 50 passed, 0 failed |
| y10-viewer+ (pass 2) | Y10 | the viewer is offered nothing: can is the console's and a connected account's | `can = ui.mode() === "console" && !!acct;` → `can = ui.mode() === "console" \|\| !!acct;` | killed, by the sentence W17 adds | *the holder's own wallet in the viewer is offered no sale: no sell form, no control, and nothing prompts* | vs gallery 53 passed, 1 failed |
| y11-shift | Y11 | a token number below 2^96 is that hub token's persona | `BigInt(HUB) << 96n \| v : v;` → `BigInt(HUB) << 95n \| v : v;` | killed | *a link's ?via= that is a token's number, as the Studio lane's link carries it, names that token's persona: ?via=2 mints through #2's* | vs gallery 49 passed, 1 failed |
| y11-form | Y11 | only a number below 2^96 is taken as a token number | `return v && !(v >> 96n) ?` → `return v && (v >> 96n) ?` | killed | *a link's ?via= that is a token's number, as the Studio lane's link carries it, names that token's persona: ?via=2 mints through #2's* | vs gallery 49 passed, 1 failed |

### F20–F24, S27, S28, N18 · what W14 changed

| # | Row | Guard | Mutant (from → to) | Verdict | The sentences that failed | The group's line |
|---|---|---|---|---|---|---|
| f20-wrap | F20 | #cslab [data-sentence] breaks anywhere | `line-height:1.45;overflow-wrap:anywhere}` → `line-height:1.45;overflow-wrap:normal}` | killed | *at 390 px a signing sentence that carries a full address wraps inside the sheet: its box does not overflow and no word runs past the edge* | vc boot 39 passed, 1 failed |
| f21-say | F21 | the one breath is 17 px, the shell's #swap-say | `#swap-say{font-size:17px}` → `#swap-say{font-size:16px}` | killed | [vs swap] *the lane writes no stylesheet of its own: the switch's knob, the one breath and the keepsake's orb are rules of the shell's*; [vc swap] *in Chromium the switch is the shell's: a row with its knob 40 × 22 px, on the token's two hues once turned on, the one breath at 17 px, a…* | vs swap 145 passed, 1 failed; vc swap 32 passed, 1 failed |
| f21-switch | F21 | the switch is the shell's button[role=switch] rule | `button[role=switch]{display:flex;` → `button[role=switc]{display:flex;` | killed | *the lane writes no stylesheet of its own: the switch's knob, the one breath and the keepsake's orb are rules of the shell's* | vs swap 145 passed, 1 failed |
| f21-knob | F21 | the switch's knob is 40 × 22 px | `button[role=switch]::after{content:"";width:40px;` → `button[role=switch]::after{content:"";width:41px;` | killed | [vc swap] *in Chromium the switch is the shell's: a row with its knob 40 × 22 px, on the token's two hues once turned on, the one breath at 17 px, a…* | vs swap 146 passed, 0 failed; vc swap 32 passed, 1 failed |
| f21-orb | F21 | the keepsake's orb is the shell's 46 px round rule | `#swap-kept .keepsake::before{content:"";float:left;width:46px;` → `#swap-kept .keepsake::before{content:"";float:left;width:4px;` | **survived** | none | vs swap 146 passed, 0 failed; vc swap 33 passed, 0 failed |
| f21-post | F21 | a post is 10 px above and below, the shell's .post | `.post{padding:10px 0;` → `.post{padding:11px 0;` | killed | [vs social] *an Agora post is drawn by the shell's .post rule: the row carries the class and no style of its own*; [vc social] *in Chromium an Agora post is drawn by the shell's .post rule: 10 px above and below, a rule beneath, and no style of the row's own* | vs social 124 passed, 1 failed; vc social 31 passed, 1 failed |
| f21-orb+ (pass 2) | F21 | the keepsake's orb is the shell's 46 px round rule | `#swap-kept .keepsake::before{content:"";float:left;width:46px;` → `#swap-kept .keepsake::before{content:"";float:left;width:4px;` | killed, by the sentence W17 adds | *the keepsake's orb is the shell's rule as it moved, whole: a 46 px circle, white into the token's two hues, glowing in the second* | vs swap 146 passed, 1 failed |
| f22-class | F22 | every code the shell draws carries .qr | `class: "qr" });` → `class: "q" });` | killed | [vs vault] *the Grip's QR carries the shell's qr class, the white 184 px card the shipped stylesheet draws under a code in a lane*; [vs launch] *the QR encodes the mint link, decoded apart from the shell, on a light ground*; [vc vault] *in the lane itself the Grip's QR is painted on a white card, 184 px square, and the code read off the screen where it stands decodes to e…* | vs vault 110 passed, 1 failed; vs launch 115 passed, 1 failed; vc vault 33 passed, 1 failed |
| f22-width | F22 | the .qr card is 184 px | `.qr{display:block;width:184px;` → `.qr{display:block;width:180px;` | killed | [vs vault] *the Grip's QR carries the shell's qr class, the white 184 px card the shipped stylesheet draws under a code in a lane*; [vs launch] *the QR encodes the mint link, decoded apart from the shell, on a light ground*; [vc vault] *in the lane itself the Grip's QR is painted on a white card, 184 px square, and the code read off the screen where it stands decodes to e…* | vs vault 110 passed, 1 failed; vs launch 115 passed, 1 failed; vc vault 33 passed, 1 failed |
| f22-white | F22 | the .qr card is white | `border-radius:16px;background:#fff}` → `border-radius:16px;background:#ffe}` | killed | [vs vault] *the Grip's QR carries the shell's qr class, the white 184 px card the shipped stylesheet draws under a code in a lane*; [vc vault] *in the lane itself the Grip's QR is painted on a white card, 184 px square, and the code read off the screen where it stands decodes to e…* | vs vault 110 passed, 1 failed; vc vault 33 passed, 1 failed |
| f23-gallery | F23 | an ERC-20 price is approved to Seaport, its line naming Seaport | `decimals: c.dec, who: "Seaport" }` → `decimals: c.dec, wh: "Seaport" }` | killed | *an NFT priced in WETH asks an exact approval first, and its line names who pulls it: Lets · Seaport pull exactly 0.05 WETH* | vs gallery 49 passed, 1 failed |
| f23-default | F23 | a step naming no spender keeps V1's line, the market | `(st.who \|\| "the market")` → `(st.who \|\| "the Market")` | killed | *the market's exact approve keeps V1's line: Lets · the market pull exactly 1 WETH* | vs swap 145 passed, 1 failed |
| f23-who | F23 | a step's who names the one who pulls | `(st.who \|\| "the market")` → `(st.why \|\| "the market")` | killed | [vs swap] *locked, the exact approval's line names who pulls it: Lets · the Keepsake pull exactly 1 WETH*; [vs vault] *the exact approval's line names who pulls it: Lets · the Keepsake pull exactly 500 USDC*; [vs gallery] *an NFT priced in WETH asks an exact approval first, and its line names who pulls it: Lets · Seaport pull exactly 0.05 WETH*; [vc vault] *in Chromium the exact approval's line names who pulls it: Lets · the Keepsake pull exactly 100 USDC* | vs swap 145 passed, 1 failed; vs vault 110 passed, 1 failed; vs gallery 49 passed, 1 failed; vc vault 33 passed, 1 failed |
| f24-words | F24 | a tuple's field is worded by its own type | `arr(t) ? arr(t)[1] : inner(t)[i], s)` → `arr(t) ? arr(t)[1] : inner(t)[0], s)` | killed | [vs vault] *K24 two batch rows → executeBatch((address,uint256,bytes)[]) with a decoded array length of 2; every call is a line, and the batch's [dat…*; [vs vault] *the vault lists open approvals and revokes in one press*; [vs launch] *every field of the spec is a line beside the tuple's [data-arg] row decoded from the calldata, and the calldata carries the persona and t…*; [vs swap] *spend and receive floors are the typed amount and the Router's own quote less half a percent — in the bytes, in the words, and in the tup…*; [vs gallery] *validate carries the order zoned to the Bazaar under pinHash(id, the live fingerprint, no floors), from the wallet, with no signature, ev…* | vs vault 109 passed, 2 failed; vs launch 115 passed, 1 failed; vs swap 145 passed, 1 failed; vs gallery 49 passed, 1 failed; vc journey 31 passed, 0 failed |
| f24-bracket | F24 | a tuple or an array is written in brackets | `Array.isArray(v) ? "[" + v.map` → `Array.isArray(v) ? "(" + v.map` | killed | [vs vault] *K24 two batch rows → executeBatch((address,uint256,bytes)[]) with a decoded array length of 2; every call is a line, and the batch's [dat…*; [vs vault] *K13 the exposure is printed before Sign — the native cap and each asset cap in words — and every argument is a line beside the [data-arg]…*; [vs vault] *the vault lists open approvals and revokes in one press*; [vs vault] *the third press is wrap: its bytes are exactly the Wrap the form says, the value is the ETH to the wei, and the sentence is plain words*; [vs vault] *after a warp, claimable grows and a claim pays the holder, whoever presses it*; [vs vault] *keepsakes: a bundle made with exact approvals, a gift, found from the logs, claimed, lengthened, sold slowly in human terms, remembered a…*; [vs launch] *createChecked carries the termsHash read in the same press; every argument is a line, and the tuple's [data-arg] row is decoded from the …*; [vs launch] *every field of the spec is a line beside the tuple's [data-arg] row decoded from the calldata, and the calldata carries the persona and t…*; [vs swap] *spend and receive floors are the typed amount and the Router's own quote less half a percent — in the bytes, in the words, and in the tup…*; [vs swap] *the lock is one slab: Keepsake.swapAndWrap, the ether as its value, the card's one breath as its sentence, and the estimate passes*; [vs swap] *lock what I receive: one slab swaps and wraps, the keepsake's id from the Wrapped log, then the memory*; [vs gallery] *validate carries the order zoned to the Bazaar under pinHash(id, the live fingerprint, no floors), from the wallet, with no signature, ev…* | vs vault 105 passed, 6 failed; vs launch 114 passed, 2 failed; vs swap 143 passed, 3 failed; vs gallery 49 passed, 1 failed |
| f24-decode | F24 | a tuple is decoded at its own offset | `if (t[0] === "(") return decSeq(inner(t), h, at);` → `if (t[0] === "(") return decSeq(inner(t), h, 0);` | killed: the run crashed | [vs vault] the group stopped at the wait at tools/verify-site/vault.mjs:202; [vs launch] the group stopped at the wait at tools/verify-site/launch.mjs:550; [vs swap] none: the run ended before its summary | vs vault 6 passed, 1 failed; vs launch 48 passed, 1 failed; vs swap no summary (crashed) |
| f24-bracket-vc (pass 2) | F24 | a tuple or an array is written in brackets | `Array.isArray(v) ? "[" + v.map` → `Array.isArray(v) ? "(" + v.map` | killed | *the raise is createChecked with the terms hash read in the same press*; *mint → open → connect → swap → speak → launch → seal → sell → the buyer's clean rightsOf* | vc journey 29 passed, 2 failed |
| n18-ag | N18 | Agora's rows exactly where Agora reports | `var AG = !!(S.reported & S.bits.agora)` → `var AG = !!(S.absent & S.bits.agora)` | killed | *on a band without Agora the key section is V1's: Parley's bound key and no Agora row or control*; *where Agora reports, the lane reads the token's key there too, under its persona: no key bound beside Parley's, and no binding offered be…*; the group stopped at the wait at tools/verify-site/identity.mjs:820 | vs identity 94 passed, 3 failed |
| n18-per | N18 | the persona is hub << 96 \| id | `PER = BigInt(HUB) << 96n \| ID;` → `PER = BigInt(HUB) << 95n \| ID;` | killed | *the Agora binding is bindKey(#1's persona) to Agora, stamped with custody epoch 1 in its sentence, beside Parley's bindKey(1)*; the group stopped at the wait at tools/verify-site/identity.mjs:126 | vs identity 96 passed, 2 failed |
| n18-read | N18 | the Agora key is read under the persona | `read(S.agora, "agora.keyOf", [PER])` → `read(S.agora, "agora.keyOf", [ID])` | killed, at a wait | the group stopped at the wait at tools/verify-site/identity.mjs:827 | vs identity 97 passed, 1 failed |
| s27-line | S27 | the room's line names both launches | `"Launch a collection of websites, or a coin."` → `"Launch a collection of websites, or a coin"` | killed | *the Studio room's line says what it launches: Launch a collection of websites, or a coin.* | vs launch 115 passed, 1 failed |
| s28-tocoin | S28 | toCoin presses A coin exactly where the Studio reports | `window.INTACT.reported & (window.INTACT.bits \|\| {}).studio` → `window.INTACT.absent & (window.INTACT.bits \|\| {}).studio` | killed | *where the Studio reports, the room opens on A collection and the coin journey's step presses A coin: the coin form is in view, as journey…* | vc launch 21 passed, 1 failed |

### S24, S26, K29, K31, F25

| # | Row | Guard | Mutant (from → to) | Verdict | The sentences that failed | The group's line |
|---|---|---|---|---|---|---|
| f25-c1 | F25 | the copy button is guarded where navigator.clipboard is undefined | `c ? c.writeText(GR)` → `1 ? c.writeText(GR)` | killed | [vc viewer] *fetch was never called: no http request left the data: page, no CSP violation, and no script threw, the Grip's copy button among the butt…*; [vc viewer] *the viewer shows link and QR and nothing signable*; [vc viewer] *the opaque origin shows the viewer and never a wallet prompt*; [vc vault] the group stopped at the wait at tools/verify-console.mjs:1934 | vc viewer 14 passed, 3 failed; vc vault 32 passed, 1 failed |
| k29-make | K29 | the keepsake form is for a connected console account | `if (can) make(b);` → `if (1) make(b);` | killed | *the viewer reads the keepsakes and offers no control: no form, no claim, no change*; *keepsakes: a bundle made with exact approvals, a gift, found from the logs, claimed, lengthened, sold slowly in human terms, remembered a…* | vs vault 109 passed, 2 failed |
| k29-act | K29 | the shell's act() renders no control where why() refuses | `if (mode !== "console" \|\| why(need)) return gate(parent, need), null;` → `if (mode !== "console" \|\| why(need)) gate(parent, need), null;` | killed, by a sentence the row does not cite | [vs boot] *rights that could not be read are not zero*; [vs boot] *every holder control is hidden*; [vs boot] *the holder's own address as a key is only a key*; [vc viewer] *a wallet with rights still gets no signable control in the viewer: 12 visible button(s) pressed across every lane, zero prompts, no slab*; [vc viewer] *the viewer shows link and QR and nothing signable*; [vc viewer] *the opaque origin shows the viewer and never a wallet prompt* | vs vault 111 passed, 0 failed; vs boot 136 passed, 3 failed; vc viewer 14 passed, 3 failed |
| k29-why | K29 | why() refuses everything in the viewer | `if (viewer) return VIEWER;` → `if (viewer) return null;` | killed | [vs vault] *the viewer reads the vault and offers no control, with the one sentence; the key field is a read*; [vs vault] *the viewer reads the keepsakes and offers no control: no form, no claim, no change*; [vs vault] *keepsakes: a bundle made with exact approvals, a gift, found from the logs, claimed, lengthened, sold slowly in human terms, remembered a…*; [vs launch] *the viewer reads every raise and offers no control and no input, with the one sentence*; [vs launch] *the viewer reads every collection, its link and its QR, and offers nothing to press*; [vs gallery] *the viewer draws the gallery and its story from the chain, prompts nothing and renders no control that signs* | vs vault 108 passed, 3 failed; vs launch 114 passed, 2 failed; vs gallery 49 passed, 1 failed |
| k31-pad | K31 | html's scroll-padding keeps a focused control clear of the bars | `scroll-padding:calc(` → `scroll-paddng:calc(` | killed | *at 390×844 every control of the keepsakes takes focus in view and ringed, never under the crest bar or the dock (30 tabbed)*; *a keepsake made as a gift with its exact approval, found by its recipient and claimed, clicked by a person's path* | vc vault 32 passed, 2 failed |
| s24-persona | S24 | the claim names the creator token's persona | `send(c, "collection.claim", [P]` → `send(c, "collection.claim", [ID]` | killed, by a sentence the row does not cite | [vs launch] *the claim says what Moonlit owes #1 and that only #1's fee sink is paid*; [vs launch] the group stopped at the wait at tools/verify-site/launch.mjs:1035; [vc launch] the group stopped at the wait at tools/verify-console.mjs:458 | vs launch 104 passed, 2 failed; vc launch 19 passed, 1 failed |
| s24-owed | S24 | the claim is drawn only while something is owed | `if (can && o) act(cl, "collectionClaim"` → `if (can && 1) act(cl, "collectionClaim"` | killed, by a sentence the row does not cite | *#1's collections list it: its terms, 0 of 100 minted, nothing owed, the mint link and its QR, its room (Agora's collectionKey) pointing t…*; the group stopped at the wait at tools/verify-site/launch.mjs:1039 | vs launch 105 passed, 2 failed |
| s24-via (pass 2) | S24 | what is owed the creator is the price less the referrer's share | `var v = VIA ? HUB << 96n \| BigInt(VIA) : 0n;` → `var v = VIA ? HUB << 95n \| BigInt(VIA) : 0n;` | killed | *a mint through the shared link credits the referrer: the Minted log names #1's persona as via with its 5 % share, and #1 is owed the price*; *the same link re-shared as #2's credits #2 its 5 % and #1 the rest*; *the creator's claim pays #1's fee sink, its Reach, exactly what was owed* | vs launch 113 passed, 3 failed |
| s26-form | S26 | the form is for a connected holder or its Reach, never the viewer | `if (can && ui.rights() & (R.HOLD \| R.ACCOUNT)) form(b, g);` → `if (1 && ui.rights() & (R.HOLD \| R.ACCOUNT)) form(b, g);` | killed | *the viewer reads every collection, its link and its QR, and offers nothing to press* | vs launch 115 passed, 1 failed |
| s26-mint | S26 | the viewer is offered no mint | `if (can) act(row, "collectionMint"` → `if (1) act(row, "collectionMint"` | killed | *the viewer reads every collection, its link and its QR, and offers nothing to press* | vs launch 115 passed, 1 failed |
| s26-log-words | S26 | a refused mint log is said in words | `"not counted: the endpoint refused the log"` → `"not counted: the endpoint refused the lo"` | killed | *a mint log the endpoint refuses is not counted, never 0 minted* | vs launch 115 passed, 1 failed |
| s26-log-count | S26 | a refused mint log is not counted | `mi.textContent = z[3] ? z[3].length` → `mi.textContent = z[0] ? z[3].length` | killed, at a wait | the group stopped at the wait at tools/verify-site/launch.mjs:1112 | vs launch 115 passed, 1 failed |

## 4. The survivors, and the sentences added

Six mutants survived the suites as they stood on fe96c8e. Each shows a claim
that no sentence held, and each claim could be held in a verify-site group.

For each, this unit added one sentence, in the group, with a condition of its
own, and left every existing sentence word for word. Each sentence passed on
the unmutated suite of copy three: gallery 55 passed and swap 147 passed,
0 failed. Each was then seen to fail, alone, under the mutant that had
survived without it.

| Survivor | The claim no sentence held | The sentence added | Before → after |
|---|---|---|---|
| y1-two (Y1) | The frame is lit by two colours, the art's two most vivid. *"its frame is lit by the colours its own fills and strokes paint with"* also accepts one colour twice. | `gallery.mjs` A: *"its frame is lit by two distinct colours, the two most vivid its art paints with, the most vivid first"*. Each colour's chroma is computed in the suite: (1 − \|2L − 1\|) × S for an hsl(), (max − min)/255 for a hex. | vs gallery 50 passed, 0 failed → 53 passed, 1 failed |
| y4-dim (Y4) | The dim star is the sealed memory's. *"… the sealed one dim …"* counts one dim star and finds the sealed one third, so a milestone dimmed in its place passed. | `gallery.mjs` C: *"the dim star is the sealed memory's and no other: the note and the milestone shine at full strength"* | 50 passed, 0 failed → 53 passed, 1 failed |
| y2-js (Y2) | A javascript: URI is never an anchor. E3's *"… neither drawn nor linked"* looks under `#lane-gallery #lane-gallery a`, a selector no element matches, so a link() that printed the URI and linked it too passed. | `gallery.mjs` E: *"no link the lane draws carries a javascript: URI: the hostile token's animation is printed as text, never an anchor"*. It reads the lane itself. | 54 passed, 0 failed (with the other five sentences) → 54 passed, 1 failed |
| y6-check-end (Y6) | The zone is asked at the listing's end. Every listing in the suite was sealed past its end or had moved, so a lane that asked `bazaar.check` at the listing's start passed them all. | `gallery.mjs`, a new block G2. #2, the buyer's since B, is sealed for 10 days and listed for 30: *"a listing that outlives its Reach's seal is refused in words: bazaar.check is asked at the listing's end and names ReachSealShort, though the seal stands now, and no buy is offered"* | 50 passed, 0 failed → 53 passed, 1 failed |
| y10-viewer (Y10) | The holder's own wallet in the viewer is offered no sale. Block L's wallet no longer holds #1 after F, so a lane whose `can` admitted any account the viewer reads quietly passed. | `gallery.mjs` L: *"the holder's own wallet in the viewer is offered no sale: no sell form, no control, and nothing prompts"* | 50 passed, 0 failed → 53 passed, 1 failed |
| f21-orb (F21) | The orb's values are the shell's as they moved. The V1 sentence finds each moved rule by its selector, and Chromium's measures the switch and the breath but not the orb. | `swap.mjs` V1: *"the keepsake's orb is the shell's rule as it moved, whole: a 46 px circle, white into the token's two hues, glowing in the second"*. It reads the shipped stylesheet. | vs swap 146 passed, 0 failed and vc swap 33 passed, 0 failed → vs swap 146 passed, 1 failed |

The second pass also ran four more mutants against copy three's suite. Each
failed a sentence its row cites:

- **y1-holder2.** y1-holder (`r.a(1)`) had stopped the group at block A's wait.
  This one names the hub as the holder, and fails *"… its holder is
  ownerOf's"*.
- **y1-src.** y1-decode had stopped at the same wait. This one draws the name
  as the image's source, and fails *"… the image is face 1's, decoded in
  place …"*.
- **f24-bracket-vc.** f24-words is equivalent on `createChecked`'s tuple
  (§6), so f24-bracket was run in Chromium. It fails *"the raise is
  createChecked with the terms hash read in the same press"*.
- **s24-via.** It fails S24's own sentence (§6).

## 5. The totals and the restore proof

| Pass | Copy | Mutants | Killed | Survived | Not a mutation |
|---|---|---|---|---|---|
| 1, the suites of fe96c8e | one (the Gallery) and two | 96 | 91 | 5: y1-two, y4-dim, y6-check-end, y10-viewer, f21-orb | 0 |
| 2, with five added sentences | three | 9: those five again, y1-holder2, y1-src, f24-bracket in Chromium, s24-via | 9 | 0 | 0 |
| 3, with the sixth | three | y2-js, first without its sentence, then with it | 1 of 2 runs | 1: y2-js, before its sentence | 0 |

That is **100 distinct mutants**. On the suites as committed (9e0ae0f) all
100 are killed: **0 survive, and none is "not a mutation"**.

Of the 91 kills of the first pass:
- **80 failed a sentence their row cites, by name**;
- 6 stopped the group at a wait first: y1-decode, y1-holder, y7-state,
  y8-log, n18-read and s26-log-count;
- 2 ended a run before its summary: y2-unhandled, and f24-decode in the swap
  group (its vault and launch runs stopped at waits);
- 3 failed sentences their row does not cite: s24-persona, s24-owed and
  k29-act.

Every row of the brief has at least one mutant that fails a sentence it cites,
by name.

**The restore proof.** Each campaign ended by comparing every file it had
touched with the bytes it read before its first mutant, by sha256.

| File | sha256, before = after | Campaigns |
|---|---|---|
| `engine/panels/gallery.js` | `4b0aaa70e87ca4d79e60c0117bfb3dcd91f738b3b49721433319f6a78749e7a4` | 1, 3, 4 |
| `engine/app.html` | `5b7a583720a7f26352fd11b005837aa57e6e2cff7e205ad47db45cc59ef34e46` | 2, 3 |
| `engine/app.css` | `d5cb785e61b39e4b2b60d8ed8d3ca4f0e40ab7cd2150132f75f65c76dfa15938` | 2, 3 |
| `engine/panels/launch.js` | `e3217cc7e03267655c12954c1c6512ca1d13932301a01b15df928b10d4234dbb` | 2, 3 |
| `engine/panels/identity.js` | `7fd297ce53ba68a863449e17a9b23a8858cc426514b3036c23666fea3c4072b8` | 2 |
| `engine/panels/vault.js` | `740fb3d2e5a6d4b5c99383e9338e3289d32a5195e69f3d7b3560a50d484d481e` | 2 |
| `tools/verify-console.mjs` | `62822c2f0e28f2a82325299cd6a2ef8899aa6266b929a4f6f3cf82d9994aadfc` | 2 |

Campaign 1 is the Gallery's, 2 the rest, 3 the second pass and 4 the third.

- Every one of the 107 mutant records reads `restored: true`. That is 66 + 30
  + 9 + 2, the re-runs of the later passes included.
- Each campaign's last `node tools/build-app.mjs` printed the same engine
  hash, panel pins and shell gzip as the unmutated build.
- At the end, `sha256sum -c` of the seven files against this worktree's
  copies at fe96c8e read equal in all three copies.
- The container restarted after every campaign had ended. The same check,
  run again before the report was written, read equal in all three copies.

## 6. What the mutants showed beyond the rows

1. **A page's unhandled rejection crashes verify-site, as CLAUDE.md's trap
   *solc kills a run on any unhandled rejection* says.**
   - `node_modules/solc/soljson.js` installs
     `process.on("unhandledRejection", r => { throw r })`. The shim's own
     handler therefore never gets to record the rejection in the page's
     errors.
   - Under y2-unhandled (`PUB.catch` → `PUB.then`), block B's refused log
     range left a rejection unhandled, and the run died with no summary.
   - It is a failed run, which check counts as failed. But M's sentence,
     *"… and no page threw, in any gallery page of the run"*, can never be
     the line that says so.
2. **The shell's decoder trusts an array's length word.**
   - Under f24-decode, a tuple decoded at offset 0 read a length word as a
     count, and `decVal`'s `Array(n).fill` ran node out of memory in the swap
     group (`FatalProcessOutOfMemory`).
   - The same path decodes return data and revert data, so a hostile
     contract's answer can ask a lane for a huge array. Request 3.
3. **The viewer's guard is layered, so one layer's mutant is masked by the
   others.**
   - Three layers keep the viewer from signing: the panel's `can`, the
     shell's `act()` (its mode, and `why()`), and `propose()`.
   - k29-act made `act()` draw every control. The vault group passed it
     whole: vault.js never asks `act()` in the viewer. Boot (*"rights that
     could not be read are not zero"*) and Chromium's viewer (*"a wallet with
     rights still gets no signable control in the viewer: 12 visible
     button(s) pressed …"*) killed it.
   - k29-make, a vault.js mutant (`if (can) make(b)` → `if (1) make(b)`),
     fails K29's sentence. K29's status says no mutant of the panel did.
   - s26-mint was refused by `act()`, and caught by the viewer's one-sentence
     rule. Each refused row appended the viewer's gate sentence, so the lane
     no longer said *nothing here can sign* exactly once.
4. **The lane's own CSP is load-bearing.** Without its meta (y3-csp),
   Chromium sent the frame's `fetch('/services.json')` to the gateway, and
   only CORS refused the answer. Both Chromium sentences failed, the second
   on *sent: …/services.json*.
5. **The zone holds the royalty.** y6-royalty paid the royalty item to the
   seller.
   - The buy's estimate did not pass: its slab showed no gas units. So the
     buy's sentence failed, and the sign's wait then stopped the group.
   - The order's only change is that item's recipient. The Bazaar's
     `authorizeOrder` holds every fill to the royalty (`_requireRoyalty`).
   - F9's outcome sentence is never reached by a mutant that the chain
     refuses.
6. **S24's sentence holds what was owed, not the claim's guards.**
   - The claim's persona (s24-persona) and its owed gate (s24-owed) are held
     first by *"the claim says what Moonlit owes #1 and that only #1's fee
     sink is paid"* and by *"#1's collections list it: …, nothing owed,
     …"*. S24 cites neither. The group then stops at the sign's wait or the
     list's.
   - The Collection pays `owed[persona]` to `payeeOf(persona)`, so no
     one-token mutant of the panel lets a wrong claim land.
   - s24-via (W12's "via" row, aimed at the amount owed) fails S24's own
     sentence: the creator is credited the whole price.
7. **f24-words is equivalent on a tuple with no bytes.** `words()` differs by
   type only for `bytes` (and a sentence's shortened address).
   `createChecked`'s tuple is fourteen numbers and an address, so its row
   reads the same. f24-bracket fails it in Chromium.
8. **The waits that throw name the claim's line.** Six mutants were killed
   only at a wait, and so was f25-c1's vault run. Each wait waits for the
   very state the next sentence restates (fe96c8e's line numbers):
   - the art, for y1-decode and y1-holder (`gallery.mjs:143`);
   - the minted token's page, for y8-log (`:237`);
   - the seller's live listing, for y7-state (`:332`);
   - the Agora key bound, for n18-read (`identity.mjs:827`);
   - a refused mint log, for s26-log-count (`launch.mjs:1112`);
   - the copy button's words, for f25-c1 (`verify-console.mjs:1934`).

   The run fails at the claim's line either way. Each of those rows also has
   a mutant that fails a sentence it cites by name.

## 7. The lines after

On the real tree at 9e0ae0f (this unit's sentences, committed), 2026-10-20,
01:56–02:03:

| Run | Last line |
|---|---|
| `node tools/build-app.mjs` | *wrote dist/shards.json, dist/manifest.json, dist/app.html, dist/panels/\*.js*. The shell is 22,400 B gzip, the gallery 12,233 B and swap 11,650 B, all unchanged: no `engine/` byte moved. |
| `node tools/verify-site.mjs` | **824 passed, 0 failed** (818 before). By group: boot 133, swap 141 (was 140), social 119, launch 110, vault 105, identity 92, agent 68, gallery 49 (was 44). |
| `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/verify-console.mjs --group gallery` | **8 passed, 0 failed** (Chromium 141.0.7390.37) |
| `node tools/static-audit.mjs` | *static audit passed — 10 Solidity rules, 4 JS rules; this is not a security audit* |
| `node tools/invariants-check.mjs` | **225 passed, 0 failed** (no row cites the six added sentences yet; request 1) |

An earlier full run, before the sixth sentence was committed, printed the
same 824 passed, 0 failed, with all six sentences in it.

## 8. Requests for files this unit does not own

1. **`docs/INVARIANTS.md` and DESIGN §14 (the integrator).**
   - The rows below can be marked live. Each runs in `npm run check`
     (verify:site and verify:console), and each has a mutant of §3 that
     fails a sentence it cites, by name.
   - Rows that W17 extended should also cite the sentence W17 added. The
     table quotes them.

   | Row | Status, with its evidence |
   |---|---|
   | Y1 | live (W17). Its five sentences fail under: 1 y1-face, y1-name, y1-src; 2 y1-hue, y1-chroma, y1-sort; 3 y1-traits; 4 y1-ownsite, y1-holder2; 5 y1-form, y1-price. Cite *"its frame is lit by two distinct colours, the two most vivid its art paints with, the most vivid first"*, which y1-two fails. |
   | Y2 | live (W17). Its first sentence fails under y2-link and y2-rel, its second under y2-img and y2-link. Cite *"no link the lane draws carries a javascript: URI: the hostile token's animation is printed as text, never an anchor"*, which y2-js fails. The third's "nor linked" matches no element (request 4). The fourth fails only as a crash (§6.1). |
   | Y3 | live (W17). y3-sandbox, y3-csp and y3-csp-src fail its three sentences, two of them in Chromium. |
   | Y4 | live (W17). Its six sentences fail under y4-owners, y4-order, y4-owners-refused, y4-mem-refused, y4-fold, y4-sort, y4-count, y4-root, y4-line and y4-sealed. Cite *"the dim star is the sealed memory's and no other: the note and the milestone shine at full strength"*, which y4-dim fails. |
   | Y5 | live (W17). y5-market, y5-seal, y5-end, y5-approve (in both suites), y5-zone, y5-pin, y5-type, y5-publish and y5-cancel each fail a cited sentence. No mutant was aimed at the plain NFT's sale. |
   | Y6 | live (W17). y6-window, y6-check, y6-best (in both suites), y6-value, y6-royalty, y6-sold, y6-filled, y6-sellers, y6-mprice and y6-mvalue each fail a cited sentence. Cite G2's *"a listing that outlives its Reach's seal is refused in words: bazaar.check is asked at the listing's end and names ReachSealShort, though the seal stands now, and no buy is offered"*, which y6-check-end fails. |
   | Y7 | live (W17). y7-words fails both sentences, the verify-site one and Chromium's. |
   | Y8 | live (W17). y8-spec, y8-query, y8-value, y8-via, y8-to and y1-holder2 fail its three sentences. |
   | Y9 | live (W17). y9-disabled and y9-door fail its sentence. |
   | Y10 | live (W17). y10-chip and y10-codeless fail the chip sentence, and the shell's k29-why the viewer's. Cite *"the holder's own wallet in the viewer is offered no sale: no sell form, no control, and nothing prompts"*, which y10-viewer fails. |
   | Y11 | live (W17). y11-shift and y11-form fail its sentence. |
   | F20 | live (W17). f20-wrap (`anywhere` → `normal`) fails it in Chromium. |
   | F21 | live (W17). f21-say, f21-switch, f21-knob and f21-post fail its four sentences. Cite *"the keepsake's orb is the shell's rule as it moved, whole: a 46 px circle, white into the token's two hues, glowing in the second"*, which f21-orb fails. |
   | F22 | live (W17). f22-class, f22-width and f22-white fail its three sentences. |
   | F23 | live (W17). f23-default fails the first sentence, f23-who the other four, and f23-gallery the Gallery's. |
   | F24 | live (W17). f24-bracket fails its four verify-site sentences and, in Chromium, the fifth. f24-words fails two of them. |
   | S24 | live (W17). s24-via fails its first sentence. Also cite *"the claim says what Moonlit owes #1 and that only #1's fee sink is paid"* (`tools/verify-site/launch.mjs`). It is what holds the claim's persona (s24-persona); S24's own sentence holds the amount (§6.6). |
   | S26 | live (W12, W17). W12's gate fails the first sentence. s26-form, s26-mint and k29-why fail the second, and s26-log-words the third. |
   | S27 | live (W17). s27-line fails it. |
   | S28 | live (W17). s28-tocoin, in a copy of `tools/verify-console.mjs`, fails it. |
   | N18 | live (W17). n18-ag fails its first two sentences and n18-per its third. Under n18-read the group stops at the wait for the fourth. |
   | K29 | live (W17). k29-make, a mutant of `vault.js`, and k29-why, of the shell, fail it. Replace the status's *"no mutant of the panel fails this sentence alone"*. |
   | K31 | live (W17). k31-pad (`scroll-padding` → `scroll-paddng`) fails it: 5 of 30 controls hide under the bars. |
   | F25 | live (W10, W17). f25-c1, W10's c1 again, fails the second sentence in the viewer group. W10's own run of c1 failed the first; under W14's waits, the vault group now stops at the wait before it. |

2. **`tools/verify-console.mjs` (W16).**
   - **The orb in Chromium.** f21-orb survived the swap group. A sentence
     would read `getComputedStyle(card, "::before")` on a
     `#swap-kept .keepsake`: *"in Chromium the keepsake's orb is the shell's:
     a 46 × 46 px circle before the keepsake's words"*.
   - **F25's first sentence.** Optionally, the wait at
     `verify-console.mjs:1934` (fe96c8e) could be soft, since its sentence
     reads the ticker itself. c1 would then fail that sentence by name.
3. **`engine/app.html` (the shell's owner).** `decVal` should refuse an
   array whose length word exceeds the words that remain after it. A decode
   at a wrong offset, or a hostile answer, then reads as no row, never as
   `Array(n).fill` for a huge n. That is what ran node out of memory under
   f24-decode (§6.2).
4. **`tools/verify-site/gallery.mjs`, E3's condition (the suite's next
   owner).** `LL(page, "#lane-gallery a")` scopes twice, so it matches
   nothing. `LL(page, "a")` is what it meant. Its sentence would keep its
   text. This unit may only add sentences, so it added E's instead.
5. **`CLAUDE.md` (the integrator).**
   - The mutation gate's trap says `tools/mutations.mjs` restores *"in a
     `finally` and on SIGINT"*. A driver must restore on SIGTERM too: this
     session's background limit stopped two campaigns with SIGTERM, and they
     were whole only because their driver restored on it.
   - *solc kills a run on any unhandled rejection* is already a trap, and
     y2-unhandled met exactly it.
6. **`tools/mutations.mjs` (its owner).** A JavaScript mode, as W11's
   request 8 asked. This unit's scratch driver has the shape:
   - an exactly-once *from* text;
   - the build's hashes compared, so a mutant the minifier erases is not
     counted;
   - the groups each row names;
   - every ✗ line recorded, and a crash counted as failed;
   - the restore by sha256.

No mutant needed the two lines the integrator moved on its branch
(`tools/verify-site/launch.mjs` 906–907, W4's template read; the A13 sentence
of `tools/verify-site/agent.mjs`). Neither was touched. Nothing here touches
F9–F14 or F16–F18.
