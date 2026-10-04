# Vaults for NFT-owned assets — research dossier

Prepared 2026-10-03 for the four-repo merge (IPSEITY / ANIMA / MASTER / Pixel-Garden). Scope: ERC-4626 and its extensions (7535, 7540, 7575), receive-only vaults, timelocks and ratchets, inheritance and dead-man switches, social recovery and guardians, spending limits and session keys, multisig for NFT accounts, yield routing, and the central question: what "a vault inside the NFT" should mean and how it survives a sale.

Method: 22 web searches, 13 primary pages fetched (EIP texts at eips.ethereum.org, OpenZeppelin docs, GitHub source of Tokenbound, Cruna, Candide, Safe, MetaMask, audit and post-mortem write-ups), plus a read of the vault-shaped contracts already in the four repos. Every claim below carries its source; claims I could not verify from a primary source are marked **unverified**. Statuses of ERCs are as the page reported them on the fetch date.

---

## 1. What already exists in the four repos (the baseline we are merging)

Before the state of the art, the state of the codebase. The merge is not starting from zero; three of the four repos already contain a worked-out vault model, and they agree on more than they differ.

**IPSEITY (`Most-Advanced-NFT-Possible`)** ships a *three-chamber* model, stated in `src/GripVault.sol`'s header: "Three places, three different promises, on purpose."

