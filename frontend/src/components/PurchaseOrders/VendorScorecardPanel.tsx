import { useEffect, useState, useRef, useMemo } from "react";
import { X, FileText, Package, DollarSign, AlertTriangle, Clock, Building2, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import type { VendorScorecard } from "../../types";
import { fetchVendorScorecard } from "../../api/client";

function fmtCurrency(val: number): string {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(val: string | null): string {
  if (!val) return "-";
  try {
    return new Date(val + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return val;
  }
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(mo, 10) - 1]} '${y.slice(2)}`;
}

function poStatusBadge(po: { earliest_expected: string | null; total_ordered_qty: number; total_received_qty: number }): { label: string; cls: string } {
  if (po.total_received_qty >= po.total_ordered_qty) return { label: "Received", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" };
  const today = new Date().toISOString().slice(0, 10);
  if (po.earliest_expected && po.earliest_expected < today) return { label: "Late", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" };
  if (po.total_received_qty > 0) return { label: "Partial", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" };
  return { label: "On Track", cls: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" };
}

const RATING_CONFIG = {
  Good: { cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400", Icon: ShieldCheck },
  Average: { cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400", Icon: ShieldQuestion },
  Poor: { cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400", Icon: ShieldAlert },
} as const;

interface Props {
  vendor: string;
  onClose: () => void;
  onNavigateToPO?: (poNumber: string) => void;
}

export function VendorScorecardPanel({ vendor, onClose, onNavigateToPO }: Props) {
  const [data, setData] = useState<VendorScorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllSkus, setShowAllSkus] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchVendorScorecard(vendor)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [vendor]);

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

  const maxSpend = data ? Math.max(...data.monthly_spend.map((m) => m.amount), 1) : 1;
  const displaySkus = useMemo(() => {
    if (!data) return [];
    return showAllSkus ? data.skus : data.skus.slice(0, 20);
  }, [data, showAllSkus]);

  const ratingCfg = data ? RATING_CONFIG[data.rating as keyof typeof RATING_CONFIG] : null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 bg-black/30 flex justify-end"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-2xl bg-slate-50 dark:bg-slate-900 shadow-2xl h-full overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-5 py-4 flex items-center justify-between z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Vendor Scorecard</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && (
          <div className="px-5 py-5 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-3" />
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mx-5 mt-5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {data && (
          <div className="px-5 py-5 space-y-5">
            {/* Vendor name + rating */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{data.vendor}</h3>
                {ratingCfg && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${ratingCfg.cls}`}>
                    <ratingCfg.Icon className="h-3.5 w-3.5" />
                    {data.rating}
                  </span>
                )}
              </div>
              {data.avg_lead_time_days !== null && (
                <div className="flex items-center gap-2 mt-2 text-sm text-slate-500 dark:text-slate-400">
                  <Clock className="h-3.5 w-3.5" />
                  Avg lead time: <span className="font-semibold text-slate-700 dark:text-slate-300">{data.avg_lead_time_days} days</span>
                </div>
              )}
            </div>

            {/* Stat cards — 2x2 */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Open POs" value={data.open_pos.toLocaleString()} color="blue" Icon={FileText} />
              <StatCard label="Remaining Units" value={data.remaining_units.toLocaleString()} color="amber" Icon={Package} />
              <StatCard label="On Order" value={fmtCurrency(data.total_on_order)} color="green" Icon={DollarSign} />
              <StatCard label="Late POs" value={data.late_pos.toLocaleString()} color={data.late_pos > 0 ? "red" : "green"} Icon={AlertTriangle} />
            </div>

            {/* On-time performance */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" /> On-Time Performance
              </h4>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${data.late_percentage <= 10 ? "bg-green-500" : data.late_percentage <= 30 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100 - data.late_percentage, 100)}%` }}
                    />
                  </div>
                </div>
                <span className={`text-lg font-bold tabular-nums ${data.late_percentage <= 10 ? "text-green-600 dark:text-green-400" : data.late_percentage <= 30 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                  {(100 - data.late_percentage).toFixed(0)}%
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {data.late_pos} of {data.total_open_pos_with_date} POs with expected dates are past due
              </div>
            </div>

            {/* Monthly spend */}
            {data.monthly_spend.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5" /> Monthly PO Spend
                  </h4>
                </div>
                <div className="px-4 pb-4">
                  <div className="flex items-end gap-1.5" style={{ height: 100 }}>
                    {data.monthly_spend.map((m) => {
                      const barPct = m.amount / maxSpend;
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center justify-end" style={{ height: "100%" }}>
                          <span className="text-[9px] tabular-nums text-slate-400 dark:text-slate-500 mb-0.5 font-medium truncate w-full text-center">
                            {fmtCurrency(m.amount)}
                          </span>
                          <div
                            className="w-full bg-blue-500 dark:bg-blue-600 rounded-t transition-all hover:bg-blue-400 dark:hover:bg-blue-500 cursor-default"
                            style={{ height: `${barPct * 100}%`, minHeight: m.amount > 0 ? 4 : 0 }}
                            title={`${fmtMonth(m.month)}\n${fmtCurrency(m.amount)}\n${m.po_count} PO${m.po_count !== 1 ? "s" : ""}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-1.5 mt-1.5">
                    {data.monthly_spend.map((m) => (
                      <span key={m.month} className="flex-1 text-[9px] text-slate-400 dark:text-slate-500 text-center font-medium truncate">
                        {fmtMonth(m.month)}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 italic mt-2">Based on currently open POs only</p>
                </div>
              </div>
            )}

            {/* POs table */}
            {data.purchase_orders.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" /> Purchase Orders ({data.purchase_orders.length})
                  </h4>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-2 text-left font-medium">PO #</th>
                      <th className="px-3 py-2 text-right font-medium">Remaining</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                      <th className="px-3 py-2 text-left font-medium">Expected</th>
                      <th className="px-3 py-2 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.purchase_orders.map((po) => {
                      const status = poStatusBadge(po);
                      return (
                        <tr key={po.po_number} className={`border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${onNavigateToPO ? "cursor-pointer" : ""}`} onClick={() => onNavigateToPO?.(po.po_number)}>
                          <td className="px-4 py-2">
                            <span className={`font-mono text-xs font-semibold ${onNavigateToPO ? "text-blue-600 dark:text-blue-400 hover:underline" : "text-blue-600 dark:text-blue-400"}`}>{po.po_number}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">{po.total_remaining_qty.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{fmtCurrency(po.total_amount)}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400 text-xs">{fmtDate(po.earliest_expected)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${status.cls}`}>{status.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* SKUs table */}
            {data.skus.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
                    <Package className="h-3.5 w-3.5" /> SKUs on Order ({data.skus.length})
                  </h4>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-2 text-left font-medium">SKU</th>
                      <th className="px-3 py-2 text-left font-medium">Product</th>
                      <th className="px-3 py-2 text-right font-medium">Remaining</th>
                      <th className="px-3 py-2 text-right font-medium">POs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displaySkus.map((s) => (
                      <tr key={s.sku} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400 truncate max-w-[120px]" title={s.sku}>{s.sku}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300 truncate max-w-0" title={s.display_name || ""}>{s.display_name || s.sku}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">{s.remaining_qty.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{s.po_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.skus.length > 20 && !showAllSkus && (
                  <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700/50">
                    <button
                      onClick={() => setShowAllSkus(true)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      Show all {data.skus.length} SKUs
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, Icon }: { label: string; value: string; color: string; Icon: React.ComponentType<{ className?: string }> }) {
  const colors: Record<string, { border: string; bg: string; text: string; iconBg: string }> = {
    blue: { border: "border-l-blue-500", bg: "bg-blue-50/50 dark:bg-blue-950/10", text: "text-blue-600 dark:text-blue-400", iconBg: "bg-blue-100 dark:bg-blue-900/30" },
    amber: { border: "border-l-amber-500", bg: "bg-amber-50/50 dark:bg-amber-950/10", text: "text-amber-600 dark:text-amber-400", iconBg: "bg-amber-100 dark:bg-amber-900/30" },
    green: { border: "border-l-green-500", bg: "bg-green-50/50 dark:bg-green-950/10", text: "text-green-600 dark:text-green-400", iconBg: "bg-green-100 dark:bg-green-900/30" },
    red: { border: "border-l-red-500", bg: "bg-red-50/50 dark:bg-red-950/10", text: "text-red-600 dark:text-red-400", iconBg: "bg-red-100 dark:bg-red-900/30" },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 ${c.border} ${c.bg} p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-2xl font-bold tabular-nums ${c.text}`}>{value}</div>
          <div className="text-xs font-medium mt-1 text-slate-500 dark:text-slate-400">{label}</div>
        </div>
        <div className={`p-2 rounded-lg ${c.iconBg}`}>
          <Icon className={`h-4 w-4 ${c.text}`} />
        </div>
      </div>
    </div>
  );
}
