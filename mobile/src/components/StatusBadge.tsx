import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Font, Radius } from '../theme';

type Variant = 'success' | 'warning' | 'danger' | 'inactive';

interface Props {
  label: string;
  variant: Variant;
  dot?: boolean;
}

const COLOR_MAP: Record<Variant, string> = {
  success:  Colors.success,
  warning:  Colors.warning,
  danger:   Colors.danger,
  inactive: Colors.inactive,
};

export function StatusBadge({ label, variant, dot = true }: Props) {
  const color = COLOR_MAP[variant];
  return (
    <View style={[styles.badge, { borderColor: color + '44', backgroundColor: color + '22' }]}>
      {dot && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: Font.xs,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
