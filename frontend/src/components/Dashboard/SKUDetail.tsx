import { useEffect, useState, useRef } from "react";
import type { SKUDetail } from "../../types";
import { fetchSKUDetail } from "../../api/client";
import { UrgencyBadge } from "./UrgencyBadge";

interface Props {
  sku: string;
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

export function SKUDetailPanel({ sku, onClose }: Props) {
  const [data, setData] = useState<SKUDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchSKUDetail(sku)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sku]);

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const maxQty = data ? Math.max(...data.monthly_sales.map((m) => m.quantity), 1) : 1;
  const totalChannelQty = data ? data.channel_breakdown.reduce((sum, c) => sum + c.quantity, 0) : 1;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 bg-black/20 flex justify-end"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 shadow-2xl h-full overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">SKU Detail</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-blue-500" />
          </div>
        )}

        {error && (
          <div className="mx-5 mt-5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {data && (
          <div className="px-5 py-5 space-y-6">
            {/* Product info */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-tight">{data.display_name}</h3>
              <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-1">{data.sku}</p>
              {data.product_category && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{data.product_category}</p>
              )}
              {data.manufacturer && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{data.manufacturer}</p>
              )}
            </div>

            {/* Status cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-center">
                <UrgencyBadge urgency={data.urgency} />
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-center">
                <div className={`text-lg font-bold tabular-nums ${data.on_hand < 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100"}`}>
                  {data.on_hand.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">on hand</div>
                {data.incoming_qty > 0 && (
                  <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">+{data.incoming_qty.toLocaleString()} incoming</div>
                )}
                {data.qty_committed > 0 && (
                  <div className="text-[11px] text-orange-600 dark:text-orange-400 mt-0.5">{data.qty_committed.toLocaleString()} committed</div>
                )}
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-center">
                <div className={`text-lg font-bold tabular-nums ${
                  data.days_remaining !== null && data.days_remaining <= data.lead_time_days
                    ? "text-red-600 dark:text-red-400"
                    : data.days_remaining !== null && data.days_remaining <= data.lead_time_days * 1.5
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-900 dark:text-slate-100"
                }`}>
                  {data.days_remaining !== null ? `${data.days_remaining.toFixed(0)}d` : "-"}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">remaining</div>
              </div>
            </div>

            {/* AI Insight */}
            {data.ai_insight && (
              <div className="rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-indigo-600 dark:text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM4 11a1 1 0 100-2H3a1 1 0 000 2h1zM10 18a1 1 0 001-1v-1a1 1 0 10-2 0v1a1 1 0 001 1z" />
                      <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" clipRule="evenodd" />
                    </svg>
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
              <div>
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Incoming Purchase Orders</h4>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <th className="px-3 py-1.5 text-left font-medium">PO#</th>
                        <th className="px-3 py-1.5 text-left font-medium">Vendor</th>
                        <th className="px-3 py-1.5 text-right font-medium">Remaining</th>
                        <th className="px-3 py-1.5 text-left font-medium">Expected</th>
                        <th className="px-3 py-1.5 text-center font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.purchase_orders.map((po, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 last:border-b-0">
                          <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-mono">{po.po_number}</td>
                          <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400 truncate max-w-[120px]" title={po.vendor || ""}>{po.vendor || "-"}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-blue-600 dark:text-blue-400 font-medium">{po.remaining_qty.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{po.expected_date ? fmtDate(po.expected_date) : "-"}</td>
                          <td className="px-3 py-1.5 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              po.status === "B" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" :
                              po.status === "D" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" :
                              po.status === "E" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" :
                              po.status === "F" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" :
                              "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                            }`}>
                              {po.status === "B" ? "Pending" : po.status === "D" ? "Partial" : po.status === "E" ? "Received" : po.status === "F" ? "Billed" : po.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Forecast metrics */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Forecast</h4>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Velocity</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">{data.velocity.toFixed(2)}/day</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Seasonality</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">{data.seasonality_factor.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Adj. Velocity</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{data.adjusted_velocity.toFixed(2)}/day</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Lead Time</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">{data.lead_time_days} days</span>
                </div>
                {data.item_cost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Unit Cost</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">${data.item_cost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-600 pt-1.5">
                  <span className="text-slate-600 dark:text-slate-400">Revenue (90d)</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{fmtCurrency(data.total_revenue_90d)}</span>
                </div>
                {data.margin_90d !== null && (
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Margin (90d)</span>
                    <span className={`font-semibold tabular-nums ${data.margin_90d >= 30 ? "text-green-600 dark:text-green-400" : data.margin_90d >= 15 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>{data.margin_90d.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>

            {/* Monthly sales bar chart */}
            {data.monthly_sales.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Monthly Sales</h4>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <div className="flex items-end gap-1" style={{ height: 96 }}>
                    {data.monthly_sales.map((m) => (
                      <div
                        key={m.month}
                        className="flex-1 bg-blue-500 rounded-t transition-all"
                        style={{ height: `${(m.quantity / maxQty) * 100}%`, minHeight: m.quantity > 0 ? 4 : 0 }}
                        title={`${fmtMonth(m.month)}: ${m.quantity.toLocaleString()} units, ${fmtCurrency(m.revenue)}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {data.monthly_sales.map((m) => (
                      <span key={m.month} className="flex-1 text-[9px] text-slate-400 dark:text-slate-500 text-center leading-tight">{fmtMonth(m.month)}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Channel breakdown */}
            {data.channel_breakdown.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Channel Breakdown</h4>
                <div className="space-y-2">
                  {data.channel_breakdown.map((c) => {
                    const pct = totalChannelQty > 0 ? (c.quantity / totalChannelQty) * 100 : 0;
                    return (
                      <div key={c.channel}>
                        <div className="flex items-center justify-between text-sm mb-0.5">
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{c.channel === "FI" ? "FlooringInc Website" : c.channel}</span>
                          <span className="text-slate-500 dark:text-slate-400 tabular-nums text-xs">
                            {c.quantity.toLocaleString()} units &middot; {fmtCurrency(c.revenue)}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{pct.toFixed(0)}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent orders */}
            {data.recent_orders.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Recent Orders</h4>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <th className="px-3 py-1.5 text-left font-medium">Date</th>
                        <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                        <th className="px-3 py-1.5 text-left font-medium">Channel</th>
                        <th className="px-3 py-1.5 text-right font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent_orders.map((o, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 last:border-b-0">
                          <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{fmtDate(o.date)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-300">{o.quantity}</td>
                          <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{o.channel ? shortChannel(o.channel) : "-"}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-300">{fmtCurrency(o.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
