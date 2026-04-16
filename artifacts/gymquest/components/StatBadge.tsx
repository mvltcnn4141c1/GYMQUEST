import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";

type Props = {
  label: string;
  value: number;
  icon: string;
  color: string;
};

export function StatBadge({ label, value, icon, color }: Props) {
  return (
    <View style={[styles.box, { borderColor: color + "44" }]}>
      <MaterialCommunityIcons name={icon as "arm-flex"} size={14} color={color} />
      <Text style={styles.lbl}>{label}</Text>
      <Text style={[styles.val, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
    gap: 2,
  },
  lbl: { fontSize: 9, color: COLORS.textMuted, fontWeight: "600" },
  val: { fontSize: 15, fontWeight: "800" },
});
