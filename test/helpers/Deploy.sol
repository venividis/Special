// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {IIntact, IIntactEvents, Core, Status, Traits} from "../../src/interfaces/IIntact.sol";
import {IDiamond, IDiamondLoupe} from "../../src/interfaces/Standards.sol";
import {Rights} from "../../src/lib/Rights.sol";
import {Intact} from "../../src/hub/Intact.sol";
import {IntactConfig} from "../../src/hub/IntactBase.sol";
import {IntactDiamond} from "../../src/hub/IntactDiamond.sol";
import {CoreFacet} from "../../src/hub/facets/CoreFacet.sol";
import {RightsFacet} from "../../src/hub/facets/RightsFacet.sol";
import {MintFacet} from "../../src/hub/facets/MintFacet.sol";
import {SiteFacet} from "../../src/hub/facets/SiteFacet.sol";
import "./HubMocks.sol";
import {Reach} from "../../src/Reach.sol";
import {Grip} from "../../src/Grip.sol";
import {KeyRegistry} from "../../src/KeyRegistry.sol";
import {Timelock} from "../../src/Timelock.sol";
import {Locks} from "../../src/Locks.sol";
import {Postage} from "../../src/Postage.sol";
import {Parley} from "../../src/Parley.sol";
import {Roster} from "../../src/Roster.sol";
import {Steward} from "../../src/Steward.sol";
import {Pool} from "../../src/Pool.sol";
import {Kiln} from "../../src/Kiln.sol";
import {Launchpad} from "../../src/Launchpad.sol";
import {MockPoolManager} from "../mocks/MockPoolManager.sol";

