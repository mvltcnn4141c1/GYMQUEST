import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";

type Props = {
  streakDays: number;
  isActive: boolean;
  isAtRisk?: boolean;
  hoursUntilBreak?: number;
};

export function StreakBadge({ streakDays, isActive, isAtRisk, hoursUntilBreak }: Props) {
  return (
    <View style={[styles.row, isAtRisk && { borderColor: COLORS.warning }]}>
      <MaterialCommunityIcons
        name={isActive ? "fire" : "fire-off"}
        size={20}
        color={isAtRisk ? COLORS.warning : COLORS.fire}
      />
      <View>
        <Text style={styles.main}>{streakDays} gün seri</Text>
        {hoursUntilBreak != null && isAtRisk ? (
          <Text style={styles.sub}>~{hoursUntilBreak} saat kaldı</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  main: { color: COLORS.text, fontWeight: "700" },
  sub: { color: COLORS.warning, fontSize: 11, marginTop: 2 },
});
