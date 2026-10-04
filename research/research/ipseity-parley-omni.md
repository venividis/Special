# IPSEITY (Most-Advanced-NFT-Possible) — messaging, federation, naming

Reader area: `src/Parley.sol`, `src/ParleyPort.sol`, `src/Roster.sol`, `src/Nameplate.sol`, `OMNICHAIN.md`, `test/Parley.t.sol`, `tools/port.mjs`, plus everything that delivers or tests them (`DeskTalk`, `PageTalk`, `PageRooms`, `DeskRooms`, `DeskSeal`, `PageName`, `PageManifest`, `Premises` routes, `tools/verify-parley|port|plate|site.mjs`, `tools/probe-port-abi.mjs`, `tools/ens-name.mjs`, `test/mocks/MockEndpoint|MockENS|MockRegistrar|MockHub|MockAccount.sol`, `deployments/port-*.json`).

Repo state read: default branch at `297e936` (2026-09-23, "Merge pull request #40 … run-complete-testnet-on-sepolia"), 103 commits. Toolchain per `CLAUDE.md`: solc 0.8.36 via solc-js, viaIR, optimizer 800, cancun, size gate at EIP-170. Nothing was built or run for this report; bytecode sizes below were read from the `out/solc.json` artifact already present in the checkout (written 2026-10-02 18:22 by the environment, not by me).

A note on the project's own vocabulary, which the code uses everywhere: the **hub** is `Ipseity.sol` (the ERC-721); the **Reach** is `hub.account(id)` (the token's spending ERC-6551 account); the **Grip** is `hub.account`'s receive-only sibling `hub.grip(id)`; the **Premises** is the ERC-5219 router that *is* the website.

---

## 0. The shape of this subsystem in one paragraph

