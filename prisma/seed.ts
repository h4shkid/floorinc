import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

// Seeded PRNG for deterministic data
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function pickWeighted<T>(arr: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return Math.round((rand() * (max - min) + min) * 100) / 100;
}

function daysAgo(days: number): Date {
  const d = new Date("2026-02-23T12:00:00Z");
  d.setDate(d.getDate() - days);
  d.setHours(randInt(6, 20), randInt(0, 59), randInt(0, 59));
  return d;
}

function hoursAfter(base: Date, hours: number): Date {
  const d = new Date(base);
  d.setTime(d.getTime() + hours * 3600000);
  return d;
}

const FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Christopher", "Karen", "Charles", "Lisa", "Daniel", "Nancy",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
];

const STREETS = [
  "Oak St", "Maple Ave", "Cedar Ln", "Pine Dr", "Elm St", "Washington Blvd",
  "Park Ave", "Lake Rd", "Hill St", "River Rd", "Main St", "Broadway",
  "Sunset Blvd", "Highland Ave", "Forest Dr", "Meadow Ln", "Spring St",
];

const CITIES = [
  "Austin, TX", "Denver, CO", "Portland, OR", "Nashville, TN", "Charlotte, NC",
  "San Diego, CA", "Phoenix, AZ", "Dallas, TX", "Atlanta, GA", "Seattle, WA",
  "Tampa, FL", "Minneapolis, MN", "Raleigh, NC", "Columbus, OH", "Miami, FL",
];

function randomName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function randomEmail(name: string): string {
  return `${name.toLowerCase().replace(" ", ".")}${randInt(1, 999)}@email.com`;
}

function randomPhone(): string {
  return `(${randInt(200, 999)}) ${randInt(200, 999)}-${randInt(1000, 9999)}`;
}

function randomAddress(): string {
  return `${randInt(100, 9999)} ${pick(STREETS)}, ${pick(CITIES)} ${randInt(10000, 99999)}`;
}

// Manufacturers data - 10 across different US states per spec
const MANUFACTURERS = [
  // Excellent (3)
  { name: "Shaw Flooring", contact: "Mike Reynolds", location: "Dalton, Georgia", rating: "EXCELLENT", avgFulfill: 1.8, onTime: 98 },
  { name: "Mohawk Industries", contact: "Sarah Chen", location: "Dallas, Texas", rating: "EXCELLENT", avgFulfill: 2.1, onTime: 96 },
  { name: "Armstrong Flooring", contact: "David Park", location: "Lancaster, Pennsylvania", rating: "EXCELLENT", avgFulfill: 2.3, onTime: 95 },
  // Good (4)
  { name: "Mannington Mills", contact: "Lisa Torres", location: "Salem, North Carolina", rating: "GOOD", avgFulfill: 3.2, onTime: 88 },
  { name: "Tarkett NA", contact: "James Wilson", location: "Florence, Alabama", rating: "GOOD", avgFulfill: 3.5, onTime: 85 },
  { name: "Lumber Liquidators", contact: "Karen White", location: "Milwaukee, Wisconsin", rating: "GOOD", avgFulfill: 3.8, onTime: 82 },
  { name: "Pergo Flooring", contact: "Tom Martinez", location: "Calhoun, Georgia", rating: "GOOD", avgFulfill: 3.4, onTime: 86 },
  // Struggling (2)
  { name: "US Floors Direct", contact: "Bob Anderson", location: "Phoenix, Arizona", rating: "FAIR", avgFulfill: 5.2, onTime: 68 },
  { name: "Pacific Coast Floors", contact: "Amy Lee", location: "Los Angeles, California", rating: "FAIR", avgFulfill: 5.8, onTime: 62 },
  // Problematic (1)
  { name: "Budget Flooring Co", contact: "Rick Thompson", location: "Detroit, Michigan", rating: "POOR", avgFulfill: 7.5, onTime: 45 },
];

