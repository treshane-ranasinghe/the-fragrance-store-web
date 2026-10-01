'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Global touches ported from the original js/main.js: preloader, scroll progress bar,
 * nav scroll state, reveal-on-scroll, [data-count] counters, parallax images and the gold cursor.
 * Same timings and CSS classes (is-loaded, is-done, is-skipped, is-visible, is-scrolled, has-cursor).
 */
export function Effects() {
  const pathname = usePathname();
  const [showPreloader, setShowPreloader] = useState(true);
  const preloaderRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  // ---------- Intro (once per session, skipped with reduced motion) ----------
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let seen = false;
    try { seen = sessionStorage.getItem('tfs-intro') === '1'; } catch { /* ignore */ }
    const pre = preloaderRef.current;
    const finish = () => { root.classList.add('is-loaded'); pre?.classList.add('is-done'); };
    if (!pre || reduce || seen) {
      pre?.classList.add('is-skipped');
      requestAnimationFrame(finish);
      setShowPreloader(false);
      return;
    }
    try { sessionStorage.setItem('tfs-intro', '1'); } catch { /* ignore */ }
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => { finish(); document.body.style.overflow = ''; }, 2600);
    const onEnd = () => setShowPreloader(false);
    pre.addEventListener('transitionend', onEnd, { once: true });
    return () => { clearTimeout(t); document.body.style.overflow = ''; };
  }, []);

  // ---------- Scroll: nav state, progress bar, parallax ----------
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nav = document.getElementById('nav');
    let items: { el: Element; img: HTMLElement | null; top: number; h: number }[] = [];
    let vh = window.innerHeight, max = 1, ticking = false, scrolled: boolean | null = null;

    const measure = () => {
      vh = window.innerHeight;
      max = Math.max(1, document.documentElement.scrollHeight - vh);
      const y = window.scrollY;
      items = Array.from(document.querySelectorAll('[data-parallax-img]')).map((el) => {
        const r = el.getBoundingClientRect();
        return { el, img: el.querySelector('img'), top: r.top + y, h: r.height };
      });
    };
    const onScroll = () => {
      const y = window.scrollY;
      const is = y > 30;
      if (is !== scrolled) { nav?.classList.toggle('is-scrolled', is); scrolled = is; }
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${Math.min(1, y / max).toFixed(4)})`;
      if (!reduce) {
        for (const p of items) {
          if (!p.img) continue;
          const center = p.top + p.h / 2 - y;
          if (center < -p.h || center > vh + p.h) continue;
          const offset = (center - vh / 2) / vh;
          p.img.style.transform = `translate3d(0,${(offset * -40).toFixed(1)}px,0) scale(1.14)`;
        }
      }
      ticking = false;
    };
    const request = () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } };
    const onResize = () => { measure(); request(); };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(() => measure());
    ro.observe(document.body);
    measure(); onScroll();
    return () => { window.removeEventListener('scroll', request); window.removeEventListener('resize', onResize); ro.disconnect(); };
  }, [pathname]);

  // ---------- Reveal on scroll + counters (also picks up elements added later) ----------
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const countUp = (el: HTMLElement) => {
      const target = parseInt(el.dataset.count || '0', 10);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - start) / 1800, 1);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (reduce || !('IntersectionObserver' in window)) {
      const all = () => {
        document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
        document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => { el.textContent = el.dataset.count ?? ''; });
      };
      all();
      const mo = new MutationObserver(all);
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        if (el.dataset.count) { if (!el.dataset.counted) { el.dataset.counted = '1'; countUp(el); } } else el.classList.add('is-visible');
        io.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    // Tracked per observer (not with a DOM flag): on client-side navigation the previous observer can see
    // the new page's elements just before it is disconnected, and a DOM flag would then hide them forever.
    const seen = new WeakSet<Element>();
    const scan = () => document.querySelectorAll('.reveal:not(.is-visible), [data-count]').forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      io.observe(el);
    });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [pathname]);

  // ---------- Custom cursor (mouse only; loop sleeps when still) ----------
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dot = dotRef.current, ring = ringRef.current;
    if (!fine || reduce || !dot || !ring) return;
    let mx = -100, my = -100, rx = -100, ry = -100, frame = 0, lastT = 0, hoverOn = false;
    const follow = (t: number) => {
      const dt = lastT ? Math.min(64, t - lastT) : 16;
      lastT = t;
      const k = 1 - Math.pow(1 - 0.16, dt / 16.67);
      rx += (mx - rx) * k; ry += (my - ry) * k;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0)`;
      if (Math.abs(mx - rx) > 0.3 || Math.abs(my - ry) > 0.3) frame = requestAnimationFrame(follow);
      else { frame = 0; lastT = 0; }
    };
    const onMove = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
      if (!document.body.classList.contains('has-cursor')) document.body.classList.add('has-cursor');
      if (!frame) frame = requestAnimationFrame(follow);
    };
    const onLeave = () => document.body.classList.remove('has-cursor');
    const onOver = (e: MouseEvent) => {
      const on = !!(e.target as Element).closest?.('a, button, .product, .filter, label, select');
      if (on !== hoverOn) { ring.classList.toggle('is-hover', on); hoverOn = on; }
    };
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseover', onOver);
    return () => {
      document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseover', onOver); document.body.classList.remove('has-cursor');
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      {showPreloader ? (
        <div className="preloader" id="preloader" ref={preloaderRef} aria-hidden="true">
          <div className="preloader__logo">
            <span className="preloader__top">THE FRAGRANCE</span>
            <span className="preloader__word">
              <span className="pl-letter">S</span>
              <svg className="preloader__bottle" viewBox="-3 -4 114 179">
                <defs>
                  <clipPath id="plClip"><path d="M31 3Q54-1 77 3V55H80V59H108V172H0V59H27V55H31Z" /></clipPath>
                  <linearGradient id="plLiquid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#F3E4BB" /><stop offset=".45" stopColor="#C6A566" /><stop offset="1" stopColor="#7D6435" />
                  </linearGradient>
                </defs>
                <g clipPath="url(#plClip)"><rect className="pl-liquid" x="-3" y="-4" width="114" height="180" fill="url(#plLiquid)" /></g>
                <path className="pl-outline" d="M31 3Q54-1 77 3V55H80V59H108V172H0V59H27V55H31Z" pathLength={1} />
              </svg>
              <span className="pl-letter">O</span><span className="pl-letter">R</span><span className="pl-letter">E</span>
            </span>
          </div>
          <div className="preloader__line"><i /></div>
        </div>
      ) : null}
      <div className="progress" id="progress" ref={progressRef} aria-hidden="true" />
      <div className="cursor" id="cursor" ref={dotRef} aria-hidden="true" />
      <div className="cursor-ring" id="cursorRing" ref={ringRef} aria-hidden="true" />
    </>
  );
}
