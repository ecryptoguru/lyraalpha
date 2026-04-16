import Link from "next/link";

import { FooterLegalLinks } from "@/components/layout/footer-legal-links";

const footerLinks = [
  { href: "/wallet", label: "Wallet" },
  { href: "/dashboard/lyra", label: "Lyra" },
  { href: "/dashboard/compare", label: "Compare" },
  { href: "/dashboard/stress-test", label: "Scenario Lab" },
  { href: "/methodology", label: "Methodology" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-white/8 bg-[#030712] px-4 py-8 sm:px-6" suppressHydrationWarning>
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-5 rounded-[2rem] border border-white/8 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-teal-300/75">
              LyraAlpha Solana
            </p>
            <h3 className="mt-3 text-2xl font-black tracking-[-0.05em] text-white">
              Solana wallet intelligence, not another crypto wrapper.
            </h3>
            <p className="mt-3 text-sm leading-7 text-white/54">
              Deterministic wallet health, protocol exposure, scenario analysis, and Lyra-led interpretation
              built around one Solana-native workflow.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {footerLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white/62 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-white/8 pt-5 text-sm text-white/40 sm:flex-row sm:items-center">
          <p>&copy; {new Date().getFullYear()} LyraAlpha Solana.</p>
          <FooterLegalLinks />
        </div>
      </div>
    </footer>
  );
}
