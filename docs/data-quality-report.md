# FlooringInc Data Quality Audit Report
**Date:** March 3, 2026
**Dataset:** 21,540 inventory SKUs | 411,011 sales transaction lines | Oct 2024 – Mar 2026

---

## CRITICAL ISSUE: Velocity is massively inflated

the netsuite query pulls ALL transaction lines with negative quantity (items going out), not just actual sales. this means it's also pulling item fulfillments, transfer orders, and other internal movements that have $0 revenue but duplicate the same quantity.

**impact:**
- 346,860 out of 411,011 lines (84.4%) have $0 revenue — these are NOT real sales
- 142,549 lines are exact duplicates (same date + sku + qty + channel + revenue)
- velocity calculations are inflated anywhere from 2x to 55x depending on the SKU

**example — Rainbow Play Mats (4202_1975_9097):**
- current velocity: 83.1 units/day (using all lines)
- actual velocity: 1.5 units/day (using only revenue lines)
- that's a **55x overcount**

**how many SKUs are affected (last 90 days):**

| Inflation Level | SKU Count |
|---|---|
| Infinite (only zero-rev lines, no real sales) | 1,768 |
| >10x inflated | 23 |
| 5-10x inflated | 35 |
| 2-5x inflated | 170 |
| 1.2-2x inflated | 240 |
| OK (<1.2x) | 855 |

**fix:** the netsuite SuiteQL query needs a transaction type filter (e.g. `t.type IN ('SalesOrd', 'CustInvc')`) to only pull actual sales, not fulfillments/transfers. alternatively we can filter out $0-revenue lines during import.

---

## QUESTIONS FOR THE TEAM

### 1. zero-revenue lines — what are they exactly?

84.4% of all transaction lines have $0 revenue. breakdown by channel:

| Channel | Zero-Rev Lines | Has-Rev Lines | % Zero-Rev Qty |
|---|---|---|---|
| Other | 213,045 | 2,861 | 86.9% |
| FI (website) | 101,505 | 50,547 | 15.7% |
| Amazon Seller Central | 30,517 | 10,226 | 98.5% |
| Walmart | 1,398 | 408 | 97.9% |
| eBay | 395 | 109 | 98.1% |

for amazon/walmart/ebay almost all lines are $0 revenue — this suggests the revenue is on a separate Invoice transaction while the Item Fulfillment has quantity but no revenue.

**question:** can you confirm these are Item Fulfillments and Transfer Orders? should we filter the netsuite query to only pull Sales Orders + Invoices?

### 2. "Other" channel — 215,906 transactions

over half of all sales lines are mapped to "Other" channel. the current channel mapping only covers: Magento2→FI, Amazon, AmazonVendorCentral, Walmart, eBay.

**question:** what other channel values exist in netsuite's `custbody_fa_channel` field? are there channels like Home Depot, Wayfair, or others we should add to the mapping? should we pull the raw channel value from netsuite so we can see what's being classified as "Other"?

### 3. potential duplicate transactions — 10,271 groups

there are 10,271 groups where the exact same line (date + sku + qty + channel + revenue) appears 4 or more times. worst cases have 50+ copies of the same line.

**example:** SKU 4202_1975_9097 on 2025-07-08 has qty=5 appearing 51 times with $0 revenue, channel "Other"

this is likely caused by multiple transaction types for the same order (Sales Order, Item Fulfillment, Invoice each create a line). filtering by transaction type should eliminate most of these.

**question:** are there any legitimate reasons for the same exact line to appear 50+ times on the same date?

### 4. SKUs in sales but NOT in inventory — 33 SKUs

33 SKUs have sales data but don't exist in the inventory table. some have "_old", "_delete", or "Delete" in the SKU name:

