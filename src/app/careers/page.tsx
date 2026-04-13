import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function CareersPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#040816]">
      <Navbar />
      <main className="flex-1 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-400/80">Careers</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Join LyraAlpha.<br />
            <span className="text-amber-400">Build the future of finance intelligence.</span>
          </h1>
          <p className="mt-6 text-base text-white/55 leading-7">
            We are a small, focused team building the intelligence layer for serious investors. We move fast, care deeply about correctness, and believe financial AI should be grounded — not hallucinated.
          </p>

          <div className="mt-12 rounded-3xl border border-white/8 bg-white/3 p-8 text-center">
            <p className="text-lg font-bold text-white">No open roles right now</p>
            <p className="mt-3 text-sm text-white/50 leading-6">
              We hire slowly and deliberately. If you are exceptional at what you do and care about building trustworthy financial tools, send us a note anyway.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-5 py-2.5 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-400/20"
            >
              Get in touch
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
