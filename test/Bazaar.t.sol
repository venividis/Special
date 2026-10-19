// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Bazaar} from "../src/Bazaar.sol";
import {IBazaar, IBazaarEvents} from "../src/interfaces/IBazaar.sol";
import {Floor} from "../src/interfaces/IMarket.sol";
import {
    Order, OrderParameters, OrderComponents, OfferItem, ConsiderationItem, SpentItem, ReceivedItem,
    ZoneParameters, Schema, ItemType, OrderType, ISeaportZone
} from "../src/interfaces/ISeaport.sol";
import {Transient} from "../src/lib/Transient.sol";
import {
    BazaarHub, BazaarReach, BazaarPool, BazaarSeaport, BazaarToken, BazaarNFT, BazaarSeller
} from "./mocks/BazaarFixtures.sol";

/*───────────────────────────────────────────────────────────────────────────
  Bazaar — the publisher and the zone (V2, unit W3; docs/V2.md §3.3)

  The zone is run against test/mocks/BazaarFixtures.sol: a hub whose
  fingerprint hashes the terms the real one does, a Reach, a Pool, and
  Seaport 1.6's standard path, with and without a conduit. The sentences
  are the zone's refusals in the order `authorizeOrder` runs them, the
  re-reads `validateOrder` makes after the transfers and why it makes
  them (a seller paid in ether through a conduit is called while it still
  holds the token), and what `publish` refuses to index. Every refusal is
  asserted as its exact revert data through a raw call, since this
  runner's `expectRevert(bytes)` matches any revert.
───────────────────────────────────────────────────────────────────────────*/
contract BazaarTest is Test, IBazaarEvents {
    BazaarPool pool;
    BazaarHub hub;
    BazaarSeaport seaport;
    Bazaar bazaar;
    BazaarToken weth;
    BazaarToken usdc;
    BazaarNFT art;

    address seller = address(0x5E11E2);
    address buyer = address(0xB0B);
    address stranger = address(0x57A);
    address royalties = address(0x2071);
    address attacker = address(0xBAD);

    uint64 constant T0 = 1_800_000_000;
    uint64 constant END = T0 + 30 days;
    uint256 constant PRICE = 1 ether;
    uint16 constant BPS = 500;
    bytes32 constant NAME = keccak256("name");
    /// @dev Any non-zero key takes the mock's conduit path: tokens at the end, ether at once.
    bytes32 constant KEY = bytes32(uint256(0xC0D017));

    function setUp() public {
        vm.warp(T0);
        pool = new BazaarPool();
        hub = new BazaarHub(address(pool));
        seaport = new BazaarSeaport();
        bazaar = new Bazaar(address(seaport), address(hub), address(pool));
        weth = new BazaarToken();
        usdc = new BazaarToken();
        art = new BazaarNFT();
        hub.setRoyalty(royalties, BPS);
        vm.deal(buyer, 100 ether);
        vm.deal(seller, 1 ether);
        vm.deal(stranger, 10 ether);
    }

    /*═══════════════════ helpers ═══════════════════*/

    /// @dev A token held by `who`, its Reach sealed to `until`, Seaport approved.
    function _token(address who, uint64 until) internal returns (uint256 id, BazaarReach r) {
        id = hub.mint(who);
        r = BazaarReach(payable(hub.account(id)));
        vm.prank(who);
        r.seal(until);
        vm.prank(who);
        hub.setApprovalForAll(address(seaport), true);
    }

    /// @dev The same, for a holder that is a contract.
    function _contractToken(BazaarSeller s, uint64 until) internal returns (uint256 id, BazaarReach r) {
        id = hub.mint(address(s));
        r = BazaarReach(payable(hub.account(id)));
        s.run(address(r), 0, abi.encodeCall(BazaarReach.seal, (until)));
        s.run(address(hub), 0, abi.encodeCall(BazaarHub.setApprovalForAll, (address(seaport), true)));
    }

    function _none() internal pure returns (Floor[] memory f) {
        f = new Floor[](0);
    }

    function _one(address asset, uint256 min) internal pure returns (Floor[] memory f) {
        f = new Floor[](1);
        f[0] = Floor(asset, min);
    }

    function _pin(uint256 id, Floor[] memory floors) internal view returns (bytes32) {
        return bazaar.pinHash(id, hub.getStateFingerprint(id), floors);
    }

    function _royalty(uint256 price) internal pure returns (uint256) {
        return price * BPS / 10_000;
    }

    /// @dev A listing of `id` for PRICE in ether: the proceeds and the royalty.
    function _listing(uint256 id, address offerer, bytes32 zoneHash, uint64 end)
        internal view returns (OrderParameters memory p)
    {
        uint256 r = _royalty(PRICE);
        ConsiderationItem[] memory c = new ConsiderationItem[](2);
        c[0] = ConsiderationItem(ItemType.NATIVE, address(0), 0, PRICE - r, PRICE - r, payable(offerer));
        c[1] = ConsiderationItem(ItemType.NATIVE, address(0), 0, r, r, payable(royalties));
        p = _params(offerer, _nft(address(hub), id), c, zoneHash, end);
    }

    function _nft(address token, uint256 id) internal pure returns (OfferItem[] memory o) {
        o = new OfferItem[](1);
        o[0] = OfferItem(ItemType.ERC721, token, id, 1, 1);
    }

    function _params(address offerer, OfferItem[] memory offer, ConsiderationItem[] memory c, bytes32 zoneHash, uint64 end)
        internal view returns (OrderParameters memory p)
    {
        p = OrderParameters({
            offerer: offerer, zone: address(bazaar), offer: offer, consideration: c,
            orderType: OrderType.FULL_RESTRICTED, startTime: T0 - 1, endTime: end, zoneHash: zoneHash,
            salt: 1, conduitKey: bytes32(0), totalOriginalConsiderationItems: c.length
        });
    }

    function _hashOf(OrderParameters memory p) internal view returns (bytes32) {
        return seaport.getOrderHash(OrderComponents({
            offerer: p.offerer, zone: p.zone, offer: p.offer, consideration: p.consideration,
            orderType: p.orderType, startTime: p.startTime, endTime: p.endTime, zoneHash: p.zoneHash,
            salt: p.salt, conduitKey: p.conduitKey, counter: seaport.getCounter(p.offerer)
        }));
    }

    /// @dev The mock's "signature": that one was supplied (Seaport's own check is the verifier's).
    function _signed(OrderParameters memory p) internal view returns (Order memory o) {
        o.parameters = p;
        o.signature = abi.encode(_hashOf(p));
    }

    function _publish(Order memory o, Floor[] memory floors) internal returns (bool ok, bytes memory ret) {
        (ok, ret) = address(bazaar).call(abi.encodeCall(Bazaar.publish, (o, floors)));
    }

    function _fill(Order memory o, address by, uint256 value, bytes32 key) internal returns (bool ok, bytes memory ret) {
        bytes memory data = abi.encodeCall(BazaarSeaport.fulfillOrder, (o, key));
        vm.prank(by);
        (ok, ret) = address(seaport).call{value: value}(data);
    }

    function _selector(bytes memory ret) internal pure returns (bytes4 s) {
        if (ret.length >= 4) s = bytes4(ret);
    }

    function _arg(bytes memory ret, uint256 i) internal pure returns (bytes32 w) {
        assembly ("memory-safe") { w := mload(add(ret, add(36, mul(32, i)))) }
    }

    function _zp(bytes32 zoneHash) internal pure returns (ZoneParameters memory zp) {
        zp.zoneHash = zoneHash;
        zp.offer = new SpentItem[](0);
        zp.consideration = new ReceivedItem[](0);
        zp.orderHashes = new bytes32[](0);
    }

    /// @dev Publish a zoned ether listing of a fresh token sealed to `until`.
    function _published(uint64 until, uint64 end, Floor[] memory floors)
        internal returns (uint256 id, BazaarReach r, bytes32 zh, Order memory o)
    {
        (id, r) = _token(seller, until);
        zh = _pin(id, floors);
        o = _signed(_listing(id, seller, zh, end));
        (bool ok, bytes memory ret) = _publish(o, floors);
        require(ok, string(ret));
    }

    /*═══════════════════ construction and SIP-5 ═══════════════════*/

    function test_theConstructorRefusesAZeroPin() public {
        bytes memory zero = abi.encodeWithSelector(Bazaar.ZeroAddress.selector);
        try new Bazaar(address(0), address(hub), address(pool)) { assertTrue(false, "a zero Seaport was accepted"); }
        catch (bytes memory e) { assertEq(e, zero, "a zero Seaport is refused with ZeroAddress"); }
        try new Bazaar(address(seaport), address(0), address(pool)) { assertTrue(false, "a zero hub was accepted"); }
        catch (bytes memory e) { assertEq(e, zero, "a zero hub is refused with ZeroAddress"); }
        try new Bazaar(address(seaport), address(hub), address(0)) { assertTrue(false, "a zero Pool was accepted"); }
        catch (bytes memory e) { assertEq(e, zero, "a zero Pool is refused with ZeroAddress"); }
        assertEq(bazaar.SEAPORT(), address(seaport), "the Bazaar names its Seaport");
        assertEq(bazaar.HUB(), address(hub), "the Bazaar names its hub");
        assertEq(bazaar.POOL(), address(pool), "the Bazaar names its Pool");
        assertEq(bazaar.MAX_FLOORS(), 16, "an order pins at most sixteen floors");
    }

    function test_theBazaarAnswersSip5AndBothZoneInterfaceIds() public view {
        (string memory name, Schema[] memory schemas) = bazaar.getSeaportMetadata();
        assertEq(bytes(name), bytes("INTACT Bazaar"), "the zone names itself");
        assertEq(schemas.length, 0, "the zone claims no SIP beyond SIP-5");
        assertEq(bytes32(type(ISeaportZone).interfaceId), bytes32(bytes4(0x3822a094)), "the frozen ISeaportZone id is 0x3822a094");
        assertTrue(bazaar.supportsInterface(0x01ffc9a7), "the zone answers ERC-165");
        assertTrue(bazaar.supportsInterface(0x2e778efc), "the zone answers SIP-5's getSeaportMetadata id");
        assertTrue(bazaar.supportsInterface(type(ISeaportZone).interfaceId), "the zone answers ISeaportZone as frozen");
        assertTrue(bazaar.supportsInterface(0x39dd6933), "the zone answers Seaport 1.6's own ZoneInterface id");
        assertTrue(bazaar.supportsInterface(type(IBazaar).interfaceId), "the zone answers IBazaar");
        assertFalse(bazaar.supportsInterface(0xffffffff), "the zone answers no to 0xffffffff");
        assertFalse(bazaar.supportsInterface(0x80ac58cd), "the zone is not an ERC-721");
    }

    function test_aPinIsTheInterfaceFormula() public view {
        Floor[] memory floors = _one(address(weth), 3);
        bytes32 fp = keccak256("a fingerprint");
        assertEq(bazaar.pinHash(7, fp, floors), keccak256(abi.encode(address(bazaar), uint256(7), fp, floors)),
                 "pinHash is keccak256(abi.encode(bazaar, id, fingerprint, floors))");
    }

    /*═══════════════════ publishing ═══════════════════*/

    function test_aZonedListingIsPinnedValidatedAndIndexed() public {
        (uint256 id, , bytes32 zh, Order memory o) = _published(END, END, _one(address(weth), 0));
        (uint256 pid, bytes32 pfp, Floor[] memory pf) = bazaar.pinOf(zh);
        assertEq(pid, id, "the pin names the token");
        assertEq(pfp, hub.getStateFingerprint(id), "the pin holds the live fingerprint");
        assertEq(pf.length, 1, "the pin holds the floors it was published with");
        assertEq(pf[0].asset, address(weth), "the pin holds the floor's asset");
        (bool validated, bool cancelled, , ) = seaport.getOrderStatus(_hashOf(o.parameters));
        assertTrue(validated && !cancelled, "the published order stands validated on Seaport");
        assertEq(bytes32(bazaar.check(zh, END)), bytes32(0), "a fresh pin is still good");
    }

    function test_publishReturnsSeaportsOwnOrderHash() public {
        (uint256 id, ) = _token(seller, END);
        bytes32 zh = _pin(id, _none());
        Order memory o = _signed(_listing(id, seller, zh, END));
        assertEq(bazaar.publish(o, _none()), _hashOf(o.parameters), "publish returns Seaport's getOrderHash at the live counter");
    }

    function test_publishHashesTheOrderAtTheOfferersLiveCounter() public {
        (uint256 id, ) = _token(seller, END);
        bytes32 zh = _pin(id, _none());
        vm.prank(seller);
        seaport.incrementCounter();
        Order memory o = _signed(_listing(id, seller, zh, END));
        bytes32 h = _hashOf(o.parameters);
        (bool ok, bytes memory ret) = _publish(o, _none());
        assertTrue(ok, "an order signed after its offerer raised the counter is published");
        assertEq(abi.decode(ret, (bytes32)), h, "publish hashes the order at the offerer's live counter, not at zero");
        (bool validated, , , ) = seaport.getOrderStatus(h);
        assertTrue(validated, "and that is the hash Seaport validated");
    }

    function test_aPinThatIsNotTheLiveFingerprintIsRefused() public {
        (uint256 id, ) = _token(seller, END);
        bytes32 zh = _pin(id, _none());
        Order memory o = _signed(_listing(id, seller, zh, END));
        vm.prank(seller);
        hub.setTrait(id, NAME, bytes32("renamed"));
        bytes32 expected = _pin(id, _none());
        (bool ok, bytes memory ret) = _publish(o, _none());
        assertFalse(ok, "a stale pin is not published");
        assertEq(ret, abi.encodeWithSelector(BadPin.selector, expected, zh), "a stale pin is refused with BadPin(expected, zoneHash)");
    }

    function test_aPinOverOtherFloorsIsRefused() public {
        (uint256 id, ) = _token(seller, END);
        bytes32 zh = _pin(id, _one(address(weth), 5));
        Order memory o = _signed(_listing(id, seller, zh, END));
        bytes32 expected = _pin(id, _one(address(weth), 4));
        (bool ok, bytes memory ret) = _publish(o, _one(address(weth), 4));
        assertFalse(ok, "floors other than the pinned ones are not published");
        assertEq(ret, abi.encodeWithSelector(BadPin.selector, expected, zh), "floors other than the pinned ones are refused with BadPin");
    }

    function test_aZonedOrderThatIsNotFullRestrictedIsRefused() public {
        (uint256 id, ) = _token(seller, END);
        bytes32 zh = _pin(id, _none());
        OrderParameters memory p = _listing(id, seller, zh, END);
        p.orderType = OrderType.FULL_OPEN;
        (bool ok, bytes memory ret) = _publish(_signed(p), _none());
        assertFalse(ok, "an open order naming the zone is not published");
        assertEq(ret, abi.encodeWithSelector(NotRestricted.selector), "an open order naming the zone is refused with NotRestricted");
        p.orderType = OrderType.PARTIAL_RESTRICTED;
        (ok, ret) = _publish(_signed(p), _none());
        assertEq(ret, abi.encodeWithSelector(NotRestricted.selector), "a partially restricted order naming the zone is refused with NotRestricted");
    }

    function test_floorsWithoutTheZoneAreRefused() public {
        art.mint(seller, 9);
        OrderParameters memory p = _listing(0, seller, bytes32(0), END);
        p.offer = _nft(address(art), 9);
        p.zone = address(0);
        p.orderType = OrderType.FULL_OPEN;
        (bool ok, bytes memory ret) = _publish(_signed(p), _one(address(weth), 1));
        assertFalse(ok, "floors on an order the zone does not guard are not published");
        assertEq(ret, abi.encodeWithSelector(FloorsWithoutZone.selector), "floors without the zone are refused with FloorsWithoutZone");
    }

    function test_aZonedOrderMustTradeExactlyOnePlainIntactToken() public {
        (uint256 a, ) = _token(seller, END);
        (uint256 b, ) = _token(seller, END);
        bytes32 zh = _pin(a, _none());
        bytes memory notIntact = abi.encodeWithSelector(NotIntact.selector);

        OrderParameters memory p = _listing(a, seller, zh, END);
        art.mint(seller, 1);
        p.offer = _nft(address(art), 1);
        (bool ok, bytes memory ret) = _publish(_signed(p), _none());
        assertEq(ret, notIntact, "a zoned order with no INTACT token is refused with NotIntact");

        p = _listing(a, seller, zh, END);
        OfferItem[] memory two = new OfferItem[](2);
        two[0] = OfferItem(ItemType.ERC721, address(hub), a, 1, 1);
        two[1] = OfferItem(ItemType.ERC721, address(hub), b, 1, 1);
        p.offer = two;
        (ok, ret) = _publish(_signed(p), _none());
        assertEq(ret, notIntact, "a zoned order with two INTACT tokens is refused with NotIntact");

        p = _listing(a, seller, zh, END);
        p.offer[0].itemType = ItemType.ERC721_WITH_CRITERIA;
        (ok, ret) = _publish(_signed(p), _none());
        assertEq(ret, notIntact, "a zoned criteria order over INTACT tokens is refused with NotIntact");

        p = _listing(a, seller, zh, END);
        ConsiderationItem[] memory swap = new ConsiderationItem[](1);
        swap[0] = ConsiderationItem(ItemType.ERC721, address(hub), b, 1, 1, payable(seller));
        p.consideration = swap;
        p.totalOriginalConsiderationItems = 1;
        (ok, ret) = _publish(_signed(p), _none());
        assertFalse(ok, "a swap of two INTACT tokens is not published");
        assertEq(ret, notIntact, "an INTACT token on both sides is refused with NotIntact");

        OfferItem[] memory bid = new OfferItem[](1);
        bid[0] = OfferItem(ItemType.ERC20, address(weth), 0, 5, 5);
        ConsiderationItem[] memory any = new ConsiderationItem[](1);
        any[0] = ConsiderationItem(ItemType.ERC721_WITH_CRITERIA, address(hub), 0, 1, 1, payable(buyer));
        (ok, ret) = _publish(_signed(_params(buyer, bid, any, zh, END)), _none());
        assertEq(ret, notIntact, "a zoned bid for any INTACT token is refused with NotIntact");
    }

    function test_moreThanSixteenFloorsAreRefusedAndSixteenArePublished() public {
        (uint256 id, ) = _token(seller, END);
        Floor[] memory seventeen = new Floor[](17);
        for (uint256 i; i < 17; ++i) seventeen[i] = Floor(address(weth), i);
        bytes32 zh = _pin(id, seventeen);
        (bool ok, bytes memory ret) = _publish(_signed(_listing(id, seller, zh, END)), seventeen);
        assertFalse(ok, "seventeen floors are not published");
        assertEq(ret, abi.encodeWithSelector(TooManyFloors.selector), "seventeen floors are refused with TooManyFloors");

        Floor[] memory sixteen = new Floor[](16);
        for (uint256 i; i < 16; ++i) sixteen[i] = Floor(address(weth), i);
        zh = _pin(id, sixteen);
        (ok, ret) = _publish(_signed(_listing(id, seller, zh, END)), sixteen);
        assertTrue(ok, "sixteen floors are published");
        (, , Floor[] memory held) = bazaar.pinOf(zh);
        assertEq(held.length, 16, "the pin holds all sixteen floors");
    }

    function test_anOrderSeaportDidNotValidateIsRefused() public {
        (uint256 id, ) = _token(seller, END);
        bytes32 zh = _pin(id, _none());
        Order memory o = _signed(_listing(id, seller, zh, END));
        bytes32 h = _hashOf(o.parameters);
        seaport.setLazy(true);
        (bool ok, bytes memory ret) = _publish(o, _none());
        assertFalse(ok, "an order Seaport did not validate is not published");
        assertEq(ret, abi.encodeWithSelector(NotValidated.selector, h), "an order Seaport did not validate is refused with NotValidated");
        seaport.setLazy(false);
        seaport.forceCancelled(h);
        (ok, ret) = _publish(o, _none());
        assertEq(ret, abi.encodeWithSelector(NotValidated.selector, h), "an order Seaport reports cancelled is refused with NotValidated");
    }

    function test_anUnsignedOrderIsRefusedBySeaport() public {
        (uint256 id, ) = _token(seller, END);
        bytes32 zh = _pin(id, _none());
        Order memory o = _signed(_listing(id, seller, zh, END));
        o.signature = "";
        (bool ok, bytes memory ret) = _publish(o, _none());
        assertFalse(ok, "an order without its offerer's signature is not published by a stranger");
        assertTrue(_selector(ret) == BazaarSeaport.BazaarBadSignature.selector, "Seaport's own refusal is what comes back");
    }

    function test_anOrderWithNoNFTIsRefused() public {
        OfferItem[] memory offer = new OfferItem[](1);
        offer[0] = OfferItem(ItemType.ERC20, address(weth), 0, 5, 5);
        ConsiderationItem[] memory c = new ConsiderationItem[](1);
        c[0] = ConsiderationItem(ItemType.ERC20, address(usdc), 0, 9, 9, payable(seller));
        OrderParameters memory p = _params(seller, offer, c, bytes32(0), END);
        p.zone = address(0);
        p.orderType = OrderType.FULL_OPEN;
        (bool ok, bytes memory ret) = _publish(_signed(p), _none());
        assertFalse(ok, "a swap of two coins is not an NFT order");
        assertEq(ret, abi.encodeWithSelector(NoNFT.selector), "an order with no NFT is refused with NoNFT");
    }

    function test_anIntactOrderPricedInTwoCurrenciesOrInAnNFTIsNotPublished() public {
        (uint256 id, ) = _token(seller, END);
        bytes32 zh = _pin(id, _none());
        bytes memory unpriced = abi.encodeWithSelector(Bazaar.Unpriced.selector);

        OrderParameters memory p = _listing(id, seller, zh, END);
        p.consideration[1] = ConsiderationItem(ItemType.ERC20, address(weth), 0, 5, 5, payable(royalties));
        (bool ok, bytes memory ret) = _publish(_signed(p), _none());
        assertFalse(ok, "a listing in ether and an ERC-20 is not published");
        assertEq(ret, unpriced, "a listing in two currencies is refused with Unpriced");

        p = _listing(id, seller, zh, END);
        p.consideration[1] = ConsiderationItem(ItemType.ERC20, address(0), 0, 5, 5, payable(royalties));
        (ok, ret) = _publish(_signed(p), _none());
        assertEq(ret, unpriced, "an ERC-20 item is not the native currency even at the same address");

        p = _listing(id, seller, zh, END);
        ConsiderationItem[] memory weths = new ConsiderationItem[](2);
        weths[0] = ConsiderationItem(ItemType.ERC20, address(weth), 0, 5, 5, payable(seller));
        weths[1] = ConsiderationItem(ItemType.ERC20, address(usdc), 0, 5, 5, payable(royalties));
        p.consideration = weths;
        (ok, ret) = _publish(_signed(p), _none());
        assertEq(ret, unpriced, "a listing in two ERC-20s is refused with Unpriced");

        p = _listing(id, seller, zh, END);
        ConsiderationItem[] memory nftPrice = new ConsiderationItem[](1);
        art.mint(buyer, 4);
        nftPrice[0] = ConsiderationItem(ItemType.ERC721, address(art), 4, 1, 1, payable(seller));
        p.consideration = nftPrice;
        p.totalOriginalConsiderationItems = 1;
        (ok, ret) = _publish(_signed(p), _none());
        assertEq(ret, unpriced, "a listing priced in an NFT is refused with Unpriced");

        OfferItem[] memory bid = new OfferItem[](2);
        bid[0] = OfferItem(ItemType.ERC20, address(weth), 0, 5, 5);
        bid[1] = OfferItem(ItemType.ERC20, address(usdc), 0, 5, 5);
        ConsiderationItem[] memory ask = new ConsiderationItem[](1);
        ask[0] = ConsiderationItem(ItemType.ERC721, address(hub), id, 1, 1, payable(buyer));
        p = _params(buyer, bid, ask, zh, END);
        (ok, ret) = _publish(_signed(p), _none());
        assertEq(ret, unpriced, "a bid in two ERC-20s is refused with Unpriced");
    }

    function test_aPlainNftListingIsPublishedAndFilledWithoutAZone() public {
        art.mint(seller, 9);
        vm.prank(seller);
        art.setApprovalForAll(address(seaport), true);
        OrderParameters memory p = _listing(0, seller, bytes32(0), END);
        p.offer = _nft(address(art), 9);
        p.zone = address(0);
        p.orderType = OrderType.FULL_OPEN;
        Order memory o = _signed(p);
        (bool ok, bytes memory ret) = _publish(o, _none());
        assertTrue(ok, "a plain NFT listing with no zone is published");
        (uint256 pid, bytes32 pfp, ) = bazaar.pinOf(bytes32(0));
        assertTrue(pid == 0 && pfp == bytes32(0), "an unzoned order pins nothing");
        uint256 before = seller.balance;
        (ok, ret) = _fill(o, buyer, PRICE, bytes32(0));
        assertTrue(ok, "a plain NFT listing fills on Seaport");
        assertEq(art.ownerOf(9), buyer, "the plain NFT moved to the buyer");
        assertEq(seller.balance, before + PRICE - _royalty(PRICE), "the seller of a plain NFT is paid");
    }

    function test_publishCannotBeReenteredFromInsideSeaport() public {
        (uint256 a, ) = _token(seller, END);
        (uint256 b, ) = _token(seller, END);
        Order memory oa = _signed(_listing(a, seller, _pin(a, _none()), END));
        Order memory ob = _signed(_listing(b, seller, _pin(b, _none()), END));
        seaport.setReenter(address(bazaar), abi.encodeCall(Bazaar.publish, (ob, _none())));
        (bool ok, bytes memory ret) = _publish(oa, _none());
        assertFalse(ok, "a publish re-entered from inside Seaport does not land");
        assertEq(ret, abi.encodeWithSelector(Transient.Reentrancy.selector), "publish holds the Bazaar's lock across its call to Seaport");
    }

    function test_aPinIsStoredOnceAndASecondOrderUnderItIsPublished() public {
        (uint256 id, , bytes32 zh, ) = _published(END, END, _one(address(weth), 0));
        OrderParameters memory p = _listing(id, seller, zh, END);
        p.salt = 2;
        (bool ok, ) = _publish(_signed(p), _one(address(weth), 0));
        assertTrue(ok, "a second order under a live pin is published");
        (, , Floor[] memory held) = bazaar.pinOf(zh);
        assertEq(held.length, 1, "a pin is stored once: a second publish does not add its floors again");
    }

    /*═══════════════════ the zone: who may ask ═══════════════════*/

    function test_onlySeaportMayAskTheZoneBeforeTheTransfers() public {
        (, , bytes32 zh, ) = _published(END, END, _none());
        bytes memory data = abi.encodeCall(Bazaar.authorizeOrder, (_zp(zh)));
        vm.prank(stranger);
        (bool ok, bytes memory ret) = address(bazaar).call(data);
        assertFalse(ok, "a stranger cannot ask authorizeOrder");
        assertEq(ret, abi.encodeWithSelector(NotSeaport.selector), "authorizeOrder refuses everyone but Seaport with NotSeaport");
    }

    function test_onlySeaportMayAskTheZoneAfterTheTransfers() public {
        (, , bytes32 zh, ) = _published(END, END, _none());
        bytes memory data = abi.encodeCall(Bazaar.validateOrder, (_zp(zh)));
        vm.prank(stranger);
        (bool ok, bytes memory ret) = address(bazaar).call(data);
        assertFalse(ok, "a stranger cannot ask validateOrder");
        assertEq(ret, abi.encodeWithSelector(NotSeaport.selector), "validateOrder refuses everyone but Seaport with NotSeaport");
        vm.prank(address(seaport));
        (ok, ret) = address(bazaar).call(data);
        assertTrue(ok, "Seaport asking validateOrder of a standing pin is admitted");
        assertTrue(abi.decode(ret, (bytes4)) == ISeaportZone.validateOrder.selector, "validateOrder admits with its own selector");
    }

    function test_validateOrderRefusesAZoneHashThatPinsNothing() public {
        bytes32 nothing = keccak256("nothing");
        bytes memory data = abi.encodeCall(Bazaar.validateOrder, (_zp(nothing)));
        vm.prank(address(seaport));
        (bool ok, bytes memory ret) = address(bazaar).call(data);
        assertFalse(ok, "validateOrder admits no unpinned zone hash");
        assertEq(ret, abi.encodeWithSelector(NotPinned.selector, nothing), "validateOrder refuses an unpinned zone hash with NotPinned");
    }

    /*═══════════════════ the zone: fills that land ═══════════════════*/

    function test_aZonedListingFillsAndPaysTheSellerAndTheRoyalty() public {
        (uint256 id, BazaarReach r, , Order memory o) = _published(END, END, _one(address(weth), 2 ether));
        weth.mint(address(r), 2 ether);
        uint256 s0 = seller.balance;
        uint256 r0 = royalties.balance;
        (bool ok, ) = _fill(o, buyer, PRICE, bytes32(0));
        assertTrue(ok, "a zoned listing fills on Seaport");
        assertEq(hub.ownerOf(id), buyer, "the INTACT token moved to the buyer");
        assertEq(seller.balance, s0 + PRICE - _royalty(PRICE), "the seller is paid the price less the royalty");
        assertEq(royalties.balance, r0 + _royalty(PRICE), "the royalty receiver is paid the royalty");
    }

    function test_aZonedListingFillsThroughAConduitWhenNobodyActsInsideTheFill() public {
        (uint256 id, BazaarReach r) = _token(seller, END);
        weth.mint(address(r), 2 ether);
        Floor[] memory floors = _one(address(weth), 2 ether);
        bytes32 zh = _pin(id, floors);
        OrderParameters memory p = _listing(id, seller, zh, END);
        p.conduitKey = KEY;
        Order memory o = _signed(p);
        bazaar.publish(o, floors);
        (bool ok, ) = _fill(o, buyer, PRICE, KEY);
        assertTrue(ok, "a zoned listing fills through a conduit when nothing moves inside the fill");
        assertEq(hub.ownerOf(id), buyer, "the token moved at the end of the conduit fill");
    }

    function test_aBidPaysTheRoyaltyFromWhatTheSellerReceivesAndFills() public {
        (uint256 id, ) = _token(seller, END);
        weth.mint(buyer, PRICE);
        vm.prank(buyer);
        weth.approve(address(seaport), type(uint256).max);
        vm.prank(seller);
        weth.approve(address(seaport), type(uint256).max);
        bytes32 zh = _pin(id, _none());
        OfferItem[] memory offer = new OfferItem[](1);
        offer[0] = OfferItem(ItemType.ERC20, address(weth), 0, PRICE, PRICE);
        ConsiderationItem[] memory c = new ConsiderationItem[](2);
        c[0] = ConsiderationItem(ItemType.ERC721, address(hub), id, 1, 1, payable(buyer));
        c[1] = ConsiderationItem(ItemType.ERC20, address(weth), 0, _royalty(PRICE), _royalty(PRICE), payable(royalties));
        Order memory o = _signed(_params(buyer, offer, c, zh, END));
        bazaar.publish(o, _none());
        (bool ok, bytes memory ret) = _fill(o, seller, 0, bytes32(0));
        assertTrue(ok, string(ret));
        assertEq(hub.ownerOf(id), buyer, "an accepted bid moves the token to the bidder");
        assertEq(weth.balanceOf(seller), PRICE - _royalty(PRICE), "the holder who accepts a bid keeps the price less the royalty");
        assertEq(weth.balanceOf(royalties), _royalty(PRICE), "a bid pays the royalty in the bid's currency");
    }

    function test_noRoyaltyIsOwedWhenTheReceiverIsZeroOrTheRateIsZero() public {
        (uint256 id, ) = _token(seller, END);
        bytes32 zh = _pin(id, _none());
        ConsiderationItem[] memory c = new ConsiderationItem[](1);
        c[0] = ConsiderationItem(ItemType.NATIVE, address(0), 0, PRICE, PRICE, payable(seller));
        Order memory o = _signed(_params(seller, _nft(address(hub), id), c, zh, END));
        bazaar.publish(o, _none());
        hub.setRoyalty(address(0), BPS);
        (bool ok, ) = _fill(o, buyer, PRICE, bytes32(0));
        assertTrue(ok, "with no royalty receiver an order without a royalty item fills");

        (uint256 id2, ) = _token(seller, END);
        bytes32 zh2 = _pin(id2, _none());
        Order memory o2 = _signed(_params(seller, _nft(address(hub), id2), c, zh2, END));
        bazaar.publish(o2, _none());
        hub.setRoyalty(royalties, 0);
        (ok, ) = _fill(o2, buyer, PRICE, bytes32(0));
        assertTrue(ok, "with a zero royalty rate an order without a royalty item fills");
    }

    function test_anIntactTokenGivenAwayOwesNoRoyaltyAndFills() public {
        (uint256 id, ) = _token(seller, END);
        bytes32 zh = _pin(id, _none());
        Order memory o = _signed(_params(seller, _nft(address(hub), id), new ConsiderationItem[](0), zh, END));
        bazaar.publish(o, _none());
        (bool ok, ) = _fill(o, buyer, 0, bytes32(0));
        assertTrue(ok, "an INTACT token offered for nothing owes no royalty and fills");
        assertEq(hub.ownerOf(id), buyer, "the gift moved");
    }

    /*═══════════════════ the zone: refusals before the transfers ═══════════════════*/

    function test_aZoneHashThatPinsNothingIsRefusedAtTheFill() public {
        (uint256 id, ) = _token(seller, END);
        bytes32 nothing = keccak256("nothing");
        Order memory o = _signed(_listing(id, seller, nothing, END));
        (bool ok, bytes memory ret) = _fill(o, buyer, PRICE, bytes32(0));
        assertFalse(ok, "an order naming the zone under no pin does not fill");
        assertEq(ret, abi.encodeWithSelector(NotPinned.selector, nothing), "an unpinned zone hash is refused at the fill with NotPinned");
        assertEq(hub.ownerOf(id), seller, "nothing moved");
    }

    function test_anOrderForAnotherTokenUnderAPinIsRefused() public {
        (uint256 a, , bytes32 zh, ) = _published(END, END, _none());
        (uint256 b, ) = _token(seller, END);
        Order memory o = _signed(_listing(b, seller, zh, END));
        (bool ok, bytes memory ret) = _fill(o, buyer, PRICE, bytes32(0));
        assertFalse(ok, "a pin does not cover another token");
        assertEq(ret, abi.encodeWithSelector(WrongToken.selector, a, b), "another token under a pin is refused with WrongToken(pinned, id)");
        assertEq(hub.ownerOf(b), seller, "nothing moved");
    }

    function test_twoIntactTokensUnderOnePinAreRefusedAtTheFill() public {
        (uint256 a, , bytes32 zh, ) = _published(END, END, _none());
        (uint256 b, ) = _token(seller, END);
        OrderParameters memory p = _listing(a, seller, zh, END);
        OfferItem[] memory two = new OfferItem[](2);
        two[0] = OfferItem(ItemType.ERC721, address(hub), a, 1, 1);
        two[1] = OfferItem(ItemType.ERC721, address(hub), b, 1, 1);
        p.offer = two;
        (bool ok, bytes memory ret) = _fill(_signed(p), buyer, PRICE, bytes32(0));
        assertFalse(ok, "a second INTACT token cannot ride under a pin");
        assertEq(ret, abi.encodeWithSelector(NotIntact.selector), "two INTACT tokens under one pin are refused at the fill with NotIntact");
    }

    function test_anOrderUnderAPinThatTradesNoIntactTokenIsRefusedAtTheFill() public {
        (, , bytes32 zh, ) = _published(END, END, _none());
        art.mint(seller, 5);
        vm.prank(seller);
        art.setApprovalForAll(address(seaport), true);
        OrderParameters memory p = _listing(0, seller, zh, END);
        p.offer = _nft(address(art), 5);
        (bool ok, bytes memory ret) = _fill(_signed(p), buyer, PRICE, bytes32(0));
        assertFalse(ok, "a pin does not guard an order with no INTACT token in it");
        assertEq(ret, abi.encodeWithSelector(NotIntact.selector), "an order under a pin with no INTACT token is refused at the fill with NotIntact");
        assertEq(art.ownerOf(5), seller, "nothing moved");
    }

    function test_aCriteriaItemOverIntactTokensUnderAPinIsRefusedAtTheFill() public {
        (uint256 id, , bytes32 zh, ) = _published(END, END, _none());
        bytes memory notIntact = abi.encodeWithSelector(NotIntact.selector);
        OrderParameters memory p = _listing(id, seller, zh, END);
        p.offer[0].itemType = ItemType.ERC721_WITH_CRITERIA;
        (bool ok, bytes memory ret) = _fill(_signed(p), buyer, PRICE, bytes32(0));
        assertFalse(ok, "an offer of any INTACT token does not fill under a pin");
        assertEq(ret, notIntact, "an unresolved criteria item offered under a pin is refused at the fill with NotIntact");

        OfferItem[] memory bid = new OfferItem[](1);
        bid[0] = OfferItem(ItemType.ERC20, address(weth), 0, PRICE, PRICE);
        ConsiderationItem[] memory any = new ConsiderationItem[](1);
        any[0] = ConsiderationItem(ItemType.ERC721_WITH_CRITERIA, address(hub), id, 1, 1, payable(buyer));
        (ok, ret) = _fill(_signed(_params(buyer, bid, any, zh, END)), seller, 0, bytes32(0));
        assertEq(ret, notIntact, "an unresolved criteria item asked for under a pin is refused at the fill with NotIntact");
    }

    function test_aMovedFingerprintRefusesTheFillAndNothingMoves() public {
        (uint256 id, , bytes32 zh, Order memory o) = _published(END, END, _none());
        bytes32 pinned = hub.getStateFingerprint(id);
        vm.prank(seller);
        hub.setTrait(id, NAME, bytes32("renamed"));
        bytes32 live = hub.getStateFingerprint(id);
        uint256 b0 = buyer.balance;
        (bool ok, bytes memory ret) = _fill(o, buyer, PRICE, bytes32(0));
        assertFalse(ok, "a listing whose trait was written after publishing does not fill");
        assertEq(ret, abi.encodeWithSelector(FingerprintMoved.selector, pinned, live), "a moved fingerprint is refused with FingerprintMoved(pinned, live)");
        assertEq(hub.ownerOf(id), seller, "the token did not move");
        assertEq(buyer.balance, b0, "the buyer paid nothing");
        assertEq(bytes32(bazaar.check(zh, END)), bytes32(FingerprintMoved.selector), "check names FingerprintMoved");
    }

    function test_everyTermTheFingerprintHashesRefusesTheFillWhenItMoves() public {
        bytes4 moved = FingerprintMoved.selector;
        (uint256 a, , , Order memory oa) = _published(END, END, _none());
        vm.prank(seller);
        hub.setUser(a, stranger);
        (, bytes memory ret) = _fill(oa, buyer, PRICE, bytes32(0));
        assertTrue(_selector(ret) == moved, "a renter set after publishing refuses the fill");

        (uint256 b, BazaarReach rb, , Order memory ob) = _published(END, END, _none());
        vm.prank(seller);
        rb.execute(address(weth), 0, abi.encodeCall(BazaarToken.approve, (attacker, 1)));
        (, ret) = _fill(ob, buyer, PRICE, bytes32(0));
        assertTrue(_selector(ret) == moved, "a Reach that acted after publishing refuses the fill");

        (uint256 c, BazaarReach rc, , Order memory oc) = _published(END, END, _none());
        vm.prank(seller);
        rc.seal(END + 1 days);
        (, ret) = _fill(oc, buyer, PRICE, bytes32(0));
        assertTrue(_selector(ret) == moved, "a seal lengthened after publishing refuses the fill");

        (uint256 d, ) = _token(seller, END);
        pool.open(d);
        pool.sealMarket(d, END);
        Order memory od = _signed(_listing(d, seller, _pin(d, _none()), END));
        bazaar.publish(od, _none());
        vm.prank(stranger);
        pool.trade(d);
        (, ret) = _fill(od, buyer, PRICE, bytes32(0));
        assertTrue(_selector(ret) == moved, "a trade on the owned market after publishing refuses the fill");
        assertTrue(hub.ownerOf(a) == seller && hub.ownerOf(b) == seller && hub.ownerOf(c) == seller && hub.ownerOf(d) == seller,
                   "no token moved");
    }

    function test_aReachSealShorterThanTheOrderRefusesTheFill() public {
        (uint256 id, , bytes32 zh, Order memory o) = _published(END - 1, END, _none());
        (bool ok, bytes memory ret) = _fill(o, buyer, PRICE, bytes32(0));
        assertFalse(ok, "a Reach sealed one second short of the order's end does not fill");
        assertEq(ret, abi.encodeWithSelector(ReachSealShort.selector, uint64(END - 1), uint256(END)),
                 "a short Reach seal is refused with ReachSealShort(sealedUntil, endTime)");
        assertEq(hub.ownerOf(id), seller, "nothing moved");
        assertEq(bytes32(bazaar.check(zh, END)), bytes32(ReachSealShort.selector), "check names ReachSealShort");

        (uint256 id2, , , Order memory o2) = _published(END, END, _none());
        (ok, ) = _fill(o2, buyer, PRICE, bytes32(0));
        assertTrue(ok, "a Reach sealed exactly until the order's end fills");
        assertEq(hub.ownerOf(id2), buyer, "the exactly sealed token moved");
    }

    function test_anOpenMarketSealShorterThanTheOrderRefusesTheFill() public {
        (uint256 id, ) = _token(seller, END);
        pool.open(id);
        pool.sealMarket(id, END - 1);
        bytes32 zh = _pin(id, _none());
        Order memory o = _signed(_listing(id, seller, zh, END));
        bazaar.publish(o, _none());
        (bool ok, bytes memory ret) = _fill(o, buyer, PRICE, bytes32(0));
        assertFalse(ok, "an owned market sealed one second short does not fill");
        assertEq(ret, abi.encodeWithSelector(MarketSealShort.selector, uint64(END - 1), uint256(END)),
                 "a short market seal is refused with MarketSealShort(sealUntil, endTime)");
        assertEq(bytes32(bazaar.check(zh, END)), bytes32(MarketSealShort.selector), "check names MarketSealShort");

        (uint256 id2, ) = _token(seller, END);
        pool.open(id2);
        pool.sealMarket(id2, END);
        Order memory o2 = _signed(_listing(id2, seller, _pin(id2, _none()), END));
        bazaar.publish(o2, _none());
        (ok, ) = _fill(o2, buyer, PRICE, bytes32(0));
        assertTrue(ok, "an owned market sealed exactly until the order's end fills");

        (uint256 id3, ) = _token(seller, END);
        Order memory o3 = _signed(_listing(id3, seller, _pin(id3, _none()), END));
        bazaar.publish(o3, _none());
        (ok, ) = _fill(o3, buyer, PRICE, bytes32(0));
        assertTrue(ok, "a token with no open market needs no market seal");
    }

    function test_aBrokenFloorRefusesTheFill() public {
        (uint256 id, BazaarReach r) = _token(seller, END);
        weth.mint(address(r), 5 ether - 1);
        Floor[] memory floors = _one(address(weth), 5 ether);
        bytes32 zh = _pin(id, floors);
        Order memory o = _signed(_listing(id, seller, zh, END));
        bazaar.publish(o, floors);
        (bool ok, bytes memory ret) = _fill(o, buyer, PRICE, bytes32(0));
        assertFalse(ok, "a Reach one wei short of a floor does not fill");
        assertEq(ret, abi.encodeWithSelector(FloorBroken.selector, address(weth), 5 ether - 1, 5 ether),
                 "a broken floor is refused with FloorBroken(asset, balance, min)");
        assertEq(bytes32(bazaar.check(zh, END)), bytes32(FloorBroken.selector), "check names FloorBroken");
        weth.mint(address(r), 1);
        (ok, ) = _fill(o, buyer, PRICE, bytes32(0));
        assertTrue(ok, "an inbound transfer heals a floor without moving the fingerprint, and a floor met exactly fills");
    }

    function test_anEtherFloorIsTheReachsOwnBalance() public {
        (uint256 id, BazaarReach r) = _token(seller, END);
        vm.deal(address(r), 3 ether);
        Floor[] memory floors = _one(address(0), 3 ether + 1);
        bytes32 zh = _pin(id, floors);
        Order memory o = _signed(_listing(id, seller, zh, END));
        bazaar.publish(o, floors);
        (bool ok, bytes memory ret) = _fill(o, buyer, PRICE, bytes32(0));
        assertFalse(ok, "a Reach short of an ether floor does not fill");
        assertEq(ret, abi.encodeWithSelector(FloorBroken.selector, address(0), 3 ether, 3 ether + 1),
                 "an ether floor reads the Reach's own balance");
    }

    function test_aFloorOnAnAssetThatDoesNotAnswerReadsAsZero() public {
        (uint256 id, BazaarReach r) = _token(seller, END);
        weth.mint(address(r), 9 ether);
        weth.setMute(true);
        Floor[] memory floors = _one(address(weth), 1);
        Order memory o = _signed(_listing(id, seller, _pin(id, floors), END));
        bazaar.publish(o, floors);
        (, bytes memory ret) = _fill(o, buyer, PRICE, bytes32(0));
        assertEq(ret, abi.encodeWithSelector(FloorBroken.selector, address(weth), 0, 1),
                 "an asset whose balanceOf reverts reads as zero and fails its floor");

        (uint256 id2, ) = _token(seller, END);
        address nothing = address(0xC0DE1E55);
        Floor[] memory floors2 = _one(nothing, 1);
        Order memory o2 = _signed(_listing(id2, seller, _pin(id2, floors2), END));
        bazaar.publish(o2, floors2);
        (, ret) = _fill(o2, buyer, PRICE, bytes32(0));
        assertEq(ret, abi.encodeWithSelector(FloorBroken.selector, nothing, 0, 1),
                 "an asset with no code reads as zero and fails its floor");
    }

    function test_aFloorOnAnAddressWithNoCodeIsNoAnswerEvenWhenItAnswers() public {
        // the SHA-256 precompile has no code, and answers any call with 32 bytes
        (uint256 id, ) = _token(seller, END);
        address precompile = address(2);
        assertEq(precompile.code.length, 0, "a precompile has no code");
        (bool answers, bytes memory word) = precompile.staticcall(abi.encodeWithSignature("balanceOf(address)", address(1)));
        assertTrue(answers && word.length == 32, "and still answers balanceOf with one word");
        Floor[] memory floors = _one(precompile, 1);
        Order memory o = _signed(_listing(id, seller, _pin(id, floors), END));
        bazaar.publish(o, floors);
        (bool ok, bytes memory ret) = _fill(o, buyer, PRICE, bytes32(0));
        assertFalse(ok, "a floor on a precompile is not met by its hash");
        assertEq(ret, abi.encodeWithSelector(FloorBroken.selector, precompile, 0, 1),
                 "an asset with no code reads as zero even when the address answers");
    }

    function test_aReachThatDoesNotAnswerIsNotSealed() public {
        (uint256 id, BazaarReach r) = _token(seller, END);
        r.setMute(true);
        Order memory o = _signed(_listing(id, seller, _pin(id, _none()), END));
        bazaar.publish(o, _none());
        (, bytes memory ret) = _fill(o, buyer, PRICE, bytes32(0));
        assertEq(ret, abi.encodeWithSelector(ReachSealShort.selector, uint64(0), uint256(END)),
                 "a Reach whose sealedUntil reverts reads as unsealed");

        (uint256 id2, BazaarReach r2) = _token(seller, END);
        r2.setDirty(true);
        Order memory o2 = _signed(_listing(id2, seller, _pin(id2, _none()), END));
        bazaar.publish(o2, _none());
        (, ret) = _fill(o2, buyer, PRICE, bytes32(0));
        assertEq(ret, abi.encodeWithSelector(ReachSealShort.selector, uint64(0), uint256(END)),
                 "a seal word wider than uint64 is refused, never truncated");

        (uint256 id3, BazaarReach r3) = _token(seller, END);
        vm.prank(seller);
        r3.seal(type(uint64).max);
        Order memory o3 = _signed(_listing(id3, seller, _pin(id3, _none()), END));
        bazaar.publish(o3, _none());
        (bool ok, ) = _fill(o3, buyer, PRICE, bytes32(0));
        assertTrue(ok, "a Reach sealed to the last uint64 second is sealed");
    }

    function test_aPoolThatDoesNotAnswerIsNoSeal() public {
        (uint256 id, ) = _token(seller, END);
        pool.setMute(true);
        Order memory o = _signed(_listing(id, seller, _pin(id, _none()), END));
        bazaar.publish(o, _none());
        (, bytes memory ret) = _fill(o, buyer, PRICE, bytes32(0));
        assertEq(ret, abi.encodeWithSelector(MarketSealShort.selector, uint64(0), uint256(END)),
                 "a Pool whose marketOf reverts reads as an open market with no seal");
    }

    function test_anOrderShortOfTheRoyaltyIsRefused() public {
        uint256 owed = _royalty(PRICE);
        (uint256 id, ) = _token(seller, END);
        bytes32 zh = _pin(id, _none());
        OrderParameters memory p = _listing(id, seller, zh, END);
        p.consideration[0].startAmount = PRICE - owed + 1;
        p.consideration[0].endAmount = PRICE - owed + 1;
        p.consideration[1].startAmount = owed - 1;
        p.consideration[1].endAmount = owed - 1;
        Order memory o = _signed(p);
        bazaar.publish(o, _none());
        (bool ok, bytes memory ret) = _fill(o, buyer, PRICE, bytes32(0));
        assertFalse(ok, "a listing paying one wei less than the royalty does not fill");
        assertEq(ret, abi.encodeWithSelector(RoyaltyShort.selector, royalties, owed - 1, owed),
                 "a short royalty is refused with RoyaltyShort(receiver, paid, owed)");

        ConsiderationItem[] memory c = new ConsiderationItem[](1);
        c[0] = ConsiderationItem(ItemType.NATIVE, address(0), 0, PRICE, PRICE, payable(seller));
        p = _params(seller, _nft(address(hub), id), c, zh, END);
        p.salt = 9;
        o = _signed(p);
        (ok, ret) = _fill(o, buyer, PRICE, bytes32(0));
        assertEq(ret, abi.encodeWithSelector(RoyaltyShort.selector, royalties, 0, owed),
                 "an order with no royalty item is refused with RoyaltyShort");

        p = _listing(id, seller, zh, END);
        p.consideration[1].recipient = payable(stranger);
        p.salt = 10;
        (ok, ret) = _fill(_signed(p), buyer, PRICE, bytes32(0));
        assertEq(ret, abi.encodeWithSelector(RoyaltyShort.selector, royalties, 0, owed),
                 "a royalty paid to anyone but the receiver does not count");
        assertEq(hub.ownerOf(id), seller, "nothing moved");
    }

    function test_aRoyaltyPaidInAnotherCurrencyDoesNotCount() public {
        (uint256 id, ) = _token(seller, END);
        weth.mint(buyer, PRICE);
        vm.prank(buyer);
        weth.approve(address(seaport), type(uint256).max);
        bytes32 zh = _pin(id, _none());
        OfferItem[] memory offer = new OfferItem[](1);
        offer[0] = OfferItem(ItemType.ERC20, address(weth), 0, PRICE, PRICE);
        ConsiderationItem[] memory c = new ConsiderationItem[](2);
        c[0] = ConsiderationItem(ItemType.ERC721, address(hub), id, 1, 1, payable(buyer));
        c[1] = ConsiderationItem(ItemType.NATIVE, address(0), 0, _royalty(PRICE), _royalty(PRICE), payable(royalties));
        Order memory o = _signed(_params(buyer, offer, c, zh, END));
        bazaar.publish(o, _none());
        (bool ok, bytes memory ret) = _fill(o, seller, _royalty(PRICE), bytes32(0));
        assertFalse(ok, "a bid in WETH whose royalty is paid in ether does not fill");
        assertEq(ret, abi.encodeWithSelector(RoyaltyShort.selector, royalties, 0, _royalty(PRICE)),
                 "a royalty in another currency than the price's is refused with RoyaltyShort");
    }

    function test_aRoyaltyPaidInAnotherErc20DoesNotCount() public {
        (uint256 id, ) = _token(seller, END);
        weth.mint(buyer, PRICE);
        vm.prank(buyer);
        weth.approve(address(seaport), type(uint256).max);
        bytes32 zh = _pin(id, _none());
        OfferItem[] memory offer = new OfferItem[](1);
        offer[0] = OfferItem(ItemType.ERC20, address(weth), 0, PRICE, PRICE);
        ConsiderationItem[] memory c = new ConsiderationItem[](2);
        c[0] = ConsiderationItem(ItemType.ERC721, address(hub), id, 1, 1, payable(buyer));
        c[1] = ConsiderationItem(ItemType.ERC20, address(usdc), 0, _royalty(PRICE), _royalty(PRICE), payable(royalties));
        Order memory o = _signed(_params(buyer, offer, c, zh, END));
        bazaar.publish(o, _none());
        (bool ok, bytes memory ret) = _fill(o, seller, 0, bytes32(0));
        assertFalse(ok, "a bid in WETH whose royalty is paid in another ERC-20 does not fill");
        assertEq(ret, abi.encodeWithSelector(RoyaltyShort.selector, royalties, 0, _royalty(PRICE)),
                 "a royalty in another ERC-20 than the price's is refused with RoyaltyShort");
    }

    function test_anUnpricedOrderUnderAPinIsRefusedAtTheFill() public {
        (uint256 id, , bytes32 zh, ) = _published(END, END, _none());
        OrderParameters memory p = _listing(id, seller, zh, END);
        p.consideration[1] = ConsiderationItem(ItemType.ERC20, address(weth), 0, 5, 5, payable(royalties));
        p.salt = 3;
        (bool ok, bytes memory ret) = _fill(_signed(p), buyer, PRICE, bytes32(0));
        assertFalse(ok, "an order priced in two currencies under a pin does not fill");
        assertEq(ret, abi.encodeWithSelector(Bazaar.Unpriced.selector), "two currencies on the priced side are refused at the fill with Unpriced");
    }

    function test_aSecondOrderUnderAPinIsHeldToTheSameState() public {
        (uint256 id, , bytes32 zh, ) = _published(END, END, _none());
        OrderParameters memory late = _listing(id, seller, zh, END + 1 days);
        late.salt = 4;
        (bool ok, bytes memory ret) = _fill(_signed(late), buyer, PRICE, bytes32(0));
        assertFalse(ok, "an unpublished order under a pin that outlives the seal does not fill");
        assertEq(ret, abi.encodeWithSelector(ReachSealShort.selector, uint64(END), uint256(END + 1 days)),
                 "an order under a pin is held to its own end time");
        OrderParameters memory cheaper = _listing(id, seller, zh, END);
        cheaper.salt = 5;
        (ok, ) = _fill(_signed(cheaper), buyer, PRICE, bytes32(0));
        assertTrue(ok, "an unpublished order under a live pin, within the seal, fills");
        assertEq(hub.ownerOf(id), buyer, "the second order under the pin moved the token");
    }

    /*═══════════════════ the zone: after the transfers ═══════════════════*/

    /// @dev A contract seller, its Reach holding 10 WETH under a floor, listed for
    ///      ether through a conduit: Seaport pays it before the token moves.
    function _windowed() internal returns (BazaarSeller s, uint256 id, BazaarReach r, Order memory o, bytes32 pinned) {
        s = new BazaarSeller();
        (id, r) = _contractToken(s, END);
        weth.mint(address(r), 10 ether);
        // an approval made BEFORE the pin is in the fingerprint the buyer pinned
        s.run(address(r), 0, abi.encodeCall(BazaarReach.execute,
            (address(weth), 0, abi.encodeCall(BazaarToken.approve, (address(s), type(uint256).max)))));
        pool.open(id);
        pool.sealMarket(id, END);
        Floor[] memory floors = _one(address(weth), 10 ether);
        pinned = hub.getStateFingerprint(id);
        OrderParameters memory p = _listing(id, address(s), _pin(id, floors), END);
        p.conduitKey = KEY;
        o = _signed(p);
        bazaar.publish(o, floors);
    }

    function test_aSellerWhoActsOnTheReachInsideTheFillIsRefusedAfterTheTransfers() public {
        (BazaarSeller s, uint256 id, BazaarReach r, Order memory o, bytes32 pinned) = _windowed();
        s.arm(address(r), abi.encodeCall(BazaarReach.execute,
            (address(weth), 0, abi.encodeCall(BazaarToken.approve, (attacker, type(uint256).max)))));
        (bool ok, bytes memory ret) = _fill(o, buyer, PRICE, KEY);
        assertFalse(ok, "a seller who grants an approval from its own receive() does not sell");
        assertTrue(_selector(ret) == FingerprintMoved.selector, "a Reach that acted inside the fill is refused with FingerprintMoved");
        assertEq(_arg(ret, 0), pinned, "the refusal names the pinned fingerprint");
        assertTrue(_arg(ret, 1) != pinned, "and the fingerprint the token had after the transfers");
        assertEq(hub.ownerOf(id), address(s), "nothing moved");
        assertEq(weth.allowance(address(r), attacker), 0, "the approval did not survive the refusal");
    }

    function test_aSpenderWhoDrainsAFloorInsideTheFillIsRefusedAfterTheTransfers() public {
        (BazaarSeller s, uint256 id, BazaarReach r, Order memory o, ) = _windowed();
        s.arm(address(weth), abi.encodeCall(BazaarToken.transferFrom, (address(r), attacker, 1)));
        (bool ok, bytes memory ret) = _fill(o, buyer, PRICE, KEY);
        assertFalse(ok, "a floor drained from inside the fill does not sell");
        assertEq(ret, abi.encodeWithSelector(FloorBroken.selector, address(weth), 10 ether - 1, 10 ether),
                 "the floors are measured again after the transfers");
        assertEq(hub.ownerOf(id), address(s), "nothing moved");
        assertEq(weth.balanceOf(address(r)), 10 ether, "the drain did not survive the refusal");
    }

    function test_aSellerWhoTradesTheMarketInsideTheFillIsRefusedAfterTheTransfers() public {
        (BazaarSeller s, uint256 id, , Order memory o, bytes32 pinned) = _windowed();
        s.arm(address(pool), abi.encodeCall(BazaarPool.trade, (id)));
        (bool ok, bytes memory ret) = _fill(o, buyer, PRICE, KEY);
        assertFalse(ok, "a seller who trades the owned market from its own receive() does not sell");
        assertTrue(_selector(ret) == FingerprintMoved.selector, "a market that traded inside the fill is refused with FingerprintMoved");
        assertEq(_arg(ret, 0), pinned, "the refusal names the pinned fingerprint");
        assertEq(hub.ownerOf(id), address(s), "nothing moved");
    }

    function test_theSameConduitFillLandsWhenTheSellerDoesNothingInsideIt() public {
        (BazaarSeller s, uint256 id, , Order memory o, ) = _windowed();
        s.arm(address(0x1D1E), "");
        (bool ok, bytes memory ret) = _fill(o, buyer, PRICE, KEY);
        assertTrue(ok, string(ret));
        assertTrue(s.attempted(), "the seller was called inside the fill");
        assertEq(hub.ownerOf(id), buyer, "a conduit fill with nothing done inside it lands");
    }

    function test_withoutAConduitTheTokenMovesFirstAndTheSellerHasNoMoment() public {
        BazaarSeller s = new BazaarSeller();
        (uint256 id, BazaarReach r) = _contractToken(s, END);
        Order memory o = _signed(_listing(id, address(s), _pin(id, _none()), END));
        bazaar.publish(o, _none());
        s.arm(address(r), abi.encodeCall(BazaarReach.execute,
            (address(weth), 0, abi.encodeCall(BazaarToken.approve, (attacker, type(uint256).max)))));
        (bool ok, bytes memory ret) = _fill(o, buyer, PRICE, bytes32(0));
        assertTrue(ok, string(ret));
        assertTrue(s.attempted() && !s.acted(), "without a conduit the seller is paid after the token moved, as nobody");
        assertEq(hub.ownerOf(id), buyer, "the token moved");
    }

    /*═══════════════════ check ═══════════════════*/

    function test_checkNamesTheRefusalAPageWouldSee() public {
        (uint256 id, BazaarReach r) = _token(seller, END + 10 days);
        pool.open(id);
        pool.sealMarket(id, END);
        weth.mint(address(r), 1 ether);
        Floor[] memory floors = _one(address(weth), 1 ether);
        bytes32 zh = _pin(id, floors);
        bazaar.publish(_signed(_listing(id, seller, zh, END)), floors);
        assertEq(bytes32(bazaar.check(zh, END)), bytes32(0), "check returns zero for a pin a fill would admit");
        assertEq(bytes32(bazaar.check(keccak256("nothing"), END)), bytes32(NotPinned.selector), "check names NotPinned for an unknown zone hash");
        assertEq(bytes32(bazaar.check(zh, END + 11 days)), bytes32(ReachSealShort.selector), "check names ReachSealShort past the Reach's seal");
        assertEq(bytes32(bazaar.check(zh, END + 1 days)), bytes32(MarketSealShort.selector), "check names MarketSealShort past the market's seal");
        weth.burn(address(r), 1);
        assertEq(bytes32(bazaar.check(zh, END)), bytes32(FloorBroken.selector), "check names FloorBroken once a balance falls under its floor");
    }
}
