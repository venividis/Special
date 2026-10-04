# Privacy, compliance and chain economics for a fully on-chain NFT protocol

Research report, 2026-10-03. Topic brief: RAILGUN and shielded execution; stealth addresses (ERC-5564/6538); Privacy Pools; OFAC/Tornado lessons; private-messaging legality; 2026 cost tables for SSTORE2 data on Ethereum mainnet, Base, Arbitrum and OP; L2 fee structure after blobs; roadmap items (Pectra/EIP-7702, Fusaka, Glamsterdam, Hegotá); data-availability choices; and a chain recommendation for the merged protocol (one ERC-721 = swap + messaging + launchpad + vault + a website served from chain).

Method: 36 web searches and 47 pages fetched, of which the load-bearing ones are primary (EIP texts at eips.ethereum.org, the Fifth Circuit opinion PDF, the FinCEN 2019 guidance PDF, Treasury's delisting release, RAILGUN and Privacy Pools documentation and Solidity sources, OP Stack and Arbitrum fee docs, L2BEAT). Every numeric claim below names its source and date. Claims I could only find in secondary press are marked **(secondary)**; claims I could not verify at all are marked **unverified**. One limitation: a live read of the chains' fee oracles (OP-stack `GasPriceOracle`, Arbitrum `ArbGasInfo`) through the Blockscout connector was denied by the session's permission layer, so the L2 L1-data-fee figures are computed from the published formulas with illustrative scalars rather than measured; this is flagged where it matters.

---

## 0. Executive summary

1. **Privacy is now a wallet-layer concern on Ethereum, not a protocol one.** The two live, audited, compliance-aware shielded systems are RAILGUN (UTXO notes, Groth16, $110.8M TVL on L2BEAT's privacy page, Ethereum + Arbitrum + Polygon + BSC, a Base deployment approved by governance) and 0xbow's Privacy Pools (mainnet since March 2025, Entrypoint `0x6818…6b46`, ETH pool `0xF241…9fB`, ~$6M volume / ~1,500 users by late 2025, ASP allowlist with a trustless `ragequit`). The Ethereum Foundation's Kohaku SDK (May 2026) wraps both plus stealth addresses for any wallet. **Our NFT should integrate these rails through adapters, never re-implement a mixer.**
2. **Stealth addresses are standardised and deployed everywhere**: ERC-5564 (Final) announcer singleton `0x55649E01B5Df198D18D95b5cc5051630cfD45564`, ERC-6538 (Final) registry singleton `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538`, both CREATE2-deterministic on all chains. Umbra has processed >350,000 transactions / ~$500M since 2021 (ScopeLift, Feb 2026). This is the cheapest, lowest-risk privacy feature we can give a token's vault.
3. **The legal line in 2025–26 is drawn between immutable software and operated services.** Fifth Circuit (*Van Loon*, 26 Nov 2024): immutable smart contracts are not "property" and cannot be sanctioned. Treasury delisted Tornado Cash (21 Mar 2025). FinCEN's 2019 guidance §4.5.1(b): "an anonymizing software provider is not a money transmitter." But: Samourai's founders got 5 and 4 years (Nov 2025) for *operating* a service, collecting fees and courting criminal flow; Roman Storm was convicted on the §1960 conspiracy count (6 Aug 2025), his acquittal motion is still pending and a retrial on the two hung counts is set for 26 Apr 2027. The CLARITY Act, which would codify a non-custodial-developer safe harbour, failed a Senate cloture vote 49–50 on 15 Sep 2026 **(secondary)**. Design rule: **no admin keys over privacy paths, no fee to us on privacy paths, no hosted relayer we operate, public exit paths that need no third party.**
4. **Chain economics have inverted the old assumption that "fully on-chain" must live on an L2.** Mainnet base fee has sat at 0.15–0.5 gwei for most of 2026 (ethereum.org, May 2026; secondary trackers through Aug 2026) with the gas limit at 60M since 25 Nov 2025. At 0.5 gwei and ETH ≈ $2,750, writing **50 KB / 150 KB / 300 KB of SSTORE2 data costs ≈ 11.2M / 33.6M / 67.1M gas ≈ $15 / $46 / $92 on mainnet**; on Base (0.005 gwei floor) the same is ≈ $0.15 / $0.46 / $0.92 plus a few cents of L1 data fee; Arbitrum (≈0.02 gwei) ≈ $0.62 / $1.85 / $3.69; OP Mainnet (0.001 gwei floor) ≈ $0.03 / $0.09 / $0.18.
5. **The roadmap contains a cliff for exactly our design.** Glamsterdam's scheduled list (EIP-7773, read 2026-10-03) includes EIP-8037 "State Creation Gas Cost Increase", which reprices code deposit from **200 to 1,530 gas/byte (7.65×)**, and EIP-7954 raising the code-size limit to 64 KiB. With Fusaka's EIP-7825 per-transaction cap of 16,777,216 gas (live since 3 Dec 2025), a 24 KB SSTORE2 chunk would cost ~38M gas post-8037 and **no longer fit in one transaction**; the largest single-tx chunk falls to ~10.8 KB and 300 KB would cost ~476M gas (≈ 8 full blocks). Glamsterdam's Sepolia activation is 6 Oct 2026; mainnet is undecided. **Static assets destined for L1 should be deployed before Glamsterdam**, and the deployer must become gas-schedule-aware.
6. **Recommendation**: Ethereum mainnet as the canonical home of identity, ownership, the vault and the privacy registrations (neutrality, immutability credibility, singleton availability, and it is now affordable), with **Base** as the high-frequency surface (mint waves, swaps, launchpad, messaging) and the second id-band chain; OP Mainnet as an optional third band because it shares Base's fee code and predeploys. Avoid Arbitrum for the data-heavy parts (4× Base's floor, different fee machinery). Keep every chain's deployment immutable and admin-less; that is both the product and the legal posture.

---

## 1. Privacy primitives: state of the art

### 1.1 Stealth addresses — ERC-5564 and ERC-6538

**Specs (primary, eips.ethereum.org, read 2026-10-03).**

ERC-5564 "Stealth Addresses" — Status **Final**; authors Toni Wahrstätter, Matt Solomon, Ben DiFrancesco, Vitalik Buterin; created 13 Aug 2022. Stealth meta-address format `st:eth:0x<spendingPubKey><viewingPubKey>`; scheme id 1 = SECP256k1 with view tags. Singleton announcer: `0x55649E01B5Df198D18D95b5cc5051630cfD45564` (CREATE2 via the deterministic deployer).

```solidity
event Announcement(uint256 indexed schemeId, address indexed stealthAddress,
                   address indexed caller, bytes ephemeralPubKey, bytes metadata);
function announce(uint256 schemeId, address stealthAddress,
                  bytes memory ephemeralPubKey, bytes memory metadata) external;
```
`metadata[0]` is the one-byte view tag; the rest is scheme-specific (selector, token, amount). Sender: random ephemeral key → ECDH with the recipient's viewing key → hashed secret → view tag → stealth address derived from the spending key. Recipient: recompute the shared secret with the private viewing key, filter by view tag, check the derived address.

ERC-6538 "Stealth Meta-Address Registry" — Status **Final**; created 24 Jan 2023. Singleton `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538` on every chain where it is active.

```solidity
function registerKeys(uint256 schemeId, bytes calldata stealthMetaAddress) external;
function registerKeysOnBehalf(address registrant, uint256 schemeId,
                              bytes memory signature, bytes calldata stealthMetaAddress) external; // EIP-712 or EIP-1271
function incrementNonce() external;
function stealthMetaAddressOf(address registrant, uint256 schemeId) external view returns (bytes memory);
event StealthMetaAddressSet(address indexed registrant, uint256 indexed schemeId, bytes stealthMetaAddress);
```
Registrations are keyed by `address`. The `registerKeysOnBehalf` + EIP-1271 path matters for us: **a token's ERC-6551 account (a contract) can register its own stealth meta-address**, signed by whatever the account's `isValidSignature` accepts.

**Adoption (ScopeLift, "Umbra: 2025 in Review", 18 Feb 2026 — primary blog).** >350,000 transactions, ≈$500M transacted (≈$8M/month), ≈100,000 unique senders, live on Ethereum, Polygon, Optimism, Base and Arbitrum; Umbra v2 "≈90% complete", targeting summer 2026 with a stablecoin pivot. Fluidkey (stealth-address accounts with ENS integration, Base-first) is live on iOS/Android/web **(secondary)**.

**Incident (April 2026).** After the Kelp DAO bridge exploit (18 Apr 2026, ≈$292M rsETH, attributed to Lazarus/TraderTraitor — secondary), ≈$800K of proceeds passed through Umbra; on 21 Apr 2026 ScopeLift put the hosted front end into maintenance mode while stating the contracts "remain live onchain and cannot be disabled by the project" **(secondary, multiple outlets)**. Lesson: the only lever a non-custodial team has is its own front end, and using it is a reputational choice, not a legal obligation; our web3:// site has no such lever at all, which is a feature we should document rather than hide.

**Design notes for us.**
- Announcement cost is one event (≈ 2–3K gas of log data plus the call); it is the cheapest privacy feature available and works identically on every target chain because both singletons are CREATE2-deterministic.
- Stealth addresses hide the recipient, not the amount or the sender; pairing them with "one address per app" (Vitalik's April 2025 roadmap, below) is what breaks cross-app linkability.
- A 2026 measurement paper on RAILGUN (below) shows that amount fingerprints and timing are what deanonymise users; the same applies to stealth payments and should shape UI defaults (round amounts, delayed sweeps).

### 1.2 RAILGUN — shielded UTXO execution

**Architecture (RAILGUN docs wiki and GitHub `Railgun-Privacy/contract`, sources read 2026-10-03).** A shield moves ERC-20/721/1155 value into the RAILGUN contract and appends encrypted commitments to a Merkle tree; private transfers and unshields spend commitments with Groth16 zk-SNARK proofs over BN254 (trusted setup: 55 Phase-1 and 304 Phase-2 participants per L2BEAT). Addresses are "0zk" addresses; the on-chain data per note is:

```solidity
struct CommitmentPreimage { bytes32 npk; TokenData token; uint120 value; }   // npk = Poseidon(Poseidon(spendPK, nullifyingKey), random)
struct TokenData { TokenType tokenType; address tokenAddress; uint256 tokenSubID; }
struct CommitmentCiphertext { bytes32[4] ciphertext; bytes32 blindedSenderViewingKey;
                              bytes32 blindedReceiverViewingKey; bytes annotationData; bytes memo; }
struct BoundParams { uint16 treeNumber; uint72 minGasPrice; UnshieldType unshield; uint64 chainID;
                     address adaptContract; bytes32 adaptParams; CommitmentCiphertext[] commitmentCiphertext; }
struct Transaction { SnarkProof proof; bytes32 merkleRoot; bytes32[] nullifiers; bytes32[] commitments;
                     BoundParams boundParams; CommitmentPreimage unshieldPreimage; }
function shield(ShieldRequest[] calldata) external;      // RailgunSmartWallet
function transact(Transaction[] calldata) external;
event Shield(uint256 treeNumber, uint256 startPosition, CommitmentPreimage[] commitments, ShieldCiphertext[] shieldCiphertext, uint256[] fees);
event Transact(uint256 treeNumber, uint256 startPosition, bytes32[] hash, CommitmentCiphertext[] ciphertext);
event Nullified(uint16 treeNumber, bytes32[] nullifier);
```
`shieldFee`/`unshieldFee` are owner-settable basis-point fees capped at 50% in `RailgunLogic.changeFee`; the code is `UNLICENSED` and uses OpenZeppelin v4. `BoundParams.adaptContract/adaptParams` is the hook that lets a "RelayAdapt" contract unshield → call arbitrary DeFi → re-shield atomically (the "shielded execution" pattern). RAILGUN docs list the privacy-system proxy at `0xfa7093cdd9ee6932b4eb2c9e1cde7ce00b1fa4b9` on Ethereum (same address on Arbitrum), `0x19b6…8c71` on Polygon, `0x5901…8a10` on BSC; no Base address is listed in the docs, but L2BEAT (read 2026-10-03) records a Base deployment "initialized via governance proposal".

**Compliance mechanism: Private Proofs of Innocence (RAILGUN docs, primary).** Blocklists from five providers — Elliptic, ScamSniffer, PureFi, SlowMist and the Chainalysis Sanctions Oracle; the user proves in zero knowledge that their shielded UTXOs are *not* in a chosen provider's set. Anyone can run a PPOI node; public Broadcasters run their own and refuse to forward transactions that lack a valid proof. There is an **"Unshield-Only Standby Period" of 1 hour** after shielding, during which the only permitted action is a public reversal to the depositing address. Broadcasters are discovered over Waku, cannot decrypt payloads, cannot hold tokens, and the network needs only one cooperative broadcaster to proceed.

**Risk posture (L2BEAT privacy page, read 2026-10-03).** TVL $110.80M (+18.9% w/w). Upgradeable by RAIL-token governance with a 7-day delay ("passes the walkaway test"); two EOAs stage verification keys but cannot change them unilaterally; trusted setup rated medium risk. Viewing keys can be shared with regulators. No formal audit list is published on that page (I could not find a dated audit index on the docs site either — **unverified**).

**Measured anonymity (arXiv 2606.25926, "A Tattered Cloak of Invisibility", Huseynov, Shahzaib, Seres, Tapolcai, submitted 24 Jun 2026).** 17.65% of RAILGUN withdrawals were uniquely linked to deposits with five heuristics (timing, address reuse, graph proximity, amount fingerprints, knapsack sums); a knapsack solver produced a median anonymity loss of 3.42 bits. Lesson for any shielded feature we expose: the cryptography is not the weak point, the UI is.

### 1.3 Privacy Pools (0xbow) — association sets with a trustless exit

**Facts.** Mainnet launch 31 Mar 2025 (0xbow announcement on X; The Block); ≈$6M volume from >1,500 users by the $3.5M seed round announcement (Nov 2025, led by Starbloom; the EF integrated Privacy Pools into Kohaku at Devconnect Buenos Aires) **(secondary)**. Assets: ETH, then multi-asset pools (wBTC, USDC, USDT, DAI, USDS) **(secondary)**. Repository `0xbow-io/privacy-pools-core`, Apache-2.0, monorepo of circuits, contracts, relayer and SDK (primary). Mainnet: Entrypoint proxy `0x6818809EefCe719E480a7526D76bD3e561526b46`, ETH pool `0xF241d57C6DebAe225c0F2e6eA1529373C9A9C9fB` (contracts README, primary).

**Interfaces (from `IPrivacyPool.sol` and `IEntrypoint.sol` on `main`, read 2026-10-03).**
```solidity
// Entrypoint (upgradeable proxy; owner = 0xbow, "postman" updates roots)
function deposit(uint256 _precommitment) external payable returns (uint256 _commitment);
function deposit(IERC20 _asset, uint256 _value, uint256 _precommitment) external returns (uint256 _commitment);
function relay(IPrivacyPool.Withdrawal calldata _withdrawal, ProofLib.WithdrawProof calldata _proof, uint256 _scope) external;
function updateRoot(uint256 _root, string memory _ipfsCID) external returns (uint256 _index);   // ASP root + IPFS CID of the set
struct AssetConfig { IPrivacyPool pool; uint256 minimumDepositAmount; uint256 vettingFeeBPS; uint256 maxRelayFeeBPS; }
struct RelayData  { address recipient; address feeRecipient; uint256 relayFeeBPS; }
struct AssociationSetData { uint256 root; string ipfsCID; uint256 timestamp; }
event RootUpdated(uint256 _root, string _ipfsCID, uint256 _timestamp);
// PrivacyPool (per asset; LeanIMT state tree; nullifiers; labels)
struct Withdrawal { address processooor; bytes data; }
function deposit(address _depositor, uint256 _value, uint256 _precommitment) external payable returns (uint256);
function withdraw(Withdrawal memory _w, ProofLib.WithdrawProof memory _p) external;
function ragequit(ProofLib.RagequitProof memory _p) external;   // bypasses the ASP; original depositor only; full amount, public
function windDown() external;
event Ragequit(address indexed _ragequitter, uint256 _commitment, uint256 _label, uint256 _value);
error IncorrectASPRoot(); error OnlyOriginalDepositor(); error UnknownStateRoot();
```
The model: deposits are screened off-chain by the Association Set Provider; a withdrawal proves membership in the current ASP root (published on-chain with an IPFS CID of the full set) and knowledge of a commitment; **`ragequit` lets anyone the ASP excludes leave publicly with no permission**. That exit is the piece of design that makes the compliance story defensible without making the operator a gatekeeper of funds. Note the trade-off openly: the Entrypoint is an upgradeable proxy owned by 0xbow, and the ASP is centralised (0xbow sells it as "ASP-as-a-Service"). 0xbow's list of "configurable" chains names Ethereum, BSC, Optimism and Starknet, but as of the sources above the pools are live only on Ethereum **(secondary)**.

### 1.4 The ecosystem direction: Vitalik's roadmap and Kohaku

Vitalik's 10/11 April 2025 post "A maximally simple L1 privacy roadmap" (the original URL on vitalik.eth.limo returned 404 during this session; summarised from The Defiant, CryptoSlate and others — **secondary**) proposes four things that need no consensus change: (1) wallets integrate Privacy Pools / RAILGUN-style shielded balances with "send from shielded balance" on by default; (2) **one address per application** so cross-app activity is unlinkable; (3) privacy of on-chain *reads* (TEE/PIR RPC); (4) network-level anonymity, with FOCIL and EIP-7701 as the protocol-side enablers. The EF's Kohaku SDK (v0.0.1-alpha, 25 May 2026 **secondary**) implements (1)–(3) as wallet modules: RAILGUN relaying through the ERC-4337 mempool, Privacy Pools and Tornado wrappers in progress, stealth addresses, and private RPC routing. **The practical consequence for us is that privacy is becoming a feature a holder brings with their wallet; our job is to be a good counterparty** — expose stealth meta-addresses, accept shielded deposits, keep every on-chain action's data minimal — not to ship our own mixer.

### 1.5 EIP-7702 and what it changes about "verify the visitor holds the NFT"

**Spec (EIP-7702, Final).** Transaction type `0x04`; authorization tuple `[chain_id, address, nonce, y_parity, r, s]`; the account's code becomes the 23-byte designator `0xef0100 || address`; `PER_AUTH_BASE_COST` 12,500, `PER_EMPTY_ACCOUNT_COST` 25,000. **`EXTCODESIZE` on a delegated EOA returns 23 and `EXTCODECOPY` returns the designator**, while `CODESIZE` inside the delegate sees the real code. Security section: malicious delegates can take "near complete control over a signer's EOA"; initialisation can be front-run; storage layouts must be collision-free (ERC-7201); `tx.origin`-based checks break; sponsored transactions can be griefed.

**Field experience (Pectra, 7 May 2025).** Wintermute (post on X, 30 May 2025 — primary for the claim): >97% of 7702 delegations pointed at copy-pasted "CrimeEnjoyor" sweeper contracts draining compromised EOAs; later tallies counted 768,275 (≈48%) of activations as crime-linked **(secondary)**. Inferno Drainer phishing via 7702 batch signatures cost one user ≈$146K (24 May 2025) **(secondary)**. ethereum.org's 7702 guidance: show the delegate target prominently; revoke by delegating to the zero address; dapps should not request authorizations directly but go through ERC-5792 batching / ERC-6900 modules.

**Design rules for our site's "connect wallet, prove you hold the token" flow.**
- Never use `code.length == 0` to mean "EOA". A delegated EOA has code (23 bytes) and may implement ERC-1271; a plain EOA may become delegated mid-session. Authorise by `ownerOf`/`isApprovedForAll`/ERC-6551 `isValidSigner` semantics and accept ERC-1271 from any account with code.
- Keep the rule from the ANIMA repo that **session keys never sign ERC-1271**; a sweeper-delegated EOA that holds a session key must not be able to escalate.
- Our site must not ask for a 7702 authorization itself; use ERC-5792 `wallet_sendCalls` for batching and let the wallet own the delegation.
- Consider a client-side blocklist of known sweeper code hashes (the CrimeEnjoyor bytecode is identical across thousands of delegations) to warn a visitor whose EOA is delegated to one.

---

## 2. Compliance: the lessons of 2022–2026

### 2.1 Tornado Cash: sanctions, delisting, prosecution

- **Sanction** 8 Aug 2022 (OFAC SDN listing of the protocol's addresses).
- ***Van Loon v. Department of the Treasury*, No. 23-50669 (5th Cir., filed 26 Nov 2024)** — opinion PDF read in full. Holding: "Tornado Cash's immutable smart contracts (the lines of privacy-enabling software code) are not the 'property' of a foreign national or entity, meaning (1) they cannot be blocked under IEEPA, and (2) OFAC overstepped its congressionally defined authority." The reasoning turns on ownability: "More than one thousand volunteers participated in a 'trusted setup ceremony' to 'irrevocably remov[e] the option for anyone to update, remove, or otherwise control those lines of code.' And as a result, no one can 'exclude' anyone from using the Tornado Cash pool smart contracts." The court distinguished the immutable pools from the mutable parts (relayer registry, governance) that OFAC could still reach. **Reversed and remanded** with instructions to grant partial summary judgment under the APA.
- **Delisting** 21 Mar 2025 (Treasury press release sb0057, primary): Treasury removed Tornado Cash citing "novel legal and policy issues raised by use of financial sanctions against financial and commercial activity occurring within evolving technology and legal environments", referencing its filing in *Van Loon*, while warning that DPRK-related transactions remain sanctionable and that U.S. persons "should exercise caution." Roman Semenov was not delisted (DEF/press, secondary).
- ***US v. Storm*** (S.D.N.Y.). Indicted 23 Aug 2023; motion to dismiss denied 26 Sep 2024; on 15 May 2025 DOJ dropped the §1960(b)(1)(B) licensing theory after the Blanche memo (DEF timeline, primary); trial 14 Jul–6 Aug 2025; **convicted of conspiracy to operate an unlicensed money transmitting business, jury hung on money-laundering and sanctions conspiracy** (secondary, consistent across sources). Acquittal motion argued 9 Apr 2026, undecided as of Aug 2026; DOJ sought an October 2026 retrial; **retrial adjourned to 26 Apr 2027** pending the acquittal ruling (Cointelegraph/Crypto Briefing/Inner City Press, Aug 2026 — secondary).

### 2.2 Samourai Wallet: the counter-example

Keonne Rodriguez (CEO) and William Lonergan Hill (CTO) pleaded guilty on 30 Jul 2025 to conspiracy to operate an unlicensed money transmitting business; sentenced 6 Nov 2025 (5 years) and 19 Nov 2025 (4 years), forfeiting $6.3M in fees (IRS-CI release, primary; CoinDesk, Bitcoin Magazine). The government's facts: a coordinator server they ran, fees they collected, >$237M of criminal proceeds they knew about, and marketing aimed at evaders. Even with the Blanche memo in force, operating infrastructure + taking fees + knowledge was enough for a plea. This is the brightest line between "software" and "service" we have.

### 2.3 FinCEN's 2019 guidance (FIN-2019-G001, PDF read)

§4.5.1(a): "An anonymizing services provider is a money transmitter under FinCEN regulations. The added feature of concealing the source of the transaction does not change that person's status under the BSA." §4.5.1(b): **"An anonymizing software provider is not a money transmitter.** FinCEN regulations exempt from the definition of money transmitter those persons providing 'the delivery, communication, or network access services used by a money transmitter to support money transmission services.' This is because suppliers of tools (communications, hardware, or software) that may be utilized in money transmission, like anonymizing software, are engaged in trade and not money transmission." §4.2.1 distinguishes hosted wallet providers (money transmitters) from unhosted wallets by who holds the key and controls the value. This guidance predates the cases above and both prosecutions proceeded anyway, so it is a shield for *design*, not a guarantee.

### 2.4 Policy climate in the U.S. and EU

- **DOJ "Ending Regulation by Prosecution" memo** (Deputy AG Todd Blanche, 7 Apr 2025; law-firm summaries of the memo, secondary but consistent): DOJ "will no longer target virtual currency exchanges, mixing and tumbling services, or offline wallets for acts of their end users or unwitting violations of regulations" except where consistent with the memo's priorities (terrorism, cartels, hacking, fraud against investors); NCET disbanded.
- **CLARITY Act / Blockchain Regulatory Certainty Act**: House passed July 2025; Senate Banking reported May 2026; §604 of the negotiated text would shield non-custodial developers from money-transmitter and BSA obligations; **Senate cloture failed 49–50 on 15 Sep 2026** (AMLWatcher/tech-insider trackers — secondary; no statute exists as of this report).
- **EU AMLR, Regulation (EU) 2024/1624, applies from 1 Jul 2027**: Article 79 prohibits credit institutions, financial institutions and CASPs from keeping anonymous accounts "or any account otherwise allowing for the anonymisation of the customer account holder or the anonymisation or increased obfuscation of transactions, including through anonymity-enhancing coins"; supervision by AMLA (secondary summaries of the regulation text; the article number and date are consistent across sources). It binds regulated intermediaries, not self-custody software — but it means **a token launched from our launchpad that bakes anonymity into the token itself will be unlistable on EU venues**; privacy should live in the holder's account, not in the asset.

### 2.5 Private messaging: what the law actually constrains

- **Encryption itself is lawful everywhere we would deploy.** The EU Council's 26 Nov 2025 position on the CSA Regulation dropped mandatory detection orders / client-side scanning (trilogue continuing, with a three-year review clause) **(secondary)**. The UK Online Safety Act's "accredited technology" notices exist but no accredited technology does; the Investigatory Powers Act's Technical Capability Notices led Apple to withdraw Advanced Data Protection from new UK accounts in early 2025 **(secondary)**. None of this reaches a protocol with no operator — there is nobody to serve a notice on — but it does reach any *hosted* front end or relay we might run, which is one more reason to run none.
- **The real exposure is immutable illegal content.** The 2025 Bitcoin Core v30 / OP_RETURN debate (Cointelegraph, Protos — secondary) rehearsed it: arbitrary bytes on an immutable ledger could be CSAM; no court has decided node-operator liability; Section 230 arguments exist but are untested. An on-chain messaging layer that accepts arbitrary bytes is exactly this surface. Mitigations are architectural: **text-only, size-capped payloads; no binary/image bytes; optional E2EE so that ciphertext is what is stored; logs rather than state; client-side blocklists (the PPOI pattern applied to content)**.
- **Reference point for E2EE wallet messaging: XMTP** (docs read 2026-10-03). MLS with ciphersuite `MLS_128_HPKEX25519_CHACHA20POLY1305_SHA256_Ed25519`, X-Wing KEM for post-quantum confidentiality, forward secrecy via ratcheting and post-compromise security via commits; nodes see only timing/size and can profile query patterns per IP. It is off-chain, which is why it can offer PCS; an on-chain log cannot ratchet per message cheaply. The IPSEITY "Parley" design (events with `prev` block pointers, no indexer) is the on-chain analogue; XMTP shows what we give up (forward secrecy, deletion) in exchange for permanence and zero infrastructure.
- **History expiry changes the durability of log-based messaging.** EIP-4444 partial history expiry: all execution clients may drop pre-merge bodies and receipts since 1 May 2025 ("drop day", EF blog 8 Jul 2025 — primary); Phase 2 (a rolling window, ≈1 year, timing unset) is planned for 2026. `eth_getLogs` for old messages will increasingly depend on history providers (Portal, archive services). A message layer that promises "no indexer, ever" must keep whatever it needs for *current* function in state, and treat old logs as archival.

### 2.6 Lessons → design rules

| Lesson | Source | Rule for our protocol |
|---|---|---|
| Immutability + no control = not "property", not sanctionable | *Van Loon* | No `diamondCut`, no owner over routing, no pausable privacy path; document the trusted-setup-style irrevocability where we have it |
| Operating a service + fees + knowledge = money transmission | Samourai pleas; Storm conviction | We run no relayer, no coordinator, no hosted front end; no protocol fee is taken on any privacy or stealth path; fees (if any) only on the market/launchpad |
| Software provider ≠ money transmitter | FinCEN 2019 §4.5.1(b) | Keep every privacy feature a client-side tool over third-party rails (RAILGUN, Privacy Pools, 5564) |
| Compliance can be opt-in and trustless | Privacy Pools `ragequit`; RAILGUN PPOI blocklists | Any shielded or pooled path we integrate must have a public exit needing no third party; let holders attach an innocence attestation, never require it |
| 7702 delegations are mostly hostile | Wintermute | Treat delegated EOAs as contracts; never request authorizations; warn on known sweeper code hashes |
| Amounts and timing deanonymise | arXiv 2606.25926 | UI defaults: round amounts, randomised sweep delays, one address per app |
| Immutable bytes can be illegal bytes | Core v30 debate | Messaging is text-only, size-capped, optionally encrypted, log-based |
| Front-end shutdown is the only lever | Umbra, Apr 2026 | We have no lever; say so in the docs and in the terms the site displays |

---

## 3. Chain economics in 2026

### 3.1 The price regime

| Quantity | Value | Source / date |
|---|---|---|
| ETH/USD | ≈ $2,750 (range $2,719–2,757 across venues) | Fortune/Yahoo/OKX price pages, 2 Oct 2026 (secondary) |
| Mainnet base fee, typical 2026 | 0.15 gwei "standard" (5 May 2026); 0.5 gwei April daily average; ≈0.5 gwei Aug 2026; spikes >8 gwei in busy windows | ethereum.org "Building on Ethereum in 2026" (primary, May 2026); YCharts/CoinLaw (secondary) |
| Mainnet gas limit | 60M since 25 Nov 2025 (validator signalling; EIP-7935 sets 60M default in Fusaka) | ethereum.org 2026 page; EIP-7607; press |
| Per-transaction gas cap | 16,777,216 (EIP-7825, Fusaka, 3 Dec 2025) | EIP-7825 (Final), EIP-7607 |
| Base L2 base fee floor | 0.005 gwei (5,000,000 wei); elasticity 6, denominator 125 (≤4%/block) | docs.base.org network-fees (primary) |
| OP Mainnet floor | 0.001 gwei | OP docs / l2fees (secondary for the number) |
| Arbitrum One gas price | ≈0.02 gwei (28–29 Sep 2026); historical floor ≈0.01 gwei | Arbiscan gas tracker via search (secondary); `ArbGasInfo.getMinimumGasPrice` is the authoritative read (not performed — see Method) |
| Measured L2 transfer / swap cost (15 Sep 2026, ETH $2,475) | Ethereum 0.336¢ / 2.25¢; Base 0.0314¢ / 0.209¢; Arbitrum 0.105¢ / 0.697¢; OP Mainnet 0.00543¢ / 0.0353¢ | `AlinaSchan/l2fees` README, oracle-priced (secondary but methodical) |
| Blob economics | target/max 6/9 (Pectra) → 10/15 (BPO1, 9 Dec 2025) → 14/21 (BPO2, 7 Jan 2026); EIP-7918 reserve price `BLOB_BASE_COST = 2^13` so blob gas ≥ base_fee/16 | EF Fusaka announcement (primary), EIP-7918 (Final), EIP-4844 |
| Blob cost per MB, 30-day avg to 22 Sep 2026 | $0.0325/MB (Celestia $0.0188, EigenDA $0.0363) | dalayers.com (secondary); consistent with the 7918 floor at ≈0.2 gwei base fee: 8192×base_fee/131072 per blob-gas × 131072 per 128 KiB blob = base_fee × 8192 wei per blob → ≈$0.09/MB at 0.5 gwei |

"Rollups now carry about 95 percent of Ethereum's transactions and L1 typically runs well below its block target" (ethereum.org, 2026). The implication for a data-heavy deployment is the opposite of 2021–2024 folklore: **the L1 is usually at or near its 0-gwei-ish floor, so one-time writes of hundreds of kilobytes cost tens of dollars, not thousands.**

### 3.2 The gas schedule that prices SSTORE2

- Code deposit: **200 gas/byte** (EIP-170 era; unchanged through Osaka). EIP-170 limit 24,576 bytes; SSTORE2 reserves one `00` (STOP) byte so a chunk holds 24,575 data bytes.
- Initcode: 2 gas per 32-byte word (EIP-3860), max 49,152 bytes.
- Calldata: 4 gas per zero byte / 16 per non-zero (EIP-7623 keeps these as `STANDARD_TOKEN_COST = 4` per token, 1 token per zero byte, 4 per non-zero byte) with a floor of `TOTAL_COST_FLOOR_PER_TOKEN = 10` (i.e. 40 gas per non-zero byte) that applies only when `10 × tokens` exceeds execution gas — it never binds on a code-deposit transaction because the 200 gas/byte deposit dominates.
- Transaction: 21,000 base + 32,000 for a creation transaction.
- Reading: `EXTCODECOPY` is 2,600 (cold) / 100 (warm) + 3 gas per word copied + memory expansion — ~3 gas/byte, which is why `tokenURI` for a 100 KB engine is a few hundred thousand gas of `eth_call` and free to the caller.

### 3.3 Cost tables: SSTORE2 writes of 50 / 150 / 300 KB

Computed with the schedule above (model in `scratchpad/sstore2_cost.py`: per chunk 21,000 + 32,000 + 16·bytes calldata + 2/word initcode + CODECOPY + memory + 200·(bytes+1) deposit; chunks of 24,575 bytes; compressed payloads are treated as all non-zero bytes). L2 rows are **execution gas only** (the L1 data fee is added in §3.4).

| Data | Chunks (24 KB) | Gas (today) | Mainnet @0.5 gwei | @5 gwei | @20 gwei | Base @0.005 gwei | Arbitrum @0.02 gwei | OP @0.001 gwei |
|---|---|---|---|---|---|---|---|---|
| 50 KB (51,200 B) | 3 | 11,234,509 | **$15.45** | $154 | $618 | **$0.15** | $0.62 | $0.03 |
| 150 KB (153,600 B) | 7 | 33,596,769 | **$46.20** | $462 | $1,848 | **$0.46** | $1.85 | $0.09 |
| 300 KB (307,200 B) | 13 | 67,140,280 | **$92.32** | $923 | $3,693 | **$0.92** | $3.69 | $0.18 |

Effective cost ≈ **218.6 gas per byte** today. One full chunk is 5,368,893 gas, so under the EIP-7825 cap a single transaction can carry **at most three chunks (~72 KB)**; 300 KB needs ≥5 transactions and, at 67M gas, more than one 60M block.

**Same table under Glamsterdam's EIP-8037 as drafted (1,530 gas/byte code deposit):**

| Data | Gas under EIP-8037 | Mainnet @0.5 gwei | Base @0.005 gwei |
|---|---|---|---|
| 50 KB | 79,334,499 | $109 | $1.09 |
| 150 KB | 237,894,079 | $327 | $3.27 |
| 300 KB | 475,733,570 | $654 | $6.54 |

Effective ≈ 1,548.6 gas/byte (7.1× today). **A full 24 KB chunk would cost 38,054,973 gas — more than twice the EIP-7825 cap — so it could not be deployed in one transaction at all**; the largest single-tx chunk would be ≈10.8 KB, and a 64 KiB chunk (EIP-7954) would cost ≈101M gas. EIP-7954 and EIP-8037 are both on Glamsterdam's scheduled list; as drafted, 8037 negates 7954 for data contracts. Whether L2s adopt 8037's pricing is open (§6); OP Stack and Arbitrum have historically tracked L1 EVM changes within a release or two.

### 3.4 L2 fee structure after blobs

**OP Stack (Base, OP Mainnet) — Fjord formula (docs.optimism.io, primary):**
```
executionFee     = gasUsed × (baseFee + priorityFee)
estimatedSize    = max(minTransactionSize × 1e6, intercept + fastlzCoef × fastlzSize)   // FastLZ compression estimate, regression-fitted
l1FeeScaled      = baseFeeScalar × l1BaseFee × 16 + blobBaseFeeScalar × l1BlobBaseFee   // scalars ×1e6, chain-set
l1Cost           = estimatedSize × l1FeeScaled / 1e12
operatorFee      = operatorFeeConstant + gasUsed × operatorFeeScalar × 100               // post-Jovian, operator-set (Base: none published)
```
Live scalar values are read from `GasPriceOracle` at `0x420000000000000000000000000000000000000F` (`baseFeeScalar()`, `blobBaseFeeScalar()`, `l1BaseFee()`, `blobBaseFee()`, `getL1FeeUpperBound(size)`); the Base docs deliberately publish no numbers. With illustrative scalars (baseFeeScalar ≈ 0.0023, blobBaseFeeScalar ≈ 1.06 — **unverified**, typical post-Ecotone settings), an L1 base fee of 0.5 gwei and the 7918 blob floor, the L1 data fee for incompressible initcode is ≈0.05 gwei/byte: **≈$0.007 / $0.022 / $0.044 for 50 / 150 / 300 KB**. Even if the true scalars are 10× higher, the L1 component stays below $0.50 for 300 KB. On Base, SSTORE2 cost is therefore dominated by L2 execution gas at the 0.005 gwei floor.

**Arbitrum One (docs.arbitrum.io, primary):** each transaction is Brotli-compressed at the fastest level, the compressed size × 16 is priced at a dynamic "L1 price per unit" that tracks what batch posters actually pay, and the result is converted into L2 gas units at the current L2 base fee; `totalFee = l2BaseFee × (l2GasUsed + l1CalldataGasUnits)`. The docs do not mention blobs explicitly, but batch posting uses them. The L2 base fee has a floor queryable via `ArbGasInfo.getMinimumGasPrice()`; trackers show ≈0.02 gwei in late Sep 2026 — 4× Base's floor, which is why Arbitrum's rows above are 4× Base.

**Why L2 data is cheap now (and will stay cheap):** blob supply went from 6 to 14 target blobs per block within a month of Fusaka via BPO1/BPO2, PeerDAS (EIP-7594) lets it keep growing by config-only forks (EIP-7892), and demand is ≈25% of capacity 100 days after BPO2 **(secondary)**. EIP-7918's reserve price stops blob gas from collapsing to 1 wei, so there is a floor at ≈1/16 of execution gas — still a fraction of a cent per kilobyte. EIP-7623 (Pectra) and EIP-7976 (Glamsterdam, floor 64 gas/byte) keep pushing data off calldata and onto blobs; that affects rollup batch posting, not our code-deposit transactions.

### 3.5 Data-availability choices for a website served from chain

The brief lists DA options, so here is the comparison for *our* use — bytes that `tokenURI`/`web3://` must return from an `eth_call`:

| Where the bytes live | EVM-readable? | Durable? | Cost (300 KB, Oct 2026) | Verdict |
|---|---|---|---|---|
| Contract code (SSTORE2) | Yes, `EXTCODECOPY` | Yes (state, never expires) | $92 L1 / $0.92 Base | **The only option that satisfies "the NFT mints a website"** |
| Storage (SSTORE) | Yes | Yes | ≈690 gas/byte → ≈$290 L1 | 3.2× SSTORE2; only for mutable small state |
| Calldata | No (only via history) | History expiry (EIP-4444) makes it archival | 16 gas/byte ≈ $7 L1 | Fine for inscriptions, useless for a live site |
| Blobs (EIP-4844) | **No** — only `BLOBHASH` commitments | Pruned after 4,096 epochs ≈ 18 days | ≈$0.03/MB | Rollup batch data only |
| Celestia / EigenDA | No | Provider-dependent | $0.019–0.036/MB | Not usable from the EVM |
| IPFS/Arweave | No | Not on chain | n/a | Excluded by the project's premise |

So "DA choice" reduces to **which chain's state holds the code, and when**. Blobs and alt-DA matter only indirectly: they are why Base's L1 data fee is negligible.

---

## 4. Roadmap items that affect the design

**Pectra (Prague/Electra) — mainnet 7 May 2025 10:05 UTC (EIP-7600, epoch 364032).** EIP-7702 (§1.5); EIP-7623 calldata floor; EIP-7691 blobs 6/9; EIP-2537 BLS12-381 precompiles (cheap BLS verification, useful for any proof-of-innocence or aggregate-signature feature); EIP-2935 (last 8,192 block hashes in state — helps the "previous block pointer" messaging pattern verify backlinks on-chain); EIP-7251 (max effective balance), EIP-7002, EIP-6110, EIP-7549, EIP-7685, EIP-7840.

**Fusaka (Osaka/Fulu) — mainnet 3 Dec 2025 21:49 UTC (EIP-7607, epoch 411392).** EIP-7594 PeerDAS; **EIP-7825 tx gas cap 2^24**; EIP-7918 blob reserve price; EIP-7934 RLP block size limit; EIP-7939 CLZ opcode; EIP-7951 secp256r1 precompile (passkey/WebAuthn signatures — directly useful for the site's wallet-less login or session keys); EIP-7823/7883 MODEXP bounds; EIP-7917 deterministic proposer lookahead; EIP-7892 BPO forks; EIP-7935 60M default gas limit. **EIP-7907 (metering 24–64 KB code at 2 gas/word) is still Draft and was not in Fusaka.**

**Glamsterdam (Amsterdam/Gloas) — Sepolia 6 Oct 2026 13:53 UTC (epoch 353024); Hoodi and mainnet undecided; press reports a slip to late 2026.** Scheduled (EIP-7773, read 2026-10-03): EIP-2780 resource-based intrinsic gas (`TX_BASE_COST` 12,000, `TX_VALUE_COST` 6,000, `CREATE_ACCESS` 12,000; new-account creation charged 183,600 "state gas"); EIP-7688; **EIP-7708 ETH transfers emit a log** (our vault's inbound-ETH detection becomes a log scan instead of balance polling); EIP-7732 ePBS; EIP-7778 block gas accounting without refunds; EIP-7843 SLOTNUM; EIP-7928 block-level access lists (parallel execution: avoid hot shared slots so our contracts parallelise); **EIP-7954 code size 64 KiB / initcode 128 KiB**; EIP-7976 calldata floor 64/byte; EIP-7981 access-list cost; **EIP-7997 deterministic factory contract** (same-address deployments on every chain without the nonce-0 burner ritual); EIP-8024 SWAPN/DUPN/EXCHANGE; **EIP-8037 state-creation repricing (code deposit 1,530 gas/byte; SSTORE 0→nonzero 97,920; new account 183,600; CREATE base ≈ 120×CPSB)**; **EIP-8038 state-access repricing (COLD_ACCOUNT_ACCESS 3,000; STORAGE_WRITE 10,000; EXTCODESIZE/EXTCODECOPY pay an extra 100 gas warm access; CREATE_ACCESS 12,000)**; EIP-8045; EIP-8061; EIP-8246 remove SELFDESTRUCT burn; EIP-8282. Note that 8037/8038/2780/7976 are all "in review" as of this reading; the list is scheduled, not final.

**Hegotá (after Glamsterdam, ~2027).** Only EIP-7805 FOCIL (inclusion lists — censorship resistance, part of Vitalik's privacy roadmap) and EIP-8141 Frame Transactions (programmable validation, alternative signature schemes, gas sponsorship) are scheduled **(secondary: Tatum, eipsinsight)**.

**History expiry (EIP-4444).** Drop day 1 May 2025 (pre-merge bodies/receipts); all clients support partial expiry since 8 Jul 2025 (EF blog, primary); rolling-window phase planned, timing unset.

What this means operationally:
1. Deploy the L1 copies of large static assets **before Glamsterdam**; afterwards the price is 7× and single-tx chunks shrink to ~10.8 KB.
2. Make the deployer gas-schedule-aware: read `block.gaslimit`, assume the 7825 cap, measure a chunk's real cost on a fork, and refuse or re-chunk when a chunk would not fit.
3. After 8038, every `EXTCODECOPY` from a different chunk costs 3,100 cold; `tokenURI` that stitches 13 chunks pays ≈40K more gas — irrelevant for `eth_call`, relevant if any on-chain path reads the engine.
4. Prefer EIP-7997's factory for cross-chain same-address deployment once live; until then keep the nonce-predicted scheme.
5. Prefer secp256r1 (EIP-7951) session keys for the site's "device key" so a visitor can authorise with a passkey after proving ownership once.

---

## 5. Recommendations for the merged protocol

**R1 (must) — Two-tier home: Ethereum mainnet is canonical; Base is the surface.** Mint the canonical ERC-721 and its ERC-6551 accounts, hold the vault, register stealth meta-addresses, and keep the immutable registry of chains/bands on mainnet. Rationale: ethereum.org's own 2026 guidance ("reconsider mainnet as default when apps need shared liquidity, composability, neutrality, or high-value state"); every privacy singleton and both compliance-aware pools are mainnet-first; the *Van Loon* reasoning rewards immutability on the chain with the strongest neutrality; and at 0.5 gwei a 300 KB engine costs ≈$92 to write. Put the per-action surfaces — mint waves, the per-token AMM, the launchpad, messaging — on Base, where a 200K-gas action costs ≈$0.003 and the chain targets 150–400+ Mgas/s.

**R2 (must) — Keep the id-band model but make the bands Ethereum + Base (+ OP Mainnet), not a five-chain spread.** OP Stack chains share the fee code, the `GasPriceOracle` predeploy, the same EIP schedule cadence and (increasingly) Superchain interop; Arbitrum has different fee machinery and a 4× higher floor today. Two or three bands halves the deployment, verification and documentation surface.

**R3 (must) — Deploy L1 static bytes before Glamsterdam mainnet; build the deployer to refuse post-8037 chunks that exceed the 7825 cap.** See §3.3.

**R4 (must) — No admin, no fees, no relayer on any privacy path.** This is the single rule that separates *Van Loon*/FinCEN §4.5.1(b) from Samourai/Storm. The launchpad and market may take fees; the vault's stealth-receive, any shielded-deposit adapter, and messaging take none, and we operate no infrastructure for them.

**R5 (should) — Ship stealth receive via the ERC-5564/6538 singletons as the first privacy feature.** Each token's account registers a meta-address (`registerKeysOnBehalf` with ERC-1271); the site's "pay this agent" flow derives a one-time address and calls `announce`. Cost is one event; works on every chain; no new cryptography to audit.

**R6 (should) — Integrate Privacy Pools and RAILGUN as adapters, not forks.** "Shield from vault" calls the Privacy Pools Entrypoint (`deposit(uint256 precommitment)`) or RAILGUN `shield()`; withdrawals come back through their own relayers/broadcasters. Surface PPOI/ASP status in the UI. Prefer Privacy Pools for ETH/stables on mainnet (ragequit exit), RAILGUN where a Base deployment is confirmed. Do not route through Tornado even though it is delisted; the retrial is pending.

**R7 (should) — Messaging: text-only, size-capped, log-based, optionally encrypted; keep the thread head and the last N messages in state.** The illegal-content and history-expiry analyses both point here. Encryption keys can be the ERC-6538 viewing keys, so a holder's messaging key is the same registration as their stealth key.

**R8 (should) — Treat every connected account as a possible contract.** ERC-1271 for all accounts with code (7702 designators included), ERC-5792 for batching, no 7702 authorization requests from the site, session keys never sign 1271, sweeper-code-hash warning list in the client.

**R9 (could) — Launchpad tokens carry no anonymity features.** EU AMLR Art. 79 makes anonymity-enhancing assets unlistable for CASPs from 1 Jul 2027; privacy belongs to the holder's account, not the asset.

**R10 (avoid) — Do not build a mixer, a relayer network, a hosted front end, or a fee-taking privacy router**, and do not claim ERC-7857 or similar conformance where the sealed-kernel reasoning in the existing repo says not to.

---

## 6. Open questions

1. Will EIP-8037 ship in Glamsterdam as drafted (1,530 gas/byte), be softened, or move to Hegotá? The interaction with EIP-7954 and EIP-7825 makes the current draft hostile to any data-in-code design; this needs watching at every ACDE call until mainnet scheduling.
2. Do OP Stack (Base) and Arbitrum adopt EIP-8037/8038 pricing and the EIP-7825 cap? Both have historically tracked L1 EVM changes; nothing published yet. If Base does not adopt 8037, the case for "engine on Base, pointer on mainnet" strengthens.
3. Exact Base/OP `baseFeeScalar`/`blobBaseFeeScalar` values today — read `GasPriceOracle` on both chains (the connector read was denied in this session). Also `ArbGasInfo.getPricesInWei()` for the live per-L1-byte price.
4. Is RAILGUN's Base deployment live and at which proxy address? L2BEAT says "initialized via governance proposal"; the RAILGUN docs list no Base address.
5. Will Privacy Pools deploy on Base (listed as "configurable")? If not, shielded deposits from a Base-band token require bridging first.
6. Storm's acquittal motion: a grant would end the §1960 theory for non-custodial developers in SDNY; a denial plus a 2027 conviction would make R4 even more load-bearing.
7. Will the CLARITY Act's §604 safe harbour be revived in a lame-duck session or 2027? As of 15 Sep 2026 it failed cloture.
8. EIP-4444 rolling-window timing: once set, decide how many messages per thread to keep in state versus logs.
9. Does the Glamsterdam slip push mainnet activation into 2027? The "deploy before" deadline depends on it.
10. Audit status of RAILGUN's current contracts and of Privacy Pools (the contracts README references an audit folder I did not read); verify before integrating.

---

## 7. Special ideas — what would make this NFT stand out

1. **Stealth-receivable agent**: the token's ERC-6551 account publishes an ERC-6538 meta-address; anyone can pay the agent privately through the ERC-5564 singleton; the site sweeps one-time addresses into the vault with a holder signature. First NFT whose *wallet* is stealth-addressable by standard.
2. **Clean-bill attestation slot**: the holder can post the hash of a PPOI proof or an ASP membership root to the token's state. Verifiable, optional, never enforced — compliance as a badge the holder chooses to wear.
3. **Ragequit-grade vault**: every shielded or pooled path we expose must have a public, permissionless exit, mirroring Privacy Pools' `ragequit`. Document it as an invariant with a test.
4. **Gas-regime-aware deployer**: reads `block.gaslimit`, assumes the EIP-7825 cap, benchmarks one chunk on a fork, and prints the all-in cost per chain in USD before asking for a key; refuses chunks that would not fit post-8037.
5. **Dual-band canonicality**: the token exists on mainnet (ownership, vault, registrations) and on Base (surface). The site served from either chain shows the same control surface; ownership proofs always resolve on mainnet via the L1 token's `ownerOf` (readable from Base through the OP Stack L1 block/`L1Block` predeploy for freshness, or simply by the client querying both).
6. **Messages that survive history expiry**: a per-thread ring buffer in state (last N) plus log history; the site never needs an indexer and never goes blank when old logs are pruned.
7. **Viewing-key messaging**: the ERC-6538 viewing key doubles as the recipient key for encrypted messages, so one registration gives a holder stealth receive and private DMs.
8. **Passkey sessions (EIP-7951)**: after a one-time ownership proof, the site grants a secp256r1 device key bounded by the existing session-key rules (expiry, spend cap, allowlists); a visitor uses the NFT's swap and launchpad with Face ID, no wallet pop-ups.
9. **EIP-7708-ready vault**: once ETH transfers emit logs, inbound payments to the vault are enumerable without balance measurement; design the vault's "received" view so it works both before (balance delta) and after (logs).
10. **One-address-per-app by construction**: the token's account derives a per-app sub-account (CREATE2 salt = app id) so swap, launchpad and messaging activity are unlinkable across apps even without shielding — Vitalik's roadmap item 2 as a default.

---

## 8. Sources (with dates read or published)

Primary
- EIP-5564 Stealth Addresses (Final) — https://eips.ethereum.org/EIPS/eip-5564 (read 2026-10-03)
- ERC-6538 Stealth Meta-Address Registry (Final) — https://eips.ethereum.org/EIPS/eip-6538
- EIP-7702 Set Code for EOAs (Final) — https://eips.ethereum.org/EIPS/eip-7702
- EIP-7825 Transaction Gas Limit Cap (Final) — https://eips.ethereum.org/EIPS/eip-7825
- EIP-7907 Meter Contract Code Size (Draft) — https://eips.ethereum.org/EIPS/eip-7907
- EIP-7954 Increase Maximum Contract Size (Review) — https://eips.ethereum.org/EIPS/eip-7954
- EIP-8037 State Creation Gas Cost Increase (Review, created 2025-10-01) — https://eips.ethereum.org/EIPS/eip-8037
- EIP-8038 State-access gas cost update (Review, created 2025-10-03) — https://eips.ethereum.org/EIPS/eip-8038
- EIP-7976 Increase Calldata Floor Cost (Review) — https://eips.ethereum.org/EIPS/eip-7976
- EIP-2780 Resource-based intrinsic transaction gas (Review) — https://eips.ethereum.org/EIPS/eip-2780
- EIP-7918 Blob base fee bounded by execution cost (Final) — https://eips.ethereum.org/EIPS/eip-7918
- EIP-4844 Shard Blob Transactions — https://eips.ethereum.org/EIPS/eip-4844
- EIP-7623 Increase calldata cost — https://eips.ethereum.org/EIPS/eip-7623
- EIP-7600 Pectra meta — https://eips.ethereum.org/EIPS/eip-7600 (activation ts 1746612311 = 2025-05-07 10:05:11 UTC)
- EIP-7607 Fusaka meta — https://eips.ethereum.org/EIPS/eip-7607 (activation ts 1764798551 = 2025-12-03 21:49:11 UTC)
- EIP-7773 Glamsterdam meta — https://eips.ethereum.org/EIPS/eip-7773 (Sepolia ts 1791294816 = 2026-10-06 13:53:36 UTC)
- EF blog, Fusaka mainnet announcement (BPO1/BPO2 schedule), 2025-11-06 — https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement
- EF blog, Partial history expiry announcement, 2025-07-08 — https://blog.ethereum.org/2025/07/08/partial-history-exp
- ethereum.org, Building on Ethereum in 2026 — https://ethereum.org/latest/building-on-ethereum-in-2026/
- ethereum.org, Pectra EIP-7702 guidelines — https://ethereum.org/roadmap/pectra/7702/
- RAILGUN docs: overview, PPOI, broadcasters, helpful links (addresses) — https://docs.railgun.org/wiki, …/assurance/private-proofs-of-innocence.md, …/learn/privacy-system/community-broadcasters.md, …/learn/helpful-links.md
- RAILGUN contracts (Globals.sol, RailgunLogic.sol, RailgunSmartWallet.sol) — https://github.com/Railgun-Privacy/contract
- L2BEAT privacy page, Railgun — https://l2beat.com/privacy/projects/railgun (read 2026-10-03)
- Privacy Pools core repo, contracts README, IPrivacyPool.sol, IEntrypoint.sol — https://github.com/0xbow-io/privacy-pools-core ; docs — https://docs.privacypools.com/
- U.S. Treasury, "Tornado Cash Delisting", 2025-03-21 — https://home.treasury.gov/news/press-releases/sb0057
- *Van Loon v. Dep't of the Treasury*, No. 23-50669 (5th Cir. 2024-11-26) — https://www.ca5.uscourts.gov/opinions/pub/23/23-50669-CV0.pdf
- FinCEN FIN-2019-G001, 2019-05-09 — https://www.fincen.gov/sites/default/files/2019-05/FinCEN%20Guidance%20CVC%20FINAL%20508.pdf
- IRS-CI, Samourai founders sentenced — https://www.irs.gov/compliance/criminal-investigation/founders-of-samourai-wallet-cryptocurrency-mixing-service-sentenced-to-five-and-four-years-in-prison
- DeFi Education Fund, US v. Storm timeline — https://www.defieducationfund.org/us-v-storm-background-timeline/
- OP Stack transaction fees (Fjord/Jovian formulas) — https://docs.optimism.io/stack/transactions/fees
- Arbitrum gas and fees — https://docs.arbitrum.io/how-arbitrum-works/gas-fees
- Base network fees (0.005 gwei floor, EIP-1559 params) — https://docs.base.org/base-chain/network-information/network-fees
- XMTP protocol security — https://docs.xmtp.org/protocol/security
- ScopeLift, Umbra 2025 in Review, 2026-02-18 — https://scopelift.co/blog/umbra-2025-in-review-and-the-year-ahead
- Huseynov et al., "A Tattered Cloak of Invisibility", arXiv 2606.25926, 2026-06-24 — https://arxiv.org/abs/2606.25926
- Wintermute on X, 2025-05-30 — https://x.com/wintermute_t/status/1928501765865091400
- 0xbow mainnet launch on X, 2025-03-31 — https://x.com/0xbowio/status/1906784481496719749

Secondary (press, trackers, law-firm notes)
- Storm verdict/retrial: NatLawReview; Hodder Law; The Block (2026-03); Cointelegraph "retrial delayed to April 2027" (2026-08); Crypto Briefing; Inner City Press
- Blanche memo summaries: Covington, White & Case, Greenberg Traurig, Chainalysis (Apr 2025)
- CLARITY Act status: AMLWatcher; tech-insider.org (Aug–Sep 2026); Latham & Watkins tracker
- EU AMLR Art. 79: thirdweb, LeoDex, CryptoTicker, CryptoTimes (2025–26)
- EU CSAR / UK OSA: Patrick Breyer; stateofsurveillance.org; The Record; ITPro
- Kelp DAO / Umbra: Cointelegraph, FinanceFeeds, Yahoo Finance (Apr 2026)
- Kohaku: Unchained, DEXTools, PANews (Nov 2025–May 2026)
- ETH price 2026-10-02: Fortune, Yahoo Finance, OKX, MetaMask
- Mainnet gas 2026: YCharts, CoinLaw, SQ Magazine; gas limit 60M: Cointelegraph, The Block (Nov 2025)
- L2 fees: AlinaSchan/l2fees README (2026-09-15); Arbiscan gas tracker; Base scaling posts (blog.base.dev)
- DA prices: dalayers.com (2026-03), defi-intel.com, BlockEden (2026-01)
- Bitcoin Core v30 / illegal content: Cointelegraph, Protos (2025)
- Glamsterdam/Hegotá timing: QuickNode, Base blog, CryptoSlate, Tatum, eipsinsight
