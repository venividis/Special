# W8 · the Gallery lane, and the seventh panel

V2 wave 2, unit W8 (`docs/V2.md` §2, §3.3, §4). The owner asked for "the
most advanced NFT viewer that presents the NFTs in a way that makes you want
to buy them; you should be able to buy and sell any NFT this way". This unit
adds a Gallery lane, `engine/panels/gallery.js`. It opens any ERC-721 or
ERC-1155 from the chain alone and tells its story. It buys and sells it on
Seaport 1.6 through the Bazaar, mints from a Studio collection, and prints
the OpenSea door without ever opening it.

The lane is the console's seventh panel. That made it a contract change: the
Engine holds up to eight lanes, and the Catalog's state gap and the
Premises' router name exactly the lanes it holds.

Every number below was measured on this tree (2f17d92 plus this unit's
changes, 2026-10-19), and the sentence names the run that printed it.

## 1. What the lane does

The lane renders in this order, top to bottom:

1. **The disclosure.** A `<details>` reading "open any NFT", closed while a
   token is shown and open when none is.
   - It takes an address and an id, a pasted `collection:id`, or a persona
     (`collection << 96 | id`, 29 to 78 digits).
   - Enter or **open** paints that token; **this token, #n** comes back.
2. **The hero**, art first:
   1. The image in an iridescent conic ring. The ring is lit by the two
      most vivid colours the art paints with: fills, strokes and gradient
      stops of a data: SVG, read as hex, `rgb()` or `hsl()`.
   2. Its name.
   3. **Its price**, while one stands: the lowest live ether price on
      Seaport or on the INTACT Market.
   4. Its facts: standard, collection, id and holder.
   5. Its description.
   6. Its attributes, as chips.
   7. Last, a token whose `animation_url` is `data:text/html` runs its own
      page in a second ring, in `<iframe sandbox="allow-scripts" srcdoc>`.

   How each kind of token is read:
   - An INTACT token is drawn from face 1, its crest. Its face 0 is this
     very console, and the lane says so instead of running a copy of it.
   - Any other token is read with `tokenURI` (ERC-721) or `uri` (ERC-1155,
     `{id}` filled), by `eth_call`.
   - `data:` JSON is decoded in place, base64 or plain.
   - An `image` that is data: SVG, PNG or GIF is drawn.
   - Anything at `ipfs://`, `ar://` or `http(s)://` is a link the person
     may open, with `rel="noopener noreferrer"`. The page never loads it.
3. **Buy it.**
   - **The INTACT Market's own listing** (`market.listingOf`), with its buy.
     A listing that has expired, or whose custody epoch moved, says so and
     offers nothing.
   - **Seaport listings** from the Bazaar's `Published` logs for (token, id).
     Each order is rebuilt from Seaport's `OrderValidated`, looked for first
     in the `Published` receipt and then in the 256 blocks before it.
     - It is held to `getOrderHash` at the seller's live counter, and to
       `getOrderStatus`.
     - An order zoned to the Bazaar is held to `bazaar.check(zoneHash,
       endTime)`.
   - Each row reads one of: live, not validated, cancelled, filled, void,
     not open, expired, seller moved it, refused or unpriced.
     - A refused one names the zone's error in words. For example: "refused
       by the zone: FingerprintMoved — the token changed since it was
       listed".
     - A live one offers **buy**, which is `Seaport.fulfillOrder(order, 0)`
       with exactly the price as value. An ERC-20 price is bought after an
       exact approval (`ui.approveExactThen`).
     - The seller's own live listing offers **cancel**, which is
       `Seaport.cancel([components])`.
4. **Sell it**, when the connected wallet holds the token.
   - The inputs are a price in ether and a number of days on the chain's
     clock. The ERC-2981 royalty is read for that price and comes out of it.
   - **review the listing** lays out the steps, each read from the chain on
     every paint. Only the first one not yet done carries its control:
     1. **seal the Reach** until the order's end;
     2. **seal its owned market**, when it is open (both for an INTACT
        token, each in a slab that says a seal only lengthens);
     3. **let Seaport move it**: an exact `approve(Seaport, id)`, or the
        step reads done when Seaport already may;
     4. **validate**: `Seaport.validate([order])` from the wallet, with no
        signature;
     5. **publish**: `bazaar.publish(order, [])`.
   - An INTACT order names the Bazaar as its zone, FULL_RESTRICTED, under
     `zoneHash = bazaar.pinHash(id, the live fingerprint, [])`. That hash is
     computed at validate time, after the seals, because the fingerprint
     includes them. Any other NFT's order is open, with no zone.
