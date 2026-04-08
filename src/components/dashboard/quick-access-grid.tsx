"use strict";

import { Activity, Globe, Sparkles, ArrowRight, BarChart3 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function QuickAccessGrid() {
  const actions = [
    {
      label: "Asset Intel",
      desc: "Breakout signals",
      href: "/dashboard/assets",
      color: "bg-amber-500",
      border: "border-amber-500/20",
      icon: Activity,
    },
    {
      label: "Crypto Trends",
      desc: "On-chain Alpha",
      href: "/dashboard/assets?type=crypto",
      color: "bg-emerald-500",
      border: "border-emerald-500/20",
      icon: Globe,
    },
    {
      label: "Deep Dive",
      desc: "AI Strategist",
      href: "/dashboard",
      color: "bg-amber-500",
      border: "border-amber-500/20",
      icon: Sparkles,
    },
    {
       label: "Portfolio",
       desc: "Risk Analysis",
       href: "/dashboard/portfolio",
       color: "bg-teal-500",
       border: "border-teal-500/20",
       icon: BarChart3,
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {actions.map((action, i) => (
        <Link key={i} href={action.href} className="group relative h-full">
          <div className={cn(
            "h-full flex flex-col justify-between border bg-card/40 backdrop-blur-2xl p-4 rounded-2xl transition-all duration-500 active:scale-95 overflow-hidden group-hover:bg-card/60",
            action.border
          )}>
            {/* Hover Gradient */}
            <div className={cn(
              "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-linear-to-br",
              action.color.replace("bg-", "from-").concat(" to-transparent")
            )} />
            
            <div className="relative z-10 flex justify-between items-start">
               <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center bg-muted/50 border border-white/5 group-hover:border-primary/40 transition-colors shadow-sm",
              )}>
                <action.icon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                  <ArrowRight className="h-4 w-4 text-primary" />
              </div>
            </div>

            <div className="relative z-10 mt-4">
              <h4 className="font-bold text-foreground tracking-tight text-sm leading-tight">
                {action.label}
              </h4>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wider">
                {action.desc}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
