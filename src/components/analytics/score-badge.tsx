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
      "bg-success/10 text-success dark:bg-success/30 dark:text-success hover:bg-success/20 dark:hover:bg-success/50";
  else if (score <= 30)
    colorClass =
      "bg-danger/10 text-danger dark:bg-danger/30 dark:text-danger hover:bg-danger/20 dark:hover:bg-danger/50";
  else
    colorClass =
      "bg-warning/10 text-warning dark:bg-warning/30 dark:text-warning hover:bg-warning/20 dark:hover:bg-warning/50";

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
