// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// Origin: IPSEITY src/lib/Base64.sol (INTACT U0), its loop rewritten in U7
// in the shape of Solady's Base64.encode (MIT, Vectorized) — hand-written
// here, no import. Load-bearing comments kept; the measurement that forced
// the rewrite is recorded below.

/*───────────────────────────────────────────────────────────────────────────
  Base64 — the only way a contract can hand a browser a whole document

  A data: URI is the entire distribution channel for an on-chain artwork.
  This runs on the return path of every tokenURI() call, over a payload
  measured in tens of kilobytes — TWICE, because face 0 is JSON holding a
  base64 document inside a base64 URI — so the loop below is the single
  largest line item of `tokenURI`, and the 8,000,000-gas cap (DESIGN §5.5)
  is won or lost here.

  ── the rewrite, measured ──

  The donor's loop looked up four alphabet bytes through `add(table, …)`,
  masked each to a byte, packed the four with three shifts and three adds
  and stored the group once. Under viaIR that compiled to ~80 opcodes a
  chunk, every constant re-pushed each iteration: an opcode profile of
  `tokenURI` on the placeholder shell put 4.0 M of its 5.26 M in this loop
  — about 80 gas per input byte over the 47 KB the two passes encode.
  With U9's real shell (≈ 83 KB through the two passes) that projected to
  8.1 M, over the cap, before the shell had a single feature.

  The loop here keeps the alphabet in scratch space, offset one byte so
  `mload(index)` lands the character in the low byte, writes the four
  characters with four MSTORE8s into scratch and copies the word out once.
  Half the opcodes; the same bytes.

  ── a bug fixed on the way ──

  The donor read its last chunk with a bare `mload` past the end of the
  input, so for an input whose length was not a multiple of three the
  second-to-last character carried whatever memory happened to follow the
  array. Decoders discard those bits, which is why no test ever saw it, but
  the output was not canonical base64 and two encodings of the same bytes
  could differ by what sat next to them in memory. The word after the input
  is zeroed for the loop and restored after it.
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

                /*  The alphabet, in scratch space, offset by -1 byte: the
                    word at `i` ends with character `i`, so `mload(i)` is the
                    lookup and MSTORE8 keeps only that low byte. The second
                    half overwrites the free-memory pointer at 0x40; it was
                    read above and is written back below, and no Solidity
                    code runs in between.                                  */
                mstore(0x1f, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef")
                mstore(0x3f, "ghijklmnopqrstuvwxyz0123456789+/")

                /*  The final chunk's `mload` reaches up to two bytes past
                    the input. Zero that word for the loop so a partial chunk
                    pads with zero bits, as RFC 4648 requires, and restore
                    whatever was there afterwards.                         */
                let dataEnd := add(add(data, 0x20), len)
                let saved := mload(dataEnd)
                mstore(dataEnd, 0)

                let input := data
                for {} 1 {} {
                    input := add(input, 3)
                    let chunk := mload(input)          // 3 payload bytes in the low 24 bits
                    mstore8(0, mload(and(shr(18, chunk), 0x3F)))
                    mstore8(1, mload(and(shr(12, chunk), 0x3F)))
                    mstore8(2, mload(and(shr(6, chunk), 0x3F)))
                    mstore8(3, mload(and(chunk, 0x3F)))
                    /*  One write places the four characters and scribbles
                        twenty-eight zero bytes after them, which the next
                        iteration overwrites and the allocation's extra word
                        absorbs on the last.                               */
                    mstore(ptr, mload(0))
                    ptr := add(ptr, 4)
                    if iszero(lt(ptr, end)) { break }
                }

                mstore(dataEnd, saved)
                // allocate: the length word, the output, and the word the last store ran into
                mstore(0x40, add(end, 0x20))

                // pad the tail: '=' twice for one trailing byte, once for two, never for three
                let o := div(2, mod(len, 3))
                mstore(sub(ptr, o), shl(240, 0x3d3d))
                mstore(result, encodedLen)
            }
        }
        if (data.length == 0) return "";
    }
}
