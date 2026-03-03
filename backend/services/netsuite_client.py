import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from typing import Callable

from requests_oauthlib import OAuth1Session


NETSUITE_ACCOUNT_ID = os.environ.get("NETSUITE_ACCOUNT_ID", "")
NETSUITE_CONSUMER_KEY = os.environ.get("NETSUITE_CONSUMER_KEY", "")
NETSUITE_CONSUMER_SECRET = os.environ.get("NETSUITE_CONSUMER_SECRET", "")
NETSUITE_TOKEN_KEY = os.environ.get("NETSUITE_TOKEN_KEY", "")
NETSUITE_TOKEN_SECRET = os.environ.get("NETSUITE_TOKEN_SECRET", "")


def is_configured() -> bool:
    return all([
        NETSUITE_ACCOUNT_ID,
        NETSUITE_CONSUMER_KEY,
        NETSUITE_CONSUMER_SECRET,
        NETSUITE_TOKEN_KEY,
        NETSUITE_TOKEN_SECRET,
    ])


def _get_session() -> OAuth1Session:
    return OAuth1Session(
        client_key=NETSUITE_CONSUMER_KEY,
        client_secret=NETSUITE_CONSUMER_SECRET,
        resource_owner_key=NETSUITE_TOKEN_KEY,
        resource_owner_secret=NETSUITE_TOKEN_SECRET,
        signature_method="HMAC-SHA256",
        realm=NETSUITE_ACCOUNT_ID,
    )


def _suiteql_url() -> str:
    account = NETSUITE_ACCOUNT_ID.replace("_", "-").lower()
    return f"https://{account}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql"


def execute_suiteql(query: str, limit: int = 1000, offset: int = 0, session: OAuth1Session | None = None) -> dict:
    s = session or _get_session()
    resp = s.post(
        _suiteql_url(),
        headers={
            "Content-Type": "application/json",
            "Prefer": "transient",
        },
        json={"q": query},
        params={"limit": limit, "offset": offset},
    )
    resp.raise_for_status()
    return resp.json()


def _paginate_single_query(
    query: str,
    progress_callback: Callable[[int, int], None] | None = None,
    max_workers: int = 5,
    total_offset: int = 0,
    grand_total: int | None = None,
) -> list[dict]:
    """Paginate a single query that stays within NetSuite's 100K offset limit."""
    limit = 1000
    max_offset = 99000  # NetSuite 404s beyond offset 100K

    # First request to get totalResults
    first = execute_suiteql(query, limit=limit, offset=0)
    total = first.get("totalResults", len(first.get("items", [])))
    first_items = first.get("items", [])
    report_total = grand_total or total

    if progress_callback:
        progress_callback(total_offset + len(first_items), report_total)

    if not first.get("hasMore", False):
        return first_items

    # Cap offsets at max_offset to avoid 404
    capped_total = min(total, max_offset + limit)
    offsets = list(range(limit, capped_total, limit))

    results: dict[int, list[dict]] = {0: first_items}
    fetched_count = len(first_items)
    lock = Lock()

    def fetch_page(offset: int) -> tuple[int, list[dict]]:
        session = _get_session()
        data = execute_suiteql(query, limit=limit, offset=offset, session=session)
        return offset, data.get("items", [])

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(fetch_page, o): o for o in offsets}
        for future in as_completed(futures):
            offset, items = future.result()
            with lock:
                results[offset] = items
                fetched_count += len(items)
                if progress_callback:
                    progress_callback(total_offset + fetched_count, report_total)

    # Reassemble in order
    all_items: list[dict] = []
    for offset in sorted(results.keys()):
        all_items.extend(results[offset])

    return all_items


def execute_suiteql_paginated(
    query: str,
    progress_callback: Callable[[int, int], None] | None = None,
    max_workers: int = 5,
) -> list[dict]:
    """Paginate a SuiteQL query. Handles NetSuite's 100K offset limit
    by splitting into date-range chunks for large result sets."""
    limit = 1000

    # Probe total size first
    first = execute_suiteql(query, limit=1, offset=0)
    total = first.get("totalResults", 0)

    if total <= 100000:
        # Fits within NetSuite's offset limit — single parallel fetch
        return _paginate_single_query(query, progress_callback, max_workers)

    # Large result set — split by quarterly date ranges
    # Detect the date column pattern in the query to build chunked queries
    from datetime import date, timedelta

    today = date.today()
    chunk_months = 3  # quarterly chunks to stay under 100K per chunk
    chunks: list[tuple[str, str]] = []
    end = today
    start_limit = today - timedelta(days=18 * 30)  # ~18 months back

    while end > start_limit:
        chunk_start = end - timedelta(days=chunk_months * 30)
        if chunk_start < start_limit:
            chunk_start = start_limit
        chunks.append((chunk_start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")))
        end = chunk_start - timedelta(days=1)

    all_items: list[dict] = []

    for chunk_start, chunk_end in reversed(chunks):
        # Replace the date filter in the query with a specific range
        chunk_query = query.replace(
            "AND t.tranDate >= ADD_MONTHS(SYSDATE, -18)",
            f"AND t.tranDate >= TO_DATE('{chunk_start}', 'YYYY-MM-DD') AND t.tranDate <= TO_DATE('{chunk_end}', 'YYYY-MM-DD')"
        )
        chunk_items = _paginate_single_query(
            chunk_query, progress_callback, max_workers,
            total_offset=len(all_items), grand_total=total,
        )
        all_items.extend(chunk_items)

    return all_items
