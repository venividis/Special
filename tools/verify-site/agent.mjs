/*───────────────────────────────────────────────────────────────────────────
  INTACT · verify-site group "agent" — the token for a program, and the
  key's own lane (U17; DESIGN §10, BUILD-PLAN §U17, docs/AGENT.md §1–§4,
  CONSOLE §11)

  Blocks: A the card on the chain, read directly — face 2 is the ERC-8004
  registration-v1 the AgentCard builds, JCS-canonical, hash-pinned by
  manifestHash(id), served again at /.well-known/* and /llms.txt ("face 2
  parses as registration-v1 with agentId == tokenId"); B the holder's lane
  — the stub sentence gone, the card's facts from hub.tokenURIAt(1, 2), the
  routes as paths, the grant log walked, the composer as a read; C the
  key's wallet in the console — propose before act, a disallowed call that
  never reaches the wallet, one executeAsSession with the epoch re-read, the
  swap and the word landed; D session mode — the key's envelope, the doors,
  the composer as a read, and the refusal ("the door refuses a wallet that is
  not the key"); E the Bankrbot class through the lane ("the Bankrbot
  transfer changes no bit and no session"); F the viewer; G the sale that
  ends the key; H a chain without the card (the runner's own). The four
  BUILD-PLAN sentences this file owns end their blocks as
  `t.ok(X, "<sentence>")`, verbatim, so INVARIANTS can quote them.

  Every block but H runs on a chain of this file's own, deployed with
  `deployAgentCard: true` (tools/site.mjs, U17's additive option): the
  runner's chain pins the codeless placeholder and is what H reads.

  Setup on that chain (every id literal below refers to it): #1 and #2 to
  `me`; #1's market WETH against ETH at 30 bps, 100 WETH / 10 ETH (the
  swap group's recipe); #1's Reach funded with 2 ETH; a 100-day session for
  `agentW` on the Pool's swapExactIn and Parley's speak with a 1 ETH native
  cap; a one-day session for `trader` on Parley's speak alone.

  Elements this group reads from its panel (CONSOLE §6.2; every selector
  scoped to #lane-agent): #agent-card-address, #agent-links, #agent-face2,
  #agent-agentid, #agent-wallet, #agent-trust, #agent-hash-baked,
  #agent-hash-live, #agent-services .svc, #agent-sessions .row,
  #agent-session-count, #agent-key-facts, #agent-refusal, #agent-composer
  (inputs name=key|row|target|value|data, #agent-args input[name=arg<i>]),
  #agent-row-info, #agent-verdict, #agent-calldata, #agent-propose,
  #agent-doors, #agent-allowed .row, [data-act=executeAsSession]. From the
  shell: the slab (#cbox.on, #cslab, [data-go], [data-no], [data-to],
  [data-function], [data-arg], [data-calldata], [data-gas]), #tick,
  #session, #lanes a[data-lane=agent], body[data-rights], body[data-mode].
───────────────────────────────────────────────────────────────────────────*/
const WAD = 10n ** 18n;
const GRANT = "grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)";
const SWAP_IN = "swapExactIn(uint256,bool,uint256,uint256,address,uint64)";
const SPEAK = "speak(uint256,uint256,uint8,uint64,uint64,bytes)";
const EAS = "executeAsSession(address,uint256,bytes)";
const OPEN = "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)", DEPOSIT = "deposit(uint256,uint256,uint256)";
const TYPE = "#registration-v1";
const lower = (s) => String(s).toLowerCase();
const word = (cd, i) => BigInt("0x" + cd.slice(10 + 64 * i, 10 + 64 * (i + 1)));
const addrWord = (cd, i) => "0x" + cd.slice(10 + 64 * i + 24, 10 + 64 * (i + 1));
/// RFC 8785: keys in code-unit order at every level, no whitespace, JSON.stringify's primitives
const canon = (v) => Array.isArray(v) ? "[" + v.map(canon).join(",") + "]"
  : v && typeof v === "object" ? "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}" : JSON.stringify(v);
const sorted = (o) => Object.keys(o).every((k, i, a) => i === 0 || a[i - 1] < k) && Object.values(o).every((v) => !v || typeof v !== "object" || Array.isArray(v) ? true : sorted(v));

