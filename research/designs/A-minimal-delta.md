# Design A — minimal delta from IPSEITY

Architect A. Lens: the smallest set of changes and grafts to the closest existing system. Inputs read in full: the four dossiers, the research brief, the toolchain facts, and the source trees where a signature had to be exact. Every byte count below is either measured from a checked-in artifact (named) or marked *est.*; every contract names its origin.

---

## 1. Thesis and name

IPSEITY already ships the shape the programme wants — one ERC-721 whose `tokenURI` emits its own app, an ERC-5219 router that *is* the website, a per-token AMM, back-linked log messaging, a v4 launchpad with view-mined hooks, and two ERC-6551 accounts of which one cannot spend — with 149 Solidity tests, 22 adversarial verifiers and two testnet rehearsals behind it. It is missing five things: a single app shell, the filled console lanes on an unmerged branch, one confirmed Pool re-entrancy plus one unguarded re-anchor, three small unmerged fixes, and an authority model that survives a sale by construction rather than by each contract remembering to check. ANIMA's `_update` and epoch-keyed stores close the last gap; Pixel-Garden's typed call shape and code-hash admission close the "arbitrary executor" hole and give the app a safe extension point; MASTER contributes install/version discipline for those extensions and the Vault / Memory / Commons vocabulary without its relayers. So this design is IPSEITY's architecture with the hub re-cut around a custody epoch, the Pool fixed, the flat site retired in favour of the console as the one document served identically by `tokenURI` and `web3://`, and six satellites grafted in. Nothing is upgradeable, nothing has a keeper, nothing leaves the chain.

**Name: KEEP.** A keep is the innermost building of a castle: the one structure that holds the treasury, the hall where people speak, the gate where goods change hands, and the lord's seat — and the one that stands when the outer walls fall. It is also the verb for custody. One word, no collision with any of the four repositories, and `web3://keep.eth/token/7/live` reads as intended. (If brand continuity is preferred, every mechanism below works unchanged under the IPSEITY name; only the salt strings and EIP-712 domains carry the word.)

---

## 2. Contract inventory

30 deployable protocol contracts at most, of which **18 form the minimum viable bundle (MVB)**. Per-launch templates (`Coin`, `FloorCoin`, `GateFacet` instances) are deployed by users, not by the protocol, and are listed separately. Libraries (`Curve`, `Hook`, `Web`, `SSTORE2`, `Base64`, `LibNum`, `Mul`, `Tick`, `Assets`, `ExactERC20`, `ERC6492`) are `internal` and compile into their callers. Sizes are runtime bytes; measured figures come from `out/solc.json` (IPSEITY, solc 0.8.36 viaIR 800 cancun) or `artifacts/` (ANIMA) as re-measured in the dossiers.

| # | Contract | Origin | Size budget (B) | Responsibilities | Who may call what |
|---|---|---|---|---|---|
| 1 | `Keep` (hub) | IPSEITY `src/Ipseity.sol` (19,316) **adapt**; ANIMA `AnimaAgent.sol` `_update`, `approvalEpoch`, `lockCount`, fingerprint | ≤ 22,500 (*est.* 21,000 after dropping the section word, `openNode`, the sealed kernel) | ERC-721/Enum/2981/4906/4907/5192/5646/6454/7160/7496/7572/5169; mint with atomic accounts; `custodyEpoch`; transfer hook; two-salt 6551 derivation; bolt + module locks; lease agent; guardian; `status`; `rightsOf`; `panic`; `viewOf`; curve trait | owner: traits, user, lease agent, guardian, bolt, status, panic. owner∨Reach: `onlyOwner` ladder. sealed modules: `moduleLock/Unlock`. guardian: pause, panic. Timelock: `setRenderer`/`setModule` until sealed, `setPricing`, `setRoyalty`, `withdraw`. anyone: mint, reads |
| 2 | `Engine` | IPSEITY `src/Engine.sol` (2,724) **verbatim** | 2,724 | SSTORE2 head/body shards, state gap, `freeze()` one-way, `headBytes()/bodyBytes()` | curator: `loadHead/loadBody/dropLast/freeze` until frozen; anyone: reads |
| 3 | `Renderer` | IPSEITY `src/Renderer.sol` (20,747) **adapt** | ≤ 18,000 (*est.* 15,000) | `document(id)` = head ‖ state gap ‖ body; `INFLATE` loader; faces 0 (app), 1 (crest), 2 (ERC-8004 JSON); `tokenURI`; `contractURI`; trait schema | hub (view) |
| 4 | `Crest` | **NEW** (replaces `Sigil.sol`; ≤ 8 KB SVG) | ≤ 4,000 | Deterministic SVG still from `(id, seed, custodyEpoch, status)`; Sigil's label-scan escaping rule | Renderer (view) |
| 5 | `ConsoleRead` | IPSEITY `src/ConsoleRead.sol` (3,408) **adapt** | ≤ 5,500 | `look(id)` over every satellite behind `extcodesize` **and** `try/catch` with a `reported` bitmask; `sels()` | Renderer, Premises (view) |
| 6 | `Premises` | IPSEITY `src/Premises.sol` (15,372) **adapt** | ≤ 14,500 | ERC-5219 `request()`, `resolveMode() == "5219"`, the §4 route table, artwork served by the router itself, 404-not-revert, one URL per resource, `/manifest`, ERC-7774 headers | anyone (view) |
| 7 | `Manifest` | IPSEITY `src/PageManifest.sol` (23,105) **adapt** | ≤ 22,000 | `/services.json` (collection and per token), `/.well-known/*`, `/llms.txt` + `.md`, `/open.json`, the door at `/`; every selector hashed on chain | Premises (view) |
| 8 | `Reach` (impl) | IPSEITY `src/IpseityAccount.sol` (13,461) **adapt**; Garden `ReachAccount` typed call + recipe sessions; ANIMA `koorbx` `SessionScope` rate fields | ≤ 17,000 | Acting 6551 account: measured seal, manifest, pieces, `execute` (op 0), `executeBatch`, `executeTyped`, sessions keyed to `custodyEpoch`, open-approval ledger, ERC-7739-wrapped attestation-only 1271 | `onlySigner` = `ownerOf(id)`; session keys via `executeAsSession/executeTyped` only; hub: `sealMax()` on `panic`; anyone: receive |
| 9 | `Grip` (impl) | IPSEITY `src/GripVault.sol` (1,933) **verbatim**, salt string only | 1,933 | Receive-only 6551 account; no spend selector exists; `isOneWay()`; declines `0x51945447` | nobody can move anything out; anyone can send in |
| 10 | `Pool` | IPSEITY `src/Pool.sol` (11,626) + `lib/Curve.sol` **adapt** | ≤ 14,500 | One market per id, holder sole LP, anchored virtual reserves from the `curve` trait, ratchet bond, native quote, `swap` + `swapExactOut`, decaying sniper fee, global transient lock, `openIds` | `mayActAs(id)`: open/close/deposit/withdraw/setFee/bond/syncCurve/snipe; `RAISE`: `graduate`; anyone: swap, quote. Timelock: `setPaused`, `bless`, `setAllowlistEnforced` — none takes a `uint` |
| 11 | `Conduit` | **NEW**: ANIMA `AgentSwapRouter.sol` (5,519) discipline + Garden v3 path validator + MASTER quote-by-revert lens | ≤ 9,000 | Ownerless router to external liquidity: venues pinned by `extcodehash`; balance-delta output check; exact-approve-then-zero; `quote()` executes and reverts `QuoteResult`; `minOut`/`maxIn`/`deadline`/`sqrtPriceLimitX96` at our layer | `msg.sender` must be a canonical Reach (`isCanonicalAccount`); anyone: `quote` |
| 12 | `Venue` | IPSEITY `src/Venue.sol` (8,245) **verbatim** (optional) | 8,245 | Defensive Uniswap v3 reader: factory cross-check, gas-stipended staticcalls, hand-decoded `observe` | anyone (view) |
| 13 | `Parley` | IPSEITY `src/Parley.sol` (6,379) **adapt** | ≤ 8,500 | `Said` logs with `prev/prevFrom` back-links; commons/groups/pairs/home rooms; stewards; `re` reply pointer; per-room cooldown; epoch-bound key binding; `topics()`; `heads()`; ring of last four heads | `mayActAs(token, msg.sender)` on every write; steward: invite/evict/cooldown; `POSTAGE`: `settle` |
| 14 | `Roster` | IPSEITY `src/Roster.sol` (3,267) **verbatim** | 3,267 | 256-bit membership windows in one `eth_call`; `NO_ROOM` | anyone (view) |
| 15 | `Postage` | **NEW**, ANIMA `comms/AgentComms.sol` (7,368) **adapt** | ≤ 8,000 | Priced first-contact DMs: escrow (native or ERC-20) bounded by `maxPostage`/`expectedFeeToken`, reply-or-refund, settlement to `account(to)`, pull refund | owner: `configureInbox`; Parley: `stamp`, `settle`; anyone after `replyBy`: `expire`; sender: `claimRefund` |
| 16 | `KeyRegistry` | ANIMA `core/EncryptionKeyRegistry.sol` (1,783) **verbatim** | 1,783 | Chain-wide typed key directory; `keyIdOf = keccak256(publicKey)`; X25519/secp256k1/P-256/ML-KEM-768 | any address: own key |
| 17 | `Kiln` | IPSEITY `src/Kiln.sol` (13,709) **adapt** | ≤ 14,500 | CREATE2 `Coin` factory minting to `account(id)`; `mine()` as a view; `deployHook` with `WrongFlags`; per-token launch record incl. pool key | `mayActAs(id)`: launch, deployHook, recordPool; anyone: mine, reads |
| 18 | `GateFacet` (template) | IPSEITY branch `hciyvv` **adapt** + PR #36 `syncFee(expected)` | ≤ 5,000 | v4 hook: no swaps before `OPENS`; no negative liquidity deltas before `UNLOCKS` (zero-delta fee pokes allowed); dynamic fee from the `curve` trait inside `[FLOOR, CEILING]`; `beforeInitialize` refuses non-dynamic-fee and foreign keys; `onlyPoolManager` everywhere | PoolManager: callbacks; `mayActAs`: `syncFee(expectedWord)` |
| 19 | `Planner` | IPSEITY branch `hciyvv` `V4PositionPlanner.sol` **adapt** | ≤ 7,000 | View returning canonical `modifyLiquidities` calldata + value; `PoolKey` from `getPoolAndPositionInfo`; pricing from StateView | anyone (view); authority checked by the Reach at execution |
| 20 | `Raise` | ANIMA `market/AgentLaunchpad.sol` (16,396) **adapt**; graduation seam → `Pool` | ≤ 17,000 | Optional bonding-curve raise: virtual reserves, rounding against the trader, fair window, time-priced snipe tax (no exemptions) to `FloorCoin.contribute`, whole supply custodied, fees immutable per launch, `graduate` into the token's own market with a ≥ 30-day bond | `mayActAs(id)`: `createLaunch` (one per id); anyone: buy/sell, `graduate` |
| 21 | `Locker` | IPSEITY `src/Locker.sol` (2,850) **verbatim** | 2,850 | ERC-20 time-lock ≤ 3,650 d, no early exit, `give()` into a Reach, `extend` longer only | locker: claim after `until`, give, extend; anyone: `lock` |
| 22 | `Lease` | IPSEITY `src/Lease.sol` (6,737) **adapt** (phase 2) | ≤ 7,000 | Paid ERC-4907 rental via `leaseAgentOf`; rent escrowed, vested, breakage observed; `earned` pull ledger | strict owner: list/withdraw; anyone: `rent` at exact `msg.value`; buyer collects `earned` |
| 23 | `Roles` | ANIMA `registry/AnimaRoles.sol` (5,107) **verbatim** (phase 2) | 5,107 | ERC-7432 roles that lock the token via `moduleLock` instead of escrowing it; `recipientOf(USER)` feeds the 4907 shim | owner: grant; grantee: use; anyone: collect expired |
| 24 | `Steward` | IPSEITY `src/Succession.sol` (6,457) **adapt** (phase 2) | ≤ 8,500 | Succession and recovery in one: silence trigger (`quiet` 30–3,650 d) or ≥ 2-of-N guardians; one cancellable `notice` (≥ 14 d); `transferFrom` only, via single-token approval; void on transfer; `toToken` heirs; ERC-7878 views | strict owner: arrange/revoke/stillHere/setGuardians; anyone: summon/claim; guardians: `recover` |
| 25 | `Timelock` | IPSEITY `src/lib/Timelock.sol` (1,675) **verbatim**, wired this time | 1,675 | 7-day delay, 14-day grace, admin rotation only through its own queue; the hub's curator and Pool's admin | admin (burner, then renounced to a multisig or to nobody): queue/cancel; anyone: execute when ready |
| 26 | `Nameplate` | IPSEITY `src/Nameplate.sol` (9,957) **adapt** (phase 2, mainnet band) | ≤ 9,000 | Adminless ENS resolver: custody-is-binding, ERC-6821 `contentcontract` → Premises, ENSIP-10 numeric wildcard, registrar-derived expiry; Sepolia NameWrapper fix PR #26 | anyone: resolve; owner holding both: bind |
| 27 | `Shelf` | MASTER `modules/TokenModuleRegistry.sol` (8,084) + Garden `runtimeFamily` **adapt** (phase 3) | ≤ 9,000 | Per-token installs of hash-admitted cartridges (`releaseId`, `activationEpoch`, `StaleReview`), history chain; installation grants no authority | owner at live epoch: install/disable/writeState |
| 28 | `Releases` | MASTER `modules/ExtensionReleaseRegistry.sol` (5,922) + Garden `ArchiveFactory` **adapt** (phase 3) | ≤ 8,000 | Publisher-namespaced immutable releases of sha256-verified SSTORE2 archives (CREATE2 salt = sha256(payload)) | anyone: publish; nobody: mutate |
| 29 | `MLSGroupChat` | MASTER `extensions/privacy/MLSGroupChat.sol` (10,124) **adapt** (phase 3) | ≤ 11,000 | Ordered delivery for RFC 9420 groups keyed by token id and epoch; roster commits; reorg freeze | `mayActAs(token)` for members |
| 30 | `ParleyPort` | IPSEITY `src/ParleyPort.sol` (4,246) **adapt** (phase 4, optional) | 4,246 | Adminless LayerZero V2 lane for the commons only; peers, libraries, `UlnConfig(requiredDVNCount ≥ 2)` fixed at construction; `lzReceive` never calls out | endpoint: `lzReceive`; anyone: `echo` |

