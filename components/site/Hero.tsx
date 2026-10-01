'use client';
import { getImageProps } from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useProductModal } from './ProductModal';
import { useSite, waLink } from './SiteContext';

export interface HeroSlideData {
  id: string;
  desktop: string;
  mobile: string | null;
  alt: string;
  ghost: string;
  tint: string;
  product: { slug: string; house: string; name: string; notes: string[] } | null;
  href: string | null;
}

export interface HeroCopy {
  eyebrow: string;
  lines: [string, string, string];
  lead: string;
  cta: { text: string; href: string };
}

const SLIDE_MS = 4000;
const WIPE_MS = 1250;

function Slide({ s, first, cls }: { s: HeroSlideData; first: boolean; cls: string }) {
  const common = { alt: s.alt, fill: true, sizes: '(max-width: 860px) 100vw, 64vw', priority: first } as const;
  const { props: desktop } = getImageProps({ ...common, src: s.desktop });
  const mobileSet = s.mobile ? getImageProps({ ...common, src: s.mobile }).props.srcSet : null;
  return (
    <figure className={`hero__slide${cls}`}>
      <div className="hero__slide-inner">
        <picture>
          {mobileSet ? <source media="(max-width: 860px)" srcSet={mobileSet} /> : null}
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img {...desktop} style={undefined} loading={first ? 'eager' : 'lazy'} decoding="async" />
        </picture>
      </div>
    </figure>
  );
}

