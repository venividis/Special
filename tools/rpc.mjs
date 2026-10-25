/*───────────────────────────────────────────────────────────────────────────
  INTACT · a Chain that lives on the other side of a wire (from IPSEITY)

  Every harness in tools/ runs the EVM in-process. This one signs real
  transactions and speaks JSON-RPC to a node it does not contain — a local
  hardhat, or a public testnet if you hand it an endpoint and a funded key.

  It deliberately implements the same narrow surface `tools/evm.mjs`'s
  Chain exposes (deploy / exec / read / call / getLogs / as), so that
  `deploySite` and the decoders run against a live node unchanged. The
  deployment sequence being identical in both worlds is the point: what the
  suite verified is what the testnet gets.
───────────────────────────────────────────────────────────────────────────*/
import { createLegacyTx } from "@ethereumjs/tx";
import { createCustomCommon, Mainnet, Hardfork } from "@ethereumjs/common";
import { hexToBytes, bytesToHex, privateToAddress } from "@ethereumjs/util";
import fs from "node:fs";
import path from "node:path";
import { enc, TX_GAS_CAP } from "./evm.mjs";
/// EIP-8037's ceiling on a transaction's total gas, execution and state together.
export const TX_MAX_TOTAL_GAS = 4_294_967_295n;

/*  Node's global fetch does not read HTTP(S)_PROXY, so in an environment
    whose only road out is a proxy, a request to a public endpoint dies at
    the front door while localhost works perfectly — the exact shape of bug
    that passes every local test. For non-local URLs, route through the
    proxy with undici's own fetch and trust the environment's CA bundle,
    which is how the proxy signs what it carries.                        */
let proxied = null;
const fetcher = async (url) => {
  const host = new URL(url).hostname;
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy;
  if (!proxy || host === "127.0.0.1" || host === "localhost" || host === "::1")
    return fetch;
  if (!proxied) {
    const { fetch: ufetch, ProxyAgent } = await import("undici");
    const fs = await import("node:fs");
    const caPath = process.env.NODE_EXTRA_CA_CERTS || "/root/.ccr/ca-bundle.crt";
    const requestTls = fs.existsSync(caPath) ? { ca: fs.readFileSync(caPath) } : undefined;
    const agent = new ProxyAgent({ uri: proxy, requestTls });
    proxied = (u, opts) => ufetch(u, { ...opts, dispatcher: agent });
  }
  return proxied;
};

/*  A kept-alive socket the node closed during a long local pause (solc
    compiling, mostly) surfaces as "other side closed" on the next request.
    That is not the node failing — retry on transport errors only, never on
    an RPC error, which is an answer.                                    */
/// What a replica behind the pin says: lag, retried. Anything else the node
/// says ("Method not found", a revert) is an answer and thrown at once.
const LAG = /header not found|unknown block|block not found|missing trie node|missing block/i;
const call = async (url, method, params = []) => {
  let last, lagged = 0;
  for (let attempt = 0; attempt < 7; attempt++) {
    try {
      const f = await fetcher(url);
      const r = await f(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
      });
      const j = await r.json();
      /*  The node's own error, with its `code` and revert `data` kept on the
          thrown Error (INTACT U13, additive): a refusal is proved by the
          custom error's selector in `data`, not by the message's wording. */
      if (j.error) throw Object.assign(new Error(`${method}: ${j.error.message}`), { rpc: true, code: j.error.code, data: j.error.data });
      return j.result;
    } catch (e) {
      /*  A load-balanced public endpoint answers each request from whichever
          replica the balancer picks, and a replica one block behind reports
          a pinned read as "header not found". That is lag, not an answer —
          retry it like a transport error.                               */
      if (e.rpc && !LAG.test(e.message)) throw e;
      last = e;
      /*  Lag has its own patience: a replica can sit a few blocks behind
          the one the pin names, and every retry is another draw from the
          balancer. Up to a minute of one-second draws, apart from the
          seven tries a transport error gets.                            */
      if (e.rpc) { if (++lagged > 60) break; attempt--; await new Promise((res) => setTimeout(res, 1000)); continue; }
      await new Promise((res) => setTimeout(res, 300 * (attempt + 1)));
    }
  }
  throw new Error(`${method}: the node stopped answering — ${last && last.cause ? last.cause.code || last.cause : last}`);
};

