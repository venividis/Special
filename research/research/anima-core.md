# ANIMA — core token, diamond build, interfaces, libraries, web renderer

Repository: `/home/user/Cutting-edge-technologically-advanced-NFT` (venividis/Cutting-edge-technologically-advanced-NFT, default branch `main`, HEAD `e345828`).
Area covered: `contracts/core/AnimaAgent.sol`, `contracts/core/EncryptionKeyRegistry.sol`, `contracts/core/verifiers/`, `contracts/diamond/*`, `contracts/interfaces/*`, `contracts/libraries/*`, `contracts/web/AnimaWeb3Renderer.sol`, plus the tests, SDK helper, deploy script, docs and deployment records that bear on them.

Every file in the area was read in full. Line numbers below refer to the files as checked out at `main`. Nothing in the repository was modified; no build or test was run. Byte sizes were measured from the compiled artifacts already present in `artifacts/` (solc 0.8.28, viaIR, optimizer runs 200, evmVersion cancun — `hardhat.config.ts:16-24`).

---

## 0. Executive summary for the design team

ANIMA is an "agent-native" ERC-721: one token is one AI agent with an identity, an ERC-6551 wallet, encrypted private state ("brain"), a declared model, a published autonomy policy and (in sibling modules) a slashable bond. The token exists as two provably equivalent builds: a 23,971-byte monolith (`AnimaAgent`) sitting 605 bytes under EIP-170, and an **immutable EIP-2535 diamond** with the cut welded shut (no `diamondCut`, no admin over the routing table). The same 279-test suite runs unmodified against both via `ANIMA_IMPL=diamond`.

Relative to the unified GOAL (one on-chain NFT that mints a website with a swap, messaging/social layer, launchpad and vault, no server/IPFS):

- **The strongest reusable asset is the immutable-diamond infrastructure**: `AnimaDiamond` (177 bytes of runtime code), `DiamondStorage`, `IDiamond`/`IDiamondLoupe`, `AnimaLoupeFacet`, the SDK's `deriveFacetCut` (derives the cut from the monolith ABI and refuses partial cuts), and `scripts/deploy-diamond.ts` (verifies the deployed diamond on-chain before returning). This is exactly the mechanism that lets swap + messaging + launchpad + vault + renderer live behind one NFT address without an EIP-170 ceiling and without an upgrade key. **Reuse verbatim.**
- **The token's security invariants are worth porting as a pattern**: the sealed `_update` hook ("selling revokes all authority"), epoch-keyed operators and approvals (O(1) revoke-all, time-boxed `setApprovalForAllUntil`), counted locks/disputes enforced in the transfer path, guardian-can-only-pause, ERC-5646 state fingerprint. **Adapt.**
- **`EncryptionKeyRegistry`** is a chain-wide "publish your encryption public key once" singleton — precisely the primitive an on-chain encrypted messaging layer needs. **Reuse verbatim.**
- **`ERC6492` and `ExactERC20`** are small, correct, battle-tested-in-review libraries a swap/launchpad/vault will need. **Reuse verbatim.**
- **The web UI is NOT minted by the NFT.** `tokenURI` returns an opaque stored string (`_agentURI`). The on-chain UI is a *separate* contract, `AnimaWeb3Renderer` (ERC-4804 manual mode), reached via `web3://<renderer>:84532/token/{id}/live` or the hosted `w3link.io` gateway, and it imports `viem` from the `esm.sh` CDN at runtime — a server dependency. A branch (`codex/submit-blockchain-deployment-using-sepolia-key-koorbx`) rewrote the client with hand-rolled selectors and raw JSON-RPC (no CDN) but was never merged. There is also an off-chain GitHub Pages "Sanctuary" (Vite + viem). **Rewrite** the renderer; keep the ERC-4804 shape.
- **Ownership verification for access is purely informational.** Neither UI gates viewing; the renderer shows `ownerOf`, the Sanctuary enumerates `totalMinted` × `ownerOf` client-side to list "your" agents. All real authorisation is on-chain per function (`_requireOwnerOf`, `_requireController`, `onlyModule`, guardian check). No signature challenge, no SIWE.

---

## 1. `contracts/interfaces/IAnima.sol` — the normative types and the interface (322 lines)

### Purpose
Defines every type, event, error and function of the standard. `AgentCore` and `Lease` are declared here (not in an implementation) so both builds share a byte-for-byte layout: `getStateFingerprint` ABI-encodes `AgentCore` wholesale.

### Types (with line refs)
- `enum AgentStatus { Inactive, Active, Paused, Disputed, Retired }` (12-18). Comment: "Status gates *what the agent may do*, not who owns it — ownership is always plain ERC-721 so agents stay liquid on any marketplace."
- `enum SealPolicy { None, Committed, ReKeyed, SealedTEE, SealedZK, Threshold }` (27-36). Load-bearing rationale (20-26): "Every 'encrypted NFT' design has the same irreducible flaw — a previous owner who has already decrypted the plaintext can keep a copy forever — and most standards paper over it. ANIMA instead makes the *guarantee level* a first-class, machine-readable field so a buyer prices the residual risk rather than being misled about it."
- `struct BrainShard { bytes32 dataHash; bytes32 keyCommitment; uint64 size; uint8 kind; string uri; string description; }` (41-48). "Modelled on ERC-7857's `IntelligentData` but extended with the fields a real deployment needs: where the bytes actually live, and how big they are."
- `library ShardKind` constants WEIGHTS=0, MEMORY=1, SYSTEM_PROMPT=2, TOOLS=3, KEYS=4, DATASET=5, CHECKPOINT=6; values >200 reserved (51-59).
- `struct ModelIdentity { bytes32 weightsRoot; bytes32 runtimeMeasurement; uint8 attestationKind; string modelId; }` (62-67); `library AttestationKind` NONE=0, SIGNED=1, TEE=2, ZK=3, OPTIMISTIC=4 (69-75).
- `struct AutonomyPolicy { uint128 perTxWei; uint128 dailyWei; uint64 expiry; bool allowDelegateCall; bool allowUnlistedTargets; bytes32 targetsRoot; }` (81-88). "An agent that cannot prove its own leash is not safe to transact with."
- **`struct AgentCore`** (96-108), packed into four slots — **normative, append-only**:
  ```
  slot 0  bytes32 manifestHash
  slot 1  bytes32 brainRoot
  slot 2  address guardian(20) | AgentStatus status(1) | SealPolicy seal(1) | uint32 version(4) | uint32 lockCount(4) | uint16 disputeCount(2) = 32/32
  slot 3  uint64 brainEpoch | uint64 createdAt | uint64 operatorEpoch = 24/32
  ```
  Comment (93-95): "a field reordered in one implementation and not another would silently produce two different fingerprints for the same agent."
- `struct Lease { address user; uint64 expires; }` (111-114).

### `interface IAnimaEvents` (131-174)
Events: `ManifestUpdated(uint256 indexed agentId, bytes32 manifestHash, uint32 version, string agentURI)`, `ModelDeclared(uint256 indexed, bytes32 weightsRoot, uint8 attestationKind, string modelId)`, `BrainUpdated(uint256 indexed, uint64 brainEpoch, bytes32 brainRoot, SealPolicy seal)`, `SealedKeysPublished(uint256 indexed, address indexed recipient, uint64 brainEpoch, bytes[] sealedKeys)`, `PolicyUpdated(uint256 indexed, AutonomyPolicy policy)`, `StatusChanged(uint256 indexed, AgentStatus previous, AgentStatus current)`, `WalletBound`, `GuardianSet`, `OperatorSet(uint256 indexed, address indexed operator, bool allowed)`.
Errors: `NotAgentController(uint256,address)`, `AgentLocked(uint256)`, `AgentNotActive(uint256,AgentStatus)`, `InvalidStatusTransition(AgentStatus,AgentStatus)`, `BrainEpochMismatch(uint64 expected,uint64 actual)`, `SealPolicyNotUpgradable(SealPolicy,SealPolicy)`, `NoEncryptionKey(address)`, `UnknownAgent(uint256)`, `ZeroAddress()`, `SignatureExpired(uint256)`, `InvalidSignature()`.
Why split from `IAnima` (125-129): "A facet holds one slice of the token's behaviour, so it cannot inherit {IAnima} — that would oblige it to implement functions living in a sibling facet."

### `interface IAnima is IAnimaEvents` (197-322) — full signatures
```solidity
function mintAgent(address to, string calldata agentURI, bytes32 manifestHash, ModelIdentity calldata model, BrainShard[] calldata shards, SealPolicy seal, MetadataEntry[] calldata metadata) external returns (uint256 agentId);
function setManifest(uint256 agentId, string calldata agentURI, bytes32 manifestHash) external;
function manifestOf(uint256 agentId) external view returns (string memory agentURI, bytes32 manifestHash, uint32 version);
function verifyManifest(uint256 agentId, bytes calldata manifest) external view returns (bool);
function declareModel(uint256 agentId, ModelIdentity calldata model) external;
function modelOf(uint256 agentId) external view returns (ModelIdentity memory);
function brainOf(uint256 agentId) external view returns (BrainShard[] memory);
function brainRoot(uint256 agentId) external view returns (bytes32);
function brainEpoch(uint256 agentId) external view returns (uint64);
function sealPolicyOf(uint256 agentId) external view returns (SealPolicy);
function downgradeSealPolicy(uint256 agentId, SealPolicy seal) external;
function updateBrain(uint256 agentId, BrainShard[] calldata shards, uint64 expectedEpoch) external;
function transferWithBrain(address from, address to, uint256 agentId, BrainShard[] calldata newShards, bytes[] calldata sealedKeys, bytes calldata proof) external;
function keyRegistry() external view returns (address);
function accountOf(uint256 agentId) external view returns (address);
function deployAccount(uint256 agentId) external returns (address);
function policyOf(uint256 agentId) external view returns (AutonomyPolicy memory);
function setPolicy(uint256 agentId, AutonomyPolicy calldata policy) external;
function isOperator(uint256 agentId, address operator) external view returns (bool);
function setOperator(uint256 agentId, address operator, bool allowed) external;
function isController(uint256 agentId, address account) external view returns (bool);
function statusOf(uint256 agentId) external view returns (AgentStatus);
function setStatus(uint256 agentId, AgentStatus status) external;
function guardianOf(uint256 agentId) external view returns (address);
function setGuardian(uint256 agentId, address guardian) external;
function guardianPause(uint256 agentId) external;
```
Design statements worth quoting: `setManifest` — "They are set in one call by construction: a URI without a matching hash is exactly the hole that lets an agent show you one card and serve another." `sealPolicyOf` — "At mint this is the issuer's *claim*. After any `transferWithBrain` it is overwritten with what the configured verifier actually certified, so the field converges on the truth as the agent changes hands." `keyRegistry` — "A buyer of a sealed agent must have published a key there before the transfer can be proven, which is what stops the common failure where an 'encrypted' NFT is sold to someone who can never decrypt it." `isOperator` — "operators are the agent's staff, the ERC-4907 user is its tenant." `guardianOf` — "A kill switch that can also steal is not a safety feature."

