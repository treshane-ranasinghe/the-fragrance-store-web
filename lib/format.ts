const rs = new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Rs. 12,500.00 */
export function formatRs(value: number | string | null | undefined) {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return `Rs. ${rs.format(Number.isFinite(n) ? n : 0)}`;
}

const TZ = 'Asia/Colombo';

/**
 * Sinhala dates are built from our own month names: browsers differ in whether they ship Sinhala date data,
 * and the server and browser must print the same text. Admin and emails use the English default.
 */
const SI_MONTHS = ['ජන', 'පෙබ', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝ', 'සැප්', 'ඔක්', 'නොවැ', 'දෙසැ'];

function siDate(value: string | Date, { year = true, time = false } = {}) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ,
  }).formatToParts(new Date(value)).map((x) => [x.type, x.value]));
  const date = `${p.day} ${SI_MONTHS[Number(p.month) - 1]}${year ? ` ${p.year}` : ''}`;
  return time ? `${date}, ${/pm/i.test(p.dayPeriod) ? 'ප.ව.' : 'පෙ.ව.'} ${p.hour}:${p.minute}` : date;
}

export function formatDate(value: string | Date | null | undefined, locale?: string) {
  if (!value) return '—';
  if (locale === 'si') return siDate(value);
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
}

export function formatDateTime(value: string | Date | null | undefined, locale?: string) {
  if (!value) return '—';
  if (locale === 'si') return siDate(value, { time: true });
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ,
  });
}

/** "1 Oct, 6:30 PM" */
export function formatDeadline(value: string | Date | null | undefined, locale?: string) {
  if (!value) return '—';
  if (locale === 'si') return siDate(value, { year: false, time: true });
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
}

export function timeAgo(value: string | Date) {
  const s = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (s < 60) return `${Math.max(s, 0)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Sri Lankan mobile: 07XXXXXXXX or +947XXXXXXXX */
export const LK_PHONE = /^(07\d{8}|\+947\d{8})$/;
export function normalisePhone(p: string) {
  return p.replace(/\s|-/g, '');
}
export function isValidPhone(p: string) {
  return LK_PHONE.test(normalisePhone(p));
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const SL_DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota', 'Jaffna',
  'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala',
  'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
];
