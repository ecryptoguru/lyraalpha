import Link from "next/link";
import { Github, Linkedin, Twitter } from "lucide-react";

import { FooterLegalLinks } from "@/components/layout/footer-legal-links";
import { FooterNewsletterForm } from "@/components/layout/footer-newsletter-form";

const footerLinks = {
  platform: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/tools", label: "Tools" },
    { href: "/pricing", label: "Pricing" },
    { href: "/methodology", label: "Methodology" },
    { href: "/api", label: "API" },
  ],
  resources: [
    { href: "/blog", label: "Blog" },
    { href: "/methodology", label: "Methodology" },
    { href: "/tools", label: "Free Tools" },
  ],
  company: [
    { href: "/about", label: "About" },
    { href: "/careers", label: "Careers" },
    { href: "/contact", label: "Contact" },
    { href: "/legal", label: "Legal" },
  ],
} as const;

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/8 bg-[#030712] px-4 pb-8 pt-10 sm:px-6" suppressHydrationWarning>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_22%,transparent_78%,rgba(245,158,11,0.06))]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-px w-[min(72rem,92vw)] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(245,158,11,0.35),transparent)]" />

      <div className="container relative mx-auto max-w-7xl px-0" suppressHydrationWarning>
        <div className="rounded-[2.5rem] border border-white/8 bg-white/2 p-6 shadow-[0_20px_68px_rgba(0,0,0,0.2)] sm:p-8">

          {/* Top row: brand + nav + newsletter */}
          <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr_0.85fr]">

            {/* Brand */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.36em] text-amber-200/65">
                InsightAlpha AI
              </p>
              <h3 className="mt-3 text-xl font-bold tracking-[-0.05em] text-white sm:text-2xl">
                Built for disciplined investors.
              </h3>
              <p className="mt-3 text-sm leading-7 text-white/54">
                Market intelligence for investors who want clearer reasoning, cleaner tools and more signal per decision.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {[Twitter, Linkedin, Github].map((Icon, index) => (
                  <Link
                    key={index}
                    href="#"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/3 text-white/54 transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-300/18 hover:bg-amber-300/8 hover:text-amber-100"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Nav — all 3 groups side by side */}
            <div className="grid grid-cols-3 gap-6">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/38">Platform</h4>
                <ul className="mt-4 space-y-2">
                  {footerLinks.platform.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className="block py-1 text-sm text-white/58 transition-colors hover:text-amber-100">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/38">Resources</h4>
                <ul className="mt-4 space-y-2">
                  {footerLinks.resources.map((item) => (
                    <li key={item.label}>
                      <Link href={item.href} className="block py-1 text-sm text-white/58 transition-colors hover:text-amber-100">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/38">Company</h4>
                <ul className="mt-4 space-y-2">
                  {footerLinks.company.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className="block py-1 text-sm text-white/58 transition-colors hover:text-amber-100">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Newsletter */}
            <div className="rounded-3xl border border-amber-300/16 bg-amber-300/6 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-100/70">
                Market intelligence list
              </p>
              <p className="mt-3 text-sm leading-6 text-white/58">
                Get launch updates, product notes and occasional market insight.
              </p>
              <FooterNewsletterForm />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-white/8 pt-5 text-sm text-white/40 sm:flex-row sm:items-center">
          <p className="text-white/40">&copy; {new Date().getFullYear()} InsightAlpha AI. All rights reserved.</p>
          <FooterLegalLinks />
        </div>
      </div>
    </footer>
  );
}