Standards named in the header (185-190): ERC-721/165/2981/4906, ERC-8004, ERC-6551, ERC-7857 (adapted), ERC-4907, ERC-5192.

**Reuse verdict: adapt.** The `AgentStatus`/lock/guardian/operator/approval vocabulary and the "normative struct layout for a fingerprint" idea transfer directly. The AI-specific pieces (`ModelIdentity`, `BrainShard`, `SealPolicy`, `AutonomyPolicy`) are optional for the unified NFT; keep them only if the product keeps "agent" identity. If kept, the `AgentCore` layout must be preserved field-for-field or the fingerprint domain changes.

---

## 2. `contracts/core/AnimaAgent.sol` — the monolith (926 lines; **23,971 B runtime / 26,744 B initcode; 83 ABI functions**)

### Inheritance (58-71)
`IAnima, IIdentityRegistry, IERC4907, IERC5192, IERC6454, IERC7572, IERC4906, ERC721, ERC2981, EIP712("AnimaAgent","1"), Ownable2Step, ReentrancyGuardTransient` — OpenZeppelin 5.6.1 (`package.json`). Transient reentrancy guard requires Cancun.

### Security posture (header 42-57), verbatim
1. "**Selling an agent revokes its autonomy.** On transfer the operator set is epoch-rolled, the lease is cleared, the guardian is cleared, the autonomy policy is zeroed, the bound wallet is reset and status drops to `Paused`. The alternative — an agent that keeps executing its previous owner's policy on behalf of its new owner — is how a treasury disappears."
2. "**A locked agent cannot move.**"
3. "**The token bound account is derived, not stored.** Same address before deployment, after deployment, and on every chain, so quoting never races account creation."
4. "**Manifest URI and its hash move together.** A URI set without a commitment records `bytes32(0)`, i.e. 'uncommitted' — never a stale hash."
Also: "intentionally *not* upgradeable — an agent standard whose rules a proxy admin can rewrite is not a standard, it is a promise. The things that legitimately need to evolve (the re-key verifier, the module allowlist, royalties) are swappable pointers under two-step ownership instead." (37-40)

### Storage layout (92-127)
Immutables: `IERC6551Registry REGISTRY`, `address ACCOUNT_IMPLEMENTATION`, `bytes32 ACCOUNT_SALT`, `EncryptionKeyRegistry KEY_REGISTRY`.
State (compiler-assigned slots, in declaration order after OZ bases): `ITransferVerifier verifier`; `uint256 _nextAgentId = 1`; `mapping(uint256=>AgentCore) _core`; `mapping(uint256=>BrainShard[]) _shards`; `mapping(uint256=>ModelIdentity) _model`; `mapping(uint256=>AutonomyPolicy) _policy`; `mapping(uint256=>string) _agentURI`; `mapping(uint256=>Lease) _lease`; `mapping(uint256=>address) _boundWallet`; `mapping(uint256=>uint256) _walletNonce`; `mapping(uint256=>mapping(bytes32 keyHash=>bytes)) _metadata`; `mapping(uint256=>mapping(uint64 epoch=>mapping(address=>bool))) _operator` ("Keyed by operator epoch so a sale wipes the previous owner's staff in O(1) instead of leaving dangling authorisations nobody can enumerate", 114-115); `string _contractURI`; `mapping(address=>bool) public isModule`; `mapping(address=>uint64) public approvalEpoch`; `mapping(bytes32 key=>uint64 expiresAt) _operatorExpiry` (key = `keccak256(abi.encode(owner, approvalEpoch[owner], operator))`, 859-861).

### Events and errors declared here (133-143)
`VerifierSet(address indexed verifier, SealPolicy policy)`, `ModuleSet(address indexed module, bool allowed)`, `AgentLockChanged(uint256 indexed agentId, uint32 lockCount)`, `OperatorApprovalTimed(address indexed owner, address indexed operator, uint64 expiresAt)`, `AllApprovalsRevoked(address indexed owner, uint64 epoch)`. Errors: `NotModule(address)`, `NotOwnerOf(uint256,address)`, `EmptyBrain()`, `VerificationFailed()`, `NotGuardian(uint256,address)`. Plus inherited: ERC-8004 `Registered/URIUpdated/MetadataSet`, ERC-4907 `UpdateUser`, ERC-5192 `Locked/Unlocked`, ERC-7572 `ContractURIUpdated`, ERC-4906 `MetadataUpdate`.

### Constructor (149-169)
`(string name_, string symbol_, address owner_, IERC6551Registry registry_, address accountImplementation_, bytes32 accountSalt_, ITransferVerifier verifier_, EncryptionKeyRegistry keyRegistry_, address royaltyReceiver_, uint96 royaltyBps_)`. Reverts `ZeroAddress` on zero registry/impl/keyRegistry; `_setVerifier` reverts on zero verifier; royalty set only if receiver non-zero.

### Access control (175-208)
- `onlyModule` — `isModule[msg.sender]` else `NotModule`.
- `_requireOwnerOf(id)` — `_requireOwned(id) == msg.sender` else `NotOwnerOf`.
- `_requireController(id)` — `isController` else `NotAgentController`.
- `isController(id, account)` (189-195): owner → true; `_lease[id].user == account && expires >= block.timestamp` → true; else `_operator[id][_core[id].operatorEpoch][account]`.
- `setOperator` — owner only; zero operator rejected.

Authority matrix (from code): **owner** — everything on its agent (declareModel, setPolicy, setGuardian, setOperator, setUser, setAgentWallet, downgradeSealPolicy, retire); **controller** (owner|tenant|operator) — setManifest/setAgentURI/setMetadata, updateBrain, setStatus to Inactive/Active/Paused; **guardian** — guardianPause only; **module** — lockAgent/unlockAgent/setDisputed/moduleSetUser; **contract owner (Ownable2Step)** — setVerifier, setModule, setContractURI, setDefaultRoyalty, setTokenRoyalty; **anyone** — mintAgent (to any `to`), register() (to msg.sender), deployAccount (for any existing id), all reads.

