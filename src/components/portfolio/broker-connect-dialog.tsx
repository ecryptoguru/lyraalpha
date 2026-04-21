"use client";

import { useState } from "react";
import { Loader2, X, ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { BrokerProvider } from "@/lib/types/broker";

// ─── Broker catalogue ─────────────────────────────────────────────────────────

interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password";
  hint?: string;
}

interface BrokerEntry {
  provider: BrokerProvider;
  label: string;
  region: "IN" | "US";
  phase: 1 | 2 | 3;
  description: string;
  authType: "api_key" | "oauth" | "totp";
  fields: CredentialField[];
  oauthUrl?: (redirectBase: string) => string;
  docsUrl: string;
}

const BROKERS: BrokerEntry[] = [
  // ── Phase 1 India CEX ────────────────────────────────────────────────────────
  {
    provider: "koinx",
    label: "KoinX",
    region: "IN",
    phase: 1,
    description: "India's leading crypto tax and portfolio platform. Partner integration with 270+ chains and exchanges.",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "koinx_api_key", type: "text" },
      { key: "client_id", label: "Client ID", placeholder: "koinx_client_id", type: "text" },
    ],
    docsUrl: "https://api-docs.koinx.com/",
  },
  {
    provider: "wazirx",
    label: "WazirX",
    region: "IN",
    phase: 1,
    description: "India's largest crypto exchange. Binance-owned with strong API documentation.",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "wazirx_api_key", type: "text" },
      { key: "secret_key", label: "Secret Key", placeholder: "wazirx_secret_key", type: "password" },
    ],
    docsUrl: "https://docs.wazirx.com/",
  },
  {
    provider: "coindcx",
    label: "CoinDCX",
    region: "IN",
    phase: 1,
    description: "Major Indian crypto exchange with good API coverage and strong retail relevance.",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "coindcx_api_key", type: "text" },
      { key: "secret_key", label: "Secret Key", placeholder: "coindcx_secret_key", type: "password" },
    ],
    docsUrl: "https://docs.coindcx.com/",
  },
  // ── Phase 1 Global CEX ──────────────────────────────────────────────────────
  {
    provider: "binance",
    label: "Binance",
    region: "US",
    phase: 1,
    description: "Global crypto exchange leader with excellent API, highest liquidity and most trading pairs.",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "binance_api_key", type: "text" },
      { key: "secret_key", label: "Secret Key", placeholder: "binance_secret_key", type: "password" },
    ],
    docsUrl: "https://binance-docs.github.io/apidocs/",
  },
  {
    provider: "coinbase",
    label: "Coinbase",
    region: "US",
    phase: 1,
    description: "US market leader with excellent OAuth flow. Good for institutional users.",
    authType: "oauth",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "coinbase_api_key", type: "text" },
      { key: "secret_key", label: "API Secret", placeholder: "coinbase_api_secret", type: "password" },
    ],
    docsUrl: "https://docs.cloud.coinbase.com/",
  },
  {
    provider: "kraken",
    label: "Kraken",
    region: "US",
    phase: 1,
    description: "Strong API with institutional-grade security. Good for high-value accounts.",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "kraken_api_key", type: "text" },
      { key: "secret_key", label: "Secret Key", placeholder: "kraken_secret_key", type: "password" },
    ],
    docsUrl: "https://docs.kraken.com/",
  },
  // ── DEX ───────────────────────────────────────────────────────────────────────────
  {
    provider: "uniswap",
    label: "Uniswap",
    region: "US",
    phase: 1,
    description: "Leading DEX on Ethereum and L2s. Connect via MetaMask or Phantom wallet.",
    authType: "api_key",
    fields: [
      { key: "wallet_address", label: "Wallet Address", placeholder: "0x...", type: "text" },
      { key: "chain", label: "Chain", placeholder: "ethereum", type: "text", hint: "Supported: ethereum, polygon, arbitrum, optimism, bsc, avalanche" },
    ],
    docsUrl: "https://docs.uniswap.org/",
  },
  {
    provider: "pancakeswap",
    label: "Pancakeswap",
    region: "US",
    phase: 1,
    description: "Leading DEX on BSC. Connect via MetaMask or Phantom wallet.",
    authType: "api_key",
    fields: [
      { key: "wallet_address", label: "Wallet Address", placeholder: "0x...", type: "text" },
      { key: "chain", label: "Chain", placeholder: "bsc", type: "text", hint: "Supported: bsc, ethereum" },
    ],
    docsUrl: "https://docs.pancakeswap.finance/",
  },
  {
    provider: "sushiswap",
    label: "Sushiswap",
    region: "US",
    phase: 1,
    description: "Multi-chain DEX. Connect via MetaMask or Phantom wallet.",
    authType: "api_key",
    fields: [
      { key: "wallet_address", label: "Wallet Address", placeholder: "0x...", type: "text" },
      { key: "chain", label: "Chain", placeholder: "ethereum", type: "text", hint: "Supported: ethereum, polygon, arbitrum, optimism, bsc, avalanche, fantom" },
    ],
    docsUrl: "https://docs.sushi.com/",
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface BrokerConnectDialogProps {
  portfolioId: string;
  portfolioName: string;
  portfolioRegion?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BrokerConnectDialog({
  portfolioId,
  portfolioName,
  portfolioRegion,
  onClose,
  onSuccess,
}: BrokerConnectDialogProps) {
  const [selectedBroker, setSelectedBroker] = useState<BrokerEntry | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncResult, setSyncResult] = useState<{ holdingCount: number; warnings: string[] } | null>(null);

  const regionFilter: "IN" | "US" = portfolioRegion === "IN" ? "IN" : "US";
  const filteredBrokers = BROKERS.filter((b) => b.region === regionFilter);

  const inBrokers = filteredBrokers.filter((b) => b.region === "IN");
  const usBrokers = filteredBrokers.filter((b) => b.region === "US");

  function handleSelect(broker: BrokerEntry) {
    setSelectedBroker(broker);
    setCredentials({});
    setSyncResult(null);
  }

  function handleBack() {
    setSelectedBroker(null);
    setCredentials({});
    setSyncResult(null);
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBroker) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/portfolio/${portfolioId}/broker/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedBroker.provider,
          credentials,
          replaceExisting,
        }),
      });

      const data = await res.json() as {
        summary?: { holdingCount: number };
        warnings?: string[];
        error?: string;
      };

      if (!res.ok || data.error) {
        toast.error(data.error ?? "Failed to sync broker");
        return;
      }

      setSyncResult({
        holdingCount: data.summary?.holdingCount ?? 0,
        warnings: data.warnings ?? [],
      });
      toast.success(`${selectedBroker.label} synced — ${data.summary?.holdingCount ?? 0} holdings imported`);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Broker sync failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-foreground/5 border-foreground/20 text-white" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedBroker && (
                <button
                  onClick={handleBack}
                  className="text-muted-foreground hover:text-white text-sm mr-1"
                >
                  ← Back
                </button>
              )}
              <DialogTitle className="text-base font-semibold">
                {selectedBroker ? `Connect ${selectedBroker.label}` : "Connect Broker"}
              </DialogTitle>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            {selectedBroker
              ? selectedBroker.description
              : `Import current holdings into "${portfolioName}" from your broker account.`}
          </DialogDescription>
        </DialogHeader>

        {/* ── Broker list ──────────────────────────────────────────────────── */}
        {!selectedBroker && (
          <div className="space-y-4 mt-2">
            {inBrokers.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  India
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {inBrokers.map((b) => (
                    <button
                      key={b.provider}
                      onClick={() => handleSelect(b)}
                      className="flex items-center justify-between gap-2 rounded-lg border border-foreground/20 bg-foreground/10 px-4 py-3 text-left hover:border-border hover:bg-foreground/80 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{b.label}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-foreground group-hover:text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {usBrokers.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  United States
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {usBrokers.map((b) => (
                    <button
                      key={b.provider}
                      onClick={() => handleSelect(b)}
                      className="flex items-center justify-between gap-2 rounded-lg border border-foreground/20 bg-foreground/10 px-4 py-3 text-left hover:border-border hover:bg-foreground/80 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{b.label}</span>
                        {b.provider === "koinx" && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-info/40 text-info">
                            Link
                          </Badge>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-foreground group-hover:text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── Credential form ───────────────────────────────────────────────── */}
        {selectedBroker && !syncResult && (
          <form onSubmit={handleConnect} className="space-y-4 mt-2">
            {/* Crypto exchanges use API key authentication */}
            {selectedBroker.authType === "api_key" ? (
              <div className="space-y-3">
                {selectedBroker.fields.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label htmlFor={field.key} className="text-sm text-muted-foreground">
                      {field.label}
                    </Label>
                    <Input
                      id={field.key}
                      type={field.type || "text"}
                      placeholder={field.placeholder}
                      value={credentials[field.key] || ""}
                      onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
                      className="bg-foreground/10 border-border text-white placeholder:text-muted-foreground"
                    />
                    {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <>
                {selectedBroker.fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={field.key} className="text-sm text-muted-foreground">
                      {field.label}
                    </Label>
                    <Input
                      id={field.key}
                      type={field.type ?? "text"}
                      placeholder={field.placeholder}
                      value={credentials[field.key] ?? ""}
                      onChange={(e) =>
                        setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="bg-foreground/10 border-border text-white placeholder:text-foreground focus:border-border"
                      autoComplete="off"
                    />
                    {field.hint && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{field.hint}</p>
                    )}
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="replace-existing"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="rounded border-border"
                  />
                  <Label htmlFor="replace-existing" className="text-sm text-muted-foreground cursor-pointer">
                    Replace existing holdings on conflict
                  </Label>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-white text-black hover:bg-muted/30 font-medium"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing…
                      </>
                    ) : (
                      `Connect ${selectedBroker.label}`
                    )}
                  </Button>
                  <a
                    href={selectedBroker.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-muted-foreground underline"
                  >
                    API docs ↗
                  </a>
                </div>
              </>
            )}
          </form>
        )}

        {/* ── Success screen ────────────────────────────────────────────────── */}
        {syncResult && (
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success/5 p-4">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-success">
                  {selectedBroker?.label} connected
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {syncResult.holdingCount} holding{syncResult.holdingCount !== 1 ? "s" : ""} imported into &ldquo;{portfolioName}&rdquo;.
                </p>
              </div>
            </div>

            {syncResult.warnings.length > 0 && (
              <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-warning">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{syncResult.warnings.length} warning{syncResult.warnings.length !== 1 ? "s" : ""}</span>
                </div>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
                  {syncResult.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {syncResult.warnings.length > 5 && (
                    <li>…and {syncResult.warnings.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={onClose} className="bg-white text-black hover:bg-muted/30">
                Done
              </Button>
              <Button variant="outline" onClick={handleBack} className="border-border text-muted-foreground">
                Connect Another
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
