import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: { id: string };
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const body = await request.json();
  const { carrier, trackingNumber } = body;

  if (!carrier || !trackingNumber) {
    return NextResponse.json(
      { error: "carrier and trackingNumber are required" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: {
      carrier,
      trackingNumber,
      status: "SHIPPED",
      shippedAt: new Date(),
    },
    include: {
      product: true,
      manufacturer: true,
    },
  });

  await prisma.emailLog.create({
    data: {
      type: "SHIPPING_NOTIFICATION",
      subject: `Order ${order.orderNumber} has shipped`,
      body: `Order ${order.orderNumber} has been shipped via ${carrier}. Tracking number: ${trackingNumber}`,
      recipient: order.customerEmail,
      orderId: order.id,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "ORDER_SHIPPED",
      details: `Order ${order.orderNumber} shipped via ${carrier} (${trackingNumber})`,
      orderId: order.id,
    },
  });

  return NextResponse.json(updated);
}
