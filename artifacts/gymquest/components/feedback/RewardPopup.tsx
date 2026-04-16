import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { COLORS } from "@/constants/colors";

type Reward = { type: "xp" | "coins" | "gems"; amount: number };

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  rewards: Reward[];
  onDismiss: () => void;
};

export function RewardPopup({ visible, title, subtitle, rewards, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.back}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
          {rewards.map((r, i) => (
            <Text key={i} style={styles.line}>
              +{r.amount} {r.type}
            </Text>
          ))}
          <Pressable style={styles.btn} onPress={onDismiss}>
            <Text style={styles.btnText}>Tamam</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: {
    flex: 1,
    backgroundColor: "#000A",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 320,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { color: COLORS.gold, fontSize: 20, fontWeight: "800", marginBottom: 4 },
  sub: { color: COLORS.textMuted, marginBottom: 12 },
  line: { color: COLORS.text, marginVertical: 2 },
  btn: {
    marginTop: 16,
    backgroundColor: COLORS.gold,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#000", fontWeight: "700" },
});
