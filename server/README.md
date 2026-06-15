# Server

Flask 기반 센서 데이터 수신 서버입니다. 라즈베리파이에서 `/api/event`로 전달한 데이터를 SQLite에 저장하고, IsolationForest 모델로 이상 징후를 판정합니다.

## 실행

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export FIRE_DB_PATH=~/warehouse-server/sensor.db
python app.py
```

## 주요 API

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/event` | 센서 데이터 수신 |
| GET | `/api/latest` | 최신 센서 데이터 |
| GET | `/api/readings` | 최근 센서 데이터 |
| GET | `/api/alerts` | 경고 이력 |
| GET | `/api/ai/status` | AI 모델 상태 |
| POST | `/api/ai/retrain` | 모델 재학습 |
| POST | `/api/ai/reset` | 데이터 및 모델 초기화 |
| GET | `/dashboard` | 웹 대시보드 |
