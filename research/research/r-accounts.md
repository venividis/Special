# Account abstraction and token-bound accounts in 2026 — what an NFT-owned wallet should look like

Research memo for the unified NFT protocol (merge of IPSEITY, ANIMA, Pixel-Garden, MASTER-NFT/Dave).
Date of research: 2026-10-02. Method: 20 web searches, 16 primary pages read (EIP/ERC texts at
eips.ethereum.org, GitHub release pages, audit reports, protocol docs). Every number below carries the
date of the source where the source gave one; where a claim could not be tied to a primary source it is
marked **unverified**. Nothing in this memo is a substitute for reading the cited spec before coding.

---

## 0. The one-paragraph answer

The NFT-owned wallet in 2026 is still an **ERC-6551 token-bound account** (the only standard that
derives an account from a token, with a canonical ownerless registry at
`0x000000006551c19487814612e58FE06813775758`), but it should **speak the interfaces that the rest of the
account ecosystem converged on after Pectra**: the ERC-7579/ERC-7821 `execute(bytes32 mode, bytes
executionData)` batch shape, ERC-1271 with **ERC-7739 defensive rehashing**, ERC-4337 `validateUserOp`
against **EntryPoint v0.9**, **ERC-7715-shaped permission grants** redeemable through an
**ERC-7710 `redeemDelegations`**-style entry, and signers expressed as **ERC-7913 `verifier || key`
blobs** so that a **P-256 passkey** (verified at precompile `0x100` since Fusaka on L1 and RIP-7212 on
most L2s) can control the NFT's wallet next to the holder's EOA. What it should **not** be: an
upgradeable module host that installs arbitrary third-party code (every 2024-2025 modular-account audit
found a module-installation or hook-bypass path), nor an EIP-7702 delegate target (incompatible with the
6551 bytecode footer, and the 7702 delegation space is majority-malicious by count). The four local
repos already implement most of the right primitives — custody epochs, sealed vaults with no exit path,
bounded session keys, a no-upgrade stance — and the gap is interface conformance, not architecture.

---

## 1. State of the art, standard by standard

### 1.1 ERC-6551 — token-bound accounts (status: Review)

Primary text: https://eips.ethereum.org/EIPS/eip-6551 (created 2023-02-23; front-matter status
`Review`, `requires: 165, 721, 1167, 1271`).

- **Registry.** Singleton, permissionless, immutable, ownerless. MUST be deployed at
  `0x000000006551c19487814612e58FE06813775758` through Nick's Factory
  `0x4e59b44847b379578588920cA78FbF26c0B4956C` with salt
  `0x0000000000000000000000000000000000000000fd8eb4e1dca713016c518e31`.
  ```solidity
  function createAccount(address implementation, bytes32 salt, uint256 chainId,
                         address tokenContract, uint256 tokenId) external returns (address);
  function account(address implementation, bytes32 salt, uint256 chainId,
                   address tokenContract, uint256 tokenId) external view returns (address);
  event ERC6551AccountCreated(address account, address indexed implementation, bytes32 salt,
                              uint256 chainId, address indexed tokenContract, uint256 indexed tokenId);
  error AccountCreationFailed();
  ```
- **Proxy bytecode.** ERC-1167 header (10) + implementation (20) + footer (15) + salt (32) + chainId
  (32) + tokenContract (32) + tokenId (32) = **181 bytes**. The account reads `token()` from its own
  code; this is what makes the account stateless-capable and also what makes it incompatible with
  EIP-7702 (section 2.3).
- **Account interface.** `receive()`, `token() → (chainId, tokenContract, tokenId)` (constant),
  `state() → uint256` (must change whenever account state changes), and
  `isValidSigner(address signer, bytes context) → bytes4` returning magic `0x523e3260`; the holder of the
  bound NFT MUST be a valid signer by default; implementations MAY add or remove signers.
  ERC-165 and ERC-1271 are mandatory. Execution interface is not mandated; the common one is
  `IERC6551Executable.execute(address to, uint256 value, bytes data, uint8 operation)` with
  `operation ∈ {0 CALL, 1 DELEGATECALL, 2 CREATE, 3 CREATE2}`, interface ids `0x6faff5f1`
  (IERC6551Account) and `0x51945447` (IERC6551Executable) as used in `src/IpseityAccount.sol`.
