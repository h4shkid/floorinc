import { useState, useEffect, useCallback, useMemo, Fragment, type ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight, FileText, Package, DollarSign, Building2, AlertTriangle } from "lucide-react";
import { fetchPurchaseOrders, fetchPOLines, fetchVendorSummary, fetchPOTimeline } from "../../api/client";
import type { POListItem, POLineItem, VendorSummary, TimelineWeek } from "../../types";
import { VendorScorecardPanel } from "./VendorScorecardPanel";

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
type LineSortKey = "sku" | "product" | "fulfillment" | "remaining" | "amount" | "expected" | "status";

function sortLines(lines: POLineItem[], key: LineSortKey, dir: SortDir): POLineItem[] {
  return [...lines].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "sku": cmp = a.sku.localeCompare(b.sku); break;
      case "product": cmp = (a.display_name || a.sku).localeCompare(b.display_name || b.sku); break;
      case "fulfillment": {
        const pctA = a.ordered_qty > 0 ? a.received_qty / a.ordered_qty : 0;
        const pctB = b.ordered_qty > 0 ? b.received_qty / b.ordered_qty : 0;
        cmp = pctA - pctB;
        break;
      }
      case "remaining": cmp = a.remaining_qty - b.remaining_qty; break;
      case "amount": cmp = a.amount - b.amount; break;
      case "expected": {
        const aVal = a.expected_date || "";
        const bVal = b.expected_date || "";
        if (!aVal && !bVal) cmp = 0;
        else if (!aVal) cmp = 1;
        else if (!bVal) cmp = -1;
        else cmp = aVal.localeCompare(bVal);
        break;
      }
      case "status": {
        const order: Record<string, number> = { Pending: 0, Partial: 1, Received: 2 };
        cmp = (order[lineStatusBadge(a.ordered_qty, a.received_qty).label] ?? 3) - (order[lineStatusBadge(b.ordered_qty, b.received_qty).label] ?? 3);
        break;
      }
    }
    if (key === "expected" && ((!a.expected_date && b.expected_date) || (a.expected_date && !b.expected_date))) return cmp;
    return dir === "asc" ? cmp : -cmp;
  });
}

