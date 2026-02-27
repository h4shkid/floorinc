import { useState, useRef } from "react";
import type { ImportResult } from "../../types";
import { uploadCSV } from "../../api/client";

export function ImportPage() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const invRef = useRef<HTMLInputElement>(null);
  const salesRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (type: "inventory" | "sales", file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await uploadCSV(type, file);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
          <h3 className="font-semibold text-lg mb-2 dark:text-slate-100">Inventory CSV</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Upload the NetSuite inventory export</p>
          <input
            ref={invRef}
            type="file"
            accept=".csv"
            onChange={(e) => handleUpload("inventory", e.target.files?.[0])}
            className="hidden"
          />
          <button
            onClick={() => invRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Choose File"}
          </button>
        </div>

        <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
          <h3 className="font-semibold text-lg mb-2 dark:text-slate-100">Sales CSV</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Upload the ACS Daily Orderometer report</p>
          <input
            ref={salesRef}
            type="file"
            accept=".csv"
            onChange={(e) => handleUpload("sales", e.target.files?.[0])}
            className="hidden"
          />
          <button
            onClick={() => salesRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Choose File"}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="font-semibold text-green-800 dark:text-green-300">{result.message}</div>
          <div className="text-sm text-green-600 dark:text-green-400 mt-1">
            {result.rows_imported.toLocaleString()} rows imported, {result.rows_skipped} skipped
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-300">{error}</div>
      )}
    </div>
  );
}
