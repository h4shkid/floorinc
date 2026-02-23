import type {
  User,
  Manufacturer,
  Product,
  Order,
  Alert,
  EmailLog,
  ActivityLog,
} from "@prisma/client";

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "MANUFACTURER";

export type OrderStatus =
  | "RECEIVED"
  | "ASSIGNED"
  | "NOTIFIED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "DELAYED";

export type OrderSource = "AMAZON" | "WEBSITE" | "WAYFAIR" | "HOME_DEPOT";

export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type AlertType = "DELAY" | "OVERDUE" | "QUALITY" | "STOCK" | "ESCALATION";

export type ManufacturerRating = "EXCELLENT" | "GOOD" | "FAIR" | "POOR";

export type ProductCategory = "HARDWOOD" | "LAMINATE" | "VINYL" | "TILE" | "CARPET";

export interface OrderWithRelations extends Order {
  product: Product;
  manufacturer: Manufacturer | null;
  alerts: Alert[];
  emailLogs: EmailLog[];
  activityLogs: (ActivityLog & { user: User | null })[];
}

export interface ManufacturerWithRelations extends Manufacturer {
  products: Product[];
  orders: Order[];
  users: User[];
  alerts: Alert[];
  emailLogs: EmailLog[];
}

export interface AlertWithRelations extends Alert {
  order: (Order & { product: Product }) | null;
  manufacturer: Manufacturer | null;
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  activeAlerts: number;
  avgFulfillment: number;
  onTimeRate: number;
}

export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

export { User, Manufacturer, Product, Order, Alert, EmailLog, ActivityLog };
