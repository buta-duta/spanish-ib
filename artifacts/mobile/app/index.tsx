import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { ProgressManager } from "@/components/ProgressManager";
import { useExam } from "@/contexts/ExamContext";
import { useProgress } from "@/contexts/ProgressContext";
import { MODULE_IDS, MODULE_LABELS, type ModuleId, type SessionSummary } from "@/types/progress";

function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function calculateStreak(timestamps: number[]): { count: number; activeToday: boolean } {
  const days = [...new Set(timestamps.map(startOfLocalDay))].sort((a, b) => b - a);
  const today = startOfLocalDay(Date.now());
  if (days[0] !== today) return { count: 0, activeToday: false };

  let count = 0;
  let expected = today;
  for (const day of days) {
    if (day !== expected) break;
    count += 1;
    expected -= 24 * 60 * 60 * 1000;
  }
  return { count, activeToday: true };
}

function scoreText(summary?: SessionSummary): string | undefined {
  if (!summary?.score) return undefined;
  const { correct, total } = summary.score;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return `${correct}/${total} · ${pct}%`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[isDark ? "dark" : "light"];
  const { loadSessions } = useExam();
  const progress = useProgress();
  const [progressOpen, setProgressOpen] = useState(false);

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

  const handleProgress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProgressOpen(true);
  };

  const practiceWeak = (module: ModuleId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const paths: Record<ModuleId, string> = {
      exam: "/theme-select",
      listening: "/listening",
      reading: "/reading",
      writing: "/writing",
      image: "/image-practice",
    };
    router.push({ pathname: paths[module] as any, params: { practiceWeak: "1" } });
  };

  const generalWeak = progress.getWeakAreas("general").slice(0, 4);
  const practiceDates = [
    ...progress.sessionSummaries.map((s) => s.completedAt),
    ...progress.examSessions.map((s) => s.completedAt ?? 0),
  ].filter((ts) => ts > 0);
  const streak = calculateStreak(practiceDates);
  const latestOralByTheme = (themeId: string) =>
    progress.sessionSummaries.find((s) => s.module === "exam" && s.experienceId === themeId);
  const latestListening = progress.getLatestSummary("listening");
  const latestReading = progress.getLatestSummary("reading");
  const checklistItems = [
    ...THEMES.map((t) => ({
      key: `oral-${t.id}`,
      label: t.name,
      subLabel: "Oral practice",
      color: t.color,
      summary: latestOralByTheme(t.id),
    })),
    {
      key: "listening",
      label: "Listening",
      subLabel: "Comprensión auditiva",
      color: "#3498DB",
      summary: latestListening,
    },
    {
      key: "reading",
      label: "Reading",
      subLabel: "Comprensión lectora",
      color: "#27AE60",
      summary: latestReading,
    },
  ];

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
                <Text style={[styles.title, { color: theme.text }]}>Bienvenido</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={handleProgress}
                  style={({ pressed }) => [
                    styles.headerBtn,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="stats-chart-outline" size={22} color={theme.tint} />
                </Pressable>
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

            <View style={[styles.streakCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View
                style={[
                  styles.streakIcon,
                  { backgroundColor: streak.activeToday ? "#FF7A1A22" : theme.cardAlt },
                ]}
              >
                <Ionicons
                  name="flame"
                  size={26}
                  color={streak.activeToday ? "#FF7A1A" : theme.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.streakTitle, { color: theme.text }]}>
                  {streak.count} day streak
                </Text>
                <Text style={[styles.streakSub, { color: theme.textSecondary }]}>
                  {streak.activeToday
                    ? "Practice logged today"
                    : "Practice today to light your streak"}
                </Text>
              </View>
            </View>

            <View style={[styles.checklistCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.checklistHeader}>
                <Text style={[styles.checklistTitle, { color: theme.text }]}>Practice checklist</Text>
                <Text style={[styles.checklistCount, { color: theme.textSecondary }]}>
                  {checklistItems.filter((item) => item.summary).length}/{checklistItems.length}
                </Text>
              </View>
              {checklistItems.map((item) => {
                const done = !!item.summary;
                return (
                  <View key={item.key} style={styles.checklistRow}>
                    <View
                      style={[
                        styles.checkCircle,
                        {
                          borderColor: done ? item.color : theme.border,
                          backgroundColor: done ? item.color : "transparent",
                        },
                      ]}
                    >
                      {done ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
                    </View>
                    <View style={styles.checkTextWrap}>
                      <Text style={[styles.checkLabel, { color: theme.text }]}>{item.label}</Text>
                      <Text style={[styles.checkSub, { color: theme.textSecondary }]}>{item.subLabel}</Text>
                    </View>
                    <Text style={[styles.checkScore, { color: done ? item.color : theme.textSecondary }]}>
                      {scoreText(item.summary) ?? "—"}
                    </Text>
                  </View>
                );
              })}
            </View>

            {generalWeak.length > 0 ? (
              <View style={[styles.weakCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.weakTitle, { color: theme.text }]}>Practice your weak areas</Text>
                <Text style={[styles.weakSub, { color: theme.textSecondary }]}>
                  Select Quick Practice in Reading or Listening to practice question types you missed on your last full past paper.
                </Text>
                <View style={styles.weakRow}>
                  {MODULE_IDS.map((id) => {
                    const hasWeak = progress.getWeakAreas(id).length > 0;
                    if (!hasWeak) return null;
                    return (
                      <Pressable
                        key={id}
                        onPress={() => practiceWeak(id)}
                        style={[styles.weakChip, { borderColor: theme.tint, backgroundColor: theme.tint + "15" }]}
                      >
                        <Text style={[styles.weakChipText, { color: theme.tint }]}>{MODULE_LABELS[id]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

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

      <ProgressManager
        visible={progressOpen}
        onClose={() => setProgressOpen(false)}
        colors={{
          background: theme.background,
          card: theme.card,
          text: theme.text,
          textSecondary: theme.textSecondary,
          border: theme.border,
          tint: theme.tint,
        }}
      />
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
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  streakIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  streakTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  streakSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  checklistCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  checklistHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  checklistTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  checklistCount: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkTextWrap: {
    flex: 1,
  },
  checkLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  checkSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  checkScore: {
    minWidth: 70,
    textAlign: "right",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
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
  weakCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  weakTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  weakSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  weakRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  weakChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  weakChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
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
