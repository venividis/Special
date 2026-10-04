# Dossier: ANIMA — `Cutting-edge-technologically-advanced-NFT`

Repository: `/home/user/Cutting-edge-technologically-advanced-NFT` (GitHub `venividis/Cutting-edge-technologically-advanced-NFT`), default branch `main` at `e345828` ("Merge pull request #42", 2026-09-16). 99 commits between 2026-08-22 and 2026-09-16; 45 remote refs (44 branches besides `main`). Unaudited. Deployed and exercised on five testnets (Base Sepolia twice, Sepolia, Unichain Sepolia, Robinhood testnet, BSC testnet) plus a LayerZero round trip to OP Sepolia; every deployer key is destroyed or publicly disclosed, so the live deployments are evidence, not infrastructure.

This dossier consolidates seven research reports (core token and diamond; account and registries; market, economy and work; comms, omni, SDK, scripts and docs; web app and CLI; branch survey 1–15; branch survey 16–44) and verifies the facts that matter most against the checkout. Every number below was either measured from `artifacts/` (solc 0.8.28, viaIR, optimizer runs 200, evmVersion cancun) or re-counted from the files; where the project's own docs disagree with the measurement, the measurement wins and the drift is noted.

Reuse verdicts are relative to the unified GOAL — one ERC-721 whose holder gets, inside the token, a swap, a messaging/crypto-social layer, a launchpad and a vault; the token "mints a website" served from chain; a visitor connects a wallet, is verified as holder or holder-authorised, and then uses all of the above; no server, no IPFS — not relative to ANIMA's own goal.

---

## 1. Identity and thesis of the project

ANIMA is an **agent-native ERC-721**: one token is one complete, economically accountable AI agent. The token carries an identity (ERC-8004 registration on the token itself, with a manifest URI and its keccak commitment set in one call), a wallet (a derived ERC-6551 token-bound account whose *session keys* are leashed by an on-chain `AutonomyPolicy`), private state (an ordered hash chain of encrypted "brain" shards with a verifier-certified re-key on sale), a declared model, a published autonomy policy, and — in sibling registry modules — a slashable bond, customer-attested reputation, independent validation, verified off-chain handles and ERC-7432 roles. Around that core sit a signed-order market with integrity pins, a bonding-curve launchpad that issues a floor-backed per-agent ERC-20, a budgeted swap router, a leverage leash, a priced-attention messaging contract, a hire-to-settle escrow, a payment-channel meter, a timelocked revenue waterfall, and a LayerZero V2 escrow bridge. 27 deployable contracts; 279 tests.

The thesis is stated repeatedly and consistently in the code's own narrative comments: an agent whose guarantees can be revoked by an admin key has no guarantees, so **the token is immutable twice over** — a 23,971-byte monolith sitting 605 bytes under EIP-170, and the same token as an **EIP-2535 diamond with no `diamondCut`**, facets wired in the constructor, routing table owned by nobody. The two builds are *proved* equivalent: the whole suite runs unchanged against either (`ANIMA_IMPL=diamond`), the facet cut is derived mechanically from the monolith's ABI and the derivation throws on any unrouted, duplicate or extra selector, and a gas test fails the build if the diamond's per-call overhead drifts.

The second thesis is **accountability converts "trust me" into a number**: a bond bounds an agent's maximum lie by its own capital; reputation only counts when a settlement module attests that the reviewer actually paid, weighted by what was at stake; validation requests expire, are answered once, by the validator named up front; and every authority an owner grants (operators, session keys, lease, guardian, policy, bound wallet, roles, handles) is **structurally voided by a sale** rather than remembered to be revoked.

What ANIMA is *not*, relative to the GOAL: it does not mint a website. `tokenURI` returns a stored string (`contracts/core/AnimaAgent.sol:360-363`, verified). The on-chain UI is a separate ERC-4804 manual-mode contract that imports `viem` from `esm.sh` at runtime and gates nothing by holder; the primary UI is a GitHub Pages site. There is no AMM of its own: the "swap" is a router over an allowlisted external venue, and the launchpad graduates into an abstract `ILiquidityDeployer` of which only a mock exists. So ANIMA contributes to the unified protocol chiefly as **infrastructure and discipline** — the immutable diamond, the authority-revocation semantics, the leashed account, the settlement libraries, the economic modules and an unusually candid security record — rather than as the site or the pool.

---

## 2. Architecture

### 2.1 Text diagram

```
                       ┌────────────────────────────────────────────────────────────────┐
                       │  THE TOKEN  (two provably equivalent builds)                   │
                       │                                                                │
   monolith build      │  AnimaAgent.sol  23,971 B  (83 ABI functions)                  │
                       │    ERC-721/2981/4906/4907/5192/5646/6454/7572 + ERC-8004 id    │
                       │    _update: sale revokes operators/guardian/lease/policy/wallet │
                       │    epoch-keyed operators + time-boxed approvals                 │
                       │    lockCount / disputeCount gate transfer AND burn              │
                       │    brain shards (BrainLib hash chain) + verifier re-key         │
                       │    accountOf(id) = REGISTRY.account(IMPL, SALT, chainid, this, id)
                       ├────────────────────────────────────────────────────────────────┤
   diamond build       │  AnimaDiamond 177 B  (constructor + fallback; NO diamondCut)   │
                       │    ├─ AnimaCoreFacet   9,946 B  38 selectors  ERC-721, locks,  │
                       │    │                                  approvals, admin levers  │
                       │    ├─ AnimaAgentFacet 15,052 B  34 selectors  identity, policy,│
                       │    │                                  wallet, lifecycle, lease │
                       │    ├─ AnimaBrainFacet 15,758 B  11 selectors  mint, brain,     │
                       │    │                                  transferWithBrain        │
                       │    └─ AnimaLoupeFacet  1,731 B   4 selectors  EIP-2535 loupe   │
                       │    AnimaBase (sealed _update / isApprovedForAll / tokenURI)    │
                       │    AnimaStorage  ERC-7201 "anima.storage.core"                 │
                       │    DiamondStorage ERC-7201 "anima.storage.diamond"             │
                       │    AnimaInit (delegatecalled once; selector never routed)      │
                       │    per-facet immutable AnimaConfig, hash-checked at construct. │
                       └───────────┬──────────────────────────┬─────────────────────────┘
                                   │ setModule(...)           │ accountOf / isController / statusOf / policyOf
                 lock / unlock /   │                          │
                 setDisputed /     │                          ▼
                 moduleSetUser     │        ┌──────────────────────────────────────────┐
                                   │        │ AgentAccount (ERC-6551 clone, 10,709 B)   │
                                   │        │  owner: unrestricted                      │
                                   │        │  session keys: per-tx / daily / lifetime  │
                                   │        │   caps, target allowlist or merkle root,  │
                                   │        │   status must be Active, policy expiry    │
                                   │        │  state() bumps on every change            │
                                   │        │  auditRoot hash chain; ERC-4337 via       │
                                   │        │   executeUserOp only; 1271 owner-only     │
                                   │        └──────────────────────────────────────────┘
                                   │                          ▲ settlement destination for every module
   ┌───────────────────────────────┴──────────────────────────┴──────────────────────────────┐
   │  MODULES (standalone, Ownable2Step unless noted; talk to the token via tiny local ifaces) │
   │                                                                                           │
   │  registry/  BondVault  ReputationRegistry  ValidationRegistry  AgentHandles              │
   │             AnimaRoles (no owner; ERC-7432, locks instead of escrow)  AnimaBindings      │
   │  work/      WorkEscrow (offer→accept→deliver→settle/dispute)  InferenceMeter (no owner)  │
   │  market/    AgentMarket (EIP-712/6492 orders, deliver-before-pay, rental lock)           │
   │             AgentLaunchpad → AgentToken (no owner, floor-backed) → ILiquidityDeployer    │
   │             AgentSwapRouter (budgeted router over allowlisted venue)                     │
   │             AgentDerivativesDesk  FiatMintGateway                                        │
   │  economy/   RevenueRouter (no owner; timelocked, transfer-staled waterfall)              │
   │  comms/     AgentComms (postage escrow, refund, key-pinned private envelopes)            │
   │  core/      EncryptionKeyRegistry (no owner; chain-wide key directory)                   │
   │  omni/      AnimaOApp → OmniAgentHome (escrow) ⇄ LayerZero V2 ⇄ OmniAgentMirror (shadow)│
   │  web/       AnimaWeb3Renderer (ERC-4804 manual mode, stateless, ownerless, 22,592 B)    │
   └───────────────────────────────────────────────────────────────────────────────────────────┘
          libraries/ ExactERC20 (balance-delta transfers)  ERC6492 (counterfactual signers)  BrainLib
          sdk/src/index.ts: reference hashing (JCS manifests, brain root, audit replay, deriveFacetCut, lzReceiveOptions)
```

### 2.2 How the pieces connect

**The token owns things by derivation, not storage.** `accountOf(id)` is computed from four `immutable`s (`REGISTRY`, `ACCOUNT_IMPLEMENTATION`, `ACCOUNT_SALT`, plus `KEY_REGISTRY` for the sealed path) against the canonical ERC-6551 registry `0x000000006551c19487814612e58FE06813775758`, so the account address is the same before and after `deployAccount`, on every chain, and quoting never races creation. Eight contracts call `accountOf` on settlement paths (escrow, meter, comms, market, swap router, derivatives desk, launchpad, omni home), which is why the diamond keeps those four values as *per-facet immutables* checked by `animaConfigHash()` at construction rather than in storage: the storage version measured +11,081 gas (41%) on `accountOf`; the immutable version measures +4,731 (ARCHITECTURE.md, `Gas.test.ts`).

**Authority flows from `_update`.** On every owner-to-owner transfer the token bumps `operatorEpoch` (voiding the operator set in O(1)), deletes guardian, lease, policy and bound wallet, emits the corresponding zeroing events, and forces status `Paused`. `AgentAccount` reads `grantedBy == owner()` on every session use and keys its allowlist by the owner who set it, so session keys and allowlists die with the sale too. `AgentHandles.isFresh` compares `ownerAtAttestation` to the current owner; `RevenueRouter.policyOf` returns the zero policy when `configuredBy != ownerOf`; `AnimaRoles` locks the token while any role is live so there is no window in which a buyer inherits a grantee. One mechanism — record who granted it, compare to the current owner — applied in six places and tested in each.

**Modules get power only through an allowlist.** `setModule(address,bool)` on the token (two-step owner) is the only path to `lockAgent`/`unlockAgent`/`setDisputed`/`moduleSetUser`. The deploy-time wiring (`test/helpers.ts:269-278`, `docs/DEPLOYMENT.md:97-101`) is: `anima.setModule(escrow|market|roles)`, `bonds.setModule(escrow)`, `bonds.setArbiter(escrow)`, `reputation.setSettlementModule(escrow)`, `validation.setValidator(validator)`. Locks are counted (`lockCount`), disputes are counted (`disputeCount`), and `locked(id) = lockCount != 0 || disputeCount != 0` is enforced inside `_update` for transfers *and burns*, not merely reported through ERC-5192/6454.

