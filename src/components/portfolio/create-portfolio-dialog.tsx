"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { X, Briefcase, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Region } from "@/lib/context/RegionContext";

interface CreatePortfolioDialogProps {
  region: Region;
  onClose: () => void;
  onCreate: (body: { name: string; description?: string; currency: string; region: string }) => Promise<unknown>;
}

export function CreatePortfolioDialog({ region, onClose, onCreate }: CreatePortfolioDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState("");

  const currency = region === "IN" ? "INR" : "USD";
  const currencySymbol = region === "IN" ? "₹" : "$";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Portfolio name is required");
      return;
    }
    setNameError("");
    setIsSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        currency,
        region,
      });
      toast.success(`Portfolio "${name.trim()}" created`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create portfolio";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-xl flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/5 bg-card shadow-2xl p-6 space-y-5 max-h-[calc(100dvh-2rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Briefcase className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">New Portfolio</h2>
              <p className="text-[10px] text-muted-foreground">{region} · {currencySymbol} {currency}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-2xl border border-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="portfolio-name" className="text-xs font-bold">
              Portfolio Name
            </Label>
            <Input
              id="portfolio-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Growth Portfolio"
              className={cn("text-sm", nameError && "border-danger/50")}
              maxLength={100}
              autoFocus
            />
            {nameError && <p className="text-[11px] text-danger">{nameError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="portfolio-desc" className="text-xs font-bold">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="portfolio-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Long-term L1 + DeFi mix"
              className="text-sm"
              maxLength={500}
            />
          </div>

          <div className="rounded-2xl bg-muted/20 border border-border/30 p-3 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Portfolio Settings</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Region</span>
              <span className="text-xs font-bold text-foreground">{region}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Currency</span>
              <span className="text-xs font-bold text-foreground">{currencySymbol} {currency}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 text-sm h-9">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 text-sm h-9">
              {isSubmitting ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Creating…</>
              ) : (
                "Create Portfolio"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
