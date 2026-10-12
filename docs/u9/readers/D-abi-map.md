<!-- Reader report from the U9 understand phase (2026-10-08): what the donors contain, measured against their git refs, and what INTACT keeps or drops. Working document; docs/CONSOLE.md and docs/u9/DECISIONS.md record what was decided from it. -->

# D — INTACT U9 ABI map: what each panel reads and writes, exactly

Reader report for U9 (BUILD-PLAN.md:96-101), written against the repository at
`/home/user/Special` as of 2026-10-08. Every signature, struct order, selector
and line range below was read from the files named; nothing is paraphrased
from memory. Selectors were recomputed from `src/Catalog.sol`'s `SERVICES`
table with `js-sha3` (scratchpad script `abi-diff.mjs`, read-only) and
agree with what `CatalogRows._renderSelectors` (Catalog.sol:551-576) writes
into `INTACT.sel`.

Sources: `src/interfaces/{IIntact,IPool,IReach,IParley,IPostage,IKeyRegistry,
ILaunchpad,IKiln,ILocks,ISteward,IRouter,IRoles,IMarket,IGrip,Site,Standards}.sol`,
`src/Catalog.sol` (SERVICES 359-517, LETTERS 520, ERRORS 681-724, EVENTS
726-742, templates 860-917, `stateOf` 1303-1350, `state` 1364-1371), the
implementations (`Pool.sol`, `Reach.sol`, `Router.sol`, `Launchpad.sol`,
`Kiln.sol`, `Coin.sol`, `Locks.sol`, `Postage.sol`, `Steward.sol`, `Parley.sol`,
`KeyRegistry.sol`, `hub/{RightsLogic,CoreLogic,SiteLogic,IntactBase,MintLogic}.sol`,
`lib/Rights.sol`), `test/Bundle.t.sol`, `test/helpers/Deploy.sol`,
`DESIGN.md` §1, §2, §5 (lines 17-76, 265-306), §4.4, §6-§9,
`docs/INTERFACE-CHANGES.md`, `tools/verify.mjs:250-296`.

---

## 0. Conventions the panels must follow (the contract this report serves)

**Where addresses, selectors, errors and topics come from.** The state block
`window.INTACT` (Catalog.sol `TPL_WORLD` 860-868, `TPL_TOKEN` 870-877,
`TPL_TAIL` 882-884) carries:

