/* INTACT placeholder panel "identity" (U7 fixture). The real lane is engine/panels/identity.js (U9).
   A panel is injected as a Blob script only after the shell has keccak'd its
   inflated bytes against window.INTACT.panels.identity. It reads the state block and
   renders through textContent; it never calls eth_requestAccounts. */
(function () {
  var S = window.INTACT;
  if (!S || !S.panels) return;
  var host = document.getElementById("lane-identity");
  if (!host) return;
  var p = document.createElement("p");
  p.textContent = "identity lane placeholder for INTACT #" + S.id + " at custody epoch " + S.epoch + " (" + Object.keys(S.sel).length + " selectors on chain)";
  host.appendChild(p);
  S.loaded = S.loaded || {};
  S.loaded["identity"] = true;
})();