- **Reference implementation.** `erc6551/reference` README: current version **v0.3.1** recommended for
  production; "0.3.x introduces breaking changes in IERC6551Registry"; an `audits` folder exists.
  Tokenbound's opinionated AccountV3 is deployed at the same addresses on every chain
  (deploy.tokenbound.org, docs.tokenbound.org/contracts/deployments): **AccountProxy
  `0x55266d75D1a14E4572138116aF39863Ed6596E7F`** (pass as `implementation` to `createAccount`),
  **AccountV3 implementation `0x41C8f39463A868d3A88af00cd0fe7102F30E44eC`**, **AccountGuardian
  `0x2FE5ccb0d7Ea195FEb87987d3573F9fcCE2b5D57`**; listed chains include Ethereum, Polygon, Optimism,
  Base, Linea, Klaytn, Monad. AccountV3 is itself an ERC-1967 proxy behind the 1167 proxy (upgradeable
  through the Guardian's trusted-implementation list), ships `Lockable`, `Overridable`,
  `Permissioned`, `NestedAccountExecutor`, `SandboxExecutor`, and an `ERC4337Account` mixin that still
  targets `@account-abstraction/contracts ^0.6.0` (npm package metadata, 2024-02-25). Tokenbound's FAQ
  cites a preliminary audit by 0xMacro and a planned Certik audit; the actual reports were not located
  in this session (**unverified**).
- **Adoption numbers.** Dune's ERC/EIP starter kit (ilemi) counts **1,088 contracts** emitting the
  `ERC6551AccountCreated` signature across all Dune-supported EVM chains, 162 in the last 30 days at
  fetch time (dashboard undated). No reliable count of individual accounts was found (the sealaunch and
  sixdegree dashboards did not render); treat TBA population as **unverified**. For scale, the same
  dashboard counts 6.44M contracts for the ERC-4337 account-deployed signature.
- **Security considerations in the spec itself.** (a) *Ownership cycles*: an NFT transferred into its
  own TBA (or any cycle in a graph of TBAs) makes the NFT and everything in the account permanently
  inaccessible; on-chain detection beyond depth 1 is out of scope. (b) *Fraud prevention*: a seller can
  drain the TBA between listing and sale; mitigations listed are attaching `state()` to the order,
  attaching asset commitments, routing orders through a contract that checks both, or a **lock** on the
  account. (c) From practitioners (OneKey, 2025-10-16; RareSkills, 2025-08-20): approvals granted by the
  TBA survive the NFT's sale and hand the buyer's assets to whoever was approved; `isValidSignature` must
  be domain-separated to avoid replay across chains and accounts; `owner()` must never be `Ownable`.

### 1.2 ERC-7656 — generalized contract-linked services (status: Final)

Primary text: https://eips.ethereum.org/EIPS/eip-7656 (created 2024-03-15, author Francesco Sullo).
Extends the 6551 pattern to any service linked to a contract-plus-id, with a 12-byte `mode` word
(`LINKED_ID = 0x…00`, `NO_LINKED_ID = 0x…01`) and a 183-byte proxy (`…+ salt(32) + chainId(32) +
mode(12) + linkedContract(20) + linkedId(32)`):
```solidity
function create(address implementation, bytes32 salt, uint256 chainId, bytes12 mode,
                address linkedContract, uint256 linkedId) external returns (address);
function compute(…same…) external view returns (address service);   // interface id 0x9e23230a
```
The EIP states the reference factory bytecode is deployed at
`0x76565d90eeB1ce12D05d55D142510dBA634a128F` on Ethereum mainnet. This is directly relevant to "a
swap, a vault and a launchpad *inside* the NFT": every per-token satellite (pool, vault, launch slot)
can be a deterministic, counterfactual, token-linked service rather than a mapping in a hub contract.

### 1.3 ERC-4337 — EntryPoint versions and ecosystem numbers (status: Final)

Primary texts: https://eips.ethereum.org/EIPS/eip-4337; https://github.com/eth-infinitism/account-abstraction/releases.

- `PackedUserOperation {sender, nonce, initCode, callData, accountGasLimits, preVerificationGas,
  gasFees, paymasterAndData, signature}`; `IAccount.validateUserOp(PackedUserOperation calldata
  userOp, bytes32 userOpHash, uint256 missingAccountFunds) returns (uint256 validationData)` with
  `validationData = aggregator(20) ‖ validUntil(6) ‖ validAfter(6)`; `IPaymaster.validatePaymasterUserOp`
  / `postOp`; `EntryPoint.handleOps(PackedUserOperation[] ops, address payable beneficiary)`. 7702
  accounts signal with `initCode` starting `0x7702` right-padded, and the RPC carries an
  `eip7702Auth` tuple that bundlers must place in the transaction's `authorizationList`.
- **Versions and addresses** (release page, verified):
  | Version | Tag date | EntryPoint | Notable |
  |---|---|---|---|
  | v0.6.0 | 2023 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | new userOpHash, EntryPoint-managed nonces |
  | v0.7.0 | 2024 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | packed userOp, simulation moved off-chain, 10% unused-gas penalty |
  | v0.8.0 | 26 Mar (2025; team announcement 2025-03-31) | `0x4337084d9e255ff0702461cf8895ce9e3b5ff108` | native EIP-7702 authorizations, EIP-712 userOp hash, `Simple7702Account`, initCode front-running fix, unused-gas penalty waived below 40k |
  | v0.9.0 | 16 Nov (2025, inferred from ordering) | `0x433709009B8330FDa32311DF1C2AFA402eD8D009` (SenderCreator `0x0A630a99Df908A81115A3022927Be82f9299987e`) | ABI-compatible with v0.7/v0.8; `paymasterSignature` for parallel paymaster signing; block-number validity ranges (high bit of validAfter/validUntil); `initCode` ignored if account exists (`IgnoredInitCode` event — breaks "initCode ⇒ first op" assumptions); `getCurrentUserOpHash()`; `EIP7702AccountInitialized` event; `BasePaymaster(owner)` |
  The ERC-4337 team disclosed on 2026-02-05 a high-severity griefing issue (reported by TrustSec via
  HackenProof): visible UserOps could be made to revert yet pay gas; **v0.9 fixes it by allowing
  `handleOps`/`handleAggregatedOps` only from an EOA in a top-level call**. Candide's bundler and
  paymaster support v0.9 as of 2026-02-26; Etherspot/Skandha supported v0.8 from 2025-03-31.
- **Numbers (BundleBear, all chains, fetched 2026-10):** 1,299,023,473 total UserOps; 856,481,360
  bundle transactions; $14,406,802 paymaster volume; 67,916,918 accounts with ≥1 UserOp. Factories by
  accounts deployed: Alchemy 13,748,620; ZeroDev Kernel 5,805,959; SimpleAccount 4,386,003; Coinbase
  Smart Wallet 4,102,572; Biconomy 2,281,894; thirdweb 1,363,641. Bundlers by UserOps: Alchemy 797.5M,
  Pimlico 135.1M, Coinbase 118.1M. 2024 alone had 103M UserOps vs 8.3M in 2023.

### 1.4 EIP-7702 — set code for EOAs (status: Final; live since Pectra)

Primary text: https://eips.ethereum.org/EIPS/eip-7702. Pectra activated on mainnet **2025-05-07
10:05 UTC, epoch 364032** (ethereum.org roadmap page; execution-specs protocol_history lists Prague at
block 22431084 with EIP-7702).

- Authorization tuple `[chain_id, address, nonce, y_parity, r, s]`; on success the account's code becomes
  the 23-byte **delegation indicator `0xef0100 ‖ address`**; storage persists across re-delegations;
  delegating to `0x0` clears it; `PER_AUTH_BASE_COST = 12,500`, `PER_EMPTY_ACCOUNT_COST = 25,000`;
  processed delegations are **not rolled back** if the transaction's execution fails;
  `tx.origin == msg.sender` no longer implies top-level EOA. Security section: initialization
  front-running (sign the init calldata with the EOA key), storage collisions across delegates (use
  ERC-7201), re-delegation is security-critical. `chain_id = 0` tuples are valid on every chain.
- **Adoption.** BundleBear's 7702 page: **54,585,411 live delegated accounts, 238,265,031 total
  authorizations, 99,665,705 set-code transactions** (cross-chain; a Sept 2026 article cites these as
  "early September 2026" figures and notes they are inflated by sweeper bots). Wintermute's Dune
  dataset: **10,953,648 cumulative authorizations on Ethereum mainnet by 2026-03-29**. First week after
  Pectra: ~11,000 authorizations, of which WhiteBIT's delegate took 5,300, OKX ~3,100, MetaMask ~1,300
  (The Block, 2025-05-15). Delegate contracts in production: MetaMask `EIP7702StatelessDeleGatorImpl`
  `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` (delegation-framework v1.3.0, 2025-07-24), Uniswap
  Calibur (ERC-7821 + ERC-7739 + ERC-4337 + hooks per its ARCHITECTURE.md), Alchemy
  `SemiModularAccount7702`, eth-infinitism `Simple7702Account`, OKX, Ambire, Trust, Rabby, Safe.
  MetaMask exposes batching through ERC-5792 `wallet_sendCalls` (v2.0.0, `atomicRequired`) on
  Ethereum, Gnosis, BNB, OP, Base, Polygon, Arbitrum, Unichain, Berachain and refuses to act on
  accounts delegated to third-party code.
- **Crime share.** Wintermute (CoinDesk 2025-06-02): >97% of delegations at end of May 2025 went to
  copy-pasted "CrimeEnjoyor" sweepers; one address took 52,000 of ~79,000 authorizations bought for
  2.88 ETH. By 2025-09-22, 768,275 of 1,580,930 (48%) authorizations were crime-tagged (Protos). A
  USENIX Security '26 paper measured 3,664,166 authorization transactions on seven chains before
  2025-07-15: **>63% malicious**, 793 EOA-targeted + 124 contract-targeted + 7 composite malicious
  contracts, **$2,362,848 stolen**, ~$10.14M at risk in contracts whose `tx.origin` assumptions broke.
  The OAK incident corpus puts cumulative delegation-phishing losses at **$12M+ across 15,000+ wallets
  (May–Dec 2025)**, with 450,000+ wallets carrying live malicious delegations; anchor incidents:
  2025-05-24 **$146,551** drained through the *legitimate* MetaMask delegator via a malicious batch
  (Inferno Drainer, SlowMist), and 2025-08-24 **$1.54M** from one victim signing a fake-Uniswap batch.

### 1.5 ERC-7579 — minimal modular smart accounts (status: Draft)

Primary text: https://eips.ethereum.org/EIPS/eip-7579 (created 2023-12-14; requires 165, 1271, 2771,
4337). Despite marketing copy calling it "final", the EIP page still reads Draft.
```solidity
function execute(bytes32 mode, bytes calldata executionCalldata) external payable;
function executeFromExecutor(bytes32 mode, bytes calldata executionCalldata) external payable returns (bytes[] memory);
function executeUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash) external; // optional, onlyEntryPoint
function accountId() external view returns (string memory);          // "vendor.account.semver"
function supportsExecutionMode(bytes32) external view returns (bool);
function supportsModule(uint256 moduleTypeId) external view returns (bool);
function installModule(uint256 moduleTypeId, address module, bytes calldata initData) external;
function uninstallModule(uint256 moduleTypeId, address module, bytes calldata deInitData) external;
function isModuleInstalled(uint256 moduleTypeId, address module, bytes calldata ctx) external view returns (bool);
// modules
function onInstall(bytes calldata) external; function onUninstall(bytes calldata) external; function isModuleType(uint256) external view returns (bool);
function validateUserOp(PackedUserOperation calldata, bytes32) external returns (uint256);           // validator, type 1
function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata sig) external view returns (bytes4);
function preCheck(address msgSender, uint256 value, bytes calldata msgData) external returns (bytes memory); // hook, type 4
function postCheck(bytes calldata hookData) external;
```
Mode word: byte0 CallType (`0x00` single, `0x01` batch, `0xfe` staticcall, `0xff` delegatecall), byte1
ExecType (`0x00` revert, `0x01` try), bytes 2-5 reserved, bytes 6-9 ModeSelector, bytes 10-31 payload.
Module types: 1 validator, 2 executor, 3 fallback, 4 hook; ZeroDev's Kernel adds **5 policy, 6 signer**
(its `installModule` NatSpec). Normative security text: accounts MUST sanitize validator-selection
bytes before forwarding; MUST distinguish module types for access control; hooks MUST wrap
`execute`/`executeFromExecutor` and SHOULD wrap install/uninstall; fallback handlers must use ERC-2771
`_msgSender()`; malicious hooks can DoS the account; `delegatecall` executions must be gated.
ERC-7484 adds the registry adapter — Rhinestone's ownerless singleton at
`0x000000000069E2a187AEFFb852bF3cCdC95151B2`; accounts query attestations at install and optionally per
execution (≈7,983 gas for one attester).

