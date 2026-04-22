import React from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import { useCurriculum } from "@/contexts/CurriculumContext";

export function CurriculumToggle() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const { level, setLevel } = useCurriculum();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
      <Pressable
        onPress={() => setLevel("b")}
        style={[styles.btn, level === "b" && { backgroundColor: colors.tint }]}
      >
        <Text style={[styles.text, { color: level === "b" ? "#fff" : colors.textSecondary }]}>Spanish B</Text>
      </Pressable>
      <Pressable
        onPress={() => setLevel("ab_initio")}
        style={[styles.btn, level === "ab_initio" && { backgroundColor: colors.tint }]}
      >
        <Text style={[styles.text, { color: level === "ab_initio" ? "#fff" : colors.textSecondary }]}>
          Spanish Ab
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingVertical: 7,
  },
  text: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
