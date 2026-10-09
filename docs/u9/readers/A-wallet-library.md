<!-- Reader report from the U9 understand phase (2026-10-08): what the donors contain, measured against their git refs, and what INTACT keeps or drops. Working document; docs/CONSOLE.md and docs/u9/DECISIONS.md record what was decided from it. -->

# U9 reader report A — the donor wallet library

Surface read: `/home/user/Most-Advanced-NFT-Possible/engine/ipseity.html`, sections
"7 · THE CHAIN" and "8 · SIGNING, WITH THE BYTES SHOWN FIRST" (box opener at
line 1858, last code line 2394; the box opener of "9 · THE CONTRACT THIS PAGE
CAME OUT OF" is line 2395, its title line 2396). Also read:
`/home/user/Special/tools/selftest.mjs` (byte-identical to the donor's
`tools/selftest.mjs` — `diff` prints nothing), `/home/user/Special/src/lib/AccountBinding.sol`,
`/home/user/Special/src/Catalog.sol` (state templates, lines 855-884),
`/home/user/Special/src/Renderer.sol` (loader), `/home/user/Special/src/Premises.sol`
(the `/panel/<name>.js` route, lines 140-158 and `_panelIndex` at 414),
`/home/user/Special/src/Engine.sol` (`panel`/`panelHash`, lines 161-172),
`/home/user/Special/tools/build-app.mjs` (the refusal regexes), the U7 fixtures,
BUILD-PLAN.md U9 (lines 96-101), DESIGN.md §1, §2, §5 and docs/INTERFACE-CHANGES.md.

Every number below was measured in this container on 2026-10-08; commands are
quoted where a number is load-bearing. Nothing under `/home/user/Special` or
`/home/user/wt` was written.

---

## 0. One fact that changes the copy before anything else

**"Lines 1859–2396" is not a parseable unit.** Line 1858 is the box-comment
opener `/*═══…` of §7 and line 1859 is its title (`  7 · THE CHAIN`); line
2395 is the box opener of §9 and line 2396 its title. A copy of exactly
1859–2396 begins and ends inside a comment and terser refuses it
(`Unexpected character '·'` at col 4 — reproduced). The verbatim unit U9
should paste is **lines 1858–2394** (`/*═══` of §7 through `}` of `agrees`),
which parses, minifies and runs in `vm` on its own (given the stubs in §4).
1859–2396 is 24,449 B — the number DESIGN.md §5.5 and BUILD-PLAN.md U9 quote —
and 1858–2394 is 24,407 B. Same code, 42 bytes of comment delimiters moved.

---

## 1. Inventory of the range, grouped

Signatures are quoted from the file. Line numbers are of
`/home/user/Most-Advanced-NFT-Possible/engine/ipseity.html`.

### 1.1 keccak-256 (lines 1866–1914)

| Line | Declaration | Purpose |
|---|---|---|
| 1866 | `/*── keccak-256 (the Ethereum variant: 0x01 padding, not SHA-3's 0x06) ──*/` | **selftest's FROM marker** (`"/*── keccak-256"`); must survive byte-for-byte |
| 1867–1873 | `const K_RC = [ 0x0000000000000001n, … 0x8000000080008008n ]` | 24 round constants as BigInt |
| 1874 | `const K_ROT = [0,1,62,28,27, 36,44,6,55,20, 3,10,43,25,39, 41,45,15,21,8, 18,2,61,56,14];` | ρ offsets, index `x + 5*y` |
| 1875 | `const M64 = (1n << 64n) - 1n;` | 64-bit lane mask (this is the `64n` mask, not the forbidden `256n` one) |
| 1876 | `const rotl64 = (x, n) => n === 0n ? x : ((x << n) | (x >> (64n - n))) & M64;` | rotate-left on BigInt lanes; `n` is a BigInt |
| 1878–1891 | `function keccakF(A)` | the permutation, in place, on `A: BigInt[25]` |
| 1892–1914 | `function keccak256(bytes)` → `Uint8Array(32)` | sponge, rate 136, pad `P[len] \|= 0x01; P[last] \|= 0x80`; input is any `Uint8Array`/array of bytes |

### 1.2 hex / utf8 / hashing helpers (1916–1926)

| Line | Declaration | Purpose |
|---|---|---|
| 1916 | `const utf8 = s => new TextEncoder().encode(s);` | string → bytes |
| 1917 | `const toHex = u => "0x" + Array.from(u, b => b.toString(16).padStart(2, "0")).join("");` | bytes → `0x…` |
| 1918–1923 | `const fromHex = h => { … }` → `Uint8Array` | strips `0x`, left-pads an odd nibble count with `0` |
| 1924 | `const khex = s => toHex(keccak256(utf8(s)));` | keccak of a string |
| 1925 | `const kbytes = h => toHex(keccak256(fromHex(h)));` | keccak of hex bytes |
| 1926 | `const selector = sig => khex(sig).slice(0, 10);` | 4-byte selector as `0x` + 8 hex |

### 1.3 EIP-55 and address helpers (1928–1938)

| Line | Declaration | Purpose |
|---|---|---|
| 1929–1936 | `function checksum(addr)` → checksummed string | throws `Error("not an address: " + addr)` on anything but 40 hex |
| 1937 | `const isAddr = a => /^0x[0-9a-fA-F]{40}$/.test(String(a \|\| "").trim());` | predicate |
| 1938 | `const short = a => a ? a.slice(0, 6) + " … " + a.slice(-4) : "—";` | display truncation (U+2026 and U+2014 literal) |

### 1.4 ABI encode / decode (1940–2018)

| Line | Declaration | Purpose |
|---|---|---|
| 1941 | `const pad = h => String(h).replace(/^0x/, "").padStart(64, "0");` | right-aligned word |
| 1942 | `const padR = h => String(h).replace(/^0x/, "").padEnd(64, "0");` | left-aligned word (bytesN) |
| 1943 | `const isDyn = t => t === "bytes" \|\| t === "string" \|\| /\[\]$/.test(t);` | dynamic-type predicate |
| 1945–1959 | `function encWord(type, v)` → 64 hex | `address` (validated by `isAddr`), `bool` (accepts `true/"true"/1/"1"`), `/^u?int\d*$/` (BigInt; negatives via `(1n << 256n) + n` two's complement — line 1954), `bytes1..32` via `padR`; throws `"unsupported type: "` |
| 1960–1973 | `function encDyn(type, v)` → hex | `string`/`bytes` = length word + 32-byte-padded body; `T[]` = length word + `encWord(base, x)` per element (static base only; `v` may be an array or a comma-separated string) |
| 1974–1984 | `function encodeParams(types, values)` → hex (no `0x`) | head/tail layout with offsets `headLen + tail.length/2` |
| 1986–1994 | `function encodeCall(sig, args)` → `{ data, sig: canonical, types }` | parses `name(type,type)`, canonicalises whitespace, checks arity (`"N arguments expected, M given"`), prepends `selector(canonical)` |
| 1996 | `const word = (hex, i) => String(hex).replace(/^0x/, "").substr(i * 64, 64);` | i-th word |
| 1997 | `const decUint = (hex, i = 0) => BigInt("0x" + (word(hex, i) \|\| "0"));` | → BigInt |
| 1998 | `const decInt = (hex, i = 0) => { const v = decUint(hex, i); return v >= (1n << 255n) ? v - (1n << 256n) : v; };` | signed |
| 1999 | `const decAddr = (hex, i = 0) => checksum("0x" + word(hex, i).slice(24));` | → checksummed address |
| 2000 | `const decBool = (hex, i = 0) => decUint(hex, i) !== 0n;` | |
| 2001–2008 | `function decString(hex)` | offset + length + body, `TextDecoder` |
| 2010–2018 | `function decStringLoose(hex)` | accepts a raw `bytes32` name()/symbol() (64 hex, zero-stripped) or falls back to `decString`; `""` on failure |

### 1.5 units (2020–2040)

| Line | Declaration | Purpose |
|---|---|---|
| 2021–2031 | `function fmtUnits(v, dec = 18, prec = 6)` → string | BigInt-only decimal formatting; a non-zero value that would print as 0 prints `"<0.000001"` (`">-0.000001"` when negative) — "dust is still custody" |
| 2032–2038 | `function toUnits(s, dec = 18)` → BigInt | parses `^\d*\.?\d*$`; throws `"not a number: "` and `"too many decimal places"` |
| 2039 | `const hexQ = n => "0x" + BigInt(n).toString(16);` | quantity encoding for JSON-RPC |
| 2040 | `const gwei = v => (Number(BigInt(v)) / 1e9).toFixed(3);` | **floating point** on an amount; used only by the donor's gas-price display at 3020–3021, outside the range. See §3.9 |

### 1.6 CHAINS / NET (2042–2061)

```js
2043 const CHAINS = {
2044   1:      { n:"Ethereum",  s:"ETH",  ex:"https://etherscan.io",       rpc:"https://eth.llamarpc.com" },
2045   11155111:{n:"Sepolia",   s:"ETH",  ex:"https://sepolia.etherscan.io", rpc:"https://ethereum-sepolia-rpc.publicnode.com" }
2046 };
2047 const chainOf = id => CHAINS[Number(id)] || { n: "Chain " + id, s: "ETH", ex: "", rpc: "" };
2054 const NET = {
2055   providers: [],     // [{info, provider}]
2056   provider: null,
2057   account: null,
2058   chainId: Number(S.chainId) || 1,
2059   ro: false,         // read-only: no wallet, public RPC
2060   dead: false        // no transport at all
2061 };
```

`CHAINS` carries **two RPC URLs and two explorer URLs**. `NET` is the one
mutable transport record; `NET.chainId` starts from the state block, not from
the wallet.

### 1.7 EIP-6963 discovery (2063–2100)

| Line | Declaration | Purpose |
|---|---|---|
| 2077 | `const WALLETS = new Map();` | keyed by `info.rdns` (uuid is per-announcement and would duplicate) |
| 2078–2084 | `window.addEventListener("eip6963:announceProvider", e => { … WALLETS.set(d.info.rdns, d); NET.providers = Array.from(WALLETS.values()); paintRail(); });` | **top-level side effect at load**; listener stays on forever |
| 2086–2100 | `function discover()` → `NET.providers` | dispatches `new Event("eip6963:requestProvider")`; if nothing announced, wraps `window.ethereum` (or each of `window.ethereum.providers`) as `{ info: { uuid: "legacy-i", rdns: "legacy:i", name: isMetaMask ? "MetaMask" : isRabby ? "Rabby" : "Injected wallet" }, provider }` |

### 1.8 SANDBOXED detector (2102–2107)

```js
2104 const SANDBOXED = (() => {
2105   try { window.localStorage.getItem("ipse"); return false; }
2106   catch { return true; }
2107 })();
```
`true` inside an opaque origin (the `data:` viewer). Evaluated at load. The
key string `"ipse"` is cosmetic; the U7 placeholder already uses `"intact"`.

### 1.9 rpc / ethCall / readSig (2109–2137)

| Line | Declaration | Purpose |
|---|---|---|
| 2109 | `let rpcId = 0;` | JSON-RPC id counter for the fetch path |
| 2110–2130 | `async function rpc(method, params = [])` | `NET.provider.request({ method, params })` when a provider is chosen; otherwise **`fetch(S.rpc \|\| chainOf(NET.chainId).rpc, { method:"POST", mode:"cors", credentials:"omit", cache:"no-store", … })`** and throws `"no endpoint for chain "` when neither has a URL; unwraps `j.error` |
| 2131–2132 | `const ethCall = (to, data, from) => rpc("eth_call", [Object.assign({ to, data }, from ? { from } : {}), "latest"]);` | |
| 2134–2137 | `async function readSig(to, sig, args = [])` → raw hex | `encodeCall` then `ethCall` |

### 1.10 connect / requireChain (2139–2194)

`async function connect(pick)` → `NET.account` or `null`:
- `const list = NET.providers.length ? NET.providers : discover();`
- no providers → `NET.ro = true`, probes `rpc("eth_blockNumber")` over the public URL, `say(SANDBOXED ? "No wallet reaches inside a marketplace frame…" : "No wallet announced itself…")`; on failure `NET.dead = true`, `say("This frame allows no network at all…", "err")`; `paintRail(); return null;`
- `const chosen = pick != null ? list[pick] : list[0];` — **auto-selects the first announcer** when no index is passed (2155)
- `eth_requestAccounts` **unconditionally** (2157), then `eth_chainId` (2159) — i.e. the chain is read *after* the account prompt
- `NET.provider.on("accountsChanged", a => { NET.account = …checksum(a[0])…; paintRail(); refresh(); })` and `.on("chainChanged", c => { NET.chainId = Number(c); paintRail(); refresh(); })` (2161–2166)
- `say("Connected as <b>" + short(NET.account) + "</b> on " + chainOf(NET.chainId).n + ".", "ok");` — **HTML in the message** (2168)

`async function requireChain()` → `true` or throws (2172–2194):
- returns `true` when `Number(NET.chainId) === Number(S.chainId)`
- else `wallet_switchEthereumChain` with `[{ chainId: hexQ(S.chainId) }]`
- on `e.code === 4902 && want.rpc` → `wallet_addEthereumChain` with `rpcUrls: [want.rpc], blockExplorerUrls: want.ex ? [want.ex] : []` (2180–2190) — **the second place an RPC URL leaves the page**
- otherwise throws `"This token lives on " + want.n + ". Switch the wallet there and try again."`

### 1.11 The confirm slab: propose / fire / watch (2196–2320)

| Line | Declaration | Purpose |
|---|---|---|
| 2203 | `const REG_6551 = "0x000000006551c19487814612e58FE06813775758";` | equals `AccountBinding.REGISTRY` |
| 2209 | `const REACH_IMPL = String(S.reachImpl \|\| "0x0000000000000000000000000000000000000000");` | from the state block |
| 2210 | `const GRIP_IMPL = String(S.gripImpl \|\| "0x0000000000000000000000000000000000000000");` | from the state block |
| 2212–2218 | `function splitWords(data)` → `{ sel, out: string[] }` | selector + 64-hex words |
| 2220–2223 | `function esc(s)` | HTML entity escaper for `& < > " '` — **defined inside the range**, not an external dependency |
| 2225 | `let pending = null;` | the one proposed tx |
| 2226–2277 | `function propose(tx)` | `tx: { to, value, data, sig, args, types, plain, note, then }`. Renders rows per word with a human reading (`address` → `short(checksum(…))`, `u?int` → decimal, `bool`), then **`$("#cbox").innerHTML = '<h3>Confirm</h3>' + …`** (2239) with To / Value (`fmtUnits(tx.value) + " " + chainOf(S.chainId).s`) / Function / Selector / Gas (`id="cgas"`, "estimating…") / `<pre class="code">` rows / calldata / note / `<button class="b" id="cgo">Sign and send</button><button class="b g" id="cno">Cancel</button>`; `$("#confirm").classList.add("open")`; wires `#cno` → close, `#cgo` → `fire()`; async `eth_estimateGas` `{ from: NET.account, to, data, value }` → `#cgas`.textContent = `BigInt(g).toLocaleString() + " units"` and `pending.gas = hexQ((BigInt(g) * 125n) / 100n)`; on error `"would revert"`, `style.color = "var(--bad)"`, `title = e.message` |
| 2279–2302 | `async function fire()` | `await requireChain()`; `eth_sendTransaction` with `{ from, to, data, value?: hexQ, gas?: tx.gas }`; closes slab, `pending = null`, `shock()`, `say("Sent " + '<b><a href="' + ex + "/tx/" + hash + '" target="_blank" rel="noreferrer" …>…</a></b>' + " — waiting for it to land.", "ok")` (**HTML + explorer URL**, 2293–2295); `watch(hash, tx.then)`; on error restores the button and `say(/reject\|denied\|4001/i.test(m) ? "You declined the signature." : "Refused: " + esc(m.slice(0, 160)), "err")` |
| 2304–2320 | `async function watch(hash, then)` | 90 polls × 2 s of `eth_getTransactionReceipt`; `status === 1n` → `say("Landed in block <b>" + … + "</b>. The token has changed.", "ok")`, `shock()`, `await then(r)` (errors swallowed), `await refresh()`; else `say("Reverted on chain.", "err")`; after three minutes `say("Still not mined after three minutes. It may yet land.")` |

### 1.12 EIP-712 (2322–2360)

| Line | Declaration | Purpose |
|---|---|---|
| 2323–2332 | `function typeHash(primary, types)` → `0x…` | collects referenced struct types, primary first then sorted, `khex` of the encoded type string |
| 2334–2347 | `function encodeData(primary, data, types)` → hex | `string` → `pad(khex(v))`, `bytes` → `pad(kbytes(v))`, struct → `pad(kbytes("0x" + encodeData(…)))`, array → `pad(kbytes("0x" + v.map(encWord(base)).join("")))`, else `encWord` |
| 2349 | `const hashStruct = (primary, data, types) => kbytes("0x" + encodeData(primary, data, types));` | |
| 2350–2358 | `function domainSeparator(domain)` | fields in order `name, version, chainId, verifyingContract, salt`, each only when `!= null` |
| 2359–2360 | `const digest712 = (domain, primary, message, types) => kbytes("0x1901" + pad(domainSeparator(domain)) + pad(hashStruct(primary, message, types)));` | |

### 1.13 ERC-6551 derivation (2362–2393)

```js
2363 const REACH_SALT = pad("0");                              // bytes32(0), 64 hex, no 0x
2364 const GRIP_SALT  = khex("IPSEITY.GRIP.v1").slice(2);      // 64 hex, no 0x
2366 function derive6551(impl, salt){
2369   const code = "0x3d60ad80600a3d3981f3363d3d373d3d3d363d73" + impl.slice(2).toLowerCase() +
2370                "5af43d82803e903d91602b57fd5bf3" +
2371                salt +
2372                pad(BigInt(S.chainId).toString(16)) +
2373                pad(String(S.collection).slice(2).toLowerCase()) +
2374                pad(BigInt(S.id).toString(16));
2375   const h = kbytes(code);
2376   const create2 = "0xff" + REG_6551.slice(2).toLowerCase() + salt + h.slice(2);
2377   return checksum("0x" + kbytes(create2).slice(-40));
2378 }
2381 function account6551(){ return derive6551(REACH_IMPL, REACH_SALT); }
2384 function grip6551(){ return derive6551(GRIP_IMPL, GRIP_SALT); }
2390 function agrees(derived, reported){ return /^0x[0-9a-fA-F]{40}$/.test(String(reported || "")) && String(derived).toLowerCase() === String(reported).toLowerCase(); }
```

**Correspondence with `src/lib/AccountBinding.sol`** (read in full):

```solidity
bytes32 internal constant REACH_SALT = keccak256("intact.reach.v1");
bytes32 internal constant GRIP_SALT  = keccak256("intact.grip.v1");
runtime  = hex"363d3d373d3d3d363d73" ‖ implementation ‖ hex"5af43d82803e903d91602b57fd5bf3" ‖ abi.encode(salt, chain, collection, id)   // 173 bytes
initHash = keccak256(hex"3d60ad80600a3d3981f3" ‖ runtime)
address  = address(uint160(uint256(keccak256(hex"ff" ‖ REGISTRY ‖ salt ‖ initHash))))
```

The donor's `code` string is exactly `3d60ad80600a3d3981f3 ‖ runtime` and its
`create2` string is exactly `ff ‖ REGISTRY ‖ salt ‖ initHash`; the CREATE2
salt and the footer salt are the same word in both. **The formula needs no
change; only the two salt constants and the `S.collection` field name do.**

Exact INTACT salts, computed two independent ways (the donor's own keccak run
in `vm`, and `ethereum-cryptography@3.2.0` from `/home/user/Special/node_modules`),
both agreeing:

```
keccak256("intact.reach.v1") = 0x1d97c6e8ecf40bc45561209243f476bcf68c575ec575f9c181d13e8b8a5847ec
keccak256("intact.grip.v1")  = 0xfd337a35301ee4404b1253abd358da8011894832b313d6c3ab3f648f26da6be0
(donor, for the record: keccak256("IPSEITY.GRIP.v1") = 0x93988d94843feea610f64419dd9a9ee604b27afe89b78b9a1fdd907a2f65ee0e)
```

So in app.html, following the donor's own rule of computing rather than pasting:

```js
const REACH_SALT = khex("intact.reach.v1").slice(2);
const GRIP_SALT  = khex("intact.grip.v1").slice(2);
```

Worked vector (useful for selftest, see §4.4): with the selftest stub
`S = { id: 7, hub: "0x1234567890AbcdEF1234567890aBcdef12345678", chainId: 1 }` and
`reachImpl = 0x0…0`, `derive6551(REACH_IMPL, REACH_SALT)` =
`0x6aFB0ef97eB85b6742326c7372421a166C5dac1a` — produced by the donor JS with the
INTACT salt and reproduced by an independent transcription of
`AccountBinding.predict` over ethereum-cryptography's keccak
(`runtime` measured 173 bytes). It has not yet been cross-checked against the
Solidity itself; a one-line `.t.sol` assertion would close that.

---

## 2. What the range depends on from the rest of ipseity.html

The shell author must provide each of these **before** the pasted range (they
are referenced at load, not only inside functions).

| Symbol | Donor definition | Used in range at | Contract |
|---|---|---|---|
| `S` | line 504 `const S = Object.assign({ id, collection, chainId, owner, account, pool, …, rpc: "" }, window.IPSE \|\| {});` | `S.chainId` 2058, 2173, 2174, 2176, 2177, 2183, 2187, 2245, 2293, 2372; `S.rpc` 2114; `S.reachImpl` 2209; `S.gripImpl` 2210; `S.collection` 2373; `S.id` 2374 | the state object. Only six fields are read by the range |
| `$` | line 634 `const $ = s => document.querySelector(s);` | `$("#cbox")` 2239; `$("#confirm")` 2255, 2256, 2290; `$("#cno")` 2256; `$("#cgo")` 2257, 2282; `$("#cgas")` 2265, 2269 | selector → element |
| `say(msg, kind)` | lines 1849–1856; **`t.innerHTML = msg`** at 1852 into `#tick`, `className = kind` (`"ok"`, `"err"`, `""`), fades after 7 s | 2145, 2150, 2168, 2294, 2300, 2311, 2319 | the ticker |
| `shock()` | line 1456 `function shock(){ VIS.pulse = 1; accFrames = 0; }` (a WebGL pulse) | 2292, 2313 | "something landed" cue; INTACT needs a no-op or a CSS pulse |
| `refresh()` | line 3738 `async function refresh(loud)` (re-reads the token) | 2162, 2165, 2315 | **this is where INTACT's `rightsOf` + `custodyEpoch` recomputation belongs** |
| `paintRail()` | line 3769 `function paintRail()` (wallet LED + label from `NET`) | 2083, 2152, 2162, 2165, 2167, 2178, 2188 | repaint the connect control |
| DOM | `#cbox` (slab body), `#confirm` (toggles class `open`), `#cno`, `#cgo`, `#cgas` (created by `propose`); `#tick` (via `say`) | — | the slab markup also uses classes `.plain .kv .k .vv .code .s .b .g` and CSS variables `--warn`, `--bad` |
| Platform | `window.addEventListener/dispatchEvent/ethereum/localStorage`, `fetch`, `TextEncoder`, `TextDecoder`, `setTimeout`, `BigInt`, `Number.prototype.toLocaleString`, `Map`, `Set` | — | `document` is **not** referenced anywhere in the range (verified by scan) |

Not dependencies, despite the task's guess: `esc` is defined *inside* the
range (2220); `L`/`liveWord`, `packSection`, `unpackSection` are §9 (2410–2426),
outside the range but inside selftest's slice (§4).

Helpers in the range that the donor itself never calls outside it (terser with
`toplevel: true` drops them; keep or cut deliberately): `gwei` is used only at
3020–3021 (gas-price display); `decInt`, `decBool` are unused everywhere;
`agrees`, `grip6551`, `account6551` are used by the donor's vault/identity
cards (2635–2636, 3047–3048) — INTACT's Home will want `agrees(account6551(),
S.reach)` and `agrees(grip6551(), S.grip)` the same way.

---

## 3. Everything that must change for INTACT

Numbered so the shell author can tick them off. "Build-failing" means
`tools/build-app.mjs` `refuse()` throws on it today; "rule" means DESIGN/U9
requires it but no gate catches it yet (so `verify-site.mjs` should).

### 3.1 `$IPSE` → `$INTACT`, `window.IPSE` → `window.INTACT`
Not in this range. `$IPSE` lives in the donor's Renderer loader; INTACT's
`src/Renderer.sol:78` already reads `self.$INTACT`. The state object is read
at donor line 523 (`window.IPSE || {}`), outside the range. For INTACT the
shell defines its state alias **outside** the pasted range (selftest stubs it,
§4) — e.g. `const S = window.INTACT || {…viewer fallback…}` — and the range
keeps referring to `S.*`. Renaming the alias is fine as long as the prelude
stub in selftest is renamed to match.

### 3.2 Field names from `Catalog.state(id)` (`src/Catalog.sol:860-884`)
The state block's keys are `id`, `chainId`, `hub`, `reachImpl`, `gripImpl`,
…, `reach`, `grip`, `epoch`, `status`, `reported`, `absent`, `sel`, `err`,
`topics`, `panels{swap,social,launch,vault,identity,agent}`, `engineHash`,
`catalogHash`, `block`, `time`. **No `collection`, no `rpc`.** Change:
- line 2373 `String(S.collection)` → `String(S.hub)`.
- `S.id`, `S.chainId`, `S.reachImpl`, `S.gripImpl` keep their names (identical keys).
- The derived accounts should be checked against `S.reach` / `S.grip` with `agrees()`.
- `INTACT.sel` is a map `{ rightsOf: "0x…", custodyEpoch: "0x…", panel: "0x…", … }`
  (row names from `Catalog.sol:380-388, 506`); the page can compute the same
  selectors with `selector(sig)` — two independent sources, and a disagreement
  is a reason to refuse, not to pick one.

### 3.3 No RPC URL in any document (rule; build gate catches only `src=`)
Four places in the range carry or use an endpoint:
1. `CHAINS[*].rpc` (2044–2045): `"https://eth.llamarpc.com"`, `"https://ethereum-sepolia-rpc.publicnode.com"`. **Delete the `rpc` field.**
2. `S.rpc` and the `fetch` fallback in `rpc()` (2114–2129). **Delete the branch.** `rpc()` becomes `if(!NET.provider) throw new Error("no provider"); return NET.provider.request({ method, params });`. Under the head shard's CSP (`connect-src 'self'`) the fetch would be blocked anyway, so leaving it would only produce a confusing error path.
3. `requireChain`'s `wallet_addEthereumChain` branch (2180–2190) passes `rpcUrls: [want.rpc]`. **Delete the branch**; on `4902` fall through to the "This token lives on …" sentence. (A chain the wallet does not know is not one INTACT can help it reach without naming an endpoint.)
4. `fire()` builds an explorer link from `chainOf(S.chainId).ex` (2293–2295). The `ex` strings are `https://etherscan.io` / `https://sepolia.etherscan.io`. Not an RPC, but every "no `https://` in the document" grep will trip on them. Decide once (open question 2): either drop `ex` and show the bare hash, or keep an explorer table and have `verify-site` assert specifically that no `rpc` key and no `fetch(` call survive in the shell source.

Consequences for `NET`: `ro` meant "no wallet, public RPC" — that mode no
longer exists. Re-purpose or rename: `NET.ro = true` ⇒ "a provider is injected
but no account was requested" (the `data:` viewer with a wallet, which may
`eth_call` and load panels, DESIGN §5.1), `NET.dead = true` ⇒ no provider at
all. `connect()`'s two `say` sentences about "Reading the chain directly" are
false under INTACT and must go.

