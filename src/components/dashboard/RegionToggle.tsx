"use client";

import { Suspense } from "react";
import { useRegion, type Region } from "@/lib/context/RegionContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

function RegionSearchParamsSync() {
  const { region, setRegion } = useRegion();
  const searchParams = useSearchParams();

  useEffect(() => {
    const marketParam = searchParams.get("market");
    if (marketParam === "US" || marketParam === "IN") {
      if (marketParam !== region) {
        setRegion(marketParam as Region);
      }
    }
  }, [searchParams, region, setRegion]);

  return null;
}

export function RegionToggle() {
  const { region, setRegion, mounted } = useRegion();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!mounted) {
    return (
      <div
        className="w-[72px] sm:w-[120px] h-9 bg-muted/20 animate-pulse rounded-2xl"
        suppressHydrationWarning={true}
      />
    );
  }

  const handleTabChange = (value: string) => {
    const newRegion = value as Region;
    setRegion(newRegion);

    const params = new URLSearchParams(searchParams.toString());
    params.set("market", newRegion);
    if (newRegion === region) {
      return;
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <>
      <Suspense fallback={null}>
        <RegionSearchParamsSync />
      </Suspense>
      <div
        className="flex items-center rounded-2xl border border-border/70 bg-background/75 p-1.5 backdrop-blur-2xl shadow-[0_10px_30px_rgba(0,0,0,0.16)] shrink-0"
        suppressHydrationWarning={true}
      >
        <Tabs
          id="region-selector-tabs"
          value={region}
          onValueChange={handleTabChange}
          className="w-[80px] sm:w-[140px]"
        >
          <TabsList className="grid h-10 w-full grid-cols-2 gap-1 bg-transparent p-0">
            <TabsTrigger
              value="US"
              className={cn(
                "h-full min-h-[38px] cursor-pointer rounded-2xl gap-1 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-200 sm:gap-2",
                region === "US"
                  ? "border border-cyan-400/70 bg-linear-to-b from-cyan-500/80 to-cyan-400/60 text-cyan-950 ring-1 ring-cyan-400/60 shadow-[0_0_0_1px_rgba(0,212,255,0.35),0_12px_32px_rgba(0,212,255,0.45)] scale-[1.03]"
                  : "border border-transparent text-muted-foreground hover:border-primary/20 hover:bg-primary/10 hover:text-primary",
              )}
            >
              <span className={cn("drop-shadow-sm transition-transform", region === "US" && "scale-115 drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]")}>🇺🇸</span>
              <span className={cn("hidden sm:inline", region === "US" && "font-extrabold")}>US</span>
            </TabsTrigger>
            <TabsTrigger
              value="IN"
              className={cn(
                "h-full min-h-[38px] cursor-pointer rounded-2xl gap-1 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-200 sm:gap-2",
                region === "IN"
                  ? "border border-cyan-400/70 bg-linear-to-b from-cyan-500/80 to-cyan-400/60 text-cyan-950 ring-1 ring-cyan-400/60 shadow-[0_0_0_1px_rgba(0,212,255,0.35),0_12px_32px_rgba(0,212,255,0.45)] scale-[1.03]"
                  : "border border-transparent text-muted-foreground hover:border-primary/20 hover:bg-primary/10 hover:text-primary",
              )}
            >
              <span className={cn("drop-shadow-sm transition-transform", region === "IN" && "scale-115 drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]")}>🇮🇳</span>
              <span className={cn("hidden sm:inline", region === "IN" && "font-extrabold")}>IN</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </>
  );
}
