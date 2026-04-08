export type ShareActionEventType =
  | "sheet_open"
  | "native_share_attempt"
  | "native_share_success"
  | "share_x_attempt"
  | "share_x_success"
  | "share_linkedin_attempt"
  | "share_linkedin_success"
  | "share_reddit_attempt"
  | "share_reddit_success"
  | "copy_link_success"
  | "copy_post_success"
  | "copy_x_success"
  | "copy_linkedin_success"
  | "copy_reddit_success"
  | "download_card_success"
  | "invite_toggle_on"
  | "invite_toggle_off";

export function trackShareEvent(params: {
  action: ShareActionEventType;
  kind: string;
  mode: string;
  path?: string;
}): void {
  if (typeof window === "undefined") return;

  const payload = {
    action: params.action,
    kind: params.kind,
    mode: params.mode,
    path: params.path ?? window.location.pathname,
    ts: Date.now(),
  };

  void fetch("/api/ux/share-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Swallow telemetry errors.
  });
}
