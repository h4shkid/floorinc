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


def execute_suiteql_paginated(
    query: str,
    progress_callback: Callable[[int, int], None] | None = None,
    max_workers: int = 5,
) -> list[dict]:
    """Paginate a SuiteQL query with parallel fetching.
    Follows hasMore instead of trusting totalResults (NetSuite caps it at 5000).
    Stays within NetSuite's 100K offset limit — caller must chunk large queries."""
    limit = 1000
    max_offset = 99000

    # First request — sequential to discover hasMore
    first = execute_suiteql(query, limit=limit, offset=0)
    first_items = first.get("items", [])

    if not first.get("hasMore", False):
        return first_items

    # Compute offsets up to the 100K cap
    offsets = list(range(limit, max_offset + limit, limit))

    results: dict[int, list[dict]] = {0: first_items}
    fetched_count = len(first_items)
    done = False
    lock = Lock()

    def fetch_page(offset: int) -> tuple[int, list[dict], bool]:
        session = _get_session()
        data = execute_suiteql(query, limit=limit, offset=offset, session=session)
        items = data.get("items", [])
        has_more = data.get("hasMore", False)
        return offset, items, has_more

    # Fetch in batches to allow early stop when hasMore=False
    batch_size = max_workers * 4
    for batch_start in range(0, len(offsets), batch_size):
        if done:
            break
        batch = offsets[batch_start:batch_start + batch_size]
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            futures = {pool.submit(fetch_page, o): o for o in batch}
            for future in as_completed(futures):
                offset, items, has_more = future.result()
                with lock:
                    results[offset] = items
                    fetched_count += len(items)
                    if progress_callback:
                        progress_callback(fetched_count, fetched_count if has_more else fetched_count)
                    if not has_more and offset == max(o for o in results.keys()):
                        done = True

    # Reassemble in order
    all_items: list[dict] = []
    for offset in sorted(results.keys()):
        all_items.extend(results[offset])

    return all_items
