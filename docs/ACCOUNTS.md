# The accounts: Reach and Grip

What a token's two ERC-6551 accounts are, what they promise, and the one
fact about them that can never change: their storage layout. Written by
the accounts unit (U2); the measured numbers below are from the run that
wrote them and are re-measured by `tools/verify-vault.mjs` on every check.

## Two hands

Every token gets two accounts in its mint transaction, both through the
canonical ERC-6551 registry (`0x000000006551c19487814612e58FE06813775758`),
both verified by CREATE2 recomputation **and** the 173-byte forwarder
codehash (`AccountBinding.canonical`), never by asking the account what it
is.

| | Reach — `account(id)` | Grip — `grip(id)` |
|---|---|---|
| Source | `src/Reach.sol` (IPSEITY `IpseityAccount.sol`, adapted) | `src/Grip.sol` (IPSEITY `GripVault.sol`, verbatim) |
| Salt | `keccak256("intact.reach.v1")` | `keccak256("intact.grip.v1")` |
| Acts | `execute` (CALL only), `executeBatch` (≤ 16, `EmptyBatch` on `[]`), `executeTyped`, sessions | nothing: no function on it moves an asset, for anybody, ever |
| Promise | the measured seal: nothing on the manifest leaves before `sealedUntil` | permanence: whatever arrives stays |
| Signs | ERC-7739-wrapped attestations only; session keys never | `0xffffffff` to everything |
| Measured size | 20,821 B | 1,937 B |

## The Reach's promise, enforced by measurement

Before a sealed call the account snapshots its ether, `balanceOf(this)` for
every manifest asset (≤ 16) and `ownerOf` for every guarded piece (≤ 8);
after it nothing may be smaller (`Shrank`), a readable asset may not have
gone blind (`WentBlind`), every piece must still be held (`PieceLeft`).
What the call *did* is irrelevant. The one authority measurement cannot see
— a standing approval — is handled by deny-by-default: while sealed a
promised asset hears only `transfer` and `transferFrom`. The seal is a
ratchet (`Ratchet.raise`, ≤ 365 d) and survives sale. The manifest cannot
change while the account is inside any call it made (`ManifestBusy`).

## Sessions — one system

`grantSession` (allowlist: targets × selectors, cumulative native cap,
per-asset ERC-20 caps charged by balance delta, `uses`, `minInterval`) and
`grantRecipe` (one exact call: target, calldata hash, target codehash,
exact value, 1..1024 uses, `minInterval`). Every key is stamped with the
hub's `custodyEpoch` at grant and compares it live: a sale kills it, a
buy-back does not revive it, `panic` kills every key and seals to the
maximum. Keys act only while the token is `Active`, only through
`executeAsSession` / `executeTyped`, never against the account itself or
any grant/seal/revoke word, and never sign ERC-1271.

## The open-approval ledger

Every approval-shaped call the account makes — `approve`,
`increaseAllowance`, `setApprovalForAll`, both `permit` shapes and
Permit2's `approve(address,address,uint160,uint48)` — is recorded as
(asset, spender), ≤ 32 entries (`LedgerFull`), pruned by the revoking
shapes, folded into `openApprovalsRoot()` and so into the hub's ERC-5646
fingerprint. `revokeOpenApprovals()` zeroes every entry with gas-capped
low-level calls that never block on a foreign revert.

## ERC-1271, ERC-7739

The Reach signs exactly one struct, `Attestation(string purpose,bytes32
payload,uint256 nonce,uint64 deadline,address account,uint256
tokenId,uint64 custodyEpoch)` under the `INTACT_ATTESTATION` domain,
wrapped as ERC-7739 `TypedDataSign`. Unsealed, the verifier's hash may be
the attestation's `payload` (how the Reach is a Safe ≥ 1.4.1 owner —
`isValidSignature(bytes,bytes)` is answered too); sealed, the hash must be
the attestation digest itself, so a venue's order hash can never verify.
`0x7739…` with an empty signature answers `0x77390001`.

## The storage layout is the code forever

The implementation address is an input to every Reach's address, so the
layout below can never change for a deployed band. It is frozen with
sixteen reserved slots; `tools/verify-vault.mjs` recomputes the compiler's
`storageLayout` of `src/Reach.sol`, canonicalises it (AST ids stripped,
array lengths kept) and compares its SHA-256 to the hash recorded here.

layout hash: `76641f157a6780198c4e8a71afb0ccb275c9d586464f483ef77f3fd0adb8d1d4`

```
slot off  name               type
  0   0   _state             uint256
  1   0   _sealedUntil       uint64
  1   8   _serial            uint64        grants ever made
  1  16   _revokedThrough    uint64        grants with serial ≤ this are dead
  2   0   _attestationNonce  uint256
  3   0   _auditRoot         bytes32
  4   0   _manifest          address[]
  5   0   onManifest         mapping(address => bool)
  6   0   _pieces            Piece[]                      Piece{collection; tokenId} = 2 slots
  7   0   _session           mapping(address => Session)  Session = 8 slots, below
  8   0   _grantSerial       mapping(address => uint64)
  9   0   _target            mapping(address => mapping(uint32 => mapping(address => bool)))
 10   0   _selector          mapping(address => mapping(uint32 => mapping(bytes4 => bool)))
 11   0   _caps              mapping(address => CapSlot[])  CapSlot{asset | cap, spent} = 2 slots
 12   0   _ledger            Entry[]                      Entry{asset, kind | spender | via} = 3 slots
 13   0   _ledgerAt          mapping(bytes32 => uint256)  entry key → index + 1
 14   0   __gap              uint256[16]                  reserved, slots 14–29

Session (8 slots, the compiler's packing of the interface's struct):
  0   0   kind            uint8 (SessionKind)
  0   1   expires         uint64
  0   9   epoch           uint64
  1   0   nativeCap       uint128
  1  16   nativeSpent     uint128
  2   0   usesLeft        uint32         2^32-1 = unlimited (allowlist, uses == 0 at grant)
  2   4   minInterval     uint32
  2   8   lastUsed        uint64
  3   0   dataHash        bytes32        recipe only
  4   0   targetCodeHash  bytes32        recipe only
  5   0   target          address        recipe only
  6   0   exactValue      uint256        recipe only
  7   0   listEpoch       uint32         the epoch the allowlists are keyed by
  7   4   active          bool
```

Transient storage: one slot, `Transient.REACH_LOCK` (`keccak256("intact.reach.lock") - 1`), the re-entrancy lock, held for the duration of every acting call and clear on every exit including a revert.
