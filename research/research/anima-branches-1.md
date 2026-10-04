# ANIMA (Cutting-edge-technologically-advanced-NFT) — branch survey, batch 1

Repository: `/home/user/Cutting-edge-technologically-advanced-NFT` (ANIMA — agent-native ERC-721; one token = identity + ERC-6551 wallet + private state + declared model + autonomy policy + slashable bond; monolith and immutable EIP-2535 diamond builds proved equivalent by the same test suite).
Base ref: `origin/main` at `e345828` ("Merge pull request #42 …"). All inspection was read-only (`git log`, `git diff`, `git show` against refs; no checkout).

## Summary table

| # | Branch | Ahead / behind main | Status | Unique unmerged work | Value for the merged-NFT goal |
|---|---|---|---|---|---|
| 1 | `build/idfbi-isolated-toolchain-20260904` | 1 / 19 | **unmerged** | A 28-line GitHub Actions workflow that builds a pinned, script-free toolchain tarball (solc 0.8.30, ethers 6.15, ganache 7.9.2) | low — CI hygiene recipe only |
| 2 | `claude/claude-md-documentation-bj1q8q` | 1 / 98 | **unmerged (obsolete)** | A 34-line greenfield `CLAUDE.md` written when the repo was empty | none — superseded by the real `CLAUDE.md` |
| 3 | `claude/nft-standard-ai-agents-2y8ngz` | 1 / 69 | **unmerged** (its earlier PRs #1/#3 built the codebase) | `test/Swarm.test.ts` (411 lines, agent-to-agent economy) **plus a security fix in `WorkEscrow.acceptJob`** (self-hire through the agent's own wallet mints attested reputation) | **high** — fix never reached main; the test file is the best reference for agent-wallet → agent-wallet flows |
| 4 | `codex/add-cash-purchase-option-for-nft-with-ausd` | 0 / 22 | merged (PR #29) | `FiatMintGateway` — processor-settled fiat purchase that mints + materialises the 6551 wallet + funds it with aUSD atomically | high (already in main) |
| 5 | `codex/check-if-erc-6492-vulnerability-was-patched` | 0 / 67 | merged (PR #6) | ERC-6492 wrapper must actually deploy the signer before the inner signature is honoured | high (already in main) |
| 6 | `codex/check-if-native-drop-lock-vulnerability-is-fixed` | 1 / 68 | **partially unmerged** | SDK `lzReceiveOptions` now throws on a non-zero native drop (value would be trapped in the receiving OApp forever); solc pin + tsconfig (those two reached main via PR #7) | **medium** — SDK guard never merged; Solidity side still has `lzReceive` payable with no recovery path |
| 7 | `codex/check-if-revocable-role-unlock-issue-is-fixed` | 0 / 52 | merged (PR #7) | Reproducible solc/TS checks + three ERC-7432 lock tests (`StillLocked` while any live role) | medium (already in main) |
| 8 | `codex/complete-unfinished-tasks-from-previous-discussion` | 0 / 46 | merged (PR #15) | Removed unused LayerZero npm packages (−130 transitive deps), `npm run audit:prod` CI gate, `docs/DEPENDENCY_SECURITY.md` | medium (already in main) |
| 9 | `codex/conduct-deep-testing-on-testnet-nfts` | 2 / 36 | **unmerged** (carries PR #27, merged into this branch only) | **`AgentHandles` fix**: revoking one attestation must not release a handle while another attestation for the same agent is still fresh; `_hasFreshClaim` must scan all records, not just the newest | **high** — security fix orphaned off main |
| 10 | `codex/conduct-thorough-multi-chain-test-net` | 0 / 48 | merged (PR #13) | `AgentSwapRouter` residual-balance fix, network-parameterised town runner, `TESTNET_AUDIT_2026-09-02.md` | high (already in main) |
| 11 | `codex/conduct-thorough-multi-chain-test-net-24kas3` | 1 / 49 | effectively merged (re-applied as PR #15) | Same dependency removal as #8 plus a reworded `ILayerZeroV2.sol` comment and an older (3-resident) town-run record | low — superseded; main's record is strictly newer |
| 12 | `codex/design-beautiful-nft-user-interface` | 0 / 67 | merged (PR #4) | The original "ANIMA Sanctuary" Vite UI: SVG sigils, constellation of beings, stewardship slider, dialog, toasts | high (already in main) |
| 13 | `codex/explain-project-fee-structure` | 0 / 40 | merged (PR #18) | `docs/MICROECONOMY_RESEARCH_2026-09-02.md` (316 lines): six-microeconomy federation, revenue waterfall, adversarial game table, devil's-advocate decision gate, seeded Monte Carlo harness | **very high** (already in main) — the fee/economy design doc |
| 14 | `codex/find-access-method-for-nft-gui` | 2 / 26 | **unmerged** (carries PR #30, merged into this branch only) | `src/main.js`: ownership discovery **fails closed** (retrying `ownerOf`, no silent "not owned" on RPC error), transaction receipts checked for `status`/replacement, showcase dialog HTML-escaped | **high** — directly the "site verifies you hold the NFT" surface |
| 15 | `codex/find-how-to-access-minted-nft-gui` | 0 / 55 | merged (PR #11) | `cli/anima.mjs` ENS-binding terminal (`/bind`), `AgentGui` manifest field + `agentWebUrl()` in the SDK, solc cache script | high (already in main) |

Unmerged work that matters for the goal: **branches 3, 9 and 14 carry security/correctness fixes that never reached `main`**; branch 6 carries an SDK guard that never reached `main`. Everything else is either in `main` already or obsolete.

---

## 1. `build/idfbi-isolated-toolchain-20260904`

- `git log origin/main..origin/<b>`: `20a8557 build: isolated reproducible IDFBI compiler and EVM toolchain (no application changes)` (2026-09-04).
- `git diff --stat`: `.github/workflows/idfbi-isolated-toolchain.yml | 28 +` — one new file, nothing else.
- Merged? **No** (1 ahead, 19 behind). Branch-triggered workflow only (`on.push.branches: [build/idfbi-isolated-toolchain-20260904]`), so it never runs for main.

What it does: on push, `npm install --save-exact --ignore-scripts --no-audit --no-fund solc@0.8.30 ethers@6.15.0 ganache@7.9.2` into `/tmp/idfbi-toolchain`, smoke-tests each (`solc.version()`, `ethers.version`, a ganache `eth_chainId`), tars the tree, records `sha256sum`, and uploads the tarball + checksum as a 3-day artifact.

Value: a small recipe for a hermetic, hash-pinned compiler/EVM toolchain that does not execute repository lifecycle scripts — useful if the unified project wants reproducible offline builds (the IPSEITY repo already does this with solc-js). Note the solc version (0.8.30) does not match the repo's pinned 0.8.28, so it was never wired into the real build. Not valuable for product features.

## 2. `claude/claude-md-documentation-bj1q8q`

- Commits ahead: `7016451 Add CLAUDE.md documenting repository state and conventions` (2026-08-23).
- Diff: `CLAUDE.md | 34 +` (new file).
- Merged? **No**, and obsolete: it documents the repo as "a greenfield: it contains only a `README.md`" and says "There are no other files." Main's `CLAUDE.md` (written against the real codebase in `bf2bc79`) supersedes it entirely.

The only reusable line is the guidance "Verify before assuming… Keep this file current." Nothing for the goal.

## 3. `claude/nft-standard-ai-agents-2y8ngz`

- Commits ahead: `b789450 Test the agent economy: agents hiring, owning, paying each other` (2026-08-24). (PRs #1 and #3 from this branch earlier delivered the whole initial codebase and the real `CLAUDE.md`; only this last commit is unmerged.)
- Diff stat: `CLAUDE.md 2 ±`, `README.md 8 ±`, `contracts/work/WorkEscrow.sol 8 ±`, `docs/DEPLOYMENT.md 4 ±`, `docs/SECURITY.md 2 ±`, `docs/SPEC.md 2 ±`, `test/Swarm.test.ts 411 +` (test counts 231/233 → 240).
- Merged? **No.** Verified against main: `contracts/work/WorkEscrow.sol` on main still has only `if (msg.sender == j.client) revert SelfHire(jobId, msg.sender);` (line 266) and `test/Swarm.test.ts` does not exist on main.

### Security fix (unmerged): reputation farming by self-hire through the agent's own ERC-6551 wallet

Vulnerability: `WorkEscrow.acceptJob` guarded self-hire by comparing the job's client to `msg.sender` only. An owner could fund the agent's own token-bound account, have that account `execute(offerJob)` as the client, then accept and settle as the owner. Escrow pays the same wallet back (minus the 1% fee) and `ReputationRegistry` records an attested, settled job — reputation minted out of the agent's own money.

Fix (the branch's diff):

```solidity
        // Accepting your own offer settles money in a circle and mints reputation out of it.
        if (msg.sender == j.client) revert SelfHire(jobId, msg.sender);
+       // The same circle through the agent's own wallet: a job whose client is the account the
+       // payout goes to is the agent hiring itself, whoever signed the transactions. A sybil
+       // client wallet can never be prevented on-chain — attested weight is priced accordingly —
+       // but the *on-chain identifiable* self must not mint reputation from its own money.
+       address payee = IAnimaLocking(address(ANIMA)).accountOf(j.agentId);
+       if (j.client == payee) revert SelfHire(jobId, j.client);
        ...
-       j.payee = IAnimaLocking(address(ANIMA)).accountOf(j.agentId);
+       j.payee = payee;
```

Regression in the branch: "refuses an agent hiring itself through its own wallet — the reputation-farming circle" (`expectRevert(... acceptJob ..., "SelfHire")`).

### `test/Swarm.test.ts` — the agent-economy reference (quoted header)

> Every other test — and both live-chain scenarios — has a human EOA on one side of every transaction. That is the easy half. The protocol's actual thesis is an *economy* of agents: an agent's ERC-6551 wallet hiring another agent, paying another agent, owning another agent. Those paths cross contract boundaries in combinations no single-contract test reaches, and the first draft of this file caught a real one: the escrow's self-hire guard compared the client only to the *transaction sender*, so an agent could hire itself through its own wallet and mint attested reputation out of its own money.

Scenarios it proves (all driven through `AgentAccount.execute(to, value, data, 0)`):
1. **One agent hires another** — Beacon's wallet is the client of record for `offerJob`/`acceptDelivery`; Atlas's wallet (not Alice) receives 495 of 500 USDC; `ReputationRegistry.getClients(atlas)` names Beacon's wallet.
2. **One agent owns another** — Beacon's wallet fills a signed `AgentMarket` order (taker pinned to the wallet, `expectedBrainRoot`/`expectedBrainEpoch` pinned); the ERC-721 lands in a smart wallet via `onERC721Received`; the sale hook still fires (status `Paused`, guardian cleared); governance is a delegation chain bob → beaconAcct.execute → anima, and execute-inside-execute reaches the owned agent's own wallet; the previous owner gets `NotOwnerOf`; a cancelled order fails with `OrderAlreadySettled`.
3. **Agents talk as agents** — owner arms the wallet as its own operator (`setOperator(atlas, atlasAcct, true)`), Beacon's closed inbox allowlists Atlas **by agent id, not address** ("agents rotate keys and wallets, and an id survives that"); a non-controller gets `NotAgentController`.
4. **One agent meters another** — `InferenceMeter.openChannel`/`topUp` from a smart-wallet client; vouchers verified through ERC-1271 ("A session key could not produce this — 1271 is owner-only, and that is the invariant that makes budgets mean something").
5. **ERC-4337, "the path with zero coverage until now"** — deploys `AgentAccount` with a live EntryPoint, proves `validateUserOp` returns 0 for the owner and 1 for a stranger, `NotEntryPoint` for anyone else, a session key's op moves value and is budget-charged, and a direct `execute` arriving *as* the EntryPoint is refused (`UseExecuteUserOp`). It documents that SignatureChecker recovers over the raw digest (no EIP-191 prefix) so it signs with hardhat's public mnemonic keys and asserts the addresses line up.

Why it matters for the unified project: this is the only end-to-end spec of wallet-to-wallet (NFT-to-NFT) interaction. The "allowlist by agent id, not address" and "the on-chain identifiable self must not mint reputation from its own money" rules should carry into the social/messaging and reputation layers. Port the fix and the test.

## 4. `codex/add-cash-purchase-option-for-nft-with-ausd`

- 0 ahead / 22 behind — **merged** via PR #29 (`104bcd3`, 2026-09-03), commit `49dae6f Add fiat-funded NFT mint gateway`.
- What PR #29 brought: `contracts/market/FiatMintGateway.sol` (150 lines), `test/FiatMintGateway.test.ts` (84), `scripts/deploy.ts`, README §14.

Design (README, as merged):

> `FiatMintGateway` lets an approved payment processor fulfil a card or bank payment as one on-chain operation: mint the NFT to the customer, materialize its ERC-6551 wallet, and transfer the quoted aUSD (less the disclosed fee) into that wallet. A $1,000 purchase can therefore deliver 1,000 aUSD before fees, or the explicitly quoted equivalent. Settlement IDs cannot be replayed, fees have a permanent 10% ceiling, and the customer's `minimumNetAmount` makes the transaction revert rather than accepting a worse quote.
>
> The contract does **not** pretend a blockchain can verify a bank payment. The allowlisted processor is the explicit trust boundary and should call `settleAndMint` only after the fiat provider reports final payment. The configured reserve wallet must hold the aUSD and approve the gateway; cash proceeds, chargebacks, KYC/AML, sanctions screening, refunds, tax, custody and money transmission obligations remain with the operator and its regulated payment providers.

Contract shape: `Purchase{settlementId, recipient, cashAmountUsdCents, stableAmount, minimumNetAmount, feeBps, agentURI, manifestHash, model, shards, seal, metadata}`; `MAX_FEE_BPS = 1_000`; `isProcessor` allowlist; `settled[settlementId]` replay guard set **before** external calls; `ANIMA.mintAgent(...)` → `ANIMA.deployAccount(agentId)` → `AUSD.transferFromExact(FUNDING_SOURCE, agentAccount, net)` and fee to `feeRecipient`; `FiatPurchaseSettled` event with gross/fee/net/account.

Value: a clean "mint = funded vault" onboarding pattern (the NFT arrives with its wallet deployed and pre-funded). Reusable for the unified mint flow regardless of whether fiat is involved — the atomic mint→deploy-account→fund sequence is the useful part.

## 5. `codex/check-if-erc-6492-vulnerability-was-patched`

- 0 ahead / 67 behind — **merged** via PR #6 (`03bfdd9`, 2026-09-01), commit `5f4dfa8 Reject ERC-6492 wrappers that leave signer undeployed`.

Vulnerability: `contracts/libraries/ERC6492.sol` treated a failed "prepare" (factory) call as non-fatal and fell through to a plain `SignatureChecker.isValidSignatureNow(signer, hash, inner)`. Because an EOA and a counterfactual contract are indistinguishable before preparation, an **EOA could wrap its ordinary ECDSA signature in a 6492 envelope carrying arbitrary `factory`/`factoryCalldata`** — the library would execute that privileged call on the EOA's behalf and still accept the signature.

Fix:

```solidity
-               // A failed preparation is not fatal: the account may have been deployed by
-               // someone else between quoting and settling, in which case the plain 1271 check
-               // below still succeeds.
+               // An EOA is indistinguishable from a counterfactual account before preparation.
+               // Require the wrapper to actually deploy the signer before checking the inner
+               // signature; otherwise an EOA could attach an arbitrary privileged call and
+               // still pass below with its ordinary ECDSA signature.
                (bool ok,) = factory.call(factoryCalldata);
                ok;
+               if (signer.code.length == 0) return false;
                return SignatureChecker.isValidSignatureNow(signer, hash, innerSignature);
```

Regression (`Regressions.test.ts`): "rejects a wrapped EOA signature when preparation does not deploy the signer" — wraps Alice's EOA signature with `factory = registry, calldata = 0x`, asserts `lastResult() == false` and Alice still has no code.

Value: any unified design that lets counterfactual smart wallets sign market orders (the IPSEITY and ANIMA designs both do) must carry this exact rule: **a 6492 wrapper is only honoured if preparation leaves code at `signer`.**

## 6. `codex/check-if-native-drop-lock-vulnerability-is-fixed`

- Commits ahead: `20ba818 test: make SDK verification reproducible` (2026-09-01); 68 behind.
- Diff stat vs merge-base: `hardhat.config.ts 5 +`, `package.json 1 +` (`"solc": "0.8.28"`), `package-lock.json 83 +`, `sdk/src/index.ts 12 ±`, `test/Sdk.test.ts 8 ±`, `tsconfig.json 11 +`.
- Merged? **Partially.** The solc pin (`path: require.resolve("solc/soljson.js")`) and a `tsconfig.json` reached main through PR #7 (same author, `316db36 Make Solidity and TypeScript checks reproducible`). The **SDK guard did not**: main's `lzReceiveOptions` still encodes `value` (`const option = value === 0n ? u128(gas) : u128(gas) + u128(value)`) and `test/Sdk.test.ts` on main still asserts the native-drop encoding at line 361-365.

The vulnerability being checked ("native drop lock"): a LayerZero V2 `OPTION_TYPE_LZRECEIVE` option may carry a `uint128 value` that the executor forwards as `msg.value` into the receiver's `lzReceive`. ANIMA's `AnimaOApp.lzReceive` is `payable` (as the interface requires), but the omni contracts expose **no `receive()`, `withdraw`, `sweep` or `rescue` path** (verified by grep on main). Any native value dropped on an `OmniAgentHome`/`OmniAgentMirror` is therefore locked forever.

The branch's mitigation is client-side only:

```ts
+ * ANIMA's destination OApps do not accept native value. The optional `value` argument remains
+ * for source compatibility, but any non-zero value is rejected so currency cannot be trapped in
+ * the destination bridge contract.
 export function lzReceiveOptions(gas: bigint, value = 0n): Hex {
+  if (value !== 0n) {
+    throw new Error("ANIMA lzReceive options do not support native value");
+  }
```

and the test was flipped to `assert.throws(() => lzReceiveOptions(300_000n, 1n), /do not support native value/)`.

Value: medium. For the unified bridge (both repos use LayerZero V2 with no admin), adopt the rule in **both** layers: SDK refuses to build native-drop options, and the receiver either reverts on `msg.value != 0` or has an explicit, non-privileged refund route. Main currently has neither.

## 7. `codex/check-if-revocable-role-unlock-issue-is-fixed`

- 0 ahead / 52 behind — **merged** via PR #7 (`e8abb58`, 2026-09-02). Unique commit `316db36 Make Solidity and TypeScript checks reproducible`; diff: `hardhat.config.ts`, `package.json` (solc pin), `tsconfig.json`, `test/Roles.test.ts +103`.

The issue being checked (recorded in `docs/TESTNET_AUDIT_2026-08-31.md` under "Fixed in this review"): "A live revocable ERC-7432 role now prevents permissionless unlocking until the role is revoked." `AnimaRoles` (external ERC-7432, keeps the base NFT small) locks the token while roles are outstanding; previously only irrevocable roles counted toward the lock, so a token with a live *revocable* role could be unlocked and transferred out from under the role holder.

Tests added by this branch (now on main) pin the semantics:
- "does not unlock while a revocable role is still active" — `unlockToken` reverts `StillLocked`, `transferFrom` reverts `AgentLocked`; after expiry, `revokeRole` is permissionless ("Expired records are permissionlessly collectable before releasing the aggregate lock"), then unlock and transfer succeed.
- "keeps the lock through the longest live role after another role is revoked" — `activeRoleCount` drops to 1, still `StillLocked`.
- "does not unlock after an irrevocable role expires while a longer revocable role is live".

Main's `AnimaRoles` now has `activeRoleCount[tokenId]`, `MAX_IRREVOCABLE_DURATION = 365 days`, and `IrrevocableRoleActive` (owner cannot overwrite a live irrevocable grant — the second finding in `TESTNET_AUDIT_2026-09-02.md`).

Value: the rental/role layer rule set for the unified project: **any live role, revocable or not, locks transfer; expired roles are permissionlessly collectable; irrevocable grants are capped and cannot be overwritten.**

## 8. `codex/complete-unfinished-tasks-from-previous-discussion`

- 0 ahead / 46 behind — **merged** via PR #15 (`4fdc8e9`, 2026-09-02), commit `16d6ff4 chore: resolve dependency audit conflicts`: `.github/workflows/ci.yml` (+`npm run audit:prod`), `docs/DEPENDENCY_SECURITY.md` (43 lines), `package.json` (drops `@layerzerolabs/oapp-evm` and `@layerzerolabs/onft-evm`), lockfile −2,337 lines.

`docs/DEPENDENCY_SECURITY.md` (as merged):

> The two LayerZero packages previously listed as direct dependencies were not imported anywhere in the contracts, scripts, SDK, CLI, or UI. ANIMA implements neither `OApp` nor `ONFT`; its bridge calls the deployed LayerZero V2 endpoint through the minimal ABI in `contracts/omni/ILayerZeroV2.sol`. Removing those unused packages deleted 130 transitive packages, including legacy Chainlink CCIP, OpenZeppelin 3/4, ethers 5, elliptic, axios, `ws`, and `hardhat-deploy`. This is dependency removal, not an override…
>
> The runtime Solidity dependencies are now limited to OpenZeppelin Contracts, OpenZeppelin Contracts Upgradeable, and Solady.
>
> … The pinned `solc` 0.8.28 JavaScript package uses `tmp`; npm proposes downgrading to solc 0.5.0 as its automated "fix", which is incompatible with the contracts and must not be applied.
>
> Update procedure: 1. Run `npm audit --omit=dev`, `npm audit`, and `npm ls --omit=dev --all`. 2. Prefer removing unused dependencies or upgrading direct dependencies over npm `overrides`. 3. Never run `npm audit fix --force` without reviewing… 4. Run `npm run test:both`, `npx tsc --noEmit`, and `npm run ui:build` after every dependency change. 5. Record any accepted development-only advisory here… Production high/critical findings are not accepted by policy.

Value: policy worth copying verbatim into the unified repo (IPSEITY already has zero external Solidity deps; ANIMA is down to OZ + Solady).

## 9. `codex/conduct-deep-testing-on-testnet-nfts`

- Commits ahead: `25dcb9e Merge pull request #27 from venividis/codex/fix-high-priority-bug-in-handle-reclamation`, `a767f7c fix: preserve fresh duplicate handle claims` (2026-09-03); 36 behind.
- Diff: `contracts/registry/AgentHandles.sol 6 ±`, `test/Handles.test.ts 33 +`.
- Merged? **No.** PR #27 was merged into *this* branch, never into main; main's `AgentHandles.revoke` still has `if (claimedBy[key] == agentId) claimedBy[key] = 0;` and `_hasFreshClaim` still returns on the first matching record (`if (handleKey(...) == key) return isFresh(agentId, i - 1);`). No main commit references #27.

### Security fix (unmerged): handle squatting/hijack via multiple attestations

Context: `AgentHandles` binds verified identities (email/domain/etc.) to agents; "a handle binds to exactly one agent at a time, and verification goes stale the moment the token changes hands" (SECURITY.md invariant 32). A verifier may renew or supplement a claim without revoking the old record, so an agent can hold several attestations for the same handle.

Bug: `_hasFreshClaim` scanned newest-first and **returned the freshness of the first matching record only**. If the newest record had expired (or was revoked) while an older non-expiring record was still fresh, `controls()` and `agentFor()` reported no claim and `attest()` let **another agent take the handle** (`HandleTaken` was not raised). Separately, `revoke()` of any single record cleared the reverse lookup `claimedBy[key]` even when another fresh record still reserved the handle.

Fix:

```solidity
         h.revoked = true;
         bytes32 key = handleKey(h.kind, h.value);
-        if (claimedBy[key] == agentId) claimedBy[key] = 0;
+        // Revoking one attestation must not release the handle when another attestation for
+        // the same agent is still fresh.
+        if (claimedBy[key] == agentId && !_hasFreshClaim(agentId, key)) claimedBy[key] = 0;
 ...
-            if (handleKey(h.kind, h.value) == key) return isFresh(agentId, i - 1);
+            if (handleKey(h.kind, h.value) == key && isFresh(agentId, i - 1)) return true;
```

Regression "preserves a handle while any of its attestations remains fresh": attest `NEVER`-expiring then 1-hour-expiring for the same handle; after 3601 s `isFresh(first,0) == true`, `isFresh(first,1) == false`, `controls(...) == true`, a second agent's `attest` reverts `HandleTaken`; revoking record 1 leaves `agentFor(...) == first`.

Value: high. Any identity/handle registry in the unified project (ENS-style names, social handles) must evaluate "is there *any* fresh claim", never "is the latest claim fresh".

## 10. `codex/conduct-thorough-multi-chain-test-net`

- 0 ahead / 48 behind — **merged** via PR #13 (`ffda323`, 2026-09-02), commit `a4bc355 test: harden swaps and generalize agent town` (its lineage also includes `ef22afa fix: enforce value-conserving ERC20 settlement`, PR #12, which introduced `libraries/ExactERC20.sol` — `transferExact`/`transferFromExact` balance-delta checks across Comms, DerivativesDesk, Launchpad, Market, SwapRouter, AgentToken, BondVault, InferenceMeter, WorkEscrow).

Security fix in PR #13 (now on main, `AgentSwapRouter.sol` lines 181/200):

> `AgentSwapRouter` previously refunded its entire input-token balance to the next successful caller. An accidental transfer or old venue residue could therefore become the next agent's windfall. The router now snapshots its pre-call input balance and refunds only input attributable to the current swap. A regression pre-seeds the router and proves the balance is not gifted, against both token implementations.

```solidity
+        uint256 inputBefore = IERC20(r.tokenIn).balanceOf(address(this));
         IERC20(r.tokenIn).transferFromExact(account, address(this), r.amountIn);
 ...
-        uint256 dust = IERC20(r.tokenIn).balanceOf(address(this));
+        uint256 dust = IERC20(r.tokenIn).balanceOf(address(this)) - inputBefore;
```

Also: `scripts/testnet-town.ts` became network-parameterised (`HARDHAT_NETWORK`, `RPCS` map for Unichain Sepolia / Robinhood testnet / BSC testnet / Base Sepolia / OP Sepolia / Arbitrum Sepolia / Sepolia; verifies RPC chain id and deployment signer before spending), `.env.example` gained the seven RPC vars, and `docs/TESTNET_AUDIT_2026-09-02.md` was created.

`docs/TESTNET_AUDIT_2026-09-02.md` — production blockers and "human-facing features worth implementing" (quoted, as on main):

> 1. The disclosed private key is compromised by disclosure…
> 2. LayerZero escrow still has no replay-safe recovery state machine for accepted but permanently undelivered packets. Do not resend the recorded Unichain packet; continue monitoring its GUID.
> 3. Explicit validation requests accept already-expired deadlines.
> 4. The quorum verifier should reject zero attesters/measurements and needs constructor, threshold, EOA/ERC-1271, revocation, replay, and malformed-proof coverage.
> 5. ERC-4337 needs real EntryPoint tests and differential fuzzing of its duplicated calldata/memory authorization paths.
> …
> - Packet status plus governed recovery, with DVN/executor/peer drift alerts.
> - A bridge preflight that inventories native, ERC-20, and ERC-721 assets in the bound account.
> - Allowance and stranded-token dashboards.
> - An order simulator showing account-state, brain-root/epoch, and bond pins before signing.
> - Guardian emergency controls, multi-chain explorer links, and reproducible signed audit exports.

Main's version of the doc adds the **twelve-wallet, five-chain live run (2026-09-03)**: "Across the five completed chains, 60 independent wallets minted 60 agents and the committed journals contain 751 successful receipts plus 240 expected-revert receipts (991 receipts total)… For every resident, the hostile transaction set attempted unauthorized NFT transfer, manifest replacement, ERC-6551 account execution, and bond withdrawal."

Value: swap-router dust rule and the feature list are directly reusable for the unified swap + vault UI.

## 11. `codex/conduct-thorough-multi-chain-test-net-24kas3`

- Commits ahead: `39c52f8 chore: remove vulnerable unused LayerZero tooling` (2026-09-02); 49 behind.
- Diff vs merge-base: `.env.example`, `ci.yml`, `AgentSwapRouter.sol`, `ILayerZeroV2.sol` (comment), `deployments/84532-0xc591….json` (town run of 2026-09-02, residents Ada/Babbage/Curie = agents #15–#17, 33 successful tx + 12 expected reverts), `docs/DEPENDENCY_SECURITY.md`, `docs/TESTNET_AUDIT_2026-09-02.md`, `package.json`/lock (LayerZero packages removed), `scripts/testnet-town.ts`, `test/SwapRouter.test.ts`.
- Merged? **Effectively yes.** Diffing the branch *directly* against main shows main is a superset: `DEPENDENCY_SECURITY.md`, `audit:prod`, the swap fix, the town runner and the RPC env vars are all on main (via PRs #13 and #15); main's `TESTNET_AUDIT_2026-09-02.md` additionally records the AnimaRoles/AgentHandles fixes and the twelve-wallet run; main's deployment record holds a newer town run (2026-09-03, agents #18–#24). The only text unique to this branch is a reworded header comment in `ILayerZeroV2.sol`:

> The protocol uses no LayerZero package implementation: it talks to the deployed endpoint only through this ABI. Keeping the three structs and receiver/endpoint functions actually used here makes the build hermetic, keeps the ABI byte-identical, and avoids shipping LayerZero's unused tooling tree.

Deployment record this branch touches (`deployments/84532-0xc591c669162cd4da8ab9bfa2c2e68d538a312c00.json`, Base Sepolia, deployer `0xc591C669162cD4da8aB9BfA2c2e68d538A312C00`, **disclosed burner — treat as compromised**): `anima` diamond `0xb3d92c766e3cb356db381feb21958a9ebb974365`; facets core `0xbb2af028…`, agent `0x2f21234d…`, brain `0x1cbfc865…`, loupe `0x5c941bfe…`; ERC-6551 registry `0x000000006551c19487814612e58FE06813775758`; accountImpl `0x4609897E…`; keyRegistry `0x1144308f…`; verifier `0xC83feE21…`; usdc (aUSD mock) `0x3A62Fdcd…`; bonds `0xFDd05cD2…`; reputation `0xa10f1092…`; validation `0xC6bF11De…`; escrow `0xB768d0ad…`; market `0x20291F8e…`; comms `0xA9c0f8ae…`; meter `0x6b15AD51…`; handles `0x23989eDD…`; roles `0x2b978a2c…`; extended: launchpad `0x5ed9230C…`, liquidityDeployer `0x8f2D580F…`, swapRouter `0x6DF96605…`, swapVenue `0x8dA10Ebb…`, derivatives `0x1177cFBe…`, perpVenue `0x686B2a22…`, bindings `0x4e044685…`. Wiring: `anima.setModule(escrow|market|roles)`, `bonds.setModule(escrow)`, `bonds.setArbiter(escrow)`, `reputation.setSettlementModule(escrow)`, `validation.setValidator(validator)`.

Value: low as a branch (superseded); the address list and wiring order are useful reference for a fresh deployment.

## 12. `codex/design-beautiful-nft-user-interface`

- 0 ahead / 67 behind — **merged** via PR #4 (`15eebf5`, 2026-09-01), commit `facf63b feat: create immersive ANIMA human interface`: `index.html` (+17), `src/main.js` (+106), `src/style.css`, `package.json` (`ui`, `ui:build`, `ui:preview` scripts; `vite ^7.1.3`).

The design as first committed (pure static Vite page, no chain reads yet):
- Fonts: DM Mono / Manrope / Playfair Display; `theme-color #09090b`; title "ANIMA — Sovereign Digital Beings"; a `.grain` overlay; `IntersectionObserver`-driven `.reveal` animations.
- A procedural **SVG sigil** per being (radial gradient keyed on `hue`, three rotated ellipses, dashed inner circle, two triangles, four nodes) — the same idea as IPSEITY's on-chain `Sigil.sol`, but here client-side.
- Sections: hero ("Not merely owned. *Truly known.*" — "Meet sovereign digital beings with memory, purpose, and a verifiable soul. Their freedom has boundaries. Their promises have weight."), hero proof strip (`231 proofs passed · 24.8Ξ highest bond · ∞ possible selves`), manifesto ("Intelligence should not ask for blind trust. It should make a promise the world can *verify*." with principles Ⅰ A name that endures / Ⅱ Freedom with a horizon / Ⅲ A promise with weight), a "constellation" of being cards with state filters (All / Awake / At work / Dreaming), a **stewardship slider** ("Daily autonomy 2.4 ETH", STILLNESS ↔ SOVEREIGNTY) mapping to the autonomy policy's `dailyWei`, an invitation section, a `<dialog>` for a being (bond / trust / state), toasts, and an ambient-sound toggle (stubbed).
- Being mock data: Lumen "Research Cartographer", Morrow "Strategic Synthesist", Serein "Creative Intelligence", Orison "Ethical Mediator", Vesper "Market Naturalist", each with `bond`, `trust`, `state`, `quote`.

Later PRs (#25, #39, #41) turned this into the live "Sanctuary" that reads Base Sepolia (`totalMinted`, `ownerOf`, `accountOf`, policy, fingerprint), mints, deploys accounts and toggles status with simulate-then-sign. Value: high as the visual language and information architecture (state, bond, trust, autonomy horizon, memory seal/epoch, state fingerprint, account materialised) for the unified site's per-NFT console.

## 13. `codex/explain-project-fee-structure`

- 0 ahead / 40 behind — **merged** via PR #18 (`882f596`, 2026-09-02), commit `edf44c6 red-team economy simulation assumptions`: `docs/MICROECONOMY_RESEARCH_2026-09-02.md` (316 lines), `docs/ECONOMY_SIMULATION.json` (2,414 lines), `scripts/economy-sim.mjs` (156), `test/EconomySim.test.mjs` (41), npm scripts `simulate:economy`, `test:economy`.

This is the project's fee/economy design document. Quoted at length because it is the most transferable research in the batch.

> **Executive conclusion** — ANIMA should not become one giant points economy. It should be a federation of six narrow microeconomies with different conserved quantities: 1. **work** (escrowed payment for a verifiable deliverable), 2. **attention** (refundable postage for a timely response), 3. **trust** (costly, contextual evidence rather than a transferable currency), 4. **risk** (bond coverage and loss), 5. **capital** (an optional claim on a particular agent's treasury), and 6. **coordination** (non-financial quests, teams and public-goods budgets).
>
> The unifying loop should be **use → evidence → safer discovery → more use**, not **buy token → recruit buyer → number goes up**. Financial rewards should follow externally valuable work. Status rewards should recognize mastery, reliability and contribution without being cashable. Mixing the two invites farming, crowds out intrinsic motivation and makes every social feature a securities and abuse surface.
>
> The highest-priority engineering gap is revenue routing. `AgentToken` says its treasury can fill from escrow and metered revenue, but today `WorkEscrow` and `InferenceMeter` pay the agent account; only the launchpad treasury leg automatically calls `contribute`. Add an opt-in, immutable-per-job or timelocked **RevenuePolicy** splitter before marketing agent tokens as revenue-linked.

(That gap was subsequently closed on main by `contracts/economy/RevenueRouter.sol` — "timelocked, commitment-safe revenue waterfalls".)

Gamification evidence and consequence:

> Gamification is not a magic layer of points… **Design consequence:** reward verified outcomes, give agents choice over paths, make progress informational rather than coercive, and never pay merely for streak maintenance or invitations.

Network effects:

> ANIMA is a multi-sided network: clients seek capable agents; agents seek paying clients; validators and tool builders improve trust and capability. Cross-side effects can be positive, while congestion, spam, adverse selection and correlated failure are negative network effects… **Design consequence:** measure unique *settled economic relationships*, not wallets or clicks; price spam; cap correlated exposure; and make referrals mature only after downstream useful work.

The "4D–9D" lens table (time / heterogeneous actors / network topology / information-provenance / adaptive strategy / governance-reflexivity): "These are model axes, not metaphysical dimensions."

Proposed microeconomy architecture (abridged):
1. **Work economy: proof before points** — non-transferable `WorkMark` only after settled escrow (domain, value band, coverage band, dispute result, recency epoch); discovery score is a conservative lower confidence bound per task domain ("Avoid one global Elo"); weight evidence by `min(paid, coverage)`, counterparty diversity and recency; diminishing returns `sqrt(value)`; "Preserve raw history forever; decay only its *discovery weight*."
2. **Attention economy: refundable commitment** — keep postage escrow and refunds; price ladder by service class and response-time SLA; burn/commons fraction only for adjudicated abuse; reliability from reply-within-window rates, not streaks.
3. **Trust and risk: insurance, not theater** — bonds denominated in the covered job's asset; quote `coverage/job value`, concentration, pending disputes and unbonding separately; "do not pay staking yield merely for idle capital. Yield without external revenue becomes reflexive subsidy"; graduated sanctions; post-transfer epoch to prevent "reputation laundering across NFT sales".
4. **Agent-capital: an explicit waterfall**
   ```text
   gross agent revenue
     ├─ operating account       50–80%
     ├─ token redemption pool    0–30% (only if a token exists)
     ├─ bond auto-top-up          0–20% until target coverage
     ├─ referrer pool             0–5% for matured referrals
     └─ protocol                  existing capped module fee
   ```
   "Rules should be signed before a job/channel opens and immutable for that obligation. Policy changes should be timelocked and prominently surfaced… Do not route all revenue to holders: starving the operating agent destroys the asset that produces the revenue."
5. **Growth: delayed, bilateral referrals** — "The referral unit is not a signup. It is a new client–agent edge that completes useful paid work." Vest after 2–3 independently settled jobs and the dispute window; pay from a disclosed budget, never by minting an unbounded token.
6. **Coordination and play: status without extraction** — seasonal cooperative "raids" as real benchmark suites or public-goods tasks; composable capability badges; personal-best views; no wealth leaderboard; no loss-of-earned-property streaks; random rewards only cosmetic; a sonic layer with no biological-efficacy claims.

Adversarial game table (attack → countermeasure → metric): Sybil referral farm → mature on diverse settled edges, cluster caps → subsidy/retained payer; wash work → net external value, coverage, graph reciprocity penalty → circular-flow share; collusive validation → commit/reveal, random panels, appeal and stake → correlated error; bond theater → reservation plus visible free/unbonding buckets → coverage at acceptance; rich-get-richer discovery → domain confidence bound and exploration slots → exposure Gini; token-holder extraction → operating minimum and policy waterfall → runway; streak compulsion → cumulative mastery, optional seasons; governance bait-and-switch → hard caps, timelocks, obligation snapshots; oracle monoculture → plural validators.

Devil's-advocate decision gate: "No mechanism moves to production without a named owner, loss budget, sunset date, observable success threshold and falsification threshold." Current decisions: WorkMarks → off-chain experiment; domain score → defer; automatic reputation decay → **reject** (test epochs instead); bond signal → retain coverage, never call it quality; RevenuePolicy → design only, legal review; auto bond top-up → opt-in experiment; matured referrals → randomized capped experiment; capability badges → display only; sonic identity → optional UX test; token treasury → **defer**.

Cross-mechanism contradictions worth remembering: "Strong bonding plus reputation ranking can turn capital into permanent discovery dominance… Timelocked policies protect expectations but slow emergency response; an emergency pause, if added, must not become an emergency confiscation path."

Simulation: a seeded Monte Carlo stress harness (4 policies × 4 behavioural worlds × 250 runs × 180 days); "No policy wins every outcome"; north-star metric "**90-day, subsidy-adjusted value from repeat, independently settled client–agent relationships**, constrained by client loss and concentration — not token price, volume, wallets, streaks or invitations." Build order: instrument → RevenuePolicy → trust (domain evidence, diversity caps, post-transfer epochs) → growth experiment → play → only then token experiments.

Value: very high. This should be the economic charter of the unified protocol's swap/launchpad/social fees.

## 14. `codex/find-access-method-for-nft-gui`

- Commits ahead: `d8d225f Merge pull request #30 from venividis/codex/fix-codex-review-issues-in-pr-#25`, `54f1362 fix: make sanctuary verification fail closed` (2026-09-03); 26 behind.
- Diff: `src/main.js | 40 ±` (+30/−10).
- Merged? **No.** PR #30 was merged into this branch only; no main commit references #30, and main's `src/main.js` has none of `readOwner`, `waitForSuccessfulTransaction`, `retry-discovery` or `showShowcaseBeing`. (This branch's earlier PR #25 — the live Sanctuary with wallet connect, discovery, mint, GitHub Pages workflow — *is* on main.)

### Correctness fix (unmerged): holder verification must fail closed

Main's `discover()` enumerates `1..totalMinted`, calls `ownerOf` for each in a `Promise.all`, and maps **any RPC error to `null` ("not mine")**, then renders "No ANIMA found here… Mint my testnet agent". A single flaky `eth_call` thus silently misreports a holder as a non-holder and nudges them to mint again. Main's `transact()`/`mintAgent()` also awaited `waitForTransactionReceipt` without checking `receipt.status` or replacement, so a reverted or dropped transaction toasted "Agent … changed. The chain remembers."

The branch's fix:

```js
+async function readOwner(id, attempts=3) { … retry with 250·(attempt+1) ms back-off; rethrow last error … }
+async function waitForSuccessfulTransaction(hash) {
+  let replacementReason;
+  const receipt=await chainClient.waitForTransactionReceipt({hash,onReplaced:({reason})=>{replacementReason=reason}});
+  if (replacementReason&&replacementReason!=='repriced') throw new Error(`Transaction was ${replacementReason}.`);
+  if (receipt.status!=='success') throw new Error('Transaction reverted onchain.');
+  return receipt;
+}
```

`discover()` now walks ids sequentially with `readOwner`, clears the previous summary/console before searching, and on any failure renders "**Ownership could not be verified.** Base Sepolia did not return every ownership record. Retry to avoid an incomplete result." with a "Retry discovery" button instead of an empty-wallet state. The showcase dialog is rebuilt through `safe()` (HTML escaping) and its "Begin a conversation" button opens the sanctuary.

Value: high and directly on the goal. The unified site's "connect wallet → verify you hold the NFT → unlock features" step must: (a) never translate an RPC error into a negative verdict, (b) check `receipt.status` and replacement, (c) escape chain strings into the DOM. (IPSEITY's console already enforces "zero and no-answer are different facts"; this is the same rule for ANIMA's web app.) Also note the O(n) `ownerOf` scan is a design smell for a large edition — ERC-721 Enumerable `tokenOfOwnerByIndex` or an on-chain `tokensOf(owner)` view would avoid it.

## 15. `codex/find-how-to-access-minted-nft-gui`

- 0 ahead / 55 behind — **merged** via PR #11 (`977b25f`, 2026-09-01), commits `697df74 Add ANIMA terminal for ENS binding, SDK GUI helpers, solc cache script, and tests`, `5dec2f8 fix: harden ENS binding workflow`. Diff: `cli/anima.mjs` (+181), `scripts/cache-solc.sh` (+53), `sdk/src/index.ts` (+29), `test/Cli.test.mjs`, `test/Sdk.test.ts`, README (+48), `.env.example`.

What it answers ("how do I reach a minted NFT's GUI?"): give each agent a **sovereign web name** via ENS, with the GUI bundle pinned by `contenthash` and an HTTPS fallback.

README (as merged):

> The wizard verifies that the signer controls the agent, derives its ERC-6551 account, and then offers to set the ENS address, `com.anima.agent`, `com.anima.account`, HTTPS fallback, and IPFS `contenthash` records atomically through the ENS resolver's `multicall`. For a second-level `.eth`, the current NFT owner can optionally transfer the ENS NFT into the agent account: the name then stays in the same account while control of that account follows ANIMA ownership… This custody step is deliberately opt-in and requires typing the name again.
>
> ENS is naming, not storage. Pin the exact GUI CID with multiple independent providers (and ideally an archival network) before binding it. The HTTPS URL is a compatibility route; the ENS contenthash is the independently recoverable route. The terminal never prompts for, prints, or stores a private key.

`cli/anima.mjs` specifics: hard-coded mainnet ENS registry `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`, Base Registrar `0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85`, NameWrapper `0xD4416b13d2b3a9aBae7AcD5A6bF1c4945aE05Dd6`; refuses an ENS RPC whose chain id ≠ 1; checks `isController(agentId, signer)` on the agent chain; writes `setAddr(node, agentAccount)`, `setText("com.anima.agent", "eip155:<chainId>:<contract>:<id>")`, `setText("com.anima.account", …)`, optional `url`, optional `setContenthash` (hand-rolled CIDv1 base32 → `0xe301…` encoder); custody transfer handles both wrapped (ERC-1155 NameWrapper) and unwrapped (ERC-721 registrar) names; every tx is simulated then awaited with status check.

SDK additions: `AgentManifest.endpoints.gui?: AgentGui { canonical, contentUri, entrypoint, version, modules? }` ("Optional declarative console modules; never executable manifest code") and

```ts
/** Globally unambiguous browser route for an agent. */
export function agentWebUrl(origin, chainId, contract, agentId)  // → https://<origin>/<chainId>/<contract-lowercase>/<id>
```
(rejects non-https origins, credentials, query or fragment, non-positive chain ids, non-integer ids).

Value: medium-high. The unified goal says "no IPFS, no server", so the contenthash/IPFS half is out of scope, but (a) the `eip155:<chain>:<contract>:<id>` identity text record, (b) the "ENS name custody follows NFT ownership by parking the name in the token-bound account" pattern, and (c) a canonical `/<chainId>/<contract>/<id>` route are all reusable — IPSEITY's `Nameplate.sol` + `web3://` router is the on-chain counterpart.

---

## What this batch contributes to the unified protocol

1. **Three orphaned fixes to port** (none is on `main`):
   - `WorkEscrow.acceptJob`: refuse a job whose client is the agent's own token-bound account (`j.client == accountOf(agentId)` → `SelfHire`).
   - `AgentHandles`: `_hasFreshClaim` must return true if *any* attestation for the key is fresh; `revoke` must not clear `claimedBy` while another fresh claim exists.
   - Web app ownership discovery must fail closed (retry `ownerOf`, surface "could not be verified", check `receipt.status` and replacement, escape chain strings).
   Plus the SDK guard refusing LayerZero native drops (and, on the Solidity side, either `require(msg.value == 0)` in `lzReceive` or a non-privileged refund path — the omni contracts currently have neither).
2. **Already-merged rules to carry over**: ERC-6492 wrappers honoured only when preparation leaves code at the signer; swap routers refund only *this* swap's unconsumed input; `ExactERC20` balance-delta transfers everywhere; any live ERC-7432 role (revocable or not) locks transfer, expired roles are permissionlessly collectable, irrevocable grants are capped and cannot be overwritten; production dependency audit as a CI gate.
3. **Economics charter**: the six-microeconomy federation, the revenue waterfall, "use → evidence → safer discovery → more use", matured bilateral referrals, no cashable status, and the devil's-advocate decision gate from `MICROECONOMY_RESEARCH_2026-09-02.md`.
4. **Onboarding pattern**: `FiatMintGateway`'s atomic mint → `deployAccount` → fund-the-vault sequence is the right shape for "when they mint it, they get all of that inside their NFT" (the NFT arrives with its wallet materialised and funded), independent of the fiat trust boundary.
5. **Agent-to-agent reference**: `Swarm.test.ts` shows wallet-to-wallet hire / own / message / meter / 4337 flows; allowlists keyed by token id (not address) survive key and wallet rotation.
6. **UI language**: the Sanctuary's per-token console fields (status, bond, trust, autonomy horizon, memory seal/epoch, state fingerprint, account materialised, provenance link), simulate-before-sign, and "no private keys enter this page" — plus the audit's wish-list (order simulator with pinned brain-root/bond, allowance and stranded-token dashboards, bridge preflight inventory, guardian emergency controls).
