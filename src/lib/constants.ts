export const ORDER_STATUSES = [
  "RECEIVED",
  "ASSIGNED",
  "NOTIFIED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "DELAYED",
] as const;

export const ORDER_SOURCES = [
  "AMAZON",
  "WEBSITE",
  "WAYFAIR",
  "HOME_DEPOT",
] as const;

export const ALERT_TYPES = [
  "DELAY",
  "OVERDUE",
  "QUALITY",
  "STOCK",
  "ESCALATION",
] as const;

export const ALERT_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export const USER_ROLES = ["SUPER_ADMIN", "ADMIN", "MANUFACTURER"] as const;

export const PRODUCT_CATEGORIES = [
  "HARDWOOD",
  "LAMINATE",
  "VINYL",
  "TILE",
  "CARPET",
] as const;

export const CARRIERS = [
  "FedEx",
  "UPS",
  "USPS",
  "DHL",
  "XPO Logistics",
  "Old Dominion",
  "R+L Carriers",
] as const;

export const EMAIL_TYPES = [
  "ORDER_CONFIRMATION",
  "SHIPPING_NOTIFICATION",
  "DELAY_ALERT",
  "REMINDER",
  "ESCALATION",
] as const;

export const MANUFACTURER_RATINGS = [
  "EXCELLENT",
  "GOOD",
  "FAIR",
  "POOR",
] as const;

export const STATUS_COLORS: Record<string, string> = {
  RECEIVED: "bg-blue-100 text-blue-800",
  ASSIGNED: "bg-yellow-100 text-yellow-800",
  NOTIFIED: "bg-purple-100 text-purple-800",
  SHIPPED: "bg-indigo-100 text-indigo-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-800",
  DELAYED: "bg-red-100 text-red-800",
};

export const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-300",
  HIGH: "bg-orange-100 text-orange-800 border-orange-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-300",
  LOW: "bg-blue-100 text-blue-800 border-blue-300",
};

export const RATING_COLORS: Record<string, string> = {
  EXCELLENT: "text-green-600",
  GOOD: "text-blue-600",
  FAIR: "text-yellow-600",
  POOR: "text-red-600",
};

export const SOURCE_COLORS: Record<string, string> = {
  AMAZON: "#FF9900",
  WEBSITE: "#3B82F6",
  WAYFAIR: "#7B2D8E",
  HOME_DEPOT: "#F96302",
};

export const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

export const DEFAULT_FULFILLMENT_THRESHOLD_DAYS = 5;
export const DELAY_THRESHOLD_DAYS = 3;
