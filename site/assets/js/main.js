/* Group 6 ecosystems site: small progressive enhancements. Everything works without JS. */
(function () {
  'use strict';

  /* Mobile navigation toggle */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* Chapter rail: highlight the chapter currently in view */
  var rail = document.querySelector('.rail');
  if (rail && 'IntersectionObserver' in window) {
    var links = Array.prototype.slice.call(rail.querySelectorAll('a[href^="#"]'));
    var map = {};
    links.forEach(function (a) {
      var el = document.getElementById(a.getAttribute('href').slice(1));
      if (el) map[el.id] = a;
    });
    var visible = {};
    var setCurrent = function (id) {
      links.forEach(function (a) { a.removeAttribute('aria-current'); });
      var a = map[id];
      if (!a) return;
      a.setAttribute('aria-current', 'true');
      if (window.matchMedia('(max-width: 1000px)').matches) {
        var r = a.getBoundingClientRect();
        var rr = rail.getBoundingClientRect();
        if (r.left < rr.left || r.right > rr.right) rail.scrollBy({ left: r.left - rr.left - 24, behavior: 'smooth' });
      }
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting ? en.boundingClientRect.top : undefined; });
      var best = null; var bestTop = -Infinity;
      Object.keys(visible).forEach(function (id) {
        var t = visible[id];
        if (t === undefined) return;
        if (t <= window.innerHeight * 0.4 && t > bestTop) { bestTop = t; best = id; }
      });
      if (!best) {
        var firstTop = Infinity;
        Object.keys(visible).forEach(function (id) { var t = visible[id]; if (t !== undefined && t < firstTop) { firstTop = t; best = id; } });
      }
      if (best) setCurrent(best);
    }, { rootMargin: '-80px 0px -40% 0px', threshold: [0, 0.01] });
    Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
  }

  /* Chart tooltips (hover and keyboard focus) */
  var tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'status');
  tip.setAttribute('aria-live', 'polite');
  document.body.appendChild(tip);
  var place = function (x, y) {
    var w = tip.offsetWidth; var h = tip.offsetHeight;
    var left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 14));
    var top = y - h - 12 < 8 ? y + 18 : y - h - 12;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  };
  var show = function (el, x, y) {
    tip.innerHTML = el.getAttribute('data-tip');
    tip.classList.add('is-on');
    place(x, y);
  };
  var hide = function () { tip.classList.remove('is-on'); };
  document.querySelectorAll('[data-tip]').forEach(function (el) {
    el.addEventListener('pointermove', function (e) { show(el, e.clientX, e.clientY); });
    el.addEventListener('pointerleave', hide);
    el.addEventListener('focus', function () { var r = el.getBoundingClientRect(); show(el, r.left + r.width / 2, r.top + 20); });
    el.addEventListener('blur', hide);
  });
  window.addEventListener('scroll', hide, { passive: true });

  /* Graceful image fallback: if a photo fails to load, show its description and credit instead */
  var fallback = function (img) {
    var fig = img.closest('.photo');
    if (!fig || fig.classList.contains('is-broken')) return;
    fig.classList.add('is-broken');
    var frame = fig.querySelector('.photo__frame') || fig;
    var p = document.createElement('p');
    p.className = 'img-fallback';
    p.textContent = 'Image unavailable: ' + (img.getAttribute('alt') || 'photograph');
    frame.appendChild(p);
  };
  document.querySelectorAll('img').forEach(function (img) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fallback(img);
    img.addEventListener('error', function () { fallback(img); });
  });
  var heroImg = document.querySelectorAll('.hero__media img, .landing-hero__panel img');
  heroImg.forEach(function (img) {
    img.addEventListener('error', function () { img.style.display = 'none'; });
  });
})();
