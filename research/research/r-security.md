# Security lessons for NFTs, token-bound accounts, launchpads and on-chain apps (2024–2026)

Research date: 2026-10-02. Scope: what has actually broken in the four surfaces our unified protocol will ship — the token and its bound accounts (vault), the per-token swap, the launchpad, the on-chain messaging layer, and the self-served website — and what that implies for the merged design. 21 searches, 17 primary pages fetched (EIP texts, protocol docs, post-mortems, audit findings). Every incident below carries its date and source; claims only seen in secondary summaries are marked **unverified**.

The four source repos are referenced by their working names: **ANIMA** (`Cutting-edge-technologically-advanced-NFT`, monolith + immutable diamond, Hardhat), **IPSEITY** (`Most-Advanced-NFT-Possible`, fully on-chain web3:// site, Reach/Grip accounts, per-token Pool), **MASTER** (`MASTER-NFT-PROJECT`, module registries, OFT lane, MLS chat, v4 launch composer), **GARDEN** (`Pixel-Garden`, kernel + cartridges: Market, Launchpad, Curve, Social, Locks, OTC).

---

## 1. State of the art: the threat model for an "everything inside the NFT" token

A token that owns a wallet, runs a market, launches tokens, chats, and serves its own website concentrates five normally-separate attack surfaces behind one `ownerOf`. The 2024–2026 record says the losses do not come from exotic cryptography; they come from six recurring classes:

1. **Authority that outlives the sale** — operators, session keys, signed permits and lease rights that survive `transferFrom` (the ERC-6551 "fraud" problem; the ERC-1271 replay problem).
2. **Callbacks and hooks that trust their caller** — `onERC721Received`, `uniswapV3SwapCallback`, v4 `beforeSwap`, `lzReceive` (Cork, SIR, KelpDAO).
3. **Rounding that favours the user under extreme state** — Balancer v2 ($128M), Bunni ($8.4M), zkLend, ResupplyFi, ERC-4626 first-depositor inflation.
4. **Launch-time state that an attacker can pre-create** — a DEX pair initialised before migration (Four.meme, twice), insider/sniper cohorts on the curve (HAWK, pump.fun insider).
5. **Verification configuration treated as "someone else's defaults"** — 1-of-1 DVN (KelpDAO, $292M).
6. **Rendering untrusted strings** — SVG `<script>`, `javascript:` URLs in metadata, JSON injection (marketplace XSS class).

Three of our four repos already encode defences against most of these (ANIMA's epoch-keyed approvals and `_update` revocation; IPSEITY's no-outbound Grip, anchored curve, `minOut`+`deadline`; MASTER's custody epochs; GARDEN's room cooldowns). The job of this report is to make sure the merge keeps every one of them, and to add what none of the four has.

---

## 2. Incident catalogue and lessons

### 2.1 ERC-6551 token-bound accounts

**Specification facts (ERC-6551, eips.ethereum.org, fetched).** Status: still "in the process of being peer-reviewed" (created 2023-02-23; requires EIP-165/721/1167/1271). Interfaces:

```solidity
// IERC6551Registry
function createAccount(address implementation, bytes32 salt, uint256 chainId, address tokenContract, uint256 tokenId) external returns (address);
function account(address implementation, bytes32 salt, uint256 chainId, address tokenContract, uint256 tokenId) external view returns (address);
// IERC6551Account
function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);
function state() external view returns (uint256);              // "SHOULD be modified each time the account changes state"
function isValidSigner(address signer, bytes calldata context) external view returns (bytes4);
```

Its Security Considerations name two problems the standard explicitly leaves to applications:

- **Fraud prevention**: an owner can empty the account in the same block they sell the token. The EIP suggests attaching an account-state snapshot to marketplace orders, committing to specific assets, external validation contracts, or **account-level locks**. "Preventing fraud is outside the scope of this proposal."
- **Ownership cycles**: transferring the token into its own account bricks both forever; "on-chain prevention of cycles with depth>1 is difficult to enforce ... and as such is outside the scope of this proposal."

**What the reference implementation actually does (tokenbound `AccountV3.sol`, fetched).** The cycle guard is depth-1 only:

```solidity
if (msg.sender == tokenContract && tokenId == _tokenId && chainId == block.chainid) revert OwnershipCycle();
```

Signer resolution walks up nested accounts with **no explicit depth limit** (`while (isERC6551Account(_owner)) { ... }`), which is a gas-griefing/DoS surface if an attacker nests accounts deeply; ERC-1271 for contract signers requires the signer to pass `_isValidSigner`; `_beforeExecute` reverts when locked and bumps `state()` before every execution.

**Lessons for us.**
- Our `_update` hook (ANIMA) already does what the EIP's "fraud" section asks: on transfer it rolls the operator epoch, clears guardian/lease/policy/bound wallet and forces `Paused`. Keep it, and extend it to the merged account: **any session key, instrument grant, or room invitation must be keyed to a custody epoch that `_update` increments** (MASTER's "custody epoch" and GARDEN's `_beforeTokenTransfer` are the same idea).
- Add a depth-2 cycle check cheaply: in `onERC721Received`, if the incoming token's contract is our hub and its bound account (via the registry's deterministic `account()`) is `msg.sender`'s owner chain within two hops, revert. Deeper cycles stay out of scope, as the EIP says, but document it.
- Bound the `_rootTokenOwner` walk (e.g. 8 hops, then revert) so a nested-account chain cannot make `isValidSigner` run out of gas on settlement paths — ANIMA's `accountOf` is called by eight contracts on settlement paths, which is exactly where a griefable view hurts.
- The **Grip** (IPSEITY) is the strongest fraud answer in the four repos: a receive-only account with no outbound function. It should stay that way in the merge; the "vault" the user asked for is the Reach (acts, sealable) plus the Grip (cannot act).

