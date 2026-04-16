import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { COLORS } from "@/constants/colors";

type Props = {
  visible: boolean;
  xpAmount: number;
  coinsEarned?: number;
  gemsEarned?: number;
  onDismiss: () => void;
};

export function XPGainOverlay({
  visible,
  xpAmount,
  coinsEarned = 0,
  gemsEarned = 0,
  onDismiss,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.back}>
        <View style={styles.card}>
          <Text style={styles.title}>Harika!</Text>
          <Text style={styles.xp}>+{xpAmount} XP</Text>
          {coinsEarned > 0 ? (
            <Text style={styles.line}>+{coinsEarned} altın</Text>
          ) : null}
          {gemsEarned > 0 ? (
            <Text style={styles.line}>+{gemsEarned} gem</Text>
          ) : null}
          <Pressable style={styles.btn} onPress={onDismiss}>
            <Text style={styles.btnText}>Devam</Text>
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
    padding: 24,
    width: "100%",
    maxWidth: 300,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  title: { color: COLORS.text, fontSize: 20, fontWeight: "800", marginBottom: 8 },
  xp: { color: COLORS.gold, fontSize: 28, fontWeight: "900", marginBottom: 8 },
  line: { color: COLORS.textSecondary, marginVertical: 2 },
  btn: {
    marginTop: 16,
    backgroundColor: COLORS.gold,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  btnText: { color: "#000", fontWeight: "700" },
});