Implementations: Rhinestone reference, ZeroDev Kernel v3, Biconomy Nexus (audits: CodeHawks-Cyfrin
Sept 2024, Spearbit Oct/Nov 2024 plus ERC-7739 add-on, Zenith Mar 2025, Pashov Mar 2025; Rhinestone's
fork adds ChainLight Jul 2025), Safe via the Safe7579 adapter (Ackee audit June 2024; launch
2024-07-05 with "35 reusable modules, 12 audited"), OpenZeppelin `AccountERC7579`/`Hooked` presets,
Trust Wallet smart accounts (Nexus base). Rhinestone has deprecated ModuleKit/ModuleSDK in favour of
its own SDK (erc7579.com notices).

### 1.6 ERC-6900 — modular smart contract accounts (status: Draft)

Primary text: https://eips.ethereum.org/EIPS/eip-6900 (created 2023-04-18). Spec v0.8 is what Alchemy's
Modular Account v2 implements. Interface: `execute(address,uint256,bytes)`, `executeBatch(Call[])`,
`executeWithRuntimeValidation(bytes data, bytes authorization)`, `installExecution`/`uninstallExecution`
(with a manifest), `installValidation`/`uninstallValidation` (ValidationConfig = module(20) ‖
entityId(4) ‖ flags(1)), `accountId()`; module types: validation, execution, validation hooks,
execution hooks; "semi-modular" accounts may implement features natively. The philosophical split
(ZeroDev's "who/when/what" post vs Alchemy's commentary): 6900 makes the *module author* declare how
validation binds to execution (manifests, permissions enforced by the account); 7579 leaves that to
whoever installs the modules — more composable, less portable, and (Alchemy's point) harder to
guarantee gas limits and cross-account module behaviour. Numbers: MAv2 account creation **97,764 gas
vs Kernel v3 180,465 (+84.6%) vs Safe+4337 module 289,207 (+195.8%)** (Alchemy docs); audits
ChainLight and Quantstamp (Quantstamp scope included the 7702 semi-modular account PR #275/#288);
Alchemy's factories lead BundleBear with 13.7M accounts. The repo targets **ERC-4337 v0.9.0 and
ERC-6900 v0.8.0** today and warns that under 7702 only `SemiModularAccount7702` may be the delegate
(other variants have unprotected initializers).

### 1.7 ERC-7710 / ERC-7715 — delegations and wallet permissions (both Draft)

Primary texts: https://eips.ethereum.org/EIPS/eip-7710 (2024-05-20), https://eips.ethereum.org/EIPS/eip-7715 (2024-05-24).
```solidity
// ERC-7710 — the only normative on-chain surface
function redeemDelegations(bytes[] calldata permissionContexts, bytes32[] calldata modes,
                           bytes[] calldata executionCallDatas) external;   // tuples (ctx[i], mode[i], calldata[i]); atomic
```
ERC-7710 adopts the ERC-7579 mode/execution encoding and deliberately leaves the delegator interface
and caveat semantics to implementations; it warns that permission checks must be done by simulating
`redeemDelegations`, since delegations can expire or be revoked between check and use.

ERC-7715 defines `wallet_requestExecutionPermissions` (request: `chainId, from?, to (session account),
permission {type, isAdjustmentAllowed, data}, rules[] {type, data}`; response adds opaque `context`,
`dependencies [{factory, factoryData}]` for undeployed accounts, and `delegationManager`), plus
`wallet_getSupportedExecutionPermissions`, `wallet_getGrantedExecutionPermissions`,
`wallet_revokeExecutionPermission`. Example permission types: `native-token-allowance`,
`erc20-token-allowance`, `erc721-token-allowance`; example rule `expiry`.

Production reality (MetaMask docs, Aug 2026 survey by Pegler): **MetaMask is the only wallet with a
documented, public ERC-7715 surface.** Production MetaMask ≥ v13.23.0 supports `erc20-token-periodic`,
`erc20-token-stream`, `native-token-periodic`, `native-token-stream`; ≥ v13.32.1 adds the allowance
types; the user must first be upgraded to a MetaMask smart account (7702). The on-chain side is the
MetaMask Delegation Framework: `DelegationManager 0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3`,
`HybridDeleGatorImpl 0x48dBe696A4D990079e039489bA2053B36E8FFEC4`, `MultiSigDeleGatorImpl
0x56a9EdB16a0105eb5a4C54f4C062e2868844f3A7` (v1.3.0, 2025-07-24, same addresses across chains), with
~30 caveat enforcers (`AllowedTargets`, `AllowedMethods`, `AllowedCalldata`, `ExactCalldata`,
`ERC20TransferAmount`, `ERC20PeriodTransfer`, `ERC20Streaming`, `NativeTokenPeriodTransfer`,
`Timestamp`, `LimitedCalls`, `Nonce`, `Redeemer`, `ValueLte`, `ApprovalRevocation`, …). Consensys
Diligence's Feb–Mar 2025 review found two **criticals**: `NativeTokenStreamingEnforcer` (and
`NativeTokenTransferAmountEnforcer`) checked only `value`, not target or calldata, so a "streaming"
delegation could call anything; and `DelegationMetaSwapAdapter.swapByDelegation` was front-runnable
(aggregator, slippage and swap data were outside the signed delegation). Fixes: new
`ExactCalldataEnforcer`/`ExactCalldataBatchEnforcer`, leaf-delegator-only swaps, signed `apiData`.

### 1.8 Session keys in practice — Smart Sessions and the local repos

Rhinestone + Biconomy's **Smart Sessions** (`erc7579/smartsessions`, authors Makarov and
zeroknots) is the de-facto ERC-7579 session validator: a session = `(ISessionValidator, initData,
salt, ActionData[] {target, selector, policies[]}, userOpPolicies[], erc7739Policies)`; a
`permissionId` is derived from the triple; policies compose as logical AND (sudo, call, spending limit,
time frame, usage limit, value limit); "enable mode" installs the session inside the first UserOp from a
single owner signature (multi-chain `hashesAndChainIds`); ERC-1271 by a session key is only allowed
through an ERC-7739 wrapper with content-type allow-lists (`isValidSignatureWithSender` returns
`0x77390001` to the 7739 probe hash and refuses `sender == address(this)`). The docs warn that a session
with no permissions allows *any* transaction. Rhinestone's docs also say scoped `signTypedData` through a
session is disabled "until safe ERC-7739 signature emission is restored" — a live caveat.

