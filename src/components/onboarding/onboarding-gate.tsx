"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Check, ChevronRight, Loader2, Globe, TrendingUp, Cpu, BarChart2, Coins, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRegion, type Region } from "@/lib/context/RegionContext";
import { createClientLogger } from "@/lib/logger/client";

const logger = createClientLogger("onboarding");

interface UserPreferences {
  preferredRegion: "US" | "IN" | "BOTH";
  experienceLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  interests: Array<"CRYPTO" | "DEFI" | "NFTS" | "LAYER1" | "LAYER2">;
  onboardingCompleted: boolean;
  dashboardMode?: string;
}

const INTEREST_OPTIONS: Array<{
  key: UserPreferences["interests"][number];
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  { key: "CRYPTO", label: "Crypto Assets", description: "Bitcoin, Ethereum, and major tokens", icon: <Coins className="h-4 w-4" /> },
  { key: "DEFI", label: "DeFi", description: "Decentralized finance protocols", icon: <Cpu className="h-4 w-4" /> },
  { key: "NFTS", label: "NFTs", description: "Non-fungible tokens & digital collectibles", icon: <TrendingUp className="h-4 w-4" /> },
  { key: "LAYER1", label: "Layer 1", description: "Base blockchain networks", icon: <Globe className="h-4 w-4" /> },
  { key: "LAYER2", label: "Layer 2", description: "Scaling solutions & sidechains", icon: <BarChart2 className="h-4 w-4" /> },
];

const REGION_OPTIONS = [
  { key: "US" as const, label: "US Markets", description: "US-based crypto exchanges", flag: "🇺🇸" },
  { key: "IN" as const, label: "Indian Markets", description: "Indian crypto exchanges", flag: "🇮🇳" },
  { key: "BOTH" as const, label: "Both", description: "Global crypto markets", flag: "🌐" },
];

const EXPERIENCE_OPTIONS = [
  { key: "BEGINNER" as const, label: "Beginner", description: "New to investing, need guidance" },
  { key: "INTERMEDIATE" as const, label: "Intermediate", description: "Some experience, want deeper insights" },
  { key: "ADVANCED" as const, label: "Advanced", description: "Experienced, want raw data & signals" },
];

const STEPS = ["Market", "Experience", "Interests"];

const ONBOARDING_CACHE_KEY = "onboarding:completed:v1";

