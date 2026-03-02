import os
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
    return f"https://{account}.suitetalk.api.netsuite.com/services/rest/record/v1/suiteql"


def execute_suiteql(query: str, limit: int = 1000, offset: int = 0) -> dict:
    session = _get_session()
    resp = session.post(
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
) -> list[dict]:
    all_items: list[dict] = []
    offset = 0
    limit = 1000
    total = None

    while True:
        data = execute_suiteql(query, limit=limit, offset=offset)
        items = data.get("items", [])
        all_items.extend(items)

        if total is None:
            total = data.get("totalResults", len(items))

        if progress_callback and total:
            progress_callback(len(all_items), total)

        if not data.get("hasMore", False):
            break

        offset += limit

    return all_items
