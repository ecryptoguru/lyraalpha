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
  Download,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ParsedRow {
  symbol: string;
  quantity: number;
  avgPrice: number;
  rawSymbol: string;
  rawQty: string;
  rawPrice: string;
  error?: string;
}

interface ImportResult {
  symbol: string;
  status: "imported" | "skipped" | "error";
  message?: string;
}

interface CsvImportDialogProps {
  portfolioId: string;
  portfolioName: string;
  region: string;
  onAdd: (portfolioId: string, body: { symbol: string; quantity: number; avgPrice: number }) => Promise<unknown>;
  onClose: () => void;
}

const US_SAMPLE_CSV = `symbol,quantity,avgPrice
BTC-USD,0.5,95000.00
ETH-USD,3,3100.00
SOL-USD,40,150.00
BNB-USD,10,580.00
`;

const IN_SAMPLE_CSV = `symbol,quantity,avgPrice
BTC-USD,0.5,95000.00
ETH-USD,3,3100.00
SOL-USD,40,150.00
XRP-USD,1500,2.10
`;

function getSampleCsv(region: string): string {
  return region === "IN" ? IN_SAMPLE_CSV : US_SAMPLE_CSV;
}

const COLUMN_ALIASES: Record<string, string> = {
  // symbol
  symbol: "symbol", ticker: "symbol", crypto: "symbol", scrip: "symbol", asset: "symbol",
  name: "symbol", code: "symbol", isin: "symbol",
  // quantity
  quantity: "quantity", qty: "quantity", shares: "quantity", units: "quantity",
  lots: "quantity", holding: "quantity", holdings: "quantity", amount: "quantity",
  // avgPrice
  avgprice: "avgPrice", avg_price: "avgPrice", averageprice: "avgPrice",
  average_price: "avgPrice", buyprice: "avgPrice", buy_price: "avgPrice",
  price: "avgPrice", costbasis: "avgPrice", cost_basis: "avgPrice",
  avgcost: "avgPrice", avg_cost: "avgPrice", purchaseprice: "avgPrice",
};

function normaliseHeader(raw: string): string {
  return COLUMN_ALIASES[raw.toLowerCase().replace(/[\s_-]/g, "")] ?? raw;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => normaliseHeader(h.trim().replace(/^["']|["']$/g, "")));

  const symbolIdx = headers.findIndex((h) => h === "symbol");
  const qtyIdx = headers.findIndex((h) => h === "quantity");
  const priceIdx = headers.findIndex((h) => h === "avgPrice");

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));

    const rawSymbol = symbolIdx >= 0 ? (cols[symbolIdx] ?? "") : "";
    const rawQty = qtyIdx >= 0 ? (cols[qtyIdx] ?? "") : "";
    const rawPrice = priceIdx >= 0 ? (cols[priceIdx] ?? "") : "";

    if (!rawSymbol) continue;

    const symbol = rawSymbol.toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    const quantity = parseFloat(rawQty.replace(/,/g, ""));
    const avgPrice = parseFloat(rawPrice.replace(/,/g, "").replace(/[$₹€£]/g, ""));

    let error: string | undefined;
    if (!symbol) error = "Missing symbol";
    else if (isNaN(quantity) || quantity <= 0) error = "Invalid quantity";
    else if (isNaN(avgPrice) || avgPrice <= 0) error = "Invalid price";

    rows.push({ symbol, quantity, avgPrice, rawSymbol, rawQty, rawPrice, error });
  }

  return rows;
}

