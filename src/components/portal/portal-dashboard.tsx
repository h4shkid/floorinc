"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Truck,
  Clock,
  CheckCircle2,
  ChevronDown,
  ScanBarcode,
} from "lucide-react";
import { BarcodeScanner } from "@/components/portal/barcode-scanner";
import { cn } from "@/lib/utils";

// -- Types --

interface PortalOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  quantity: number;
  totalPrice: number;
  status: string;
  priority: string;
  assignedAt: string | null;
  shippingAddress: string;
  product: {
    name: string;
    sku: string;
    category: string;
  };
}

interface PortalStats {
  totalOrders: number;
  shippedToday: number;
  pendingCount: number;
  avgResponseHours: number;
}

interface ShippedOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  quantity: number;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  product: { name: string; sku: string; category: string };
}

interface PortalDashboardProps {
  manufacturerName: string;
  orders: PortalOrder[];
  recentlyShipped?: ShippedOrder[];
  stats: PortalStats;
}

// -- Carrier options --

const CARRIERS = [
  { id: "FedEx", label: "FedEx", icon: Truck },
  { id: "UPS", label: "UPS", icon: Truck },
  { id: "USPS", label: "USPS", icon: Truck },
  { id: "XPO Logistics", label: "XPO", icon: Truck },
  { id: "Old Dominion", label: "Old Dominion", icon: Truck },
  { id: "R+L Carriers", label: "R+L", icon: Truck },
] as const;

// -- Urgency helpers --

function getHoursSinceAssigned(assignedAt: string | null): number {
  if (!assignedAt) return 0;
  const diff = Date.now() - new Date(assignedAt).getTime();
  return diff / (1000 * 60 * 60);
}

function getUrgencyColor(hours: number): string {
  if (hours > 48) return "border-red-400 bg-red-50";
  if (hours > 24) return "border-yellow-400 bg-yellow-50";
  return "border-green-400 bg-green-50";
}

function getUrgencyBadge(hours: number): { label: string; className: string } {
  if (hours > 48) {
    return {
      label: "Overdue",
      className: "bg-red-100 text-red-800 border-red-300",
    };
  }
  if (hours > 24) {
    return {
      label: "Approaching deadline",
      className: "bg-yellow-100 text-yellow-800 border-yellow-300",
    };
  }
  return {
    label: "On time",
    className: "bg-green-100 text-green-800 border-green-300",
  };
}

// -- Stat card --

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
}

