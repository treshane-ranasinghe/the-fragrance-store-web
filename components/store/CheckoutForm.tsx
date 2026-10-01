'use client';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { money } from '@/components/site/money';
import { Title } from '@/components/site/Title';
import { Link, useRouter } from '@/i18n/navigation';
import { placeOrderAction } from '@/lib/actions/checkout';
import { createClient } from '@/lib/supabase/client';
import { DEMO_MODE } from '@/lib/config';
import { translateDbError } from '@/lib/db-errors';
import { LK_PHONE, normalisePhone } from '@/lib/format';
import { productImage } from '@/lib/storage';
import { useCart } from './CartProvider';
import { DistrictOptions } from './DistrictOptions';

interface Address { id: string; full_name: string; phone: string; line1: string; line2: string | null; city: string; district: string; postal_code: string | null; is_default: boolean }
interface Method { id: string; name: string; description: string | null; fee: number; free_over: number | null; cod_allowed: boolean; requires_address?: boolean }
interface Options {
  subtotal: number; delivery_fee: number; cod_fee: number;
  bank: { enabled: boolean; title: string; description: string };
  cod: { enabled: boolean; title: string; description: string; reason: string | null };
}
type PaymentText = { bank: { title: string; description: string }; cod: { title: string; description: string } };
type Fields = { email: string; full_name: string; phone: string; line1: string; line2: string; city: string; district: string; postal_code: string; note: string };

function Field({ k, label, full, children, err }: { k?: string; label: React.ReactNode; full?: boolean; children: React.ReactNode; err?: string }) {
  return (
    <div className={`field${full ? ' field--full' : ''}${err ? ' is-invalid' : ''}`}>
      <label htmlFor={k ? `f-${k}` : undefined}>{label}</label>
      {children}
      {err ? <p className="field__err">{err}</p> : null}
    </div>
  );
}

