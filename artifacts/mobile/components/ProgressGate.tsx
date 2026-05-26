import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useProgress } from "@/contexts/ProgressContext";

export function ProgressGate({ children }: { children: React.ReactNode }) {
  const { loaded } = useProgress();
  if (!loaded) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center" },
});
