# Wallet-gated web experiences and ownership verification for a fully on-chain NFT

*Research memo, 2026-10-02. Scope: how the web page an NFT "mints" should discover a wallet, decide what the connected address may do, and ask for the fewest, safest signatures — with no server, no IPFS, no indexer. 21 searches, 37 primary pages fetched; each claim below names its source and date. Claims I could not confirm from a primary source are marked **unverified**.*

---

## 0. The one-paragraph answer

A page that serves itself from a contract has no secret to protect and no session store to protect it in, so **"holding is never login"** (IPSEITY's standing ruling, INTERFACE.md, 2026-08-23). The chain is the only verifier that matters: the page discovers providers with EIP-6963, asks for an address with EIP-1193 `eth_requestAccounts`, then asks the token contract — by `eth_call`, free, no signature — *what this address may do with this token*: holder, approved operator, the token's own ERC-6551 account, ERC-4907 renter, ERC-7432 role holder, or a delegate.xyz delegate. It renders controls accordingly and lets the contract refuse anything the predicate got wrong. Signatures are requested only when a signature is the product (a message to a peer, a voucher, an order), and then verified ERC-6492 → ERC-1271 → `ecrecover` so smart accounts, undeployed accounts and EIP-7702 EOAs all work. Writes go through ERC-5792 `wallet_sendCalls` when the wallet offers it (one approval for mint + deploy-account + open-market), with a sequential fallback. Sign-In with Ethereum (ERC-4361) is **not** needed for gating a serverless page and, if used at all, should be reserved for proving the NFT's identity to *third parties* via the token's own ERC-6551 account. The incident record of 2025 (Scam Sniffer: $83.85M lost to phishing; EIP-7702 drainers within weeks of Pectra) says the UX job is to minimise and explain every signature, never to add one for "login".

---

## 1. Where the page actually runs — three surfaces, three wallet realities

Before any gating design, the surface has to be named, because the same HTML behaves very differently depending on who loads it.

### 1.1 `tokenURI` → `animation_url` as a `data:` URI (marketplace iframe)

Marketplaces render HTML `animation_url`s inside a **sandboxed iframe with JavaScript and WebGL enabled** (Ethereum Magicians, "Standardizing metadata for Interactive NFTs"; OpenSea developer docs, both via search 2026-10-02). The injected `window.ethereum` object does not reach that sandbox, and EIP-6963 announcements do not cross it either. The Tokenbound iframe — the best-known "interactive NFT that shows its own account" — is **read-only**, embeds a `vercel.app` URL rather than a `data:` document, and "relies on Alchemy's indexer" (docs.tokenbound.org/iframe). Consequence: **the `data:` surface is a viewer, not a console.** It can read chain state only through a public RPC it carries in its own bytes (an external dependency the IPSEITY ruling tolerates for *reads* on the instrument), and it cannot sign. The right UX there is a "open the console" affordance that carries the `web3://` URL, not a dead "connect" button. IPSEITY's audit already catalogues "the read-only visitor who cannot leave for the console" as an engine-path friction (INTERFACE.md).

### 1.2 `web3://` through a public gateway (w3eth.io and friends)

ERC-6860 (Draft) translates `web3://contract[:chainId]/path` into an `eth_call`; the contract's `resolveMode()` picks `manual`, `auto`, or (ERC-6944, Draft) `5219`, where ERC-5219 (Final) defines `request(string[] resource, KeyValue[] params) → (uint16 statusCode, string body, KeyValue[] headers)` (eips.ethereum.org, fetched 2026-10-02). A gateway serves the result from an **https origin owned by the gateway**. That has two consequences the design must absorb:

- Browser-extension wallets *do* inject here, because it is an ordinary https page. This is the surface where connect, sign and send work.
- The page's **origin is the gateway's host, not the contract.** ERC-4361's domain binding, EIP-6963's `rdns` checks and WebAuthn's `rpId` all bind to that host. Any gateway can serve the page, and a hostile gateway can rewrite it. The page therefore must never trust its own origin for anything security-relevant; it must verify what it reads against the chain, and the contract must enforce every write regardless of who rendered the button.

ERC-6860 also defines an optional `userinfo@` component: "Optional sender address (defaults to 0x0)" — the gateway passes it as the `from` of the `eth_call`. That is a *presentation* hook (see Special ideas), never an authentication one: anyone can set `from` on an `eth_call`.

### 1.3 Native `web3://` clients

The only open-source Chrome handler I could find (ComfyGummy/chrome-web3) states plainly: "Connecting to web3 wallets (like Metamask) via `window.ethereum` also does not work, because this object is not injected on `chrome-extension` pages," suggests WalletConnect as the workaround, is unpublished, and calls itself "not yet safe for widespread use" (README, fetched 2026-10-02). EthStorage's own materials list three access paths — gateway (w3eth.io), a Chrome extension, and a native browser (secondary sources, 2023–2025; current native-wallet status **unverified**). Design for 1.2; treat 1.3 as a bonus.

**Recommendation (must):** ship one HTML document that detects its surface at load — `window.origin === "null"` / `location.protocol === "data:"` → viewer mode; EIP-6963 announcement or `window.ethereum` present → console mode; neither → read-only with a WalletConnect note — and never renders a connect control that cannot work.

---

## 2. Provider discovery and connection: EIP-6963 over `window.ethereum`

EIP-6963 (Final, created 2023-05-01) replaces the `window.ethereum` race with two window events: wallets dispatch `eip6963:announceProvider` carrying a frozen `{info: {uuid, name, icon, rdns}, provider}` and re-announce on `eip6963:requestProvider`. Its security section asks dApps to (a) `Object.freeze` what they receive against prototype pollution, (b) render the `icon` data-URI only through `<img>` so an SVG cannot execute, and (c) treat `rdns` as spoofable — verify consistent `uuid`s across announcements. EIP-1193 (Final) adds the principle every design here inherits: "treat the Provider object as though it is controlled by an adversary," plus the error codes the UI must map (4001 user rejected, 4100 unauthorized, 4200 unsupported method, 4900/4901 disconnected) and the events the page must react to (`accountsChanged`, `chainChanged`, `connect`, `disconnect`).

IPSEITY's engine already implements the right shape: collect EIP-6963 announcements, fall back to legacy `window.ethereum`, request `eth_requestAccounts`, read `eth_chainId`, subscribe to `accountsChanged`/`chainChanged`, offer `wallet_switchEthereumChain` then `wallet_addEthereumChain` (engine/ipseity.html, lines ~2063–2190). ANIMA's `AnimaWeb3Renderer` only looks at `window.ethereum` and loads viem from a CDN — both to be replaced. Pixel-Garden reloads the whole page on account/chain change; acceptable, but the unified page should recompute rights in place.

The incident that makes the picker non-negotiable: Trust Wallet's browser extension v2.68 shipped a malicious build in December 2025 and users lost "$6M+" before 2.69 (ccn.com via search; **secondary, unverified**). A page cannot defend against a compromised extension, but it can refuse to auto-select "the" provider, show name + icon + rdns, and never store a chosen provider across loads (no `localStorage` in the console — another standing IPSEITY ruling).

**Recommendation (must):** EIP-6963 picker, frozen details, `<img>` icons, legacy fallback only when nothing announces; `eth_accounts` (no prompt) for quiet reconnect, `eth_requestAccounts` only on a user gesture; chain compared to the token's chain *before* any button is enabled (IPSEITY's "the wrong chain refuses before the button").

