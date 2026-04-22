import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
import { WordModal } from "@/components/WordModal";
import { CurriculumToggle } from "@/components/CurriculumToggle";
import { useCurriculum } from "@/contexts/CurriculumContext";

const ACCENT = "#27AE60";
const ACCENT_DARK = "#1E8449";
const QUESTION_COUNT_OPTIONS = [3, 5, 6, 8, 10, 12];

function getApiUrl() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/`;
  if (Platform.OS === "web") return "/";
  return "http://localhost:5000/";
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = "setup" | "reading" | "questions" | "review";
type InputMode = "generate" | "paste";

type MCQQuestion = {
  type: "mcq";
  id: number;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  textReference: string;
};
type TFQuestion = {
  type: "tf";
  id: number;
  question: string;
  statement: string;
  answer: string;
  explanation: string;
  textReference: string;
};
type SynonymQuestion = {
  type: "synonym";
  id: number;
  question: string;
  targetWord: string;
  givenWord: string;
  answer: string;
  explanation: string;
  textReference: string;
};
type Question = MCQQuestion | TFQuestion | SynonymQuestion;

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
  { id: "interview", name: "Entrevista" },
  { id: "email", name: "Correo formal" },
  { id: "report", name: "Informe" },
];

// ── Readable tappable text (no underline, highlight on press) ─────────────────
function ReadableText({
  content,
  textStyle,
  onWordPress,
}: {
  content: string;
  textStyle: object;
  onWordPress: (word: string, context: string) => void;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const parts = content.split(/(\s+)/);
  return (
    <Text style={textStyle}>
      {parts.map((part, i) => {
        if (/^\s+$/.test(part)) return part;
        const clean = part.replace(/[¿¡.,;:!?()"""«»\-—]/g, "").trim();
        if (!clean) return part;
        const isActive = activeIdx === i;
        return (
          <Text
            key={i}
            suppressHighlighting
            onPressIn={() => setActiveIdx(i)}
            onPressOut={() => setActiveIdx(null)}
            onPress={() => onWordPress(clean, content)}
            style={
              isActive
                ? { backgroundColor: ACCENT + "30", borderRadius: 2 }
                : undefined
            }
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

// ── Score pill ────────────────────────────────────────────────────────────────
function ScorePill({ correct, total }: { correct: number; total: number }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const color = pct >= 70 ? ACCENT : pct >= 50 ? "#E67E22" : "#E74C3C";
  return (
    <View style={[pill.wrap, { backgroundColor: color + "20", borderColor: color + "50" }]}>
      <Text style={[pill.text, { color }]}>{correct}/{total} · {pct}%</Text>
    </View>
  );
}
const pill = StyleSheet.create({
  wrap: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6, alignSelf: "center" },
  text: { fontSize: 15, fontFamily: "Inter_700Bold" },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ReadingScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { level, levelLabel } = useCurriculum();

  // Phase
  const [phase, setPhase] = useState<Phase>("setup");
  const [inputMode, setInputMode] = useState<InputMode>("generate");

  // Generate mode state
  const [selectedTheme, setSelectedTheme] = useState("experiencias");
  const [selectedType, setSelectedType] = useState("article");

  // Paste mode state
  const [pastedText, setPastedText] = useState("");
  const [pastedTitle, setPastedTitle] = useState("");

  // Custom focus (Feature 27)
  const [customFocus, setCustomFocus] = useState("");

  // Generated content
  const [readingTitle, setReadingTitle] = useState("");
  const [readingText, setReadingText] = useState("");


  // Questions
  const [questions, setQuestions] = useState<Question[]>([]);
  const [numQuestions, setNumQuestions] = useState(8);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // Loading
  const [generatingText, setGeneratingText] = useState(false);
  const [generatingQs, setGeneratingQs] = useState(false);

  // Word popup
  const [wordPopup, setWordPopup] = useState<{ word: string; context: string } | null>(null);

  // TTS read-aloud
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsPaused, setTtsPaused] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const generateText = async () => {
    setGeneratingText(true);
    try {
      const res = await fetch(`${getApiUrl()}api/reading/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: selectedTheme, textType: selectedType, customFocus: customFocus.trim() || undefined, level }),
      });
      const data = await res.json();
      setReadingTitle(data.title ?? "Texto de lectura");
      setReadingText(data.text ?? "");
      setQuestions([]);
      setAnswers({});
      setSubmitted(false);
      setPhase("reading");
    } catch {
      // silent
    } finally {
      setGeneratingText(false);
    }
  };

  const usePastedText = () => {
    const trimmed = pastedText.trim();
    if (trimmed.length < 50) return;
    setReadingTitle(pastedTitle.trim() || "Texto de lectura");
    setReadingText(trimmed);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setPhase("reading");
  };

  const generateQuestions = async () => {
    setGeneratingQs(true);
    try {
      const res = await fetch(`${getApiUrl()}api/reading/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: readingText, title: readingTitle, count: numQuestions, level }),
      });
      const data = await res.json();
      setQuestions(data.questions ?? []);
      setAnswers({});
      setSubmitted(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    } catch {
      // silent
    } finally {
      setGeneratingQs(false);
    }
  };

  const submitAnswers = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitted(true);
    setPhase("review");
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
  };

  const resetToSetup = () => {
    setPhase("setup");
    setReadingText("");
    setReadingTitle("");
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setPastedText("");
    setPastedTitle("");
  };

  const stopTts = async () => {
    try {
      if (Platform.OS === "web") {
        if (webAudioRef.current) {
          webAudioRef.current.pause();
          webAudioRef.current.src = "";
          webAudioRef.current = null;
        }
      } else {
        if (soundRef.current) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
      }
    } catch {}
    setTtsPlaying(false);
    setTtsPaused(false);
  };

  const pauseResumeTts = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (ttsPaused) {
      // Resume
      try {
        if (Platform.OS === "web") {
          await webAudioRef.current?.play();
        } else {
          await soundRef.current?.playAsync();
        }
      } catch {}
      setTtsPaused(false);
    } else {
      // Pause
      try {
        if (Platform.OS === "web") {
          webAudioRef.current?.pause();
        } else {
          await soundRef.current?.pauseAsync();
        }
      } catch {}
      setTtsPaused(true);
    }
  };

  const readAloud = async () => {
    if (ttsLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTtsLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}api/exam/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: readingText }),
      });
      const { audioBase64 } = await res.json();
      if (Platform.OS === "web") {
        if (webAudioRef.current) {
          webAudioRef.current.pause();
          webAudioRef.current.src = "";
        }
        const audio = new (globalThis as any).Audio(`data:audio/mp3;base64,${audioBase64}`) as HTMLAudioElement;
        webAudioRef.current = audio;
        audio.onended = () => { setTtsPlaying(false); setTtsPaused(false); webAudioRef.current = null; };
        audio.play();
        setTtsPlaying(true);
        setTtsPaused(false);
      } else {
        if (soundRef.current) {
          await soundRef.current.stopAsync().catch(() => {});
          await soundRef.current.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
        const path = (FileSystem.cacheDirectory ?? "") + "reading_tts.mp3";
        await FileSystem.writeAsStringAsync(path, audioBase64, { encoding: "base64" as any });
        const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
        soundRef.current = sound;
        setTtsPlaying(true);
        setTtsPaused(false);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync();
            soundRef.current = null;
            setTtsPlaying(false);
            setTtsPaused(false);
          }
        });
      }
    } catch {
      setTtsPlaying(false);
      setTtsPaused(false);
    } finally {
      setTtsLoading(false);
    }
  };


  const setAnswer = (id: number, val: string) => {
    setAnswers((prev) => ({ ...prev, [id]: val }));
  };

  const answeredCount = questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== "").length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  const correctCount = questions.filter((q) => {
    const userAns = (answers[q.id] ?? "").trim().toLowerCase();
    const correctAns = q.answer.trim().toLowerCase();
    return userAns === correctAns;
  }).length;

  // ── Render: Setup ──────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={isDark ? ["#0A1F0F", "#0F1117"] : ["#E8F8EE", "#F5F6FA"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[s.header, { paddingTop: topPad + 12 }]}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[s.screenLabel, { color: ACCENT }]}>{levelLabel}</Text>
            <Text style={[s.screenTitle, { color: colors.text }]}>Lectura</Text>
          </View>
          <View style={[s.badge, { backgroundColor: ACCENT + "20", borderColor: ACCENT + "50" }]}>
            <Text style={[s.badgeText, { color: ACCENT }]}>Reading</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: botPad + 20, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <CurriculumToggle />
          {/* Mode toggle */}
          <View style={[s.modeToggle, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
            <Pressable
              onPress={() => setInputMode("generate")}
              style={[s.modeBtn, inputMode === "generate" && { backgroundColor: ACCENT }]}
            >
              <Ionicons
                name="sparkles-outline"
                size={16}
                color={inputMode === "generate" ? "#fff" : colors.textSecondary}
              />
              <Text style={[s.modeBtnText, { color: inputMode === "generate" ? "#fff" : colors.textSecondary }]}>
                Generar texto
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setInputMode("paste")}
              style={[s.modeBtn, inputMode === "paste" && { backgroundColor: ACCENT }]}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color={inputMode === "paste" ? "#fff" : colors.textSecondary}
              />
              <Text style={[s.modeBtnText, { color: inputMode === "paste" ? "#fff" : colors.textSecondary }]}>
                Pegar texto
              </Text>
            </Pressable>
          </View>


          {inputMode === "generate" ? (
            <>
              {/* Theme selector */}
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Tema IB</Text>
                <View style={{ gap: 8, marginTop: 10 }}>
                  {THEMES.map((t) => {
                    const active = selectedTheme === t.id;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => setSelectedTheme(t.id)}
                        style={[
                          s.optionRow,
                          {
                            backgroundColor: active ? t.color + "18" : colors.cardAlt,
                            borderColor: active ? t.color : colors.border,
                          },
                        ]}
                      >
                        <View style={[s.optionDot, { backgroundColor: active ? t.color : colors.border }]} />
                        <Text style={[s.optionText, { color: active ? t.color : colors.text }]}>{t.name}</Text>
                        {active && <Ionicons name="checkmark-circle" size={18} color={t.color} />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Text type selector */}
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Tipo de texto</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {TEXT_TYPES.map((t) => {
                    const active = selectedType === t.id;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => setSelectedType(t.id)}
                        style={[
                          s.typeChip,
                          {
                            backgroundColor: active ? ACCENT : colors.cardAlt,
                            borderColor: active ? ACCENT : colors.border,
                          },
                        ]}
                      >
                        <Text style={[s.typeChipText, { color: active ? "#fff" : colors.text }]}>{t.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Custom Focus (Feature 27) */}
              <View style={[s.customFocusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.customFocusHeader}>
                  <Ionicons name="options-outline" size={15} color={colors.textSecondary} />
                  <Text style={[s.customFocusLabel, { color: colors.textSecondary }]}>Enfoque personalizado <Text style={{ fontFamily: "Inter_400Regular" }}>(opcional)</Text></Text>
                </View>
                <TextInput
                  style={[s.customFocusInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardAlt }]}
                  placeholder="p.ej. tecnología, subjuntivo, vocabulario de salud, conectores avanzados…"
                  placeholderTextColor={colors.textSecondary}
                  value={customFocus}
                  onChangeText={setCustomFocus}
                  multiline={false}
                  returnKeyType="done"
                />
              </View>

              {/* Generate button */}
              <Pressable
                onPress={generateText}
                disabled={generatingText}
                style={({ pressed }) => [s.primaryBtn, { opacity: pressed || generatingText ? 0.8 : 1 }]}
              >
                <LinearGradient
                  colors={[ACCENT, ACCENT_DARK]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.primaryBtnGrad}
                >
                  {generatingText ? (
                    <>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={s.primaryBtnText}>Generando texto...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="sparkles-outline" size={20} color="#fff" />
                      <Text style={s.primaryBtnText}>Generar texto</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </>
          ) : (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Título (opcional)</Text>
                <TextInput
                  value={pastedTitle}
                  onChangeText={setPastedTitle}
                  placeholder="Ej. El cambio climático en Latinoamérica"
                  placeholderTextColor={colors.textSecondary}
                  style={[s.titleInput, { color: colors.text, borderColor: colors.border }]}
                />
                <Text style={[s.sectionLabel, { color: colors.textSecondary, marginTop: 14 }]}>
                  Texto en español
                </Text>
                <TextInput
                  value={pastedText}
                  onChangeText={setPastedText}
                  multiline
                  placeholder="Pega aquí un texto en español (mínimo 50 palabras)..."
                  placeholderTextColor={colors.textSecondary}
                  style={[s.pasteInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardAlt }]}
                  textAlignVertical="top"
                />
                <Text style={[s.charCount, { color: colors.textSecondary }]}>
                  {pastedText.trim().split(/\s+/).filter(Boolean).length} palabras
                </Text>
              </View>

              <Pressable
                onPress={usePastedText}
                disabled={pastedText.trim().length < 50}
                style={({ pressed }) => [
                  s.primaryBtn,
                  { marginTop: 16, opacity: pressed || pastedText.trim().length < 50 ? 0.6 : 1 },
                ]}
              >
                <LinearGradient
                  colors={[ACCENT, ACCENT_DARK]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.primaryBtnGrad}
                >
                  <Ionicons name="book-outline" size={20} color="#fff" />
                  <Text style={s.primaryBtnText}>Usar este texto</Text>
                </LinearGradient>
              </Pressable>
            </KeyboardAvoidingView>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Render: Reading + Questions ─────────────────────────────────────────────
  if (phase === "reading" || phase === "questions") {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={isDark ? ["#0A1F0F", "#0F1117"] : ["#E8F8EE", "#F5F6FA"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[s.header, { paddingTop: topPad + 12 }]}>
          <Pressable onPress={resetToSetup} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[s.screenTitle, { color: colors.text }]} numberOfLines={1}>
              {readingTitle}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: ACCENT }}>
              IB Spanish B
            </Text>
          </View>

          <Pressable
            onPress={resetToSetup}
            style={[s.resetBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
          >
            <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
            <Text style={[s.resetBtnText, { color: colors.textSecondary }]}>Nuevo</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: botPad + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Tap hint + Read aloud row */}
          <View style={s.hintAndTtsRow}>
            <View style={[s.hintRow, { backgroundColor: ACCENT + "15", borderColor: ACCENT + "30", flex: 1 }]}>
              <Ionicons name="finger-print-outline" size={14} color={ACCENT} />
              <Text style={[s.hintText, { color: ACCENT }]}>
                Toca una palabra para ver su definición
              </Text>
            </View>
            {ttsPlaying || ttsPaused ? (
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable
                  onPress={pauseResumeTts}
                  style={({ pressed }) => [
                    s.ttsIconBtn,
                    { backgroundColor: ACCENT + "20", borderColor: ACCENT + "60", opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name={ttsPaused ? "play" : "pause"} size={18} color={ACCENT} />
                </Pressable>
                <Pressable
                  onPress={stopTts}
                  style={({ pressed }) => [
                    s.ttsIconBtn,
                    { backgroundColor: "#E74C3C15", borderColor: "#E74C3C50", opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="stop" size={18} color="#E74C3C" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={readAloud}
                disabled={ttsLoading}
                style={({ pressed }) => [
                  s.ttsBtn,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                {ttsLoading ? (
                  <ActivityIndicator size="small" color={ACCENT} />
                ) : (
                  <Ionicons name="volume-high-outline" size={20} color={colors.textSecondary} />
                )}
                <Text style={[s.ttsBtnText, { color: colors.textSecondary }]}>
                  {ttsLoading ? "Cargando..." : "Leer"}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Reading text — paragraphs */}
          <View style={[s.readingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {readingText.split("\n\n").filter(Boolean).map((para, pi) => (
              <ReadableText
                key={pi}
                content={para}
                textStyle={[s.readingText, { color: colors.text, marginBottom: 14 }]}
                onWordPress={(word, ctx) => setWordPopup({ word, context: ctx })}
              />
            ))}
          </View>

          {/* Questions section */}
          {/* Number of questions picker */}
          {questions.length === 0 && (
            <View style={[s.countPickerWrap, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 20 }]}>
              <Text style={[s.countPickerLabel, { color: colors.textSecondary }]}>Número de preguntas</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.countPickerRow}>
                {QUESTION_COUNT_OPTIONS.map((n) => {
                  const active = numQuestions === n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setNumQuestions(n)}
                      style={[
                        s.countPill,
                        {
                          backgroundColor: active ? ACCENT : colors.cardAlt,
                          borderColor: active ? ACCENT : colors.border,
                        },
                      ]}
                    >
                      <Text style={[s.countPillText, { color: active ? "#fff" : colors.textSecondary }]}>{n}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {questions.length === 0 ? (
            <Pressable
              onPress={generateQuestions}
              disabled={generatingQs}
              style={({ pressed }) => [s.primaryBtn, { marginTop: 12, opacity: pressed || generatingQs ? 0.8 : 1 }]}
            >
              <LinearGradient
                colors={[ACCENT, ACCENT_DARK]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.primaryBtnGrad}
              >
                {generatingQs ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={s.primaryBtnText}>Generando preguntas...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="help-circle-outline" size={20} color="#fff" />
                    <Text style={s.primaryBtnText}>Generar preguntas</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          ) : (
            <>
              {/* Questions header */}
              <View style={s.questionsHeader}>
                <Text style={[s.questionsTitle, { color: colors.text }]}>
                  Preguntas · {questions.length}
                </Text>
                <Pressable
                  onPress={generateQuestions}
                  disabled={generatingQs}
                  style={[s.regenBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
                >
                  {generatingQs
                    ? <ActivityIndicator size="small" color={ACCENT} />
                    : <Ionicons name="refresh-outline" size={16} color={ACCENT} />}
                  <Text style={[s.regenBtnText, { color: ACCENT }]}>Regenerar</Text>
                </Pressable>
              </View>

              {/* Question cards */}
              {questions.map((q, qi) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={qi}
                  answer={answers[q.id] ?? ""}
                  onAnswer={(val) => setAnswer(q.id, val)}
                  colors={colors}
                  onWordPress={(word, ctx) => setWordPopup({ word, context: ctx })}
                />
              ))}

              {/* Submit */}
              <View style={s.submitRow}>
                <Text style={[s.submitCount, { color: colors.textSecondary }]}>
                  {answeredCount}/{questions.length} respondidas
                </Text>
                <Pressable
                  onPress={submitAnswers}
                  disabled={!allAnswered}
                  style={({ pressed }) => [
                    s.submitBtn,
                    {
                      backgroundColor: allAnswered ? ACCENT : colors.cardAlt,
                      borderColor: allAnswered ? ACCENT : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={[s.submitBtnText, { color: allAnswered ? "#fff" : colors.textSecondary }]}>
                    Enviar respuestas
                  </Text>
                  <Ionicons name="checkmark-circle-outline" size={18} color={allAnswered ? "#fff" : colors.textSecondary} />
                </Pressable>
              </View>
            </>
          )}
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

  // ── Render: Review ──────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ["#0A1F0F", "#0F1117"] : ["#E8F8EE", "#F5F6FA"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.header, { paddingTop: topPad + 12 }]}>
        <Pressable onPress={() => setPhase("questions")} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[s.screenTitle, { color: colors.text, flex: 1 }]}>Resultados</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: botPad + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Score summary */}
        <View style={[s.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.scoreTitle, { color: colors.text }]}>Puntuación final</Text>
          <ScorePill correct={correctCount} total={questions.length} />
          <Text style={[s.scoreSubtitle, { color: colors.textSecondary }]}>
            {correctCount >= questions.length * 0.7
              ? "¡Excelente trabajo! Tienes una comprensión lectora muy buena."
              : correctCount >= questions.length * 0.5
              ? "Buen intento. Revisa las explicaciones para mejorar."
              : "Sigue practicando. Lee las explicaciones con atención."}
          </Text>
        </View>

        {/* Result cards */}
        {questions.map((q, qi) => {
          const userAns = (answers[q.id] ?? "").trim();
          const correct = userAns.toLowerCase() === q.answer.toLowerCase();
          return (
            <ReviewCard
              key={q.id}
              question={q}
              index={qi}
              userAnswer={userAns}
              correct={correct}
              colors={colors}
              onWordPress={(word, ctx) => setWordPopup({ word, context: ctx })}
            />
          );
        })}

        {/* Action buttons */}
        <Pressable
          onPress={() => {
            setAnswers({});
            setSubmitted(false);
            setPhase("questions");
          }}
          style={({ pressed }) => [s.outlineBtn, { borderColor: ACCENT, opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="refresh-outline" size={18} color={ACCENT} />
          <Text style={[s.outlineBtnText, { color: ACCENT }]}>Reintentar preguntas</Text>
        </Pressable>

        <Pressable
          onPress={resetToSetup}
          style={({ pressed }) => [
            s.outlineBtn,
            { borderColor: colors.border, marginTop: 10, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="book-outline" size={18} color={colors.text} />
          <Text style={[s.outlineBtnText, { color: colors.text }]}>Nuevo texto</Text>
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

// ── Question card (answering phase) ───────────────────────────────────────────
function QuestionCard({
  question,
  index,
  answer,
  onAnswer,
  colors,
  onWordPress,
}: {
  question: Question;
  index: number;
  answer: string;
  onAnswer: (val: string) => void;
  colors: typeof Colors.dark;
  onWordPress: (word: string, ctx: string) => void;
}) {
  const typeLabel =
    question.type === "mcq" ? "Selección múltiple" :
    question.type === "tf" ? "Verdadero / Falso" :
    "Sinónimo";

  const typeColor =
    question.type === "mcq" ? "#2980B9" :
    question.type === "tf" ? "#8E44AD" :
    "#E67E22";

  return (
    <View style={[qc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={qc.topRow}>
        <View style={[qc.badge, { backgroundColor: typeColor + "20", borderColor: typeColor + "40" }]}>
          <Text style={[qc.badgeText, { color: typeColor }]}>{typeLabel}</Text>
        </View>
        <Text style={[qc.num, { color: colors.textSecondary }]}>#{index + 1}</Text>
      </View>

      {question.type === "mcq" && (
        <>
          <ReadableTappable text={question.question} textStyle={[qc.qText, { color: colors.text }]} onWordPress={onWordPress} />
          <View style={{ gap: 8, marginTop: 12 }}>
            {question.options.map((opt, oi) => {
              const letter = ["A", "B", "C", "D"][oi];
              const active = answer === letter;
              return (
                <Pressable
                  key={oi}
                  onPress={() => onAnswer(letter)}
                  style={[qc.optionRow, {
                    backgroundColor: active ? ACCENT + "18" : colors.cardAlt,
                    borderColor: active ? ACCENT : colors.border,
                  }]}
                >
                  <View style={[qc.letterBadge, { backgroundColor: active ? ACCENT : colors.border }]}>
                    <Text style={[qc.letterText, { color: active ? "#fff" : colors.text }]}>{letter}</Text>
                  </View>
                  <Text style={[qc.optText, { color: colors.text }]}>{opt.replace(/^[ABCD]\.\s*/, "")}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {question.type === "tf" && (
        <>
          <ReadableTappable text={question.question} textStyle={[qc.qText, { color: colors.text }]} onWordPress={onWordPress} />
          <ReadableTappable text={question.statement} textStyle={[qc.statementText, { color: colors.text, backgroundColor: colors.cardAlt, borderColor: colors.border }]} onWordPress={onWordPress} isBlock />
          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
            {["Verdadero", "Falso"].map((opt) => {
              const active = answer === opt;
              const btnColor = opt === "Verdadero" ? ACCENT : "#E74C3C";
              return (
                <Pressable
                  key={opt}
                  onPress={() => onAnswer(opt)}
                  style={[qc.tfBtn, {
                    backgroundColor: active ? btnColor : colors.cardAlt,
                    borderColor: active ? btnColor : colors.border,
                    flex: 1,
                  }]}
                >
                  <Ionicons
                    name={opt === "Verdadero" ? "checkmark-outline" : "close-outline"}
                    size={18}
                    color={active ? "#fff" : colors.textSecondary}
                  />
                  <Text style={[qc.tfText, { color: active ? "#fff" : colors.text }]}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {question.type === "synonym" && (
        <>
          <ReadableTappable text={question.question} textStyle={[qc.qText, { color: colors.text }]} onWordPress={onWordPress} />
          <View style={[qc.givenWordBox, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
            <Text style={[qc.givenWordLabel, { color: colors.textSecondary }]}>Encuentra un sinónimo de:</Text>
            <Text style={[qc.givenWord, { color: ACCENT }]}>{question.givenWord}</Text>
          </View>
          <TextInput
            value={answer}
            onChangeText={onAnswer}
            placeholder="Escribe la palabra del texto..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            style={[qc.synonymInput, { color: colors.text, borderColor: answer ? ACCENT : colors.border, backgroundColor: colors.cardAlt }]}
          />
        </>
      )}
    </View>
  );
}
const qc = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 14 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  badge: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  num: { fontSize: 12, fontFamily: "Inter_400Regular" },
  qText: { fontSize: 15, fontFamily: "Inter_500Medium", lineHeight: 22 },
  statementText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 10 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  letterBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  letterText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  optText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  tfBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  tfText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  givenWordBox: { marginTop: 10, padding: 12, borderRadius: 10, borderWidth: 1, gap: 4 },
  givenWordLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5 },
  givenWord: { fontSize: 20, fontFamily: "Inter_700Bold" },
  synonymInput: { marginTop: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: "Inter_500Medium" },
});

// ── Review card (results phase) ───────────────────────────────────────────────
function ReviewCard({
  question,
  index,
  userAnswer,
  correct,
  colors,
  onWordPress,
}: {
  question: Question;
  index: number;
  userAnswer: string;
  correct: boolean;
  colors: typeof Colors.dark;
  onWordPress: (word: string, ctx: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const displayQuestion =
    question.type === "tf" ? question.statement :
    question.type === "synonym" ? `Sinónimo de: "${question.givenWord}"` :
    question.question;

  const displayUserAnswer = userAnswer || "(sin respuesta)";
  const displayCorrectAnswer = question.answer;

  return (
    <View style={[rv.card, {
      backgroundColor: colors.card,
      borderColor: correct ? ACCENT + "60" : "#E74C3C60",
      borderLeftColor: correct ? ACCENT : "#E74C3C",
    }]}>
      <Pressable onPress={() => setExpanded((e) => !e)} style={rv.topRow}>
        <View style={[rv.icon, { backgroundColor: correct ? ACCENT + "20" : "#E74C3C20" }]}>
          <Ionicons
            name={correct ? "checkmark" : "close"}
            size={16}
            color={correct ? ACCENT : "#E74C3C"}
          />
        </View>
        <Text style={[rv.questionText, { color: colors.text, flex: 1 }]} numberOfLines={expanded ? undefined : 2}>
          {index + 1}. {displayQuestion}
        </Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
      </Pressable>

      {expanded && (
        <View style={{ gap: 10, marginTop: 10 }}>
          {/* User answer */}
          <View style={[rv.answerBox, { backgroundColor: correct ? ACCENT + "12" : "#E74C3C12", borderColor: correct ? ACCENT + "40" : "#E74C3C40" }]}>
            <Text style={[rv.answerLabel, { color: colors.textSecondary }]}>Tu respuesta:</Text>
            <Text style={[rv.answerValue, { color: correct ? ACCENT : "#E74C3C" }]}>{displayUserAnswer}</Text>
          </View>

          {/* Correct answer (show only if wrong) */}
          {!correct && (
            <View style={[rv.answerBox, { backgroundColor: ACCENT + "12", borderColor: ACCENT + "40" }]}>
              <Text style={[rv.answerLabel, { color: colors.textSecondary }]}>Respuesta correcta:</Text>
              <Text style={[rv.answerValue, { color: ACCENT }]}>{displayCorrectAnswer}</Text>
            </View>
          )}

          {/* Explanation */}
          <View style={[rv.explanationBox, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
            <View style={rv.explanationHeader}>
              <Ionicons name="information-circle-outline" size={15} color={colors.textSecondary} />
              <Text style={[rv.explanationLabel, { color: colors.textSecondary }]}>Explanation</Text>
            </View>
            <ReadableTappable
              text={question.explanation}
              textStyle={[rv.explanationText, { color: colors.text }]}
              onWordPress={onWordPress}
            />
          </View>

          {/* Text reference */}
          {!!question.textReference && (
            <View style={[rv.refBox, { backgroundColor: colors.cardAlt, borderColor: ACCENT + "30" }]}>
              <View style={rv.explanationHeader}>
                <Ionicons name="document-text-outline" size={15} color={ACCENT} />
                <Text style={[rv.explanationLabel, { color: ACCENT }]}>Texto</Text>
              </View>
              <ReadableTappable
                text={`"${question.textReference}"`}
                textStyle={[rv.refText, { color: colors.textSecondary }]}
                onWordPress={onWordPress}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
const rv = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, borderLeftWidth: 4, padding: 14, marginTop: 12 },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 2, flexShrink: 0 },
  questionText: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 21 },
  answerBox: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 2 },
  answerLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5 },
  answerValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  explanationBox: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 6 },
  explanationHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  explanationLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  explanationText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  refBox: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 6 },
  refText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, fontStyle: "italic" },
});

// ── Simple inline tappable (no underline) used inside cards ───────────────────
function ReadableTappable({
  text,
  textStyle,
  onWordPress,
  isBlock,
}: {
  text: string;
  textStyle: object | object[];
  onWordPress: (word: string, ctx: string) => void;
  isBlock?: boolean;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const parts = text.split(/(\s+)/);
  return (
    <Text style={textStyle}>
      {parts.map((part, i) => {
        if (/^\s+$/.test(part)) return part;
        const clean = part.replace(/[¿¡.,;:!?()"""«»\-—]/g, "").trim();
        if (!clean) return part;
        const isActive = activeIdx === i;
        return (
          <Text
            key={i}
            suppressHighlighting
            onPressIn={() => setActiveIdx(i)}
            onPressOut={() => setActiveIdx(null)}
            onPress={() => onWordPress(clean, text)}
            style={isActive ? { backgroundColor: ACCENT + "25", borderRadius: 2 } : undefined}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  screenLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 2 },
  screenTitle: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  badge: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  resetBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  resetBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  simplifyBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6 },
  simplifyBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  modeToggle: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 4, gap: 4 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 9 },
  modeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  optionDot: { width: 8, height: 8, borderRadius: 4 },
  optionText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  typeChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  customFocusCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  customFocusHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  customFocusLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  customFocusInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: "Inter_400Regular" },
  primaryBtn: { borderRadius: 14, overflow: "hidden" },
  primaryBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, paddingHorizontal: 20 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  countPickerWrap: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  countPickerLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  countPickerRow: { gap: 8, paddingVertical: 2 },
  countPill: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1, minWidth: 44, alignItems: "center" },
  countPillText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  titleInput: { marginTop: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontFamily: "Inter_400Regular" },
  pasteInput: { marginTop: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22, minHeight: 180 },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right", marginTop: 4 },
  hintAndTtsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14, marginTop: 4 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10, borderWidth: 1 },
  ttsBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, minWidth: 80, justifyContent: "center" },
  ttsBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  ttsIconBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  hintText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  readingCard: { borderRadius: 16, borderWidth: 1, padding: 20 },
  readingText: { fontSize: 16, fontFamily: "Inter_400Regular", lineHeight: 27 },
  questionsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 2 },
  questionsTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  regenBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  regenBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  submitRow: { marginTop: 20, gap: 10 },
  submitCount: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 14, borderWidth: 1 },
  submitBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  scoreCard: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 12, marginBottom: 4, alignItems: "center" },
  scoreTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  scoreSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginTop: 14 },
  outlineBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
