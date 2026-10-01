import { PageHead } from '@/components/site/PageHead';

/** Info pages: dark heading band under the glass nav, then the ivory "light section" surface for the text */
export function InfoPage({ title, eyebrow, intro, children }: { title: string; eyebrow: string; intro?: string; children: React.ReactNode }) {
  return (
    <>
      <section className="section section--dark page page--head">
        <div className="container"><PageHead crumbs={[{ name: title.replace(/\*/g, '') }]} eyebrow={eyebrow} title={title} intro={intro} /></div>
      </section>
      <section className="section section--info">
        <div className="container"><article className="prose-tfs">{children}</article></div>
      </section>
    </>
  );
}
