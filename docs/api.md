# API 명세

Flask 서버가 제공하는 주요 API입니다. 라즈베리파이 센서 수집 프로그램과 모바일 앱은 이 API를 통해 데이터를 주고받습니다.

## Base URL

```text
http://<SERVER_HOST>:5000
```

## POST /api/event

라즈베리파이에서 센서 데이터를 서버로 전송합니다.

### Request

```json
{
  "ts": "2026-06-15T14:00:00+09:00",
  "mq2_raw": 1,
  "mq2_status": "정상",
  "flame_raw": 1,
  "flame_status": "정상",
  "mq2_ao": 204,
  "flame_ao": 811
}
```

### Response

```json
{
  "status": "ok",
  "threshold_mq2": 300,
  "threshold_flame": 500
}
```

## GET /api/latest

가장 최근 센서 데이터를 조회합니다.

### Response

```json
{
  "id": 1,
  "ts": "2026-06-15T14:00:00+09:00",
  "mq2_ao": 204,
  "flame_ao": 811,
  "received_at": "2026-06-15 14:00:00",
  "anomaly": 0
}
```

## GET /api/readings

최근 센서 데이터 목록을 조회합니다. 모바일 앱의 그래프 화면에서 사용합니다.

### Response

```json
[
  {
    "id": 1,
    "ts": "2026-06-15T14:00:00+09:00",
    "mq2_ao": 204,
    "flame_ao": 811,
    "received_at": "2026-06-15 14:00:00",
    "anomaly": 0
  }
]
```

## GET /api/alerts

최근 경고 이력을 조회합니다.

### Response

```json
[
  {
    "id": 1,
    "ts": "2026-06-15T14:05:00+09:00",
    "type": "ANOMALY_GAS",
    "mq2_ao": 520,
    "flame_ao": 811,
    "ai_anomaly": 1,
    "resolved_at": null
  }
]
```

## GET /api/ai/status

AI 모델 상태와 자동 계산된 임계값을 조회합니다.

### Response

```json
{
  "model_ready": true,
  "data_count": 100,
  "train_count": 90,
  "min_required": 10,
  "anomaly_count": 3,
  "anomaly_rate": 3.0,
  "contamination": 0.01,
  "mq2_ao_threshold": 300,
  "flame_ao_threshold": 500,
  "train_stats_auto": {
    "mq2_mean": 120.5,
    "mq2_std": 30.2,
    "mq2_threshold": 300,
    "flame_mean": 811.0,
    "flame_std": 5.0,
    "flame_threshold": 500,
    "min_margin": 10
  }
}
```

## POST /api/ai/retrain

현재 저장된 정상 데이터 기준으로 AI 모델을 다시 학습합니다.

운영 환경에서는 관리자 인증이 필요합니다.

## POST /api/ai/reset

센서 데이터와 경고 이력을 초기화하고 AI 모델 상태를 초기화합니다.

운영 환경에서는 관리자 인증이 필요합니다.

## GET /dashboard

브라우저에서 확인할 수 있는 웹 대시보드를 반환합니다.

## 경고 타입

| Type | Meaning |
| --- | --- |
| `ANOMALY` | AI 이상 징후 |
| `ANOMALY_GAS` | MQ-2 가스/연기 이상 |
| `ANOMALY_FLAME` | 불꽃 센서 이상 |
| `ANOMALY_BOTH` | 가스/연기와 불꽃 복합 이상 |
| `ANOMALY_GAS_FLAME` | 복합 이상 호환 타입 |
