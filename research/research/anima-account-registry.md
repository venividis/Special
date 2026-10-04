# ANIMA — ERC-6551 account + registries: research dossier

Repository: `Cutting-edge-technologically-advanced-NFT` (ANIMA), checkout `/home/user/Cutting-edge-technologically-advanced-NFT`, default branch `main`, HEAD `e345828b7bee393022d512ace90c6d5e710b2fce` (2026-09-16).
Area: `contracts/account/AgentAccount.sol` and `contracts/registry/{BondVault,ReputationRegistry,ValidationRegistry,AgentHandles,AnimaRoles,AnimaBindings}.sol`, plus the interfaces they depend on (`contracts/interfaces/IAnima.sol`, `IERC6551.sol`, `IERC7432.sol`, `IERC8004.sol`, `IERC8126.sol`) and the library `contracts/libraries/ExactERC20.sol`.
Method: every file above was read in full with `cat -n`/`sed`; nothing in the repo was modified; no build or test was run (bytecode sizes below are read from the pre-existing `artifacts/` directory, compiled with solc 0.8.28 / viaIR / optimizer runs 200 / evm cancun).

---

## 0. Executive summary

ANIMA is an "agent-native" ERC-721 where one token is one AI agent. My area is the two layers that make a token *act* and *answer for itself*:

- **`AgentAccount`** — the per-token ERC-6551 wallet (ERC-1167 clone of one implementation, address derived from the canonical registry `0x000000006551c19487814612e58FE06813775758`). Its distinguishing feature is the *leash*: the token owner is unrestricted, but **session keys** (the keys an autonomous agent actually runs with) are bounded by the `AutonomyPolicy` published on the token (per-tx cap, rolling daily cap, target/selector allowlist or merkle root, delegatecall flag, expiry), by a per-key lifetime budget, and by the agent's live status (a paused/disputed agent cannot spend). It also keeps an append-only **audit hash chain** over every executed call, bumps ERC-6551 `state()` on every authorisation change so buyers can pin it, refuses ERC-1271 signatures from session keys, and implements an ERC-4337 path whose user operations must enter via `executeUserOp` so the responsible session key is charged.
- **Registries** — six standalone contracts that give the token accountability without adding bytes to it (the monolith is at 23,971/24,576 bytes): `BondVault` (slashable ERC-20 stake with reserve/unbond/slash accounting), `ReputationRegistry` (ERC-8004 feedback plus a constant-time *customer-attested, stake-weighted* aggregate), `ValidationRegistry` (ERC-8004 validation with expiring, opener-namespaced requests plus ERC-8126 security attestations), `AgentHandles` (verifier-attested email/domain/DID/ENS/social/mesh-peer/phone/API-key handles, one handle per agent, stale on transfer), `AnimaRoles` (ERC-7432 roles registry that locks the token in place instead of escrowing it), `AnimaBindings` (ERC-8217 immutable binding of an ERC-8004 agent id to a master NFT).

Measured: `AgentAccount` runtime 10,709 bytes; the six registries total 32,570 runtime bytes (BondVault 5,714; ReputationRegistry 9,159; ValidationRegistry 6,024; AgentHandles 4,879; AnimaRoles 5,107; AnimaBindings 1,687). `accountOf` costs 26,863 gas on the monolith and 31,594 on the diamond (+4,731). The suite has **268** `it()` cases in `test/*.test.ts` (the README/docs say 279 — a documented drift); 18 in `AgentAccount.test.ts`, 23 in `Accountability.test.ts` (BondVault/escrow/reputation/validation), 14 in `Roles.test.ts`, 9 in `Handles.test.ts`, 3 in `Bindings.test.ts`, 3 in `Verification.test.ts`, 22 in `Regressions.test.ts` (several are in this area).

Reuse verdict in one line each (full reasoning in §9): AgentAccount **adapt** (the best-engineered piece; de-couple from `IAnima.statusOf/policyOf`, add ERC-20 caps, close the 4337/merkle divergence); BondVault **adapt** (excellent accounting; single-ERC-20, escrow-oriented); ReputationRegistry **adapt**; ValidationRegistry **adapt-or-drop** (only meaningful with a work escrow); AgentHandles **adapt** (needs the unmerged fix on branch `codex/fix-high-priority-bug-in-handle-reclamation`; verifier allowlist is an admin dependency); AnimaRoles **reuse-verbatim/adapt** (admin-free ERC-7432; only needs the lock hook); AnimaBindings **drop** unless ERC-8004 singleton interop is a goal.

**Web UI**: none of it is minted by the NFT. There are three surfaces: (1) an off-chain Vite SPA ("Sanctuary") on GitHub Pages; (2) `contracts/web/AnimaWeb3Renderer.sol`, a *separate* ERC-4804 manual-mode contract serving HTML at `web3://<renderer>:84532/token/{id}/live` that imports `viem` from `esm.sh` (an off-chain dependency); (3) the Sanctuary mints tokens whose `tokenURI` is a self-contained `data:` JSON+SVG — metadata, not an app. Ownership "verification" for access is purely client-side (`ownerOf(id) == connected address`, scanning `1..totalMinted`); the only real gate is the contracts' own `_requireOwnerOf` / `_requireOwner` / `isController` checks. See §8.

---

## 1. Repo facts relevant to this area

| Fact | Value | Source |
|---|---|---|
| Toolchain | Hardhat 3 (viem toolbox), solc 0.8.28, optimizer runs 200, viaIR, evmVersion cancun | `CLAUDE.md`, `hardhat.config.ts` |
| Dependencies | OpenZeppelin `@openzeppelin/contracts ^5.6.1` (SignatureChecker, MerkleProof, ReentrancyGuardTransient, Ownable2Step, SafeCast, SafeERC20, Strings) | `package.json:58` |
| Tests | `node:test` + viem, TypeScript ESM; 268 `it()` in `test/*.test.ts`; `ANIMA_IMPL=diamond` re-runs all against the EIP-2535 build | `test/helpers.ts:110` |
| Token size | `AnimaAgent` 23,971 bytes runtime (605 under EIP-170) — the reason every registry here is standalone | `contracts/registry/AnimaRoles.sol:22-25` |
| Last commits touching the area | `3c52398` 2026-09-01 (AgentAccount), `56a2caa` 2026-09-02 "separate verification provider permissions", `86fcd23` 2026-09-02 "add ERC-8126 agent risk attestations", `ef22afa` "enforce value-conserving ERC20 settlement", `876542b` 2026-08-23 "Implement ERC-7432 roles", `4a9c85b` 2026-08-22 "Add derivatives leash and agent identity handles", `bbe2a63` "omnichain agents, per-call metering, ERC-8217 bindings" | `git log` |

### 1.1 Measured bytecode sizes (bytes, from `artifacts/`)

| Contract | Runtime | Creation |
|---|---:|---:|
| `account/AgentAccount` | **10,709** | 10,868 |
| `registry/BondVault` | **5,714** | 6,123 |
| `registry/ReputationRegistry` | **9,159** | 9,448 |
| `registry/ValidationRegistry` | **6,024** | 6,336 |
| `registry/AgentHandles` | **4,879** | 5,157 |
| `registry/AnimaRoles` | **5,107** | 5,294 |
| `registry/AnimaBindings` | **1,687** | 1,843 |
| `core/AnimaAgent` (context) | 23,971 | 26,744 |
| `web/AnimaWeb3Renderer` (context) | 22,592 | 22,757 |

README's table says `account/AgentAccount.sol` is "10.7 KB" (`README.md:11`) — consistent.

### 1.2 Live addresses (testnet, historical — deployer keys destroyed)

`deployments/84532.json` (Base Sepolia, diamond token `0x0aeb6f783ebade8fd5ffca74317266d4ea3e71b3`): registry `0x000000006551c19487814612e58FE06813775758` (canonical), accountImpl `0xB97ea50e956E36606eC5DD159dC7f25CA732bc6d`, bonds `0xcfd3E22a9b8B419fE53E47886b2bf621d327cC76`, reputation `0xb201eF54e44A81c4e141ced20f2fFCBF06350579`, validation `0x0eFca108B2A456649D40F4F69DD0FFc7dd69162d`, handles `0x9e8c0dE328201Ed7Ee4f41a16b9A829aE933CDE6`, roles `0xF4dA6c25F2972B0833BaCCC8235773ea1dF36F8f`. Wiring recorded: `anima.setModule(escrow|market|roles)`, `bonds.setModule(escrow)`, `bonds.setArbiter(escrow)`, `reputation.setSettlementModule(escrow)`, `validation.setValidator(validator)`.

`deployments/84532-0xc591c669162cd4da8ab9bfa2c2e68d538a312c00.json` (signer-scoped Base Sepolia, token `0xb3d92c766e3cb356db381feb21958a9ebb974365` — the one the Sanctuary and `/.well-known/anima.json` point at): accountImpl `0x4609897E82c0767c47841c6D0F01546785f2103B`, bonds `0xFDd05cD20F41206698df54AA93dDBB721dC83Ec1`, reputation `0xa10f1092EE3a017699a494A83875A7383A22f9e7`, validation `0xC6bF11Ded3CA645703eB3Cd7c9E663772Ce14AB9`, handles `0x23989eDD6a7e7CDb1b4bb44f42e11D5eB0EE5832`, roles `0x2b978a2cC681C21D1DF8527b65F7C4f5e8053a11`, **bindings `0x4e0446853C042720F39b1D94ED858Abe5890EaD7`**, web3Renderer `0x9160bE4d943516a2463Ac5f3ABAc5F5cce7975Cd`.

Also deployed on Ethereum Sepolia (11155111), Unichain Sepolia (1301), Robinhood (46630) and BSC testnet (97) with the same six contracts (addresses in each `deployments/<chain>.json`).

