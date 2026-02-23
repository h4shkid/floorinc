import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalDashboard } from "@/components/portal/portal-dashboard";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as {
    id: string;
    manufacturerId?: string | null;
    manufacturerName?: string | null;
  };

  if (!user.manufacturerId) {
    redirect("/login");
  }

  const pendingStatuses = ["ASSIGNED", "NOTIFIED", "DELAYED"];

  // Fetch pending orders and stats in parallel
  const [pendingOrders, totalOrders, shippedToday, shippedOrders, recentlyShipped] =
    await Promise.all([
      prisma.order.findMany({
        where: {
          manufacturerId: user.manufacturerId,
          status: { in: pendingStatuses },
        },
        include: {
          product: { select: { name: true, sku: true, category: true } },
        },
        orderBy: { assignedAt: "asc" },
      }),

      prisma.order.count({
        where: { manufacturerId: user.manufacturerId },
      }),

      prisma.order.count({
        where: {
          manufacturerId: user.manufacturerId,
          status: "SHIPPED",
          shippedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),

      // For average response time: orders shipped in last 30 days
      prisma.order.findMany({
        where: {
          manufacturerId: user.manufacturerId,
          status: { in: ["SHIPPED", "DELIVERED"] },
          shippedAt: { not: null },
          assignedAt: { not: null },
        },
        select: { assignedAt: true, shippedAt: true },
        take: 100,
        orderBy: { shippedAt: "desc" },
      }),

      // Recently shipped orders for the "Shipped Orders" section
      prisma.order.findMany({
        where: {
          manufacturerId: user.manufacturerId,
          status: { in: ["SHIPPED", "DELIVERED"] },
        },
        include: {
          product: { select: { name: true, sku: true, category: true } },
        },
        orderBy: { shippedAt: "desc" },
        take: 10,
      }),
    ]);

  // Calculate average response time in hours
  let avgResponseHours = 0;
  if (shippedOrders.length > 0) {
    const totalHours = shippedOrders.reduce((sum, order) => {
      if (!order.assignedAt || !order.shippedAt) return sum;
      const diff =
        new Date(order.shippedAt).getTime() -
        new Date(order.assignedAt).getTime();
      return sum + diff / (1000 * 60 * 60);
    }, 0);
    avgResponseHours = totalHours / shippedOrders.length;
  }

  // Serialize dates for client component
  const serializedOrders = pendingOrders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    quantity: order.quantity,
    totalPrice: order.totalPrice,
    status: order.status,
    priority: order.priority,
    assignedAt: order.assignedAt?.toISOString() ?? null,
    shippingAddress: order.shippingAddress,
    product: order.product,
  }));

  const serializedShipped = recentlyShipped.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    quantity: order.quantity,
    status: order.status,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    product: order.product,
  }));

  return (
    <PortalDashboard
      manufacturerName={user.manufacturerName ?? "Manufacturer"}
      orders={serializedOrders}
      recentlyShipped={serializedShipped}
      stats={{
        totalOrders,
        shippedToday,
        pendingCount: pendingOrders.length,
        avgResponseHours: Math.round(avgResponseHours * 10) / 10,
      }}
    />
  );
}