### 2.2 Signature replay and smart-account signatures

- **ERC-1271 cross-account replay (Alchemy disclosure, 2024-03-29; found Oct 2023).** When one EOA owns several smart accounts and an application's signed payload omits the account address (Permit2's `PermitTransferFrom` omits `owner`), one signature is valid for all of them. Affected: LightAccount, ZeroDev Kernel, Biconomy, Soul, eth-infinitism's Safe fallback, Ambire, OKX, Argent forks; applications: Permit2, CoW. Fix adopted industry-wide: defensive rehashing.
- **ERC-7739 (created 2024-05-28, eips.ethereum.org, fetched).** Nested EIP-712 `TypedDataSign` wrapping `{contents, name, version, chainId, verifyingContract, salt}`; support detection by returning `bytes4(0x77390001)` for `isValidSignature(0x7739…7739, "")`; on-chain sanitisation of `contentsName` (reject empty, lowercase-initial, or containing `, )\x00`) because wallets do not sanitise type names and a phishing site can break out of the type string.
- **Cross-chain EIP-712 replay (Sherlock, Symbiotic Relay, June 2025 contest).** A `hashTypedDataV4CrossChain` that deliberately omitted `chainId` and `verifyingContract` let a validator-set commit from chain A be replayed on chain B.
- **Trail of Bits, "Six mistakes in ERC-4337 smart accounts" (2026-03-11, fetched).** (1) unprotected `execute`; (2) signature not bound to gas fields — bind the EntryPoint `userOpHash`; (3) storage writes in `validateUserOp` race across a batch; (4) ERC-1271 without domain binding; (5) "reverts don't save you" — once validation passes, bundlers are paid, so `postOp` must be minimal and fees escrowed at validation; (6) ERC-7702 initialisation races — require `msg.sender == address(this) && owner == address(0)`.
- **ERC-6492 bypass (OpenZeppelin 2025 rewind, fetched):** an arbitrary-call path in a 6492 verifier was pointed at precompile `0x04` (identity) to make `isValidSignature` pass while executing a transfer.
- **Bybit, 2025-02 (OZ rewind):** $1.4B — a compromised Safe UI showed legitimate data and submitted attacker parameters. The UI was the security boundary. Our UI is on-chain and immutable, which removes the "patched JS" vector but also means a rendering bug ships forever (see §2.9).

**Lessons for us.** Every signed object in the merged protocol (InferenceMeter vouchers, lease offers, session grants, launch terms, room invitations) must be EIP-712 with `chainId`, `verifyingContract`, a per-signer nonce **and the token id and custody epoch**; the account's ERC-1271 must implement ERC-7739 rehashing; session keys must never satisfy ERC-1271 (ANIMA invariant 3) and must not be accepted as `isValidSigner` for anything but their allow-listed `(target, selector)` set.

### 2.3 Approvals, epochs and revocation

ANIMA's approval store is keyed `keccak256(owner, approvalEpoch[owner], operator)` (`AnimaBase.sol:236`, `AnimaCoreFacet.sol:56`), so `revokeAllApprovals` is O(1) and `_update` can revoke the seller's operators by bumping the epoch. This is the ERC-721 analogue of Permit2's `invalidateNonces` (invalidates all nonces below a new value, max 2^16 per call) and `lockdown` (batch revoke per token/spender) — Permit2 PR #171 adds the same to ERC-721 operators. Industry context: the drainer economy in 2025 moved from `setApprovalForAll` phishing to **EIP-7702 batch phishing** — Wintermute reported >97% of early 7702 delegations pointed to sweeper contracts (unverified, press); single victims lost $150k (2025-05-24), ~$350k (Aug 2025) and $1.54M (late Aug 2025) to one-signature atomic batches (press, unverified amounts). The OZ rewind lists POT Token ($85k) and Gana Payment ($3.1M, Oct–Nov 2025) as contracts whose "EOA-only" `msg.sender == tx.origin` / `extcodesize` checks were broken by 7702.

**Lessons for us.** Keep the epoch store; add an epoch to **every** delegated authority (operators, session keys, instrument grants, lease, launch roles, room moderators). Never gate anything on `tx.origin` or `extcodesize == 0`. Expose one `panic()`-style function on the account that bumps every epoch and seals the Reach in one call, usable by the owner or a pre-named guardian — the one thing a drained user wishes they had.

### 2.4 Launchpads and bonding curves

