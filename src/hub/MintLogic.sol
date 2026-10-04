// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactBase} from "./IntactBase.sol";
import {IntactStorage} from "./IntactStorage.sol";
import {Core, Status} from "../interfaces/IIntact.sol";
import {ERC721Minimal} from "../vendor/ERC721Minimal.sol";
import {AccountBinding, IAccountRegistry} from "../lib/AccountBinding.sol";
import {Transient} from "../lib/Transient.sol";

/*───────────────────────────────────────────────────────────────────────────
  MintLogic — issuance, the two hands, and the whole of what is curated

  DESIGN.md §3 row 4, §4.3 (the exact order), §4.7. Origin: IPSEITY
  src/Ipseity.sol:352-407 (`_issue`: counters first, the token added before
  anything external) and Pixel-Garden PixelGardenKernel.sol 752-797 (both
  accounts created through the canonical registry in the mint transaction
  and verified by CREATE2 recomputation plus codehash), adapted for INTACT
  U1. Dropped from IPSEITY: the block-derived seed and section word (the
  Crest draws from id, epoch and status — nothing here reads `block.*`
  for randomness), `openNode`, the clone path, the two-step curator.

  Nothing else is deployed at mint. The market, home room, inbox, launches,
  locks and steward plan are per-id state in shared immutable contracts.
───────────────────────────────────────────────────────────────────────────*/
abstract contract MintLogic is IntactBase {
    using ERC721Minimal for ERC721Minimal.Store;

    /// @notice Mint the next id of this band to `to`, at exactly `price`,
    ///         and create its Reach and Grip.
    /// @dev    Counters move before any external call; the receiver callback
    ///         runs LAST, so a contract minter sees a complete token and a
    ///         re-entrant mint from the callback meets the lock, never a
    ///         half-made token.
    function mint(address to) external payable returns (uint256 id) {
        Transient.enter(Transient.HUB_LOCK);
        IntactStorage.Layout storage $ = _s();
        if (msg.value != $.price) revert WrongPrice();
        if (to == address(0)) revert ZeroAddress();

        id = _BAND_LO + $.minted;
        if (id > _BAND_HI) revert BandExhausted();           // exhausted, never wrapped into another band
        $.minted += 1;

        _refuseCanonical(id, to);                            // the transfer rule applies at birth
        $.nft.add(to, id);
        Core storage c = $.core[id];
        c.custodyEpoch = 1;
        c.status = Status.Active;                            // a fresh minter's keys work immediately
        c.createdAt = uint64(block.timestamp);

        address reach = IAccountRegistry(AccountBinding.REGISTRY).createAccount(
            _REACH_IMPL, AccountBinding.REACH_SALT, block.chainid, address(this), id);
        address grip = IAccountRegistry(AccountBinding.REGISTRY).createAccount(
            _GRIP_IMPL, AccountBinding.GRIP_SALT, block.chainid, address(this), id);
        // CREATE2 recomputation AND the forwarder codehash: a registry that
        // answered with the wrong address, or an address without the
        // forwarder behind it, is refused rather than recorded.
        if (!_canonical(reach, id, false) || !_canonical(grip, id, true)) revert NotCanonical();

        emit Transfer(address(0), to, id);
        emit Minted(id, reach, grip, _BAND);
        emit CustodyEpoch(id, 1);
        emit MetadataUpdate(id);

        ERC721Minimal.checkOnERC721Received(msg.sender, address(0), to, id, "");
        Transient.exit(Transient.HUB_LOCK);
    }

    function price() external view returns (uint256) {
        return _s().price;
    }

    function minted() external view returns (uint256) {
        return _s().minted;
    }

    /*═══════════════════ the two hands ═══════════════════*/

    /// @notice The Reach: the hand that acts. Derived, never stored.
    function account(uint256 id) external view returns (address) {
        return _account(id);
    }

    /// @notice The Grip: the hand that only holds.
    function grip(uint256 id) external view returns (address) {
        return _grip(id);
    }

    /// @notice Whether `candidate` is exactly this token's deployed Reach
    ///         (or Grip): address and codehash both.
    function isCanonicalAccount(address candidate, uint256 id, bool gripRole) external view returns (bool) {
        return _canonical(candidate, id, gripRole);
    }

    /*═══════════════════ the curator (DESIGN §4.7) ═══════════════════*/

    /*  The Timelock is the only caller of these four, and after
        `sealPricing` only `withdraw` remains. That is the whole of what is
        curated; there is no other setter in the hub.                     */

    function _requireTimelock() internal view {
        if (msg.sender != _TIMELOCK) revert NotTimelock();
    }

    function setPrice(uint256 newPrice) external {
        _requireTimelock();
        IntactStorage.Layout storage $ = _s();
        if ($.pricingSealed) revert IsPricingSealed();
        $.price = newPrice;
        emit PriceSet(newPrice);
    }

    function setRoyalty(address receiver, uint16 bps) external {
        _requireTimelock();
        IntactStorage.Layout storage $ = _s();
        if ($.pricingSealed) revert IsPricingSealed();
        if (bps > 500) revert RoyaltyTooHigh();
        $.royaltyReceiver = receiver;
        $.royaltyBps = bps;
        emit RoyaltySet(receiver, bps);
    }

    /// @notice Mint proceeds. Never a Grip — that would burn them.
    function withdraw(address to) external {
        _requireTimelock();
        if (to == address(0)) revert ZeroAddress();
        Transient.enter(Transient.HUB_LOCK);
        uint256 amount = address(this).balance;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(to, amount);
        Transient.exit(Transient.HUB_LOCK);
    }

    /// @notice One-way: freezes price and royalty for ever.
    function sealPricing() external {
        _requireTimelock();
        _s().pricingSealed = true;
        emit PricingSealed();
    }

    function pricingSealed() external view returns (bool) {
        return _s().pricingSealed;
    }
}
