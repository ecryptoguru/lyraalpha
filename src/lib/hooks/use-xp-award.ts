import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { mutate } from "swr";

type XPAction =
  | "explain_score"
  | "complete_module"
  | "discovery_explore"
  | "lyra_question"
  | "weekly_streak";

interface AwardXPOptions {
  action: XPAction;
  context?: string;
  silent?: boolean; // skip all notifications (for background awards)
}

interface XPResponse {
  success: boolean;
  xp: {
    awarded: boolean;
    amount: number;
    reason?: string;
    newTotalXp: number;
    newLevel: number;
    previousLevel: number;
    leveledUp: boolean;
    streakUpdated: boolean;
    newStreak: number;
    tierName: string;
  };
  streakBonus: {
    awarded: boolean;
    amount: number;
    newStreak: number;
  } | null;
  badges: {
    newlyAwarded: string[];
  };
}

/**
 * Hook for awarding XP from any component.
 *
 * Notification behavior (per spec):
 * - Regular XP (+3/+5): No toast. Triggers SWR revalidation so sidebar XP bar updates.
 * - Module completion (+15): Small toast (handled by module reader, not this hook).
 * - Badge earned: Prominent toast with badge icon.
 * - Level up: Celebratory toast.
 * - Streak milestone: Toast with fire emoji.
 */
export function useXPAward() {
  const pendingRef = useRef(false);

  const awardXP = useCallback(async (options: AwardXPOptions): Promise<XPResponse | null> => {
    if (pendingRef.current) return null;
    pendingRef.current = true;

    try {
      const res = await fetch("/api/learning/xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: options.action,
          context: options.context,
        }),
      });

      if (!res.ok) return null;

      const data: XPResponse = await res.json();
      if (!data.success || !data.xp.awarded) return data;

      mutate("/api/points");
      mutate("/api/learning/progress");
      mutate("/api/learning/badges");

      if (options.silent) return data;

      // Milestone toasts only (regular XP is silent per spec)
      if (data.xp.leveledUp) {
        toast.success(
          `Level ${data.xp.newLevel}! You're now a ${data.xp.tierName}`,
          { icon: "🎉" },
        );
      }

      if (data.badges.newlyAwarded.length > 0) {
        for (const badge of data.badges.newlyAwarded) {
          toast.success(`Badge Earned: ${badge}`, { icon: "🏅" });
        }
      }

      if (data.streakBonus?.awarded) {
        toast.success(
          `${data.xp.newStreak}-Day Streak! +${data.streakBonus.amount} XP Bonus`,
          { icon: "🔥" },
        );
      }

      return data;
    } catch {
      return null;
    } finally {
      pendingRef.current = false;
    }
  }, []);

  return { awardXP };
}
