import { useState, useRef, useEffect } from "react";
import type { ForecastItem, DashboardTotals } from "../../types";
import { updateLeadTime, updateDropShip } from "../../api/client";
import { UrgencyBadge } from "./UrgencyBadge";

interface Props {
  items: ForecastItem[];
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (column: string) => void;
  onRowClick?: (sku: string) => void;
  onLeadTimeChanged?: () => void;
  totals?: DashboardTotals;
  velocityWindow?: number;
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

function shortChannel(ch: string | null): string {
  if (!ch) return "-";
  return CHANNEL_SHORT[ch] ?? ch.slice(0, 4);
}

function getColumns(window: number) {
  return [
    { key: "urgency", label: "", tooltip: "", align: "left" },
    { key: "display_name", label: "Product", tooltip: "Product name and SKU", align: "left" },
    { key: "manufacturer", label: "Manufacturer", tooltip: "Manufacturer — Preferred vendor/manufacturer for this product", align: "left" },
    { key: "top_channel", label: "Ch", tooltip: "Channel — Top sales channel for this SKU (FI = FlooringInc website, AVC = Amazon Vendor Central, ASC = Amazon Seller Central, HD = Home Depot, WF = Wayfair, WM = Walmart)", align: "center" },
    { key: "on_hand", label: "On Hand", tooltip: "On Hand — Current inventory units in Tennessee warehouse. Negative = backorder (orders received but no stock to fulfill)", align: "right" },
    { key: "velocity", label: "Vel/d", tooltip: `Velocity per Day — Average units sold per day over the last ${window} days`, align: "right" },
    { key: "seasonality_factor", label: "Szn", tooltip: "Seasonality Factor — Year-over-year demand multiplier. >1.0x = demand increasing vs last year, <1.0x = demand decreasing", align: "right" },
    { key: "adjusted_velocity", label: "Adj Vel", tooltip: "Adjusted Velocity — Velocity x Seasonality factor. This is the forecasted daily demand used for calculations", align: "right" },
    { key: "days_remaining", label: "Days Left", tooltip: "Days of Stock Remaining — On Hand / Adjusted Velocity. How many days until stockout at current sell rate", align: "right" },
    { key: "lead_time_days", label: "LT", tooltip: "Lead Time (days) — How many days it takes to receive new stock from the supplier after ordering", align: "right" },
    { key: "total_sold_90d", label: `Sold ${window}d`, tooltip: `Total units sold in the last ${window} days`, align: "right" },
    { key: "total_revenue_90d", label: `Rev ${window}d`, tooltip: `Total revenue ($) in the last ${window} days`, align: "right" },
  ] as const;
}

function LeadTimeCell({ sku, value, onSaved }: { sku: string; value: number; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(String(value));
    setEditing(true);
  }

  async function save() {
    const num = parseInt(draft, 10);
    if (isNaN(num) || num < 1 || num === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateLeadTime(sku, num);
      onSaved();
    } catch { /* ignore */ }
    setSaving(false);
    setEditing(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={handleKey}
        onClick={(e) => e.stopPropagation()}
        disabled={saving}
        className="w-full bg-white dark:bg-slate-700 border border-blue-400 dark:border-blue-500 rounded px-1 py-0.5 text-right text-[13px] tabular-nums outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-200"
      />
    );
  }

  return (
    <span
      className="cursor-pointer hover:text-blue-600 hover:underline decoration-dashed underline-offset-2"
      onDoubleClick={startEdit}
      title="Double-click to edit lead time"
    >
      {value}
    </span>
  );
}

function DropShipBadge({ sku, isDropShip, onChanged }: { sku: string; isDropShip: boolean; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    const newLabel = isDropShip ? "Warehoused" : "Drop Ship";
    if (!window.confirm(`Change ${sku} to "${newLabel}"?`)) return;
    setSaving(true);
    try {
      await updateDropShip(sku, !isDropShip);
      onChanged();
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      title={`Click to mark as ${isDropShip ? "warehoused" : "drop ship"}`}
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
        saving ? "opacity-50 cursor-wait" : "cursor-pointer"
      } ${
        isDropShip
          ? "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600"
      }`}
    >
      {isDropShip ? "Drop Ship" : "Warehoused"}
    </button>
  );
}

function CopySku({ sku }: { sku: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(sku);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy SKU"
      className="shrink-0 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
    >
      {copied ? (
        <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

export function ForecastTable({ items, sortBy, sortDir, onSort, onRowClick, onLeadTimeChanged, totals, velocityWindow = 90 }: Props) {
  const COLUMNS = getColumns(velocityWindow);
  const arrow = (col: string) => {
    if (sortBy !== col) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  };

  const rowBg = (_urgency: string) => "";

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-[13px] table-fixed">
        <colgroup>
          <col className="w-14" />       {/* urgency badge */}
          <col style={{ width: "35%" }} /> {/* product - takes remaining space */}
          <col className="w-28" />        {/* manufacturer */}
          <col className="w-14" />        {/* channel */}
          <col className="w-20" />        {/* on hand */}
          <col className="w-16" />        {/* vel/d */}
          <col className="w-14" />        {/* szn */}
          <col className="w-18" />        {/* adj vel */}
          <col className="w-20" />        {/* days left */}
          <col className="w-12" />        {/* LT */}
          <col className="w-20" />        {/* sold 90d */}
          <col className="w-24" />        {/* rev 90d */}
        </colgroup>
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`px-2 py-2 font-semibold text-slate-500 dark:text-slate-400 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 select-none whitespace-nowrap ${
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                }`}
                onClick={() => onSort(col.key)}
                title={col.tooltip || undefined}
              >
                {col.label}{col.tooltip && <span className="inline-block ml-0.5 text-slate-400 opacity-60 text-[10px]" title={col.tooltip}>&#9432;</span>}{arrow(col.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.sku}
              className={`border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 ${rowBg(item.urgency)} ${onRowClick ? "cursor-pointer" : ""}`}
              onClick={() => onRowClick?.(item.sku)}
            >
              {/* Urgency */}
              <td className="px-2 py-1.5">
                <UrgencyBadge urgency={item.urgency} />
              </td>

              {/* Product — SKU + name stacked + drop ship badge */}
              <td className="px-2 py-1.5 overflow-hidden" title={`${item.sku}\n${item.display_name}`}>
                <div className="truncate font-medium text-slate-900 dark:text-slate-100 leading-tight">
                  {item.display_name}
                </div>
                <div className="flex items-center gap-1.5 leading-tight">
                  <span className="truncate text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                    {item.sku}
                  </span>
                  <CopySku sku={item.sku} />
                  <DropShipBadge sku={item.sku} isDropShip={item.is_drop_ship === 1} onChanged={() => onLeadTimeChanged?.()} />
                </div>
              </td>

              {/* Manufacturer */}
              <td className="px-2 py-1.5 overflow-hidden">
                <span className="truncate block text-xs text-slate-600 dark:text-slate-400" title={item.manufacturer || ""}>
                  {item.manufacturer || "-"}
                </span>
              </td>

              {/* Channel */}
              <td className="px-2 py-1.5 text-center">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium" title={item.top_channel || ""}>
                  {shortChannel(item.top_channel)}
                </span>
              </td>

              {/* On Hand */}
              <td className={`px-2 py-1.5 text-right tabular-nums ${item.on_hand < 0 ? "text-red-600 dark:text-red-400 font-bold" : "text-slate-700 dark:text-slate-300"}`}>
                {item.on_hand.toLocaleString()}
                {item.incoming_qty > 0 && (
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">+{item.incoming_qty.toLocaleString()} incoming</div>
                )}
              </td>

              {/* Velocity */}
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                {item.velocity.toFixed(1)}
              </td>

              {/* Seasonality */}
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                {item.seasonality_factor.toFixed(1)}x
              </td>

              {/* Adjusted Velocity */}
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-300 font-medium">
                {item.adjusted_velocity.toFixed(1)}
              </td>

              {/* Days Left */}
              <td className={`px-2 py-1.5 text-right tabular-nums font-semibold ${
                item.days_remaining !== null && item.days_remaining <= item.lead_time_days
                  ? "text-red-600 dark:text-red-400"
                  : item.days_remaining !== null && item.days_remaining <= item.lead_time_days * 1.5
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-700 dark:text-slate-300"
              }`}>
                {item.days_remaining !== null ? item.days_remaining.toFixed(0) : "-"}
              </td>

              {/* Lead Time — double-click to edit */}
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-500 dark:text-slate-400" onClick={(e) => e.stopPropagation()}>
                <LeadTimeCell sku={item.sku} value={item.lead_time_days} onSaved={() => onLeadTimeChanged?.()} />
              </td>

              {/* Sold 90d */}
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                {item.total_sold_90d.toLocaleString()}
              </td>

              {/* Revenue 90d */}
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                ${(item.total_revenue_90d ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 font-semibold text-slate-900 dark:text-slate-100">
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-xs uppercase tracking-wide">Totals</td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right tabular-nums">{totals.on_hand.toLocaleString()}</td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right tabular-nums">{totals.total_sold_90d.toLocaleString()}</td>
              <td className="px-2 py-2 text-right tabular-nums">${(totals.total_revenue_90d ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
