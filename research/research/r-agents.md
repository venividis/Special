# Agent-native NFTs and standards — research report

Date: 2026-10-02. Prepared for the merged on-chain NFT protocol (swap + messaging/social + launchpad + vault, website minted from the token, no server, no IPFS). Scope: ERC-8004, ERC-7857, x402, the ERC-8xxx agent constellation, MCP, A2A, Coinbase AgentKit, Olas, Virtuals ACP, agent wallets and session keys, and what to publish so the NFT is usable by AI agents without degrading the human product.

Method: 24 distinct searches (WebSearch and Exa), 24 primary or first-party pages fetched (EIP/ERC text from the ethereum/ERCs repository and eips.ethereum.org, x402 v2 specification, A2A 1.0 specification, MCP 2025-11-25 changelog and security-best-practices page, llmstxt.org v2, Coinbase AgentKit README, Base and SIWA developer docs, OASF record guide, the ERC-8004 empirical study on arXiv, the Zealynx Bankrbot post-mortem, the Olas registries incident write-up, Virtuals' press release and whitepaper, and an ERC-8004 maintainers' issue thread). Each claim below carries its source and date. Where only secondary reporting exists the claim is marked **unverified**. No EIP numbers, addresses or dates are invented; where I could not confirm, the text says so.

---

## 1. Summary

