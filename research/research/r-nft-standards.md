# NFT utility standards survey — what one-token-does-everything should adopt, and what it should refuse

Research date: 2026-10-02. Scope: the ERCs named in the brief (ERC-721C, 2981, 7496, 7498, 4907, 5006, 7432, 5646, 7572, 6220, 7401/6059, 5169, 7508, 7160, 6381, 5484, 7589) plus the standards that turned out to be load-bearing for a token that must carry a swap, a messaging/social layer, a launchpad, a vault, and its own website, with no server and no IPFS. 27 searches, 52 primary pages read (EIP texts at eips.ethereum.org, Limit Break and OpenSea source/docs, SIP-15, incident write-ups). Every status and date below is as read on 2026-10-02 from the EIP page itself unless marked otherwise; a claim I could not confirm from a primary source is marked **unverified**.

The target is the merge of four local repositories (IPSEITY in `Most-Advanced-NFT-Possible`, ANIMA in `Cutting-edge-technologically-advanced-NFT`, `MASTER-NFT-PROJECT`, `Pixel-Garden`). Where a recommendation depends on what those repos already do, I say so, because the point of this survey is not a reading list but a decision table.

---

## 1. The decision table, up front

| Standard | Status (as read) | Verdict for our token | One-line reason |
|---|---|---|---|
| ERC-2981 royalties | Final (2020-09-15) | **Adopt** (signal only) | Universal interface; enforcement is explicitly voluntary and belongs to venues, not the token |
| ERC-721C / transfer validator | Not an ERC; Limit Break library + validator V5 (May 2025) | **Avoid** as a dependency; **could** re-implement a minimal in-contract policy | External, upgradeable, vendor-controlled; receiver constraints at levels 5–8 reject contract receivers (kills ERC-6551 custody); the Sep 2026 Payment Processor incident shows the systemic cost of standing approvals to vendor rails |
| ERC-7496 dynamic traits | Draft (2023-07-28) | **Adopt** (already in IPSEITY) | On-chain traits are the only traits a server-less site can show; pair with fingerprint-bound trades |
| ERC-7498 redeemables | Draft (2023-07-28) | **Could** — trait-redemption substandard only | Campaign/manager/signer model is an admin surface; trait redemption is useful for perks |
| ERC-4907 rental | Final (2022-03-11) | **Adopt as a shim** over 7432 | Marketplaces and games key on `userOf`; cheap to derive from a USER role |
| ERC-5006 rental (1155) | Final (2022-04-12) | **Skip** | We are ERC-721 |
| ERC-7432 NFT roles | Final (2023-07-14) | **Adopt** (ANIMA already does) | Expirable, revocable, data-carrying roles subsume 4907 and model session keys, guardians, renters |
| ERC-7589 SFT roles | Draft (2023-12-28) | **Skip** | ERC-1155 counterpart of 7432 |
| ERC-5646 state fingerprint | Final (2022-09-11) | **Must** (ANIMA already does) | The one primitive that makes a vault-carrying NFT safely tradeable |
| ERC-7572 contractURI | Draft (2023-12-06) | **Adopt** (IPSEITY does) | One view function; indexers already read it |
| ERC-6220 equippable | Final (2022-12-20) | **Skip** | Catalog machinery and bytes we do not have |
| ERC-7401 nestable (6059 fixed) | Final (2023-07-26) | **Skip** | ERC-6551 custody already lets the token own tokens; two ownership models is one too many |
| ERC-5169 scriptURI | Final (2022-05-03) | **Adopt** | One function returning the token's own `web3://` or `data:` app; TokenScript-aware wallets find the site |
| ERC-7508 attribute repository | Draft (2023-08-15) | **Skip** | External singleton with owner/collaborator access types; our traits live in the token |
| ERC-7160 multi-metadata | Final (2023-06-09) | **Adopt** (IPSEITY does) | Faces: live app, SVG, agent card |
| ERC-6381 emotes | Final (2023-01-22) but superseded | **Skip 6381, adopt 7409** | 7409 replaced bytes4 emoji with string; canonical repo address, zero code |
| ERC-5484 consensual SBT | Final (2022-08-17) | **Could** — only for child credential tokens | The main token must trade; use 5192 `locked()` for lock state |
| ERC-7857 AI-agent NFT w/ private metadata | Final (2025-01-02) | **Do not claim**; keep IPSEITY's sealed kernel under its own name | Normative entry points assume off-chain sealed executor; no ERC-165 id |
| ERC-8004 trustless agents | Draft (2025-08-13) | **Adopt via ERC-8217 binding**, not by being the registry | Registry is a per-chain singleton; bind the agent id to our master NFT |
| ERC-7627 secure messaging | Final (2024-02-19) | **Adopt** event shape for DMs | Event-only, E2E-encrypted, fits Parley's log-walk design |
| ERC-6909 minimal multi-token | Final (2023-04-19) | **Adopt** for launchpad/pool claims | Uniswap v4 native; no callbacks |
| ERC-7631 dual-nature pair | Final (2024-02-21) | **Avoid** for now | BT404-style packed-ownership bug (Flooring, Jun 2026) is the cautionary tale |
| ERC-7858 expirable NFTs | Final (2024-01-04) | **Could** — for lease/session child tokens | `isTokenExpired` is a clean read for the site |
| ERC-5219 / 6860 / 7774 web3:// | Final / Draft / Draft | **Must** (IPSEITY does 5219) + add 7774 cache events | This is how the website is "minted" |
| ERC-7943 uRWA, ERC-7765 RWA privileges | Final (2025-06-10) / Draft (2024-08-20) | **Skip** | Compliance/RWA machinery; wrong product |

---

## 2. State of the art, family by family

### 2.1 Royalties and transfer control

**ERC-2981** (Final, created 2020-09-15; authors Burks, Morgan, Malone, Seibel) is one function and one interface id:

```solidity
function royaltyInfo(uint256 _tokenId, uint256 _salePrice)
    external view returns (address receiver, uint256 royaltyAmount);   // ERC-165: 0x2a55205a
```

