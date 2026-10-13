# INTACT (working name)

One ERC-721 that is a website, a swap, a social layer, a launchpad and a vault, entirely on chain.
Minting one token gives its holder, inside the token itself:

- a **website** served from chain (the token's own metadata and a `web3://` surface), which
  verifies that the connected wallet holds the token before it unlocks anything;
- a **swap**: an owned per-token market plus a router to outside liquidity;
- a **social layer**: an indexer-free message archive, rooms, sealed direct messages and a key registry;
- a **launchpad**: token launches signed by the NFT, with fees flowing back to the token's account;
- a **vault**: an acting account with measured seals and bounded session keys, and a receive-only
  account with no spend path at all.

Selling the token sells the whole bundle; the seller's authority is revoked by construction.
No server, no IPFS, no external script at runtime, no admin key over the holder's guarantees.

This repository merges four earlier projects by the same author: ANIMA
(Cutting-edge-technologically-advanced-NFT), IPSEITY (Most-Advanced-NFT-Possible), ANIMA v7
(MASTER-NFT-PROJECT) and Pixel-Garden. `research/` holds the source-level reads of each, the 2026
ecosystem research, the candidate architectures and the judges' verdicts. `DESIGN.md` and
`BUILD-PLAN.md` are the authoritative specification; `docs/CHECKPOINT.md` says what is built, what is
verified and how to continue.

## Toolchain

Everything runs through Node 22 and solc-js 0.8.36 (viaIR, optimizer 800, cancun); no Foundry
binary is needed:

```sh
npm install
npm run compile                  # tools/compile.mjs — fails any contract over the EIP-170 ceiling; --ship prints the build that ships
npm run forge                    # tools/forge.mjs   — runs test/*.t.sol on @ethereumjs/vm with a cheatcode shim (--match <name> for one)
npm run check                    # tools/check.mjs   — the whole battery in DESIGN §13's order: every step must print exactly one
                                 #                     summary line reporting zero failures, and a missing step fails the run
                                 #                     (incomplete ≠ pass); --keep-going for the whole table, --only/--skip for a PARTIAL run
node tools/verify-findings.mjs   # every historical finding replayed: refuted on HEAD, or reproduced against a one-line variant
node tools/agents.mjs            # seven motives for 220 ticks over the whole bundle, the invariants asserted after every tick
node tools/invariants-check.mjs  # every docs/INVARIANTS.md and DESIGN §14 row names an assertion string that exists
npm run mutations                # tools/mutations.mjs — the E1/E3 mutation gate for Parley and Postage (a cold compile per mutation; not in check)
```

`CLAUDE.md` is what an agent working in this repository must know: the toolchain, the file-ownership
discipline, the summary-line contract every verifier obeys, and the traps with their reasons.

Status: waves 0–2 of the build plan are complete. U9 is in: the console's shell (`engine/app.html`),
its DOM-and-wallet shim, and the six lane panels (swap, social, launch, vault, identity, and the agent
stub until U17), each with its verify-site group; the build labels nothing a placeholder. U10 (CREATE3
factory, journaled deploy with a shard check on resume, machine-checked records, read-only gateway) is
complete, and `deployments/31337.json` is a record of the console from a local hardhat run. `npm run
check` runs the suite on both hub builds, the gas gate cold, every lane through the shim and the record
recovery; the counts are in `docs/CHECKPOINT.md` after each run. Next is wave 3: U11 Chromium journeys,
U12 the adversarial battery and documents, U13 the testnet rehearsal. Unaudited; nothing is deployed
beyond a local chain.
