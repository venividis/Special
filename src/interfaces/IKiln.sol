// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  IKiln and ICoin — the instant coin and the hook factory

  DESIGN.md §8.1 (`Kiln.launch(id, name, symbol, decimals, supply, salt,
  raiseShare)`), §8.4 (`mine`, `deployHook`, `WrongFlags`); from IPSEITY
  Kiln.sol and ANIMA AgentToken.sol (`Coin`: fixed supply, no owner,
  permit, burn-to-redeem floor with a native quote). Frozen after wave 0.
  `coinAt` mirrors the constructor arguments CREATE2 hashes (U0 choice).
───────────────────────────────────────────────────────────────────────────*/

struct LaunchRecord {
    address coin;
    uint64  launchedAt;
    uint256 supply;
    uint256 raiseShare;
}

interface IKilnEvents {
    event Launched(address indexed coin, uint256 indexed id, address indexed by, string symbol, uint256 supply, uint256 raiseShare);
    event HookDeployed(address indexed hook, address indexed by, uint16 flags);

    error NotActor();
    error NothingToLaunch();
    error ShareTooLarge();
    error BadName();
    error DeployFailed();
    error WrongFlags(uint16 wanted, uint16 got);
    error UnknownRecipe(uint8 kind);
}

interface IKiln is IKilnEvents {
    function launch(uint256 id, string calldata name_, string calldata symbol_, uint8 decimals_, uint256 supply, bytes32 salt, uint256 raiseShare)
        external returns (address coin);                                        // acts
    function coinAt(uint256 id, address by, string calldata name_, string calldata symbol_, uint8 decimals_, uint256 supply, bytes32 salt, uint256 raiseShare)
        external view returns (address);
    function mine(bytes32 initCodeHash, uint16 flags, uint256 from, uint256 tries)
        external view returns (bool found, bytes32 salt, address at);
    function deployHook(uint8 kind, bytes32 salt, bytes32 arg) external returns (address hook);
    function recipeHash(uint8 kind, bytes32 arg) external view returns (bytes32 initCodeHash, uint16 flags);

    /*── records ──*/
    function recordsOf(uint256 id) external view returns (LaunchRecord[] memory);
    function launchCount(uint256 id) external view returns (uint256);
    function launchedBy(address coin) external view returns (uint256);
    function coinCount() external view returns (uint256);
    function recent(uint256 from, uint256 count) external view returns (address[] memory);

    function HUB() external view returns (address);
    function LAUNCHPAD() external view returns (address);
    function POOL_MANAGER() external view returns (address);
}

/// @notice A launched coin: ERC-20 + ERC-2612, no owner, burn-to-redeem floor.
interface ICoin {
    event Contributed(address indexed from, uint256 amount);
    event Redeemed(address indexed from, uint256 burned, uint256 paid);

    error NotEnough();
    error ZeroAmount();
    error TransferFailed();
    error Expired();
    error BadSignature();

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address who) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function burn(uint256 amount) external;
    function contribute() external payable;                                 // raises every holder's floor
    function redeem(uint256 amount) external returns (uint256 paid);        // burn for the floor share
    function floorPerToken() external view returns (uint256);               // wei per whole token
    function redemptionPool() external view returns (uint256);
    function LAUNCHER() external view returns (uint256);                    // the Intact that launched it
    function KILN() external view returns (address);
}
