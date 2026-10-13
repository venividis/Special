# U17 — Agent surfaces: `AgentCard`, the agent lane, the MCP bridge

Branch `wave4/u17`, from the integrated head 40a678f. Every number below is
from a run on this worktree and names the tool that printed it.

## 1. What was built

| File | What it is |
|---|---|
| `src/AgentCard.sol` (new) | `IAgentCard` exactly as `src/interfaces/Site.sol` froze it: `registration(id)` — the ERC-8004 `registration-v1` document, face 2 of `tokenURI`, `registration(0)` the collection's own at `/.well-known/agent-registration.json`; `card(id)` — the A2A agent card (`card(0)` at `/.well-known/agent-card.json`); `llms(id)` and `llmsCollection()` — `llms.txt`; `manifestHash(id)` = keccak256 of `registration(id)`'s bytes. Immutables `HUB`, `CATALOG`, `PREMISES`; constructor `AgentCard(address hub, address catalog, address premises)`. Every read of the hub and the catalog is `extcodesize` AND a raw `staticcall`; an unminted id is a document whose `active` is false, never a revert; an absent catalog is `"catalogHash":null`, never a zero hash. Zero state, every function a view. |
| `engine/panels/agent.js` (replaces the stub) | the lane: the card read from the chain (`hub.tokenURIAt(id, 2)`, parsed, its facts and the keccak of the bytes served beside `manifestHash(id)` live), the routes as paths, the grant log walked over the Reach, one key's envelope, the `executeAsSession` composer with PROPOSE as a read (`sessionAllows`, then a dry `eth_call` of the same `executeAsSession` from the key) and ACT as the slab (`ui.propose`, need `SESSION`, `[data-spend]`, a `recheck` that reads `sessionAllows` again at the press), the doors probe (`sessionAllows` over every fixed-target write row), and session mode (the key's envelope, the doors, the composer as a read, the refusal when the connected wallet is not the key). |
| `tools/verify-site/agent.mjs` (new) + the word `"agent"` in `tools/verify-site.mjs` `GROUPS` | the lane's group through the shim, on a chain of its own deployed with the card (block H uses the runner's card-less chain). |
| `tools/site.mjs` (additive) | `deploySite(c, out, { deployAgentCard: true })` deploys `src/AgentCard.sol` as the last CREATE of the run (nonce 19, predicted like every other address) and pins it into the Catalog, the Renderer and the Premises before it exists; without the option the pin stays the codeless placeholder and nothing else changes. |
| `sdk/mcp.mjs`, `sdk/mcp.test.mjs` (new) | the MCP-shaped bridge (JSON-RPC 2.0 over stdio: `initialize`, `ping`, `tools/list`, `tools/call`, notifications unanswered), its tools derived from `/services.json` read from the chain and held against `Catalog.catalogHash()` on every listing and every call; `propose` and `act` as separate tools; the host supplies the RPC transport and a `{address, send(tx)}` signer; no key ever crosses. Node built-ins and the repo's `ethereum-cryptography` keccak only. |

## 2. Bytes and gas (measured)

