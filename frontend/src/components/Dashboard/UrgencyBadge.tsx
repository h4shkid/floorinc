import { AlertTriangle, Clock, CheckCircle, PackageX } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const config: Record<string, { label: string; icon: LucideIcon; cls: string }> = {
  BACKORDER: { label: "Backorder", icon: PackageX, cls: "text-purple-500 dark:text-purple-400" },
  RED: { label: "Order Now", icon: AlertTriangle, cls: "text-red-500 dark:text-red-400" },
  YELLOW: { label: "Low Stock", icon: Clock, cls: "text-amber-500 dark:text-amber-400" },
  GREEN: { label: "Healthy", icon: CheckCircle, cls: "text-green-500 dark:text-green-400" },
};

export function UrgencyBadge({ urgency }: { urgency: "BACKORDER" | "RED" | "YELLOW" | "GREEN" }) {
  const { label, icon: Icon, cls } = config[urgency];
  return (
    <span title={label} className={`inline-flex items-center justify-center ${cls}`}>
      <Icon className="w-5 h-5" />
    </span>
  );
}
