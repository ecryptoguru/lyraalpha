"use client";

import { useRegion } from "@/lib/context/RegionContext";
import { FeaturedAsset } from "@/lib/types/dashboard";
import { Item as MotionItem } from "@/components/dashboard/motion-wrapper";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { getFriendlySymbol } from "@/lib/format-utils";

interface FeaturedAssetsProps {
  assets: FeaturedAsset[];
  title?: string;
  currency?: string;
}

export function FeaturedAssets({ assets, title = "Premium Mutual Funds (Delayed NAV)", currency: propCurrency }: FeaturedAssetsProps) {
  const { currency: contextCurrency } = useRegion();
  const currency = propCurrency || contextCurrency;

  if (!assets || assets.length === 0) return null;

  return (
    <MotionItem className="col-span-full">
      <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl p-6">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {title}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {assets.map((asset) => (
            <Link
              key={asset.symbol}
              href={`/dashboard/assets/${asset.symbol}`}
              className="p-4 rounded-2xl border border-white/5 bg-muted/20 hover:bg-muted/30 transition-all group"
            >
              <div className="text-[10px] font-mono text-muted-foreground mb-1">
                {asset.type}
              </div>
              <div className="text-sm font-bold truncate mb-2 group-hover:text-primary transition-colors">
                {getFriendlySymbol(asset.symbol, asset.type, asset.name)}
              </div>
              <div className="flex items-end justify-between">
                <div className="text-lg font-bold tracking-tighter">
                  {currency}
                  {asset.price.toLocaleString()}
                </div>
                <div className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded border border-success/20">
                  DELAYED
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </MotionItem>
  );
}