The local repos already implement the same idea without modules: IPSEITY's `IpseityAccount`
(`grantSession(key, expiry, spendCap, targets, selectors)`, `executeAsSession`, `SoldOn(granted, now)`
custody-epoch error, balance-measurement seals, `OwnershipCycle()` guard); ANIMA's `AgentAccount`
(`grantSession(signer, validAfter, validUntil, spendCapWei)`, per-tx/daily/session caps,
`setAllowedCall(target, selector)`, `DelegateCallNotAllowed`, 4337 `validateUserOp`/`executeUserOp` with
an immutable EntryPoint per facet); Pixel-Garden's `ReachAccount` (epoch-bound `authorized(epoch,
sender)` modifier on every withdrawal, `sealAsset`/`sealAll`, recipe-hashed `grantSession`, a Grip with
no exit); Dave's `DaveVault` (6551 vault whose immutability is treated as the first critical finding:
"the vault you deploy at genesis is the vault, forever").

### 1.9 Signatures: ERC-1271, ERC-7739, ERC-6492, ERC-7913

- **ERC-7739** (Draft, 2024-05-28; authors vectorized, frangio, Amxx, …): an ERC-1271 signature over
  app hash `h` is replayable across every account that shares a signer unless the account address is in
  the signed payload; 7739 rehashes as `TypedDataSign{contents, name, version, chainId,
  verifyingContract, salt}` under the **app's** domain so the wallet still shows the original struct.
  Wire format: `sig ‖ APP_DOMAIN_SEPARATOR ‖ contentsHash ‖ contentsDescription ‖
  uint16(len)`; `PersonalSign` fallback; support probe `isValidSignature(0x7739…7739, "") →
  0x77390001`; on-chain sanitization of `contentsName` blocks a phishing vector; an account using 7739
  cannot itself be a 7739 signer of another (no nesting). Shipped in OpenZeppelin 5.x
  (`draft-ERC7739.sol`), Solady, Nexus, Calibur, Smart Sessions. **This matters acutely for a project
  that mints thousands of accounts owned by overlapping EOAs** (Permit2 is the canonical victim).
  ERC-7803 proposes `signingDomains`/`authMethods` as the long-run wallet-side fix.
- **ERC-6492**: counterfactual signatures `abi.encode(factory, factoryCalldata, sig) ‖ 0x6492…6492`;
  verifier order MUST be 6492 → 1271 → ecrecover, never ecrecover first. Relevant because our accounts are
  counterfactual until mint.
- **ERC-7913** (Final, 2025-03-21): `verify(bytes key, bytes32 hash, bytes sig) → 0x024ad318`; a
  signer is `verifier(20) ‖ key(…)`; empty key ⇒ ERC-1271/ecrecover. This is the clean way to let a
  P-256 passkey, an RSA key or an email proof own an NFT's wallet without deploying a contract per key.

### 1.10 Passkeys and the P-256 precompile

- **RIP-7212** (Final): precompile at `0x100`, 160-byte input `hash ‖ r ‖ s ‖ x ‖ y`, returns 32-byte 1
  or empty, **3,450 gas**. **EIP-7951** (Final; in **Fusaka, mainnet 2025-12-03 21:49:11 UTC, epoch
  411392**, EIP-7607 meta): same address and I/O, **6,900 gas**, adds the point-at-infinity check and
  the correct `r' ≡ r (mod n)` comparison; ethereum.org states EIP-7951 supersedes RIP-7212. Signature
  malleability is *not* rejected by the precompile — applications must handle low-s themselves.
