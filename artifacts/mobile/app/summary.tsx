import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
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
import { THEMES, getThemeById } from "@/constants/themes";
import { useIBTheme } from "@/contexts/ThemeContext";
import { useExam, type ExamSession } from "@/contexts/ExamContext";

export default function SummaryScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { sessions, loadSessions } = useExam();
  const { usedThemes, getNextSuggestedTheme } = useIBTheme();

  const [session, setSession] = useState<ExamSession | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (sessions.length > 0 && sessionId) {
      const found = sessions.find((s) => s.id === sessionId);
      if (found) setSession(found);
    } else if (sessions.length > 0) {
      setSession(sessions[0]);
    }
  }, [sessions, sessionId]);

  const themeData = session ? getThemeById(session.themeId) : null;
  const nextTheme = getNextSuggestedTheme();
  const completedThemes = usedThemes.length;
  const totalThemes = THEMES.length;
  const allCompleted = completedThemes >= totalThemes;

  const messageCount = session?.messages.length ?? 0;
  const userMessages = session?.messages.filter((m) => m.role === "user").length ?? 0;

  const getDuration = (): string => {
    if (!session?.startedAt || !session?.completedAt) return "—";
    const ms = session.completedAt - session.startedAt;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const handleNewExam = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace("/theme-select");
  };

  const handleHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/");
  };

  if (!session || !themeData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando resumen...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ["#1A1030", "#0F1117"] : ["#F0EDFF", "#F5F6FA"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topPad + 20, paddingBottom: botPad + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Trophy / completion header */}
        <View style={styles.celebrationHeader}>
          <LinearGradient
            colors={[themeData.color + "33", themeData.color + "11"]}
            style={styles.trophyCircle}
          >
            <Ionicons name="trophy-outline" size={44} color={themeData.color} />
          </LinearGradient>
          <Text style={[styles.celebrationTitle, { color: colors.text }]}>
            ¡Sesión completada!
          </Text>
          <Text style={[styles.celebrationSub, { color: colors.textSecondary }]}>
            Has practicado el examen oral de IB español
          </Text>
        </View>

        {/* Theme card */}
        <View
          style={[
            styles.themeCard,
            {
              backgroundColor: themeData.color + "15",
              borderColor: themeData.color + "30",
            },
          ]}
        >
          <View style={[styles.themeCardIcon, { backgroundColor: themeData.color + "22" }]}>
            <Ionicons name={themeData.iconName as any} size={24} color={themeData.color} />
          </View>
          <View style={styles.themeCardInfo}>
            <Text style={[styles.themeCardLabel, { color: themeData.color }]}>
              Tema practicado
            </Text>
            <Text style={[styles.themeCardName, { color: colors.text }]}>
              {themeData.name}
            </Text>
            {session.wasRepeated && (
              <View style={styles.repeatedBadge}>
                <Ionicons name="refresh-outline" size={11} color="#E8884A" />
                <Text style={styles.repeatedText}>Tema repetido</Text>
              </View>
            )}
            {!session.wasRepeated && (
              <View style={styles.newBadge}>
                <Ionicons name="star-outline" size={11} color="#52C97A" />
                <Text style={styles.newText}>Tema nuevo</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{userMessages}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Tus respuestas
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{getDuration()}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Duración
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{messageCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Mensajes totales
            </Text>
          </View>
        </View>

        {/* Theme progress */}
        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.progressTitle, { color: colors.text }]}>
            Progreso de temas
          </Text>
          <View style={styles.progressRow}>
            <Text style={[styles.progressFraction, { color: colors.textSecondary }]}>
              {completedThemes} de {totalThemes} temas practicados
            </Text>
            {allCompleted && (
              <View style={styles.allDoneBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#52C97A" />
                <Text style={styles.allDoneText}>Todos completados</Text>
              </View>
            )}
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.cardAlt }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: themeData.color,
                  width: `${(completedThemes / totalThemes) * 100}%`,
                },
              ]}
            />
          </View>

          {/* Mini theme dots */}
          <View style={styles.themeDotsRow}>
            {THEMES.map((t) => (
              <View key={t.id} style={styles.themeDotItem}>
                <View
                  style={[
                    styles.themeDot,
                    {
                      backgroundColor: usedThemes.includes(t.id) ? t.color : colors.cardAlt,
                      borderColor: usedThemes.includes(t.id) ? t.color : colors.border,
                    },
                  ]}
                >
                  {usedThemes.includes(t.id) && (
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  )}
                </View>
                <Text
                  style={[
                    styles.themeDotLabel,
                    { color: usedThemes.includes(t.id) ? t.color : colors.textSecondary },
                  ]}
                  numberOfLines={2}
                >
                  {t.nameShort}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Suggestion card */}
        <View style={[styles.suggestionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="bulb-outline" size={20} color={colors.tint} />
          <View style={styles.suggestionInfo}>
            <Text style={[styles.suggestionTitle, { color: colors.text }]}>
              Próximo tema sugerido
            </Text>
            <Text style={[styles.suggestionName, { color: colors.tint }]}>
              {nextTheme.name}
            </Text>
            <Text style={[styles.suggestionDesc, { color: colors.textSecondary }]}>
              {nextTheme.description}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleNewExam}
            style={({ pressed }) => [
              styles.primaryBtn,
              { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <LinearGradient
              colors={[colors.tint, colors.tintDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtnGradient}
            >
              <Ionicons name="mic-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Nuevo examen</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            onPress={handleHome}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="home-outline" size={20} color={colors.text} />
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
              Inicio
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  scrollContent: { paddingHorizontal: 20 },
  celebrationHeader: { alignItems: "center", marginBottom: 28 },
  trophyCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  celebrationTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
    textAlign: "center",
  },
  celebrationSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  themeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  themeCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  themeCardInfo: { flex: 1 },
  themeCardLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  themeCardName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  repeatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  repeatedText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#E8884A",
  },
  newBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  newText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#52C97A",
  },
  statsGrid: {
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
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  progressCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progressFraction: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  allDoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  allDoneText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#52C97A",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 16,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  themeDotsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  themeDotItem: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  themeDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  themeDotLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  suggestionCard: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    alignItems: "flex-start",
  },
  suggestionInfo: { flex: 1 },
  suggestionTitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  suggestionName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 3,
  },
  suggestionDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  actions: { gap: 12 },
  primaryBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  primaryBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
});
