# U18 — Nameplate (band 0, the ENS resolver): unit report

Branch `wave4/u18` from the integrated head 40a678f. Files owned and
created: `src/Nameplate.sol`, `tools/verify-plate.mjs`, `tools/ens-name.mjs`,
`test/mocks/{EnsRegistry,EnsRegistrar,EnsNameWrapper,EnsCounterfeits}.sol`,
this report. No other file was edited; every change another unit's file
needs is a request below (§6–§10).

## 1. What was built

**`src/Nameplate.sol`** — an adminless ENS resolver for `intact.eth` on
band 0 (DESIGN §3 row 30, §12). The donor's stored bindings (`bind`,
`claimParent`), its station table, its gateway table and its write-once
renewer are gone; the contract has no setter, no admin and **no storage**
(a verifier sentence reads the source and says so). What remains is the
donor's rule, stated in the header and enforced on every query:

- **Custody is the binding.** A wrapped ENS name is an ERC-1155 token in
  the NameWrapper. Inside an Intact's Reach (or Grip) it means that Intact,
  with no transaction on the resolver and nothing to remember; sell the
  Intact and the name goes with it (DESIGN §2, "what survives: the name").
- **The apex is a name like any other.** `intact.eth`, and every numeric
  wildcard `<id>.intact.eth` under it, answers exactly while, at the block
  of the query: (a) the registry names the canonical NameWrapper as the
  apex's owner; (b) that wrapper says a canonical account of THIS hub on
  THIS chain holds it — the holder must answer ERC-6551 `token()`, name
  this hub, and be exactly `hub.account(id)` or `hub.grip(id)`; (c) the
  .eth registrar says `nameExpires(keccak("intact")) > block.timestamp`.
  In the grace period the wrapper still names the holder and the resolver
  already answers nothing. Nothing is written, so nothing can go stale.
