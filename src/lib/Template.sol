// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  Template — a creator's bytes with holes, filled per token

  V2 (docs/V2.md §3.4, src/interfaces/ICollection.sol). A Studio collection
  stores two templates as SSTORE2 code — the page (HTML) and the art (SVG)
  — and fills them for each token every time `tokenURI` is asked. The
  holes are the twelve ICollection names, each written `{{name}}`:

      {{id}} {{seed}} {{holder}} {{epoch}} {{memories}} {{minted}}
      {{supply}} {{price}} {{collection}} {{creator}} {{room}} {{chain}}

  Three rules, each with its reason:

  - Exact match. A hole is the two opening braces, one of the twelve names
    in lower case, and the two closing braces, with nothing in between.
    `{{ id }}`, `{{ID}}`, `{{foo}}` and a hole cut short by the end of the
    template are left exactly as written. CSS and scripts are full of
    braces; a filler that guessed would rewrite a creator's page in ways
    the creator never saw, in a contract nobody can change.
  - Values are the caller's, already ASCII: the Collection prints decimal
    or 0x-hex and nothing else, so no value can open a tag, close an
    attribute or end a script. The template is the creator's markup; the
    holes are never markup.
  - One scan, word at a time. A 24,000-byte page is filled on every
    `tokenURI` eth_call, so the loop reads 32 bytes per step and tests
    all of them for `{` at once (the exact zero-byte test, below); a run of
    text with no brace costs one load, one store and a handful of
    arithmetic per word, and only a brace costs a look at the names.

  `fill` also counts the holes it filled, which is what the Studio reads
  at launch: a template is refused past MAX_HOLES (src/Studio.sol says
  why), with the same matcher that fills it at render, so the count the
  Studio checked is the count the Collection fills.

  Origin: NEW for INTACT V2 (unit W4).
───────────────────────────────────────────────────────────────────────────*/
library Template {
    /// @notice The value each hole is replaced by, in the order of the
    ///         ICollection list. Each must already be printable ASCII.
    struct Values {
        bytes id;
        bytes seed;
        bytes holder;
        bytes epoch;
        bytes memories;
        bytes minted;
        bytes supply;
        bytes price;
        bytes collection;
        bytes creator;
        bytes room;
        bytes chain;
    }

    /// @notice `t` with every exact hole replaced by its value, and how
    ///         many holes there were.
    /// @dev    The output is allocated at the free pointer and grows past
    ///         it while the loop runs; nothing else is allocated until the
    ///         loop ends, and the free pointer is then set just past what
    ///         was written. Each copy stores a whole word and advances by
    ///         what it meant, so up to 31 bytes past the end are scratch
    ///         beyond the final free pointer — memory a later allocation
    ///         overwrites, and that no Solidity routine reads (ABI copies,
    ///         keccak and Base64 all go by the length).
    function fill(bytes memory t, Values memory v) internal pure returns (bytes memory out, uint256 holes) {
        assembly ("memory-safe") {
            /*  The offset of the first `{` among the next min(32, rem)
                bytes of `w`, or that length when there is none.

                `x` has a zero byte exactly where `w` has a `{`. For each
                byte b of x, (b & 0x7f) + 0x7f carries into bit 7 unless
                the low seven bits are clear, and never out of the byte;
                OR-ing x back in sets bit 7 for a set high bit; so after
                the NOT, bit 7 of a byte is set exactly when that byte of
                w is `{`. No borrow crosses a byte, unlike the shorter
                (x - 0x01..) & ~x trick, whose false positives above a
                true zero would put the first brace in the wrong place. */
            function brace(w, rem) -> k {
                let low7 := 0x7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f
                let x := xor(w, 0x7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b)
                let m := not(or(or(add(and(x, low7), low7), x), low7))
                let c := 32
                if lt(rem, 32) {
                    c := rem
                    m := and(m, not(shr(mul(8, rem), not(0))))   // keep the top `rem` bytes
                }
                switch m
                case 0 { k := c }
                default {
                    // leading zero bytes of m: the index of the first brace
                    if iszero(shr(128, m)) { k := 16 m := shl(128, m) }
                    if iszero(shr(192, m)) { k := add(k, 8) m := shl(64, m) }
                    if iszero(shr(224, m)) { k := add(k, 4) m := shl(32, m) }
                    if iszero(shr(240, m)) { k := add(k, 2) m := shl(16, m) }
                    if iszero(shr(248, m)) { k := add(k, 1) }
                }
            }

            /// Whether the top `len` bytes of `w` are `lit` (left-aligned)
            /// and fit in the `rem` bytes the template has left.
            function named(w, rem, len, lit) -> r {
                r := and(iszero(gt(len, rem)), eq(and(w, not(shr(mul(8, len), not(0)))), lit))
            }

            /// The hole that starts at `ptr`: its index in Values and its
            /// length, or a length of zero when no name matches exactly.
            /// At most one can: every name ends at its own closing braces.
            function hole(ptr, rem) -> h, l {
                let w := mload(ptr)
                if eq(shr(240, w), 0x7b7b) {
                    if named(w, rem, 6, "{{id}}") { h := 0 l := 6 }
                    if named(w, rem, 8, "{{seed}}") { h := 1 l := 8 }
                    if named(w, rem, 10, "{{holder}}") { h := 2 l := 10 }
                    if named(w, rem, 9, "{{epoch}}") { h := 3 l := 9 }
                    if named(w, rem, 12, "{{memories}}") { h := 4 l := 12 }
                    if named(w, rem, 10, "{{minted}}") { h := 5 l := 10 }
                    if named(w, rem, 10, "{{supply}}") { h := 6 l := 10 }
                    if named(w, rem, 9, "{{price}}") { h := 7 l := 9 }
                    if named(w, rem, 14, "{{collection}}") { h := 8 l := 14 }
                    if named(w, rem, 11, "{{creator}}") { h := 9 l := 11 }
                    if named(w, rem, 8, "{{room}}") { h := 10 l := 8 }
                    if named(w, rem, 9, "{{chain}}") { h := 11 l := 9 }
                }
            }

            let n := mload(t)
            let src := add(t, 0x20)
            out := mload(0x40)
            let dst := add(out, 0x20)
            let p := 0
            for {} lt(p, n) {} {
                let w := mload(add(src, p))
                let k := brace(w, sub(n, p))
                mstore(dst, w)                  // the text before the brace (or the whole chunk)
                dst := add(dst, k)
                p := add(p, k)
                if lt(p, n) {
                    if eq(shr(248, mload(add(src, p))), 0x7b) {
                        let h, l := hole(add(src, p), sub(n, p))
                        switch l
                        case 0 {
                            mstore8(dst, 0x7b)      // a brace that opens no hole is text
                            dst := add(dst, 1)
                            p := add(p, 1)
                        }
                        default {
                            let vp := mload(add(v, mul(h, 0x20)))
                            let vl := mload(vp)
                            for { let i := 0 } lt(i, vl) { i := add(i, 0x20) } {
                                mstore(add(dst, i), mload(add(add(vp, 0x20), i)))
                            }
                            dst := add(dst, vl)
                            p := add(p, l)
                            holes := add(holes, 1)
                        }
                    }
                }
            }
            let len := sub(dst, add(out, 0x20))
            mstore(out, len)
            mstore(0x40, add(add(out, 0x20), and(add(len, 0x1f), not(0x1f))))
        }
    }
}