The spec itself says why it cannot enforce anything: "It is impossible to know which NFT transfers are the result of sales, and which are merely wallets moving or consolidating their NFTs." Payment "must be voluntary". That sentence is the whole royalty debate in one line, and it has not changed since 2020.

**ERC-721C** is not an ERC. It is Limit Break's `creator-token-standards` library (MIT): `ERC721C` extends OpenZeppelin ERC-721 with "creator-definable transfer security profiles", every transfer consults a `CreatorTokenTransferValidator`, and the README explicitly warns the library "should NOT be used in any upgradeable contract". The security levels, verbatim from `src/Constants.sol`:

- `TRANSFER_SECURITY_LEVEL_RECOMMENDED = 0` — Operator Whitelist, no receiver constraints, OTC allowed
- `ONE = 1` — no constraints
- `TWO = 2` — Operator Blacklist, OTC allowed
- `THREE = 3` — Operator Whitelist, OTC allowed
- `FOUR = 4` — Operator Whitelist, OTC **not** allowed
- `FIVE = 5` — Operator Whitelist, receiver must have **No Code**, OTC allowed
- `SIX = 6` — Operator Whitelist, receiver must be **Verified EOA** (EOA Registry), OTC allowed
- `SEVEN = 7` — Whitelist + No Code + no OTC
- `EIGHT = 8` — Whitelist + Verified EOA + no OTC
- `NINE = 9` — "Soulbound Token, No Transfers Allowed"

Caller constraints: `NONE`, `OPERATOR_BLACKLIST_ENABLE_OTC`, `OPERATOR_WHITELIST_ENABLE_OTC`, `OPERATOR_WHITELIST_DISABLE_OTC`, `SBT`. Receiver constraints: `NONE`, `NO_CODE`, `EOA`, `SBT`.

Validator **V5** (Limit Break blog, 2025-05-05) added EIP-7702 delegate whitelists, "Whitelist Extension Contracts" (`isWhitelisted(address collection, address account)`), authorizer mode with amounts for AMM/Uniswap v4 hooks, modular rulesets ("up to 253 distinct rulesets", shipping with "vanilla, soulbound, blacklist and whitelist"), **automatic software updates by default** ("developers may opt out"), and a new default that disables OTC transfers from accounts with a 7702 delegate attached. V5 address: `0x721C008fdff27BF06E7E123956E2Fe03B63342e3`.

OpenSea's position (blog 2024-04-02, edited 2024-08-12; docs page last updated 2026-08-17): non-721C collections get "optional creator earnings" only; 721C collections can enforce via Seaport hooks and the `SignedZone` authorizer, which "hook[s] into a transfer validator contract set on the 721-C or 1155-C" and requires `FULL_RESTRICTED`/`PARTIAL_RESTRICTED` orders with SIP-7 `extraData`. Enforcement restricts sales to OpenSea and "marketplaces powered by LimitBreak's Payment Processor, which at time of writing includes Magic Eden". Magic Eden has since shut its EVM marketplace (Q1 2026, per its own statement quoted in the incident coverage below).

What the levels mean for us: at levels 5–8 the **receiver may not be a contract**. An NFT whose whole design is to be held by, and to hold, ERC-6551 accounts, consignment escrows, lease lockers and markets cannot live under those levels. Levels 0/3/4 are the only ones compatible with a composable token, and they reduce to "operator whitelist managed by an external, auto-updating contract". That is exactly the admin key the ANIMA and IPSEITY designs refuse to have.

### 2.2 On-chain traits, metadata, faces

**ERC-7496** (Draft, 2023-07-28; Montgomery, Ghods, 0age, Wenzel, Min) — key/value traits:

```solidity
event TraitUpdated(bytes32 indexed traitKey, uint256 tokenId, bytes32 traitValue);
event TraitUpdatedRange(bytes32 indexed traitKey, uint256 fromTokenId, uint256 toTokenId);
event TraitUpdatedRangeUniformValue(bytes32 indexed traitKey, uint256 fromTokenId, uint256 toTokenId, bytes32 traitValue);
event TraitUpdatedList(bytes32 indexed traitKey, uint256[] tokenIds);
event TraitUpdatedListUniformValue(bytes32 indexed traitKey, uint256[] tokenIds, bytes32 traitValue);
event TraitMetadataURIUpdated();
function getTraitValue(uint256 tokenId, bytes32 traitKey) external view returns (bytes32);
function getTraitValues(uint256 tokenId, bytes32[] calldata traitKeys) external view returns (bytes32[] memory);
function getTraitMetadataURI() external view returns (string memory);
function setTrait(uint256 tokenId, bytes32 traitKey, bytes32 newValue) external;
```

The spec's security section: "The set* methods exposed externally MUST be permissioned", and marketplaces "should verify onchain trait states at transfer time rather than relying on offchain state". The trait-metadata JSON carries a `validateOnSale` property per trait. IPSEITY already implements this (`Ipseity.sol` lines 569–602, `setTrait` is `onlyOperator(id)`) and registers id `0xaf332f3e` (that id is what the IPSEITY code registers; I did not independently confirm it against the spec text — **unverified**). Still Draft three years on; OpenSea's `redeemables` reference repo was **archived 2025-08-20**, so the editorial momentum is gone even though the interface is stable.

**SIP-15** (Seaport Improvement Proposal, Draft) is the half of 7496 that matters for a swap: a zone validates trait values at fulfilment and reverts with `InvalidDynamicTraitValue(address token, bytes32 traitKey, bytes32 expectedTraitValue, bytes32 actualTraitValue)`. Substandard 0: one token, many traits `(address token, uint256 tokenId, (bytes32 traitKey, bytes32 traitValue, uint8 comparisonEnum)[])`; substandard 1: many tokens, one trait each; substandard 2: many tokens, many traits. `comparisonEnum`: 0 eq, 1 neq, 2 lt, 3 lte, 4 gt, 5 gte. The purpose statement: "the value of traits changes the expected value of the NFT" between listing and execution.

**ERC-7508** (Draft, 2023-08-15; Pineda, Turk) is the RMRK alternative: a *public repository* at one address on every chain with typed getters/setters (`getUintAttribute`, `setStringAttribute`, batch and presigned variants), five access types (`Owner`, `Collaborator`, `OwnerOrCollaborator`, `TokenOwner`, `SpecificAddress`), id `0x212206a8`. It exists so legacy collections can gain attributes retroactively. We are not a legacy collection.

