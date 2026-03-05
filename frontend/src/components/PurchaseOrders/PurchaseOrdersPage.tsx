import { useState, useEffect, useCallback } from "react";
import { fetchPurchaseOrders, fetchPOLines, fetchVendorSummary, fetchPOTimeline } from "../../api/client";
import type { POListItem, POLineItem, VendorSummary, TimelineWeek } from "../../types";

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

function fmtWeek(val: string): string {
  try {
    return new Date(val + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return val;
  }
}

function lineStatusBadge(ordered: number, received: number): { label: string; cls: string } {
  if (received >= ordered) return { label: "Received", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" };
  if (received > 0) return { label: "Partial", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" };
  return { label: "Pending", cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" };
}

// --- Vendor Summary Cards ---
function VendorCards({ vendors }: { vendors: VendorSummary[] }) {
  if (vendors.length === 0) return null;
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Vendor Summary</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {vendors.map((v) => (
          <div key={v.vendor} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate" title={v.vendor}>{v.vendor}</div>
            <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Open POs</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{v.total_pos}</span>
              </div>
              <div className="flex justify-between">
                <span>Remaining</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{v.total_remaining_qty.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>On Order</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{fmtCurrency(v.total_amount)}</span>
              </div>
              {v.nearest_expected && (
                <div className="flex justify-between">
                  <span>Next ETA</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">{fmtDate(v.nearest_expected)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- PO Line Items Accordion ---
function POLineItems({ poNumber }: { poNumber: string }) {
  const [lines, setLines] = useState<POLineItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPOLines(poNumber).then(setLines).catch(() => setLines([])).finally(() => setLoading(false));
  }, [poNumber]);

  if (loading) {
    return (
      <tr><td colSpan={10} className="px-4 py-3 text-center text-sm text-slate-400">Loading line items...</td></tr>
    );
  }

  if (!lines || lines.length === 0) {
    return (
      <tr><td colSpan={10} className="px-4 py-3 text-center text-sm text-slate-400">No line items found</td></tr>
    );
  }

  return (
    <>
      <tr>
        <td colSpan={10} className="p-0">
          <div className="bg-slate-50 dark:bg-slate-800/50 border-y border-slate-100 dark:border-slate-700/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 dark:text-slate-500">
                  <th className="text-left font-medium px-4 py-2">SKU</th>
                  <th className="text-left font-medium px-2 py-2">Product</th>
                  <th className="text-right font-medium px-2 py-2">Ordered</th>
                  <th className="text-right font-medium px-2 py-2">Received</th>
                  <th className="text-right font-medium px-2 py-2">Remaining</th>
                  <th className="text-left font-medium px-2 py-2">Expected</th>
                  <th className="text-right font-medium px-2 py-2">Rate</th>
                  <th className="text-right font-medium px-2 py-2">Amount</th>
                  <th className="text-center font-medium px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => {
                  const badge = lineStatusBadge(line.ordered_qty, line.received_qty);
                  return (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-700/50">
                      <td className="px-4 py-1.5 font-mono text-xs text-slate-700 dark:text-slate-300">{line.sku}</td>
                      <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400 truncate max-w-[200px]" title={line.display_name || ""}>{line.display_name || line.sku}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-300">{line.ordered_qty.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-300">{line.received_qty.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">{line.remaining_qty.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400">{fmtDate(line.expected_date)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-400">{fmtCurrency(line.rate)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-300">{fmtCurrency(line.amount)}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.cls}`}>{badge.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    </>
  );
}

// --- PO List Table ---
function POTable({ pos, search, onSearchChange }: { pos: POListItem[]; search: string; onSearchChange: (v: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Open Purchase Orders</h3>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search PO#, vendor, or SKU..."
          className="w-72 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="text-left font-medium px-4 py-3">PO #</th>
                <th className="text-left font-medium px-2 py-3">Date</th>
                <th className="text-left font-medium px-2 py-3">Vendor</th>
                <th className="text-right font-medium px-2 py-3">Lines</th>
                <th className="text-right font-medium px-2 py-3">Ordered</th>
                <th className="text-right font-medium px-2 py-3">Received</th>
                <th className="text-right font-medium px-2 py-3">Remaining</th>
                <th className="text-right font-medium px-2 py-3">Amount</th>
                <th className="text-left font-medium px-2 py-3">Expected</th>
                <th className="text-center font-medium px-2 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {pos.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">No open purchase orders found</td></tr>
              )}
              {pos.map((po) => {
                const isOpen = expanded === po.po_number;
                return (
                  <>
                    <tr
                      key={po.po_number}
                      onClick={() => setExpanded(isOpen ? null : po.po_number)}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 ${isOpen ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
                        <span className="inline-block mr-1.5 text-slate-400 transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0)" }}>&rsaquo;</span>
                        {po.po_number}
                      </td>
                      <td className="px-2 py-2.5 text-slate-600 dark:text-slate-400">{fmtDate(po.po_date)}</td>
                      <td className="px-2 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[180px]" title={po.vendor || ""}>{po.vendor || "-"}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">{po.total_lines}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">{po.total_ordered_qty.toLocaleString()}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">{po.total_received_qty.toLocaleString()}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">{po.total_remaining_qty.toLocaleString()}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">{fmtCurrency(po.total_amount)}</td>
                      <td className="px-2 py-2.5 text-slate-600 dark:text-slate-400">
                        {po.earliest_expected ? fmtDate(po.earliest_expected) : "-"}
                        {po.latest_expected && po.latest_expected !== po.earliest_expected && (
                          <span className="text-slate-400 dark:text-slate-500"> - {fmtDate(po.latest_expected)}</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                          {po.status || "Open"}
                        </span>
                      </td>
                    </tr>
                    {isOpen && <POLineItems poNumber={po.po_number} />}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Delivery Timeline ---
function DeliveryTimeline({ timeline }: { timeline: TimelineWeek[] }) {
  if (timeline.length === 0) return null;
  const maxQty = Math.max(...timeline.map((t) => t.qty), 1);

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Delivery Timeline</h3>
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <div className="flex items-end gap-1" style={{ height: 140 }}>
          {timeline.map((t) => (
            <div
              key={t.week}
              className="flex-1 bg-blue-500 dark:bg-blue-600 rounded-t transition-all hover:bg-blue-600 dark:hover:bg-blue-500"
              style={{ height: `${(t.qty / maxQty) * 100}%`, minHeight: t.qty > 0 ? 4 : 0 }}
              title={`Week of ${fmtWeek(t.week)}: ${t.qty.toLocaleString()} units, ${fmtCurrency(t.amount)}, ${t.po_count} PO${t.po_count !== 1 ? "s" : ""}`}
            />
          ))}
        </div>
        <div className="flex gap-1 mt-2">
          {timeline.map((t) => (
            <span key={t.week} className="flex-1 text-[9px] text-slate-400 dark:text-slate-500 text-center leading-tight">{fmtWeek(t.week)}</span>
          ))}
        </div>
        <div className="flex gap-1 mt-0.5">
          {timeline.map((t) => (
            <span key={t.week} className="flex-1 text-[9px] text-slate-300 dark:text-slate-600 text-center tabular-nums">{t.qty > 0 ? t.qty.toLocaleString() : ""}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---
export function PurchaseOrdersPage() {
  const [pos, setPOs] = useState<POListItem[]>([]);
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [timeline, setTimeline] = useState<TimelineWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchPurchaseOrders(searchDebounced),
      fetchVendorSummary(),
      fetchPOTimeline(),
    ]).then(([poData, vendorData, timelineData]) => {
      setPOs(poData);
      setVendors(vendorData);
      setTimeline(timelineData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [searchDebounced]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading && pos.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 dark:text-slate-400">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 mb-3" />
        <div>Loading purchase orders...</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Purchase Orders</h2>
      <VendorCards vendors={vendors} />
      <POTable pos={pos} search={search} onSearchChange={setSearch} />
      <DeliveryTimeline timeline={timeline} />
    </div>
  );
}
