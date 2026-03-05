import type { DashboardResponse, DashboardParams, LeadTime, SKUDetail, SyncStatus, DataStats } from "../types";

const BASE = import.meta.env.VITE_API_URL || "/api";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const password = localStorage.getItem("app_password") || "";
  const headers = new Headers(init?.headers);
  headers.set("X-Auth-Token", password);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    localStorage.removeItem("app_password");
    window.location.reload();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export async function fetchDashboard(params: Partial<DashboardParams> = {}): Promise<DashboardResponse> {
  const p = new URLSearchParams();
  if (params.page) p.set("page", String(params.page));
  if (params.page_size) p.set("page_size", String(params.page_size));
  if (params.sort_by) p.set("sort_by", params.sort_by);
  if (params.sort_dir) p.set("sort_dir", params.sort_dir);
  if (params.search) p.set("search", params.search);
  if (params.urgency) p.set("urgency", params.urgency);
  if (params.channel) p.set("channel", params.channel);
  if (params.category) p.set("category", params.category);
  if (params.manufacturer) p.set("manufacturer", params.manufacturer);
  if (params.velocity_window) p.set("velocity_window", String(params.velocity_window));
  if (params.active_only !== undefined) p.set("active_only", String(params.active_only));
  if (params.stock_filter) p.set("stock_filter", params.stock_filter);
  return fetchJSON<DashboardResponse>(`${BASE}/forecast/dashboard?${p}`);
}

export async function fetchLeadTimes(page = 1, search = ""): Promise<LeadTime[]> {
  const p = new URLSearchParams({ page: String(page) });
  if (search) p.set("search", search);
  return fetchJSON<LeadTime[]>(`${BASE}/lead-times/?${p}`);
}

export async function updateLeadTime(sku: string, lead_time_days: number, source = "domestic"): Promise<LeadTime> {
  return fetchJSON<LeadTime>(`${BASE}/lead-times/${encodeURIComponent(sku)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lead_time_days, source }),
  });
}

export async function fetchManufacturers(): Promise<string[]> {
  return fetchJSON<string[]>(`${BASE}/forecast/manufacturers`);
}

export async function fetchSKUDetail(sku: string): Promise<SKUDetail> {
  return fetchJSON<SKUDetail>(`${BASE}/forecast/${encodeURIComponent(sku)}/detail`);
}

export async function fetchSyncStatus(): Promise<SyncStatus> {
  return fetchJSON<SyncStatus>(`${BASE}/netsuite/status`);
}

export async function triggerNetSuiteSync(): Promise<{ message: string }> {
  return fetchJSON<{ message: string }>(`${BASE}/netsuite/sync`, { method: "POST" });
}

export async function triggerSalesSync(): Promise<{ message: string }> {
  return fetchJSON<{ message: string }>(`${BASE}/netsuite/sync/sales`, { method: "POST" });
}

export async function updateDropShip(sku: string, isDropShip: boolean): Promise<{ sku: string; is_drop_ship: number }> {
  return fetchJSON<{ sku: string; is_drop_ship: number }>(`${BASE}/inventory/${encodeURIComponent(sku)}/drop-ship`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_drop_ship: isDropShip ? 1 : 0 }),
  });
}

export async function fetchDataStats(): Promise<DataStats> {
  return fetchJSON<DataStats>(`${BASE}/forecast/data-stats`);
}

export async function fetchAkeneoStatus(): Promise<SyncStatus> {
  return fetchJSON<SyncStatus>(`${BASE}/akeneo/status`);
}

export async function triggerAkeneoSync(): Promise<{ message: string }> {
  return fetchJSON<{ message: string }>(`${BASE}/akeneo/sync`, { method: "POST" });
}
