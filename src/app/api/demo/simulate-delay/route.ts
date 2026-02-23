import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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
      { error: "No eligible orders to delay. No orders are currently assigned or notified." },
      { status: 400 }
    );
  }

  const order = pick(eligibleOrders);
  const severity = pick(["CRITICAL", "HIGH"]);

  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "DELAYED",
      priority: "URGENT",
    },
  });

  const alert = await prisma.alert.create({
    data: {
      type: "DELAY",
      severity,
      title: `Order ${order.orderNumber} is delayed`,
      message: `Order has exceeded expected fulfillment time. Customer ${order.customerName} may need to be notified.`,
      orderId: order.id,
      manufacturerId: order.manufacturerId,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "ALERT_CREATED",
      details: `Demo: Delay alert created for order ${order.orderNumber} (${severity})`,
      orderId: order.id,
    },
  });

  if (order.manufacturer) {
    await prisma.emailLog.create({
      data: {
        type: "DELAY_ALERT",
        subject: `URGENT: Order ${order.orderNumber} Delayed`,
        body: `Order ${order.orderNumber} has exceeded the expected shipping window. Please provide an update on the status immediately.`,
        recipient: order.manufacturer.contactEmail,
        orderId: order.id,
        manufacturerId: order.manufacturer.id,
        status: "SENT",
      },
    });
  }

  return NextResponse.json({
    order: updatedOrder,
    alert,
  });
}
