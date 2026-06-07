import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { BlockType } from "@/lib/paper";
import { formatMissedTypeLabels } from "@/lib/weakPractice";

type Colors = { card: string; cardAlt: string; text: string; textSecondary: string; border: string; tint: string };

export function WeakPracticeSetup({
  colors,
  accent,
  missedTypes,
  quickMode,
}: {
  colors: Colors;
  accent: string;
  missedTypes: BlockType[];
  quickMode: boolean;
}) {
  return (
    <View style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Ionicons name="information-circle-outline" size={16} color={accent} />
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          Select Quick Practice to practice question types you had difficulty with on your last full past paper.
        </Text>
      </View>
      {quickMode && missedTypes.length > 0 ? (
        <Text style={[styles.types, { color: accent }]}>
          Question types: {formatMissedTypeLabels(missedTypes)}
        </Text>
      ) : quickMode ? (
        <Text style={[styles.types, { color: colors.textSecondary }]}>
          Complete a full past paper first to target specific question types.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10, marginBottom: 4 },
  row: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  desc: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  types: { fontSize: 12, fontFamily: "Inter_600SemiBold", lineHeight: 17 },
});
