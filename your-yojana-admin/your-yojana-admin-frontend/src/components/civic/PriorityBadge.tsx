// ──────────────────────────────────────────────
// PriorityBadge — brutalist priority level badge
// ──────────────────────────────────────────────

import { cn } from "../../utils/utils"

interface PriorityBadgeProps {
  level: string
  className?: string
}

const levelStyles: Record<string, string> = {
  CRITICAL:
    "bg-foreground text-background border-foreground font-black",
  HIGH:
    "bg-transparent text-foreground border-foreground border-2 font-bold",
  MEDIUM:
    "bg-muted text-foreground border-border font-semibold",
  LOW:
    "bg-transparent text-muted-foreground border-muted-foreground font-medium",
}

export function PriorityBadge({ level, className }: PriorityBadgeProps) {
  const normalized = (level || "LOW").toUpperCase()
  const style = levelStyles[normalized] || levelStyles.LOW

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 text-xs tracking-[0.2em] uppercase border",
        style,
        className
      )}
    >
      {normalized}
    </span>
  )
}
