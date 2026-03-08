from pydantic import BaseModel


class PurchaseOrderLine(BaseModel):
    po_number: str
    po_date: str | None
    status: str
    vendor: str | None
    ordered_qty: int
    received_qty: int
    remaining_qty: int
    expected_date: str | None
    rate: float = 0
    amount: float = 0


class POListItem(BaseModel):
    po_number: str
    po_date: str | None
    status: str | None
    vendor: str | None
    total_lines: int
    total_ordered_qty: int
    total_received_qty: int
    total_remaining_qty: int
    total_amount: float
    earliest_expected: str | None
    latest_expected: str | None


class POLineItem(BaseModel):
    sku: str
    display_name: str | None = None
    ordered_qty: int
    received_qty: int
    remaining_qty: int
    expected_date: str | None
    rate: float = 0
    amount: float = 0
    status: str | None = None


class VendorSummary(BaseModel):
    vendor: str
    total_pos: int
    total_remaining_qty: int
    total_amount: float
    nearest_expected: str | None


class TimelineWeek(BaseModel):
    week: str
    qty: int
    amount: float
    po_count: int


class VendorPO(BaseModel):
    po_number: str
    po_date: str | None
    status: str | None
    total_lines: int
    total_ordered_qty: int
    total_received_qty: int
    total_remaining_qty: int
    total_amount: float
    earliest_expected: str | None
    latest_expected: str | None


class VendorSKU(BaseModel):
    sku: str
    display_name: str | None
    remaining_qty: int
    total_ordered_qty: int
    total_received_qty: int
    po_count: int


class MonthlySpend(BaseModel):
    month: str
    amount: float
    po_count: int


class VendorScorecard(BaseModel):
    vendor: str
    rating: str
    open_pos: int
    remaining_units: int
    total_on_order: float
    late_pos: int
    total_open_pos_with_date: int
    late_percentage: float
    avg_lead_time_days: float | None
    monthly_spend: list[MonthlySpend]
    skus: list[VendorSKU]
    purchase_orders: list[VendorPO]


class ForecastItem(BaseModel):
    sku: str
    display_name: str
    on_hand: int
    available_qty: int
    velocity: float
    seasonality_factor: float
    adjusted_velocity: float
    days_remaining: float | None
    lead_time_days: int
    urgency: str  # BACKORDER, RED, YELLOW, GREEN
    priority_score: float
    product_category: str | None = None
    top_channel: str | None = None
    total_sold_90d: int = 0
    total_revenue_90d: float = 0.0
    manufacturer: str | None = None
    item_cost: float = 0.0
    qty_on_order: int = 0
    qty_committed: int = 0
    incoming_qty: int = 0
    is_drop_ship: int = 0


class ForecastSummary(BaseModel):
    backorder: int
    red: int
    yellow: int
    green: int
    total_skus: int
    total_value_at_risk: float = 0.0


class DashboardTotals(BaseModel):
    on_hand: int = 0
    total_sold_90d: int = 0
    total_revenue_90d: float = 0.0


class DashboardResponse(BaseModel):
    items: list[ForecastItem]
    total: int
    page: int
    page_size: int
    summary: ForecastSummary
    totals: DashboardTotals = DashboardTotals()


class DropShipUpdate(BaseModel):
    is_drop_ship: int


class LeadTimeUpdate(BaseModel):
    lead_time_days: int
    source: str = "domestic"


class LeadTimeResponse(BaseModel):
    sku: str
    product_category: str | None
    lead_time_days: int
    source: str
    updated_at: str


class ImportResponse(BaseModel):
    rows_imported: int
    rows_skipped: int
    message: str


class MonthlySales(BaseModel):
    month: str
    quantity: int
    revenue: float


class ChannelBreakdown(BaseModel):
    channel: str
    quantity: int
    revenue: float


class RecentOrder(BaseModel):
    date: str
    quantity: int
    channel: str | None
    revenue: float


class SKUDetailResponse(BaseModel):
    sku: str
    display_name: str
    on_hand: int
    available_qty: int
    urgency: str
    lead_time_days: int
    velocity: float
    seasonality_factor: float
    adjusted_velocity: float
    days_remaining: float | None
    product_category: str | None
    manufacturer: str | None = None
    item_cost: float = 0.0
    qty_on_order: int = 0
    qty_committed: int = 0
    incoming_qty: int = 0
    net_after_receipt: int = 0
    monthly_sales: list[MonthlySales]
    channel_breakdown: list[ChannelBreakdown]
    recent_orders: list[RecentOrder]
    purchase_orders: list[PurchaseOrderLine] = []
    total_revenue_90d: float
    total_cost_90d: float
    margin_90d: float | None
    ai_insight: str | None = None
    insight_generated_at: str | None = None


# --- Sales Analytics ---

class SalesKPIs(BaseModel):
    total_revenue: float
    total_orders: int
    total_units: int
    avg_order_value: float
    total_cost: float
    gross_margin_pct: float | None
    revenue_trend: float | None


class SalesMonthlyTrend(BaseModel):
    month: str
    revenue: float
    orders: int
    units: int
    cost: float


class SalesChannelPerformance(BaseModel):
    channel: str
    revenue: float
    orders: int
    units: int
    revenue_pct: float


class SalesTopSKU(BaseModel):
    sku: str
    display_name: str | None
    revenue: float
    units: int
    orders: int
    margin_pct: float | None
    top_channel: str | None


class SalesCategoryPerformance(BaseModel):
    category: str
    revenue: float
    units: int
    orders: int


class SalesAnalyticsResponse(BaseModel):
    kpis: SalesKPIs
    monthly_trend: list[SalesMonthlyTrend]
    channel_performance: list[SalesChannelPerformance]
    top_skus: list[SalesTopSKU]
    category_performance: list[SalesCategoryPerformance]
    date_from: str | None
    date_to: str | None