- **What a name answers.** `addr(node)` = the token's Reach (the donor's
  choice: sending ETH to the name funds the acting account); `addr(node,60)`
  the same in ENSIP-9 form; `text(node,"contentcontract")` =
  `eth:0x<Premises>` (ERC-6821 in ERC-3770 form, `sep:` on Sepolia, the bare
  address where the chain has no short name); `text(node,"avatar")` =
  `eip155:1/erc721:<hub>/<id>`; `text(node,"url")` = the token's
  `web3://<premises>:1/token/<id>/live` (the apex: the collection's `/`);
  `contenthash` empty (the donor served none: this site is the chain);
  ENSIP-10 `resolve(name, data)` for all of it; `supportsInterface` for
  ERC-165, `addr`, `addr(bytes32,uint256)`, `contenthash`, `text` and
  ENSIP-10. An id outside the band, an unminted id, a name nobody holds, a
  lapsed registration, a malformed wire name, an inner call it does not
  serve: each gets the empty answer of its record type, never a revert.
- **Reads of the world** follow the house rule: the wrapper, the holding
  account, the registrar and the hub's `ownerOf` are read by `extcodesize`
  + raw `staticcall` and decoded only when the shape is right; "no answer"
  is never 0 and never a revert. Wire names are validated (≤ 63 bytes a
  label, ≤ 16 labels, a terminator) before the recursive namehash walk, so
  no hostile name can deepen the recursion or read past the end.
- **The Sepolia wrapper fix (I PR #26):** the NameWrapper is a constructor
  argument asserted to hold code, never a constant; `tools/ens-name.mjs`
  carries the table (mainnet `0xD4416b13…`, Sepolia `0x0635513f…`), and a
  verifier sentence pins both.
- **Legacy `addr(node)` for a non-apex held name** keeps the registrar's
  clock too: the wrapper's `names(node)` (the wire-format name the real
  NameWrapper stores at wrap) gives a bare node back its second-level
  label. A wildcard node has no registry record, so no legacy client ever
  reaches the resolver with one; the legacy path answers zero for it, and
  a sentence says so.

**`tools/ens-name.mjs`** — `namehash`, `labelhash`, `dnsEncode`, `normalize`
(ASCII-only; a non-ASCII name is refused rather than hashed wrong);
`encodeContenthash` (ANIMA's, extended to CIDv0 `Qm…`); `decodeContentcontract`
(ERC-3770; the CAIP `eip155:1:0x…` form refused, the donor's gateway lesson);
`parseWeb3Url`; the inner-call encoders and `unwrapResolve`; `findResolver`
(the ENSIP-10 walk up to the apex), `resolveRecord`, `resolveContentcontract`,
`openWeb3Url` (`web3://intact.eth/token/3073/live` → ENS → `contentcontract`
→ chain check → `Premises.request(["token","3073","live"])`, with the steps
recorded); `custodyReport` and `assertEnsCustody` (every read behind the
answer, reads only, `now` from the chain's clock). Every chain-touching
function takes `read(to, calldata)` — the in-process `Chain.call` in the
verifier, `RpcChain.call` on a wire. The CLI reads `RPC_URL` from the
environment and writes nothing anywhere (a sentence scans the source for
any host literal and any file write).

**`test/mocks/Ens*.sol`** — an ENS in the shape of the real one, so the
operator's steps are performed by the verifier exactly as they will be on
mainnet: the registry with its `authorised` rule and the root handed to
the deployer; the .eth BaseRegistrar with `nameExpires` keyed by the
label's hash, the 90-day `GRACE_PERIOD`, `ownerOf` reverting once lapsed,
`register`/`renew` for a controller (refusing a renewal past grace, as the
real one does), `reclaim`, and the approval family; the NameWrapper with
the real `getData` expiry rule (a lapsed name with `PARENT_CANNOT_CONTROL`
reads as held by nobody — ninety days after the registrar does), `names(node)`,
`wrapETH2LD` (take the registrar's token, become the registry owner, set the
resolver, mint), `registerAndWrapETH2LD` (what the controller does),
`setResolver`, `setFuses`, `renew`, `unwrapETH2LD`, and ERC-1155
`safeTransferFrom` **with the acceptance check a contract recipient must
pass** — so the fixture's transfers into the Reach and the Grip went through
the real `onERC1155Received` of both; `EnsCounterfeitWrapper` and
`EnsImpostorAccount` for the attacks.

## 2. Bytes

`Nameplate` measures **6,979 B** of the 10,000 B budget (`tools/compile.mjs`,
solc 0.8.36, viaIR, optimizer 800, `bytecodeHash: "none"` — the same count
`tools/verify-plate.mjs` prints in its sentence *"Nameplate measures 6979 B
of 10,000"*). The donor's `Nameplate` measured 9,957 B with its bindings,
stations and renewer; what was stripped is more than what was added (the
ENSIP-9 `addr(bytes32,uint256)`, the wire-name validation, the
`names(node)` read for the legacy clock, `nodeOf`). The fixtures are not
deployables: `EnsNameWrapper` 7,319 B, `EnsRegistrar` 2,634 B, `EnsRegistry`
1,945 B.

## 3. The verifier

`node tools/verify-plate.mjs` — **228 passed, 0 failed** on this tree (the run of 2026-10-13 after the
`heldBy` restructure; ≈ 1 min warm, of which 20–56 s is minting the band
out, the machine being shared with the integrator's battery at the time). Every assertion is a sentence; the
summary line is the last line; exit 1 on any failure. The three BUILD-PLAN
sentences, as they read in the file:

- *"the walk's bytes equal Premises.request(["token","3073","live"])'s body byte for byte"* and
  *"which are Renderer.document(3073): the console, on a real origin, reached by name"* — `contentcontract` opens the site;
- *"a contract claiming to be the NameWrapper cannot bind: heldBy(counterfeit.eth) is 0"*, with
  *"and 3073.counterfeit.eth answers nothing: the wildcard follows the apex"* — a counterfeit wrapper cannot bind;
- *"every id from 3073 to 3584 answers its own Reach through <id>.intact.eth: 512 of 512"*, with
  *"3072.intact.eth answers nothing: one below the band"* and *"3585.intact.eth answers nothing: one above the band"* — the wildcard resolves every id in the band (every one of the 512 is minted; 3585 is refused by the hub with `BandExhausted`).

The BUILD-PLAN done-criterion — `web3://intact.eth/token/3073/live` resolves
on a local ENS fixture — is the first of those, performed by the tool's
walk through the fixture's registry, the Nameplate and the real Premises.

The rest, by section: the constructor's pins and its three refusals
(`WrongRegistrar`, `NothingThere`, `BadLabel`); nothing answers before
custody lands, and a resolver record alone is not a binding; the operator's
three steps and every record of the apex; the six resolver ids as the
keccaks of their signatures; the walk by name, by child name (the registry
has no record, the client walks up, ENSIP-10), by address, and its two
refusals (wrong chain, no resolver); an unminted id; the neighbours and the
malformed names; nonsense never reverts; the counterfeit wrapper, the
counterfeit-held apex, the impostor account, another collection's account,
an account on another chain, a wallet, unwrapped registry control, registry
control *by the Reach itself*; any wrapped name held in the Reach (`alice.eth`),
and a name in the Grip (sealed); custody moved out through the Reach's own
`execute` and back; a sale (the seller can no longer move the name, the
buyer can); the clock — a 30-day name lapsing while the apex lives, the
apex at expiry − 1 s, at expiry, in grace, renewed inside grace, one second
past grace (the wrapper says nobody, the registrar refuses renewal, a
stranger re-registers and gets a name that answers nothing until it sits
in a token's account again); the custody report; the tool's arithmetic,
ERC-6821/ERC-3770 decoding, contenthash vectors; the ABI (every function a
view or pure; no bind/claim/set/admin/owner/transfer/station/renew name; no
fallback; six constructor arguments), the byte count, the Sepolia table,
the source scans.

Measured on the run quoted above: `resolve(3584.intact.eth, addr)` reads for 23,835 gas,
`resolve(3584.intact.eth, text contentcontract)` for 30,436, the legacy
`addr(intact.eth)` for 13,921 (the registry, the wrapper, the holding
account's `token()`, two hub derivations, the registrar and `ownerOf`,
each a call); `Premises.request(["token","3073","live"])` through the walk
returned 39,044 bytes of `text/html`, equal to `Renderer.document(3073)`.

## 4. Mutation evidence (non-vacuity)

Each mutant is one token of `src/Nameplate.sol` in a copy of the tree
(`tar` copy, `node_modules` linked, a cold compile each), the verifier run
unchanged. The sentence named is the first one that failed; the count is
the run's summary.

| Mutant | One-token change in `src/Nameplate.sol` | Run | First sentence that died (then the rest) |
|---|---|---|---|
| M1 band high bound | `id > BAND_HI` → `id >= BAND_HI` (`_resolveName`) | 222 passed, 6 failed | *"every id from 3073 to 3584 answers its own Reach through <id>.intact.eth: 512 of 512"*; then the four `3584.intact.eth` sentences and *"and so does the wildcard"* (3584 at expiry − 1 s) |
| M5 band low bound | `id < BAND_LO` → `id <= BAND_LO` (`_resolveName`) | 217 passed, 7 failed | *"3073.intact.eth answers token 3073's Reach"* (the walk block died one sentence earlier, since `web3://3073.intact.eth/…` no longer resolves); then the 512-of-512 sentence and every later `3073.intact.eth` sentence |
| M2 expiry comparison | `expiry(labelhash) > block.timestamp` → `>=` (`live`) | 223 passed, 5 failed | *"at the very second of expiry the name answers nothing"*; then *"text(intact.eth, contentcontract) is empty"*, *"3073.intact.eth answers nothing"*, *"live(APEX_LABEL) is false"*, *"tokenOf(node) is 0: custody and the clock, both"* |
| M3 wrapper check | `if (wrapper != WRAPPER) return (0, false);` → `if (wrapper == address(0)) …` (`heldBy` then asks whoever the registry names — the donor's original hole) | 223 passed, 5 failed | *"a contract claiming to be the NameWrapper cannot bind: heldBy(counterfeit.eth) is 0"*; then *"addr(counterfeit.eth) is the zero address"*, *"the legacy addr(node) is too, even though the counterfeit answers names(node) faithfully"*, *"a Nameplate for counterfeit.eth: heldBy(apex) is 0"*, *"and 3073.counterfeit.eth answers nothing: the wildcard follows the apex"* |
| M4 prefix string | `return "eth";` → `return "etc";` (`_shortName`) | 211 passed, 5 failed | *"text(intact.eth, contentcontract) is eth:0x<premises> — ERC-6821 with the ERC-3770 prefix"*; then the walk block as one sentence (*"the walk through ENS reached the site without throwing"*: the tool refuses a chain short name it does not know, so the block's twelve later sentences never ran, which is why the total is lower), *"3584.intact.eth's contentcontract is the site"*, *"text(alice.eth, contentcontract) is the site"*, the custody report's *"contentcontract"* |

Method: each mutant is a `tar` copy of the worktree (`node_modules` linked),
compiled cold and run with the committed verifier (the clones' verifier
copies were refreshed to the final one and re-run on their warm caches, so
every count above is that verifier's); the unmutated tree reads 228
passed, 0 failed on it. The gate M3 attacks is defence in depth (§11), and
the mutation shows the sentence is not vacuous for the shape that matters.
Not mutated: `_exists` (an unminted id's sentence would catch it) and the
apex-held requirement of the wildcard (*"3073.intact.eth answers nothing
either: the wildcard follows the apex"* and the custody-moved section
would).

## 5. The row proposed for docs/INVARIANTS.md and DESIGN.md §14

A new row in section F (the site), since the name is how the site is
reached by a person. Status `pending U18` until the integrator adds
`verify:plate` to `tools/check.mjs` (§8) and has seen the mutations above;
then `live`.

INVARIANTS.md:

> | F8 | Nameplate (band 0): custody is the binding — `intact.eth` and every `<id>.intact.eth` of the band answer only while the registry names the canonical NameWrapper as the apex's owner, the wrapper names a canonical account of this hub, and the .eth registrar's clock is live; a counterfeit wrapper, an impostor account, a wallet, registry control and a lapsed registration each answer nothing; `contentcontract` is `eth:0x<Premises>` and opens the site; no setter, no admin, no stored binding | `tools/verify-plate.mjs` · *"the walk's bytes equal Premises.request(["token","3073","live"])'s body byte for byte"*, *"every id from 3073 to 3584 answers its own Reach through <id>.intact.eth: 512 of 512"*, *"3072.intact.eth answers nothing: one below the band"*, *"3585.intact.eth answers nothing: one above the band"*, *"a contract claiming to be the NameWrapper cannot bind: heldBy(counterfeit.eth) is 0"*, *"a contract claiming through token() to be 3073's account is disbelieved: heldBy is 0"*, *"not even registry control by the Reach itself: a registrant can reclaim that at any time"*, *"heldBy(intact.eth) is 0 in the same block"*, *"at the very second of expiry the name answers nothing"*, *"text(intact.eth, contentcontract) is eth:0x<premises> — ERC-6821 with the ERC-3770 prefix"*, *"every function on the ABI is a view or pure: no setter, no admin, no stored binding"* | pending U18 (verify-plate 228 passed, 0 failed on wave4/u18 at the commit that lands it; mutations M1–M5 each killed by the sentences named in docs/wave4/u18-report.md §4; not yet a `check.mjs` step, so not live until the integrator adds it) |

DESIGN.md §14 (the same id, the short form):

> | F8 | Nameplate: custody is the binding; counterfeit wrapper, impostor account, wallet, registry control and lapsed registration answer nothing; `contentcontract` opens the site; no setter | `tools/verify-plate.mjs` · "the walk's bytes equal Premises.request(["token","3073","live"])'s body byte for byte", "a contract claiming to be the NameWrapper cannot bind: heldBy(counterfeit.eth) is 0", "every id from 3073 to 3584 answers its own Reach through <id>.intact.eth: 512 of 512", "at the very second of expiry the name answers nothing" |

(Every quoted sentence exists verbatim in `tools/verify-plate.mjs` under
`tools/invariants-check.mjs`'s rule — `\"` unescaped, whitespace collapsed.)

## 6. The deployment steps for band 0 (docs/DEPLOYMENT.md, tools/deploy.mjs)

The ENS singletons, for the record and for `deploy.mjs`'s table (they are
contract addresses, not endpoints; `tools/ens-name.mjs` exports them):
registry `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` (every chain);
BaseRegistrar `0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85` (mainnet and
Sepolia); NameWrapper `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401` on
mainnet, `0x0635513f179D50A207757E05759CbD106d7dFcE8` on Sepolia (I PR #26);
`node = namehash("intact.eth")`, `labelhash = keccak("intact")`.

In order, after the MVB and before the Timelock's admin is handed on:

1. **Own `intact.eth`, wrapped.** A registration made through the current
   ETHRegistrarController is wrapped at registration (the controller calls
   `NameWrapper.registerAndWrapETH2LD`), the registrant being the wrapped
   owner. A name held unwrapped: `BaseRegistrar.approve(NameWrapper, uint256(labelhash))`
   then `NameWrapper.wrapETH2LD("intact", registrant, 0, address(0))`.
   Check: `registry.owner(node) == NameWrapper`, `NameWrapper.ownerOf(uint256(node)) == registrant`.
   The registrant is a durable key, not the burner.
2. **Deploy the Nameplate** through the Timelock's queue at its CREATE3 salt
   `keccak("intact.v1.nameplate")`: `Timelock.queue(factory, 0, deploy(salt, creationCode ‖ abi.encode(hub, premises, registry, wrapper, registrar, "intact")))`,
   seven days, `Timelock.execute` by anyone. The constructor refuses a
   codeless pin (`NothingThere`), a registrar the registry does not name at
   `namehash("eth")` (`WrongRegistrar`), and a label with a dot or of the
   wrong length (`BadLabel`); it reads `BAND_LO`/`BAND_HI` from the hub.
   Record `nameplate` in `deployments/1.json`; `recover-record` checks
   `HUB`, `PREMISES`, `ENS`, `WRAPPER`, `REGISTRAR`, `APEX`, `APEX_LABEL`,
   `BAND_LO`, `BAND_HI` against the record and the ENS table.
3. **Mint the home token** — id 3073, the first of the band — to the
   operator; `reach = hub.account(3073)`.
4. **Point the name at the resolver:** `NameWrapper.setResolver(node, nameplate)`
   by the wrapped owner (the wrapper forwards `registry.setResolver`).
   Optional and one-way: `NameWrapper.setFuses(node, CANNOT_UNWRAP | CANNOT_SET_RESOLVER)`
   (`1 | 8`) so the resolver can never be repointed and the name never
   unwrapped — the "one-way by construction" shape DESIGN §12 prefers; the
   verifier does not burn fuses, so this is the operator's decision.
5. **Custody:** `NameWrapper.safeTransferFrom(registrant, reach, uint256(node), 1, "")`
   — into the Reach (the holder can send it back out through
   `Reach.execute`), or into `hub.grip(3073)` for permanence. From this
   block the resolver answers; before it, nothing does (a sentence proves
   both).
6. **Verify, reads only:** `RPC_URL=… node tools/ens-name.mjs --custody intact.eth --nameplate <addr>`
   prints every read and `bound`; `RPC_URL=… node tools/ens-name.mjs web3://intact.eth/token/3073/live`
   prints the walk and the 200. On chain: `nameplate.heldBy(node) == (3073, false)`,
   `nameplate.tokenForName(dns("3073.intact.eth")) == 3073`,
   `nameplate.text(node, "contentcontract") == "eth:0x<premises>"`.
7. **Renewal is anyone's:** `ETHRegistrarController.renew("intact", duration)`
   is permissionless and payable; the wrapper's expiry follows the
   registrar's. The date is `nameplate.expiry(keccak("intact"))`; from that
   second the resolver answers nothing, the wrapper still names the Reach
   for ninety days, and past those the name must be registered anew (the
   verifier walks that path too).

For `tools/deploy.mjs`'s post-MVB list: `nameplate` after `roles`, **band 0
only** — refuse the step on a chain with no entry in `tools/ens-name.mjs`'s
`NAME_WRAPPER` table (the constructor would also refuse a codeless registry,
but the script should say why first). Constructor arguments
`[hub, premises, ENS_REGISTRY, NAME_WRAPPER[chainId], ETH_REGISTRAR, "intact"]`.
No hub or Catalog pin exists for it, so no placeholder address is needed
(unlike market/roles/agentCard); steps 1, 3–5 are the operator's wallet's,
not the burner's, and belong in DEPLOYMENT.md's "after the record" section.

## 7. The constructor shape (for DESIGN §3's list and the deploy script)

```
Nameplate(address hub, address premises, address ens, address wrapper, address registrar, string label)
  immutables: HUB, PREMISES, ENS, WRAPPER, REGISTRAR,
              APEX_LABEL = keccak256(label), APEX = keccak256(namehash("eth") ‖ APEX_LABEL),
              BAND_LO = hub.BAND_LO(), BAND_HI = hub.BAND_HI()
  refuses:    NothingThere (any pin codeless), WrongRegistrar (ens.owner(namehash("eth")) != registrar),
              BadLabel (empty, > 63 bytes, or containing a dot)
```

Public surface, all `view`/`pure`: `heldBy(bytes32) → (uint256 id, bool inGrip)`,
`expiry(bytes32 labelhash)`, `live(bytes32 labelhash)`, `tokenOf(bytes32)`,
`tokenForName(bytes)`, `nodeOf(bytes)`, `contentcontract()`, `addr(bytes32)`,
`addr(bytes32,uint256)`, `text(bytes32,string)`, `contenthash(bytes32)`,
`resolve(bytes,bytes)`, `supportsInterface(bytes4)`, and the immutables.

## 8. Requests to other units' files

- **`package.json`** (U0's): `"verify:plate": "node tools/verify-plate.mjs"`.
- **`tools/check.mjs`** (U12's): a step after `verify:premises`:
  `{ name: "verify:plate", file: "tools/verify-plate.mjs", args: [], shape: "passedFailed", what: "the ENS resolver: custody is the binding, the wildcard, the clock" }`.
  Cost: the same compile as `verify:premises` (`src` + `test/mocks`, cache
  shared), then ≈ 50 s of which ≈ 20 s is minting the band out.
- **`docs/INVARIANTS.md`, `DESIGN.md` §14**: the F8 row of §5.
- **`docs/DEPLOYMENT.md`, `tools/deploy.mjs`**: §6.
- **`docs/CHECKPOINT.md`**: a U18 row with the counts of §3 and §4.
- **`src/Catalog.sol`** (U7's) — see §9. **`docs/CONSOLE.md` §6.2 and
  `engine/panels/identity.js`** (U9's) — see §10.
- **`research/`**: nothing.

## 9. Catalog `SERVICES` rows (request)

The Catalog carries no Nameplate pin today (`BIT 2048` is "kept for it";
`CatalogRows` has sixteen letters). The request, for the Catalog's owner,
is a post-MVB placeholder pin like `market`/`roles`/`agentCard` — predicted
by salt, codeless on bands other than 0 — so the state block carries
`nameplate: <addr>` and the chip rule applies (`reported` bit 2048 set when
`nameplate.APEX()` answers behind `extcodesize` + staticcall; `absent` on a
band without one), and four rows under a new letter, in the table's own
grammar (`name|letter|signature|kind|via|notes;`):

```
nameHeldBy|<letter>|heldBy(bytes32)|r|d|the token holding a wrapped ENS name, and whether it sits in the Grip;
nameFor|<letter>|tokenForName(bytes)|r|d|the token a DNS-wire name means: held, or <id>.intact.eth while the apex is held and live;
nameExpiry|<letter>|expiry(bytes32)|r|d|when the .eth registration under a label hash lapses, by the registrar;
contentcontract|<letter>|contentcontract()|r|d|the site as eth:0x..., ERC-6821 in ERC-3770 form;
```

`tools/verify.mjs`'s drift gate holds every row to the ABI, so the rows
cost nothing to keep honest. Until the pin exists, the identity lane has
no address to read and §10 waits.

## 10. `#identity-ens` (CONSOLE §6.2, "on a band with a Nameplate") — request

What the identity lane should read and print once `state.nameplate` exists
(§9); the element does not exist on a band without one (today's rule,
unchanged):

| Element | Reads | Prints |
|---|---|---|
| `#identity-ens` | `state.nameplate`, `absent`/`reported` bit 2048 | the row; *nameplate: not deployed on this chain* never appears (the row is absent instead); *could not be read at block N* when the bit is clear and the contract has code |
| `#identity-ens-name` | `nameplate.tokenForName(dnsEncode("<id>.intact.eth"))` — DNS wire bytes are length-prefixed labels, string arithmetic the panel can do without a keccak (the donor's reason for taking wire names) | *`<id>.intact.eth` · resolves to this token's Reach* when the answer is `<id>`; *`<id>.intact.eth` · not bound: the apex is not held by a token* when 0 |
| `#identity-ens-apex` | `nameplate.heldBy(nameplate.APEX())` | *intact.eth is held by token N's Reach* / *… Grip (sealed)* / *intact.eth is held by no token* |
| `#identity-ens-expiry` | `nameplate.expiry(nameplate.APEX_LABEL())` against the chain's clock (`eth_getBlockByNumber`, never `Date.now()`) | *registration lapses <date>* / *lapsed <date>: renew it* |
| `#identity-ens-held .name` (optional) | the wrapper's `TransferSingle` log to `state.reach`/`state.grip`, each confirmed live with `heldBy` — the session-grant log-walk pattern | one row per name held; *names: not counted* when the endpoint refuses the range, never 0 |

No control: the lane proposes nothing signable here (moving a name is the
Vault's `execute` composer, with `safeTransferFrom(reach, to, node, 1, "")`
as the data; the ENS manager app does the registration and the resolver
record).

## 11. Observations

- **The registry gate is defence in depth, and the mutation proves the
  shape that matters.** With the canonical wrapper pinned and the only
  contract ever asked, a counterfeit in the registry already fails at
  `WRAPPER.ownerOf` (the real wrapper never wrapped that node). The gate
  `registry.owner(node) == WRAPPER` is what makes "ask whoever the registry
  names" impossible — the donor's original hole (dossier B3 class, fixed at
  I `b43645e`). `heldBy` is written so the registry's owner *is* the
  contract asked once it passes the gate, which is why the one-token
  mutation M3 (`!= WRAPPER` → `== address(0)`) reproduces that hole exactly
  and the counterfeit sentence dies on it.
- **The clock has two edges, and the resolver uses the registrar's.** The
  real NameWrapper clears a lapsed owner with `expiry < block.timestamp`
  where its expiry is the registrar's plus ninety days; so at the second
  of expiry the wrapper still names the holder and the resolver already
  answers nothing (M2's boundary sentence), at expiry + grace the wrapper
  still names the holder, one second later it names nobody — and the
  registrar refuses renewal (`expiries + GRACE_PERIOD >= now` fails), so a
  lapsed name is re-registered, not renewed. The verifier walks all of it,
  including the stranger who takes the name and finds it answers nothing
  until it sits in a token's account.
- **Wildcard ids are reachable only through ENSIP-10**, which is how every
  modern client reaches them (ethers walks up and checks
  `supportsInterface(0x9061b923)`; viem's UniversalResolver does the same
  walk); the legacy `addr(bytes32)` on a wildcard node is zero and the
  registry has no record to send a legacy client here anyway. A legacy
  `addr(node)` on the apex and on any held name works, with the clock
  (through the wrapper's `names(node)`).
- **`addr` is the Reach**, as in the donor: the account that acts and can
  send the name back out. The Grip is offered for permanence (a sentence
  shows a name there reads sealed and still answers the Reach).
- **The band is read, not asserted.** The constructor takes `BAND_LO/HI`
  from the hub it is given and does not check `BAND() == 0`; it cannot be
  deployed on a chain without ENS (a codeless registry is refused), and
  the deploy script's table is the guard against a chain that has one but
  is not band 0. `_shortName` knows chain 1 and Sepolia; elsewhere the
  record is the bare address, which ERC-6821 reads as "this chain".
- **Normalisation.** `tools/ens-name.mjs` hashes lower-case ASCII only and
  refuses anything else rather than hashing an un-normalised name; an
  operator with a non-ASCII name normalises with an ENSIP-15 library first.
- **Limits stated.** A wire name with a label over 63 bytes or more than
  16 labels is answered as a name nobody holds (DNS allows 127 labels; no
  ENS name in use is that deep); a hostile name cannot deepen the
  recursion. `resolve` answers empty bytes for an inner call it does not
  serve (including ENSIP-9 coin types other than 60) rather than reverting.
- **The fixture plays the controller.** `registerAndWrapETH2LD` and `renew`
  are controller-only in the mock as in the real wrapper; on mainnet the
  public ETHRegistrarController's `renew(name, duration)` is anyone's and
  payable, which is the permissionless renewal the Grip argument needs.
- **No forge suite was added.** The verifier's fixture is the real site
  through `deploySite` with band 0's bounds, the real Reach and Grip
  receiving the wrapper token through their own `onERC1155Received`, and the
  real hub's `BandExhausted` at 3585; a `.t.sol` would have mocked what the
  verifier exercises for real.
- **Cost of a query** (from the run in §3): a wildcard `resolve` reads the
  registry, the wrapper, the holding account's `token()`, two hub
  derivations, the registrar and `ownerOf` — the numbers are printed by the
  verifier and quoted in §3.
