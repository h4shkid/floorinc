import { useState, useEffect, useCallback, useMemo, type FormEvent } from "react";
import { Sun, Moon } from "lucide-react";
import { useForecast } from "./hooks/useForecast";
import { SummaryCards } from "./components/Dashboard/SummaryCards";
import { DashboardSkeleton } from "./components/Dashboard/Skeleton";
import { ForecastTable } from "./components/Dashboard/ForecastTable";
import { SKUDetailPanel } from "./components/Dashboard/SKUDetail";
import { FilterBar } from "./components/Filters/FilterBar";
import { Pagination } from "./components/Filters/Pagination";
import { ImportPage } from "./components/Import/ImportPage";
import { PurchaseOrdersPage } from "./components/PurchaseOrders/PurchaseOrdersPage";
import { GuidePage } from "./components/Guide/GuidePage";
import { SpotlightTour, type TourStep } from "./components/Guide/SpotlightTour";
import { ChatWidget } from "./components/Chat/ChatWidget";
import { fetchDataStats, fetchSyncStatus } from "./api/client";
import type { DataStats, SyncStatus } from "./types";

type Tab = "dashboard" | "purchase-orders" | "import" | "guide";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

function buildTourSteps(): TourStep[] {
  return [
    {
      target: "[data-tour='summary-cards']",
      title: "Summary Cards",
      content: "These cards show a quick overview of your inventory health. Backorders and Red items need immediate attention, Yellow items are getting close, and Green means you're comfortable. Counts are based on available stock (on hand minus committed).",
      placement: "bottom",
    },
    {
      target: "[data-tour='filter-bar']",
      title: "Filters",
      content: "Use these filters to narrow down the table. Search by SKU, product name, or manufacturer. Filter by urgency, stock type (warehoused vs drop ship), category, manufacturer, and change the velocity window.",
      placement: "bottom",
    },
    {
      target: "[data-tour='table-header']",
      title: "Forecast Table",
      content: "The main table showing all SKUs with available stock, sales velocity, seasonality, days remaining, and revenue. The 'Available' column shows on hand minus committed orders. Click any column header to sort.",
      placement: "bottom",
    },
    {
      target: "[data-tour='urgency-badge']",
      title: "Urgency Badge",
      content: "The colored badge shows urgency based on available stock: RED = order now (days left < lead time), YELLOW = getting close (days left < 1.5x lead time), GREEN = comfortable, BACKORDER = more committed than on hand.",
      placement: "right",
    },
    {
      target: "[data-tour='product-cell']",
      title: "Product Info, Copy & Drop Ship",
      content: "Each row shows the product name, SKU with a copy button (click to copy), and a Warehoused/Drop Ship badge. Click the badge to toggle — you'll be asked to confirm first.",
      placement: "bottom",
    },
    {
      target: "[data-tour='lead-time-cell']",
      title: "Edit Lead Time",
      content: "Double-click any lead time value to edit it. Type the new number of days and press Enter. This directly affects the urgency calculation.",
      placement: "left",
    },
    {
      target: "[data-tour='first-row']",
      title: "SKU Detail",
      content: "Click any row to open a detail panel showing available stock with physical/committed breakdown, net after receipt for out-of-stock items, AI insights, purchase orders, monthly sales, channel breakdown, and 90-day financials.",
      placement: "bottom",
    },
  ];
}