5. **Mint one**, from any `studio.isCollection` address.
   - `spec()` is read and shown before anything is signed: the name, the
     minted count against the cap, the price, the window, the per-wallet
     limit, the referral share and royalty, and the description.
   - Then `mint(to, via)` with the price exactly. `via` comes from a
     `?via=` in the link (digits only), else 0.
   - The minted token opens from the receipt's `Transfer` log.
6. **Its story.**
   - **Owners** come from `Transfer` logs filtered by the id. A range the
     endpoint refuses is a sentence, never zero.
   - **Memories** come from the Journal's `Inscribed` logs for (collection,
     id). They are folded in order and held to `rootOf` and `countOf`: "the
     archive replays", or why not. They are drawn as a constellation, one
     star per memory where its root puts it: a milestone larger, a sealed
     one dim, each behind a halo, nothing that moves. Up to eight rows
     follow; a sealed memory is never opened.
   - **Sales** come from Seaport's `OrderFulfilled` logs, filtered by the
     offerers that could have sold it: every `Transfer` recipient and every
     `Published` offerer. This finds a sale even on a contract that emits
     no `Transfer`.
7. **Include OpenSea.** A switch that is off and disabled (`role=switch`,
   `aria-checked=false`) sits beside the door the Timelock wrote in
   Bridges (`endpointOf(keccak("opensea.v2"))`). The sentence says why it
   stays off: OpenSea's book needs an API key and a request to a host this
   page never makes. A listing here is a Seaport order on chain, on the
   Seaport OpenSea settles on, so anyone can fill it. No fetch is made in
   this file.

Each V2 section appears only where its contract reports (`S.bits`,
`S.reported`, `S.absent`). Otherwise it draws the §6.3 chip and sends no
read to the codeless address.

## 2. The seventh panel: the Engine, the Catalog, the Premises

- **`src/Engine.sol`**
  - `PANELS = 8` sizes the two arrays.
  - `panelCount()` is now `view`: the loaded prefix, six in V1 and seven
    with the Gallery.
  - `freeze()` needs at least one lane and refuses a gap, meaning a slot
    loaded past an empty one.
  - `shardHashes()` lists the head, the body and the loaded panels only.
  - `loadPanel(8)` reverts `BadPanel`.
- **`src/Catalog.sol`**
  - One free function, `laneWord(verb)`, names the lanes: verb 1 is home,
    verbs 2–8 are swap, social, launch, vault, identity, agent and gallery.
    `Catalog.verbWord` returns it.
  - The state gap's panel map is one hole, `_panels(engine)`. It names each
    lane of the Engine's loaded prefix that a lane word names, with its
    pinned hash, in slot order, and never more than eight.
  - An Engine that does not answer has no lane. The old template always
    printed six keys, zero when unread.
- **`src/Premises.sol`**
  - `/manifest`'s panel route hashes the pins of the lanes the Engine holds.
  - `/panel/<name>.js` resolves among those lanes only, so an Engine of six
    answers 404 for `gallery.js`.
- **Tools**
  - `tools/build-app.mjs` and `tools/site.mjs` list seven panels.
  - `tools/gas.mjs` probes each listed lane.
  - `tools/deploy.mjs` checks `panelCount()` against the plan and writes the
    plan's lanes into the record.
  - `tools/recover-record.mjs` walks the lanes the record lists and then
    checks that the Engine holds no lane past them.
  - `tools/verify-gateway.mjs` asks for the record's lanes and checks the
    manifest's own.
  - `tools/verify-site/boot.mjs` re-pins the QR's module map.
    - The seventh `loadPanel` is one more deployer transaction before the
      Premises, so the harness Premises, the address the QR carries, moves
      one nonce on.
    - Wave 4 re-pinned it for the same reason, when `CatalogRowsPost`
      became one more CREATE.
    - The first full run on this tree read 645 passed, 1 failed, on
      *"the module map's keccak is pinned"*. Its decoder sentence held: an
      independent decoder read the new address back.
- **The live V1 records** (`deployments/31337.json`, `84532.json` and
  `84532.first.json`, six lanes each) keep their shape. Recovery walks each
  record's own lanes, so no schema rule applies and the schema stays 3.
  - `tools/verify-recover.mjs` deploys a band cut to V1's six lanes and
    recovers its record with 0 disagreeing.
  - A scratch proof held `verify-gateway`'s `checkHashes` to a six-lane and
    a seven-lane record. The gateway tool runs only over a wire, so this is
    not in the battery.