**Could:** when a wallet advertises ERC-7846 (Draft, created 2024-12-15) `wallet_connect`, use it — it returns accounts and capability results in one approval; Base Account documents a `signInWithEthereum` capability inside it. Not required for our gating, because we do not need the SIWE proof (§4).

---

## 3. The verification model: an on-chain authorisation predicate, read for free

### 3.1 Why `ownerOf` is necessary but not sufficient

`ownerOf(tokenId)` is the canonical check and every repo here uses it (IPSEITY engine `readSig(S.collection,"ownerOf(uint256)")`; Pixel-Garden `core.ownerOf` + `custodyEpoch`; MASTER `collection.ownerOf(record.tokenId,{blockTag})`; ANIMA renderer `ownerOf`). But the four repos together already recognise five more kinds of legitimate actor, and the unified token inherits all of them:

| Actor | Where it already exists | Standard |
|---|---|---|
| Holder | all four | ERC-721 `ownerOf` |
| The token's own account (acting for itself) | IPSEITY `onlyOwner(id)` = holder **or the Reach**; ANIMA `accountOf` | ERC-6551 `account()` / `isValidSigner` |
| Operator approved by holder | ANIMA epoch-keyed `setOperator`, timed `setApprovalForAllUntil` | ERC-721 approvals (custodial — see below) |
| Renter / user | IPSEITY `userOf` + Lease; ANIMA `userOf`/`userExpires`, lease cleared on sale | ERC-4907 |
| Role holder (payer, auditor, trainer…) | ANIMA `AnimaRoles` (standalone ERC-7432 registry) | ERC-7432 |
| Session key | IPSEITY `grantSession`/`sessionAllows`/`executeAsSession`; ANIMA session keys that **cannot** sign ERC-1271 | account-local |
| Hot wallet of a cold vault | none yet | delegate.xyz v2 |

