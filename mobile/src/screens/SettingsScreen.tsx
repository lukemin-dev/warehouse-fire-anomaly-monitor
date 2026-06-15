import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Font, Radius } from '../theme';
import { SERVER_URL } from '../config/server';

interface AiInfo {
  model_ready:        boolean;
  data_count:         number;
  train_count:        number;
  min_required:       number;
  anomaly_count:      number;
  anomaly_rate:       number;
  contamination:      number;
  mq2_ao_threshold:   number;
  flame_ao_threshold: number;
  train_stats: {
    mq2_avg: number; mq2_max: number; mq2_min: number;
    flame_avg: number; flame_max: number; flame_min: number;
  };
  train_stats_auto: {
    mq2_mean: number; mq2_std: number; mq2_threshold: number;
    flame_mean: number; flame_std: number; flame_threshold: number;
    min_margin?: number;
  };
}

export function SettingsScreen() {
  const [aiInfo,    setAiInfo]    = useState<AiInfo | null>(null);
  const [retraining, setRetraining] = useState(false);
  const [resetting,  setResetting]  = useState(false);
  const [loadingAi,  setLoadingAi]  = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any>(null);

  const fetchAiInfo = async () => {
    try {
      const res  = await fetch(`${SERVER_URL}/api/ai/status`);
      const data = await res.json();
      setAiInfo(data);
    } catch {
      setAiInfo(null);
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    fetchAiInfo();
    const timer = setInterval(fetchAiInfo, 3000);
    return () => clearInterval(timer);
  }, []);

  const fetchHistory = async () => {
    try {
      const res  = await fetch(`${SERVER_URL}/api/ai/history`);
      const data = await res.json();
      setHistory(data);
      setShowHistory(true);
    } catch {
      Alert.alert('오류', '서버 연결 실패');
    }
  };

  const handleReset = () => {
    Alert.alert(
      '데이터 초기화',
      '모든 센서 데이터와 경고 이력이 삭제되고 AI 모델이 초기화됩니다.\n\n이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              await fetch(`${SERVER_URL}/api/ai/reset`, { method: 'POST' });
              await fetchAiInfo();
              Alert.alert('완료', '데이터가 초기화됐습니다.');
            } catch {
              Alert.alert('오류', '서버 연결 실패');
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  };

  const handleRetrain = () => {
    Alert.alert(
      '모델 재학습',
      '기존 학습된 모델을 초기화하고 현재 데이터로 다시 학습합니다.\n계속하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '재학습',
          style: 'destructive',
          onPress: async () => {
            setRetraining(true);
            try {
              await fetch(`${SERVER_URL}/api/ai/retrain`, { method: 'POST' });
              // model_ready: true 될 때까지 최대 20초 폴링
              let attempts = 0;
              const poll = async () => {
                try {
                  const res  = await fetch(`${SERVER_URL}/api/ai/status`);
                  const data = await res.json();
                  setAiInfo(data);
                  if (data.model_ready || attempts >= 10) {
                    setRetraining(false);
                  } else {
                    attempts++;
                    setTimeout(poll, 2000);
                  }
                } catch {
                  setRetraining(false);
                }
              };
              setTimeout(poll, 2000);
            } catch {
              Alert.alert('오류', '서버 연결 실패');
              setRetraining(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* 학습 데이터 상세 모달 */}
      <Modal visible={showHistory} animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>학습 데이터 상세</Text>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {history ? (
              <>
                {/* MQ-2 AO 구간 분포 */}
                <Text style={styles.modalSection}>MQ-2 AO 구간별 학습 데이터 수</Text>
                {history.mq2_ao_buckets.map((b: any, i: number) => (
                  <View key={i} style={styles.bucketRow}>
                    <Text style={styles.bucketLabel}>{b.range}</Text>
                    <View style={styles.bucketBarWrap}>
                      <View style={[styles.bucketBar, {
                        width: `${Math.min(100, (b.count / Math.max(...history.mq2_ao_buckets.map((x: any) => x.count))) * 100)}%`,
                        backgroundColor: Colors.warning,
                      }]} />
                    </View>
                    <Text style={styles.bucketCount}>{b.count}개</Text>
                  </View>
                ))}

                {/* 시간대별 분포 */}
                <Text style={styles.modalSection}>시간대별 학습 데이터 분포</Text>
                <View style={styles.hourlyGrid}>
                  {history.hourly_dist.map((h: any, i: number) => (
                    <View key={i} style={styles.hourlyCell}>
                      <Text style={styles.hourlyCount}>{h.count}</Text>
                      <Text style={styles.hourlyLabel}>{h.hour}시</Text>
                    </View>
                  ))}
                </View>

                {/* 이상 샘플 */}
                <Text style={styles.modalSection}>최근 이상치 샘플</Text>
                {history.anomaly_samples.length === 0 ? (
                  <Text style={styles.noData}>이상치 없음</Text>
                ) : history.anomaly_samples.map((r: any, i: number) => (
                  <View key={i} style={styles.sampleRow}>
                    <Text style={styles.sampleTs}>{r.received_at?.slice(11, 19)}</Text>
                    <Text style={[styles.sampleVal, { color: Colors.warning }]}>MQ2: {r.mq2_ao}</Text>
                    <Text style={[styles.sampleVal, { color: Colors.danger }]}>불꽃: {r.flame_ao}</Text>
                  </View>
                ))}

                {/* 정상 샘플 */}
                <Text style={styles.modalSection}>최근 정상 샘플 (학습 기반)</Text>
                {history.normal_samples.map((r: any, i: number) => (
                  <View key={i} style={styles.sampleRow}>
                    <Text style={styles.sampleTs}>{r.received_at?.slice(11, 19)}</Text>
                    <Text style={[styles.sampleVal, { color: Colors.warning }]}>MQ2: {r.mq2_ao}</Text>
                    <Text style={[styles.sampleVal, { color: Colors.success }]}>불꽃: {r.flame_ao}</Text>
                  </View>
                ))}
              </>
            ) : (
              <ActivityIndicator color={Colors.primary} />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>설정</Text>

          {/* ── AI 모델 정보 ── */}
          <SectionHeader icon="analytics-outline" title="AI 이상치 탐지 모델" />
          <View style={styles.card}>
            {loadingAi ? (
              <ActivityIndicator color={Colors.primary} />
            ) : aiInfo ? (
              <>
                {/* 모델 상태 배너 */}
                <View style={[styles.modelBanner, {
                  borderColor:     aiInfo.model_ready ? '#a855f766' : Colors.warning + '66',
                  backgroundColor: aiInfo.model_ready ? '#a855f711' : Colors.warning + '11',
                }]}>
                  <Ionicons
                    name={aiInfo.model_ready ? 'checkmark-circle' : 'hourglass-outline'}
                    size={24}
                    color={aiInfo.model_ready ? '#a855f7' : Colors.warning}
                  />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={[styles.modelStatus, { color: aiInfo.model_ready ? '#a855f7' : Colors.warning }]}>
                      {aiInfo.model_ready ? '모델 준비 완료' : '학습 대기 중'}
                    </Text>
                    <Text style={styles.modelSub}>
                      Isolation Forest · 이상치 비율 {Math.round(aiInfo.contamination * 100)}%{aiInfo.model_ready ? ` · 최소 마진 ±${aiInfo.train_stats_auto?.min_margin ?? 10}` : ''}
                    </Text>
                  </View>
                </View>

                {/* 학습 데이터 진행 바 */}
                <Text style={styles.statSectionLabel}>학습 데이터 현황</Text>
                <View style={styles.progressWrap}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>정상 데이터 수집</Text>
                    <Text style={styles.progressValue}>
                      <Text style={{ color: Colors.primary, fontWeight: '800' }}>{Math.min(aiInfo.train_count, aiInfo.min_required)}</Text>
                      <Text style={{ color: Colors.textSecondary }}> / {aiInfo.min_required}개</Text>
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, {
                      width: `${Math.min(100, (aiInfo.train_count / aiInfo.min_required) * 100)}%`,
                      backgroundColor: aiInfo.train_count >= aiInfo.min_required ? '#a855f7' : Colors.primary,
                    }]} />
                  </View>
                  <Text style={styles.progressSub}>
                    {aiInfo.train_count >= aiInfo.min_required ? '✓ 학습 완료' : `${aiInfo.min_required - Math.min(aiInfo.train_count, aiInfo.min_required)}개 더 수집하면 재학습 가능`}
                  </Text>
                </View>

                {/* 3개 수치 카드 */}
                <View style={styles.statGrid}>
                  <InfoCell label="학습 사용"  value={`${Math.min(aiInfo.train_count,aiInfo.min_required)}/${aiInfo.min_required}`} color='#a855f7' />
                  <InfoCell label="이상 감지"  value={`${aiInfo.anomaly_count}건`}   color={aiInfo.anomaly_count > 0 ? Colors.danger : Colors.success} />
                  <InfoCell label="이상 비율"  value={`${aiInfo.anomaly_rate}%`}     color={aiInfo.anomaly_rate > 5 ? Colors.danger : Colors.success} />
                </View>

                {/* 이상치 경계 명시 */}
                {(() => {
                  const s      = aiInfo.train_stats_auto;
                  const margin = s?.min_margin ?? 10;
                  const ready  = aiInfo.model_ready && s && s.mq2_mean > 0;
                  const mq2Applied   = ready ? Math.max(2 * s.mq2_std,   margin) : margin;
                  const flameApplied = ready ? Math.max(2 * s.flame_std, margin) : margin;
                  const mq2MarginLabel   = ready && 2 * s.mq2_std   >= margin ? `2σ` : `최소마진`;
                  const flameMarginLabel = ready && 2 * s.flame_std >= margin ? `2σ` : `최소마진`;
                  return (
                    <View style={styles.thresholdCard}>
                      <Text style={styles.thresholdTitle}>이상치 판단 기준 (학습 데이터 기반 자동 계산 · 최소마진 {margin})</Text>

                      {/* MQ-2 */}
                      <View style={styles.thresholdRow}>
                        <Ionicons name="flame-outline" size={15} color={Colors.warning} />
                        <Text style={styles.thresholdKey}>MQ-2 AO</Text>
                        <Text style={styles.thresholdArrow}>≥</Text>
                        <Text style={[styles.thresholdVal, { color: Colors.warning }]}>{aiInfo.mq2_ao_threshold}</Text>
                        <Text style={styles.thresholdUnit}>→ 가스 경고</Text>
                      </View>
                      <Text style={styles.thresholdCalc}>
                        {ready
                          ? `평균 ${s.mq2_mean} + ${mq2MarginLabel}(${mq2Applied}) = ${aiInfo.mq2_ao_threshold}`
                          : `평균 + ${mq2MarginLabel}(${mq2Applied}) · 학습 후 확정`}
                      </Text>

                      {/* 불꽃 */}
                      <View style={styles.thresholdRow}>
                        <Ionicons name="eye-outline" size={15} color={Colors.danger} />
                        <Text style={styles.thresholdKey}>불꽃 AO</Text>
                        <Text style={styles.thresholdArrow}>≤</Text>
                        <Text style={[styles.thresholdVal, { color: Colors.danger }]}>{aiInfo.flame_ao_threshold}</Text>
                        <Text style={styles.thresholdUnit}>→ 불꽃 경고</Text>
                      </View>
                      <Text style={styles.thresholdCalc}>
                        {ready
                          ? `평균 ${s.flame_mean} - ${flameMarginLabel}(${flameApplied}) = ${aiInfo.flame_ao_threshold}`
                          : `평균 - ${flameMarginLabel}(${flameApplied}) · 학습 후 확정`}
                      </Text>

                      {/* AI */}
                      <View style={styles.thresholdRow}>
                        <Ionicons name="analytics-outline" size={15} color='#a855f7' />
                        <Text style={styles.thresholdKey}>AI 판정</Text>
                        <Text style={styles.thresholdArrow}></Text>
                        <Text style={[styles.thresholdVal, { color: '#a855f7' }]}>상위 1%</Text>
                        <Text style={styles.thresholdUnit}>→ ANOMALY</Text>
                      </View>
                      <Text style={styles.thresholdCalc}>Isolation Forest · 학습 {aiInfo.min_required}개 기준</Text>
                    </View>
                  );
                })()}

                {/* MQ-2 학습 범위 */}
                {aiInfo.model_ready && aiInfo.train_stats_auto && aiInfo.train_stats_auto.mq2_mean > 0 && (() => {
                  const s    = aiInfo.train_stats_auto;
                  const margin = s.min_margin ?? 10;
                  const mq2RangeMin   = Math.max(0, s.mq2_mean - Math.max(2 * s.mq2_std, margin));
                  const flameRangeMax = Math.min(1023, s.flame_mean + Math.max(2 * s.flame_std, margin));
                  return (
                  <>
                    <Text style={styles.statSectionLabel}>학습 완료 시점 정상 범위</Text>

                    {/* MQ-2 */}
                    <View style={styles.trainedRangeCard}>
                      <View style={styles.trainedRangeHeader}>
                        <Ionicons name="flame-outline" size={14} color={Colors.warning} />
                        <Text style={[styles.trainedRangeTitle, { color: Colors.warning }]}>MQ-2 가스 센서</Text>
                        <View style={styles.trainedBadge}>
                          <Text style={styles.trainedBadgeText}>정상 구간</Text>
                        </View>
                      </View>
                      <RangeBar
                        min={mq2RangeMin}
                        max={s.mq2_threshold}
                        color={Colors.warning}
                        maxScale={1023}
                      />
                      <View style={styles.trainedStats}>
                        <View style={styles.trainedStatItem}>
                          <Text style={styles.trainedStatVal}>{s.mq2_mean}</Text>
                          <Text style={styles.trainedStatKey}>평균</Text>
                        </View>
                        <View style={styles.trainedDivider} />
                        <View style={styles.trainedStatItem}>
                          <Text style={styles.trainedStatVal}>+{Math.max(2 * s.mq2_std, margin)}</Text>
                          <Text style={styles.trainedStatKey}>{2 * s.mq2_std >= margin ? '2σ 마진' : '최소 마진'}</Text>
                        </View>
                        <View style={styles.trainedDivider} />
                        <View style={styles.trainedStatItem}>
                          <Text style={[styles.trainedStatVal, { color: Colors.danger }]}>{s.mq2_threshold}</Text>
                          <Text style={styles.trainedStatKey}>경고 임계값</Text>
                        </View>
                      </View>
                    </View>

                    {/* 불꽃 */}
                    <View style={styles.trainedRangeCard}>
                      <View style={styles.trainedRangeHeader}>
                        <Ionicons name="eye-outline" size={14} color={Colors.danger} />
                        <Text style={[styles.trainedRangeTitle, { color: Colors.danger }]}>불꽃 센서</Text>
                        <View style={[styles.trainedBadge, { borderColor: Colors.danger + '55', backgroundColor: Colors.danger + '11' }]}>
                          <Text style={[styles.trainedBadgeText, { color: Colors.danger }]}>정상 구간</Text>
                        </View>
                      </View>
                      <RangeBar
                        min={s.flame_threshold}
                        max={flameRangeMax}
                        color={Colors.danger}
                        maxScale={1023}
                      />
                      <View style={styles.trainedStats}>
                        <View style={styles.trainedStatItem}>
                          <Text style={styles.trainedStatVal}>{s.flame_mean}</Text>
                          <Text style={styles.trainedStatKey}>평균</Text>
                        </View>
                        <View style={styles.trainedDivider} />
                        <View style={styles.trainedStatItem}>
                          <Text style={styles.trainedStatVal}>-{Math.max(2 * s.flame_std, margin)}</Text>
                          <Text style={styles.trainedStatKey}>{2 * s.flame_std >= margin ? '2σ 마진' : '최소 마진'}</Text>
                        </View>
                        <View style={styles.trainedDivider} />
                        <View style={styles.trainedStatItem}>
                          <Text style={[styles.trainedStatVal, { color: Colors.danger }]}>{s.flame_threshold}</Text>
                          <Text style={styles.trainedStatKey}>경고 임계값</Text>
                        </View>
                      </View>
                    </View>
                  </>
                  );
                })()}

                {/* 버튼 3개 */}
                <TouchableOpacity style={styles.historyBtn} onPress={fetchHistory} activeOpacity={0.8}>
                  <Ionicons name="bar-chart-outline" size={18} color={Colors.primary} />
                  <Text style={styles.historyBtnText}>학습 데이터 상세 보기</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.retrainBtn, retraining && styles.retrainBtnLoading]}
                  onPress={handleRetrain} disabled={retraining} activeOpacity={0.8}
                >
                  {retraining ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="refresh-circle-outline" size={18} color="#fff" />}
                  <Text style={styles.retrainBtnText}>{retraining ? '재학습 중...' : '모델 재학습'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.resetBtn, resetting && styles.retrainBtnLoading]}
                  onPress={handleReset} disabled={resetting} activeOpacity={0.8}
                >
                  {resetting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="trash-outline" size={18} color="#fff" />}
                  <Text style={styles.retrainBtnText}>{resetting ? '초기화 중...' : '데이터 초기화'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.aiError}>서버에 연결할 수 없습니다</Text>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RangeBar({ min, max, color, maxScale }: {
  min: number; max: number; color: string; maxScale: number;
}) {
  const clamp = (v: number) => Math.max(0, Math.min(100, (v / maxScale) * 100));
  const minPct = clamp(min);
  const maxPct = clamp(max);
  const fillWidth = Math.max(2, maxPct - minPct);

  return (
    <View style={{ gap: 6 }}>
      {/* 트랙 */}
      <View style={rangeStyles.track}>
        {/* 빈 구간 왼쪽 */}
        <View style={{ flex: minPct, backgroundColor: 'transparent' }} />
        {/* 정상 범위 채움 */}
        <View style={[rangeStyles.fill, { flex: fillWidth, backgroundColor: color + '33', borderColor: color + '66' }]} />
        {/* 빈 구간 오른쪽 */}
        <View style={{ flex: Math.max(0, 100 - maxPct), backgroundColor: 'transparent' }} />
      </View>
      {/* 눈금 레이블 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={rangeStyles.scaleLabel}>0</Text>
        <Text style={rangeStyles.scaleLabel}>256</Text>
        <Text style={rangeStyles.scaleLabel}>512</Text>
        <Text style={rangeStyles.scaleLabel}>768</Text>
        <Text style={rangeStyles.scaleLabel}>1023</Text>
      </View>
    </View>
  );
}

const rangeStyles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: 16,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fill: {
    height: '100%',
    borderWidth: 1,
    borderRadius: 8,
  },
  avgMarker:  { width: 3, height: 10, borderRadius: 2 },
  scaleLabel: { fontSize: 9, color: Colors.inactive },
});

function InfoCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={infoStyles.cell}>
      <Text style={[infoStyles.value, { color }]}>{value}</Text>
      <Text style={infoStyles.label}>{label}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  cell:  { flex: 1, alignItems: 'center', backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, padding: 10, gap: 4 },
  value: { fontSize: Font.md, fontWeight: '800' },
  label: { fontSize: Font.xs, color: Colors.textSecondary },
});

function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  container: { padding: 20, gap: 12, paddingBottom: 40 },
  title:     { fontSize: Font.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  sectionTitle:  { fontSize: Font.sm, fontWeight: '700', color: Colors.primary, letterSpacing: 0.6 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },

  modelBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 12,
  },
  modelStatus: { fontSize: Font.sm, fontWeight: '700' },
  modelSub:    { fontSize: Font.xs, color: Colors.textSecondary, marginTop: 2 },

  statSectionLabel: { fontSize: Font.xs, color: Colors.textSecondary, fontWeight: '600', letterSpacing: 0.5 },
  statGrid: { flexDirection: 'row', gap: 8 },

  progressWrap: { gap: 6 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: Font.sm, color: Colors.textSecondary },
  progressValue: { fontSize: Font.sm },
  progressTrack: { height: 10, backgroundColor: Colors.surfaceHigh, borderRadius: 5, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 5 },
  progressSub:   { fontSize: Font.xs, color: Colors.textSecondary },

  thresholdCard: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 10,
  },
  thresholdTitle: { fontSize: Font.xs, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.5 },
  thresholdRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thresholdKey:   { fontSize: Font.sm, color: Colors.textSecondary, width: 60 },
  thresholdArrow: { fontSize: Font.sm, color: Colors.textSecondary, width: 14 },
  thresholdVal:   { fontSize: Font.md, fontWeight: '800', width: 50 },
  thresholdUnit:  { fontSize: Font.xs, color: Colors.textSecondary, flex: 1 },
  thresholdCalc:  { fontSize: Font.xs, color: Colors.textSecondary, marginLeft: 21, marginTop: -6 },

  rangeCard:   { gap: 8 },
  rangeRow:    { gap: 0 },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  rangeLabelItem: { alignItems: 'center', gap: 2 },
  rangeLabelNum:  { fontSize: Font.sm, fontWeight: '700', color: Colors.textPrimary },
  rangeLabelTag:  { fontSize: Font.xs, color: Colors.textSecondary },
  rangeLabelText: { fontSize: Font.xs, color: Colors.textSecondary },

  historyBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary + '22',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary + '55',
    padding: 13,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  historyBtnText: { fontSize: Font.sm, fontWeight: '700', color: Colors.primary },

  retrainBtn: {
    flexDirection: 'row',
    backgroundColor: '#a855f7',
    borderRadius: Radius.md,
    padding: 13,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resetBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.danger,
    borderRadius: Radius.md,
    padding: 13,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retrainBtnLoading: { backgroundColor: Colors.inactive },
  retrainBtnText:    { fontSize: Font.sm, fontWeight: '700', color: '#fff' },

  aiError: { color: Colors.textSecondary, fontSize: Font.sm, textAlign: 'center', padding: 8 },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle:   { fontSize: Font.lg, fontWeight: '800', color: Colors.textPrimary },
  modalBody:    { padding: 20, gap: 10, paddingBottom: 40 },
  modalSection: { fontSize: Font.sm, fontWeight: '700', color: Colors.primary, marginTop: 8, letterSpacing: 0.5 },

  bucketRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bucketLabel:  { width: 70, fontSize: Font.xs, color: Colors.textSecondary },
  bucketBarWrap:{ flex: 1, height: 12, backgroundColor: Colors.surfaceHigh, borderRadius: 6, overflow: 'hidden' },
  bucketBar:    { height: '100%', borderRadius: 6 },
  bucketCount:  { width: 36, fontSize: Font.xs, color: Colors.textSecondary, textAlign: 'right' },

  hourlyGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hourlyCell:  { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.sm, padding: 8, minWidth: 44, borderWidth: 1, borderColor: Colors.border },
  hourlyCount: { fontSize: Font.sm, fontWeight: '700', color: Colors.textPrimary },
  hourlyLabel: { fontSize: Font.xs, color: Colors.textSecondary },

  sampleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sampleTs:  { fontSize: Font.xs, color: Colors.textSecondary, width: 60 },
  sampleVal: { fontSize: Font.xs, fontWeight: '600' },
  noData:    { fontSize: Font.sm, color: Colors.textSecondary, textAlign: 'center', padding: 12 },


  trainedRangeCard: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  trainedRangeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trainedRangeTitle:  { fontSize: Font.sm, fontWeight: '700', flex: 1 },
  trainedBadge: {
    borderWidth: 1,
    borderColor: Colors.warning + '55',
    backgroundColor: Colors.warning + '11',
    borderRadius: Radius.xl,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  trainedBadgeText: { fontSize: Font.xs, fontWeight: '700', color: Colors.warning },
  trainedStats:     { flexDirection: 'row', alignItems: 'center' },
  trainedStatItem:  { flex: 1, alignItems: 'center', gap: 2 },
  trainedStatVal:   { fontSize: Font.md, fontWeight: '800', color: Colors.textPrimary },
  trainedStatKey:   { fontSize: Font.xs, color: Colors.textSecondary },
  trainedDivider:   { width: 1, height: 32, backgroundColor: Colors.border },
});
