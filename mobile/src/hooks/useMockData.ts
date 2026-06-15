// 실제 서버 연동 전 UI 개발용 목 데이터 훅
import { useState, useEffect, useRef } from 'react';
import type { AppState, SensorReading, AlertLog } from '../types';

const INITIAL_HISTORY: SensorReading[] = Array.from({ length: 20 }, (_, i) => ({
  ts: new Date(Date.now() - (19 - i) * 2000).toISOString(),
  gas: Math.floor(Math.random() * 200 + 100),
  flame: false,
  gasTriggered: false,
  mq2Ao: Math.floor(Math.random() * 100 + 20),
  flameAo: Math.floor(Math.random() * 100 + 700),
  anomaly: false,
}));

const INITIAL_ALERTS: AlertLog[] = [
  { id: '1', ts: new Date(Date.now() - 3600000).toISOString(), type: 'ANOMALY', mq2Ao: 520, flameAo: 750 },
  { id: '2', ts: new Date(Date.now() - 7200000).toISOString(), type: 'ANOMALY', mq2Ao: 750, flameAo: 650 },
];

export function useMockData() {
  const [state, setState] = useState<AppState>({
    sensor: INITIAL_HISTORY[INITIAL_HISTORY.length - 1],
    device: {
      status:   'online',
      lastSeen: new Date().toISOString(),
      ip:       '192.168.0.42',
      cpuTemp:  47.3,
      uptime:   '2일 14시간',
    },
    network:   'connected',
    alerts:    INITIAL_ALERTS,
    threshold: { gasThreshold: 400, flameThreshold: 500 },
  });

  const historyRef = useRef<SensorReading[]>(INITIAL_HISTORY);

  useEffect(() => {
    const timer = setInterval(() => {
      const newReading: SensorReading = {
        ts:           new Date().toISOString(),
        gas:          Math.floor(Math.random() * 250 + 80),
        flame:        Math.random() < 0.05,
        gasTriggered: Math.random() < 0.08,
        mq2Ao:        Math.floor(Math.random() * 100 + 20),
        flameAo:      Math.floor(Math.random() * 100 + 700),
        anomaly:      Math.random() < 0.05,
      };

      historyRef.current = [...historyRef.current.slice(-29), newReading];

      setState(prev => ({
        ...prev,
        sensor: newReading,
        device: { ...prev.device, lastSeen: new Date().toISOString() },
      }));
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  const history = historyRef.current;

  const setThreshold = (gasThreshold: number) =>
    setState(prev => ({ ...prev, threshold: { gasThreshold } }));

  return { state, history, setThreshold };
}