function getInitialDark(): boolean {
  const stored = localStorage.getItem("theme");
  if (stored) return stored === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function LoginGate({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        headers: { "X-Auth-Token": password },
      });
      if (res.status === 401) {
        setError("Wrong password");
      } else {
        localStorage.setItem("app_password", password);
        onAuth();
      }
    } catch {
      setError("Cannot reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 space-y-5 transition-all duration-200"
      >
        <div className="text-center">
          <img src="/logo.png" alt="FlooringInc" className="h-10 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Inventory Forecast
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Enter team password to continue</p>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-md transition-all duration-150"
          autoFocus
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Checking..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

function DataStatsBar({ stats, lastSync }: { stats: DataStats | null; lastSync: string | null }) {
  if (!stats || !stats.total_transactions) return null;

  return (
    <div className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 px-6 py-2">
      <div className="max-w-[1600px] mx-auto flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-slate-700 dark:text-slate-300">{stats.inventory_skus.toLocaleString()}</span> SKUs
        </span>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-slate-700 dark:text-slate-300">{stats.total_transactions.toLocaleString()}</span> transactions
        </span>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-slate-700 dark:text-slate-300">{stats.skus_with_sales.toLocaleString()}</span> SKUs with sales
        </span>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-slate-700 dark:text-slate-300">{stats.channels}</span> channels
        </span>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <span>
          <span className="font-medium text-slate-700 dark:text-slate-300">{stats.months}</span> months of data
          {stats.date_from && stats.date_to && (
            <span className="ml-1">({stats.date_from} to {stats.date_to})</span>
          )}
        </span>
        {lastSync && (
          <>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span>
              Last sync: <span className="font-medium text-slate-700 dark:text-slate-300">{new Date(lastSync).toLocaleString()}</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(getInitialDark);
  const [dataStats, setDataStats] = useState<DataStats | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [runTour, setRunTour] = useState(false);
  const { data, loading, error, params, updateParams, toggleSort, reload } = useForecast();

  const tourSteps = useMemo(() => buildTourSteps(), []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    fetchDataStats().then(setDataStats).catch(() => {});
    fetchSyncStatus().then((s: SyncStatus) => setLastSync(s.last_sync_at)).catch(() => {});
  }, []);

  const startTour = useCallback(() => {
    setSelectedSku(null);
    setTab("dashboard");
    setTimeout(() => setRunTour(true), 500);
  }, []);

  const finishTour = useCallback(() => {
    setRunTour(false);
    setSelectedSku(null);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <SpotlightTour steps={tourSteps} run={runTour} onFinish={finishTour} />

      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="FlooringInc" className="h-10 shrink-0" />
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Inventory Forecast</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Tennessee Warehouse</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex gap-1">
              {(["dashboard", "purchase-orders", "import", "guide"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                  }`}
                >
                  {t === "dashboard" ? "Dashboard" : t === "purchase-orders" ? "Purchase Orders" : t === "import" ? "Data Sync" : "Guide"}
                </button>
              ))}
            </nav>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      <DataStatsBar stats={dataStats} lastSync={lastSync} />

      {/* Main */}
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        {tab === "dashboard" && (
          <>
            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4 text-red-800 dark:text-red-300">
                {error}
                <button onClick={reload} className="ml-3 underline">Retry</button>
              </div>
            )}

            {data && <SummaryCards summary={data.summary} />}

            <FilterBar params={params} onChange={updateParams} />

            {loading ? (
              <DashboardSkeleton />
            ) : data ? (
              <>
                <ForecastTable
                  items={data.items}
                  sortBy={params.sort_by}
                  sortDir={params.sort_dir}
                  onSort={toggleSort}
                  onRowClick={setSelectedSku}
                  onLeadTimeChanged={reload}
                  totals={data.totals}
                  velocityWindow={params.velocity_window}
                />
                <Pagination
                  page={data.page}
                  pageSize={data.page_size}
                  total={data.total}
                  onChange={(p) => updateParams({ page: p })}
                />
              </>
            ) : null}
          </>
        )}

        {tab === "purchase-orders" && <PurchaseOrdersPage />}

        {tab === "import" && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Data Sync</h2>
            <ImportPage />
          </div>
        )}

        {tab === "guide" && <GuidePage onStartTour={startTour} />}
      </main>

      {selectedSku && (
        <SKUDetailPanel sku={selectedSku} velocityWindow={params.velocity_window} onClose={() => setSelectedSku(null)} />
      )}

      <ChatWidget />
    </div>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(() => !!localStorage.getItem("app_password"));

  if (!authenticated) {
    return <LoginGate onAuth={() => setAuthenticated(true)} />;
  }

  return <AuthenticatedApp />;
}

export default App;