Messaging is one contract, `Parley`, that stores almost nothing: every message is an event log, and what the contract keeps per room is the block number of the newest message plus a counter. Every `Said` log carries the block number of the previous message in the room (`prev`) and of the previous message by the same token anywhere (`prevFrom`), so a client reads a conversation backwards with *single-block* `eth_getLogs` calls and never a range scan — the chain is the index, and no indexer exists. Who may speak as token N is `ownerOf(N)` or N's own ERC-6551 Reach, never the ERC-4907 renter. `Roster` is a stateless read-only companion that enumerates group membership as 256-bit bitmaps without touching the archive. `ParleyPort` is a LayerZero V2 OApp with no admin that carries only the commons (room 0) to peer chains and emits what arrives under its *own* event, rewriting the back-link into the receiving chain's block numbers. `Nameplate` is an adminless ENS resolver: a name means a token (by custody of the name NFT inside the token's 6551 account, or by an explicit bind), `addr` is the Reach, `text("contentcontract")` is the Premises per ERC-6821 so `web3://name.eth/chat` opens the chain-served site, and `<id>.parent.eth` resolves by ENSIP-10 wildcard. The web UI for all of it is Solidity string constants returned by page contracts through `Premises.request()`; the browser ships no keccak and no ABI coder, and ownership is verified by reading `balanceOf`/`tokenOfOwnerByIndex` off the hub and then by the contract itself refusing any transaction that fails `mayActAs`.

---

## 1. `src/Parley.sol` — the archive that is the logs (455 lines)

### Purpose
On-chain group/pair/commons messaging between tokens with no database, designed so that a browser with only a public RPC can read any room without an indexer. Header comment (`Parley.sol:10–68`) is the design argument; the load-bearing passage:

> "Logs are cheap to write and famously miserable to read. `eth_getLogs` over a range wide enough to hold a conversation is the request every public endpoint rate-limits first, and the usual answer is an indexer: a server, which is the thing this collection exists not to need. So every message carries a pointer to the block of the message before it, and the room stores the block of the most recent one. A client reads `last`, asks for exactly that one block, gets the message and the pointer to the block before, and walks. Fifty messages is fifty single-block queries — the narrowest request `eth_getLogs` accepts — and no range scan at any point. The chain is the index. It costs one `SSTORE` to a warm slot per message to make it so." (`Parley.sol:28–39`)

### Dependencies
`interface ISpeaker { ownerOf(uint256); account(uint256); totalSupply(); }` (`Parley.sol:4–8`) — the only thing Parley needs from a hub. `HUB` is `immutable` (line 70). `totalSupply` is declared but unused by Parley itself (Roster uses the hub's directly).

### Constants and shape
- `COMMONS = 0`; `MAX_BODY = 1024`; `MAX_NAME = 48` (lines 75–80).
- Kinds: `PLAIN = 0` (UTF-8), `SEALED = 1` ("nonce ++ AES-GCM ciphertext") (82–83). `_say` rejects `kind > SEALED` (`BadKind`).
- Room kinds: `IS_COMMONS = 0`, `IS_GROUP = 1`, `IS_PAIR = 2` (85–87). Note kind 0 is also what an unfounded room reads back as — Roster exists partly to disambiguate (see §2).
- `struct Room { uint64 last; uint64 count; uint64 opened; uint32 members; uint8 kind; bool open; uint256 steward; uint256 index; }` (89–98). First six fields pack into one 30-byte slot; `steward` and `index` take one slot each → 3 slots per room. `last`/`count` share a slot, so `_say`'s two room writes are one SSTORE.

### Storage layout (slot order as declared; `HUB` is immutable and takes no slot)
| slot | variable | type |
|---|---|---|
| 0 | `_room` | `mapping(uint256 => Room)` |
| 1 | `nameOf` | `mapping(uint256 => string)` (public) |
| 2 | `inRoom` | `mapping(room => mapping(token => bool))` (public) |
| 3 | `invited` | `mapping(room => mapping(token => bool))` (public) |
| 4 | `_seen` | `mapping(token => uint256[])` — every room a token ever entered |
| 5 | `lastSpoke` | `mapping(token => uint64)` (public) |
| 6 | `groups` | `uint256` — count of groups founded, also next index |
| 7 | `_sealX` | `mapping(token => bytes32)` |
| 8 | `_sealY` | `mapping(token => bytes32)` |
| 9 | `_sealOwner` | `mapping(token => address)` — who published the key |

Constructor writes `_room[0].kind = IS_COMMONS; opened = block.number` (157–162).

### Public API (full signatures)
```
function mayActAs(uint256 token, address who) public view returns (bool)                       // 168
function groupKey(uint256 index) public pure returns (uint256)                                 // 189  keccak(abi.encodePacked(uint8 1, index))
function pairKey(uint256 a, uint256 b) public pure returns (uint256)                           // 195  keccak(abi.encodePacked(uint8 2, min, max))
function speak(uint256 room, uint256 from, uint8 kind, bytes calldata body) external           // 203
function whisper(uint256 from, uint256 to, uint8 kind, bytes calldata body) external           // 225
function found(uint256 by, string calldata name, bool openDoor) external returns (uint256 key)  // 261
function invite(uint256 room, uint256 by, uint256 token) external                              // 285
function join(uint256 room, uint256 token) external                                            // 295
function leave(uint256 room, uint256 token) external                                           // 304
function evict(uint256 room, uint256 by, uint256 token) external                               // 312
function announce(uint256 token, bytes32 x, bytes32 y) external                                // 347
function keyOf(uint256 token) external view returns (bytes32 x, bytes32 y)                     // 355
function sealX(uint256 token) external view returns (bytes32)                                  // 360
function sealY(uint256 token) external view returns (bytes32)                                  // 365
function keysOf(uint256[] calldata tokens) external view returns (bytes32[] xs, bytes32[] ys)  // 376
function stateOf(uint256 room) external view returns (uint64 last, uint64 count, uint64 opened, uint32 members, uint8 kind, bool open, uint256 steward, uint256 index, string memory name) // 387
function heads(uint256[] calldata rooms) external view returns (uint64[] last, uint64[] count) // 404
function roomsOf(uint256 token) external view returns (uint256[] keys, bool[] member)          // 419
function roomCount(uint256 token) external view returns (uint256)                              // 432
function topics() external pure returns (bytes32 said, bytes32 founded, bytes32 entered, bytes32 departed, bytes32 announced) // 445
```
plus public getters `HUB()`, `COMMONS()`, `MAX_BODY()`, `MAX_NAME()`, `PLAIN()`, `SEALED()`, `IS_COMMONS()`, `IS_GROUP()`, `IS_PAIR()`, `nameOf(uint256)`, `inRoom(uint256,uint256)`, `invited(uint256,uint256)`, `lastSpoke(uint256)`, `groups()`.

### Events
```
event Said(uint256 indexed room, uint256 indexed from, uint64 prev, uint64 prevFrom, uint64 seq, uint8 kind, bytes body)   // 129
event Founded(uint256 indexed room, uint256 indexed by, uint256 index, bool open, string name)                               // 138
event Invited(uint256 indexed room, uint256 indexed token, uint256 by)
event Entered(uint256 indexed room, uint256 indexed token)
event Departed(uint256 indexed room, uint256 indexed token)
event Announced(uint256 indexed token, bytes32 x, bytes32 y)
```
`Said` data layout the clients decode by hand: word0 `prev`, word1 `prevFrom`, word2 `seq`, word3 `kind`, word4 offset of `body` (0xa0), then length + bytes (`DeskTalk.sol:166–172`, `verify-parley.mjs:89–102`).

### Custom errors
`NotYours, NoSuchToken, NoSuchRoom, NotAMember, NotTheSteward, NotInvited, AlreadyIn, BadBody, BadKind, BadName, TalkingToYourself, UseWhisper` (144–155).

### Access control
Everything that writes goes through `_asToken(token)` → `mayActAs(token, msg.sender)`: `msg.sender == HUB.ownerOf(token) || msg.sender == HUB.account(token)` (168–181). `ownerOf` is wrapped in `try/catch` so a nonexistent token returns `false` instead of bubbling the hub's `Nonexistent()`. There is no owner, no admin, no pause. The rationale is stated:

> "The owner, and the token's own ERC-6551 account. Not the renter. Leasing the instrument buys its use for a while; it does not buy the right to speak in its name, and a reputation is not a thing you can hand back at the end of the day. The bound account is included because it is the token acting for itself — its session keys are the owner's own delegation, made narrowly and revocably, which is the whole point of that account." (45–52)

Steward-only: `invite`, `evict` (`r.steward != by → NotTheSteward`). `join`/`leave` are the token's own call.

### Behaviour and invariants
- `speak` (203–222): commons passes everyone; a group requires `inRoom[room][from]`; a *pair key* is refused with `UseWhisper` — "A pair room is reachable only through the derivation, and the derivation is where its membership is proved. Letting a raw key in here would mean checking membership against something stored, which is the storage this design does without." (212–215); any other key → `NoSuchRoom`.
- `whisper` (225–237): `from != to`, `to` must exist, room `= pairKey(from,to)` is lazily created with `kind = IS_PAIR` on first use.
- `_say` (241–257): body length `1..1024`, kind `≤1`; `prev = r.last; prevFrom = lastSpoke[from]; seq = ++count`; then `r.last = lastSpoke[from] = block.number`; emits `Said`. Two SSTOREs (room slot, lastSpoke slot) + the log.
- `found` (261–282): name `1..48` bytes, `index = ++groups`, `key = groupKey(index)`, steward = founder, founder auto-enters.
- `_enter` (322–331): sets `inRoom`, bumps `members`, appends room to `_seen[token]` only if not already there (O(n) scan). Rejoining never duplicates. `_depart` (333–338) clears `inRoom`, decrements `members` if nonzero, never shrinks `_seen`:

> "Every room a token has ever entered, appended once. Leaving does not remove the entry — `inRoom` is the authority on membership and this is only the list of places worth asking about. Nobody but the token itself can make it longer, which is the reason `invite` records permission and `join` is the token's own call: an array a stranger can grow is an array a stranger can fill." (106–111)

- Eviction cannot unsay anything (nothing can): `evict` only flips `invited` and `inRoom`.
- Sealing keys (340–383): `announce` stores `(x, y)` **and the publishing owner** (`_sealOwner[token] = HUB.ownerOf(token)`); every getter returns zero unless `_sealOwner[token] == ownerOf(token)` now. Added in `4fa41d0` "Invalidate sealing keys when tokens transfer" (2026-09-15) after the sealed-DM page was found to promise privacy to a departed holder (DEPLOYMENTS.md:390–400). The design cost is stated: "Replacing it is allowed and makes every earlier sealed message unreadable to the token itself — which is a real cost, and the reason a client derives the key from a signature rather than generating one it has to keep." (343–346). No on-curve check is done on `(x, y)`.
- `topics()` (445–454) hashes the five event signature strings on chain: "The client that reads this chat has no keccak — deliberately, because a hash function shipped in a page is a hash function nobody checked. It cannot compute a topic filter, so it asks the contract that emits the events what they are, and the answer is derived from the same string the compiler hashes." (441–444)
- `heads(rooms[])` is the polling primitive: one call, two arrays; clients compare `count` to what they have rendered (`DeskTalk.sol:222–225`, 9 s interval).

### Gas and size
- Runtime bytecode **6,379 B (26.0% of EIP-170)** measured from `out/solc.json`; README's older table says 6,069 B (README.md:1047).
- `speak` is 2 SSTOREs + 1 LOG with up to 1 KB data; `tools/gas.mjs:169–173` executes `speak` and `found` to populate rooms before measuring page `eth_call` costs but does not report Parley gas itself. No per-call gas number is recorded anywhere in the docs.
- Reads: `stateOf`, `heads` are O(rooms); `roomsOf` O(rooms ever entered) with a cold SLOAD per entry.

### Standards
None claimed. It is deliberately not ERC-7xxx anything; the interface to the hub is ERC-721 `ownerOf` plus ERC-6551 `account`.

### Tests
- `test/Parley.t.sol` — 26 `test_*` functions on the Foundry-shaped suite run by `tools/forge.mjs`. Most telling: `test_theBoundAccountMaySpeakAndTheRenterMayNot` (sets an ERC-4907 user via `token.setUser` and asserts `mayActAs` is false for the renter), `test_aPairRoomCannotBePostedToThroughSpeak`, `test_nobodyCanLengthenSomebodyElsesRoomList`, `test_evictionCannotUnsayAnything`, `test_transferInvalidatesTheFormerHoldersSealingKey`, `test_theTopicsAreDerivedFromTheSignaturesThemselves`, `test_aGroupKeyIsNeverAPairKey` (brute-forces 5 group keys against 15 pair keys). The suite header records a harness trap: "`at` is read out of the contract rather than out of `block.number` … the optimiser is entitled to read NUMBER once and reuse it — and it sinks that read to the first use, which here would be *after* `vm.roll`" (124–133).
- `tools/verify-parley.mjs` — 37 assertions (per commit `6f22f12`; 38 `ok/eq` call sites by grep) on the in-process EVM. It is a deliberately *second* walker ("Two independent readers of the same archive have to agree"). Telling assertions: "405 blocks of history, read in 3 single-block queries", "two messages in one block do not send the walk in a circle", and "and following the newest log instead would have looped, which is why it does not" — the naive walker is actually run and watched loop (lines 170–186). Also "a body that is markup comes back as the same characters … byte for byte" with `</script><img src=x onerror=alert(1)>é→🔥`.
- `tools/verify-site.mjs` drives the *shipped* client (`DeskTalk`) in a DOM shim: "pressing send put a message on the chain", "the hostile one reads exactly as it was typed", "because the client never assigned innerHTML to it", "and every one of them asked for exactly one block", "the client derived the pair room rather than being told it", "without touching the commons" (1225–1310); the sealed-room drive (2723–2878): "one press derived from a signature and published the point", "the envelope says sealed out loud", "and the words are not in the bytes", "the other end derives the same secret and reads it", "a sale invalidates the departed holder's published key".
- `tools/testnet.mjs` seeds a commons/group/whisper conversation over JSON-RPC and walks it back through a real node's `eth_getLogs` ("a live node refuses a wallet speaking as a token it does not hold", line 283).
- Invariants 79–93 in `INVARIANTS.md:439–527` map each property to the exact test.

### Known weaknesses / TODOs
- No spam control in the commons beyond gas; with 4,096 tokens and bots, the single commons could become unreadable, and clients paginate only by walking.
- `MAX_BODY` 1,024 bytes; README says "A client that wants to send an essay can send four" — no multi-part convention exists.
- No reply/thread pointer other than `prev`/`prevFrom`; no reactions, no edit marker, no attachment convention.
- Group messages are public to read; only pairs can be sealed (DeskSeal is pair-only).
- `_seen` scan is O(n) per `join`; fine for human use.
- `announce` accepts any 64 bytes; a garbage point breaks the far side's `importKey` (client falls back to plaintext with a message).
- `HUB.account(token)` is an external call into the ERC-6551 registry's CREATE2 derivation on every write — correct but not free.

### Reuse verdict: **adapt** (close to verbatim)
The contract is self-contained, adminless, and already proven on two testnets. To drop it into the unified protocol: point `ISpeaker` at the new hub (needs `ownerOf`, `account`), decide whether session-key holders of the Reach should count (they already do, through the account calling), and consider adding a `reply` reference and a group-key ceremony if sealed groups are wanted. Keep the back-link mechanism exactly as is.

---

## 2. `src/Roster.sol` — enumeration without an indexer (187 lines)

### Purpose
"Parley can tell you a room holds nine tokens. It cannot tell you which nine … Enumerating it the usual way means replaying `Entered` and `Departed` from the beginning of the chain — a range scan … So the answer is asked the other way round. The collection is finite and its tokens are numbered from one, so a reader can simply ask about a window of them at once: two hundred and fifty-six memberships come back packed into a single word, from a single `eth_call`" (`Roster.sol:20–36`). It was built additive, because "The messages are the collection's memory, and the contract that holds them is kept across every redeploy of this site … This contract can be thrown away and rewritten every week; the archive underneath it does not notice." (38–45)

### API
```
function kindOf(uint256 room) public view returns (uint8)                                   // 78  0 commons · 1 group · 2 pair · 3 NO_ROOM
function inWindow(uint256 room, uint256 from) external view returns (uint256 bits)           // 103 bit i = token from+i is a member
function invitedInWindow(uint256 room, uint256 from) external view returns (uint256 bits)    // 118 invited and not yet in
function membersOf(uint256 room, uint256 from) external view returns (uint256[] ids)         // 132 same window, as a list
function stewardedBy(uint256 token, uint256 fromIndex, uint256 count) external view returns (uint256[] keys, uint256[] indexes) // 157
function heldBy(uint256 token) external view returns (address)                               // 184 ownerOf or zero
```
Constants `WINDOW = 256`, `COMMONS`, `IS_COMMONS/IS_GROUP/IS_PAIR`, `NO_ROOM = 3`. Immutables `PARLEY`, `HUB`. **No storage, no events, no errors, no writes.**

### Semantics worth knowing
- `_in` (92–96): commons → always true (Parley never writes `inRoom` for room 0); group → `PARLEY.inRoom`; pair → false ("its key is the hash of its two members, so holding the key *is* the proof, and there is no third token to ask about").
- `kindOf` maps Parley's kind-0-for-unfounded to `NO_ROOM = 3` — Invariant 114 records the live bug this fixed: on Base Sepolia the panel said the commons was empty.
- Windows skip `id == 0` and `id > HUB.totalSupply()`; this assumes ids `1..totalSupply` are contiguous — true for the Ethereum-only edition (`FIRST_ID = 1`), and the client-side fix `0522015` "Scan sparse room rosters through token supply" made DeskTalk/DeskRooms loop `base = 1; base <= supply; base += 256` instead of stopping at the first empty window.
- Cost note in source: "Reading 256 tokens costs one call and roughly 256 cold storage reads — about 550k gas of `eth_call`, which is free to the reader and never mined." (100–102)
- `stewardedBy` derives every group key from `groups()` and `groupKey(i)` — paged, "no event replay, no registry, nothing to keep in sync."

### Size / tests
Runtime **3,267 B (13.3%)**. Tested in `tools/verify-site.mjs:1830–1908` ("who is in the room, and who may show them out": "an invitation shows as invited, not as present", "the commons holds every token, not none of them", "the commons, a group and a key nobody founded are three different answers"). Wired to `DeskTalk.ROSTER`, `DeskTerm.ROSTER` (site.mjs:434–435). Deployed: Base Sepolia `0x94bda49e…d5cc`, Ethereum Sepolia `0x9286f2f1…e1f2`.

### Reuse verdict: **reuse-verbatim**
Pure view companion; only assumption is contiguous ids from 1 and a hub with `totalSupply`/`ownerOf`. If the unified hub uses a different id scheme, parametrise `from`/`supply` — nothing else changes.

---

## 3. `src/ParleyPort.sol` — the commons, federated (397 lines)

### Purpose
Carry room-0 speech to other chains over LayerZero V2 while guaranteeing the local commons never depends on it. The header (34–125) is the design record. Load-bearing passages:

> "`Parley.speak` is untouched. It is free, it is local, it has no dependency on this contract or on any bridge … Federation is a SEPARATE payable call. A holder who never touches it loses nothing; a chain whose port is dark still has a complete commons. That ordering is the point. A social layer that needs a message to arrive before anyone can talk is a social layer with a single point of silence." (43–53)

> "Groups stay local because a group has a steward, and a steward is an authority; carrying that across would mean trusting a message to say who may speak. Pairs stay local for a better reason: a pair room is derived from two token ids, and under the partition those two ids may live on different chains … There is no correct way to do it and so there is no function for it." (59–65)

> "This port cannot write into Parley at all. It has no privilege there and asks for none — Parley checks `mayActAs` against the caller, and this contract is not a token. What arrives is emitted here, under this contract's own event, tagged with where it came from." (67–70)

> "That pointer is meaningless on another chain — block 21,000,000 on Ethereum is not block 21,000,000 anywhere else. So the sender's pointer is dropped at the border and this contract writes its own, in the receiving chain's numbering." (80–84)

> "An earlier version of this comment claimed more — that the verifier set itself was frozen — and that was wrong. An OApp that pins nothing runs on the endpoint's DEFAULT send library, receive library and DVN set, and LayerZero Labs can roll those defaults forward without this contract's consent … Speech, not custody, is what makes that trade admissible — pin a 1-of-1 verifier under something that MINTS and the same arrangement has already cost other protocols nine figures." (96–113)

### Interfaces declared by hand (no LayerZero imports)
`ILayerZeroEndpointV2` with `quote`, `send`, `setDelegate`, `eid`, `setSendLibrary`, `setReceiveLibrary`, `setConfig` and the structs `MessagingParams`, `MessagingFee`, `MessagingReceipt`, `SetConfigParam` (9–26). `struct Origin { uint32 srcEid; bytes32 sender; uint64 nonce; }` at file scope (32) — "A STATIC tuple — three words laid inline — and the shape is part of the signature". `IParleyRead { mayActAs; MAX_BODY }` (4–7). Constructor-arg structs `LanePin { uint32 eid; address sendLib; address receiveLib; }` (128) and `ConfigPin { address lib; uint32 eid; uint32 configType; bytes config; }` (135).

### Storage
Immutables `PARLEY`, `ENDPOINT`, `LOCAL_EID` (read from `endpoint.eid()` in the constructor). Constants `COMMONS = 0`, `MAX_BODY = 1024`, `DEFAULT_OPTIONS = hex"00030100110100000000000000000000000000030d40"` (22-byte type-3 options naming 200,000 lzReceive gas, laid out byte-for-byte in the comment at 146–160).
| slot | variable |
|---|---|
| 0 | `uint32[] internal _peerEids` |
| 1 | `mapping(uint32 => bytes32) public peerOf` |
| 2 | `uint64 public lastEcho` + `uint64 public echoCount` (packed) |

### API
```
constructor(IParleyRead parley, ILayerZeroEndpointV2 endpoint, uint32[] peerEids, bytes32[] peers, LanePin[] lanePins, ConfigPin[] configPins)  // 193
function peers() external view returns (uint32[] memory)                                                     // 235
function quoteEcho(uint256 from, uint8 kind, bytes calldata body, bytes calldata options) public view returns (uint256 total) // 244
function echo(uint256 from, uint8 kind, bytes calldata body, bytes calldata options) external payable          // 268
function allowInitializePath(Origin calldata origin) external view returns (bool)                              // 338  selector 0xff7bd03d
function nextNonce(uint32, bytes32) external pure returns (uint64)  { return 0; }                              // 351  selector 0x7d25a05e
function lzReceive(Origin calldata origin, bytes32 guid, bytes calldata message, address executor, bytes calldata extraData) external payable // 360  selector 0x13137d65
function supportsInterface(bytes4 id) external pure returns (bool)                                             // 394  ERC-165 only
```
Events: `Echoed(uint32 indexed originEid, uint256 indexed fromToken, uint64 prev, uint64 seq, uint8 kind, bytes body)`, `Sent(uint32 indexed dstEid, uint256 indexed fromToken, bytes32 guid)`. Errors: `NotYours, BadBody, NoPeers, NotTheEndpoint, UnknownPeer(uint32), Underpaid(uint256)`.

### Behaviour
- Constructor: refuses empty/mismatched peer arrays (`NoPeers`); applies `setSendLibrary`/`setReceiveLibrary` per `LanePin` (zero means leave default) and one `setConfig` per `ConfigPin`; then `endpoint.setDelegate(address(0))` — "No admin, from the first block. There is no function in this contract that can undo this — or any of the above." (230–232). The endpoint authorises the OApp itself for config calls, which is why the constructor is the one moment a pin can be written without a delegate.
- `quoteEcho` encodes `abi.encode(LOCAL_EID, from, kind, body)` and sums `ENDPOINT.quote(...).nativeFee` over every peer; empty `options` → `DEFAULT_OPTIONS`. An unwired lane reverts *here* (the default verifier library reverts with "Please set your OApp's DVNs and/or Executor").
- `echo`: `PARLEY.mayActAs(from, msg.sender)` else `NotYours`; body bounds; `msg.value >= quote` else `Underpaid(want)`; loops peers calling `quote` then `send{value: fee}` with `refundTo = msg.sender`; emits `Sent` per lane; returns surplus with a low-level call ("A port that quietly keeps the difference between the quote and the fee is a port with a revenue model nobody was told about", 295–297). Minor wart: a failed refund reverts with `Underpaid(spent)`, a misleading name.
- `lzReceive`: `msg.sender == ENDPOINT` else `NotTheEndpoint`; `peerOf[origin.srcEid] == origin.sender` else `UnknownPeer`; decodes `(uint32 originEid, uint256 from, uint8 kind, bytes body)`; **refuses if the body's claimed eid ≠ the DVN-attested `origin.srcEid`** ("A peer that says one thing to the verifiers and another in the body is refused rather than believed on either count", 374–377); body bounds; `prev = lastEcho; lastEcho = block.number; ++echoCount; emit Echoed(originEid, from, prev, echoCount, kind, body)`. It does **not** check that `from` exists locally — by design, a foreign id is a foreign id.
- `allowInitializePath` answers the peer table; `nextNonce` is 0 ("no ordered delivery is promised or wanted … Speech carries its own back-links, so arrival order is cosmetic", 343–350).

### The bug this file records (the most instructive thing in the area)
Lines 304–330 and `OMNICHAIN.md` §4: for one commit `lzReceive` was declared with `bytes calldata origin`, selector `0x42172c88`, "a dialect nothing on any chain speaks"; the real endpoint dispatches `0x13137d65`. `allowInitializePath` and `nextNonce` were missing, so no lane could initialise. The suite stayed green because the mock endpoint had been written to match the contract. `tools/probe-port-abi.mjs` drives the raw protocol encodings at the deployed bytecode and proves dispatch "by reaching a named refusal (`NotTheEndpoint`, `0x839e0a50`), never by success". The fix commit `6f22f12` also found the second mock-politeness hole: empty options are refused by ULN302 at quote time (`Executor_NoOptions`).

### Size / gas / measured live run
- Runtime **4,246 B (17.3%)**, creation 6,420 B.
- Live (DEPLOYMENTS.md:593–629, `deployments/port-84532.json`, `port-11155111.json`): deployed 2026-08-22 at `0x65d1e9d08488a68ef6bf48e057ab69496333c7ae` on **both** Base Sepolia (eid 40245) and Ethereum Sepolia (eid 40161) from a fresh nonce-0 key `0x9a916d0b…3fd13`; each names the other as its only peer; delegate reads zero on both. `echo(3, 0, "the commons, heard on another chain", "")` from Ethereum Sepolia: quoted and paid **104,037,152,596,558 wei**, tx `0xff7b05c8…80e5`, **323,518 gas**; delivered by the real DVNs/executor in ~80 s into Base Sepolia block **45,828,666** (tx `0xe44941a1…05b38`); `port.mjs walk` read it back in one single-block query. Costs: ~0.00267 ETH on Ethereum Sepolia for deploy+mint+echo, ~0.0000096 ETH on Base Sepolia for its deploy.
- `OMNICHAIN.md` §2 table of measured endpoints (24,005 B EndpointV2 code each): Ethereum eid 30101, Base 30184, Unichain 30320, BNB 30102, Robinhood 30416 (no lzRead), Ethereum Sepolia 40161, Base Sepolia 40245, Robinhood testnet 40451 at a fourth endpoint address `0x3aCAAf60…Fe32`. lzRead measured from Unichain→Ethereum at 1.957e-5 ETH vs 3.404e-4 ETH to message (17× cheaper).

### Tests
`tools/verify-port.mjs` — **42 assertions** (commit `6f22f12`; 44 call sites by grep). Section heads are the invariants: "the verifier set is frozen in the constructor" (ABI scanned for `setConfig|setDelegate|setPeer|addPeer|owner|admin|setSendLibrary|setReceiveLibrary`), "the pin: config written once, from the constructor, or never", "the port speaks the protocol's ABI, not its mock's" (asserts `0x13137d65`, `0xff7bd03d`, `0x7d25a05e` byte-for-byte and the lane truth table), "only the commons crosses" (ABI scanned for `group|pair|whisper|found|invite`), "an unwired lane refuses at quote time", "with the lane wired, speech crosses" (underpaid refused, overpayment returned), "delivery needs no privilege, and lands as foreign" (a stranger calls `deliver`), "the back-link is rewritten into this chain's numbering", "a peer nobody named cannot be heard — on either side of the border" (uses the mock's `inject`/`deliverUnchecked`), "the local commons never needed any of this" (Parley's ABI contains no `port|layerzero|lz|eid`). `test/mocks/MockEndpoint.sol` performs the real `allowInitializePath` handshake and builds delivery with `abi.encodeCall` so "the selector is the compiler's, not this file's"; it refuses `options.length < 2` like ULN302. Invariants 136–143 (`INVARIANTS.md:957–1046`).

### Known weaknesses / TODOs
- Floats on default DVNs unless pinned; the docs call that admissible for speech only. Mainnet lanes and the per-lane pin decision are explicitly open (`OMNICHAIN.md` §6).
- `quoteEcho`/`echo` are all-or-nothing across peers: one unwired lane blocks every echo.
- **Stale wiring on Ethereum Sepolia:** `port-11155111.json` records `parley: 0x5973a4d1…e7eb`, but `deployments/eth-sepolia.json` now records `parley: 0x99f5d809…8705` — the site was redeployed under the port, so the live Sepolia port's immutable `PARLEY` (and therefore its `mayActAs` → old hub) is stale. Base Sepolia agrees (`0xaa8b3ff6…e0f2` in both).
- On the default branch **no client renders `Echoed`**: `DeskTalk` walks only `Said`; the console's SPEAK lane is "unbuilt" (`engine/console-lanes.js:419–424`). The unmerged branch `claude/claude-md-docs-8vvyc8` (commits `68ce265`, `7f8565e`, `8fe6931`) adds `PageConsole(…, parley, port)`, `ConsoleRead.sels()` growing `lastEcho/echoCount` (58 entries), and a "HEARD FROM OTHER CHAINS" column walked along `Echoed.prev` with eid→name labels, verified live on Base Sepolia (`lastEcho()` = 45,828,666). Not on HEAD.
- `ParleyPort` is not in `site.mjs EXPECTED` or `deployments/<chain>.json`; CONSOLE.md:563 lists `ParleyPort.echo` as "written, unreachable".
- The project then went **Ethereum-only** (`fe990f7`, 2026-09-18), which removes the port's reason to exist for the token edition; it survives as an optional speech satellite.

### Reuse verdict: **adapt** (or drop if the unified protocol is single-chain)
The contract is the best small example in all four repos of a correct, adminless LayerZero V2 receiver with construction-time pinning and a real live run. Reuse the pattern (no delegate, pin in constructor, origin-vs-body check, back-link rewrite, same-address nonce-0 mesh deploy, permissionless delivery) if cross-chain messaging is wanted; otherwise drop it and keep `OMNICHAIN.md` as the decision record for refusing ONFT.

---

## 4. `src/Nameplate.sol` — the adminless ENS resolver (715 lines)

### Purpose
"Point a name you own at this resolver and bind it to a token, and the name means the token everywhere ENS is read: `addr(node)` → the token's own 6551 account … `text(node,"contentcontract")` → the Premises, per ERC-6821 — a web3:// browser resolves the name straight into this site with no IPFS and no gateway … `text(node,"avatar")` → the token's sigil, as an eip155 NFT reference … `text(node,"url")` → an https gateway link … And once a parent name is claimed, every token is addressable with no registration at all: `7.yourname.eth` resolves to token 7, by ENSIP-10 wildcard" (`Nameplate.sol:38–56`).

Custody is the stronger binding: "A wrapped name does not have to be bound at all. Put its NameWrapper NFT into a token's account and the name means that token, with no transaction on this contract and nothing to remember: custody is the claim. That is the stronger claim, so it wins over `bind`." (60–67) "An account's own word is not enough. Any contract can implement `token()` and claim to be token 7's; the canonical NameWrapper must own the registry node and its answer must be the account. Registry control alone is deliberately insufficient because a .eth registrant can reclaim that control without a transfer from the account." (79–83) — this sentence is the fix from `b43645e` "Authenticate ENS name custody" (2026-09-14), which closed a spoof where an unwrapped registry controller or a non-canonical wrapper could counterfeit custody.

### Interfaces (hand-declared)
`IEnsRegistry.owner(bytes32)`; `IEthRegistrar.nameExpires(uint256 labelhash)`, `GRACE_PERIOD()` — with the trap documented: "`nameExpires` takes the LABEL's hash, not the node's — `keccak("ipseity4d")`, not the namehash of `ipseity4d.eth`" (10–13); `INameWrapperLike.ownerOf(uint256)`; `IHubNames { ownerOf; account; grip; totalSupply }`; `IBoundAccount.token() → (chainId, tokenContract, tokenId)` (ERC-6551).

### Storage
Immutables `ENS`, `HUB`, `NAME_WRAPPER`, `PREMISES`. Constant `EDITION = 4096`, `ETH_NODE = namehash("eth")`, four interface ids (`ADDR_IFACE 0x3b3b57de`, `CONTENTHASH_IFACE 0xbc1c58d1`, `TEXT_IFACE 0x59d1d43c`, `WILDCARD_IFACE 0x9061b923`).
| slot | variable |
|---|---|
| 0 | `bytes32 public parentNode` (write-once) |
| 1 | `mapping(bytes32 => uint256) public tokenOf` (node → token, 0 = unbound) |
| 2 | `mapping(uint256 => Station{premises,hub}) public stationOf` (chainId → deployment; vestigial) |
| 3 | `address public renewer` (write-once) |

### API
```
constructor(IEnsRegistry ens, IHubNames hub, address premises, INameWrapperLike nameWrapper)       // 156
function bind(bytes32 node, uint256 token) external                                                 // 174
function unbind(bytes32 node) external                                                              // 182
function claimParent(bytes32 node) external                                                         // 191  once, by the ENS owner of node
function setStation(uint256 chainId, address premises_, address hub_) external                       // 204  parent owner, write-once per edition chain
function nodeOf(bytes calldata name) external pure returns (bytes32)                                // 219  DNS wire → namehash
function bindByName(bytes calldata name, uint256 token) external                                    // 223
function unbindByName(bytes calldata name) external                                                 // 232
function claimParentByName(bytes calldata name) external                                            // 240
function registrar() public view returns (address)                                                  // 283  ENS.owner(namehash("eth"))
function expiry(string calldata label) public view returns (uint256 expires, uint256 graceEnds, bool live, bool inGrace) // 295
function setRenewer(address r) external                                                             // 338  parent owner, write-once, must have code
function renewPrice(string calldata label, uint256 duration) public view returns (uint256)          // 351  rentPrice(base+premium), 0 = unknown
function nameStatus(string calldata label, uint256 duration) external view returns (expires, graceEnds, live, inGrace, address renewAt, uint256 price) // 364
function heldBy(bytes32 node) public view returns (uint256 token, bool sealed_)                     // 381
function addr(bytes32 node) public view returns (address)                                           // 424  ERC-137
function contenthash(bytes32) public pure returns (bytes memory) { return ""; }                     // 433  ERC-1577, deliberately empty
function text(bytes32 node, string calldata key) external view returns (string memory)              // 437  ERC-634
function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory)     // 562  ENSIP-10
function tokenForName(bytes calldata name) external view returns (uint256)                          // 616
function whereIs(uint256 id) external view returns (uint256 chain, address site, address hub, bool reachable) // 630
function supportsInterface(bytes4 id) external pure returns (bool)                                  // 711
```
Events: `StationSet, Bound(node, token, by), Unbound(node, token), ParentClaimed(node, by), RenewerSet(renewer)`. Errors: `NoRegistryHere, NotTheNameOwner, NotTheTokenHolder, ParentAlreadyClaimed, ParentUnclaimed, StationAlreadySet, NotAnEditionChain, NothingThere, RenewerAlreadySet, UnknownQuery`.

### Access control
- `bind*`: `_ownsNode(node, msg.sender)` (registry owner, or NameWrapper `ownerOf(node)` when the registry hands the node to the configured wrapper) **and** `msg.sender == HUB.ownerOf(token) || HUB.account(token)`. Re-checked against ENS on every call; nothing is cached.
- `claimParent*`: write-once by the node's ENS owner. `setStation`, `setRenewer`: by the current owner of `parentNode`, write-once. "a write-once slot whose authorization is the ENS registry itself is not an admin, it is a mailbox with a name on it" (90–92).
- On a chain with `ENS == address(0)`, every write reverts `NoRegistryHere` but the resolver still deploys "so the address stays the same on every chain".

### Resolution logic
- `_tokenFor(node)` = `heldBy(node).token` if nonzero, else `tokenOf[node]` (416–420).
- `heldBy` (381–411): registry owner must be the configured wrapper; wrapper's `ownerOf(uint256(node))` must be a contract; call `token()` on it; `(chainId, coll, id)` must be `(block.chainid, HUB, nonzero)`; then the account must equal `HUB.grip(id)` (→ sealed) or `HUB.account(id)` (→ not sealed). Impostor accounts, other collections' accounts, wallets, and unwrapped controllers all return `(0,false)` — each is a verify-plate section.
- `_text` (443–514): `contentcontract` → `"<ERC-3770 shortName>:<0x…premises>"` or bare address when the chain has no registry short name; `avatar` → `"eip155:<chain>/erc721:<hub>/<id>"`; `url` → `https://<premises-no-0x><gateway>/token/<id>` where a w3link gateway exists, else `web3://<premises>:<chain>/token/<id>`; `description` → a sentence naming the Reach. Commit `6055f32` corrected `contentcontract` from CAIP `eip155:…` to ERC-3770 after a real gateway failed to parse it ("The two look interchangeable and are not", 470–476).
- `resolve` (562–612): hashes the DNS-wire name on chain, applies `_tokenFor`; if nothing and `parentNode` is set, parses a numeric first label (≤18 digits), checks `_namehash(name, next) == parentNode` and `_reachable(id)`; an unservable numeric child answers *empty*, never the parent's record ("Silence is the only correct answer for a name that exists and cannot be answered for", 567–575); dispatches on `addr`/`contenthash`/`text`, else `UnknownQuery`.
- `_chainOfToken` (529–534): `id` in `1..4096` → chain 1 on Ethereum, or `block.chainid` on 31337/11155111 rehearsals, else 0. `_bandFirst(c)` is now `c == 1 ? 1 : 0` — the five-band partition was collapsed by `fe990f7` "Make IPSEITY Ethereum-only"; `Station`/`setStation`/`whereIs` remain ABI-compatible but can no longer admit a second production chain (`verify-plate.mjs:139–148` asserts Base and chain 999 are refused).
- `expiry` (295–320): registrar derived as `ENS.owner(namehash("eth"))` — "hardcoding one is a bet that ENS never migrates"; grace asked from the registrar, 90 days fallback; a registrar that answers nothing reads as unknown (zeros), not lapsed.
- `_shortName` and `_gateway` are hardcoded tables (676–709): `eth, base, unichain, bnb, robinhoodchain, sep, basesep`; gateways `.eth.w3link.io`, `.base.w3link.io`, `.bnb.w3link.io`, `.sep.w3link.io`, `.basesep.w3link.io`. Unichain/Robinhood get a `web3://` URL and no https one.

### Size / tests / live
- Runtime **9,957 B (40.5%)** (commit messages: 8,324 B at `2922c62`, 9,478 B at `137c8cd`).
- `tools/verify-plate.mjs`: 42 → 66 → 71 → 73 assertions across `2922c62`, `137c8cd`, `6055f32`, `afc5d55`; `fe990f7` then removed the cross-band sections (grep now finds ~62 assertion call sites; the current count was not re-measured here). Section heads: "an id in this chain's own band answers, as it always did", "another production chain cannot be registered", "the ERC-6821 record points to Ethereum" (not `eip155:`, exactly one colon, short name `eth`), "a name held inside a token needs no binding at all", "custody beats a binding that has gone stale", "an account's own word is not enough", "a wrapped name is unwrapped one level first", "registry control cannot counterfeit custody", "a name's expiry, read from the registrar the registry names" ("asking with the full name finds nothing, because that is a different hash"), "renewal is permissionless, so the page needs an address and a price", "a rehearsal holds the whole edition, and routes nothing away" (chain 11155111 fixture — `Chain.open` grew a `chainId` because `block.chainid` cannot be mocked).
- `tools/verify-site.mjs:2182–2290` drives `PageName` ("the name the client encoded is the name the contract hashed", "unbinding gives the name back", "with no renewer set it refuses rather than building a transaction to nowhere", "a fresh page keeps the expiry warning once renewal is configured").
- Live: Ethereum Sepolia nameplate `0xd0e4c1cd…eb30`; Base Sepolia `0xb1abfa50…4db6` (no ENS registry there; constructor given zero). Commit `fa2b155` proved a real Sepolia ENS node held by token 2's Reach resolving through the nameplate (`addr` = the Reach, avatar/url/contentcontract all answering) and documented that **a .eth 2LD cannot be registered on Sepolia** because `BaseRegistrar.controllers(NameWrapper)` is 0 there (DEPLOYMENTS.md:529–567). `tools/ens-name.mjs` (commit-reveal registration with a random persisted secret, controller struct-ABI `register((string,address,uint256,bytes32,address,bytes[],uint8,bytes32))`, Sepolia-only tables) is "written and correct; it wants a chain whose registrar authorises its wrapper."
- Invariants 103, 111a (`INVARIANTS.md:609–617, 700–710`).

### Known weaknesses / TODOs
- **Unmerged fix:** `tools/site.mjs:316–317` still gives Ethereum Sepolia the *mainnet* NameWrapper `0xD4416b13…86401`; branch `codex/fix-high-priority-bug-in-ens-custody` (`adedb26`, merged as PR #26 only into a sibling branch) corrects it to `0x0635513f…dfce8`. On HEAD, custody-as-binding can never recognise a wrapped name on Sepolia deployments.
- Station/`whereIs`/short-name/gateway machinery is vestigial after Ethereum-only and bakes third-party hostnames (w3link) into immutable bytecode.
- `heldBy` needs the holding account to have code; counterfactual 6551 accounts resolve to nothing (documented in `fa2b155`).
- No multi-coin `addr(bytes32,uint256)` (ENSIP-9), no reverse `name()`, no `pubkey`, no ENSIP-15 normalisation (the page refuses non-ASCII names); `text` answers only four keys.
- `bind` cannot verify that the name's resolver actually points here; the page says so loudly instead.
- `renewPrice` returning 0 is shown as "unknown"; the page sends `price * 105 / 100` and relies on ENS refunding.
- `PageName` uses `innerHTML` with an `ESC` helper for resolver-controlled strings — the one place the site departs from its textContent-only rule (verify-site asserts the escaping exists).

### Reuse verdict: **adapt**
Keep: custody-is-binding with the three-way cross-check (registry → canonical wrapper → account `token()` → hub-derived address), ERC-6821 `contentcontract` in ERC-3770 form, ENSIP-10 numeric wildcard, registrar-derived expiry, write-once renewer, DNS-wire `*ByName` variants so the browser hashes nothing. Strip: the station table and the hardcoded gateway/short-name tables (or move them to a replaceable companion). Rebind the hub interface.

---

## 5. How the UI is delivered, and how it verifies ownership (explicit answer)

**Delivery is entirely from chain.** `Premises.request(string[] resource, KeyValue[] params)` (ERC-5219, `Premises.sol:250`) returns `(status, body, headers)`; `/chat`, `/rooms`, `/room/<n>`, `/dm/<id>`, `/name` dispatch to `PageTalk.chat()`, `PageRooms.rooms()`, `PageRooms.room(n)`, `PageTalk.dm(id)`, `PageName.namePage()` (`Premises.sol:297–321`). Each page is `string.concat` of: `Chrome.head/nav/foot` (CSS/nav as Solidity constants), a `<script type="application/json" id="T">` config block built *on chain* by `DeskTalk.config(room, other, group)` (`DeskTalk.sol:56–78`) that carries the Parley/Roster/hub addresses, the room key, the steward, `MAX_BODY`, the `Said` topic from `Parley.topics()`, and 23 four-byte selectors each computed by `keccak256(sig)` inside `DeskTalk._sel()` (`DeskTalk.sol:82–121`); then the client itself as string constants `TALK_JS`, `DOOR_JS`, `ROOMS_JS` (`DeskTalk.sol:133–454`), `DeskSeal.SEAL_JS` on the DM page, `Chrome.WALLET_JS` (EIP-6963 provider discovery, `Chrome.sol:280–306`), `Desk.core()` (the `window.IP` helper: `call`, `tryCall`, `send`, `connect`, `chainOk`, `acct`). Readers reach it natively over `web3://<premises>:<chain>/chat` (ERC-4804/6860), through a public ERC-5219 gateway (`https://<premises>.sep.w3link.io/chat`), or through `tools/gateway.mjs` where "every GET is an `eth_call`". `/services.json` (`PageManifest._parley`, `PageManifest.sol:425–440`) publishes the Parley address, commons key, `maxBody`, the `said` topic, the `speak` selector and the walk rule as "the instruction manual for replacing the browser". There is no static site, no bundler, no IPFS anywhere in this subsystem. The browser ships **no keccak** and **no ABI coder**: calldata is assembled by string concatenation of 32-byte words (`I.W`, `I.AD`, `ARG`), and every event topic and selector was hashed on chain.

**Reading is never gated.** `PageTalk._gate()` says it: "It hides a composer, not a fact — everything it is in front of is already on the screen behind it." (`PageTalk.sol:97–113`). The walk (`DeskTalk.sol:180–190`) runs with any provider: `stateOf(room)` → `eth_getLogs` with `fromBlock == toBlock == last` and `topics: [said, room]` → follow the *oldest* log's `prev` → repeat, `guard < 64`.

**Writing is gated twice, once in the client and once on chain, and only the chain's gate counts.**
1. Client: `hello()` → `I.connect()` (EIP-6963 pick → `eth_requestAccounts`) → `sight(addr)` → `held(addr)` reads `balanceOf(addr)` on the hub and walks `tokenOfOwnerByIndex(addr, i)` for `i < min(n, 64)` (`DeskTalk.sol:159–163`); the ids fill the "speaking as" `<select id=as>`; `become(id)` sets `ME`, remembers it in `localStorage['ipse.me']`, and for a DM page derives `ROOM = pairKey(ME, other)` from the contract. Holding nothing is a sentence, not an error ("you can read everything and say nothing"). The composer only enables when `ME != null` (`document.body.classList.toggle('held', …)`).
2. Chain: every write (`speak`, `whisper`, `found`, `join`, `leave`, `invite`, `evict`, `announce`) calls `mayActAs(token, msg.sender)` — `msg.sender == ownerOf(token) || msg.sender == HUB.account(token)` — and reverts `NotYours` otherwise (`Parley.sol:168–181`). No signature challenge, no session, no server: the signed transaction *is* the proof, verified by the EVM. A granted session key acts through the Reach, so it is admitted as "the token acting for itself"; the ERC-4907 renter is explicitly refused (`test_theBoundAccountMaySpeakAndTheRenterMayNot`).
3. For sealing, `DeskSeal` derives the P-256 private scalar as `SHA-256(personal_sign("IPSEITY seal v1 · chain <id> · token <n>"))` (RFC 6979 determinism), rejects hashes outside the curve order, imports it as PKCS#8 so WebCrypto computes the public point, publishes `(x,y)` via `announce`, and arms AES-256-GCM over static-static ECDH only when `Parley.keyOf` returns a live point for *both* tokens under their *current* holders (`DeskSeal.sol:62–135`).
4. Names: `PageName` builds DNS wire format with string arithmetic, asks `nodeOf` for the hash, previews `tokenForName/tokenOf/addr/text/ENS.owner` on each keystroke, and the contract refuses `bindByName` unless the caller owns the node in ENS *and* holds the token or is its Reach.

The console (`/c/<id>`, `PageConsole` + `engine/console*.js`) is a separate surface; on HEAD its SPEAK lane is unbuilt and points at these flat pages. CONSOLE.md's spec declares the flat pages "superseded and left deployed but unrouted", but `Premises` on HEAD still routes all of them — the two surfaces coexist.

---

## 6. Tooling in the area

- `tools/port.mjs` (272 lines): verbs `status | deploy | quote | echo | walk`. `deploy` reads the local Parley from `deployments/<chain>.json`, requires `PRIVATE_KEY` for writes (commit `f56c66b`), **enforces nonce 0** so CREATE lands the port at the same address on every chain, hand-encodes the six constructor args (`--lane-lib eid:sendLib:recvLib`, `--config-pin lib:eid:type:0xbytes`), asserts the landed address equals `predictCreate(from, 0)`, then reads back `LOCAL_EID`, `delegates(port)` and every `peerOf` with a 20×3 s "patient" loop because "a replica one block behind serves an eth_call against the deploy's address as `0x` — an empty answer, not an error" (lines 186–199; this crashed the first live run). `walk` reads `lastEcho()` and follows `Echoed.prev` with single-block `eth_getLogs`, printing the query count. Records go to `dist/port-<chain>.json`; the committed copies are `deployments/port-84532.json` and `port-11155111.json`.
- `tools/ens-name.mjs` (204 lines): Sepolia-only ENS commit→wait→register with the current controller struct ABI, a random secret persisted at mode 0600 (`e9e1224`), refuses the already-public label `ipseity4d`, sets `addr` to the premises on the public resolver, writes `rec.ens`/`rec.urls.named`.
- `tools/verify-parley.mjs`, `verify-port.mjs`, `verify-plate.mjs` (described above), `tools/probe-port-abi.mjs` (raw selector probe), research probes `probe-lz.mjs` (which of three canonical endpoint addresses a chain carries, which message libs, read channels), `probe-uln.mjs` (decodes `getConfig` ULN/executor for default lanes — "who actually secures a default LayerZero lane"), `probe-dvn.mjs`, `probe-ccip2.mjs`, `probe-bridges.mjs` (LayerZero vs CCIP vs Hyperlane fee quotes for a 160-byte settle message).
- `tools/site.mjs`: deploy order is load-bearing — Parley is reused across site redeploys (`existingParley`, lines 497–501; `redeploy-site.mjs` "keeping Parley … the conversation survives"); Roster → DeskTalk → … → DeskRooms; `PageName` is given the Nameplate's address predicted at `nonce + 2`, Premises deploys, then Nameplate, and the prediction is asserted (777–809). `LAYERZERO`/`LAYERZERO_TESTNETS` tables (65–127), `portPeers()` (133–142), `BANDS = {1: 1..4096}` with `assertTiles` (154–183), `REHEARSAL_CHAINS = {31337, 11155111}`.
- `tools/testnet.mjs`, `tools/gas.mjs` (chat pages are "the cheapest pages on the site" because the shell is rendered and the archive is read by the client).

---

## 7. Measured numbers (every one found)

Bytecode (runtime, from `out/solc.json`, HEAD): Parley 6,379 B (26.0%); ParleyPort 4,246 B (17.3%; creation 6,420 B); Roster 3,267 B (13.3%); Nameplate 9,957 B (40.5%); DeskTalk 20,422 B (83.1%); PageTalk 10,193 B (41.5%); PageRooms 9,008 B (36.7%); PageName 21,567 B (87.8%, matches commit `afc5d55`); DeskRooms 2,106 B; DeskSeal 4,783 B; DeskTerm 23,908 B (97.3% — the reason DeskRooms exists); PageManifest 23,105 B (94.0%); PageDoor 15,388 B; Premises 15,372 B. Historical: Parley 6,069 B (README table), Nameplate 8,324 → 9,478 B, PageName 21,377 B.

Tests: `test/Parley.t.sol` 26 tests (135 Solidity tests in the whole suite, 149 `function test` across files by grep); verify-parley 37; verify-port 42 (from 24/25); verify-plate 73 before `fe990f7`; verify-site 586 (at `afc5d55`; 580 earlier); verify-console 96 on the unmerged branch.

Live: port `0x65d1e9d08488a68ef6bf48e057ab69496333c7ae` on 84532 and 11155111; echo fee 104,037,152,596,558 wei; echo tx 323,518 gas; delivery in Base Sepolia block 45,828,666, ~80 s; ~0.00267 ETH (Sepolia deploy+mint+echo), ~0.0000096 ETH (Base Sepolia deploy); endpoints 24,005 B code; eids 30101/30184/30320/30102/30416/40161/40245/40451; lzRead 1.957e-5 vs 3.404e-4 ETH. Roster window ≈550k gas of `eth_call` per 256 tokens. Parley archive walk: 405 blocks in 3 queries. Chat pages measured as the cheapest routes (gas.mjs; no absolute number recorded). Site deploys: Base Sepolia 68.41M gas / ~40 tx; Ethereum Sepolia 137.86M gas / 0.2148 ETH. Current records (`deployments/*.json`, authoritative over DEPLOYMENTS.md's lagging "Live now" block): Base Sepolia premises `0xc59f75d2…3161`, parley `0xaa8b3ff6…e0f2`, roster `0x94bda49e…d5cc`, nameplate `0xb1abfa50…4db6`; Ethereum Sepolia premises `0x7e1bdcd8…7a31`, parley `0x99f5d809…8705`, roster `0x9286f2f1…e1f2`, nameplate `0xd0e4c1cd…eb30`.

---

## 8. Branches touching this area

Merged into HEAD (`git branch -r --merged`): `codex/propose-fix-for-roster-scanning-vulnerability` (`0522015`), `codex/propose-fix-for-renewal-ui-vulnerability` (`afc5d55`), `codex/propose-fix-for-ens-registration-vulnerability` (`e9e1224`), `codex/restrict-to-ethereum-only` (`fe990f7`), `codex/run-complete-testnet-on-sepolia`, `codex/propose-fix-for-sealing-client-vulnerability` up to `4fa41d0`.

**Unmerged and relevant:**
- `codex/fix-high-priority-bug-in-ens-custody` (`adedb26`): Sepolia NameWrapper address fix in `site.mjs` — one line, should be taken.
- `codex/propose-fix-for-sealing-client-vulnerability` tip (`7f58e37` "Revalidate DM keys and support Parley migration"): `DeskSeal` re-reads the peer's `keyOf` immediately before *every* encryption and fails open to plaintext if it changed (a DM page can stay open across a transfer); `redeploy-site.mjs` gains Parley-migration support; `verify-site` updated. Worth taking.
- `claude/claude-md-docs-8vvyc8` (7 commits ahead): console SPEAK lane with the local walk, composer, and the federated "HEARD FROM OTHER CHAINS" column over `ParleyPort.Echoed`; `PageConsole` takes `parley` and `port`; `ConsoleRead.sels()` 58 entries; live-verified on Base Sepolia. This is the only client in any branch that renders echoes.

---

## 9. Pitfalls recorded in this area (each cost the authors real time)

1. A mock written to match the contract certifies the dialect, not the protocol: `lzReceive(Origin,…)` is `0x13137d65`; `Origin` is a static tuple and part of the selector; `allowInitializePath`/`nextNonce` must exist or the lane never initialises. Probe real selectors at deployed bytecode.
2. ULN302 refuses empty options at quote time; "no options" must mean a type-3 default naming lzReceive gas.
3. LayerZero eids are not chain ids; the registry still lists a dead legacy Sepolia eid 30161 — wire 40161. Three (four, with Robinhood testnet) canonical endpoint addresses exist.
4. `nameExpires` is keyed by the label hash, not the namehash; mixing them returns a confident zero.
5. ERC-6821 `contentcontract` wants a bare address or ERC-3770 `shortName:0x…`, never CAIP `eip155:…`; `eip155:` is right for the avatar record.
6. w3link hostnames need the chain short name: `<addr>.eth.w3link.io`, not `<addr>.w3link.io`.
7. ENS on Sepolia cannot register a 2LD (`BaseRegistrar.controllers(NameWrapper) == 0`) and the failure is a bare revert after the commitment is paid; the controller's `register` ABI is now a single struct with `uint8 reverseRecord` and `bytes32 referrer`.
8. ERC-6551 accounts are counterfactual until embodied; custody checks that call `token()` see nothing at a codeless address.
9. Two messages in one block: the second's `prev` is its own block — a walker must follow the *oldest* log's pointer or loop forever.
10. `block.number` read across `vm.roll` gets sunk by the optimiser; read evidence from storage in tests.
11. Public RPC load balancers answer `0x` from a lagging replica right after a deploy — treat empty as "not yet", retry.
12. Room kind 0 means both "the commons" and "never founded"; the commons never writes `inRoom`.
13. The harness's `bytes` encoder must be given hex; a Buffer once silently encoded as empty and made a correct contract look buggy.
14. The nonce-0 same-address mesh needs a fresh key on every chain and fails loudly otherwise.
15. DeskTerm at 97% of EIP-170 — new words are added as satellite contracts registering through `def`, never by growing the file.

---

## 10. Reuse verdicts, consolidated (relative to the GOAL: one ERC-721 whose holder gets swap, messaging/social, launchpad, vault, and a chain-served website that verifies holding)

| component | verdict | why |
|---|---|---|
| `Parley.sol` | adapt (near-verbatim) | The indexer-free log archive with back-links, derived pair rooms, steward groups, transfer-invalidated sealing keys and `topics()` is exactly the "messaging / crypto-social layer" the goal asks for, proven live; only the hub interface (`ownerOf`, `account`) changes. Consider a reply pointer and group sealing. |
| `Roster.sol` | reuse-verbatim | Stateless bitmap enumeration; needs only `totalSupply`/`ownerOf` and contiguous ids. |
| `ParleyPort.sol` | adapt / drop | Correct adminless LZ V2 receiver with constructor pin and a live cross-chain run; keep only if the unified protocol federates the commons across chains. The edition itself went Ethereum-only. |
| `Nameplate.sol` | adapt | Custody-is-binding, ERC-6821/ERC-3770 `contentcontract`, ENSIP-10 numeric wildcard, registrar-derived expiry and write-once renewer are the right way to give every minted NFT a human name that opens its chain-served site; strip the vestigial station/gateway tables, take the Sepolia wrapper fix. |
| `DeskTalk` / `PageTalk` / `PageRooms` / `DeskRooms` | adapt | Reuse the three refusals (no keccak, no innerHTML, no range scans), the config-block pattern and the walk; redesign the chrome. |
| `DeskSeal` | adapt | Take the unmerged per-send revalidation; document no forward secrecy; consider HPKE or per-message ephemeral keys, and a derivation that cannot be phished through `personal_sign` by another site. |
| `PageName` | adapt | Keep DNS-wire client encoding and the clock/renewal card; fix the one `innerHTML` boundary to `textContent`. |
| `PageManifest` parley block | reuse-verbatim | The machine-readable "how to read the archive without this site" contract. |
| `tools/port.mjs`, `MockEndpoint.sol`, `probe-port-abi.mjs` | reuse-verbatim | Deployment and protocol-conformance tooling; the nonce-0 mesh trick generalises to any multi-chain satellite. |
| `tools/ens-name.mjs` | adapt | Sepolia tables only; needs a mainnet table and the real NameWrapper. |
| `OMNICHAIN.md` | reuse as decision record | The ONFT refusal (metadata cannot travel, 6551 addresses commit to chain id, bands are the supply guarantee, delegate = admin key) applies verbatim to any 6551-based token. |

---

## 11. Unique ideas worth carrying into the unified protocol

1. **The chain is the index**: `prev`/`prevFrom` back-links plus a per-room head make a chat readable with single-block `eth_getLogs`, no indexer, measured.
2. **The contract serves its own topics and selectors** (`topics()`, `_sel()` in config JSON) so the browser carries no hash function to audit.
3. **Derived pair rooms** (`keccak(2, min, max)`) that exist on first use and are unreachable through the generic `speak` path.
4. **Permission is recorded, entry is self-performed** — the only unbounded array can be grown only by its owner.
5. **Sealing keys bound to the publisher**: a transfer silently retires the old key, so nobody seals to a departed holder.
6. **Roster bitmaps**: 256 memberships per word, kind disambiguation (`NO_ROOM`), stewarded rooms derived from counters.
7. **Speech-only federation** with the back-link rewritten at the border, body-vs-envelope origin check, no delegate, pin-at-construction, permissionless delivery, and the nonce-0 same-address mesh deploy.
8. **Custody is the binding**: an ENS name NFT inside the token's 6551 account *is* the name record, cross-checked three ways; sell the token, the name goes with it; put it in the Grip and it is permanent.
9. **ERC-6821 `contentcontract`** so `web3://name.eth/…` opens the on-chain site; numeric ENSIP-10 wildcards so every token has a name at mint.
10. **Honest clocks**: expiry derived from the registry's own registrar, "zero" and "unknown" kept distinct, renewal offered to everyone because ENS renewal is permissionless.
11. **Test the wire, not the mirror**: probes at deployed bytecode, mocks that use the compiler's selectors, and a second independent reader of every archive.
