# Interface changes after wave 0

BUILD-PLAN.md's cross-wave contract: the interfaces under `src/interfaces/`
were frozen at the end of wave 0, and a change to any of them needs a note
here and a rerun of every wave-1 suite. This file is that note. Every entry
below is **additive** — a new function, a new error — and never changes an
existing signature, so a contract compiled against the wave-0 text still
links against the integrated one. The rerun is recorded in the commit that
made each change.

## Wave-1 integration (this commit)

| File | Change | Why | Where it came from |
|---|---|---|---|
| `IIntact.sol` | `function setScriptURI(string[] calldata) external;` | The hub claims ERC-5169 (`supportsInterface(type(IERC5169).interfaceId)`), and that id is `scriptURI ^ setScriptURI`. Without the setter the claim named a function the token did not serve. `SiteLogic.setScriptURI` always reverts `NotTimelock`: the script is the Premises, pinned at construction, and nobody — the curator included — can point the clients elsewhere. SiteFacet grew 92 B (8,789 → 8,881, under 10,000). | U1's report: "add `setScriptURI(string[])` that reverts so the interface id is honest, if SiteFacet budget allows" |
| `ILaunchpad.sol` | `function recordLaunch(uint256 id, address by, address coin, uint256 raiseShare) external;` (KILN only) | The Kiln↔Launchpad seam: the Kiln makes the coin and the Launchpad keeps the per-token clock, the first-launch rule and the launch root. U6 declared it as a local `ILaunchClock` in `src/Kiln.sol`; it is one interface now, so a reader of ILaunchpad sees the whole surface. | U6's report |
| `ILaunchpad.sol` | `error NotKiln(); error NotEnoughCredit(uint256 have, uint256 want); error Insolvent();` | Were `Launchpad`'s own; moved so the Catalog's error table (U7) sees them. | U6's report |
| `IKiln.sol` | `error BadDecimals();` | Was `Kiln`'s own (`decimals > 36`). | U6's report |
| `IParley.sol` | `error PostageDue(uint256 to, uint128 postage); error BadReply();` | Were `Parley`'s own; moved for the Catalog. Parley also reverts `IPostageEvents.InboxClosed`, which was already in an interface. | U4's report |

Tests that named a moved error through the contract type
(`Kiln.BadDecimals.selector`) now name it through the interface
(`IKilnEvents.BadDecimals.selector`): Solidity does not expose inherited
errors through a derived contract's type.

Behaviour decided in the same pass, outside the interfaces:

- **`Timelock.execute` is open to anyone** (DESIGN.md §3 row 27 wins over
  the donor's `onlyAdmin`). An operation was announced a week before it
  could land; who presses changes nothing about what lands, and an admin
  who must also press is a liveness dependency. `queue` and `cancel` stay
  the admin's. One word changed; Timelock measures 1,617 B (1,634 before).
- **`Reach.sealMax()` is idempotent at the cap.** The hub's `panic` calls
  it unconditionally before `revokeAllSessions()`, so a second panic in the
  same block must not meet `RatchetOnly`. U2 had already written it that
  way; `test/Reach.t.sol` · `test_aSecondPanicDoesNotRevertOnTheSeal` and
  `test/Bundle.t.sol` · `test_panicRevokesAcrossEverySatellite` now pin it
  against the real hub.

## Known warts, accepted for the MVB (not interface changes)

- **`ISteward.summon(id, heir, salt)` has no `tokenN` parameter.** An
  instrument heir ("whoever holds token N") is summoned with
  `heir = address(uint160(tokenN))` and the Steward tries both preimage
  shapes (`keccak(heir, salt)` and `keccak(address(0), tokenN, salt)`).
  v2 may add `summonToken(id, tokenN, salt)`.
- **`ISteward` has no `revoke()`.** A holder erases a plan only by
  re-arranging it. v2.
- **`IParley.heads(uint256[])` returns the head BLOCK per room**, not a
  count. A count is `stateOf(room)`'s second word. The page (U9) must read
  the right one.
- **`IPostage` has no payer parameter.** The payer of record is
  `HUB.account(from)` — the sender token's Reach — so a wallet-pays model
  is unsupported in v1.
- **`IRoles` has no any-role view.** The hub's `R_ROLE` bit is computed from
  `hasRole(id, USER, actor)` only. U16 (Roles) adds the view it needs; the
  hub's read is widened then, additively.
- **`ILaunchpad.Launch` lacks `graduationTarget`**; it is the public mapping
  `Launchpad.graduationTargetOf(launchId)`.
- **Home rooms open on the steward's first word.** `Parley.join(homeKey(id),
  …)` reverts `NoSuchRoom` until the token has spoken at home once; the page
  renders "this token has not spoken yet".

## U7 — Site.sol extensions (additive)

| Interface | Added | Why |
|---|---|---|
| `IEngine` | `shardHashes() → bytes32[]` | `/manifest` lists every stored shard's keccak (head, body, panels) for the deployment record and `tools/recover-record.mjs`. |
| `IRenderer` | `AGENTCARD() → address` | Face 2 is `AgentCard.registration(id)` once the card has code and face 1 until then (DESIGN §4.6); the renderer needs the pinned address. Codeless until U17. |
| `ICatalog` | `routes() → bytes` | `contractURI()` carries the route table (DESIGN §4.6); the Catalog owns it. |
| `IPremises` | `CREST() → address` | `/token/<id>/crest.svg` is drawn by the Crest the renderer pins; the router reads it rather than asking the renderer per request. |
| `TokenState` | `uint32 absent` appended after `reported` | DESIGN §5.5 wants a clear bit printed as "not deployed on this chain" when `extcodesize` was zero and "could not be read at block N" when the call reverted; one word per satellite cannot say which. `absent` carries the same bits, set where there was no code. The state block gains `"absent":<n>` beside `"reported"`. Appended, so the struct's prefix is unchanged. |

Nothing in `IIntact`, `IReach`, `IPool`, `IParley`, `ILaunchpad`, `ISteward`,
`IPostage` or `ILocks` changed.

## U7 — shapes beyond the interfaces (for U9, U10, U17)

- `Catalog` is three contracts and a façade: `CatalogRows(address[16] byLetter)`
  renders the service table at construction; `CatalogText(CatalogRows)` the
  error and event tables; `CatalogState(CatalogText)` the templates;
  `Catalog(CatalogConfig)` pins all of them and every world address. Deploy
  order: Rows → Text → State → Catalog → Renderer → Premises → hub (the hub
  predicted). `Catalog.agrees()` reports whether the hub pinned what the
  Catalog was told; `tools/deploy.mjs` must refuse to publish on `false`.
- `Catalog.state(id)` is valid JSON (every key quoted); `Renderer.document`
  writes it as `<script>window.INTACT={…}</script>` BEFORE the loader (no
  splice; the Window keeps the property across `document.open()`).
- `Engine.loadPanel(i, gzip, keccakOfInflated)`; `/panel/<name>.js` is served
  gzip with `Content-Encoding: gzip` and `ETag: "<keccak of the inflated bytes>"`.
- Panel order is `swap, social, launch, vault, identity, agent` = `verbWord(2..7)`;
  `verbWord(1)` is `home`.
- `tools/build-app.mjs` reads `engine/app.html` and `engine/panels/<name>.js`
  when present and falls back to `tools/fixtures/` placeholders, marking
  `dist/shards.json` `placeholder: true`.

## How to add to this file

One row per signature, additive only, with the unit report or issue it
answers. A change that is not additive is a new interface version and a
new file (`INTERFACE-CHANGES-v2.md`), never an edit to a frozen signature.