Templates (user-deployed, protocol-shaped): `Coin` (IPSEITY `Kiln.sol`, 1,492, verbatim: fixed supply, no owner/mint/burn-from/pause), `FloorCoin` (ANIMA `market/AgentToken.sol`, 5,369, verbatim: Permit + burn-to-redeem treasury floor), `GateFacet` instances (one per launch, CREATE2-mined).

External singletons relied on, never deployed by us: canonical ERC-6551 registry `0x000000006551c19487814612e58FE06813775758` (runtime hash checked at hub construction and at every mint, Garden `AccountBinding`), ERC-7409 emotes `0x3110735F0b8e71455bAe1356a33e428843bCb9A1`, ERC-6538 stealth meta-address registry `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538`, Uniswap v4 `PoolManager`/`PositionManager`/`StateView` and Permit2 on the band.

Dropped as code: IPSEITY's `Sigil`, `Trig`, WebGL field, `Chrome`, every `Desk*`/`Page*` but the two above (≈ 25 contracts), `LaunchView`, `Consign`; ANIMA's diamond (the hub's fallback, §14), brain/model/seal, escrow, meter, bonds, reputation, validation, derivatives, fiat gateway, token bridge; Garden's ten-family kernel, Uniswap-only market, storage posts, keeper; MASTER's proof branch, RAILGUN worker, governance, OFT lanes, auction, every loopback service.

---

## 3. The token

### 3.1 Mint flow

`Keep.mint() payable returns (uint256 id)` and `mintTo(address to) payable` (IPSEITY `Ipseity.sol:352-407`, adapted). One transaction, this order, `nonReentrant`:

1. **Counters and band.** `id = ++_minted`; revert `BandExhausted` unless `id ∈ [BAND_LO, BAND_HI]` (per-chain immutables; §11). Price from `pricing` (Timelock-settable until `sealPricing`). No `block.*` rarity: `seed = keccak256(chainid, address(this), id)` is a label, not a lottery.
2. **Ownership.** `_add(to, id)`; `custodyEpoch[id] = 1`; `_core[id] = Core{status: Active, …}` (struct in §3.4).
3. **Both accounts, atomically.** `REGISTRY.createAccount(REACH_IMPL, SALT_REACH, chainid, this, id)` and `REGISTRY.createAccount(GRIP_IMPL, SALT_GRIP, chainid, this, id)` against the canonical registry; the hub then asserts `isCanonicalAccount(reach, id, false) && isCanonicalAccount(grip, id, true)` — the CREATE2 recomputation **and** the 173-byte ERC-1167 forwarder codehash (Garden `PixelGardenKernel.sol:281-299`). `account(id)`/`grip(id)` remain pure derivations, so quoting never races creation and a missing account is impossible after mint.
4. **Events.** `Transfer(0, to, id)`, `MetadataUpdate(id)`, `Embodied(id, reach)`, `EmbodiedGrip(id, grip)`, `CustodyChanged(id, 1)`.
5. **Receiver callback last.** `_checkOnERC721Received` only after every counter and both accounts exist (HypeBears rule; brief §5A).

Nothing else is created at mint: the token's home room in Parley is a *derived* key (`homeKey(id) = keccak(3, id)`), the Pool market is opened by the holder, the stealth meta-address is registered by the holder's first VAULT action (it needs their keys). Gas: IPSEITY's mint is 0.19 M; Garden measured 299,485 for a mint that creates both accounts through the canonical registry; with the extra codehash checks and the `Core` write, **estimate 330,000–400,000 gas** (≈ $0.003 on Base at floor; ≈ $0.6 on mainnet at 0.5 gwei).

### 3.2 Transfer hook

`transferFrom(from, to, id)` (IPSEITY `Ipseity.sol:978-1010` adapted; `safeTransferFrom` wraps it) — the only path that moves a token; there is no burn:

```solidity
function transferFrom(address from, address to, uint256 id) public {
    if (from != _ownerOf[id]) revert NotHolder();
    if (to == address(0)) revert ZeroAddress();
    if (msg.sender != from && getApproved[id] != msg.sender && !isApprovedForAll(from, msg.sender)) revert NotHolder();
    if (!isTransferable(id, from, to)) revert NotTransferable();   // bolt, lockCount, to ∉ {account(id), grip(id), this, impls}, depth-2 cycle
    _remove(from, id); _add(to, id);
    delete getApproved[id];
    Core storage c = _core[id];
    if (c.user != address(0))  { delete c.user; delete c.userExpires; emit UpdateUser(id, address(0), 0); }
    if (leaseAgentOf[id] != address(0)) { delete leaseAgentOf[id]; emit LeaseAgentSet(id, address(0)); }
    if (c.guardian != address(0)) { delete c.guardian; emit GuardianSet(id, address(0)); }
    c.status = Status.Paused;                      // ANIMA: the buyer re-arms consciously
    unchecked { if (c.xfers < type(uint32).max) c.xfers += 1; }   // display statistic, saturating
    custodyEpoch[id] += 1;                         // checked uint64; the authority clock never saturates
    emit Transfer(from, to, id); emit MetadataUpdate(id); emit CustodyChanged(id, custodyEpoch[id]);
}
```

What the epoch roll revokes without any contract having to remember: every Reach session (`mark` must equal `custodyEpoch`), every Parley key binding and cooldown identity, every Steward arrangement, every Postage inbox configuration, every Shelf activation, every Roles grant (none can be live — a live role holds a module lock, so the transfer would have reverted). What the hook clears explicitly: the single approval, the 4907 user, the lease agent, the guardian. What it does **not** touch: the seller's `approvalEpoch` (operator approvals are per-owner, so the buyer starts with none), the Pool bond, the Reach seal, Locker locks, the launch record, the public archive, the name and the `curve` trait — the bundle the buyer paid for. Self-transfer bumps the epoch too (Garden's rule), so "away and back" revives nothing.

