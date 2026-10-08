// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  Create3Factory — one address per salt, on every band, whatever the code

  Origin: the CREATE3 shape Solady's `CREATE3.sol` made standard, written
  out here by hand (INTACT U10, DESIGN.md §12 "Addresses"); no import, as
  src/ has no external Solidity dependencies anywhere.

  The problem it solves. CREATE2 lands at keccak(0xff ‖ deployer ‖ salt ‖
  keccak(initcode)): the ADDRESS DEPENDS ON THE INITCODE, and INTACT's
  initcode differs per band — every satellite takes the band's bounds or
  the band's Uniswap addresses as constructor arguments. So CREATE2 alone
  would give `Pool` three addresses on three chains. CREATE3 puts one hop
  in between: CREATE2 deploys a tiny PROXY whose initcode is a fixed
  sixteen bytes, so the proxy's address is a function of (factory, salt)
  only; the proxy then CREATEs the real contract from its own nonce, which
  is 1 for a fresh contract, so the real address is keccak(rlp([proxy,1]))
  — also a function of (factory, salt) only. The constructor arguments can
  be anything; the address does not move.

  The proxy. Its initcode is
      67 363d3d37363d34f0   PUSH8 <the eight-byte runtime>
      3d 52                 RETURNDATASIZE MSTORE      (store it at 24..32)
      60 08 60 18 f3        PUSH1 8 PUSH1 24 RETURN    (return those 8 bytes)
  and the eight bytes it returns, the proxy's whole runtime, are
      36 3d 3d 37           CALLDATASIZE RETURNDATASIZE RETURNDATASIZE CALLDATACOPY
      36 3d 34 f0           CALLDATASIZE RETURNDATASIZE CALLVALUE CREATE
  — copy the calldata (the real initcode) to memory, CREATE it with the
  value that came along, and stop. It keeps no code path for a second
  call: with its nonce now 2 it could only ever create at a different
  address, and nothing calls it again anyway.

  Who deploys the factory decides every address. The factory is itself
  deployed by plain CREATE from a FRESH burner at nonce 0, so
  `factory = keccak(rlp([burner, 0]))`; the same burner key on every band
  gives the same factory, and so every salt gives the same address on
  every band. That is why the deployer does NOT enter the salt here, where
  Solady's `deployDeterministic` callers usually mix it in: mixing the
  sender in would make the addresses depend on who sends the transaction,
  and the whole point is that they depend only on the burner that made
  the factory and on the name of the contract. The cost is that anyone may
  use a salt once; the deploy script checks what landed (the `Deployed`
  event's address against the prediction, the codehash against the
  compiled runtime) and refuses to publish a record it cannot confirm.

  Refusals: a salt whose address already holds code (`SaltUsed`), a proxy
  that did not deploy or a constructor that reverted or returned no code
  (`DeploymentFailed`) — the transaction reverts, so nothing half-lands and
  the salt stays usable.

  Measured (tools/compile.mjs, solc 0.8.36, viaIR, 800 runs, bytecodeHash
  none): 757 bytes of runtime (783 of initcode), 3.1 % of EIP-170.
───────────────────────────────────────────────────────────────────────────*/
contract Create3Factory {
    /// @notice A contract landed at `addr` under `salt`.
    event Deployed(bytes32 indexed salt, address indexed addr);

    error SaltUsed();
    error DeploymentFailed();

    /// @dev The sixteen-byte proxy initcode, right-aligned in a word, and
    ///      its keccak — the constant every CREATE2 prediction uses.
    uint256 private constant PROXY_INITCODE = 0x67363d3d37363d34f03d5260086018f3;
    bytes32 public constant PROXY_INITCODE_HASH =
        0x21c35dbe1b344a2488cf3321d6ce542f8e9f305544ff09e4993a62319a497c1f;

    /// @notice Deploy `creationCode` at the address `salt` names, forwarding
    ///         `msg.value` to its constructor.
    /// @dev    Order matters: the salt is checked against code at the
    ///         PREDICTED address, not the proxy's, because a proxy that
    ///         exists means a deployment already happened (the two are made
    ///         in one transaction or not at all).
    function deploy(bytes32 salt, bytes memory creationCode) external payable returns (address deployed) {
        deployed = predict(salt);
        if (deployed.code.length != 0) revert SaltUsed();

        address proxy;
        assembly ("memory-safe") {
            mstore(0x00, PROXY_INITCODE)
            proxy := create2(0, 0x10, 0x10, salt)
        }
        if (proxy == address(0)) revert DeploymentFailed();

        // The proxy CREATEs whatever it is sent and keeps nothing of the
        // outcome; the only evidence is code at the predicted address.
        (bool ok,) = proxy.call{value: msg.value}(creationCode);
        if (!ok || deployed.code.length == 0) revert DeploymentFailed();
        emit Deployed(salt, deployed);
    }

    /// @notice Where `salt` lands from this factory, before or after the
    ///         fact, for any initcode.
    function predict(bytes32 salt) public view returns (address deployed) {
        address proxy = address(uint160(uint256(
            keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, PROXY_INITCODE_HASH)))));
        // rlp([proxy, 1]) = 0xd6 0x94 <20 bytes> 0x01: a fresh contract's first CREATE
        deployed = address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", proxy, hex"01")))));
    }
}
