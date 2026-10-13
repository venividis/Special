# Agents

How a program — an AI agent, a bot, a script — uses an INTACT token today,
what it may rely on, what arrives after the MVB, and what it must never do.
From `DESIGN.md` §10 and `docs/CONSOLE.md` §11; written by U12.

**The one sentence.** An agent is a holder-authorised session key on the
token's Reach and nothing more. Holding or receiving a token grants a
program nothing; a holder's `grantSession` grants it exactly what the grant
says, until the token changes hands.

## 1. Discovering the token: `services.json`

Every deployment serves its catalogue from chain, with no indexer and no
server: over `web3://<premises>:<chainId>/services.json` (ERC-5219 /
ERC-6860) or by `eth_call Catalog.services()` on the band's Catalog
(addresses are in `deployments/<chainId>.json`; no document names an RPC
endpoint — the agent brings its own). It is a pure function of the
deployment: no block, no price, no count.

```json
{ "name": "swapExactIn", "on": "pool", "contract": "0x…", "sig": "swapExactIn(uint256,bool,uint256,uint256,address,uint64)",
  "selector": "0x…", "kind": "payable", "via": "direct", "args": ["uint256", "bool", "uint256", "uint256", "address", "uint64"],
  "notes": "…" }
```

One object per call the protocol serves (159 rows on this tree): `kind` is
`read`, `write` or `payable`; `via` is `direct` (anyone may call), `reach`
(the call must come from the token's Reach — through a session) or `acts`
(the holder or the Reach). Beside the rows: the `errors` table (every custom
error's whole signature by selector, so a revert can be decoded into words),
the event `topics`, the band table, the routes and the venue manifest.
`/token/<id>/services.json` (`Catalog.servicesOf(id)`) adds the token's own
addresses — its Reach, its Grip, its market key, its home room — and the
walk rule for the archive.

The same tables are baked into every token's document as
`window.INTACT.sel` (`"<word>.<name>" → selector`, e.g. `"pool.quote"`) and
`window.INTACT.err` (`"0x…" → "Slippage(uint256,uint256)"`), computed on
chain by the Catalog, never typed by hand.

**The catalogue is hash-pinned.** `Catalog.catalogHash()` is
`keccak256(services())`; it appears in `contractURI()`, in the state block
and in `/manifest`. An agent pins the hash it reviewed and refuses a
catalogue that answers with another: a changed selector table is a changed
protocol, not an update. (CVE-2025-54136's class: a tool description that
changes after approval.) The MCP bridge in `sdk/` that does this for you is
post-MVB (U17, INVARIANTS G2); today the agent does it itself.

## 2. Authority: session keys and nothing else

The holder grants, in the console's Vault lane or by calling the Reach:

```
grantSession(key, expires ≤ now + 365 d, nativeCap, caps[] (asset, cap), targets[], selectors[], minInterval, uses)
grantRecipe(key, expires, target, dataHash, exactValue, uses 1..1024, minInterval)
```

An allowlist session may call the listed `targets` with the listed
`selectors` (checked independently: one key per intended pair is the
holder's way to say exactly what it means), spend at most `nativeCap` ether
in all and at most `cap` of each listed ERC-20 **measured by balance
delta** — whatever left, by whatever word, is charged — at most `uses`
times, at most once per `minInterval`. An approval-shaped call must name a
spender that is itself on the target list (`SpenderNotAllowed`). A recipe
is one exact calldata to one target whose codehash is pinned at grant.

The agent then:

1. **Reads before it sends.** `Reach.sessionAllows(key, to, selector)` says
   whether a call would be admitted (false when the token is not `Active`,
   the key is expired, revoked or stamped with an old epoch, the target or
   selector is not listed, or the selector is a grant / seal / revoke word);
   `Reach.sessionOf(key)` and `sessionExposure(key)` give the terms and the
   worst case left. `hub.rightsOf(id, key)` carries the `SESSION` bit
   (128) as a hint — the Reach is the enforcer, the bit is not authority.
2. **Acts only through the Reach.** `executeAsSession(to, value, data)` for
   a listed call; `executeTyped(TypedCall{to, value, data, spend[],
   receiveMin[], deadline})` for "swap exactly this for at least that":
   exact approvals made only when the standing allowance is zero and reset
   to zero after, `spend` balances may fall by at most the amount,
   `receiveMin` balances must rise by at least the floor, taxed and
   rebasing tokens revert by construction. The Router (`swap(SwapRequest)`)
   accepts only a canonical Reach as `msg.sender`, so every external swap
   is a Reach call with a floor.
3. **Speaks, trades and launches as the token** by having the holder list
   `Parley.speak`, `Pool.swapExactIn`, `Launchpad.create`… on the session:
   the call arrives from the Reach, `mayActAs` / `acts` admit it, and the
   Reach's audit log records who spoke. A token's first launch needs the
   holder or the guardian's one-time `approveFirstLaunch` (stamped with the
   epoch); every launch inherits the seven-day spacing.

Refusals the agent will meet, by name: `NoSession`, `SessionExpired`,
`SoldOn(granted, now)` (the token changed hands — every key died, and a
buy-back by the old holder does not revive it), `NotActive` (a sale pauses
the token; the new holder re-arms it), `TargetNotAllowed`,
`SelectorNotAllowed`, `SpenderNotAllowed`, `SpendCapExceeded`,
`AssetCapExceeded`, `Overspend`, `Shortfall`, `TooSoon`, `NoUsesLeft`,
`NoPrivilegeEscalation` (the Reach itself, or a grant / seal / revoke
word), `RecipeMismatch`; and, when the Reach is sealed, `Shrank`,
`WentBlind`, `PieceLeft`, `NotSafeWhileSealed`, `BlindTarget`,
`ValueWhileSealed` — the seal measures the account after every call and a
session is never more trusted than the holder who granted it. A session key
never signs: `isValidSignature` answers `0xffffffff` to anything that is
not the holder's own attestation.

## 3. The door: `/k/<id>/<key>`

`web3://<premises>:<chainId>/k/<id>/<key>` 301s to
`/token/<id>/live?as=<key>`: the same document, booted in **session mode**
(CONSOLE §11). Home prints "this page acts as key 0x… for #<id>", the
grant's terms in words (`sessionOf`, `sessionExposure`), and whether
`rightsOf(id, key)` carries `SESSION`; `body.dataset.rights` is masked to
that one bit; every holder control is hidden and `propose` refuses; a
connected wallet whose account is not the key is refused with the sentence
naming both. The agent lane offers, before U17, one read: whether the grant
allows a target and a selector (`sessionAllows`). The `executeAsSession`
composer in the page arrives with U17.

## 4. Invariants an agent may rely on (tested forever)

- **Receiving a token grants nothing** (the Bankrbot class): transferring
  any NFT or any ether to a Reach or a Grip changes no bit of `rightsOf`
  and no session; no `onERC*Received` grants anything (INVARIANTS G1,
  `test/Rights.t.sol`; `tools/verify-findings.mjs` sends a stranger's NFT
  and ether in and reads the rights after).
- **A sale ends every key.** The custody epoch moves on every custody
  change; a key granted under epoch e is `SoldOn` at e + 1 forever
  (INVARIANTS A1, B5; `tools/agents.mjs` sells and buys back the token
  under a live key every twenty ticks).
- **The Grip cannot be spent from by anybody**, so income routed there
  (`setFeesToGrip`) is permanently held (INVARIANTS B1).
- **No reputation-shaped data exists in v1**: the only unforgeable records
  are Postage reply receipts and sealed-market `collect` history. Nothing
  here can be farmed by self-hire, because nothing here is a hire.
- **Prices move only by the holder's hand** (`syncCurve(id, bps, expected)`),
  never by a renter, an operator or a session key without the holder's
  explicit listing; a quote is a view and every swap carries the agent's own
  floor.

## 5. After the MVB

- **AgentCard** (U17): face 2 of `tokenURI` becomes an ERC-8004
  `registration-v1` document (`agentId == tokenId`, `agentWallet =
  account(id)`, the token's `web3://` routes and its door as `services[]`,
  `supportedTrust = ["custody-epoch", "erc-5646"]`, `x402Support: false`),
  pinned by `AgentCard.manifestHash(id)`; `/.well-known/agent-registration.json`,
  `/.well-known/agent-card.json` (A2A) and `/llms.txt` served by Premises.
  Mirror-registration in the ERC-8004 singleton is a holder action and
  never a correctness dependency.
- **The MCP bridge** (`sdk/mcp.mjs`, U17): tools generated from
  `services.json`, refusing a catalogue whose hash drifted (INVARIANTS G2:
  *"a catalog whose hash drifted is refused"*); `propose` and `act` as
  separate tools; `sessionAllows` before any send.
- **Roles** (U16): ERC-7432 roles that lock the token instead of escrowing
  it, revocable only, epoch-stamped.
- The **`executeAsSession` composer** in the agent lane, and the door's
  action list.

## 6. What an agent must never do

- Pass a wallet's private key, a session key or a signature through a
  bridge, a prompt or a log. The key signs transactions on the agent's own
  machine; the bridge sees calldata and receipts.
- Trust a catalogue whose `catalogHash` differs from the one it reviewed,
  or cache `services.json` across a hash change.
- Build an approval it cannot name the spender of, or an unlimited one. The
  console refuses 2^255 and above; a program should too. Prefer
  `executeTyped` with an exact `spend` and a `receiveMin`.
- Read `rightsOf`'s `SESSION` bit as authority. It is a hint for a page; the
  Reach decides, at the moment of the call.
- Call `grantSession`, `grantRecipe`, `revokeSession`, `revokeAllSessions`,
  `seal` or `sealMax` through a session. They are refused
  (`NoPrivilegeEscalation`), and asking is a sign the agent's model of its
  own authority is wrong.
- Act on a token after a sale without the new holder's grant: the old
  grant is dead, the token is `Paused`, and the new holder re-arms it after
  reading what its keys are about to be allowed to do.
- Use `Date.now()` for a deadline: every deadline is the chain's clock.
- Name an RPC endpoint in anything it publishes from this protocol; the
  protocol's documents never do.
