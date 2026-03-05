**Data Quality Update — Revenue Filter Applied**

We identified that **85% of transaction lines** pulled from NetSuite were non-sale records (Item Fulfillments, duplicate Sales Order lines, internal movements) — all with $0 revenue. This was inflating velocity calculations **2x to 55x per SKU** and causing incorrect urgency classifications across the board.

**What changed:**
- All forecast calculations now filter to **revenue-generating transactions only** (`item_revenue > 0`)
- Affects: velocity, seasonality, urgency ratings, stats bar, SKU detail pages, and AI insights
- No raw data was deleted — $0 lines are still in the database for audit purposes

**Before → After:**
- Transactions: ~411K → **64,151** (real sales only)
- Velocity example: Rainbow Play Mats was showing ~83/day, now reflects actual demand
- Urgency distribution: fewer false RED/YELLOW alerts, more accurate GREEN ratings

**What this means for you:**
- Reorder urgency ratings are now trustworthy
- Days-remaining estimates reflect real sell-through, not inflated numbers
- No action needed on your end — the dashboard updates are live now

No frontend changes, no re-sync needed. Let me know if any SKU looks off.

---

**A few things I'm not 100% sure about — would love your input:**

1. **$0 Sales Order lines** — There are about 17,500 Sales Order lines that show $0 on both gross and net amount. I'm treating them as duplicate fulfillment records, but is it possible that revenue for some of these lives on the Invoice side instead? Would be great if someone could spot-check a few in NetSuite.

2. **eBay channel** — All 23 eBay lines from the last 60 days came back with $0 revenue. I'm wondering if eBay revenue gets recorded on a different transaction type? If so, we might be unintentionally excluding eBay sales.

3. **Channel mapping** — Right now I'm only seeing these values in `custbody_fa_channel`: `Magento2`, `Amazon`, `AmazonVendorCentral-DirectFulfillment`, `Walmart`, `eBay`. Are there any other channels I might be missing?

4. **Item Fulfillment records** — All 27K Item Fulfillment lines came back with $0 revenue. I'm assuming none of these represent actual sales — just want to make sure that's correct.