**Monolith vs diamond.** The facets partition the monolith's 83-selector ABI (38 + 34 + 11) plus 4 loupe selectors = 87 routed selectors over 4 facets. Shared behaviour — the transfer hook, the controller predicate, the approval store, `tokenURI`, ERC-165 — lives once in `AnimaBase` with the overrides sealed non-virtual "so the compiler refuses the attempt rather than the reviewer having to notice it". All state is ERC-7201 namespaced (`anima.storage.core` at `0x2134dd8a…a700`, `anima.storage.diamond` at `0xbebefff3…d900`; OZ upgradeable bases use their own namespaces), and a test asserts slots 0–2 of the diamond are empty. The constructor checks that every cut is an `Add`, that each facet has code and agrees on `animaConfigHash()`, delegatecalls the initialiser, then asserts `nextAgentId != 0` (a delegatecall to a codeless address *succeeds*) and re-reads every routed selector against what it just wrote (`RoutingTampered`). The only observable differences from the monolith are `supportsInterface(0x48e2b093)` and the fallback's `FunctionNotFound(bytes4)` error, and a test pins that these are the only two.

**Registries are external because the token is full.** `AnimaRoles.sol:22-25` records the measurement: stripping the CBOR metadata trailer buys 53 bytes, `runs: 1` buys 376, and moving the shard-writing loop into a `public` library made the token **4 KB larger** (ABI-encoding a dynamic array for a delegatecall). So reputation, validation, bonds, handles, roles and bindings each take `(tokenAddress, tokenId)` and are the authoritative source for their own concern — exactly the posture ERC-7432 recommends.

### 2.3 Who may do what

Five tiers, consistently applied: the **token owner** configures everything on its agent (model, policy, guardian, operators, lease, wallet binding, retirement only when unlocked, inbox, limits, launches, revenue policy, bond pledges, unrestricted account spending); a **controller** (owner ∨ live ERC-4907 user ∨ operator at the current epoch) operates it (manifest, metadata, brain, status among Inactive/Active/Paused, writing as the agent, delivering, settling vouchers); the **guardian** can only pause, revoke a session, cut off a swap token or halt a market — never spend or reconfigure; an allowlisted **module** may lock/unlock, set Disputed and set the ERC-4907 user; the **contract owner** (two-step) holds only swappable pointers under hard caps; and **anyone** may mint (free), register, deploy an account, refund expired postage, graduate a launch, withdraw a matured unbond or end an expired rental.

---

## 3. Complete contract and module inventory

Byte sizes are deployed runtime bytes from `artifacts/` (re-measured for the six largest: AnimaAgent 23,971; AnimaDiamond 177; AnimaWeb3Renderer 22,592; AgentComms 7,368; AgentAccount 10,709; AgentLaunchpad 16,396). Verdicts: **V** reuse-verbatim, **A** adapt, **R** rewrite, **D** drop.

| Path | Bytes | What it is | Verdict | Reason |
|---|---:|---|:-:|---|
| `core/AnimaAgent.sol` | 23,971 | the monolith token: ERC-721 + 8004 identity + brain + policy + lease + locks + approvals | **A** | port `_update`, epoch stores, counted locks, guardian, modules, fingerprint; drop brain/model/seal; at the size wall; `tokenURI` cannot host a site |
| `core/EncryptionKeyRegistry.sol` | 1,783 | chain-wide, ownerless "publish your encryption key once" directory; `keyIdOf = keccak(pubkey)` | **V** | exactly the recipient-key directory an on-chain E2E messaging layer needs; key-type agnostic |
| `core/verifiers/NullTransferVerifier.sol` | 220 | honest no-op verifier returning `SealPolicy.Committed` | **D** | only meaningful with verifier-certified private-state transfers |
| `core/verifiers/AttesterQuorumVerifier.sol` | 4,332 | EIP-712 M-of-N attester quorum, replay-safe, caller-bound | **A** | generic attestation-quorum block; payload is re-key specific |
| `interfaces/ITransferVerifier.sol` | — | `ReKeyRequest` + verifier interface | **D** | with the verifiers |
| `diamond/AnimaDiamond.sol` | 177 | immutable EIP-2535 diamond: constructor + fallback, no `diamondCut`, post-condition checks | **V** | lets every pillar sit behind one address without EIP-170 or an admin key |
| `diamond/DiamondStorage.sol`, `IDiamond.sol`, `AnimaLoupeFacet.sol` | 1,731 (loupe) | ERC-7201 routing table, loupe, `IDiamondCut` deliberately absent | **V** | infrastructure, no ANIMA coupling |
| `diamond/AnimaBase.sol` | abstract | shared internals, sealed `_update`/`isApprovedForAll`/`setApprovalForAll`/`tokenURI`, per-facet immutable config | **A** | keep the pattern; change what `_update` clears and what `tokenURI` serves |
| `diamond/AnimaStorage.sol`, `IAnimaConfigured.sol`, `AnimaInit.sol` | 9,012 (init) | core namespace layout, config struct + hash, one-shot initialiser | **A** | new fields / new config for the unified token |
| `diamond/AnimaCoreFacet.sol` | 9,946 | ERC-721 surface, locks, approvals, admin | **A** | good split point for the unified "core" facet |
| `diamond/AnimaAgentFacet.sol` | 15,052 | identity, policy, wallet binding, lifecycle, lease, fingerprint | **A** | identity/policy facet |
| `diamond/AnimaBrainFacet.sol` | 15,758 | mint, brain shards, `transferWithBrain` | **A** | becomes the mint facet; brain optional |
| `account/AgentAccount.sol` | 10,709 | ERC-6551 account with leashed session keys, audit chain, ERC-4337 | **A** | the vault/wallet; see §8.1 for the required changes |
| `registry/BondVault.sol` | 5,714 | slashable ERC-20 bond: reserve/unbond/slash, per-module reservations | **A** | correct stake accounting; single asset; pin arbiters |
| `registry/ReputationRegistry.sol` | 9,159 | ERC-8004 feedback + attested, stake-weighted O(1) aggregate | **A** | social trust signal; bound `valueDecimals`; pin settlement modules |
| `registry/ValidationRegistry.sol` | 6,024 | ERC-8004 validation with expiring, opener-namespaced requests + ERC-8126 risk badges | **A/D** | keep only with a work/dispute flow; the squat-proof key is the lesson |
| `registry/AgentHandles.sol` | 4,879 | verifier-attested handles bound 1:1, stale on sale | **A** | apply fix `a767f7c`; prefer on-chain proofs |
| `registry/AnimaRoles.sol` | 5,107 | admin-free ERC-7432 roles; locks the token instead of escrowing it | **V/A** | only coupling is the lock hook |
| `registry/AnimaBindings.sol` | 1,687 | ERC-8217 immutable binding of an ERC-8004 id to a master NFT | **D** | only for singleton-registry interop; `scripts/deploy.ts` is stale for it |
| `work/WorkEscrow.sol` | 11,346 | hire→deliver→settle/dispute with timers and default winners | **A** (optional) | only if "hire the NFT" is in scope |
| `work/InferenceMeter.sol` | 6,037 | ownerless prepaid channel, cumulative EIP-712 vouchers, bilateral receipts | **A** | metering for paid services into the vault |
| `market/AgentMarket.sol` | 9,083 | EIP-712 + ERC-6492 signed sale/rental orders with integrity pins | **A** | one fingerprint pin; on-chain order publication |
| `market/AgentLaunchpad.sol` | 16,396 | virtual-reserve bonding curve, fair window, time-priced snipe tax, locked graduation | **A** | keep maths and discipline; graduate into the in-NFT pool; isolate balances; pin fees |
| `market/AgentToken.sol` | 5,369 | ownerless fixed-supply ERC-20 + Permit with burn-to-redeem treasury floor | **V** | self-contained; rename two immutables |
| `market/ILiquidityDeployer.sol` | — | abstract graduation seam | **R** | must target the protocol's own pool |
| `market/AgentSwapRouter.sol` | 5,519 | budgeted, venue-allowlisted router with delta-verified output | **A** | not a swap; its rules belong in the account's spending policy |
| `market/AgentDerivativesDesk.sol` | 6,706 | leverage leash over a trusted perp adapter | **D** | needs trusted adapters and governance; out of scope |
| `market/FiatMintGateway.sol` | 3,842 | processor-settled fiat mint + deploy account + fund | **D** | trusts a server; keep the atomic mint→deploy→fund shape |
| `economy/RevenueRouter.sol` | 5,811 | ownerless, timelocked, transfer-staled, commitment-bound waterfall | **A** | routes pool/launchpad/postage revenue into the vault |
| `comms/AgentComms.sol` | 7,368 | priced attention: postage escrow, reply-or-refund, key-pinned envelopes | **A** | add enumeration, on-chain bodies, native postage |
| `omni/ILayerZeroV2.sol` | — | hand-transcribed endpoint/receiver ABI | **V** | hermetic, byte-identical ABI |
| `omni/AnimaOmniCodec.sol` | 57 (stub) | `abi.encode` snapshot codec | **V** | adapt the struct fields |
| `omni/AnimaOApp.sol` | abstract | peer auth (endpoint ∧ peer), inbound rate limiter, unordered nonces | **A** | keep both auth halves and the limiter; decide on the `Ownable2Step` owner |
| `omni/OmniAgentHome.sol` / `OmniAgentMirror.sol` | 6,979 / 9,528 | escrow-never-burn home + tradeable shadow with `isReplica()` | **A** (optional) | only if multi-chain presence is wanted; IPSEITY refuses to bridge tokens |
| `web/AnimaWeb3Renderer.sol` | 22,592 | ERC-4804 manual-mode console; imports viem from esm.sh | **R** | keep the shape and UX; drop CDN/RPC table/label bug; start from the `koorbx` client |
| `libraries/ExactERC20.sol` | inlined | balance-delta ERC-20 transfers | **V** | closes fee-on-transfer bad debt everywhere |
| `libraries/ERC6492.sol` | inlined | counterfactual-signer validation with "must actually deploy" guard | **V** | needed wherever an undeployed ERC-6551 account signs |
| `libraries/BrainLib.sol` | inlined | ordered hash chain over shards, memory-only entry points | **A** | generic cheap commitment over any shard list |
| `interfaces/IAnima.sol` | — | normative types (`AgentCore` layout is fingerprint-normative), events, errors, interface | **A** | keep status/lock/guardian/operator vocabulary; AI fields optional |
| `interfaces/IERC6551.sol`, `IRentable.sol` (4907/5192/6454/7572), `IERC7432.sol` | — | standard interfaces with rationale | **V** | |
| `interfaces/IERC8004.sol`, `IERC8126.sol` | — | identity/reputation/validation; risk badges | **V/D** | keep only if ERC-8004 identity is kept |
| `mocks/*` | — | byte-identical ERC6551Registry, MaliciousSeller, MockLZEndpoint (manual delivery, spoofable origin), TamperInit/BackdoorFacet, MockTaxERC20, venue/perp/deployer mocks, ERC6492Harness | **V** (tests) | adversarial mocks reusable as-is |
| `sdk/src/index.ts` | 772 lines | reference hashing: RFC 8785 manifests, brain root, work root, audit replay, private-envelope hash, EIP-712 types, `deriveFacetCut`, `lzReceiveOptions` | **V** (hashing, cut, LZ options) / **A** (manifest layer is HTTPS-only) | |
| `scripts/deploy-diamond.ts` | 368 lines | deploy + full on-chain verification of the immutable diamond | **V** | if the unified token is a diamond |
| `scripts/testnet-*.ts` | — | resumable live-chain harness with three lag defences | **A** | keep the defences as a shared helper |
| `scripts/economy-sim.mjs` | — | seeded Monte Carlo | **D** (research only) | |
| `src/main.js`, `src/style.css`, `index.html`, `vite.config.js`, `pages.yml` | 26,881 / 17,569 / 1,955 | GitHub Pages "Sanctuary" | **A** flows / **D** page | keep wallet connect, id-from-`Transfer`-log, `wallet_watchAsset`, simulate→sign; drop hosting, fonts, fictional data |
| `cli/anima.mjs` | 10,855 | ENS `/bind` wizard; `encodeContenthash`, `assertMainnetEnsCustody` | **V** helpers / **A** wizard | contenthash half targets IPFS |
| `public/.well-known/anima.json`, `llms.txt`, `anima-functions.json`, `schemas/*` | 3,763 / 2,706 / 451,868 | machine discovery, strict manifest schema with `gui` block | **A** | regenerate; serve from the renderer's `/` instead of a static host |
| **Branch** `comms/AnimaCommons.sol` (`upgrade/sanctuary-commons-3d-20260904`) | 12,941 | public circles/posts/moderation, fingerprint-pinned agent badge, history root, evidence-linked work cards | **A** | the indexer-free social layer |
| **Branch** `utility/FrozenClient.sol` + `ClientPart` (`fix/utility-workflows-20260904`) | 848 + 57/part | hash-verified SSTORE2-style HTML assembly; refuses to deploy unless `keccak(assembled) == expectedHash` | **A** | the only "website bytes on chain" primitive in the repo |
| **Branch** `utility/TimeLockVault.sol` | 3,632 | admin-free time locks, beneficiary may be the 6551 account | **A** | vault feature |
| **Branch** `utility/V2LiquidityDeployer.sol` + "checked" launchpad entrypoints | 4,039 | V2 graduation with LP locked in `TimeLockVault`; `createLaunchChecked`/`buyChecked` pin reviewed config | **A** (ideas) | the "checked" pattern should go everywhere |

