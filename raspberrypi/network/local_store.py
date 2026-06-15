# network/local_store.py
# 네트워크 오프라인 시 SQLite 로컬 저장 + 복구 후 재전송

import json
import logging
import os
import sqlite3
from datetime import datetime, timezone

from config import settings

log = logging.getLogger(__name__)

_DB_PATH = settings.LOCAL_DB_PATH


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pending_events (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            ts        TEXT    NOT NULL,
            payload   TEXT    NOT NULL,
            retries   INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.commit()
    return conn


def save(payload: dict):
    """전송 실패한 이벤트를 로컬 DB에 저장"""
    ts = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO pending_events (ts, payload) VALUES (?, ?)",
            (ts, json.dumps(payload, ensure_ascii=False)),
        )
    log.info("[LOCAL STORE] 이벤트 저장 완료 (ts=%s)", ts)


def load_pending() -> list[tuple[int, dict]]:
    """미전송 이벤트 목록 반환 [(id, payload), ...]"""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, payload FROM pending_events ORDER BY id"
        ).fetchall()
    return [(row[0], json.loads(row[1])) for row in rows]


def delete(event_id: int):
    """전송 성공한 이벤트 삭제"""
    with _connect() as conn:
        conn.execute("DELETE FROM pending_events WHERE id = ?", (event_id,))
    log.debug("[LOCAL STORE] 이벤트 id=%d 삭제", event_id)


def increment_retry(event_id: int):
    with _connect() as conn:
        conn.execute(
            "UPDATE pending_events SET retries = retries + 1 WHERE id = ?",
            (event_id,),
        )
