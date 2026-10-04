// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "forge-std/Test.sol";
import "../src/Placeholder.sol";

contract PlaceholderTest is Test {
    Placeholder p;
    function setUp() public { p = new Placeholder(); }
    function test_theValueOnlyEverRises() public {
        p.raise(5);
        vm.expectRevert(Placeholder.Shrank.selector);
        p.raise(5);
        p.raise(6);
        assertEq(p.value(), 6);
    }
}
