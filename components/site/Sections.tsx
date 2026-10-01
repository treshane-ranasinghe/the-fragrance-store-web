import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Countdown } from '@/components/ui/Countdown';
import { Link } from '@/i18n/navigation';
import { parseSectionConfig } from '@/lib/cms-schemas';
import { getLivePromotionById, getMediaByIds, getNav, listBundles, listProducts, type HomeSection, type ProductFilters } from '@/lib/data';
import { RichText } from '@/lib/markdown';
import { cmsImage, productImage } from '@/lib/storage';
import type { SiteInfo } from './SiteContext';
import { waLink } from './wa';
import { BundleCard } from './ProductCard';
import { PillarIcon } from './icons';
import { Signatures } from './Signatures';
import { Quotes } from './Testimonials';
import { Title } from './Title';

type Media = Record<string, { storage_path: string; alt_text: string | null }>;
const light = (s: HomeSection) => s.background !== 'green';
const cls = (s: HomeSection, extra = '') => `section${light(s) ? '' : ' section--dark'}${s.background === 'beige' ? ' section--parchment' : ''}${extra ? ` ${extra}` : ''}`;

function Head({ s, center = false, row = false, children }: { s: HomeSection; center?: boolean; row?: boolean; children?: React.ReactNode }) {
  if (!s.title && !s.subtitle && !children) return null;
  return (
    <header className={`section__head reveal${center ? ' section__head--center' : ''}${row ? ' section__head--row' : ''}`}>
      <div>
        {s.subtitle ? <p className="eyebrow">{s.subtitle}</p> : null}
        {s.title ? <h2 className="section__title"><Title text={s.title} /></h2> : null}
      </div>
      {children}
    </header>
  );
}

