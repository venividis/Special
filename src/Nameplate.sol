// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIntact} from "./interfaces/IIntact.sol";
import {LibNum} from "./lib/LibNum.sol";

/// @dev The one read of the ENS registry this resolver makes: who the
///      registry says owns a node. For a wrapped name that is the
///      NameWrapper, and nothing else is ever believed.
interface IEnsRegistry {
    function owner(bytes32 node) external view returns (address);
}

/// @dev The .eth registrar's clock. `nameExpires` takes the LABEL's hash —
///      `keccak("intact")`, not the namehash of `intact.eth`. They are
///      different bytes and mixing them returns zero, which reads exactly
///      like a name nobody has registered.
interface IEthRegistrar {
    function nameExpires(uint256 id) external view returns (uint256);
}

/// @dev The two reads of the NameWrapper: who holds a wrapped name, and the
///      wire-format name the wrapper stores for every node it has wrapped
///      (so a bare node can be given back its second-level label).
interface INameWrapper {
    function ownerOf(uint256 id) external view returns (address);
    function names(bytes32 node) external view returns (bytes memory);
}

/// @dev ERC-6551: an account says which token it belongs to. Both of this
///      collection's accounts answer it — the Reach, which spends, and the
///      Grip, which cannot.
interface IBoundAccount {
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);
}

