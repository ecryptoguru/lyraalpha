import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function LegalPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#040816]">
      <Navbar />
      <main className="flex-1 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-400/80">Legal</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Legal documents
          </h1>
          <p className="mt-5 text-base text-white/55">
            All legal documents governing your use of LyraAlpha AI.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {[
              { title: "Privacy Policy", desc: "How we collect, use and protect your data.", href: "/privacy" },
              { title: "Terms of Service", desc: "The rules and conditions of using LyraAlpha.", href: "/terms" },
            ].map((doc) => (
              <Link
                key={doc.title}
                href={doc.href}
                className="group flex flex-col rounded-2xl border border-white/8 bg-white/3 p-6 transition-colors hover:border-amber-400/20 hover:bg-amber-400/5"
              >
                <p className="font-bold text-white group-hover:text-amber-300 transition-colors">{doc.title}</p>
                <p className="mt-2 text-sm text-white/50">{doc.desc}</p>
                <span className="mt-4 text-[11px] font-bold uppercase tracking-wider text-amber-400/60 group-hover:text-amber-400 transition-colors">Read →</span>
              </Link>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-amber-400/15 bg-amber-400/5 p-5">
            <p className="text-sm font-bold text-amber-300">Investment Disclaimer</p>
            <p className="mt-2 text-sm text-white/55 leading-6">
              LyraAlpha AI provides informational and educational content only. Nothing on this platform constitutes investment advice, financial recommendations or solicitations. Cryptocurrencies and digital assets are highly volatile. Past performance does not indicate future results. You are solely responsible for your investment decisions.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
