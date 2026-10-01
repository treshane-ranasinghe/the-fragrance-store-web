/** Icons from the original site (stroke / fill set by styles.css) */
export const WA_PATH = 'M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.8 11.8 0 004.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 001.8-1.2 2.2 2.2 0 00.1-1.2c0-.1-.2-.2-.4-.3z';
export const BAG_PATH = 'M5 8h14l-1.2 12.2a1 1 0 01-1 .8H7.2a1 1 0 01-1-.8zM9 8V6.5a3 3 0 016 0V8';

export function WaIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={WA_PATH} /></svg>;
}
export function BagIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={BAG_PATH} /></svg>;
}
export function PillarIcon({ name }: { name: string }) {
  const d: Record<string, string> = {
    star: 'M12 2l2.4 5.6L20 9l-4.2 4 1 6L12 16l-4.8 3 1-6L4 9l5.6-1.4z',
    truck: 'M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z',
    chat: 'M4 5h16v11H8l-4 4z',
    shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z',
    cash: 'M3 6h18v12H3zM12 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    gift: 'M3 9h18v4H3zM5 13v8h14v-8M12 9v12',
    heart: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z',
    leaf: 'M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19 14 10',
    phone: 'M5 3h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A17 17 0 013 5a2 2 0 012-2z',
  };
  return <svg viewBox="0 0 24 24"><path d={d[name] ?? d.star} /></svg>;
}
