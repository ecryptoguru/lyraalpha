"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Copy, Download, ExternalLink, Link2, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  createLegacyShareObject,
  type IntelligenceShareObject,
} from "@/lib/intelligence-share";
import { trackShareEvent } from "@/lib/ux/share-events";

interface ShareInsightButtonProps {
  share?: IntelligenceShareObject;
  text?: string;
  label?: string;
  title?: string;
  url?: string;
  clipboardText?: string;
  className?: string;
}

function modeLabel(mode: IntelligenceShareObject["mode"]) {
  switch (mode) {
    case "achievement":
      return "Milestone";
    case "invite":
      return "Invite";
    default:
      return "Insight";
  }
}

function modeDescription(mode: IntelligenceShareObject["mode"]) {
  switch (mode) {
    case "achievement":
      return "Turn a product milestone into a polished post.";
    case "invite":
      return "Share a polished read or switch on invite mode when it makes sense.";
    default:
      return "Share the strongest takeaway with platform-native actions.";
  }
}

function resolveVariant(share: IntelligenceShareObject, inviteEnabled: boolean) {
  const variant = inviteEnabled && share.invite ? share.invite : share;
  return {
    variant,
    modeLabel: inviteEnabled && share.invite ? "Invite" : modeLabel(share.mode),
  };
}

async function copyToClipboard(text: string, successMessage: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    toast.error("Clipboard is not supported in this browser");
    return false;
  }

  await navigator.clipboard.writeText(text);
  toast.success(successMessage);
  return true;
}

async function downloadImage(url: string, title: string) {
  try {
    const relativeUrl = url.replace(/^https?:\/\/[^/]+/, "");
    const response = await fetch(relativeUrl);
    if (!response.ok) throw new Error("download_failed");
    const rawBlob = await response.blob();
    const blob = new Blob([rawBlob], { type: "image/png" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "insightalpha-share"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    toast.success("Share card downloaded");
    return true;
  } catch {
    toast.error("Could not download this share card");
    return false;
  }
}

function ShareSheetBody({
  share,
  inviteEnabled,
  onInviteEnabledChange,
  onClose,
  pathname,
}: {
  share: IntelligenceShareObject;
  inviteEnabled: boolean;
  onInviteEnabledChange: (value: boolean) => void;
  onClose: () => void;
  pathname: string;
}) {
  const { variant, modeLabel: currentModeLabel } = resolveVariant(share, inviteEnabled);
  const previewImageUrl = share.imageUrl.replace(/^https?:\/\/[^/]+/, "");
  const nativeShareAvailable = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const openShareWindow = (url: string, label: string) => {
    if (typeof window === "undefined") return;
    const actionBase = label === "X"
      ? "share_x"
      : label === "LinkedIn"
      ? "share_linkedin"
      : "share_reddit";
    trackShareEvent({ action: `${actionBase}_attempt`, kind: share.kind, mode: share.mode, path: pathname });
    const popup = window.open(url, `${label.toLowerCase()}-share`, "noopener,noreferrer,width=640,height=720");
    if (!popup) {
      toast.error(`${label} share could not be opened`);
      return;
    }
    trackShareEvent({ action: `${actionBase}_success`, kind: share.kind, mode: share.mode, path: pathname });
    toast.success(`${label} share opened`);
  };

  const handleNativeShare = async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.share) {
        toast.error("Native share is not available in this browser");
        return;
      }

      trackShareEvent({ action: "native_share_attempt", kind: share.kind, mode: share.mode, path: pathname });
      await navigator.share({
        title: share.title,
        text: variant.shareText,
        url: variant.href,
      });
      trackShareEvent({ action: "native_share_success", kind: share.kind, mode: share.mode, path: pathname });
      toast.success("Insight ready to share");
      onClose();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not open native share");
    }
  };

  const utilityItems: Array<{
    key: string;
    label: string;
    action: () => void | Promise<void>;
    icon: typeof Copy;
  }> = [
    {
      key: "copy-link",
      label: "Copy link",
      action: async () => {
        const didCopy = await copyToClipboard(variant.href, "Share link copied");
        if (didCopy) {
          trackShareEvent({ action: "copy_link_success", kind: share.kind, mode: share.mode, path: pathname });
        }
      },
      icon: Link2,
    },
    {
      key: "copy-post",
      label: "Copy post text",
      action: async () => {
        const didCopy = await copyToClipboard(variant.clipboardText, "Share text copied");
        if (didCopy) {
          trackShareEvent({ action: "copy_post_success", kind: share.kind, mode: share.mode, path: pathname });
        }
      },
      icon: Copy,
    },
    {
      key: "copy-x",
      label: "Copy X text",
      action: async () => {
        const didCopy = await copyToClipboard(variant.xText, "X post text copied");
        if (didCopy) {
          trackShareEvent({ action: "copy_x_success", kind: share.kind, mode: share.mode, path: pathname });
        }
      },
      icon: Copy,
    },
    {
      key: "copy-linkedin",
      label: "Copy LinkedIn caption",
      action: async () => {
        const didCopy = await copyToClipboard(variant.linkedInText, "LinkedIn caption copied");
        if (didCopy) {
          trackShareEvent({ action: "copy_linkedin_success", kind: share.kind, mode: share.mode, path: pathname });
        }
      },
      icon: Copy,
    },
    {
      key: "copy-reddit",
      label: "Copy Reddit title",
      action: async () => {
        const didCopy = await copyToClipboard(variant.redditTitle, "Reddit title copied");
        if (didCopy) {
          trackShareEvent({ action: "copy_reddit_success", kind: share.kind, mode: share.mode, path: pathname });
        }
      },
      icon: Copy,
    },
    {
      key: "download-card",
      label: "Download card",
      action: async () => {
        const didDownload = await downloadImage(share.imageUrl, share.title);
        if (didDownload) {
          trackShareEvent({ action: "download_card_success", kind: share.kind, mode: share.mode, path: pathname });
        }
      },
      icon: Download,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/60">
        <Image
          src={previewImageUrl}
          alt={share.title}
          width={1200}
          height={630}
          unoptimized
          className="h-44 w-full object-cover"
        />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3 w-3" />
              {currentModeLabel}
            </span>
            <a
              href={variant.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-primary"
            >
              Open destination
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">{share.eyebrow}</p>
            <h3 className="mt-1 text-base font-bold tracking-tight text-foreground">{share.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{share.takeaway}</p>
            <p className="mt-2 text-xs text-muted-foreground/80 leading-relaxed">{share.context}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {nativeShareAvailable ? (
          <Button type="button" variant="default" className="justify-between" onClick={handleNativeShare}>
            Native share
            <Share2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="justify-between" onClick={() => openShareWindow(variant.xUrl, "X")}>
          Share to X
          <span className="text-xs font-bold">X</span>
        </Button>
        <Button type="button" variant="outline" className="justify-between" onClick={() => openShareWindow(variant.linkedInUrl, "LinkedIn")}>
          Share to LinkedIn
          <span className="text-xs font-bold">in</span>
        </Button>
        <Button type="button" variant="outline" className="justify-between" onClick={() => openShareWindow(variant.redditUrl, "Reddit")}>
          Share to Reddit
          <span className="text-xs font-bold">r/</span>
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Utility actions</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {utilityItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.key}
                type="button"
                variant="ghost"
                className="justify-between border border-white/8 bg-card/40 hover:bg-card/70"
                onClick={() => void item.action()}
              >
                {item.label}
                <Icon className="h-3.5 w-3.5" />
              </Button>
            );
          })}
        </div>
      </div>

      {share.invite ? (
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">Invite mode</p>
            <p className="text-sm font-semibold text-foreground">Switch between an authority-first product share and a referral-aware invite.</p>
            <p className="text-xs text-muted-foreground">Keep this off when you want to share the product story. Turn it on when you want your personal referral link included.</p>
          </div>
          <Switch
            checked={inviteEnabled}
            onCheckedChange={(value) => {
              trackShareEvent({
                action: value ? "invite_toggle_on" : "invite_toggle_off",
                kind: share.kind,
                mode: share.mode,
                path: pathname,
              });
              onInviteEnabledChange(value);
            }}
            aria-label="Toggle invite mode"
          />
        </div>
      ) : null}
    </div>
  );
}

