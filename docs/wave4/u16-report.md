# U16 — Roles (ERC-7432): unit report

Branch `wave4/u16` from the integrated head 40a678f. Files owned and
touched: `src/Roles.sol` (new), `test/Roles.t.sol` (new), additive lines
in `src/interfaces/IRoles.sol`, the one additive change in
`src/hub/RightsLogic.sol`, and the minimal addition to
`test/helpers/HubMocks.sol` (`MockRoles.hasAnyRole`, named below). No
other file was edited; what other files need is written here as requests.

## 1. What was built

**`src/Roles.sol`** — the ERC-7432 registry for this collection, from
ANIMA `contracts/registry/AnimaRoles.sol`, adapted:

- **One collection.** Every ERC-7432 entry takes `tokenAddress`; anything
  but the hub is `UnsupportedCollection` on the writes and on `ownerOf`,
  and reads as absent (zero, empty, false) on the role views.
- **Strict `holds`.** `grantRole` admits `hub.ownerOf(tokenId)` and nobody
  else: not an ERC-721 operator or approvee (DESIGN §2: "may transfer
  only; never acts"), not the token's Reach (`holds`, not `acts` — a role
  is a grant, like a session). The donor's `setRoleApprovalForAll` path is
  closed: it reverts `ApprovalsUnsupported` and `isRoleApprovedForAll` is
  always false. The frozen error name `NotOwnerOrApproved(tokenId, caller)`
  is kept; only the owner passes it. The contract header says so.
- **Revocable only.** `revocable == false` reverts `IrrevocableUnsupported`.
  The donor's capped irrevocable term, its `lockedUntil` clock and its
  overwrite guard go with it. `isRoleRevocable` is therefore "is there a
  live role".
- **Epoch-stamped.** Every grant records `hub.custodyEpoch(tokenId)`
  (`roleEpoch`). A role is LIVE iff `expirationDate > block.timestamp` AND
  its stamp equals the live epoch. `hasRole`, `hasAnyRole`, `recipientOf`,
  `roleData`, `roleExpirationDate`, `isRoleRevocable` and `liveRoleCount`
  answer for live roles only; a stale or expired role reads as absent and
  never reverts. `roleEpoch` returns the stamp live or not (zero when no
  record), so a page can say why a role is absent.
- **Lock, not escrow.** The first grant on a token takes ONE
  `hub.moduleLock(tokenId)`; further roles and re-grants take none. The
  lock is released when the last live role goes — by `revokeRole` (owner
  or recipient of a live role; anyone for an expired or stale record) or by
  the permissionless `unlockToken` — and the token's whole role table is
  emptied with it. The table is non-empty exactly while the lock is held,
  so `moduleUnlock` is called once per lock taken and the hub's `NotLocked`
  is never met: `unlockToken` with no lock held reverts this module's own
  `NotLocked(tokenId)` before the hub is asked; `unlockToken` with a live
  role reverts `StillLocked(tokenId, until)` where `until` is the latest
  expiry among the live roles.
- **One recipient per `(tokenId, roleId)`**, as the standard keys it: a
  second grant of the same id replaces the first.
- **Honest `liveRoleCount`.** Expiry is a clock, not an event, so the count
  walks the token's distinct role ids and reads each one's expiry and
  stamp. The walk is bounded by `MAX_ROLES = 16` distinct ids per token
  (`TooManyRoles` beyond); a revoke frees the slot, a release empties the
  table.
- **`hasAnyRole(tokenId, account)`** — the any-role view the hub needed
  (additive to `IRoles`), bounded by the same walk.
- `USER() = keccak256("USER")`; `supportsInterface` for ERC-165, ERC-7432
  (`0xd00ca5cf`, the id the spec publishes — Standards.sol's `IERC7432`
  computes exactly it) and `IRoles`; the standard's events (`TokenLocked`,
  `RoleGranted`, `RoleRevoked`, `TokenUnlocked`; `RoleApprovalForAll` is
  declared by the interface and never emitted). Immutable `HUB` only; no
  admin, no owner, no setter.

**`src/interfaces/IRoles.sol`** (frozen; additive only, under a marked
block): `error ApprovalsUnsupported()`, `error TooManyRoles(uint256
tokenId)`, `function hasAnyRole(uint256 tokenId, address account) external
view returns (bool)`, `function MAX_ROLES() external view returns
(uint256)`. No existing signature changed.