---

## 4. How the website is delivered and how ownership is verified

There are three human surfaces on `main` and two more on unmerged branches. None is minted by the token; one is the right skeleton.

**(a) The token's `tokenURI` is a stored string.** `AnimaAgent.tokenURI` does `_requireOwned(id); return _agentURI[id];` (verified at `contracts/core/AnimaAgent.sol:360-363`; the diamond's `AnimaBase.sol:204-207` is identical). It is whatever the controller set in `setManifest`/`setAgentURI`. The Sanctuary's mint path builds a self-contained `data:application/json` URI with an inline SVG sigil (`src/main.js:147-154`, comment: "Wallets such as Brave can therefore render a freshly minted ANIMA without an IPFS gateway or hosted API") — but that is a client convention, not a contract guarantee, and it bakes the GitHub Pages URL into `external_url`. Worse, it commits `manifestHash = keccak256(uriString)` rather than the hash of the bytes the URI resolves to, so `verifyManifest` rejects Sanctuary-minted tokens against the project's own rule ("keccak256(exactResponseBytes) == manifestHash", `.well-known/anima.json`).

**(b) `AnimaWeb3Renderer` — the on-chain console (ERC-4804 manual mode).** A separate, stateless, ownerless contract (one `immutable`, no events): `resolveMode()` returns `bytes32("manual")`, and `fallback(bytes calldata path)` returns `abi.encode(string html)` for `/` (usage page), `/token/{id}/live` (the console) or a not-found page, assembling the markup with `string.concat` and interpolating `ownerOf`/`accountOf` server-side. Reachable as `web3://0x9160bE4d943516a2463Ac5f3ABAc5F5cce7975Cd:84532/token/{id}/live` or via the `w3link.io` gateway. Any funded account may deploy it — "which makes recovery possible without the original collection deployer key" — which is exactly how it survived the first deployer's key being destroyed; three versions were deployed in one day (history kept in the deployment record). The page offers OVERVIEW / IDENTITY / CONTROL / ADVANCED tabs, a CONNECT WALLET button and a raw "simulate any ANIMA function" console, and reads its configuration from `data-token/data-contract/data-chain` attributes so one bytecode serves any chain.

Three facts break the GOAL: (1) the embedded `<script type="module">` does `import{…}from"https://esm.sh/viem@2.55.19"` (verified at line 128) — markup, CSS and app logic are on chain, the ABI coder and RPC client are a CDN dependency; (2) RPC and explorer URLs are a hard-coded two-entry table (84532, 11155111), so on any other chain the page renders but cannot read; (3) 22,592 of 24,576 bytes are used (16,157 of them literal HTML/CSS/JS: `_style` 5,843, `_script` 5,483, `_token` 4,291), so there is no room for swap/launchpad/vault/messaging panels inside this contract — the capability chips (`ERC-6551 WALLET · BONDS · MARKET · PAID COMMS …`) are badges only. Also a display bug: seal labels are `["NONE","SEALED TEE","ZK RE-ENCRYPTED"]` against a six-value enum, so `Committed` shows as "SEALED TEE". The unmerged branch `codex/submit-blockchain-deployment-using-sepolia-key-koorbx` rewrote the client with hand-written 4-byte selectors, raw `fetch` JSON-RPC, manual ABI word coding, the full six-entry seal list and `eth_requestAccounts`/`wallet_switchEthereumChain` — the dependency-free version `main` never merged.

**(c) The GitHub Pages "Sanctuary"** (`index.html`, `src/main.js`, `src/style.css`; Vite; Google Fonts; viem bundled from npm). Hard-codes `ANIMA = 0xb3d92c766e3cb356db381feb21958a9ebb974365` (the second Base Sepolia deployment) and `https://sepolia.base.org`, while the README's "Live on Base Sepolia", CLAUDE.md and `deployments/84532.json` describe `0x0aeb6f78…`. A server-hosted static site; its landing page shows five fictional agents with fabricated bond and trust numbers.

**(d) Unmerged: `FrozenClient` + `ClientPart`** (`fix/utility-workflows-20260904`). Each `ClientPart` stores ≤23,000 bytes as STOP-prefixed contract code; `FrozenClient(address[] parts, bytes32 expectedHash)` reassembles ≤128 parts with `extcodecopy` and **refuses to deploy unless `keccak256(assembled) == expectedHash`**; `scripts/utility-publish.mjs` verifies byte-for-byte reconstruction by `eth_call` and pins `abi.encode(client, bundleHash)` under the token's metadata key `anima.client.v2`. Measured: 609,226 bytes in 27 parts, **135,938,093 gas**, local chain only; the pointer is owner-mutable ("immutable content is not an immutable pointer"). The only chain-anchored website bundle in the repo.

**(e) Unmerged: Sanctuary Commons** 3D client (`upgrade/sanctuary-commons-3d-20260904`): a 443 KB standalone HTML whose own `DEPLOYMENT.md` says it is "not deployed on-chain by this release".

### Ownership verification

There is **no SIWE, no signature challenge, no session and no server anywhere**. Verification is client-side and read-only, and enforcement is entirely on-chain per function:

