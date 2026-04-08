"use client";

import { useState } from "react";
import { Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { BrokerNormalizationResult } from "@/lib/types/broker";
import { BrokerNormalizationResultSchema } from "@/lib/schemas";

interface BrokerImportDialogProps {
  portfolioName: string;
  onClose: () => void;
  onImport: (snapshot: BrokerNormalizationResult, replaceExisting: boolean) => Promise<unknown>;
}

const SAMPLE_SNAPSHOT = `{
  "snapshot": {
    "provider": "zerodha",
    "region": "IN",
    "capturedAt": "2026-03-20T00:00:00.000Z",
    "accounts": [],
    "holdings": [],
    "positions": [],
    "transactions": [],
    "cashBalances": [],
    "sourcePayloads": [],
    "warnings": [],
    "confidence": 1
  },
  "provider": "zerodha",
  "region": "IN",
  "connectorVersion": "1.0.0",
  "normalizedAt": "2026-03-20T00:00:00.000Z",
  "sourceCount": 1,
  "accountCount": 1,
  "holdingCount": 0,
  "positionCount": 0,
  "transactionCount": 0,
  "warnings": []
}`;

export function BrokerImportDialog({ portfolioName, onClose, onImport }: BrokerImportDialogProps) {
  const [payload, setPayload] = useState(SAMPLE_SNAPSHOT);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let parsed: BrokerNormalizationResult;
    try {
      const raw: unknown = JSON.parse(payload);
      const result = BrokerNormalizationResultSchema.safeParse(raw);
      if (!result.success) {
        const first = result.error.issues[0];
        setError(`Schema error at ${first.path.join(".") || "root"}: ${first.message}`);
        return;
      }
      parsed = result.data;
    } catch {
      setError("Paste valid JSON before importing.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onImport(parsed, replaceExisting);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import broker snapshot");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="w-[calc(100%-1rem)] max-w-2xl gap-0 overflow-hidden border-white/10 bg-card/95 p-0 backdrop-blur-xl">
        <DialogHeader className="border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                Import broker snapshot
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Paste a normalized broker payload for <span className="font-medium text-foreground">{portfolioName}</span>. The service will deduplicate holdings, update matching assets, and refresh portfolio health.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground">
            Import payloads must match the normalized broker contract. Keep raw provider payloads inside <code className="font-mono text-foreground">snapshot.sourcePayloads</code>; the service will only write canonical holdings into the portfolio.
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Normalized broker JSON</label>
            <Textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              className={cn("min-h-[280px] font-mono text-[11px] leading-relaxed", error && "border-red-400/50")}
              spellCheck={false}
            />
            {error && <p className="text-[11px] text-red-400">{error}</p>}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-muted/20 px-4 py-3">
            <div>
              <p className="text-xs font-bold text-foreground">Overwrite matching holdings</p>
              <p className="text-[11px] text-muted-foreground">When enabled, imported holdings replace the same symbols in this portfolio.</p>
            </div>
            <button
              type="button"
              onClick={() => setReplaceExisting((value) => !value)}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-3 text-[11px] font-bold uppercase tracking-widest transition-colors",
                replaceExisting
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-white/10 bg-background/60 text-muted-foreground",
              )}
            >
              {replaceExisting ? "Replace On" : "Replace Off"}
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 gap-2 text-sm h-9">
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 gap-2 text-sm h-9">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  Import Snapshot
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
