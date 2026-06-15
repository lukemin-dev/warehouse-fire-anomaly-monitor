import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Font, Radius } from '../theme';
import type { SensorReading } from '../types';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W  = SCREEN_W - 40;

type Tab = 'ao' | 'trend' | 'anomaly';

interface Props {
  history: SensorReading[];
  mq2Threshold:   number;
  flameThreshold: number;
}

export function GraphScreen({ history, mq2Threshold, flameThreshold }: Props) {
  const [tab, setTab] = useState<Tab>('ao');

  if (history.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.empty}>
          <Ionicons name="analytics-outline" size={52} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>데이터 수집 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const latest     = history[history.length - 1];
  const anomalyCount = history.filter(r => r.anomaly).length;
  const anomalyRate  = Math.round((anomalyCount / history.length) * 100);

  // 차트 라벨: 5개마다
  const labels = history
    .filter((_, i) => i % Math.max(1, Math.floor(history.length / 6)) === 0)
    .map(r => {
      const d = new Date(r.ts);
      return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    });

  // AO 데이터
  const mq2AoData   = history.map(r => r.mq2Ao);
  const flameAoData = history.map(r => r.flameAo);

  // 이상치 데이터 (0 or 1 → 시각화용으로 스케일)
  const anomalyData = history.map(r => r.anomaly ? 1 : 0);

  // 통계
  const mq2Avg  = Math.round(mq2AoData.reduce((a, b) => a + b, 0) / mq2AoData.length);
  const mq2Max  = Math.max(...mq2AoData);
  const mq2Min  = Math.min(...mq2AoData);
  const flameAvg = Math.round(flameAoData.reduce((a, b) => a + b, 0) / flameAoData.length);
  const flameMax = Math.max(...flameAoData);
  const flameMin = Math.min(...flameAoData);

  // 이동평균 (5개)
  const movingAvg = (data: number[], window = 5) =>
    data.map((_, i) => {
      const slice = data.slice(Math.max(0, i - window + 1), i + 1);
      return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
    });

  const mq2Moving   = movingAvg(mq2AoData);
  const flameMoving = movingAvg(flameAoData);

  const chartConfig = {
    backgroundColor:        Colors.surface,
    backgroundGradientFrom: Colors.surface,
    backgroundGradientTo:   Colors.surfaceHigh,
    decimalPlaces:          0,
    color: (opacity = 1) => `rgba(79,142,247,${opacity})`,
    labelColor: ()        => Colors.textSecondary,
    propsForDots:            { r: '2', strokeWidth: '1', stroke: Colors.primary },
    propsForBackgroundLines: { stroke: Colors.border, strokeDasharray: '4' },
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>센서 분석</Text>
        <Text style={styles.sub}>{history.length}개 포인트 · 2초 주기</Text>

        {/* 상단 요약 카드 */}
        <View style={styles.summaryRow}>
          <SummaryCard
            label="MQ-2 현재"
            value={latest.mq2Ao}
            unit="AO"
            color={latest.mq2Ao >= mq2Threshold ? Colors.danger : Colors.success}
            icon="flame-outline"
          />
          <SummaryCard
            label="불꽃 현재"
            value={latest.flameAo}
            unit="AO"
            color={latest.flameAo <= flameThreshold ? Colors.danger : Colors.success}
            icon="eye-outline"
          />
          <SummaryCard
            label="AI 이상"
            value={`${anomalyRate}%`}
            unit={`${anomalyCount}건`}
            color={anomalyCount > 0 ? '#a855f7' : Colors.success}
            icon="analytics-outline"
          />
        </View>

        {/* 탭 */}
        <View style={styles.tabBar}>
          {([
            { key: 'ao',      label: 'AO 실시간', icon: 'pulse-outline',      color: Colors.warning },
            { key: 'trend',   label: '이동평균',   icon: 'trending-up-outline', color: Colors.primary },
            { key: 'anomaly', label: 'AI 이상치',  icon: 'analytics-outline',  color: '#a855f7'      },
          ] as { key: Tab; label: string; icon: any; color: string }[]).map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key ? { backgroundColor: t.color, borderColor: t.color } : styles.tabBtnInactive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
            >
              <Ionicons name={t.icon} size={14} color={tab === t.key ? '#fff' : Colors.textSecondary} />
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── AO 실시간 차트 ── */}
        {tab === 'ao' && (
          <>
            <SectionLabel text="MQ-2 아날로그 (0~1023)" color={Colors.warning} />
            <View style={styles.chartWrap}>
              <LineChart
                data={{
                  labels,
                  datasets: [{
                    data:        mq2AoData.length > 0 ? mq2AoData : [0],
                    color:       () => Colors.warning,
                    strokeWidth: 2,
                  }],
                }}
                width={CHART_W}
                height={180}
                chartConfig={{ ...chartConfig, color: (op = 1) => `rgba(243,156,18,${op})` }}
                bezier
                style={{ borderRadius: Radius.md }}
                withInnerLines
                withOuterLines={false}
              />
            </View>

            <View style={styles.statGrid}>
              <StatBox label="최솟값" value={mq2Min} color={Colors.success} />
              <StatBox label="평균"   value={mq2Avg} color={Colors.warning} />
              <StatBox label="최댓값" value={mq2Max} color={Colors.danger}  />
            </View>

            <SectionLabel text="불꽃 센서 아날로그 (0~1023)" color={Colors.danger} />
            <View style={styles.chartWrap}>
              <LineChart
                data={{
                  labels,
                  datasets: [{
                    data:        flameAoData.length > 0 ? flameAoData : [0],
                    color:       () => Colors.danger,
                    strokeWidth: 2,
                  }],
                }}
                width={CHART_W}
                height={180}
                chartConfig={{ ...chartConfig, color: (op = 1) => `rgba(231,76,60,${op})` }}
                bezier
                style={{ borderRadius: Radius.md }}
                withInnerLines
                withOuterLines={false}
              />
            </View>

            <View style={styles.statGrid}>
              <StatBox label="최솟값" value={flameMin} color={Colors.success} />
              <StatBox label="평균"   value={flameAvg} color={Colors.warning} />
              <StatBox label="최댓값" value={flameMax} color={Colors.danger}  />
            </View>

            {/* 불꽃 센서 안내 */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={15} color={Colors.primary} />
              <Text style={styles.infoText}>
                불꽃 센서는 값이 낮을수록 불꽃 감지 가능성 높음 ({flameThreshold} 이하 경고)
              </Text>
            </View>
          </>
        )}

        {/* ── 이동평균 차트 ── */}
        {tab === 'trend' && (
          <>
            <SectionLabel text="MQ-2 이동평균 (5개 윈도우)" color={Colors.warning} />
            <View style={styles.chartWrap}>
              <LineChart
                data={{
                  labels,
                  datasets: [
                    {
                      data:        mq2AoData.length > 0 ? mq2AoData : [0],
                      color:       (op = 1) => `rgba(243,156,18,${op * 0.35})`,
                      strokeWidth: 1,
                    },
                    {
                      data:        mq2Moving.length > 0 ? mq2Moving : [0],
                      color:       () => Colors.warning,
                      strokeWidth: 3,
                    },
                  ],
                }}
                width={CHART_W}
                height={180}
                chartConfig={{ ...chartConfig, color: (op = 1) => `rgba(243,156,18,${op})` }}
                bezier
                style={{ borderRadius: Radius.md }}
                withInnerLines
                withOuterLines={false}
              />
            </View>
            <View style={styles.legendRow}>
              <LegendDot color={Colors.warning + '55'} label="원본" />
              <LegendDot color={Colors.warning}        label="이동평균" />
            </View>

            <SectionLabel text="불꽃 이동평균 (5개 윈도우)" color={Colors.danger} />
            <View style={styles.chartWrap}>
              <LineChart
                data={{
                  labels,
                  datasets: [
                    {
                      data:        flameAoData.length > 0 ? flameAoData : [0],
                      color:       (op = 1) => `rgba(231,76,60,${op * 0.35})`,
                      strokeWidth: 1,
                    },
                    {
                      data:        flameMoving.length > 0 ? flameMoving : [0],
                      color:       () => Colors.danger,
                      strokeWidth: 3,
                    },
                  ],
                }}
                width={CHART_W}
                height={180}
                chartConfig={{ ...chartConfig, color: (op = 1) => `rgba(231,76,60,${op})` }}
                bezier
                style={{ borderRadius: Radius.md }}
                withInnerLines
                withOuterLines={false}
              />
            </View>
            <View style={styles.legendRow}>
              <LegendDot color={Colors.danger + '55'} label="원본" />
              <LegendDot color={Colors.danger}        label="이동평균" />
            </View>
          </>
        )}

        {/* ── AI 이상치 탭 ── */}
        {tab === 'anomaly' && (
          <>
            {/* 이상치 요약 */}
            <View style={[styles.anomalySummary, { borderColor: anomalyCount > 0 ? '#a855f766' : Colors.success + '66' }]}>
              <Ionicons
                name={anomalyCount > 0 ? 'warning-outline' : 'shield-checkmark-outline'}
                size={28}
                color={anomalyCount > 0 ? '#a855f7' : Colors.success}
              />
              <View style={{ marginLeft: 14 }}>
                <Text style={[styles.anomalyTitle, { color: anomalyCount > 0 ? '#a855f7' : Colors.success }]}>
                  {anomalyCount > 0 ? `이상치 ${anomalyCount}건 감지` : '이상치 없음'}
                </Text>
                <Text style={styles.anomalySub}>
                  전체 {history.length}개 중 {anomalyRate}% · Isolation Forest
                </Text>
              </View>
            </View>

            <SectionLabel text="AI 이상치 타임라인 (1=이상)" color="#a855f7" />
            <View style={styles.chartWrap}>
              <LineChart
                data={{
                  labels,
                  datasets: [{
                    data:        anomalyData.length > 0 ? anomalyData : [0],
                    color:       () => '#a855f7',
                    strokeWidth: 2,
                  }],
                }}
                width={CHART_W}
                height={160}
                chartConfig={{ ...chartConfig, color: (op = 1) => `rgba(168,85,247,${op})` }}
                style={{ borderRadius: Radius.md }}
                withInnerLines
                withOuterLines={false}
                withDots
              />
            </View>

            <SectionLabel text="이상 구간 MQ-2 AO 분포" color={Colors.warning} />
            <View style={styles.chartWrap}>
              {(() => {
                const normalVals  = history.filter(r => !r.anomaly).map(r => r.mq2Ao);
                const anomalyVals = history.filter(r =>  r.anomaly).map(r => r.mq2Ao);
                const normalAvg  = normalVals.length  ? Math.round(normalVals.reduce((a,b)=>a+b,0)/normalVals.length)   : 0;
                const anomalyAvg = anomalyVals.length ? Math.round(anomalyVals.reduce((a,b)=>a+b,0)/anomalyVals.length) : 0;
                return (
                  <>
                    <BarChart
                      data={{
                        labels: ['정상 평균', '이상 평균'],
                        datasets: [{ data: [normalAvg, anomalyAvg] }],
                      }}
                      width={CHART_W}
                      height={160}
                      yAxisLabel=""
                      yAxisSuffix=""
                      chartConfig={{
                        ...chartConfig,
                        color: (op = 1, index?: number) =>
                          index === 1
                            ? `rgba(168,85,247,${op})`
                            : `rgba(46,204,113,${op})`,
                      }}
                      style={{ borderRadius: Radius.md }}
                      showValuesOnTopOfBars
                    />
                    <View style={styles.legendRow}>
                      <LegendDot color={Colors.success} label="정상 평균" />
                      <LegendDot color="#a855f7"        label="이상 평균" />
                    </View>
                  </>
                );
              })()}
            </View>

            {/* 이상 발생 목록 */}
            <SectionLabel text="이상 발생 시각" color="#a855f7" />
            <View style={styles.anomalyList}>
              {history.filter(r => r.anomaly).length === 0 ? (
                <Text style={styles.noAnomaly}>이상치 없음</Text>
              ) : (
                history
                  .filter(r => r.anomaly)
                  .slice(-8)
                  .reverse()
                  .map((r, i) => (
                    <View key={i} style={styles.anomalyRow}>
                      <Ionicons name="alert-circle" size={14} color="#a855f7" />
                      <Text style={styles.anomalyTs}>
                        {new Date(r.ts).toLocaleTimeString('ko-KR')}
                      </Text>
                      <Text style={styles.anomalyVal}>
                        MQ2: {r.mq2Ao} · 불꽃: {r.flameAo}
                      </Text>
                    </View>
                  ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 3, height: 14, backgroundColor: color, borderRadius: 2 }} />
      <Text style={[sStyles.sectionLabel, { color }]}>{text}</Text>
    </View>
  );
}

function SummaryCard({ label, value, unit, color, icon }: {
  label: string; value: number | string; unit: string; color: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[sStyles.summaryCard, { borderColor: color + '44' }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[sStyles.summaryValue, { color }]}>{value}</Text>
      <Text style={sStyles.summaryUnit}>{unit}</Text>
      <Text style={sStyles.summaryLabel}>{label}</Text>
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[sStyles.statBox, { borderColor: color + '44' }]}>
      <Text style={[sStyles.statValue, { color }]}>{value}</Text>
      <Text style={sStyles.statLabel}>{label}</Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: Colors.textSecondary, fontSize: Font.xs }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  container: { padding: 20, gap: 14, paddingBottom: 40 },

  title: { fontSize: Font.xl, fontWeight: '800', color: Colors.textPrimary },
  sub:   { fontSize: Font.sm, color: Colors.textSecondary, marginTop: -8 },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: Font.md, color: Colors.textSecondary },

  summaryRow: { flexDirection: 'row', gap: 8 },

  tabBar: {
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 11,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  tabBtnInactive: { backgroundColor: Colors.surface, borderColor: Colors.border },
  tabLabel:       { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  tabLabelActive: { color: '#fff' },

  chartWrap: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  statGrid: { flexDirection: 'row', gap: 8 },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: Colors.primary + '11',
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
  infoText: { flex: 1, fontSize: Font.xs, color: Colors.textSecondary, lineHeight: 18 },

  legendRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 4 },

  anomalySummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 16,
  },
  anomalyTitle: { fontSize: Font.md, fontWeight: '700' },
  anomalySub:   { fontSize: Font.xs, color: Colors.textSecondary, marginTop: 3 },

  anomalyList: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  anomalyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  anomalyTs:  { fontSize: Font.sm, color: Colors.textSecondary, width: 80 },
  anomalyVal: { fontSize: Font.sm, color: Colors.textPrimary, flex: 1 },
  noAnomaly:  { padding: 16, color: Colors.textSecondary, fontSize: Font.sm, textAlign: 'center' },
});

const sStyles = StyleSheet.create({
  sectionLabel: { fontSize: Font.xs, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },

  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 3,
  },
  summaryValue: { fontSize: Font.lg, fontWeight: '800' },
  summaryUnit:  { fontSize: Font.xs, color: Colors.textSecondary },
  summaryLabel: { fontSize: Font.xs, color: Colors.textSecondary },

  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: Font.lg, fontWeight: '800' },
  statLabel: { fontSize: Font.xs, color: Colors.textSecondary },
});
