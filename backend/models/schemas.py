from pydantic import BaseModel


class ForecastItem(BaseModel):
    sku: str
    display_name: str
    on_hand: int
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
    monthly_sales: list[MonthlySales]
    channel_breakdown: list[ChannelBreakdown]
    recent_orders: list[RecentOrder]
    total_revenue_90d: float
    total_cost_90d: float
    margin_90d: float | None
    ai_insight: str | None = None
    insight_generated_at: str | None = None
