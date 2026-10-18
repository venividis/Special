/*  A hardhat fork of a rehearsal chain (tools/testnet.mjs --fork): the
    venue table, the Router, the custodian and the v4 launch path meet the
    real venues' code and state before a live run spends anything. The
    chain id is the forked chain's own, so tools/deploy.mjs reads VENUES for
    it; the rules are cancun, the hardfork the contracts are compiled for
    (hardhat.config.cjs says why). Execution AT the fork block would need
    the forked chain's hardfork history, which this node is not given, so
    tools/testnet.mjs mines one local block before it reads anything.
    FORK_URL and FORK_CHAIN_ID come from the environment, never a file.  */
module.exports = {
  solidity: "0.8.28",
  paths: { sources: "./.hh-empty" },
  networks: {
    hardhat: {
      chainId: Number(process.env.FORK_CHAIN_ID || 84532),
      hardfork: "cancun",
      forking: { url: process.env.FORK_URL || "", enabled: Boolean(process.env.FORK_URL) },
      mining: { auto: true },
      initialBaseFeePerGas: 1_000_000_000
    }
  }
};
