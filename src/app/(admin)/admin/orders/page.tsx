import { prisma } from "@/lib/prisma";
import { OrdersTable } from "@/components/admin/orders-table";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const [orders, manufacturers] = await Promise.all([
    prisma.order.findMany({
      include: {
        product: true,
        manufacturer: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.manufacturer.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedOrders = orders.map((order) => ({
    ...order,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    assignedAt: order.assignedAt?.toISOString() ?? null,
    notifiedAt: order.notifiedAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    estimatedShip: order.estimatedShip?.toISOString() ?? null,
    product: {
      ...order.product,
      createdAt: order.product.createdAt.toISOString(),
      updatedAt: order.product.updatedAt.toISOString(),
    },
    manufacturer: order.manufacturer
      ? {
          ...order.manufacturer,
          createdAt: order.manufacturer.createdAt.toISOString(),
          updatedAt: order.manufacturer.updatedAt.toISOString(),
        }
      : null,
  }));

  const manufacturerOptions = manufacturers.map((m) => ({
    id: m.id,
    name: m.name,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">
          Manage and track all customer orders across all channels.
        </p>
      </div>

      <OrdersTable orders={serializedOrders} manufacturers={manufacturerOptions} />
    </div>
  );
}