export class RpcChain {
  constructor(url, keyHex, chainId) {
    this.url = url;
    this.key = hexToBytes(keyHex.startsWith("0x") ? keyHex : "0x" + keyHex);
    const addr = bytesToHex(privateToAddress(this.key));
    this.from = { toString: () => addr };
    this.common = createCustomCommon({ chainId: Number(chainId) }, Mainnet,
      { hardfork: Hardfork.Cancun });
    this.chainId = Number(chainId);
    this.nonce = null;
    this.gas = {};
    this.lastGas = 0n;
    this.journalPath = null;
    /*  The pin every read carries (the third lag defence, after the
        receipt's logs and the wait for code): the highest block this
        process has a receipt from, or has seen the endpoint report. A
        read at "latest" on a load-balanced public endpoint is answered by
        whichever replica the balancer picks, and one a block behind
        answers from before the receipt — the first Base Sepolia rehearsal
        lost its campaign at the swap that way, the swap itself landed and
        `balanceOf` read 0. A read pinned to a block number is exact on
        any replica that has the block and "header not found" on one that
        does not, which `call` retries. Shared with every `as()` key, so
        the second key's reads see the burner's receipts.               */
    this.view = { head: 0n };
  }

  /// The block tag every read is pinned to: the highest of the receipts'
  /// blocks and the latest block the endpoint reports now.
  async tag() {
    const seen = BigInt(await this.rpc("eth_blockNumber"));
    if (seen > this.view.head) this.view.head = seen;
    return "0x" + this.view.head.toString(16);
  }

  /*  A deployment journal contains public receipt data only: never the key,
      signed transaction, or calldata. Keeping it append-only means an
      interrupted public deployment still leaves an exact nonce/address/hash
      trail that can be reconciled with the chain before anything resumes. */
  setJournal(file) {
    this.journalPath = path.resolve(file);
    fs.mkdirSync(path.dirname(this.journalPath), { recursive: true });
    fs.appendFileSync(this.journalPath, JSON.stringify({
      kind: "session", chainId: this.chainId, deployer: this.from.toString(),
      startingNonce: this.nonce.toString(), startedAt: new Date().toISOString()
    }) + "\n", { mode: 0o600 });
  }

  static async open(url, keyHex) {
    const chainId = Number(await call(url, "eth_chainId"));
    const c = new RpcChain(url, keyHex, chainId);
    c.nonce = BigInt(await call(url, "eth_getTransactionCount", [c.from.toString(), "pending"]));
    return c;
  }

  rpc(method, params = []) { return call(this.url, method, params); }

  /*  EIP-8037 (Glamsterdam; Sepolia since 2026-10-06) meters state creation
      as its own gas, 1,530 a byte, drawn from a reservoir above the EIP-7825
      cap: `tx.gas` may exceed 2^24, a transaction's execution share may not.
      Measured, never assumed: a creation that stores one byte of code costs
      about 53 k gas on a chain without it and about 212 k with it (a new
      account is 183,600 state gas). Asked once per chain; every `as()` key
      shares the answer through `view`.                                    */
  async stateGas() {
    if (this.view.stateGas === undefined) {
      const est = BigInt(await this.rpc("eth_estimateGas", [{ from: this.from.toString(), data: "0x60016000f3" }, await this.tag()]));
      this.view.oneByteCreation = est;
      this.view.stateGas = est > 150_000n;
    }
    return this.view.stateGas;
  }

