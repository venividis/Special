/* INTACT placeholder panel "vault" (U7 fixture). The real lane is engine/panels/vault.js (U9).
   A panel is injected as a Blob script only after the shell has keccak'd its
   inflated bytes against window.INTACT.panels.vault. It reads the state block and
   renders through textContent; it never calls eth_requestAccounts. */
(function () {
  var S = window.INTACT;
  if (!S || !S.panels) return;
  var host = document.getElementById("lane-vault");
  if (!host) return;
  var p = document.createElement("p");
  p.textContent = "vault lane placeholder for INTACT #" + S.id + " at custody epoch " + S.epoch + " (" + Object.keys(S.sel).length + " selectors on chain)";
  host.appendChild(p);
  S.loaded = S.loaded || {};
  S.loaded["vault"] = true;
})();