Locks: `locked(id) = bolt[id] || lockCount[id] != 0`, reported by ERC-5192 `locked()` and ERC-6454 `isTransferable()`, enforced in the hook. Only addresses in the sealed module allowlist (`Roles`, `Steward`, `Lease`) may `moduleLock/moduleUnlock`; `unlock` at zero is a revert, not a silent return (ANIMA debt §10.2).

### 3.3 Custody epoch and the epoch-keyed stores

`custodyEpoch(uint256 id) → uint64`, starts at 1, bumps on every transfer. Three stores key off it or off a per-owner epoch:

- **Operators**: `isApprovedForAll(owner, op)` reads `_approvals[keccak256(abi.encode(owner, approvalEpoch[owner], op))]` (ANIMA `AnimaAgent.sol:841-860`); `setApprovalForAll` keeps ERC-721 semantics; `setApprovalForAllUntil(op, expiresAt)` is the time-boxed form; `revokeAllApprovals()` is `++approvalEpoch[msg.sender]` — O(1), the Payment-Processor-class fix.
- **Sessions**: the Reach's `_mark()` returns `hub.custodyEpoch(tokenId)` instead of IPSEITY's `statsOf(id).xfers` (a saturating `uint32` is a display number, not an authority clock — Garden `MASTER-PLAN.md:154`).
- **Usage grants**: IPSEITY's `_ownerEpoch` becomes `custodyEpoch` outright; `authorizeUsage` and `usageAuthorised` keep their shape.

### 3.4 ERC-5646 fingerprint

`IKeep.sol` declares the normative structs — field order is part of the standard, append only:

```solidity
struct Core {                 // slot-packed; never reorder
    Status  status;           // Active | Paused   (1)
    uint8   bolt;             // owner's ERC-5192 lock (1)
    uint32  lockCount;        // module locks       (4)
    uint32  xfers;            // display only       (4)
    address guardian;         //                    (20)  = 30/32
    address user;  uint64 userExpires;              // slot 2 (ERC-4907)
    bytes32 curve;            // slot 3: the curve trait word
}
function getStateFingerprint(uint256 id) external view returns (bytes32) =
  keccak256(abi.encode(
    ownerOf(id), custodyEpoch[id], _core[id], leaseAgentOf[id],
    _traitsRoot[id],                      // keccak over the ERC-7496 trait set
    reachState, reachSealedUntil, reachApprovalsRoot,   // Reach.state(), sealedUntil(), approvalsRoot() — extcodesize-guarded, 0 if absent
    poolBondedUntil, poolOpen,            // Pool.bondedUntil(id), market open — guarded
    lockerCount, stewardArranged));       // Locker.countFor(reach), Steward.arranged(id) — guarded
```

