# config/settings.py
# 센서 핀 번호, 임계값, 서버 설정 등 전역 설정

import os

# ── GPIO 핀 (BCM 번호) ─────────────────────────────────────────────
GAS_SMOKE_PIN   = 17   # MQ-2/MQ-135 디지털 출력 (DO 핀)
FLAME_PIN       = 27   # 불꽃 감지 센서 디지털 출력 (DO 핀)
BUZZER_PIN      = 22   # 액티브 부저
LED_RED_PIN     = 23   # 경고용 빨간 LED
LED_GREEN_PIN   = 24   # 정상 상태 녹색 LED

# ── 아날로그 채널 (MCP3008 SPI 사용 시) ───────────────────────────
USE_ANALOG      = False   # True: AO 값 읽기, False: DO 만 읽기
GAS_SMOKE_CHANNEL = 0     # MCP3008 CH0

# ── 임계값 (아날로그 모드) ─────────────────────────────────────────
GAS_SMOKE_THRESHOLD = 400   # 0‒1023 범위
# 불꽃 센서는 디지털(0/1) 신호만 사용

# ── 폴링 주기 ─────────────────────────────────────────────────────
POLL_INTERVAL_SEC = 2   # 센서 읽기 간격 (초)

# ── 서버 전송 ─────────────────────────────────────────────────────
SERVER_URL      = os.getenv("FIRE_SERVER_URL", "http://localhost:5000/api/event")
SERVER_TIMEOUT  = 5     # 초
API_KEY         = os.getenv("FIRE_API_KEY", "")   # 필요 시 Bearer 토큰

# ── 로컬 저장 (SQLite) ─────────────────────────────────────────────
LOCAL_DB_PATH   = "data/events.db"
RETRY_INTERVAL_SEC = 30   # 오프라인 이벤트 재전송 주기 (초)