/*───────────────────────────────────────────────────────────────────────────
  The test world, for either build (INTACT U1, NEW)

  `INTACT_IMPL=monolith` (the default) deploys `Intact`; `INTACT_IMPL=
  diamond` deploys the four facets and wires them into `IntactDiamond`.
  Every suite reads `hub` as `IIntact` and never learns which it got, so
  the same assertions run twice in CI (BUILD-PLAN.md U1 done-criterion).

  The ERC-6551 registry is the REAL one: its 571-byte runtime (Pixel-Garden
  test/fixtures/erc6551-registry.json, keccak 0xda1d5b06…) is etched at
  the canonical address, so the hub's constructor check against
  `AccountBinding.REGISTRY_HASH` is satisfied honestly and every account
  the hub derives is checked against the real CREATE2 derivation rather
  than a convenient stand-in.

  The cut below is the one hand-written selector list in the repository,
  and it is written as `IIntact.<fn>.selector` so the compiler refuses a
  name the interface does not have. `tools/facets.mjs` derives the same
  partition from the compiled ABIs and refuses any drift between the two;
  test/Diamond.t.sol proves each listed selector is served by real code
  in both builds.
───────────────────────────────────────────────────────────────────────────*/
abstract contract IntactFixture is Test {
    address constant REGISTRY = 0x000000006551c19487814612e58FE06813775758;
    address constant DELEGATE_REGISTRY = 0x00000000000000447e69651d841bD8D104Bed493;
    bytes constant REGISTRY_RUNTIME =
        hex"608060405234801561001057600080fd5b50600436106100365760003560e01c8063246a00211461003b5780638a54c52f1461006a575b600080fd5b61004e6100493660046101b7565b61007d565b6040516001600160a01b03909116815260200160405180910390f35b61004e6100783660046101b7565b6100e1565b600060806024608c376e5af43d82803e903d91602b57fd5bf3606c5285605d52733d60ad80600a3d3981f3363d3d373d3d3d363d7360495260ff60005360b76055206035523060601b60015284601552605560002060601b60601c60005260206000f35b600060806024608c376e5af43d82803e903d91602b57fd5bf3606c5285605d52733d60ad80600a3d3981f3363d3d373d3d3d363d7360495260ff60005360b76055206035523060601b600152846015526055600020803b61018b578560b760556000f580610157576320188a596000526004601cfd5b80606c52508284887f79f19b3655ee38b1ce526556b7731a20c8f218fbda4a3990b6cc4172fdf887226060606ca46020606cf35b8060601b60601c60005260206000f35b80356001600160a01b03811681146101b257600080fd5b919050565b600080600080600060a086880312156101cf57600080fd5b6101d88661019b565b945060208601359350604086013592506101f46060870161019b565b94979396509194608001359291505056fea2646970667358221220ea2fe53af507453c64dd7c1db05549fa47a298dfb825d6d11e1689856135f16764736f6c63430008110033";

    uint64 constant T0 = 1_733_000_000;
    uint256 constant PRICE = 0.01 ether;
    uint8 constant BAND = 1;
    uint256 constant LO = 1;
    uint256 constant HI = 3072;
    bytes4 constant SAFE_TRANSFER = bytes4(keccak256("safeTransferFrom(address,address,uint256)"));
    bytes4 constant SAFE_TRANSFER_DATA = bytes4(keccak256("safeTransferFrom(address,address,uint256,bytes)"));

    MockReachImpl reachImpl;
    MockGripImpl gripImpl;
    MockRenderer renderer;
    MockPool pool;
    MockLocks locks;
    MockLaunchpad launchpad;
    MockSteward steward;
    MockRoles roles;
    address market = address(0x3A2CE7);
    address timelock = address(0x71AE10C);
    address catalog = address(0xCA7A106);
    address premises = address(0x93E3155);
    address parley = address(0x9A31E7);

    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA201);
    address guardian = address(0x6A2D1A);

    IIntact hub;
    bool diamondBuild;

    function setUpWorld() internal {
        vm.warp(T0);
        vm.etch(REGISTRY, REGISTRY_RUNTIME);
        reachImpl = new MockReachImpl();
        gripImpl = new MockGripImpl();
        renderer = new MockRenderer();
        pool = new MockPool();
        locks = new MockLocks();
        launchpad = new MockLaunchpad();
        steward = new MockSteward();
        roles = new MockRoles();
        diamondBuild = keccak256(bytes(vm.envOr("INTACT_IMPL", "monolith"))) == keccak256("diamond");
        hub = diamondBuild ? deployDiamond(config(), PRICE) : deployMonolith(config(), PRICE);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
    }

    function config() internal view returns (IntactConfig memory c) {
        c = IntactConfig({
            reachImpl: address(reachImpl), gripImpl: address(gripImpl),
            band: BAND, bandLo: LO, bandHi: HI,
            steward: address(steward), market: market, roles: address(roles), pool: address(pool),
            parley: parley, launchpad: address(launchpad), locks: address(locks),
            renderer: address(renderer), catalog: catalog, premises: premises, timelock: timelock
        });
    }

    function deployMonolith(IntactConfig memory c, uint256 price) internal returns (IIntact) {
        return IIntact(address(new Intact(c, price)));
    }

    function deployDiamond(IntactConfig memory c, uint256 price) internal returns (IIntact) {
        return IIntact(address(new IntactDiamond(cutFor(c), price)));
    }

    function cutFor(IntactConfig memory c) internal returns (IDiamond.FacetCut[] memory) {
        return cut(address(new CoreFacet(c)), address(new RightsFacet(c)), address(new MintFacet(c)), address(new SiteFacet(c)));
    }

    function cut(address core, address rights, address mint_, address site)
        internal pure returns (IDiamond.FacetCut[] memory cuts)
    {
        cuts = new IDiamond.FacetCut[](4);
        cuts[0] = IDiamond.FacetCut(core, IDiamond.FacetCutAction.Add, coreSelectors());
        cuts[1] = IDiamond.FacetCut(rights, IDiamond.FacetCutAction.Add, rightsSelectors());
        cuts[2] = IDiamond.FacetCut(mint_, IDiamond.FacetCutAction.Add, mintSelectors());
        cuts[3] = IDiamond.FacetCut(site, IDiamond.FacetCutAction.Add, siteSelectors());
    }

    /*═══════════════════ the partition (DESIGN §3 rows 2–5) ═══════════════════*/

    function coreSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](51);
        uint256 i;
        s[i++] = IIntact.supportsInterface.selector;
        s[i++] = IIntact.name.selector;
        s[i++] = IIntact.symbol.selector;
        s[i++] = IIntact.balanceOf.selector;
        s[i++] = IIntact.ownerOf.selector;
        s[i++] = IIntact.getApproved.selector;
        s[i++] = IIntact.isApprovedForAll.selector;
        s[i++] = IIntact.approve.selector;
        s[i++] = IIntact.setApprovalForAll.selector;
        s[i++] = IIntact.transferFrom.selector;
        s[i++] = SAFE_TRANSFER;
        s[i++] = SAFE_TRANSFER_DATA;
        s[i++] = IIntact.totalSupply.selector;
        s[i++] = IIntact.tokenOfOwnerByIndex.selector;
        s[i++] = IIntact.tokenByIndex.selector;
        s[i++] = IIntact.approvalEpoch.selector;
        s[i++] = IIntact.setApprovalForAllUntil.selector;
        s[i++] = IIntact.revokeAllApprovals.selector;
        s[i++] = IIntact.approvalExpiryOf.selector;
        s[i++] = IIntact.custodyEpoch.selector;
        s[i++] = IIntact.locked.selector;
        s[i++] = IIntact.isTransferable.selector;
        s[i++] = IIntact.moduleLock.selector;
        s[i++] = IIntact.moduleUnlock.selector;
        s[i++] = IIntact.sealTransfer.selector;
        s[i++] = IIntact.transferSealUntil.selector;
        s[i++] = IIntact.stewardTransfer.selector;
        s[i++] = IIntact.moduleTransfer.selector;
        s[i++] = IIntact.panic.selector;
        s[i++] = IIntact.release.selector;
        s[i++] = IIntact.royaltyInfo.selector;
        s[i++] = IIntact.REGISTRY.selector;
        s[i++] = IIntact.REACH_IMPL.selector;
        s[i++] = IIntact.GRIP_IMPL.selector;
        s[i++] = IIntact.REACH_SALT.selector;
        s[i++] = IIntact.GRIP_SALT.selector;
        s[i++] = IIntact.BAND.selector;
        s[i++] = IIntact.BAND_LO.selector;
        s[i++] = IIntact.BAND_HI.selector;
        s[i++] = IIntact.STEWARD.selector;
        s[i++] = IIntact.MARKET.selector;
        s[i++] = IIntact.ROLES.selector;
        s[i++] = IIntact.POOL.selector;
        s[i++] = IIntact.PARLEY.selector;
        s[i++] = IIntact.LAUNCHPAD.selector;
        s[i++] = IIntact.LOCKS.selector;
        s[i++] = IIntact.RENDERER.selector;
        s[i++] = IIntact.CATALOG.selector;
        s[i++] = IIntact.PREMISES.selector;
        s[i++] = IIntact.TIMELOCK.selector;
        s[i++] = IIntact.intactConfigHash.selector;
        require(i == s.length, "core count");
    }

    function rightsSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](16);
        uint256 i;
        s[i++] = IIntact.rightsOf.selector;
        s[i++] = IIntact.holds.selector;
        s[i++] = IIntact.acts.selector;
        s[i++] = IIntact.setUser.selector;
        s[i++] = IIntact.userOf.selector;
        s[i++] = IIntact.userExpires.selector;
        s[i++] = IIntact.setGuardian.selector;
        s[i++] = IIntact.guardianOf.selector;
        s[i++] = IIntact.setStatus.selector;
        s[i++] = IIntact.pause.selector;
        s[i++] = IIntact.statusOf.selector;
        s[i++] = IIntact.proposeAgentWallet.selector;
        s[i++] = IIntact.acceptAgentWallet.selector;
        s[i++] = IIntact.agentWalletOf.selector;
        s[i++] = IIntact.setFeesToGrip.selector;
        s[i++] = IIntact.feeSink.selector;
        require(i == s.length, "rights count");
    }

    function mintSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](11);
        uint256 i;
        s[i++] = IIntact.mint.selector;
        s[i++] = IIntact.price.selector;
        s[i++] = IIntact.minted.selector;
        s[i++] = IIntact.account.selector;
        s[i++] = IIntact.grip.selector;
        s[i++] = IIntact.isCanonicalAccount.selector;
        s[i++] = IIntact.setPrice.selector;
        s[i++] = IIntact.setRoyalty.selector;
        s[i++] = IIntact.withdraw.selector;
        s[i++] = IIntact.sealPricing.selector;
        s[i++] = IIntact.pricingSealed.selector;
        require(i == s.length, "mint count");
    }

    function siteSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](15);
        uint256 i;
        s[i++] = IIntact.tokenURI.selector;
        s[i++] = IIntact.tokenURIAt.selector;
        s[i++] = IIntact.tokenURIs.selector;
        s[i++] = IIntact.pinTokenURI.selector;
        s[i++] = IIntact.unpinTokenURI.selector;
        s[i++] = IIntact.hasPinnedTokenURI.selector;
        s[i++] = IIntact.contractURI.selector;
        s[i++] = IIntact.scriptURI.selector;
        s[i++] = IIntact.setScriptURI.selector;
        s[i++] = IIntact.getTraitValue.selector;
        s[i++] = IIntact.getTraitValues.selector;
        s[i++] = IIntact.getTraitMetadataURI.selector;
        s[i++] = IIntact.setTrait.selector;
        s[i++] = IIntact.getStateFingerprint.selector;
        s[i++] = IIntact.coreOf.selector;
        require(i == s.length, "site count");
    }

    /// @dev Every selector of IIntact, in cut order: 93.
    function allSelectors() internal pure returns (bytes4[] memory all) {
        bytes4[][4] memory parts = [coreSelectors(), rightsSelectors(), mintSelectors(), siteSelectors()];
        uint256 n;
        for (uint256 p; p < 4; ++p) n += parts[p].length;
        all = new bytes4[](n);
        uint256 k;
        for (uint256 p; p < 4; ++p) for (uint256 j; j < parts[p].length; ++j) all[k++] = parts[p][j];
    }

    /*═══════════════════ conveniences ═══════════════════*/

    function mintTo(address who) internal returns (uint256 id) {
        vm.prank(who);
        id = hub.mint{value: PRICE}(who);
    }

    function reachOf(uint256 id) internal view returns (MockReachImpl) {
        return MockReachImpl(payable(hub.account(id)));
    }

    function bitsOf(uint256 id, address who) internal view returns (uint16 bits) {
        (bits, , ) = hub.rightsOf(id, who);
    }

    /// @dev The shim's assertEq has no bytes4 form, and bytes4 widens
    ///      implicitly to both bytes6 and bytes32 — ambiguous. Compare selectors as bytes32.
    function selOf(bytes memory ret) internal pure returns (bytes32) { return bytes32(bytes4(ret)); }
    function sel32(bytes4 s) internal pure returns (bytes32) { return bytes32(s); }

    /// @dev Probe `target` with `sel` and eight zero words: a real function
    ///      either returns or reverts WITH data; a selector nothing serves
    ///      reverts with none (a facet has no fallback) or, through the
    ///      diamond, with `FunctionNotFound`.
    function served(address target, bytes4 sel) internal returns (bool) {
        (bool ok, bytes memory ret) = target.call(abi.encodePacked(sel, new bytes(32 * 8)));
        if (ok) return true;
        if (ret.length < 4) return false;
        return bytes4(ret) != IIntactEvents.FunctionNotFound.selector;
    }
}

