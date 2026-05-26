import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useProgress } from "@/contexts/ProgressContext";
import { MODULE_IDS, MODULE_LABELS, type ModuleId } from "@/types/progress";

type Props = {
  visible: boolean;
  onClose: () => void;
  colors: {
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    border: string;
    tint: string;
  };
};

export function ProgressManager({ visible, onClose, colors }: Props) {
  const progress = useProgress();
  const [busy, setBusy] = useState(false);

  const confirmReset = (label: string, action: () => Promise<void>) => {
    const run = async () => {
      setBusy(true);
      try {
        await action();
      } finally {
        setBusy(false);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Reset ${label}? This cannot be undone.`)) void run();
      return;
    }
    Alert.alert("Start over", `Reset ${label}? Saved progress and summaries for this section will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: () => void run() },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>My progress</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={[styles.section, { color: colors.textSecondary }]}>
              Flashcards: {progress.flashcards.length} · Sessions saved: {progress.sessionSummaries.length}
            </Text>

            {MODULE_IDS.map((id: ModuleId) => {
              const snap = progress.getModuleSnapshot(id);
              const summary = progress.getLatestSummary(id);
              return (
                <View key={id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{MODULE_LABELS[id]}</Text>
                  {snap ? (
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      In progress · step: {snap.phase}
                    </Text>
                  ) : (
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>No draft in progress</Text>
                  )}
                  {summary ? (
                    <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={2}>
                      Last: {summary.summary}
                    </Text>
                  ) : null}
                  <Pressable
                    disabled={busy}
                    onPress={() => confirmReset(MODULE_LABELS[id], () => progress.resetModule(id))}
                    style={[styles.resetBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.resetText, { color: "#E74C3C" }]}>Start over this module</Text>
                  </Pressable>
                </View>
              );
            })}

            <Pressable
              disabled={busy}
              onPress={() =>
                confirmReset("everything (flashcards, all modules)", () => progress.resetAll())
              }
              style={[styles.resetAll, { borderColor: "#E74C3C" }]}
            >
              <Text style={styles.resetAllText}>Reset all progress & flashcards</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { maxHeight: "88%", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  scroll: { paddingHorizontal: 20 },
  section: { fontSize: 13, marginBottom: 12, fontFamily: "Inter_400Regular" },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10, gap: 6 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  resetBtn: { marginTop: 6, paddingVertical: 8, borderTopWidth: 1, borderColor: "transparent" },
  resetText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  resetAll: {
    marginTop: 8,
    marginBottom: 24,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  resetAllText: { color: "#E74C3C", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
