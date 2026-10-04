# Prior art and market context for NFTs that ARE apps

Research date: 2026-10-02/03. Method: 33 distinct web searches (WebSearch + Exa), 20 primary/secondary pages fetched in full (EIP/ERC texts at eips.ethereum.org / ercs.ethereum.org and the ERCs GitHub asset file, GitHub READMEs, protocol docs, post-mortems, dated news), plus 2 on-chain address lookups through Blockscout (Ethereum mainnet) to confirm deployed contracts. Each claim below names its source and date. Claims that rest only on secondary or market-research sources are marked **unverified**; nothing here invents an EIP number, address or date.

Scope: the four-repo merge goal (one ERC-721 that gives its holder a swap, a messaging/social layer, a launchpad and a vault, and whose `tokenURI`/`web3://` surface *is* the web app, no server, no IPFS). Two of the repos already embody halves of this: IPSEITY (`Premises.sol` answers `resolveMode() == "5219"` and implements `request(string[],KeyValue[])`; its `Standards.sol` explicitly refuses to claim ERC-7857) and ANIMA (ERC-6551 account per token, ERC-8004 identity/reputation/validation). This report is about what everyone else has done, what it cost them, and what the 2026 market rewards.

---

## 1. Executive summary

1. **The "NFT serves its own website" stack is standardised and shipping, but thin.** `web3://` (ERC-4804 Final, ERC-6860 Draft) plus ERC-5219 (Final) plus ERC-6944 (Draft) give a contract an HTTP-like `request()` surface. Gateways (`w3eth.io`, `w3link.io`, `web3gateway.dev`), a Chrome extension and an Electron browser exist; **no mainstream browser speaks `web3://` natively as of 2026**, so every real visitor arrives through a gateway. The EthStorage team's 2025-26 verifier work found a public gateway injecting a `<script>` tag into HTML pages — the trust gap is real and measured, not hypothetical.
2. **EIP-170 (24,576 bytes) is still the design force.** EIP-7907 (raise code size to 48 KB with metering) was *removed* from Fusaka before it activated on 2025-12-03 and has no champion; Base lists it among the Glamsterdam EIPs it most wants. Plan for 24 KB per contract for the life of the project.
3. **The best prior art for "token as program" is Terraforms (2021) and Autoglyphs (2019), not any 2024-26 project.** Terraforms exposes `tokenHTML`, `tokenSVG`, `tokenCharacters`, owner-writable canvas (`commitDreamToCanvas(uint,uint[16])`) and, decisively, *holder-selected renderers* (`setTokenURIAddress(uint[],uint)` over an append-only list). A `web3://terraformnavigator.eth` site generates dynamic pages from the token contract. That is the closest existing thing to "the NFT mints a website".
4. **Every NFT+social+finance combo of 2023-26 died or shrank the same way**: friend.tech ($90M fees, $44M to the team, shut Sept 2024 with the contracts' ownership sent to the null address), Stars Arena (reentrancy, $2.9M, Oct 2023), Fantasy.top (shut May 2026; "if a product prioritizes economics above all else, it attracts speculators, not users"; 70% of lifetime revenue in month one), Virtuals (agent-token revenue fell ~96% Jan→Feb 2025). Survivors (Pudgy Penguins, Zora, Virtuals-as-infrastructure) earn from something other than the speculative loop.
5. **The NFT market in 2026 is high-volume, low-price, Ethereum-led, Base-rising.** CryptoSlam: 2025 sales $5.63B (-37% vs $8.9B in 2024), supply 1.34B tokens, average sale $96, sector market cap ~$2.4B at end-2025. Base did $122M / 6.7M sales in 2025 and sits fourth weekly in Sept 2026 (~$3.3M/week). Physically-backed collectibles (Courtyard on Polygon) are the fastest-growing segment in every 2026 report, which says something about what buyers now trust.
6. **The 2026 primitives with real on-chain traction are agents (ERC-8004 mainnet 2026-01-29, >24k agents at launch, Base next) and content coins (Zora on Uniswap v4 with a 99%→0 ten-second sniper tax).** Intents (ERC-7683) are being redesigned in public because adoption was poor. Restaking and prediction markets are narratives, not NFT primitives, with no primary-source NFT crossover worth building on.
7. **Chain risk is now a first-order design input.** Lattice is winding down and Redstone (the "home for autonomous worlds") shuts 2026-05-15; MUD is "feature complete, OpenZeppelin-audited" and orphaned. An immutable, self-serving NFT must live on a chain that will outlive its authors, with a multi-chain plan that does not require a bridge for the token.

---

## 2. The standards stack, with the exact surfaces

### 2.1 `web3://` — ERC-4804 (Final) and ERC-6860 (Draft)

ERC-4804 ("Web3 URL to EVM Call Message Translation", created 2022-02-14, status Final) translates `web3://contract[:chainid]/path?query` into an `eth_call`. ERC-6860 (created 2023, Draft) supersedes it with RFC 3986 grammar, percent-encoding and fixes; its Appendix B lists the differences (manual-mode path *is* interpreted for MIME, auto-mode returns are treated as `bytes` not `bytes32`, `ethereum-web3://`/`eth-web3://` schemes removed). Both resolve the mode by calling `resolveMode()` — selector `keccak("resolveMode()")[0:4] = 0xDD473FAE` — which returns `bytes32`: empty/`"auto"`, `"manual"`, or (per ERC-6944) `"5219"`.

- **Auto mode**: path `/method/arg0/arg1?returns=(types)` is ABI-encoded from human-readable method + typed arguments (`uint256!9999`), returns decoded to JSON. Good for `web3://0xToken/tokenURI/42` style reads.
- **Manual mode**: raw path+query bytes are the calldata (`/` → `0x2f` when empty); the contract's `fallback` parses the path. Return is `bytes` treated as `text/html` unless the path's extension says otherwise.
- ERC-6821 (Draft) adds the ENS `contentcontract` TXT record so `web3://name.eth` can point at a contract on another chain.

Sources: https://eips.ethereum.org/EIPS/eip-4804 ; https://eips.ethereum.org/EIPS/eip-6860 (both fetched; 6860 text dated 2023-09-29 in the fetch metadata).

### 2.2 ERC-5219 Contract Resource Requests (Final, created 2022-07-10, author Gavin John)

The normative interface, from the ERCs repository asset file (fetched verbatim, CC0):

```solidity
struct KeyValue { string key; string value; }

interface IDecentralizedApp {
    /// @notice Send an HTTP GET-like request to this contract
    /// @param resource The resource to request (e.g. "/asdf/1234" turns in to ["asdf", "1234"])
    /// @param params   The query parameters (e.g. "?asdf=1234&foo=bar")
    /// @return statusCode The HTTP status code (e.g. 200)
    /// @return body       The body of the response
    /// @return headers    A list of header names (e.g. [{ key: "Content-Type", value: "application/json" }])
    function request(string[] memory resource, KeyValue[] memory params)
        external view returns (uint16 statusCode, string memory body, KeyValue[] headers);
}
```

Rationale points that matter for us (quoted from the spec): `request` is read-only because "Submitting a transaction to send a request would be costly"; "Complicated front-end logic should not be stored in the smart contract, as it would be costly to deploy and would be better run on the end-user's machine"; and "Other EIPs can be used to request state changing operations in conjunction with a `307 Temporary Redirect`". The spec also recommends the `message/external-body` MIME type to point at off-chain bodies — which we will *not* use, since the whole claim is nothing is fetched. Security considerations are one line: 3XX redirect privacy. Source: https://ercs.ethereum.org/ERCS/erc-5219 and https://raw.githubusercontent.com/ethereum/ERCs/master/assets/erc-5219/IDecentralizedApp.sol (both fetched).

### 2.3 ERC-6944 ERC-5219 Resolve Mode (Draft, created 2023-04-27)

```solidity
interface IERC5219Resolver is IDecentralizedApp {
    // MUST return "5219" (0x3532313900000000000000000000000000000000000000000000000000000000)
    function resolveMode() external pure returns (bytes32 mode);
}
```

ERC-165 was deliberately not used ("interoperability can be checked by calling `resolveMode`"). Streaming large bodies is done by the web3protocol clients via an `x-web3-next-chunk: web3://...` header loop (from the ethereum-magicians thread; this is client behaviour, not in the ERC text). IPSEITY's `Premises.sol` already does exactly this (`resolveMode()` returns `"5219"`, `request(string[] memory resource, KeyValue[] memory params)`), and its NatSpec notes the practical catch that a gateway must honour 5219 mode for it to matter. Sources: https://ercs.ethereum.org/ERCS/erc-6944 (fetched); https://ethereum-magicians.org/t/erc-5219-resolve-mode/14088 (search summary).

### 2.4 Clients and gateways (the part nobody controls)

- `ethstorage/web3url-gateway` (Go): serves `w3eth.io` (mainnet ENS only) and `w3link.io` (general), supports EIP-4804, 6821, 5219/6944 and even Bitcoin ordinals; has an `IsBehindHttpsProxy` setting that rewrites `web3://` links to `https://` gateway links. https://github.com/ethstorage/web3url-gateway (search highlight, repo dated 2023-05).
- `web3-protocol/web3protocol-http-gateway-js`: self-hostable gateway; default global fallback gateway is `web3gateway.dev`. Example in its README serves `web3://0xAD41bf1c7f22F0ec988DaC4C0aE79119Cab9BB7E=terraformnavigator.com`.
- `ComfyGummy/chrome-web3`: Chrome extension that intercepts `*.w3eth.io`/`*.w3link.io` and resolves in a service worker; it has to *rewrite HTML* to run inside a `chrome-extension://` origin, and notes Chrome will not let an extension register `web3://` until it is on the allowed-scheme list.
- `web3-protocol/evm-browser`: Electron browser, Frame wallet support; its showcase is `web3://terraformnavigator.eth/view/9352` — "pages are generated dynamically, these are not static pages".
- Brave's May 2025 `.brave` naming is an on-chain *name service*, not `web3://` support (Wikipedia/search; secondary). **No evidence of native `web3://` in Chrome, Safari, Firefox, Brave or Opera as of Oct 2026.**

### 2.5 The verification gap — measured

EthStorage's "Client-Side Verification for On-Chain Frontends" (web3-url-verifier repo, fetched): the thesis is the Feb 2025 Bybit loss (>$1.5B) where "no smart contract was broken" — the Safe{Wallet} frontend JS on S3 was modified. `web3://` removes the host but "users reach these sites through a gateway — a trusted server again". Their prototype (Colibri stateless light client: server-side prover, WASM verifier holding only the sync committee, ~0.45× download time) re-derives every byte against chain state and **"caught something live: the gateway we tested through injects a small `<script>` into some HTML pages to rewrite `web3://` links into `https://` ones — benign in intent, but it changes the bytes."** For contract-call resources (e.g. an NFT's `render(78,0)`) the check is a verified `eth_call` compared byte-for-byte with what the gateway served. Source: https://raw.githubusercontent.com/ethstorage/web3-url-verifier/main/verifiable-frontends.md (fetched; also https://blog.ethstorage.io/client-side-verification-for-on-chain-frontends/, 2025-26).

