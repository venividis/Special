/*───────────────────────────────────────────────────────────────────────────
  INTACT · verify-site group "vault" — the token's two hands and everything
  delegated from them (H §7.5 planned 39 sentences: K 24, L 11, F10 2, T 2;
  the blocks below run more)

  Blocks, on the runner's fresh chain: K the Reach, the Grip, the sessions,
  the Steward and the sale ("the vault lists open approvals and revokes in
  one press" — K1–K24, with F10/F10b and T1/T2 inside the same holder page
  where the plan put them: the ledger, the approve laid through execute,
  the composer and the batch, a guarded asset that stops answering, the
  seal, the Grip, the sessions, the Steward and the checklist), L panic
  ("panic lists what it revokes" — L1–L11), F10 the Reach's half of the
  exact-approval sentence (owned by swap.mjs; its ok string is not that
  sentence verbatim), T the transfer slab. The two BUILD-PLAN sentences
  this file owns end their blocks as `t.ok(K, "the vault lists open
  approvals and revokes in one press")` and `t.ok(L, "panic lists what it
  revokes")`, verbatim.

  Origin: IPSEITY tools/verify-site.mjs (branch claude/claude-md-docs-8vvyc8),
  its "driving the vault" block (the ledger read live and revoked in one
  press, the seal that only lengthens, the Grip that warns first), as C §5
  grouped them under K, plus what INTACT's contract requires on top: the
  grant-log walk (D2) as the only session list, the sell-time checklist
  before any transferFrom (CONSOLE §7), the recipient classified through
  eth_getCode and isCanonicalAccount before the chain is asked to
  estimate, panic's two presses, the guardian's different list and the
  hold only the holder releases.

  Deviations from H §7.5, each forced by the chain's clock or by D20:
  K19's "summonable" needs thirty days to pass, and a warp is chain-wide,
  so it is the LAST thing block K does, after the checklist (K23 wants
  "steward plan: speaking") and after the walk (K16 wants the one-day key
  K12 granted still live); the session the setup grants `agentW` runs 100
  days so it outlives that warp, and the renter is the user for 100 days
  for the same reason (the plan said +10 d). K12's one-day key is revoked
  in K18 before the warp, so block L grants `trader` a second key from the
  chain to keep "sessions: 2" an honest number. K19's "nothing arranged"
  is read before the plan is arranged — from the page, in K20, rather than
  from the chain, so K20's heir hash and K19's "speaking" are one flow.
  L7's `[data-fact=seal]` is the baked seal: the shell refreshes status,
  epoch and the hold from coreOf after a receipt (CONSOLE §4.7) but not
  the Reach's seal, so that fact is read on a fresh boot after the panic;
  The regexes are this file's own where the plan's wording differed
  between K23 and L2 ("key bound: yes" and "inbox price: 0.1 ETH" are one
  spelling in the panel, read by both blocks); K21 lets the renter see the
  summons and the attestation, which are anyone's once the plan admits
  them (BLUEPRINT §5.4), and asserts the absence of every control that is
  the holder's. L10 boots the renter and the stranger after the panic, so
  both read rights 0 (the user and the operator approval are what it
  revoked) and the button is absent for that reason as well as the plan's.

  Lines dropped from H §7.5: one half-line — L7's "the Identity rule
  visible", because no identity panel is on this branch to draw it; the
  rest of L7 (the epoch and status facts, the seal fact, the re-walk) is
  asserted. The panel cut, for the byte ceiling and named in its header:
  guard/unguard, grantRecipe, stillHereUnderDuress, getWill/getObit prose,
  the Grip's per-asset balances, marketHash and the sealed-market streams
  as reads, the grant's minInterval/uses fields, the pinned-face line;
  none of those carried a planned line (K12's decoded tuple still checks
  the two zero words).

  Setup this group performs on its chain (every id literal below refers
  to it): #1 to `me`; 10 WETH to #1's Reach and reach.execute(weth, 0,
  approve(pool, 10 WETH), 0) so the ledger holds one entry; a 100-day
  session for `agentW` on the Pool's swapExactIn; `me`'s X25519 key bound
  to #1 (_bindKey); the inbox priced at 0.1 ETH; `guardianW` the guardian;
  `stranger` an operator for all, `trader` the single approvee, `renter`
  the user for 100 days; the guardian's approveFirstLaunch(1). The plan is
  arranged from the page (K20); #2 is minted for T1's forwarder and #3 for
  L4's fresh token; a Breakable is guarded by the Reach and broken (K5).

  Elements this group reads from its panel (CONSOLE §6.2; every selector
  scoped to #lane-vault): #vault-holdings .row, #vault-manifest,
  #vault-seal-note, #vault-seal-until, #vault-execute (inputs name=to|value|
  data|spender|amount), #vault-batch .row, #vault-batch-add,
  #vault-approvals .row .allowance[data-raw], #vault-revoke-all,
  #vault-grip, #vault-grip-warning, #vault-grip-address, #vault-grip svg,
  #vault-sessions .row, #vault-session-key, #vault-session-info,
  #vault-session-walk, #vault-session-count, #vault-sessions [data-sel]
  (inputs name=k|d|n|t|a|c), #vault-steward-status (inputs name=h|s|q|o|g|th,
  sh|ss, ad|an), #vault-sell input[name=to], #vault-checklist .revoked /
  .survives, #vault-locked, #vault-panic, #vault-panic-list,
  [data-act=execute|executeBatch|seal|revokeOpenApprovals|grantSession|
  revokeSession|arrange|stillHere|summon|transfer|panic|release] — every
  one pressed; [data-act=sealMax|revokeAllSessions|attest|cancel|
  stewardExecute] drawn and probed. From the shell: the slab (#cbox.on,
  #cslab, [data-go], [data-no], [data-to], [data-function], [data-arg],
  [data-calldata], [data-gas]), #tick, #facts [data-fact=epoch|status|
  locked|seal], body[data-rights].

  V2 (W10): the Keepsakes section. V0 runs on this group's own chain, where
  the Keepsake is the codeless placeholder: the section is the not-deployed
  chip and nothing reads that address. V1–V6 run on a second chain from
  ctx.fresh({ v2: true }) (deploySite with the V2 satellites), the cast
  set up in `keepsakes()` below: a bundle of ETH and two coins made from the
  page with exact approvals; a gift to `buyer`, with a slow sale refused on
  it in words; the keepsakes found from the Transfer logs (the wallet's and
  the Reach's), drawn, and a refused range said as a sentence; a warp, after
  which claimable grows and claims pay the holder (the holder's own and a
  stranger's, for the Reach's keepsake); a shortening extend refused and an
  extend that lengthens, directly and through the Reach's execute; a slow
  sale typed in human terms, found raw in the calldata and read back; a
  memory into the keepsake's own journal; a give; the recipient's page and
  the viewer's. Elements read: #vault-keepsakes (.chip), #vault-keepsakes-
  status, #vault-keepsakes-list .keepsake[data-id] (img, .kv, progress,
  .free, .claimable, .drip, .note, details input[name=more|dsell|dmkt|
  dfloor|dmax|give|memory]), #vault-make (input[name=eth|token|amount|lock|
  over|to|note|dsell|dfloor|dmax], .coin p.s), #vault-make-add,
  #vault-keepsake-made, [data-act=wrap|claim|extend|setDrip|clearDrip|give|
  inscribe]; from the shell the slab's [data-sentence], [data-value] and
  lines.
───────────────────────────────────────────────────────────────────────────*/
const WAD = 10n ** 18n;
const EXEC = "execute(address,uint256,bytes,uint8)", BATCH = "executeBatch((address,uint256,bytes)[])";
const GRANT = "grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)";
const SWAP_IN = "swapExactIn(uint256,bool,uint256,uint256,address,uint64)", WITHDRAW = "withdraw(uint256,uint256,uint256,address)";
const APPROVE = "approve(address,uint256)", ARRANGE = "arrange(uint256,bytes32,uint64,uint64,address[],uint8)";
const lower = (s) => String(s).toLowerCase();
/// word i of a calldata hex, after the four-byte selector
const word = (cd, i) => BigInt("0x" + cd.slice(10 + 64 * i, 10 + 64 * (i + 1)));
const addrWord = (cd, i) => "0x" + cd.slice(10 + 64 * i + 24, 10 + 64 * (i + 1));
const short = (a) => a.slice(0, 6) + " … " + a.slice(-4);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const checksum = (a, kec) => { const h = kec(Buffer.from(a.slice(2).toLowerCase(), "utf8")).slice(2); let o = "0x"; for (let i = 0; i < 40; i++) o += parseInt(h[i], 16) >= 8 ? a[i + 2].toUpperCase() : a[i + 2].toLowerCase(); return o; };
/// the panel's date, and the timestamp its seal input parses back from it (minutes, UTC)
const dateOf = (t) => new Date(Number(t) * 1e3).toISOString().replace("T", " ").slice(0, 16) + " UTC";
const tsOf = (ds) => BigInt(Date.parse(ds.slice(0, 10) + "T" + ds.slice(11, 16) + "Z") / 1000);
/// grantSession's head and tails, read back from the bytes the slab will sign
const decodeGrant = (cd) => {
  const at = (i) => Number(word(cd, i)) / 32, list = (o, f) => [...Array(Number(word(cd, o)))].map((_, i) => f(o + 1 + i));
  return { key: addrWord(cd, 0), expires: word(cd, 1), cap: word(cd, 2), caps: list(at(3), (i) => i), targets: list(at(4), (i) => addrWord(cd, i)), selectors: list(at(5), (i) => "0x" + cd.slice(10 + 64 * i, 10 + 64 * i + 8)) };
};

