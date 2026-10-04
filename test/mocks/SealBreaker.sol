// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  SealBreaker — a contract holder that re-enters `unguard` from inside a
  sealed batch

  Origin: IPSEITY test/mocks/SealBreaker.sol, adapted to INTACT's
  `mint(to)` (accounts are created in the mint transaction; there is no
  `embody`). `_snapshot` and `_verify` align `pre[]` and `seen[]` with the
  manifest BY INDEX; an `unguard` re-entered mid-batch renumbers the
  manifest under them. The Reach refuses it (`ManifestBusy`).
───────────────────────────────────────────────────────────────────────────*/
interface IHubMint {
    function mint(address to) external payable returns (uint256);
    function account(uint256 id) external view returns (address);
}
interface IAcct {
    function guard(address) external;
    function unguard(address) external;
    function seal(uint64) external;
    function execute(address, uint256, bytes calldata, uint8) external payable returns (bytes memory);
    struct Call { address to; uint256 value; bytes data; }
    function executeBatch(Call[] calldata) external payable returns (bytes[] memory);
}

contract SealBreaker {
    IHubMint public hub; address public acct; address public blind;
    uint256 public id;
    receive() external payable {}
    function setup(address h, address brk, address gold) external payable {
        hub = IHubMint(h);
        id = hub.mint{value: msg.value}(address(this));
        acct = hub.account(id);
        IAcct(acct).guard(brk);   // index 0
        IAcct(acct).guard(gold);  // index 1
        blind = brk;
    }
    function sealIt(uint64 until) external { IAcct(acct).seal(until); }
    /// called by the account, from inside the sealed batch
    function trigger() external { IAcct(acct).unguard(blind); }
    function drain(address gold, uint256 amount, address to) external {
        IAcct.Call[] memory cs = new IAcct.Call[](2);
        cs[0] = IAcct.Call(gold, 0, abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        cs[1] = IAcct.Call(address(this), 0, abi.encodeWithSignature("trigger()"));
        IAcct(acct).executeBatch(cs);
    }
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
