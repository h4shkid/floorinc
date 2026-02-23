import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const body = await request.json();

  const alert = await prisma.alert.findUnique({ where: { id } });

  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.resolved === true) {
    updateData.resolved = true;
    updateData.resolvedAt = new Date();
    if (body.resolvedBy) {
      updateData.resolvedBy = body.resolvedBy;
    }
  }

  const updated = await prisma.alert.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}
