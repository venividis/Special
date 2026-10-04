// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactFixture} from "./helpers/Deploy.sol";
import {MockPool, MockLaunchpad, MockSteward, MockRoles} from "./helpers/HubMocks.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {IIntact, Traits} from "../src/interfaces/IIntact.sol";
import {Market} from "../src/interfaces/IPool.sol";
import {KeyValue} from "../src/interfaces/Standards.sol";
import {TokenState} from "../src/interfaces/Site.sol";
import {IntactConfig} from "../src/hub/IntactBase.sol";
import {Reach} from "../src/Reach.sol";
import {Grip} from "../src/Grip.sol";
import {KeyRegistry} from "../src/KeyRegistry.sol";
import {Locks} from "../src/Locks.sol";
import {Engine} from "../src/Engine.sol";
import {Crest} from "../src/Crest.sol";
import {Catalog, CatalogRows, CatalogText, CatalogState, CatalogConfig} from "../src/Catalog.sol";
import {Renderer} from "../src/Renderer.sol";
import {Premises} from "../src/Premises.sol";
import {LibNum} from "../src/lib/LibNum.sol";

/*───────────────────────────────────────────────────────────────────────────
  The site, under the forge harness (INTACT U7)

  tools/verify.mjs and tools/verify-premises.mjs drive the real shell from
  dist/ through the in-process EVM and compare bytes. This suite proves
  the four sentences BUILD-PLAN names in Solidity, against the real hub
  (either build, by INTACT_IMPL), the real Reach and Grip, a tiny frozen
  engine, and satellites that are mocks or absent on purpose.

  The site contracts are deployed BEFORE the hub and pinned to its
  predicted address, exactly as tools/site.mjs and tools/deploy.mjs do it:
  the test contract's next CREATE addresses are computed from its nonce,
  found by deploying a probe and matching it. A test that mispredicts
  fails in setUp, which is the failure it is meant to have.
───────────────────────────────────────────────────────────────────────────*/

/// @dev A pool that answers `marketOf` with a market on a coin whose
///      symbol is hostile, for the escaping test; the fingerprint's
///      `marketHash` read is answered too.
contract ScriptPool {
    address public coin;
    bool public openMarketNow;
    function set(address c, bool o) external { coin = c; openMarketNow = o; }
    function marketOf(uint256) external view returns (Market memory m) {
        m.base = coin;
        m.quote = address(0);
        m.open = openMarketNow;
        m.feeBps = 30;
        m.rBase = 1000;
        m.rQuote = 1;
    }
    function marketHash(uint256) external pure returns (bytes32) { return bytes32(uint256(7)); }
    function spot(uint256) external pure returns (uint256) { return 0; }
    function openIds(uint256, uint256) external view returns (uint256[] memory ids) {
        if (!openMarketNow) return ids;
        ids = new uint256[](1);
        ids[0] = 1;
    }
}

/// @dev Enough of Parley for the Catalog to count it as present.
contract FakeParley {
    function stateOf(uint256) external pure returns (
        uint64, uint64, uint64, uint32, uint8, bool, uint256, uint256, uint32, uint64[4] memory, uint64[4] memory
    ) {
        uint64[4] memory z;
        return (0, 0, 0, 0, 3, true, 0, 0, 0, z, z);
    }
    function keyOf(uint256) external pure returns (uint16, bytes32, bytes memory) { return (0, 0, ""); }
}

contract Probe {}

