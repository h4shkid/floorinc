import { AlertTriangle, Clock, CheckCircle, PackageX } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const config: Record<string, { label: string; icon: LucideIcon; iconCls: string; tipCls: string }> = {
  BACKORDER: { label: "Backorder", icon: PackageX, iconCls: "text-purple-500 dark:text-purple-400", tipCls: "bg-purple-700 dark:bg-purple-600" },
  RED: { label: "Order Now", icon: AlertTriangle, iconCls: "text-red-500 dark:text-red-400", tipCls: "bg-red-700 dark:bg-red-600" },
  YELLOW: { label: "Low Stock", icon: Clock, iconCls: "text-amber-500 dark:text-amber-400", tipCls: "bg-amber-700 dark:bg-amber-600" },
  GREEN: { label: "Healthy", icon: CheckCircle, iconCls: "text-green-500 dark:text-green-400", tipCls: "bg-green-700 dark:bg-green-600" },
};

export function UrgencyBadge({ urgency }: { urgency: "BACKORDER" | "RED" | "YELLOW" | "GREEN" }) {
  const { label, icon: Icon, iconCls, tipCls } = config[urgency];
  return (
    <span className="relative group inline-flex items-center justify-center w-full">
      <Icon className={`w-5 h-5 ${iconCls}`} />
      <span className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded text-[10px] font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${tipCls}`}>
        {label}
      </span>
    </span>
  );
}
