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
npm run drive                    # tools/testnet-drive.mjs — the console journey in Chromium over a real wire (hardhat, the CREATE3 deploy, the gateway)
npm run testnet -- --chain 31337 --confirm DEPLOY_INTACT_LOCAL   # tools/testnet.mjs — the rehearsal in one command: preflight, deploy, the campaign, recovery, the gateway diff (docs/DEPLOYMENT.md)
npm run verify:mcp               # sdk/mcp.test.mjs — the MCP bridge: tools from services.json, the drift refusal, propose then act
npm run verify:plate             # tools/verify-plate.mjs — the ENS resolver on a local ENS fixture: custody is the binding, the wildcard, the clock
node tools/deploy.mjs --chain 31337 --confirm DEPLOY_INTACT_LOCAL --satellite all   # land the post-MVB satellites through the Timelock for a recorded deployment (docs/DEPLOYMENT.md)
```

`CLAUDE.md` is what an agent working in this repository must know: the toolchain, the file-ownership
discipline, the summary-line contract every verifier obeys, and the traps with their reasons.

Status: waves 0–3 of the build plan are complete, and wave 4's five post-MVB units are in. U9 is the
console: the shell (`engine/app.html`), its DOM-and-wallet shim, and the six lane panels (swap, social,
launch, vault, identity, agent), each with its verify-site group. U10 is the deployment: CREATE3 factory,
journaled deploy with a shard check on resume, machine-checked records, a read-only gateway, and
`deployments/31337.json` from a local hardhat run. U11 drives the console in a real Chromium
(`tools/verify-console.mjs`) and over a real wire (`tools/testnet-drive.mjs`); U12 is the battery around it
(`tools/verify-findings.mjs`, `tools/agents.mjs`, `tools/invariants-check.mjs`, `tools/mutations.mjs`, and
`npm run check` as `tools/check.mjs`, which never calls an incomplete run green); U13 is the rehearsal in one
command (`tools/testnet.mjs`, with `tools/verify-gateway.mjs` diffing a gateway against the chain), proved over
a local hardhat wire; its live run on Base Sepolia and Sepolia still awaits a funded burner. Wave 4: U14 is the
Uniswap v4 launch path (`LaunchHook`, one immutable contract per launch, and `LPCustodian`, which seeds the
position and pays every fee to `feeSink(id)`), U15 the `Market` where a listing is a seal, U16 the ERC-7432
`Roles` that lock the token instead of escrowing it, U17 the `AgentCard` (face 2 is the ERC-8004
registration), the agent lane with its `executeAsSession` composer and the MCP bridge in `sdk/`, and U18 the
`Nameplate`, band 0's adminless ENS resolver. The post-MVB satellites land only through the Timelock's
seven-day queue at the addresses the MVB pinned (`tools/deploy.mjs --satellite`), the record and the recovery
follow them, and the service table is two contracts so the MVB rows stay under the transaction cap. The
counts are in `docs/CHECKPOINT.md` after each run. Unaudited; nothing is deployed beyond a local chain.
