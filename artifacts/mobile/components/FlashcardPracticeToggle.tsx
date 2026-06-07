import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Colors = { card: string; text: string; textSecondary: string; border: string };

export function FlashcardPracticeToggle({
  colors,
  accent,
  includeFlashcards,
  onToggle,
  flashcardCount,
}: {
  colors: Colors;
  accent: string;
  includeFlashcards: boolean;
  onToggle: (v: boolean) => void;
  flashcardCount: number;
}) {
  return (
    <View style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable onPress={() => onToggle(!includeFlashcards)} style={styles.row}>
        <View style={[styles.checkbox, { borderColor: accent, backgroundColor: includeFlashcards ? accent : "transparent" }]}>
          {includeFlashcards ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.text }]}>Practice my flashcard words</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {flashcardCount > 0
              ? `Include ${flashcardCount} saved word${flashcardCount === 1 ? "" : "s"} in generated content`
              : "Add words to flashcards first to use this option"}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 12, borderWidth: 1, padding: 14 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 2 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
});
