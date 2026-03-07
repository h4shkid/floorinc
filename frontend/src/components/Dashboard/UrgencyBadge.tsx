import { AlertTriangle, Clock, CheckCircle, PackageX } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface BadgeConfig {
  label: string;
  icon: LucideIcon;
  cls: string;
}

const config: Record<string, BadgeConfig> = {
  BACKORDER: {
    label: "Backorder",
    icon: PackageX,
    cls: "bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-800",
  },
  RED: {
    label: "Order Now",
    icon: AlertTriangle,
    cls: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800",
  },
  YELLOW: {
    label: "Low Stock",
    icon: Clock,
    cls: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-700",
  },
  GREEN: {
    label: "Healthy",
    icon: CheckCircle,
    cls: "bg-green-50 text-green-700 ring-green-200 dark:bg-green-950/40 dark:text-green-300 dark:ring-green-800",
  },
};

export function UrgencyBadge({ urgency }: { urgency: "BACKORDER" | "RED" | "YELLOW" | "GREEN" }) {
  const { label, icon: Icon, cls } = config[urgency];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${cls}`}
      title={urgency === "BACKORDER" ? "Backorder — negative available stock" : label}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
