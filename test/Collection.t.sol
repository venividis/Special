// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Studio} from "../src/Studio.sol";
import {Collection} from "../src/Collection.sol";
import {ICollectionEvents, CollectionSpec} from "../src/interfaces/ICollection.sol";
import {ERC721Base} from "../src/lib/ERC721Base.sol";
import {Persona} from "../src/lib/Persona.sol";
import {Transient} from "../src/lib/Transient.sol";
import {LibNum} from "../src/lib/LibNum.sol";
import {
    StudioHub, StudioNFT, StudioAccount, StudioJournal, StudioBrokenJournal, StudioShortJournal,
    StudioReentrant, StudioTemplateProbe, StudioCodec
} from "./mocks/StudioFixtures.sol";

/*  docs/V2.md §3.4, §5 and src/interfaces/ICollection.sol: a mint pays
    exactly the price inside its window, under its supply and the minter's
    limit; a referral share is owed to a token whose payee is somebody
    else; claims pay the payee of the moment, so the money follows the
    token; the custody epoch moves on every transfer; and every token's
    tokenURI is its own website, its holes filled from the chain.        */
contract CollectionTest is Test {
    using LibNum for uint256;

    uint64 constant T0 = 1_733_000_000;
    uint256 constant PRICE = 0.01 ether;

    StudioHub hub;
    StudioNFT nft;
    Studio studio;
    StudioJournal journal;
    Collection moon;
    address alice = address(0xA11CE);     // holds hub #1, the creator
    address bob = address(0xB0B);         // holds hub #2, a referrer
    address carol = address(0xCA201);     // a minter; holds nft #7
    address dave = address(0xDA7E);       // another minter
    address stranger = address(0x5712);
    uint256 p1;
    uint256 p2;
    uint256 pn;

    bytes constant ALL =
        "{{id}}|{{seed}}|{{holder}}|{{epoch}}|{{memories}}|{{minted}}|{{supply}}|{{price}}|{{collection}}|{{creator}}|{{room}}|{{chain}}";

    function setUp() public {
        vm.warp(T0);
        hub = new StudioHub();
        nft = new StudioNFT();
        journal = new StudioJournal();
        studio = new Studio(address(hub), address(journal), address(0xA60A));
        hub.mint(alice);
        hub.mint(bob);
        nft.mint(carol, 7);
        p1 = Persona.pack(address(hub), 1);
        p2 = Persona.pack(address(hub), 2);
        pn = Persona.pack(address(nft), 7);
        moon = _launch(_spec(), "moonlit");
        vm.deal(carol, 100 ether);
        vm.deal(dave, 100 ether);
        vm.deal(stranger, 1 ether);
    }

    function _spec() internal pure returns (CollectionSpec memory s) {
        s.name = "Moonlit";
        s.symbol = "MOON";
        s.description = "a map of the night it was minted";
        s.supply = 100;
        s.price = uint128(PRICE);
        s.referralBps = 1_000;
        s.royaltyBps = 500;
        s.page = ALL;
    }

    function _launch(CollectionSpec memory s, string memory salt) internal returns (Collection) {
        vm.prank(alice);
        return Collection(studio.launch(p1, s, keccak256(bytes(salt))));
    }

    function _launchFrom(address who, uint256 creator, CollectionSpec memory s) internal returns (Collection) {
        vm.prank(who);
        return Collection(studio.launch(creator, s, keccak256("from")));
    }

    function _mint(Collection c, address who, address to, uint256 via) internal returns (uint256) {
        vm.prank(who);
        return c.mint{value: PRICE}(to, via);
    }

    /// @dev The raw refusal of a mint: its selector and arguments, uncut.
    function _mintRefusal(Collection c, address who, uint256 value, address to) internal returns (bytes memory) {
        vm.prank(who);
        (bool ok, bytes memory ret) = address(c).call{value: value}(abi.encodeCall(Collection.mint, (to, 0)));
        assertFalse(ok, "the mint was refused");
        return ret;
    }

    /*═══════════════════ minting ═══════════════════*/

    function test_mintsCountFromOneAtExactlyThePrice() public {
        assertEq(_mint(moon, carol, carol, 0), 1, "the first id is 1");
        assertEq(_mint(moon, carol, dave, 0), 2, "and the next 2");
        assertEq(moon.ownerOf(1), carol);
        assertEq(moon.ownerOf(2), dave, "the token goes to `to`, not the payer");
        assertEq(moon.totalSupply(), 2);
        assertEq(moon.balanceOf(dave), 1);
        assertEq(address(moon).balance, 2 * PRICE, "the collection holds exactly what it was paid");
        assertEq(moon.owed(p1), 2 * PRICE, "and owes all of it to the creator");
    }

    function test_aWrongPriceIsRefusedWithBothNumbers() public {
        assertEq(_mintRefusal(moon, carol, PRICE - 1, carol),
            abi.encodeWithSelector(ICollectionEvents.WrongPrice.selector, PRICE, PRICE - 1), "a wei short is refused, naming both");
        assertEq(_mintRefusal(moon, carol, PRICE + 1, carol),
            abi.encodeWithSelector(ICollectionEvents.WrongPrice.selector, PRICE, PRICE + 1), "a wei over is refused, naming both");
        assertEq(_mintRefusal(moon, carol, 0, carol),
            abi.encodeWithSelector(ICollectionEvents.WrongPrice.selector, PRICE, 0), "nothing is refused");
        CollectionSpec memory s = _spec();
        s.price = 0;
        Collection free = _launch(s, "free");
        vm.prank(carol);
        assertEq(free.mint(carol, 0), 1, "a free collection mints for nothing");
        assertEq(_mintRefusal(free, carol, 1, carol),
            abi.encodeWithSelector(ICollectionEvents.WrongPrice.selector, 0, 1), "and refuses a gift");
    }

    function test_theWindowIsOpenFromItsFirstSecondToBeforeItsLast() public {
        CollectionSpec memory s = _spec();
        s.opensAt = T0 + 100;
        s.closesAt = T0 + 200;
        Collection w = _launch(s, "window");
        vm.warp(T0 + 99);
        assertEq(_mintRefusal(w, carol, PRICE, carol),
            abi.encodeWithSelector(ICollectionEvents.NotOpen.selector, uint64(T0 + 100)), "a second early is not open, naming the opening");
        vm.warp(T0 + 100);
        assertEq(_mint(w, carol, carol, 0), 1, "the opening second mints");
        vm.warp(T0 + 199);
        assertEq(_mint(w, carol, carol, 0), 2, "the last second before the close mints");
        vm.warp(T0 + 200);
        assertEq(_mintRefusal(w, carol, PRICE, carol),
            abi.encodeWithSelector(ICollectionEvents.Closed.selector, uint64(T0 + 200)), "the closing second is closed, naming it");
    }

    function test_aCollectionWithNoWindowIsAlwaysOpen() public {
        assertEq(_mint(moon, carol, carol, 0), 1, "opensAt 0 is open at launch");
        vm.warp(T0 + 3650 days);
        assertEq(_mint(moon, carol, carol, 0), 2, "and closesAt 0 never closes");
    }

    function test_theSupplyIsACap() public {
        CollectionSpec memory s = _spec();
        s.supply = 3;
        Collection three = _launch(s, "three");
        for (uint256 i = 1; i <= 3; ++i) assertEq(_mint(three, carol, carol, 0), i);
        assertEq(_mintRefusal(three, dave, PRICE, dave),
            abi.encodeWithSelector(ICollectionEvents.SoldOut.selector), "the fourth of three is sold out");
        assertEq(three.totalSupply(), 3, "and the supply stands");
    }

    function test_theWalletLimitCountsTheMinterNotTheRecipient() public {
        CollectionSpec memory s = _spec();
        s.perWallet = 2;
        Collection two = _launch(s, "two");
        _mint(two, carol, carol, 0);
        _mint(two, carol, dave, 0);
        assertEq(uint256(two.mintedBy(carol)), 2, "two mints counted against the minter");
        assertEq(uint256(two.mintedBy(dave)), 0, "none against the recipient");
        assertEq(_mintRefusal(two, carol, PRICE, stranger),
            abi.encodeWithSelector(ICollectionEvents.WalletLimit.selector, uint32(2)), "a third by the same minter is refused, naming the limit");
        assertEq(_mint(two, dave, carol, 0), 3, "another minter is not limited by the first");
        // zero is no limit
        for (uint256 i; i < 5; ++i) _mint(moon, carol, carol, 0);
        assertEq(uint256(moon.mintedBy(carol)), 5, "with perWallet 0 a minter mints as often as it pays");
    }

    function test_aZeroRecipientIsRefused() public {
        assertEq(_mintRefusal(moon, carol, PRICE, address(0)),
            abi.encodeWithSelector(ERC721Base.ERC721InvalidReceiver.selector, address(0)), "a mint to nobody is refused");
        assertEq(moon.totalSupply(), 0, "and nothing was counted");
    }

    /*═══════════════════ referrals ═══════════════════*/

    function test_aReferralIsOwedItsShareAndTheCreatorTheRest() public {
        _mint(moon, carol, carol, p2);
        uint256 share = PRICE * 1_000 / 10_000;
        assertEq(moon.owed(p2), share, "the referring token is owed price x referralBps / 10,000");
        assertEq(moon.owed(p1), PRICE - share, "the creator the rest");
        // a referrer of any collection: the payee is its holder
        _mint(moon, dave, dave, pn);
        assertEq(moon.owed(pn), share, "a token of any ERC-721 can refer");
        assertEq(moon.owed(p1), 2 * (PRICE - share), "and the creator keeps the rest of each mint");
        assertEq(moon.owed(p1) + moon.owed(p2) + moon.owed(pn), address(moon).balance, "every wei is owed to someone");
    }

    function test_aReferralToTheMinterOrTheRecipientStaysWithTheCreator() public {
        // carol holds nft #7, so its payee is carol: she cannot refer herself
        _mint(moon, carol, dave, pn);
        assertEq(moon.owed(pn), 0, "a referrer whose payee is the minter gets nothing");
        // nor refer the token she mints to herself through a friend
        _mint(moon, dave, carol, pn);
        assertEq(moon.owed(pn), 0, "a referrer whose payee is the recipient gets nothing");
        // a hub token's payee is its Reach: the Reach minting cannot refer itself
        StudioAccount reach = StudioAccount(payable(hub.account(2)));
        vm.deal(address(reach), 1 ether);
        reach.exec(address(moon), PRICE, abi.encodeCall(Collection.mint, (bob, p2)));
        assertEq(moon.owed(p2), 0, "a Reach that mints cannot refer its own token");
        // nobody to pay: a token that does not exist, a collection with no code
        _mint(moon, dave, dave, Persona.pack(address(hub), 99));
        _mint(moon, dave, dave, Persona.pack(address(0xC0DE1E55), 1));
        assertEq(moon.owed(Persona.pack(address(hub), 99)) + moon.owed(Persona.pack(address(0xC0DE1E55), 1)), 0,
            "a referrer with no payee gets nothing");
        _mint(moon, dave, dave, 0);
        assertEq(moon.owed(p1), 6 * PRICE, "every share that was not paid stayed with the creator");
    }

    /*═══════════════════ claims ═══════════════════*/

    function test_claimPaysThePayeeWhoeverAsks() public {
        _mint(moon, carol, carol, p2);
        address reach1 = hub.feeSink(1);
        address reach2 = hub.feeSink(2);
        uint256 before = stranger.balance;
        vm.prank(stranger);
        uint256 paid = moon.claim(p2);
        assertEq(paid, PRICE / 10, "the referrer's share");
        assertEq(reach2.balance, PRICE / 10, "is paid to the referring token's fee sink");
        assertEq(stranger.balance, before, "and not to whoever called");
        assertEq(moon.owed(p2), 0, "the debt is cleared");
        vm.prank(stranger);
        moon.claim(p1);
        assertEq(reach1.balance, PRICE - PRICE / 10, "the creator's share to the creator token's fee sink");
        assertEq(address(moon).balance, 0, "and the collection holds nothing it does not owe");
        vm.expectRevert(ICollectionEvents.NothingOwed.selector);
        moon.claim(p1);
        vm.expectRevert(ICollectionEvents.NothingOwed.selector);
        moon.claim(Persona.pack(address(hub), 99));
    }

    function test_claimRefusesAPersonaWithNoPayee() public {
        Collection c = _launchFrom(carol, pn, _spec());
        _mint(c, dave, dave, 0);
        vm.prank(carol);
        nft.burn(7);
        vm.prank(stranger);
        (bool ok, bytes memory ret) = address(c).call(abi.encodeCall(Collection.claim, (pn)));
        assertFalse(ok, "a persona nobody can be paid for is not paid");
        assertEq(ret, abi.encodeWithSelector(ICollectionEvents.NoPayee.selector, pn), "refused naming the persona");
        assertEq(c.owed(pn), PRICE, "and the debt waits for a payee");
        nft.mint(stranger, 7);
        vm.prank(dave);
        c.claim(pn);
        assertEq(c.owed(pn), 0, "a token that comes back is paid what its persona was owed");
    }

    function test_aSaleOfTheCreatorTokenMovesThePayee() public {
        // any other ERC-721: the payee is the holder at the moment of the claim
        Collection c = _launchFrom(carol, pn, _spec());
        _mint(c, dave, dave, 0);
        vm.prank(carol);
        nft.transferFrom(carol, stranger, 7);
        uint256 carolBefore = carol.balance;
        uint256 strangerBefore = stranger.balance;
        vm.prank(dave);
        c.claim(pn);
        assertEq(stranger.balance, strangerBefore + PRICE, "the buyer of the creator token is paid what it was owed");
        assertEq(carol.balance, carolBefore, "the seller is not");

        // a hub token: its fee sink — the Grip if the holder chose, and the Reach again after a sale
        _mint(moon, dave, dave, 0);
        vm.prank(alice);
        hub.setFeesToGrip(1, true);
        vm.prank(dave);
        moon.claim(p1);
        assertEq(hub.grip(1).balance, PRICE, "with fees to the Grip, the Grip is paid");
        _mint(moon, dave, dave, 0);
        vm.prank(alice);
        hub.transferFrom(alice, bob, 1);
        vm.prank(dave);
        moon.claim(p1);
        assertEq(hub.account(1).balance, PRICE, "after the sale the fee sink is the Reach again, the buyer's");
        assertEq(hub.grip(1).balance, PRICE, "and nothing more went to the Grip");
    }

    function test_aRefusedPushFailsTheClaimAndKeepsTheDebt() public {
        _mint(moon, carol, carol, 0);
        StudioAccount reach = StudioAccount(payable(hub.account(1)));
        reach.setRefuse(true);
        vm.expectRevert(ICollectionEvents.TransferFailed.selector);
        moon.claim(p1);
        assertEq(moon.owed(p1), PRICE, "a payee that refuses is still owed");
        reach.setRefuse(false);
        moon.claim(p1);
        assertEq(address(reach).balance, PRICE, "and is paid once it accepts");
    }

    function test_aPayeeCannotReenterFromItsOwnPayout() public {
        StudioReentrant greedy = new StudioReentrant();
        nft.mint(address(greedy), 8);
        uint256 pg = Persona.pack(address(nft), 8);
        CollectionSpec memory s = _spec();
        s.referralBps = 0;
        vm.prank(address(greedy));
        Collection c = Collection(studio.launch(pg, s, keccak256("greedy")));
        _mint(c, dave, dave, 0);
        greedy.arm(address(c), pg);
        vm.prank(stranger);
        c.claim(pg);
        assertTrue(greedy.tried(), "the payee tried");
        assertEq(bytes32(greedy.claimRefusal()), bytes32(Transient.Reentrancy.selector),
            "a second claim inside the payout is refused by the lock");
        assertEq(bytes32(greedy.mintRefusal()), bytes32(Transient.Reentrancy.selector), "and so is a mint");
        assertEq(c.totalSupply(), 1, "nothing was minted inside the payout");
        assertEq(address(greedy).balance, PRICE, "the payee was paid once");
    }

    /*═══════════════════ royalties ═══════════════════*/

    function test_royaltyNamesTheCreatorsPayeeWhenAsked() public {
        (address to, uint256 amount) = moon.royaltyInfo(1, 1 ether);
        assertEq(to, hub.account(1), "the creator token's fee sink");
        assertEq(amount, 0.05 ether, "salePrice x royaltyBps / 10,000");
        vm.prank(alice);
        hub.setFeesToGrip(1, true);
        (to,) = moon.royaltyInfo(1, 1 ether);
        assertEq(to, hub.grip(1), "read when asked: the Grip once the holder chose it");
        vm.prank(alice);
        hub.transferFrom(alice, bob, 1);
        (to,) = moon.royaltyInfo(1, 1 ether);
        assertEq(to, hub.account(1), "and the Reach the buyer now holds, after the sale");
        // any other ERC-721: the holder of the moment
        Collection c = _launchFrom(carol, pn, _spec());
        (to,) = c.royaltyInfo(1, 1 ether);
        assertEq(to, carol, "a plain token's holder");
        vm.prank(carol);
        nft.transferFrom(carol, dave, 7);
        (to,) = c.royaltyInfo(1, 1 ether);
        assertEq(to, dave, "and its buyer after a sale");
        assertTrue(moon.supportsInterface(0x2a55205a), "ERC-2981 is claimed");
        assertTrue(moon.supportsInterface(0x80ac58cd), "ERC-721");
        assertTrue(moon.supportsInterface(0x5b5e139f), "ERC-721 metadata");
        assertTrue(moon.supportsInterface(0x01ffc9a7), "ERC-165");
        assertFalse(moon.supportsInterface(0xffffffff), "and nothing else");
    }

    /*═══════════════════ custody ═══════════════════*/

    function test_theCustodyEpochIsOneAtMintAndMovesOnEveryTransfer() public {
        assertEq(uint256(moon.custodyEpoch(1)), 0, "an unminted id has no epoch");
        _mint(moon, carol, carol, 0);
        assertEq(uint256(moon.custodyEpoch(1)), 1, "a mint is epoch 1");
        vm.prank(carol);
        moon.approve(dave, 1);
        assertEq(uint256(moon.custodyEpoch(1)), 1, "an approval moves nothing");
        vm.prank(carol);
        moon.transferFrom(carol, dave, 1);
        assertEq(uint256(moon.custodyEpoch(1)), 2, "a transfer moves it");
        vm.prank(dave);
        moon.safeTransferFrom(dave, carol, 1);
        assertEq(uint256(moon.custodyEpoch(1)), 3, "so does a safe transfer");
        vm.prank(carol);
        moon.setApprovalForAll(stranger, true);
        vm.prank(stranger);
        moon.safeTransferFrom(carol, carol, 1, "");
        assertEq(uint256(moon.custodyEpoch(1)), 4, "an operator's transfer, even to the same holder, moves it");
        _mint(moon, carol, carol, 0);
        assertEq(uint256(moon.custodyEpoch(2)), 1, "and a later mint starts at 1 again");
        assertEq(uint256(Persona.epochOf(Persona.pack(address(moon), 1))), 4, "lib/Persona reads the same epoch");
    }

    function test_theSeedIsTheCollectionTheIdAndThePreviousBlock() public {
        _mint(moon, carol, carol, 0);
        assertEq(moon.seedOf(1), keccak256(abi.encode(address(moon), uint256(1), blockhash(block.number - 1))),
            "seed = keccak(collection, id, the previous block's hash)");
        _mint(moon, carol, carol, 0);
        assertTrue(moon.seedOf(1) != moon.seedOf(2), "two tokens, two seeds");
        assertEq(moon.seedOf(3), bytes32(0), "an unminted id has none");
    }

    /*═══════════════════ the website ═══════════════════*/

    function test_everyHoleIsFilledWithTheChainsValue() public {
        _mint(moon, carol, carol, 0);
        journal.set(address(moon), 1, 7);
        vm.prank(carol);
        moon.transferFrom(carol, dave, 1);
        bytes memory want = abi.encodePacked(
            "1|", LibNum.hex32(moon.seedOf(1)), "|", LibNum.hexAddr(dave), "|2|7|1|100|", PRICE.str(), "|",
            LibNum.hexAddr(address(moon)), "|", p1.str(), "|", moon.room().str(), "|", block.chainid.str());
        assertEq(moon.pageOf(1), want, "each of the twelve holes holds the chain's value, in ASCII");
    }

    function test_tokenURIIsTheJSONOfTheFilledPageAndArt() public {
        _mint(moon, carol, carol, 0);
        bytes memory json = StudioCodec.payload(bytes(moon.tokenURI(1)), "data:application/json;base64,");
        assertTrue(json.length > 0, "tokenURI is base64 JSON");
        assertEq(StudioCodec.field(json, "name"), "Moonlit #1", "named by the collection and the id");
        assertEq(StudioCodec.field(json, "description"), "a map of the night it was minted", "described by the creator");
        assertEq(StudioCodec.payload(StudioCodec.field(json, "animation_url"), "data:text/html;base64,"), moon.pageOf(1),
            "animation_url is the filled page");
        assertEq(StudioCodec.payload(StudioCodec.field(json, "image"), "data:image/svg+xml;base64,"), moon.imageOf(1),
            "image is the filled art");
        assertTrue(StudioCodec.has(json, abi.encodePacked('"value":"', p1.str(), '"')), "the attributes name the creator persona");
        assertTrue(StudioCodec.has(json, abi.encodePacked('"value":"', moon.room().str(), '"')), "and the room");
        vm.expectRevert(abi.encodeWithSelector(ERC721Base.ERC721NonexistentToken.selector, uint256(2)));
        moon.tokenURI(2);
    }

    function test_theMemoriesAreTheJournalsCountOrNone() public {
        CollectionSpec memory s = _spec();
        s.page = "{{memories}}";
        Collection c = _launch(s, "memories");
        _mint(c, carol, carol, 0);
        assertEq(c.pageOf(1), "0", "no memories yet");
        journal.set(address(c), 1, 12);
        assertEq(c.pageOf(1), "12", "the Journal's countOf(this, id)");
        // a Journal that is not there, that reverts, or that answers short is "none"
        address[3] memory absent = [address(0x10A1), address(new StudioBrokenJournal()), address(new StudioShortJournal())];
        for (uint256 i; i < 3; ++i) {
            Studio other = new Studio(address(hub), absent[i], address(0xA60A));
            vm.prank(alice);
            Collection d = Collection(other.launch(p1, s, keccak256("memories")));
            _mint(d, carol, carol, 0);
            assertEq(d.pageOf(1), "0", "a codeless, reverting or silent Journal reads as no memories");
        }
    }

    function test_theRoomIsAgorasCollectionKey() public {
        assertEq(moon.room(), uint256(keccak256(abi.encodePacked(uint8(4), address(moon)))),
            "room = uint256(keccak256(abi.encodePacked(uint8(4), collection)))");
    }

    function test_noArtMeansTheDefaultOrb() public {
        _mint(moon, carol, carol, 0);
        _mint(moon, carol, carol, 0);
        bytes memory orb = moon.imageOf(1);
        assertEq(StudioCodec.find(orb, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">', 0), 0,
            "with no art the image is an SVG orb");
        assertTrue(keccak256(orb) != keccak256(moon.imageOf(2)), "seeded by each token's seed");
        CollectionSpec memory s = _spec();
        s.art = "<svg>#{{id}} {{holder}}</svg>";
        Collection c = _launch(s, "art");
        _mint(c, carol, carol, 0);
        assertEq(c.imageOf(1), abi.encodePacked("<svg>#1 ", LibNum.hexAddr(carol), "</svg>"), "with art the image is the art, filled");
    }

    function test_contractURINamesTheCollectionAndItsCreator() public {
        bytes memory json = StudioCodec.payload(bytes(moon.contractURI()), "data:application/json;base64,");
        assertEq(StudioCodec.field(json, "name"), "Moonlit");
        assertEq(StudioCodec.field(json, "creator"), bytes(p1.str()), "the creator persona");
        assertEq(StudioCodec.field(json, "room"), bytes(moon.room().str()), "and the room");
        assertEq(StudioCodec.find(StudioCodec.payload(StudioCodec.field(json, "image"), "data:image/svg+xml;base64,"), "<svg", 0), 0,
            "with an image of its own");
    }

    function test_metadataEscapesWhatTheCreatorTyped() public {
        CollectionSpec memory s = _spec();
        s.name = 'A "quoted" <name>';
        s.description = "line\\break</script>";
        Collection c = _launch(s, "escaped");
        _mint(c, carol, carol, 0);
        bytes memory json = StudioCodec.payload(bytes(c.tokenURI(1)), "data:application/json;base64,");
        assertTrue(StudioCodec.has(json, 'A \\"quoted\\" \\u003cname\\u003e #1'), "the name is a JSON string, markup escaped");
        assertTrue(StudioCodec.has(json, "line\\\\break\\u003c/script\\u003e"), "and so is the description");
        assertEq(bytes(c.name()), bytes('A "quoted" <name>'), "while name() is what the creator typed");
    }

    /// @dev The largest page and art the Studio admits, each with as many
    ///      of the widest hole as it admits, still render far under the
    ///      2^24 transaction cap an eth_call may also be held to.
    function test_theLargestTemplatesRenderFarUnderTheCap() public {
        CollectionSpec memory s = _spec();
        s.page = _holey(24_000, 256);
        s.art = _holey(12_000, 256);
        uint256 g0 = gasleft();
        Collection c = _launch(s, "largest");
        uint256 launchGas = g0 - gasleft();
        _mint(c, carol, carol, 0);
        g0 = gasleft();
        bytes memory uri = bytes(c.tokenURI(1));
        uint256 uriGas = g0 - gasleft();
        assertGt(uri.length, 100_000, "the document is whole");
        assertLt(uriGas, 8_000_000, "tokenURI of the worst admitted templates costs under 8 M gas");
        assertLt(launchGas, 16_000_000, "and their launch fits in one transaction");
    }

    function _holey(uint256 n, uint256 count) internal pure returns (bytes memory b) {
        b = new bytes(n);
        for (uint256 i; i < n; ++i) b[i] = "x";
        for (uint256 i; i < count; ++i) {
            bytes memory h = "{{room}}";
            for (uint256 j; j < 8; ++j) b[i * 8 + j] = h[j];
        }
    }
}

/*  lib/Template, the filler alone: exact names only, nothing past the end,
    and the fast word-at-a-time scan agreeing with the slowest possible
    reading of the rule on whatever the fuzzer draws.                    */
contract CollectionTemplateTest is Test {
    StudioTemplateProbe probe;

    function setUp() public {
        probe = new StudioTemplateProbe();
    }

    function _names() internal pure returns (bytes[12] memory) {
        return [bytes("id"), "seed", "holder", "epoch", "memories", "minted", "supply", "price", "collection", "creator", "room", "chain"];
    }

    function _vals() internal pure returns (bytes[12] memory) {
        return [bytes("1"), "0xseed", "0xholder", "2", "3", "4", "5", "6", "0xcollection", "7", "8", "9"];
    }

    function _fill(bytes memory t) internal view returns (bytes memory out) {
        (out,) = probe.fill(t, _vals());
    }

    function test_aHoleIsAnExactName() public view {
        assertEq(_fill("{{id}}"), "1", "a hole alone");
        assertEq(_fill("a{{id}}b{{seed}}c"), "a1b0xseedc", "holes between text");
        assertEq(_fill("{{id}}{{id}}"), "11", "two holes touching");
        assertEq(_fill("{{{id}}}"), "{1}", "a brace before and after a hole is text");
        assertEq(_fill("{{ id }}{{ID}}{{ids}}{{foo}}{{}}{{"), "{{ id }}{{ID}}{{ids}}{{foo}}{{}}{{", "anything but an exact name is text");
        assertEq(_fill("body{margin:0}a{b:{c}}"), "body{margin:0}a{b:{c}}", "CSS braces are text");
        assertEq(_fill(""), "", "an empty template is empty");
        (bytes memory out, uint256 holes) = probe.fill(
            "{{id}}{{seed}}{{holder}}{{epoch}}{{memories}}{{minted}}{{supply}}{{price}}{{collection}}{{creator}}{{room}}{{chain}}", _vals());
        assertEq(out, "10xseed0xholder234560xcollection789", "each of the twelve names is a hole");
        assertEq(holes, 12, "and each is counted");
    }

    function test_aHoleCutShortByTheEndIsText() public view {
        // the bytes after the cut still spell the rest of the hole in memory
        (bytes memory out, uint256 holes) = probe.fillCut("x{{id}}", 5, _vals());
        assertEq(out, "x{{id", "a hole the template's end cuts short is text");
        assertEq(holes, 0, "and is not counted");
        (out,) = probe.fillCut("x{{collection}}", 14, _vals());
        assertEq(out, "x{{collection}", "one byte short is still text");
        (out,) = probe.fillCut("x{{collection}}", 15, _vals());
        assertEq(out, "x0xcollection", "and the whole hole is a hole");
        (out,) = probe.fillCut("ab_{{id}}", 2, _vals());
        assertEq(out, "ab", "a brace in memory past the template's end is never read as part of it");
    }

    function test_aLongTemplateIsCopiedWordForWord() public view {
        // every byte value at every offset in a word, braces and NULs included
        bytes memory t = new bytes(2_048);
        for (uint256 i; i < t.length; ++i) t[i] = bytes1(uint8((i * 7 + i / 256) % 256));
        assertEq(_fill(t), _reference(t), "2,048 bytes of every value fill as the reference does");
        for (uint256 i; i < t.length; ++i) t[i] = bytes1(uint8(32 + (i * 7) % 90));
        assertEq(_fill(t), _reference(t), "and so do 2,048 printable ones, braces included");
    }

    /// @dev The rule read as slowly as it can be: at each position, try
    ///      every name; a match is replaced, anything else is one byte.
    function _reference(bytes memory t) internal pure returns (bytes memory out) {
        bytes[12] memory names = _names();
        bytes[12] memory vals = _vals();
        out = new bytes(2 * t.length + 32);   // no value here is longer than twice its hole
        uint256 o;
        uint256 p;
        while (p < t.length) {
            bool hit;
            for (uint256 k; k < 12 && !hit; ++k) {
                bytes memory h = abi.encodePacked("{{", names[k], "}}");
                if (p + h.length > t.length) continue;
                bool same = true;
                for (uint256 j; j < h.length; ++j) if (t[p + j] != h[j]) { same = false; break; }
                if (same) {
                    for (uint256 j; j < vals[k].length; ++j) out[o++] = vals[k][j];
                    p += h.length;
                    hit = true;
                }
            }
            if (!hit) out[o++] = t[p++];
        }
        assembly ("memory-safe") { mstore(out, o) }
    }

    /// @dev Each drawn byte becomes a hole, a lone brace, a closing brace,
    ///      a hole missing its close, or a letter: dense in near-misses.
    function test_theFillerAgreesWithTheSlowReading(bytes memory raw) public view {
        bytes[12] memory names = _names();
        uint256 n = raw.length > 300 ? 300 : raw.length;
        bytes memory t = new bytes(14 * n);
        uint256 o;
        for (uint256 i; i < n; ++i) {
            uint8 b = uint8(raw[i]);
            bytes memory piece;
            if (b < 48) piece = abi.encodePacked("{{", names[b % 12], "}}");
            else if (b < 96) piece = "{";
            else if (b < 120) piece = "}";
            else if (b < 136) piece = abi.encodePacked("{{", names[b % 12]);
            else piece = abi.encodePacked(bytes1(uint8(97 + b % 26)));
            for (uint256 j; j < piece.length; ++j) t[o++] = piece[j];
        }
        assembly ("memory-safe") { mstore(t, o) }
        assertEq(_fill(t), _reference(t), "the word-at-a-time filler is the rule");
    }
}
