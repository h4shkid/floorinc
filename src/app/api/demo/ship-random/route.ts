import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CARRIERS = ["FedEx", "UPS", "USPS", "XPO Logistics", "Old Dominion", "R+L Carriers"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function POST(): Promise<NextResponse> {
  const eligibleOrders = await prisma.order.findMany({
    where: {
      status: { in: ["ASSIGNED", "NOTIFIED"] },
    },
    include: {
      product: true,
      manufacturer: true,
    },
  });

  if (eligibleOrders.length === 0) {
    return NextResponse.json(
      { error: "No eligible orders to ship. All orders are already shipped or unassigned." },
      { status: 400 }
    );
  }

  const order = pick(eligibleOrders);
  const carrier = pick(CARRIERS);
  const trackingNumber = `${carrier.substring(0, 3).toUpperCase()}${randInt(100000000, 999999999)}`;

  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "SHIPPED",
      carrier,
      trackingNumber,
      shippedAt: new Date(),
    },
    include: {
      product: true,
      manufacturer: true,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "ORDER_SHIPPED",
      details: `Demo: Order ${order.orderNumber} shipped via ${carrier} (${trackingNumber})`,
      orderId: order.id,
    },
  });

  if (order.manufacturer) {
    await prisma.emailLog.create({
      data: {
        type: "SHIPPING_NOTIFICATION",
        subject: `Order ${order.orderNumber} Shipped - ${carrier}`,
        body: `Your order ${order.orderNumber} has been shipped via ${carrier}.\nTracking: ${trackingNumber}`,
        recipient: order.customerEmail,
        orderId: order.id,
        manufacturerId: order.manufacturer.id,
        status: "SENT",
      },
    });
  }

  return NextResponse.json(updatedOrder);
}