export function ShareInsightButton({
  share,
  text,
  label = "Share",
  title,
  url,
  clipboardText,
  className,
}: ShareInsightButtonProps) {
  const isMobile = useIsMobile();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [inviteEnabled, setInviteEnabled] = useState(false);

  const shareObject = useMemo(
    () => share ?? createLegacyShareObject({
      title,
      text: text ?? title ?? "InsightAlpha update",
      url,
      clipboardText,
      label,
    }),
    [clipboardText, label, share, text, title, url],
  );

  const description = modeDescription(shareObject.mode);
  const buttonLabel = shareObject.ctaLabel ?? label;

  const handleOpen = () => {
    trackShareEvent({ action: "sheet_open", kind: shareObject.kind, mode: shareObject.mode, path: pathname });
    setOpen(true);
  };

  const trigger = (
    <Button type="button" variant="outline" size="sm" onClick={handleOpen} className={className}>
      <Share2 className="h-3.5 w-3.5" />
      {buttonLabel}
    </Button>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl border border-white/10 bg-background/95 p-0">
            <SheetHeader className="border-b border-white/5 text-left">
              <SheetTitle>{shareObject.title}</SheetTitle>
              <SheetDescription>{description}</SheetDescription>
            </SheetHeader>
            <div className="p-4">
              <ShareSheetBody
                share={shareObject}
                inviteEnabled={inviteEnabled}
                onInviteEnabledChange={setInviteEnabled}
                onClose={() => setOpen(false)}
                pathname={pathname}
              />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl border border-white/10 bg-background/95 p-0">
          <DialogHeader className="border-b border-white/5 p-6 text-left">
            <DialogTitle>{shareObject.title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto p-6 pt-4">
            <ShareSheetBody
              share={shareObject}
              inviteEnabled={inviteEnabled}
              onInviteEnabledChange={setInviteEnabled}
              onClose={() => setOpen(false)}
              pathname={pathname}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