### Public API (signatures with line refs)
Mint/register: `mintAgent(...)` 215-226; `register(string,MetadataEntry[])` 229; `register(string)` 235; `register()` 240 — `_registerBare` 247-256 mints to `msg.sender` with empty model, no shards, `SealPolicy.None` ("the shim costs nothing but also promises nothing"). `_mintAgent` 264-298: `agentId = _nextAgentId++`; sets `manifestHash, seal, version=1, createdAt, status=Inactive`; stores URI and model; `_mint`; if shards: `brainRoot = BrainLib.rootOf`, `brainEpoch = 1`, emits `BrainUpdated`; emits `Registered`, `ManifestUpdated(…,1,…)`, `ModelDeclared`.
Manifest/metadata: `setManifest(uint256,string,bytes32) public` 305-316 (controller; `version += 1` unchecked; emits `ManifestUpdated`, `URIUpdated`, `MetadataUpdate`); `setAgentURI(uint256,string)` 323-325 = `setManifest(id, uri, bytes32(0))`; `manifestOf` 328-336 (reverts for nonexistent); `verifyManifest(uint256,bytes) view` 339-342 (`committed != 0 && keccak256(manifest) == committed`); `setMetadata` 345-348 (controller); `getMetadata` 356-358; **`tokenURI(uint256)` 360-363 → `_agentURI[id]` — a plain stored string, nothing generated on-chain.**
Model: `declareModel` 370-375 (owner; emits `ModelDeclared`, `MetadataUpdate`); `modelOf` 378-380; `keyRegistry()` 383-385.
Brain: `brainOf` 392; `brainRoot` 397; `brainEpoch` 402; `sealPolicyOf` 407; `downgradeSealPolicy` 412-418 (owner; `uint8(seal) >= uint8(c.seal)` → `SealPolicyNotUpgradable`); `updateBrain(uint256,BrainShard[],uint64 expectedEpoch)` 421-437 (controller; empty → `EmptyBrain`; epoch pin → `BrainEpochMismatch`: "two operators writing memory at once must not silently clobber each other, which is how an agent quietly forgets what it just learned"); `transferWithBrain` 440-491 (`nonReentrant`; `to != 0`; non-empty shards; `holder == from`; `_isAuthorized(holder, msg.sender, id)`; `KEY_REGISTRY.keyIdOf(to) != 0` else `NoEncryptionKey`; builds `ReKeyRequest` and calls `verifier.verifyReKey(req, proof)` — external call before state change — else `VerificationFailed`; writes shards, `brainEpoch += 1`, **`c.seal = v.sealPolicy()`** ("The seal now reflects what was actually certified, not what was claimed at mint"); emits `BrainUpdated`, `SealedKeysPublished`; `_safeTransfer`). `_writeShards(uint256, BrainShard[] memory)` 496-507 overwrites in place, pushes extras, pops surplus — "Duplicating it per data location is what pushed this contract over the size limit; the one-time calldata copy at the call boundary is the cheaper trade."
Wallet/autonomy: `accountOf(uint256) public view` 514-516 = `REGISTRY.account(ACCOUNT_IMPLEMENTATION, ACCOUNT_SALT, block.chainid, address(this), id)`; `deployAccount` 519-522 (any caller, token must exist); `getAgentWallet` 525-528 (bound wallet or `accountOf`); `setAgentWallet(uint256,address,uint256 deadline,bytes sig)` 534-549 (owner; EIP-712 `AgentWalletBinding(uint256 agentId,address wallet,uint256 nonce,uint256 deadline)` signed **by the wallet** via `SignatureChecker` (ECDSA or ERC-1271); "Without it an agent could name any address as its wallet and inherit that address's standing, which is the cheapest possible impersonation attack on a reputation system"); `unsetAgentWallet` 552-556; `walletNonce` 558; `policyOf` 563; `setPolicy` 568-572 (owner).
Lifecycle: `statusOf` 579; `setStatus(uint256,AgentStatus)` 584-601 — rejects entering `Disputed` or leaving `Disputed`/`Retired` (`InvalidStatusTransition`); `Retired` requires owner **and** `!locked` ("standing an agent down while it owes a tenant or a client work would be a way to keep their money and hand back a corpse"); otherwise controller. `_setStatus` 603-609 no-op if unchanged. `guardianOf` 612; `setGuardian` 617-621 (owner); `guardianPause` 626-633 (guardian only; refused from `Retired`/`Disputed`).
ERC-4907: `setUser` 640-647 (owner; **refused while locked** — "Blocking `setUser` while locked stops an owner from evicting a paying tenant"); `moduleSetUser` 650-653 (module); `userOf` 656-659 (zero when expired); `userExpires` 662-664.
ERC-5192/6454: `locked(uint256)` 673-676 = `lockCount != 0 || disputeCount != 0`; `isTransferable(uint256,address from,address to)` 681-686 (false for nonexistent; true for mint; otherwise `!locked`; `to` ignored — burn gated identically); `lockAgent` 689-696 (module; `_requireOwned`; emits `AgentLockChanged`, and `Locked` on 0→1); `unlockAgent` 699-705 (module; **silently returns at 0**); `setDisputed(uint256,bool)` 711-723 (module; counted — "resolving the first dispute must not hand its spending authority back while the others are still open — that would make the kill switch a matter of timing"; entering sets status `Disputed`; last resolution sets `Paused`).
Transfer hook `_update` 729-755: before: if token exists and locked → `AgentLocked` ("Applies to burns as well"); after `super._update`, for non-mint non-burn: `operatorEpoch += 1`, `guardian = 0`, `delete _policy/_lease/_boundWallet`, emits `UpdateUser(id,0,0)`, `PolicyUpdated(id, zeroed)`, `GuardianSet(id,0)`, `_setStatus(Paused)`. "The buyer must consciously re-arm the agent, having read what it is about to be allowed to do."
ERC-5646: `getStateFingerprint(uint256)` 775-790 = `keccak256(abi.encode(holder, _core[id], _model[id].weightsRoot, _boundWallet[id], _lease[id], _policy[id], accountState))` where `accountState = account.code.length == 0 ? 0 : IERC6551Account(account).state()`; reverts for nonexistent. Rationale 763-774: "an integrator that checks only `state()` is checking the wallet while the agent is swapped out from under them."
Approvals 796-861: header comment 796-812 ("ERC-721's `setApprovalForAll` is unbounded in time, unbounded in scope, and not enumerable on-chain. It is the direct cause of the largest class of user losses in NFTs… Two ecosystems arrived independently at the fix — ICRC-37 puts `expires_at` on every approval and supports batch revocation; CW-721 puts `expires` on both `Approve` and `ApproveAll`… storing a per-owner operator list on-chain would cost more bytecode than this contract has left"). `setApprovalForAll(address,bool)` 817-819 → expiry `type(uint64).max` or 0; `setApprovalForAllUntil(address,uint64)` 823-826 (past expiry → `SignatureExpired`); `revokeAllApprovals()` 832-838 (`++approvalEpoch[msg.sender]`); `isApprovedForAll` 841-844 reads the timed store (ERC-721 `_isAuthorized` depends on this); `approvalExpiryOf(address,address)` 848-850.
Admin: `setVerifier` 867 (owner; zero rejected; emits `VerifierSet(addr, verifier.sealPolicy())`); `setModule` 877; `contractURI` 883; `setContractURI` 887; `setDefaultRoyalty` 903; `setTokenRoyalty` 907; `totalMinted` 911-913. Royalty rationale 892-902: "A declaration, not an entitlement… OpenSea made royalties optional when the Operator Filter sunset (2023-08-31 for new collections, 2024-02-29 for existing), Blur enforces only a 0.5% floor… ANIMA therefore does not fight the secondary-market royalty war. It captures value where it actually controls the chokepoint: escrow settlement fees, launchpad fees, and per-call metering."
ERC-165 919-925: `IAnima`, `IIdentityRegistry`, `0x49064906` (4906), `0xad092b5c` (4907), `0xb45a3c0e` (5192), `0x91a6262f` (6454), `0xe8a3d485` (7572, community-computed), `0xf5112315` (5646), plus ERC721/ERC2981 via super.

### Invariants (docs/SECURITY.md:9-22, each with a test)
1. Operator authorisations do not survive a transfer. 2. A locked agent cannot be transferred or burned (enforced in `_update`, not only reported). 3. Transfer pauses and zeroes policy/guardian/lease/bound wallet. 4. `brainEpoch` strictly increasing; stale `expectedEpoch` reverts. 5. `SealPolicy` only strengthened by a verifier. 6. Sealed transfer requires a published recipient key. 7. Wallet binding requires the wallet's signature. 8. Guardian can only pause.

### Gas and size
- 23,971 B deployed, 605 B under EIP-170 (ARCHITECTURE.md:24; measured identical from `artifacts/`). History: 22,775 B after commit `b120c4a`'s three size fixes (extract `EncryptionKeyRegistry`, unify shard loops on one `memory` implementation, collapse `register()` overloads); approvals port and ERC-5646/6492 additions consumed the rest.
- Measured trap (ARCHITECTURE.md:357-359, BrainLib header): moving `writeShards` into a `public` library made the token **4 KB larger** — "ABI-encoding a dynamic array for a `delegatecall` costs more bytecode than the inline loop it replaced."
- Levers left (ARCHITECTURE.md:342-347): drop CBOR metadata trailer 53 B; optimizer runs 200→1 recovers 376 B; both 429 B.
- Monolith gas (Gas.test.ts table, ARCHITECTURE.md:109-120): `ownerOf` 24,472; `tokenURI` 30,058; `supportsInterface` 21,998; `isApprovedForAll` 28,511; `accountOf` 26,863; `getStateFingerprint` 54,818; `mintAgent` 311,367; `transferFrom` 85,818; `updateBrain` 68,445.

### How it is tested
- `test/AnimaAgent.test.ts` (25 tests): "mints an agent whose id is both the ERC-721 tokenId and the ERC-8004 agentId"; "commits to the manifest so a swapped card is detectable"; "treats a URI set without a hash as uncommitted rather than leaving a stale hash"; "advertises every interface it implements"; "computes a commitment an off-chain indexer can reproduce"; "is order-sensitive, so reordering shards is a real state change"; "rejects a concurrent update against a stale epoch instead of clobbering it"; "truncates when the new shard set is shorter"; "lets an owner weaken a seal claim but never strengthen it"; "refuses to seal to a recipient who has published no encryption key"; "re-keys and transfers atomically, advancing the epoch"; "clears operators, guardian, policy, lease and wallet, and pauses on transfer"; "reports lock state through both ERC-5192 and ERC-6454, and enforces it on transfer"; "blocks burning a locked agent too"; "lets a guardian pause but never unpause, transfer, or reconfigure"; "derives the same account address before and after deployment"; "requires the wallet's own signature to bind it, blocking standing-borrowing"; "keeps ERC-721 semantics for an unbounded grant"; "lapses a time-boxed approval on schedule"; "revokes every outstanding approval in one call"; "refuses an expiry that is already in the past".
- `test/Ownership.test.ts` (11): the two-step handover, levers, "keeps the pinned ERC-6551 configuration out of the owner's reach" (asserts no `setRegistry/setAccountImplementation/setAccountSalt/setKeyRegistry` in the ABI).
- `test/Regressions.test.ts` (22) incl. "keeps an agent disputed until the last open dispute resolves", "refuses to retire an agent that owes work", "ERC-5646 — changes when any part of the agent changes, not just its wallet", "reverts for an agent that does not exist, so zero is never a fingerprint".
- `test/Lifecycle.test.ts` (1 long test, 329 lines): birth → arming → bond → hire → learn → earn → guardian pause → bridge → sale → "the buyer inherits the asset, not the seller's staff".
- Helpers: `test/helpers.ts:74-98` recomputes `BrainLib` off-chain; `expectRevert` (377-393) matches error names **or 4-byte selectors** because "Hardhat decodes custom errors from the artifact registered for the reverting ADDRESS — which for a diamond is AnimaDiamond, whose ABI has no NotModule" (commit `9ee33d0`).

