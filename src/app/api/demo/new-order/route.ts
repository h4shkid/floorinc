import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Christopher", "Karen", "Charles", "Lisa", "Daniel", "Nancy",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas",
  "Taylor", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris",
];

const STREETS = [
  "Oak St", "Maple Ave", "Cedar Ln", "Pine Dr", "Elm St", "Washington Blvd",
  "Park Ave", "Lake Rd", "Hill St", "River Rd", "Main St", "Broadway",
];

const CITIES = [
  "Austin, TX", "Denver, CO", "Portland, OR", "Nashville, TN", "Charlotte, NC",
  "San Diego, CA", "Phoenix, AZ", "Dallas, TX", "Atlanta, GA", "Seattle, WA",
];

const SOURCES = ["AMAZON", "WEBSITE", "WAYFAIR", "HOME_DEPOT"];
const PRIORITIES = ["LOW", "NORMAL", "NORMAL", "NORMAL", "HIGH", "URGENT"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function POST(): Promise<NextResponse> {
  const products = await prisma.product.findMany({
    take: 50,
    include: { manufacturer: true },
  });

  if (products.length === 0) {
    return NextResponse.json(
      { error: "No products found. Run the seed script first." },
      { status: 400 }
    );
  }

  const product = pick(products);
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const customerName = `${firstName} ${lastName}`;
  const quantity = randInt(50, 500);
  const totalPrice = Math.round(quantity * product.price * 100) / 100;

  const orderCount = await prisma.order.count();
  const orderNumber = `FI-${new Date().getFullYear().toString().slice(2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(orderCount + 1).padStart(4, "0")}`;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerName,
      customerEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randInt(1, 999)}@email.com`,
      customerPhone: `(${randInt(200, 999)}) ${randInt(200, 999)}-${randInt(1000, 9999)}`,
      shippingAddress: `${randInt(100, 9999)} ${pick(STREETS)}, ${pick(CITIES)} ${randInt(10000, 99999)}`,
      source: pick(SOURCES),
      status: "RECEIVED",
      priority: pick(PRIORITIES),
      quantity,
      totalPrice,
      productId: product.id,
      estimatedShip: new Date(Date.now() + randInt(48, 120) * 3600000),
    },
    include: {
      product: true,
      manufacturer: true,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "ORDER_CREATED",
      details: `Demo: Order ${order.orderNumber} created from ${order.source} - ${order.customerName}`,
      orderId: order.id,
    },
  });

  return NextResponse.json(order, { status: 201 });
}