const PRODUCTS_DATA: { name: string; category: string; priceRange: [number, number] }[] = [
  // Hardwood (12)
  { name: "Classic Oak Hardwood 5\"", category: "HARDWOOD", priceRange: [4.29, 6.99] },
  { name: "Hickory Natural Plank", category: "HARDWOOD", priceRange: [5.49, 8.29] },
  { name: "Brazilian Cherry Wide", category: "HARDWOOD", priceRange: [6.99, 9.49] },
  { name: "Walnut Heritage 3/4\"", category: "HARDWOOD", priceRange: [7.29, 10.99] },
  { name: "Maple Select Grade", category: "HARDWOOD", priceRange: [4.99, 7.49] },
  { name: "White Oak Engineered", category: "HARDWOOD", priceRange: [5.99, 8.99] },
  { name: "Ash Rustic Handscraped", category: "HARDWOOD", priceRange: [6.49, 9.29] },
  { name: "Bamboo Strand Woven", category: "HARDWOOD", priceRange: [3.99, 5.99] },
  { name: "Acacia Exotic Plank", category: "HARDWOOD", priceRange: [5.29, 7.99] },
  { name: "Red Oak Traditional", category: "HARDWOOD", priceRange: [3.79, 5.49] },
  { name: "Birch Contemporary", category: "HARDWOOD", priceRange: [4.49, 6.79] },
  { name: "Teak Premium Board", category: "HARDWOOD", priceRange: [8.99, 12.49] },
  // Laminate (10)
  { name: "Pergo TimberCraft Oak", category: "LAMINATE", priceRange: [2.49, 3.99] },
  { name: "Waterproof Laminate Plus", category: "LAMINATE", priceRange: [2.99, 4.49] },
  { name: "Quick-Step Impressive", category: "LAMINATE", priceRange: [2.29, 3.79] },
  { name: "Euro Oak Laminate 12mm", category: "LAMINATE", priceRange: [1.99, 3.29] },
  { name: "Stone Look Laminate", category: "LAMINATE", priceRange: [2.79, 4.29] },
  { name: "Rustic Barnwood Laminate", category: "LAMINATE", priceRange: [2.49, 3.99] },
  { name: "High-Traffic Commercial", category: "LAMINATE", priceRange: [3.29, 4.99] },
  { name: "Hand-Scraped Walnut Lam", category: "LAMINATE", priceRange: [2.69, 4.19] },
  { name: "Smooth Maple Laminate", category: "LAMINATE", priceRange: [1.89, 2.99] },
  { name: "Chevron Pattern Laminate", category: "LAMINATE", priceRange: [3.49, 5.29] },
  // Vinyl (10)
  { name: "Luxury Vinyl Plank Oak", category: "VINYL", priceRange: [2.99, 4.99] },
  { name: "SPC Rigid Core Hickory", category: "VINYL", priceRange: [3.49, 5.49] },
  { name: "WPC Waterproof Vinyl", category: "VINYL", priceRange: [3.29, 5.29] },
  { name: "Peel & Stick Vinyl Tile", category: "VINYL", priceRange: [1.29, 2.49] },
  { name: "Sheet Vinyl Classic", category: "VINYL", priceRange: [0.99, 1.99] },
  { name: "Stone Core LVP Premium", category: "VINYL", priceRange: [3.99, 5.99] },
  { name: "Herringbone Vinyl Plank", category: "VINYL", priceRange: [3.79, 5.79] },
  { name: "Commercial Grade LVT", category: "VINYL", priceRange: [4.29, 6.49] },
  { name: "Click-Lock Vinyl Walnut", category: "VINYL", priceRange: [2.79, 4.29] },
  { name: "Wide Plank Vinyl Oak", category: "VINYL", priceRange: [3.19, 4.99] },
  // Tile (10)
  { name: "Porcelain Wood-Look 6x36", category: "TILE", priceRange: [2.99, 4.99] },
  { name: "Marble Mosaic Hexagon", category: "TILE", priceRange: [8.99, 14.99] },
  { name: "Subway Ceramic White 3x6", category: "TILE", priceRange: [0.99, 1.99] },
  { name: "Slate Natural Stone 12x12", category: "TILE", priceRange: [4.49, 6.99] },
  { name: "Large Format Porcelain 24x48", category: "TILE", priceRange: [5.99, 8.99] },
  { name: "Travertine Tumbled 18x18", category: "TILE", priceRange: [6.49, 9.49] },
  { name: "Glass Mosaic Backsplash", category: "TILE", priceRange: [9.99, 15.99] },
  { name: "Cement Look Porcelain", category: "TILE", priceRange: [3.99, 5.99] },
  // Carpet (8)
  { name: "Plush Saxony Carpet", category: "CARPET", priceRange: [1.99, 3.49] },
  { name: "Berber Loop Commercial", category: "CARPET", priceRange: [1.49, 2.99] },
  { name: "Frieze Textured Carpet", category: "CARPET", priceRange: [2.29, 3.79] },
  { name: "Carpet Tile 24x24 Modular", category: "CARPET", priceRange: [3.99, 6.49] },
  { name: "Stain-Resistant Nylon", category: "CARPET", priceRange: [2.49, 4.29] },
  { name: "Wool Blend Premium", category: "CARPET", priceRange: [5.99, 9.99] },
  { name: "Indoor/Outdoor Carpet", category: "CARPET", priceRange: [1.29, 2.49] },
  { name: "Pattern Loop Carpet", category: "CARPET", priceRange: [2.79, 4.49] },
];

