# alerts/local_alert.py
# 부저 + LED 로컬 경고

import logging
import threading
import time
from config import settings

log = logging.getLogger(__name__)

try:
    import RPi.GPIO as GPIO
    _GPIO_AVAILABLE = True
except ImportError:
    _GPIO_AVAILABLE = False
    log.warning("RPi.GPIO 없음 — 더미 모드로 실행")

_alert_active = False
_alert_thread: threading.Thread | None = None


def setup():
    if not _GPIO_AVAILABLE:
        return
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(settings.BUZZER_PIN,    GPIO.OUT, initial=GPIO.LOW)
    GPIO.setup(settings.LED_RED_PIN,   GPIO.OUT, initial=GPIO.LOW)
    GPIO.setup(settings.LED_GREEN_PIN, GPIO.OUT, initial=GPIO.HIGH)


def _blink_loop():
    """경고 중 부저·LED 점멸 (별도 스레드)"""
    while _alert_active:
        if _GPIO_AVAILABLE:
            GPIO.output(settings.BUZZER_PIN,  GPIO.HIGH)
            GPIO.output(settings.LED_RED_PIN, GPIO.HIGH)
        else:
            log.debug("[ALERT] 부저·LED ON")
        time.sleep(0.5)
        if _GPIO_AVAILABLE:
            GPIO.output(settings.BUZZER_PIN,  GPIO.LOW)
            GPIO.output(settings.LED_RED_PIN, GPIO.LOW)
        else:
            log.debug("[ALERT] 부저·LED OFF")
        time.sleep(0.5)


def trigger(event_type: str):
    """경고 시작"""
    global _alert_active, _alert_thread
    if _alert_active:
        return
    log.warning("[LOCAL ALERT] %s 이벤트 감지 → 경고 시작", event_type)
    _alert_active = True
    if _GPIO_AVAILABLE:
        GPIO.output(settings.LED_GREEN_PIN, GPIO.LOW)
    _alert_thread = threading.Thread(target=_blink_loop, daemon=True)
    _alert_thread.start()


def clear():
    """경고 해제"""
    global _alert_active
    if not _alert_active:
        return
    log.info("[LOCAL ALERT] 경고 해제")
    _alert_active = False
    if _GPIO_AVAILABLE:
        GPIO.output(settings.BUZZER_PIN,    GPIO.LOW)
        GPIO.output(settings.LED_RED_PIN,   GPIO.LOW)
        GPIO.output(settings.LED_GREEN_PIN, GPIO.HIGH)


def cleanup():
    clear()
    if _GPIO_AVAILABLE:
        GPIO.cleanup([
            settings.BUZZER_PIN,
            settings.LED_RED_PIN,
            settings.LED_GREEN_PIN,
        ])
