# Mobile App

Expo/React Native 기반 모바일 모니터링 앱입니다. 서버 API를 3초마다 폴링해 대시보드, 실시간 그래프, 경고 이력, AI 모델 상태를 표시합니다.

## 실행

```bash
npm install
cp .env.example .env
npm start
```

`.env`의 `EXPO_PUBLIC_SERVER_URL`을 Flask 서버 주소로 설정합니다.

## 화면

- 대시보드: 센서 상태와 시스템 상태
- 그래프: MQ-2/불꽃 AO 값 및 이상치 시각화
- 경고: 경고 이력
- 설정: AI 모델 상태, 재학습, 데이터 초기화