const CARRIERS = ["FedEx", "UPS", "USPS", "XPO Logistics", "Old Dominion", "R+L Carriers"];

async function main() {
  console.log("Cleaning database...");
  await prisma.activityLog.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.manufacturer.deleteMany();

  console.log("Creating manufacturers...");
  const manufacturers = [];
  for (const m of MANUFACTURERS) {
    const mfg = await prisma.manufacturer.create({
      data: {
        name: m.name,
        location: m.location,
        contactName: m.contact,
        contactEmail: `${m.contact.toLowerCase().replace(" ", ".")}@${m.name.toLowerCase().replace(/\s+/g, "")}.com`,
        contactPhone: randomPhone(),
        avgFulfillment: m.avgFulfill,
        onTimeRate: m.onTime,
        rating: m.rating,
        status: "ACTIVE",
      },
    });
    manufacturers.push(mfg);
  }
  console.log(`Created ${manufacturers.length} manufacturers`);

  console.log("Creating users...");
  const hashedPassword = hashSync("demo123", 10);

  await prisma.user.create({
    data: {
      email: "admin@floorinc.com",
      name: "Kurt Admin",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  await prisma.user.create({
    data: {
      email: "kurt@floorinc.com",
      name: "Kurt Fletcher",
      password: hashedPassword,
      role: "SUPER_ADMIN",
    },
  });

  // Manufacturer users - matching spec demo accounts
  // Wisconsin = Lumber Liquidators (index 5)
  await prisma.user.create({
    data: {
      email: "wisconsin@manufacturer.com",
      name: manufacturers[5].contactName,
      password: hashedPassword,
      role: "MANUFACTURER",
      manufacturerId: manufacturers[5].id,
    },
  });

  // Texas = Mohawk Industries (index 1)
  await prisma.user.create({
    data: {
      email: "texas@manufacturer.com",
      name: manufacturers[1].contactName,
      password: hashedPassword,
      role: "MANUFACTURER",
      manufacturerId: manufacturers[1].id,
    },
  });

  // California = Pacific Coast Floors (index 8)
  await prisma.user.create({
    data: {
      email: "california@manufacturer.com",
      name: manufacturers[8].contactName,
      password: hashedPassword,
      role: "MANUFACTURER",
      manufacturerId: manufacturers[8].id,
    },
  });

  console.log("Created 5 users");

  console.log("Creating products...");
  const products = [];
  for (let i = 0; i < PRODUCTS_DATA.length; i++) {
    const p = PRODUCTS_DATA[i];
    const mfgIndex = i % manufacturers.length;
    const product = await prisma.product.create({
      data: {
        name: p.name,
        sku: `FLR-${p.category.substring(0, 3)}-${String(i + 1).padStart(4, "0")}`,
        category: p.category,
        price: randFloat(p.priceRange[0], p.priceRange[1]),
        manufacturerId: manufacturers[mfgIndex].id,
      },
    });
    products.push(product);
  }
  console.log(`Created ${products.length} products`);

  console.log("Creating orders...");
  const sources: [string, number][] = [
    ["AMAZON", 60],
    ["WEBSITE", 20],
    ["WAYFAIR", 10],
    ["HOME_DEPOT", 10],
  ];
  const sourceNames = sources.map((s) => s[0]);
  const sourceWeights = sources.map((s) => s[1]);

  const statuses = ["RECEIVED", "ASSIGNED", "NOTIFIED", "SHIPPED", "DELIVERED"];
  const statusWeights = [15, 10, 10, 25, 40]; // mostly delivered/shipped for a realistic look

  const orders = [];
  for (let i = 0; i < 220; i++) {
    const product = pick(products);
    const mfg = manufacturers.find((m) => m.id === product.manufacturerId)!;
    const source = pickWeighted(sourceNames, sourceWeights);
    const status = pickWeighted(statuses, statusWeights);
    const createdDaysAgo = randInt(1, 30);
    const createdAt = daysAgo(createdDaysAgo);
    const quantity = randInt(50, 500);
    const custName = randomName();
    const orderNum = `FI-${String(2026).substring(2)}${String(2).padStart(2, "0")}-${String(i + 1).padStart(4, "0")}`;

    // Build timeline based on status
    let assignedAt: Date | null = null;
    let notifiedAt: Date | null = null;
    let shippedAt: Date | null = null;
    let deliveredAt: Date | null = null;
    let estimatedShip: Date | null = hoursAfter(createdAt, randInt(48, 120));
    let carrier: string | null = null;
    let trackingNumber: string | null = null;
    let priority = pickWeighted(["LOW", "NORMAL", "HIGH", "URGENT"], [10, 60, 20, 10]);

    if (status === "ASSIGNED" || status === "NOTIFIED" || status === "SHIPPED" || status === "DELIVERED") {
      assignedAt = hoursAfter(createdAt, randInt(1, 8));
    }
    if (status === "NOTIFIED" || status === "SHIPPED" || status === "DELIVERED") {
      notifiedAt = hoursAfter(assignedAt!, randInt(1, 4));
    }
    if (status === "SHIPPED" || status === "DELIVERED") {
      const baseFulfill = mfg.name === "Budget Flooring Co" ? randInt(120, 200) : randInt(24, 96);
      shippedAt = hoursAfter(notifiedAt!, baseFulfill);
      carrier = pick(CARRIERS);
      trackingNumber = `${carrier.substring(0, 3).toUpperCase()}${randInt(100000000, 999999999)}`;
    }
    if (status === "DELIVERED") {
      deliveredAt = hoursAfter(shippedAt!, randInt(24, 96));
    }

    // Some orders are delayed
    let finalStatus = status;
    if (status === "ASSIGNED" || status === "NOTIFIED") {
      if (createdDaysAgo > 5 && rand() < 0.3) {
        finalStatus = "DELAYED";
        priority = "URGENT";
      }
    }

    const order = await prisma.order.create({
      data: {
        orderNumber: orderNum,
        customerName: custName,
        customerEmail: randomEmail(custName),
        customerPhone: randomPhone(),
        shippingAddress: randomAddress(),
        source,
        status: finalStatus,
        priority,
        quantity,
        totalPrice: Math.round(quantity * product.price * 100) / 100,
        productId: product.id,
        manufacturerId: mfg.id,
        assignedAt,
        notifiedAt,
        shippedAt,
        deliveredAt,
        estimatedShip,
        carrier,
        trackingNumber,
        createdAt,
        updatedAt: new Date(),
      },
    });
    orders.push(order);
  }
  console.log(`Created ${orders.length} orders`);

  // Add some RECEIVED orders (unassigned) for demo
  for (let i = 0; i < 15; i++) {
    const product = pick(products);
    const createdAt = daysAgo(randInt(0, 2));
    const quantity = randInt(50, 300);
    const custName = randomName();
    const orderNum = `FI-2602-${String(221 + i).padStart(4, "0")}`;

    await prisma.order.create({
      data: {
        orderNumber: orderNum,
        customerName: custName,
        customerEmail: randomEmail(custName),
        customerPhone: randomPhone(),
        shippingAddress: randomAddress(),
        source: pickWeighted(sourceNames, sourceWeights),
        status: "RECEIVED",
        priority: pickWeighted(["NORMAL", "HIGH", "URGENT"], [60, 30, 10]),
        quantity,
        totalPrice: Math.round(quantity * product.price * 100) / 100,
        productId: product.id,
        estimatedShip: hoursAfter(createdAt, randInt(48, 120)),
        createdAt,
        updatedAt: new Date(),
      },
    });
  }
  console.log("Created 15 unassigned orders");

  console.log("Creating alerts...");
  const delayedOrders = orders.filter((o) => o.status === "DELAYED");
  const pendingOrders = orders.filter((o) => o.status === "ASSIGNED" || o.status === "NOTIFIED");

  // Alerts for delayed orders
  for (const order of delayedOrders.slice(0, 8)) {
    await prisma.alert.create({
      data: {
        type: "DELAY",
        severity: pick(["CRITICAL", "HIGH"]),
        title: `Order ${order.orderNumber} is delayed`,
        message: `Order has exceeded expected fulfillment time. Customer ${order.customerName} may need to be notified.`,
        orderId: order.id,
        manufacturerId: order.manufacturerId,
        createdAt: daysAgo(randInt(0, 3)),
      },
    });
  }

  // Overdue alerts
  for (const order of pendingOrders.slice(0, 4)) {
    await prisma.alert.create({
      data: {
        type: "OVERDUE",
        severity: "HIGH",
        title: `Order ${order.orderNumber} overdue for shipment`,
        message: `Manufacturer has not shipped this order within the expected timeframe.`,
        orderId: order.id,
        manufacturerId: order.manufacturerId,
        createdAt: daysAgo(randInt(0, 2)),
      },
    });
  }

  // Quality alert
  await prisma.alert.create({
    data: {
      type: "QUALITY",
      severity: "MEDIUM",
      title: "Quality concern reported - Budget Flooring Co",
      message: "Customer reported warping issues with recent laminate shipment. Investigating batch quality.",
      manufacturerId: manufacturers[9].id, // Budget Flooring Co
      createdAt: daysAgo(1),
    },
  });

  // Stock alert
  await prisma.alert.create({
    data: {
      type: "STOCK",
      severity: "MEDIUM",
      title: "Low stock warning - Brazilian Cherry Wide",
      message: "Inventory levels below minimum threshold. May affect upcoming orders.",
      manufacturerId: manufacturers[2].id,
      createdAt: daysAgo(2),
    },
  });

  // Resolved alerts
  for (let i = 0; i < 5; i++) {
    await prisma.alert.create({
      data: {
        type: pick(["DELAY", "OVERDUE"]),
        severity: pick(["HIGH", "MEDIUM"]),
        title: `Resolved: Order delay issue #${i + 1}`,
        message: "Issue has been resolved. Shipment confirmed.",
        resolved: true,
        resolvedAt: daysAgo(randInt(1, 5)),
        resolvedBy: "admin@floorinc.com",
        orderId: orders[randInt(0, orders.length - 1)].id,
        createdAt: daysAgo(randInt(5, 10)),
      },
    });
  }
  console.log("Created alerts");

  console.log("Creating email logs...");
  const emailTypes = [
    { type: "ORDER_CONFIRMATION", subject: "Order Confirmed", template: "Your order has been received and confirmed." },
    { type: "SHIPPING_NOTIFICATION", subject: "Order Shipped", template: "Your order has been shipped." },
    { type: "DELAY_ALERT", subject: "Order Delay Notice", template: "We regret to inform you of a delay." },
    { type: "REMINDER", subject: "Shipment Reminder", template: "Reminder: Please ship the pending order." },
    { type: "ESCALATION", subject: "Order Escalation", template: "This order has been escalated for immediate attention." },
  ];

  // Create email logs for shipped/delivered orders
  const shippedOrDelivered = orders.filter((o) => o.status === "SHIPPED" || o.status === "DELIVERED");
  for (const order of shippedOrDelivered.slice(0, 60)) {
    const mfg = manufacturers.find((m) => m.id === order.manufacturerId)!;

    // Confirmation email
    await prisma.emailLog.create({
      data: {
        type: "ORDER_CONFIRMATION",
        subject: `Order ${order.orderNumber} Confirmed`,
        body: `Dear ${mfg.contactName},\n\nA new order ${order.orderNumber} has been assigned to ${mfg.name}. Please review and ship within the expected timeframe.\n\nQuantity: ${order.quantity} sq ft\nCustomer: ${order.customerName}\n\nThank you,\nFlooringInc Team`,
        recipient: mfg.contactEmail,
        orderId: order.id,
        manufacturerId: mfg.id,
        status: "DELIVERED",
        createdAt: order.assignedAt || order.createdAt,
      },
    });

    // Shipping notification
    if (order.shippedAt) {
      await prisma.emailLog.create({
        data: {
          type: "SHIPPING_NOTIFICATION",
          subject: `Order ${order.orderNumber} Shipped - ${order.carrier}`,
          body: `Dear ${order.customerName},\n\nYour order ${order.orderNumber} has been shipped via ${order.carrier}.\nTracking: ${order.trackingNumber}\n\nThank you for your purchase!\nFlooringInc Team`,
          recipient: order.customerEmail,
          orderId: order.id,
          manufacturerId: mfg.id,
          status: "DELIVERED",
          createdAt: order.shippedAt,
        },
      });
    }
  }

  // Delay/reminder emails
  for (const order of delayedOrders.slice(0, 5)) {
    const mfg = manufacturers.find((m) => m.id === order.manufacturerId);
    if (!mfg) continue;
    await prisma.emailLog.create({
      data: {
        type: "DELAY_ALERT",
        subject: `URGENT: Order ${order.orderNumber} Delayed`,
        body: `Dear ${mfg.contactName},\n\nOrder ${order.orderNumber} has exceeded the expected shipping window. Please provide an update on the status of this order immediately.\n\nFlooringInc Team`,
        recipient: mfg.contactEmail,
        orderId: order.id,
        manufacturerId: mfg.id,
        status: "DELIVERED",
        createdAt: daysAgo(randInt(0, 2)),
      },
    });
  }

  // Reminder emails
  for (const order of pendingOrders.slice(0, 8)) {
    const mfg = manufacturers.find((m) => m.id === order.manufacturerId);
    if (!mfg) continue;
    await prisma.emailLog.create({
      data: {
        type: "REMINDER",
        subject: `Reminder: Ship Order ${order.orderNumber}`,
        body: `Dear ${mfg.contactName},\n\nThis is a friendly reminder to ship order ${order.orderNumber} at your earliest convenience.\n\nFlooringInc Team`,
        recipient: mfg.contactEmail,
        orderId: order.id,
        manufacturerId: mfg.id,
        status: "DELIVERED",
        createdAt: daysAgo(randInt(0, 3)),
      },
    });
  }
  console.log("Created email logs");

  console.log("Creating activity logs...");
  // Activity for recent orders
  const recentOrders = orders.filter((o) => {
    const d = new Date("2026-02-23");
    const diff = (d.getTime() - o.createdAt.getTime()) / 86400000;
    return diff <= 7;
  });

  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });

  for (const order of recentOrders.slice(0, 30)) {
    await prisma.activityLog.create({
      data: {
        action: "ORDER_CREATED",
        details: `Order ${order.orderNumber} created from ${order.source} - ${order.customerName}`,
        orderId: order.id,
        createdAt: order.createdAt,
      },
    });

    if (order.assignedAt) {
      const mfg = manufacturers.find((m) => m.id === order.manufacturerId);
      await prisma.activityLog.create({
        data: {
          action: "ORDER_ASSIGNED",
          details: `Order ${order.orderNumber} assigned to ${mfg?.name || "manufacturer"}`,
          userId: adminUser?.id,
          orderId: order.id,
          createdAt: order.assignedAt,
        },
      });
    }

    if (order.shippedAt) {
      await prisma.activityLog.create({
        data: {
          action: "ORDER_SHIPPED",
          details: `Order ${order.orderNumber} shipped via ${order.carrier} (${order.trackingNumber})`,
          orderId: order.id,
          createdAt: order.shippedAt,
        },
      });
    }
  }

  // Alert activity
  const unresolvedAlerts = await prisma.alert.findMany({ where: { resolved: false }, take: 5 });
  for (const alert of unresolvedAlerts) {
    await prisma.activityLog.create({
      data: {
        action: "ALERT_CREATED",
        details: alert.title,
        orderId: alert.orderId,
        createdAt: alert.createdAt,
      },
    });
  }

  console.log("Created activity logs");

  // Print summary
  const orderCount = await prisma.order.count();
  const alertCount = await prisma.alert.count();
  const emailCount = await prisma.emailLog.count();
  const activityCount = await prisma.activityLog.count();

  console.log("\n=== Seed Summary ===");
  console.log(`Manufacturers: ${manufacturers.length}`);
  console.log(`Products: ${products.length}`);
  console.log(`Orders: ${orderCount}`);
  console.log(`Alerts: ${alertCount}`);
  console.log(`Emails: ${emailCount}`);
  console.log(`Activity Logs: ${activityCount}`);
  console.log(`Users: 5 (admin, super, mfg1, mfg2, mfg3)`);
  console.log("====================\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
