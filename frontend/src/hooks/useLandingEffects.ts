'use client';

import { useEffect } from 'react';

/**
 * All imperative landing-page fx: AR text fill, language toggle, cursor
 * lens (rAF loop), dual clocks, scroll reveals. Moved verbatim from
 * app/page.tsx — decomposing the rAF internals further is logged as
 * future work in REFACTOR_LOG.md.
 */
export function useLandingEffects(): void {
  useEffect(() => {
    // Populate AR text slots
    document.querySelectorAll<HTMLElement>('.lp-reveal').forEach(el => {
      const ar = el.dataset.ar;
      const arSlot = el.querySelector<HTMLElement>('.lp-ar');
      if (arSlot && ar) arSlot.textContent = ar;
    });

    // Language toggle
    let isArMode = false;
    const langToggle = document.getElementById('lp-lang-toggle');
    const langActiveLabel = document.getElementById('lp-lang-active-label');
    const langOtherLabel = document.getElementById('lp-lang-other-label');
    function toggleLang() {
      isArMode = !isArMode;
      if (isArMode) {
        document.body.classList.add('lp-ar-mode');
        langToggle?.setAttribute('aria-pressed', 'true');
        if (langActiveLabel) langActiveLabel.textContent = 'AR';
        if (langOtherLabel) langOtherLabel.textContent = 'EN';
      } else {
        document.body.classList.remove('lp-ar-mode');
        langToggle?.setAttribute('aria-pressed', 'false');
        if (langActiveLabel) langActiveLabel.textContent = 'EN';
        if (langOtherLabel) langOtherLabel.textContent = 'AR';
      }
    }
    langToggle?.addEventListener('click', toggleLang);

    // Lens
    let lensOn = false;
    let lx = -1000, ly = -1000;
    const LENS_LERP = 0.10;
    const LENS_R = 130; // half of 260px lens
    const lensEl = document.getElementById('lp-lens');
    const lensBtnEl = document.getElementById('lp-lens-btn');
    function toggleLens() {
      lensOn = !lensOn;
      if (lensOn && hasMoved) { lx = mx; ly = my; }
      if (lensEl) lensEl.dataset.on = lensOn ? '1' : '0';
      if (lensBtnEl) lensBtnEl.dataset.on = lensOn ? '1' : '0';
      if (!lensOn) {
        // Clean up: hide all CA overlays, clear language masks, clear stale lens position
        document.querySelectorAll<HTMLElement>('.lp-reveal, .lp-nav-link').forEach(el => {
          el.style.setProperty('--ca-r', '0px');
        });
        document.querySelectorAll<HTMLElement>('.lp-reveal > .lp-en, .lp-reveal > .lp-ar').forEach(el => {
          el.style.maskImage = '';
          el.style.webkitMaskImage = '';
        });
        if (lensEl) { lensEl.style.left = ''; lensEl.style.top = ''; }
      }
    }
    lensBtnEl?.addEventListener('click', toggleLens);

    // Track mouse position (used to set lens position on toggle-on)
    let mx = -2000, my = -2000, hasMoved = false;
    let rafId = 0;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      if (!hasMoved) hasMoved = true;
    };
    window.addEventListener('mousemove', onMove);

    // Build chromatic-aberration overlays. For .lp-reveal we make TWO overlays — one cloning the EN
    // text and one with the AR translation (from data-ar). CSS picks which to show based on current
    // language mode: in EN mode the AR overlay is the "reveal" (so hovering shows the translation),
    // and vice versa. For .lp-nav-link we make one EN overlay (no translation).
    function makeOverlay(extraClass: string, html: string) {
      const overlay = document.createElement('span');
      overlay.className = `lp-ca-overlay ${extraClass}`;
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = html;
      return overlay;
    }
    document.querySelectorAll<HTMLElement>('.lp-reveal').forEach(host => {
      const cs = getComputedStyle(host);
      if (cs.position === 'static') host.style.position = 'relative';
      const en = host.querySelector<HTMLElement>(':scope > .lp-en');
      const arText = host.dataset.ar || '';
      if (!host.querySelector(':scope > .lp-ca-en')) {
        host.appendChild(makeOverlay('lp-ca-en', en ? en.innerHTML : (host.textContent || '')));
      }
      if (arText && !host.querySelector(':scope > .lp-ca-ar')) {
        host.appendChild(makeOverlay('lp-ca-ar', arText));
      }
    });
    document.querySelectorAll<HTMLElement>('.lp-nav-link').forEach(host => {
      if (host.querySelector(':scope > .lp-ca-overlay')) return;
      const cs = getComputedStyle(host);
      if (cs.position === 'static') host.style.position = 'relative';
      // Clone innerHTML without any prior overlay
      const tmp = host.cloneNode(true) as HTMLElement;
      tmp.querySelectorAll('.lp-ca-overlay').forEach(o => o.remove());
      host.appendChild(makeOverlay('lp-ca-en', tmp.innerHTML));
    });

    // One-time cleanup of stale inline styles left by the old AR-reveal logic (HMR safety).
    function clearStyle(s: CSSStyleDeclaration, props: string[]) {
      props.forEach(p => s.removeProperty(p));
    }
    document.querySelectorAll<HTMLElement>('.lp-reveal').forEach(host => {
      const ar = host.querySelector<HTMLElement>('.lp-ar');
      const en = host.querySelector<HTMLElement>('.lp-en');
      if (en) clearStyle(en.style, ['mask-image', '-webkit-mask-image', 'clip-path', '-webkit-clip-path', 'opacity']);
      if (ar) clearStyle(ar.style, ['mask-image', '-webkit-mask-image', 'clip-path', '-webkit-clip-path', 'opacity']);
    });

    function frame() {
      if (lensEl && lensOn) {
        lx += (mx - lx) * LENS_LERP;
        ly += (my - ly) * LENS_LERP;
        lensEl.style.left = lx + 'px';
        lensEl.style.top = ly + 'px';

        // .lp-reveal: update clip-path vars AND mask the currently-visible language inside
        // the lens circle so the opposite-language CA overlay shows through (translation reveal).
        document.querySelectorAll<HTMLElement>('.lp-reveal').forEach(el => {
          const r = el.getBoundingClientRect();
          const cx = lx - r.left;
          const cy = ly - r.top;
          const nx = Math.max(0, Math.min(cx, r.width));
          const ny = Math.max(0, Math.min(cy, r.height));
          const dist = Math.hypot(cx - nx, cy - ny);
          const overlapping = dist < LENS_R;

          el.style.setProperty('--ca-x', cx + 'px');
          el.style.setProperty('--ca-y', cy + 'px');
          el.style.setProperty('--ca-r', overlapping ? LENS_R + 'px' : '0px');

          // The currently-visible original gets a circular hole so the CA overlay (other language) shows through.
          const en = el.querySelector<HTMLElement>(':scope > .lp-en');
          const ar = el.querySelector<HTMLElement>(':scope > .lp-ar');
          const visibleOriginal = isArMode ? ar : en;
          const hiddenOriginal = isArMode ? en : ar;
          if (hiddenOriginal) { hiddenOriginal.style.maskImage = ''; hiddenOriginal.style.webkitMaskImage = ''; }
          if (visibleOriginal) {
            if (overlapping) {
              const mask = `radial-gradient(circle ${LENS_R}px at ${cx}px ${cy}px, transparent 96%, #000 100%)`;
              visibleOriginal.style.maskImage = mask;
              visibleOriginal.style.webkitMaskImage = mask;
              visibleOriginal.style.maskRepeat = 'no-repeat';
            } else {
              visibleOriginal.style.maskImage = '';
              visibleOriginal.style.webkitMaskImage = '';
            }
          }
        });

        // .lp-nav-link: simpler — no translation, just clip the CA overlay to the lens circle.
        document.querySelectorAll<HTMLElement>('.lp-nav-link').forEach(el => {
          const r = el.getBoundingClientRect();
          const cx = lx - r.left;
          const cy = ly - r.top;
          const nx = Math.max(0, Math.min(cx, r.width));
          const ny = Math.max(0, Math.min(cy, r.height));
          const dist = Math.hypot(cx - nx, cy - ny);
          el.style.setProperty('--ca-x', cx + 'px');
          el.style.setProperty('--ca-y', cy + 'px');
          el.style.setProperty('--ca-r', dist < LENS_R ? LENS_R + 'px' : '0px');
        });
      }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    // Smooth scroll
    function scrollToId(id: string) {
      const t = document.getElementById(id);
      if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 20, behavior: 'smooth' });
    }
    document.querySelectorAll<HTMLAnchorElement>('.lp-wrap a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => { e.preventDefault(); scrollToId(a.getAttribute('href')!.slice(1)); });
    });
    document.querySelectorAll<HTMLButtonElement>('.lp-rail .lp-dot').forEach(d => {
      d.addEventListener('click', () => scrollToId(d.dataset.target!));
    });

    // Active section tracking
    const sIds = ['hero', 'cap-table', 'esop', 'compliance', 'instruments', 'cta'];
    function updateActive() {
      let cur = 'hero';
      sIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight / 2) cur = id;
      });
      document.querySelectorAll<HTMLElement>('.lp-rail .lp-dot').forEach(d => {
        d.dataset.active = d.dataset.target === cur ? '1' : '0';
      });
      document.querySelectorAll<HTMLAnchorElement>('.lp-nav-link').forEach(n => {
        n.dataset.active = n.getAttribute('href') === '#' + cur ? '1' : '0';
      });
    }
    window.addEventListener('scroll', updateActive, { passive: true });
    updateActive();

    // Clocks
    function fmt(d: Date, tz: string) {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz }).toUpperCase();
    }
    function tick() {
      const d = new Date();
      const r = document.getElementById('lp-clk-rua');
      const l = document.getElementById('lp-clk-ldn');
      if (r) r.textContent = fmt(d, 'Asia/Riyadh');
      if (l) l.textContent = fmt(d, 'Europe/London');
    }
    tick();
    const clockInterval = setInterval(tick, 15000);

    // Fade-up on scroll
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) (e.target as HTMLElement).classList.add('lp-in'); });
    }, { threshold: 0.12 });
    document.querySelectorAll<HTMLElement>('.lp-fade').forEach(el => io.observe(el));

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', updateActive);
      langToggle?.removeEventListener('click', toggleLang);
      lensBtnEl?.removeEventListener('click', toggleLens);
      clearInterval(clockInterval);
      cancelAnimationFrame(rafId);
      io.disconnect();
      document.body.classList.remove('lp-ar-mode');
    };
  }, []);
}
