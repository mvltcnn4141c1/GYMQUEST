import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/context/GameContext";
import { COLORS, CLASS_COLORS } from "@/constants/colors";

type LiftoffGoal = "all" | "yag_yakim" | "guc" | "kondisyon";

interface LiftoffTemplate {
  id: string;
  exerciseType: string;
  exerciseName: string;
  category: string;
  sets: number;
  reps: number;
  durationMin: number;
  intensity: "basit" | "orta" | "ileri";
  note: string;
  howToTip: string;
  isLiftoffTemplate: boolean;
}

interface LiftoffResponse {
  class: string;
  title: string;
  goal: LiftoffGoal;
  rotationWeek: number;
  templates: LiftoffTemplate[];
}

export default function LiftoffScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [goal, setGoal] = React.useState<LiftoffGoal>("all");
  const { data, isLoading } = useQuery<LiftoffResponse>({
    queryKey: ["workouts-liftoff", goal],
    queryFn: () => apiGet(`/workouts/liftoff?goal=${goal}`),
  });

  const classKey = String(data?.class || "fighter");
  const classColor = CLASS_COLORS[classKey] || COLORS.gold;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Quick Start (Liftoff)</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.gold} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.classTag, { borderColor: classColor + "55", backgroundColor: classColor + "1A" }]}>
            <MaterialCommunityIcons name="rocket-launch" size={14} color={classColor} />
            <Text style={[styles.classTagText, { color: classColor }]}>{classKey.toUpperCase()} ICIN HAZIR LISTE</Text>
          </View>
          <Text style={styles.rotationText}>Haftalik Rotasyon: Hafta {data?.rotationWeek || "-"}</Text>

          <View style={styles.goalRow}>
            {[
              { id: "all" as LiftoffGoal, label: "Tum Hedefler", icon: "format-list-bulleted" },
              { id: "yag_yakim" as LiftoffGoal, label: "Yag Yakim", icon: "fire" },
              { id: "guc" as LiftoffGoal, label: "Guc", icon: "arm-flex" },
              { id: "kondisyon" as LiftoffGoal, label: "Kondisyon", icon: "run-fast" },
            ].map((item) => {
              const active = goal === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.goalChip, active && { borderColor: COLORS.gold, backgroundColor: COLORS.gold + "18" }]}
                  onPress={() => setGoal(item.id)}
                >
                  <MaterialCommunityIcons name={item.icon as any} size={13} color={active ? COLORS.gold : COLORS.textMuted} />
                  <Text style={[styles.goalChipText, active && { color: COLORS.gold }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {(data?.templates || []).map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{item.exerciseName}</Text>
                <View style={styles.templateBadge}>
                  <Text style={styles.templateBadgeText}>LIFTOFF</Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                {item.durationMin > 0 ? `${item.durationMin} dk` : `${item.sets} set x ${item.reps} tekrar`} · {item.intensity}
              </Text>
              <Text style={styles.cardNote}>{item.note}</Text>
              <Text style={styles.howToTitle}>Nasil Yapilir?</Text>
              <Text style={styles.howToText}>{item.howToTip}</Text>
              <Pressable
                style={styles.startBtn}
                onPress={() =>
                  router.push({
                    pathname: "/log-workout",
                    params: {
                      exerciseType: item.exerciseType,
                      exerciseName: item.exerciseName,
                      isLiftoffTemplate: "true",
                    },
                  })
                }
              >
                <MaterialCommunityIcons name="play-circle" size={16} color="#000" />
                <Text style={styles.startBtnText}>Bu Antrenmanla Basla</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  title: { fontFamily: "Inter_700Bold", fontSize: 16, color: COLORS.text },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, gap: 10, paddingBottom: 100 },
  classTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  classTagText: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1 },
  rotationText: { fontFamily: "Inter_500Medium", fontSize: 11, color: COLORS.textMuted, marginBottom: 4 },
  goalRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  goalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  goalChipText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: COLORS.textSecondary },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: COLORS.text, flex: 1 },
  templateBadge: {
    backgroundColor: COLORS.arcane + "20",
    borderColor: COLORS.arcane + "55",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  templateBadgeText: { fontFamily: "Inter_700Bold", fontSize: 9, color: COLORS.arcane },
  cardMeta: { fontFamily: "Inter_500Medium", fontSize: 12, color: COLORS.textSecondary },
  cardNote: { fontFamily: "Inter_400Regular", fontSize: 12, color: COLORS.textMuted },
  howToTitle: { fontFamily: "Inter_700Bold", fontSize: 12, color: COLORS.gold, marginTop: 2 },
  howToText: { fontFamily: "Inter_400Regular", fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  startBtn: {
    marginTop: 4,
    backgroundColor: COLORS.gold,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  startBtnText: { fontFamily: "Inter_700Bold", fontSize: 12, color: "#000" },
});