### Known weaknesses / gaps (observed in code)
- `tokenURI` is an opaque string set by the minter; no on-chain metadata/HTML generation. The "website" lives elsewhere (see §9).
- `mintAgent` is permissionless and free; anyone can mint to any `to`. Fine for a testnet reference, not a product.
- `revokeAllApprovals` only covers operator approvals; single-token `approve()` is stock OZ and not epoch-keyed (it is cleared on transfer by OZ, so the practical exposure is small).
- `unlockAgent` at `lockCount == 0` returns silently; a mis-counting module cannot be detected from the token.
- Unmerged branch `origin/codex/fix-high-priority-issues-from-codex-review` adds `ownershipEpoch(uint256) → operatorEpoch` to `IAnima`, the monolith and `AnimaCoreFacet` (needed by a RevenueRouter fix). Not on `main`.
- Unaudited (docs/SECURITY.md:3).

**Reuse verdict: adapt.** Port the `_update` semantics, the epoch-keyed operator/approval store, the counted lock/dispute model, guardian, module allowlist and ERC-5646 fingerprint into the unified token. Drop or make optional the brain/model/seal machinery. Do not reuse the file as-is: it is at the size wall and its `tokenURI` cannot host a website.

---

## 3. `contracts/core/EncryptionKeyRegistry.sol` (72 lines; **1,783 B**)

Purpose (9-22): "A blockchain address is a hash, not a public key. You cannot encrypt to it… ANIMA makes publishing a key a hard precondition of a sealed transfer. This registry is deliberately a standalone singleton rather than state on the token: a key is a property of a *person*, not of any one collection… intentionally unopinionated about the key's cryptosystem — X25519, secp256k1 ECIES, a post-quantum KEM — because the verifier and the sealing enclave are what must agree on it."

Storage: `struct KeyRecord { uint16 keyType; uint64 updatedAt; bytes publicKey; }`; `mapping(address => KeyRecord) _keys`. Constants: `KEY_TYPE_X25519 = 1`, `KEY_TYPE_SECP256K1_ECIES = 2`, `KEY_TYPE_P256_ECIES = 3`, `KEY_TYPE_ML_KEM_768 = 4` (values > 1000 private use).
API: `setEncryptionKey(uint16 keyType, bytes calldata publicKey)` (empty → `EmptyKey`); `revokeEncryptionKey()` ("better to block the sale than to complete one that hands over ciphertext nobody can open"); `keyOf(address) → KeyRecord`; `publicKeyOf(address) → bytes`; `keyIdOf(address) → bytes32` (= `keccak256(publicKey)` or 0 — "the value bound into a {ReKeyRequest}").
Events: `EncryptionKeyRegistered(address indexed account, bytes32 indexed keyId, uint16 keyType)`, `EncryptionKeyRevoked(address indexed account)`. No owner, no access control; self-service.
Tested via `AnimaAgent.test.ts` sealed-transfer cases and `Comms.test.ts` (private messaging, commit `11eb6e5` "Add key-pinned private agent messaging").
Deployed: Base Sepolia `0x1144308fb48D6F9dE0945cA64C1E1A652ceb1563` (0xc591 deployment) and `0x6B9f84C60F4cAd50589a67a4687b99f4f07E61e6` (0x0aeb deployment).

**Reuse verdict: reuse-verbatim.** This is exactly the recipient-key directory an on-chain E2E-encrypted messaging/social layer needs; it is chain-wide, key-type-agnostic, 1.8 KB, and has no admin.

---

## 4. Verifiers and `ITransferVerifier`

### `contracts/interfaces/ITransferVerifier.sol` (41 lines)
`struct ReKeyRequest { uint256 chainId; address anima; uint256 agentId; address from; address to; bytes32 oldBrainRoot; bytes32 newBrainRoot; uint64 oldEpoch; bytes32 recipientKeyId; bytes32 sealedKeysHash; }` — "hashed with EIP-712 by signature-based verifiers and used as the public input by proof-based ones, so both families bind to the *same* commitment." Interface: `sealPolicy() view returns (SealPolicy)`; `verifyReKey(ReKeyRequest calldata, bytes calldata proof) returns (bool)` — "MUST be replay-safe… Non-view by design — implementations need to burn nonces."

### `contracts/core/verifiers/NullTransferVerifier.sol` (23 lines; **220 B**)
Returns `SealPolicy.Committed` and `true`. "The point of publishing the policy is that a marketplace can grey out 'verified private state' for these agents instead of letting a seller imply a guarantee this verifier cannot make." Used by every deployment record on `main`.

### `contracts/core/verifiers/AttesterQuorumVerifier.sol` (198 lines; **4,332 B**)
`EIP712("AnimaAttesterQuorum","1")`, `Ownable2Step`. Storage: `isAttester`, `isApprovedEnclave[bytes32 measurement]`, `consumed[bytes32 digest]`, `attesterCount`, `threshold`. Typehash `ReKey(uint256 chainId,address anima,uint256 agentId,address from,address to,bytes32 oldBrainRoot,bytes32 newBrainRoot,uint64 oldEpoch,bytes32 recipientKeyId,bytes32 sealedKeysHash,bytes32 enclaveMeasurement)`.
Governance: `setAttester(address,bool)` (refuses to drop below threshold — "would brick every future transfer of every agent using this verifier"), `setEnclave(bytes32,bool)`, `setThreshold(uint256)` (zero → `ThresholdZero`; > count → `ThresholdTooHigh`).
`verifyReKey` (136-172): **`request.anima == msg.sender`** else `NotTheRequestingToken` — "Proofs are single-use, so a stranger who could consume one could permanently block a sealed transfer by front-running it with the seller's own proof, read from the mempool"; `request.chainId == block.chainid`; proof = `abi.encode(bytes32 measurement, address[] signers, bytes[] signatures)`; lengths match; enclave approved; `signers.length >= threshold`; digest unconsumed then consumed; signers strictly ascending (O(n) duplicate rejection); each `isAttester` and valid via `SignatureChecker` (ECDSA or ERC-1271 — "an attester may itself be a multisig"); emits `ReKeyCertified(agentId, digest, measurement, signers)`. `digestOf(request, measurement)` view. `sealPolicy()` = `SealedTEE`.
Honest limitations (30-34): "collusion of `threshold` attesters forges a re-key; a hardware break in the enclave family breaks the guarantee; none of this stops a prior owner who *already exported* plaintext."
Why quorum not on-chain TEE quote (16-24): "Verifying an Intel TDX or SEV-SNP quote on-chain means verifying an X.509 chain plus ECDSA-P384 against a provisioning root, and then keeping TCB recovery and CRL state current forever… puts a hardware vendor's revocation schedule inside your token contract's liveness path."
Tested in `test/AgentAccount.test.ts` describe "AttesterQuorumVerifier — a proof is useless to anyone but the token".
Errors: `ThresholdTooHigh`, `ThresholdZero`, `EnclaveNotApproved`, `NotEnoughSignatures`, `SignersNotSorted`, `UnknownAttester`, `BadSignature`, `ProofAlreadyUsed`, `LengthMismatch`, `NotTheRequestingToken`, `WrongChain`.

**Reuse verdicts:** `ITransferVerifier` + `NullTransferVerifier` — **drop** unless the unified NFT keeps verifier-certified private-state transfers. `AttesterQuorumVerifier` — **adapt**: as a generic EIP-712 M-of-N attester quorum with replay protection and caller-binding it is a reusable building block (e.g. for off-chain-moderated social actions or vault unlock attestations), but its typed payload is re-key specific.

---

## 5. Other interfaces

- **`IERC6551.sol`** (59 lines): `IERC6551Registry` (`createAccount`, `account`, event `ERC6551AccountCreated`, error `AccountCreationFailed`); canonical registry `0x000000006551c19487814612e58FE06813775758` via Nick's Factory, salt `0x…fd8eb4e1dca713016c518e31` (6-8). `IERC6551Account` (id `0x6faff5f1`): `receive()`, `token()`, `state()` ("Consumers MUST use it to detect that an account was used between the time a purchase was quoted and the time it settled"), `isValidSigner`. `IERC6551Executable` (id `0x51945447`): `execute(address,uint256,bytes,uint8 operation)`. **Reuse verbatim.**
- **`IERC8004.sol`** (174 lines): `struct MetadataEntry { string metadataKey; bytes metadataValue; }`; `IIdentityRegistry` (`register` ×3, `setAgentURI`, `getMetadata`, `setMetadata`, `setAgentWallet(uint256,address,uint256 deadline,bytes sig)`, `getAgentWallet`, `unsetAgentWallet`; events `Registered`, `URIUpdated`, `MetadataSet`); `IReputationRegistry`; `IValidationRegistry` (response 0-100, ">= 50 as 'passed' for bond-release"). Global id `eip155:<chainId>:<animaAddress>` + tokenId. **Reuse verbatim** if ERC-8004 identity is kept; otherwise drop.
- **`IERC7432.sol`** (75 lines): NFT Roles, Final, id `0xd00ca5cf`; implemented externally as `AnimaRoles` (outside my area). Rationale quoted: "ERC-7432 IS NOT an extension of ERC-721… allowing dApps to implement roles with immutable assets." **Reuse verbatim** (interface only).
- **`IERC8126.sol`** (22 lines): optional `AgentVerified`/`AttestationPosted` events + `getLatestRiskScore(uint256) → uint8`. Implemented on `ValidationRegistry`. **Drop** unless agent-risk scoring is kept.
- **`IRentable.sol`** (61 lines): `IERC4907` (`0xad092b5c`; `setUser`, `userOf`, `userExpires`, `UpdateUser`); `IERC5192` (`0xb45a3c0e`; `locked`, `Locked`, `Unlocked`) — "ANIMA uses locking as a *temporary* safety property, not a permanent one"; `IERC6454` (`0x91a6262f`; `isTransferable(tokenId, from, to)`) — "Both standards are merely descriptive — returning false stops nothing on its own. The transfer path must revert as well"; `IERC7572` (`contractURI()`, `ContractURIUpdated()`; "publishes no interfaceId. ANIMA registers the community-computed 0xe8a3d485"). **Reuse verbatim.**

