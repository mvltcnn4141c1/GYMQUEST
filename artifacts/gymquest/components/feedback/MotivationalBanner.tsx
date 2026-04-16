import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { COLORS } from "@/constants/colors";

type Props = {
  hoursInactive: number;
  characterName: string;
  onPress?: () => void;
};

export function MotivationalBanner({ hoursInactive, characterName, onPress }: Props) {
  return (
    <Pressable style={styles.box} onPress={onPress}>
      <Text style={styles.msg}>
        {characterName}, {Math.floor(hoursInactive)} saattir kayıt yok — geri dön!
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: COLORS.info + "18",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.info + "44",
  },
  msg: { color: COLORS.text, fontSize: 13 },
});
