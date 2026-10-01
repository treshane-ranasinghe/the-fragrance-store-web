/** WhatsApp chat link (usable from server and client components) */
export function waLink(number: string | null | undefined, msg: string) {
  const n = (number ?? '').replace(/\D/g, '');
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
}