- Chains with a native P-256 precompile (ZeroDev list): Ethereum, OP Mainnet, Base, Arbitrum One/Nova,
  Polygon, zkSync Era, Linea, Scroll, Unichain, BNB, Monad, Avalanche, Celo, Mantle, Ink, Abstract,
  Katana, and most Sepolia/Amoy testnets. Solidity fallbacks: daimo `p256-verifier` at
  `0xc2b78104907F722DABAc4C69f826a522B2754De4` (Veridise audits Oct/Nov 2023, "200,000-400,000 gas")
  and FreshCryptoLib. Coinbase Smart Wallet (factory v1.1 `0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842`
  on 248 chains) stores owners as `bytes` (20-byte address or 64-byte `x‖y`), verifies with
  `WebAuthn.verify(challenge, requireUV=false, auth, x, y)`, and has a `REPLAYABLE_NONCE_KEY = 8453`
  path (`executeWithoutChainIdValidation`) restricted to owner-management selectors for cross-chain
  key sync — a pattern worth copying for a five-chain edition. Safe's passkey module packs
  `precompile(2 bytes) ‖ fallback(20 bytes)` into a `uint176` so the same signer upgrades to the
  precompile automatically; ZeroDev's validator does the same.

### 1.11 Batching: ERC-7821 and ERC-5792

ERC-7821 (Draft, 2024-11-21; Vectorized, jxom, Amxx): `execute(bytes32 mode, bytes executionData)` and
`supportsExecutionMode(bytes32)` only; modes `0x01000000000000000000…` (batch, no opData),
`0x01000000000078210001…` (batch with opData for signature/paymaster data), optional
`0x01000000000078210002…` (batch of batches); `Call{to, value, data}` with `to == address(0)` meaning
self; with empty opData the implementation SHOULD require `msg.sender == address(this)`. Alchemy added
it to MAv2 (+960 bytes), Calibur implements it natively. ERC-5792 `wallet_sendCalls` (v2.0.0,
`atomicRequired`, `capabilities.paymasterService`, `wallet_getCapabilities → atomic: supported |
ready | unsupported`, `wallet_getCallsStatus`) is the dapp-side API; MetaMask implements it on nine
mainnets plus testnets.

---

## 2. Security lessons that bear on an NFT-owned wallet

### 2.1 Module hosts keep failing at the install path
- Safe7579 (Ackee, June 2024): **C1 — a counterfactual ERC-4337 address could be stolen** by
  front-running the launchpad; H1 `initializeAccount` front-run; H2 executors unusable because the
  registry modifier used the wrong context; M4 hook overwrite; W3 hooks can block uninstall.
- Biconomy Nexus (Pashov, March 2025): **M-01 hook bypass** when a module is installed in "enable
  mode" inside `validateUserOp` (the hook sees `msg.sender = EntryPoint` and the `validateUserOp`
  selector); **M-02 users can uninstall every validator** and lock themselves out; L-10 the
  transient-storage `withHook` flag lets a second `executeFromExecutor` in the same transaction skip the
  hook; L-04 `validateUserOp` skipped the ERC-7484 registry check.
- Alchemy MAv2 (Quantstamp): an EOA acting as a module under 7702 could make hook calls succeed
  without verification; only `SemiModularAccount7702` is a safe delegate.
- ERC-7579's own security section lists reentrancy from `onInstall`, malicious `onUninstall` reverts,
  fallback-handler auth, hook DoS, and self-call nesting bypassing stricter config auth.
Lesson: **if the account is immutable and its authority surface is finite, do not host arbitrary modules.** Bake the validators and hooks in; if extension is wanted, allow only implementations whose code hash is attested in an ERC-7484 registry *and* approved by the holder with a delay.

### 2.2 Delegations are only as safe as their caveats
Diligence found MetaMask's own "streaming" enforcer let the delegate call any target with any calldata
because only `value` was checked. Every grant must bind **target, selector, calldata shape, amount,
time window and redeemer**; the Smart Sessions default (no permissions ⇒ sudo) and the ERC-7715
`isAdjustmentAllowed=false` footgun show that defaults must be deny.