export async function HomeSectionView({ s, media, site }: { s: HomeSection; media: Media; site: SiteInfo }) {
  const t = await getTranslations();
  switch (s.type) {
    case 'marquee': {
      const c = parseSectionConfig('marquee', s.config);
      const words = c.success ? c.data.words : [];
      const row = (k: string) => words.flatMap((w, i) => [<span key={`${k}w${i}`}>{w}</span>, <b key={`${k}b${i}`}>✦</b>]);
      // Two identical halves so the -50% loop is seamless
      return <div className="marquee" aria-hidden="true"><div className="marquee__track">{row('a')}{row('b')}</div></div>;
    }

    case 'category_tiles': {
      const c = parseSectionConfig('category_tiles', s.config);
      if (!c.success) return null;
      const { categories } = await getNav();
      const picked = c.data.category_ids.map((id) => categories.find((x) => x.id === id)).filter(Boolean) as typeof categories;
      if (!picked.length) return null;
      return (
        <section className={cls(s)} id="collections">
          <div className="container">
            <Head s={s} />
            <div className="collections">
              {picked.map((cat, i) => (
                <Link key={cat.id} href={`/category/${cat.slug}`} className={`collection reveal${i === 1 ? ' collection--tall' : ''}`}>
                  <div className="collection__media">
                    {cat.image_url ? <Image src={cmsImage(cat.image_url)!} alt={cat.name} fill sizes="(max-width: 860px) 78vw, 33vw" /> : null}
                  </div>
                  <div className="collection__body">
                    <span className="collection__num">{String(i + 1).padStart(2, '0')}</span>
                    <h3>{cat.name}</h3>
                    {(cat as { subtitle?: string | null }).subtitle ? <p>{(cat as { subtitle?: string | null }).subtitle}</p> : null}
                    <span className="link-arrow">{t('common.explore')}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case 'product_row': {
      const c = parseSectionConfig('product_row', s.config);
      if (!c.success) return null;
      const cfg = c.data;
      const f: ProductFilters = { perPage: cfg.limit };
      if (cfg.source === 'manual') f.ids = cfg.product_ids ?? [];
      if (cfg.source === 'category') f.category = cfg.category_slug;
      if (cfg.source === 'brand') f.brand = cfg.brand_slug;
      if (cfg.source === 'promotion') f.promotionId = cfg.promotion_id;
      if (cfg.source === 'best') f.sort = 'best';
      if (cfg.source === 'sale') f.onSale = true;
      if (cfg.source === 'featured') f.featured = true;
      const { products } = await listProducts(f).catch(() => ({ products: [] }));
      if (!products.length) return null;
      if (cfg.source === 'manual' && cfg.product_ids) products.sort((a, b) => cfg.product_ids!.indexOf(a.id) - cfg.product_ids!.indexOf(b.id));
      return <Signatures products={products} filters={cfg.filters} viewAll={cfg.view_all} eyebrow={s.subtitle} title={s.title} />;
    }

    case 'promo_banner': {
      const c = parseSectionConfig('promo_banner', s.config);
      if (!c.success) return null;
      const promo = await getLivePromotionById(c.data.promotion_id);
      if (!promo) return null; // only while the promotion is live
      const side = c.data.media_id ? media[c.data.media_id] : null;
      const m = !side && promo.desktop_media_id ? (await getMediaByIds([promo.desktop_media_id]))[promo.desktop_media_id] : null;
      return (
        <section className="section section--dark promo">
          <div className="container">
            <Link href={`/promotions/${promo.slug}`} className={`promo__card reveal${side ? ' promo__card--side' : ''}`}>
              {side ? (
                <div className={`promo__side${c.data.image_fit === 'contain' ? ' promo__side--contain' : ''}`}>
                  <Image src={cmsImage(side.storage_path)!} alt={side.alt_text || promo.name} fill sizes="(max-width: 860px) 100vw, 46vw" />
                </div>
              ) : m ? <Image src={cmsImage(m.storage_path)!} alt={m.alt_text || promo.name} fill sizes="100vw" className="promo__img" /> : null}
              <div className="promo__body">
                <p className="eyebrow">{promo.badge_text || t('common.limitedTime')}</p>
                <h2 className="section__title"><Title text={s.title || promo.name} /></h2>
                {promo.description ? <p className="promo__lead">{promo.description}</p> : null}
                {c.data.countdown && promo.show_countdown ? <p className="promo__count"><Countdown endsAt={promo.ends_at} /></p> : null}
                <span className="btn btn--gold">{(s.config as { button_text?: string }).button_text ? c.data.button_text : t('sections.shopSale')}</span>
              </div>
            </Link>
          </div>
        </section>
      );
    }

    case 'image_text': {
      const c = parseSectionConfig('image_text', s.config);
      if (!c.success) return null;
      const cfg = c.data;
      const img = cfg.media_id ? media[cfg.media_id] : null;
      return (
        <section className={cls(s, 'story')} id="maison">
          <div className={`container story__grid${cfg.image_side === 'right' ? ' story__grid--flip' : ''}`}>
            <div className="story__media reveal">
              <div className="story__frame" data-parallax-img>
                {img ? <Image src={cmsImage(img.storage_path)!} alt={img.alt_text || plainText(cfg.heading)} fill sizes="(max-width: 860px) 100vw, 50vw" /> : null}
              </div>
              {cfg.badge_number != null ? (
                <div className="story__badge">
                  <span className="story__badge-num"><span data-count={cfg.badge_number}>0</span>%</span>
                  <span className="story__badge-txt">{(cfg.badge_text ?? '').split('\n').map((l, i) => <span key={i}>{i ? <br /> : null}{l}</span>)}</span>
                </div>
              ) : null}
            </div>
            <div className="story__copy">
              {s.subtitle ? <p className="eyebrow reveal">{s.subtitle}</p> : null}
              <h2 className="section__title reveal"><Title text={cfg.heading || s.title} /></h2>
              {cfg.body.split(/\n{2,}/).map((para, i) => <div key={i} className="reveal"><RichText text={para} /></div>)}
              {cfg.pillars?.length ? (
                <ul className="pillars reveal">
                  {cfg.pillars.map((p, i) => (
                    <li key={i}>
                      <span className="pillars__icon" aria-hidden="true"><PillarIcon name={p.icon} /></span>
                      <div><h4>{p.title}</h4><p>{p.text}</p></div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {cfg.button_text && cfg.button_link ? <p className="reveal" style={{ marginTop: 32 }}><Link href={cfg.button_link} className="btn btn--ghost btn--on-light">{cfg.button_text}</Link></p> : null}
            </div>
          </div>
        </section>
      );
    }

    case 'notes': {
      const c = parseSectionConfig('notes', s.config);
      // No text saved in the CMS → the built-in explanation, in the page language
      const items = !Array.isArray((s.config as { items?: unknown }).items)
        ? [1, 2, 3].map((n) => ({ title: t(`defaults.note${n}Title`), time: t(`defaults.note${n}Time`), text: t(`defaults.note${n}Text`) }))
        : c.success ? c.data.items : [];
      return (
        <section className="section section--dark notes" id="notes">
          <div className="container">
            <Head s={s} center />
            <div className="pyramid">
              {items.map((it, i) => (
                <article key={i} className="pyramid__item reveal">
                  <span className="pyramid__roman">{['I', 'II', 'III'][i]}</span>
                  <h3>{it.title}</h3>
                  <p className="pyramid__time">{it.time}</p>
                  <p>{it.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case 'bundle_showcase': {
      const c = parseSectionConfig('bundle_showcase', s.config);
      if (!c.success) return null;
      const bundles = await listBundles(c.data.source === 'manual' ? { ids: c.data.bundle_ids ?? [] } : {}).catch(() => []);
      if (!bundles.length) return null;
      return (
        <section className={cls(s)} id="gift-sets">
          <div className="container">
            <Head s={s} row><Link href="/bundles" className="link-arrow" style={{ color: 'var(--gold)' }}>{t('sections.allGiftSets')}</Link></Head>
            <div className="products">{bundles.slice(0, 6).map((b) => <BundleCard key={b.id} b={b} />)}</div>
          </div>
        </section>
      );
    }

    case 'testimonials': {
      const c = parseSectionConfig('testimonials', s.config);
      if (!c.success) return null;
      return (
        <section className="section testimonials">
          <div className="container">
            <Head s={s} center />
            <Quotes quotes={c.data.quotes} />
          </div>
        </section>
      );
    }

    case 'gallery': {
      const c = parseSectionConfig('gallery', s.config);
      let imgs = c.success ? c.data.media_ids.map((id) => media[id]).filter(Boolean).map((m) => ({ src: cmsImage(m.storage_path)!, alt: m.alt_text ?? '' })) : [];
      if (!imgs.length) {
        const { products } = await listProducts({ perPage: 5, featured: true }).catch(() => ({ products: [] }));
        imgs = products.filter((p) => p.image_path).map((p) => ({ src: productImage(p.image_path)!, alt: '' }));
      }
      return (
        <section className="gallery" aria-label={t('sections.gallery')}>
          {imgs.slice(0, 5).map((im, i) => <div key={i} className="gallery__item"><Image src={im.src} alt={im.alt} fill sizes="(max-width: 560px) 50vw, 17vw" /></div>)}
          <a href={site.instagram ?? '#'} className="gallery__cta" target="_blank" rel="noopener noreferrer">
            <span className="eyebrow">{s.subtitle || t('sections.followHouse')}</span>
            <span className="gallery__handle">{site.instagramHandle || 'Instagram'}</span>
          </a>
        </section>
      );
    }

    case 'visit': {
      const c = parseSectionConfig('visit', s.config);
      const cfg = c.success ? c.data : { body: '', media_id: undefined };
      const img = cfg.media_id ? media[cfg.media_id] : null;
      return (
        <section className="section section--dark visit" id="visit">
          <div className="container visit__grid">
            <div className="visit__copy">
              {s.subtitle ? <p className="eyebrow reveal">{s.subtitle}</p> : null}
              <h2 className="section__title reveal"><Title text={s.title || t('sections.visitTitle')} /></h2>
              {cfg.body ? <p className="reveal">{cfg.body}</p> : null}
              <dl className="visit__details reveal">
                {site.address ? <div><dt>{t('sections.address')}</dt><dd>{site.address.split('\n').map((l, i) => <span key={i}>{i ? <br /> : null}{l}</span>)}</dd></div> : null}
                {site.hours ? <div><dt>{t('sections.hours')}</dt><dd>{site.hours.split('\n').map((l, i) => <span key={i}>{i ? <br /> : null}{l}</span>)}</dd></div> : null}
                <div><dt>{t('sections.contact')}</dt><dd>
                  {site.phone ? <a href={`tel:${site.phone.replace(/\s/g, '')}`}>{site.phone}</a> : null}<br />
                  {site.email ? <a href={`mailto:${site.email}`}>{site.email}</a> : null}
                </dd></div>
              </dl>
              <div className="visit__cta reveal">
                <a href={waLink(site.whatsapp, t('wa.enquire'))} className="btn btn--gold" target="_blank" rel="noopener noreferrer">{t('common.chatWhatsApp')}</a>
                {site.maps ? <a href={site.maps} className="btn btn--ghost" target="_blank" rel="noopener noreferrer">{t('sections.directions')}</a> : null}
              </div>
            </div>
            <div className="visit__media reveal" data-parallax-img>
              {img ? <Image src={cmsImage(img.storage_path)!} alt={img.alt_text ?? t('sections.boutique')} fill sizes="(max-width: 860px) 100vw, 45vw" /> : null}
            </div>
          </div>
        </section>
      );
    }

    case 'brand_strip': {
      const c = parseSectionConfig('brand_strip', s.config);
      if (!c.success) return null;
      const { brands } = await getNav();
      const picked = c.data.brand_ids.map((id) => brands.find((b) => b.id === id)).filter(Boolean) as typeof brands;
      const row = (k: string, hidden: boolean) => picked.flatMap((b, i) => [
        <Link key={`${k}w${i}`} href={`/brand/${b.slug}`} tabIndex={hidden ? -1 : undefined} aria-hidden={hidden || undefined}><span>{b.name}</span></Link>,
        <b key={`${k}b${i}`} aria-hidden="true">✦</b>]);
      return <nav className="marquee marquee--links" aria-label={t('sections.ourHouses')}><div className="marquee__track">{row('a', false)}{row('b', true)}</div></nav>;
    }

    case 'trust_badges': {
      const c = parseSectionConfig('trust_badges', s.config);
      if (!c.success) return null;
      return (
        <section className={cls(s, 'section--tight')}>
          <ul className="container pillars pillars--row">
            {c.data.badges.map((b, i) => <li key={i}><span className="pillars__icon" aria-hidden="true"><PillarIcon name={b.icon} /></span><div><h4>{b.text}</h4></div></li>)}
          </ul>
        </section>
      );
    }

    case 'text': {
      const c = parseSectionConfig('text', s.config);
      if (!c.success) return null;
      return (
        <section className={cls(s)}>
          <div className="container prose-tfs">
            <header className="section__head reveal">
              {s.subtitle ? <p className="eyebrow">{s.subtitle}</p> : null}
              <h2 className="section__title"><Title text={c.data.heading || s.title} /></h2>
            </header>
            <div className="reveal"><RichText text={c.data.body} /></div>
          </div>
        </section>
      );
    }
    default:
      return null;
  }
}

const plainText = (t: string | null | undefined) => (t ?? '').replace(/\*/g, '');
