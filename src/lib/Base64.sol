// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// Origin: IPSEITY src/lib/Base64.sol (INTACT U0), its loop rewritten in U7
// in the shape of Solady's Base64.encode (MIT, Vectorized) and again at the
// wave-4 integration as a word-at-a-time encoder — hand-written here, no
// import. Load-bearing comments kept; the measurements that forced each
// rewrite are recorded below.

/*───────────────────────────────────────────────────────────────────────────
  Base64 — the only way a contract can hand a browser a whole document

  A data: URI is the entire distribution channel for an on-chain artwork.
  This runs on the return path of every tokenURI() call, over a payload
  measured in tens of kilobytes — TWICE, because face 0 is JSON holding a
  base64 document inside a base64 URI — so the loop below is the single
  largest line item of `tokenURI`, and the 8,000,000-gas cap (DESIGN §5.5)
  is won or lost here.

  ── the first rewrite, measured ──

  The donor's loop looked up four alphabet bytes through `add(table, …)`,
  masked each to a byte, packed the four with three shifts and three adds
  and stored the group once. Under viaIR that compiled to ~80 opcodes a
  chunk, every constant re-pushed each iteration: an opcode profile of
  `tokenURI` on the placeholder shell put 4.0 M of its 5.26 M in this loop
  — about 80 gas per input byte over the 47 KB the two passes encode.
  With U9's real shell (≈ 83 KB through the two passes) that projected to
  8.1 M, over the cap, before the shell had a single feature.

  U7's loop kept the alphabet in scratch space, offset one byte so
  `mload(index)` landed the character in the low byte, wrote the four
  characters with four MSTORE8s into scratch and copied the word out
  once: 55.7 gas per input byte, measured.

  ── the second rewrite, measured ──

  Wave 4 put the state block through a growth spurt (every satellite's
  rows, errors and topics ride in every tokenURI) and `tokenURI(1)` on a
  band with the card, the Roles and the Market landed measured 8.15 M —
  7.04 M of it in the Renderer, 6.6 M of that in this loop over the
  ≈ 118 KB the four encodings pass through. The loop below encodes
  24 input bytes into 32 characters per iteration with no table and no
  byte store: the eight 24-bit chunks of a word are spread into eight
  32-bit lanes in three mask-shift-or steps, each lane's four sextets
  into its four bytes in two more, and the 32 sextets are turned into
  their characters at once by the arithmetic of the alphabet — 65 + 6 for
  a sextet ≥ 26, − 75 for ≥ 52, − 15 for ≥ 62, + 3 for 63 — with the
  comparisons done on all lanes in one add-and-mask each. ≈ 100 opcodes
  per 24 bytes: 16.5 gas per input byte on the same measurement (tools/
  gas.mjs and the harness in docs/CHECKPOINT.md carry the tokenURI
  figure), the same bytes, checked against Node's encoder on every
  length up to 130, on random inputs to 5 KB and on the 64 sextets at
  every lane position.

  ── a bug fixed on the way (U7) ──

  The donor read its last chunk with a bare `mload` past the end of the
  input, so for an input whose length was not a multiple of three the
  second-to-last character carried whatever memory happened to follow the
  array. Decoders discard those bits, which is why no test ever saw it, but
  the output was not canonical base64 and two encodings of the same bytes
  could differ by what sat next to them in memory. The word after the input
  is zeroed for the loop and restored after it; the last iteration here
  reads at most 31 bytes past the input, inside that word.
───────────────────────────────────────────────────────────────────────────*/
library Base64 {
    function encode(bytes memory data) internal pure returns (string memory result) {
        assembly ("memory-safe") {
            let len := mload(data)
            if len {
                // 4 characters out for every 3 bytes in, rounded up
                let encodedLen := shl(2, div(add(len, 2), 3))
                result := mload(0x40)
                let ptr := add(result, 0x20)
                let end := add(ptr, encodedLen)

                /*  Every iteration reads a whole word and uses its top 24
                    bytes, so the last one reaches up to 31 bytes past the
                    input. Zero that word for the loop so a partial chunk
                    pads with zero bits, as RFC 4648 requires, and restore
                    whatever was there afterwards.                         */
                let dataEnd := add(add(data, 0x20), len)
                let saved := mload(dataEnd)
                mstore(dataEnd, 0)

                let input := add(data, 0x20)
                for {} 1 {} {
                    // the 24 payload bytes, as eight 24-bit chunks in the low 192 bits
                    let p := shr(64, mload(input))
                    // the eight chunks into eight 32-bit lanes: the upper four up
                    // by 32, the upper two of each four by 16, the upper one of
                    // each two by 8 — chunk i ends 8·(7−i) bits higher
                    p := or(shl(32, and(p, 0x0000000000000000ffffffffffffffffffffffff000000000000000000000000)),
                               and(p, 0x0000000000000000000000000000000000000000ffffffffffffffffffffffff))
                    p := or(shl(16, and(p, 0x00000000ffffffffffff00000000000000000000ffffffffffff000000000000)),
                               and(p, 0x00000000000000000000ffffffffffff00000000000000000000ffffffffffff))
                    p := or(shl(8,  and(p, 0x0000ffffff0000000000ffffff0000000000ffffff0000000000ffffff000000)),
                               and(p, 0x0000000000ffffff0000000000ffffff0000000000ffffff0000000000ffffff))
                    // each lane's four sextets into its four bytes: the upper two
                    // up by 4, then the first and third by 2
                    p := or(shl(4,  and(p, 0x00fff00000fff00000fff00000fff00000fff00000fff00000fff00000fff000)),
                               and(p, 0x00000fff00000fff00000fff00000fff00000fff00000fff00000fff00000fff))
                    p := or(shl(2,  and(p, 0x0fc00fc00fc00fc00fc00fc00fc00fc00fc00fc00fc00fc00fc00fc00fc00fc0)),
                               and(p, 0x003f003f003f003f003f003f003f003f003f003f003f003f003f003f003f003f))
                    /*  The alphabet, by arithmetic on every byte lane at once:
                        'A' + v, + 6 past 'Z' (v ≥ 26), − 75 into the digits
                        (v ≥ 52), − 15 to '+' (v ≥ 62), + 3 to '/' (v = 63).
                        A lane holds 0..63, so adding 128 − k and keeping bit 7
                        is the comparison v ≥ k; the additions never carry out
                        of a lane (at most 137) and the subtractions never
                        borrow (a lane that owes 90 holds at least 123).    */
                    let c := add(add(add(p, 0x4141414141414141414141414141414141414141414141414141414141414141),
                        mul(shr(7, and(add(p, 0x6666666666666666666666666666666666666666666666666666666666666666),
                                             0x8080808080808080808080808080808080808080808080808080808080808080)), 6)),
                        mul(shr(7, and(add(p, 0x4141414141414141414141414141414141414141414141414141414141414141),
                                             0x8080808080808080808080808080808080808080808080808080808080808080)), 3))
                    c := sub(c, add(
                        mul(shr(7, and(add(p, 0x4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c),
                                             0x8080808080808080808080808080808080808080808080808080808080808080)), 75),
                        mul(shr(7, and(add(p, 0x4242424242424242424242424242424242424242424242424242424242424242),
                                             0x8080808080808080808080808080808080808080808080808080808080808080)), 15)))
                    /*  One write places the 32 characters; past `end` it runs
                        into the allocation's extra word on the last.        */
                    mstore(ptr, c)
                    ptr := add(ptr, 32)
                    if iszero(lt(ptr, end)) { break }
                    input := add(input, 24)
                }

                mstore(dataEnd, saved)
                // allocate: the length word, the output, and the word the last store ran into
                mstore(0x40, add(end, 0x20))

                // pad the tail: '=' twice for one trailing byte, once for two, never for three
                let o := div(2, mod(len, 3))
                mstore(sub(end, o), shl(240, 0x3d3d))
                mstore(result, encodedLen)
            }
        }
        if (data.length == 0) return "";
    }
}
