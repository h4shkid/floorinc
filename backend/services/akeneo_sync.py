import traceback
from database import get_connection
from services.akeneo_client import get_product, update_promise_date
from services.sync_status import SyncStatus

akeneo_sync_status = SyncStatus()
akeneo_preview_status = SyncStatus()
_preview_results: list[dict] = []


def calculate_promise_date(
    on_hand: int, qty_committed: int, purchase_orders: list[dict]
) -> str:
    """
    Returns:
      "" if stock available (on_hand > 0 and on_hand covers committed)
      PO expected_date if POs cover the deficit
      "Call for availability" otherwise
    """
    result = calculate_promise_date_detail(on_hand, qty_committed, purchase_orders)
    return result["promise_date"]


def calculate_promise_date_detail(
    on_hand: int, qty_committed: int, purchase_orders: list[dict]
) -> dict:
    """
    Returns a dict with promise_date plus context for preview:
      promise_date, deficit, covering_po, covering_po_date, reason
    """
    available = on_hand - qty_committed

    # Stock covers committed — available to ship
    if on_hand > 0 and available > 0:
        return {
            "promise_date": "",
            "deficit": 0,
            "covering_po": None,
            "covering_po_date": None,
            "reason": "In stock",
        }

    # Either no stock or committed exceeds on_hand
    # Need at least 1 unit from POs (or all of deficit)
    deficit = max(1, qty_committed - on_hand)

    # Sort POs by expected_date ascending (nulls last)
    sorted_pos = sorted(
        purchase_orders,
        key=lambda po: po.get("expected_date") or "9999-12-31",
    )

    cumulative = 0
    for po in sorted_pos:
        remaining = po.get("remaining_qty", 0)
        if remaining <= 0:
            continue
        cumulative += remaining
        if cumulative >= deficit:
            date = po.get("expected_date")
            po_number = po.get("po_number")
            if date:
                return {
                    "promise_date": date,
                    "deficit": deficit,
                    "covering_po": po_number,
                    "covering_po_date": date,
                    "reason": "PO covers deficit",
                }
            return {
                "promise_date": "Call for availability",
                "deficit": deficit,
                "covering_po": po_number,
                "covering_po_date": None,
                "reason": "PO has no date",
            }

    return {
        "promise_date": "Call for availability",
        "deficit": deficit,
        "covering_po": None,
        "covering_po_date": None,
        "reason": "No POs",
    }


def run_akeneo_sync():
    akeneo_sync_status.start()
    try:
        conn = get_connection()

        skus = conn.execute("""
            SELECT sku, on_hand, qty_committed
            FROM inventory
            WHERE is_warehoused = 1
        """).fetchall()

        total = len(skus)
        if total == 0:
            akeneo_sync_status.complete("No warehoused SKUs found")
            conn.close()
            return

        akeneo_sync_status.update("calculating", 5, f"Processing {total} warehoused SKUs...")

        # Get all POs grouped by SKU
        po_rows = conn.execute("""
            SELECT sku, po_number, remaining_qty, expected_date
            FROM purchase_orders
            WHERE remaining_qty > 0
            ORDER BY sku, expected_date ASC
        """).fetchall()
        conn.close()

        po_map: dict[str, list[dict]] = {}
        for row in po_rows:
            sku = row[0]
            if sku not in po_map:
                po_map[sku] = []
            po_map[sku].append({
                "po_number": row[1],
                "remaining_qty": row[2],
                "expected_date": row[3],
            })

        updated = 0
        skipped = 0
        not_in_akeneo = 0
        errors = 0

        for i, row in enumerate(skus):
            sku, on_hand, qty_committed = row[0], row[1], row[2]
            progress = 5 + int((i / total) * 90)
            if i % 20 == 0:
                akeneo_sync_status.update(
                    "syncing",
                    progress,
                    f"Processing {i + 1}/{total} — {updated} updated, {skipped} unchanged",
                )

            new_value = calculate_promise_date(
                on_hand, qty_committed, po_map.get(sku, [])
            )

            try:
                product = get_product(sku)
                if product is None:
                    not_in_akeneo += 1
                    continue

                # Get current promise_date value
                current_values = product.get("values", {}).get("promise_date", [])
                current_value = current_values[0]["data"] if current_values else ""

                if current_value == new_value:
                    skipped += 1
                    continue

                success = update_promise_date(sku, new_value)
                if success:
                    updated += 1
                else:
                    errors += 1
            except Exception:
                errors += 1

        msg = f"Akeneo sync complete: {updated} updated, {skipped} unchanged, {not_in_akeneo} not in Akeneo, {errors} errors"
        akeneo_sync_status.complete(msg)

    except Exception as e:
        akeneo_sync_status.fail(f"Akeneo sync failed: {e}\n{traceback.format_exc()}")


def run_akeneo_preview():
    global _preview_results
    _preview_results = []
    akeneo_preview_status.start()
    try:
        conn = get_connection()

        skus = conn.execute("""
            SELECT sku, on_hand, qty_committed
            FROM inventory
            WHERE is_warehoused = 1
        """).fetchall()

        if len(skus) == 0:
            akeneo_preview_status.complete("No warehoused SKUs found")
            conn.close()
            return

        akeneo_preview_status.update("calculating", 5, f"Checking {len(skus)} warehoused SKUs...")

        po_rows = conn.execute("""
            SELECT sku, po_number, remaining_qty, expected_date
            FROM purchase_orders
            WHERE remaining_qty > 0
            ORDER BY sku, expected_date ASC
        """).fetchall()
        conn.close()

        po_map: dict[str, list[dict]] = {}
        for row in po_rows:
            sku = row[0]
            if sku not in po_map:
                po_map[sku] = []
            po_map[sku].append({
                "po_number": row[1],
                "remaining_qty": row[2],
                "expected_date": row[3],
            })

        changes = []
        unchanged = 0
        not_in_akeneo = 0
        errors = 0
        total = len(skus)

        for i, row in enumerate(skus):
            sku, on_hand, qty_committed = row[0], row[1], row[2]
            progress = 5 + int((i / total) * 90)
            if i % 20 == 0:
                akeneo_preview_status.update(
                    "fetching",
                    progress,
                    f"Checking {i + 1}/{total} — {len(changes)} changes found",
                )

            detail = calculate_promise_date_detail(
                on_hand, qty_committed, po_map.get(sku, [])
            )
            new_value = detail["promise_date"]

            try:
                product = get_product(sku)
                if product is None:
                    not_in_akeneo += 1
                    continue

                current_values = product.get("values", {}).get("promise_date", [])
                current_value = current_values[0]["data"] if current_values else ""

                if current_value == new_value:
                    unchanged += 1
                else:
                    changes.append({
                        "sku": sku,
                        "current_value": current_value or "(empty)",
                        "new_value": new_value or "(empty)",
                        "on_hand": on_hand,
                        "qty_committed": qty_committed,
                        "deficit": detail["deficit"],
                        "covering_po": detail["covering_po"],
                        "covering_po_date": detail["covering_po_date"],
                        "reason": detail["reason"],
                    })
            except Exception:
                errors += 1

        _preview_results = changes
        msg = f"Preview complete: {len(changes)} to update, {unchanged} unchanged, {not_in_akeneo} not in Akeneo, {errors} errors"
        akeneo_preview_status.complete(msg)

    except Exception as e:
        akeneo_preview_status.fail(f"Preview failed: {e}\n{traceback.format_exc()}")


def get_preview_results() -> list[dict]:
    return _preview_results
