"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/blog", label: "Blog" },
  { href: "/tools", label: "Tools" },
] as const;

export function NavbarLinks() {
  const pathname = usePathname();

  return (
    <>
      {navLinks.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className="hidden rounded-full border border-border/50 bg-white/80 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground dark:border-white/8 dark:bg-white/3 dark:text-white/45 dark:hover:text-white lg:inline-flex"
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
