/* Consentimiento de Meta. Los enlaces externos funcionan con cualquier elección.
   No se crea fbq, se carga Meta ni se guardan eventos antes de aceptar. */
(function () {
  "use strict";

  var STORAGE_KEY = "vjl-consent-v1";
  var PIXEL_ID = "1424136109626344";
  var choice = null;
  var storageAvailable = true;
  var pixel = null;
  var sendingEvent = false;
  var banner = null;
  var previousFocus = null;
  var sources = /^(LANDNAV10|LANDFINAL|LANDOFERTA|LANDGUIAS|LANDVSL1|LANDVSLSTICKY|LANDBIEN1|GUIDAVENDER|GUIDACOSTO|LANDKIT1|LANDVELAS[123]|LANDHERO|LANDSTICKY|VITRINA3X1|VITRINASTORE|VITRINACALC|CALCLAND1|CALCSTICKY)$/;

  try {
    choice = window.localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    storageAvailable = false;
  }
  if (choice !== "all" && choice !== "essential") choice = null;

  function isEvent(command) {
    return typeof command === "string" && command.indexOf("track") === 0;
  }

  function emit(command, name, params) {
    if (choice !== "all" || !pixel) return false;
    sendingEvent = true;
    try {
      pixel(command, name, params);
      return true;
    } catch (e) {
      // Un bloqueador o fallo de Meta no debe impedir navegar ni elegir.
      return false;
    } finally {
      sendingEvent = false;
    }
  }

  function loadPixel() {
    if (pixel) {
      pixel("consent", "grant");
      return;
    }

    // Bootstrap compatible con Meta: consulta la cola ACTUAL y callMethod.
    // La puerta de eventos también neutraliza antiguos listeners inline que
    // llaman a fbq('track', 'InitiateCheckout'/'Lead') por un simple clic.
    var n = function () {
      if (isEvent(arguments[0]) && (choice !== "all" || !sendingEvent)) return;
      if (n.callMethod) n.callMethod.apply(n, arguments);
      else n.queue.push(arguments);
    };
    pixel = n;
    window.fbq = n;
    window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];

    n("consent", "grant");
    // Sin detección automática de botones/formularios ni conversiones inferidas.
    n("set", "autoConfig", false, PIXEL_ID);
    n("init", PIXEL_ID);
    emit("track", "PageView");

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    (document.head || document.body).appendChild(script);
  }

  function revokePixel() {
    if (!pixel) return;
    // Si el SDK aún está descargándose, no dejar visitas/clics pendientes que
    // pueda reproducir después de retirar el permiso. Conservar configuración.
    pixel.queue = (pixel.queue || []).filter(function (args) {
      return !isEvent(args[0]) && !(args[0] === "consent" && args[1] === "grant");
    });
    pixel("consent", "revoke");
  }

  function saveChoice(next) {
    choice = next; // La decisión funciona en esta página incluso sin storage.
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      storageAvailable = false;
      // Evitar conservar una aceptación antigua si falla la escritura.
      try { window.localStorage.removeItem(STORAGE_KEY); } catch (ignored) {}
    }
    try {
      if (choice === "all") loadPixel();
      else revokePixel();
    } catch (e) {
      // El consentimiento local manda aunque el SDK falle.
    }
  }

  function pagePath() {
    // Solo rutas públicas conocidas, sin query/hash, IDs ni segmentos privados.
    var name = window.location.pathname.split("/").pop();
    return /^(index|vsl|guias|bienestar|guia-vender-jabones|guia-costo-velas|curso-primeros-jabones|curso-jabones-navidenas|kit|privacidad|terminos|sobre|tienda|calculadora)\.html$/.test(name)
      ? "/" + name : "/";
  }

  function cleanParams(params) {
    params = params && typeof params === "object" ? params : {};
    var result = { pathname: pagePath() };
    if (typeof params.placement === "string" && /^(nav|hero|sticky|footer|content|link|final|video|reviews|offer)$/.test(params.placement)) {
      result.placement = params.placement;
    }
    if (typeof params.src === "string" && sources.test(params.src)) result.src = params.src;
    // Nunca recibir una URL completa, query, correo o credenciales como destino.
    if (typeof params.destination === "string" && params.destination.length <= 253 &&
        /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(params.destination)) {
      result.destination = params.destination.toLowerCase();
    }
    return result;
  }

  window.vjlTrack = function (name, params) {
    // Sin cola preconsent ni nombres de conversiones que un clic no demuestra.
    if (choice !== "all" || typeof name !== "string" ||
        !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name) ||
        /^(Purchase|InitiateCheckout|Lead)$/i.test(name)) return false;
    return emit("trackCustom", name, cleanParams(params));
  };

  function outboundClick(event) {
    if (choice !== "all" || event.defaultPrevented ||
        (event.type === "auxclick" && event.button !== 1)) return;
    var target = event.target;
    if (target && target.nodeType === 3) target = target.parentElement;
    var link = target && target.closest ? target.closest("a[href]") : null;
    if (!link) return;
    var destination;
    try { destination = new URL(link.getAttribute("href"), window.location.href); }
    catch (e) { return; }
    if (!/^https?:$/.test(destination.protocol) || destination.origin === window.location.origin) return;
    var host = destination.hostname.toLowerCase();
    var course = host === "go.hotmart.com" || host === "pay.hotmart.com" ||
      ((host === "hotmart.com" || host === "www.hotmart.com") && link.hasAttribute("data-hotmart"));
    var affiliate = course || /(^|\s)sponsored(\s|$)/i.test(link.getAttribute("rel") || "") ||
      /^(www\.)?(amazon\.com|amzn\.to|temu\.com|temu\.to)$/.test(host);
    if (!affiliate) return;
    var placement = link.getAttribute("data-placement");
    if (!/^(nav|hero|sticky|footer|content|link|final|video|reviews|offer)$/.test(placement)) {
      placement = link.closest(".sticky-buy") ? "sticky" :
        link.closest("nav, .topbar") ? "nav" :
        link.closest("footer") ? "footer" :
        link.classList.contains("cta--hero") ? "hero" : "content";
    }
    window.vjlTrack(course ? "CourseOutboundClick" : "AffiliateOutboundClick", {
      placement: placement,
      src: destination.searchParams.get("src"),
      destination: host
    });
    // No modificar href: nunca propagar los parámetros de la visita al afiliado.
  }
  document.addEventListener("click", outboundClick);
  document.addEventListener("auxclick", outboundClick);

  function close() {
    if (!banner) return;
    banner.remove();
    banner = null;
    document.body.classList.remove("consent-open");
    if (previousFocus && previousFocus.isConnected && previousFocus.focus) previousFocus.focus();
    previousFocus = null;
  }

  function open(manual) {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", open, { once: true });
      return;
    }
    if (banner) {
      if (manual !== false) banner.querySelector(".reject").focus();
      return;
    }
    previousFocus = manual !== false ? document.activeElement : null;
    banner = document.createElement("div");
    banner.className = "consent is-open";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Preferencias de medición con Meta");
    banner.setAttribute("aria-describedby", "vjl-consent-description");
    banner.innerHTML =
      '<div class="consent-in">' +
        '<div><p id="vjl-consent-description"><strong>Tu privacidad importa.</strong> Solo si aceptas, ' +
        'Meta (Facebook) medirá visitas y clics mediante cookies y datos técnicos. ' +
        'Rechazar no bloquea cursos ni compras. Puedes cambiar tu decisión en ' +
        '<a href="privacidad.html">Privacidad y cookies</a>.</p>' +
        '<p class="storage-note"></p></div>' +
        '<div class="consent-actions">' +
          '<button type="button" class="reject">Rechazar Meta</button>' +
          '<button type="button" class="accept">Aceptar Meta</button>' +
          '<button type="button" class="dismiss">Cerrar sin cambiar</button>' +
        '</div>' +
      '</div>';
    if (!storageAvailable) {
      banner.querySelector(".storage-note").textContent =
        "Tu navegador no permite guardar la elección; se aplicará solo en esta página.";
    }
    document.body.appendChild(banner);
    document.body.classList.add("consent-open");
    banner.querySelector(".accept").addEventListener("click", function () {
      saveChoice("all");
      close();
    });
    banner.querySelector(".reject").addEventListener("click", function () {
      saveChoice("essential");
      close();
    });
    banner.querySelector(".dismiss").addEventListener("click", close);
    banner.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    });
    // El aviso automático no interrumpe el foco mientras alguien lee o compra.
    if (manual !== false) banner.querySelector(".reject").focus();
  }

  // Reabrir NO borra ni altera la elección; solo los botones deciden.
  window.vjlOpenConsent = function () { open(true); };
  if (choice === "all") loadPixel();
  else if (choice === null) {
    window.setTimeout(function () { if (choice === null) open(false); }, 1600);
  }
})();
