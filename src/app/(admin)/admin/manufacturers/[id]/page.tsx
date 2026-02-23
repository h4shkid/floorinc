import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Factory,
  Mail,
  Phone,
  User,
  ShoppingCart,
  Clock,
  Package,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { STATUS_COLORS } from "@/lib/constants";

export const dynamic = "force-dynamic";

function getRatingBadgeClasses(rating: string): string {
  switch (rating) {
    case "EXCELLENT":
      return "bg-green-100 text-green-800 border-green-300";
    case "GOOD":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "FAIR":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "POOR":
      return "bg-red-100 text-red-800 border-red-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

function getEmailStatusBadge(status: string): string {
  switch (status) {
    case "SENT":
      return "bg-blue-100 text-blue-800";
    case "DELIVERED":
      return "bg-green-100 text-green-800";
    case "FAILED":
      return "bg-red-100 text-red-800";
    case "BOUNCED":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default async function ManufacturerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { name: "asc" },
      },
      orders: {
        take: 20,
        orderBy: { createdAt: "desc" },
        include: { product: true },
      },
      emailLogs: {
        take: 20,
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          orders: true,
          products: true,
        },
      },
    },
  });

  if (!manufacturer) {
    notFound();
  }

  const metrics = [
    {
      label: "Total Orders",
      value: manufacturer._count.orders.toString(),
      icon: ShoppingCart,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Avg Fulfillment",
      value: `${manufacturer.avgFulfillment.toFixed(1)} days`,
      icon: Clock,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "On-Time Rate",
      value: `${manufacturer.onTimeRate.toFixed(0)}%`,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Products",
      value: manufacturer._count.products.toString(),
      icon: Package,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/manufacturers" className="gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Manufacturers
        </Link>
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="p-3 bg-slate-100 rounded-xl">
              <Factory className="w-8 h-8 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{manufacturer.name}</h1>
                {manufacturer.location && (
                  <span className="text-sm text-muted-foreground">{manufacturer.location}</span>
                )}
                <Badge
                  variant="outline"
                  className={getRatingBadgeClasses(manufacturer.rating)}
                >
                  {manufacturer.rating}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    manufacturer.status === "ACTIVE"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }
                >
                  {manufacturer.status}
                </Badge>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  {manufacturer.contactName}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4" />
                  {manufacturer.contactEmail}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4" />
                  {manufacturer.contactPhone}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${metric.bg}`}>
                  <metric.icon className={`w-5 h-5 ${metric.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metric.value}</p>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* On-Time Rate visual */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">On-Time Delivery Rate</span>
            <span className="text-sm font-bold">{manufacturer.onTimeRate.toFixed(1)}%</span>
          </div>
          <Progress value={manufacturer.onTimeRate} className="h-3" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {manufacturer.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No orders found for this manufacturer.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manufacturer.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.orderNumber}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {order.product.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={STATUS_COLORS[order.status] ?? ""}
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/admin/orders/${order.id}`}>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5" />
              Products ({manufacturer.products.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {manufacturer.products.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No products registered for this manufacturer.
              </p>
            ) : (
              <div className="space-y-2">
                {manufacturer.products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {product.sku} | {product.category}
                      </p>
                    </div>
                    <p className="text-sm font-semibold shrink-0 ml-4">
                      ${product.price.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Communication History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Communication History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {manufacturer.emailLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No email communications recorded.
            </p>
          ) : (
            <div className="space-y-3">
              {manufacturer.emailLogs.map((email) => (
                <div
                  key={email.id}
                  className="flex items-start gap-3 p-3 rounded-lg border"
                >
                  <div className="p-1.5 rounded bg-slate-100 shrink-0 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{email.subject}</p>
                      <Badge
                        variant="outline"
                        className={getEmailStatusBadge(email.status)}
                      >
                        {email.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      To: {email.recipient}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeAgo(email.createdAt)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {email.type.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