**ERC-8048** (Draft, 2025-09-30; Makeig, Abuawad) — `metadata(uint256 tokenId, string key) returns (bytes)` plus `MetadataSet(uint256 indexed tokenId, string indexed indexedKey, string key, bytes value)`. It is the string-keyed cousin of 7496 written for the agent-registry world (ERC-8122 builds on it). Worth watching, not worth two trait systems.

**ERC-7160** (Final, 2023-06-09; 0xG, Peyfuss) — `tokenURIs(id) returns (index, string[] uris, bool pinned)`, `pinTokenURI`, `unpinTokenURI`, `hasPinnedTokenURI`, events `TokenUriPinned`/`TokenUriUnpinned`, id `0x06e1bc5b`. IPSEITY uses it for the three faces (live instrument, SVG sigil, quartet) and the spec's own warning applies: "care should be taken when specifying access controls" for pinning.

**ERC-5773** (Final, 2022-10-10; RMRK) is the heavier multi-asset model (propose-commit `acceptAsset`/`rejectAsset`, `setPriority`, id `0x06b4329a`). It is required by ERC-6220 and is the reason to skip both: the propose-commit asset pipeline is a feature of a shared-authorship art platform, not of a single-collection protocol.

**ERC-4906** (Final, 2022-03-13) — `MetadataUpdate(uint256)` and `BatchMetadataUpdate(uint256,uint256)`, id `0x49064906`. Mandatory for anything whose `tokenURI` changes with state; IPSEITY has it.

**ERC-7572** (Draft, 2023-12-06; Finzer, Atallah, Ghods) — `contractURI() returns (string)` plus `ContractURIUpdated()`; JSON requires `name`, optionally `symbol`, `description`, `image`, `banner_image`, `featured_image`, `external_link`, `collaborators`. "The method name `contractURI()` was chosen based on its existing implementation in dapps." One security note worth repeating: dapps treat `collaborators` as admins.

### 2.3 Redeemables and privileges

**ERC-7498** (Draft, 2023-07-28; Ghods, 0age, Montgomery, Min) borrows Seaport's offer/consideration vocabulary:

```solidity
struct CampaignParams { uint32 startTime; uint32 endTime; uint32 maxCampaignRedemptions; address manager; address signer; }
struct CampaignRequirements { OfferItem[] offer; ConsiderationItem[] consideration; TraitRedemption[] traitRedemptions; }
struct TraitRedemption { uint8 substandard; address token; bytes32 traitKey; bytes32 traitValue; bytes32 substandardValue; }
function createCampaign(Campaign calldata campaign, string calldata metadataURI) external returns (uint256 campaignId);
function updateCampaign(uint256 campaignId, Campaign calldata campaign, string calldata metadataURI) external;
function redeem(uint256[] calldata considerationTokenIds, address recipient, bytes calldata extraData) external payable;
event Redemption(uint256 indexed campaignId, uint256 requirementsIndex, bytes32 redemptionHash, uint256[] considerationTokenIds, uint256[] traitRedemptionTokenIds, address redeemedBy);
```

The useful idea is the *trait redemption*: "a user does not have to burn an NFT in order to receive their redemption — 'redeeming' just changes one of the traits." The costly idea is the `manager`/`signer`/`updateCampaign` surface, which is an off-chain coordinator by construction. Only the former fits a server-less protocol.

**ERC-7765** (Draft, 2024-08-20; Mint Chain) — `exercisePrivilege(address _to, uint256 _tokenId, uint256 _privilegeId, bytes _data)`, `isExercisable`, `isExercised`, `getPrivilegeIds`, optional `privilegeURI`, event `PrivilegeExercised`. It is 7498's trait-redemption idea restated for RWAs. If we ever want "this token has N one-shot perks", this is the smaller interface; otherwise skip.

### 2.4 Rentals, roles, delegated use

**ERC-4907** (Final, 2022-03-11; Double Protocol) — `setUser(uint256 tokenId, address user, uint64 expires)`, `userOf(tokenId)` ("zero address indicates that there is no user or the user is expired"), `userExpires`, event `UpdateUser`, id `0xad092b5c`. Automatic expiry, owner keeps full control. IPSEITY's `Lease.sol` is built around it.

**ERC-5006** (Final, 2022-04-12) is the 1155 version (`createUserRecord`, `usableBalanceOf`, `frozenBalanceOf`, id `0xc26d96cc`). Irrelevant to a 721.

**ERC-7432** (Final, 2023-07-14; São Thiago, Lima) — deliberately "IS NOT an extension of ERC-721", so it can sit in the token or beside it:

```solidity
struct Role { bytes32 roleId; address tokenAddress; uint256 tokenId; address recipient; uint64 expirationDate; bool revocable; bytes data; }
function grantRole(Role calldata _role) external;
function revokeRole(address _tokenAddress, uint256 _tokenId, bytes32 _roleId) external;
function unlockToken(address _tokenAddress, uint256 _tokenId) external;
function setRoleApprovalForAll(address _tokenAddress, address _operator, bool _approved) external;
function recipientOf(address,uint256,bytes32) external view returns (address);
function roleData(address,uint256,bytes32) external view returns (bytes memory);
function roleExpirationDate(address,uint256,bytes32) external view returns (uint64);
function isRoleRevocable(address,uint256,bytes32) external view returns (bool);
function isRoleApprovedForAll(address,address,address) external view returns (bool);
// events RoleGranted, RoleRevoked, TokenLocked, TokenUnlocked, RoleApprovalForAll; ERC-165 0xd00ca5cf
```

`type(uint64).max` means permanent; `revocable=false` protects a renter from the owner; `data` is free-form. The spec's own guidance: "Always check the expiration date before allowing users to access the utility of an NFT" and NFT transfers by role operators "must be restricted to escrow contracts and back to original owners exclusively". ANIMA ships `IERC7432.sol` and uses roles for operators/guardians.

