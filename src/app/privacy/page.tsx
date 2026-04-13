import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PRIVACY_DOCUMENT } from "@/lib/legal-documents";

export const metadata: Metadata = {
  title: "Privacy Policy | LyraAlpha AI",
  description:
    "LyraAlpha AI privacy policy — how we collect, use, and protect your data across our financial intelligence platform.",
  alternates: { canonical: `${process.env.NEXT_PUBLIC_APP_URL || "https://lyraalpha.xyz"}/privacy` },
  openGraph: {
    title: "Privacy Policy | LyraAlpha AI",
    description: "How LyraAlpha AI collects, uses, and protects your data.",
    url: `${process.env.NEXT_PUBLIC_APP_URL || "https://lyraalpha.xyz"}/privacy`,
  },
  robots: { index: false },
};

export default function PrivacyPage() {
  const doc = PRIVACY_DOCUMENT;

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-background font-sans text-foreground selection:bg-amber-300/30" suppressHydrationWarning>
      <Navbar />
      <main data-scroll-root="landing" className="flex-1 overflow-x-clip overflow-y-auto">
        <section className="px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
          <div className="container mx-auto max-w-5xl px-0">
            <div className="rounded-[2.8rem] border border-slate-200 bg-white/92 p-8 shadow-[0_30px_100px_rgba(15,23,42,0.12)] sm:p-10 dark:border-white/8 dark:bg-white/3 dark:shadow-[0_30px_100px_rgba(0,0,0,0.26)]">
              <header className="space-y-3 border-b border-slate-200 pb-8 dark:border-white/8">
                <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-slate-400 dark:text-white/38">
                  {doc.subtitle} • Updated {doc.updatedAt}
                </p>
                <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
                  <span className="premium-gradient-text">{doc.title}</span>
                </h1>
              </header>

              <div className="mt-8 space-y-6">
                {doc.sections.map((section) => (
                  <section key={section.title} className="rounded-[1.8rem] border border-slate-200 bg-slate-50/90 p-5 dark:border-white/8 dark:bg-black/20">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/90">
                      {section.title}
                    </h2>
                    <div className="mt-4 space-y-3">
                      {section.body.map((paragraph) => (
                        <p
                          key={`${section.title}-${paragraph.slice(0, 32)}`}
                          className="text-sm leading-7 text-muted-foreground"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
