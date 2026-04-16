import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Switch, Pressable, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import { useGame } from "@/context/GameContext";
import { COLORS } from "@/constants/colors";
import Animated, {
  useDerivedValue,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  withTiming,
  withRepeat,
  withSequence,
} from "react-native-reanimated";

type LeagueKey = "iron" | "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master";

const LEAGUE_PRESETS: Array<{ key: LeagueKey; label: string; color: string; icon: any }> = [
  { key: "iron", label: "Iron", color: "#7A7F88", icon: require("../assets/ranks/iron.png") },
  { key: "bronze", label: "Bronze", color: "#B0724A", icon: require("../assets/ranks/bronze.png") },
  { key: "silver", label: "Silver", color: "#DDE3EF", icon: require("../assets/ranks/silver.png") },
  { key: "gold", label: "Gold", color: "#F4C542", icon: require("../assets/ranks/gold.png") },
  { key: "platinum", label: "Platinum", color: "#8ED5FF", icon: require("../assets/ranks/platinum.png") },
  { key: "diamond", label: "Diamond", color: "#5EA2FF", icon: require("../assets/ranks/diamond.png") },
  { key: "master", label: "Master", color: "#C47AFF", icon: require("../assets/ranks/master.png") },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    highGraphicsEnabled,
    setHighGraphicsEnabled,
    lowPerformanceDevice,
    deviceModel,
    deviceMemoryGb,
  } = useGame();
  const [selectedLeague, setSelectedLeague] = useState<LeagueKey>("gold");
  const [pillLayouts, setPillLayouts] = useState<Record<LeagueKey, { x: number; width: number }>>({} as Record<LeagueKey, { x: number; width: number }>);
  const selectedPreset = useMemo(
    () => LEAGUE_PRESETS.find((p) => p.key === selectedLeague) || LEAGUE_PRESETS[3],
    [selectedLeague],
  );
  const shimmerEligible = selectedLeague === "gold" || selectedLeague === "platinum" || selectedLeague === "diamond" || selectedLeague === "master";
  const shimmerEnabled = shimmerEligible && highGraphicsEnabled && !lowPerformanceDevice;
  const glowTarget = useSharedValue(highGraphicsEnabled ? 1 : 0.3);
  const sliderX = useSharedValue(0);
  const sliderW = useSharedValue(56);
  const shimmerProgress = useSharedValue(0);

  useEffect(() => {
    glowTarget.value = withTiming(highGraphicsEnabled ? 1 : 0.3, { duration: 300 });
  }, [highGraphicsEnabled, glowTarget]);

  useEffect(() => {
    const layout = pillLayouts[selectedLeague];
    if (!layout) return;
    sliderX.value = withTiming(layout.x, { duration: 300 });
    sliderW.value = withTiming(layout.width, { duration: 300 });
  }, [pillLayouts, selectedLeague, sliderW, sliderX]);

  useEffect(() => {
    if (!shimmerEnabled) {
      shimmerProgress.value = 0;
      return;
    }
    shimmerProgress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800 }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, [shimmerEnabled, shimmerProgress]);

  const glowProgress = useDerivedValue(() => glowTarget.value);
  const badgeAnimatedStyle = useAnimatedStyle(() => {
    const progress = glowProgress.value;
    return {
      shadowOpacity: interpolate(progress, [0.3, 1], [0.12, 0.5]),
      shadowRadius: interpolate(progress, [0.3, 1], [4, 12]),
      transform: [{ scale: interpolate(progress, [0.3, 1], [0.97, 1]) }],
      borderColor: selectedPreset.color,
      backgroundColor: selectedPreset.color + "22",
      shadowColor: selectedPreset.color,
    };
  }, [selectedPreset.color]);

  const glowLayerStyle = useAnimatedStyle(() => {
    const progress = glowProgress.value;
    return {
      opacity: interpolate(progress, [0.3, 1], [0.2, 0.85]),
      transform: [{ scale: interpolate(progress, [0.3, 1], [0.9, 1.05]) }],
    };
  });

  const shimmerStyle = useAnimatedStyle(() => {
    if (!shimmerEnabled) {
      return { opacity: 0 };
    }
    return {
      opacity: 0.45,
      transform: [
        { translateX: interpolate(shimmerProgress.value, [0, 1], [-120, 180]) },
        { rotate: "-20deg" },
      ],
    };
  }, [shimmerEnabled]);

  const sliderAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sliderX.value }],
    width: sliderW.value,
    backgroundColor: selectedPreset.color + "26",
    borderColor: selectedPreset.color + "88",
  }), [selectedPreset.color]);

  return (
    <View style={[styles.screen, { paddingTop: (Platform.OS === "web" ? 24 : insets.top) + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Ayarlar</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Yüksek Grafikler</Text>
        <Switch
          value={highGraphicsEnabled}
          onValueChange={(v) => setHighGraphicsEnabled(v)}
          trackColor={{ false: COLORS.border, true: COLORS.gold + "66" }}
          thumbColor={highGraphicsEnabled ? COLORS.gold : COLORS.textMuted}
        />
      </View>

      <View style={styles.previewCard}>
        <Text style={styles.infoTitle}>Lig Badge Önizleme</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leagueSelectorRow}>
          <View style={styles.selectorTrack}>
            <Animated.View style={[styles.selectorSlider, sliderAnimatedStyle]} />
          </View>
          {LEAGUE_PRESETS.map((preset) => {
            const active = preset.key === selectedLeague;
            return (
              <Pressable
                key={preset.key}
                onLayout={(e) => {
                  const { x, width } = e.nativeEvent.layout;
                  setPillLayouts((prev) => ({ ...prev, [preset.key]: { x, width } }));
                }}
                style={[
                  styles.leaguePill,
                  active && { borderColor: preset.color, backgroundColor: preset.color + "1F" },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedLeague(preset.key);
                }}
              >
                <Text style={[styles.leaguePillText, active && { color: preset.color }]}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Animated.View style={[styles.badgePreview, badgeAnimatedStyle]}>
          <Animated.View style={[styles.badgeGlowLayer, glowLayerStyle]} />
          <Animated.View pointerEvents="none" style={[styles.shimmerBeam, shimmerStyle]} />
          <ExpoImage source={selectedPreset.icon} style={styles.badgePreviewIcon} contentFit="contain" priority="high" />
          <Text style={[styles.badgePreviewText, { color: selectedPreset.color }]}>{selectedPreset.label}</Text>
        </Animated.View>
        <Text style={styles.previewHint}>
          Ulasmasan bile hedef liginin pariltisini gorebilirsin. Hedefi sec, gazi ac.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Cihaz Analizi</Text>
        <Text style={styles.infoText}>Model: {deviceModel}</Text>
        <Text style={styles.infoText}>RAM: {deviceMemoryGb > 0 ? `${deviceMemoryGb} GB` : "Bilinmiyor"}</Text>
        <Text style={[styles.infoText, { color: lowPerformanceDevice ? COLORS.warning : COLORS.success }]}>
          Performans: {lowPerformanceDevice ? "Low Performance" : "Normal"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, color: COLORS.text },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: COLORS.text },
  leagueSelectorRow: { gap: 8, position: "relative", minHeight: 32, alignItems: "center" },
  selectorTrack: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  selectorSlider: {
    position: "absolute",
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    top: 0,
  },
  leaguePill: {
    zIndex: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surfaceElevated,
  },
  leaguePillText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: COLORS.textSecondary },
  previewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  badgePreview: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    position: "relative",
    overflow: "hidden",
  },
  badgeGlowLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.gold + "33",
  },
  shimmerBeam: {
    position: "absolute",
    top: -8,
    width: 40,
    height: 56,
    backgroundColor: "#FFFFFF66",
    borderRadius: 12,
  },
  badgePreviewIcon: { width: 14, height: 14 },
  badgePreviewText: { fontFamily: "Inter_700Bold", fontSize: 11, color: COLORS.gold },
  previewHint: { fontFamily: "Inter_400Regular", fontSize: 11, color: COLORS.textSecondary },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 6,
  },
  infoTitle: { fontFamily: "Inter_700Bold", fontSize: 13, color: COLORS.text },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 12, color: COLORS.textSecondary },
});