- **`engine/app.html`**: exactly the gallery's `ROOMS`, `ORDER` and `ICON`
  entries, +75 B of shell gzip.

## 3. Measured

| What | 2f17d92 | This unit | Printed by |
|---|---|---|---|
| gallery panel, gzip | — | **12,209 B** of 12,288 (79 B under); 30,972 B inflated | `node tools/build-app.mjs` |
| shell, gzip | 22,149 B | 22,224 B of 24,000 | `node tools/build-app.mjs` (2f17d92's tree built in a scratch copy) |
| engine load, storage gas | ≈ 15.26 M (8 loads) | ≈ 17.97 M (9 loads; each its own transaction) | `node tools/build-app.mjs` |
| Engine | 3,672 B | 3,766 B | `node tools/compile.mjs` |
| Catalog | 16,778 B | 16,846 B | same |
| CatalogState | 16,999 B | 17,775 B | same |
| Premises | 15,319 B | 15,572 B | same; every gated contract under 24,576 B, and the diamond ships (Intact 26,082 B, unchanged) |
| `hub.tokenURI(1)`, cold | 4.82 M | 4.86 M of 8.00 M | `node tools/gas.mjs` (2f17d92: docs/v2/INTEGRATION.md) |
| `/token/1/live` · `/token/1/hash` · `state.json` | 1.42 M · 2.14 M · 0.81 M | 1.45 M · 2.17 M · 0.84 M | same |
| `/panel/gallery.js` | — | 0.08 M, 13,344 B returned | same; 84 views probed cold, every one under its cap |

Mid-build the panel stood at 12,317 B, over the ceiling. These cuts brought
it under, and the hero's redesign then spent most of what they freed:
- a shared ring helper;
- `light()` reading CSS numbers instead of converting HSL to RGB;
- ether-only selling;
- one `Published` walk shared by the listings and the sales;
- deduplicated strings;
- a CSP without `font-src` and `media-src` (the default refuses both).

The suites, each run on this tree with the final panel:

- `node tools/verify-site.mjs` (all groups): 646 passed, 0 failed.
  - 604 at 2f17d92; the gallery group adds 42, and the ≥ 150 gate read 645.
  - The run before the QR re-pin read 645 passed, 1 failed (§2).
  - The gallery group alone printed 48 passed, 0 failed: 42 sentences in
    47.9 s, plus the build's 6.
- `node tools/verify-console.mjs` (all groups): 179 passed, 0 failed.
  - 174 at 2f17d92; the gallery group adds 5 Chromium sentences, in 37.7 s
    of that run.
  - The gallery group alone printed 8 passed, 0 failed.
- `node tools/build-app.mjs`: `wrote dist/shards.json, dist/manifest.json,
  dist/app.html, dist/panels/*.js` (seven panels, every one under 12,288 B).
- `node tools/selftest.mjs`: 60 passed, 0 failed.
- `node tools/verify.mjs`: 253 passed, 0 failed (249 at 2f17d92).
- `node tools/gas.mjs`: every measured view is under its cap (84 probed
  cold, a transaction between each; every view ≤ 16.78M, tokenURI ≤ 8.00M,
  /live ≤ 2.50M).
- `node tools/static-audit.mjs`: static audit passed — 10 Solidity rules,
  4 JS rules; this is not a security audit.
- `node tools/verify-recover.mjs`: 186 passed, 0 failed (184 at 2f17d92).
- `node tools/forge.mjs --match Premises`: 17 passed, 0 failed, three of
  them new. The run took 35 m 47 s, including the cold src + test compile.
- `node tools/forge.mjs` (monolith): 643 passed, 0 failed (640 at
  2f17d92), 9 m 10 s.
- `INTACT_IMPL=diamond node tools/forge.mjs`: 643 passed, 0 failed (640 at
  2f17d92).
- `node tools/verify-premises.mjs`: 64 passed, 0 failed (63 in the battery
  on 3d33e4d, docs/v2/INTEGRATION.md). It was run because the Premises
  changed; the brief does not require it.

## 4. Decisions, each with its reason

1. **The Gallery is first on the dock**:
   `ORDER = ["gallery", "swap", "vault", "social", "launch"]`.
   - V2 §2 names the five rooms in that order: Gallery, Trade, Vault,
     Social, Studio.
   - Home is the token itself, an anchor outside `#lanes` (W7). The Gallery
     is every token, its default being this one, so it sits beside Home as
     the first room. Trade, Vault, Social and Studio keep W7's order.
   - Its icon is a framed picture: a frame, a horizon and a sun.
2. **The Engine holds a prefix of up to eight lanes, and refuses a gap.**
   - V2 §4 makes the six-panel constant "an array of up to eight". The
     gap, the manifest and the router all walk the slots in order and stop
     at the first empty one.
   - A slot loaded past a gap would be counted by nothing, served by
     nothing, and frozen forever, so `freeze` refuses it.
   - Six-lane and seven-lane Engines are both valid, which is what keeps
     V1's records whole. The eighth slot is room for one more lane; it
     needs a Catalog with a ninth lane word, because the Catalog names
     lanes and the Engine only holds them.
3. **Lane names live in the Catalog's code, not in the Engine.** A frozen
   Engine holds bytes and hashes; the name of slot *i* is
   `laneWord(i + 2)`, the same list the router has always used through
   `verbWord`. One list feeds the state gap, the manifest and the router,
   so the three cannot disagree.
4. **An INTACT token is drawn from face 1.** Face 0 is the live console,
   this page. Running it in a frame would boot a second console with its
   own wallet surface inside the first. Face 1 is the crest, the art.
5. **A token's own page runs in `sandbox="allow-scripts"` and under a CSP
   of its own.**
   - A srcdoc frame inherits the console's CSP, which allows
     `connect-src 'self'`. So the lane prepends `<meta
     http-equiv="Content-Security-Policy" content="default-src 'none';
     script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src
     data:">` to the token's HTML.
   - The page may run its script and draw, and may ask nothing of any host.
   - Measured in Chromium: the frame's origin is `"null"`, `parent` is out
     of reach, and `fetch('/services.json')` is refused with no request
     sent.
   - Without `allow-same-origin` the frame cannot reach the wallet, the
     shell or the storage.
6. **Off chain is a link, never a request.** The brief's rule governs, not
   V2 §3.3's "a gateway the viewer types once": a gateway would be a host
   the console contacts on the person's behalf.
   - Only `https`, `ipfs` and `ar` become links. A `javascript:` or any
     other URI is printed as text in a row and is neither drawn nor linked.
   - `link()` sets `rel="noopener noreferrer"`, which already sends no
     referrer.
7. **The order is rebuilt from `OrderValidated` near its publication.**
   - In the flow with no signature, the seller's `validate` lands in a
     transaction before `publish`. Seaport emits `OrderValidated` once,
     and the Bazaar's own validate of an already-valid order emits nothing.
   - So the lane looks in the `Published` receipt first, which is where a
     signed order published in one call lands, and then walks the 256
     blocks before it.
   - The walk is bounded. An order validated further back reads "its order
     could not be rebuilt: no OrderValidated near its publication", never
     a wrong order.
   - The rebuilt order is then held to Seaport's own `getOrderHash` at the
     seller's live counter. A row that says live is an order Seaport would
     fill.
8. **Selling is in ether only; buying takes any one currency.**
   - The panel ceiling forced the cut: an ERC-20 sale form was the largest
     piece left after the others.
   - Ether is the Market's own currency, and a listing priced in a token
     can still be bought here, after an exact approval.
9. **The approval is a single exact `approve(Seaport, id)`.**
   - `setApprovalForAll` is used only where no single approve can serve:
     ERC-1155, and an ERC-721 id of 2^255 or more. The shell refuses an
     approval word that large (CLAUDE.md: no approval of 2^255 or more).
   - Approvals are not in the fingerprint, so the approve step does not
     move the pin.
10. **The pin is computed at validate, after the seals.** The fingerprint
    includes the Reach's seal and the market's hash. A pin taken before
    sealing would be stale the moment the seal landed, and the zone would
    refuse every fill. The steps are read from the chain on every paint,
    so a step done elsewhere (a seal from the Vault lane) reads done here.
11. **Standard interfaces are called by selectors computed in the page.**
    - The Catalog serves rows for the hub, the Reach, the pool, the
      Journal, the Bazaar, the Market, the Studio, a collection, Bridges
      and ERC-20. Those are declared with `ui.rows`, and the hub's
      `ownerOf` and `approve` rows serve any ERC-721 because their
      selectors are the standard's.
    - ERC-721's `tokenURI`, `getApproved` and `isApprovedForAll`,
      ERC-1155's `uri` and `balanceOf`, ERC-2981's `royaltyInfo`,
      ERC-165's `supportsInterface`, and Seaport 1.6's `getCounter`,
      `getOrderHash`, `getOrderStatus`, `validate`, `fulfillOrder` and
      `cancel` have no Catalog row. Their selectors are computed with the
      shell's own keccak (`ui.khex(signature)`).
    - The writes are proposed with `data` and `sig`, and the shell holds
      the selector to the signature (request 6).
12. **The art comes first; the form waits.** The form is a closed
    disclosure above the hero, so the first screen is the art, its name
    and its price. On a phone the frame fills the width. On a desktop it
    is held to 46vh, so the name and the price show with it above the
    fold.
13. **The ambient light is rebuilt from numbers, never from the art's
    text.**
    - `light()` reads the colour values the SVG paints with and rebuilds
      each as `rgb(…)` or `hsl(…)` from the numbers it parsed.
    - Only a colour with a chroma above 24 counts. Without one, the frame
      takes the crest's hues (`--h`, `--h2`), and `data-ambient` reads
      `crest`.
14. **The SVG namespace is read from the shell's own crest.** The build
    refuses every host string in `dist/` but that literal. The panel needs
    no literal at all: it takes the namespace from
    `document.querySelector("svg").namespaceURI`, and with no SVG on the
    page the constellation is simply not drawn.
15. **`spend: true` goes on buy, Market buy, mint, approve and validate.**
    The first three send ether. Approve and validate let the token leave
    the wallet. The seals, publish and cancel move nothing.
16. **The mint keeps its place.** Its box is drawn hidden while the Studio
    is asked, and removed if the address is not a collection. The mint
    therefore sits above the story and the OpenSea row whichever answer
    comes first.
17. **Include OpenSea stays off** by the brief. Buying and selling here
    settle on the same Seaport, and a listing published here is fillable
    by anyone. V2 §3.3's switch-on path (asking OpenSea's endpoint for
    signed orders) is not built, and this file contains no fetch. Offers in
    WETH (V2 §3.3) are not built either; the brief did not ask for them.

