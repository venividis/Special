<!-- Reader report from the U9 understand phase (2026-10-08): what the donors contain, measured against their git refs, and what INTACT keeps or drops. Working document; docs/CONSOLE.md and docs/u9/DECISIONS.md record what was decided from it. -->

# U9 reader report E — INTACT's own harness and the exact state block

Surface read: `tools/evm.mjs`, `tools/site.mjs`, `tools/verify.mjs`, `tools/gas.mjs`,
`tools/build-app.mjs`, `tools/static-audit.mjs`, `tools/compile.mjs`, `src/Catalog.sol`
(`Templated`, `CatalogState`, `Catalog`), `src/Renderer.sol`, `src/Premises.sol`,
`src/interfaces/Site.sol`, the U7 commit `6ed1539`, `BUILD-PLAN.md` §U9, `DESIGN.md`
§1, §2, §5, `docs/INTERFACE-CHANGES.md`. Nothing under `/home/user/Special` was written
except `dist/` (gitignored), by running the project's own `node tools/build-app.mjs`,
`node tools/verify.mjs` (217 passed, 0 failed) and `node tools/gas.mjs --json` (0 over).
Two probes were run from the scratchpad against the harness (not committed anywhere):
`probe-state.mjs` (populated token, collection block, gas vs. shell size),
`probe-call-commits.mjs` (whether `Chain.call` persists state), `probe-hash.mjs` and
`probe-warm.mjs` (`/hash` and `/` against shell size; cold vs. warm calls) and
`terser-probe.mjs` (toplevel mangling across script blocks). Every number below is
from those runs on this machine today, not from the docs.

Line numbers refer to the files as they are on `main` (`7bbb62b`).

---

## 1. The complete `window.INTACT` schema

### 1.1 How the block is produced, and the two places it is byte-identical

`Catalog.state(id)` (`src/Catalog.sol:1364-1371`):

```solidity
function state(uint256 id) external view returns (bytes memory) {
    IIntact hub = IIntact(HUB);
    World memory w = _world(id);
    bytes memory middle = id != 0
        ? STATE.token(w, stateOf(id), hub.coreOf(id), hub.price(), hub.feeSink(id), hub.getTraitValue(id, Traits.NAME))
        : STATE.collection(w, hub.price(), hub.minted());
    return abi.encodePacked("{", STATE.world(w), middle, STATE.tail(ENGINE, CATALOG_HASH));
}
```

So every block is `{` + **world** + (**token** | **collection**) + **tail**, in that key order.
`Renderer.document(id)` (`src/Renderer.sol:113-120`) writes it as

```
<prologue …</head><body>><script>window.INTACT={…}</script><script>self.$INTACT="<base64 gzip body>";</script><INFLATE loader>
```

The same bytes are served raw at `/token/<id>/state.json` (`Premises.sol:265`) and their
keccak is `/token/<id>/hash`.`state` (`Premises.sol:277`). `verify.mjs` holds the three equal
(`stateOfHtml` at `verify.mjs:43-46`: `html.match(/<script>window\.INTACT=([\s\S]*?)<\/script>/)`).
The `/` page is `document(0)`, whose block has `id: 0` and the collection keys.

**Template markers** (`Catalog.sol:149-186`, `Templated._fill`): `\x01` = an address, written
as `0x` + 40 lowercase hex; `\x02` = a word as a decimal number; `\x03` = `true`/`false`;
`\x04` = a pre-rendered byte string (a sub-object, `null`, a hex hash, or a `Web.jsonEsc`'d
string). Whether a `\x02` is a JSON number or a JSON string depends on whether the template
wraps it in quotes — see the type column in the tables below. **Every uint256/uint128/uint112
amount is a quoted decimal string; every uint64/uint32/uint16/uint8 is a bare number.**
The block is valid JSON and a valid JS object literal at once; the shell may `JSON.parse`
`/state.json` and get exactly `window.INTACT`.

**Escaping** (`src/lib/Web.sol:72-87`, `jsonEsc`): `"`→`\"`, `\`→`\\`, `<`→`<`,
`>`→`>`, `&`→`&`; every other byte outside printable ASCII `0x20..0x7E` is
*dropped*. Applied to `name`, `market.baseSymbol`, `market.quoteSymbol` (via
`Web.symbolOfJson`), venue names. So strings in the block are printable ASCII only and can
never close the `</script>` (verify.mjs "a coin named `</script>` cannot end the state block").
A symbol that could not be read is the literal `"?"`; a native side is `"ETH"`.

### 1.2 World keys — present on every page (`CatalogState.TPL_WORLD`, `Catalog.sol:860-868`)

| key | JSON type | meaning | source |
|---|---|---|---|
| `id` | number | token id, `0` on the collection page | `w.id` |
| `chainId` | number | `block.chainid` at render — **this is what `eth_chainId` is compared against** | `block.chainid` |
| `band`, `bandLo`, `bandHi` | number | the edition band this deployment holds (harness: 1, 1, 3072) | Catalog immutables |
| `hub` | string (address) | the Intact hub (diamond) | `w.hub` |
| `reachImpl`, `gripImpl` | address | the two ERC-6551 implementations (for CREATE2 re-derivation and codehash checks) | hub immutables via Catalog |
| `pool`, `parley`, `launchpad`, `locks`, `steward`, `market`, `roles`, `timelock`, `premises`, `renderer` | address | the hub's pinned satellites, in `H.*` order; `market`/`roles` are codeless placeholders until U15/U16 (`0x…a2ce70`, `0x…a01e50` in the harness) | `w.h[...]` |
| `router` | address | the Router, **zero on a band with no Router** (harness default) | Catalog immutable |
| `roster`, `postage`, `keys`, `kiln`, `catalog`, `engine` | address | satellites the Catalog pins itself | Catalog immutables |
| `agentCard` | address | codeless until U17 (`0x…0a6e7ca0` placeholder) | Catalog immutable |
| `rights` | object | **constant bit-name map**, not the viewer's rights: `{"HOLD":1,"ACCOUNT":2,"USE":4,"CUSTODY":8,"ROLE":16,"DELEGATE":32,"GUARDIAN":64,"SESSION":128}` | literal in the template |
| `bits` | object | **constant** map of `reported`/`absent` bit → satellite name: `{"reach":1,"pool":2,"parley":4,"postage":8,"locks":16,"launchpad":32,"steward":64,"router":128,"market":256,"roles":512,"keys":1024,"agentcard":4096}` — no `2048` key (reserved for Nameplate; nothing asks it, so a bit would always read "asked and got nothing") | literal |

Addresses are lowercase, not checksummed. The viewer's own rights never appear in the
block: they come from one live `rightsOf(id, account)` → `(uint16 bits, uint64 epoch,
address holder)`. Measured on the probe (token 1, after `setUser` and `setGuardian`):
holder → `bits 1`, the Reach → `2`, the renter → `4`, the guardian → `64`, a stranger →
`0`; `epoch 1`, `holder` = the owner in every case.

### 1.3 Token keys — `id != 0` only (`TPL_TOKEN`, `Catalog.sol:870-877`; filled by `CatalogState.token`, lines 930-951)

| key | JSON type | meaning | nullability |
|---|---|---|---|
| `price` | **string** (wei) | `hub.price()`, the mint price | never null |
| `owner` | address | `ownerOf(id)` | never null (`state(id)` reverts `NoSuchToken` for an unminted id — the one honest revert, `Catalog.sol:1306`) |
| `reach`, `grip` | address | `account(id)`, `grip(id)` (CREATE2-derived; exist from the mint tx) | never null |
| `guardian` | address | `Core.guardian`, zero when none | zero, not null |
| `user` | address | ERC-4907 user (the renter), zero when none | zero |
| `agentWallet`, `proposedWallet` | address | the two-step agent wallet | zero |
| `feeSink` | address | `hub.feeSink(id)`: the Reach, or the Grip when `feesToGrip` | never null |
| `epoch` | number | `custodyEpoch[id]`, starts at 1, +1 on every custody change | never null |
| `status` | number | `0` Active, `1` Paused (`enum Status { Active, Paused }`) | never null |
| `locked` | boolean | `lockCount != 0 \|\| guardianHold` (ERC-5192 `locked()`) | never null |
| `lockCount` | number | module locks held on the token (Steward/Market/Roles) — **not** `Locks.sol` vaults | never null |
| `guardianHold` | boolean | set by a guardian panic until `release(id)` | never null |
| `feesToGrip` | boolean | income routed to the Grip (permanently unspendable) | never null |
| `pinnedFace` | number | ERC-7160 pin (0,1,2), reset on sale | never null |
| `launchCount` | number | `Core.launchCount` | never null |
| `curve` | number | the `curve` trait word as uint (concentration bps ≤ 80,000) | never null |
| `name` | string | the `name` trait, `jsonEsc`'d, `""` when unset | never null |
| `fingerprint` | string (bytes32 hex) | `getStateFingerprint(id)` (ERC-5646) | never null |
| `clocks` | object | `{"sealedUntil","marketSealedUntil","userExpires","transferSealUntil","createdAt"}`, all bare numbers (unix seconds); `sealedUntil` is the Reach seal (0 when the Reach did not answer — **read bit 1 first**), `marketSealedUntil` the Pool seal (0 when bit 2 clear) | object always present; its zeros are only meaningful under the bit |
| `market` | object \| **null** | the owned market, 16 fields (§1.4) | `null` when `Pool.marketOf(id)` gave no answer |
| `inbox` | object \| null | Postage inbox config (§1.4) | `null` when `Postage.inboxOf(id)` gave no answer |
| `home` | object \| null | the home room `keccak256(abi.encodePacked(uint8(3), id))` (§1.4) | `null` when `Parley.stateOf(room)` gave no answer |
| `commons` | object \| null | room 0 | same |
| `key` | object \| null | `{"type":<uint16>,"id":"<bytes32>"}` — `Parley.keyOf(id)`: the holder's bound sealing key, zero unless bound under the current owner **and** epoch | `null` when Parley gave no answer |
| `launches` | array of numbers \| null | `Launchpad.launchesOf(id)` — launch ids | `null` when the Launchpad gave no answer; `[]` is a reported "none" |
| `locks` | number \| null | `Locks.lockCountOf(reach)` — **a count** of `Locks.sol` vaults whose beneficiary is the Reach (not the module-lock count) | `null` when Locks gave no answer; `0` is a reported zero |
| `steward` | number \| null | `Steward.wouldPass(id)` code: `0 NO_PLAN, 1 SOLD, 2 SPEAKING, 3 SUMMONABLE, 4 WAITING, 5 LOCKED, 6 BAD_HANDS, 7 OK` (`ISteward.sol:74-82`) | `null` when the Steward gave no answer |
| `roles` | number \| null | `Roles.liveRoleCount(id)` | `null` until U16 (codeless placeholder) — the harness block shows exactly this |
| `holderKeyId` | string (bytes32) \| null | `KeyRegistry.keyIdOf(owner)` = keccak of the owner's registered public key, zero bytes32 when none | `null` when KeyRegistry gave no answer |
| `reported` | number | bit per satellite that **answered** (§1.5) | never null |
| `absent` | number | the same bits, set where `extcodesize == 0` (§1.5) | never null |

### 1.4 The sub-objects

**`market`** (`TPL_MARKET`, `Catalog.sol:886-889`; built by `_market`, 992-1007 from `IPool.marketOf(id)` and `IPool.spot(id)`) — exactly 16 fields, in this order:

| field | type | from |
|---|---|---|
| `open` | boolean | `Market.open` |
| `sealed` | boolean | `Market.sealedMarket` (graduation liquidity, no LP authority) |
| `base`, `quote` | address | `address(0)` = native ETH on that side |
| `baseSymbol`, `quoteSymbol` | string | `"ETH"` for native, else `Web.symbolOfJson` (`"?"` when unreadable) |
| `baseDecimals`, `quoteDecimals` | number | 18 for native, else `Web.decimalsOf` (18 when it will not say) |
| `rBase`, `rQuote` | **string** | real reserves (uint112) |
| `feeBps` | number | ≤ 500 |
| `curveBps` | number | concentration 0..80,000, anchored |
| `sniperBps`, `sniperUntil` | number | decaying post-open fee and its end time |
| `sealUntil` | number | market seal (ratchet) |
| `spot` | **string** | `Pool.spot(id)`: "One base in quote, scaled by 1e18. Display only." (`Pool.sol:636`); `"0"` when `spot` reverted |

Fresh mint (reported, closed): `{"open":false,"sealed":false,"base":"0x00…00","quote":"0x00…00","baseSymbol":"ETH","quoteSymbol":"ETH","baseDecimals":18,"quoteDecimals":18,"rBase":"0","rQuote":"0","feeBps":0,"curveBps":0,"sniperBps":0,"sniperUntil":0,"sealUntil":0,"spot":"0"}` — this is *closed*, not *not reported* (verify.mjs asserts `rep("pool") && S.market.open === false`).
After `openMarket(1, GOLD, ETH, 30, 5000, 500, 600)` + `deposit(1, 1e21, 1e18)` on the probe: `{"open":true,"sealed":false,"base":"0x5395…a694","quote":"0x00…00","baseSymbol":"GOLD","quoteSymbol":"ETH","baseDecimals":18,"quoteDecimals":18,"rBase":"1000000000000000000000","rQuote":"1000000000000000000","feeBps":30,"curveBps":5000,"sniperBps":500,"sniperUntil":1733000600,"sealUntil":0,"spot":"1000000000000000"}`.

**`inbox`** (`TPL_INBOX`, 891-892; `IPostage.inboxOf(id)`): `{"feeToken":<address>,"postage":"<uint128 string>","replyWindow":<number>,"open":<boolean>}`. Default at mint: `{"feeToken":"0x00…00","postage":"0","replyWindow":0,"open":true}` (verify: "the inbox defaults open and free").

**`home` / `commons`** (`TPL_ROOM`, 894-895; `_room`, 1017-1023 decodes the first six words of `IParley.stateOf(room)`): `{"room":"<uint256 string>","last":<number>,"count":<number>,"members":<number>,"kind":<number>,"open":<boolean>}`.
`last` is the **block of the newest message** — the entry point of the indexer-free walk (`eth_getLogs` for exactly that block with topics `[said, room]`, then follow `prev`); `count` is the message count (INTERFACE-CHANGES warns `heads()` returns blocks, not counts — the block carries both, named). `members` = followers for the home room (`Roster.membersOf`). `kind` is the room kind (home rooms read `3`; the commons `0`). `open` is the door flag. Fresh: `{"room":"79774102969151616828…6387","last":0,"count":0,"members":0,"kind":0,"open":false}` for home (a home room does not exist until its token's first word — INTERFACE-CHANGES: `join` reverts `NoSuchRoom` until then; render "this token has not spoken yet"), and `{"room":"0",…}` for the commons. After one word at home on the probe: `{"room":"7977…6387","last":21000000,"count":1,"members":0,"kind":3,"open":true}`.

**`key`** (`TPL_KEY`, 897): `{"type":<uint16>,"id":"<bytes32 hex>"}`; zero type and zero id until the holder calls `KeyRegistry.setEncryptionKey(keyType, pk)` then `Parley.bindKey(id)`. Probe after binding type 3: `{"type":3,"id":"0x0a74df…2fb3"}` and `holderKeyId` is the same hash (both are `keccak256(publicKey)`). **The social panel re-reads `Parley.keyOf(to)` immediately before every send and passes it as `expectedKeyId`**; the block's copy is for display only.

**`launches`**: `[]` fresh; `[1]` after the probe's `Kiln.launch` + `Launchpad.create`. **`locks`**: `0` fresh; `1` after one `Locks.lock(ETH, 0.1e18, reach, …)`. **`steward`**: `0` fresh; `2` (SPEAKING) after `arrange`. **`roles`**: `null` (placeholder has no code). The shell renders each as: `null` → "not reported" (grey chip, with the `absent` spelling from §1.5); a number/array → the fact, even when zero/empty.

### 1.5 `reported` / `absent` — exact bit semantics

`Catalog.stateOf(id)` (`Catalog.sol:1303-1349`) sets one bit per satellite **actually called**, behind `extcodesize` **and** a raw `staticcall` whose return must be at least `minLen` bytes (`_probe`, 1352-1359):

| bit | name | the probe (`T[i]`, `F[i]`, `G[i]`, `L[i]` words) | `absent` set when |
|---|---|---|---|
| 1 | `reach` | the token's own Reach account: `IReach.sealedUntil()`, ≥ 1 word | `s.reach.code.length == 0` |
| 2 | `pool` | `IPool.marketOf(id)`, ≥ 16 words | `POOL` codeless |
| 4 | `parley` | `IParley.stateOf(keccak256(abi.encodePacked(uint8(3), id)))`, ≥ 17 words | `PARLEY` codeless |
| 8 | `postage` | `IPostage.inboxOf(id)`, ≥ 5 words | |
| 16 | `locks` | `ILocks.lockCountOf(reach)`, ≥ 1 word | |
| 32 | `launchpad` | `ILaunchpad.launchRoot(id)`, ≥ 1 | |
| 64 | `steward` | `ISteward.wouldPass(id)`, ≥ 1 | |
| 128 | `router` | `IRouter.HUB()` (sent one ignored argument), ≥ 1 | `ROUTER == 0x0` → always absent on a band with no Router |
| 256 | `market` | `IMarket.listingOf(id)`, ≥ 7 | placeholder, codeless until U15 |
| 512 | `roles` | `IRoles.liveRoleCount(id)`, ≥ 1 | codeless until U16 |
| 1024 | `keys` | `IKeyRegistry.keyIdOf(owner)`, ≥ 1 | |
| 2048 | — | never set (Nameplate) | never |
| 4096 | `agentcard` | `IAgentCard.manifestHash(id)`, ≥ 1 | codeless until U17 |

Harness today: `reported: 1151` (= 1+2+4+8+16+32+64+1024) and `absent: 4992` (= 128+256+512+4096). Invariant asserted by verify.mjs: `(S.absent & S.reported) === 0`.

**The three-way print rule** (DESIGN §5.5, and what the placeholder shell already does at `tools/fixtures/app-placeholder.html:79-87`):

```js
var on = (S.reported & S.bits[name]) !== 0;
var why = on ? "reported"
        : ((S.absent & S.bits[name]) !== 0 ? "not deployed on this chain"
                                           : "could not be read at block " + S.block);
