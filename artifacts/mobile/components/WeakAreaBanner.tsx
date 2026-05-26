import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ModuleId } from "@/types/progress";
import type { WeakArea } from "@/types/progress";

type Props = {
  module: ModuleId;
  weakAreas: WeakArea[];
  weakPractice: boolean;
  colors: { card: string; text: string; textSecondary: string; tint: string; border: string };
  onPracticeWeak?: () => void;
};

export function WeakAreaBanner({ module, weakAreas, weakPractice, colors, onPracticeWeak }: Props) {
  if (weakAreas.length === 0) return null;

  const top = weakAreas.slice(0, 4).map((w) => w.label).join(" · ");

  return (
    <View style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Ionicons name="fitness-outline" size={18} color={colors.tint} />
        <Text style={[styles.title, { color: colors.text }]}>
          {weakPractice ? "Weak-area practice mode" : "Areas to improve"}
        </Text>
      </View>
      <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={3}>
        {weakPractice
          ? `This session focuses on: ${top}`
          : `From your last sessions: ${top}`}
      </Text>
      {!weakPractice && onPracticeWeak ? (
        <Pressable onPress={onPracticeWeak} style={[styles.btn, { backgroundColor: colors.tint }]}>
          <Text style={styles.btnText}>Practice weak areas</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  body: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  btn: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginTop: 4 },
  btnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