| What | Measured | Budget |
|---|---|---|
| `AgentCard` runtime | **11,546 B** (`tools/compile.mjs` artefact, `bytecodeHash: "none"`) | ≤ 12,000 (DESIGN §3 row 13) |
| `engine/panels/agent.js` | **4,883 B gzip**, 12,006 B inflated (`tools/build-app.mjs`) | ≤ 8,192 |
| the shell | **14,955 B gzip**, unchanged (`engine/app.html` and `app.css` untouched) | ≤ 15,000 |
| cold, with the card deployed (`--group agent` A16) | `tokenURI(1)` **7.80 M** (7.64 M without the card: the Catalog's `stateOf` probes `manifestHash(id)` twice per `tokenURI`, once in `_face0` and once in `document → state`), `/token/1/live` 1.83 M (1.74 M), `/.well-known/agent-registration.json` 0.05 M, `/token/1/llms.txt` 0.09 M, `/token/1/face/2` 0.20 M | 8 M · 2.5 M · 1 M · 1 M · 0.5 M |

## 3. Runs

| Tool | Result |
|---|---|
| `node tools/verify-site.mjs --group agent` | **74 passed, 0 failed** — 68 sentences of the group's own (target ≥ 40) plus the runner's 6; 17–20 s on the loaded box |
| `node sdk/mcp.test.mjs` | **29 passed, 0 failed** |
| `node tools/verify-site.mjs` (every group) | **580 passed, 1 failed** — 513 at the integrated head + 68 of this group = 581; the one failure is `tools/verify-site/boot.mjs` line 621, the pre-U17 assertion that the stub sentence is present (its replacement is in §5); boot 131 · swap 84 · social 76 · launch 82 · vault 68 · identity 65 · agent 68 · the runner's 7, 7 m 40 s on a box carrying three other compiles |
| `node tools/verify.mjs` | 234 passed, 0 failed — the equality step and the catalog-against-ABI drift gate untouched (no `SERVICES` row was added here; the rows are requested in §6) |
| `node tools/verify-premises.mjs` | 63 passed, 0 failed (its three "before an AgentCard exists" 404 sentences still hold on its card-less chain) |
| `node tools/build-app.mjs` | the shell 14,955 B, the panel 4,883 B, no refusal |
| `node tools/compile.mjs` | all gated contracts fit under the EIP-170 ceiling of 24,576 bytes; AgentCard 11,546 B; the ship rule still picks the diamond (Intact 25,402 B) |
| `node tools/selftest.mjs` | 52 passed, 0 failed |
| `node tools/static-audit.mjs` (+ `--selftest`) | passed — 10 Solidity rules, 4 JS rules; the fixture fails on 5 |
| `node tools/invariants-check.mjs` | 89 passed, 0 failed (G2 still reads pending; see §7) |
| `INTACT_IMPL=monolith node tools/forge.mjs --match Premises` / `--match Bundle` | Premises **14 passed, 0 failed**; Bundle **7 passed, 0 failed** (the monolith build; the diamond build was not run for time — this unit touched no Solidity beyond the new contract, which neither suite deploys) |

The four BUILD-PLAN §U17 sentences, verbatim, each ending its block: *"face 2 parses as registration-v1 with agentId == tokenId"*, *"the door refuses a wallet that is not the key"*, *"the Bankrbot transfer changes no bit and no session"* (`tools/verify-site/agent.mjs`), *"a catalog whose hash drifted is refused"* and *"a Node agent drives swap and speak through executeAsSession using only services.json and an RPC"* (`sdk/mcp.test.mjs`). Beside them the lane's own: *"the stub sentence gone"*, *"a disallowed call never reaches the wallet"*, *"an allowed one builds exactly one executeAsSession with the epoch re-read"*.

## 4. Mutation evidence

- **The hash refusal.** In a copy of `sdk/` the one guard `if (served !== onChain) throw new Error(DRIFT …)` became `if (served !== onChain) void 0;`. `node sdk-mut/mcp.test.mjs`: **27 passed, 2 failed** — exactly *"a catalog whose hash drifted is refused"* and *"a chain whose catalogHash() names other bytes than it serves is refused too"*; everything else green. The copy was deleted after the run.
- **The door refusal.** `engine/panels/agent.js`'s `if (sess && acct && !same(acct, KEY))` became `same(acct, KEY)` in place, `--group agent` rerun: **71 passed, 3 failed** — D8 (the stranger's wallet no longer refused), D9 (the key's own wallet now refused) and the composite *"the door refuses a wallet that is not the key"*. The panel was restored from a kept copy and `diff -q` proved it byte-identical.

## 5. CONSOLE §6.2 — the `agent` row (for the integrator to copy)

| Lane | Elements |
|---|---|
| agent | `#agent-card-address` (the pinned AgentCard · *reported* / *not deployed on this chain* / *could not be read at block N*), `#agent-links .kv` (the agent routes as paths, never with a host: registration, card, llms, token llms, face 2, door), `#agent-face2` (*parses as registration-v1 · agentId N == #N*, or why not), `#agent-agentid` (*N in eip155:<chain>:<hub>*), `#agent-wallet` (*0x… — the Reach* / *— NOT the Reach*), `#agent-trust` (supportedTrust · x402Support · active · custody epoch), `#agent-hash-baked` (keccak of face 2's bytes as served), `#agent-hash-live` (`AgentCard.manifestHash(id)` read through the catalogue's `agentCard.manifestHash` row, *— equal to the bytes served* / *— moved since face 2 was served*; *not reported: the catalogue serves no agentCard row* until §6 lands), `#agent-services .svc` (one row per service: name → endpoint), `#agent-sessions .row` (`data-key`; *live* / *dead: revoked, expired or granted before the token last changed hands*), `#agent-session-count` (*sessions: n live of m ever granted* / *sessions: not counted — the grant log could not be walked on this endpoint (…)*), `#agent-key-facts` (one key's envelope: kind, expires, the grant epoch beside the token's, native cap and spent, uses left, interval, stored active, worst-case exposure, the token's status, the SESSION right), `#agent-refusal` (session mode: *this page acts as key 0x…; the connected wallet is 0x… — connect the key's wallet*), `#agent-composer` (inputs `name=key\|row\|target\|value\|data`; `#agent-args input[name=arg<i>]`, one per argument of the row's signature), `#agent-row-info`, `#agent-verdict` (*allowed by the grant · simulates: executeAsSession would land* / *allowed by the grant · would revert: <sentence>* / *not allowed by the grant: … — nothing is sent* / *not reported: …*), `#agent-calldata` (the `executeAsSession` bytes), `#agent-propose` (the read), `#agent-doors` (the probe), `#agent-allowed .row` (`data-row`, pressing one fills the composer) and its `p` (*n of m doors open for key …*), `[data-act=executeAsSession]` (need `SESSION`, `[data-spend]`; rendered only for a connected wallet whose `rightsOf` carries `SESSION`, in the console) |

Also for CONSOLE: §6.1 *"The agent stub's one id is `#agent-stub`"* — delete; §1's session row *"(no `executeAsSession` composer until U17)"* → *"(the composer is a read here; the act is the console's, for the key's own wallet)"*; §3's SESSION row *"nothing to press until U17"* → *"the agent lane's act, offered to the key's own wallet in the console"*; §11's *"The agent lane says 'no executeAsSession composer until U17'"* → *"The agent lane prints the key's envelope, the doors its grant opens and the composer as a read, and the refusal when the connected wallet is not the key; the shell never writes in session mode, so the act is offered in the console, where the key's wallet reads `SESSION`"*; §15's table gains the four sentences above with `tools/verify-site/agent.mjs`; §16's panel row: agent **4,883**.

**Two assertions in other units' files now fail by design and must be updated** (the stub sentence is gone, as BUILD-PLAN §U17 asks): `tools/verify-site/boot.mjs` line 621 — replace `/no executeAsSession composer until U17/.test(page.text("#lane-agent"))` with `/this page reads only: the act is offered in the console/.test(page.text("#lane-agent")) && page.$$("#lane-agent [data-act]").length === 0` and the name with *"the agent lane reads only in session mode and says where the act is"*; `tools/verify-console.mjs` line 814, the same regex (its `[data-act]`/`[data-go]`/`textarea` counts stay). Until then a full `verify-site.mjs` run shows exactly that one failure (§3).

## 6. Catalog `SERVICES` rows requested (`src/Catalog.sol`, U7's file)

A seventeenth letter, `A`, the AgentCard (`LETTERS = "HPRYTSKNLCOWXEGQA"`, `address[17] byLetter`, `word("A") → "agentCard"`), and five rows:

```
"registration|A|registration(uint256)|r|d|ERC-8004 registration-v1, face 2 - RFC 8785 canonical bytes, id 0 the collection;"
"card|A|card(uint256)|r|d|the A2A agent card, id 0 the collection;"
"llms|A|llms(uint256)|r|d|llms.txt for one token;"
"llmsCollection|A|llmsCollection()|r|d|/llms.txt and /llms.md;"
"manifestHash|A|manifestHash(uint256)|r|d|keccak256 of registration(id) - what a reader pins;"
```

With them: `tools/site.mjs`'s `byLetter` gains `agentCard` as its seventeenth entry (the prediction is known before the Catalog is deployed when `deployAgentCard` is on; the placeholder otherwise), `tools/deploy.mjs`'s `byLetter` gains `T.agentCard`, and `tools/verify.mjs`'s drift-gate `ON` map gains `agentCard: "AgentCard"`. Nothing in the panel changes: it declares `agentCard.manifestHash` only when `"agentCard.manifestHash" in INTACT.sel`, so B5 flips from the honest *not reported* to the live comparison the moment the row lands. The catalogue's hash changes with the rows, as it must.

## 7. INVARIANTS

**G2**, once `tools/check.mjs` carries the step (requested: `{ name: "mcp", file: "sdk/mcp.test.mjs", args: [], shape: "passedFailed", what: "the MCP bridge: tools from services.json, the drift refusal, propose then act" }`, after `verify:site`; without it the row cannot be called live by CLAUDE.md's rule):

> | G2 | Catalog hashes on chain; the bridge refuses a mismatch | `sdk/mcp.test.mjs` · *"a catalog whose hash drifted is refused"*, *"a chain whose catalogHash() names other bytes than it serves is refused too"*, *"a catalogue that is not the one the host reviewed (pinnedHash) is refused, naming both hashes"*; `tools/verify.mjs` · *"and it is the keccak of /services.json's bytes"* | live (U17: 29 passed, 0 failed; the refusal's `throw` replaced by `void 0` in a copy fails exactly the two drift sentences, 27 passed, 2 failed) |

New rows proposed (DESIGN §14 would carry the same lines):

> | G3 | The door refuses a wallet that is not the key; a session page never writes | `tools/verify-site.mjs --group agent` · *"the door refuses a wallet that is not the key"*; `--group boot` · *"a wallet that is not the key is refused"*, *"propose refuses in session mode even for the SESSION bit the key holds"* | live (U17: the lane's comparison flipped in place fails D8, D9 and the sentence, 71 passed, 3 failed) |
> | G4 | `sessionAllows` is read before any send; a disallowed call never reaches a wallet; the act is one `executeAsSession` with the epoch re-read | `tools/verify-site.mjs --group agent` · *"a disallowed call never reaches the wallet"*, *"an allowed one builds exactly one executeAsSession with the epoch re-read"*; `sdk/mcp.test.mjs` · *"a Node agent drives swap and speak through executeAsSession using only services.json and an RPC"*, *"a row the grant does not list: propose reads not allowed and skips the simulation; act is refused and sends nothing"* | live (U17) |

And G1 gains the lane's citation: `tools/verify-site.mjs --group agent` · *"the Bankrbot transfer changes no bit and no session"*.

## 8. docs/AGENT.md §5 edits proposed (U12's file)

- §1, last paragraph: *"The MCP bridge in `sdk/` that does this for you is post-MVB (U17, INVARIANTS G2); today the agent does it itself."* → *"`sdk/mcp.mjs` does this for you: every tool it lists is derived from `/services.json` read from the chain and refused whole when the bytes' keccak is not `Catalog.catalogHash()` — or not the hash you reviewed (`INTACT_PINNED_HASH`). `node sdk/mcp.test.mjs` proves it (INVARIANTS G2)."*
- §3, the last two sentences (*"The agent lane offers, before U17, one read… The `executeAsSession` composer in the page arrives with U17."*) → *"The agent lane prints the key's envelope (`sessionOf`, `sessionExposure`, `rightsOf`, the token's epoch and status), the doors the grant opens (`sessionAllows` over every write row of the catalogue), and the composer: PROPOSE is a read — `sessionAllows`, then a dry `eth_call` of the very `executeAsSession` — and nothing a grant refuses reaches a wallet. The shell never writes in session mode, so the ACT is offered in the console (`/token/<id>/live`) to the key's own wallet, whose `rightsOf` carries `SESSION` there: one `executeAsSession(to, value, data)` through the slab, `custodyEpoch` and `sessionAllows` re-read at the press."*
- §5, the first two bullets become present tense and move up into §1 (the card) and §2 (the bridge): *"**Face 2 of `tokenURI` is the ERC-8004 `registration-v1`** (`AgentCard.registration(id)`): `agentId == tokenId`, `agentWallet = account(id)`, `active` is the token's status, `custodyEpoch` and `catalogHash` are named, `services[]` are the token's `web3://` routes and its door as the RFC 6570 template `/k/<id>/{key}`, `supportedTrust = ["custody-epoch","erc-5646"]`, `x402Support: false`. The bytes are RFC 8785 canonical, so `canonicalize(JSON.parse(bytes)) === bytes`, and `manifestHash(id)` is their keccak — pin the hash, then parse. `/.well-known/agent-registration.json` (the collection's document), `/.well-known/agent-card.json` (A2A), `/llms.txt`, `/llms.md` and `/token/<id>/llms.txt` are served by Premises from the same contract."* and *"**The bridge**: `INTACT_RPC_URL`, `INTACT_CATALOG`, optional `INTACT_PINNED_HASH` and `INTACT_SIGNER` (a module exporting `{address, send(tx)}` — the key stays on your machine). Tools: `intact_catalogue`, `intact_clock` (every deadline comes from here), `intact_read`, `intact_propose`, `intact_act`, and `read_<word>_<name>` / `propose_<word>_<name>` / `act_<word>_<name>` per row. A tool argument named like a key is refused unread; an approval of 2^255 or more is never built."*; the fourth bullet (*"The `executeAsSession` composer in the agent lane, and the door's action list"*) is deleted; the Roles bullet stays.
- §6: add *"Trust a registration whose keccak is not `manifestHash(id)`; parse before hashing."*

## 9. Chromium journey sentences for `tools/verify-console.mjs` (U11's file) — a new `agent` group on a chain deployed with `deployAgentCard: true`

1. *"the agent lane shows the card read from the chain: face 2 parses as registration-v1 with agentId 1, and the keccak of the bytes served equals manifestHash(1)"*
2. *"the key's wallet in the console is offered exactly one act: propose reads sessionAllows and the simulation, the slab is executeAsSession to the Reach, and Sign lands the swap"*
3. *"a disallowed call never reaches the wallet"* (verbatim, so INVARIANTS G4 can cite both provers)
4. *"the /k/<id>/<key> door, followed by Chromium, prints the key's envelope and the doors its grant opens, and offers no write"*
5. *"the door refuses a wallet that is not the key"* (verbatim)
6. *"a stranger's NFT in the Reach and ether in the Grip change nothing the lane reads: rights 0, the same keys, no new session"*
7. the `session` group's line 814 regex, updated as §5 says.

## 10. `tools/deploy.mjs` — the constructor shape (U10's file)

`AgentCard(address hub, address catalog, address premises)`. All three are CREATE3 predictions known before the first step, so the card is one more salted key, deployed LAST: `SALTED` gains `"agentCard"` after `"premises"` (salt `intact.v1.agentCard`), `PLACEHOLDERS` loses it, `DEPLOY_ORDER` and `RECORD_KEYS` follow, the step is `await create3("agentCard", "src/AgentCard.sol", "AgentCard", encodeParams("address,address,address", [got.hub, got.catalog, got.premises]), [code("catalog"), code("premises")])` after Premises, and `PINS` gains `["agentCard", "HUB()", "hub"], ["agentCard", "CATALOG()", "catalog"], ["agentCard", "PREMISES()", "premises"]` beside the three `*.AGENTCARD()` rows it already carries; DESIGN §12's order text and `recover-record` follow. `tools/site.mjs` does exactly this in the harness under `deployAgentCard` (nonce 19, after the Launchpad).

## 11. Observations

- **The shell's rule decides where the act lives.** CONSOLE §1/§11: session mode never writes (`ui.act` renders nothing, `propose` refuses before the rights). So at the door the composer is a read and the act is the console's, offered to a wallet whose `rightsOf` carries `SESSION` — the key itself. DESIGN §10's *"offers only those actions"* is met as proposals at the door and as the slab in the console; letting the door send would cost shell bytes it does not have (45 B under its ceiling) and a rule change in CONSOLE §11.
- **The hashing rule chose `{key}` over `<key>`.** RFC 8785 escapes nothing but `"`, `\` and controls, so a `<` spelling of the door would not survive a canonical recomputation and a literal `<` would be an angle bracket in the bytes; the RFC 6570 template avoids both. `services.json` still spells `/token/<id>/live?as=<key>` (U7's file; consistent with `TPL_SERVICES`).
- **Nothing a holder types is in the registration.** The name trait is a face-0 attribute; keeping it out keeps the pinned bytes a function of the facts an agent must re-read anyway (status, epoch, catalogue) and keeps every string ASCII.
- **`active` is `exists && status == Active`**: an unminted id reads a zero status, which is Active's value, so existence is checked through `ownerOf`.
- **Gas**: `Catalog.stateOf` probes the card with `manifestHash(id)` (bit 4096), i.e. it builds the whole registration on every state block; `tokenURI` carries it twice (+0.16 M cold, 7.80 M of 8 M). A cheaper probe (`llmsCollection()`'s length, or a dedicated `probe()` view in a Site.sol addition) would give the shell its margin back — U7's call.
- **`tools/gas.mjs`** sweeps the routes on a card-less chain; it could take `deployAgentCard: true` and probe the four agent routes under their 1 M cap (my group's A16 does, cold).
- **The Parley commons cools down two blocks between words**, so the lane's second word in the same block pair reads *would revert: Cooldown(N)* from the simulation — the composer printing the error by name worked before the group did.
- **Not done**: the Chromium door journey (U11's file; sentences in §9), the Catalog rows (§6), the `check.mjs` step (§7), `boot.mjs`/`verify-console.mjs`'s stub assertion (§5) — each a request, none an edit.
