"""Test NetSuite API access for previously blocked/empty queries."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("CORS_ORIGINS", "http://localhost")

from services.netsuite_client import execute_suiteql

def test_query(label, query):
    try:
        data = execute_suiteql(query, limit=5)
        items = data.get("items", [])
        total = data.get("totalResults", len(items))
        has_more = data.get("hasMore", False)
        print(f"  OK  {label}: {total} rows" + (" (has more)" if has_more else ""))
        if items:
            print(f"       Sample: {items[0]}")
        return True
    except Exception as e:
        status = getattr(getattr(e, 'response', None), 'status_code', '?')
        print(f"  FAIL {label}: {status} - {str(e)[:100]}")
        return False

print("=== PREVIOUSLY EMPTY (0 rows) ===")
test_query("Purchase Orders", "SELECT t.id, t.tranId, t.tranDate, t.status FROM transaction t WHERE t.type = 'PurchOrd'")
test_query("Transfer Orders", "SELECT t.id, t.tranId, t.tranDate FROM transaction t WHERE t.type = 'TrnfrOrd'")
test_query("Return Authorizations", "SELECT t.id, t.tranId, t.tranDate FROM transaction t WHERE t.type = 'RtnAuth'")
test_query("Credit Memos", "SELECT t.id, t.tranId, t.tranDate FROM transaction t WHERE t.type = 'CustCred'")
test_query("Vendor Bills", "SELECT t.id, t.tranId, t.tranDate FROM transaction t WHERE t.type = 'VendBill'")

print()
print("=== PREVIOUSLY INACCESSIBLE (400 errors) ===")
test_query("Custom Record (Channel)", "SELECT id, name FROM customrecord4")
test_query("Customer records", "SELECT id, companyName FROM customer")
test_query("Inventory standalone", "SELECT id, itemId, description, weight FROM inventoryItem WHERE ROWNUM <= 5")
test_query("Custom fields (shopify)", "SELECT t.id, t.custbody_shopify_order_id FROM transaction t WHERE ROWNUM <= 5")
test_query("Custom fields (amazon)", "SELECT t.id, t.custbody_amazon_order_id FROM transaction t WHERE ROWNUM <= 5")
test_query("Custom fields (warehouse)", "SELECT t.id, t.custbody_warehouse FROM transaction t WHERE ROWNUM <= 5")
test_query("Subsidiary", "SELECT id, name FROM subsidiary")
test_query("Department", "SELECT id, name FROM department")
test_query("Employee", "SELECT id, firstName, lastName FROM employee")

print()
print("=== NEW TESTS (PO detail if accessible) ===")
test_query("PO Lines", """
    SELECT tl.transaction, t.tranId, tl.item, item.itemId AS sku, tl.quantity, t.tranDate
    FROM transactionLine tl
    JOIN transaction t ON t.id = tl.transaction
    JOIN item ON item.id = tl.item
    WHERE t.type = 'PurchOrd'
""")
test_query("PO with expected date", """
    SELECT t.id, t.tranId, t.tranDate, t.expectedReceiptDate, t.status
    FROM transaction t WHERE t.type = 'PurchOrd'
""")
test_query("Item receipt with PO ref", """
    SELECT t.id, t.tranId, t.tranDate, t.createdFrom
    FROM transaction t WHERE t.type = 'ItemRcpt'
""")
