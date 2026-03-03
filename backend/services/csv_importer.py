import pandas as pd
from database import get_connection
from config import DATA_DIR


def import_inventory(csv_path: str | None = None) -> dict:
    path = csv_path or str(DATA_DIR / "inventory.csv")
    df = pd.read_csv(path, encoding="latin-1")

    # Auto-detect CSV format by checking column headers
    if "Item Name" in df.columns:
        # "Items for Mert" format: Item Name, Display Name, Available, Preferred Vendor
        df = df.rename(columns={
            "Item Name": "sku",
            "Display Name": "display_name",
            "Available": "on_hand",
            "Preferred Vendor": "manufacturer",
        })
        df["manufacturer"] = df["manufacturer"].fillna("")
        # Extract drop ship flag
        if "Custom Drop Ship Item" in df.columns:
            df["is_drop_ship"] = df["Custom Drop Ship Item"].map({"Yes": 1, "No": 0}).fillna(0).astype(int)
        else:
            df["is_drop_ship"] = 0
    else:
        # Standard inventory format: Name, Display Name, On Hand
        df = df.rename(columns={
            "Name": "sku",
            "Display Name": "display_name",
            "On Hand": "on_hand",
        })
        df["manufacturer"] = ""
        df["is_drop_ship"] = 0

    df = df[["sku", "display_name", "on_hand", "manufacturer", "is_drop_ship"]].copy()
    df["on_hand"] = pd.to_numeric(df["on_hand"], errors="coerce").fillna(0).astype(int)
    df["display_name"] = df["display_name"].fillna(df["sku"])

    # Flag samples (SKU starts with S- or display name contains "sample")
    df["is_sample"] = (
        df["sku"].str.startswith("S-", na=False)
        | df["display_name"].str.contains("sample", case=False, na=False)
    ).astype(int)

    # Deduplicate by SKU, keeping first occurrence
    df = df.drop_duplicates(subset="sku", keep="first")

    conn = get_connection()
    # Preserve is_warehoused flags before wiping inventory
    existing_flags = {}
    for row in conn.execute("SELECT sku, is_warehoused FROM inventory WHERE is_warehoused = 1").fetchall():
        existing_flags[row["sku"]] = row["is_warehoused"]

    conn.execute("DELETE FROM inventory")
    rows = df.to_dict("records")
    conn.executemany(
        "INSERT INTO inventory (sku, display_name, on_hand, is_sample, manufacturer, is_drop_ship) VALUES (:sku, :display_name, :on_hand, :is_sample, :manufacturer, :is_drop_ship)",
        rows,
    )

    # Restore is_warehoused flags
    if existing_flags:
        conn.executemany(
            "UPDATE inventory SET is_warehoused = 1 WHERE sku = ?",
            [(sku,) for sku in existing_flags],
        )
    conn.commit()
    conn.close()

    skipped = int(df["is_sample"].sum())
    return {"rows_imported": len(rows), "rows_skipped": skipped, "message": f"Imported {len(rows)} inventory SKUs ({skipped} samples flagged)"}


def import_sales(csv_path: str | None = None) -> dict:
    path = csv_path or str(DATA_DIR / "sales.csv")
    df = pd.read_csv(path)

    # Skip "Overall Total" summary row
    df = df[df["SKU"].notna() & (df["SKU"] != "Overall Total")].copy()

    df = df.rename(columns={
        "Order Date": "order_date",
        "SKU": "sku",
        "Quantity": "quantity",
        "Channel": "channel",
        "Product Category": "product_category",
        "Item Revenue/Sale": "item_revenue",
        "Product Cost": "product_cost",
        "Product Name": "product_name",
    })

    # Parse dates to YYYY-MM-DD
    df["order_date"] = pd.to_datetime(df["order_date"], format="%m/%d/%Y", errors="coerce")
    df = df.dropna(subset=["order_date"])
    df["order_date"] = df["order_date"].dt.strftime("%Y-%m-%d")

    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce").fillna(0).astype(int)
    df["item_revenue"] = pd.to_numeric(df["item_revenue"], errors="coerce").fillna(0.0)
    df["product_cost"] = pd.to_numeric(df["product_cost"], errors="coerce").fillna(0.0)

    cols = ["order_date", "sku", "quantity", "channel", "product_category", "item_revenue", "product_cost", "product_name"]
    df = df[cols]

    conn = get_connection()
    conn.execute("DELETE FROM sales")
    rows = df.to_dict("records")

    conn.executemany(
        """INSERT INTO sales (order_date, sku, quantity, channel, product_category, item_revenue, product_cost, product_name)
           VALUES (:order_date, :sku, :quantity, :channel, :product_category, :item_revenue, :product_cost, :product_name)""",
        rows,
    )
    conn.commit()
    conn.close()

    return {"rows_imported": len(rows), "rows_skipped": 0, "message": f"Imported {len(rows)} sales records"}


def import_warehoused(csv_path: str) -> dict:
    """Import TN warehouse SKU list — marks matching inventory rows as is_warehoused=1."""
    df = pd.read_csv(csv_path, encoding="latin-1")

    # SKU is column index 1 (unnamed in TN Items CSV)
    sku_col = df.columns[1] if len(df.columns) > 1 else df.columns[0]
    skus = df[sku_col].dropna().astype(str).str.strip().tolist()

    conn = get_connection()
    # Reset all warehoused flags first
    conn.execute("UPDATE inventory SET is_warehoused = 0")

    updated = 0
    for sku in skus:
        result = conn.execute("UPDATE inventory SET is_warehoused = 1 WHERE sku = ?", (sku,))
        updated += result.rowcount

    conn.commit()
    conn.close()

    return {
        "rows_imported": updated,
        "rows_skipped": len(skus) - updated,
        "message": f"Marked {updated} SKUs as warehoused ({len(skus) - updated} SKUs not found in inventory)",
    }
