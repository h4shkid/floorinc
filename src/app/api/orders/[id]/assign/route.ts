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
  const { manufacturerId } = body;

  if (!manufacturerId) {
    return NextResponse.json(
      { error: "manufacturerId is required" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { id: manufacturerId },
  });

  if (!manufacturer) {
    return NextResponse.json(
      { error: "Manufacturer not found" },
      { status: 404 }
    );
  }

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: {
      manufacturerId,
      status: "ASSIGNED",
      assignedAt: new Date(),
    },
    include: {
      product: true,
      manufacturer: true,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "ORDER_ASSIGNED",
      details: `Order ${order.orderNumber} assigned to ${manufacturer.name}`,
      orderId: order.id,
    },
  });

  return NextResponse.json(updated);
}
