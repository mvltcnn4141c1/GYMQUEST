import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { COLORS } from "@/constants/colors";

type Props = { children: ReactNode };
type State = { err: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) console.warn("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.err) {
      return (
        <View style={styles.box}>
          <Text style={styles.title}>Bir sorun oluştu</Text>
          <Text style={styles.msg}>{this.state.err.message}</Text>
          <Pressable
            style={styles.btn}
            onPress={() => this.setState({ err: null })}
          >
            <Text style={styles.btnText}>Yeniden dene</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: { color: COLORS.text, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  msg: { color: COLORS.textMuted, textAlign: "center", marginBottom: 20 },
  btn: { backgroundColor: COLORS.gold, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: "#000", fontWeight: "600" },
});