ERC-4337: `scripts/testnet-deploy.ts:20` pins `ENTRYPOINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032` and only wires it if code exists at that address (`:114-117`); `docs/DEPLOYMENT.md:80-81` also lists EntryPoint v0.8 `0x4337084D9E255Ff0702461CF8895Ce9E3b5Ff108` and v0.9 `0x433709009B8330FDa32311DF1C2AFA402eD8D009`.

---

## 2. How this area plugs into the token (`AnimaAgent`)

The account and registries are *external* to the token, which exposes a small hook surface (all cited from `contracts/core/AnimaAgent.sol`):

- `accountOf(agentId)` (`:514-516`) = `REGISTRY.account(ACCOUNT_IMPLEMENTATION, ACCOUNT_SALT, block.chainid, address(this), agentId)`; all four values are `immutable` (`:92-98`). `deployAccount(agentId)` (`:519-522`) requires the token to exist and calls `REGISTRY.createAccount(...)` (idempotent).
- `getAgentWallet(agentId)` (`:525-528`) defaults to `accountOf`; `setAgentWallet` (`:534-549`) needs an EIP-712 signature *from the wallet* (`AgentWalletBinding(agentId,wallet,nonce,deadline)`), `unsetAgentWallet` (`:552-556`).
- `isController` (`:189-195`) = owner ∨ live ERC-4907 user ∨ operator at current `operatorEpoch`; `isOperator` (`:198-200`).
- `guardianOf` (`:612-614`), `guardianPause` (`:626-633`): guardian can only move Active→Paused.
- Module gate: `isModule` mapping + `setModule(address,bool) onlyOwner` (`:877-880`); `lockAgent`/`unlockAgent` (`:689-706`) increment/decrement `lockCount`; `setDisputed` (`:712-724`) counts disputes and forces `Disputed` status; `locked()` (`:673-676`) = `lockCount != 0 || disputeCount != 0`.
- Transfer hook `_update` (`:729-754`): reverts if locked; on owner-to-owner transfer bumps `operatorEpoch`, clears guardian, policy, lease and bound wallet, forces status `Paused`.
- `getStateFingerprint` (`:777-790`, ERC-5646) reads `IERC6551Account(account).state()` when the account has code (0 otherwise) and hashes it together with holder, `AgentCore`, weights root, bound wallet, lease and policy.

Deploy-time wiring (`test/helpers.ts:271-278`, `scripts/testnet-deploy.ts:238-245`, `scripts/deploy.ts:181-185`): `anima.setModule(escrow, market, roles)`, `bonds.setModule(escrow)`, `bonds.setArbiter(escrow)`, `reputation.setSettlementModule(escrow)`, `validation.setValidator(validator)`. `docs/DEPLOYMENT.md` calls wiring "the security-critical step".

