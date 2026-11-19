/* ==========================================================================
   Recorrido guiado — reduce la carga cognitiva y mantiene al visitante en
   un único objetivo de conversión. Sin dependencias, respeta movimiento
   reducido y permite saltar cada paso o cerrar en cualquier momento.
   ========================================================================== */
(function () {
  "use strict";

  var steps = [
    { id: "oferta",        label: "Paso 1 de 6", title: "Tu oferta y precio" },
    { id: "contenido-curso", label: "Paso 2 de 6", title: "Qué aprenderás" },
    { id: "calculadora",   label: "Paso 3 de 6", title: "Calcula tu precio" },
    { id: "evaluaciones",  label: "Paso 4 de 6", title: "Opiniones reales" },
    { id: "faq",           label: "Paso 5 de 6", title: "Resuelve tus dudas" },
    { id: "empezar",       label: "Paso 6 de 6", title: "Toma la decisión" }
  ];

  var startButtons = document.querySelectorAll("[data-tour-start]");
  if (!startButtons.length) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var current = -1;
  var bar = null;
  var focusedEl = null;

  function target(index) {
    return document.getElementById(steps[index].id);
  }

  function scrollTo(index) {
    var el = target(index);
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    // Ajuste por la barra fija superior para no tapar el título del paso.
    window.scrollBy(0, -72);
  }

  function highlight(index) {
    document.querySelectorAll(".tour-focus").forEach(function (el) {
      el.classList.remove("tour-focus");
    });
    var el = target(index);
    if (el) {
      el.classList.add("tour-focus");
      el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    }
  }

  function render() {
    var step = steps[current];
    bar.querySelector(".tour-label").textContent = step.label;
    bar.querySelector(".tour-title").textContent = step.title;
    bar.querySelector(".tour-progress").textContent = (current + 1) + " / " + steps.length;
    bar.querySelector(".tour-prev").disabled = current === 0;
    var next = bar.querySelector(".tour-next");
    next.textContent = current === steps.length - 1 ? "Terminar recorrido" : "Siguiente";
  }

  function go(index) {
    current = Math.max(0, Math.min(index, steps.length - 1));
    scrollTo(current);
    highlight(current);
    render();
  }

  function close() {
    if (!bar) return;
    bar.remove();
    bar = null;
    document.querySelectorAll(".tour-focus").forEach(function (el) {
      el.classList.remove("tour-focus");
      el.removeAttribute("tabindex");
    });
    document.body.style.paddingBlockEnd = "";
    if (focusedEl && focusedEl.isConnected && focusedEl.focus) focusedEl.focus();
    current = -1;
  }

  function open() {
    if (bar) { go(current); return; }
    focusedEl = document.activeElement;
    bar = document.createElement("div");
    bar.className = "tour-bar";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "Recorrido guiado de la página");
    bar.innerHTML =
      '<div><div class="tour-label"></div><div class="tour-title"></div></div>' +
      '<div class="tour-actions">' +
        '<button type="button" class="tour-prev">Anterior</button>' +
        '<button type="button" class="tour-next">Siguiente</button>' +
        '<button type="button" class="tour-close">Cerrar</button>' +
      '</div>' +
      '<div class="tour-progress"></div>';
    document.body.appendChild(bar);
    bar.querySelector(".tour-next").addEventListener("click", function () {
      if (current === steps.length - 1) close();
      else go(current + 1);
    });
    bar.querySelector(".tour-prev").addEventListener("click", function () { go(current - 1); });
    bar.querySelector(".tour-close").addEventListener("click", close);
    bar.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { event.preventDefault(); close(); }
    });
    go(0);
  }

  startButtons.forEach(function (button) {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      open();
    });
  });
})();
