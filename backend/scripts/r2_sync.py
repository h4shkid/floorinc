"""
Sync local SQLite database to/from Cloudflare R2.

Instead of pushing 411K rows one-by-one to a cloud database,
just upload/download the entire .db file (~50-100MB) in seconds.
"""

import os
import sqlite3
import time

R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET = os.environ.get("R2_BUCKET", "flooringinc")
R2_KEY = "forecast.db"


def is_configured() -> bool:
    return all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY])


def _get_client():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(retries={"max_attempts": 3}),
    )


def upload_db(local_path: str):
    """Upload local SQLite file to R2."""
    if not is_configured():
        print("R2 not configured, skipping upload")
        return

    # Checkpoint WAL so the .db file is self-contained
    conn = sqlite3.connect(local_path)
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    conn.close()

    client = _get_client()
    file_size = os.path.getsize(local_path)
    print(f"Uploading {local_path} ({file_size / 1024 / 1024:.1f} MB) to R2...")
    t0 = time.time()
    client.upload_file(local_path, R2_BUCKET, R2_KEY)
    elapsed = time.time() - t0
    print(f"Uploaded to R2 in {elapsed:.1f}s")


def download_db(local_path: str) -> bool:
    """Download SQLite file from R2 to local path."""
    if not is_configured():
        print("R2 not configured, skipping download")
        return False

    from botocore.exceptions import ClientError

    client = _get_client()
    try:
        print("Downloading database from R2...")
        t0 = time.time()
        client.download_file(R2_BUCKET, R2_KEY, local_path)
        elapsed = time.time() - t0
        file_size = os.path.getsize(local_path)
        print(f"Downloaded from R2 in {elapsed:.1f}s ({file_size / 1024 / 1024:.1f} MB)")

        # Verify integrity
        conn = sqlite3.connect(local_path)
        result = conn.execute("PRAGMA integrity_check").fetchone()
        conn.close()
        if result[0] != "ok":
            os.remove(local_path)
            print("Downloaded database is corrupt, removed")
            return False

        return True
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey"):
            print("No database found in R2 (first run)")
            return False
        raise
    except Exception as e:
        print(f"R2 download failed: {e}")
        return False
