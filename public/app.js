/* Mebben Solutions – progressive enhancement. Ohne JavaScript bleibt die Seite vollständig lesbar. */
(() => {
  const root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fineQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = () => reduceQuery.matches;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ---------- Spring-Engine -------------------------------------------------
     Kritisch gedämpfte bzw. leicht gedämpfte Federn. Retargeting übernimmt die
     aktuelle Geschwindigkeit, dadurch sind alle Bewegungen unterbrechbar. */
  const active = new Set();
  let frameId = 0;
  let lastTime = 0;

  function springTo(spring, to, { response = 0.4, damping = 1 } = {}) {
    const k = Math.pow((2 * Math.PI) / response, 2);
    spring.k = k;
    spring.c = 2 * damping * Math.sqrt(k);
    spring.to = to;
    active.add(spring);
    if (!frameId) {
      lastTime = 0;
      frameId = requestAnimationFrame(tick);
    }
  }

  function createSpring(apply, initial = 0) {
    return { x: initial, v: 0, to: initial, k: 1, c: 1, apply };
  }

  function tick(now) {
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 1 / 30) : 1 / 60;
    lastTime = now;
    for (const s of active) {
      const acc = s.k * (s.to - s.x) - s.c * s.v;
      s.v += acc * dt;
      s.x += s.v * dt;
      if (Math.abs(s.to - s.x) < 0.0005 && Math.abs(s.v) < 0.0005) {
        s.x = s.to;
        s.v = 0;
        active.delete(s);
      }
      s.apply(s.x);
    }
    frameId = active.size ? requestAnimationFrame(tick) : 0;
  }

  /* ---------- Scroll-Reveal ------------------------------------------------ */
  const revealables = document.querySelectorAll('.reveal, .fade-up');
  if ('IntersectionObserver' in window && !reduced()) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Scroll: Fortschrittsbalken, Header, Zurück-nach-oben --------- */
  const progressBar = document.querySelector('.scroll-progress');
  const header = document.querySelector('.site-header');
  const steps = document.querySelector('.steps');
  const processSection = document.getElementById('ablauf');
  const fillSpring = steps ? createSpring((v) => steps.style.setProperty('--fill', v.toFixed(4))) : null;
  let scrollQueued = false;

  function onScroll() {
    scrollQueued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const y = window.scrollY;
    if (progressBar) progressBar.style.transform = `scaleX(${max > 0 ? clamp01(y / max) : 0})`;
    if (header) header.classList.toggle('is-scrolled', y > 24);
    if (fillSpring && processSection) {
      const rect = processSection.getBoundingClientRect();
      const fraction = clamp01((window.innerHeight * 0.85 - rect.top) / (rect.height * 0.9));
      springTo(fillSpring, fraction, { response: reduced() ? 0.01 : 0.6 });
    }
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!scrollQueued) {
        scrollQueued = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- Navigation: wandernder Indikator ----------------------------- */
  const nav = document.querySelector('.nav');
  const indicator = nav && nav.querySelector('.nav-indicator');
  const navLinks = nav ? [...nav.querySelectorAll('[data-nav]')] : [];
  if (indicator && navLinks.length) {
    const xSpring = createSpring((v) => (indicator.style.transform = `translateX(${v}px)`));
    const wSpring = createSpring((v) => (indicator.style.width = `${v}px`));
    let current = null;

    const moveTo = (link) => {
      navLinks.forEach((l) => l.removeAttribute('aria-current'));
      link.setAttribute('aria-current', 'true');
      const opt = { response: reduced() ? 0.01 : 0.45, damping: 0.9 };
      if (!indicator.classList.contains('is-on')) {
        // Erstes Erscheinen direkt platzieren, ohne über die Navigation zu fliegen.
        xSpring.x = xSpring.to = link.offsetLeft;
        wSpring.x = wSpring.to = link.offsetWidth;
        xSpring.apply(xSpring.x);
        wSpring.apply(wSpring.x);
        indicator.classList.add('is-on');
      } else {
        springTo(xSpring, link.offsetLeft, opt);
        springTo(wSpring, link.offsetWidth, opt);
      }
      current = link;
    };

    const sections = navLinks
      .map((l) => document.getElementById(l.dataset.nav))
      .filter(Boolean);
    const navIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const link = navLinks.find((l) => l.dataset.nav === entry.target.id);
            if (link && link !== current) moveTo(link);
          }
        }
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach((s) => navIO.observe(s));
  }

  /* ---------- Feedback: Ripple bei jedem Druck ----------------------------- */
  if (!reduced()) {
    document.addEventListener('pointerdown', (event) => {
      const target = event.target.closest('.button, .nav-cta, .copy-btn, .service-link');
      if (!target || event.button > 0) return;
      const rect = target.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;
      target.appendChild(ripple);
      const anim = ripple.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0)', opacity: 0.35 },
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
        ],
        { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
      anim.onfinish = () => ripple.remove();
    });
  }

  /* ---------- Cursor-Glow -------------------------------------------------- */
  const glow = document.querySelector('.cursor-glow');
  if (glow && fineQuery.matches && !reduced()) {
    const gx = createSpring((v) => (glow.style.transform = `translate3d(${v}px, ${gy.x}px, 0)`));
    const gy = createSpring((v) => (glow.style.transform = `translate3d(${gx.x}px, ${v}px, 0)`));
    window.addEventListener(
      'pointermove',
      (event) => {
        glow.classList.add('is-active');
        springTo(gx, event.clientX - 240, { response: 0.5 });
        springTo(gy, event.clientY - 240, { response: 0.5 });
      },
      { passive: true }
    );
    document.documentElement.addEventListener('pointerleave', () => glow.classList.remove('is-active'));
  }

  /* ---------- Magnetische Buttons ----------------------------------------- */
  if (fineQuery.matches && !reduced()) {
    document.querySelectorAll('.magnetic').forEach((el) => {
      const sx = createSpring((v) => (el.style.transform = `translate3d(${v}px, ${sy.x}px, 0)`));
      const sy = createSpring((v) => (el.style.transform = `translate3d(${sx.x}px, ${v}px, 0)`));
      el.addEventListener('pointermove', (event) => {
        const rect = el.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        springTo(sx, clamp(dx * 0.28, -14, 14), { response: 0.35, damping: 0.85 });
        springTo(sy, clamp(dy * 0.36, -12, 12), { response: 0.35, damping: 0.85 });
      });
      el.addEventListener('pointerleave', () => {
        springTo(sx, 0, { response: 0.5, damping: 0.6 });
        springTo(sy, 0, { response: 0.5, damping: 0.6 });
      });
    });
  }

  /* ---------- Tilt-Karten mit Spotlight ------------------------------------ */
  if (fineQuery.matches && !reduced()) {
    document.querySelectorAll('.tilt').forEach((card) => {
      const rx = createSpring((v) => card.style.setProperty('--rx', `${v.toFixed(2)}deg`));
      const ry = createSpring((v) => card.style.setProperty('--ry', `${v.toFixed(2)}deg`));
      const lift = createSpring((v) => card.style.setProperty('--lift', `${v.toFixed(2)}px`));
      card.addEventListener('pointerenter', () => card.style.setProperty('--spot', '1'));
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const px = clamp01((event.clientX - rect.left) / rect.width);
        const py = clamp01((event.clientY - rect.top) / rect.height);
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
        springTo(rx, -(py - 0.5) * 8, { response: 0.4 });
        springTo(ry, (px - 0.5) * 9, { response: 0.4 });
        springTo(lift, -8, { response: 0.45 });
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--spot', '0');
        springTo(rx, 0, { response: 0.6, damping: 0.8 });
        springTo(ry, 0, { response: 0.6, damping: 0.8 });
        springTo(lift, 0, { response: 0.6, damping: 0.8 });
      });
    });
  }

  /* ---------- Parallax im Hero-Bild ---------------------------------------- */
  const heroArt = document.querySelector('.hero-art-tilt');
  const hero = document.querySelector('.hero');
  if (heroArt && hero && fineQuery.matches && !reduced()) {
    const px = createSpring((v) => (heroArt.style.transform = `translate3d(${v}px, ${py.x}px, 0)`));
    const py = createSpring((v) => (heroArt.style.transform = `translate3d(${px.x}px, ${v}px, 0)`));
    hero.addEventListener('pointermove', (event) => {
      const rect = hero.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      springTo(px, nx * 22, { response: 0.7 });
      springTo(py, ny * 16, { response: 0.7 });
    });
    hero.addEventListener('pointerleave', () => {
      springTo(px, 0, { response: 0.9 });
      springTo(py, 0, { response: 0.9 });
    });
  }

  /* ---------- Route: Auto ziehen, Momentum ---------------------------------- */
  const svg = document.querySelector('.route-art');
  const base = document.getElementById('route-base');
  const trail = document.getElementById('route-trail');
  const car = document.getElementById('car');
  const hudValue = document.querySelector('.hud-value');
  const hudFill = document.querySelector('.hud-fill');

  if (svg && base && trail && car) {
    const total = base.getTotalLength();
    const SAMPLES = 480;
    const samples = Array.from({ length: SAMPLES + 1 }, (_, i) => base.getPointAtLength((total * i) / SAMPLES));

    const pointAt = (p) => base.getPointAtLength(total * clamp01(p));
    const angleAt = (p) => {
      const a = pointAt(p - 0.003);
      const b = pointAt(p + 0.003);
      return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    };

    const render = (value) => {
      const p = clamp01(value);
      const pt = pointAt(p);
      car.setAttribute('transform', `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)}) rotate(${angleAt(p).toFixed(2)}) scale(0.5)`);
      trail.style.strokeDashoffset = String(1 - p);
      if (hudValue) hudValue.textContent = `${Math.round(p * 100)} %`;
      if (hudFill) hudFill.style.transform = `scaleX(${p})`;
    };

    const route = createSpring(render, 0);
    render(0);

    // Lokale SVG-Koordinate eines Bildschirmpunkts und nächster Routenpunkt.
    const toLocal = (clientX, clientY) => {
      const ctm = base.getScreenCTM();
      if (!ctm) return null;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      return pt.matrixTransform(ctm.inverse());
    };
    const nearest = (local) => {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i <= SAMPLES; i++) {
        const s = samples[i];
        const d = (s.x - local.x) ** 2 + (s.y - local.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return { progress: best / SAMPLES, distance: Math.sqrt(bestD) };
    };

    // Einführung: das Fahrzeug fährt die Route kritisch gedämpft ab.
    if (reduced()) {
      route.x = route.to = 1;
      render(1);
    } else {
      const startIntro = () => springTo(route, 1, { response: 2.2, damping: 1 });
      if (document.readyState === 'complete') startIntro();
      else window.addEventListener('load', startIntro, { once: true });
    }

    let dragging = false;
    let history = [];

    svg.addEventListener('pointerdown', (event) => {
      if (event.button > 0) return;
      const local = toLocal(event.clientX, event.clientY);
      if (!local) return;
      const hit = nearest(local);
      // Nur greifbar, wenn der Zeiger nahe an der Route ist (in SVG-Einheiten).
      if (hit.distance > 46) return;
      dragging = true;
      svg.setPointerCapture(event.pointerId);
      svg.classList.add('is-dragging');
      route.to = route.x = hit.progress;
      route.v = 0;
      history = [{ t: performance.now(), p: hit.progress }];
      render(hit.progress);
    });

    svg.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const local = toLocal(event.clientX, event.clientY);
      if (!local) return;
      const { progress } = nearest(local);
      route.x = route.to = progress;
      route.v = 0;
      render(progress);
      const now = performance.now();
      history.push({ t: now, p: progress });
      history = history.filter((h) => now - h.t < 120);
    });

    const endDrag = (event) => {
      if (!dragging) return;
      dragging = false;
      svg.classList.remove('is-dragging');
      if (svg.hasPointerCapture && svg.hasPointerCapture(event.pointerId)) {
        svg.releasePointerCapture(event.pointerId);
      }
      // Geschwindigkeit in Routenanteilen pro Sekunde aus dem letzten Abschnitt.
      let velocity = 0;
      if (history.length > 1) {
        const first = history[0];
        const last = history[history.length - 1];
        const dt = (last.t - first.t) / 1000;
        if (dt > 0) velocity = (last.p - first.p) / dt;
      }
      if (reduced()) {
        springTo(route, route.x, { response: 0.01 });
        return;
      }
      // Projektion: Wie weit das Fahrzeug nach dem Loslassen rollt (Dezelerationsrate 0.998).
      const travel = ((velocity * total) / 1000) * (0.998 / 0.002);
      const target = clamp01(route.x + travel / total);
      route.v = velocity;
      springTo(route, target, { response: 0.75, damping: 1 });
    };
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
  }

  /* ---------- Kopieren mit Rückmeldung ------------------------------------- */
  const toast = document.getElementById('toast');
  let toastTimer = 0;
  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  };

  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.copy || '';
      try {
        if (!navigator.clipboard) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(value);
        btn.classList.add('is-done');
        btn.textContent = 'Kopiert';
        showToast(`„${value}“ kopiert`);
      } catch (_) {
        showToast('Kopieren nicht möglich – bitte manuell übernehmen.');
      }
      clearTimeout(btn._resetTimer);
      btn._resetTimer = setTimeout(() => {
        btn.classList.remove('is-done');
        btn.textContent = 'Kopieren';
      }, 2000);
    });
  });
})();
