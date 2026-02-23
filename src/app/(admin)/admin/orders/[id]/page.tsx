import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Mail, Package, User, MapPin, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderTimeline } from "@/components/admin/order-timeline";
import { OrderActions } from "@/components/admin/order-actions";

export const dynamic = "force-dynamic";

interface OrderDetailPageProps {
  params: { id: string };
}

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: "bg-blue-100 text-blue-800 border-blue-200",
  ASSIGNED: "bg-yellow-100 text-yellow-800 border-yellow-200",
  NOTIFIED: "bg-purple-100 text-purple-800 border-purple-200",
  SHIPPED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  DELIVERED: "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-gray-100 text-gray-800 border-gray-200",
  DELAYED: "bg-red-100 text-red-800 border-red-200",
};

const SOURCE_COLORS: Record<string, string> = {
  AMAZON: "bg-orange-100 text-orange-800 border-orange-200",
  WEBSITE: "bg-blue-100 text-blue-800 border-blue-200",
  WAYFAIR: "bg-purple-100 text-purple-800 border-purple-200",
  HOME_DEPOT: "bg-orange-200 text-red-800 border-orange-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "text-red-600 font-bold",
  HIGH: "text-orange-600 font-semibold",
  NORMAL: "text-foreground",
  LOW: "text-gray-400",
};

function formatSourceLabel(source: string): string {
  if (source === "HOME_DEPOT") return "Home Depot";
  return source.charAt(0) + source.slice(1).toLowerCase();
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      product: { include: { manufacturer: true } },
      manufacturer: true,
      alerts: { orderBy: { createdAt: "desc" } },
      emailLogs: { orderBy: { createdAt: "desc" } },
      activityLogs: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const manufacturers = await prisma.manufacturer.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  const serializedOrder = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    manufacturerId: order.manufacturerId,
    createdAt: order.createdAt.toISOString(),
    assignedAt: order.assignedAt?.toISOString() ?? null,
    notifiedAt: order.notifiedAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
  };

  const manufacturerOptions = manufacturers.map((m) => ({
    id: m.id,
    name: m.name,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/orders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                Order {order.orderNumber}
              </h1>
              <Badge
                variant="outline"
                className={STATUS_COLORS[order.status] ?? ""}
              >
                {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
              </Badge>
              <Badge
                variant="outline"
                className={SOURCE_COLORS[order.source] ?? ""}
              >
                {formatSourceLabel(order.source)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Created {format(order.createdAt, "MMMM d, yyyy 'at' h:mm a")}
              <span className={`ml-3 ${PRIORITY_COLORS[order.priority] ?? ""}`}>
                {order.priority} Priority
              </span>
            </p>
          </div>
        </div>

        <OrderActions
          order={serializedOrder}
          manufacturers={manufacturerOptions}
        />
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="pt-6">
          <OrderTimeline order={serializedOrder} />
        </CardContent>
      </Card>

      {/* Info Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Order Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              Order Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order Number</span>
              <span className="font-medium">{order.orderNumber}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantity</span>
              <span className="font-medium">{order.quantity}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Price</span>
              <span className="font-medium">
                ${order.totalPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source</span>
              <Badge
                variant="outline"
                className={SOURCE_COLORS[order.source] ?? ""}
              >
                {formatSourceLabel(order.source)}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Priority</span>
              <span className={PRIORITY_COLORS[order.priority] ?? ""}>
                {order.priority}
              </span>
            </div>
            {order.notes && (
              <>
                <Separator />
                <div>
                  <span className="text-muted-foreground">Notes</span>
                  <p className="mt-1 text-foreground">{order.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{order.customerName}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{order.customerEmail}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">
                {order.customerPhone || "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              Shipping Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Address</span>
              <p className="mt-1 font-medium">
                {order.shippingAddress || "N/A"}
              </p>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Carrier</span>
              <span className="font-medium">{order.carrier ?? "Not shipped"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tracking Number</span>
              <span className="font-medium">
                {order.trackingNumber ?? "N/A"}
              </span>
            </div>
            {order.estimatedShip && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Ship</span>
                  <span className="font-medium">
                    {format(order.estimatedShip, "MMM d, yyyy")}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Product Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              Product Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Product</span>
              <span className="font-medium">{order.product.name}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">SKU</span>
              <span className="font-mono text-xs font-medium">
                {order.product.sku}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Category</span>
              <span className="font-medium">{order.product.category}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Manufacturer</span>
              <span className="font-medium">
                {order.manufacturer?.name ?? "Unassigned"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Communication Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Communication Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {order.emailLogs.length > 0 ? (
            <div className="space-y-4">
              {order.emailLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 rounded-lg border p-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                    <Mail className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{log.subject}</p>
                      <Badge
                        variant="outline"
                        className={
                          log.status === "SENT"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : log.status === "FAILED"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : ""
                        }
                      >
                        {log.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      To: {log.recipient} | From: {log.sender}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {log.body}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(log.createdAt, "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No communications logged for this order yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {order.activityLogs.length > 0 ? (
            <div className="space-y-3">
              {order.activityLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{log.details}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(log.createdAt, "MMM d, yyyy 'at' h:mm a")}
                      {log.user && ` by ${log.user.name}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No activity logged for this order yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
