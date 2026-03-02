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
    else:
        # Standard inventory format: Name, Display Name, On Hand
        df = df.rename(columns={
            "Name": "sku",
            "Display Name": "display_name",
            "On Hand": "on_hand",
        })
        df["manufacturer"] = ""

    df = df[["sku", "display_name", "on_hand", "manufacturer"]].copy()
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
    conn.execute("DELETE FROM inventory")
    rows = df.to_dict("records")
    conn.executemany(
        "INSERT INTO inventory (sku, display_name, on_hand, is_sample, manufacturer) VALUES (:sku, :display_name, :on_hand, :is_sample, :manufacturer)",
        rows,
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
