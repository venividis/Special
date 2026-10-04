// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LibNum} from "./lib/LibNum.sol";
import {Web} from "./lib/Web.sol";

/*───────────────────────────────────────────────────────────────────────────
  CREST — the still, drawn on chain

  NEW for INTACT U7 (DESIGN.md §3 row 10). The technique is IPSEITY's
  Sigil (fixed-point SVG built from a token's own numbers, every label
  scanned on the way into character data) and MASTER's OnchainRenderer
  (a marketplace-sized image that costs a fraction of the document); the
  subject is not a solid but the token's custody record.

  Face 1 of tokenURI is this image alone, and it exists for the same
  reason the Sigil did: face 0 is tens of kilobytes of base64 and some
  clients will not touch that. A token that becomes invisible when a
  client is cautious is not really on chain.

  What it draws, from four numbers and nothing else:

      id            the hue (keccak of the id, so neighbours differ) and
                    the title
      epoch         the ring count — a token that has changed hands
                    wears its history; a fresh one wears one ring
      status        a filled mark for Active, a hollow one for Paused,
                    and the word
      sealedUntil   the seal line, as a timestamp the page turns into a
                    date, or UNSEALED

  Nothing here reads state and nothing reads `block.*`, so the same four
  inputs draw the same bytes on every chain forever — the fingerprint of a
  token can be checked against its picture.

  ── the escaping rule ──

  Every string that lands inside `<text>` goes through `Web.esc`, even
  though every one of them is a constant or digits today. The Sigil's
  `z<-z2+c` notation once broke every thumbnail in the collection, and the
  lesson was not "that one string was bad": it was that character data is
  a parse boundary, and a boundary has a rule or it has an incident. The
  rule costs ~300 bytes and is asserted by test/Premises.t.sol.

  Budget ≤ 4,000 B of runtime; the image ≤ 4 KB.
───────────────────────────────────────────────────────────────────────────*/
contract Crest {
    using LibNum for uint256;

    /// @notice A deterministic SVG still for one token.
    function svg(uint256 id, uint64 epoch, uint8 status, uint64 sealedUntil)
        external pure returns (bytes memory)
    {
        uint256 h = uint256(keccak256(abi.encodePacked("intact.crest", id)));
        uint256 hue = h % 360;
        // a second hue a third of the way round, so the mark is two-toned
        uint256 hue2 = (hue + 120) % 360;
        uint256 rings = epoch == 0 ? 1 : (epoch > 9 ? 9 : epoch);
        uint256 tilt = (h >> 16) % 45;

        return abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">',
            '<rect width="1000" height="1000" fill="#07080c"/>',
            _rings(rings, hue, tilt),
            _mark(status == 0, hue2),
            _text(id, epoch, status, sealedUntil, hue),
            '</svg>'
        );
    }

    /// @dev One rotated square per custody epoch, nested, the outermost at
    ///      the tilt the id's hash chose. Nine is the most a crest shows;
    ///      past that the number says it.
    function _rings(uint256 n, uint256 hue, uint256 tilt) private pure returns (bytes memory out) {
        out = abi.encodePacked(
            '<g fill="none" stroke="hsl(', hue.str(), ',60%,55%)" stroke-width="2" ',
            'transform="rotate(', tilt.str(), ' 500 500)">'
        );
        for (uint256 i; i < n; ++i) {
            uint256 half = 360 - i * 32;
            out = abi.encodePacked(
                out, '<rect x="', (500 - half).str(), '" y="', (500 - half).str(),
                '" width="', (half * 2).str(), '" height="', (half * 2).str(),
                '" transform="rotate(', (i * 7).str(), ' 500 500)" opacity="', (9 - i).str(), '0%"/>'
            );
        }
        out = abi.encodePacked(out, '</g>');
    }

    /// @dev The status mark: filled while the token's keys may act, hollow
    ///      while it is paused — a sale pauses, the buyer re-arms.
    function _mark(bool active, uint256 hue) private pure returns (bytes memory) {
        return abi.encodePacked(
            '<circle cx="500" cy="500" r="92" fill="', active ? 'hsl(' : 'none" stroke="hsl(',
            hue.str(), ',70%,60%)"', active ? '' : ' stroke-width="6"', '/>'
        );
    }

    function _text(uint256 id, uint64 epoch, uint8 status, uint64 sealedUntil, uint256 hue)
        private pure returns (bytes memory)
    {
        string memory seal = sealedUntil == 0
            ? "UNSEALED"
            : string.concat("SEALED UNTIL ", uint256(sealedUntil).str());
        return abi.encodePacked(
            '<g font-family="ui-monospace,Menlo,monospace" text-anchor="middle" fill="#8b95ad">',
            '<text x="500" y="112" font-size="30" letter-spacing="12">',
              Web.esc(string.concat("INTACT #", id.str())), '</text>',
            '<text x="500" y="902" font-size="20" letter-spacing="6">',
              Web.esc(string.concat("EPOCH ", uint256(epoch).str(), " / ", status == 0 ? "ACTIVE" : "PAUSED")),
            '</text>',
            '<text x="500" y="946" font-size="20" letter-spacing="6" fill="hsl(', hue.str(), ',60%,55%)">',
              Web.esc(seal), '</text></g>'
        );
    }
}
