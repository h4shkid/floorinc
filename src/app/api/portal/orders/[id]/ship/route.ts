import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as {
    id: string;
    manufacturerId?: string | null;
  };

  if (!user.manufacturerId) {
    return NextResponse.json(
      { error: "No manufacturer associated with this account" },
      { status: 403 }
    );
  }

  const { id } = params;

  // Verify the order belongs to this manufacturer and is in a shippable state
  const order = await prisma.order.findFirst({
    where: {
      id,
      manufacturerId: user.manufacturerId,
      status: { in: ["ASSIGNED", "NOTIFIED", "DELAYED"] },
    },
  });

  if (!order) {
    return NextResponse.json(
      { error: "Order not found or not eligible for shipping" },
      { status: 404 }
    );
  }

  const body = await request.json();
  const { carrier, trackingNumber } = body;

  if (!carrier || !trackingNumber) {
    return NextResponse.json(
      { error: "Carrier and tracking number are required" },
      { status: 400 }
    );
  }

  // Update order to shipped
  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      status: "SHIPPED",
      carrier,
      trackingNumber,
      shippedAt: new Date(),
    },
  });

  // Log the activity
  await prisma.activityLog.create({
    data: {
      action: "ORDER_SHIPPED",
      details: `Order ${order.orderNumber} shipped via ${carrier} (tracking: ${trackingNumber})`,
      userId: user.id,
      orderId: id,
    },
  });

  return NextResponse.json(updatedOrder);
}
