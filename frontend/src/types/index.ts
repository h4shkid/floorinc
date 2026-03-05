export interface ForecastItem {
  sku: string;
  display_name: string;
  on_hand: number;
  available_qty: number;
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
  item_cost: number;
  qty_on_order: number;
  qty_committed: number;
  incoming_qty: number;
  is_drop_ship: number;
}

export interface PurchaseOrderLine {
  po_number: string;
  po_date: string | null;
  status: string;
  vendor: string | null;
  ordered_qty: number;
  received_qty: number;
  remaining_qty: number;
  expected_date: string | null;
  rate: number;
  amount: number;
}

export interface POListItem {
  po_number: string;
  po_date: string | null;
  status: string | null;
  vendor: string | null;
  total_lines: number;
  total_ordered_qty: number;
  total_received_qty: number;
  total_remaining_qty: number;
  total_amount: number;
  earliest_expected: string | null;
  latest_expected: string | null;
}

export interface POLineItem {
  sku: string;
  display_name: string | null;
  ordered_qty: number;
  received_qty: number;
  remaining_qty: number;
  expected_date: string | null;
  rate: number;
  amount: number;
  status: string | null;
}

export interface VendorSummary {
  vendor: string;
  total_pos: number;
  total_remaining_qty: number;
  total_amount: number;
  nearest_expected: string | null;
}

export interface TimelineWeek {
  week: string;
  qty: number;
  amount: number;
  po_count: number;
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
  stock_filter: "warehoused" | "warehoused_domestic" | "warehoused_international" | "drop_ship" | "all";
}

export interface LeadTime {
  sku: string;
  product_category: string | null;
  lead_time_days: number;
  source: string;
  updated_at: string;
}

export interface DataStats {
  inventory_skus: number;
  total_transactions: number;
  skus_with_sales: number;
  channels: number;
  date_from: string | null;
  date_to: string | null;
  months: number;
  days: number;
}

export interface SyncStatus {
  state: "idle" | "running" | "completed" | "error";
  phase: string;
  progress: number;
  message: string;
  last_sync_at: string | null;
  error: string | null;
  configured: boolean;
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
  available_qty: number;
  urgency: "BACKORDER" | "RED" | "YELLOW" | "GREEN";
  lead_time_days: number;
  velocity: number;
  seasonality_factor: number;
  adjusted_velocity: number;
  days_remaining: number | null;
  product_category: string | null;
  manufacturer: string | null;
  item_cost: number;
  qty_on_order: number;
  qty_committed: number;
  incoming_qty: number;
  net_after_receipt: number;
  monthly_sales: MonthlySales[];
  channel_breakdown: ChannelBreakdown[];
  recent_orders: RecentOrder[];
  purchase_orders: PurchaseOrderLine[];
  total_revenue_90d: number;
  total_cost_90d: number;
  margin_90d: number | null;
  ai_insight?: string;
  insight_generated_at?: string;
}
