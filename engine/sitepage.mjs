/*───────────────────────────────────────────────────────────────────────────
  INTACT · the Studio's default site, one source (W12-8, W15)

  The page template the Studio lane offers by default: `name` is the
  collection's, written into the template as escaped text before the
  launch (the holes carry values, never markup, so the name is the
  creator's own bytes); everything else is a hole the Collection fills per
  token. The page reads with no script; its one script colours the orb from
  the seed and prints this token's persona, the `via` a mint through the
  page should name.

  W4 wrote it in tools/verify-studio.mjs and W12 lifted it into the launch
  panel byte for byte; this module is the one copy both read.
  tools/build-app.mjs inlines it into a panel at a marker line — a block
  comment holding `@inline engine/sitepage.mjs` — with `export` stripped,
  as it inlines engine/whispers.mjs into the social panel, and the suites
  import it.
───────────────────────────────────────────────────────────────────────────*/
export function sitePage(name) {
  const text = String(name).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${text} #{{id}}</title>
<style>
:root{color-scheme:dark;--a:266;--b:146}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;color:#f4f1ff;font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;background:radial-gradient(90% 70% at 50% 0%,hsl(var(--a) 45% 14%),#05040a 70%)}
main{width:min(92vw,560px);padding:28px 0 40px;text-align:center}
.orb{width:min(78vw,380px);aspect-ratio:1;margin:0 auto 22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,hsl(var(--b) 90% 82%),hsl(var(--a) 75% 58%) 55%,hsl(var(--a) 70% 22%));box-shadow:0 0 90px hsl(var(--a) 80% 55%/.45),inset -18px -24px 60px rgba(0,0,0,.35);animation:breathe 6s ease-in-out infinite}
@keyframes breathe{50%{transform:scale(1.025)}}
@media (prefers-reduced-motion:reduce){.orb{animation:none}}
h1{margin:0;font-size:clamp(28px,7vw,40px);letter-spacing:-.01em}
h1 small{font-weight:400;opacity:.6;font-size:.55em}
.facts{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:22px auto;text-align:left;font-size:13px}
.facts dt{color:rgba(236,232,255,.6)}
.facts dd{margin:0;font-family:ui-monospace,Menlo,monospace;word-break:break-all}
.mint{margin-top:18px;padding:18px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);text-align:left}
.mint h2{margin:0 0 6px;font-size:17px}
.mint p{margin:6px 0;font-size:13px;color:rgba(236,232,255,.75)}
code{font-family:ui-monospace,Menlo,monospace;font-size:12px;word-break:break-all;color:#b9f6ea}
footer{margin-top:18px;font-size:11px;color:rgba(236,232,255,.4);word-break:break-all}
</style></head><body><main>
<div class="orb" id="orb" role="img" aria-label="${text} #{{id}}"></div>
<h1 id="title">#{{id}} <small>of {{supply}}</small></h1>
<dl class="facts">
<dt>Held by</dt><dd id="holder">{{holder}}</dd>
<dt>Memories</dt><dd id="memories">{{memories}}</dd>
<dt>Custody epoch</dt><dd>{{epoch}}</dd>
<dt>Minted</dt><dd>{{minted}} of {{supply}}</dd>
<dt>Room</dt><dd id="room">{{room}}</dd>
</dl>
<section class="mint"><h2>Mint yours</h2>
<p>{{price}} wei on chain {{chain}}: call <code>mint(to, via)</code> on <code>{{collection}}</code> with <code>via</code> = <code id="via">{{collection}} &lt;&lt; 96 | {{id}}</code>, and this token is paid its share of your mint.</p>
</section>
<footer>${text}, served by {{collection}} from chain {{chain}}; launched by token {{creator}}; seed {{seed}}</footer>
</main>
<script>
(()=>{const s="{{seed}}",c="{{collection}}",i="{{id}}",r=document.documentElement.style;
const a=parseInt(s.slice(2,4),16)*360>>8,b=(a+60+parseInt(s.slice(4,6),16)%120)%360;
r.setProperty("--a",a);r.setProperty("--b",b);
document.getElementById("via").textContent=((BigInt(c)<<96n)|BigInt(i)).toString()})()
</script>
</body></html>
`;
}
