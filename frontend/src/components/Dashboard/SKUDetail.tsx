import { useEffect, useState, useRef } from "react";
import { X, Sparkles, Package, Clock, TrendingUp, Gauge, Calendar, DollarSign, BarChart3, ShoppingCart, Truck, Info } from "lucide-react";
import type { SKUDetail } from "../../types";
import { fetchSKUDetail } from "../../api/client";
import { DetailPanelSkeleton } from "./Skeleton";

interface Props {
  sku: string;
  velocityWindow?: number;
  onClose: () => void;
}

const CHANNEL_SHORT: Record<string, string> = {
  "Amazon Vendor Central": "AVC",
  "Amazon Seller Central": "ASC",
  "FI": "FI",
  "Home Depot": "HD",
  "Wayfair": "WF",
  "Walmart": "WM",
  "eBay": "eBay",
};

function shortChannel(ch: string): string {
  return CHANNEL_SHORT[ch] ?? ch;
}

function fmtCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(mo, 10) - 1]} '${y.slice(2)}`;
}

function fmtDate(d: string): string {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr + "Z");
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group">
      <Info className="h-3 w-3 text-slate-300 dark:text-slate-600 cursor-help" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-[10px] leading-tight text-white dark:text-slate-900 text-wrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-[220px] text-center font-medium shadow-lg">
        {text}
      </span>
    </span>
  );
}

const CHANNEL_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500",
];