**ERC-7589** (Draft, 2023-12-28, same authors) is 7432 for ERC-1155 via `commitTokens` → `commitmentId` (id `0xc4c8a71d`). Skip.

**ERC-7858** (Final, 2024-01-04) — `expiryType()` (`BLOCKS_BASED`/`TIME_BASED`), `isTokenExpired`, `startTime`, `endTime`, event `TokenExpiryUpdated`, id `0x3ebdfa31`. Its "first, do no harm" rationale (expired tokens stay transferable, just unusable) and its security notes (prevent renewal by burn-and-remint; restrict who can move `endTime`) are directly reusable for any child "lease" or "session" token we issue.

### 2.5 State identity

**ERC-5646** (Final, 2022-09-11; Ashhab) — `getStateFingerprint(uint256 tokenId) external view returns (bytes32)`, id `0xf5112315`. Three MUSTs: different value when state changes, same value when it does not, and "MUST include all state properties that might change during the token lifecycle". The security section is the design brief for our vault: "If the `getStateFingerprint` implementation does not include all parameters that could change the token state, a token owner would be able to change the token state without changing the token fingerprint." ANIMA implements it by ABI-encoding the whole `AgentCore` struct, which is why its CLAUDE.md forbids reordering fields.

### 2.6 Composability: nesting, equipping, accounts, linked services

**ERC-7401** (Final, 2023-07-26; RMRK) fixes ERC-6059's interface-id mismatch and is otherwise "functionally equivalent": `Child {tokenId, contractAddress}`, `addChild` → pending, `acceptChild`, `rejectAllChildren(parentId, maxRejections)`, `transferChild(...)`, `nestTransferFrom(from, to, tokenId, destinationId, data)`, `childrenOf`, `pendingChildrenOf`, `directOwnerOf`, recursive `ownerOf`; id `0x42b0e56f`. "The parent NFT of a nested token and the parent's root owner are in all aspects the true owners of it." Its security section names the same fraud as 6551: "After the parent token is listed for sale, the seller might remove a child token just before the sale."

**ERC-6220** (Final, 2022-12-20; requires 5773 and 6059) — Catalog of `Fixed`/`Slot` parts with z-index, `equip`/`unequip`/`isChildEquipped`/`canTokenBeEquippedWithAssetIntoSlot`, ids `0x28bc9ae4` (equippable) and `0xd912401f` (catalog). The rationale ("Catalog allows for parts to be pre-verified") describes a composable-art pipeline, not a wallet.

**ERC-6551** (status text on the page: "in the process of being peer-reviewed", i.e. Review; created 2023-02-23; 17 authors) — registry at `0x000000006551c19487814612e58FE06813775758`, `createAccount`/`account(implementation, salt, chainId, tokenContract, tokenId)`; account must implement `token()`, `state()` ("SHOULD be modified each time the account changes state"), `isValidSigner` (magic `0x523e3260`). Two security sections are normative for us: *fraud prevention* ("Alice withdraws 10ETH from the token bound account, and immediately accepts Bob's offer" — attach "the current token bound account state" to orders) and *ownership cycles* ("All assets held in a token bound account may be rendered inaccessible if an ownership cycle is created"). Both IPSEITY (two accounts per token: the Reach and the receive-only Grip) and ANIMA (`AgentAccount`, called by eight contracts on settlement paths) are built on it. Tokenbound's docs describe `AccountV3` as "audited" but the page gives no auditor or report — **unverified**.

**ERC-7656** (Final, 2024-03-15; Sullo) generalises the 6551 factory: `create(implementation, salt, chainId, bytes12 mode, linkedContract, linkedId)` / `compute(...)`, modes `LINKED_ID` and `NO_LINKED_ID`, mainnet registry `0x76565d90eeB1ce12D05d55D142510dBA634a128F`. Same cycle warning. It is the right pattern if we ever want a *second* kind of linked service (e.g. a per-token messaging inbox contract) without inventing a new factory.

**ERC-7631** (Final, 2024-02-21; vectorized et al.) — ERC-20 `mirrorERC721()`, ERC-721 `baseERC20()`, optional `getSkipNFT`/`setSkipNFT`. The spec itself lists "rare NFT sniping" and "out-of-gas denial of service" as risks; the June 2026 Flooring Protocol / BitmapPunks incident (SlowMist: "BT404-style packed ownership logic vulnerability (malicious high-bit token ID alias + unchecked integer underflow)") is the field evidence.

### 2.7 Social and messaging

