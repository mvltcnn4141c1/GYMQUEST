import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "@/constants/colors";

type RetentionStatus = {
  canClaimDailyReward: boolean;
  dailyRewardStreak: number;
  lastDailyRewardDate: string | null;
  weeklyChestAvailable: boolean;
  comebackAvailable: boolean;
  weeklyDaysActive: number;
  inactiveHours: number;
  notifications: { missedWorkout: boolean; streakBreaking: boolean };
};

type Props = {
  onRewardClaimed?: (xp: number, coins: number, gems: number) => void;
  onStatusLoaded?: (s: RetentionStatus | null) => void;
};

export function DailyRewardCalendar({ onStatusLoaded }: Props) {
  useEffect(() => {
    onStatusLoaded?.({
      canClaimDailyReward: false,
      dailyRewardStreak: 0,
      lastDailyRewardDate: null,
      weeklyChestAvailable: false,
      comebackAvailable: false,
      weeklyDaysActive: 0,
      inactiveHours: 0,
      notifications: { missedWorkout: false, streakBreaking: false },
    });
  }, [onStatusLoaded]);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Günlük ödüller</Text>
      <Text style={styles.sub}>Yakında: takvim ve ödül talebi.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { color: COLORS.text, fontWeight: "700", marginBottom: 4 },
  sub: { color: COLORS.textMuted, fontSize: 12 },
});
