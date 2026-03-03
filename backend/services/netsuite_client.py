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
    limit = 1000

    # First request to get totalResults
    first = execute_suiteql(query, limit=limit, offset=0)
    total = first.get("totalResults", len(first.get("items", [])))
    first_items = first.get("items", [])

    if progress_callback and total:
        progress_callback(len(first_items), total)

    if not first.get("hasMore", False):
        return first_items

    # Calculate all remaining offsets
    offsets = list(range(limit, total, limit))

    # Fetch remaining pages in parallel
    # Each thread gets its own OAuth session (they're not thread-safe)
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
                if progress_callback and total:
                    progress_callback(fetched_count, total)

    # Reassemble in order
    all_items: list[dict] = []
    for offset in sorted(results.keys()):
        all_items.extend(results[offset])

    return all_items
