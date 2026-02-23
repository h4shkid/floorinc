import { NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getStats() {
  const [totalOrders, pendingOrders, activeAlerts, deliveredOrders] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.count({
        where: { status: { in: ["RECEIVED", "ASSIGNED"] } },
      }),
      prisma.alert.count({ where: { resolved: false } }),
      prisma.order.findMany({
        where: {
          status: "DELIVERED",
          deliveredAt: { not: null },
        },
        select: { createdAt: true, deliveredAt: true, estimatedShip: true },
      }),
    ]);

  let avgFulfillment = 0;
  let onTimeRate = 0;

  if (deliveredOrders.length > 0) {
    const totalDays = deliveredOrders.reduce((sum, order) => {
      const created = new Date(order.createdAt).getTime();
      const delivered = new Date(order.deliveredAt!).getTime();
      const days = (delivered - created) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);
    avgFulfillment = Math.round((totalDays / deliveredOrders.length) * 10) / 10;

    const onTimeCount = deliveredOrders.filter((order) => {
      if (!order.estimatedShip) return true;
      return new Date(order.deliveredAt!) <= new Date(order.estimatedShip);
    }).length;
    onTimeRate = Math.round((onTimeCount / deliveredOrders.length) * 100);
  }

  return { totalOrders, pendingOrders, activeAlerts, avgFulfillment, onTimeRate };
}

async function getOrdersBySource() {
  const sources = ["AMAZON", "WEBSITE", "WAYFAIR", "HOME_DEPOT"];
  const counts = await Promise.all(
    sources.map(async (source) => ({
      name: source,
      value: await prisma.order.count({ where: { source } }),
    }))
  );
  return counts.filter((item) => item.value > 0);
}

async function getOrdersByStatus() {
  const statuses = [
    "RECEIVED",
    "ASSIGNED",
    "NOTIFIED",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "DELAYED",
  ];
  const counts = await Promise.all(
    statuses.map(async (status) => ({
      name: status,
      value: await prisma.order.count({ where: { status } }),
    }))
  );
  return counts.filter((item) => item.value > 0);
}

async function getFulfillmentTrend() {
  const days = 14;
  const result: { date: string; avgDays: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = subDays(new Date(), i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const delivered = await prisma.order.findMany({
      where: {
        deliveredAt: { gte: dayStart, lte: dayEnd },
      },
      select: { createdAt: true, deliveredAt: true },
    });

    let avgDays = 0;
    if (delivered.length > 0) {
      const totalMs = delivered.reduce((sum, o) => {
        return (
          sum +
          (new Date(o.deliveredAt!).getTime() - new Date(o.createdAt).getTime())
        );
      }, 0);
      avgDays =
        Math.round((totalMs / delivered.length / (1000 * 60 * 60 * 24)) * 10) /
        10;
    }

    result.push({ date: format(dayStart, "MM/dd"), avgDays });
  }

  return result;
}

async function getOrderVolume() {
  const days = 14;
  const result: { date: string; orders: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = subDays(new Date(), i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const count = await prisma.order.count({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
    });

    result.push({ date: format(dayStart, "MM/dd"), orders: count });
  }

  return result;
}

export async function GET() {
  const [stats, ordersBySource, ordersByStatus, fulfillmentTrend, orderVolume] =
    await Promise.all([
      getStats(),
      getOrdersBySource(),
      getOrdersByStatus(),
      getFulfillmentTrend(),
      getOrderVolume(),
    ]);

  return NextResponse.json({
    stats,
    charts: {
      ordersBySource,
      ordersByStatus,
      fulfillmentTrend,
      orderVolume,
    },
  });
}
