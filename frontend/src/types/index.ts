export interface ForecastItem {
  sku: string;
  display_name: string;
  on_hand: number;
  velocity: number;
  seasonality_factor: number;
  adjusted_velocity: number;
  days_remaining: number | null;
  lead_time_days: number;
  urgency: "BACKORDER" | "RED" | "YELLOW" | "GREEN";
  priority_score: number;
  product_category: string | null;
  top_channel: string | null;
  total_sold_90d: number;
  total_revenue_90d: number;
  manufacturer: string | null;
}

export interface DashboardTotals {
  on_hand: number;
  total_sold_90d: number;
  total_revenue_90d: number;
}

export interface ForecastSummary {
  backorder: number;
  red: number;
  yellow: number;
  green: number;
  total_skus: number;
  total_value_at_risk: number;
}

export interface DashboardResponse {
  items: ForecastItem[];
  total: number;
  page: number;
  page_size: number;
  summary: ForecastSummary;
  totals: DashboardTotals;
}

export interface DashboardParams {
  page: number;
  page_size: number;
  sort_by: string;
  sort_dir: "asc" | "desc";
  search: string;
  urgency: string;
  channel: string;
  category: string;
  manufacturer: string;
  velocity_window: number;
  active_only: boolean;
}

export interface LeadTime {
  sku: string;
  product_category: string | null;
  lead_time_days: number;
  source: string;
  updated_at: string;
}

export interface ImportResult {
  rows_imported: number;
  rows_skipped: number;
  message: string;
}

export interface MonthlySales {
  month: string;
  quantity: number;
  revenue: number;
}

export interface ChannelBreakdown {
  channel: string;
  quantity: number;
  revenue: number;
}

export interface RecentOrder {
  date: string;
  quantity: number;
  channel: string | null;
  revenue: number;
}

export interface SKUDetail {
  sku: string;
  display_name: string;
  on_hand: number;
  urgency: "BACKORDER" | "RED" | "YELLOW" | "GREEN";
  lead_time_days: number;
  velocity: number;
  seasonality_factor: number;
  adjusted_velocity: number;
  days_remaining: number | null;
  product_category: string | null;
  manufacturer: string | null;
  monthly_sales: MonthlySales[];
  channel_breakdown: ChannelBreakdown[];
  recent_orders: RecentOrder[];
  total_revenue_90d: number;
  total_cost_90d: number;
  margin_90d: number | null;
  ai_insight?: string;
  insight_generated_at?: string;
}
