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

  function closeNav() {
    if (navInput && navInput.checked) {
      navInput.checked = false;
    }
  }

  if (navInput) {
    navInput.addEventListener("change", function () {
      if (navToggle) {
        navToggle.setAttribute("aria-expanded", navInput.checked ? "true" : "false");
      }
    });

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
      sticky.classList.toggle("is-visible", visible.size === 0);
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
      button.remove();
      var play = video.play();
      if (play && typeof play.catch === "function") play.catch(function () {});
    });
  });

  /* ------------------------------------------------------------ año actual --- */
  doc.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