- Sanctuary `connect()` → `eth_requestAccounts` → switch/add Base Sepolia → `discover()` reads `totalMinted()` and calls `ownerOf(id)` for **every id 1..n concurrently**, keeping those equal to the connected address, and labels the result "Ownership verified from Base Sepolia just now". Any RPC error maps to `null` ("not mine"), so a flaky `eth_call` silently reports a holder as a non-holder and offers them a mint button. Receipts are awaited without checking `status`. Branch `codex/find-access-method-for-nft-gui` (PR #30, merged into that branch only) fixes all three: sequential `readOwner` with retry, an explicit "Ownership could not be verified… Retry discovery" state, `waitForSuccessfulTransaction` checking `receipt.status` and replacement reason, and HTML-escaped showcase content.
- The renderer gates **nothing**: every visitor sees the same page; CONNECT WALLET only enables writes; every write is `simulateContract({account:user})` then `writeContract`, so a non-holder sees `NotOwnerOf`/`NotAgentController`/`NotGuardian` before the wallet is asked to sign. The UI never compares `ownerOf(id)` to the connected address.
- Only the CLI uses the right predicate: `isController(agentId, signer)` for records, `ownerOf == signer` plus home chain 1 for ENS custody.
- On-chain wallet gating of a *social* action exists in exactly one contract, on a branch: `AnimaCommons.publish` requires `ANIMA.isController(agentId, msg.sender)` **and** `getStateFingerprint(agentId) == expectedAgentState` before a post may carry an agent badge.

What to carry forward: the ERC-4804 manual-mode shape, the stateless/ownerless/anyone-may-redeploy renderer, `data-*`-driven configuration, simulate-before-sign, `isController` (not `ownerOf`) as the authorisation predicate, fail-closed discovery, and the `FrozenClient` hash-checked assembly. What must be replaced: `tokenURI` must emit or point at the site; the client must be dependency-free; the HTML must live in SSTORE2-style shards behind a router (IPSEITY's `Engine`/`Premises` pattern); and a holder/controller gate in the client must hide write panels while the contracts remain the enforcement point.

---

## 5. Swap

ANIMA has **no AMM**. Two contracts touch swapping, and neither is a pool.

**`AgentSwapRouter` (227 lines, 5,519 B)** is a budgeted, venue-allowlisted router that an agent's ERC-6551 account calls to swap through an *external* DEX under per-token caps its owner set. Its header states the gap it closes: the account's `AutonomyPolicy` caps `msg.value`, so "an agent calling `swap(USDC -> anything)` moves a million dollars with `value == 0` and sails straight through a native-denominated cap. Token budgets have to be denominated in the token." `swap(SwapRequest)` requires `msg.sender == ANIMA.accountOf(agentId)`, a live deadline, `tokenIn != tokenOut`, an allowlisted venue, `statusOf == Active` ("or the guardian's kill switch is decorative"), charges `TokenLimit{perSwap, daily, spentToday, day}` (a UTC calendar-day bucket, despite the comment saying "rolling"), snapshots the router's pre-call input balance, pulls `amountIn` exactly, snapshots output, `forceApprove(venue, amountIn)`, raw-calls the venue, `forceApprove(venue, 0)` unconditionally, requires `balanceOf delta ≥ minOut` ("Reading a DEX's return value instead is how integrations get drained by a venue that was later upgraded"), sends the output to the account, and refunds only the input attributable to this swap — the last point fixing a real testnet finding where the router "refunded its entire input-token balance to the next successful caller" (PR #13). `setLimit` is NFT-owner; `revokeToken` is owner **or guardian**; `setVenue` is governance. Eleven tests, including "caps a single swap — the gap that a native-only spending limit leaves wide open", "catches a venue that under-delivers, by measuring the balance rather than trusting it", "leaves no standing approval, and returns unspent input", "does not gift a pre-existing router balance to the next swapping agent", "lets a guardian cut off a token without waking the owner". Live on Base Sepolia only against a `MockVenue`.

Weaknesses for the GOAL: needs an external DEX; governance-owned venue list; ERC-20 only (no native leg); `minOut = 0` plus venue calldata routing output elsewhere passes the delta check with zero output (the budget bounds the loss, it does not prevent it); Inactive agents cannot swap.

**`AgentLaunchpad`'s curve** is a swap in the narrow sense (constant product over augmented reserves with every rounding against the trader), covered in §7; graduation hands liquidity to an `ILiquidityDeployer` of which only `MockLiquidityDeployer` exists on `main` (a `V2LiquidityDeployer` with locked LP exists on the utility branch, also only against a test fixture).

**`AgentDerivativesDesk`** is a leverage leash over a trusted perp adapter, checked *after* the venue call against what the position became; twelve tests against a mock; out of scope.

Verdict: the swap pillar must come from elsewhere (IPSEITY's per-token `Pool.sol`). From ANIMA, carry the *discipline* into the unified account's spending policy: per-token budgets, delta-verified output, approvals zeroed in the same transaction, pre-call balance segregation, and a guardian that can cut a token off without the owner.

---

## 6. Messaging and social

### 6.1 `AgentComms` — priced attention (7,368 B; 12 tests + 2 regressions)

"A market for agent attention." The contract implements only the parts of messaging that need a chain: **authenticated sender identity** (`isController(fromAgentId, msg.sender)` when a message is sent *as* an agent), **priced attention with a refund** (postage is escrowed on `send` and collectable *only by replying* within the window; after `replyBy` anyone may trigger `refund` to the sender), and **commitment, not content** (`payloadHash` plus a `transportURI` — XMTP topic, Waku topic, ipfs CID or https endpoint — go on chain; "Consumers MUST verify the fetched bytes hash to `payloadHash`"). The header refuses the alternative: "Most 'on-chain chat' is a string in an event, which is a worse version of a database and gets used by nobody."

API: `configureInbox` (owner only, so a tenant cannot reprice; `feeToken == 0` means no paid mail; `open == false` means allowlist-only), `setSenderAllowed`, `setAgentSenderAllowed` (allowlist **by agent id** — "Agents rotate session keys; an address allowlist would have to be rewritten every time"), `send(toAgentId, fromAgentId, threadId, payloadHash, transportURI, expectedFeeToken, maxPostage)`, `sendPrivate(…, expectedRecipientKeyId)`, `reply`, `replyPrivate`, `refund`, `broadcast`. Postage on reply goes to `accountOf(toAgentId)` — "an agent's correspondence funds the agent rather than its owner's wallet". Reply window 5 minutes–30 days.

Load-bearing invariants: `expectedFeeToken` and `maxPostage` are checked against *live* inbox configuration because "a recipient could watch a pending `send`, raise its postage to the sender's entire allowance, reply immediately, and collect it" (regressions "refuses postage raised above what the sender agreed to", "refuses a fee token the sender did not price against"); exactly one of `{answered, refunded}` ever becomes true; a zero `payloadHash` is rejected; all ERC-20 movement is `ExactERC20`.

**Privacy path.** `sendPrivate` resolves `ownerOf(toAgentId)`, reads `keyIdOf(owner)` from the `EncryptionKeyRegistry` the token names, and requires it non-zero and equal to `expectedRecipientKeyId` — "a key rotation in the mempool makes the transaction fail instead of recording an undecryptable message". `replyPrivate` pins the original sender's key the same way. `recipientKeyOf`/`replyKeyOf` are separate mappings so the original `Message` ABI did not change; zero means "legacy commitment-only path". The SDK's `privateEnvelopeHash(ctx, ciphertext)` = `keccak256(abi.encode("anima.PrivateEnvelope.v1" tag, chainId, comms, sender, recipientAgentId, recipientKeyId, nonce, keccak256(ciphertext)))` is the recommended commitment; "This helper commits to bytes; it does not encrypt them." `docs/PRIVACY.md` tables what is public per subsystem and states that nothing stops the legacy `send` from recording an undecryptable payload.

**`EncryptionKeyRegistry`** (72 lines, 1,783 B, ownerless): `setEncryptionKey(uint16 keyType, bytes publicKey)`, `revokeEncryptionKey()`, `keyOf`, `publicKeyOf`, `keyIdOf = keccak256(publicKey)`; key types X25519 = 1, secp256k1 ECIES = 2, P-256 ECIES = 3, ML-KEM-768 = 4, >1000 private. "A blockchain address is a hash, not a public key. You cannot encrypt to it." Deliberately a singleton: "a key is a property of a *person*, not of any one collection."

Gaps, verified: `_nextMessageId` is `private` with **no getter and no per-agent/per-thread index** — only `messageOf(uint256)` exists in the ABI — so an indexer-free on-chain site cannot enumerate an inbox without `eth_getLogs` over `MessageSent`. Postage is ERC-20 only (native deliberately unsupported). `sendPrivate` pins the **owner's** key, not the operator's or the account's, so an operator-run agent must share the owner's decryption key. Zero-postage open inboxes are spammable by design. No comms gas measurement exists.

### 6.2 `AnimaCommons` — public social layer (branch only; 12,941 B; 29 tests, pass on both token builds)

The only crypto-social work in the repo, on `upgrade/sanctuary-commons-3d-20260904` (and its superset `fix/utility-workflows-20260904`); tested locally, never deployed publicly. Header: "A wallet is the social principal. An optional agent badge is authenticated at publication and pinned to a state fingerprint; buying a token does not buy its previous operator's human profile, circle role, or correspondence." Circles (`steward`, two-step handover, `inviteOnly`, `slowMode` ≤ 1 day, rules ≤ 2,048 B), posts (`kind` Discussion/Question/WorkRequest/Update, body ≤ **1,024 bytes** stored on chain, `revision`, tombstone `hidden`/`withdrawn`), `_postIds[circleId]` with `postsPage(circle, cursor, limit ≤ 50)`, membership/invitation/moderator/ban maps, reactions 0–3 with replacement semantics, `acceptedReply`, `attachJob(postId, jobId)` requiring the author to be the `WorkEscrow` client and `specHash == keccak256(body)` ("A clickable work card is evidence-linked, not a self-asserted 'paid' badge"), and a per-circle `historyRoot` hash chain over publish/revise/withdraw/moderate. `publish` with `agentId != 0` requires `isController` **and** an exact `getStateFingerprint` match, recording `ownerOf` at publication. Tests include "NFT transfer does not transfer human posts, circle roles, or moderation", "A to B to A does not revive a stale agent-authored draft", "hiding content is a tombstone, not a false deletion claim", "checks bytes rather than characters" (256 × 🪴).

The branch client (`src/commons/bridge.js`) pins every read in a page to one block, simulates on `prepare()`, **re-simulates immediately before sending**, and shows chain id, signer, contract, value and calldata for review. The superset utility branch ships its source as opaque xz parts applied by CI with push rights; two readers decompressed and hash-checked them, but treat it as unreviewed until applied in the open.

### 6.3 Related trust primitives

`ReputationRegistry` (ERC-8004 + `attested` flag + `weight = min(price, coverage)` + a constant-time aggregate, because "a few dollars of spam on an L2 makes an agent's reputation cost more to read than any node will spend"); `AgentHandles` (verified handles, one per agent, stale on transfer, burned-token reclaimable); `AnimaRoles` (ERC-7432). `Swarm.test.ts` (branch `claude/nft-standard-ai-agents-2y8ngz`) shows agents messaging *as* agents through their own accounts.

Verdict: **adapt** `AgentComms` (keep escrow/refund/identity, the `maxPostage`/`expectedFeeToken` guard, agent-id allowlists, key pinning; add paged per-token and per-thread id arrays, a `nextMessageId()` getter, an optional bounded on-chain body, native postage, and pin the recipient's *account* or operator key rather than the owner's), **reuse `EncryptionKeyRegistry` verbatim**, **adapt `AnimaCommons`** as the public layer with holder-gated circles keyed on the unified NFT and event back-links in the IPSEITY `Parley` style for indexer-free history.

---

## 7. Launchpad

### 7.1 `AgentLaunchpad` (459 lines, 16,396 B; 15 tests)

Bonding-curve issuance of a per-agent `AgentToken`, graduating into locked AMM liquidity. Three stated departures from the standard launchpad: a fair window with a per-address cap ("This does not defeat a determined sybil, and pretending otherwise would be a lie"); fees routed into the token's redemption treasury so every trade raises the floor; and graduation liquidity locked by construction — `lpRecipient` *and* `deployer` are fixed in the `Launch` struct at creation ("A mutable deployer receives approvals for the entire raise and the whole unsold supply at graduation", HIGH finding, commit `f7f86cc`).

`createLaunch(LaunchParams)` — only the ERC-721 owner, one launch per agent ever, `fairWindow ≤ 1 day`, `startsAt` not in the past ("A backdated start puts `fairWindowEnds` in the past, so the per-address cap is never consulted and the creator can take the entire cheap end of the curve in one call"), `snipeTaxStartBps ≤ 9,900`, `curveSupply ∈ (0, totalSupply)`, `virtualQuote != 0`, `graduationTarget != 0` ("constant product sends price to infinity" at a zero base reserve). It deploys `new AgentToken{salt: bytes32(launchId)}(…, totalSupply, address(this))` — **the launchpad holds the whole supply**: "Nothing is pre-allocated to the creator, so there is no insider bag to dump into the launch."

Curve: `k = q*b; newQuote = q + netIn; newBase = ceilDiv(k, newQuote)` ("Round the reserve UP so the trader receives less, never more"); `sell` mirrors it with the fee on gross quote out; reserves are `uint128` via `SafeCast`. Anti-snipe tax decays linearly from `snipeTaxStartBps` at `startsAt` to zero at `fairWindowEnds` — "Priced by time rather than by identity, which is why splitting across addresses does not help — the defect in every per-address cap" (attributed to Zora Coins and Virtuals). Commit `5d21694` records the bug it introduced: "a 99% tax stacking on top of the base fee tried to pay out 102% of the trade, and because launches share one contract balance the overspill would have come out of another launch's raise" — hence the clamp `if (baseBps + snipeBps > 9900) snipeBps = 9900 - baseBps`. Fee split `{protocolBps, treasuryBps, agentBps}` capped at 300 bps total; protocol cut to `protocolFeeRecipient`, treasury cut plus the whole snipe tax to `AgentToken.contribute` ("value a sniper gives up should land with the people they were trying to take it from"), agent cut to `accountOf(agentId)`. `graduate` is permissionless once `raised ≥ graduationTarget || baseSold ≥ curveSupply`, sends the launchpad's entire token balance plus `raised` quote to `deployer.deployLiquidity(token, QUOTE, tokenAmount, quoteAmount, lpRecipient)`, zeroes both approvals afterwards ("Leftover allowance would be a standing claim on the next launch's raise"), and reverts unless `pool != 0 && lpAmount != 0`.

### 7.2 `AgentToken` (149 lines, 5,369 B)

Fixed-supply ERC-20 + Permit with an ERC-7641-style burn-to-redeem treasury: "This token's price cannot go below `treasury / totalSupply`… The floor is not a promise or a buyback programme someone has to remember to run — it is an arbitrage that enforces itself." `contribute(amount)` (permissionless pull), `sync()` (recognise plain transfers), `redeem(amount)` paying `treasury * amount / supplyBeforeBurn`, `floorPerToken()` quoting per *whole* token with `mulDiv` because "a 6-decimal quote like USDC against a 1e27 supply puts the per-base-unit floor at 1e-20" and a naive formula truncates to zero (SECURITY.md build-time bug #2). No mint function (asserted on the ABI by a test); treasury tracked explicitly "so a stray transfer of the quote asset cannot silently move the floor and a donation-based rounding attack has nothing to grip". QUOTE is ERC-20 by design ("every chain has a wrapped equivalent").

### 7.3 Liquidity deployer

`ILiquidityDeployer.deployLiquidity(token, quote, tokenAmount, quoteAmount, lpRecipient) returns (pool, lpAmount)` — "Kept abstract on purpose… The launchpad's job ends at 'here are the tokens and the quote, put them in a pool and send the LP position somewhere it cannot be pulled'." On `main` only `MockLiquidityDeployer` exists. The utility branch adds `V2LiquidityDeployer` (launchpad-only caller, 1% ratio slippage, LP delta verified against the router's declared amount, LP locked in `TimeLockVault` for 1–3,650 days to the beneficiary, dust returned, approvals zeroed) plus "checked" launchpad entrypoints `createLaunchChecked(p, expectedDeployer, expectedFeeHash)` and `buyChecked/sellChecked(…, deadline, maxFeeBps)` that pin whatever governance config the user reviewed into the call.

Live on Base Sepolia (`0x5ed9230C…`, create/buy/sell/redeem/sync/graduate) — against the mock deployer only.

Weaknesses: no pool of its own; launches share one contract balance (clamp and zeroed approvals mitigate; `ceilDiv` dust accumulates with no sweep); owner may change `feeSplit` mid-launch (≤3%); no cancel/refund for a launch that never graduates; `quoteBuy`/`quoteSell` ignore exhaustion and `startsAt`; the agent fee leg goes to the 6551 account.

Verdict: **adapt** the launchpad (keep the maths, rounding, snipe tax + clamp, whole-supply custody, treasury routing, pinned recipient/deployer, backdate refusal; replace `ILiquidityDeployer` with the unified token's own per-NFT pool; isolate per-launch balances; pin fees at creation; add the "checked" entrypoints), **reuse `AgentToken` verbatim**, **rewrite** the deployer seam.

---

## 8. Vault and accounts

### 8.1 `AgentAccount` — the ERC-6551 wallet with a leash (637 lines, 10,709 B; 18 tests + regressions + Market + Lifecycle + Swarm)

"**The owner** signs with their own wallet and is unrestricted. They can always rescue funds, even from a paused agent. **The agent** signs with a session key. Every call it makes is checked against a per-session budget, a rolling daily cap, a per-transaction ceiling, a target allowlist, and the agent's live status. A paused agent cannot spend at all. That asymmetry is the whole point."

Implementation facts: `token()` reads its own runtime code at offset `0x4d` (the canonical registry's proxy footer — a custom registry breaks it silently); `owner()` is zero off-chain or when the token owns its own account; `state()` increments on every state-changing call, including `grantSession`/`revokeSession`/`setAllowedCall`, so a buyer's integrity pin catches re-arming; `Session{validAfter, validUntil, spendCapWei, spentWei, revoked, grantedBy}` with `grantedBy != owner()` → `SessionNotValid` ("A key granted by a previous owner is dead, whatever its expiry says"); `_allowedCall[grantedBy][target][selector]` so a buyer inherits an empty allowlist; `_enforceSession` checks revoked/window → granter → `statusOf == Active` → policy expiry → delegatecall flag → `operation ≤ 1` → target allowlist or OZ double-hashed merkle leaf against `policy.targetsRoot` → `perTxWei` → calendar-day `dailyWei` (shared across all keys) → lifetime `spendCapWei`. `executeBatch` is atomic; `executeWithProof` carries a merkle proof. `auditRoot = keccak256(abi.encode(previous, chainid, this, signer, to, value, selector, dataHash, operation, _state, timestamp))` — "a seller cannot prune the embarrassing entries, splice in flattering ones, or reorder history"; the SDK's `replayAuditLog` reproduces it from `AuditEntry` logs and a test proves pruning breaks the chain. ERC-1271 passes only for the owner's signature: "a budget cap means nothing if the key can instead sign an unbounded off-chain order that some other protocol honours." `revokeSession` is owner **or** `anima().guardianOf(agentId())`. ERC-4337: `validateUserOp` returns `(validUntil << 160) | (validAfter << 208)` so the bundler enforces the window, and all session traffic must enter through `executeUserOp` — a CRITICAL finding fixed in review ("A session key could point its callData straight at `execute`, arrive with `msg.sender == ENTRY_POINT`, and skip every cap").

Known debt (verified): the `memory` duplicate of the authorisation path used by 4337 has **no merkle branch** (`MerkleProof.verify` appears once, at line 415, in the calldata path only), so a session relying on `targetsRoot` works via direct `executeWithProof` but not via a bundler — contradicting the "line-for-line identical" comment. Caps are native-value only (the SPEC itself: "Any implementation that stops at `msg.value` has a spending limit in name only"). "Rolling daily" is a UTC bucket. `grantSession` does not validate `validUntil > validAfter`. A burned token makes `owner()` revert and strands the account's assets. Operations 2/3 (CREATE/CREATE2) unsupported. Depends on OZ `SignatureChecker`/`MerkleProof`/`ReentrancyGuardTransient`.

### 8.2 `BondVault` (319 lines, 5,714 B; 6 tests + regression)

"This is the piece that makes everything else non-theatrical… an agent can only accept work up to what it has staked, so its *maximum lie is bounded by its own capital*." `Bond{total, reserved, unbonding, readyAt, unbondTo}`; `isModule` may `reserve`/`release` (bounded by *that module's own* reservation via `_moduleReserved`), `isArbiter` — "deliberately a narrower set" — may `slash` (free → unbonding, never reserved). Three rules with their reasons: unbonding stays slashable ("Otherwise an agent front-runs its own accountability"); slashing cannot consume reserved capital ("another client's coverage"); coverage is reserved, not merely counted. `deposit` is open to anyone (`RevenueRouter` uses it); `requestUnbond` is owner-only and records `unbondTo`; `cancelUnbond` is gated on **whoever queued it**, fixing "A buyer could seize the seller's queued collateral". "Judge an agent by `availableCoverage`, never by `slashableOf`." Invariant `total ≥ reserved + unbonding`; `UNBONDING_PERIOD` (7 days in fixtures) must outlast every dependent dispute window. Single ERC-20; admin-set arbiters.

### 8.3 `RevenueRouter` (203 lines, 5,811 B; ownerless; 4 tests; not deployed)

A per-agent waterfall `Policy{configuredBy, treasury, commons, treasuryBps, bondBps, referralBps, commonsBps}` with `MIN_OPERATING_BPS = 5,000` (the operating account keeps at least half and every rounding remainder), `MAX_REFERRAL_BPS = 500`, `POLICY_DELAY = 2 days`. `proposePolicy` (owner) → `activatePolicy` (anyone after the delay, owner unchanged) → `routeExpected(agentId, amount, referrer, expectedCommitment)` where `commitment = policyHash XOR keccak256(abi.encode(chainid, this, agentId, referrer))` — "XOR keeps the policy hash recoverable at settlement while the domain, agent and referrer remain cryptographically bound". A policy is stale the instant the token changes hands (`configuredBy != ownerOf`); any activated policy of the *current* owner remains usable so an obligation accepted under it can still settle. Legs: treasury via `IRevenueTreasury.contribute` (matches `AgentToken`), bond via `BONDS.deposit`, referral and commons by transfer, operating remainder to `accountOf`. Debt: no integrating contract snapshots the commitment yet; a caller may pick any historic activated policy of the current owner; and the away-and-back revival (§10.3).

### 8.4 Adjacent vault primitives

`TimeLockVault` (branch; 3,632 B; 13 tests): `createLock(token, amount, beneficiary, unlockAt)` for native or exact-delta ERC-20, `extend` longer-only, `claim` permissionless after maturity, `locksPage`; "No administrator, cancellation, beneficiary replacement or early withdrawal"; the beneficiary can be the 6551 account so "payout follows NFT transfer, not the original owner". `WorkEscrow` reserves coverage on `acceptJob` (never on `offerJob`, "otherwise anyone could pin an agent's entire bond with a stream of offers"); only the ERC-721 owner may pledge, because "anyone who rents an agent for an hour, or any insider, can accept a one-wei job pinning the whole stake".

Verdict: **adapt `AgentAccount`** as the unified vault/wallet (pluggable policy source, ERC-20 caps, unified merkle path, optional receive-only sibling in the IPSEITY "Grip" style); **adapt `BondVault`** as the stake sub-vault behind any hire/escrow feature with constructor-pinned modules/arbiters; **adapt `RevenueRouter`** to route pool fees, launchpad fees and postage into the vault; **adapt `TimeLockVault`** as a vault feature; `FiatMintGateway`'s atomic mint → `deployAccount` → fund-the-vault sequence is the right onboarding shape even without fiat.

---

## 9. The 20 most valuable unique ideas to carry forward

1. **The immutable diamond, derived and verified** — `contracts/diamond/AnimaDiamond.sol`, `sdk/src/index.ts:634-735` (`deriveFacetCut`, `cutIsImmutable`), `scripts/deploy-diamond.ts`. No `diamondCut`, no owner over routing; cut derived from the monolith ABI and refused if partial; constructor asserts `NotInitialised`/`RoutingTampered`/`FacetConfigMismatch`; deploy script diffs each facet's masked bytecode against the artifact and refuses to publish on any failure.
2. **Two builds, one suite** — `test/helpers.ts:110-196`, `ANIMA_IMPL=diamond`, `test/Diamond.test.ts` ("partitions the monolith's ABI: every function routed, exactly once"; "differs from the monolith in exactly one more place"). Equivalence enforced, not asserted.
3. **Per-facet immutable config checked by hash** — `IAnimaConfigured.animaConfigHash()`, `AnimaBase.sol:72-100`. Hot cross-contract reads cost no SLOADs; a mismatched facet cannot be wired (measured: +11,081 → +4,731 gas on `accountOf`).
4. **"Selling revokes all authority", sealed** — `AnimaAgent.sol:729-755`, `AnimaBase.sol:249-276` (non-virtual `_update`): epoch-roll operators, clear guardian/lease/policy/bound wallet, force `Paused`; applied by the same "record granter, compare to current owner" rule in `AgentAccount`, `AgentHandles`, `RevenueRouter`, `AnimaRoles`.
5. **Epoch-keyed operators and time-boxed approvals** — `AnimaAgent.sol:796-861`: `setApprovalForAllUntil`, `revokeAllApprovals` in O(1) via `approvalEpoch`, `isApprovedForAll` reading the timed store (ICRC-37/CW-721 port).
6. **Counted locks and disputes enforced in `_update`** — `lockCount`/`disputeCount`, `locked()` gating transfer *and burn*, reported via ERC-5192 and ERC-6454, with modules as the only lock authority and a guardian that can only pause.
7. **ERC-5646 fingerprint over everything mutable** — `getStateFingerprint` hashing holder, `AgentCore`, weights root, bound wallet, lease, policy and the 6551 `state()`; reverts for nonexistent tokens; `AgentCore` field order declared normative. Used as an integrity pin by `AgentMarket` and `AnimaCommons`.
8. **Owner unrestricted, session keys leashed** — `AgentAccount.sol:357-434`: budgets, allowlists, status, policy expiry checked on every call; `grantedBy`-namespaced sessions and allowlists; `state()` bumps on authorisation widening; EntryPoint is never a principal; ERC-1271 owner-only.
9. **Audit hash chain bound to `(chainId, account)`** — `AgentAccount.sol:340-351` and `replayAuditLog` in the SDK: a buyer replays the full operating record and checks it ends at `auditRoot`.
10. **Chain-wide encryption-key directory + key-pinned envelopes** — `EncryptionKeyRegistry.sol` (`keyIdOf`), `AgentComms.sendPrivate(…, expectedRecipientKeyId)`, SDK `privateEnvelopeHash`: a key rotation in the mempool fails the send instead of recording an undecryptable message.
11. **Priced attention** — `AgentComms.sol`: postage escrowed, collectable only by replying, refunded after the window, paid to the agent's account; `maxPostage`/`expectedFeeToken` bounds against repricing; allowlists keyed by agent id.
12. **Deliver before pay, pins opt-out, epoch in the signed payload** — `AgentMarket.sol:238-274`, `MaliciousSeller.sol` regression; `makerEpoch` inside the EIP-712 struct; paid rentals lock the token for the term.
13. **Launchpad discipline** — `AgentLaunchpad.sol`: constant product over virtual reserves with every rounding against the trader; time-priced anti-snipe tax with the 99% clamp; launchpad holds the whole supply; `lpRecipient` and `deployer` pinned at creation; backdated starts refused; approvals zeroed after graduation.
14. **Self-enforcing redemption floor** — `AgentToken.sol`: burn-to-redeem pro rata over `totalSupply`, explicit treasury, `floorPerToken` per whole token with `mulDiv`.
15. **Timelocked, transfer-staled, commitment-bound revenue waterfall** — `RevenueRouter.sol`: operating majority, rounding to the operator, XOR commitment binding domain/agent/referrer, policy stale on sale.
16. **Coverage reserved, not counted; unbonding stays slashable; queued withdrawal belongs to the queuer** — `BondVault.sol:26-36, 181-233`, per-module reservations.
17. **Attested, stake-weighted reputation with an O(1) aggregate; opener-namespaced validation keys** — `ReputationRegistry.sol:13-26, 60-64`, `WorkEscrow.sol:509-512` (`min(amount, coverage)`), `ValidationRegistry.requestKeyOf`.
18. **Lock-not-escrow roles and stale-on-transfer handles** — `AnimaRoles.sol` (any live role locks, expired roles permissionlessly collectable, irrevocable ≤ 365 days, cannot overwrite a live irrevocable grant); `AgentHandles.isFresh` with burned-token reclaimability.
19. **Value-conserving settlement and counterfactual signers** — `ExactERC20.sol` everywhere; `ERC6492.sol:65-86` honouring a wrapper only if preparation leaves code at the signer.
20. **Hash-checked on-chain client assembly and fail-closed holder discovery** — branch `FrozenClient.sol` (refuses to deploy unless `keccak(assembled) == expectedHash`; recovery from `eth_getCode` "does not execute them") and branch `src/main.js` (`readOwner` retry, "Ownership could not be verified", `receipt.status` and replacement checks).

Honourable mentions: the escrow-never-burn bridge with an inbound rate limiter (`OmniAgentHome.sol:27-45`, `AnimaOApp.sol:44-51`); cumulative vouchers with bilateral receipts (`InferenceMeter`); `expectRevert` matching 4-byte selectors and the gas-drift test; `grantScopedSession` (branch) as the exact-call permission a site can safely request; the six-microeconomy charter ("use → evidence → safer discovery → more use") in `docs/MICROECONOMY_RESEARCH_2026-09-02.md`.

---

## 10. Weaknesses, incompatibilities with the GOAL, and security debt

### 10.1 Incompatibilities with the GOAL

- **No website is minted.** `tokenURI` is a stored string; the on-chain console is a separate contract that depends on `esm.sh` and a two-chain RPC table and has 1,984 bytes of headroom; the primary UI is GitHub Pages with Google Fonts; the only on-chain HTML bundle (`FrozenClient`) is on an unmerged branch, local-chain-only (135.9M gas for 609 KB) and reachable through an owner-mutable metadata pin.
- **No swap.** `AgentSwapRouter` needs an external, governance-allowlisted venue; the launchpad graduates into a mock. The swap pillar must come from IPSEITY's `Pool`.
- **No holder gating in any client.** Reads are public everywhere; writes rely on contract reverts surfaced by simulation. Discovery uses `ownerOf` scans, not `isController`.
- **Admin surfaces everywhere outside the token.** `Ownable2Step` on `BondVault` (arbiters can slash to any beneficiary), `ReputationRegistry`, `ValidationRegistry`, `AgentHandles` (verifier allowlist is the whole security), `AgentMarket`, `AgentLaunchpad` (fee split mutable mid-launch), `AgentSwapRouter` (venues), `AgentDerivativesDesk`, `FiatMintGateway`, `AnimaOApp` (peers, delegate, limits). Only the token's routing, `AgentToken`, `RevenueRouter`, `InferenceMeter`, `AnimaRoles`, `AnimaBindings`, `EncryptionKeyRegistry` and the renderer are admin-free.
- **ERC-20-only money.** Bonds, escrow, metering, launches, postage and `AgentToken` all refuse native currency; `AgentMarket` is the only native-capable path.
- **Off-chain pointers by design.** Comms payloads, manifests, escrow specs/deliveries and the ENS GUI binding (IPFS contenthash) all live off chain; the SDK's manifest fetch is HTTPS-only.
- **Dependencies.** OpenZeppelin 5.6.1 (+ upgradeable, Solady) and transient storage (Cancun) throughout; IPSEITY forbids external Solidity imports, so a merged codebase must choose or hand-roll `SignatureChecker`, `MerkleProof`, `ReentrancyGuardTransient`, `SafeERC20`, `ERC721Upgradeable`.
- **Minting is permissionless and free** (`mintAgent(to, …)` from any EOA), fine for a reference, not a product.

### 10.2 Security debt on `main` (all verified or quoted from the project's own audits)

- `AgentAccount`: 4337 memory path lacks the merkle allowlist branch; native-only caps; calendar-day "rolling" cap shared across keys; audit-chain state-number semantics differ between `execute` (post-increment) and `executeBatch` (pre-increment); burned token strands the account; **`executeBatch([])` advances `_state` with no authorisation at all** (the loop never runs), so anyone can invalidate every state-pinned session or integrity pin — fixed on the `koorbx` branch by `if (calls.length == 0) revert EmptyBatch();`, absent on `main`.
- `ReputationRegistry._normalise` does `unchecked 10 ** (decimals - 2)`; `WorkEscrow.acceptDelivery` passes a client-chosen `ratingDecimals` straight through — an aggregate can be poisoned or settlement blocked by a checked-arithmetic revert. Bound `valueDecimals`.
- `ValidationRegistry`: "Explicit validation requests accept already-expired deadlines" (`TESTNET_AUDIT_2026-09-02` blocker 3); `getSummary` O(n) over anyone's requests.
- `AgentSwapRouter`: `minOut = 0` plus hostile venue calldata leaks the budgeted input; the venue calldata is never bound to the account.
- `AgentDerivativesDesk.trade` forwards `venueCalldata` opaquely and then measures only the agent's own `(account, market)`, so a session key can open a position for *another* account or an unlisted market while every cap is evaluated against the wrong pair — fixed on branch `codex/find-patch-status-for-security-issue` (`c4522ab`, misleadingly titled "Use pinned local Solidity compiler") by `IPerpVenueAdapter.validateTradeCalldata(account, market, calldata)`; `main` has no such check.
- `AgentMarket`: native fills push to three addresses with `sendValue` — a reverting royalty receiver bricks every native fill; rentals charge royalties and ignore `status`.
- `AgentLaunchpad`: shared balance across launches; dust accumulates; no refund path for a non-graduating launch.
- Omni: no replay-safe recovery for an accepted-but-undelivered packet (Unichain journey #4 is stuck: "Do not unlock home-chain custody on a wall-clock timeout"); `lzReceive` is `payable` with no `receive`/sweep, so a native drop is locked forever; DVN/executor defaults never configured; ERC-20s in the home account unchecked at departure; the mirror has a different 6551 address.
- `AgentComms`: no enumeration; owner-key pinning; spam only priced by postage.
- `AnimaWeb3Renderer`: `_tokenPath` decimal parse has no overflow guard (a 78+ digit path panics instead of 404); seal labels wrong.
- `AttesterQuorumVerifier`: audit asks for zero-attester/measurement rejection and constructor/threshold/1271/revocation/malformed-proof coverage.
- `AnimaAgent.unlockAgent` at `lockCount == 0` returns silently; single-token `approve()` is stock OZ, not epoch-keyed.
- `scripts/deploy.ts` deploys `AnimaBindings` without its required constructor argument (stale).
- The Sanctuary commits `manifestHash = keccak256(uriString)`, so `verifyManifest` fails for its own mints; it bakes `predictedId = totalMinted + 1` into the metadata *before* minting, so a concurrent mint produces a token whose manifest names the wrong id (the `koorbx` fix mints with an empty URI, reads the real id from the `Transfer` log, then `setManifest(id, uri, keccak(uri))`); its discovery fails open; receipts unchecked.
- Unaudited (SECURITY.md:3); 23–25 review findings fixed, four of them critical (maker paid before transfer; session key escaping via EntryPoint; sessions surviving sale; insider pledging the owner's bond).

### 10.3 Unmerged fixes found on branches (none on `main`, each verified by diff or grep)

| Branch | Fix | Status on `main` |
|---|---|---|
| `claude/nft-standard-ai-agents-2y8ngz` (`b789450`) | `WorkEscrow.acceptJob`: refuse a job whose client is the agent's own 6551 account (`j.client == accountOf(agentId)` → `SelfHire`) — reputation farming by self-hire through the agent's wallet; plus `test/Swarm.test.ts` (411 lines, agent-to-agent hire/own/message/meter/4337) | `main` has only the `msg.sender == j.client` check (line 266) |
| `codex/fix-high-priority-bug-in-handle-reclamation` (`a767f7c`, also carried by `codex/conduct-deep-testing-on-testnet-nfts` via PR #27) | `AgentHandles._hasFreshClaim` must return true if *any* attestation is fresh; `revoke` must not clear `claimedBy` while another fresh claim exists — otherwise a renewed handle becomes squattable | `main` lines 183 and 224 still have the bug |
| `codex/find-access-method-for-nft-gui` (`54f1362`, PR #30) | Sanctuary discovery fails closed (retry, explicit "could not be verified"), `waitForSuccessfulTransaction` checks `status`/replacement, HTML-escaped showcase | absent |
| `codex/check-if-native-drop-lock-vulnerability-is-fixed` (`20ba818`) | SDK `lzReceiveOptions` throws on non-zero native value (value would be trapped in the receiving OApp) | `main` still encodes the value; Solidity side has neither `require(msg.value == 0)` nor a refund path |
| `codex/submit-blockchain-deployment-using-sepolia-key-koorbx` (`49ed6af`, `47b9571`, `45d10d6`; 3 ahead of PR #39) | Dependency-free renderer client (hand-rolled selectors, raw JSON-RPC, six seal labels); **`EmptyBatch` guard** on `executeBatch`; `grantScopedSession` / `SessionScope{target, dataHash, targetCodeHash, value, expectedAccountState, lastUsedAt, minInterval, callsRemaining}` — exact-calldata sessions, because "two calls to `transfer(address,uint256)` can have radically different recipients and amounts"; mint-then-`setManifest` id-binding fix; extension-release SDK (`anima.extension-release/1`, acyclic graph ≤64 releases, depth ≤16) and `docs/MASTER_NFT_INTEGRATION_2026-09-17.md` reviewing `MASTER-NFT-PROJECT` ("installing software creates no session, allowance or spending permission") | `main` imports viem from esm.sh; no guard; no scoped sessions; sibling branches `-kr7m44`/`-8tqnj1` merged the overlapping renderer/catalog work, so a rebase over `main`'s SDK/schema/renderer changes is needed |
| `codex/fix-high-priority-issues-from-codex-review` (`348a0c6`) | **RevenueRouter away-and-back revival**: validity is `configuredBy == ownerOf`, so after A→B→A the seller's old activated policy (with its treasury/commons/referral destinations) matches again and any old commitment routes revenue the current owner never re-confirmed — a leak across the transfer hook. Fix adds `IAnima.ownershipEpoch(id)` (= `operatorEpoch`, in both monolith and `AnimaCoreFacet` so the cut stays complete), stamps it into `Policy`, and rejects any policy whose epoch differs; three tests incl. "rejects archived policies after an away-and-back ownership transfer" | absent; this is a *different* bug from the one `main` fixed in `9c70c68` (stranded commitments). Port only the epoch logic — the branch's 5-arg `routeExpected` conflicts with `main`'s XOR design |
| `codex/find-patch-status-for-security-issue` (`c4522ab`) | `AgentDerivativesDesk` venue-calldata binding (`validateTradeCalldata`, `InvalidVenueCalldata`), strict `MockPerpVenue` check, test "binds opaque venue calldata to the authenticated account and allowed market" | absent |
| `codex/fix-high-priority-bug-in-revenuerouter.sol`, `codex/research-nfts,-gamification,-and-network-effects` (despite its name, no research doc), `codex/mint-10-nfts-and-list-addresses-0lo5od` | earlier 5-argument `routeExpected`; an older renderer | superseded by `main`; nothing to merge |
| `upgrade/sanctuary-commons-3d-20260904` (4 ahead) / `fix/utility-workflows-20260904` (6 ahead, superset; **highest value**) | `AnimaCommons`; and, in the xz payload (`utility-source.patch`, 44 files, +3,225/−42, hashes verified by two readers): `FrozenClient`, `TimeLockVault`, `V2LiquidityDeployer`, `createLaunchChecked`/`buyChecked`/`sellChecked`, a Swap/Launch/Vault/Bond/Work/Community/Account GUI over `AgentSwapRouter` and friends (atomic approve→act→revoke via `executeBatch`, calldata encoded before the first approval, runtime-bytecode and facet-routing verification before enabling spending), `test/Utility.test.ts` (24) + `UtilityModel.test.mjs` (16); evidence: 362 tests pass on both builds, 95 browser checks, 37 real GUI-submitted transactions, LAUNCH grows to 17,117 B | absent; CI workflow `utility-apply.yml` would apply the parts and push back with the workflow token but never ran; new contracts use `require(…, "string")` against the repo's custom-error convention; deletes `commons-validation.yml`, rewrites `index.html`, conflicts with `main`'s later `src/main.js` edits (19 commits since base `35a725e`) |

Of the 44 non-`main` branches, 28 are merged (9 from the first survey; 19 from the second with zero commits ahead: the ENS custody fixes PR #16/#22, privacy functions #26, privilege-escalation review #20, agent-access docs #31, standards research #17, deployment-vulnerability fix #33, revenue-settlement fix #21, the three mint-10 and three `submit-blockchain-deployment` siblings #34/#37/#41/#42, the live function matrix #35, `rebuild/human-interface-20260904` as an ancestor of `main`), 2 are obsolete, 3 are superseded, and the rest carry the unmerged material above. Net: **five contract-level security fixes are still exploitable on `main`** — handle hijack, derivatives calldata binding, revenue-policy revival, empty-batch state bump, escrow self-hire via the agent's wallet — plus the fail-open discovery and `predictedId` race in the client.

### 10.4 Operational debt

Two Base Sepolia deployments with different keys — the one the UI targets (`0xb3d92c76…`, deployer key disclosed) is not the one the README/CLAUDE.md narrate (`0x0aeb6f78…`, key destroyed); `deploy-web3-renderer.yml` defaults to the wrong record. Unichain Sepolia uses a non-canonical ERC-6551 registry. The same deployer nonce sequence produced identical addresses for *different* contracts on different chains (`0xA9c0f8ae…` is `comms` on Base Sepolia and `meter` on Sepolia), so never identify a contract by address alone. Test counts drift across docs (CLAUDE.md 268; README/SPEC/SECURITY/DEPLOYMENT 279; ARCHITECTURE 199; audits 239/261; branches 322/362). CI runs the monolith suite only — the diamond run, CLI, schema and UI build are not in CI.

---

## 11. Toolchain and testing approach, with measured numbers

**Build.** Hardhat 3 with the viem toolbox; solc 0.8.28 pinned via `solc/soljson.js`; optimizer runs 200; **viaIR**; evmVersion **cancun** (transient storage in 15 contracts — `ReentrancyGuardTransient` — so target chains must have Cancun). OpenZeppelin Contracts + Contracts-Upgradeable 5.6.1 and Solady are the only runtime Solidity dependencies; the two unused LayerZero npm packages were removed (−130 transitive packages) and `npm run audit:prod` (`--omit=dev --audit-level=high`) gates CI. Tests are `node:test` + viem in TypeScript ESM (local imports end in `.js`); custom errors only.

**Commands.** `npm test` (monolith), `npm run test:diamond` (`ANIMA_IMPL=diamond`), `npm run test:both` (run before any push), `npx hardhat test test/Market.test.ts`, `npm run sdk:build`, `npm run ui`/`ui:build`, `npm run anima` (CLI), `npm run testnet:web3-renderer`, `testnet:batch-mint`, `catalog:generate`, `simulate:economy`.

**Counts (re-measured).** 268 `it()` cases in 25 Hardhat files: AnimaAgent 25, Accountability 23, Sdk 22, Regressions 22, Diamond 22, AgentAccount 18, Launchpad 15, Roles 14, Derivatives 12, Comms 12, SwapRouter 11, Ownership 11, Omni 11, Market 11, Meter 9, Handles 9, RevenueRouter 4, Verification 3, FiatMintGateway 3, Bindings 3, Web3Renderer 2, ExactERC20 2, Deploy 2, Lifecycle 1, Gas 1 — plus 11 `node:test` cases in `.mjs` files (Cli 3, ManifestSchema 4, EconomySim 4) = **279**, matching the README. 27 deployable contracts; 83 token selectors; 87 routed; 29 contracts / 657 functions in the generated function index.

**Approach.** `test/helpers.ts:deployProtocol()` deploys the whole protocol (mock ERC-6551 registry with a byte-identical proxy, account implementation, key registry, null verifier, token in either build, 6-decimal mock USDC, bonds at 7-day unbonding, reputation, validation, escrow at 1%, market at 2.5%, comms, meter at 3-day challenge, swap router) and wires modules. `expectRevert(promise, name)` matches the error name **or any 4-byte selector of that name** scanned from all artifacts, because Hardhat decodes custom errors from the artifact at the reverting address and the diamond's ABI has no `NotModule`. Tests read as sentences ("gives a malicious seller no window to strip the agent during settlement"); `Lifecycle.test.ts` walks one agent from birth through bond, hire, learning, guardian pause, bridge and sale. `test/Deploy.test.ts` runs the real `deploy-diamond.ts` verification on every `npm test`. `test/Gas.test.ts` bounds the diamond at ≤25% relative **or** ≤6,000 gas absolute per probe. Mutation evidence: "a one-character change in a facet fails 162 of them" (commit `8f40c79`).

**Measured gas (monolith → diamond).** `ownerOf` 24,472 → 29,062 (+4,590); `tokenURI` 30,058 → 34,511; `supportsInterface` 21,998 → 26,960 (+22.6%, worst); `isApprovedForAll` 28,511 → 32,853; `accountOf` 26,863 → 31,594; `getStateFingerprint` 54,818 → 60,204; `mintAgent` 311,367 → 316,587 (+1.7%); `transferFrom` 85,818 → 90,499; `updateBrain` 68,445 → 72,833. Overhead flat at ~4,300–5,400 gas: one cold selector SLOAD (2,100) plus a cold facet access (2,600). No per-function gas is recorded for the modules.

**Measured sizes (runtime bytes).** AnimaAgent 23,971 (605 under EIP-170; levers: CBOR trailer 53, `runs: 1` 376, public library **+4 KB**); AnimaDiamond 177; facets 9,946 / 15,052 / 15,758 / 1,731; AnimaWeb3Renderer 22,592; AgentLaunchpad 16,396; WorkEscrow 11,346; AgentAccount 10,709; the remaining modules 1,687–9,528 each (full table in §3); six registries total 32,570. Branch: AnimaCommons 12,941; TimeLockVault 3,632; V2LiquidityDeployer 4,039; FrozenClient 848 + 57 per part.

**Live evidence.** Base Sepolia deploy cost 0.00628 ETH; LayerZero outbound 0.0000996 ETH, return "about a minute"; five-chain town run: 60 wallets, 60 agents, 751 successful + 240 expected-revert receipts (991), every resident's theft attempts mined as reverts; Sepolia batch exercise 32 transactions across 10 agents; `FrozenClient` publication 135,938,093 gas for 609,226 bytes (local). The scripts carry three public-RPC lag defences that each bit the project live: wait for code before a constructor inspects a fresh deployment, take ids from receipt logs, block until the endpoint reaches the receipt's block.

---

## 12. Integration plan: what from this repo becomes part of the unified protocol, and in what form

### 12.1 Verbatim files (copy, rename namespaces only)

- `contracts/diamond/AnimaDiamond.sol`, `DiamondStorage.sol`, `IDiamond.sol`, `AnimaLoupeFacet.sol` — the unified token *is* an immutable diamond: core facet, identity facet, mint facet, **site facet** (ERC-4804/5219 router + SSTORE2 shard reads), **pool facet**, **comms facet**, **launchpad facet**, **vault facet**, loupe. The size ceiling disappears and so does the upgrade key.
- `sdk/src/index.ts` `deriveFacetCut`/`cutIsImmutable` and `scripts/deploy-diamond.ts` (with its on-chain verification pass), `test/Deploy.test.ts`, `test/Diamond.test.ts` patterns (slot 0–2 empty, selector partition, no `diamondCut` anywhere in facet bytecode).
- `contracts/core/EncryptionKeyRegistry.sol` — the recipient-key directory for encrypted DMs.
- `contracts/libraries/ExactERC20.sol`, `contracts/libraries/ERC6492.sol`.
- `contracts/market/AgentToken.sol` — the launchpad's issued token (rename `ANIMA`/`AGENT_ID`).
- `contracts/interfaces/IERC6551.sol`, `IRentable.sol` (4907/5192/6454/7572), `IERC7432.sol`; `contracts/registry/AnimaRoles.sol` (needs only the lock hook).
- `contracts/omni/ILayerZeroV2.sol`, `AnimaOmniCodec.sol`, `contracts/mocks/MockLZEndpoint.sol`, and `lzReceiveOptions` — only if the unified protocol bridges anything (IPSEITY's `ParleyPort` federates messages, not tokens; that is the compatible scope).
- SDK hashing helpers (`manifestHash`/JCS, `replayAuditLog`, `privateEnvelopeHash`, `targetLeaf`), `test/helpers.ts` `expectRevert` selector matching, the adversarial mocks (`MaliciousSeller`, `TamperInit`/`BackdoorFacet`, `MockTaxERC20`, `ERC6492Harness`), `docs/DEPENDENCY_SECURITY.md` policy.
- `cli/anima.mjs` `encodeContenthash`/`assertMainnetEnsCustody`.

### 12.2 Adapted modules (lift the logic, change the coupling)

- **Token core** (`AnimaAgent`/`AnimaBase`/`AnimaCoreFacet` → unified core facet): sealed `_update` that epoch-rolls operators and clears every delegated authority; epoch-keyed operators; time-boxed approvals and `revokeAllApprovals`; counted locks/disputes with a module allowlist; guardian-pause; ERC-5646 fingerprint with a normative struct layout. Replace `tokenURI` with the site-emitting implementation (IPSEITY `Renderer`); drop or optionalise brain/model/seal; decide whether ERC-8004 identity stays.
- **Vault** (`AgentAccount` → unified account implementation): keep owner/session asymmetry, `grantedBy` namespacing, `state()` bumps, audit chain, 4337 via `executeUserOp`, guardian revoke; add the `EmptyBatch` guard and the `koorbx` `grantScopedSession` (exact calldata hash, target code hash, exact value, account state at grant, call count, minimum interval — the right primitive for letting the site grant a swap or launch a bounded, reviewable permission); read status/policy from the unified hub; add ERC-20 budgets (decode `transfer`/`approve` selectors or per-token caps as in `AgentSwapRouter`); unify the merkle path; pair with a receive-only Grip; consider the IPSEITY seal. `BondVault` as the stake sub-vault with constructor-pinned modules/arbiters; `RevenueRouter` routing pool fees, launchpad fees and postage into the vault with legs for treasury/bond/referrer/commons; `TimeLockVault` as a feature; `FiatMintGateway`'s mint → `deployAccount` → fund sequence as the mint flow.
- **Messaging/social**: `AgentComms` with per-token/per-thread paged id arrays, `nextMessageId()`, optional ≤1 KB on-chain body, native postage, recipient-account key pinning; `AnimaCommons` as the public circles layer with holder-gated circles keyed on the unified NFT, a per-token home circle at mint, `Parley`-style event back-links; `ReputationRegistry`'s attested/weighted O(1) aggregate (bounded decimals, pinned settlement modules) and `AgentHandles` (with fix `a767f7c`, on-chain ENS proofs where possible) as the trust/identity signals shown on the site.
- **Launchpad**: `AgentLaunchpad` curve, rounding, snipe tax + clamp, whole-supply custody, pinned recipient, backdate refusal, approval zeroing; `ILiquidityDeployer` rewritten to graduate into the protocol's own per-NFT pool; per-launch balance isolation (CREATE2 per launch); fees pinned at creation; `createLaunchChecked`/`buyChecked` from the utility branch.
- **Swap**: no ANIMA contract; port `AgentSwapRouter`'s budget/delta/approval-zeroing/pre-call-snapshot/guardian-revoke rules into the account's spending policy over IPSEITY's `Pool`.
- **Market** (`AgentMarket`): EIP-712 + ERC-6492 orders, deliver-before-pay, `makerEpoch` in the signed struct, one fingerprint pin instead of three, paid-rental lock, plus an on-chain `OrderPosted` event so no server distributes orders.
- **Website**: keep `resolveMode()`/`fallback(bytes)`/`/token/{id}/…` route shape, `data-*` configuration, simulate-before-sign, and anyone-may-redeploy; take the `koorbx` dependency-free client as the starting point and its mint-with-empty-URI → id-from-`Transfer`-log → `setManifest` sequence as the mint flow; move HTML into `FrozenClient`-style hash-checked shards behind an IPSEITY `Premises` router; adopt the utility client's rule that spending is enabled only after runtime bytecode (immutables masked), facet routing and cross-contract wiring have been verified, and that all calldata is encoded before the first approval; gate panels client-side on `isController` (plus ERC-7432 roles) while contracts enforce; serve `.well-known`/function index from the `/` route.
- **Scripts**: `testnet-deploy.ts`/`testnet-omni.ts`/`testnet-town.ts`/`testnet-batch-*.ts` as the live-rehearsal harness with the three lag defences as a shared helper; `generate-agent-function-index.mjs`; the branch's `commons-local.ts` loopback RPC with method allowlist and `commons-browser-check.py` EIP-1193 shim as browser-level tests.

### 12.3 Ideas only (no code transfers)

The six-microeconomy charter and its adversarial game table; "rules signed before an obligation opens, immutable for that obligation"; `InferenceMeter`'s cumulative-voucher channel for metered paid services; `WorkEscrow`'s timer-with-default-winner state machine and the no-`try/catch`-under-`eth_estimateGas` rule; `AttesterQuorumVerifier`'s caller-bound replay-safe quorum; the omni "what does not travel, stated plainly" and never-unlock-on-timeout rules; `validateTradeCalldata`'s principle that opaque venue calldata must be bound to `(account, market)` before it is forwarded — which applies equally to the swap router's raw venue call; the `MASTER_NFT_INTEGRATION` review's permission vocabulary (`identity.read`, `state.read`, `state.write`, `transaction.propose`, `journal.propose`) and its finding that MASTER's collection/account/renderer authority cannot replace an immutable identity "without creating two controllers"; the SealPolicy honesty principle (publish the guarantee level, let buyers price residual risk); the Sanctuary's per-token console vocabulary and the audit's wish-list (order simulator with pins, allowance and stranded-token dashboards, guardian emergency controls).

### 12.4 Drop

`AgentDerivativesDesk`, `FiatMintGateway` (contract), `AnimaBindings`, `ITransferVerifier` + both verifiers (unless certified private-state transfers are kept), the GitHub Pages site and `pages.yml`, `src/style.css`, `index.html`, `vite.config.js`, `economy-sim.mjs` (keep as research), the IPFS half of the ENS binding, every `deployments/*.json` as infrastructure (keep as evidence and as the record format), and the token bridge unless multi-chain presence is a stated requirement.

### 12.5 Sequencing

1. Stand up the unified immutable diamond with ANIMA's constructor/loupe/derivation/verification intact and IPSEITY's `tokenURI`/site facet routed; prove the two-build equivalence pattern on the new ABI.
2. Port the core facet's authority semantics and the account; land the five orphaned contract fixes first (`AgentHandles` `a767f7c` applies cleanly; `EmptyBatch`; `ownershipEpoch` ported onto `main`'s XOR router; `SelfHire` via the agent's account; `validateTradeCalldata` as a rule for any venue call) plus the merkle-path unification and the fail-closed client discovery, before anything builds on them. Convert the utility branch's `require` strings to custom errors on the way in.
3. Add comms (adapted `AgentComms` + `EncryptionKeyRegistry`) and the public circles; wire postage into `RevenueRouter`.
4. Add the launchpad over the in-protocol pool; add `AgentToken`; add `BondVault`/`RevenueRouter` legs.
5. Re-measure: facet sizes, the gas-drift bound, test counts; regenerate the function index and `.well-known` from the new ABIs; never write a count before running the suite.