`CHAINS` itself: it names only chains 1 and 11155111. INTACT has five bands
(`Catalog.bands()`); `requireChain`'s sentence "This token lives on `want.n`"
needs a name for each band's chain. Either extend `CHAINS` to the five with
`{ n, s }` only, or read names from `S.bands`/`S.chainId` if the Catalog
carries them (it carries `band`, `bandLo`, `bandHi`, `chainId` but no name —
open question 2).

### 3.4 `innerHTML` (build-failing today)
`refuse()` in `tools/build-app.mjs` matches `\binnerHTML\s*=` and **the range
hits it once, at line 2239** (`$("#cbox").innerHTML = …` in `propose`). The
build will not accept the range as-is. `static-audit.mjs` scans `engine/`
with the same rule (`tools/static-audit.mjs:50, 57`). Rewrite `propose`'s
slab body with `createElement`/`textContent` (a small `el(tag, cls, text)`
helper; the rows become `<pre>` text built by string concatenation of
*hex words and decimal readings only*, which is safe as text). `esc()` then
has no DOM caller; terser removes it.

Second-order: `say()` (outside the range) uses `innerHTML`, and three callers
*inside* the range pass HTML — 2168 (`<b>` around the address), 2294–2295
(`<b><a href=…>` explorer link), 2311 (`<b>` around the block number). `say`
must become `textContent` and these three messages must become plain strings;
if a link is wanted, `say` grows an optional `{ href }` argument and builds an
`<a>` with `createElement`, assigning `href` only after a `^https://` check
and setting `rel="noreferrer"` as the donor does.

