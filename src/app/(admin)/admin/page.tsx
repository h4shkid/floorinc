import { formatDistanceToNow, format, subDays } from "date-fns";
import {
  ShoppingCart,
  Clock,
  AlertTriangle,
  Timer,
  CheckCircle2,
  Package,
  Truck,
  Bell,
  Mail,
  UserCheck,
  LogIn,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  OrdersBySourceChart,
  OrdersByStatusChart,
  FulfillmentTrendChart,
  OrderVolumeChart,
} from "@/components/admin/dashboard-charts";

export const dynamic = "force-dynamic";

// -- Data fetching helpers --

async function fetchStats() {
  const [totalOrders, pendingOrders, activeAlerts, deliveredOrders] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.count({
        where: { status: { in: ["RECEIVED", "ASSIGNED"] } },
      }),
      prisma.alert.count({ where: { resolved: false } }),
      prisma.order.findMany({
        where: {
          status: "DELIVERED",
          deliveredAt: { not: null },
        },
        select: { createdAt: true, deliveredAt: true, estimatedShip: true },
      }),
    ]);

  let avgFulfillment = 0;
  let onTimeRate = 0;

  if (deliveredOrders.length > 0) {
    const totalDays = deliveredOrders.reduce((sum, order) => {
      const created = new Date(order.createdAt).getTime();
      const delivered = new Date(order.deliveredAt!).getTime();
      const days = (delivered - created) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);
    avgFulfillment = Math.round((totalDays / deliveredOrders.length) * 10) / 10;

    const onTimeCount = deliveredOrders.filter((order) => {
      if (!order.estimatedShip) return true;
      return new Date(order.deliveredAt!) <= new Date(order.estimatedShip);
    }).length;
    onTimeRate = Math.round((onTimeCount / deliveredOrders.length) * 100);
  }

  return { totalOrders, pendingOrders, activeAlerts, avgFulfillment, onTimeRate };
}

async function fetchOrdersBySource() {
  const sources = ["AMAZON", "WEBSITE", "WAYFAIR", "HOME_DEPOT"];
  const counts = await Promise.all(
    sources.map(async (source) => ({
      name: source,
      value: await prisma.order.count({ where: { source } }),
    }))
  );
  return counts.filter((item) => item.value > 0);
}

async function fetchOrdersByStatus() {
  const statuses = [
    "RECEIVED",
    "ASSIGNED",
    "NOTIFIED",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "DELAYED",
  ];
  const counts = await Promise.all(
    statuses.map(async (status) => ({
      name: status,
      value: await prisma.order.count({ where: { status } }),
    }))
  );
  return counts.filter((item) => item.value > 0);
}

async function fetchFulfillmentTrend() {
  const days = 14;
  const result: { date: string; avgDays: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = subDays(new Date(), i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const delivered = await prisma.order.findMany({
      where: {
        deliveredAt: { gte: dayStart, lte: dayEnd },
      },
      select: { createdAt: true, deliveredAt: true },
    });

    let avgDays = 0;
    if (delivered.length > 0) {
      const totalMs = delivered.reduce((sum, o) => {
        return (
          sum +
          (new Date(o.deliveredAt!).getTime() - new Date(o.createdAt).getTime())
        );
      }, 0);
      avgDays =
        Math.round((totalMs / delivered.length / (1000 * 60 * 60 * 24)) * 10) /
        10;
    }

    result.push({ date: format(dayStart, "MM/dd"), avgDays });
  }

  return result;
}

async function fetchOrderVolume() {
  const days = 14;
  const result: { date: string; orders: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = subDays(new Date(), i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const count = await prisma.order.count({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
    });

    result.push({ date: format(dayStart, "MM/dd"), orders: count });
  }

  return result;
}

async function fetchActivityFeed() {
  return prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { user: { select: { name: true } } },
  });
}

