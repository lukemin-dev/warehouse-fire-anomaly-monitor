# 창고 화재·이상 징후 감지 시스템

라즈베리파이 기반 센서 데이터를 수집해 창고 내 가스/연기 및 불꽃 이상 징후를 감지하고, Flask 서버와 모바일 앱에서 실시간으로 모니터링하는 캡스톤 프로젝트입니다.

## 주요 기능

- MQ-2 가스/연기 센서와 SEN040132 불꽃 센서 데이터 수집
- MCP3008 ADC를 이용한 AO 아날로그 값 수집
- 라즈베리파이에서 Flask 서버로 2초 주기 센서 데이터 전송
- SQLite 기반 센서/경고 이력 저장
- IsolationForest 기반 AI 이상 징후 탐지
- Expo/React Native 모바일 앱 실시간 대시보드, 그래프, 경고 이력, AI 설정 화면

## 핵심 아이디어

초기에는 센서의 DO 디지털 출력만 사용했지만, DO 값은 `0/1`만 제공하므로 단순 임계값 판정과 차이가 거의 없었습니다. 이를 보완하기 위해 MCP3008 ADC를 추가해 MQ-2와 불꽃 센서의 AO 아날로그 값을 `0~1023` 범위로 수집했습니다.

이 연속값을 이용하면 DO가 아직 정상인 상황에서도 AO 값이 평소 범위에서 벗어나는 전조를 감지할 수 있습니다. 서버는 정상 구간 데이터를 바탕으로 IsolationForest 모델을 학습하고, 정상 패턴에서 벗어난 값을 이상 징후로 판단합니다.

## 시스템 구조

```mermaid
flowchart LR
  MQ2["MQ-2 가스/연기 센서"] -->|DO| RPI["Raspberry Pi 4"]
  FLAME["SEN040132 불꽃 센서"] -->|DO| RPI
  MQ2 -->|AO| MCP["MCP3008 ADC"]
  FLAME -->|AO| MCP
  MCP -->|SPI| RPI
  RPI -->|POST /api/event| API["Flask Server on EC2"]
  API --> DB["SQLite"]
  API --> AI["IsolationForest"]
  API --> APP["Expo Mobile App"]
  API --> WEB["Web Dashboard"]
```

## 저장소 구조

```text
.
├── assets/              # 시연 스크린샷과 하드웨어 사진
├── docs/                # 개발 일정, 진행 현황, 시스템 구성도, ERD
├── hardware/            # 부품/배선 설명
├── mobile/              # Expo React Native 앱
├── raspberrypi/         # 라즈베리파이 센서 수집 코드
├── releases/            # APK는 GitHub Releases에 첨부
├── scripts/             # 배포 예시 스크립트
└── server/              # Flask API 서버
```

## 실행 요약

서버:

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export FIRE_DB_PATH=~/warehouse-server/sensor.db
python app.py
```

라즈베리파이:

```bash
cd raspberrypi
pip install -r requirements.txt
export FIRE_SERVER_URL=http://<SERVER_HOST>:5000/api/event
python sensor_test.py
```

모바일 앱:

```bash
cd mobile
npm install
cp .env.example .env
# .env의 EXPO_PUBLIC_SERVER_URL 수정
npm start
```

## 시연 시나리오

1. 정상 상태에서 MQ-2와 불꽃 센서 AO 값을 수집한다.
2. 라즈베리파이가 2초마다 Flask 서버의 `/api/event`로 센서 데이터를 전송한다.
3. 서버가 SQLite에 데이터를 저장하고 AI 모델로 이상 여부를 판정한다.
4. 가스/연기 또는 불꽃 근접 테스트 시 AO 값이 변화한다.
5. 모바일 앱에서 대시보드 상태, 실시간 그래프, 경고 이력을 확인한다.

## 문서

- [개발 일정](docs/development-schedule.md)
- [시스템 구성도](docs/architecture.md)
- [ERD](docs/erd.md)
- [시연 시나리오](docs/demo-scenario.md)
- [개선 로드맵](docs/improvement-roadmap.md)
- [면접 대비 Q&A](docs/interview-prep.md)
- [2026-05-07 진행 현황](docs/progress-2026-05-07.md)
- [2026-05-15 진행 현황](docs/progress-2026-05-15.md)

## 시연 화면

![모바일 대시보드](assets/screenshots/mobile-dashboard.jpg)
![실시간 그래프](assets/screenshots/mobile-graph.jpg)
![경고 이력](assets/screenshots/mobile-alerts.jpg)

## 주의사항

- 서버 IP, SSH 키, `.env`, APK, 분할 압축 파일은 저장소에 커밋하지 않습니다.
- APK는 저장소에 직접 넣기보다 GitHub Releases에 첨부하는 것을 권장합니다.
- `/api/ai/reset`, `/api/ai/retrain` 같은 관리 API는 실제 운영 시 인증을 붙여야 합니다.

## 한계와 개선 방향

- 실제 화재 데이터 수집이 어렵기 때문에 정상 데이터 기반 이상 탐지로 접근했습니다.
- 센서 값은 거리, 공기 흐름, 전원 안정성, 온습도에 영향을 받을 수 있습니다.
- 운영 환경에서는 관리자 API 인증, 푸시 알림, 장기 데이터 저장, 회로 보호 구성이 필요합니다.
