import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { SessionSummary } from "@/types/progress";

type Props = {
  summary: SessionSummary | undefined;
  colors: { card: string; text: string; textSecondary: string; border: string; tint: string };
};

export function SessionSummaryPanel({ summary, colors }: Props) {
  if (!summary) return null;
  return (
    <View style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Last session summary</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{summary.summary}</Text>
      {summary.focusAreas.length > 0 ? (
        <Text style={[styles.tags, { color: colors.tint }]}>
          Focus: {summary.focusAreas.map((t) => t.replace(/_/g, " ")).join(" · ")}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16, gap: 6 },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  body: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  tags: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4 },
});
