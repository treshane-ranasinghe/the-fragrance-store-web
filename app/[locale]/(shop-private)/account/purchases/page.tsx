import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { money } from '@/components/site/money';
import { BuyAgainButton } from '@/components/store/BuyAgainButton';
import { Link } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/server';
import { formatDate } from '@/lib/format';
import { productImage } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: await pageLocale(params), namespace: 'meta' });
  return { title: t('purchases') };
}

export default async function PurchasesPage({ params }: Props) {
  const locale = await pageLocale(params);
  const supabase = await createClient();
  const [{ data }, t] = await Promise.all([
    supabase.from('my_purchased_products').select('*').order('last_bought_at', { ascending: false }),
    getTranslations(),
  ]);
  return (
    <div>
      <h2 className="ac__h2">{t('account.boughtTitle')}</h2>
      <p className="ac__lead" style={{ marginBottom: 20 }}>{t('account.boughtLead')}</p>
      {!data?.length ? <p className="ac__empty">{t('account.nothingYet')} <Link href="/shop" className="co__link">{t('common.exploreSignatures')}</Link></p> : (
        <div className="ac__order"><ul className="ac__items ac__purchases" style={{ marginTop: 0 }}>
          {data.map((p) => (
            <li key={p.variant_id}>
              <span className="ac__thumb ph-bottle">{productImage(p.image_path) ? <Image src={productImage(p.image_path)!} alt="" fill sizes="56px" /> : null}</span>
              <span>{p.slug ? <Link href={`/product/${p.slug}`}>{p.product_name}</Link> : p.product_name}
                <small>{t('account.boughtMeta', { brand: p.brand_name, size: p.size_ml, times: p.times_bought, total: p.total_quantity, date: formatDate(p.last_bought_at, locale), price: money(p.last_price_paid) })}</small></span>
              <span className="ac__row">
                {p.current_price != null ? <small>{t('account.today', { price: money(p.current_price) })}</small> : null}
                {p.in_stock ? <BuyAgainButton variantId={p.variant_id} /> : <small>{p.current_price == null ? t('account.discontinued') : t('common.soldOut')}</small>}
              </span>
            </li>
          ))}
        </ul></div>
      )}
    </div>
  );
}
