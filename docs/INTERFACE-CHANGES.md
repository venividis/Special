# Interface changes after wave 0

The cross-wave contract (BUILD-PLAN.md): the wave-0 interfaces are frozen;
a change is logged here with the unit, the reason and what reran.
`src/interfaces/Site.sol` is not in the frozen set and may be extended
(never renamed) by U7 with a note here.

## U7 — Site.sol extensions (additive)

| Interface | Added | Why |
|---|---|---|
| `IEngine` | `shardHashes() → bytes32[]` | `/manifest` lists every stored shard's keccak (head, body, panels) for the deployment record and `tools/recover-record.mjs`. |
| `IRenderer` | `AGENTCARD() → address` | Face 2 is `AgentCard.registration(id)` once the card has code and face 1 until then (DESIGN §4.6); the renderer needs the pinned address. Codeless until U17. |
| `ICatalog` | `routes() → bytes` | `contractURI()` carries the route table (DESIGN §4.6); the Catalog owns it. |
| `IPremises` | `CREST() → address` | `/token/<id>/crest.svg` is drawn by the Crest the renderer pins; the router reads it rather than asking the renderer per request. |

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
