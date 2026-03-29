import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
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

  const handleWriting = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/writing");
  };

  const handleHistory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/history");
  };

  const handleFlashcards = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/flashcards");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ["#1A1030", "#0F1117"] : ["#F0EDFF", "#F5F6FA"]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPad + 24, paddingBottom: botPad + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
        >
          <View style={styles.inner}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={[styles.subtitle, { color: theme.tint }]}>IB Spanish</Text>
                <Text style={[styles.title, { color: theme.text }]}>Práctica oral</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={handleFlashcards}
                  style={({ pressed }) => [
                    styles.headerBtn,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="bookmark-outline" size={22} color="#8E44AD" />
                </Pressable>
                <Pressable
                  onPress={handleHistory}
                  style={({ pressed }) => [
                    styles.headerBtn,
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
                  {totalThemes - usedThemes.filter((t) => t).length}
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
                <Text style={[styles.statValue, { color: theme.tint }]}>A2/B2</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Nivel objetivo
                </Text>
              </View>
            </View>

            {/* Info box */}
            <View
              style={[
                styles.infoBox,
                { backgroundColor: theme.accent, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={theme.tint}
                style={{ marginTop: 1 }}
              />
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                El examinador hablará en español. Responde con frases completas para practicar tu expresión oral.
              </Text>
            </View>

            {/* Section divider */}
            <View style={styles.sectionDivider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                MODOS DE PRÁCTICA
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            {/* Primary action — oral exam */}
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

            {/* Secondary practice buttons */}
            <View style={styles.practiceGrid}>
              {[
                {
                  icon: "image-outline" as const,
                  label: "Práctica con imagen",
                  badge: "IB Oral",
                  color: theme.tint,
                  onPress: handleImagePractice,
                },
                {
                  icon: "headset-outline" as const,
                  label: "Comprensión auditiva",
                  badge: "IB Listening",
                  color: "#3498DB",
                  onPress: handleListening,
                },
                {
                  icon: "book-outline" as const,
                  label: "Comprensión lectora",
                  badge: "IB Reading",
                  color: "#27AE60",
                  onPress: handleReading,
                },
                {
                  icon: "create-outline" as const,
                  label: "Práctica de escritura",
                  badge: "IB Writing",
                  color: "#E67E22",
                  onPress: handleWriting,
                },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  onPress={item.onPress}
                  style={({ pressed }) => [
                    styles.practiceBtn,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      opacity: pressed ? 0.8 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <View style={[styles.practiceBtnIcon, { backgroundColor: item.color + "18" }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <Text style={[styles.practiceBtnText, { color: theme.text }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <View
                    style={[
                      styles.practiceBtnBadge,
                      { backgroundColor: item.color + "18", borderColor: item.color + "40" },
                    ]}
                  >
                    <Text style={[styles.practiceBtnBadgeText, { color: item.color }]}>
                      {item.badge}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: "center",
  },
  inner: {
    width: "100%",
    maxWidth: 540,
    paddingHorizontal: 22,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  progressCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
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
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 28,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  sectionDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
  },
  startBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
  },
  startBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 19,
    paddingHorizontal: 24,
  },
  startBtnText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    textAlign: "center",
  },
  practiceGrid: {
    gap: 12,
  },
  practiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  practiceBtnIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  practiceBtnText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  practiceBtnBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  practiceBtnBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