export async function run(t, ctx) {
  const { c, site, actors, weth, sel, enc, decUint, decAddr, decBool, kec, ZERO, walletFor, bootToken, lane, mint, EVM, A } = ctx;
  const { me, renter, buyer, trader, stranger, guardianW, agentW } = actors;
  const ME = me.from.toString(), BUYER = buyer.from.toString(), AGENT = agentW.from.toString(), STRANGER = stranger.from.toString();
  const RENTER_S = short(checksum(renter.from.toString(), kec)), GUARD_S = short(checksum(guardianW.from.toString(), kec));
  const hub = site.hub, pool = site.pool, steward = site.steward, parley = site.parley, postage = site.postage, pad = site.launchpad;
  const now = () => EVM.BLOCK.header.timestamp;
  const L = (page, s) => page.$("#lane-vault " + s);
  const LL = (page, s) => page.$$("#lane-vault " + s);
  const laneText = (page) => page.text("#lane-vault");
  const slabOpen = (page) => page.$("#cbox").classList.contains("on");
  const slabCd = (page) => page.text("#cslab [data-calldata]");
  const gasRow = (page) => page.text("#cslab [data-gas]");
  const fn = (page) => page.text("#cslab [data-function]");
  const tick = (page) => page.text("#tick");
  const line = (page, k) => { const r = page.$$("#cslab .kv").find((x) => x.firstChild && x.firstChild.textContent === k); return r ? r.lastChild.textContent : null; };
  const press = async (page, el) => { page.click(el); await page.until(() => slabOpen(page) && gasRow(page) !== "estimating…", 120); if (!slabOpen(page)) throw new Error("no slab after the press; the ticker reads: " + tick(page)); };
  const ready = (page) => page.until(() => !page.$("#cslab [data-go]").disabled, 40);
  const dismiss = async (page) => { page.click(page.$("#cslab [data-no]")); await page.settle(); };
  /* a receipt that itself moves the custody epoch or this wallet's rights (a panic) ends, as CONSOLE §4.7 says, on
     the sentence after the landing; such a call passes `moved`, and its wait names that sentence (W13: the landing
     wait timed out there, in silence, until the shim's waits threw) */
  const sign = async (page, W, n, moved = false) => {
    const before = tick(page);
    page.click(page.$("#cslab [data-go]"));
    await page.until(() => W.sent() === n && tick(page) !== before && (moved ? tick(page) === "ownership or epoch changed — review again" : /landed in block|reverted in block/.test(tick(page))), 160);
    for (let k = 0; k < 4; k++) await page.settle();
  };
  const repaint = async (page, vctx) => { vctx.dispatchEvent(new vctx.CustomEvent("intact:lane", { detail: { name: "vault" } })); await page.settle(); await page.settle(); };
  const field = (page, scope, name) => L(page, `${scope} input[name=${name}]`);
  const since = (W, mark) => W.calls.slice(mark);
  const isCall = (s4, to) => (x) => x.method === "eth_call" && String(x.params[0].data).toLowerCase().startsWith(sel(s4)) && (!to || lower(x.params[0].to) === lower(to));
  const allowance = async () => decUint(await c.read(weth, "allowance(address,address)", [reach1, pool]));
  const ledgerLen = async () => decUint(await c.read(reach1, "openApprovals()"), 1);
  const allows = async (key, to, s4) => decBool(await c.read(reach1, "sessionAllows(address,address,bytes4)", [key, to, s4]));
  const wouldPass = async (id = 1) => decUint(await c.read(steward, "wouldPass(uint256)", [id]));
  const MAX = BigInt("0x" + "ff".repeat(32));   // spelled so the static audit's mask rule stays a rule

  /* the cast: #1 to me, its Reach approved to the Pool, a key for agentW, a bound key, a priced inbox, a guardian,
     an operator, an approvee, a user, the guardian's co-sign (Bundle.t.sol's test_panicRevokesAcrossEverySatellite) */
  await mint(c, site, ME);
  const reach1 = decAddr(await c.read(hub, "account(uint256)", [1]));
  await c.exec(weth, "mint(address,uint256)", [reach1, 10n * WAD]);
  await c.exec(reach1, EXEC, [weth, 0n, enc(APPROVE, [pool, 10n * WAD]), 0], { label: "execute" });
  await c.exec(reach1, GRANT, [AGENT, now() + 100n * 86400n, WAD, [], [pool], [sel(SWAP_IN)], 0, 0], { label: "grantSession" });
  await c.exec(site.keys, "setEncryptionKey(uint16,bytes)", [1, "0x" + "ab".repeat(32)], { label: "setEncryptionKey" });
  await c.exec(parley, "bindKey(uint256)", [1], { label: "bindKey" });
  await c.exec(postage, "configureInbox(uint256,address,uint128,uint64,bool)", [1, ZERO, WAD / 10n, 86400, true], { label: "configureInbox" });
  await c.exec(hub, "setGuardian(uint256,address)", [1, guardianW.from.toString()], { label: "setGuardian" });
  await c.exec(hub, "setApprovalForAll(address,bool)", [STRANGER, true], { label: "setApprovalForAll" });
  await c.exec(hub, "approve(address,uint256)", [trader.from.toString(), 1], { label: "approve" });
  await c.exec(hub, "setUser(uint256,address,uint64)", [1, renter.from.toString(), now() + 100n * 86400n], { label: "setUser" });
  await guardianW.exec(pad, "approveFirstLaunch(uint256)", [1], { label: "approveFirstLaunch" });

  /*═══════════ K · the vault lists open approvals and revokes in one press ═══════════*/
  t.head("K · the vault lists open approvals and revokes in one press");
  let K = true, F10 = true, T = true;
  const k = (cond, name, d) => { t.ok(cond, name, d); K = K && !!cond; };
  const f10 = (cond, name, d) => { t.ok(cond, name, d); F10 = F10 && !!cond; };
  const tt = (cond, name, d) => { t.ok(cond, name, d); T = T && !!cond; };
  {
    const W = walletFor(c, me);
    const { page, ctx: vctx, S } = await bootToken(1, { wallet: W });
    await lane(page, "vault");
    await page.until(() => LL(page, "#vault-approvals .row").length === 1 && LL(page, "#vault-approvals .allowance[data-raw]").length === 1 && /WETH/.test(page.text("#lane-vault #vault-approvals")), 80);
    const row = LL(page, "#vault-approvals .row")[0];
    k(LL(page, "#vault-approvals .row").length === 1 && /WETH/.test(row.textContent) && new RegExp(esc(short(pool)), "i").test(row.textContent), "K1 the ledger renders: one row, WETH to the market", row && row.textContent);
    const al0 = await allowance();
    k(row.querySelector(".allowance").dataset.raw === String(al0) && al0 === 10n * WAD && /^10 WETH$/.test(row.querySelector(".allowance").textContent), "K2 the allowance is read live and printed exactly", `${row.querySelector(".allowance").dataset.raw} "${row.querySelector(".allowance").textContent}" vs ${al0}`);
    await press(page, L(page, "#vault-revoke-all"));
    k(fn(page) === "revokeOpenApprovals()" && L(page, "#vault-revoke-all").dataset.act === "revokeOpenApprovals" && lower(page.text("#cslab [data-to]")) === lower(reach1) && W.sent() === 0 && /^\d+ units$/.test(gasRow(page)),
      "K3 one press proposes revokeOpenApprovals to the Reach, and nothing is sent", `fn ${fn(page)} to ${page.text("#cslab [data-to]")} gas "${gasRow(page)}"`);
    await ready(page);
    await sign(page, W, 1);
    await page.until(() => /nothing may leave/.test(page.text("#lane-vault #vault-approvals")), 60);
    k(W.sent() === 1 && await ledgerLen() === 0n && await allowance() === 0n && /nothing may leave/.test(page.text("#lane-vault #vault-approvals")) && LL(page, "#vault-approvals .row").length === 0,
      "K4 Sign revokes in one transaction: the ledger is empty, the allowance zero, and the list says nothing may leave", `sent ${W.sent()} ledger ${await ledgerLen()} allowance ${await allowance()}`);

    /*─── F10 · the Reach's approve through execute is exact ───*/
    await page.until(() => !!field(page, "#vault-execute", "to"), 40);
    page.type(field(page, "#vault-execute", "to"), weth); page.type(field(page, "#vault-execute", "spender"), pool); page.type(field(page, "#vault-execute", "amount"), String(3n * WAD));
    await press(page, L(page, "[data-act=execute]"));
    const xcd = slabCd(page), inner = "0x" + xcd.slice(10 + 64 * 5, 10 + 64 * 5 + 136);
    f10(fn(page) === EXEC && lower(page.text("#cslab [data-to]")) === lower(reach1) && lower(addrWord(xcd, 0)) === lower(weth) && word(xcd, 3) === 0n && inner.slice(0, 10) === sel(APPROVE) && lower(addrWord(inner, 0)) === lower(pool) && word(inner, 1) === 3n * WAD && page.text('#cslab [data-arg="3"]') === "0",
      "F10 the Reach's approve through execute carries exactly the typed amount in the inner calldata, operation 0", `fn ${fn(page)} inner ${inner.slice(0, 10)} amount ${word(inner, 1)} op ${word(xcd, 3)}`);
    await ready(page);
    await sign(page, W, 2);
    const oa = await c.read(reach1, "openApprovals()");
    f10(decUint(oa, 1) === 1n && lower(decAddr(oa, 2)) === lower(weth) && lower(decAddr(oa, 3)) === lower(pool) && await allowance() === 3n * WAD, "F10 Sign → openApprovals lists (weth, pool) once and the allowance is exactly the amount", `ledger ${decUint(oa, 1)} allowance ${await allowance()}`);
    await page.until(() => !!field(page, "#vault-execute", "to") && LL(page, "#vault-approvals .row").length === 1, 60);
    /* F10b: the max, laid as the data of execute and of a two-row batch: the shell refuses the whole */
    const est0 = W.count("eth_estimateGas");
    page.type(field(page, "#vault-execute", "to"), weth); page.type(field(page, "#vault-execute", "spender"), pool); page.type(field(page, "#vault-execute", "amount"), String(MAX));
    page.click(L(page, "[data-act=execute]")); await page.settle(); await page.settle();
    const r1 = !slabOpen(page) && /unlimited approvals are never built here/.test(tick(page)) && W.count("eth_estimateGas") === est0;
    page.click(L(page, "#vault-batch-add")); await page.settle();
    page.type(field(page, "#vault-execute", "amount"), "1"); page.click(L(page, "#vault-batch-add")); await page.settle();
    page.click(L(page, "[data-act=executeBatch]")); await page.settle(); await page.settle();
    f10(r1 && LL(page, "#vault-batch .row").length === 2 && !slabOpen(page) && /unlimited approvals are never built here/.test(tick(page)) && W.count("eth_estimateGas") === est0,
      "F10b the Reach's approve cannot be unlimited either: 2^256 − 1 as the data of execute, and the same amount in a two-row batch, are refused before any estimate", `exec ${r1} rows ${LL(page, "#vault-batch .row").length} tick "${tick(page)}" estimates +${W.count("eth_estimateGas") - est0}`);
    page.type(field(page, "#vault-execute", "amount"), String(1n << 255n));
    page.click(L(page, "[data-act=execute]")); await page.settle(); await page.settle();
    f10(!slabOpen(page) && /unlimited approvals are never built here/.test(tick(page)) && W.count("eth_estimateGas") === est0, "F10b 2^255 exactly is refused the same way", tick(page));

    /*─── K24 · execute is call-only and a batch is one slab ───*/
    await repaint(page, vctx);
    page.type(field(page, "#vault-execute", "to"), weth); page.type(field(page, "#vault-execute", "spender"), pool); page.type(field(page, "#vault-execute", "amount"), "1");
    await press(page, L(page, "[data-act=execute]"));
    k(fn(page) === EXEC && word(slabCd(page), 3) === 0n && page.text('#cslab [data-arg="3"]') === "0" && LL(page, "#vault-execute input").every((i) => !/operation/i.test(i.name + i.placeholder)) && !/operation 1/.test(laneText(page)),
      "K24 the composer's slab names execute(address,uint256,bytes,uint8) with operation word 0, and no control offers 1", `fn ${fn(page)} op ${word(slabCd(page), 3)}`);
    await dismiss(page);
    page.click(L(page, "#vault-batch-add")); await page.settle();
    page.type(field(page, "#vault-execute", "amount"), "2"); page.click(L(page, "#vault-batch-add")); await page.settle();
    await press(page, L(page, "[data-act=executeBatch]"));
    const bcd = slabCd(page);
    k(fn(page) === BATCH && word(bcd, 1) === 2n && page.$$("#cslab [data-arg]").length === 0 && /1 ETH|0 ETH/.test(line(page, "Call 1") || "") && (line(page, "Call 2") || "").includes(sel(APPROVE)) && LL(page, "#vault-batch .row").length === 2,
      "K24 two batch rows → executeBatch((address,uint256,bytes)[]) with a decoded array length of 2; a tuple gets no [data-arg] rows, so every call is a line", `fn ${fn(page)} len ${word(bcd, 1)} line1 "${line(page, "Call 1")}"`);
    await ready(page);
    await sign(page, W, 3);
    k(W.sent() === 3 && await allowance() === 2n && await ledgerLen() === 1n, "K24 Sign → one transaction for the batch; the last approve stands and the ledger still lists the pair once", `sent ${W.sent()} allowance ${await allowance()} ledger ${await ledgerLen()}`);

    /*─── K5 · holdings say measured or not, never 0 for unmeasurable ───*/
    const brk = await c.deploy(A("test/mocks/Breakable.sol", "Breakable").bytecode, "", "Breakable");
    await c.exec(brk, "mint(address,uint256)", [reach1, 5n * WAD]);
    await c.exec(reach1, "guard(address)", [brk], { label: "guard" });
    await c.exec(brk, "setBreakBalance(bool)", [true]);
    await repaint(page, vctx);
    await page.until(() => LL(page, "#vault-holdings .row").length === 2 && /not measurable/.test(page.text("#lane-vault #vault-holdings")), 60);
    const brow = LL(page, "#vault-holdings .row").find((r) => /BRK/.test(r.textContent));
    k(!!brow && brow.querySelector(".v").textContent === "not measurable" && !/\b0 BRK\b/.test(page.text("#lane-vault #vault-holdings")) && /manifest: 1 guarded asset/.test(page.text("#lane-vault #vault-manifest")) && /^0 ETH$/.test(LL(page, "#vault-holdings .row")[0].querySelector(".v").textContent),
      "K5 holdings say measured or not: a guarded asset whose balanceOf reverts reads not measurable, never 0; the manifest counts it", `${LL(page, "#vault-holdings .row").map((r) => r.textContent).join(" | ")}`);

    /*─── K6–K8 · the seal ───*/
    const su = L(page, "#vault-seal-until"), sealed0 = decUint(await c.read(reach1, "sealedUntil()"));
    k(!!su && Number(su.min) >= Number(sealed0) && /only ever lengthens/.test(page.text("#lane-vault #vault-seal-note")) && L(page, "#vault-seal-note") !== null && LL(page, "#vault-reach *").indexOf(L(page, "#vault-seal-note")) < LL(page, "#vault-reach *").indexOf(su),
      "K6 the seal input cannot shorten: its min is the current seal, and the note before it says it only ever lengthens", `min ${su && su.min} sealed ${sealed0} note "${page.text("#lane-vault #vault-seal-note")}"`);
    const ds = dateOf(now() + 30n * 86400n), until = tsOf(ds);
    page.type(su, ds);
    await press(page, L(page, "[data-act=seal]"));
    k(fn(page) === "seal(uint64)" && line(page, "Until") === ds && word(slabCd(page), 0) === until && page.text('#cslab [data-arg="0"]') === String(until) && /^\d+ units$/.test(gasRow(page)),
      "K7 the seal slab names the date, equal to the input's value, and the word is that date on the chain's clock", `fn ${fn(page)} until "${line(page, "Until")}" vs "${ds}" w0 ${word(slabCd(page), 0)} vs ${until}`);
    await ready(page);
    await sign(page, W, 4);
    k(decUint(await c.read(reach1, "sealedUntil()")) === until, "K7 Sign → sealedUntil is the date typed", decUint(await c.read(reach1, "sealedUntil()")));
    await page.until(() => !!field(page, "#vault-execute", "to") && Number(L(page, "#vault-seal-until").min) === Number(until), 60);
    k(Number(L(page, "#vault-seal-until").min) === Number(until), "K6 after the seal lands the input's min is the new seal: it cannot be shortened from here", L(page, "#vault-seal-until").min);
    const p8 = W.prompts().length;
    page.type(field(page, "#vault-execute", "to"), BUYER); page.type(field(page, "#vault-execute", "value"), "0.000000000000000001");
    await press(page, L(page, "[data-act=execute]"));
    k(gasRow(page) === "would revert: ValueWhileSealed()" && page.$("#cslab [data-go]").disabled && W.prompts().length === p8 && word(slabCd(page), 1) === 1n && !page.$("#cslab [data-value]"),
      "K8 a sealed Reach refuses value in words before any prompt: would revert: ValueWhileSealed(), Sign disabled; the value is the Reach's own argument, not the wallet's", `gas "${gasRow(page)}" prompts +${W.prompts().length - p8}`);
    await dismiss(page);

    /*─── K9, K10 · the Grip ───*/
    const gw = L(page, "#vault-grip-warning"), ga = L(page, "#vault-grip-address"), svg = L(page, "#vault-grip svg[role=img]"), kids = LL(page, "#vault-grip *");
    k(!!ga && lower(ga.textContent) === lower(S.grip) && !!svg && svg.getAttribute("aria-label") === "ethereum:" + S.grip + "@1" && !!gw && /cannot ever leave|can ever leave|permanent/i.test(gw.textContent) && kids.indexOf(gw) < kids.indexOf(ga) && kids.indexOf(ga) < kids.indexOf(svg),
      "K9 the Grip warns before any way in: the warning precedes the address, and the QR names ethereum:<grip>@1", `address ${ga && ga.textContent} label ${svg && svg.getAttribute("aria-label")} warning "${gw && gw.textContent}"`);
    const gb = LL(page, "#vault-grip button");
    k(gb.length >= 1 && gb.every((b) => b.classList.contains("copy")) && LL(page, "#vault-grip [data-act]").length === 0 && LL(page, "#vault-grip input").length === 0,
      "K10 the Grip offers nothing outbound: its only buttons are .copy, no control, no input", gb.map((b) => b.className).join(","));

    /*─── K11–K17 · sessions ───*/
    const chips = LL(page, "#vault-sessions [data-sel]"), selVals = Object.values(S.sel).map(lower);
    k(chips.length >= 4 && chips.every((ch) => selVals.includes(lower(ch.dataset.sel))) && chips.some((ch) => lower(ch.dataset.sel) === lower(S.sel["pool.swapExactIn"])) && chips.every((ch) => ch.textContent in S.sel),
      "K11 the grant's selector chips carry on-chain selectors: every data-sel is an INTACT.sel value, swapExactIn among them, each labelled by its key", chips.map((ch) => ch.textContent + " " + ch.dataset.sel).join(" | "));
    page.click(chips.find((ch) => lower(ch.dataset.sel) === lower(S.sel["pool.swapExactIn"]))); await page.settle();
    page.type(field(page, "#vault-sessions", "k"), BUYER); page.type(field(page, "#vault-sessions", "t"), pool); page.type(field(page, "#vault-sessions", "d"), "1"); page.type(field(page, "#vault-sessions", "n"), "0.5");
    const mark12 = W.calls.length;
    await press(page, L(page, "[data-act=grantSession]"));
    const gcd = slabCd(page), gr = decodeGrant(gcd);
    k(fn(page) === GRANT && lower(page.text("#cslab [data-to]")) === lower(reach1) && gr.selectors.length === 1 && gr.selectors[0] === sel(SWAP_IN) && gr.targets.length === 1 && lower(gr.targets[0]) === lower(pool) && lower(gr.key) === lower(BUYER) && gr.expires === now() + 86400n && gr.cap === WAD / 2n && gr.caps.length === 0 && since(W, mark12).some((x) => x.method === "eth_getBlockByNumber"),
      "K12 the grant's calldata is exactly the chips pressed: one selector, the Pool as the one target, the key, an expiry one day on the chain's clock", `fn ${fn(page)} sels ${gr.selectors} targets ${gr.targets} expires ${gr.expires} vs ${now() + 86400n}`);
    k(/Exposure/.test(page.text("#cslab")) && /native cap 0\.5 ETH/.test(line(page, "Exposure") || "") && /no asset cap/.test(line(page, "Exposure") || "") && page.$$("#cslab [data-arg]").length === 0 && (line(page, "Selectors") || "").includes("pool.swapExactIn " + sel(SWAP_IN)),
      "K13 the exposure is printed before Sign — the native cap and each asset cap in words — and, the tuple drawing no [data-arg] rows, every argument is a line", `"${line(page, "Exposure")}" / "${line(page, "Selectors")}"`);
    await ready(page);
    await sign(page, W, 5);
    k(await allows(BUYER, pool, sel(SWAP_IN)) === true && await allows(BUYER, pool, sel(WITHDRAW)) === false && await allows(BUYER, hub, sel(SWAP_IN)) === false,
      "K14 the account agrees: sessionAllows(key, pool, swapExactIn) and nothing else", `${await allows(BUYER, pool, sel(SWAP_IN))} ${await allows(BUYER, pool, sel(WITHDRAW))} ${await allows(BUYER, hub, sel(SWAP_IN))}`);
    await page.until(() => !!L(page, "#vault-session-key"), 60);
    const mark15 = W.calls.length;
    page.type(L(page, "#vault-session-key"), AGENT);
    await page.until(() => /live|dead|not reported/.test(page.text("#lane-vault #vault-session-info")), 60);
    const rightsOfAgent = since(W, mark15).filter(isCall("rightsOf(uint256,address)", hub)).some((x) => lower(addrWord(x.params[0].data, 1)) === lower(AGENT));
    k(since(W, mark15).some(isCall("sessionOf(address)", reach1)) && since(W, mark15).some(isCall("sessionExposure(address)", reach1)) && rightsOfAgent && /allowlist/.test(page.text("#lane-vault #vault-session-info")) && /· live$/.test(page.text("#lane-vault #vault-session-info")),
      "K15 a pasted key is inspected by sessionOf, sessionExposure and rightsOf, and the row reads live", page.text("#lane-vault #vault-session-info"));
    const mark16 = W.calls.length;
    page.click(L(page, "#vault-session-walk"));
    await page.until(() => LL(page, "#vault-sessions .row").length === 2, 60);
    const logs16 = since(W, mark16).filter((x) => x.method === "eth_getLogs"), flt = logs16[0] && logs16[0].params[0];
    const confirmed = since(W, mark16).filter(isCall("rightsOf(uint256,address)", hub)).map((x) => lower(addrWord(x.params[0].data, 1)));
    k(logs16.length === 1 && !!flt && lower(flt.address) === lower(S.reach) && flt.topics[0] === S.topics.sessionGranted && flt.fromBlock === "0x0" && flt.toBlock === "latest" && LL(page, "#vault-sessions .row").length === 2 &&
      confirmed.includes(lower(AGENT)) && confirmed.includes(lower(BUYER)) && page.text("#lane-vault #vault-session-count") === "sessions: 2",
      "K16 the grant log is walked in one eth_getLogs over the Reach from block 0 to latest, two live keys listed, each confirmed by a rightsOf", `logs ${logs16.length} filter ${JSON.stringify(flt)} rows ${LL(page, "#vault-sessions .row").length} confirmed ${confirmed.join(",")}`);
    W.refuse("eth_getLogs", new Error("range too large"));
    page.click(L(page, "#vault-session-walk"));
    await page.until(() => /could not be walked/.test(page.text("#lane-vault #vault-session-count")), 60);
    k(/the grant log could not be walked on this endpoint/.test(page.text("#lane-vault #vault-session-count")) && !/sessions: 0/.test(laneText(page)) && LL(page, "#vault-sessions .row").length === 0,
      "K17 an endpoint that refuses the range is a sentence, not a zero", page.text("#lane-vault #vault-session-count"));
    W.override("eth_getLogs", null);

    /*─── K19, K20, K21 · the Steward: in words, the heir hash the chain's, the heartbeat the holder's ───*/
    await page.until(() => L(page, "#vault-steward-status") && page.text("#lane-vault #vault-steward-status") !== "reading…", 60);
    k(page.text("#lane-vault #vault-steward-status") === "nothing arranged" && await wouldPass() === 0n && !L(page, "[data-act=stillHere]"), "K19 the steward speaks in words: nothing arranged before a plan, and no heartbeat to press", page.text("#lane-vault #vault-steward-status"));
    const SALT = "0x" + "01".padStart(64, "0");
    page.type(field(page, "#vault-steward", "h"), STRANGER); page.type(field(page, "#vault-steward", "s"), "0x1"); page.type(field(page, "#vault-steward", "q"), "30"); page.type(field(page, "#vault-steward", "o"), "14");
    const mark20 = W.calls.length;
    await press(page, L(page, "[data-act=arrange]"));
    const hh = (await c.read(steward, "heirHashOf(address,bytes32)", [STRANGER, SALT])).slice(0, 66);
    k(since(W, mark20).some(isCall("heirHashOf(address,bytes32)", steward)) && fn(page) === ARRANGE && lower(page.text("#cslab [data-to]")) === lower(S.steward) && "0x" + slabCd(page).slice(10 + 64, 10 + 128) === hh && line(page, "Heir hash") === hh && word(slabCd(page), 2) === 30n * 86400n && word(slabCd(page), 3) === 14n * 86400n && /^\d+ units$/.test(gasRow(page)),
      "K20 the heir hash is the chain's: the arrange form reads heirHashOf(address,bytes32) and the slab's word is that answer; the writes go to INTACT.steward", `hash ${hh} slab ${"0x" + slabCd(page).slice(10 + 64, 10 + 128)} to ${page.text("#cslab [data-to]")}`);
    await ready(page);
    await sign(page, W, 6);
    await page.until(() => page.text("#lane-vault #vault-steward-status") === "speaking", 60);
    k(page.text("#lane-vault #vault-steward-status") === "speaking" && await wouldPass() === 2n && !!L(page, "[data-act=stillHere]"), "K19 arranged, the plan reads speaking and the heartbeat is the holder's", page.text("#lane-vault #vault-steward-status"));
    page.type(field(page, "#vault-steward", "h"), "#2"); page.type(field(page, "#vault-steward", "s"), "0x1"); page.type(field(page, "#vault-steward", "q"), "30"); page.type(field(page, "#vault-steward", "o"), "14");
    const mark20b = W.calls.length;
    await press(page, L(page, "[data-act=arrange]"));
    const hh2 = (await c.read(steward, "heirHashOfToken(uint256,bytes32)", [2, SALT])).slice(0, 66);
    k(since(W, mark20b).some(isCall("heirHashOfToken(uint256,bytes32)", steward)) && !since(W, mark20b).some(isCall("heirHashOf(address,bytes32)", steward)) && "0x" + slabCd(page).slice(10 + 64, 10 + 128) === hh2 && /token #2/.test(line(page, "Heir") || ""),
      "K20 an instrument heir issues heirHashOfToken(uint256,bytes32), and the slab carries that word", `hash ${hh2} slab ${"0x" + slabCd(page).slice(10 + 64, 10 + 128)}`);
    await dismiss(page);
    await press(page, L(page, "[data-act=stillHere]"));
    k(fn(page) === "stillHere(uint256)" && lower(page.text("#cslab [data-to]")) === lower(steward) && /^\d+ units$/.test(gasRow(page)), "K21 the heartbeat proposes stillHere(uint256) to the Steward for the holder", fn(page));
    await dismiss(page);

    /*─── K22, K23, T1, T2 · the sale: the recipient classified, the checklist before the transfer ───*/
    const to = field(page, "#vault-sell", "to"), p22 = W.prompts().length;
    page.type(to, S.grip);
    const markG = W.calls.length;
    page.click(L(page, "[data-act=transfer]")); await page.settle(); await page.settle();
    tt(!slabOpen(page) && /no Intact can sit inside another Intact's accounts/.test(tick(page)) && since(W, markG).length === 0 && !L(page, "#vault-checklist .revoked"),
      "T1 this collection's own Grip as the recipient is refused without a read", `tick "${tick(page)}" calls +${since(W, markG).length}`);
    await mint(c, site, ME);
    const reach2 = decAddr(await c.read(hub, "account(uint256)", [2]));
    page.type(to, reach2);
    const markR = W.calls.length;
    page.click(L(page, "[data-act=transfer]")); await page.settle(); await page.settle(); await page.settle();
    await page.until(() => /no Intact can sit/.test(tick(page)), 40);
    const seq = since(W, markR), iCode = seq.findIndex((x) => x.method === "eth_getCode" && lower(x.params[0]) === lower(reach2)), canon = seq.filter(isCall("isCanonicalAccount(address,uint256,bool)", hub));
    const canonArgs = canon.map((x) => `${lower(addrWord(x.params[0].data, 0))}:${word(x.params[0].data, 1)}:${word(x.params[0].data, 2)}`);
    tt(iCode >= 0 && canon.length === 2 && canonArgs.includes(`${lower(reach2)}:2:0`) && canonArgs.includes(`${lower(reach2)}:2:1`) && seq.indexOf(canon[0]) > iCode && !seq.some((x) => x.method === "eth_estimateGas") && !slabOpen(page) && /no Intact can sit inside another Intact's accounts/.test(tick(page)),
      "T1 another token's Reach is classified before the chain is asked: eth_getCode, then isCanonicalAccount(to, 2, false) and (to, 2, true) with k from the forwarder's last word, the refusal, and no estimate", `code@${iCode} canon ${canonArgs.join(" ")} estimate ${seq.some((x) => x.method === "eth_estimateGas")} tick "${tick(page)}"`);
    page.type(to, BUYER);
    const markB = W.calls.length;
    page.click(L(page, "[data-act=transfer]"));
    await page.until(() => LL(page, "#vault-checklist .survives p").length >= 10 && LL(page, "#vault-checklist .revoked p").length >= 12, 80);
    const rv = page.text("#lane-vault #vault-checklist .revoked"), sv = page.text("#lane-vault #vault-checklist .survives");
    k(!!L(page, "#vault-checklist .survives") && !!L(page, "#vault-checklist .revoked") && W.prompts().length === p22 && !slabOpen(page) && !since(W, markB).some(isCall("isCanonicalAccount(address,uint256,bool)", hub)) && since(W, markB).some((x) => x.method === "eth_getCode"),
      "K22 the sell checklist comes before the transfer: both columns render, no prompt moves, no slab yet; an address with no code needs no isCanonicalAccount", `prompts +${W.prompts().length - p22} slab ${slabOpen(page)}`);
    tt(!since(W, markB).some(isCall("isCanonicalAccount(address,uint256,bool)", hub)) && !!L(page, "#vault-checklist .revoked"), "T1 an address with no code is not asked isCanonicalAccount, and the checklist renders");
    k(/sessions: 2/.test(rv) && /key bound: yes/.test(rv) && /inbox price: 0\.1 ETH/.test(rv) && /steward plan: speaking/.test(rv) && /first-launch approval: yes/.test(rv) && /the single approval, if one stands/.test(rv) && rv.includes("the user: " + RENTER_S) && rv.includes("the guardian: " + GUARD_S) && /status → Paused/.test(rv) && /custody epoch 1 → 2/.test(rv) && /not revoked: your operator approvals/.test(rv) &&
      /the Reach's seal: sealed until/.test(sv) && /the owned market: closed/.test(sv) && /the Grip's contents: 0 ETH/.test(sv) && /open approvals: 1/.test(sv) && /launches: 0/.test(sv) && /manifest, pieces: 1 asset\(s\), 0 piece\(s\)/.test(sv) && /locks for the Reach: 0/.test(sv) && /nothing the previous holder delegated comes along/.test(page.text("#lane-vault #vault-checklist")) && !/not reported/.test(page.text("#lane-vault #vault-checklist")),
      "K23 the checklist names what is actually live, each line with the read that proves it, and ends with the footer", `revoked: ${rv.slice(0, 600)} | survives: ${sv.slice(0, 500)}`);
    await press(page, L(page, "[data-act=transfer]"));
    tt(fn(page) === "transferFrom(address,address,uint256)" && page.text('#cslab [data-arg="0"]') === checksum(ME, kec) && page.text('#cslab [data-arg="1"]') === checksum(BUYER, kec) && page.text('#cslab [data-arg="2"]') === "1" && lower(page.text("#cslab [data-to]")) === lower(hub) && /^\d+ units$/.test(gasRow(page)) && W.sent() === 6,
      "T2 the transfer is proposed after the checklist with from, to and the id, and nothing was sent", `fn ${fn(page)} args ${page.text('#cslab [data-arg="0"]')} ${page.text('#cslab [data-arg="1"]')} ${page.text('#cslab [data-arg="2"]')}`);
    await dismiss(page);

    /*─── K18 · revoking one key ───*/
    page.click(L(page, "#vault-session-walk"));
    await page.until(() => LL(page, "#vault-sessions .row").length === 2, 60);
    const krow = LL(page, "#vault-sessions .row").find((r) => lower(r.textContent).includes(lower(BUYER)));
    await press(page, krow.querySelector("[data-act=revokeSession]"));
    k(fn(page) === "revokeSession(address)" && lower(addrWord(slabCd(page), 0)) === lower(BUYER) && lower(page.text("#cslab [data-to]")) === lower(reach1), "K18 the row's revoke proposes revokeSession(address) for that key", fn(page));
    await ready(page);
    await sign(page, W, 7);
    k(await allows(BUYER, pool, sel(SWAP_IN)) === false && await allows(AGENT, pool, sel(SWAP_IN)) === true, "K18 Sign → the key no longer allows the swap; the other key still does", `${await allows(BUYER, pool, sel(SWAP_IN))}`);
    page.click(L(page, "#vault-session-walk"));
    await page.until(() => page.text("#lane-vault #vault-session-count") === "sessions: 1", 60);
    k(LL(page, "#vault-sessions .row").length === 1 && page.text("#lane-vault #vault-session-count") === "sessions: 1", "K18 a re-walk counts one live key", page.text("#lane-vault #vault-session-count"));

    /*─── K19 · thirty days of silence: summonable ───*/
    ctx.warp(now() + 30n * 86400n);
    await repaint(page, vctx);
    await page.until(() => page.text("#lane-vault #vault-steward-status") === "summonable", 60);
    k(page.text("#lane-vault #vault-steward-status") === "summonable" && await wouldPass() === 3n && !!L(page, "[data-act=summon]") && !!L(page, "[data-act=attest]") && !!L(page, "[data-act=stillHere]"),
      "K19 after thirty days of silence the plan reads summonable, and the summons is offered", page.text("#lane-vault #vault-steward-status"));
    page.type(field(page, "#vault-steward", "sh"), STRANGER); page.type(field(page, "#vault-steward", "ss"), "0x1");
    await press(page, L(page, "[data-act=summon]"));
    k(fn(page) === "summon(uint256,address,bytes32)" && lower(addrWord(slabCd(page), 1)) === lower(STRANGER) && "0x" + slabCd(page).slice(10 + 128, 10 + 192) === SALT && /^\d+ units$/.test(gasRow(page)),
      "the summons proposes summon(uint256,address,bytes32) with the heir and the salt, and the estimate passes", fn(page));
    await dismiss(page);
    k(page.innerHTMLWrites === 0 && page.errors.length === 0, "nothing was assigned through innerHTML and no script threw on the holder's page", page.errors.map((e) => e.message).join("; "));
    page.close();
  }
  {
    /* K21: the renter sees no heartbeat, no form, and the one sentence */
    const W = walletFor(c, renter);
    const { page } = await bootToken(1, { wallet: W });
    await lane(page, "vault");
    await page.until(() => page.text("#lane-vault #vault-steward-status") !== "reading…" && page.text("#lane-vault #vault-steward-status") !== "", 60);
    /* summon and attest are anyone's once the plan admits them (BLUEPRINT §5.4), so the renter sees those two and nothing of the holder's */
    k(page.$("body").dataset.rights === "4" && !L(page, "[data-act=stillHere]") && !L(page, "[data-act=arrange]") && !L(page, "[data-act=panic]") && !L(page, "[data-act=seal]") && !L(page, "[data-act=transfer]") && LL(page, "[data-act]").every((b) => /^(summon|attest)$/.test(b.dataset.act)) &&
      LL(page, "input").every((i) => i.id === "vault-session-key" || !!i.closest("#vault-steward")) && (laneText(page).match(/you are the user; only the holder may act as it/g) || []).length === 1 && page.text("#lane-vault #vault-steward-status") === "summonable",
      "K21 the heartbeat is the holder's: the renter reads the plan, may inspect a key or summon when due, but gets no heartbeat, no form of the holder's, and the one sentence", `rights ${page.$("body").dataset.rights} acts ${LL(page, "[data-act]").map((b) => b.dataset.act)} inputs ${LL(page, "input").length}`);
    page.close();
  }
  t.ok(K, "the vault lists open approvals and revokes in one press");
  t.ok(F10, "every approval the slab builds is exact — re-asserted for the Reach's approve through execute: exact, and never unlimited inside a call or a batch");
  t.ok(T, "the transfer slab: a canonical account is refused before the chain is asked, and the transfer is proposed after the checklist with from, to, id");

  /*═══════════ L · panic lists what it revokes ═══════════*/
  t.head("L · panic lists what it revokes");
  let Lp = true, sentH = -1, sentG = -1;
  const l = (cond, name, d) => { t.ok(cond, name, d); Lp = Lp && !!cond; };
  /* a second key, so the count is two again after K18 revoked the page's one-day key */
  await c.exec(reach1, GRANT, [trader.from.toString(), now() + 2n * 86400n, 0n, [], [pool], [sel(SWAP_IN)], 0, 0], { label: "grantSession" });
  {
    const W = walletFor(c, me);
    const { page, ctx: vctx } = await bootToken(1, { wallet: W });
    await lane(page, "vault");
    await page.until(() => !!L(page, "#vault-panic") && /locked: no/.test(laneText(page)), 60);
    l(LL(page, "#vault-panic").length === 1 && L(page, "#vault-panic").classList.contains("red") && L(page, "#vault-panic").dataset.act === "panic", "L1 one red button", L(page, "#vault-panic") && L(page, "#vault-panic").className);
    const mark2 = W.calls.length;
    page.click(L(page, "#vault-panic"));
    await page.until(() => LL(page, "#vault-panic-list p").length >= 12, 80);
    const pl = page.text("#lane-vault #vault-panic-list"), s2 = since(W, mark2);
    l(/sessions: 2/.test(pl) && /key bound: yes/.test(pl) && /inbox price: 0\.1 ETH/.test(pl) && /steward plan: summonable/.test(pl) && /first-launch approval: yes/.test(pl) && /every operator approval on every token you hold/.test(pl) && /the single approval, if one stands/.test(pl) &&
      pl.includes("the user: " + RENTER_S) && /status → Paused/.test(pl) && /seal → \d{4}-\d\d-\d\d \d\d:\d\d UTC/.test(pl) && !/nothing is delegated/.test(pl) &&
      s2.some((x) => x.method === "eth_getLogs") && s2.some(isCall("keyOf(uint256)", parley)) && s2.some(isCall("inboxOf(uint256)", postage)) && s2.some(isCall("wouldPass(uint256)", steward)) && s2.some(isCall("firstLaunchApproved(uint256)", pad)) && !slabOpen(page) && W.sent() === 0,
      "L2 the first press lists what it revokes, from live reads: the walk, keyOf, inboxOf, wouldPass, firstLaunchApproved, and the categories that have no read", pl.slice(0, 700));
    W.refuse("eth_getLogs", new Error("range too large"));
    await repaint(page, vctx);
    page.click(L(page, "#vault-panic"));
    await page.until(() => /sessions: not counted/.test(page.text("#lane-vault #vault-panic-list")), 80);
    l(/sessions: not counted/.test(page.text("#lane-vault #vault-panic-list")) && !/sessions: 0/.test(page.text("#lane-vault #vault-panic-list")), "L3 the count is honest when the walk fails: sessions: not counted, never 0", page.text("#lane-vault #vault-panic-list").match(/sessions: [^·]*/));
    W.override("eth_getLogs", null);
    await repaint(page, vctx);
    await page.until(() => !!L(page, "#vault-panic"), 40);
    page.click(L(page, "#vault-panic"));
    await page.until(() => LL(page, "#vault-panic-list p").length >= 12, 80);
    const s0 = W.sent();
    page.click(L(page, "#vault-panic"));
    await page.until(() => slabOpen(page) && gasRow(page) !== "estimating…", 120);
    l(fn(page) === "panic(uint256)" && word(slabCd(page), 0) === 1n && lower(page.text("#cslab [data-to]")) === lower(hub) && W.sent() === s0 && /^\d+ units$/.test(gasRow(page)), "L5 the second press proposes panic(uint256), nothing sent until Sign", fn(page));
    await ready(page);
    const T0 = now();
    await sign(page, W, 1, true); sentH = W.sent();   // the panic moves #1's epoch
    const ok6 = decUint(await c.read(hub, "custodyEpoch(uint256)", [1])) === 2n && decUint(await c.read(hub, "approvalEpoch(address)", [ME])) === 1n && decUint(await c.read(hub, "statusOf(uint256)", [1])) === 1n &&
      decUint(await c.read(reach1, "sealedUntil()")) === T0 + 365n * 86400n && await allows(AGENT, pool, sel(SWAP_IN)) === false && decUint(await c.read(parley, "keyOf(uint256)", [1]), 1) === 0n &&
      decUint(await c.read(postage, "inboxOf(uint256)", [1]), 1) === 0n && await wouldPass() === 1n && decBool(await c.read(pad, "firstLaunchApproved(uint256)", [1])) === false &&
      decBool(await c.read(hub, "isApprovedForAll(address,address)", [ME, STRANGER])) === false && lower(decAddr(await c.read(hub, "getApproved(uint256)", [1]))) === ZERO && lower(decAddr(await c.read(hub, "userOf(uint256)", [1]))) === ZERO;
    l(ok6 && W.sent() === 1, "L6 one transaction does all of it: epoch 2, approvalEpoch 1, Paused, the Reach sealed 365 days, every session, key, inbox price, plan, co-sign, operator, approvee and user gone", `epoch ${decUint(await c.read(hub, "custodyEpoch(uint256)", [1]))} sealed ${decUint(await c.read(reach1, "sealedUntil()"))} vs ${T0 + 365n * 86400n} plan ${await wouldPass()}`);
    await page.until(() => page.text("#facts [data-fact=epoch]") === "2" && page.text("#facts [data-fact=status]") === "Paused", 60);
    l(page.text("#facts [data-fact=epoch]") === "2" && page.text("#facts [data-fact=status]") === "Paused",
      "L7 the page re-reads and says so: the epoch fact reads 2 and the status Paused", `epoch ${page.text("#facts [data-fact=epoch]")} status ${page.text("#facts [data-fact=status]")} tick "${tick(page)}"`);
    l(page.innerHTMLWrites === 0 && page.errors.length === 0, "nothing was assigned through innerHTML and no script threw on the panic page", page.errors.map((e) => e.message).join("; "));
    page.close();
    /* the seal is a baked fact: a fresh boot reads it; the re-walk finds no live key */
    const { page: p7 } = await bootToken(1, { wallet: walletFor(c, me) });
    await lane(p7, "vault");
    page7: {
      p7.click(L(p7, "#vault-session-walk"));
      await p7.until(() => p7.text("#lane-vault #vault-session-count") === "sessions: 0", 60);
      l(/sealed until/.test(p7.text("#facts [data-fact=seal]")) && p7.text("#facts [data-fact=status]") === "Paused" && p7.text("#lane-vault #vault-session-count") === "sessions: 0" && LL(p7, "#vault-sessions .row").length === 0,
        "L7 on a fresh boot the seal fact reads sealed until, and a re-walk finds no live session", `seal "${p7.text("#facts [data-fact=seal]")}" count "${p7.text("#lane-vault #vault-session-count")}"`);
    }
    p7.close();
  }
  {
    /* L4: a fresh token has nothing delegated, and the list still says what panic does */
    await mint(c, site, ME);
    const W = walletFor(c, me);
    const { page } = await bootToken(3, { wallet: W });
    await lane(page, "vault");
    await page.until(() => !!L(page, "#vault-panic"), 60);
    page.click(L(page, "#vault-panic"));
    await page.until(() => /nothing is delegated/.test(page.text("#lane-vault #vault-panic-list")), 80);
    const pl = page.text("#lane-vault #vault-panic-list");
    l(/nothing is delegated/.test(pl) && /still moves the epoch and seals/.test(pl) && /sessions: 0/.test(pl) && /key bound: no/.test(pl) && /steward plan: nothing arranged/.test(pl) && /the single approval, if one stands/.test(pl) && !/not reported/.test(pl),
      "L4 nothing delegated is still a sentence: a fresh token's list says so, beside the categories", pl.slice(0, 400));
    page.close();
  }
  {
    /* L8, L9: the guardian's panic is a different list, and only the holder releases the hold */
    const W = walletFor(c, guardianW);
    const { page } = await bootToken(1, { wallet: W });
    await lane(page, "vault");
    await page.until(() => !!L(page, "#vault-panic") && /locked: no/.test(laneText(page)), 60);
    l(page.$("body").dataset.rights === "64" && !!L(page, "[data-act=sealMax]") && !!L(page, "[data-act=revokeAllSessions]") && !L(page, "[data-act=seal]") && !L(page, "[data-act=execute]") && !L(page, "[data-act=transfer]") && LL(page, "#vault-sessions [data-sel]").length === 0,
      "the guardian is offered panic, sealMax and revokeAllSessions, and no holder form", `rights ${page.$("body").dataset.rights} acts ${LL(page, "[data-act]").map((b) => b.dataset.act)}`);
    page.click(L(page, "#vault-panic"));
    await page.until(() => LL(page, "#vault-panic-list p").length >= 12, 80);
    const pl = page.text("#lane-vault #vault-panic-list");
    l(/does not touch the holder's operators/.test(pl) && /guardian hold/.test(pl) && !/every operator approval on every token you hold/.test(pl) && /sessions: 0/.test(pl), "L8 the guardian's panic is a different list and says so", pl.slice(0, 400));
    page.click(L(page, "#vault-panic"));
    await page.until(() => slabOpen(page) && gasRow(page) !== "estimating…", 120);
    l(fn(page) === "panic(uint256)" && word(slabCd(page), 0) === 1n && /the epoch moves/.test(page.text("#cslab [data-sentence]")) && /seals/.test(page.text("#cslab [data-sentence]")) && /^\d+ units$/.test(gasRow(page)),
      "L8 the guardian's slab is panic(uint256), its sentence naming the epoch and the seal; the hold is in the list above it", page.text("#cslab [data-sentence]"));
    await ready(page);
    await sign(page, W, 1, true); sentG = W.sent();   // the guardian's panic moves #1's epoch
    await page.until(() => page.text("#facts [data-fact=locked]") === "yes" && /locked: yes/.test(laneText(page)), 60);
    l(decBool(await c.read(hub, "locked(uint256)", [1])) && decUint(await c.read(hub, "custodyEpoch(uint256)", [1])) === 3n && page.text("#facts [data-fact=locked]") === "yes" && /locked: yes/.test(laneText(page)) && /only the holder in person/.test(laneText(page)) && !L(page, "[data-act=release]") && W.sent() === 1,
      "L9 under the hold Home's locked fact reads yes, the vault repeats locked: yes, and the guardian is offered no release", `locked ${page.text("#facts [data-fact=locked]")} lane ${laneText(page).match(/locked: [^\n]{0,80}/)}`);
    page.close();
    const WH = walletFor(c, me);
    const { page: ph } = await bootToken(1, { wallet: WH });
    await lane(ph, "vault");
    await ph.until(() => !!L(ph, "[data-act=release]"), 60);
    await press(ph, L(ph, "[data-act=release]"));
    l(fn(ph) === "release(uint256)" && word(slabCd(ph), 0) === 1n && /^\d+ units$/.test(gasRow(ph)), "L9 the holder is offered the release: release(uint256)", fn(ph));
    await ready(ph);
    await sign(ph, WH, 1);
    await ph.until(() => ph.text("#facts [data-fact=locked]") === "no", 60);
    l(decBool(await c.read(hub, "locked(uint256)", [1])) === false && ph.text("#facts [data-fact=locked]") === "no" && /locked: no/.test(laneText(ph)) && !L(ph, "[data-act=release]"),
      "L9 Sign → the hold is lifted, and the locked fact reads no", `locked ${ph.text("#facts [data-fact=locked]")}`);
    ph.close();
  }
  {
    /* L10: nobody else sees the button */
    /* after the panic the user and the operator approval are gone, so both read rights 0: the button is absent either way */
    for (const [who, name, rights] of [[renter, "the renter", "0"], [stranger, "a stranger", "0"]]) {
      const W = walletFor(c, who);
      const { page } = await bootToken(1, { wallet: W });
      await lane(page, "vault");
      await page.until(() => page.text("#lane-vault #vault-steward-status") !== "reading…", 60);
      l(L(page, "#vault-panic") === null && LL(page, "[data-act=panic]").length === 0 && page.$("body").dataset.rights === rights, `L10 ${name} sees no panic button (rights ${rights} after the panic)`, `rights ${page.$("body").dataset.rights} acts ${LL(page, "[data-act]").map((b) => b.dataset.act)}`);
      page.close();
    }
  }
  l(sentH === 1 && sentG === 1, "L11 panic is one transaction: the holder's wallet sent exactly one for its panic, the guardian's exactly one for its", `holder ${sentH} guardian ${sentG}`);
  t.ok(Lp, "panic lists what it revokes");

  /*═══════════ O · the gates: the viewer reads and offers nothing ═══════════*/
  t.head("O · the viewer");
  {
    const W = walletFor(c, me);
    const { page } = await bootToken(1, { opaque: true, wallet: W });
    await lane(page, "vault");
    await page.until(() => page.text("#lane-vault #vault-steward-status") !== "reading…" && LL(page, "#vault-holdings .row").length >= 1, 80);
    /* W13: "reads the vault" — the holdings and the plan — was the wait's alone; the sentence now checks them */
    t.ok(page.$("body").dataset.mode === "viewer" && LL(page, "#vault-holdings .row").length >= 1 && page.text("#lane-vault #vault-steward-status") !== "reading…" &&
      LL(page, "[data-act]").length === 0 && LL(page, "input").length === 1 && (laneText(page).match(/nothing here can sign/g) || []).length === 1 && W.prompts().length === 0 && !!L(page, "#vault-grip svg[role=img]"),
      "the viewer reads the vault and offers no control, with the one sentence; the key field is a read", `acts ${LL(page, "[data-act]").length} inputs ${LL(page, "input").length}`);
    t.ok(page.innerHTMLWrites === 0 && page.errors.length === 0, "nothing was assigned through innerHTML and no script threw on the viewer's page", page.errors.map((e) => e.message).join("; "));
    page.close();
  }

  /*═══════════ V · keepsakes (V2, W10): the chip where there is no Keepsake ═══════════*/
  t.head("V0 · a band without the Keepsake");
  {
    const W = walletFor(c, me);
    const { page, S } = await bootToken(1, { wallet: W });
    await lane(page, "vault");
    await page.until(() => !!L(page, "#vault-keepsakes .chip") && page.text("#lane-vault #vault-steward-status") !== "reading…", 60);
    const ch = L(page, "#vault-keepsakes .chip"), toK = W.calls.filter((x) => { const p = (x.params || [])[0] || {}; return lower(p.to || p.address || "") === lower(S.keepsake); });
    t.ok(!!ch && ch.dataset.state === "absent" && ch.textContent === "keepsake: not deployed on this chain" && !L(page, "#vault-make") && !L(page, "#vault-keepsakes-list") && toK.length === 0 && LL(page, "#vault-keepsakes input").length === 0,
      "where the Keepsake is not deployed the section is the not-deployed chip, with no form, and nothing reads the codeless address", `chip ${ch && ch.dataset.state} "${ch && ch.textContent}" reads ${toK.length}`);
    page.close();
  }
  await keepsakes(t, await ctx.fresh({ v2: true }), { L, LL, press, ready, sign, dismiss, repaint, since, tick, slabOpen, slabCd, gasRow, fn, line, now });
}

/*═══════════ V · keepsakes (V2, W10): on a band with the V2 satellites (deploySite v2: true) ═══════════
  Setup on that chain: #1 to `me`; 1,000,000 USDC (6 decimals) and 100 WETH to `me`; Pool market #1 is USDC/ETH,
  opened by #1's holder with 100,000 USDC and 50 ETH (0.0005 ETH per USDC). Keepsake #1 is made from the page
  (0.2 ETH, 500 USDC, 3 WETH, for me, 30 days locked then 60 days to free), #2 from the page as a gift to `buyer`
  (0.1 ETH and 100 USDC, freed over 10 days, with a note), #3 by `trader` straight on the chain into #1's Reach
  (1,000 USDC over 100 days). The sentences below are this block's, each ending the steps that prove it. */
async function keepsakes(t, v, h) {
  const { L, LL, press, ready, sign, dismiss, repaint, since, tick, slabOpen, slabCd, gasRow, fn, line, now } = h;
  const { c, site, actors, weth, A, enc, encodeParams, decUint, decAddr, walletFor, bootToken, lane, mint, ZERO, kec } = v;
  const { me, buyer, trader, stranger } = actors;
  const WAD = 10n ** 18n, U6 = 10n ** 6n, DAY = 86400n;
  const ME = me.from.toString(), BUYER = buyer.from.toString(), STRANGER = stranger.from.toString();
  const K = site.keepsake, J = site.journal, pool = site.pool, hub = site.hub;
  const WRAP = "wrap(((address,uint256)[],(uint64,uint64,uint64),address,string,(uint8,uint256,uint256,uint256)))";
  const SETDRIP = "setDrip(uint256,(uint8,uint256,uint256,uint256))", INSCRIBE = "inscribe(address,uint256,uint8,bytes,bytes32)";
  const EXEC = "execute(address,uint256,bytes,uint8)", EXTEND = "extend(uint256,uint64)", TRANSFER = "transferFrom(address,address,uint256)";
  const lower = (s) => String(s).toLowerCase();
  const word = (cd, i) => BigInt("0x" + cd.slice(10 + 64 * i, 10 + 64 * (i + 1)));
  const short = (a) => a.slice(0, 6) + " … " + a.slice(-4);
  const cks = (a) => { const x = kec(Buffer.from(a.slice(2).toLowerCase(), "utf8")).slice(2); let o = "0x"; for (let i = 0; i < 40; i++) o += parseInt(x[i], 16) >= 8 ? a[i + 2].toUpperCase() : a[i + 2].toLowerCase(); return o; };
  const dateOf = (ts) => new Date(Number(ts) * 1e3).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const bal = async (tok, who) => decUint(await c.read(tok, "balanceOf(address)", [who]));
  const ownerOf = async (id) => lower(decAddr(await c.read(K, "ownerOf(uint256)", [id])));
  /* KeepsakeView's head, as tools/verify-keepsake.mjs decodes it: holder, creator, createdAt, start, cliff, end, … drip at 11–14 */
  const view = async (id) => { const x = (await c.call(K, enc("keepsakeOf(uint256)", [id]))).slice(2), b = Number(BigInt("0x" + x.slice(0, 64))) * 2, w = (i) => BigInt("0x" + x.substr(b + i * 64, 64)); return { start: w(3), cliff: w(4), end: w(5), drip: [w(11), w(12), w(13), w(14)] }; };
  const card = (page, id) => L(page, `#vault-keepsakes-list .keepsake[data-id="${id}"]`);
  const ctext = (page, id, s) => { const k = card(page, id); const e = k && (s ? k.querySelector(s) : k); return e ? e.textContent : ""; };
  const cardRow = (page, id, k) => { const r = (card(page, id) || { querySelectorAll: () => [] }).querySelectorAll(".kv").find((x) => x.firstChild.textContent === k); return r ? r.lastChild.textContent : null; };
  const F = (page, n, i = 0) => LL(page, `#vault-make input[name=${n}]`)[i];
  /* the page has stopped reading: no new wallet call across three settles */
  const quiet = async (page, W) => { for (let n = -1, k = 0; k < 40 && n !== W.calls.length; k++) { n = W.calls.length; for (let j = 0; j < 3; j++) await page.settle(); } };
  const M = (page, id, n) => { const k = card(page, id); return k && k.querySelector(`details input[name=${n}]`); };
  /* null-safe reads for the assertions, so a mutant that removes a control fails a sentence instead of crashing the group */
  const inC = (page, id, s) => { const k = card(page, id); return (k && k.querySelector(s)) || null; };
  const ds = (e, k) => (e ? e.dataset[k] : undefined), att = (e, k) => (e ? e.getAttribute(k) : null);
  const make = (page, o) => {
    page.type(F(page, "eth"), o.eth || "0");
    (o.coins || []).forEach(([tok, amt], i) => { if (!F(page, "token", i)) page.click(L(page, "#vault-make-add")); page.type(F(page, "token", i), tok); page.type(F(page, "amount", i), amt); });
    page.type(F(page, "lock"), o.lock); page.type(F(page, "over"), o.over); page.type(F(page, "to"), o.to || ""); page.type(F(page, "note"), o.note || "");
    for (const k of ["dsell", "dfloor", "dmax"]) page.type(F(page, k), o[k] || "");
  };
  let V = true;
  const ok = (cond, name, d) => { t.ok(cond, name, d); V = V && !!cond; return !!cond; };

  /* the cast */
  await mint(c, site, ME);
  const reach1 = decAddr(await c.read(hub, "account(uint256)", [1]));
  const usdc = await c.deploy(A("test/mocks/MockERC20.sol", "MockERC20").bytecode, encodeParams("string,string,uint8,uint256,bool", ["USD Coin", "USDC", 6, 0, false]), "USDC");
  await c.exec(usdc, "mint(address,uint256)", [ME, 1_000_000n * U6]);
  await c.exec(weth, "mint(address,uint256)", [ME, 100n * WAD]);
  await c.exec(usdc, "approve(address,uint256)", [pool, 100_000n * U6], { label: "approve" });
  await c.exec(pool, "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)", [1, usdc, ZERO, 30, 0, 0, 0], { label: "openMarket" });
  await c.exec(pool, "deposit(uint256,uint256,uint256)", [1, 100_000n * U6, 50n * WAD], { value: 50n * WAD, label: "deposit" });

  t.head("V1 · make a keepsake: a bundle of ETH and two coins, exact approvals first");
  const W = walletFor(c, me);
  const { page, ctx: vctx, S } = await bootToken(1, { wallet: W });
  await lane(page, "vault");
  await page.until(() => /none held by/.test(page.text("#lane-vault #vault-keepsakes-status")) && !!F(page, "eth"), 80);
  const walk0 = W.calls.filter((x) => x.method === "eth_getLogs" && lower(x.params[0].address) === lower(K))[0], f0 = walk0 && walk0.params[0];
  ok(!!f0 && f0.topics[0] === S.topics.transfer && f0.topics[1] === null && f0.topics[2].map(lower).sort().join() === ["0x" + "0".repeat(24) + lower(ME).slice(2), "0x" + "0".repeat(24) + lower(reach1).slice(2)].sort().join() && f0.fromBlock === "0x0" && f0.toBlock === "latest" &&
    page.text("#lane-vault #vault-keepsakes-status") === "none held by this wallet or #1's Reach yet" && !L(page, "#vault-keepsakes .chip") && ds(L(page, "[data-act=wrap]"), "spend") === "",
    "where the Keepsake reports, the lane walks its Transfer logs to the wallet and to the Reach in one filter, says none are held yet, and offers the form", JSON.stringify(f0));
  make(page, { eth: "0.2", coins: [[usdc, "500"], [weth, "3"]], lock: "30", over: "60", note: "for the long road" });
  await page.until(() => LL(page, "#vault-make .coin p.s").map((p) => p.textContent).join("|") === "USDC · 6 decimals|WETH · 18 decimals", 60);
  ok(LL(page, "#vault-make .coin").length === 2 && LL(page, "#vault-make .coin p.s").map((p) => p.textContent).join("|") === "USDC · 6 decimals|WETH · 18 decimals",
    "each coin typed by its address is named with its symbol and decimals read live from the chain", LL(page, "#vault-make .coin p.s").map((p) => p.textContent).join("|"));
  let sent = 0;
  await press(page, L(page, "[data-act=wrap]"));
  const a1 = slabCd(page);
  ok(fn(page) === "approve(address,uint256)" && lower(page.text("#cslab [data-to]")) === lower(usdc) && lower("0x" + a1.slice(34, 74)) === lower(K) && word(a1, 1) === 500n * U6 && line(page, "Never") === "unlimited" && W.sent() === 0,
    "the first press is the exact approval of the first coin: approve(Keepsake, 500 USDC in base units) and nothing more", `fn ${fn(page)} to ${page.text("#cslab [data-to]")} amount ${word(a1, 1)}`);
  await ready(page); await sign(page, W, ++sent);
  await press(page, L(page, "[data-act=wrap]"));
  const a2 = slabCd(page);
  ok(fn(page) === "approve(address,uint256)" && lower(page.text("#cslab [data-to]")) === lower(weth) && word(a2, 1) === 3n * WAD, "the same button again approves exactly the second coin", `to ${page.text("#cslab [data-to]")} amount ${word(a2, 1)}`);
  await ready(page); await sign(page, W, ++sent);
  const T1 = now();
  await press(page, L(page, "[data-act=wrap]"));
  const st1 = T1 + 30n * DAY, en1 = st1 + 60n * DAY;
  const want1 = enc(WRAP, [[[[ZERO, WAD / 5n], [usdc, 500n * U6], [weth, 3n * WAD]], [st1, 0, en1], ME, "for the long road", [0, 0, 0, 0]]]);
  const sen1 = page.text("#cslab [data-sentence]");
  ok(fn(page) === WRAP && slabCd(page) === lower(want1) && ds(page.$("#cslab [data-value]"), "wei") === String(WAD / 5n) && page.$$("#cslab [data-arg]").length === 0 &&
    sen1 === "You lock 0.2 ETH, 500 USDC and 3 WETH for 30 days, then they free slowly over 60 days; it is yours, with your note." &&
    line(page, "Assets") === "0.2 ETH, 500 USDC and 3 WETH" && line(page, "Schedule") === `nothing frees before ${dateOf(st1)}; all free on ${dateOf(en1)}` && line(page, "For") === "you, " + cks(ME) && line(page, "Note") === "for the long road" && line(page, "Slow sale") === "none" && /^\d+ units$/.test(gasRow(page)),
    "the third press is wrap: its bytes are exactly the Wrap the form says, the value is the ETH to the wei, and the sentence is plain words", `sentence "${sen1}" calldata equal ${slabCd(page) === lower(want1)}`);
  await ready(page); await sign(page, W, ++sent);
  await page.until(() => /is made/.test(page.text("#lane-vault #vault-keepsake-made")), 60);
  const r1 = [...W.receipts.values()].at(-1), wl1 = r1.logs.find((l) => l.topics[0] === S.topics.wrapped);
  ok(page.text("#lane-vault #vault-keepsake-made") === "keepsake #1 is made · its number from the Wrapped log" && !!wl1 && BigInt(wl1.topics[1]) === 1n &&
    await ownerOf(1) === lower(ME) && await c.balanceOf(K) === WAD / 5n && await bal(usdc, K) === 500n * U6 && await bal(weth, K) === 3n * WAD &&
    decUint(await c.read(usdc, "allowance(address,address)", [ME, K])) === 0n && decUint(await c.read(weth, "allowance(address,address)", [ME, K])) === 0n,
    "a bundle of ETH and two ERC-20s is made with exact approvals: the Keepsake holds exactly what was typed, both allowances are spent to zero, and the page names #1 from the Wrapped log", page.text("#lane-vault #vault-keepsake-made"));

  t.head("V2 · a gift to another account, and a slow sale refused on it");
  await page.until(() => !!F(page, "eth") && F(page, "eth").value === "0" && !!ctext(page, 1, ".claimable"), 60);
  await quiet(page, W);
  make(page, { eth: "0.1", coins: [[usdc, "100"]], lock: "0", over: "10", to: BUYER, note: "happy birthday", dsell: "USDC", dfloor: "0.0004", dmax: "10" });
  await quiet(page, W);
  const est0 = W.count("eth_estimateGas"), calls0 = W.calls.length;
  page.click(L(page, "[data-act=wrap]")); await page.settle(); await page.settle();
  ok(!slabOpen(page) && tick(page) === "a slow sale only on a keepsake you keep: a giver never sells a recipient's gift" && W.count("eth_estimateGas") === est0 && since(W, calls0).length === 0,
    "a slow sale on a gift is refused in words before anything is read or built: a giver never sells a recipient's gift", tick(page));
  page.type(F(page, "dfloor"), "");
  await press(page, L(page, "[data-act=wrap]"));
  ok(fn(page) === "approve(address,uint256)" && word(slabCd(page), 1) === 100n * U6, "the gift's coin is approved exactly first", `${word(slabCd(page), 1)}`);
  await ready(page); await sign(page, W, ++sent);
  const T2 = now();
  await press(page, L(page, "[data-act=wrap]"));
  const want2 = enc(WRAP, [[[[ZERO, WAD / 10n], [usdc, 100n * U6]], [0, 0, T2 + 10n * DAY], BUYER, "happy birthday", [0, 0, 0, 0]]]);
  const sen2 = page.text("#cslab [data-sentence]");
  ok(slabCd(page) === lower(want2) && sen2 === `You lock 0.1 ETH and 100 USDC; they free slowly over 10 days; it is a gift to ${short(cks(BUYER))} with your note.` && line(page, "For") === "a gift to " + cks(BUYER) && line(page, "Schedule") === `starts when it lands; all free on ${dateOf(T2 + 10n * DAY)}`,
    "the gift's slab names the recipient (in the sentence, and in full on the line beneath it) and the note, and its bytes are the Wrap to that address", `"${sen2}"`);
  await ready(page); await sign(page, W, ++sent);
  await page.until(() => /keepsake #2 is made/.test(page.text("#lane-vault #vault-keepsake-made")), 60);
  const r2 = [...W.receipts.values()].at(-1), wl2 = r2.logs.find((l) => l.topics[0] === S.topics.wrapped);
  ok(page.text("#lane-vault #vault-keepsake-made") === `keepsake #2 is made, a gift to ${short(cks(BUYER))} · its number from the Wrapped log` && BigInt(wl2.topics[1]) === 2n && lower("0x" + wl2.topics[3].slice(26)) === lower(BUYER) && await ownerOf(2) === lower(BUYER),
    "a gift to another account: keepsake #2 is minted to them, named from the Wrapped log, and it is not in the giver's list", page.text("#lane-vault #vault-keepsake-made"));

  t.head("V3 · the keepsakes found from the logs");
  await c.exec(usdc, "mint(address,uint256)", [trader.from.toString(), 1_000n * U6]);
  await trader.exec(usdc, "approve(address,uint256)", [K, 1_000n * U6], { label: "approve" });
  const T3 = now();
  await trader.exec(K, WRAP, [[[[usdc, 1_000n * U6]], [0, 0, T3 + 100n * DAY], reach1, "for the Reach", [0, 0, 0, 0]]], { label: "wrap" });
  const m3 = W.calls.length;
  await repaint(page, vctx);
  await page.until(() => LL(page, "#vault-keepsakes-list .keepsake").length === 2 && !!L(page, ".keepsake img") && LL(page, "#vault-keepsakes-list .claimable").length === 2, 80);
  const v1 = await view(1), uris = since(W, m3).filter((x) => x.method === "eth_call" && lower(x.params[0].to) === lower(K) && x.params[0].data.startsWith("0xc87b56dd")), owners = since(W, m3).filter((x) => x.method === "eth_call" && lower(x.params[0].to) === lower(K) && x.params[0].data.startsWith(v.sel("ownerOf(uint256)")));
  const img = card(page, 1) && card(page, 1).querySelector("img");
  ok(page.text("#lane-vault #vault-keepsakes-status") === "2 held by this wallet or #1's Reach" && !!card(page, 1) && !card(page, 2) && !!card(page, 3) && owners.length === 2 &&
    v.sel("tokenURI(uint256)") === "0xc87b56dd" && uris.length >= 1 && !!img && /^data:image\/svg\+xml;base64,/.test(img.src) && /<svg/.test(Buffer.from(img.src.split(",")[1], "base64").toString("utf8")),
    "the keepsakes are found from the Keepsake's Transfer logs and kept by ownerOf: #1 (this wallet) and #3 (the Reach), never #2 (given away); each orb is its tokenURI image, a data: SVG", `status "${page.text("#lane-vault #vault-keepsakes-status")}" ownerOf ${owners.length} tokenURI ${uris.length}`);
  ok(cardRow(page, 1, "ETH") === "0.2 ETH" && cardRow(page, 1, "USDC") === "500 USDC" && cardRow(page, 1, "WETH") === "3 WETH" &&
    ctext(page, 1, ".free") === `0 % free · nothing frees before ${dateOf(v1.start)} · fully free on ${dateOf(v1.end)}` && ctext(page, 1, ".note") === "“for the long road”" &&
    ctext(page, 1, ".claimable") === "nothing to claim yet" && ctext(page, 1, ".drip") === "no slow sale" && /made by you · held by you/.test(ctext(page, 1)) && !inC(page, 1, "[data-act=claim]") &&
    cardRow(page, 3, "USDC") === "1000 USDC" && ctext(page, 3, ".note") === "“for the Reach”" && ctext(page, 3).includes("a gift from " + short(cks(trader.from.toString())) + " · held by #1's Reach"),
    "each keepsake is drawn in words: its coins with symbols and decimals read live, the schedule on the chain's clock, what a claim pays now, its slow sale, its note", `${ctext(page, 1).slice(0, 300)} | ${ctext(page, 3).slice(0, 200)}`);
  W.refuse("eth_getLogs", new Error("range too large"));
  await repaint(page, vctx);
  await page.until(() => /could not be found/.test(page.text("#lane-vault #vault-keepsakes-status")), 60);
  ok(page.text("#lane-vault #vault-keepsakes-status") === "the keepsakes could not be found on this endpoint: range too large" && LL(page, "#vault-keepsakes-list .keepsake").length === 0,
    "a refused log range is a sentence, never an empty list", page.text("#lane-vault #vault-keepsakes-status"));
  W.override("eth_getLogs", null);

  t.head("V4 · time passes: claimable grows, and a claim pays the holder");
  v.warp(v1.start + 15n * DAY);
  await repaint(page, vctx);
  await page.until(() => /^25 % free/.test(ctext(page, 1, ".free")) && !!(card(page, 1) && card(page, 1).querySelector("[data-act=claim]")), 80);
  ok(ctext(page, 1, ".free") === `25 % free · fully free on ${dateOf(v1.end)}` && ctext(page, 1, ".claimable") === "ready to claim now: 0.05 ETH, 125 USDC and 0.75 WETH" && att(inC(page, 1, "progress"), "value") === "25",
    "a quarter of the way along, the bar and the sentence read 25 % free and a quarter of every coin is ready to claim", `${ctext(page, 1, ".free")} | ${ctext(page, 1, ".claimable")}`);
  const u0 = await bal(usdc, ME), w0 = await bal(weth, ME);
  await press(page, card(page, 1).querySelector("[data-act=claim]"));
  ok(fn(page) === "claim(uint256)" && word(slabCd(page), 0) === 1n && lower(page.text("#cslab [data-to]")) === lower(K) &&
    page.text("#cslab [data-sentence]") === "pays keepsake #1's holder, you, what has freed — now 0.05 ETH, 125 USDC and 0.75 WETH; whoever presses is paid nothing",
    "the claim's sentence says who is paid and what", page.text("#cslab [data-sentence]"));
  await ready(page); await sign(page, W, ++sent);
  ok(await bal(usdc, ME) - u0 === 125n * U6 && await bal(weth, ME) - w0 === 3n * WAD / 4n && await c.balanceOf(K) === WAD / 5n - WAD / 20n + WAD / 10n,
    "the claim paid the holder exactly what had freed", `usdc +${await bal(usdc, ME) - u0} weth +${await bal(weth, ME) - w0}`);
  {
    const WS = walletFor(c, stranger);
    const { page: ps } = await bootToken(1, { wallet: WS });
    await lane(ps, "vault");
    await ps.until(() => !!(card(ps, 3) && card(ps, 3).querySelector("[data-act=claim]")), 80);
    const r0 = await bal(usdc, reach1), s0 = await bal(usdc, STRANGER), due3 = decUint(await c.call(K, enc("claimable(uint256)", [3])), 4);
    await press(ps, card(ps, 3).querySelector("[data-act=claim]"));
    const sen3 = ps.text("#cslab [data-sentence]");
    ok(!card(ps, 1) && LL(ps, "#vault-keepsakes-list details").length === 0 && sen3.startsWith("pays keepsake #3's holder, #1's Reach, what has freed — now ") && sen3.endsWith("; whoever presses is paid nothing"),
      "a stranger sees the Reach's keepsake, may press its claim, and is told the Reach is paid; no change is offered to them", sen3);
    await ready(ps); await sign(ps, WS, 1);
    const paid = (await c.getLogs({ address: K, topics: [S.topics.paid, "0x" + "3".padStart(64, "0")] })).at(-1);
    ok(await bal(usdc, reach1) - r0 === due3 && due3 > 0n && await bal(usdc, STRANGER) === s0 && !!paid && lower("0x" + paid.topics[2].slice(26)) === lower(reach1),
      "a stranger's claim pays the keepsake's holder, the Reach, and the stranger nothing", `reach +${await bal(usdc, reach1) - r0} of ${due3}, stranger ${await bal(usdc, STRANGER) - s0}`);
    ok(ps.innerHTMLWrites === 0 && ps.errors.length === 0, "nothing was assigned through innerHTML and no script threw on the stranger's keepsakes", ps.errors.map((e) => e.message).join("; "));
    ps.close();
  }
  t.ok(V, "after a warp, claimable grows and a claim pays the holder, whoever presses it");

  t.head("V5 · the holder's changes: lengthen, a slow sale, a memory, a give");
  await repaint(page, vctx);
  await page.until(() => !!M(page, 1, "more") && !!M(page, 3, "more"), 80);
  page.type(M(page, 1, "more"), "-30");
  const e5 = W.count("eth_estimateGas");
  page.click(card(page, 1).querySelector("[data-act=extend]")); await page.settle(); await page.settle();
  ok(!slabOpen(page) && tick(page) === "a keepsake only lengthens, by whole days: it never ends sooner" && W.count("eth_estimateGas") === e5,
    "a shortening extend is refused in words before any slab", tick(page));
  page.type(M(page, 1, "more"), "30");
  await press(page, card(page, 1).querySelector("[data-act=extend]"));
  ok(fn(page) === EXTEND && word(slabCd(page), 0) === 1n && word(slabCd(page), 1) === v1.end + 30n * DAY && lower(page.text("#cslab [data-to]")) === lower(K) &&
    page.text("#cslab [data-sentence]") === `lengthens keepsake #1 by 30 days: fully free on ${dateOf(v1.end + 30n * DAY)}, not ${dateOf(v1.end)}; it only lengthens, never shortens`,
    "an extend carries the end plus the days typed, and its sentence says it only lengthens, never shortens", page.text("#cslab [data-sentence]"));
  await ready(page); await sign(page, W, ++sent);
  ok((await view(1)).end === v1.end + 30n * DAY, "the end moved out by thirty days on the chain", `${(await view(1)).end}`);
  await page.until(() => !!M(page, 3, "more"), 60);
  await press(page, card(page, 3).querySelector("[data-act=extend]"));
  const x3 = slabCd(page), inner3 = "0x" + x3.slice(10 + 64 * 5, 10 + 64 * 5 + 136);
  ok(fn(page) === EXEC && lower(page.text("#cslab [data-to]")) === lower(reach1) && lower("0x" + x3.slice(34, 74)) === lower(K) && inner3.slice(0, 10) === v.sel(EXTEND) && word(inner3, 0) === 3n && word(x3, 3) === 0n &&
    ds(inC(page, 3, "[data-act=extend]"), "spend") === "" && !!inC(page, 1, "[data-act=extend]") && ds(inC(page, 1, "[data-act=extend]"), "spend") === undefined,
    "the Reach's keepsake is changed through the Reach: execute(Keepsake, 0, extend(3, …), 0), the holder's to propose and, as every execute, a spending control", `fn ${fn(page)} inner ${inner3.slice(0, 10)}`);
  await dismiss(page);
  page.type(M(page, 1, "dsell"), "USDC"); page.type(M(page, 1, "dmkt"), "1"); page.type(M(page, 1, "dfloor"), "0.0004"); page.type(M(page, 1, "dmax"), "50");
  await press(page, card(page, 1).querySelector("[data-act=setDrip]"));
  const FLOOR = 4n * 10n ** 26n;
  ok(fn(page) === SETDRIP && slabCd(page) === lower(enc(SETDRIP, [1, [1, 1, FLOOR, 50n * U6]])) && line(page, "Terms") === `asset 1 · market #1 · floor ${FLOOR} per 1e18 · at most ${50n * U6}` &&
    page.text("#cslab [data-sentence]") === "on keepsake #1, anyone may sell its USDC as it frees, at most 50 USDC each time, into market #1, never below 0.0004 ETH per USDC; what it earns waits there for its holder",
    "a slow sale typed in human terms is found raw in the calldata: 0.0004 ETH per USDC is the floor 0.0004 × 10^18 × 1e18 / 10^6 = 4e26", `${line(page, "Terms")} | ${page.text("#cslab [data-sentence]")}`);
  await ready(page); await sign(page, W, ++sent);
  await page.until(() => /never below/.test(ctext(page, 1, ".drip")), 60);
  const d1 = (await view(1)).drip;
  ok(d1.join() === [1n, 1n, FLOOR, 50n * U6].join() && ctext(page, 1, ".drip") === "sells slowly, never below 0.0004 ETH per USDC · at most 50 USDC each time, in market #1" && !!inC(page, 1, "[data-act=clearDrip]"),
    "the slow sale is read back from the chain in the same words, and the holder may stop it", ctext(page, 1, ".drip"));
  page.type(M(page, 1, "memory"), "the first day of the long road");
  await press(page, card(page, 1).querySelector("[data-act=inscribe]"));
  const body = "0x" + Buffer.from("the first day of the long road", "utf8").toString("hex");
  ok(fn(page) === INSCRIBE && lower(page.text("#cslab [data-to]")) === lower(J) && slabCd(page) === lower(enc(INSCRIBE, [K, 1, 0, body, "0x" + "0".repeat(64)])) &&
    page.text("#cslab [data-sentence]") === "writes a memory into keepsake #1, public and for good: “the first day of the long road”",
    "a memory is written into the keepsake's own journal: inscribe(Keepsake, 1, a note, the text, 0)", page.text("#cslab [data-sentence]"));
  await ready(page); await sign(page, W, ++sent);
  const ins = (await c.getLogs({ address: J, topics: [S.topics.inscribed, "0x" + lower(K).slice(2).padStart(64, "0"), "0x" + "1".padStart(64, "0")] })).at(-1);
  const bodyOf = (d) => { const x = d.slice(2), o = Number(BigInt("0x" + x.substr(5 * 64, 64))) * 2; return Buffer.from(x.substr(o + 64, Number(BigInt("0x" + x.substr(o, 64))) * 2), "hex").toString("utf8"); };
  ok(decUint(await c.read(J, "countOf(address,uint256)", [K, 1])) === 1n && !!ins && bodyOf(ins.data) === "the first day of the long road" && lower("0x" + ins.data.slice(2 + 64 + 24, 2 + 128)) === lower(ME),
    "the Journal counts the keepsake's first memory, and its Inscribed log carries the words and names the holder as author", ins && bodyOf(ins.data));
  await page.until(() => !!M(page, 1, "give"), 60);
  page.type(M(page, 1, "give"), BUYER);
  await press(page, card(page, 1).querySelector("[data-act=give]"));
  ok(fn(page) === TRANSFER && lower(page.text("#cslab [data-to]")) === lower(K) && page.text('#cslab [data-arg="0"]') === cks(ME) && page.text('#cslab [data-arg="1"]') === cks(BUYER) && page.text('#cslab [data-arg="2"]') === "1" &&
    page.text("#cslab [data-sentence]") === `gives keepsake #1 to ${short(cks(BUYER))}: the keepsake and everything in it becomes theirs` && ds(inC(page, 1, "[data-act=give]"), "spend") === "",
    "a give is transferFrom(holder, recipient, id), and its sentence: the keepsake and everything in it becomes theirs", page.text("#cslab [data-sentence]"));
  await ready(page); await sign(page, W, ++sent);
  await page.until(() => !card(page, 1) && !!card(page, 3), 60);
  ok(await ownerOf(1) === lower(BUYER) && !card(page, 1) && page.text("#lane-vault #vault-keepsakes-status") === "1 held by this wallet or #1's Reach",
    "given, the keepsake leaves this wallet's list: ownerOf no longer names it", page.text("#lane-vault #vault-keepsakes-status"));
  ok(page.innerHTMLWrites === 0 && page.errors.length === 0, "nothing was assigned through innerHTML and no script threw on the keepsakes page", page.errors.map((e) => e.message).join("; "));
  page.close();

  t.head("V6 · the recipient's page, and the viewer");
  {
    const WB = walletFor(c, buyer);
    const { page: pb } = await bootToken(1, { wallet: WB });
    await lane(pb, "vault");
    await pb.until(() => !!card(pb, 2) && !!card(pb, 1) && LL(pb, "#vault-keepsakes-list .claimable").length === 3, 80);
    ok(ctext(pb, 2, ".note") === "“happy birthday”" && ctext(pb, 2).includes("a gift from " + short(cks(ME)) + " · held by you") && /^100 % free · fully free since/.test(ctext(pb, 2, ".free")) && !!inC(pb, 2, "[data-act=claim]") && !!inC(pb, 2, "details"),
      "the recipient finds the gift in their own list with its note and its giver, free to claim, and theirs to change", ctext(pb, 2).slice(0, 300));
    pb.close();
  }
  {
    const WV = walletFor(c, me);
    const { page: pv } = await bootToken(1, { opaque: true, wallet: WV });
    await lane(pv, "vault");
    await pv.until(() => !!card(pv, 3) && LL(pv, "#vault-keepsakes-list .claimable").length === 1, 80);
    /* W13: "reads the keepsakes" — the Reach's card and what it pays — was the wait's alone; the sentence now checks them */
    ok(pv.$("body").dataset.mode === "viewer" && !!card(pv, 3) && LL(pv, "#vault-keepsakes-list .claimable").length === 1 &&
      LL(pv, "[data-act]").length === 0 && !L(pv, "#vault-make") && LL(pv, "#vault-keepsakes details").length === 0 && WV.prompts().length === 0 && pv.errors.length === 0,
      "the viewer reads the keepsakes and offers no control: no form, no claim, no change", `acts ${LL(pv, "[data-act]").length}`);
    pv.close();
  }
  t.ok(V, "keepsakes: a bundle made with exact approvals, a gift, found from the logs, claimed, lengthened, sold slowly in human terms, remembered and given");
}