ERC-4907 (Final) gives `setUser(tokenId,user,expires)`, `userOf` (zero when expired), `userExpires`, interface id `0xad092b5c`, and the reference implementation **clears the user on transfer**. ERC-7432 (Final, created 2023-07-14) gives `Role{roleId,tokenAddress,tokenId,recipient,expirationDate,revocable,data}`, `grantRole`, `revokeRole`, `recipientOf`, `roleExpirationDate`, `isRoleRevocable`, `setRoleApprovalForAll`, plus `TokenLocked`/`TokenUnlocked` because a registry may take custody; it was designed to be "implemented externally or on the same contract as the NFT," which is exactly why ANIMA keeps it off the 24,576-byte token. ERC-6551's registry at `0x000000006551c19487814612e58FE06813775758` derives `account(implementation,salt,chainId,tokenContract,tokenId)`; the account must answer `isValidSigner(address,bytes) → 0x523e3260` and support ERC-1271 (eips.ethereum.org, fetched 2026-10-02).

A caution on ERC-721 approvals: `getApproved`/`isApprovedForAll` are *custody* rights (move the token), not *use* rights. Treating a marketplace operator as "may post messages as this NFT" is wrong; ANIMA's security invariant 1 (a sale epoch-rolls operators and clears guardian/lease/policy) shows the intended separation. The predicate below keeps custody and use as distinct bits.

### 3.2 delegate.xyz v2 as an optional external predicate

The v2 registry sits at `0x00000000000000447e69651d841bD8D104Bed493` on 30+ chains via CREATE2, is "fully immutable, no admin powers," and exposes `checkDelegateForAll(to,from,rights)`, `checkDelegateForContract(to,from,contract,rights)`, `checkDelegateForERC721(to,from,contract,tokenId,rights)` with a `bytes32 rights` namespace and `bool enable` toggles (github.com/delegatexyz/delegate-registry, fetched 2026-10-02). Its integration guide's pattern: `requester = msg.sender; if (cold != 0 && cold != msg.sender && REGISTRY.checkDelegateForERC721(msg.sender, cold, collection, id, rights)) requester = cold;` (docs.delegate.xyz). It is an *on-chain, immutable* dependency — not a server — so it does not break the "no server, no IPFS" rule, but it does break IPSEITY's "zero external Solidity dependencies" convention; reads must degrade like `ConsoleRead` (try/catch **plus** `extcodesize`) on chains where it is absent. Deployment and audit numbers for the registry were not on the page fetched (**unverified**).

### 3.3 The predicate, as code

One `view`, served by the token (or a thin satellite if the token is at the EIP-170 ceiling), that the page calls once per `(tokenId, account)` and again on every `accountsChanged`, `chainChanged`, and after every receipt:

```solidity
/// Rights are bits; the reason is for the UI, never for the contract.
uint16 constant R_HOLD    = 1;    // ownerOf == actor
uint16 constant R_ACCOUNT = 2;    // actor is the token's ERC-6551 account
uint16 constant R_USE     = 4;    // ERC-4907 userOf == actor (not expired)
uint16 constant R_CUSTODY = 8;    // getApproved / isApprovedForAll (move only)
uint16 constant R_ROLE    = 16;   // any live ERC-7432 role on this token
uint16 constant R_DELEG   = 32;   // delegate.xyz for (holder -> actor, rights)

function rightsOf(uint256 id, address actor, bytes32 right)
    external view returns (uint16 bits, uint64 epoch, address holder)
{
    holder = ownerOf(id);                       // reverts on nonexistent: "no answer" ≠ "zero"
    epoch  = custodyEpochOf(id);                // bumps on every transfer
    if (actor == holder) bits |= R_HOLD;
    if (actor == account(id)) bits |= R_ACCOUNT;
    if (userOf(id) == actor) bits |= R_USE;
    if (getApproved(id) == actor || isApprovedForAll(holder, actor)) bits |= R_CUSTODY;
    if (address(ROLES).code.length != 0 &&
        ROLES.recipientOf(address(this), id, right) == actor &&
        ROLES.roleExpirationDate(address(this), id, right) > block.timestamp) bits |= R_ROLE;
    if (address(DELEGATE).code.length != 0) {
        try DELEGATE.checkDelegateForERC721(actor, holder, address(this), id, right)
            returns (bool ok) { if (ok) bits |= R_DELEG; } catch {}
    }
}
```

Every *write* then enforces the same bits internally (`_require(id, msg.sender, R_HOLD | R_ACCOUNT | R_USE, right)`), so the page's rendering can be wrong without consequence. The `epoch` is the serverless session invalidator (§6): a page that remembers `(holder, epoch)` knows, on the next read, that a sale happened.

EIP-7702 changes nothing here: an upgraded EOA keeps its address; `ownerOf` still equals it. What *does* change is signature checking (§4.3) and the duty to warn (§7).

**Recommendation (must):** one `rightsOf` view; bits not booleans; custody separate from use; registries optional and extcodesize-guarded; the contract re-checks on every write.

---

## 4. When a signature is genuinely needed, verify it the modern way

### 4.1 Do not SIWE a page that verifies itself

