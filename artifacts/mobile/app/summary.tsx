import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

type GrammarMistake = { error: string; correction: string; explanation: string };
type CriterionScore = { band: number; label: string; comments: string };
type ImprovedExample = { original: string; improved: string; note: string };

type SessionFeedback = {
  overallComment: string;
  languageAnalysis: {
    grammarMistakes: GrammarMistake[];
    tenseUsage: string;
    vocabularyRange: string;
  };
  improvementSuggestions: {
    betterStructures: string[];
    connectors: string[];
    vocabulary: string[];
  };
  ibCriteria: {
    criterionA: CriterionScore;
    criterionB: CriterionScore;
    criterionC: CriterionScore;
    criterionD: CriterionScore;
  };
  improvedExamples: ImprovedExample[];
};

function getApiUrl() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/`;
  return "http://localhost:5000/";
}

function BandBadge({ band }: { band: number }) {
  const color = band >= 6 ? "#52C97A" : band >= 4 ? "#C9A84C" : "#FF6B6B";
  return (
    <View style={[feedbackStyles.bandBadge, { backgroundColor: color + "20", borderColor: color + "50" }]}>
      <Text style={[feedbackStyles.bandText, { color }]}>Banda {band}</Text>
    </View>
  );
}

function CriterionCard({ label, band, comments, colors }: { label: string; band: number; comments: string; colors: any }) {
  const bandColor = band >= 6 ? "#52C97A" : band >= 4 ? "#C9A84C" : "#FF6B6B";
  return (
    <View style={[feedbackStyles.criterionCard, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
      <View style={feedbackStyles.criterionHeader}>
        <Text style={[feedbackStyles.criterionLabel, { color: colors.text }]}>{label}</Text>
        <BandBadge band={band} />
      </View>
      <View style={[feedbackStyles.criterionBar, { backgroundColor: colors.border }]}>
        <View style={[feedbackStyles.criterionFill, { backgroundColor: bandColor, width: `${(band / 7) * 100}%` as any }]} />
      </View>
      <Text style={[feedbackStyles.criterionComments, { color: colors.textSecondary }]}>{comments}</Text>
    </View>
  );
}

const feedbackStyles = StyleSheet.create({
  bandBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  bandText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  criterionCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  criterionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  criterionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  criterionBar: { height: 4, borderRadius: 2, marginBottom: 8, overflow: "hidden" },
  criterionFill: { height: "100%", borderRadius: 2 },
  criterionComments: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
});

export default function SummaryScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { sessions, loadSessions } = useExam();
  const { usedThemes, getNextSuggestedTheme } = useIBTheme();

  const [session, setSession] = useState<ExamSession | null>(null);
  const [feedback, setFeedback] = useState<SessionFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState(false);

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

  useEffect(() => {
    if (session && session.messages.length > 0 && !feedback && !feedbackLoading) {
      fetchFeedback(session);
    }
  }, [session]);

  const fetchFeedback = async (s: ExamSession) => {
    const userMsgs = s.messages.filter((m) => m.role === "user");
    if (userMsgs.length === 0) return;

    setFeedbackLoading(true);
    setFeedbackError(false);

    try {
      const response = await globalThis.fetch(`${getApiUrl()}api/exam/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: s.messages.map((m) => ({ role: m.role, content: m.content })),
          theme: s.themeId,
        }),
      });

      if (!response.ok) throw new Error("Feedback request failed");
      const { feedback: fb } = await response.json();
      setFeedback(fb);
    } catch {
      setFeedbackError(true);
    } finally {
      setFeedbackLoading(false);
    }
  };

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
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPad + 20, paddingBottom: botPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Trophy / completion header */}
        <View style={styles.celebrationHeader}>
          <LinearGradient colors={[themeData.color + "33", themeData.color + "11"]} style={styles.trophyCircle}>
            <Ionicons name="trophy-outline" size={44} color={themeData.color} />
          </LinearGradient>
          <Text style={[styles.celebrationTitle, { color: colors.text }]}>¡Sesión completada!</Text>
          <Text style={[styles.celebrationSub, { color: colors.textSecondary }]}>
            Has practicado el examen oral de IB español
          </Text>
        </View>

        {/* Theme card */}
        <View style={[styles.themeCard, { backgroundColor: themeData.color + "15", borderColor: themeData.color + "30" }]}>
          <View style={[styles.themeCardIcon, { backgroundColor: themeData.color + "22" }]}>
            <Ionicons name={themeData.iconName as any} size={24} color={themeData.color} />
          </View>
          <View style={styles.themeCardInfo}>
            <Text style={[styles.themeCardLabel, { color: themeData.color }]}>Tema practicado</Text>
            <Text style={[styles.themeCardName, { color: colors.text }]}>{themeData.name}</Text>
            {session.wasRepeated ? (
              <View style={styles.repeatedBadge}>
                <Ionicons name="refresh-outline" size={11} color="#E8884A" />
                <Text style={styles.repeatedText}>Tema repetido</Text>
              </View>
            ) : (
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
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tus respuestas</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{getDuration()}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Duración</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{messageCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Mensajes totales</Text>
          </View>
        </View>

        {/* AI Feedback Section */}
        <View style={[styles.feedbackSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.feedbackHeader}>
            <Ionicons name="analytics-outline" size={20} color={colors.tint} />
            <Text style={[styles.feedbackTitle, { color: colors.text }]}>Análisis del examinador</Text>
            {feedbackLoading && <ActivityIndicator size="small" color={colors.tint} />}
          </View>

          {feedbackLoading && (
            <View style={styles.feedbackLoading}>
              <Text style={[styles.feedbackLoadingText, { color: colors.textSecondary }]}>
                Analizando tu rendimiento...
              </Text>
            </View>
          )}

          {feedbackError && !feedbackLoading && (
            <View style={styles.feedbackError}>
              <Text style={[styles.feedbackErrorText, { color: colors.textSecondary }]}>
                No se pudo cargar el análisis.
              </Text>
              <Pressable
                onPress={() => fetchFeedback(session)}
                style={({ pressed }) => [styles.retryBtn, { borderColor: colors.tint, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.retryText, { color: colors.tint }]}>Intentar de nuevo</Text>
              </Pressable>
            </View>
          )}

          {feedback && !feedbackLoading && (
            <View>
              {/* Overall comment */}
              <View style={[styles.feedbackBlock, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                <Text style={[styles.feedbackBlockTitle, { color: colors.text }]}>Resumen general</Text>
                <Text style={[styles.feedbackBodyText, { color: colors.textSecondary }]}>{feedback.overallComment}</Text>
              </View>

              {/* IB Criteria */}
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Criterios IB (estimados)</Text>
              {Object.entries(feedback.ibCriteria).map(([key, criterion]) => (
                <CriterionCard
                  key={key}
                  label={`Criterio ${key.replace("criterion", "").toUpperCase()}: ${criterion.label}`}
                  band={criterion.band}
                  comments={criterion.comments}
                  colors={colors}
                />
              ))}

              {/* Grammar mistakes */}
              {feedback.languageAnalysis.grammarMistakes.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Errores gramaticales</Text>
                  {feedback.languageAnalysis.grammarMistakes.map((mistake, i) => (
                    <View key={i} style={[styles.mistakeCard, { backgroundColor: "#FF4444" + "08", borderColor: "#FF4444" + "30" }]}>
                      <View style={styles.mistakeRow}>
                        <View style={[styles.mistakeBadge, { backgroundColor: "#FF4444" + "20" }]}>
                          <Text style={styles.mistakeBadgeText}>Error</Text>
                        </View>
                        <Text style={[styles.mistakeError, { color: "#FF4444" }]}>{mistake.error}</Text>
                      </View>
                      <View style={styles.mistakeRow}>
                        <View style={[styles.mistakeBadge, { backgroundColor: "#52C97A" + "20" }]}>
                          <Text style={[styles.mistakeBadgeText, { color: "#52C97A" }]}>✓</Text>
                        </View>
                        <Text style={[styles.mistakeCorrection, { color: "#52C97A" }]}>{mistake.correction}</Text>
                      </View>
                      <Text style={[styles.mistakeExplanation, { color: colors.textSecondary }]}>{mistake.explanation}</Text>
                    </View>
                  ))}
                </>
              )}

              {/* Language analysis */}
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Análisis de lengua</Text>
              <View style={[styles.analysisCard, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                <Text style={[styles.analysisLabel, { color: colors.tint }]}>Uso de tiempos verbales</Text>
                <Text style={[styles.feedbackBodyText, { color: colors.textSecondary }]}>{feedback.languageAnalysis.tenseUsage}</Text>
              </View>
              <View style={[styles.analysisCard, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                <Text style={[styles.analysisLabel, { color: colors.tint }]}>Rango de vocabulario</Text>
                <Text style={[styles.feedbackBodyText, { color: colors.textSecondary }]}>{feedback.languageAnalysis.vocabularyRange}</Text>
              </View>

              {/* Improvement suggestions */}
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Sugerencias de mejora</Text>
              {feedback.improvementSuggestions.betterStructures.length > 0 && (
                <View style={[styles.suggestionBlock, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                  <Text style={[styles.suggestionBlockTitle, { color: colors.text }]}>Mejores estructuras</Text>
                  {feedback.improvementSuggestions.betterStructures.map((s, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <Text style={[styles.bullet, { color: colors.tint }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{s}</Text>
                    </View>
                  ))}
                </View>
              )}
              {feedback.improvementSuggestions.vocabulary.length > 0 && (
                <View style={[styles.suggestionBlock, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                  <Text style={[styles.suggestionBlockTitle, { color: colors.text }]}>Vocabulario avanzado</Text>
                  <View style={styles.vocabRow}>
                    {feedback.improvementSuggestions.vocabulary.map((v, i) => (
                      <View key={i} style={[styles.vocabChip, { backgroundColor: colors.tint + "18", borderColor: colors.tint + "40" }]}>
                        <Text style={[styles.vocabChipText, { color: colors.tint }]}>{v}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Improved examples */}
              {feedback.improvedExamples.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Frases mejoradas</Text>
                  {feedback.improvedExamples.map((ex, i) => (
                    <View key={i} style={[styles.exampleCard, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                      <Text style={[styles.exampleLabel, { color: "#FF4444" }]}>Original:</Text>
                      <Text style={[styles.exampleText, { color: colors.textSecondary, fontStyle: "italic" }]}>
                        "{ex.original}"
                      </Text>
                      <Text style={[styles.exampleLabel, { color: "#52C97A", marginTop: 8 }]}>Mejorado:</Text>
                      <Text style={[styles.exampleText, { color: colors.text }]}>"{ex.improved}"</Text>
                      <Text style={[styles.exampleNote, { color: colors.textSecondary }]}>{ex.note}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </View>

        {/* Theme progress */}
        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.progressTitle, { color: colors.text }]}>Progreso de temas</Text>
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
              style={[styles.progressFill, { backgroundColor: themeData.color, width: `${(completedThemes / totalThemes) * 100}%` as any }]}
            />
          </View>
          <View style={styles.themeDotsRow}>
            {THEMES.map((t) => (
              <View key={t.id} style={styles.themeDotItem}>
                <View style={[styles.themeDot, {
                  backgroundColor: usedThemes.includes(t.id) ? t.color : colors.cardAlt,
                  borderColor: usedThemes.includes(t.id) ? t.color : colors.border,
                }]}>
                  {usedThemes.includes(t.id) && <Ionicons name="checkmark" size={10} color="#fff" />}
                </View>
                <Text style={[styles.themeDotLabel, { color: usedThemes.includes(t.id) ? t.color : colors.textSecondary }]} numberOfLines={2}>
                  {t.nameShort}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Next theme suggestion */}
        <View style={[styles.suggestionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="bulb-outline" size={20} color={colors.tint} />
          <View style={styles.suggestionInfo}>
            <Text style={[styles.suggestionTitle, { color: colors.text }]}>Próximo tema sugerido</Text>
            <Text style={[styles.suggestionName, { color: colors.tint }]}>{nextTheme.name}</Text>
            <Text style={[styles.suggestionDesc, { color: colors.textSecondary }]}>{nextTheme.description}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleNewExam}
            style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <LinearGradient colors={[colors.tint, colors.tintDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtnGradient}>
              <Ionicons name="mic-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Nuevo examen</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            onPress={handleHome}
            style={({ pressed }) => [styles.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="home-outline" size={20} color={colors.text} />
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Inicio</Text>
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
  trophyCircle: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  celebrationTitle: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 6, textAlign: "center" },
  celebrationSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  themeCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  themeCardIcon: { width: 50, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  themeCardInfo: { flex: 1 },
  themeCardLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  themeCardName: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 6 },
  repeatedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  repeatedText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#E8884A" },
  newBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  newText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#52C97A" },
  statsGrid: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: "center" },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 3 },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  feedbackSection: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  feedbackHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  feedbackTitle: { fontSize: 17, fontFamily: "Inter_700Bold", flex: 1 },
  feedbackLoading: { paddingVertical: 20, alignItems: "center" },
  feedbackLoadingText: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 8 },
  feedbackError: { paddingVertical: 12, alignItems: "center" },
  feedbackErrorText: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 10 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  retryText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  feedbackBlock: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 14 },
  feedbackBlockTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  feedbackBodyText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 4, marginBottom: 10 },
  mistakeCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10 },
  mistakeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 5 },
  mistakeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 1 },
  mistakeBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#FF4444" },
  mistakeError: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, textDecorationLine: "line-through" },
  mistakeCorrection: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  mistakeExplanation: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 4 },
  analysisCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  analysisLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 },
  suggestionBlock: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  suggestionBlockTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  bulletRow: { flexDirection: "row", gap: 8, marginBottom: 5 },
  bullet: { fontSize: 14, fontFamily: "Inter_700Bold" },
  bulletText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  vocabRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  vocabChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  vocabChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  exampleCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  exampleLabel: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  exampleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  exampleNote: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 6, fontStyle: "italic" },
  progressCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 16 },
  progressTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  progressFraction: { fontSize: 13, fontFamily: "Inter_400Regular" },
  allDoneBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  allDoneText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#52C97A" },
  progressBar: { height: 6, borderRadius: 3, marginBottom: 16, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  themeDotsRow: { flexDirection: "row", justifyContent: "space-around" },
  themeDotItem: { alignItems: "center", gap: 6, flex: 1 },
  themeDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  themeDotLabel: { fontSize: 9, fontFamily: "Inter_500Medium", textAlign: "center" },
  suggestionCard: { flexDirection: "row", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 24, alignItems: "flex-start" },
  suggestionInfo: { flex: 1 },
  suggestionTitle: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.6 },
  suggestionName: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  suggestionDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  actions: { gap: 12 },
  primaryBtn: { borderRadius: 14, overflow: "hidden" },
  primaryBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, borderWidth: 1, paddingVertical: 14 },
  secondaryBtnText: { fontSize: 16, fontFamily: "Inter_500Medium" },
});