---

## 6. Libraries

### `contracts/libraries/BrainLib.sol` (48 lines)
"An ordered hash chain rather than a Merkle tree: the only question ever asked on-chain is 'are these two shard sets identical?'… A chain answers that for ~30 gas per shard, where a tree costs more and buys inclusion proofs nobody needs here… Every entry point takes `memory` rather than `calldata`. Solidity compiles a separate copy of a loop for each data location, and three shard-writing call sites times two locations was enough duplicated bytecode to push the token past the 24,576-byte limit."
`LEAF_TAG = keccak256("anima.BrainShard.v1")`, `ROOT_TAG = keccak256("anima.BrainRoot.v1")`. `leafOf(BrainShard memory) = keccak256(abi.encode(LEAF_TAG, dataHash, keyCommitment, size, kind, keccak256(uri), keccak256(description)))`; `rootOf(shards) = fold(keccak256(abi.encode(ROOT_TAG, n)), keccak256(abi.encode(root, leaf)))`; `hashSealedKeys(bytes[] calldata) = keccak256(abi.encode(sealedKeys))`. Reproduced off-chain in `test/helpers.ts:74-98` and the SDK (`Sdk.test.ts` "derives the same brain root as BrainLib").
**Reuse verdict: adapt** — a generic, cheap, order-sensitive commitment over any shard list (e.g. vault inventory, encrypted profile blobs). Rename tags if the struct changes.

### `contracts/libraries/ERC6492.sol` (73 lines)
"ANIMA needs this more than most protocols do, because counterfactual accounts are not an edge case here — they are the design… a `staticcall` to an address with no code succeeds and returns nothing, which reads as 'invalid signature' rather than 'not deployed yet'." `MAGIC = 0x6492…6492` ("its last byte, `0x92`, is not a legal `v`"). `isValidSignatureNow(address signer, bytes32 hash, bytes memory sig) internal returns (bool)` — **state-changing** (may deploy). If wrapped and signer has no code: decode `(factory, factoryCalldata, inner)`, call factory, **require `signer.code.length != 0` afterwards** (commit `5f4dfa8` "Reject ERC-6492 wrappers that leave signer undeployed" — "otherwise an EOA could attach an arbitrary privileged call and still pass below with its ordinary ECDSA signature"), then `SignatureChecker`. If wrapped but already deployed: strip and check. Else plain. Tested in `Regressions.test.ts` "ERC-6492 — listing from an account that is not deployed yet" (3 tests incl. "rejects a wrapped EOA signature when preparation does not deploy the signer").
**Reuse verdict: reuse-verbatim** — needed wherever the swap/market accepts signatures from not-yet-deployed ERC-6551 accounts.

### `contracts/libraries/ExactERC20.sol` (33 lines)
"Rejects tokens whose transfer mechanics deliver a different amount than the protocol accounted for. This prevents fee-on-transfer tokens from creating unbacked escrow balances, underfunded curve purchases, or short-paid sellers." `transferFromExact(IERC20, from, to, amount)` and `transferExact(IERC20, to, amount)` measure `balanceOf(to)` before/after and revert `InexactERC20Transfer(token, expected, received)`; no-ops on zero amount or self-transfer. Commit `ef22afa`. Tested in `test/ExactERC20.test.ts` (2) with `MockTaxERC20`.
**Reuse verdict: reuse-verbatim** for the swap, launchpad and vault.

---

## 7. The immutable diamond (`contracts/diamond/`)

### Why (AnimaDiamond.sol:14-36, verbatim excerpts)
"**Why a diamond at all.** The monolith fits, with 605 bytes to spare. That is not a margin, it is a countdown… A diamond removes the ceiling instead of raising it."
"**Why immutable.** The usual reason to build a diamond is upgradeability, and that is precisely the property this contract must not have… the buyer's guarantee that a sale revokes the seller's session keys is worth exactly as much as the admin key that could remove it. So the facets are wired in the constructor and there is no `diamondCut`, no `owner` over the routing table, and no `delegatecall` reachable after construction other than through the frozen table. EIP-2535 provides for this explicitly: *'A diamond that has no external function for adding, replacing or removing functions is immutable.'*"
"**Verifying that claim.** Call {IDiamondLoupe-facets} and confirm (a) no selector resolves to `diamondCut`, and (b) each facet address holds the bytecode you expect."

### `AnimaDiamond.sol` (183 lines; **177 B runtime, 3,049 B initcode; 0 ABI functions**)
Constructor `(FacetCut[] memory cuts, address init, bytes memory initCalldata)`:
1. `NoFacets` if empty. For each cut: `NotAnAddition` unless `Add`; `FacetHasNoCode`; `EmptyFacetCut`; `SelectorAlreadyBound(selector, boundTo)` on duplicates; writes `facetOf`, `selectorsOf`, `facetAddresses`.
2. `_requireFacetsAgree(init)` (143-166): staticcalls `animaConfigHash()` on every facet **and the initialiser**; non-answering targets skipped; mismatch → `FacetConfigMismatch(facet, expected, found)`; none → `NoConfiguredFacet`. Rationale 80-84: "Every facet carries the ERC-6551 configuration as its own `immutable` — that is what makes `accountOf` free of storage reads, and it is worth ~6,300 gas on every settlement in the protocol."
3. `emit DiamondCut(cuts, init, initCalldata)` — "For an immutable diamond it is the only one that will ever be emitted, which makes it the permanent, indexable record of what this address actually is."
4. `delegatecall(init, initCalldata)`; bubbles revert data; empty → `InitializationFailed`.
5. **Post-condition** `AnimaStorage.layout().nextAgentId != 0` else `NotInitialised` (102-114): "A successful `delegatecall` is NOT evidence that initialisation happened: the EVM returns success for a `delegatecall` to an address holding no code… an uninitialised diamond can never be initialised: it would be permanently unowned (no module could ever be allowlisted), would issue agent id 0 — the value the registries reserve for 'no agent' — and would sign an EIP-712 domain with an empty name."
6. **Routing re-check** (116-136): re-reads `facetOf` for every emitted selector; `RoutingTampered(selector, expected, found)`. "What this does not do is make a hostile initialiser safe — it can still add a selector the cut never mentioned. Nothing on-chain can fix that, because the deployer chooses the initialiser. What it does do is make the emitted event *true*."
`fallback() external payable` (171-182): `facetOf[msg.sig]` else `FunctionNotFound(bytes4)`; assembly delegatecall. "a bare ETH transfer still reverts, because empty calldata resolves to selector `0x00000000`, which is bound to nothing."
Errors: `FunctionNotFound`, `NotAnAddition`, `FacetHasNoCode`, `EmptyFacetCut`, `SelectorAlreadyBound`, `InitializationFailed`, `FacetConfigMismatch`, `NoConfiguredFacet`, `NoFacets`, `NotInitialised`, `RoutingTampered`.

### `DiamondStorage.sol` (26 lines)
ERC-7201 `anima.storage.diamond`, slot `0xbebefff3c1769f392cbed28935c84c24a3fe9fb422c6177e5902f9088f11d900`; `facetOf`, `selectorsOf`, `facetAddresses`. "The routing table is infrastructure; agent state is the product."

### `AnimaStorage.sol` (70 lines)
ERC-7201 `anima.storage.core`, slot `0x2134dd8a40292237c0a0658c1368c4805ba84a926576fc8c56170c3a72e5a700`. `Layout` = `verifier, contractURI, isModule, nextAgentId, core, shards, model, policy, agentURI, lease, boundWallet, walletNonce, metadata, operator, approvalEpoch, operatorExpiry` — the monolith's state minus the four immutables. Why they are absent (27-36): "measuring showed that cost three cold `SLOAD`s on `accountOf`, about 6,300 gas, on the hottest cross-contract read in the protocol — eight contracts call it to find where an agent's money goes… A check at construction beats a cost on every settlement." OZ ERC-721/2981/EIP-712/Ownable2Step state lives in OZ's own ERC-7201 namespaces (`contracts-upgradeable`), so "the three state regions are provably disjoint by construction, not by review." **No facet may declare a plain state variable** — `Diamond.test.ts:235-253` asserts slots 0,1,2 are zero and that `anima.storage.core` field 0 holds the verifier.

### `IDiamond.sol` (52 lines)
`IDiamond` = `enum FacetCutAction {Add, Replace, Remove}`, `struct FacetCut`, `event DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata)` — "the vocabulary and not the verb… `IDiamondCut` is deliberately absent from the codebase — there is no contract to inherit it from, so there is no path by which a later edit accidentally makes {AnimaDiamond} mutable." `IDiamondLoupe` (id `0x48e2b093`): `facets()`, `facetFunctionSelectors(address)`, `facetAddresses()`, `facetAddress(bytes4)`.

### `IAnimaConfigured.sol` (38 lines)
`struct AnimaConfig { IERC6551Registry registry; address accountImplementation; bytes32 accountSalt; EncryptionKeyRegistry keyRegistry; }` ("a transposed pair would deploy a diamond that derives every agent's wallet to the wrong place"); `animaConfigHash() → keccak256(abi.encode(registry, accountImplementation, accountSalt, keyRegistry))`.