**`src/hub/RightsLogic.sol`** — the one change outside this unit's files:
`R_ROLE` is now `_guarded32(_ROLES, abi.encodeCall(IRoles.hasAnyRole, (id,
actor))) != 0` instead of `hasRole(id, USER_ROLE, actor)`, so a live
non-USER role sets the bit too (DESIGN §2 "ROLE = any live ERC-7432
role"). Same guard (`extcodesize` and a low-level staticcall), same
"absent satellite clears the bit". The `_userOf`/`userExpires` shim is
untouched.

**`test/helpers/HubMocks.sol`** — `MockRoles.hasAnyRole(id, a)` (four
lines), because `test/Rights.t.sol` · `test_aRenterCannotSetATrait`
asserts `R_USE | R_ROLE` from the stand-in and the hub now reads the
any-role view. Nothing else in the file moved.

**`test/Roles.t.sol`** — 22 sentences against the REAL hub in the build
`INTACT_IMPL` names, with the real `Roles` in `IntactConfig.roles` (the
mutual pin settled by the nonce probe of the bundle fixture, copied into
the suite so it stays on `IntactFixture`'s stand-ins for everything else).
`rightsOf`, `userOf`, `userExpires`, `moduleLock`, `moduleUnlock`, `panic`,
`release`, the transfer rule and the trait mirror are real code.

## 2. Bytes (`node tools/compile.mjs`, solc 0.8.36, viaIR, 800 runs, `bytecodeHash: "none"`)


## 3. Tests and counts


## 4. Mutation evidence

One-character or one-token mutations of `src/Roles.sol`, each aimed at one
guard, run in a copy pruned to the hub, `Roles.sol` and `test/Roles.t.sol`
(`node tools/forge.mjs --match Roles`, monolith); the file restored after
each and the copy's `git status` clean at the end. The driver is
`mutate.mjs` in the session scratchpad (not committed: it is eight rows
over one file, the shape of `tools/mutations.mjs`'s table, and belongs in
that table if the integrator wants it in the gate).


## 5. Rows proposed for `docs/INVARIANTS.md` and DESIGN §14

A new hub row, since the roles are a satellite the hub's authority model
reads (DESIGN §2 "Role holder") and the lock is the hub's:

| # | Invariant | Enforced by | Status |
|---|---|---|---|
| A11 | A live ERC-7432 role locks the token (one module lock per token, released with the last live role, never a second time); every grant is stamped with the custody epoch and reads as absent once stale or expired; `panic` makes every role stale and `unlockToken` is anyone's; only the holder grants (no operator, no approvee, no Reach); roles are revocable only; `R_ROLE` is any live role and `R_USE` follows the USER role | `test/Roles.t.sol` · `test_aLiveRoleLocksTheToken`, `test_aStaleRoleUnlocksForAnyone`, `test_panicMakesEveryRoleStale`, `test_theUserShimReadsTheRole`, `test_anIrrevocableRoleIsRefused`, `test_anOperatorCannotGrant`, `test_moduleUnlockIsNeverCalledAtZero`, `test_aSaleKillsTheRoleAndABuyersFreshGrantWorks` | pending U16 → live once `test/Roles.t.sol` runs in `npm run check` on both builds; the mutation evidence is §4 of this report (every one of the eight killed, by the tests named there) |

And one citation added to A2's "Enforced by": `test/Roles.t.sol` ·
`test_moduleUnlockIsNeverCalledAtZero` (a real module releasing its one
lock exactly once; the hub's `NotLocked()` never shows). DESIGN §14 gets
the same A11 line with the same file and sentences, so
`tools/invariants-check.mjs` sees the two ledgers agree.

## 6. Catalog service rows requested (`CatalogRows.SERVICES`)

The table's `LETTERS` is sixteen letters wide (`"HPRYTSKNLCOWXEGQ"`) with
`address[16] byLetter`; Roles needs a seventeenth letter and the array
widened by one — suggested `J` (free; `R` is the Reach). Rows, in the
`name|contract|signature|kind|via|note;` grammar (ASCII, no `|`, `;` or
`"` in a note), kept to what a console or an agent needs:

```
grantRole|J|grantRole((bytes32,address,uint256,address,uint64,bool,bytes))|w|d|holder only - revocable only - one recipient per role id - locks the token;
revokeRole|J|revokeRole(address,uint256,bytes32)|w|d|the holder or the recipient of a live role, anyone for an expired or stale record;
unlockToken|J|unlockToken(address,uint256)|w|d|anyone, once every role is expired or stale;
hasRole|J|hasRole(uint256,bytes32,address)|r|d|;
hasAnyRole|J|hasAnyRole(uint256,address)|r|d|what the hub reads R_ROLE from;
recipientOf|J|recipientOf(address,uint256,bytes32)|r|d|zero unless live;
roleExpirationDate|J|roleExpirationDate(address,uint256,bytes32)|r|d|zero unless live;
roleData|J|roleData(address,uint256,bytes32)|r|d|empty unless live - the rights a page reads;
roleEpoch|J|roleEpoch(uint256,bytes32)|r|d|the custody epoch at grant, live or not;
liveRoleCount|J|liveRoleCount(uint256)|r|d|walks at most 16 ids;
USER|J|USER()|r|d|keccak256 of USER;
```

Every name is a public function `Roles`'s ABI serves (the drift gate in
`tools/verify.mjs`). For `CatalogText`'s error table, the Roles line is:

```
"UnsupportedCollection(address);NotOwnerOrApproved(uint256,address);ExpirationInThePast(uint64);IrrevocableUnsupported();StillLocked(uint256,uint64);ZeroRecipient();NotLocked(uint256);ApprovalsUnsupported();TooManyRoles(uint256);"
```

(`NotLocked(uint256)` is this module's; the hub's `NotLocked()` is a
different selector and both may sit in the table.) The state block's
`roleCount` word (`Catalog.token`, `B[10] = liveRoleCount(id)`) and the
`absent` bit 512 (`docs/u9/readers/E-harness-and-state.md`) are already
wired to `IRoles.liveRoleCount`; once a Roles is pinned and deployed the
bit moves from `absent` to `reported` with no Catalog change. The
constructor shape for DESIGN §3's list and `tools/deploy.mjs`:
`Roles(address hub)` — pinned mutually with the hub, so it is one more
prediction in the deploy order (before the hub, like Locks and Steward).

## 7. `docs/INTERFACE-CHANGES.md` entry text

Under a new heading `## U16 — Roles (additive)`:

| File | Change | Why | Where it came from |
|---|---|---|---|
| `IRoles.sol` | `function hasAnyRole(uint256 tokenId, address account) external view returns (bool);` | DESIGN §2 defines `R_ROLE` as "any live ERC-7432 role"; the frozen surface had only `hasRole(tokenId, roleId, account)`, so the hub could ask about the USER role alone (the wart recorded under "Known warts"). The hub's `R_ROLE` now reads this view, guarded as before; a live non-USER role sets the bit. The walk is bounded by `MAX_ROLES`. | U16 |
| `IRoles.sol` | `function MAX_ROLES() external view returns (uint256);` | The bound on distinct role ids per token (16), so a page can say "no more than sixteen" rather than discover `TooManyRoles`. | U16 |
| `IRoles.sol` | `error ApprovalsUnsupported();` | `setRoleApprovalForAll` is in ERC-7432 and in the frozen interface, and INTACT has no role operators (DESIGN §2: the holder is the only one who grants); the entry reverts with this so the console can print why, and `isRoleApprovedForAll` is always false. | U16 |
| `IRoles.sol` | `error TooManyRoles(uint256 tokenId);` | The seventeenth distinct role id on one token. | U16 |

And strike the "Known warts" bullet **`IRoles` has no any-role view**
(it has one now), with the same strike in DESIGN §3's residuals ("`R_ROLE`
is read for the USER role only until U16…"), `docs/SECURITY.md` §5's
bullet, and `docs/CHECKPOINT.md` line 76's clause. Behaviour decided in
this unit, outside the interface, for the same file's second list:
grants are strict `holds` (not the donor's owner-or-approved);
`revokeRole` of a record that does not exist is a silent no-op (the
donor's shape, kept so a cleanup is idempotent); `revokeRole` of an
expired or stale record is anyone's; `grantRole` refuses `expirationDate
<= block.timestamp` (the donor's and the ERC-7432 reference's boundary: a
role is dead AT its expiry second, where the hub's own ERC-4907 field is
live at `userExpires == block.timestamp`; the two never disagree about
the same grant because the shim reads the role through `recipientOf`).

## 8. Requests

1. **Catalog** (U7's file): the seventeenth letter, the eleven rows and
   the error line of §6; `CatalogConfig`/`Catalog.ROLES` already exist.
2. **INVARIANTS / DESIGN §14**: the A11 row and the A2 citation of §5.
3. **INTERFACE-CHANGES, DESIGN §3 residuals, SECURITY §5, CHECKPOINT**: §7.
4. **`tools/deploy.mjs` and `tools/hub.mjs`**: deploy `Roles(hubP)` before
   the hub and pass it as `IntactConfig.roles` once the band ships it
   (post-MVB; until then `roles: address(0)` as today — the hub's guarded
   read keeps clearing the bit).
5. **`tools/mutations.mjs`**: the eight rows of §4 if the integrator wants
   Roles in the gate; they run in a copy pruned to `src/{hub,interfaces,
   lib,vendor}`, `src/Roles.sol`, `test/helpers/{Deploy,HubMocks}.sol`
   (Deploy trimmed to `IntactFixture`) and `test/Roles.t.sol`.
6. **Console (U9/U17)**: a Roles lane can read `hasAnyRole`, `roleData`
   and `roleEpoch` for the Identity › rights chips; the `ROLE` chip's
   sentence is "a role holder reads what the role's `data` says; the page
   grants nothing on it".

## 9. Observations

- **The epoch path is `panic`, by construction.** No role record can
  reach a sale: a live role locks the token, and both releases empty the
  table. So "the epoch kills the role" is proved where the epoch can move
  under a record — the holder's panic (`test_aStaleRoleUnlocksForAnyone`)
  and the guardian's (`test_panicMakesEveryRoleStale`) — and "after a
  sale" is proved as the seller revoking, selling, being refused a grant
  and the buyer's grant carrying epoch 2
  (`test_aSaleKillsTheRoleAndABuyersFreshGrantWorks`). The comparison is
  still load-bearing: mutation R1 reads every post-panic role as live.
- **Two clocks, one boundary each.** A role is dead AT its expiry second
  (`>`, the donor's and the ERC-7432 reference's rule, pinned by
  `test_lapsesARoleOnItsOwnExpiry` at T+3599/T+3600 and by mutation R2);
  the hub's own ERC-4907 field is live at `userExpires == block.timestamp`
  (`>=`). They never disagree about the same grant, because the shim reads
  the role only through `recipientOf`, which answers by the role's rule.
- **Events are emitted, not asserted.** `tools/forge.mjs` has no
  `expectEmit` or log capture, so `TokenLocked`, `RoleGranted`,
  `RoleRevoked` and `TokenUnlocked` are proved only by their state
  effects. `tools/evm.mjs`'s `Chain.send()` returns `logs`; a verifier or
  an `agents.mjs` motive could assert them if the integrator wants the
  events in a ledger row.
- **`expectRevert(bytes)` matches any revert in this runner** (the
  precompile arms `{any: true}` for the bytes form). Exact refusal data —
  `StillLocked(id, until)`, this module's `NotLocked(id)` against the
  hub's `NotLocked()` — is asserted by a raw call and `assertEq(bytes)`
  (`_refusal` in the suite). Worth a line in CLAUDE.md's traps (not this
  unit's file).
- **Cost of honesty.** `liveRoleCount`, `hasAnyRole` and `unlockToken`
  walk at most 16 ids with one `custodyEpoch` read and two cold SLOADs per
  id; `revokeRole` pays one walk; `grantRole` pays none beyond the push.
  The 16 bound is the price of a count that cannot lie about expiry.
- **The Roles gate is cheap.** The pruned copy (hub, `Roles.sol`, the two
  fixture files, the suite and the shim) compiles and runs the 22
  sentences in about two minutes per mutation, against the twenty-minute
  full-tree compile; eight mutations took the time §4 records.
- **A grant to the holder** yields `R_HOLD | R_ROLE`; to the Reach,
  `R_ACCOUNT | R_ROLE`. Both harmless and both honest. The `ROLE` chip's
  sentence stays "view only": nothing in the protocol grants a power on
  it, and the role's `data` is for the page to read.
- **The two locks are distinct and the suite shows it**: after a guardian
  panic, `unlockToken` releases this module's one count and `hub.locked`
  stays true under `guardianHold` until the holder's `release`.
- `RightsFacet` shrank with the change (one fewer encoded argument in the
  `R_ROLE` read); `Intact` stays a measurement over EIP-170 and the
  diamond ships, unchanged.