/*═══════════════════════════════════════════════════════════════════════════

  THE NAMEPLATE — an ENS resolver for `intact.eth` that nobody administers

  Origin: IPSEITY src/Nameplate.sol, adapted for INTACT U18 (DESIGN.md §3
  row 30, §12 band 0). The donor's stored bindings (`bind`, `claimParent`),
  its station table for other chains, its gateway table and its write-once
  renewer are gone: this contract has no setter, no admin and no storage
  at all. What remains is the donor's strongest idea, and it is the whole
  contract:

  ── custody IS the binding ──

  A wrapped ENS name is an ERC-1155 token in the NameWrapper. Put that
  token into an Intact's Reach and the name means that Intact — with no
  transaction here and nothing to remember. Sell the Intact and the name
  goes with it, because the name was never yours separately from the
  token (DESIGN §2, "what survives: the name"). Put it in the Grip and it
  is the token's permanently, which is a promise worth making
  deliberately and never by accident.

  The apex `intact.eth` is a name like any other. The resolver answers
  for it, and for every numeric wildcard `<id>.intact.eth` under it, only
  while three things the chain says are all true at the block of the
  query:

    (a) the ENS registry names the canonical NameWrapper as the apex's
        owner — a contract that merely claims to be the wrapper, or plain
        registry control, binds nothing;
    (b) that wrapper says the apex is held by a canonical account of THIS
        hub on THIS chain: the holder must implement `token()`, name this
        hub, and be exactly `hub.account(id)` or `hub.grip(id)` — an
        account's own word is not enough, since any contract can say it
        belongs to token 3073;
    (c) the .eth registrar says the registration has not expired:
        `nameExpires(keccak("intact")) > block.timestamp`, read live and
        never stored. In the grace period the wrapper still names the
        holder and this resolver already answers nothing; renewal is
        permissionless in ENS, so anyone who pays revives the name.

  So the operator's whole deployment is: register and wrap the name, set
  its resolver to this contract, and transfer the wrapper token into the
  Reach of the token that should own the name (docs/DEPLOYMENT.md). From
  that block `web3://intact.eth/token/3073/live` opens the site, and
  `<id>.intact.eth` exists for every id of the band the moment it is
  minted. Move the token out of the Reach and everything falls silent in
  the same block. Nothing was written here, so nothing can go stale.

  ── what a name answers ──

    addr(node)                    the token's Reach (`hub.account(id)`), so
                                  sending ETH to the name funds the token's
                                  acting account — the donor's choice, kept
    addr(node, 60)                the same, in ENSIP-9 form
    text(node,"contentcontract")  the Premises as `eth:0x…` — ERC-6821 with
                                  the ERC-3770 chain prefix, so a web3://
                                  client opens the chain-served site with
                                  no IPFS and no gateway
    text(node,"avatar")           `eip155:1/erc721:<hub>/<id>`, the NFT
                                  reference every ENS app knows how to draw
    text(node,"url")              the web3:// address of the token's page
    contenthash(node)             empty: this site is not on IPFS, it is
                                  the chain; ERC-6821 clients read the
                                  contentcontract record first
    resolve(name, data)           ENSIP-10: the same answers for a wire-
                                  format name, which is how `<id>.intact.eth`
                                  is reached — the registry has no record
                                  for it, so a client walks up to the apex,
                                  finds this resolver, and asks it

  An id outside the band, an unminted id, a name nobody holds, a lapsed
  registration: every one answers the empty answer of its record type —
  the zero address, the empty string, empty bytes — never a revert. A
  wildcard walk that reverts is a name that does not exist; a name that
  answers nothing is a name that exists and is not bound.

  ── the Sepolia wrapper (I PR #26) ──

  The NameWrapper is a different contract on every chain that has one
  (mainnet 0xD4416b13…, Sepolia 0x0635513f…, the one-line fix the donor
  never merged), so it is a constructor argument asserted to hold code,
  never a constant. tools/ens-name.mjs carries the table.

═══════════════════════════════════════════════════════════════════════════*/
contract Nameplate {
    using LibNum for uint256;

    IIntact      public immutable HUB;
    /// @notice The site, which is what a name serves: ERC-6821's answer.
    address      public immutable PREMISES;
    IEnsRegistry public immutable ENS;
    address      public immutable WRAPPER;
    address      public immutable REGISTRAR;
    /// @notice keccak256 of the apex label ("intact"): the registrar's key for its expiry.
    bytes32      public immutable APEX_LABEL;
    /// @notice namehash of the apex ("intact.eth"): the parent of every numeric wildcard.
    bytes32      public immutable APEX;
    /// @notice The band this resolver answers for, read from the hub at construction.
    uint256      public immutable BAND_LO;
    uint256      public immutable BAND_HI;

    /// @dev namehash("eth"): the node whose owner IS the .eth registrar.
    bytes32 private constant ETH_NODE = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;

    bytes4 private constant ERC165       = 0x01ffc9a7;
    bytes4 private constant ADDR_IFACE   = 0x3b3b57de; // addr(bytes32)
    bytes4 private constant ADDR_MULTI   = 0xf1cb7e06; // addr(bytes32,uint256)
    bytes4 private constant CONTENTHASH  = 0xbc1c58d1; // contenthash(bytes32)
    bytes4 private constant TEXT_IFACE   = 0x59d1d43c; // text(bytes32,string)
    bytes4 private constant WILDCARD     = 0x9061b923; // resolve(bytes,bytes)
    uint256 private constant COIN_ETH    = 60;
    uint256 private constant MAX_LABELS  = 16;

    error NothingThere();
    error WrongRegistrar();
    error BadLabel();

    /// @param label the apex's bare label — "intact", not "intact.eth".
    constructor(address hub, address premises, address ens, address wrapper, address registrar, string memory label) {
        if (hub.code.length == 0 || premises.code.length == 0 || ens.code.length == 0
            || wrapper.code.length == 0 || registrar.code.length == 0) revert NothingThere();
        /*  The registry is the authority on which registrar is current, so
            the one pinned here must be the one it names at construction —
            a resolver reading expiries off a registrar ENS has retired
            would answer for names that lapsed years ago.               */
        if (IEnsRegistry(ens).owner(ETH_NODE) != registrar) revert WrongRegistrar();
        bytes memory l = bytes(label);
        if (l.length == 0 || l.length > 63) revert BadLabel();
        for (uint256 i; i < l.length; ++i) if (l[i] == ".") revert BadLabel();
        HUB = IIntact(hub);
        PREMISES = premises;
        ENS = IEnsRegistry(ens);
        WRAPPER = wrapper;
        REGISTRAR = registrar;
        APEX_LABEL = keccak256(l);
        APEX = keccak256(abi.encodePacked(ETH_NODE, keccak256(l)));
        BAND_LO = IIntact(hub).BAND_LO();
        BAND_HI = IIntact(hub).BAND_HI();
    }

    /*═══════════════ custody, which needs no transaction ═══════════════*/

    /// @notice Which token holds this name's wrapper token, and whether it
    ///         sits in the Grip. Zero when a wallet holds it, when some
    ///         other collection's account does, when the registry does not
    ///         hand the node to the canonical wrapper, or when the wrapper
    ///         says nobody holds it (which it says past the grace period).
    function heldBy(bytes32 node) public view returns (uint256 id, bool inGrip) {
        /*  Registry control is not custody: a .eth registrant can reclaim
            a node from its registry owner at any time, and any contract
            can be named there. Only the one canonical wrapper can attest
            who owns the name token, so the registry's owner must BE that
            wrapper, and it is the one asked — never whatever the registry
            happens to name, which was the donor's original hole.      */
        address wrapper = ENS.owner(node);
        if (wrapper != WRAPPER) return (0, false);
        (bool ok, bytes memory ret) = wrapper.staticcall(
            abi.encodeWithSelector(INameWrapper.ownerOf.selector, uint256(node)));
        if (!ok || ret.length != 32) return (0, false);
        address o = abi.decode(ret, (address));
        if (o.code.length == 0) return (0, false);

        (ok, ret) = o.staticcall(abi.encodeWithSelector(IBoundAccount.token.selector));
        if (!ok || ret.length < 96) return (0, false);
        (uint256 chainId, address coll, uint256 t) = abi.decode(ret, (uint256, address, uint256));
        if (chainId != block.chainid || coll != address(HUB) || t == 0) return (0, false);

        /*  The account's own word, checked against the hub that derives
            these addresses. Any contract can implement `token()` and say
            it is token 3073's; exactly two addresses actually are.     */
        if (HUB.grip(t) == o) return (t, true);
        if (HUB.account(t) == o) return (t, false);
        return (0, false);
    }

    /*═══════════ time, which the grip cannot stop ═══════════

      A .eth name is rented. The Grip guarantees that nobody can take a
      name out of a token and guarantees nothing about the calendar: let
      the registration lapse and the registrar reissues the name to
      whoever pays, and it leaves the Grip without anybody sending
      anything. So the clock is read from the registrar on every query,
      keyed by the label's hash, and a lapsed name answers nothing from
      the first second — not from the end of the grace period, when the
      wrapper would have said so by itself and a month too late.       */

    /// @notice When the registrar says the .eth registration under
    ///         `labelhash` lapses; zero where it will not say.
    function expiry(bytes32 labelhash) public view returns (uint256) {
        (bool ok, bytes memory ret) = REGISTRAR.staticcall(
            abi.encodeWithSelector(IEthRegistrar.nameExpires.selector, uint256(labelhash)));
        if (!ok || ret.length < 32) return 0;
        return abi.decode(ret, (uint256));
    }

    /// @notice Whether the registration under `labelhash` is live now.
    function live(bytes32 labelhash) public view returns (bool) {
        return expiry(labelhash) > block.timestamp;
    }

    /// @notice The token a bare node means — custody and the clock, both.
    function tokenOf(bytes32 node) public view returns (uint256) {
        return _held(node, _labelOf(node));
    }

    /// @notice The token a wire-format name means: the token holding it, or
    ///         token <id> for `<id>.<apex>` while the apex is held and live.
    function tokenForName(bytes calldata name) external view returns (uint256 t) {
        (t, ) = _resolveName(name);
    }

    /// @notice The namehash of a wire-format name, by this contract's own
    ///         walk; zero for bytes that are not a name.
    function nodeOf(bytes calldata name) external pure returns (bytes32 node) {
        if (!_wellFormed(name)) return bytes32(0);
        (node, , ) = _walk(name, 0);
    }

    /// @notice ERC-6821: the site as an ERC-3770 chain-prefixed address —
    ///         `eth:0x…` on Ethereum, `sep:0x…` on Sepolia, the bare address
    ///         where the chain has no registered short name (which ERC-6821
    ///         reads as "the chain you are on"). Not `eip155:1:0x…`: CAIP
    ///         identifiers are right for the avatar record and wrong here,
    ///         which the donor learned from a gateway that could not parse
    ///         one.
    function contentcontract() public view returns (string memory) {
        string memory sn = _shortName(block.chainid);
        if (bytes(sn).length == 0) return LibNum.hexAddr(PREMISES);
        return string.concat(sn, ":", LibNum.hexAddr(PREMISES));
    }

    /*═══════════════════ resolution ═══════════════════*/

    function addr(bytes32 node) external view returns (address) {
        return _addr(tokenOf(node));
    }

    /// @notice ENSIP-9: the same account for coin type 60, nothing for any other.
    function addr(bytes32 node, uint256 coinType) external view returns (bytes memory) {
        uint256 t = tokenOf(node);
        if (coinType != COIN_ETH || t == 0) return "";
        return abi.encodePacked(HUB.account(t));
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return _text(tokenOf(node), node, key);
    }

    /// @notice Empty on purpose: this site is not on IPFS, it is the chain.
    function contenthash(bytes32) external pure returns (bytes memory) {
        return "";
    }

    /// @notice ENSIP-10: `resolve(dns-encoded name, inner call)`. A held
    ///         name answers as itself; `<id>.<apex>` answers for token <id>.
    ///         An inner call this resolver does not serve gets empty bytes,
    ///         never a revert.
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {
        if (data.length < 4) return "";
        (uint256 t, bytes32 node) = _resolveName(name);
        bytes4 sel = bytes4(data[:4]);
        if (sel == ADDR_IFACE) return abi.encode(_addr(t));
        if (sel == ADDR_MULTI) {
            if (data.length < 68 || t == 0 || abi.decode(data[36:68], (uint256)) != COIN_ETH) return abi.encode(bytes(""));
            return abi.encode(abi.encodePacked(HUB.account(t)));
        }
        if (sel == CONTENTHASH) return abi.encode(bytes(""));
        if (sel == TEXT_IFACE) {
            if (data.length < 100) return abi.encode("");
            (, string memory key) = abi.decode(data[4:], (bytes32, string));
            return abi.encode(_text(t, node, key));
        }
        return "";
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == ERC165 || id == ADDR_IFACE || id == ADDR_MULTI || id == CONTENTHASH
            || id == TEXT_IFACE || id == WILDCARD;
    }

    /*═══════════════════ the answers ═══════════════════*/

    function _addr(uint256 t) private view returns (address) {
        return t == 0 ? address(0) : HUB.account(t);
    }

    function _text(uint256 t, bytes32 node, string memory key) private view returns (string memory) {
        if (t == 0) return "";
        bytes32 k = keccak256(bytes(key));
        if (k == keccak256("contentcontract")) return contentcontract();
        if (k == keccak256("avatar")) {
            return string.concat("eip155:", block.chainid.str(), "/erc721:", LibNum.hexAddr(address(HUB)), "/", t.str());
        }
        if (k == keccak256("url")) {
            /*  The web3:// form, with the address rather than the name, so
                the record stands on its own: a client that already read it
                through the name has the name, and one that did not has an
                address a native client opens with nothing else. The apex
                is the collection's page; everything else is its token's. */
            string memory base = string.concat("web3://", LibNum.hexAddr(PREMISES), ":", block.chainid.str(), "/");
            if (node == APEX) return base;
            return string.concat(base, "token/", t.str(), "/live");
        }
        return "";
    }

    /*═══════════════════ which token a name means ═══════════════════*/

    /// @dev Custody AND the registrar's clock: the token holding `node`, or
    ///      zero when the .eth registration under `labelhash` has lapsed. A
    ///      name not under .eth has no registrar; only custody is asked.
    function _held(bytes32 node, bytes32 labelhash) private view returns (uint256) {
        (uint256 t, ) = heldBy(node);
        if (t == 0) return 0;
        if (labelhash != bytes32(0) && !live(labelhash)) return 0;
        return t;
    }

    /// @dev The registrar's key for a node: the apex's own, or the keccak
    ///      of the second-level label parsed from the wire-format name the
    ///      wrapper stores for every node it has wrapped. Zero for a node
    ///      the wrapper does not know or a name not under .eth.
    function _labelOf(bytes32 node) private view returns (bytes32) {
        if (node == APEX) return APEX_LABEL;
        (bool ok, bytes memory ret) = WRAPPER.staticcall(
            abi.encodeWithSelector(INameWrapper.names.selector, node));
        if (!ok || ret.length < 64) return bytes32(0);
        bytes memory name = abi.decode(ret, (bytes));
        if (!_wellFormed(name)) return bytes32(0);
        (, , bytes32 l2) = _walk(name, 0);
        return l2;
    }

    /// @dev A held name means the token holding it. Otherwise, if the first
    ///      label is a decimal id of this band, the rest is the apex, the
    ///      id is minted, and the apex itself is held and live, the name
    ///      means that id. Otherwise nothing.
    function _resolveName(bytes memory name) private view returns (uint256 t, bytes32 node) {
        if (!_wellFormed(name)) return (0, bytes32(0));
        bytes32 parent;
        bytes32 l2;
        (node, parent, l2) = _walk(name, 0);
        t = _held(node, l2);
        if (t != 0) return (t, node);
        (uint256 id, bool numeric) = _numeric(name);
        if (!numeric || parent != APEX || id < BAND_LO || id > BAND_HI) return (0, node);
        if (!_exists(id)) return (0, node);
        return (_held(APEX, APEX_LABEL) != 0 ? id : 0, node);
    }

    /*═══════════════════ wire-format names ═══════════════════*/

    /// @dev Length-prefixed labels ending in a zero byte, at most 63 bytes
    ///      a label and MAX_LABELS labels: anything else is not a name and
    ///      is answered as one nobody holds, with no index ever read past
    ///      the end and no recursion a hostile name could deepen.
    function _wellFormed(bytes memory name) private pure returns (bool) {
        uint256 off;
        uint256 labels;
        while (off < name.length) {
            uint256 len = uint8(name[off]);
            if (len == 0) return off == name.length - 1;
            if (len > 63 || ++labels > MAX_LABELS) return false;
            off += 1 + len;
        }
        return false;
    }

    /// @dev namehash of the name from `off`; the node of everything after
    ///      its first label; and the keccak of its second-level label under
    ///      .eth, zero where the name is not under .eth.
    function _walk(bytes memory name, uint256 off) private pure returns (bytes32 node, bytes32 parent, bytes32 label2) {
        uint256 len = uint8(name[off]);
        if (len == 0) return (bytes32(0), bytes32(0), bytes32(0));
        bytes32 lh;
        assembly ("memory-safe") { lh := keccak256(add(add(name, 32), add(off, 1)), len) }
        (bytes32 tail, , bytes32 l2) = _walk(name, off + 1 + len);
        return (keccak256(abi.encodePacked(tail, lh)), tail, tail == ETH_NODE ? lh : l2);
    }

    /// @dev The first label as a decimal id: digits only, no leading zero
    ///      (so `03073.intact.eth` is not a second name for 3073), at most
    ///      ten of them.
    function _numeric(bytes memory name) private pure returns (uint256 v, bool ok) {
        uint256 len = uint8(name[0]);
        if (len == 0 || len > 10 || (len > 1 && name[1] == "0")) return (0, false);
        for (uint256 i = 1; i <= len; ++i) {
            uint8 c = uint8(name[i]);
            if (c < 0x30 || c > 0x39) return (0, false);
            v = v * 10 + (c - 0x30);
        }
        return (v, true);
    }

    /*═══════════════════ small things ═══════════════════*/

    function _exists(uint256 id) private view returns (bool) {
        (bool ok, bytes memory out) = address(HUB).staticcall(abi.encodeCall(IIntact.ownerOf, (id)));
        return ok && out.length >= 32 && abi.decode(out, (address)) != address(0);
    }

    /// @dev The ERC-3770 short name, from ethereum-lists/chains, for the
    ///      chains a .eth name can live on. Empty elsewhere: a name this
    ///      contract invented would be worse than none.
    function _shortName(uint256 c) private pure returns (string memory) {
        if (c == 1) return "eth";
        if (c == 11155111) return "sep";
        return "";
    }
}
