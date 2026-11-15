(function () {
  var header = document.getElementById("site-header");
  var toggle = document.getElementById("menu-toggle");
  var nav = document.getElementById("nav-links");
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  function onScroll() {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 20);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function closeMenu() {
    document.body.classList.remove("menu-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  if (nav) {
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });
  }

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce && "IntersectionObserver" in window) {
    document.documentElement.classList.add("js");
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        seen.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".reveal").forEach(function (el) { seen.observe(el); });
  }

  var fab = document.querySelector(".fab");
  var contact = document.getElementById("contact");
  var hero = document.querySelector(".hero");
  if (fab && "IntersectionObserver" in window) {
    var hideForHero = false;
    var hideForContact = false;
    function syncFab() {
      fab.classList.toggle("hide", hideForHero || hideForContact);
    }
    if (hero) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { hideForHero = entry.isIntersecting && entry.intersectionRatio > 0.35; });
        syncFab();
      }, { threshold: [0, 0.35, 0.6] }).observe(hero);
    }
    if (contact) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { hideForContact = entry.isIntersecting; });
        syncFab();
      }, { threshold: 0.15 }).observe(contact);
    }
  }

  var lightbox = document.getElementById("lightbox");
  var lightboxImg = lightbox ? lightbox.querySelector("img") : null;
  var lightboxCap = lightbox ? lightbox.querySelector("p") : null;
  var frames = Array.prototype.slice.call(document.querySelectorAll(".g-open"));
  var frameIndex = 0;

  function showFrame(index) {
    if (!frames.length || !lightboxImg) return;
    frameIndex = (index + frames.length) % frames.length;
    var button = frames[frameIndex];
    lightboxImg.src = button.getAttribute("data-src");
    lightboxImg.alt = button.getAttribute("data-alt") || "";
    if (lightboxCap) lightboxCap.textContent = button.getAttribute("data-caption") || "";
  }

  function openLightbox(index) {
    if (!lightbox) return;
    showFrame(index);
    lightbox.classList.add("open");
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    var close = lightbox.querySelector(".lb-close");
    if (close) close.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("open");
    lightbox.hidden = true;
    document.body.style.overflow = "";
    if (lightboxImg) lightboxImg.removeAttribute("src");
  }

  frames.forEach(function (button, index) {
    button.addEventListener("click", function () { openLightbox(index); });
  });

  if (lightbox) {
    lightbox.querySelector(".lb-close").addEventListener("click", closeLightbox);
    lightbox.querySelector(".lb-prev").addEventListener("click", function () { showFrame(frameIndex - 1); });
    lightbox.querySelector(".lb-next").addEventListener("click", function () { showFrame(frameIndex + 1); });
    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeMenu();
      closeLightbox();
    }
    if (!lightbox || !lightbox.classList.contains("open")) return;
    if (event.key === "ArrowRight") showFrame(frameIndex + 1);
    if (event.key === "ArrowLeft") showFrame(frameIndex - 1);
  });

  var carousel = document.getElementById("gift-carousel");
  if (carousel) {
    var slides = Array.prototype.slice.call(carousel.querySelectorAll(".carousel-slide"));
    var dots = Array.prototype.slice.call(carousel.querySelectorAll(".carousel-dot"));
    var status = carousel.querySelector(".carousel-status");
    var pauseBtn = carousel.querySelector(".carousel-pause");
    var viewport = carousel.querySelector(".carousel-viewport");
    var index = 0;
    var timer = null;
    var paused = false;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var delay = parseInt(carousel.getAttribute("data-autoplay") || "7000", 10);

    function show(next, fromUser) {
      if (!slides.length) return;
      index = (next + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        var on = i === index;
        slide.classList.toggle("is-active", on);
        slide.setAttribute("aria-hidden", on ? "false" : "true");
        if (on) slide.removeAttribute("inert");
        else slide.setAttribute("inert", "");
      });
      dots.forEach(function (dot, i) {
        var on = i === index;
        dot.setAttribute("aria-selected", on ? "true" : "false");
        dot.tabIndex = on ? 0 : -1;
      });
      if (fromUser && status) status.textContent = "Testimonial " + (index + 1) + " of " + slides.length;
    }

    function stop() {
      if (timer) window.clearInterval(timer);
      timer = null;
    }

    function start() {
      if (paused || reduceMotion || slides.length < 2) return;
      stop();
      timer = window.setInterval(function () { show(index + 1, false); }, delay);
    }

    carousel.querySelector(".carousel-prev").addEventListener("click", function () {
      show(index - 1, true);
      start();
    });
    carousel.querySelector(".carousel-next").addEventListener("click", function () {
      show(index + 1, true);
      start();
    });
    dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () {
        show(i, true);
        start();
      });
    });
    if (pauseBtn) {
      pauseBtn.addEventListener("click", function () {
        paused = !paused;
        pauseBtn.setAttribute("aria-pressed", paused ? "true" : "false");
        pauseBtn.textContent = paused ? "Play" : "Pause";
        if (paused) stop();
        else start();
      });
    }
    carousel.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      event.stopPropagation();
      show(index + (event.key === "ArrowRight" ? 1 : -1), true);
      start();
    });
    carousel.addEventListener("mouseenter", stop);
    carousel.addEventListener("mouseleave", start);
    carousel.addEventListener("focusin", stop);
    carousel.addEventListener("focusout", function (event) {
      if (!carousel.contains(event.relatedTarget)) start();
    });
    if (viewport) {
      var startX = null;
      viewport.addEventListener("touchstart", function (event) {
        startX = event.changedTouches[0].clientX;
        stop();
      }, { passive: true });
      viewport.addEventListener("touchend", function (event) {
        if (startX == null) return;
        var dx = event.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) show(dx < 0 ? index + 1 : index - 1, true);
        startX = null;
        start();
      }, { passive: true });
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else start();
    });
    show(0, false);
    start();
  }

  var sticky = document.getElementById("gift-sticky");
  var quotePanel = document.getElementById("quote-panel");
  var quoteFinal = document.getElementById("quote-final");
  if (sticky) {
    var panelOn = true;
    var finalOn = false;
    var narrowQuery = window.matchMedia("(max-width: 800px)");
    function syncSticky() {
      var show = narrowQuery.matches && !panelOn && !finalOn;
      sticky.classList.toggle("is-hidden", !show);
    }
    if ("IntersectionObserver" in window) {
      if (quotePanel) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) { panelOn = entry.isIntersecting; });
          syncSticky();
        }, { threshold: 0.2 }).observe(quotePanel);
      } else {
        panelOn = false;
      }
      if (quoteFinal) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) { finalOn = entry.isIntersecting; });
          syncSticky();
        }, { threshold: 0.35 }).observe(quoteFinal);
      }
    }
    if (narrowQuery.addEventListener) narrowQuery.addEventListener("change", syncSticky);
    syncSticky();
  }
})();