It reverts for a nonexistent id. Every market `buy`/`fill` in this protocol (Lease, Steward's heir claim, Raise allocation, any third-party order) takes `expectedFingerprint` and recomputes at settlement. The open-approval ledger (§8) is what makes it cover the one thing `state()` cannot see.

### 3.5 `tokenURI` contents

`tokenURI(id)` = `tokenURIAt(id, 0)` (pinnable per IPSEITY's ERC-7160 `pinTokenURI`): `data:application/json;base64,` of

```json
{ "name": "KEEP #7", "description": "…one sentence, static…",
  "image": "data:image/svg+xml;base64,<Crest.svg(view)>",
  "animation_url": "data:text/html;base64,<Renderer.document(id)>",
  "external_url": "web3://<premises>:<chainid>/token/7/live",
  "attributes": [ {"trait_type":"status","value":"Active"}, {"trait_type":"custodyEpoch","value":3}, {"trait_type":"curve","value":"0x…"},
                  {"trait_type":"bondedUntil","value":1790000000,"validateOnSale":true}, {"trait_type":"sealedUntil","value":…,"validateOnSale":true},
                  {"trait_type":"locked","value":false}, {"trait_type":"engineHash","value":"0x…"}, {"trait_type":"servicesHash","value":"0x…"} ] }
```

Face 1 (`tokenURIAt(id,1)`): JSON with the SVG only — the cheap face for cautious clients (IPSEITY measured 3.32 M gas for its equivalent; ours is smaller). Face 2: the ERC-8004 `registration-v1` document (§9) with `agentId == tokenId`. `scriptURI()` (ERC-5169) returns the `external_url`. `getTraitMetadataURI()` (ERC-7496) marks `bondedUntil`, `sealedUntil`, `locked`, `custodyEpoch` as `validateOnSale`. `contractURI()` carries `engineHash = keccak256(Engine.headBytes() ‖ Engine.bodyBytes())` and the band table. Budget: the base64 envelope around a ~46 KB document; the dossier measured IPSEITY's 54,432-byte `/live` at 4.48 M gas and the full double-encoded `tokenURI` at 19.99 M for 103 KB, so **this `tokenURI` is budgeted at ≤ 8 M gas and `/live` at ≤ 5 M**, both gated in CI under 16,777,216 (EIP-7825) and 50 M. If a hosted RPC proves tighter, Garden's lever applies: percent-encode the JSON envelope once and base64 the HTML once (`ContentCartridge.sol:88-90`).

---

## 4. The website

### 4.1 Bytes

One document, three contracts. `Engine` holds the app as SSTORE2 shards: `head[]` (plain HTML prologue ≈ 1.5 KB: doctype, `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src https: http://127.0.0.1:* http://localhost:*; form-action 'none'; base-uri 'none'">`, viewport, and the `INFLATE` loader) and `body[]` (the gzip of the complete document, ≤ 2 shards of 23,000 B). `Renderer.document(id)` returns `headBytes() ‖ gap ‖ bodyBytes()` (IPSEITY `Renderer.sol:99-116`) where the **gap** is the only dynamic part:

```html
<script>window.KEEP={id:7,chainId:8453,hub:"0x…",owner:"0x…",account:"0x…",grip:"0x…",/*…every satellite address…*/
 epoch:3,status:1,bolt:0,locks:0,curve:"0x…",reported:0x1f,look:{…ConsoleRead.look(id)…},sel:{…sels()…},
 topics:{…Parley.topics()…},block:52098952,engineHash:"0x…"}</script>
<header id="crest"><!-- server-rendered first paint: token, chain, holder, status, epoch, three identity sentences --></header>
```

Every string in the gap passes `Web.jsonEsc`/`Web.esc`, and `_quote` turns `<` into `\x3c` so no state string can end the outer script. The loader is IPSEITY's verbatim: an async IIFE that reads `self.$KEEP`, deletes it, inflates with `DecompressionStream("gzip")`, splices the gap before `</head>` and `document.open()/write()/close()` — declaring **nothing** at global scope (the black-token bug is a `verify.mjs` grep). Shards are deployed with CREATE2 and salt `sha256(payload)` (Garden `ArchiveFactory`) so every band has the same shard addresses; `Engine.freeze()` is one-way and precedes the first mint.

### 4.2 Two surfaces, one byte-stream

- **Viewer**: `tokenURI` face 0, opened by marketplaces in an opaque-origin frame. The app detects the sandbox (`localStorage` throws; no EIP-6963 announcer answers within 300 ms) and boots in **viewer mode**: reads through a user-typed RPC with `credentials:"omit"`, no write controls, a "open live" link and QR to the `web3://` URL. Nothing can be signed here and the page says so.
- **Live**: `web3://<premises>:<chainid>/token/<id>/live` returns the identical `Renderer.document(id)` bytes as `text/html` on a real origin (gateway `https://` or a native client), where wallets inject. IPSEITY invariant 9d is kept and extended: `verify.mjs` asserts `Premises.request(["token","7","live"]).body == Renderer.document(7) == base64-decoded animation_url of tokenURIAt(7,0)`, byte for byte.

### 4.3 Route table (`Premises.request`)

| Route | Served by | Body | Gas budget |
|---|---|---|---|
| `/` | `Manifest.door()` | edition door: bands, counts, links to `/token/<id>/live`, `/open.json`, `/services.json` | ≤ 0.5 M |
| `/token/<id>/live` | Premises itself via `Renderer.document` | the app | ≤ 5 M |
| `/token/<id>/face/<n>` | Premises via `Renderer.facetURI` | faces 0–2 as JSON | ≤ 8 M / 0.5 M / 0.5 M |
| `/token/<id>/crest.svg` | Premises via `Crest` | SVG still | ≤ 0.5 M |
| `/token/<id>/hash` | Premises | `keccak256(document(id))` as text | ≤ 5 M |
| `/token/<id>/services.json`, `/token/<id>/llms.txt`, `/token/<id>/agent-card.json` | `Manifest` | per-token agent surface (§9) | ≤ 1 M |
| `/services.json`, `/.well-known/agent-registration.json`, `/.well-known/agent-card.json`, `/llms.txt`, `/llms.md` | `Manifest` | collection-level agent surface | ≤ 1 M |
| `/open.json` | `Manifest` via `Pool.openIds` | open markets directory, 48 per page | ≤ 1 M |
| `/manifest` | Premises | JSON: every route → `keccak256(body)` plus shard hashes and `engineHash` (special feature 3) | ≤ 10 M |
| `/k/<id>/<key>`; `/c/<id>`; `/token/<id>` | 301 → `/token/<id>/live?as=<key>` / `/token/<id>/live` | the agent door is the same app in session mode; compatibility | — |
| anything else | 404 document that never echoes the path | | |

Artwork routes are served by the router itself, never through a page (IPSEITY `Premises.sol:504-528` rule). `resolveMode()` returns `"5219"` and is never removed. Headers: `Content-Type`, `Cache-Control: public, max-age=15` (`evm-events` per ERC-7774 with `ClearPathCache` emitted by the hub on `MetadataUpdate`), `Link: </token/<id>/services.json>; rel="service-desc"`.

### 4.4 Rights predicate and the read-based gate

```solidity
uint16 constant R_HOLD = 1; R_ACCOUNT = 2; R_USE = 4; R_CUSTODY = 8; R_ROLE = 16; R_SESSION = 32; R_GUARDIAN = 64; R_STEWARD = 128;
function rightsOf(uint256 id, address actor) external view returns (uint16 bits, uint64 epoch, address holder);
```

Computed in the hub from `ownerOf`, `account(id)`, `userOf` (4907 or `Roles.recipientOf(USER)`), `getApproved`/`isApprovedForAll` (custody only, never use authority), `Reach.sessionCurrent(actor)`, `guardian`, `Steward.guardianOf(id, actor)` — every satellite read guarded. The page: EIP-6963 picker → `eth_chainId` compared with `KEEP.chainId` before any read → `eth_accounts` quietly, `eth_requestAccounts` only on a gesture → `rightsOf(id, account)` → render. `HOLD|ACCOUNT` opens every lane; `USE` opens trait edits; `SESSION` opens only what `sessionAllows` admits (the `/k` door); `GUARDIAN` opens pause/panic; everything else is read-only. Rights are recomputed on `accountsChanged`/`chainChanged`; only the chosen wallet's `rdns` touches `localStorage`; closing the tab is logout. Every write goes through the confirm slab (`propose` → `eth_estimateGas` → one press → `watch(h)`), and the contract is the only gate that holds. No SIWE, no nonce, no server. Delegate.xyz is read only as a viewing right (SHOULD 41), never for vault writes.

### 4.5 Wallet discovery and 7702 hygiene

`Chrome.WALLET_JS` (2,653 B, verbatim) moves into the engine: every EIP-6963 announcer keyed by `rdns`, a picker when more than one announces, `window.ethereum` only when none announce. On connect the page reads `eth_getCode(holder)`; if it starts `0xef0100` it names the delegate, compares its codehash to the short on-chain known-good list in `Manifest` (MetaMask `0x63c0…`, `Simple7702Account`, `SemiModularAccount7702`, Calibur) and withholds spend buttons behind an unknown delegate until acknowledged (special feature 11).

### 4.6 Screens

The console's verbs are the lanes; `verbWord` lives twice (engine `WORDS` and `Manifest.verbWord`) and `verify-console.mjs` holds them equal, as today.

| Lane | Verb | Contents |
|---|---|---|
| Swap | `trade` | market card (quote, `swap`/`swapExactOut`, bond, sniper fee, `pendingCurve`), the maker's bench, the Conduit quote beside the owned-pool quote with the venue manifest |
| Social | `speak` | commons walk, rooms, sealed pairs (Garden `whispers.mjs`; key re-read before every send, PR #27), home room (follows, journal), postage inbox, ERC-7409 reactions, a separate "heard from other chains" column if a port exists |
| Launch | `make` | Kiln four steps (coin → hook mined under `eth_call` → initialise → Planner mint), `/hook` inspector, Raise, Locker |
| Vault | `hold` | Reach/Grip balances, manifest, pieces, seal, approvals ledger with one-click revoke, Locker, Steward, stealth registration, panic |
| Identity | `look` | crest, fingerprint, traits (`curve` editor), epoch, status, lease/roles, name, keys |
| Agent | `act` | sessions (allowlist or recipe, caps, `minInterval`), the `/k` door, `services.json`, session audit |

### 4.7 Size budget

Measured inputs: `console.js` 16,573 + `console-lanes.js` 23,060 (53 KB filled on branch `claude/claude-md-docs-8vvyc8`) + `console.css` 18,359 + the engine's wallet library §7–8 24,449 (keccak, ABI, EIP-712, EIP-6963, `propose/fire/watch`, CREATE2-6551, sandbox detection; proven by `selftest.mjs` against published vectors) + chooser 2,653. Budget for the six lanes and shell: ≤ 70 KB more. **Source ≤ 200 KB → minified (terser, `reserved:["KEEP"]`) ≤ 120 KB → gzip ≤ 44 KB → 2 body shards.** `build-engine.mjs` fails the build above 46,000 gzip bytes or if the loader declares a global. The whole app is text and inline SVG: no WebGL, no fonts, no `src="https://…"`.

---

## 5. Swap

### 5.1 The owned pool

`Pool` keeps IPSEITY's thesis — `ownerOf(id)` is the sole LP; selling the NFT sells the market, its reserves and its fee income with no migration — and its proven mechanics: anchored virtual reserves `(x+vx)(y+vy)=k`, `Curve.anchor` called only on `openMarket/deposit/withdraw/syncCurve`, never in a trade; `amountOut` rounds the pool's remainder up; `MAX_OUT_BPS` refuses output above half the real reserve; deposits credit what arrived; `withdraw` is never pausable; `bond(id, until)` ratchets only, ≤ 365 d, survives transfer and freezes every exit and term. Changes, each small:

- **Curve source.** `curveWord = KEEP.getTraitValue(id, "curve")` replaces `sectionOf(id)`; `Curve.concentration(word) = min(uint256(word) & 0x1FFFF, 80_000)` bps replaces the 8×16 SLICE/FALLOFF art tables (library shrinks by ~1.5 KB). The holder sets the trait (ERC-7496, visible to every marketplace), `syncCurve` copies it, `pendingCurve` offers the sync — the social layer can display and discuss it, but only an explicit holder action applies it (special feature 8).
- **Native quote.** `quote == address(0)` means ETH; `deposit`/`swap`/`swapExactOut` are `payable`; `_pull(address(0), amt)` requires `msg.value == amt` (exact-value pattern); `_pushMeasured(address(0), to, amt)` is a `call` whose failure reverts, all under the global lock.
- **`swapExactOut(id, baseIn, amountOut, maxIn, to, deadline)`** with `Curve.amountIn` using `mulDivUp`; `roundTripNeverProfits` is extended to it and to dust (`0/1/2/9/2^64/2^128` wei).
- **Decaying sniper fee.** `snipe(id, uint16 startBps ≤ 9_900, uint32 decay ≤ 1 day)` writes an appended `Market` slot; `_fee(m) = feeBps + startBps·max(0, snipeUntil − now)/decay`; re-armed by `openMarket`/`deposit`; the fee stays in reserves. No exemptions exist because there is no list.
- **Authority.** `onlyHolder(id)` becomes `mayActAs(id, msg.sender) = ownerOf(id) == who || KEEP.account(id) == who` — the same predicate as Kiln and Parley, so a session key on the Reach can deposit into the token's own market (IPSEITY §10.1 inconsistency closed).
- **Graduation seam.** `RAISE` is an immutable; `graduate(id, base, quote, amtBase, amtQuote, bondFor ≥ 30 days)` may be called only by it, opens the market if closed, deposits, bonds, and emits `Graduated(id, terminalPrice, spot)` with both prices.

### 5.2 Exact fixes for the confirmed bugs

**C1 — re-entrancy through `closeMarket` leaves stale reserves that `openMarket` never clears** (`Pool.sol:356-392`): `nonReentrant` guards only `deposit/withdraw/swap`; `openMarket`, `closeMarket`, `setFee`, `bond`, `syncCurve` are unguarded, and `openMarket` writes `base/quote/feeBps/open/curveWord` without zeroing `rBase/rQuote`. Fix, two parts, both required: (a) one **global** `nonReentrant` on every state-changing function — the modifier uses a single transient slot `keccak256("keep.pool.lock") - 1`, set on entry and **cleared on every exit including revert paths** (SIR rule; a registry test enumerates every transient slot in the codebase); (b) `openMarket` begins with `delete marketOf[id];` before any assignment, so a struct can never inherit a phantom reserve regardless of how it was emptied. The sketched `test/mocks/PoolReenter.sol` and `tools/poc-pool.mjs` are finished and become the regression (`test_aMarketCannotBeReopenedOverAPhantomReserve`).

**C2 — `swap` reads `vIn/vOut` after `_pull`** (`Pool.sol:560-565`): a holder-controlled input token can call `syncCurve` inside the pull and re-anchor the curve the trade is about to use. Fix: move the four reads (`rIn, rOut, vIn, vOut`) **above** `_pull`, and — since (a) already locks `syncCurve` — the re-entrant sync reverts anyway. Regression: a `SyncInsidePull` mock token asserting `Reentrancy`.

**C5 — cross-market over-claim with out-of-band balance moves** stays monitored (`agents.mjs` invariant 63) with `bless` as the defence; mainnet launches with `allowlistEnforced = true` and a blessed set of {WETH-less native, USDC, launched `Coin`s and `FloorCoin`s by codehash} queued through the Timelock.

### 5.3 The router to external liquidity

`Conduit` (NEW) trades the Reach's assets on Uniswap without a standing approval to anything: `swap(SwapRequest{venueIndex, tokenIn, tokenOut, amountIn, minOut, deadline, sqrtPriceLimitX96, bytes path})` requires `KEEP.isCanonicalAccount(msg.sender, id, false)`; `venues[i] = {addr, codehash, kind}` are constructor-pinned and re-checked by `extcodehash` on every call (an upgraded venue fails closed); v3 paths are validated as in Garden; v4 keys must be hookless or carry a `GateFacet` codehash; the router snapshots its pre-call balance, pulls exactly, `forceApprove(venue, amountIn)` → call → `forceApprove(venue, 0)`, requires `balance delta ≥ minOut`, sends the output to the account and refunds only this swap's unspent input (ANIMA PR #13). `quote(SwapRequest)` runs the identical path and reverts `QuoteResult(spent, received, sqrtPriceAfter)` — "this swap cannot show a price it could not have settled at this block" (special feature 7). The app prints the venue table in `hooklist` schema. No owner, no fee, no aggregator; the owned pool is not a v4 hook in v1.

### 5.4 Authority predicate, stated once

`mayActAs(id, who)` = `ownerOf(id) == who || account(id) == who`. It is the predicate in `Pool`, `Kiln`, `Parley`, `Raise`, `Shelf` and `GateFacet.syncFee`. Renters never touch money or speech; approvees never act; session keys act only *as the Reach* and only within `sessionAllows`. The strict-owner exceptions are `Lease`, `Steward` and the Reach's `onlySigner`, for the reasons each file states.

---

## 6. Social and messaging

### 6.1 Speech predicate and rooms

`Parley.mayActAs` is unchanged: owner or the token's Reach, never the ERC-4907 user — "a reputation is not a thing you can hand back at the end of the day." Rooms: the commons (0), groups (`keccak(1, index)`), pairs (`keccak(2, min, max)`, derived by `whisper`, refused through `speak`), and — new, zero storage — **home rooms** `keccak(3, token)` where only the token may speak: follows (`kind FOLLOW/UNFOLLOW`, body = the followed id), journal entries (public or `SEALED` to self; MASTER's Memory desk becomes a room), announcements. A client reads a token's follows by walking its home room; the graph is the archive.

`Said(uint256 indexed room, uint256 indexed from, uint64 prev, uint64 prevFrom, uint32 seq, uint32 re, uint8 kind, bytes body)` gains `re` (the `seq` of the message answered, 0 for none) so threads are walkable without an indexer. `MAX_BODY` stays 1,024 for `PLAIN`; `SEALED` envelopes are capped at 4,096 (ephemeral-key ECDH envelopes are larger than static ones). Per-room `cooldown` (steward-set, ≤ 1 day; commons fixed at 2 blocks) is keyed by `keccak(token, custodyEpoch)` (Garden), so a buyer is not rate-limited by the seller's last word. State per room stays `{last, count, opened, members, kind, open, steward, index}` plus a **ring of the last four `(block, seq)` heads** (two slots), the re-entry points a client needs once EIP-4444 history expiry prunes old logs from non-archive nodes — stated plainly in the app: "older messages need an archive node."

### 6.2 Keys and sealing

`KeyRegistry` (ANIMA, verbatim) is the address-keyed, typed directory. The token-level binding is three lines in Parley: `bindKey(token)` records `(ownerOf(token), custodyEpoch, KEYS.keyIdOf(owner), keyType)`; `keyOf(token)` answers `(keyType, keyId, publicKey)` only while owner **and** epoch are unchanged — the dossier's `_sealOwner` lesson (`4fa41d0`) generalised. `whisper(from, to, kind, bytes32 expectedKeyId, body)` reverts `KeyMoved` unless `keyOf(to).keyId == expectedKeyId` (ANIMA's mempool-rotation guard). The browser side is Garden's `sdk/whispers.mjs` verbatim (ephemeral P-256 ECDH → HKDF-SHA-256 → AES-256-GCM, AAD bound to chain/hub/both ids/both epochs/key versions), with IPSEITY's P-256-from-`personal_sign` key derivation so a holder needs no second secret. The page says what the dossier says: ciphertext, participants and timing are public; no forward secrecy for pairs. Groups are public in v1; sealed groups are `MLSGroupChat` (MASTER, phase 3) with `ts-mls` caveated in-product and AAD = chain coordinates.

### 6.3 Spam economics

Three layers, no server: (1) speaking requires holding a token of a 4,096-piece edition with a secondary price; (2) per-room cooldowns keyed by epoch; (3) **postage** for first contact. `Parley.whisperStamped(from, to, kind, expectedKeyId, body, expectedFeeToken, maxPostage) payable` forwards value to `Postage.stamp(pairRoom, from, to, …)`, which escrows against the recipient's live inbox config (`configureInbox(token, feeToken(0 = native), postage, replyWindow 5 min–30 d, open)`, stamped with the owner's epoch so it goes stale on sale and defaults to *open, no postage*), refusing postage above `maxPostage` or a different fee token (the ANIMA repricing regressions). The recipient's `whisper` back within the window makes Parley call `Postage.settle(pairRoom)`, paying the escrow to `account(to)` — correspondence funds the token's vault. After `replyBy` anyone may `expire`, after which the sender pulls with `claimRefund`. Exactly one of `{settled, refunded}` ever becomes true. Postage adds one SLOAD to every whisper.

### 6.4 Reactions and follows, singletons first

Reactions call ERC-7409 at `0x3110…` with `(hub, tokenId, emoji)` for tokens and the synthetic id `uint256(keccak256(room, seq))` for messages — zero bytes of our budget, marketplace-visible. Follows are home-room messages (§6.1). Membership windows come from `Roster.inWindow` (verbatim).

### 6.5 Reading without an indexer

`stateOf(room).last` → `eth_getLogs` for exactly that block with `topics:[said, room]` → follow the oldest log's `prev`; `heads(rooms[])` is the 9-second poll; `topics()` hashes the event signatures on chain; `Roster` answers membership in one call. The `/services.json` document publishes the walk rule as data so an agent with an RPC needs nothing else.

### 6.6 Federation

Optional, phase 4, commons only: `ParleyPort` as shipped (no admin from the first block, DVN set and libraries fixed at construction with `requiredDVNCount ≥ 2`, `lzReceive` writes under its own `Echoed` event and cannot write into Parley). Groups and pairs never cross chains. A dead lane is a dead mirror, never a loss.

---

## 7. Launchpad

### 7.1 Creation

`Kiln.launch(id, name, symbol, decimals, supply, salt)` requires `mayActAs(id)`, CREATE2-deploys a `Coin` with `salt' = keccak(msg.sender, salt)` and — the one behavioural change — mints the supply to **`KEEP.account(id)`** (the Reach), not to `msg.sender`, so the supply is in the vault from block one and travels with the NFT. The record `{launcher: id, coin, launchedAt, poolKeyHash}` is per token; `recordPool(id, coin, PoolKey)` lets the page find a coin's pool later (IPSEITY debt: "a page cannot find a coin's pool without the user re-entering it").

### 7.2 Hooks

`mine(initCodeHash, flags, from, tries)` stays a view walked under `eth_call` (60,000 tries per window); `deployHook(kind, salt, arg)` CREATE2s a `GateFacet` and reverts `WrongFlags` unless `Hook.flags(hook) == wanted`. `GateFacet` is the branch's combined hook with: immutable `OPENS`/`UNLOCKS`; `beforeRemoveLiquidity` blocking only negative deltas so PositionManager's zero-delta fee collection works during the lock; `beforeInitialize` refusing non-dynamic-fee keys **and** any `PoolKey` whose `currency` pair is not the one recorded at deployment (Cork rule); `syncFee(uint256 expectedWord)` reverting `CurveMoved` (PR #36 applied to both hooks); `onlyPoolManager` on every callback; no delta-returning permission bits. The fee band `[FLOOR, CEILING]` is immutable and the override fee follows the token's `curve` trait — the same signal as the owned pool, so the launched coin's v4 fee and the token's market speak one parameter.

### 7.3 Fee routing to the NFT, and the LP custodian

The LP position NFT minted through `Planner` goes to the Reach (`mintPlan` recipient fixed to `account(id)`), where the holder `guardNFT`s it. Principal cannot leave before `UNLOCKS` because the hook refuses negative deltas — a lock enforced by the pool, not by whoever holds the position; fees are collected with a zero-delta `modifyLiquidities` the Reach may `execute` even under seal (measured balances only rise). Sale of the NFT sells the position, the lock and the fee stream in one transfer (special feature 9). `Locker.give(lockId, account(id))` is the team-token vesting primitive.

### 7.4 The raise phase (phase 2)

`Raise` keeps ANIMA's curve and discipline where it matters: `k = q·b`, `newBase = ceilDiv(k, newQuote)`; fair window ≤ 1 day; snipe tax decaying linearly from `snipeTaxStartBps ≤ 9,900` to zero at `fairWindowEnds`, clamped so `base + snipe ≤ 9,900`; `startsAt` never in the past; the launchpad custodies the whole `FloorCoin` supply (pre-launch tokens are claims in `Raise`, not transferable ERC-20s); fee split `{creatorBps → account(id), treasuryBps → FloorCoin.contribute, protocolBps = 0}` ≤ 100 bps, immutable per launch; the whole snipe tax goes to the redemption treasury so every sniper raises every holder's floor; `graduate()` is permissionless at target, zeroes approvals, and calls `Pool.graduate(id, coin, quote, tokens, raised, 30 days)` — the token's own market, bonded for a month by construction. Per-launch balances are isolated, so the shared-balance clamp bug `5d21694` cannot recur. `createLaunchChecked(p, expectedFeeHash)` pins the reviewed terms.

### 7.5 What a holder can do that an EOA cannot

Launch *as* the token: the coin's provenance is a token id, its supply sits in a sealed vault with a measured guarantee, its hook fee follows a trait a buyer can read, its LP lock survives the launcher selling out, and every fee stream — hook fees, pool fees, postage, raise creator fee — lands in `account(id)`. An EOA can deploy a coin; it cannot be *sold together with* the coin's market, position and reputation in one `transferFrom`.

### 7.6 Agent launches

Only through a Reach session scoped to `Kiln.launch`/`Raise.createLaunch` selectors with `expires`, `spendCap`, `minInterval ≥ 1 day` and `callsRemaining` (koorbx fields folded into `Session`); the first launch under any session requires the token to be `Active` (so a fresh buyer's agent cannot launch before the human re-arms it). Bankr × Grok cannot happen by construction (MUST 19).

---

## 8. Vault and accounts

### 8.1 Reach and Grip

The Reach is IPSEITY's `IpseityAccount` with its seal intact: snapshot ether, every manifest asset (≤ 16) and every guarded piece (≤ 8) before a sealed call; afterwards nothing smaller (`Shrank`), nothing blind (`WentBlind`), every piece held (`PieceLeft`); while sealed, manifest assets accept only `transfer`/`transferFrom` (deny-by-default after Permit2 walked through a blocklist); `seal(until)` ratchets only, ≤ 365 d, survives sale; `execute` is operation 0 only; `executeBatch` (≤ 16) snapshots once around the batch. The Grip is `GripVault` verbatim: no `execute`, `withdraw`, sweep, rescue, owner or admin; `isOneWay()`; declines `0x51945447`; `state() == 0`; `verify-vault.mjs` asserts every selector against the compiled ABI.

### 8.2 Sessions — one system

IPSEITY's `grantSession(key, expires ≤ 365 d, spendCap, targets[≤16], selectors[≤16])` is the base; epoch-keyed allowlists so revoke is O(1); the actual spender argument is checked for approval-shaped calls; `mark = custodyEpoch`; no call to the account itself; `sessionAllows(key, to, sel)` as a view. Grafts, each a field or a function:

- `Session.recipe` (bytes32, optional): Garden's exact-recipe grant — `grantRecipe(key, recipeHash, expires, uses 1..1024)`; such a key may only `executeTyped` a call whose `recipeHash(call) == recipe`. Worst-case exposure is `spend × uses`, printed before the owner signs.
- `Session.minInterval`, `callsRemaining`, `expectedState` (koorbx `SessionScope`): rate and count limits; `expectedState` pins the account state at grant so a re-armed account retires the key.
- **`executeTyped(TypedCall{to, value, bytes data, AssetLimit[≤4] spend, AssetLimit[≤4] receiveMin, uint64 deadline})`** (Garden `_perform`): exact approvals only if allowance is zero, reset and verified zero afterwards; `spend` balances may fall at most by the cap, `receiveMin` balances must rise by at least the floor; taxed and rebasing tokens revert by construction. This is the ERC-20 budget ANIMA's native-only cap lacked, and the one shape an agent needs for "swap exactly this for at least that."
- Sessions require `KEEP.status(id) == Active`; a paused token's keys cannot spend while the owner always can. `revokeSession` is owner or guardian.

Session keys are never valid for ERC-1271.

### 8.3 ERC-1271 and ERC-7739

The account signs only its own `KEEP_ATTESTATION` typed data (`Attestation(purpose, payload, nonce, deadline)`) with `retireAttestations()` bumping every signature it ever gave — structurally incapable of signing a venue's order. The digest is wrapped per ERC-7739 (`TypedDataSign` with the account bound in the signed payload; the verifier's hash is never mutated; tested as a Safe ≥ 1.4.1 owner) so a third party can verify "this account attests X" without replay across accounts. This is the proof primitive for anyone who needs one; it is not a login.

### 8.4 Open-approval ledger

`_act` inspects the selector of every outgoing call: `approve`, `increaseAllowance`, `setApprovalForAll`, both `permit`s and Permit2's `approve(address,address,uint160,uint48)` append `(asset, spender)` to `approvals[]` (≤ 32; the 33rd reverts `LedgerFull` until the holder prunes). `revokeAll()` emits zeroing calls in one batch; a foreign reverting `approve` does not block it (`try` + `extcodesize`). `approvalsRoot()` is folded into the fingerprint (§3.4), so a sale order can require the set empty (special feature 1).

### 8.5 Limits, timelocks, panic

Locker (verbatim): ≤ 3,650 d, extend longer only, `give()` into the Reach. Pool bond ≤ 365 d, lengthens only. Seal ≤ 365 d, lengthens only. `Keep.panic(id)` (owner or guardian) bumps `custodyEpoch[id]` and `approvalEpoch[owner]`, sets `Paused`, and calls `Reach.sealMax()` (hub-only entry) — every delegated right dies in one call, and listing on any market is modelled as a seal to the listing's expiry (special feature 2).

### 8.6 Succession and recovery

`Steward` (phase 2) adapts `Succession`: `arrange(id, heirHash = keccak(heir, salt), toToken, quiet 30–3,650 d, notice ≥ 14 d, guardians[≥2], threshold)`; only `arrange`/`stillHere` count as life (the `embody` lesson); `summon` by anyone after silence, or `recover` by a guardian quorum, starts one cancellable `notice`; `claim` moves the token through a single-token `approve` the hub clears on any transfer; `wouldPass` returns status codes; `getWill/getObit` make it ERC-7878-legible; a capped bounty from the Reach pays whoever executes a matured claim. Void on transfer by the epoch.

### 8.7 What survives sale, what is revoked

Survives: both accounts and every asset in them, the seal, guarded manifest and pieces, Locker locks given to the Reach, the Pool market with reserves, bond, fees and `curve` trait, the launch record and LP position (lock included), the `FloorCoin` treasury floor, the public archive and home room, the name (custody is the binding), traits, open-approval entries (visible, revocable by the buyer). Revoked: the single approval, operator approvals (buyer starts at their own `approvalEpoch`), 4907 user, lease agent, guardian, status → Paused, every session, the key binding, Postage inbox config, Steward arrangement, Shelf activations (inert until re-accepted), usage grants.

---

## 9. Agents

An agent uses the same surfaces a person does, through the same door. Its wallet is a session key on the Reach; it opens `/token/<id>/live?as=<key>` (the `/k` door), which refuses a wallet whose `eth_requestAccounts[0]` is not the key and shows only what `sessionAllows` admits. `propose` and `act` are separate tools (IPSEITY `AGENT.md`): the agent reads `/token/<id>/services.json` — `{service, sig, selector, kind, route, args}` for every function of every satellite, the archive walk rule and the band table — simulates with `eth_call`, and sends through `executeAsSession`/`executeTyped`. `keccak256(services.json)` is the `servicesHash` trait; an MCP or A2A bridge refuses a catalog whose hash differs (MUST 26). `tokenURI` face 2 is the ERC-8004 `registration-v1` document with `agentId == tokenId`, `services[]` = the token's `web3://` routes and its account, `x402Support: false`, `supportedTrust: []` — emitted from chain state, complete at mint, no `setAgentWallet` to clear because the wallet is derived (special feature 5). `/.well-known/agent-card.json` nests an A2A `AgentCard`; `/llms.txt` with `.md` twins and `Link:` headers come from `Manifest`. Reputation: none is claimed in v1 — there is no escrow to ground it, and the brief's Sybil figures say ungrounded feedback is worse than none; mirror-registration in the canonical ERC-8004 singleton with an ERC-8217 binding is phase 4 and discovery-only. Two test-enforced invariants: transferring any token into the Reach or Grip changes no bit of `rightsOf` and no session (Bankrbot), and no `onERC*Received` grants anything.

---

## 10. Special features kept

1. **Fingerprint-bound settlement with an open-approval ledger** — §3.4/§8.4; every `buy`/`claim` in the protocol takes `expectedFingerprint`.
2. **`panic()` and seal-as-listing** — §8.5; `Panicked(id, epoch)`; traits render "sealed until T".
3. **The self-verifying site** — `/token/<id>/hash`, `/manifest` (route → `keccak256(body)`, shard hashes, `engineHash`), `contractURI.engineHash`, `tools/verify-gateway.mjs` diffing gateway bodies against local `eth_call`; the footer prints "verified against chain at block N".
4. **One site, same address on every band** — Premises, shards and every satellite at CREATE3 addresses; ENS `contentcontract` points at the canonical band; `scriptURI()` returns it. Three boot modes (opaque / gateway / native) with "zero" and "no answer" never collapsed.
5. **The agent card minted with the token** — §9.
6. **Agent-safe by construction** — §9's two invariants; capability never granted by an adversary-controlled action.
7. **Quote is a settlement, plus a venue manifest** — `Conduit.quote` reverts with the real path's result; the venue table in `hooklist` schema beside the owned pool's pure quote.
8. **The curve is a trait; the bond is a promise the trait keeps** — `curve` as ERC-7496; `bondedUntil`/`sealedUntil` `validateOnSale`; holder-set decaying sniper fee with no exemption list.
9. **Sell the NFT, sell the streams** — Kiln mints to the Reach, LP to the Reach under a hook-enforced lock, every fee leg to `account(id)`; `Graduated` emits terminal and spot prices together.
10. **The inbox that ships with the token** — epoch-bound key binding; a buyer sees a provably fresh inbox plus the public archive; the Grip registers an ERC-6538 stealth meta-address (the Reach calls `registerKeys` directly as `msg.sender`, no signature needed) so any Umbra-class wallet can pay the token privately with no relayer, and the viewing key doubles as the messaging key.
11. **Priced attention into the vault; reactions every wallet can read** — §6.3/§6.4.
12. **Clear-signing from chain and 7702 hygiene** — selectors and a per-selector decoder table from `ConsoleRead.sels()` render "you are about to: swap 1.0 ETH → ≥ 2,400 USDC via this token's pool"; delegate codehash check on connect (§4.5).

The steward (brief idea 15) is §8.6; the NFT-as-KYC validation hook for CCA (idea 10) and passkey sessions (idea 14) are phase-4 candidates, not promised.

---

## 11. Chain and deployment

**Bands.** Base mainnet (chain 8453) is band 1 and primary: ids 257–4,096, where the owned pools, launches, messaging logs and agents live (a 200 k-gas action ≈ $0.003). Ethereum mainnet (chain 1) is band 0, canonical and small: ids 1–256, the ENS name, `Nameplate`, the canonical `contractURI` and hash manifest. OP Mainnet (10) is band 2, reserved (ids 4,097–4,352) and unminted until a written decision; the "band orphaned" rule is in `DEPLOYMENT.md` from day one: a band with no reachable gateway is still a band; its tokens still work through any RPC. `BAND_LO/BAND_HI` are hub immutables; `Nameplate`'s wildcard and `Manifest`'s door carry the table. No token bridge, ever (KelpDAO, OMNICHAIN.md).

**Addresses.** Every protocol contract and every Engine shard is deployed to the same address on every band: shards by CREATE2 with `salt = sha256(payload)`; contracts by Solady `CREATE3` from a factory deployed by a fresh nonce-0 key (IPSEITY's `port.mjs` mesh pattern). Constructor arguments that differ per band (band bounds, chain-specific Uniswap addresses) are passed per chain; the address does not depend on them under CREATE3.

**Order** (one `deploy.mjs`, resumable, journaled, three lag defences): Timelock → Engine (load shards, `freeze`) → Crest → Reach and Grip impls → Keep (immutables: registry, impls, salts, band, Timelock) → KeyRegistry → Pool (`RAISE` predicted) → Raise → Postage (Parley predicted) → Parley → Roster → Kiln → Planner → Locker → Lease → Roles → Steward → Conduit → ConsoleRead → Renderer → Manifest → Premises → `setRenderer`, `setModule(Roles|Steward|Lease)`, `sealModules()`, `sealRenderer()` → Nameplate (band 0) → Timelock admin renounced or handed to a 2-of-3 multisig that can only *queue*. `recover-record.mjs` walks the immutables back and exits non-zero on any disagreement.

**Cost.** ≈ 24 contracts averaging 11 KB ≈ 265 KB ≈ 58 M gas at 220 gas/byte, plus 2 shards ≈ 10 M, plus wiring ≈ 15 M: **≈ 85–100 M gas per band** (IPSEITY's 46-contract site measured 136 M). Base at 0.005–0.05 gwei: 0.0005–0.005 ETH plus ≈ 0.5 % L1 data (≈ $1–12). Mainnet at 0.5 gwei: ≈ 0.05 ETH (≈ $120). The mainnet band deploys **before Glamsterdam** (EIP-8037 reprices code deposit 7× and a 23 KB chunk would no longer fit under the 2^24 cap); the deployer refuses post-8037 chunks over the cap.

**One-way.** `Engine.freeze`, `sealRenderer`, `sealModules`, `sealPricing`, Pool `bond`, Reach `seal`, Locker `until`, GateFacet `OPENS/UNLOCKS`, Timelock admin renunciation. The curator's remaining levers (`setPricing` until sealed, `setRoyalty` ≤ cap, `withdraw` of mint proceeds, Pool `setPaused`/`bless`) sit behind the 7-day Timelock and are documented as the whole of what is curated.

**If EIP-7954/7907 raises the code limit on a band.** Nothing in the authority model changes; only the partition does: fold `Pool + Conduit`, `Parley + Postage + Roster`, `Kiln + GateFacet template + Planner`, `Renderer + Crest + ConsoleRead` into single contracts (four fewer deployments, fewer cross-contract reads on hot paths), and keep the hub a hub — the site never moves into the token. Because every satellite reads the hub through a minimal local interface, a fold is a redeploy of a new band's set, not an upgrade of a live one.

---

## 12. Toolchain

**Base: IPSEITY's `tools/`** — the only pipeline measured to compile every contract under EIP-170 in this container (solc-js 0.8.36, viaIR, optimizer 800, cancun; 3 m 57 s cold), needing no Foundry and no external Solidity dependency, whose 22 verifiers *are* the specification of Pool, Reach, Parley, Premises and the engine; porting them to Hardhat 3 would cost more than every graft here. ANIMA's suite contributes patterns, not a runtime. Verbatim: `compile.mjs` (content-addressed cache, 24,576-byte gate; add Garden's `metadata.bytecodeHash: "none"` so code-hash admission is reproducible), `evm.mjs`/`rpc.mjs` (add tuples and an EIP-7825 assertion), `forge.mjs` (3-byte-REVERT negative control; add ANIMA's `expectRevert` by 4-byte selector), `gas.mjs` (fails any view over **16,777,216** or 50 M), `build-engine.mjs` (`reserved:["KEEP"]`, gzip ceiling, no-global grep), `selftest.mjs`, `gateway.mjs`, `recover-record.mjs`, `fuzz.mjs`, `agents.mjs`, `verify-findings.mjs`, `testnet.mjs` with PR #25's rollup-fee allowance. Dropped: `glsl-check`, `verify-instrument/thermal`, `probe-*`. Added: `verify-gateway.mjs`, MASTER's `static-audit.mjs` (forbids `tx.origin`, `selfdestruct`, `.delegatecall(`, raw `sstore`, `extcodesize == 0` idioms), a transient-slot registry test, and MASTER's "incomplete ≠ pass" rule.

**CI (`npm run check`, in order):** `selftest` → `build` → `forge` (ported suites: `Pool.t.sol`, `Lease.t.sol`, `Parley.t.sol`, `V4PositionPlanner.t.sol`, `Keep.t.sol` from `Ipseity.t.sol` + ANIMA's epoch/lock/approval cases rewritten as `.t.sol`, `Reach.t.sol` from the vault verifier's properties) → `gas` → `verify` (document round trip; **surface equality**: `document(id)` == `/token/<id>/live` body == decoded `animation_url`; 13 ERC ids) → `verify-pool` → `verify-vault` → `verify-premises` → `verify-site` (DOM + wallet shim against the in-process EVM driving every route and every lane) → `verify-parley` → `verify-timelock` → `verify-launch` → `verify-curve` (trait → concentration) → `verify-recover` → `verify-console` (Chromium: three boot modes, viewer refuses to sign, picker, `/k` door) → `fuzz` → `verify-findings` (every historical finding replayed: 13 IPSEITY + C1/C2 + ANIMA's `EmptyBatch`, handle, revenue-revival class as applicable) → `agents` → `static-audit`. Nightly: `verify-gateway` against a self-hosted `ethstorage/web3url-gateway` on Base Sepolia (w3link does not serve it) and against w3link on Base mainnet once live. Counts are written to docs only after a run.

---

## 13. Build plan

MVB = must ship before any public deployment. Done-criteria are the tests that must pass.

| # | Unit | Create / copy / adapt | Origin | Tests ported | Done when | MVB |
|---|---|---|---|---|---|---|
| 1 | Skeleton and toolchain | `tools/*` as §12; `remappings.txt`; `package.json` scripts; CI workflow | IPSEITY `tools/`, MASTER `static-audit.mjs` | `selftest`, forge self-check | `npm run check` runs green on an empty `src/` with the negative control burning gas | ✓ |
| 2 | Hub | `src/Keep.sol`, `src/interfaces/IKeep.sol` (normative `Core`), `Standards.sol` | IPSEITY `Ipseity.sol`, `Standards.sol`; ANIMA `_update`, `approvalEpoch`, `lockCount`, fingerprint | `Ipseity.t.sol` → `Keep.t.sol`; ANIMA epoch/lock/approval cases as `.t.sol` | `test_sellingRevokesEverySellerAuthority`, `test_lockedTokenCannotMove`, one fingerprint mutation per field; ≤ 22,500 B | ✓ |
| 3 | Accounts | `src/Reach.sol`, `src/Grip.sol`, `src/lib/AccountBinding.sol` | IPSEITY `IpseityAccount.sol`, `GripVault.sol`; Garden `AccountBinding.sol`, `_perform`; koorbx `SessionScope` | `verify-vault.mjs` (97), `verify-findings` vault claims | all 97 plus `executeTyped` exact-delta, approval ledger, 7739-as-Safe-owner; Grip ABI has no spend selector | ✓ |
| 4 | Document | `src/Engine.sol`, `src/Renderer.sol`, `src/Crest.sol`, `src/ConsoleRead.sol`, `engine/keep.html` (shell + wallet lib + chooser + console JS/CSS) | IPSEITY `Engine.sol`, `Renderer.sol`, `ConsoleRead.sol`, `Chrome.WALLET_JS`, branch console | `verify.mjs` (121/122) | `tokenURI` ≤ 8 M, `/live` ≤ 5 M under `gas.mjs`; no global in the loader; gzip ≤ 46 KB | ✓ |
| 5 | Router and manifest | `src/Premises.sol`, `src/Manifest.sol` | IPSEITY `Premises.sol`, `PageManifest.sol` | `verify-premises.mjs` (30), `verify-site.mjs` route half | every route in §4.3 answers; surface equality asserted; `/manifest` hashes match | ✓ |
| 6 | Pool | `src/Pool.sol`, `src/lib/Curve.sol` | IPSEITY | `Pool.t.sol` (28), `verify-pool.mjs` (62), `fuzz.mjs`, `agents.mjs`, finished `PoolReenter` PoC | C1/C2 regressions; native pairs; `swapExactOut` never profits at dust; Reach admitted; transient-slot registry | ✓ |
| 7 | Messaging | `src/Parley.sol`, `src/Roster.sol`, `src/KeyRegistry.sol`; `engine/whispers.mjs` | IPSEITY `Parley.sol`, `Roster.sol`; ANIMA `EncryptionKeyRegistry.sol`; Garden `whispers.mjs`; PR #27 | `Parley.t.sol` (26), `verify-parley.mjs` (37) | reply pointer walkable; `KeyMoved` on rotation; sale invalidates the binding; home-room follows; epoch-keyed cooldown | ✓ |
| 8 | Launch core | `src/Kiln.sol`, `src/GateFacet.sol`, `src/Planner.sol`, `src/Locker.sol`, `src/lib/Hook.sol` | IPSEITY + branch `hciyvv` + PR #36 | `verify-launch.mjs` (49+), `V4PositionPlanner.t.sol` (12) | coin minted to the Reach; `WrongFlags`; `CurveMoved`; foreign `PoolKey` refused; authority follows the NFT after a sale | ✓ |
| 9 | Timelock and deploy | `src/lib/Timelock.sol` wired; `tools/deploy.mjs` (CREATE3, journal, lag defences) | IPSEITY `Timelock.sol`, `site.mjs`, `testnet.mjs`; ANIMA lag defences | `verify-timelock.mjs` (24), `verify-recover.mjs` | curator calls revert for all but the Timelock; local deploy recovers with 0 disagreements; same addresses on two chains | ✓ |
| 10 | Lanes | six lanes in `engine/keep.html`; `verbWord` in `Manifest` | branch `console-lanes.js`; new MAKE/HOLD/LOOK/ACT | `verify-site.mjs`, `verify-console.mjs` (96) | each lane drives its contracts through the DOM shim; exact-amount approvals; viewer cannot sign; `/k` refuses a non-key wallet | ✓ (TRADE/SPEAK/HOLD/LOOK); MAKE/ACT phase 2 |
| 11 | Conduit | `src/Conduit.sol`, `src/Venue.sol` | ANIMA `AgentSwapRouter.sol`; Garden path validator; MASTER quote lens | ANIMA `SwapRouter.test.ts` (11) as `.t.sol` | delta check catches an under-delivering venue; no standing approval; `quote` equals `swap` in the same block; upgraded venue fails closed | phase 2 |
| 12 | Postage | `src/Postage.sol`; `whisperStamped` in Parley | ANIMA `AgentComms.sol` | `Comms.test.ts` (14) as `.t.sol` | repricing/fee-token regressions; one of settled/refunded; pull refund; config stale on sale | phase 2 |
| 13 | Raise | `src/Raise.sol`, `src/FloorCoin.sol`; `Pool.graduate` | ANIMA `AgentLaunchpad.sol`, `AgentToken.sol`, `createLaunchChecked` | `Launchpad.test.ts` (15) as `.t.sol` | graduation lands in the token's market bonded ≥ 30 d; both prices emitted; tax clamp; no transferable pre-launch token | phase 2 |
| 14 | Steward and panic | `src/Steward.sol`; `Keep.panic`, `Reach.sealMax` | IPSEITY `Succession.sol` | `verify-estate.mjs` succession half | `embody` is not life; guardian quorum; cancellable notice; void on transfer; `panic` kills every right | phase 2 |
| 15 | Lease and Roles | `src/Lease.sol`, `src/Roles.sol`; hub 4907 shim | IPSEITY `Lease.sol`; ANIMA `AnimaRoles.sol` | `Lease.t.sol` (26), `Roles.test.ts` (14) | renter never touches money or speech; a live role locks the token | phase 2 |
| 16 | Names | `src/Nameplate.sol` | IPSEITY + PR #26 | `verify-plate.mjs` | `contentcontract` opens the site; wildcard per band; canonical wrapper only | phase 2 (band 0) |
| 17 | Shelf | `src/Shelf.sol`, `src/Releases.sol`; sandboxed cartridge frame + `MessageChannel` bridge | MASTER module registries; Garden `ArchiveFactory`, `host.mjs` bridge | MASTER module regression subset; Garden `cartridges.test.mjs` | installation grants no authority; `StaleReview` on epoch change; frame `connect-src 'none'` | phase 3 |
| 18 | Singletons | 6538 registration from the Reach; 7409 reactions | brief §1.7 | new | reactions visible to a 7409 reader; stealth meta-address registered without a relayer | phase 3 |
| 19 | Sealed groups | `src/MLSGroupChat.sol`; `ts-mls` client, caveated | MASTER | MASTER MLS and communication tests | AAD-bound replay fails; reorg freezes | phase 3 |
| 20 | Rehearsal | Base Sepolia + Sepolia; self-hosted gateway; `verify-gateway`; audits | IPSEITY `testnet.mjs`, `gateway.mjs`; ANIMA scripts | the 2026-09-24-style exercise | every function family exercised live; gateway diff clean; two audits of units 2–8 | before mainnet |

---

## 14. Risks and open decisions

1. **Hub size.** `Ipseity.sol` is 19,316 B with ≈ 3.5 KB to remove and ≈ 3.5 KB of grafts to add; ≈ 21 KB is an estimate. *Recommendation:* measure at unit 2; above 23,500 B the fallback is ANIMA's immutable no-`diamondCut` diamond with `deriveFacetCut` — a size tool, not an upgrade path.
2. **One session system.** IPSEITY's allowlist sessions are the base with the recipe and rate fields grafted; ANIMA's ERC-4337 path is deferred. *Recommendation:* ship without 4337; add a companion routing `executeUserOp` into the same `_enforceSession` only if a bundler use case appears, immutable EntryPoint v0.9, never a 7702 delegate.
3. **Raise in v1 or not.** Kiln + GateFacet + Pool bond already satisfy most launchpad MUSTs; the raise adds 17 KB. *Recommendation:* phase 2, behind `mayActAs`, with `FloorCoin` only so the tax has a floor to raise.
4. **Postage ↔ Parley coupling.** Mutual immutables, one extra SLOAD per whisper. *Recommendation:* accept; a separate stamp transaction breaks "one press" for EOAs without EIP-5792.
5. **Curve trait semantics.** A holder-set word gives the holder a lever bounded by `minOut`. *Recommendation:* cap at 8×, show the pending change in the app, mark the trait `validateOnSale`, keep the fuzz property that a sync never extracts from an in-flight trade.
6. **`tokenURI` under hosted RPC caps.** Budgeted ≤ 8 M; hosted caps unverified. *Recommendation:* measure on three public Base endpoints at unit 4; if any refuses, percent-encode the envelope (Garden) before freezing the engine.
7. **Sealed groups.** `ts-mls` is unaudited. *Recommendation:* v1 seals pairs only and says so; MLS in phase 3 with the caveat in-product.
8. **EIP-4444.** Back-linked logs assume `eth_getLogs` reaches old blocks. *Recommendation:* the four-head ring in state, the walk rule in `services.json`, a stated "archive node for older history"; no indexer.
9. **ERC-8004 mirror.** The canonical registries are upgradeable proxies. *Recommendation:* emit the registration from chain now (face 2); mirror with an 8217 binding in phase 4 after confirming indexer behaviour, never as a correctness dependency.
10. **Readiness.** Nothing in the four repositories is audited; `MAINNET_READINESS.md` lists ten gates, none met. *Recommendation:* units 1–10 plus two independent audits of units 2, 3, 6, 8 before band 1; band 0 after band 1 has run a quarter in public with custody-free `setPaused` as the only emergency lever.

---

### Appendix — MUST coverage (research brief §2)

1 §3.1/§8.1 · 2 §3.2–3.3 · 3 §3.4 · 4 §8.3 · 5 §8.3, `static-audit` · 6 §2 (no proxy, no module host, op 0) · 7 §4.2 · 8 §3.5, `gas.mjs` · 9 §4.1, §11 · 10 §4.4 · 11 §8.7, unit 15 · 12 §8.2 · 13 §9 · 14 §5.1 · 15 §5.3 · 16 §5.3 · 17 §7.1–7.4 · 18 §7.2 · 19 §7.6 · 20 §6.1 · 21 §6.2 · 22 §6.2 (phase 3, deviation stated) · 23 §6.4, §10.10 · 24 §6.3 · 25 §9 (identity yes; reputation none claimed) · 26 §9 · 27 §4.1, `Web.esc/jsonEsc` everywhere · 28 §10.3 · 29 §8.5 · 30 §8.6 · 31 §5.2 · 32 §6.6 · 33 §10.10 · 34 §11 · 35 §6.3, Lease `earned`, Locker, Steward bounty.
