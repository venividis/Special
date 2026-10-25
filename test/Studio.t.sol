// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Studio} from "../src/Studio.sol";
import {Collection} from "../src/Collection.sol";
import {IStudioEvents} from "../src/interfaces/IStudio.sol";
import {CollectionSpec} from "../src/interfaces/ICollection.sol";
import {Persona} from "../src/lib/Persona.sol";
import {SSTORE2} from "../src/lib/SSTORE2.sol";
import {Create3Factory} from "../src/lib/Create3Factory.sol";
import {StudioHub, StudioNFT, StudioAccount} from "./mocks/StudioFixtures.sol";

/*  docs/V2.md §3.4 and src/interfaces/IStudio.sol: a collection is launched
    from a token by whoever acts for it, at an address the creator and the
    salt alone decide, under bounds checked once, by name; the Studio keeps
    the registry and the lineage and holds nothing.                       */
contract StudioTest is Test {
    uint64 constant T0 = 1_733_000_000;

    StudioHub hub;
    StudioNFT nft;
    Studio studio;
    address constant JOURNAL = address(0x10A1);   // codeless here: W2 lands it
    address constant AGORA = address(0xA60A);     // codeless here: W5 lands it
    address alice = address(0xA11CE);             // holds hub #1
    address bob = address(0xB0B);                 // holds hub #2
    address carol = address(0xCA201);             // holds nft #7
    address stranger = address(0x5712);
    uint256 p1;
    uint256 p2;
    uint256 pn;
    bytes32 constant SALT = keccak256("moonlit");

    function setUp() public {
        vm.warp(T0);
        hub = new StudioHub();
        nft = new StudioNFT();
        studio = new Studio(address(hub), JOURNAL, AGORA);
        hub.mint(alice);
        hub.mint(bob);
        nft.mint(carol, 7);
        p1 = Persona.pack(address(hub), 1);
        p2 = Persona.pack(address(hub), 2);
        pn = Persona.pack(address(nft), 7);
    }

    function _spec() internal pure returns (CollectionSpec memory s) {
        s.name = "Moonlit";
        s.symbol = "MOON";
        s.description = "a map of the night it was minted";
        s.supply = 100;
        s.price = 0.01 ether;
        s.referralBps = 1_000;
        s.royaltyBps = 500;
        s.page = bytes("<h1>#{{id}} of {{supply}}</h1>");
    }

    function _launch(address who, uint256 creator, CollectionSpec memory s, bytes32 salt) internal returns (address) {
        vm.prank(who);
        return studio.launch(creator, s, salt);
    }

    /// @dev The raw refusal of a launch: its selector and its arguments.
    function _refusal(address who, uint256 creator, CollectionSpec memory s, bytes32 salt) internal returns (bytes memory) {
        vm.prank(who);
        (bool ok, bytes memory ret) = address(studio).call(abi.encodeCall(Studio.launch, (creator, s, salt)));
        assertFalse(ok, "the launch was refused");
        return ret;
    }

    function _refusedWith(address who, uint256 creator, CollectionSpec memory s, bytes4 error) internal {
        assertEq(_refusal(who, creator, s, SALT), abi.encodeWithSelector(error), "refused by name");
    }

    function _bytes(uint256 n, bytes1 fill) internal pure returns (bytes memory b) {
        b = new bytes(n);
        for (uint256 i; i < n; ++i) b[i] = fill;
    }

    /// @dev `count` holes of `{{room}}` padded with text to exactly `n` bytes.
    function _holey(uint256 n, uint256 count) internal pure returns (bytes memory b) {
        b = _bytes(n, "x");
        for (uint256 i; i < count; ++i) {
            bytes memory h = "{{room}}";
            for (uint256 j; j < 8; ++j) b[i * 8 + j] = h[j];
        }
    }

    /*═══════════════════ who may launch ═══════════════════*/

    function test_theHolderLaunchesACollectionFromTheirToken() public {
        CollectionSpec memory s = _spec();
        address predicted = studio.predict(p1, SALT);
        address c = _launch(alice, p1, s, SALT);
        assertEq(c, predicted, "the collection landed where predict said");
        assertTrue(c.code.length > 0, "and it has code");
        assertTrue(studio.isCollection(c), "the Studio registers it");
        assertEq(studio.parentOf(c), address(hub), "a hub token's collection has the hub as its parent");
        assertEq(Collection(c).creator(), p1, "the creator is the persona, not the wallet");
        assertEq(Collection(c).STUDIO(), address(studio), "the collection names its Studio");
        assertEq(Collection(c).HUB(), address(hub), "and the hub");
        assertEq(Collection(c).JOURNAL(), JOURNAL, "and the Journal");
        assertEq(Collection(c).AGORA(), AGORA, "and Agora");
        assertEq(address(studio).balance, 0, "the Studio holds nothing");
    }

    function test_theReachMayLaunchForItsToken() public {
        StudioAccount reach = StudioAccount(payable(hub.account(1)));
        CollectionSpec memory s = _spec();
        bytes memory call_ = abi.encodeCall(Studio.launch, (p1, s, SALT));
        bytes memory ret = reach.exec(address(studio), 0, call_);
        address c = abi.decode(ret, (address));
        assertTrue(studio.isCollection(c), "a hub token's canonical Reach acts for it");
        assertEq(Collection(c).creator(), p1, "and launches as the token");
    }

    function test_aStrangerCannotLaunchFromSomeoneElsesToken() public {
        CollectionSpec memory s = _spec();
        _refusedWith(stranger, p1, s, IStudioEvents.NotYours.selector);
        _refusedWith(bob, p1, s, IStudioEvents.NotYours.selector);
        // the Grip is the hand that only holds: it never acts
        _refusedWith(hub.grip(1), p1, s, IStudioEvents.NotYours.selector);
        // another token's Reach is not this token's
        _refusedWith(hub.account(2), p1, s, IStudioEvents.NotYours.selector);
        // a token of any other collection: only its holder
        _refusedWith(alice, pn, s, IStudioEvents.NotYours.selector);
        // a token that does not exist, a codeless collection, the zero persona
        _refusedWith(alice, Persona.pack(address(hub), 99), s, IStudioEvents.NotYours.selector);
        _refusedWith(alice, Persona.pack(address(0xC0DE1E55), 1), s, IStudioEvents.NotYours.selector);
        _refusedWith(alice, 0, s, IStudioEvents.NotYours.selector);
        assertEq(studio.collectionCount(), 0, "nothing was launched");
    }

    function test_anyERC721TokenMayLaunch() public {
        address c = _launch(carol, pn, _spec(), SALT);
        assertTrue(studio.isCollection(c), "the holder of any ERC-721 token launches from it");
        assertEq(studio.parentOf(c), address(nft), "and its collection is the parent");
        assertEq(Collection(c).creator(), pn, "the creator is that token");
    }

    function test_aTokenOfAStudioCollectionLaunchesAChild() public {
        address moonlit = _launch(alice, p1, _spec(), SALT);
        vm.deal(carol, 1 ether);
        vm.prank(carol);
        uint256 id = Collection(moonlit).mint{value: 0.01 ether}(carol, 0);
        uint256 child = Persona.pack(moonlit, id);
        CollectionSpec memory s = _spec();
        s.name = "Moonlit Echo";
        address echo = _launch(carol, child, s, SALT);
        assertEq(studio.parentOf(echo), moonlit, "a collection launched from a Moonlit token has Moonlit as its parent");
        assertEq(Collection(echo).creator(), child, "and that token as its creator");
        assertTrue(echo != moonlit, "the same salt under another creator is another address");
    }

    /*═══════════════════ where it lands ═══════════════════*/

    function test_theCollectionLandsWherePredictSaid() public {
        // the CREATE3 arithmetic, by hand, with the factory's own proxy hash
        Create3Factory factory = new Create3Factory();
        assertEq(studio.PROXY_INITCODE_HASH(), factory.PROXY_INITCODE_HASH(), "the proxy is the factory's");
        assertEq(studio.PROXY_INITCODE_HASH(), keccak256(hex"67363d3d37363d34f03d5260086018f3"), "sixteen bytes of initcode");
        bytes32 s = keccak256(abi.encode(p1, SALT));
        address proxy = address(uint160(uint256(keccak256(
            abi.encodePacked(bytes1(0xff), address(studio), s, studio.PROXY_INITCODE_HASH())))));
        address want = address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", proxy, hex"01")))));
        assertEq(studio.predict(p1, SALT), want, "predict is CREATE3 under keccak(creator, salt)");

        assertTrue(studio.predict(p2, SALT) != want, "another creator, another address");
        assertTrue(studio.predict(p1, bytes32(uint256(SALT) + 1)) != want, "another salt, another address");

        // the spec does not move the address
        CollectionSpec memory big = _spec();
        big.page = _bytes(5_000, "a");
        big.supply = 7;
        address c = _launch(alice, p1, big, SALT);
        assertEq(c, want, "the collection is where predict said, whatever the spec");
        address c2 = _launch(bob, p2, _spec(), SALT);
        assertEq(c2, studio.predict(p2, SALT), "and so is every other");
    }

    function test_aSaltIsSpentOncePerCreator() public {
        address c = _launch(alice, p1, _spec(), SALT);
        bytes memory ret = _refusal(alice, p1, _spec(), SALT);
        assertEq(ret, abi.encodeWithSelector(IStudioEvents.SaltUsed.selector, c), "a spent salt is refused with the address it filled");
        // the Reach acts as the same creator, so it meets the same refusal
        vm.prank(hub.account(1));
        (bool ok,) = address(studio).call(abi.encodeCall(Studio.launch, (p1, _spec(), SALT)));
        assertFalse(ok, "the Reach cannot respend its token's salt");
        address other = _launch(bob, p2, _spec(), SALT);
        assertTrue(other != c, "the same salt is fresh in another creator's namespace");
        address again = _launch(alice, p1, _spec(), keccak256("moonlit 2"));
        assertTrue(again != c && studio.isCollection(again), "and a new salt is fresh in the same one");
    }

    /*═══════════════════ the bounds, each by name ═══════════════════*/

    function test_theNameIsOneToFortyEightBytes() public {
        CollectionSpec memory s = _spec();
        s.name = "";
        _refusedWith(alice, p1, s, IStudioEvents.BadName.selector);
        s.name = string(_bytes(49, "n"));
        _refusedWith(alice, p1, s, IStudioEvents.BadName.selector);
        s.name = string(_bytes(48, "n"));
        assertTrue(studio.isCollection(_launch(alice, p1, s, SALT)), "forty-eight bytes is a name");
        s.name = "n";
        assertTrue(studio.isCollection(_launch(alice, p1, s, keccak256("one"))), "and so is one");
    }

    function test_theSymbolIsOneToTwelveBytes() public {
        CollectionSpec memory s = _spec();
        s.symbol = "";
        _refusedWith(alice, p1, s, IStudioEvents.BadSymbol.selector);
        s.symbol = string(_bytes(13, "S"));
        _refusedWith(alice, p1, s, IStudioEvents.BadSymbol.selector);
        s.symbol = string(_bytes(12, "S"));
        assertTrue(studio.isCollection(_launch(alice, p1, s, SALT)), "twelve bytes is a symbol");
        s.symbol = "S";
        assertTrue(studio.isCollection(_launch(alice, p1, s, keccak256("one"))), "and so is one");
    }

    function test_theDescriptionIsAtMostOneThousandAndTwentyFourBytes() public {
        CollectionSpec memory s = _spec();
        s.description = string(_bytes(1_025, "d"));
        _refusedWith(alice, p1, s, IStudioEvents.BadDescription.selector);
        s.description = string(_bytes(1_024, "d"));
        assertTrue(studio.isCollection(_launch(alice, p1, s, SALT)), "1,024 bytes is a description");
        s.description = "";
        assertTrue(studio.isCollection(_launch(alice, p1, s, keccak256("none"))), "and so is none");
    }

    function test_theSupplyIsOneToOneMillion() public {
        CollectionSpec memory s = _spec();
        s.supply = 0;
        _refusedWith(alice, p1, s, IStudioEvents.BadSupply.selector);
        s.supply = 1_000_001;
        _refusedWith(alice, p1, s, IStudioEvents.BadSupply.selector);
        s.supply = 1_000_000;
        assertTrue(studio.isCollection(_launch(alice, p1, s, SALT)), "a million is a supply");
        s.supply = 1;
        assertTrue(studio.isCollection(_launch(alice, p1, s, keccak256("one"))), "and so is one");
    }

    function test_theWindowMustCloseAfterItOpens() public {
        CollectionSpec memory s = _spec();
        // opening at launch: the close must be after now
        s.closesAt = T0;
        _refusedWith(alice, p1, s, IStudioEvents.BadWindow.selector);
        s.closesAt = T0 - 1;
        _refusedWith(alice, p1, s, IStudioEvents.BadWindow.selector);
        // a future opening: the close must be after it, not merely after now
        s.opensAt = T0 + 100;
        s.closesAt = T0 + 100;
        _refusedWith(alice, p1, s, IStudioEvents.BadWindow.selector);
        s.closesAt = T0 + 50;
        _refusedWith(alice, p1, s, IStudioEvents.BadWindow.selector);
        // a past opening: born closed is refused, born open is not
        s.opensAt = T0 - 100;
        s.closesAt = T0 - 50;
        _refusedWith(alice, p1, s, IStudioEvents.BadWindow.selector);
        s.closesAt = T0 + 1;
        assertTrue(studio.isCollection(_launch(alice, p1, s, keccak256("past"))), "a window open now and closing later is a window");
        s.opensAt = T0 + 100;
        s.closesAt = T0 + 101;
        assertTrue(studio.isCollection(_launch(alice, p1, s, keccak256("future"))), "one second after a future opening is a window");
        s.opensAt = 0;
        s.closesAt = T0 + 1;
        assertTrue(studio.isCollection(_launch(alice, p1, s, keccak256("now"))), "one second after now is a window");
        s.closesAt = 0;
        assertTrue(studio.isCollection(_launch(alice, p1, s, keccak256("never"))), "and zero is never");
    }

    function test_theReferralShareIsAtMostTwoThousandBasisPoints() public {
        CollectionSpec memory s = _spec();
        s.referralBps = 2_001;
        _refusedWith(alice, p1, s, IStudioEvents.BadShare.selector);
        s.referralBps = 2_000;
        assertTrue(studio.isCollection(_launch(alice, p1, s, SALT)), "20 % is a referral share");
    }

    function test_theRoyaltyIsAtMostOneThousandBasisPoints() public {
        CollectionSpec memory s = _spec();
        s.royaltyBps = 1_001;
        _refusedWith(alice, p1, s, IStudioEvents.BadShare.selector);
        s.royaltyBps = 1_000;
        assertTrue(studio.isCollection(_launch(alice, p1, s, SALT)), "10 % is a royalty");
    }

    function test_thePageIsOneToTwentyFourThousandBytes() public {
        CollectionSpec memory s = _spec();
        s.page = "";
        _refusedWith(alice, p1, s, IStudioEvents.BadPage.selector);
        s.page = _bytes(24_001, "p");
        _refusedWith(alice, p1, s, IStudioEvents.BadPage.selector);
        s.page = _bytes(24_000, "p");
        assertTrue(studio.isCollection(_launch(alice, p1, s, SALT)), "24,000 bytes is a page");
        s.page = "p";
        assertTrue(studio.isCollection(_launch(alice, p1, s, keccak256("one"))), "and so is one");
    }

    function test_theArtIsAtMostTwelveThousandBytes() public {
        CollectionSpec memory s = _spec();
        s.art = _bytes(12_001, "a");
        _refusedWith(alice, p1, s, IStudioEvents.BadArt.selector);
        s.art = _bytes(12_000, "a");
        assertTrue(studio.isCollection(_launch(alice, p1, s, SALT)), "12,000 bytes is art");
        s.art = "";
        assertTrue(studio.isCollection(_launch(alice, p1, s, keccak256("none"))), "and none is the default orb");
    }

    function test_aTemplateHoldsAtMostTwoHundredFiftySixHoles() public {
        CollectionSpec memory s = _spec();
        s.page = _holey(24_000, 257);
        _refusedWith(alice, p1, s, IStudioEvents.BadPage.selector);
        s.page = _holey(24_000, 256);
        s.art = _holey(12_000, 257);
        _refusedWith(alice, p1, s, IStudioEvents.BadArt.selector);
        s.art = _holey(12_000, 256);
        assertTrue(studio.isCollection(_launch(alice, p1, s, SALT)), "256 holes in each template is allowed");
        // text that only looks like holes is not counted
        s.page = abi.encodePacked(_holey(3_000, 256), "{{ room }}{{ROOM}}{{rooms}}{{room");
        s.art = "";
        assertTrue(studio.isCollection(_launch(alice, p1, s, keccak256("near"))), "near-holes are text, not holes");
    }

    /*═══════════════════ the Studio holds nothing ═══════════════════*/

    function test_theStudioHoldsNothing() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(studio).call{value: 1}(abi.encodeCall(Studio.launch, (p1, _spec(), SALT)));
        assertFalse(ok, "launch is not payable");
        (ok,) = address(studio).call{value: 1}("");
        assertFalse(ok, "and the Studio takes no ether at all");
        _launch(alice, p1, _spec(), SALT);
        _launch(carol, pn, _spec(), SALT);
        assertEq(address(studio).balance, 0, "after two launches the Studio holds nothing");
        // its one asset is the Collection's code, written once by the constructor
        assertEq(keccak256(SSTORE2.read(studio.CODE())), keccak256(type(Collection).creationCode),
            "the shard is the Collection's creation code");
        assertEq(studio.CODE_HASH(), keccak256(type(Collection).creationCode), "and CODE_HASH pins it");
    }

    function test_theCollectionIsBuiltFromTheSpec() public {
        CollectionSpec memory s = _spec();
        s.opensAt = T0 + 10;
        s.closesAt = T0 + 1_000;
        s.perWallet = 3;
        s.art = bytes("<svg>{{seed}}</svg>");
        address c = _launch(alice, p1, s, SALT);
        CollectionSpec memory r = Collection(c).spec();
        assertEq(r.name, s.name);
        assertEq(r.symbol, s.symbol);
        assertEq(r.description, s.description);
        assertEq(uint256(r.supply), s.supply, "the supply");
        assertEq(uint256(r.price), s.price, "the price");
        assertEq(uint256(r.opensAt), s.opensAt, "the opening");
        assertEq(uint256(r.closesAt), s.closesAt, "the closing");
        assertEq(uint256(r.perWallet), s.perWallet, "the wallet limit");
        assertEq(uint256(r.referralBps), s.referralBps, "the referral share");
        assertEq(uint256(r.royaltyBps), s.royaltyBps, "the royalty");
        assertEq(r.page, s.page, "the page template, read back from its code");
        assertEq(r.art, s.art, "the art template, read back from its code");
        assertEq(Collection(c).name(), "Moonlit");
        assertEq(Collection(c).symbol(), "MOON");
    }

    function test_theRegistryListsEveryCollectionAndEachCreatorsOwn() public {
        address a = _launch(alice, p1, _spec(), SALT);
        address b = _launch(alice, p1, _spec(), keccak256("second"));
        address c = _launch(carol, pn, _spec(), SALT);
        assertEq(studio.collectionCount(), 3, "three launched");
        assertEq(studio.collectionAt(0), a);
        assertEq(studio.collectionAt(1), b);
        assertEq(studio.collectionAt(2), c);
        address[] memory mine = studio.collectionsOf(p1);
        assertEq(mine.length, 2, "two from hub #1");
        assertEq(mine[0], a);
        assertEq(mine[1], b);
        assertEq(studio.collectionsOf(pn).length, 1, "one from nft #7");
        assertEq(studio.collectionsOf(p2).length, 0, "none from hub #2");
        assertFalse(studio.isCollection(address(hub)), "the hub is not a Studio collection");
        assertFalse(studio.isCollection(studio.predict(p2, SALT)), "a prediction is not a collection until it lands");
        assertEq(studio.HUB(), address(hub));
        assertEq(studio.JOURNAL(), JOURNAL);
        assertEq(studio.AGORA(), AGORA);
    }

    function test_aStudioNeedsAHub() public {
        vm.expectRevert(Studio.ZeroAddress.selector);
        new Studio(address(0), JOURNAL, AGORA);
    }
}
