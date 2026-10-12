/*  INTACT panel "agent" — a stub until U17. Injected as a Blob script after
    the shell keccak'd these bytes against window.INTACT.panels.agent. One
    IIFE, nothing at top level (terser mangles the shell's top level to
    one-letter names; a top-level const here would collide and the panel
    would never run — E §3.4; the build refuses one). Every text node
    through textContent. There is no write on this lane: the agent surface
    (the AgentCard, the executeAsSession composer, llms.txt) arrives with
    U17, and until then this lane says where the three things an agent
    needs already are — the catalogue at /services.json, a session granted
    in the Vault, and the key's own door at /k/<id>/<key>, which boots this
    document in session mode (CONSOLE §11). In session mode the lane adds
    the one read a key can make for itself before U17: whether its grant
    allows a target and a selector, through reach.sessionAllows. */
(function () {
  var S = window.INTACT, ui = S && S.ui;
  if (!ui) return;
  ui.ready.then(function () {
    var host = ui.host("agent");
    ui.rows({ "reach.sessionOf": "sessionOf(address)", "reach.sessionExposure": "sessionExposure(address)",
              "reach.sessionAllows": "sessionAllows(address,address,bytes4)", "catalog.services": "services()" });
    function paint() {
      host.replaceChildren();
      var p = ui.el("p", "blurb");
      p.id = "agent-stub";
      p.textContent = "the agent lane arrives with U17; until then: the catalogue is /services.json, sessions are granted in the Vault, and a key opens /k/<id>/<key>; no executeAsSession composer until U17.";
      host.appendChild(p);
      if (ui.mode() === "session") {
        var key = new URLSearchParams(location.search).get("as");
        ui.note(host, "this page acts as key " + key + "; the grant's terms are on Home");
        var box = ui.el("div");
        var to = ui.field(box, "target", "0x…");
        var sel = ui.field(box, "selector", "0x12345678");
        var out = ui.note(box, "", "s");
        ui.button(box, "may this key call it?", true, function () {
          out.textContent = "reading…";
          if (!ui.isAddr(to.value) || !/^0x[0-9a-fA-F]{8}$/.test(sel.value)) { out.textContent = "an address and a four-byte selector"; return; }
          ui.read(S.reach, "reach.sessionAllows", [key, to.value, sel.value]).then(function (r) {
            out.textContent = r.b(0) ? "allowed by the grant" : "not allowed by the grant";
          }, function (e) { out.textContent = "not reported: " + e.message; });
        });
        host.appendChild(box);
      }
      S.loaded.agent = true;
    }
    paint();
    window.addEventListener("intact:rights", paint);
    window.addEventListener("intact:lane", function (e) { if (e.detail && e.detail.name === "agent") paint(); });
  }).catch(function (e) { ui.say("this lane failed to open: " + (e && e.message), "err"); });
})();
