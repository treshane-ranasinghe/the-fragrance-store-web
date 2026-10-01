/**
 * Errors raised by the database functions (supabase/migrations/*_rpc.sql) are English sentences.
 * The ones customers can see are matched here and shown in the page language; anything else is shown as is.
 * Keep these patterns in step with the `raise exception` texts.
 */
const PATTERNS: [RegExp, string, string[]][] = [
  [/^PRICE_CHANGED:\s*Prices in your cart have been updated\. The new total is Rs\. ([\d,.]+)\./, 'priceChanged', ['amount']],
  [/^This item is no longer available$/, 'noLongerAvailable', []],
  [/^You can buy up to (\d+) of this set$/, 'buyUpToSet', ['max']],
  [/^You can buy up to (\d+) of (.+)$/, 'buyUpTo', ['max', 'name']],
  [/^Only (\d+) left of (.+)$/, 'onlyLeftOf', ['count', 'name']],
  [/^Only (\d+) left$/, 'onlyLeft', ['count']],
  [/^(.+) is no longer available\. Please remove it from your cart\.$/, 'removeFromCart', ['name']],
  [/^(.+) is no longer available$/, 'itemNoLongerAvailable', ['name']],
  [/^(.+) is out of stock$/, 'outOfStock', ['name']],
  [/^Cash on Delivery is not available right now\.?$/, 'codUnavailable', []],
  [/^Cash on Delivery isn't available for this mobile number\. Please pay by bank transfer\.$/, 'codPhone', []],
  [/^Cash on Delivery isn't available for (.+?)\.?$/, 'codNotForMethod', ['method']],
  [/^Cash on Delivery is available for orders up to Rs\. ([\d,.]+)\.$/, 'codUpTo', ['amount']],
  [/^Cash on Delivery is only available for orders up to Rs\. ([\d,.]+)$/, 'codOnlyUpTo', ['amount']],
  [/^Cash on Delivery isn't available on this account\. Please pay by bank transfer\.$/, 'codAccount', []],
  [/^Please log in to place your order$/, 'logIn', []],
  [/^Please log in or create an account to place your order$/, 'logInOrCreate', []],
  [/^Please enter a valid email address$/, 'validEmail', []],
  [/^Invalid checkout session, please refresh the page$/, 'invalidSession', []],
  [/^Please complete your delivery address$/, 'completeAddress', []],
  [/^Please enter a valid Sri Lankan mobile number/, 'validPhone', []],
  [/^Please choose a delivery method$/, 'chooseDelivery', []],
  [/^Please choose a payment method$/, 'choosePayment', []],
  [/^Your cart is empty$/, 'cartEmpty', []],
  [/^Bank transfer is not available right now$/, 'bankUnavailable', []],
  [/^Please give a reason for cancelling$/, 'giveReason', []],
  [/^This order can no longer be cancelled online\. Please contact us\.$/, 'cannotCancel', []],
  [/^Orders that have been shipped cannot be cancelled\./, 'shippedCannotCancel', []],
  [/^Order not found$/, 'orderNotFound', []],
];

/** `t` is an un-namespaced translator (useTranslations() / getTranslations()) */
export function translateDbError(message: string, t: (key: string, values?: Record<string, string>) => string) {
  for (const [re, key, names] of PATTERNS) {
    const m = re.exec(message);
    if (m) return t(`db.${key}`, Object.fromEntries(names.map((n, i) => [n, m[i + 1]])));
  }
  return message.replace(/^PRICE_CHANGED:\s*/, '');
}
