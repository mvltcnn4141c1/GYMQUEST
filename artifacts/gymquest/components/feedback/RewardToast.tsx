import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { COLORS } from "@/constants/colors";

const SFX = {
  reward: require("../../assets/sfx/reward.wav"),
  levelup: require("../../assets/sfx/level-up.wav"),
  mythic: require("../../assets/sfx/mythic.wav"),
} as const;

type Props = {
  visible: boolean;
  xp: number;
  coins?: number;
  bonusXp?: number;
  title?: string;
  fullScreenConfetti?: boolean;
  soundType?: "levelup" | "coin";
  onHide?: () => void;
};

export function RewardToast({
  visible,
  xp,
  coins = 0,
  bonusXp = 0,
  title = "Tebrikler Usta!",
  fullScreenConfetti = false,
  soundType = "coin",
  onHide,
}: Props) {
  const slide = useRef(new Animated.Value(-120)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const confetti = useMemo(
    () =>
      (fullScreenConfetti ? Array.from({ length: 42 }, (_, i) => i) : [0, 1, 2, 3, 4, 5]).map((i) => ({
        id: i,
        left: fullScreenConfetti ? (i % 7) * 52 + 8 : 16 + i * 44,
        top: fullScreenConfetti ? Math.floor(i / 7) * 38 + 20 : -6,
      })),
    [fullScreenConfetti],
  );

  async function playRewardSound() {
    const source = fullScreenConfetti
      ? SFX.mythic
      : soundType === "levelup"
        ? SFX.levelup
        : SFX.reward;
    try {
      const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true, volume: 0.65 });
      sound.setOnPlaybackStatusUpdate((status) => {
        if ("didJustFinish" in status && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch {}
  }

  useEffect(() => {
    if (!visible) return;
    playRewardSound();
    Animated.parallel([
      Animated.timing(slide, { toValue: 10, duration: 260, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.timing(sparkleAnim, { toValue: 1, duration: 340, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slide, { toValue: -120, duration: 220, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(sparkleAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => onHide?.());
    }, 2300);
    return () => clearTimeout(t);
  }, [visible, slide, fade, sparkleAnim, onHide, soundType]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        fullScreenConfetti ? styles.wrapFull : styles.wrap,
        { opacity: fade, transform: [{ translateY: slide }] },
      ]}
    >
      {confetti.map((c) => (
        <Animated.View
          key={c.id}
          style={[
            styles.spark,
            {
              left: c.left,
              top: c.top,
              opacity: sparkleAnim,
              transform: [
                {
                  translateY: sparkleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, fullScreenConfetti ? 24 : -8],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
      <Text style={styles.title}>{title}</Text>
      <View style={styles.row}>
        <MaterialCommunityIcons name="lightning-bolt" size={14} color={COLORS.gold} />
        <Text style={styles.value}>+{xp} XP</Text>
        <Text style={styles.dot}>•</Text>
        <MaterialCommunityIcons name="circle-multiple" size={13} color={COLORS.success} />
        <Text style={[styles.value, { color: COLORS.success }]}>+{coins} Coin</Text>
      </View>
      {bonusXp > 0 ? (
        <Text style={styles.bonusText}>+{bonusXp} XP Bonus (Class Mastery)</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
    zIndex: 999,
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.gold + "66",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  wrapFull: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0A0A0FB0",
  },
  title: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  value: { color: COLORS.gold, fontSize: 13, fontWeight: "800" },
  bonusText: { color: COLORS.info, fontSize: 12, fontWeight: "700", marginTop: 4 },
  dot: { color: COLORS.textMuted, marginHorizontal: 2 },
  spark: {
    position: "absolute",
    top: -6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
});
