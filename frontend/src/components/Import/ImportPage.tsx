import { useState, useRef, useEffect, useCallback } from "react";
import type { SyncStatus } from "../../types";
import { fetchSyncStatus, triggerNetSuiteSync, triggerSalesSync } from "../../api/client";

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
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
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
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
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

export function ImportPage() {
  return (
    <div className="space-y-6">
      <NetSuiteSync />
    </div>
  );
}