- `9876_21013_90203OLD` — ProStep Dance Floor Rolls ($5,796 revenue)
- `9876_21011_90194_delete` — ProStep Dance Floor Rolls ($4,050 revenue)
- `9876_21010_90190_old` — ProStep Dance Floor Rolls ($4,112 revenue)
- `9876_21010_90193Delete` — ProStep Dance Floor Rolls ($1,425 revenue)
- `13273_100219_81851` — Helios Artificial Grass Deck Tiles ($25,815 revenue)

**question:** are these discontinued/renamed SKUs? should the old SKU sales be mapped to the new SKU for accurate velocity calculations?

### 5. 11,458 SKUs with stock but zero sales history

there are 11,458 non-sample SKUs that have inventory on hand but zero sales transactions in our dataset (Oct 2024 - present).

**question:** are these new products, very slow movers, or is there a SKU mapping issue between inventory and sales? should we be concerned about this dead stock?

### 6. dead stock — high inventory, no recent sales

20+ SKUs have >100 units with no sales in 180 days. notable:
- US Rubber "Biggie Smallz" rolls — 16,000 units each, multiple colors, zero sales
- EZ Flex Home Wrestling Mats — 16,000 units, zero sales

**question:** are these new products awaiting launch, or actual dead stock? the 16,000 unit quantities look like they might be roll material measured in square feet rather than individual units?

### 7. price inconsistencies

some SKUs show wildly different pricing across transactions:

| SKU | Min $/unit | Avg $/unit | Max $/unit |
|---|---|---|---|
| 1005_874_89695 | $7.16 | $136.82 | $2,503.25 |
| 9151_10312_43132 | $29.94 | $157.41 | $1,047.90 |
| 1007_876_82297 | $6.30 | $21.51 | $969.30 |
| 9876_11751_49259 | $3.00 | $16.99 | $529.99 |

**question:** are these bulk pricing discounts, different unit sizes on the same SKU, or data issues?

### 8. very high single-transaction quantities

3,227 transactions have qty > 500 in a single line. top ones are 50,000+ units:
- 7649_7714_34789 (Tatami Male Edge): 52,056 units in one transaction
- 7266_9555_40648 (Nitro Tiles): 35,823 units in one transaction
- 9205_10368_43359 (Helios Deck Tiles): 24,217 units in one transaction

all from "Other" channel. these might be warehouse receipts or bulk transfers rather than actual sales.

**question:** are these legitimate sales orders or internal inventory movements?

### 9. "Incstores (temporary)" manufacturer — 381 SKUs

381 SKUs are assigned to manufacturer "Incstores (temporary)".

**question:** is this a placeholder? should these be reassigned to actual manufacturers?

### 10. SKU with space in ID

one inventory SKU has a space in the ID: `14047_21149_ 90837` (Custom Logo Floor Mats, 8,000 units)

**question:** is this a typo in netsuite? it might cause matching issues between inventory and sales.

---

## RECOMMENDED FIXES (after team confirms)

1. **add transaction type filter to netsuite query** — only pull `SalesOrd` and/or `CustInvc` to eliminate fulfillments, transfers, etc.
2. **add raw channel field to sales data** — store the original `custbody_fa_channel` value before mapping, so we can see what's being classified as "Other"
3. **expand channel mapping** — add Home Depot, Wayfair, and any other channels the team identifies
4. **handle old/deleted SKUs** — either map old SKUs to new ones or exclude them
5. **deduplicate existing data** — remove duplicate transaction lines
6. **recalculate all velocities** — after fixing the data, velocity numbers will be dramatically different (lower and more accurate)

---

## DATA OVERVIEW

| Metric | Value |
|---|---|
| Inventory SKUs | 21,540 |
| Sales lines (total) | 411,011 |
| Sales lines (unique, deduped) | 268,462 |
| Sales lines (revenue > 0) | 64,151 |
| Date range | Oct 10, 2024 – Mar 3, 2026 |
| Channels | FI, Amazon Seller Central, Walmart, eBay, Other |
| Total revenue | $36,920,082 |
| Sample SKUs | 6,528 |
| SKUs with manufacturer | 18,994 |
| SKUs missing manufacturer | 2,546 |
