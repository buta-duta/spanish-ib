import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { WordModal, TappableText } from "@/components/WordModal";

const ACCENT = "#E67E22";
const ACCENT_DARK = "#CA6F1E";

function getApiUrl() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/`;
  if (Platform.OS === "web") return "/";
  return "http://localhost:5000/";
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = "setup" | "writing" | "feedback" | "rewrite";
type PromptMode = "generate" | "custom";

type Correction = { original: string; corrected: string; explanation: string };
type VocabSuggestion = { original: string; advanced: string; reason: string };
type ModelRewrite = { original: string; improved: string; explanation: string };

type CriterionResult = {
  mark: number;
  feedback: string;
  corrections?: Correction[];
};

type FeedbackData = {
  criterionA: CriterionResult;
  criterionB: CriterionResult;
  criterionC: CriterionResult;
  totalMark: number;
  ibBand: number;
  strengths: string[];
  areasToImprove: string[];
  vocabularySuggestions: VocabSuggestion[];
  connectorSuggestions: string[];
  modelRewrites: ModelRewrite[];
};

const THEMES = [
  { id: "identidades", name: "Identidades", color: "#9B59B6" },
  { id: "experiencias", name: "Experiencias", color: "#E67E22" },
  { id: "ingenio-humano", name: "Ingenio humano", color: "#2980B9" },
  { id: "organizacion-social", name: "Organización social", color: "#27AE60" },
  { id: "compartir-el-planeta", name: "Compartir el planeta", color: "#C9A84C" },
];

const TEXT_TYPES = [
  { id: "article", name: "Artículo" },
  { id: "blog", name: "Blog" },
  { id: "email_formal", name: "Correo formal" },
  { id: "email_informal", name: "Correo informal" },
  { id: "report", name: "Informe" },
  { id: "review", name: "Reseña" },
  { id: "speech", name: "Discurso" },
];

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function bandColor(band: number) {
  if (band >= 6) return "#27AE60";
  if (band >= 4) return "#E67E22";
  return "#E74C3C";
}

// ── Criterion card ─────────────────────────────────────────────────────────────
function CriterionCard({
  label,
  letter,
  mark,
  maxMark,
  feedback,
  corrections,
  colors,
}: {
  label: string;
  letter: string;
  mark: number;
  maxMark: number;
  feedback: string;
  corrections?: Correction[];
  colors: typeof Colors.dark;
}) {
  const [open, setOpen] = useState(true);
  const pct = mark / maxMark;
  const color = pct >= 0.75 ? "#27AE60" : pct >= 0.5 ? ACCENT : "#E74C3C";

  return (
    <View style={[cc.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: color }]}>
      <Pressable onPress={() => setOpen((o) => !o)} style={cc.header}>
        <View style={[cc.letterBadge, { backgroundColor: color + "20" }]}>
          <Text style={[cc.letter, { color }]}>{letter}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[cc.label, { color: colors.text }]}>{label}</Text>
          <View style={[cc.markBar, { backgroundColor: colors.cardAlt }]}>
            <View style={[cc.markFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
          </View>
        </View>
        <Text style={[cc.mark, { color }]}>{mark}/{maxMark}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
      </Pressable>

      {open && (
        <View style={cc.body}>
          <Text style={[cc.feedback, { color: colors.text }]}>{feedback}</Text>
          {corrections && corrections.length > 0 && (
            <View style={{ gap: 8, marginTop: 10 }}>
              <Text style={[cc.subsectionLabel, { color: colors.textSecondary }]}>Corrections</Text>
              {corrections.map((c, i) => (
                <View key={i} style={[cc.correctionBox, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                  <Text style={[cc.correctionOriginal, { color: "#E74C3C" }]}>✗ {c.original}</Text>
                  <Text style={[cc.correctionFixed, { color: "#27AE60" }]}>✓ {c.corrected}</Text>
                  <Text style={[cc.correctionExplanation, { color: colors.textSecondary }]}>{c.explanation}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
const cc = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, borderLeftWidth: 4, overflow: "hidden", marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  letterBadge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  letter: { fontSize: 16, fontFamily: "Inter_700Bold" },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  markBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  markFill: { height: "100%", borderRadius: 2 },
  mark: { fontSize: 18, fontFamily: "Inter_700Bold", minWidth: 36, textAlign: "right" },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 0 },
  feedback: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  subsectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 4 },
  correctionBox: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 4 },
  correctionOriginal: { fontSize: 13, fontFamily: "Inter_500Medium" },
  correctionFixed: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  correctionExplanation: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function WritingScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Setup
  const [level, setLevel] = useState<"b" | "ab_initio">("b");
  const [selectedTheme, setSelectedTheme] = useState("experiencias");
  const [selectedType, setSelectedType] = useState("article");
  const [promptMode, setPromptMode] = useState<PromptMode>("generate");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [previousPrompts, setPreviousPrompts] = useState<string[]>([]);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  // Writing
  const [essay, setEssay] = useState("");
  const [promptCollapsed, setPromptCollapsed] = useState(false);

  // Feedback
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [generatingFeedback, setGeneratingFeedback] = useState(false);

  // Rewrite
  const [rewritten, setRewritten] = useState("");
  const [generatingRewrite, setGeneratingRewrite] = useState(false);

  // Phase
  const [phase, setPhase] = useState<Phase>("setup");

  // Word glossary popup
  const [wordPopup, setWordPopup] = useState<{ word: string; context: string } | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const activePrompt = promptMode === "generate" ? generatedPrompt : customPrompt;
  const wc = wordCount(essay);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const generatePrompt = async () => {
    setGeneratingPrompt(true);
    try {
      const res = await fetch(`${getApiUrl()}api/writing/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: selectedTheme,
          textType: selectedType,
          previousPrompts,
          level,
        }),
      });
      const data = await res.json();
      const p = data.prompt ?? "";
      setGeneratedPrompt(p);
      if (p) setPreviousPrompts((prev) => [...prev, p]);
    } catch {
      // silent
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const startWriting = () => {
    if (!activePrompt.trim()) return;
    setEssay("");
    setFeedback(null);
    setRewritten("");
    setPhase("writing");
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
  };

  const getFeedback = async () => {
    if (!essay.trim() || generatingFeedback) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGeneratingFeedback(true);
    try {
      const res = await fetch(`${getApiUrl()}api/writing/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: activePrompt,
          essay,
          theme: selectedTheme,
          textType: selectedType,
          level,
        }),
      });
      const data = await res.json();
      setFeedback(data);
      setPhase("feedback");
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
    } catch {
      // silent
    } finally {
      setGeneratingFeedback(false);
    }
  };

  const getRewrite = async () => {
    if (generatingRewrite) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGeneratingRewrite(true);
    try {
      const res = await fetch(`${getApiUrl()}api/writing/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: activePrompt,
          essay,
          textType: selectedType,
          level,
        }),
      });
      const data = await res.json();
      setRewritten(data.rewritten ?? "");
      setPhase("rewrite");
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
    } catch {
      // silent
    } finally {
      setGeneratingRewrite(false);
    }
  };

  const resetAll = () => {
    setPhase("setup");
    setEssay("");
    setFeedback(null);
    setRewritten("");
    setGeneratedPrompt("");
    setCustomPrompt("");
    setPreviousPrompts([]);
    setPromptMode("generate");
  };

  // ── Header ─────────────────────────────────────────────────────────────────
  const Header = ({
    title,
    onBack,
    rightElement,
  }: {
    title: string;
    onBack?: () => void;
    rightElement?: React.ReactNode;
  }) => (
    <View style={[h.row, { paddingTop: topPad + 12 }]}>
      <Pressable onPress={onBack ?? (() => router.back())} style={h.back}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <Text style={[h.title, { color: colors.text, flex: 1 }]} numberOfLines={1}>
        {title}
      </Text>
      {rightElement}
    </View>
  );
  const h = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
    back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    title: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  });

  const bgColors: [string, string] = isDark ? ["#1A0D00", "#0F1117"] : ["#FDF0E6", "#F5F6FA"];

  // ── Phase: Setup ────────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />
        <Header
          title="Escritura"
          rightElement={
            <View style={[s.pill, { backgroundColor: ACCENT + "20", borderColor: ACCENT + "50" }]}>
              <Text style={[s.pillText, { color: ACCENT }]}>Writing</Text>
            </View>
          }
        />

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: botPad + 24, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Theme */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Tema IB</Text>
            <View style={{ gap: 8, marginTop: 10 }}>
              {THEMES.map((t) => {
                const active = selectedTheme === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setSelectedTheme(t.id)}
                    style={[s.optionRow, {
                      backgroundColor: active ? t.color + "18" : colors.cardAlt,
                      borderColor: active ? t.color : colors.border,
                    }]}
                  >
                    <View style={[s.optionDot, { backgroundColor: active ? t.color : colors.border }]} />
                    <Text style={[s.optionText, { color: active ? t.color : colors.text }]}>{t.name}</Text>
                    {active && <Ionicons name="checkmark-circle" size={18} color={t.color} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Text type */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Tipo de texto</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {TEXT_TYPES.map((t) => {
                const active = selectedType === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setSelectedType(t.id)}
                    style={[s.chip, {
                      backgroundColor: active ? ACCENT : colors.cardAlt,
                      borderColor: active ? ACCENT : colors.border,
                    }]}
                  >
                    <Text style={[s.chipText, { color: active ? "#fff" : colors.text }]}>{t.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Level */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Nivel</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              {(["b", "ab_initio"] as const).map((l) => {
                const active = level === l;
                return (
                  <Pressable
                    key={l}
                    onPress={() => setLevel(l)}
                    style={[s.chip, {
                      backgroundColor: active ? ACCENT : colors.cardAlt,
                      borderColor: active ? ACCENT : colors.border,
                      flex: 1, alignItems: "center"
                    }]}
                  >
                    <Text style={[s.chipText, { color: active ? "#fff" : colors.text }]}>{l === "b" ? "Spanish B" : "Ab Initio"}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Prompt section */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Pregunta de escritura</Text>

            {/* Mode toggle */}
            <View style={[s.modeToggle, { backgroundColor: colors.cardAlt, borderColor: colors.border, marginTop: 12 }]}>
              <Pressable
                onPress={() => setPromptMode("generate")}
                style={[s.modeBtn, promptMode === "generate" && { backgroundColor: ACCENT }]}
              >
                <Ionicons name="sparkles-outline" size={15} color={promptMode === "generate" ? "#fff" : colors.textSecondary} />
                <Text style={[s.modeBtnText, { color: promptMode === "generate" ? "#fff" : colors.textSecondary }]}>
                  Generar
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPromptMode("custom")}
                style={[s.modeBtn, promptMode === "custom" && { backgroundColor: ACCENT }]}
              >
                <Ionicons name="create-outline" size={15} color={promptMode === "custom" ? "#fff" : colors.textSecondary} />
                <Text style={[s.modeBtnText, { color: promptMode === "custom" ? "#fff" : colors.textSecondary }]}>
                  Mi pregunta
                </Text>
              </Pressable>
            </View>

            {promptMode === "generate" ? (
              <View style={{ gap: 10, marginTop: 12 }}>
                <Pressable
                  onPress={generatePrompt}
                  disabled={generatingPrompt}
                  style={({ pressed }) => [
                    s.outlineBtn,
                    { borderColor: ACCENT, opacity: pressed || generatingPrompt ? 0.7 : 1 },
                  ]}
                >
                  {generatingPrompt ? (
                    <ActivityIndicator color={ACCENT} size="small" />
                  ) : (
                    <Ionicons name="sparkles-outline" size={16} color={ACCENT} />
                  )}
                  <Text style={[s.outlineBtnText, { color: ACCENT }]}>
                    {generatedPrompt ? "Regenerar pregunta" : "Generar pregunta"}
                  </Text>
                </Pressable>

                {generatedPrompt ? (
                  <View style={[s.promptBox, { backgroundColor: colors.cardAlt, borderColor: ACCENT + "50" }]}>
                    <View style={[s.glossaryHint, { backgroundColor: ACCENT + "15", borderColor: ACCENT + "30" }]}>
                      <Ionicons name="finger-print-outline" size={13} color={ACCENT} />
                      <Text style={[s.glossaryHintText, { color: ACCENT }]}>Toca cualquier palabra para ver su definición</Text>
                    </View>
                    <TappableText
                      text={generatedPrompt}
                      textStyle={[s.promptText, { color: colors.text }]}
                      onWordPress={(word, ctx) => setWordPopup({ word, context: ctx })}
                    />
                  </View>
                ) : (
                  <View style={[s.promptPlaceholder, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                    <Ionicons name="document-text-outline" size={28} color={colors.textSecondary} />
                    <Text style={[s.promptPlaceholderText, { color: colors.textSecondary }]}>
                      Toca "Generar pregunta" para crear un prompt IB
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                <TextInput
                  value={customPrompt}
                  onChangeText={setCustomPrompt}
                  multiline
                  placeholder="Escribe tu propia pregunta de escritura..."
                  placeholderTextColor={colors.textSecondary}
                  style={[s.customPromptInput, {
                    color: colors.text,
                    borderColor: customPrompt ? ACCENT + "80" : colors.border,
                    backgroundColor: colors.cardAlt,
                  }]}
                  textAlignVertical="top"
                />
              </View>
            )}
          </View>

          {/* Start button */}
          <Pressable
            onPress={startWriting}
            disabled={!activePrompt.trim()}
            style={({ pressed }) => [
              s.primaryBtn,
              { opacity: !activePrompt.trim() ? 0.4 : pressed ? 0.85 : 1 },
            ]}
          >
            <LinearGradient
              colors={[ACCENT, ACCENT_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.primaryBtnGrad}
            >
              <Ionicons name="pencil-outline" size={20} color="#fff" />
              <Text style={s.primaryBtnText}>Comenzar a escribir</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>

        {wordPopup && (
          <WordModal
            word={wordPopup.word}
            context={wordPopup.context}
            onClose={() => setWordPopup(null)}
            themeColor={ACCENT}
          />
        )}
      </View>
    );
  }

  // ── Phase: Writing ──────────────────────────────────────────────────────────
  if (phase === "writing") {
    const wcColor = wc < 200 ? "#E74C3C" : wc >= 250 && wc <= 400 ? "#27AE60" : ACCENT;

    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />
        <Header
          title="Escribir"
          onBack={() => setPhase("setup")}
          rightElement={
            <Pressable
              onPress={resetAll}
              style={[s.resetBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
            >
              <Ionicons name="refresh-outline" size={15} color={colors.textSecondary} />
              <Text style={[s.resetBtnText, { color: colors.textSecondary }]}>Reiniciar</Text>
            </Pressable>
          }
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: botPad + 120 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Prompt card */}
            <Pressable
              onPress={() => setPromptCollapsed((c) => !c)}
              style={[s.promptCard, { backgroundColor: ACCENT + "15", borderColor: ACCENT + "40" }]}
            >
              <View style={s.promptCardHeader}>
                <Ionicons name="document-text-outline" size={16} color={ACCENT} />
                <Text style={[s.promptCardLabel, { color: ACCENT }]}>Pregunta</Text>
                <Ionicons
                  name={promptCollapsed ? "chevron-down" : "chevron-up"}
                  size={16}
                  color={ACCENT}
                />
              </View>
              {!promptCollapsed && (
                <>
                  <TappableText
                    text={activePrompt}
                    textStyle={[s.promptCardText, { color: colors.text }]}
                    onWordPress={(word, ctx) => setWordPopup({ word, context: ctx })}
                  />
                  <View style={[s.glossaryHint, { backgroundColor: ACCENT + "15", borderColor: ACCENT + "30", marginTop: 8 }]}>
                    <Ionicons name="finger-print-outline" size={12} color={ACCENT} />
                    <Text style={[s.glossaryHintText, { color: ACCENT }]}>Toca una palabra para ver su definición</Text>
                  </View>
                </>
              )}
            </Pressable>

            {/* IB info */}
            <View style={[s.infoRow, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
              <Text style={[s.infoText, { color: colors.textSecondary }]}>
                Rango recomendado: {level === "ab_initio" ? "70–150" : "250–400"} palabras (IB Spanish {level === "ab_initio" ? "Ab Initio" : "B"})
              </Text>
            </View>

            {/* Writing area */}
            <View style={[s.editorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                value={essay}
                onChangeText={setEssay}
                multiline
                placeholder="Escribe tu respuesta en español aquí..."
                placeholderTextColor={colors.textSecondary}
                style={[s.editor, { color: colors.text }]}
                textAlignVertical="top"
                autoFocus
              />
            </View>

            {/* Word count */}
            <View style={s.wcRow}>
              <Text style={[s.wcLabel, { color: colors.textSecondary }]}>Palabras:</Text>
              <Text style={[s.wcValue, { color: wcColor }]}>{wc}</Text>
              <Text style={[s.wcTarget, { color: colors.textSecondary }]}>/ {level === "ab_initio" ? "70–150" : "250–400"}</Text>
            </View>
          </ScrollView>

          {/* Submit footer */}
          <View style={[s.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: botPad + 12 }]}>
            <Pressable
              onPress={getFeedback}
              disabled={wc < 30 || generatingFeedback}
              style={({ pressed }) => [
                s.primaryBtn,
                { flex: 1, opacity: wc < 30 || generatingFeedback ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              <LinearGradient
                colors={[ACCENT, ACCENT_DARK]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.primaryBtnGrad}
              >
                {generatingFeedback ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={s.primaryBtnText}>Evaluando...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
                    <Text style={s.primaryBtnText}>Obtener retroalimentación</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        {wordPopup && (
          <WordModal
            word={wordPopup.word}
            context={wordPopup.context}
            onClose={() => setWordPopup(null)}
            themeColor={ACCENT}
          />
        )}
      </View>
    );
  }

  // ── Phase: Feedback ─────────────────────────────────────────────────────────
  if (phase === "feedback" && feedback) {
    const bc = bandColor(feedback.ibBand);

    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />
        <Header
          title="Retroalimentación"
          onBack={() => setPhase("writing")}
          rightElement={
            <Pressable
              onPress={resetAll}
              style={[s.resetBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
            >
              <Ionicons name="refresh-outline" size={15} color={colors.textSecondary} />
              <Text style={[s.resetBtnText, { color: colors.textSecondary }]}>Nuevo</Text>
            </Pressable>
          }
        />

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: botPad + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Score summary */}
          <View style={[s.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.scoreRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.scoreLabel, { color: colors.textSecondary }]}>Puntuación total</Text>
                <Text style={[s.scoreBig, { color: bc }]}>
                  {feedback.totalMark}<Text style={s.scoreMax}>/{level === "ab_initio" ? "30" : "18"}</Text>
                </Text>
              </View>
              <View style={[s.bandBox, { backgroundColor: bc + "20", borderColor: bc + "50" }]}>
                <Text style={[s.bandLabel, { color: bc }]}>Banda</Text>
                <Text style={[s.bandNum, { color: bc }]}>{feedback.ibBand}</Text>
              </View>
            </View>

            {/* Mini criterion summary */}
            <View style={s.criteriaRow}>
              {[
                { letter: "A", mark: feedback.criterionA.mark },
                { letter: "B", mark: feedback.criterionB.mark },
                { letter: "C", mark: feedback.criterionC.mark },
              ].map(({ letter, mark }) => {
                const max = (level === "ab_initio" && (letter === "A" || letter === "B")) ? 12 : 6;
                const p = mark / max;
                const c = p >= 0.75 ? "#27AE60" : p >= 0.5 ? ACCENT : "#E74C3C";
                return (
                  <View key={letter} style={[s.miniCriterion, { backgroundColor: c + "15" }]}>
                    <Text style={[s.miniLetter, { color: c }]}>{letter}</Text>
                    <Text style={[s.miniMark, { color: c }]}>{mark}/{max}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Criterion A */}
          <CriterionCard
            label="Criterion A: Language"
            letter="A"
            mark={feedback.criterionA.mark}
            maxMark={level === "ab_initio" ? 12 : 6}
            feedback={feedback.criterionA.feedback}
            corrections={feedback.criterionA.corrections}
            colors={colors}
          />

          {/* Criterion B */}
          <CriterionCard
            label="Criterion B: Message"
            letter="B"
            mark={feedback.criterionB.mark}
            maxMark={level === "ab_initio" ? 12 : 6}
            feedback={feedback.criterionB.feedback}
            colors={colors}
          />

          {/* Criterion C */}
          <CriterionCard
            label="Criterion C: Conceptual Understanding"
            letter="C"
            mark={feedback.criterionC.mark}
            maxMark={6}
            feedback={feedback.criterionC.feedback}
            colors={colors}
          />

          {/* Strengths */}
          {feedback.strengths?.length > 0 && (
            <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.sectionHeaderRow}>
                <Ionicons name="thumbs-up-outline" size={16} color="#27AE60" />
                <Text style={[s.sectionTitle, { color: colors.text }]}>Strengths</Text>
              </View>
              {feedback.strengths.map((str, i) => (
                <View key={i} style={s.bulletRow}>
                  <View style={[s.bulletDot, { backgroundColor: "#27AE60" }]} />
                  <Text style={[s.bulletText, { color: colors.text }]}>{str}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Areas to improve */}
          {feedback.areasToImprove?.length > 0 && (
            <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.sectionHeaderRow}>
                <Ionicons name="trending-up-outline" size={16} color={ACCENT} />
                <Text style={[s.sectionTitle, { color: colors.text }]}>Areas to Improve</Text>
              </View>
              {feedback.areasToImprove.map((area, i) => (
                <View key={i} style={s.bulletRow}>
                  <View style={[s.bulletDot, { backgroundColor: ACCENT }]} />
                  <Text style={[s.bulletText, { color: colors.text }]}>{area}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Vocabulary suggestions */}
          {feedback.vocabularySuggestions?.length > 0 && (
            <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.sectionHeaderRow}>
                <Ionicons name="book-outline" size={16} color="#2980B9" />
                <Text style={[s.sectionTitle, { color: colors.text }]}>Vocabulary Upgrades</Text>
              </View>
              {feedback.vocabularySuggestions.map((v, i) => (
                <View key={i} style={[s.vocabRow, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                  <View style={s.vocabWords}>
                    <Text style={[s.vocabOriginal, { color: "#E74C3C" }]}>{v.original}</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
                    <Text style={[s.vocabAdvanced, { color: "#27AE60" }]}>{v.advanced}</Text>
                  </View>
                  <Text style={[s.vocabReason, { color: colors.textSecondary }]}>{v.reason}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Connectors */}
          {feedback.connectorSuggestions?.length > 0 && (
            <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.sectionHeaderRow}>
                <Ionicons name="link-outline" size={16} color="#8E44AD" />
                <Text style={[s.sectionTitle, { color: colors.text }]}>Suggested Connectors</Text>
              </View>
              <View style={s.connectorWrap}>
                {feedback.connectorSuggestions.map((c, i) => (
                  <View key={i} style={[s.connectorChip, { backgroundColor: "#8E44AD20", borderColor: "#8E44AD40" }]}>
                    <Text style={[s.connectorText, { color: "#8E44AD" }]}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Model rewrites */}
          {feedback.modelRewrites?.length > 0 && (
            <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.sectionHeaderRow}>
                <Ionicons name="sparkles-outline" size={16} color={ACCENT} />
                <Text style={[s.sectionTitle, { color: colors.text }]}>Band 6–7 Rewrites</Text>
              </View>
              {feedback.modelRewrites.map((r, i) => (
                <View key={i} style={[s.rewriteBox, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                  <Text style={[s.rewriteLabel, { color: "#E74C3C" }]}>Original</Text>
                  <Text style={[s.rewriteOriginal, { color: colors.text }]}>{r.original}</Text>
                  <View style={[s.rewriteDivider, { backgroundColor: colors.border }]} />
                  <Text style={[s.rewriteLabel, { color: "#27AE60" }]}>Improved</Text>
                  <Text style={[s.rewriteImproved, { color: colors.text }]}>{r.improved}</Text>
                  {!!r.explanation && (
                    <Text style={[s.rewriteExplanation, { color: colors.textSecondary }]}>
                      💡 {r.explanation}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Action buttons */}
          <Pressable
            onPress={getRewrite}
            disabled={generatingRewrite}
            style={({ pressed }) => [
              s.primaryBtn,
              { marginTop: 8, opacity: generatingRewrite || pressed ? 0.8 : 1 },
            ]}
          >
            <LinearGradient
              colors={[ACCENT, ACCENT_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.primaryBtnGrad}
            >
              {generatingRewrite ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.primaryBtnText}>Reescribiendo...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="create-outline" size={20} color="#fff" />
                  <Text style={s.primaryBtnText}>Reescribir mi ensayo (Banda 7)</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => setPhase("writing")}
            style={({ pressed }) => [
              s.ghostBtn,
              { borderColor: colors.border, marginTop: 10, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.text} />
            <Text style={[s.ghostBtnText, { color: colors.text }]}>Editar mi texto</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── Phase: Rewrite ──────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />
      <Header title="Reescritura Banda 7" onBack={() => setPhase("feedback")} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: botPad + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.infoRow, { backgroundColor: ACCENT + "15", borderColor: ACCENT + "30" }]}>
          <Ionicons name="sparkles" size={14} color={ACCENT} />
          <Text style={[s.infoText, { color: ACCENT }]}>
            Este es tu texto reescrito a nivel Banda 7. Estudia las diferencias con tu original.
          </Text>
        </View>

        <View style={[s.rewriteFullCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.rewriteFullText, { color: colors.text }]}>{rewritten}</Text>
        </View>

        <Text style={[s.wcInfo, { color: colors.textSecondary }]}>
          {wordCount(rewritten)} palabras
        </Text>

        <Pressable
          onPress={() => setPhase("feedback")}
          style={({ pressed }) => [
            s.ghostBtn,
            { borderColor: colors.border, marginTop: 14, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="arrow-back-outline" size={18} color={colors.text} />
          <Text style={[s.ghostBtnText, { color: colors.text }]}>Volver a retroalimentación</Text>
        </Pressable>

        <Pressable
          onPress={resetAll}
          style={({ pressed }) => [
            s.ghostBtn,
            { borderColor: colors.border, marginTop: 10, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="document-outline" size={18} color={colors.text} />
          <Text style={[s.ghostBtnText, { color: colors.text }]}>Nueva tarea de escritura</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  pill: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  optionDot: { width: 8, height: 8, borderRadius: 4 },
  optionText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  modeToggle: { flexDirection: "row", borderRadius: 10, borderWidth: 1, padding: 3, gap: 3 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 8 },
  modeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  outlineBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  promptBox: { borderRadius: 12, borderWidth: 1, padding: 14 },
  promptText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  promptPlaceholder: { borderRadius: 12, borderWidth: 1, padding: 20, alignItems: "center", gap: 8 },
  promptPlaceholderText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  customPromptInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22, minHeight: 120 },
  primaryBtn: { borderRadius: 14, overflow: "hidden" },
  primaryBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, paddingHorizontal: 20 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  resetBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  resetBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  promptCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12 },
  promptCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  promptCardLabel: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 },
  promptCardText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  editorCard: { borderRadius: 16, borderWidth: 1, padding: 16, minHeight: 240 },
  editor: { fontSize: 16, fontFamily: "Inter_400Regular", lineHeight: 26, minHeight: 220 },
  wcRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, paddingHorizontal: 4 },
  wcLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  wcValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  wcTarget: { fontSize: 13, fontFamily: "Inter_400Regular" },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  scoreCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  scoreRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  scoreLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  scoreBig: { fontSize: 42, fontFamily: "Inter_700Bold" },
  scoreMax: { fontSize: 22, fontFamily: "Inter_400Regular" },
  bandBox: { borderRadius: 14, borderWidth: 1, padding: 14, alignItems: "center", minWidth: 80 },
  bandLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 },
  bandNum: { fontSize: 36, fontFamily: "Inter_700Bold" },
  criteriaRow: { flexDirection: "row", gap: 8 },
  miniCriterion: { flex: 1, borderRadius: 10, padding: 10, alignItems: "center", gap: 2 },
  miniLetter: { fontSize: 13, fontFamily: "Inter_700Bold" },
  miniMark: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sectionCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12, gap: 10 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 8, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  vocabRow: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 4 },
  vocabWords: { flexDirection: "row", alignItems: "center", gap: 8 },
  vocabOriginal: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  vocabAdvanced: { fontSize: 15, fontFamily: "Inter_700Bold" },
  vocabReason: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  connectorWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  connectorChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  connectorText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  rewriteBox: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  rewriteLabel: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8 },
  rewriteOriginal: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, fontStyle: "italic" },
  rewriteDivider: { height: 1 },
  rewriteImproved: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 21 },
  rewriteExplanation: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  ghostBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  ghostBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  glossaryHint: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
  glossaryHintText: { flex: 1, fontSize: 11, fontFamily: "Inter_500Medium" },
  rewriteFullCard: { borderRadius: 16, borderWidth: 1, padding: 20 },
  rewriteFullText: { fontSize: 16, fontFamily: "Inter_400Regular", lineHeight: 28 },
  wcInfo: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "right", marginTop: 6 },
});
