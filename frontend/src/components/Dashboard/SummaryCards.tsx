import type { ForecastSummary } from "../../types";

export function SummaryCards({ summary }: { summary: ForecastSummary }) {
  return (
    <div className="grid grid-cols-5 gap-4 mb-6">
      <Card label="Backorders" count={summary.backorder} color="purple" />
      <Card label="Order Now" count={summary.red} color="red" />
      <Card label="Getting Close" count={summary.yellow} color="amber" />
      <Card label="Comfortable" count={summary.green} color="green" />
      <Card label="Total SKUs" count={summary.total_skus} color="slate" />
    </div>
  );
}

function Card({ label, count, color }: { label: string; count: number; color: string }) {
  const colorMap: Record<string, string> = {
    purple: "bg-white border-slate-200 text-purple-600 dark:bg-slate-800 dark:border-slate-700 dark:text-purple-400",
    red: "bg-white border-slate-200 text-red-600 dark:bg-slate-800 dark:border-slate-700 dark:text-red-400",
    amber: "bg-white border-slate-200 text-amber-600 dark:bg-slate-800 dark:border-slate-700 dark:text-amber-400",
    green: "bg-white border-slate-200 text-green-600 dark:bg-slate-800 dark:border-slate-700 dark:text-green-400",
    slate: "bg-white border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300",
  };
  return (
    <div className={`rounded-xl border-2 p-4 ${colorMap[color]}`}>
      <div className="text-3xl font-bold">{count.toLocaleString()}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
    </div>
  );
}
