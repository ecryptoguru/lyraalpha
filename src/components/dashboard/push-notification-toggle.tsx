"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { toast } from "sonner";

export function PushNotificationToggle({
  checked,
  disabled = false,
  onStatusChange,
}: {
  checked?: boolean;
  disabled?: boolean;
  onStatusChange?: (nextValue: boolean) => void;
}) {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();
  const isActive = checked ?? isSubscribed;

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-muted/20 p-4 opacity-80">
        <BellOff className="h-4 w-4 text-muted-foreground shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Push Notifications</p>
          <p className="text-xs text-muted-foreground mt-0.5">Not supported in this browser, so high-priority alerts will stay in your dashboard feed.</p>
        </div>
      </div>
    );
  }

  const handleToggle = async () => {
    if (isActive) {
      const ok = await unsubscribe();
      if (ok) {
        onStatusChange?.(false);
        toast.success("Push notifications disabled");
      }
      else toast.error("Failed to disable notifications");
    } else {
      if (permission === "denied") {
        toast.error("Notifications blocked. Enable them in browser settings.");
        return;
      }
      const ok = await subscribe();
      if (ok) {
        onStatusChange?.(true);
        toast.success("Push notifications enabled!");
      }
      else if (permission !== "granted") toast.info("Notification permission denied");
      else toast.error("Failed to enable notifications");
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-card/40 p-4">
      <div className="flex items-center gap-3">
        <div className={`h-8 w-8 rounded-2xl flex items-center justify-center ${isActive ? "bg-primary/10" : "bg-muted/40"}`}>
          {isActive ? (
            <Bell className="h-4 w-4 text-primary" />
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Push Notifications</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isActive
              ? "Receiving high-priority alerts for portfolio risk, new opportunities and market regime shifts"
              : permission === "denied"
              ? "Blocked — enable in browser settings"
              : "Get rare, high-value alerts when portfolio risk rises, new ideas surface or the market story changes"}
          </p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={disabled || isLoading || permission === "denied"}
        className={`relative inline-flex min-h-[38px] min-w-[48px] items-center justify-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed`}
        aria-label={isActive ? "Disable push notifications" : "Enable push notifications"}
      >
        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${isActive ? "bg-primary" : "bg-muted"}`}>
          {isLoading ? (
            <Loader2 className="h-3 w-3 text-white animate-spin mx-auto" />
          ) : (
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                isActive ? "translate-x-6" : "translate-x-1"
              }`}
            />
          )}
        </div>
      </button>
    </div>
  );
}