/** Cinematic hero from the original site: wipe + gold light line, ghost word, tint glow, depth, spotlight, particles */
export function Hero({ slides, copy }: { slides: HeroSlideData[]; copy: HeroCopy }) {
  const t = useTranslations();
  const site = useSite();
  const openModal = useProductModal();
  const heroRef = useRef<HTMLElement>(null);
  const wipeRef = useRef<HTMLSpanElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [at, setAt] = useState(0);
  const [entering, setEntering] = useState<number | null>(null);
  const [ghostWord, setGhostWord] = useState(slides[0]?.ghost ?? '');
  const [ghostState, setGhostState] = useState<'' | 'is-out' | 'is-pre'>('');
  const [feature, setFeature] = useState(0);
  const [swapping, setSwapping] = useState(false);
  const [thumbKey, setThumbKey] = useState(0);
  const [tint, setTint] = useState(slides[0]?.tint ?? '#C6A566');
  const busy = useRef(false);
  const atRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visible = useRef(true);
  const n = slides.length;

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (n < 2) return;
    timer.current = setTimeout(() => goRef.current(atRef.current + 1), SLIDE_MS);
  }, [n]);

  const go = useCallback((target: number) => {
    if (busy.current || n < 2) return;
    const next = ((target % n) + n) % n;
    if (next === atRef.current) { schedule(); return; }
    busy.current = true;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const incoming = slides[next];
    setTint(incoming.tint);
    setThumbKey((k) => k + 1);
    setEntering(next);
    const w = wipeRef.current;
    if (w) { w.classList.remove('is-running'); void w.offsetWidth; w.classList.add('is-running'); }
    setGhostState('is-out');
    setSwapping(true);
    setTimeout(() => {
      setGhostWord(incoming.ghost);
      setGhostState('is-pre');
      requestAnimationFrame(() => requestAnimationFrame(() => setGhostState('')));
      setFeature(next);
      setSwapping(false);
    }, 520);
    setTimeout(() => {
      atRef.current = next;
      setAt(next);
      setEntering(null);
      busy.current = false;
    }, reduce ? 0 : WIPE_MS);
    schedule();
  }, [n, slides, schedule]);
  const goRef = useRef(go);
  goRef.current = go;

  // Start once the intro has lifted, so the first slide gets its full 4 s
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wait = () => {
      if (document.documentElement.classList.contains('is-loaded')) { setThumbKey((k) => k + 1); schedule(); }
      else t = setTimeout(wait, 100);
    };
    wait();
    return () => { clearTimeout(t); if (timer.current) clearTimeout(timer.current); };
  }, [schedule]);

  // Pause while the tab is hidden or the hero is scrolled away
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const onVis = () => {
      if (document.hidden) { if (timer.current) clearTimeout(timer.current); hero.classList.add('is-paused'); }
      else if (visible.current) { hero.classList.remove('is-paused'); setThumbKey((k) => k + 1); schedule(); }
    };
    document.addEventListener('visibilitychange', onVis);
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
      hero.classList.toggle('is-offscreen', !e.isIntersecting);
      hero.classList.toggle('is-paused', !e.isIntersecting);
      if (!e.isIntersecting) { if (timer.current) clearTimeout(timer.current); }
      else if (document.documentElement.classList.contains('is-loaded') && !document.hidden) { setThumbKey((k) => k + 1); schedule(); }
    });
    io.observe(hero);
    return () => { document.removeEventListener('visibilitychange', onVis); io.disconnect(); };
  }, [schedule]);

  // Mouse depth + cursor spotlight
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || !window.matchMedia('(hover: hover) and (pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const depth = Array.from(hero.querySelectorAll<HTMLElement>('[data-depth]')).map((el) => ({ el, d: parseFloat(el.dataset.depth || '0') }));
    const spot = hero.querySelector<HTMLElement>('.hero__spot');
    let rect: DOMRect | null = null, hx = 0, hy = 0, frame = 0;
    const apply = () => {
      frame = 0;
      if (!rect) return;
      const x = (hx - rect.left) / rect.width - 0.5, y = (hy - rect.top) / rect.height - 0.5;
      if (spot) spot.style.transform = `translate3d(${(hx - rect.left).toFixed(0)}px,${(hy - rect.top).toFixed(0)}px,0)`;
      depth.forEach((p) => { p.el.style.translate = `${(x * p.d).toFixed(1)}px ${(y * p.d).toFixed(1)}px`; });
    };
    const enter = () => { rect = hero.getBoundingClientRect(); hero.classList.add('has-spot'); };
    const move = (e: MouseEvent) => { if (!rect) enter(); hx = e.clientX; hy = e.clientY; if (!frame) frame = requestAnimationFrame(apply); };
    const leave = () => { rect = null; hero.classList.remove('has-spot'); depth.forEach((p) => { p.el.style.translate = ''; }); };
    const onScroll = () => { rect = null; };
    hero.addEventListener('mouseenter', enter); hero.addEventListener('mousemove', move); hero.addEventListener('mouseleave', leave);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      hero.removeEventListener('mouseenter', enter); hero.removeEventListener('mousemove', move); hero.removeEventListener('mouseleave', leave);
      window.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Particles: drifting "scent" motes tinted with the slide colour
  const tintRef = useRef(tint);
  tintRef.current = tint;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let W = 0, H = 0, loop = 0, prevT = 0, inView = true, lastTint = '';
    type Mote = { x: number; y: number; r: number; vy: number; sway: number; a: number };
    const motes: Mote[] = [];
    const resize = () => { W = canvas.offsetWidth; H = canvas.offsetHeight; canvas.width = W; canvas.height = H; };
    const spawn = (initial: boolean): Mote => ({ x: W * (0.35 + Math.random() * 0.65), y: initial ? Math.random() * H : H + 10, r: 0.6 + Math.random() * 2.2, vy: 9 + Math.random() * 27, sway: Math.random() * Math.PI * 2, a: 0.15 + Math.random() * 0.55 });
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const paint = () => {
      const hex = tintRef.current.replace('#', '');
      const num = parseInt(hex, 16);
      const rgb = [(num >> 16) & 255, (num >> 8) & 255, num & 255].map((v) => Math.round(v + (255 - v) * 0.45)).join(',');
      const sc = sprite.getContext('2d')!;
      sc.clearRect(0, 0, 64, 64);
      const g = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(1, `rgba(${rgb},0)`);
      sc.fillStyle = g; sc.fillRect(0, 0, 64, 64);
      lastTint = tintRef.current;
    };
    resize(); paint();
    const count = W < 700 ? 26 : 60;
    for (let i = 0; i < count; i++) motes.push(spawn(true));
    const draw = (t: number) => {
      if (tintRef.current !== lastTint) paint();
      const dt = prevT ? Math.min(0.05, (t - prevT) / 1000) : 0.016;
      prevT = t;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < motes.length; i++) {
        let m = motes[i];
        m.y -= m.vy * dt; m.sway += 0.6 * dt; m.x += Math.sin(m.sway) * 18 * dt;
        if (m.y < -10) motes[i] = m = spawn(false);
        const fade = Math.min(1, m.y / (H * 0.35));
        if (fade <= 0) continue;
        const size = m.r * 8;
        ctx.globalAlpha = m.a * fade;
        ctx.drawImage(sprite, m.x - size / 2, m.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      loop = requestAnimationFrame(draw);
    };
    const start = () => { if (!loop) { prevT = 0; loop = requestAnimationFrame(draw); } };
    const stop = () => { if (loop) { cancelAnimationFrame(loop); loop = 0; } };
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView && !document.hidden) start(); else stop(); });
    io.observe(canvas);
    const onVis = () => (!document.hidden && inView ? start() : stop());
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', resize);
    return () => { stop(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', resize); };
  }, []);

  const f = slides[feature]?.product;
  const wa = waLink(site.whatsapp, t('wa.recommendation'));

  return (
    <section ref={heroRef} className="hero" id="hero" style={{ '--tint': tint, '--slide-ms': `${SLIDE_MS}ms` } as React.CSSProperties}
      aria-roledescription="carousel" aria-label={t('hero.carousel')}>
      <div className="hero__media">
        <div className="hero__glow" aria-hidden="true" />
        <div className="hero__depth" data-depth="-14">
          <div className="hero__slides">
            {slides.map((s, i) => (
              <Slide key={s.id} s={s} first={i === 0} cls={`${i === at ? ' is-active' : ''}${i === entering ? ' is-entering' : ''}`} />
            ))}
            <span className="hero__wipe" ref={wipeRef} aria-hidden="true" />
          </div>
        </div>
        <div className="hero__veil" />
        <div className="hero__spot" aria-hidden="true" />
        <div className="hero__depth hero__ghost-wrap" data-depth="22" aria-hidden="true">
          <span className={`hero__ghost${ghostState ? ` ${ghostState}` : ''}`} ref={ghostRef}>
            {ghostWord.split('').map((ch, i) => <span key={`${ghostWord}-${i}`} className="ch" style={{ '--i': i } as React.CSSProperties}>{ch}</span>)}
          </span>
        </div>
        <canvas className="hero__particles" ref={canvasRef} />
      </div>

      <div className="hero__content container">
        <p className="eyebrow hero-in" style={{ '--d': '.1s' } as React.CSSProperties}>{copy.eyebrow}</p>
        <h1 className="hero__title">
          <span className="line"><span>{copy.lines[0]}</span></span>
          <span className="line"><span><em className="gold-text">{copy.lines[1]}</em></span></span>
          <span className="line"><span><em className="gold-text">{copy.lines[2]}</em></span></span>
        </h1>
        <p className="hero__lead hero-in" style={{ '--d': '.75s' } as React.CSSProperties}>{copy.lead}</p>
        <div className="hero__cta hero-in" style={{ '--d': '.9s' } as React.CSSProperties}>
          <Link href={copy.cta.href} className="btn btn--gold">{copy.cta.text}</Link>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn--ghost">{t('hero.consultation')}</a>
        </div>
      </div>

      {f ? (
        <div className="hero__depth hero__feature-wrap hero-in" data-depth="8" style={{ '--d': '1.05s' } as React.CSSProperties}>
          <article className="hero__feature" aria-live="polite">
            <header className="hero__feature-top">
              <span className="hero__feature-label">{t('hero.nowFeaturing')}</span>
              <span className="hero__count"><b>{String(feature + 1).padStart(2, '0')}</b> / {String(n).padStart(2, '0')}</span>
            </header>
            <div className={`hero__feature-body${swapping ? ' is-swapping' : ''}`}>
              <p className="hero__feature-house">{f.house}</p>
              <h2 className="hero__feature-name">{f.name}</h2>
              <ul className="hero__notes" key={feature}>
                {f.notes.slice(0, 5).map((note, k) => <li key={k} style={{ '--i': k } as React.CSSProperties}>{note}</li>)}
              </ul>
            </div>
            <button className="hero__feature-cta" type="button" onClick={() => openModal(f.slug)}>
              <span>{t('hero.viewFragrance')}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </article>
        </div>
      ) : null}

      {n > 1 ? (
        <nav className="hero__rail hero-in" style={{ '--d': '1.2s' } as React.CSSProperties} aria-label={t('hero.choose')}>
          {slides.map((s, i) => (
            <Fragment key={s.id}>
              <button type="button" key={i === at || i === entering ? `${s.id}-${thumbKey}` : s.id}
                className={`hero__thumb${i === (entering ?? at) ? ' is-active' : ''}`} onClick={() => go(i)}
                aria-label={t('hero.show', { name: s.product ? `${s.product.house} ${s.product.name}` : s.alt })}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getImageProps({ src: s.desktop, alt: '', width: 116, height: 144 }).props.src} alt="" loading="lazy" />
                <i />
              </button>
            </Fragment>
          ))}
        </nav>
      ) : null}

      <a href="#collections" className="hero__scroll" aria-label={t('hero.scrollDown')}><span>{t('hero.scroll')}</span><i /></a>
    </section>
  );
}
