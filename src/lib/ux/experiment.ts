export type BeginnerExperimentVariant = "control" | "treatment";

const EXPERIMENT_STORAGE_KEY = "ux:beginner-experiment:v1";

export function getOrCreateBeginnerExperimentVariant(): BeginnerExperimentVariant {
  if (typeof window === "undefined") return "control";

  try {
    const existing = window.localStorage.getItem(EXPERIMENT_STORAGE_KEY);
    if (existing === "control" || existing === "treatment") {
      window.sessionStorage.setItem(EXPERIMENT_STORAGE_KEY, existing);
      return existing;
    }

    const assigned: BeginnerExperimentVariant = Math.random() < 0.5 ? "control" : "treatment";
    window.localStorage.setItem(EXPERIMENT_STORAGE_KEY, assigned);
    window.sessionStorage.setItem(EXPERIMENT_STORAGE_KEY, assigned);
    return assigned;
  } catch {
    return "control";
  }
}

export function getActionCountBucket(actionCount: number): "0" | "1" | "2_plus" {
  if (actionCount <= 0) return "0";
  if (actionCount === 1) return "1";
  return "2_plus";
}

export function trackUpgradeCtaEvent(params: {
  source: string;
  eventType: "impression" | "click";
  actionCount: number;
  variant: BeginnerExperimentVariant;
}): void {
  if (typeof window === "undefined") return;

  const payload = {
    source: params.source,
    eventType: params.eventType,
    actionCount: params.actionCount,
    actionBucket: getActionCountBucket(params.actionCount),
    variant: params.variant,
    ts: Date.now(),
  };

  void fetch("/api/ux/cta-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Swallow telemetry errors.
  });
}
