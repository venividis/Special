/*───────────────────────────────────────────────────────────────────────────
  A small harness around @ethereumjs/vm: deploy, call, read, and account for
  the gas. Enough to run the whole collection end to end in this process,
  with no node, no network and no fork.

  Two additions for the DOM shim (U9, D15), both additive — `call`, `read`,
  `exec` and `deploy` behave exactly as before:

    · `send()` returns `hash`, the keccak of the signed transaction bytes,
      because a page learns of a landed or reverted send from the RECEIPT
      it fetches by hash, never from `eth_sendTransaction` throwing;
    · `simulate(to, data, {from, value})` runs a call under a journal
      checkpoint that is always reverted and returns `{ok, data, gas}` with
      the FULL revert data. `call()` throws on a revert and cuts the data at
      138 hex characters — enough to name an error, not enough to carry
      `Slippage(uint256,uint256)` (68 bytes) or the Router's
      `QuoteResult(uint256,uint256,uint160)` (100 bytes) whole to the page
      that decodes them.
───────────────────────────────────────────────────────────────────────────*/
import { createVM, runTx } from "@ethereumjs/vm";
import { Common, Mainnet, Hardfork, createCustomCommon } from "@ethereumjs/common";
import {
  Account, createAddressFromString, hexToBytes, bytesToHex, createAddressFromPrivateKey
} from "@ethereumjs/util";
import { createLegacyTx } from "@ethereumjs/tx";
import { createBlock } from "@ethereumjs/block";
import { keccak256 } from "ethereum-cryptography/keccak.js";

export const common = new Common({ chain: Mainnet, hardfork: Hardfork.Cancun });

/* A plausible mainnet block, so block.number, timestamp and prevrandao are
   the sort of values the contracts will actually see. */
const mkBlock = (number, timestamp) => createBlock(
  {
    header: {
      number,
      timestamp,
      gasLimit: 400_000_000n,
      baseFeePerGas: 7n,
      difficulty: 0n,
      mixHash: "0x" + "5e".repeat(32)
    }
  },
  { common, skipConsensusFormatValidation: true }
);

export const GENESIS_TIME = 1_733_000_000n;

/*  EIP-7825 (Fusaka): no transaction may use more than 2^24 gas, and the
    chains this protocol lands on either have it or will. A harness that
    let a deployment or a wiring call use 40 M would pass locally and fail
    on the first public band — so every transaction this harness sends is
    asserted under the cap, and a caller who genuinely wants to simulate
    something larger says so with `allowOverCap: true`. Views are capped
    separately, in tools/gas.mjs.                                        */
export const TX_GAS_CAP = 16_777_216n;

/* A block header is frozen once built, so moving time means building a new
   one. `export let` is a live binding, so importers that reach through the
   module namespace see the change without re-importing. */
export let BLOCK = mkBlock(21_000_000n, GENESIS_TIME);

/// @notice Move the chain to an absolute block number.
/// @dev    Twelve seconds a block, so a harness that rolls and a harness
///         that warps do not disagree about what time it is.
export function roll(number) {
  const n = BigInt(number);
  BLOCK = mkBlock(n, GENESIS_TIME + (n - 21_000_000n) * 12n);
  return BLOCK;
}

/// @notice Move the chain clock to an absolute timestamp.
export function warp(timestamp) {
  const t = BigInt(timestamp);
  const advanced = t > GENESIS_TIME ? (t - GENESIS_TIME) / 12n : 0n;
  BLOCK = mkBlock(21_000_000n + advanced, t);
  return BLOCK;
}

/*──────────────── the ABI coder ────────────────*/
/*  IPSEITY's harness coder encoded flat argument lists; INTACT's calls
    carry tuples (`SwapRequest`, `TypedCall`, `LaunchParams`, `FacetCut[]`
    for the diamond's constructor), so this is the whole static/dynamic
    head-and-tail rule of the ABI spec, over a parsed type tree. Two
    refusals are kept from the original because each cost a day:

      · `bytes` is a hex string, never a Buffer — a Buffer stringified to
        its own text and re-read as hex encodes an EMPTY argument, and the
        contract then reverts for a reason that has nothing to do with the
        test;
      · a `bytes32` given as a number is the VALUE (77 is 0x4d), not the
        digits.

    A tuple value is an array in field order, or an object whose keys are
    the field names when the type names them (`(address to,uint256 v)`). */
