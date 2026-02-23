import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { manufacturerId?: string | null };

  if (!user.manufacturerId) {
    return NextResponse.json(
      { error: "No manufacturer associated with this account" },
      { status: 403 }
    );
  }

  const orders = await prisma.order.findMany({
    where: {
      manufacturerId: user.manufacturerId,
      status: { in: ["ASSIGNED", "NOTIFIED", "DELAYED"] },
    },
    include: {
      product: { select: { name: true, sku: true, category: true } },
    },
    orderBy: { assignedAt: "asc" },
  });

  return NextResponse.json(orders);
}
