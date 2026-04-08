import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildShareCardUrl, createShareObject } from "./intelligence-share";

describe("intelligence-share", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("builds a public share-card artifact url", () => {
    const url = buildShareCardUrl({
      title: "Weekly report",
      takeaway: "Risk is rising",
      context: "Narrative changed",
      eyebrow: "Weekly intelligence",
      scoreLabel: "Week",
      scoreValue: "Ready",
    });

    expect(url).toContain("/api/share/card?");
    expect(url).toContain("title=Weekly+report");
    expect(url).toContain("scoreValue=Ready");
  });

  it("creates a normalized share object with platform URLs and image url", () => {
    const share = createShareObject({
      kind: "weekly_report",
      title: "Shock Simulator flags fragile portfolio risk",
      eyebrow: "Weekly intelligence report",
      takeaway: "Your portfolio looks more fragile than usual.",
      context: "Top opportunity is still surfacing in Multibagger Radar.",
      scoreLabel: "Week",
      scoreValue: "Ready",
      href: "/dashboard?view=weekly-report",
    });

    expect(share.href).toBe("http://localhost:3000/dashboard?view=weekly-report");
    expect(share.imageUrl).toContain("/api/share/card?");
    expect(share.shareText).toContain("Your portfolio looks more fragile than usual.");
    expect(share.clipboardText).toContain("Share card:");
    expect(share.xUrl).toContain("https://x.com/intent/post?");
    expect(share.linkedInUrl).toContain("https://www.linkedin.com/sharing/share-offsite/");
    expect(share.redditUrl).toContain("https://www.reddit.com/submit?");
    expect(share.redditTitle).toContain("Shock Simulator flags fragile portfolio risk");
  });

  it("creates an invite variant when a referral-aware share is requested", () => {
    const share = createShareObject({
      kind: "referral",
      mode: "invite",
      title: "Invite your friends to InsightAlpha",
      eyebrow: "InsightAlpha referral",
      takeaway: "Share the product naturally.",
      context: "Only turn invite mode on when you want your referral link included.",
      href: "/",
      inviteHref: "/signup?ref=abc123",
      inviteEyebrow: "InsightAlpha invite",
      inviteTakeaway: "Get started with my referral link.",
      inviteContext: "You will get bonus credits when you activate a paid plan.",
    });

    expect(share.invite).toBeDefined();
    expect(share.invite?.href).toBe("http://localhost:3000/signup?ref=abc123");
    expect(share.invite?.xText).toContain("Get started with my referral link.");
    expect(share.invite?.linkedInUrl).toContain("signup%3Fref%3Dabc123");
  });
});