```

Note that the per-field sub-objects (`market`, `inbox`, …) are produced by *separate* probes in `CatalogState.token` (lines 936-945), not from the bits; they agree in practice (same `_probe` rule), but the shell should treat `null` as the per-field "not reported" and the bit as the per-contract chip, and never print a clear bit or a `null` as `0`. The Renderer's attributes do the same (`Renderer.sol:206-211`, `_clock`: "0" and "not reported" are different facts here too).

Degradations the design names (DESIGN §5.5) in terms of the block: `router == 0x0` / bit 128 clear → hide the *Elsewhere* tab; `roles == null` → no roles row; `agentCard` codeless → the Agent lane is a stub; `nameplate` is never in the block → the ENS row is a live read on band 0 only.

### 1.6 Collection keys — `id == 0` only (`TPL_COLLECTION`, `Catalog.sol:879-880`; `CatalogState.collection`, 955-961)

| key | type | meaning | nullability |
|---|---|---|---|
| `price` | **string** (wei) | mint price | never |
| `minted` | number | `hub.minted()` | never |
| `open` | array of numbers \| null | `Pool.openIds(0, 48)` — the first page of the open-market directory (ids) | `null` if the Pool gave no answer; `[]` reported empty |
| `recent` | array of addresses \| null | `Kiln.recent(0, 12)` — the newest coins | `null` if the Kiln gave no answer |
| `commons` | room object \| null | room 0 (same shape as §1.4) | `null` if Parley gave no answer |

The collection page has **none** of the token keys (`owner`, `reach`, `epoch`, `status`, `clocks`, `market`, …, `reported`, `absent`): a shell that reads `S.epoch` on `/` reads `undefined`. Branch on `S.id === 0`. The real block from the harness (`GET([])` after one mint), 14,694 bytes, up to the tail:

```
{"id":0,"chainId":1,"band":1,"bandLo":1,"bandHi":3072,"hub":"0xf9920b…e878","reachImpl":"0xae51…ff90","gripImpl":"0x73b6…67bf","pool":"0x2947…5dd3","router":"0x0000000000000000000000000000000000000000","parley":"0xc136…1d70","roster":"0x6081…e019","postage":"0x5175…1708","keys":"0x560a…473e","kiln":"0x7806…3aee","launchpad":"0x8327…1f1d","locks":"0x3403…860d","steward":"0x6690…15be","market":"0x0000000000000000000000000000000000a2ce70","roles":"0x0000000000000000000000000000000000a01e50","timelock":"0x27e5…8867","catalog":"0xb79f…783a","premises":"0xcbd1…c7ce","engine":"0x7d73…f390","renderer":"0x709e…2d41","agentCard":"0x000000000000000000000000000000000a6e7ca0","rights":{…},"bits":{…},"price":"10000000000000000","minted":1,"open":[],"recent":[],"commons":{"room":"0","last":0,"count":0,"members":0,"kind":0,"open":false},"sel":{…},"err":{…},"topics":{…},"panels":{…},"engineHash":"0x41c9…dcf1","catalogHash":"0x0485…447b","block":21000000,"time":1733000000}
```

More pages of the directory come from `/open/<from>` → `{"from":<n>,"pageSize":48,"markets":[{"id":<n>,"base":<addr>,"quote":<addr>,"feeBps":<n>,"sealUntil":<n>}…] | null,"next":<n> | null}` (`TPL_OPEN`/`TPL_OPEN_ROW`, 904-908; `next` is `from + 48` only when a full page came back).

### 1.7 Tail keys — every page (`TPL_TAIL`, `Catalog.sol:882-884`; `CatalogState.tail`, 964-977)

| key | type | meaning |
|---|---|---|
| `sel` | object `{"<on>.<name>": "0x<8 hex>"}` | **150** selectors, each `bytes4(keccak256(sig))` computed by the chain that deployed `CatalogRows` (rendered once into SSTORE2 at construction, `Catalog.sol:340-390`). Keys are `on.name` with `on ∈ {hub, pool, reach, parley, roster, postage, keys, kiln, launchpad, coin, locks, steward, router, erc20, engine, catalog}`. The full key → signature table is Appendix A. Two keys may share a selector (`hub.release` and `locks.release` are both `release(uint256)` = `0x37bdc99b`; `catalog.stateOf` = `parley.stateOf` = `stateOf(uint256)` = `0x131a7e24`). |
| `err` | object `{"0x<8 hex>": "<ErrorName>"}` | **211** custom-error selectors → bare names (no argument types). verify.mjs's drift gate proves every error a panel-facing contract declares is here. Seven names appear twice under different selectors because they exist with and without arguments in different contracts: `WrongPrice` (`0xf7760f25`/`0x6871963e`), `NotLocked` (`0x1834e265`/`0xdebb09c3`), `Expired` (`0x203d82d8`/`0x95693653`), `FeeTooHigh` (`0xcd4e6167`/`0x8ea70c07`), `NotYet` (`0x0d3f7776`/`0x1c9cc458`), `NotListed` (`0xd176cea0`/`0x665c1c57`), `AlreadyListed` (`0x7fbcdff9`/`0xa3d582ec`). Decode by taking the first 4 bytes of the revert data and looking them up; the shell cannot decode argument *values* from this table alone (no types) — print the name and the raw hex tail. |
| `topics` | object `{"<camelName>": "0x<64 hex>"}` | **23** event topic0 hashes: `said, founded, entered, keyBound, transfer, minted, custodyEpoch, panicked, statusChanged, marketOpened, swapped, collected, launched, launchCreated, bought, graduated, stamped, settled, sessionGranted, sessionRevoked, locked, arranged, summoned`. `said` = `keccak("Said(uint256,uint256,uint64,uint64,uint64,uint8,uint64,uint64,bytes)")` = `0x30e4…173c`; `transfer` = `0xddf2…b3ef`. |
| `panels` | object | `{"swap","social","launch","vault","identity","agent"}` → `Engine.panelHash(i)` for `i = 0..5` = **keccak256 of the INFLATED panel bytes** (zero bytes32 when a panel is not loaded). This is the number the shell compares before Blob injection; it equals `/manifest`.`panelHashes[name]` and the `ETag` of `/panel/<name>.js`. |
| `engineHash` | string (bytes32) | `Engine.engineHash()` = keccak256 of the inflated shell (`dist/app.html` bytes exactly) |
| `catalogHash` | string (bytes32) | `Catalog.CATALOG_HASH` = keccak256 of `/services.json`'s bytes |
| `block` | number | `block.number` at render |
| `time` | number | `block.timestamp` at render |

The tail's panel hashes are probed with `_probe(engine, panelHash(i), 32)` and `engineHash` likewise — a codeless Engine would yield `0x00…00` strings rather than a revert.

### 1.8 The real token block (fresh mint, `dist/state-1.json`, 16,270 bytes)

Head and middle verbatim; `sel`/`err`/`topics` summarised (Appendix A has `sel` in full):

```
{"id":1,"chainId":1,"band":1,"bandLo":1,"bandHi":3072,"hub":"0xf9920b0ce4a279820403de49385d6e3dc5ece878","reachImpl":"0xae519fc2ba8e6ffe6473195c092bf1bae986ff90","gripImpl":"0x73b647cba2fe75ba05b8e12ef8f8d6327d6367bf","pool":"0x294759d5191f26da53918d207e5106eca7b05dd3","router":"0x0000000000000000000000000000000000000000","parley":"0xc13697cefc2decb83102d857035e4c3be78d1d70","roster":"0x6081dd59d190f5172946e409e053337831c1e019","postage":"0x5175ea00f32ebf1bcfd9f5e9352104a3fbdb1708","keys":"0x560a0c0ca6b0a67895024dae77442c5fd3dc473e","kiln":"0x780675d71ebe3d3ef05fae379063071147dd3aee","launchpad":"0x83271ef28ccb668893f35857761cf62d5be61f1d","locks":"0x34036b251d6db7c5f71f337560410785b627860d","steward":"0x6690e52643c26eccfbbaa4ff0a760d177d5015be","market":"0x0000000000000000000000000000000000a2ce70","roles":"0x0000000000000000000000000000000000a01e50","timelock":"0x27e5ee255a177d1902d7ff48d66f950ed9408867","catalog":"0xb79f3bc89b562349bf7a5b1f40e6fdd027c7783a","premises":"0xcbd195dbae10abe7dec2dd5e7723677cfc3dc7ce","engine":"0x7d73424a8256c0b2ba245e5d5a3de8820e45f390","renderer":"0x709e8cf0fdfed987f57af8ce0103562cf6832d41","agentCard":"0x000000000000000000000000000000000a6e7ca0",
"rights":{"HOLD":1,"ACCOUNT":2,"USE":4,"CUSTODY":8,"ROLE":16,"DELEGATE":32,"GUARDIAN":64,"SESSION":128},
"bits":{"reach":1,"pool":2,"parley":4,"postage":8,"locks":16,"launchpad":32,"steward":64,"router":128,"market":256,"roles":512,"keys":1024,"agentcard":4096},
"price":"10000000000000000","owner":"0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a","reach":"0xebfdaba9de434048b7cea9cd05eea84b4030e99f","grip":"0xded2116fe6d2cff7d276373632b100ca8075fe1c","guardian":"0x0000000000000000000000000000000000000000","user":"0x0000000000000000000000000000000000000000","agentWallet":"0x0000000000000000000000000000000000000000","proposedWallet":"0x0000000000000000000000000000000000000000","feeSink":"0xebfdaba9de434048b7cea9cd05eea84b4030e99f","epoch":1,"status":0,"locked":false,"lockCount":0,"guardianHold":false,"feesToGrip":false,"pinnedFace":0,"launchCount":0,"curve":0,"name":"","fingerprint":"0xed15c6438ebe81df60c6790603a782438ae34ef94b157076d47f570be7fa6ec5",
"clocks":{"sealedUntil":0,"marketSealedUntil":0,"userExpires":0,"transferSealUntil":0,"createdAt":1733000000},
"market":{"open":false,"sealed":false,"base":"0x0000000000000000000000000000000000000000","quote":"0x0000000000000000000000000000000000000000","baseSymbol":"ETH","quoteSymbol":"ETH","baseDecimals":18,"quoteDecimals":18,"rBase":"0","rQuote":"0","feeBps":0,"curveBps":0,"sniperBps":0,"sniperUntil":0,"sealUntil":0,"spot":"0"},
"inbox":{"feeToken":"0x0000000000000000000000000000000000000000","postage":"0","replyWindow":0,"open":true},
"home":{"room":"7977410296915161682800669251648249240163799745806105523839553786784890106387","last":0,"count":0,"members":0,"kind":0,"open":false},
"commons":{"room":"0","last":0,"count":0,"members":0,"kind":0,"open":false},
"key":{"type":0,"id":"0x0000000000000000000000000000000000000000000000000000000000000000"},
"launches":[],"locks":0,"steward":0,"roles":null,"holderKeyId":"0x0000000000000000000000000000000000000000000000000000000000000000","reported":1151,"absent":4992,
"sel":{"hub.mint":"0x6a627842", … 150 entries … ,"catalog.services":"0x7b2b30e3"},
"err":{"0x29b490ad":"NoSuchToken","0x7623fb52":"NotHolder", … 211 entries … },
"topics":{"said":"0x30e4249406fe738b64b07937b50b7ebab3215fe799d3fbd3f8917f3f3b91173c", … 23 entries … },
"panels":{"swap":"0xe401a24d505d352aab15ba41a5092b54b269ff9850994d8abab613f401a524d8","social":"0xd593f3be…8960","launch":"0xbf1dc616…ac7d","vault":"0xa6844726…ca89","identity":"0xcb9968c1…b4bf","agent":"0x6a1379de…2882"},
"engineHash":"0x41c9d5532b90c80b357da459a05aa43f5d997a3ad8326952d7a92fe218c4dcf1","catalogHash":"0x04852d2de29a09a91c02d0c1ead164cc552476f8e8940bd5d26359842b4d447b","block":21000000,"time":1733000000}
```

(The populated probe block — market open, a word at home and in the commons, a bound key, one lock, a SPEAKING will, one raise, a renter and a guardian — measured 16,362 bytes; the sub-object values are quoted in §1.4. The size of the block is dominated by the three tables, ≈ 13.5 KB, so it barely moves with state.)

### 1.9 BigInt discipline — which fields need `BigInt(...)`

Quoted decimal strings (use `BigInt(S.x)`, never `Number`): `price`, `market.rBase`, `market.rQuote`, `market.spot`, `inbox.postage`, `home.room`, `commons.room`, `/open` rows' nothing (their fields are small), `/services.json` nothing. Hex strings: all addresses, `fingerprint`, `key.id`, `holderKeyId`, `engineHash`, `catalogHash`, `panels.*`, `topics.*`, `sel.*`, `err` keys. Bare numbers are all ≤ 2^53 by construction (uint64 timestamps/blocks, uint32/16/8 counts and bps, the id ≤ 4096, `chainId`) — safe as JS numbers; `curve` ≤ 80,000.
Amounts the panels compute (quotes, caps, allowances, `msg.value`) never pass through the block; they come from `eth_call` return words → BigInt directly.

---

## 2. The harness API `verify-site.mjs` will use

### 2.1 `tools/evm.mjs` — the chain

```js
import { Chain, enc, sel, encodeParams, decUint, decAddr, decBool, decString, decStringArray,
         roll, warp, BLOCK, GENESIS_TIME, TX_GAS_CAP, common } from "./evm.mjs";