function downloadSample(region: string) {
  const blob = new Blob([getSampleCsv(region)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "portfolio-sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function getCurrencySymbol(region: string): string {
  return region === "IN" ? "₹" : "$";
}

export function CsvImportDialog({ portfolioId, portfolioName, region, onAdd, onClose }: CsvImportDialogProps) {
  const currencySymbol = getCurrencySymbol(region);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    setResults(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      setShowPreview(true);
    };
    reader.readAsText(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv" || file.type === "text/plain")) {
      handleFile(file);
    } else {
      toast.error("Please drop a .csv file");
    }
  };

  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const validRows = rows.filter((r) => !r.error);

  async function handleImport() {
    if (validRows.length === 0) return;
    setIsImporting(true);
    const importResults: ImportResult[] = [];

    for (const row of validRows) {
      try {
        await onAdd(portfolioId, {
          symbol: row.symbol,
          quantity: row.quantity,
          avgPrice: row.avgPrice,
        });
        importResults.push({ symbol: row.symbol, status: "imported" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed";
        importResults.push({ symbol: row.symbol, status: "error", message: msg });
      }
    }

    setResults(importResults);
    setIsImporting(false);

    const imported = importResults.filter((r) => r.status === "imported").length;
    const failed = importResults.filter((r) => r.status === "error").length;

    if (imported > 0) {
      toast.success(`${imported} holding${imported === 1 ? "" : "s"} imported`, {
        description: failed > 0 ? `${failed} failed — check results below` : undefined,
      });
    }
    if (imported === importResults.length) {
      setTimeout(onClose, 1200);
    }
  }

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
              Import from CSV
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
          {/* Format hint */}
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-primary">Accepted CSV format</p>
              <button
                type="button"
                onClick={() => downloadSample(region)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="h-3 w-3" />
                Download sample
              </button>
            </div>
            <code className="block text-[10px] font-mono text-muted-foreground leading-relaxed whitespace-pre">
              {region === "IN"
                ? `symbol,quantity,avgPrice\nBTC-USD,0.5,95000.00\nETH-USD,3,3100.00`
                : `symbol,quantity,avgPrice\nBTC-USD,0.5,95000.00\nETH-USD,3,3100.00`}
            </code>
            <p className="text-[10px] text-muted-foreground">
              Column aliases supported: <span className="text-foreground">ticker, qty, shares, price, buyprice, avg_cost</span> and more. Symbols must exist in the {region} asset universe.
            </p>
          </div>

          {/* Drop zone */}
          {!rows.length && !results && (
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
                <p className="text-sm font-bold text-foreground">Drop your CSV here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              </div>
              <p className="text-[10px] text-muted-foreground">.csv files only</p>
            </div>
          )}

          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={onFileChange} />

          {/* Preview table */}
          {rows.length > 0 && !results && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-foreground">{fileName}</p>
                  <span className="text-[11px] text-muted-foreground">
                    {rows.length} row{rows.length !== 1 ? "s" : ""} · {validRows.length} valid
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setRows([]); setFileName(null); }}
                    className="text-[11px] text-muted-foreground hover:text-danger transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </button>
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
                    onClick={() => setShowPreview((v) => !v)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    {showPreview ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showPreview ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {showPreview && (
                <div className="rounded-2xl border border-white/8 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/8 bg-muted/10">
                        <th className="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Symbol</th>
                        <th className="px-3 py-2 text-right font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Qty</th>
                        <th className="px-3 py-2 text-right font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Avg Price</th>
                        <th className="px-3 py-2 text-right font-bold text-[10px] uppercase tracking-wider text-muted-foreground w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr
                          key={i}
                          className={cn(
                            "border-b border-white/5 last:border-0",
                            row.error ? "bg-danger/5" : "hover:bg-muted/10",
                          )}
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {row.error ? (
                                <AlertCircle className="h-3 w-3 text-danger shrink-0" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                              )}
                              <span className={cn("font-bold", row.error ? "text-danger" : "text-foreground")}>
                                {row.symbol || row.rawSymbol || "—"}
                              </span>
                              {row.error && (
                                <span className="text-[10px] text-danger">{row.error}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                            {row.error?.includes("quantity") ? (
                              <span className="text-danger">{row.rawQty}</span>
                            ) : row.quantity.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                            {row.error?.includes("price") ? (
                              <span className="text-danger">{row.rawPrice}</span>
                            ) : `${currencySymbol}${row.avgPrice.toFixed(2)}`}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeRow(i)}
                              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-danger transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {rows.some((r) => r.error) && (
                <p className="text-[11px] text-warning">
                  {rows.filter((r) => r.error).length} row{rows.filter((r) => r.error).length !== 1 ? "s" : ""} with errors will be skipped.
                </p>
              )}
            </div>
          )}

          {/* Import results */}
          {results && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-foreground">Import results</p>
              <div className="rounded-2xl border border-white/8 overflow-hidden">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between px-4 py-2.5 border-b border-white/5 last:border-0 text-xs",
                      r.status === "imported" ? "bg-success/5" : "bg-danger/5",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {r.status === "imported" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-danger" />
                      )}
                      <span className="font-bold text-foreground">{r.symbol}</span>
                    </div>
                    <span className={cn("text-[10px]", r.status === "imported" ? "text-success" : "text-danger")}>
                      {r.status === "imported" ? "Imported" : r.message ?? "Failed"}
                    </span>
                  </div>
                ))}
              </div>
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
              disabled={validRows.length === 0 || isImporting}
              className="flex-1 text-sm h-9 gap-1.5"
            >
              {isImporting ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Importing…</>
              ) : (
                <><Upload className="h-3.5 w-3.5" />Import {validRows.length} holding{validRows.length !== 1 ? "s" : ""}</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
