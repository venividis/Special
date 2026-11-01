// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IStudio} from "./interfaces/IStudio.sol";
import {CollectionSpec} from "./interfaces/ICollection.sol";
import {Collection, CollectionInit} from "./Collection.sol";
import {Persona} from "./lib/Persona.sol";
import {SSTORE2} from "./lib/SSTORE2.sol";
import {Template} from "./lib/Template.sol";
import {Transient} from "./lib/Transient.sol";

/*───────────────────────────────────────────────────────────────────────────
  Studio — collections launched from tokens

  V2 (docs/V2.md §3.4, §5.4; src/interfaces/IStudio.sol), beside the coin
  launchpad, which stays. Its reasons:

  ── the creator is a token ──

  `launch(creator, spec, salt)` is called by whoever acts as the creator
  persona (lib/Persona `actsFor`: for a hub token its holder or its
  canonical Reach, never a renter, an operator or a session key directly;
  for any other ERC-721 its holder, read by a guarded staticcall). The
  collection's proceeds and royalty are owed to the persona and paid to
  its payee, so a collection is an asset of the token that launched it
  and changes hands with it. A token of a Studio collection can launch
  again; its collection is the new one's parent (`parentOf`), and the
  family tree is drawn from `Launched` logs.

  ── one address per (creator, salt), before the launch lands ──

  The collection lands where CREATE3 puts it: a sixteen-byte proxy is
  CREATE2'd from this contract under `keccak256(abi.encode(creator,
  salt))` and CREATEs the collection at its nonce 1 — the proxy shape and
  hash are lib/Create3Factory's, written out here. So the address is a
  function of this Studio, the creator and the salt alone (`predict`),
  whatever the spec, and a "mint yours" link can be shared before the
  launch is mined.

  Create3Factory gates `deploy` to its deployer and the Timelock, because
  the hub pins CREATE3 predictions of codeless satellites under public
  salts, and the first stranger to deploy under one would have become
  the hub's market. None of that can happen here. A salt is namespaced
  by the creator persona before it is hashed, and only whoever acts for
  that persona can launch under it: a stranger can spend salts only in
  namespaces of tokens they act for, so no one can occupy or burn an
  address someone else predicted. And nothing trusts a prediction before
  it lands: `isCollection` is written by `launch` alone, and the code at
  every address this Studio fills is the Collection's creation code,
  which the constructor wrote once and nothing can replace.

  ── the child's code is code, not the Studio's bytes ──

  A factory that embeds its child's creation code is as large as the
  child. The constructor writes `type(Collection).creationCode` once as
  an SSTORE2 shard (`CODE`; its keccak is `CODE_HASH`), and `launch`
  reads it back and appends the constructor's arguments. The Studio's
  runtime carries a pointer, so Studio and Collection are each measured
  against EIP-170 on their own. The templates travel the same way: the
  page and the art are written as SSTORE2 code here, and the collection
  is handed their pointers, which keeps its initcode under EIP-3860
  whatever the page's size.

  ── the spec is checked once, here ──

  Every bound is ICollection's struct comment, refused by name (Bad*),
  plus one the comment does not carry: a template may hold at most
  MAX_HOLES holes. A hole is at most 14 bytes and can print 78, so a
  24,000-byte page of nothing but holes would fill to ≈ 234 KB, and its
  `tokenURI`, base64 twice, would cost more gas than an eth_call is
  given; at 256 holes per template the worst `tokenURI` is a few million
  (docs/v2/W4-studio.md, measured). The count is lib/Template's, the
  matcher that fills at render.

  ── what this contract has no function to do ──

  No admin, no fee, no setter, no withdraw: `launch` is not payable and
  the Studio holds nothing after it returns. Its storage is the registry.

  Origin: NEW for INTACT V2 (unit W4). The CREATE3 hop is
  lib/Create3Factory's; the shard is lib/SSTORE2's.
───────────────────────────────────────────────────────────────────────────*/
contract Studio is IStudio {
    /// @notice The hub: a hub-token persona acts and is paid by its rules.
    address public immutable HUB;
    /// @notice The Journal every collection reads `{{memories}}` from.
    address public immutable JOURNAL;
    /// @notice Agora, whose `collectionKey` names every collection's room.
    address public immutable AGORA;
    /// @notice The Collection's creation code, held as SSTORE2 code.
    address public immutable CODE;
    /// @notice keccak256 of that creation code, for a reader to pin.
    bytes32 public immutable CODE_HASH;

    /*  The bounds, ICollection's struct comment as constants.  */
    uint256 public constant MAX_NAME = 48;
    uint256 public constant MAX_SYMBOL = 12;
    uint256 public constant MAX_DESCRIPTION = 1_024;
    uint256 public constant MAX_SUPPLY = 1_000_000;
    uint256 public constant MAX_REFERRAL_BPS = 2_000;
    uint256 public constant MAX_ROYALTY_BPS = 1_000;
    uint256 public constant MAX_PAGE = 24_000;
    uint256 public constant MAX_ART = 12_000;
    /// @notice The most holes one template may hold (see the header).
    uint256 public constant MAX_HOLES = 256;

    /// @dev lib/Create3Factory's proxy: sixteen bytes of initcode,
    ///      right-aligned in a word, and their keccak.
    uint256 private constant PROXY_INITCODE = 0x67363d3d37363d34f03d5260086018f3;
    bytes32 public constant PROXY_INITCODE_HASH =
        0x21c35dbe1b344a2488cf3321d6ce542f8e9f305544ff09e4993a62319a497c1f;

    /// @notice A pin was zero at construction.
    error ZeroAddress();

    mapping(address => bool) public isCollection;
    mapping(address => address) public parentOf;
    address[] private _all;
    mapping(uint256 => address[]) private _of;

    /// @param hub     the hub (required)
    /// @param journal the Journal; may be codeless until it lands
    /// @param agora   Agora; may be codeless until it lands
    constructor(address hub, address journal, address agora) {
        if (hub == address(0)) revert ZeroAddress();
        HUB = hub;
        JOURNAL = journal;
        AGORA = agora;
        bytes memory code = type(Collection).creationCode;
        CODE = SSTORE2.write(code);
        CODE_HASH = keccak256(code);
    }

    /*═══════════════════ launching ═══════════════════*/

    /// @notice Launch a collection from the `creator` token, at
    ///         `predict(creator, salt)`.
    function launch(uint256 creator, CollectionSpec calldata spec, bytes32 salt) external returns (address collection) {
        Transient.enter(Transient.STUDIO_LOCK);
        if (!Persona.actsFor(HUB, creator, msg.sender)) revert NotYours();
        _check(spec);
        collection = predict(creator, salt);
        if (collection.code.length != 0) revert SaltUsed(collection);

        address page = SSTORE2.write(spec.page);
        address art = spec.art.length == 0 ? address(0) : SSTORE2.write(spec.art);
        bytes memory init = abi.encodePacked(SSTORE2.read(CODE), abi.encode(CollectionInit({
            studio: address(this), hub: HUB, journal: JOURNAL, agora: AGORA, creator: creator,
            name: spec.name, symbol: spec.symbol, description: spec.description,
            supply: spec.supply, price: spec.price, opensAt: spec.opensAt, closesAt: spec.closesAt,
            perWallet: spec.perWallet, referralBps: spec.referralBps, royaltyBps: spec.royaltyBps,
            page: page, art: art
        })));

        /*  The proxy CREATEs whatever it is sent and keeps nothing of the
            outcome; the evidence is code at the predicted address. A
            proxy or a constructor that fails reverts the whole launch, so
            nothing half-lands and the salt stays usable.               */
        bytes32 s = _salt(creator, salt);
        address proxy;
        assembly ("memory-safe") {
            mstore(0x00, PROXY_INITCODE)
            proxy := create2(0, 0x10, 0x10, s)
        }
        if (proxy == address(0)) revert DeployFailed();
        (bool ok,) = proxy.call(init);
        if (!ok || collection.code.length == 0) revert DeployFailed();

        (address parent,) = Persona.split(creator);
        isCollection[collection] = true;
        parentOf[collection] = parent;
        _all.push(collection);
        _of[creator].push(collection);
        emit Launched(collection, creator, parent, spec.name, spec.symbol, spec.supply, spec.price);
        Transient.exit(Transient.STUDIO_LOCK);
    }

    /// @notice Where `launch(creator, …, salt)` lands, before or after the fact.
    function predict(uint256 creator, bytes32 salt) public view returns (address) {
        address proxy = address(uint160(uint256(keccak256(
            abi.encodePacked(bytes1(0xff), address(this), _salt(creator, salt), PROXY_INITCODE_HASH)))));
        // rlp([proxy, 1]) = 0xd6 0x94 <20 bytes> 0x01: a fresh contract's first CREATE
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", proxy, hex"01")))));
    }

    /*═══════════════════ reading ═══════════════════*/

    function collectionCount() external view returns (uint256) {
        return _all.length;
    }

    function collectionAt(uint256 index) external view returns (address) {
        return _all[index];
    }

    function collectionsOf(uint256 creator) external view returns (address[] memory) {
        return _of[creator];
    }

    /*═══════════════════ the spec ═══════════════════*/

    /// @dev Each field against ICollection's bound, in the struct's order.
    ///      The window's "opening" is the later of `opensAt` and now: a
    ///      collection that would be born closed is refused.
    function _check(CollectionSpec calldata spec) private view {
        uint256 n = bytes(spec.name).length;
        if (n == 0 || n > MAX_NAME) revert BadName();
        n = bytes(spec.symbol).length;
        if (n == 0 || n > MAX_SYMBOL) revert BadSymbol();
        if (bytes(spec.description).length > MAX_DESCRIPTION) revert BadDescription();
        if (spec.supply == 0 || spec.supply > MAX_SUPPLY) revert BadSupply();
        uint256 opening = spec.opensAt > block.timestamp ? spec.opensAt : block.timestamp;
        if (spec.closesAt != 0 && spec.closesAt <= opening) revert BadWindow();
        if (spec.referralBps > MAX_REFERRAL_BPS) revert BadShare();
        if (spec.royaltyBps > MAX_ROYALTY_BPS) revert BadShare();
        n = spec.page.length;
        if (n == 0 || n > MAX_PAGE || _holes(spec.page) > MAX_HOLES) revert BadPage();
        if (spec.art.length > MAX_ART || _holes(spec.art) > MAX_HOLES) revert BadArt();
    }

    /// @dev How many holes lib/Template would fill in `t`, by filling it
    ///      with empty values: the same matcher, so the same count.
    function _holes(bytes calldata t) private pure returns (uint256 count) {
        Template.Values memory none;
        (, count) = Template.fill(t, none);
    }

    function _salt(uint256 creator, bytes32 salt) private pure returns (bytes32) {
        return keccak256(abi.encode(creator, salt));
    }
}