  /*  Legacy transactions on purpose: one shape that every chain and every
      block explorer understands, and nothing about fee markets to be wrong
      about. The price is asked of the node and padded, because a base fee
      can rise between asking and mining.                                 */
  async send({ to, data = "0x", value = 0n, label } = {}) {
    const gasPrice = (BigInt(await this.rpc("eth_gasPrice")) * 15n) / 10n + 1n;
    const stateGas = await this.stateGas();
    let gasLimit;
    try {
      const est = await this.rpc("eth_estimateGas", [{
        from: this.from.toString(), to: to || undefined,
        data, value: "0x" + BigInt(value).toString(16)
      }, await this.tag()]);
      /*  EIP-7825: a transaction over 2^24 gas is not includable on a
          Fusaka chain. The estimate is the honest number; refuse it rather
          than send something the chain will reject or, worse, a chunk a
          pre-Fusaka testnet accepts and mainnet never will. The padded
          limit is clamped to the cap so the padding itself never trips it.
          On a chain that meters state gas (EIP-8037) the cap binds the
          execution share alone, and the node's estimate already holds it
          there, since a larger limit only deepens the state reservoir. So
          the estimate is sent as it is, up to EIP-8037's 2^32 - 1. A chain
          without EIP-8037 never meets a chunk this lets through: the
          battery holds every step to 2^24 in total, in-process, at Cancun's
          prices (tools/evm.mjs).                                         */
      if (!stateGas && BigInt(est) > TX_GAS_CAP) {
        throw new Error(`${label || "tx"} needs ${est} gas, over the EIP-7825 cap of ${TX_GAS_CAP}`);
      }
      gasLimit = (BigInt(est) * 13n) / 10n;
      const ceiling = stateGas ? TX_MAX_TOTAL_GAS : TX_GAS_CAP;
      if (gasLimit > ceiling) gasLimit = ceiling;
    } catch (e) {
      /*  estimateGas replays the call and reports the revert here, which is
          a better error than a mined failure — surface it.              */
      throw new Error(`${label || "tx"} would revert: ${e.message}`);
    }
    const nonce = this.nonce;
    const tx = createLegacyTx({
      nonce, gasPrice, gasLimit,
      to: to || undefined,
      value: BigInt(value),
      data: hexToBytes(data.startsWith("0x") ? data : "0x" + data)
    }, { common: this.common }).sign(this.key);

    const hash = await this.rpc("eth_sendRawTransaction", [bytesToHex(tx.serialize())]);
    this.nonce += 1n;

    let receipt = null;
    for (let i = 0; i < 240 && !receipt; i++) {
      receipt = await this.rpc("eth_getTransactionReceipt", [hash]);
      if (!receipt) await new Promise((r) => setTimeout(r, i < 10 ? 250 : 3000));
    }
    if (!receipt) throw new Error(`${label || "tx"} ${hash} not mined after four minutes`);
    if (receipt.status !== "0x1") throw new Error(`${label || "tx"} reverted in ${receipt.transactionHash}`);
    if (BigInt(receipt.blockNumber) > this.view.head) this.view.head = BigInt(receipt.blockNumber);
    const gas = BigInt(receipt.gasUsed);
    if (label) this.gas[label] = (this.gas[label] || 0n) + gas;
    if (this.journalPath) {
      fs.appendFileSync(this.journalPath, JSON.stringify({
        kind: to ? "call" : "deploy", nonce: nonce.toString(),
        label: label || (to ? "tx" : "deploy"), transactionHash: hash,
        contractAddress: receipt.contractAddress || null,
        blockNumber: BigInt(receipt.blockNumber).toString(),
        gasUsed: gas.toString(), recordedAt: new Date().toISOString()
      }) + "\n");
    }
    /*  The receipt's logs ride along (INTACT U10). "Take the id from the
        receipt, not from a read after the write" is one of the three
        public-RPC lag defences: a replica one block behind answers the
        read about the past, and the receipt is the only thing the node
        has already proved. tools/deploy.mjs takes the factory's
        `Deployed` address and every Engine `Loaded`/`PanelLoaded` pointer
        from these logs, and holds the endpoint to each receipt's block
        before its next read.                                           */
    return { gas, hash, address: receipt.contractAddress || null,
             block: BigInt(receipt.blockNumber), logs: receipt.logs || [] };
  }

  async deploy(bytecode, args = "", label = "") {
    const r = await this.send({ data: bytecode + args, label: label || "deploy" });
    if (!r.address) throw new Error("deployment produced no address");
    return r.address;
  }

  async exec(to, sig, args = [], { value = 0n, label } = {}) {
    return this.send({ to, data: enc(sig, args), value, label: label || sig });
  }

  /*  The nonce this chain will use next. Read from the tracker rather
      than from the node: `eth_getTransactionCount` at "pending" lags
      transactions this process has already sent and is still waiting on,
      so asking the node mid-deploy answers about the past and any address
      predicted from it is wrong. The tracker is seeded from the node at
      open and stepped once per send, which is exactly the sequence CREATE
      hashes.                                                             */
  async nonceNow() {
    if (this.nonce !== null && this.nonce !== undefined) return BigInt(this.nonce);
    return BigInt(await this.rpc("eth_getTransactionCount",
      [this.from.toString(), "pending"]));
  }

  async call(to, data, from, tag) {
    const r = await this.rpc("eth_call", [{
      from: from || this.from.toString(), to,
      data: data.startsWith("0x") ? data : "0x" + data
    }, tag || await this.tag()]);
    return r;
  }

  async read(to, sig, args = []) { return this.call(to, enc(sig, args)); }

  async codeSize(addr) {
    return (await this.rpc("eth_getCode", [addr, await this.tag()])).length / 2 - 1;
  }

  getLogs(filter) { return this.rpc("eth_getLogs", [filter]); }

  async as(keyHex) {
    const other = new RpcChain(this.url, keyHex, this.chainId);
    other.gas = this.gas;
    other.view = this.view;
    other.nonce = BigInt(await this.rpc("eth_getTransactionCount",
      [other.from.toString(), "pending"]));
    return other;
  }

  async balanceOf(addr, tag) {
    return BigInt(await this.rpc("eth_getBalance", [addr, tag || await this.tag()]));
  }
}

/*  The hardhat development mnemonic's first accounts. Printed in every
    hardhat banner since 2019; they are for chains whose ether is free and
    for nothing else.                                                    */
export const DEV_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
];
