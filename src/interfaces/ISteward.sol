// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  ISteward — succession and recovery, one contract, one power

  DESIGN.md §9.4, signatures verbatim; from IPSEITY Succession.sol plus
  guardians, the hashed heir, duress and the ERC-7878-legible views.
  Frozen after wave 0. Its only power is `hub.stewardTransfer(id, dest)`
  for a matured plan, through the ordinary sealed `_update` (an heir waits
  out a seal). The plan is stamped with the custody epoch and void on any
  transfer. `getObit`'s shape and the status codes are U0 choices in the
  IPSEITY `wouldPass` style.
───────────────────────────────────────────────────────────────────────────*/

struct Will {
    bytes32 heirHash;        // keccak256(heir, salt) or keccak256(address(0), tokenN, salt)
    uint64  quiet;           // 30–3650 d of silence before anyone may summon
    uint64  notice;          // 14–365 d between the summons and the door
    uint64  lastLife;        // the holder's last sign of life
    uint64  due;             // when the notice ends; zero while none runs
    address dest;            // where the token goes, once resolved
    uint64  epoch;           // custody epoch at arrangement
    address[] guardians;     // 0 or 2..5
    uint8   threshold;       // ≥ 2 when guardians exist
    uint32  nonce;           // one attest per guardian per nonce
    bool    duress;          // set by stillHereUnderDuress; read by the heir's page only
}

interface IStewardEvents {
    event Arranged(uint256 indexed id, uint64 epoch, bytes32 heirHash, uint64 quiet, uint64 notice, uint8 threshold);
    event StillHere(uint256 indexed id, uint64 when);
    event Cancelled(uint256 indexed id, address indexed by);
    event Summoned(uint256 indexed id, address indexed by, address dest, uint64 due);
    event Attested(uint256 indexed id, address indexed guardian, address dest, uint32 nonce);
    event NoticeStarted(uint256 indexed id, address dest, uint64 due);
    event Passed(uint256 indexed id, address indexed from, address indexed to);

    error NotHolder();
    error NoPlan();
    error TooShort();
    error TooLong();
    error BadGuardians();
    error BadThreshold();
    error WrongHeir();
    error BadDestination();
    error StillSpeaking(uint64 until);
    error AlreadyCalled();
    error NotCalled();
    error NotYet(uint64 until);
    error NotGuardian();
    error AlreadyAttested();
    error StaleNonce();
    error Void();
    error Reentrancy();
}

interface ISteward is IStewardEvents {
    function arrange(uint256 id, bytes32 heirHash, uint64 quiet, uint64 notice, address[] calldata guardians, uint8 threshold) external;  // holds
    function stillHere(uint256 id) external;                       // holds — the only sign of life
    function stillHereUnderDuress(uint256 id) external;            // holds — silently sets notice = 365 d
    function cancel(uint256 id) external;                          // holds, during any notice
    function summon(uint256 id, address heir, bytes32 salt) external;   // anyone after lastLife + quiet; twice reverts AlreadyCalled
    function attest(uint256 id, address dest, uint32 nonce) external;   // named guardian; threshold → notice starts
    function execute(uint256 id) external;                         // anyone after `due`: unlock then HUB.stewardTransfer(id, dest)
    function wouldPass(uint256 id) external view returns (uint8);  // status codes below
    function getWill(uint256 id) external view returns (Will memory);
    function getObit(uint256 id) external view returns (uint8 status, uint64 due, address dest, uint32 nonce, uint8 attestations);
    function planHash(uint256 id) external view returns (bytes32);
    function heirHashOf(address heir, bytes32 salt) external pure returns (bytes32);
    function heirHashOfToken(uint256 tokenN, bytes32 salt) external pure returns (bytes32);

    /*── status codes `wouldPass` renders in words ──*/
    function NO_PLAN() external view returns (uint8);      // 0
    function SOLD() external view returns (uint8);         // 1: the epoch moved; the plan is void
    function SPEAKING() external view returns (uint8);     // 2: quiet not yet elapsed
    function SUMMONABLE() external view returns (uint8);   // 3: anyone may summon with the heir's preimage
    function WAITING() external view returns (uint8);      // 4: a notice runs
    function LOCKED() external view returns (uint8);       // 5: another module holds the token, or the seal runs
    error BadHands();
    function BAD_HANDS() external view returns (uint8);    // 6: dest is the holder or a canonical account
    function OK() external view returns (uint8);           // 7: execute would pass now

    function MIN_QUIET() external view returns (uint64);   // 30 days
    function MAX_QUIET() external view returns (uint64);   // 3650 days
    function MIN_NOTICE() external view returns (uint64);  // 14 days
    function MAX_NOTICE() external view returns (uint64);  // 365 days
    function MAX_GUARDIANS() external view returns (uint8); // 5
    function HUB() external view returns (address);
}
