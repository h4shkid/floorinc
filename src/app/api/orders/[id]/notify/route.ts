import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: { id: string };
}

export async function POST(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { manufacturer: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!order.manufacturer) {
    return NextResponse.json(
      { error: "Order must be assigned to a manufacturer before notifying" },
      { status: 400 }
    );
  }

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: {
      status: "NOTIFIED",
      notifiedAt: new Date(),
    },
    include: {
      product: true,
      manufacturer: true,
    },
  });

  await prisma.emailLog.create({
    data: {
      type: "SHIPPING_NOTIFICATION",
      subject: `Order ${order.orderNumber} - Manufacturer Notified`,
      body: `Manufacturer ${order.manufacturer.name} has been notified about order ${order.orderNumber}.`,
      recipient: order.manufacturer.contactEmail,
      orderId: order.id,
      manufacturerId: order.manufacturer.id,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "EMAIL_SENT",
      details: `Notification sent to ${order.manufacturer.name} for order ${order.orderNumber}`,
      orderId: order.id,
    },
  });

  return NextResponse.json(updated);
}
