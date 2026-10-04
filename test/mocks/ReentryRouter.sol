// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  ReentryRouter — a venue that tries two things from inside the swap

  Origin: Pixel-Garden test/contracts/FinancialMocks.sol `ReentryRouter`,
  adapted (OZ IERC20 and the Garden IV3Router interface replaced by local
  declarations). Posing as Uniswap's SwapRouter02 `exactInput`, it (1)
  tries to move the caller's token with whatever standing approval the
  parent transaction left, and (2) tries to pull one wei more than the
  exact approval the Router granted. Both flags must stay false.
───────────────────────────────────────────────────────────────────────────*/
interface IERC20R {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract ReentryRouter {
    struct ExactInputParams { bytes path; address recipient; uint256 amountIn; uint256 amountOutMinimum; }

    address public core;
    address public originalOwner;
    address public recipient;
    bool public parentTransferSucceeded;
    bool public overspendSucceeded;

    constructor(address core_, address owner_, address recipient_) {
        core = core_;
        originalOwner = owner_;
        recipient = recipient_;
    }

    function exactInput(ExactInputParams calldata p) external payable returns (uint256 out) {
        (parentTransferSucceeded, ) = core.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", originalOwner, recipient, 1));
        bytes calldata path = p.path;
        address input;
        address output;
        assembly {
            input := shr(96, calldataload(path.offset))
            output := shr(96, calldataload(add(path.offset, sub(path.length, 20))))
        }
        // The Router's approval is exact, even for the configured venue address.
        (overspendSucceeded, ) = input.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), p.amountIn + 1));
        IERC20R(input).transferFrom(msg.sender, address(this), p.amountIn);
        out = p.amountIn * 2;
        IERC20R(output).transfer(p.recipient, out);
    }
}