/*───────────────────────────────────────────────────────────────────────────
  The bundle: the real hub with every real wave-1 satellite (integration)

  Six units were built against frozen interfaces with their own stand-ins
  for one another. This fixture is where they first meet: the hub in the
  build INTACT_IMPL names, the real Reach and Grip implementations behind
  the canonical registry, Pool, Parley with Roster, Postage and KeyRegistry,
  Locks, Steward, Timelock, Kiln and Launchpad — every one pinned to the
  others by its immutables, through one IntactConfig, before any of them
  exists.

  The pinning is mutual: the hub's constructor takes the satellites, each
  satellite's constructor takes the hub, Pool and Kiln take the Launchpad
  and the Launchpad takes them back, Postage takes Parley and Parley takes
  Postage. On a live chain CREATE3 settles every address up front (DESIGN.md
  §12). Here the same thing is done with CREATE's own arithmetic from the
  TEST CONTRACT: its next nonce is discovered by deploying a probe and
  matching it against the formula (there is no nonce cheatcode), every
  later address is predicted from that, and every prediction is asserted
  after the fact — a wrong count reverts `Mispredicted`, never deploys a
  hub that pins a satellite it does not have. One deployer contract would
  have been simpler, and is impossible: its initcode would embed every
  creation code below, ~110 KB against EIP-3860's 49,152.

  The Renderer is still the hub-suite mock (the site is wave 2); MARKET and
  ROLES are unpinned (post-MVB), so `_isModule` admits only the Steward.
───────────────────────────────────────────────────────────────────────────*/
contract NonceProbe {}

