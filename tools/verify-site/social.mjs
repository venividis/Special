/*───────────────────────────────────────────────────────────────────────────
  INTACT · verify-site group "social" — the tokens talk, the chain is the
  index (H §7.3 planned 33 sentences; the blocks below run more, split or
  added where INTACT's contract asks for a proof the plan only implied)

  Four blocks, each on the runner's fresh chain: D the renter ("a renter
  sees the walk and the sentence"), I the composer and the sealing flow
  ("the composer appears only for HOLD or ACCOUNT" — the six hands, the
  Reach's own hand, the walk by single blocks and a chain-computed topic,
  the hostile body as text, the silent home, the followers, the DM key
  re-read before every send and refused after a rotation, sealed only when
  both keys exist, the sealing sentence one-per-wallet and signed by the
  shell alone), K′ inbox and postage (a priced inbox as a fact, the stamped
  form with the exact value, ERC-20 postage paid by the Reach after its
  exact approve, the stamp expired and refunded to the Reach, reactions in
  words), P′ the holder's other hands and the refusals (added by review:
  found, invite, a follow refused by the estimate until the home has
  spoken, leave, the inbox form and its window refusal, an over-long body,
  a refused eth_getLogs printed as a fact, the viewer). O3 (a message body
  is text) is counted once, inside I. The two BUILD-PLAN sentences this
  file owns end their blocks as `t.ok(..., "<sentence>")`, verbatim.

  Added by the fix round, one sentence per finding of the review, each
  reproduced through the shim against the panel before its fix and failing
  there (the run is in the commit that added it): in D, the DM status
  cleared with everything else when a renter types a number after its own;
  in I, a session key's wallet in the console gets the session's sentence,
  a recipient typed before the last one's reads answered gets only its own
  room, the read inside the press refuses a key that moved under the open
  slab and re-arms, and a recipient key that is not P-256 sends nobody to
  derive or bind; in K′, the stamp a pair remembers is that pair's; in P′,
  the inbox's ledger row names the coin it read, over a settled stamp's 5
  WETH; and a last block before the viewer, the derived key is the
  wallet's. Where a sentence moves a key or a recipient, the block puts the
  room back as it found it, so a regression fails the sentence that names
  it rather than every block after it.

  Origin: IPSEITY tools/verify-site.mjs (branch claude/claude-md-docs-8vvyc8),
  "driving the commons" and "driving a direct message" — the hostile body
  typed all the way through the client, oldest first, the sender named by
  token, the archive read by following pointers with every query one block
  wide — as C §5 grouped them (D, I), plus what INTACT's contract requires
  on top: the gate in the rights bits rather than address equality, the
  composer for HOLD|ACCOUNT and the sentence for USE/CUSTODY/GUARDIAN/
  SESSION/nobody, the Reach as a second hand, the key re-read inside the
  press (PR #27, refused rather than downgraded), the one-key-per-wallet
  sentence (D7), postage with the exact value and the Reach as payer (D19).

  Setup this group performs on its chain (every id literal below refers to
  it): #1, #2, #3 to `me`; `setUser(1, renter, +7 d)`; two commons words
  from #1 two blocks apart ("hello, commons", "and again"); `setGuardian(1,
  guardianW)`; `approve(stranger, 1)`; a session on #1's Reach for `agentW`;
  #1 founds the open room "the first room"; #1 speaks at home, and #3
  follows it. In I: `me`'s sealing key — derived here exactly as the panel
  derives it, from `me`'s signature of the D7 sentence — is published and
  bound to #1, then to #3; #3 is sold to `buyer`, who publishes a real
  P-256 key of its own and binds it. In K′: `buyer` prices #3's inbox at
  0.1 ETH, then at 5 WETH; #1's Reach holds 10 WETH.

  Where another lane is read (D7, D8, D9, D11, D12 name the swap, vault and
  identity lanes), the assertion is written so it holds against the real
  panel and against the fixture that stands in for it on this branch; the
  halves that only the real panel could satisfy (the swap card's presence,
  the vault's "answers to the holder") are left out and said so.

  Elements this group reads from its panel (CONSOLE §6.2; every selector
  scoped to #lane-social): #social-commons .row (.who, .body),
  #social-commons-status, #social-composer (textarea), #social-why,
  #social-home, #social-home-feed, #social-followers .token, #social-follow,
  #social-rooms .room (its input, its button.chip), #social-found-name,
  #social-dm, #social-dm-to, #social-dm-status, #social-dm-derive,
  #social-dm-feed .row .body and the note right after #social-dm-feed (the
  pair walk's status, which carries no id), #social-dm textarea,
  #social-dm .gate, #social-receipts, #social-inbox (its inputs, and its
  .kv rows' .k and .v), [data-act=speak|speakAsReach|whisper|found|invite|
  join|leave|configureInbox|expire|claimRefund|claimSettled]. From the shell:
  the slab (#cbox.on, #cslab, [data-go], [data-no], [data-to], [data-value],
  [data-function], [data-calldata], [data-gas]), #tick, #rights-sentence,
  body[data-rights].
───────────────────────────────────────────────────────────────────────────*/
import { secp256k1 } from "ethereum-cryptography/secp256k1.js";
import { keccak256 } from "ethereum-cryptography/keccak.js";

const WAD = 10n ** 18n;
const SPEAK = "speak(uint256,uint256,uint8,uint64,uint64,bytes)";
const WHISPER = "whisper(uint256,uint256,uint8,bytes32,bytes)";
const STAMPED = "whisperStamped(uint256,uint256,uint8,bytes32,bytes,address,uint128)";
const EXEC = "execute(address,uint256,bytes,uint8)";
const GRANT = "grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)";
const HOSTILE = "</script><img src=x onerror=alert(1)> & <b>bold</b>";
const ORD = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
const PK8 = "3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420";
const lower = (s) => String(s).toLowerCase();
const hexOf = (s) => "0x" + Buffer.from(s, "utf8").toString("hex");
/// word i of a calldata hex, after the four-byte selector; the address in it
const word = (cd, i) => BigInt("0x" + cd.slice(10 + 64 * i, 10 + 64 * (i + 1)));
const addrWord = (cd, i) => "0x" + cd.slice(10 + 64 * i + 24, 10 + 64 * (i + 1));
const date = (t) => new Date(Number(t) * 1e3).toISOString().replace("T", " ").slice(0, 16) + " UTC";
const checksum = (a, kec) => { const h = kec(Buffer.from(a.slice(2).toLowerCase(), "utf8")).slice(2); let o = "0x"; for (let i = 0; i < 40; i++) o += parseInt(h[i], 16) >= 8 ? a[i + 2].toUpperCase() : a[i + 2].toLowerCase(); return o; };
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
  return { message: msg.toString("utf8"), sig: "0x" + sig.toString("hex"), pk: "0x04" + Buffer.from(jwk.x, "base64url").toString("hex") + Buffer.from(jwk.y, "base64url").toString("hex") };
}