ERC-4361 (Final, created 2021-10-11) is a server protocol: the relying party issues a nonce ("8+ alphanumeric"), binds `domain` to the request origin, checks `expiration-time`/`not-before`, and verifies by EIP-191 or ERC-1271. The 2026 GitHub record is full of implementations that got this wrong — nonce TOCTOU races (StepFi-API #116), missing domain binding letting "a SIWE message signed for any other domain… be replayed against a service" (wulong #23, OpenAd #15, truthbounty-api #525; all via search 2026-10-02). None of those failure modes apply to a page with no server: there is no session to steal and no endpoint to replay against. Asking the user for a `personal_sign` just to show them a "logged in" state adds one more signing prompt to a population that Scam Sniffer says is drained mainly through signing prompts (§7). The spec's own caveat also bites us: ERC-1271 results "can vary based on blockchain state," so an SCA's SIWE "session" should be invalidated when state changes — which is precisely what reading the chain every time already does.

Where SIWE *is* right: (a) a third-party service (a Discord bot, an off-chain game) wants proof that *this NFT* consents — the signer should then be the token's ERC-6551 account via ERC-1271, with ERC-5573 ReCaps (Draft) in the `resources` list to scope what the session may do; (b) WalletConnect One-Click Auth — `wallet_authenticate` (CAIP-222) with ReCaps, which Reown documents as supporting EIP-1271 and EIP-6492 and is migrating from "SIWE" to "SIWX" (docs.reown.com, fetched 2026-10-02). Both are optional add-ons, not gates.

### 4.2 The verification chain: ERC-6492 → ERC-1271 → `ecrecover` (→ ERC-8010)

ERC-1271 (Final): `isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)` with magic `0x1626ba7e`; the spec warns "no gas-limit expected" (do not hardcode a gas stipend) and that each implementer is responsible for correctness "otherwise catastrophic outcomes are to be expected." ERC-6492 (Final) wraps a signature for a not-yet-deployed account as `abi.encode(factory, factoryCalldata, originalSig) ‖ 0x6492…6492`; the suffix's last byte `0x92` cannot be a valid `v`, so it never collides with ECDSA; off-chain verification runs a deployless `eth_call` (`ValidateSigOffchain`) that deploys-then-checks inside the call and returns the result in revert data to stay reentrancy-safe. viem's public `verifyMessage`/`verifyTypedData` do exactly this and additionally handle "pre-delegated accounts via ERC-8010" (viem.sh, fetched 2026-10-02). ERC-8010 (jxom, PR opened 2025-08-21, still draft/review; the ercs.ethereum.org page 404'd on 2026-10-02) wraps `signature ‖ abi.encode(authorization, data) ‖ magic` so a verifier can simulate the EIP-7702 delegation and then run ERC-1271, falling back to ERC-6492; thread critics asked for nonce and chain-id checks (ethereum-magicians thread 25201).

Why order matters on chain: OpenZeppelin's `SignatureChecker.isValidSignatureNow` **branches on `signer.code.length`** — `ecrecover` for codeless addresses, `staticcall isValidSignature` with a `returndatasize > 31 && magic` check otherwise (raw master source, fetched 2026-10-02). An EIP-7702 EOA has code (`0xef0100‖address`), so OZ will route it to ERC-1271; MetaMask's delegator implements it, so this works, but a 7702 EOA delegated to a sweeper will fail and must surface as "this wallet's code is not a known account" rather than "bad signature." ANIMA's `libraries/ERC6492.sol` already does the on-chain version carefully: only honour the wrapper if the signer has no code, require that the factory call actually produced code before trusting the inner signature (otherwise an EOA could smuggle an arbitrary call), and strip the wrapper if the account was deployed after signing. Keep it, and keep it at settlement sites only — it is state-changing by design.

### 4.3 The account side: ERC-7739 and the two incidents that bracket it

Alchemy disclosed on **2023-10-27** that LightAccount, ZeroDev Kernel, Biconomy, Soul Wallet, eth-infinitism's EIP4337Fallback, Ambire, OKX, Argent and Fuse all returned the ERC-1271 magic for a signature made by their shared EOA owner *for a different account* — the hash did not bind the account address — so Permit2 transfers and CoW orders were replayable across accounts (alchemy.com, fetched 2026-10-02). ERC-7739 fixes this with a nested EIP-712 `TypedDataSign{contents, name, version, chainId, verifyingContract, salt}` so the wallet can still show the user what they sign; accounts advertise support by returning `0x77390001` for `isValidSignature(0x7739…7739, "")`.

The opposite failure arrived on **2026-08-25**: coinbase/smart-wallet issue #176 reports that wrapping the hash with `replaySafeHash()` *inside* `isValidSignature` makes a Coinbase Smart Wallet unusable as an owner of a Safe ≥1.4.1 — the Safe passes the raw hash, the smart wallet validates a transformed one, the 2-of-2 threshold can never be met, and the owner cannot be removed because that also needs the threshold: funds locked (github.com, fetched 2026-10-02). Lesson for our token's account: bind the account into the *signed* payload (ERC-7739's nested struct, computed on the signing side) rather than mutating the hash the verifier receives; and test the account as a Safe owner before shipping. IPSEITY's `IpseityAccount.isValidSignature` already gates sealed accounts on a purpose-bound attestation digest with a deadline; ANIMA's refuses session keys outright. Both are the right instincts.

**Recommendation (must):** browser verification through viem's deployless universal validator (EOA, 1271, 6492, 8010 in one call); on-chain verification only where a signature settles value, via the ERC-6492 library; the token's own account implements ERC-7739 and is tested as a Safe owner.

---

## 5. Delegation, rentals, roles and session keys as authorisation

Three delegation shapes exist and they are not interchangeable:

1. **Wallet-level delegation** (delegate.xyz v2, §3.2): a cold wallet names a hot wallet, optionally per contract/token/right. Pure read for us; the delegate acts in its own name and the contract resolves the vault. This is the right answer to "I keep the NFT in a hardware wallet and want to chat from my phone."
2. **Token-level roles and rentals** (ERC-4907, ERC-7432): the token itself (or its registry) records who may *use* it until when. Both standards clear or expire on transfer, which is what buyers need. ANIMA's `AnimaRoles` is a compliant external ERC-7432 registry; IPSEITY's Lease sells one term to one renter with `userOf` dark after expiry and rent owed to the token. Merge: ERC-4907 single `user` on the token for the lease, ERC-7432 registry for everything else.
3. **Account-level session keys** (IPSEITY `grantSession(key, expiry, cap, targets, selectors)` / `sessionAllows` / `executeAsSession`; ERC-7715 `wallet_requestExecutionPermissions` + ERC-7710 `redeemDelegations(permissionContexts, modes, executionCallData)` in MetaMask's Delegation Toolkit): a bounded key acts *through* the token's account. ERC-7715's own security note — "DApps should only request the permissions they need, with a reasonable expiration time" — matches IPSEITY's "check before act" rule and its `/k/<id>/<key>` key page, "the one surface in the system where the actor is not the holder."

The gating page must therefore render **who you are to this token**, with the source: "holder", "renter until 12 Oct", "role: payer, revocable", "delegate of 0x… (delegate.xyz, right `swap`)", "this token's own account", "session key, cap 0.2 ETH, 3 doors". Never a bare "connected."

**Recommendation (should):** honour delegate.xyz with a `rights` namespace per module (`keccak256("anima.swap")`, `("anima.talk")`, `("anima.launch")`, `("anima.vault")`), falling back to the empty right; refuse `R_DELEG` for the vault's *withdraw* paths (a hot wallet should never be able to drain the cold wallet's token — IPSEITY's GripVault has no outbound path at all, and that stays).

---

## 6. Sessions without a server: epochs, not cookies

What a server session would normally give — "this person proved control once; keep letting them in until it expires or something changes" — the chain gives for free if the token exposes a **custody epoch**. Pixel-Garden reads `ownerOf` and `custodyEpoch` together; ANIMA bumps `operatorEpoch` on sale so every operator grant dies in O(1) and keys approvals by `keccak256(owner, approvalEpoch[owner], operator)` so `revokeAllApprovals` is one write. Those are the primitives:

- The page keeps `(tokenId, account, holder, epoch, bits)` **in memory only**; on any `accountsChanged`, `chainChanged`, new block of interest, or receipt, it re-reads `rightsOf`. No `localStorage` for authority (IPSEITY ruling; also EIP-6963's fingerprinting note).
- Any signed artefact the token's account produces (messages, vouchers) includes the epoch and the account's ERC-6551 `state()`; a sale or a session revocation invalidates all of them with no revocation list. ERC-4361's "ERC-1271 is not pure" caveat becomes a feature.
- A shared-computer story needs no logout: closing the tab is logout, because nothing was stored.

---

## 7. Security lessons and incidents the UX must answer

**Phishing is a signing problem, and it tracks activity.** Scam Sniffer's 2025 report (published 2026-01-03): $83.85M lost across 106,106 victims, down 83% from $494M / 332,000 in 2024; among the 11 cases ≥ $1M, Permit/Permit2 took 38% ($8.72M), approve/increaseApproval $5.62M, plain transfers $4.87M, **EIP-7702 batch 2 cases $2.54M**, `setApprovalForAll` $1.23M; the largest single theft ($6.5M, September) was a Permit signature; Q3's $31M peak coincided with ETH's strongest rally. The report attributes the decline to market-loss correlation, not to tooling. Design response: our page should never ask for an unbounded ERC-20 `approve` or a Permit when a swap can take exact-value, `minOut` + `deadline` calls (IPSEITY's existing front-running defences), and every signing prompt must name the counterparty and amount in the page *and* in the EIP-712 message the wallet shows.

**EIP-7702 made one signature a permanent takeover.** Pectra activated 2025-05-07 (secondary sources). Within four weeks Wintermute found "over 97% of all EIP-7702 delegations" pointed to identical sweeper bytecode, spent ~2.88 ETH authorising ~79,000 addresses, and published the decompiled "CrimeEnjoyor" so explorers would label it (x.com/wintermute_t, 2025-05-30; CoinDesk 2025-06-02). An August 2025 victim lost $1.54M in wstETH/cbBTC; another $146K to an Inferno Drainer variant piggybacking a legitimate delegator (secondary). Qi et al. (arXiv 2512.12174, 2025-12-13) analysed 150k authorisation/execution events over 26k addresses and name three trigger pathways — user-driven, attacker-driven, protocol-triggered. The EIP's own security section lists the engineering hazards: `chain_id = 0` authorisations replay everywhere; delegate storage must be ERC-7201-namespaced; `msg.sender == tx.origin` is no longer "top frame only"; initialisation must be signed because there is no initcode. Design response: the page reads `eth_getCode(account)`; if it begins with `0xef0100`, it names the delegate and compares it to a short on-chain allowlist of known-good delegators (MetaMask, Ambire, Safe, OZ) — "your wallet is delegated to an unknown contract" is information the user needs before they fund a token's account from it. Our own contracts must never rely on `tx.origin`.

**ERC-1271 cuts both ways** (§4.3): replay across accounts when the hash is unbound (2023), funds locked when the verifier mutates the hash (2026). Test the token's account as a Safe owner; implement ERC-7739.

**The provider is hostile until proven otherwise.** EIP-1193's threat model, EIP-6963's rdns/uuid caveat, and the Trust Wallet 2.68 incident (Dec 2025, secondary) all say the same thing: the page can only lower blast radius — picker not auto-select, simulate every call with `eth_call` from the connected account before asking the wallet (ANIMA's renderer already does `simulateContract` first), decode the custom error and show it in words, and never sign an opaque hash.

**Passkeys move the boundary, not remove it.** CertiK (2026-06-16): once an attacker runs script under the target origin, "WebAuthn's rpId / origin binding no longer protects the flow"; contracts that check only `UP` accept any OS assertion, so enforce `UV` where the wallet requested it; the challenge must bind "account, chain ID, nonce, callData, and EntryPoint"; enforce low-S (CVE-2022-21449 is the cautionary tale); synced passkeys widen the boundary to the Apple/Google account and keep `signCount` at zero; verify `authenticatorData` flags and `clientDataJSON.type == "webauthn.get"`. On a gateway-served page the WebAuthn `rpId` is the gateway's host, so a credential registered via one gateway is not offered by the browser on another; the on-chain verifier does not care about the origin, but the UX must say "register your passkey from the gateway you will use." RIP-7212 (Final) puts P-256 verification at precompile `0x100`, 160-byte input, 3,450 gas, on L2s (Optimism, Base, zkSync Era, Polygon zkEVM, Linea, Arbitrum per secondary sources; **not** Ethereum mainnet as of the sources found); Safe's passkey module packs a 2-byte precompile address and a 20-byte fallback verifier into one `uint176` so the same signer works before and after a chain adopts it (safe-modules README, fetched 2026-10-02).

---

## 8. Batching and transaction UX: ERC-5792 with a fallback

EIP-5792 (Final, created 2022-10-17) defines `wallet_getCapabilities`, `wallet_sendCalls({version, chainId, from, calls:[{to,data,value}], capabilities, atomicRequired})`, `wallet_getCallsStatus` (100 pending, 200 confirmed, 400 off-chain failure, 500 full revert, **600 partial revert with some effects on chain**) and `wallet_showCallsStatus`; the `atomic` capability is `supported` / `ready` / `unsupported`, and the spec warns developers "must not assume single-transaction execution regardless of `atomic` values." MetaMask implements it by offering to upgrade the EOA via EIP-7702 (`atomic.status: "ready"` → `"supported"` after approval) on Ethereum, Gnosis, BNB, OP, Base, Polygon, Arbitrum, Unichain, Berachain, with `eth_sendTransaction` as the documented fallback (docs.metamask.io, fetched 2026-10-02). As of March 2026 the supporting-wallet list includes MetaMask, Coinbase Wallet, Rainbow, Trust, Safe, Ambire, Reown's embedded wallet, thirdweb, Openfort, Abstract (eip5792.xyz via search; **list unverified** against each wallet). wagmi ships `useCapabilities`/`useSendCalls` with a built-in sequential fallback (jxom, 2025-07).

For our token the batches that matter: **mint → deploy ERC-6551 account → open the market** (today three prompts), **approve exact → swap**, **grant role → fund session**. Each must also work as N sequential sends, and status 600 must be handled as "some of it happened; here is what" — never as success or failure. IPSEITY's ticker ("mined in block N / reverted / not mined after three minutes") is the right post-signature life for both paths.

**Recommendation (must):** feature-detect `wallet_getCapabilities` per chain; prefer `wallet_sendCalls` with `atomicRequired:false` unless the batch is unsafe to split; map all five status codes; keep the confirm slab (To / Value / Function) in front of every broadcast.

---

## 9. What the leading projects do — numbers and shapes

- **Reown AppKit / WalletConnect v2**: One-Click Auth = `wallet_authenticate` (CAIP-222) + ReCaps (ERC-5573); supports EIP-1271 and EIP-6492; EIP-6963 discovery on by default; "SIWE is being migrated to SIWX"; `wallet_prepareCalls`/`wallet_sendPreparedCalls` for ERC-5792 with sponsorship. Requires the WalletConnect relay — an off-chain dependency we cannot bake into a `data:` page, but the only route to a wallet from the chrome-web3 surface.
- **delegate.xyz v2**: immutable registry, same address on 30+ chains, `rights` namespaces; integration is five lines of Solidity (§3.2).
- **Tokenbound**: the iframe is read-only and indexer-backed; the registry is the canonical `0x…6551c19487814612e58FE06813775758`.
- **MetaMask**: 7702 upgrade-on-demand behind 5792; Delegation Toolkit over ERC-7710/7715.
- **Coinbase Smart Wallet / Base Account**: passkey primary signer with RIP-7212 on Base (secondary); ERC-7846 `wallet_connect` + `signInWithEthereum`; anti-replay `replaySafeHash` with the Safe-owner deadlock as its 2026 cost.
- **Safe**: passkey signer module with precompile-or-fallback P-256; ERC-1271 everywhere; the composability reference other accounts are tested against.
- **viem / wagmi**: deployless ERC-6492 universal validation with ERC-8010; experimental ERC-7739 `signTypedData`; 5792 hooks with fallback.
- **Scam Sniffer**: the loss baseline above; its browser extension flags `eth_sign` and opaque EIP-712.

Measured numbers I could **not** verify from primary sources and therefore do not quote as fact: delegate.xyz delegation counts; RIP-7212 adoption per chain beyond the secondary list; the exact EIP-5792 wallet roster.

---

## 10. Recommendations for our project

**Must**
1. Serve one HTML document that detects its surface (`data:` viewer / gateway console / extension) and only offers connect where a provider can exist; the viewer carries a "open console" link with the `web3://` URL.
2. Gate by **reading**, not signing: EIP-6963 → `eth_requestAccounts` → `rightsOf(id, account, right)` → render; the contract re-enforces every bit on write. Holding is never login.
3. Ship the `rightsOf` predicate with distinct bits for holder / token-account / renter (4907) / role (7432) / custody (721 approval) / delegate (delegate.xyz, extcodesize-guarded), plus `custodyEpoch` as the serverless session invalidator.
4. Verify any signature the product needs via ERC-6492 → ERC-1271 → `ecrecover` (viem deployless validator in the browser; ANIMA's ERC-6492 library on chain, at settlement only). The token's account implements ERC-7739 and is tested as a Safe owner.
5. ERC-5792 batching with sequential fallback and full status-code handling; confirm slab before every broadcast; simulate with `eth_call` from the connected account and decode custom errors.
6. Wrong-chain refusal before the button; `accountsChanged`/`chainChanged` recompute rights in place; no `localStorage` for authority.

**Should**
7. Warn when the connected EOA carries `0xef0100` code pointing at a delegate not on a small on-chain allowlist.
8. Prefer exact-value calls over approvals and Permits; never request unbounded allowances; show counterparty and amount in both page and EIP-712 payload.
9. Accept passkeys as **session keys** on the token's account (P-256 via RIP-7212 with fallback verifier), never as the holder key; enforce `UV`, low-S, `webauthn.get`, and bind the challenge to account/chain/nonce/calldata.
10. Expose SIWE only through the token's own ERC-6551 account for third-party relying parties, with ReCaps in `resources`; support ERC-7846 `wallet_connect` where offered.

**Could**
11. Offer WalletConnect as the one off-chain path for surfaces without an injected provider, clearly labelled as such.
12. Use ERC-6944/5219 headers for `Cache-Control`/`ETag` so gateways cache the shell and re-read only state (ERC-7774 draft covers invalidation; header semantics beyond `Content-type` are **unverified** in the spec text).

**Avoid**
13. Any "sign to log in" prompt on the page itself; any server-issued nonce; any session cookie.
14. `tx.origin` anywhere; hardcoded gas for `isValidSignature`; mutating the hash inside `isValidSignature`; treating ERC-721 approval as use authority; auto-selecting a provider; trusting the gateway origin.

---

## Special ideas

1. **A page that already knows who you are, rendered by the contract.** ERC-6860's `userinfo@` makes the gateway pass a sender to the `eth_call`, so `web3://0xYOU@token.eth/42` can server-render "you are the renter until Oct 12; these three doors are open to you" with zero JavaScript and zero wallet — presentation only, spoofable by design, but it turns the console into a shareable, readable URL and makes "view as" a first-class feature for buyers and renters.
2. **Sign in *as the NFT*.** The token's ERC-6551 account is an ERC-1271 signer; with ERC-7739 and ReCaps it can produce a SIWE proof scoped to "this collection, this token, these abilities, until this epoch." Third-party sites gate on the NFT, not on a wallet, and the proof dies on sale or revocation without a revocation list.
3. **Epoch-stamped everything.** Every voucher, message key and session the token's account issues carries `(custodyEpoch, state())`. Selling the NFT invalidates the lot in one storage write; buyers can verify nothing of the seller's survives — the on-chain version of "rotate all sessions."
4. **A rights passport the wallet can read.** `rightsOf` returned as bits lets a wallet's pre-sign simulation (and Scam Sniffer-style extensions) show "this call is allowed for you as renter" before the prompt — the token explaining its own authorisation to the signing surface.
5. **Phone-as-session-key.** Register a passkey on the token's account as a bounded session signer (cap, expiry, selector allowlist, RIP-7212 where available). The hardware wallet stays cold; the phone operates chat and small swaps; a sale clears it.
6. **Delegate rights namespaces per module.** `keccak256("anima.talk")` lets a hot wallet post as the NFT without being able to touch the vault — delegate.xyz's `rights` used as a capability vocabulary that other projects can honour too.
7. **A known-good delegator allowlist on chain.** The first collection that tells its holders "your EOA is delegated to a sweeper" before they fund anything — the CrimeEnjoyor lesson turned into a feature.

## Open questions

- Which `web3://` gateway(s) to document as canonical, given that the origin — and therefore any WebAuthn `rpId` — is the gateway's host? Should the token carry a gateway list in its own bytes?
- Do any shipping native `web3://` browsers inject a wallet provider today? (chrome-web3 says no; EVM Browser status **unverified**.)
- Is an immutable on-chain registry (delegate.xyz) acceptable under the unified project's dependency rule, or must delegation live entirely in the token's own ERC-7432 registry?
- Is WalletConnect's relay an acceptable, clearly-labelled exception for surfaces with no injected provider, or does "no server" exclude it?
- Should the holder key itself ever be a passkey (RIP-7212 is L2-only; mainnet verification is ~300k gas per secondary sources), or only session keys?
- ERC-8010 is still draft and criticised for missing nonce/chain-id checks — adopt viem's implementation now, or wait?
- How should the page treat an EIP-7702 EOA delegated to an *unknown* but not blacklisted contract — warn, or refuse to fund the token's account?
- Does ERC-5219's header channel actually let a contract set `Content-Security-Policy` through the major gateways? Nothing in the spec text confirms it.

---

### Sources (fetched 2026-10-02 unless noted)

ERC-4361 · ERC-1271 · ERC-6492 · EIP-6963 · EIP-1193 · EIP-5792 · EIP-7702 · ERC-7432 · ERC-4907 · ERC-6551 · ERC-5219 · ERC-6860 · ERC-6944 · ERC-5573 · ERC-7846 · ERC-7739 (ercs.ethereum.org) · ERC-7710 · ERC-7715 (ercs.ethereum.org) · RIP-7212 (github.com/ethereum/RIPs) · ERC-8010 (ethereum-magicians thread 25201; ercs page 404) · delegate-registry README (github.com/delegatexyz) · docs.delegate.xyz smart-contract examples · viem `verifyMessage` · OpenZeppelin `SignatureChecker.sol` (master) · safe-modules passkey README · docs.metamask.io batch transactions · docs.reown.com SIWE · docs.tokenbound.org/iframe · ComfyGummy/chrome-web3 README · docs.web3url.io · Scam Sniffer 2025 report (2026-01-03) · Alchemy ERC-1271 replay disclosure (2023-10-27) · coinbase/smart-wallet #176 (2026-08-25) · CertiK passkey security (2026-06-16) · arXiv 2512.12174 (2025-12-13) · Wintermute CrimeEnjoyor (2025-05-30, via CoinDesk 2025-06-02) · local repos: Most-Advanced-NFT-Possible (INTERFACE.md, AGENT.md, engine/ipseity.html, src/IpseityAccount.sol, src/Ipseity.sol, src/Lease.sol, src/Desk.sol), Cutting-edge-technologically-advanced-NFT (contracts/web/AnimaWeb3Renderer.sol, contracts/libraries/ERC6492.sol, contracts/registry/AnimaRoles.sol, contracts/core/AnimaAgent.sol, docs/SPEC.md), Pixel-Garden (web/host.mjs), MASTER-NFT-PROJECT (web/extensions/access.mjs).
