# Research brief — the unified on-chain NFT protocol

Consolidated from twelve researcher reports, 2026-10-03. Programme goal: merge four repositories (IPSEITY / `Most-Advanced-NFT-Possible`, ANIMA / `Cutting-edge-technologically-advanced-NFT`, `MASTER-NFT-PROJECT`, `Pixel-Garden`) into one ERC-721 whose holder gets, inside the token, a swap, a messaging/social layer, a launchpad and a vault; whose `tokenURI`/`web3://` surface *is* the web app; no server, no IPFS, no indexer.

**Sources.** All twelve reports under `scratchpad/research/` were read in full: `r-accounts`, `r-social`, `r-launchpads`, `r-swaps`, `r-vaults`, `r-gating`, `r-agents`, `r-nft-standards`, `r-security`, `r-prior-art`, `r-privacy-chains`, and `r-onchain-delivery` (present by the time §3–4 were written, timestamped 00:36; re-checked unchanged before this brief was finished). Claims are attributed in square brackets; URLs and dates are those the reports carried; a report's **unverified**/secondary flags are kept. Where reports disagree, the disagreement is stated and resolved in §6 and the appendix. Statuses as read on 2026-10-02/03; addresses copied from EIP text or project deployment pages (two chain-verified, noted).

---

## 1. State of the art, 2026, per topic

### 1.1 Delivering a web app from chain [r-onchain-delivery, r-prior-art]

**Storage.** SSTORE2 (code-as-storage) is the only sane home for 100–300 KB: code deposit **200 gas/byte**, runtime ceiling **24,576 bytes (EIP-170)** on mainnet, Base, OP Stack and Arbitrum One. **EIP-7954** (24 → 64 KiB code, 48 → 128 KiB initcode; Review) is Scheduled for Inclusion in Glamsterdam (EIP-7773) with only **Sepolia epoch 353,024 = 2026-10-06 13:53:36 UTC** decided; mainnet undecided. **EIP-7907** was removed from Fusaka at ACDE #216 (2025-07-18) and rewritten 2026-09-29 (PR #12398) as metering-only; not in Glamsterdam. **EOF** is in neither fork. Solady `SSTORE2` (`write`, `writeCounterfactual` CREATE2, `writeDeterministic` CREATE3, `read(pointer,start,end)`) already accepts pointers to 65,534 bytes; its STOP prefix means readers slice from byte 1 (IPSEITY once shipped shards "with two bytes of init code glued to the front"). Prior art to copy as technique, not dependency: EthFS `FileStore 0xFe1411d6864592549AdE050215482e4385dFa0FB` (Ethereum, Base, OP, Shape, Zora; `createFileFromSlices`) and scripty.sol v2 (`ScriptyBuilderV2 0xD7587F110E08F4D120A231bA97d3B577A81Df022`; audit **unverified**). Sources: eips.ethereum.org/EIPS/eip-7954, -7773, -7907; github.com/Vectorized/solady; github.com/frolic/ethfs; github.com/intartnft/scripty.sol (fetched 2026-10-03).

**Delivery.** `tokenURI` → `data:application/json;base64` → `animation_url` as `data:text/html;base64`, stored gzip and inflated by `DecompressionStream("gzip")` (Baseline since May 2023). Browser `data:` limits (512 MB / 2 GB) never bind; two rules do: top-level navigation to `data:` is blocked, and `data:` documents have an **opaque origin**. Brotli/zstd decoding is Chromium-only (**unverified**); ERC-7618 allows `Content-Encoding: br` on the `web3://` path with gateway-side inflation. IPSEITY measured: 173,261 B source → 113,379 B minified → **39,501 B gzip, 3 shards**; `tokenURI()` **19.99 M gas / 103,808 B**; `tokenURIAt(id,1)` 3.32 M / 8,096 B; `tokenURIs()` 37.06 M; the same page over ERC-5219 `/token/1/live` **4.48 M gas / 54,432 B** — a 4.5× gap, the strongest argument for `web3://` as primary surface.

**The read budget is the real limit.** geth `--rpc.gascap` default **50,000,000** (erigon/reth 50 M, nethermind 100 M; hosted providers "often lower", **unverified**). **EIP-7825** (Fusaka, mainnet 2025-12-03 epoch 411,392) caps a transaction at **2^24 = 16,777,216 gas**; Base enforces the same. geth #32625 exempted `eth_call`, but **geth #35838 (2026-09-29)** reports that after the Amsterdam/EIP-8037 implementation `eth_call` is capped at ~16.76 M (open; PR #35845). Design every view, `tokenURI` included, under 16,777,216 gas; ERC-7617 chunks above it.

**The `web3://` stack.** ERC-4804 (Final, 2022-02-14) scheme; ERC-6860 (Draft) grammar `web3://[userinfo@]contractName[:chainid][pathQuery][#fragment]`, `resolveMode()` (selector `0xDD473FAE`) → `"auto"`/`"manual"`/`"5219"` (ERC-6944, Draft); **ERC-5219** (Final, 2022-07-10) `request(string[] resource, KeyValue[] params) view returns (uint16 statusCode, string body, KeyValue[] headers)`, read-only by design; ERC-6821 (ENS `contentcontract`, ERC-3770 `base:0x…`), ERC-7087 (MIME), ERC-7617 (`web3-next-chunk`), ERC-7618 (encoding), ERC-7774 (`Cache-Control: evm-events` + `ClearPathCache(string[])`). Gateways: `w3link.io` lists **Base mainnet** (not Base Sepolia); `w3eth.io` mainnet+ENS; `ethstorage/web3url-gateway` self-hostable. Clients: `web3curl`, a Firefox add-on, a Chrome MV3 extension with "no support for wallet connections via `window.ethereum`", EVM Browser. **No mainstream browser speaks `web3://` natively.** EthStorage's verifier work **caught a public gateway injecting a `<script>` into HTML pages** (web3-url-verifier, 2025–26).

**Who can connect a wallet where.** Brave injects no provider into `data:`/`file:` contexts or sandboxed frames without `allow-same-origin`; MetaMask **PR #46186 (2026-09-04, Draft)** keeps injecting into opaque-origin frames but **refuses the connection**; OpenSea: HTML `animation_url` supports "Scripts … but browser extensions are not"; Rainbow #1616 open. Three reports agree: **inside any marketplace frame or `data:` document, nothing can be signed.** The `tokenURI` document is a viewer; the app lives on the real origin `web3://` gives through a gateway. Blobs (EIP-4844) are pruned after ~18 days and are not EVM-readable — never for code.

### 1.2 Wallet gating and ownership verification [r-gating, r-security, r-social]

"Holding is never login" (IPSEITY ruling, 2026-08-23). Discover providers with **EIP-6963** (Final; freeze announced details, icons via `<img>`, `rdns` spoofable), `eth_accounts` for quiet reconnect, `eth_requestAccounts` only on a gesture, chain compared before any button, then ask the token by free `eth_call`:

```solidity
uint16 constant R_HOLD=1; R_ACCOUNT=2; R_USE=4; R_CUSTODY=8; R_ROLE=16; R_DELEG=32;
function rightsOf(uint256 id, address actor, bytes32 right) external view returns (uint16 bits, uint64 epoch, address holder);
```

Bits, not booleans; **custody (ERC-721 approval) is separate from use**. ERC-4907 (Final; `userOf` zero when expired, cleared on transfer) and ERC-7432 (Final; `Role{roleId,tokenAddress,tokenId,recipient,expirationDate,revocable,data}`, id `0xd00ca5cf`) give renter and role bits; **delegate.xyz v2** `0x00000000000000447e69651d841bD8D104Bed493` (immutable, CREATE2 on 30+ chains, `checkDelegateForERC721`) gives the cold-to-hot bit, read with try/catch **plus** `extcodesize`. Every write re-enforces the bits; `custodyEpoch` is the serverless session invalidator — nothing in `localStorage`, closing the tab is logout.

**Signatures, when the product needs one** (never "login"): **ERC-6492 → ERC-1271 → `ecrecover`**; in the browser via viem's deployless validator (also ERC-8010 for 7702 accounts — draft, page 404'd 2026-10-02); on chain only at settlement via ANIMA's `ERC6492.sol`. OpenZeppelin's `SignatureChecker` branches on `code.length`, and a 7702 EOA has 23 bytes of code, so "no code ⇒ EOA" is wrong everywhere. Accounts need **ERC-7739** (Draft): Alchemy's 2023-10-27 disclosure showed LightAccount, Kernel, Biconomy, Soul, Ambire, OKX, Argent all honouring a shared owner's signature *for a different account* (Permit2/CoW replay); the opposite failure, coinbase/smart-wallet #176 (2026-08-25), deadlocked a Coinbase Smart Wallet used as a Safe ≥ 1.4.1 owner because `replaySafeHash()` ran *inside* `isValidSignature`. Bind the account in the signed payload; never mutate the verifier's hash; test as a Safe owner. On SIWE (ERC-4361, Final): `r-gating` and `r-security`'s record (Scam Sniffer 2025: **$83.85 M, 106,106 victims**; Permit/Permit2 38 % of ≥ $1 M cases; 7702 batch $2.54 M) say add no signing prompt for login; `r-social` wanted a SIWE-shaped gate — resolved in §6.

