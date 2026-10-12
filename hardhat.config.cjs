/*  Hardhat is here for exactly one thing: `npx hardhat node`, a local
    testnet with real blocks, real receipts and a real eth_getLogs, so
    tools/deploy.mjs and tools/gateway.mjs can be exercised over a wire
    instead of in-process. Compilation stays with tools/compile.mjs —
    `sources` points at an empty directory so hardhat never reaches for a
    compiler of its own (and never reaches for the network to fetch one).
    Origin: IPSEITY hardhat.config.cjs, verbatim in intent.                */
module.exports = {
  solidity: "0.8.28",
  paths: { sources: "./.hh-empty" },
  networks: {
    hardhat: {
      chainId: 31337,
      /*  Cancun, explicitly — the hardfork the contracts are compiled for.
          Left to default, hardhat runs Osaka rules, where EIP-7825 caps a
          transaction at 2^24 gas and applies that cap to eth_call as
          well, so a large view fails with a bare revert while every
          transaction still lands. The contracts assume Cancun with the
          2^24 transaction cap (DESIGN.md §12); tools/rpc.mjs asserts the
          cap on every send, so pinning Cancun here loses nothing.      */
      hardfork: "cancun",
      mining: { auto: true },
      initialBaseFeePerGas: 1_000_000_000
    }
  }
};