## 5. Elements this lane introduces

These are also in the panel's header comment. Every selector is scoped to
`#lane-gallery`.

- `#gallery-form` — a `<details>` holding `summary`,
  `input[name=collection]`, `input[name=id]`, `#gallery-open` and
  `#gallery-this`.
- `#gallery-token` — the hero, in the order: the art, its name, its price,
  its facts, its traits, its own page.
- `#gallery-frame[data-ambient]` (two colours, or `crest`), holding
  `#gallery-art`: an `img`, an `a.offchain` link, or a note.
- `#gallery-name`; `#gallery-price` (hidden while no live price stands);
  `#gallery-what`; `#gallery-about`; `#gallery-meta`.
- `#gallery-traits .trait[data-trait]`.
- `#gallery-sitebox`, holding `#gallery-site`:
  `iframe[sandbox=allow-scripts][srcdoc]`.
- `#gallery-buy`, holding:
  - `#gallery-market` and `#gallery-market-offer`;
  - `#gallery-listings .listing[data-hash] .state`, where `.state` is one
    of live, not validated, cancelled, filled, void, not open, expired,
    seller moved it, refused or unpriced.
- `#gallery-sell`, holding:
  - `input[name=price]` and `input[name=days]`;
  - `#gallery-review`;
  - `#gallery-steps .step[data-step=seal|market|approve|validate|publish][data-done]`.
