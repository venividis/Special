// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  SyncInsidePull — a token that moves the curve from inside the pull

  Origin: IPSEITY test/mocks/Hooked.sol, adapted to INTACT's
  `syncCurve(id, curveBps, expected)` (DESIGN C2). The Pool pulls the input
  before it prices against the curve; if the pull is a window, the token's
  holder — the one actor allowed to move the curve — can flatten it mid-
  trade. INTACT reads reserves and offsets into memory BEFORE `_pull` and
  puts `syncCurve` under the same `Transient` lock, so the attempt must
  revert `Reentrancy`, and `test_aSyncInsideThePullReverts` asserts it.
───────────────────────────────────────────────────────────────────────────*/
interface IPoolSync { function syncCurve(uint256 id, uint24 curveBps, uint24 expected) external; }

contract SyncInsidePull {
    string public name = "SyncInsidePull";
    string public symbol = "SYNC";
    uint8 public constant decimals = 18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    address public pool;
    uint256 public id;
    uint24 public expected;
    bool public armed;
    bool public syncSucceeded;
    bytes public lastRevert;

    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }

    function arm(address pool_, uint256 id_, uint24 expected_) external {
        pool = pool_; id = id_; expected = expected_; armed = true; syncSucceeded = false;
    }

    function transfer(address to, uint256 a) external returns (bool) {
        balanceOf[msg.sender] -= a; balanceOf[to] += a; return true;
    }

    function transferFrom(address from, address to, uint256 a) external returns (bool) {
        if (armed) {
            armed = false;                       // once, so the attempt cannot recurse
            (bool ok, bytes memory ret) = pool.call(
                abi.encodeCall(IPoolSync.syncCurve, (id, 0, expected)));
            syncSucceeded = ok;
            lastRevert = ret;
        }
        uint256 al = allowance[from][msg.sender];
        if (al != type(uint256).max) allowance[from][msg.sender] = al - a;
        balanceOf[from] -= a; balanceOf[to] += a; return true;
    }
}
