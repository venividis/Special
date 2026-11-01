// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICollection, CollectionSpec} from "./interfaces/ICollection.sol";
import {IERC165, IERC2981} from "./interfaces/Standards.sol";
import {ERC721Base} from "./lib/ERC721Base.sol";
import {Persona} from "./lib/Persona.sol";
import {SSTORE2} from "./lib/SSTORE2.sol";
import {Template} from "./lib/Template.sol";
import {Transient} from "./lib/Transient.sol";
import {Base64} from "./lib/Base64.sol";
import {LibNum} from "./lib/LibNum.sol";
import {Web} from "./lib/Web.sol";

/// @notice What the Studio hands a Collection's constructor: the spec it
///         checked, the four pins, and the two templates already written
///         as SSTORE2 code (`page`, and `art` or zero for the default orb).
struct CollectionInit {
    address studio;
    address hub;
    address journal;
    address agora;
    uint256 creator;
    string name;
    string symbol;
    string description;
    uint32 supply;
    uint128 price;
    uint64 opensAt;
    uint64 closesAt;
    uint32 perWallet;
    uint16 referralBps;
    uint16 royaltyBps;
    address page;
    address art;
}

/*───────────────────────────────────────────────────────────────────────────
  Collection — a collection whose every token is a website

  V2 (docs/V2.md §3.4, §5; src/interfaces/ICollection.sol). The Studio
  deploys one per launch, from a token. Its reasons:

  ── every token is a doorway ──

  `tokenURI` is JSON whose `animation_url` is the creator's page template
  and whose `image` is the art template (or a default orb), both filled
  for that token on chain at the moment they are asked: its id, seed,
  holder, custody epoch, memory count (the Journal's), how many are
  minted, the supply and price, this address, the creator persona, the
  room and the chain. Marketplaces and wallets render `animation_url`
  HTML, so wherever the token is shown its site is shown, carrying the
  room and "mint yours" — with no server, no host and no wallet. The holes
  are values, never markup (lib/Template): the page cannot be turned
  against its viewer by anything a stranger controls.

  ── money is owed to personas, and follows them ──

  A mint pays exactly `price`. A referral share (`via`, a persona) is owed
  to the referring token unless its payee is the minter or the recipient
  — a token cannot refer its own payee — and the rest to the creator
  persona. Nothing is pushed during a mint: `claim(persona)` is anyone's
  and pays that persona's payee AT THE MOMENT OF THE CLAIM (lib/Persona:
  a hub token's fee sink, any other token's holder), so a sale of the
  token sells what it is owed, as `Locks.release` pays the beneficiary
  and never the caller. ERC-2981 names the creator's payee when it is
  asked, by the same rule.

  ── custody ──

  The custody epoch is 1 at mint and moves on every transfer, in
  `_beforeMove` (lib/ERC721Base), so Agora's cooldowns and key bindings
  and the Journal's stamps die with a sale exactly as they do on the hub.
  It is stored as the number of moves and read as moves + 1: the mint
  writes nothing for it (one fewer cold slot per mint), and an id that
  was never minted reads 0, "no epoch", as on the hub.

  ── what this contract has no function to do ──

  No owner, no admin, no fee, no pause, no setter, no withdraw, no
  upgrade. Every term is an immutable or written once in the constructor;
  the templates are code. Ether leaves only through `claim`, to a payee,
  for what `owed` says. The one lock (COLLECTION_LOCK) covers mint and
  claim, so a payee called by `claim` can neither claim nor mint again
  inside its own payout.

  Origin: NEW for INTACT V2 (unit W4). The pull ledger is Market's; the
  ERC-721 is the shared lib/ERC721Base; the data: URIs are the Renderer's
  shape (base64 JSON around base64 documents).
───────────────────────────────────────────────────────────────────────────*/
contract Collection is ERC721Base, ICollection {
    using LibNum for uint256;

    /// @notice The Studio that launched this collection: its registry
    ///         (`isCollection`) is what admits these tokens to Agora's commons.
    address public immutable STUDIO;
    /// @notice The hub, for lib/Persona: a hub-token persona acts and is
    ///         paid by the hub's rules.
    address public immutable HUB;
    /// @notice Where `{{memories}}` is read; may be codeless (it reads 0).
    address public immutable JOURNAL;
    /// @notice Agora, recorded for the page; the room key needs no call.
    address public immutable AGORA;

    uint256 private immutable CREATOR;
    uint32 private immutable SUPPLY;
    uint128 private immutable PRICE;
    uint64 private immutable OPENS;
    uint64 private immutable CLOSES;
    uint32 private immutable PER_WALLET;
    uint16 private immutable REFERRAL_BPS;
    uint16 private immutable ROYALTY_BPS;
    /// @dev The referral share of one mint, `PRICE × REFERRAL_BPS / 10,000`,
    ///      fixed because both terms are.
    uint256 private immutable SHARE;
    address private immutable PAGE;
    address private immutable ART;
    /// @dev Agora's `collectionKey(this)`, `keccak256(abi.encodePacked(uint8(4), this))`.
    uint256 private immutable ROOM;

    string private _name;
    string private _symbol;
    string private _description;

    uint256 private _minted;
    /// @dev Transfers since the mint; the custody epoch is this plus one.
    mapping(uint256 => uint64) private _moves;

    /// @notice The seed of each token: `keccak256(abi.encode(this, id,
    ///         blockhash(block.number - 1)))`, written at mint.
    mapping(uint256 => bytes32) public seedOf;
    /// @notice Mints made by each address (`msg.sender`), for `perWallet`.
    mapping(address => uint32) public mintedBy;
    /// @notice What each persona is owed and has not claimed. Pull, never push.
    mapping(uint256 => uint256) public owed;

    constructor(CollectionInit memory i) {
        STUDIO = i.studio;
        HUB = i.hub;
        JOURNAL = i.journal;
        AGORA = i.agora;
        CREATOR = i.creator;
        SUPPLY = i.supply;
        PRICE = i.price;
        OPENS = i.opensAt;
        CLOSES = i.closesAt;
        PER_WALLET = i.perWallet;
        REFERRAL_BPS = i.referralBps;
        ROYALTY_BPS = i.royaltyBps;
        SHARE = uint256(i.price) * i.referralBps / 10_000;
        PAGE = i.page;
        ART = i.art;
        ROOM = uint256(keccak256(abi.encodePacked(uint8(4), address(this))));
        _name = i.name;
        _symbol = i.symbol;
        _description = i.description;
    }

    /*═══════════════════ minting ═══════════════════*/

    /// @notice Mint the next token to `to`, paying exactly the price.
    ///         `via` is the referring persona, or 0.
    /// @dev    The refusals in the order a page checks them: the window,
    ///         the supply, the price, the minter's limit; a zero `to` is
    ///         refused by `_mint`. The referral is read with a staticcall
    ///         (lib/Persona), so nothing outside can run under the lock.
    function mint(address to, uint256 via) external payable returns (uint256 id) {
        Transient.enter(Transient.COLLECTION_LOCK);
        if (block.timestamp < OPENS) revert NotOpen(OPENS);
        if (CLOSES != 0 && block.timestamp >= CLOSES) revert Closed(CLOSES);
        if (_minted >= SUPPLY) revert SoldOut();
        if (msg.value != PRICE) revert WrongPrice(PRICE, msg.value);
        uint32 count = mintedBy[msg.sender];
        if (PER_WALLET != 0 && count >= PER_WALLET) revert WalletLimit(PER_WALLET);
        mintedBy[msg.sender] = count + 1;

        id = ++_minted;
        seedOf[id] = keccak256(abi.encode(address(this), id, blockhash(block.number - 1)));

        /*  The share goes to the referring token only when its payee is
            somebody else: neither the address paying nor the one
            receiving. Otherwise it stays with the creator, so a referral
            is never a discount the minter grants itself.               */
        uint256 share;
        if (via != 0) {
            address payee = Persona.payeeOf(HUB, via);
            if (payee != address(0) && payee != msg.sender && payee != to) {
                share = SHARE;
                owed[via] += share;
            }
        }
        owed[CREATOR] += PRICE - share;

        _mint(to, id);
        emit Minted(id, to, via, msg.value, share);
        Transient.exit(Transient.COLLECTION_LOCK);
    }

    /// @notice Pay `persona`'s payee everything it is owed. Anyone may call;
    ///         only the payee is paid, and the payee is read now.
    function claim(uint256 persona) external returns (uint256 amount) {
        Transient.enter(Transient.COLLECTION_LOCK);
        amount = owed[persona];
        if (amount == 0) revert NothingOwed();
        address payee = Persona.payeeOf(HUB, persona);
        if (payee == address(0)) revert NoPayee(persona);
        owed[persona] = 0;
        (bool ok,) = payee.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Claimed(persona, payee, amount);
        Transient.exit(Transient.COLLECTION_LOCK);
    }

    /// @dev Every change of owner after the mint moves the custody epoch.
    function _beforeMove(address from, address, uint256 id) internal override {
        if (from != address(0)) {
            unchecked { ++_moves[id]; }
        }
    }

    /*═══════════════════ reading ═══════════════════*/

    function custodyEpoch(uint256 id) public view returns (uint64) {
        return _exists(id) ? _moves[id] + 1 : 0;
    }

    function totalSupply() external view returns (uint256) {
        return _minted;
    }

    function creator() external view returns (uint256 persona) {
        return CREATOR;
    }

    function room() external view returns (uint256) {
        return ROOM;
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    /// @notice The terms this collection was launched with, templates
    ///         included, read back from their code.
    function spec() external view returns (CollectionSpec memory s) {
        s.name = _name;
        s.symbol = _symbol;
        s.description = _description;
        s.supply = SUPPLY;
        s.price = PRICE;
        s.opensAt = OPENS;
        s.closesAt = CLOSES;
        s.perWallet = PER_WALLET;
        s.referralBps = REFERRAL_BPS;
        s.royaltyBps = ROYALTY_BPS;
        s.page = SSTORE2.read(PAGE);
        if (ART != address(0)) s.art = SSTORE2.read(ART);
    }

    /// @notice ERC-2981: the creator persona's payee at the moment asked.
    function royaltyInfo(uint256, uint256 salePrice) external view returns (address receiver, uint256 royaltyAmount) {
        receiver = Persona.payeeOf(HUB, CREATOR);
        royaltyAmount = salePrice * ROYALTY_BPS / 10_000;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Base, IERC165) returns (bool) {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }

    /*═══════════════════ the website ═══════════════════*/

    /// @notice The token's page: the page template filled for it now.
    function pageOf(uint256 id) public view returns (bytes memory page) {
        (page,) = Template.fill(SSTORE2.read(PAGE), _values(id));
    }

    /// @notice The token's image: the art template filled for it now, or
    ///         the default orb its seed draws.
    function imageOf(uint256 id) public view returns (bytes memory) {
        return _image(_values(id), seedOf[id]);
    }

    /// @notice ERC-721 metadata: the page as `animation_url`, the image as
    ///         `image`, both data: URIs, inside base64 JSON.
    function tokenURI(uint256 id) external view returns (string memory) {
        Template.Values memory v = _values(id);
        (bytes memory page,) = Template.fill(SSTORE2.read(PAGE), v);
        return _json(abi.encodePacked(
            '{"name":"', Web.jsonEsc(_name), " #", v.id, '",',
            '"description":"', Web.jsonEsc(_description), '",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(_image(v, seedOf[id])), '",',
            '"animation_url":"data:text/html;base64,', Base64.encode(page), '",',
            '"attributes":[{"trait_type":"Custody epoch","display_type":"number","value":', v.epoch,
            '},{"trait_type":"Memories","display_type":"number","value":', v.memories,
            '},{"trait_type":"Creator","value":"', v.creator,
            '"},{"trait_type":"Room","value":"', v.room,
            '"},{"trait_type":"Seed","value":"', v.seed, '"}]}'
        ));
    }

    /// @notice ERC-7572: the collection itself, its face drawn from the
    ///         collection's own seed (the art filled for no token, id 0).
    function contractURI() external view returns (string memory) {
        bytes32 seed = keccak256(abi.encode(address(this)));
        Template.Values memory v = _valuesFor(0, address(0), seed, 0, 0);
        return _json(abi.encodePacked(
            '{"name":"', Web.jsonEsc(_name), '",',
            '"symbol":"', Web.jsonEsc(_symbol), '",',
            '"description":"', Web.jsonEsc(_description), '",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(_image(v, seed)), '",',
            '"creator":"', v.creator, '","room":"', v.room, '","supply":', v.supply,
            ',"minted":', v.minted, ',"price":"', v.price, '","studio":"', LibNum.hexAddr(STUDIO), '"}'
        ));
    }

    /*═══════════════════ the holes ═══════════════════*/

    /// @dev The twelve values for a minted token; `ownerOf` refuses any other.
    function _values(uint256 id) private view returns (Template.Values memory) {
        address holder = ownerOf(id);
        return _valuesFor(id, holder, seedOf[id], custodyEpoch(id), _memories(id));
    }

    function _valuesFor(uint256 id, address holder, bytes32 seed, uint256 epoch, uint256 memories)
        private view returns (Template.Values memory v)
    {
        v.id = bytes(id.str());
        v.seed = bytes(LibNum.hex32(seed));
        v.holder = bytes(LibNum.hexAddr(holder));
        v.epoch = bytes(epoch.str());
        v.memories = bytes(memories.str());
        v.minted = bytes(_minted.str());
        v.supply = bytes(uint256(SUPPLY).str());
        v.price = bytes(uint256(PRICE).str());
        v.collection = bytes(LibNum.hexAddr(address(this)));
        v.creator = bytes(CREATOR.str());
        v.room = bytes(ROOM.str());
        v.chain = bytes(block.chainid.str());
    }

    /// @dev `Journal.countOf(this, id)` by `extcodesize` and a low-level
    ///      staticcall: a codeless or reverting Journal, or a short answer,
    ///      is "no memories", never a revert of the page.
    function _memories(uint256 id) private view returns (uint256 n) {
        address j = JOURNAL;
        if (j.code.length == 0) return 0;
        (bool ok, bytes memory ret) = j.staticcall(abi.encodeWithSignature("countOf(address,uint256)", address(this), id));
        if (ok && ret.length >= 32) n = abi.decode(ret, (uint256));
    }

    function _image(Template.Values memory v, bytes32 seed) private view returns (bytes memory art) {
        if (ART == address(0)) return _orb(seed);
        (art,) = Template.fill(SSTORE2.read(ART), v);
    }

    function _json(bytes memory body) private pure returns (string memory) {
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(body)));
    }

    /*  The default orb: the V2 prototype's sphere (a radial gradient in two
        hues, a highlight, a dashed orbit with one satellite turning), its
        hues, radius, orbit and period drawn from the first five bytes of
        the seed, so two tokens rarely share one. The default page draws
        the same two hues from {{seed}}: hue A = byte0 × 360 / 256 and
        hue B = (A + 60 + byte1 mod 120) mod 360.                       */
    function _orb(bytes32 seed) private pure returns (bytes memory) {
        uint256 s = uint256(seed);
        uint256 a = (s >> 248) * 360 >> 8;
        uint256 b = (a + 60 + ((s >> 240) & 0xff) % 120) % 360;
        uint256 r = 76 + ((s >> 232) & 0xff) % 56;
        uint256 ring = r + 22 + ((s >> 224) & 0xff) % 36;
        string memory hb = b.str();
        return abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">'
            '<defs><radialGradient id="o" cx="35%" cy="30%" r="75%">'
            '<stop offset="0" stop-color="hsl(', hb, ',90%,82%)"/>'
            '<stop offset=".55" stop-color="hsl(', a.str(), ',75%,58%)"/>'
            '<stop offset="1" stop-color="hsl(', a.str(), ',70%,22%)"/></radialGradient></defs>'
            '<rect width="400" height="400" fill="#07060d"/>'
            '<g><circle cx="200" cy="200" r="', ring.str(), '" fill="none" stroke="hsl(', hb,
            ',80%,72%)" stroke-opacity=".3" stroke-dasharray="2 7"/><circle cx="', (200 + ring).str(),
            '" cy="200" r="7" fill="hsl(', hb, ',85%,78%)"/><animateTransform attributeName="transform" '
            'type="rotate" from="0 200 200" to="360 200 200" dur="', (24 + ((s >> 216) & 0xff) % 40).str(),
            's" repeatCount="indefinite"/></g><circle cx="200" cy="200" r="', r.str(), '" fill="url(#o)"/>'
            '<circle cx="', (200 - r * 3 / 10).str(), '" cy="', (200 - r * 4 / 10).str(), '" r="', (r / 5).str(),
            '" fill="#fff" opacity=".25"/></svg>'
        );
    }
}
