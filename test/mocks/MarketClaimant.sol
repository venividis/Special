// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  MarketClaimant — a payee that misbehaves when the Market pays it
  (INTACT U15, NEW; the shape of IPSEITY's Breakable, on the pull side)

    mode 0  accepts the payment
    mode 1  re-enters `claim` from inside the payment and records what it met
    mode 2  refuses the payment — the send must fail and the ledger must stand
───────────────────────────────────────────────────────────────────────────*/
interface IMarketClaim { function claim() external; }

contract MarketClaimant {
    error Refused();

    IMarketClaim public immutable MARKET;
    uint8 public mode;
    bool public innerOk;
    bytes4 public innerError;
    uint256 public received;

    constructor(address market) { MARKET = IMarketClaim(market); }

    function setMode(uint8 m) external { mode = m; }

    function claim() external { MARKET.claim(); }

    receive() external payable {
        received += msg.value;
        if (mode == 2) revert Refused();
        if (mode == 1) {
            (bool ok, bytes memory r) = address(MARKET).call(abi.encodeCall(IMarketClaim.claim, ()));
            innerOk = ok;
            innerError = r.length >= 4 ? bytes4(r) : bytes4(0);
        }
    }
}
