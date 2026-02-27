"""Seed the database with CSV data from data/raw/."""
import sys
from pathlib import Path

# Add parent to path so we can import modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import init_db
from services.csv_importer import import_inventory, import_sales

if __name__ == "__main__":
    print("Initializing database...")
    init_db()

    print("\nImporting inventory...")
    inv_result = import_inventory()
    print(f"  → {inv_result['message']}")

    print("\nImporting sales...")
    sales_result = import_sales()
    print(f"  → {sales_result['message']}")

    print("\nDone! Database seeded successfully.")