Implication: an NFT that *is* an app should expose a cheap, canonical, verifiable "what bytes should I have received" function (a content hash per route) so a wallet or extension can verify a gateway without a light client. Section 7 turns this into a recommendation.

### 2.6 Storage primitives: EthFS and scripty.sol

- **EthFS** (frolic/ethfs, README fetched): SSTORE2-style storage, files split into 24 KB chunks (max contract size) written to deterministic content addresses via the Safe Singleton Factory; `FileStore` is a "minimum viable registry, a global namespace of human-readable filenames". Deployed at `0xFe1411d6864592549AdE050215482e4385dFa0FB` on Ethereum (mainnet, Sepolia, Holesky), Base (mainnet, Sepolia), Optimism, Shape and Zora. (Blockscout confirmation on Base failed only because the free API budget was exhausted; address taken from the README — treat the Base deployment as README-verified, not chain-verified.)
- **scripty.sol** (intartnft, README fetched, MIT): "gas efficient, storage agnostic, on-chain HTML builder optimised for stitching together large JavaScript based tags"; `IScriptyBuilderV2.getHTMLString(HTMLRequest)` with `HTMLRequest{head[], body[]}` of `HTMLTag{tagOpen, tagContent, tagClose, tagType}`; supports EthFS and SSTORE2 back-ends, gzip+base64 and URL-safe variants for `animation_url`. Same addresses on Ethereum/Base/Optimism: ScriptyStorageV2 `0xbD11994aABB55Da86DC246EBB17C1Be0af5b7699`, ScriptyBuilderV2 `0xD7587F110E08F4D120A231bA97d3B577A81Df022`, ETHFSV2FileStorage `0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245`. Users: Art Blocks, Alba, CryptoCoaster, the metro, GOLD, Mint.

