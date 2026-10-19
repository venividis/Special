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
  collection page); F the Market and the Roles (the console round: one chip
  each on this chain, which has neither; then, on a chain of the block's
  own deployed with deployMarket and deployRoles, the listing refused while
  the Reach is unsealed, the hand-laid list slab, the buy at the exact
  price with the re-read at Sign caught moving, the seller's claim, the
  USER role live and expired, and a listing made stale by its holder's
  panic cleared by a stranger); G the ENS row on band 0 (tools/verify-plate.mjs's
  ENS fixture, the site deployed after it with the Nameplate at the Catalog's
  pin: nothing before the registration, nothing while a wallet holds the
  apex, every id resolving to its own Reach once the apex sits in #3073's,
  and the lapse on the registrar's clock). No BUILD-PLAN §U9 sentence is owned here (CONSOLE §15
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
  setEncryptionKey|bindKey|list|delist|buy|claim], [data-spend],
  #identity-listing (.chip, #identity-offer, #identity-seals,
  #identity-pinned, #identity-owed, input[name=price|listDays]),
  #identity-roles (.chip, #identity-role-count, #identity-role-user),
  #identity-ens (.chip, #identity-ens-name). From the shell: the slab (#cbox.on,
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
    t.ok(new RegExp("engine\\s*" + S.engineHash).test(manifest) && new RegExp("catalog\\s*" + S.catalogHash).test(manifest) && Object.keys(S.panels).length === ctx.PANELS.length &&
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
  /*═══════════ F · the Market and the Roles: a chip where they are absent, the listing and the role facts where they are not ═══════════*/
  t.head("F · the Market and the Roles");
  {
    /* this chain has neither: each section is one chip by CONSOLE §6.3, no control, and nothing is asked of the codeless pins */
    const W = walletFor(c, me);
    const { page, S } = await bootToken(1, { wallet: W });
    await lane(page, "identity");
    await page.until(() => !!L(page, "#identity-listing .chip") && !!L(page, "#identity-roles .chip") && /^(Active|Paused)$/.test(T(page, "identity-status")), 60);
    const mc = L(page, "#identity-listing .chip"), rc = L(page, "#identity-roles .chip");
    t.ok(mc.textContent === "market: not deployed on this chain" && mc.dataset.state === "absent" && rc.textContent === "roles: not deployed on this chain" && rc.dataset.state === "absent" &&
      L(page, "#identity-offer") === null && L(page, "#identity-role-count") === null && !acts(page).some((a) => /^(list|delist|buy|claim)$/.test(a)) &&
      W.callsTo(S.market).length === 0 && W.callsTo(S.roles).length === 0,
      "where the Market and the Roles are not deployed each section is one chip, not deployed on this chain, with no control and no read sent to the codeless pin",
      `market "${mc.textContent}" ${mc.dataset.state} roles "${rc.textContent}" ${rc.dataset.state} acts ${acts(page).join(",")}`);
    page.close();
  }
  const F = await ctx.fresh({ deployMarket: true, deployRoles: true });
  {
    const c2 = F.c, s2 = F.site, A2 = F.actors, hub2 = s2.hub, MK = s2.market, RO = s2.roles;
    const ME2 = A2.me.from.toString(), BUY2 = A2.buyer.from.toString(), RENT2 = A2.renter.from.toString();
    const LIST = "list(uint256,uint256,uint64,bytes32,(address,uint256)[])", PRICE = WAD / 4n;
    const now2 = () => F.EVM.BLOCK.header.timestamp;
    const fp = async (id) => lower(await c2.read(hub2, "getStateFingerprint(uint256)", [id])).slice(0, 66);
    const listingOf = async (id) => c2.read(MK, "listingOf(uint256)", [id]);
    const owedTo = async (a) => decUint(await c2.read(MK, "owed(address)", [a]));
    const epochOf = async (id) => decUint(await c2.read(hub2, "custodyEpoch(uint256)", [id]));
    const lockOf = async (id) => decUint(await c2.read(hub2, "coreOf(uint256)", [id]), 2);
    const reachOf = async (id) => decAddr(await c2.read(hub2, "account(uint256)", [id]));
    for (let i = 0; i < 3; i++) await F.mint(c2, s2, ME2);
    const W = F.walletFor(c2, A2.me);
    const { page, ctx: vctx, S } = await F.bootToken(1, { wallet: W });
    const U = vctx.INTACT.ui;
    await F.lane(page, "identity");
    await page.until(() => T(page, "identity-offer") === "not listed" && !!L(page, "[data-act=list]") && T(page, "identity-role-count") === "0", 80);
    t.ok((S.reported & S.bits.market) && (S.reported & S.bits.roles) && L(page, "#identity-listing .chip") === null && L(page, "#identity-roles .chip") === null &&
      T(page, "identity-seals") === "the Reach unsealed · the owned market closed" && T(page, "identity-role-user") === "none" &&
      /a role holder reads what the role's data says; the page grants nothing on it/.test(page.text("#lane-identity #identity-roles")) && !!field(page, "price") && field(page, "listDays").value === "7" &&
      L(page, "[data-act=delist]") === null && L(page, "[data-act=buy]") === null,
      "where both are deployed the holder reads not listed, the two seals, no live role and no USER role, and is offered the listing form",
      `offer "${T(page, "identity-offer")}" seals "${T(page, "identity-seals")}" role "${T(page, "identity-role-user")}" acts ${acts(page).join(",")}`);
    /* both seals or no listing: an unsealed Reach is a sentence at the press, and nothing is estimated */
    page.type(field(page, "price"), "0.25");
    const est0 = W.count("eth_estimateGas");
    page.click(L(page, "[data-act=list]")); await page.settle(); await page.settle();
    t.ok(!slabOpen(page) && W.count("eth_estimateGas") === est0 && /^a listing until \d{4}-\d\d-\d\d \d\d:\d\d UTC needs the Reach sealed until then \(Vault\)$/.test(tick(page)),
      "a listing the Reach's seal does not cover is refused at the press, naming the seal it needs, before any estimate", tick(page));
    page.type(field(page, "price"), "0");
    page.click(L(page, "[data-act=list]")); await page.settle(); await page.settle();
    t.ok(!slabOpen(page) && tick(page) === "the price: more than 0 ETH, in decimal", "a price of nothing is a sentence, never a free listing", tick(page));
    await c2.exec(await reachOf(1), "seal(uint64)", [now2() + 30n * 86400n]);
    await repaint(page, vctx);
    await page.until(() => /^the Reach sealed until .* · the owned market closed$/.test(T(page, "identity-seals")) && !!field(page, "price"), 60);
    page.type(field(page, "price"), "0.25");
    await press(page, L(page, "[data-act=list]"));
    const lcd = slabCd(page), live1 = await fp(1), until = word(lcd, 2);
    t.ok(fn(page) === LIST && lower(page.text("#cslab [data-to]")) === lower(MK) && lcd.slice(0, 10) === sel(LIST) && (lcd.length - 2) / 2 === 4 + 6 * 32 &&
      word(lcd, 0) === 1n && word(lcd, 1) === PRICE && until > now2() + 7n * 86400n - 60n && until <= now2() + 7n * 86400n + 60n && "0x" + lcd.slice(10 + 192, 10 + 256) === live1 &&
      word(lcd, 4) === 160n && word(lcd, 5) === 0n && /^\d+ units$/.test(gasRow(page)) && line(page, "Price") === "0.25 ETH, exactly" && /^none: /.test(line(page, "Floors")) &&
      /^lists #1 on the Market at 0\.25 ETH until .*: it stays locked to the listing/.test(page.text("#cslab [data-sentence]")),
      "with the Reach sealed the listing slab is list(id, price, expiresAt, fingerprint, floors) laid by hand: the live fingerprint, an expiry on the chain's clock, the floors' offset and an empty array, and it estimates",
      `fn ${fn(page)} cd ${lcd.slice(0, 74)}… w2 ${until} gas "${gasRow(page)}"`);
    await sign(page, W, 1);
    await page.until(() => /^0\.25 ETH until /.test(T(page, "identity-offer")) && !!L(page, "[data-act=delist]"), 80);
    const l1 = await listingOf(1), pin1 = "0x" + l1.slice(2 + 64 * 5, 2 + 64 * 6);
    t.ok(lower(decAddr(l1, 1)) === lower(ME2) && decUint(l1, 2) === PRICE && decUint(l1, 3) === until && await lockOf(1) === 1n && pin1 === await fp(1) &&
      T(page, "identity-offer") === "0.25 ETH until " + date(until) + " · by " + U.checksum(ME2) + " · epoch 1" && T(page, "identity-pinned") === pin1 + " — as live" &&
      L(page, "[data-act=list]") === null && L(page, "[data-act=buy]") === null && L(page, "[data-act=delist]").textContent === "take the listing down",
      "Sign → listingOf(1) holds the seller, the price and the expiry, the token is locked once, and the holder reads the offer and its pinned fingerprint as live, offered only the delisting",
      `offer "${T(page, "identity-offer")}" pinned "${T(page, "identity-pinned")}" lock ${await lockOf(1)} acts ${acts(page).join(",")}`);
    page.close();

    /* the buyer: exact value, and the listing, the fingerprint and the epoch re-read at Sign */
    const WB = F.walletFor(c2, A2.buyer);
    const b = await F.bootToken(1, { wallet: WB });
    await F.lane(b.page, "identity");
    await b.page.until(() => /^0\.25 ETH until /.test(T(b.page, "identity-offer")) && !!L(b.page, "[data-act=buy]"), 80);
    t.ok(acts(b.page).join(",") === "buy" && L(b.page, "[data-act=buy]").textContent === "buy #1 for 0.25 ETH", "a stranger to the token is offered the buy alone, at the listed price", acts(b.page).join(","));
    await press(b.page, L(b.page, "[data-act=buy]"));
    const bcd = slabCd(b.page);
    t.ok(fn(b.page) === "buy(uint256,uint256,bytes32)" && b.page.$("#cslab [data-value]").dataset.wei === String(PRICE) && word(bcd, 0) === 1n && word(bcd, 1) === PRICE && "0x" + bcd.slice(10 + 128, 10 + 192) === pin1 &&
      /^\d+ units$/.test(gasRow(b.page)) && /^0\.25 ETH, the listed price exactly$/.test(line(b.page, "Pays")),
      "the buy slab sends exactly the price as value, agrees to that price and names the pinned fingerprint, and it estimates", `value ${b.page.$("#cslab [data-value]") && b.page.$("#cslab [data-value]").dataset.wei} cd ${bcd.slice(0, 74)}…`);
    WB.answer(hub2, sel("getStateFingerprint(uint256)"), () => "0x" + "ab".repeat(32));
    await b.page.until(() => !b.page.$("#cslab [data-go]").disabled, 40);
    b.page.click(b.page.$("#cslab [data-go]"));
    await b.page.until(() => !slabOpen(b.page) && /review again/.test(tick(b.page)), 60);
    t.ok(WB.sent() === 0 && tick(b.page) === "the listing or the token moved since it was read — review again" && lower(decAddr(await c2.read(hub2, "ownerOf(uint256)", [1]))) === lower(ME2),
      "a fingerprint that moves between the estimate and Sign is caught by the re-read: nothing is sent and the slab closes", tick(b.page));
    WB.answer(hub2, sel("getStateFingerprint(uint256)"), null);
    const owedBefore = await owedTo(ME2);
    await press(b.page, L(b.page, "[data-act=buy]"));
    await sign(b.page, WB, 1);
    const [rcv, roy] = [decAddr(await c2.read(hub2, "royaltyInfo(uint256,uint256)", [1, PRICE]), 0), decUint(await c2.read(hub2, "royaltyInfo(uint256,uint256)", [1, PRICE]), 1)];
    /* the royalty comes out of the price first; were the receiver the seller itself, its ledger would hold both */
    const cut = /^0x0{40}$/i.test(rcv) ? 0n : roy, owed = await owedTo(ME2), want = PRICE - cut + (lower(rcv) === lower(ME2) ? cut : 0n);
    t.ok(lower(decAddr(await c2.read(hub2, "ownerOf(uint256)", [1]))) === lower(BUY2) && await epochOf(1) === 2n && /^0x0{40}$/.test(lower(decAddr(await listingOf(1), 1))) && await lockOf(1) === 0n &&
      owed - owedBefore === want,
      "Sign → the token is the buyer's at custody epoch 2, the listing is gone with its lock, and the seller's ledger holds the price less the royalty", `owner ${decAddr(await c2.read(hub2, "ownerOf(uint256)", [1]))} epoch ${await epochOf(1)} owed ${owed} royalty ${cut}`);
    b.page.close();

    /* the seller's claim is the wallet's, from the ledger */
    const W3 = F.walletFor(c2, A2.me);
    const s3 = await F.bootToken(1, { wallet: W3 });
    await F.lane(s3.page, "identity");
    await s3.page.until(() => !!L(s3.page, "[data-act=claim]") && T(s3.page, "identity-offer") === "not listed", 80);
    t.ok(T(s3.page, "identity-owed") === U.fmt(owed) + " ETH, from every sale it made" && acts(s3.page).join(",") === "claim",
      "the seller, no longer the holder, reads what the Market owes this wallet and is offered the claim alone", `owed "${T(s3.page, "identity-owed")}" acts ${acts(s3.page).join(",")}`);
    await press(s3.page, L(s3.page, "[data-act=claim]"));
    t.ok(fn(s3.page) === "claim()" && line(s3.page, "Pays") === U.fmt(owed) + " ETH to " + U.checksum(ME2) && /^\d+ units$/.test(gasRow(s3.page)), "the claim slab names the amount and the wallet it pays", line(s3.page, "Pays"));
    const bal0 = await c2.balanceOf(ME2);
    await sign(s3.page, W3, 1);
    t.ok(await owedTo(ME2) === 0n && (await c2.balanceOf(ME2)) > bal0 && L(s3.page, "[data-act=claim]") === null && T(s3.page, "identity-owed") === "",
      "Sign → the ledger owes the wallet nothing and the claim is no longer offered", `owed ${await owedTo(ME2)}`);
    s3.page.close();

    /* the USER role on #3, live: read here, granted nowhere on this page */
    const USER = kec(Buffer.from("USER", "utf8")), rexp = now2() + 5n * 86400n;
    await c2.exec(RO, "grantRole((bytes32,address,uint256,address,uint64,bool,bytes))", [[USER, hub2, 3, RENT2, rexp, true, "0x1234"]]);
    /* #2 is listed for a day, then panicked by its holder: the epoch moves under the listing */
    await c2.exec(await reachOf(2), "seal(uint64)", [now2() + 30n * 86400n]);
    await c2.exec(MK, LIST, [2, PRICE, now2() + 86400n, await fp(2), []]);
    const r3 = await F.bootToken(3, { wallet: F.walletFor(c2, A2.me) });
    await F.lane(r3.page, "identity");
    await r3.page.until(() => T(r3.page, "identity-role-count") === "1" && /until/.test(T(r3.page, "identity-role-user")), 80);
    r3.page.type(L(r3.page, "#identity-rights-input"), RENT2);
    await r3.page.until(() => Object.keys(chips(r3.page)).length === 8 && chips(r3.page).ROLE === "on", 60);
    t.ok(T(r3.page, "identity-role-user") === U.checksum(RENT2) + " until " + date(rexp) + " · granted at epoch 1 · data 2 bytes" && chips(r3.page).ROLE === "on" &&
      !acts(r3.page).some((a) => /role/i.test(a)),
      "a live USER role reads its recipient, its expiry on the chain's clock, the epoch it was stamped with and its data's length; the recipient's ROLE chip is on, and no control grants or revokes",
      `role "${T(r3.page, "identity-role-user")}" chips ${JSON.stringify(chips(r3.page))}`);
    r3.page.close();

    await c2.exec(hub2, "panic(uint256)", [2]);
    const WS = F.walletFor(c2, A2.stranger);
    const d2 = await F.bootToken(2, { wallet: WS });
    await F.lane(d2.page, "identity");
    await d2.page.until(() => /nothing can buy it$/.test(T(d2.page, "identity-offer")) && !!L(d2.page, "[data-act=delist]"), 80);
    t.ok(/ · epoch 1 · stale: the custody epoch moved; nothing can buy it$/.test(T(d2.page, "identity-offer")) && acts(d2.page).join(",") === "delist" &&
      L(d2.page, "[data-act=delist]").textContent === "clear the dead listing" && await epochOf(2) === 2n,
      "a listing whose custody epoch moved under it (the holder's panic) reads stale and is anyone's to clear: the stranger is offered the clearing alone, never the buy",
      `offer "${T(d2.page, "identity-offer")}" acts ${acts(d2.page).join(",")}`);
    await press(d2.page, L(d2.page, "[data-act=delist]"));
    t.ok(fn(d2.page) === "delist(uint256)" && line(d2.page, "Listing") === "stale: the custody epoch moved" && /^\d+ units$/.test(gasRow(d2.page)), "the clearing slab names the dead listing's state and estimates", line(d2.page, "Listing"));
    await sign(d2.page, WS, 1);
    t.ok(/^0x0{40}$/.test(lower(decAddr(await listingOf(2), 1))) && await lockOf(2) === 0n, "Sign → the stale listing and the lock it held are gone", `lock ${await lockOf(2)}`);
    d2.page.close();

    /* the role, past its expiry: recipientOf answers nobody, roleEpoch still holds the stamp */
    F.warpBy(6n * 86400n);
    const e3 = await F.bootToken(3, { wallet: F.walletFor(c2, A2.me) });
    await F.lane(e3.page, "identity");
    await e3.page.until(() => T(e3.page, "identity-role-count") === "0" && /^none live/.test(T(e3.page, "identity-role-user")), 80);
    t.ok(T(e3.page, "identity-role-user") === "none live: the grant stamped at epoch 1 expired" && decUint(await c2.read(RO, "roleEpoch(uint256,bytes32)", [3, USER])) === 1n,
      "past its expiry the USER role reads none live, the grant stamped at epoch 1 expired: none and a dead grant are two facts", T(e3.page, "identity-role-user"));
    e3.page.close();
  }

  /*═══════════ G · the name: band 0, the Nameplate at the Catalog's pin ═══════════*/
  t.head("G · the ENS row where the band has a Nameplate");
  {
    /* an ENS in the real one's shape (tools/verify-plate.mjs's fixture) deployed first, then the site with band 0's
       bounds and the Nameplate as its last CREATE, at the address the Catalog pins (deploySite's deployNameplate) */
    const { labelhash, namehash, ETH_NODE } = await import("../ens-name.mjs");
    const { boot } = await import("../dom-shim.mjs");
    const YEAR = 365n * 86400n;
    const c3 = await ctx.Chain.open(), F3 = c3.from.toString();
    const ens = await c3.deploy(ctx.A("test/mocks/EnsRegistry.sol", "EnsRegistry").bytecode, "", "EnsRegistry");
    const registrar = await c3.deploy(ctx.A("test/mocks/EnsRegistrar.sol", "EnsRegistrar").bytecode, ctx.encodeParams("address,bytes32", [ens, ETH_NODE]), "EnsRegistrar");
    await c3.exec(ens, "setSubnodeOwner(bytes32,bytes32,address)", ["0x" + "00".repeat(32), labelhash("eth"), registrar]);
    const wrapper = await c3.deploy(ctx.A("test/mocks/EnsNameWrapper.sol", "EnsNameWrapper").bytecode, ctx.encodeParams("address,address", [ens, registrar]), "EnsNameWrapper");
    await c3.exec(registrar, "addController(address)", [wrapper]);
    const s3 = await ctx.deploySite(c3, ctx.out, { band: 0, lo: 3073n, hi: 3584n, deployNameplate: { ens, wrapper, registrar } });
    const { id } = await ctx.mint(c3, s3);
    const { id: id2 } = await ctx.mint(c3, s3);
    const reach3 = decAddr(await c3.read(s3.hub, "account(uint256)", [id]));
    const GET3 = ctx.getter(c3, s3.premises);
    const open3 = async (tid) => {
      const r = await GET3(["token", String(tid), "live"]);
      const pg = await boot(r.body, { wallets: [walletFor(c3, c3)], url: `/token/${tid}/live`, GET: GET3 });
      await lane(pg, "identity");
      await pg.until(() => /\.intact\.eth · /.test(T(pg, "identity-ens-name")), 80);
      return { pg, S: pg.ctx.INTACT };
    };
    const name = (pg) => T(pg, "identity-ens-name");
    {
      const { pg, S } = await open3(id);
      t.ok(lower(S.nameplate) === lower(s3.nameplate) && (S.reported & S.bits.nameplate) !== 0 && !!L(pg, "#identity-ens") && L(pg, "#identity-ens .chip") === null &&
        name(pg) === "3073.intact.eth · resolves to nothing: no token holds intact.eth" && !/no ENS name on this band/.test(laneText(pg)) && /a key is replaced by publishing and binding again, never revoked here/.test(laneText(pg)),
        "on band 0 the state names the Nameplate and it reported; the lane draws the ENS row, and before the apex is registered the name resolves to nothing",
        `nameplate ${S.nameplate} reported ${S.reported} name "${name(pg)}"`);
      pg.close();
    }
    const registeredAt = ctx.BLOCK().timestamp;
    await c3.exec(wrapper, "registerAndWrapETH2LD(string,address,uint256,address,uint16)", ["intact", F3, YEAR, s3.nameplate, 0]);
    const lapses = decUint(await c3.read(registrar, "nameExpires(uint256)", [BigInt(labelhash("intact"))]));
    {
      const { pg } = await open3(id);
      t.ok(name(pg) === "3073.intact.eth · resolves to nothing: no token holds intact.eth" && lapses >= registeredAt + YEAR,
        "registered and wrapped to a plain wallet, the apex is held by no token, and the name still resolves to nothing", name(pg));
      pg.close();
    }
    await c3.exec(wrapper, "safeTransferFrom(address,address,uint256,uint256,bytes)", [F3, reach3, BigInt(namehash("intact.eth")), 1, "0x"]);
    {
      const a = await open3(id), b = await open3(id2);
      t.ok(name(a.pg) === "3073.intact.eth · resolves to this token's Reach; the registration lapses " + date(lapses) &&
        name(b.pg) === "3074.intact.eth · resolves to this token's Reach; the registration lapses " + date(lapses) &&
        decUint(await c3.read(s3.nameplate, "tokenForName(bytes)", ["0x04" + Buffer.from("3074").toString("hex") + "06" + Buffer.from("intact").toString("hex") + "03" + Buffer.from("eth").toString("hex") + "00"])) === id2,
        "with the apex in #3073's Reach every id of the band resolves to its own token's Reach: the lane's wire name is the one tokenForName reads, and the registrar's clock is printed beside it",
        `#3073 "${name(a.pg)}" #3074 "${name(b.pg)}"`);
      t.ok(L(a.pg, "#identity-ens [data-act]") === null && a.pg.errors.length === 0, "the ENS row offers nothing to sign: moving a name is the Vault's composer, registering it the ENS app's", acts(a.pg).join(","));
      a.pg.close(); b.pg.close();
    }
    ctx.warp(lapses + 86400n);
    {
      const { pg } = await open3(id);
      t.ok(name(pg) === "3073.intact.eth · resolves to nothing: intact.eth lapsed " + date(lapses),
        "past the registrar's expiry the name resolves to nothing and the lane says the registration lapsed, read on the chain's clock", name(pg));
      pg.close();
    }
  }
}