export function OnboardingGate({ initialCompleted = false }: { initialCompleted?: boolean }) {
  const [loading, setLoading] = useState(!initialCompleted);
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { setRegion } = useRegion();

  const [preferredRegion, setPreferredRegion] = useState<UserPreferences["preferredRegion"]>("US");
  const [experienceLevel, setExperienceLevel] = useState<UserPreferences["experienceLevel"]>("BEGINNER");
  const [interests, setInterests] = useState<UserPreferences["interests"]>(["CRYPTO", "DEFI"]);
  const [onboardingCompleted, setOnboardingCompleted] = useState(initialCompleted);

  useEffect(() => {
    let active = true;

    if (initialCompleted) {
      try { window.localStorage.setItem(ONBOARDING_CACHE_KEY, "1"); } catch { /* ignore */ }
      setLoading(false);
      return () => { active = false; };
    }

    try {
      const cached = window.localStorage.getItem(ONBOARDING_CACHE_KEY);
      if (cached === "1") {
        setOnboardingCompleted(true);
        setLoading(false);
        return;
      }
    } catch {
      // ignore
    }

    async function loadPreferences() {
      setError(null);
      try {
        const res = await fetch("/api/user/preferences", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        const prefs = data.preferences as UserPreferences;
        if (!active) return;
        setPreferredRegion(prefs.preferredRegion || "US");
        setExperienceLevel(prefs.experienceLevel || "BEGINNER");
        setInterests(Array.isArray(prefs.interests) && prefs.interests.length > 0 ? prefs.interests : ["CRYPTO", "DEFI"]);
        const completed = Boolean(prefs.onboardingCompleted);
        setOnboardingCompleted(completed);
        try { window.localStorage.setItem(ONBOARDING_CACHE_KEY, completed ? "1" : "0"); } catch { /* ignore */ }
      } catch (err) {
        logger.warn("Failed to load preferences from server", { error: err });
        // Do not block user on load failure, just use defaults.
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPreferences();
    return () => { active = false; };
  }, [initialCompleted]);

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(preferredRegion);
    if (step === 1) return Boolean(experienceLevel);
    if (step === 2) return interests.length > 0;
    return true;
  }, [step, preferredRegion, experienceLevel, interests.length]);

  function toggleInterest(value: UserPreferences["interests"][number]) {
    setInterests((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) return prev;
        return prev.filter((i) => i !== value);
      }
      return [...prev, value];
    });
  }

  const completeOnboarding = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredRegion,
          experienceLevel,
          interests,
          dashboardMode: "simple",
          onboardingCompleted: true,
          tourCompleted: true,
        }),
      });
      if (!res.ok) {
        const fallback = await fetch("/api/user/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true }),
        });
        if (!fallback.ok) {
          throw new Error("Failed to persist onboarding completion");
        }
      }
    } catch (err) {
      if (preferredRegion === "US" || preferredRegion === "IN") {
        setRegion(preferredRegion as Region);
      }
      setOnboardingCompleted(true);
      try { window.localStorage.setItem(ONBOARDING_CACHE_KEY, "1"); } catch { /* ignore */ }
      logger.warn("Failed to save preferences to server", { error: err });
    } finally {
      if (preferredRegion === "US" || preferredRegion === "IN") {
        setRegion(preferredRegion as Region);
      }
      setOnboardingCompleted(true);
      try { window.localStorage.setItem(ONBOARDING_CACHE_KEY, "1"); } catch { /* ignore */ }
      setSaving(false);
    }
  }, [preferredRegion, experienceLevel, interests, setRegion]);

  async function skipOnboarding() {
    setSkipping(true);
    setError(null);
    try {
      await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipped: true }),
      });
      setOnboardingCompleted(true);
      try { window.localStorage.setItem(ONBOARDING_CACHE_KEY, "1"); } catch { /* ignore */ }
    } catch {
      // Skip silently — don't block the user
      setOnboardingCompleted(true);
      try { window.localStorage.setItem(ONBOARDING_CACHE_KEY, "1"); } catch { /* ignore */ }
    } finally {
      setSkipping(false);
    }
  }

  if (loading || onboardingCompleted) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-2xl flex flex-col">
      {/* Skip button — top right, always accessible */}
      <div className="flex justify-end p-3 sm:p-4 shrink-0">
        <button
          type="button"
          onClick={skipOnboarding}
          disabled={skipping}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 min-h-[38px] rounded-xl hover:bg-muted/50"
        >
          {skipping ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          Skip for now
        </button>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto flex items-start justify-center px-4 pb-6">
        <div className="w-full max-w-lg">
          {/* Card */}
          <div className="rounded-2xl border border-primary/20 bg-card/95 shadow-2xl shadow-black/20 overflow-hidden">

            {/* Header */}
            <div className="px-5 pt-5 pb-4 sm:px-7 sm:pt-6 border-b border-border/30">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Setup</p>
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                  {step + 1} / {STEPS.length}
                </span>
              </div>
              {/* Step labels */}
              <div className="flex gap-1 mb-3">
                {STEPS.map((s, i) => (
                  <div
                    key={s}
                    className={cn(
                      "flex-1 h-1 rounded-full transition-all duration-300",
                      i <= step ? "bg-primary" : "bg-muted/40"
                    )}
                  />
                ))}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">
                {step === 0 && "Which market do you focus on?"}
                {step === 1 && "What's your experience level?"}
                {step === 2 && "What do you want to track?"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {step === 0 && "We'll prioritize data and alerts for your chosen market."}
                {step === 1 && "Controls how much detail and context we show by default."}
                {step === 2 && "Personalizes your feed, Lyra suggestions and alerts."}
              </p>
            </div>

            {/* Step content */}
            <div className="px-5 py-5 sm:px-7 sm:py-6">

              {/* Step 0 — Region */}
              {step === 0 && (
                <div className="grid gap-2.5">
                  {REGION_OPTIONS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setPreferredRegion(item.key)}
                      className={cn(
                        "w-full flex items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all duration-150 active:scale-[0.98]",
                        preferredRegion === item.key
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-white/5 bg-background/40 hover:border-primary/30 hover:bg-muted/20"
                      )}
                    >
                      <span className="text-2xl shrink-0">{item.flag}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      {preferredRegion === item.key && (
                        <Check className="h-4 w-4 text-primary ml-auto shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Step 1 — Experience */}
              {step === 1 && (
                <div className="grid gap-2.5">
                  {EXPERIENCE_OPTIONS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setExperienceLevel(item.key)}
                      className={cn(
                        "w-full flex items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all duration-150 active:scale-[0.98]",
                        experienceLevel === item.key
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-white/5 bg-background/40 hover:border-primary/30 hover:bg-muted/20"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      {experienceLevel === item.key && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2 — Interests */}
              {step === 2 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {INTEREST_OPTIONS.map((item) => {
                    const selected = interests.includes(item.key);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => toggleInterest(item.key)}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-150 active:scale-[0.98]",
                          selected
                            ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                            : "border-white/5 bg-background/40 hover:border-primary/30 hover:bg-muted/20"
                        )}
                      >
                        <span className={cn("shrink-0", selected ? "text-primary" : "text-muted-foreground")}>
                          {item.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                        </div>
                        {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {error && (
                <p className="mt-4 text-sm font-medium text-danger">{error}</p>
              )}
            </div>

            {/* Footer nav */}
            <div className="px-5 pb-5 sm:px-7 sm:pb-6 flex items-center justify-between gap-3 border-t border-border/30 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((p) => Math.max(p - 1, 0))}
                disabled={step === 0 || saving}
                className="min-w-[72px]"
              >
                Back
              </Button>

              <div className="flex items-center gap-2">
                {step < STEPS.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() => setStep((p) => p + 1)}
                    disabled={!canContinue || saving}
                    className="min-w-[100px]"
                  >
                    Continue
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={completeOnboarding}
                    disabled={saving}
                    className="min-w-[120px]"
                  >
                    {saving ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
                    ) : (
                      "Start Dashboard"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Progress indicator dots */}
          <div className="flex justify-center gap-1.5 mt-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-full transition-all duration-300",
                  i === step ? "w-4 h-1.5 bg-primary" : i < step ? "w-1.5 h-1.5 bg-primary/50" : "w-1.5 h-1.5 bg-muted/40"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
