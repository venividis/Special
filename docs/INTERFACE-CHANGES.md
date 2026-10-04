# Interface changes after wave 0

BUILD-PLAN.md's cross-wave contract: the interfaces under `src/interfaces/`
were frozen at the end of wave 0, and a change to any of them needs a note
here and a rerun of every wave-1 suite. This file is that note. Every entry
below is **additive** — a new function, a new error — and never changes an
existing signature, so a contract compiled against the wave-0 text still
links against the integrated one. The rerun is recorded in the commit that
made each change.

## Wave-1 integration (this commit)

| File | Change | Why | Where it came from |
|---|---|---|---|
| `IIntact.sol` | `function setScriptURI(string[] calldata) external;` | The hub claims ERC-5169 (`supportsInterface(type(IERC5169).interfaceId)`), and that id is `scriptURI ^ setScriptURI`. Without the setter the claim named a function the token did not serve. `SiteLogic.setScriptURI` always reverts `NotTimelock`: the script is the Premises, pinned at construction, and nobody — the curator included — can point the clients elsewhere. SiteFacet grew 92 B (8,789 → 8,881, under 10,000). | U1's report: "add `setScriptURI(string[])` that reverts so the interface id is honest, if SiteFacet budget allows" |
| `ILaunchpad.sol` | `function recordLaunch(uint256 id, address by, address coin, uint256 raiseShare) external;` (KILN only) | The Kiln↔Launchpad seam: the Kiln makes the coin and the Launchpad keeps the per-token clock, the first-launch rule and the launch root. U6 declared it as a local `ILaunchClock` in `src/Kiln.sol`; it is one interface now, so a reader of ILaunchpad sees the whole surface. | U6's report |
| `ILaunchpad.sol` | `error NotKiln(); error NotEnoughCredit(uint256 have, uint256 want); error Insolvent();` | Were `Launchpad`'s own; moved so the Catalog's error table (U7) sees them. | U6's report |
| `IKiln.sol` | `error BadDecimals();` | Was `Kiln`'s own (`decimals > 36`). | U6's report |
| `IParley.sol` | `error PostageDue(uint256 to, uint128 postage); error BadReply();` | Were `Parley`'s own; moved for the Catalog. Parley also reverts `IPostageEvents.InboxClosed`, which was already in an interface. | U4's report |

Tests that named a moved error through the contract type
(`Kiln.BadDecimals.selector`) now name it through the interface
(`IKilnEvents.BadDecimals.selector`): Solidity does not expose inherited
errors through a derived contract's type.

Behaviour decided in the same pass, outside the interfaces:

- **`Timelock.execute` is open to anyone** (DESIGN.md §3 row 27 wins over
  the donor's `onlyAdmin`). An operation was announced a week before it
  could land; who presses changes nothing about what lands, and an admin
  who must also press is a liveness dependency. `queue` and `cancel` stay
  the admin's. One word changed; Timelock measures 1,617 B (1,634 before).
- **`Reach.sealMax()` is idempotent at the cap.** The hub's `panic` calls
  it unconditionally before `revokeAllSessions()`, so a second panic in the
  same block must not meet `RatchetOnly`. U2 had already written it that
  way; `test/Reach.t.sol` · `test_aSecondPanicDoesNotRevertOnTheSeal` and
  `test/Bundle.t.sol` · `test_panicRevokesAcrossEverySatellite` now pin it
  against the real hub.

## Known warts, accepted for the MVB (not interface changes)

- **`ISteward.summon(id, heir, salt)` has no `tokenN` parameter.** An
  instrument heir ("whoever holds token N") is summoned with
  `heir = address(uint160(tokenN))` and the Steward tries both preimage
  shapes (`keccak(heir, salt)` and `keccak(address(0), tokenN, salt)`).
  v2 may add `summonToken(id, tokenN, salt)`.
- **`ISteward` has no `revoke()`.** A holder erases a plan only by
  re-arranging it. v2.
- **`IParley.heads(uint256[])` returns the head BLOCK per room**, not a
  count. A count is `stateOf(room)`'s second word. The page (U9) must read
  the right one.
- **`IPostage` has no payer parameter.** The payer of record is
  `HUB.account(from)` — the sender token's Reach — so a wallet-pays model
  is unsupported in v1.
- **`IRoles` has no any-role view.** The hub's `R_ROLE` bit is computed from
  `hasRole(id, USER, actor)` only. U16 (Roles) adds the view it needs; the
  hub's read is widened then, additively.
- **`ILaunchpad.Launch` lacks `graduationTarget`**; it is the public mapping
  `Launchpad.graduationTargetOf(launchId)`.
- **Home rooms open on the steward's first word.** `Parley.join(homeKey(id),
  …)` reverts `NoSuchRoom` until the token has spoken at home once; the page
  renders "this token has not spoken yet".

## How to add to this file

One row per signature, additive only, with the unit report or issue it
answers. A change that is not additive is a new interface version and a
new file (`INTERFACE-CHANGES-v2.md`), never an edit to a frozen signature.
