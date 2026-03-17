import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { THEMES } from "@/constants/themes";
import { useIBTheme } from "@/contexts/ThemeContext";
import { useExam } from "@/contexts/ExamContext";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[isDark ? "dark" : "light"];
  const { usedThemes, selectedTheme } = useIBTheme();
  const { loadSessions, sessions } = useExam();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadSessions();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const completedThemes = usedThemes.length;
  const totalThemes = THEMES.length;
  const progress = completedThemes / totalThemes;

  const handleStartExam = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/theme-select");
  };

  const handleImagePractice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/image-practice");
  };

  const handleListening = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/listening");
  };

  const handleReading = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/reading");
  };

  const handleHistory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/history");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ["#1A1030", "#0F1117"] : ["#F0EDFF", "#F5F6FA"]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          styles.content,
          {
            paddingTop: topPad + 20,
            paddingBottom: botPad + 20,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.subtitle, { color: theme.tint }]}>IB Spanish B</Text>
            <Text style={[styles.title, { color: theme.text }]}>Práctica oral</Text>
          </View>
          <Pressable
            onPress={handleHistory}
            style={({ pressed }) => [
              styles.historyBtn,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="time-outline" size={22} color={theme.tint} />
          </Pressable>
        </View>

        {/* Progress card */}
        <View
          style={[
            styles.progressCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
              Progreso de temas
            </Text>
            <Text style={[styles.progressCount, { color: theme.tint }]}>
              {completedThemes}/{totalThemes}
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: theme.cardAlt }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.tint,
                  width: `${progress * 100}%`,
                },
              ]}
            />
          </View>
          <View style={styles.themeChips}>
            {THEMES.map((t) => {
              const used = usedThemes.includes(t.id);
              return (
                <View
                  key={t.id}
                  style={[
                    styles.themeChip,
                    {
                      backgroundColor: used ? t.color + "22" : theme.cardAlt,
                      borderColor: used ? t.color : theme.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.themeChipDot,
                      { backgroundColor: used ? t.color : theme.border },
                    ]}
                  />
                  <Text
                    style={[
                      styles.themeChipText,
                      { color: used ? t.color : theme.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {t.nameShort}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.statValue, { color: theme.text }]}>
              {sessions.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Sesiones
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.statValue, { color: theme.text }]}>
              {totalThemes - usedThemes.filter(t => t).length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Temas pendientes
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.statValue, { color: theme.tint }]}>B2</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Nivel objetivo
            </Text>
          </View>
        </View>

        {/* Info text */}
        <View style={[styles.infoBox, { backgroundColor: theme.accent, borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={theme.tint} style={{ marginTop: 1 }} />
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            El examinador hablará en español. Responde con frases completas para practicar tu expresión oral.
          </Text>
        </View>

        <View style={styles.spacer} />

        {/* Start button */}
        <Pressable
          onPress={handleStartExam}
          style={({ pressed }) => [
            styles.startBtn,
            { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <LinearGradient
            colors={[theme.tint, theme.tintDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.startBtnGradient}
          >
            <Ionicons name="mic-outline" size={22} color="#fff" />
            <Text style={styles.startBtnText}>Comenzar examen oral</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </LinearGradient>
        </Pressable>

        {/* Image practice button */}
        <Pressable
          onPress={handleImagePractice}
          style={({ pressed }) => [
            styles.imageBtn,
            { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <Ionicons name="image-outline" size={20} color={theme.tint} />
          <Text style={[styles.imageBtnText, { color: theme.text }]}>Práctica con imagen</Text>
          <View style={[styles.imageBtnBadge, { backgroundColor: theme.tint + "20", borderColor: theme.tint + "40" }]}>
            <Text style={[styles.imageBtnBadgeText, { color: theme.tint }]}>IB Oral</Text>
          </View>
        </Pressable>

        {/* Listening practice button */}
        <Pressable
          onPress={handleListening}
          style={({ pressed }) => [
            styles.imageBtn,
            { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <Ionicons name="headset-outline" size={20} color="#3498DB" />
          <Text style={[styles.imageBtnText, { color: theme.text }]}>Comprensión auditiva</Text>
          <View style={[styles.imageBtnBadge, { backgroundColor: "#3498DB20", borderColor: "#3498DB40" }]}>
            <Text style={[styles.imageBtnBadgeText, { color: "#3498DB" }]}>IB Listening</Text>
          </View>
        </Pressable>

        {/* Reading practice button */}
        <Pressable
          onPress={handleReading}
          style={({ pressed }) => [
            styles.imageBtn,
            { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <Ionicons name="book-outline" size={20} color="#27AE60" />
          <Text style={[styles.imageBtnText, { color: theme.text }]}>Comprensión lectora</Text>
          <View style={[styles.imageBtnBadge, { backgroundColor: "#27AE6020", borderColor: "#27AE6040" }]}>
            <Text style={[styles.imageBtnBadgeText, { color: "#27AE60" }]}>IB Reading</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  historyBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  progressCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  progressCount: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 14,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  themeChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  themeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  themeChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  themeChipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  spacer: { flex: 1 },
  startBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 8,
  },
  startBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  startBtnText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    textAlign: "center",
  },
  imageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  imageBtnText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  imageBtnBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  imageBtnBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
