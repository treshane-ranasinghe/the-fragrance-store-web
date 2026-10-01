'use client';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useCart } from '@/components/store/CartProvider';
import { getPathname, Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { productImage } from '@/lib/storage';
import type { StoreProduct, StoreVariant } from '@/lib/types';
import { Countdown } from '@/components/ui/Countdown';
import { concentrationLabel } from './labels';
import { money } from './money';
import { useSite, waLink } from './SiteContext';

type Loaded = { product: StoreProduct; variants: StoreVariant[]; images: { storage_path: string; alt_text: string | null }[] };
const Ctx = createContext<(slug: string) => void>(() => {});
export const useProductModal = () => useContext(Ctx);

/** Two-column product dialog (bottom sheet on phones), as on the original site */
export function ProductModalProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<Element | null>(null);
  const { add } = useCart();
  const site = useSite();
  const t = useTranslations();
  const locale = useLocale() as Locale;

  const open = useCallback(async (slug: string) => {
    lastFocus.current = document.activeElement;
    const res = await fetch(`/api/products/${encodeURIComponent(slug)}?locale=${locale}`);
    if (!res.ok) { window.location.href = getPathname({ href: `/product/${slug}`, locale }); return; }
    const d = (await res.json()) as Loaded;
    setData(d);
    setVariantId((d.variants.find((v) => v.stock_qty > 0) ?? d.variants[0])?.id ?? null);
    setQty(1);
    setIsOpen(true);
  }, [locale]);

  const close = useCallback((restore = true) => {
    setIsOpen(false);
    if (restore) (lastFocus.current as HTMLElement | null)?.focus?.();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  }, [isOpen, close]);

  const p = data?.product;
  const v = data?.variants.find((x) => x.id === variantId);
  const buyable = !!v && v.stock_qty > 0;
  const max = v ? Math.min(v.stock_qty, 10) : 1;
  const img = productImage(data?.images[0]?.storage_path ?? p?.image_path);

  return (
    <Ctx.Provider value={open}>
      {children}
      <div className={`modal${isOpen ? ' is-open' : ''}`} id="modal" aria-hidden={!isOpen}>
        <div className="modal__backdrop" onClick={() => close()} />
        <div className="modal__panel" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <button ref={closeRef} className="modal__close" onClick={() => close()} aria-label={t('common.close')}>&times;</button>
          <div className="modal__media ph-bottle">{img ? <Image src={img} alt={`${p?.brand_name ?? ''} ${p?.name ?? ''}`} fill sizes="(max-width: 860px) 100vw, 500px" /> : null}</div>
          <div className="modal__body">
            {p ? <>
              <p className="eyebrow">{p.brand_name}</p>
              <h3 id="modalTitle">{p.name}</h3>
              <p className="modal__meta">{concentrationLabel(p.concentration, t)}{v?.badge_text ? ` · ${v.badge_text}` : ''}</p>
              <p className="modal__desc">{p.description}</p>
              <dl className="modal__notes">
                {([[t('common.notesTop'), p.top_notes], [t('common.notesHeart'), p.middle_notes], [t('common.notesBase'), p.base_notes]] as const).filter(([, n]) => n?.length).map(([k, n]) => (
                  <div key={k}><dt>{k}</dt><dd>{n.join(', ')}</dd></div>
                ))}
              </dl>
              {data!.variants.length ? (
                <fieldset className="sizes">
                  <legend>{t('common.size')}</legend>
                  <div className="sizes__opts">
                    {data!.variants.map((x) => (
                      <label key={x.id} className="size">
                        <input type="radio" name="modalSize" value={x.id} checked={x.id === variantId} disabled={x.stock_qty <= 0}
                          onChange={() => { setVariantId(x.id); setQty(1); }} />
                        <span><b>{t('common.ml', { size: x.size_ml })}</b><small>{x.stock_qty <= 0 ? t('common.soldOut') : money(x.effective_price)}</small></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              <p className="modal__price">
                {!v ? t('common.priceOnRequest') : v.stock_qty <= 0 ? t('common.soldOut') : money(v.effective_price * qty)}
                {v && v.effective_price < v.price ? <s style={{ marginLeft: 12, fontSize: '.7em', color: 'var(--text-dim)' }}>{money(v.price * qty)}</s> : null}
              </p>
              {v?.show_countdown && v.promo_ends_at ? <p className="modal__meta" style={{ color: 'var(--gold-light)' }}><Countdown endsAt={v.promo_ends_at} /></p> : null}
              <div className="modal__buy" hidden={!buyable}>
                <div className="qty qty--lg" role="group" aria-label={t('common.quantity')}>
                  <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label={t('common.decrease')}>&minus;</button>
                  <span aria-live="polite">{qty}</span>
                  <button type="button" onClick={() => setQty(Math.min(max, qty + 1))} disabled={qty >= max} aria-label={t('common.increase')}>+</button>
                </div>
                <button type="button" className="btn btn--gold" onClick={async () => { if (v && (await add({ variantId: v.id, quantity: qty }))) close(false); }}>{t('common.addToBag')}</button>
              </div>
              <a href={waLink(site.whatsapp, t('wa.aboutProduct', { name: `${p.brand_name ?? ''} ${p.name}`.trim() }))} className={`modal__enquire${buyable ? '' : ' is-primary'}`} target="_blank" rel="noopener noreferrer">
                {t('common.enquireWhatsApp')}
              </a>
              <Link href={`/product/${p.slug}`} className="modal__enquire" onClick={() => close(false)}>{t('product.viewFullDetails')}</Link>
            </> : null}
          </div>
        </div>
      </div>
    </Ctx.Provider>
  );
}
