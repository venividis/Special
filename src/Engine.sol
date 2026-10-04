// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SSTORE2} from "./lib/SSTORE2.sol";

/*───────────────────────────────────────────────────────────────────────────
  ENGINE — the document, held as bytecode

  Origin: IPSEITY src/Engine.sol, verbatim in shape (INTACT U7), plus the
  six panel shards DESIGN.md §5.1–5.2 adds. The load-bearing comments are
  kept; what changed is listed at the bottom of this header.

  The interface is stored in two runs of shards with a gap between them.
  tokenURI() writes each token's live state into that gap, so the state
  arrives before the engine's first line runs and no contract ever has to
  search a string for a marker.

      head shards   <!DOCTYPE …  through  </head>   (plain text: the prologue)
      ─── gap ───   <script>window.INTACT={…}</script>
      body shards   the whole shell, gzip

  Compression
    A DEFLATE stream is roughly a fifth of the size of this document, and
    every byte costs 200 gas to deposit and inflates the base64 that comes
    back out of tokenURI(). The body shards hold gzip bytes and the
    renderer emits a small loader that hands them to the browser's own
    DecompressionStream. Nothing is fetched either way; the decompressor
    is part of the platform, like the JSON parser.

  Panels
    Six more shards, one per lane of the console (swap, social, launch,
    vault, identity, agent), each gzip ≤ 8 KB. They are not part of the
    document: the shell fetches `/panel/<name>.js` (or `eth_call`s
    `panel(i)` in the data: viewer), inflates it, keccaks the result and
    compares it with the hash baked into the state gap before injecting
    it as a Blob script. The hash is pinned HERE, by the curator, at load
    time: a contract cannot inflate gzip, so `tools/verify.mjs` is what
    proves the pinned hash is the keccak of what the shard inflates to.

  Sealing
    freeze() is one way. After it, no shard can be added, replaced or
    removed by anyone, including the curator, forever. DESIGN §4.7:
    `Engine.freeze()` precedes the first mint.

  Changes from the donor: `compressed` is gone (the body is always gzip
  — DESIGN §5.1 names one shape and the renderer carries one loader);
  `loadPanel`, `panel`, `panelHash`, `panelCount`, `setEngineHash`,
  `engineHash` are new; `setCurator` is kept so a deployer may hand the
  loading role to a script key and back. Budget ≤ 4,000 B.
───────────────────────────────────────────────────────────────────────────*/
contract Engine {
    address public curator;
    bool    public frozen;

    address[] public head;
    address[] public body;

    /// @dev One pointer per lane, zero until loaded. Six is the number of
    ///      lanes in DESIGN §1 and the number `/panel/<name>.js` routes.
    uint256 public constant PANELS = 6;
    address[PANELS] private _panel;
    bytes32[PANELS] private _panelHash;

    /// @dev The size of the shell once inflated, so a reader can check the
    ///      decompression produced what was intended.
    uint32 public inflatedSize;
    /// @dev keccak256 of the inflated shell: what the crest's "verified
    ///      against chain" footer and `/manifest` carry.
    bytes32 public engineHash;

    event Loaded(bool isHead, uint256 index, address pointer, uint256 size);
    event PanelLoaded(uint256 indexed index, address pointer, uint256 size, bytes32 hash);
    event Frozen(uint256 headBytes, uint256 bodyBytes);
    event CuratorChanged(address curator);

    error NotCurator();
    error IsFrozen();
    error NothingLoaded();
    error BadPanel();

    modifier onlyCurator() {
        if (msg.sender != curator) revert NotCurator();
        _;
    }

    modifier open() {
        if (frozen) revert IsFrozen();
        _;
    }

    constructor() {
        curator = msg.sender;
    }

    /*──────────────────────── loading ────────────────────────*/

    function loadHead(bytes calldata chunk) external onlyCurator open {
        address p = SSTORE2.write(chunk);
        head.push(p);
        emit Loaded(true, head.length - 1, p, chunk.length);
    }

    function loadBody(bytes calldata chunk) external onlyCurator open {
        address p = SSTORE2.write(chunk);
        body.push(p);
        emit Loaded(false, body.length - 1, p, chunk.length);
    }

    /// @notice One lane's gzip bytes and the keccak of what they inflate
    ///         to. Reloading an index replaces it while still loading.
    function loadPanel(uint256 i, bytes calldata chunk, bytes32 hash) external onlyCurator open {
        if (i >= PANELS || hash == 0) revert BadPanel();
        address p = SSTORE2.write(chunk);
        _panel[i] = p;
        _panelHash[i] = hash;
        emit PanelLoaded(i, p, chunk.length, hash);
    }

    /// @notice Record the size and keccak of the shell once inflated.
    function setEngineHash(bytes32 hash, uint32 size) external onlyCurator open {
        engineHash = hash;
        inflatedSize = size;
    }

    /// @notice Throw away the last shard of either run, while still loading.
    function dropLast(bool isHead) external onlyCurator open {
        if (isHead) head.pop();
        else body.pop();
    }

    /// @notice Irreversible. Nothing about the document can change afterwards.
    /// @dev    Every panel must be present: a shell whose state gap names
    ///         six hashes and whose router can serve only five is a site
    ///         with a dead lane that no later transaction can revive.
    function freeze() external onlyCurator open {
        if (head.length == 0 || body.length == 0 || engineHash == 0) revert NothingLoaded();
        for (uint256 i; i < PANELS; ++i) if (_panel[i] == address(0)) revert BadPanel();
        frozen = true;
        (uint256 h, uint256 b) = sizes();
        emit Frozen(h, b);
    }

    function setCurator(address who) external onlyCurator {
        curator = who;
        emit CuratorChanged(who);
    }

    /*──────────────────────── reading ────────────────────────*/

    function headBytes() public view returns (bytes memory out) {
        uint256 n = head.length;
        for (uint256 i; i < n; ++i) out = bytes.concat(out, SSTORE2.read(head[i]));
    }

    function bodyBytes() public view returns (bytes memory out) {
        uint256 n = body.length;
        for (uint256 i; i < n; ++i) out = bytes.concat(out, SSTORE2.read(body[i]));
    }

    /// @notice The gzip bytes of lane `i`; empty until loaded.
    function panel(uint256 i) external view returns (bytes memory) {
        if (i >= PANELS) revert BadPanel();
        address p = _panel[i];
        if (p == address(0)) return "";
        return SSTORE2.read(p);
    }

    /// @notice keccak256 of lane `i` once inflated; zero until loaded.
    function panelHash(uint256 i) external view returns (bytes32) {
        if (i >= PANELS) revert BadPanel();
        return _panelHash[i];
    }

    function panelCount() external pure returns (uint256) {
        return PANELS;
    }

    function sizes() public view returns (uint256 headSize, uint256 bodySize) {
        uint256 n = head.length;
        for (uint256 i; i < n; ++i) headSize += SSTORE2.size(head[i]);
        n = body.length;
        for (uint256 i; i < n; ++i) bodySize += SSTORE2.size(body[i]);
    }

    function shardCount() external view returns (uint256 headShards, uint256 bodyShards) {
        return (head.length, body.length);
    }

    /// @notice keccak256 of each run's stored (gzip) bytes, shard by shard,
    ///         for `/manifest` and the deployment record.
    function shardHashes() external view returns (bytes32[] memory h) {
        uint256 nh = head.length;
        uint256 nb = body.length;
        h = new bytes32[](nh + nb + PANELS);
        for (uint256 i; i < nh; ++i) h[i] = keccak256(SSTORE2.read(head[i]));
        for (uint256 i; i < nb; ++i) h[nh + i] = keccak256(SSTORE2.read(body[i]));
        for (uint256 i; i < PANELS; ++i) {
            h[nh + nb + i] = _panel[i] == address(0) ? bytes32(0) : keccak256(SSTORE2.read(_panel[i]));
        }
    }
}
