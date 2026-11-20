/* ==========================================================================
   Velas y Jabones con Lia — interacciones (sin dependencias)
   ========================================================================== */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;

  // Marca que hay JS: las animaciones de entrada solo se aplican con JS activo.
  root.classList.add("js");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------- menú móvil --- */
  var navInput = doc.getElementById("nav-open");
  var nav = doc.getElementById("nav");
  var navToggle = doc.querySelector(".nav-toggle");

  // El checkbox mantiene un menú funcional sin JS; con JS usamos un botón real.
  function syncNavState() {
    var open = !!(navInput && navInput.checked);
    if (navToggle) {
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.textContent = open ? "Cerrar" : "Menú";
    }
    if (doc.body) doc.body.classList.toggle("nav-open", open);
  }

  if (navInput && navToggle) {
    var menuButton = doc.createElement("button");
    menuButton.type = "button";
    menuButton.className = "nav-toggle";
    menuButton.textContent = "Menú";
    menuButton.setAttribute("aria-controls", "nav");
    menuButton.setAttribute("aria-expanded", "false");
    navToggle.replaceWith(menuButton);
    navToggle = menuButton;
    navInput.tabIndex = -1;
    navInput.setAttribute("aria-hidden", "true");
    navToggle.addEventListener("click", function () {
      navInput.checked = !navInput.checked;
      syncNavState();
    });
  }

  function closeNav() {
    if (navInput) navInput.checked = false;
    syncNavState();
  }

  if (navInput) {
    navInput.addEventListener("change", syncNavState);

    if (nav) {
      nav.addEventListener("click", function (e) {
        if (e.target.closest("a")) closeNav();
      });
      nav.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          closeNav();
          if (navToggle) navToggle.focus();
        }
      });
    }

    doc.addEventListener("click", function (e) {
      if (!navInput.checked) return;
      if (e.target.closest(".topbar")) return;
      closeNav();
    });

    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });
  }

  /* ------------------------------------------- menú: enlace de sección activo --- */
  // Solo actúa en páginas donde la navegación apunta a anclas de esta misma
  // página (por ejemplo la portada). En el resto no cambia nada.
  var sectionLinks = nav
    ? Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'))
    : [];
  var spyTargets = sectionLinks.map(function (link) {
    var id = link.getAttribute("href").slice(1);
    return { link: link, el: id ? doc.getElementById(id) : null };
  }).filter(function (item) { return item.el; });

  if (spyTargets.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        spyTargets.forEach(function (item) {
          item.link.classList.toggle("is-active", item.el === entry.target);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    spyTargets.forEach(function (item) { spy.observe(item.el); });
  }

  /* ------------------------------------------- menú desplegable "Cursos" --- */
  var navMenus = doc.querySelectorAll(".nav-menu");
  if (navMenus.length) {
    navMenus.forEach(function (menu) {
      var btn = menu.querySelector(".nav-drop");
      if (!btn) return;
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        var open = !menu.classList.contains("is-open");
        navMenus.forEach(function (m) { m.classList.remove("is-open"); });
        if (open) menu.classList.add("is-open");
        btn.setAttribute("aria-expanded", String(open));
      });
    });
    doc.addEventListener("click", function () {
      navMenus.forEach(function (m) { m.classList.remove("is-open"); });
    });
    doc.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        navMenus.forEach(function (m) { m.classList.remove("is-open"); });
      }
    });
  }

  /* -------------------------------------------------------- animar entrada --- */
  var reveals = doc.querySelectorAll(".reveal");
  if (reveals.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      reveals.forEach(function (el) { el.classList.add("is-in"); });
    } else {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            revealObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
      reveals.forEach(function (el) { revealObserver.observe(el); });
    }
  }

  /* ------------------------------------------------------------ contadores --- */
  var counters = doc.querySelectorAll("[data-count]");
  if (counters.length) {
    var runCounter = function (el) {
      var target = parseFloat(el.getAttribute("data-count"));
      var suffix = el.getAttribute("data-suffix") || "";
      var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);

      if (reduceMotion || isNaN(target)) {
        el.textContent = format(target) + suffix;
        return;
      }

      var duration = 1100;
      var start = null;

      function format(value) {
        if (decimals > 0) {
          return value.toFixed(decimals).replace(".", ",");
        }
        return Math.round(value).toLocaleString("es-ES");
      }

      function step(now) {
        if (start === null) start = now;
        var progress = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = format(target * eased) + suffix;
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = format(target) + suffix;
      }

      requestAnimationFrame(step);
    };

    if (!("IntersectionObserver" in window)) {
      counters.forEach(runCounter);
    } else {
      var counterObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            runCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { counterObserver.observe(el); });
    }
  }

  /* ------------------------------------------------------------- barra fija --- */
  var sticky = doc.querySelector(".sticky-buy");
  if (sticky && "IntersectionObserver" in window) {
    var watch = doc.querySelectorAll("[data-sticky-anchor]");
    var visible = new Set();

    var sync = function () {
      var show = visible.size === 0;
      sticky.classList.toggle("is-visible", show);
      sticky.inert = !show;
      sticky.setAttribute("aria-hidden", String(!show));
    };

    var stickyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      sync();
    }, { threshold: 0.55 });

    watch.forEach(function (el) { stickyObserver.observe(el); });
    sync();
  } else if (sticky) {
    sticky.classList.add("is-visible");
  }

  /* ------------------------------------------------------- vídeo con póster --- */
  doc.querySelectorAll("[data-video]").forEach(function (shell) {
    var button = shell.querySelector(".video-play");
    var video = shell.querySelector("video");
    if (!button || !video) return;

    button.addEventListener("click", function () {
      var source = video.getAttribute("data-src");
      if (source && !video.querySelector("source")) {
        var s = doc.createElement("source");
        s.src = source;
        s.type = "video/mp4";
        video.appendChild(s);
        video.load();
      }
      video.setAttribute("controls", "controls");
      shell.classList.add("is-playing");
      button.hidden = true;
      video.focus();
      var play = video.play();
      if (play && typeof play.catch === "function") play.catch(function () {
        // Los controles nativos y el enlace directo permiten reintentar.
        video.setAttribute("controls", "controls");
      });
    });
  });

  /* ------------------------------------------------------------ año actual --- */
  doc.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