- **ERC-8004 "Trustless Agents" is the identity layer the ecosystem converged on.** Status is still *Draft* in the ERCs repository (created 2025-08-13, requires 155/712/721/1271), but the reference registries went live on Ethereum mainnet on 2026-01-29 and are deployed at vanity CREATE2 addresses (`0x8004A169…` identity, `0x8004BAa1…` reputation) on Ethereum, Base, Arbitrum, Optimism, Polygon and more. An ERC-8004 agent *is* an ERC-721 token whose `tokenURI` resolves to a `registration-v1` JSON that may be a base64 `data:` URI — which is exactly the shape a fully on-chain NFT can emit. The registration file lists `services[]` (A2A, MCP, OASF, ENS, DID, web, email), `x402Support`, `registrations[]`, and `supportedTrust[]`.
- **The empirical picture is sobering.** An Imperial/Manchester study through 2026-05-13 found only 3 % / 4 % / 15 % of registrations (Ethereum / BSC / Base) expose a valid registration file with a live endpoint, and 73.5 % / 59.2 % / 90.6 % of reviewers show coordinated Sybil behaviour. Raw ERC-8004 feedback is not a trust signal. The maintainers' own issue tracker is converging on *settlement-grounded* feedback (x402 or escrow proof bound into `responseHash`/`feedbackHash`).
- **ERC-7857 is *Final* (created 2025-01-02).** It standardises private-metadata agent NFTs with TEE/ZKP-verified re-encryption on transfer (`iTransfer`, `iClone`, `authorizeUsage`, `IERC7857DataVerifier.verifyTransferValidity`). It does not inherit ERC-721 and depends on an off-chain "Sealed Executor"; conformance should only be claimed if the verifier interface is implemented. Both local repositories already take a careful stance on this.
- **Payments:** x402 v2 is now an open standard under the Linux Foundation's x402 Foundation (launched 2026-04-02; 40 members incl. AWS, Amex, Cloudflare, Coinbase, Google, Mastercard, Shopify, Solana Foundation, Stripe, Visa). The core is CAIP-2 network ids, EIP-3009 `transferWithAuthorization` for the `exact` scheme, and a facilitator `/verify`, `/settle`, `/supported` API. ERC-8183 "Agentic Commerce" (Draft, 2026-02-25, Virtuals + EF dAI team) standardises job escrow with a single evaluator and `IACPHook` before/after hooks.
- **Agent communication:** A2A 1.0.0 (Linux Foundation) with a canonical proto, `AgentCard{id,name,description,provider,capabilities,skills,interfaces,securitySchemes,security,extensions,signature,metadata}` and JWS-signed cards; MCP 2025-11-25 added OIDC discovery, incremental scope consent, icons, tool-name guidance, experimental durable tasks, and a formal security-best-practices page (confused deputy, token passthrough forbidden). llms.txt is at v2 (2026-08-10): `/llms.txt` at root *or any subpath*, `.md` twins of pages, and `Link: rel="alternate"/"describedby"` headers.
- **Agent wallets:** EIP-7702 is *Final*; ERC-6551 remains *Review*; ERC-7579 modular accounts, ERC-7715 (`wallet_requestExecutionPermissions`) + ERC-7710 (`redeemDelegations`) delegation, and Base Spend Permissions (`SpendPermission{account,spender,token,allowance,period,start,end,salt,extraData}`) are the three enforcement patterns. SIWA (Sign In With Agent) + ERC-8128 signed HTTP requests are Base's recommended agent-auth path, and they key authentication on `agentRegistry`+`agentId` — our token can be that registry.
- **Security:** The May 2026 Bankrbot incident (≈$150–200k of DRB moved by a Morse-coded prompt injection relayed through Grok, with privilege escalation by *transferring an NFT to the agent's wallet*) is the canonical lesson: on-chain policy, not prompts; capability grants must not be triggerable by an adversary's action; re-authenticate at every trust boundary. MCP tool poisoning / rug pulls (CVE-2025-54135, -54136), ElizaOS memory injection, the ClawHub skill supply-chain flood, and the Olas registries Safe-takeover bug (fixed June 2026, no loss) round out the threat model.

---

## 2. The landscape in one table

| Layer | Standard / project | Status (as of 2026-10-02) | What matters for us |
|---|---|---|---|
| Identity & discovery | ERC-8004 Trustless Agents | Draft text; reference registries live on mainnet since 2026-01-29 | `agentId == tokenId`, registration file may be a `data:` URI, `setAgentWallet` with EIP-712/1271 proof cleared on transfer |
| Private agent state | ERC-7857 | Final | `iTransfer`/`iClone`/`authorizeUsage` + TEE/ZKP verifier; do not claim without verifier |
| Commerce / escrow | ERC-8183 Agentic Commerce; Virtuals ACP | Draft (2026-02-25); ACP in production | Open→Funded→Submitted→Terminal, single evaluator, `IACPHook` |
| Coordination | ERC-8001 Agent Coordination Framework | Listed Final by a secondary survey (unverified) | EIP-712 intent + per-participant acceptances |
| Verification | ERC-8126 AI Agent Verification | Created 2026-01-15; requires 8004, 3009 | Attestations can be posted to the 8004 Validation Registry |
| Payments | x402 v2 | Open standard; x402 Foundation since 2026-04-02 | CAIP-2 ids, EIP-3009 `exact`, facilitator API, Bazaar discovery |
| Agent auth | SIWA + ERC-8128 | SIWA v1.0 "work in progress"; ERC-8128 text not retrievable | SIWA message carries `agentId`, `agentRegistry`, `chainId`, `nonce` |
| Agent comms | A2A 1.0.0 | Released (LF); 1.0 on 2026-03-12 per secondary sources | AgentCard fields, JWS-signed cards, `.well-known/agent-card.json` |
| Tools/context | MCP 2025-11-25 | Current revision | Tool poisoning + rug-pull are the threats; pin tool catalogs |
| Taxonomy | OASF (AGNTCY) | Record schema with `skills[]`/`domains[]` ids | Publish ids in registration file |
| Human/LLM docs | llms.txt v2 | 2026-08-10 | `/llms.txt` + `.md` twins + `Link:` headers |
| Wallets | ERC-6551 (Review), EIP-7702 (Final), ERC-7579, ERC-7715/7710, Base Spend Permissions | — | Session keys bounded by expiry, cap, target, selector; per-period caps |
| Extension pattern | ERC-7656 Generalized Contract-Linked Services | Created 2024-03-15 | Deterministic linked services per token without growing the token |
| Agent frameworks | Coinbase AgentKit; Olas; Virtuals | Active | AgentKit explicitly ships no spend caps or human approval; Olas = ERC-721 registries + Safe multisig per service |

---

## 3. ERC-8004 Trustless Agents

### 3.1 Status and deployment

- Text: `ethereum/ERCs` `ERCS/erc-8004.md`, status **Draft**, created 2025-08-13, authors Marco De Rossi (MetaMask), Davide Crapis (EF), Jordan Ellis (Google), Erik Reppel (Coinbase); requires EIP-155, 712, 721, 1271. (Fetched 2026-10-02.)
- Mainnet: launched 2026-01-29 (arXiv 2606.26028 states this; Forbes 2026-02-05 confirms "now live on mainnet" and reports 10,000+ agents and 20,000+ feedback entries during roughly three months of testnet). Secondary press claims ">45,000 agents at launch" and ">50 contributing organisations" — **unverified** against a primary source.
- Reference contracts (`erc-8004/erc-8004-contracts`, README fetched): `IdentityRegistryUpgradeable`, `ReputationRegistryUpgradeable`, `ValidationRegistryUpgradeable`. Mainnet addresses, identical across chains via the SAFE Singleton Factory: IdentityRegistry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, ReputationRegistry `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`; testnets use `0x8004A818…`, `0x8004B663…`, `0x8004Cb1B…`. The README carries a warning that the **Validation Registry section is still under active revision with the TEE community** and will be revised "later this year".
- Important for us: the canonical registries are **upgradeable proxies** curated by the 8004 team. That is a dependency-risk decision point (see §11).

### 3.2 The normative interface (from the ERC text)

Identity registry (ERC-721 + URIStorage):

```solidity
struct MetadataEntry { string metadataKey; bytes metadataValue; }
function register(string agentURI, MetadataEntry[] calldata metadata) external returns (uint256 agentId);
function register(string agentURI) external returns (uint256 agentId);
function register() external returns (uint256 agentId);
function setAgentURI(uint256 agentId, string calldata newURI) external;
function getMetadata(uint256 agentId, string memory metadataKey) external view returns (bytes memory);
function setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) external;
function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external; // EIP-712 or ERC-1271 proof from the wallet
function getAgentWallet(uint256 agentId) external view returns (address);
function unsetAgentWallet(uint256 agentId) external;
event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue);
```

`agentWallet` is reserved, initialised to the owner, and **automatically cleared on transfer**. The registration file (`"type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1"`) carries `name`, `description`, `image`, `services[]` (`web`, `A2A` → `/.well-known/agent-card.json`, `MCP` with `version: "2025-06-18"`, `OASF` with optional `skills[]`/`domains[]`, `ENS`, `DID`, `email`), `x402Support`, `active`, `registrations[]` (`agentId` + `agentRegistry` as `eip155:{chainId}:{identityRegistry}`), and optional `supportedTrust[]` (`reputation`, `crypto-economic`, `tee-attestation`). The ERC explicitly permits `data:application/json;base64,…` for fully on-chain metadata, and an optional `https://{endpoint-domain}/.well-known/agent-registration.json` for domain verification.

Reputation registry:

```solidity
function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash) external;
function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external;
function appendResponse(uint256 agentId, address clientAddress, uint64 feedbackIndex, string responseURI, bytes32 responseHash) external;
function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals); // clientAddresses MUST be non-empty
function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex) external view returns (int128, uint8, string, string, bool isRevoked);
```

The submitter MUST NOT be the owner or an approved operator. Suggested `tag1` values include `starred`, `reachable`, `uptime`, `successRate`, `responseTime`, `revenues`, `tradingYield`. The off-chain feedback file has a `proofOfPayment{fromAddress,toAddress,chainId,txHash}` slot "for x402 proof of payment".

Validation registry:

```solidity
function validationRequest(address validatorAddress, uint256 agentId, string requestURI, bytes32 requestHash) external; // owner/operator only
function validationResponse(bytes32 requestHash, uint8 response /*0-100*/, string responseURI, bytes32 responseHash, string tag) external; // validator only; may be called repeatedly (soft/hard finality)
function getValidationStatus(bytes32 requestHash) external view returns (address validatorAddress, uint256 agentId, uint8 response, bytes32 responseHash, string tag, uint256 lastUpdate);
function getSummary(uint256 agentId, address[] validatorAddresses, string tag) external view returns (uint64 count, uint8 averageResponse);
```

### 3.3 What the data says

"Can Trustless Agents Be Trusted?" (Xiong et al., arXiv 2606.26028, data through 2026-05-13, fetched): >170k registered agents and >150k feedback records across Ethereum/BSC/Base; only 3 % / 4 % / 15 % expose a valid registration file with ≥1 live endpoint; "the Registry, as currently deployed, cannot function as a trust signal: values are not commensurable, feedback records are rarely grounded in verifiable interactions, and reputation can be manipulated at minimal cost"; 73.5 % / 59.2 % / 90.6 % of reviewers show coordinated Sybil behaviour; after Sybil removal 15.8 % / 77.9 % / 86.8 % of rated agents have no valid feedback.

The maintainers' tracker (erc-8004-contracts issue #99, opened 2026-09-14, updated 2026-09-29) proposes making feedback admissible only with a settlement proof bound into `responseHash`, with grounding tags such as `x402-paid-interaction`, `escrow-released`, `outcome-vs-claim`. A commenter who implemented it reports three practical lessons: (1) bind the *rated agent* separately from `payee` because payouts can be sold; (2) the registries are external and upgradeable, so a registry write can revert — they wrapped it in `try/catch` so settlement still lands (see §11 for why our codebase handles this differently); (3) one interaction → at most one record; the registry writes cost ≈48k gas extra on a finalize call (465,486 vs 417,852).

A QuillAudits review (secondary, via search summary) recommends registration bonds with probation, reviewer-scoring aggregators and zk uniqueness for high stakes — **unverified** beyond the summary.

### 3.4 Adjacent registries

ERC-8122 "Minimal Agent Registry" (Draft) answers the singleton objection: an ERC-6909-based registry anyone can deploy, with fully on-chain metadata (ERC-8048) and ERC-7930 cross-chain ids, for curated or fixed-supply collections. ERC-8041 "Fixed-Supply Agent NFT Collections" (Draft) builds on 8004. Both are relevant because our token *is* a fixed-supply collection that wants to be its own registry.

---

## 4. ERC-7857 — AI Agent NFTs with Private Metadata

Text fetched from `ethereum/ERCs`: status **Final**, created 2025-01-02, authors from 0G Labs. It defines three interfaces:

- `IERC7857DataVerifier.verifyTransferValidity(TransferValidityProof[]) → TransferValidityProofOutput[]` where the proof demonstrates knowledge of pre-images of `oldDataHash`, correct decrypt/re-encrypt to `newDataHash`, the new key sealed to the receiver's public key, and data availability signed by the receiver (or a delegated "access assistant"). `OracleType { TEE, ZKP }`.
- `IERC7857Metadata.intelligentDataOf(tokenId) → IntelligentData[]{dataDescription, dataHash}`.
- `IERC7857` with `iTransfer(to, tokenId, proofs)`, `iClone(to, tokenId, proofs) → newTokenId`, `authorizeUsage(tokenId, user)`, `revokeAuthorization`, `delegateAccess(assistant)`, `authorizedUsersOf`, and events `Transferred`, `Cloned`, `PublishedSealedKey`, `DelegateAccess`.

Design notes from the text: it deliberately does **not** inherit ERC-721; the "Sealed Executor" that authenticates authorised users and runs the agent privately is out of scope (trusted party, TEE or FHE); the reference verifier is an OpenZeppelin upgradeable contract with admin roles and a 7-day proof-nonce window, and ZKP verification is a `TODO`. The standard cannot make a previous plaintext holder forget what they saw — a limit both local repositories already document (IPSEITY `AGENT.md` §1; ANIMA's `SealPolicy`).

Ecosystem: 0G Labs markets iNFTs on 0G Chain + 0G Storage (0g.ai blog, Jan 2025). I found no independent audit of the reference verifier — **unverified**.

---

## 5. The ERC-8xxx constellation

Primary pages fetched: ERC-8004, ERC-8183, ERC-8126 (via eips highlight), ERC-8001 (via eips highlight), ERC-8122 (ercs.ethereum.org highlight). Two secondary surveys (rya-sge, 2026-07-06; tryethernal, 2026-09-09) enumerate the rest; statuses from those are **unverified** unless noted.

| ERC | Title | Status | Note |
|---|---|---|---|
| 8001 | Agent Coordination Framework | Created 2025-08-02; "Final" per survey (unverified) | EIP-712 intent + per-participant EIP-712/1271 acceptances; states None/Proposed/Ready/Executed/Cancelled/Expired |
| 8126 | AI Agent Verification | Created 2026-01-15; "Final" per survey (unverified) | ETV/MCV/SCV/WAV/WV verifications, 0–100 risk score, attestations into 8004 Validation Registry; co-author from Virtuals |
| 8183 | Agentic Commerce | Draft, 2026-02-25 | §6.3 |
| 8122 | Minimal Agent Registry | Draft | ERC-6909 registry, on-chain metadata |
| 8041 | Fixed-Supply Agent NFT Collections | Draft | requires 8004 |
| 8128 | Signed HTTP requests (SIWA) | spec text not retrievable from eips/ercs/raw (404 on 2026-10-02) | Described by Base docs: `Signature-Input`, `Signature`, `Content-Digest` headers |
| 8217 | Agent NFT Identity Bindings | Draft (per ANIMA docs + survey) | external binding registry |
| 8170 / 8171 / 8181 | AI-Native NFT; TBA Agent Registry; Self-Sovereign Agent NFT | Draft (survey) | all require ERC-6551 and/or 7857 |
| 8196 / 8199 / 8273 / 8257 | Agent Authenticated Wallet (Last Call per survey); Sandboxed Smart Wallet; Attestation-Gated Actions; Agent Tool Registry | unverified | execution/authorisation cluster |
| 8226 / 8033 | Regulated Agent Mandate; Agent Council Oracles | unverified | compliance cluster |
| PR #1815 | "AI Agent Workflow Execution Interface" | open PR | `agentWorkflowHash` committed at dispatch; `onAgentStep(stage,isFinal)`; cites ERC-8274/8263/8275/8281/8299 (unverified numbers) |

The tryethernal piece makes a point worth repeating: of ten live agent ERCs in September 2026 none is Final, four depend on ERC-6551 which is itself only *Review*. Composability is real but the foundations are soft; our contracts should implement interfaces verbatim but not *depend* on external drafts for correctness.

---

## 6. Payments and commerce

### 6.1 x402 v2 (spec fetched from `coinbase/x402`)

Three components: resource server, client, facilitator. Flow: request → "payment required" + `PaymentRequired{x402Version:2, resource{url,description,mimeType}, accepts[], extensions}` → client retries with `PaymentPayload{accepted, payload{signature, authorization{from,to,value,validAfter,validBefore,nonce}}}` → `SettlementResponse{success, transaction, network, payer}`. `PaymentRequirements{scheme:"exact", network:"eip155:8453" (CAIP-2), amount (atomic units), asset, payTo, maxTimeoutSeconds, extra{name,version}}`. The `exact` EVM scheme is EIP-3009 `transferWithAuthorization` (typed data `TransferWithAuthorization(from,to,value,validAfter,validBefore,nonce)`); facilitator verification = signature, balance, exact amount, time window, parameter match, simulation. Facilitator API: `POST /verify`, `POST /settle`, `GET /supported` (with `signers` per CAIP-2 pattern); discovery `GET /discovery/resources` ("Bazaar"). Transport bindings exist for HTTP, MCP and A2A (`google-agentic-commerce/a2a-x402`, which uses `X-PAYMENT` / `X-PAYMENT-RESPONSE` headers inside JSON-RPC).

Governance and numbers: x402 Foundation launched under the Linux Foundation on 2026-04-02 with 40 members (Coinbase docs, fetched); operational launch 2026-07-14 (secondary). Volume claims — ">100M payments within ~6 months of v2", "119M on Base + 35M on Solana, ≈$600M annualised as of March 2026" — are from secondary sources and **unverified**. Risk research: "When HTTP 402 Meets the Blockchain: Risks on Emerging x402 Payments" (arXiv 2607.19545, not fetched).

### 6.2 Coinbase AgentKit (README fetched)

Wallet providers: CDP, Privy, Viem (plus Solana examples); 50+ TypeScript / 30+ Python action providers; framework extensions for LangChain, Vercel AI SDK, MCP, AutoGen, OpenAI Agents SDK, PydanticAI, Strands. The README's "Managing Risk" section is unusually explicit and should be quoted in our docs: *"AgentKit does not gate transfers behind human approval, enforce spend caps, or allowlist destinations"*, and *"LLMs do not reliably distinguish instructions from data… Either surface, combined with a funded wallet and a fund-moving action provider… is sufficient for injected text to result in an onchain transfer."* The implication: the on-chain account must be the control plane.

### 6.3 ERC-8183 Agentic Commerce (text fetched)

Six states: Open, Funded, Submitted, Completed, Rejected, Expired. Roles: client, provider (may be `address(0)` at creation, set later via `setProvider`), evaluator (single address; may equal client; may be a contract verifying a ZK proof). Functions: `createJob(provider, evaluator, expiredAt, description, hook?)`, `setProvider`, `setBudget` (client *or* provider — negotiation), `fund(jobId, expectedBudget)` (front-running protection), `submit(jobId, bytes32 deliverable)`, `complete(jobId, bytes32 reason)`, `reject(jobId, reason)`, `claimRefund(jobId)` (permissionless after expiry, deliberately **not hookable**). Hooks: `IACPHook{beforeAction(jobId, selector, data), afterAction(jobId, selector, data)}`; a reverting hook blocks the job until expiry by design. Worked examples: a two-phase "FundTransferHook" for swap/bridge jobs and a "BiddingHook" verifying off-chain signed bids `keccak256(abi.encode(chainId, hook, jobId, bidAmount))`. Reputation interop with ERC-8004 is an optional extension.

### 6.4 Virtuals ACP

Whitepaper (fetched): four phases Request → Negotiation → Transaction → Evaluation, three roles Client/Provider/Evaluator, escrow until an evaluator verifies against a signed "Proof of Agreement". Press release 2026-02-12 (fetched): "over 18,000 agents", Virtuals Revenue Network distributing "up to $1 million per month" of protocol revenue to agents selling services through ACP. The "$479M Agentic GDP in Q1 2026" figure appears only in secondary blogs — **unverified**. ERC-8183 is ACP's standardised core.

### 6.5 Olas (Autonolas)

Docs fetched: components, agent blueprints and services are ERC-721s (Solmate base) with append-only hash history; services deploy a Gnosis Safe governed by registered agent instances; governance can pause minting but not transfers; Mech Marketplace sells on-chain requests with Native/Token/Nevermined pricing. Live numbers on olas.network (as of 2026-10-02 14:00 UTC, first-party): 14,730,314 agent-to-agent transactions across 7 chains; $109,749 marketplace turnover. Security: June 2026 Immunefi disclosure — a service in pre-registration with a recovery-enabled Safe could be adopted by an attacker's service via the same-address multisig adapter, then `recoverAccess` drained it; fix `mapMultisigServiceIds[multisig]` + `MultisigAlreadyBound`, back-filled with permissionless `bindMultisig`; ≈$11.4k exposed across 227 Safes, no loss. Lesson: **one-to-one binding between an agent identity and its account must be enforced on chain** (ERC-6551's deterministic address gives us this for free; Olas had to retrofit it).

---

## 7. Discovery and communication

### 7.1 A2A 1.0.0 (specification fetched)

Three layers: canonical proto data model, abstract operations (Send Message, Send Streaming Message, Get Task, List Tasks, Cancel, Subscribe, Get Agent Card), bindings (JSON-RPC, gRPC, HTTP+JSON). AgentCard fields: `id, name, description, provider, capabilities{streaming, pushNotifications, extendedAgentCard}, skills[]{id,name,description,inputSchema,outputSchema,extensions}, interfaces[]{type,url,protocol,tenant}, securitySchemes[] (APIKey, HTTPAuth, OAuth2, OpenIdConnect, MutualTls), security[], extensions[], signature (AgentCardSignature), metadata`. Section 8.4 signs cards with JWS after canonicalisation (secondary sources say JCS/RFC 8785 and that 1.0 shipped 2026-03-12 — the date is **unverified** from the spec page). Discovery is `/.well-known/agent-card.json` (ERC-8004 example and secondary sources; the spec section was truncated in my fetch).

### 7.2 MCP 2025-11-25 (changelog + security page fetched)

Major: OIDC discovery for authorization servers; icons on tools/resources/prompts (SEP-973); incremental scope consent via `WWW-Authenticate` (SEP-835); tool-name guidance (SEP-986); URL-mode elicitation; tool calling in sampling; OAuth Client ID Metadata Documents; experimental durable tasks (SEP-1686); JSON Schema 2020-12 default. Security best practices: the *confused deputy* attack on MCP proxies (static client id + dynamic registration + consent cookie) with mandatory per-client consent, exact `redirect_uri` matching, single-use `state`; and *token passthrough* is explicitly forbidden. Threat research: Invariant Labs' April 2025 tool-poisoning PoC; CVE-2025-54135 "CurXecute" (CVSS 8.5) and CVE-2025-54136 (CVSS 8.8, tool-definition "rug pull" after approval); MCPTox benchmark (353 tools from 45 live servers, 20 models, arXiv 2508.14925). The structural fix is to **pin the tool catalog's hash** and re-verify on every session — something an on-chain catalog can do natively.

### 7.3 OASF (record guide fetched)

Record = `name, description, version, schema_version, authors, created_at, skills[]{name (hierarchical, e.g. natural_language_processing/natural_language_generation/text_completion), id}, domains[]{name, id}, locators[]{type,url}, modules[]`; validated against a Draft-07 schema. ERC-8004 lets a registration file carry `OASF` as a service with `skills`/`domains`.

### 7.4 llms.txt v2 (llmstxt.org fetched, updated 2026-08-10)

`/llms.txt` at root **or any subpath** (covering URLs under it); H1 (required), blockquote summary, free sections, H2 "file lists" of `[name](url): notes`, an "Optional" section; `.md` twins of pages (`page.html.md` or `page.md`); `Link: </docs/page.html.md>; rel="alternate"; type="text/markdown", </docs/llms.txt>; rel="describedby"` HTTP headers; Chrome Lighthouse now audits for it; OpenAI, Anthropic and Gemini publish one. Adoption data (secondary, **unverified**): instances grew 4,088 → 36,120 (Jun 2025 → May 2026); an Ahrefs crawl found 97 % of llms.txt files received zero requests in May 2026; coding agents (Cursor, Claude Code, Copilot, Cline, Aider) are the real consumers. Conclusion: cheap to publish, used mainly by developer-facing agents — exactly the audience of a protocol whose "website" is the product.

---

## 8. Agent wallets, authority and authentication

- **ERC-6551** (Review): singleton registry at `0x000000006551c19487814612e58FE06813775758`, ERC-1167 proxies with `(salt, chainId, tokenContract, tokenId)` appended, `isValidSigner(signer, context) → 0x523e3260`, mandatory ERC-165 + ERC-1271. Security section: ownership cycles make assets permanently inaccessible; implement a lock to stop owners draining before sale. Both local repos (ANIMA `AgentAccount`, IPSEITY Reach/Grip) already build on it.
- **EIP-7702** (Final): `SET_CODE_TX_TYPE 0x04`, delegation indicator `0xef0100 || address`, the motivation lists "privilege de-escalation: … sub-keys with much weaker permissions". Lets a human EOA grant a bounded session to an agent without migrating.
- **ERC-7579**: validators (type 1), executors, fallback handlers, hooks (type 4); `installModule/uninstallModule`; `isValidSignatureWithSender` for 1271 forwarding. Draft ERC "Agent Permission Validator" (EIPs issue #11419) proposes `PermissionScope{allowedProtocols, allowedSelectors, allowedTokens, perTxSpendCapUSD, dailySpendCapUSD, validFrom, validUntil, windowDaysMask, …}` — unmerged.
- **ERC-7715** (`wallet_requestExecutionPermissions`, requires 4337 + 7710) and **ERC-7710** (`redeemDelegations(bytes[] permissionContexts, bytes32[] modes, bytes[] executionCallData)` with ERC-7579 execution modes; MetaMask Delegation Framework as reference with caveat enforcers). Key property stated in MetaMask docs via LLM4Agents (2026-07-15): the session account holds no funds; it redeems a delegation against the funded account.
- **Base Spend Permissions** (`coinbase/spend-permissions`, Cantina competition): `SpendPermission{account, spender, token, allowance (uint160), period (uint48), start, end, salt, extraData}`; the `SpendPermissionManager` singleton is added as an *owner* of the smart wallet rather than routed via the 4337 EntryPoint "to avoid letting a paymaster spend the user's tokens on gas"; usage resets per period; `revoke` batchable. (Struct quoted from LLM4Agents' reproduction; the docs pages were only search-summarised — **struct field names verified only via that reproduction**.)
- **SIWA + ERC-8128** (Base docs and siwa.id fetched): agent requests a nonce, signs `{domain, uri, agentId, agentRegistry: "eip155:8453:0x8004A169…", chainId, nonce, issuedAt}`; server `verifySIWA(...)` checks the signature **and on-chain ownership of the ERC-8004 identity NFT**, returns a receipt; subsequent requests are signed per-request with ERC-8128 (`Signature-Input`, `Signature`, `Content-Digest` headers; EOA or ERC-1271 smart-account signers including "ERC-6551 Token Bound Accounts"). SIWA offers a keyring proxy so the agent process never holds the key ("protection against prompt injection"). Base's docs say: "Start with SIWA for the simplest integration path."
- **"Asset-enforced spend mandate"** (Ethereum Magicians, 2026-06-18, via LLM4Agents): `ISpendGate.isGated/checkTransfer` returning reason codes — early draft, **unverified**.

---

## 9. Security lessons and incidents

1. **Bankrbot, 2026-05-04** (Zealynx post-mortem 2026-05-15, fetched; tx `0x6fc7eb7d…5739a` on Base). Chain: (1) attacker transfers a Bankr Club Membership NFT to Grok's wallet — Bankr "reads on-chain holdings as capability tokens", upgrading the wallet from read-only to transfer-and-swap; (2) posts Morse code; (3) Grok decodes it; (4) Bankrbot treats Grok's @-mention as an authenticated command; (5) no human in the loop. 3,000,000,000 DRB (~$150–200k) moved; ~80 % returned. A guardrail blocking Grok-triggered transfers "had been removed before launch". Findings map to OWASP LLM01/LLM06: excessive agency, permissionless privilege grant, transitive trust. **Direct consequence for an NFT-gated product:** "holds the NFT" may unlock *read/UI* access; it must never unlock *value movement* for an agent — that requires an explicit holder-signed grant.
2. **Freysa, 2024-11-22**: 13.19 ETH won on the 482nd attempt by redefining `approveTransfer` semantics in context — a prompt rewrote the agent's understanding of its privileged function.
3. **ElizaOS memory injection** (Princeton/Sentient, arXiv 2503.16248, fetched): injected history in a shared memory store redirects later transfers across platforms (Discord → X); models are "significantly more vulnerable to memory injection compared to prompt injection"; ElizaOS bots managed >$25M. Proposed fix: HMAC/signatures on memory writes; "nobody is shipping that" (Zealynx).
4. **MCP tool poisoning / rug pulls**: Invariant Labs PoC (Apr 2025), CVE-2025-54135 (CurXecute: MCP content created `.cursor/mcp.json` without approval), CVE-2025-54136 (approved tool definitions silently change), "Rules File Backdoor" (hidden Unicode, Mar 2025). CSA research notes (2026-07) and MCP-38 taxonomy (arXiv 2603.18063).
5. **ClawHub supply chain, Feb 2026** (secondary: Dark Reading, Unit 42 via search): ~1,184 malicious OpenClaw "skills" (≈20 % of the marketplace), 111 posing as Solana/Phantom tools, 34 as Polymarket bots, delivering infostealers. **Unverified counts**, but the shape — a skill marketplace as the attack vector — is exactly what a launchpad for agent capabilities must defend against (immutable package hashes, declared permissions; ANIMA's research already rejected ERC-5169 token scripts for this reason).
6. **Olas registries, June 2026** — §6.5. Identity↔account binding must be enforced on chain.
7. **ERC-8004 Sybil findings** — §3.3. Reputation only counts when grounded in settlement.
8. **Confused-deputy and token passthrough in MCP** — §7.2. Our off-chain MCP bridges must never pass a user's wallet token or session key through to a third-party tool.

The common thread: *every control that mattered was on the policy layer the model cannot rewrite.* Our account contracts are that layer.

---

## 10. What the two local repositories already do (so recommendations fit)

- **ANIMA** (`Cutting-edge-technologically-advanced-NFT`): implements `IIdentityRegistry` *on the token* so `agentId == tokenId` (`contracts/interfaces/IERC8004.sol`), separate Reputation/Validation registries, ERC-6551 `AgentAccount` with session keys, budgets, ERC-4337, `WorkEscrow` (hire → deliver → settle/dispute), `InferenceMeter` EIP-712 vouchers, `AgentComms` priced inboxes, slashable bond, `getStateFingerprint`, `SealPolicy` adapted from ERC-7857, and a `registration-v1` manifest with exact-byte `manifestHash` (`docs/AGENT_INTEGRATION.md`, `docs/AGENT_ECOSYSTEM_RESEARCH_2026-09-17.md`, `docs/AGENT_CAPABILITY_CATALOG.md`). Its research already decided: "ERC-8004 identity with an ERC-6551 execution account, not a new iNFT format"; rejected ERC-5169; flagged ERC-7656 as the extension model; transfer revokes all seller authority.
- **IPSEITY** (`Most-Advanced-NFT-Possible`): fully on-chain site over `web3://` (ERC-5219 `Premises.request()`), two 6551 accounts per token (Reach with bounded `grantSession`: expiry, spend cap, target + selector allowlists; Grip with no outbound path), on-chain-computed selectors in Desk JSON configs, Parley log-only messaging, per-token AMM, Kiln launchpad, and an explicit refusal to claim ERC-7857 (`AGENT.md`, `Standards.sol`). Its "manifest" section (`AGENT.md` §4b) answers "how does an agent find out what it may do before a session key".

The merged protocol therefore already has the hard parts; the gap is *publishing them in the formats agents actually fetch* and tightening a few policies the incidents above make non-negotiable.

---

## 11. Recommendations for our project

Priorities: **MUST** / **SHOULD** / **COULD** / **AVOID**.

### MUST

1. **Be an ERC-8004 identity natively and emit the registration file from chain.** Keep `agentId == tokenId`; have `tokenURI`/`agentURI` return `data:application/json;base64,…` of a `registration-v1` document generated from state (name, image = the on-chain sigil, `services[]`, `registrations[]`, `supportedTrust`), and *also* serve it at `web3://…/.well-known/agent-registration.json` (the ERC's domain-verification file) and `/token/<id>/agent.json`. Rationale: the ERC permits data URIs; SIWA, 8004scan and Base docs key on `agentRegistry`+`agentId`; the arXiv study shows registrations without a reachable file are worthless. Implement `setAgentWallet` with the EIP-712/1271 proof and clear it in `_update` (ANIMA already does; IPSEITY must inherit it in the merge). Sources: ERC-8004 text; Base agent-registration docs; arXiv 2606.26028.
2. **On-chain policy is the only policy.** Session keys bounded by expiry, native + ERC-20 caps (per-tx and per-period, Base-style), target and selector allowlists; session keys never sign ERC-1271; guardian may only pause; transfer rolls the approval epoch and clears every grant. Add *per-period* caps (`period/start/end`) to match Spend Permissions semantics, and accept an ERC-7715-shaped permission request object as the canonical grant input so MetaMask/Base wallets can produce it. Rationale: AgentKit's own README says the SDK will not stop injected transfers; Bankrbot proves prompts are not controls. Sources: AgentKit README; Zealynx; ERC-7715/7710; Base Spend Permissions.
3. **No capability may be granted by an action the adversary controls.** Holding the NFT (or receiving one) may unlock *viewing* and *human* actions on the minted website; an **agent's** right to move value must come from a holder-signed `grantSession` to a named key — never from "wallet holds token X". Encode this as an invariant and a test ("a transferred-in NFT grants no session"). Source: Bankrbot step 1.
4. **Reputation only from settlement.** Write ERC-8004-shaped feedback/validation records *only* from escrow release, bond slash, or voucher settlement paths, tagged `escrow-released` / `bond-slashed` / `voucher-settled`, with `feedbackHash` bound to the on-chain receipt and the rated agent bound separately from the payee. Never surface `getSummary` without a `clientAddresses` filter. Rationale: Sybil rates of 59–91 %; maintainers' issue #99. Note the codebase rule "never wrap optional side effects in `try/catch` on a gas-estimated path": instead of the commenter's try/catch, make the reputation write a **separate, permissionless `publishFeedback(receiptId)` step** that anyone can call after settlement, so settlement never depends on an upgradeable external registry.
5. **Pin every machine-readable catalog by hash.** Tool/skill catalogs (MCP tool schemas, A2A `skills[]`, Desk selector configs) are derived on chain and their keccak is exposed (`manifestOf` already does this in ANIMA); off-chain bridges must refuse to run if the fetched catalog hash differs. This neutralises MCP rug pulls (CVE-2025-54136) structurally. Source: MCP security notes; CSA research.

### SHOULD

6. **Adopt the ERC-8183 state machine for hiring/escrow** (`Open → Funded → Submitted → Completed/Rejected/Expired`, single evaluator, `fund(jobId, expectedBudget)` front-running guard, permissionless `claimRefund` that is never hookable). Map `WorkEscrow` (hire→deliver→settle/dispute) onto it and emit its events so ACP/Virtuals tooling can index us; expose `IACPHook` so a launchpad or vault can be a job hook (e.g. the "FundTransferHook" two-phase swap pattern). Source: ERC-8183 text.
7. **Serve the agent-facing web from chain, in the formats agents fetch**: `/llms.txt` (root) and `/token/<id>/llms.txt` (subpath form is now in v2), `.md` twins of every page, `Link: rel="alternate"/"describedby"` headers (ERC-5219 responses carry headers), `/.well-known/agent-card.json` (A2A 1.0 fields, `interfaces[]` listing the `web3://` URL and any operator HTTPS mirror), `/.well-known/agent-registration.json`. Keep these *read-only* and *no-JS* so they cost nothing for the human product. Sources: llmstxt.org v2; A2A spec; ERC-8004.
8. **Authenticate agents with SIWA/ERC-8128 and humans with SIWE on the same gate.** The site's "connect wallet → verify NFT" flow accepts (a) SIWE from the holder, (b) SIWA whose `agentRegistry` is our token and whose signer validates via the token's ERC-6551 account (`isValidSignature`), and (c) a session key *only* for the selectors it was granted. Serve SIWA's `/skill.md`-style instructions from chain. Source: siwa.id docs; Base docs.
9. **Publish OASF `skills[]`/`domains[]` ids and MCP/A2A `version` strings in the registration file**; generate A2A `skills[].inputSchema/outputSchema` from the ABI (ANIMA's `anima-functions.json`). Source: OASF record guide; ERC-8004 services example.
10. **x402: advertise only what settles.** Set `x402Support: true` only when the holder's operator publishes an x402 `PaymentRequired` for a real resource; on chain, make `InferenceMeter`/`AgentComms` prices *expressible* as x402 `PaymentRequirements` JSON (CAIP-2 network, atomic `amount`, `asset`, `payTo` = the token's 6551 account, `maxTimeoutSeconds`) so an off-chain gateway can relay without re-encoding; accept EIP-3009 authorizations where our contracts pull ERC-20s. Sources: x402 v2 spec; ERC-8004 `proofOfPayment`.
11. **Keep ERC-7857 as an adapted design, not a claimed conformance**, unless we ship a verifier: `verifier()`, `iTransfer` with `TransferValidityProof`, `authorizeUsage`. Document the residual-knowledge limit. Source: ERC-7857 text; IPSEITY `AGENT.md`.
12. **Use ERC-7656 linked services for the four modules** (swap, messaging, launchpad, vault) rather than growing the token — deterministic `compute(implementation, salt, chainId, mode, linkedContract, linkedId)` addresses let the agent card list them before deployment and keep every contract under EIP-170. Source: ERC-7656; ANIMA research.

### COULD

13. **ERC-8001 multi-party intents** for agent-to-agent deals that need both sides' acceptances (e.g. OTC swaps between two tokens' agents). Source: ERC-8001.
14. **ERC-8126 verification attestations** into our Validation Registry as an optional provider-curated signal (ANIMA already lists it). 
15. **Sign the A2A card with the token's account** (ERC-1271 over the JCS-canonical card) in `metadata`, alongside or instead of JWS, and document the verification procedure; propose it upstream as an A2A extension.
16. **Mirror-register in the canonical per-chain ERC-8004 singleton** (`0x8004A169…`) with `registrations[]` listing both our token and the singleton id, so 8004scan/SIWA default tooling finds us; treat the singleton as discovery only, never as a correctness dependency (it is upgradeable).
17. **Attenuated sub-sessions**: a session key may mint a child key with a strictly smaller budget/window/allowlist (fleet budgeting from LLM4Agents).
18. **Commit a workflow hash before dispatch** (PR #1815's `agentWorkflowHash`) in `WorkEscrow.submit`'s `deliverable` so the evaluator can check the agent ran the committed procedure.

### AVOID

19. Admin keys or `diamondCut` over any registry or account implementation (both repos' invariant; the canonical 8004 registries being upgradeable is a reason to mirror, not depend).
20. Executable "manifest JavaScript", ERC-5169 token scripts, or any skill marketplace without immutable package hashes and declared permissions (ClawHub lesson).
21. Prompt-level guardrails as the only control; MCP token passthrough; shared cross-channel memory without signed provenance (ElizaOS).
22. Claiming "ERC-7857 compliant" via `supportsInterface` without a verifier; claiming reputation from unfiltered `getSummary`.

---

## 12. Special ideas (what would make our NFT stand out)

1. **The agent card is minted with the token.** `tokenURI` returns, in one document, the ERC-721 metadata, the ERC-8004 `registration-v1`, a nested A2A AgentCard and an MCP-shaped tool catalog — all generated from chain state and hash-pinned. No other collection ships an agent identity that is *complete at mint*.
2. **Settlement-grounded reputation as a product feature.** Every feedback record provably could not exist without an escrow release, bond slash or voucher settlement in the same protocol — the exact property the ERC-8004 maintainers are asking for in issue #99. Publish the tag convention and a verifier.
3. **An on-chain `llms.txt` per token** (`/token/<id>/llms.txt`) with `.md` twins and `Link:` headers from `Premises` — the first NFT whose "website" is natively legible to coding agents and Lighthouse's agentic audit.
4. **One gate, two principals.** SIWE for the human holder, SIWA for the token's agent (registry = our token), both verified against the same ERC-6551 account; the UI shows which principal is acting and what its session may do.
5. **Non-escalating capabilities.** A test-enforced invariant that receiving any token never changes an agent's authority — the Bankrbot class is impossible by construction.
6. **Rug-pull-proof tools.** MCP/A2A catalogs derived from on-chain selectors with a published hash; bridges refuse divergent catalogs. Sell this as "tool descriptions that cannot change under you".
7. **x402-shaped priced attention.** `AgentComms` inbox prices and inference vouchers emitted as x402 `PaymentRequirements`, so any x402 client can pay the agent's inbox or meter without bespoke code; the facilitator role is optional because settlement is already on chain.
8. **ERC-8183-native hiring with launchpad/vault hooks.** The launchpad can be a `BiddingHook`; the vault can be a `FundTransferHook` that escrows output tokens — composable with Virtuals' ACP tooling out of the box.
9. **Linked-service address book before deployment.** With ERC-7656 deterministic addresses the agent card can list swap/vault/launchpad/messaging endpoints for a token that has not deployed them yet ("counterfactual capabilities").
10. **A kill-switch that is a feature, not a liability.** Guardian-may-only-pause plus a dispute lock is precisely the human-in-the-loop control Bankr removed; advertise it in `supportedTrust` and the card.
11. **Validation-registry sink for TEE attestations**: when ERC-8004's TEE revision lands, our existing `ValidationRegistry` + `declareModel` (model id, weight root, runtime measurement) is already the right shape to accept enclave attestations as `validationResponse`.

---

## 13. Open questions

1. ERC-8004's Validation Registry revision (TEE) is promised "later this year" — implement to the current text now and version-gate, or wait? Which TEE oracles (Phala, Marlin are named in secondary sources) will be first?
2. Self-as-registry (our token) vs the per-chain singleton: do 8004scan, SIWA default criteria and Agent0 index arbitrary ERC-8004-shaped registries, or only the canonical addresses? If only canonical, mirror-registration (rec. 16) becomes a MUST.
3. A2A 1.0 requires JWS for signed cards; will verifiers accept an ERC-1271 signature extension, and which JCS canonicalisation library behaves identically on chain and off?
4. MCP needs a live server. What is the minimal honest "MCP from chain" story — a static tool catalog plus a holder-run local bridge — and how do we keep the bridge from becoming a confused deputy?
5. x402 without a server: do we want our contracts to *accept* EIP-3009 authorizations directly (pull-based) so that no facilitator is needed, and what does that do to the "money moves by pull" ledger rule?
6. ERC-8128's text is not reachable on eips/ercs/raw (404 on 2026-10-02); its status and header semantics are known only via Base/SIWA docs. Confirm before citing it in our spec.
7. Which chains? Base has first-party agent docs (8004, SIWA, x402, Spend Permissions); Olas and Virtuals are heaviest on Base/Gnosis; our bands span five chains — does the agent card list per-chain registrations?
8. Launchpad compliance: ERC-8226 "Regulated Agent Mandate" exists (unverified); do agent-launched tokens need a mandate/attestation gate?
9. Numbers to re-measure before publishing: x402 volume, "45,000 agents at launch", Virtuals aGDP, ClawHub counts — all secondary today.

---

## 14. Sources (fetched unless noted; date = page or publication date)

Primary:
- ERC-8004 text, `ethereum/ERCs` — https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-8004.md (Draft; created 2025-08-13)
- ERC-8004 reference contracts README — https://github.com/erc-8004/erc-8004-contracts (addresses; Validation Registry revision warning)
- ERC-8004 issue #99, settlement-grounded feedback — https://github.com/erc-8004/erc-8004-contracts/issues/99 (2026-09-14 → 2026-09-29)
- Xiong et al., "Can Trustless Agents Be Trusted?" — https://arxiv.org/abs/2606.26028 (data through 2026-05-13)
- ERC-7857 text — https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-7857.md (Final; created 2025-01-02)
- ERC-8183 text — https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-8183.md (Draft; created 2026-02-25)
- ERC-8001 — https://eips.ethereum.org/EIPS/eip-8001 (created 2025-08-02)
- ERC-8126 — https://eips.ethereum.org/EIPS/eip-8126 (created 2026-01-15)
- ERC-8122 — https://ercs.ethereum.org/ERCS/erc-8122
- ERC-7715 — https://eips.ethereum.org/EIPS/eip-7715 (created 2024-05-24)
- ERC-7710 — https://eips.ethereum.org/EIPS/eip-7710 (created 2024-05-20)
- ERC-7579 — https://eips.ethereum.org/EIPS/eip-7579
- ERC-6551 — https://eips.ethereum.org/EIPS/eip-6551
- EIP-7702 — https://eips.ethereum.org/EIPS/eip-7702 (Final)
- ERC-7656 — https://eips.ethereum.org/EIPS/eip-7656 (created 2024-03-15)
- x402 v2 specification — https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md
- x402 Foundation (Coinbase docs) — https://docs.cdp.coinbase.com/x402/support/x402-foundation (2026-04-02 launch)
- A2A 1.0.0 specification — https://a2a-protocol.org/latest/specification/
- a2a-x402 extension — https://github.com/google-agentic-commerce/a2a-x402 (search-verified only)
- MCP 2025-11-25 changelog — https://modelcontextprotocol.io/specification/2025-11-25/changelog
- MCP security best practices — https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices
- llms.txt v2 — https://llmstxt.org/ (updated 2026-08-10)
- Coinbase AgentKit README — https://github.com/coinbase/agentkit
- Base "Agent Registration & Identity" — https://docs.base.org/ai-agents/setup/agent-registration
- SIWA docs — https://siwa.id/docs (v1.0, "work in progress")
- OASF record guide — https://docs.agntcy.org/oasf/agent-record-guide/
- Olas protocol technical overview — https://stack.olas.network/protocol/technical_overview/ ; Mech Marketplace numbers — https://olas.network/mech-marketplace (as of 2026-10-02); registries incident — https://olas.network/blog/registries-update (2026-06-16)
- Virtuals press release — https://www.prnewswire.com/news-releases/virtuals-protocol-launches-first-revenue-network-to-expand-agent-to-agent-ai-commerce-at-internet-scale-302686821.html (2026-02-12); ACP whitepaper — https://whitepaper.virtuals.io/about-virtuals/commerce-layer
- Zealynx, "Indirect prompt injection: the Web3 agent attack chain" — https://www.zealynx.io/research/adversarial-security/indirect-prompt-injection (2026-05-15)
- Patlan et al., "Real AI Agents with Fake Memories" — https://arxiv.org/abs/2503.16248
- Forbes, "AI Agents Gain Trust Via Ethereum: ERC-8004 On Mainnet" — https://www.forbes.com/sites/digital-assets/2026/02/05/ai-agents-gain-trust-via-ethereum-erc-8004-on-mainnet/ (2026-02-05)

Secondary (search summaries; claims marked unverified where used):
- crypto.news / banklesstimes / news.bitcoin.com on ERC-8004 launch counts (Jan–Feb 2026)
- wavect.io x402 comparison (2026) for volume figures
- Sperax/erc8004-agents README (22-chain address list)
- rya-sge "ERC Standards for AI Agents" (2026-07-06); tryethernal "Composability Tax" (2026-09-09)
- CSA research notes on MCP tool poisoning (2026-07); MCPTox (arXiv 2508.14925)
- Dark Reading / Unit 42 on ClawHub malicious skills (Feb 2026)
- LLM4Agents, "Account abstraction for agent wallets" (2026-07-15) — Spend Permissions struct and ERC-7715 flow
- bex.co on Virtuals aGDP (2026-03/04)
- llms.txt adoption statistics (LLM Pulse, mecanik.dev, codersera, 2026)
