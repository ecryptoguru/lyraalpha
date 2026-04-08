"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  DollarSign,
  Brain,
  BarChart3,
  Cpu,
  Server,
  ArrowLeft,
  ShieldCheck,
  Users,
  CreditCard,
  Menu,
  X,
  MessageCircle,
  Coins,
  Mail,
  Sliders,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Analytics",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/users-growth", label: "Users & Growth", icon: Users },
      { href: "/admin/revenue", label: "Revenue", icon: DollarSign },
      { href: "/admin/usage", label: "Usage", icon: BarChart3 },
      { href: "/admin/ai-costs", label: "AI Costs", icon: Brain },
      { href: "/admin/credits", label: "Credits", icon: Coins },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/billing", label: "Billing", icon: CreditCard },
      { href: "/admin/support", label: "Support", icon: MessageCircle },
      { href: "/admin/infrastructure", label: "Infrastructure", icon: Server },
      { href: "/admin/engines-regime", label: "Engines & Regime", icon: Cpu },
      { href: "/admin/ai-limits", label: "AI Limits", icon: Sliders },
      { href: "/admin/waitlist", label: "Waitlist", icon: Mail },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 border-b border-white/5 bg-card/95 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold tracking-tight text-foreground">
            Admin Console
          </span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-xl hover:bg-muted/50 transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <X className="h-5 w-5 text-foreground" />
          ) : (
            <Menu className="h-5 w-5 text-foreground" />
          )}
        </button>
      </div>

      <aside className="hidden lg:flex sticky top-0 h-screen w-56 shrink-0 border-r border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl flex-col">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-white/5">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="text-sm font-bold tracking-tight text-foreground">
            Admin Console
          </span>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/70">
                {group.label}
              </p>
              {group.items.map((item) => {
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/5 px-2 py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-xl z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="lg:hidden fixed top-14 left-0 bottom-0 w-64 z-50 border-r border-white/5 bg-card/95 backdrop-blur-xl flex flex-col">
            <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="space-y-1">
                  <p className="px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/70">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const isActive =
                      item.href === "/admin"
                        ? pathname === "/admin"
                        : pathname.startsWith(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="border-t border-white/5 px-2 py-3">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Dashboard
              </Link>
            </div>
          </aside>
        </>
      )}

      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
