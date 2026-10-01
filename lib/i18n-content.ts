import 'server-only';
import { getLocale } from 'next-intl/server';
import { routing, type Locale } from '@/i18n/routing';

/**
 * Shop content (products, categories, homepage sections…) keeps its translations in an `i18n` jsonb column:
 *   { "si": { "description": "…", "config": { "body": "…" } } }
 * In Sinhala those values are laid over the English row; anything not translated stays English.
 * Joined rows come through views as `<prefix>_i18n` (store_products.category_i18n → category_name).
 */

/** In Sinhala, an untranslated SEO title / description would beat the translated page title, so drop it */
const ENGLISH_ONLY_UNLESS_TRANSLATED = ['seo_title', 'seo_description'];

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);
const filled = (v: unknown) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0);

/** Lay `over` onto `base`: empty values are ignored, objects merge, arrays merge item by item */
function overlay(base: unknown, over: unknown): unknown {
  if (!filled(over)) return base;
  if (isObject(base) && isObject(over)) {
    const out: Json = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = overlay(base[k], v);
    return out;
  }
  if (Array.isArray(base) && Array.isArray(over) && base.some(isObject)) {
    return base.map((b, i) => overlay(b, over[i]));
  }
  return over;
}

function localizeRow(row: Json, locale: Locale): Json {
  let out: Json = {};
  const joined: [string, unknown][] = [];
  for (const [k, v] of Object.entries(row)) {
    if (k === 'i18n') continue;
    if (k.endsWith('_i18n')) { joined.push([k.slice(0, -'_i18n'.length), v]); continue; }
    out[k] = v;
  }
  if (locale === routing.defaultLocale) return out;

  const own = isObject(row.i18n) ? row.i18n[locale] : null;
  if (isObject(own)) out = overlay(out, own) as Json;
  for (const k of ENGLISH_ONLY_UNLESS_TRANSLATED) if (k in out && !(isObject(own) && filled(own[k]))) out[k] = null;
  for (const [prefix, tr] of joined) {
    const t = isObject(tr) ? tr[locale] : null;
    if (isObject(t)) for (const [f, v] of Object.entries(t)) if (filled(v)) out[`${prefix}_${f}`] = v;
  }
  return out;
}

/** Walks any query result (rows, arrays, { products: [...] }…) and localizes every row that carries translations */
export function localizeDeep<T>(value: T, locale: Locale): T {
  if (Array.isArray(value)) return value.map((v) => localizeDeep(v, locale)) as T;
  if (!isObject(value)) return value;
  const hasI18n = Object.keys(value).some((k) => k === 'i18n' || k.endsWith('_i18n'));
  const row = hasI18n ? localizeRow(value, locale) : value;
  const out: Json = {};
  for (const [k, v] of Object.entries(row)) out[k] = Array.isArray(v) || isObject(v) ? localizeDeep(v, locale) : v;
  return out as T;
}

export const localizeRows = <T,>(rows: T, locale: Locale) => localizeDeep(rows, locale);

/** The language of the current request ("en" outside the storefront, e.g. API routes without ?locale) */
export async function contentLocale(): Promise<Locale> {
  try {
    return (await getLocale()) as Locale;
  } catch {
    return routing.defaultLocale;
  }
}

/** Wraps a data loader so its result comes back in the current page language */
export function localized<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => localizeDeep(await fn(...args), await contentLocale());
}