abstract contract BundleFixture is IntactFixture {
    Reach theReach;                 // the implementation; every Reach is a forwarder to it
    Grip theGrip;
    KeyRegistry theKeys;
    Timelock theTimelock;
    Locks theLocks;
    Postage thePostage;
    Parley theParley;
    Roster theRoster;
    Steward theSteward;
    Pool thePool;
    Kiln theKiln;
    Launchpad theLaunchpad;
    MockPoolManager poolManager;
    address admin = address(0xAD314);

    error Mispredicted(string which, address predicted, address actual);
    error NonceNotFound();

    function setUpBundle() internal {
        vm.warp(T0);
        vm.roll(1000);
        vm.etch(REGISTRY, REGISTRY_RUNTIME);
        diamondBuild = keccak256(bytes(vm.envOr("INTACT_IMPL", "monolith"))) == keccak256("diamond");

        // nothing below needs a prediction
        theReach = new Reach();
        theGrip = new Grip();
        renderer = new MockRenderer();
        poolManager = new MockPoolManager();
        theKeys = new KeyRegistry();
        theTimelock = new Timelock(admin);

        // from here every creation is counted: the hub lands after eight
        // satellites (monolith) or after eight, four facets and the diamond
        uint256 n = _nextNonce();
        address parleyP = _predict(address(this), n + 2);
        address padP = _predict(address(this), n + 7);
        address hubP = _predict(address(this), n + 8 + (diamondBuild ? 4 : 0));

        theLocks = new Locks(hubP);                                                   // n
        thePostage = new Postage(hubP, parleyP);                                      // n + 1
        theParley = new Parley(hubP, address(theKeys), address(thePostage));          // n + 2
        theRoster = new Roster(address(theParley), hubP);                             // n + 3
        theSteward = new Steward(hubP);                                               // n + 4
        thePool = new Pool(hubP, padP);                                               // n + 5
        theKiln = new Kiln(hubP, padP, address(poolManager));                         // n + 6
        theLaunchpad = new Launchpad(hubP, address(theKiln), address(thePool), address(theLocks));   // n + 7
        IntactConfig memory c = bundleConfig();
        hub = diamondBuild ? deployDiamond(c, PRICE) : deployMonolith(c, PRICE);     // n + 8 (+ 4)

        if (address(theParley) != parleyP) revert Mispredicted("Parley", parleyP, address(theParley));
        if (address(theLaunchpad) != padP) revert Mispredicted("Launchpad", padP, address(theLaunchpad));
        if (address(hub) != hubP) revert Mispredicted("hub", hubP, address(hub));

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
    }

    function bundleConfig() internal view returns (IntactConfig memory c) {
        c = IntactConfig({
            reachImpl: address(theReach), gripImpl: address(theGrip),
            band: BAND, bandLo: LO, bandHi: HI,
            steward: address(theSteward), market: address(0), roles: address(0), pool: address(thePool),
            parley: address(theParley), launchpad: address(theLaunchpad), locks: address(theLocks),
            renderer: address(renderer), catalog: address(0), premises: address(0), timelock: address(theTimelock)
        });
    }

    /// @dev The test contract's next CREATE nonce: deploy a probe, find the
    ///      nonce whose predicted address it landed at, add one. The search
    ///      starts at zero: a runner that installs the suite's code directly
    ///      (this one does) leaves the account at nonce 0, where a contract
    ///      that was created would start at 1 (EIP-161).
    function _nextNonce() internal returns (uint256 n) {
        address probe = address(new NonceProbe());
        for (n = 0; n < 1 << 16; ++n) if (_predict(address(this), n) == probe) return n + 1;
        revert NonceNotFound();
    }

    /// @dev keccak256(rlp([deployer, nonce]))[12:], for every nonce under 2^24.
    function _predict(address d, uint256 nonce) internal pure returns (address) {
        bytes memory rlp;
        if (nonce == 0) rlp = abi.encodePacked(bytes1(0xd6), bytes1(0x94), d, bytes1(0x80));
        else if (nonce <= 0x7f) rlp = abi.encodePacked(bytes1(0xd6), bytes1(0x94), d, uint8(nonce));
        else if (nonce <= 0xff) rlp = abi.encodePacked(bytes1(0xd7), bytes1(0x94), d, bytes1(0x81), uint8(nonce));
        else if (nonce <= 0xffff) rlp = abi.encodePacked(bytes1(0xd8), bytes1(0x94), d, bytes1(0x82), uint16(nonce));
        else rlp = abi.encodePacked(bytes1(0xd9), bytes1(0x94), d, bytes1(0x83), uint24(nonce));
        return address(uint160(uint256(keccak256(rlp))));
    }

    /*═══════════════════ conveniences over the real hands ═══════════════════*/

    function reachAt(uint256 id) internal view returns (Reach) {
        return Reach(payable(hub.account(id)));
    }

    function gripAt(uint256 id) internal view returns (Grip) {
        return Grip(payable(hub.grip(id)));
    }
}