**Batching.** EIP-5792 (Final): `wallet_getCapabilities`, `wallet_sendCalls`, `wallet_getCallsStatus` codes 100/200/400/500/**600 = partial revert**; MetaMask on nine chains via 7702 upgrade.

**Passkeys.** RIP-7212 (Final): P-256 at precompile `0x100`, **3,450 gas** on L2s (OP, Base, Arbitrum, Polygon, zkSync, Linea, Scroll, Unichain…); **EIP-7951** (Final, Fusaka) the same I/O at the same address on L1 for **6,900 gas** — `r-gating`'s "not on mainnet" note predates Fusaka. Neither rejects malleable signatures; enforce low-S, `UV`, `webauthn.get`, challenge bound to account/chain/nonce/calldata (CertiK 2026-06-16). On a gateway page the WebAuthn `rpId` is the gateway host. Fallback: daimo `p256-verifier 0xc2b78104907F722DABAc4C69f826a522B2754De4` (200–400 k gas).

### 1.3 Accounts [r-accounts, r-security, r-vaults, r-prior-art]

**ERC-6551** (Review; created 2023-02-23). Registry `0x000000006551c19487814612e58FE06813775758`, via Nick's Factory `0x4e59b44847b379578588920cA78FbF26c0B4956C` — **chain-verified** (Ethereum block 18,432,800, 2023-10-26). Proxy = 1167 header + implementation + footer + salt + chainId + tokenContract + tokenId = **181 bytes**; `token()` read from bytecode (so a TBA cannot be a 7702 delegate). Interface: `token()`, `state()`, `isValidSigner → 0x523e3260`, ERC-165/1271; `execute(to,value,data,operation)` ids `0x6faff5f1`/`0x51945447`. Tokenbound v0.3.1 `AccountProxy 0x55266d75D1a14E4572138116aF39863Ed6596E7F` / `AccountV3 0x41C8f39463A868d3A88af00cd0fe7102F30E44eC`: 1967 proxy behind the 1167 proxy, Guardian-upgradeable, **depth-1 cycle guard only, unbounded nested-owner walk**; audits cited but not located (**unverified**). Spec security sections (drain-then-sell; ownership cycles) are handled by the repos (IPSEITY `OwnershipCycle()`, ANIMA `_update` epoch roll + `Paused`). **ERC-7656** (Final, 2024-03-15): `create/compute(impl, salt, chainId, bytes12 mode, linkedContract, linkedId)`, 183-byte proxy, factory `0x76565d90eeB1ce12D05d55D142510dBA634a128F`; four reports reach for it as the per-token satellite factory.

**ERC-4337** (Final). **EntryPoint v0.9 `0x433709009B8330FDa32311DF1C2AFA402eD8D009`** (2025-11; ABI-compatible with 0.7/0.8; `initCode` ignored if the account exists; `handleOps` only from an EOA top-level — the fix for a griefing issue disclosed 2026-02-05); v0.8 `0x4337084d9e255ff0702461cf8895ce9e3b5ff108`. Trail of Bits (2026-03-11): unprotected `execute`; signature not bound to gas fields; storage writes in validation; 1271 without domain binding; reverts after validation still pay; 7702 init races.

**EIP-7702** (Final; Pectra **2025-05-07**). Indicator `0xef0100‖address`; `chain_id = 0` tuples valid everywhere; `tx.origin == msg.sender` no longer means EOA. BundleBear **54.6 M live delegations**; Wintermute: >97 % to "CrimeEnjoyor" sweepers at end-May 2025; USENIX '26: **>63 % malicious, $2.36 M stolen**. Known-good delegates: MetaMask `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B`, Calibur, `SemiModularAccount7702`, `Simple7702Account`.

**Modular accounts and delegations.** ERC-7579 and ERC-6900 both still **Draft**; ERC-7484 registry `0x000000000069E2a187AEFFb852bF3cCdC95151B2`. Every 2024–25 module-host audit found an install-path bug (Safe7579 C1 counterfactual-address theft; Nexus M-01 hook bypass in enable mode; MAv2 EOA-as-module). **ERC-7710** `redeemDelegations(bytes[] ctx, bytes32[] modes, bytes[] calls)` and **ERC-7715** `wallet_requestExecutionPermissions` (Draft) ship only in MetaMask (≥ v13.23, smart-account users); its Delegation Framework (`DelegationManager 0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3`) had two Diligence **criticals** (Feb–Mar 2025) where a streaming enforcer checked only `value`. Smart Sessions' docs warn a session with no permissions allows *any* transaction. **ERC-7821** (Draft) `execute(bytes32 mode, bytes)`; **ERC-7913** (Final, 2025-03-21) `verify(bytes key, bytes32 hash, bytes sig) → 0x024ad318`, signers as `verifier‖key`. The four repos already have custody epochs, sealed vaults, bounded `grantSession`, "session keys never sign 1271", no upgrade path; the gap is interface conformance.

### 1.4 Vaults [r-vaults, r-security]

**Baseline: the three-chamber model two repos converged on independently.** IPSEITY `GripVault` / Pixel-Garden `GripAccount`: a second 6551 account that *receives and cannot spend* — no `execute`, `withdraw`, sweep, rescue, owner or admin; `isValidSigner`/`isValidSignature` return `bytes4(0)`; `state()` constant 0; `supportsInterface` omits `0x51945447`. The Reach (`IpseityAccount`) acts, with a **seal** that is ratchet-only, ≤ `MAX_SEAL = 365 days`, survives sale, enforced by *measurement* (snapshot ether and a ≤ 16-entry manifest, revert `Shrank`) and by refusing the approval family while sealed (a `MEASURED` flag once packed in bit 255 of the snapshot let a hostile token walk 1,000 tokens out — now its own array). ANIMA: `AgentAccount` per-tx/daily/lifetime session caps, `auditRoot`, guardian may only pause; `BondVault` (unbonding stays slashable; slashed value to the harmed party); `RevenueRouter` (2-day policy delay, stale on transfer). MASTER: `TimeVault` (cliff/linear, 10-year ceiling, beneficiary = NFT account), `VestedExitVault`.

**Standards.** ERC-4626 (Final): rounding toward the vault; `preview*` manipulable, `convert*` oracle-safe; inflation attack defeated by OZ virtual shares, though OZ #5223 shows offset 0 still lets a large donor profit. **Resupply 2025-06-26, $9.56 M** (empty vault, 1 wei of shares, `1e36/price` floors to 0); Venus ZKsync Feb 2025. ERC-7540 (Final): async redeem; `preview*` MUST revert; a controller with no claim path strands assets. ERC-7575 (Final): share externalised (`share()`/`vault(asset)`, ids `0x2f0a18c5`/`0xf815c03d`). **ERC-7878** (Final, 2025-02-01): `setWill/announceObit/cancelObit/bequeath`, moratorium ≥ 30 days. ERC-6982/7066 (Final): `approve` MUST revert while locked. ERC-5095 **unverified**. ERC-7535 says prefer WETH.

**Succession and recovery.** Every serious design separates "silent for N" from "gone" with a cancellable window: IPSEITY `Succession` (quiet 30–3,650 d, notice 7–365 d, void on transfer, heir may be "whoever holds token N"), 7878's 30 days, Cruna's 7656 inheritance plugin, DeadSwitch's 30-day delay. **Loopring 2024-06-09, ~$5 M**: one centralised guardian. Candide recovery audit M1: other modules can take ownership. For a token-bound vault recovery *is* a transfer of the token, so succession and recovery collapse into one steward. The hole no repo closes: **approvals granted by the account** live in asset contracts, do not bump `state()`, and transfer to the buyer (OneKey 2025-10-16).

**Spending limits.** Every system bounds a key by time window, per-asset cap, period reset (Safe Allowance divide-by-zero finding), target/selector allowlist, and what it may sign (Rhinestone scopes 1271 via 7739; ANIMA forbids it). Multisig belongs outside: `ownerOf` can be a Safe. Yield: the seal measures shares, so a sealed 4626 position compounds inside it; "principal locked, yield spendable" is the PT/YT split.

### 1.5 Swaps [r-swaps, r-security]

**Uniswap v4** (DefiLlama 2026-10-02: TVL $867.8 M, Base $46.95 M; 30-day volume $21.03 B, Base $967 M; cumulative fees $334 M, Base $91 M; protocol revenue $0). Hook permissions are the low 14 address bits (`BEFORE_SWAP_FLAG = 1<<7`, `…RETURNS_DELTA_FLAG = 1<<3`); hooks immutable per pool; addresses CREATE2-mined — IPSEITY `Kiln.mine` does it as a `view` under `eth_call`. MASTER's `OfficialV4SwapRouter`/`QuoteLens` show the minimal direct-`PoolManager` shape and **quote-by-revert** (`QuoteResult(spent, received)` from the real settlement path).

**What broke.** **Cork 2025-05-28, ~$11 M** (`beforeSwap` without `onlyPoolManager`; `PoolKey` unvalidated). **Bunni v2 2025-09-02, $8.4 M** (rounding wrong across the *composition* of `withdraw` and `queryLDF`; 44 dust withdrawals). **Balancer v2 2025-11-03, $125–128 M** (`_upscale` down vs `_swapGivenOut` up, since 2021). **0x, 2026-09-14**: of **84,163 hooks**, 19.4 % safe, **54.2 % malicious**, 26.4 % likely — quote spoofing up to 50 %. Uniswap Foundation's framework puts a custom curve holding liquidity in the **High** tier (two formal audits incl. a math specialist); Trail of Bits (2026-07-30) lists seven classes and eight rules; the `hooklist` schema is the minimum venue metadata.

**Intents and aggregators.** UniswapX orders are off-chain; **ERC-7683** (Draft) was **rewritten 2026-02-06** into a resolver model — the `IOriginSettler` ABI in production is the superseded draft; CoW accepts **ERC-1271 and `PRE_SIGN`** (`setPreSignature`), so a TBA can authorise a batch-auction exit on chain; 0x Settler has no standing allowances; **Odos shut all APIs 2026-07-30** (secondary). Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`. **MEV on Base**: arXiv 2609.28115 (2026-09-23) found **1,889 sandwiches on protected order flow on Base** (an RPC pending-tx leak); Flashbots Protect is mainnet-only. Base DEX 30-day: Aerodrome 48.8 %, Uniswap 28.3 %. What still has a reason to exist: IPSEITY's **owned market per token** — holder sole LP; curve from the artwork but **anchored** (recomputed only on `openMarket/deposit/withdraw/syncCurve`; per-trade derivation was a real fuzz-caught extraction bug); bond ratchets; pause never halts withdrawal; no oracle/TWAP/flash loans. Verdict: owned pool + ownerless router with a constructor-pinned venue set; no aggregator; **not a v4 hook in v1**.

### 1.6 Launchpads [r-launchpads, r-security]

Four families: curve → graduation (pump.fun, Virtuals, ANIMA `AgentLaunchpad`); single-sided v4 position + hooks (Clanker, Zora, Bankr, Flaunch); Dutch-auction curve (Doppler); continuous clearing auction (Uniswap CCA). 2025 shifts: creator fee streams became the product (pump.fun 0.95 % → 0.05 % by market cap; Zora 50 %; Clanker 80 %; Bankr 95 % of 0.7 %); anti-sniping moved into hooks (Zora 99 % → 1 % over **10 s**; Clanker ≤ 80 % over ≤ 2 min; Virtuals 99 % → 1 % over 0–98 min; Flaunch 30-min fixed price; CCA uniform clearing); LP locking by construction (Uniswap `FeeSplitter` "irrecoverable by design"; Virtuals 10-year lock).

Shapes to copy: **Clanker v4** (`deployToken(DeploymentConfig{TokenConfig, PoolConfig, LockerConfig ≤ 7 recipients immutable BPS, MevModuleConfig, ExtensionConfig[]})`, Base `0xE85A59c628F7d27878ACeB4bf3b35733630083a9`) minus its **team allowlist**; **Doppler Airlock** (`lockPool(migrationPool)` at creation; permissionless `migrate`) minus `setModuleState` and its **BUSL-1.1**; **Uniswap CCA v2.1.0** (MIT; factory `0x000000001F26a0044BaA66024e7b6599c61963F8`; audits Spearbit/OZ/ABDK; **Aztec raised $60 M from 17,000+ bidders, no sniping detected**, Nov 2025) with its rules (tick spacing ≥ 1 bp of floor; last block must sell significantly; no fee-on-transfer; ≥ 6 decimals) and its caveat that `IProtocolFeeController` is read at application time.

Incidents → rules: pump.fun 2024-05-16 (~$1.9 M; human withdraw authority); GemPad Dec 2024 ($1.8 M; locker reentrancy); Virtuals Jan 2025 (pair pre-creatable); **Four.meme Feb 2025** (~$183 k; pool pre-initialised at `sqrtPriceX96 ≈ 1e42`, `amountMin = 0`) and **Mar 2025** (~$125 k; pre-launch tokens to the predicted pair); LIBRA Feb 2025 (~$107 M insiders); Zora "Base is for everyone" Apr 2025 (front-run); **Bankr × Grok Mar 2025** (a bot deployed 17 tokens on another AI's say-so); HAWK Dec 2024 (96 % to snipers); Robinhood Chain/Pons Sept 2026 (≥ $18.43 M, **unverified**; 32-wallet snipe-tax exemptions — a tax with exemptions is a creator rug). Headline volumes (Clanker $5.0 B, Zora $376 M, PUMP sale $500–600 M) conflict — **unverified**.

### 1.7 Messaging and social [r-social, r-privacy-chains, r-security]

**Nobody is all on chain.** XMTP (RFC 9420 MLS, NCC assessment Dec 2024) keeps ciphertext on nodes with 60-day retention, payers pay ≈ $5/100 k messages, mainnet "expected March 2026", node count **unverified**. Farcaster: identity on OP Mainnet (`IdRegistry 0x00000000fc6c5f01fc30151999387bb99a9f489b`), data on a six-validator Snapchain; storage **$7/year per 5,000 casts**; the Feb 2024 bot wave showed per-account rent is weak. Lens v3 keeps graph pointers on chain, bytes in Grove. friend.tech renounced to the null address as its shutdown (2024-09-08).

**Singletons (zero bytes of EIP-170):** ERC-7409 emotes `0x3110735F0b8e71455bAe1356a33e428843bCb9A1` (Final; supersedes 6381); ERC-5564 announcer `0x55649E01B5Df198D18D95b5cc5051630cfD45564` and ERC-6538 registry `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538` (Final; `registerKeysOnBehalf` accepts ERC-1271); EAS at `0x4200000000000000000000000000000000000021` on Base/OP, `0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587` mainnet, `0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458` Arbitrum. ERC-7627 (Final): `PublicKey{bytes public_key; uint64 valid_before; ECDSA|ED25519|X25519}`, `sendMessage(to, keyIndex, sessionId, bytes)` as an **event**. ERC-5630 (Draft) and MetaMask `eth_decrypt` cannot be relied on; keys are derived in the page from a wallet signature. Do not claim 7866/6239/7231.

**What the repos have.** Parley's `Said(room, from, prev, prevFrom, seq, kind, body)` back-links the previous message's *block number* so clients walk single-block `eth_getLogs`; `MAX_BODY = 1,024`. Three key registries (Parley P-256 by token; ANIMA typed incl. **ML-KEM-768 reserved**, `expectedRecipientKeyId` pinned; Pixel-Garden epoch-bound) — merge to one. Pixel-Garden's whisper (ephemeral P-256 ECDH, HKDF, AES-GCM, AAD bound to chain/ids/epochs/key versions, sender copy) says plainly it has no forward secrecy. **MASTER's `MLSGroupChat`** — immutable ordered delivery carrying real RFC 9420 (`ts-mls` 1.6.4, **unaudited**), roster snapshots, two confirmations, reorg freezes the group — is FS/PCS messaging nobody has shipped on a public chain. **EIP-4444** history expiry is live (drop day 2025-05-01; rolling window planned): thread heads and last N must live in state. Immutable bytes can be illegal bytes (Bitcoin Core v30 debate): text-only, size-capped, optionally encrypted.

### 1.8 Agent-native standards [r-agents, r-nft-standards, r-prior-art]

**ERC-8004** is **Draft** (2025-08-13; MetaMask/EF/Google/Coinbase authors) with registries live on mainnet since **2026-01-29**, identical across Ethereum/Base/Arbitrum/OP/Polygon: `IdentityRegistry 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, `ReputationRegistry 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` — **upgradeable proxies**, Validation Registry "under active revision". An agent is an ERC-721 whose `tokenURI` MAY be a base64 `data:` `registration-v1` JSON (`services[]`, `x402Support`, `registrations[]`, `supportedTrust[]`); `setAgentWallet` cleared on transfer. Xiong et al. (arXiv 2606.26028, to 2026-05-13): only **3 % / 4 % / 15 %** of registrations (Ethereum/BSC/Base) have a live endpoint; **73.5 % / 59.2 % / 90.6 %** of reviewers are Sybil-coordinated; maintainers' issue #99 moves to settlement-grounded feedback. **ERC-8217** (Draft, 2026-04-05) binds an agent id to a master NFT (`Binding{standard, tokenContract, tokenId}`, key `agent-binding`).

**ERC-7857** (Final, 2025-01-02): `iTransfer/iClone(…, TransferValidityProof[])`, TEE/ZKP verifier, off-chain "Sealed Executor", no ERC-165 id, ZKP verification `TODO`. Three reports agree with IPSEITY's `Standards.sol`: **do not claim**.

**Commerce and transport.** x402 v2 (CAIP-2, EIP-3009 `exact`, facilitator `/verify` `/settle`) under the Linux Foundation's x402 Foundation since **2026-04-02** (40 members incl. AWS, Amex, Coinbase, Google, Mastercard, Stripe, Visa; volumes **unverified**). **ERC-8183** (Draft, 2026-02-25): `Open → Funded → Submitted → Completed/Rejected/Expired`, single evaluator, `fund(jobId, expectedBudget)`, non-hookable `claimRefund`, `IACPHook`. A2A 1.0 (`AgentCard`, JWS-signed, `/.well-known/agent-card.json`). MCP 2025-11-25 (token passthrough forbidden; CVE-2025-54135/-54136 — fix is a hash-pinned catalog). llms.txt v2 (2026-08-10). SIWA + ERC-8128 (ERC-8128 text 404'd — **unverified**). AgentKit README: *"does not gate transfers behind human approval, enforce spend caps, or allowlist destinations."*

**Incidents.** **Bankrbot 2026-05-04**: an attacker *transferred a membership NFT to Grok's wallet* (holdings read as capabilities), posted Morse code, and Bankrbot executed Grok's mention; ~$150–200 k moved. ElizaOS memory injection (arXiv 2503.16248); ClawHub skill flood (Feb 2026, **unverified** counts); Olas registries June 2026 (identity↔account binding retrofitted, no loss). *Every control that mattered was on the policy layer the model cannot rewrite.*

### 1.9 NFT utility standards — decision table [r-nft-standards]

| Standard | Status | Verdict | Why |
|---|---|---|---|
| ERC-5646 fingerprint | Final | **Must** | Makes a vault-carrying NFT tradeable; ANIMA encodes `AgentCore` (order normative) |
| ERC-6551 + cycle guard | Review | **Must** | Both accounts |
| ERC-7432 roles + ERC-4907 shim | Final | **Must** | One delegation model; `userOf = recipientOf(USER)` |
| ERC-7496 traits, 4906, 7572, 7160 | Draft/Final/Draft/Final | **Must** | The site has nothing else to read; `validateOnSale` traits (SIP-15) |
| ERC-5219 + 6860 + 7774 | Final/Draft/Draft | **Must** | The website |
| ERC-5169 `scriptURI()` | Final | **Must** | Token announces its own `web3://` app; immutable location satisfies its rule |
| ERC-2981 | Final | Signal only | Enforcement voluntary by spec |
| ERC-7627 events; ERC-6909 claims | Final | Should | Parley-walkable DMs; v4-native claims |
| ERC-8004 via 8217 binding | Draft | Should (§6) | Bind, do not become the singleton |
| ERC-7498 trait redemption; 7858; 5484; 7656 | mixed | Could | Perks that never burn; expirable leases; badges |
| **ERC-721C / transfer validator** | not an ERC | **Avoid** | Auto-updating vendor policy (V5 `0x721C008fdff27BF06E7E123956E2Fe03B63342e3`); levels 5–8 reject contract receivers; **Payment Processor V2 `0x9A1D00bEd7CD04BCDA516d721A596eb22Aac6834` forged-forwarder exploit from 2026-09-24: ≥ $2.8 M stolen, 23,155 NFTs moved by whitehats, "cannot be paused or fixed"** |
| ERC-7631 dual-nature | Final | **Avoid** | Flooring/BitmapPunks 2026-06-08 packed-ownership bug |
| ERC-7857, 8126 claims | Final/"Final" (unverified) | **Avoid** | Off-chain-normative |
| 6220, 7401, 7508, 7589, 7943, 7765, 7738 | mixed | Skip | Size/relevance |

Also: Gondi 2026-03-09 (78 NFTs ~$230 k; `buy` reusing lingering approvals); SuperRare 2025-07-28 ($730 k; setter permission). *State that is not in the order is state the seller can change.*

### 1.10 Privacy and compliance [r-privacy-chains]

Privacy is now wallet-layer. **RAILGUN** (L2BEAT TVL $110.8 M; Ethereum proxy `0xfa7093cdd9ee6932b4eb2c9e1cde7ce00b1fa4b9`, also Arbitrum; Base "initialized via governance" per L2BEAT, address **unverified**; Private Proofs of Innocence; audit index **unverified**) and **0xbow Privacy Pools** (mainnet 2025-03-31; Entrypoint `0x6818809EefCe719E480a7526D76bD3e561526b46`; ASP allowlist with trustless `ragequit`; owner-upgradeable Entrypoint). EF's Kohaku SDK (May 2026, secondary) wraps both plus stealth addresses. Umbra: >350,000 stealth transactions / ~$500 M (ScopeLift 2026-02-18). arXiv 2606.25926 linked **17.65 %** of RAILGUN withdrawals by timing and amount — the UI is the weak point.

**The legal line: immutable software vs operated service.** *Van Loon* (5th Cir. 2024-11-26): immutable contracts are not "property"; Tornado delisted 2025-03-21; FinCEN 2019 §4.5.1(b): "an anonymizing software provider is not a money transmitter." But Samourai's founders got 5 and 4 years (Nov 2025) for *operating* a coordinator and taking $6.3 M in fees; Storm convicted on the §1960 conspiracy count (2025-08-06), retrial 2027-04-26 (secondary). CLARITY Act **failed cloture 49–50 on 2026-09-15** (secondary). EU AMLR Art. 79 bars CASPs from anonymity-enhancing assets from **2027-07-01** — privacy lives in the holder's account, never in a launched token. Rules: no admin, fee or relayer on privacy paths; public exits; text-only messaging.

### 1.11 Chain economics (headline; tables in §3) [r-privacy-chains, r-onchain-delivery]

Mainnet base fee **0.15–0.5 gwei** for most of 2026 (ethereum.org May 2026), gas limit **60 M** since 2025-11-25, per-tx cap 2^24. Base floor **0.005 gwei**, OP 0.001, Arbitrum ≈ 0.02 (secondary). Blob target/max 6/9 → 14/21 by Jan 2026; EIP-7918 floor. **EIP-8037** (Review, SFI Glamsterdam) reprices code deposit **200 → 1,530 gas/byte**; under the 2^24 cap a 24 KB chunk (~38 M gas) would no longer fit in one transaction — deploy L1 static assets before Glamsterdam mainnet (undecided). L2 adoption of 7954/8037 open.

### 1.12 Prior art and market [r-prior-art]

**Terraforms** (2021-12-17) is the closest thing to "the NFT mints a website": `tokenHTML`/`tokenSVG`/`tokenCharacters` public views, owner-writable canvas, `authorizeDreamer` revoked on transfer, **holder-selected renderers** from an append-only list, and `web3://terraformnavigator.eth` rendering pages from the token. **Autoglyphs** (2019; `0xd4e4078ca3495DE5B1d4dB434BEbc5a986197782`, chain-verified; byte-exact recompile published). **Nouns** Fork #0 (2023-09-15): 472 of 846 Nouns left with 16,757 ETH as book-value arbitrage. Base App treats all apps as **standard web apps after 2026-04-09**. **Redstone shuts 2026-05-15**; MUD orphaned. friend.tech ($90 M fees, $44 M to team, shut 2024-09-09), Stars Arena ($2.9 M reentrancy), Fantasy.top (shut 2026-05-20; "70 % of lifetime revenue in month one"), Virtuals (revenue −96 % Jan → Feb 2025). CryptoSlam 2025: **$5.63 B** sales (−37 %), average sale **$96**; Base $122 M.

### 1.13 Security incident record [r-security]

Six recurring classes: authority outliving the sale; callbacks that trust their caller (Cork; **SIR Trading 2025-03-30, $355 k** — one transient slot reused for two purposes; **KelpDAO 2026-04-18, $292 M** — a 1-of-1 DVN; LayerZero docs: default libraries "roll … forward without your involvement"); rounding under extreme state (Balancer, Bunni, zkLend, Resupply); pre-creatable launch state (Four.meme ×2); verification left to defaults; rendering untrusted strings (OpenSea SVG XSS 2021-09-26; IPSEITY's `z<-z2+c`). Plus **Bybit 2025-02-21, 401,347 ETH**: malicious JS in Safe{Wallet}'s S3 bundle produced a `delegatecall` that overwrote `masterCopy` — NCC's "no arbitrary delegatecall, pinned front end" conclusion is this project's thesis.

---

## 2. Prioritised adoption list

Deduplicated. Item — rationale — [reports].

### MUST

1. **ERC-6551 for both accounts (Reach acts, Grip receives-only), canonical registry, created in the mint hook, runtime hash verified** — the only standard whose address is a pure function of the token; the Grip is the only proof-by-absence argument surveyed — [accounts, vaults, security].
2. **One custody epoch per token, bumped in `_update`, that every delegated right keys off; forced `Paused`** — 6551 fraud section; ANIMA invariant 1; Terraforms — [accounts, security, prior-art, vaults, gating].
3. **ERC-5646 fingerprint over everything the buyer pays for, taken by every market `buy`/`fill`** (traits, roles, both `state()`s, locks, lease, kernel hashes, open-approval ledger); `AgentMarket.sol` does not read it today — [nft-standards, vaults].
4. **ERC-7739 on every ERC-1271; session keys never valid for 1271; `state()` bumps on execute** — Alchemy 2023; Coinbase #176 — [accounts, gating, security, swaps].
5. **ERC-6492 → 1271 → ecrecover; never infer "contract" from `code.length`; no `tx.origin`/`extcodesize == 0`** — 7702 — [gating, accounts, security, privacy].
6. **Operation 0 only; no upgradeable account, module host, `AccountGuardian`, initializer or `diamondCut`** — Bybit; module-host audits; CPIMP — [vaults, accounts, security].
7. **Two surfaces, one byte-stream**: gzip `data:` viewer with CSP that detects its opaque origin, and an ERC-5219/6944 `Premises` serving identical HTML at `web3://…/token/<id>/live`; equality in CI — [onchain-delivery, gating, security, prior-art].
8. **Every view ≤ 16,777,216 gas; ERC-7617 above; gzip + `DecompressionStream`; loader declares nothing global** — EIP-7825; geth #35838 — [onchain-delivery].
9. **24,576 bytes per contract forever; Solady CREATE3 SSTORE2 with fixed salts; one-way `freeze()`** — 7907 did not ship — [onchain-delivery, prior-art].
10. **Gate by reading**: EIP-6963 picker → `rightsOf` bits → render; contract re-enforces; no `localStorage` authority; wrong-chain refusal first — [gating, security, prior-art].
11. **ERC-7432 roles with an ERC-4907 shim; session caps in role `data`; roles roll with the epoch** — [nft-standards, gating].
12. **Sessions bounded by expiry, native + ERC-20 per-tx and per-period caps, target/selector allowlist; cannot call the account or grant sessions; defaults deny** — Smart Sessions sudo default; Diligence criticals; AgentKit — [accounts, vaults, agents].
13. **No capability granted by an adversary-controlled action**: receiving a token never changes an agent's authority — Bankrbot — [agents].
14. **Owned market per token (IPSEITY `Pool`) with `swapExactOut`; anchored curve; rounding favours the pool both ways, fuzzed at dust; withdrawal never pausable; bond ratchets; no oracle surface** — [swaps, security].
15. **Ownerless vault router: constructor-pinned venues checked by codehash, balance-delta verification, exact-approve-then-zero or Permit2 `SignatureTransfer`, per-token budgets, 6551-only access, `minOut`/`maxIn` + `deadline` + `sqrtPriceLimitX96` at our layer** — 77 % of Base volume; Base is sandwichable — [swaps].
16. **Quote by executing; never route into an unpinned hook; owned-pool quote shown beside** — 0x 54.2 % — [swaps].
17. **Launch signed by the NFT, fees to its account; fixed-supply ownerless token; v4 pool keyed to our hook initialised in the launch tx; LP to an immutable custodian with permissionless `collect` (`nonReentrant`, CEI); on-chain decaying snipe tax with no exemptions, routed to holders; fee schedule immutable ≤ 1.25 %; atomic price-faithful graduation that verifies or refuses a pre-existing pool; pre-launch tokens non-transferable by every path** — pump.fun, GemPad, Four.meme ×2, HAWK, Pons — [launchpads, security].
18. **Hooks: `onlyPoolManager` everywhere; `beforeInitialize` allowlists our `PoolKey`s; `hookData` untrusted; permission bits asserted in a test; no delta-returning hooks** — Cork, Bunni, Angstrom — [swaps, security, launchpads].
19. **Agent launches only via a session scoped to the launch selector with expiry, cap, ETH/USDC quote and per-NFT rate limit** — Bankr × Grok — [launchpads, agents].
20. **One speech predicate (owner or the token's account, never renter/operator); public speech as back-linked logs ≤ 1 KB; sealed speech bounded storage; heads and last N in state** — EIP-4444 — [social, security, privacy].
21. **One typed, epoch-bound key registry exposing the ERC-7627 view; `expectedKeyId` pinned; sealed transfer reverts if the buyer has no key** — [social].
22. **MLS over the immutable ordered-delivery contract for groups; ECIES only for first contact; public metadata documented** — [social].
23. **Use the singletons: ERC-7409, ERC-5564/6538, EAS** — same address everywhere, zero bytes — [social, privacy, nft-standards].
24. **Spam economics = holding the token + per-token cooldown + refundable postage** — [social, security].
25. **ERC-8004 identity emitted from chain (`agentId == tokenId`, `registration-v1` data URI, `setAgentWallet` cleared in `_update`); reputation only via a separate permissionless `publishFeedback(receiptId)` after settlement (no `try/catch` on estimate-gas paths); `getSummary` never unfiltered** — Sybil 59–91 %; issue #99 — [agents].
26. **Hash-pinned catalogs (Desk selectors, MCP schemas, A2A skills); bridges refuse divergence** — CVE-2025-54136 — [agents].
27. **All strings through `Web.esc`/`Web.jsonEsc`, DOM via `textContent`; CSP meta in every page; artwork routes served by the router; bodies as text** — [security, onchain-delivery, social].
28. **A hash-manifest route and a gateway-diff script in CI** — measured gateway injection — [prior-art, onchain-delivery].
29. **One ratchet rule for every chamber**: seal lengthens only (≤ 365 d), locks extend only (≤ 10 y), bond grows except by slashing, policy changes after delay and dies on sale — [vaults].
30. **One steward for succession and recovery: two triggers, one cancellable delay, `transferFrom`-only, void on transfer, strict-owner, ≥ 2 redirect guardians, no service guardian** — Loopring; 7878 — [vaults].
31. **Transient storage: one hashed slot per purpose, cleared on every exit, registry test** — SIR — [security].
32. **LayerZero lanes: peers and `UlnConfig(requiredDVNCount ≥ 2)` fixed at construction, libraries pinned, no setter, tokens never bridge, `lzReceive` never calls out** — KelpDAO — [security].
33. **No admin, fee or relayer on any privacy path; public exits** — Van Loon vs Samourai — [privacy].
34. **Immutable from day one; no team token; no pro-rata redemption; no first-month economic loop** — friend.tech, Nouns, Fantasy — [prior-art, social].
35. **Pull-based money; `transferFrom`/claim ledgers for protocol-driven NFT moves; gas-capped external calls** — Revert Lend; 63/64 — [security].

### SHOULD

36. ERC-7579/7821 execution shape (`execute(bytes32 mode, bytes)`, `supportsExecutionMode`, `accountId()`, `supportsModule → false`) — a known convention at near-zero cost — [accounts].
37. ERC-4337 as an optional path on immutable EntryPoint v0.9; EIP-712 userOp hash; never a 7702 delegate — [accounts] (r-security doubts the need; §6).
38. Session grants in ERC-7715 vocabulary with a 7710-shaped `redeemDelegations`; empty action list invalid — [accounts, vaults, agents].
39. Passkey co-signers via ERC-7913, precompile `0x100` with daimo fallback, session-scope only — [accounts, gating, privacy].
40. ERC-5792 with sequential fallback and all status codes; confirm slab; `eth_call` simulation with decoded custom errors — [gating].
41. delegate.xyz v2 in `rightsOf` with per-module `rights`, extcodesize-guarded, never for vault withdrawals — [gating, vaults].
42. Warn on connect when the holder's EOA is delegated to a code hash not on a short known-good list — [accounts, gating, privacy].
43. Open-approval ledger in the Reach, folded into the fingerprint, one-click revoke — Payment Processor, Gondi — [vaults, nft-standards].
44. Delayed exits as ERC-7540 with a cancel path; controller only owner or Reach — [vaults].
45. Permit2 `SignatureTransfer` on the swap page; never unbounded allowances; counterparty and amount in page and EIP-712 — [swaps, gating].
46. Holder-settable decaying sniper fee on the owned pool after `openMarket`/`deposit` — [swaps].
47. Three mechanisms behind one `ILiquidityDeployer` seam — instant pool, curve, CCA (MIT, pinned v2.1.0, own factory with `address(0)`/immutable controller); NFT-gated `IValidationHook`; creator vault ≤ 15 % vesting ≥ 1 y with 30-day cliff; immutable-root airdrops ≥ 1-day lock — [launchpads].
48. ERC-8183 state machine for hire/escrow with `IACPHook`; A2A card, `/.well-known/agent-registration.json`, `/llms.txt` + `.md` twins + `Link:` headers from `Premises`; SIWA for agents and SIWE-via-6551 for third parties on one gate; OASF ids; x402 `PaymentRequirements` shape for priced inboxes — [agents].
49. Mirror-register in the canonical ERC-8004 singleton with an ERC-8217 binding; discovery only — [agents, nft-standards].
50. Register each token's account on ERC-6538 at mint; fixed-enum follow rules (open/holders/paid); sender copies; Mini-App-compatible embed from `web3://` — [social].
51. ERC-7774 `ClearPathCache` on state changes; ERC-7618; ENS `contentcontract` with chain prefix; ≤ 8 KB still SVG as `image`; ERC-7496 traits so indexers skip the big URI — [onchain-delivery, nft-standards].
52. ERC-7656 as the factory for non-account satellites (steward, inbox, pool, launch slot) — [vaults, agents, accounts, social].
53. Stealth receive first; Privacy Pools/RAILGUN as adapters, never forks; viewing key doubles as messaging key — [privacy, social].
54. Deploy L1 static bytes before Glamsterdam; gas-schedule-aware deployer — [privacy, onchain-delivery].
55. Publish the solc input that reproduces every byte; `tools/verify-gateway.mjs` — [prior-art].
56. Two independent audits of the deployed commit plus fuzz/invariant campaigns; monitoring with a custody-free pause — [security].

### COULD

57. ERC-7484-attested, timelocked, holder-opted extension slot — [accounts].
58. Reserved-nonce-key replayable path for *signer management only* across bands — [accounts].
59. `resolve(bytes) view` in ERC-7683-redux terms; `setPreSignature` helper for CoW exits; sudoswap `IPropertyChecker`/GDA — [swaps].
60. Progressive bid wall; Hyperboost; super-chain same-address launched tokens; referral legs; commit-or-refund trial launches — [launchpads].
61. Commons federation via ParleyPort (room 0 only); ML-KEM-768 hybrid envelopes when WebCrypto exposes it — [social].
62. PT/YT yield routing; succession bounty; commit-reveal heir; duress heartbeat; NFT as ERC-7575 share — [vaults].
63. ERC-7498 trait-redeemable perks; ERC-7858 lease/session child tokens; `lastSettledFingerprint` trait — [nft-standards].
64. ERC-8001 intents; ERC-8126 attestations; account-signed A2A card; attenuated sub-sessions; committed workflow hash — [agents].
65. SecureSign provider emulation into the artwork iframe; holder-published pages at a per-token pointer; EthFS registration of the loader; brotli over 7618; blob/EthStorage archives labelled non-canonical — [onchain-delivery].
66. Clean-bill attestation slot; one-address-per-app sub-accounts; EIP-7708-ready "received" view — [privacy].
67. WalletConnect as the one labelled off-chain path; ERC-7846 `wallet_connect` — [gating].

### AVOID

68. Any TBA as a 7702 delegate; arbitrary 7579/6900 modules; `chain_id = 0`; enable-mode installs; the site requesting a 7702 authorisation; depending on ERC-7715 wallet support — [accounts, privacy].
69. "Sign to log in"; server nonces; cookies; auto-selected providers; trusting the gateway origin; hardcoded 1271 gas; mutating the hash in 1271; approval as use authority — [gating].
70. ERC-721C; ERC-7631; 6220/5773/7401/7508/7589/7943/7765/7738; claiming 7857, 8126, 7866/6239/7231, 7683 or "restaking" — [nft-standards, agents, social, prior-art].
71. HTTP aggregators in a bytecode page; unvetted hooks; owned pool as a v4 hook in v1; live-reading the artwork in `swap`; oracle/TWAP on the owned pool; an owner over the venue table — [swaps].
72. Team-allowlisted modules; mutable fee controllers; burning LP; off-chain anti-bot; points airdrops; updatable roots; fee-on-transfer quotes; spot at migration; tax to the launcher; Doppler core under BUSL — [launchpads].
73. Off-chain-only message homes; RLN on chain; a social token or key market; "forward secrecy" claims for ECIES — [social].
74. Keeper/Chainlink triggers; ERC-7535 unless ETH-only; single or dual-power guardians — [vaults].
75. Mixers, relayer networks, hosted front ends, fee-taking privacy routers; anonymity in launched tokens — [privacy].
76. Upgradeable pointer tables; `src="https://…"`; IPFS/Arweave fallbacks; `message/external-body`; `eval`/brotli-only loaders; aggregate reads > 16.7 M gas; blobs for durable data; EthFS/scripty as runtime dependencies; app-specific L2s — [onchain-delivery, prior-art].
77. `try/catch` on gas-estimated paths; `_safeMint` before counters; `block.*` rarity — [security].

---

## 3. Target chain recommendation

### 3.1 The numbers

Two reports computed SSTORE2 costs with different inputs; both are reproduced. `r-privacy-chains` used the gas schedule (per 24,575-byte chunk ≈ 5,368,893 gas; effective ≈ 218.6 gas/byte) at ETH ≈ $2,750 (2 Oct 2026, secondary); L2 rows are execution gas only, with the L1 data component estimated at ≈ $0.007 / $0.022 / $0.044 for 50 / 150 / 300 KB (illustrative scalars, **unverified** — a live oracle read was denied). `r-onchain-delivery` **measured Base's `GasPriceOracle` at block 52,098,952** (`baseFeeScalar 2,269`, `blobBaseFeeScalar 1,055,762`, `l1BaseFee 77,062,616 wei`, `blobBaseFee 4,809,132 wei`, L2 gas 0.006 gwei) and assumed $2,350/ETH.

**50 / 150 / 300 KB, today's schedule** [r-privacy-chains]:

| Data | Chunks | Gas | Mainnet @0.5 gwei | @5 gwei | @20 gwei | Base @0.005 gwei | Arbitrum @0.02 | OP @0.001 |
|---|---|---|---|---|---|---|---|---|
| 50 KB | 3 | 11,234,509 | **$15.45** | $154 | $618 | **$0.15** | $0.62 | $0.03 |
| 150 KB | 7 | 33,596,769 | **$46.20** | $462 | $1,848 | **$0.46** | $1.85 | $0.09 |
| 300 KB | 13 | 67,140,280 | **$92.32** | $923 | $3,693 | **$0.92** | $3.69 | $0.18 |

**Base, measured, L1 data fee included** [r-onchain-delivery]: 100 KB **0.000162 ETH (~$0.38)**; 200 KB **0.000292 ETH (~$0.69)**; 300 KB **0.000421 ETH (~$0.99)**, of which L1 data ≈ 0.5 %. Mainnet, 300 KB: 0.0105 ETH (~$25) at 0.15 gwei; 0.0349 ETH (~$82) at 0.5; 0.349 ETH (~$821) at 5 gwei. Base's L2 gas price is the volatile term (0.1 gwei "typical", 5–10 gwei in mint spikes, secondary; at 0.1 gwei, 300 KB ≈ 0.007 ETH).

**Post-Glamsterdam EIP-8037 as drafted (1,530 gas/byte)** [r-privacy-chains]: 50 / 150 / 300 KB = 79.3 M / 237.9 M / 475.7 M gas = **$109 / $327 / $654 mainnet @0.5 gwei**, **$1.09 / $3.27 / $6.54 Base**; a full 24 KB chunk (~38 M gas) exceeds the 2^24 cap, so the largest single-tx chunk falls to ≈ 10.8 KB. Today **≤ 3 chunks (~72 KB) fit in one transaction**; 300 KB needs ≥ 5 transactions.

**Typical transactions** (l2fees 2026-09-15, ETH $2,475, oracle-priced, secondary): transfer / swap — Ethereum 0.336 ¢ / 2.25 ¢; **Base 0.0314 ¢ / 0.209 ¢**; Arbitrum 0.105 ¢ / 0.697 ¢; OP 0.00543 ¢ / 0.0353 ¢. A 200 k-gas action on Base at the floor ≈ $0.003. Blob data ≈ $0.03/MB (secondary).

### 3.2 Recommendation

**Primary chain: Base. Canonical home: Ethereum mainnet. Optional third band: OP Mainnet. Not Arbitrum for data-heavy parts; never an app-specific L2.** Three reports converge independently (`r-privacy-chains` R1–R2, `r-prior-art`, `r-onchain-delivery` MUST 5):

- **Base is where the four modules' counterparties are**: Aerodrome + Uniswap ≈ 77 % of Base DEX volume; v4 `PoolManager`, Doppler and Zora present; EAS predeploy; first-party Base docs for ERC-8004, SIWA, x402, Spend Permissions; the Base App treats any `https://` gateway URL as a standard web app after 2026-04-09; `w3link.io` serves Base mainnet; sub-cent messaging; RIP-7212 at 3,450 gas. Design around: sandwichable (1,889 attacks), priority-ordered sequencer, Base Sepolia absent from the public gateway (self-host for testnet CI).
- **Mainnet is affordable for one-time writes and is the only chain with the neutrality the immutability argument needs**: ~$92 for 300 KB at 0.5 gwei; every privacy singleton and both compliance-aware pools are mainnet-first (Privacy Pools mainnet-only); *Van Loon* rewards immutability on the most neutral chain; ethereum.org's 2026 guidance names "neutrality, or high-value state". The cliff is EIP-8037: deploy L1 bytes **before** Glamsterdam mainnet.
- **OP Mainnet shares Base's fee code, oracle and EAS predeploys and EIP cadence**; Arbitrum has different fee machinery and a 4× higher floor.
- **Two or three bands, not five**, with a written "band orphaned" rule (Redstone).

**Keep the IPSEITY band model — disjoint id ranges per chain, no token bridge** (`r-security`, `r-prior-art`, `r-social`: a mirror with no custody is a mirror whose worst case is a lie, not a theft; KelpDAO's $292 M was a bridge). The website and every satellite are deployed at the **same CREATE3 address on every band**; ENS `contentcontract` points at the canonical surface.

| Mainnet (band 0, canonical) | Base (band 1, primary) and OP (band 2) | Reasoning |
|---|---|---|
| Band registry, ENS name, canonical `contractURI` and hash manifest | Mint waves, owned-pool swaps, launchpad (v4, CCA), messaging logs, EAS attestations, agent escrow | 200 k gas ≈ $0.003 on Base vs ≈ $0.80 on mainnet at 0.5 gwei; log-only social only works at L2 prices |
| A small high-value band; Privacy Pools / RAILGUN adapters (Privacy Pools mainnet-only; RAILGUN Base address **unverified**) | The bulk of the edition; all agent-facing tokens | Neutrality for custody; throughput and counterparties on Base |
| Engine bytes deployed once, before Glamsterdam | Same bytes, same address | Same-origin-everywhere; L1 copy must beat EIP-8037 |
| Mirror registration in the canonical ERC-8004 registry (mainnet since 2026-01-29) and Base's | Reputation writes where escrow settles | Discovery keys on canonical addresses; correctness never depends on them |

Cancun transient storage and the 2^24 cap hold on all three; verify P-256 per band (mainnet 6,900 gas via EIP-7951; Base/OP 3,450); measure hosted-RPC `eth_call` caps before fixing the `tokenURI` budget.

---

## 4. Special things nobody else does — the 15 best ideas

**1. Fingerprint-bound trades with an open-approval ledger.** `getStateFingerprint(id)` (ERC-5646) is the order id for the market, consignment, lease and launch allocation: `AgentMarket.buy(id, agreed, fingerprint)` recomputes at settlement and reverts on mismatch. It covers 7496 traits, 7432 roles, both accounts' `state()`, lock/dispute counters, lease, kernel hashes and a new **open-approval ledger** in the Reach: any `execute` carrying an approval-family selector (`approve`, `increaseAllowance`, `setApprovalForAll`, both `permit`s, Permit2) records `(asset, spender)`; the buyer revokes in one batch; an order can require the set empty. SIP-15 does this for traits only, 6551 for account state only; nobody closes the "approval-based transfers do not change account state" gap. Defensible: Payment Processor V2 and Gondi *were* lingering approvals. [nft-standards, vaults]

**2. `panic()` and seal-as-listing.** `panic(id)` — owner or pause-only guardian — bumps `custodyEpoch[id]` and `approvalEpoch[owner]`, seals the Reach to the maximum, forces `Paused`, emits `Panicked(id, epoch)`. Listing on the in-protocol market *is* a seal to the listing's expiry, so the buyer's floor is enforced by the account, not promised by the venue (6551 mitigation #4, automatic). Traits render "sealed since block N / until T"; an order may require `custodyEpoch == X && sealedUntil ≥ T`. No TBA project exposes this on its own market; it is the button a drained user wishes they had. [security, vaults, prior-art]

**3. The self-verifying site.** `Premises.request(["manifest"])` returns `keccak256(body)` per route plus shard hashes; `/token/<id>/hash` returns the assembled-document hash; `contractURI` carries the engine hash; `tools/verify-gateway.mjs` fetches via `w3link.io`/`web3gateway.dev` and diffs against local `eth_call`; the console footer shows "verified against chain at block N". EthStorage proved the demand by catching gateway injection; nobody ships the hash inside the token; it costs one view. [prior-art, onchain-delivery]

**4. One website, same address on every band — and a shell that lends the artwork a wallet.** Premises and every chunk via Solady `writeDeterministic` under fixed salts, so `web3://0xSAME:1/`, `:8453/`, `:10/` all resolve; ENS `contentcontract` (ERC-6821) points at the canonical band; ERC-5169 `scriptURI()` returns that URL. On the live origin the page hosts its own `tokenURI` artwork in a sandboxed iframe and emulates an EIP-6963 provider into it over `postMessage` (SecureSign, arXiv 2511.14611): the same bytes a marketplace shows inert become interactive, every request passing the parent's confirm slab. Three boot modes — opaque origin (viewer + "open live" + QR), gateway `https`, native `web3://` — with "zero" and "no answer" never collapsed. No collection publishes a cross-chain-identical origin. [onchain-delivery, nft-standards, gating]

**5. The agent card is minted with the token.** `tokenURI` emits, hash-pinned from chain state, the ERC-721 metadata, an ERC-8004 `registration-v1` (`services[]` = the token's `web3://` routes, its 6551 account, `supportedTrust`), a nested A2A `AgentCard` and an MCP-shaped catalog derived from on-chain selectors — ERC-7160 face 3. `Premises` serves `/.well-known/agent-registration.json`, `/.well-known/agent-card.json`, `/llms.txt`, `/token/<id>/llms.txt` with `.md` twins and `Link:` headers. Bridges refuse a catalog whose hash differs from `manifestOf(id)` — MCP rug pulls impossible by construction. ERC-7656 counterfactual addresses let the card list a token's swap/vault/launch/inbox endpoints before deployment. No collection ships an agent identity complete at mint. [agents, nft-standards, prior-art]

**6. Agent-safe by construction.** Two test-enforced invariants. (a) *Receiving any token never changes an agent's authority*: holdings unlock viewing and human actions; value movement needs a holder-signed, ERC-7715-shaped, deny-default `grantSession` to a named key — the Bankrbot class cannot occur. (b) *Every reputation record provably could not exist without a settlement here*: `WorkEscrow.settle`, `BondVault.slash` and voucher settlement emit receipts; a permissionless `publishFeedback(receiptId)` writes `giveFeedback` tagged `escrow-released` / `bond-slashed` / `voucher-settled`, `feedbackHash` bound to the receipt, rated agent bound separately from payee; settlement never depends on the upgradeable registry. Exactly what 8004's maintainers ask for in issue #99 and what the Sybil study found missing. [agents]

**7. "Quote is a settlement" plus a venue manifest.** Every external quote is an `eth_call` to a stateless `QuoteLens` that runs the real `unlock → swap → settle/take` path and reverts with `QuoteResult(spent, received, sqrtPriceAfter)`; the owned pool's pure `quote()` is shown beside it. The router's immutable venue table is printed on each token's site in `hooklist` schema (address, codehash, permission bits, upgradeable?, audit URL) for a buyer to diff against Uniswap's deployments. After 0x's finding, "this swap cannot show a price it could not have settled at this block" is a claim only a bytecode site can make. [swaps]

**8. The curve is the artwork; the bond is a promise the art keeps.** Keep the orientation-derived, anchored, holder-gated curve; surface `bondedUntil` as an ERC-7496 trait marked `validateOnSale` so marketplaces show "market frozen until <date>"; add a holder-settable Zora-style decaying sniper fee on `openMarket`/`deposit` (no oracle, no server); let the social layer feed a visible, auditable curve parameter applied only on explicit actions. Selling the token sells the market and its fee income; the renter exploit that forced anchoring is already fuzz-caught; there is no oracle surface to attack. [swaps, prior-art]

**9. Sell the NFT, sell the streams — and the sniper tax raises the floor.** `launch(LaunchTerms)` from the token's account deploys a fixed-supply `Coin`, initialises a v4 pool keyed to our hook in the same transaction, places up to seven positions, sends the LP NFT to an immutable custodian whose permissionless `collect(poolId)` pays `accountOf(nftId)`, and records immutable terms (creator/LP/protocol BPS; snipe ≤ 9,900 bps decaying over ≤ 98 min; `noSwapBlocks`; vault cliff/duration; airdrop root). Because every fee pays the token's account and `_update` revokes prior authority, the whole launch portfolio changes hands with one transfer — Flaunch's Memestream NFT and Uniswap's `BeneficiaryVault` without a second NFT. The decaying tax routes into the launched token's ERC-7641-style redemption treasury, so every sniping bot raises every holder's floor; no exemption list, ever. `graduate()` emits the terminal curve price and the pool's `sqrtPriceX96` together — Four.meme made into a feature. [launchpads, security]

**10. The NFT is the KYC.** For CCA launches an `IValidationHook.validate(bid)` admits only bids owned by a holder or holder-authorised account, with per-NFT caps and optional bond/reputation thresholds. A 4,096-piece edition with a secondary price is a Sybil cost no CAPTCHA matches — the barrier Aztec needed ZK Passport for, delivered by the collection; one small contract against the pinned MIT CCA v2.1.0 factory with our own `address(0)` fee controller. [launchpads]

**11. The inbox that ships with the token.** One typed, epoch-bound key registry (ANIMA's types incl. the ML-KEM-768 slot; Pixel-Garden's epoch binding; `expectedKeyId` pinned; ERC-7627 view). On transfer the seller's key dies; the buyer sees a provably fresh inbox plus the public archive — reputation moves, mail does not. Private groups run real RFC 9420 over MASTER's immutable ordered-delivery contract ("sealed rooms" with a visible epoch counter; two confirmations; reorg freezes); ECIES only for first contact. Stealth drop box: the 6551 account registers an ERC-6538 meta-address via `registerKeysOnBehalf` + ERC-1271, so any Umbra/Fluidkey wallet can already pay it privately, and the same mechanism delivers sealed envelopes to a stealth-keyed room with an ERC-5564 `announce`; the viewing key doubles as the messaging key. Nobody has transferable social identity whose sealed history severs cleanly, or FS/PCS messaging on a public chain. [social, privacy]

**12. Priced attention into the vault; reactions every wallet can read.** The holder sets `postage` and `replyWindow`; a stranger's first message escrows postage (bounded by `maxPostage` against mempool repricing), released to the token's account on reply or refunded on expiry — `AgentComms` for humans, Farcaster-style rent without a server, and the money lands where the swap can use it. Reactions call the ERC-7409 singleton with `(collection, tokenId, emoji)` for tokens and a synthetic `uint256(keccak256(room, seq))` for posts, so marketplace tooling sees "💎 × 412". Zero bytes of our budget; interoperable on day one. [social, security]

**13. Clear-signing from chain, and 7702 hygiene on connect.** Because Desks compute selectors on chain, ship an on-chain calldata decoder per selector and render "you are about to: swap 1.0 ETH → ≥ 2,400 USDC via this token's pool, slippage 0.5 %" from the same contract that executes it; the confirm slab shows To / Value / Function and the calldata digest; CSP and the frozen engine hash sit in the footer. On connect, read `eth_getCode(holder)`; if it starts `0xef0100`, name the delegate, compare its codehash to a small on-chain known-good list (MetaMask `0x63c0…`, `Simple7702Account`, `SemiModularAccount7702`, Calibur) and the CrimeEnjoyor hash, and withhold spend buttons behind an unknown delegate until acknowledged. The Bybit mitigation as a product; the first collection that tells holders their EOA is delegated to a sweeper. [accounts, gating, vaults, privacy]

**14. Passkey sessions.** The Reach stores extra signers as ERC-7913 `verifier‖key`; a P-256 verifier calls `0x100` (6,900 gas mainnet after Fusaka; 3,450 on Base/OP) with a daimo fallback (Safe's `uint176` packing). A passkey is only ever a *session* signer — expiry, cap, allowlists, dies on sale — never the holder key; `UV`, low-S, `webauthn.get`, challenge bound to account/chain/nonce/calldata enforced on chain. A first-time user mints from a phone and registers the passkey in the same transaction; afterwards chat and small swaps run on Face ID with no wallet pop-ups. No new privilege: the authority model is the existing bounded session. [accounts, gating, privacy]

**15. The steward.** One ERC-7656-linked `Steward` per token replaces Succession + recovery: two triggers (silence past `quiet` → heir may `summon`; ≥ 2-of-N guardians → a pre-written recovery address), one `notice` window (default 30 days, ERC-7878's floor) the owner can cancel in, `transferFrom` as its only capability, void on transfer, strict-owner, no service guardian (Loopring). Heir may be "whoever holds token N" (`toToken`), so estates chain through instruments; the heir is stored as `keccak(heir, salt)` and revealed at `summon`; a second heartbeat `stillHereUnderDuress` silently maxes `notice` and sets a flag only the heir's page renders (DeadSwitch's roadmap item); a capped bounty from the Reach pays whoever executes a matured transfer; `getWill`/`getObit` views make it ERC-7878-legible. Moving the token moves everything — the structural advantage no inheritance product has. [vaults]

---

## 5. Security checklist

Testable items; ★ = already enforced by a test in one repo and must survive the merge.

### A. Token, transfer hook, layout
- [ ] ★ `_update` bumps `custodyEpoch[id]` and `approvalEpoch[seller]`, clears guardian/lease/policy/operators/sessions/roles/revenue policy/succession/bound and agent wallets, forces `Paused`; test: no seller authority survives (6551 fraud; ANIMA inv. 1).
- [ ] ★ Locked tokens cannot transfer or burn; only allowlisted modules lock (ANIMA inv. 2–3).
- [ ] ★ `isApprovedForAll` reads the epoch-keyed store; `revokeAllApprovals` O(1) (ANIMA inv. 4; PPv2).
- [ ] ★ `AgentCore`/`Lease` append-only; fingerprint covers every mutable property; mutation test per property (ERC-5646).
- [ ] Cycle guard: refuse `to == account(id) || to == grip(id)`; `onERC721Received` depth-2 check; owner walk ≤ 8 hops (6551; AccountV3).
- [ ] Mint: counters before `_safeMint`, `nonReentrant`, deterministic bands, no `block.*` rarity (HypeBears; Meebits).
- [ ] No `tx.origin`, `extcodesize == 0`, "EOA-only"; tested with a 7702-delegated holder (POT, Gana).
- [ ] ★ No initializer, proxy, `diamondCut` or routing owner; `deriveFacetCut` strict; `animaConfigHash()` equal; slots 0–2 empty; ERC-7201 (CPIMP).
- [ ] Every contract ≤ 24,576 bytes on every band, gated in CI.

### B. Accounts and vault
- [ ] ★ Grip: every selector enumerated, none moves an asset; `0x51945447` not advertised; `state()` = 0 (IPSEITY #39–40).
- [ ] ★ Reach `execute` operation 0 only; no delegatecall path (Bybit; IPSEITY #36).
- [ ] ERC-7739 (`0x7739…` → `0x77390001`, `contentsName` sanitised); session keys → `0xffffffff`; passes as a Safe ≥ 1.4.1 owner (Alchemy 2023; Coinbase #176).
- [ ] ★ Seal ratchets only, ≤ 365 d, survives sale, measurement-enforced, `MEASURED` flags separate, approval family refused (IPSEITY #35).
- [ ] Session storage keyed `(tokenId, epoch, keyHash)`; empty action list reverts; no self-call, no sub-grant; period divisor non-zero (Smart Sessions; Safe Allowance).
- [ ] If 4337: `execute` only from EntryPoint v0.9/self; `userOpHash` incl. gas fields; validation touches own storage; `postOp` minimal; never a 7702 delegate (ToB).
- [ ] Passkeys: low-S, `UV`, `webauthn.get`, bound challenge; precompile-or-fallback (CertiK).
- [ ] Share accounting uses virtual shares and a seeded locked deposit; 4626 positions valued by `convert*` with a floor; fuzz at 0/1/2/9/2^64/2^128 wei (Resupply; OZ #5223).
- [ ] ERC-7540 exits have a cancel path; controller ∈ {owner, Reach}.
- [ ] Steward: `transferFrom` only; void on transfer; redirect guardians ≥ 2; no zero-guardian init; one count per guardian per nonce (Loopring; ZK Email).
- [ ] Open-approval ledger records every approval selector; a foreign reverting `approve` does not block the call.
- [ ] `panic()` kills every delegated right in one call (tested).

### C. Swap
- [ ] ★ Curve anchors only on `openMarket/deposit/withdraw/syncCurve`; `curveWord` never a live read.
- [ ] ★ `testFuzz_roundTripNeverProfits` extended to `swapExactOut`, the launch curve and share math, at dust and after manipulation (Bunni; Balancer).
- [ ] Only `mulDivUp`/`mulDivDown`; direction named per call site; `quote` and `swap` share one pure function (Balancer; ANIMA inv. 5).
- [ ] `minOut`/`maxIn`, `deadline`, real `sqrtPriceLimitX96` enforced by us; balance-delta checks; input measured on arrival.
- [ ] ★ Pause never halts withdrawal; bond never shortens; `setFee` blocked under bond.
- [ ] Router: `extcodehash(venue)` pinned; hookless or pinned-codehash `PoolKey`s; exact-then-zero approvals; token-denominated budgets; transient reentrancy guard; no owner; opt-ins cleared by the epoch roll.
- [ ] Hooks: `onlyPoolManager` on all 14 entries; `beforeInitialize` rejects foreign `PoolKey`s; `hookData` untrusted; nothing non-essential on the withdraw path; state keyed by `PoolId` + caller; bits asserted vs `getHookPermissions()`; nested-callback and malicious-token fuzz; periphery pinned (Cork; Angstrom; ToB).
- [ ] No oracle/TWAP; no v4 adapter in v1.

### D. Launchpad
- [ ] No withdraw/pause authority over curve funds; `graduate` permissionless, `nonReentrant` (pump.fun).
- [ ] Pre-existing pool price must match the curve's terminal price or revert/re-salt; real `amountMin`s; LP minted atomically; both prices emitted (Four.meme Feb).
- [ ] Pre-launch tokens non-transferable via every path; predicted pool/pair recipients refused (Four.meme Mar).
- [ ] Snipe tax time-decaying, **no exemptions**; first-N-block caps; creator allocation only via vesting locks (HAWK; Pons).
- [ ] Fee BPS immutable per launch, ≤ 1.25 %; retroactive-change test (Bankr; CCA controller caveat).
- [ ] Custodian: `nonReentrant`, CEI, no token-callback trust, permissionless `collect` to the NFT's account; address in the launch record (GemPad).
- [ ] CCA: own factory, immutable/zero fee controller; integration rules enforced; `IValidationHook` ERC-165.
- [ ] Agent launches only via scoped sessions; first launch of an agent needs a guardian co-sign (Grok).
- [ ] Launch terms EIP-712 with tokenId, epoch, chainId, verifyingContract, nonce.

### E. Messaging and social
- [ ] ★ `mayActAs(token, msg.sender)` on every write; invitations and moderator roles epoch-keyed (Parley; MASTER).
- [ ] Body caps (≤ 1,024 B public, ≤ 4,096 B sealed); per-room cooldown; postage with `maxPostage`; bodies as text only.
- [ ] `prev` and per-kind back-links; single-block walks; heads and last N in state; no indexer in any fixture (EIP-4444).
- [ ] Key registry typed, epoch-bound, `expectedKeyId` pinned; sealed send reverts on rotation or missing key.
- [ ] MLS: one-use KeyPackages, roster cap, expected epoch/index, bound AAD, two confirmations, reorg freezes; `ts-mls` unaudited stated in docs.
- [ ] Presigned emotes with minute-scale deadlines; announcer use rate-limited per token.
- [ ] Federation: no admin, ≥ 2-of-N DVNs at construction, lanes gated, `lzReceive` never calls out, groups/pairs never cross chains (KelpDAO).

### F. Website and delivery
- [ ] ★ `tokenURI` bytes equal the live route; `resolveMode()` returns `"5219"` and is never removed; artwork served by the router (IPSEITY).
- [ ] Every view ≤ 16,777,216 gas in CI; aggregate reads removed or chunked (EIP-7825; geth #35838).
- [ ] Loader declares nothing global; reserved-globals list maintained; `freeze()`/`sealRenderer()` one-way; `recover-record` diffs bytes (IPSEITY traps).
- [ ] ★ All strings through `Web.esc`/`Web.jsonEsc`; `textContent` only; `Sigil.NAMES` escaped; display names valid UTF-8.
- [ ] CSP meta (`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src <rpc>`); no `javascript:`; `https://` host allowlist; no external `src`; no `eval`.
- [ ] Surface detection: opaque origin → viewer only; gateway → EIP-6963 picker, no auto-select, no stored authority; rights recomputed on account/chain change.
- [ ] Optional dependencies (delegate.xyz, EAS, 8004 singleton, absent satellites) degrade via `try/catch` **and** `extcodesize`; "zero" ≠ "no answer".
- [ ] Hash-manifest route and gateway-diff script in CI; engine hash in `contractURI`.

### G. Agents
- [ ] Test: transferring any token to an agent's account changes no authority (Bankrbot).
- [ ] Reputation only via `publishFeedback(receiptId)`; `getSummary` always filtered; rated agent ≠ payee binding (issue #99).
- [ ] Catalog hashes on chain; bridges refuse mismatch (CVE-2025-54136).
- [ ] `setAgentWallet` needs the EIP-712/1271 proof and is cleared in `_update`; the singleton is never a correctness dependency.
- [ ] MCP bridges never pass wallet tokens or session keys through (MCP security page).

### H. Privacy, cross-chain, operations
- [ ] No admin, fee or relayer on stealth/shielded paths; every shielded adapter has a third-party-free exit (Van Loon; `ragequit`).
- [ ] Launched tokens carry no anonymity features (AMLR Art. 79).
- [ ] Transient slots hashed, single-purpose, cleared on every exit incl. revert; registry test (SIR).
- [ ] All signatures EIP-712 with chainId + verifyingContract + nonce + tokenId + epoch; a spend signature from one band is invalid on every other (Symbiotic).
- [ ] Deployment records hold `UlnConfig`, hook salts, facet hashes, chunk addresses, gas assumptions; `recover-record` in CI; burner deployer; owner functions renounced/timelocked; no key in the repo.
- [ ] Gas-schedule-aware deployer refuses post-8037 chunks over the 2^24 cap.
- [ ] Two independent audits of the deployed commit; fuzz/invariant campaigns; cross-chain monitoring with a custody-free pause (Cork; Balancer).

---

## 6. Open questions needing a human decision

1. **Band layout** — five chains vs two or three. *Recommend*: mainnet (small canonical band) + Base (primary) + OP (optional), disjoint ids, no bridge, a written "band orphaned" rule. [privacy, prior-art, security]
2. **Token of record** — `r-privacy-chains` (canonical on mainnet) vs `r-onchain-delivery` (Base first). *Recommend*: the band model resolves it — each token lives on one chain; mainnet's band is the high-value one; engine bytes on all bands before Glamsterdam.
3. **Canonical 6551 registry or our own.** *Recommend*: canonical `0x…5758` for compatibility; the depth-2 check and bounded walk live in our implementation.
4. **ERC-4337 on the account** — `r-accounts` SHOULD vs `r-security`'s doubt. *Recommend*: a facet/companion with an immutable v0.9 EntryPoint, never a 7702 delegate.
5. **SIWE** — `r-social` MUST 7 vs `r-gating` AVOID. *Recommend* `r-gating`: no login signature; SIWE only via the 6551 account with ReCaps when a third party needs proof; fixed `domain` string + `resources` naming the token; wallet-compatibility test.
6. **ERC-8004: be the registry vs bind** — `r-agents` vs `r-nft-standards`. *Recommend* both: keep ANIMA's native interface (`agentId == tokenId`) and mirror-register in the canonical singleton with an ERC-8217 binding; confirm whether 8004scan/SIWA index non-canonical registries (if not, the mirror is MUST).
7. **ERC-7857 now that it is Final.** *Recommend*: no claim; rename MASTER's reference.
8. **Doppler (BUSL-1.1).** *Recommend*: no — own curve + CCA (MIT) + instant pool unless a written licence grant exists.
9. **CCA fee controller.** *Recommend*: own factory, `address(0)`/immutable controller, pinned v2.1.0 bytecode hash; forfeit canonical addresses.
10. **Launch economics** — 1.00 % vs 1.25 %; ETH vs ETH + USDC; LP-compounding leg. *Recommend*: 1.00 %, ETH + USDC, no compounding leg in v1.
11. **Creator allocation.** *Recommend*: ≤ 15 % via Locks/`VestingSales`, ≥ 30-day cliff, ≥ 1-year vest; never a tax exemption.
12. **Agent-initiated launches.** *Recommend*: first launch per agent needs a human guardian co-sign; thereafter scoped sessions with per-NFT limits.
13. **Owned pool as a v4 hook later.** *Recommend*: not v1; keep the interface adapter-ready; decide who funds two High-tier audits before writing one.
14. **Aerodrome in the venue set.** *Recommend*: defer until a primary read of its upgradeability; launch with v3 pools + hookless v4.
15. **Posting intents to CoW/UniswapX from the page.** *Recommend*: allowed as a labelled optional path; contracts never do it; keep `setPreSignature`.
16. **Sealed envelopes: storage vs logs.** *Recommend*: logs for public speech, bounded storage (≤ 4,096 B) for sealed DMs and keys; measure on Base before freezing caps.
17. **MLS library.** *Recommend*: ship `ts-mls` with the caveat in-product; budget a WASM evaluation of an audited library; no KeyPackages at mint.
18. **Dependency-rule exceptions** — delegate.xyz, WalletConnect. *Recommend*: delegate.xyz as an extcodesize-guarded read in a satellite; WalletConnect only as a labelled fallback the `data:` surface never advertises.
19. **Passkeys as holder key.** *Recommend*: never; session scope only.
20. **Succession numbers.** *Recommend*: `notice` default 30 d, minimum 14; `MIN_QUIET` 30 d regardless of value.
21. **Seal semantics.** *Recommend*: shares by default; `FLOOR_ASSETS` only per allowlisted asset with a rate limit.
22. **LayerZero DVN set** — fixed at construction vs timelocked rotation. *Recommend*: fixed, ≥ 2-of-N independent operators on every band; a dead lane is a dead commons mirror, never a custody loss.
23. **Glamsterdam timing.** *Recommend*: deploy L1 bytes as soon as the engine freezes; waiting costs 7×.
24. **Canonical gateways and the shared-origin problem** (all consoles under one host share one origin). *Recommend*: document `w3link.io` + self-hosting; carry a gateway list in the token's bytes; CSP + escaping; investigate per-contract subdomains.
25. **Legal copy.** The 2026-03-17 SEC/CFTC "digital collectibles" interpretation is **unverified**; pump.fun faces a RICO suit. *Recommend*: no positioning relies on it; fixed on-chain disclaimer; never promote a specific launch.
26. **Numbers to re-measure before any doc quotes them**: XMTP totals/node count, EAS totals, 8004 agent counts, x402 volume, Clanker/Zora/Flaunch volumes, PUMP sale size, Tokenbound audits and TBA population, delegate.xyz counts, OP `GasPriceOracle` scalars, RAILGUN's Base address, Pons figures, the 47 % 1-of-1 OApp figure, hosted-RPC `eth_call` caps.

---

### Appendix — cross-report reconciliations

- **P-256 on mainnet**: `r-gating` ("not on mainnet") is superseded by `r-accounts`/`r-onchain-delivery` (EIP-7951 in Fusaka, 2025-12-03, 6,900 gas).
- **SIWE**: `r-social`'s local login narrowed to `r-gating`'s read-gating model.
- **ERC-8004 posture**: native registry (`r-agents`) and 8217 binding (`r-nft-standards`) combined (§6.6).
- **Chain of record**: `r-privacy-chains` vs `r-onchain-delivery` reconciled through id bands (§3).
- **Cost tables**: different ETH prices ($2,750 vs $2,350) and L1-data assumptions (computed vs measured); both reproduced with inputs.
- **Statuses agreed across reports**: ERC-7579/6900/7739/7821/7710/7715/8004/8183/8217/7496/7572/6860/6944/7774 Draft; ERC-6551 Review; ERC-7913/7656/7878/7627/7409/5564/6538/5646/7432/4907/5169/5219/4804/4626/7540/7575 Final; ERC-7857 Final but not to be claimed.