export async function run(t, ctx) {
  const { c, site, actors, weth, sel, enc, decUint, decAddr, kec, fs, path, ROOT, ZERO, walletFor, bootToken, lane, mint, EVM } = ctx;
  const { me, renter, buyer, stranger, guardianW, agentW } = actors;
  const ME = me.from.toString(), BUYER = buyer.from.toString(), hub = site.hub, parley = site.parley, postage = site.postage, keys = site.keys, roster = site.roster;
  const now = () => EVM.BLOCK.header.timestamp;
  const roll = (n) => ctx.roll(EVM.BLOCK.header.number + BigInt(n));
  const DIST = fs.readFileSync(path.join(ROOT, "dist/app.html"), "utf8");
  const DIST_SOCIAL = fs.readFileSync(path.join(ROOT, "dist/panels/social.js"), "utf8");
  const calls = (W, method) => W.calls.filter((x) => x.method === method);
  const callsWith = (W, to, selector) => calls(W, "eth_call").filter((x) => lower(x.params[0].to) === lower(to) && lower(x.params[0].data).startsWith(selector));
  const slabOpen = (page) => page.$("#cbox").classList.contains("on");
  const slabCd = (page) => page.text("#cslab [data-calldata]");
  const gasRow = (page) => page.text("#cslab [data-gas]");
  const tick = (page) => page.text("#tick");
  const L = (page, s) => page.$("#lane-social " + s);
  const LL = (page, s) => page.$$("#lane-social " + s);
  const laneText = (page) => page.text("#lane-social");
  const rows = (page, feed) => LL(page, feed + " .row");
  const bodyOf = (r) => r.querySelector(".body");
  /// press a lane button and wait for the slab with its estimate answered
  const press = async (page, el) => { page.click(el); await page.until(() => slabOpen(page) && gasRow(page) !== "estimating…", 120); };
  const sign = async (page, W, n) => { page.click(page.$("#cslab [data-go]")); await page.until(() => W.sent() === n, 120); await page.settle(); await page.settle(); await page.settle(); };
  const count = async (room) => decUint(await c.read(parley, "stateOf(uint256)", [room]), 1);
  const keyIdOf = async (id) => "0x" + (await c.read(parley, "keyOf(uint256)", [id])).slice(66, 130);
  const speakCount = (page) => LL(page, "[data-act=speak]").length;
  /// settle until the wallet has been asked nothing new for three settles in a row: every read a
  /// race started has answered (a fixed count of settles is a guess about the EVM's speed)
  const quiet = async (page, W) => { for (let n = W.calls.length, k = 0, j = 0; k < 3 && j < 80; j++) { await page.settle(); if (W.calls.length === n) k++; else { n = W.calls.length; k = 0; } } };
  /// the DM feed's status line, which carries no id: the note right after #social-dm-feed
  const dmFeedStatus = (page) => { const f = L(page, "#social-dm-feed"); return f && f.nextSibling ? f.nextSibling.textContent : ""; };
  /// the inbox's ledger row as [key, value], or null before it is painted
  const earned = (page) => { const r = LL(page, "#social-inbox .kv").find((x) => /^earned/.test(x.querySelector(".k").textContent)); return r ? [r.querySelector(".k").textContent, r.querySelector(".v").textContent] : null; };

  /* the cast */
  await mint(c, site, ME); await mint(c, site, ME); await mint(c, site, ME);
  const reach1 = decAddr(await c.read(hub, "account(uint256)", [1]));
  await c.exec(hub, "setUser(uint256,address,uint64)", [1, renter.from.toString(), now() + 7n * 86400n]);
  await c.exec(parley, SPEAK, [0, 1, 0, 0, 0, hexOf("hello, commons")], { label: "speak" });
  roll(2);
  await c.exec(parley, SPEAK, [0, 1, 0, 0, 0, hexOf("and again")], { label: "speak" });
  await c.exec(hub, "setGuardian(uint256,address)", [1, guardianW.from.toString()]);
  await c.exec(hub, "approve(address,uint256)", [stranger.from.toString(), 1]);
  await c.exec(reach1, GRANT, [agentW.from.toString(), now() + 86400n, 0n, [], [weth], [sel("transfer(address,uint256)")], 0, 0], { label: "grantSession" });
  await c.exec(parley, "found(uint256,string,bool)", [1, "the first room", true], { label: "found" });
  const home1 = decUint(await c.read(parley, "homeKey(uint256)", [1]));
  await c.exec(parley, SPEAK, [home1, 1, 0, 0, 0, hexOf("at home")], { label: "speak" });
  await c.exec(parley, "join(uint256,uint256)", [home1, 3], { label: "join" });
  const members = async () => { const r = await c.read(roster, "membersOf(uint256,uint256)", [home1, 0]); return Number(decUint(r, Number(decUint(r, 0)) / 32)); };

  /*═══════════ D · a renter sees the walk and the sentence ═══════════*/
  t.head("D · a renter sees the walk and the sentence (console as the renter of #1)");
  let D = true;
  const d = (cond, name, detail) => { t.ok(cond, name, detail); D = D && !!cond; };
  {
    const W = walletFor(c, renter);
    const { page, S } = await bootToken(1, { wallet: W });
    const rc = callsWith(W, hub, sel("rightsOf(uint256,address)"));
    d(rc.length === 1 && lower("0x" + rc[0].params[0].data.slice(10 + 64 + 24, 10 + 128)) === lower(renter.from.toString()), "one free rightsOf at connect, for the renter", `rightsOf calls ${rc.length}`);
    d(page.$("body").dataset.rights === "4", "the body carries the bits: USE", page.$("body").dataset.rights);
    d(page.text("#rights-sentence") === "you are the user until " + date(S.clocks.userExpires), "Home says you are the user until when, the date from the state block's clock", page.text("#rights-sentence"));
    await lane(page, "social");
    await page.until(() => rows(page, "#social-commons").length === 2, 60);
    d(speakCount(page) === 0 && LL(page, "#social-composer textarea").length === 0 && LL(page, "#social-composer input").length === 0 && LL(page, "[data-act=speakAsReach]").length === 0,
      "the composer is not there: no speak control, no textarea, no input", `speak ${speakCount(page)} textarea ${LL(page, "#social-composer textarea").length}`);
    const cr = rows(page, "#social-commons");
    d(cr.length === 2 && bodyOf(cr[0]).textContent === "hello, commons" && bodyOf(cr[1]).textContent === "and again" && /^all 2 messages$/.test(page.text("#lane-social #social-commons-status")),
      "the walk is: two messages, oldest first, and the count from stateOf word 1", `${cr.length} rows; status "${page.text("#lane-social #social-commons-status")}"`);
    const why = page.text("#lane-social #social-why");
    d(/user|renter/.test(why) && /holder/.test(why) && /Reach/.test(why), "and the sentence says why: the user is not the holder, nor the token's own Reach", why);
    /* a number typed after the renter's own: the DM status is the new pair's (found by review: arm() cleared
       everything but the status, and "a token cannot whisper to itself" outlived the next number typed) */
    page.type(L(page, "#social-dm-to"), "1");
    const self = page.text("#lane-social #social-dm-status");
    page.type(L(page, "#social-dm-to"), "3");
    await page.until(() => dmFeedStatus(page) === "nothing whispered yet", 40); await quiet(page, W);
    d(self === "a token cannot whisper to itself" && page.text("#lane-social #social-dm-status") === "" && /^you are the user/.test(page.text("#lane-social #social-dm .gate")) && rows(page, "#social-dm-feed").length === 0,
      "a number typed after the renter's own leaves nothing behind: the DM status drops a token cannot whisper to itself, and the pair's walk and the user's sentence stand alone",
      `before "${self}" after "${page.text("#lane-social #social-dm-status")}" gate "${page.text("#lane-social #social-dm .gate")}" feed "${dmFeedStatus(page)}"`);
    page.type(L(page, "#social-dm-to"), ""); await quiet(page, W);
    /* the other lanes, read in the form that holds against the fixture standing in for a panel on this branch */
    await lane(page, "swap");
    d(page.$$("#lane-swap [data-act]").every((b) => b.dataset.act === "swap") && ["openMarket", "deposit", "withdraw", "setFee", "sealMarket", "closeMarket"].every((a) => page.$$("#lane-swap [data-act=" + a + "]").length === 0),
      "a renter may still trade like anyone: the only control the swap lane could offer the renter is the swap itself, never the holder's market", page.$$("#lane-swap [data-act]").map((b) => b.dataset.act).join(","));
    await lane(page, "vault");
    d(page.$$("#lane-vault [data-act]").length === 0, "the vault answers to the holder: no control for the renter (the fixture stands in for the vault panel on this branch; the sentence itself is the vault group's)");
    await lane(page, "identity");
    d(page.$$("#lane-identity [data-act=setTrait]").length === 0, "traits are read-only for the renter");
    const pressed = [];
    for (const s of ["#lane-social [data-act]", "#lane-vault [data-act]", "#lane-identity [data-act]", "#lane-swap #swap-your-market [data-act]", "#lane-social button"]) {
      for (const b of page.$$(s)) if (!b.hasAttribute("data-go")) { pressed.push(b.textContent); try { page.click(b); } catch {} }
    }
    await page.settle(); await page.settle();
    d(W.sent() === 0 && !slabOpen(page), `nothing a renter can press sends (${pressed.length} control(s) pressed across the lanes, every one a read)`, pressed.join(" | "));
    d(W.count("eth_estimateGas") === 0 && W.prompts().length === 0, "nothing a renter can press even estimates, and no prompt was reached", `estimates ${W.count("eth_estimateGas")} prompts ${W.prompts().length}`);
    /* the right expires: the body reads 0, the sentence goes, and the lane repaints without the user's words */
    await lane(page, "social");
    ctx.warpBy(8 * 86400);
    W.emit("accountsChanged", [renter.from.toString()]); await page.settle(); await page.settle();
    await page.until(() => page.$("body").dataset.rights === "0", 40);
    const why2 = page.text("#lane-social #social-why");
    d(page.$("body").dataset.rights === "0" && page.text("#rights-sentence") === "" && !/you are the user/.test(why2) && /holder/.test(why2) && speakCount(page) === 0,
      "the right expires and the sentence with it: the body reads 0, Home's sentence is gone, the lane says the holder speaks", `rights ${page.$("body").dataset.rights} home "${page.text("#rights-sentence")}" why "${why2}"`);
    d(page.innerHTMLWrites === 0 && page.errors.length === 0, "nothing was assigned through innerHTML on the renter's page, and no script threw", page.errors.map((e) => e.message).join("; "));
    page.close();
  }
  t.ok(D, "a renter sees the walk and the sentence");

  /*═══════════ I · the composer appears only for HOLD or ACCOUNT ═══════════*/
  t.head("I · the composer appears only for HOLD or ACCOUNT");
  let I = true;
  const i = (cond, name, detail) => { t.ok(cond, name, detail); I = I && !!cond; };
  const none = async (W, opts, label, re) => {
    const { page } = await bootToken(1, Object.assign({ wallet: W }, opts || {}));
    await lane(page, "social");
    await page.until(() => !!L(page, "#social-why"), 40);
    const why = page.text("#lane-social #social-why");
    i(speakCount(page) === 0 && LL(page, "#social-composer textarea").length === 0 && re.test(why), label, `rights "${page.$("body").dataset.rights}" speak ${speakCount(page)} why "${why}"`);
    page.close();
  };
  /* D warped past the lease; the renter is the user again for this block */
  await c.exec(hub, "setUser(uint256,address,uint64)", [1, renter.from.toString(), now() + 7n * 86400n]);
  await none(walletFor(c, renter), {}, "renter (4): no composer, the user's sentence", /you are the user/);
  await none(walletFor(c, stranger), {}, "stranger with the single approval (8): no composer; an operator may move the token, not speak", /an operator may move the token, not speak/);
  await none(walletFor(c, agentW), { query: "?as=" + agentW.from.toString() }, "session key (128): no composer; a session speaks only through the Reach", /a session speaks only through the Reach/);
  {
    /* the same key's wallet connected in the console, without ?as: its bits are SESSION alone (found by review:
       the lane printed the stranger's sentence while Home printed the session's). D's warp outlived the cast's
       one-day grant, so the session is granted again for this block; the ?as line above holds either way,
       because session mode says the session's sentence whatever the bits */
    await c.exec(reach1, GRANT, [agentW.from.toString(), now() + 86400n, 0n, [], [weth], [sel("transfer(address,uint256)")], 0, 0], { label: "grantSession" });
    const W = walletFor(c, agentW);
    const { page } = await bootToken(1, { wallet: W });
    await lane(page, "social");
    await page.until(() => !!L(page, "#social-why"), 40);
    const why = page.text("#lane-social #social-why");
    i(page.$("body").dataset.mode === "console" && page.$("body").dataset.rights === "128" && speakCount(page) === 0 && LL(page, "#social-composer textarea").length === 0 && why === "a session speaks only through the Reach" && page.text("#rights-sentence") === why,
      "a session key's wallet in the console, without ?as (128): no composer, and the lane says what Home says — a session speaks only through the Reach — not the stranger's sentence",
      `mode ${page.$("body").dataset.mode} rights ${page.$("body").dataset.rights} why "${why}" home "${page.text("#rights-sentence")}"`);
    page.close();
  }
  await none(walletFor(c, guardianW), {}, "guardian (64): no composer; a guardian does not speak as the token", /guardian/);
  await none(walletFor(c, me, { accounts: [] }), {}, "nobody (0): no composer; connect the holding wallet", /connect the holding wallet/);
  {
    const W = walletFor(c, me);
    const { page, S } = await bootToken(1, { wallet: W });
    await lane(page, "social");
    await page.until(() => LL(page, "#social-rooms .room [data-act=speak]").length >= 1 && rows(page, "#social-commons").length === 2, 80);
    i(page.$("body").dataset.rights === "1" && LL(page, "#social-composer [data-act=speak]").length === 1 && LL(page, "#social-home [data-act=speak]").length === 1 && LL(page, "#social-rooms .room [data-act=speak]").length === 1 && L(page, "#social-why") === null,
      "holder (1): the composer is on the commons, the home room and the room it founded", `speak ${speakCount(page)} rights ${page.$("body").dataset.rights}`);
    i(LL(page, "#social-composer textarea").length === 1 && /the first room/.test(page.text("#lane-social #social-rooms")) && /founded by #1/.test(page.text("#lane-social #social-rooms")),
      "the room is named from the Founded log at the block it opened, and its steward is said", page.text("#lane-social #social-rooms").slice(0, 160));
    /* the Reach's own hand: the same words, wrapped in execute(parley, 0, speak(…), 0) */
    roll(2);
    page.type(L(page, "#social-composer textarea"), "through the Reach");
    await press(page, L(page, "[data-act=speakAsReach]"));
    let cd = slabCd(page);
    const innerLen = Number(word(cd, 4)), inner = "0x" + cd.slice(10 + 64 * 5, 10 + 64 * 5 + innerLen * 2);
    i(lower(page.text("#cslab [data-to]")) === lower(S.reach) && page.text("#cslab [data-function]") === EXEC && lower(addrWord(cd, 0)) === lower(parley) && word(cd, 1) === 0n && word(cd, 3) === 0n && inner.startsWith(lower(S.sel["parley.speak"])) &&
      word(inner, 0) === 0n && word(inner, 1) === 1n && /^\d+ units$/.test(gasRow(page)),
      "the Reach's own hand is offered to the holder: execute to the Reach, operation 0, the inner data a speak in the commons as #1 — and the estimate passes, because mayActAs admits the account", `to ${page.text("#cslab [data-to]")} fn ${page.text("#cslab [data-function]")} op ${word(cd, 3)} inner ${inner.slice(0, 10)} gas "${gasRow(page)}"`);
    const c0 = await count(0n);
    await sign(page, W, 1);
    await page.until(() => rows(page, "#social-commons").length === 3, 60);
    i(await count(0n) === c0 + 1n && bodyOf(rows(page, "#social-commons")[2]).textContent === "through the Reach" && rows(page, "#social-commons")[2].querySelector(".who").textContent === "#1",
      "signed, the Reach spoke as #1 and the walk shows it under the token, not the account", `count ${await count(0n)} rows ${rows(page, "#social-commons").length}`);
    /* speaking raises a slab naming the commons and speak; signed, the count moves by one */
    roll(2);
    page.type(L(page, "#social-composer textarea"), "a word from the console");
    await press(page, L(page, "[data-act=speak]"));
    cd = slabCd(page);
    const slab = page.text("#cslab");
    i(page.text("#cslab [data-function]") === SPEAK && /the commons/.test(slab) && /forever/.test(slab) && word(cd, 5) === 0xc0n && word(cd, 0) === 0n && word(cd, 1) === 1n && word(cd, 2) === 0n && page.text('#cslab [data-arg="1"]') === "1",
      "speaking raises a slab naming the commons and speak: six head words, the body at 0xc0, the arguments decoded from the bytes", `fn ${page.text("#cslab [data-function]")} offset ${word(cd, 5)}`);
    const c1 = await count(0n);
    await sign(page, W, 2);
    await page.until(() => rows(page, "#social-commons").length === 4, 60);
    i(await count(0n) === c1 + 1n && bodyOf(rows(page, "#social-commons")[3]).textContent === "a word from the console" && L(page, "#social-composer textarea").value === "" && /landed in block/.test(tick(page)),
      "Sign → stateOf(0) word 1 moves by one, the walk shows the word, the composer is cleared", `count ${await count(0n)} tick "${tick(page)}"`);
    /* the walk reads one block at a time by a topic the chain computed */
    const filters = W.filters(), commonsF = filters.filter((f) => f.topics && lower(f.topics[1]) === "0x" + "0".repeat(64));
    i(filters.length >= 6 && filters.every((f) => f.fromBlock === f.toBlock) && commonsF.length >= 3 && commonsF.every((f) => lower(f.topics[0]) === lower(S.topics.said) && lower(f.address) === lower(parley)) &&
      filters.every((f) => lower(f.topics[0]) === lower(S.topics.said) || lower(f.topics[0]) === lower(S.topics.founded)),
      `the walk reads one block at a time by a topic the chain computed (${filters.length} single-block queries, ${commonsF.length} on the commons, no range scan)`, JSON.stringify(filters.find((f) => f.fromBlock !== f.toBlock) || null));
    i(W.callsTo(parley, sel("heads(uint256[])")).length === 0, "heads() is never asked: a count is stateOf word 1, a head is a block");
    /* a hostile body is text (O3, counted once) */
    roll(2);
    page.type(L(page, "#social-composer textarea"), HOSTILE);
    await press(page, L(page, "[data-act=speak]"));
    await sign(page, W, 3);
    await page.until(() => rows(page, "#social-commons").length === 5, 60);
    const last = rows(page, "#social-commons")[4];
    i(bodyOf(last).textContent === HOSTILE && bodyOf(last).children.length === 0 && LL(page, "script").length === 0 && LL(page, "img").length === 0 && page.innerHTMLWrites === 0,
      "a hostile body is text: it reads exactly as typed, with no element parsed out of it", `"${bodyOf(last).textContent}" children ${bodyOf(last).children.length}`);
    i(rows(page, "#social-commons").every((r) => /^#\d+$/.test(r.querySelector(".who").textContent)) && rows(page, "#social-commons").every((r) => r.querySelector(".who").textContent === "#1"),
      "the sender is a token, not an address", rows(page, "#social-commons").map((r) => r.querySelector(".who").textContent).join(","));
    /* followers are the roster */
    await page.until(() => LL(page, "#social-followers .token").length === 1, 40);
    const n = await members();
    i(LL(page, "#social-followers .token").length === 1 && n === 1 && LL(page, "#social-followers .token")[0].textContent === "#3" && rows(page, "#social-home-feed").length === 1 && bodyOf(rows(page, "#social-home-feed")[0]).textContent === "at home",
      "followers are the roster: #3 follows #1's home, membersOf agrees, and the home feed walks", `tokens ${LL(page, "#social-followers .token").length} membersOf ${n}`);
    i(/reactions unavailable on this chain/.test(laneText(page)), "reactions degrade in words: reactions unavailable on this chain");
    page.close();
  }
  {
    /* a home that has not spoken says so — #3 is silent; the count came from stateOf, never heads */
    const W = walletFor(c, me);
    const { page } = await bootToken(3, { wallet: W });
    await lane(page, "social");
    await page.until(() => /has not spoken yet/.test(page.text("#lane-social #social-home")), 40);
    i(/has not spoken yet/.test(page.text("#lane-social #social-home")) && W.callsTo(parley, sel("heads(uint256[])")).length === 0 && W.callsTo(parley, sel("stateOf(uint256)")).length >= 2,
      "a home that has not spoken says so, from stateOf word 1 — no heads call precedes the sentence", page.text("#lane-social #social-home").slice(0, 120));
    page.close();
  }

  /*──── the sealing flow: one key per wallet, both bound, re-read before every send ────*/
  const mine = await sealKey(me, 1, hub);
  await c.exec(keys, "setEncryptionKey(uint16,bytes)", [3, mine.pk], { label: "setEncryptionKey" });
  await c.exec(parley, "bindKey(uint256)", [1], { label: "bindKey" });
  const W2 = walletFor(c, me);
  const { page: p2, ctx: v2, S: S2 } = await bootToken(1, { wallet: W2 });
  await lane(p2, "social");
  const status = () => p2.text("#lane-social #social-dm-status");
  p2.type(L(p2, "#social-dm-to"), "3");
  await p2.until(() => /no key/.test(status()), 40);
  const oneKey = /no key — this room cannot be sealed/.test(status()) && LL(p2, "[data-act=whisper]").length === 1 && /in the clear/.test(L(p2, "[data-act=whisper]").textContent);
  await c.exec(parley, "bindKey(uint256)", [3], { label: "bindKey" });
  p2.type(L(p2, "#social-dm-to"), "3");
  await p2.until(() => !!L(p2, "#social-dm-derive"), 40);
  i(oneKey && /both keys are bound/.test(status()) && LL(p2, "[data-act=whisper]").length === 0 && W2.prompts().length === 0,
    "sealed only when both keys exist: one key reads no key — this room cannot be sealed (and a whisper in the clear is offered, labelled); both bound, the key must be derived first and nothing is offered in the clear", `one "${oneKey}" status "${status()}"`);
  p2.click(L(p2, "#social-dm-derive"));
  await p2.until(() => /^sealed/.test(status()), 80);
  const ps = W2.prompts().filter((p) => p.method === "personal_sign");
  i(/^sealed/.test(status()) && ps.length === 1 && ps[0].message === mine.message && ps[0].message === "INTACT seal v1 · chain 1 · hub " + lower(hub) && !/token|epoch/i.test(ps[0].message),
    "the sealing sentence is one key per wallet: exactly the D7 sentence, chain and hub only, no token id and no epoch — and the status now begins sealed", `prompts ${ps.length} "${ps[0] && ps[0].message}" status "${status()}"`);
  const refused = await t.refuses(() => v2.INTACT.ui.request("personal_sign", ["0x00", ME]), /a panel cannot send; propose it/, "a panel cannot sign the sentence itself: ui.request(personal_sign) is refused");
  i(!!refused && /sign this sentence nowhere but here/.test(laneText(p2)) && /no forward secrecy/.test(laneText(p2)) && !JSON.stringify(v2.INTACT).includes(mine.sig.slice(2)) && !DIST_SOCIAL.includes("personal_sign") && (DIST.match(/personal_sign/g) || []).length === 1,
    "the shell is the only hand that signs it: the banner says sign this sentence nowhere but here, nothing on INTACT holds the signature, the shipped panel never names personal_sign and the shell names it once", `banner ${/sign this sentence nowhere but here/.test(laneText(p2))} panel ${DIST_SOCIAL.includes("personal_sign")} shell ${(DIST.match(/personal_sign/g) || []).length}`);
  /* the DM key is re-read before every send: after the review click, inside the press, before the send */
  const keyId3 = await keyIdOf(3);
  p2.type(L(p2, "#social-dm textarea"), "hello, sealed");
  const mark0 = W2.calls.length;
  await press(p2, L(p2, "[data-act=whisper]"));
  let cd2 = slabCd(p2);
  const reviewReads = W2.callsTo(parley, sel("keyOf(uint256)")).filter((x) => W2.calls.indexOf(x) >= mark0 && word(x.params[0].data, 0) === 3n);
  i(page2Open() && p2.text("#cslab [data-function]") === WHISPER && word(cd2, 0) === 1n && word(cd2, 1) === 3n && word(cd2, 2) === 1n && "0x" + cd2.slice(10 + 64 * 3, 10 + 64 * 4) === keyId3 && word(cd2, 4) === 0xa0n && reviewReads.length >= 1 && /^\d+ units$/.test(gasRow(p2)),
    "the sealed whisper names the recipient's key id as read, kind 1, the body at 0xa0 — the key re-read once when the slab was built, and the estimate passes", `fn ${p2.text("#cslab [data-function]")} kind ${word(cd2, 2)} keyId ${"0x" + cd2.slice(10 + 64 * 3, 10 + 64 * 4)} vs ${keyId3} reads ${reviewReads.length} gas "${gasRow(p2)}"`);
  function page2Open() { return slabOpen(p2); }
  const mark = W2.calls.length;
  await sign(p2, W2, 1);
  const sendIdx = W2.lastIndex("eth_sendTransaction");
  const pressReads = W2.callsTo(parley, sel("keyOf(uint256)")).map((x) => W2.calls.indexOf(x)).filter((k) => k >= mark && k < sendIdx);
  const epochReads = W2.callsTo(hub, sel("custodyEpoch(uint256)")).map((x) => W2.calls.indexOf(x)).filter((k) => k >= mark && k < sendIdx);
  i(W2.sent() === 1 && pressReads.length === 1 && epochReads.length >= 1 && [...W2.receipts.values()].pop().status === "0x1",
    "the DM key is re-read before every send: between the press and eth_sendTransaction, keyOf(3) once more beside the epoch, and the whisper lands", `press reads ${pressReads.length} epoch reads ${epochReads.length} sent ${W2.sent()} status ${[...W2.receipts.values()].pop().status}`);
  await p2.until(() => rows(p2, "#social-dm-feed").length === 1 && bodyOf(rows(p2, "#social-dm-feed")[0]).textContent === "hello, sealed", 80);
  const pair = decUint(await c.read(parley, "pairKey(uint256,uint256)", [1, 3]));
  const sealedLog = c.getLogs({ address: parley, topics: [S2.topics.said, "0x" + pair.toString(16).padStart(64, "0")] }).pop();
  const kindWord = sealedLog && BigInt("0x" + sealedLog.data.slice(2 + 64 * 3, 2 + 64 * 4));
  i(rows(p2, "#social-dm-feed").length === 1 && bodyOf(rows(p2, "#social-dm-feed")[0]).textContent === "hello, sealed" && kindWord === 1n && !Buffer.from(sealedLog.data.slice(2), "hex").toString("latin1").includes("hello, sealed"),
    "the sealed row opens on the page under the sender's own copy; on the chain the body is kind 1 and does not carry the words", `kind ${kindWord} rows ${rows(p2, "#social-dm-feed").length}`);
  /* two recipients inside one round trip: #3's walk, keys and receipts are still in flight when 2 is typed
     (found by review: #3's row and its count, a second composer, and the sealed label stayed under #2, who has no key) */
  p2.type(L(p2, "#social-dm-to"), "3"); p2.type(L(p2, "#social-dm-to"), "2");
  await p2.until(() => /^#2 has no key/.test(status()), 60); await quiet(p2, W2);
  const raced = rows(p2, "#social-dm-feed"), racedWh = LL(p2, "[data-act=whisper]");
  i(L(p2, "#social-dm-to").value === "2" && raced.length === 0 && dmFeedStatus(p2) === "nothing whispered yet" && LL(p2, "#social-dm textarea").length === 1 && racedWh.length === 1 && racedWh[0].textContent === "review the whisper, in the clear",
    "a recipient typed before the last one's reads answered gets only its own room: no row of #3's, nothing whispered yet, one composer, and it is in the clear",
    `rows ${raced.length} [${raced.map((r) => bodyOf(r).textContent).join(" | ")}] feed "${dmFeedStatus(p2)}" textareas ${LL(p2, "#social-dm textarea").length} whisper [${racedWh.map((b) => b.textContent).join(" | ")}]`);
  p2.type(L(p2, "#social-dm-to"), "3");
  await p2.until(() => /^sealed/.test(status()) && rows(p2, "#social-dm-feed").length === 1, 60); await quiet(p2, W2);
  /* #3 changes hands and the buyer binds a key of its own: the next send is refused, nothing is sent, nothing in the clear */
  await c.exec(hub, "transferFrom(address,address,uint256)", [ME, BUYER, 3], { label: "transferFrom" });
  const theirs = await sealKey(buyer, 1, hub);
  await buyer.exec(keys, "setEncryptionKey(uint16,bytes)", [3, theirs.pk], { label: "setEncryptionKey" });
  await buyer.exec(parley, "bindKey(uint256)", [3], { label: "bindKey" });
  const newId = await keyIdOf(3);
  p2.type(L(p2, "#social-dm textarea"), "a second word");
  p2.click(L(p2, "[data-act=whisper]"));
  await p2.until(() => /key moved/.test(tick(p2)), 60); await p2.settle(); await p2.settle();
  const sends = calls(W2, "eth_sendTransaction");
  const clearToPair = sends.filter((x) => lower(x.params[0].to) === lower(parley) && (lower(x.params[0].data).startsWith(lower(S2.sel["parley.whisper"])) || lower(x.params[0].data).startsWith(lower(S2.sel["parley.whisperStamped"]))) && word(x.params[0].data, 2) === 0n);
  i(/#3's key moved — review again/.test(tick(p2)) && !slabOpen(p2) && W2.sent() === 1 && clearToPair.length === 0 && newId !== keyId3,
    "after the sale and a rebinding under the buyer the next send is refused with key moved — review again; W.sent() is unchanged and no plaintext whisper was sent", `tick "${tick(p2)}" sent ${W2.sent()} clear ${clearToPair.length}`);
  await p2.until(() => /^sealed/.test(status()) && new RegExp(newId.slice(0, 10)).test(status()), 60);
  i(/^sealed/.test(status()) && status().includes(newId.slice(0, 10)) && L(p2, "#social-dm textarea").value === "a second word",
    "review again: the room re-arms to the buyer's key, says which, and keeps what was typed", status());
  /* the same refusal from the read inside the press: the slab is open when #3's key moves under it (found by
     review: the press refused, nothing was sent, and the status went on naming the key that had moved) */
  await press(p2, L(p2, "[data-act=whisper]"));
  const slabBefore = slabOpen(p2) && p2.text("#cslab [data-function]") === WHISPER && /^\d+ units$/.test(gasRow(p2)) && "0x" + slabCd(p2).slice(10 + 64 * 3, 10 + 64 * 4) === newId;
  const third = await sealKey(stranger, 1, hub);
  await buyer.exec(keys, "setEncryptionKey(uint16,bytes)", [3, third.pk], { label: "setEncryptionKey" });
  await buyer.exec(parley, "bindKey(uint256)", [3], { label: "bindKey" });
  const thirdId = await keyIdOf(3), markGo = W2.calls.length, sentGo = W2.sent();
  p2.click(p2.$("#cslab [data-go]"));
  await p2.until(() => /key moved/.test(tick(p2)) && !slabOpen(p2), 60);
  await p2.until(() => /^sealed/.test(status()) && status().includes(thirdId.slice(0, 10)), 60);
  const firstAsked = W2.calls.slice(markGo).find((x) => x.method === "eth_call" && lower(x.params[0].to) === lower(parley));
  i(slabBefore && thirdId !== newId && /#3's key moved — review again/.test(tick(p2)) && !slabOpen(p2) && W2.sent() === sentGo &&
    !!firstAsked && lower(firstAsked.params[0].data).startsWith(lower(sel("keyOf(uint256)"))) && word(firstAsked.params[0].data, 0) === 3n &&
    /^sealed/.test(status()) && status().includes(thirdId.slice(0, 10)) && L(p2, "#social-dm textarea").value === "a second word",
    "a key that moves under the open slab is refused by the read inside the press — nothing sent, keyOf(3) the first thing asked of Parley after the click — and the room re-arms to the key it found, keeping what was typed",
    `slab ${slabBefore} tick "${tick(p2)}" sent ${W2.sent()} (was ${sentGo}) first ${firstAsked && firstAsked.params[0].data.slice(0, 10)} status "${status()}" typed "${L(p2, "#social-dm textarea") && L(p2, "#social-dm textarea").value}"`);
  p2.type(L(p2, "#social-dm-to"), "3");
  await p2.until(() => /^sealed/.test(status()) && status().includes(thirdId.slice(0, 10)), 60); await quiet(p2, W2);
  /* a recipient key this page cannot seal to: the buyer publishes 32 bytes of another type and binds them to #3
     (found by review: the note under the composer sent the holder to derive or bind, which mends nothing) */
  await buyer.exec(keys, "setEncryptionKey(uint16,bytes)", [1, "0x" + "ab".repeat(32)], { label: "setEncryptionKey" });
  await buyer.exec(parley, "bindKey(uint256)", [3], { label: "bindKey" });
  p2.type(L(p2, "#social-dm-to"), "3");
  await p2.until(() => /not a P-256 key/.test(status()), 60); await quiet(p2, W2);
  const dmScreen = p2.text("#lane-social #social-dm");
  i(status() === "#3's key is not a P-256 key; this page cannot seal to it" && LL(p2, "[data-act=whisper]").length === 0 && !/derive or bind/.test(dmScreen) && /a sealable room is never sent in the clear/.test(dmScreen),
    "a recipient key this page cannot seal to is said as that, and nothing sends the holder elsewhere: no whisper control, no note to derive or bind, nothing in the clear",
    `status "${status()}" whisper ${LL(p2, "[data-act=whisper]").length} note "${(dmScreen.match(/[^.;]*sealable room[^.]*/) || [""])[0]}"`);
  await buyer.exec(keys, "setEncryptionKey(uint16,bytes)", [3, third.pk], { label: "setEncryptionKey" });
  await buyer.exec(parley, "bindKey(uint256)", [3], { label: "bindKey" });
  p2.type(L(p2, "#social-dm-to"), "3");
  await p2.until(() => /^sealed/.test(status()) && status().includes(thirdId.slice(0, 10)), 60); await quiet(p2, W2);
  t.ok(I, "the composer appears only for HOLD or ACCOUNT");

  /*═══════════ K′ · inbox and postage ═══════════*/
  t.head("K′ · inbox and postage");
  {
    await buyer.exec(postage, "configureInbox(uint256,address,uint128,uint64,bool)", [3, ZERO, WAD / 10n, 86400, true], { label: "configureInbox" });
    const { page: p3 } = await bootToken(3, { wallet: walletFor(c, buyer) });
    await lane(p3, "social");
    await p3.until(() => /0\.1 ETH/.test(p3.text("#lane-social #social-inbox")), 40);
    t.ok(/0\.1 ETH per first contact/.test(p3.text("#lane-social #social-inbox")) && /1440-minute window/.test(p3.text("#lane-social #social-inbox")) && LL(p3, "[data-act=configureInbox]").length === 1,
      "a priced inbox is a fact: #3's inbox reads 0.1 ETH per first contact with its window, and its holder has the price list", p3.text("#lane-social #social-inbox").slice(0, 160));
    p3.close();
    /* first contact to a priced inbox, from #1 (whose text is still typed), proposes the stamped form with the exact value */
    await press(p2, L(p2, "[data-act=whisper]"));
    const cd = slabCd(p2), slab = p2.text("#cslab");
    t.ok(p2.text("#cslab [data-function]") === STAMPED && p2.$("#cslab [data-value]").dataset.wei === String(WAD / 10n) && /refunded if ignored/.test(slab) && word(cd, 4) === 0xe0n && lower(addrWord(cd, 5)) === ZERO && word(cd, 6) === WAD / 10n && word(cd, 2) === 1n && /^\d+ units$/.test(gasRow(p2)),
      "first contact to a priced inbox proposes the stamped form with the exact value: whisperStamped, 0.1 ETH as value, the body at 0xe0, maxPostage exactly the postage, still sealed, and the estimate passes", `fn ${p2.text("#cslab [data-function]")} wei ${p2.$("#cslab [data-value]") && p2.$("#cslab [data-value]").dataset.wei} offset ${word(cd, 4)} gas "${gasRow(p2)}"`);
    p2.click(p2.$("#cslab [data-no]")); await p2.settle();
    /* ERC-20 postage names the paying hand: the Reach, after its exact approve */
    await buyer.exec(postage, "configureInbox(uint256,address,uint128,uint64,bool)", [3, weth, 5n * WAD, 86400, true], { label: "configureInbox" });
    await c.exec(weth, "mint(address,uint256)", [reach1, 10n * WAD]);
    await press(p2, L(p2, "[data-act=whisper]"));
    const cdA = slabCd(p2), innerLen = Number(word(cdA, 4)), innerA = "0x" + cdA.slice(10 + 64 * 5, 10 + 64 * 5 + innerLen * 2);
    t.ok(p2.text("#cslab [data-function]") === EXEC && lower(p2.text("#cslab [data-to]")) === lower(S2.reach) && lower(addrWord(cdA, 0)) === lower(weth) && innerA.startsWith(lower(S2.sel["erc20.approve"])) && lower(addrWord(innerA, 0)) === lower(postage) && word(innerA, 1) === 5n * WAD &&
      /paid by #1's Reach/.test(laneText(p2)) && /Never\s*unlimited/.test(p2.text("#cslab")),
      "ERC-20 postage names the paying hand: the first step is the Reach's exact approve of 5 WETH to Postage, and the lane says the postage is paid by #1's Reach", `fn ${p2.text("#cslab [data-function]")} to ${p2.text("#cslab [data-to]")} inner ${innerA.slice(0, 10)} spender ${addrWord(innerA, 0)} amount ${word(innerA, 1)}`);
    await sign(p2, W2, 2);
    t.ok(decUint(await c.read(weth, "allowance(address,address)", [reach1, postage])) === 5n * WAD && L(p2, "#social-dm textarea").value === "a second word", "the approve lands exactly, and the typed words survive the receipt", L(p2, "#social-dm textarea").value);
    await press(p2, L(p2, "[data-act=whisper]"));
    const cdS = slabCd(p2);
    t.ok(p2.text("#cslab [data-function]") === STAMPED && !p2.$("#cslab [data-value]") && lower(addrWord(cdS, 5)) === lower(weth) && word(cdS, 6) === 5n * WAD && /paid by #1's Reach/.test(p2.text("#cslab")) && /^\d+ units$/.test(gasRow(p2)),
      "pressed again, the same button is the stamped whisper: no value, the fee token and 5 WETH as maxPostage, the sentence names the Reach as payer, the estimate passes", `fn ${p2.text("#cslab [data-function]")} token ${addrWord(cdS, 5)} max ${word(cdS, 6)} gas "${gasRow(p2)}"`);
    await sign(p2, W2, 3);
    const pending = decUint(await c.read(postage, "pendingOf(uint256)", [pair]));
    await p2.until(() => /pending/.test(p2.text("#lane-social #social-receipts")), 60);
    t.ok(pending === 1n && decUint(await c.read(weth, "balanceOf(address)", [reach1])) === 5n * WAD && /stamp 1/.test(p2.text("#lane-social #social-receipts")) && /5 WETH/.test(p2.text("#lane-social #social-receipts")) && LL(p2, "[data-act=expire]").length === 1,
      "the stamp lands: Postage pulled 5 WETH from the Reach, the receipt row reads pending, and expire is offered", `pending ${pending} reach ${decUint(await c.read(weth, "balanceOf(address)", [reach1]))} receipts "${p2.text("#lane-social #social-receipts").slice(0, 120)}"`);
    /* the stamp a pair remembers is that pair's (found by review: one slot followed the lane into every pair) */
    p2.type(L(p2, "#social-dm-to"), "2");
    await p2.until(() => /^#2 has no key/.test(p2.text("#lane-social #social-dm-status")), 60); await quiet(p2, W2);
    const under2 = p2.text("#lane-social #social-receipts"), expireUnder2 = LL(p2, "[data-act=expire]").length;
    p2.type(L(p2, "#social-dm-to"), "3");
    await p2.until(() => /pending/.test(p2.text("#lane-social #social-receipts")) && LL(p2, "[data-act=expire]").length === 1, 60); await quiet(p2, W2);
    t.ok(under2 === "" && expireUnder2 === 0 && /stamp 1/.test(p2.text("#lane-social #social-receipts")) && /pending/.test(p2.text("#lane-social #social-receipts")) && LL(p2, "[data-act=expire]").length === 1,
      "the stamp a pair remembers is that pair's: addressing #2 shows no stamp and no expire, and back on #3 stamp 1 is pending with its expire",
      `under #2 "${under2.slice(0, 120)}" expire ${expireUnder2}; back on #3 "${p2.text("#lane-social #social-receipts").slice(0, 80)}"`);
    /* the window lapses: expire, then the refund — to the Reach, whoever signed */
    await press(p2, L(p2, "[data-act=expire]"));
    const early = gasRow(p2);
    p2.click(p2.$("#cslab [data-no]")); await p2.settle();
    ctx.warpBy(86401);
    await press(p2, L(p2, "[data-act=expire]"));
    t.ok(/^would revert: ReplyWindowOpen\(\d+\)$/.test(early) && /^\d+ units$/.test(gasRow(p2)), "inside the window expire would revert ReplyWindowOpen, said before the wallet; after it the estimate passes", `early "${early}" late "${gasRow(p2)}"`);
    await sign(p2, W2, 4);
    await p2.until(() => LL(p2, "[data-act=claimRefund]").length === 1 && /refunded/.test(p2.text("#lane-social #social-receipts")), 60);
    await press(p2, L(p2, "[data-act=claimRefund]"));
    t.ok(/Reach/.test(p2.text("#cslab")) && /^\d+ units$/.test(gasRow(p2)), "the refund slab names the Reach as the payee", p2.text("#cslab").slice(0, 200));
    await sign(p2, W2, 5);
    t.ok(decUint(await c.read(weth, "balanceOf(address)", [reach1])) === 10n * WAD && decUint(await c.read(postage, "pendingOf(uint256)", [pair])) === 0n,
      "the postage comes back to #1's Reach in full", `reach ${decUint(await c.read(weth, "balanceOf(address)", [reach1]))}`);
    t.ok(p2.innerHTMLWrites === 0 && p2.errors.length === 0, "nothing was assigned through innerHTML on the holder's page, and no script threw (end of K′)", p2.errors.map((e) => e.message).join("; "));
    p2.close();
  }

  /*═══════════ P′ · the holder's other hands, and the refusals (added by review) ═══════════*/
  t.head("P′ · the holder's other hands, and the refusals");
  {
    /* #1's inbox earns 5 WETH before the page boots: priced in WETH, #3 stamps a first word to it, #1 answers
       inside the window, and Parley settles the stamp to #1's fee sink. The price list moves to ETH below. */
    const reach3 = decAddr(await c.read(hub, "account(uint256)", [3])), sink1 = decAddr(await c.read(hub, "feeSink(uint256)", [1]));
    await c.exec(postage, "configureInbox(uint256,address,uint128,uint64,bool)", [1, weth, 5n * WAD, 86400, true], { label: "configureInbox" });
    await c.exec(weth, "mint(address,uint256)", [reach3, 5n * WAD]);
    await buyer.exec(reach3, EXEC, [weth, 0, enc("approve(address,uint256)", [postage, 5n * WAD]), 0], { label: "execute" });
    await buyer.exec(parley, STAMPED, [3, 1, 0, "0x" + "0".repeat(64), hexOf("paying to talk"), weth, 5n * WAD], { label: "whisperStamped" });
    await c.exec(parley, WHISPER, [1, 3, 0, "0x" + "0".repeat(64), hexOf("answered")], { label: "whisper" });
    const owedWeth = async () => decUint(await c.read(postage, "owed(address,address)", [sink1, weth]));
    const W = walletFor(c, me);
    const { page, ctx: vctx } = await bootToken(1, { wallet: W });
    await lane(page, "social");
    await page.until(() => rows(page, "#social-commons").length === 5 && LL(page, "#social-rooms .room").length === 1, 80);
    await page.until(() => !!earned(page) && earned(page)[1] !== "reading…", 40);
    const earnedAtBoot = earned(page), claimAtBoot = LL(page, "[data-act=claimSettled]").length, owedAtBoot = await owedWeth();
    /* a body over the room's limit is refused with the count, before any slab */
    page.type(L(page, "#social-composer textarea"), "x".repeat(1025));
    page.click(L(page, "[data-act=speak]")); await page.settle();
    t.ok(!slabOpen(page) && /1024 bytes at most; that is 1025/.test(tick(page)) && W.count("eth_estimateGas") === 0, "a body over 1024 bytes is refused with the count, before any slab", tick(page));
    /* found: the name and the door as typed; signed, the room is listed and named from its Founded log */
    page.type(L(page, "#social-found-name"), "a second room");
    page.click(L(page, "#social-rooms button.chip")); await page.settle();
    await press(page, L(page, "[data-act=found]"));
    const cdF = slabCd(page);
    t.ok(page.text("#cslab [data-function]") === "found(uint256,string,bool)" && word(cdF, 0) === 1n && word(cdF, 2) === 0n && /a second room/.test(page.text("#cslab")) && /by invitation/.test(page.text("#cslab")) && /^\d+ units$/.test(gasRow(page)),
      "founding raises a slab with the name and the door as typed — by invitation is the bool word 0 — and the estimate passes", `fn ${page.text("#cslab [data-function]")} by ${word(cdF, 0)} open ${word(cdF, 2)} gas "${gasRow(page)}"`);
    await sign(page, W, 1);
    await page.until(() => LL(page, "#social-rooms .room").length === 2 && /a second room/.test(page.text("#lane-social #social-rooms")), 80);
    const roomsText = () => page.text("#lane-social #social-rooms");
    t.ok(decUint(await c.read(parley, "groups()")) === 2n && /a second room/.test(roomsText()) && /by invitation/.test(roomsText()) && LL(page, "#social-rooms .room [data-act=invite]").length === 2 && LL(page, "#social-rooms .room [data-act=leave]").length === 2 && LL(page, "#social-rooms .room [data-act=speak]").length === 2,
      "signed, the room exists, is named from its Founded log with its door, and its steward gets invite, leave and a composer in it", roomsText().slice(0, 200));
    /* the steward invites #2 into the first room */
    const first = LL(page, "#social-rooms .room")[0];
    page.type(first.querySelector("input"), "2");
    await press(page, first.querySelector("[data-act=invite]"));
    const cdI = slabCd(page), roomKey = word(cdI, 0);
    t.ok(page.text("#cslab [data-function]") === "invite(uint256,uint256,uint256)" && word(cdI, 1) === 1n && word(cdI, 2) === 2n && /^\d+ units$/.test(gasRow(page)), "the steward's invite names the room, itself and the token", `by ${word(cdI, 1)} token ${word(cdI, 2)} gas "${gasRow(page)}"`);
    await sign(page, W, 2);
    t.ok(ctx.decBool(await c.read(parley, "invited(uint256,uint256)", [roomKey, 2])), "signed, #2 is invited and still has to join");
    /* following a home that has not spoken: the estimate says NoSuchRoom before the wallet; once it speaks, the same press passes */
    const home3 = decUint(await c.read(parley, "homeKey(uint256)", [3]));
    page.type(L(page, "#social-follow"), "3");
    await press(page, L(page, "#social-home [data-act=join]"));
    t.ok(page.text("#cslab [data-function]") === "join(uint256,uint256)" && word(slabCd(page), 0) === home3 && word(slabCd(page), 1) === 1n && gasRow(page) === "would revert: NoSuchRoom()" && page.$("#cslab [data-go]").disabled === true,
      "following a home that has not spoken is refused by the estimate — NoSuchRoom, before the wallet — and the home key the panel derived is Parley's", `key ${word(slabCd(page), 0)} vs ${home3} gas "${gasRow(page)}"`);
    page.click(page.$("#cslab [data-no]")); await page.settle();
    await buyer.exec(parley, SPEAK, [home3, 3, 0, 0, 0, hexOf("hello from 3")], { label: "speak" });
    await press(page, L(page, "#social-home [data-act=join]"));
    t.ok(/^\d+ units$/.test(gasRow(page)), "once the home has spoken, the same follow passes the estimate", gasRow(page));
    await sign(page, W, 3);
    await page.until(() => LL(page, "#social-rooms .room").length === 3 && /home of #3/.test(roomsText()), 80);
    const r3 = await c.read(roster, "membersOf(uint256,uint256)", [home3, 0]), off3 = Number(decUint(r3, 0)) / 32;
    t.ok(decUint(r3, off3) === 1n && decUint(r3, off3 + 1) === 1n && /home of #3/.test(roomsText()) && LL(page, "#social-rooms .room [data-act=leave]").length === 3,
      "signed, #1 follows #3's home: the Roster lists it as the one follower, and the rooms list names the home of #3 with a leave", `members ${decUint(r3, off3)} first ${decUint(r3, off3 + 1)}`);
    const homeRoom = LL(page, "#social-rooms .room").find((r) => /home of #3/.test(r.textContent));
    await press(page, homeRoom.querySelector("[data-act=leave]"));
    t.ok(page.text("#cslab [data-function]") === "leave(uint256,uint256)" && word(slabCd(page), 0) === home3 && word(slabCd(page), 1) === 1n && /^\d+ units$/.test(gasRow(page)), "leaving names the home and the token", gasRow(page));
    await sign(page, W, 4);
    await page.until(() => LL(page, "#social-rooms .room [data-act=join]").length === 1, 80);
    const r3b = await c.read(roster, "membersOf(uint256,uint256)", [home3, 0]);
    t.ok(decUint(r3b, Number(decUint(r3b, 0)) / 32) === 0n && LL(page, "#social-rooms .room").length === 3 && LL(page, "#social-rooms .room [data-act=leave]").length === 2 && LL(page, "#social-rooms .room [data-act=join]").length === 1,
      "signed, #1 has left; the room stays listed with join again, because roomsOf keeps every place worth asking about", `members ${decUint(r3b, Number(decUint(r3b, 0)) / 32)}`);
    /* the inbox form: a window outside 5 min..30 d is refused in words; a good one raises the slab with every word and lands */
    const inputs = LL(page, "#social-inbox input");
    page.type(inputs[1], "0.1"); page.type(inputs[2], "3");
    page.click(L(page, "[data-act=configureInbox]")); await page.settle(); await page.settle();
    t.ok(!slabOpen(page) && /5 to 43200 minutes/.test(tick(page)), "a reply window outside 5 minutes to 30 days is refused in words, no slab", tick(page));
    page.type(inputs[2], "1440");
    await press(page, L(page, "[data-act=configureInbox]"));
    const cdC = slabCd(page);
    t.ok(page.text("#cslab [data-function]") === "configureInbox(uint256,address,uint128,uint64,bool)" && word(cdC, 0) === 1n && lower(addrWord(cdC, 1)) === ZERO && word(cdC, 2) === WAD / 10n && word(cdC, 3) === 86400n && word(cdC, 4) === 1n && /0\.1 ETH per first contact/.test(page.text("#cslab")) && /^\d+ units$/.test(gasRow(page)),
      "the price list slab carries the token, ETH as the fee token, 0.1 ETH exactly, 1440 minutes in seconds and the open door — and the estimate passes", `words ${word(cdC, 2)} ${word(cdC, 3)} ${word(cdC, 4)} gas "${gasRow(page)}"`);
    await sign(page, W, 5);
    await page.until(() => /0\.1 ETH per first contact · 1440-minute window/.test(page.text("#lane-social #social-inbox")), 60);
    t.ok(/0\.1 ETH per first contact · 1440-minute window/.test(page.text("#lane-social #social-inbox")) && decUint(await c.read(postage, "inboxOf(uint256)", [1]), 1) === WAD / 10n, "signed, the inbox facts move to the new price", page.text("#lane-social #social-inbox").slice(0, 160));
    /* the ledger is per coin (found by review: moved to ETH, the row read "earned 0 ETH" over the 5 WETH still owed) */
    await page.until(() => !!earned(page), 40); await quiet(page, W);
    const earnedAfter = earned(page), owedAfter = await owedWeth();
    t.ok(owedAtBoot === 5n * WAD && !!earnedAtBoot && earnedAtBoot[0] === "earned in WETH" && earnedAtBoot[1] === "5 WETH" && claimAtBoot === 1 &&
      !!earnedAfter && earnedAfter[0] === "earned in ETH" && earnedAfter[1] === "0 ETH" && owedAfter === 5n * WAD,
      "the inbox's ledger is per coin and the row names the coin it read: earned in WETH, 5 WETH and its claim while the price list is in WETH; moved to ETH, earned in ETH, 0 ETH, while the 5 WETH stays owed — never a bare earned 0",
      `boot ${JSON.stringify(earnedAtBoot)} claim ${claimAtBoot} owed ${owedAtBoot}; after ${JSON.stringify(earnedAfter)} owed ${owedAfter}`);
    /* a refused eth_getLogs is a printed fact, never 0 */
    W.refuse("eth_getLogs", new Error("rate limited"));
    vctx.dispatchEvent(new vctx.CustomEvent("intact:lane", { detail: { name: "social" } }));
    await page.until(() => /eth_getLogs refused/.test(page.text("#lane-social #social-commons-status")), 60);
    const st = page.text("#lane-social #social-commons-status");
    t.ok(rows(page, "#social-commons").length === 0 && /eth_getLogs refused; the walk cannot start: rate limited/.test(st) && !/\b0 messages?\b/.test(st) && !/all 0/.test(st),
      "a refused eth_getLogs is a printed fact: no rows, the refusal in words with the endpoint's reason, never 0 messages", st);
    W.override("eth_getLogs", null);
    t.ok(page.innerHTMLWrites === 0 && page.errors.length === 0, "nothing was assigned through innerHTML on the review page, and no script threw", page.errors.map((e) => e.message).join("; "));
    page.close();
  }
  {
    /* the derived key is the wallet's (D7): wallet A derives on #2's page, #2 is sold to the buyer, who binds its
       key to #2 and connects in the same page (found by review: it was told that the key "this wallet derives" —
       A's — is not the one #2 bound, and was offered no derivation of its own) */
    await c.exec(parley, "bindKey(uint256)", [2], { label: "bindKey" });
    const W = walletFor(c, me);
    const { page } = await bootToken(2, { wallet: W });
    await lane(page, "social");
    const st = () => page.text("#lane-social #social-dm-status");
    page.type(L(page, "#social-dm-to"), "1");
    await page.until(() => !!L(page, "#social-dm-derive"), 40);
    page.click(L(page, "#social-dm-derive"));
    await page.until(() => /^sealed/.test(st()), 80);
    const armedA = st();
    await c.exec(hub, "transferFrom(address,address,uint256)", [ME, BUYER, 2], { label: "transferFrom" });
    await buyer.exec(parley, "bindKey(uint256)", [2], { label: "bindKey" });
    W.setAccounts([BUYER]);
    await page.until(() => page.$("body").dataset.rights === "1" && /derive yours|bind again/.test(st()), 60); await quiet(page, W);
    t.ok(/^sealed/.test(armedA) && lower(page.ctx.INTACT.ui.account()) === lower(BUYER) && page.$("body").dataset.rights === "1" && st() === "both keys are bound; derive yours to seal" && LL(page, "#social-dm-derive").length === 1 && W.prompts().filter((p) => p.method === "personal_sign").length === 1,
      "the derived key is the wallet's: a second wallet connecting in the same page is offered its own derivation, never told that the first wallet's key is not the one bound",
      `armed as A "${armedA}" account ${page.ctx.INTACT.ui.account()} rights ${page.$("body").dataset.rights} status "${st()}" derive ${LL(page, "#social-dm-derive").length}`);
    page.close();
  }
  {
    /* the viewer: a wallet with every right still gets the walk and the §1 sentence, and no control */
    const W = walletFor(c, me);
    const { page } = await bootToken(1, { opaque: true, wallet: W });
    await lane(page, "social");
    await page.until(() => rows(page, "#social-commons").length >= 5, 60);
    t.ok(page.$("body").dataset.mode === "viewer" && page.$("body").dataset.rights === "1" && rows(page, "#social-commons").length >= 5 && LL(page, "[data-act]").length === 0 && LL(page, "textarea").length === 0 && /nothing here can sign/.test(page.text("#lane-social #social-why")) && W.prompts().length === 0,
      "in the viewer a wallet with every right still gets the walk and the sentence that nothing here can sign, and no control (end of the social group)", `mode ${page.$("body").dataset.mode} rights ${page.$("body").dataset.rights} rows ${rows(page, "#social-commons").length} acts ${LL(page, "[data-act]").length} why "${page.text("#lane-social #social-why").slice(0, 80)}"`);
    page.close();
  }
}
