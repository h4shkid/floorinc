import os
import time
import requests

AKENEO_URL = os.environ.get("AKENEO_URL", "https://incstores.cloud.akeneo.com")
AKENEO_CLIENT_ID = os.environ.get("AKENEO_CLIENT_ID", "")
AKENEO_CLIENT_SECRET = os.environ.get("AKENEO_CLIENT_SECRET", "")
AKENEO_USERNAME = os.environ.get("AKENEO_USERNAME", "")
AKENEO_PASSWORD = os.environ.get("AKENEO_PASSWORD", "")

_token_cache = {"access_token": None, "expires_at": 0}


def is_configured() -> bool:
    return all([AKENEO_CLIENT_ID, AKENEO_CLIENT_SECRET, AKENEO_USERNAME, AKENEO_PASSWORD])


def get_token() -> str:
    if _token_cache["access_token"] and time.time() < _token_cache["expires_at"] - 60:
        return _token_cache["access_token"]

    resp = requests.post(
        f"{AKENEO_URL}/api/oauth/v1/token",
        json={
            "grant_type": "password",
            "username": AKENEO_USERNAME,
            "password": AKENEO_PASSWORD,
        },
        auth=(AKENEO_CLIENT_ID, AKENEO_CLIENT_SECRET),
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    _token_cache["access_token"] = data["access_token"]
    _token_cache["expires_at"] = time.time() + data.get("expires_in", 3600)
    return data["access_token"]


def _headers() -> dict:
    return {"Authorization": f"Bearer {get_token()}", "Content-Type": "application/json"}


def get_product(sku: str) -> dict | None:
    resp = requests.get(
        f"{AKENEO_URL}/api/rest/v1/products/{requests.utils.quote(sku, safe='')}",
        headers=_headers(),
        timeout=30,
    )
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def update_promise_date(sku: str, value: str) -> bool:
    payload = {
        "values": {
            "promise_date": [{"data": value, "locale": None, "scope": None}]
        }
    }
    resp = requests.patch(
        f"{AKENEO_URL}/api/rest/v1/products/{requests.utils.quote(sku, safe='')}",
        headers=_headers(),
        json=payload,
        timeout=30,
    )
    return resp.status_code in (200, 201, 204)
