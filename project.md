# FlooringInc — Manufacturer Order Tracking Portal (MVP)

## Project Overview

Build a **full-stack web application** for FlooringInc, a US-based flooring materials company that sells on Amazon, their own website, and other marketplaces. They work with **10+ manufacturers** across the US who fulfill orders on their behalf (dropship model). Currently, order tracking, shipping confirmation, and delay management are all done manually via phone calls, texts, and spreadsheets.

This MVP is a **demo/presentation build** — no real API integrations yet, but the app must look and function like a production system with realistic mock data. It will be presented to the client (Kurt) in a meeting to demonstrate the vision and get approval.

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend:** Next.js API routes
- **Database:** SQLite with Prisma ORM (easy demo setup, no external DB needed)
- **Auth:** NextAuth.js with credentials provider (email/password)
- **Email:** Mock email system (log to console + show in UI as "sent emails")
- **Charts:** Recharts for dashboard analytics
- **UI Components:** shadcn/ui + custom components
- **Icons:** Lucide React

---

## User Roles & Authentication

### 3 User Roles:

1. **Admin** (FlooringInc team)
   - Full access to everything
   - Can see all orders, all manufacturers, all alerts
   - Can manually assign orders to manufacturers
   - Can configure alert rules and delay thresholds

2. **Manufacturer**
   - Can only see orders assigned to them
   - Can confirm shipment + enter tracking number
   - Can see their own performance metrics
   - Simple, clean interface — these are warehouse people, not tech people

3. **Super Admin** (system owner)
   - Everything Admin can do + user management + system settings

### Demo Accounts (pre-seeded):
```
Admin:        admin@floorinc.com / demo123
Manufacturer: wisconsin@manufacturer.com / demo123
Manufacturer: texas@manufacturer.com / demo123
Manufacturer: california@manufacturer.com / demo123
Super Admin:  kurt@floorinc.com / demo123
```

---

## Database Schema

### Users
- id, email, password (hashed), name, role (ADMIN | MANUFACTURER | SUPER_ADMIN)
- manufacturerId (nullable — links manufacturer users to their manufacturer record)

### Manufacturers
- id, name, location (city, state), contactEmail, contactPhone
- averageFulfillmentTime (calculated), onTimeRate (calculated)
- status (ACTIVE | INACTIVE)

### Products
- id, sku, name, category (e.g., "Vinyl Plank", "Laminate", "Tile", "Carpet")
- manufacturerId (which manufacturer makes/stocks this product)
- imageUrl, weight, dimensions

### Orders
- id, orderNumber, source (AMAZON | WEBSITE | WAYFAIR | HOME_DEPOT)
- customerName, shippingAddress (city, state, zip)
- status: PENDING → ASSIGNED → MANUFACTURER_NOTIFIED → SHIPPED → DELIVERED → DELAYED
- manufacturerId, productId
- orderDate, assignedDate, notifiedDate, shippedDate, deliveredDate
- trackingNumber, carrier (UPS | FEDEX | USPS | FREIGHT)
- shippingDeadline (calculated from source rules — Amazon = 2-3 days, etc.)
- notes

### Alerts
- id, orderId, type (APPROACHING_DEADLINE | DEADLINE_PASSED | NO_RESPONSE | SHIPPING_DELAYED)
- severity (LOW | MEDIUM | HIGH | CRITICAL)
- message, isRead, isResolved
- createdAt

### EmailLog
- id, orderId, recipientEmail, subject, body, type (ORDER_NOTIFICATION | REMINDER | ESCALATION)
- sentAt, status (SENT | DELIVERED | REPLIED)
- replyContent (simulated manufacturer reply)

### ActivityLog
- id, orderId, userId, action, details, createdAt

---

## Seed Data Requirements

Generate **realistic mock data** that tells a compelling story:

