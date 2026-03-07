import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { SyncStatus } from "../../types";
import {
  fetchSyncStatus, triggerNetSuiteSync, triggerSalesSync,
  fetchAkeneoStatus, triggerAkeneoSync,
  triggerAkeneoPreview, fetchAkeneoPreviewStatus,
} from "../../api/client";
import type { AkeneoPreviewResult, AkeneoPreviewStatus } from "../../api/client";

function NetSuiteSync() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const s = await fetchSyncStatus();
      setStatus(s);
      if (s.state !== "running" && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch {
      // ignore polling errors
    }
  }, []);

  useEffect(() => {
    poll();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll]);

  const startSync = async (salesOnly = false) => {
    setTriggering(true);
    setError(null);
    try {
      if (salesOnly) {
        await triggerSalesSync();
      } else {
        await triggerNetSuiteSync();
      }
      intervalRef.current = setInterval(poll, 2000);
      poll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start sync");
    } finally {
      setTriggering(false);
    }
  };

  if (!status || !status.configured) return null;

  const isRunning = status.state === "running";
  const isCompleted = status.state === "completed";
  const isError = status.state === "error";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4 hover-lift">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sync from NetSuite</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pull live inventory and sales data directly from NetSuite
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => startSync(true)}
            disabled={isRunning || triggering}
            className="px-4 py-2.5 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
          >
            {isRunning ? "Syncing..." : "Sales Only"}
          </button>
          <button
            onClick={() => startSync(false)}
            disabled={isRunning || triggering}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 className="animate-spin h-4 w-4" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Full Sync
              </>
            )}
          </button>
        </div>
      </div>

      {isRunning && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>{status.message}</span>
            <span>{status.progress}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">{status.message}</p>
          {status.last_sync_at && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Last synced: {new Date(status.last_sync_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {isError && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">{status.error}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {!isRunning && !isCompleted && !isError && status.last_sync_at && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Last synced: {new Date(status.last_sync_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

function PreviewModal({
  results,
  summary,
  onConfirm,
  onCancel,
}: {
  results: AkeneoPreviewResult[];
  summary: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-5xl max-h-[80vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Promise Date Preview</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{summary}</p>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-6">
          {results.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">No changes to make — all values are up to date.</p>
          ) : (
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead className="sticky top-0 bg-white dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                  <th className="pb-2 px-3 font-medium text-slate-600 dark:text-slate-400">SKU</th>
                  <th className="pb-2 px-3 font-medium text-slate-600 dark:text-slate-400 text-right">On Hand</th>
                  <th className="pb-2 px-3 font-medium text-slate-600 dark:text-slate-400 text-right">Committed</th>
                  <th className="pb-2 px-3 font-medium text-slate-600 dark:text-slate-400">Current</th>
                  <th className="pb-2 px-3 font-medium text-slate-600 dark:text-slate-400">New Value</th>
                  <th className="pb-2 px-3 font-medium text-slate-600 dark:text-slate-400">Reason</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const available = r.on_hand - r.qty_committed;
                  const reasonLabel = r.covering_po
                    ? `${r.covering_po} (${r.covering_po_date ? new Date(r.covering_po_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "no date"})`
                    : r.reason === "In stock"
                      ? "In stock"
                      : "No POs";
                  return (
                    <tr key={r.sku} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="py-2 px-3 font-mono text-xs text-slate-900 dark:text-slate-100">{r.sku}</td>
                      <td className={`py-2 px-3 text-right tabular-nums ${available < 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-slate-700 dark:text-slate-300"}`}>
                        {r.on_hand}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-500 dark:text-slate-400">{r.qty_committed}</td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400">{r.current_value}</td>
                      <td className="py-2 px-3 font-medium text-purple-700 dark:text-purple-300">{r.new_value}</td>
                      <td className="py-2 px-3 text-xs text-slate-600 dark:text-slate-400">{reasonLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          {results.length > 0 && (
            <button
              onClick={onConfirm}
              className="px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Confirm & Sync ({results.length} SKUs)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AkeneoSync() {
  // Sync status (for actual push)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<AkeneoPreviewStatus | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [previewResults, setPreviewResults] = useState<AkeneoPreviewResult[]>([]);
  const [previewSummary, setPreviewSummary] = useState("");
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll sync status
  const pollSync = useCallback(async () => {
    try {
      const s = await fetchAkeneoStatus();
      setSyncStatus(s);
      if (s.state !== "running" && syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    pollSync();
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);
    };
  }, [pollSync]);

  // Poll preview status
  const pollPreview = useCallback(async () => {
    try {
      const s = await fetchAkeneoPreviewStatus();
      setPreviewStatus(s);
      if (s.state !== "running") {
        if (previewIntervalRef.current) {
          clearInterval(previewIntervalRef.current);
          previewIntervalRef.current = null;
        }
        setPreviewLoading(false);
        if (s.state === "completed" && s.results) {
          setPreviewResults(s.results);
          setPreviewSummary(s.message || "");
          setShowModal(true);
        } else if (s.state === "error") {
          setError(s.error || "Preview failed");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Start preview
  const startPreview = async () => {
    setPreviewLoading(true);
    setError(null);
    try {
      await triggerAkeneoPreview();
      previewIntervalRef.current = setInterval(pollPreview, 2000);
      pollPreview();
    } catch (e) {
      setPreviewLoading(false);
      setError(e instanceof Error ? e.message : "Failed to start preview");
    }
  };

  // Confirm sync after preview
  const confirmSync = async () => {
    setShowModal(false);
    setError(null);
    try {
      await triggerAkeneoSync();
      syncIntervalRef.current = setInterval(pollSync, 2000);
      pollSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start Akeneo sync");
    }
  };

  if (!syncStatus || !syncStatus.configured) return null;

  const isSyncing = syncStatus.state === "running";
  const isSyncCompleted = syncStatus.state === "completed";
  const isSyncError = syncStatus.state === "error";
  const isBusy = isSyncing || previewLoading;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4 hover-lift">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Akeneo Promise Dates</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Calculate and push promise dates to Akeneo PIM based on stock and PO data
          </p>
        </div>
        <button
          onClick={startPreview}
          disabled={isBusy}
          className="px-5 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {previewLoading ? (
            <>
              <Spinner />
              Loading Preview...
            </>
          ) : isSyncing ? (
            <>
              <Spinner />
              Updating...
            </>
          ) : (
            "Update Promise Dates"
          )}
        </button>
      </div>

      {/* Preview progress */}
      {previewLoading && previewStatus?.state === "running" && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>{previewStatus.message}</span>
            <span>{previewStatus.progress}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
            <div
              className="bg-purple-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${previewStatus.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Sync progress */}
      {isSyncing && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>{syncStatus.message}</span>
            <span>{syncStatus.progress}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
            <div
              className="bg-purple-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${syncStatus.progress}%` }}
            />
          </div>
        </div>
      )}

      {isSyncCompleted && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">{syncStatus.message}</p>
          {syncStatus.last_sync_at && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Last synced: {new Date(syncStatus.last_sync_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {isSyncError && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">{syncStatus.error}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {!isSyncing && !isSyncCompleted && !isSyncError && !previewLoading && syncStatus.last_sync_at && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Last synced: {new Date(syncStatus.last_sync_at).toLocaleString()}
        </p>
      )}

      {/* Preview Modal */}
      {showModal && (
        <PreviewModal
          results={previewResults}
          summary={previewSummary}
          onConfirm={confirmSync}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export function ImportPage() {
  return (
    <div className="space-y-6">
      <NetSuiteSync />
      <AkeneoSync />
    </div>
  );
}
