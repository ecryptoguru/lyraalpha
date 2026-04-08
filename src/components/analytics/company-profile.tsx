"use client";

import { cn } from "@/lib/utils";
import { Building2, Globe, Users, MapPin } from "lucide-react";

interface CompanyProfileProps {
  description?: string | null;
  industry?: string | null;
  sector?: string | null;
  website?: string | null;
  employees?: number | null;
  country?: string | null;
  assetName?: string;
  className?: string;
}

export function CompanyProfile({
  description,
  industry,
  sector,
  website,
  employees,
  country,
  assetName,
  className,
}: CompanyProfileProps) {
  if (!description && !industry) return null;

  return (
    <div className={cn("rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl backdrop-blur-xl", className)}>
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          About {assetName || "Company"}
        </h3>
        <div className="flex items-center gap-2">
          {industry && (
            <span className="px-2 py-0.5 rounded-xl bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary uppercase tracking-wider">
              {industry}
            </span>
          )}
          {sector && sector !== industry && (
            <span className="px-2 py-0.5 rounded-xl bg-muted/50 border border-white/5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
              {sector}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {description && (
          <div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        )}

        {(website || employees || country) && (
          <div className="flex items-center gap-4 pt-2 border-t border-border/30 flex-wrap">
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Globe className="w-3 h-3" />
                {website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            )}
            {employees && employees > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <Users className="w-3 h-3" />
                {employees.toLocaleString()} employees
              </div>
            )}
            {country && (
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {country}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