function LineSortHeader({ label, sortKey, current, dir, onSort, align = "left", className = "" }: {
  label: ReactNode; sortKey: LineSortKey; current: LineSortKey; dir: SortDir; onSort: (k: LineSortKey) => void; align?: "left" | "right" | "center"; className?: string;
}) {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`font-medium px-3 py-2 cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300 transition-colors ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}>
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

function PODetail({ poNumber }: { poNumber: string }) {
  const [lines, setLines] = useState<POLineItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [lineSortKey, setLineSortKey] = useState<LineSortKey>("remaining");
  const [lineSortDir, setLineSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    setLoading(true);
    fetchPOLines(poNumber).then(setLines).catch(() => setLines([])).finally(() => setLoading(false));
  }, [poNumber]);

  const toggleLineSort = useCallback((key: LineSortKey) => {
    setLineSortKey((prev) => {
      if (prev === key) {
        setLineSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setLineSortDir(key === "remaining" || key === "amount" || key === "fulfillment" ? "desc" : "asc");
      return key;
    });
  }, []);

  const sorted = useMemo(() => lines ? sortLines(lines, lineSortKey, lineSortDir) : [], [lines, lineSortKey, lineSortDir]);

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
            <LineSortHeader label="SKU" sortKey="sku" current={lineSortKey} dir={lineSortDir} onSort={toggleLineSort} className="w-36 !px-4" />
            <LineSortHeader label="Product" sortKey="product" current={lineSortKey} dir={lineSortDir} onSort={toggleLineSort} />
            <LineSortHeader label="Fulfillment" sortKey="fulfillment" current={lineSortKey} dir={lineSortDir} onSort={toggleLineSort} align="right" className="w-40" />
            <LineSortHeader label="Remaining" sortKey="remaining" current={lineSortKey} dir={lineSortDir} onSort={toggleLineSort} align="right" className="w-24" />
            <LineSortHeader label="Amount" sortKey="amount" current={lineSortKey} dir={lineSortDir} onSort={toggleLineSort} align="right" className="w-20" />
            <LineSortHeader label="Expected" sortKey="expected" current={lineSortKey} dir={lineSortDir} onSort={toggleLineSort} className="w-28" />
            <LineSortHeader label="Status" sortKey="status" current={lineSortKey} dir={lineSortDir} onSort={toggleLineSort} align="center" className="w-20" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((line, i) => {
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

// --- Vendor Concentration ---
const CONCENTRATION_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500",
];

function VendorConcentration({ vendors, onVendorClick }: { vendors: VendorSummary[]; onVendorClick: (v: string) => void }) {
  const totalAmount = vendors.reduce((s, v) => s + v.total_amount, 0);
  if (totalAmount === 0 || vendors.length === 0) return null;

  // Top 5 + "Other"
  const sorted = [...vendors].sort((a, b) => b.total_amount - a.total_amount);
  const top = sorted.slice(0, 5);
  const otherAmount = sorted.slice(5).reduce((s, v) => s + v.total_amount, 0);

  const segments = top.map((v, i) => ({
    vendor: v.vendor,
    amount: v.total_amount,
    pct: (v.total_amount / totalAmount) * 100,
    color: CONCENTRATION_COLORS[i],
  }));
  if (otherAmount > 0) {
    segments.push({ vendor: "Other", amount: otherAmount, pct: (otherAmount / totalAmount) * 100, color: "bg-slate-400 dark:bg-slate-500" });
  }

  const highConcentration = segments.length > 0 && segments[0].pct > 50;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-6">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Vendor Concentration</h3>

      {highConcentration && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 font-medium">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {segments[0].vendor} accounts for {segments[0].pct.toFixed(0)}% of open PO spend
        </div>
      )}

      {/* Stacked bar */}
      <div className="flex rounded-lg overflow-hidden h-6">
        {segments.map((s) => (
          <div
            key={s.vendor}
            className={`${s.color} transition-all hover:opacity-80 cursor-pointer`}
            style={{ width: `${s.pct}%`, minWidth: s.pct > 0 ? 2 : 0 }}
            title={`${s.vendor}: ${fmtCurrency(s.amount)} (${s.pct.toFixed(1)}%)`}
            onClick={() => s.vendor !== "Other" && onVendorClick(s.vendor)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {segments.map((s) => (
          <button
            key={s.vendor}
            onClick={() => s.vendor !== "Other" && onVendorClick(s.vendor)}
            className={`flex items-center gap-1.5 text-xs ${s.vendor !== "Other" ? "hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer" : "cursor-default"} text-slate-600 dark:text-slate-400`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${s.color} shrink-0`} />
            <span className="font-medium">{s.vendor}</span>
            <span className="tabular-nums text-slate-400 dark:text-slate-500">{s.pct.toFixed(0)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Vendor Comparison Table ---
type VendorCompKey = "vendor" | "open_pos" | "total_amount" | "remaining" | "late" | "lead_time";

function VendorComparison({ vendors, pos, onVendorClick }: { vendors: VendorSummary[]; pos: POListItem[]; onVendorClick: (v: string) => void }) {
  const [compSortKey, setCompSortKey] = useState<VendorCompKey>("total_amount");
  const [compSortDir, setCompSortDir] = useState<SortDir>("desc");

  const toggleCompSort = useCallback((key: VendorCompKey) => {
    setCompSortKey((prev) => {
      if (prev === key) {
        setCompSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setCompSortDir(key === "vendor" ? "asc" : "desc");
      return key;
    });
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const rows = useMemo(() => {
    // Compute late POs and avg lead time per vendor from pos data
    const vendorPOs = new Map<string, POListItem[]>();
    for (const po of pos) {
      if (!po.vendor) continue;
      const arr = vendorPOs.get(po.vendor) || [];
      arr.push(po);
      vendorPOs.set(po.vendor, arr);
    }

    return vendors.map((v) => {
      const vPOs = vendorPOs.get(v.vendor) || [];
      let latePOs = 0;
      const leadTimes: number[] = [];
      for (const p of vPOs) {
        if (p.earliest_expected && p.earliest_expected < today && p.total_remaining_qty > 0) latePOs++;
        if (p.po_date && p.earliest_expected) {
          const days = (new Date(p.earliest_expected).getTime() - new Date(p.po_date).getTime()) / 86400000;
          if (days > 0) leadTimes.push(days);
        }
      }
      const avgLeadTime = leadTimes.length > 0 ? Math.round(leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length) : null;
      return { vendor: v.vendor, open_pos: v.total_pos, total_amount: v.total_amount, remaining: v.total_remaining_qty, late: latePOs, lead_time: avgLeadTime };
    });
  }, [vendors, pos, today]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      switch (compSortKey) {
        case "vendor": cmp = a.vendor.localeCompare(b.vendor); break;
        case "open_pos": cmp = a.open_pos - b.open_pos; break;
        case "total_amount": cmp = a.total_amount - b.total_amount; break;
        case "remaining": cmp = a.remaining - b.remaining; break;
        case "late": cmp = a.late - b.late; break;
        case "lead_time": cmp = (a.lead_time ?? 999) - (b.lead_time ?? 999); break;
      }
      return compSortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, compSortKey, compSortDir]);

  if (vendors.length === 0) return null;

  function CompHeader({ label, sortKey, align = "left", className = "" }: { label: string; sortKey: VendorCompKey; align?: "left" | "right"; className?: string }) {
    const active = compSortKey === sortKey;
    return (
      <th
        onClick={() => toggleCompSort(sortKey)}
        className={`font-medium px-3 py-3 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 transition-colors ${align === "right" ? "text-right" : "text-left"} ${className}`}
      >
        <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
          {label}
          {active && compSortDir === "asc" ? (
            <ChevronUp className="w-3 h-3 text-blue-500" />
          ) : active && compSortDir === "desc" ? (
            <ChevronDown className="w-3 h-3 text-blue-500" />
          ) : (
            <ChevronsUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600" />
          )}
        </span>
      </th>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mb-6">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5" /> Vendor Comparison
        </h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <CompHeader label="Vendor" sortKey="vendor" />
            <CompHeader label="Open POs" sortKey="open_pos" align="right" className="w-24" />
            <CompHeader label="On Order" sortKey="total_amount" align="right" className="w-28" />
            <CompHeader label="Remaining" sortKey="remaining" align="right" className="w-28" />
            <CompHeader label="Late POs" sortKey="late" align="right" className="w-24" />
            <CompHeader label="Avg Lead" sortKey="lead_time" align="right" className="w-24" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.vendor} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <td className="px-3 py-2.5">
                <button onClick={() => onVendorClick(r.vendor)} className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-left truncate">
                  {r.vendor}
                </button>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">{r.open_pos}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">{fmtCurrency(r.total_amount)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">{r.remaining.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {r.late > 0 ? (
                  <span className="text-red-600 dark:text-red-400 font-semibold">{r.late}</span>
                ) : (
                  <span className="text-green-600 dark:text-green-400">0</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                {r.lead_time !== null ? `${r.lead_time}d` : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Main Page ---
export function PurchaseOrdersPage({ initialExpandPO, onExpandPOConsumed }: { initialExpandPO?: string | null; onExpandPOConsumed?: () => void } = {}) {
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
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Handle navigation from Vendor scorecard → expand a specific PO
  useEffect(() => {
    if (initialExpandPO) {
      setExpanded(initialExpandPO);
      onExpandPOConsumed?.();
    }
  }, [initialExpandPO, onExpandPOConsumed]);

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

      {/* Vendor analytics */}
      <VendorConcentration vendors={vendors} onVendorClick={setSelectedVendor} />
      <VendorComparison vendors={vendors} pos={regularPOs} onVendorClick={setSelectedVendor} />

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
                    <td className="px-3 py-2.5 truncate" title={po.vendor || ""}>
                      {po.vendor ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedVendor(po.vendor!); }}
                          className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-left truncate"
                        >
                          {po.vendor}
                        </button>
                      ) : "-"}
                    </td>
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

      {selectedVendor && (
        <VendorScorecardPanel
          vendor={selectedVendor}
          onClose={() => setSelectedVendor(null)}
          onNavigateToPO={(poNumber) => {
            setSelectedVendor(null);
            setExpanded(poNumber);
          }}
        />
      )}
    </div>
  );
}
