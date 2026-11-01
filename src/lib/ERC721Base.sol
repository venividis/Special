// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC165, IERC721, IERC721Metadata, IERC721Receiver} from "../interfaces/Standards.sol";

/*───────────────────────────────────────────────────────────────────────────
  ERC721Base — the one ERC-721 the V2 satellites inherit

  V2 (docs/V2.md §3.1, §3.4). Keepsake and every Studio Collection are
  ERC-721s; they share this base so there is one transfer path to read
  and to test. The hub keeps its own (src/hub/), sealed in IntactBase.

  What it is: owners, balances, the single approval and operator
  approvals; `transferFrom` and both `safeTransferFrom`s; `_mint`. Errors
  are ERC-6093's, so wallets and explorers decode them. There is no burn.

  What a child adds: `name`, `symbol`, `tokenURI`, and `_beforeMove(from,
  to, id)`, which runs before EVERY change of owner — a mint (`from` is
  zero) and every transfer — with the old owner still recorded. Keepsake
  moves an account's commitment there; a Collection bumps the custody
  epoch there.

  Two choices, each with its reason:
  - The single approval is cleared on every move, as ERC-721 requires;
    operator approvals belong to the owner and survive (DESIGN §2's
    per-owner rule).
  - `safeTransferFrom` asks a receiver with code for
    `onERC721Received` and refuses any other answer; an address with no
    code is not asked. A 7702-delegated account has code and is asked.

  Origin: NEW for INTACT V2 (the shape of every audited ERC-721; no import).
───────────────────────────────────────────────────────────────────────────*/
abstract contract ERC721Base is IERC721Metadata {
    error ERC721InvalidOwner(address owner);
    error ERC721NonexistentToken(uint256 tokenId);
    error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner);
    error ERC721InvalidSender(address sender);
    error ERC721InvalidReceiver(address receiver);
    error ERC721InsufficientApproval(address operator, uint256 tokenId);
    error ERC721InvalidApprover(address approver);
    error ERC721InvalidOperator(address operator);

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _approvals;
    mapping(address => mapping(address => bool)) private _operators;

    /*═══════════════════ ERC-165 ═══════════════════*/

    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == type(IERC165).interfaceId
            || interfaceId == type(IERC721).interfaceId
            || interfaceId == type(IERC721Metadata).interfaceId;
    }

    /*═══════════════════ reads ═══════════════════*/

    function balanceOf(address owner) public view virtual returns (uint256) {
        if (owner == address(0)) revert ERC721InvalidOwner(address(0));
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view virtual returns (address owner) {
        owner = _owners[tokenId];
        if (owner == address(0)) revert ERC721NonexistentToken(tokenId);
    }

    function getApproved(uint256 tokenId) public view virtual returns (address) {
        ownerOf(tokenId);
        return _approvals[tokenId];
    }

    function isApprovedForAll(address owner, address operator) public view virtual returns (bool) {
        return _operators[owner][operator];
    }

    /*═══════════════════ approvals ═══════════════════*/

    function approve(address to, uint256 tokenId) public virtual {
        address owner = ownerOf(tokenId);
        if (msg.sender != owner && !_operators[owner][msg.sender]) revert ERC721InvalidApprover(msg.sender);
        _approvals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) public virtual {
        if (operator == address(0)) revert ERC721InvalidOperator(address(0));
        _operators[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    /*═══════════════════ transfers ═══════════════════*/

    function transferFrom(address from, address to, uint256 tokenId) public virtual {
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public virtual {
        _transfer(from, to, tokenId);
        _checkReceiver(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) public virtual {
        _transfer(from, to, tokenId);
        _checkReceiver(from, to, tokenId, data);
    }

    /*═══════════════════ for children ═══════════════════*/

    /// @dev Runs before every change of owner, the old owner still recorded.
    function _beforeMove(address from, address to, uint256 tokenId) internal virtual {}

    function _mint(address to, uint256 tokenId) internal virtual {
        if (to == address(0)) revert ERC721InvalidReceiver(address(0));
        if (_owners[tokenId] != address(0)) revert ERC721InvalidSender(address(0));
        _beforeMove(address(0), to, tokenId);
        unchecked { ++_balances[to]; }
        _owners[tokenId] = to;
        emit Transfer(address(0), to, tokenId);
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _owners[tokenId] != address(0);
    }

    function _ownerOrZero(uint256 tokenId) internal view returns (address) {
        return _owners[tokenId];
    }

    function _isAuthorized(address owner, address spender, uint256 tokenId) internal view returns (bool) {
        return spender == owner || _operators[owner][spender] || _approvals[tokenId] == spender;
    }

    /*═══════════════════ the one path ═══════════════════*/

    function _transfer(address from, address to, uint256 tokenId) private {
        if (to == address(0)) revert ERC721InvalidReceiver(address(0));
        address owner = ownerOf(tokenId);
        if (owner != from) revert ERC721IncorrectOwner(from, tokenId, owner);
        if (!_isAuthorized(owner, msg.sender, tokenId)) revert ERC721InsufficientApproval(msg.sender, tokenId);
        _beforeMove(from, to, tokenId);
        delete _approvals[tokenId];
        unchecked {
            --_balances[from];
            ++_balances[to];
        }
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function _checkReceiver(address from, address to, uint256 tokenId, bytes memory data) private {
        if (to.code.length == 0) return;
        try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 answer) {
            if (answer != IERC721Receiver.onERC721Received.selector) revert ERC721InvalidReceiver(to);
        } catch {
            revert ERC721InvalidReceiver(to);
        }
    }
}
