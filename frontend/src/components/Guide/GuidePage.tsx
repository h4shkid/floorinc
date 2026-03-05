import { useState, type ReactNode } from "react";

interface Section {
  title: string;
  content: ReactNode;
}

function Accordion({ title, content, defaultOpen = false }: Section & { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 flex items-center justify-between text-left"
      >
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <svg
          className={`h-5 w-5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed space-y-3">
          {content}
        </div>
      )}
    </div>
  );
}

const sections: (Section & { defaultOpen?: boolean })[] = [
  {
    title: "Dashboard Overview",
    defaultOpen: true,
    content: (
      <>
        <p>The dashboard shows all warehoused SKUs with their current inventory levels, sales velocity, and urgency status. Data is synced from NetSuite automatically.</p>
        <div className="space-y-2">
          <h4 className="font-semibold text-slate-800 dark:text-slate-200">Urgency Colors</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><span className="font-medium text-red-700 dark:text-red-400">BACKORDER</span> — on hand is negative, orders are waiting</li>
            <li><span className="font-medium text-red-600 dark:text-red-400">RED</span> — stock will run out before new inventory arrives (days remaining &lt; lead time)</li>
            <li><span className="font-medium text-amber-600 dark:text-amber-400">YELLOW</span> — stock is getting low, order soon (days remaining &lt; 1.5x lead time)</li>
            <li><span className="font-medium text-green-600 dark:text-green-400">GREEN</span> — stock levels are healthy</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: "Key Columns Explained",
    content: (
      <div className="space-y-2">
        <ul className="list-disc list-inside space-y-1.5">
          <li><span className="font-semibold text-slate-800 dark:text-slate-200">On Hand</span> — current inventory in TN warehouse. Negative means backorder. If there's incoming stock from a PO, it shows below in blue.</li>
          <li><span className="font-semibold text-slate-800 dark:text-slate-200">Vel/d</span> — average units sold per day over the selected time window (default 90 days)</li>
          <li><span className="font-semibold text-slate-800 dark:text-slate-200">Szn</span> — seasonality multiplier comparing this period vs last year. Above 1.0x means demand is growing, below means declining.</li>
          <li><span className="font-semibold text-slate-800 dark:text-slate-200">Adj Vel</span> — velocity adjusted for seasonality. This is the actual forecasted daily demand.</li>
          <li><span className="font-semibold text-slate-800 dark:text-slate-200">Days Left</span> — how many days of stock remain at the current sell rate (on hand / adjusted velocity)</li>
          <li><span className="font-semibold text-slate-800 dark:text-slate-200">LT</span> — lead time in days. How long it takes to receive new stock after ordering. Double-click to edit.</li>
          <li><span className="font-semibold text-slate-800 dark:text-slate-200">Ch</span> — top sales channel (FI = FlooringInc, AVC = Amazon Vendor Central, ASC = Amazon Seller Central, HD = Home Depot, WF = Wayfair, WM = Walmart)</li>
        </ul>
      </div>
    ),
  },
  {
    title: "Filters & Sorting",
    content: (
      <div className="space-y-2">
        <ul className="list-disc list-inside space-y-1.5">
          <li><span className="font-semibold text-slate-800 dark:text-slate-200">Search</span> — search by SKU, product name, or manufacturer</li>
          <li><span className="font-semibold text-slate-800 dark:text-slate-200">Urgency filter</span> — show only BACKORDER, RED, YELLOW, or GREEN items</li>
          <li><span className="font-semibold text-slate-800 dark:text-slate-200">Stock filter</span> — switch between warehoused (domestic/international), drop ship, or all SKUs</li>
          <li><span className="font-semibold text-slate-800 dark:text-slate-200">Velocity window</span> — change the time period for velocity calculation (default 90 days)</li>
          <li><span className="font-semibold text-slate-800 dark:text-slate-200">Column sorting</span> — click any column header to sort. Click again to reverse direction.</li>
        </ul>
      </div>
    ),
  },
  {
    title: "Editing Lead Times",
    content: (
      <div className="space-y-2">
        <p>Lead time is how many days it takes for a supplier to deliver after you place an order. This directly affects urgency calculations.</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Find the SKU in the table</li>
          <li>Double-click the number in the <span className="font-semibold">LT</span> column</li>
          <li>Type the new lead time in days</li>
          <li>Press Enter to save or Escape to cancel</li>
        </ol>
        <p>The dashboard will automatically refresh with updated urgency colors after saving.</p>
      </div>
    ),
  },
  {
    title: "Drop Ship vs Warehoused Toggle",
    content: (
      <div className="space-y-2">
        <p>Each SKU has a small badge next to it showing whether it's <span className="font-semibold">Warehoused</span> (gray) or <span className="font-semibold text-orange-600">Drop Ship</span> (orange).</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Click the badge to toggle</li>
          <li>A confirmation prompt will appear to prevent accidental changes</li>
          <li>Confirm to save — the dashboard refreshes and the SKU moves to the correct filter view</li>
        </ol>
        <p>Drop ship items are excluded from the default warehoused view. Use the stock filter dropdown to see them.</p>
      </div>
    ),
  },
  {
    title: "SKU Detail Panel",
    content: (
      <div className="space-y-2">
        <p>Click any row in the table to open the SKU detail panel on the right side. This shows:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Monthly sales chart (last 12 months)</li>
          <li>Channel breakdown with revenue</li>
          <li>Recent individual orders</li>
          <li>Open purchase orders with expected dates</li>
          <li>90-day financials (revenue, cost, margin)</li>
        </ul>
        <p>Click the X or click outside the panel to close it.</p>
      </div>
    ),
  },
  {
    title: "Copying a SKU",
    content: (
      <div className="space-y-2">
        <p>To copy a SKU without opening the detail panel:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Find the small copy icon next to the SKU number</li>
          <li>Click it — the SKU is copied to your clipboard</li>
          <li>The icon turns into a green checkmark to confirm</li>
        </ol>
      </div>
    ),
  },
  {
    title: "Data Sync (NetSuite)",
    content: (
      <div className="space-y-2">
        <p>Go to the <span className="font-semibold">Data Sync</span> tab to manually trigger a sync from NetSuite.</p>
        <ul className="list-disc list-inside space-y-1">
          <li><span className="font-semibold text-slate-800 dark:text-slate-200">Full Sync</span> — pulls inventory, sales, and purchase orders</li>
          <li><span className="font-semibold text-slate-800 dark:text-slate-200">Sales Only</span> — faster, only pulls recent sales data</li>
        </ul>
        <p>A progress bar shows the sync status. The last sync time is displayed in the header bar at the top of the page.</p>
      </div>
    ),
  },
];

export function GuidePage() {
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">How to Use This Platform</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Click any section below to expand it</p>
      </div>
      {sections.map((s) => (
        <Accordion key={s.title} title={s.title} content={s.content} defaultOpen={s.defaultOpen} />
      ))}
    </div>
  );
}
