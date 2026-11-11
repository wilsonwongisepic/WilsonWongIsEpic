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
})();
