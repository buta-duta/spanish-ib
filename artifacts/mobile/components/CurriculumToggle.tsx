import React from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useCurriculum } from "@/contexts/CurriculumContext";

export function CurriculumToggle() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const { level, setLevel } = useCurriculum();

  return (
    <View style={[styles.shell, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Nivel</Text>
      <View style={[styles.wrap, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
      <Pressable
        onPress={() => setLevel("b")}
        style={[styles.btn, level === "b" && { backgroundColor: colors.tint }]}
      >
        <Ionicons name="school-outline" size={13} color={level === "b" ? "#fff" : colors.textSecondary} />
        <Text style={[styles.text, { color: level === "b" ? "#fff" : colors.textSecondary }]}>Spanish B</Text>
      </Pressable>
      <Pressable
        onPress={() => setLevel("ab_initio")}
        style={[styles.btn, level === "ab_initio" && { backgroundColor: colors.tint }]}
      >
        <Ionicons name="leaf-outline" size={13} color={level === "ab_initio" ? "#fff" : colors.textSecondary} />
        <Text style={[styles.text, { color: level === "ab_initio" ? "#fff" : colors.textSecondary }]}>
          Spanish Ab Initio
        </Text>
      </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    gap: 7,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  wrap: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  btn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1,
  },
  text: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
