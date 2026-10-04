// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  HostileToken — an ERC-20 that misbehaves on command (INTACT U0, NEW;
  the modes are the ones IPSEITY's Breakable/Nasty and ANIMA's
  MockTaxERC20 each covered alone).

    mode 0  honest
    mode 1  approve reverts            — the Reach's revokeOpenApprovals must not block
    mode 2  transfer/transferFrom revert
    mode 3  transfer returns false     — ExactERC20 must refuse
    mode 4  fee on transfer, 10 %      — ExactERC20 must refuse; the Pool must measure
    mode 5  balanceOf reverts          — the Reach's measurement goes blind
    mode 6  burns all gas on any call  — stipends must hold
    mode 7  re-enters `target` with `payload` from inside transferFrom
───────────────────────────────────────────────────────────────────────────*/
contract HostileToken {
    string public name = "Hostile";
    string public symbol = "<script>alert(1)</script>";
    uint8 public constant decimals = 18;

    uint8 public mode;
    address public target;
    bytes public payload;
    bool public reentered;

    uint256 public totalSupply;
    mapping(address => uint256) internal _bal;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function setMode(uint8 m) external { mode = m; }
    function arm(address t, bytes calldata p) external { target = t; payload = p; mode = 7; }

    function mint(address to, uint256 amount) external {
        totalSupply += amount; _bal[to] += amount; emit Transfer(address(0), to, amount);
    }

    function balanceOf(address who) external view returns (uint256) {
        if (mode == 5) revert("blind");
        if (mode == 6) _burn();
        return _bal[who];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (mode == 1) revert("no approve");
        if (mode == 6) _burn();
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _move(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        if (mode == 7 && !reentered) {
            reentered = true;
            (bool ok, ) = target.call(payload);
            ok;
        }
        return _move(from, to, amount);
    }

    function _move(address from, address to, uint256 amount) private returns (bool) {
        if (mode == 2) revert("no transfer");
        if (mode == 6) _burn();
        _bal[from] -= amount;
        uint256 net = mode == 4 ? amount - amount / 10 : amount;
        _bal[to] += net;
        if (net != amount) totalSupply -= amount - net;
        emit Transfer(from, to, net);
        return mode != 3;
    }

    function _burn() private view {
        uint256 x;
        while (gasleft() > 500) { x = uint256(keccak256(abi.encode(x))); }
    }
}