abstract contract SiteFixture is IntactFixture {
    /// @dev A shell small enough to live in a test: the loader inflates it
    ///      in a browser; here only its bytes and its keccak matter.
    string internal constant DOC =
        "<!doctype html><html><head><meta charset=utf-8><title>INTACT</title></head><body>"
        "<script>const S=window.INTACT;document.body.textContent=\"INTACT #\"+S.id</script></body></html>";
    bytes internal constant GZ =
        hex"1f8b08000000000002032d8e410ac2301444af12eb524cb6823f01e9aa1b37ed0562f2a5812629cd94dadb8ba69b8181378fa193cf0efbcc62449c0c1dc9d61b8a0c2bdc6897c2d02bded79b21044c6cbae7f0680752b591aafc2bfbdd50714b98615c4e05a2d75b483e6fb22eee3ebb357282fcb112fc419b133841379510e7e6d2cbe0491d1e5255abfecfbe8d834be1af000000";
    string internal constant HEAD = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>INTACT</title></head><body>";
    address internal constant AGENTCARD0 = address(0x0A6e7Ca0);

    Reach reachReal;
    Grip gripReal;
    Engine engine;
    Crest crest;
    KeyRegistry keysReal;
    ScriptPool spool;
    Locks locksReal;
    CatalogRows rowsC;
    CatalogText text;
    CatalogState stateC;
    Catalog catalog_;
    Renderer renderer_;
    Premises premises_;
    address predictedHub;

    function setUpSite() internal {
        vm.warp(T0);
        vm.etch(REGISTRY, REGISTRY_RUNTIME);
        reachReal = new Reach();
        gripReal = new Grip();
        keysReal = new KeyRegistry();
        spool = new ScriptPool();
        launchpad = new MockLaunchpad();
        steward = new MockSteward();
        roles = new MockRoles();

        engine = new Engine();
        engine.loadHead(bytes(HEAD));
        engine.loadBody(GZ);
        for (uint256 i; i < 6; ++i) engine.loadPanel(i, GZ, keccak256(abi.encodePacked("panel", i)));
        engine.setEngineHash(keccak256(bytes(DOC)), uint32(bytes(DOC).length));
        engine.freeze();
        crest = new Crest();

        diamondBuild = keccak256(bytes(vm.envOr("INTACT_IMPL", "monolith"))) == keccak256("diamond");
        // Nonce n is the real Locks (it pins the hub, so the hub must be
        // predicted first); n+1..n+3 the Catalog's three companions; then
        // the Catalog, the Renderer, the Premises; then the hub — one
        // deployment on the monolith, four facets and the diamond on the
        // other build. The assertEqs below catch a shifted prediction.
        uint256 n = _myNonce();
        address pCatalog = _create(address(this), n + 4);
        address pRenderer = _create(address(this), n + 5);
        address pPremises = _create(address(this), n + 6);
        predictedHub = _create(address(this), diamondBuild ? n + 11 : n + 7);
        locksReal = new Locks(predictedHub);

        address[16] memory byLetter;                              // HPRYTSKNLCOWXEGQ
        byLetter[0] = predictedHub; byLetter[1] = address(spool); byLetter[3] = parley; byLetter[6] = address(keysReal);
        byLetter[8] = address(launchpad); byLetter[10] = address(locksReal); byLetter[11] = address(steward);
        byLetter[14] = address(engine); byLetter[15] = pCatalog;
        rowsC = new CatalogRows(byLetter);
        text = new CatalogText(rowsC);
        stateC = new CatalogState(text);
        catalog_ = new Catalog(_catalogConfig(pRenderer, pPremises));
        renderer_ = new Renderer(predictedHub, address(engine), address(crest), address(catalog_), AGENTCARD0);
        premises_ = new Premises(predictedHub, address(renderer_), address(engine), address(catalog_), address(crest), AGENTCARD0);
        assertEq(address(catalog_), pCatalog, "catalog prediction");
        assertEq(address(renderer_), pRenderer, "renderer prediction");
        assertEq(address(premises_), pPremises, "premises prediction");

        IntactConfig memory c = _hubConfig();
        hub = diamondBuild ? deployDiamond(c, PRICE) : deployMonolith(c, PRICE);
        assertEq(address(hub), predictedHub, "hub prediction");
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    /// @dev Field by field rather than as one literal: a 25-member struct
    ///      literal was one variable too deep for the stack, memoryguard
    ///      and all.
    function _catalogConfig(address pRenderer, address pPremises) internal view returns (CatalogConfig memory cc) {
        cc.hub = predictedHub;
        cc.engine = address(engine);
        cc.keys = address(keysReal);
        cc.agentCard = AGENTCARD0;
        cc.reachImpl = address(reachReal);
        cc.gripImpl = address(gripReal);
        cc.pool = address(spool);
        cc.parley = parley;
        cc.launchpad = address(launchpad);
        cc.locks = address(locksReal);
        cc.steward = address(steward);
        cc.market = market;
        cc.roles = address(roles);
        cc.timelock = timelock;
        cc.premises = pPremises;
        cc.renderer = pRenderer;
        cc.band = BAND;
        cc.bandLo = LO;
        cc.bandHi = HI;
        cc.text = text;
        cc.state = stateC;
    }

    function _hubConfig() internal view returns (IntactConfig memory c) {
        c.reachImpl = address(reachReal);
        c.gripImpl = address(gripReal);
        c.band = BAND;
        c.bandLo = LO;
        c.bandHi = HI;
        c.steward = address(steward);
        c.market = market;
        c.roles = address(roles);
        c.pool = address(spool);
        c.parley = parley;
        c.launchpad = address(launchpad);
        c.locks = address(locksReal);
        c.renderer = address(renderer_);
        c.catalog = address(catalog_);
        c.premises = address(premises_);
        c.timelock = timelock;
    }

    /// @dev The nonce this contract's next CREATE will use, found by
    ///      deploying a probe and matching its address rather than by
    ///      counting deployments by hand.
    function _myNonce() internal returns (uint256) {
        address probe = address(new Probe());
        for (uint256 n = 1; n < 4096; ++n) if (_create(address(this), n) == probe) return n + 1;
        revert("nonce not found");
    }

    /// @dev keccak256(rlp([sender, nonce]))[12:], for nonces under 2^16.
    function _create(address a, uint256 nonce) internal pure returns (address) {
        bytes memory rlp;
        if (nonce == 0) rlp = abi.encodePacked(hex"d694", a, hex"80");
        else if (nonce < 0x80) rlp = abi.encodePacked(hex"d694", a, uint8(nonce));
        else if (nonce < 0x100) rlp = abi.encodePacked(hex"d794", a, hex"81", uint8(nonce));
        else rlp = abi.encodePacked(hex"d894", a, hex"82", uint16(nonce));
        return address(uint160(uint256(keccak256(rlp))));
    }

    /*═══════════════════ ERC-5219 over the test ═══════════════════*/

    function get(string[] memory path) internal view returns (uint16 status, bytes memory body, KeyValue[] memory headers) {
        string memory b;
        (status, b, headers) = premises_.request(path, new KeyValue[](0));
        body = bytes(b);
    }

    function header(KeyValue[] memory h, string memory key) internal pure returns (string memory) {
        for (uint256 i; i < h.length; ++i) if (keccak256(bytes(h[i].key)) == keccak256(bytes(key))) return h[i].value;
        return "";
    }

    function path1(string memory a) internal pure returns (string[] memory p) { p = new string[](1); p[0] = a; }
    function path2(string memory a, string memory b) internal pure returns (string[] memory p) { p = new string[](2); p[0] = a; p[1] = b; }
    function path3(string memory a, string memory b, string memory c3) internal pure returns (string[] memory p) {
        p = new string[](3); p[0] = a; p[1] = b; p[2] = c3;
    }
    function path4(string memory a, string memory b, string memory c3, string memory d) internal pure returns (string[] memory p) {
        p = new string[](4); p[0] = a; p[1] = b; p[2] = c3; p[3] = d;
    }

    function has(bytes memory hay, bytes memory needle) internal pure returns (bool) {
        if (needle.length > hay.length) return false;
        for (uint256 i; i + needle.length <= hay.length; ++i) {
            bool same = true;
            for (uint256 j; j < needle.length; ++j) if (hay[i + j] != needle[j]) { same = false; break; }
            if (same) return true;
        }
        return false;
    }

    function count(bytes memory hay, bytes memory needle) internal pure returns (uint256 k) {
        for (uint256 i; i + needle.length <= hay.length; ++i) {
            bool same = true;
            for (uint256 j; j < needle.length; ++j) if (hay[i + j] != needle[j]) { same = false; break; }
            if (same) ++k;
        }
    }

    function hex4(bytes4 s) internal pure returns (bytes memory) {
        bytes memory h = bytes(LibNum.hex32(bytes32(s)));
        bytes memory o = new bytes(10);
        for (uint256 i; i < 10; ++i) o[i] = h[i];
        return o;
    }
}

contract PremisesTest is SiteFixture {
    function setUp() public { setUpSite(); }

    function test_resolveModeIs5219() public view {
        assertEq(premises_.resolveMode(), bytes32("5219"));
    }

    function test_manifestHashesRouteTemplatesNotIds() public {
        mintTo(alice);
        (uint16 status, bytes memory body, KeyValue[] memory h) = get(path1("manifest"));
        assertEq(uint256(status), 200);
        assertEq(header(h, "Content-Type"), "application/json");
        assertEq(count(body, bytes('"template":"')), 16, "sixteen route templates");
        assertTrue(has(body, bytes('{"template":"/token/<id>/live","keccak":"')), "the live route is a template");
        assertFalse(has(body, bytes("/token/1/")), "no concrete id anywhere");
        bytes memory eh = bytes(LibNum.hex32(keccak256(bytes(DOC))));
        assertTrue(has(body, abi.encodePacked('"engineHash":"', eh, '"')), "the engine hash is the keccak of the inflated shell");
        assertTrue(has(body, abi.encodePacked('"/token/<id>/live","keccak":"', eh, '"')), "the document routes hash the engine");
        assertTrue(has(body, abi.encodePacked('"catalogHash":"', bytes(LibNum.hex32(catalog_.catalogHash())), '"')));
        assertTrue(has(body, abi.encodePacked('"crestCodehash":"', bytes(LibNum.hex32(address(crest).codehash)), '"')));
        assertTrue(has(body, abi.encodePacked('"swap":"', bytes(LibNum.hex32(keccak256(abi.encodePacked("panel", uint256(0))))), '"')), "panel hashes by name");
        assertTrue(has(body, bytes('{"template":"/token/<id>/hash","keccak":"0x0000000000000000000000000000000000000000000000000000000000000000"}')), "a route that is only a hash pins nothing");
    }

    function test_anAbsentSatelliteSetsTheReportedBitClear() public {
        uint256 id = mintTo(alice);
        TokenState memory s = catalog_.stateOf(id);
        assertTrue(s.reported & 1 != 0, "the Reach reported");
        assertTrue(s.reported & 2 != 0, "the pool reported");
        assertTrue(s.reported & 4 == 0, "no Parley on this chain: the bit is clear, not zero");
        assertTrue(s.reported & 8 == 0, "no Postage either");
        assertTrue(s.reported & 16 != 0, "the locks reported");
        assertTrue(s.reported & 1024 != 0, "the key registry reported a zero key, which is a zero and not an absence");
        assertTrue(s.reported & 4096 == 0, "no AgentCard until U17");
        bytes memory st = catalog_.state(id);
        assertTrue(has(st, bytes('"home":null')), "the block says null for the home room, never a number");
        assertTrue(has(st, bytes('"locks":0,')), "and a reported zero is the number zero, unquoted");

        // give the chain a Parley: the same read now sets the bit
        vm.etch(parley, address(new FakeParley()).code);
        s = catalog_.stateOf(id);
        assertTrue(s.reported & 4 != 0, "the bit follows the code");
        assertTrue(has(catalog_.state(id), bytes('"home":{"room":"')), "and the block carries the room");
    }

    function test_aCoinNamedScriptTagCannotEndTheStateBlock() public {
        uint256 id = mintTo(alice);
        // 27 characters: Web._label truncates a symbol at MAX_LABEL (32),
        // and a truncated hostile symbol would prove less than a whole one.
        MockERC20 coin = new MockERC20("Hostile", "</script><script>x</script>", 18, 0, false);
        spool.set(address(coin), true);
        vm.prank(alice);
        hub.setTrait(id, Traits.NAME, bytes32("</script>x"));

        bytes memory st = catalog_.state(id);
        assertFalse(has(st, bytes("</script>")), "no closing tag inside the block");
        assertTrue(has(st, bytes('"baseSymbol":"\\u003c/script\\u003e\\u003cscript\\u003ex\\u003c/script\\u003e"')), "the symbol is escaped");
        assertTrue(has(st, bytes('"name":"\\u003c/script\\u003ex"')), "and so is the name trait");
        (, bytes memory live, ) = get(path3("token", "1", "live"));
        assertEq(count(live, bytes("</script>")), 2, "the document closes exactly its two scripts: the state and the loader");
        (, bytes memory sj, ) = get(path3("token", "1", "state.json"));
        assertEq(sj, st, "the JSON route serves the same bytes");
    }

    function test_theTwoSurfacesAreOneByteStream() public {
        uint256 id = mintTo(alice);
        (uint16 status, bytes memory live, KeyValue[] memory h) = get(path3("token", "1", "live"));
        assertEq(uint256(status), 200);
        assertEq(header(h, "Content-Type"), "text/html; charset=utf-8");
        assertEq(header(h, "Link"), "</token/1/services.json>; rel=\"service-desc\"");
        assertEq(live, renderer_.document(id), "the router serves the renderer's bytes");
        (, bytes memory hashes, ) = get(path3("token", "1", "hash"));
        assertTrue(has(hashes, abi.encodePacked('"document":"', bytes(LibNum.hex32(keccak256(live))), '"')), "the hash route hashes the live body");
        assertTrue(has(hashes, abi.encodePacked('"state":"', bytes(LibNum.hex32(keccak256(catalog_.state(id)))), '"')));
        assertTrue(has(live, bytes("<script>window.INTACT={")), "the state is a sibling script before the loader");
        assertTrue(has(live, bytes(HEAD)), "the prologue is served as loaded");
        (, bytes memory raw, ) = get(path3("token", "1", "raw"));
        assertEq(string(raw), hub.tokenURI(id));
    }

    function test_aRequestForNonsenseIsA404ThatNeverEchoesThePath() public {
        mintTo(alice);
        string[8] memory evil = [string("nonsense"), "<script>alert(1)</script>", "9999", "abc", "99999999999", "face", "wat", "01"];
        string[][] memory paths = new string[][](9);
        paths[0] = path1(evil[0]);
        paths[1] = path1(evil[1]);
        paths[2] = path2("token", evil[2]);
        paths[3] = path2("token", evil[3]);
        paths[4] = path2("token", evil[4]);
        paths[5] = path3("token", "1", evil[5]);
        paths[6] = path3("token", "1", evil[6]);
        paths[7] = path3("token", evil[7], "live");
        paths[8] = path1("token");
        for (uint256 i; i < paths.length; ++i) {
            (uint16 status, bytes memory body, ) = get(paths[i]);
            assertEq(uint256(status), 404, "a 404, not a revert");
            for (uint256 j; j < paths[i].length; ++j) {
                if (bytes(paths[i][j]).length > 2) assertFalse(has(body, bytes(paths[i][j])), "the path is never echoed");
            }
        }
    }

    function test_aFaceBeyondTheLastIsA404NotARevert() public {
        mintTo(alice);
        (uint16 s2, , ) = get(path4("token", "1", "face", "2"));
        assertEq(uint256(s2), 200, "face 2 answers (as face 1 until an AgentCard)");
        (uint16 s3, , ) = get(path4("token", "1", "face", "3"));
        assertEq(uint256(s3), 404, "face 3 of 3 is a 404");
        (uint16 s9, , ) = get(path4("token", "1", "face", "99"));
        assertEq(uint256(s9), 404);
        (uint16 sx, , ) = get(path4("token", "1", "face", "x"));
        assertEq(uint256(sx), 404);
        (uint16 s1, bytes memory f1, ) = get(path4("token", "1", "face", "1"));
        assertEq(uint256(s1), 200);
        assertEq(string(f1), hub.tokenURIAt(1, 1));
    }

    function test_oneResourceOneURL() public {
        mintTo(alice);
        (uint16 slash, , ) = get(path4("token", "1", "live", ""));
        assertEq(uint256(slash), 200, "a trailing slash is dropped");
        (uint16 zero, , ) = get(path3("token", "01", "live"));
        assertEq(uint256(zero), 404, "a leading zero is not a second address");
        (uint16 moved, , KeyValue[] memory h) = get(path2("token", "1"));
        assertEq(uint256(moved), 301, "/token/<id> moves to the console");
        assertEq(header(h, "Location"), "/token/1/live");
        assertEq(header(h, "Cache-Control"), "public, max-age=86400");
        (uint16 c2, , KeyValue[] memory h2) = get(path2("c", "1"));
        assertEq(uint256(c2), 301);
        assertEq(header(h2, "Location"), "/token/1/live");
        (uint16 c3, , ) = get(path2("c", "2"));
        assertEq(uint256(c3), 404, "an unminted id has no console to move to");
    }

    function test_theDoorRedirectsIntoSessionMode() public {
        mintTo(alice);
        (uint16 status, bytes memory body, KeyValue[] memory h) =
            get(path3("k", "1", "0xAbCdEf0123456789AbCdEf0123456789AbCdEf01"));
        assertEq(uint256(status), 301);
        assertEq(header(h, "Location"), "/token/1/live?as=0xabcdef0123456789abcdef0123456789abcdef01");
        assertTrue(has(body, bytes("/token/1/live?as=0xabcdef0123456789abcdef0123456789abcdef01")), "the body links the same door");
        (uint16 bad, , ) = get(path3("k", "1", "notakey"));
        assertEq(uint256(bad), 404);
        (uint16 two, , ) = get(path2("k", "1"));
        assertEq(uint256(two), 404, "the pair is the page");
    }

    function test_aPanelIsServedGzipWithItsHashAsETag() public {
        (uint16 status, bytes memory body, KeyValue[] memory h) = get(path2("panel", "swap.js"));
        assertEq(uint256(status), 200);
        assertEq(body, GZ, "the stored gzip bytes, as stored");
        assertEq(header(h, "Content-Encoding"), "gzip");
        assertEq(header(h, "Content-Type"), "text/javascript; charset=utf-8");
        assertEq(header(h, "ETag"), string.concat("\"", LibNum.hex32(keccak256(abi.encodePacked("panel", uint256(0)))), "\""));
        assertEq(header(h, "Cache-Control"), "public, max-age=86400");
        (uint16 agent, , KeyValue[] memory ha) = get(path2("panel", "agent.js"));
        assertEq(uint256(agent), 200);
        assertEq(header(ha, "ETag"), string.concat("\"", LibNum.hex32(keccak256(abi.encodePacked("panel", uint256(5)))), "\""));
        (uint16 nope, , ) = get(path2("panel", "nope.js"));
        assertEq(uint256(nope), 404);
        (uint16 bare, , ) = get(path2("panel", "swap"));
        assertEq(uint256(bare), 404, "the resource has one name");
    }

    function test_aFrozenEngineRefusesEveryLoad() public {
        assertTrue(engine.frozen());
        vm.expectRevert(Engine.IsFrozen.selector);
        engine.loadHead(bytes(HEAD));
        vm.expectRevert(Engine.IsFrozen.selector);
        engine.loadBody(GZ);
        vm.expectRevert(Engine.IsFrozen.selector);
        engine.loadPanel(0, GZ, bytes32(uint256(1)));
        vm.expectRevert(Engine.IsFrozen.selector);
        engine.setEngineHash(bytes32(uint256(1)), 1);
        vm.expectRevert(Engine.IsFrozen.selector);
        engine.dropLast(true);
        // and a fresh engine cannot freeze half-made
        Engine e2 = new Engine();
        vm.expectRevert(Engine.NothingLoaded.selector);
        e2.freeze();
        e2.loadHead(bytes(HEAD));
        e2.loadBody(GZ);
        e2.setEngineHash(keccak256(bytes(DOC)), uint32(bytes(DOC).length));
        vm.expectRevert(Engine.BadPanel.selector);
        e2.freeze();
    }

    function test_theCatalogAgreesWithTheHubAndAMispredictionIsVisible() public {
        (bool okAgree, bytes4 which) = catalog_.agrees();
        assertTrue(okAgree, "every pinned address matches the hub's");
        assertEq(bytes32(which), bytes32(0));
        // a Catalog built against a wrong pool prediction says which getter disagreed
        CatalogConfig memory cc = _catalogConfig(address(renderer_), address(premises_));
        cc.pool = address(0xBAD);
        Catalog wrong = new Catalog(cc);
        (bool okWrong, bytes4 w2) = wrong.agrees();
        assertFalse(okWrong);
        assertEq(bytes32(w2), bytes32(IIntact.POOL.selector));
        // the hashes of the two catalogs differ, because the pool's address is in services.json
        assertTrue(wrong.catalogHash() != catalog_.catalogHash());
    }

    function test_everySelectorInTheStateBlockIsComputedOnChain() public {
        uint256 id = mintTo(alice);
        bytes memory st = catalog_.state(id);
        assertTrue(has(st, abi.encodePacked('"hub.mint":"', hex4(IIntact.mint.selector), '"')), "hub.mint");
        assertTrue(has(st, abi.encodePacked('"pool.swapExactIn":"', hex4(bytes4(keccak256("swapExactIn(uint256,bool,uint256,uint256,address,uint64)"))), '"')), "pool.swapExactIn");
        assertTrue(has(st, abi.encodePacked('"reach.executeAsSession":"', hex4(bytes4(keccak256("executeAsSession(address,uint256,bytes)"))), '"')), "reach.executeAsSession");
        assertTrue(has(st, abi.encodePacked('"', hex4(bytes4(keccak256("NotHolder()"))), '":"NotHolder"')), "err");
        assertTrue(has(st, abi.encodePacked('"said":"', bytes(LibNum.hex32(keccak256("Said(uint256,uint256,uint64,uint64,uint64,uint8,uint64,uint64,bytes)"))), '"')), "topics.said");
        assertTrue(has(st, abi.encodePacked('"engineHash":"', bytes(LibNum.hex32(keccak256(bytes(DOC)))), '"')), "engineHash");
        assertTrue(has(st, abi.encodePacked('"catalogHash":"', bytes(LibNum.hex32(catalog_.catalogHash())), '"')), "catalogHash");
        assertEq(catalog_.catalogHash(), keccak256(catalog_.services()), "the pinned hash is the keccak of services.json");
        bytes memory before = catalog_.services();
        vm.prank(alice);
        hub.transferFrom(alice, bob, id);
        assertEq(catalog_.services(), before, "services.json is a property of the deployment, not of any token");
        assertTrue(has(catalog_.state(id), bytes('"epoch":2,"status":1,')), "the state block follows the sale");
    }

    function test_theCrestIsUnderFourKilobytesAndEscaped() public view {
        bytes memory svg = crest.svg(1, 1, 0, 0);
        assertLe(svg.length, 4096);
        assertTrue(has(svg, bytes("<svg xmlns=")), "is an svg");
        assertTrue(has(svg, bytes(">INTACT #1<")), "names the token");
        assertTrue(has(svg, bytes(">EPOCH 1 / ACTIVE<")), "prints the epoch and the status");
        assertTrue(has(svg, bytes(">UNSEALED<")), "prints the seal");
        assertFalse(has(svg, bytes("&")), "no label needed an entity, and none smuggled one");
        bytes memory paused = crest.svg(4096, 9, 1, uint64(T0 + 1 days));
        assertTrue(has(paused, bytes(">EPOCH 9 / PAUSED<")));
        assertTrue(has(paused, abi.encodePacked(">SEALED UNTIL ", bytes(LibNum.str(T0 + 1 days)), "<")));
        assertEq(count(paused, bytes("<rect x=")), 9, "nine rings for nine epochs");
        assertEq(count(crest.svg(1, 30, 1, 0), bytes("<rect x=")), 9, "and never more than nine");
        assertLe(paused.length, 4096);
    }
}
