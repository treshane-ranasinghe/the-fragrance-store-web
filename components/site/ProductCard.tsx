'use client';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { useCart } from '@/components/store/CartProvider';
import { Link } from '@/i18n/navigation';
import { productImage } from '@/lib/storage';
import type { StoreBundle, StoreProduct } from '@/lib/types';
import { BagIcon } from './icons';
import { money } from './money';
import { useProductModal } from './ProductModal';

/** 3D tilt + cursor shine (mouse only, off with reduced motion) — same maths as the original */
function useTilt() {
  const ref = useRef<HTMLElement>(null);
  const state = useRef({ rect: null as DOMRect | null, px: 0, py: 0, frame: 0 });
  const ok = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const apply = () => {
    const s = state.current, card = ref.current;
    s.frame = 0;
    if (!card || !s.rect) return;
    const x = (s.px - s.rect.left) / s.rect.width, y = (s.py - s.rect.top) / s.rect.height;
    card.style.transform = `translate3d(0,-6px,0) rotateX(${((0.5 - y) * 7).toFixed(2)}deg) rotateY(${((x - 0.5) * 9).toFixed(2)}deg)`;
    card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
  };
  return {
    ref,
    onMouseEnter: () => { if (!ok() || !ref.current) return; state.current.rect = ref.current.getBoundingClientRect(); ref.current.classList.add('is-tilting'); },
    onMouseMove: (e: React.MouseEvent) => {
      if (!ok() || !ref.current) return;
      const s = state.current;
      if (!s.rect) s.rect = ref.current.getBoundingClientRect();
      s.px = e.clientX; s.py = e.clientY;
      if (!s.frame) s.frame = requestAnimationFrame(apply);
    },
    onMouseLeave: () => {
      const s = state.current;
      if (s.frame) cancelAnimationFrame(s.frame);
      s.frame = 0; s.rect = null;
      if (ref.current) { ref.current.classList.remove('is-tilting'); ref.current.style.transform = ''; }
    },
  };
}

export function ProductCard({ p, priority = false }: { p: StoreProduct; priority?: boolean }) {
  const t = useTranslations('common');
  const tp = useTranslations('product');
  const tilt = useTilt();
  const openModal = useProductModal();
  const { add } = useCart();
  const src = productImage(p.image_path);
  const soldOut = !p.in_stock;
  const multi = p.variant_count > 1;
  const was = p.promotion_id ? p.regular_price : p.compare_at_price;
  const tag = soldOut ? t('soldOut') : p.badge_text || p.badge || (was && was > p.price ? t('sale') : null);
  const addLabel = soldOut ? t('soldOut') : multi ? t('chooseSize') : t('addToBagShort');
  const top = p.top_notes ?? [], baseN = p.base_notes ?? [];
  const notes = [top[0], baseN[0]].filter(Boolean).join(' · ');

  return (
    <article ref={tilt.ref as React.RefObject<HTMLElement>} className={`product reveal${soldOut ? ' is-soldout' : ''}`}
      onMouseEnter={tilt.onMouseEnter} onMouseMove={tilt.onMouseMove} onMouseLeave={tilt.onMouseLeave}>
      <div className="product__media">
        {tag ? <span className="product__tag">{tag}</span> : null}
        {src ? <Image src={src} alt={p.image_alt || `${p.brand_name ?? ''} ${p.name}`} fill sizes="(max-width: 560px) 50vw, (max-width: 1080px) 33vw, 320px" priority={priority} /> : null}
      </div>
      <div className="product__body">
        <p className="product__house">{p.brand_name}</p>
        <h3 className="product__name">
          {/* Real link for Google; opens the quick-view sheet for people */}
          <Link href={`/product/${p.slug}`} className="product__open" onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); openModal(p.slug); }}>{p.name}</Link>
        </h3>
        <p className="product__notes">{notes}</p>
        <div className="product__foot">
          <span className="product__price">
            {multi && p.min_price !== p.max_price ? <small>{t('from')}</small> : null} {money(p.price)}
            {was && was > p.price ? <> <small style={{ textDecoration: 'line-through' }}>{money(was)}</small></> : null}
          </span>
          <button type="button" className="product__add" disabled={soldOut} aria-label={tp('addLabel', { label: addLabel, name: p.name })}
            onClick={async () => { if (multi) openModal(p.slug); else await add({ variantId: p.default_variant_id }); }}>
            <BagIcon /><span>{addLabel}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export function BundleCard({ b }: { b: StoreBundle }) {
  const t = useTranslations('common');
  const tp = useTranslations('product');
  const tilt = useTilt();
  const { add } = useCart();
  const src = productImage(b.image_path);
  const soldOut = b.available <= 0;
  return (
    <article ref={tilt.ref as React.RefObject<HTMLElement>} className={`product reveal${soldOut ? ' is-soldout' : ''}`}
      onMouseEnter={tilt.onMouseEnter} onMouseMove={tilt.onMouseMove} onMouseLeave={tilt.onMouseLeave}>
      <div className="product__media">
        <span className="product__tag">{soldOut ? t('soldOut') : b.you_save > 0 ? tp('save', { amount: money(b.you_save) }) : t('giftSet')}</span>
        {src ? <Image src={src} alt={b.name} fill sizes="(max-width: 560px) 50vw, 320px" />
          : <div className="bundle-collage">{(b.item_images ?? []).slice(0, 2).map((i, k) => <span key={k}>{productImage(i) ? <Image src={productImage(i)!} alt="" fill sizes="160px" /> : null}</span>)}</div>}
      </div>
      <div className="product__body">
        <p className="product__house">{t('giftSet')}</p>
        <h3 className="product__name"><Link href={`/bundle/${b.slug}`} className="product__open">{b.name}</Link></h3>
        <p className="product__notes">{tp('boughtSeparately', { amount: money(b.items_value) })}</p>
        <div className="product__foot">
          <span className="product__price">{money(b.effective_price)}</span>
          <button type="button" className="product__add" disabled={soldOut} aria-label={tp('addLabel', { label: t('addToBagShort'), name: b.name })} onClick={() => add({ bundleId: b.id })}>
            <BagIcon /><span>{soldOut ? t('soldOut') : t('addToBagShort')}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