**ERC-6381** (Final, 2023-01-22) is superseded by **ERC-7409** (Final, 2023-07-26, same RMRK authors) because "the introduction of variation flags and emoji skin tones has rendered the `bytes4` namespace insufficient", so emoji became `string`. 7409: `emote`, `bulkEmote`, `emoteCountOf`, `bulkEmoteCountOf`, `hasEmoterUsedEmote`, `haveEmotersUsedEmotes`, `presignedEmote`, `bulkPresignedEmote`; id `0x1b3327ab`; the canonical repository is at `0x3110735F0b8e71455bAe1356a33e428843bCb9A1` (6381's was `0x31107354b61A0412E722455A771bC462901668eA`). "The proposal does not envision handling any form of assets from the user." It is a common-good singleton: no code to deploy, and reactions work across every collection on the chain.

**ERC-7627** (Final, 2024-02-19; Chen Liaoyuan) — `updatePublicKey(keyIndex, PublicKey)`, `sendMessage(to, keyIndex, sessionId, bytes encryptedMessage)`, `getUserPublicKey(user, keyIndex)`; `PublicKey { bytes public_key; uint64 valid_before; PublicKeyAlgorithm algorithm }` with `ECDSA | ED25519 | X25519`; events `MessageSent`, `PublicKeyUpdated`. Messages are **events**, which is exactly how IPSEITY's `Parley` works (logs with `prev` block pointers so clients walk history with single-block `eth_getLogs`). ANIMA's `AgentComms` prices attention on top.

**ERC-7231** (Final per secondary sources, created 2023; **status unverified** — I did not fetch the page) aggregates Web2/Web3 identities into one NFT. Noted, not recommended.

### 2.8 Non-transferability

**ERC-5484** (Final, 2022-08-17) — `enum BurnAuth { IssuerOnly, OwnerOnly, Both, Neither }`, `event Issued(from, to, tokenId, burnAuth)`, `burnAuth(tokenId)`, id `0x0489b56f`. **ERC-5192** (Final, 2022-07-01) — `locked(tokenId)`, `Locked`/`Unlocked`, id `0xb45a3c0e`. **ERC-6454** (Final, 2023-01-31) — `isTransferable(tokenId, from, to)`, id `0x91a6262f`, with the honest caveat that a contract "returns fraudulent values" if it wants to. IPSEITY implements 5192 and 6454 to *report* lock state rather than to be soulbound; that is the right use.

### 2.9 Client scripts and the on-chain web

**ERC-5169** (Final, 2022-05-03; Smart Token Labs) — `scriptURI() returns (string[])`, `setScriptURI(string[])`, `event ScriptUpdate(string[])`. Any RFC 3986 URI, so a `web3://` or `data:` URI is valid. Security: "Any user of the script learned from `scriptURI` MUST validate the script is either at an immutable location, its URI contains its hash digest, or it implements the separate `Authenticity for Client Script` EIP." A `web3://<our-contract>/...` URI is an immutable location by construction. **ERC-7738** (Draft, 2024-07-01) is the permissionless registry at `0x0077380bCDb2717C9640e892B9d5Ee02Bb5e0682` for contracts that lack 5169; we will have 5169, so it is optional.

**ERC-5219** (Final, 2022-07-10; Gavin John) — the read-only `request()` interface ("the only particularly relevant HTTP method is `GET`"). **ERC-6860** (Draft, 2023-09-29; Zhou, Pi, Wilson, Deschildre) is the `web3://` URL grammar (`web3://[userinfo@]contractName[:chainid]pathQuery[#fragment]`) with `resolveMode() returns (bytes32)`: `"auto"` or zero or revert → auto mode, `"manual"` → manual mode, and the 5219 mode that IPSEITY's `Premises` serves (its CLAUDE.md says never remove `resolveMode()` for this reason). **ERC-7774** (Draft, 2024-09-20; Deschildre, Wilson) adds `Cache-control: evm-events` and `event ClearPathCache(string[] paths)` so web3:// clients can cache aggressively and invalidate on chain events; its security section is the operational cost ("websites must properly implement cache invalidation events; otherwise, stale content will be served indefinitely").

### 2.10 The 2025–2026 wave: agent NFTs

**ERC-7857** (Final, created 2025-01-02; Wu, Zeng, Wu, Heinrich — 0G Labs) — `iTransfer(address _to, uint256 _tokenId, TransferValidityProof[] _proofs)`, `iClone(...)`, `authorizeUsage(tokenId, user)`, `revokeAuthorization`, `authorizedUsersOf`; `IERC7857DataVerifier.verifyTransferValidity(TransferValidityProof[])` with `AccessProof`/`OwnershipProof`; `IERC7857Metadata.intelligentDataOf(tokenId)`; events `Transferred`, `Cloned`, `Authorization`, `AuthorizationRevoked`, `PublishedSealedKey`. **No ERC-165 id is defined.** "Only hashes and sealed keys are stored on-chain, actual functional data must be stored and transmitted securely off-chain" via a "Sealed Executor" that is out of scope. IPSEITY's `Standards.sol` already argues all three points against claiming conformance; now that the ERC is Final the argument is stronger, not weaker, because a Final spec with off-chain normative dependencies is precisely what an all-on-chain token cannot honestly claim. MASTER-NFT-PROJECT's `PrivateMemoryHandover.sol` references 7857; it should be renamed in the merge.

**ERC-8004** (Draft, 2025-08-13; De Rossi, Crapis, Ellis, Reppel) — three registries. Identity is an ERC-721 with URIStorage: `register(string agentURI, MetadataEntry[] metadata) returns (uint256 agentId)`, `setAgentURI`, `getMetadata(agentId, key)`, `setMetadata`, `setAgentWallet(agentId, newWallet, deadline, signature)`. Reputation: `giveFeedback(agentId, int128 value, uint8 valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`, `revokeFeedback`, `appendResponse`, `getSummary`. Validation: `validationRequest(validator, agentId, requestURI, requestHash)`, `validationResponse(requestHash, uint8 response, ...)`. Security: "Sybil attacks are possible ... The protocol's contribution is to make signals public." The identity registry is a per-chain singleton; ANIMA implements `IERC8004` and the arXiv study "Can Trustless Agents Be Trusted?" (2606.26028, 2026) exists as an empirical survey of the live registries — I did not read it in full, so its numbers are **unverified** here.

**ERC-8217** (Draft, 2026-04-05; Makeig; requires 8004) — exactly the join we need: a per-chain singleton binding contract with `enum TokenStandard { ERC721, ERC1155, ERC6909 }`, `struct Binding { TokenStandard standard; address tokenContract; uint256 tokenId; }`, `bindingOf(uint256 agentId)`, `event AgentBound(...)`, and a reserved 8004 metadata key `agent-binding` holding the 20-byte binding-contract address. "The owner of the master NFT controls the bound ERC-8004 registration. When the master NFT is transferred, control follows automatically." Bindings are immutable after writing.

Also in flight (all **Draft or PR**, read from the ERCs repo and Magicians): **ERC-8041** (2025-10-11) fixed-supply agent collections with `getAgentMintNumber`/`getCollectionSupply` and a warning that "the owner of an ERC-8004 agent can modify or remove collection metadata stored on their agent at any time"; **ERC-8122** minimal agent registry on ERC-6909 + ERC-8048 + ERC-7930; **ERC-8126** (page says Final, created 2026-01-15; Cronian, Johnson) "primarily an off-chain standard" with optional `AgentVerified`/`AttestationPosted` events and `getLatestRiskScore(agentId)` (ANIMA ships the interface); **ERC-8170/8171** (PRs #1558/#1559, Feb 2026) "AI-native NFT" and "token bound agent registry"; PR #1851 (Jul 2026) source-token agent binding separating provenance (`getSourceNFT`) from live ownership (`isSourceNFTOwnershipValid`); ERC-8264/8269 agent memory rights (PR #1763). None of these is stable enough to build on; 8217 is the one whose shape is small enough to be safe.

**ERC-7943** uRWA (Final, 2025-06-10) — `canSend`/`canReceive`/`canTransfer`, `getFrozenTokens`, `forcedTransfer`, `setFrozenTokens`, NFT interface id `0xbf1ef5fe`. "Unauthorized access could lead to asset theft." It is a compliance control plane; the only part worth borrowing is the vocabulary split between account eligibility and transfer authorisation.

**ERC-6909** (Final, 2023-04-19; vectorized et al.) — `balanceOf(owner,id)`, `allowance`, `isOperator`, `transfer`, `transferFrom`, `approve`, `setOperator`, id `0x0f632fb3`; no callbacks ("Requiring callbacks unnecessarily encumbers implementors"), no mandated batching. Uniswap v4 uses it for claims; MASTER-NFT-PROJECT and Pixel-Garden both already reference it (126 and 115 mentions respectively).

---

## 3. What the leading projects do, with the numbers that exist

- **OpenSea**: ERC-7496/7498 + SIP-14/15 published August 2023; the reference `redeemables` repo archived 2025-08-20. ERC-7572 "has been a long-supported standard by OpenSea" (OpenSea Developers, Jan 2024). 721C enforcement live since 2024-04-02 for new contracts only; the fee-enforcement doc was still being maintained on 2026-08-17.
- **Limit Break**: Validator V5 since 2025-05-05 with auto-updating rulesets. Payment Processor V2 at `0x9A1D00bEd7CD04BCDA516d721A596eb22Aac6834` is **unpausable and permanently vulnerable** since 2026-09-24 (see §4). "Version 1.1 of the ERC721-C contract was released in May 2023" and "81% ... support" OpenSea's 721C decision are secondary-source claims — **unverified**. No count of 721C collections could be found from a primary source — **unverified**.
- **RMRK**: ERC-5773/6220/7401/7409 Final; Singular marketplace; adoption beyond RMRK's own ecosystem is anecdotal — **unverified**.
- **Tokenbound**: canonical 6551 registry, `AccountV3`, described as audited (no report linked on the page read).
- **Smart Token Labs**: ERC-5169 Final, ERC-7738 registry deployed at the same address across mainnets/L2s.
- **ERC-8004 ecosystem**: ERC-8217/8041/8122/8126 all written in the twelve months to Apr 2026; an arXiv empirical study of the live registries appeared in 2026.
- **Market context** (secondary, **unverified**): CryptoSlam/DappRadar figures quoted in press — 2024 NFT sales $8.83B; Q3 2025 18.1M sales / $1.6B with 2.14M unique trading wallets; 2026 year-to-date $546M across 10.1M sales as of the March 2026 reporting. Direction is clear even if the decimals are not: fewer dollars, more transactions, and the buyer base concentrated in utility.

What the four local repos already do (first-hand, from source):

| Repo | Standards actually implemented |
|---|---|
| IPSEITY | 721, 165, 173, 2981, 4906, 4907, 5192, 6454, 7572, 7160, 7496, 6551 (two accounts), 5219/6860 web3:// router; sealed kernel "inspired by 7857, deliberately NOT a conformance claim" |
| ANIMA | 721, 6551, 7432, 8004, 8126 (interface), 5646 (ABI-encoded `AgentCore`), rentable, transfer verifier, EIP-2535 diamond with no `diamondCut` |
| MASTER-NFT-PROJECT | references 721/1155/6551/1967/1271/6909/8004/4907/4626/4337/7857/2981/4906/5192/7432/6454/7572/5805/6492/5219/8126/5646/1363/7496 |
| Pixel-Garden | account-abstraction heavy: 7579, 7913, 6909, 1271, 1363, 4337, 4626, 2981, 7739, 7821, 7802, 7674 |

---

## 4. Security lessons and incidents (dated)

1. **Limit Break Payment Processor V2, 2026-09-24 onward** — attackers forged the ERC-2771-style "original sender" accepted from a trusted forwarder, so any wallet with a standing `setApprovalForAll`/WETH approval to PPv2 could be made to "sell" NFTs for zero or "buy" worthless ones. At least **$2.8M** stolen across Ethereum, Polygon, Base, Arbitrum, ApeChain; whitehats led by 0xQuit (Yuga Labs) used the same bug defensively to move **23,155 NFTs (~$5.7M)**; ~660 WETH not recovered. V2 "cannot be paused or fixed"; V3 paused everywhere except ApeChain (usable to 2026-11-30). Magic Eden had stopped using V2 in October 2024 and closed its EVM marketplace in Q1 2026; the approvals outlived both. 0xQuit also noted ERC721C/1155C holders "may be unable to claim because of transfer validator rules". Sources: revoke.cash exploit page, Dune dashboard `activeexploitlimitbreak`, Crypto Briefing 2026-09-25, NFT Culture 2026-09-28, Blockchain Breaches dossier 341. **Lessons for us**: (a) a settlement contract must derive the principal from `msg.sender`/signatures, never from forwarded calldata; (b) standing approvals are the attack surface, so approvals must be epoch-revocable (ANIMA's `revokeAllApprovals` keyed on `keccak256(owner, approvalEpoch[owner], operator)`) and ideally time-bound; (c) an immutable, unpausable rail is only acceptable if it holds no approvals — our market should pull with exact-value orders, as IPSEITY's `buy(agreed)` already does; (d) a transfer validator that can block a whitehat rescue is a liability, not a protection.
2. **Gondi "Sell & Repay" Purchase Bundler, 2026-03-09** — `buy` had "No msg.sender restriction – anyone could call it" and reused "lingering approvals from past interactions"; 78 NFTs (~$230K: 44 Art Blocks, 10 Doodles, SuperRare, Beeple) drained from wallets that never transacted. Same lesson as above, one order of magnitude smaller, six months earlier.
3. **Flooring Protocol V2 / BitmapPunks, 2026-06-08** — "BT404-style packed ownership logic vulnerability (malicious high-bit token ID alias + unchecked integer underflow)"; near-infinite mint of fractional tokens, pools drained, blue-chips extracted; 68 NFTs (>$500K) rescued via GrailsOTC (secondary; SlowMist lists the entry). **Lesson**: dual-nature/fractional packing (ERC-7631 family) is where arithmetic bugs become NFT theft; keep the launchpad's ERC-20/6909 accounting separate from token ownership.
4. **SuperRare, 2025-07-28** ($730K, "Incorrect permission check in updateMerkleRoot") and **The Idols, 2025-01-14** ($324K) per SlowMist: permission checks on admin setters, again.
5. **ERC-6551 spec-level risks** (not incidents): drain-then-sell fraud and ownership cycles. ANIMA's CLAUDE.md records the mitigations (`lockCount`/`disputeCount` block transfer; `_update` revokes operators, guardian, lease, policy); IPSEITY's `IpseityAccount` *measures* balances around sealed calls instead of enumerating assets.
6. **ERC-7401's** identical warning about removing a child before sale; **ERC-7496's** "verify onchain trait states at transfer time"; **ERC-5646's** "must include all parameters". Three specs, one bug: state that is not in the order is state the seller can change.
7. **ERC-5169's** script-authenticity rule and the Medium critique "more scripts, more vulnerabilities": a scriptURI pointing anywhere mutable is phishing infrastructure; pointing at `web3://` of an immutable contract is not.
8. **Validator V5's** auto-update default and 7702 delegate policy: rules under a collection can change without the collection's holders signing anything. That is the governance model ANIMA's design explicitly rejects ("buyers' guarantees are worth exactly as much as the admin key that could remove them").

---

## 5. Recommendations for our token, with rationale

**MUST**

1. **ERC-5646 state fingerprint over everything the buyer is paying for** — traits (7496), roles (7432), both 6551 accounts' `state()`, lock/dispute counters, sealed-kernel hashes, lease state. Make the market's `buy`/`fill` take the fingerprint and revert on mismatch. This single primitive answers the 6551 fraud, the 7401 child-removal fraud, the 7496 trait front-run, and SIP-15, without Seaport. ANIMA's `AgentCore` encoding is the starting point; it must be extended to include the vault's `state()` (today `AgentMarket.sol` does not read the fingerprint — a gap).
2. **ERC-6551** with a cycle guard (refuse `transferFrom(to == account(id))` and refuse a TBA receiving its own token) and `state()` bumped on every execute. Keep IPSEITY's receive-only second account; it is the vault that cannot be drained because no spend path exists.
3. **ERC-7432 roles as the single delegation model**, with a derived **ERC-4907 shim** (`userOf(id) = recipientOf(this, id, USER)`, `userExpires = roleExpirationDate`) for games and rental marketplaces. Encode session-key caps (expiry, spend, target/selector allowlists, as IPSEITY's `grantSession` does) in the role's `data`. Roll roles with the approval epoch on sale (ANIMA invariant 1).
4. **ERC-7496 traits + ERC-4906 events + ERC-7572 contractURI + ERC-7160 faces**, all as `data:`/on-chain JSON — the website has nothing else to read. Keep `setTrait` behind `onlyOperator` and mark value-bearing traits `validateOnSale` in the trait metadata so Seaport-style venues can protect orders with SIP-15.
5. **ERC-5219 + ERC-6860 `resolveMode()` + ERC-7774 cache events** for the site. Emit `ClearPathCache` from the token on trait/face/role changes so web3:// gateways can cache the ~100 KB face-0 document.
6. **ERC-5169 `scriptURI()` returning the token's own `web3://` URL** (and the `data:` face as fallback). It is the cheapest standard in this survey and the only one that tells a wallet "this token's app lives here" without a server. Immutable location satisfies 5169's authenticity rule.
7. **ERC-2981** as a signal; no in-contract enforcement. Document that our own swap/market honours `royaltyInfo` and others may not.
8. **Approval hygiene as a first-class feature**: epoch-keyed approvals (ANIMA), exact-value orders (IPSEITY), no forwarder/2771 trust in any settlement path, and a one-click "revoke everything" verb in the console. This is the direct answer to Sep 2026.

**SHOULD**

9. **ERC-8004 via ERC-8217 binding**: register an agent id in the chain's 8004 registry at mint (or lazily), write `agent-binding` to our per-chain binding contract, and let `ownerOf(masterId)` control the agent. Do not make our token *be* the registry — 8004 is a singleton and we want our own supply, bands and immutability. ERC-8041's fixed-supply pattern can be satisfied by our own `getCollectionSupply`.
10. **ERC-7409 emotes** by simply pointing the site at the canonical repository; zero bytes in our contract, cross-collection reactions for free.
11. **ERC-7627 event shape for DMs** inside the Parley log-walk design: `PublicKeyUpdated` from the token's Reach account (X25519 preferred), `MessageSent(from, to, keyIndex, sessionId, bytes)` as the log, `prev` pointers kept for indexer-free history.
12. **ERC-6909** for launchpad allocations and pool claims (Uniswap v4 compatible, no callbacks); ERC-20 only for the launched tokens themselves. Keep fractional ownership of the NFT out of scope (see 7631 below).
13. **Keep the sealed kernel under its own name**; add a one-line `supportsInterface`-less note in docs that it is "7857-inspired". Reuse 7857's two security rules we agree with: bind proofs to `(tokenId, recipient)` and force re-seal on the next update after a ZK transfer.

**COULD**

14. **ERC-7498 trait redemptions** (substandard-only, no campaign manager) for perks: redeeming flips a 7496 trait, never burns.
15. **ERC-7858 expiry** on any child lease/session token we issue; **ERC-5484** `BurnAuth.OwnerOnly` for a soulbound messaging/identity badge minted to the Reach.
16. **ERC-7656** if a second linked service (e.g. per-token inbox) is wanted later; it is the generalised 6551 factory and already deployed.
17. A **minimal in-contract transfer policy** (operator allowlist with holder opt-in, soulbound mode via 5192) if a 721C-like guarantee is wanted — written by us, immutable, no external validator, never a receiver-is-EOA rule.

**AVOID**

18. **ERC-721C / CreatorTokenTransferValidator** as a dependency: external upgradeable policy with auto-updates, receiver constraints hostile to contract custody, and a vendor rail (Payment Processor) that is now the largest NFT incident of 2026.
19. **ERC-7631 dual-nature pairing** of the NFT itself; **ERC-6220/5773/7401/7508/7589/7943/7765/7738** for size and relevance reasons given above.
20. **Claiming ERC-7857 or ERC-8126 conformance.** Both are off-chain-normative; 8126's own text says it "is primarily an off-chain standard".

Size note: the ANIMA monolith is 605 bytes under EIP-170 and IPSEITY's `DeskTerm` is at ~97%. Every "adopt" above that is not already present (5169, 7774 events, 4907 shim, 8217 binding) is a handful of functions; put 8217's binding and 7409's calls in the site/desks, not the token.

---

## 6. Special ideas

1. **Fingerprint-bound everything.** Make `getStateFingerprint(id)` the order id for the swap, the consignment, the lease, and the launchpad allocation. A buyer signs the fingerprint; the contract recomputes it at settlement. Nothing in the ecosystem does this uniformly; SIP-15 does it for traits only, 6551 suggests it for account state only.
2. **The token announces its own app (5169 → web3://).** `scriptURI()` returns `web3://<token>:<chainId>/token/<id>/live`. TokenScript-aware wallets open the on-chain site; everyone else gets the `data:` face. No standard in this survey is both Final and this cheap.
3. **A fourth face: the agent card.** ERC-7160 face 3 = the ERC-8004 registration file (`type: .../eip-8004#registration-v1`, `services`, `x402Support`, `supportedTrust`) rendered from chain, so the token is simultaneously an artwork, a wallet and a discoverable agent.
4. **Reactions and DMs with zero new bytes in the token.** Emotes via the canonical 7409 repository; DMs as 7627 events from the Reach account; both walked by the existing log-pointer client.
5. **Roles that carry capabilities.** 7432 `data` = ABI-encoded session policy (expiry, cap, targets, selectors). A renter's role *is* their session key; expiry is enforced by `roleExpirationDate` and the account checks it on every call.
6. **Approval epochs the site can show.** Expose `approvalEpoch(owner)` and a "burn all approvals" button; show every live operator with its grant date, the way the Dune/revoke.cash dashboards had to reconstruct after the PPv2 incident.
7. **Cache-aware on-chain site.** `ClearPathCache(["/token/<id>/live"])` on every state change makes a 100 KB document cacheable at web3:// gateways; nobody has shipped 7774 with a token-level app yet.
8. **Lease and session tokens as 7858 expirables** minted to the renter, so wallets display an expiry and `isTokenExpired` is one read.
9. **Trait-redeemable perks that never burn** (7498 substandard semantics) for launchpad whitelist slots, messaging credits, or swap-fee rebates.
10. **A `lastSettledFingerprint` trait** written by our own market at each sale, giving provenance of *state* as well as of ownership.

---

## 7. Open questions

1. ERC-7496, 7498, 7572, 6860, 7774, 8004 and 8217 are still Draft on 2026-10-02. Do we pin to their current interface ids and accept the risk of a late rename, or publish our own ids alongside?
2. Now that ERC-7857 is Final, is there commercial pressure to claim it, and would a "7857-compatible verifier adapter" (same selectors, on-chain data) be honest? IPSEITY's three objections still stand.
3. Contract size: which of 5169, the 4907 shim and 7774 events fit in the monolith, and which must move to a facet/companion? ANIMA's diamond fixture will refuse an unrouted selector, which is useful here.
4. Do we want any marketplace-side enforcement at all (a self-written operator allowlist), given it is exactly the kind of rule that blocked whitehat rescues in Sep 2026?
5. Cross-chain id bands (IPSEITY) plus 6551 "phantom account" collisions: should the binding/registry contracts refuse `chainId != block.chainid`?
6. Which payment asset does the swap quote in — native, ERC-20, or 6909 claims — and does the royalty signal apply to 6909 settlements?
7. Who verifies the visitor on the website: `ownerOf`, `isValidSigner` on the Reach (ERC-1271 from the TBA), or a 7432 role? Probably all three, in that order of privilege.
8. The arXiv ERC-8004 study (2606.26028) and Tokenbound's audit were not read in full; both should be before the agent-binding and account-implementation decisions are final.

---

## 8. Sources (read 2026-10-02 unless dated)

EIP texts: eips.ethereum.org/EIPS/eip-2981, -4906, -4907, -5006, -5169, -5192, -5219, -5484, -5646, -5773, -6220, -6381, -6454, -6551, -6860, -6909, -7160, -7401, -7409, -7432, -7496, -7498, -7508, -7572, -7589, -7627, -7631, -7656, -7738, -7765, -7774, -7857, -7858, -7943, -8004, -8041, -8048, -8126, -8217. ERCs repo: ercs.ethereum.org/ERCS/erc-8122; PRs #1558, #1559, #1648, #1763, #1774, #1851.
Limit Break: github.com/limitbreakinc/creator-token-standards (README, `src/Constants.sol`, `src/utils/TransferPolicy.sol`); medium.com/limit-break "Introducing Transfer Validator V5" (2025-05-05).
OpenSea: docs.opensea.io/docs/creator-fee-enforcement (updated 2026-08-17); opensea.io/blog "Creator earnings: ERC721-C Compatibility on OpenSea" (2024-04-02, ed. 2024-08-12); github.com/ProjectOpenSea/SIPs SIP-15; github.com/ProjectOpenSea/redeemables (archived 2025-08-20).
Incidents: revoke.cash/exploits/magic-eden; dune.com/pn_/activeexploitlimitbreak; cryptobriefing.com (2026-09-25); nftculture.com (2026-09-28); blockchainbreaches.com dossier 341 (2026-09-24); dev.to/cryip Gondi report (2026-03-11); hacked.slowmist.io NFT category.
Other: docs.tokenbound.org/contracts/account; ethereum-magicians.org threads for 7496, 7432, 8126, 8171, 8217; press summaries of CryptoSlam/DappRadar (unverified numbers).