- **10 manufacturers** across different US states (Wisconsin, Texas, California, Georgia, Ohio, Pennsylvania, Florida, North Carolina, Arizona, Michigan)
- **50+ products** with realistic flooring names (e.g., "Heritage Oak Vinyl Plank 7x48", "Marble Luxe Porcelain Tile 24x24", "Canyon Ridge Laminate 12mm")
- **200+ orders** spread across last 30 days with realistic distribution:
  - 60% Amazon, 20% Website, 10% Wayfair, 10% Home Depot
  - Various statuses — mostly delivered, some shipped, some in progress, a few delayed
  - Some orders deliberately showing delay scenarios for demo purposes
  - Realistic customer names and US addresses
- **Active alerts** — at least 10-15 unresolved alerts showing different delay scenarios
- **Email logs** showing the communication flow
- **Activity logs** showing order lifecycle events

---

## Pages & Features

### 1. Login Page (`/login`)
- Clean, professional login form
- FlooringInc branding (create a simple logo)
- Role-based redirect after login (admin → dashboard, manufacturer → their portal)

### 2. Admin Dashboard (`/dashboard`)

**Key Metrics Cards (top row):**
- Total Orders (today / this week / this month)
- Pending Orders (need assignment or action)
- Active Alerts (unresolved, color-coded by severity)
- Average Fulfillment Time (across all manufacturers)
- On-Time Delivery Rate (percentage)

**Charts Section:**
- Orders by Source (pie/donut chart — Amazon, Website, Wayfair, Home Depot)
- Orders by Status (bar chart — current pipeline)
- Fulfillment Time Trend (line chart — last 30 days)
- Orders Volume (area chart — daily orders last 30 days)

**Recent Activity Feed:**
- Real-time style feed showing latest order updates
- "Order #1234 shipped by Wisconsin Mfg — tracking: 1Z999..."
- "⚠️ Order #1256 approaching deadline — no response from Texas Mfg"
- Clickable to go to order detail

**Manufacturer Performance Table:**
- Ranked list of manufacturers
- Columns: Name, Location, Active Orders, Avg Fulfillment Time, On-Time Rate, Status
- Color-coded performance indicators (green/yellow/red)
- Click to see manufacturer detail

### 3. Orders Page (`/orders`)

**Filters & Search Bar:**
- Search by order number, customer name, tracking number
- Filter by: status, source, manufacturer, date range
- Sort by: date, deadline, status

**Orders Table:**
- OrderNumber, Source (with icon — Amazon smile, etc.), Product, Customer, Manufacturer
- Status (color-coded badge), Order Date, Deadline, Tracking, Actions
- Clicking a row opens order detail

**Bulk Actions:**
- Select multiple orders → Assign to manufacturer, Send reminder, Export

### 4. Order Detail Page (`/orders/[id]`)

**Order Timeline:**
- Visual timeline showing every step: Received → Assigned → Notified → Shipped → Delivered
- Each step shows timestamp and who did it
- Current step highlighted, future steps grayed out
- If delayed, show red warning markers

**Order Info Cards:**
- Order details (number, source, date, deadline countdown timer)
- Customer info (name, address)
- Product info (SKU, name, category, image)
- Manufacturer info (name, location, contact)
- Shipping info (carrier, tracking, estimated delivery)

**Communication Log:**
- All emails sent/received for this order
- "Notification sent to manufacturer at 2:30 PM"
- "Manufacturer replied: Shipped via UPS, tracking 1Z999..."

**Action Buttons:**
- Reassign to different manufacturer
- Send reminder email
- Mark as shipped (manual override)
- Add note
- Escalate

### 5. Alerts Page (`/alerts`)

**Alert List with Priority:**
- CRITICAL (red): Deadline passed, no shipment
- HIGH (orange): Deadline approaching (< 12 hours), no tracking
- MEDIUM (yellow): Manufacturer hasn't responded to notification
- LOW (blue): Minor delays, informational

**Each Alert Shows:**
- Order number, manufacturer, issue description
- Time since alert was triggered
- Quick action buttons: View Order, Send Reminder, Resolve, Escalate

**Alert Statistics:**
- Alerts by type (chart)
- Resolution time average
- Most problematic manufacturers

### 6. Manufacturers Page (`/manufacturers`)

**Manufacturer Cards/Grid:**
- Each manufacturer: name, location, active orders count, performance score
- Status indicator (active/inactive)
- Click to open detail

