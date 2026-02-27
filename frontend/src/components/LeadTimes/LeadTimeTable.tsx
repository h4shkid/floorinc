import { useState, useEffect, useCallback } from "react";
import type { LeadTime } from "../../types";
import { fetchLeadTimes, updateLeadTime } from "../../api/client";

export function LeadTimeTable() {
  const [items, setItems] = useState<LeadTime[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editSku, setEditSku] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(45);
  const [editSource, setEditSource] = useState("domestic");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLeadTimes(1, search);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (item: LeadTime) => {
    setEditSku(item.sku);
    setEditValue(item.lead_time_days);
    setEditSource(item.source);
  };

  const saveEdit = async () => {
    if (!editSku) return;
    await updateLeadTime(editSku, editValue, editSource);
    setEditSku(null);
    load();
  };

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500">
          No lead times configured yet. Set lead times from the dashboard or use the API.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-400">SKU</th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-400">Category</th>
                <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-400">Lead Time (days)</th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-400">Source</th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-400">Updated</th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.sku} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-3 py-2 font-mono text-xs dark:text-slate-300">{item.sku}</td>
                  <td className="px-3 py-2 dark:text-slate-300">{item.product_category || "-"}</td>
                  <td className="px-3 py-2 text-right">
                    {editSku === item.sku ? (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(Number(e.target.value))}
                        className="w-20 px-2 py-1 border dark:border-slate-600 rounded text-right dark:bg-slate-700 dark:text-slate-200"
                        min={1}
                      />
                    ) : (
                      item.lead_time_days
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editSku === item.sku ? (
                      <select
                        value={editSource}
                        onChange={(e) => setEditSource(e.target.value)}
                        className="px-2 py-1 border dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-slate-200"
                      >
                        <option value="domestic">Domestic</option>
                        <option value="overseas">Overseas</option>
                      </select>
                    ) : (
                      item.source
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{item.updated_at}</td>
                  <td className="px-3 py-2">
                    {editSku === item.sku ? (
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600">Save</button>
                        <button onClick={() => setEditSku(null)} className="px-2 py-1 border dark:border-slate-600 rounded text-xs hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(item)} className="px-2 py-1 border dark:border-slate-600 rounded text-xs hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300">Edit</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
