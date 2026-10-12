/*───────────────────────────────────────────────────────────────────────────
  INTACT · verify-site group "identity" — who the token is and who may act
  as it (H §7.6 planned 13 sentences, M1–M13; the blocks below run more,
  one per control the lane offers)

  Blocks, on the runner's fresh chain: A the holder's page on #1 (M1 the
  rule verbatim, M13 the hash manifest, M10 no ENS row, the plain account's
  7702 row, M3 the rights of any address, M4 the fingerprint diff, M6 the
  trait keys, M7 the key two-step, M9 the proposal, M11 the Grip warning,
  M12 per-owner approvals and the one-write revoke, M8 the guardian form,
  and beside them: the single approval, the user's expiry and the operator's
  on the chain's clock, the pin and the unpin, the seal ratchet and its
  RatchetOnly before the wallet, the holder's own pause and re-arm, a clock
  that will not answer, a name over 32 bytes); B the other hands on #1 (the
  renter and the guardian for M8, the guardian's one control, M9's
  acceptance by the proposed wallet and by nobody else); C the sale (M2 on
  #2: Active at mint, Paused after the sale, the re-arm the new holder's
  only); D the 7702 delegate on #3 (M5: known by name, read live; unknown,
  the spending controls hidden until #ack-delegate); E the gates (the
  viewer, rights that could not be read, reads that will not answer, the
  collection page). No BUILD-PLAN §U9 sentence is owned here (CONSOLE §15
  names identity.mjs beside the eleven); M1's rule is asserted verbatim.

  Dropped from H §7.6: nothing. M3 is asserted on `data-right` and
  `data-state`, the names CONSOLE §6.2 settled for the identity chips
  (`data-bit` is Home's satellite vocabulary, and the plan's line predates
  the split). M4 moves the fingerprint with openMarket on the chain, as
  planned (Pool.marketHash is a word of the fingerprint).

  Setup this group performs on its chain (every id literal below refers to
  it): #1, #2 to `me`; #3 to `delegated` (a coded EOA cannot send under
  EIP-3607, so it only reads — Cancun's runTx enforces it, and `me` never
  carries code); `renter` is the user of #1 for seven days. Block A sets
  #1's guardian to `guardianW` from the page, proposes `agentW` as its agent
  wallet and binds `me`'s sealing key; B pauses #1 as the guardian and
  accepts the wallet as `agentW`; C sells #2 to `buyer` on the chain.

  Elements this group reads from its panel (CONSOLE §6.2; every selector
  scoped to #lane-identity): #identity-status, #identity-status-rule,
  #identity-rights-input, #identity-rights-chips .chip[data-right][data-state],
  #identity-rights-fact, #identity-fingerprint-baked, #identity-fingerprint-live,
  #identity-delegate, #ack-delegate, #identity-curve, #identity-name,
  #identity-guardian, #identity-user, #identity-agent, #identity-proposed,
  #identity-income, #identity-face, #identity-seal, #identity-key,
  #identity-registry, #identity-manifest, input[name=curve|name|guardian|
  user|userDays|wallet|face|sealDays|operator|opDays|approvee],
  [data-act=setTrait|setStatus|pause|setGuardian|setUser|proposeAgentWallet|
  acceptAgentWallet|setFeesToGrip|pinTokenURI|unpinTokenURI|sealTransfer|
  setApprovalForAllUntil|setApprovalForAll|approve|revokeAllApprovals|
  setEncryptionKey|bindKey], [data-spend]. From the shell: the slab (#cbox.on,
  #cslab, [data-go], [data-no], [data-function], [data-calldata], [data-gas],
  [data-sentence]), #tick, body[data-rights], body[data-mode].
───────────────────────────────────────────────────────────────────────────*/
import { createAddressFromString } from "@ethereumjs/util";
import { secp256k1 } from "ethereum-cryptography/secp256k1.js";
import { keccak256 } from "ethereum-cryptography/keccak.js";

