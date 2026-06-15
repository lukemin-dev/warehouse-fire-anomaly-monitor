# sensors/gas_smoke.py
# MQ-2 / MQ-135 가스·연기 센서 읽기
# DO 핀(디지털): 임계값 초과 시 LOW(0) 출력
# AO 핀(아날로그): MCP3008 SPI ADC 경유

import logging
from config import settings

log = logging.getLogger(__name__)

try:
    import RPi.GPIO as GPIO
    _GPIO_AVAILABLE = True
except ImportError:
    _GPIO_AVAILABLE = False
    log.warning("RPi.GPIO 없음 — 더미 모드로 실행")

if settings.USE_ANALOG:
    try:
        import spidev
        _spi = spidev.SpiDev()
        _spi.open(0, 0)
        _spi.max_speed_hz = 1_350_000
    except Exception as e:
        log.warning("SPI 초기화 실패: %s", e)
        _spi = None
else:
    _spi = None


def setup():
    """GPIO 초기화 — main.py 에서 한 번 호출"""
    if not _GPIO_AVAILABLE:
        return
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(settings.GAS_SMOKE_PIN, GPIO.IN)


def _read_adc(channel: int) -> int:
    """MCP3008 SPI ADC 값 읽기 (0‒1023)"""
    if _spi is None:
        return 0
    r = _spi.xfer2([1, (8 + channel) << 4, 0])
    return ((r[1] & 3) << 8) | r[2]


def read() -> dict:
    """
    Returns:
        {
            "triggered": bool,   # True = 임계값 초과 / 위험
            "raw": int | None,   # 아날로그 값 (USE_ANALOG=True 시)
        }
    """
    if settings.USE_ANALOG:
        raw = _read_adc(settings.GAS_SMOKE_CHANNEL)
        triggered = raw >= settings.GAS_SMOKE_THRESHOLD
        return {"triggered": triggered, "raw": raw}

    if _GPIO_AVAILABLE:
        # DO 핀: LOW(0) = 임계 초과, HIGH(1) = 정상
        val = GPIO.input(settings.GAS_SMOKE_PIN)
        return {"triggered": val == GPIO.LOW, "raw": None}

    # 더미
    return {"triggered": False, "raw": None}


def cleanup():
    if _GPIO_AVAILABLE:
        GPIO.cleanup(settings.GAS_SMOKE_PIN)