Both are "public, durable on-chain repositories" we can *read from* without depending on anyone — but depending on a shared library address is a dependency, and both repos' CLAUDE.md say no external dependency. The right use is as prior art for our own SSTORE2 sharding (IPSEITY's `Engine.sol` already does head+gap+body shards with a one-way `freeze()`), not as imports.

### 2.7 ERC-6551 Token Bound Accounts (Review; registry live since 2023-10-26)

Interfaces (fetched from the EIP):

```solidity
interface IERC6551Account {
    receive() external payable;
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);
    function state() external view returns (uint256);
    function isValidSigner(address signer, bytes calldata context) external view returns (bytes4 magicValue);
}
interface IERC6551Executable {
    function execute(address to, uint256 value, bytes calldata data, uint8 operation) external payable returns (bytes memory);
}
```

Account bytecode: ERC-1167 header (10 B) + implementation (20 B) + footer (15 B) + salt (32) + chainId (32) + tokenContract (32) + tokenId (32). Canonical registry `0x000000006551c19487814612e58FE06813775758` — **chain-verified via Blockscout on Ethereum mainnet: contract `ERC6551Registry`, verified source, created by `0x4e59b44847b379578588920cA78FbF26c0B4956C` (Nick's deterministic deployer) in block 18,432,800 on 2023-10-26T07:07:23Z**. Security considerations: "Decentralized marketplaces SHOULD implement protection" against the owner emptying the account between listing and sale (attach `state()` to orders, commit to assets, or lock the implementation); "All assets held in a token bound account may be rendered inaccessible if an ownership cycle is created" — an NFT sent to its own account is lost, and deeper cycles cannot be prevented on-chain. No documented exploit of a TBA implementation was found in 2024-26 searches (absence of evidence, not evidence of absence).

### 2.8 ERC-7857 AI Agents NFT with Private Metadata (Final, created 2025-01-02)

Authors Ming Wu, Jason Zeng, Wei Wu, Michael Heinrich (0G). Defines `IERC7857` (`iTransfer`, `iClone(..., TransferValidityProof[])`, `authorizeUsage`, `delegateAccess`, `revokeAuthorization`), `IERC7857Metadata.intelligentDataOf(uint256) → IntelligentData[]{dataDescription, dataHash}`, and `IERC7857DataVerifier.verifyTransferValidity(TransferValidityProof[]) → TransferValidityProofOutput[]` with `OracleType{TEE, ZKP}`; proofs carry `oldDataHash`, `newDataHash`, `sealedKey`, `encryptedPubKey`, nonces. Security: replay prevention, "Only hashes and sealed keys remain on-chain; actual data requires secure off-chain storage", ZKP cannot hold multi-party keys so a ZKP transfer needs re-encryption on next update, and the "Sealed Executor" is explicitly out of scope. IPSEITY's `Standards.sol` box-header gives three concrete reasons not to claim conformance (different selectors, no ERC-165 id, off-chain premise is the inverse of the work). That reasoning still holds in 2026; nothing in the Final text changes it. Source: https://ercs.ethereum.org/ERCS/erc-7857 (fetched).

### 2.9 ERC-8004 Trustless Agents (created 2025-08-13; mainnet 2026-01-29)

Three per-chain singleton registries. Identity Registry is "ERC-721 with the URIStorage extension"; `agentId` = tokenId, `agentURI` = tokenURI, which "MAY use … a base64-encoded `data:` URI … for fully on-chain metadata"; registration JSON lists `services` (web, A2A, MCP, OASF, ENS, DID, email), `x402Support`, `supportedTrust` (reputation / crypto-economic / tee-attestation). Reputation Registry stores `int128 value`, `uint8 valueDecimals`, `tag1/tag2`, `isRevoked` per `(agentId, clientAddress, feedbackIndex)`; endpoint/URI/hash are emitted, not stored. Validation Registry is "generic hooks" for stake-secured re-execution, zkML, TEE oracles. Sybil is acknowledged as unsolved. Adoption (secondary, dated): registries deployed on Ethereum mainnet 2026-01-29 with "over 24,000 registered agents" at launch (Forbes 2026-02-05; livebitcoinnews); later counts of "over 200,000 across networks" and a split "Ethereum 11,369 / Base 4,379 / Gnosis 2,679" appear in bitcoin.com / eco.com articles with inconsistent totals — **unverified**. Base is named as the next L2 deployment. ANIMA already keys its agent id to ERC-8004. Source: https://eips.ethereum.org/EIPS/eip-8004 (fetched).

### 2.10 ERC-7683 Cross Chain Intents (Draft, 2024-04-11; "Redux" 2026-02-06)

The Feb 2026 ethereum-magicians "ERC-7683 Redux: Programmable Fillers" post (Across, Uniswap, LI.FI, OpenZeppelin, Open Intents Framework) says plainly: "despite significant interest across the ecosystem [ERC-7683] hasn't gained much adoption", because of "non-standard `orderData`, conservative profit estimations, little room for protocol variability, and gas overhead". The redesign standardises only a *resolver* (resolved off-chain by `eth_call`) that turns a protocol payload into solver instructions plus explicit "assumptions". A reply raises exactly the issue a token-gated app would hit: a fill that "grants membership, creates protocol state, mints/accounting rights, accepts collateral" needs pre-fill origin proof. Verdict for us: intents are not a 2026 primitive to build the NFT around; at most, expose our swap as a resolver-compatible venue later. Sources: https://eips.ethereum.org/EIPS/eip-7683 ; https://ethereum-magicians.org/t/erc-7683-redux-programmable-fillers/27674.

### 2.11 Contract size: EIP-7907 did not ship

Fusaka activated on Ethereum mainnet 2025-12-03 21:49:11 UTC (secondary sources agree on the date). EIP-7907 (24 KB → 48 KB code, 48 → 96 KB initcode, 4 gas per 32 bytes above 24 KB) was "recently removed from Fusaka because it just wasn't ready" and "does not currently have a designated technical champion" (nixo.eth, July 2025). Base's Glamsterdam post lists EIP-7907 among the proposals most impactful for its builders ("the current code size limit is too restrictive and requires breaking complex contracts into multiple smaller contracts"). Status Oct 2026: not scheduled on any announced fork. **Design assumption: 24,576 bytes per contract, on every target chain, indefinitely.**

---

## 3. Prior art: tokens that are programs

### 3.1 Autoglyphs (Larva Labs, 2019-04-05)

"The first art project that was both generated and stored entirely on-chain." The contract computes the artwork: `draw(uint256 id) view returns (string)` emits 64×64 ASCII (4,160 bytes); minting (`createGlyph(uint256 seed) payable`) emits `Generated(index, address, value)` with the full output in the event. Deployed program is 6,638 bytes (the Larva Labs archive publishes the SHA-256 and shows the source recompiles byte-exact under solc 0.4.24 at 200 runs, *only* under its original Truffle path because the metadata hash covers the path). **Chain-verified via Blockscout**: `0xd4e4078ca3495DE5B1d4dB434BEbc5a986197782`, ERC-721, symbol `☵`, total supply 512, 182 holders, first tx 2019-04-05T21:13:34Z. Lessons: (a) "the art is the algorithm" — the generator is the work, outputs are renditions; (b) keep the generator tiny and the output tiny; (c) the instruction set (how to draw each glyph) lives in the source so anyone can re-render at any scale. Sources: https://www.larvalabs.com/autoglyphs ; https://www.larvalabs.com/archive ; Artnome 2019-04-08.

### 3.2 Terraforms by Mathcastles (2021-12-17) — the closest thing to "the NFT mints a website"

~9,910 animated 32×32 Unicode parcels of a 20-level "Hypercastle". From the community API reference (fanpack `docs/reference.md`, fetched):

- Token contract (`Terraforms.sol`): `tokenURI`, `tokenHTML(uint) view`, `tokenSVG(uint)`, `tokenCharacters(uint)`, `tokenTerrainValues(uint)`, `tokenHeightmapIndices(uint)`, `structureData(uint timestamp)`, `tokenSupplementalData(uint)`.
- **Holder-controlled rendering**: `addTokenURIAddress(address) onlyOwner` appends to a list; `setTokenURIAddress(uint[] tokens, uint index)` lets *the token owner* pick which renderer their token uses. The team can add renderers but cannot force one.
- **Owner-writable state**: `enterDream(uint)` flips a parcel to daydream mode (irreversible from terrain); `authorizeDreamer(uint, address)` grants a delegate, "revoked on transfer" in `_beforeTokenTransfer`; `commitDreamToCanvas(uint tokenId, uint[16] dream)` writes a 32×32 drawing on chain and flips to terraformed.
- Rendering stack: `TerraformsData.tokenHTML(status, placement, seed, decay, canvas)`; `characterSet(placement, seed) → (string[9] charset, uint font, uint fontsize, uint index)`; on-chain fonts; Perlin noise on chain; `zOscillation(level, decay, timestamp)` makes topography move with time; a decay function gives the structure a lifespan.
- V2 (2023+) lives behind UUPS proxies (`TerraformsData_v2_0`, `TerraformsTokenURI_v2_0`, `TerraformsBeacon_v2_0`, with `lock() onlyOwner notLocked` and `_authorizeUpgrade … notLocked`), i.e. upgradeable-until-locked — the opposite of IPSEITY's one-way `freeze()`/`sealRenderer()` but reconciled by the per-token renderer choice.
- `web3://terraformnavigator.eth` is a *separate* contract that renders dynamic HTML pages (`/view/9352`) by reading the token contract — a website generated from the NFT, served by `web3://`.
- Community tooling (terraformSandbox contract, oolong.lol editors, Terrafans) grew *because* every function is a public view; "Full on-chain storage is a mechanism, not just a storage choice: it makes composability, permanence, and third-party tooling credible properties that communities will build on" (Onchain Atlas).

Lessons for us: separate data, structure, noise and render contracts; make every intermediate (`tokenCharacters`, heightmaps) a public view so other contracts and sites can build on it; let the holder choose the renderer; revoke delegated write authority on transfer (same instinct as ANIMA's `_update` epoch roll).

### 3.3 Nouns DAO (2021-08-08) — on-chain SVG plus a treasury, and what the treasury did

One Noun auctioned daily; artwork generated and stored on chain; CC0. The V3 fork mechanism (minority escape hatch, ≥20% to trigger, 7-day freeze) executed Fork #0 on 2023-09-15: 472 of 846 Nouns (~56%) left with 16,757 ETH (~$27.3M), ~35.5 ETH per Noun, while the floor had been under 30 ETH in August — "pure arbitrage" (onchainattack.org; Decrypt 2023-09-15; CoinDesk 2023-09-22: the largest forker bought 44 Nouns in August "when it was clear they'd have to let a fork happen"). The fork DAO's treasury fell from 16,750 to 7,700 ETH in three days as members rage-quit (Blockworks 2023-09-19). By March 2024 three forks had returned ~600 Nouns (57% of 1,045) to the treasury, which stood at ~$22M (Bankless 2024-03-15); Auditless (2024-10) says the treasury "once colossal, reaching 30k ETH at its peak, is now trending towards 0" and "most auctions are still won by arbitrageurs". A Jan-2026 figure of ~9,200 ETH / 1,775 Nouns appears in a secondary source (daotimes) — **unverified**. Lesson: any token whose contract holds redeemable value per token invites book-value arbitrage; redemption must be either impossible or priced above floor by design.

### 3.4 Zora: every post is a coin (2025-26)

Docs (fetched): Uniswap V4 pools with custom hooks; "Sniper Tax decaying from 99% over 10 seconds"; 1% trading fee split among creator, referrer, protocol, LPs; 20% of fees "locked as permanent liquidity"; initial liquidity via Doppler. Creator Coins: 1B supply, 50% to creator vested 5 years. Content Coins: 1B, 10M to creator instantly, 990M in pool, backed by the creator coin. Trend Coins: 1 bps fee, full supply in pool. Numbers (secondary): 1.5M tokens and $420M volume by 2025-08-04; Coinbase's July 2025 Base-app rebrand pushed daily creations from ~4,000 to >15,000 and >$6M/day volume (CoinDesk 2025-07-26); "weekly protocol fees passed $8 million in early February 2026, daily token creation approaching 13,000" (search summary, **unverified**); mid-2026 figures of "$445M cumulative" vs "$1.6B in 2026" conflict across secondary sources — **unverified**. The mechanism lessons are solid regardless: anti-snipe at launch, fee-funded permanent liquidity, and *distribution* (the Base app feed) mattered more than the contracts.

### 3.5 Base Onchain Summer and the Base app

Onchain Summer 2024 (Base blog, fetched via search): "$5M+ in mint revenue for builders, creators, and projects", "2M+ unique wallets", "24M+ onchain assets minted"; Buildathon with 7,500+ builders. 2025 ran as a retroactive $250k "Onchain Summer Awards" judged on on-chain engagement, with mini apps registered on Base Build (July 9–Sept 2, 2025). In July 2025 Coinbase Wallet became the Base App (social feed, mini apps, Zora coining). The decisive 2026 change: "After April 9, 2026, the Base App treats all apps as standard web apps regardless of Farcaster manifests" with "wallet-native identity, Base.dev metadata, and wallet-address notifications" (Base docs "Migrate to a Standard Web App"). An on-chain site reachable at an `https://` gateway URL is, by that definition, a Base app candidate.

### 3.6 "On-chain OS" — MUD / Lattice / Redstone

Lattice's own description: "MUD, an open-source operating system for developing onchain applications" and "Redstone, a home for autonomous worlds" (lattice.xyz/about, fetched). Dark Forest (2020) was "the first fully onchain game — the game logic, and all of its data was written onchain". Outcome: "After five years, Lattice is winding down. Redstone shuts down May 15, 2026 (23:59 UTC)… withdraw before then — especially anything held in contracts like Uniswap pools" (Lattice on X; search summary dated 2026). MUD is "feature complete, OpenZeppelin-audited, fully open source"; DUST moved to its own Conduit-hosted chain. Lesson: excellent infrastructure with no business model dies, and an app-specific L2 can take its users' funds hostage to a withdrawal deadline. No other project branding itself an "on-chain OS" with meaningful traction was found; the term is mostly marketing for L1s.

### 3.7 OpenSea's pivot and the SVG lesson

OS2 shipped May 2025: 22+ chains, token trading, fees cut from 2.5% to 0.5%; of ~$6B 2025 volume, >$4B was token trading; the SEA token (announced Feb 2025 after the SEC closed its investigation) had its TGE "postponed indefinitely" from a March 30, 2026 slot as NFT market cap fell 50% YTD (Unchained; secondary). 2021's Check Point disclosure matters more for our design: a malicious SVG NFT, opened "under the https://storage.opensea.io subdomain", gained JavaScript and could drive a wallet prompt; OpenSea fixed it in under an hour on 2021-09-26. An NFT whose metadata *is* executable HTML must assume marketplaces will sandbox it (and that some will not).

---

## 4. Token-gated communities and the NFT+social+finance combos: what happened

| Project | Model | Peak | End state | Primary cause (their own words where available) |
|---|---|---|---|---|
| friend.tech (Base, Aug 2023) | bonding-curve "keys" gate chats | $52M deposits (Oct 2023), $2M fees/day; >50% of Base activity | Shut 2024-09-09; admin/ownership sent to null address; FRIEND -98%; deposits $4M; fees <$100/day; ~$90M fees total, $44M to team (DL News, fetched) | no retention beyond speculators; team sold 19,477 ETH Dec 2023–Jun 2024 (secondary) |
| Stars Arena (Avalanche, friend.tech fork) | same | — | $2.9M reentrancy loss 2023-10-07; share price inflated to ~$274k; 90% recovered for a 27,610 AVAX bounty (Halborn, fetched; CoinDesk) | reentrancy in share-sell path, no checks-effects-interactions |
| Fantasy.top (Blast, 2024) | influencer trading cards + prediction markets | DeFiLlama top-10 by fees in 2024; $7.05M cumulative fees | Shut 2026-05-20; refunded investors in full; ~$20M returned to community | "We tried to put crypto on top of a model that was never built for crypto"; "70% of lifetime revenue came in the first month of mainnet"; "if a product prioritizes economics above all else, it attracts speculators, not users"; never issued a token |
| Virtuals Protocol (Base, Oct 2024) | agent-token launchpad; 100 VIRTUAL to create, graduates at 42,000 VIRTUAL to Uniswap V2 with 10-year LP lock; 1% fee | ecosystem >$4.6B Jan 2025 | revenue ~$1.02M/day → ~$35k by late Feb 2025 (~-96%); VIRTUAL ~87-88% off ATH by spring 2026; still shipping ACP/GAME | "most agents were chatbots with tickers"; reserve-pairing is "leverage, not just alignment"; anti-snipe shipped after retail damage (Onchain Atlas; secondary) |
| Pudgy Penguins | PFP → consumer IP | >$13M retail, >1M plush (2024); PENGU airdropped to 6M+ wallets; ~$1.1B FDV at ~22× assumed $50M revenue | growing; IPO ambitions by 2027 | inverted strategy: "build a global IP that has an NFT, rather than being an NFT collection trying to become a brand" (CoinDesk Research, commissioned, 2025-12-30/2026-02-28) |
| Bored Ape / Yuga Labs | PFP + royalties | $4B valuation (2022) | royalties $8.7M (Q1 2023) → $2.5M (Q3 2023) after Blur's 0.5% minimum; layoffs Oct 2023; CryptoPunks IP sold to the non-profit Infinite Node Foundation May 2025 (~$20M reported, **unverified**) | royalties unenforceable on chain; marketplace race to the bottom |
| Nouns DAO | on-chain art + treasury governance | ~30k ETH treasury peak | fork arbitrage drained >half the treasury (Sept 2023); auctions "won by arbitrageurs" | redeemable book value > floor |

Common pattern (stated by Fantasy, visible in all): the loop that attracts the first cohort (speculative upside) is the loop that evicts them when upside fades, and a token launched before product-market fit turns the team into "portfolio managers". Survivors earned from outside the loop (Pudgy's plush, Zora's fee-on-everything via Coinbase distribution, Virtuals' infrastructure).

---

## 5. NFT market state, 2026

**Volumes (CryptoSlam via Cointelegraph, 2025-12-31, fetched):** 2025 sales ~$5.63B, down ~37% from $8.9B (2024); NFT supply 1.34B (+25% YoY, 35× since 2021's 38M); average sale $96 (from $124; ~$400 in 2021-22); CoinGecko sector market cap ~$2.4B at end-2025 vs $17B peak (Apr 2022) and $9.2B (Jan 2025). H1 2025 was $2.82B (DappRadar/CryptoSlam via Cointelegraph). Q1 2025 ~$1.5B, -61% YoY (Emergen, citing on-chain data).

**Chains:** Ethereum leads every ranking. One October-2025 snapshot: Ethereum $263M, Base $88M (Base above Solana and Polygon that month) — secondary, **unverified**. Base 2025: $122M volume, 6.7M sales; weekly Sept 2026 Base ~$3.3M in fourth place with ~2,900 buyers, Beezie the top Base collection (CryptoSlam via crypto.news; secondary). A claim that Solana did $4.7B in 2025 is inconsistent with CryptoSlam's $5.63B all-chain total and is **not credible as stated**. Bitcoin Ordinals and Polygon (Courtyard) take meaningful share by count. Research-firm "market size" numbers ($5.96B, $28B, $43B for 2025) are models with incompatible definitions — use CryptoSlam settled-sales figures only.

**Marketplaces:** OpenSea OS2 (0.5% fee, 22+ chains, ~71.5% of Ethereum NFT volume per secondary), Blur (0.5% min royalty, pro traders), Magic Eden (Solana/Bitcoin, Ethereum expansion), Tensor, Courtyard (vaulted graded cards on Polygon, "one of the largest NFT marketplaces by sales count in 2025" per Douglas Insights — model, **unverified**).

**Regulatory:** a 2026-03-17 SEC/CFTC interpretation placing "digital collectibles" outside the securities definition is reported by one market-research page; **unverified against the primary release** and should be checked before any positioning copy relies on it.

**What is growing:** physically-backed collectibles (every 2026 report), gaming assets by count, Base and Solana by buyer count, low-ticket mints; "NFTs in 2026 are less about digital art hype and more about practical applications … keys to communities, products, and services" is the consensus framing in secondary coverage, with ERC-6551 cited as the enabling primitive. What is shrinking: average price, PFP floors, royalty income.

**Positioning read-across:** a 4,096-supply (IPSEITY) or agent-count (ANIMA) edition with a real app inside is competing for a buyer who now pays ~$96 on average and distrusts promises. The buyer's checklist in 2026 is: can I verify it myself, does it keep working if the team disappears, and does it do something today.

---

## 6. Emerging 2026 trends, with evidence quality

- **AI agents** — strongest on-chain evidence: ERC-8004 mainnet (Jan 2026), Coinbase/MetaMask/EF/Google authorship, Base deployment next; Virtuals' Agent Commerce Protocol; x402 payments referenced in the ERC-8004 registration schema. Risk: the Virtuals boom-bust shows agent *tokens* behave like memecoins; agent *identity + reputation + bonded work* (ANIMA's model) is the durable part.
- **Intents** — ERC-7683 draft being redesigned (Feb 2026) because of poor adoption; Open Intents Framework. Not an NFT primitive yet.
- **Restaking** — secondary sources only; cited risks are slashing, correlated failures, opaque rewards. No primary NFT crossover found. ANIMA's slashable bond is a *local* restaking-like primitive and should be described as a bond, not restaking.
- **Prediction markets** — large narrative after Polymarket (2024); Fantasy.top pivoted "fully into social prediction markets" and still died; Base mini-app coverage lists prediction markets among embedded apps. Possible *feature* of a social layer (bets on in-room events), not a reason to exist.
- **RWA / physically backed** — RWA TVL figures of $19-27B (2025-26, secondary); Courtyard vaulted cards are the NFT instance. Not applicable to a fully on-chain artifact except as a lesson: buyers pay for things with verifiable backing.
- **Social distribution** — Base app folding Zora minting into the Farcaster feed (July 2025), Farcaster Frames v2 DAU surge (Jan 2024: 2,400 → 24,700 in a week per financefeeds; secondary), and the April 2026 "standard web apps" rule are the distribution channel that friend.tech never had.
- **Protocol upgrades** — Fusaka (2025-12-03) brought PeerDAS/blob scaling; EIP-7907 out; Glamsterdam pending. Cancun transient storage (used by 15 ANIMA contracts) is universal on L2s now.

---

## 7. Security lessons and incidents (and the control each implies)

1. **Frontend is the exploit** (Bybit, Feb 2025, >$1.5B; Safe{Wallet} JS on S3). Control: serve the app from chain; expose per-route content hashes so a wallet can verify the gateway.
2. **Gateways modify bytes** (EthStorage verifier caught `<script>` injection in 2025-26). Control: the on-chain app must tolerate being wrapped and must sign nothing based on a gateway-supplied value; selectors computed on chain (IPSEITY already does `_sel` on chain), amounts as BigInt, no floating point.
3. **Executable metadata in a privileged origin** (OpenSea SVG XSS, 2021-09-26). Control: our `tokenURI` HTML must be self-contained and safe when rendered in a sandboxed iframe *and* when rendered in a trusted origin; every chain/user string passes an escaper (IPSEITY's `Web.esc`/`jsonEsc` rule) — the `z<-z2+c` thumbnail breakage is the in-house proof.
4. **Reentrancy in share/curve sell paths** (Stars Arena, $2.9M). Control: checks-effects-interactions, pull-payment ledgers (`owed`/`earned`), no `try/catch` on gas-estimated paths (ANIMA rule).
5. **Authority outliving a sale** (ERC-6551 fraud section; Terraforms revokes `authorizedDreamer` on transfer; ANIMA's `_update` epoch roll). Control: one custody epoch that every delegated right keys off; `state()` committed in marketplace orders.
6. **Ownership cycles** (ERC-6551). Control: refuse transfers of the token to its own account(s) in `_update`; document that deeper cycles are the holder's responsibility.
7. **Book-value redemption** (Nouns fork). Control: no pro-rata redemption of a shared pool; per-token vaults are the holder's own money, not a treasury claim.
8. **Launch sniping** (Virtuals shipped fixes after damage; Zora's 99%→0 over 10 s tax). Control: anti-snipe at launch, not later; IPSEITY's `buy(agreed)`/`minOut + deadline` exact-value patterns.
9. **Team exit = rug by renounce** (friend.tech sent ownership to the null address *as* the shutdown). Control: be immutable from day one so there is nothing to renounce (ANIMA's diamond without `diamondCut`; IPSEITY's `freeze()`), and make the site survive the team.
10. **Chain death** (Redstone, 2026-05-15). Control: deploy on chains with independent reason to exist (Ethereum, Base, OP, Arbitrum); per-chain id bands with no token bridge (IPSEITY) rather than escrow bridges that depend on a messaging layer's longevity.
11. **ERC-7857 proofs** (replay, prover-visible keys under ZKP). Control: bind verifier statements to `tokenId` and `recipient` (IPSEITY's `IDataVerifier` NatSpec already says this).
12. **Upgradeable renderers** (Terraforms proxies). Control: if any renderer can change, the *holder* chooses it from an append-only list; never a team switch.

---

## 8. Recommendations for OUR project

**MUST**
- **Keep ERC-5219/6944 as the site surface and add a verifiable manifest route.** `request(["manifest"], [])` returns JSON mapping each route to `keccak256(body)` plus the engine shard hashes; wallets/extensions can then verify any gateway byte-for-byte without a light client. Rationale: §2.5 measured injection; ERC-5219 already allows arbitrary routes.
- **Design to 24,576 bytes per contract forever** (EIP-7907 removed from Fusaka, no champion). Companion contracts and SSTORE2 shards, as both repos already do; a diamond (ANIMA) for the token's ABI partition.
- **Make the holder's app a "standard web app" in the Base-app sense**: an `https://` gateway URL with wallet-native identity, no Farcaster manifest required after 2026-04-09. Rationale: it is the only large consumer distribution channel that is itself on Base.
- **Gate by proof, not by pageview.** The on-chain `request()` cannot know who is asking; token-gating happens client-side via `ownerOf`/`isValidSigner` (ERC-6551/1271) checks and server-less reads, and *only* state-changing calls are actually gated on chain. State the model honestly in the UI ("the page is public; the actions are yours").
- **One custody epoch, rolled on transfer, that every right keys off** (operators, session keys, room moderation, launch roles, lease, guardian). Rationale: ERC-6551 fraud section, Terraforms' `_beforeTokenTransfer`, ANIMA invariant 1.
- **Immutable from day one, with holder-selected renderers from an append-only list** (Terraforms' `setTokenURIAddress` pattern) if any rendering flexibility is wanted; never an admin switch.
- **No pro-rata redemption of any shared pool; no team token.** Rationale: Nouns fork; Fantasy's refusal; every friend.tech-style collapse.

**SHOULD**
- **Target Base as the primary chain, Ethereum mainnet as the canonical/home band, OP/Arbitrum as further bands**; avoid app-specific L2s (Redstone lesson). Base has the NFT buyer growth, the mini-app distribution, EthFS/scripty deployments, ERC-8004 next, and sub-cent fees for the social layer's log-only messaging.
- **Adopt Zora's launch mechanics for the launchpad**: decaying sniper tax from launch, fee-funded permanent liquidity, creator allocation vested; and Virtuals' graduation-with-locked-LP for anything that leaves the per-token curve.
- **Register each token's app in ERC-8004 terms** where it is an agent (ANIMA) — the Identity Registry is ERC-721 with `data:` URIs, so an on-chain registration file is spec-compliant and discoverable by every ERC-8004 client; `services[]` can carry the `web3://` endpoint.
- **Publish the `draw()`-style primitives** (Autoglyphs/Terraforms): every intermediate of the artwork and of the app state as a public view, so third-party sites and other tokens compose on it.
- **Keep the ERC-7857 refusal** and describe the sealed kernel under its own name; do not claim ERC-7857, ERC-7683 or "restaking".
- **Ship a verifier script** (`tools/verify-gateway.mjs`) that fetches via `w3eth.io`/`web3gateway.dev` and compares to local `eth_call`, extending IPSEITY's existing byte-for-byte `tokenURI` round-trip to the live gateway path.

**COULD**
- Register ENS `contentcontract` (ERC-6821) and a `.base.eth`/ENS name per chain band so `web3://name.eth` resolves without an address.
- Offer an ERC-7683-style resolver for the per-token pool later, if intents adoption recovers.
- Mirror Terraforms' "decay/lifespan" idea as a *social* mechanic (rooms that quiet unless the holder acts) rather than an economic one.

**AVOID**
- Any economic loop whose first-month revenue is the design (Fantasy: 70% in month one).
- A project token, bonding-curve "keys" to chats (friend.tech), treasury-backed redemption (Nouns), reserve-asset pairing of every launch to our own token (Virtuals: "contagion on the way down").
- Depending on EthFS/scripty addresses at runtime (external dependency, contrary to both CLAUDE.md files); copy the technique, not the address.
- Claiming native `web3://` support exists in any browser; say "served by the chain, reachable through any gateway, verifiable by hash".
- IPFS/`message/external-body` escape hatches even where ERC-5219 permits them.

---

## 9. Special ideas (things that would make this NFT stand out)

1. **Self-verifying site**: `request(["verify"], [{key:"route",value:"/c/42"}])` returns the hash a client should see; the page itself displays "verified against chain at block N" when a wallet extension confirms it — the first NFT whose website proves its own integrity (EthStorage's verifier shows the demand; nobody ships it inside the token).
2. **Holder-selected renderer *and* holder-selected app shell**: an append-only list of `Chrome`/`Desk` page sets; a holder can pin their token's site to a specific immutable version forever, Terraforms-style, so no future "upgrade" can change what they bought.
3. **The token is its own ERC-8004 registration file**: `agentURI` is a `data:` JSON built on chain from live state (services = the token's own `web3://` routes, its ERC-6551 account, its reputation score), so every agent client in 2026 can discover the NFT's app without us running anything.
4. **Per-token pool whose curve is the artwork's state** (IPSEITY already anchors the curve to orientation) extended so the *social layer* feeds it: room activity sets a visible, auditable parameter, never a swap-path one (anchored, recomputed only on explicit actions).
5. **"Dark Forest" moment for the social layer**: log-only, back-linked messages (Parley) plus an on-chain *plugin registry* so holders can publish client extensions as further immutable pages — the thing that made Dark Forest and OPCraft emergent was third-party clients, which only works when every read is a public view.
6. **Autoglyph-grade archival claim**: publish the solc input that reproduces every deployed byte including the metadata hash, as Larva Labs did in 2025-26 for Autoglyphs; make `npm run verify` produce the same artifact the archive would.
7. **Physical hook without a physical dependency**: a QR/NFC "plate" that resolves to `web3://` + the token's hash (Pudgy's QR-coded toys drive its Asia retail) — the chain remains the only source of truth.
8. **Panic epoch**: one call rolls every epoch, seals the account and emits an event the on-chain site renders ("sealed since block N") — turns the ERC-6551 fraud problem into a visible, buyer-checkable state.

---

## 10. Open questions

1. Which public gateways honour ERC-6944 `"5219"` mode today, and do they stream via `x-web3-next-chunk` for bodies above a single `eth_call` response limit? (The ~104 KB face-0 document and a ~129 KB `tokenURIs()` are near practical RPC limits on some providers.)
2. Will any browser or wallet ship `web3://` or a built-in hash verifier in 2026-27? If not, is a signed-extension of ours (or a contribution to chrome-web3/evm-browser) worth the maintenance?
3. Is Base's "standard web app" registry (Base.dev metadata) compatible with a site that has no origin server — does it accept a gateway URL, and does the gateway's `IsBehindHttpsProxy` link rewriting break the app?
4. Canonical ERC-6551 registry (`0x…5758`, verified live) versus our own account with a bound implementation: compatibility with marketplaces' `state()` snapshots versus control over the seal/epoch model.
5. ERC-8004 counts are inconsistent across sources (24k at launch; "200k across networks"; "11,369 Ethereum / 4,379 Base"); which registry addresses are canonical on Base, and when did they deploy?
6. The 2026-03-17 SEC/CFTC "digital collectibles" interpretation: confirm the primary text before any marketing relies on it.
7. If EIP-7907 lands in Glamsterdam, do we take the 48 KB (with 4 gas/32 B metering) or keep 24 KB for chain portability? (Recommendation: keep 24 KB; L2s adopt L1 EIPs on their own schedules.)
8. Zora/Base-app volume figures for 2026 conflict ($445M cumulative vs $1.6B YTD); a primary (Dune/Zora dashboard) read is needed before quoting any of them.
9. Does the four-chain band plan (IPSEITY) survive a chain shutdown? Redstone shows an L2 can end on 90 days' notice; the design needs an explicit "band orphaned" rule.

---

## Sources (date = publication or fetch date; P = primary fetched in full; S = secondary/search summary; C = chain-verified)

- P ERC-4804 https://eips.ethereum.org/EIPS/eip-4804 (2022-02-14, Final)
- P ERC-6860 https://eips.ethereum.org/EIPS/eip-6860 (2023-09-29, Draft)
- P ERC-5219 https://ercs.ethereum.org/ERCS/erc-5219 (2022-07-10, Final) and asset https://raw.githubusercontent.com/ethereum/ERCs/master/assets/erc-5219/IDecentralizedApp.sol
- P ERC-6944 https://ercs.ethereum.org/ERCS/erc-6944 (2023-04-27, Draft)
- S ERC-5219 Resolve Mode thread https://ethereum-magicians.org/t/erc-5219-resolve-mode/14088
- P ERC-6551 https://eips.ethereum.org/EIPS/eip-6551 (2023-02-23)
- C ERC6551Registry 0x000000006551c19487814612e58FE06813775758, Blockscout Ethereum, created 2023-10-26
- P ERC-7857 https://ercs.ethereum.org/ERCS/erc-7857 (2025-01-02, Final)
- P ERC-8004 https://eips.ethereum.org/EIPS/eip-8004 (2025-08-13)
- S ERC-8004 mainnet coverage: Forbes 2026-02-05; livebitcoinnews; news.bitcoin.com; eco.com (counts unverified)
- P ERC-7683 https://eips.ethereum.org/EIPS/eip-7683 (2024-04-11, Draft); Redux thread https://ethereum-magicians.org/t/erc-7683-redux-programmable-fillers/27674 (2026-02-06)
- S EIP-7907 removal: nixo.eth on X (2025-07); Base Glamsterdam post https://blog.base.dev/glamsterdam-proposals; Fusaka date 2025-12-03 (multiple S)
- P EthFS README https://github.com/frolic/ethfs
- P scripty.sol README https://github.com/intartnft/scripty.sol
- P EthStorage verifiable frontends https://raw.githubusercontent.com/ethstorage/web3-url-verifier/main/verifiable-frontends.md (2025-26)
- S web3url-gateway https://github.com/ethstorage/web3url-gateway ; web3protocol-http-gateway-js ; chrome-web3 ; evm-browser (GitHub READMEs via search)
- S Larva Labs Autoglyphs https://www.larvalabs.com/autoglyphs and archive https://www.larvalabs.com/archive ; Artnome 2019-04-08
- C Autoglyphs 0xd4e4078ca3495DE5B1d4dB434BEbc5a986197782, Blockscout Ethereum, 512 supply, 182 holders, first tx 2019-04-05
- P Terraforms API reference https://raw.githubusercontent.com/d347h-eth/terraforms-fanpack/main/docs/reference.md ; S Onchain Atlas Terraforms; S ilikecalculus 2022-10-28; S terraforms-builder-resources
- S Nouns fork: Decrypt 2023-09-15; Blockworks 2023-09-19; CoinDesk 2023-09-22; onchainattack.org; Auditless 2024-10-22; P Bankless 2024-03-15
- P Zora Coins docs https://docs.zora.co/coins ; S CoinDesk 2025-07-26; S other 2026 Zora figures (unverified)
- S Base "Summer never ends" https://blog.base.org/summer-never-ends (2024); Onchain Summer Awards (2025); Base docs "Migrate to a Standard Web App" (2026)
- P Lattice about https://lattice.xyz/about ; S Lattice wind-down post on X (2026)
- P DL News friend.tech shutdown https://www.dlnews.com/articles/defi/friend-tech-shuts-down-after-revenue-and-users-plummet/ (2024-09-09)
- P Halborn Stars Arena https://www.halborn.com/blog/post/explained-the-stars-arena-hack-october-2023 (2023-10-09); S CoinDesk 2023-10-11
- S Fantasy.top post-mortem: techflowpost; The Block; Odaily 2026-05-21; crypto.news 2026-05-21; NFT News Today 2026-05-25
- S Virtuals Protocol history https://www.onchainatlas.org/virtuals-protocol/history/
- P CoinDesk Research Pudgy Penguins (commissioned) 2025-12-30 / 2026-02-28
- P The Block, Blur royalties vs Yuga 2023-10-09; S Yuga/Infinite Node Foundation May 2025 (The Block, Decrypt, ARTnews)
- P Cointelegraph CryptoSlam 2025 review 2025-12-31 https://cointelegraph.com/news/nft-supply-growth-sales-decline-2025 ; S H1 2025 $2.82B (Cointelegraph)
- S Base NFT 2025/2026 figures (CryptoSlam via crypto.news, Sept 2026); S Oct-2025 chain snapshot
- S OpenSea OS2/SEA: Unchained (2026), PRNewswire 2025-02, Cointelegraph
- S Check Point OpenSea SVG XSS 2021-09-26 https://research.checkpoint.com/2021/...
- S Market-research models (Emergen 2026-06-02; Douglas Insights 2026-09-27) — definitions incompatible, used only for segment direction
- Local: /home/user/Most-Advanced-NFT-Possible/src/Premises.sol (resolveMode "5219", request); src/interfaces/Standards.sol (ERC-7857 stance); /home/user/Cutting-edge-technologically-advanced-NFT/contracts/interfaces/IAnima.sol, IERC6551.sol
