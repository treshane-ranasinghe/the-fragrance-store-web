import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Providers } from '@/components/store/CartProvider';
import { fontVariables } from '@/lib/fonts';

/**
 * Runs before first paint:
 *  - "js" turns on the entrance / reveal animations (without JS everything is simply visible)
 *  - "tfs-seen" skips the intro on repeat visits
 *  - safety net: if the app hasn't started within 5 s (slow network, script failed), drop "js" so the
 *    page shows without animations instead of staying behind the preloader
 *  - if a script chunk fails to load (e.g. after a new deploy), reload once
 */
const BOOT = `(function(){var d=document.documentElement;d.classList.add("js");
try{if(sessionStorage.getItem("tfs-intro")==="1")d.classList.add("tfs-seen")}catch(e){}
setTimeout(function(){if(!d.classList.contains("is-loaded")){d.classList.remove("js");d.classList.add("is-loaded");document.body&&(document.body.style.overflow="")}},5000);
window.addEventListener("error",function(e){var t=e&&e.target;var src=t&&(t.src||t.href)||"";var msg=(e&&e.message)||"";
if(src.indexOf("/_next/static/")>-1||msg.indexOf("ChunkLoadError")>-1||msg.indexOf("Loading chunk")>-1){try{if(sessionStorage.getItem("tfs-reloaded"))return;sessionStorage.setItem("tfs-reloaded","1")}catch(x){return}location.reload()}},true);
window.addEventListener("load",function(){setTimeout(function(){try{sessionStorage.removeItem("tfs-reloaded")}catch(x){}},10000)});})();`;

/**
 * <html> shell shared by the storefront (one per language) and the admin panel; client components get the page's translations.
 * Language, messages and formats are passed explicitly: left to look them up itself, the provider reads the request headers,
 * which breaks cached (ISR) pages such as /si/product/….
 */
export async function RootDocument({ lang, children }: { lang: string; children: React.ReactNode }) {
  const messages = await getMessages({ locale: lang });
  return (
    <html lang={lang} className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Enables the reveal / entrance animations; without JS everything is simply visible */}
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        <NextIntlClientProvider locale={lang} messages={messages} timeZone="Asia/Colombo" formats={{}} now={new Date()}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
