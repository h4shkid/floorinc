import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Building2, Package, DollarSign, AlertTriangle, Clock } from "lucide-react";
import { fetchPurchaseOrders, fetchVendorSummary } from "../../api/client";
import type { POListItem, VendorSummary } from "../../types";
import { VendorScorecardPanel } from "./VendorScorecardPanel";

function fmtCurrency(val: number): string {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// --- Stat Cards ---
function StatCards({ vendors, pos }: { vendors: VendorSummary[]; pos: POListItem[] }) {
  const totalVendors = vendors.length;
  const totalOnOrder = vendors.reduce((s, v) => s + v.total_amount, 0);
  const totalRemaining = vendors.reduce((s, v) => s + v.total_remaining_qty, 0);

  const today = new Date().toISOString().slice(0, 10);
  let latePOs = 0;
  for (const po of pos) {
    if (po.earliest_expected && po.earliest_expected < today && po.total_remaining_qty > 0) latePOs++;
  }

  const cards = [
    { label: "Active Vendors", value: totalVendors.toLocaleString(), textColor: "text-blue-600 dark:text-blue-400", borderColor: "border-l-blue-500", bgColor: "bg-blue-50/50 dark:bg-blue-950/10", iconBg: "bg-blue-100 dark:bg-blue-900/30", Icon: Building2 },
    { label: "Total On Order", value: fmtCurrency(totalOnOrder), textColor: "text-green-600 dark:text-green-400", borderColor: "border-l-green-500", bgColor: "bg-green-50/50 dark:bg-green-950/10", iconBg: "bg-green-100 dark:bg-green-900/30", Icon: DollarSign },
    { label: "Remaining Units", value: totalRemaining.toLocaleString(), textColor: "text-amber-600 dark:text-amber-400", borderColor: "border-l-amber-500", bgColor: "bg-amber-50/50 dark:bg-amber-950/10", iconBg: "bg-amber-100 dark:bg-amber-900/30", Icon: Package },
    { label: "Late POs", value: latePOs.toLocaleString(), textColor: latePOs > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400", borderColor: latePOs > 0 ? "border-l-red-500" : "border-l-green-500", bgColor: latePOs > 0 ? "bg-red-50/50 dark:bg-red-950/10" : "bg-green-50/50 dark:bg-green-950/10", iconBg: latePOs > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30", Icon: AlertTriangle },
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

// --- Vendor Concentration ---
const CONCENTRATION_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500",
];

function VendorConcentration({ vendors, onVendorClick }: { vendors: VendorSummary[]; onVendorClick: (v: string) => void }) {
  const totalAmount = vendors.reduce((s, v) => s + v.total_amount, 0);
  if (totalAmount === 0 || vendors.length === 0) return null;

  const sorted = [...vendors].sort((a, b) => b.total_amount - a.total_amount);
  const top = sorted.slice(0, 6);
  const otherAmount = sorted.slice(6).reduce((s, v) => s + v.total_amount, 0);

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
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Spend Distribution</h3>

      {highConcentration && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 font-medium">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {segments[0].vendor} accounts for {segments[0].pct.toFixed(0)}% of open PO spend — consider diversifying
        </div>
      )}

      {/* Stacked bar */}
      <div className="flex rounded-lg overflow-hidden h-8">
        {segments.map((s) => (
          <div
            key={s.vendor}
            className={`${s.color} transition-all hover:opacity-80 ${s.vendor !== "Other" ? "cursor-pointer" : "cursor-default"}`}
            style={{ width: `${s.pct}%`, minWidth: s.pct > 0 ? 2 : 0 }}
            title={`${s.vendor}: ${fmtCurrency(s.amount)} (${s.pct.toFixed(1)}%)`}
            onClick={() => s.vendor !== "Other" && onVendorClick(s.vendor)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
        {segments.map((s) => (
          <button
            key={s.vendor}
            onClick={() => s.vendor !== "Other" && onVendorClick(s.vendor)}
            className={`flex items-center gap-1.5 text-xs ${s.vendor !== "Other" ? "hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer" : "cursor-default"} text-slate-600 dark:text-slate-400`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${s.color} shrink-0`} />
            <span className="font-medium">{s.vendor}</span>
            <span className="tabular-nums text-slate-400 dark:text-slate-500">{s.pct.toFixed(0)}%</span>
            <span className="tabular-nums text-slate-400 dark:text-slate-500">({fmtCurrency(s.amount)})</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Vendor Comparison Table ---
type SortDir = "asc" | "desc";
type VendorCompKey = "vendor" | "open_pos" | "total_amount" | "remaining" | "late" | "lead_time" | "nearest";

function VendorComparisonTable({ vendors, pos, onVendorClick }: { vendors: VendorSummary[]; pos: POListItem[]; onVendorClick: (v: string) => void }) {
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
      return {
        vendor: v.vendor,
        open_pos: v.total_pos,
        total_amount: v.total_amount,
        remaining: v.total_remaining_qty,
        late: latePOs,
        lead_time: avgLeadTime,
        nearest: v.nearest_expected,
      };
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
        case "nearest": cmp = (a.nearest || "9999").localeCompare(b.nearest || "9999"); break;
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
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <CompHeader label="Vendor" sortKey="vendor" />
            <CompHeader label="Open POs" sortKey="open_pos" align="right" className="w-24" />
            <CompHeader label="On Order" sortKey="total_amount" align="right" className="w-28" />
            <CompHeader label="Remaining" sortKey="remaining" align="right" className="w-28" />
            <CompHeader label="Late POs" sortKey="late" align="right" className="w-24" />
            <CompHeader label="Avg Lead" sortKey="lead_time" align="right" className="w-24" />
            <CompHeader label="Next Delivery" sortKey="nearest" className="w-28" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.vendor}
              onClick={() => onVendorClick(r.vendor)}
              className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
            >
              <td className="px-3 py-2.5">
                <span className="text-blue-600 dark:text-blue-400 font-medium">{r.vendor}</span>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">{r.open_pos}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300 font-medium">{fmtCurrency(r.total_amount)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">{r.remaining.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {r.late > 0 ? (
                  <span className="text-red-600 dark:text-red-400 font-semibold">{r.late}</span>
                ) : (
                  <span className="text-green-600 dark:text-green-400">0</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                {r.lead_time !== null ? (
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{r.lead_time}d</span>
                ) : "-"}
              </td>
              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 text-xs">
                {r.nearest ? new Date(r.nearest + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Main Page ---
export function VendorsPage({ onNavigateToPO }: { onNavigateToPO?: (poNumber: string) => void }) {
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [pos, setPOs] = useState<POListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchVendorSummary(),
      fetchPurchaseOrders("", ""),
    ]).then(([vendorData, poData]) => {
      setVendors(vendorData);
      setPOs(poData.filter((p) => p.total_amount > 0));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12 text-slate-500 dark:text-slate-400">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 mb-3" />
        <div>Loading vendor data...</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Vendors</h2>

      <StatCards vendors={vendors} pos={pos} />

      <VendorConcentration vendors={vendors} onVendorClick={setSelectedVendor} />

      <VendorComparisonTable vendors={vendors} pos={pos} onVendorClick={setSelectedVendor} />

      {selectedVendor && (
        <VendorScorecardPanel
          vendor={selectedVendor}
          onClose={() => setSelectedVendor(null)}
          onNavigateToPO={onNavigateToPO ? (poNumber) => {
            setSelectedVendor(null);
            onNavigateToPO(poNumber);
          } : undefined}
        />
      )}
    </div>
  );
}
