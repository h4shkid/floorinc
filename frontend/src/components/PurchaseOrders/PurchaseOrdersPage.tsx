import { useState, useEffect, useCallback, useMemo, Fragment, type ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight, FileText, Package, DollarSign, Building2 } from "lucide-react";
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

function lineStatusBadge(ordered: number, received: number): { label: string; cls: string } {
  if (received >= ordered) return { label: "Received", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" };
  if (received > 0) return { label: "Partial", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" };
  return { label: "Pending", cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" };
}

function poStatusBadge(po: { earliest_expected: string | null; total_ordered_qty: number; total_received_qty: number }): { label: string; cls: string } {
  if (po.total_received_qty >= po.total_ordered_qty) return { label: "Received", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" };
  const today = new Date().toISOString().slice(0, 10);
  if (po.earliest_expected && po.earliest_expected < today) return { label: "Late", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" };
  if (po.total_received_qty > 0) return { label: "Partial", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" };
  return { label: "On Track", cls: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" };
}

type SortKey = "po_number" | "vendor" | "items" | "remaining" | "amount" | "expected" | "progress" | "status";
type SortDir = "asc" | "desc";

function SortHeader({ label, sortKey, current, dir, onSort, align = "left", className = "" }: {
  label: ReactNode; sortKey: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void; align?: "left" | "right"; className?: string;
}) {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`font-medium px-3 py-3 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 transition-colors ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && dir === "asc" ? (
          <ChevronUp className="w-3 h-3 text-blue-500" />
        ) : active && dir === "desc" ? (
          <ChevronDown className="w-3 h-3 text-blue-500" />
        ) : (
          <ChevronsUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600" />
        )}
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
      case "items": cmp = a.total_lines - b.total_lines; break;
      case "remaining": cmp = a.total_remaining_qty - b.total_remaining_qty; break;
      case "amount": cmp = a.total_amount - b.total_amount; break;
      case "expected": {
        const aVal = a.earliest_expected || "";
        const bVal = b.earliest_expected || "";
        if (!aVal && !bVal) cmp = 0;
        else if (!aVal) cmp = 1;
        else if (!bVal) cmp = -1;
        else cmp = aVal.localeCompare(bVal);
        break;
      }
      case "progress": {
        const pctA = a.total_ordered_qty > 0 ? a.total_received_qty / a.total_ordered_qty : 0;
        const pctB = b.total_ordered_qty > 0 ? b.total_received_qty / b.total_ordered_qty : 0;
        cmp = pctA - pctB;
        break;
      }
      case "status": {
        const order: Record<string, number> = { Late: 0, Partial: 1, "On Track": 2, Received: 3 };
        cmp = (order[poStatusBadge(a).label] ?? 4) - (order[poStatusBadge(b).label] ?? 4);
        break;
      }
    }
    // For "expected", nulls always sort last regardless of direction
    if (key === "expected" && ((!a.earliest_expected && b.earliest_expected) || (a.earliest_expected && !b.earliest_expected))) {
      return cmp;
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
    { label: "Open POs", value: totalPOs.toLocaleString(), textColor: "text-blue-600 dark:text-blue-400", borderColor: "border-l-blue-500", bgColor: "bg-blue-50/50 dark:bg-blue-950/10", iconBg: "bg-blue-100 dark:bg-blue-900/30", Icon: FileText },
    { label: "Remaining Units", value: totalRemaining.toLocaleString(), textColor: "text-amber-600 dark:text-amber-400", borderColor: "border-l-amber-500", bgColor: "bg-amber-50/50 dark:bg-amber-950/10", iconBg: "bg-amber-100 dark:bg-amber-900/30", Icon: Package },
    { label: "On Order", value: fmtCurrency(totalAmount), textColor: "text-green-600 dark:text-green-400", borderColor: "border-l-green-500", bgColor: "bg-green-50/50 dark:bg-green-950/10", iconBg: "bg-green-100 dark:bg-green-900/30", Icon: DollarSign },
    { label: "Vendors", value: totalVendors.toLocaleString(), textColor: "text-slate-700 dark:text-slate-300", borderColor: "border-l-slate-400 dark:border-l-slate-500", bgColor: "bg-white dark:bg-slate-800", iconBg: "bg-slate-100 dark:bg-slate-700", Icon: Building2 },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 ${c.borderColor} ${c.bgColor} p-4 hover-lift cursor-default`}>
          <div className="flex items-start justify-between">
            <div>
              <div className={`text-2xl font-bold tabular-nums ${c.textColor}`}>{c.value}</div>
              <div className="text-sm font-medium mt-1 text-slate-500 dark:text-slate-400">{c.label}</div>
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
    <div className="border-l-2 border-blue-400 bg-slate-50 dark:bg-slate-900/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            <th className="px-4 py-2 text-left font-medium w-36">SKU</th>
            <th className="px-3 py-2 text-left font-medium">Product</th>
            <th className="px-3 py-2 text-right font-medium w-40">Fulfillment</th>
            <th className="px-3 py-2 text-right font-medium w-24">Remaining</th>
            <th className="px-3 py-2 text-right font-medium w-20">Amount</th>
            <th className="px-3 py-2 text-left font-medium w-28">Expected</th>
            <th className="px-3 py-2 text-center font-medium w-20">Status</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const badge = lineStatusBadge(line.ordered_qty, line.received_qty);
            const pct = line.ordered_qty > 0 ? Math.round((line.received_qty / line.ordered_qty) * 100) : 0;
            return (
              <tr key={i} className="border-t border-slate-200/60 dark:border-slate-700/40">
                <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400 truncate" title={line.sku}>{line.sku}</td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-300 truncate max-w-0" title={line.display_name || ""}>{line.display_name || line.sku}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                      {line.received_qty.toLocaleString()} of {line.ordered_qty.toLocaleString()}
                    </span>
                    <div className="w-10 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : pct > 0 ? "bg-yellow-500" : "bg-slate-300 dark:bg-slate-600"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-800 dark:text-slate-200">{line.remaining_qty.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">{fmtCurrency(line.amount)}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 text-xs">{fmtDate(line.expected_date)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- Delivery Timeline (monthly) ---
interface MonthBucket { key: string; label: string; qty: number; amount: number; po_count: number }

function aggregateMonthly(timeline: TimelineWeek[]): MonthBucket[] {
  const map = new Map<string, MonthBucket>();
  for (const t of timeline) {
    const d = new Date(t.week + "T00:00:00");
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const existing = map.get(key);
    if (existing) {
      existing.qty += t.qty;
      existing.amount += t.amount;
      existing.po_count += t.po_count;
    } else {
      map.set(key, { key, label, qty: t.qty, amount: t.amount, po_count: t.po_count });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function DeliveryTimeline({ timeline }: { timeline: TimelineWeek[] }) {
  const months = useMemo(() => aggregateMonthly(timeline), [timeline]);
  if (months.length === 0) return null;
  const maxQty = Math.max(...months.map((m) => m.qty), 1);

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-6">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Delivery Timeline</h3>
      <div className="flex items-end gap-2" style={{ height: 90 }}>
        {months.map((m) => {
          const barPct = m.qty / maxQty;
          return (
            <div key={m.key} className="flex-1 flex flex-col items-center justify-end" style={{ height: "100%" }}>
              <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400 mb-0.5 font-medium">{m.qty.toLocaleString()}</span>
              <div
                className="w-full bg-blue-500 dark:bg-blue-600 rounded-t transition-all hover:bg-blue-400 dark:hover:bg-blue-500 cursor-default"
                style={{ height: `${barPct * 100}%`, minHeight: m.qty > 0 ? 4 : 0 }}
                title={`${m.label}\n${m.qty.toLocaleString()} units\n${fmtCurrency(m.amount)}\n${m.po_count} PO${m.po_count !== 1 ? "s" : ""}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-1.5">
        {months.map((m) => (
          <span key={m.key} className="flex-1 text-[10px] text-slate-400 dark:text-slate-500 text-center font-medium">{m.label}</span>
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
  const [showSamples, setShowSamples] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

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

  useEffect(() => { loadData(); setPage(1); }, [loadData]);

  const vendorNames = useMemo(() => vendors.map((v) => v.vendor).sort(), [vendors]);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir(key === "remaining" || key === "amount" || key === "items" ? "desc" : "asc");
      return key;
    });
    setPage(1);
  }, []);

  const regularPOs = useMemo(() => pos.filter((po) => po.total_amount > 0), [pos]);
  const samplePOs = useMemo(() => pos.filter((po) => po.total_amount === 0), [pos]);
  const sortedPOs = useMemo(() => sortPOs(regularPOs, sortKey, sortDir), [regularPOs, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sortedPOs.length / pageSize));
  const pagedPOs = useMemo(() => sortedPOs.slice((page - 1) * pageSize, page * pageSize), [sortedPOs, page]);
  const sortedSamples = useMemo(() => sortPOs(samplePOs, sortKey, sortDir), [samplePOs, sortKey, sortDir]);

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

      <StatCards pos={regularPOs} vendors={vendors} />

      {/* Timeline */}
      <DeliveryTimeline timeline={timeline} />

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
          {regularPOs.length} PO{regularPOs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* PO Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="w-10 px-2 py-3"></th>
              <SortHeader label="PO #" sortKey="po_number" current={sortKey} dir={sortDir} onSort={toggleSort} className="w-28" />
              <SortHeader label="Vendor" sortKey="vendor" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Items" sortKey="items" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" className="w-16" />
              <SortHeader label="Remaining" sortKey="remaining" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" className="w-24" />
              <SortHeader label="Amount" sortKey="amount" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" className="w-24" />
              <SortHeader label="Expected" sortKey="expected" current={sortKey} dir={sortDir} onSort={toggleSort} className="w-28" />
              <SortHeader label="Progress" sortKey="progress" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" className="w-28" />
              <SortHeader label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={toggleSort} className="w-24" />
            </tr>
          </thead>
          <tbody>
            {pagedPOs.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No open purchase orders found</td></tr>
            )}
            {pagedPOs.map((po) => {
              const isOpen = expanded === po.po_number;
              const pct = po.total_ordered_qty > 0
                ? Math.round((po.total_received_qty / po.total_ordered_qty) * 100)
                : 0;
              const status = poStatusBadge(po);
              return (
                <Fragment key={po.po_number}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : po.po_number)}
                    className={`cursor-pointer border-t border-slate-100 dark:border-slate-700/50 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 ${isOpen ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                  >
                    <td className="px-2 py-2.5 text-center text-slate-400">
                      <ChevronRight className={`w-3.5 h-3.5 inline-block transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{po.po_number}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 truncate" title={po.vendor || ""}>{po.vendor || "-"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{po.total_lines}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">{po.total_remaining_qty.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">{fmtCurrency(po.total_amount)}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 text-xs">
                      {po.earliest_expected ? fmtDate(po.earliest_expected) : "-"}
                      {po.latest_expected && po.latest_expected !== po.earliest_expected && (
                        <span className="text-slate-400 dark:text-slate-500 block text-[10px]">to {fmtDate(po.latest_expected)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
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
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${status.cls}`}>{status.label}</span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={9} className="p-0">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mb-6 -mt-4">
          <span className="text-sm text-slate-400 dark:text-slate-500">
            {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, sortedPOs.length)} of {sortedPOs.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="px-2 py-1 text-xs text-slate-600 dark:text-slate-300 font-medium">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Sample POs */}
      {samplePOs.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowSamples((v) => !v)}
            className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mb-2"
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showSamples ? "rotate-90" : ""}`} />
            <span>Sample Orders ({samplePOs.length})</span>
          </button>
          {showSamples && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="w-10 px-2 py-3"></th>
                    <th className="px-3 py-3 text-left font-medium w-28">PO #</th>
                    <th className="px-3 py-3 text-left font-medium">Vendor</th>
                    <th className="px-3 py-3 text-right font-medium w-16">Items</th>
                    <th className="px-3 py-3 text-right font-medium w-24">Remaining</th>
                    <th className="px-3 py-3 text-left font-medium w-28">Expected</th>
                    <th className="px-3 py-3 text-right font-medium w-28">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSamples.map((po) => {
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
                          <td className="px-2 py-2.5 text-center text-slate-400">
                            <svg className={`w-3.5 h-3.5 inline-block transition-transform ${isOpen ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                            </svg>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{po.po_number}</span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 truncate" title={po.vendor || ""}>{po.vendor || "-"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{po.total_lines}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">{po.total_remaining_qty.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 text-xs">
                            {po.earliest_expected ? fmtDate(po.earliest_expected) : "-"}
                          </td>
                          <td className="px-3 py-2.5">
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
                            <td colSpan={7} className="p-0">
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
          )}
        </div>
      )}

    </div>
  );
}
