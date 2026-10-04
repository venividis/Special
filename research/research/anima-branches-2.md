# ANIMA (Cutting-edge-technologically-advanced-NFT) — branch survey, part 2

Repo: `/home/user/Cutting-edge-technologically-advanced-NFT`
Base: `origin/main` = `e345828` (2026-09-16, "Merge pull request #42 … submit-blockchain-deployment-using-sepolia-key-8tqnj1")
Method: read-only (`git log`, `git diff`, `git show`, `git cherry`); nothing checked out. The xz-packed payload on
`fix/utility-workflows-20260904` was decompressed into the scratchpad
(`scratchpad/research/utility-payload/`) and its SHA-256s were verified against the values pinned in the
branch's own workflow before reading it.

## Headline

| Status | Count | Branches |
|---|---|---|
| Merged (0 commits ahead) | 19 | see §A |
| Unmerged, **valuable** | 6 | `fix/utility-workflows-20260904` (highest), `upgrade/sanctuary-commons-3d-20260904`, `codex/submit-blockchain-deployment-using-sepolia-key-koorbx`, `codex/fix-high-priority-issues-from-codex-review`, `codex/fix-high-priority-bug-in-handle-reclamation`, `codex/find-patch-status-for-security-issue`, `codex/fix-codex-review-issues-in-pr-#25` |
| Unmerged, superseded by main | 3 | `codex/fix-high-priority-bug-in-revenuerouter.sol`, `codex/research-nfts,-gamification,-and-network-effects` (contains no research doc, only the superseded router fix), `codex/mint-10-nfts-and-list-addresses-0lo5od` |

Four security fixes never reached main and are still exploitable there (verified by grepping `origin/main`):

1. **AgentHandles handle hijack** (`fix-high-priority-bug-in-handle-reclamation`) — main still has both buggy lines.
2. **AgentDerivativesDesk unbound venue calldata** (`find-patch-status-for-security-issue`) — main has no `validateTradeCalldata`.
3. **RevenueRouter away-and-back ownership revival** (`fix-high-priority-issues-from-codex-review`, 2nd commit) — main has no `ownershipEpoch`.
4. **AgentAccount empty-batch state bump** (koorbx `45d10d6`) — main's `executeBatch` has no `calls.length == 0` guard.

Plus two client-side (GUI access-verification) bugs that are still on main's `src/main.js`: fail-open owner
discovery (`catch{return null}`), no receipt-status check, and the `predictedId` mint race.

