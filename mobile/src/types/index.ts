export type SensorStatus = 'normal' | 'warning' | 'danger';
export type DeviceStatus = 'online' | 'offline' | 'unknown';
export type NetworkStatus = 'connected' | 'disconnected' | 'retrying';

export interface SensorReading {
  ts: string;
  gas: number;
  flame: boolean;
  gasTriggered: boolean;
  mq2Ao: number;    // MQ-2 아날로그 값 (0~1023)
  flameAo: number;  // 불꽃 아날로그 값 (0~1023)
  anomaly: boolean; // AI 이상치 여부
}

export interface AlertLog {
  id: string;
  ts: string;
  type: 'ANOMALY' | 'ANOMALY_GAS' | 'ANOMALY_FLAME' | 'ANOMALY_BOTH' | 'ANOMALY_GAS_FLAME';
  mq2Ao:   number;
  flameAo: number;
}

export interface ThresholdConfig {
  gasThreshold:   number;  // 0~1023
  flameThreshold: number;  // 0~1023
}

export interface DeviceInfo {
  status: DeviceStatus;
  lastSeen: string;
  ip: string;
  cpuTemp: number;        // °C
  uptime: string;
}

export interface AppState {
  sensor: SensorReading;
  device: DeviceInfo;
  network: NetworkStatus;
  alerts: AlertLog[];
  threshold: ThresholdConfig;
}