### `AnimaBase.sol` (295 lines; abstract)
"The failure mode of EIP-2535 is not storage collision — ERC-7201 settles that. It is *semantic drift*: two facets that each implement 'is this caller allowed to write this agent' and slowly stop agreeing. So the rules live here exactly once and the facets are thin surfaces over them."
Inherits `IAnimaEvents, IAnimaConfigured, ERC721Upgradeable, ERC2981Upgradeable, EIP712Upgradeable, Ownable2StepUpgradeable`. Per-facet immutables `_REGISTRY, _ACCOUNT_IMPLEMENTATION, _ACCOUNT_SALT, _KEY_REGISTRY` (72-93). `animaConfigHash()` 98-100 — "Not routed through the diamond — it is read by staticcall on the facet itself, at construction." Shared internals: `_s()`, `onlyModule`, `_requireOwnerOf`, `_requireController`, `_isController`, `_isOperator`, `_locked`, `_setStatus`, `_setMetadata`, `_setVerifier`, `_writeShards`. **Sealed (non-virtual) overrides**: `tokenURI` (204-207), `isApprovedForAll` (218-221 — "A facet that inherited the stock implementation would read an approval store nothing writes to, and silently reject legitimate operators"), `setApprovalForAll` (224-226), `_update` (249-276, identical semantics to the monolith; "Deliberately not `virtual`… the compiler refuses the attempt rather than the reviewer having to notice it"). `supportsInterface` (282-294) virtual, same list as monolith.

### `AnimaInit.sol` (53 lines; **9,012 B**)
`init(string name_, string symbol_, address owner_, ITransferVerifier verifier_, address royaltyReceiver_, uint96 royaltyBps_) external initializer`: `__ERC721_init`, `__EIP712_init("AnimaAgent","1")`, `__Ownable_init`, `nextAgentId = 1`, `_setVerifier`, royalty. "This contract's `init` selector is never added to the diamond's function table, so after construction there is no route to it at all… Calling `init` on this contract *directly* initialises this contract's own storage and affects no diamond." Takes `AnimaConfig` so the agreement check covers it.

### `AnimaLoupeFacet.sol` (39 lines; **1,731 B; 4 selectors**)
Pure reads over `DiamondStorage`. "{AnimaDiamond} defines none [immutable functions]: it is nothing but a constructor and a fallback, so every selector reported here resolves to a real, separately deployed and separately verifiable facet."

### `AnimaCoreFacet.sol` (196 lines; **9,946 B; 39 ABI functions, 38 routed**)
`is AnimaBase, IERC5192, IERC6454, IERC7572`. The *base* facet in `deriveFacetCut` terms: it serves everything in `AnimaAgent`'s ABI that no specialised facet claims — the whole inherited ERC-721/2981/Ownable2Step/EIP-712 surface — plus: `setApprovalForAllUntil`, `revokeAllApprovals`, `approvalExpiryOf`, `approvalEpoch(address)` (explicit getter; the monolith's is a public mapping), `locked`, `isTransferable`, `lockAgent`, `unlockAgent`, `setDisputed`, `verifier()` (explicit getter), `setVerifier`, `isModule(address)` (explicit getter), `setModule`, `contractURI`, `setContractURI`, `setDefaultRoyalty`, `setTokenRoyalty`, `totalMinted`. `supportsInterface` adds `IDiamondLoupe` (193-195) — the first of the two intended divergences.

### `AnimaAgentFacet.sol` (336 lines; **15,052 B; 55 ABI functions, 34 routed**)
`is AnimaBase, IERC4907, IERC4906`. Explicit getters `REGISTRY()`, `ACCOUNT_IMPLEMENTATION()`, `ACCOUNT_SALT()`, `KEY_REGISTRY()`, `keyRegistry()`; `isController`, `isOperator`, `setOperator`; manifest/metadata; model; `accountOf` (162-164 — "Every read here is of an immutable, so this costs no storage at all"), `deployAccount`, `getAgentWallet`, `setAgentWallet`, `unsetAgentWallet`, `walletNonce`, `policyOf`, `setPolicy`; lifecycle incl. `guardianPause`; lease; `getStateFingerprint`. "It writes nothing that could move the token; transfer authority lives entirely in {AnimaCoreFacet} and {AnimaBase}."

### `AnimaBrainFacet.sol` (231 lines; **15,758 B — largest unit, 8,818 B to spare; 32 ABI functions, 11 routed**)
`is AnimaBase, IERC4906, ReentrancyGuardTransient`. `mintAgent`, `register` ×3, `brainOf`, `brainRoot`, `brainEpoch`, `sealPolicyOf`, `downgradeSealPolicy`, `updateBrain`, `transferWithBrain` — byte-for-byte the monolith's logic over `_s()`. "a mint writes the first brain, a re-keyed sale writes the last one the seller will ever write."

### How the cut is derived — `sdk/src/index.ts:634-735`
`DIAMOND_CUT_SELECTOR = 0x1f931c1c`; `DIAMOND_LOUPE_INTERFACE_ID = 0x48e2b093`. `deriveFacetCut({ tokenAbi, base, specialised[], additional[] })`: specialised facets claim `selectorsOf(facet.abi) \ selectorsOf(base.abi)`; throws if a claim is not in `tokenAbi`, if two facets claim one selector, or if a specialised facet "adds nothing"; `base` gets the remainder and throws if it cannot serve any token selector ("the diamond would be incomplete"); `additional` (loupe) must not collide with the token ABI. `cutIsImmutable(cut)`. Header: "Hand-written selector lists are the standing hazard of this pattern: a diamond is deployed, the cut is welded shut, and only later does someone notice a function nobody routed."
Result on `main`: **83 token selectors over 3 facets (38 + 34 + 11) + 4 loupe = 87 routed selectors, 4 facets** (`Diamond.test.ts:196-216`, DEPLOYMENT.md:45).

### `scripts/deploy-diamond.ts` (368 lines) — the verification pass
Deploys facets + init against one `AnimaConfig` (optional reuse of already-deployed facets), `waitForCode` on each ("A public RPC is a load balancer over several nodes… a constructor that inspects the contracts it was just handed… can be told they hold no code, and revert `NoConfiguredFacet`"), derives the cut, refuses if `!cutIsImmutable`, deploys, then checks on-chain: (a) every declared selector resolves to the facet the cut assigned; (b) no `diamondCut`; (c) loupe reports exactly the four facets; (d) each facet's code equals the artifact modulo `immutableReferences` (`maskImmutables`) and contains no `diamondCut` selector; (d2) each facet's `animaConfigHash` equals the requested config, and the token's `REGISTRY/KEY_REGISTRY/ACCOUNT_IMPLEMENTATION` match; (e) name/symbol/owner/verifier initialised, `totalMinted == 0`, EIP-712 domain `(AnimaAgent, 1, this)`; (f) ERC-165 for 11 ids and false for `0xffffffff`. Any failure → "deployed diamond failed verification — do NOT publish this address". Prints the three human-only checks (source-verify facets **and the initialiser**; `facetAddress(0x1f931c1c) == 0` from a trusted node; registry is canonical). `test/Deploy.test.ts` runs it for real on every `npm test`.

### Measured diamond overhead (`test/Gas.test.ts`; ARCHITECTURE.md:109-120)
Bound: fails if a probe exceeds **both** 25% relative and 6,000 gas absolute.
```
ownerOf 24472→29062 (+4590, 18.8%) · tokenURI 30058→34511 (+4453) · supportsInterface 21998→26960 (+4962, 22.6%)
isApprovedForAll 28511→32853 (+4342) · accountOf 26863→31594 (+4731, 17.6%) · getStateFingerprint 54818→60204 (+5386, 9.8%)
mintAgent 311367→316587 (+5220, 1.7%) · transferFrom 85818→90499 (+4681, 5.5%) · updateBrain 68445→72833 (+4388, 6.4%)
```
"flat at roughly 4,300–5,400 gas… exactly what one `DELEGATECALL` costs: a cold `SLOAD` of the selector table (2,100) plus a cold account access for the facet (2,600)." Before the per-facet-immutable fix: `accountOf` +11,081 (41.3%), `getStateFingerprint` +11,525 (commit `df18827`).

### The two intended divergences (ARCHITECTURE.md:151-164; `Diamond.test.ts:132-179`)
1. `supportsInterface(0x48e2b093)` true only on the diamond.
2. Unrouted selector reverts `FunctionNotFound(bytes4)` (non-empty data) vs the monolith's empty revert — observable as `safeTransferFrom` to the token's own address reporting `FunctionNotFound` vs `ERC721InvalidReceiver`.

### Tests (`test/Diamond.test.ts`, 22)
"produces the identical ERC-5646 fingerprint for an identically-lived agent" (pinned timestamp 2,000,000,000; deep-equals a 22-field report); "answers ERC-165 exactly as the monolith does, plus the loupe"; "differs from the monolith in exactly one more place, and it is the fallback's error"; "reports the same EIP-712 domain"; "partitions the monolith's ABI: every function routed, exactly once"; "resolves each selector to the facet the loupe says holds it"; "keeps the two ERC-7201 namespaces where it claims they are, and slot 0 empty"; "reports the same configuration as the monolith, from every facet"; "refuses to deploy when a facet was built against a different configuration"; "refuses to deploy a diamond whose facets carry no configuration at all"; "routes no diamondCut, on the diamond or on any facet" (also greps facet bytecode for `1f931c1c`); "rejects a call to a function it does not have"; "refuses a bare ETH transfer"; "leaves the initialiser unreachable once construction is over"; "is unaffected by anyone initialising the deployed initialiser directly"; "holds facets that are inert when called directly"; "refuses two facets claiming the same selector"; "refuses anything but an addition, and refuses a facet with no code"; "refuses to deploy uninitialised, however the initialiser goes missing" (zero init, EOA init, wrong calldata); "catches an initialiser that rewires the table it was just handed" (`contracts/mocks/TamperInit.sol` + `BackdoorFacet`); "refuses a diamond with no facets at all"; "bubbles up an initialiser revert rather than deploying a half-built diamond". `Sdk.test.ts` "SDK — deriving an EIP-2535 cut" (6 tests). Commit `8f40c79`: "Verified by mutation: a one-character change in a facet fails 162 of them."

