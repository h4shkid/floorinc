import type { DashboardParams } from "../../types";
import { ManufacturerSelect } from "./ManufacturerSelect";

interface Props {
  params: DashboardParams;
  onChange: (updates: Partial<DashboardParams>) => void;
}

const CATEGORIES = [
  "Artificial Grass",
  "Carpet Roll",
  "Carpet Tile",
  "Composite Decking",
  "Court Flooring",
  "Dance Flooring",
  "Drainage Tiles",
  "Foam Tiles",
  "Garage Rolls",
  "Garage Tiles",
  "Gym Floor Covers",
  "Gymnastic Mats/Folding Mats",
  "Playground Flooring",
  "Product Accessories",
  "Rubber Rolls",
  "Rubber Tiles",
  "Turf Rolls",
  "Underlayment",
  "Vinyl Flooring",
  "Wall Base",
];

const selectClass =
  "px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-200";

export function FilterBar({ params, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3 mb-4 items-end" data-tour="filter-bar">
      {/* Search */}
      <div className="flex-1 min-w-48">
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search</label>
        <input
          type="text"
          placeholder="SKU or product name..."
          value={params.search}
          onChange={(e) => onChange({ search: e.target.value })}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
        />
      </div>

      {/* Stock Type */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Stock Type</label>
        <select
          value={params.stock_filter}
          onChange={(e) => onChange({ stock_filter: e.target.value as DashboardParams["stock_filter"] })}
          className={selectClass}
        >
          <option value="warehoused">Warehoused (All)</option>
          <option value="warehoused_domestic">Warehoused — Domestic</option>
          <option value="warehoused_international">Warehoused — International</option>
          <option value="drop_ship">Drop Ship Only</option>
          <option value="all">All Items</option>
        </select>
      </div>

      {/* Urgency */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Urgency</label>
        <select
          value={params.urgency}
          onChange={(e) => onChange({ urgency: e.target.value })}
          className={selectClass}
        >
          <option value="">All</option>
          <option value="BACKORDER">Backorders</option>
          <option value="RED">Order Now</option>
          <option value="YELLOW">Getting Close</option>
          <option value="GREEN">Comfortable</option>
          <option value="RED,YELLOW">Needs Attention</option>
          <option value="BACKORDER,RED,YELLOW">All Urgent</option>
        </select>
      </div>

      {/* Channel */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Channel</label>
        <select
          value={params.channel}
          onChange={(e) => onChange({ channel: e.target.value })}
          className={selectClass}
        >
          <option value="">All Channels</option>
          <option value="FI">FI (Website)</option>
          <option value="Amazon Seller Central">Amazon Seller Central</option>
          <option value="Amazon Vendor Central">Amazon Vendor Central</option>
          <option value="Home Depot">Home Depot</option>
          <option value="Wayfair">Wayfair</option>
          <option value="Walmart">Walmart</option>
          <option value="eBay">eBay</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Manufacturer */}
      <div className="min-w-40">
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Manufacturer</label>
        <ManufacturerSelect
          value={params.manufacturer}
          onChange={(manufacturer) => onChange({ manufacturer })}
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Category</label>
        <select
          value={params.category}
          onChange={(e) => onChange({ category: e.target.value })}
          className={selectClass}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Velocity Window */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Velocity Window</label>
        <select
          value={params.velocity_window}
          onChange={(e) => onChange({ velocity_window: Number(e.target.value) })}
          className={selectClass}
        >
          <option value={30}>30 days</option>
          <option value={60}>60 days</option>
          <option value={90}>90 days</option>
          <option value={180}>180 days</option>
        </select>
      </div>

      {/* Active Only Toggle */}
      <div className="flex items-center gap-2 pb-0.5">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={params.active_only}
            onChange={(e) => onChange({ active_only: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-200 dark:bg-slate-600 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
        </label>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Active only</span>
      </div>
    </div>
  );
}
