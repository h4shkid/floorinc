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

  const alert = await prisma.alert.create({
    data: {
      type: "ESCALATION",
      severity: "CRITICAL",
      title: `Order ${order.orderNumber} Escalated`,
      message: `Order ${order.orderNumber} for ${order.customerName} has been escalated and requires immediate attention.`,
      orderId: order.id,
      manufacturerId: order.manufacturerId,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "ALERT_CREATED",
      details: `Escalation alert created for order ${order.orderNumber}`,
      orderId: order.id,
    },
  });

  return NextResponse.json(alert, { status: 201 });
}
