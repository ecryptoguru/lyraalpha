"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ImportResult {
  symbol: string;
  status: "imported" | "skipped" | "unknown";
  message?: string;
}

interface ImportSummary {
  fileName: string;
  parsedCount: number;
  importedCount: number;
  skippedCount: number;
}

interface PdfImportDialogProps {
  portfolioId: string;
  portfolioName: string;
  region: string;
  onClose: () => void;
  onSuccess: () => void;
}

const SUPPORTED_BROKERS: Record<string, string[]> = {
  IN: ["Zerodha Kite", "Upstox", "Angel One", "Dhan", "Groww", "ICICI Direct", "FYERS", "5paisa"],
  US: ["Fidelity", "Schwab", "E*TRADE", "TD Ameritrade", "Robinhood", "Alpaca", "Webull"],
};

export function PdfImportDialog({
  portfolioId,
  portfolioName,
  region,
  onClose,
  onSuccess,
}: PdfImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [showBrokers, setShowBrokers] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("File too large — max 20 MB");
      return;
    }
    setFile(f);
    setResults(null);
    setSummary(null);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  async function handleImport() {
    if (!file) return;
    setIsImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("replaceExisting", String(replaceExisting));

      const res = await fetch(`/api/portfolio/${portfolioId}/pdf-import`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json() as {
        summary?: ImportSummary;
        results?: ImportResult[];
        warnings?: string[];
        error?: string;
        preview?: string;
      };

      if (!res.ok) {
        if (res.status === 422 && data.preview) {
          toast.error(data.error ?? "No holdings detected", {
            description: "Try the CSV import instead, or ensure this is a holdings/portfolio statement PDF.",
            duration: 8000,
          });
        } else {
          toast.error(data.error ?? "PDF import failed");
        }
        return;
      }

      if (data.summary) setSummary(data.summary);
      if (data.results) setResults(data.results);

      const imported = data.summary?.importedCount ?? 0;
      const skipped = data.summary?.skippedCount ?? 0;

      if (imported > 0) {
        toast.success(`${imported} holding${imported === 1 ? "" : "s"} imported from PDF`, {
          description: skipped > 0 ? `${skipped} symbols not found in asset universe` : undefined,
        });
        onSuccess();
      } else {
        toast.warning("No holdings matched the asset universe", {
          description: "Symbols must exist in our asset database. Try CSV import with manual symbols.",
          duration: 7000,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF import failed");
    } finally {
      setIsImporting(false);
    }
  }

  const brokerList = SUPPORTED_BROKERS[region] ?? SUPPORTED_BROKERS.US;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-xl flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/8 bg-card shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Import from PDF
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {portfolioName} · {region}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-2xl border border-white/8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Info banner */}
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Info className="h-3 w-3" />
                How it works
              </p>
              <button
                type="button"
                onClick={() => setShowBrokers((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <HelpCircle className="h-3 w-3" />
                Supported brokers
                {showBrokers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Upload your broker&apos;s <strong className="text-foreground">account statement</strong> or{" "}
              <strong className="text-foreground">holdings report</strong> PDF. The system extracts symbols, quantities,
              and average prices. Works best with text-based PDFs — scanned image PDFs are not supported.
            </p>
            {showBrokers && (
              <div className="pt-1 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {region === "IN" ? "Indian" : "US"} brokers
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {brokerList.map((b) => (
                    <span
                      key={b}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-white/8 bg-muted/20 text-muted-foreground"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Drop zone — only when no file and no results */}
          {!file && !results && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
                isDragging
                  ? "border-primary/60 bg-primary/8"
                  : "border-white/10 hover:border-primary/40 hover:bg-muted/10",
              )}
            >
              <div className="h-12 w-12 rounded-2xl bg-muted/20 border border-border/30 flex items-center justify-center">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">Drop your PDF here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              </div>
              <p className="text-[10px] text-muted-foreground">.pdf files only · max 20 MB</p>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={onFileChange}
          />

          {/* File selected — pre-import */}
          {file && !results && (
            <div className="rounded-2xl border border-white/8 bg-muted/10 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB · PDF
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <Upload className="h-3 w-3" />
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setSummary(null); setResults(null); }}
                    className="text-[11px] text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </button>
                </div>
              </div>

              {/* Replace existing toggle */}
              <div className="flex items-center justify-between rounded-xl border border-white/8 bg-background/40 px-4 py-3">
                <div>
                  <p className="text-xs font-bold text-foreground">Update existing holdings</p>
                  <p className="text-[11px] text-muted-foreground">
                    If a symbol already exists, overwrite its quantity and average price
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplaceExisting((v) => !v)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full border transition-colors shrink-0",
                    replaceExisting ? "bg-primary border-primary/50" : "bg-muted/30 border-white/10",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                      replaceExisting ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Import results */}
          {results && summary && (
            <div className="space-y-4">
              {/* Summary chips */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/8 bg-muted/10 p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{summary.parsedCount}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Detected</p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                  <p className="text-lg font-bold text-emerald-400">{summary.importedCount}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Imported</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                  <p className="text-lg font-bold text-amber-400">{summary.skippedCount}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Skipped</p>
                </div>
              </div>

              {/* Results table */}
              <div className="rounded-2xl border border-white/8 overflow-hidden">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between px-4 py-2.5 border-b border-white/5 last:border-0 text-xs",
                      r.status === "imported" ? "bg-emerald-500/5" : "bg-amber-500/5",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {r.status === "imported" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      )}
                      <span className="font-bold text-foreground">{r.symbol}</span>
                    </div>
                    <span
                      className={cn(
                        "text-[10px]",
                        r.status === "imported" ? "text-emerald-400" : "text-amber-400",
                      )}
                    >
                      {r.status === "imported" ? "Imported" : (r.message ?? "Skipped")}
                    </span>
                  </div>
                ))}
              </div>

              {summary.skippedCount > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Skipped symbols are not in the {region} asset universe. Use{" "}
                  <strong className="text-foreground">Add Holding</strong> to add them manually if they exist under a
                  different ticker.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-white/8 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 text-sm h-9">
            {results ? "Close" : "Cancel"}
          </Button>
          {!results && (
            <Button
              onClick={handleImport}
              disabled={!file || isImporting}
              className="flex-1 text-sm h-9 gap-1.5"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  Import PDF
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