| Key | Meaning | Source |
|---|---|---|
| `INTACT.hub`, `.pool`, `.router`, `.parley`, `.roster`, `.postage`, `.keys`, `.kiln`, `.launchpad`, `.timelock`, `.catalog`, `.premises`, `.engine`, `.renderer`, `.agentCard`, `.reachImpl`, `.gripImpl` | contract addresses (`"0x…"` 40 hex) | TPL_WORLD |
| `INTACT.reach`, `.grip`, `.owner`, `.feeSink`, `.guardian`, `.user`, `.agentWallet`, `.proposedWallet` | this token's addresses | TPL_TOKEN (`stateOf` + `coreOf` + `feeSink`) |
| `INTACT.id`, `.chainId`, `.band`, `.bandLo`, `.bandHi`, `.epoch`, `.status`, `.locked`, `.lockCount`, `.guardianHold`, `.feesToGrip`, `.pinnedFace`, `.launchCount`, `.curve`, `.name`, `.fingerprint`, `.price` (string), `.clocks{sealedUntil,marketSealedUntil,userExpires,transferSealUntil,createdAt}` | facts; numbers are JSON numbers except `price`, `rBase`, `rQuote`, `spot`, `postage`, which are quoted decimal strings — parse with `BigInt(...)` | TPL_TOKEN |
| `INTACT.market` | `{open,sealed,base,quote,baseSymbol,quoteSymbol,baseDecimals,quoteDecimals,rBase,rQuote,feeBps,curveBps,sniperBps,sniperUntil,sealUntil,spot}` or `null` | `_market` 992-1007 |
| `INTACT.inbox` | `{feeToken,postage,replyWindow,open}` or `null` | `_inbox` 1009-1015 |
| `INTACT.home`, `.commons` | `{room,last,count,members,kind,open}` or `null` | `_room` 1017-1025 |
| `INTACT.key` | `{type,id}` (the token's bound key: `keyType`, `keyId`) or `null` | `_key` 1027-1035 |
| `INTACT.launches` | `uint256[]` of launch ids or `null` | `_ids(launchesOf)` |
| `INTACT.locks` | **a number**: `Locks.lockCountOf(reach)` — see §6, this key shadows the Locks *address* | `_word(lockCountOf)` |
| `INTACT.steward` | **a number**: `Steward.wouldPass(id)` — shadows the Steward *address* | `_word(wouldPass)` |
| `INTACT.roles` | a number (`liveRoleCount`) or `null` — shadows the Roles address | `_word` |
| `INTACT.holderKeyId` | `"0x…"` 32 bytes, `KeyRegistry.keyIdOf(owner)`, or `null` | `_hash` |
| `INTACT.reported`, `.absent` | bit masks; `INTACT.bits` names them: reach 1, pool 2, parley 4, postage 8, locks 16, launchpad 32, steward 64, router 128, market 256, roles 512, keys 1024, agentcard 4096 (2048 reserved for Nameplate, never set) | `stateOf` |
| `INTACT.rights` | `{HOLD:1,ACCOUNT:2,USE:4,CUSTODY:8,ROLE:16,DELEGATE:32,GUARDIAN:64,SESSION:128}` | TPL_WORLD, `lib/Rights.sol:35-42` |
| `INTACT.sel` | `{"hub.mint":"0x6a627842",…}` — **the only calls a panel may make**, keyed `<contract word>.<row name>` | `CatalogRows.selectors()` |
| `INTACT.err` | `{"0x7623fb52":"NotHolder",…}` 211 entries (selector → error *name*; the argument types are in §1's tables and in `/services.json` `errors`) | `CatalogText.errors()` |
| `INTACT.topics` | `{"said":"0x30e4…",…}` 23 entries (name → topic0) | `CatalogText.topics()` |
| `INTACT.panels` | `{swap,social,launch,vault,identity,agent}` → keccak of the **inflated** panel bytes | `Engine.panelHash(i)`, panel order = `verbWord(2..7)` (Catalog.sol:1435-1444) |
| `INTACT.engineHash`, `.catalogHash`, `.block`, `.time` | | TPL_TAIL |

Contract words (Catalog.sol:645-662): `H`→`hub`, `P`→`pool`, `R`→`reach`,
`Y`→`parley`, `T`→`roster`, `S`→`postage`, `K`→`keys`, `N`→`kiln`,
`L`→`launchpad`, `C`→`coin`, `O`→`locks`, `W`→`steward`, `X`→`router`,
`E`→`erc20`, `G`→`engine`, `Q`→`catalog`. The `reach`, `coin` and `erc20`
rows carry `contract: 0x0` in `/services.json` (CatalogRows constructor
comment, 347-350): the panel supplies `INTACT.reach`, the launch's coin, or
the market's `base`/`quote` as the `to` address.

**Call shape.** `data = sel ‖ head ‖ tail` per the Solidity ABI:
- every static argument is one 32-byte word: `uintN`/`enum`/`bool` (0/1)
  right-aligned (`BigInt` → 64 hex chars, zero-padded left), `address`
  right-aligned (12 zero bytes then 20), `bytesN` left-aligned (`bytes32` as
  is, `bytes4` selector followed by 28 zero bytes);
- a dynamic argument (`bytes`, `string`, any `T[]`, any tuple that contains
  one) occupies one head word holding the **byte offset of its tail from the
  start of the head** (not from the selector); its tail is `length` (one
  word) then the elements — for `bytes`/`string` the raw bytes padded to a
  multiple of 32, for `T[]` of static `T` one word each (a static tuple
  element is its fields inline), for `T[]` of dynamic `T` the element
  offsets (relative to the start of the elements) then each element;
- a tuple argument that is entirely static (`(address,uint128)`, the
  `PoolKey`, `LaunchParams`) is inlined into the head, one word per field, in
  declaration order; a tuple with a dynamic field (`TypedCall`,
  `SwapRequest`, `Call`) is one offset word in the head and its own
  head+tail in the tail.
- Return data is decoded the same way: a static struct is N words in field
  order; a dynamic return starts with offset words.

**Who is `msg.sender`.** `via` in the row: `d` direct — the connected wallet
sends; `a` *acts* — accepted from the holder's wallet **or** from the token's
Reach (`Rights.acts`, lib/Rights.sol:55-58), so a holder sends directly and an
agent session sends `Reach.executeAsSession`/`executeTyped` with this call as
`data`; `r` reach-only — the wallet can never send it, only
`Reach.execute(to, value, data, 0)` / `executeBatch` / `executeTyped` from the
holder (§4). Strict `holds` writes (`_requireHolds`, IntactBase.sol:178-180;
`Steward._onlyHolder` 129-131; `Postage.configureInbox` 106;
`Parley.bindKey` 537) revert `NotHolder` for the Reach too.

**Rights bits.** `rightsOf(id, actor)` (RightsLogic.sol:45-72) sets HOLD when
`actor == ownerOf`, ACCOUNT when `actor == account(id)` (never a browser
wallet), USE when the live 4907 user, CUSTODY when `getApproved(id) == actor`
or an epoch-keyed operator **and** `!guardianHold`, ROLE from
`Roles.hasRole(id, USER, actor)` (guarded), DELEGATE from delegate.xyz v2
(guarded, viewing right only), GUARDIAN when `guardian == actor`, SESSION
when `Reach.sessionCurrent(actor)` (a hint). The tables below name the bit a
*browser wallet* needs; "holder" means `HOLD`; "acts" means `HOLD` from the
wallet, or any path that ends with the Reach as sender.

**Value.** Rows marked `p` are payable; the exact `msg.value` rule is in each
table — every native leg is checked exactly (`WrongValue`), never ≥.

**Approvals.** Only `erc20.approve(spender, exactAmount)` (0x095ea7b3),
never `type(uint256).max`. The tables say to whom and how much. When the
spender pulls less than approved (only `swapExactOut`), the residue must be
offered for revocation (`approve(spender, 0)`).

**Before every send** (DESIGN §5.4): `eth_chainId == INTACT.chainId`;
`hub.custodyEpoch(id)` re-read and compared to the epoch the screen was
rendered from; `eth_estimateGas` with the exact calldata and value, its
revert data's first 4 bytes looked up in `INTACT.err`.

---

## 1. The shell's own calls (Home, the gate, the slab, the panel loader)

| Purpose | sel key | Signature (selector) | Args | Returns |
|---|---|---|---|---|
| rights gate, and again on `accountsChanged`/`chainChanged` | `hub.rightsOf` | `rightsOf(uint256,address)` 0x85ee2281 | `id`, `account` | 3 words: `uint16 bits`, `uint64 epoch`, `address holder` |
| re-read before every send | `hub.custodyEpoch` | `custodyEpoch(uint256)` 0xc335fc00 | `id` | 1 word `uint64` |
| Home facts refresh | `hub.coreOf` | `coreOf(uint256)` 0xabce47e2 | `id` | 16 words (§3.1) |
| status chip | `hub.statusOf` | `statusOf(uint256)` 0xad35efd4 | `id` | 1 word: 0 Active, 1 Paused |
| fingerprint "verified against chain at block N" | `hub.getStateFingerprint` | `getStateFingerprint(uint256)` 0xf5112315 | `id` | 1 word `bytes32`; reverts `NoSuchToken` |
| panel loader (data: viewer with a provider) | `engine.panel` | `panel(uint256)` 0xaa07bd09 | `i` = 0 swap, 1 social, 2 launch, 3 vault, 4 identity, 5 agent | `bytes` gzip: word0 offset 0x20, word1 length, then bytes. Inflate with `DecompressionStream("gzip")`, keccak the inflated bytes, compare to `INTACT.panels[name]`, then Blob-inject. Reverts `BadPanel()` for `i ≥ 6`. On the live origin the same bytes are `GET /panel/<name>.js` (Premises.sol:141-156; `Content-Encoding: gzip`, `ETag` = the same keccak) |
| fresh state block (optional refresh) | `catalog.state` | `state(uint256)` 0x3e4f49e6 | `id` | `bytes` JSON (offset, length, data); valid JSON, every key quoted |
| typed state (optional) | `catalog.stateOf` | `stateOf(uint256)` 0x131a7e24 | `id` | 15 words = `TokenState` (Site.sol:25-48): `id, owner, reach, grip, epoch(u64), status(u8), sealedUntil, marketSealedUntil, userExpires, transferSealUntil, locked(bool), marketOpen(bool), fingerprint, reported(u32), absent(u32)`. Same selector as `parley.stateOf` — the key, not the selector, disambiguates |
| the catalogue (agent stub) | `catalog.services` | `services()` 0x7b2b30e3 | — | `bytes` JSON |

The shell never calls `eth_requestAccounts` on an opaque origin
(`localStorage` throws there, DESIGN §5.1). The viewer may still `eth_call`
every read above.

---

## 2. Per-panel tables

Columns: UI action → `sel` key → full signature (selector) → argument
encoding → `msg.value` → who may call (`via`; wallet bits) → custom errors to
decode → events (name in `INTACT.topics` where one exists; "—" = no topic row,
see §6).

### 2.1 Swap panel (`#swap`)

Market key: an owned market's key is the token `id`; a sealed market's key is
`Pool.sealedKey(launchKey) = uint256(keccak256(abi.encodePacked("intact.sealed", launchKey)))`
(Pool.sol:618-620) with `launchKey = keccak256(abi.encode(LAUNCHPAD, launchId))`
(Launchpad.sol:628-630) — the panel never computes it: `Launch.marketKey`
(word 19 of `launchOf`) carries it after graduation. `base == 0x0` or
`quote == 0x0` means native ETH on that side (IPool.sol:16). Amounts are
wei / base units of the ERC-20, `BigInt` throughout. `spot` is base-in-quote
scaled by 1e18, display only (Pool.sol:637-640).

| UI action | sel key | Signature | Args | Value | Caller | Errors | Events |
|---|---|---|---|---|---|---|---|
| Open your market | `pool.openMarket` | `openMarket(uint256,address,address,uint16,uint24,uint16,uint32)` 0xec26c25c | `id`; `base`; `quote` (0x0 = ETH); `feeBps ≤ 500`; `curveBps ≤ 80000`; `sniperBps ≤ MAX_SNIPER_BPS`; `sniperSeconds ≤ MAX_SNIPER_SECONDS` (the sniper fee is armed here and nowhere else, Pool.sol:255-262) | 0 | `a`: HOLD, or through the Reach | `NotActor`, `MarketAlreadyOpen`, `SameToken`, `FeeTooHigh`, `CurveTooSteep`, `SniperTooHigh`, `MarketNotEmpty`, `Reentrancy` | `marketOpened` = `MarketOpened(uint256 indexed id, address base, address quote, uint16 feeBps, uint24 curveBps)`; `CurveAnchored` (—) |
| Deposit | `pool.deposit` | `deposit(uint256,uint256,uint256)` 0x00aeef8a | `id`; `amountBase`; `amountQuote` (either may be 0, not both) | exactly the native leg: `amountBase` if `base == 0x0`, else `amountQuote` if `quote == 0x0`, else 0 (Pool.sol:318-319) | `a` | `MarketNotOpen`, `SealedMarket`, `NotActor`, `ZeroAmount`, `WrongValue`, `TransferFailed`, `ReserveOverflow`, `Reentrancy` | `Deposited` (—), `CurveAnchored` (—) |
| → approval step before Deposit (each ERC-20 leg) | `erc20.approve` | `approve(address,uint256)` 0x095ea7b3 | `to` = the ERC-20 (`market.base` / `market.quote`); args `spender = INTACT.pool`, `amount` = exactly that leg (Pool pulls `transferFrom(msg.sender, pool, amount)` and measures arrival, Pool.sol:749-759) | 0 | the wallet that will send `deposit` (when the Reach deposits, the Reach approves: §4.3) | ERC-20's own | `Approval` (—) |
| Withdraw | `pool.withdraw` | `withdraw(uint256,uint256,uint256,address)` 0xd331bef7 | `id`; `amountBase`; `amountQuote`; `to ≠ 0x0` | 0 | `a`; never pausable | `MarketNotOpen`, `SealedMarket`, `NotActor`, `Sealed(uint64 until)`, `TransferFailed` (to == 0), `ZeroAmount`, `Insolvent`, `Reentrancy` | `Withdrawn(uint256 indexed id, uint256 amountBase, uint256 amountQuote, address to)` (—) |
| Close market (both reserves zero) | `pool.closeMarket` | `closeMarket(uint256)` 0xae418095 | `id` | 0 | `a` | `MarketNotOpen`, `SealedMarket`, `NotActor`, `Sealed(uint64)`, `MarketNotEmpty` | `MarketClosed` (—) |
| Swap, exact in (owned or sealed market) | `pool.swapExactIn` | `swapExactIn(uint256,bool,uint256,uint256,address,uint64)` 0x1200d3e7 | `key`; `baseIn` (true = sell base for quote); `amountIn`; `minOut` (the floor, stated in words — "at least X reaches `to`"; computed from `pool.quote` minus the user's tolerance); `to` (the wallet, ≠ 0x0); `deadline` (unix seconds) | exactly `amountIn` if `tokenIn == 0x0` else 0 (Pool.sol:434) | `d`: anyone, no bits | `Expired`, `MarketNotOpen`, `ZeroAmount`, `TransferFailed`, `WrongValue`, `TradeTooLarge`, `Slippage(uint256 got, uint256 wanted)`, `Insolvent`, `ReserveOverflow`, `Reentrancy` | `swapped` = `Swapped(uint256 indexed key, address indexed trader, bool baseIn, uint256 amountIn, uint256 amountOut, uint256 fee)` |
| → approval step (ERC-20 input) | `erc20.approve` | 0x095ea7b3 | `to` = `tokenIn`; `spender = INTACT.pool`; `amount = amountIn` exactly | 0 | the trader | | |
| Swap, exact out | `pool.swapExactOut` | `swapExactOut(uint256,bool,uint256,uint256,address,uint64)` 0x4bea7199 | `key`; `baseIn`; `amountOut`; `maxIn`; `to`; `deadline`. Native input: `maxIn` is sent and the unspent part returned in the same call (Pool.sol:457-459, 493). ERC-20 input: exactly `inUsed ≤ maxIn` is pulled | exactly `maxIn` if `tokenIn == 0x0` else 0 (Pool.sol:473) | `d` | as above plus `Slippage(inUsed, maxIn)` when the curve asks more than `maxIn` | `swapped` |
| → approval step (ERC-20 input) | `erc20.approve` | | `amount = maxIn`. **Exactness caveat:** the pull is `inUsed ≤ maxIn`; set `maxIn` to `pool.quoteExactOut` re-read in the same slab so a steady price leaves allowance 0, and when the price moved in the trader's favour read `erc20.allowance(trader, pool)` after the receipt and offer `approve(pool, 0)`. Or prefer `swapExactIn` | | | | |
| Set fee | `pool.setFee` | `setFee(uint256,uint16)` 0xbaf41dc9 | `id`; `feeBps ≤ 500` | 0 | `a` | `FeeTooHigh`, `MarketNotOpen`, `SealedMarket`, `NotActor`, `Sealed(uint64)` | `FeeSet` (—) |
| Apply the curve trait | `pool.syncCurve` | `syncCurve(uint256,uint24,uint24)` 0x14038297 | `id`; `curveBps` = `INTACT.curve` (the holder's trait, `coreOf` word 14 low 17 bits); `expected` = `INTACT.market.curveBps` as the screen showed it | 0 | `a`; refused under seal | `CurveMoved`, `CurveTooSteep`, `Sealed(uint64)`, `MarketNotOpen`, `SealedMarket`, `NotActor` | `CurveSynced` (—), `CurveAnchored` (—) |
| Seal the market (ratchet) | `pool.sealMarket` | `sealMarket(uint256,uint64)` 0xaf0a38d5 | `id`; `until` > current `sealUntil`, > now, ≤ now + 365 d (`Ratchet.raise`, Pool.sol:309) | 0 | `a` | `RatchetOnly`, `TooLong`, `MarketNotOpen`, `SealedMarket`, `NotActor` | `MarketSealed` (—) |
| Write down after a rebase | `pool.writeDown` | `writeDown(uint256)` 0x3f431477 | `id` | 0 | `a` | `ZeroAmount` (nothing to write down), `MarketNotOpen`, `SealedMarket`, `NotActor` | `WrittenDown` (—) |
| Collect a sealed market's fees (Launch › Positions; also here) | `pool.collect` | `collect(uint256)` 0xce3f865f | `key` (sealed market key) | 0 | `d`: anyone; pays `hub.feeSink(beneficiary)` | `MarketNotOpen`, `ZeroAmount` (an owned market owes nothing here), `Insolvent`, `TransferFailed` | `collected` = `Collected(uint256 indexed key, address indexed to, uint256 base, uint256 quote)` |
| Elsewhere: quote by revert | `router.quoteExactIn` | `quoteExactIn((uint8,address,address,uint256,uint256,uint64,uint256,bytes,(address,address,uint24,int24,address),uint160))` 0xdd3cb48b | one `SwapRequest` (§4.1 layout); `eth_call` **always reverts** `QuoteResult(uint256 spent, uint256 received, uint160 sqrtPriceAfter)` 0x5cbe38e7 — decode the revert data; `sqrtPriceAfter == 0` for `Venue.OwnPool` (Router.sol:345-366) | 0 | `d`: anyone | `QuoteResult` (the answer), `ZeroAmount`, `SameToken`, `VenueAbsent(uint8)`, `VenueDrifted(address,bytes32,bytes32)`, `NoQuote(uint8)` (v3 has no quote path; a v4 manager that never called back) | — |
| Elsewhere: swap through the Reach | `router.swap` wrapped in `reach.execute` / `reach.executeBatch` / `reach.executeTyped` | `swap(SwapRequest)` 0x82dea54c, `via r` | §4.1-4.2 | native input: the Reach forwards `amountIn` as the call's `value` (Router.sol:192) | the holder (`NotSigner` otherwise), as the Reach; or a session key via `executeTyped`/`executeAsSession` | `NotReach(address)`, `Expired(uint64)`, `ZeroAmount`, `SameToken`, `WrongValue`, `VenueAbsent`, `VenueDrifted`, `Slippage(uint256 received, uint256 minOut)`, `BadPath`, `HookedKey(address)`, `BadPriceLimit`, `InexactERC20Transfer`, `AllowanceStuck`, plus the Reach's own (§4) | Router `Swapped(address indexed reach, uint8 venue, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)` (— no topic row; **not** the Pool's `swapped`) |
| Venue manifest | `router.venues` | `venues()` 0x9ea06156 | — | 0 | read | — | — |
| Directory | HTTP `/open` on the live origin (Catalog `open(uint256)` has no `sel` row) | | | | | | |

Reads the panel needs: `pool.marketOf`, `pool.quote`, `pool.quoteExactOut`,
`pool.spot`, `pool.openIds`, `pool.sealedIds`, `pool.marketHash`,
`erc20.balanceOf`, `erc20.allowance`, `erc20.symbol`, `erc20.decimals`,
`router.venues`, `reach.sealedUntil` (hide "Elsewhere" when sealed and the
input is native or a manifest asset — §4.4) — layouts in §3. The Elsewhere
tab is hidden when `INTACT.router == 0x0` or `INTACT.reported & 128 == 0`
(then the chip reads "not deployed on this chain" if `absent & 128`, else
"could not be read at block N").

### 2.2 Social panel (`#social`)

Rooms: commons = `0`; home room of token N = `uint256(keccak256(abi.encodePacked(uint8(3), N)))`
(Parley.sol `homeKey`; `INTACT.home.room` carries this token's); groups
`keccak(1, index)` (`found` returns the key); pairs are derived by `whisper`
(a raw pair key through `speak` reverts `UseWhisper`). `kind`: `PLAIN = 0`
(≤ 1,024 B), `SEALED = 1` (≤ 4,096 B). The composer appears only with
`HOLD|ACCOUNT`; a renter (`USE`) sees the walk and the sentence.

| UI action | sel key | Signature | Args | Value | Caller | Errors | Events |
|---|---|---|---|---|---|---|---|
| Say (commons / home / group), optional reply | `parley.speak` | `speak(uint256,uint256,uint8,uint64,uint64,bytes)` 0x41e0f8ba | `room`; `from` = my id; `kind` 0/1; `reBlock`, `reSeq` (both 0 for none; both non-zero for a reply, `reSeq ≤ count`, Parley.sol:289); `body` (dynamic: head word 5 = offset 0xc0, then length, then bytes). Commons cooldown is 2 blocks per (token, epoch) bucket | 0 | `a` (`mayActAs` = holder or Reach, Parley.sol:198-203); bits HOLD or via Reach | `NotYours`, `NotAMember`, `UseWhisper`, `NoSuchRoom`, `BadReply`, `BadKind`, `BadBody`, `Cooldown(uint64 until)`, `Reentrancy` | `said` = `Said(uint256 indexed room, uint256 indexed from, uint64 prev, uint64 prevFrom, uint64 seq, uint8 kind, uint64 reBlock, uint64 reSeq, bytes body)`; filter `topics: [said, pad32(room)]` on exactly block `stateOf(room).last`, follow `prev` |
| Whisper (DM, free or consented) | `parley.whisper` | `whisper(uint256,uint256,uint8,bytes32,bytes)` 0x26de1f79 | `from`; `to`; `kind`; `expectedKeyId` = `parley.keyOf(to)` word 1 **re-read immediately before encrypting and sending** (0x0 for a PLAIN body); `body` (offset 0xa0) | 0 | `a` | `NotYours`, `TalkingToYourself`, `NoSuchToken`, `NoKey`, `KeyMoved`, `InboxClosed(uint256 token)`, `PostageDue(uint256 to, uint128 postage)` → switch to `whisperStamped`, `BadKind`, `BadBody`, `Cooldown`, `Reentrancy` | `said` (room = `pairKey(min,max)`, `reBlock = reSeq = 0`); `settled` when it answers a pending stamp inside the window (Parley.sol:384-397 → `Postage.settle`) |
| Whisper with postage (first contact to a priced inbox) | `parley.whisperStamped` | `whisperStamped(uint256,uint256,uint8,bytes32,bytes,address,uint128)` 0x086371f9 | `from`; `to`; `kind`; `expectedKeyId`; `body` (offset 0xe0); `expectedFeeToken` = `postage.inboxOf(to)` word 0; `maxPostage` ≥ its word 1 | exactly `inboxOf(to).postage` when `feeToken == 0x0`; 0 when the inbox is free or ERC-20 (Postage.sol:134-150) | `a`. **ERC-20 postage is pulled from `hub.account(from)` — the sender's Reach — never the wallet** (Postage.sol:145-150; INTERFACE-CHANGES "no payer parameter"): the Reach must first hold the fee token and `Reach.execute(feeToken, 0, approve(INTACT.postage, postage), 0)` exactly | the `whisper` set plus `NotParley` (never from a panel), `PostageAboveMax(uint128,uint128)`, `UnexpectedFeeToken(address expected, address actual)`, `StampPending(uint256)`, `WrongValue`, `InexactERC20Transfer` | `said`; `stamped` = `Stamped(uint256 indexed stampId, uint256 indexed pairRoom, uint256 from, uint256 to, address feeToken, uint128 postage, uint64 replyBy)` |
| Found a group | `parley.found` | `found(uint256,string,bool)` 0x7eaa1a59 | `by` = my id; `name` ≤ 48 bytes (offset 0x60); `openDoor` | 0 | `a` | `NotYours`, `BadName` | `founded` = `Founded(uint256 indexed room, uint256 indexed by, uint256 index, bool open, string name)`; `entered` |
| Follow / join | `parley.join` | `join(uint256,uint256)` 0x79e66b46 | `room` (a group key or another token's home key); `token` = my id | 0 | `a` | `NotYours`, `NoSuchRoom` (a home room exists only after its steward's first word — render "this token has not spoken yet"), `AlreadyIn`, `NotInvited` | `entered` = `Entered(uint256 indexed room, uint256 indexed token)` |
| Unfollow / leave | `parley.leave` | `leave(uint256,uint256)` 0xe02ae075 | `room`; `token` | 0 | `a` | `NotYours`, `NotAMember` | `Departed(uint256 indexed room, uint256 indexed token)` (— no topic row; `Parley.topics()` has it) |
| Invite (group steward) | `parley.invite` | `invite(uint256,uint256,uint256)` 0xf318cc4a | `room`; `by` = my id (the steward); `token` | 0 | `a` | `NotYours`, `NotTheSteward`, `NoSuchToken` | `Invited(uint256 indexed room, uint256 indexed token, uint256 by)` (—) |
| Bind my encryption key to the token | `parley.bindKey` | `bindKey(uint256)` 0x5006814a | `token` | 0 | `d`: HOLD strictly (Parley.sol:535-545); the key must already be in `keys` for `msg.sender` | `NotHolder`, `NoKey` | `keyBound` = `KeyBound(uint256 indexed token, address indexed owner, uint64 epoch, uint16 keyType, bytes32 keyId)` |
| Publish my key | `keys.setEncryptionKey` | `setEncryptionKey(uint16,bytes)` 0x300a1ce4 | `keyType` 1 X25519 / 2 secp256k1-ECIES / 3 P-256-ECIES / 5 MLS (4 reserved); `publicKey` (offset 0x40) — the social panel derives a P-256 key via `personal_sign("INTACT seal v1 · chain <c> · token <t> · epoch <e>")` and `engine/whispers.mjs` | 0 | `d`: the wallet for itself (address-keyed) | `EmptyKey`, `BadKeyType` | `EncryptionKeyRegistered(address indexed account, bytes32 indexed keyId, uint16 keyType)` (—) |
| Price my inbox | `postage.configureInbox` | `configureInbox(uint256,address,uint128,uint64,bool)` 0x8f6c2d25 | `token`; `feeToken` (0x0 native); `postage`; `replyWindow` 5 min..30 d (`MIN/MAX_REPLY_WINDOW`); `open` | 0 | `d`: HOLD strictly (Postage.sol:106); stale after sale | `NotHolder`, `BadReplyWindow(uint64)` | `InboxConfigured(uint256 indexed token, uint64 epoch, address feeToken, uint128 postage, uint64 replyWindow, bool open)` (—) |
| Expire an unanswered stamp (sender side) | `postage.expire` | `expire(uint256)` 0xbf81bf43 | `stampId` | 0 | `d`: anyone after `replyBy` | `NoSuchStamp(uint256)`, `AlreadySettled(uint256)`, `AlreadyRefunded(uint256)`, `ReplyWindowOpen(uint64 replyBy)` | `Expired(uint256 indexed stampId)` (—) |
| Pull my refund | `postage.claimRefund` | `claimRefund(uint256)` 0x5b7baf64 | `stampId` | 0 | `d`: anyone; pays the stamp's `sender` = the sending token's **Reach** | `NoSuchStamp`, `AlreadySettled`, `StampPending(uint256)` (not expired yet), `NothingOwed`, `TransferFailed` | `Refunded(uint256 indexed stampId, address indexed to, address feeToken, uint128 amount)` (—), `Claimed` (—) |
| Pull what my inbox earned | `postage.claimSettled` | `claimSettled(uint256,address)` 0xda1ae6ce | `token`; `feeToken` | 0 | `d`: anyone; pays `hub.feeSink(token)` | `NothingOwed`, `TransferFailed`, `Reentrancy` | `Claimed(address indexed payee, address feeToken, uint256 amount)` (—) |
| Reactions | ERC-7409 singleton `0x3110735F0b8e71455bAe1356a33e428843bCb9A1` `emote(address,uint256,string,bool)` — **no `sel` row, no letter** (DESIGN §7.5); check `eth_getCode` first; see §6 | | | | | | |

Reads: `parley.stateOf`, `parley.heads` (head **blocks**, not counts),
`parley.keyOf`, `parley.roomsOf`, `roster.membersOf` (followers = members of
my home room, 256 ids per window), `postage.inboxOf`, `postage.pendingOf`,
`postage.owed`, `keys.getPublicKeys`, `keys.keyIdOf` — §3.

### 2.3 Launch panel (`#launch`)

| UI action | sel key | Signature | Args | Value | Caller | Errors | Events |
|---|---|---|---|---|---|---|---|
| Preview the coin address | `kiln.coinAt` | `coinAt(uint256,address,string,string,uint8,uint256,bytes32,uint256)` 0x24137cdd | `id`; `by` = **the address that will send `launch`** (the salt is `keccak256(abi.encode(msg.sender, salt))`, Kiln.sol:136 — the wallet when direct, `INTACT.reach` when through the Reach); `name_` (offset); `symbol_` (offset); `decimals_ ≤ 36`; `supply`; `salt`; `raiseShare` | 0 | read | — | — |
| Coin (instant) | `kiln.launch` | `launch(uint256,string,string,uint8,uint256,bytes32,uint256)` 0x8f365bce | `id`; `name_` (head word 1 = offset); `symbol_` (offset); `decimals_`; `supply > 0`; `salt`; `raiseShare ≤ supply` (0 for a plain coin; the raise share is minted straight to the Launchpad, the rest to `account(id)`) | 0 | `a`; **a token's first launch needs HOLD** or, from the Reach, the guardian's epoch-stamped `approveFirstLaunch` (Launchpad.sol:181-186); 7-day spacing per token | `NotActor`, `NothingToLaunch`, `ShareTooLarge`, `BadDecimals`, `BadName` (ASCII label), `DeployFailed`, `NotKiln` (never from a panel), `FirstLaunchNeedsHolderOrGuardian(uint256 id)`, `TooSoon(uint64 until)`, `Reentrancy` | `launched` = `Launched(address indexed coin, uint256 indexed id, address indexed by, string symbol, uint256 supply, uint256 raiseShare)` |
| Guardian co-signs a first agent launch | `launchpad.approveFirstLaunch` | `approveFirstLaunch(uint256)` 0xae02a5b9 | `id` | 0 | `d`: GUARDIAN | `NotGuardian` | `FirstLaunchApproved(uint256 indexed id, address indexed guardian, uint64 epoch)` (—) |
| Raise (create) | `launchpad.createChecked` (preferred: pins the terms the page showed) / `launchpad.create` | `createChecked((uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8),bytes32)` 0xe3c923d2; `create((…14 fields…))` 0xcced5683 | `LaunchParams` is **static** → 14 head words in order: `id, coin, curveSupply, virtualQuote, graduationTarget, startsAt (0 = now), fairWindow ≤ 1 d, maxBuyInWindow, snipeTaxStartBps ≤ 9900, feeBps ≤ 100, creatorBps ≤ 1500, creatorVestBps ≤ 1500, deadline (> startsAt, ≤ now + 30 d), target (uint8: 0 OwnedPool; 1 UniswapV4 reverts NotYet)`; then `expectedTermsHash` = `launchpad.termsHash(p)` read in the same slab (word 15). The `coin` must come from a prior `kiln.launch` for this `id` with `raiseShare > 0`; `curveSupply + floor(raiseShare·creatorVestBps/10000) < raiseShare` | 0 | `a` (the first-launch rule was already applied at `kiln.launch`) | `TermsMoved(bytes32 expected, bytes32 actual)`, `NotActor`, `NotYet`, `WrongCoin(address)`, `FairWindowTooLong(uint64)`, `SnipeTaxTooHigh(uint16)`, `FeeTooHigh(uint16)`, `CreatorShareTooHigh(uint16)`, `StartsInThePast(uint64)`, `DeadlinePassed(uint64)`, `DeadlineTooFar(uint64)`, `BadCurveParameters`, `Reentrancy`, Locks' errors if a vest is created | `launchCreated` = `LaunchCreated(uint256 indexed launchId, uint256 indexed id, address indexed coin, uint8 target, bytes32 termsHash)`; `locked` when `creatorVestBps > 0` |
| Buy on the curve | `launchpad.buy` | `buy(uint256,uint256,uint64,uint16)` 0x9edba388 | `launchId`; `minBaseOut` (from `quoteBuy` minus tolerance); `deadline`; `maxFeeBps` ≥ `feeBps + snipeTaxBps` (the decaying tax, shown as a countdown from `Launch.startsAt` to `fairWindowEnds`) | **`quoteIn` is `msg.value`** (native only, Launchpad.sol:315) | `d`: anyone | `NoSuchLaunch(uint256)`, `NotLive(uint256)`, `Expired`, `ZeroAmount`, `FeeTooHigh(uint16 effBps)`, `NotStarted(uint64)`, `DeadlinePassed(uint64)`, `FairWindowCapExceeded(uint256 attempted, uint256 cap)`, `CurveExhausted(uint256 requested, uint256 available)`, `SlippageExceeded(uint256 got, uint256 min)`, `Insolvent`, `Reentrancy` | `bought` = `Bought(uint256 indexed launchId, address indexed buyer, uint256 quoteIn, uint256 baseOut, uint256 fee, uint256 snipe)` |
| Sell credits back | `launchpad.sell` | `sell(uint256,uint256,uint256,uint64)` 0x905b502b | `launchId`; `baseIn` ≤ `creditOf(launchId, me)`; `minQuoteOut`; `deadline` | 0 (no approval: credits, not tokens) | `d` | `NotLive`, `Expired`, `ZeroAmount`, `NotEnoughCredit(uint256 have, uint256 want)`, `SlippageExceeded`, `Insolvent` | `Sold(uint256 indexed launchId, address indexed seller, uint256 baseIn, uint256 quoteOut, uint256 fee)` (—) |
| Graduate | `launchpad.graduate` | `graduate(uint256)` 0xf776449a | `launchId` | 0 | `d`: anyone once `raised ≥ graduationTarget || baseSold ≥ curveSupply` (Launchpad.sol:632-634) | `NoSuchLaunch`, `AlreadyGraduated(uint256)`, `NotLive(uint256)`, `NotGraduatable(uint256)`, `NotYet`, `TransferFailed`, `Insolvent`, Pool's `openSealed` errors | `graduated` = `Graduated(uint256 indexed launchId, uint256 indexed key, uint256 terminalPrice, uint256 poolSpot)`; Pool `SealedOpened` (—) |
| Fail (deadline passed short of target) | `launchpad.fail` | `fail(uint256)` 0x132e4f3c | `launchId` | 0 | `d`: anyone | `NoSuchLaunch`, `NotFailable(uint256)`, `InexactERC20Transfer` | `LaunchFailed(uint256 indexed launchId)` (—) |
| Refund a failed launch's buyer | `launchpad.refund` | `refund(uint256,address)` 0x7ad226dc | `launchId`; `buyer` (recipient fixed) | 0 | `d`: anyone | `NothingToClaim`, `TransferFailed`, `Insolvent` | `Refunded(uint256 indexed launchId, address indexed buyer, uint256 amount)` (—) |
| Claim coins after graduation | `launchpad.claim` | `claim(uint256,address)` 0xddd5e1b2 | `launchId`; `buyer` | 0 | `d`: anyone | `NothingToClaim`, `InexactERC20Transfer` | `Claimed(uint256 indexed launchId, address indexed buyer, uint256 amount)` (—) |
| Positions › Collect | `pool.collect` | as §2.1 | sealed `key` = `launchOf(launchId).marketKey` | 0 | anyone | | `collected` |
| Floor: contribute | `coin.contribute` | `contribute()` 0xd7bb99ba | `to` = the coin | the contribution, > 0 | `d`: anyone | `ZeroAmount` | `Contributed(address indexed from, uint256 amount)` (—) |
| Floor: redeem (burn for the floor share) | `coin.redeem` | `redeem(uint256)` 0xdb006a75 | `to` = the coin; `amount` of my balance (no approval — burns `msg.sender`) | 0 | `d` | `ZeroAmount`, `NotEnough`, `TransferFailed` | `Redeemed(address indexed from, uint256 burned, uint256 paid)` (—) |
| Locks: lock | `locks.lock` | `lock(address,uint112,address,uint64,uint64,uint64,bool)` 0xe51b0e8e | `asset` (0x0 native); `amount`; `beneficiary` (default `INTACT.reach`; never 0x0 or the Locks contract); `start` (0 = now); `cliff` (0 = start); `end` (> now, ≤ now + 3650 d); `linear` (false requires `cliff == end`) | exactly `amount` if `asset == 0x0` else 0 | `d`: anyone | `ZeroAddress`, `ZeroAmount`, `RatchetOnly`, `TooLong`, `UnsupportedSchedule`, `WrongValue`, `InexactERC20Transfer`, `Reentrancy` | `locked` = `Locked(uint256 indexed id, address indexed beneficiary, address indexed asset, address depositor, uint256 amount, uint64 start, uint64 cliff, uint64 end, bool linear)` |
| → approval step (ERC-20 lock) | `erc20.approve` | | `to` = asset; `spender = INTACT.locks` — **the Locks address is not in the state block under that name (shadowed, §6)**; `amount` exactly | | | | |
| Locks: release | `locks.release` | `release(uint256)` 0x37bdc99b (same selector as `hub.release`; different `to`) | `lockId` | 0 | `d`: anyone → the beneficiary | `NothingReleasable`, `TransferFailed`, `InexactERC20Transfer` | `Released(uint256 indexed id, address indexed beneficiary, uint256 amount)` (—) |
| Locks: extend | `locks.extend` | `extend(uint256,uint64)` 0xe3f08c1d | `lockId`; `newEnd` | 0 | the **beneficiary** — when that is the Reach, through `reach.execute` | `NotBeneficiary`, `UnsupportedSchedule` (already vested), `RatchetOnly`, `TooLong` | `Extended(uint256 indexed id, uint64 previousEnd, uint64 newEnd)` (—) |
| Locks: give | `locks.give` | `give(uint256,address)` 0xfcafcc68 | `lockId`; `newBeneficiary` — only a canonical Reach of this hub | 0 | the beneficiary | `NotBeneficiary`, `NotCanonicalReach(address)` | `Given(uint256 indexed id, address indexed from, address indexed to)` (—) |

Reads: `launchpad.launchOf`, `launchesOf`, `quoteBuy`, `quoteSell`,
`snipeTaxBps`, `creditOf`, `termsHash`; `kiln.coinAt`, `recordsOf`, `recent`;
`coin.floorPerToken`; `erc20.balanceOf/allowance/symbol/decimals` on the
coin; `locks.lockOf`, `releasable`, `lockCountOf`, `lockIdOf` — §3.

### 2.4 Vault panel (`#vault`)

Every Reach write is sent **to `INTACT.reach`**. `onlySigner` is
`HUB.ownerOf(id)` exactly (Reach.sol:307-317): operators, renters,
approvees and session keys revert `NotSigner`; a Reach that owns its own
token reverts `OwnershipCycle`.

| UI action | sel key | Signature | Args | Value | Caller | Errors | Events |
|---|---|---|---|---|---|---|---|
| Execute (composer) | `reach.execute` | `execute(address,uint256,bytes,uint8)` 0x51945447 | `to`; `value`; `data` (head word 2 = offset 0x80; tail = length + bytes padded); `operation` **= 0** | the ETH the Reach should forward comes from the Reach's own balance, so `msg.value` may be 0 (payable, but the holder may top up) | `d`: HOLD (the signer) | `NotSigner`, `OwnershipCycle`, `OnlyCall`, `Reentered`, and while sealed: `ValueWhileSealed` (any `value != 0`, or any `msg.value`), `NotSafeWhileSealed(bytes4 selector)` (a call to a manifest asset or a guarded piece's collection with any selector but `transfer`/`transferFrom`), `BlindTarget(address)`, `Shrank(address asset, uint256 before, uint256 after)`, `WentBlind(address)`, `PieceLeft(address,uint256)`, `LedgerFull` (33rd approval), `NoPrivilegeEscalation`; the callee's own revert is bubbled verbatim (Reach.sol:596) | `Executed(address indexed to, uint256 value, bytes4 selector, bool sealedNow)` (—), `AuditEntry` (—), `ApprovalRecorded(address indexed asset, address indexed spender)` (—) when the data is approval-shaped |
| Execute batch (approve + act in one act) | `reach.executeBatch` | `executeBatch((address,uint256,bytes)[])` 0x34fcd5be | head word 0 = offset 0x20; tail: `n` (1..16), then `n` offsets (relative to just after `n`), then each `Call`: `to`, `value`, `data`-offset (0x60), length, bytes | as above | HOLD | `EmptyBatch`, `ListTooLong`, plus the `execute` set (the seal measures the whole batch once, Reach.sol:547-559) | `Executed` ×n |
| Execute typed (spend caps / receive floors) | `reach.executeTyped` | `executeTyped((address,uint256,bytes,(address,uint256)[],(address,uint256)[],uint64))` 0xf570902c | §4.2 | 0 (non-payable) | HOLD, or a live session key | `Expired`, `ListTooLong` (> 4 limits), `OwnershipCycle`, `AllowanceNotZero(address asset, address spender)` (a prior allowance to `to` must be 0), `ApproveFailed`, `Overspend(address asset, uint256 cap, uint256 spent)`, `Shortfall(address asset, uint256 wanted, uint256 got)`, plus the seal set and, for a key, the session set below | `Executed`, `SessionActed` for a key |
| Seal (ratchet, ≤ 365 d, survives sale) | `reach.seal` | `seal(uint64)` 0x0368d8b2 | `until` | 0 | HOLD | `NotSigner`, `RatchetOnly`, `TooLong` | `Sealed(uint64 until)` (—) |
| Seal to the maximum | `reach.sealMax` | `sealMax()` 0x8257c5ff | — | 0 | HOLD or GUARDIAN (or the hub's `panic`) | `NotSignerOrGuardian`, `OwnershipCycle` | `Sealed` (—) |
| Manifest: add / remove an asset | `reach.guard` / `reach.unguard` | `guard(address)` 0xc70f5754 / `unguard(address)` 0x0d2db89b | `asset` | 0 | HOLD | `NotSigner`, `AlreadyListed`, `NotListed`, `ManifestFull` (16), `ManifestBusy`, `IsSealed` (unguard while sealed), `BlindTarget` | `ManifestAdded/Removed(address indexed asset)` (—) |
| Pieces (guard an NFT) | `guardNFT(address,uint256)` / `unguardNFT(uint256)` — **no `sel` row** (§6) | | | | | | |
| Open-approval ledger: revoke all | `reach.revokeOpenApprovals` | `revokeOpenApprovals()` 0x3dc0e109 | — | 0 | HOLD or GUARDIAN | `NotSignerOrGuardian`, `Reentered` | `ApprovalRevoked(address indexed asset, address indexed spender, bool ok)` (—) per entry; a refusing token leaves its entry (`ok == false`) and never blocks the rest |
| Sessions: grant an allowlist key | `reach.grantSession` | `grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)` 0x5fece29d | head 8 words: `key`; `expires` (≤ now + 365 d); `nativeCap`; offset→`caps`; offset→`targets`; offset→`selectors`; `minInterval`; `uses` (0 = unlimited). Tails in order: `caps` = length + 2 words per `AssetCap{asset, cap}` (≤ 8); `targets` = length + addresses (≤ 16); `selectors` = length + `bytes4` left-aligned words (≤ 16). Selectors come from `INTACT.sel` (on-chain-hashed chips); a target of `INTACT.reach` reverts | 0 | HOLD | `NotSigner`, `ListTooLong`, `SessionTooLong`, `NoPrivilegeEscalation`, `Expired` | `sessionGranted` = `SessionGranted(address indexed key, uint8 kind, uint64 expires, uint128 nativeCap, uint64 epoch)` |
| Sessions: grant a recipe | `reach.grantRecipe` | `grantRecipe(address,uint64,address,bytes32,uint256,uint32,uint32)` 0x0358fbdd | `key`; `expires`; `target` (must have code; not the Reach); `dataHash = keccak256(exact calldata)`; `exactValue`; `uses` 1..1024; `minInterval` | 0 | HOLD | `NotSigner`, `NoUsesLeft` (uses == 0), `ListTooLong` (> 1024), `NoPrivilegeEscalation`, `TargetNotAllowed(address)` (codeless target), `SessionTooLong` | `sessionGranted` (kind 1; the event's cap is `min(exactValue, 2^128-1)`) |
| Sessions: revoke one / all | `reach.revokeSession` / `reach.revokeAllSessions` | `revokeSession(address)` 0x1fa5d6a4 / `revokeAllSessions()` 0xeba3220c | `key` / — | 0 | HOLD or GUARDIAN | `NotSignerOrGuardian`, `OwnershipCycle` | `sessionRevoked` = `SessionRevoked(address indexed key)`; `AllSessionsRevoked(address indexed by)` (—) |
| Steward: arrange | `steward.arrange` | `arrange(uint256,bytes32,uint64,uint64,address[],uint8)` 0x23f81ef4 | `id`; `heirHash` = `steward.heirHashOf(heir, salt)` (= `keccak256(abi.encode(heir, salt))`) or `heirHashOfToken(tokenN, salt)` (= `keccak256(abi.encode(address(0), tokenN, salt))`, no `sel` row — compute locally or see §6); `quiet` 30..3650 d; `notice` 14..365 d (a live plan's notice only lengthens); `guardians` (offset 0xc0 → length 0 or 2..5, distinct, non-zero); `threshold` (0 when no guardians, else 2..n) | 0 | `d`: HOLD strictly — **the Steward address is not in the state block (shadowed, §6)** | `NotHolder`, `BadDestination` (zero hash), `TooShort`, `TooLong`, `BadGuardians`, `BadThreshold` | `arranged` = `Arranged(uint256 indexed id, uint64 epoch, bytes32 heirHash, uint64 quiet, uint64 notice, uint8 threshold)` |
| Steward: heartbeat | `steward.stillHere` / `steward.stillHereUnderDuress` | `stillHere(uint256)` 0x98c638f0 / `stillHereUnderDuress(uint256)` 0x96c879af | `id` | 0 | HOLD strictly | `NotHolder`, `NoPlan`, `Void` (epoch moved) | `StillHere(uint256 indexed id, uint64 when)` (—) — the duress form emits the same event; only `getWill().duress` tells |
| Steward: cancel a running notice | `steward.cancel` | `cancel(uint256)` 0x40e58ee5 | `id` | 0 | HOLD while the plan is live; anyone once void | `NoPlan`, `NotCalled`, `NotHolder` | `Cancelled(uint256 indexed id, address indexed by)` (—) |
| Steward: summon (heir's page) | `steward.summon` | `summon(uint256,address,bytes32)` 0x2fe1de67 | `id`; `heir` (or `address(uint160(tokenN))` for an instrument heir, INTERFACE-CHANGES); `salt` | 0 | `d`: anyone after `lastLife + quiet` | `NoPlan`, `Void`, `AlreadyCalled`, `StillSpeaking(uint64 until)`, `WrongHeir`, `BadDestination`, `BadHands`, hub `NotModule` never from a panel | `summoned` = `Summoned(uint256 indexed id, address indexed by, address dest, uint64 due)`; `NoticeStarted` (—); hub `Locked(uint256)` (—) |
| Steward: attest (named guardian) | `steward.attest` | `attest(uint256,address,uint32)` 0x6b952241 | `id`; `dest`; `nonce` = `getObit` word 3 | 0 | a named guardian (the Will's, not the hub's) | `NoPlan`, `Void`, `NotGuardian`, `StaleNonce`, `AlreadyCalled`, `BadDestination`, `BadHands`, `AlreadyAttested` | `Attested(uint256 indexed id, address indexed guardian, address dest, uint32 nonce)` (—) |
| Steward: execute | `steward.execute` | `execute(uint256)` 0xfe0d94c1 | `id` | 0 | anyone once `due` passed and `wouldPass == 7` | `NoPlan`, `Void`, `NotCalled`, `NotYet(uint64 until)`, `BadDestination`, `BadHands`, hub `IsLocked(uint256)`, `IsTransferSealed(uint256)`, `GuardianHeld(uint256)`, `CanonicalAccount(address)` | `Passed(uint256 indexed id, address indexed from, address indexed to)` (—), hub `transfer`, `custodyEpoch`, `statusChanged` |
| Panic (one red button) | `hub.panic` | `panic(uint256)` 0x72f40a6b | `id` | 0 | HOLD or GUARDIAN (CoreLogic.sol:226-252). Lists what it revokes (§5) | `NotAuthorized`, `OwnershipCycle` (from the Reach) | `panicked` = `Panicked(uint256 indexed id, uint64 epoch, address indexed by)`; `custodyEpoch`; `statusChanged`; `AllApprovalsRevoked` (holder form); `GuardianHoldSet`, hub `Locked` (guardian form); Reach `Sealed`, `AllSessionsRevoked` |
| Release a guardian hold | `hub.release` | `release(uint256)` 0x37bdc99b | `id` | 0 | HOLD strictly | `NotHolder`, `NotLocked` | `GuardianHoldSet(uint256 indexed id, bool held)` (—), `Unlocked` (—) |
| Sell (the page proposes the transfer after the §5 checklist) | `hub.transferFrom` / `hub.safeTransferFrom` | `transferFrom(address,address,uint256)` 0x23b872dd / `safeTransferFrom(address,address,uint256)` 0x42842e0e | `from` = holder; `to`; `id` | 0 | HOLD or CUSTODY (`_checkAuthorized`, IntactBase.sol:229-233; under `guardianHold` the holder in person only) | `NotAuthorized`, `IsLocked(uint256)`, `GuardianHeld(uint256)`, `IsTransferSealed(uint256)`, `NoBurn`, `CanonicalAccount(address to)` (to is a Reach/Grip of this collection, the hub, or an implementation), `WrongReceiver`, `NoSuchToken` | `transfer`, `custodyEpoch`, `statusChanged`, `UpdateUser`/`GuardianSet`/`AgentWalletSet` zeroed (—), `MetadataUpdate` (—), `ClearPathCache` (—) |
| Grip | no writes exist (IGrip.sol: no spend selector; `supportsInterface(0x51945447) == false`). Show `INTACT.grip`, a QR, `eth_getBalance(grip)` and `erc20.balanceOf(grip)`; print the permanence warning before any transfer-in calldata the page builds | | | | | | |

Reads: `reach.holdings`, `manifest`, `sealedUntil`, `state`, `openApprovals`,
`sessionOf`, `sessionExposure`, `sessionAllows`, `attestationDigest`;
`steward.wouldPass`, `getWill`, `getObit`, `heirHashOf`; `locks.*`;
`hub.coreOf` (guardianHold, lockCount, transferSealUntil) — §3.

### 2.5 Identity panel (`#identity`)

| UI action | sel key | Signature | Args | Value | Caller | Errors | Events |
|---|---|---|---|---|---|---|---|
| Set the `curve` trait | `hub.setTrait` | `setTrait(uint256,bytes32,bytes32)` 0x2bf453e3 | `id`; `traitKey = keccak256("curve")`; `newValue` = concentration bps 0..80000 as a right-aligned `uint256` in the word (SiteLogic.sol:141-143) | 0 | `d`: HOLD strictly (not the Reach) | `NotHolder`, `BadTrait` | `TraitUpdated(bytes32 indexed traitKey, uint256 tokenId, bytes32 traitValue)` (—), `MetadataUpdate` (—) |
| Set the `name` trait | `hub.setTrait` | as above | `traitKey = keccak256("name")`; `newValue` = ≤ 32 bytes of valid UTF-8 **left-aligned** in the word, zero-padded (`_unpackName`, SiteLogic.sol:144-148); empty clears | 0 | HOLD | `NotHolder`, `BadName`, `BadTrait` | `TraitUpdated` (—) |
| Arm / pause the status | `hub.setStatus` | `setStatus(uint256,uint8)` 0xd896dd64 | `id`; `status` 0 Active / 1 Paused. Print: *sessions act only while Active; a sale pauses the token; re-arm to let your keys act* | 0 | `a`: HOLD or via the Reach (`_requireActs`) | `NotActor` | `statusChanged` = `StatusChanged(uint256 indexed id, uint8 previous, uint8 current)` |
| Pause (kill switch) | `hub.pause` | `pause(uint256)` 0x136439dd | `id` | 0 | HOLD or GUARDIAN (RightsLogic.sol:135-141) | `NotGuardian` (the error for both non-holder and non-guardian) | `statusChanged` |
| Set the guardian | `hub.setGuardian` | `setGuardian(uint256,address)` 0xc02f5582 | `id`; `guardian` (0x0 clears) | 0 | HOLD strictly | `NotHolder` | `GuardianSet(uint256 indexed id, address indexed guardian)` (—) |
| Name a renter (ERC-4907) | `hub.setUser` | `setUser(uint256,address,uint64)` 0xe030565e | `id`; `user`; `expires` | 0 | HOLD strictly | `NotHolder` | `UpdateUser(uint256 indexed tokenId, address indexed user, uint64 expires)` (—) |
| Agent wallet, step 1 | `hub.proposeAgentWallet` | `proposeAgentWallet(uint256,address)` 0xb29b961f | `id`; `wallet` (0x0 withdraws and unbinds) | 0 | HOLD strictly | `NotHolder` | `AgentWalletProposed(uint256 indexed id, address indexed wallet)` (—) |
| Agent wallet, step 2 | `hub.acceptAgentWallet` | `acceptAgentWallet(uint256)` 0xed994da0 | `id` | 0 | **the proposed wallet itself** (`msg.sender == proposedWallet`) | `NotWallet` | `AgentWalletSet(uint256 indexed id, address indexed wallet)` (—), `MetadataUpdate` (—) |
| Route income into the Grip | `hub.setFeesToGrip` | `setFeesToGrip(uint256,bool)` 0xddef9afe | `id`; `toGrip`. Say "income into the Grip is permanently unspendable" first | 0 | HOLD strictly | `NotHolder` | `FeesToGripSet(uint256 indexed id, bool toGrip)` (—) |
| Pin / unpin a face | `hub.pinTokenURI` / `hub.unpinTokenURI` | `pinTokenURI(uint256,uint256)` 0x7de19c5f / `unpinTokenURI(uint256)` 0x52dbd6da | `id`; `index` 0..2 | 0 | HOLD | `NotHolder`, `BadFace` | `TokenUriPinned/Unpinned` (—), `MetadataUpdate` (—) |
| Seal transfers (ratchet) | `hub.sealTransfer` | `sealTransfer(uint256,uint64)` 0x4deb4124 | `id`; `until` (≤ now + 365 d, only lengthens) | 0 | HOLD | `NotHolder`, `RatchetOnly`, `TooLong` | `TransferSealed(uint256 indexed id, uint64 until)` (—) |
| Operators: timed approval | `hub.setApprovalForAllUntil` | `setApprovalForAllUntil(address,uint64)` 0xa2694771 | `operator ≠ 0x0`; `expiresAt` (0 revokes; else > now) | 0 | the owner (per owner, not per token) | `Expired`, `ZeroAddress` | `OperatorApprovalTimed(address indexed owner, address indexed operator, uint64 expiresAt)` (—), `ApprovalForAll` (—) |
| Operators: classic / single approval | `hub.setApprovalForAll` / `hub.approve` | `setApprovalForAll(address,bool)` 0xa22cb465 / `approve(address,uint256)` 0x095ea7b3 | `operator`, `approved` / `to`, `id` | 0 | owner / owner or operator | `ZeroAddress`, `NotAuthorized` | `ApprovalForAll` / `Approval` (—) |
| Revoke every operator (O(1)) | `hub.revokeAllApprovals` | `revokeAllApprovals()` 0x250793d4 | — | 0 | the owner | — | `AllApprovalsRevoked(address indexed owner, uint64 epoch)` (—) |
| Encryption key / bind | `keys.setEncryptionKey`, `parley.bindKey` | as §2.2 | | | | | |
| Rights of any address | `hub.rightsOf` | read | | | | | |
| Fingerprint diff | `hub.getStateFingerprint` vs `INTACT.fingerprint` (baked at `INTACT.block`) | read | | | | | |
| 7702 delegate status | `eth_getCode(holder)`; if it starts `0xef0100`, keccak the 23 bytes and compare to `Catalog.knownDelegates()` — **no `sel` row and not in the state block** (§6) | | | | | | |
| Hash manifest | `/manifest` (live origin) — `INTACT.panels`, `INTACT.engineHash`, `INTACT.catalogHash` suffice for the data: viewer | | | | | | |
| ENS binding (band 0) | Nameplate: post-MVB, no letter, no rows | | | | | | |

Reads: `hub.coreOf`, `statusOf`, `getTraitValue`, `getStateFingerprint`,
`rightsOf`, `account`, `grip`, `feeSink`, `isCanonicalAccount`,
`keys.getPublicKeys`/`keyIdOf`, `parley.keyOf`.

### 2.6 Agent panel (`#agent`, stub until U17)

| UI action | sel key / source | Notes |
|---|---|---|
| Services catalogue | `INTACT.sel`, `INTACT.err`, `INTACT.topics` already baked; `catalog.services()` 0x7b2b30e3 or `GET /services.json` for the row metadata (`{name,on,contract,sig,selector,kind,via,args[],notes}`, `walk`, `door`, `bands`, `routes`) | read-only |
| Session grants with on-chain-hashed selector chips | `reach.sessionOf(key)` (14 words, §3.4), `reach.sessionExposure(key)`, `reach.sessionAllows(key, to, selector)` before any send; grant/revoke rows as §2.4; the chips are `INTACT.sel` entries, never typed hex | HOLD grants; the key acts |
| The `/k/<id>/<key>` door | Premises 301s to `/token/<id>/live?as=<key>`; the shell in session mode refuses a wallet whose `eth_requestAccounts[0] != key`, reads `rightsOf(id, key)` (SESSION bit = `sessionCurrent`) and `sessionOf(key)`, and offers only `reach.executeAsSession(address,uint256,bytes)` 0x62d2e9b2 and `reach.executeTyped` with the allowed targets × selectors | the key |
| Act as the key | `reach.executeAsSession` | `to`; `value` (charged to `nativeCap`); `data` (offset 0x60). Errors: `NoSession`, `SessionExpired`, `SoldOn(uint64 granted, uint64 now)`, `HubUnreadable`, `NotActive`, `NoPrivilegeEscalation`, `TooSoon(uint64 until)`, `NoUsesLeft`, `RecipeMismatch`, `TargetNotAllowed(address)`, `SelectorNotAllowed(bytes4)`, `SpenderNotAllowed(address)`, `SpendCapExceeded(uint256 cap, uint256 wanted)`, `AssetCapExceeded(address asset, uint256 cap, uint256 spent)`, `OwnershipCycle`, the seal set, the callee's revert. Event `SessionActed(address indexed key, address indexed to, uint256 value, bytes4 selector)` (—) |
| Audit walk | `AuditEntry(bytes32 indexed root, bytes32 previous, address signer, address to, uint256 value, bytes4 selector, bytes32 dataHash, uint256 state)` and `auditRoot()` — **no topic row, no `sel` row** (§6) | post-MVB |

---

## 3. Reads: return layouts, word by word

Word `k` is bytes `[32k, 32k+32)` of the return data. Static structs are
one word per field in declaration order. "offset" words are byte offsets
from the start of the return data.

### 3.1 Hub (`INTACT.hub`)

| Read | Signature (selector) | Layout |
|---|---|---|
| rights | `rightsOf(uint256,address)` 0x85ee2281 | w0 `uint16 bits`; w1 `uint64 epoch`; w2 `address holder`. Reverts `NoSuchToken` for an unminted id. `actor == 0x0` → bits 0 |
| custody epoch | `custodyEpoch(uint256)` 0xc335fc00 | w0 `uint64` |
| status | `statusOf(uint256)` 0xad35efd4 | w0 `uint8` (0 Active, 1 Paused) |
| core | `coreOf(uint256)` 0xabce47e2 | `Core` (IIntact.sol:36-53, NEVER REORDERED): w0 `status` (uint8 enum); w1 `pinnedFace` (uint8; 0 = none, else face+1); w2 `lockCount` (uint32, module locks); w3 `custodyEpoch` (uint64); w4 `transferSealUntil` (uint64); w5 `createdAt` (uint64); w6 `guardian` (address); w7 `guardianHold` (bool); w8 `feesToGrip` (bool); w9 `launchCount` (uint32); w10 `user` (address); w11 `userExpires` (uint64); w12 `agentWallet` (address, 0x0 = the Reach); w13 `proposedWallet` (address); w14 `curve` (bytes32, bps in the low 17 bits); w15 `nameHash` (bytes32). `locked = lockCount != 0 || guardianHold` |
| fingerprint | `getStateFingerprint(uint256)` 0xf5112315 | w0 `bytes32` |
| fee sink | `feeSink(uint256)` 0x7ea50e51 | w0 `address` (Reach, or Grip when `feesToGrip`) |
| accounts | `account(uint256)` 0x2dd7c658, `grip(uint256)` 0x064677cd | w0 `address` |
| owner | `ownerOf(uint256)` 0x6352211e | w0 `address`; reverts `NoSuchToken` |
| price | `price()` 0xa035b1fe | w0 `uint256` wei (also `INTACT.price` as a string) |
| trait | `getTraitValue(uint256,bytes32)` 0xa28eec87 | w0 `bytes32` (`curve`: number right-aligned; `name`: UTF-8 left-aligned) |
| face | `tokenURIAt(uint256,uint8)` 0xcdbcbda4 | `string`: w0 offset 0x20, w1 length, then bytes |
| canonical | `isCanonicalAccount(address,uint256,bool)` 0x0e77fc33 | w0 `bool` |

### 3.2 Pool (`INTACT.pool`)

| Read | Signature | Layout |
|---|---|---|
| market | `marketOf(uint256)` 0xeee97751 | `Market` (IPool.sol:15-26), **16 words**: w0 `base` (address, 0x0 = ETH); w1 `quote` (address); w2 `rBase` (uint112); w3 `rQuote` (uint112); w4 `feeBps` (uint16); w5 `sniperBps` (uint16); w6 `sniperUntil` (uint64); w7 `open` (bool); w8 `sealedMarket` (bool); w9 `sealUntil` (uint64) — the hub reads this exact word at byte 0x140 of the return (SiteLogic.sol:159-165); w10 `curveBps` (uint24); w11 `vBase` (uint128); w12 `vQuote` (uint128); w13 `feeBaseOwed` (uint112); w14 `feeQuoteOwed` (uint112); w15 `beneficiary` (uint256 token id, sealed markets). A closed/absent key returns 16 zero words (`open == false`), never a revert |
| quote | `quote(uint256,bool,uint256)` 0x124d6efc | w0 `uint256 out`; reverts `MarketNotOpen`, `ZeroAmount`, `TradeTooLarge` |
| quote exact out | `quoteExactOut(uint256,bool,uint256)` 0x09283e21 | w0 `uint256 inNeeded` |
| spot | `spot(uint256)` 0x66061165 | w0 `uint256` base-in-quote × 1e18 (0 for a closed market) |
| directory | `openIds(uint256,uint256)` 0xc3f95de6, `sealedIds(uint256,uint256)` 0xd052c48b | `uint256[]`: w0 offset 0x20; w1 length n; w2.. n ids |
| hash | `marketHash(uint256)` 0xdc582aa2 | w0 `bytes32` = keccak(abi.encode(base, quote, rBase, rQuote, feeBps, sealUntil, curveBps, vBase, vQuote)) |

### 3.3 Router (`INTACT.router`; hide when absent)

| Read | Signature | Layout |
|---|---|---|
| quote by revert | `quoteExactIn(SwapRequest)` 0xdd3cb48b | `eth_call` revert data: 4 bytes `0x5cbe38e7` (`QuoteResult(uint256,uint256,uint160)`), then w0 `spent`, w1 `received`, w2 `sqrtPriceAfter` (0 for the owned Pool). Any other 4-byte prefix is an error from `INTACT.err` |
| venues | `venues()` 0x9ea06156 | `VenueInfo[]` of 3 (Router.sol:371-376), each `{string name, address at, bytes32 codehash, uint16 permissionBits, bool upgradeable, string auditURI}`: w0 offset 0x20 (array); w1 length 3; w2..w4 element offsets relative to byte 0x40; each element: e0 offset→name (0xc0), e1 `at`, e2 `codehash`, e3 `permissionBits`, e4 `upgradeable`, e5 offset→auditURI, then `name` (length, bytes padded), then `auditURI` (length, bytes). `at == 0x0` = a venue this band lacks |

### 3.4 Reach (`INTACT.reach`)

| Read | Signature | Layout |
|---|---|---|
| seal | `sealedUntil()` 0x35311a8e | w0 `uint64` (also `INTACT.clocks.sealedUntil`) |
| state nonce | `state()` 0xc19d93fb | w0 `uint256` (bumped on every execute, grant, revoke, seal, manifest change) |
| manifest | `manifest()` 0xf5baf0d7 | `address[]`: w0 offset 0x20; w1 n (≤ 16); n addresses |
| holdings | `holdings()` 0xe79bf13b | w0 `uint256 ether_`; w1 offset→`assets` (0x80); w2 offset→`balances`; w3 offset→`measured`; then `assets`: length n, n addresses; `balances`: n, n uint256; `measured`: n, n bool (false = "not reported" for that asset — print it as such, never as 0) |
| open approvals | `openApprovals()` 0x74b75bcf | `OpenApproval[]` static: w0 offset 0x20; w1 n (≤ 32); then per entry `asset` (address), `spender` (address) |
| session | `sessionOf(address)` 0x003d3534 | `Session` (IReach.sol:22-37), **14 words**: w0 `kind` (0 Allowlist, 1 Recipe); w1 `expires` (uint64); w2 `epoch` (uint64, dead when ≠ `custodyEpoch`); w3 `nativeCap` (uint128); w4 `nativeSpent` (uint128); w5 `usesLeft` (uint32; `0xffffffff` = unlimited after a grant with `uses == 0`); w6 `minInterval` (uint32); w7 `lastUsed` (uint64); w8 `dataHash` (bytes32, recipe); w9 `targetCodeHash` (bytes32, recipe); w10 `target` (address, recipe); w11 `exactValue` (uint256, recipe); w12 `listEpoch` (uint32); w13 `active` (bool — the stored flag; liveness is `rightsOf(...).SESSION` / `sessionAllows`) |
| exposure | `sessionExposure(address)` 0x04f4f614 | w0 `uint256 nativeWorst` (remaining native cap, or `exactValue × usesLeft` for a recipe); w1 offset→caps (0x40); w2 n; then per cap `asset` (address), `cap` (uint128, **remaining**) |
| allows | `sessionAllows(address,address,bytes4)` 0xc9edaf21 | w0 `bool` (folds in liveness, epoch, `Active`, target, selector, privilege) |
| attestation digest | `attestationDigest(string,bytes32,uint64)` 0xeffda535 | w0 `bytes32` |

### 3.5 Parley (`INTACT.parley`) and Roster (`INTACT.roster`)

| Read | Signature | Layout |
|---|---|---|
| room state | `stateOf(uint256)` 0x131a7e24 | **17 words**: w0 `last` (uint64, block of the newest message — the block to `eth_getLogs`); w1 `count` (uint64, messages so far); w2 `opened` (uint64 block); w3 `members` (uint32); w4 `kind` (uint8: 0 commons, 1 group, 2 pair, 3 home — `IS_*`); w5 `open` (bool); w6 `steward` (uint256 token id); w7 `index` (uint256, groups); w8 `cooldown` (uint32 s); w9..w12 `headBlocks[4]` (uint64 each; lane 0 newest); w13..w16 `headSeqs[4]`. An unknown room is 17 zero words |
| heads (9-second poll) | `heads(uint256[])` 0x84902826 | `uint64[]`: w0 offset 0x20; w1 n; n words — each is the room's **head block**, not a count (INTERFACE-CHANGES) |
| key | `keyOf(uint256)` 0x7b3a1347 | w0 `uint16 keyType`; w1 `bytes32 keyId`; w2 offset→publicKey (0x60); w3 length; then bytes. All zero (length 0) unless the binder still holds the token under the same epoch and still has a key in `keys` (Parley.sol:550-557) |
| my rooms | `roomsOf(uint256)` 0x49a605eb | w0 offset→keys (0x40); w1 offset→member; `keys`: n, n uint256; `member`: n, n bool |
| followers | `roster.membersOf(uint256,uint256)` 0xc4c30bdd | w0 offset→ids (0x40); w1 `uint256 next` (`from + 256`, or 0 at the end); w2 n; n ids. Scans ids `from .. from+255` within this band |
| topics (fallback) | `topics()` on Parley | 5 words `said, founded, invited, entered, departed` — `INTACT.topics` lacks `invited`/`departed` (§6) |

### 3.6 Postage (`INTACT.postage`) and KeyRegistry (`INTACT.keys`)

| Read | Signature | Layout |
|---|---|---|
| inbox (live) | `inboxOf(uint256)` 0x20aaef0d | `Inbox` (IPostage.sol:16-22), 5 words: w0 `feeToken` (address, 0x0 native); w1 `postage` (uint128); w2 `replyWindow` (uint64); w3 `open` (bool); w4 `epoch` (uint64). Stale (epoch moved) → `(0x0, 0, 0, true, 0)` = open and free |
| pending stamp | `pendingOf(uint256 pairRoom)` 0x7e7feaa7 | w0 `uint256 stampId` (0 = none) |
| owed | `owed(address payee, address feeToken)` 0x28079e4a | w0 `uint256` |
| stamp (no `sel` row; `stampOf`) | `stampOf(uint256)` | 10 words: `pairRoom, from, to, sender, feeToken, postage, sentAt, replyBy, settled, refunded` |
| public key | `keys.getPublicKeys(address)` 0x5fcbb7d6 | w0 `uint16 keyType`; w1 offset→publicKey (0x60); w2 `uint64 updatedAt`; w3 length; then bytes |
| key id | `keys.keyIdOf(address)` 0x9e90f0fa | w0 `bytes32` = keccak256(publicKey), or 0 |

### 3.7 Launchpad (`INTACT.launchpad`), Kiln (`INTACT.kiln`), Coin

| Read | Signature | Layout |
|---|---|---|
| launch | `launchOf(uint256)` 0x03e2fa0e | `Launch` (ILaunchpad.sol:35-56), **20 words**: w0 `id`; w1 `coin` (address); w2 `target` (uint8: 0 OwnedPool, 1 UniswapV4); w3 `state` (uint8: 0 None, 1 Live, 2 Graduated, 3 Failed); w4 `quoteReserve` (uint128); w5 `baseReserve` (uint128); w6 `curveSupply` (uint128); w7 `liquiditySupply` (uint128); w8 `baseSold` (uint128); w9 `raised` (uint128); w10 `startsAt` (uint64); w11 `fairWindowEnds` (uint64); w12 `deadline` (uint64); w13 `maxBuyInWindow` (uint128); w14 `snipeTaxStartBps` (uint16); w15 `feeBps` (uint16); w16 `creatorBps` (uint16); w17 `termsHash` (bytes32); w18 `epoch` (uint64); w19 `marketKey` (uint256, the sealed market after graduation). `graduationTarget` is **not** in the struct (`graduationTargetOf(launchId)`, no `sel` row) |
| my launches | `launchesOf(uint256)` 0xcd349d6b | `uint256[]` (also `INTACT.launches`) |
| quote buy | `quoteBuy(uint256,uint256)` 0xf998a865 | w0 `baseOut`; w1 `fee`; w2 `snipe` (baseOut 0 when fee+snipe ≥ quoteIn) |
| quote sell | `quoteSell(uint256,uint256)` 0x0277dd67 | w0 `quoteOut`; w1 `fee` |
| tax now | `snipeTaxBps(uint256)` 0xe0bc04e3 | w0 `uint256` bps (decays linearly to 0 at `fairWindowEnds`; display as a countdown) |
| credits | `creditOf(uint256,address)` 0x141ab415 | w0 `uint256` |
| terms hash | `termsHash(LaunchParams)` 0xd49b00af | w0 `bytes32` = keccak256(abi.encode(p)) |
| coin address | `kiln.coinAt(…)` 0x24137cdd | w0 `address` |
| records | `kiln.recordsOf(uint256)` 0xe3acd07d | `LaunchRecord[]` static: w0 offset 0x20; w1 n; per record `coin` (address), `launchedAt` (uint64), `supply`, `raiseShare` |
| recent coins | `kiln.recent(uint256,uint256)` 0x8528fb56 | `address[]`: offset, n, addresses |
| floor | `coin.floorPerToken()` 0x046b18fc | w0 `uint256` wei per **whole** token (10^decimals base units) |
| coin metadata / balances | `erc20.symbol()` 0x95d89b41 (`string`: offset, length, bytes — some tokens return `bytes32`; accept both), `erc20.decimals()` 0x313ce567 (w0 uint8), `erc20.balanceOf(address)` 0x70a08231, `erc20.allowance(address,address)` 0xdd62ed3e | one word each |

### 3.8 Locks (address: see §6) and Steward (address: see §6)

| Read | Signature | Layout |
|---|---|---|
| lock | `lockOf(uint256)` 0x632a4861 | `Lock` (ILocks.sol:16-26), 9 words: w0 `depositor`; w1 `beneficiary`; w2 `asset` (0x0 native); w3 `amount` (uint112); w4 `released` (uint112); w5 `start` (uint64); w6 `cliff`; w7 `end`; w8 `linear` (bool) |
| releasable | `releasable(uint256)` 0xe4bf01a8 | w0 `uint256` |
| count / ids | `lockCountOf(address)` 0x15e7c79d (w0; also `INTACT.locks`), `lockIdOf(address,uint256)` 0x61ed62f1 (w0 lock id). `lockIdOf` is a finding aid: after `give` the old beneficiary's index keeps the entry — filter by `lockOf(id).beneficiary == reach` (Locks.sol:171-175) |
| would pass | `wouldPass(uint256)` 0x281ca2c6 | w0 `uint8`: 0 NO_PLAN, 1 SOLD (epoch moved — void), 2 SPEAKING, 3 SUMMONABLE, 4 WAITING, 5 LOCKED (another module's lock, a guardian hold or the transfer seal), 6 BAD_HANDS, 7 OK (also `INTACT.steward`) |
| will | `getWill(uint256)` 0x4192bbb0 | `Will` is **dynamic** (it holds `address[] guardians`): w0 offset 0x20; then the struct head: s0 `heirHash` (bytes32); s1 `quiet` (uint64); s2 `notice`; s3 `lastLife`; s4 `due` (0 while no notice runs); s5 `dest` (address); s6 `epoch` (uint64); s7 offset→guardians (0x160, relative to the struct start); s8 `threshold` (uint8); s9 `nonce` (uint32); s10 `duress` (bool); then `guardians`: n, n addresses |
| obit | `getObit(uint256)` 0xf5f0d22a | 5 words: w0 `status` (= wouldPass); w1 `due` (uint64); w2 `dest` (address, an instrument heir resolved as of now); w3 `nonce` (uint32, what a guardian must quote); w4 `attestations` (uint8 spoken at this nonce) |
| heir hash | `heirHashOf(address,bytes32)` 0xcc490f73 | w0 `bytes32` |

### 3.9 Catalog / Engine

`engine.panel(uint256)` → `bytes` (offset, length, gzip bytes);
`catalog.state(uint256)` / `services()` → `bytes` JSON; `catalog.stateOf` →
15 words (§1).

---

## 4. The Reach-mediated writes: nested encodings

The holder's wallet is `msg.sender` of the outer call to `INTACT.reach`; the
Reach is `msg.sender` of the inner call. Every inner calldata is built from
`INTACT.sel` exactly as a direct call would be; the outer wrapper is one of
the three below. `Router.swap` is reach-only (`_onlyReach`, Router.sol:382-387:
the caller's code must be the 173-byte 6551 forwarder whose footer names
this hub and whose address `hub.isCanonicalAccount(sender, id, false)`
confirms; otherwise `NotReach(address)`).

### 4.1 `SwapRequest` and the inner `router.swap` calldata

`SwapRequest` (IRouter.sol:25-36) is a dynamic tuple (it carries `bytes path`).
Inner calldata `D_swap` = `0x82dea54c` ‖ head ‖ tail where:

```
head w0  = 0x20                                   offset of the tuple
tuple:
  t0  venue            uint8   0 OwnPool | 1 UniswapV3 | 2 UniswapV4
  t1  tokenIn          address (0x0 = native)
  t2  tokenOut         address
  t3  amountIn         uint256
  t4  minOut           uint256 (balance-delta floor, measured at the Router)
  t5  deadline         uint64
  t6  poolKey          uint256 (OwnPool: the market key; else 0)
  t7  offset of path   = 14 * 32 = 0x1c0 (relative to the tuple start)
  t8  v4Key.currency0  address   ┐
  t9  v4Key.currency1  address   │ PoolKey, static, inlined
  t10 v4Key.fee        uint24    │ (zeros for OwnPool/V3)
  t11 v4Key.tickSpacing int24    │ (two's complement in 32 bytes)
  t12 v4Key.hooks      address   ┘
  t13 sqrtPriceLimitX96 uint160  (a real limit for V4; 0 otherwise — V4 refuses 0/max: BadPriceLimit)
  t14 path length      (0 for OwnPool/V4; 43..112 for V3, (len-20) % 23 == 0, endpoints = in/out with WETH for native)
  t15.. path bytes, zero-padded to 32
```

`quoteExactIn` takes the identical tuple with selector `0xdd3cb48b` and is
sent by `eth_call` from any address (no Reach needed).

### 4.2 The three wrappers

**A. `reach.execute(ROUTER, value, D_swap, 0)`** (0x51945447), the simplest:

```
w0 to        = INTACT.router
w1 value     = amountIn when tokenIn == 0x0, else 0   (Router: msg.value must equal it, WrongValue)
w2 offset    = 0x80
w3 operation = 0                                      (OnlyCall otherwise)
w4 len(D_swap)
w5.. D_swap, zero-padded to 32
```

For an ERC-20 `tokenIn` the Router pulls `transferFromExact(tokenIn, reach, router, amountIn)`
(Router.sol:198), so the Reach must hold exactly that allowance beforehand.
Two transactions (`execute(tokenIn, 0, approve(router, amountIn), 0)` then
the swap) leave a window; the batch closes it.

**B. `reach.executeBatch([approve, swap])`** (0x34fcd5be) — "one approval and
one action are one act" (Reach.sol:523-545):

```
w0 = 0x20                       offset of the array
w1 = 2                          n
w2 = 0x40                       offset of Call[0] (relative to w2's position)
w3 = offset of Call[1]          = 0x40 + size(Call[0])
Call[0]: to = tokenIn, value = 0, data-offset = 0x60, len = 68, data = 0x095ea7b3 ‖ pad32(INTACT.router) ‖ pad32(amountIn), padded to 96
Call[1]: to = INTACT.router, value = (native ? amountIn : 0), data-offset = 0x60, len = len(D_swap), D_swap padded
```

The Router approves the venue exactly and zeroes it (`AllowanceStuck` if a
venue refuses the zero); the Reach's ledger records the Reach→Router approval
(kind 1) and the Router consumes it entirely, so `openApprovals()` shows the
entry until it is pruned. Under a seal: an approval to a **manifest** asset
reverts `NotSafeWhileSealed(0x095ea7b3)` (Reach.sol:666-676), and any `value`
reverts `ValueWhileSealed`.

**C. `reach.executeTyped(TypedCall)`** (0xf570902c) — the recommended form,
with receive floors enforced by the account itself (Reach.sol:1080-1125):

```
w0 = 0x20                                   offset of the tuple
tuple head:
  t0 to         = INTACT.router
  t1 value      = native ? amountIn : 0
  t2 offset→data        = 0xc0
  t3 offset→spend       = 0xc0 + 32 + pad32(len(D_swap))
  t4 offset→receiveMin  = t3 + 32 + 64 * len(spend)
  t5 deadline   uint64
tails:
  data:       len(D_swap), D_swap padded
  spend:      n (≤ 4), then per AssetLimit{asset, amount}:   (tokenIn, amountIn)   — for native tokenIn use (0x0, amountIn): the native leg is c.value, measured like the rest
  receiveMin: n (≤ 4), then (tokenOut, minOut)              — 0x0 for native out
```

Semantics: for each ERC-20 `spend` asset the Reach requires
`allowance(reach, to) == 0` (`AllowanceNotZero`), `approveExact(to, amount)`,
performs the call, `approveExact(to, 0)`, then checks the balance fell by at
most `amount` (`Overspend`) and each `receiveMin` balance rose by at least
`amount` (`Shortfall`). No standing allowance survives. `executeTyped` is
non-payable: the native leg is the Reach's own balance. A session key may
send the same call (`msg.sender != owner` → `_authorize`, `_capsBefore`,
`_charge`).

### 4.3 Other acts through the Reach

- **Pool deposit from the Reach** (Bundle.t.sol:287-289): `execute(base, 0, approve(INTACT.pool, amountBase), 0)` then `execute(INTACT.pool, amountQuote /*native quote*/, deposit(id, amountBase, amountQuote), 0)`; the approval lands on the ledger (`openApprovals().length == 1`, Bundle.t.sol:291-294) — the Vault panel shows it with one-click revoke. `executeBatch` makes it one act.
- **Speaking from the Reach** (Bundle.t.sol:318-319): `execute(INTACT.parley, 0, speak(room, id, kind, 0, 0, body), 0)` — `mayActAs` admits the Reach.
- **ERC-20 postage**: `execute(feeToken, 0, approve(INTACT.postage, postage), 0)` before any `whisperStamped`, because Postage pulls from `hub.account(from)` (Postage.sol:145-150).
- **Locks `extend`/`give` on a lock whose beneficiary is the Reach**: `execute(LOCKS, 0, extend(lockId, newEnd), 0)`.
- **Spending what the Reach was paid** (Bundle.t.sol:395): `execute(holder, amount, "", 0)` — `data` of length 0 (w4 = 0), refused under a seal (`ValueWhileSealed`).
- **Session key path** (Bundle.t.sol:117-125 grants `targets=[weth]`, `selectors=[transfer]`): the key sends `executeAsSession(to, value, data)` with `data` = the inner calldata; checks in order: `OwnershipCycle`, `NoSession`, `SessionExpired`, `SoldOn(granted, now)`, `HubUnreadable`, `NotActive` (Paused token), `NoPrivilegeEscalation`, `TooSoon`, `NoUsesLeft`, then `RecipeMismatch` or `TargetNotAllowed`/`SelectorNotAllowed`/`SpenderNotAllowed`, `SpendCapExceeded`; after the call `AssetCapExceeded` by measured delta (Reach.sol:989-1056).

### 4.4 Seal interplay the Swap panel must state

While `reach.sealedUntil() > now` (`INTACT.clocks.sealedUntil`): no native
input can leave the Reach through any wrapper (`ValueWhileSealed`); a
manifest asset cannot be approved through `execute`/`executeBatch`
(`NotSafeWhileSealed`), and even through `executeTyped` (whose own
`approveExact` is not policed) the swap's spend leg lowers the manifest
balance and the end-of-call measurement reverts `Shrank(asset, before, after)`.
So "Elsewhere" is possible under a seal only for assets **not** on the
manifest; the panel hides the native and manifest routes and says why
(`reach.manifest()` is the list).

---

## 5. The sell-time checklist (DESIGN §2 "What sale revokes" / "What survives"), each line with the read that proves it live

The checklist is rendered before any `transferFrom` the page proposes. Each
row names the read whose value flips (or holds) across the custody change,
as `test/Bundle.t.sol` asserts.

### Revoked by `_update` in the same transaction (IntactBase.sol `_update`; DESIGN §4.4; Bundle.t.sol:399-478 `test_sellingTheTokenSellsTheMarketTheVoiceTheLaunchFeesAndKillsEverySession`, 495-551 `test_aBuyBackRevivesNothingAnywhere`)

| Line | Proving read | Before → after |
|---|---|---|
| the single approval | `rightsOf(id, approvee).bits & CUSTODY` (no `getApproved` row) | 8 → 0 (Bundle 431) |
| the ERC-4907 user | `coreOf` w10/w11, `rightsOf(id, renter) & USE` | user, expires → 0x0, 0 (Bundle 432) |
| the guardian | `coreOf` w6, `rightsOf(id, guardian) & GUARDIAN` | guardian → 0x0 (Bundle 430) |
| the agent wallet and any proposal | `coreOf` w12, w13 | → 0x0 (`agentWalletOf` then answers the Reach) |
| the pinned face | `coreOf` w1 | → 0 |
| the fee-sink bit | `coreOf` w8; `feeSink(id)` | → false; the Reach |
| status → Paused | `statusOf`, `coreOf` w0 | 0 → 1 (Bundle 429); keys cannot act until `setStatus(id, 0)` by the buyer (Bundle 539-540) |
| custody epoch +1 | `custodyEpoch(id)` | n → n+1 (Bundle 428; 2 → 3 on the buy-back, 518) |
| every session and recipe (by epoch) | `sessionOf(key)` w2 ≠ `custodyEpoch`; `rightsOf(id, key) & SESSION` → 0; `sessionAllows` → false; `executeAsSession` reverts `SoldOn(granted, now)` | Bundle 471-475, 520-524 |
| key binding | `parley.keyOf(id)` → `(0, 0x0, "")` | Bundle 454, 525 |
| inbox price | `postage.inboxOf(id)` → `(0x0, 0, 0, true, 0)` | Bundle 455-457, 526 |
| steward plan | `steward.wouldPass(id)` → 1 SOLD; `getObit` w0 = 1 | Bundle 527-528 |
| first-launch approval | (`firstLaunchApproved` has no row) — the error `FirstLaunchNeedsHolderOrGuardian(id)` on an agent's first launch | Bundle 529 |
| roles, listing | post-MVB (`Roles`, `Market`) — epoch-stamped by the same rule | — |
| **not** revoked: the seller's operator approvals | `rightsOf(id, operator) & CUSTODY` on tokens the seller still holds stays 8 — operators are per owner (`approvalEpoch`), the buyer starts with none | Bundle 534-535 |

### Survives for the buyer (DESIGN §2; Bundle.t.sol:436-479, 618-692 `test_theStewardMovesTheWholeBundle`)

| Line | Proving read | Evidence |
|---|---|---|
| the Reach's seal | `reach.sealedUntil()` unchanged; the buyer's `execute` with value reverts `ValueWhileSealed` | Bundle 476-479 |
| manifest and guarded pieces | `reach.manifest()`, `reach.holdings()` (pieces: no row) | Reach storage is the token's |
| the owned market: reserves, fee, curve, seal, anchors | `pool.marketOf(id)` words 2-3, 4, 9, 10, 11-12 unchanged; `marketHash(id)` unchanged; the seller's `withdraw` reverts `NotActor`, the buyer's succeeds | Bundle 436-444, 659-666 |
| sealed markets' fee streams | `pool.marketOf(key)` w15 `beneficiary == id`; `collect(key)` pays `feeSink(id)` = the Reach the buyer now signs for; `reach.owner()` == buyer | Bundle 459-465, 672-676 |
| Locks whose beneficiary is the Reach | `locks.lockCountOf(reach)`, `lockOf(id)` w1 `== reach`; `release` pays the Reach whoever holds the token | Bundle 679-682 |
| v4 positions in `LPCustodian` | post-MVB | — |
| the Grip's contents | `eth_getBalance(INTACT.grip)`, `erc20.balanceOf(grip)`; `grip.owner()` == buyer | Bundle 657 |
| the public archive and the home room | `parley.stateOf(homeKey).count` unchanged and growing under the buyer; the seller's `speak` reverts `NotYours` | Bundle 447-453, 669-671 |
| the name (custody is the binding) | Nameplate, band 0, post-MVB | — |
| traits | `coreOf` w14 `curve`, w15 `nameHash`; `getTraitValue` | the `Core` word moves only by `setTrait` |
| open-approval ledger entries | `reach.openApprovals()` unchanged — visible; `revokeOpenApprovals` is the buyer's (the seller gets `NotSignerOrGuardian`) | Reach.sol:1202-1232 |
| launches and their root | `launchpad.launchesOf(id)` unchanged | Bundle 683 |

The checklist's footer: *"Nothing the previous holder delegated comes
along"* — proven by `rightsOf(id, agent) == 0`, `keyOf(id) == 0`,
`wouldPass(id) == 0 or 1`, and the seller's `reach.execute` reverting
`NotSigner` (Bundle 686-691).

---

## 6. Table vs ABI (confirmation) and design gaps

### 6.1 Confirmation (recomputed here; `tools/verify.mjs:257-296` gates it in CI)

- **150 service rows.** 145 name a function the `src/` ABI in `out/solc.json`
  serves. The 5 `erc20.*` rows (`approve`, `allowance`, `balanceOf`,
  `symbol`, `decimals`) are checked by verify.mjs against `MockERC20`, which
  lives in the test compile, not `out/solc.json` — not a gap, the signatures
  are the ERC-20 standard's.
- **211 error entries.** Every error a panel-facing contract declares is in
  the table except `BadBand()` and `WrongRegistry()`, which are
  construction-only (verify.mjs `CONSTRUCTION_ONLY`). Every entry's selector
  is the keccak of its signature.
- **23 topics**, each the keccak of a declared event (hex in `abi-diff.mjs`
  output; e.g. `said` = `0x30e4249406fe738b64b07937b50b7ebab3215fe799d3fbd3f8917f3f3b91173c`,
  `transfer` = `0xddf252ad…b3ef`).
- Selector collisions across contracts are keyed apart by the `sel` key:
  `hub.release` = `locks.release` = `0x37bdc99b`; `catalog.stateOf` =
  `parley.stateOf` = `0x131a7e24`; `hub.approve` = `erc20.approve` =
  `0x095ea7b3`; `reach.execute` = `0x51945447` (the IERC6551Executable id).

### 6.2 Gaps the panels cannot route around (need a change in a U7-owned file, or a decision)

1. **Four state-block keys are shadowed** (Catalog.sol `TPL_WORLD` 860-868 vs
   `TPL_TOKEN` 870-877): `market`, `locks`, `steward` and `roles` appear in
   both — as the Market/Locks/Steward/Roles **addresses** in the world prefix
   and as the token's market object / `lockCountOf(reach)` / `wouldPass(id)` /
   `liveRoleCount` in the token middle. In JSON and as a JS literal the later
   key wins, so **`INTACT.locks` and `INTACT.steward` are numbers and the
   Locks and Steward addresses are absent from the state block**; `verify.mjs:191,193`
   already assert `S.locks === 0` and `S.steward === 0`, confirming the
   shadowing. The Vault panel's Locks and Steward sections and the Launch
   panel's Locks section therefore have no `to` address, and `hub.LOCKS()`/
   `hub.STEWARD()` have no `sel` rows. Fix: rename the four token-middle keys
   in `TPL_TOKEN` (e.g. `ownedMarket`, `reachLocks`, `stewardStatus`,
   `roleCount` — `lockCount` is taken by `Core.lockCount`) and the three
   `verify.mjs` lines that read them; `CATALOG_HASH` changes, which is
   expected before deployment. Until then the panels can only read
   `/services.json` rows' `contract` fields on the live origin (the
   `locks.*`/`steward.*` rows carry the addresses) — unavailable on the
   `data:` viewer.
2. **`Catalog.knownDelegates()` has no `sel` row and is not in the state
   block**, yet DESIGN §5.4 requires comparing `eth_getCode(holder)` to it
   before showing spend buttons. Add a row (`knownDelegates|Q|knownDelegates()|r|d|`)
   or bake the list into `TPL_WORLD`.
3. **Trait keys are not in the state block.** `setTrait` needs
   `keccak256("curve")` / `keccak256("name")` (IIntact.sol:59-60). The shell's
   proven keccak (needed for the panel hash check) can compute them; baking
   `"traits":{"curve":"0x…","name":"0x…"}` would keep the "no hashing in the
   browser for calldata" rule intact.
4. **Reactions (ERC-7409 `emote(address,uint256,string,bool)`)**: DESIGN §1
   and §7.5 call for them; the singleton has no letter and no row. Either a
   row keyed to a new letter whose address is the constant
   `0x3110735F0b8e71455bAe1356a33e428843bCb9A1`, or the panel says
   "reactions unavailable" everywhere until one exists.
5. **Writes DESIGN §1 screens name that have no row** (the panel cannot build
   them): Parley `evict(uint256,uint256,uint256)`, `setCooldown(uint256,uint256,uint32)`,
   `hide(uint256,uint256,uint64)` (the Rooms steward tools); Reach
   `guardNFT(address,uint256)` / `unguardNFT(uint256)` (Vault › "pieces");
   KeyRegistry `revokeEncryptionKey()`; Steward `heirHashOfToken(uint256,bytes32)`
   (instrument heirs: the panel would have to hash locally); Postage
   `claim(address)` (a wallet's own ledger — only matters if a wallet ever
   becomes a payee; today payees are Reaches/feeSinks and `claimRefund`/
   `claimSettled` cover both); `hub.safeTransferFrom(address,address,uint256,bytes)`
   (not needed). Post-MVB surfaces with no letter at all: `Market`
   (`list/delist/buy/claim`), `Roles`, `Nameplate`, `AgentCard`.
6. **Reads the screens want that have no row** (the state block covers most):
   Reach `pieces()`, `unmeasurable()`, `sessionCaps(address)`,
   `sessionCurrent(address)` (use `rightsOf & SESSION`), `isSealed()` (use
   `sealedUntil`), `auditRoot()`, `openApprovalsRoot()`; Parley `nameOf(uint256)`
   (group names — walk `founded` logs instead), `inRoom`, `invited`, `hidden`,
   `lastSpoke`, `pairKey`, `homeKey`, `topics()`; Postage `stampOf(uint256)`
   (the sender's refund screen needs `replyBy`/`refunded`); Launchpad
   `graduationTargetOf`, `firstLaunchApproved`, `lastLaunchAt`, `priceOf`,
   `launchKey`, `raisedOf`, `boughtInWindow` (the fair-window cap display);
   Steward `planHash`, the status-code getters (the codes are fixed 0..7,
   quoted above); hub `getApproved`, `isApprovedForAll`, `approvalExpiryOf`,
   `userOf`, `userExpires`, `guardianOf`, `agentWalletOf`, `locked`,
   `isTransferable`, `transferSealUntil` (all derivable from `coreOf`/`rightsOf`
   except operator enumeration, which no view offers); Grip `holdings(address[])`
   (use `eth_getBalance` + `erc20.balanceOf`); Catalog `open(uint256)`,
   `venues()`, `servicesOf(uint256)`, `routes()`, `bands()` (HTTP routes on the
   live origin; unreachable from the `data:` viewer).
7. **Events the panels would filter on that have no topic row** (a panel has
   no keccak for event signatures by design, so these histories cannot be
   walked without a row): Parley `Invited`, `Departed` (both are in
   `Parley.topics()` but not in `CatalogText.EVENTS`), `Hidden`, `CooldownSet`;
   Pool `Deposited`, `Withdrawn`, `MarketClosed`, `MarketSealed`, `CurveSynced`,
   `FeeSet`, `SealedOpened`, `WrittenDown`, `CurveAnchored`; Reach `Executed`,
   `SessionActed`, `AuditEntry` (the agent audit walk), `Sealed`,
   `ApprovalRecorded`, `ApprovalRevoked`, `AllSessionsRevoked`, `ManifestAdded/Removed`,
   `PieceGuarded/Released`; Launchpad `Sold`, `LaunchFailed`, `Refunded`,
   `Claimed`, `FirstLaunchApproved`; Postage `InboxConfigured`, `Expired`,
   `Refunded`, `Claimed`; Locks `Released`, `Extended`, `Given`; Steward
   `StillHere`, `Cancelled`, `Attested`, `NoticeStarted`, `Passed`; Router
   `Swapped(address,uint8,address,address,uint256,uint256)` (the table's
   `swapped` is the Pool's); Coin `Contributed`, `Redeemed`; KeyRegistry
   `EncryptionKeyRegistered`; hub `Approval`, `ApprovalForAll`,
   `OperatorApprovalTimed`, `AllApprovalsRevoked`, `UpdateUser`, `GuardianSet`,
   `GuardianHoldSet`, `TransferSealed`, `TraitUpdated`, `AgentWalletProposed/Set`,
   `FeesToGripSet`, `TokenUriPinned/Unpinned`, `Locked(uint256)`/`Unlocked`.
   The MVB panels can render every screen from reads alone; only history
   views (trade history, audit walk, inbox receipts) need rows.

### 6.3 Behavioural facts the panels must encode (not gaps, but easy to get wrong)

- `parley.heads` returns head **blocks**; a count is `stateOf(room)` w1.
- A home room does not exist until its steward's first word there: `join`
  reverts `NoSuchRoom` → render "this token has not spoken yet"
  (DESIGN §3 residuals; Parley.sol:283-286, 466-473).
- `kiln.coinAt` must be called with `by` = the address that will send
  `launch` (wallet vs Reach), or the predicted address is wrong.
- `launchpad.buy` is native-only (`quoteIn = msg.value`); `sell` moves
  credits, no approval; `claim`/`refund` are anyone-may-pay with a fixed
  recipient.
- ERC-20 postage is paid by the sender's **Reach**, never the wallet.
- `swapExactOut` with an ERC-20 input can leave a residual allowance; prefer
  `swapExactIn` or re-check `allowance` after the receipt.
- `executeTyped` requires the standing allowance to `to` to be zero
  (`AllowanceNotZero`); `revokeOpenApprovals` first if a prior `execute`
  approved the same spender.
- `hub.pause` reverts `NotGuardian` for a non-holder non-guardian (RightsLogic.sol:139);
  `hub.panic` reverts `NotAuthorized` (CoreLogic.sol:231).
- `rightsOf` clears CUSTODY under `guardianHold` without touching the store;
  it returns with `release` (RightsLogic.sol:58-64).
- `Catalog.stateOf` is the one read that reverts honestly: `NoSuchToken`
  for an unminted id (Catalog.sol:1306).
