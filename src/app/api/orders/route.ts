import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const manufacturer = searchParams.get("manufacturer");

  const where: Record<string, string> = {};
  if (status) where.status = status;
  if (source) where.source = source;
  if (manufacturer) where.manufacturerId = manufacturer;

  const orders = await prisma.order.findMany({
    where,
    include: {
      product: true,
      manufacturer: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();

  const {
    orderNumber,
    customerName,
    customerEmail,
    customerPhone,
    shippingAddress,
    source,
    priority,
    quantity,
    totalPrice,
    productId,
    notes,
  } = body;

  if (!orderNumber || !customerName || !customerEmail || !productId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerName,
      customerEmail,
      customerPhone: customerPhone ?? "",
      shippingAddress: shippingAddress ?? "",
      source: source ?? "WEBSITE",
      priority: priority ?? "NORMAL",
      quantity: quantity ?? 1,
      totalPrice: totalPrice ?? 0,
      productId,
      notes,
    },
    include: {
      product: true,
      manufacturer: true,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "ORDER_CREATED",
      details: `Order ${order.orderNumber} created`,
      orderId: order.id,
    },
  });

  return NextResponse.json(order, { status: 201 });
}