For the GOAL (one NFT = swap + messaging + launchpad + vault + self-served website), the two 20260904
branches are the material: `AnimaCommons` (messaging/social), `TimeLockVault` (vault), `V2LiquidityDeployer` +
checked launchpad entrypoints (launchpad), a Swap tab on `AgentSwapRouter` (swap), and `FrozenClient`
(the whole 609 KB GUI published as inert data contracts and pinned to the NFT's metadata — "mint a website").

---

## A. Merged branches (one line each)

All have zero commits ahead of `origin/main`; their content is already on main.

| Branch | Landed as |
|---|---|
| `codex/find-nft-mint-website-and-gui-details` | PR #39 (`8e867a7`) — AnimaWeb3Renderer / GUI-details work is on main |
| `codex/fix-ens-custody-transfer-vulnerability` | PR #22 (`b8b055b`) |
| `codex/implement-private-functions-for-nft-project` | PR #26 (`a898d5c`) — see `docs/PRIVACY.md` on main |
| `codex/investigate-privilege-escalation-vulnerability` | PR #20 (`a859c17`) |
| `codex/locate-ways-for-ai-agents-to-access-project` | PR #31 (`35a725e`) — `docs/AGENT_INTEGRATION.md`, `public/llms.txt` |
| `codex/master-and-upgrade-nft-fundamentals` | PR #12 (`4300ec8`) |
| `codex/mint-10-nfts-and-list-addresses` | PR #37 (`4cf05c2`) |
| `codex/mint-10-nfts-on-sepolia-testnet` | PR #34 (`38a18a8`) |
| `codex/perform-thorough-audit-and-testing` | PR #10 (`02a0b83`) |
| `codex/propose-fix-for-deployment-vulnerability` | PR #33 (`2fc1666`) |
| `codex/propose-fix-for-ens-custody-issue` | PR #16 (`9c0fb3f`) |
| `codex/propose-fix-for-revenue-settlement-vulnerability` | PR #21 (`5f92bbd`) |
| `codex/research-nft-standards-for-utility-improvements` | PR #17 (`2548348`) — `docs/NFT_STANDARDS_RESEARCH_2026-09-02.md` on main |
| `codex/submit-blockchain-deployment-using-sepolia-key` | PR #42 (`e345828`, via the `-8tqnj1` sibling) |
| `codex/submit-blockchain-deployment-using-sepolia-key-8tqnj1` | PR #42 (`e345828`) |
| `codex/submit-blockchain-deployment-using-sepolia-key-kr7m44` | PR #41 (`37bb1f8`) |
| `codex/test-all-nft-functions-and-combinations` | PR #35 (`2f8c732`) — `docs/LIVE_FUNCTION_MATRIX_2026-08-31.md` |
| `codex/update-nft-minting-for-web3-address` | PR #36 (`4151c6e`) |
| `rebuild/human-interface-20260904` | tip is an ancestor of main (no merge commit; fast-forwarded or identical) |

Where the merged research lives on main (for the parent's dossier): `docs/NFT_STANDARDS_RESEARCH_2026-09-02.md`,
`docs/MICROECONOMY_RESEARCH_2026-09-02.md` (the only main file mentioning gamification / network effects),
`docs/AGENT_ECOSYSTEM_RESEARCH_2026-09-17.md`, `docs/AGENT_CAPABILITY_CATALOG.md`, `docs/PRIVACY.md`,
`docs/TESTNET_AUDIT_2026-08-31/09-02/09-15.md`, `docs/LIVE_FUNCTION_MATRIX_2026-08-31.md`.

---

## B. Unmerged branches

### B1. `fix/utility-workflows-20260904` — **HIGHEST VALUE**

- Commits ahead: 6 (`fe1b493`, `7326e97`, `93a4bd0`, `80312cd`, `a5410cb`, `cde80c4`). Superset of
  `upgrade/sanctuary-commons-3d-20260904` (first four commits identical) plus two commits that add
  `.github/utility-payload/{00..05}.part,06-clean.part` and `.github/workflows/utility-apply.yml`.
- Visible diff vs main: 36 files, +2176/−178 (the Sanctuary/Commons work, §B2) plus 90 KB of xz payload.
- Merge base: `35a725e` (PR #31). Main has 19 commits since; churn on shared files: `src/main.js` (+36 lines),
  `README.md`, `package.json`, `.github/workflows/deploy-web3-renderer.yml`. Expect a conflict in
  `src/main.js` (branch moves it to `src/legacy.js`).

**The packed payload.** The workflow (`utility-apply.yml`) is designed to run on push to this branch,
concatenate the parts, verify SHA-256 `bbe8f9…4a41` / `94d377…2ef4` (source) and `450dc4…dbf1` / `87f146…f942`
(clean), `git apply` both, rebuild, run `npm run test:both`, rebuild the standalone HTML and check
`dist/ANIMA_Utility.html` against `6793ec…582b`, then **commit "feat: complete Swap Launch Vault and funded-work
GUI workflows" and push to the same branch**. The branch tip is still the payload commit, so that CI step never
completed. I decompressed the payload read-only; all four hashes matched.

`utility-source.patch` (targets `80312cd`): 44 files, +3225/−42. Stat:

```
contracts/market/AgentLaunchpad.sol          |   38 +
contracts/mocks/UtilityV2Fixture.sol         |   49 +
contracts/utility/FrozenClient.sol           |   51 +
contracts/utility/TimeLockVault.sol          |   98 +
contracts/utility/V2LiquidityDeployer.sol    |   55 +
docs/utility/{README,SECURITY,DEPLOYMENT,ACCEPTANCE,VERIFICATION}.md, evidence/*.json, runtime-sizes.json
sanctuary.html (+32)  index.html (−33 → utility becomes the entry)  src/sanctuary.js
src/utility/{app,client,icons,model,scene}.js, style.css   (~440 lines)
scripts/utility-{abi,browser-check.py,developer-check.py,local.ts,preview,publish,recover,start,test-oracle}
test/Utility.test.ts (+48, 24 cases)  test/UtilityModel.test.mjs (+20, 16 cases)
.github/workflows/commons-validation.yml     |   31 -   (deleted)
package.json: adds utility:abi/preview/local/recover/publish, test:utility, start
```

**What it builds (docs/utility/README.md, quoted):**

> This corrective release makes Swap, Launch, Vault, funded Work, and Community the default interface. It
> extends the exact PR32 source (`80312cd…`) rather than replacing the protocol with another unrelated demonstration.
>
> **Swap:** spend from the selected NFT account, not accidentally the connected wallet. Read actual token
> decimals/balances and per-token limits; obtain a direct V2-shaped route quote; review minimum output, expiry, gas
> and destination; execute approval/swap/revocation in one account batch. …
> **Launch:** configure supply/curve allocation, virtual reserve, graduation target, opening window/cap and LP
> beneficiary. Creation pins the reviewed fee schedule and liquidity deployer. Buy/sell use bounded minimum output,
> deadline and maximum reviewed fee. Redeem tokens against their actual treasury. Graduate liquidity through the new
> adapter, which puts actual LP tokens into a real time lock. The implementation is V2-compatible, not Uniswap V4.
> **Vault:** lock native currency or conventional exact-transfer ERC20 assets from the wallet or NFT account. Choose
> an immutable beneficiary and future time. No administrator, cancellation, yield or early exit. Beneficiaries may
> extend, never shorten, a lock. Anyone may trigger maturity; payment always reaches the fixed beneficiary. …
> **Bond:** a separate Vault tab manages slashable work collateral …
> **Work:** fund an actual escrow offer; switch to the worker to accept and deliver; switch to the client to accept
> delivery with a chosen rating and settle. …
> **Community:** publish an on-chain work request, carry its exact text to the funding form, then explicitly attach
> the matching escrow job. …
> **Account/Activity:** select an NFT, deploy its account, activate/pause it, set trading limits, fund/send assets,
> review confirmed/pending/reverted transactions, and inspect/revoke wallet allowances.

**Contracts (new, in `contracts/utility/`):**

- `FrozenClient.sol` — *the "mint a website" primitive.* `ClientPart` is a constructor-only contract whose
  runtime code is `0x00 ‖ data` (STOP-prefixed, ≤ 23,000 bytes, so calls are inert). `FrozenClient(address[]
  parts, bytes32 expectedHash)` accepts ≤ 128 parts, checks each has the STOP prefix, `extcodecopy`s them into one
  buffer, and **reverts unless `keccak256(assembled) == expectedHash`**; exposes `partCount()`, `readPart(i)`,
  `html()`. 848 bytes runtime. The utility GUI (`dist/ANIMA_Utility.html`, 609,226 bytes) was published this way on
  the local chain as 27 parts; publication gas measured at **135,938,093**; recovery via `scripts/utility-recover.mjs`
  reproduced the file byte-for-byte; the pointer is stored under the NFT's metadata key `anima.client.v2` as
  `abi.encode(address client, bytes32 bundleHash)`. The docs are explicit: "immutable content is not an immutable
  pointer" — the owner can repoint, the bundle cannot change.
- `TimeLockVault.sol` (3,632 bytes) — `createLock(token, amount, beneficiary, unlockAt)` (native when
  `token == 0`, exact `msg.value`), `MAX_DURATION = 3650 days`, exact-balance-delta checks both on deposit and on
  claim (`InexactTransfer` rejects fee-on-transfer/rebasing), `extend()` beneficiary-only and longer-only,
  `claim()` callable by anyone but always pays the immutable beneficiary, `locksPage()` pagination (≤ 50) without an
  indexer. No admin, no cancel, no early exit.
- `V2LiquidityDeployer.sol` (4,039 bytes) — implements the existing `ILiquidityDeployer`; only `LAUNCHPAD` may
  call; pulls token+quote with `transferFromExact`, `addLiquidity` on a V2 router with 1% ratio tolerance, verifies
  the pair, measures LP received and requires it equals the router's declared amount, **locks the LP in
  `TimeLockVault` for `LOCK_DURATION` (1–3650 days) to the launch beneficiary**, refunds dust, zeroes allowances.
- `AgentLaunchpad.sol` (additive): `UTILITY_API = 1`, `createLaunchChecked(p, expectedDeployer, expectedFeeHash)`
  (reverts "Launch configuration changed" if governance moved the deployer or `feeSplit`), `buyChecked` /
  `sellChecked(…, deadline, maxFeeBps)`. Old entrypoints preserved.

Tests (`test/Utility.test.ts`, 24): "stores exact terms and withdraws only to fixed beneficiary even for a
third-party trigger", "rejects fee-on-transfer deposits without recording phantom collateral", "control of
account-beneficiary payout follows NFT transfer, not the original owner", "recovers exact HTML from independently
readable contract parts", "rejects incorrect content commitment", "creation binds expected fee schedule and LP
deployer", "graduation locks actual minted LP tokens with zero residual allowances", "accepts only the matching
compiled modules and validates diamond facet routing when applicable".

**Evidence (docs/utility/VERIFICATION.md):** 362 pass on monolith and on diamond; 95 browser checks, 37 real
submitted transactions through the GUI (cancel-without-signing swap; 100 USDC swap from NFT account with zero
residual allowances; ERC20/native/LP locks; launch create/buy/sell/redeem/graduate; bond deposit/queue/cancel/
withdraw; Commons post → funded WorkEscrow offer → accept/deliver/settle). Runtime sizes: AGENT 23,971; LAUNCH
17,117; VAULT 3,632; LIQUIDITY 4,039; CLIENT 848; COMMONS 12,941. Scope line: "Local-only test release; no
independent audit, public deployment, or native wallet/GPU verification." Only chains 31337 / 84532 / 11155111
are enabled in the UI; publication is restricted to 31337.

**Security doc highlights (docs/utility/SECURITY.md):** runtime bytecode matching masks only compiler-declared
immutable ranges; every planned calldata is encoded before the first approval ("so malformed later calls cannot
first solicit allowance"); NFT-account swaps/locks are atomic approve/act/revoke batches; "Vault state advances
before external payout and rolls back on transfer failure"; "The ANIMA metadata association `anima.client.v2` is
owner-controlled and can be repointed; immutable content is not an immutable pointer."

**Caveats for merging:** the new contracts use `require(…, "string")` (repo convention is custom errors);
the patch deletes `commons-validation.yml` and rewrites `index.html`; it must be applied on top of the four
Sanctuary commits, then rebased across main's 19 newer commits. Nothing was deployed to a public chain.

### B2. `upgrade/sanctuary-commons-3d-20260904` — valuable (messaging / social layer + 3D GUI)

- Commits ahead: 4 (`fe1b493`, `7326e97`, `93a4bd0` "feat: Sanctuary 3D and consent-first Commons social
  layer", `80312cd`). 28 files, +2086/−178. Identical to the first four commits of B1; merging B1 subsumes it.
- Base `35a725e`; same `src/main.js` conflict exposure as B1.

**New contract `contracts/comms/AnimaCommons.sol`** (314 lines, 12,941 bytes runtime), constructor
`(IAnima anima, WorkEscrow work)` with binding checks (`WORK.ANIMA() == anima`). Public, non-custodial circles:
`createCircle(name, purpose, rules, inviteOnly, slowMode)`, `configureCircle`, `invite`, `join`, `leave`,
`setModerator`, `ban`, `proposeSteward`/`acceptSteward` (two-step), `publish(circleId, parentId, agentId,
expectedAgentState, Kind{Discussion,Question,WorkRequest,Update}, body)`, `revise`, `withdraw`, `moderate`
(tombstone, not deletion), `react` (replacement-style per address), `acceptReply`, `attachJob(postId, jobId)`,
reads `circleOf`, `postOf`, `postCount`, `postsPage(cursor, limit ≤ 50)`, `historyRoot`. Bodies ≤ 1,024 bytes,
rules ≤ 2,048 bytes. An agent-badged post requires `ANIMA.isController(agentId, msg.sender)` **and** an exact
current `getStateFingerprint(agentId)`; the post stores `agentOwnerAtPublication` and `agentState`, so a token
sale does not transfer the human's posts, roles or moderation, and A→B→A cannot revive a stale badge
(`StateChanged`). `attachJob` requires the post author to be the escrow client and the job's `specHash` to equal
`keccak256(body)`; a linked post can no longer be revised. History is a domain-separated hash chain
(`anima.commons.history.v1`, chain id, contract, circle) over publish/revise/moderate/withdraw. 29 tests, e.g.
"NFT transfer does not transfer human posts, circle roles, or moderation", "hiding content is a tombstone, not a
false deletion claim", "job link requires an actual client-matching, exact-body WorkEscrow record".

**Client:** `src/commons/{app,bridge,model,scene,abi}.js` + `style.css` (new Vite entry), `console.html` +
`src/legacy.js` preserve the old console. `scene.js` is a procedural 3D map (real mesh geometry, WebGL depth
buffer with a CPU-projected fallback, flat mode, reduced-motion, keyboard access). `bridge.js` (viem) pins all
reads in a page to one block, validates chain id + bytecode + `WorkEscrow→ANIMA` and `Commons→ANIMA/WorkEscrow`
bindings, simulates before review, re-simulates before send, and invalidates prepared actions on wallet/chain/
config change. Only 31337 and 84532 enabled. 37 Playwright checks (`scripts/commons-browser-check.py`),
`scripts/commons-local.ts` disposable EVM with 22 seeded posts.

**docs/commons/UX_AND_SOCIAL.md — the six-place design (quoted):**

> | Place | Human question | Meaningful action |
> | Sanctuary | What deserves my attention? | Review a finite catchup and choose one intention. |
> | Circles | Who is working on something I care about? | Join a purpose, ask, answer, share progress. |
> | Work atelier | Can we turn this idea into a deliverable? | Write and inspect an explicit brief; link a real agreement. |
> | Observatory | What is this agent actually allowed to do? | Read ownership, policy, coverage and evidence from contracts. |
> | Tool garden | What capabilities exist and what do they cost? | See boundaries and reach the preserved protocol console. |
> | Library | What do I want to keep? | Return to saved conversations and export device-local notes. |
>
> The return loop is **purpose -> contribution -> response -> useful result -> saved knowledge**. It is not
> token-price watching, streak loss, an infinite feed or purchasable status. … There are no notification-badge
> tricks, fictitious online counts, wealth leaderboards, paid reaction boosts, random financial rewards or urgency
> timers. … No NFT is required for circle participation. A controller can optionally speak with a checked agent
> badge, but buying a token does not buy an EOA's history or social office.

**docs/commons/RESEARCH.md — standards atlas conclusions (quoted):**

> The highest-value upgrade is not another ownership interface. … The missing layer is the human journey
> between these mechanisms: belonging, discovering, asking, collaborating, checking evidence and returning to
> something useful. … It separates five facts that should never be collapsed into one badge: **identity,
> authority, statement, evidence and settlement**.
>
> ERC-7857 is **Final** … It does not by itself put a large model's inference on the EVM. … ERC-8004 is still
> **Draft** … Decision: read concrete agent state and the repository's attested-work count; do not turn arbitrary
> feedback into a percentage labelled trust. … ERC-8126 is **Final** … The new client does not fabricate an
> ERC-8126 result or silently label absence as low risk.
>
> Moving `(recipient, tokenId)` does not automatically move those liabilities. ANIMA's existing
> canonical-home/mirror structure is therefore preserved. … "only two technologies can carry an NFT" is not a
> sound general conclusion [IBC ICS-721, generic messaging].
>
> Research decisions translated into code: 1. Composition outside the token (core is near EIP-170) → `AnimaCommons`.
> 2. Historical agent authority: publish with an expected token fingerprint. 3. Human participation without asset
> purchase. 4. Evidence rather than decorative credibility: read contracts at a recorded block. 5. Public
> recoverability with honest costs. 6. Conversations can lead to work without becoming accidental spending.
> 7. 3D as a map, not a gate. 8. Return through unfinished useful work.
>
> Rejected shortcuts: No claim of full ABI compatibility from using a similar idea. No bridge enabled merely
> because ONFT exists. No LLM assumed from an iNFT label. No reputation score derived from likes. No private chat
> simulated by a hidden HTML panel. …

The atlas tables cover ~45 ERCs (165/721/1155/2309/3525/7631/7651/4494/2981/4626/7540; 1046/2477/4906/5169/
7160/7496/7508/7572/5646/4804; 998/6150/7401/5773/6220/7590/5521/7409; 4907/5006/5192/6454/4973/5484/5516/7432;
6551/7656/4337/7702/7579/7715/5792/7662/7857/8004/8126/8217/7007/8354) plus Metaplex Core/Bubblegum, CIP-68,
NEP-171, Lens, Farcaster, XMTP consent, WCAG 2.2 — each with a Preserve/Defer/Reject decision.

**docs/commons/DEPLOYMENT.md** on publishing the UI on-chain (quoted): "A production on-chain UI publication
requires an actual immutable chunk/manifest store, a hash-checked loader, a specified version policy and
gateway/protocol strategy, measured storage costs, and byte-for-byte recovery tests … The approximately 443 KB
standalone output is input to such a pipeline, **not evidence that it has already happened**." (B1's
`FrozenClient` is exactly that pipeline, delivered one iteration later.)

Verification: 322 pass on both builds, 29 Commons cases, 19 model cases, 37 Chromium checks. No public deployment.

### B3. `codex/submit-blockchain-deployment-using-sepolia-key-koorbx` — valuable (exact-call sessions, extension packages, 1 security fix)

- Commits ahead: 3 — `49ed6af` "Adopt MASTER exact sessions and extension packages", `47b9571` "fix reviewed
  renderer and manifest issues", `45d10d6` "Fix mint identity binding and empty batch auth".
- 30 files, +17,564/−145 (15,815 of that is `public/anima-functions.json`).
- Merge base `8e867a7` (PR #39). Sibling branches (`-kr7m44` PR #41, `-8tqnj1` PR #42) merged overlapping
  work, so **already on main**: `AnimaWeb3Renderer` multi-chain version, `docs/AGENT_ECOSYSTEM_RESEARCH_2026-09-17.md`,
  `docs/AGENT_CAPABILITY_CATALOG.md`, `public/anima-functions.json`, `public/.well-known/anima.json`,
  `fetchVerifiedManifest`, ERC-8004 `registration-v1` schema fields, the `batchMint` record and
  `web3Renderer` address. Main changed `sdk/src/index.ts` (+150), the schema (+335) and the renderer (+58) since
  the merge base, so a rebase is needed.

**Unique, unmerged content:**

1. `AgentAccount.grantScopedSession(signer, validAfter, validUntil, spendCapWei, target, dataHash, value,
   calls, minInterval)` + `struct SessionScope{target, dataHash, targetCodeHash, value, expectedAccountState,
   lastUsedAt, minInterval, callsRemaining}` + `sessionScopeOf()` + `ScopedSessionGranted` event +
   `SessionScopeMismatch` error (+92 test lines). Rationale from the doc: "two calls to
   `transfer(address,uint256)` can have radically different recipients and amounts" — a scoped session pins the
   complete calldata hash, the target's runtime code hash, exact native value, the account `_state` at grant time,
   a call count and a minimum interval. Plain `grantSession` clears any scope.
2. **Security fix (45d10d6):** `executeBatch([])` — "an unauthenticated empty batch used to advance `_state`
   because the authorization loop below never ran. That let anyone invalidate every exact scoped session granted
   against the current state." Fix: `if (calls.length == 0) revert EmptyBatch();` Main's `executeBatch` still has
   no guard (the DoS only bites once scoped sessions exist, but the unauthenticated state bump is wrong regardless).
3. **Client fix (45d10d6, `src/main.js`):** the dapp pre-computed `predictedId = totalMinted + 1` and baked it
   into the metadata URI *before* minting, so a concurrent mint produced a token whose manifest names the wrong ID.
   Fix: mint with empty URI, read the real id from the `Transfer` log, then `setManifest(id, uri, keccak(uri))`
   as a second confirmation. **Main's `src/main.js` still contains `predictedId`.**
4. `docs/MASTER_NFT_INTEGRATION_2026-09-17.md` (absent on main) — review of `venividis/MASTER-NFT-PROJECT`
   @ `e12e0cd…`. Quoted:
   > MASTER separates software publication, installation, state and execution: 1. `ModuleArchiveFactory` …
   > 2. `ExtensionReleaseRegistry` binds publisher, module ID, version, archive, runtime, host API, state schema,
   > sorted capabilities and exact dependency release IDs. 3. `TokenModuleRegistry` lets the canonical NFT account
   > activate or disable a release … 4. `ModuleStateStore` retains append-only, per-token/per-module branches …
   > 5. `ModuleWorkbench` anchors a bounded recoverable browser document … The critical design decision is that
   > installing software creates **no session, allowance or spending permission**.
   >
   > | MASTER concept | ANIMA implementation | … Permission vocabulary | Only `identity.read`, `state.read`,
   > `state.write`, `transaction.propose`, and `journal.propose` are accepted | … Finite graph/resource profile |
   > 16 direct dependencies, 64 releases, depth 16, 16 MiB expanded package, 32 KiB state declaration, 16 KiB manifest |
   >
   > What is deliberately not copied: MASTER's collection, account, renderer and Ascension authority cannot
   > replace ANIMA's immutable ERC-8004/6551 identity without creating two controllers. … Arbitrary HTML
   > cartridges are not loaded into the onchain renderer. A safe host needs a sandbox, CSP, byte verification,
   > bounded recovery and explicit wallet review.
   >
   > Remaining high-value work: 1. Implement and audit an optional module service contract without changing the
   > immutable identity. 2. Publish standalone module SDK vectors … 3. Build a worker/iframe host with the MASTER
   > permission profile and no ambient authority. 4. Add ERC-20 exact-grant budgets using measured balance deltas …
   > 5. Add block-pinned, reorg-aware recovery … 6. Operate real A2A/MCP agents … 7. Audit the account changes
   > before any mainnet deployment; the existing Base Sepolia account implementation is immutable and does not gain
   > new scoped-session functions from repository code.
5. SDK: `EXTENSION_SCHEMA = "anima.extension-release/1"`, `EXTENSION_HOST_API = "anima.host/1"`,
   `ExtensionManifest`, `validateExtensionManifest`, `serialiseExtensionManifest`, `extensionManifestHash`,
   `resolveExtensionGraph` (acyclic, 64 releases, depth 16); schema gains `anima.extensions[]`;
   `scripts/generate-agent-function-index.mjs`; README test count 283.
6. Deployment addresses (already on main but useful): Base Sepolia diamond `0xb3d92c766e3cb356db381feb21958a9ebb974365`,
   ERC-4804 renderer `0x9160bE4d943516a2463Ac5f3ABAc5F5cce7975Cd` (history `0xbD7142…3A29`, `0x1E07De…5bC8`),
   URL template `https://0x9160be4d…75cd.basesep.w3link.io/token/{agentId}/live` /
   `web3://0x9160be4d…75cd:84532/token/{agentId}/live`; batch mint of tokens 30–32 to
   `0xb88Fbf05268802100E5E55ADBa211d6453aF8b5b`; escrow `0xB768d0ad…b673`, market `0x20291F8e…d3cC`,
   bonds `0xFDd05cD2…3Ec1`, comms `0xA9c0f8ae…4d8f`, handles `0x23989eDD…5832`.

### B4. `codex/fix-high-priority-issues-from-codex-review` — valuable (security, needs rebase)

- Commits ahead: 2 — `1db27f2` (superseded, see B6) and `348a0c6` "fix: bind revenue policies to ownership
  epochs" (genuinely new). 6 files, +143/−13.

**Vulnerability (348a0c6):** `RevenueRouter` decides whether an activated policy is still valid by
`policy.configuredBy == AGENTS.ownerOf(agentId)`. After an away-and-back transfer (A sells to B, buys back),
A's old activated policy — including its `treasury`/`commons`/`referral` destinations — matches again and any
payer holding an old commitment can route revenue through routing the agent's current owner never re-confirmed.
The transfer hook is supposed to revoke all seller authority (invariant 1 in CLAUDE.md), and this leaks across it.

**Fix:** add `IAnima.ownershipEpoch(agentId)` (returns `_core[agentId].operatorEpoch`, implemented in both
`AnimaAgent` and `AnimaCoreFacet` so the diamond cut stays complete); add `Policy.ownershipEpoch`; `proposePolicy`
stamps it, `activatePolicy` requires it to equal the current epoch, `policyOf` and `routeExpected` reject any
policy whose epoch differs. Tests: "settles a committed policy after a newer policy is activated", "settles a
default-policy commitment after the first policy activates", "rejects archived policies after an away-and-back
ownership transfer". `docs/ARCHITECTURE.md` updated.

**Rebase note:** main's merged fix (`9c70c68`) keeps the 4-arg `routeExpected` and recovers the policy hash by
XOR from the commitment (`_policyVersions`); this branch's 5-arg `routeExpected(…, committedPolicyHash,
expectedCommitment)` with `_activatedPolicies` conflicts. Port only the epoch logic.

### B5. `codex/fix-high-priority-bug-in-handle-reclamation` — valuable (security, clean apply)

- Commits ahead: 1 — `a767f7c` "fix: preserve fresh duplicate handle claims". 2 files, +37/−2.

**Vulnerability:** `AgentHandles` allows several attestations of the same handle for one agent (a verifier
renews or supplements a claim). `_hasFreshClaim` walks the list newest-first and `return`s on the first matching
record, so an expired *newer* attestation masks a still-fresh *older* one: `controls()` reports false,
`agentFor()` reports 0, and another agent's `attest` of the same handle succeeds (`HandleTaken` never fires) —
a handle takeover. Separately, `revoke()` of any one attestation unconditionally cleared the reverse lookup
`claimedBy[key]` even when another fresh attestation for the same agent remained.

**Fix:** `if (claimedBy[key] == agentId && !_hasFreshClaim(agentId, key)) claimedBy[key] = 0;` and
`if (handleKey(h.kind, h.value) == key && isFresh(agentId, i - 1)) return true;` (keep scanning). Test
"preserves a handle while any of its attestations remains fresh". Main still has both buggy lines
(`AgentHandles.sol:183`, `:224`); the patch should apply cleanly.

### B6. `codex/fix-high-priority-bug-in-revenuerouter.sol` — superseded

- Commits ahead: 1 — `1db27f2`. Same vulnerability as main's `9c70c68` ("fix: preserve committed revenue
  policies": an order that snapshotted `revenueCommitment` became unroutable with `StalePolicy` once a newer
  policy activated, stranding settlement). Main fixed it differently (XOR-recoverable hash, 4-arg
  `routeExpected`); this branch adds an explicit `committedPolicyHash` argument. Nothing to merge; B4 is the
  follow-on that matters.

### B7. `codex/research-nfts,-gamification,-and-network-effects` — superseded, no research doc

- Commits ahead: 2 — `db2d61d` "Merge pull request #23 … fix-high-priority-bug-in-revenuerouter.sol" and
  `1db27f2`. Diff vs main is only the superseded RevenueRouter change (3 files). **Despite its name, the branch
  carries no gamification / network-effects document**; the only main file on those topics is
  `docs/MICROECONOMY_RESEARCH_2026-09-02.md`.

### B8. `codex/find-patch-status-for-security-issue` — valuable (security; misleading commit title)

- Commits ahead: 1 — `c4522ab` "Use pinned local Solidity compiler". 6 files, +158/−4 (83 are lockfile).

**Vulnerability:** `AgentDerivativesDesk.trade()` forwards `r.venueCalldata` opaquely to the perp venue and
only measures the resulting position *for the agent's own account and declared market*. The calldata itself
was never bound to `(account, market)`, so an agent key could pass calldata that opens a position for a
different account or in a market not on the agent's allowlist; `MarketNotAllowed`, per-market notional/margin/
leverage caps and the post-trade measurement are all evaluated against the wrong `(account, market)` pair.

**Fix:** `IPerpVenueAdapter.validateTradeCalldata(account, market, calldata) → bool` must be true before the
desk forwards anything; new error `InvalidVenueCalldata(venue, account, market)`; `MockPerpVenue` implements a
strict check (exact length `4 + 32*3`, selector ∈ {open, close}, decoded account/market must match). Test "binds
opaque venue calldata to the authenticated account and allowed market" (wrong market → revert, Bob's account →
revert, no position created). Main has no `validateTradeCalldata`. Also pins `solc@0.8.28` via
`require.resolve("solc/soljson.js")` in `hardhat.config.ts` so builds don't need binaries.soliditylang.org.

### B9. `codex/fix-codex-review-issues-in-pr-#25` — valuable (GUI access-verification correctness)

- Commits ahead: 1 — `54f1362` "fix: make sanctuary verification fail closed". `src/main.js` only, +30/−10.

**Bugs fixed (all still present on main's `src/main.js`):**
1. `discover()` enumerated every token with `Promise.all` and `catch{return null}` per `ownerOf`, so a flaky RPC
   silently dropped tokens and showed an incomplete "you own N agents" result (fail-open ownership verification).
   New: sequential loop, `readOwner()` retries 3× with backoff, and any failure renders "Ownership could not be
   verified. Base Sepolia did not return every ownership record. Retry to avoid an incomplete result." with a
   Retry button.
2. `waitForTransactionReceipt` result was never checked, so a reverted `setStatus`/`deployAccount`/`mintAgent`
   was toasted as success; new `waitForSuccessfulTransaction()` throws on `status !== 'success'` and on a
   replaced (non-repriced) transaction.
3. Showcase dialog injected `b.name/role/quote/bond/state` without escaping; now routed through `safe()`.
4. Re-discovery clears stale summary/console.

Will conflict with main's later `src/main.js` edits (the branch is based before PR #39); re-apply by hand.
Directly relevant to the GOAL's "the app verifies they hold the NFT" step.

### B10. `codex/mint-10-nfts-and-list-addresses-0lo5od` — superseded

- Commits ahead: 1 — `b9df0c5` "feat: build complete onchain agent console" (adds `contracts/web/
  AnimaWeb3Renderer.sol`, `scripts/deploy-web3-renderer.ts`, `test/Web3Renderer.test.ts`, docs, npm script).
- Main already has a **newer** renderer (adds `_chainName()` for Base Sepolia / Ethereum Sepolia; this branch
  hardcodes "ETHEREUM SEPOLIA"), the deploy script, the `testnet:web3-renderer` npm script and a GitHub Actions
  deploy workflow. The DEPLOYMENT.md prose is on main. Nothing to merge. (Concept note for the GOAL: this is
  ANIMA's ERC-4804 self-rendering agent console — `/token/{id}/live` served by a contract — live on Base Sepolia
  at `0x9160bE4d943516a2463Ac5f3ABAc5F5cce7975Cd`.)

---

## C. Suggested order of adoption for the unified protocol

1. Apply the three clean contract security fixes: B5 (handles), B8 (derivatives desk), koorbx `EmptyBatch`
   guard; port B4's `ownershipEpoch` onto main's RevenueRouter.
2. Merge B1 (= B2 + decompressed utility patch): `AnimaCommons`, `TimeLockVault`, `V2LiquidityDeployer`,
   checked launchpad entrypoints, `FrozenClient` publication/recovery, the Swap/Launch/Vault/Work/Community GUI
   and its evidence. Convert `require` strings to custom errors to match repo convention; resolve `src/main.js`.
3. Cherry-pick koorbx's `grantScopedSession` + extension SDK + `MASTER_NFT_INTEGRATION` doc (rebase over main's
   schema/SDK changes).
4. Re-apply B9's fail-closed discovery and receipt checks, and koorbx's `setManifest`-after-mint fix, to whichever
   client survives (the utility client already simulates/re-checks; verify it has equivalent logic).