### 3.5 Unlimited approvals
None in this range: there is no `approve(` call and the `(1n<<256n)-1n` mask
is absent (`refuse` reports clean; the two `1n << 256n` uses at 1954 and 1998
are two's-complement arithmetic, not the mask). The unlimited approvals
BUILD-PLAN names are in the lane donors (`console.js`/`console-lanes.js`),
outside this surface. Because every write passes through `propose`, the slab
is the right place for a cheap global guard: if `tx.sig === "approve(address,uint256)"`
(or `increaseAllowance`), refuse when the amount word is `≥ 1n << 255n`, and
print the exact amount in the "plain" sentence. `verify-site`'s "every
approval the slab builds is exact" then has one choke point to test.

### 3.6 `connect()` and the chain check (rule)
- **Order.** The donor reads `eth_chainId` *after* `eth_requestAccounts`
  (2157 then 2159). DESIGN §5.4: `eth_chainId` compared to `INTACT.chainId`
  **before any read**. New order per provider: `eth_chainId` → compare →
  (mismatch: show the switch button, make no `eth_call`) → `eth_accounts`
  quietly → `eth_requestAccounts` only on a user gesture.
- **Viewer never prompts.** `connect()` calls `eth_requestAccounts`
  unconditionally. When `SANDBOXED` is true the shell must not call it at all
  (DESIGN §5.1: "it never calls `eth_requestAccounts` and never asks to sign").
  Gate `connect` and hide the connect control behind `!SANDBOXED`.
- **Picker.** `chosen = pick != null ? list[pick] : list[0]` (2155)
  auto-selects. Replace with the Chrome.sol `WALLET_JS` chooser logic
  (`src/Chrome.sol:280-324`: remembered `rdns` in `localStorage` → the single
  announcer → `ask()` picker built with `createElement`/`textContent`, icon
  only when it `startsWith('data:image/')`); storage key `'ipse.wallet'` →
  `'intact.wallet'`, every storage access in `try/catch` (the donor already
  does this).
- **Rights.** The `accountsChanged` / `chainChanged` handlers (2161–2166)
  call `paintRail(); refresh();`. Make `refresh()` the function that
  re-reads `rightsOf(id, account)` (`IIntact.sol:188`:
  `function rightsOf(uint256 id, address actor) external view returns (uint16 bits, uint64 epoch, address holder)`)
  and sets `body.dataset.rights`; on `chainChanged` re-compare the chain first
  and clear rights on mismatch. Bits: `HOLD=1 ACCOUNT=2 USE=4 CUSTODY=8
  ROLE=16 DELEGATE=32 GUARDIAN=64 SESSION=128` (`src/lib/Rights.sol:35-42`;
  also baked as `INTACT.rights`).
- `eth_getCode(holder)` for the 7702 delegate check (DESIGN §5.4) is new code,
  not in the donor; it belongs next to `connect`.

### 3.7 `propose` / `fire` / `watch` additions (rule)
- **Epoch.** `propose` must capture `tx.epoch = decUint(await readSig(S.hub, "custodyEpoch(uint256)", [S.id]))`
  (or take it from the caller) and `fire` must re-read `custodyEpoch` immediately
  before `eth_sendTransaction`, aborting with "ownership or epoch changed — review
  again" on a difference; `watch` re-reads `rightsOf` and `custodyEpoch` after the
  receipt (DESIGN §1 "Act", §5.4). `IIntact.sol:174`: `function custodyEpoch(uint256 id) external view returns (uint64)`.
- **Errors.** The donor's estimate failure shows `"would revert"` with the raw
  message in `title`. INTACT decodes the 4-byte revert selector through
  `INTACT.err` (`{"0x…":"NotHolder",…}`) and prints the error *name* in the slab
  so "a non-holder sees the custom error before the wallet opens".
- **Rows.** Add the calldata digest (`kbytes(tx.data)`) and `INTACT.engineHash`
  rows DESIGN §1 lists.
- **Floor in words.** For swap slabs the `plain` sentence must state `minOut`
  in units (`fmtUnits`) — a caller contract, not a library change, but the slab
  should refuse a swap `tx` without a `plain` sentence containing it.
- Keep: `gas = estimate × 125 / 100` as BigInt, the 90 × 2 s watcher, exact
  `value` via `hexQ`.

### 3.8 Panel loading (new code that uses the library)
`/panel/<name>.js` is served by `Premises.sol:140-158` from
`IEngine.panel(i)` **as stored gzip with `Content-Encoding: gzip`** and
`ETag: "<keccak of the inflated bytes>"`; `_panelIndex` (414) accepts exactly
`verbWord(i+2) + ".js"`, i.e. `swap.js social.js launch.js vault.js identity.js agent.js`.
`Engine.panel(uint256)` (`Engine.sol:161`) returns the gzip bytes; `panelHash(i)`
the keccak of the inflated text. So:
- over a gateway the browser inflates transparently and `fetch(...).arrayBuffer()` is plain JS;
- over a native `web3://` client, or via `eth_call` in the viewer, the bytes are gzip:
  check for the `1f 8b` magic and inflate with `DecompressionStream("gzip")` (the same
  platform API the loader uses);
- then `toHex(keccak256(bytes)) === String(S.panels[name]).toLowerCase()` — the library's
  `keccak256` on a `Uint8Array` — and only then `new Blob([bytes], { type: "text/javascript" })`
  → `URL.createObjectURL` → `<script src="blob:…">` (allowed by `script-src 'unsafe-inline' blob:`).
  A mismatch is a refusal with the two hashes printed, never a fallback.

### 3.9 Smaller items
- `gwei` (2040) does `Number(BigInt(v)) / 1e9` — floating point on an amount.
  Delete it (U9's rule "BigInt only for amounts"); if a gas price is shown,
  format with `fmtUnits(v, 9, 3)`.
- `SANDBOXED`'s probe key `"ipse"` → `"intact"` (2105), cosmetic.
- Comment at 2204–2208 ("The GRIP salt is keccak(\"IPSEITY.GRIP.v1\")…") must be
  rewritten for the two INTACT salts; the §7 box text about "the field still
  turns" and the §8 text are IPSEITY prose — acceptable as verbatim history or
  trimmed, but the salt comment would be *wrong*, not merely foreign.
- `pending.gas` is set from inside an async IIFE after the slab is open; if
  the user presses "Sign and send" first, `fire` sends without `gas` and the
  wallet estimates. Fine, but `fire` must not race the epoch re-read the same way —
  await it.
- Any **new** top-level statement the shell adds *inside* the selftest markers
  must run under the `vm` stubs (`window` has no `localStorage`, there is no
  `document`); the donor's load-time code (`window.addEventListener`,
  `SANDBOXED`) already does. Put DOM-touching setup outside the markers or
  inside functions.

---

## 4. What `tools/selftest.mjs` needs

`/home/user/Special/tools/selftest.mjs` is byte-identical to the donor's. It
runs 55 assertions today against the donor file (`node tools/selftest.mjs` in
the donor repo: `55 passed, 0 failed`).

### 4.1 How it slices
```js
const SRC  = fs.readFileSync(path.join(ROOT, "engine/ipseity.html"), "utf8");   // → engine/app.html
const FROM = "/*── keccak-256";
const TO   = "\n 10 · THE SHEET";
const a = SRC.indexOf(FROM);
const b = SRC.indexOf(TO);
const slice = SRC.slice(a, SRC.lastIndexOf("/*", b));
```
In the donor the slice runs from line 1866 to the `/*═══` opener before the
§10 title (line 2428), so it **includes §9** (`packSection`, `unpackSection`,
`liveWord` at 2403–2426; `liveWord` references `L` lazily and is never called).
Measured: 25,321 B.

### 4.2 Prelude stubs (verbatim from the file)
```js
const TAU = Math.PI * 2;
${grab("const u16ToAngle", "/* live, unsigned view")}      // donor lines 618-622: u16ToAngle, angleToU16, u16ToW, wToU16
const clamp = (v,a,b) => v < a ? a : v > b ? b : v;
const S = { id: 7, collection: "0x1234567890AbcdEF1234567890aBcdef12345678", chainId: 1,
            owner: "0x0000000000000000000000000000000000000000", rpc: "" };
const $  = () => null;
const $$ = () => [];
const say = () => {};
const shock = () => {};
const refresh = async () => {};
const paintRail = () => {};
const window = { addEventListener(){}, dispatchEvent(){}, ethereum: null };
const fetch = async () => { throw new Error("offline"); };
```
`vm.createContext` is given `TextEncoder, TextDecoder, console, BigInt, Math,
Number, String, Array, Object, JSON, Uint8Array, Date, Promise, setTimeout,
parseInt, isNaN` (a fresh context has its own `Map`, `Set`, `Error`, `RegExp`).

### 4.3 Names exported through `globalThis.__X` (24)
```
keccak256, khex, kbytes, selector, checksum, encodeCall, encodeParams, utf8, toHex, fromHex,
decUint, decAddr, decString, decStringLoose, fmtUnits, toUnits, account6551,
digest712, domainSeparator, hashStruct, typeHash, packSection, unpackSection, isAddr
```
All but `packSection`/`unpackSection` are defined in the 1858–2394 range and
must keep these exact names at top level of the sliced region (terser renames
them in `dist/`, but selftest reads the source, not the build).

### 4.4 Minimal change for app.html
1. `SRC` path → `engine/app.html`.
2. `FROM` unchanged: app.html must contain the exact line
   `/*── keccak-256 (the Ethereum variant: 0x01 padding, not SHA-3's 0x06) ──*/`
   (only the prefix `/*── keccak-256` is matched).
3. `TO`: `"\n 10 · THE SHEET"` will not exist. Recommended: end the library
   with one explicit marker line, e.g. `/*── end of the chain library ──*/`,
   set `TO` to it and slice `SRC.slice(a, b)` (dropping the `lastIndexOf("/*", b)`
   dance). Alternative with zero code change to the slicing logic: keep a box
   header after the library whose title line is `" 10 · THE SHEET"` — but that
   is a lie in INTACT's document; prefer the explicit marker.
4. Prelude: drop `TAU`, the `grab("const u16ToAngle", …)` line and `clamp`
   (they exist only for §9 and `grab` throws `indexOf = -1` slicing garbage if
   the marker is absent); change the `S` stub to the INTACT keys:
   `{ id: 7, hub: "0x1234567890AbcdEF1234567890aBcdef12345678", chainId: 1, reachImpl: "0x0000000000000000000000000000000000000000", gripImpl: "0x0000000000000000000000000000000000000000" }`
   (no `rpc`). Keep `$`, `$$`, `say`, `shock`, `refresh`, `paintRail`, `window`,
   `fetch` stubs — or whatever the shell's actual names are; the stub list is the
   contract between the shell and the test, so any new load-time dependency the
   library grows (a chooser object, a `rights()` function) must be stubbed here.
5. `__X`: remove `packSection`, `unpackSection`; optionally add `grip6551`,
   `derive6551`, `agrees`, `decInt`, `decBool`, `encWord`, `splitWords`.
6. Vectors: the **50** keccak / selector / EIP-55 / ABI / decoding / units /
   EIP-712 / 6551 assertions are unchanged (BUILD-PLAN's "vectors unchanged").
   The **5** "section word" assertions (lines 209–219) test IPSEITY's
   orientation word, which INTACT does not have; delete that block (decision
   recorded as open question 3). Recommended addition in their place, so the
   6551 block has a hard vector instead of only `isAddr/checksummed/deterministic`:
   `eq("the Reach of token 7 on chain 1 with a zero implementation", X.account6551(), "0x6aFB0ef97eB85b6742326c7372421a166C5dac1a")`
   — the value in §1.13, ideally pinned by one `.t.sol` line against
   `AccountBinding.predict(address(0), REACH_SALT, 1, 0x1234…5678, 7)`.
7. `package.json` already has `"selftest": "node tools/selftest.mjs"`; DESIGN §13
   (line 550) lists `selftest` third in `npm run check` (`compile → facets →
   selftest → build-app → …`), but the current `check` script (`package.json:35`)
   runs `compile && facets && forge:monolith && forge:diamond && gas &&
   gas:selftest && static-audit` — neither `selftest` nor `build` is in it. U9
   should add `npm run selftest && npm run build` after `facets`.

---

## 5. Sizes

Measured with `node` 22, `terser` 5.51.2 from `/home/user/Special/node_modules`
using `build-app.mjs`'s exact options (`ecma: 2022, compress: { passes: 2 },
mangle: { toplevel: true, reserved: ["INTACT"] }`), `zlib.gzipSync(level 9)`.

| Slice | raw | raw gzip | terser | terser + gzip |
|---|---|---|---|---|
| lines 1859–2396 (the documented number) | **24,449 B** | 8,603 B | does not parse (starts mid-comment) | — |
| lines 1858–2394 (parseable verbatim unit) | 24,407 B | 8,574 B | 13,101 B | **5,310 B** |
| lines 1866–2394 (from the selftest FROM marker) | 23,726 B | 8,442 B | 13,101 B | 5,310 B |
| selftest slice (1866 → before "10 · THE SHEET", incl. §9) | 25,321 B | 8,909 B | 13,505 B | 5,471 B |
| 1858–2394 with block comments stripped | 19,213 B | | | |

Reading: the library is ≈ 5.3 KB of the 18,000 B shell gzip ceiling
(`SHELL_GZIP_CEILING` in `build-app.mjs`), leaving ≈ 12.7 KB gzip for the
chooser, Home, rights gate, slab DOM, QR and CSS. Against DESIGN §5.5's
estimate ("shell ≈ 14 KB gzip") the library's share is in line. The edits in
§3 (removing `rpc()`'s fetch branch, `wallet_addEthereumChain`, `gwei`, `esc`,
the `CHAINS` URLs) shrink it; the DOM-built slab and the epoch/error/panel
logic grow it — expect the library to land near 6 KB gzip after U9's edits.

Commands used (reproducible from `/home/user/Special`):
```
sed -n '1859,2396p' /home/user/Most-Advanced-NFT-Possible/engine/ipseity.html | wc -c   # 24449
sed -n '1858,2394p' /home/user/Most-Advanced-NFT-Possible/engine/ipseity.html | wc -c   # 24407
node /tmp/claude-0/-home-user/d02948b7-425c-5f8f-bc11-ab8ffeea4616/scratchpad/u9-measure2.mjs   # terser/gzip table, salts
node /tmp/claude-0/-home-user/d02948b7-425c-5f8f-bc11-ab8ffeea4616/scratchpad/u9-scan.mjs       # refusal + reference scan
```

---

## 6. Open questions for the shell author

1. **Single announcer.** `WALLET_JS` picks the only wallet without asking
   (`if(P.size===1)return CHO=…`); DESIGN §5.4 says "a picker whenever more
   than one announces, never auto-selected". U11's test is "the EIP-6963 picker
   never auto-selects". Decide whether one announcer is still shown a one-button
   picker (safest reading) or chosen silently.
2. **Chain names and explorers.** `CHAINS` knows 1 and 11155111 only and
   carries explorer URLs. INTACT needs names for five band chains for the
   `requireChain` sentence; the Catalog's state block has no chain-name or
   explorer field. Extend `CHAINS` (names/symbols only) or add names to the
   Catalog; decide whether any `https://` explorer string may appear in the
   shell at all, and write the `verify-site` grep accordingly (DESIGN §1 wants an
   `https://` gateway twin on Home, so a blanket "no https://" assertion is wrong;
   "no `rpc` key, no `fetch(` outside the panel loader" is right).
3. **selftest count.** 55 → 50 (+1 if the hard 6551 vector is added). BUILD-PLAN
   says "vectors unchanged"; the five dropped ones are IPSEITY art, not chain
   vectors. Record the decision in `docs/INVARIANTS.md`.
4. **`NET.ro` semantics** after the public-RPC path is gone (§3.3).
5. **Where `rightsOf` lives.** `refresh()` is the natural owner (it is already
   called on `accountsChanged`, `chainChanged` and after every receipt), but it
   is outside the pasted range, so the shell must define it before the range and
   selftest must stub it (it already does).