/** Checkout from checkout.html: 01 Contact · 02 Delivery · 03 Payment, sticky summary, gold "Place order" */
/** `paymentText`: payment method names / descriptions in the page language (checkout_options returns English) */
/** `guest`: not signed in — asks for an email for the confirmation, no saved addresses */
export function CheckoutForm({ addresses, methods, profile, email, guest, paymentText }: {
  addresses: Address[]; methods: Method[]; profile: { full_name: string | null; phone: string | null }; email: string | null; guest: boolean; paymentText: PaymentText;
}) {
  const t = useTranslations();
  const districtName = (d: string) => (t.has(`districts.${d.replace(/\s/g, '')}`) ? t(`districts.${d.replace(/\s/g, '')}`) : d);
  const router = useRouter();
  const { cart, loading, refresh } = useCart();
  const [token] = useState(() => {
    try {
      const saved = sessionStorage.getItem('fs-checkout-token');
      if (saved) return saved;
      const t = crypto.randomUUID(); sessionStorage.setItem('fs-checkout-token', t); return t;
    } catch { return crypto.randomUUID(); }
  });
  const def = addresses.find((a) => a.is_default) ?? addresses[0];
  const [addressId, setAddressId] = useState<string>(def?.id ?? 'new');
  const [methodId, setMethodId] = useState(methods[0]?.id ?? '');
  const [payment, setPayment] = useState<'bank_transfer' | 'cod' | ''>('');
  const [options, setOptions] = useState<Options | null>(null);
  const [f, setF] = useState<Fields>({ email: '', full_name: profile.full_name ?? '', phone: profile.phone ?? '', line1: '', line2: '', city: '', district: '', postal_code: '', note: '' });
  const [save, setSave] = useState(!guest && addresses.length === 0);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const method = methods.find((m) => m.id === methodId);
  const needsAddress = method?.requires_address !== false;

  useEffect(() => {
    if (!methodId) return;
    const load = async () => {
      if (DEMO_MODE) return { subtotal: cart.subtotal, delivery_fee: 0, cod_fee: 0, bank: { enabled: true, ...paymentText.bank }, cod: { enabled: true, ...paymentText.cod, reason: null } } as Options;
      const { data } = await createClient().rpc('checkout_options', { p_delivery_method_id: methodId });
      const o = data as Options;
      return { ...o, bank: { ...o.bank, ...paymentText.bank }, cod: { ...o.cod, ...paymentText.cod, reason: o.cod.reason && translateDbError(o.cod.reason, t) } };
    };
    load().then((o) => {
      setOptions(o);
      setPayment((cur) => (cur === 'cod' && !o.cod.enabled ? (o.bank.enabled ? 'bank_transfer' : '') : cur || (o.cod.enabled ? 'cod' : o.bank.enabled ? 'bank_transfer' : '')));
    });
  }, [methodId, cart.subtotal]);

  const totals = useMemo(() => {
    const sub = Number(cart.subtotal);
    const delivery = !method ? 0 : method.free_over != null && sub >= Number(method.free_over) ? 0 : Number(method.fee);
    const cod = payment === 'cod' ? Number(options?.cod_fee ?? 0) : 0;
    return { sub, delivery, cod, total: sub + delivery + cod };
  }, [cart.subtotal, method, payment, options]);

  const blocked = cart.items.some((l) => !l.available || l.quantity > l.stock);
  if (loading) return <p className="ac__loading">{t('common.loading')}</p>;
  if (!cart.items.length) {
    return (
      <section className="co__empty">
        <p className="eyebrow">{t('cart.eyebrow')}</p>
        <h1 className="section__title"><Title text={t('cart.emptyTitle')} /></h1>
        <p>{t('bag.emptyLead')}</p>
        <Link href="/shop" className="btn btn--gold">{t('common.exploreSignatures')}</Link>
        {cart.orders.length ? <p className="ac__small" style={{ marginTop: 20 }}><Link href="/cart" className="co__link">{t('cart.seeOrders')}</Link></p> : null}
      </section>
    );
  }

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const useSaved = needsAddress && addressId !== 'new';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const saved = addresses.find((a) => a.id === addressId);
    const errs: typeof errors = {};
    if (guest && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) errs.email = t('checkout.errEmail');
    const name = useSaved ? saved!.full_name : f.full_name;
    const phone = useSaved ? saved!.phone : f.phone;
    if (!name.trim() || name.trim().length < 2) errs.full_name = t('checkout.errName');
    if (!LK_PHONE.test(normalisePhone(phone))) errs.phone = t('checkout.errPhone');
    if (needsAddress && !useSaved) {
      if (f.line1.trim().length < 3) errs.line1 = t('checkout.errAddress');
      if (f.city.trim().length < 2) errs.city = t('checkout.errCity');
      if (!f.district) errs.district = t('checkout.errDistrict');
    }
    setErrors(errs);
    if (Object.keys(errs).length) { document.querySelector('.field.is-invalid input, .field.is-invalid select')?.scrollIntoView({ block: 'center' }); return; }
    if (!payment) return setError(t('checkout.errPayment'));
    if (DEMO_MODE) return setError(t('checkout.demo'));

    const address = !needsAddress
      ? { full_name: name, phone: normalisePhone(phone), line1: 'Collect from the boutique', line2: '', city: 'Colombo', district: 'Colombo', postal_code: '' }
      : useSaved
        ? { full_name: saved!.full_name, phone: saved!.phone, line1: saved!.line1, line2: saved!.line2 ?? '', city: saved!.city, district: saved!.district, postal_code: saved!.postal_code ?? '' }
        : { full_name: f.full_name, phone: normalisePhone(f.phone), line1: f.line1, line2: f.line2, city: f.city, district: f.district, postal_code: f.postal_code };
    setBusy(true);
    const res = await placeOrderAction({ checkoutToken: token, email: guest ? f.email.trim() : undefined, address, deliveryMethodId: methodId, paymentMethod: payment, note: f.note, expectedTotal: totals.total, saveAddress: needsAddress && !useSaved && save });
    if (!res.ok) { setBusy(false); setError(translateDbError(res.error, t)); if (res.priceChanged) refresh(); return; }
    try { sessionStorage.removeItem('fs-checkout-token'); } catch { /* ignore */ }
    await refresh();
    router.push(`/order/${res.orderNumber}`);
  };

  return (
    <div className="co__grid">
      <form className="co__form" id="coForm" onSubmit={submit} noValidate>
        <header className="co__intro">
          <p className="eyebrow">{t('checkout.eyebrow')}</p>
          <h1 className="co__title"><Title text={t('checkout.title')} /></h1>
          {email ? <p className="co__account">{t.rich('checkout.signedInAs', { email, b: (c) => <b>{c}</b> })}</p> : null}
          {guest ? <p className="co__account">{t.rich('checkout.guestSignIn', { link: (c) => <Link href="/login?next=/checkout" className="co__link">{c}</Link> })}</p> : null}
        </header>

        <section className="co__step" aria-labelledby="stepContact">
          <h2 id="stepContact"><span>01</span> {t('checkout.contact')}</h2>
          {guest ? (
            <div className="fields">
              <Field k="email" label={t('checkout.email')} full err={errors.email}>
                <input id="f-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} required aria-describedby="f-email-hint" />
                <small id="f-email-hint" className="ac__small">{t('checkout.emailHint')}</small>
              </Field>
            </div>
          ) : null}
          {useSaved ? (
            <p className="ac__small">{t('checkout.useSaved')}</p>
          ) : (
            <div className="fields">
              <Field k="full_name" label={t('checkout.fullName')} full err={errors.full_name}><input id="f-full_name" autoComplete="name" value={f.full_name} onChange={set('full_name')} required /></Field>
              <Field k="phone" label={t('checkout.mobile')} full err={errors.phone}><input id="f-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder={t('checkout.phonePlaceholder')} value={f.phone} onChange={set('phone')} required /></Field>
            </div>
          )}
        </section>

        <section className="co__step" aria-labelledby="stepDelivery">
          <h2 id="stepDelivery"><span>02</span> {t('checkout.delivery')}</h2>
          <div className="choices" role="radiogroup" aria-labelledby="stepDelivery">
            {methods.map((m) => {
              const free = m.free_over != null && totals.sub >= Number(m.free_over);
              return (
                <label key={m.id} className="choice">
                  <input type="radio" name="fulfilment" checked={methodId === m.id} onChange={() => setMethodId(m.id)} />
                  <span className="choice__box">
                    <span className="choice__title">{m.name} <b>{Number(m.fee) === 0 || free ? t('common.free') : money(m.fee)}</b></span>
                    <span className="choice__sub">{m.description}{m.free_over != null && !free ? t('checkout.complimentaryOver', { amount: money(m.free_over) }) : ''}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {needsAddress && addresses.length ? (
            <div className="choices" style={{ marginTop: 18 }} role="radiogroup" aria-label={t('checkout.deliveryAddress')}>
              {addresses.map((a) => (
                <label key={a.id} className="choice">
                  <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                  <span className="choice__box">
                    <span className="choice__title">{a.full_name} <b>{a.phone}</b></span>
                    <span className="choice__sub">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {districtName(a.district)}</span>
                  </span>
                </label>
              ))}
              <label className="choice">
                <input type="radio" name="address" checked={addressId === 'new'} onChange={() => setAddressId('new')} />
                <span className="choice__box"><span className="choice__title">{t('checkout.newAddress')}</span></span>
              </label>
            </div>
          ) : null}

          {needsAddress && !useSaved ? (
            <div className="fields">
              <Field k="line1" label={t('checkout.address')} full err={errors.line1}><input id="f-line1" autoComplete="address-line1" placeholder={t('checkout.addressPlaceholder')} value={f.line1} onChange={set('line1')} /></Field>
              <div className="field field--full"><label htmlFor="f-line2" className="sr-only">{t('checkout.line2')}</label><input id="f-line2" autoComplete="address-line2" placeholder={t('checkout.line2Placeholder')} value={f.line2} onChange={set('line2')} /></div>
              <Field k="city" label={t('checkout.city')} err={errors.city}><input id="f-city" autoComplete="address-level2" value={f.city} onChange={set('city')} /></Field>
              <Field k="district" label={t('checkout.district')} err={errors.district}>
                <select id="f-district" autoComplete="address-level1" value={f.district} onChange={set('district')}>
                  <option value="">{t('checkout.selectDistrict')}</option><DistrictOptions />
                </select>
              </Field>
              {guest ? null : <div className="field field--full"><label className="co__save"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> {t('checkout.saveToAccount')}</label></div>}
            </div>
          ) : null}

          <div className="fields">
            <div className="field field--full">
              <label htmlFor="f-note">{t('checkout.notes')} <small>{t('common.optional')}</small></label>
              <textarea id="f-note" rows={2} placeholder={t('checkout.notesPlaceholder')} value={f.note} onChange={set('note')} />
            </div>
          </div>
        </section>

        <section className="co__step" aria-labelledby="stepPayment">
          <h2 id="stepPayment"><span>03</span> {t('checkout.payment')}</h2>
          {!options ? <p className="ac__small">{t('common.loading')}</p> : (
            <div className="choices" role="radiogroup" aria-labelledby="stepPayment">
              {options.cod.enabled ? (
                <label className="choice">
                  <input type="radio" name="payment" checked={payment === 'cod'} onChange={() => setPayment('cod')} />
                  <span className="choice__box">
                    <span className="choice__title">{options.cod.title} {Number(options.cod_fee) > 0 ? <b>+ {money(options.cod_fee)}</b> : null}</span>
                    <span className="choice__sub">{options.cod.description}</span>
                  </span>
                </label>
              ) : null}
              {options.bank.enabled ? (
                <label className="choice">
                  <input type="radio" name="payment" checked={payment === 'bank_transfer'} onChange={() => setPayment('bank_transfer')} />
                  <span className="choice__box">
                    <span className="choice__title">{options.bank.title}</span>
                    <span className="choice__sub">{options.bank.description}</span>
                  </span>
                </label>
              ) : null}
            </div>
          )}
          <p className="co__paynote" aria-live="polite">
            {options && !options.cod.enabled && options.cod.reason ? `${options.cod.reason}${options.bank.enabled ? ` ${t('checkout.bankAvailable')}` : ''}` : ''}
            {payment === 'bank_transfer' ? t('checkout.bankNote') : payment === 'cod' ? t('checkout.codNote') : ''}
          </p>
        </section>
      </form>

      <aside className="co__summary" aria-labelledby="summaryTitle">
        <div className="co__summary-inner">
          <h2 id="summaryTitle">{t('checkout.summary')} <Link href="/cart" className="co__edit">{t('checkout.editBag')}</Link></h2>
          <ul className="co__items">
            {cart.items.map((l) => (
              <li key={l.id} className="co__item">
                <div className="co__thumb ph-bottle">
                  {productImage(l.image_path) ? <Image src={productImage(l.image_path)!} alt="" fill sizes="60px" /> : null}
                  <b>{l.quantity}</b>
                </div>
                <div className="co__iteminfo">
                  <p className="co__itemhouse">{l.kind === 'bundle' ? t('common.giftSet') : l.brand}</p>
                  <p className="co__itemname">{l.name}</p>
                  <p className="co__itemmeta">{l.kind === 'bundle' ? l.items.map((i) => i.name).join(' + ') : t('common.ml', { size: l.size_ml ?? 0 })}{!l.available || l.quantity > l.stock ? ` · ${t('checkout.notAvailable')}` : ''}</p>
                </div>
                <p className="co__itemprice">{money(l.unit_price * l.quantity)}</p>
              </li>
            ))}
          </ul>
          <dl className="co__totals">
            <div><dt>{t('common.subtotal')}</dt><dd>{money(totals.sub)}</dd></div>
            <div><dt>{t('common.delivery')}</dt><dd>{totals.delivery ? money(totals.delivery) : t('common.free')}</dd></div>
            {totals.cod ? <div><dt>{t('common.cashOnDelivery')}</dt><dd>{money(totals.cod)}</dd></div> : null}
            <div className="co__total"><dt>{t('common.total')}</dt><dd>{money(totals.total)}</dd></div>
          </dl>
          {error ? <p className="co__error" role="alert">{error}</p> : null}
          {blocked ? <p className="co__error" role="alert">{t.rich('checkout.blocked', { link: (c) => <Link href="/cart" className="co__link">{c}</Link> })}</p> : null}
          <button type="submit" form="coForm" className={`btn btn--gold btn--block co__submit${busy ? ' is-busy' : ''}`} disabled={blocked || !payment}>{t('checkout.place')}</button>
          <ul className="co__assure">
            <li>{t('common.authentic')}</li>
            <li>{t('checkout.detailsOnly')}</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