- `#gallery-mint`, holding `#gallery-spec` and `#gallery-via`.
- `#gallery-story`, holding:
  - `#gallery-owners .owner`;
  - `#gallery-memories .memory[data-kind]` and `#gallery-archive`;
  - `#gallery-constellation svg[role=img]`, with a halo and a
    `circle.star[data-kind]` per memory;
  - `#gallery-sales .sale`.
- `#gallery-opensea` (the switch) and `#gallery-door`.
- `[data-act=buy|marketBuy|cancel|sealReach|sealMarket|approve|validate|publish|mint]`.

## 6. Proposed INVARIANTS rows (pending, W8)

Every sentence below is quoted exactly as its file prints it. Each row
stays pending until the battery runs it and a one-character mutation is
seen to fail it.

**F · the site** (after W7's F9–F15)

| # | Invariant | Enforced by |
|---|---|---|
| F16 | The Engine holds up to eight lanes as a loaded prefix: `freeze` needs one and refuses a gap; `panelCount()` is the prefix and `shardHashes()` lists it | `test/Premises.t.sol` · `test_theEngineHoldsEightLanesAndFreezesOnlyAPrefixWithoutAGap` |
| F17 | The state gap's panel map, the manifest's panel route and `/panel/<name>.js` name exactly the lanes the Engine holds, in slot order, the Gallery seventh; an Engine of six serves no gallery | `test/Premises.t.sol` · `test_theGalleryIsTheSeventhLaneAndIsServedLikeTheRest`, `test_anEngineOfSixLanesIsNamedSixAndServesNoGallery`; `tools/verify.mjs` · *"the state's panel map names exactly the lanes the Engine holds, in slot order (the Gallery seventh)"*, *"the panel route hashes the ${PANELS.length} lanes' pins together, in slot order"* (prints "the 7 lanes'") |
| F18 | A record of V1's six lanes and a record of seven both recover | `tools/verify-recover.mjs` · *"seven panel pointers follow: V1's six lanes, then the Gallery"*, *"a band whose Engine holds V1's six lanes deploys and freezes, and its record lists six"*, *"and that six-lane record recovers with 0 disagreeing"* |

**Y · the Gallery lane** (a new letter)

`tools/verify-site/gallery.mjs` is cited as *vs*. The Chromium sentences
are in `tools/verify-console.mjs --group gallery`, cited as *vc*.

| # | Invariant | Enforced by |
|---|---|---|
| Y1 | Any NFT is drawn from the chain alone: data: JSON and SVG decoded in place, the frame lit by the art's own colours, attributes as chips, the art first and the price under its name | *vs* · *"an on-chain SVG token is drawn from its own data: URI: the image is face 1's, decoded in place, and its name is the metadata's"*, *"its frame is lit by the colours its own fills and strokes paint with, sampled from the SVG"*, *"its attributes are chips, one per trait, each as the metadata spells it"*, *"an INTACT token says its own site is this console and runs no copy of it; its holder is ownerOf's"*, *"the art comes first, then its name, its price while one stands, and its facts; the form to open another NFT waits closed above them"* |
| Y2 | Off chain is a link a person may open and never a request; a hostile string is text; nothing is assigned through `innerHTML` and nothing is fetched but the panels | *vs* · *"a foreign ERC-721 whose metadata lives off chain is shown as a link a person may open, and the page fetches nothing"*, *"on-chain JSON whose image lives off chain: the JSON is decoded in place and the image is a link, never loaded"*, *"a hostile name is text and a javascript: image is neither drawn nor linked"*, *"nothing was assigned through innerHTML, nothing was fetched but the panels, and no page threw, in any gallery page of the run"* |
| Y3 | A token's own HTML runs in a sandbox of `allow-scripts` alone, its origin opaque, its parent out of reach, under a CSP of its own that refuses every request | *vs* · *"a token's data:text/html page runs in an iframe sandboxed to allow-scripts alone, its srcdoc carrying a CSP that refuses every network request"*; *vc* · *"in Chromium a token's own page runs in an iframe whose sandbox is allow-scripts and nothing else: its script runs, its origin is opaque, its parent is out of its reach"*, *"and its own fetch is refused by the CSP the lane wrote into its srcdoc: no request leaves the frame"* |
| Y4 | Its story comes from logs: the owners from `Transfer` (a refused range said, never none), the memories folded and held to `rootOf` and `countOf` (a disagreement named), the sealed one never opened, the constellation still | *vs* · *"the owners are walked from Transfer logs filtered by the id: minted to its first holder, then each move, in order"*, *"a range the endpoint refuses is said in words, for the owners and the memories alike, and never read as none"*, *"the archive replays: the Inscribed logs, folded in order in the page, give the Journal's rootOf and countOf"*, *"the constellation draws one star per memory, the sealed one dim, the archive's line between them, and nothing in it loops"*, *"plain memories are printed as text and a sealed one as a sealed memory, never opened"*, *"a rootOf that disagrees with the logs is named: the archive does not replay, and why"* |
| Y5 | A sale is published with no signature, in steps read from the chain. An INTACT order is zoned to the Bazaar under `pinHash(id, the live fingerprint, no floors)`, its Reach sealed to the order's end. Seaport gets one exact approve; validate comes from the wallet, then publish | *vs* · *"the sale is laid out as steps read from the chain: the Reach to seal, the market already closed, then approve, validate and publish, nothing yet sent"*, *"the Reach is sealed to the listing's end, on the chain's clock, in a slab that says a seal only lengthens"*, *"Seaport is approved for this one token, exactly, never as an operator over all"*, *"validate carries the order zoned to the Bazaar under pinHash(id, the live fingerprint, no floors), from the wallet, with no signature, every argument in words"*, *"publish goes to the Bazaar with the same order and no floors"*, *"an INTACT listing is validated and published from the lane with no signature: Seaport holds it validated, the Bazaar indexed it, and its seller is offered cancel, not buy"*, *"a plain NFT's sale has no seal to make: approve, validate and publish an open order with no zone"*; *vc* · *"in Chromium the holder lists #1 from the Gallery by a person's path — review, seal the Reach, let Seaport move it, validate, publish — four transactions and no typed-data signature, and the Bazaar indexes it"* |
| Y6 | A listing is found from logs, rebuilt from `OrderValidated` and held to `bazaar.check`; buy fills it at exactly the price, the royalty paid, and the sale enters its story; the Market's own listing is bought the same way | *vs* · *"a second account finds the listing from the Bazaar's logs, its order rebuilt from Seaport's OrderValidated near its publication and still good by bazaar.check, its price under the art"*, *"buy is Seaport.fulfillOrder(order, 0) with exactly the price as value"*, *"a second account buys the INTACT listing at exactly the price: the token is the buyer's, the seller is paid the price less the royalty, the royalty receiver its 5 %"*, *"the sale enters its story from Seaport's OrderFulfilled, and the listing reads filled"*, *"a plain NFT listing is published from the lane and bought by a second account at exactly the price"*, *"and its sale is found by the offerers that published it, though the contract emits no Transfer"*, *"the Market's listing is printed as listingOf holds it, its price under the art"*, *"the Market's buy sends exactly the listed price"*, *"the INTACT Market's own listing is shown with its buy, and a second account buys it at the exact price"*; *vc* · *"in Chromium a second account finds the Gallery listing from the chain's logs, its price under the art, and buys it with one click and one signature at exactly the price: the INTACT token is the buyer's"* |
| Y7 | A zone's refusal is printed in words and offers no buy | *vs* · *"a moved fingerprint is refused in words: bazaar.check names FingerprintMoved, the lane says the token changed since it was listed, and offers no buy"*; *vc* · *"in Chromium a listing whose token moved since it was listed reads refused by the zone, in words a person can see, and offers no buy"* |
| Y8 | A Studio mint shows the spec before the signature, pays the price exactly with the link's via, and opens the token the `Transfer` log names | *vs* · *"a Studio collection's spec is read from the chain and shown before anything is signed, with the via the link carries"*, *"the mint's slab sends exactly the price, mints to the connected wallet, and names the link's via"*, *"after the mint lands the lane opens the token the Transfer log names, the wallet's"* |
| Y9 | Include OpenSea prints the door and stays off and disabled, with the sentence of why; nothing is fetched | *vs* · *"include OpenSea reads the door the Timelock wrote and prints it beside a switch that is off and disabled, with the sentence of why, and nothing is fetched"* |
| Y10 | Where V2 is absent, each section is the §6.3 chip and no read goes to a codeless address; the viewer draws the lane and signs nothing | *vs* · *"where a V2 contract is not deployed its section is the chip by CONSOLE §6.3, never a zero, and no read is sent to its codeless address"*, *"the viewer draws the gallery and its story from the chain, prompts nothing and renders no control that signs"* |

## 7. Screenshots

The screenshots are in `docs/v2/shots/`, `gallery-phone-*.png` at 390×844
and `gallery-desktop-*.png` at 1440×900. They were taken with Playwright's
Chromium against the final build, served the way
`tools/verify-console.mjs` serves it: its `fresh({ v2: true,
deployMarket: true })`, `deploySite` from `dist/`, the in-process gateway on
127.0.0.1, and the shim's wallet over EIP-6963.

The cast:
- the Timelock wrote a 5 % royalty and the OpenSea door;
- #1 carries seven memories, two of them sealed, and is listed on Seaport
  for 0.25 ETH through the Bazaar;
- #3 changed hands twice, was listed, and then changed its name, so the
  zone refuses it;
- #1's holder launched Lantern, a Studio collection whose tokens are each a
  small site, and minted one.

- `*-art.png`: the hero. The crest in its ring, its name, the price under
  it, the facts.
- `*-buy.png`: the Market's row and the live Seaport listing with its buy.
- `*-refused.png`: #3's listing, refused by the zone in words, with no buy.
- `*-slab.png`: the buy's slab. "buys INTACT #1 for 0.25 ETH on Seaport:
  the seller is paid and the token is yours in the same transaction".
- `*-story.png`: the owners, the archive replaying, the constellation and
  the memories.
- `*-sell.png`: #2's sale reviewed. The listing, the Reach to seal, the
  market already closed, and the steps after.
- `*-site.png`: Lantern #1's own page running in its sandboxed frame.
- `*-mint.png`: Lantern opened with no id. The spec before the signature,
  and the mint.

The headless Chromium renders the soul through SwiftShader, so the sky is
W7's still frame.

## 8. Requests for files this unit does not own

1. **`src/interfaces/Site.sol`** (frozen; record the change in
   `docs/INTERFACE-CHANGES.md`): change `IEngine.panelCount()` from `pure`
   to `view`, and its comment from `// 6` to "the loaded prefix: six in V1,
   seven with the Gallery, at most `PANELS` (8)".
   - The selector is unchanged.
   - Every caller already uses `staticcall`, and the Engine implements it
     as `view` and does not inherit `IEngine`, so nothing breaks today. The
     declaration is simply wrong.
   - Optional and additive: `function PANELS() external view returns
     (uint256);`.
2. **`docs/CONSOLE.md`**
   - §6.2: the gallery's elements (§5 above).
   - §18: the dock is Gallery, Trade, Vault, Social, Studio, with Home the
     token (decision 1).
   - §19: `panels` names the Engine's loaded prefix: seven keys on a V2
     band, six on a V1 one.
   - §5: a panel may compute a standard interface's selector with
     `ui.khex(signature)` and propose by `data` and `sig` (decision 11).
   - §16 and the panels table (line 833): gallery 12,209 B of 12,288.
   - Lines 3 and 8: "the six panels".
3. **`docs/INVARIANTS.md`**: the rows of §6, pending until the battery runs
   them under a mutation.
4. **`DESIGN.md`**
   - §5.1 (line 302) and the deploy order (line 534): "six panels" becomes
     seven, up to eight.
   - §12 and §14: the rows.
   - `docs/DEPLOYMENT.md` line 449: the same.
5. **`docs/V2.md` §3.3**: say what the lane does now.
   - Off chain is a link, not a typed gateway (decision 6).
   - Selling publishes with no signature (validate from the wallet).
   - Include OpenSea stays off.
   - WETH offers are not built.
   - §4's "array of up to eight" is done.
6. **The Catalog** (W6's files): `seaport.*` rows (`getCounter`,
   `getOrderHash`, `getOrderStatus`, `validate`, `fulfillOrder`, `cancel`)
   and `erc721.*`, `erc1155.*` and `erc2981.*` rows. A lane could then
   declare them with `ui.rows` instead of computing their selectors.
   `CatalogRowsV2` has room; `CatalogRows.SERVICES` does not (CLAUDE.md).
7. **`CLAUDE.md`**
   - **The ceilings trap.** The gallery panel is 79 B under its 12,288 B
     ceiling (12,209 B); any fix to it pays in cuts first.
   - **New trap: Playwright inside a sandboxed frame.** Its
     `serviceWorkers: "block"` init script reads `navigator.serviceWorker`
     in every frame. A frame sandboxed without `allow-same-origin` throws a
     SecurityError there. That error is the harness's, so filter it by its
     text, as the gallery group does, and nothing else.
   - **New trap: never `pkill -f` a tool's name.** Four units share the
     machine, and the pattern matches their runs too; stop your own by PID.
     W8 stopped W10's `verify-site` run that way on 2026-10-19.
8. **`deployments/README.md`**: a V1 record lists six lanes and a V2 record
   seven. Recovery and the gateway check walk the record's own lanes, so
   the schema stays 3.
9. **`engine/app.html`** (W7's, outside the three entries this unit may
   touch): the comment above `ROOMS` walks the dock as "Home …, Trade,
   Vault, Social, Studio". It should read "Home …, Gallery, Trade, Vault,
   Social, Studio".
10. **The integrator.** `tools/verify-site/boot.mjs`'s QR pin depends on
   the deployer's nonce at the Premises (§2). Any unit that adds a deployer
   transaction before the Premises in `tools/site.mjs` moves it again.
   Re-pin once after the merge, from the value the run prints; the jsqr
   sentence beside it proves the new map.