### 7. Manufacturer Detail (`/manufacturers/[id]`)
- Company info, contacts
- Performance metrics (fulfillment time, on-time rate, response time)
- Products they handle
- Recent orders list
- Communication history
- Performance charts over time

### 8. Manufacturer Portal (`/portal`) — SEPARATE LAYOUT

**This is what manufacturers see when they log in. Must be EXTREMELY simple.**

**Dashboard:**
- "You have X orders waiting for shipment" — big, obvious number
- Simple list of pending orders with countdown timers

**Order Cards:**
- Each pending order shows: Order#, Product, Ship-to State, Deadline (with countdown)
- Big green button: **"Mark as Shipped"**
- Clicking opens a simple form: Carrier dropdown + Tracking Number input + Confirm button
- After confirming, order moves to "Shipped" section

**Shipped Orders:**
- Simple list of recently shipped orders
- Shows tracking number and current status

**NO complex navigation, NO charts, NO analytics. Just orders and ship buttons.**

### 9. Settings Page (`/settings`) — Admin/Super Admin only
- Alert threshold configuration (hours before deadline to trigger alerts)
- Email template management
- Source-specific deadline rules (Amazon: 48hrs, Website: 72hrs, etc.)
- User management (Super Admin only)

### 10. Email Simulation Page (`/emails`) — Admin only
- Shows all "sent" emails in a Gmail-like interface
- Can see what notifications went out
- Can see simulated manufacturer replies
- Demonstrates the email workflow without real email integration

---

## Critical UI/UX Requirements

### Design Language:
- **Professional, enterprise SaaS feel** — think Shopify admin, Linear, or Vercel dashboard
- **Dark sidebar** with light main content area
- Clean typography, lots of whitespace
- Status badges and color coding must be instantly readable
- **Mobile responsive** — especially the manufacturer portal (warehouse workers use phones)

### Performance Indicators (color system):
- 🟢 Green: On track, shipped, delivered, >90% on-time
- 🟡 Yellow: Approaching deadline, minor delay, 70-90% on-time
- 🔴 Red: Overdue, deadline passed, <70% on-time
- 🔵 Blue: Informational, new, pending

### Key Interactions:
- **Countdown timers** on orders — showing real-time countdown to shipping deadline
- **Toast notifications** when actions are taken
- **Smooth transitions** between pages and states
- **Confirmation modals** for important actions (assign, ship, escalate)
- **Loading states** and skeleton screens

### Manufacturer Portal Specific:
- **Large touch-friendly buttons** (warehouse workers with gloves)
- **Minimal text, maximum clarity**
- **Big countdown timers** showing urgency
- **Success animations** when marking as shipped (confetti or checkmark animation)
- **Color transitions** — green pulse when order is confirmed

---

## Demo Flow (Important!)

The app should support a convincing **live demo walkthrough**:

1. **Login as Admin** → See dashboard with real-looking data
2. **Show a new order** coming in (can be triggered by a "Simulate New Order" button hidden in settings or accessible via keyboard shortcut)
3. **Assign it** to a manufacturer → Show the notification being "sent"
4. **Switch to manufacturer login** (open in new tab) → See the order appear
5. **As manufacturer**, mark it as shipped with tracking number
6. **Switch back to admin** → See the order updated, timeline progressed
7. **Show alerts** for delayed orders → Demonstrate the alert system
8. **Show manufacturer performance** → Rankings and metrics

**Add a "Demo Mode" toggle** or keyboard shortcut (Ctrl+Shift+D) that:
- Can trigger simulated events (new order, manufacturer response, delay)
- Speeds up countdown timers for demonstration
- Shows tooltips explaining features

---

## API Routes Structure

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/session

GET    /api/orders              (list, with filters)
GET    /api/orders/:id          (detail)
POST   /api/orders              (create — for demo/simulation)
PATCH  /api/orders/:id          (update status, assign, add tracking)
POST   /api/orders/:id/assign   (assign to manufacturer)
POST   /api/orders/:id/ship     (mark as shipped + tracking)
POST   /api/orders/:id/notify   (send notification to manufacturer)

