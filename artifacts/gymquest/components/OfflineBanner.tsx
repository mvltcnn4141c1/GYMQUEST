import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNetwork } from "@/context/NetworkContext";
import { COLORS } from "@/constants/colors";

export function OfflineBanner() {
  const { isOnline } = useNetwork();
  if (isOnline) return null;
  return (
    <View style={styles.bar} pointerEvents="none">
      <Text style={styles.text}>Çevrimdışı — bazı veriler güncel olmayabilir</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: COLORS.warning + "E6",
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  text: { color: "#000", fontSize: 12, fontWeight: "600" },
});