Consumers of the registries elsewhere in the repo (grep, for the design team):
- `BondVault`: `WorkEscrow.sol:276` (`reserve` on `acceptJob`), `:476-479` (`slashableOf`/`slash` on refund-with-slash), `:493-495` (`bondOf().reserved`/`release`, clamped); `AgentMarket.sol:296,381` (`availableCoverage` as an order integrity pin); `RevenueRouter.sol:185` (`deposit` — an agent's own revenue tops up its bond).
- `ReputationRegistry`: `WorkEscrow.sol:348` (`giveAttestedFeedback` with weight = min(amount, coverage) — see Regressions).
- `ValidationRegistry`: `WorkEscrow.sol:212` (`isValidator` required for bonded jobs), `:394,401` (`requestKeyOf`, `validationRequestWithExpiry` with a 14-day expiry), `:415-420`, `:434` (`requestOf`, `PASS_THRESHOLD`).
- `AgentAccount`: called by `AgentMarket.sol:280-284,377-378` (`state()` for `expectedAccountState`), by every settlement path via `accountOf` (escrow, meter, comms, market, swap router, derivatives desk, launchpad, omni home — `test/Diamond.test.ts:259`).

---

## 3. `contracts/account/AgentAccount.sol` (637 lines)

### 3.1 Purpose
"An ERC-6551 token bound account whose *session keys* — the keys an autonomous agent actually runs with — are bounded by the {AutonomyPolicy} published on the agent token. The owner keeps unrestricted control; the agent gets a budget." (`:18-21`). The header argues the design:

> "**The owner** signs with their own wallet and is unrestricted. They can always rescue funds, even from a paused agent. **The agent** signs with a session key. Every call it makes is checked against a per-session budget, a rolling daily cap, a per-transaction ceiling, a target allowlist, and the agent's live status. A paused agent cannot spend at all. That asymmetry is the whole point. 'Give the AI a wallet' is trivial; giving it a wallet whose limits a counterparty can read *before* trading with it is not, and it is what makes an autonomous agent safe to interact with." (`:25-33`)

> "Two footguns handled explicitly: 1. **Ownership cycles.** If the agent token ends up owned by this very account, `owner()` returns zero rather than allowing a self-authorising loop. 2. **Selling a drained agent.** `state()` increments on every state-changing call, so a buyer can pin the exact account state their price was quoted against and have the purchase revert if the seller emptied it in between." (`:35-41`)

### 3.2 Inheritance and standards
`IERC165, IERC1271, IERC6551Account, IERC6551Executable, IERC721Receiver, IERC1155Receiver, ReentrancyGuardTransient` (`:43-51`). `supportsInterface` (`:632-636`, `pure`) returns true for IERC165, IERC6551Account (`0x6faff5f1`), IERC6551Executable (`0x51945447`), IERC1271, IERC721Receiver, IERC1155Receiver. ERC-4337 (`PackedUserOperation` from OZ `draft-IERC4337.sol`) is implemented but not advertised via ERC-165.

### 3.3 Types and constants
```solidity
struct Session { uint64 validAfter; uint64 validUntil; uint128 spendCapWei; uint128 spentWei; bool revoked; address grantedBy; }   // :56-67
struct Call { address to; uint256 value; bytes data; }                                                                                   // :69-73
bytes4  MAGIC_VALUE_SIGNER = 0x523e3260; bytes4 MAGIC_VALUE_1271 = 0x1626ba7e;                                                           // :79-80
uint256 SIG_VALIDATION_FAILED = 1; SIG_VALIDATION_SUCCESS = 0;                                                                           // :81-82
uint256 _FOOTER_OFFSET = 0x4d; // "10 (header) + 20 (impl) + 15 (footer) + 32 (salt) = 77 bytes, after which sit chainId, tokenContract and tokenId" :84-86
address public immutable ENTRY_POINT;                                                                                                    // :88
```
On `Session.grantedBy`: "A session is void the moment the agent changes hands, which is the same rule the token applies to operators and autonomy — and necessary for the same reason: otherwise a seller keeps a live, funded key on the buyer's wallet, invisible to every integrity check the sale performed." (`:62-65`)

### 3.4 Storage layout (compiler-assigned; this is a clone, so these are per-account slots)
| Slot | Variable | Notes |
|---|---|---|
| 0 | `uint256 _state` | ERC-6551 nonce (`:94`) |
| 1 | `mapping(address signer => Session) _sessions` | (`:96`) |
| 2 | `mapping(address grantedBy => mapping(address target => mapping(bytes4 selector => bool))) _allowedCall` | "Namespaced by the owner who set it, so a buyer inherits an empty allowlist rather than whatever surface the seller opened up." (`:97-99`) |
| 3 | `uint64 _spendDay; uint128 _spentToday` (packed) | rolling-day accounting, **global per account** not per key (`:101-102`) |
| 4 | `bytes32 public auditRoot` | hash-chain head (`:110`) |

On `auditRoot`: "Provenance is the thing a second-hand agent is missing. A buyer can be handed the full emitted `AuditEntry` log, replay the chain off-line, and check it ends exactly here — so a seller cannot prune the embarrassing entries, splice in flattering ones, or reorder history. One warm SSTORE per call buys a verifiable operating record, which is worth considerably more than the gas." (`:105-109`)

### 3.5 Events and errors (`:116-144`)
Events: `SessionGranted(address indexed signer, uint64 validAfter, uint64 validUntil, uint128 spendCapWei)`, `SessionRevoked(address indexed signer)`, `CallAllowed(address indexed target, bytes4 indexed selector, bool allowed)`, `Executed(address indexed signer, address indexed to, uint256 value, bytes4 selector, uint8 operation)`, `AuditEntry(bytes32 indexed root, bytes32 previousRoot, address indexed signer, address indexed to, uint256 value, bytes4 selector, bytes32 dataHash, uint256 state)`.
Errors: `NotAuthorized(address)`, `NotEntryPoint(address)`, `OwnershipCycle()`, `AgentNotActive(AgentStatus)`, `PolicyExpired(uint64)`, `PerTxCapExceeded(uint256,uint128)`, `DailyCapExceeded(uint256,uint128)`, `SessionCapExceeded(uint256,uint128)`, `SessionNotValid(address)`, `TargetNotAllowed(address,bytes4)`, `DelegateCallNotAllowed()`, `UnsupportedOperation(uint8)`, `InvalidUserOpCallData()`, `UseExecuteUserOp()`.

### 3.6 Public API (full signatures, with line numbers)
```solidity
constructor(address entryPoint)                                                                       // :153  zero disables 4337 entirely; immutable, shared by every clone
receive() external payable                                                                            // :157
function token() public view returns (uint256 chainId, address tokenContract, uint256 tokenId)       // :164  extcodecopy(address(), ..., 0x4d, 0x60)
function state() external view returns (uint256)                                                      // :173
function owner() public view returns (address)                                                        // :179  0 if chainId != block.chainid or holder == address(this)
function anima() public view returns (IAnima)                                                         // :188
function agentId() public view returns (uint256 tokenId)                                              // :193
function isValidSigner(address signer, bytes calldata) external view returns (bytes4)                 // :198  owner only
function sessionOf(address signer) external view returns (Session memory)                             // :207
function grantSession(address signer, uint64 validAfter, uint64 validUntil, uint128 spendCapWei) external  // :212  owner only; ++_state
function revokeSession(address signer) external                                                       // :232  owner OR anima().guardianOf(agentId()); ++_state
function setAllowedCall(address target, bytes4 selector, bool allowed) external                       // :247  owner only; ++_state
function allowedCall(address target, bytes4 selector) public view returns (bool)                     // :257  keyed by CURRENT owner
function execute(address to, uint256 value, bytes calldata data, uint8 operation) external payable nonReentrant returns (bytes memory)                  // :273
function executeWithProof(address to, uint256 value, bytes calldata data, uint8 operation, bytes32[] calldata proof) external payable nonReentrant returns (bytes memory) // :289
function executeBatch(Call[] calldata calls) external payable nonReentrant returns (bytes[] memory results)                                            // :305
bytes32 public auditRoot                                                                              // :110
function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4)     // :444  owner's sig only (SignatureChecker → EOA or ERC-1271)
function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds) external onlyEntryPoint returns (uint256 validationData) // :463
function executeUserOp(PackedUserOperation calldata userOp, bytes32) external onlyEntryPoint nonReentrant                                               // :505
function onERC721Received(...) / onERC1155Received(...) / onERC1155BatchReceived(...) external pure returns (bytes4)                                    // :616-630
function supportsInterface(bytes4) public pure returns (bool)                                         // :632
```

### 3.7 Behaviour in detail
- **`token()`** reads its own runtime code at offset 0x4d for 96 bytes (`:165-169`); this binds the implementation to the canonical registry's proxy layout. The mock registry (`contracts/mocks/ERC6551Registry.sol:13-25`) documents the layout: header 0x00..0x0a, impl 0x0a..0x1e, footer 0x1e..0x2d, salt 0x2d, chainId 0x4d, tokenContract 0x6d, tokenId 0x8d, total runtime 0xad (173) bytes; "it MUST produce a byte-identical proxy, because {AgentAccount.token} reads its own constructor arguments straight out of its deployed code."
- **`owner()`** (`:179-186`): returns 0 when `chainId != block.chainid` (a bridged agent's account on a foreign chain has no owner) or when `ownerOf == address(this)`: "An account authorised by a token it itself holds would be a closed loop with no human at the end of it."
- **Authorisation (`_authorize`, `:357-381`)**: first, "The EntryPoint is never a principal. An earlier version waved it through here on the reasoning that `executeUserOp` had already charged the responsible session key — but nothing forced a user operation to *use* `executeUserOp`. A session key could point its callData straight at `execute`, arrive with `msg.sender == ENTRY_POINT`, and skip every cap, the target allowlist, and the paused-agent check in one move. All ERC-4337 traffic must enter through `executeUserOp`, which resolves the real signer first." → `UseExecuteUserOp`. Then `OwnershipCycle` if no owner; then "The owner is not on a leash. They must be able to rescue a paused or misconfigured agent's funds without asking anyone." → return; else `_enforceSession`.
- **Session enforcement (`_enforceSession`, `:383-434`)**, in order: revoked / `validUntil == 0` (the "no session" sentinel) / before `validAfter` / after `validUntil` → `SessionNotValid`; `grantedBy != owner()` → `SessionNotValid` ("A key granted by a previous owner is dead, whatever its expiry says."); `statusOf != Active` → `AgentNotActive` ("This is what makes the guardian's kill switch real rather than advisory."); policy expiry → `PolicyExpired`; delegatecall needs `allowDelegateCall`; `operation > 1` unsupported (no CREATE/CREATE2); target check: if `!allowUnlistedTargets && !allowedCall(to, selector)` then the merkle leaf `keccak256(bytes.concat(keccak256(abi.encode(to, selector))))` (OZ double-hash leaf) must verify against `policy.targetsRoot` else `TargetNotAllowed`; value checks only when `value != 0`: `value > perTxWei` → `PerTxCapExceeded`; `(_spendDay == today ? _spentToday : 0) + value > dailyWei` → `DailyCapExceeded` (day = `block.timestamp / 1 days`, so it is a UTC-calendar-day bucket, not a true rolling 24h window); `s.spentWei + value > s.spendCapWei` → `SessionCapExceeded`.
- **Execution (`_exec`, `:316-336`)**: `call` or `delegatecall`, bubbles revert data verbatim, then `_audit(...)` and `Executed`. Note the ordering: in `execute`/`executeWithProof` `++_state` happens *before* `_exec`, so the audit entry records the post-increment state (test comment `AgentAccount.test.ts:267`); in `executeBatch` the increment happens *after* all calls, so batch entries record the pre-increment state. An off-chain replayer must mirror this.
- **Audit chain (`_audit`, `:340-351`)**: `next = keccak256(abi.encode(previous, block.chainid, address(this), signer, to, value, selector, dataHash, operation, _state, block.timestamp))` — "Chains chainId and this address into every link so a record from one deployment can never be replayed as evidence about another." The SDK (`sdk/src/index.ts:555-591`, `replayAuditLog`) reproduces this exactly from `AuditEntry` logs.
- **ERC-1271 (`:444-450`)**: "Only the owner's signature makes the *account* speak. Session keys deliberately cannot produce ERC-1271 signatures: a budget cap means nothing if the key can instead sign an unbounded off-chain order that some other protocol honours."
- **ERC-4337 (`:456-532`)**: `validateUserOp` decodes `userOp.signature` as `abi.encode(address signer, bytes sig)`; invalid sig → 1; signer == owner → 0; otherwise callData must start with `execute` or `executeBatch` selectors (rejected during validation "before it costs the account gas"), session must be unrevoked, granted, and by the current owner; returns `(validUntil << 160) | (validAfter << 208)` so "the bundler — not this contract — rejects the op outside its validity period". Pays `missingAccountFunds` to EntryPoint, ignoring failure. `executeUserOp` re-decodes the signer, dispatches the inner `execute`/`executeBatch` through `_authorizeMemory` + `_execMemory`. "Touches only this account's own storage, so it stays inside the ERC-7562 rules bundlers enforce for unstaked accounts" (`:461-462`) — but note `_enforceSessionMemory` reads `anima().statusOf/policyOf` at *execution* time, not validation time, which is what keeps validation 7562-compliant.
- **Memory-arg duplicate path (`:538-610`)**: "Solidity cannot share one implementation across `calldata` and `memory` arguments without an external self-call, which would cost more gas than the duplication saves. The two paths are kept line-for-line identical so a change to one is obvious if not mirrored." **They are not identical**: `_enforceSessionMemory` (`:567-568`) has no merkle-proof branch — a 4337 session op against an unlisted target reverts `TargetNotAllowed` even if the target is in `targetsRoot`. See §3.11.

### 3.8 Access control summary
| Function | Who |
|---|---|
| `grantSession`, `setAllowedCall` | token owner (`_requireOwner`, reverts `OwnershipCycle` if none) |
| `revokeSession` | token owner **or** `anima().guardianOf(agentId())` |
| `execute*` | owner (unrestricted) or valid session key (leashed); never EntryPoint directly |
| `validateUserOp`, `executeUserOp` | EntryPoint only (`onlyEntryPoint`; reverts if `ENTRY_POINT == 0`) |
| `isValidSignature` | anyone; passes only for owner's signature |
| `receive`, `onERC721Received`, `onERC1155*` | anyone |

### 3.9 Invariants (from `docs/SECURITY.md:28-35`, each with a test)
9. The owner is never rate-limited; session keys always are. 10. Session keys cannot produce ERC-1271 signatures. 11. A paused or disputed agent cannot spend from a session key. 12. `state()` increments on every state-changing call. 13. The audit root is append-only and reproducible off-chain. 14. An account owned by its own token has no owner. Plus from `docs/SPEC.md:148-155` (normative): `accountOf` MUST be the ERC-6551 derivation and identical before/after deployment; the account MUST enforce `policyOf` against session keys and MUST NOT against the owner; MUST refuse session execution unless `Active`; session keys MUST NOT produce ERC-1271.

### 3.10 Tests (`test/AgentAccount.test.ts`, 18 cases; plus `Regressions`, `Lifecycle`, `Market`, `Diamond`, `AnimaAgent`)
Most telling names: "reads its own token triple out of its proxy footer"; "returns no owner when the agent ends up owning its own account"; "recognises only the owner as a valid ERC-6551 signer"; "lets the owner spend without limit, including past the agent's own caps"; "enforces the per-transaction cap on a session key"; "enforces the daily cap across several transactions" (resets after `time.increase(86400)`); "enforces the lifetime session cap independently of the daily cap"; "stops a session key dead when the agent is paused — the kill switch is real"; "honours the target allowlist when unlisted targets are disallowed"; "refuses delegatecall from a session key unless the policy allows it"; "lets a guardian revoke a session without waking the owner"; "validates the owner's signature and refuses a session key's" (ERC-1271); "advances a hash chain that an off-chain replay can reproduce exactly" (recomputes `auditRoot` byte-for-byte, `:253-290`); "produces a different root for an identical repeated call"; "increments ERC-6551 state on every execution so a buyer can detect a drain"; "refuses a direct execute from the EntryPoint, forcing traffic through executeUserOp" (`:314-416`, deploys with a wallet as EntryPoint, asserts `UseExecuteUserOp`, then validates+executes a real session userOp). Regressions: "voids a key the seller granted, and empties the allowlist they opened" (`Regressions.test.ts:14-67`), "bumps ERC-6551 state when the allowlist changes, so an integrity pin catches it" (`:69-80`). Market: "reverts when the seller drained the bound account after quoting" (`Market.test.ts:166-185`, `AgentStateChanged`). Diamond: "reports the same configuration as the monolith, from every facet" (`Diamond.test.ts:263-290`). AnimaAgent: "derives the same account address before and after deployment" (`AnimaAgent.test.ts:290-307`, compares to `registry.account(...)`).
Not covered by a test: `executeWithProof` with a non-empty merkle proof; `executeBatch` partial failure; `PolicyExpired`; `validAfter` in the future; 4337 `executeBatch` inner path; `revokeSession` on a non-existent session.

### 3.11 Known weaknesses / gaps
1. **Calldata vs memory path divergence**: no merkle allowlist on the ERC-4337 path (`:567-568` vs `:412-418`), contradicting the "line-for-line identical" comment. A session that relies on `targetsRoot` works via direct `execute*WithProof` but not via a bundler.
2. **Caps are native-value only.** ERC-20/ERC-721 movement by a session key is bounded only by the (target, selector) allowlist; the SPEC itself says "A native-value cap does not constrain ERC-20 movement at all. Any implementation that stops at `msg.value` has a spending limit in name only" (`docs/SPEC.md:244-246`). For the unified project a per-token budget (like IPSEITY's `grantSession` spend cap plus selector allowlist, or an ERC-20 decoding step for `transfer/approve` selectors) is needed.
3. Daily cap is a calendar-day bucket (`block.timestamp / 1 days`), not rolling 24h; the doc says "rolling". Also the daily budget is shared across all session keys of the account.
4. `grantSession` does not validate `validUntil > validAfter` or `validUntil > now`; `spentWei` resets on every re-grant (an owner re-granting resets the lifetime cap — intended, but a buyer should read `SessionGranted` events).
5. `_allowedCall[previousOwner]` is never cleared; if the same address re-acquires the token its old allowlist is live again (acceptable, but non-obvious).
6. `owner()` makes an external `ownerOf` call that *reverts* for a burned token (OZ `ERC721NonexistentToken`), so every account function reverts and assets in the account of a burned token are stuck — standard ERC-6551 behaviour, but the token can be burned (`_update` allows `to == 0` when unlocked).
7. `validateUserOp` does not check `userOp.sender == address(this)`; EntryPoint guarantees it, fine, but it means the account trusts the EntryPoint absolutely (immutable, chosen at impl deploy).
8. Audit chain state-number semantics differ between `execute` (post-increment) and `executeBatch` (pre-increment) — see §3.7.
9. `supportsInterface` omits the ERC-4337 `IAccount` id and ERC-6551 does not define one for executables beyond `0x51945447`.
10. Operations 2/3 (CREATE/CREATE2) from ERC-6551's `execute` doc are unsupported (`UnsupportedOperation`).
11. Depends on OZ (`SignatureChecker`, `MerkleProof`, `ReentrancyGuardTransient`); the sibling IPSEITY repo forbids external Solidity deps — a merge would need hand-rolled equivalents.

### 3.12 Reuse verdict: **adapt**
This is the strongest, most-tested component in the area and maps directly onto the GOAL's "vault"/wallet inside the NFT (the holder's unrestricted ERC-6551 account with bounded delegated keys). Adapt by: making the policy source pluggable (today it hard-reads `IAnima.statusOf/policyOf/guardianOf` from the token — in a unified token those three reads can stay on the hub or move into the account), adding ERC-20 caps, unifying the merkle path, adding a receive-only sibling (IPSEITY's "Grip") if the unified design wants a vault with no spend path, and deciding on the OZ question.

---

## 4. `contracts/registry/BondVault.sol` (319 lines)

### 4.1 Purpose
"Holds a slashable bond per agent. Escrow modules reserve against it before accepting a job, and arbiters take from it when an agent fails." (`:13-14`). The header is the economic thesis of the whole protocol:

> "This is the piece that makes everything else non-theatrical. Reputation you can mint for the price of gas is worthless; validation nobody pays for is advisory. A bond changes the economics: an agent can only accept work up to what it has staked, so its *maximum lie is bounded by its own capital*, and a client can check that bound before hiring. It converts 'trust me' into a number." (`:16-21`)
> "1. **Unbonding stays slashable.** Funds queued for withdrawal remain fully exposed for the entire cooldown. Otherwise an agent front-runs its own accountability by withdrawing the moment it knows a job went badly. 2. **Slashing cannot consume reserved capital.** Reserved funds are another client's coverage; using those to pay an unrelated claim would let one failure cascade into everyone else's protection. A job releases its own reservation before slashing. 3. **Coverage is reserved, not merely counted.** `reserve` moves the number into a locked bucket, so the same collateral can never back two jobs at once. Slashed value is *not* burned. It routes to the harmed party, because the point is to make the client whole, not to perform severity." (`:26-36`)

### 4.2 Inheritance: `Ownable2Step, ReentrancyGuardTransient`; `using ExactERC20 for IERC20; using SafeCast for uint256`.

### 4.3 Storage
```solidity
struct Bond { uint128 total; uint128 reserved; /* slot 0 */ uint128 unbonding; uint64 readyAt; /* slot 1 */ address unbondTo; /* slot 2 */ }  // :46-52
IERC20  public immutable ASSET; IERC721 public immutable AGENTS; uint64 public immutable UNBONDING_PERIOD;                                    // :58-64
mapping(address module  => bool) public isModule;      // may reserve/release                                                                  // :67
mapping(address arbiter => bool) public isArbiter;     // may slash — "Deliberately a narrower set than `isModule`"                            // :69
mapping(uint256 agentId => Bond) private _bonds;                                                                                               // :71
mapping(uint256 agentId => mapping(address module => uint128)) private _moduleReserved;  // "one integration cannot release collateral committed by another" :74
uint256 public totalBonded;                                                                                                                    // :76
```
On `UNBONDING_PERIOD`: "Must outlast the dispute window of any module that reserves against this vault, or the guarantee is only as good as an agent's patience." (`:61-63`). Fixture uses 7 days; WorkEscrow's validation request expires at 14 days — safe only because reserved coverage is excluded from `availableCoverage` and so cannot be queued for unbonding while a job is live.

### 4.4 Events / errors (`:82-102`)
`ModuleSet`, `ArbiterSet`, `Deposited(agentId, from, amount)`, `UnbondRequested(agentId, beneficiary, amount, readyAt)`, `UnbondCancelled`, `Withdrawn(agentId, to, amount)`, `Reserved(agentId, module, amount)`, `Released`, `Slashed(agentId, arbiter, beneficiary, amount, bytes32 reason)`. Errors: `NotModule`, `NotArbiter`, `NotAgentOwner`, `InsufficientFree(agentId, requested, free)`, `InsufficientReserved`, `InsufficientBond`, `NothingUnbonding`, `UnbondNotReady(agentId, readyAt)`, `UnbondPending`, `ZeroAmount`, `ZeroAddress`.

### 4.5 API
```solidity
constructor(IERC20 asset_, IERC721 agents_, uint64 unbondingPeriod_, address owner_)                         // :108
function setModule(address module, bool allowed) external onlyOwner                                            // :125
function setArbiter(address arbiter, bool allowed) external onlyOwner                                          // :130
function bondOf(uint256 agentId) external view returns (Bond memory)                                           // :139
function availableCoverage(uint256 agentId) public view returns (uint256)  // total - reserved - unbonding    // :145
function slashableOf(uint256 agentId) external view returns (uint256)      // total - reserved                // :152
function reservedBy(uint256 agentId, address module) external view returns (uint256)                           // :157
function deposit(uint256 agentId, uint256 amount) external nonReentrant    // anyone; balance-delta accounted   // :167
function requestUnbond(uint256 agentId, uint256 amount) external           // token owner; one pending at a time // :181
function cancelUnbond(uint256 agentId) external                            // whoever QUEUED it                 // :205
function withdraw(uint256 agentId) external nonReentrant                   // permissionless; pays unbondTo     // :220
function reserve(uint256 agentId, uint256 amount) external onlyModule                                           // :247
function release(uint256 agentId, uint256 amount) external onlyModule      // bounded by this module's own reservation // :256
function slash(uint256 agentId, uint256 amount, address beneficiary, bytes32 reason) external onlyArbiter nonReentrant // :273
```
Key comments: `deposit` — "Anyone may top up an agent's bond — a sponsor, a DAO, the agent itself out of its own earnings. Only the owner can ever take it back out." (`:165-166`; `RevenueRouter` does exactly this). `requestUnbond` — "The queued amount belongs to whoever put it up, not to whoever happens to hold the agent when the cooldown matures — otherwise selling an agent mid-unbond would hand the buyer the seller's collateral." (`:193-195`). `cancelUnbond` — "Gated on whoever *queued* it, not on whoever currently holds the agent. Gating on the holder would let a buyer cancel the seller's pending withdrawal, re-queue it to themselves, and walk off with collateral that was already on its way out — the sale price having reflected `availableCoverage`, which by then reads zero." (`:201-204`; this was finding "A buyer could seize the seller's queued collateral", `docs/SECURITY.md:140`). `withdraw` — "Note for buyers: judge an agent by `availableCoverage`, never by `slashableOf`. The latter includes collateral already on its way out the door." (`:218-219`). `slash` — "Consumption order is free → unbonding. Reserved collateral belongs to live jobs and cannot be consumed by an unrelated arbiter. A job must `release` its own reservation before slashing it, as WorkEscrow does during settlement." (`:270-272`).

### 4.6 Invariants (SECURITY.md 15-19, 21): `total >= reserved + unbonding`; queued collateral stays slashable; slashing consumes free before reserved; queued withdrawal pays the queuer; coverage is reserved not counted; release/slash are clamped by the escrow to what the vault holds (`WorkEscrow.sol:489-496`).

### 4.7 Tests (`Accountability.test.ts:40-130`, `Regressions.test.ts:83-103`)
"reports coverage a client can check before hiring"; "keeps collateral slashable throughout the unbonding cooldown" (slash 300 of a 500 unbond, then only 200 withdraws); "pays a queued withdrawal to whoever queued it, not to whoever buys the agent"; "refuses to reserve more than the agent actually has free"; "does not let one module release or slash another module's reservation"; "consumes free collateral before another client's reserved coverage"; Regression "stops a buyer cancelling and re-queueing the seller's pending withdrawal". Live: every testnet record has "<Name> bonds its agent" entries for 12 agents.

### 4.8 Weaknesses
- Single ERC-20 asset per vault (no native ETH, no multi-asset); fee-on-transfer tokens rejected by `ExactERC20` (good) but rebasing tokens would desync `total`.
- Admin surface: `Ownable2Step` owner can add arbiters at will — an arbiter can slash any agent's free collateral to any beneficiary. Mitigated only by governance; for an "immutable, no-admin" unified design this must become constructor-pinned or token-holder-governed.
- `_moduleReserved` uses `uint128` and casts via `SafeCast`; `release` by a module that was later un-allowlisted is impossible (reservation stuck) — `onlyModule` is checked at release time.
- One pending unbond per agent (`UnbondPending`).
- No per-agent view of "who deposited" — deposits are fungible; only unbond tracks a beneficiary.

### 4.9 Verdict: **adapt**. The reserve/unbond/slash accounting is correct and well-argued; keep it as the "stake" sub-vault behind any work/escrow feature. For the GOAL's "vault" the holder wants an asset vault, which is the ERC-6551 account (§3) plus a receive-only Grip, not this; so BondVault is a complementary module, not the vault.

---

## 5. `contracts/registry/ReputationRegistry.sol` (420 lines)

### 5.1 Purpose
"ERC-8004 reputation, plus the part ERC-8004 leaves open: proof that the reviewer was actually a customer." (`:10-11`).
> "ERC-8004 lets any address leave feedback on any agent. That is the right base layer — permissionless, unopinionated — but consumed naively it is a sybil farm… So this implementation records, alongside every score, two facts a reader can filter on and neither the agent nor the reviewer can forge: `attested` — the feedback was submitted by a registered settlement module on behalf of a client who actually paid this agent for work; `weight` — how much that client paid, in the settlement asset's smallest unit. `getSummary` stays byte-compatible with ERC-8004 and counts everything. `getAttestedSummary` counts only paid-for work, weighted by what was at stake, which is the number worth trusting. Faking it costs exactly as much as the jobs are worth." (`:13-26`)

### 5.2 Inheritance: `IReputationRegistry` (ERC-8004 draft, `contracts/interfaces/IERC8004.sol:57-119`), `Ownable2Step`.

### 5.3 Storage
```solidity
struct Feedback { int128 value; uint8 valueDecimals; bool isRevoked; bool attested; uint64 timestamp; uint128 weight; bytes32 jobId; string tag1; string tag2; } // :33-43
uint8 public constant SUMMARY_DECIMALS = 2;   // "removes an entire class of integration bug where a caller averages values that were quoted in different decimals" :49-52
address public immutable IDENTITY_REGISTRY;                                                                                      // :54
mapping(address module => bool) public isSettlementModule;                                                                       // :57
struct Aggregate { uint64 count; int256 weightedSum; uint256 totalWeight; }  mapping(uint256 => Aggregate) private _attested;     // :65-71
mapping(uint256 agentId => mapping(address client => Feedback[])) private _feedback;                                             // :73
mapping(uint256 => mapping(address => mapping(uint64 index => uint64))) private _responseCount;                                  // :74
mapping(uint256 agentId => address[]) private _clients;  mapping(uint256 => mapping(address => bool)) private _seenClient;        // :75-76
```
On the running aggregate: "The filtered summaries below iterate every client an agent ever had, and anyone can append to that list for the price of gas — a few dollars of spam on an L2 makes an agent's reputation cost more to read than any node will spend, which is a denial of service against a competitor. The number consumers actually want is therefore maintained incrementally and read in constant time." (`:60-64`; finding "an agent's reputation could be made unreadable for a few dollars of spam", SECURITY.md:153).

### 5.4 Events/errors: ERC-8004 `NewFeedback`, `FeedbackRevoked`, `ResponseAppended` (from the interface); `SettlementModuleSet`. Errors `UnknownAgent`, `NoSuchFeedback`, `AlreadyRevoked`, `NotSettlementModule`, `SelfFeedback`.

### 5.5 API
```solidity
constructor(address identityRegistry_, address owner_)                                                                     // :94
function getIdentityRegistry() external view returns (address)                                                             // :98
function setSettlementModule(address module, bool allowed) external onlyOwner                                              // :102
function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash) external  // :112 permissionless, unattested
function giveAttestedFeedback(uint256 agentId, address client, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash, uint128 weight, bytes32 jobId) external // :129 settlement module only; client != ownerOf(agentId)
function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external            // by the client; adjusts aggregate         // :200
function appendResponse(uint256 agentId, address clientAddress, uint64 feedbackIndex, string responseURI, bytes32 responseHash) external // :222 anyone; event only
function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals) // :245 ERC-8004, O(n)
function attestedSummaryOf(uint256 agentId) external view returns (uint64 count, int128 summaryValue, uint256 totalWeight)   // :259 O(1) — "the read path integrators should use"
function getAttestedSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) external view returns (uint64 count, int128 summaryValue, uint256 totalWeight) // :275 O(n)
function readFeedback(...) / readFeedbackDetail(...) / getResponseCount(...) / getClients(...) / clientCount(...) / getClientsPaged(agentId, offset, limit) / getLastIndex(...)  // :361-419
```
Design notes: `_record` reverts for a nonexistent agent via `ownerOf` (`:161-163`); a zero weight counts as 1 ("so it still counts, just barely", `:295`); `appendResponse` — "Anyone may respond, not just the agent's owner: a third party who can show the review is wrong is exactly the sort of evidence a reader wants. Responses are events, so they cost nothing to store and everything is attributable." (`:219-221`); `_normalise` rebases to 2 decimals ("averaging them raw is a silent correctness bug", `:346-347`).

### 5.6 Tests (`Accountability.test.ts:355-441`, `Regressions.test.ts:309-354`, plus escrow flow `:174-199`)
"distinguishes open feedback from customer-attested feedback" ("unpaid praise must not count as evidence"); "weights attested scores by the value actually settled" (a $10 perfect score barely moves a $1000 average); "refuses attested self-feedback from the agent's own owner"; "normalises differing decimals before averaging them" (80@0dp and 6000@2dp → 7000); "pays the agent's own account and files customer-attested feedback on acceptance" (score 95 → 9500, weight = USDC(100)); Regressions: "caps attested weight at the coverage that actually stood behind the job" (weight = min(price, coverage) — flash-loan finding) and "reads attested standing in constant time, so spam cannot make it unreadable".

### 5.7 Weaknesses
- `_normalise` uses `unchecked` `10 ** (decimals - 2)`; for `valueDecimals > 79` the exponent overflows silently and the normalised value is garbage. `WorkEscrow.acceptDelivery` passes a *client-chosen* `ratingDecimals` straight through, so a client can poison an agent's attested aggregate (or, with large weights, hit a checked-arithmetic revert in `agg.weightedSum += ...`, blocking settlement). Needs a bound (`valueDecimals <= 18` or similar).
- Admin: `Ownable2Step` owner chooses settlement modules → attested feedback is only as honest as the module allowlist.
- `appendResponse` is unbounded event spam; `_clients` is unbounded (mitigated by paging and the O(1) aggregate).
- Only a single global (unfiltered) O(1) aggregate; tag-filtered reads remain O(n).
- Weight stored as `uint128` but `ExactERC20` amounts are `uint256` upstream.

### 5.8 Verdict: **adapt**. For the GOAL's social layer, attested/weighted reputation is a genuinely useful trust signal, and ERC-8004 compatibility keeps it indexable. Keep the O(1) aggregate and `attested` flag; bound decimals; make the settlement-module set constructor-pinned.

---

## 6. `contracts/registry/ValidationRegistry.sol` (346 lines)

### 6.1 Purpose
ERC-8004 validation ("a request for an independent party to check an agent's work, and that party's verdict, both anchored on-chain", `:11-12`) plus ERC-8126 agent security attestations. Two deliberate departures: "1. **Requests expire.** A validation request with no deadline is a claim an agent can leave dangling forever and point at as 'pending review'… 2. **Only the named validator may answer, once.** The request commits to `validatorAddress` up front, so an agent cannot shop for a friendly verdict after seeing an unfriendly one, and a validator cannot revise a published answer." (`:14-22`). "`response` is a 0-100 score… This contract treats >= 50 as 'passed'." (`:23-24`).

### 6.2 Inheritance: `IValidationRegistry` (ERC-8004), `IERC8126`, `Ownable2Step`.

### 6.3 Storage
```solidity
struct Request { address validator; uint256 agentId; address requester; uint64 expiry; uint64 lastUpdate; uint8 response; bool answered; bytes32 responseHash; string tag; } // :31-41
struct AgentVerification { address provider; uint64 verifiedAt; uint8 riskScore; bytes32 summaryProofId; }                                                                  // :43-48
uint8 public constant PASS_THRESHOLD = 50;  address public immutable IDENTITY_REGISTRY;                                                                                      // :54-56
bool public restrictValidators;  mapping(address => bool) public isValidator;                                                                                                // :60-61
mapping(address provider => bool) public isVerificationProvider;  // "deliberately separate from job-scoped work validators"                                                 // :65
mapping(bytes32 requestKey => Request) private _requests;  // keyed by keccak256(requester, requestHash) — see requestKeyOf                                                   // :69
mapping(uint256 => bytes32[]) private _agentRequests;  mapping(address => bytes32[]) private _validatorRequests;  mapping(uint256 => AgentVerification) private _latestVerification; // :70-72
```

### 6.4 API
```solidity
constructor(address identityRegistry_, address owner_)                                                                                  // :98
setValidator(address,bool) / setVerificationProvider(address,bool) / setRestrictValidators(bool)  onlyOwner                             // :107-120
function recordAgentVerification(uint256 agentId, uint8 overallRiskScore, bytes32 etvProofId, bytes32 mcvProofId, bytes32 scvProofId, bytes32 wavProofId, bytes32 wvProofId, bytes32 summaryProofId) external // :130 provider only; score <= 100
function getLatestRiskScore(uint256 agentId) external view returns (uint8)   // reverts NoVerification                                  // :165
function latestVerificationOf(uint256 agentId) external view returns (AgentVerification memory)                                         // :171
function requestKeyOf(address requester, bytes32 requestHash) public pure returns (bytes32)                                             // :193
function validationRequest(address validatorAddress, uint256 agentId, string requestURI, bytes32 requestHash) external  // 7-day default // :199
function validationRequestWithExpiry(address validatorAddress, uint256 agentId, string requestURI, bytes32 requestHash, uint64 expiry) external // :209
function validationResponse(bytes32 requestKey, uint8 response, string responseURI, bytes32 responseHash, string tag) external          // :249 named validator, once, before expiry
function getValidationStatus(bytes32 requestKey) external view returns (address, uint256, uint8, bytes32, string memory, uint256)        // :277
function hasPassed(bytes32 requestKey) external view returns (bool)                                                                     // :294
function requestOf(bytes32 requestKey) external view returns (Request memory)                                                           // :299
function getSummary(uint256 agentId, address[] validatorAddresses, string tag) external view returns (uint64 count, uint8 averageResponse) // :307 answered only
function getAgentValidations(uint256) / getValidatorRequests(address) external view returns (bytes32[] memory)                          // :338-345
```
The load-bearing comment is on `requestKeyOf` (`:181-192`): "Keying purely by `requestHash` — the obvious reading of ERC-8004 — is front-runnable. Request hashes are derived from public data, so anyone watching a pending `validationRequest` can pre-register that exact hash and make the real request revert as a duplicate. Against an escrow that opens a dispute this is a denial of service with a payout: block the dispute until the review window lapses and the agent collects for undelivered work with its bond untouched. Namespacing by opener removes the attack outright — a squatter cannot write into someone else's namespace — while leaving the emitted `requestHash` exactly as ERC-8004 describes. Validators respond with the key, which is the value the `ValidationRequest` event carries." Also: self-validation refused ("An agent's own holder grading its own work is not validation, it is marketing.", `:229`); ERC-8126 badges "always require an explicitly allowlisted provider. Otherwise anyone could overwrite a real result with a zero-risk self-assessment while the open validator market is enabled." (`:127-129`); `getSummary` ignores unanswered requests "because a validator's silence says something about the validator, not about the agent." (`:304-306`).

### 6.5 Tests
`Accountability.test.ts:235-353`: "locks the agent into Disputed while a verdict is pending"; "pays the agent when the validator passes the work" (80 ≥ 50); "refunds the client and slashes when the validator fails the work" (10); "returns everyone's money untouched when the validator never answers" (stale after 15 days); "refuses a second verdict on the same request"; "cannot be blocked by a third party squatting the validation request key" (pre-registers the same content commitment from another opener); "refuses a verdict from anyone but the named validator". `Verification.test.ts` (ERC-8126, 3 cases): "lets an allowlisted provider publish a queryable risk score and proof"; "rejects spoofed, out-of-range, missing-agent, and absent assessments"; "does not let a work validator publish security assessments".

### 6.6 Weaknesses
- The ERC-8004 interface deviates: `validationResponse` takes the namespaced key, not the raw hash, so a generic ERC-8004 validator client must read the key from the event (the comment acknowledges this).
- `_agentRequests` grows unboundedly and `getSummary` is O(n); anyone can open requests against any agent (spam the summary with 0-score answered requests from colluding validators when `restrictValidators == false`).
- Admin (`Ownable2Step`) controls validators and providers.
- `docs/DEPLOYMENT.md:78` notes the canonical ERC-8004 ValidationRegistry has "No confirmed mainnet deployment".

### 6.7 Verdict: **adapt-or-drop**. Only valuable if the unified protocol keeps a work/escrow/dispute flow. If it does, keep the opener-namespaced key and the single-answer rule. The ERC-8126 piece is a cheap optional add. If no escrow, drop.

---

## 7. `contracts/registry/AgentHandles.sol` (242 lines)

### 7.1 Purpose
"Verified off-chain identities bound to an ANIMA agent: an email address, a DNS domain, a DID, an ENS name, a social account, a libp2p mesh peer." (`:9-10`). Rationale: "Roughly the entire consumer web gates signup on one flow: enter an address, receive a code, confirm. An agent without an inbox cannot complete it… What is missing is the other direction: a way for a *counterparty* to check that a given inbox belongs to a given agent, without asking the agent." (`:12-19`). "**Verification does not survive a sale.** The owner at attestation time is recorded, and {isFresh} returns false once the agent changes hands." (`:26-27`). "**What a verifier attests to is off-chain and only as good as the verifier.** The registry records who said it, when, and until when. It does not pretend to have checked anything itself." (`:32-34`).

### 7.2 Types / storage
```solidity
enum HandleKind { Email, Domain, DID, ENS, Social, MeshPeer, Phone, ApiKeyId }                                                            // :41-50
struct Handle { HandleKind kind; address verifier; address ownerAtAttestation; uint64 verifiedAt; uint64 expiresAt; bool revoked; bytes32 evidenceHash; string value; } // :52-61
IERC721 public immutable AGENTS;                                                                                                            // :67
mapping(HandleKind kind => mapping(address verifier => bool)) public isVerifier;   // per-kind: "an inbox provider should not be able to certify DNS ownership" :71
mapping(uint256 agentId => Handle[]) private _handles;                                                                                      // :73
mapping(bytes32 handleKey => uint256 agentId) public claimedBy;                     // keccak256(uint8 kind, value)                       // :76
```
Inheritance `Ownable2Step` (owner sets verifiers).

### 7.3 API
```solidity
constructor(IERC721 agents_, address owner_)                                                                                       // :107
function setVerifier(HandleKind kind, address verifier, bool allowed) external onlyOwner                                           // :111
function handleKey(HandleKind kind, string memory value) public pure returns (bytes32)                                             // :116
function attest(uint256 agentId, HandleKind kind, string value, uint64 expiresAt, string evidenceURI, bytes32 evidenceHash) external returns (uint256 index) // :131 verifier for kind; value pre-normalised; HandleTaken if another agent has a fresh claim
function revoke(uint256 agentId, uint256 index) external     // the verifier that made it OR the current token owner                // :172
function handlesOf(uint256 agentId) external view returns (Handle[] memory) / handleCount(uint256)                                   // :192-198
function isFresh(uint256 agentId, uint256 index) public view returns (bool)   // unrevoked, unexpired, ownerAtAttestation == current owner (staticcall-tolerant for burned tokens) // :202
function controls(uint256 agentId, HandleKind kind, string value) external view returns (bool)                                       // :230
function agentFor(HandleKind kind, string value) external view returns (uint256)   // reverse lookup, 0 if stale                     // :237
```
Events `VerifierSet`, `HandleAttested(agentId, index, kind, verifier, value, expiresAt, evidenceURI, evidenceHash)`, `HandleRevoked(agentId, index, by)`. Errors `NotAVerifier`, `NotAuthorised`, `HandleTaken(key, heldBy)`, `NoSuchHandle`, `AlreadyRevoked`, `EmptyValue`, `ExpiryInPast`.

Comments: value "MUST already be normalised by the verifier — lowercased, punycode-decoded, no display name. The registry hashes it verbatim" (`:125-128`); "One handle, one agent. Without this, two agents could both advertise the same inbox and a counterparty checking 'who controls this address' would get an ambiguous answer" (`:147-149`); `isFresh` uses a `staticcall` to `ownerOf` so "A burned token has no current owner and must become reclaimable rather than making ownerOf's revert permanently squat the handle." (`:208-210`).

### 7.4 Tests (`Handles.test.ts`, 9 cases): "records a verified inbox that a counterparty can check without asking the agent"; "refuses an attestation from an address not authorised for that kind"; "binds one handle to exactly one agent" (freed on revoke); "stops vouching for a handle once the agent changes hands"; "expires an attestation on schedule"; "lets another agent reclaim an expired handle"; "lets another agent reclaim a handle made stale by transfer"; "lets the agent's owner disown a claim they did not make"; "carries a libp2p mesh peer identity, so a mesh can trust the chain instead of an IdP". Live: `docs/LIVE_FUNCTION_MATRIX_2026-08-31.md:34` handle attestation tx `0x5ced698b…fb1cb`; `scripts/testnet-modules.ts:119-127` exercises uniqueness.

### 7.5 Weaknesses
1. **Unmerged bug fix.** Branch `origin/codex/fix-high-priority-bug-in-handle-reclamation` commit `a767f7c` ("fix: preserve fresh duplicate handle claims", 2026-09-03) is **not in main** (`git diff a767f7c^ origin/main -- AgentHandles.sol` is empty). On main, `_hasFreshClaim` (`:220-227`) returns `isFresh` of the *latest* matching record only, and `revoke` (`:183`) clears `claimedBy` whenever the revoked record's agent matches. So if a verifier re-attests the same handle for the same agent (renewal), the newer record expiring or being revoked makes the handle reclaimable even though an older non-expiring record is still fresh. The fix: `if (handleKey(...) == key && isFresh(agentId, i - 1)) return true;` and `if (claimedBy[key] == agentId && !_hasFreshClaim(agentId, key)) claimedBy[key] = 0;` with a new test "preserves a handle while any of its attestations remains fresh". Apply it.
2. Verifiers are an admin-set allowlist (`Ownable2Step`) — trust in the off-chain verifier is the whole security. For ENS specifically an on-chain proof (reverse record / resolver read) would remove the oracle.
3. `_handles[agentId]` is unbounded and `_hasFreshClaim`/`attest` iterate it (O(n) per attest/`controls`); only allowlisted verifiers can grow it.
4. `attest` for the same agent re-sets `claimedBy` even when `heldBy == agentId` (harmless).
5. No ERC-165, no standard — bespoke interface.

### 7.6 Verdict: **adapt**. The "verified handles bound to the token, one-to-one, stale on transfer" idea is directly useful for the GOAL's crypto-social layer (ENS/social handles shown in the on-chain site, DM routing by handle). Apply the unmerged fix; replace admin-chosen verifiers with on-chain proofs where possible; consider adding a `HandleKind` for the unified messaging identity.

---

## 8. `contracts/registry/AnimaRoles.sol` (291 lines)

### 8.1 Purpose
ERC-7432 roles registry: "operator, payer, auditor, trainer, or any other `bytes32` a deployment cares to define — each with its own recipient, its own expiry, and its own revocability." (`:16-18`). Why external: "`AnimaAgent` compiles to 23,971 of the 24,576 bytes EIP-170 allows. ERC-7432 will not fit in what is left, and none of the usual escapes help: stripping the metadata trailer buys 53 bytes, and dropping the optimizer to `runs: 1` buys another 376 while taxing every call the contract will ever serve. Measured, not assumed." (`:22-25`). "But ERC-7432 was designed for exactly this. From its Rationale, verbatim: *'ERC-7432 IS NOT an extension of ERC-721…'* Every function takes `tokenAddress` beside `tokenId` precisely so a standalone contract can be the authoritative source of roles for a token that knows nothing about them." (`:27-32`).
> "**Locking instead of escrow.** The spec's own suggestion is that a registry take custody of the NFT so a role cannot be sold out from under its holder. ANIMA does better: it already has a module-gated lock, so this registry is registered as a module and freezes the agent in place. The owner keeps the token in their own wallet, it stays visible to every marketplace and indexer, and it simply cannot move while a role is live." (`:34-39`)
> "**Irrevocable roles are capped.** A permanent role would make an agent permanently unsellable, which is the same 'authorisation outliving its relationship' defect that the security review found nine times over… irrevocable ones cannot exceed {MAX_IRREVOCABLE_DURATION}." (`:41-45`)
> "**Roles do not survive a sale, structurally.** While any role is live the agent is locked, so it cannot be sold at all. There is no window in which a buyer inherits the seller's grantees." (`:47-49`)

### 8.2 Inheritance: `IERC7432, IERC165`. **No Ownable — no admin at all.** Depends on `IAnimaRoleLocking { lockAgent; unlockAgent; locked }` (`:8-12`) and on being registered as a token module.

### 8.3 Constants / storage
```solidity
bytes32 OPERATOR = keccak256("anima.role.operator"); PAYER = keccak256("anima.role.payer"); AUDITOR = keccak256("anima.role.auditor"); TRAINER = keccak256("anima.role.trainer"); // :57-63
uint64 MAX_IRREVOCABLE_DURATION = 365 days;                                                                                                       // :67
struct RoleRecord { address recipient; uint64 expirationDate; bool revocable; bytes data; }                                                       // :73-78
address public immutable AGENTS;                                                                                                                  // :81
mapping(uint256 tokenId => mapping(bytes32 roleId => RoleRecord)) private _roles;                                                                 // :83
mapping(uint256 => uint64) public lockedUntil;        // latest irrevocable expiry                                                                 // :85
mapping(uint256 => uint256) public activeRoleCount;   // live records (incl. expired-but-uncollected)                                             // :86
mapping(uint256 => bool) public isLockedHere;                                                                                                     // :87
mapping(address owner => mapping(address operator => bool)) private _approvals;                                                                   // :88
```

### 8.4 API (ERC-7432 interfaceId `0xd00ca5cf`)
```solidity
constructor(address agents_)                                                                                                     // :107
function grantRole(Role calldata _role) external    // owner or role-approved; recipient != 0; expiry > now; cannot overwrite a live irrevocable role; irrevocable ≤ 365d; locks token on first role // :129
function revokeRole(address _tokenAddress, uint256 _tokenId, bytes32 _roleId) external   // grantee always; anyone if expired; owner only if revocable // :184
function unlockToken(address _tokenAddress, uint256 _tokenId) external   // permissionless when activeRoleCount == 0 and now >= lockedUntil // :207
function setRoleApprovalForAll(address _tokenAddress, address _operator, bool _approved) external                                  // :221
function ownerOf(address, uint256) external view returns (address)     // live ERC-721 holder ("no separate 'original owner'")     // :234
function recipientOf(address, uint256, bytes32) public view returns (address)   // 0 if expired                                    // :240
function roleData / roleExpirationDate / isRoleRevocable / isRoleApprovedForAll                                                     // :247-280
function hasRole(uint256 _tokenId, bytes32 _roleId, address _account) external view returns (bool)   // non-standard convenience  // :283
function supportsInterface(bytes4) external pure returns (bool)                                                                    // :288
```
Errors: `UnsupportedCollection`, `NotOwnerOrApproved`, `ExpirationInThePast`, `IrrevocableTooLong`, `RoleNotRevocable`, `IrrevocableRoleActive`, `StillLocked(tokenId, until)`, `ZeroRecipient`. Events are the ERC-7432 ones (`TokenLocked`, `RoleGranted`, `RoleRevoked`, `TokenUnlocked`, `RoleApprovalForAll`).
Comment on overwrite protection (`:137-140`, fix from `docs/TESTNET_AUDIT_2026-09-02.md:24`): "An irrevocable grant is a promise to its recipient until expiry. Allowing the owner to overwrite the same role id would revoke that promise while leaving only the token lock behind." Comment on `unlockToken` (`:205-206`): "Permissionless once nothing irrevocable is outstanding: an agent should return to circulation without needing its grantees to cooperate." Note the `activeRoleCount != 0` check (fix from `TESTNET_AUDIT_2026-08-31.md:30` "A live revocable ERC-7432 role now prevents permissionless unlocking until the role is revoked") — expired records must be collected via `revokeRole` (anyone) before unlock.

### 8.5 Tests (`Roles.test.ts`, 14): "advertises the interface id the spec publishes"; "holds four distinct roles at once — the thing ERC-4907 cannot express"; "freezes the agent in place rather than taking custody of it"; "returns the agent to circulation once roles are cleared"; "does not unlock while a revocable role is still active"; "keeps the lock through the longest live role after another role is revoked"; "does not unlock after an irrevocable role expires while a longer revocable role is live"; "caps an irrevocable role, so a grant cannot lock an agent forever"; "cannot overwrite an unexpired irrevocable role"; "holds an irrevocable role against the owner until it expires" (grantee can walk away, lock still runs); "lapses a role on its own expiry"; "lets an approved operator grant on the owner's behalf, and nobody else"; "refuses to answer for a collection it does not represent"; "rejects an expiry already in the past". Live: three simultaneous roles + permissionless unlock tx `0x9c86151a…d06` (`LIVE_FUNCTION_MATRIX:35`).

### 8.6 Weaknesses
- Roles are *not* consulted by `AnimaAgent.isController` or by `AgentAccount` — `hasRole` is advisory for modules; nothing in the repo grants an OPERATOR-role holder any on-chain power (the token's own `setOperator` is separate). Integration is left to modules.
- An irrevocable 365-day role makes the token unsellable for a year (by design, documented).
- Must be a token module: a buggy/malicious module can lock any token; here the registry only locks on an owner-authorised grant.
- `revokeRole` of an expired record by anyone is required before `unlockToken` — two transactions for the common case.

### 8.7 Verdict: **reuse-verbatim / adapt**. Admin-free, standards-conformant, well-tested; the only coupling is the `lockAgent/unlockAgent` module hook, which the unified token needs anyway. Useful for the GOAL as delegated "operator/payer" roles over the NFT's wallet/site without transferring it.

---

## 9. `contracts/registry/AnimaBindings.sol` (128 lines)

### 9.1 Purpose
ERC-8217 (Draft 2026-04-05) binding: "Attaches an entry in the chain's singleton ERC-8004 Identity Registry to a master NFT — an ANIMA agent, or any ERC-721/1155 — so that whoever owns the NFT controls the agent, and control follows sales automatically." (`:37-39`). "ANIMA implements ERC-8004's Identity Registry directly on its own token… But the ecosystem is converging on one singleton registry per chain, and an agent that is not in it is invisible to indexers and clients that only look there. This contract is the bridge." (`:41-48`). "**Bindings are immutable**, as ERC-8217 requires. A mutable binding would let an agent accumulate reputation under one NFT and then re-point at another, which is identity laundering with extra steps." (`:53-55`). "The binder must own the master token at bind time. ERC-8217 does not require this; without it anyone could bind their own agent id to someone else's blue-chip NFT and borrow its standing." (`:57-59`).

### 9.2 Interface/API
```solidity
interface IERCAgentBindings { enum TokenStandard { ERC721, ERC1155, ERC6909 } struct Binding { TokenStandard standard; address tokenContract; uint256 tokenId; } event AgentBound(uint256 indexed agentId, TokenStandard indexed standard, address indexed tokenContract, uint256 tokenId, address registeredBy); function bindingOf(uint256) external view returns (Binding memory); } // :11-33
string public constant BINDING_METADATA_KEY = "agent-binding";  IERC721 public immutable IDENTITY_REGISTRY;                   // :63,70
constructor(address identityRegistry)                                                                                            // :78
function bind(uint256 agentId, TokenStandard standard, address tokenContract, uint256 tokenId) external   // caller must own agentId in IDENTITY_REGISTRY AND the master token; ERC-6909 refused // :84
function bindingOf(uint256 agentId) external view returns (Binding memory)                                                       // :111
function controllerOf(uint256 agentId) external view returns (address)   // ownerOf(master) for ERC-721 bindings, else 0         // :118
function bindingMetadataValue() external view returns (bytes memory)     // abi.encodePacked(address(this))                      // :125
```
Errors `AlreadyBound`, `NotAgentOwner`, `NotTokenOwner`, `UnsupportedStandard`, `ZeroAddress`. No admin.

### 9.3 Tests (`Bindings.test.ts`, 3): "rejects an NFT owner trying to permanently hijack another ERC-8004 identity"; "allows the current identity owner to bind a token they own and follows token transfers"; "requires ownership of both the ERC-8004 identity and proposed master token". Live: `scripts/testnet-everything.ts:80` "bind ERC-8004 identity to NFT"; address `0x4e04…EaD7` on Base Sepolia.

### 9.4 Weaknesses
- `scripts/deploy.ts:163` deploys `AnimaBindings` **with no constructor argument** while the contract requires `identityRegistry` — that script is stale for this contract.
- The contract does not write the `agent-binding` metadata into the ERC-8004 registry; the owner must do it separately and nothing verifies consistency.
- No unbind; ERC-1155 bindings have no controller.

### 9.5 Verdict: **drop** for the GOAL (it only matters for ERC-8004 singleton interop); trivially **reuse-verbatim** if that interop is wanted later.

---

## 10. Branch survey for this area

`origin/main` is the only branch with the current code. Branches that *differ* on these files fall into two classes:
- **Behind main** (older snapshots, no unique commits): `codex/check-if-revocable-role-unlock-issue-is-fixed`, `codex/investigate-privilege-escalation-vulnerability`, `codex/check-if-erc-6492-vulnerability-was-patched`, `codex/check-if-native-drop-lock-vulnerability-is-fixed`, `codex/perform-thorough-audit-and-testing`, `codex/master-and-upgrade-nft-fundamentals`, `claude/nft-standard-ai-agents-2y8ngz`, `codex/design-beautiful-nft-user-interface` — the diffs shown are main's later fixes (ERC-8126, provider separation, irrevocable-overwrite guard, handle reclamation).
- **Ahead of main**: `codex/fix-high-priority-bug-in-handle-reclamation` (`a767f7c`) — the AgentHandles fix in §7.5. `codex/fix-high-priority-issues-from-codex-review` (`348a0c6`, `1db27f2`) touches RevenueRouter, not this area. `upgrade/sanctuary-commons-3d-20260904`, `fix/utility-workflows-20260904`, `build/idfbi-isolated-toolchain-20260904` add a 3D Sanctuary / "consent-first Commons social layer" and a toolchain snapshot; `git diff --stat` shows no contract changes in `contracts/account` or `contracts/registry` on those branches (other readers cover their UI).

---

## 11. Web UI delivery and ownership verification (explicit answer)

**Is the UI delivered from chain?** Partly, and never by the NFT itself:

1. **GitHub Pages "Sanctuary"** (`index.html`, `src/main.js`, `vite.config.js`; workflow `.github/workflows/pages.yml` builds `npm run ui:build` → `dist/` → `actions/deploy-pages`). Static, off-chain, hard-codes the token address `0xb3d92c766e3cb356db381feb21958a9ebb974365` and RPC `https://sepolia.base.org` (`src/main.js:~170`). README: "The current console targets the historical Base Sepolia deployment" (`README.md:479`).
2. **`AnimaWeb3Renderer`** (`contracts/web/AnimaWeb3Renderer.sol`, 22,592 runtime bytes): an ERC-4804 *manual-mode* contract (`resolveMode()` returns `"manual"`, `fallback(bytes calldata path)` returns ABI-encoded HTML) serving `/` and `/token/{id}/live`. It renders owner, ERC-6551 account, collection, a tabbed console (overview/identity/control/advanced) and a "CONNECT WALLET" button. Reachable as `web3://0x9160be4d…75cd:84532/token/{agentId}/live` or `https://0x9160be4d…75cd.basesep.w3link.io/token/{id}/live` (`public/.well-known/anima.json` "rendering"). Its `<script type="module">` **imports `viem@2.55.19` from `https://esm.sh`** and reads via public RPC — so the page is on-chain but its runtime is not self-contained. It is a *separate, stateless, ownerless* contract ("Keeping this separate from the immutable ANIMA diamond lets an existing collection gain a browser without changing token logic", `:15-16`); `scripts/deploy-web3-renderer.ts` deploys or reuses it and records `web3Renderer` in the deployment JSON. Test `Web3Renderer.test.ts` asserts the HTML contains the owner and account addresses and `doesNotMatch(/github\.io/)`.
3. **`tokenURI`**: minting from the Sanctuary builds a `data:application/json` URI embedding an SVG (`src/main.js:metadataURI`) so wallets render the NFT without any server — but this is metadata, not an app. (The token's own `tokenURI` implementation is outside my area.)

**How does it verify NFT ownership for access?** Client-side only, by RPC reads:
- Sanctuary `connect()` → `walletClient.requestAddresses()` → `discover()` reads `totalMinted` and calls `ownerOf(id)` for every id `1..n`, keeping those equal to the connected address (`src/main.js: discover`), then shows the "Command Chamber" for owned ids. Any id can also be inspected read-only without connecting. There is no signature challenge, no session, no server; "ownership verified" is a UI label over `ownerOf` results.
- Renderer page: no gating at all; it offers `deployAccount`/`setStatus`/`setGuardian`/`setOperator` and a raw "SIMULATE & EXECUTE" console; `simulateContract` surfaces the contract revert (`NotOwnerOf`, `NotAgentController`) before the wallet signs.
- The *enforcement* is entirely in the contracts: `AnimaAgent._requireOwnerOf` / `_requireController` / `isController` (owner ∨ lease user ∨ operator), `AgentAccount._requireOwner` / `_authorize` (owner unrestricted, session keys leashed), module gates on the registries.

Implication for the GOAL: ANIMA has the *wallet* and *delegation* primitives the unified site needs (connect → read `ownerOf`/`isController` → act through the token's ERC-6551 account with owner or session key), but the site-from-the-token itself must come from the other repo (IPSEITY's Engine/Premises/ERC-5219 pattern), and the on-chain renderer's `esm.sh` import would violate a "no external dependency" rule.

---

## 12. Reuse matrix against the GOAL

| Component | Verdict | Why (relative to swap + social/messaging + launchpad + vault inside one NFT, on-chain site, wallet gating) |
|---|---|---|
| `AgentAccount` | **adapt** | The "vault"/wallet with bounded delegated keys, audit chain, 4337, ERC-6551-state pinning. Decouple policy/status reads from `IAnima` (or keep them on the unified hub), add ERC-20 caps, unify merkle path for 4337, resolve OZ dependency, optionally pair with a receive-only Grip. |
| `BondVault` | **adapt** | Correct reserve/unbond/slash accounting for any staking/escrow feature; single-ERC-20; admin-set modules/arbiters must become constructor-pinned for a no-admin design. Not the holder's asset vault. |
| `ReputationRegistry` | **adapt** | Social-layer trust signal: ERC-8004 + attested/weighted O(1) aggregate. Bound `valueDecimals`; pin settlement modules. |
| `ValidationRegistry` | **adapt-or-drop** | Keep only with a work/dispute flow; opener-namespaced keys and one-answer rule are the lessons. ERC-8126 optional. |
| `AgentHandles` | **adapt** | Verified handles (ENS/social/email/DID/mesh) bound 1:1 to the NFT, stale on sale — good for the social layer. Apply unmerged fix `a767f7c`; prefer on-chain proofs over admin verifiers. |
| `AnimaRoles` | **reuse-verbatim / adapt** | Admin-free ERC-7432 with lock-not-escrow; only needs the hub's lock hook. |
| `AnimaBindings` | **drop** (reuse-verbatim if 8004-singleton interop wanted) | Tiny, immutable, not needed for the four features. Fix `scripts/deploy.ts` if kept. |

Unique ideas worth carrying forward: owner-unrestricted vs session-leashed asymmetry; `grantedBy`-namespaced sessions and allowlists so a sale structurally voids them; `state()` bumps on authorisation widening so integrity pins catch re-arming; the audit hash chain bound to `(chainId, account)` with an SDK replay; EntryPoint-is-never-a-principal; guardian can revoke but never spend; coverage reserved-not-counted with per-module reservation ownership; unbonding stays slashable and belongs to the queuer; attested feedback weighted by capital at risk (min(price, coverage)) with an O(1) aggregate; opener-namespaced validation keys; lock-not-escrow roles with a capped irrevocable term; handles stale on transfer with burned-token reclaimability; immutable per-facet ERC-6551 config checked by `animaConfigHash` instead of paid for in SLOADs.

## 13. Pitfalls for the design team
- `AgentAccount.token()` hard-codes the canonical registry's proxy footer offset (0x4d); a custom registry/proxy breaks it silently.
- Both ERC-6551 `state()` *and* ERC-5646 `getStateFingerprint` exist; the market pins the former, the SPEC says the latter is strictly stronger — pick one for the unified market.
- Rolling-day cap is a UTC bucket; session budgets are native-only.
- Registries each have an `Ownable2Step` owner (except AnimaRoles/AnimaBindings); the "immutable, admin-free" promise of the token does not extend to them.
- Test count drift: 268 in files vs 279 in README/SECURITY/DEPLOYMENT; CLAUDE.md says 268. Re-count before quoting.
- The Base Sepolia owner keys are destroyed; `deployments/84532.json` is historical.
- `scripts/deploy.ts` passes no args to `AnimaBindings` — stale.
- Memory/calldata duplicate authorisation paths in `AgentAccount` must be edited in lockstep; they already diverge on merkle proofs.