### Weaknesses
- Each facet carries the full OZ-upgradeable ERC-721 surface in its ABI; the `deriveFacetCut` "base gets the remainder" rule is what keeps that from double-routing — a new facet must be declared as `specialised` and must add at least one selector or the derivation throws.
- A hostile initialiser can still add unlisted selectors (documented; mitigated only by source verification).
- The diamond has no `receive()`; it cannot hold ETH (by design here, but a unified token whose website/vault might receive ETH at the token address must route value through a facet function).
- OZ `contracts-upgradeable` dependency (fine here; conflicts only with a "no external deps" policy if the unified repo adopts IPSEITY's rule).

**Reuse verdicts:** `AnimaDiamond`, `DiamondStorage`, `IDiamond`, `AnimaLoupeFacet`, `deriveFacetCut`/`cutIsImmutable`, `deploy-diamond.ts` — **reuse-verbatim**. `AnimaBase` — **adapt** (keep the sealed `_update`/approval/`tokenURI`/ERC-165 pattern; change what `_update` clears). `AnimaStorage`, `IAnimaConfigured`, `AnimaInit` — **adapt** (new fields / new config). The three ANIMA facets — **adapt** (split points are good: core/ERC-721+admin, identity/policy, mint+private state).

---

## 8. Deployment records and measured chain facts

- `deployments/84532.json` — Base Sepolia, deployer `0xb76d63330A3Fff184322Ca06270368e901A33bc7` (burner, destroyed): diamond `0x0aeb6f783ebade8fd5ffca74317266d4ea3e71b3`; facets core `0x4A815892c26eb5Ab35b17fd85b881d7610428c47`, agent `0x79c4Fe69D445dcf8c72392Ea3554aeb423EAb545`, brain `0xEebD273549156F636c6FF24D7DebC115aFFf21c0`, loupe `0xda7d5f48b94067f1F3b35fe2c52e0c03ba2AaBa2`; init `0x86E5e6E0B47d1Bf6CA8DDc4A37866108Bc694c85`; keyRegistry `0x6B9f84C60F4cAd50589a67a4687b99f4f07E61e6`; verifier `0x9B231446E0B096c75A02B9542d748aaFe612C0A6`; registry canonical `0x000000006551c19487814612e58FE06813775758`. README: "Total cost of deploying the protocol: 0.00628 ETH"; LayerZero round trip to OP Sepolia. **No renderer recorded here.** CLAUDE.md: treat as historical.
- `deployments/84532-0xc591c669162cd4da8ab9bfa2c2e68d538a312c00.json` — second Base Sepolia deployment, deployer `0xc591C669162cD4da8aB9BfA2c2e68d538A312C00`: diamond `0xb3d92c766e3cb356db381feb21958a9ebb974365`; facets `0xbb2a…d8b9`/`0x2f21…9569`/`0x1cbf…ce4f`/`0x5c94…f35b`; init `0xbbd2…2a3`; keyRegistry `0x1144308fb48D6F9dE0945cA64C1E1A652ceb1563`; verifier `0xC83feE21eD736Fb0e318ab92202FAaA5E321ed1F`; **`web3Renderer` `0x9160bE4d943516a2463Ac5f3ABAc5F5cce7975Cd`** (history `0xbD714258d540F1b720466e95724b9a00d05C3A29`, `0x1E07De2923542769Cc72a43a024d7c5AABDf5bC8`); town run 2026-09-03: 12 residents (agent ids 18-29), 130 successful transactions, 48 expected reverts; batchMint ids 30-32 to `0xb88Fbf05268802100E5E55ADBa211d6453aF8b5b`.
- Same deployer also on Sepolia `11155111` (diamond `0xbbd203d76eb2a2e493f458dff74b10c6659d12a3`, batchMint count 10), Unichain Sepolia `1301`, Robinhood testnet `46630`, BSC testnet `97`; `omni-84532.json` records LayerZero journeys.
- `public/.well-known/anima.json` (machine-readable directory, dated 2026-09-17) points `identityRegistry` at `0xb3d92c76…` and publishes `rendering.web3UrlTemplate = web3://0x9160be4d943516a2463ac5f3abac5f5cce7975cd:84532/token/{agentId}/live` and `urlTemplate = https://0x9160be4d943516a2463ac5f3abac5f5cce7975cd.basesep.w3link.io/token/{agentId}/live`.
- **Inconsistency**: README "Live on Base Sepolia" and the Sanctuary instructions (README:468) cite `0x0aeb6f78…`, while `src/main.js:120` hardcodes `0xb3d92c76…` and `.well-known` also uses `0xb3d9…`.

---

## 9. How the web UI is delivered, and how ownership is verified for access

There are **two** UIs. Neither is emitted by `tokenURI`.

### 9a. `contracts/web/AnimaWeb3Renderer.sol` (138 lines; **22,592 B runtime — only 1,984 B under EIP-170; 2 ABI functions**)
- ERC-4804 manual mode: `resolveMode() pure returns (bytes32("manual"))` (32-34); `fallback(bytes calldata path) external returns (bytes memory)` (37-47) returns `abi.encode(string html)`. "Keeping this separate from the immutable ANIMA diamond lets an existing collection gain a browser without changing token logic." (15-16)
- Routes: `/` → usage page with the collection address; `/token/{id}/live` → the console (digits only, parsed by `_tokenPath` 49-64); anything else or nonexistent token → "Agent not found" (uses `try ANIMA.ownerOf`).
- Constructor pins `IAnimaWeb3View ANIMA` (`ownerOf`, `accountOf`); immutable, stateless, no owner, so "Any funded account may deploy it, which makes recovery possible without the original collection deployer key" (`scripts/deploy-web3-renderer.ts:36-37`).
- The HTML (76-99): header with CONNECT WALLET, `<main id="app" data-token data-contract data-chain>`, tabs OVERVIEW / IDENTITY / CONTROL / ADVANCED; overview shows owner, ERC-6551 account, collection, state fingerprint and a capability chip list; identity shows model, memory root/epoch, seal, manifest URI, lock; control offers ACTIVATE ACCOUNT (`deployAccount`), AWAKEN/PAUSE/RETIRE (`setStatus` 1/2/4), SET GUARDIAN, operator ALLOW/REVOKE; advanced lets the user type any function signature + JSON args, simulate, then sign. Footer: "ERC-4804 ONCHAIN INTERFACE" + explorer link. CSS inline (120-124).
- **The script (126-136) does `import{…}from"https://esm.sh/viem@2.55.19"`** — a runtime dependency on a third-party CDN; RPC URLs hardcoded for `11155111` and `84532` only (`_chainName` likewise); `connect()` uses `window.ethereum` (`requestAddresses`, `switchChain`/`wallet_addEthereumChain`); `send()` does `simulateContract` with `account: user` then `writeContract`, waits for receipt, refreshes.
- **Bug**: seal label array is `["NONE","SEALED TEE","ZK RE-ENCRYPTED"]` (131) against a 6-value enum, so `Committed`(1) displays as "SEALED TEE" and `ReKeyed`(2) as "ZK RE-ENCRYPTED".
- **Ownership gating: none.** Anyone can open any token's page; the page displays `ownerOf` and lets any connected wallet attempt writes; the contract's `NotOwnerOf`/`NotAgentController`/`NotGuardian` reverts are what actually gate, surfaced by the pre-send simulation. There is no "verify you hold the NFT, then unlock" step.
- Test `test/Web3Renderer.test.ts` (2): "serves an ERC-4804 manual-mode live page from token state" (asserts `createWalletClient`/`simulateContract` strings — i.e. the CDN-based client is pinned by the test — and `doesNotMatch(/github\.io/)`); "serves usage and not-found pages without reverting".
- Deployment: `npm run testnet:web3-renderer` (`scripts/deploy-web3-renderer.ts`) reads `deployments/<chainId>.json`, reuses the recorded renderer unless `ANIMA_REDEPLOY_RENDERER=true`, prints `https://<renderer>.<sep|basesep>.w3link.io/token/{n}/live`; GitHub workflow `.github/workflows/deploy-web3-renderer.yml` ("Deploy the ANIMA onchain browser", manual dispatch, `base-sepolia` environment secret) commits the address back to `main`.
- Unmerged improvement: branch `origin/codex/submit-blockchain-deployment-using-sepolia-key-koorbx` replaces the viem import with a plain `<script>` using hand-written 4-byte selectors (`ownerOf 6352211e`, `accountOf 8f4e4321`, `statusOf ad35efd4`, `getStateFingerprint f5112315`, …), raw `fetch` JSON-RPC, manual ABI word encoding/decoding, the full 6-entry seal list, `eth_requestAccounts`/`wallet_switchEthereumChain`, `eth_call`-then-`eth_sendTransaction`, and raw-calldata advanced mode. This is the version that satisfies "no external dependency"; `main` does not have it.
- History: `2d74176` "feat: add onchain Web3URL renderer" (2026-09-16), `9cb1ebb` "Link onchain NFT pages to owner console", `20bfda6` "Merge main and serve the complete onchain agent console". Earlier revisions (per `web3RendererHistory`) redirected to GitHub Pages; the test now forbids `github.io`.

### 9b. The GitHub Pages "Sanctuary" (`index.html`, `src/main.js` 191 lines, `src/style.css`, `vite.config.js`, `.github/workflows/pages.yml`)
- Static Vite site at `https://venividis.github.io/Cutting-edge-technologically-advanced-NFT/`; `vite.config.js` uses `base: './'` so "the same build work[s] on localhost, an IPFS directory, and GitHub Pages". Bundles `viem` from npm; hardcodes `ANIMA = 0xb3d92c766e3cb356db381feb21958a9ebb974365` and `https://sepolia.base.org`.
- Flow (`main.js:178-181`): `connect()` → `requestAddresses` → switch/add Base Sepolia → `discover()` reads `totalMinted` then calls `ownerOf(id)` for **every id 1..total** and keeps those equal to the wallet ("Ownership verified from Base Sepolia just now"). Shows a per-agent "Command Chamber" (status, seal/epoch, ERC-6551 account + deployed flag, daily policy, fingerprint, Awaken/Pause, Activate web3 address, "Add NFT to Brave" via `wallet_watchAsset`, provenance link). Anyone may inspect any id without connecting (`inspectAgent`).
- `mintAgent()` (181): builds a **self-contained `data:application/json` tokenURI with an inline SVG** (`metadataURI`, 150-156 — "The metadata is stored with the token instead of pointing at this website. Wallets such as Brave can therefore render a freshly minted ANIMA without an IPFS gateway or hosted API"), `manifestHash = keccak256(uri)`, one genesis `BrainShard` (kind 1, `uri:''`), `SealPolicy.None`; then `deployAccount`. The `external_url` in that JSON points at the Pages site.
- So: metadata is self-contained **only if the minter chose to make it so**; the token contract does not enforce or generate it. The site itself is served by GitHub — a server.
- Ownership verification = client-side `ownerOf == connected address`. No signature, no session; writes are gated on-chain.

### Answer to the explicit question
The web UI is delivered (a) from chain as a separate ERC-4804 manual-mode contract that depends on a CDN for `viem` and on a `w3link.io` gateway or a web3://-capable browser, and (b) from a static GitHub Pages site. The NFT itself does not "mint" a website: `tokenURI` is a stored string. Access is not gated at all for viewing; for writes, verification is the contract's own per-function checks (`ownerOf`, controller, guardian, module), with the UI simulating first so a non-owner sees a revert before signing.

**Reuse verdict for `AnimaWeb3Renderer`: rewrite**, keeping: `resolveMode()="manual"` + `fallback(bytes path) → abi.encode(string)`, the route shape `/token/{id}/…`, the separate-immutable-renderer idea (an existing collection gains a browser), and the simulate-before-sign UX; dropping: the esm.sh import, hardcoded two-chain RPC table, the wrong seal labels, and taking the koorbx branch's dependency-free client as the starting point. In the unified design the renderer should be a facet of the same diamond (or addressed from `tokenURI`) so the website is reachable from the token, and the HTML should be stored as SSTORE2-style shards rather than string literals (the current 22.6 KB contract is 1,984 B from the ceiling).

---

## 10. Everything measured (collected)

| Item | Value | Source |
|---|---|---|
| `AnimaAgent` runtime / initcode | 23,971 B / 26,744 B; 605 B headroom | artifacts; ARCHITECTURE.md:24 |
| `AnimaAgent` ABI functions | 83 | artifacts; DEPLOYMENT.md:45 |
| `AnimaDiamond` runtime / initcode | 177 B / 3,049 B | artifacts; ARCHITECTURE.md:51 |
| `AnimaCoreFacet` | 9,946 B; 38 routed selectors | artifacts; ARCHITECTURE.md:53 |
| `AnimaAgentFacet` | 15,052 B; 34 routed | artifacts |
| `AnimaBrainFacet` | 15,758 B (largest; 8,818 B headroom); 11 routed | artifacts; README |
| `AnimaLoupeFacet` | 1,731 B; 4 selectors | artifacts |
| `AnimaInit` | 9,012 B | artifacts |
| `EncryptionKeyRegistry` | 1,783 B | artifacts |
| `AttesterQuorumVerifier` / `NullTransferVerifier` | 4,332 B / 220 B | artifacts |
| `AnimaWeb3Renderer` | 22,592 B runtime (1,984 B headroom) | artifacts |
| Total routed selectors | 87 (83 + 4 loupe) over 4 facets | Diamond.test.ts:211-214 |
| Diamond per-call overhead | +4,300…+5,400 gas, flat; worst 22.6% on `supportsInterface` | Gas.test.ts; ARCHITECTURE.md |
| Pre-fix `accountOf` overhead | +11,081 gas (41.3%) | commit df18827 |
| Gas bound | ≤25% relative OR ≤6,000 absolute | Gas.test.ts:113-115 |
| Test count | 279 = 268 `it(` in `test/*.ts` + 3 Cli + 4 EconomySim + 4 ManifestSchema | measured; README/SPEC/SECURITY/DEPLOYMENT say 279; CLAUDE.md says 268 |
| Core-area test files | AnimaAgent 25, Diamond 22, Ownership 11, Deploy 2, Gas 1, Web3Renderer 2, Lifecycle 1, Regressions 22, Sdk 22, ExactERC20 2 | measured |
| Deployable contracts | 27 (README/SPEC); 32 non-mock `contract` declarations incl. facets/init/mocks in src | measured |
| Size levers | CBOR trailer 53 B; runs 200→1 376 B; both 429 B; public lib for shards +4 KB | ARCHITECTURE.md:342-359 |
| ERC-7201 slots | core `0x2134dd8a…a700`; diamond `0xbebefff3…d900` | AnimaStorage/DiamondStorage |
| Interface ids | 165 `0x01ffc9a7`, 721 `0x80ac58cd`, 721Metadata `0x5b5e139f`, 2981 `0x2a55205a`, 4906 `0x49064906`, 4907 `0xad092b5c`, 5192 `0xb45a3c0e`, 6454 `0x91a6262f`, 7572 `0xe8a3d485`, 5646 `0xf5112315`, loupe `0x48e2b093`, 7432 `0xd00ca5cf`, 6551 account `0x6faff5f1`, 6551 executable `0x51945447`, diamondCut selector `0x1f931c1c` | code |
| Base Sepolia deploy cost | 0.00628 ETH | README:355 |
| Town run | 130 successful tx, 48 expected reverts, 12 residents | 84532-0xc591 record |
| Compiler | solc 0.8.28, viaIR, runs 200, cancun; OZ 5.6.1 | hardhat.config.ts, package.json |

---

## 11. Standards implemented in this area
ERC-165, ERC-721 (+Metadata), ERC-2981, ERC-4906, ERC-4907, ERC-5192, ERC-5646, ERC-6454, ERC-7572 (draft, community id), ERC-8004 IdentityRegistry (on the token), ERC-6551 (consumer: registry + account interfaces; `accountOf` derivation), ERC-7857 (adapted: `BrainShard`/re-key/`SealedKeysPublished`), ERC-6492 (library), EIP-712 (wallet binding, attester quorum), EIP-2535 (immutable variant + loupe), ERC-7201 (namespaced storage), ERC-4804 / web3:// manual mode (renderer), ICRC-37/CW-721 expiring approvals (ported), Ownable2Step, transient reentrancy guard (EIP-1153). Declared-only interfaces: ERC-7432, ERC-8126, ERC-8004 reputation/validation.

## 12. Unique ideas worth carrying forward
1. Immutable diamond with the cut welded shut; cut derived from the monolith ABI; constructor post-conditions (`NotInitialised`, `RoutingTampered`); per-facet immutable config checked by hash at construction; on-chain verification script with masked-immutable bytecode diff.
2. "Selling revokes all authority" transfer hook, sealed non-virtual in a shared base so no facet can opt out.
3. Epoch-keyed operator and approval stores: O(1) revoke-all, time-boxed `setApprovalForAllUntil`, `approvalExpiryOf`.
4. Counted locks and disputes (`lockCount`/`disputeCount`) enforced in `_update`, reported via both ERC-5192 and ERC-6454; module allowlist as the only lock authority.
5. Guardian that can only pause; retirement refused while locked.
6. ERC-5646 fingerprint over all mutable state plus the ERC-6551 `state()` nonce; reverts for nonexistent tokens.
7. Manifest URI and hash set together; URI-only update records "uncommitted" rather than a stale hash.
8. Chain-wide `EncryptionKeyRegistry` with `keyIdOf` = keccak of the published key, bound into proofs.
9. Honest `SealPolicy` that only a verifier can strengthen; verifier binds `request.anima == msg.sender` so proofs cannot be burned by strangers.
10. ERC-6492 with the "must actually deploy the signer" guard.
11. `ExactERC20` value conservation.
12. A gas-overhead test that fails the build on drift; `expectRevert` that matches 4-byte selectors so diamond reverts assert the same thing.
13. Memory-only library entry points to avoid per-data-location code duplication (measured size fix).
14. Separate immutable ERC-4804 renderer so an already-deployed collection gains an on-chain browser; CI workflow that records the renderer address in the deployment file.
15. Public-RPC lag defences in scripts (`waitForCode`, retry the first read, ids from receipt logs).

## 13. Pitfalls recorded by the authors (for the unified design)
- Any function added to `AnimaAgent` must be added to exactly one facet or `deriveFacetCut` throws; do not loosen it.
- Never reorder `AgentCore`/`Lease`; append only (fingerprint domain).
- No plain state variables in facets (slot 0-2 test).
- A bare `@` in NatSpec breaks compilation (CLAUDE.md).
- Public libraries with dynamic-array params grow bytecode (+4 KB measured).
- `try/catch` around optional side effects on gas-estimated paths silently drops them (SECURITY.md:108-113).
- Scaled ratios truncate to zero at realistic decimals (SECURITY.md:115-118).
- `delegatecall` to a codeless address returns success — assert post-conditions.
- Public RPC endpoints are load balancers: wait for code, take ids from logs, block until the endpoint reaches the block.
- Hardhat decodes custom errors from the artifact at the reverting address — a diamond needs selector matching in tests.
- Docs' numeric claims (test counts, sizes, gas) drift; re-measure before quoting.
