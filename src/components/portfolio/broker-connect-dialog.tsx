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
  // ── Phase 1 India ──────────────────────────────────────────────────────────
  {
    provider: "zerodha",
    label: "Zerodha",
    region: "IN",
    phase: 1,
    description: "India's largest discount broker. Requires a paid Kite Connect developer subscription.",
    authType: "oauth",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "kite_api_key", type: "text" },
      { key: "api_secret", label: "API Secret", placeholder: "kite_api_secret", type: "password" },
      { key: "request_token", label: "Request Token", placeholder: "Paste from redirect URL", type: "text", hint: "Login at kite.zerodha.com/connect/login?api_key=YOUR_KEY, then paste the request_token from the redirect URL." },
    ],
    docsUrl: "https://kite.trade/docs/connect/v3/",
  },
  {
    provider: "upstox",
    label: "Upstox",
    region: "IN",
    phase: 1,
    description: "Upstox API v2 — OAuth 2.0 PKCE flow. Free developer access.",
    authType: "oauth",
    fields: [
      { key: "client_id", label: "Client ID", placeholder: "upstox_client_id", type: "text" },
      { key: "client_secret", label: "Client Secret", placeholder: "upstox_client_secret", type: "password" },
      { key: "code", label: "Auth Code", placeholder: "Authorization code from redirect", type: "text", hint: "Complete the OAuth flow at api.upstox.com, paste the code from the redirect URL." },
      { key: "redirect_uri", label: "Redirect URI", placeholder: "https://your-app.com/callback", type: "text" },
    ],
    docsUrl: "https://upstox.com/developer/api-documentation/",
  },
  {
    provider: "angel_one",
    label: "Angel One",
    region: "IN",
    phase: 1,
    description: "SmartAPI — direct login with client code, password, and TOTP.",
    authType: "totp",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "SmartAPI key", type: "text" },
      { key: "clientcode", label: "Client Code", placeholder: "Your Angel One client code", type: "text" },
      { key: "password", label: "Password", placeholder: "Your login password", type: "password" },
      { key: "totp", label: "TOTP Code", placeholder: "6-digit TOTP", type: "text", hint: "Generate from your authenticator app. Must be entered within 30 seconds." },
    ],
    docsUrl: "https://smartapi.angelbroking.com/docs",
  },
  {
    provider: "dhan",
    label: "Dhan",
    region: "IN",
    phase: 1,
    description: "DhanHQ API v2 — long-lived access token from the developer portal.",
    authType: "api_key",
    fields: [
      { key: "client_id", label: "Client ID", placeholder: "Your Dhan client ID", type: "text" },
      { key: "access_token", label: "Access Token", placeholder: "Access token from DhanHQ portal", type: "password", hint: "Generate from https://dhanhq.co/docs/v2/ — tokens are valid for one year." },
    ],
    docsUrl: "https://dhanhq.co/docs/v2/",
  },
  {
    provider: "fyers",
    label: "FYERS",
    region: "IN",
    phase: 1,
    description: "FYERS API v3 — OAuth authorization code flow.",
    authType: "oauth",
    fields: [
      { key: "app_id", label: "App ID", placeholder: "FYERS app ID (e.g. XY1234-100)", type: "text" },
      { key: "app_secret", label: "App Secret", placeholder: "FYERS app secret", type: "password" },
      { key: "auth_code", label: "Auth Code", placeholder: "Authorization code from redirect", type: "text", hint: "Complete login at myapi.fyers.in, paste the auth_code from the redirect URL." },
    ],
    docsUrl: "https://myapi.fyers.in/",
  },
  // ── Phase 2 India ──────────────────────────────────────────────────────────
  {
    provider: "groww",
    label: "Groww",
    region: "IN",
    phase: 2,
    description: "Groww partner API — token issued from the Groww partner portal.",
    authType: "api_key",
    fields: [
      { key: "user_id", label: "User ID", placeholder: "Groww user ID", type: "text" },
      { key: "access_token", label: "Access Token", placeholder: "Access token from Groww partner portal", type: "password" },
    ],
    docsUrl: "https://groww.in/open-api",
  },
  {
    provider: "icici_direct",
    label: "ICICI Direct",
    region: "IN",
    phase: 2,
    description: "Breeze Connect API — API key + secret with optional session token.",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Breeze API key", type: "text" },
      { key: "api_secret", label: "API Secret", placeholder: "Breeze API secret", type: "password" },
      { key: "session_token", label: "Session Token (optional)", placeholder: "Pre-generated session token", type: "password", hint: "Optional. If blank, a session will be generated automatically." },
    ],
    docsUrl: "https://api.icicidirect.com/apiuser/",
  },
  {
    provider: "kotak_neo",
    label: "Kotak Neo",
    region: "IN",
    phase: 2,
    description: "Kotak Neo REST API — consumer key/secret with OTP login.",
    authType: "totp",
    fields: [
      { key: "consumer_key", label: "Consumer Key", placeholder: "Neo API consumer key", type: "text" },
      { key: "consumer_secret", label: "Consumer Secret", placeholder: "Neo API consumer secret", type: "password" },
      { key: "mobile_number", label: "Mobile Number", placeholder: "Registered mobile number", type: "text" },
      { key: "password", label: "Password", placeholder: "Login password", type: "password" },
      { key: "mpin", label: "MPIN", placeholder: "4-digit MPIN", type: "password" },
      { key: "otp", label: "OTP", placeholder: "OTP sent to your mobile", type: "text", hint: "Request OTP via the Neo portal before connecting." },
    ],
    docsUrl: "https://gw-napi.kotaksecurities.com/",
  },
  {
    provider: "five_paisa",
    label: "5paisa",
    region: "IN",
    phase: 2,
    description: "5paisa OpenAPI — app credentials with TOTP.",
    authType: "totp",
    fields: [
      { key: "app_name", label: "App Name", placeholder: "5paisa app name", type: "text" },
      { key: "user_key", label: "User Key", placeholder: "API user key", type: "text" },
      { key: "encryption_key", label: "Encryption Key", placeholder: "API encryption key", type: "password" },
      { key: "user_id", label: "Email / User ID", placeholder: "Registered email", type: "text" },
      { key: "password", label: "Password", placeholder: "Login password", type: "password" },
    ],
    docsUrl: "https://www.5paisa.com/developer-apis",
  },
  {
    provider: "motilal_oswal",
    label: "Motilal Oswal",
    region: "IN",
    phase: 2,
    description: "MO OpenAPI — partner API key with TOTP login.",
    authType: "totp",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "MO API key", type: "text" },
      { key: "client_id", label: "Client ID", placeholder: "MO client ID", type: "text" },
      { key: "password", label: "Password", placeholder: "Login password", type: "password" },
      { key: "totp", label: "TOTP Code", placeholder: "6-digit TOTP", type: "text", hint: "From your TOTP authenticator app." },
    ],
    docsUrl: "https://openapi.motilaloswal.com/",
  },
  // ── Phase 3 India ──────────────────────────────────────────────────────────
  {
    provider: "shoonya",
    label: "Shoonya (Finvasia)",
    region: "IN",
    phase: 3,
    description: "NorenAPI — zero brokerage. SHA-256 password + TOTP login.",
    authType: "totp",
    fields: [
      { key: "user_id", label: "User ID", placeholder: "Shoonya user ID", type: "text" },
      { key: "password", label: "Password", placeholder: "Login password", type: "password" },
      { key: "totp", label: "TOTP Code", placeholder: "6-digit TOTP", type: "text", hint: "From your authenticator app." },
      { key: "vendor_code", label: "Vendor Code", placeholder: "NorenAPI vendor code", type: "text" },
      { key: "api_secret", label: "API Secret", placeholder: "NorenAPI app key secret", type: "password" },
    ],
    docsUrl: "https://api.shoonya.com/",
  },
  {
    provider: "alice_blue",
    label: "Alice Blue",
    region: "IN",
    phase: 3,
    description: "ANT+ API — user ID + API key session flow.",
    authType: "api_key",
    fields: [
      { key: "user_id", label: "User ID", placeholder: "Alice Blue user ID", type: "text" },
      { key: "api_key", label: "API Key", placeholder: "ANT+ API key", type: "password" },
    ],
    docsUrl: "https://ant.aliceblueonline.com/",
  },
  // ── US ────────────────────────────────────────────────────────────────────
  {
    provider: "plaid",
    label: "Plaid",
    region: "US",
    phase: 1,
    description: "Connect 12,000+ US financial institutions via Plaid Link. Broadest US brokerage coverage.",
    authType: "oauth",
    fields: [],  // Plaid uses Link SDK — no manual credential entry
    docsUrl: "https://plaid.com/docs/investments/",
  },
  {
    provider: "alpaca",
    label: "Alpaca",
    region: "US",
    phase: 1,
    description: "Commission-free US equities & crypto. API key or OAuth.",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "API Key ID", placeholder: "APCA-API-KEY-ID", type: "text" },
      { key: "api_secret", label: "API Secret Key", placeholder: "APCA-API-SECRET-KEY", type: "password" },
    ],
    docsUrl: "https://docs.alpaca.markets/",
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-zinc-950 border-zinc-800 text-white" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedBroker && (
                <button
                  onClick={handleBack}
                  className="text-zinc-400 hover:text-white text-sm mr-1"
                >
                  ← Back
                </button>
              )}
              <DialogTitle className="text-base font-semibold">
                {selectedBroker ? `Connect ${selectedBroker.label}` : "Connect Broker"}
              </DialogTitle>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <DialogDescription className="text-zinc-400 text-sm">
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
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  India
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {inBrokers.map((b) => (
                    <button
                      key={b.provider}
                      onClick={() => handleSelect(b)}
                      className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-left hover:border-zinc-600 hover:bg-zinc-800/80 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{b.label}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {usBrokers.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  United States
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {usBrokers.map((b) => (
                    <button
                      key={b.provider}
                      onClick={() => handleSelect(b)}
                      className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-left hover:border-zinc-600 hover:bg-zinc-800/80 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{b.label}</span>
                        {b.provider === "plaid" && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/40 text-blue-400">
                            Link
                          </Badge>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
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
            {/* Plaid uses Link SDK — show instructions instead of form */}
            {selectedBroker.provider === "plaid" ? (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-zinc-300 space-y-2">
                <p className="font-medium text-blue-300">Plaid Link</p>
                <p>
                  Plaid uses a secure browser-based flow. Click{" "}
                  <strong>Open Plaid Link</strong> to authenticate your US brokerage account. Your credentials never touch our servers.
                </p>
                <p className="text-zinc-400 text-xs">
                  Requires: PLAID_CLIENT_ID and PLAID_SECRET configured on the server.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 border-blue-500/40 text-blue-300 hover:bg-blue-500/10"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/broker/plaid/link-token", { method: "POST" });
                      const data = await res.json() as { link_token?: string; error?: string };
                      if (!res.ok || !data.link_token) {
                        toast.error(data.error ?? "Failed to start Plaid Link");
                        return;
                      }
                      // Lazy-load the Plaid Link SDK only when needed (not in root layout)
                      type PlaidWindow = { Plaid?: { create: (cfg: Record<string, unknown>) => { open: () => void } } };
                      const win = window as unknown as PlaidWindow;
                      if (!win.Plaid) {
                        await new Promise<void>((resolve, reject) => {
                          const existing = document.getElementById("plaid-link-sdk");
                          if (existing) { resolve(); return; }
                          const script = document.createElement("script");
                          script.id = "plaid-link-sdk";
                          script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
                          script.async = true;
                          script.onload = () => resolve();
                          script.onerror = () => reject(new Error("Failed to load Plaid Link SDK"));
                          document.head.appendChild(script);
                        });
                      }
                      const Plaid = (window as unknown as PlaidWindow).Plaid;
                      if (!Plaid) {
                        toast.error("Plaid Link SDK failed to initialize.");
                        return;
                      }
                      const handler = Plaid.create({
                        token: data.link_token,
                        onSuccess: async (public_token: string) => {
                          setCredentials({ public_token });
                          // Auto-submit
                          setIsSubmitting(true);
                          try {
                            const syncRes = await fetch(`/api/portfolio/${portfolioId}/broker/sync`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ provider: "plaid", credentials: { public_token }, replaceExisting }),
                            });
                            const syncData = await syncRes.json() as {
                              summary?: { holdingCount: number };
                              warnings?: string[];
                              error?: string;
                            };
                            if (!syncRes.ok || syncData.error) {
                              toast.error(syncData.error ?? "Plaid sync failed");
                            } else {
                              setSyncResult({ holdingCount: syncData.summary?.holdingCount ?? 0, warnings: syncData.warnings ?? [] });
                              toast.success(`Plaid synced — ${syncData.summary?.holdingCount ?? 0} holdings imported`);
                              onSuccess?.();
                            }
                          } finally {
                            setIsSubmitting(false);
                          }
                        },
                        onExit: () => {},
                      });
                      handler.open();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to start Plaid Link");
                    }
                  }}
                >
                  Open Plaid Link
                </Button>
              </div>
            ) : (
              <>
                {selectedBroker.fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={field.key} className="text-sm text-zinc-300">
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
                      className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-zinc-500"
                      autoComplete="off"
                    />
                    {field.hint && (
                      <p className="text-[11px] text-zinc-500 leading-relaxed">{field.hint}</p>
                    )}
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="replace-existing"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="rounded border-zinc-600"
                  />
                  <Label htmlFor="replace-existing" className="text-sm text-zinc-400 cursor-pointer">
                    Replace existing holdings on conflict
                  </Label>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-white text-black hover:bg-zinc-100 font-medium"
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
                    className="text-xs text-zinc-500 hover:text-zinc-300 underline"
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
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-300">
                  {selectedBroker?.label} connected
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {syncResult.holdingCount} holding{syncResult.holdingCount !== 1 ? "s" : ""} imported into &ldquo;{portfolioName}&rdquo;.
                </p>
              </div>
            </div>

            {syncResult.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{syncResult.warnings.length} warning{syncResult.warnings.length !== 1 ? "s" : ""}</span>
                </div>
                <ul className="text-[11px] text-zinc-400 space-y-0.5 list-disc list-inside">
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
              <Button onClick={onClose} className="bg-white text-black hover:bg-zinc-100">
                Done
              </Button>
              <Button variant="outline" onClick={handleBack} className="border-zinc-700 text-zinc-300">
                Connect Another
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
