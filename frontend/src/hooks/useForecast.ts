import { useState, useEffect, useCallback } from "react";
import type { DashboardResponse, DashboardParams } from "../types";
import { fetchDashboard } from "../api/client";

const DEFAULT_PARAMS: DashboardParams = {
  page: 1,
  page_size: 50,
  sort_by: "priority_score",
  sort_dir: "asc",
  search: "",
  urgency: "",
  channel: "",
  category: "",
  manufacturer: "",
  velocity_window: 90,
  active_only: true,
};

export function useForecast() {
  const [params, setParams] = useState<DashboardParams>(DEFAULT_PARAMS);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboard(params);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    load();
  }, [load]);

  const updateParams = useCallback((updates: Partial<DashboardParams>) => {
    setParams((prev) => ({ ...prev, ...updates, page: updates.page ?? 1 }));
  }, []);

  const toggleSort = useCallback((column: string) => {
    setParams((prev) => ({
      ...prev,
      sort_by: column,
      sort_dir: prev.sort_by === column && prev.sort_dir === "asc" ? "desc" : "asc",
    }));
  }, []);

  return { data, loading, error, params, updateParams, toggleSort, reload: load };
}
