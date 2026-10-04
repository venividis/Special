// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  RebasingToken — balances that move without a transfer (INTACT U0, NEW,
  for DESIGN C5: "a downward rebase makes the cap zero and `withdraw`
  reverts `Insolvent` — fail closed, stated and tested").

  Shares are stored; balances are shares × multiplier / 1e18. `rebase(m)`
  moves every balance at once, up or down, exactly as stETH or AMPL would.
───────────────────────────────────────────────────────────────────────────*/
contract RebasingToken {
    string public name = "Rebasing";
    string public symbol = "RBS";
    uint8 public constant decimals = 18;

    uint256 public multiplier = 1e18;
    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Rebased(uint256 multiplier);

    function rebase(uint256 newMultiplier) external { multiplier = newMultiplier; emit Rebased(newMultiplier); }

    function mint(address to, uint256 amount) external {
        uint256 s = amount * 1e18 / multiplier;
        totalShares += s; sharesOf[to] += s; emit Transfer(address(0), to, amount);
    }

    function totalSupply() external view returns (uint256) { return totalShares * multiplier / 1e18; }
    function balanceOf(address who) public view returns (uint256) { return sharesOf[who] * multiplier / 1e18; }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount; emit Approval(msg.sender, spender, amount); return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) { _move(msg.sender, to, amount); return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        _move(from, to, amount); return true;
    }
    function _move(address from, address to, uint256 amount) private {
        uint256 s = amount * 1e18 / multiplier;
        if (s * multiplier / 1e18 < amount) s += 1;        // round the shares up so `to` receives ≥ amount
        sharesOf[from] -= s; sharesOf[to] += s; emit Transfer(from, to, amount);
    }
}
