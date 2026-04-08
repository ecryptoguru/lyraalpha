import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface ScoreBadgeProps {
  score: number;
  direction?: "UP" | "DOWN" | "FLAT" | "NEUTRAL";
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md";
}

export function ScoreBadge({
  score,
  direction = "NEUTRAL",
  onClick,
  className,
  size = "md",
}: ScoreBadgeProps) {
  // Determine Color
  let colorClass = "bg-muted text-muted-foreground hover:bg-muted/80";
  if (score >= 70)
    colorClass =
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50";
  else if (score <= 30)
    colorClass =
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50";
  else
    colorClass =
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50";

  // Determine Icon
  const Icon =
    direction === "UP" ? ArrowUp : direction === "DOWN" ? ArrowDown : Minus;

  return (
    <Badge
      variant="outline"
      className={cn(
        "cursor-pointer flex items-center gap-1.5 transition-colors border-transparent",
        size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2.5 py-0.5 text-sm",
        colorClass,
        className,
      )}
      onClick={onClick}
    >
      <span className="font-bold">{Math.round(score)}</span>
      {direction !== "NEUTRAL" && (
        <Icon className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />
      )}
    </Badge>
  );
}