- **The Grip** (`GripVault.sol`, 7.6 KB of source): a second ERC-6551 account per token at a second salt that *receives and does not spend*. "There is no `execute`, no `withdraw`, no sweep, no rescue, no owner override, and no admin." `isValidSigner` and `isValidSignature` always return `bytes4(0)`; `state()` is the constant 0; `supportsInterface` deliberately omits `IERC6551Executable` (0x51945447) "so a client that checks before calling execute() is told the truth up front". `holdings(address[])` is documented as "a floor rather than a snapshot" because nothing can leave.
- **The Reach** (`IpseityAccount.sol`): the acting ERC-6551 account with a **seal** — `sealedUntil` is ratchet-only, capped at `MAX_SEAL = 365 days`, survives sale (INVARIANTS #35). Enforcement is by *measurement*, not enumeration: it snapshots ether and every asset on a ≤16-entry manifest before a sealed call and reverts `Shrank` if any balance fell. Because an approval moves no balance, the seal additionally refuses the approval family (`approve`, `increaseAllowance`, `setApprovalForAll`, both `permit` shapes, Permit2) and any ether out. The header records a real bug: a `MEASURED` flag packed into bit 255 of the snapshot word let a hostile token that returns `balance | (1<<255)` walk 1,000 tokens out of a live seal; the flag now lives in its own array.
- **Session keys** (`grantSession`): bounded by expiry, spend cap, target and selector allowlists; a session cannot call the account itself, cannot approve an unlisted spender, and cannot reach the Grip because the Grip has nothing to call (`AGENT.md` §3).
- **Succession** (`Succession.sol`): a two-clock dead-man switch on the *token*. `quiet` is 30 days to 3,650 days, `notice` is 7 to 365 days; a successor "knocks" (`summon`) after the quiet period, the owner can cancel during the notice period, and only then does `transferFrom` move the token. The plan records `from` and is void if the token changes hands ("the buyer did not agree to it"). Only the owner or the token's own Reach may arrange it, not an approved operator — "the thief would not steal the token, they would simply become the heir and wait." `toToken` lets the heir be *whoever holds another token*, so inheritance follows an instrument rather than a key.
- **Locker** (`Locker.sol`): any ERC-20, any term up to `MAX_TERM = 3650 days`, extend-only, no owner, no rescue, amount recorded as the balance delta (fee-on-transfer safe). **Timelock** (`lib/Timelock.sol`): `DELAY = 7 days`, `GRACE = 14 days`, no re-queue of a pending op, admin rotation only through its own queue, "no roles, guardians, a veto council, or any second address that can cancel".
- **Lease / Consign**: ERC-4907 rental where rent escrows *to the token* and vests over the term; consignment where the contract holds the token "in a room with no doors" and has "no call that reaches the token's account".

**ANIMA (`Cutting-edge-technologically-advanced-NFT`)** contributes the economic vault layer:

- **`AgentAccount`**: ERC-6551 + ERC-4337 account with session keys bounded by a per-session lifetime cap (`spendCapWei`), a rolling daily cap, a per-tx ceiling, a target/selector allowlist namespaced by the granting owner, and the agent's live status. Sessions record `grantedBy` and are void the moment the agent changes hands. `state()` increments on every state-changing call so a buyer can pin it. An `auditRoot` hash-chains every executed call. The guardian "may only pause" and is cleared on transfer.
- **`AnimaAgent._update`**: on transfer, `operatorEpoch += 1`, guardian/policy/lease/bound wallet deleted, status forced to `Paused`. ERC-5646 `getStateFingerprint` covers "more than the ERC-6551 state() nonce does".
- **`BondVault`**: slashable bond per agent; unbonding "stays slashable" for the whole cooldown; reserved coverage cannot be slashed for an unrelated claim; slashed value routes to the harmed party, not burned.
- **`RevenueRouter`**: a waterfall (operating ≥ 50 % bps, referral ≤ 5 %) with `POLICY_DELAY = 2 days` and a policy that goes stale on transfer, so a payer who quoted a commitment cannot be re-split.

**MASTER (`MASTER-NFT-PROJECT`)** has `TimeVault.sol` ("cliff locks and linear vesting. No admin or early exit"; beneficiary is the NFT account so "selling the NFT can sell the right, but cannot accelerate this contract's release schedule"; 3,650-day ceiling; release callable by anyone, recipient always the committed beneficiary) and `VestedExitVault.sol` (a funded sell schedule that only calls an immutable market adapter; refuses if custody or session epoch changed).

**Pixel-Garden** repeats the Reach/Grip split: `GripAccount.sol` is "Permanent receiving-only custody. No execution, approvals, exits, upgrades or spending signatures", with `state()` constant 0.

So the merged protocol inherits: a receive-only chamber (two independent implementations), a sealable working account (two), bounded session keys (two), token-centred succession (one), bonded coverage (one), dated locks and vesting (three), and a 7-day self-rotating timelock (one). What follows is the external state of the art measured against that baseline.

---

## 2. Standards landscape (status as fetched)

| Standard | What it is | Status / created | Relevance |
|---|---|---|---|
| ERC-4626 | Tokenized vault: `asset, totalAssets, convertTo*, max*, preview*, deposit, mint, withdraw, redeem`; `Deposit`/`Withdraw` events | Final, created 2021-12-22 | The share-accounting vocabulary; its rounding rules and oracle warnings |
| ERC-7535 | ERC-4626 with native ETH as `asset()` = `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` (ERC-7528); `deposit`/`mint` payable, `msg.value` primary | Final, created 2023-10-12 | ETH vault surface; the spec itself says most systems should prefer WETH |
| ERC-7540 | Asynchronous ERC-4626: `requestDeposit/requestRedeem`, Pending → Claimable → Claimed, `controller`/operator model; `preview*` MUST revert on async sides | Final, created 2023-10-18; requires 20, 165, 4626, 7575 | The standard shape for a *delayed exit* from a vault |
| ERC-7575 | Multi-asset / share-externalised vaults: `share()` on the vault, `vault(asset)` on the share, interface ids 0x2f0a18c5 (vault) and 0xf815c03d (share); "Pipes" convert between two external tokens | Final (page on eips.ethereum.org; created 2023-12-11) | Lets the share be a *different contract* from the vault — e.g. the NFT |
| ERC-6551 | Token bound accounts: `token()`, `state()`, `isValidSigner`, `execute(to,value,data,operation)` | "in the process of peer review" (Review), created 2023-02-23 | Both repos' accounts; Security Considerations list the four sale-fraud mitigations |
| ERC-7656 | Generalized contract-linked services: `create/compute(implementation, salt, chainId, bytes12 mode, linkedContract, linkedId)`, ERC-1167 proxy with appended data | Final, created 2024-03-15 | The factory pattern for *non-account* services bound to a token (Cruna's inheritance plugin uses it) |
| ERC-7878 | Bequeathable contracts: `setWill(executors, moratoriumTTL)`, `announceObit`, `cancelObit`, `getObit`, `bequeath` | Final, created 2025-02-01 | A standard inheritance *interface*; recommends moratorium ≥ 30 days |
| ERC-5646 | `getStateFingerprint(tokenId) → bytes32`, id 0xf5112315 | Final, created 2022-09-11 | What a buyer pins at sale (ANIMA already implements) |
| ERC-4907 | Rental: `setUser/userOf/userExpires`; user cleared on transfer | Final, created 2022-03-11 | IPSEITY's lease; the "use but not sell" role |
| ERC-6982 / ERC-7066 | Lockable ERC-721 (`locked()`; `lock/unlock/lockerOf`, approve MUST revert while locked) | Both Final (created 2023-05-02 / 2023-05-25) | Standard vocabulary for a locked token; 7066 says approvals must not bypass locks |
| ERC-5725 | Transferable vesting NFT: `claim`, `claimablePayout`, `vestedPayoutAtTime`, `vestingPeriod`, id 0xbd3a202b | Final, created 2022-09-08 | The NFT-as-vesting-position model; note its remark that an ERC-721 approval lets an operator take the NFT and then claim |
| ERC-7579 | Minimal modular smart accounts: module types 1 validator, 2 executor, 3 fallback, 4 hook; `installModule`, `executeFromExecutor` | Header in ethereum/ERCs master read as `status: Draft` at fetch | Module ecosystem (Smart Sessions, ZK Email recovery, OZ recovery) |
| ERC-7715 | `wallet_requestExecutionPermissions` with permission/rule types (`native-token-allowance`, `erc20-token-allowance`, `erc721-token-allowance`; `expiry`) | Draft, created 2024-05-24 | Vocabulary for the web app to *request* a session from a wallet |
| ERC-7821 | Minimal batch executor: `execute(bytes32 mode, bytes executionData)`, `supportsExecutionMode` | Draft, created 2024-11-21 | A batch interface that does not need 7579 |
| ERC-5095 | Principal token (`convertToPrincipal`, `convertToUnderlying`, `redeem` after `maturity`) | Status **unverified** (page fetched via search excerpt only) | The PT/YT model for yield routing |
| ERC-7710 | Smart-contract delegation with caveat enforcers (MetaMask Delegation Framework) | Status **unverified**; framework source verified | Period-based spend limits as composable enforcers |

---

## 3. Share vaults: ERC-4626 mechanics, the inflation attack, and 2025 incidents

### 3.1 The rules that matter

ERC-4626 fixes rounding direction to favour the vault: `convertToShares`, `convertToAssets`, `previewDeposit`, `previewRedeem` round down; `previewMint` and `previewWithdraw` round up. Its Security Considerations say the `preview*` methods "are manipulable by altering the on-chain conditions and are not always safe to be used as price oracles", while `convert*` "can serve as robust price oracles since they allow inexact implementations, such as time-weighted average pricing". This is the line both of our rounding invariants ("rounding favours the protocol") and our oracle policy must respect.

### 3.2 The inflation (donation) attack and the virtual-offset defence

OpenZeppelin's ERC-4626 guide: an attacker deposits a tiny amount a₀, donates a₁ directly to the vault, and "a user deposit of u will give u×a₀/(a₀+a₁) shares" — with a₀ = 1 and a₁ = u the user's deposit rounds to zero shares. The v4.9+ defence adds virtual assets and shares in the conversion: `assets.mulDiv(totalSupply() + 10**_decimalsOffset(), totalAssets() + 1, rounding)`. The guide's conclusion: "even with an offset of 0, the virtual shares and assets make this attack non profitable", and larger offsets make it "orders of magnitude" more expensive. The documented cost: virtual shares "capture (a very small) part of the value", and after losses "the first user to exit [experiences] reduced losses in detriment to the last users". OZ issue #5223 (2025) shows the nuance: with offset 0 an attacker who donates 10,000e18 against three 5,000e18 deposits still nets ~2,500e18 — the "non-profitable" claim is about *fully* diluting one deposit, so pick a non-zero offset when shares are public.

### 3.3 Incidents (dated)

- **Resupply, 26 June 2025, $9.56 M.** A cvcrvUSD ERC-4626 vault deployed ~90 minutes earlier and empty. Attacker took a ~$4 K flash loan, donated 2,000 crvUSD, deposited 2 crvUSD to mint 1 wei of shares, then borrowed against it. The lending pair computed `_exchangeRate = 1e36 / oracle.getPrices(collateral)`; the inflated price (~2e36) made the division floor to **zero**, the LTV check became `0 <= maxLTV`, and the attacker borrowed the 10 M reUSD cap (Ackee analysis, 4 Aug 2025; Veridise; QuillAudits 27 Jun 2025). Mitigations named by every post-mortem: seed new vaults, virtual shares, `require(_exchangeRate > 0)`, minimum-collateral floors.
- **Venus on ZKsync, February 2025, ~86 WETH profit and bad debt.** wUSDM (an ERC-4626 token) used as a borrowable base asset in a low-liquidity vault; the attacker donated ~439 K USDM directly, inflating the share price ~1.7×, then self-liquidated (OpenZeppelin, 22 May 2025).

**What this means for a per-token vault.** Our Reach/Grip are *single-beneficiary* accounts, not pooled share vaults, so the first-depositor attack does not apply to them directly. It applies the moment (a) a per-token pool or launchpad reads a 4626 `convertToAssets`/`previewRedeem` as a price, or (b) we ever let outsiders buy shares of a token's vault (see "Special ideas"). Rule: any 4626 share held by a token's account must be valued through `convert*`, never `preview*`, with a sanity floor on the resulting rate, and any share-issuing vault we deploy ships with a decimals offset and a seeded, permanently-locked first deposit.

---

## 4. Asynchronous and multi-asset vaults (ERC-7540, ERC-7575)

ERC-7540 is the standard grammar for "you asked to leave; come back later". A redeem request moves shares out of the owner's custody immediately ("MUST be removed from the custody of `owner` upon `requestRedeem`"), the request sits Pending, is fulfilled to Claimable, and the user calls the ordinary `redeem` to claim. Operators (`setOperator(address,bool)`, `isOperator`, event `OperatorSet`, interface id 0xe3bc4e65) may manage requests; async deposit id 0xce3bbe50, async redeem id 0x620ee8e4. Two warnings from the spec's Security Considerations are directly relevant: pending assets "may remain stuck unless the Vault enables claim fungibility or cancellation", and "an operator has the ability to transfer the `asset` of the vault from the approver to any address". OpenZeppelin's community implementation adds a sharper one in code comments: passing a `controller` that cannot call `deposit`/`redeem` "will permanently lock the committed assets, since … there is no cancellation path." Its `ERC7540DelayRedeem` strategy ("Fully permissionless time-locked vault", exchange rate computed at claim time) is exactly a cooling-off withdrawal.

ERC-7575 externalises the share: a vault returns `share()`, the share returns `vault(asset)`, and "the entry points SHOULD NOT be ERC-20". Its own compatibility note: "ERC-7575 Vaults are not fully compatible with ERC-4626 because the ERC-20 functionality has been removed", and redeem-for-another-owner needs ERC-2771 forwarding because approvals do not cross contracts.

**Relevance.** (1) The merged protocol should present any *delayed exit* from a token's vault as ERC-7540 async redeem rather than inventing a bespoke queue: pending state is readable by standard tooling, the operator model maps onto our session keys, and the "preview reverts on async side" rule stops a frontend from pretending a delayed withdrawal is instant. (2) ERC-7575's share/vault split is the legal form for the idea that *the NFT is the share*: one share contract (the ERC-721, supply 1 per token) and per-asset entry points. That is not what the standard's authors had in mind, but nothing in it forbids a share token that is non-fungible — the `vault(asset)` lookup and `0xf815c03d` work unchanged.

---

## 5. Receive-only vaults ("seal / no outbound path")

The literature here is thin because the pattern is almost too simple to publish; the strongest statements are in our own repos. ERC-6551 itself only *allows* an account to answer that no signer is valid ("Accounts MAY implement additional authorization logic which invalidates the holder as a signer"), which is the standards hook the Grip relies on. The Ethereum Magicians ERC-6551 thread records the general idea from 2023: "the project can send some kind of assets/NFTs to the accounts of their NFTs that can only be withdrawn after a delay or after some constraints are met."

The Grip's argument is worth restating because it is the cleanest security claim in the whole system: a capability that is policed has an attack surface equal to the policy; a capability that does not exist has none. The cost is also stated plainly — "A mistaken transfer into a Grip is a permanent mistake" — and the IPSEITY invariants add the one guarantee a buyer needs (#40: holdings are a floor) and the one honesty requirement (#39: it does not advertise `IERC6551Executable`).

Two refinements come from outside sources:

- **ERC-7066** requires `approve` to revert while a token is locked, closing the approval route around a lock. The Grip has no approval path at all, which is stronger; but the *Reach's* seal reproduces 7066's rule by refusing the approval family, and that is the right precedent to cite.
- **ERC-5725**'s security note — an ERC-721 approval on a vesting NFT lets the operator "transfer the Vesting NFT to themselves and then claim" — is the general form of why every receive-only chamber must be bound to the *token*, not the holder: the only way to take the Grip is to take the token, which makes the token's own transfer rules (locks, succession, consign) the Grip's entire security model.

---

## 6. Timelocks and ratchets

Reference points, with their numbers:

- **IPSEITY Timelock**: 7-day delay, 14-day grace, admin rotation only through the queue, no second canceller. **Locker**: extend-only, 10-year ceiling. **Seal**: ratchet-only, 365-day ceiling, survives sale. **MASTER TimeVault**: cliff or linear, 10-year ceiling, extend-only for cliff locks, beneficiary = NFT account. **ANIMA BondVault**: unbonding stays slashable for the whole cooldown; **RevenueRouter**: 2-day policy delay, stale on transfer.
- **Tokenbound `Lockable.sol`** (the reference ERC-6551 account's lock): `lock(uint256 _lockedUntil)` by the root token owner, reverts `ExceedsMaxLockTime()` if `_lockedUntil > block.timestamp + 365 days`; `isLocked()` is `lockedUntil > block.timestamp`; `execute` checks the lock. Same 365-day ceiling our seal chose independently.
- **Safe Allowance module**: a single-word struct `{uint96 amount; uint96 spent; uint16 resetTimeMin; uint32 lastResetMin; uint16 nonce}`; `resetTimeMin` ≤ 2¹⁶ minutes ≈ 45 days; the CHANGELOG records an Ackee finding that a zero `resetTimeMin` caused a divide-by-zero consuming all gas — a reminder that period maths needs a non-zero guard.
- **MetaMask `ERC20PeriodTransferEnforcer`**: `periodAmount`, `periodDuration`, `startDate`; "any unused tokens are forfeited once the period ends"; `currentPeriod = (now − start)/duration + 1`.

The unifying principle across all of these is a **ratchet**: a parameter may only move in the direction that protects the counterparty who cannot act (the buyer, the heir, the client whose job is bonded), every ceiling is finite ("a promise nobody can outlive is indistinguishable from a burn"), and the privileged path is a *visible delay*, not a veto. The merge should adopt one written definition and apply it to every chamber: seal (longer only), lock (later only), bond (more only, except through slashing), revenue policy (change only after delay, void on sale).

---

## 7. Inheritance, dead-man switches, succession

### 7.1 Designs in the wild

- **ERC-7878 (Final, 2025).** An owner `setWill(executors[], moratoriumTTL)`; an executor `announceObit(owner, inheritor)`; *any* executor or the owner can `cancelObit`; after the moratorium anyone calls `bequeath`. The spec recommends "at least 30 days" of moratorium "especially for tokens that are of high value" to limit damage "in scenarios such as the obituary process being triggered by a bad actor who has taken over one of the executor wallets". Everything goes to one inheritor address; splitting is that person's job. It is a will *with executors*, not a dead-man switch — nothing in the interface measures silence.
- **Cruna `InheritanceCrunaPlugin`** (ERC-7656 service): `configureInheritance(uint8 quorum, uint8 proofOfLifeDurationInWeeks, uint8 gracePeriodInWeeks, address beneficiary, …)`, `setSentinel(s)`, `proofOfLife()` (owner only; "resets proof-of-life timer and clears nominations/votes"), `voteForBeneficiary(address)` (sentinels; `address(0)` retracts), `inherit()` (the approved beneficiary). The owner names a beneficiary and a sentinel quorum; after proof-of-life lapses the pre-named beneficiary has a grace window, after which sentinels may vote an alternative. `setSentinels` "works only if no protector has been set" — protectors (co-signers) and sentinels interact.
- **Dead-man-switch projects, 2025–26.** `DeadManSwitch` on Base: `register(beneficiary, intervalSeconds) payable`, `ping`, `trigger` (anyone, after deadline, earns a 0.5 % bounty), `cancel`; "non-upgradeable, no admin keys after deploy, no whitelist, no oracle"; interval bounds 1 h to 10 y (GitHub README; deployment claims **unverified**). `DeadSwitch` (ETHGlobal Cannes 2026, Sepolia only): 30-day minimum heartbeat, 30-day recovery delay, Chainlink Automation trigger, World ID heir check, alerts at 30/60/75/85 days; its roadmap lists "Trusted Guardian — 1-2 contacts can PAUSE recovery" and a "Duress signal". `Hera-Inc/inheritance-protocol` (Oct 2025): a per-grantor DigitalWill holding ETH/ERC-20/721/1155 with a 90-day `checkIn()`.
- **IPSEITY Succession** (above): two clocks, token moves, plan void on transfer, heir-by-token.

### 7.2 Lessons

1. **Silence is not death.** Every serious design separates "the owner has not acted for N" from "the owner is gone" with a second window the owner can cancel in (Succession's `notice`, 7878's moratorium, DeadSwitch's 30-day recovery delay). The failure mode they are all guarding is a key stolen *or* an owner in hospital. ERC-7878's ≥30-day floor is the best-articulated number; Succession's 7-day minimum notice is on the aggressive side and should be raised, or at least the UI should default to 30.
2. **Move the token, not the assets.** Asset-enumerating wills (Hera, DeadSwitch) need deposits into a separate contract, which means the assets are no longer where the token's apps expect them, and an asset the will never listed is lost. Because our vaults are token-bound, moving the token moves *everything*: Grip, Reach, pool inventory, bond, locks whose beneficiary is the account, unpaid rent. This is the single largest structural advantage the merge has over every inheritance product surveyed, and it is why succession should remain a *transfer of the ERC-721* with no asset list.
3. **The heir must not be a key.** Succession's `toToken` (heir = holder of another token) survives the heir changing wallets; Cruna's sentinel vote survives the named beneficiary disappearing. Both beat a hard-coded address.
4. **Guardian quorum vs pure silence.** Cruna's sentinels can propose an alternative heir; 7878 lets any executor cancel; Succession has no third party at all ("no curator, no pause"). A quorum reduces false positives but adds keys to steal; the compromise used by DeadSwitch's roadmap (guardians may *pause*, never redirect) is the ANIMA guardian rule already in `AgentAccount`.
5. **Privacy.** Succession says it plainly: "Everything here is public, including who you named." Hera claims private beneficiaries but stores them in its own contract; Cruna's sentinel votes are public. No surveyed on-chain design hides the heir without an off-chain component. A commit-reveal of the heir (hash on chain, revealed at `summon`) is cheap and nobody does it.
6. **Who pays to trigger.** DeadManSwitch pays a bounty so "no off-chain keeper"; Succession expects the successor to knock. A small bounty from the token's own Reach (bounded by the seal rules) is a reasonable merge feature; a Chainlink dependency is not (it is a server).

---

## 8. Social recovery and guardians

### 8.1 Reference designs

- **Candide / Safe SocialRecoveryModule.** Owner-managed guardians and threshold (`addGuardianWithThreshold`, `revokeGuardianWithThreshold`); guardians `confirmRecovery` / `multiConfirmRecovery` (signatures or `msg.sender`); `executeRecovery` starts a `recoveryPeriod` once approvals ≥ threshold; the owner can `cancelRecovery` during the period; `finalizeRecovery` is "public and callable by anyone". A replacement request needs *more* guardian approvals than the pending one. Safe's blog (6 Aug 2024) says the default module has a 14-day recovery period and that the code was formally verified; Ackee's audit (6–14 June 2024, 2 engineering days) found two issues, the most severe "M1: Other modules can be used to gain ownership of the wallet" — i.e. the recovery module's guarantees are only as strong as the *other* modules installed.
- **ZK Email recovery (ERC-7579 module).** Guardians are email addresses proven by DKIM in a ZK proof; `handleAcceptance`, `handleRecovery`, timelock, `completeRecovery` callable by anyone. Ackee (4–12 July 2024, 27 findings) found H1 "initialize the system without guardians and a zero threshold" and H2 a premature guardian-weight update that "potentially [makes] recovery impossible"; the MatterLabs review found a High where one compromised guardian could re-send emails to "bypass the threshold mechanism", and a Low noting "Single guardian setup is allowed" which the client kept deliberately. Also noted: a guardian can front-run its own removal by starting a recovery, mitigated by bundling `cancelRecovery` + `removeGuardian`.
- **Rhinestone / OpenZeppelin.** OZ community contracts ship `ERC7579Multisig` + `ERC7579DelayedExecutor` so "guardians … schedule recovery operations with a time delay, providing a security window to detect and cancel". Rhinestone's Smart Sessions explicitly forbids a session from authorising another session ("disallow that session can be authorized by other sessions"), the same rule IPSEITY's `AGENT.md` states as "A session cannot call the account".

### 8.2 Incident

**Loopring, 9 June 2024, ~$5 M, 58 wallets.** Smart wallets configured with a *single* guardian — Loopring's own "Official Guardian" service — were taken over after the attacker compromised the 2FA records behind that service and had recovery codes delivered to themselves; recovery reset ownership and drained the wallets. Loopring's own risk disclosure had warned: "As a centralized service, Loopring Official Guardian may be attacked and controlled by hackers." Wallets with multiple or third-party guardians were unaffected (The Block, 9 June 2024; Loopring statement; OAK summary).

### 8.3 What recovery means for an NFT-bound vault

For a smart wallet, recovery rotates the owner key. For a token-bound vault, the owner *is* `ownerOf(tokenId)`, so recovery is a **transfer of the token** — the same primitive as succession and consignment. That collapses the design: one "steward" contract with two triggers (silence → heir; guardian quorum → designated recovery address), one delay, one owner veto, one rule that the arrangement dies on transfer, and one rule that the steward can call nothing but `transferFrom` to the pre-written destination. The Loopring lesson translates directly: never ship a default guardian that is our own service, and require ≥2 guardians when guardians can *redirect* (as opposed to merely pause).

---

## 9. Spending limits, session keys, multisig

### 9.1 What the ecosystem converged on

Every surveyed system bounds a delegated key by the same five things: **time window** (`validAfter/validUntil`, Rhinestone "Timeframe", 7715 `expiry`), **per-asset cap** (Safe `amount`, MetaMask `ERC20TransferAmountEnforcer`, Rhinestone "Spending limit"), **period reset** (Safe `resetTimeMin`, MetaMask period enforcer with forfeiture, ANIMA daily cap), **target and selector allowlist** (Rhinestone "Permissions … defined by an ABI and a target address", MetaMask `AllowedTargets/AllowedMethods`, IPSEITY and ANIMA allowlists), and **what the key may sign** (Rhinestone scopes ERC-1271 via ERC-7739 to an exact EIP-712 domain and type — "Without this feature, any session key could have been able to sign any kinds of EIP-712 data structs, from Permit2's to off-chain orders"; ANIMA forbids session keys from ERC-1271 entirely; IPSEITY refuses 1271 while sealed). ERC-7715 is the request-side vocabulary (`erc20-token-allowance`, `native-token-allowance`, `expiry`) and says it "does not specify an exhaustive list".

Our two session models already contain all five bounds plus two that the ecosystem documents as lessons rather than defaults: **a session cannot escalate** (cannot call the account, cannot grant sessions) and **sessions die on sale** (ANIMA `grantedBy`; IPSEITY via the seal rules and operator epoch).

### 9.2 Multisig for NFT accounts

No surveyed standard puts a multisig *inside* a token-bound account, and there is a good reason: `ownerOf` is already an address, and that address can be a Safe. ERC-6551 says the holder "MUST be considered a valid signer" by default, so a Safe-held NFT gives every chamber a multisig owner for free, including the recovery module of the Safe itself (with the Candide M1 caveat). What *does* belong inside the account is a bounded second role: a guardian that can pause (ANIMA) or a sentinel quorum that can vote an heir (Cruna). Tokenbound's `AccountGuardian` is a different thing — a project-level registry of "trusted implementations and executors" for upgradeable accounts — and is the kind of admin key the merge's no-upgrade stance excludes by design.

### 9.3 Delegated *reading* and authorisation of the web app

The task requires the on-chain site to let a visitor act if they "hold the NFT (or are authorised by its holder)". delegate.xyz v2's immutable registry is the ecosystem's answer for cold-wallet holders: `checkDelegateForERC721(to, from, contract_, tokenId, rights)` with sub-delegation `rights` so "airdrop claiming to wallet B and governance rights to wallet C". Honouring it is a single `staticcall` in the page's "who are you" check; the write side (sessions) stays ours.

---

## 10. Yield routing

Three patterns were found, in rising order of structure:

1. **Revenue waterfall** (ANIMA `RevenueRouter`): fixed bps splits, delayed policy changes, stale-on-transfer, operating share absorbs rounding so "configured peripheral shares can never silently exceed the gross amount".
2. **Accrue to the token** (IPSEITY Lease and Pool): rent and swap fees land in token-owned reserves and vest over the term, so "selling the NFT sells the exchange".
3. **Principal/yield separation** (ERC-5095, Pendle, Spectra): a yield-bearing 4626 position is split into a PT ("right to redeem 1 unit at maturity") and a YT ("right to receive the yield … until maturity, claimable in real-time"); PT + YT = underlying; Spectra's PT "is EIP 5095 and 2612 compliant" and "designed to operate with any ERC4626 Tokenized Vault token".

The merge-relevant synthesis: the seal measures **share balances**, so a sealed 4626 position compounds inside the seal and the holder cannot skim yield without redeeming shares (which the seal refuses). That is the safe default. If a token wants "principal locked, yield spendable", the clean on-chain form is literally the PT/YT split: PT in the Grip (principal that can never leave), YT in the Reach (yield that can). A looser form — a manifest entry whose floor is `convertToAssets(shares) ≥ principal` rather than `shares ≥ snapshot` — is possible but inherits the 4626 oracle warning (section 3.1) and must be rate-limited and allowlisted per asset.

---

## 11. How the vault survives a sale — the core design

ERC-6551's Security Considerations describe the fraud and four mitigations: pin account `state` to the order, attach "a list of asset commitments", route through a contract that checks both, or "implement a locking mechanism on the token bound account implementation". The Magicians thread records the gap in the first two: "approval-based transfers … would not change account state." Three of our repos already implement the fourth (seal / lock) and ANIMA implements the first and an ERC-5646 superset.

What the merged token should guarantee **survives** a transfer: Grip holdings (structurally), the seal and its manifest (ratchet), dated locks and vesting whose beneficiary is the account, pool inventory and accrued fees, bond coverage, unpaid rent escrow. What must **die** on transfer: operators (epoch bump), sessions, guardians, autonomy policy, ERC-4907 user, succession/recovery arrangements, revenue policy (stale), consignment agency. Both repos already do this in `_update` or by `grantedBy`/`from` checks.

The one hole no repo closes fully is **approvals granted *by* the account to third parties**: ERC-20/721 approvals live in the asset contracts, do not bump `state()`, and transfer to the buyer with the token (OneKey, Oct 2025: "transferring the NFT hands those approvals to the buyer"). IPSEITY's answer is to refuse approvals while sealed, which protects a *sealed* sale window but not an unsealed one. The missing piece is cheap: an **open-approval ledger** in the account — every `execute` that carries an approval-family selector records `(asset, spender)` in a per-owner set; the buyer's page can enumerate and revoke in one batch; a marketplace order can require the set to be empty; and the ledger is itself part of the ERC-5646 fingerprint. It costs one SSTORE per approval and turns an invisible liability into a readable one.

---

## 12. Security lessons from the incidents (consolidated)

| Incident | Date | Root cause | Lesson for us |
|---|---|---|---|
| Resupply | 2025-06-26, $9.56 M | Empty 4626 vault + `1e36/price` flooring to 0 | Never read a 4626 rate without a floor; seed and offset any share vault; boundary-test every division |
| Venus (ZKsync) | 2025-02, ~86 WETH + bad debt | 4626 token as borrowable base asset in thin vault; direct donation | A 4626 share is not a price; `preview*` is manipulable by spec |
| Loopring | 2024-06-09, ~$5 M | Single centralised guardian; 2FA service compromised | No default service guardian; guardians that redirect need a quorum; guardians that only pause may be 1-of-1 |
| Bybit / Safe{Wallet} UI | 2025-02-21, ~$1.46 B (401,347 ETH) | Malicious JS injected into app.safe.global from a compromised developer machine (JS modified 19 Feb, removed 2 min after the tx); signers blind-signed a `delegatecall` that swapped the Safe's `masterCopy` | Serving the UI from chain removes the S3 vector; but the page itself must be immutable and the account must refuse `delegatecall` (IPSEITY invariant #36 already does: "Any operation other than 0 reverts") |
| Radiant | 2024-10-16, ~$50 M (per CertiK) | Compromised dev devices spoofed the Safe front end; Tenderly sims looked clean | Same: a UI that is bytecode cannot be spoofed by an infra breach; show the exact calldata digest in the on-chain page |
| Candide recovery audit M1 | 2024-06 | Other Safe modules can take ownership | A recovery module is only as safe as the account's other modules — our no-module, no-upgrade account is the mitigation |
| ZK Email audit H1/H2, threshold bypass | 2024-07 | Zero-guardian init; repeated guardian emails counted twice | Reject empty guardian sets; count each guardian once per request nonce |
| Safe Allowance divide-by-zero | pre-2024 | `resetTimeMin == 0` in modulo | Guard every period divisor |
| IPSEITY bit-255 flag | internal, past | Borrowed a bit of someone else's `balanceOf` | Never assume anything about a foreign token's return value |
| OZ ERC-7540 note | 2025–26 | Controller with no claim path locks assets forever | Our async exits must have a cancel path or a claim-by-owner fallback |

---

## 13. Recommendations for the merged protocol

**MUST**

1. **Keep the three-chamber model and name it in the spec**: Grip (receive-only, structural), Reach (acting, sealable by measurement), Market (pool inventory behind a bonded ratchet). Both independent implementations (IPSEITY, Pixel-Garden) converged on it; it is the only pattern surveyed with a proof-by-absence security argument. Do not add any outbound path to the Grip, ever.
2. **Define one Ratchet rule and apply it to every chamber**: seal only lengthens (≤ 365 d, matching Tokenbound's ceiling), locks only extend (≤ 10 y), bond only grows except by slashing, revenue policy only changes after delay and dies on sale. Write it as a numbered invariant with a test per chamber.
3. **Make succession and social recovery one module with two triggers**, both of which can only `transferFrom` the token to a pre-written destination after a delay the owner can cancel: silence → heir (Succession as-is, with `notice` default raised toward ERC-7878's 30-day recommendation), guardian quorum (≥2 when they can redirect) → recovery address. Arrangement void on transfer; strict-owner to arrange; no default service guardian (Loopring).
4. **Transfer hook clears all delegated authority** exactly as `AnimaAgent._update` does (operator epoch, guardian, policy, user, bound wallet, sessions via `grantedBy`) and forces a paused/unarmed status for agent-like tokens.
5. **Refuse `delegatecall` in every account `execute`** (operation 0 only) and show the calldata digest on the on-chain page before signing. This is the Bybit/Radiant lesson; our architecture already removes the infra vector, so do not reintroduce the signing one.
6. **Treat ERC-4626 shares held by a token as positions, not prices.** Value with `convert*` only, floor the rate, allowlist per asset; any share-issuing vault we deploy uses a decimals offset and a seeded, locked first deposit.

**SHOULD**

7. **Expose delayed exits as ERC-7540** (async redeem with a delay strategy, `preview*` reverting on that side) so pending/claimable states are readable by standard tooling; include a cancel path so a mis-set controller cannot strand assets.
8. **Add the open-approval ledger** to the Reach (per-owner set of `(asset, spender)` written whenever `execute` carries an approval-family selector), fold it into the ERC-5646 fingerprint, and let the page revoke in one batch. This closes the one sale-time hole ERC-6551's own text admits.
9. **Honour delegate.xyz v2 in the page's authorisation check** (`checkDelegateForERC721`) so cold-wallet holders can use the site from a hot wallet; keep write authority on our sessions.
10. **Describe sessions in ERC-7715 vocabulary** on the request side (`erc20-token-allowance`, `native-token-allowance`, `expiry`) while keeping our stricter on-chain bounds (no self-call, no unlisted spender, scoped or no ERC-1271, dead on sale).
11. **Implement ERC-7878 as an adapter view over the steward** (`getWill`, `getObit`) so inheritance tooling can read our arrangement without bespoke code.
12. **Use ERC-7656 as the factory for non-account token services** (steward, locker-per-token, yield splitter) instead of extra ERC-6551 salts; it is Final and its proxy layout is byte-compatible with 6551 in `LINKED_ID` mode.

**COULD**

13. **Offer PT/YT yield routing**: principal (PT) into the Grip, yield (YT) into the Reach, via an ERC-5095-shaped splitter for 4626 positions; or a per-manifest `FLOOR_ASSETS(principal)` mode, rate-limited.
14. **Pay a small bounty from the Reach to whoever executes a matured succession** (DeadManSwitch pattern), capped and subject to the seal.
15. **Commit-reveal the heir** (store `keccak(heir, salt)`, reveal at `summon`) — cheap privacy nobody surveyed offers.

**AVOID**

16. No upgradeable account, no `AccountGuardian`-style trusted-implementation registry, no module slots on the account (Candide M1 shows modules are the recovery module's weakest link).
17. No ERC-7535 payable-ETH vault surface unless a chamber is ETH-only; the spec itself says to prefer WETH.
18. No Chainlink/keeper dependency for triggers; a bounty or the heir's own transaction keeps the system serverless.
19. No single centralised guardian, and no guardian role that can both pause and redirect.

---

## Special ideas

1. **The NFT is the ERC-7575 share.** Register the ERC-721 as the `share()` of per-asset entry points and implement `vault(asset)` on the token; supply is 1, so `convertToAssets(1)` *is* the token's vault NAV. Standard 7575 tooling (`0xf815c03d`) would enumerate a token's chambers with no custom indexer.
2. **Open-approval ledger in the fingerprint.** Approvals the account has granted become part of ERC-5646 state, so a marketplace order that pins the fingerprint is void if the seller leaves a live allowance behind — the first design that closes ERC-6551's acknowledged "approval-based transfers" gap without a marketplace change.
3. **Heir-by-instrument as the default.** Succession's `toToken` generalised: the heir is "whoever holds token N of this collection", so an estate can be a *second token* kept in a drawer, itself with its own succession — chains of custody without any address.
4. **Grace-period duress signal.** A second heartbeat selector (`stillHereUnderDuress`) that silently extends `notice` by the maximum and records a flag only the heir's page renders. Cheap, on-chain, and absent from every surveyed design (DeadSwitch lists it as roadmap).
5. **Seal-as-listing.** When a token is listed on the in-protocol market, the listing *is* a seal to the listing's expiry, so the buyer's floor is enforced by the account rather than promised by the marketplace (ERC-6551 mitigation #4, made automatic).
6. **Yield-only sessions.** A session scope `CLAIM_ONLY` that may call any `claim`/`harvest` selector on manifest assets but can never reduce a manifest balance — the measured seal already makes this checkable without enumerating protocols.
7. **Bond that grows from the waterfall.** ANIMA's `bondBps` already routes revenue into the bond; make the bond visible on the token's page as a "coverage" number that only ratchets up, so reputation is literally money the next buyer inherits.

## Open questions

1. Should the seal measure *shares* (strict, no yield skim) or *principal in assets* (skimmable, oracle-exposed) by default, and per which asset allowlist?
2. What is the right `notice` floor for succession — 7 days (current), 14 (Safe default), or 30 (ERC-7878 recommendation)? And should `MIN_QUIET` depend on token value?
3. Can a 1-of-1 *pause-only* guardian coexist with a ≥2 *redirect* quorum in one steward without the pause being used to block a legitimate recovery (ZK Email's front-running observation)?
4. Does ERC-7540's operator model (which "simultaneously grants control over the share") conflict with our rule that a session may never hold ERC-1271 or approval power? Likely yes — exits should accept only the owner or the Reach as `controller`.
5. ERC-5095's current status and whether any Final PT standard exists is **unverified**; if the yield-splitter ships, confirm before claiming conformance.
6. ERC-7579 is recorded as Draft in the ERCs repo header fetched; its ecosystem is live regardless. Do we want *any* 7579 compatibility (e.g. a read-only adapter) or none, given the no-module stance?
7. Chain assumptions: transient storage (ANIMA's `ReentrancyGuardTransient`) requires Cancun; the Grip/Reach must behave identically on every chain in the multi-chain band design.
8. Should the open-approval ledger also cover ERC-721 `setApprovalForAll` on *other* collections the Reach holds, and ERC-1155 — and what happens when a foreign token's `approve` reverts (the ledger must not block a legitimate call)?

---

## Sources (primary, with fetch/publication dates)

- ERC-4626 — https://eips.ethereum.org/EIPS/eip-4626 (Final; created 2021-12-22; fetched 2026-10-03)
- ERC-7540 — https://eips.ethereum.org/EIPS/eip-7540 (Final; created 2023-10-18); raw text https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-7540.md; OpenZeppelin ERC-7540 docs and `ERC7540.sol` https://docs.openzeppelin.com/community-contracts/erc7540
- ERC-7575 — https://eips.ethereum.org/EIPS/eip-7575 (created 2023-12-11)
- ERC-7535 — https://eips.ethereum.org/EIPS/eip-7535 (Final; created 2023-10-12); ERC-7528 raw (Review at fetched commit)
- ERC-6551 — https://eips.ethereum.org/EIPS/eip-6551 (Review; created 2023-02-23); Magicians thread pages 2 and 11
- ERC-7656 — https://eips.ethereum.org/EIPS/eip-7656 (Final; created 2024-03-15); Cruna docs https://github.com/crunaprotocol/cruna-protocol/blob/master/docs/README.md; `InheritanceCrunaPlugin.sol` (raw)
- ERC-7878 — https://eips.ethereum.org/EIPS/eip-7878 (Final; created 2025-02-01)
- ERC-5646 — https://eips.ethereum.org/EIPS/eip-5646 (Final; 2022-09-11); ERC-4907 (Final; 2022-03-11); ERC-6982 (Final; 2023-05-02); ERC-7066 (Final; 2023-05-25); ERC-5725 (Final; 2022-09-08); ERC-7579 (ethereum/ERCs master header: Draft); ERC-7715 (Draft; 2024-05-24); ERC-7821 (Draft; 2024-11-21); ERC-5095 (status unverified)
- OpenZeppelin ERC-4626 guide (inflation attack) — https://docs.openzeppelin.com/contracts/5.x/erc4626; issues #3706, #5223; "ERC-4626 Tokens in DeFi: Exchange Rate Manipulation Risks" 2025-05-22
- Resupply — Ackee analysis 2025-08-04 https://ackee.xyz/blog/resupply-hack-analysis/; QuillAudits 2025-06-27; Veridise; Blockchain Breaches 2025-06-26
- Tokenbound `Lockable.sol` — https://raw.githubusercontent.com/tokenbound/contracts/main/src/abstract/Lockable.sol; README (AccountGuardian)
- Candide SocialRecoveryModule — https://github.com/candidelabs/candide-contracts; Safe blog 2024-08-06; Ackee audit summary 2024-08-19
- ZK Email recovery — Ackee audit summary 2024-10-10; MatterLabs audit PDF; zk.email case study
- Loopring — The Block 2024-06-09; onchainattack.org summary; Loopring statement (via lazarus research mirror)
- Bybit — Sygnia 2025-03-16; Sygnia interim report PDF; NCC Group 2025-03-10; CertiK 2025-02-23; BleepingComputer 2025-02-26
- Safe Allowance module — https://github.com/safe-global/safe-modules/blob/main/modules/allowances/README.md, `AllowanceModule.sol`, CHANGELOG; Safe docs "AI agent with a spending limit"
- MetaMask Delegation Framework — `ERC20PeriodTransferEnforcer.sol`, `ERC20TransferAmountEnforcer.sol`; docs.metamask.io delegation overview
- Rhinestone Smart Sessions — https://docs.rhinestone.dev/smart-wallet/smart-sessions/overview; erc7579/smartsessions wiki and `SmartSession.sol`; blog 2024-09-12
- delegate.xyz v2 — `IDelegateRegistry.sol` docs; v1→v2 migration page
- Pendle Academy ch. 2; Spectra "Tokenizing yield" and Principal Token reference
- Dead-man switches — DeadManSwitch (Base) README; DeadSwitch ETHGlobal showcase and README; Hera inheritance-protocol README (2025-10-10)
- Repo sources read: `Most-Advanced-NFT-Possible/src/{GripVault,IpseityAccount,Succession,Locker,Lease,Consign}.sol`, `src/lib/Timelock.sol`, `INVARIANTS.md`, `AGENT.md`; `Cutting-edge-technologically-advanced-NFT/contracts/{account/AgentAccount,registry/BondVault,economy/RevenueRouter,core/AnimaAgent}.sol`; `MASTER-NFT-PROJECT/contracts/src/protocol/{TimeVault,VestedExitVault}.sol`; `Pixel-Garden/src/accounts/GripAccount.sol`
