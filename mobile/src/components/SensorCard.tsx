import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Font, Radius } from '../theme';
import { StatusBadge } from './StatusBadge';

interface Props {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  triggered: boolean;
  value?: string;
  unit?: string;
  sub?: string;
}

export function SensorCard({ title, icon, triggered, value, unit, sub }: Props) {
  const variant = triggered ? 'danger' : 'success';
  const iconColor = triggered ? Colors.danger : Colors.success;

  return (
    <View style={[styles.card, triggered && styles.cardAlert]}>
      <View style={[styles.iconWrap, { backgroundColor: iconColor + '22' }]}>
        <Ionicons name={icon} size={28} color={iconColor} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{title}</Text>
        {value !== undefined && (
          <Text style={styles.value}>
            {value}
            {unit && <Text style={styles.unit}> {unit}</Text>}
          </Text>
        )}
        {sub !== undefined && (
          <Text style={styles.sub}>{sub}</Text>
        )}
      </View>
      <StatusBadge label={triggered ? '감지' : '정상'} variant={variant} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardAlert: {
    borderColor: Colors.danger + '88',
    backgroundColor: Colors.danger + '11',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  title: {
    fontSize: Font.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: Font.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  unit: {
    fontSize: Font.sm,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  sub: {
    fontSize: Font.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
