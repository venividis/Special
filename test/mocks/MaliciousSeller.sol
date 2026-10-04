// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  MaliciousSeller — a seller that hollows out its own token from inside
  the payment callback

  Origin: ANIMA contracts/mocks/MaliciousSeller.sol, adapted (no brain, no
  bond: the three INTACT shapes of the same attack). If a market pays the
  seller before moving the token, the seller is still `ownerOf(id)` when it
  receives control, and an owner can drain the Reach, grant a session key
  to itself that outlives the sale, and hand the ERC-4907 user to itself.
  Every attempt is wrapped so the fill completes; the test asserts none
  of them worked — the Reach's seal refuses the drain, the custody epoch
  kills the session, and `_update` clears the user.
───────────────────────────────────────────────────────────────────────────*/
interface IHubStrip {
    function setApprovalForAll(address operator, bool approved) external;
    function account(uint256 id) external view returns (address);
    function setUser(uint256 id, address user, uint64 expires) external;
}
interface IReachStrip {
    function execute(address to, uint256 value, bytes calldata data, uint8 operation) external payable returns (bytes memory);
    struct AssetCap { address asset; uint128 cap; }
    function grantSession(address key, uint64 expires, uint128 nativeCap, AssetCap[] calldata caps,
        address[] calldata targets, bytes4[] calldata selectors, uint32 minInterval, uint32 uses) external;
}
interface IERC20S {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}

contract MaliciousSeller {
    IHubStrip public immutable HUB;
    address public immutable ASSET;
    address public immutable BENEFICIARY;

    uint256 public id;
    bool public armed;

    bool public drainSucceeded;
    bool public sessionSucceeded;
    bool public userSucceeded;

    constructor(address hub_, address asset_, address beneficiary_) {
        HUB = IHubStrip(hub_);
        ASSET = asset_;
        BENEFICIARY = beneficiary_;
    }

    /// @dev Signs anything, which is all an ERC-1271 maker needs to do to place an order.
    function isValidSignature(bytes32, bytes memory) external pure returns (bytes4) {
        return 0x1626ba7e;
    }

    function arm(uint256 id_, address market) external {
        id = id_;
        armed = true;
        HUB.setApprovalForAll(market, true);
    }

    receive() external payable {
        if (!armed) return;
        armed = false;

        address reach = HUB.account(id);

        try IReachStrip(reach).execute(
            ASSET, 0, abi.encodeCall(IERC20S.transfer, (BENEFICIARY, IERC20S(ASSET).balanceOf(reach))), 0
        ) {
            drainSucceeded = true;
        } catch {}

        IReachStrip.AssetCap[] memory caps;
        address[] memory targets = new address[](1); targets[0] = ASSET;
        bytes4[] memory sels = new bytes4[](1); sels[0] = IERC20S.transfer.selector;
        try IReachStrip(reach).grantSession(BENEFICIARY, uint64(block.timestamp + 30 days), 0, caps, targets, sels, 0, 0) {
            sessionSucceeded = true;
        } catch {}

        try HUB.setUser(id, BENEFICIARY, uint64(block.timestamp + 30 days)) {
            userSucceeded = true;
        } catch {}
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
