import RPi.GPIO as GPIO
import spidev
import requests
import time
import os
from datetime import datetime, timezone, timedelta

MQ2_PIN    = 17
FLAME_PIN  = 27
SERVER_URL = os.getenv("FIRE_SERVER_URL", "http://localhost:5000/api/event")
KST        = timezone(timedelta(hours=9))

GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)
GPIO.setup(MQ2_PIN,   GPIO.IN)
GPIO.setup(FLAME_PIN, GPIO.IN)

spi = spidev.SpiDev()
spi.open(0, 0)
spi.max_speed_hz = 1350000

def read_channel(channel):
    adc = spi.xfer2([1, (8 + channel) << 4, 0])
    return ((adc[1] & 3) << 8) + adc[2]

print("센서 모니터링 시작 (Ctrl+C 종료)")
print("-" * 50)

try:
    while True:
        mq2_raw   = GPIO.input(MQ2_PIN)
        flame_raw = GPIO.input(FLAME_PIN)
        mq2_status   = "감지됨" if mq2_raw   == 0 else "정상"
        flame_status = "감지됨" if flame_raw == 0 else "정상"

        mq2_ao   = read_channel(0)
        flame_ao = read_channel(1)

        print(f"[MQ-2] {mq2_status} (DO={mq2_raw}, AO={mq2_ao}) | [불꽃] {flame_status} (DO={flame_raw}, AO={flame_ao})")

        payload = {
            "ts":           datetime.now(KST).isoformat(),
            "mq2_raw":      mq2_raw,
            "mq2_status":   mq2_status,
            "flame_raw":    flame_raw,
            "flame_status": flame_status,
            "mq2_ao":       mq2_ao,
            "flame_ao":     flame_ao,
        }

        try:
            resp = requests.post(SERVER_URL, json=payload, timeout=3)
            print(f"  → 전송 성공 ({resp.status_code})")
        except Exception as e:
            print(f"  → 전송 실패: {e}") 

        time.sleep(2)

except KeyboardInterrupt:
    print("\n종료")
finally:
    GPIO.cleanup()
    spi.close()
