"""
Chat memory system: session (in-memory) and long-term (SQLite).
"""

import time
from database import get_connection

# Session memory: in-memory dict keyed by session_id
# Each entry: {"messages": [...], "last_access": timestamp}
_sessions: dict[str, dict] = {}
MAX_SESSION_MESSAGES = 20
SESSION_TTL_SECONDS = 2 * 60 * 60  # 2 hours


def get_session_messages(session_id: str) -> list[dict]:
    """Get message history for a session."""
    _cleanup_expired()
    session = _sessions.get(session_id)
    if not session:
        return []
    session["last_access"] = time.time()
    return session["messages"]


def add_session_message(session_id: str, role: str, content: str):
    """Add a message to session history."""
    if session_id not in _sessions:
        _sessions[session_id] = {"messages": [], "last_access": time.time()}
    session = _sessions[session_id]
    session["messages"].append({"role": role, "content": content})
    session["last_access"] = time.time()
    # Trim to max
    if len(session["messages"]) > MAX_SESSION_MESSAGES:
        session["messages"] = session["messages"][-MAX_SESSION_MESSAGES:]


def clear_session(session_id: str):
    """Clear a session's message history."""
    _sessions.pop(session_id, None)


def _cleanup_expired():
    """Remove expired sessions."""
    now = time.time()
    expired = [sid for sid, s in _sessions.items() if now - s["last_access"] > SESSION_TTL_SECONDS]
    for sid in expired:
        del _sessions[sid]


# --- Long-term memory (SQLite) ---

def save_long_term_memory(key: str, content: str):
    """Save a fact to long-term memory."""
    conn = get_connection()
    conn.execute("""
        INSERT INTO chat_memory (key, content) VALUES (?, ?)
    """, (key, content))
    conn.commit()
    conn.close()


def get_all_long_term_memories() -> list[dict]:
    """Load all long-term memories."""
    conn = get_connection()
    rows = conn.execute("""
        SELECT key, content, created_at FROM chat_memory
        ORDER BY created_at DESC LIMIT 50
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_long_term_memory(memory_id: int):
    """Delete a specific memory."""
    conn = get_connection()
    conn.execute("DELETE FROM chat_memory WHERE id = ?", (memory_id,))
    conn.commit()
    conn.close()