async function fetchManufacturerPerformance() {
  return prisma.manufacturer.findMany({
    where: { status: "ACTIVE" },
    orderBy: { onTimeRate: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      location: true,
      avgFulfillment: true,
      onTimeRate: true,
      rating: true,
    },
  });
}

// -- UI helpers --

const ACTION_ICONS: Record<string, typeof Package> = {
  ORDER_CREATED: Package,
  ORDER_ASSIGNED: UserCheck,
  ORDER_SHIPPED: Truck,
  ALERT_CREATED: Bell,
  ALERT_RESOLVED: CheckCircle2,
  EMAIL_SENT: Mail,
  USER_LOGIN: LogIn,
};

function getActionIcon(action: string) {
  return ACTION_ICONS[action] ?? Package;
}

function getRatingBadgeVariant(
  rating: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (rating) {
    case "EXCELLENT":
      return "default";
    case "GOOD":
      return "secondary";
    case "FAIR":
      return "outline";
    case "POOR":
      return "destructive";
    default:
      return "secondary";
  }
}

function getRatingClassName(rating: string): string {
  switch (rating) {
    case "EXCELLENT":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "GOOD":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "FAIR":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "POOR":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "";
  }
}

// -- Page component --

export default async function AdminDashboardPage() {
  const [
    stats,
    ordersBySource,
    ordersByStatus,
    fulfillmentTrend,
    orderVolume,
    activityFeed,
    manufacturers,
  ] = await Promise.all([
    fetchStats(),
    fetchOrdersBySource(),
    fetchOrdersByStatus(),
    fetchFulfillmentTrend(),
    fetchOrderVolume(),
    fetchActivityFeed(),
    fetchManufacturerPerformance(),
  ]);

  const metricCards = [
    {
      title: "Total Orders",
      value: stats.totalOrders.toLocaleString(),
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Pending Orders",
      value: stats.pendingOrders.toLocaleString(),
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "Active Alerts",
      value: stats.activeAlerts.toLocaleString(),
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Avg Fulfillment",
      value: `${stats.avgFulfillment} days`,
      icon: Timer,
      color: "text-violet-600",
      bgColor: "bg-violet-50",
    },
    {
      title: "On-Time Rate",
      value: `${stats.onTimeRate}%`,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your flooring operations
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {metricCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold">{card.value}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts - row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OrdersBySourceChart data={ordersBySource} />
        <OrdersByStatusChart data={ordersByStatus} />
      </div>

      {/* Charts - row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FulfillmentTrendChart data={fulfillmentTrend} />
        <OrderVolumeChart data={orderVolume} />
      </div>

      {/* Activity feed + Manufacturer performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity feed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityFeed.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No recent activity
              </p>
            ) : (
              <div className="space-y-4">
                {activityFeed.map((log) => {
                  const Icon = getActionIcon(log.action);
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 text-sm"
                    >
                      <div className="mt-0.5 p-1.5 rounded-md bg-slate-100">
                        <Icon className="h-3.5 w-3.5 text-slate-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-700 leading-snug">
                          {log.details}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {log.user?.name ? `${log.user.name} - ` : ""}
                          {formatDistanceToNow(new Date(log.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manufacturer performance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Manufacturer Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {manufacturers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No manufacturer data available
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead className="hidden sm:table-cell">Location</TableHead>
                    <TableHead className="text-right">Avg Days</TableHead>
                    <TableHead className="text-right">On-Time</TableHead>
                    <TableHead className="text-right">Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manufacturers.map((mfr, index) => (
                    <TableRow key={mfr.id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{mfr.name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{mfr.location || "—"}</TableCell>
                      <TableCell className="text-right">
                        {mfr.avgFulfillment.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {mfr.onTimeRate.toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={getRatingBadgeVariant(mfr.rating)}
                          className={getRatingClassName(mfr.rating)}
                        >
                          {mfr.rating.charAt(0) +
                            mfr.rating.slice(1).toLowerCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
