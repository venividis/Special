// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  ERC6492 — signature validation for accounts that have not been deployed yet

  Origin: ANIMA contracts/libraries/ERC6492.sol, verbatim in behaviour.
  ANIMA's copy fell through to OpenZeppelin's SignatureChecker; INTACT has
  no import from outside src/, so the fallthrough is reproduced below as
  `isValidSignatureNowRaw`: ECDSA with the malleable upper half of the curve
  order refused (IPSEITY `_signedByHolder`), else ERC-1271 by staticcall,
  tolerant of an address with no code (which reads as "invalid", not as a
  revert — ERC-1271 owes its callers a plain no).

  ANIMA needed this more than most protocols do, and INTACT inherits the
  reason: an ERC-6551 account has a deterministic address from the moment
  its token exists. INTACT creates both accounts in the mint transaction,
  so a Reach is never counterfactual — but a counterparty's account may
  be, and Market orders and Postage senders are signed by whoever they are.

  ERC-6492 (Final) lets a signature carry its own deployment instructions,
  wrapped as `abi.encode(factory, factoryCalldata, innerSignature)` followed
  by a 32-byte magic suffix whose last byte, `0x92`, is not a legal `v`.

  Validation is therefore state-changing: it may deploy the account. That
  is acceptable at a settlement site, which is where this is used, and is
  why it is not a `view` function. A caller that only wants to read should
  require the account to exist first.
───────────────────────────────────────────────────────────────────────────*/
library ERC6492 {
    bytes32 internal constant MAGIC = 0x6492649264926492649264926492649264926492649264926492649264926492;
    bytes4 internal constant ERC1271_MAGIC = 0x1626ba7e;

    /// @notice Validate a signature, deploying the signer first if it carries an ERC-6492 wrapper.
    function isValidSignatureNow(address signer, bytes32 hash, bytes memory signature) internal returns (bool) {
        if (_hasMagic(signature)) {
            // Only prepare an account that genuinely has no code. Honouring the wrapper against
            // an already-deployed signer would let anyone run an arbitrary call on a factory as
            // a side effect of "checking a signature".
            if (signer.code.length == 0) {
                bytes memory inner = new bytes(signature.length - 32);
                for (uint256 i; i < inner.length; ++i) {
                    inner[i] = signature[i];
                }
                (address factory, bytes memory factoryCalldata, bytes memory innerSignature) =
                    abi.decode(inner, (address, bytes, bytes));

                // An EOA is indistinguishable from a counterfactual account before preparation.
                // Require the wrapper to actually deploy the signer before checking the inner
                // signature; otherwise an EOA could attach an arbitrary privileged call and
                // still pass below with its ordinary ECDSA signature.
                (bool ok,) = factory.call(factoryCalldata);
                ok;
                if (signer.code.length == 0) return false;
                return isValidSignatureNowRaw(signer, hash, innerSignature);
            }
            // Deployed after the signature was produced: strip the wrapper and check normally.
            bytes memory stripped = new bytes(signature.length - 32);
            for (uint256 i; i < stripped.length; ++i) {
                stripped[i] = signature[i];
            }
            (,, bytes memory sig) = abi.decode(stripped, (address, bytes, bytes));
            return isValidSignatureNowRaw(signer, hash, sig);
        }
        return isValidSignatureNowRaw(signer, hash, signature);
    }

    /// @notice ECDSA for an address without code, ERC-1271 for one with it.
    ///         Never reverts; a malformed signature is a `false`.
    function isValidSignatureNowRaw(address signer, bytes32 hash, bytes memory signature)
        internal view returns (bool)
    {
        if (signer == address(0)) return false;
        if (signer.code.length == 0) return recover(hash, signature) == signer;
        (bool ok, bytes memory ret) = signer.staticcall(
            abi.encodeWithSelector(ERC1271_MAGIC, hash, signature));
        return ok && ret.length >= 32 && abi.decode(ret, (bytes4)) == ERC1271_MAGIC;
    }

    /// @notice `ecrecover` with the malleable half of the curve refused.
    ///         Returns address(0) for anything it will not accept.
    function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r; bytes32 s; uint8 v;
        assembly ("memory-safe") {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) return address(0);
        if (v != 27 && v != 28) return address(0);
        return ecrecover(hash, v, r, s);
    }

    function _hasMagic(bytes memory signature) private pure returns (bool) {
        if (signature.length < 32) return false;
        bytes32 tail;
        assembly ("memory-safe") {
            tail := mload(add(add(signature, 0x20), sub(mload(signature), 32)))
        }
        return tail == MAGIC;
    }
}
