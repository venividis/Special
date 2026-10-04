// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20V {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/*───────────────────────────────────────────────────────────────────────────
  MockVenue — a swap counterparty that delivers exactly what it is told to,
  which may be less than it was promised (INTACT U2, NEW; a fixture)

  `executeTyped` is "swap exactly this for at least that"; the venue is the
  thing that might not. `swap` pulls `amountIn` of `tokenIn` from the caller
  through the exact allowance the Reach set, and pushes `amountOut` of
  `tokenOut` from its own stock — whatever the caller asked, so a test can
  ask for a shortfall. `pull` takes without giving; `swapEth` takes ether.
───────────────────────────────────────────────────────────────────────────*/
contract MockVenue {
    receive() external payable {}

    function swap(address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut) external {
        IERC20V(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20V(tokenOut).transfer(msg.sender, amountOut);
    }

    function pull(address tokenIn, uint256 amountIn) external {
        IERC20V(tokenIn).transferFrom(msg.sender, address(this), amountIn);
    }

    function swapEth(address tokenOut, uint256 amountOut) external payable {
        IERC20V(tokenOut).transfer(msg.sender, amountOut);
    }

    function stock(address token) external view returns (uint256) {
        (bool ok, bytes memory r) = token.staticcall(abi.encodeWithSignature("balanceOf(address)", address(this)));
        return ok && r.length >= 32 ? abi.decode(r, (uint256)) : 0;
    }
}
