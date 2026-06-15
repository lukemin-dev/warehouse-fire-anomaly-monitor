# sensors/flame.py
# 불꽃 감지 센서 (IR 기반 디지털 DO 핀)
# 불꽃 감지 시 DO 핀 LOW(0) 출력

import logging
from config import settings

log = logging.getLogger(__name__)

try:
    import RPi.GPIO as GPIO
    _GPIO_AVAILABLE = True
except ImportError:
    _GPIO_AVAILABLE = False
    log.warning("RPi.GPIO 없음 — 더미 모드로 실행")


def setup():
    if not _GPIO_AVAILABLE:
        return
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(settings.FLAME_PIN, GPIO.IN)


def read() -> dict:
    """
    Returns:
        {
            "triggered": bool,   # True = 불꽃 감지
        }
    """
    if _GPIO_AVAILABLE:
        val = GPIO.input(settings.FLAME_PIN)
        return {"triggered": val == GPIO.LOW}
    return {"triggered": False}


def cleanup():
    if _GPIO_AVAILABLE:
        GPIO.cleanup(settings.FLAME_PIN)
