import threading
from datetime import datetime, timezone


class SyncStatus:
    def __init__(self):
        self._lock = threading.Lock()
        self._state = "idle"
        self._phase = ""
        self._progress = 0
        self._message = ""
        self._last_sync_at: str | None = None
        self._error: str | None = None

    def get(self) -> dict:
        with self._lock:
            return {
                "state": self._state,
                "phase": self._phase,
                "progress": self._progress,
                "message": self._message,
                "last_sync_at": self._last_sync_at,
                "error": self._error,
            }

    def start(self):
        with self._lock:
            self._state = "running"
            self._phase = "starting"
            self._progress = 0
            self._message = "Starting sync..."
            self._error = None

    def update(self, phase: str, progress: int, message: str):
        with self._lock:
            self._phase = phase
            self._progress = min(progress, 100)
            self._message = message

    def complete(self, message: str):
        with self._lock:
            self._state = "completed"
            self._phase = "done"
            self._progress = 100
            self._message = message
            self._last_sync_at = datetime.now(timezone.utc).isoformat()
            self._error = None

    def fail(self, error: str):
        with self._lock:
            self._state = "error"
            self._phase = "failed"
            self._message = error
            self._error = error

    @property
    def is_running(self) -> bool:
        with self._lock:
            return self._state == "running"


sync_status = SyncStatus()
