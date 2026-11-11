/* Trapani Salon — comportamiento.
   Todo el contenido está en index.html; este archivo solo añade movimiento e interacción.
   Principios: respuesta inmediata, seguimiento 1:1, muelles interrumpibles con traspaso
   de velocidad, proyección de impulso y orígenes anclados. Cada parte está aislada. */
(function () {
  "use strict";

  var B = window.__BRAND__ || {};
  var d = document, html = d.documentElement;
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var mqDesk = matchMedia("(min-width: 960px)");
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var autoplayOK = !reduced && !saveData;

  function safe(fn, name) { try { fn(); } catch (e) { console.warn("[" + name + "]", e); } }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeIO(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function pageTop(el) { var r = el.getBoundingClientRect(); return r.top + window.pageYOffset; }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function playSafe(v) { if (!v) return; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  function scrollToY(y) { window.scrollTo({ top: y, behavior: "instant" }); }

  /* Resistencia progresiva en los bordes */
  function rubberband(over, dim, c) { c = c || 0.55; return (over * dim * c) / (dim + c * Math.abs(over)); }
  /* Punto de reposo proyectado a partir de la velocidad (px/s) */
  function project(v, rate) { rate = rate || 0.998; return (v / 1000) * rate / (1 - rate); }

  /* Historial corto de posiciones para calcular la velocidad al soltar */
  function Tracker() { this.h = []; }
  /* Usa la hora real de cada evento (e.timeStamp), no la de proceso: si el equipo va cargado
     y los eventos llegan agrupados, la velocidad sigue siendo la del dedo */
  Tracker.prototype.reset = function (e) { this.h = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }]; };
  Tracker.prototype.add = function (e) {
    var t = e.timeStamp; this.h.push({ x: e.clientX, y: e.clientY, t: t });
    while (this.h.length > 2 && t - this.h[0].t > 90) this.h.shift();
  };
  Tracker.prototype.velocity = function (e) {
    var h = this.h; if (h.length < 2) return { x: 0, y: 0 };
    var a = h[0], b = h[h.length - 1], dt = (b.t - a.t) / 1000;
    /* Si el dedo se quedó quieto antes de soltar, no hay impulso */
    if (dt <= 0.004 || (e && e.timeStamp - b.t > 80)) return { x: 0, y: 0 };
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
  };

  /* ---------------------------------------------------------------
     Muelles: amortiguación + respuesta (en segundos), como en iOS.
     Se pueden redirigir en cualquier momento conservando la velocidad.
     --------------------------------------------------------------- */
  var springs = [], springRaf = 0, lastT = 0, idle = true;
  function Spring(o) {
    o = o || {};
    this.x = o.x || 0; this.v = 0; this.target = this.x;
    this.damping = o.damping == null ? 1 : o.damping;
    this.response = o.response || 0.4;
    this.precision = o.precision || 0.01;
    this.render = o.render || null;
    this.done = null;
  }
  Spring.prototype.set = function (damping, response) { this.damping = damping; this.response = response; return this; };
  Spring.prototype.to = function (target, v, done) {
    this.target = target;
    if (v != null) this.v = v;
    this.done = done || null;
    if (springs.indexOf(this) < 0) springs.push(this);
    kick();
    return this;
  };
  Spring.prototype.snap = function (x) { this.x = this.target = x; this.v = 0; this.stop(); return this; };
  Spring.prototype.stop = function () { var i = springs.indexOf(this); if (i > -1) springs.splice(i, 1); this.done = null; return this; };
  Spring.prototype.moving = function () { return springs.indexOf(this) > -1; };
  Spring.prototype.step = function (dt) {
    var w = 2 * Math.PI / this.response, k = w * w, c = 2 * this.damping * w;
    var n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (var i = 0; i < n; i++) {
      var a = -k * (this.x - this.target) - c * this.v;
      this.v += a * h; this.x += this.v * h;
    }
    if (Math.abs(this.x - this.target) < this.precision && Math.abs(this.v) < this.precision * 12) {
      this.x = this.target; this.v = 0; return false;
    }
    return true;
  };
  function kick() {
    if (springRaf || !springs.length) return;
    if (idle) { lastT = performance.now(); idle = false; }
    springRaf = requestAnimationFrame(springFrame);
  }
  function springFrame(t) {
    springRaf = 0;
    var dt = clamp((t - lastT) / 1000, 0.001, 0.1); lastT = t;
    var renders = [], finished = [], list = springs.slice();
    list.forEach(function (s) {
      if (!s.step(dt)) { var i = springs.indexOf(s); if (i > -1) springs.splice(i, 1); finished.push(s); }
      if (s.render && renders.indexOf(s.render) < 0) renders.push(s.render);
    });
    renders.forEach(function (r) { safe(r, "render"); });
    finished.forEach(function (s) { var cb = s.done; s.done = null; if (cb) cb(); });
    if (springs.length) kick(); else idle = true;
  }
  function whenAll(list, cb) {
    var left = list.length;
    list.forEach(function (s) {
      var prev = s.done;
      s.done = function () { if (prev) prev(); if (--left === 0) cb(); };
    });
  }

  /* ---------------------------------------------------------------
     Motor de scroll: los efectos siguen al scroll 1:1, sin retraso
     --------------------------------------------------------------- */
  var vw = window.innerWidth, vh = window.innerHeight, sy = window.pageYOffset;
  var subs = [], ticking = false;
  function req() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  function frame() {
    ticking = false;
    sy = window.pageYOffset;
    for (var i = 0; i < subs.length; i++) safe(subs[i].tick, "tick");
  }
  function measureAll() {
    vw = window.innerWidth; vh = window.innerHeight; sy = window.pageYOffset;
    subs.forEach(function (s) { if (s.measure) safe(s.measure, "measure"); });
    req();
  }

  /* ---------------------------------------------------------------
     Entrada: el contenido aparece al instante, sin pantalla de carga
     --------------------------------------------------------------- */
  function initIntro() {
    requestAnimationFrame(function () { html.classList.add("is-loaded"); });
    /* :active en Safari de iOS necesita un oyente táctil para responder al tocar */
    d.addEventListener("touchstart", function () {}, { passive: true });
  }

  /* ---------------------------------------------------------------
     Navegación: material translúcido, se oculta al bajar,
     menú móvil que nace del botón que lo abre
     --------------------------------------------------------------- */
  function initNav() {
    var nav = $("[data-nav]"), hero = $("[data-hero]");
    var burger = $("[data-burger]"), menu = $("[data-mmenu]");
    var lastY = window.pageYOffset, heroEnd = 0, menuOpen = false, hideT;

    subs.push({
      measure: function () { heroEnd = hero ? pageTop(hero) + hero.offsetHeight - vh * 1.05 : 60; },
      tick: function () {
        var y = sy, dy = y - lastY;
        nav.classList.toggle("is-solid", menuOpen || y > Math.max(60, heroEnd));
        if (!menuOpen && !nav.contains(d.activeElement)) {
          if (dy > 6 && y > 400) nav.classList.add("is-hidden");
          else if (dy < -6 || y < 400) nav.classList.remove("is-hidden");
        }
        html.classList.toggle("nav-hidden", nav.classList.contains("is-hidden"));
        lastY = y;
      }
    });

    function setMenu(open) {
      menuOpen = open;
      burger.setAttribute("aria-expanded", String(open));
      html.classList.toggle("menu-open", open);
      nav.classList.remove("is-hidden");
      var r = burger.getBoundingClientRect();
      menu.style.setProperty("--ox", (r.left + r.width / 2).toFixed(1) + "px");
      menu.style.setProperty("--oy", (r.top + r.height / 2).toFixed(1) + "px");
      clearTimeout(hideT);
      if (open) {
        menu.hidden = false;
        void menu.offsetWidth;
        menu.classList.add("is-open");
        html.style.overflow = "hidden";
        var first = $("a", menu); if (first) first.focus({ preventScroll: true });
      } else {
        menu.classList.remove("is-open");
        html.style.overflow = "";
        hideT = setTimeout(function () { if (!menuOpen) menu.hidden = true; }, 700);
      }
      req();
    }
    if (burger && menu) {
      burger.addEventListener("click", function () { setMenu(!menuOpen); });
      $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
      d.addEventListener("keydown", function (e) { if (e.key === "Escape" && menuOpen) { setMenu(false); burger.focus(); } });
      if (mqDesk.addEventListener) mqDesk.addEventListener("change", function () { if (menuOpen) setMenu(false); });
    }

    var links = $$(".nav-links a");
    if ("IntersectionObserver" in window && links.length) {
      var map = {};
      links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            links.forEach(function (a) { a.classList.remove("is-active"); a.removeAttribute("aria-current"); });
            var a = map[en.target.id]; if (a) { a.classList.add("is-active"); a.setAttribute("aria-current", "location"); }
          }
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      Object.keys(map).forEach(function (id) { var s = d.getElementById(id); if (s) io.observe(s); });
    }
  }

  /* ---------------------------------------------------------------
     Portada: la ventana hexagonal se abre siguiendo el scroll 1:1
     --------------------------------------------------------------- */
  function initHero() {
    var hero = $("[data-hero]"); if (!hero) return;
    var media = $("[data-hero-media]", hero), video = $("[data-hero-video]", hero);
    var frameSvg = $("[data-hero-frame]", hero), shade = $("[data-hero-shade]", hero);
    var l1 = $("[data-hero-l1]", hero), l2 = $("[data-hero-l2]", hero);
    var fades = $$("[data-hero-fade]", hero), cap = $("[data-hero-caption]", hero);
    var top = 0, span = 1, hs = 300, W = 0, H = 0, last = -1;

    if (!autoplayOK && video) { video.removeAttribute("autoplay"); video.pause(); }
    if (video && autoplayOK && "IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { if (en[0].isIntersecting) playSafe(video); else video.pause(); }).observe(hero);
    }
    /* Con movimiento reducido la portada queda fija: sin parallax ni expansión */
    if (reduced) return;

    subs.push({
      measure: function () {
        top = pageTop(hero);
        span = Math.max(1, hero.offsetHeight - vh);
        hs = vw < 720 ? Math.min(vw * 0.74, vh * 0.48, 460) : Math.min(vw * 0.62, vh * 0.5, 460);
        W = media.clientWidth; H = media.clientHeight;
        last = -1;
      },
      tick: function () {
        var p = clamp((sy - top) / span, 0, 1);
        if (Math.abs(p - last) < 0.00005) return;
        last = p;
        var e = easeIO(clamp(p / 0.66, 0, 1));
        var cx = W / 2, cy = H / 2, hw = hs * 0.433, hh = hs * 0.5, hq = hs * 0.25;
        var pts = [
          [cx, cy - hh, cx, 0], [cx + hw, cy - hq, W, 0], [cx + hw, cy + hq, W, H],
          [cx, cy + hh, cx, H], [cx - hw, cy + hq, 0, H], [cx - hw, cy - hq, 0, 0]
        ];
        media.style.clipPath = "polygon(" + pts.map(function (q) {
          return lerp(q[0], q[2], e).toFixed(1) + "px " + lerp(q[1], q[3], e).toFixed(1) + "px";
        }).join(",") + ")";
        if (video) video.style.transform = "scale(" + lerp(1.18, 1.02, e).toFixed(4) + ")";
        var grow = Math.max(W / (hs * 0.866), H / hs);
        frameSvg.style.transform = "translate(-50%,-50%) scale(" + lerp(1, grow, e).toFixed(4) + ")";
        frameSvg.style.opacity = (1 - clamp(p / 0.2, 0, 1)).toFixed(3);
        var tx = e * vw * 0.24, ty = e * vh * 0.1, to = (1 - clamp(p / 0.42, 0, 1)).toFixed(3);
        l1.style.transform = "translate3d(" + (-tx).toFixed(1) + "px," + (-ty).toFixed(1) + "px,0)";
        l2.style.transform = "translate3d(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px,0)";
        l1.style.opacity = l2.style.opacity = to;
        var f = (1 - clamp(p / 0.16, 0, 1)).toFixed(3);
        fades.forEach(function (el) { el.style.setProperty("--hf", f); el.style.visibility = f > 0 ? "" : "hidden"; });
        shade.style.opacity = lerp(0.2, 1, clamp((p - 0.35) / 0.4, 0, 1)).toFixed(3);
        var c = clamp((p - 0.7) / 0.2, 0, 1);
        cap.style.opacity = c.toFixed(3);
        cap.style.transform = "translateY(" + ((1 - c) * 34).toFixed(1) + "px)";
      }
    });
  }

  /* ---------------------------------------------------------------
     Cinta: hereda la velocidad del scroll y vuelve con un muelle
     --------------------------------------------------------------- */
  function initMarquee() {
    if (reduced) return;
    var track = $("[data-marquee]"); if (!track || !track.getAnimations) return;
    var anim = track.getAnimations()[0]; if (!anim) return;
    var lastY = window.pageYOffset, dir = 1;
    var rate = new Spring({ x: 1, damping: 1, response: 0.6, precision: 0.005, render: function () { anim.playbackRate = rate.x; } });
    subs.push({
      tick: function () {
        var v = sy - lastY; lastY = sy;
        if (Math.abs(v) < 0.5) return;
        dir = v > 0 ? 1 : -1;
        rate.x = dir * (1 + Math.min(Math.abs(v) / 6, 5));
        anim.playbackRate = rate.x;
        rate.to(dir);
      }
    });
  }

  /* ---------------------------------------------------------------
     La casa: el texto se ilumina palabra por palabra
     --------------------------------------------------------------- */
  function initWords() {
    var el = $("[data-words]"); if (!el) return;
    var words = [];
    function addWords(parent, text) {
      text.split(/(\s+)/).forEach(function (w) {
        if (!w) return;
        if (/^\s+$/.test(w)) { parent.appendChild(d.createTextNode(w)); return; }
        var s = d.createElement("span"); s.className = "w"; s.textContent = w;
        parent.appendChild(s); words.push(s);
      });
    }
    var frag = d.createDocumentFragment();
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 3) addWords(frag, n.textContent);
      else if (n.nodeType === 1) { var c = n.cloneNode(false); addWords(c, n.textContent); frag.appendChild(c); }
    });
    el.textContent = ""; el.appendChild(frag);

    var top = 0, h = 1, lastK = -1;
    subs.push({
      measure: function () { top = pageTop(el); h = el.offsetHeight; lastK = -1; },
      tick: function () {
        var p = clamp((sy + vh * 0.82 - top) / (h + vh * 0.32), 0, 1);
        var k = Math.round(p * words.length);
        if (k !== lastK) {
          for (var i = 0; i < words.length; i++) words[i].classList.toggle("on", i < k);
          lastK = k;
        }
      }
    });
  }

  /* ---------------------------------------------------------------
     Videos: se cargan y reproducen solo cuando están a la vista
     --------------------------------------------------------------- */
  function initLazyVideos() {
    var vids = $$("video[data-src]");
    if (!("IntersectionObserver" in window)) { vids.forEach(function (v) { v.src = v.dataset.src; }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) {
          if (!v.getAttribute("src")) { v.src = v.dataset.src; v.preload = "auto"; }
          if (autoplayOK) playSafe(v);
        } else if (!v.paused) v.pause();
      });
    }, { rootMargin: "120px 120px" });
    vids.forEach(function (v) { io.observe(v); });
  }

  /* ---------------------------------------------------------------
     Trabajos: recorrido horizontal 1:1 con el scroll (escritorio).
     La galería también se agarra y se lanza: proyecta el impulso
     y se posa en la tarjeta más cercana a donde iba.
     --------------------------------------------------------------- */
  function initWorks() {
    var sec = $("[data-works]"); if (!sec) return;
    var track = $("[data-works-track]", sec), intro = $("[data-works-intro]", sec);
    var line = $("[data-works-line]", sec), count = $("[data-works-count]", sec);
    var works = $$(".work:not(.work--end)", track);
    var vids = works.map(function (w) { return $("video", w); });
    var centers = [], top = 0, dist = 0, active = false, lastN = -1;
    var rb = 0;
    var sScroll = new Spring({ damping: 1, response: 0.55, precision: 0.5, render: function () { scrollToY(sScroll.x); } });
    var sRb = new Spring({ damping: 1, response: 0.35, precision: 0.2, render: function () { rb = sRb.x; req(); } });

    subs.push({
      measure: function () {
        var want = mqDesk.matches && !reduced;
        if (!want) {
          if (active) {
            sec.style.height = ""; track.style.transform = ""; intro.style.opacity = ""; intro.style.transform = "";
            vids.forEach(function (v) { if (v) v.style.transform = ""; });
          }
          active = false; return;
        }
        active = true;
        var lastEl = track.lastElementChild, padR = parseFloat(getComputedStyle(track).paddingRight) || 0;
        dist = Math.max(0, lastEl.offsetLeft + lastEl.offsetWidth + padR - track.clientWidth);
        sec.style.height = (dist + vh) + "px";
        top = pageTop(sec);
        centers = works.map(function (w) { return w.offsetLeft + w.offsetWidth / 2; });
      },
      tick: function () {
        if (!active) return;
        var p = clamp((sy - top) / Math.max(1, dist), 0, 1);
        var x = -p * dist + rb;
        track.style.transform = "translate3d(" + x.toFixed(1) + "px,0,0)";
        intro.style.opacity = (1 - clamp(p * 3.2, 0, 1)).toFixed(3);
        intro.style.transform = "translateY(-50%) translateX(" + (-p * 120).toFixed(1) + "px)";
        for (var i = 0; i < vids.length; i++) {
          if (!vids[i]) continue;
          var rel = (centers[i] + x - vw / 2) / vw;
          if (rel > -1.2 && rel < 1.2) vids[i].style.transform = "translateX(" + (rel * -8).toFixed(2) + "%) scale(1.14)";
        }
        line.style.transform = "scaleX(" + p.toFixed(4) + ")";
        var n = 1 + Math.round(p * (works.length - 1));
        if (n !== lastN) { count.textContent = pad(n); lastN = n; }
      }
    });
    if (mqDesk.addEventListener) mqDesk.addEventListener("change", measureAll);

    /* Agarrar y lanzar la galería */
    var drag = null, tr = new Tracker(), suppress = false;
    function stopThrow() { sScroll.stop(); }
    ["wheel", "touchstart", "keydown"].forEach(function (ev) { window.addEventListener(ev, stopThrow, { passive: true }); });
    track.addEventListener("dragstart", function (e) { e.preventDefault(); });
    track.addEventListener("click", function (e) {
      if (suppress) { e.preventDefault(); e.stopPropagation(); suppress = false; }
    }, true);
    track.addEventListener("pointerdown", function (e) {
      if (!active || e.button !== 0) return;
      stopThrow();
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, s0: window.pageYOffset, on: false };
      tr.reset(e);
    });
    track.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      tr.add(e);
      var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.on) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
        if (Math.abs(dx) < 10) return;
        drag.on = true;
        drag.x0 = e.clientX; drag.s0 = window.pageYOffset; dx = 0;
        sRb.stop();
        try { track.setPointerCapture(e.pointerId); } catch (err) {}
        track.classList.add("is-dragging");
      }
      var want = drag.s0 - dx, min = top, max = top + dist;
      rb = want < min ? rubberband(min - want, vw) : want > max ? -rubberband(want - max, vw) : 0;
      sRb.x = rb;
      scrollToY(clamp(want, min, max));
      req();
    });
    function end(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dr = drag; drag = null;
      if (!dr.on) return;
      track.classList.remove("is-dragging");
      suppress = true; setTimeout(function () { suppress = false; }, 80);
      var v = e.type === "pointercancel" ? 0 : tr.velocity(e).x;
      var cur = window.pageYOffset, sv = -v;
      if (rb !== 0) { sRb.x = rb; sRb.to(0, 0); }
      var proj = cur + project(sv);
      var snaps = [top, top + dist].concat(centers.map(function (c) { return clamp(top + c - vw / 2, top, top + dist); }));
      var target = snaps.reduce(function (a, b) { return Math.abs(b - proj) < Math.abs(a - proj) ? b : a; });
      sScroll.x = cur; sScroll.to(target, sv);
    }
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);
  }

  /* ---------------------------------------------------------------
     Visor: nace de la tarjeta tocada y vuelve a ella.
     Deslizar cambia de video; arrastrar hacia abajo lo cierra.
     --------------------------------------------------------------- */
  function initLightbox() {
    var dlg = $("[data-lb]"); if (!dlg || typeof dlg.showModal !== "function") return;
    var scrim = $("[data-lb-scrim]", dlg), stage = $("[data-lb-stage]", dlg), strip = $("[data-lb-strip]", dlg);
    var meta = $("[data-lb-meta]", dlg), tTitle = $("[data-lb-title]", dlg), tCat = $("[data-lb-cat]", dlg);
    var tN = $("[data-lb-n]", dlg), tT = $("[data-lb-t]", dlg);
    var bPrev = $("[data-lb-prev]", dlg), bNext = $("[data-lb-next]", dlg), bClose = $("[data-lb-close]", dlg);
    var items = $$(".works-track [data-work]"), n = items.length;
    if (!n) return;
    tT.textContent = pad(n);

    var slides = items.map(function (a) {
      var fig = d.createElement("div"); fig.className = "lb-slide";
      var m = d.createElement("div"); m.className = "lb-media";
      var img = d.createElement("img"); img.alt = ""; img.decoding = "async"; img.draggable = false;
      var pv = $("video", a); img.dataset.src = pv ? pv.getAttribute("poster") : "";
      m.appendChild(img); fig.appendChild(m); strip.appendChild(fig);
      return { media: m, img: img, href: a.getAttribute("href"), title: a.dataset.title || "", cat: a.dataset.cat || "", card: a };
    });
    var video = d.createElement("video");
    video.className = "lb-video"; video.loop = true; video.playsInline = true; video.preload = "auto";
    video.setAttribute("playsinline", ""); video.setAttribute("aria-hidden", "true");
    var paused = d.createElement("span"); paused.className = "lb-paused"; paused.setAttribute("aria-hidden", "true");
    paused.innerHTML = '<svg><use href="#play"/></svg>';

    var cur = 0, W = 1, H = 1, T = { x: 0, y: 0, w: 1 }, opener = null, openIndex = 0;
    var closing = false, mediaFade = false, lifted = [], closeTo = null, finT = 0;
    var render = function () {
      strip.style.transform = "translate3d(" + sStrip.x.toFixed(2) + "px,0,0)";
      var m = slides[cur].media, s = rw.x / T.w;
      m.style.transform = "translate3d(" + (rx.x - T.x).toFixed(2) + "px," + (ry.x - T.y).toFixed(2) + "px,0) scale(" + s.toFixed(4) + ")";
      m.style.opacity = mediaFade ? clamp(sScrim.x, 0, 1).toFixed(3) : "";
      var o = clamp(sScrim.x, 0, 1), mo = clamp((o - 0.55) / 0.45, 0, 1);
      scrim.style.opacity = o.toFixed(3);
      meta.style.opacity = bClose.style.opacity = mo.toFixed(3);
      meta.style.transform = "translateY(" + ((1 - mo) * 14).toFixed(1) + "px)";
      /* Cierra el diálogo en cuanto el cierre se ve terminado: no deja la página bloqueada esperando la cola del muelle */
      if (closing && closeTo && o < 0.03 && Math.abs(rx.x - closeTo.x) < 1.5 && Math.abs(ry.x - closeTo.y) < 1.5 && Math.abs(rw.x - closeTo.w) < 1.5 && !finT) {
        finT = setTimeout(function () { finT = 0; if (closing) finish(); }, 0);
      }
    };
    var sStrip = new Spring({ precision: 0.3, render: render });
    var rx = new Spring({ precision: 0.3, render: render });
    var ry = new Spring({ precision: 0.3, render: render });
    var rw = new Spring({ precision: 0.3, render: render });
    var sScrim = new Spring({ precision: 0.002, render: render });
    var all = [sStrip, rx, ry, rw, sScrim];
    function stopAll() { all.forEach(function (s) { s.stop(); }); }

    function measure() {
      W = stage.clientWidth; H = stage.clientHeight;
      var m = slides[cur].media, sr = stage.getBoundingClientRect();
      T = { x: sr.left + m.offsetLeft, y: sr.top + m.offsetTop, w: m.offsetWidth || 1 };
    }
    function visibleRect(el) {
      var m = el && $(".work-media", el); if (!m) return null;
      var r = m.getBoundingClientRect();
      if (r.width < 20 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return null;
      return { x: r.left, y: r.top, w: r.width };
    }
    function lift(el) { if (el && lifted.indexOf(el) < 0) { el.classList.add("is-lifted"); lifted.push(el); } }
    function unliftAll() { lifted.forEach(function (el) { el.classList.remove("is-lifted"); }); lifted = []; }

    function playWithSound() {
      video.muted = false;
      var p = video.play();
      if (p && p.catch) p.catch(function () { video.muted = true; playSafe(video); });
      paused.classList.remove("is-on");
    }
    function setIndex(i) {
      var prev = slides[cur];
      if (prev) { prev.media.style.transform = ""; prev.media.style.opacity = ""; }
      cur = i;
      [cur - 1, cur, cur + 1].forEach(function (j) { var s = slides[j]; if (s && !s.img.getAttribute("src")) s.img.src = s.img.dataset.src; });
      var sl = slides[cur];
      sl.media.appendChild(video); sl.media.appendChild(paused);
      video.poster = sl.img.dataset.src;
      video.src = sl.href;
      var cardVid = $("video", sl.card);
      if (cardVid && cardVid.currentTime > 0) {
        var t0 = cardVid.currentTime;
        video.addEventListener("loadedmetadata", function once() { video.removeEventListener("loadedmetadata", once); try { video.currentTime = t0; } catch (e) {} });
      }
      playWithSound();
      tTitle.textContent = sl.title; tCat.textContent = sl.cat; tN.textContent = pad(cur + 1);
      bPrev.disabled = cur === 0; bNext.disabled = cur === n - 1;
      measure();
      rx.snap(T.x); ry.snap(T.y); rw.snap(T.w);
    }

    function open(i, from) {
      if (dlg.open) return;
      opener = from; openIndex = i; closing = false; mediaFade = false;
      dlg.showModal();
      html.classList.add("lb-open");
      cur = i; measure();
      setIndex(i);
      sStrip.snap(-cur * W);
      var src = reduced ? null : visibleRect(from);
      if (!src) {
        sScrim.snap(1); render();
        dlg.classList.add("is-fade");
        requestAnimationFrame(function () { dlg.classList.add("is-in"); });
      } else {
        lift(from);
        rx.snap(src.x); ry.snap(src.y); rw.snap(src.w); sScrim.snap(0); render();
        rx.set(1, 0.42).to(T.x, 0); ry.set(1, 0.42).to(T.y, 0); rw.set(1, 0.42).to(T.w, 0); sScrim.set(1, 0.42).to(1, 0);
        whenAll([rw], function () { if (!closing) unliftAll(); });
      }
      bClose.focus({ preventScroll: true });
    }

    function finish() {
      if (!dlg.open) return;
      closing = false; closeTo = null; stopAll();
      video.pause(); video.removeAttribute("src"); video.load();
      slides.forEach(function (s) { s.media.style.transform = ""; s.media.style.opacity = ""; });
      dlg.classList.remove("is-fade", "is-in");
      dlg.close();
      html.classList.remove("lb-open");
      unliftAll();
      var back = cur === openIndex ? opener : slides[cur].card;
      if (back && back.focus) back.focus({ preventScroll: true });
    }

    function close(vx, vy) {
      if (!dlg.open || closing) return;
      closing = true;
      vx = vx || 0; vy = vy || 0;
      var el = cur === openIndex && opener ? opener : slides[cur].card;
      var tg = reduced ? null : visibleRect(el);
      if (reduced) { dlg.classList.remove("is-in"); setTimeout(finish, 220); return; }
      if (tg) {
        closeTo = tg;
        lift(el);
        var dwv = -vy * (T.w * 0.35 / H);
        rx.set(1, 0.4).to(tg.x, vx); ry.set(1, 0.4).to(tg.y, vy); rw.set(1, 0.4).to(tg.w, dwv); sScrim.set(1, 0.4).to(0);
        whenAll([rx, ry, rw, sScrim], finish);
      } else {
        /* La tarjeta no está a la vista: el video cae y se desvanece */
        mediaFade = true;
        var w2 = rw.x * 0.72;
        closeTo = { x: rx.x + (rw.x - w2) / 2, y: ry.x + H * 0.22, w: w2 };
        rx.set(1, 0.38).to(closeTo.x, vx); ry.set(1, 0.38).to(closeTo.y, Math.max(vy, 0));
        rw.set(1, 0.38).to(w2, 0); sScrim.set(1, 0.38).to(0);
        whenAll([ry, sScrim], finish);
      }
    }

    function settle(vx, vy) {
      closing = false; mediaFade = false; closeTo = null;
      var dwv = -vy * (T.w * 0.35 / H);
      /* Vuelve con un poco de rebote: el gesto llevaba impulso */
      rx.set(0.8, 0.3).to(T.x, vx); ry.set(0.8, 0.3).to(T.y, vy); rw.set(0.8, 0.3).to(T.w, dwv);
      sScrim.set(1, 0.3).to(1);
      sStrip.set(1, 0.36).to(-cur * W);
      whenAll([rw], function () { if (!closing) unliftAll(); });
    }

    function goTo(i, v) {
      i = clamp(i, 0, n - 1);
      if (i !== cur) setIndex(i);
      sStrip.set(1, reduced ? 0.22 : 0.36).to(-i * W, v || 0);
      if (!closing && sScrim.x < 1) sScrim.set(1, 0.3).to(1);
    }

    /* Gestos dentro del visor */
    var drag = null, tr = new Tracker();
    stage.addEventListener("pointerdown", function (e) {
      if (!dlg.open || e.button !== 0) return;
      var wasClosing = closing;
      stopAll(); closing = false; closeTo = null;
      if (wasClosing) { mediaFade = false; render(); }
      var s = rw.x / T.w;
      drag = {
        id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, moved: false,
        sx0: sStrip.x, r0: { x: rx.x, y: ry.x, w: rw.x }, scrim0: sScrim.x,
        gx: (e.clientX - rx.x) / s, gy: (e.clientY - ry.x) / s,
        onMedia: !!e.target.closest(".lb-media"), interrupted: wasClosing || rw.x !== T.w || sStrip.x !== -cur * W
      };
      tr.reset(e);
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    });
    stage.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      tr.add(e);
      var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.axis) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        drag.moved = true;
        drag.x0 = e.clientX; drag.y0 = e.clientY; dx = dy = 0;
        drag.gx = (e.clientX - rx.x) / (rw.x / T.w); drag.gy = (e.clientY - ry.x) / (rw.x / T.w);
        drag.r0 = { x: rx.x, y: ry.x, w: rw.x };
      }
      if (drag.axis === "x") {
        var x = drag.sx0 + dx, max = 0, min = -(n - 1) * W;
        if (x > max) x = max + rubberband(x - max, W);
        else if (x < min) x = min - rubberband(min - x, W);
        sStrip.x = x;
      } else {
        var y = dy < 0 ? -rubberband(-dy, H) : dy;
        var k = clamp(y / H, 0, 1);
        var s0 = drag.r0.w / T.w, s = s0 * (1 - 0.35 * k);
        var fx = drag.x0 + dx, fy = drag.y0 + y;
        rx.x = fx - drag.gx * s; ry.x = fy - drag.gy * s; rw.x = T.w * s;
        sScrim.x = clamp(drag.scrim0 * (1 - k * 1.25), 0, 1);
      }
      render();
    });
    function release(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dr = drag; drag = null;
      var v = e.type === "pointercancel" ? { x: 0, y: 0 } : tr.velocity(e);
      if (!dr.moved) {
        if (dr.interrupted) { settle(0, 0); return; }
        if (dr.onMedia) { if (video.paused) playWithSound(); else { video.pause(); paused.classList.add("is-on"); } }
        else close(0, 0);
        return;
      }
      if (dr.axis === "x") {
        var proj = sStrip.x + project(v.x, 0.99);
        var target = Math.round(-proj / W);
        if (Math.abs(v.x) > 500) target = cur + (v.x < 0 ? 1 : -1);
        target = clamp(target, cur - 1, cur + 1);
        if (rw.x !== T.w || sScrim.x < 1) settle(0, 0);
        goTo(target, v.x);
      } else {
        var dyNow = ry.x - T.y;
        var dismiss = v.y > 450 || (v.y > -450 && dyNow + project(v.y, 0.99) > H * 0.22);
        if (dismiss) close(v.x, v.y); else settle(v.x, v.y);
      }
    }
    stage.addEventListener("pointerup", release);
    stage.addEventListener("pointercancel", release);
    dlg.addEventListener("wheel", function (e) { e.preventDefault(); }, { passive: false });

    bPrev.addEventListener("click", function () { goTo(cur - 1); });
    bNext.addEventListener("click", function () { goTo(cur + 1); });
    bClose.addEventListener("click", function () { close(0, 0); });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(cur + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(cur - 1); }
    });
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); close(0, 0); });
    dlg.addEventListener("close", function () {
      html.classList.remove("lb-open"); unliftAll(); closing = false; stopAll();
      if (!video.paused) video.pause();
    });
    window.addEventListener("resize", debounce(function () {
      if (!dlg.open || closing) return;
      measure(); sStrip.snap(-cur * W); rx.snap(T.x); ry.snap(T.y); rw.snap(T.w); render();
    }, 100));

    $$("[data-work]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var idx = items.indexOf(a);
        if (idx < 0) idx = items.map(function (x) { return x.getAttribute("href"); }).indexOf(a.getAttribute("href"));
        open(Math.max(0, idx), a);
      });
    });
  }

  /* ---------------------------------------------------------------
     Servicios: pestañas, buscador, video por servicio
     y barra de herramientas de material translúcido
     --------------------------------------------------------------- */
  function initServices() {
    var seg = $("[data-seg]"), lists = $(".svc-lists"); if (!seg || !lists) return;
    var ink = $(".seg-ink", seg), btns = $$("button[data-cat]", seg);
    var panels = $$("[data-panel]", lists), input = $("[data-search]"), note = $("[data-note]");
    var tools = $(".svc-tools"), nav = $("[data-nav]");
    var cat = "mujer";

    function norm(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
    var items = $$(".svc", lists).map(function (det) {
      var txt = $(".svc-name", det).textContent + " " + $$(".svc-body p", det).map(function (p) { return p.textContent; }).join(" ");
      return { det: det, li: det.parentNode, text: norm(txt) };
    });

    function placeInk() {
      var b = btns.filter(function (x) { return x.dataset.cat === cat; })[0];
      if (!b || !ink) return;
      ink.style.width = b.offsetWidth + "px";
      ink.style.transform = "translateX(" + b.offsetLeft + "px)";
    }
    function showCat() {
      panels.forEach(function (p) { p.hidden = p.dataset.panel !== cat; });
      btns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.cat === cat)); });
      placeInk();
    }
    function search() {
      var q = norm(input.value.trim());
      if (!q) {
        lists.classList.remove("is-search"); seg.classList.remove("is-muted");
        items.forEach(function (it) { it.li.hidden = false; });
        $$(".svc-group, .svc-list", lists).forEach(function (el) { el.hidden = false; });
        note.hidden = true; showCat(); measureAll(); return;
      }
      lists.classList.add("is-search"); seg.classList.add("is-muted");
      var total = 0;
      items.forEach(function (it) { var ok = it.text.indexOf(q) !== -1; it.li.hidden = !ok; if (ok) total++; });
      $$(".svc-list", lists).forEach(function (ul) {
        var any = $$(":scope > li", ul).some(function (li) { return !li.hidden; });
        ul.hidden = !any; var h = ul.previousElementSibling; if (h && h.classList.contains("svc-group")) h.hidden = !any;
      });
      panels.forEach(function (p) { p.hidden = !$$(".svc-list", p).some(function (ul) { return !ul.hidden; }); });
      note.hidden = false;
      note.textContent = total ? (total === 1 ? "1 resultado" : total + " resultados")
        : "No hay servicios que coincidan con “" + input.value.trim() + "”. Probá con otra palabra.";
      measureAll();
    }

    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        cat = b.dataset.cat;
        if (input.value) { input.value = ""; search(); } else { showCat(); measureAll(); }
      });
    });
    if (input) input.addEventListener("input", search);
    window.addEventListener("resize", debounce(placeInk, 120));
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(placeInk);
    showCat();

    /* La barra queda fija arriba: al flotar sobre la lista, borde suave en vez de línea dura */
    if (tools) {
      subs.push({
        tick: function () {
          if (!mqDesk.matches) { tools.classList.remove("is-stuck"); return; }
          var navH = html.classList.contains("nav-hidden") ? 0 : (nav ? nav.offsetHeight : 0);
          var r = tools.getBoundingClientRect(), stuck = r.top <= navH + 1 && r.bottom > 0;
          var sec = tools.closest(".services").getBoundingClientRect();
          tools.classList.toggle("is-stuck", stuck && sec.bottom > r.bottom + 40);
        }
      });
    }

    /* Video del servicio (solo escritorio) */
    var media = $("[data-svc-media]"); if (!media) return;
    var vA = $('[data-svm="a"]', media), vB = $('[data-svm="b"]', media);
    var capEl = $(".svm-cap", media), cCat = $("[data-svm-cat]", media), cName = $("[data-svm-name]", media), cDur = $("[data-svm-dur]", media);
    var clips = B.clips || {}, front = vA, curClip = null, visible = false, capTimer;

    function setCaption(det) {
      var name = $(".svc-name", det).textContent, dur = $(".svc-dur", det).textContent;
      var c = det.closest("[data-panel]").dataset.panel === "hombre" ? "Hombre" : "Mujer";
      if (cName.textContent === name) return;
      capEl.classList.add("is-swap");
      clearTimeout(capTimer);
      capTimer = setTimeout(function () {
        cCat.textContent = c; cDur.textContent = dur;
        cName.textContent = name;
        if (name.indexOf("+") > -1) cName.innerHTML = cName.innerHTML.replace("+", '<span class="plus">+</span>');
        capEl.classList.remove("is-swap");
      }, 160);
    }
    function setClip(det, force) {
      if (!mqDesk.matches) return;
      setCaption(det);
      var id = det.dataset.clip;
      if (!clips[id] || (id === curClip && !force)) return;
      curClip = id;
      var back = front === vA ? vB : vA;
      back.poster = "assets/img/trabajo-" + id + ".webp";
      back.src = clips[id];
      if (visible && autoplayOK) playSafe(back);
      back.classList.add("is-on"); front.classList.remove("is-on");
      var old = front; front = back;
      setTimeout(function () { if (old !== front) old.pause(); }, 750);
    }
    items.forEach(function (it) {
      var sum = $("summary", it.det);
      /* Responde al pasar o al presionar, no al soltar */
      sum.addEventListener("pointerover", function (e) { if (!sum.contains(e.relatedTarget)) setClip(it.det); });
      sum.addEventListener("pointerdown", function () { setClip(it.det); });
      sum.addEventListener("focus", function () { setClip(it.det); });
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (visible) {
          if (!curClip && items[0]) setClip(items[0].det, true);
          if (autoplayOK) playSafe(front);
        } else front.pause();
      }, { rootMargin: "100px" }).observe(media);
    }
  }

  /* ---------------------------------------------------------------
     Revelados, contadores, brillo que sigue al cursor
     --------------------------------------------------------------- */
  function initReveals() {
    var els = $$("[data-reveal]");
    els.forEach(function (el) {
      var sib = Array.prototype.filter.call(el.parentNode.children, function (c) { return c.hasAttribute("data-reveal"); });
      var i = sib.indexOf(el);
      if (i > 0) el.style.setProperty("--d", (Math.min(i, 6) * (el.classList.contains("line") ? 0.08 : 0.06)).toFixed(2) + "s");
    });
    if (!("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("is-in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { threshold: 0.01, rootMargin: "0px 0px -4% 0px" });
    els.forEach(function (el) { io.observe(el); });
    setTimeout(function () {
      els.forEach(function (el) { if (!el.classList.contains("is-in") && el.getBoundingClientRect().top < vh) el.classList.add("is-in"); });
    }, 5000);
  }

  function initCounters() {
    var nums = $$("[data-count]"); if (!nums.length || !("IntersectionObserver" in window) || reduced) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var el = en.target, end = +el.dataset.count, t0 = performance.now(), dur = end > 9 ? 1400 : 700;
        (function step(t) {
          var k = clamp((t - t0) / dur, 0, 1);
          el.textContent = Math.round(end * easeOut(k));
          if (k < 1) requestAnimationFrame(step);
        })(t0);
      });
    }, { threshold: 0.4 });
    nums.forEach(function (n) { n.textContent = "0"; io.observe(n); });
  }

  function initGlow() {
    if (!fine) return;
    $$("[data-glow]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (e.clientX - r.left) + "px");
        el.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
  }

  /* ---------------------------------------------------------------
     Barbería: el video se abre al entrar · pie: el nombre se rellena
     --------------------------------------------------------------- */
  function initBarber() {
    if (reduced) return;
    var sec = $("[data-barber]"), media = $("[data-barber-media]"); if (!sec || !media) return;
    var top = 0;
    subs.push({
      measure: function () { top = pageTop(sec); },
      tick: function () {
        var e = easeOut(clamp((sy + vh - top) / (vh * 0.95), 0, 1));
        media.style.setProperty("--bi", ((1 - e) * Math.min(vw * 0.07, 96)).toFixed(1) + "px");
        media.style.setProperty("--br", ((1 - e) * 28).toFixed(1) + "px");
        media.style.setProperty("--bs", lerp(1.14, 1, e).toFixed(4));
      }
    });
  }

  function initFooter() {
    var word = $(".foot-word"), foot = $(".foot"); if (!word || !foot) return;
    var top = 0, h = 1;
    subs.push({
      measure: function () { top = pageTop(foot); h = foot.offsetHeight; },
      tick: function () { word.style.setProperty("--fill", (clamp((sy + vh - top) / (h * 0.9), 0, 1) * 100).toFixed(2) + "%"); }
    });
  }

  function initProgress() {
    var bar = $("[data-progress]"); if (!bar) return;
    subs.push({
      tick: function () {
        var max = d.documentElement.scrollHeight - vh;
        bar.style.transform = "scaleX(" + clamp(sy / Math.max(1, max), 0, 1).toFixed(4) + ")";
      }
    });
  }

  /* ---------------------------------------------------------------
     Botones con imán: dos muelles independientes (X e Y)
     --------------------------------------------------------------- */
  function initMagnetic() {
    if (!fine || reduced) return;
    $$("[data-magnetic]").forEach(function (el) {
      var apply = function () { el.style.translate = mx.x.toFixed(2) + "px " + my.x.toFixed(2) + "px"; };
      var mx = new Spring({ damping: 1, response: 0.32, precision: 0.05, render: apply });
      var my = new Spring({ damping: 1, response: 0.32, precision: 0.05, render: apply });
      el.addEventListener("pointermove", function (e) {
        if (e.pointerType !== "mouse") return;
        var r = el.getBoundingClientRect();
        var cx = r.left + r.width / 2 - mx.x, cy = r.top + r.height / 2 - my.x;
        mx.to((e.clientX - cx) * 0.18); my.to((e.clientY - cy) * 0.26);
      });
      el.addEventListener("pointerleave", function () { mx.to(0); my.to(0); });
    });
  }

  /* ---------------------------------------------------------------
     Abierto / cerrado según la hora de Argentina
     --------------------------------------------------------------- */
  function initStatus() {
    var TZ = B.timezone || "America/Argentina/Buenos_Aires";
    var OPEN = B.hours || { 0: null, 1: null, 2: [10, 19], 3: [10, 19], 4: [10, 19], 5: [10, 19], 6: [10, 19] };
    var DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    var ORDER = [1, 2, 3, 4, 5, 6, 0];
    function hh(n) { return pad(n) + ":00"; }
    function now() {
      var p = {};
      new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      return { d: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), m: (+p.hour) * 60 + (+p.minute) };
    }
    function update() {
      var t = now(), h = OPEN[t.d], open = false, txt = "";
      if (h && t.m >= h[0] * 60 && t.m < h[1] * 60) { open = true; txt = "Abierto ahora, hasta las " + hh(h[1]); }
      else if (h && t.m < h[0] * 60) txt = "Cerrado, abre hoy a las " + hh(h[0]);
      else {
        for (var i = 1; i <= 7; i++) {
          var day = (t.d + i) % 7;
          if (OPEN[day]) { txt = "Cerrado, abre " + (i === 1 ? "mañana" : "el " + DAYS[day]) + " a las " + hh(OPEN[day][0]); break; }
        }
      }
      $$("[data-status]").forEach(function (s) { s.dataset.open = String(open); var sp = $("span", s); if (sp) sp.textContent = txt; });
      $$("[data-hours] li").forEach(function (li, i) { if (ORDER[i] === t.d) li.setAttribute("aria-current", "date"); else li.removeAttribute("aria-current"); });
    }
    update();
    setInterval(update, 60000);
  }

  /* ---------------------------------------------------------------
     Modo propuesta: la ventana nace del distintivo que la abre
     --------------------------------------------------------------- */
  function initPitch() {
    var P = B.pitch || { on: false };
    html.dataset.pitch = P.on ? "on" : "off";
    if (!P.on) return;
    $$("[data-pitch-name]").forEach(function (n) { n.textContent = P.name; });
    var dlg = $("[data-pitch-dlg]"), btn = $("[data-pitch-btn]");
    if (!dlg || !btn || typeof dlg.showModal !== "function") return;
    if (P.whatsapp) {
      var cta = $("[data-pitch-cta]", dlg);
      cta.href = "https://wa.me/" + P.whatsapp + "?text=" + encodeURIComponent("Hola " + P.name + ", vi la propuesta de rediseño web para Trapani Salon y quiero avanzar.");
      $("[data-pitch-row]", dlg).hidden = false;
    }
    btn.addEventListener("click", function () {
      dlg.showModal();
      var b = btn.getBoundingClientRect(), r = dlg.getBoundingClientRect();
      dlg.style.transformOrigin = (b.left + b.width / 2 - r.left).toFixed(0) + "px " + (b.top + b.height / 2 - r.top).toFixed(0) + "px";
    });
    dlg.addEventListener("click", function (e) {
      var r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
    });
  }

  function initExternal() {
    $$('a[target="_blank"]').forEach(function (a) {
      var s = d.createElement("span"); s.className = "sr-only"; s.textContent = " (se abre en una pestaña nueva)";
      a.appendChild(s);
    });
  }

  /* ---------------------------------------------------------------
     Arranque
     --------------------------------------------------------------- */
  function boot() {
    window.__tpBooted = true;
    safe(initPitch, "pitch");
    safe(initExternal, "external");
    safe(initIntro, "intro");
    safe(initNav, "nav");
    safe(initHero, "hero");
    safe(initMarquee, "marquee");
    safe(initWords, "words");
    safe(initLazyVideos, "videos");
    safe(initWorks, "works");
    safe(initLightbox, "lightbox");
    safe(initServices, "services");
    safe(initReveals, "reveals");
    safe(initCounters, "counters");
    safe(initGlow, "glow");
    safe(initBarber, "barber");
    safe(initFooter, "footer");
    safe(initProgress, "progress");
    safe(initMagnetic, "magnetic");
    safe(initStatus, "status");

    window.addEventListener("scroll", req, { passive: true });
    window.addEventListener("resize", debounce(measureAll, 120));
    window.addEventListener("load", measureAll);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(measureAll);
    if ("ResizeObserver" in window) {
      var lastH = 0;
      new ResizeObserver(debounce(function () {
        var h = d.body.offsetHeight; if (h !== lastH) { lastH = h; measureAll(); }
      }, 150)).observe(d.body);
    }
    measureAll();
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot); else boot();
})();