- **pump.fun, 2024-05-16 (The Block, fetched).** A former employee with the withdraw authority used flash-loaned SOL to buy curves to 100%, triggering migrations whose liquidity repaid the loans: ~12,300 SOL (~$1.9M) of $45M curve TVL. Lesson: **a privileged withdraw key on the curve is the whole protocol.** Our curve must have no such key (ANIMA's `AgentLaunchpad.graduate` is permissionless and `lpRecipient` is fixed at creation — keep that).
- **Four.meme #1, 2025-02 (Coinspect reproduction + PANews, fetched).** Migration called `createAndInitializePoolIfNecessary` and minted with `amount0Min = amount1Min = 0`; attacker pre-initialised the PancakeSwap v3 pool at `sqrtPriceX96 ≈ 1e42` (3.7e14× the real price) so the launchpad added 23.5 WBNB against 1 token; attacker sold 1,600 tokens for 23.4 WBNB. ~$183k total (press).
- **Four.meme #2, 2025-03-17/18 (PANews, QuillAudits, fetched).** `buyTokenAMAP` could deliver pre-launch tokens to any address, including the **predictable, not-yet-created** PancakeSwap pair, bypassing `MODE_TRANSFER_RESTRICTED`; attacker minted LP at their own price, sandwiched the migration tx with MEV, burned LP and sold. ~$120–130k.
- **HAWK, 2024-12-04 (onchainattack.org case file).** Bonding-curve launch; ~96% of supply acquired by sniper/insider wallets in the first seconds (Bubblemaps attribution), ~$491M peak to ~$25M in ~20 minutes, ~$3.3M extracted.
- **Robinhood Chain / Pons, Sept 2026 (coindesk.cc, unverified domain).** 53 launches, ≥$18.43M extracted; the launchpad let creators exempt up to 32 wallets from its 99%-opening snipe tax, and creators whitelisted 15–25 wallets and bought the whole curve in one tx. Lesson even if the figures are off: **a snipe tax with creator-controlled exemptions is a creator-controlled rug.**

**Lessons for us.** (1) At graduation, never trust an existing pool: if `getPool` is non-zero, verify its `sqrtPriceX96`/tick equals the curve's terminal price within a tolerance, or revert and seed a fresh pool with a different fee tier/salt; always pass real `amountMin`s. (2) Pre-launch tokens must be non-transferable **by every path** — `transfer`, `transferFrom`, `permit`, and any launchpad "buy for address" helper — and the launchpad should refuse recipients that are predicted pool/pair addresses. (3) Make graduation atomic with the final buy, or sandwich-proof by minting LP in the same call with the pool's state read after creation. (4) Snipe tax (`AgentLaunchpad.snipeTaxBps`) must have **no exemption list**; if a creator allocation is wanted, make it a vested lock (GARDEN `LocksCartridge`), not a tax exemption. (5) Rounding on the curve favours the curve; `quoteBuy` and `buy` must use identical math (a mismatch is a free option).

### 2.5 Uniswap v4 hooks

- **Cork Protocol, 2025-05-28 11:39 UTC (cork.tech post-mortem, fetched).** 3,761 wstETH (~$11–12M). Two vectors: a rollover risk-premium that exploded for tiny time-to-expiry, and `CorkHook.beforeSwap` accepting unvalidated `hookData`; the attacker deployed a contract implementing the hook interface, called `PoolManager.unlock` with benign data to fabricate a legitimate-looking context, then forged parameters into `FlashSwapRouter.CorkCall`. Cork was pinned to a 2025-01-30 periphery; the 2025-02-06 upstream added the missing authorisation check.
- **Bunni v2, 2025-09-02 (Halborn, fetched; OZ rewind).** $8.4M on Ethereum + Unichain; `withdraw` rounded idle balance the wrong way; flash loan + 44 small withdrawals, then a sandwich pushing token0 to 28 wei then 4 wei. Audited by Trail of Bits and Cyfrin before (press).
- **Trail of Bits, "Building secure Uniswap v4 hooks" (2026-07-30, fetched).** Seven classes: unrestricted callbacks (Cork); permissionless pool creation with your hook (Semantic Layer SVFHook); delta accounting errors (Bunni); callback timing (LiquidityPenaltyHook); address permission-bit misalignment (Sorella Angstrom, all swaps reverted); hook failures blocking exits; shared state across nested callbacks. Eight recommendations: gate with `BaseHook`/`SafeCallback`; strict pool allowlists bound to canonical `PoolKey`; segregate balances by owner and bucket; isolate non-essential code from exit paths; verify permission bits; fuzz nested callbacks and malicious tokens; key temporary state by `PoolId` and caller.
- OZ rewind also notes a `BaseCustomAccounting` hook lacking re-initialisation guards, letting an attacker redirect a victim pool to a malicious one.

**Lessons for us.** MASTER's creator-fee hooks and GARDEN's "permissionless custom-hook launches" are exactly where this bites. Every hook callback: `onlyPoolManager`; `beforeInitialize` must reject any `PoolKey` not created by our launchpad; `hookData` is untrusted input; never let a reward/oracle/cleanup step sit on the withdraw path; fuzz with fee-on-transfer and reverting tokens. Hook addresses are CREATE2-mined — pin the salt in deployment records and assert `getHookPermissions()` against the address bits in a test.

### 2.6 Rounding and precision

- **Balancer v2, 2025-11-03 (BlockSec, fetched).** $125–128M across chains in <30 minutes; `_upscale()` only rounded down while `_swapGivenOut` needed round-up, so a swap of amount 8 against a balance positioned at 9 lost ~0.9 units, shrinking invariant D and deflating BPT; the attacker's constructor ran 65+ micro-swaps in one `batchSwap`. The inconsistency dated from 2021.
- **Bunni** (above) and **zkLend** (Feb 2025, rounding-down in withdrawal with empty-market inflation), **ResupplyFi** (exchange rate collapsed to zero when a near-empty ERC-4626 denominator was inflated by donation) — all in OZ's 2025 rewind.
- **ERC-4626 first-depositor inflation**: 1-wei deposit + direct donation; victim's shares round to zero. Venus on ZKsync lost 86.72 WETH to it in Feb 2025 (press, unverified). Mitigation: OZ virtual shares/assets (decimal offset), or a dead-shares mint on first deposit.

**Lessons for us.** IPSEITY's "rounding favours the protocol" and ANIMA invariant 5 are the right rule, but Balancer shows the failure is *inconsistency between two functions*, not a single wrong direction. Rule for the merge: each math library exposes `mulDivUp`/`mulDivDown` only, every call site names the direction, and a fuzz test asserts `round-trip never profits` at balances of 0, 1, 2, 9, 2^64 and 2^128 wei (IPSEITY already has `testFuzz_roundTripNeverProfits`; extend it to the curve and the vault share math). Any vault-style accounting needs virtual shares.

### 2.7 Transient storage (EIP-1153)

- **SIR Trading, 2025-03-30 (rekt.news, fetched).** $355k, entire TVL, 40 days after launch. `uniswapV3SwapCallback` wrote the pool address to transient slot 1 for caller verification, then overwrote slot 1 with the mint amount; the attacker mined a vanity address equal to the amount (95759995883742311247042417521410689) and passed the check in a second callback.
- **EIP-1153 Security Considerations (fetched):** "transient storage is not discarded when a call returns or reverts, as is memory"; leave non-zero values only when a later call in the same tx is meant to read them; ~9 MB allocatable with 30M gas is a DoS consideration; all SSTORE reentrancy considerations still apply.

**Lessons for us.** ANIMA uses transient storage in 16 contracts (grep: AnimaAgent, AgentAccount, BondVault, WorkEscrow, InferenceMeter, AgentComms, AgentMarket, AgentLaunchpad, AgentSwapRouter, RevenueRouter, OmniAgentHome/Mirror, ...). Rule: one transient slot per logical purpose, derived like ERC-7201 (`keccak256("anima.transient.<name>") - 1`), never a small integer; clear every slot on exit of the function that set it; a test that asserts all transient slots are zero after every external entry point. Reentrancy guards in transient storage are fine (that is the EIP's headline use) **only** if cleared on every exit path, including the revert path of the outer call.

### 2.8 LayerZero V2 OApp configuration

- **KelpDAO rsETH, 2026-04-18 17:35 UTC (Blockaid, fetched).** $292M. The Ethereum OFTAdapter was 1-of-1 — one required DVN (0x589d…236b) and no optional DVNs; compromise of that DVN's off-chain signing keys was sufficient to authenticate any message. LayerZero's own incident report (The Defiant, press) says the config had been 2-of-2 and was downgraded to 1-of-1; a press figure puts 47% of OApps on 1-of-1 (unverified). LayerZero is migrating defaults toward 5/5, minimum 3/3 (press).
- **LayerZero docs (fetched).** `UlnConfig(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)`; `setSendLibrary`/`setReceiveLibrary` pin libraries so defaults cannot rotate under you ("Default libraries are mutable; LayerZero Labs may publish a new library version and roll the default forward without your involvement"); send config on A must match receive config on B; "Production deployments should use multiple required DVNs from independent operators"; the receiver's config is what gates acceptance.

**Lessons for us.** IPSEITY's `ParleyPort` has no admin and pins its security config at construction — the right shape, but it means the DVN set must be ≥2-of-N *at construction* and a test must read `getAppUlnConfig` on both sides after deploy and assert `requiredDVNCount >= 2` and library pins set. ANIMA's `OmniAgentMirror.setPeer` is `onlyOwner`: peers and DVN config must be set once then renounced (or owned by a timelock), and the deployment record must store the full `UlnConfig` so `recover-record` can diff it. Tokens never bridge (IPSEITY's stance; ANIMA escrows rather than burns) — keep: a mirror with no custody is a mirror whose worst case is a lie, not a theft.

### 2.9 Metadata, data: URIs and the on-chain website

- **XSS class (Immunefi, fetched).** SVG with `<script>`, `javascript:` in social-link fields that marketplaces prefix with `https://twitter.com/`, unsanitised profile/description fields; JSON injection in metadata (Zokyo). CVE-2026-30948 (Parse Server) shows the "SVG served as `image/svg+xml` without CSP" bug is still being filed in 2026.
- **How viewers isolate HTML NFTs (press/forums, unverified detail):** OpenSea copies `animation_url` HTML and renders it in a sandboxed iframe; a CSP `script-src 'self'` does not permit `data:` or `srcdoc` scripts. Practical consequence: **a `data:` URI page runs with an opaque origin and no injected wallet provider**. The website the user wants (connect wallet, prove ownership) cannot work from `tokenURI` alone; it works from the **web3:// surface** (ERC-5219 `request`, IPSEITY `Premises`), through a gateway that gives the contract a real origin (per-contract subdomain), or from a locally run gateway (`tools/gateway.mjs`).
- **ERC-5219 (Final, fetched):** security considerations are only "the normal considerations of accessing normal URLs ... such as privacy leakage by following 3XX redirects." Everything else is on us.

**Lessons for us.** Every chain- or user-sourced string passes `Web.esc`/`Web.jsonEsc` on the way out and reaches the DOM through `textContent` only (IPSEITY rule; the `Sigil.NAMES` `z<-z2+c` incident is the proof it matters). Pages must ship a CSP meta tag (`default-src 'none'; script-src 'self'; connect-src <rpc>; img-src data:; style-src 'self'`) because the gateway may not add headers. Message bodies (Parley/AgentComms/Social) are bytes rendered as text, never HTML. The artwork routes must be served by the router itself, never through a page (IPSEITY: "a compromised page can frame the artwork but not alter it"). **Wallet verification is a view, not a gate**: the page checks `ownerOf`/`isValidSigner` via `eth_call` to decide what to show, but every privileged action is authorised on chain by `mayActAs(token, msg.sender)`; sign-in uses EIP-4361 (SIWE) with a nonce, domain, chainId and expiry, verified through ERC-1271/ERC-7739 for bound accounts.

### 2.10 Mints: front-running, reveal, reentrancy

- **Meebits, 2021 (press):** predictable on-chain randomness re-rolled inside one transaction until a rare id appeared (~200 ETH resale). Any `block.*`-seeded reveal is a free option for the minter.
- **Commit–reveal** removes the sniper's information advantage but has a **last-revealer** problem (the last to reveal can withhold); Commit-Reveal² (arXiv 2504.03936, 2025) randomises reveal order. For a mint, the cheaper fix is: commit → reveal uses the blockhash of a block **after** the commit window closes, with a deadline and a fallback that uses a later blockhash if the first expires (256-block limit).
- **`_safeMint` reentrancy (HypeBears, BlockSec; Code4rena NextGen #1154, 2023):** `onERC721Received` re-enters `mint` before per-wallet counters update; 25 minted against a limit of 1.
- **Sniping on the curve** (HAWK, Pons above): a time-decaying snipe tax with no exemptions, per-tx buy caps in the first N blocks, or a sealed-bid/continuous clearing auction (MASTER `ContinuousClearingAuction`) are the known tools; Paradigm's 2021 launch guide still describes the auction route.

**Lessons for us.** Mint with `_mint` + explicit receiver check, or checks-effects-interactions with counters updated before `_safeMint`; `nonReentrant` on `mint`; if ids carry rarity, use commit-reveal with post-window blockhash or a VRF; if ids are bands per chain (IPSEITY `Nameplate`), there is no rarity to snipe and the mint can be first-come.

### 2.11 Gas griefing via callbacks

- **Code4rena Revert Lend #443/#54 (March 2024, fetched):** a borrower whose contract reverts in `onERC721Received` makes liquidation revert forever — High. Fix: `transferFrom` in protocol-driven flows, or pull-based claims.
- **63/64 rule and return bombs:** a callee can consume all forwarded gas; the outer call survives with 1/64. Protocol-driven external calls must be either pull-based, gas-capped (`call{gas: X}` with a fixed stipend), or wrapped so failure records a claimable balance instead of reverting the flow. Never `try/catch` on a path that `eth_estimateGas` will route around (ANIMA gotcha).

**Lessons for us.** IPSEITY already moves money by pull (`owed`/`earned`). Extend: settlements in WorkEscrow/AgentMarket/RevenueRouter that push ERC-721/1155 to a counterparty use `transferFrom` or a claim ledger; LayerZero `lzReceive` must never call out to a token-controlled address; messaging must not invoke recipient contracts.

### 2.12 Storage layout, diamonds, proxies

- **ERC-7201 (Final, fetched):** `slot = keccak256(abi.encode(uint256(keccak256(id)) - 1)) & ~0xff`, annotated `@custom:storage-location erc7201:<id>`; "the contract developer is responsible for implementing the pattern." Diamond facets that declare a plain state variable collide at slot 0 (ANIMA has a test that slots 0–2 are empty — keep it).
- **CPIMP campaign, 2025 (OZ rewind):** industry-wide front-running of proxy initialisation with backdoors. ANIMA's and IPSEITY's "no upgrade path, no diamondCut, constructor-wired" stance removes this class entirely; MASTER's "changed immutable code requires a new deployment" is the same stance. The merge must not reintroduce an initializer.

### 2.13 Messaging spam and DoS

No on-chain messaging protocol was *exploited* in 2024–2026 in the sources found; the live problem is economic. Base added and raised a protocol minimum gas price from Dec 2025 and spam's share of gas fell from ~26% to <9% (arXiv 2604.00234, unverified figures); Monad charges by gas limit rather than gas used; Farcaster rents storage units (~$7/unit/year, 5,000 casts per unit, pruned when over cap — docs/press). The lesson is that **the price of a message must be set by the protocol, not just by the chain**: IPSEITY's `Parley` caps bodies at `MAX_BODY = 1024` and requires `mayActAs(token)`; ANIMA's `AgentComms` prices attention; GARDEN's `SocialCartridge` has per-room `cooldown` and moderation. Spam here is two problems: (a) log volume that makes clients slow (mitigated by one token = one voice, back-linked `prev` pointers so clients walk single blocks, not ranges); (b) harassment (mitigated by priced DMs, allow/deny lists keyed to custody epoch, and bodies that are never rendered as HTML).

---

## 3. What leading projects do, with numbers

| Project / standard | What they do | Number |
|---|---|---|
| tokenbound AccountV3 | depth-1 cycle guard, lockable, state counter, ERC-1271 via `_isValidSigner`, registry `0x000000006551c19487814612e58FE06813775758`, v0.3.1 recommended | unbounded nested-owner walk |
| ERC-7739 | nested EIP-712 rehash for ERC-1271, magic `0x77390001` | created 2024-05-28 |
| Permit2 | `invalidateNonces` (≤2^16 per call), `lockdown` batch revoke; ERC-721 operators in PR #171 | — |
| LayerZero V2 | `UlnConfig` required/optional DVNs, library pinning | KelpDAO 1-of-1 → $292M (2026-04-18) |
| Uniswap v4 | permission bits in low 14 address bits; `onlyPoolManager`; `BaseHook`/`SafeCallback` | Cork $11–12M (2025-05-28), Bunni $8.4M (2025-09-02) |
| Balancer v2 | directional rounding broke in `_upscale` | $125–128M (2025-11-03) |
| OpenZeppelin ERC-4626 | virtual shares (decimal offset) | ~1000× harder inflation |
| Four.meme | v3 migration with `amountMin = 0`, pre-launch transfer bypass | ~$183k (Feb 2025), ~$120–130k (Mar 2025) |
| pump.fun | privileged withdraw authority on curves | ~$1.9M of $45M (2024-05-16) |
| Base / Monad / Farcaster | min gas price; charge by gas limit; storage rent | spam share 26% → <9% (unverified) |
| OpenSea | sandboxed iframe for `animation_url` HTML | (practice, unverified detail) |

---

## 4. Concrete specs the merged protocol should adopt

```solidity
// 1. Custody epoch is the root of all delegated authority.
mapping(uint256 tokenId => uint64) custodyEpoch;          // bumped in _update
function revokeAllApprovals() external;                    // bumps approvalEpoch[msg.sender] (ANIMA)
function panic(uint256 id) external;                       // owner|guardian: bump custodyEpoch, seal Reach, pause

// 2. Every signed object (EIP-712), minimum fields:
struct Grant { uint256 tokenId; uint64 epoch; address target; bytes4 selector; uint256 cap; uint64 expiry; uint256 nonce; }
// domain: name, version, chainId, verifyingContract — never a "cross-chain" domain without chainId.

// 3. Account ERC-1271 (ERC-7739):
function isValidSignature(bytes32 hash, bytes calldata sig) external view returns (bytes4); // 0x1626ba7e, with
// isValidSignature(0x7739…7739, "") == 0x77390001; session keys always return 0xffffffff.

// 4. Cycle guard in onERC721Received: depth-1 (self) and depth-2 (token whose account owns our owner) → revert OwnershipCycle().
// 5. Bounded owner walk: for (uint256 i; i < 8; ++i) { if (!isERC6551Account(o)) break; ... } else revert TooDeep();

// 6. Launchpad graduation:
function graduate(uint256 launchId) external nonReentrant;   // permissionless; no withdraw authority exists
// inside: if (factory.getPool(a,b,fee) != 0) { require(|poolPrice - curvePrice| <= tol) } ; mint with amountMin = expected * (1 - 10 bps)
// pre-launch token: transfer/transferFrom/permit all revert unless from == launchpad; recipient != predicted pool.

// 7. Hook:
modifier onlyPoolManager; function beforeInitialize(...) { require(launchpad.isOurs(key)); }
// permission bits asserted in a test against getHookPermissions().

// 8. LayerZero: constructor sets peers and UlnConfig(requiredDVNCount >= 2, confirmations >= chain-appropriate), pins send/receive libs; no setter afterwards.

// 9. Transient slots: bytes32 constant T_LOCK = keccak256("x.transient.lock") - 1; cleared on every exit.

// 10. Website: ERC-5219 request() serves CSP meta; all strings via Web.esc / textContent; gating on chain via mayActAs(token, msg.sender).
```

---

## 5. The security checklist for OUR unified protocol

Grouped by component. Each line names the lesson it comes from.

### A. The token and transfer hook
- [ ] `_update` on every transfer: bump `custodyEpoch[id]` and `approvalEpoch[seller]`, clear guardian/lease/policy/operators/session grants/room moderator roles, force `Paused`. (ERC-6551 fraud section; ANIMA invariant 1.)
- [ ] Locked (`lockCount || disputeCount`) tokens cannot transfer or burn; only allow-listed modules may lock. (ANIMA invariant 2–3.)
- [ ] `isApprovedForAll` reads the epoch-keyed store; `_isAuthorized` depends on it. (ANIMA invariant 4.)
- [ ] `AgentCore`/`Lease` struct field order is append-only (ERC-5646 fingerprint). (ANIMA.)
- [ ] Mint: counters updated before `_safeMint`; `nonReentrant`; no `block.*` randomness for rarity; commit-reveal with post-window blockhash or VRF if rarity exists. (HypeBears / NextGen #1154; Meebits.)
- [ ] No `tx.origin`, no `extcodesize == 0`, no "EOA-only" assumptions anywhere. (EIP-7702, POT, Gana.)
- [ ] No initializer, no proxy, no `diamondCut`, no owner over the routing table; constructor-wired facets; facet `animaConfigHash()` equality asserted. (CPIMP; ANIMA.)
- [ ] Slots 0–2 of the diamond are empty; all state ERC-7201 namespaced. (ERC-7201.)

### B. The vault (Reach + Grip)
- [ ] Grip has **no outbound function**; test asserts no selector on it can move an asset. (IPSEITY.)
- [ ] Reach: `onERC721Received` depth-1 and depth-2 cycle check; bounded root-owner walk. (ERC-6551 §Ownership cycles; AccountV3.)
- [ ] ERC-1271 with ERC-7739 rehash; session keys never valid for 1271; `state()` bumps on every execution. (Alchemy 2024; ERC-7739; ANIMA invariant 3.)
- [ ] Session grants: expiry, spend cap, `(target, selector)` allowlist, per-grant storage key derived from `(tokenId, epoch, keyHash)` — not a shared key. (Quantstamp session-key finding via press — unverified; ToB mistake 3.)
- [ ] If ERC-4337: `execute` only from EntryPoint/self; signature binds `userOpHash` incl. gas fields; validation stateless; `postOp` minimal; 7702 initialise only as self with `owner == 0`. (ToB 2026-03-11.)
- [ ] Seal/lock are ratchets: cannot be shortened; balance-measurement enforcement, not enumeration. (IPSEITY; EIP-6551 "account-level locking".)
- [ ] Any share-based accounting (bond vault, revenue pools) uses virtual shares or dead shares; fuzz at 0/1/2/9 wei. (ERC-4626 inflation; ResupplyFi; zkLend.)

### C. The swap
- [ ] Curve anchors are recomputed only on `openMarket`/`deposit`/`withdraw`/`syncCurve`, never in a swap. (IPSEITY, fuzz-caught extraction bug.)
- [ ] Every swap carries `minOut` and `deadline`; exact-value patterns for rents/buys. (IPSEITY; Four.meme `amountMin = 0`.)
- [ ] Rounding direction named at every call site; `mulDivUp/Down` only; round-trip-never-profits fuzz across extreme balances. (Balancer v2; Bunni.)
- [ ] Hooks: `onlyPoolManager` on all 14 entry points; `beforeInitialize` allow-lists our `PoolKey`s; `hookData` treated as untrusted; no non-essential code on withdraw path; permission bits asserted; fuzz nested callbacks and malicious tokens; temporary state keyed by `PoolId`+caller. (Cork; ToB 2026-07-30.)
- [ ] Pin the Uniswap periphery/hook base version and track upstream security commits (Cork was one commit behind).
- [ ] Fee-on-transfer / reverting / 7702-delegated tokens: balance-delta accounting, pull-based payouts.

### D. The launchpad
- [ ] No privileged withdraw/pause authority over curve funds; graduation permissionless and deterministic. (pump.fun.)
- [ ] Graduation verifies or refuses a pre-existing pool; real `amountMin`s; LP minted atomically. (Four.meme Feb 2025.)
- [ ] Pre-launch tokens non-transferable by every path; launchpad refuses predicted pool/pair recipients. (Four.meme Mar 2025.)
- [ ] Snipe tax decays by time, has **no exemptions**; per-address and per-tx caps in the first N blocks; creator allocation only via vesting locks. (HAWK; Pons.)
- [ ] `quoteBuy` == `buy` math; curve rounding favours the curve. (ANIMA invariant 5.)
- [ ] LP recipient fixed at creation; permanent-liquidity option burns or timelocks LP. (ANIMA `lpRecipient`; GARDEN permanent settlement.)
- [ ] Launch terms signed by creator are EIP-712 with tokenId, epoch, chainId. (§2.2.)

### E. Messaging / social
- [ ] One token = one voice; `mayActAs(token, msg.sender)` on every write; invitations and moderator roles keyed to custody epoch. (IPSEITY Parley; MASTER consent binding.)
- [ ] Body length cap (`MAX_BODY`), per-room cooldowns, priced DMs; bodies are bytes rendered as text, never HTML or JSON-spliced. (Parley; AgentComms; GARDEN Social; XSS class.)
- [ ] Logs carry `prev` pointers; clients walk single blocks; no indexer dependency. (Parley.)
- [ ] Cross-chain federation: no admin, peers and ≥2-of-N DVN config fixed at construction; `allowInitializePath` gates lanes; `lzReceive` never calls out to token-controlled code. (KelpDAO; ParleyPort.)
- [ ] Encryption claims documented honestly: MLS has no formal audit in our build; metadata (timing, membership) is public. (MASTER SECURITY.md.)

### F. The website (ERC-5219 / tokenURI)
- [ ] All chain/user strings through `Web.esc`/`Web.jsonEsc`; browser side `textContent` only; nothing unescaped into SVG/JSON. (Sigil `z<-z2+c`; marketplace XSS.)
- [ ] Pages ship a CSP meta; no inline event handlers; no `javascript:` links; social links validated as `https://` with a host allowlist.
- [ ] Artwork routes served by the router, not by pages. (IPSEITY Premises.)
- [ ] Wallet "verification" is a view; every privileged action re-checks on chain. SIWE (EIP-4361) with nonce/domain/chainId/expiry, ERC-1271/7739 for bound accounts.
- [ ] `tokenURI` `data:` page assumes a sandboxed, opaque origin with no wallet; it links to the web3:// surface for anything that needs a signer.
- [ ] The engine's gzip loader declares nothing at global scope; `freeze()` is one-way; `recover-record` checks deployed bytes. (IPSEITY traps 1, 9, 6.)
- [ ] Reads degrade with `try/catch` **and** `extcodesize` (satellites may not exist on every chain); "zero" and "no answer" are never collapsed. (IPSEITY.)

### G. Cross-cutting / operations
- [ ] Transient storage: one slot per purpose, hashed slot ids, cleared on every exit; post-call zero-slot test. (SIR; EIP-1153.)
- [ ] Protocol-driven NFT transfers use `transferFrom` or pull; gas-capped external calls; no `try/catch` on estimate-gas paths. (Revert Lend #443; ANIMA gotcha.)
- [ ] All signatures: EIP-712 with chainId + verifyingContract + nonce + tokenId + epoch; no chain-agnostic domains. (Symbiotic; ToB mistake 4.)
- [ ] Deployment records store full LayerZero `UlnConfig`, hook salts, facet hashes; a `recover-record` diff is part of CI. (LayerZero docs "default rotation"; IPSEITY trap 6.)
- [ ] Deployer key is a burner per deployment; owner functions renounced or timelocked after setup; never a key in the repo. (ANIMA live-chain note; pump.fun insider.)
- [ ] Monitoring that correlates related txs across blocks and chains, with a pause that cannot touch custody. (Balancer/BlockSec recommendation; Cork paused in 4 min.)
- [ ] Two independent audits of the *deployed* commit plus fuzz/invariant campaigns; Bunni and Cork were audited and still lost. (Halborn; Cork.)

---

## 6. Special ideas

1. **A `panic()` the marketplace can see.** One call that bumps every epoch, seals the Reach, and emits `Panicked(id, epoch)`; marketplaces and our own site show the token as "sealed since block N" — turning ERC-6551's fraud problem into a buyer-visible guarantee (an order can require `custodyEpoch == X && sealedUntil >= T`).
2. **State-snapshot orders.** Implement the EIP-6551 suggestion literally: a sale order includes `state()` of the Reach and a Grip holdings hash; settlement reverts if either changed. No other TBA project exposes this on its own market.
3. **Graduation proof.** Emit the terminal curve price and the pool's `sqrtPriceX96` at graduation in one event, so the site can show "migrated at the curve price" — the Four.meme failure made into a feature.
4. **Snipe tax with a public, immutable schedule** (no allowlist, ever), plus a first-N-blocks per-address cap; publish the schedule in the launch NFT's metadata so bots and humans see the same rule.
5. **Transient-slot registry test.** A single test that enumerates every `T_*` constant across all contracts, asserts uniqueness, and asserts all are zero after each external call — the cheapest insurance against a SIR-class bug in 16 contracts.
6. **DVN-config attestation in the token's own site.** The web3:// console reads `getAppUlnConfig` live and shows "this mirror is verified by N independent DVNs" — the KelpDAO lesson surfaced to users, and a config drift becomes visible on the page.
7. **Message bodies as content-typed bytes with a 1 KB cap and a per-token spam bond**: a sender's first message to a non-follower posts a refundable micro-bond released by the recipient's reply or expiry — priced attention (ANIMA) merged with Farcaster-style rent, with no indexer.
8. **"The UI cannot be patched" as a selling point, with a CSP baked in**: document the Bybit case and show the page's CSP and the frozen engine hash in the console footer.

## 7. Open questions

- ERC-6551 is still under review; AccountV3 has no bounded owner walk. Do we adopt the canonical registry (`0x…5758`) for compatibility or deploy our own with a bounded walk and depth-2 cycle check? (Compatibility vs. griefing.)
- The on-chain site needs a real origin for wallet connection. Which gateway origin model do we standardise on (per-contract subdomain vs. local gateway), and does the per-contract origin mean all tokens' consoles share one origin (so one XSS is every token's XSS)?
- Snipe tax without exemptions vs. creator allocations: do we allow any creator allocation at all, and if so only via vesting locks?
- LayerZero: fix DVN set at construction (no admin, cannot recover from a DVN going offline) or allow a timelocked owner to rotate DVNs (admin risk)? Which DVN operators exist on every chain we target?
- ERC-4337 or not: the ToB list shows the account surface is large. Do bound accounts need 4337 at all when the holder already has a wallet, or is session-key + relayer enough?
- Commit-reveal is only needed if ids carry rarity. Do they, in the merged design, or do we keep IPSEITY's deterministic bands?
- The 47% 1-of-1 OApp figure and the Robinhood Chain/Pons extraction figures could not be verified against primary sources; they shape policy but not design.
