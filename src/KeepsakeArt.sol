// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Asset, KeepsakeView} from "./interfaces/IKeepsake.sol";
import {Web} from "./lib/Web.sol";
import {Base64} from "./lib/Base64.sol";
import {LibNum} from "./lib/LibNum.sol";

/*───────────────────────────────────────────────────────────────────────────
  KeepsakeArt — the face of a keepsake: an orb, an arc, and a page

  Origin: NEW for INTACT V2 (docs/V2.md §3.1 "Art", unit W1).

  Why this is its own contract: the face did not fit beside the logic
  under EIP-170 (the Keepsake measured 24,737 B with it inside, by
  tools/compile.mjs on 2026-10-19), and the contract that holds other
  people's money should keep its room for its guards, not spend it on a
  renderer's strings. So `Keepsake.tokenURI`
  reads the keepsake itself and hands this contract the facts — the
  view, what is free now per asset, and the schedule's freed share — and
  this contract only draws them.

  It is a pure renderer: no storage, no owner, no pin. What it draws is
  what the Keepsake told it, so it cannot disagree with the ledger, and a
  page that calls it directly with other facts gets a picture of those
  facts and nothing else. The one thing it reads for itself is each
  ERC-20's `symbol()` and `decimals()`, through Web's defensive
  staticcall (stipend, no code, `bytes32` answers, a megabyte answer):
  a hostile token renders as "?", never as a revert and never as markup.

  What it draws:
    · the image, an SVG orb: one hue per asset, derived from the token's
      address, blended into the orb and set in orbit around it, with the
      freed share of the schedule drawn as an arc from the top;
    · `animation_url`, an HTML page: the orb, the message, a row per asset
      (held, free now) and per proceeds token, and the release line —
      flat to the cliff, a step onto the line, the line to the end — with
      a marker at now. A gift is a page the recipient opens.

  Every chain string reaches the document escaped: the message through
  `Web.esc` in the page and `Web.jsonEsc` in the JSON (a whitelist —
  printable ASCII, the metacharacters as entities, everything else
  dropped), symbols through `Web.symbolOf`. Numbers are digits and
  addresses are hex. The page carries no script: a gift is a document,
  not a program, so every viewer shows the same thing and nothing runs.
  Dates are unix seconds; a chain cannot format a calendar honestly for a
  reader whose time zone it does not know.
───────────────────────────────────────────────────────────────────────────*/
contract KeepsakeArt {
    using LibNum for uint256;

    /// @notice The `tokenURI` of keepsake `id`, from the facts its Keepsake
    ///         read: `v` its view, `free` what a claim would pay per asset,
    ///         `permille` the schedule's freed share in thousandths.
    function render(uint256 id, KeepsakeView memory v, Asset[] memory free, uint256 permille)
        external view returns (string memory)
    {
        bytes memory orb = _orb(id, v, permille);
        return string.concat("data:application/json;base64,", Base64.encode(abi.encodePacked(
            '{"name":"Keepsake #', id.str(),
            '","description":"', Web.jsonEsc(v.message),
            '","image":"data:image/svg+xml;base64,', Base64.encode(orb),
            '","animation_url":"data:text/html;base64,', Base64.encode(_page(id, v, free, orb, permille)),
            '","attributes":[{"trait_type":"Assets","display_type":"number","value":', v.assets.length.str(),
            '},{"trait_type":"Cliff","display_type":"date","value":', uint256(v.schedule.cliff).str(),
            '},{"trait_type":"End","display_type":"date","value":', uint256(v.schedule.end).str(), '}]}'
        )));
    }

    /*═══════════════════ the orb ═══════════════════*/

    function _hue(address token) private pure returns (string memory) {
        return (uint256(keccak256(abi.encodePacked(token))) % 360).str();
    }

    function _orb(uint256 id, KeepsakeView memory v, uint256 permille) private pure returns (bytes memory) {
        uint256 n = v.assets.length;
        bytes memory stops;
        bytes memory moons;
        for (uint256 i; i < n; ++i) {
            string memory h = _hue(v.assets[i].token);
            stops = abi.encodePacked(stops,
                '<stop offset="', ((i + 1) * 100 / (n + 1)).str(), '%" stop-color="hsl(', h, ',85%,58%)"/>');
            moons = abi.encodePacked(moons,
                '<circle cx="200" cy="56" r="11" fill="hsl(', h, ',90%,66%)" transform="rotate(',
                (i * 360 / n).str(), ' 200 200)"/>');
        }
        return abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">'
            '<defs><radialGradient id="o" cx="38%" cy="34%" r="72%"><stop offset="0" stop-color="#fff"/>',
            stops,
            '<stop offset="1" stop-color="#05040a"/></radialGradient></defs>'
            '<rect width="400" height="400" fill="#07060b"/>'
            '<circle cx="200" cy="200" r="174" fill="none" stroke="#ffffff24" stroke-width="6"/>'
            '<circle cx="200" cy="200" r="174" fill="none" stroke="hsl(', _hue(v.assets[0].token),
            ',95%,72%)" stroke-width="6" stroke-linecap="round" pathLength="1000" stroke-dasharray="',
            permille.str(), ' 1000" transform="rotate(-90 200 200)"/>'
            '<circle cx="200" cy="200" r="118" fill="url(#o)"/>',
            moons,
            '<text x="200" y="392" text-anchor="middle" font-family="monospace" font-size="13" fill="#ffffff99">#',
            id.str(), '</text></svg>'
        );
    }

    /*═══════════════════ the page ═══════════════════*/

    function _page(uint256 id, KeepsakeView memory v, Asset[] memory free, bytes memory orb, uint256 permille)
        private view returns (bytes memory)
    {
        bytes memory rows;
        uint256 n = v.assets.length;
        for (uint256 i; i < n; ++i) {
            Asset memory a = v.assets[i];
            rows = abi.encodePacked(rows, _row(a.token, a.amount - v.paid[i] - v.sold[i], free[i].amount, ""));
        }
        for (uint256 j; j < v.proceeds.length; ++j) {
            Asset memory q = v.proceeds[j];
            rows = abi.encodePacked(rows, _row(q.token, q.amount, q.amount, " sold for"));
        }
        return abi.encodePacked(
            '<!doctype html><html><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Keepsake #', id.str(),
            '</title><style>'
            'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07060b;color:#ece8f4;'
            'font:15px/1.5 system-ui,sans-serif}main{width:min(92vw,420px);padding:24px 0;text-align:center}'
            'main>svg{display:block;margin:0 auto;width:min(78vw,300px);height:auto}'
            'q{display:block;margin:18px 0;font-size:19px;font-style:italic}'
            'table{width:100%;border-collapse:collapse;margin:12px 0}'
            'td,th{padding:6px 4px;border-bottom:1px solid #ffffff1f;text-align:right}'
            'td:first-child,th:first-child{text-align:left}small{color:#ffffff8c}'
            '</style></head><body><main>',
            orb,
            '<h1>Keepsake #', id.str(), '</h1>',
            bytes(v.message).length == 0 ? bytes("") : abi.encodePacked('<q>', Web.esc(v.message), '</q>'),
            v.creator == v.holder ? bytes("") : abi.encodePacked('<p><small>a gift from ', LibNum.hexAddr(v.creator), '</small></p>'),
            '<table><tr><th>Asset</th><th>Held</th><th>Free now</th></tr>', rows, '</table>',
            _curve(v),
            '<p><small>', (permille / 10).str(), '% released &middot; frees from ', uint256(v.schedule.start).str(),
            ' to ', uint256(v.schedule.end).str(), ' (unix time)',
            v.drip.floor == 0 ? bytes("") : bytes(" &middot; sells slowly as it frees, never below its floor"),
            '</small></p></main></body></html>'
        );
    }

    /// @dev One table row. A symbol arrives escaped, or as "?".
    function _row(address token, uint256 held, uint256 free, string memory note) private view returns (bytes memory) {
        (string memory sym, uint8 dec) = token == address(0)
            ? ("ETH", uint8(18))
            : (Web.symbolOf(token), Web.decimalsOf(token));
        return abi.encodePacked('<tr><td>', sym, note, '</td><td>', Web.amount(held, dec, 6),
            '</td><td>', Web.amount(free, dec, 6), '</td></tr>');
    }

    /// @dev The release line over the schedule, start to end: flat to the
    ///      cliff, a step onto the line, the line to everything; and now.
    ///      `end == start` only when all three dates are one moment.
    function _curve(KeepsakeView memory v) private view returns (bytes memory) {
        uint256 start = v.schedule.start;
        uint256 end = v.schedule.end;
        uint256 span = end - start;
        uint256 lead = uint256(v.schedule.cliff) - start;
        uint256 xc = span == 0 ? 0 : lead * 100 / span;
        uint256 yc = span == 0 ? 2 : 42 - lead * 40 / span;
        uint256 xn = block.timestamp <= start ? 0 : (block.timestamp >= end ? 100 : (block.timestamp - start) * 100 / span);
        return abi.encodePacked(
            '<svg viewBox="0 0 100 44" preserveAspectRatio="none" style="width:100%;height:84px">'
            '<polyline points="0,42 ', xc.str(), ',42 ', xc.str(), ',', yc.str(),
            ' 100,2" fill="none" stroke="hsl(', _hue(v.assets[0].token), ',95%,72%)" stroke-width="1.5"/>'
            '<line x1="', xn.str(), '" y1="0" x2="', xn.str(), '" y2="44" stroke="#ffffff66" stroke-width=".6"/></svg>'
        );
    }
}