GET    /api/manufacturers       (list)
GET    /api/manufacturers/:id   (detail with stats)

GET    /api/alerts              (list, with filters)
PATCH  /api/alerts/:id          (resolve, dismiss)

GET    /api/emails              (email log)

GET    /api/dashboard/stats     (aggregated metrics)
GET    /api/dashboard/charts    (chart data)

POST   /api/demo/simulate-order     (demo helper)
POST   /api/demo/simulate-shipment  (demo helper)
POST   /api/demo/simulate-delay     (demo helper)

GET    /api/activity            (activity feed)
```

---

## File Structure

```
floorinc-portal/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                 (comprehensive seed data)
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (admin)/
│   │   │   ├── layout.tsx      (admin sidebar layout)
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── manufacturers/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── alerts/page.tsx
│   │   │   ├── emails/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── (portal)/
│   │   │   ├── layout.tsx      (simple manufacturer layout)
│   │   │   └── portal/
│   │   │       ├── page.tsx    (manufacturer dashboard)
│   │   │       └── orders/[id]/page.tsx
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── orders/
│   │   │   ├── manufacturers/
│   │   │   ├── alerts/
│   │   │   ├── dashboard/
│   │   │   ├── emails/
│   │   │   └── demo/
│   │   ├── layout.tsx
│   │   └── page.tsx            (redirect to login)
│   ├── components/
│   │   ├── ui/                 (shadcn components)
│   │   ├── admin/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StatsCards.tsx
│   │   │   ├── OrdersTable.tsx
│   │   │   ├── OrderTimeline.tsx
│   │   │   ├── AlertsList.tsx
│   │   │   ├── ManufacturerCard.tsx
│   │   │   ├── PerformanceChart.tsx
│   │   │   ├── ActivityFeed.tsx
│   │   │   └── EmailViewer.tsx
│   │   ├── portal/
│   │   │   ├── PendingOrderCard.tsx
│   │   │   ├── ShipmentForm.tsx
│   │   │   └── ShippedOrderCard.tsx
│   │   └── shared/
│   │       ├── StatusBadge.tsx
│   │       ├── CountdownTimer.tsx
│   │       ├── SourceIcon.tsx
│   │       ├── ConfirmModal.tsx
│   │       └── LoadingSkeleton.tsx
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   ├── utils.ts
│   │   └── constants.ts
│   └── types/
│       └── index.ts
├── public/
│   └── images/                 (product images, logos)
├── tailwind.config.ts
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## Implementation Priority

Build in this order:

1. **Database + Seed Data** — Get the foundation right with realistic data
2. **Auth + Login** — Role-based authentication
3. **Admin Layout + Sidebar** — Navigation shell
4. **Dashboard** — Stats cards + charts (most impressive for demo)
5. **Orders List + Detail** — Core functionality
6. **Manufacturer Portal** — The key differentiator
7. **Alerts System** — Shows the automation value
8. **Email Simulation** — Communication tracking
9. **Demo Mode** — Make the live demo smooth
10. **Settings** — Configuration page
11. **Polish** — Animations, transitions, responsive design

---

## Important Notes

- **All data is local** — SQLite database, no external services needed
- **No real emails** — Everything is simulated and logged in the database
- **No real API integrations** — Amazon, tracking APIs etc. will come in Phase 2
- **Focus on the VISUAL and UX** — This is a sales demo. It needs to look amazing and feel real.
- **The manufacturer portal simplicity is KEY** — If Kurt sees how easy it is for manufacturers to use, he'll buy in immediately
- **Countdown timers are the hero feature** — Real-time urgency visualization is what sells the automation story
- **Performance data tells the story** — Show that some manufacturers are slow, proving the need for this system

---

## Phase 2 (Future — NOT for MVP, but mention in presentation)
- Amazon SP-API integration for automatic order import
- Real email sending via SendGrid/AWS SES
- Inbound email parsing (manufacturer replies)
- SMS notifications via Twilio
- Real tracking API integration (AfterShip, EasyPost)
- Webhook support for real-time updates
- Mobile app for manufacturers
- Advanced analytics and reporting
- Multi-language support
- Inventory management integration