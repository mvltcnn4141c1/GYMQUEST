import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "@/constants/colors";

type Props = {
  current: number;
  target: number;
  label?: string;
  height?: number;
  color?: string;
  showLabel?: boolean;
};

export function QuestProgressBar({
  current,
  target,
  label,
  height = 6,
  color,
  showLabel = true,
}: Props) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const fillColor = color ?? COLORS.gold;
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.lbl}>{label}</Text> : null}
      <View style={[styles.track, { height }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fillColor }]} />
      </View>
      {showLabel ? (
        <Text style={styles.meta}>
          {current} / {target}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  lbl: { color: COLORS.textMuted, fontSize: 11 },
  track: {
    borderRadius: 3,
    backgroundColor: COLORS.surfaceElevated,
    overflow: "hidden",
  },
  fill: { height: "100%" },
  meta: { color: COLORS.textSecondary, fontSize: 10 },
});
