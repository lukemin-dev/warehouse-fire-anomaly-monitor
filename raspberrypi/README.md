# Raspberry Pi

라즈베리파이 4에서 MQ-2 가스/연기 센서와 SEN040132 불꽃 센서의 DO/AO 값을 읽어 서버로 전송합니다.

## 연결

| 부품 | 연결 |
| --- | --- |
| MQ-2 DO | GPIO17 |
| SEN040132 DO | GPIO27 |
| MQ-2 AO | MCP3008 CH0 |
| SEN040132 AO | MCP3008 CH1 |
| MCP3008 SPI | GPIO8, GPIO9, GPIO10, GPIO11 |

## 실행

```bash
pip install -r requirements.txt
export FIRE_SERVER_URL=http://<SERVER_HOST>:5000/api/event
python sensor_test.py
```

SPI가 보이지 않으면 `sudo raspi-config`에서 SPI를 활성화하고 재부팅합니다.