function StatCard({ label, value, icon: Icon, accent }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", accent)}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// -- Shipping form (inline, per order card) --

interface ShippingFormProps {
  orderId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function ShippingForm({ orderId, onSuccess, onCancel }: ShippingFormProps) {
  const [carrier, setCarrier] = useState<string>("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  async function handleSubmit(): Promise<void> {
    if (!carrier) {
      toast.error("Please select a carrier");
      return;
    }
    if (!trackingNumber.trim()) {
      toast.error("Please enter a tracking number");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch(`/api/portal/orders/${orderId}/ship`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier, trackingNumber: trackingNumber.trim() }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(data.error || "Failed to mark order as shipped");
      setIsSubmitting(false);
      return;
    }

    onSuccess();
  }

  return (
    <div className="mt-4 space-y-4 border-t pt-4">
      {/* Carrier grid */}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">
          Select Carrier
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CARRIERS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCarrier(c.id)}
              className={cn(
                "flex min-h-[52px] items-center justify-center gap-2 rounded-lg border-2 px-3 py-3 text-sm font-medium transition-all",
                carrier === c.id
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <Truck className="h-4 w-4" />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tracking number */}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">
          Tracking Number
        </p>
        <div className="flex gap-2">
          <Input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Enter or scan tracking number"
            className="h-12 flex-1 text-base"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setScannerOpen(true)}
            className="h-12 w-12 shrink-0 border-2 border-blue-200 bg-blue-50 p-0 hover:border-blue-400 hover:bg-blue-100"
            title="Scan barcode"
          >
            <ScanBarcode className="h-5 w-5 text-blue-600" />
          </Button>
        </div>
        <BarcodeScanner
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          onScan={(value) => {
            setTrackingNumber(value);
            toast.success("Barcode scanned successfully!");
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="h-12 flex-1 bg-green-600 text-base font-semibold hover:bg-green-700"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Shipping...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Confirm Ship
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="h-12"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// -- Order card --

interface OrderCardProps {
  order: PortalOrder;
  onShipped: () => void;
}

function OrderCard({ order, onShipped }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const hours = getHoursSinceAssigned(order.assignedAt);
  const urgency = getUrgencyBadge(hours);
  const urgencyBorder = getUrgencyColor(hours);

  const timeAgo = order.assignedAt
    ? formatDistanceToNow(new Date(order.assignedAt), { addSuffix: true })
    : "Not assigned yet";

  function handleShipSuccess(): void {
    setExpanded(false);
    setShowSuccess(true);
    toast.success(`Order ${order.orderNumber} marked as shipped!`);
    setTimeout(() => {
      onShipped();
    }, 1500);
  }

  // Success state with celebration animation
  if (showSuccess) {
    return (
      <Card className="overflow-hidden border-2 border-green-400 transition-all duration-500">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10">
          <div className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <p className="text-lg font-bold text-green-700">Shipped!</p>
          <p className="text-sm text-slate-500">
            Order {order.orderNumber} is on its way
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden border-2 transition-all", urgencyBorder)}>
      <CardContent className="p-4 sm:p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">
                {order.orderNumber}
              </h3>
              <Badge variant="outline" className={urgency.className}>
                {urgency.label}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-slate-600">
              {order.customerName}
            </p>
          </div>
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <Clock className="h-4 w-4" />
            <span>{timeAgo}</span>
          </div>
        </div>

        {/* Order details */}
        <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-white/60 p-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-slate-400">Product</p>
            <p className="text-sm font-semibold text-slate-800">
              {order.product.name}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">SKU</p>
            <p className="text-sm font-semibold text-slate-800">
              {order.product.sku}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Qty</p>
            <p className="text-sm font-semibold text-slate-800">
              {order.quantity} units
            </p>
          </div>
        </div>

        {/* Ship button or form */}
        {!expanded ? (
          <Button
            onClick={() => setExpanded(true)}
            className="mt-4 h-14 w-full bg-blue-600 text-base font-bold hover:bg-blue-700"
          >
            <Truck className="mr-2 h-5 w-5" />
            MARK AS SHIPPED
            <ChevronDown className="ml-2 h-5 w-5" />
          </Button>
        ) : (
          <ShippingForm
            orderId={order.id}
            onSuccess={handleShipSuccess}
            onCancel={() => setExpanded(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}

// -- Main dashboard --

export function PortalDashboard({
  manufacturerName,
  orders: initialOrders,
  recentlyShipped = [],
  stats,
}: PortalDashboardProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<PortalOrder[]>(initialOrders);

  // Keep orders in sync when server data changes
  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const handleOrderShipped = useCallback(
    function handleOrderShipped(orderId: string): void {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      router.refresh();
    },
    [router]
  );

  const formatResponseTime = useCallback(function formatResponseTime(
    hours: number
  ): string {
    if (hours < 1) return "< 1h";
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  }, []);

  return (
    <div className="space-y-6 pb-10">
      {/* Hero section */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-white shadow-lg sm:p-8">
        <p className="text-sm font-medium text-blue-200">Welcome back</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
          {manufacturerName}
        </h1>
        <p className="mt-3 text-lg text-blue-100 sm:text-xl">
          {orders.length === 0
            ? "All caught up! No pending orders."
            : `You have ${orders.length} order${orders.length === 1 ? "" : "s"} waiting`}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Orders"
          value={stats.totalOrders}
          icon={Package}
          accent="bg-blue-600"
        />
        <StatCard
          label="Shipped Today"
          value={stats.shippedToday}
          icon={Truck}
          accent="bg-green-600"
        />
        <StatCard
          label="Pending"
          value={orders.length}
          icon={Clock}
          accent="bg-yellow-500"
        />
        <StatCard
          label="Avg Response"
          value={formatResponseTime(stats.avgResponseHours)}
          icon={CheckCircle2}
          accent="bg-purple-600"
        />
      </div>

      {/* Orders list */}
      {orders.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Pending Orders</h2>
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onShipped={() => handleOrderShipped(order.id)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {orders.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-800">
              All orders shipped!
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Check back later for new orders.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recently Shipped Orders */}
      {recentlyShipped.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-800">Recently Shipped</h2>
          {recentlyShipped.map((order) => (
            <Card key={order.id} className="border bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{order.orderNumber}</h3>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {order.status === "DELIVERED" ? "Delivered" : "Shipped"}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {order.product.name} &middot; {order.quantity} units &middot; {order.customerName}
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-500 shrink-0 ml-4">
                    {order.carrier && (
                      <p className="font-medium text-slate-700">{order.carrier}</p>
                    )}
                    {order.trackingNumber && (
                      <p className="text-xs font-mono">{order.trackingNumber}</p>
                    )}
                    {order.shippedAt && (
                      <p className="text-xs mt-0.5">
                        {formatDistanceToNow(new Date(order.shippedAt), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