export async function run(t, ctx0) {
  /* a chain of this group's own, with the card deployed at its pin */
  const ctx = await ctx0.fresh({ deployAgentCard: true });
  const { c, site, actors, weth, sel, enc, decUint, decAddr, decBool, decString, kec, ZERO, walletFor, bootToken, lane, mint, EVM, A, GET } = ctx;
  const { me, buyer, trader, stranger, agentW } = actors;
  const ME = me.from.toString(), AGENT = agentW.from.toString(), TRADER = trader.from.toString(), STRANGER = stranger.from.toString(), BUYER = buyer.from.toString();
  const hub = site.hub, pool = site.pool, parley = site.parley, card = site.agentCard, CHAIN = 1;
  const now = () => EVM.BLOCK.header.timestamp;
  const L = (page, s) => page.$("#lane-agent " + s);
  const LL = (page, s) => page.$$("#lane-agent " + s);
  const laneText = (page) => page.text("#lane-agent");
  const slabOpen = (page) => page.$("#cbox").classList.contains("on");
  const slabCd = (page) => page.text("#cslab [data-calldata]");
  const gasRow = (page) => page.text("#cslab [data-gas]");
  const fn = (page) => page.text("#cslab [data-function]");
  const tick = (page) => page.text("#tick");
  const line = (page, k) => { const r = page.$$("#cslab .kv").find((x) => x.firstChild && x.firstChild.textContent === k); return r ? r.lastChild.textContent : null; };
  const field = (page, name) => L(page, `#agent-composer input[name=${name}]`);
  const since = (W, mark) => W.calls.slice(mark);
  const isCall = (s4, to) => (x) => x.method === "eth_call" && lower(String(x.params[0].data)).startsWith(lower(sel(s4))) && (!to || lower(x.params[0].to) === lower(to));
  const verdict = (page) => page.text("#lane-agent #agent-verdict");
  const waitVerdict = (page) => page.until(() => /allowed|not allowed|not reported|would revert/.test(verdict(page)), 80);
  const press = async (page, el) => { page.click(el); await page.until(() => slabOpen(page) && gasRow(page) !== "estimating…", 120); if (!slabOpen(page)) throw new Error("no slab after the press; the ticker reads: " + tick(page)); };
  const ready = (page) => page.until(() => !page.$("#cslab [data-go]").disabled, 40);
  const sign = async (page, W, n) => {
    const before = tick(page);
    page.click(page.$("#cslab [data-go]"));
    await page.until(() => W.sent() === n && tick(page) !== before && /landed in block|reverted in block/.test(tick(page)), 160);
    for (let k = 0; k < 4; k++) await page.settle();
  };
  const dismiss = async (page) => { page.click(page.$("#cslab [data-no]")); await page.settle(); };
  const readReg = async (id) => decString(await c.read(card, "registration(uint256)", [id]));
  const readCard = async (id) => decString(await c.read(card, "card(uint256)", [id]));
  const mHash = async (id) => (await c.read(card, "manifestHash(uint256)", [id])).slice(0, 66);
  const allows = async (key, to, s4) => decBool(await c.read(reach1, "sessionAllows(address,address,bytes4)", [key, to, s4]));
  const rightsOf = async (who) => decUint(await c.read(hub, "rightsOf(uint256,address)", [1, who]), 0);
  const typeRow = async (page, row, args, o = {}) => {
    page.type(field(page, "row"), row);
    await page.until(() => LL(page, "#agent-args input").length === args.length, 40);
    args.forEach((v, i) => page.type(L(page, `#agent-args input[name=arg${i}]`), String(v)));
    if (o.value != null) page.type(field(page, "value"), o.value);
    if (o.key) page.type(field(page, "key"), o.key);
  };
  const hexOf = (s) => "0x" + Buffer.from(s, "utf8").toString("hex");

  /* the cast */
  await mint(c, site, ME); await mint(c, site, ME);
  const reach1 = decAddr(await c.read(hub, "account(uint256)", [1])), grip1 = decAddr(await c.read(hub, "grip(uint256)", [1]));
  await c.exec(weth, "mint(address,uint256)", [ME, 1000n * WAD]);
  await c.exec(weth, "approve(address,uint256)", [pool, 200n * WAD]);
  await c.exec(pool, OPEN, [1, weth, ZERO, 30, 0, 0, 0], { label: "openMarket" });
  await c.exec(pool, DEPOSIT, [1, 100n * WAD, 10n * WAD], { value: 10n * WAD, label: "deposit" });
  await c.send({ to: reach1, value: 2n * WAD });
  await c.exec(reach1, GRANT, [AGENT, now() + 100n * 86400n, WAD, [], [pool, parley], [sel(SWAP_IN), sel(SPEAK)], 0, 0], { label: "grantSession" });
  await c.exec(reach1, GRANT, [TRADER, now() + 86400n, 0n, [], [parley], [sel(SPEAK)], 0, 0], { label: "grantSession" });

  /*═══════════ A · the card on the chain ═══════════*/
  t.head("A · face 2 parses as registration-v1 with agentId == tokenId");
  let Aok = true;
  const a = (cond, name, d) => { t.ok(cond, name, d); Aok = Aok && !!cond; };
  {
    const reg = await readReg(1);
    let doc = null; try { doc = JSON.parse(reg); } catch {}
    const O = `web3://${lower(site.premises)}:${CHAIN}`;
    a(!!doc && String(doc.type).endsWith(TYPE) && doc.agentId === 1 && doc.registrations.length === 1 && doc.registrations[0].agentId === 1 && doc.registrations[0].agentRegistry === `eip155:${CHAIN}:${lower(hub)}`,
      "A1 registration(1) parses: type registration-v1, agentId 1, one registrations entry naming this hub as the registry", reg.slice(0, 200));
    a(!!doc && lower(doc.agentWallet) === lower(reach1) && doc.active === true && doc.custodyEpoch === 1 && doc.x402Support === false && JSON.stringify(doc.supportedTrust) === JSON.stringify(["custody-epoch", "erc-5646"]),
      "A2 agentWallet is account(1), active is the Active status, custodyEpoch 1, supportedTrust custody-epoch and erc-5646, x402Support false", doc && `${doc.agentWallet} ${doc.active} ${doc.custodyEpoch} ${doc.supportedTrust}`);
    const names = doc ? doc.services.map((s) => s.name) : [];
    a(!!doc && doc.services.every((s) => s.endpoint.startsWith(O + "/")) && names.includes("web") && names.includes("A2A") && names.includes("services") && names.includes("door") && names.includes("registration") &&
      doc.services.find((s) => s.name === "door").endpoint === O + "/k/1/{key}" && doc.services.find((s) => s.name === "web").endpoint === O + "/token/1/live" && doc.services.find((s) => s.name === "A2A").version === "1.0",
      "A3 services[] are the token's web3:// routes on this Premises and chain, the A2A card and the /k/1/{key} door as an RFC 6570 template", names.join(","));
    a(!!doc && canon(doc) === reg && sorted(doc) && !/[<>]/.test(reg), "A4 the bytes are RFC 8785 canonical: a recomputation from the parsed object equals them, keys in byte order at every level, no angle bracket", doc && `differs at ${[...reg].findIndex((ch, i) => canon(doc)[i] !== ch)}: ${reg.slice(0, 120)}`);
    a(doc && doc.catalogHash === (await c.read(site.catalog, "catalogHash()")).slice(0, 66), "A5 the registration names the catalogue it was built against: catalogHash equals Catalog.catalogHash()", doc && doc.catalogHash);
    a(await mHash(1) === kec(Buffer.from(reg, "utf8")), "A6 manifestHash(1) is the keccak of registration(1)'s bytes", await mHash(1));
    const uri = decString(await c.read(hub, "tokenURIAt(uint256,uint8)", [1, 2]));
    a(uri === "data:application/json;base64," + Buffer.from(reg, "utf8").toString("base64"), "A7 face 2 of tokenURI is exactly that document, base64 in a data: URI", uri.slice(0, 60));
    const f2 = await GET(["token", "1", "face", "2"]);
    a(f2.status === 200 && f2.body === uri, "A8 /token/1/face/2 serves the same URI", `${f2.status}`);
    const r0 = await GET([".well-known", "agent-registration.json"]);
    const reg0 = await readReg(0);
    let d0 = null; try { d0 = JSON.parse(r0.body); } catch {}
    a(r0.status === 200 && r0.header("Content-Type") === "application/json" && r0.body === reg0 && !!d0 && String(d0.type).endsWith(TYPE) && d0.registrations.length === 0 && d0.agentRegistry === `eip155:${CHAIN}:${lower(hub)}` && canon(d0) === reg0 &&
      d0.services.find((s) => s.name === "registration").endpoint === O + "/token/{id}/face/2" && d0.services.find((s) => s.name === "door").endpoint === O + "/k/{id}/{key}",
      "A9 /.well-known/agent-registration.json is the collection's document: registration(0), canonical, naming the registry and the per-token templates", r0.body.slice(0, 160));
    const cardR = await GET([".well-known", "agent-card.json"]);
    let cd = null; try { cd = JSON.parse(cardR.body); } catch {}
    const card1 = JSON.parse(await readCard(1));
    a(cardR.status === 200 && cardR.header("Content-Type") === "application/json" && !!cd && cd.protocolVersion === "1.0" && cd.name === "INTACT" && cd.url === O + "/" && cd.skills.map((s) => s.id).join(",") === "propose,act" && cd.capabilities.streaming === false &&
      card1.name === "INTACT #1" && card1.url === O + "/token/1/live" && card1.metadata.agentId === 1 && lower(card1.metadata.agentWallet) === lower(reach1) && sorted(cd) && sorted(card1),
      "A10 /.well-known/agent-card.json is the A2A card: protocolVersion 1.0, the two skills propose and act, the token's card naming its agentId and agentWallet, keys in order", cardR.body.slice(0, 160));
    const ll = await GET(["llms.txt"]), lm = await GET(["llms.md"]), lt = await GET(["token", "1", "llms.txt"]);
    a(ll.status === 200 && ll.header("Content-Type") === "text/plain; charset=utf-8" && ll.body.startsWith("# INTACT\n\n> ") && /## Routes/.test(ll.body) && /## Authority/.test(ll.body) && lm.body === ll.body &&
      lt.status === 200 && lt.body.startsWith("# INTACT #1\n\n> ") && lt.body.includes(`agentWallet ${lower(reach1)}`) && lt.body.includes("sessionAllows") && lt.body.includes(O + "/k/1/{key}") && !/https?:\/\//.test(lt.body),
      "A11 /llms.txt, /llms.md and /token/1/llms.txt answer as text: an H1, a blockquote, the routes and the authority rule; the token's names its Reach and its door and no https host", ll.body.slice(0, 120));
    a((await GET([".well-known", "nothing.json"])).status === 404 && (await GET(["llms.txt", "x"])).status === 404 && (await GET(["token", "4000", "llms.txt"])).status === 404,
      "A12 the agent routes still 404 for nonsense: an unknown well-known file, a second segment on llms.txt, an unminted token's llms");
    const st = await c.read(site.catalog, "stateOf(uint256)", [1]);
    a((decUint(st, 13) & 4096n) !== 0n && (decUint(st, 14) & 4096n) === 0n, "A13 Catalog.stateOf reports the card (bit 4096 set, not absent): its HUB() answered", `reported ${decUint(st, 13)} absent ${decUint(st, 14)}`);
    /* the hash moves with the facts an agent must re-read: a pause flips active */
    const h1 = await mHash(1);
    await c.exec(hub, "pause(uint256)", [1], { label: "pause" });
    const d2 = JSON.parse(await readReg(1)), h2 = await mHash(1);
    await c.exec(hub, "setStatus(uint256,uint8)", [1, 0], { label: "setStatus" });
    a(d2.active === false && h2 !== h1 && await mHash(1) === h1, "A14 a pause reads active: false and moves manifestHash; re-arming restores the document and its hash byte for byte", `${h1} → ${h2}`);
    const un = JSON.parse(await readReg(4000));
    a(un.active === false && un.agentId === 4000 && (await c.read(card, "manifestHash(uint256)", [4000])).length === 66, "A15 an unminted id is a document whose active is false, never a revert", JSON.stringify(un).slice(0, 100));
    /* the cost: every agent route under its budget, cold, and tokenURI still under its cap with the card probed twice */
    const cold = async () => c.send({ to: "0x" + "77".repeat(20), value: 1n });
    await cold(); await c.read(hub, "tokenURI(uint256)", [1]); const uriGas = c.lastGas;
    await cold(); const g1 = (await GET([".well-known", "agent-registration.json"])).gas;
    await cold(); const g2 = (await GET(["token", "1", "llms.txt"])).gas;
    await cold(); const g3 = (await GET(["token", "1", "face", "2"])).gas;
    await cold(); const g4 = (await GET(["token", "1", "live"])).gas;
    console.log(`      cold with the card: tokenURI ${(Number(uriGas) / 1e6).toFixed(2)}M · /.well-known/agent-registration.json ${(Number(g1) / 1e6).toFixed(2)}M · /token/1/llms.txt ${(Number(g2) / 1e6).toFixed(2)}M · /token/1/face/2 ${(Number(g3) / 1e6).toFixed(2)}M · /token/1/live ${(Number(g4) / 1e6).toFixed(2)}M`);
    a(uriGas <= ctx.CAPS.tokenURI && g4 <= ctx.CAPS.live && g1 <= 1_000_000n && g2 <= 1_000_000n && g3 <= ctx.CAPS.face,
      "A16 with the card deployed every route stays under its cap, cold: tokenURI ≤ 8 M, /live ≤ 2.5 M, the agent routes ≤ 1 M, face 2 ≤ 0.5 M", `${uriGas} ${g4} ${g1} ${g2} ${g3}`);
  }
  t.ok(Aok, "face 2 parses as registration-v1 with agentId == tokenId");

  /*═══════════ B · the holder's lane ═══════════*/
  t.head("B · the holder's lane: the card's facts, the keys, the composer as a read");
  {
    const W = walletFor(c, me);
    const { page, ctx: vctx, S } = await bootToken(1, { wallet: W });
    t.ok(!!page.$("#lanes a[data-lane=agent]") && (S.absent & S.bits.agentcard) === 0 && (S.reported & S.bits.agentcard) !== 0, "B1 with a card on the chain the shell offers the agent lane and the chip reads reported", `absent ${S.absent} reported ${S.reported}`);
    const loaded = await lane(page, "agent");
    await page.until(() => /parses as registration-v1/.test(page.text("#lane-agent #agent-face2")) && LL(page, "#agent-sessions .row").length === 2 && !/reading…/.test(page.text("#lane-agent #agent-session-count")), 80);
    t.ok(loaded && !L(page, "#agent-stub") && !/arrives with U17|no executeAsSession composer until U17/.test(laneText(page)) && !!L(page, "#agent-composer") && !!L(page, "#agent-propose"),
      "the stub sentence gone", laneText(page).slice(0, 160));
    t.ok(W.callsTo(hub, sel("tokenURIAt(uint256,uint8)")).length >= 1 && word(W.callsTo(hub, sel("tokenURIAt(uint256,uint8)"))[0].params[0].data, 1) === 2n && page.text("#lane-agent #agent-face2") === "parses as registration-v1 · agentId 1 == #1",
      "B2 face 2 is read from the chain, hub.tokenURIAt(1, 2), and parses as this token's registration-v1", page.text("#lane-agent #agent-face2"));
    t.ok(/^1 in eip155:1:0x/.test(page.text("#lane-agent #agent-agentid")) && / — the Reach$/.test(page.text("#lane-agent #agent-wallet")) && lower(page.text("#lane-agent #agent-wallet")).startsWith(lower(reach1)) && /custody-epoch, erc-5646 · x402Support false · active true · custody epoch 1/.test(page.text("#lane-agent #agent-trust")),
      "B3 the facts: agentId in the registry, agentWallet is the Reach, the trust list, x402Support false, active, the epoch", page.text("#lane-agent #agent-trust"));
    const reg = await readReg(1);
    t.ok(page.text("#lane-agent #agent-hash-baked") === kec(Buffer.from(reg, "utf8")) && page.text("#lane-agent #agent-hash-baked") === await mHash(1), "B4 the keccak of the bytes the lane was served equals manifestHash(1) on the chain", page.text("#lane-agent #agent-hash-baked"));
    t.ok(/^not reported: the catalogue serves no agentCard row$/.test(page.text("#lane-agent #agent-hash-live")) === !("agentCard.manifestHash" in S.sel) && (!("agentCard.manifestHash" in S.sel) || /equal to the bytes served/.test(page.text("#lane-agent #agent-hash-live"))),
      "B5 the live manifestHash is read through the catalogue's own row when it serves one, and is a sentence — never a zero — until it does", page.text("#lane-agent #agent-hash-live"));
    const svc = LL(page, "#agent-services .svc");
    t.ok(svc.length === 7 && svc.some((r) => r.firstChild.textContent === "door" && r.lastChild.textContent.endsWith("/k/1/{key}")) && svc.every((r) => r.lastChild.textContent.startsWith("web3://")), "B6 the seven services render, name → endpoint, the door among them", svc.map((r) => r.firstChild.textContent).join(","));
    const links = page.text("#lane-agent #agent-links");
    t.ok(/\/\.well-known\/agent-registration\.json/.test(links) && /\/\.well-known\/agent-card\.json/.test(links) && /\/llms\.txt/.test(links) && /\/token\/1\/llms\.txt/.test(links) && /\/token\/1\/face\/2/.test(links) && /\/k\/1\/<key>/.test(links) && !/https?:\/\/|web3:\/\//.test(links),
      "B7 the agent routes are printed as paths, never with a host", links.slice(0, 200));
    const logs = W.calls.filter((x) => x.method === "eth_getLogs"), flt = logs[0] && logs[0].params[0];
    const rows = LL(page, "#agent-sessions .row");
    t.ok(logs.length === 1 && !!flt && lower(flt.address) === lower(S.reach) && flt.topics[0] === S.topics.sessionGranted && rows.length === 2 && rows.every((r) => /live$/.test(r.textContent)) && rows.map((r) => lower(r.dataset.key)).sort().join() === [lower(AGENT), lower(TRADER)].sort().join() &&
      page.text("#lane-agent #agent-session-count") === "sessions: 2 live of 2 ever granted",
      "B8 the grant log is walked once over the Reach from block 0, the two keys listed live, each confirmed by rightsOf", `logs ${logs.length} rows ${rows.length} count "${page.text("#lane-agent #agent-session-count")}"`);
    t.ok(!L(page, "[data-act=executeAsSession]") && /act is the key's: connect the key's own wallet/.test(laneText(page)) && page.$("body").dataset.rights === "1", "B9 the holder sees no act: the write is the key's, and the lane says so", laneText(page).match(/act is the key's[^\n]{0,60}/));
    /* the composer as a read: the holder proposes for the key and learns what the grant says, without a prompt */
    await page.until(() => !!field(page, "row") && /the catalogue is still being read|^$/.test(page.text("#lane-agent #agent-row-info")), 40);
    t.ok(W.callsTo(site.catalog, sel("services()")).length >= 1, "B10 services.json is read from the Catalog, once, for the rows a session may be sent to", String(W.callsTo(site.catalog, sel("services()")).length));
    page.type(field(page, "key"), AGENT);
    await page.until(() => /allowlist/.test(page.text("#lane-agent #agent-key-facts")), 60);
    const kf = page.text("#lane-agent #agent-key-facts");
    t.ok(/^allowlist · expires \d{4}-/.test(kf) && /granted at epoch 1 \(the token is at epoch 1\)/.test(kf) && /native cap 1 ETH, spent 0/.test(kf) && /uses left not capped/.test(kf) && /stored active/.test(kf) && /worst-case exposure 1 ETH, 0 asset cap\(s\)/.test(kf) && /token Active/.test(kf) && /SESSION right yes: live/.test(kf),
      "B11 a typed key's envelope: sessionOf and sessionExposure in words, the grant epoch beside the token's, rightsOf's SESSION bit", kf);
    page.type(field(page, "row"), "pool.withdraw");
    await page.until(() => LL(page, "#agent-args input").length === 4, 40);
    t.ok(/withdraw\(uint256,uint256,uint256,address\) · write · via acts/.test(page.text("#lane-agent #agent-row-info")) && LL(page, "#agent-args input").map((i) => i.name).join() === "arg0,arg1,arg2,arg3",
      "B12 a row typed as word.name draws one input per argument from its signature in services.json", page.text("#lane-agent #agent-row-info"));
    ["1", "1", "1", ME].forEach((v, i) => page.type(L(page, `#agent-args input[name=arg${i}]`), v));
    const p12 = W.prompts().length, e12 = W.count("eth_estimateGas"), m12 = W.calls.length;
    page.click(L(page, "#agent-propose")); await waitVerdict(page);
    t.ok(/^not allowed by the grant: pool\.withdraw \(0x[0-9a-f]{8}\) on 0x/.test(verdict(page)) && / — nothing is sent$/.test(verdict(page)) && since(W, m12).some(isCall("sessionAllows(address,address,bytes4)", reach1)) && W.prompts().length === p12 && W.count("eth_estimateGas") === e12 && W.sent() === 0 &&
      lower(page.text("#lane-agent #agent-calldata")).startsWith(lower(sel(EAS))) && lower(addrWord(page.text("#lane-agent #agent-calldata"), 0)) === lower(pool),
      "B13 propose is a read: a row the grant does not list reads not allowed from sessionAllows, the calldata is shown, and nothing — no estimate, no prompt — reaches the wallet", verdict(page));
    const m13 = W.calls.length;
    page.click(L(page, "#agent-doors"));
    await page.until(() => /doors open for key/.test(page.text("#lane-agent #agent-allowed")), 120);
    const open = LL(page, "#agent-allowed .row").map((r) => r.dataset.row).sort();
    t.ok(open.join() === "parley.speak,pool.swapExactIn" && /^2 of \d+ doors open for key/.test(page.text("#lane-agent #agent-allowed p")) && since(W, m13).filter(isCall("sessionAllows(address,address,bytes4)", reach1)).length > 50,
      "B14 the doors: sessionAllows asked for every fixed-target write row names exactly the grant's two, targets × selectors", `${open} · ${page.text("#lane-agent #agent-allowed p")}`);
    page.click(LL(page, "#agent-allowed .row").find((r) => r.dataset.row === "parley.speak")); await page.settle();
    t.ok(field(page, "row").value === "parley.speak" && LL(page, "#agent-args input").length === 6, "B15 an open door fills the composer with its row", field(page, "row").value);
    W.refuse("eth_getLogs", new Error("range too large"));
    vctx.dispatchEvent(new vctx.CustomEvent("intact:lane", { detail: { name: "agent" } })); await page.settle(); await page.settle();
    await page.until(() => /could not be walked/.test(page.text("#lane-agent #agent-session-count")), 60);
    t.ok(/^sessions: not counted — the grant log could not be walked on this endpoint/.test(page.text("#lane-agent #agent-session-count")) && LL(page, "#agent-sessions .row").length === 0 && !/sessions: 0/.test(laneText(page)),
      "B16 an endpoint that refuses the walk is a sentence, never sessions: 0", page.text("#lane-agent #agent-session-count"));
    W.override("eth_getLogs", null);
    t.ok(page.innerHTMLWrites === 0 && page.errors.length === 0 && W.prompts().length === 0, "B17 nothing was assigned through innerHTML, no script threw, and the holder's page never prompted", page.errors.map((e) => e.message).join("; "));
    page.close();
  }

  /*═══════════ C · the key's wallet in the console: propose, then act ═══════════*/
  t.head("C · the key acts: sessionAllows before any send, one executeAsSession with the epoch re-read");
  {
    const W = walletFor(c, agentW);
    const { page, S } = await bootToken(1, { wallet: W });
    await lane(page, "agent");
    await page.until(() => !!L(page, "[data-act=executeAsSession]") && !!field(page, "row") && /SESSION right yes/.test(page.text("#lane-agent #agent-key-facts")), 80);
    t.ok(page.$("body").dataset.rights === "128" && !!L(page, "[data-act=executeAsSession]") && L(page, "[data-act=executeAsSession]").hasAttribute("data-spend") && lower(field(page, "key").value) === lower(W.address),
      "C1 the key's wallet reads SESSION and is offered the act, marked as spending, the key field its own address", `rights ${page.$("body").dataset.rights}`);
    /* a disallowed call: the act is refused before any estimate */
    await typeRow(page, "pool.withdraw", ["1", "1", "1", AGENT]);
    const e2 = W.count("eth_estimateGas"), p2 = W.prompts().length;
    page.click(L(page, "[data-act=executeAsSession]")); await waitVerdict(page); await page.settle(); await page.settle();
    t.ok(!slabOpen(page) && /not allowed by the grant/.test(verdict(page)) && /not allowed by the grant; nothing reaches the wallet/.test(tick(page)) && W.count("eth_estimateGas") === e2 && W.prompts().length === p2 && W.sent() === 0,
      "a disallowed call never reaches the wallet", `slab ${slabOpen(page)} tick "${tick(page)}" estimates +${W.count("eth_estimateGas") - e2}`);
    /* the swap: 0.1 ETH of the Reach's into WETH through the key's grant, deadline from the chain's clock */
    const deadline = now() + 600n;
    await typeRow(page, "pool.swapExactIn", ["1", "false", String(WAD / 10n), "0", reach1, String(deadline)], { value: "0.1" });
    const m3 = W.calls.length;
    page.click(L(page, "#agent-propose")); await waitVerdict(page);
    const iAllows = since(W, m3).findIndex(isCall("sessionAllows(address,address,bytes4)", reach1)), iSim = since(W, m3).findIndex((x) => x.method === "eth_call" && lower(x.params[0].to) === lower(reach1) && lower(String(x.params[0].data)).startsWith(lower(sel(EAS))));
    t.ok(/^allowed by the grant · simulates: executeAsSession would land$/.test(verdict(page)) && iAllows >= 0 && iSim > iAllows && lower(since(W, m3)[iSim].params[0].from) === lower(AGENT) && W.count("eth_estimateGas") === e2 && W.sent() === 0,
      "C2 propose reads sessionAllows first, then simulates the very executeAsSession from the key, and sends nothing", verdict(page));
    const m4 = W.calls.length;
    await press(page, L(page, "[data-act=executeAsSession]"));
    const cd = slabCd(page), inner = cd.slice(10 + 64 * 4, 10 + 64 * 4 + 8 + 64 * 6);
    t.ok(fn(page) === EAS && lower(page.text("#cslab [data-to]")) === lower(reach1) && lower(addrWord(cd, 0)) === lower(pool) && word(cd, 1) === WAD / 10n && inner.slice(0, 8) === sel(SWAP_IN).slice(2) && word("0x" + inner.slice(0, 8) + inner.slice(8), 5) === deadline &&
      !page.$("#cslab [data-value]") && page.text('#cslab [data-arg="1"]') === String(WAD / 10n) && /ETH from the Reach, charged to the native cap/.test(line(page, "Value") || "") && (line(page, "Calls") || "").startsWith("pool.swapExactIn on ") && /^\d+ units$/.test(gasRow(page)) &&
      since(W, m4).filter(isCall("sessionAllows(address,address,bytes4)", reach1)).length >= 1 && W.count("eth_estimateGas") === e2 + 1 && W.sent() === 0,
      "C3 the slab is one executeAsSession(address,uint256,bytes) to the Reach: the Pool, the Reach's 0.1 ETH as the value word (the wallet sends none), the swap as the inner bytes with the chain's deadline; sessionAllows was read again; one estimate; nothing sent", `fn ${fn(page)} to ${page.text("#cslab [data-to]")} gas "${gasRow(page)}"`);
    await ready(page);
    const wethBefore = decUint(await c.read(weth, "balanceOf(address)", [reach1]));
    const mark = W.calls.length;
    await sign(page, W, 1);
    const seq = since(W, mark), iEpoch = seq.findIndex(isCall("custodyEpoch(uint256)", hub)), iRecheck = seq.findIndex(isCall("sessionAllows(address,address,bytes4)", reach1)), iSend = seq.findIndex((x) => x.method === "eth_sendTransaction");
    const sessionActed = c.getLogs({ address: reach1, topics: [kec(Buffer.from("SessionActed(address,address,uint256,bytes4)"))] });
    const wethAfter = decUint(await c.read(weth, "balanceOf(address)", [reach1]));
    t.ok(iEpoch >= 0 && iRecheck > iEpoch && iSend > iRecheck && W.sent() === 1 && [...W.receipts.values()][0].status === "0x1" && wethAfter > wethBefore && sessionActed.length === 1 && lower("0x" + sessionActed[0].topics[1].slice(26)) === lower(AGENT) &&
      lower(seq[iSend].params[0].from) === lower(AGENT) && lower(seq[iSend].params[0].to) === lower(reach1) && !seq[iSend].params[0].value,
      "an allowed one builds exactly one executeAsSession with the epoch re-read", `epoch@${iEpoch} recheck@${iRecheck} send@${iSend} sent ${W.sent()} weth ${wethBefore} → ${wethAfter} acted ${sessionActed.length}`);
    const sess = await c.read(reach1, "sessionOf(address)", [AGENT]);
    t.ok(decUint(sess, 4) === WAD / 10n && await allows(AGENT, pool, sel(SWAP_IN)) === true, "C4 the native cap was charged 0.1 ETH and the key still stands", `spent ${decUint(sess, 4)}`);
    /* the word: parley.speak through the same key, a body typed as text and laid as bytes */
    await page.until(() => !!field(page, "row") && !slabOpen(page), 40);
    await typeRow(page, "parley.speak", ["0", "1", "0", "0", "0", "hello from a key"], { value: "0" });
    page.click(L(page, "#agent-propose")); await waitVerdict(page);
    t.ok(/^allowed by the grant · simulates/.test(verdict(page)) && page.text("#lane-agent #agent-calldata").includes(hexOf("hello from a key").slice(2)), "C5 speak proposes allowed, the body laid as the bytes of the typed text", verdict(page));
    await press(page, L(page, "[data-act=executeAsSession]"));
    await ready(page);
    await sign(page, W, 2);
    const said = c.getLogs({ address: parley, topics: [S.topics.said] });
    t.ok(W.sent() === 2 && said.length === 1 && [...W.receipts.values()][1].status === "0x1", "C6 Sign → the word landed in the commons through executeAsSession: one Said log from the Reach's call", `sent ${W.sent()} said ${said.length}`);
    /* the recheck at the press: the holder revokes between the estimate and Sign; the slab closes and sends nothing */
    await page.until(() => !!field(page, "row") && !slabOpen(page), 40);
    await typeRow(page, "pool.swapExactIn", ["1", "false", String(WAD / 100n), "0", reach1, String(now() + 600n)], { value: "0.01" });
    await press(page, L(page, "[data-act=executeAsSession]"));
    await ready(page);
    await c.exec(reach1, "revokeSession(address)", [AGENT], { label: "revokeSession" });
    page.click(page.$("#cslab [data-go]"));
    await page.until(() => !slabOpen(page), 60); await page.settle();
    t.ok(!slabOpen(page) && W.sent() === 2 && /the grant no longer allows this call — nothing sent/.test(tick(page)), "C7 a grant revoked between the estimate and the press is caught by the recheck: the slab closes, nothing is sent", `sent ${W.sent()} tick "${tick(page)}"`);
    await c.exec(reach1, GRANT, [AGENT, now() + 100n * 86400n, WAD, [], [pool, parley], [sel(SWAP_IN), sel(SPEAK)], 0, 0], { label: "grantSession" });
    t.ok(page.innerHTMLWrites === 0 && page.errors.length === 0, "C8 nothing was assigned through innerHTML and no script threw on the key's page", page.errors.map((e) => e.message).join("; "));
    page.close();
  }

  /*═══════════ D · session mode: the door ═══════════*/
  t.head("D · the door: ?as=<key>, the envelope, the doors, and the refusal");
  let Dok = true;
  const d = (cond, name, x) => { t.ok(cond, name, x); Dok = Dok && !!cond; };
  {
    const door = await GET(["k", "1", AGENT]);
    d(door.status === 301 && door.header("Location") === `/token/1/live?as=${lower(AGENT)}`, "D1 /k/1/<key> is a 301 into /token/1/live?as=<key>, the key written one way", door.header("Location"));
    /* no wallet: the key's facts and the doors, every control a read */
    const W0 = walletFor(c, me, { accounts: [] });
    const { page, S } = await bootToken(1, { query: "?as=" + AGENT, wallet: W0 });
    d(page.$("body").dataset.mode === "session" && /acts as key 0x/.test(page.text("#session")), "D2 the page boots in session mode and Home names the key", page.$("body").dataset.mode);
    await lane(page, "agent");
    await page.until(() => /SESSION right/.test(page.text("#lane-agent #agent-key-facts")), 80);
    const kf = page.text("#lane-agent #agent-key-facts");
    d(/^allowlist · expires/.test(kf) && /granted at epoch 1 \(the token is at epoch 1\)/.test(kf) && /native cap 1 ETH, spent 0/.test(kf) && /token Active/.test(kf) && /SESSION right yes: live/.test(kf) && !field(page, "key"),
      "D3 the lane prints the key's envelope with no key field: the grant, the exposure, the epoch beside the token's, the status, the SESSION right", kf);
    d(/this page reads only: the act is offered in the console/.test(laneText(page)) && LL(page, "[data-act]").length === 0 && page.$$("[data-go]").length === 0 && !/no executeAsSession composer until U17/.test(laneText(page)),
      "D4 the lane offers no write in session mode and says where the act is", laneText(page).match(/this page reads only[^\n]{0,80}/));
    page.click(L(page, "#agent-doors"));
    await page.until(() => /doors open for key/.test(page.text("#lane-agent #agent-allowed")), 120);
    d(LL(page, "#agent-allowed .row").map((r) => r.dataset.row).sort().join() === "parley.speak,pool.swapExactIn" && /^2 of \d+ doors open/.test(page.text("#lane-agent #agent-allowed p")),
      "D5 the doors the grant opens are exactly its two rows, read from sessionAllows", page.text("#lane-agent #agent-allowed p"));
    await typeRow(page, "pool.swapExactIn", ["1", "false", String(WAD / 1000n), "0", reach1, String(now() + 600n)], { value: "0.001" });
    page.click(L(page, "#agent-propose")); await waitVerdict(page);
    d(/^allowed by the grant · simulates/.test(verdict(page)) && W0.prompts().length === 0 && W0.sent() === 0 && W0.count("eth_estimateGas") === 0, "D6 propose works as a read for the key with no wallet connected: no prompt, no estimate, nothing sent", verdict(page));
    d(page.innerHTMLWrites === 0 && page.errors.length === 0, "D7 no innerHTML, no script threw on the door", page.errors.map((e) => e.message).join("; "));
    page.close();
    /* the holder's wallet at the key's door: refused, in Home and in the lane */
    const { page: p2 } = await bootToken(1, { query: "?as=" + AGENT, wallet: walletFor(c, me) });
    await lane(p2, "agent");
    const ref = p2.text("#lane-agent #agent-refusal");
    d(/connected wallet is 0x/.test(p2.text("#session")) && p2.$("body").dataset.rights === "" && new RegExp("^this page acts as key " + AGENT + "; the connected wallet is " + ME + " — connect the key's wallet$", "i").test(ref) && LL(p2, "[data-act]").length === 0,
      "D8 a wallet that is not the key is refused by Home and by the lane, with the sentence naming both, and nothing is offered", ref);
    p2.close();
    /* the key's own wallet at its door: accepted, still read-only by the shell's rule */
    const W3 = walletFor(c, agentW);
    const { page: p3 } = await bootToken(1, { query: "?as=" + AGENT, wallet: W3 });
    await lane(p3, "agent");
    await p3.until(() => /SESSION right yes/.test(p3.text("#lane-agent #agent-key-facts")), 80);
    d(!L(p3, "#agent-refusal") && p3.$("body").dataset.rights === "128" && LL(p3, "[data-act]").length === 0 && W3.prompts().length === 0, "D9 the key's wallet is accepted — SESSION read, no refusal — and still offered no write by the shell in session mode", `rights ${p3.$("body").dataset.rights} acts ${LL(p3, "[data-act]").length}`);
    p3.close();
  }
  t.ok(Dok, "the door refuses a wallet that is not the key");

  /*═══════════ E · the Bankrbot class, through the lane ═══════════*/
  t.head("E · receiving a token grants nothing");
  let Eok = true;
  const e = (cond, name, x) => { t.ok(cond, name, x); Eok = Eok && !!cond; };
  {
    const bitsBefore = await rightsOf(STRANGER);
    const nft = await c.deploy(A("test/mocks/MockERC721.sol", "MockERC721").bytecode, "", "MockERC721");
    await stranger.exec(nft, "mint(address,uint256)", [STRANGER, 1n]);
    await stranger.exec(nft, "transferFrom(address,address,uint256)", [STRANGER, reach1, 1n]);
    await stranger.send({ to: grip1, value: WAD });
    let refused = null;
    try { await c.exec(hub, "transferFrom(address,address,uint256)", [ME, reach1, 2], { label: "transferFrom" }); } catch (x) { refused = String(x.message); }
    e(bitsBefore === 0n && await rightsOf(STRANGER) === 0n && lower(decAddr(await c.read(nft, "ownerOf(uint256)", [1n]))) === lower(reach1) && await c.balanceOf(grip1) === WAD && refused !== null && refused.includes(sel("CanonicalAccount(address)").slice(2)),
      "E1 a stranger's NFT sits in the Reach and its ether in the Grip; rightsOf(1, stranger) is 0 before and after; an Intact sent to the Reach is refused CanonicalAccount", `bits ${bitsBefore} → ${await rightsOf(STRANGER)} refused ${refused && refused.slice(0, 60)}`);
    const W = walletFor(c, stranger);
    const { page } = await bootToken(1, { wallet: W });
    await lane(page, "agent");
    await page.until(() => LL(page, "#agent-sessions .row").length === 2 && !/reading…/.test(page.text("#lane-agent #agent-session-count")) && !!field(page, "row"), 80);
    e(page.$("body").dataset.rights === "0" && !L(page, "[data-act]") && LL(page, "#agent-sessions .row").map((r) => lower(r.dataset.key)).sort().join() === [lower(AGENT), lower(TRADER)].sort().join() && !LL(page, "#agent-sessions .row").some((r) => lower(r.dataset.key) === lower(STRANGER)),
      "E2 the stranger's page reads rights 0 and no act; the grant log names the two keys as before and never the stranger", `rights ${page.$("body").dataset.rights}`);
    await page.until(() => /SESSION right no/.test(page.text("#lane-agent #agent-key-facts")), 60);
    e(/revoked or never granted/.test(page.text("#lane-agent #agent-key-facts")) && /SESSION right no: not a current key/.test(page.text("#lane-agent #agent-key-facts")), "E3 the stranger's own envelope reads never granted, SESSION no", page.text("#lane-agent #agent-key-facts"));
    await typeRow(page, "pool.swapExactIn", ["1", "false", "1000", "0", STRANGER, String(now() + 600n)]);
    page.click(L(page, "#agent-propose")); await waitVerdict(page);
    e(/^not allowed by the grant/.test(verdict(page)) && W.prompts().length === 0 && W.sent() === 0 && await allows(AGENT, pool, sel(SWAP_IN)) === true && await allows(STRANGER, pool, sel(SWAP_IN)) === false,
      "E4 the stranger proposes and is refused by the grant; the real key's grant is untouched", verdict(page));
    page.close();
  }
  t.ok(Eok, "the Bankrbot transfer changes no bit and no session");

  /*═══════════ F · the viewer ═══════════*/
  t.head("F · the viewer");
  {
    const W = walletFor(c, agentW);
    const { page } = await bootToken(1, { opaque: true, wallet: W });
    await lane(page, "agent");
    await page.until(() => /parses as registration-v1/.test(page.text("#lane-agent #agent-face2")) && /SESSION right/.test(page.text("#lane-agent #agent-key-facts")), 80);
    /* W13: "reads the card and the key's envelope" was the wait's alone; the sentence now checks it too */
    t.ok(page.$("body").dataset.mode === "viewer" && /parses as registration-v1/.test(page.text("#lane-agent #agent-face2")) && /SESSION right/.test(page.text("#lane-agent #agent-key-facts")) &&
      LL(page, "[data-act]").length === 0 && page.$$("[data-go]").length === 0 && (laneText(page).match(/nothing here can sign/g) || []).length === 1 && W.prompts().length === 0 && page.fetches.length === 0,
      "F1 the viewer reads the card and the key's envelope, offers no control, prompts for nothing and fetches nothing — the one sentence", `acts ${LL(page, "[data-act]").length} prompts ${W.prompts().length}`);
    await typeRow(page, "pool.swapExactIn", ["1", "false", String(WAD / 1000n), "0", reach1, String(now() + 600n)], { value: "0.001" });
    page.click(L(page, "#agent-propose")); await waitVerdict(page);
    t.ok(/^allowed by the grant · simulates/.test(verdict(page)) && W.prompts().length === 0 && W.count("eth_estimateGas") === 0, "F2 propose stays a read in the viewer: no prompt in the viewer", verdict(page));
    t.ok(page.innerHTMLWrites === 0 && page.errors.length === 0, "F3 chain strings reached the viewer's DOM through textContent only, and no script threw", page.errors.map((x) => x.message).join("; "));
    page.close();
  }

  /*═══════════ G · the sale ends the key ═══════════*/
  t.head("G · a sale ends every key, and the lane says so");
  {
    await c.exec(hub, "transferFrom(address,address,uint256)", [ME, BUYER, 1], { label: "transferFrom" });
    const W = walletFor(c, agentW);
    const { page } = await bootToken(1, { wallet: W });
    await lane(page, "agent");
    await page.until(() => /SESSION right/.test(page.text("#lane-agent #agent-key-facts")) && /active false/.test(page.text("#lane-agent #agent-trust")), 80);
    const kf = page.text("#lane-agent #agent-key-facts");
    t.ok(page.$("body").dataset.rights === "0" && !L(page, "[data-act=executeAsSession]") && /granted at epoch 1 \(the token is at epoch 2\)/.test(kf) && /token Paused: no key acts/.test(kf) && /SESSION right no/.test(kf) && /active false · custody epoch 2/.test(page.text("#lane-agent #agent-trust")),
      "G1 after the sale the key reads rights 0, no act, an envelope granted at epoch 1 while the token is at 2 and Paused, and face 2 says active false at epoch 2", kf);
    await page.until(() => !!field(page, "row"), 40);
    await typeRow(page, "parley.speak", ["0", "1", "0", "0", "0", "x"]);
    page.click(L(page, "#agent-propose")); await waitVerdict(page);
    t.ok(/^not allowed by the grant/.test(verdict(page)) && W.sent() === 0, "G2 the sold token's key proposes and is refused: SoldOn, read as a view, never a send", verdict(page));
    page.close();
  }

  /*═══════════ H · a chain without the card ═══════════*/
  t.head("H · the runner's chain: no AgentCard, the lane still reads and composes");
  {
    const { c: c0, site: s0, actors: a0 } = ctx0;
    await ctx0.mint(c0, s0, a0.me.from.toString());
    const W = ctx0.walletFor(c0, a0.me);
    const { page, S } = await ctx0.bootToken(1, { wallet: W });
    t.ok(!page.$("#lanes a[data-lane=agent]") && (S.absent & S.bits.agentcard) !== 0, "H1 without a card the shell withholds the agent link and the chip reads not deployed", `absent ${S.absent}`);
    await ctx0.lane(page, "agent");
    await page.until(() => !!L(page, "#agent-composer") && !/reading…/.test(page.text("#lane-agent #agent-session-count")), 60);
    t.ok(/not deployed on this chain$/.test(page.text("#lane-agent #agent-card-address")) && !L(page, "#agent-face2") && /no AgentCard on this chain: face 2 is the crest/.test(laneText(page)) && !!L(page, "#agent-propose") && page.text("#lane-agent #agent-session-count") === "sessions: 0 live of 0 ever granted",
      "H2 the lane says the card is not deployed — not 0, not a blank — and still offers the composer and the walk", page.text("#lane-agent #agent-card-address"));
    t.ok(page.innerHTMLWrites === 0 && page.errors.length === 0, "H3 no innerHTML and no script threw without the card", page.errors.map((x) => x.message).join("; "));
    page.close();
  }
}
