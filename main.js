/* Trapani Salon — comportamiento.
   Todo el contenido está en index.html; este archivo solo añade movimiento e interacción.
   Si algo falla, cada parte está aislada y la página sigue funcionando. */
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
  var BOOKING = B.bookingUrl || "https://web.bewe.co/trapani/services";

  function safe(fn, name) { try { fn(); } catch (e) { console.warn("[" + name + "]", e); } }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeIO(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function pageTop(el) { var r = el.getBoundingClientRect(); return r.top + window.pageYOffset; }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function playSafe(v) { if (!v) return; var p = v.play(); if (p && p.catch) p.catch(function () {}); }

  /* ---------------------------------------------------------------
     Motor de scroll: un solo bucle para todos los efectos
     --------------------------------------------------------------- */
  var vw = window.innerWidth, vh = window.innerHeight, sy = window.pageYOffset;
  var subs = [], ticking = false;
  var SMOOTH = reduced ? 1 : 0.16;

  function req() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  function frame() {
    ticking = false;
    sy = window.pageYOffset;
    var again = false;
    for (var i = 0; i < subs.length; i++) { if (subs[i].tick()) again = true; }
    if (again) req();
  }
  function measureAll() {
    vw = window.innerWidth; vh = window.innerHeight; sy = window.pageYOffset;
    subs.forEach(function (s) { if (s.measure) safe(s.measure, "measure"); });
    req();
  }
  /* Valor suavizado hacia un objetivo; devuelve true mientras se mueve */
  function Smooth() { this.v = null; }
  Smooth.prototype.to = function (target) {
    if (this.v === null || SMOOTH === 1) { this.v = target; return false; }
    var diff = target - this.v;
    if (Math.abs(diff) < 0.0004) { this.v = target; return false; }
    this.v += diff * SMOOTH;
    return true;
  };

  /* ---------------------------------------------------------------
     Pantalla de entrada
     --------------------------------------------------------------- */
  function initSplash() {
    var splash = $("[data-splash]");
    var shown = splash && !html.classList.contains("no-splash");
    function done() { requestAnimationFrame(function () { html.classList.add("is-loaded"); }); }
    if (!shown) { done(); return; }
    try { sessionStorage.setItem("tp-splash", "1"); } catch (e) {}
    var start = performance.now(), out = false;
    function hide() {
      if (out) return; out = true;
      splash.classList.add("is-out");
      done();
      setTimeout(function () { splash.style.display = "none"; }, 1200);
    }
    function whenReady() { setTimeout(hide, Math.max(0, 1900 - (performance.now() - start))); }
    if (d.readyState === "complete") whenReady(); else window.addEventListener("load", whenReady);
    setTimeout(hide, 3200);
  }

  /* ---------------------------------------------------------------
     Navegación: fija, se oculta al bajar, menú móvil, sección activa
     --------------------------------------------------------------- */
  function initNav() {
    var nav = $("[data-nav]"), hero = $("[data-hero]");
    var burger = $("[data-burger]"), menu = $("[data-mmenu]");
    var lastY = window.pageYOffset, heroEnd = 0, menuOpen = false;

    subs.push({
      measure: function () { heroEnd = hero ? pageTop(hero) + hero.offsetHeight - vh * 1.05 : 60; },
      tick: function () {
        var y = sy, dy = y - lastY;
        nav.classList.toggle("is-solid", menuOpen || y > Math.max(60, heroEnd));
        html.classList.toggle("nav-hidden", nav.classList.contains("is-hidden"));
        if (!menuOpen && !nav.contains(d.activeElement)) {
          if (dy > 6 && y > 400) nav.classList.add("is-hidden");
          else if (dy < -6 || y < 400) nav.classList.remove("is-hidden");
        }
        lastY = y;
        return false;
      }
    });

    function setMenu(open) {
      menuOpen = open;
      burger.setAttribute("aria-expanded", String(open));
      html.classList.toggle("menu-open", open);
      nav.classList.remove("is-hidden");
      if (open) {
        menu.hidden = false;
        void menu.offsetWidth;
        menu.classList.add("is-open");
        html.style.overflow = "hidden";
        var first = $("a", menu); if (first) first.focus({ preventScroll: true });
      } else {
        menu.classList.remove("is-open");
        html.style.overflow = "";
        setTimeout(function () { if (!menuOpen) menu.hidden = true; }, 450);
      }
      req();
    }
    if (burger && menu) {
      burger.addEventListener("click", function () { setMenu(!menuOpen); });
      $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
      d.addEventListener("keydown", function (e) { if (e.key === "Escape" && menuOpen) { setMenu(false); burger.focus(); } });
      mqDesk.addEventListener && mqDesk.addEventListener("change", function () { if (menuOpen) setMenu(false); });
    }

    /* Enlace activo según la sección visible */
    var links = $$(".nav-links a");
    if ("IntersectionObserver" in window && links.length) {
      var map = {};
      links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            links.forEach(function (a) { a.classList.remove("is-active"); });
            var a = map[en.target.id]; if (a) a.classList.add("is-active");
          }
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      Object.keys(map).forEach(function (id) { var s = d.getElementById(id); if (s) io.observe(s); });
    }
  }

  /* ---------------------------------------------------------------
     Portada: la ventana hexagonal se abre a pantalla completa
     --------------------------------------------------------------- */
  function initHero() {
    var hero = $("[data-hero]"); if (!hero) return;
    var media = $("[data-hero-media]", hero), video = $("[data-hero-video]", hero);
    var frameSvg = $("[data-hero-frame]", hero), shade = $("[data-hero-shade]", hero);
    var l1 = $("[data-hero-l1]", hero), l2 = $("[data-hero-l2]", hero);
    var fades = $$("[data-hero-fade]", hero), cap = $("[data-hero-caption]", hero);
    var top = 0, span = 1, hs = 300, W = 0, H = 0, s = new Smooth(), last = -1;

    if (!autoplayOK && video) { video.removeAttribute("autoplay"); video.pause(); }

    subs.push({
      measure: function () {
        top = pageTop(hero);
        span = Math.max(1, hero.offsetHeight - vh);
        hs = vw < 720 ? Math.min(vw * 0.74, vh * 0.48, 460) : Math.min(vw * 0.62, vh * 0.5, 460);
        W = media.clientWidth; H = media.clientHeight;
        last = -1;
      },
      tick: function () {
        var moving = s.to(clamp((sy - top) / span, 0, 1));
        var p = s.v;
        if (Math.abs(p - last) < 0.00005) return moving;
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
        return moving;
      }
    });

    /* Pausar el video de portada cuando no se ve */
    if (video && autoplayOK && "IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) playSafe(video); else video.pause();
      }).observe(hero);
    }
  }

  /* ---------------------------------------------------------------
     Cinta de servicios: acelera con la velocidad del scroll
     --------------------------------------------------------------- */
  function initMarquee() {
    var track = $("[data-marquee]"); if (!track || !track.getAnimations) return;
    var anim = track.getAnimations()[0]; if (!anim) return;
    var lastY = window.pageYOffset, rate = 1, dir = 1;
    subs.push({
      tick: function () {
        var v = sy - lastY; lastY = sy;
        if (Math.abs(v) > 0.5) dir = v > 0 ? 1 : -1;
        var target = dir * (1 + Math.min(Math.abs(v) / 6, 5));
        rate = lerp(rate, target, 0.12);
        anim.playbackRate = rate;
        return Math.abs(rate - dir) > 0.02;
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
        return false;
      }
    });
  }

  /* ---------------------------------------------------------------
     Videos: se cargan y reproducen solo cuando están a la vista
     --------------------------------------------------------------- */
  function initLazyVideos() {
    var vids = $$("video[data-src]");
    if (!("IntersectionObserver" in window)) {
      vids.forEach(function (v) { v.src = v.dataset.src; });
      return;
    }
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
     Trabajos: recorrido horizontal fijado (escritorio) + visor
     --------------------------------------------------------------- */
  function initWorks() {
    var sec = $("[data-works]"); if (!sec) return;
    var track = $("[data-works-track]", sec), intro = $("[data-works-intro]", sec);
    var line = $("[data-works-line]", sec), count = $("[data-works-count]", sec);
    var works = $$(".work:not(.work--end)", track);
    var vids = works.map(function (w) { return $("video", w); });
    var centers = [], top = 0, dist = 0, active = false, s = new Smooth(), lastN = -1, last = -1;

    subs.push({
      measure: function () {
        if (!mqDesk.matches) {
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
        last = -1;
      },
      tick: function () {
        if (!active) return false;
        var moving = s.to(clamp((sy - top) / Math.max(1, dist), 0, 1));
        var p = s.v;
        if (Math.abs(p - last) < 0.00005) return moving;
        last = p;
        var x = -p * dist;
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
        return moving;
      }
    });
    if (mqDesk.addEventListener) mqDesk.addEventListener("change", measureAll);
  }

  function initLightbox() {
    var dlg = $("[data-lb]"); if (!dlg || typeof dlg.showModal !== "function") return;
    var video = $("[data-lb-video]", dlg), tTitle = $("[data-lb-title]", dlg), tCat = $("[data-lb-cat]", dlg);
    var tN = $("[data-lb-n]", dlg), tT = $("[data-lb-t]", dlg);
    var items = $$(".works-track [data-work]");
    var cur = 0;
    tT.textContent = pad(items.length);

    function show(i) {
      cur = (i + items.length) % items.length;
      var a = items[cur];
      video.src = a.getAttribute("href");
      var poster = $("video", a); if (poster) video.poster = poster.getAttribute("poster") || "";
      tTitle.textContent = a.dataset.title || "";
      tCat.textContent = a.dataset.cat || "";
      tN.textContent = pad(cur + 1);
      video.muted = false;
      playSafe(video);
    }
    function open(i) { show(i); if (!dlg.open) dlg.showModal(); }

    $$("[data-work]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var idx = items.indexOf(a);
        if (idx < 0) idx = items.map(function (x) { return x.getAttribute("href"); }).indexOf(a.getAttribute("href"));
        open(Math.max(0, idx));
      });
    });
    $("[data-lb-prev]", dlg).addEventListener("click", function () { show(cur - 1); });
    $("[data-lb-next]", dlg).addEventListener("click", function () { show(cur + 1); });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); show(cur + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); show(cur - 1); }
    });
    dlg.addEventListener("close", function () { video.pause(); video.removeAttribute("src"); video.load(); });
  }

  /* ---------------------------------------------------------------
     Servicios: pestañas, buscador, video según el servicio
     --------------------------------------------------------------- */
  function initServices() {
    var seg = $("[data-seg]"), lists = $(".svc-lists"); if (!seg || !lists) return;
    var ink = $(".seg-ink", seg), btns = $$("button[data-cat]", seg);
    var panels = $$("[data-panel]", lists), input = $("[data-search]"), note = $("[data-note]");
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
      }, 220);
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
      sum.addEventListener("mouseover", function (e) { if (!sum.contains(e.relatedTarget)) setClip(it.det); });
      sum.addEventListener("focus", function () { setClip(it.det); });
      it.det.addEventListener("toggle", function () { if (it.det.open) setClip(it.det); });
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
      if (i > 0) el.style.setProperty("--d", (Math.min(i, 6) * (el.classList.contains("line") ? 0.1 : 0.08)).toFixed(2) + "s");
    });
    if (!("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("is-in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { threshold: 0.01, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (el) { io.observe(el); });
    setTimeout(function () {
      els.forEach(function (el) { if (!el.classList.contains("is-in") && el.getBoundingClientRect().top < vh) el.classList.add("is-in"); });
    }, 6000);
  }

  function initCounters() {
    var nums = $$("[data-count]"); if (!nums.length || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var el = en.target, end = +el.dataset.count, t0 = performance.now(), dur = end > 9 ? 1700 : 900;
        if (reduced) return;
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
      el.addEventListener("mousemove", function (e) {
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
    var sec = $("[data-barber]"), media = $("[data-barber-media]"); if (!sec || !media) return;
    var top = 0, s = new Smooth();
    subs.push({
      measure: function () { top = pageTop(sec); },
      tick: function () {
        var moving = s.to(clamp((sy + vh - top) / (vh * 0.95), 0, 1));
        var e = easeOut(s.v);
        var inset = (1 - e) * Math.min(vw * 0.07, 96);
        media.style.setProperty("--bi", inset.toFixed(1) + "px");
        media.style.setProperty("--br", ((1 - e) * 28).toFixed(1) + "px");
        media.style.setProperty("--bs", lerp(1.14, 1, e).toFixed(4));
        return moving;
      }
    });
  }

  function initFooter() {
    var word = $(".foot-word"), foot = $(".foot"); if (!word || !foot) return;
    var top = 0, h = 1, s = new Smooth();
    subs.push({
      measure: function () { top = pageTop(foot); h = foot.offsetHeight; },
      tick: function () {
        var moving = s.to(clamp((sy + vh - top) / (h * 0.9), 0, 1));
        word.style.setProperty("--fill", (s.v * 100).toFixed(2) + "%");
        return moving;
      }
    });
  }

  function initProgress() {
    var bar = $("[data-progress]"); if (!bar) return;
    subs.push({
      tick: function () {
        var max = d.documentElement.scrollHeight - vh;
        bar.style.transform = "scaleX(" + clamp(sy / Math.max(1, max), 0, 1).toFixed(4) + ")";
        return false;
      }
    });
  }

  /* ---------------------------------------------------------------
     Cursor y botones magnéticos (solo con mouse)
     --------------------------------------------------------------- */
  function initCursor() {
    if (!fine) return;
    var c = $(".cursor"); if (!c) return;
    var dot = $(".cursor-dot", c), ring = $(".cursor-ring", c);
    var mx = 0, my = 0, rx = 0, ry = 0, first = true, running = false;
    function loop() {
      rx = lerp(rx, mx, 0.2); ry = lerp(ry, my, 0.2);
      ring.style.transform = "translate3d(" + rx.toFixed(1) + "px," + ry.toFixed(1) + "px,0)";
      if (Math.abs(rx - mx) > 0.1 || Math.abs(ry - my) > 0.1) requestAnimationFrame(loop); else running = false;
    }
    window.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
      if (first) { first = false; rx = mx; ry = my; c.classList.add("is-ready"); }
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });
    d.addEventListener("mouseover", function (e) {
      var t = e.target;
      c.classList.toggle("is-play", !!t.closest("[data-work]"));
      c.classList.toggle("is-link", !!t.closest("a, button, summary, input, [data-magnetic]"));
      c.classList.toggle("is-light", !!t.closest(".services, .info, .book, .sheet"));
      c.classList.toggle("is-ready", !t.closest("iframe") && !first);
    });
    d.addEventListener("mouseout", function (e) { if (!e.relatedTarget) c.classList.remove("is-ready"); });
  }

  function initMagnetic() {
    if (!fine) return;
    $$("[data-magnetic]").forEach(function (el) {
      el.style.transition = (el.style.transition ? el.style.transition + "," : "") + "transform .35s cubic-bezier(.16,1,.3,1)";
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) * 0.22, y = (e.clientY - (r.top + r.height / 2)) * 0.3;
        el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      });
      el.addEventListener("mouseleave", function () { el.style.transform = ""; });
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
      var lis = $$("[data-hours] li");
      lis.forEach(function (li, i) { if (ORDER[i] === t.d) li.setAttribute("aria-current", "date"); else li.removeAttribute("aria-current"); });
    }
    update();
    setInterval(update, 60000);
  }

  /* ---------------------------------------------------------------
     Modo propuesta
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
    btn.addEventListener("click", function () { dlg.showModal(); });
    dlg.addEventListener("click", function (e) {
      var r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
    });
  }

  /* Enlaces externos: aviso para lectores de pantalla */
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
    safe(initSplash, "splash");
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
    safe(initCursor, "cursor");
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
