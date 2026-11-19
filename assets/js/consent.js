/* ==========================================================================
   Consentimiento de cookies + carga diferida del píxel de Meta
   --------------------------------------------------------------------------
   Nada de terceros se carga hasta que la persona acepta. El píxel de Meta
   solo se inicializa con "Aceptar". La elección se recuerda en localStorage.
   ========================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "vjl-consent-v1";
  var PIXEL_ID = "1424136109626344";
  var choice = null;

  try {
    choice = window.localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    choice = null;
  }

  /* -------- cola segura: fbq existe siempre, aunque no cargue el píxel ---- */
  if (typeof window.fbq !== "function") {
    var queue = [];
    var stub = function () {
      queue.push(arguments);
    };
    stub.queue = queue;
    stub.loaded = false;
    stub.version = "2.0";
    window.fbq = stub;
    window._fbq = stub;
  }

  function loadPixel() {
    if (window.__vjlPixelLoaded) return;
    window.__vjlPixelLoaded = true;

    /* eslint-disable */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq && f.fbq.loaded) return;
      n = f.fbq = f.fbq || function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */

    window.fbq("init", PIXEL_ID);
    window.fbq("track", "PageView");

    // eventos que se hayan quedado en cola
    try {
      (window.fbq.queue || []).forEach(function () {});
    } catch (e) {}
  }

  // enlace para cambiar de opinión desde la política de privacidad
  // (se define siempre, incluso si ya se había aceptado)
  window.vjlOpenConsent = function () {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    choice = null;
    open();
  };

  if (choice === "all") {
    loadPixel();
    return;
  }

  /* --------------------------------- UI ---------------------------------- */
  function buildBanner() {
    var el = document.createElement("div");
    el.className = "consent";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Preferencia de cookies");
    el.innerHTML =
      '<div class="consent-in">' +
        '<p>Usamos cookies propias y de terceros (Meta, Hotmart, Amazon) para medir visitas y compras. ' +
        'Puedes seguir leyendo con lo estrictamente necesario. <a href="privacidad.html">Más detalles</a>.</p>' +
        '<div class="consent-actions">' +
          '<button type="button" class="reject">Solo lo necesario</button>' +
          '<button type="button" class="accept">Aceptar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  function open() {
    if (document.querySelector(".consent")) return;
    var el = buildBanner();
    document.body.classList.add("consent-open");
    el.classList.add("is-open");

    el.querySelector(".accept").addEventListener("click", function () {
      try { window.localStorage.setItem(STORAGE_KEY, "all"); } catch (e) {}
      loadPixel();
      close(el);
    });

    el.querySelector(".reject").addEventListener("click", function () {
      try { window.localStorage.setItem(STORAGE_KEY, "essential"); } catch (e) {}
      close(el);
    });
  }

  function close(el) {
    el.classList.remove("is-open");
    document.body.classList.remove("consent-open");
    window.setTimeout(function () { el.remove(); }, 250);
  }

  // pequeño retraso: no competir con el primer render
  window.setTimeout(open, 1200);
})();
