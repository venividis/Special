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
`BUILD-PLAN.md` are the authoritative specification once the synthesis step lands them.

## Toolchain

Everything runs through Node 22 and solc-js 0.8.36 (viaIR, optimizer 800, cancun); no Foundry
binary is needed:

```sh
npm install
npm run compile     # tools/compile.mjs — fails any contract over the EIP-170 ceiling
npm run forge       # tools/forge.mjs   — runs test/*.t.sol on @ethereumjs/vm with a cheatcode shim
npm run check       # both
```

Status: design complete, implementation starting. Unaudited; nothing is deployed.
