import { useState, useEffect, useCallback, useMemo } from "react";
import { DollarSign, ShoppingCart, TrendingUp, Percent, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { fetchSalesAnalytics } from "../../api/client";
import type { SalesAnalyticsResponse, SalesMonthlyTrend, SalesChannelPerformance, SalesTopSKU, SalesCategoryPerformance } from "../../types";

function fmtCurrency(val: number): string {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtCompact(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return fmtCurrency(val);
}

// --- Stat Cards ---
function SalesStatCards({ kpis }: { kpis: SalesAnalyticsResponse["kpis"] }) {
  const cards = [
    {
      label: "Total Revenue",
      value: fmtCompact(kpis.total_revenue),
      textColor: "text-blue-600 dark:text-blue-400",
      borderColor: "border-l-blue-500",
      bgColor: "bg-blue-50/50 dark:bg-blue-950/10",
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      Icon: DollarSign,
      trend: kpis.revenue_trend,
    },
    {
      label: "Total Orders",
      value: kpis.total_orders.toLocaleString(),
      textColor: "text-green-600 dark:text-green-400",
      borderColor: "border-l-green-500",
      bgColor: "bg-green-50/50 dark:bg-green-950/10",
      iconBg: "bg-green-100 dark:bg-green-900/30",
      Icon: ShoppingCart,
      trend: null as number | null,
    },
    {
      label: "Avg Order Value",
      value: fmtCurrency(kpis.avg_order_value),
      textColor: "text-amber-600 dark:text-amber-400",
      borderColor: "border-l-amber-500",
      bgColor: "bg-amber-50/50 dark:bg-amber-950/10",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      Icon: TrendingUp,
      trend: null as number | null,
    },
    {
      label: "Gross Margin",
      value: kpis.gross_margin_pct != null ? `${kpis.gross_margin_pct}%` : "N/A",
      textColor: "text-purple-600 dark:text-purple-400",
      borderColor: "border-l-purple-500",
      bgColor: "bg-purple-50/50 dark:bg-purple-950/10",
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      Icon: Percent,
      trend: null as number | null,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 ${c.borderColor} ${c.bgColor} p-4 hover-lift cursor-default`}>
          <div className="flex items-start justify-between">
            <div>
              <div className={`text-2xl font-bold tabular-nums ${c.textColor}`}>{c.value}</div>
              <div className="text-sm font-medium mt-1 text-slate-500 dark:text-slate-400">
                {c.label}
                {c.trend != null && (
                  <span className={`ml-2 text-xs font-semibold ${c.trend >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {c.trend >= 0 ? "+" : ""}{c.trend}%
                  </span>
                )}
              </div>
            </div>
            <div className={`p-2 rounded-lg ${c.iconBg}`}>
              <c.Icon className={`h-5 w-5 ${c.textColor}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Revenue Trend Bar Chart ---
function RevenueTrend({ data }: { data: SalesMonthlyTrend[] }) {
  if (data.length === 0) return null;
  const maxRevenue = Math.max(...data.map((d) => d.revenue));

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-6">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Monthly Revenue</h3>
      <div className="flex items-end gap-1.5" style={{ height: 130 }}>
        {data.map((m) => {
          const h = maxRevenue > 0 ? (m.revenue / maxRevenue) * 100 : 0;
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full flex flex-col justify-end" style={{ height: 110 }}>
                <div
                  className="w-full bg-blue-500 dark:bg-blue-400 rounded-t transition-all hover:bg-blue-600 dark:hover:bg-blue-300"
                  style={{ height: `${h}%`, minHeight: m.revenue > 0 ? 2 : 0 }}
                  title={`${m.month}: ${fmtCurrency(m.revenue)} | ${m.orders.toLocaleString()} orders | ${m.units.toLocaleString()} units`}
                />
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums truncate w-full text-center">
                {m.month.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Channel Distribution ---
const CHANNEL_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500", "bg-slate-400",
];

function ChannelDistribution({ channels }: { channels: SalesChannelPerformance[] }) {
  if (channels.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Channel Revenue Share</h3>

      {/* Stacked bar */}
      <div className="flex rounded-lg overflow-hidden h-8 mb-3">
        {channels.map((c, i) => (
          <div
            key={c.channel}
            className={`${CHANNEL_COLORS[i % CHANNEL_COLORS.length]} transition-all hover:opacity-80`}
            style={{ width: `${c.revenue_pct}%`, minWidth: c.revenue_pct > 0 ? 2 : 0 }}
            title={`${c.channel}: ${fmtCurrency(c.revenue)} (${c.revenue_pct}%)`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {channels.map((c, i) => (
          <div key={c.channel} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className={`w-2.5 h-2.5 rounded-full ${CHANNEL_COLORS[i % CHANNEL_COLORS.length]} shrink-0`} />
            <span className="font-medium">{c.channel}</span>
            <span className="tabular-nums text-slate-400 dark:text-slate-500">{c.revenue_pct}%</span>
            <span className="tabular-nums text-slate-400 dark:text-slate-500">({fmtCurrency(c.revenue)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Category Breakdown ---
function CategoryBreakdown({ categories }: { categories: SalesCategoryPerformance[] }) {
  if (categories.length === 0) return null;
  const maxRevenue = Math.max(...categories.map((c) => c.revenue));
  const top = categories.slice(0, 8);

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Category Breakdown</h3>
      <div className="space-y-2">
        {top.map((c) => {
          const w = maxRevenue > 0 ? (c.revenue / maxRevenue) * 100 : 0;
          return (
            <div key={c.category}>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="text-slate-700 dark:text-slate-300 font-medium truncate mr-2">{c.category}</span>
                <span className="text-slate-500 dark:text-slate-400 tabular-nums shrink-0">{fmtCurrency(c.revenue)}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full transition-all"
                  style={{ width: `${w}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Top Sellers Table ---
type TopSKUSortKey = "revenue" | "units" | "orders" | "margin_pct" | "display_name";
type SortDir = "asc" | "desc";

function SortHeader({ label, sk, activeKey, activeDir, onSort, align = "left", className = "" }: {
  label: string; sk: TopSKUSortKey; activeKey: TopSKUSortKey; activeDir: SortDir;
  onSort: (key: TopSKUSortKey) => void; align?: "left" | "right"; className?: string;
}) {
  const active = activeKey === sk;
  return (
    <th
      onClick={() => onSort(sk)}
      className={`font-medium px-3 py-3 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 transition-colors ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {label}
        {active && activeDir === "asc" ? (
          <ChevronUp className="w-3 h-3 text-blue-500" />
        ) : active && activeDir === "desc" ? (
          <ChevronDown className="w-3 h-3 text-blue-500" />
        ) : (
          <ChevronsUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600" />
        )}
      </span>
    </th>
  );
}

function TopSellersTable({ skus }: { skus: SalesTopSKU[] }) {
  const [sortKey, setSortKey] = useState<TopSKUSortKey>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = useCallback((key: TopSKUSortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir(key === "display_name" ? "asc" : "desc");
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    return [...skus].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "display_name": cmp = (a.display_name || a.sku).localeCompare(b.display_name || b.sku); break;
        case "revenue": cmp = a.revenue - b.revenue; break;
        case "units": cmp = a.units - b.units; break;
        case "orders": cmp = a.orders - b.orders; break;
        case "margin_pct": cmp = (a.margin_pct ?? -999) - (b.margin_pct ?? -999); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [skus, sortKey, sortDir]);

  if (skus.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Top Sellers</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <th className="px-3 py-3 text-left font-medium w-12">#</th>
            <SortHeader label="Product" sk="display_name" activeKey={sortKey} activeDir={sortDir} onSort={toggleSort} />
            <SortHeader label="Revenue" sk="revenue" activeKey={sortKey} activeDir={sortDir} onSort={toggleSort} align="right" className="w-28" />
            <SortHeader label="Units" sk="units" activeKey={sortKey} activeDir={sortDir} onSort={toggleSort} align="right" className="w-20" />
            <SortHeader label="Orders" sk="orders" activeKey={sortKey} activeDir={sortDir} onSort={toggleSort} align="right" className="w-20" />
            <SortHeader label="Margin" sk="margin_pct" activeKey={sortKey} activeDir={sortDir} onSort={toggleSort} align="right" className="w-20" />
            <th className="px-3 py-3 text-left font-medium w-36">Top Channel</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr key={s.sku} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <td className="px-3 py-2.5 text-slate-400 dark:text-slate-500 tabular-nums">{i + 1}</td>
              <td className="px-3 py-2.5">
                <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-xs">{s.display_name || s.sku}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500">{s.sku}</div>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300 font-medium">{fmtCurrency(s.revenue)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">{s.units.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">{s.orders.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right">
                {s.margin_pct != null ? (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold tabular-nums ${
                    s.margin_pct > 30 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                    s.margin_pct > 15 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                    "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  }`}>
                    {s.margin_pct}%
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[144px]">{s.top_channel || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Period Selector ---
function PeriodSelector({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const periods = [
    { label: "3M", months: 3 },
    { label: "6M", months: 6 },
    { label: "12M", months: 12 },
    { label: "24M", months: 24 },
  ];
  return (
    <div className="flex gap-1">
      {periods.map((p) => (
        <button
          key={p.months}
          onClick={() => onChange(p.months)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            value === p.months
              ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// --- Main Page ---
export function SalesPage() {
  const [data, setData] = useState<SalesAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);
  const [channelFilter, setChannelFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchSalesAnalytics(months, channelFilter)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [months, channelFilter]);

  if (loading) {
    return (
      <div className="text-center py-12 text-slate-500 dark:text-slate-400">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 mb-3" />
        <div>Loading sales data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-slate-500 dark:text-slate-400">
        No sales data available.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sales Analytics</h2>
          {data.date_from && data.date_to && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {data.date_from} to {data.date_to}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {data.channel_performance.length > 1 && (
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Channels</option>
              {data.channel_performance.map((c) => (
                <option key={c.channel} value={c.channel}>{c.channel}</option>
              ))}
            </select>
          )}
          <PeriodSelector value={months} onChange={setMonths} />
        </div>
      </div>

      <SalesStatCards kpis={data.kpis} />

      <RevenueTrend data={data.monthly_trend} />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <ChannelDistribution channels={data.channel_performance} />
        <CategoryBreakdown categories={data.category_performance} />
      </div>

      <TopSellersTable skus={data.top_skus} />
    </div>
  );
}