### 2.3 EIP-7702 interacts badly with token-bound accounts
- A TBA cannot be a 7702 delegate target: `token()` is read from the account's own bytecode footer,
  and a 7702 account's code is the 23-byte indicator, so `token()` would be empty and `owner()` zero.
  (Inference from the two specs; no implementation attempts found.)
- The *holder* may be a 7702-delegated EOA. `ownerOf` still returns the EOA, but `owner.code.length !=
  0`; any logic that treats code-bearing owners as contracts (ERC-1271-only, no ecrecover) or treats
  `tx.origin == msg.sender` as "human" is now wrong. Verify owner signatures in ERC-6492 order (1271
  first, then ecrecover) and never special-case `code.length`.
- Majority-malicious delegation space (>63% by count, >97% at peak) and `chain_id = 0` cross-chain
  replay mean the website should **detect and display** a holder's delegation indicator and warn when
  it is not a known wallet implementation.

### 2.4 The front end is the attack surface (Bybit, 2025-02-21)
Lazarus injected JavaScript into Safe{Wallet}'s AWS S3/CloudFront bundle on 2025-02-19 (removed two
minutes after the theft), targeted only Bybit's Safe, and turned a routine cold-to-warm transfer into an
`execTransaction` with `operation = 1 (delegatecall)` to `0x96221423681A6d52E184D440a8eFCEbB105C7242`,
which overwrote storage slot 0 (`masterCopy`) with `0xbDd077f651EBe7f7b3cE16fe5F2b025BE2969516`; loss
**401,347 ETH, ~$1.4-1.5B** (Sygnia, NCC Group, CertiK). NCC's conclusions: a purpose-built contract
without arbitrary delegatecall would have made the signature human-readable; EIP-712 cannot render
nested calldata; JavaScript pinning would have blocked a JS-only tamper. **A website that is contract
bytecode, has no delegatecall, and decodes calldata on chain is precisely the mitigation**, which is the
design IPSEITY already argues for (`web3://`, Desks with on-chain `_sel`, no delegatecall in the
Reach).

### 2.5 Ownership cycles and sale-time fraud (ERC-6551)
Both are in the spec's security section and both are already handled locally (IPSEITY
`OwnershipCycle()`; Pixel-Garden refuses transfers into predicted Reach/Grip addresses; ANIMA's
`_update` epoch-rolls operators and forces `Paused`; IPSEITY's manifests give buyers a measured
inventory). Keep them; expose `state()` so marketplaces can pin orders to it.

---

## 3. Recommendations for our protocol

Priority key: **must** / **should** / **could** / **avoid**.

1. **Must — keep ERC-6551 as the identity-to-account derivation**, canonical registry only, one Reach
   (active) and one Grip (receive-only) per token, created in the mint hook and verified by exact
   runtime hash (Pixel-Garden `AccountBinding`). Rationale: it is the only standard whose address is a
   pure function of `(impl, salt, chainId, token, id)`, so "the swap/vault/launchpad live *in* the NFT"
   is literally true and checkable off-chain with `account()`. Expose `state()` that increments on every
   state change so marketplaces can implement the spec's order-pinning mitigation.
2. **Must — bind every authority to the custody epoch.** Sessions, seals, approvals and ERC-1271
   validity carry `epoch` and die on transfer (IPSEITY `SoldOn`, Pixel-Garden `authorized(epoch)`,
   ANIMA `approvalEpoch`). This is our answer to the OneKey "approval carry-over" risk and the
   ERC-6551 fraud section, and it is stronger than any marketplace-side check.
3. **Must — ERC-7739 for all ERC-1271.** Thousands of accounts share signers; without nested typed
   data a Permit2 signature for one token's Reach is valid for every Reach the same EOA owns. Implement
   the `TypedDataSign`/`PersonalSign` workflows, the `0x77390001` probe, and `contentsName`
   sanitization (OpenZeppelin `draft-ERC7739.sol` or Solady). Skip rehashing only when the hash already
   contains the account address (spec allowance).
4. **Must — verify holder signatures in ERC-6492 order** (6492 wrapper → ERC-1271 → ecrecover) and
   never infer "contract owner" from `code.length`, because 7702 EOAs have code. Reject
   `chain_id`-less constructs in our own typed data; every digest includes chainId, account and epoch.
5. **Should — adopt the ERC-7579/ERC-7821 execution shape** (`execute(bytes32 mode, bytes data)`,
   `supportsExecutionMode`, `accountId()`), supporting only CallType `0x00`/`0x01` and ExecType `0x00`,
   while keeping `IERC6551Executable.execute(to,value,data,operation)` with `operation == 0` only. This
   gives wallets and SDKs (MetaMask `wallet_sendCalls`, viem, Rhinestone SDK) a known calling
   convention at near-zero cost. Return `false` for `0xff` delegatecall and for module types in
   `supportsModule` — advertise explicitly that we are not a module host.
6. **Should — ERC-4337 as an optional path on EntryPoint v0.9** (`0x433709009B8330FDa32311DF1C2AFA402eD8D009`),
   immutable per implementation as ANIMA does, so holders can get sponsored gas and passkey UX through
   any bundler; validate against ERC-7562 storage rules (touch only own storage) and use the EIP-712
   userOp hash introduced in v0.8. Do not assume `initCode ⇒ first op` (v0.9 ignores it when deployed).