import * as EVM from "./evm.mjs";   // EVM.BLOCK is the LIVE binding after roll/warp
```

**`static async Chain.open(opts = {}) → Chain`** (`evm.mjs:261-275`). `opts.chainId` (number|bigint) makes `block.chainid` that value (a custom `Common` at Cancun); default is mainnet (`1`). The deployer key is `0x11…11` (32 bytes); `chain.from` is an `@ethereumjs/util` `Address` — **use `c.from.toString()`** for the hex (`0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a`), funded `10n ** 24n` wei. `c.common.chainId()` → `1n` (bigint) is what an `eth_chainId` shim should return (`"0x" + c.common.chainId().toString(16)`). Note the harness state block then reads `"chainId":1` while the bands table says band 1 is chain 8453; `Chain.open({ chainId: 8453 })` makes them agree if a test wants that.

**`await c.as(keyHex, wei = 10n ** 22n) → Chain`** (`290-296`): a second actor on the **same VM and state** — a new `Chain` with `hexToBytes(keyHex)` as its key, `other.from` derived from it, funded `wei`, and **sharing `this.gas` and `this.log`** (one ledger, one archive). `keyHex` is a 32-byte private key (`"0x" + "22".repeat(32)` → `0x1563915e194d8cfba1943570603f7606a3115508`, balance `10000000000000000000000`), not an address. To act AS bob: `bob.exec(...)` / `bob.send(...)` — these sign with bob's key and read bob's nonce from state. To read AS bob: `bob.read(...)` (caller = bob.from) or `c.call(to, data, bob.from.toString())`.

**`await c.send({ to = null, data = "0x", value = 0n, label = "", gasLimit = 400_000_000n, allowOverCap = false }) → { gas, address, ret, logs }`** (`310-354`). Builds a legacy tx (gasPrice 10) with the nonce **read from state** (a reverted tx still consumes one; a validation-rejected one does not), signed with `this.key` against `this.common`, run with `runTx(... block: BLOCK, skipBalance: true ...)`. On revert: throws `Error("<label||'tx'> reverted: <err.error>" + (ret ? " data=<first 138 chars of hex>" : ""))` — e.g. the probe's `transferFrom(address,address,uint256) reverted: revert data=0x0da93bf9000000000000000000000000ebfdaba9…` (`CanonicalAccount(address)`); 138 chars = `0x` + selector + two words. Then **asserts `totalGasSpent ≤ TX_GAS_CAP` (16,777,216, EIP-7825)** unless `allowOverCap`. Returns `gas` (bigint, total incl. intrinsic), `address` (created contract or `null`), `ret` (hex), `logs` (**raw ethereumjs tuples** `[Uint8Array address, Uint8Array[] topics, Uint8Array data]` — see `site.mjs:226` for the conversion). Every log is also appended to `c.log` in node shape (`_record`, 368-382).

**`await c.exec(to, sig, args = [], opts = {})`** (`433-435`) = `send({ to, data: enc(sig, args), label: opts.label || sig, ...opts })` — so `opts.value`, `opts.gasLimit`, `opts.allowOverCap`, `opts.label` all flow through; the gas ledger `c.gas[label]` accumulates per label.

**`await c.call(to, data, from?) → hex`** (`411-427`): `vm.evm.runCall` with `caller`/`origin` = `from || this.from`, `gasLimit 3_000_000_000n`, `value 0`, `block: BLOCK`. Sets **`c.lastGas`** = `executionGasUsed` (execution only, no intrinsic — exactly what `eth_call`/`gas.mjs` measure). On revert throws `Error("call reverted: <error> <first 138 chars>")` — probe: `call reverted: revert 0x7623fb52 ` (`NotHolder()`, no args → selector only). **The custom-error selector is recoverable from `e.message.match(/0x[0-9a-f]{8}/)` and mapped through `S.err`.**

**`await c.read(to, sig, args = [])`** (`429-431`) = `call(to, enc(sig, args))` — always from `this.from`; there is **no `from` parameter**, use `c.call(to, enc(sig,args), fromHex)` or `bob.read(...)`.

**`c.call` is not read-only.** Measured (`probe-call-commits.mjs`): `await c.call(hub, enc("sealTransfer(uint256,uint64)", [1, 1_740_000_000n]))` **persisted** — `coreOf(1).transferSealUntil` read `1740000000` afterwards. `@ethereumjs/evm`'s `runCall` checkpoints the journal and **commits on success** (`node_modules/@ethereumjs/evm/dist/esm/evm.js:1129, 1221`), reverting only on an exception. The harness comment "state is untouched" holds for views only. Consequence for a provider shim: `eth_call` and especially `eth_estimateGas` of a write **must** be wrapped —

```js
await c.vm.evm.journal.checkpoint();
try { r = await c.vm.evm.runCall({ to, caller, origin: caller, data, value, gasLimit: 3_000_000_000n, block: EVM.BLOCK }); }
finally { await c.vm.evm.journal.revert(); }
```

— measured: a second `sealTransfer` under checkpoint/revert left the stored value at `1740000000`. Without this, "estimate then send" sends into state the estimate already changed (`openMarket` estimated then sent reverts `MarketAlreadyOpen`). `gas.mjs`'s `measure()` has the same property (it is the same `runCall`); fine for views.

**`c.call`/`measure()` gas is cold only on the first call after a transaction.** Measured (`probe-warm.mjs`, 14 KB shell): `/token/1/hash` first call 2,335,405, second call 2,144,905 (−190,500), after a one-wei `c.send` 2,335,405 again; `tokenURI` 7,086,066 cold / 6,898,066 warm. `runTx` cleans the journal's EIP-2929 accessed-address/slot sets at the end of every transaction; a bare `evm.runCall` leaves them populated, so consecutive calls see each other's warmth. A real node's `eth_call` is always cold. Rule for any gas assertion in verify-site: **send a transaction between measurements** (`await c.send({ to: "0x" + "77".repeat(20), value: 1n })`) or measure each route first on its own chain; `c.lastGas` after a `GET` that follows other reads is a warm number.

**Other members**: `await c.fund(addrHex, wei)`; `await c.balanceOf(addrHex) → bigint`; `await c.codeSize(addrHex) → number` (byte length; the Reach/Grip read 173, the registry 571); `await c.nonceNow() → bigint`; `await c.deploy(bytecodeHex, argsHex = "", label) → address` (throws if no address); `c.getLogs({ address, fromBlock, toBlock, topics })` (`384-402`) answers node shape — inclusive bounds (`fromBlock`/`toBlock` accept bigint, decimal or `"0x…"` strings, `null`/`"latest"`/`"pending"` = defaults `0`/current block), positional topics with `null` = any and an array = any-of, address optional; each log `{ address, topics[], data, blockNumber: "0x…", logIndex: "0x…", transactionHash: "0x…" }` (all lowercase hex strings; probe sample: a `Transfer` with `topics[3] = 0x…02`, `blockNumber "0x1406f40"`). `c.vm.stateManager.getCode(createAddressFromString(a))` for an `eth_getCode` shim (`@ethereumjs/util`); `c.vm.stateManager.putCode(addr, bytes)` is how the registry is etched (`site.mjs:112-119`).

**Time**: `roll(number)` (`52-56`) sets `BLOCK = mkBlock(n, GENESIS_TIME + (n − 21_000_000n) · 12n)`; `warp(timestamp)` (`59-64`) sets number `21_000_000n + (t − GENESIS_TIME) / 12n` (clamped at genesis for earlier times). `GENESIS_TIME = 1_733_000_000n`, start block 21,000,000. `BLOCK` is an `export let` **live binding**, read by every `send`/`call` at call time and shared by every `Chain` in the process — read it as `EVM.BLOCK.header.number` / `.timestamp` (bigint). Probe: `roll(21000010)` → ts `1733000120`; `warp(1733001200)` → block `21000100`. Logs record the block number at the time of the tx, so a Parley walk test must `roll` between speaks to spread messages across blocks (verify-parley does `roll(at0 + 5n)`).

**ABI coder** (`84-236`): `sel(sig)` → `"0x" + 8 hex`; `enc(sig, args)` → selector + head/tail encoding (the selector is over the *canonical* text, so a signature written with field names — `"(address to,uint256 v)"` — still dispatches); `encodeParams(typeList, values)` → hex without selector (constructor args); `parseType`, `canonical`, `isDynamic`, `encodeValue` exported. Rules that cost a day each (`67-81`): **`bytes` must be a hex string** (`"0x" + buf.toString("hex")`; a Buffer throws, a non-hex string throws); a `bytes32` given as a number is the value (77 → `0x…4d`); `bytesN` left-aligned; negative ints two's-complement via `(1n << 256n) + n`; a tuple is an array in field order (or an object when the type names its fields); `string` is UTF-8. Decoders: `decUint(hex, i)` word `i` → bigint; `decAddr(hex, i)`; `decBool(hex, i)`; `decString(hex)` (one string return); `decStringArray(hex, at)` (`string[]` whose offset sits in head word `at` — `tokenURIs` returns `(uint256,string[],bool)`, so `at = 1`).

### 2.2 `tools/site.mjs` — the deployment and ERC-5219 helpers

```js
import { ROOT, REGISTRY, REGISTRY_RUNTIME, ZERO, PANELS, MARKET_PLACEHOLDER, ROLES_PLACEHOLDER, AGENTCARD_PLACEHOLDER,
         CONFIG_TYPE, CATALOG_CONFIG_TYPE, predictCreate, REQUEST, encRequest, decResponse, getter,
         readPlan, deploySite, mint, sel, w } from "./site.mjs";
