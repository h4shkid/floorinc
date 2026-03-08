import { PackageX, AlertTriangle, Clock, CheckCircle, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ForecastSummary } from "../../types";

const borderColors: Record<string, string> = {
  purple: "border-l-purple-500",
  red: "border-l-red-500",
  amber: "border-l-amber-500",
  green: "border-l-green-500",
  slate: "border-l-slate-400 dark:border-l-slate-500",
};

const bgColors: Record<string, string> = {
  purple: "bg-purple-50/50 dark:bg-purple-950/10",
  red: "bg-red-50/50 dark:bg-red-950/10",
  amber: "bg-amber-50/50 dark:bg-amber-950/10",
  green: "bg-green-50/50 dark:bg-green-950/10",
  slate: "bg-white dark:bg-slate-800",
};

const textColors: Record<string, string> = {
  purple: "text-purple-600 dark:text-purple-400",
  red: "text-red-600 dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  green: "text-green-600 dark:text-green-400",
  slate: "text-slate-700 dark:text-slate-300",
};

const iconBgColors: Record<string, string> = {
  purple: "bg-purple-100 dark:bg-purple-900/30",
  red: "bg-red-100 dark:bg-red-900/30",
  amber: "bg-amber-100 dark:bg-amber-900/30",
  green: "bg-green-100 dark:bg-green-900/30",
  slate: "bg-slate-100 dark:bg-slate-700",
};

export function SummaryCards({ summary, activeUrgency, onUrgencyClick }: { summary: ForecastSummary; activeUrgency?: string; onUrgencyClick?: (urgency: string) => void }) {
  return (
    <div className="grid grid-cols-5 gap-4 mb-6" data-tour="summary-cards">
      <Card label="Backorders" count={summary.backorder} color="purple" icon={PackageX} urgency="BACKORDER" activeUrgency={activeUrgency} onClick={onUrgencyClick} />
      <Card label="Order Now" count={summary.red} color="red" icon={AlertTriangle} urgency="RED" activeUrgency={activeUrgency} onClick={onUrgencyClick} />
      <Card label="Getting Close" count={summary.yellow} color="amber" icon={Clock} urgency="YELLOW" activeUrgency={activeUrgency} onClick={onUrgencyClick} />
      <Card label="Comfortable" count={summary.green} color="green" icon={CheckCircle} urgency="GREEN" activeUrgency={activeUrgency} onClick={onUrgencyClick} />
      <Card label="Total SKUs" count={summary.total_skus} color="slate" icon={BarChart3} urgency="" activeUrgency={activeUrgency} onClick={onUrgencyClick} />
    </div>
  );
}

function Card({ label, count, color, icon: Icon, urgency, activeUrgency, onClick }: { label: string; count: number; color: string; icon: LucideIcon; urgency: string; activeUrgency?: string; onClick?: (urgency: string) => void }) {
  const isActive = activeUrgency === urgency;
  return (
    <button
      type="button"
      onClick={() => onClick?.(isActive ? "" : urgency)}
      className={`rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 ${borderColors[color]} ${bgColors[color]} p-4 hover-lift cursor-pointer text-left transition-all`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-3xl font-bold tabular-nums ${textColors[color]}`}>{count.toLocaleString()}</div>
          <div className="text-sm font-medium mt-1 text-slate-500 dark:text-slate-400">{label}</div>
        </div>
        <div className={`p-2 rounded-lg ${iconBgColors[color]}`}>
          <Icon className={`h-5 w-5 ${textColors[color]}`} />
        </div>
      </div>
    </button>
  );
}