const pad = (h) => h.replace(/^0x/, "").padStart(64, "0");

export function sel(sig) {
  return "0x" + Buffer.from(keccak256(Buffer.from(sig, "utf8"))).toString("hex").slice(0, 8);
}

/// @dev Split a comma list at depth zero, honouring parentheses.
function splitTop(s) {
  const out = []; let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/// @dev "(address to,uint256 v)[]" → { kind:"array", len:null, inner:{kind:"tuple", components:[...]}}
export function parseType(t) {
  t = t.trim();
  const arr = t.match(/^(.*)\[(\d*)\]$/);
  if (arr) return { kind: "array", len: arr[2] === "" ? null : Number(arr[2]), inner: parseType(arr[1]) };
  if (t.startsWith("(")) {
    const inner = t.slice(1, t.lastIndexOf(")"));
    const components = inner.trim() === "" ? [] : splitTop(inner).map((c) => {
      // an optional name after the type: "uint256 amount"
      const m = c.match(/^(\(.*\)(?:\[\d*\])*|[\w$]+(?:\[\d*\])*)\s+([\w$]+)$/);
      return m ? { ...parseType(m[1]), name: m[2] } : parseType(c);
    });
    return { kind: "tuple", components };
  }
  return { kind: "base", type: t };
}

/// @dev The canonical signature text of a parsed type — names dropped.
export function canonical(t) {
  if (t.kind === "array") return canonical(t.inner) + "[" + (t.len === null ? "" : t.len) + "]";
  if (t.kind === "tuple") return "(" + t.components.map(canonical).join(",") + ")";
  return t.type;
}

export function isDynamic(t) {
  if (t.kind === "array") return t.len === null || isDynamic(t.inner);
  if (t.kind === "tuple") return t.components.some(isDynamic);
  return t.type === "bytes" || t.type === "string";
}

function encodeBase(type, v) {
  if (type === "address") return pad(String(v).slice(2).toLowerCase());
  if (type === "bool") return pad(v ? "1" : "0");
  if (type === "bytes32") {
    if (typeof v === "number" || typeof v === "bigint") return pad(BigInt(v).toString(16));
    return pad(String(v).replace(/^0x/, ""));
  }
  if (/^bytes([1-9]|[12]\d|3[0-1])$/.test(type)) {
    // a fixed-size bytesN is LEFT-aligned in its word
    return String(v).replace(/^0x/, "").padEnd(64, "0");
  }
  if (/^u?int(\d+)?$/.test(type)) {
    let n = BigInt(v);
    if (n < 0n) n = (1n << 256n) + n;
    return pad(n.toString(16));
  }
  if (type === "bytes" || type === "string") {
    if (type === "bytes") {
      if (Buffer.isBuffer(v) || v instanceof Uint8Array)
        throw new Error("harness wants bytes as a hex string, not a Buffer — " +
                        'use "0x" + buf.toString("hex")');
      if (v !== "" && !/^(0x)?([0-9a-fA-F]{2})*$/.test(String(v)))
        throw new Error("not hex, so this would encode as empty: " + String(v).slice(0, 40));
    }
    const b = type === "string" ? Buffer.from(String(v), "utf8")
                                : Buffer.from(String(v).replace(/^0x/, ""), "hex");
    return pad(b.length.toString(16)) + b.toString("hex").padEnd(Math.ceil(b.length / 32) * 64, "0");
  }
  throw new Error("harness cannot encode " + type);
}

/// @dev Head/tail encoding of a list of (type, value) pairs — the rule for
///      a tuple body, a function's arguments, and a fixed array.
function encodeSequence(types, values) {
  const headLen = types.reduce((n, t) => n + (isDynamic(t) ? 32 : staticSize(t)), 0);
  let head = "", tail = "";
  types.forEach((t, i) => {
    const e = encodeValue(t, values[i]);
    if (isDynamic(t)) { head += pad((headLen + tail.length / 2).toString(16)); tail += e; }
    else head += e;
  });
  return head + tail;
}

function staticSize(t) {
  if (t.kind === "array") return t.len * staticSize(t.inner);
  if (t.kind === "tuple") return t.components.reduce((n, c) => n + staticSize(c), 0);
  return 32;
}

function tupleValues(t, v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object" && t.components.every((c) => c.name)) return t.components.map((c) => v[c.name]);
  throw new Error("a tuple value must be an array in field order (or an object when the fields are named)");
}

export function encodeValue(t, v) {
  if (t.kind === "base") return encodeBase(t.type, v);
  if (t.kind === "tuple") return encodeSequence(t.components, tupleValues(t, v));
  const arr = v || [];
  if (t.len !== null && arr.length !== t.len) throw new Error(`expected ${t.len} elements, got ${arr.length}`);
  const body = encodeSequence(arr.map(() => t.inner), arr);
  return t.len === null ? pad(arr.length.toString(16)) + body : body;
}

/// @notice ABI-encode `values` against a comma list of types (tuples allowed).
export function encodeParams(typeList, values) {
  const types = splitTop(typeList).map(parseType);
  if (types.length !== values.length) throw new Error(`${types.length} types, ${values.length} values`);
  return encodeSequence(types, values);
}

export function enc(sig, args = []) {
  const m = sig.match(/^([\w$]+)\((.*)\)$/);
  if (!m) throw new Error("not a signature: " + sig);
  const types = m[2].trim() ? splitTop(m[2]).map(parseType) : [];
  // the selector is over the canonical text, so a signature written with
  // field names still hashes to what the contract dispatches on
  const canon = m[1] + "(" + types.map(canonical).join(",") + ")";
  return sel(canon) + encodeSequence(types, args);
}

export const decUint = (hex, i = 0) => BigInt("0x" + (hex.replace(/^0x/, "").substr(i * 64, 64) || "0"));
export const decAddr = (hex, i = 0) => "0x" + hex.replace(/^0x/, "").substr(i * 64, 64).slice(24);
export const decBool = (hex, i = 0) => decUint(hex, i) !== 0n;

export function decString(hex) {
  const h = hex.replace(/^0x/, "");
  if (h.length < 128) return "";
  const off = Number(BigInt("0x" + h.substr(0, 64))) * 2;
  const len = Number(BigInt("0x" + h.substr(off, 64)));
  return Buffer.from(h.substr(off + 64, len * 2), "hex").toString("utf8");
}

/// @param at index of the head word holding the offset to the array
export function decStringArray(hex, at = 0) {
  const h = hex.replace(/^0x/, "");
  const base = Number(BigInt("0x" + h.substr(at * 64, 64))) * 2;
  const n = Number(BigInt("0x" + h.substr(base, 64)));
  const out = [];
  for (let i = 0; i < n; i++) {
    const off = base + 64 + Number(BigInt("0x" + h.substr(base + 64 + i * 64, 64))) * 2;
    const len = Number(BigInt("0x" + h.substr(off, 64)));
    out.push(Buffer.from(h.substr(off + 64, len * 2), "hex").toString("utf8"));
  }
  return out;
}

/*──────────────── the chain ────────────────*/
export class Chain {
  constructor(vm, key) {
    this.vm = vm;
    this.key = key;
    this.from = createAddressFromPrivateKey(key);
    this.nonce = 0n;
    this.gas = {};
    /*  Shared with every actor `as()` mints, because a conversation with
        two people in it is one archive and not two.                     */
    this.log = [];
  }

  /**
   * @param {{chainId?: number|bigint}} [opts] A chain to pretend to be.
   *
   * Defaults to mainnet, which is what every existing suite expects. It is
   * an option because `block.chainid` is an opcode and no mock can stand
   * in front of it: a contract that behaves differently per chain — and
   * this collection's do, since the edition is partitioned across five —
   * has branches that simply cannot be reached from a harness pinned to
   * one. The branch that protects every testnet was the one out of reach.
   */
  static async open(opts = {}) {
    const chainCommon = opts.chainId === undefined
      ? common
      : createCustomCommon({ chainId: Number(opts.chainId) }, Mainnet,
          { hardfork: Hardfork.Cancun });
    const vm = await createVM({ common: chainCommon });
    const key = hexToBytes("0x" + "11".repeat(32));
    const chain = new Chain(vm, key);
    chain.common = chainCommon;
    await vm.stateManager.putAccount(
      chain.from,
      new Account(0n, 10n ** 24n)
    );
    return chain;
  }

  async fund(addrHex, wei) {
    const a = createAddressFromString(addrHex);
    const acct = (await this.vm.stateManager.getAccount(a)) ?? new Account();
    acct.balance += BigInt(wei);
    await this.vm.stateManager.putAccount(a, acct);
  }

  /// @notice A second actor on the same chain: same VM, same state, a
  ///         different key.
  /// @dev    Worth the four lines. "A renter cannot sell it" is only a
  ///         claim about the contract when the address attempting it
  ///         genuinely is not the holder — tested with one key and a flag,
  ///         it is a claim about the test.
  async as(keyHex, wei = 10n ** 22n) {
    const other = new Chain(this.vm, hexToBytes(keyHex));
    other.gas = this.gas;
    other.log = this.log;
    await this.fund(other.from.toString(), wei);
    return other;
  }

  /// The deployer's next nonce, read from state — the number CREATE hashes
  /// with the sender to decide where a contract lands.
  async nonceNow() {
    const acct = await this.vm.stateManager.getAccount(this.from);
    return acct ? acct.nonce : 0n;
  }

  async balanceOf(addrHex) {
    const acct = await this.vm.stateManager.getAccount(createAddressFromString(addrHex));
    return acct ? acct.balance : 0n;
  }

  async send({ to = null, data = "0x", value = 0n, label = "", gasLimit = 400_000_000n, allowOverCap = false }) {
    // read the nonce back from state rather than tracking it: a tx that
    // reverts still consumes one, and a tx rejected at validation does not
    const sender = await this.vm.stateManager.getAccount(this.from);
    const tx = createLegacyTx(
      {
        nonce: sender ? sender.nonce : 0n,
        gasPrice: 10n,
        gasLimit,
        to: to ? createAddressFromString(to) : undefined,
        value: BigInt(value),
        data: hexToBytes(data.startsWith("0x") ? data : "0x" + data)
      },
      /*  This chain's own common, not the module's. A legacy transaction
          signed against mainnet and replayed on a chain that says it is
          8453 is a signature over the wrong id, and the sender recovers to
          somebody else — which reads as a balance error rather than as
          what it is.                                                   */
      { common: this.common || common }
    ).sign(this.key);

    const res = await runTx(this.vm, {
      tx, block: BLOCK,
      skipBalance: true, skipBlockGasLimitValidation: true, skipHardForkValidation: true
    });
    const err = res.execResult.exceptionError;
    if (err) {
      const ret = bytesToHex(res.execResult.returnValue || new Uint8Array());
      throw new Error(
        `${label || "tx"} reverted: ${err.error}` + (ret && ret !== "0x" ? ` data=${ret.slice(0, 138)}` : "")
      );
    }
    if (res.totalGasSpent > TX_GAS_CAP && !allowOverCap) {
      throw new Error(`${label || "tx"} used ${res.totalGasSpent} gas, over the EIP-7825 transaction cap ` +
                      `of ${TX_GAS_CAP} — it would not be includable on a Fusaka chain`);
    }
    if (label) this.gas[label] = (this.gas[label] || 0n) + res.totalGasSpent;
    this._record(res, tx);
    return {
      gas: res.totalGasSpent,
      address: res.createdAddress ? res.createdAddress.toString() : null,
      ret: bytesToHex(res.execResult.returnValue || new Uint8Array()),
      logs: res.execResult.logs || [],
      hash: bytesToHex(tx.hash())
    };
  }

  /// @notice An `eth_call` / `eth_estimateGas` as a wallet shim needs it:
  ///         never throws on a revert, never commits, carries the whole
  ///         revert data. `{ok, data, gas, error}` — `data` is the return
  ///         value on success and the revert data on failure (the custom
  ///         error's selector and arguments, uncut); `error` names the
  ///         exception kind when `ok` is false; `gas` is the execution gas.
  /// @dev    `runCall` on its own commits a successful call's writes into
  ///         the state manager (`call()` has always done that — a quote that
  ///         wrote storage would persist). Here the call runs between
  ///         `journal.checkpoint()` and `journal.revert()`, so the state
  ///         after is the state before whatever the call did; a `view` and
  ///         a would-be write simulate identically, as on a node.
  async simulate(to, data, { from, value = 0n, gasLimit = 3_000_000_000n } = {}) {
    const journal = this.vm.evm.journal;
    const caller = createAddressFromString(from || this.from.toString());
    await journal.checkpoint();
    try {
      const res = await this.vm.evm.runCall({
        to: createAddressFromString(to),
        caller,
        origin: caller,
        data: hexToBytes(data.startsWith("0x") ? data : "0x" + data),
        gasLimit: BigInt(gasLimit),
        value: BigInt(value),
        block: BLOCK
      });
      const err = res.execResult.exceptionError;
      return {
        ok: !err,
        data: bytesToHex(res.execResult.returnValue || new Uint8Array()),
        gas: res.execResult.executionGasUsed,
        error: err ? err.error : null
      };
    } finally {
      await journal.revert();
    }
  }

  /*  A log ledger.

      The client this collection ships reads a conversation by walking logs
      one block at a time, and a harness with no logs in it cannot tell
      whether that walk terminates — which is the only property of the walk
      that matters, because the failure is a browser asking somebody's node
      for the same block forever.

      So every transaction's logs are kept with the block they landed in,
      and `getLogs` answers the shape and the filter rules a node answers
      with: inclusive block bounds, positional topic matching, null for
      "any", and an array for "any of these".                            */
  _record(res, tx) {
    const n = BLOCK.header.number;
    const hex = (u) => "0x" + Buffer.from(u).toString("hex");
    for (const l of res.execResult.logs || []) {
      const [addr, topics, data] = l;
      this.log.push({
        address: hex(addr),
        topics: topics.map(hex),
        data: hex(data),
        blockNumber: "0x" + n.toString(16),
        logIndex: "0x" + this.log.length.toString(16),
        transactionHash: hex(tx.hash())
      });
    }
  }

  getLogs({ address, fromBlock, toBlock, topics } = {}) {
    const at = (v, d) => (v == null || v === "latest" || v === "pending" ? d : BigInt(v));
    const lo = at(fromBlock, 0n);
    const hi = at(toBlock, BLOCK.header.number);
    const want = String(address || "").toLowerCase();
    return this.log.filter((l) => {
      const n = BigInt(l.blockNumber);
      if (n < lo || n > hi) return false;
      if (want && l.address.toLowerCase() !== want) return false;
      for (let i = 0; i < (topics || []).length; ++i) {
        const t = topics[i];
        if (t == null) continue;
        const set = Array.isArray(t) ? t : [t];
        const got = String(l.topics[i] || "").toLowerCase();
        if (!set.some((x) => String(x).toLowerCase() === got)) return false;
      }
      return true;
    });
  }

  async deploy(bytecode, args = "", label = "") {
    const r = await this.send({ data: bytecode + args, label: label || "deploy" });
    if (!r.address) throw new Error("deployment produced no address");
    return r.address;
  }

  /// @dev A read. Runs as a call so state is untouched and gas is free.
  async call(to, data, from) {
    const res = await this.vm.evm.runCall({
      to: createAddressFromString(to),
      caller: createAddressFromString(from || this.from.toString()),
      origin: createAddressFromString(from || this.from.toString()),
      data: hexToBytes(data.startsWith("0x") ? data : "0x" + data),
      gasLimit: 3_000_000_000n,
      value: 0n,
      block: BLOCK
    });
    if (res.execResult.exceptionError) {
      const ret = bytesToHex(res.execResult.returnValue || new Uint8Array());
      throw new Error(`call reverted: ${res.execResult.exceptionError.error} ${ret.slice(0, 138)}`);
    }
    this.lastGas = res.execResult.executionGasUsed;
    return bytesToHex(res.execResult.returnValue);
  }

  async read(to, sig, args = []) {
    return this.call(to, enc(sig, args));
  }

  async exec(to, sig, args = [], opts = {}) {
    return this.send({ to, data: enc(sig, args), label: opts.label || sig, ...opts });
  }

  async codeSize(addrHex) {
    const code = await this.vm.stateManager.getCode(createAddressFromString(addrHex));
    return code.length;
  }
}

export function encodeAddressArg(a) {
  return pad(String(a).slice(2).toLowerCase());
}
export function encodeUintArg(n) {
  return pad(BigInt(n).toString(16));
}
