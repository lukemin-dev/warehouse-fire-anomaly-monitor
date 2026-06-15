# network/sender.py
# HTTP POST 로 서버 전송 + 오프라인 시 로컬 저장 큐

import logging
import threading
import time
from datetime import datetime, timezone

import requests

from config import settings
from network import local_store

log = logging.getLogger(__name__)


def _build_headers() -> dict:
    h = {"Content-Type": "application/json"}
    if settings.API_KEY:
        h["Authorization"] = f"Bearer {settings.API_KEY}"
    return h


def send_event(event_type: str, sensor_data: dict) -> bool:
    """
    이벤트를 서버로 전송한다.
    실패 시 로컬 DB에 저장하고 False 반환.
    """
    payload = {
        "ts":        datetime.now(timezone.utc).isoformat(),
        "event":     event_type,
        "data":      sensor_data,
    }
    try:
        resp = requests.post(
            settings.SERVER_URL,
            json=payload,
            headers=_build_headers(),
            timeout=settings.SERVER_TIMEOUT,
        )
        resp.raise_for_status()
        log.info("[SENDER] 전송 성공 → %s  status=%d", event_type, resp.status_code)
        return True
    except Exception as e:
        log.warning("[SENDER] 전송 실패 (%s) → 로컬 저장", e)
        local_store.save(payload)
        return False


def _retry_loop():
    """백그라운드 스레드: 미전송 이벤트 주기적 재전송"""
    while True:
        time.sleep(settings.RETRY_INTERVAL_SEC)
        pending = local_store.load_pending()
        if not pending:
            continue
        log.info("[SENDER] 재전송 시도: %d 건", len(pending))
        for event_id, payload in pending:
            try:
                resp = requests.post(
                    settings.SERVER_URL,
                    json=payload,
                    headers=_build_headers(),
                    timeout=settings.SERVER_TIMEOUT,
                )
                resp.raise_for_status()
                local_store.delete(event_id)
                log.info("[SENDER] 재전송 성공 id=%d", event_id)
            except Exception as e:
                local_store.increment_retry(event_id)
                log.warning("[SENDER] 재전송 실패 id=%d (%s)", event_id, e)


def start_retry_worker():
    """앱 시작 시 한 번 호출 → 데몬 스레드 시작"""
    t = threading.Thread(target=_retry_loop, daemon=True)
    t.start()
    log.info("[SENDER] 재전송 워커 시작 (주기=%ds)", settings.RETRY_INTERVAL_SEC)
