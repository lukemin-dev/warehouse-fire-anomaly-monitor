import React, { useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Font, Radius } from '../theme';
import { SensorCard } from '../components/SensorCard';
import { StatusBadge } from '../components/StatusBadge';
import type { AppState } from '../types';

interface Props {
  state: AppState;
}

type Tab = 'sensor' | 'system';

export function DashboardScreen({ state }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('sensor');
  const { sensor, device, network, threshold } = state;
  const anyAlert = sensor.anomaly;

  const networkVariant =
    network === 'connected' ? 'success' :
    network === 'retrying'  ? 'warning' : 'danger';

  const networkLabel =
    network === 'connected' ? '연결됨' :
    network === 'retrying'  ? '재연결 중' : '오프라인';

  const deviceVariant = device.status === 'online' ? 'success' : 'danger';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => {}} tintColor={Colors.primary} />}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>창고 모니터</Text>
          <Text style={styles.headerSub}>
            {new Date().toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
          </Text>
        </View>

        {/* 전체 상태 배너 */}
        <View style={[styles.banner, anyAlert ? styles.bannerDanger : styles.bannerOk]}>
          <Ionicons
            name={anyAlert ? 'warning' : 'checkmark-circle'}
            size={32}
            color={anyAlert ? Colors.danger : Colors.success}
          />
          <View style={{ marginLeft: 14 }}>
            <Text style={[styles.bannerTitle, { color: anyAlert ? Colors.danger : Colors.success }]}>
              {anyAlert ? '이상 징후 감지' : '정상 상태'}
            </Text>
            <Text style={styles.bannerSub}>
              {anyAlert ? '즉시 확인이 필요합니다' : '모든 센서가 정상 범위입니다'}
            </Text>
          </View>
        </View>

        {/* 탭 버튼 */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'sensor' ? styles.tabBtnSensor : styles.tabBtnInactive]}
            onPress={() => setActiveTab('sensor')}
            activeOpacity={0.8}
          >
            <Ionicons name="flame-outline" size={16} color={activeTab === 'sensor' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.tabLabel, activeTab === 'sensor' && styles.tabLabelActiveSensor]}>
              센서 상태
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'system' ? styles.tabBtnSystem : styles.tabBtnInactive]}
            onPress={() => setActiveTab('system')}
            activeOpacity={0.8}
          >
            <Ionicons name="hardware-chip-outline" size={16} color={activeTab === 'system' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.tabLabel, activeTab === 'system' && styles.tabLabelActiveSystem]}>
              시스템 상태
            </Text>
          </TouchableOpacity>
        </View>

        {/* 센서 상태 탭 */}
        {activeTab === 'sensor' && (
          <View style={styles.tabContent}>
            {(() => {
              const gasAlert   = sensor.mq2Ao   >= threshold.gasThreshold;
              const flameAlert = sensor.flameAo <= threshold.flameThreshold;
              return (
                <>
                  <SensorCard
                    title="가스 / 연기 (MQ-2)"
                    icon="flame-outline"
                    triggered={gasAlert}
                    value={gasAlert ? '이상 감지' : '정상'}
                    sub={`AO: ${sensor.mq2Ao} / 1023`}
                  />
                  <SensorCard
                    title="불꽃 감지 (SEN040132)"
                    icon="eye-outline"
                    triggered={flameAlert}
                    value={flameAlert ? '이상 감지' : '정상'}
                    sub={`AO: ${sensor.flameAo} / 1023`}
                  />
                </>
              );
            })()}

            {/* 임계값 */}
            <View style={styles.thresholdBox}>
              <Ionicons name="options-outline" size={15} color={Colors.textSecondary} />
              <Text style={styles.thresholdText}>
                MQ-2 임계값: <Text style={{ color: Colors.warning, fontWeight: '700' }}>{threshold.gasThreshold}</Text>
                {'  '}불꽃 임계값: <Text style={{ color: Colors.danger, fontWeight: '700' }}>{threshold.flameThreshold}</Text>
              </Text>
            </View>
          </View>
        )}

        {/* 시스템 상태 탭 */}
        {activeTab === 'system' && (
          <View style={styles.tabContent}>
            {/* 연결 상태 카드 2개 */}
            <View style={styles.statusRow}>
              <View style={styles.statusCard}>
                <Ionicons name="wifi" size={22} color={Colors.textSecondary} />
                <Text style={styles.statusCardLabel}>네트워크</Text>
                <StatusBadge label={networkLabel} variant={networkVariant} />
              </View>
              <View style={styles.statusCard}>
                <Ionicons name="hardware-chip-outline" size={22} color={Colors.textSecondary} />
                <Text style={styles.statusCardLabel}>라즈베리파이</Text>
                <StatusBadge
                  label={device.status === 'online' ? '온라인' : '오프라인'}
                  variant={deviceVariant}
                />
              </View>
            </View>

            {/* 디바이스 세부 정보 */}
            <View style={styles.deviceDetail}>
              <DetailRow icon="thermometer-outline" label="CPU 온도"    value={`${device.cpuTemp}°C`} />
              <DetailRow icon="time-outline"        label="가동 시간"   value={device.uptime} />
              <DetailRow icon="globe-outline"       label="IP 주소"    value={device.ip} />
              <DetailRow
                icon="sync-outline"
                label="마지막 응답"
                value={new Date(device.lastSeen).toLocaleTimeString('ko-KR')}
                last
              />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value, last }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, last && { borderBottomWidth: 0 }]}>
      <Ionicons name={icon} size={15} color={Colors.textSecondary} style={{ marginRight: 8 }} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  scroll:    { flex: 1 },
  container: { padding: 20, gap: 12, paddingBottom: 40 },

  header:      { marginBottom: 4 },
  headerTitle: { fontSize: Font.xl, fontWeight: '800', color: Colors.textPrimary },
  headerSub:   { fontSize: Font.sm, color: Colors.textSecondary, marginTop: 2 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: 18,
    borderWidth: 1,
  },
  bannerOk:     { backgroundColor: Colors.success + '11', borderColor: Colors.success + '44' },
  bannerDanger: { backgroundColor: Colors.danger  + '11', borderColor: Colors.danger  + '66' },
  bannerTitle:  { fontSize: Font.lg, fontWeight: '700' },
  bannerSub:    { fontSize: Font.sm, color: Colors.textSecondary, marginTop: 2 },

  /* 탭 바 */
  tabBar: {
    flexDirection: 'row',
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  tabBtnInactive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  tabBtnSensor: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabBtnSystem: {
    backgroundColor: Colors.textSecondary,
    borderColor: Colors.textSecondary,
  },
  tabLabel: {
    fontSize: Font.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  tabLabelActiveSensor: {
    color: '#fff',
  },
  tabLabelActiveSystem: {
    color: '#fff',
  },

  /* 탭 콘텐츠 */
  tabContent: { gap: 10 },

  statusRow: { flexDirection: 'row', gap: 10 },
  statusCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 8,
    alignItems: 'flex-start',
  },
  statusCardLabel: { fontSize: Font.sm, color: Colors.textSecondary },

  deviceDetail: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: { flex: 1, fontSize: Font.sm, color: Colors.textSecondary },
  detailValue: { fontSize: Font.sm, fontWeight: '600', color: Colors.textPrimary },

  thresholdBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  thresholdText: { fontSize: Font.sm, color: Colors.textSecondary },
});