export function SKUDetailPanel({ sku, velocityWindow = 90, onClose }: Props) {
  const [data, setData] = useState<SKUDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchSKUDetail(sku, velocityWindow)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sku, velocityWindow]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const maxQty = data ? Math.max(...data.monthly_sales.map((m) => m.quantity), 1) : 1;
  const totalChannelQty = data ? data.channel_breakdown.reduce((sum, c) => sum + c.quantity, 0) : 1;

  // Determine urgency color for the days remaining card
  const daysColor = data
    ? data.days_remaining !== null && data.days_remaining <= data.lead_time_days
      ? "red"
      : data.days_remaining !== null && data.days_remaining <= data.lead_time_days * 1.5
      ? "amber"
      : "green"
    : "slate";

  const availColor = data
    ? data.available_qty < 0
      ? "red"
      : data.available_qty === 0
      ? "amber"
      : "blue"
    : "slate";

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 bg-black/30 flex justify-end"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-2xl bg-slate-50 dark:bg-slate-900 shadow-2xl h-full overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-5 py-4 flex items-center justify-between z-10 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">SKU Detail</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && <DetailPanelSkeleton />}

        {error && (
          <div className="mx-5 mt-5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {data && (
          <div className="px-5 py-5 space-y-5">
            {/* Product info card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">{data.display_name}</h3>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{data.sku}</span>
                {data.manufacturer && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">{data.manufacturer}</span>
                )}
              </div>
            </div>

            {/* Status cards — matching SummaryCards style */}
            <div className="grid grid-cols-2 gap-3" data-tour="detail-status-cards">
              {/* Available card */}
              <div className={`rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 ${
                availColor === "red" ? "border-l-red-500 bg-red-50/50 dark:bg-red-950/10" :
                availColor === "amber" ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/10" :
                "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/10"
              } p-4`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`text-2xl font-bold tabular-nums ${
                      availColor === "red" ? "text-red-600 dark:text-red-400" :
                      availColor === "amber" ? "text-amber-600 dark:text-amber-400" :
                      "text-blue-600 dark:text-blue-400"
                    }`}>
                      {data.available_qty.toLocaleString()}
                    </div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Available</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      {data.on_hand.toLocaleString()} on hand &minus; {data.qty_committed.toLocaleString()} committed
                    </div>
                    {data.incoming_qty > 0 && data.available_qty <= 0 && (
                      <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-1">
                        +{data.net_after_receipt.toLocaleString()} after receipt
                      </div>
                    )}
                  </div>
                  <div className={`p-2 rounded-lg ${
                    availColor === "red" ? "bg-red-100 dark:bg-red-900/30" :
                    availColor === "amber" ? "bg-amber-100 dark:bg-amber-900/30" :
                    "bg-blue-100 dark:bg-blue-900/30"
                  }`}>
                    <Package className={`h-5 w-5 ${
                      availColor === "red" ? "text-red-600 dark:text-red-400" :
                      availColor === "amber" ? "text-amber-600 dark:text-amber-400" :
                      "text-blue-600 dark:text-blue-400"
                    }`} />
                  </div>
                </div>
              </div>

              {/* Days remaining card */}
              <div className={`rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 ${
                daysColor === "red" ? "border-l-red-500 bg-red-50/50 dark:bg-red-950/10" :
                daysColor === "amber" ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/10" :
                "border-l-green-500 bg-green-50/50 dark:bg-green-950/10"
              } p-4`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`text-2xl font-bold tabular-nums ${
                      daysColor === "red" ? "text-red-600 dark:text-red-400" :
                      daysColor === "amber" ? "text-amber-600 dark:text-amber-400" :
                      "text-green-600 dark:text-green-400"
                    }`}>
                      {data.days_remaining !== null ? `${data.days_remaining.toFixed(0)}d` : "-"}
                    </div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Days Remaining</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      Lead time: {data.lead_time_days}d
                    </div>
                  </div>
                  <div className={`p-2 rounded-lg ${
                    daysColor === "red" ? "bg-red-100 dark:bg-red-900/30" :
                    daysColor === "amber" ? "bg-amber-100 dark:bg-amber-900/30" :
                    "bg-green-100 dark:bg-green-900/30"
                  }`}>
                    <Clock className={`h-5 w-5 ${
                      daysColor === "red" ? "text-red-600 dark:text-red-400" :
                      daysColor === "amber" ? "text-amber-600 dark:text-amber-400" :
                      "text-green-600 dark:text-green-400"
                    }`} />
                  </div>
                </div>
              </div>
            </div>

            {/* AI Insight */}
            {data.ai_insight && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-50 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">AI Insight</span>
                  {data.insight_generated_at && (
                    <span className="ml-auto text-[10px] text-indigo-400 dark:text-indigo-500">{timeAgo(data.insight_generated_at)}</span>
                  )}
                </div>
                <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed">{data.ai_insight}</p>
              </div>
            )}

            {/* Incoming Purchase Orders */}
            {data.purchase_orders.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden" data-tour="detail-purchase-orders">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-slate-400" />
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Incoming Purchase Orders</h4>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <th className="px-3 py-2 text-left font-medium">PO#</th>
                      <th className="px-3 py-2 text-left font-medium">Vendor</th>
                      <th className="px-3 py-2 text-right font-medium">Ordered</th>
                      <th className="px-3 py-2 text-right font-medium">Received</th>
                      <th className="px-3 py-2 text-right font-medium">Remaining</th>
                      <th className="px-3 py-2 text-left font-medium">Expected</th>
                      <th className="px-3 py-2 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.purchase_orders.map((po, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-3 py-2 text-blue-600 dark:text-blue-400 font-mono font-medium">{po.po_number}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400 truncate max-w-[120px]" title={po.vendor || ""}>{po.vendor || "-"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">{po.ordered_qty.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">{po.received_qty.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400 font-semibold">{po.remaining_qty.toLocaleString()}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{po.expected_date ? fmtDate(po.expected_date) : "-"}</td>
                        <td className="px-3 py-2 text-center">
                          {(() => {
                            const lineStatus = po.received_qty >= po.ordered_qty ? "received"
                              : po.received_qty > 0 ? "partial"
                              : "pending";
                            return (
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                lineStatus === "received" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" :
                                lineStatus === "partial" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" :
                                "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                              }`}>
                                {lineStatus === "received" ? "Received" : lineStatus === "partial" ? "Partial" : "Pending"}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Forecast metrics */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden" data-tour="detail-forecast">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-slate-400" />
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Forecast</h4>
              </div>
              <div className="p-4 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <TrendingUp className="h-3.5 w-3.5" /> Velocity <InfoTip text="Average units sold per day over the selected time window" />
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">{data.velocity.toFixed(2)}/day</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 -mx-4 px-4 py-1.5">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                    <TrendingUp className="h-3.5 w-3.5" /> Adj. Velocity <InfoTip text="Velocity adjusted for seasonality — the forecasted daily demand" />
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{data.adjusted_velocity.toFixed(2)}/day</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Calendar className="h-3.5 w-3.5" /> Seasonality <InfoTip text="Demand multiplier vs last year. Above 1.0x = growing, below = declining" />
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">{data.seasonality_factor.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Clock className="h-3.5 w-3.5" /> Lead Time <InfoTip text="Days from placing an order to receiving inventory" />
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">{data.lead_time_days} days</span>
                </div>
                {data.item_cost > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <DollarSign className="h-3.5 w-3.5" /> Unit Cost <InfoTip text="Cost per unit from the supplier" />
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">${data.item_cost.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <DollarSign className="h-3.5 w-3.5" /> Revenue ({velocityWindow}d) <InfoTip text={`Total revenue generated in the last ${velocityWindow} days`} />
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{fmtCurrency(data.total_revenue_90d)}</span>
                  </div>
                  {data.margin_90d !== null && (
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <BarChart3 className="h-3.5 w-3.5" /> Margin ({velocityWindow}d) <InfoTip text={`Profit margin based on revenue minus cost of goods over ${velocityWindow} days`} />
                      </span>
                      <span className={`font-bold tabular-nums ${data.margin_90d >= 30 ? "text-green-600 dark:text-green-400" : data.margin_90d >= 15 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>{data.margin_90d.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Monthly sales bar chart */}
            {data.monthly_sales.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-slate-400" />
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Monthly Sales</h4>
                </div>
                <div className="p-4">
                  <div className="flex items-end gap-1.5" style={{ height: 100 }}>
                    {data.monthly_sales.map((m) => (
                      <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full">
                        <span className="text-[9px] tabular-nums text-slate-400 dark:text-slate-500 mb-1 font-medium">
                          {m.quantity > 0 ? m.quantity.toLocaleString() : ""}
                        </span>
                        <div
                          className="w-full bg-blue-500 dark:bg-blue-600 rounded-t hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors cursor-default"
                          style={{ height: `${(m.quantity / maxQty) * 100}%`, minHeight: m.quantity > 0 ? 4 : 0 }}
                          title={`${fmtMonth(m.month)}: ${m.quantity.toLocaleString()} units, ${fmtCurrency(m.revenue)}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {data.monthly_sales.map((m) => (
                      <span key={m.month} className="flex-1 text-[9px] text-slate-400 dark:text-slate-500 text-center font-medium">{fmtMonth(m.month)}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Channel breakdown */}
            {data.channel_breakdown.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-slate-400" />
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Channel Breakdown</h4>
                </div>
                <div className="p-4 space-y-3">
                  {data.channel_breakdown.map((c, idx) => {
                    const pct = totalChannelQty > 0 ? (c.quantity / totalChannelQty) * 100 : 0;
                    const barColor = CHANNEL_COLORS[idx % CHANNEL_COLORS.length];
                    return (
                      <div key={c.channel}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{c.channel === "FI" ? "FlooringInc" : c.channel}</span>
                          <span className="text-slate-500 dark:text-slate-400 tabular-nums text-xs font-medium">
                            {c.quantity.toLocaleString()} &middot; {fmtCurrency(c.revenue)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                            <div
                              className={`${barColor} h-2 rounded-full transition-all`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500 w-8 text-right font-medium">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent orders */}
            {data.recent_orders.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-slate-400" />
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Recent Orders</h4>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-left font-medium">Channel</th>
                      <th className="px-3 py-2 text-right font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_orders.map((o, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{fmtDate(o.date)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-700 dark:text-slate-300">{o.quantity}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{o.channel ? shortChannel(o.channel) : "-"}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-700 dark:text-slate-300">{fmtCurrency(o.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
