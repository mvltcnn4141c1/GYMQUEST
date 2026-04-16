import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { LeagueTier } from "@/context/GameContext";
import { LEAGUE_COLORS, COLORS } from "@/constants/colors";

const LABELS: Record<string, string> = {
  demir: "Demir",
  bronz: "Bronz",
  gumus: "Gümüş",
  altin: "Altın",
  platin: "Platin",
  sampiyonluk: "Şampiyonluk",
  iron: "Iron",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
  master: "Master",
};

type Props = {
  league: LeagueTier;
  size?: "xs" | "sm" | "md";
  showName?: boolean;
};

export function LeagueBadge({ league, size = "sm", showName }: Props) {
  const color = LEAGUE_COLORS[league] || COLORS.textMuted;
  const pad = size === "xs" ? 4 : size === "sm" ? 6 : 8;
  return (
    <View style={[styles.row, { paddingHorizontal: pad, paddingVertical: pad / 2, borderColor: color + "66" }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      {showName ? (
        <Text style={[styles.txt, { color, fontSize: size === "xs" ? 9 : 11 }]}>
          {LABELS[league] ?? league}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  txt: { fontWeight: "700" },
});
