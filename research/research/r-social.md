# On-chain and decentralised messaging and social layers — research for the unified NFT protocol

Researcher brief, dated 2026-10-02. Topic: what a crypto-social layer *inside* an NFT should contain, and how to keep it fully on chain with no server, no IPFS and no indexer. Method: 25 web searches, 31 primary or near-primary pages fetched (EIP texts at eips.ethereum.org, protocol documentation, GitHub READMEs and source, RFC text, dated press), plus a read of the four repositories' existing messaging code (`Parley.sol`, `ParleyPort.sol`, `AgentComms.sol`, `EncryptionKeyRegistry.sol`, `SocialCartridge.sol`, and the MASTER repo's `FORWARD-SECURE-COMMONS.md`). Every numbered claim below names its source and date; where a figure could only be found in secondary press it is flagged **(unverified)**. No EIP number, address or date in this document is invented; where I could not confirm one I wrote "unverified".

---

## 0. Executive summary

1. **No leading social protocol is actually "all on chain".** XMTP keeps ciphertext on its own node network with 60-day retention and only settles group/identity metadata to an L3; Farcaster stores identity on OP Mainnet and everything else on Snapchain; Lens v3 stores the graph and feed pointers on Lens Chain but the content itself in Grove, referenced by `contentURI`. The project goal (metadata, app, graph, messages, reactions and attestations all served from the chain the token lives on) is therefore *more* on chain than any of them, and the four repos already contain the two hardest pieces: an indexer-free log walk (`Parley`) and a real RFC 9420 MLS transport over ordered on-chain delivery (MASTER's `MLSGroupChat`).
2. **The ecosystem has converged on three spam-economics primitives**: rent (Farcaster storage units, $7 per year for 5,000 casts), payer-side metering (XMTP, about $5 per 100,000 messages in USDC), and stake-plus-ZK rate limiting (Waku/RLN). An NFT is a natural fourth: *holding the token is the stake*. Combine it with per-token rate limits and refundable postage for unsolicited DMs (already in `AgentComms`) and there is no moderation server to run.
3. **Three Final ERCs give us free, chain-agnostic interoperability at fixed singleton addresses**: ERC-7409 emotes (`0x3110735F0b8e71455bAe1356a33e428843bCb9A1`, supersedes ERC-6381), ERC-5564 stealth announcer (`0x55649E01B5Df198D18D95b5cc5051630cfD45564`) with the ERC-6538 meta-address registry (`0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538`), and EAS attestations (predeployed at `0x4200000000000000000000000000000000000021` on Base and OP Mainnet). Using them instead of home-grown equivalents means other wallets and explorers already understand our reactions, private sends and credentials.
4. **Encrypt-to-a-published-key (ECIES) has no forward secrecy, and every repo's own documentation says so.** The right split is: ECIES/HPKE for one-shot sealed envelopes and stealth deliveries; MLS (RFC 9420) for conversations that must survive a later key compromise. The MASTER repo already proved the second works over an immutable on-chain delivery contract; that is the differentiator worth keeping.
5. **The "mint a website, connect wallet, prove you hold it" flow needs no server**: Sign-In with Ethereum (ERC-4361, Final) is a message format, not a service. The page served from chain issues a nonce it generates itself, the wallet signs, the page verifies locally (ECDSA, or ERC-1271 for smart wallets, ERC-6492 for counterfactual ones), then reads `ownerOf`, the ERC-6551 account and any session-key grant to decide what to unlock. Every repo already has the authorisation predicate (`Parley.mayActAs`, ANIMA `isController`, `SocialCartridge.Auth` with custody epochs); the unified design should pick one and make it the single truth.

---

## 1. State of the art, protocol by protocol

### 1.1 XMTP — MLS messaging, moving to a fee-based decentralised network

**What it is.** XMTP v3 is a Rust implementation (LibXMTP) of the IETF Messaging Layer Security protocol, RFC 9420. The RFC (July 2023, Proposed Standard) specifies "efficient asynchronous group key establishment with forward secrecy (FS) and post-compromise security (PCS) for groups in size ranging from two to thousands" using TreeKEM (datatracker.ietf.org/doc/rfc9420, fetched 2026-10-02). XMTP's documentation states LibXMTP received a security assessment from NCC Group in December 2024, that identities are *inboxes* (`InboxID`) to which multiple wallets can be associated by signature — EOAs, smart-contract wallets and ERC-4337 accounts explicitly — and that consent preferences (allowed / unknown / denied) are kept on device and synced across apps (docs.xmtp.org/chat-apps/intro/what-is-xmtp, fetched 2026-10-02).

**Decentralisation and economics.** The decentralisation page (xmtp.org/decentralization, fetched 2026-10-02) describes a *broadcast network* where every node holds a full copy of all messages with a default 60-day retention, plus an *L3 appchain* for encrypted group/identity metadata that settles to Base. Phase 1 is a permissioned node set chosen by a Security Council with jurisdictional limits ("no more than 3 node operators can be headquartered in the same legal jurisdiction"); Phase 2 moves to stake-weighted elections; Phase 3 is permissionless. The page gives mainnet as "expected March 2026" and reports "over 150 million messages" processed on testnet. The fee page (docs.xmtp.org/fund-agents-apps/calculate-fees) is explicit that **end users pay nothing; apps and agents (payers) pay in USDC**, with a base per-message fee, a per-byte-day storage fee and a congestion fee, worked out to "approximately $5 per 100,000 messages" at 1 KB average and 90-day retention. Secondary press puts the testnet launch at 6 February 2025 with Coinbase Wallet, Circle, ENS, Alchemy and a16z as early node providers, and claims 2.2 million identities and 1 billion messages by January 2025 **(unverified; paragraph.com/@xmtp_community, blog posts)**. The node count for mainnet appears as "7 permissioned nodes" on the decentralisation page summary and "at least 20 node operators" in a search summary of the same page; I could not reconcile the two, so treat the count as **unverified**. Coinbase's Base App (the rebranded Coinbase Wallet, beta from 16 July 2025) ships XMTP end-to-end encrypted chat with AI agents in DMs and group chats **(secondary; cointelegraph/tradingview, unverified)**.

**What matters for us.** (a) The security bar is now "MLS, audited"; anything we call "private" that is only ECIES to a static key will be compared against it. (b) XMTP's own answer to "fully on chain" is *no*: messages live on nodes with a retention window, and only metadata settles. (c) Consent lists are a client-side spam defence that costs nothing on chain and we can copy directly (a per-token allow/deny list is one mapping). (d) Their 60-day expiry is a reminder that log-only archives are a feature, not a limitation: a chain keeps logs for as long as the chain exists.

### 1.2 Farcaster — identity on chain, data on Snapchain, Mini Apps as the app surface

**Contracts.** Farcaster's documentation (docs.farcaster.xyz/learn/architecture/contracts, fetched 2026-10-02) lists three OP Mainnet contracts: `IdRegistry` at `0x00000000fc6c5f01fc30151999387bb99a9f489b` (creates accounts, "fids"; transfer and a recovery address that "can transfer the account at any time"), `StorageRegistry` at `0x00000000fcce7f938e7ae6d3c335bd6a1a7c593d` (rents storage for ETH, price adjusted via a Chainlink oracle), and `KeyRegistry` at `0x00000000fc1237824fb747abde0ff18990e59b7e` (adds and removes app keys, EdDSA, so apps post on a user's behalf without the custody key).

