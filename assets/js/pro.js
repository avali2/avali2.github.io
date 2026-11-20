/* ==========================================================================
   Widget de dudas (portada). Sin dependencias: contacto real y accesible.
   ========================================================================== */
(function () {
  "use strict";

  var fab = document.querySelector(".support-fab");
  var panel = document.querySelector(".support-panel");
  if (!fab || !panel) return;

  var closeBtn = panel.querySelector(".close");

  function open() {
    panel.classList.add("is-open");
    fab.setAttribute("aria-expanded", "true");
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    panel.classList.remove("is-open");
    fab.setAttribute("aria-expanded", "false");
    fab.focus();
  }

  fab.addEventListener("click", function () {
    if (panel.classList.contains("is-open")) close();
    else open();
  });

  if (closeBtn) closeBtn.addEventListener("click", close);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && panel.classList.contains("is-open")) close();
  });

  document.addEventListener("click", function (event) {
    if (!panel.classList.contains("is-open")) return;
    if (panel.contains(event.target) || fab.contains(event.target)) return;
    close();
  });
})();
