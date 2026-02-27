import { useState, useEffect } from "react";
import { useForecast } from "./hooks/useForecast";
import { SummaryCards } from "./components/Dashboard/SummaryCards";
import { ForecastTable } from "./components/Dashboard/ForecastTable";
import { SKUDetailPanel } from "./components/Dashboard/SKUDetail";
import { FilterBar } from "./components/Filters/FilterBar";
import { Pagination } from "./components/Filters/Pagination";
import { ImportPage } from "./components/Import/ImportPage";

type Tab = "dashboard" | "import";

function getInitialDark(): boolean {
  const stored = localStorage.getItem("theme");
  if (stored) return stored === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(getInitialDark);
  const { data, loading, error, params, updateParams, toggleSort, reload } = useForecast();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
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
              {(["dashboard", "import"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                  }`}
                >
                  {t === "dashboard" ? "Dashboard" : "Import Data"}
                </button>
              ))}
            </nav>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

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
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 mb-3" />
                <div>Calculating forecasts...</div>
              </div>
            ) : data ? (
              <>
                <ForecastTable
                  items={data.items}
                  sortBy={params.sort_by}
                  sortDir={params.sort_dir}
                  onSort={toggleSort}
                  onRowClick={setSelectedSku}
                  onLeadTimeChanged={reload}
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

        {tab === "import" && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Import Data</h2>
            <ImportPage />
          </div>
        )}
      </main>

      {selectedSku && (
        <SKUDetailPanel sku={selectedSku} onClose={() => setSelectedSku(null)} />
      )}
    </div>
  );
}

export default App;