**Storage units are the spam economics.** The messages page (docs.farcaster.xyz/learn/what-is-farcaster/messages) states one storage unit costs **$7 per year** and holds **5,000 casts, 2,500 reactions, 2,500 links (follows), 50 profile-data entries and 50 verifications**; over the limit "the oldest message is pruned to make space for the new one"; expired storage has a 30-day grace period; deleted messages become tombstones that still count until pushed out; messages timestamp against the Farcaster epoch (2021-01-01) and are rejected if more than 15 minutes in the future. This did not stop the bot wave: after opening to the public on 29 January 2024 behind a one-time $5 fee, the network "was already being swarmed with bots" within weeks and Vitalik Buterin commented publicly on spam (DL News, 18 February 2024). The proposed answers were client-side filters, NFT-gated Frames and proof-of-personhood — i.e. the *clients* ended up doing the work the rent was meant to do.

**Snapchain.** The Snapchain docs (snapchain.farcaster.xyz/llms-full.txt, fetched 2026-10-02) describe a Tendermint-style BFT chain with account-level sharding (shard 0 for blocks plus two message shards in the examples), a ">9000 TPS" target to support "2 million daily users", five message types (casts, reactions, links, user data, username proofs), per-unit limits in the node's own units (e.g. "Casts: 77,000 … Verifications: 400" per storage unit in the example configuration), pruning of non-epoch blocks after a week, mirroring of OP Mainnet registration/signer/rent events, gRPC on 3383 and HTTP on 3381, and **a validator set of 6 (5 run by Neynar, 1 by Uno)** in the fetched docs. Press dates the Hubs-to-Snapchain cutover to April 2025 **(unverified)**. Note the contrast: the social *data* network is a six-validator chain run mostly by one company; only the identity layer has Ethereum's security.

