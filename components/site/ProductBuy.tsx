'use client';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCart } from '@/components/store/CartProvider';
import { Countdown } from '@/components/ui/Countdown';
import { productImage } from '@/lib/storage';
import type { StoreVariant } from '@/lib/types';
import { money } from './money';
import { useSite, waLink } from './SiteContext';

export function ProductBuy({ variants, name }: { variants: StoreVariant[]; name: string }) {
  const { add } = useCart();
  const site = useSite();
  const t = useTranslations();
  const [id, setId] = useState((variants.find((v) => v.stock_qty > 0) ?? variants[0])?.id);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const v = variants.find((x) => x.id === id);
  const buyable = !!v && v.stock_qty > 0;
  const max = v ? Math.min(v.stock_qty, 10) : 1;
  return (
    <>
      {variants.length ? (
        <fieldset className="sizes">
          <legend>{t('common.size')}</legend>
          <div className="sizes__opts">
            {variants.map((x) => (
              <label key={x.id} className="size">
                <input type="radio" name="size" value={x.id} checked={x.id === id} disabled={x.stock_qty <= 0} onChange={() => { setId(x.id); setQty(1); }} />
                <span><b>{t('common.ml', { size: x.size_ml })}</b><small>{x.stock_qty <= 0 ? t('common.soldOut') : money(x.effective_price)}</small></span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <p className="modal__price">
        {!v ? t('common.priceOnRequest') : v.stock_qty <= 0 ? t('common.soldOut') : money(v.effective_price * qty)}
        {v && v.effective_price < v.price ? <s className="pd__was">{money(v.price * qty)}</s> : v?.compare_at_price && v.compare_at_price > v.effective_price ? <s className="pd__was">{money(v.compare_at_price * qty)}</s> : null}
      </p>
      {v?.badge_text ? <p className="pd__promo"><span className="product__tag pd__tag">{v.badge_text}</span>{v.show_countdown && v.promo_ends_at ? <Countdown endsAt={v.promo_ends_at} /> : null}</p> : null}
      {v && v.stock_qty > 0 && v.stock_qty <= 3 ? <p className="pd__stock">{t('common.onlyLeft', { count: v.stock_qty })}</p> : null}
      <div className="modal__buy" hidden={!buyable}>
        <div className="qty qty--lg" role="group" aria-label={t('common.quantity')}>
          <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label={t('common.decrease')}>&minus;</button>
          <span aria-live="polite">{qty}</span>
          <button type="button" onClick={() => setQty(Math.min(max, qty + 1))} disabled={qty >= max} aria-label={t('common.increase')}>+</button>
        </div>
        <button type="button" className="btn btn--gold" disabled={busy} onClick={async () => { if (!v) return; setBusy(true); await add({ variantId: v.id, quantity: qty }); setBusy(false); }}>
          {busy ? t('common.adding') : t('common.addToBag')}
        </button>
      </div>
      <a href={waLink(site.whatsapp, t('wa.aboutProduct', { name: name.trim() }))} className={`modal__enquire${buyable ? '' : ' is-primary'}`} target="_blank" rel="noopener noreferrer">
        {t('common.enquireWhatsApp')}
      </a>
    </>
  );
}

export function PdGallery({ images, name }: { images: { id: string; storage_path: string; alt_text: string | null }[]; name: string }) {
  const t = useTranslations('product');
  const [i, setI] = useState(0);
  const src = productImage(images[i]?.storage_path);
  return (
    <div className="pd__gallery">
      <div className="pd__media ph-bottle">{src ? <Image src={src} alt={images[i]?.alt_text || name} fill priority sizes="(max-width: 860px) 100vw, 50vw" /> : null}</div>
      {images.length > 1 ? (
        <div className="pd__thumbs" role="tablist" aria-label={t('images')}>
          {images.map((im, k) => (
            <button key={im.id} type="button" role="tab" aria-selected={k === i} className={`hero__thumb${k === i ? ' is-active' : ''}`} onClick={() => setI(k)}>
              {productImage(im.storage_path) ? <Image src={productImage(im.storage_path)!} alt="" fill sizes="58px" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