```

**`await deploySite(c, out, opts = {}) → site`** (`100-218`). `out` is `compile(...)`'s output; `opts`: `plan` (default `readPlan()` = `dist/shards.json`), `price` (default `10n ** 16n`), `band` (1), `lo` (1n), `hi` (3072n), `router` (**default `ZERO`** → `state.router = 0x0`, bit 128 absent), `agentCard` (default the codeless placeholder). Order (load-bearing, nonce-predicted): registry etched at its canonical address if absent → `Reach`, `Grip` impls → `Engine` + `loadHead`/`loadBody`/`loadPanel(i, gz, hash)` per shard + `setEngineHash(hash, inflatedSize)` + `freeze()` → `Crest`, `KeyRegistry`, `Timelock(from)` → **from here one CREATE per nonce**: `CatalogRows(address[16])`, `CatalogText`, `CatalogState`, `Catalog(CatalogConfig)`, `Renderer`, `Premises`, four facets, `IntactDiamond`, `Locks`, `Steward`, `Postage`, `Parley`, `Roster`, `Pool`, `Kiln`, `Launchpad`; then every prediction is asserted and the hub's `RENDERER()/CATALOG()/PREMISES()/POOL()/PARLEY()/LAUNCHPAD()/LOCKS()/STEWARD()` are read back. **Do not interleave any other transaction while it runs** (predictions are from `nonceNow()`). Returns exactly:

```js
{ plan, price, band, lo, hi, gasLog,                       // gasLog: {loadHead, loadBody, loadPanel} bigints
  registry, reachImpl, gripImpl, engine, crest, keys, timelock, router, agentCard,
  market /* MARKET_PLACEHOLDER */, roles /* ROLES_PLACEHOLDER */,
  catalogRows, catalogText, catalogState, catalog, renderer, premises,
  coreFacet, rightsFacet, mintFacet, siteFacet, hub,
  locks, steward, postage, parley, roster, pool, kiln, launchpad,
  facets: { CoreFacet, RightsFacet, MintFacet, SiteFacet } }
