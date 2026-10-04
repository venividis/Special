# Toolchain facts measured in this container (2026-10-02)

- Node v22.22.0, npm 10.9.4, 4 CPUs, 15 GB RAM, ~30 GB free disk. No forge, no system solc.
- npm ci works through the proxy for all four repos (ANIMA 13s, IPSEITY 11s, Garden 13s, MASTER 11s; MASTER has only 26 node_modules — it vendors in integrations/).
- ANIMA (Cutting-edge): `npx hardhat compile` succeeds: 54 Solidity files, solc 0.8.28 downloaded, evm cancun, 3m18s wall.
- IPSEITY (Most-Advanced): `node tools/compile.mjs` succeeds with solc-js 0.8.36 viaIR: all contracts fit under EIP-170; 3m57s wall (cold).
- Playwright Chromium pre-installed at /opt/pw-browsers (PLAYWRIGHT_BROWSERS_PATH set).
