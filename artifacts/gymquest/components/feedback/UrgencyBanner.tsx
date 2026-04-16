import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { COLORS } from "@/constants/colors";

type Props = {
  type: string;
  message: string;
  hoursLeft?: number;
  onPress?: () => void;
};

export function UrgencyBanner({ message, hoursLeft, onPress }: Props) {
  return (
    <Pressable style={styles.box} onPress={onPress}>
      <Text style={styles.msg}>{message}</Text>
      {hoursLeft != null ? (
        <Text style={styles.sub}>{hoursLeft} saat içinde antrenman kaydet</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: COLORS.danger + "22",
    borderWidth: 1,
    borderColor: COLORS.danger + "55",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  msg: { color: COLORS.text, fontWeight: "700" },
  sub: { color: COLORS.textSecondary, marginTop: 4, fontSize: 12 },
});
