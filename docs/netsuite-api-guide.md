# NetSuite SuiteQL API Guide

All queries in this document have been tested and verified against the FlooringInc NetSuite account (Account ID: `4930797`) on 2026-03-03. Only working queries with confirmed field access are included.

**Auth:** OAuth 1.0 (HMAC-SHA256) via `requests_oauthlib.OAuth1Session`
**Endpoint:** `https://4930797.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`
**Pagination:** `limit=1000`, `offset` increments, `hasMore` flag. Max 100K rows per query — use date chunking for larger datasets.

---

## Table of Contents

1. [Inventory & Stock Levels](#1-inventory--stock-levels)
2. [Item Costs & Pricing](#2-item-costs--pricing)
3. [Item Classification & Types](#3-item-classification--types)
4. [Vendors / Suppliers](#4-vendors--suppliers)
5. [Locations / Warehouses](#5-locations--warehouses)
6. [Sales Orders](#6-sales-orders)
7. [Invoices](#7-invoices)
8. [Item Fulfillments (Shipments)](#8-item-fulfillments-shipments)
9. [Item Receipts (Receiving)](#9-item-receipts-receiving)
10. [Inventory Adjustments](#10-inventory-adjustments)
11. [Custom Fields](#11-custom-fields)
12. [Empty / Zero-Data Tables](#12-empty--zero-data-tables)
13. [Inaccessible Tables](#13-inaccessible-tables)
14. [Pagination & Chunking](#14-pagination--chunking)
15. [Status Code Reference](#15-status-code-reference)

---

## 1. Inventory & Stock Levels

### Stock by Location (per-warehouse breakdown)

**Rows:** 5,000+
**Use case:** See stock distribution across warehouses, identify which location holds inventory.

```sql
SELECT item.itemId AS sku, item.displayName,
       loc.quantityAvailable, loc.quantityOnHand,
       loc.quantityOnOrder, loc.quantityBackOrdered,
       loc.quantityCommitted, loc.location
FROM inventoryItem item
JOIN inventoryItemLocations loc ON loc.item = item.id
WHERE item.isInactive = 'F'
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `sku` | string | Item ID (e.g. `10003_11987_50197`) |
| `displayname` | string | Full product name |
| `quantityavailable` | string (numeric) | Available to sell (on_hand - committed) |
| `location` | string (ID) | Location ID (join with `location` table for name) |

**Note:** `quantityOnHand`, `quantityOnOrder`, `quantityBackOrdered`, `quantityCommitted` were requested but not returned by the API. Only `quantityAvailable` comes through reliably.

---

### Stock Aggregated (all locations combined)

**Rows:** 5,000+
**Use case:** Total stock per SKU across all warehouses. This is what the app currently uses for the inventory sync.

```sql
SELECT item.itemId AS sku, item.displayName,
       SUM(loc.quantityAvailable) AS qty_available,
       SUM(loc.quantityOnHand) AS qty_on_hand,
       SUM(loc.quantityOnOrder) AS qty_on_order,
       SUM(loc.quantityBackOrdered) AS qty_backordered,
       SUM(loc.quantityCommitted) AS qty_committed
FROM inventoryItem item
JOIN inventoryItemLocations loc ON loc.item = item.id
WHERE item.isInactive = 'F'
GROUP BY item.itemId, item.displayName
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `sku` | string | Item ID |
| `displayname` | string | Product name |
| `qty_available` | string (numeric) | Total available across all locations |
| `qty_on_hand` | string (numeric) | Total physical on hand |
| `qty_on_order` | string (numeric) | Qty on open purchase orders |
| `qty_backordered` | string (numeric) | Qty backordered by customers |
| `qty_committed` | string (numeric) | Qty committed to open sales orders |

**Sample:**
```json
{
  "sku": "10003_11987_50197",
  "displayname": "Shaw In the Grain Vinyl Plank 6\" x 48\" x 12 mil (41.72 sq ft/case) 5524V Flaxseed",
  "qty_available": "8000",
  "qty_on_hand": "8000",
  "qty_on_order": "0",
  "qty_backordered": "0",
  "qty_committed": "0"
}
```

**Potential use:** `qty_on_order` and `qty_backordered` could feed into the forecast engine — knowing incoming stock and outstanding backorders improves reorder recommendations.

---

## 2. Item Costs & Pricing

### Item Costs (COGS)

**Rows:** 5,000+
**Use case:** Calculate margins, identify high/low cost items.

```sql
SELECT item.itemId, item.cost, item.lastPurchasePrice,
       item.averageCost
FROM inventoryItem item
WHERE item.isInactive = 'F'
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `itemid` | string | SKU |
| `cost` | string (numeric) | Standard/preferred cost |
| `lastpurchaseprice` | string (numeric) | Last PO price paid |
| `averagecost` | string (numeric) | Weighted average cost |

**Sample:**
```json
{
  "itemid": "10003_11987_50197",
  "cost": "93.87",
  "lastpurchaseprice": "0",
  "averagecost": "0"
}
```

**Note:** Many items show `averageCost` and `lastPurchasePrice` as 0 — cost data may only be populated for items with recent purchase activity.

---

### Price Levels / Price List

**Rows:** 5,000+
**Use case:** See pricing tiers per item (retail, wholesale, etc).

```sql
SELECT item.itemId, item.displayName,
       pricing.priceLevel, pricing.unitPrice, pricing.quantity
FROM pricing
JOIN inventoryItem item ON item.id = pricing.item
WHERE item.isInactive = 'F'
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `itemid` | string | SKU |
| `displayname` | string | Product name |
| `pricelevel` | string (ID) | Price level identifier (1, 2, etc.) |
| `unitprice` | string (numeric) | Price at this level |
| `quantity` | string (numeric) | Quantity break for this price |

**Sample:**
```json
{
  "itemid": "10003_11987_50197",
  "displayname": "Shaw In the Grain Vinyl Plank...",
  "pricelevel": "1",
  "unitprice": "145.6",
  "quantity": "1"
}
```

**Note:** Multiple rows per item (one per price level). `priceLevel` is a numeric ID — level names are not directly accessible via SuiteQL.

---

## 3. Item Classification & Types

### Item Categories / Class

**Rows:** 5,000+
**Use case:** Group items by product class for reporting.

```sql
SELECT item.itemId, item.displayName,
       item.class, item.department, item.location
FROM inventoryItem item
WHERE item.isInactive = 'F'
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `itemid` | string | SKU |
| `displayname` | string | Product name |
| `class` | string (ID) | Classification ID (e.g. `537`) |

**Note:** `department` and `location` were requested but not returned. `class` is a numeric ID — the classification name table is not accessible.

---

### All Item Types (inventory, kits, assemblies)

**Rows:** 5,000+
**Use case:** Identify item hierarchy, distinguish standalone products from kits.

```sql
SELECT item.itemId, item.displayName, item.parent,
       item.itemType, item.isInactive
FROM item
WHERE item.itemType IN ('InvtPart', 'Kit', 'Assembly', 'Group')
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `itemid` | string | SKU |
| `displayname` | string | Product name |
| `isinactive` | string | `F` or `T` |
| `itemtype` | string | `InvtPart`, `Kit`, or `Assembly` |

**Note:** `parent` was requested but not returned.

---

### Kit / Assembly Items Only

**Rows:** 2,244
**Use case:** Identify bundled products that contain component items.

```sql
SELECT item.id, item.itemId, item.displayName, item.itemType
FROM item
WHERE item.itemType IN ('Kit', 'Assembly') AND item.isInactive = 'F'
```

**Sample:**
```json
{
  "id": "94102",
  "itemid": "10079_20392_87589",
  "displayname": "Performance Turf Rolls 6.5' x 5' Forest Green",
  "itemtype": "Kit"
}
```

---

### Non-Inventory Items

**Rows:** 5
**Use case:** Services, consulting, misc charges — not physical inventory.

```sql
SELECT item.id, item.itemId, item.displayName, item.itemType
FROM item
WHERE item.itemType = 'NonInvtPart' AND item.isInactive = 'F'
```

---

## 4. Vendors / Suppliers

### Vendor List

**Rows:** 677
**Use case:** Supplier directory — contacts, active status.

```sql
SELECT vendor.id, vendor.entityId, vendor.companyName,
       vendor.email, vendor.phone, vendor.isInactive
FROM vendor
WHERE vendor.isInactive = 'F'
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Internal vendor ID |
| `entityid` | string | Vendor name/code |
| `companyname` | string | Company name (may be null) |
| `email` | string | Contact email (may be null) |
| `phone` | string | Contact phone (may be null) |
| `isinactive` | string | `F` or `T` |

**Sample:**
```json
{
  "entityid": "84 Lumber",
  "companyname": "84 Lumber",
  "email": "karnsc@3005.84lumber.com",
  "phone": "602-616-3407"
}
```

---

### Item–Vendor Relationship

**Rows:** 5,000+
**Use case:** Map each SKU to its supplier/manufacturer. Currently used in inventory sync.

```sql
SELECT item.itemId AS sku, item.displayName,
       vendor.companyName AS vendor_name,
       item.vendor AS vendor_id
FROM inventoryItem item
LEFT JOIN vendor ON vendor.id = item.vendor
WHERE item.isInactive = 'F'
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `sku` | string | Item ID |
| `displayname` | string | Product name |
| `vendor_name` | string | Supplier company name |
| `vendor_id` | string | Vendor internal ID |

---

## 5. Locations / Warehouses

**Rows:** 10
**Use case:** Map location IDs to names for per-warehouse stock reporting.

```sql
SELECT id, name, mainAddress, isInactive,
       subsidiary, parent
FROM location
WHERE isInactive = 'F'
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Location ID (matches `loc.location` in stock queries) |
| `name` | string | Location name |
| `mainaddress` | string (ID) | Address reference |
| `subsidiary` | string (ID) | Subsidiary ID |

**Known locations:**
| ID | Name | Parent |
|----|------|--------|
| 1 | AZ DC | — |
| 2 | AZ Remnant | AZ DC |

**Note:** `parent` field is only present on child locations. Full list has 10 active locations.

---

## 6. Sales Orders

### Sales Order Headers

**Rows:** 5,000+
**Use case:** Order-level data — totals, status, channel, dates.

```sql
SELECT t.id, t.tranId, t.tranDate, t.status, t.type,
       t.entity, t.total, t.custbody_fa_channel
FROM transaction t
WHERE t.type = 'SalesOrd'
ORDER BY t.tranDate DESC
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Internal transaction ID |
| `tranid` | string | SO number (e.g. `SO-90115`) |
| `trandate` | string | Order date (format: `3/3/2026`) |
| `status` | string | Status code (see [reference](#15-status-code-reference)) |
| `type` | string | `SalesOrd` |
| `entity` | string | Customer ID |
| `total` | string (numeric) | Order total |
| `custbody_fa_channel` | string | Sales channel (e.g. `Magento2`) |

---

### Sales Order Line Items

**Rows:** 5,000+
**Use case:** SKU-level sales data — quantity, pricing, channel. This is the primary data source for the forecast engine.

```sql
SELECT t.tranId, TO_CHAR(t.tranDate, 'YYYY-MM-DD') AS order_date,
       item.itemId AS sku, item.displayName,
       ABS(tl.quantity) AS quantity,
       ABS(tl.netAmount) AS net_amount,
       ABS(tl.amount) AS gross_amount,
       tl.rate,
       t.custbody_fa_channel AS channel,
       t.status
FROM transactionLine tl
JOIN transaction t ON t.id = tl.transaction
JOIN item ON item.id = tl.item
WHERE t.type = 'SalesOrd'
  AND tl.mainLine = 'F'
  AND tl.itemType = 'InvtPart'
ORDER BY t.tranDate DESC
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `tranid` | string | SO number |
| `order_date` | string | Date (`YYYY-MM-DD`) |
| `sku` | string | Item ID |
| `displayname` | string | Product name |
| `quantity` | string (numeric) | Absolute quantity |
| `net_amount` | string (numeric) | Net amount (after discounts) |
| `gross_amount` | string (numeric) | Gross amount (before discounts) |
| `rate` | string (numeric) | Unit price |
| `channel` | string | Raw channel value |
| `status` | string | Order status code |

**Important:** ~70% of SalesOrd lines have `net_amount = 0` and `gross_amount = 0`. These are duplicate fulfillment-linked lines, not real sales. Always filter with `net_amount > 0` or `item_revenue > 0` (as stored in our DB).

---

## 7. Invoices

### Invoice Headers

**Rows:** 4,160
**Use case:** Billed transactions — useful for revenue recognition.

```sql
SELECT t.id, t.tranId, t.tranDate, t.status, t.total, t.entity,
       t.custbody_fa_channel
FROM transaction t
WHERE t.type = 'CustInvc'
ORDER BY t.tranDate DESC
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Internal ID |
| `tranid` | string | Invoice number (e.g. `INV-4194`) |
| `trandate` | string | Invoice date |
| `status` | string | Status code |
| `total` | string (numeric) | Invoice total |
| `entity` | string | Customer ID |

**Note:** `custbody_fa_channel` was requested but NOT returned for invoices — channel data only exists on Sales Orders.

---

### Invoice Line Items

**Rows:** 5,000+
**Use case:** SKU-level invoiced amounts with unit rates.

```sql
SELECT t.tranId, TO_CHAR(t.tranDate, 'YYYY-MM-DD') AS invoice_date,
       item.itemId AS sku, item.displayName,
       ABS(tl.quantity) AS quantity,
       ABS(tl.netAmount) AS net_amount,
       ABS(tl.amount) AS gross_amount,
       tl.rate
FROM transactionLine tl
JOIN transaction t ON t.id = tl.transaction
JOIN item ON item.id = tl.item
WHERE t.type = 'CustInvc'
  AND tl.mainLine = 'F'
  AND tl.itemType = 'InvtPart'
ORDER BY t.tranDate DESC
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `tranid` | string | Invoice number |
| `invoice_date` | string | Date (`YYYY-MM-DD`) |
| `sku` | string | Item ID |
| `displayname` | string | Product name |
| `quantity` | string (numeric) | Qty invoiced |
| `net_amount` | string (numeric) | Net amount |
| `gross_amount` | string (numeric) | Gross amount |
| `rate` | string (numeric) | Unit price on invoice |

**Note:** Invoice lines show `net_amount = 0` and `gross_amount = 0` in samples, but `rate` has actual values (e.g. `1.99`, `6.33`). Revenue may need to be calculated as `rate * quantity` for invoices.

---

## 8. Item Fulfillments (Shipments)

**Rows:** 5,000+
**Use case:** Track what was actually shipped — includes tracking numbers and ship method.

```sql
SELECT t.tranId, TO_CHAR(t.tranDate, 'YYYY-MM-DD') AS ship_date,
       item.itemId AS sku,
       ABS(tl.quantity) AS quantity,
       t.status, t.shipMethod, t.trackingNumbers
FROM transactionLine tl
JOIN transaction t ON t.id = tl.transaction
JOIN item ON item.id = tl.item
WHERE t.type = 'ItemShip'
  AND tl.mainLine = 'F'
  AND tl.itemType = 'InvtPart'
ORDER BY t.tranDate DESC
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `tranid` | string | Fulfillment number (e.g. `IF-95299`) |
| `ship_date` | string | Ship date (`YYYY-MM-DD`) |
| `sku` | string | Item ID |
| `quantity` | string (numeric) | Qty shipped |
| `status` | string | Status (`C` = Shipped) |
| `shipmethod` | string (ID) | Shipping method ID |
| `trackingnumbers` | string | Tracking number(s) |

**Sample:**
```json
{
  "tranid": "IF-95299",
  "ship_date": "2026-03-03",
  "sku": "S10179",
  "quantity": "1",
  "status": "C",
  "shipmethod": "4",
  "trackingnumbers": "92612902338182543400123273"
}
```

**Note:** Item Fulfillments never carry revenue (`netAmount` is always 0). They represent physical shipments only. Do NOT use for sales calculations.

---

## 9. Item Receipts (Receiving)

**Rows:** 4,868
**Use case:** Track when inventory was received from vendors. Can be used to calculate actual lead times (PO date → receipt date).

```sql
SELECT t.tranId, TO_CHAR(t.tranDate, 'YYYY-MM-DD') AS receipt_date,
       item.itemId AS sku,
       ABS(tl.quantity) AS quantity,
       t.status, t.entity
FROM transactionLine tl
JOIN transaction t ON t.id = tl.transaction
JOIN item ON item.id = tl.item
WHERE t.type = 'ItemRcpt'
  AND tl.mainLine = 'F'
  AND tl.itemType = 'InvtPart'
ORDER BY t.tranDate DESC
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `tranid` | string | Receipt number (e.g. `IR-836`) |
| `receipt_date` | string | Date received (`YYYY-MM-DD`) |
| `sku` | string | Item ID |
| `quantity` | string (numeric) | Qty received |
| `status` | string | Status (`Y` = Received) |
| `entity` | string | Vendor ID who shipped it |

**Sample:**
```json
{
  "tranid": "IR-836",
  "receipt_date": "2026-03-02",
  "sku": "3472_4661_21245",
  "quantity": "1120",
  "status": "Y",
  "entity": "307"
}
```

**Potential use:** Cross-reference `entity` (vendor ID) with vendor table to see which suppliers are delivering, and receipt dates to calculate historical lead times.

---

## 10. Inventory Adjustments

**Rows:** 5,000+
**Use case:** Track manual stock corrections, write-offs, cycle count adjustments.

```sql
SELECT t.tranId, TO_CHAR(t.tranDate, 'YYYY-MM-DD') AS adj_date,
       item.itemId AS sku,
       tl.quantity,
       ABS(tl.netAmount) AS amount,
       t.status, t.memo
FROM transactionLine tl
JOIN transaction t ON t.id = tl.transaction
JOIN item ON item.id = tl.item
WHERE t.type = 'InvAdjst'
  AND tl.mainLine = 'F'
  AND tl.itemType = 'InvtPart'
ORDER BY t.tranDate DESC
```

**Fields returned:**
| Field | Type | Description |
|-------|------|-------------|
| `tranid` | string | Adjustment number (e.g. `IA-1418`) |
| `adj_date` | string | Adjustment date |
| `sku` | string | Item ID |
| `quantity` | string (numeric) | Qty adjusted (negative = decrease) |
| `amount` | string (numeric) | Dollar value of adjustment |
| `status` | string | Status (`Y` = Posted) |

**Note:** `memo` was requested but not returned. Quantity is signed — negative values are stock decreases.

---

## 11. Custom Fields

### custbody_fa_channel (Sales Channel)

**Available on:** Sales Order transactions only
**Rows:** ~3,000 orders with channel data

```sql
SELECT t.tranId, t.custbody_fa_channel
FROM transaction t
WHERE t.type = 'SalesOrd' AND t.custbody_fa_channel IS NOT NULL
ORDER BY t.tranDate DESC
```

**Known values:**
| Raw Value | Mapped Name (in our app) |
|-----------|--------------------------|
| `Magento2` | FI (Website) |
| `Amazon` | Amazon Seller Central |
| `AmazonVendorCentral-DirectFulfillment` | Amazon Vendor Central |
| `Walmart` | Walmart |
| `eBay` | eBay |
| *(empty/null)* | Other |

**Note:** This is the ONLY custom body field accessible via SuiteQL. The following custom fields were tested and returned 400 errors: `custbody_shopify_order_id`, `custbody_amazon_order_id`, `custbody_warehouse`, `custbody_ship_method`, `custbody_order_source`, `custbody_marketplace`.

---

## 12. Empty / Zero-Data Tables

These queries execute successfully but return 0 rows. The record types exist but contain no data in this NetSuite account:

| Record Type | Transaction Type Code |
|-------------|----------------------|
| Purchase Orders | `PurchOrd` |
| Transfer Orders | `TrnfrOrd` |
| Return Authorizations (RMA) | `RtnAuth` |
| Credit Memos | `CustCred` |
| Vendor Bills | `VendBill` |

**Implication:** Purchase Orders are not being created in NetSuite (or not accessible via this integration role). This means we cannot calculate lead times from PO-to-receipt data — lead times must remain manual.

---

## 13. Inaccessible Tables

These queries return **400 Bad Request** errors, indicating the integration role lacks permission or the fields don't exist:

| Category | What was attempted |
|----------|--------------------|
| **Inventory Items (standalone)** | `inventoryItem` without JOIN to locations fails. Fields like `created`, `lastModifiedDate`, `description`, `upcCode`, `weight`, `salesDescription`, `purchaseDescription` are not accessible. |
| **Customer records** | `customer` table is completely inaccessible |
| **Vendor extended fields** | `category`, `terms`, `currency`, `defaultAddress` on vendor |
| **Transaction aggregation** | `COUNT(*) ... GROUP BY t.type` on transaction fails |
| **TransactionLine direct** | Querying `transactionLine` without JOINing to `transaction` and `item` fails for many fields including `grossAmount`, `taxAmount`, `taxCode`, `memo`, `isfullyshipped` |
| **Custom fields** | All `custbody_*` fields except `custbody_fa_channel` |
| **Admin / Config tables** | `subsidiary`, `department`, `classification`, `currency`, `employee`, `unitsType`, `taxType`, `shipItem`, `paymentMethod`, `term` |

---

## 14. Pagination & Chunking

### API Limits
- **Max rows per request:** 1,000
- **Max offset:** 100,000 (hard NetSuite limit)
- **Implication:** Any query returning >100K rows MUST be date-chunked

### Pagination Pattern
```python
offset = 0
while True:
    data = execute_suiteql(query, limit=1000, offset=offset)
    items = data.get("items", [])
    all_items.extend(items)
    if not data.get("hasMore", False):
        break
    offset += 1000
```

### Monthly Chunking (for large datasets)
Sales data exceeds 100K rows over 18 months, so it must be fetched in monthly chunks:

```python
# Build date ranges: [(2024-09-01, 2024-09-30), (2024-10-01, 2024-10-31), ...]
chunks = _build_monthly_chunks(start_date, end_date)
for chunk_start, chunk_end in chunks:
    rows = fetch_sales(chunk_start, chunk_end)
```

### Performance Notes
- Simple queries (vendor list, locations): **0.5–1.0s**
- Joined queries (item + locations): **1.0–1.5s**
- Heavy transaction line queries: **8–12s** per page
- Full 18-month sales sync: **~3 minutes** (monthly chunks)

---

## 15. Status Code Reference

### Sales Order Status Codes
| Code | Meaning |
|------|---------|
| `A` | Pending Approval |
| `B` | Pending Fulfillment |
| `C` | Cancelled |
| `D` | Partially Fulfilled |
| `G` | Partially Fulfilled / Billed |
| `H` | Fully Billed (Closed) |

### Item Fulfillment Status
| Code | Meaning |
|------|---------|
| `C` | Shipped |

### Item Receipt Status
| Code | Meaning |
|------|---------|
| `Y` | Received |

### Inventory Adjustment Status
| Code | Meaning |
|------|---------|
| `Y` | Posted |

### Invoice Status
| Code | Meaning |
|------|---------|
| `B` | Open (unpaid) |

---

## Currently Used in the App

The forecast app currently pulls from these sources:

| Data | Query | Sync Function |
|------|-------|---------------|
| Inventory stock | Aggregated stock + vendor JOIN | `sync_inventory()` |
| Sales transactions | SalesOrd lines with `tl.quantity < 0` | `sync_sales()` |
| Channel | `custbody_fa_channel` on SalesOrd | Mapped via `_map_channel()` |

## Not Yet Used (Potential Additions)

| Data | Potential Use |
|------|---------------|
| `qty_on_order` (stock aggregated) | Show incoming stock in dashboard |
| `qty_backordered` | Show customer backorder demand |
| `qty_committed` | Show committed-but-not-shipped quantity |
| Item Costs (`cost`, `averageCost`) | Real margin calculation (replace $0 product_cost) |
| Price Levels | Show retail vs wholesale pricing |
| Item Receipts | Calculate actual historical lead times |
| Kit / Assembly items | Identify bundled products for component-level forecasting |
| Invoice lines with `rate` | Alternative revenue source if SO revenue is $0 |
| Locations | Per-warehouse stock view in dashboard |
| Inventory Adjustments | Detect shrinkage, write-offs impacting stock |