```

All addresses are `0x`-prefixed hex strings as `@ethereumjs` prints them (mixed case possible — compare with `.toLowerCase()`, as verify.mjs does throughout). `c.gas` after a deploy carries labels `Reach, Grip, Engine, loadHead, loadBody, loadPanel, setEngineHash(bytes32,uint32), freeze(), Crest, KeyRegistry, Timelock, CatalogRows, …`.

**A reported Router.** The Router's constructor needs `pool.code.length != 0` (`Router.sol:151`) and the Catalog pins `ROUTER` as an immutable *before* the Pool exists, so no ordering of fresh deploys gives a Router the state block reports. The recipe that works (how the registry itself is placed, `site.mjs:112-119`): pass `opts.router = <any chosen address>` to `deploySite`, then after it returns deploy a real `Router(hub, pool, swapRouter02|0x0, poolManager|0x0, weth|0x0, launchHookCodehash)` (verify-vault.mjs:704-705 shows the args) at whatever address CREATE gives, and copy its runtime there: `await c.vm.stateManager.putCode(createAddressFromString(opts.router), await c.vm.stateManager.getCode(createAddressFromString(realRouter)))` (create the account first if `getAccount` is null, as `site.mjs:114-117` does). Immutables are baked into the runtime, so the copy behaves identically; `state.router` then names it and bit 128 reports. The default (no Router) is what "an absent Router hides the tab and sets the chip to not reported" needs.

**`getter(c, premises)(resource: string[]) → { status, body, bodyBytes, headers, header(k), gas }`** (`82-86`): one `eth_call` of `request(string[],(string,string)[])` with empty params; `status` number (200/301/404), `body` UTF-8 string, `bodyBytes` Buffer (hash this: `/panel/*.js` bodies are gzip), `headers` as `[[name, value], …]`, `header(k)` case-insensitive lookup → value or `undefined`, `gas` = `c.lastGas`. `encRequest(resource)` and `decResponse(hex)` (`56-79`) are the two halves. Resources are path segments without slashes: `["token","1","live"]`, `[]` for `/`, `["panel","swap.js"]`, `["open"]`, `["open","48"]`, `["manifest"]`, `["k","1","0x…"]`, a trailing `""` is dropped by the router. Headers actually served (Premises.sol): `/live` → `Content-Type: text/html; charset=utf-8`, `Cache-Control: public, max-age=15`, `Link: </token/<id>/services.json>; rel="service-desc"`; `/panel/<name>.js` → `Content-Type: text/javascript; charset=utf-8`, `Content-Encoding: gzip`, `ETag: "<keccak of inflated>"`, `Cache-Control: public, max-age=86400`; JSON routes `application/json`; `/raw`, `/face/<n>` `text/plain; charset=utf-8`; `/crest.svg` `image/svg+xml`; 301s carry `Location`.

**`await mint(c, site, to) → { id: bigint, gas }`** (`222-230`): `c.exec(site.hub, "mint(address)", [to || c.from], { value: site.price })` and the id from the `Transfer` log's `topics[3]` (never read-after-write). To mint **as** another actor: `const r = await bob.exec(site.hub, "mint(address)", [bob.from.toString()], { value: site.price }); id = BigInt("0x" + Buffer.from(r.logs.find(l => "0x"+Buffer.from(l[1][0]).toString("hex") === TRANSFER)[1][3]).toString("hex"))` (or `c.getLogs({ address: site.hub, topics: [TRANSFER] }).pop().topics[3]`). The first id of the band is 1.

### 2.3 `tools/compile.mjs`, `tools/gas.mjs`, `tools/verify.mjs`

`compile({ quiet = false, dirs = ["src"] }) → out` (solc standard-JSON output; viaIR, 800 runs, cancun, `bytecodeHash: "none"`; cached under `out/compile-cache/<sha256>.json` — the cache hit today, so a verify run takes ~1 min; `INTACT_NO_COMPILE_CACHE=1` forces a cold compile, minutes). Use `dirs: ["src", "test/mocks"]` to get `MockERC20` (`constructor(string n, string s, uint8 d, uint256 feeBps, bool silent)`, `mint(address,uint256)`) for a market base. `artifact(out, "src/Reach.sol", "Reach") → { abi, bytecode: "0x…", deployed: "0x…" }`; `out.contracts[file][name].abi` is the raw ABI (verify.mjs's drift gate iterates it). Also `isLibrary(deployedHex)`, `shipRule(out)`, `LIMIT = 24_576`, `SHIP_THRESHOLD = 24_000`, `MEASURED = ["Intact"]`, `ROOT`.

`gas.mjs` exports `CAPS = { tokenURI: 8_000_000n, live: 2_500_000n, panel: 1_000_000n, manifest: 3_000_000n, face: 500_000n, crest: 500_000n, state: 1_000_000n, any: 16_777_216n, hard: 50_000_000n }`, `measure(chain, to, dataHex) → { gas: bigint, bytes } | { gas: null, bytes: 0, err }` (never throws; the same `runCall`, so it commits a successful write), `verdict(row)`. Importing it does not run the CLI (`164-166`). Its route probes run **only when `dist/shards.json` exists** (`113`), so `npm run check` gates the 8 M `tokenURI` only after `npm run build`.

`verify.mjs` reads `dist/shards.json`, `dist/app.html`, `dist/manifest.json`, `dist/panels/<name>.js` (`50-52, 346`) and writes `dist/token-1.html` (the document exactly as `/token/1/live` served it), `dist/token-1.json`, `dist/crest-1.svg`, `dist/services.json`, `dist/state-1.json` (`477-482`). Its helpers are local, copy them: `b64json = (uri) => JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf8"))`; `stateOfHtml` (above); the loader payload regex `/self\.\$INTACT="([A-Za-z0-9+/=]+)";<\/script>/` then `zlib.gunzipSync(Buffer.from(m[1], "base64"))` gives the shell bytes (`140-146`). Its sequence is the template for verify-site's setup: build facts → `compile` → `Chain.open` → `deploySite` → `getter` → `mint` → `tokenURI` → the document → the state block.

### 2.4 An EIP-1193 shim over the harness (method → harness call)

| method | harness |
|---|---|
| `eth_chainId` | `"0x" + c.common.chainId().toString(16)` |
| `eth_accounts` / `eth_requestAccounts` | `[actor.from.toString()]` (the viewer test asserts the second is **never** called) |
| `eth_blockNumber` | `"0x" + EVM.BLOCK.header.number.toString(16)` |
| `eth_call {to,data,from}` | `c.call(to, data, from)` inside `journal.checkpoint()/revert()`; a thrown message's `0x[0-9a-f]{8}` is the error selector |
| `eth_estimateGas {to,data,from,value}` | `c.vm.evm.runCall({ to, caller: from, origin: from, data, value, gasLimit: 3e9n, block: EVM.BLOCK })` inside checkpoint/revert; `executionGasUsed` + 21,000 + calldata, or `exceptionError` + `returnValue` (the custom error) |
| `eth_sendTransaction {from,to,data,value}` | `actorFor(from).send({ to, data, value })` → hash from `c.log` tail's `transactionHash`, or `hex(tx.hash())` |
| `eth_getTransactionReceipt` | synthesize from `send()`'s `{gas, logs}` and `c.log` (blockNumber, logs with `transactionHash`); status `0x1` (a revert threw) |
| `eth_getCode(addr)` | `"0x" + Buffer.from(await c.vm.stateManager.getCode(createAddressFromString(addr))).toString("hex")` (`""` → `"0x"`); to simulate a 7702 holder, `putCode(addr, hex"ef0100" ‖ delegate)` |
| `eth_getBalance` | `c.balanceOf(addr)` |
| `eth_getLogs` | `c.getLogs(filter)` (already node-shaped) |
| `personal_sign` / `eth_signTypedData_v4` | sign with the actor's key (`@ethereumjs/util` `ecsign`/`secp256k1`) — out of this report's surface |
| `accountsChanged` / `chainChanged` | the shim emits them; `Chain.open({ chainId })` makes a wrong-chain provider |

### 2.5 Skeleton

```js
import zlib from "node:zlib";
import { compile, artifact } from "./compile.mjs";
import { Chain, enc, decUint, decAddr, decString, encodeParams } from "./evm.mjs";
import * as EVM from "./evm.mjs";
import { ROOT, deploySite, getter, mint, readPlan, PANELS, ZERO } from "./site.mjs";
import { CAPS } from "./gas.mjs";
const out  = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const c    = await Chain.open();                   // or { chainId: 8453 }
const site = await deploySite(c, out);             // { router: ROUTER_AT } for a reported Router (etch recipe)
const GET  = getter(c, site.premises);
const { id } = await mint(c, site, c.from.toString());
const bob  = await c.as("0x" + "22".repeat(32));   // a renter / stranger / buyer
const live = await GET(["token", String(id), "live"]);        // live.body === the document
const S    = JSON.parse(live.body.match(/<script>window\.INTACT=([\s\S]*?)<\/script>/)[1]);
const shell = zlib.gunzipSync(Buffer.from(live.body.match(/self\.\$INTACT="([A-Za-z0-9+/=]+)";/)[1], "base64")).toString("utf8");
const panel = zlib.gunzipSync((await GET(["panel", "swap.js"])).bodyBytes);   // keccak(panel) must equal S.panels.swap
```

---

## 3. What `tools/build-app.mjs` demands of the shell and the panels

### 3.1 Inputs

`sources()` (`164-173`): the shell is `engine/app.html` if it exists else `tools/fixtures/app-placeholder.html`; each panel is `engine/panels/<name>.js` for `PANELS = ["swap","social","launch","vault","identity","agent"]` (that order = `Engine.panel(0..5)` = `verbWord(2..7)`), else the fixture; `placeholder: true` in `dist/shards.json` and `dist/manifest.json` if **any** source fell back. **There is no handling of `engine/app.css`** — see §3.7. CLI: `--no-min`, `--chunk <bytes>` (default 24,000; > 24,575 refused).

### 3.2 The checks, in order (`build()`, `177-255`)

On the raw shell **source** (comments and CSS included — nothing is stripped first):

1. `/window\.INTACT\s*=/.test(source.slice(0, source.indexOf("</head>")))` → error "state must be injected by the contract, not baked into the head". (An assignment after `</head>` is allowed; so is `const INTACT = window.INTACT`.)
2. `!/window\.INTACT/.test(source)` → "the shell never reads window.INTACT". The literal `window.INTACT` must appear (bare `INTACT` or `self.INTACT` alone fails).
3. `!/<\/head>/.test(source)` → "the shell has no </head> for the state gap".
4. `refuse(source, "the shell")` — the FORBIDDEN list (§3.3).
5. `checkLoader()` — on `src/Renderer.sol`'s `INFLATE`, not on the shell.

Then `shrinkShell(source)` (§3.4) and on the **minified** document: `</head>` still present, `window.INTACT` still present, `refuse(doc, "the minified shell")`. Then gzip level 9, round-trip equality, **`bodyBuf.length > 18_000` → error**. Per panel: `refuse(js)`, `/window\.INTACT/.test(js)` required ("panel X never reads window.INTACT"), `shrinkPanel`, `refuse(min)`, gzip, round trip, **`gz.length > 8_192` → error**. Finally the host scan over the written `dist/app.html` and `dist/panels/*.js` (§3.6).

### 3.3 FORBIDDEN (`82-89`) — exact regexes, applied to source and to minified output

| regex | why | notes for the author |
|---|---|---|
| `/src\s*=\s*["']https?:\/\//i` | an external script or image source | catches `<script src="https://`, `<img src='http://`, and the same text inside a JS string; `src="blob:…"` set via DOM property is not text and passes (the panel loader sets `tag.src = URL.createObjectURL(...)`) |
| `/\beval\s*\(/` | eval | `\b` before `e`: `retrieval(` passes, `x.eval(` fails |
| `/\bnew\s+Function\s*\(/` | new Function | |
| `/\(\s*1n\s*<<\s*256n\s*\)\s*-\s*1n/` | the uint256 mask | a BigInt that must be bounded is checked (`if (v >= 1n << 256n) throw`), never masked |
| `/\binnerHTML\s*=/` | an innerHTML assignment | also trips on `innerHTML == …`, `innerHTML ===`; use `textContent`, `createElement`, `replaceChildren` |
| `/\bdocument\.write\s*\(/` | document.write in the shell | only the loader (in Renderer.sol) may; a comment saying "no document.write(" in app.html fails the build |

Because `refuse` runs on the raw source, **comments and CSS are scanned too**: write about these patterns only in pieces (the project's own convention, `build-app.mjs:80-81`, `static-audit.mjs:28-31`).

### 3.4 Minification mechanics and their consequences

`shrinkShell` (`113-137`): `scriptRe = /<script>([\s\S]*?)<\/script>/g` — **only a bare `<script>` tag is matched**; `<script type="module">`, `<script defer>` or any attribute leaves the block unminified and unparsed-checked (and `type="module"` would also make `import`/top-level-await legal there — do not). At least one `<script>` block is required ("no <script> block in the shell"). Each block is minified **separately** with terser `{ ecma: 2022, module: false, compress: { passes: 2, drop_debugger: true }, mangle: { toplevel: true, reserved: ["INTACT"] }, format: { comments: false, ascii_only: false } }` and must parse as a classic script (`new vm.Script(r.code)`): **no `import`/`export`, no top-level `await`**; ES2022 syntax (optional chaining, `??`, class fields, BigInt literals) is fine. `styleRe = /<style>([\s\S]*?)<\/style>/g` — bare `<style>` only; comments stripped, whitespace around `{}:;,>` removed, `;}` → `}`, runs of whitespace collapsed (so a CSS string that needs a space before `>` or inside `content:""` must not rely on it). Finally `out.replace(/>\s*\n\s*</g, "><")` removes inter-tag whitespace that spans a newline — including inside a `<pre>` or a template literal that happens to contain `>\n<`. Panels: `shrinkPanel` (`139-149`) with the same terser options.

**Terser `mangle.toplevel: true` + `reserved: ["INTACT"]`, measured** (`scratchpad/u9/terser-probe.mjs`, terser 5.x from `node_modules`):

```
in  : const helper=(x)=>x*2; function keccak(b){…} const INTACT=window.INTACT; window.INTACT.keccak=keccak; INTACT.ui={show(n){…}}; let shared=5; class Slab{…}
out : const n=n=>2*n;function t(t){return t.length+n(1)}const INTACT=window.INTACT;window.INTACT.keccak=t,INTACT.ui={show(n){…}};let e=5;class o{…}
```

and a *second* block that uses the first's names:

```
in  : console.log(helper(2), keccak(...), shared, INTACT.ui); const helper2=1; let shared2=2;
out : console.log(helper(2),keccak(new Uint8Array(1)),shared,INTACT.ui);const e=1;let o=2;
```

Implications, each visible above:

1. Every top-level `const`/`let`/`var`/`function`/`class` in a `<script>` block is renamed to a one-letter name; **references from another block keep the original name and become `ReferenceError`s at runtime** (`helper(2)` in block B). Cross-block sharing by name is impossible after the build.
2. Worse than silence: block B's own top-levels were renamed to `e` and `o`, which block A also declared. Classic scripts share one global lexical environment, so the second `const e` is a **`SyntaxError: Identifier 'e' has already been declared`** and block B never runs. The same applies to a **panel**: a panel with any top-level declaration can collide with the shell's mangled names. Therefore **every panel is one IIFE declaring nothing at top level** (as the fixtures are), and the shell is either **one `<script>` block** or several blocks each wrapped in an IIFE.
3. Anything the shell exposes to panels, or one block to another, must hang off `window.INTACT` (`INTACT` is reserved, so `const INTACT = window.INTACT` keeps its name; property names are never mangled because `mangle.properties` is off): `INTACT.keccak256`, `INTACT.ui`, `INTACT.wallet`, `INTACT.slab`, `INTACT.rights`, `INTACT.provider`, `INTACT.loaded` … The placeholder already does `S.keccak256 = keccak256` and `S.loaded[name] = true`. (A top-level `const INTACT` is a global lexical binding visible to Blob scripts by that name — but panels should still spell `window.INTACT` at least once, because the build requires the literal in each panel.)
4. Anything that must survive by its own global name for the *contract-written* scripts is `window.INTACT` (set by the state script) and `self.$INTACT` (the loader's payload, deleted on read); nothing else is promised. Terser does not touch `window.INTACT`, `self.$INTACT`, `location.hash`, `document.getElementById(...)` strings, or `dataset` keys.
5. `compress.passes: 2` will inline single-use IIFE contents (block C: `window.INTACT.f=function(){return 3}`) and drop unreachable code and `debugger`; it does **not** remove `console.log`. Dead-code paths behind a constant are removed, so a feature flag must not be a top-level `const false`.

### 3.5 What the loader requires of the shell at boot

Document order on the live origin and in `animation_url` is identical: `<!doctype html>…<meta http-equiv="Content-Security-Policy" content="…">…</head><body>` (the PROLOGUE, `69-76`: `color-scheme: dark`, a one-rule `<style>` for the pre-inflate page) → `<script>window.INTACT={…}</script>` → `<script>self.$INTACT="…";</script>` → the loader (`Renderer.sol:76-84`) which `atob`s, inflates with `DecompressionStream("gzip")`, then `document.open(); document.write(t); document.close();`, catching errors into `document.body.textContent`. `document.open()` keeps the Window: `window.INTACT` survives, every top-level binding of the *written* shell is fresh, and the CSP policy container persists (the shell should still carry the same `<meta http-equiv=CSP>` in its own head — the placeholder does — so `dist/app.html` opened by hand behaves the same). The written shell's inline `<script>`s run synchronously during the write; `DOMContentLoaded`/`load` fire for the new document after `close()`. The shell must not assume `document.currentScript` or any external resource.

### 3.6 Outputs and the host scan

`dist/shards.json` = the plan `deploySite` consumes: `{ mode:"packed", minified, placeholder, chunkBytes, shell, sourceBytes, documentBytes, storedBytes, inflatedSize, engineHash, csp, head:[{i,bytes,gas,hash,data}], body:[…], panels:[{name,bytes,inflatedBytes,hash,gzipHash,data}] }` (`data` = `0x` hex of the shard; `hash` for a panel is of the **inflated** text, `gzipHash` of the stored bytes). `dist/manifest.json` = `{ engineHash, inflatedSize, shardHashes[head…, body…, panels gzip…], panelHashes{name→inflated keccak}, loaderHash, placeholder }`. `dist/app.html` = the minified shell (the bytes `engineHash` is over; verify.mjs demands the chain inflates to exactly these). `dist/panels/<name>.js` = minified panels.
Today (placeholder): source 7,683 B → minified 5,125 B → gzip 2,449 B (head 564 B = the PROLOGUE); panels 331-343 B inflated → 246-249 B gzip; `engineHash 0x41c9d553…dcf1`.

Host scan (`248-253`) on `dist/app.html` and each `dist/panels/*.js`: `/https?:\/\/[a-z0-9.-]+\.(?:org|com|io|xyz|net)\b/i` or `/\bwss?:\/\//i` → "names a host — no RPC URL may ship in a document". So no literal `https://<host>.<org|com|io|xyz|net>` anywhere in the minified JS/HTML/CSS (a `web3://…` link is fine; a gateway twin must be assembled at runtime from parts — `"https://" + S.premises + ".3337.w3link.io"` passes because `https://` is followed by `"`, but is a design smell; verify.mjs separately asserts no `https?://` text in the *served* document, which only sees the base64 shell, so the shell's own strings are not tested there).

### 3.7 `engine/app.css` — how it should ship

Facts: the CSP (`default-src 'none'; style-src 'unsafe-inline'`) blocks `<link rel=stylesheet>`, so the CSS must end up inline; `shrinkShell` minifies only bare `<style>…</style>` blocks already present in the shell; `build-app.mjs` reads nothing but `app.html` and the panels; `static-audit.mjs` scans `.js/.mjs/.html` under `engine/` (not `.css`); U9 owns `engine/app.css` per BUILD-PLAN, U7 owns `build-app.mjs` (done and merged, so an additive change is permissible with a note).

Two viable shapes:

**A — inline at a marker (recommended).** `engine/app.html` carries exactly one `<link rel="stylesheet" href="app.css">` in its `<head>`; `build()` replaces it with `<style>` + the file's text + `</style>` **before** every check (so `refuse()` and the host scan cover the CSS, and `shrinkShell` minifies it like any `<style>`), and fails if the marker is present without the file, the file without the marker, or more than one marker. Sketch (additive, ~10 lines at `build()`'s top):

```js
const cssPath = path.join(ROOT, "engine/app.css");
const LINK = /<link\s+rel="stylesheet"\s+href="app\.css"\s*\/?>/g;
const marks = [...source.matchAll(LINK)].length;
if (marks > 1) throw new Error("the shell links app.css more than once");
if (marks === 1 && !fs.existsSync(cssPath)) throw new Error("the shell links app.css but engine/app.css is missing");
if (marks === 0 && fs.existsSync(cssPath) && !shellPath.includes("fixtures")) throw new Error("engine/app.css exists but the shell never links it");
if (marks === 1) source = source.replace(LINK, () => "<style>" + fs.readFileSync(cssPath, "utf8") + "</style>");
```

(`source` becomes `let`; `plan.css = "engine/app.css"` and `cssBytes` recorded.) The `<link>` text itself contains no `src=`, so it is not a FORBIDDEN match, but leaving it in the output would be a silent no-op under CSP — hence the hard errors.

**B — zero build change.** Keep the CSS inside `app.html` in a bare `<style>` block and do not create `engine/app.css` (or keep it as the authoring copy and paste it in — which drifts). Works today; costs the separate file BUILD-PLAN names.

Either way: no `@import`, no `url(https://…)` (fonts/images are `default-src 'none'`; `img-src data: blob:` allows an inline `data:` SVG background), `attr()`/`content:` only with static text, and remember the minifier's whitespace rules (§3.4).

### 3.8 What the CSP permits the shell to do (`CSP`, `build-app.mjs:62-64`)

`default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'self'; form-action 'none'; base-uri 'none'`. Allowed: inline `<script>`, `<script src="blob:…">` (the hash-checked panels), inline event handlers, `<style>` and `style=""`, `<img src="data:…">`/`blob:`, inline `<svg>` (the QR), `fetch("/panel/x.js")` on the live origin (same origin). Blocked: `eval`/`new Function`/string `setTimeout` (no `'unsafe-eval'` — they throw at runtime as well as failing the build), any `http(s)://` fetch or `<link>`, Web Workers (`worker-src` → `default-src 'none'`, so keccak and inflate run on the main thread), iframes (`frame-src` none), fonts, media, forms. In the `data:` viewer the origin is opaque: `fetch("/panel/…")` has no base and fails → panels come from `eth_call Engine.panel(i)` through the injected provider (not subject to the page CSP), inflated with `DecompressionStream`, keccak'd, Blob-injected; `localStorage` throws there (the detector).

---

## 4. The gas picture and the byte budget

### 4.1 Measured today on the placeholder (`node tools/gas.mjs --json`, 75 probes, 0 over)

| probe | gas | returned bytes | cap |
|---|---|---|---|
| `hub.tokenURI(1)` (face 0, base64 thrice) | **4,089,259** | 39,648 | 8,000,000 |
| `hub.tokenURIs(1)` (every face) | 4,552,717 | 45,984 | 16,777,216 |
| `hub.tokenURIAt(1,1)` (crest face) | 325,485 | 3,104 | 500,000 |
| `/` (collection document) | 488,628 | 19,584 | 2,500,000 |
| `/token/1/live` | **765,419** | 21,408 | 2,500,000 |
| `/token/1/raw` (= tokenURI through Premises) | 3,954,940 | 40,192 | 8,000,000 |
| `/token/1/face/1`, `/face/2` | 337,041 / 337,209 | 3,648 | 500,000 |
| `/token/1/crest.svg` | 110,976 | 1,312 | 500,000 |
| `/token/1/state.json` | 586,739 | 16,896 | 1,000,000 |
| `/token/1/hash` | 1,410,544 | 1,024 | 2,500,000 |
| `/token/1/services.json` | 121,858 | 1,152 | 1,000,000 |
| `/panel/<name>.js` (six) | 28,624 … 38,296 | 1,376 | 1,000,000 |
| `/services.json` | 440,878 | 45,184 | 1,000,000 |
| `/open` | 20,338 | 672 | 1,000,000 |
| `/manifest` | 427,734 | 3,680 | 3,000,000 |
| `catalog.state(1)` / `state(0)` | 561,972 / 287,052 | 16,352 / 14,784 | 1,000,000 |
| `renderer.document(1)` | 734,436 | 20,608 | 2,500,000 |

(verify.mjs's own run: tokenURI 4.08 M, /live 0.77 M, /manifest 0.45 M; mint 0.31 M.) **Which of these are cold:** `hub.tokenURI(1)` is the first call on the site's contracts after `mint`, so it is a cold, node-realistic number; every route row after it in `gas.mjs`'s list (`/`, `/live`, `/raw`, `/hash`, `/state.json`, …) is measured **warm** by ≈ 0.19 M (§2.1) — `/token/1/hash` is 1,601,044 cold on the same deployment, not 1,410,544. The probe's populated token read tokenURI 3.98 M and /live 1.04 M warm, after many transactions had touched the same slots.

### 4.2 The sweep: gas as a function of the gzip shell (measured, same deployment, random body of G bytes, one shard)

| gzip body G | `tokenURI` gas | tokenURI bytes | `/live` gas | `/live` bytes | `/raw` gas | `tokenURIs` gas |
|---|---|---|---|---|---|---|
| 3,013 | 4,231,629 | 40,992 | 799,394 | 22,176 | 4,099,963 | 4,695,408 |
| 6,000 | 4,990,646 | 48,064 | 980,130 | 26,144 | 4,873,958 | 5,456,119 |
| 9,000 | 5,766,393 | 55,168 | 1,163,931 | 30,144 | 5,666,480 | 6,233,568 |
| 12,000 | 6,553,736 | 62,272 | 1,349,749 | 34,144 | 6,472,331 | 7,022,612 |
| **14,000** | **7,086,066** | 67,040 | 1,474,990 | 36,832 | 7,018,054 | 7,556,084 |
| 16,000 | 7,623,900 | 71,776 | 1,600,994 | 39,488 | 7,569,964 | 8,095,052 |
| **18,000** | **8,166,311** — over the cap | 76,512 | 1,727,827 | 42,144 | 8,127,221 | 8,638,598 |

The routes that re-read the body and therefore also grow with the shell, measured **cold** (first call after a transaction) and warm (second call), same deployments:

| gzip body G | `/token/1/hash` cold | `/hash` warm | `/` (collection) cold | `/state.json` | `tokenURIAt(1,1)` |
|---|---|---|---|---|---|
| 3,013 | 1,636,078 | ≈ 1,445,000 | 522,469 | 586,739 | 329,985 |
| 14,000 | **2,335,405** | 2,144,905 | 1,195,418 | 586,739 | 329,985 |
| 18,000 | **2,598,585** — over the 2.5 M cap | 2,408,085 (under — what gas.mjs would print) | 1,447,397 | 586,739 | 329,985 |

`/hash` ≈ 1.44 M + 64 · G cold (it runs `document(id)` once more, hashes it, re-reads head and body, and re-renders the state); `/` ≈ 0.33 M + 62 · G; `/state.json`, the faces and the crest do not move.

### 4.3 The model, and why

The U7 commit (`git show 6ed1539`) measured `Base64.encode` at **55.2 gas/byte** (Solady shape, canonical padding) and projected "6.3 M at a 14 KB gzip shell, 6.7 M at the 18 KB ceiling". The sweep says the projection was optimistic: `tokenURI` is **three** base64 passes, not two — the gzip body (G) → the document (`4/3·G` + prologue + state + loader ≈ `1.33 G + 17 KB`) → `animation_url` (`16/9·G`) → the data URI over the JSON (`64/27·G ≈ 2.37 G`; the output grows 2.37 bytes per gzip byte, 40,992 → 76,512 across the table). The passes alone are `55 × (1 + 1.33 + 1.78) ≈ 226` gas per gzip byte; copies through the diamond's delegatecall, the Renderer, the Engine's `bytes.concat`, and the quadratic memory term bring the measured marginal cost to **254 gas/gzip-byte at 3–6 KB rising to 271 at 16–18 KB** (mean ≈ 262). Fit:

```
tokenURI(G) ≈ 3.44 M + 262 · G        (R² ≈ 1 on the seven points; use 271 for G > 14 KB)
/live(G)    ≈ 0.61 M + 62  · G        (one base64 pass: 55 + copies)
tokenURIs   ≈ tokenURI + 0.47 M        (the crest faces, twice)
```

The constant 3.44 M is the state block (≈ 0.56 M for `catalog.state(1)`), the prologue, the crest, the JSON attributes and the fixed overheads; it grows a little with a populated token (longer symbols, more launches) and is what shrinks if the Catalog's tables ever move out of the document.

**The 8 M cap crosses at G ≈ 17.4 KB** (16,000 → 7.62 M, 18,000 → 8.17 M; linear interpolation 17,390 B). So:

- the build's `SHELL_GZIP_CEILING = 18_000` is **above** the gas cap: a shell at the build ceiling passes `npm run build` and fails `npm run gas` (`hub.tokenURI(1) needs 8.17M, over its 8.00M cap`). BUILD-PLAN §U9 anticipates this ("the 8 M `tokenURI` gate is measured here, not asserted") — it is measured here, and it bites below the build ceiling;
- **budget: design the shell to ≤ 14,000 B gzip** (tokenURI 7.09 M cold, 11.4 % headroom under 8 M; `/hash` 2.34 M cold, 6.6 % under 2.5 M; the DESIGN's own "≈ 14 KB gzip" figure) — **hard stop 15,000 B** (≈ 7.35 M / ≈ 2.40 M cold, 8 % / 4 % headroom). 16,000 B leaves 4.7 % on tokenURI and ≈ 1.6 % on `/hash`, which a longer symbol pair or a populated `launches` array erodes on a real chain whose node applies its own call cap first;
- **`/token/<id>/hash` is the second constraint, and the tighter one in relative terms**: it shares the 2.5 M `live` cap (`gas.mjs:133`), reads 2.34 M cold at 14 KB (6.6 % headroom) and crosses 2.5 M at ≈ 16.5 KB cold — while `gas.mjs` measures it warm and would still print 2.41 M at 18 KB. A verify-site gas step must measure it cold (§2.1), or U7's `gas.mjs` should insert a transaction between probes;
- `/live` is never the constraint (1.73 M at 18 KB vs 2.5 M); `tokenURIs` (cap 16.78 M) is not either;
- panels do not affect `tokenURI` at all (they are not in the document); they are bounded only by 8,192 B gzip each and `/panel/*` ≤ 1 M (measured ≤ 0.04 M at 250 B — the panel route is `SSTORE2.read` of the gzip, ≈ linear in size, no base64; an 8 KB panel will read well under 0.1 M);
- a verify-site assertion worth adding: `plan.body.reduce(bytes) <= 15_000` with the sentence "a shell over 15 KB gzip reads tokenURI over 7.35 M; the cap is 8 M" — or lower `SHELL_GZIP_CEILING` in U7's file with a note.

What 14,000 B gzip buys, from the placeholder's ratios (gzip ≈ 32 % of source, 48 % of minified): roughly 29 KB minified / 44 KB source of text-dense HTML+CSS+JS; code compresses worse than prose, so plan on **≈ 40 KB of minified shell** at most. DESIGN §5.5's 60 KB source budget (24,449 B wallet library verbatim + ≈ 22 KB Home/gate/slab/QR + ≈ 10 KB CSS) is consistent only if the wallet library minifies and gzips well — measure `gzip(minify(ipseity.html:1859-2396))` first; if it alone is > 7 KB, the shell has ≈ 7 KB for everything else and the QR/slab code must be terse.

### 4.4 Numbers that move with the real shell and should be re-measured on landing

`hub.tokenURI(1)` (the gate), `hub.tokenURIs(1)`, `/token/1/raw`, `/token/1/live`, `/`, `/token/1/hash` (1.60 M cold today, 2.34 M cold at 14 KB, over its 2.5 M cap from ≈ 16.5 KB — §4.2), `/manifest` (unchanged), `loadBody` deploy gas (`gasFor` in `build-app.mjs:162`: 53,000 + 16 per non-zero calldata byte (4 per zero) + 200 per byte deposited + 6,000 ≈ 3.08 M for a 14 KB shard — well under the 16.78 M tx cap `Chain.send` asserts; `CatalogRows` stays the heaviest deploy at 14.02 M). Measure the routes **cold**: `tokenURI` first, then a one-wei transaction, then `/hash`, then another, then `/live` (§2.1).

---

## 5. Checklist for implementers (every rule, with the tool that enforces it)

**`tools/static-audit.mjs` `JS_RULES`** (scans `engine/**/*.{js,mjs,html}`, `sdk/`, `tools/` minus itself; comments are blanked before scanning; `dist/` and `node_modules/` skipped; first hit per rule per file; `npm run check` runs it):

- [ ] no `eval(` — `/\beval\s*\(/g`
- [ ] no `new Function(` — `/\bnew\s+Function\s*\(/g`
- [ ] no `(1n<<256n)-1n` — `/\(\s*1n\s*<<\s*256n\s*\)\s*-\s*1n/g` (bound-check BigInts, never mask)
- [ ] no `innerHTML =` (or `innerHTML ==`) — `/\binnerHTML\s*=/g`; chain strings reach the DOM through `textContent` only
- [ ] `engine/app.css` is **not** scanned (no `.css` ext) — review it by eye for `url(https://`

**`tools/build-app.mjs`** (`npm run build`; applies to the RAW source incl. comments and CSS, and again to the minified output):

- [ ] the six FORBIDDEN regexes of §3.3 — including **no `document.write(`** in the shell and no `src="https?://` text
- [ ] `window.INTACT` literal present in the shell and in **each** panel; no `window.INTACT\s*=` before `</head>`; `</head>` present
- [ ] at least one bare `<script>` block; every `<script>` and `<style>` the minifier should touch is attribute-free; every block parses as a classic script (no `import`/`export`/top-level `await`)
- [ ] shell gzip ≤ 18,000 (build) and **≤ 14,000 by budget / 15,000 hard (gas, §4.3)**; each panel gzip ≤ 8,192
- [ ] no `https?://<host>.(org|com|io|xyz|net)` and no `wss?://` text in the minified shell or panels
- [ ] every panel is a single IIFE with **zero top-level declarations**; the shell is one `<script>` block or IIFE-wrapped blocks; everything shared hangs off `window.INTACT.*` (§3.4)
- [ ] the shell carries the same CSP `<meta>` as the PROLOGUE and reads `window.INTACT` at script time (no `DOMContentLoaded` dependency for the first paint)

**DESIGN rules the panels/shell must satisfy (enforced by `verify-site.mjs`, to be written):**

- [ ] BigInt for every amount; the quoted fields of §1.9 go through `BigInt()`; no `Number`/float on wei, reserves, caps, quotes
- [ ] `eth_chainId` compared to `INTACT.chainId` before any read; a switch button on mismatch
- [ ] rights (`rightsOf(id, account)` → bits) recomputed on `accountsChanged` and `chainChanged`; `body.dataset.rights` drives rendering
- [ ] `custodyEpoch(id)` (`sel["hub.custodyEpoch"]`, "re-read before every send") read immediately before every send and after every receipt; a changed epoch discards the slab ("ownership or epoch changed — review again")
- [ ] approvals exact: `erc20.approve(spender, amount)` with the amount the slab shows, never `2^256−1` or a mask
- [ ] panels: `fetch("/panel/<name>.js")` (live origin) or `eth_call Engine.panel(i)` (`sel["engine.panel"]`, gzip → `DecompressionStream`) → `keccak256(inflatedBytes) === INTACT.panels[name]` → `URL.createObjectURL(new Blob([bytes], {type:"text/javascript"}))` → `<script src=blob:>`; a mismatch renders "panel refused" and injects nothing
- [ ] the `data:` viewer (opaque origin: `localStorage` throws) never calls `eth_requestAccounts`, never proposes a signature, shows the `web3://` link and the QR; `eth_call` reads are an enhancement only
- [ ] chips: `(reported & bit) !== 0` → the fact (zero included); else `absent & bit` → "not deployed on this chain", else "could not be read at block N"; a `null` sub-object is "not reported", never `0`; the Elsewhere tab is hidden when `router` is zero
- [ ] the social composer appears only with `HOLD|ACCOUNT`; a renter (`USE`) sees the walk and the sentence; `Parley.keyOf(to)` re-read before every whisper and passed as `expectedKeyId`
- [ ] the Identity screen prints the Active/Paused rule; the Vault sell checklist (what survives / what is revoked, DESIGN §2) renders before any `transferFrom` the page proposes
- [ ] errors decoded by `S.err[selector]`; unknown selectors printed as hex; the seven duplicate names of §1.7 are expected
- [ ] in the harness, every `eth_call`/`eth_estimateGas` shim runs under `journal.checkpoint()/revert()` (§2.1) — a write estimated without it has already happened
- [ ] gas assertions in verify-site are taken cold — a transaction between measurements — for `tokenURI` (≤ 8 M) **and** `/token/<id>/hash` (≤ 2.5 M), with the shell's gzip size printed beside them (§4.3)

**Things no tool catches today but the rules still forbid** (the regexes are narrow): `insertAdjacentHTML`, `outerHTML =`, `DOMParser`/`createContextualFragment`, `srcdoc`, `javascript:` URLs, `setTimeout("…")`, `import()` of a `blob:`/`data:` module (would need `script-src` to allow it — it does, via `blob:` — but bypasses the hash check unless the shell does it), `localStorage` writes of anything but the picker's `rdns` convenience (wrapped in try/catch), `Number(hexWord)` on a 256-bit word.

---

## Appendix A — `sel` keys → signatures (from `/services.json`, 150 rows; `kind` ∈ payable/write/read, `via` ∈ direct/acts/reach)

```
hub.mint                     0x6a627842 payable direct  mint(address)                       value is price() exactly; id from the Transfer log
hub.transferFrom             0x23b872dd write   direct  transferFrom(address,address,uint256)
hub.safeTransferFrom         0x42842e0e write   direct  safeTransferFrom(address,address,uint256)
hub.approve                  0x095ea7b3 write   direct  approve(address,uint256)
hub.setApprovalForAll        0xa22cb465 write   direct  setApprovalForAll(address,bool)
hub.setApprovalForAllUntil   0xa2694771 write   direct  setApprovalForAllUntil(address,uint64)
hub.revokeAllApprovals       0x250793d4 write   direct  revokeAllApprovals()                one write drops every operator
hub.sealTransfer             0x4deb4124 write   direct  sealTransfer(uint256,uint64)        ratchet, 365 d
hub.panic                    0x72f40a6b write   direct  panic(uint256)                      holder or guardian
hub.release                  0x37bdc99b write   direct  release(uint256)
hub.setUser                  0xe030565e write   direct  setUser(uint256,address,uint64)
hub.setGuardian              0xc02f5582 write   direct  setGuardian(uint256,address)
hub.setStatus                0xd896dd64 write   acts    setStatus(uint256,uint8)            sessions act only while Active
hub.pause                    0x136439dd write   direct  pause(uint256)
hub.proposeAgentWallet       0xb29b961f write   direct  proposeAgentWallet(uint256,address)
hub.acceptAgentWallet        0xed994da0 write   direct  acceptAgentWallet(uint256)          sent by the wallet itself
hub.setFeesToGrip            0xddef9afe write   direct  setFeesToGrip(uint256,bool)
hub.setTrait                 0x2bf453e3 write   direct  setTrait(uint256,bytes32,bytes32)   curve or name
hub.pinTokenURI              0x7de19c5f write   direct  pinTokenURI(uint256,uint256)
hub.unpinTokenURI            0x52dbd6da write   direct  unpinTokenURI(uint256)
hub.rightsOf                 0x85ee2281 read    direct  rightsOf(uint256,address)
hub.ownerOf                  0x6352211e read    direct  ownerOf(uint256)
hub.custodyEpoch             0xc335fc00 read    direct  custodyEpoch(uint256)               re-read before every send
hub.statusOf                 0xad35efd4 read    direct  statusOf(uint256)
hub.coreOf                   0xabce47e2 read    direct  coreOf(uint256)
hub.getStateFingerprint      0xf5112315 read    direct  getStateFingerprint(uint256)
hub.feeSink                  0x7ea50e51 read    direct  feeSink(uint256)
hub.account                  0x2dd7c658 read    direct  account(uint256)
hub.grip                     0x064677cd read    direct  grip(uint256)
hub.price                    0xa035b1fe read    direct  price()
hub.tokenURIAt               0xcdbcbda4 read    direct  tokenURIAt(uint256,uint8)
hub.getTraitValue            0xa28eec87 read    direct  getTraitValue(uint256,bytes32)
hub.isCanonicalAccount       0x0e77fc33 read    direct  isCanonicalAccount(address,uint256,bool)
pool.openMarket              0xec26c25c write   acts    openMarket(uint256,address,address,uint16,uint24,uint16,uint32)   sniper fee set here only
pool.deposit                 0x00aeef8a payable acts    deposit(uint256,uint256,uint256)
pool.withdraw                0xd331bef7 write   acts    withdraw(uint256,uint256,uint256,address)   never pausable
pool.closeMarket             0xae418095 write   acts    closeMarket(uint256)
pool.swapExactIn             0x1200d3e7 payable direct  swapExactIn(uint256,bool,uint256,uint256,address,uint64)
pool.swapExactOut            0x4bea7199 payable direct  swapExactOut(uint256,bool,uint256,uint256,address,uint64)
pool.quote                   0x124d6efc read    direct  quote(uint256,bool,uint256)
pool.quoteExactOut           0x09283e21 read    direct  quoteExactOut(uint256,bool,uint256)
pool.syncCurve               0x14038297 write   acts    syncCurve(uint256,uint24,uint24)   refused under seal (CurveMoved)
pool.setFee                  0xbaf41dc9 write   acts    setFee(uint256,uint16)
pool.sealMarket              0xaf0a38d5 write   acts    sealMarket(uint256,uint64)         ratchet, 365 d
pool.collect                 0xce3f865f write   direct  collect(uint256)                   anyone; pays feeSink(beneficiary)
pool.writeDown               0x3f431477 write   acts    writeDown(uint256)
pool.marketOf                0xeee97751 read    direct  marketOf(uint256)
pool.spot                    0x66061165 read    direct  spot(uint256)
pool.openIds                 0xc3f95de6 read    direct  openIds(uint256,uint256)
pool.sealedIds               0xd052c48b read    direct  sealedIds(uint256,uint256)
pool.marketHash              0xdc582aa2 read    direct  marketHash(uint256)
reach.execute                0x51945447 payable direct  execute(address,uint256,bytes,uint8)   operation 0 only
reach.executeBatch           0x34fcd5be payable direct  executeBatch((address,uint256,bytes)[])
reach.executeTyped           0xf570902c write   direct  executeTyped((address,uint256,bytes,(address,uint256)[],(address,uint256)[],uint64))
reach.seal                   0x0368d8b2 write   direct  seal(uint64)                        ratchet, 365 d
reach.sealMax                0x8257c5ff write   direct  sealMax()
reach.guard                  0xc70f5754 write   direct  guard(address)
reach.unguard                0x0d2db89b write   direct  unguard(address)
reach.grantSession           0x5fece29d write   direct  grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)
reach.grantRecipe            0x0358fbdd write   direct  grantRecipe(address,uint64,address,bytes32,uint256,uint32,uint32)
reach.revokeSession          0x1fa5d6a4 write   direct  revokeSession(address)
reach.revokeAllSessions      0xeba3220c write   direct  revokeAllSessions()
reach.executeAsSession       0x62d2e9b2 write   direct  executeAsSession(address,uint256,bytes)   the key's path
reach.sessionAllows          0xc9edaf21 read    direct  sessionAllows(address,address,bytes4)     check before act
reach.sessionOf              0x003d3534 read    direct  sessionOf(address)
reach.sessionExposure        0x04f4f614 read    direct  sessionExposure(address)
reach.revokeOpenApprovals    0x3dc0e109 write   direct  revokeOpenApprovals()
reach.openApprovals          0x74b75bcf read    direct  openApprovals()
reach.holdings               0xe79bf13b read    direct  holdings()
reach.manifest               0xf5baf0d7 read    direct  manifest()
reach.sealedUntil            0x35311a8e read    direct  sealedUntil()
reach.state                  0xc19d93fb read    direct  state()
reach.attestationDigest      0xeffda535 read    direct  attestationDigest(string,bytes32,uint64)
parley.speak                 0x41e0f8ba write   acts    speak(uint256,uint256,uint8,uint64,uint64,bytes)
parley.whisper               0x26de1f79 write   acts    whisper(uint256,uint256,uint8,bytes32,bytes)   re-read keyOf before every send
parley.whisperStamped        0x086371f9 payable acts    whisperStamped(uint256,uint256,uint8,bytes32,bytes,address,uint128)
parley.found                 0x7eaa1a59 write   acts    found(uint256,string,bool)
parley.join                  0x79e66b46 write   acts    join(uint256,uint256)               follow = join of the home room
parley.leave                 0xe02ae075 write   acts    leave(uint256,uint256)
parley.invite                0xf318cc4a write   acts    invite(uint256,uint256,uint256)
parley.bindKey               0x5006814a write   direct  bindKey(uint256)
parley.keyOf                 0x7b3a1347 read    direct  keyOf(uint256)
parley.stateOf               0x131a7e24 read    direct  stateOf(uint256)
parley.heads                 0x84902826 read    direct  heads(uint256[])
parley.roomsOf               0x49a605eb read    direct  roomsOf(uint256)
roster.membersOf             0xc4c30bdd read    direct  membersOf(uint256,uint256)         followers are the home room's members
postage.configureInbox       0x8f6c2d25 write   direct  configureInbox(uint256,address,uint128,uint64,bool)   stale after sale
postage.inboxOf              0x20aaef0d read    direct  inboxOf(uint256)
postage.expire               0xbf81bf43 write   direct  expire(uint256)
postage.claimRefund          0x5b7baf64 write   direct  claimRefund(uint256)
postage.claimSettled         0xda1ae6ce write   direct  claimSettled(uint256,address)
postage.owed                 0x28079e4a read    direct  owed(address,address)
postage.pendingOf            0x7e7feaa7 read    direct  pendingOf(uint256)
keys.setEncryptionKey        0x300a1ce4 write   direct  setEncryptionKey(uint16,bytes)
keys.getPublicKeys           0x5fcbb7d6 read    direct  getPublicKeys(address)
keys.keyIdOf                 0x9e90f0fa read    direct  keyIdOf(address)
kiln.launch                  0x8f365bce write   acts    launch(uint256,string,string,uint8,uint256,bytes32,uint256)   first launch: holder or guardian
kiln.coinAt                  0x24137cdd read    direct  coinAt(uint256,address,string,string,uint8,uint256,bytes32,uint256)
kiln.recordsOf               0xe3acd07d read    direct  recordsOf(uint256)
kiln.recent                  0x8528fb56 read    direct  recent(uint256,uint256)
launchpad.create             0xcced5683 write   acts    create((uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8))
launchpad.createChecked      0xe3c923d2 write   acts    createChecked((…same tuple…),bytes32)   pins the terms the page showed
launchpad.approveFirstLaunch 0xae02a5b9 write   direct  approveFirstLaunch(uint256)         the guardian
launchpad.buy                0x9edba388 payable direct  buy(uint256,uint256,uint64,uint16)
launchpad.sell               0x905b502b write   direct  sell(uint256,uint256,uint256,uint64)
launchpad.graduate           0xf776449a write   direct  graduate(uint256)                   anyone
launchpad.fail               0x132e4f3c write   direct  fail(uint256)                       anyone, after the deadline
launchpad.refund             0x7ad226dc write   direct  refund(uint256,address)
launchpad.claim              0xddd5e1b2 write   direct  claim(uint256,address)
launchpad.launchOf           0x03e2fa0e read    direct  launchOf(uint256)
launchpad.launchesOf         0xcd349d6b read    direct  launchesOf(uint256)
launchpad.quoteBuy           0xf998a865 read    direct  quoteBuy(uint256,uint256)
launchpad.quoteSell          0x0277dd67 read    direct  quoteSell(uint256,uint256)
launchpad.snipeTaxBps        0xe0bc04e3 read    direct  snipeTaxBps(uint256)
launchpad.creditOf           0x141ab415 read    direct  creditOf(uint256,address)
launchpad.termsHash          0xd49b00af read    direct  termsHash((…same tuple…))
coin.contribute              0xd7bb99ba payable direct  contribute()                        raises every holder's floor
coin.redeem                  0xdb006a75 write   direct  redeem(uint256)
coin.floorPerToken           0x046b18fc read    direct  floorPerToken()
locks.lock                   0xe51b0e8e payable direct  lock(address,uint112,address,uint64,uint64,uint64,bool)   beneficiary defaults to the Reach
locks.release                0x37bdc99b write   direct  release(uint256)                    anyone
locks.extend                 0xe3f08c1d write   direct  extend(uint256,uint64)
locks.give                   0xfcafcc68 write   direct  give(uint256,address)               only into a canonical Reach
locks.lockOf                 0x632a4861 read    direct  lockOf(uint256)
locks.releasable             0xe4bf01a8 read    direct  releasable(uint256)
locks.lockCountOf            0x15e7c79d read    direct  lockCountOf(address)
locks.lockIdOf               0x61ed62f1 read    direct  lockIdOf(address,uint256)
steward.arrange              0x23f81ef4 write   direct  arrange(uint256,bytes32,uint64,uint64,address[],uint8)
steward.stillHere            0x98c638f0 write   direct  stillHere(uint256)
steward.stillHereUnderDuress 0x96c879af write   direct  stillHereUnderDuress(uint256)
steward.cancel               0x40e58ee5 write   direct  cancel(uint256)
steward.summon               0x2fe1de67 write   direct  summon(uint256,address,bytes32)      anyone with the heir's preimage
steward.attest               0x6b952241 write   direct  attest(uint256,address,uint32)       a named guardian
steward.execute              0xfe0d94c1 write   direct  execute(uint256)                     anyone, once due
steward.wouldPass            0x281ca2c6 read    direct  wouldPass(uint256)
steward.getWill              0x4192bbb0 read    direct  getWill(uint256)
steward.getObit              0xf5f0d22a read    direct  getObit(uint256)
steward.heirHashOf           0xcc490f73 read    direct  heirHashOf(address,bytes32)
router.swap                  0x82dea54c payable reach   swap((uint8,address,address,uint256,uint256,uint64,uint256,bytes,(address,address,uint24,int24,address),uint160))   only a canonical Reach
router.quoteExactIn          0xdd3cb48b read    direct  quoteExactIn((…same tuple…))         reverts QuoteResult(spent,received,sqrtPriceAfter)
router.venues                0x9ea06156 read    direct  venues()
erc20.approve                0x095ea7b3 write   direct  approve(address,uint256)             exact amounts, never unlimited
erc20.allowance              0xdd62ed3e read    direct  allowance(address,address)
erc20.balanceOf              0x70a08231 read    direct  balanceOf(address)
erc20.symbol                 0x95d89b41 read    direct  symbol()
erc20.decimals               0x313ce567 read    direct  decimals()
engine.panel                 0xaa07bd09 read    direct  panel(uint256)                       gzip; keccak the inflated bytes against panels
catalog.state                0x3e4f49e6 read    direct  state(uint256)
catalog.stateOf              0x131a7e24 read    direct  stateOf(uint256)
catalog.services             0x7b2b30e3 read    direct  services()
```

`via`: `direct` = the connected wallet sends to the contract; `acts` = the function checks `holds || msg.sender == account(id)` (the holder may send directly, or the Reach via `execute`); `reach` = only a canonical Reach may call (`Router.swap` goes through `reach.execute`/`executeTyped`). `/services.json` also carries `errors` (= `err`), `topics`, `bands` (`[{"band":1,"chainId":8453,"lo":1,"hi":3072},{"band":0,"chainId":1,"lo":3073,"hi":3584},{"band":2,"chainId":10,"lo":3585,"hi":4096}]`), `routes` (16 templates), `walk` (the indexer-free walk rule, quoted in §1.4) and `door` (`/token/<id>/live?as=<key>`).

## Appendix B — line map of what this report quotes

`tools/evm.mjs`: coder 84-236; `Chain` 239-441 (`open` 261-275, `as` 290-296, `send` 310-354, `_record` 368-382, `getLogs` 384-402, `deploy` 404-408, `call` 411-427, `read` 429-431, `exec` 433-435); `roll`/`warp` 52-64; `TX_GAS_CAP` 42.
`tools/site.mjs`: constants 27-45; `predictCreate` 48-50; `encRequest`/`decResponse`/`getter` 56-86; `readPlan` 90-94; `deploySite` 100-218; `mint` 222-230.
`tools/verify.mjs`: helpers 31-46; dist reads 50-52; state checks 160-204; drift gate 257-293; equality step 295-318; panels 336-351; artefacts 475-484.
`tools/gas.mjs`: `CAPS` 39-49; `measure` 61-73; route probes 113-148.
`tools/build-app.mjs`: ceilings 50-52; `CSP` 62-64; `PROLOGUE` 69-76; `FORBIDDEN`/`refuse` 82-93; `checkLoader` 98-109; `shrinkShell` 113-137; `shrinkPanel` 139-149; `gasFor` 162; `sources` 164-173; `build` 177-255 (host scan 248-253).
`tools/static-audit.mjs`: `JS_RULES` 46-51; `TARGETS` 55-60; `stripComments` 73-76; `scan` 78-97.
`src/Catalog.sol`: `World`/`H` 113-145; `Templated._fill` 157-186; `_probe` 315-323; `CatalogState` templates 860-911; `token` 930-951; `collection` 955-961; `tail` 964-977; `_market` 992-1007; `_inbox` 1009-1014; `_room` 1017-1023; `_key` 1027-1034; `open` 1070-1088; `venues` 1093-1108; `Catalog` bits 1199-1206; `stateOf` 1303-1349; `state` 1364-1371; `knownDelegates` 1426-1432; `verbWord` 1435-1444.
`src/Renderer.sol`: `INFLATE` 76-84; `document` 113-120; `_face0` 135-141; `_attributes` 187-204; `_clock` 207-211.
`src/Premises.sol`: `request` 118-217 (panel route 141-157); `_token` 220-291; `manifest` 300-345; `_moved` 368-382; `_notFound` 385-394; `_toUint` 426-439; `_toAddr` 441-456.
`src/interfaces/Site.sol`: `TokenState` 25-48; `IEngine` 50-63; `IRenderer` 65-79; `ICatalog` 86-99; `IPremises` 101-110.
