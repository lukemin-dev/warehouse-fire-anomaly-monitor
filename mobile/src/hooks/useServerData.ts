import { useState, useEffect, useRef } from 'react';
import type { AppState, SensorReading, AlertLog } from '../types';
import { SERVER_HOST_LABEL, SERVER_URL } from '../config/server';

const POLL_MS = 3000;

const DEFAULT_STATE: AppState = {
  sensor: { ts: '', gas: 0, flame: false, gasTriggered: false, mq2Ao: 0, flameAo: 0, anomaly: false },
  device: { status: 'unknown', lastSeen: '', ip: SERVER_HOST_LABEL, cpuTemp: 0, uptime: '-' },
  network: 'connected',
  alerts: [],
  threshold: { gasThreshold: 300, flameThreshold: 500 },
};

export function useServerData() {
  const [state, setState]     = useState<AppState>(DEFAULT_STATE);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const thresholdRef = useRef({ mq2: 300, flame: 500 });

  const safeJson = async (res: Response) => {
    try { return await res.json(); } catch { return null; }
  };

  const fetchAll = async () => {
    try {
      const [latestRes, readingsRes, alertsRes, aiRes] = await Promise.all([
        fetch(`${SERVER_URL}/api/latest`),
        fetch(`${SERVER_URL}/api/readings`),
        fetch(`${SERVER_URL}/api/alerts`),
        fetch(`${SERVER_URL}/api/ai/status`),
      ]);

      const latest:   any   = await safeJson(latestRes)   ?? {};
      const readings: any[] = await safeJson(readingsRes) ?? [];
      const alerts:   any[] = await safeJson(alertsRes)   ?? [];
      const ai:       any   = await safeJson(aiRes)       ?? {};

      thresholdRef.current = {
        mq2:   ai.mq2_ao_threshold   ?? 300,
        flame: ai.flame_ao_threshold ?? 500,
      };

      const toReading = (row: any): SensorReading => ({
        ts:           row.ts ?? row.received_at ?? '',
        gas:          row.mq2_ao   ?? 0,
        mq2Ao:        row.mq2_ao   ?? 0,
        flameAo:      row.flame_ao ?? 0,
        gasTriggered: false,
        flame:        false,
        anomaly:      row.anomaly === 1,
      });

      const toAlert = (row: any): AlertLog => ({
        id:      String(row.id ?? Math.random()),
        ts:      row.ts ?? '',
        type:    row.type ?? 'ANOMALY',
        mq2Ao:   row.mq2_ao   ?? 0,
        flameAo: row.flame_ao ?? 0,
      });

      const newHistory = readings.slice(0, 30).reverse().map(toReading);
      setHistory(newHistory);

      setState(prev => ({
        ...prev,
        sensor:  Object.keys(latest).length > 0 ? toReading(latest) : prev.sensor,
        network: 'connected',
        device: {
          ...prev.device,
          status:   'online',
          lastSeen: latest.received_at ?? new Date().toISOString(),
        },
        alerts:    alerts.map(toAlert),
        threshold: { gasThreshold: thresholdRef.current.mq2, flameThreshold: thresholdRef.current.flame },
      }));
    } catch {
      setState(prev => ({
        ...prev,
        network: 'disconnected',
        device: { ...prev.device, status: 'offline' },
      }));
    }
  };

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const setThreshold = (threshold: { gasThreshold: number; flameThreshold: number }) =>
    setState(prev => ({ ...prev, threshold }));

  return { state, history, setThreshold };
}
