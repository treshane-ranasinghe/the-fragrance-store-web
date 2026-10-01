import { Antonio, Cormorant_Garamond, Jost, Noto_Sans_Sinhala, Noto_Serif_Sinhala, Nunito } from 'next/font/google';

// Same families and weights as the original site, exposed as CSS variables (see theme.css)
const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['300', '400', '500', '600'], style: ['normal', 'italic'], variable: '--font-cormorant', display: 'swap' });
const sans = Jost({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-jost', display: 'swap' });
const logo = Nunito({ subsets: ['latin'], weight: ['700', '800', '900'], variable: '--font-nunito', display: 'swap' });
const poster = Antonio({ subsets: ['latin'], weight: ['300', '500', '700'], variable: '--font-antonio', display: 'swap' });

// The Latin fonts have no Sinhala letters, so Sinhala text falls through to these.
// Not preloaded: the browser only downloads them when a page actually contains Sinhala (unicode-range).
const siSerif = Noto_Serif_Sinhala({ subsets: ['sinhala'], variable: '--font-si-serif', display: 'swap', preload: false });
const siSans = Noto_Sans_Sinhala({ subsets: ['sinhala'], variable: '--font-si-sans', display: 'swap', preload: false });

export const fontVariables = [serif, sans, logo, poster, siSerif, siSans].map((f) => f.variable).join(' ');
