import { useState, useEffect, useCallback, useMemo, Fragment, type ReactNode } from "react";
import { fetchPurchaseOrders, fetchPOLines, fetchVendorSummary, fetchPOTimeline } from "../../api/client";
import type { POListItem, POLineItem, VendorSummary, TimelineWeek } from "../../types";

function fmtCurrency(val: number): string {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(val: string | null): string {
  if (!val) return "-";
  try {
    return new Date(val + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

type SortKey = "po_number" | "vendor" | "remaining" | "amount" | "expected" | "progress";
type SortDir = "asc" | "desc";

function SortHeader({ label, sortKey, current, dir, onSort, align = "left" }: {
  label: ReactNode; sortKey: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void; align?: "left" | "right";
}) {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`font-medium px-2 py-3 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 transition-colors ${align === "right" ? "text-right" : "text-left"}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <svg className={`w-3 h-3 ${active ? "text-blue-500" : "text-slate-300 dark:text-slate-600"}`} viewBox="0 0 12 12" fill="currentColor">
          {active && dir === "asc" ? (
            <path d="M6 3l4 5H2z" />
          ) : active && dir === "desc" ? (
            <path d="M6 9l4-5H2z" />
          ) : (
            <>
              <path d="M6 2l3 3.5H3z" opacity="0.4" />
              <path d="M6 10l3-3.5H3z" opacity="0.4" />
            </>
          )}
        </svg>
      </span>
    </th>
  );
}

function sortPOs(pos: POListItem[], key: SortKey, dir: SortDir): POListItem[] {
  return [...pos].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "po_number": cmp = a.po_number.localeCompare(b.po_number); break;
      case "vendor": cmp = (a.vendor || "").localeCompare(b.vendor || ""); break;
      case "remaining": cmp = a.total_remaining_qty - b.total_remaining_qty; break;
      case "amount": cmp = a.total_amount - b.total_amount; break;
      case "expected": cmp = (a.earliest_expected || "9999").localeCompare(b.earliest_expected || "9999"); break;
      case "progress": {
        const pctA = a.total_ordered_qty > 0 ? a.total_received_qty / a.total_ordered_qty : 0;
        const pctB = b.total_ordered_qty > 0 ? b.total_received_qty / b.total_ordered_qty : 0;
        cmp = pctA - pctB;
        break;
      }
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// --- Top Stats ---
function StatCards({ pos, vendors }: { pos: POListItem[]; vendors: VendorSummary[] }) {
  const totalPOs = pos.length;
  const totalRemaining = pos.reduce((s, p) => s + p.total_remaining_qty, 0);
  const totalAmount = pos.reduce((s, p) => s + p.total_amount, 0);
  const totalVendors = vendors.length;

  const cards = [
    { label: "Open POs", value: totalPOs.toLocaleString(), color: "text-blue-600 dark:text-blue-400" },
    { label: "Remaining Units", value: totalRemaining.toLocaleString(), color: "text-amber-600 dark:text-amber-400" },
    { label: "On Order", value: fmtCurrency(totalAmount), color: "text-green-600 dark:text-green-400" },
    { label: "Vendors", value: totalVendors.toLocaleString(), color: "text-slate-700 dark:text-slate-300" },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
          <div className="text-sm font-medium mt-1 text-slate-500 dark:text-slate-400">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// --- Expanded PO Detail ---
function PODetail({ poNumber }: { poNumber: string }) {
  const [lines, setLines] = useState<POLineItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPOLines(poNumber).then(setLines).catch(() => setLines([])).finally(() => setLoading(false));
  }, [poNumber]);

  if (loading) {
    return <div className="px-6 py-4 text-sm text-slate-400 dark:text-slate-500">Loading...</div>;
  }

  if (!lines || lines.length === 0) {
    return <div className="px-6 py-4 text-sm text-slate-400 dark:text-slate-500">No line items</div>;
  }

  return (
    <div className="px-6 py-3 space-y-1">
      {lines.map((line, i) => {
        const badge = lineStatusBadge(line.ordered_qty, line.received_qty);
        const pct = line.ordered_qty > 0 ? Math.round((line.received_qty / line.ordered_qty) * 100) : 0;
        return (
          <div key={i} className="flex items-center gap-3 py-1.5 text-sm">
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 w-32 shrink-0 truncate" title={line.sku}>{line.sku}</span>
            <span className="text-slate-700 dark:text-slate-300 flex-1 truncate" title={line.display_name || ""}>{line.display_name || line.sku}</span>
            <div className="w-24 shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : pct > 0 ? "bg-yellow-500" : "bg-slate-300 dark:bg-slate-600"}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums w-7 text-right">{pct}%</span>
              </div>
            </div>
            <span className="tabular-nums text-xs text-slate-600 dark:text-slate-400 w-20 text-right shrink-0">
              {line.remaining_qty.toLocaleString()} left
            </span>
            <span className="tabular-nums text-xs text-slate-500 dark:text-slate-400 w-16 text-right shrink-0">{fmtCurrency(line.amount)}</span>
            <span className="text-xs text-slate-400 w-16 text-right shrink-0">{fmtDate(line.expected_date)}</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full w-14 text-center shrink-0 ${badge.cls}`}>{badge.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// --- Delivery Timeline ---
function DeliveryTimeline({ timeline }: { timeline: TimelineWeek[] }) {
  if (timeline.length === 0) return null;
  const maxQty = Math.max(...timeline.map((t) => t.qty), 1);

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Delivery Timeline</h3>
      <div className="flex items-end gap-1" style={{ height: 100 }}>
        {timeline.map((t) => (
          <div
            key={t.week}
            className="flex-1 bg-blue-500 dark:bg-blue-600 rounded-t transition-all hover:bg-blue-400 dark:hover:bg-blue-500 cursor-default"
            style={{ height: `${(t.qty / maxQty) * 100}%`, minHeight: t.qty > 0 ? 4 : 0 }}
            title={`Week of ${fmtWeek(t.week)}\n${t.qty.toLocaleString()} units\n${fmtCurrency(t.amount)}\n${t.po_count} PO${t.po_count !== 1 ? "s" : ""}`}
          />
        ))}
      </div>
      <div className="flex gap-1 mt-1.5">
        {timeline.map((t) => (
          <span key={t.week} className="flex-1 text-[9px] text-slate-400 dark:text-slate-500 text-center leading-tight">{fmtWeek(t.week)}</span>
        ))}
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
  const [vendorFilter, setVendorFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("expected");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchPurchaseOrders(searchDebounced, vendorFilter),
      fetchVendorSummary(),
      fetchPOTimeline(),
    ]).then(([poData, vendorData, timelineData]) => {
      setPOs(poData);
      setVendors(vendorData);
      setTimeline(timelineData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [searchDebounced, vendorFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const vendorNames = useMemo(() => vendors.map((v) => v.vendor).sort(), [vendors]);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir(key === "remaining" || key === "amount" ? "desc" : "asc");
      return key;
    });
  }, []);

  const sortedPOs = useMemo(() => sortPOs(pos, sortKey, sortDir), [pos, sortKey, sortDir]);

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

      <StatCards pos={pos} vendors={vendors} />

      {/* Filters row */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search PO#, vendor, or SKU..."
          className="w-72 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Vendors</option>
          {vendorNames.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <span className="text-sm text-slate-400 dark:text-slate-500 ml-auto">
          {pos.length} PO{pos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* PO Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="px-4 py-3 w-8"></th>
              <SortHeader label="PO #" sortKey="po_number" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Vendor" sortKey="vendor" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Remaining" sortKey="remaining" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
              <SortHeader label="Amount" sortKey="amount" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
              <SortHeader label="Expected" sortKey="expected" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Progress" sortKey="progress" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {sortedPOs.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No open purchase orders found</td></tr>
            )}
            {sortedPOs.map((po) => {
              const isOpen = expanded === po.po_number;
              const pct = po.total_ordered_qty > 0
                ? Math.round((po.total_received_qty / po.total_ordered_qty) * 100)
                : 0;
              return (
                <Fragment key={po.po_number}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : po.po_number)}
                    className={`cursor-pointer border-t border-slate-100 dark:border-slate-700/50 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 ${isOpen ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                  >
                    <td className="px-4 py-3 text-slate-400">
                      <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </td>
                    <td className="px-2 py-3">
                      <div className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{po.po_number}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">{fmtDate(po.po_date)} &middot; {po.total_lines} items</div>
                    </td>
                    <td className="px-2 py-3 text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={po.vendor || ""}>{po.vendor || "-"}</td>
                    <td className="px-2 py-3 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">{po.total_remaining_qty.toLocaleString()}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{fmtCurrency(po.total_amount)}</td>
                    <td className="px-2 py-3 text-slate-600 dark:text-slate-400">
                      {po.earliest_expected ? fmtDate(po.earliest_expected) : "-"}
                      {po.latest_expected && po.latest_expected !== po.earliest_expected && (
                        <span className="text-slate-400 dark:text-slate-500"> - {fmtDate(po.latest_expected)}</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-16 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : pct > 0 ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-slate-400 w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} className="p-0 bg-slate-50/80 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700/50">
                        <PODetail poNumber={po.po_number} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Timeline */}
      <DeliveryTimeline timeline={timeline} />
    </div>
  );
}
