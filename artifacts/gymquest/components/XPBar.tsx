import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "@/constants/colors";

type Props = {
  exp: number;
  expToNextLevel: number;
  level: number;
};

export function XPBar({ exp, expToNextLevel, level }: Props) {
  const max = Math.max(1, expToNextLevel);
  const pct = Math.min(100, (exp / max) * 100);
  return (
    <View style={styles.wrap}>
      <View style={styles.labels}>
        <Text style={styles.level}>Seviye {level}</Text>
        <Text style={styles.xp}>
          {exp} / {max} XP
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labels: { flexDirection: "row", justifyContent: "space-between" },
  level: { color: COLORS.text, fontSize: 12, fontWeight: "700" },
  xp: { color: COLORS.textMuted, fontSize: 11 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.surfaceElevated,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: COLORS.xpBar,
  },
});