7. **Should — make session grants ERC-7715/ERC-7710-shaped.** Keep the native `grantSession`, but
   store grants as `{type, data, rules, expiry, redeemer}` using the 7715 vocabulary
   (`erc20-token-periodic`, `native-token-periodic`, `…-stream`, `…-allowance`, `contract-call` with
   target/selector/calldata caveats) and expose a `redeemDelegations(bytes[] ctx, bytes32[] modes,
   bytes[] calls)` entry that enforces them. This lets MetaMask-style agents and ANIMA's AI agents
   request permission from the NFT with the same JSON a user already recognises, and lets us reuse the
   audited caveat semantics (AllowedTargets/AllowedMethods/ExactCalldata/PeriodTransfer/Timestamp/
   LimitedCalls/Redeemer). Defaults must be deny: a grant with no action list is invalid (the opposite
   of Smart Sessions' default).
8. **Should — passkey co-signers via ERC-7913.** Store additional signers as `verifier ‖ key`; ship a
   P-256 verifier that calls `0x100` and falls back to the daimo verifier where the precompile is
   absent (Safe's packed `uint176` pattern). The website then works from a phone with Face ID and no
   extension; on L1 this costs 6,900 gas per verification after Fusaka. Restrict passkeys to
   session-scope by default; the holder's NFT remains the root of authority.
9. **Should — cross-chain key sync in the five-band edition** using the Coinbase pattern: a reserved
   nonce key whose userOps omit chainId and may only call signer-management selectors. Never allow
   chain-agnostic *spending*.
10. **Could — ERC-7656 for per-token satellites.** Derive Pool, Vault and Launch slots as
    token-linked services (`mode = LINKED_ID`) from the canonical 7656 factory rather than mappings in a
    hub; counterfactual addresses let a buyer verify "what this NFT contains" before purchase, and the
    183-byte proxy keeps each satellite's footer self-describing.
11. **Could — ERC-7484 attested extension slot.** If the judge panel wants any post-genesis
    extensibility, the only safe form is: holder opts in to an implementation whose code hash carries
    ≥N attestations from attesters fixed at construction, after a timelock, with no delegatecall. Dave's
    "no upgrade path" finding is the reason to decide this before the first mint.
12. **Avoid — making any TBA an EIP-7702 delegate**, hosting arbitrary ERC-7579/6900 modules,
    delegatecall in any execution path, `chain_id = 0` authorizations, approvals that outlive the epoch,
    and any "install during validation" (enable-mode) path.
13. **Avoid — depending on ERC-7715 wallet support for core UX**: only MetaMask ships it (v13.23+),
    and only for its own smart accounts. Treat 7715 as the *shape* of our on-chain grants, not as a
    required wallet RPC.

---

## 4. What the leading projects do, in one table

| Project | Account base | Signers | Sessions/permissions | Batch | Notes |
|---|---|---|---|---|---|
| Tokenbound AccountV3 (v0.3.1) | ERC-6551 + ERC-1967 | holder, permissioned callers | lock-until, `Permissioned` | `BatchExecutor` | 4337 on EntryPoint v0.6; Guardian-governed upgrades |
| Coinbase Smart Wallet v1.1 | ERC-4337 (v0.6) UUPS | address or P-256 `x‖y` owners | none native | `executeBatch` | 4.1M accounts; replayable owner updates; WebAuthn.sol |
| ZeroDev Kernel v3 | ERC-7579 (+policy/signer types) | any validator | permission validators (policies) | 7579 modes | 5.8M accounts; ROOT validation bypasses hooks by design |
| Biconomy/Rhinestone Nexus | ERC-7579, 7739, 7484 | any validator | Smart Sessions | 7579 modes | 5 audits; enable-mode hook bypass fixed 2025 |
| Safe + Safe7579 | Safe modules + 7579 adapter | multisig, passkey module | Smart Sessions | Safe batch | Bybit UI compromise; adapter audit C1 |
| Alchemy MAv2 | ERC-6900 v0.8 | single-signer, WebAuthn, modules | session keys with allowlists/limits | `executeBatch`, 7821 | 97,764 gas creation; 13.7M accounts; SMA7702 |
| MetaMask Smart Accounts | 7702 stateless / Hybrid / MultiSig DeleGator | EOA, P-256 (Hybrid) | ERC-7715 → ERC-7710 with caveat enforcers | ERC-5792 | DelegationManager `0xdb9B…7dB3`; Diligence/Cyfrin audits 2025 |
| Uniswap Calibur | 7702 delegate | keys with settings/hooks | per-key hooks | ERC-7821 | 7739, 4337, 7201, 7914 |

---

## 5. Special ideas — things that would make our NFT stand out

1. **The account tells you what it will refuse before you ask.** Publish a machine-readable
   authority surface from the token itself (`supportsExecutionMode`, `supportsModule → false`,
   `accountId()`, the 7715 `wallet_getSupportedExecutionPermissions` equivalent as a view), so any
   wallet or agent can introspect the NFT's wallet without our site.
2. **Permissions as inventory.** Treat granted sessions like assets: list them in the on-chain
   website's inventory with their caveats and remaining budget, and include their hash in `state()` so
   a buyer sees "0 open permissions" at sale time. No wallet shows this today.
3. **Passkey mint.** Let a first-time user mint from a phone: the mint call registers a 7913 P-256
   signer on the Reach in the same transaction (6,900 gas on L1), so the NFT is usable before the user
   ever installs a browser extension.
4. **Clear-signing from chain.** Because the site is bytecode, ship an on-chain calldata decoder for
   every Desk selector and render "you are about to: swap 1.0 ETH → ≥ 2,400 USDC via this token's
   pool, slippage 0.5%" from the same contract that executes it — the Bybit mitigation nobody has as a
   product.
5. **7702 hygiene for holders.** On connect, read `holder.code`; if it starts `0xef0100`, display the
   delegate, compare its code hash to a built-in list of known wallet implementations (MetaMask
   `0x63c0…`, Simple7702Account, SMA7702, Calibur), and refuse to show spend buttons behind an unknown
   delegate until acknowledged.
6. **One signature, five chains, zero replay.** Use the reserved-nonce-key replayable path only for
   signer management, and prove in a test that a spending signature from one band is invalid on every
   other band.
7. **Dead-man succession as a standard delayed executor.** Succession already exists; expressing it as
   the OpenZeppelin `ERC7579DelayedExecutor` shape (schedule → delay → cancel window) makes it
   recognisable to auditors and tooling without becoming a module host.
8. **Agent-grade grants.** ANIMA's agents can be given 7715-shaped `erc20-token-periodic` budgets
   against the Reach, redeemable by an EOA or a 4337 session account, with `LimitedCalls` and
   `Redeemer` caveats — the same request format a human sees in MetaMask, so the agent's permissions are
   legible to the human who granted them.
9. **Counterfactual everything.** Pool, vault, launch slot and both accounts have addresses before
   mint (6551/7656 `compute`), so the website can render a token's future contents, and a 6492 wrapper
   lets the not-yet-minted account sign a listing.

---

## 6. Open questions

1. ERC-6551 is still *Review* and ERC-7579/6900/7710/7715/7739/7821 are *Draft*: which breaking changes
   are plausible before Final, and do we pin to the EIP text at a commit?
2. Should the Reach implement `validateUserOp` at all, given no bundler is needed for holder-signed
   transactions and 4337 widens the storage-rule and simulation surface? (ANIMA says yes with an
   immutable EntryPoint; IPSEITY says no.)
3. How much of the ERC-7715 vocabulary to support on chain at genesis, given immutability: the six
   MetaMask types plus `contract-call`, or a generic caveat-enforcer interface?
4. ERC-7739 cannot be nested: if the holder of our NFT is itself a 7739 smart account, our account's
   7739 rehash cannot be signed through it. Do we accept ERC-7803 `signingDomains` as the forward path
   and provide a raw-hash escape for contract holders?
5. Passkeys and `requireUV`: do we require user verification (biometric) for spend and allow
   presence-only for reads, and how do we expose that in the on-chain site?
6. Tokenbound's audit reports and the real count of TBAs in existence were not retrievable here; both
   should be verified before citing them externally.
7. EntryPoint v0.9's EOA-only `handleOps` means a 4337 flow can never be initiated from inside another
   contract (e.g. a launchpad that wants to submit ops on users' behalf); is that a constraint for the
   launchpad design?
8. Which chains in the five-band edition lack the P-256 precompile, and is the ~300k-gas fallback
   acceptable there, or should passkeys be L2-only?
9. Fusaka-era proposals for scoped 7702 delegations were mentioned by secondary sources but could not be
   verified against an EIP text; do not plan around them.

---

## Sources (primary first)

- https://eips.ethereum.org/EIPS/eip-6551 · https://github.com/erc6551/reference · https://deploy.tokenbound.org/ · https://docs.tokenbound.org/contracts/deployments
- https://eips.ethereum.org/EIPS/eip-7656 · https://eips.ethereum.org/EIPS/eip-7913 · https://eips.ethereum.org/EIPS/eip-7739 · https://eips.ethereum.org/EIPS/eip-6492
- https://eips.ethereum.org/EIPS/eip-4337 · https://github.com/eth-infinitism/account-abstraction/releases · https://erc4337.substack.com/p/entrypoint-v08-released · https://erc4337.substack.com/p/improving-useroperation-execution · https://docs.candide.dev/blog/entrypoint-v09-support/ · https://www.bundlebear.com/erc4337-overview/all · https://www.bundlebear.com/erc4337-factories/all
- https://eips.ethereum.org/EIPS/eip-7702 · https://github.com/ethereum/execution-specs/blob/master/docs/specs/protocol_history.md · https://www.bundlebear.com/eip7702-overview/all · https://dune.com/wintermute_research/eip7702 · https://www.coindesk.com/tech/2025/06/02/… · https://protos.com/48-of-ethereum-eip-7702-uses-linked-to-crime-says-wintermute/ · https://www.usenix.org/system/files/conference/usenixsecurity26/sec26_prepub_huang-mingyuan.pdf · https://arxiv.org/html/2512.12174 · https://onchainattack.org/document/examples/2025-05-eip7702-crimeenjoyor-delegation-phishing-cohort/
- https://eips.ethereum.org/EIPS/eip-7579 · https://eips.ethereum.org/EIPS/eip-7484 · https://github.com/rhinestonewtf/registry · https://github.com/zerodevapp/kernel/blob/dev/src/Kernel.sol · https://github.com/bcnmy/nexus · https://github.com/pashov/audits/blob/master/team/md/BiconomyNexus-security-review_2025-03-21.md · https://ackee.xyz/blog/rhinestone-erc-7579-safe-adapter-audit-summary/ · https://rhinestone.ghost.io/introducing-safe7579-cf390b630d28/
- https://eips.ethereum.org/EIPS/eip-6900 · https://www.alchemy.com/docs/wallets/smart-contracts/modular-account-v2/overview · https://github.com/alchemyplatform/modular-account/ · https://derekchiang.com/who-when-what/ · https://mirror.xyz/probablynoam.eth/ZM8k-YoVbC-ih13zPMPZ5q4iZ7wEHuWEcRbQNrRiURU
- https://eips.ethereum.org/EIPS/eip-7710 · https://eips.ethereum.org/EIPS/eip-7715 · https://docs.metamask.io/smart-accounts-kit/get-started/supported-advanced-permissions/ · https://github.com/MetaMask/delegation-framework/releases/tag/v1.3.0 · https://diligence.security/audits/2025/02/metamask-delegation-framework-february-2025/ · https://peglerweb.services/blog/eip-7702-dapp-interoperability/
- https://github.com/erc7579/smartsessions · https://docs.rhinestone.dev/smart-wallet/smart-sessions/overview
- https://eips.ethereum.org/EIPS/eip-7821 · https://github.com/ethereum/EIPs/blob/master/EIPS/eip-5792.md · https://docs.metamask.io/metamask-connect/evm/guides/send-transactions/batch-transactions/ · https://github.com/Uniswap/calibur/blob/main/ARCHITECTURE.md
- https://github.com/ethereum/RIPs/blob/master/RIPS/rip-7212.md · https://eips.ethereum.org/EIPS/eip-7951 · https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement · https://eips.ethereum.org/EIPS/eip-7607 · https://docs.zerodev.app/onboarding/passkeys/overview · https://github.com/daimo-eth/p256-verifier · https://github.com/coinbase/smart-wallet/ · https://docs.safe.global/advanced/passkeys/passkeys-safe
- https://smartcontractsecurity.eu/Bybit%20Interim%20Investigation%20Report.pdf · https://www.nccgroup.com/research/in-depth-technical-analysis-of-the-bybit-hack/ · https://www.certik.com/blog/bybit-incident-technical-analysis
- Local: `Most-Advanced-NFT-Possible/src/IpseityAccount.sol`, `GripVault.sol`, `AGENT.md`; `Cutting-edge-technologically-advanced-NFT/contracts/account/AgentAccount.sol`; `Pixel-Garden/docs/ACCOUNT-FOUNDATION.md`, `src/accounts/ReachAccount.sol`; `MASTER-NFT-PROJECT/integrations/dave/DAVE-V2-ARCHITECTURE.md`.