**Mini Apps.** The Mini Apps specification (miniapps.farcaster.xyz/docs/specification, fetched 2026-10-02) is the current "app inside a social client" surface: a manifest at `/.well-known/farcaster.json` whose `accountAssociation` is a JSON Farcaster Signature (base64 header/payload/signature signed by the account's custody or auth address) proving a domain belongs to an fid; a `<meta name="fc:miniapp">` embed tag (3:2 image, button action); an SDK with `ready`, `signIn` (Sign In with Farcaster), `addMiniApp`, `openUrl`, `viewProfile`, `viewCast`, `sendToken`, `swapToken`, `viewToken`, `composeCast`; an **EIP-1193 Ethereum provider** handed to the iframe; and a notification system where the host stores a per-(fid, app) token and the app's server POSTs to a `notificationUrl`, with host-side dedup on (fid, notificationId), 24-hour validity and a rate limit of roughly one per 30 seconds per token. Mini Apps are *hosted by the developer*, not by Farcaster — the exact dependency our project exists to remove, but the embed/manifest shape is worth mirroring so a token's on-chain page can be *framed* by Farcaster clients (section 10).

### 1.3 Lens v3 and Lens Chain — the "everything on chain" social graph

Lens Chain went live on **4 April 2025** on a ZKsync Elastic Chain with Avail data availability, Grove for content storage and Aave's GHO as the gas token; the migration moved "125 GB of storage logs, 650K user profiles, 28M social connections and 12M+ posts" from Lens v2 on Polygon (Avail blog, dated at launch; Lens raised $31M in December 2024 per the same post). Lens v3 (github.com/lens-protocol/lens-v3, GPL-3.0, fetched 2026-10-02) is organised as unopinionated *core* primitives — Feed, Graph, Group, Namespace (usernames), Account, App — plus *Rules* ("restrictive extension[s] of the Protocol" with hooks such as `processFollow` and `processCreatePost`) and *Actions* (tipping, collect). `createPost` takes `contentURI`, `repostedPostId`, `quotedPostId` and `repliedPostId`; follows live in a Graph contract; apps can *sponsor* transactions (lens.xyz/docs/protocol). The honest reading: the *graph* and *post pointers* are on chain, the *bytes* are in Grove, and the chain is an app-specific L2 with its own DA layer. The rule/action split, however, is the cleanest published model of "token-gated follow", "paid follow", "collect" and "tip" as pluggable hooks, and it maps directly onto what our rooms need (section 6).

### 1.4 Push (formerly EPNS) — a cautionary pivot

Push's documentation (push.org/docs, fetched 2026-10-02) still lists three products — Push Chain, Notifications, Chat — and states Push Chat remains supported (its example app "BRB Chat is powered by Push Chat"). But the company's energy since late 2024 is in **Push Chain**, a Layer-1 "universal apps" chain; its own blog reports the Donut testnet with "15M+ transactions across 400k+ active addresses, secured by 35+ validators" and "over 25 universal apps" **(push.org/blog/push-rewards-program, page undated; year unverified)**, and the docs reference testnet only, with no mainnet date. Lesson: a notifications/chat protocol whose business model needed a token ended up building a chain; a *feature inside an NFT* has no such pressure, and should not design for one.

### 1.5 Waku and Rate-Limiting Nullifiers — spam economics without identity

Waku uses GossipSub for routing and **RLN** (a zk gadget from Ethereum Foundation's PSE group; rate-limiting-nullifier.github.io/rln-docs) for spam protection. The founding design (research.logos.co/rlog/rln-relay, 5 March 2021) is: register an identity commitment `pk = H(sk)` in a Merkle tree via a smart contract while locking a deposit ("~$30 USD at time of writing"); publish at most **one message per epoch** (epoch ≈ one second of UTC time, ±20 s tolerance); attach to every message a ZK proof of membership plus a Shamir share of your secret derived from `(sk, epoch)`; **two shares in one epoch reconstruct the secret**, so anyone can slash the spammer's deposit. Proof generation fell from ~10 minutes to ~0.5 s with a 3.9 MB prover key. Open issues in that article remain true: storage linear in group size, expensive insertions, and "multiple registrations enable bypassing rate limits at financial cost". As of the September 2025 update (blog.waku.org, published 1 October 2025) the RLN membership contract is still being hardened on **Sepolia**. For us RLN is the reference for *anonymous* rate limiting; because our posters are identified by a token, we can get the same bound with a plain `lastPost[token]` check (as `SocialCartridge.roomPolicy.cooldown` already does) and spend zero gas on proofs.

### 1.6 Ethereum Attestation Service — credentials and "verified" badges

EAS is two contracts: a `SchemaRegistry` and `EAS` with `attest(AttestationRequest)`, `multiAttest`, `revoke`, `attestByDelegation` (EIP-712, gasless) and off-chain timestamping/revocation; a schema may name a **resolver** (`ISchemaResolver`) that can gate attestations and attach payments atomically. Deployed addresses from the repository README (github.com/ethereum-attestation-service/eas-contracts, fetched 2026-10-02): Ethereum mainnet `0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587` (v0.26), **Base and OP Mainnet predeploy `0x4200000000000000000000000000000000000021`** (v1.0.1), Arbitrum One `0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458`. Adoption figures seen in explorer summaries — "9.5 million attestations, 450,000 attesters"; Base 3,465,775 attestations across 1,893 schemas; Optimism 1,317,667 across 822 schemas — are **unverified** (easscan is JS-rendered and I did not fetch it). Coinbase issues "Verified Account", "Verified Country" and "Coinbase One" attestations on Base via EAS under `verifications.coinbase.eth` (Blockworks/CryptoSlate, **unverified**). Point: a token's page can show "this holder is Coinbase-verified" with one `eth_call` to a predeploy, no indexer.

### 1.7 Nostr NIP-17/44/59 — the metadata-hiding reference design

Nostr is not on chain, but its DM design is the clearest public spec for *hiding who talks to whom*: a kind-14 unsigned "rumor" is NIP-44-encrypted into a kind-13 **seal** signed by the real sender, then encrypted again into a kind-1059 **gift wrap** signed by a random one-time key; `created_at` is randomised "up to two days in the past" in both layers; one wrap is produced per recipient *and one for the sender* so a client can rebuild its own history; recipients publish a kind-10050 relay list and senders may only post there; the spec says groups over 10 participants "should find a more suitable messaging scheme" (nips.nostr.com/17, draft, updated 2026-06-13). On a public chain the *submitter address* is always visible, so full gift-wrap privacy needs a relayer or a stealth address (section 4.4); but the sender-copy trick and the randomised timestamp are free to adopt.

### 1.8 friend.tech — what "SocialFi" taught

friend.tech generated at least $20 million in developer fees during its 2023 surge, but only about $60,000 in protocol fees after June 2024; on **8 September 2024** the team transferred contract ownership to the null address, freezing the system and ending development (The Block, 8 September 2024). Two lessons. First, a social layer whose only verb is "buy a key to read a chat" is a market with a chat attached, and the market's half-life was about a year. Second, renouncing ownership was the *good* ending — the keys kept working — which is exactly the property the four repos already insist on (IPSEITY's "no diamondCut", Parley "never redeploy"). Build immutability in from the first block; do not plan to renounce later.

---

## 2. Standards inventory — exact interfaces

All statuses and dates below are from the EIP text at eips.ethereum.org fetched on 2026-10-02.

**ERC-5564 Stealth Addresses — Final, created 2022-08-13.**
```solidity
event Announcement(uint256 indexed schemeId, address indexed stealthAddress,
                   address indexed caller, bytes ephemeralPubKey, bytes metadata);
function announce(uint256 schemeId, address stealthAddress,
                  bytes memory ephemeralPubKey, bytes memory metadata) external;
```
Singleton `0x55649E01B5Df198D18D95b5cc5051630cfD45564` (CREATE2). Scheme id 1 = secp256k1 with view tags; the view tag is the most significant byte of the hashed shared secret and lets a recipient discard ~255/256 of announcements before an EC multiplication. Sender: ephemeral key, `s = p_eph · P_view`, `P_stealth = P_spend + hash(s)·G`. Recipient: `p_stealth = p_spend + hash(s)`. Security notes: 124-bit privacy margin because of the tag; the announcer can be spammed (no profit for the attacker, so the text suggests staking or tolls); the stealth address must never be funded from a traceable account.

**ERC-6538 Stealth Meta-Address Registry — Final, created 2023-01-24.**
```solidity
function registerKeys(uint256 schemeId, bytes calldata stealthMetaAddress) external;
function registerKeysOnBehalf(address registrant, uint256 schemeId, bytes memory signature,
                              bytes calldata stealthMetaAddress) external;   // EIP-712 or ERC-1271
function stealthMetaAddressOf(address registrant, uint256 schemeId) external view returns (bytes memory);
function nonceOf(address registrant) external view returns (uint256);
function incrementNonce() external;
event StealthMetaAddressSet(address indexed registrant, uint256 indexed schemeId, bytes stealthMetaAddress);
```
Singleton `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538`. Security: a compromised registrant "must quickly deregister". Umbra v2 (ScopeLift, 6 May 2024) and Fluidkey build on both; Umbra's tweet announcing finalisation is from July 2024 **(secondary)**.

**ERC-7409 Public Non-Fungible Token Emote Repository — Final, created 2023-07-26; supersedes ERC-6381** because `bytes4` could not hold skin-tone and variation sequences, so emoji are `string`. Functions: `emote`, `bulkEmote`, `emoteCountOf`, `bulkEmoteCountOf`, `hasEmoterUsedEmote`, `presignedEmote`, `prepareMessageToPresignEmote`; event `Emoted(emoter, collection, tokenId, emoji, on)`. Singleton `0x3110735F0b8e71455bAe1356a33e428843bCb9A1` on every network. Security: chain-specific domain separator against replay; presigned emotes are re-activatable until their deadline, so keep deadlines short.

**ERC-5630 encryption/decryption — Draft, created 2022-09-07.** Two RPCs, `eth_getEncryptionPublicKey(account)` returning a compressed secp256k1 point and `eth_performECDH(account, ephemeralKey)` returning the 32-byte shared secret; recommended ECIES is ANSI X9.63 KDF with SHA-512, HMAC-SHA-256, AES-256-CBC. It deliberately reuses the signing key for encryption and **offers no forward secrecy**. MetaMask's legacy `eth_getEncryptionPublicKey`/`eth_decrypt` (x25519-xsalsa20-poly1305) is the only widely shipped wallet encryption API; neither is something a browser page can rely on across wallets. Conclusion: derive encryption keys in the page from a wallet *signature* (deterministic `personal_sign` over a fixed domain string, HKDF to X25519/P-256), publish the public key on chain, and never assume the wallet can decrypt.

**ERC-7627 Secure Messaging Protocol — Final, created 2024-02-19.**
```solidity
enum PublicKeyAlgorithm { ECDSA, ED25519, X25519 }
struct PublicKey { bytes public_key; uint64 valid_before; PublicKeyAlgorithm algorithm; }
function updatePublicKey(bytes32 _keyIndex, PublicKey memory _publicKey) external;
function sendMessage(address _to, bytes32 _keyIndex, bytes32 _sessionId, bytes calldata _encryptedMessage) external;
function getUserPublicKey(address _user, bytes32 _keyIndex) external view returns (PublicKey memory);
event MessageSent(address indexed from, address indexed to, bytes32 indexed keyIndex, bytes32 sessionId, bytes encryptedMessage);
event PublicKeyUpdated(address indexed user, bytes32 indexed keyIndex, PublicKey newPublicKey);
```
It is thin — no rate limit, no forward secrecy, address-keyed rather than token-keyed — but it is Final and cheap to be *compatible with*: a token's inbox can expose this interface as a view over its own storage so generic ERC-7627 clients can read our key and send to it.

**ERC-7866 Decentralised User Profiles — created 2025-01-22, in review (not Final).** Soulbound profile with `createProfile(username)`, default and per-dApp avatars with visibility, `did:<chain>:<address>` identifiers. Do not claim it.

**ERC-6239 Semantic Soulbound Tokens** (RDF triples in metadata) and **ERC-7231 Identity-aggregated NFT** (binding web2/web3 identities to a token) exist and are listed at eips.ethereum.org; neither has visible adoption in the protocols above and I do not recommend either. "ERC-7529" returned nothing relevant to social graphs — do not cite it.

**ERC-4361 Sign-In with Ethereum — Final, created 2021-10-11.** Message fields `domain`, `address`, `statement`, `uri`, `version` ("1"), `chain-id`, `nonce` (≥8 alphanumerics), `issued-at`, optional `expiration-time`, `not-before`, `request-id`, `resources`. Contract accounts verify through ERC-1271, whose result "can return different results for the same inputs depending on blockchain state", so sessions must be bound to the *address* and invalidated when 1271 state changes; wallets "MUST prevent phishing attacks by verifying the origin of the request against the `scheme` and `domain` fields".

**ERC-6551 and ERC-7656 Generalized Contract-Linked Services — 7656 Final, created 2024-03-15**, factory `0x76565d90eeB1ce12D05d55D142510dBA634a128F` on mainnet, `create(salt, chainId, mode, linkedContract, linkedId)` / `compute(...)`, `mode` = `LINKED_ID` for NFTs. This is the standard way to attach *non-account* services (an inbox, a reputation ledger) to a token at a deterministic address — relevant if the unified protocol wants per-token social state at a CREATE2 address instead of in a shared mapping.

**RFC 9420 MLS — Proposed Standard, July 2023.** FS and PCS for groups of 2 to thousands, log-depth TreeKEM, asynchronous. The MASTER repo runs cipher suite `MLS_128_DHKEMP256_AES128GCM_SHA256_P256 (0x0002)` via `ts-mls` 1.6.4 — and records that `ts-mls` "has not undergone a formal security audit".

---

## 3. Log-only messaging and reading it without an indexer

Every log-only design has the same two problems: *writing* is cheap and *finding* is miserable. The EVM gas schedule (standard, not re-verified here) charges a `LOG` 375 gas plus 375 per topic plus 8 per data byte, versus 16 gas per non-zero calldata byte (EIP-2028) and 20,000+ per fresh storage word; a 1 KB message in a log is on the order of 10k gas of data, which is why Parley caps `MAX_BODY` at 1,024 bytes and `SocialCartridge` at 2,048.

**The Parley back-link is the right primitive, and it is already measured.** `Parley.Said(room, from, prev, prevFrom, seq, kind, body)` carries the *block number* of the previous message in the room and the previous message by the same token; the room stores only `last`. A client reads one word, then issues single-block `eth_getLogs` calls — "the narrowest request `eth_getLogs` accepts" — and walks backwards with no range scan. The cost is one warm `SSTORE` per message. `ParleyPort` shows the pattern surviving federation: arriving messages are re-emitted under the port's own event with the back-link rewritten for the local chain. Ethscriptions (June 2023) are the other pure-calldata archive model; their own site concedes indexers "provide a convenient way to interpret and organize data" even though calldata is the source of truth — i.e. without a back-link you *will* end up with an indexer.

**Storage-array variant.** `SocialCartridge` instead stores `Post[]` per room and `uint256[] mail` per token, paginated by index. That costs far more to write but gives `postAt(room, i)` reads with zero log queries and no block walk; it is the right choice for *small, high-value* records (DM envelopes capped at 4,096 bytes, key announcements, retirements), and the wrong one for a commons.

**Recommendation for the unified design:** events with back-links for public speech (commons, groups, follows, reactions), storage for sealed DMs and keys, and *both* indexed by the token id, never by address, so a sale moves the archive with the token. Add two things Parley lacks: a per-token `lastSpoke` back-link **per room kind** so "my DMs" and "my posts" are separate walks, and a `uint64 prevGlobal` pointer in the room struct that lets a client fetch the N newest messages across *all* rooms the token is in with one walk (today it must ask each room's `last`).

---

## 4. Encryption: keys, envelopes, forward secrecy, and who can see what

### 4.1 Key registries — the repos already have three, pick one

| Repo | Contract | Key type | Bound to | Epoch semantics |
|---|---|---|---|---|
| Most-Advanced | `Parley.announce(token, x, y)` | uncompressed P-256 | token; `_sealOwner` records publisher | transfer makes old key unavailable to sealing clients |
| Cutting-edge (ANIMA) | `EncryptionKeyRegistry.setEncryptionKey(keyType, publicKey)` | typed: X25519=1, secp256k1-ECIES=2, P-256-ECIES=3, ML-KEM-768=4 | *address* (a person, not a collection) | `keyIdOf` = keccak of key; sealed transfer reverts if recipient has none |
| Pixel-Garden | `SocialCartridge.announceKey` | 65-byte P-256, versioned | token + custody epoch | compare-and-swap version; old-epoch keys unusable for new deliveries |

The best of each: ANIMA's **typed keys** (so a post-quantum KEM can be added without a redeploy — the docs already anticipate ML-KEM-768), Pixel-Garden's **custody-epoch binding** (a key published by a previous owner is dead the moment the token moves, enforced on chain at `whisper` time via `expectedEpoch`/`expectedKey`), and ANIMA's **"pin the key id in the send"** rule (`sendPrivate(..., expectedRecipientKeyId)` reverts with `EncryptionKeyChanged` if the key rotated in the mempool, so the chain never records an undecryptable message). Expose the result through the ERC-7627 view functions for interoperability.

### 4.2 Envelopes — what the repos do, and the honest limits

Pixel-Garden's whisper is the most carefully specified: fresh ephemeral P-256 ECDH, HKDF-SHA-256, AES-256-GCM with random IVs, associated data binding protocol version, chain, kernel, instance, both token ids, both custody epochs and both key versions, **separate recipient and sender copies**, plaintext ≤1,024 bytes, envelope ≤4,096 bytes, duplicates rejected by digest. Its own doc says: "Ciphertext, participants and timing are public. This design does not provide forward secrecy if a historical recipient key is later compromised." ANIMA's `AgentComms` deliberately keeps ciphertext *off* chain (only `keccak256(ciphertext)` and a transport URI) — right for an agent protocol riding XMTP or Waku, wrong for ours.

### 4.3 Forward secrecy — MLS over ordered on-chain delivery (already built)

The MASTER repo's `FORWARD-SECURE-COMMONS.md` documents a working design: `MLSGroupChat` is "an immutable ordered delivery contract" that verifies nothing cryptographic; it enforces wallet authorisation, invitation consent, one-use KeyPackages, a 32-member roster cap, manager authority for roster changes, expected epoch and packet index, and size bounds, and it snapshots the admitted signing-key fingerprints in every commit so a Welcome can be checked against the on-chain roster. The client runs real RFC 9420 (`ts-mls` 1.6.4), binds AAD to chain id, contract, group id, packet index, epoch, kind and submitting wallet, requires two confirmations before applying packets, and treats a reorg as "freeze the group" rather than "restore erased keys". It also records what is *not* protected: "Wallet identities, membership, senders, timing, packet order, encrypted metadata and approximate sizes remain publicly observable." That is the state of the art for on-chain FS/PCS and nobody in section 1 has shipped it on a public chain; it should be the unified protocol's "private group" primitive, with ECIES whispers reserved for one-shot messages to someone you have never spoken to (the first-contact problem MLS cannot solve without a KeyPackage).

### 4.4 Hiding the recipient — stealth deliveries

For a message whose *existence* must not link two tokens, use ERC-5564: the sender derives a stealth address from the recipient's ERC-6538 meta-address, posts the sealed envelope to a room keyed by that stealth address (not the token id), and calls `announce` on the singleton with the ephemeral key and a view tag in `metadata`. The recipient scans `Announcement` logs (filterable by view tag at ~99.6% rejection), derives the key and reads the room. The sender's address is still on the transaction; only a relayer, a stealth-funded sender account, or an ERC-4337 bundler hides it. Register the token's meta-address on the ERC-6538 singleton (keyed by the token's ERC-6551 account address, via `registerKeysOnBehalf` with the account's ERC-1271 signature) so *any* 5564 wallet — Umbra, Fluidkey — can already pay or write to the token privately.

### 4.5 Deriving keys without wallet support

Because ERC-5630 is still Draft and `eth_decrypt` is MetaMask-only, every repo derives the social key in the page and backs it up encrypted (Pixel-Garden: PBKDF2-SHA-256 at 310,000 iterations, AES-256-GCM, scope-bound; MASTER: PBKDF2-HMAC-SHA256 at 600,000 iterations, IndexedDB compare-and-set). Keep that, and add the ANIMA rule that a *sealed transfer* reverts unless the buyer has published a key — otherwise the buyer receives ciphertext nobody can open.

---

## 5. Spam economics — what to charge, and what to make free

| Mechanism | Who | Numbers | On-chain cost to us |
|---|---|---|---|
| Rent / storage units | Farcaster | $7/yr → 5,000 casts, 2,500 reactions, 2,500 links; oldest pruned | none if we cap by *count per token* |
| Payer metering | XMTP | ~$5 per 100k messages, USDC, paid by apps not users | n/a (no nodes) |
| Stake + ZK rate limit + slashing | Waku/RLN | 1 msg/epoch (≈1 s), deposit ~$30 (2021), 2 shares → slash | heavy (proof verification) |
| Refundable postage | ANIMA `AgentComms` | recipient sets `postage`, `replyWindow` 5 min–30 d; escrow returned if unanswered; `maxPostage` bound so a recipient cannot raise the price mid-mempool | one escrow per unsolicited DM |
| Room cooldown | Pixel-Garden `roomPolicy.cooldown` | per-token `lastPost` | one `SSTORE` per post |
| Consent lists | XMTP | allow / unknown / deny, on device | a mapping per token, or purely client-side |
| Paid / gated follow | Lens Rules | `processFollow` hook | one hook call |

The NFT changes the calculus: **holding the token is already the stake**, so a per-token cooldown gives the RLN guarantee with no proof, and Farcaster's bot wave (one $5 fee per account, then unlimited posts) does not apply if the posting unit is a 4,096-token edition with a secondary-market price. The remaining vector is *unsolicited DMs between holders*, and `AgentComms`'s refundable postage is the best published answer: spam costs the spammer, ignoring paid mail costs the recipient, and no one moderates. Sanity check from the ERC-5564 text: the stealth announcer can be spammed because "no monetary benefit can be obtained" — an attacker burning gas to annoy is the only case money does not already solve, and a per-token rate limit covers it.

---

## 6. Graph, reactions, attestations — reuse the singletons

**Follows.** Farcaster models a follow as a *link* message counted against storage; Lens as a Graph entry subject to Rules. On chain, a follow is one warm `SSTORE` plus a log with a back-link (`prevFollow` per follower, `prevFollower` per followee) so both "who I follow" and "who follows me" are single-block walks. Add Lens-style hooks only where they earn their gas: a `followRule` per token that is either *open*, *holders only* (the cheapest sybil defence we have), or *paid* (postage to the followee's ERC-6551 account).

**Reactions.** Do not write a reaction store. Call the ERC-7409 singleton at `0x3110735F0b8e71455bAe1356a33e428843bCb9A1` with `(collection, tokenId, emoji)`; it is already deployed on every network at the same address and marketplaces/RMRK tooling read it. For reactions to *posts* rather than tokens, use `emote` on a synthetic id — `uint256(keccak256(room, seq))` — under our collection address; our page knows how to decode it and generic clients harmlessly see emotes on a non-existent token id. (Pixel-Garden's `reaction[room][post][garden] = bytes32` is the in-house alternative; it works but nobody else can see it.)

**Attestations and badges.** Read EAS at the OP-stack predeploy `0x4200000000000000000000000000000000000021` for third-party credentials (Coinbase verification, Optimism badges) and *write* our own attestations there — "token A vouches for token B", "delivered on a WorkEscrow job", ANIMA's ERC-8004-style reputation — with a resolver that only accepts attestations signed by a token's controller. A chain without the predeploy (Ethereum mainnet uses `0xA1207F…`, Arbitrum `0xbD75…`) needs the address in the page's per-chain config, which the site already has for everything else; a chain with no EAS at all should degrade exactly like `ConsoleRead` (try/catch plus `extcodesize`).

**Identity text.** Keep Pixel-Garden's rule that display names are validated UTF-8 (rejecting overlong, surrogate and out-of-range sequences) and escaped at render; keep IPSEITY's `Web.esc` / `textContent`-only rule. The one literal `z<-z2+c` that "once broke every thumbnail" is the whole argument.

---

## 7. "Connect a wallet, prove you hold it" with no server

The page is served from `tokenURI` / `web3://`; there is nowhere to keep a session, so authentication is *local*:

1. The page generates a nonce from `crypto.getRandomValues` and builds an ERC-4361 message with `domain` = the page's own origin (for a `data:` URI the SDK must pin a fixed, documented string — this is an open question, section 11), `chain-id`, `uri`, `issued-at`, short `expiration-time`, and `resources` naming the token (`eip155:<chain>:<contract>/<id>`).
2. The wallet signs (`personal_sign`). The page verifies: ECDSA recover for EOAs; `isValidSignature` via ERC-1271 for contract wallets (the three repos already implement 1271 in `IpseityAccount`, `GardenAccount`, `AgentAccount`); ERC-6492 for not-yet-deployed smart accounts (ANIMA has `libraries/ERC6492.sol`).
3. The page then asks the chain who the signer *is* for this token: `ownerOf(id)`, the ERC-6551 `account(id)`, and any session-key grant (`IpseityAccount.grantSession` — expiry, spend cap, target and selector allowlists; ANIMA session keys "may never sign ERC-1271", a rule worth keeping for social actions too). The social contract's own predicate must agree exactly with what the page shows, otherwise the UI promises what the chain refuses — `Parley.mayActAs` (owner or the token's account, **not** the renter) and `SocialCartridge.Auth` (owner, custody epoch, activation epoch; "ordinary ERC-721 operators cannot post") are the two existing answers, and both exclude operators and renters on purpose: "a reputation is not a thing you can hand back at the end of the day".
4. Everything the page unlocks after that is a *write* the wallet will sign separately, so the SIWE signature is only a UX gate; the chain is the authority. That is why no server is needed and also why the gate can be bypassed by anyone with a wallet — which is fine, because the contract will revert.

Because ERC-1271 can change with chain state (ERC-4361 text), re-run step 3 on every account/network change — Pixel-Garden already discards keys on "wallet/network changes, page exit and explicit Lock".

---

## 8. Security lessons and incidents

- **Farcaster, February 2024**: paid onboarding ($5 one-time) did not stop bots; clients had to add filters and NFT-gated Frames (DL News, 18 Feb 2024). Rent per account is weaker than cost per *post*.
- **friend.tech, 8 September 2024**: ownership renounced to `0x0…0` after fees fell to ~$60k since June 2024; token fell sharply (The Block). Immutable from day one beats renounced later.
- **XMTP**: NCC Group assessment of LibXMTP, December 2024 (docs.xmtp.org); I found **no public incident** in 2024–2025 (searched; absence is not proof).
- **Push**: no incident found; the risk is *product*, not exploit — the chat protocol is now a side product of an L1 still on testnet.
- **Lens**: no incident found; the April 2025 migration moved 125 GB off Polygon, showing the operational cost of "content on a storage layer" when the chain changes.
- **ERC-6538**: a compromised key owner must deregister fast or lose future stealth receipts — mirror this with "revoke key" being permissionless-for-owner and cheap (both ANIMA and Pixel-Garden have it).
- **ERC-7409**: presigned emotes replay until deadline — if we accept presigned social actions (gasless reactions via a sponsor), keep deadlines minutes, not days.
- **ERC-5564**: announcer spam is possible; the standard's own suggestion is staking or tolls on the *app* layer.
- **ERC-4361**: domain-bound phishing defence depends on the wallet comparing origin to `domain`; for a chain-served page the origin is a gateway hostname or a `data:` URI, so the `statement` must spell out the token and the action in human text, and the page must never ask for a signature it does not need.
- **Farcaster app keys**: I **could not verify** any specific 2024 signer-phishing incident; the structural risk is that a delegated key is a standing authority until removed on chain — identical to our session keys, which must stay bounded (expiry, selectors, spend cap) and owner-revocable.
- **Our own repos' recorded hazards**: `ts-mls` unaudited (MASTER); "no forward secrecy if a historical recipient key is later compromised" (Pixel-Garden); "a pair is addressed, and addressed is not the same as private" (Parley); the renter must not be allowed to speak (Parley); an array a stranger can grow is an array a stranger can fill (Parley `_seen`); keys must be epoch-bound or a seller keeps reading the buyer's mail (Pixel-Garden, ANIMA `_update` clears policy/lease/guardian on sale).

---

## 9. Recommendations for our project

**MUST**
1. **Unify on one authorisation predicate** — owner or the token's ERC-6551 account, never a renter or a bare ERC-721 operator; session keys allowed only for the actions their grant names. Sources: `Parley.mayActAs`, `SocialCartridge.Auth`, ANIMA invariant 1 (sale revokes all authority). Rationale: three repos, three predicates, one bug surface.
2. **Public speech as back-linked logs; sealed speech as bounded storage** (section 3). Keep `MAX_BODY` ≈ 1 KB and the single-block `eth_getLogs` walk; add per-kind back-links. Rationale: this is the only published indexer-free read pattern that has survived a public RPC.
3. **One typed, epoch-bound key registry per token** exposing the ERC-7627 view, with `expectedKeyId` pinned in every sealed send (section 4.1). Rationale: prevents undecryptable mail and seller-reads-buyer.
4. **MLS (RFC 9420) over an immutable ordered-delivery contract for private groups**, as already built in MASTER; ECIES/HPKE one-shot whispers only for first contact. Say in the docs, as XMTP and MASTER do, exactly which metadata stays public. Rationale: it is the one thing no on-chain social layer has shipped.
5. **Use the singletons**: ERC-7409 for reactions, ERC-5564/6538 for stealth deliveries and private receipts, EAS predeploy for credentials. Rationale: same address every chain, interoperable today, zero bytes of our EIP-170 budget.
6. **Spam economics = holding the token + per-token cooldown + refundable postage for unsolicited DMs** (section 5). No moderation server, no token.
7. **SIWE-shaped local login** (section 7) with ERC-1271/6492 support and re-verification on account or chain change.

**SHOULD**
8. Register each token's ERC-6551 account on the ERC-6538 registry at mint (or lazily on first key publish) so existing stealth wallets can reach it.
9. Lens-style *rules* on follows and room entry (open / holders-only / paid), but as fixed enum policies, not pluggable contracts — pluggable hooks are an upgrade path, and we do not have those.
10. Store a sender copy of every sealed envelope and randomise nothing on chain (timestamps are block times anyway) but let the client fuzz display times, following NIP-17's reasoning.
11. Expose a Farcaster Mini App-compatible embed (`fc:miniapp` meta plus a manifest route on the web3:// surface) so a token page can be *framed* inside Warpcast/Base App without hosting anything — the manifest's `accountAssociation` can be signed by the token's 6551 account.

**COULD**
12. Attach per-token social state at an ERC-7656 deterministic address instead of shared mappings, so each token's inbox is its own contract that can be `extcodesize`-probed and read generically.
13. A commons federated over LayerZero (ParleyPort already does this for room 0 only, with the back-link rewritten on arrival) — keep its rule that groups and pairs never cross chains.
14. ML-KEM-768 hybrid envelopes once WebCrypto exposes it; ANIMA's `KEY_TYPE_ML_KEM_768 = 4` already reserves the slot. XMTP markets "quantum-resistant hybrid encryption" for its stored copies, so expect the question.

**AVOID**
15. Any off-chain transport (XMTP topics, Waku content topics, HTTPS URIs) as the *only* home of a message — `AgentComms`'s commitment-only path is right for agents and wrong for "everything inside the NFT".
16. RLN-style ZK rate limiting on chain: verification gas and prover-key downloads (3.9 MB) buy anonymity we do not need, because the poster is a token.
17. Claiming ERC-7866, ERC-6239 or ERC-7231 conformance; claiming "forward secrecy" for anything ECIES-based (Pixel-Garden's doc is the template for how to phrase the limit).
18. A social token, key market, or any fee that funds a team — the friend.tech curve.
19. An admin, delegate, upgrade or `diamondCut` anywhere in the social contracts (all four repos agree; `ParleyPort` even refuses peer mutation).

---

## 10. Special ideas — what would make this NFT stand out

1. **The inbox that ships with the token.** On transfer, the social contract rolls the custody epoch, kills the seller's key, and the buyer's page shows an empty, provably-fresh inbox plus the *public* archive the token accrued — the reputation moves, the mail does not. No protocol in section 1 has transferable social identity with sealed history that cleanly severs.
2. **Reactions readable by every wallet on every chain** (ERC-7409 singleton) — a token page can show "💎 × 412" and OpenSea-class tooling sees the same count.
3. **Stealth mail to a token.** Anyone with Umbra or Fluidkey can already send privately to the token's 6551 account if we register an ERC-6538 meta-address; extend the same ephemeral-key mechanism to *messages*, and the token has a drop box whose use leaves no public link between sender and recipient.
4. **Forward-secret groups whose transcript is on chain but whose keys are gone** — the MASTER repo's "two confirmations, reorg freezes the group, 16 cancelled drafts force a rekey" discipline is a genuinely new UX; expose it as "sealed room" with a visible epoch counter.
5. **Vouch attestations with teeth.** A token writes an EAS attestation about another token through a resolver that requires a bond from the vault (section 4 of the broader project); a false vouch is slashable through the existing dispute path. Credentials become economically accountable, which Coinbase-style attestations are not.
6. **Priced attention as a feature, not a tax.** The holder sets postage and reply window on the page; strangers pay to be read and are refunded if ignored; the postage lands in the token's own vault. It is `AgentComms` for humans, and the vault/swap sections of the project make the money immediately useful.
7. **Mini App framing without a server.** A Farcaster or Base App user opens the token page from a cast; the manifest and embed are served by `web3://` through any gateway; the `accountAssociation` is signed by the 6551 account. The token is its own app store listing.
8. **Message retention is forever by construction** (XMTP's is 60 days by default, Farcaster prunes at the storage cap, Nostr relays forget) — advertise it, and let the client walk exactly as far back as the holder wants.

---

## 11. Open questions

1. **SIWE `domain` for a chain-served page.** ERC-4361 binds the signature to an origin; a `data:` URI has none and a `web3://` gateway hostname varies. Candidate: a fixed `domain` string of the form `<collection>.eth` plus `resources` naming chain and token, and a `statement` that says exactly what is being proven. Needs a decision and a wallet-compatibility test.
2. **Where sealed envelopes live.** Storage (SocialCartridge, 4,096-byte cap, direct `whisperAt` reads) versus logs (Parley, cheaper, block-walk reads). Measure both on the target L2s before choosing.
3. **MLS first contact.** A sealed group needs a KeyPackage from each member; the first message to a stranger cannot be MLS. Is the ECIES whisper acceptable for that, or should every token pre-publish a KeyPackage at mint (cost: one-use material that must be rotated)?
4. **`ts-mls` is unaudited** and `LibXMTP` is Rust/WASM-sized; is a WASM build of an audited MLS library viable inside the engine's byte budget (the MASTER bundle is ~151 kB; IPSEITY's whole document is ~104 kB)?
5. **ERC-7409 for post reactions** uses a synthetic token id under our collection address; confirm no marketplace treats emotes on non-existent ids as an error, and confirm the singleton exists on every target chain (it is CREATE2, but someone must have deployed it there).
6. **EAS availability per chain**: the `0x4200…0021` predeploy exists on OP-stack chains; verify for each chain in the id-band partition and define the degrade path.
7. **Metadata privacy ceiling.** Sender address and timing are public on any chain; a relayer or 4337 bundler is a server by another name. Decide whether "stealth" means recipient-only privacy (achievable) or full unlinkability (not without infrastructure), and write it down the way XMTP and MASTER do.
8. **Federation scope.** ParleyPort federates only the commons; with five chains, do follows and reactions also stay local, and does a token's social score then differ per chain by design?
9. **Unverified numbers to confirm before quoting in docs**: XMTP identity/message totals and mainnet node count; EAS totals; Push Chain figures; Snapchain April 2025 cutover date.

---

## Sources (fetched 2026-10-02 unless noted)

- ERC-5564 Stealth Addresses — https://eips.ethereum.org/EIPS/eip-5564 (Final; created 2022-08-13)
- ERC-6538 Stealth Meta-Address Registry — https://eips.ethereum.org/EIPS/eip-6538 (Final; created 2023-01-24)
- ERC-7409 Public NFT Emote Repository — https://eips.ethereum.org/EIPS/eip-7409 (Final; created 2023-07-26; supersedes ERC-6381 https://eips.ethereum.org/EIPS/eip-6381)
- ERC-5630 encryption/decryption — https://eips.ethereum.org/EIPS/eip-5630 (Draft; created 2022-09-07)
- ERC-7627 Secure Messaging Protocol — https://eips.ethereum.org/EIPS/eip-7627 (Final; created 2024-02-19)
- ERC-7866 Decentralised User Profiles — https://eips.ethereum.org/EIPS/eip-7866 (in review; created 2025-01-22)
- ERC-7656 Generalized Contract-Linked Services — https://eips.ethereum.org/EIPS/eip-7656 (Final; created 2024-03-15)
- ERC-4361 Sign-In with Ethereum — https://eips.ethereum.org/EIPS/eip-4361 (Final; created 2021-10-11)
- ERC-6239 / ERC-7231 / ERC-7093 — https://eips.ethereum.org/EIPS/eip-6239, …/eip-7231, …/eip-7093 (listing only)
- RFC 9420 MLS — https://datatracker.ietf.org/doc/rfc9420/ (Proposed Standard, July 2023)
- XMTP: what it is — https://docs.xmtp.org/chat-apps/intro/what-is-xmtp ; decentralisation — https://xmtp.org/decentralization ; fees — https://docs.xmtp.org/fund-agents-apps/calculate-fees ; testnet launch (secondary) — https://paragraph.com/@xmtp_community/xmtp-launches-testnet-building-the-worlds-most-secure-decentralized-messaging-network (Feb 2025); March 2025 roadmap — https://paragraph.com/@xmtp_community/xmtp-march-2025-community-update-and-roadmap
- Farcaster: contracts — https://docs.farcaster.xyz/learn/architecture/contracts ; messages/storage — https://docs.farcaster.xyz/learn/what-is-farcaster/messages ; overview — https://docs.farcaster.xyz/learn/architecture/overview ; Snapchain — https://snapchain.farcaster.xyz/llms-full.txt ; Mini Apps spec — https://miniapps.farcaster.xyz/docs/specification ; bot wave — https://www.dlnews.com/articles/web3/farcaster-users-could-use-frames-and-nfts-to-stop-bots/ (2024-02-18)
- Lens: v3 source — https://github.com/lens-protocol/lens-v3 ; protocol docs — https://lens.xyz/docs/protocol ; Lens Chain launch — https://blog.availproject.org/lens-chain-goes-live-scaling-socialfi-with-avail-and-zksync/ (April 2025)
- Push: docs — https://push.org/docs/ ; rewards/usage (undated) — https://push.org/blog/push-rewards-program/ ; L1 announcement (secondary) — https://www.theblock.co/post/330507/protocol-push-layer-1
- Waku / RLN: RLN-relay design — https://research.logos.co/rlog/rln-relay/ (2021-03-05); RLN docs — https://rate-limiting-nullifier.github.io/rln-docs/ ; Waku September 2025 update — https://blog.waku.org/waku-monthly-update-september-2025/ (2025-10-01)
- EAS: contracts and addresses — https://github.com/ethereum-attestation-service/eas-contracts ; docs — https://docs.attest.org/ ; adoption (unverified) — https://base.easscan.org/ , https://optimism.easscan.org/
- Nostr NIP-17 — https://nips.nostr.com/17 (draft; updated 2026-06-13)
- friend.tech renounce — https://www.theblock.co/post/315172/friend-tech-team-renounces-control-of-smart-contracts-following-stagnant-growth (2024-09-08)
- Umbra v2 architecture — https://scopelift.co/blog/introducing-umbra-v2-architecture (2024-05-06)
- Ethscriptions — https://ethscriptions.com/about
- Repository sources: `/home/user/Most-Advanced-NFT-Possible/src/Parley.sol`, `src/ParleyPort.sol`; `/home/user/Cutting-edge-technologically-advanced-NFT/contracts/comms/AgentComms.sol`, `contracts/core/EncryptionKeyRegistry.sol`; `/home/user/Pixel-Garden/src/cartridges/SocialCartridge.sol`, `docs/SOCIAL-IDENTITY.md`; `/home/user/MASTER-NFT-PROJECT/docs/FORWARD-SECURE-COMMONS.md`