const WAD = 10n ** 18n;
const RULE = "sessions act only while Active; a sale pauses the token; re-arm to let your keys act";
const META = "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B";
const SET_TRAIT = "setTrait(uint256,bytes32,bytes32)";
const ORD = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
const PK8 = "3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420";
const hexN = (n) => "0x" + BigInt(n).toString(16);
const lower = (s) => String(s).toLowerCase();
/// word i of a calldata hex, after the four-byte selector; the address in it
const word = (cd, i) => BigInt("0x" + cd.slice(10 + 64 * i, 10 + 64 * (i + 1)));
const addrWord = (cd, i) => "0x" + cd.slice(10 + 64 * i + 24, 10 + 64 * (i + 1));
const date = (t) => new Date(Number(t) * 1e3).toISOString().replace("T", " ").slice(0, 16) + " UTC";
const reverted = () => { throw Object.assign(new Error("execution reverted"), { code: 3, data: "0xdeadbeef" }); };
/// The sealing key, derived here as the panel derives it (CONSOLE §9): the shim signs the D7
/// sentence with the actor's key (RFC 6979, so the same bytes every time), SHA-256 of the
/// 65-byte signature is rejected and re-hashed until it is a scalar, and WebCrypto computes
/// the point on a PKCS#8 import. One key per wallet: no token, no epoch in the sentence.
async function sealKey(actor, chainId, hub) {
  const msg = Buffer.from(`INTACT seal v1 · chain ${chainId} · hub ${lower(hub)}`, "utf8");
  const pre = Buffer.concat([Buffer.from("\x19Ethereum Signed Message:\n" + msg.length, "utf8"), msg]);
  const sg = secp256k1.sign(keccak256(pre), actor.key);
  const sig = Buffer.concat([Buffer.from(sg.toCompactRawBytes()), Buffer.from([27 + sg.recovery])]);
  let h = new Uint8Array(await crypto.subtle.digest("SHA-256", sig));
  for (;;) { const d = BigInt("0x" + Buffer.from(h).toString("hex")); if (d > 0n && d < ORD) break; h = new Uint8Array(await crypto.subtle.digest("SHA-256", h)); }
  const k = await crypto.subtle.importKey("pkcs8", Buffer.from(PK8 + Buffer.from(h).toString("hex"), "hex"), { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const jwk = await crypto.subtle.exportKey("jwk", k);
  return { message: msg.toString("utf8"), pk: "0x04" + Buffer.from(jwk.x, "base64url").toString("hex") + Buffer.from(jwk.y, "base64url").toString("hex") };
}

export async function run(t, ctx) {
  const { c, site, actors, weth, sel, decUint, decAddr, kec, fs, path, ROOT, ZERO, walletFor, bootToken, bootPage, lane, mint, EVM } = ctx;
  const { me, renter, buyer, stranger, guardianW, agentW, delegated } = actors;
  const ME = me.from.toString(), BUYER = buyer.from.toString(), STRANGER = stranger.from.toString(), GUARD = guardianW.from.toString(), AGENT = agentW.from.toString(), DELEGATED = delegated.from.toString();
  const hub = site.hub, keys = site.keys, parley = site.parley, catalog = site.catalog, pool = site.pool;
  const now = () => EVM.BLOCK.header.timestamp;
  const DIST_IDENTITY = fs.readFileSync(path.join(ROOT, "dist/panels/identity.js"), "utf8");
  const L = (page, s) => page.$("#lane-identity " + s);
  const LL = (page, s) => page.$$("#lane-identity " + s);
  const laneText = (page) => page.text("#lane-identity");
  const T = (page, id) => page.text("#lane-identity #" + id);
  const slabOpen = (page) => page.$("#cbox").classList.contains("on");
  const slabCd = (page) => page.text("#cslab [data-calldata]");
  const gasRow = (page) => page.text("#cslab [data-gas]");
  const fn = (page) => page.text("#cslab [data-function]");
  const tick = (page) => page.text("#tick");
  /// a slab line by its key: the panel's own words, before the shell's rows
  const line = (page, k) => { const r = page.$$("#cslab .kv").find((x) => x.firstChild && x.firstChild.textContent === k); return r ? r.lastChild.textContent : null; };
  const press = async (page, el) => { if (!el) throw new Error("press: no control"); page.click(el); await page.until(() => slabOpen(page) && gasRow(page) !== "estimating…", 120); };
  const dismiss = async (page) => { page.click(page.$("#cslab [data-no]")); await page.settle(); };
  /// sign the open slab and wait for the receipt, the rights re-read and the repaint it fires
  const sign = async (page, W, n) => {
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    const before = tick(page);
    page.click(page.$("#cslab [data-go]"));
    await page.until(() => W.sent() === n && tick(page) !== before && /landed in block|reverted in block/.test(tick(page)), 160);
    for (let k = 0; k < 4; k++) await page.settle();
  };
  const repaint = async (page, vctx) => { vctx.dispatchEvent(new vctx.CustomEvent("intact:lane", { detail: { name: "identity" } })); await page.settle(); await page.settle(); };
  const field = (page, name) => L(page, `input[name=${name}]`);
  const acts = (page) => LL(page, "[data-act]").map((b) => b.dataset.act);
  const chips = (page) => Object.fromEntries(LL(page, "#identity-rights-chips .chip").map((ch) => [ch.dataset.right, ch.dataset.state]));
  const onlyOn = (page, ...names) => { const ch = chips(page); const all = Object.keys(ch); return all.length === 8 && all.every((k) => ch[k] === (names.includes(k) ? "on" : "off")); };
  const coreOf = async (id) => c.read(hub, "coreOf(uint256)", [id]);
  const statusOf = async (id) => decUint(await c.read(hub, "statusOf(uint256)", [id]));
  const trait = async (id, name) => c.read(hub, "getTraitValue(uint256,bytes32)", [id, kec(Buffer.from(name, "utf8"))]);
  const nameWord = (s) => "0x" + Buffer.from(s, "utf8").toString("hex").padEnd(64, "0");

  /* the cast: #1, #2 to me; #3 to delegated, who only reads; the renter on #1 */
  await mint(c, site, ME); await mint(c, site, ME); await mint(c, site, DELEGATED);
  await c.exec(hub, "setUser(uint256,address,uint64)", [1, renter.from.toString(), now() + 7n * 86400n]);
  const reach1 = decAddr(await c.read(hub, "account(uint256)", [1])), grip1 = decAddr(await c.read(hub, "grip(uint256)", [1]));

  /*═══════════ A · the holder's page on #1 ═══════════*/
  t.head("A · the holder's page on #1: the rule, the facts, every control");
  {
    const W = walletFor(c, me);
    const { page, ctx: vctx, S } = await bootToken(1, { wallet: W });
    const U = vctx.INTACT.ui;
    await lane(page, "identity");
    await page.until(() => /^(Active|Paused)$/.test(T(page, "identity-status")) && /no key bound|bound at/.test(T(page, "identity-key")) && !!L(page, "[data-act=setGuardian]"), 80);
    /* M1 */
    t.ok(T(page, "identity-status-rule") === RULE && T(page, "identity-status") === "Active" && await statusOf(1) === 0n,
      "M1 the rule is printed verbatim", `"${T(page, "identity-status-rule")}" status ${T(page, "identity-status")}`);
    /* M13 */
    const manifest = page.text("#lane-identity #identity-manifest");
    t.ok(new RegExp("engine\\s*" + S.engineHash).test(manifest) && new RegExp("catalog\\s*" + S.catalogHash).test(manifest) && Object.keys(S.panels).length === 6 &&
      Object.entries(S.panels).every(([k, h]) => new RegExp("panel " + k + "\\s*" + h).test(manifest)) && /^0x[0-9a-f]{64}$/.test(S.engineHash),
      "M13 the hash manifest is the state's: the engine hash, the catalog hash and every panel's pin, printed from the block", manifest.slice(0, 200));
    /* M10 */
    t.ok(L(page, "#identity-ens") === null && page.$("#identity-ens") === null && /no ENS name on this band: there is no Nameplate/.test(laneText(page)),
      "M10 no ENS row on a band without a Nameplate", laneText(page).slice(-200));
    /* the plain account's 7702 row */
    t.ok(T(page, "identity-delegate") === "none: a plain account" && U.delegate() === null && L(page, "#ack-delegate") === null && LL(page, "[data-spend]").length >= 5 && LL(page, "[data-spend]").every((b) => !b.hidden),
      "a plain account reads none on the 7702 row, needs no acknowledgement, and every spending control is visible", `"${T(page, "identity-delegate")}" spend ${LL(page, "[data-spend]").length}`);
    /* M3: the rights of any address, from one rightsOf each */
    await page.until(() => Object.keys(chips(page)).length === 8, 40);
    const prefilled = lower(L(page, "#identity-rights-input").value) === lower(ME) && onlyOn(page, "HOLD");
    const ask = async (addr) => { const n = W.callsTo(hub, sel("rightsOf(uint256,address)")).length; page.type(L(page, "#identity-rights-input"), addr); await page.until(() => W.callsTo(hub, sel("rightsOf(uint256,address)")).length > n && Object.keys(chips(page)).length === 8, 60); };
    await ask(renter.from.toString());
    const userChips = onlyOn(page, "USE") && new RegExp("holder " + U.short(U.checksum(ME)) + " · custody epoch 1 · bits 4").test(T(page, "identity-rights-fact"));
    await ask(S.reach);
    const reachChips = onlyOn(page, "ACCOUNT") && lower(S.reach) === lower(reach1);
    await ask(ZERO);
    const zeroChips = onlyOn(page) && /bits 0$/.test(T(page, "identity-rights-fact"));
    const named = LL(page, "#identity-rights-chips .chip").every((ch) => ch.textContent === ch.dataset.right && !/:\s*0\b/.test(ch.textContent)) && LL(page, "#identity-rights-chips .chip[data-bit]").length === 0;
    t.ok(prefilled && userChips && reachChips && zeroChips && named,
      "M3 rights of any address — the holder's own address first, the renter reads USE alone, the Reach ACCOUNT alone, the zero address nothing; chips by data-right, never data-bit, never a 0",
      `prefilled ${prefilled} user ${userChips} ${JSON.stringify(chips(page))} fact "${T(page, "identity-rights-fact")}"`);
    page.type(L(page, "#identity-rights-input"), "not an address"); await page.settle();
    t.ok(T(page, "identity-rights-fact") === "an address" && Object.keys(chips(page)).length === 0, "a non-address draws no chips and says so", T(page, "identity-rights-fact"));
    /* M4: the fingerprint diff — the market opened on the chain under the open page */
    await page.until(() => /as rendered/.test(T(page, "identity-fingerprint-live")), 40);
    const baked = T(page, "identity-fingerprint-baked") === S.fingerprint && new RegExp("^" + S.fingerprint + " — as rendered$").test(T(page, "identity-fingerprint-live")) && lower(await c.read(hub, "getStateFingerprint(uint256)", [1])).slice(0, 66) === lower(S.fingerprint);
    await c.exec(weth, "mint(address,uint256)", [ME, 1000n * WAD]);
    await c.exec(weth, "approve(address,uint256)", [pool, 200n * WAD]);
    await c.exec(pool, "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)", [1, weth, ZERO, 30, 0, 0, 0], { label: "openMarket" });
    const liveFp = lower(await c.read(hub, "getStateFingerprint(uint256)", [1])).slice(0, 66);
    await repaint(page, vctx);
    await page.until(() => /changed since this document was rendered/.test(T(page, "identity-fingerprint-live")), 60);
    t.ok(baked && liveFp !== lower(S.fingerprint) && T(page, "identity-fingerprint-live") === liveFp + " — changed since this document was rendered" && T(page, "identity-fingerprint-baked") === S.fingerprint,
      "M4 the fingerprint diff — the baked word is the block's and reads as rendered; after openMarket on the chain the live word is getStateFingerprint(1) and says changed since this document was rendered",
      `baked ${baked} live "${T(page, "identity-fingerprint-live")}" chain ${liveFp}`);
    /* M6: the trait keys are the shell's own keccak */
    await page.until(() => T(page, "identity-curve") === "0 bps" && !!field(page, "curve"), 40);
    page.type(field(page, "curve"), "4500");
    await press(page, LL(page, "[data-act=setTrait]")[0]);
    const ccd = slabCd(page);
    t.ok(fn(page) === SET_TRAIT && word(ccd, 0) === 1n && "0x" + ccd.slice(10 + 64, 10 + 128) === kec(Buffer.from("curve", "utf8")) && word(ccd, 2) === 4500n && /curve 0 bps → 4500 bps/.test(page.text("#cslab")) &&
      /re-anchor/.test(page.text("#cslab")) && /^\d+ units$/.test(gasRow(page)) && lower(page.text("#cslab [data-to]")) === lower(hub),
      "M6 the trait keys are the shell's own keccak — the setTrait slab's word 1 is keccak(\"curve\"), word 2 the bps, and it reads curve 0 bps → 4500 bps", `fn ${fn(page)} w1 ${ccd.slice(10 + 64, 10 + 128)} w2 ${word(ccd, 2)} slab "${page.text("#cslab").slice(0, 120)}"`);
    await sign(page, W, 1);
    await page.until(() => T(page, "identity-curve") === "4500 bps", 60);
    t.ok(decUint(await trait(1, "curve")) === 4500n && T(page, "identity-curve") === "4500 bps", "Sign → getTraitValue(1, keccak(\"curve\")) is 4500 and the lane reads it", T(page, "identity-curve"));
    await page.until(() => !!field(page, "name"), 40);
    page.type(field(page, "name"), "x".repeat(33));
    page.click(LL(page, "[data-act=setTrait]")[1]); await page.settle(); await page.settle();
    t.ok(!slabOpen(page) && tick(page) === "a name is at most 32 bytes and that is 33", "a name over 32 bytes is a sentence, no slab", tick(page));
    page.type(field(page, "name"), "Agent One · Δ");
    await press(page, LL(page, "[data-act=setTrait]")[1]);
    const ncd = slabCd(page);
    t.ok(fn(page) === SET_TRAIT && "0x" + ncd.slice(10 + 64, 10 + 128) === kec(Buffer.from("name", "utf8")) && "0x" + ncd.slice(10 + 128, 10 + 192) === nameWord("Agent One · Δ") && /name — → Agent One · Δ/.test(page.text("#cslab")) && /^\d+ units$/.test(gasRow(page)),
      "M6 the name slab's word 1 is keccak(\"name\") and word 2 the UTF-8 bytes, left-aligned in one word", `w1 ${ncd.slice(10 + 64, 10 + 128)} w2 ${ncd.slice(10 + 128, 10 + 192)} vs ${nameWord("Agent One · Δ")}`);
    await sign(page, W, 2);
    await page.until(() => T(page, "identity-name") === "Agent One · Δ", 60);
    t.ok(lower(await trait(1, "name")).slice(0, 66) === nameWord("Agent One · Δ") && T(page, "identity-name") === "Agent One · Δ" && L(page, "#identity-name").children.length === 0,
      "Sign → the name trait is the word, and the lane prints it as text", T(page, "identity-name"));
    /* M7: the key two-step */
    await page.until(() => T(page, "identity-key") === "no key bound" && !!L(page, "[data-act=setEncryptionKey]"), 40);
    const mine = await sealKey(me, S.chainId, hub);
    const noKey = T(page, "identity-key") === "no key bound" && T(page, "identity-registry") === "none published" && L(page, "[data-act=bindKey]") === null && (await c.read(parley, "keyOf(uint256)", [1])).length === 2 + 64 * 4 &&
      /derive and publish the sealing key/.test(L(page, "[data-act=setEncryptionKey]").textContent) && /sign this sentence nowhere but here/.test(laneText(page)) && /no forward secrecy/.test(laneText(page));
    const p0 = W.prompts().length;
    await press(page, L(page, "[data-act=setEncryptionKey]"));
    const ps = W.prompts().slice(p0).filter((p) => p.method === "personal_sign");
    const kcd = slabCd(page), klen = Number(word(kcd, 2)), kbytes = "0x" + kcd.slice(10 + 64 * 3, 10 + 64 * 3 + klen * 2);
    t.ok(noKey && ps.length === 1 && ps[0].message === mine.message && !/token|epoch/i.test(ps[0].message) && fn(page) === "setEncryptionKey(uint16,bytes)" && word(kcd, 0) === 3n && klen === 65 && kbytes.startsWith("0x04") && lower(kbytes) === lower(mine.pk) &&
      lower(page.text("#cslab [data-to]")) === lower(keys) && /^\d+ units$/.test(gasRow(page)) && !DIST_IDENTITY.includes("personal_sign"),
      "M7 the encryption key is a two-step — no key bound, then the shell's one personal_sign of exactly the D7 sentence and a setEncryptionKey slab: word 0 is 3, the bytes 65 long from 04, the point this wallet's signature derives; the shipped panel never names personal_sign",
      `noKey ${noKey} prompts ${ps.length} "${ps[0] && ps[0].message}" fn ${fn(page)} w0 ${word(kcd, 0)} len ${klen} pk ${kbytes.slice(0, 14)} vs ${mine.pk.slice(0, 14)}`);
    await sign(page, W, 3);
    await page.until(() => !!L(page, "[data-act=bindKey]"), 60);
    const rid = await c.read(keys, "keyIdOf(address)", [ME]);
    t.ok(lower(rid) === kec(Buffer.from(mine.pk.slice(2), "hex")) && T(page, "identity-key") === "no key bound" && /published · id 0x[0-9a-f]{8}… · the one derived here/.test(T(page, "identity-registry")) &&
      /^publish the sealing key$/.test(L(page, "[data-act=setEncryptionKey]").textContent) && !!L(page, "[data-act=bindKey]") && W.prompts().filter((p) => p.method === "personal_sign").length === 1,
      "M7 after the registry slab lands the next step offers bindKey(uint256): the registry key is the derived one, the token is still unbound, and the sentence was signed once", `registry "${T(page, "identity-registry")}" key "${T(page, "identity-key")}" acts ${acts(page).join(",")}`);
    await press(page, L(page, "[data-act=bindKey]"));
    t.ok(fn(page) === "bindKey(uint256)" && word(slabCd(page), 0) === 1n && lower(page.text("#cslab [data-to]")) === lower(parley) && /custody epoch 1/.test(page.text("#cslab [data-sentence]")) && /^\d+ units$/.test(gasRow(page)),
      "the binding slab is bindKey(1) to Parley, stamped with custody epoch 1 in its sentence", `fn ${fn(page)} w0 ${word(slabCd(page), 0)} "${page.text("#cslab [data-sentence]")}"`);
    await sign(page, W, 4);
    await page.until(() => /bound at epoch 1/.test(T(page, "identity-key")), 60);
    const ko = await c.read(parley, "keyOf(uint256)", [1]);
    t.ok(/^bound at epoch 1 · P-256 · key 0x[0-9a-f]{8}…$/.test(T(page, "identity-key")) && decUint(ko, 0) === 3n && "0x" + ko.slice(66, 130) === lower(rid) && lower("0x" + ko.slice(2 + 64 * 4, 2 + 64 * 4 + 130)) === lower(mine.pk) && T(page, "identity-key").includes(lower(rid).slice(0, 10)),
      "M7 Sign → keyOf(1) answers (3, keccak(pk), pk) and the lane reads bound at epoch 1", `"${T(page, "identity-key")}" type ${decUint(ko, 0)}`);
    /* M9: the agent wallet is proposed */
    await page.until(() => !!field(page, "wallet") && T(page, "identity-proposed") === "none", 40);
    page.type(field(page, "wallet"), AGENT);
    await press(page, L(page, "[data-act=proposeAgentWallet]"));
    t.ok(fn(page) === "proposeAgentWallet(uint256,address)" && word(slabCd(page), 0) === 1n && lower(addrWord(slabCd(page), 1)) === lower(AGENT) && /accepts, by sending/.test(page.text("#cslab")) && L(page, "[data-act=proposeAgentWallet]").hasAttribute("data-spend") && /^\d+ units$/.test(gasRow(page)),
      "M9 the agent wallet is proposed — a proposeAgentWallet(uint256,address) slab naming the wallet, bound only when it accepts by sending; the control is marked as spending", `fn ${fn(page)} w1 ${addrWord(slabCd(page), 1)}`);
    await sign(page, W, 5);
    await page.until(() => /pending/.test(T(page, "identity-proposed")), 60);
    t.ok(T(page, "identity-proposed") === U.checksum(AGENT) + " · pending: it accepts by sending" && lower(decAddr(await coreOf(1), 13)) === lower(AGENT) && T(page, "identity-agent") === "none: the Reach answers as it" && L(page, "[data-act=acceptAgentWallet]") === null,
      "M9 after Sign #identity-proposed names it pending, nothing is bound yet, and the holder is not offered the acceptance", `"${T(page, "identity-proposed")}" acts ${acts(page).join(",")}`);
    /* M11: income into the Grip is warned as permanent */
    await page.until(() => !!L(page, "[data-act=setFeesToGrip]"), 40);
    const warnedFirst = /income into the Grip is permanently unspendable/.test(laneText(page)) && T(page, "identity-income") === "to the Reach" && L(page, "[data-act=setFeesToGrip]").textContent === "route income into the Grip";
    await press(page, L(page, "[data-act=setFeesToGrip]"));
    const slab11 = page.text("#cslab"), iw = slab11.indexOf("permanently unspendable"), ifn = slab11.indexOf("Function");
    t.ok(warnedFirst && fn(page) === "setFeesToGrip(uint256,bool)" && word(slabCd(page), 1) === 1n && iw >= 0 && ifn > iw && line(page, "Warning") === "income into the Grip is permanently unspendable" && /^\d+ units$/.test(gasRow(page)),
      "M11 income into the Grip is warned as permanent — in the lane before the control, and as the slab's first line, before the function row", `lane ${warnedFirst} warning at ${iw} function at ${ifn} "${line(page, "Warning")}"`);
    await sign(page, W, 6);
    await page.until(() => /into the Grip/.test(T(page, "identity-income")), 60);
    t.ok(T(page, "identity-income") === "into the Grip: permanently unspendable" && lower(decAddr(await c.read(hub, "feeSink(uint256)", [1]))) === lower(grip1) && L(page, "[data-act=setFeesToGrip]").textContent === "route income to the Reach again",
      "Sign → feeSink(1) is the Grip, the lane says so, and the control now offers the Reach again", T(page, "identity-income"));
    /* M12: operator approvals are per owner and the slab says so; the revoke is one write */
    await page.until(() => !!field(page, "operator"), 40);
    const epoch0 = decUint(await c.read(hub, "approvalEpoch(address)", [ME]));
    page.type(field(page, "operator"), STRANGER); page.type(field(page, "opDays"), "30");
    const ts12 = now();
    W.override("eth_getBlockByNumber", () => ({ number: hexN(EVM.BLOCK.header.number), timestamp: hexN(ts12 + 7777n), hash: "0x" + "11".repeat(32) }));
    await press(page, L(page, "[data-act=setApprovalForAllUntil]"));
    W.override("eth_getBlockByNumber", null);
    const ocd = slabCd(page);
    t.ok(fn(page) === "setApprovalForAllUntil(address,uint64)" && lower(addrWord(ocd, 0)) === lower(STRANGER) && word(ocd, 1) === ts12 + 7777n + 30n * 86400n && /every token you hold/.test(page.text("#cslab")) && line(page, "Scope") === "every token you hold, not only #1" &&
      L(page, "[data-act=setApprovalForAllUntil]").hasAttribute("data-spend") && /^\d+ units$/.test(gasRow(page)),
      "M12 operator approvals are per owner and the slab says so — setApprovalForAllUntil names the operator, every token you hold, and an expiry thirty days on the chain's clock", `fn ${fn(page)} w1 ${word(ocd, 1)} vs ${ts12 + 7777n + 30n * 86400n} scope "${line(page, "Scope")}"`);
    await sign(page, W, 7);
    const expiry = decUint(await c.read(hub, "approvalExpiryOf(address,address)", [ME, STRANGER]));
    t.ok(expiry === ts12 + 7777n + 30n * 86400n && (await c.read(hub, "isApprovedForAll(address,address)", [ME, STRANGER])).endsWith("1"), "Sign → approvalExpiryOf(me, stranger) is the word the slab carried", `${expiry}`);
    await page.until(() => !!field(page, "operator"), 40);
    page.type(field(page, "operator"), STRANGER);
    await press(page, L(page, "[data-act=setApprovalForAll]"));
    t.ok(fn(page) === "setApprovalForAll(address,bool)" && lower(addrWord(slabCd(page), 0)) === lower(STRANGER) && word(slabCd(page), 1) === 1n && /every token you hold/.test(page.text("#cslab")) && /unbounded/.test(page.text("#cslab")) && L(page, "[data-act=setApprovalForAll]").hasAttribute("data-spend"),
      "the unbounded form says what it is: setApprovalForAll(operator, true), every token you hold, no end until revoked", page.text("#cslab").slice(0, 160));
    await dismiss(page);
    page.type(field(page, "approvee"), STRANGER);
    await press(page, L(page, "[data-act=approve]"));
    t.ok(fn(page) === "approve(address,uint256)" && lower(addrWord(slabCd(page), 0)) === lower(STRANGER) && word(slabCd(page), 1) === 1n && lower(page.text("#cslab [data-to]")) === lower(hub) && L(page, "[data-act=approve]").hasAttribute("data-spend") && /^\d+ units$/.test(gasRow(page)),
      "the single approval is the hub's approve(address,uint256), for this token alone, marked as spending", `fn ${fn(page)} to ${page.text("#cslab [data-to]")}`);
    await sign(page, W, 8);
    await page.until(() => !!L(page, "#identity-rights-input"), 40);
    await ask(STRANGER);
    t.ok(lower(decAddr(await c.read(hub, "getApproved(uint256)", [1]))) === lower(STRANGER) && onlyOn(page, "CUSTODY"), "Sign → getApproved(1) is the stranger, and the rights reader shows CUSTODY alone for it", JSON.stringify(chips(page)));
    await press(page, L(page, "[data-act=revokeAllApprovals]"));
    t.ok(fn(page) === "revokeAllApprovals()" && slabCd(page).length === 10 && /every token you hold/.test(page.text("#cslab")) && /in one write/.test(page.text("#cslab [data-sentence]")) && /^\d+ units$/.test(gasRow(page)),
      "revokeAllApprovals() carries no argument and says it drops every operator over every token you hold in one write", page.text("#cslab [data-sentence]"));
    await sign(page, W, 9);
    const epoch1 = decUint(await c.read(hub, "approvalEpoch(address)", [ME]));
    t.ok(epoch1 === epoch0 + 1n && W.sent() === 9 && (await c.read(hub, "isApprovedForAll(address,address)", [ME, STRANGER])).endsWith("0"),
      "M12 revokeAllApprovals() is one transaction and approvalEpoch(me) moved by one: the timed operator is gone", `epoch ${epoch0} → ${epoch1} sent ${W.sent()}`);
    /* M8: the guardian form is the holder's */
    await page.until(() => !!field(page, "guardian") && T(page, "identity-guardian") === "nobody", 40);
    page.type(field(page, "guardian"), GUARD);
    await press(page, L(page, "[data-act=setGuardian]"));
    t.ok(fn(page) === "setGuardian(uint256,address)" && lower(addrWord(slabCd(page), 1)) === lower(GUARD) && /pause, panic, seal and revoke sessions/.test(page.text("#cslab [data-sentence]")) && /^\d+ units$/.test(gasRow(page)),
      "M8 the guardian form is the holder's — present for the holder, and its slab names what a guardian may do", `fn ${fn(page)} "${page.text("#cslab [data-sentence]")}"`);
    await sign(page, W, 10);
    await page.until(() => T(page, "identity-guardian") === U.checksum(GUARD), 60);
    t.ok(lower(decAddr(await c.read(hub, "guardianOf(uint256)", [1]))) === lower(GUARD) && T(page, "identity-guardian") === U.checksum(GUARD) && field(page, "guardian").value === U.checksum(GUARD),
      "Sign → guardianOf(1) is guardianW, the lane names it, and the form starts from it", T(page, "identity-guardian"));
    /* the user: a date on the chain's clock, moved first; 0x0 takes it back with no clock asked */
    await page.until(() => !!field(page, "user"), 40);
    t.ok(field(page, "user").value === U.checksum(renter.from.toString()) && new RegExp("^" + U.checksum(renter.from.toString()) + " until " + date(decUint(await coreOf(1), 11)) + "$").test(T(page, "identity-user")),
      "the user row reads the renter and its expiry, and the form starts from the renter", T(page, "identity-user"));
    page.type(field(page, "user"), BUYER); page.type(field(page, "userDays"), "3");
    const tsU = now();
    W.override("eth_getBlockByNumber", () => ({ number: hexN(EVM.BLOCK.header.number), timestamp: hexN(tsU + 7777n), hash: "0x" + "11".repeat(32) }));
    await press(page, L(page, "[data-act=setUser]"));
    W.override("eth_getBlockByNumber", null);
    const ucd = slabCd(page);
    t.ok(fn(page) === "setUser(uint256,address,uint64)" && lower(addrWord(ucd, 1)) === lower(BUYER) && word(ucd, 2) === tsU + 7777n + 3n * 86400n && /a sale ends it/.test(page.text("#cslab [data-sentence]")) && L(page, "[data-act=setUser]").hasAttribute("data-spend"),
      "the user's expiry is three days on the chain's clock, read at the press; the control is marked as spending", `w2 ${word(ucd, 2)} vs ${tsU + 7777n + 3n * 86400n}`);
    await dismiss(page);
    const clocks0 = W.count("eth_getBlockByNumber");
    page.type(field(page, "user"), "0x0");
    await press(page, L(page, "[data-act=setUser]"));
    t.ok(fn(page) === "setUser(uint256,address,uint64)" && lower(addrWord(slabCd(page), 1)) === ZERO && word(slabCd(page), 2) === 0n && /takes #1 back from its user/.test(page.text("#cslab [data-sentence]")) && W.count("eth_getBlockByNumber") === clocks0,
      "0x0 takes it back: setUser(1, 0x0, 0), and no clock is asked for a date nobody needs", `w2 ${word(slabCd(page), 2)} clocks +${W.count("eth_getBlockByNumber") - clocks0}`);
    await dismiss(page);
    /* the face: pinned, then unpinned */
    t.ok(T(page, "identity-face") === "none: the Renderer chooses" && L(page, "[data-act=unpinTokenURI]") === null, "with nothing pinned the lane says the Renderer chooses and offers no unpin", T(page, "identity-face"));
    page.type(field(page, "face"), "2");
    await press(page, L(page, "[data-act=pinTokenURI]"));
    t.ok(fn(page) === "pinTokenURI(uint256,uint256)" && word(slabCd(page), 1) === 2n && /a sale unpins it/.test(page.text("#cslab [data-sentence]")) && /^\d+ units$/.test(gasRow(page)), "the pin slab names face 2 and says a sale unpins it", page.text("#cslab [data-sentence]"));
    await sign(page, W, 11);
    await page.until(() => T(page, "identity-face") === "face 2" && !!L(page, "[data-act=unpinTokenURI]"), 60);
    t.ok(decUint(await coreOf(1), 1) === 3n && T(page, "identity-face") === "face 2", "Sign → coreOf's pinned face is index + 1, and the lane reads face 2", T(page, "identity-face"));
    await press(page, L(page, "[data-act=unpinTokenURI]"));
    t.ok(fn(page) === "unpinTokenURI(uint256)" && word(slabCd(page), 0) === 1n, "the unpin slab is unpinTokenURI(1)", fn(page));
    await sign(page, W, 12);
    await page.until(() => T(page, "identity-face") === "none: the Renderer chooses", 60);
    t.ok(decUint(await coreOf(1), 1) === 0n && L(page, "[data-act=unpinTokenURI]") === null, "Sign → unpinned, and the unpin is gone", T(page, "identity-face"));
    /* the seal ratchet: thirty days on the chain's clock; a shorter one is RatchetOnly before the wallet */
    page.type(field(page, "sealDays"), "30");
    const tsS = now();
    W.override("eth_getBlockByNumber", () => ({ number: hexN(EVM.BLOCK.header.number), timestamp: hexN(tsS + 7777n), hash: "0x" + "11".repeat(32) }));
    await press(page, L(page, "[data-act=sealTransfer]"));
    W.override("eth_getBlockByNumber", null);
    const scd = slabCd(page);
    t.ok(fn(page) === "sealTransfer(uint256,uint64)" && word(scd, 1) === tsS + 7777n + 30n * 86400n && /only ever lengthens/.test(page.text("#cslab [data-sentence]")) && line(page, "Reversible") === "no: it only ever lengthens" && /^\d+ units$/.test(gasRow(page)),
      "the seal is thirty days on the chain's clock, and the slab says it only ever lengthens", `w1 ${word(scd, 1)} vs ${tsS + 7777n + 30n * 86400n}`);
    await sign(page, W, 13);
    await page.until(() => /^until /.test(T(page, "identity-seal")), 60);
    const sealUntil = decUint(await c.read(hub, "transferSealUntil(uint256)", [1]));
    t.ok(sealUntil === tsS + 7777n + 30n * 86400n && T(page, "identity-seal") === "until " + date(sealUntil), "Sign → transferSealUntil(1) is the word, and the lane reads it", T(page, "identity-seal"));
    page.type(field(page, "sealDays"), "1");
    await press(page, L(page, "[data-act=sealTransfer]"));
    t.ok(gasRow(page) === "would revert: RatchetOnly()" && page.$("#cslab [data-go]").disabled === true && W.prompts().length === 14,
      "a shorter seal is RatchetOnly() in the estimate, Sign disabled, no prompt reached", `gas "${gasRow(page)}" prompts ${W.prompts().length}`);
    await dismiss(page);
    /* the holder's own pause, then the re-arm */
    await press(page, L(page, "[data-act=pause]"));
    t.ok(fn(page) === "pause(uint256)" && L(page, "[data-act=setStatus]") === null && /until the holder re-arms it/.test(page.text("#cslab [data-sentence]")), "while Active the holder is offered pause, not setStatus", acts(page).join(","));
    await sign(page, W, 14);
    await page.until(() => T(page, "identity-status") === "Paused" && !!L(page, "[data-act=setStatus]"), 60);
    t.ok(await statusOf(1) === 1n && L(page, "[data-act=pause]") === null, "Sign → Paused; now the re-arm is offered and the pause is not", acts(page).join(","));
    await press(page, L(page, "[data-act=setStatus]"));
    t.ok(fn(page) === "setStatus(uint256,uint8)" && word(slabCd(page), 1) === 0n && /re-arms #1/.test(page.text("#cslab [data-sentence]")), "the re-arm is setStatus(1, 0)", fn(page));
    await sign(page, W, 15);
    await page.until(() => T(page, "identity-status") === "Active", 60);
    t.ok(await statusOf(1) === 0n && !!L(page, "[data-act=pause]"), "Sign → Active again, and the pause is back", T(page, "identity-status"));
    /* a clock that will not answer: no deadline is guessed, no slab is raised */
    W.refuse("eth_getBlockByNumber", Object.assign(new Error("boom"), { code: -32603 }));
    const est0 = W.count("eth_estimateGas");
    page.type(field(page, "sealDays"), "60");
    page.click(L(page, "[data-act=sealTransfer]")); await page.settle(); await page.settle(); await page.settle();
    t.ok(!slabOpen(page) && tick(page) === "the chain's clock could not be read" && W.count("eth_estimateGas") === est0, "a clock that will not answer raises no slab: the ticker says so and no deadline is guessed", `slab ${slabOpen(page)} tick "${tick(page)}"`);
    W.override("eth_getBlockByNumber", null);
    page.type(field(page, "operator"), "not an address");
    page.click(L(page, "[data-act=setApprovalForAll]")); await page.settle();
    t.ok(!slabOpen(page) && tick(page) === "the operator: an address", "a typed non-address is a sentence, no slab", tick(page));
    t.ok(page.innerHTMLWrites === 0 && page.errors.length === 0 && W.sent() === 15, "nothing was assigned through innerHTML and no script threw on the holder's page", page.errors.map((e) => e.message).join("; "));
    page.close();
  }

  /*═══════════ B · the other hands on #1: the renter, the guardian, the proposed wallet ═══════════*/
  t.head("B · the other hands on #1");
  {
    const W = walletFor(c, renter);
    const { page } = await bootToken(1, { wallet: W });
    await lane(page, "identity");
    await page.until(() => /^(Active|Paused)$/.test(T(page, "identity-status")) && Object.keys(chips(page)).length === 8, 80);
    t.ok(page.$("body").dataset.rights === "4" && acts(page).length === 0 && LL(page, "input").length === 1 && !!L(page, "#identity-rights-input") && onlyOn(page, "USE") &&
      (laneText(page).match(/you are the user; only the holder may act as it/g) || []).length === 1 && T(page, "identity-status-rule") === RULE,
      "M8 the renter gets no form at all — no control, one input (the rights reader, its own USE chip on), the user's sentence once", `acts ${acts(page).join(",")} inputs ${LL(page, "input").length} rights ${page.$("body").dataset.rights}`);
    page.close();
  }
  {
    const W = walletFor(c, guardianW);
    const { page } = await bootToken(1, { wallet: W });
    await lane(page, "identity");
    await page.until(() => !!L(page, "[data-act=pause]"), 80);
    t.ok(page.$("body").dataset.rights === "64" && acts(page).join(",") === "pause" && L(page, "[data-act=setGuardian]") === null && LL(page, "input").length === 1 && /a guardian may pause, panic, seal and revoke sessions; nothing else/.test(laneText(page)),
      "M8 the guardian form is absent for the guardian: pause is the guardian's one control here, and the lane says what a guardian may do", `acts ${acts(page).join(",")} rights ${page.$("body").dataset.rights}`);
    await press(page, L(page, "[data-act=pause]"));
    t.ok(fn(page) === "pause(uint256)" && word(slabCd(page), 0) === 1n && /^\d+ units$/.test(gasRow(page)), "the guardian's pause estimates: the hub admits a guardian", gasRow(page));
    await sign(page, W, 1);
    await page.until(() => T(page, "identity-status") === "Paused", 60);
    t.ok(await statusOf(1) === 1n && acts(page).length === 0, "Sign → Paused, and the guardian is offered nothing more: it cannot re-arm", acts(page).join(","));
    page.close();
  }
  {
    /* M9: the proposed wallet accepts in its own transaction; a wallet that is not it is offered nothing */
    const WB = walletFor(c, buyer);
    const { page: pb } = await bootToken(1, { wallet: WB });
    await lane(pb, "identity");
    await pb.until(() => /pending/.test(T(pb, "identity-proposed")), 80);
    const notIt = pb.$("body").dataset.rights === "0" && acts(pb).length === 0 && /pending/.test(T(pb, "identity-proposed"));
    pb.close();
    const W = walletFor(c, agentW);
    const { page, ctx: vctx } = await bootToken(1, { wallet: W });
    const U = vctx.INTACT.ui;
    await lane(page, "identity");
    await page.until(() => !!L(page, "[data-act=acceptAgentWallet]"), 80);
    t.ok(notIt && page.$("body").dataset.rights === "0" && acts(page).join(",") === "acceptAgentWallet" && T(page, "identity-proposed") === U.checksum(AGENT) + " · pending: it accepts by sending",
      "M9 [data-act=acceptAgentWallet] appears only when the connected account is the proposed wallet: the buyer, rights 0, gets nothing; agentW, rights 0, gets the acceptance alone", `buyer ${notIt} agent acts ${acts(page).join(",")}`);
    await press(page, L(page, "[data-act=acceptAgentWallet]"));
    t.ok(fn(page) === "acceptAgentWallet(uint256)" && word(slabCd(page), 0) === 1n && /by sending/.test(page.text("#cslab [data-sentence]")) && /^\d+ units$/.test(gasRow(page)), "the acceptance slab is acceptAgentWallet(1), proof of control by sending, and the estimate passes", gasRow(page));
    await sign(page, W, 1);
    await page.until(() => T(page, "identity-agent") === U.checksum(AGENT), 60);
    t.ok(lower(decAddr(await c.read(hub, "agentWalletOf(uint256)", [1]))) === lower(AGENT) && T(page, "identity-proposed") === "none" && L(page, "[data-act=acceptAgentWallet]") === null,
      "M9 Sign → agentWalletOf(1) is agentW, the proposal is spent, and the acceptance is gone", `agent "${T(page, "identity-agent")}" proposed "${T(page, "identity-proposed")}"`);
    page.close();
  }

  /*═══════════ C · the status follows the chain: #2 sold ═══════════*/
  t.head("C · M2: the status follows the chain and the re-arm is the holder's");
  {
    const W = walletFor(c, me);
    const { page } = await bootToken(2, { wallet: W });
    await lane(page, "identity");
    await page.until(() => T(page, "identity-status") === "Active", 80);
    const atMint = T(page, "identity-status") === "Active" && await statusOf(2) === 0n && !!L(page, "[data-act=pause]") && L(page, "[data-act=setStatus]") === null;
    page.close();
    await c.exec(hub, "transferFrom(address,address,uint256)", [ME, BUYER, 2], { label: "transferFrom" });
    const { page: po } = await bootToken(2, { wallet: walletFor(c, me) });
    await lane(po, "identity");
    await po.until(() => T(po, "identity-status") === "Paused", 80);
    const oldHolder = po.$("body").dataset.rights === "0" && acts(po).length === 0 && T(po, "identity-status") === "Paused";
    po.close();
    const WB = walletFor(c, buyer);
    const { page: pb } = await bootToken(2, { wallet: WB });
    await lane(pb, "identity");
    await pb.until(() => T(pb, "identity-status") === "Paused" && !!L(pb, "[data-act=setStatus]"), 80);
    t.ok(atMint && oldHolder && await statusOf(2) === 1n && pb.$("body").dataset.rights === "1" && !!L(pb, "[data-act=setStatus]") && L(pb, "[data-act=pause]") === null,
      "M2 the status follows the chain and re-arm is the holder's — Active at mint; Paused after the sale; setStatus for the new holder, nothing for the old", `mint ${atMint} old ${oldHolder} new acts ${acts(pb).join(",")}`);
    await press(pb, L(pb, "[data-act=setStatus]"));
    t.ok(fn(pb) === "setStatus(uint256,uint8)" && word(slabCd(pb), 0) === 2n && word(slabCd(pb), 1) === 0n && /^\d+ units$/.test(gasRow(pb)), "the new holder's re-arm is setStatus(2, 0), and the estimate passes", gasRow(pb));
    await sign(pb, WB, 1);
    await pb.until(() => T(pb, "identity-status") === "Active", 60);
    t.ok(await statusOf(2) === 0n && T(pb, "identity-status") === "Active", "M2 Sign → statusOf is 0 and the lane reads Active", T(pb, "identity-status"));
    pb.close();
  }

  /*═══════════ D · the 7702 delegate on #3: known by name, unknown hides spending ═══════════*/
  t.head("D · M5: a known 7702 delegate is named, an unknown one hides spending");
  {
    const code = (addr) => c.vm.stateManager.putCode(createAddressFromString(DELEGATED), Buffer.from("ef0100" + addr.slice(2).toLowerCase(), "hex"));
    await code(META);
    const W = walletFor(c, delegated);
    const { page, ctx: vctx } = await bootToken(3, { wallet: W });
    await lane(page, "identity");
    await page.until(() => !!L(page, "[data-act=setUser]"), 80);
    const d = vctx.INTACT.ui.delegate();
    const known = T(page, "identity-delegate") === "MetaMask EIP7702StatelessDeleGator" && !!d && d.known === true && d.name === "MetaMask EIP7702StatelessDeleGator" && L(page, "#ack-delegate") === null &&
      W.callsTo(catalog, sel("knownDelegates()")).length >= 1 && W.calls.some((x) => x.method === "eth_getCode" && lower(x.params[0]) === lower(DELEGATED)) &&
      LL(page, "[data-spend]").length >= 5 && LL(page, "[data-spend]").every((b) => !b.hidden) && page.$("body").dataset.rights === "1";
    t.ok(known, "M5 a known 7702 delegate is named — #identity-delegate reads MetaMask EIP7702StatelessDeleGator from knownDelegates() read live at the Catalog, no acknowledgement is asked, and the holder's spending controls stand",
      `"${T(page, "identity-delegate")}" delegate ${JSON.stringify(d)} catalog reads ${W.callsTo(catalog, sel("knownDelegates()")).length} spend ${LL(page, "[data-spend]").length}`);
    page.close();
    await code("0x" + "de".repeat(20));
    const W2 = walletFor(c, delegated);
    const { page: p2, ctx: v2 } = await bootToken(3, { wallet: W2 });
    await lane(p2, "identity");
    await p2.until(() => !!L(p2, "#ack-delegate") && LL(p2, "[data-spend]").length >= 1, 80);
    const d2 = v2.INTACT.ui.delegate();
    const spend = LL(p2, "[data-spend]"), plain = LL(p2, "[data-act]").filter((b) => !b.hasAttribute("data-spend"));
    const SPEND = ["setUser", "proposeAgentWallet", "setApprovalForAllUntil", "setApprovalForAll", "approve"];
    const hidden = /unknown delegate/.test(T(p2, "identity-delegate")) && !!d2 && d2.known === false && d2.acked === false && spend.length === 5 && spend.every((b) => b.hidden) &&
      spend.map((b) => b.dataset.act).sort().join(",") === SPEND.slice().sort().join(",") && plain.length >= 5 && plain.every((b) => !b.hidden);
    /* the gate is in propose too: a spending write is refused before any estimate */
    const est0 = W2.count("eth_estimateGas");
    await v2.INTACT.ui.propose({ to: hub, key: "hub.setUser", args: [3n, BUYER, 0n], need: 1, spend: true, lines: [["User", "x"]], sentence: "names a user" }); await p2.settle();
    const refused = !slabOpen(p2) && /an unknown delegate holds this account; acknowledge it on Identity first/.test(tick(p2)) && W2.count("eth_estimateGas") === est0;
    let fired = 0; v2.addEventListener("intact:rights", () => fired++);
    p2.click(L(p2, "#ack-delegate")); await p2.settle(); await p2.settle();
    await p2.until(() => /acknowledged/.test(T(p2, "identity-delegate")), 40);
    const after = LL(p2, "[data-spend]");
    t.ok(hidden && refused && fired === 1 && after.length === 5 && after.every((b) => !b.hidden) && L(p2, "#ack-delegate") === null && T(p2, "identity-delegate") === "unknown delegate · acknowledged" && v2.INTACT.ui.delegate().acked === true,
      "M5 an unknown one hides spending — unknown delegate on the row, exactly the five controls CONSOLE §3 names hidden (setUser, proposeAgentWallet, setApprovalForAllUntil, setApprovalForAll, approve), a spending propose refused before any estimate, until #ack-delegate: then they show, intact:rights fired once more, and the row says acknowledged",
      `hidden ${hidden} [${spend.map((b) => b.dataset.act + (b.hidden ? ":h" : ":v")).join(" ")}] refused ${refused} fired ${fired} after ${after.map((b) => b.hidden).join(",")} row "${T(p2, "identity-delegate")}"`);
    await press(p2, L(p2, "[data-act=setGuardian]"));
    t.ok(fn(p2) === "setGuardian(uint256,address)" && slabOpen(p2), "a non-spending slab was never hidden from the delegated holder: setGuardian raises as before", fn(p2));
    await dismiss(p2);
    t.ok(W.sent() === 0 && W2.sent() === 0 && W.prompts().length === 0 && W2.prompts().length === 0 && p2.errors.length === 0, "delegated sends nothing in this group: reads only, no prompt, no script threw", `sent ${W.sent()}/${W2.sent()} prompts ${W.prompts().length}/${W2.prompts().length}`);
    p2.close();
  }

  /*═══════════ E · the gates: the viewer, unread rights, reads with no answer, the collection page ═══════════*/
  t.head("E · the gates");
  {
    const W = walletFor(c, me);
    const { page } = await bootToken(1, { opaque: true, wallet: W });
    await lane(page, "identity");
    await page.until(() => /^(Active|Paused)$/.test(T(page, "identity-status")) && Object.keys(chips(page)).length === 8, 80);
    t.ok(page.$("body").dataset.mode === "viewer" && page.$("body").dataset.rights === "1" && acts(page).length === 0 && LL(page, "input").length === 1 && onlyOn(page, "HOLD") &&
      (laneText(page).match(/nothing here can sign/g) || []).length === 1 && T(page, "identity-delegate") === "not checked in the viewer" && L(page, "#ack-delegate") === null && W.prompts().length === 0 && T(page, "identity-status-rule") === RULE,
      "the viewer reads every fact and the rights of any address, offers no control, says once that nothing here can sign, and does not pretend to have checked the account's code", `acts ${acts(page).length} inputs ${LL(page, "input").length} delegate "${T(page, "identity-delegate")}"`);
    page.close();
  }
  {
    /* rights that could not be read are not a stranger's: nothing to press, the sentence once, the reader says not reported */
    const W = walletFor(c, me);
    W.answer(hub, sel("rightsOf(uint256,address)"), () => { throw Object.assign(new Error("boom"), { code: -32000 }); });
    const { page } = await bootToken(1, { wallet: W });
    await lane(page, "identity");
    await page.until(() => /not reported/.test(T(page, "identity-rights-fact")) && /^(Active|Paused)$/.test(T(page, "identity-status")), 80);
    t.ok(page.$("body").dataset.rights === "" && acts(page).length === 0 && LL(page, "input").length === 1 && (laneText(page).match(/your rights could not be read at block \d+/g) || []).length === 1 && /^not reported: /.test(T(page, "identity-rights-fact")) && Object.keys(chips(page)).length === 0,
      "with rights that could not be read the lane offers nothing, says why once, and the rights reader says not reported rather than drawing a stranger's chips", `acts ${acts(page).length} fact "${T(page, "identity-rights-fact")}"`);
    page.close();
  }
  {
    /* zero and no answer are different facts: a Core, a fingerprint, a trait and a key that will not answer print why, never nobody, none or 0 */
    const W = walletFor(c, me);
    for (const s of ["coreOf(uint256)", "getStateFingerprint(uint256)", "getTraitValue(uint256,bytes32)"]) W.answer(hub, sel(s), reverted);
    W.answer(parley, sel("keyOf(uint256)"), reverted);
    const { page } = await bootToken(1, { wallet: W });
    await lane(page, "identity");
    const ids = ["identity-status", "identity-guardian", "identity-user", "identity-agent", "identity-proposed", "identity-income", "identity-face", "identity-seal", "identity-fingerprint-live", "identity-curve", "identity-name", "identity-key"];
    await page.until(() => ids.every((id) => /^not reported: unknown error 0xdeadbeef$/.test(T(page, id))), 80);
    /* what reads from nothing is still drawn — the two traits and the four operator controls; the curve's control then refuses at the press */
    const drawn = acts(page).sort().join(","), est0 = W.count("eth_estimateGas");
    page.type(field(page, "curve"), "100");
    page.click(LL(page, "[data-act=setTrait]")[0]); await page.settle(); await page.settle();
    t.ok(ids.every((id) => T(page, id) === "not reported: unknown error 0xdeadbeef") && drawn === "approve,revokeAllApprovals,setApprovalForAll,setApprovalForAllUntil,setTrait,setTrait" && !slabOpen(page) && W.count("eth_estimateGas") === est0 &&
      tick(page) === "the curve trait did not answer; nothing is guessed" && !/nobody|none: the Reach|no key bound|0 bps/.test(laneText(page)) && T(page, "identity-fingerprint-baked") === page.ctx.INTACT.fingerprint && page.errors.length === 0,
      "a Core, a fingerprint, a trait and a key that will not answer print the reason in every row, never nobody, none or 0; the controls that read from them are not drawn, and the curve's control refuses at the press rather than guess",
      `acts ${drawn} tick "${tick(page)}" ` + ids.map((id) => id + ' "' + T(page, id) + '"').join(" | ").slice(0, 240));
    page.close();
  }
  {
    /* the collection page has no token: the lane says so and reads nothing */
    const W = walletFor(c, buyer);
    const { page } = await bootPage("/", { wallet: W });
    const n0 = W.count("eth_call");
    const loaded = await lane(page, "identity");
    t.ok(loaded && laneText(page) === "a token's identity: open one to see its status, rights, keys and hashes" && acts(page).length === 0 && W.count("eth_call") === n0,
      "on the collection page the lane says a token's identity is a token's, and reads nothing", `"${laneText(page)}" calls +${W.count("eth_call") - n0}`);
    page.close();
  }
}
