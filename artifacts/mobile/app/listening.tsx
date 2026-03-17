import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { THEMES } from "@/constants/themes";
import { WordModal, TappableText } from "@/components/WordModal";

function getApiUrl() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/`;
  return "http://localhost:80/";
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Phase = "setup" | "listening" | "questions" | "review";
type PlayStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "ended";
type PassageType = "conversation" | "interview" | "monologue" | "news";

type Question = {
  id: string;
  type: "multiple-choice" | "true-false" | "short-answer" | "detail" | "inference";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
};

type AnswerRecord = {
  given: string;
  correct: boolean;
  feedback: string;
};

// ── Constants ──────────────────────────────────────────────────────────────────
const SPEED_OPTIONS = [0.8, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 4];
const DEFAULT_MAX_PLAYS = 3;

const PASSAGE_TYPES: { id: PassageType; label: string; icon: string; desc: string }[] = [
  { id: "conversation", label: "Conversación", icon: "chatbubbles-outline", desc: "Diálogo entre dos personas" },
  { id: "interview", label: "Entrevista", icon: "mic-outline", desc: "Periodista y entrevistado" },
  { id: "monologue", label: "Monólogo", icon: "person-outline", desc: "Narración personal" },
  { id: "news", label: "Noticia", icon: "newspaper-outline", desc: "Boletín de noticias" },
];

const TYPE_COLORS: Record<PassageType, string> = {
  conversation: "#9B59B6",
  interview: "#3498DB",
  monologue: "#E67E22",
  news: "#2ECC71",
};

const generateId = () => Math.random().toString(36).slice(2);

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function ListeningScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // ── Phase ─────────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("setup");

  // ── Setup state ───────────────────────────────────────────────────────────────
  const [selectedThemeId, setSelectedThemeId] = useState(THEMES[0].id);
  const [selectedType, setSelectedType] = useState<PassageType>("conversation");
  const [manualPassage, setManualPassage] = useState("");
  const [generatingPassage, setGeneratingPassage] = useState(false);

  // ── Passage state ─────────────────────────────────────────────────────────────
  const [passageTitle, setPassageTitle] = useState("");
  const [passageContext, setPassageContext] = useState("");
  const [passage, setPassage] = useState("");
  const [showPassage, setShowPassage] = useState(false);

  // ── Word popup (F19) ─────────────────────────────────────────────────────────
  const [wordPopup, setWordPopup] = useState<{ word: string; context: string } | null>(null);

  // ── Audio state ───────────────────────────────────────────────────────────────
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [playStatus, setPlayStatus] = useState<PlayStatus>("idle");
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playCount, setPlayCount] = useState(0);
  const [maxPlays, setMaxPlays] = useState(DEFAULT_MAX_PLAYS);
  const [unlimitedPlays, setUnlimitedPlays] = useState(true);
  const [isDualVoice, setIsDualVoice] = useState(false);

  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const nativeSoundRef = useRef<Audio.Sound | null>(null);
  const seekBarLayoutRef = useRef<{ x: number; width: number } | null>(null);

  // Progress tracking
  const [progressMs, setProgressMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  // ── Questions state ───────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [checkingAnswer, setCheckingAnswer] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});

  const selectedTheme = THEMES.find((t) => t.id === selectedThemeId) ?? THEMES[0];
  const themeColor = selectedTheme.color;
  const typeColor = TYPE_COLORS[selectedType];

  // ── Generate passage ──────────────────────────────────────────────────────────
  const generatePassage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGeneratingPassage(true);
    try {
      const res = await fetch(`${getApiUrl()}api/listening/passage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: selectedThemeId, passageType: selectedType }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      setPassageTitle(data.title ?? "Pasaje de escucha");
      setPassageContext(data.context ?? "");
      setPassage(data.passage ?? "");
      setManualPassage("");
    } catch {
      Alert.alert("Error", "No se pudo generar el pasaje. Inténtalo de nuevo.");
    } finally {
      setGeneratingPassage(false);
    }
  };

  // ── Load audio (TTS with F40 dialogue support) ────────────────────────────────
  const loadAudio = async (text: string) => {
    setAudioLoading(true);
    setPlayStatus("loading");
    setAudioBase64(null);
    setPlayCount(0);
    // Clean up any existing audio
    if (webAudioRef.current) { webAudioRef.current.pause(); webAudioRef.current = null; }
    if (nativeSoundRef.current) { await nativeSoundRef.current.unloadAsync().catch(() => {}); nativeSoundRef.current = null; }
    try {
      const res = await fetch(`${getApiUrl()}api/listening/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passage: text }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const data = await res.json();
      setAudioBase64(data.audioBase64);
      setIsDualVoice(data.isDualVoice ?? false);
      setPlayStatus("ready");
    } catch {
      setPlayStatus("idle");
      Alert.alert("Error", "No se pudo generar el audio. Inténtalo de nuevo.");
    } finally {
      setAudioLoading(false);
    }
  };

  const handleBeginListening = async () => {
    const text = passage || manualPassage;
    if (!text.trim()) {
      Alert.alert("Sin texto", "Pega un pasaje o genera uno antes de continuar.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!passageTitle) setPassageTitle("Pasaje de escucha");
    setPassage(text);
    setPhase("listening");
    await loadAudio(text);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const seekTo = useCallback(async (ms: number) => {
    const clamped = Math.max(0, Math.min(ms, durationMs));
    setProgressMs(clamped);
    if (Platform.OS === "web") {
      if (webAudioRef.current) webAudioRef.current.currentTime = clamped / 1000;
    } else {
      await nativeSoundRef.current?.setStatusAsync({ positionMillis: clamped }).catch(() => {});
    }
  }, [durationMs]);

  const handleSeekBar = useCallback((locationX: number) => {
    const layout = seekBarLayoutRef.current;
    if (!layout || durationMs === 0) return;
    const fraction = Math.max(0, Math.min(1, locationX / layout.width));
    seekTo(fraction * durationMs);
  }, [durationMs, seekTo]);

  // ── Audio playback ────────────────────────────────────────────────────────────
  const playAudio = useCallback(async () => {
    if (!audioBase64) return;
    if (!unlimitedPlays && playCount >= maxPlays) {
      Alert.alert("Límite de reproducciones", `Has alcanzado el límite de ${maxPlays} reproducciones.`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS === "web") {
      if (!webAudioRef.current) {
        // null means: never loaded, or ended/errored (ref cleared in those callbacks)
        const audio = new (window as any).Audio(`data:audio/mp3;base64,${audioBase64}`) as HTMLAudioElement;
        webAudioRef.current = audio;
        audio.playbackRate = playbackSpeed;
        audio.onloadedmetadata = () => setDurationMs(Math.floor((audio.duration ?? 0) * 1000));
        audio.ontimeupdate = () => setProgressMs(Math.floor((audio.currentTime ?? 0) * 1000));
        audio.onended = () => { webAudioRef.current = null; setPlayStatus("ended"); setProgressMs(0); };
        audio.onerror = () => { webAudioRef.current = null; setPlayStatus("ready"); };
        setPlayCount((c) => c + 1);
        setProgressMs(0);
      } else {
        webAudioRef.current.playbackRate = playbackSpeed;
      }
      await webAudioRef.current.play();
      setPlayStatus("playing");
    } else {
      try {
        if (!nativeSoundRef.current) {
          // null means: never loaded, or ended/errored (ref cleared in those callbacks)
          const path = (FileSystem.cacheDirectory ?? "") + "listening.mp3";
          await FileSystem.writeAsStringAsync(path, audioBase64, { encoding: "base64" });
          const { sound } = await Audio.Sound.createAsync({ uri: path });
          nativeSoundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((s) => {
            if (!s.isLoaded) return;
            if (s.durationMillis) setDurationMs(s.durationMillis);
            setProgressMs(s.positionMillis ?? 0);
            if (s.didJustFinish) {
              nativeSoundRef.current = null;
              sound.unloadAsync().catch(() => {});
              setPlayStatus("ended");
              setProgressMs(0);
            }
          });
          setPlayCount((c) => c + 1);
          setProgressMs(0);
        }
        await nativeSoundRef.current!.setStatusAsync({
          shouldPlay: true,
          rate: playbackSpeed,
          shouldCorrectPitch: true,
        });
        setPlayStatus("playing");
      } catch {
        setPlayStatus("ready");
      }
    }
  }, [audioBase64, playbackSpeed, playCount, maxPlays, unlimitedPlays]);

  const pauseAudio = useCallback(async () => {
    if (Platform.OS === "web") {
      webAudioRef.current?.pause();
    } else {
      await nativeSoundRef.current?.setStatusAsync({ shouldPlay: false });
    }
    setPlayStatus("paused");
  }, []);

  // Speed change: stop and reset to beginning — user presses play again at new speed
  const handleSpeedChange = useCallback(async (speed: number) => {
    setPlaybackSpeed(speed);
    try {
      if (Platform.OS === "web") {
        if (webAudioRef.current) {
          webAudioRef.current.pause();
          webAudioRef.current.currentTime = 0;
        }
      } else {
        if (nativeSoundRef.current) {
          await nativeSoundRef.current.setStatusAsync({ shouldPlay: false, positionMillis: 0 }).catch(() => {});
        }
      }
    } catch {}
    if (playStatus === "playing" || playStatus === "paused") {
      setPlayStatus("ready");
      setProgressMs(0);
    }
  }, [playStatus]);

  // ── Generate questions ────────────────────────────────────────────────────────
  const generateQuestions = async () => {
    if (!passage.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setQuestionsLoading(true);
    setAnswers({});
    setCurrentQIndex(0);
    setCurrentAnswer("");
    try {
      const res = await fetch(`${getApiUrl()}api/listening/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passage, count: 6 }),
      });
      if (!res.ok) throw new Error("Question generation failed");
      const data = await res.json();
      const qs: Question[] = (data.questions ?? []).map((q: any, i: number) => ({
        ...q,
        id: q.id ?? `q${i + 1}`,
      }));
      setQuestions(qs);
      setPhase("questions");
    } catch {
      Alert.alert("Error", "No se pudieron generar las preguntas.");
    } finally {
      setQuestionsLoading(false);
    }
  };

  // ── Check answer ──────────────────────────────────────────────────────────────
  const checkAnswer = async () => {
    const q = questions[currentQIndex];
    if (!q || !currentAnswer.trim() || checkingAnswer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCheckingAnswer(true);
    try {
      const res = await fetch(`${getApiUrl()}api/listening/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.question,
          questionType: q.type,
          studentAnswer: currentAnswer.trim(),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          passage,
        }),
      });
      if (!res.ok) throw new Error("Check failed");
      const result = await res.json();
      setAnswers((prev) => ({
        ...prev,
        [q.id]: { given: currentAnswer.trim(), correct: result.correct, feedback: result.feedback },
      }));
    } catch {
      setAnswers((prev) => ({
        ...prev,
        [q.id]: { given: currentAnswer.trim(), correct: false, feedback: "Error al verificar la respuesta." },
      }));
    } finally {
      setCheckingAnswer(false);
    }
  };

  const handleNextQuestion = () => {
    setCurrentAnswer("");
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((i) => i + 1);
    } else {
      setPhase("review");
    }
  };

  const cleanupAudio = () => {
    if (webAudioRef.current) { webAudioRef.current.pause(); webAudioRef.current = null; }
    nativeSoundRef.current?.unloadAsync().catch(() => {});
  };

  const handleExit = () => {
    if (phase === "setup") { router.back(); return; }
    if (Platform.OS === "web") {
      if (window.confirm("¿Salir de la práctica de escucha?")) {
        cleanupAudio();
        router.replace("/");
      }
    } else {
      Alert.alert("Salir", "¿Salir de la práctica de escucha?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Salir", style: "destructive", onPress: () => { cleanupAudio(); router.replace("/"); } },
      ]);
    }
  };

  const correctCount = Object.values(answers).filter((a) => a.correct).length;
  const totalAnswered = Object.keys(answers).length;

  // ═══════════════════════════════════════════════════════════════════════════════
  // SETUP PHASE
  // ═══════════════════════════════════════════════════════════════════════════════
  if (phase === "setup") {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={isDark ? ["#0D1B2A", "#0F1117"] : ["#E8F4FD", "#F5F6FA"]} style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [s.headerBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={[s.headerTitle, { color: colors.text }]}>Comprensión auditiva</Text>
            <Text style={[s.headerSub, { color: colors.textSecondary }]}>IB Spanish B · Listening Practice</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={[s.setupContent, { paddingBottom: botPad + 32 }]} showsVerticalScrollIndicator={false}>
          {/* Theme selector */}
          <Text style={[s.sectionTitle, { color: colors.text }]}>Tema IB</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.themeRow}>
            {THEMES.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setSelectedThemeId(t.id)}
                style={[
                  s.themeChip,
                  {
                    borderColor: selectedThemeId === t.id ? t.color : colors.border,
                    backgroundColor: selectedThemeId === t.id ? t.color + "18" : colors.card,
                  },
                ]}
              >
                <Ionicons name={t.iconName as any} size={14} color={selectedThemeId === t.id ? t.color : colors.textSecondary} />
                <Text style={[s.themeChipText, { color: selectedThemeId === t.id ? t.color : colors.textSecondary }]}>{t.nameShort}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Passage type */}
          <Text style={[s.sectionTitle, { color: colors.text, marginTop: 8 }]}>Tipo de pasaje</Text>
          <View style={s.typeGrid}>
            {PASSAGE_TYPES.map((pt) => {
              const isSelected = selectedType === pt.id;
              const col = TYPE_COLORS[pt.id];
              return (
                <Pressable
                  key={pt.id}
                  onPress={() => setSelectedType(pt.id)}
                  style={[
                    s.typeCard,
                    {
                      backgroundColor: isSelected ? col + "18" : colors.card,
                      borderColor: isSelected ? col : colors.border,
                    },
                  ]}
                >
                  <Ionicons name={pt.icon as any} size={20} color={isSelected ? col : colors.textSecondary} />
                  <Text style={[s.typeLabel, { color: isSelected ? col : colors.text }]}>{pt.label}</Text>
                  <Text style={[s.typeDesc, { color: colors.textSecondary }]}>{pt.desc}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Generate button */}
          <Pressable
            onPress={generatePassage}
            disabled={generatingPassage}
            style={({ pressed }) => [s.generateBtn, { opacity: pressed || generatingPassage ? 0.8 : 1 }]}
          >
            <LinearGradient colors={[themeColor, selectedTheme.colorDark]} style={s.generateGrad}>
              {generatingPassage ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="sparkles-outline" size={18} color="#fff" />
              )}
              <Text style={s.generateText}>
                {generatingPassage ? "Generando pasaje…" : "Generar pasaje con IA"}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Generated passage preview */}
          {passage ? (
            <View style={[s.passagePreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.passagePreviewHeader}>
                <Text style={[s.passagePreviewTitle, { color: colors.text }]}>{passageTitle}</Text>
                {isDualVoice && (
                  <View style={[s.dualBadge, { backgroundColor: "#9B59B620", borderColor: "#9B59B640" }]}>
                    <Ionicons name="people-outline" size={12} color="#9B59B6" />
                    <Text style={[s.dualBadgeText, { color: "#9B59B6" }]}>2 voces</Text>
                  </View>
                )}
              </View>
              {passageContext ? <Text style={[s.passageContext, { color: colors.textSecondary }]}>{passageContext}</Text> : null}
              <Text style={[s.passagePreviewText, { color: colors.textSecondary }]} numberOfLines={4}>
                {passage}
              </Text>
            </View>
          ) : null}

          {/* Divider */}
          <View style={s.dividerRow}>
            <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[s.dividerText, { color: colors.textSecondary }]}>o pega tu propio pasaje</Text>
            <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Manual paste */}
          <TextInput
            style={[s.pasteInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
            value={manualPassage}
            onChangeText={setManualPassage}
            placeholder="Pega aquí un pasaje en español (máx ~400 palabras)…"
            placeholderTextColor={colors.textSecondary}
            multiline
            textAlignVertical="top"
          />

          {/* Play limit toggle */}
          <View style={[s.limitRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="timer-outline" size={18} color={themeColor} />
            <Text style={[s.limitLabel, { color: colors.text }]}>Modo examen (limitar reproducciones)</Text>
            <Pressable
              onPress={() => setUnlimitedPlays((v) => !v)}
              style={[s.toggleBtn, { backgroundColor: unlimitedPlays ? colors.cardAlt : themeColor + "30", borderColor: unlimitedPlays ? colors.border : themeColor }]}
            >
              <Text style={[s.toggleText, { color: unlimitedPlays ? colors.textSecondary : themeColor }]}>
                {unlimitedPlays ? "Ilimitado" : `Máx ${maxPlays}x`}
              </Text>
            </Pressable>
          </View>

          {/* Begin button */}
          <Pressable
            onPress={handleBeginListening}
            disabled={!passage && !manualPassage.trim()}
            style={({ pressed }) => [
              s.beginBtn,
              { opacity: pressed || (!passage && !manualPassage.trim()) ? 0.5 : 1 },
            ]}
          >
            <LinearGradient colors={[themeColor, selectedTheme.colorDark]} style={s.beginGrad}>
              <Ionicons name="headset-outline" size={20} color="#fff" />
              <Text style={s.beginText}>Comenzar práctica</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // LISTENING PHASE
  // ═══════════════════════════════════════════════════════════════════════════════
  if (phase === "listening") {
    const canPlay = playStatus === "ready" || playStatus === "paused" || playStatus === "ended";
    const isPlaying = playStatus === "playing";
    const playsLeft = maxPlays - playCount;

    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={isDark ? ["#0D1B2A", "#0F1117"] : ["#E8F4FD", "#F5F6FA"]} style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={[s.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={handleExit} style={({ pressed }) => [s.headerBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="close" size={20} color="#FF4444" />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={[s.headerTitle, { color: colors.text }]} numberOfLines={1}>{passageTitle}</Text>
            <Text style={[s.headerSub, { color: themeColor }]}>{selectedTheme.name}</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {wordPopup && (
        <WordModal
          word={wordPopup.word}
          context={wordPopup.context}
          themeColor={themeColor}
          onClose={() => setWordPopup(null)}
        />
      )}

      <ScrollView contentContainerStyle={[s.listeningContent, { paddingBottom: botPad + 24 }]} showsVerticalScrollIndicator={false}>
          {/* Context line */}
          {passageContext ? (
            <View style={[s.contextCard, { backgroundColor: themeColor + "15", borderColor: themeColor + "30" }]}>
              <Ionicons name="information-circle-outline" size={16} color={themeColor} />
              <Text style={[s.contextText, { color: themeColor }]}>{passageContext}</Text>
            </View>
          ) : null}

          {/* Dual voice badge */}
          {isDualVoice && (
            <View style={s.dualVoiceRow}>
              <View style={[s.dualVoiceBadge, { backgroundColor: "#9B59B615", borderColor: "#9B59B640" }]}>
                <Ionicons name="people-outline" size={14} color="#9B59B6" />
                <Text style={[s.dualVoiceTxt, { color: "#9B59B6" }]}>Dos voces · pausas naturales entre turnos</Text>
              </View>
            </View>
          )}

          {/* ── AUDIO PLAYER ── */}
          <View style={[s.playerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.playerLabel, { color: colors.textSecondary }]}>Controles de reproducción</Text>

            {/* Play / Pause button */}
            <View style={s.playerRow}>
              <Pressable
                onPress={isPlaying ? pauseAudio : playAudio}
                disabled={!canPlay && !isPlaying || audioLoading}
                style={({ pressed }) => [
                  s.playBtn,
                  { backgroundColor: themeColor, opacity: pressed || audioLoading ? 0.75 : 1 },
                ]}
              >
                {audioLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : isPlaying ? (
                  <Ionicons name="pause" size={28} color="#fff" />
                ) : (
                  <Ionicons name="play" size={28} color="#fff" />
                )}
              </Pressable>

              <View style={s.playerMeta}>
                <Text style={[s.playerStatus, { color: colors.text }]}>
                  {audioLoading
                    ? "Generando audio…"
                    : isPlaying
                    ? "Reproduciendo"
                    : playStatus === "paused"
                    ? "Pausado"
                    : playStatus === "ended"
                    ? "Finalizado"
                    : playStatus === "ready"
                    ? "Listo para reproducir"
                    : "Cargando…"}
                </Text>
                <Text style={[s.playerPlayCount, { color: colors.textSecondary }]}>
                  {unlimitedPlays
                    ? `Reproducciones: ${playCount}`
                    : `Reproducciones: ${playCount} / ${maxPlays}`}
                </Text>
                {!unlimitedPlays && playsLeft <= 1 && playCount > 0 && (
                  <Text style={{ color: "#FF4444", fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 }}>
                    {playsLeft <= 0 ? "Sin reproducciones restantes" : "Última reproducción"}
                  </Text>
                )}
              </View>
            </View>

            {/* Seek / Progress bar */}
            {durationMs > 0 && (
              <View style={s.seekWrap}>
                {/*
                  Tall transparent hit-area owns the Responder so locationX is
                  always relative to the full-width bar, never to a child.
                  All visual children are pointerEvents="none" so they can't
                  steal the touch and corrupt locationX.
                */}
                <View
                  style={s.seekHitArea}
                  onLayout={(e) => {
                    seekBarLayoutRef.current = { x: 0, width: e.nativeEvent.layout.width };
                  }}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onStartShouldSetResponderCapture={() => true}
                  onResponderGrant={(e) => handleSeekBar(e.nativeEvent.locationX)}
                  onResponderMove={(e) => handleSeekBar(e.nativeEvent.locationX)}
                >
                  {/* Visual track — pointer-events disabled so hit-area keeps locationX ownership */}
                  <View style={[s.seekTrack, { backgroundColor: colors.cardAlt }]} pointerEvents="none">
                    <View
                      pointerEvents="none"
                      style={[s.seekFill, {
                        width: `${(progressMs / durationMs) * 100}%` as any,
                        backgroundColor: themeColor,
                      }]}
                    />
                    <View
                      pointerEvents="none"
                      style={[s.seekThumb, {
                        left: `${(progressMs / durationMs) * 100}%` as any,
                        backgroundColor: themeColor,
                        borderColor: colors.card,
                      }]}
                    />
                  </View>
                </View>
                <View style={s.seekTimeRow}>
                  <Text style={[s.seekTime, { color: colors.textSecondary }]}>{formatTime(progressMs / playbackSpeed)}</Text>
                  <Text style={[s.seekTime, { color: colors.textSecondary }]}>{formatTime(durationMs / playbackSpeed)}</Text>
                </View>
              </View>
            )}

            {/* Speed selector */}
            <Text style={[s.speedLabel, { color: colors.textSecondary }]}>Velocidad de reproducción</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.speedRow}>
              {SPEED_OPTIONS.map((sp) => (
                <Pressable
                  key={sp}
                  onPress={() => handleSpeedChange(sp)}
                  style={[
                    s.speedBtn,
                    {
                      backgroundColor: playbackSpeed === sp ? themeColor : colors.cardAlt,
                      borderColor: playbackSpeed === sp ? themeColor : colors.border,
                    },
                  ]}
                >
                  <Text style={[s.speedBtnText, { color: playbackSpeed === sp ? "#fff" : colors.textSecondary }]}>
                    {sp}x
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Passage toggle */}
          <Pressable
            onPress={() => setShowPassage((v) => !v)}
            style={[s.togglePassageBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Ionicons name={showPassage ? "eye-off-outline" : "eye-outline"} size={16} color={themeColor} />
            <Text style={[s.togglePassageText, { color: themeColor }]}>
              {showPassage ? "Ocultar pasaje" : "Ver texto del pasaje"}
            </Text>
          </Pressable>

          {showPassage && (
            <View style={[s.passageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TappableText
                text={passage}
                textStyle={[s.passageCardText, { color: colors.text }]}
                onWordPress={(word, ctx) => setWordPopup({ word, context: ctx })}
              />
              <View style={[s.glossaryHint, { borderTopColor: colors.border }]}>
                <Ionicons name="finger-print-outline" size={12} color={themeColor} />
                <Text style={[s.glossaryHintText, { color: themeColor }]}>
                  Toca cualquier palabra para ver su significado
                </Text>
              </View>
            </View>
          )}

          {/* Generate questions button */}
          <Pressable
            onPress={generateQuestions}
            disabled={questionsLoading}
            style={({ pressed }) => [s.questionsBtn, { opacity: pressed || questionsLoading ? 0.8 : 1 }]}
          >
            <LinearGradient colors={[themeColor, selectedTheme.colorDark]} style={s.questionsBtnGrad}>
              {questionsLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="help-circle-outline" size={20} color="#fff" />
              )}
              <Text style={s.questionsBtnText}>
                {questionsLoading ? "Generando preguntas…" : "Generar preguntas de comprensión"}
              </Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // QUESTIONS PHASE
  // ═══════════════════════════════════════════════════════════════════════════════
  if (phase === "questions") {
    const q = questions[currentQIndex];
    const answered = q ? answers[q.id] : undefined;
    const progress = totalAnswered / questions.length;
    const isLastQ = currentQIndex === questions.length - 1;
    const qTypeColors: Record<string, string> = {
      "multiple-choice": "#3498DB",
      "true-false": "#2ECC71",
      "short-answer": "#E67E22",
      detail: "#9B59B6",
      inference: "#E74C3C",
    };
    const qColor = q ? (qTypeColors[q.type] ?? themeColor) : themeColor;

    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={isDark ? ["#0D1B2A", "#0F1117"] : ["#E8F4FD", "#F5F6FA"]} style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={[s.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => setPhase("listening")}
            style={({ pressed }) => [s.headerBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={[s.headerTitle, { color: colors.text }]}>Preguntas</Text>
            <Text style={[s.headerSub, { color: themeColor }]}>{passageTitle}</Text>
          </View>
          <Pressable onPress={handleExit} style={({ pressed }) => [s.headerBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="close" size={20} color="#FF4444" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[s.questionsContent, { paddingBottom: botPad + 32 }]} showsVerticalScrollIndicator={false}>
          {/* Progress bar (F38) */}
          <View style={[s.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.progressLabel, { color: colors.textSecondary }]}>
              {totalAnswered} / {questions.length} preguntas completadas
            </Text>
            <View style={[s.progressTrack, { backgroundColor: colors.cardAlt }]}>
              <View style={[s.progressFill, { backgroundColor: themeColor, width: `${Math.round(progress * 100)}%` as any }]} />
            </View>
            <View style={s.progressPips}>
              {questions.map((qq, i) => {
                const a = answers[qq.id];
                return (
                  <View
                    key={i}
                    style={[
                      s.pip,
                      {
                        backgroundColor: a ? (a.correct ? "#2ECC71" : "#FF4444") : i === currentQIndex ? themeColor : colors.cardAlt,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>

          {/* Audio replay mini-player */}
          <View style={[s.miniPlayer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable
              onPress={playStatus === "playing" ? pauseAudio : playAudio}
              style={[s.miniPlayBtn, { backgroundColor: themeColor }]}
            >
              <Ionicons name={playStatus === "playing" ? "pause" : "play"} size={16} color="#fff" />
            </Pressable>
            <Text style={[s.miniPlayerText, { color: colors.textSecondary }]}>Reproducir audio</Text>
            <Text style={[s.miniPlayerSpeed, { color: themeColor }]}>{playbackSpeed}x</Text>
          </View>

          {/* Current question */}
          {q && (
            <>
              <View style={[s.qCard, { backgroundColor: colors.card, borderColor: qColor + "50", borderLeftColor: qColor, borderLeftWidth: 4 }]}>
                <View style={s.qTypeRow}>
                  <View style={[s.qTypeBadge, { backgroundColor: qColor + "20" }]}>
                    <Text style={[s.qTypeBadgeText, { color: qColor }]}>
                      {q.type === "multiple-choice"
                        ? "Opción múltiple"
                        : q.type === "true-false"
                        ? "Verdadero / Falso"
                        : q.type === "short-answer"
                        ? "Respuesta corta"
                        : q.type === "detail"
                        ? "Detalle"
                        : "Inferencia"}
                    </Text>
                  </View>
                  <Text style={[s.qNumber, { color: colors.textSecondary }]}>
                    Pregunta {currentQIndex + 1} de {questions.length}
                  </Text>
                </View>
                <Text style={[s.qText, { color: colors.text }]}>{q.question}</Text>
              </View>

              {/* Options for MC and TF */}
              {q.options && !answered && (
                <View style={s.optionsContainer}>
                  {q.options.map((opt, i) => (
                    <Pressable
                      key={i}
                      onPress={() => setCurrentAnswer(opt)}
                      style={[
                        s.optionBtn,
                        {
                          backgroundColor: currentAnswer === opt ? qColor + "18" : colors.card,
                          borderColor: currentAnswer === opt ? qColor : colors.border,
                        },
                      ]}
                    >
                      <Text style={[s.optionText, { color: currentAnswer === opt ? qColor : colors.text }]}>{opt}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Text input for short-answer, detail, inference */}
              {!q.options && !answered && (
                <TextInput
                  style={[s.answerInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                  value={currentAnswer}
                  onChangeText={setCurrentAnswer}
                  placeholder="Escribe tu respuesta aquí…"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  textAlignVertical="top"
                  autoCorrect={false}
                />
              )}

              {/* Answered: show feedback */}
              {answered && (
                <View
                  style={[
                    s.feedbackCard,
                    {
                      backgroundColor: answered.correct ? "#2ECC7115" : "#FF444415",
                      borderColor: answered.correct ? "#2ECC71" : "#FF4444",
                    },
                  ]}
                >
                  <View style={s.feedbackHeader}>
                    <Ionicons
                      name={answered.correct ? "checkmark-circle" : "close-circle"}
                      size={20}
                      color={answered.correct ? "#2ECC71" : "#FF4444"}
                    />
                    <Text style={[s.feedbackResult, { color: answered.correct ? "#2ECC71" : "#FF4444" }]}>
                      {answered.correct ? "Correcto" : "Incorrecto"}
                    </Text>
                  </View>
                  <Text style={[s.feedbackText, { color: colors.text }]}>{answered.feedback}</Text>
                  {!answered.correct && (
                    <View style={s.correctAnswerRow}>
                      <Text style={[s.correctAnswerLabel, { color: colors.textSecondary }]}>Respuesta correcta: </Text>
                      <Text style={[s.correctAnswerText, { color: "#2ECC71" }]}>{q.correctAnswer}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Submit / Next */}
              {!answered ? (
                <Pressable
                  onPress={checkAnswer}
                  disabled={!currentAnswer.trim() || checkingAnswer}
                  style={({ pressed }) => [
                    s.submitBtn,
                    { opacity: pressed || !currentAnswer.trim() || checkingAnswer ? 0.5 : 1 },
                  ]}
                >
                  <LinearGradient colors={[qColor, qColor + "BB"]} style={s.submitGrad}>
                    {checkingAnswer ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Ionicons name="send" size={16} color="#fff" />
                    )}
                    <Text style={s.submitText}>{checkingAnswer ? "Verificando…" : "Enviar respuesta"}</Text>
                  </LinearGradient>
                </Pressable>
              ) : (
                <Pressable onPress={handleNextQuestion} style={({ pressed }) => [s.nextBtn, { opacity: pressed ? 0.85 : 1 }]}>
                  <LinearGradient colors={[themeColor, selectedTheme.colorDark]} style={s.nextGrad}>
                    <Text style={s.nextText}>{isLastQ ? "Ver resultados" : "Siguiente pregunta"}</Text>
                    <Ionicons name={isLastQ ? "checkmark-circle-outline" : "arrow-forward"} size={18} color="#fff" />
                  </LinearGradient>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // REVIEW PHASE
  // ═══════════════════════════════════════════════════════════════════════════════
  const pct = questions.length > 0 ? correctCount / questions.length : 0;
  const scoreColor = pct >= 0.75 ? "#2ECC71" : pct >= 0.5 ? "#E67E22" : "#FF4444";
  const bandLabel = pct >= 0.85 ? "Banda 7" : pct >= 0.7 ? "Banda 5-6" : pct >= 0.5 ? "Banda 4-5" : "Banda 3-4";

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={isDark ? ["#0D1B2A", "#0F1117"] : ["#E8F4FD", "#F5F6FA"]} style={StyleSheet.absoluteFill} />

      <View style={[s.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={{ width: 44 }} />
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: colors.text }]}>Resultados</Text>
          <Text style={[s.headerSub, { color: themeColor }]}>{passageTitle}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[s.reviewContent, { paddingBottom: botPad + 40 }]} showsVerticalScrollIndicator={false}>
        {/* Score ring */}
        <View style={[s.scoreRing, { borderColor: scoreColor }]}>
          <Text style={[s.scoreNum, { color: scoreColor }]}>{correctCount}/{questions.length}</Text>
          <Text style={[s.scoreLabel, { color: colors.textSecondary }]}>correctas</Text>
        </View>
        <View style={[s.bandBadge, { backgroundColor: scoreColor + "20", borderColor: scoreColor }]}>
          <Text style={[s.bandBadgeText, { color: scoreColor }]}>{bandLabel} estimada</Text>
        </View>

        {/* Question review */}
        <Text style={[s.reviewSectionTitle, { color: colors.text }]}>Revisión de respuestas</Text>
        {questions.map((q, i) => {
          const a = answers[q.id];
          if (!a) return null;
          return (
            <View key={q.id} style={[s.reviewCard, { backgroundColor: colors.card, borderColor: a.correct ? "#2ECC7140" : "#FF444440" }]}>
              <View style={s.reviewHeader}>
                <Ionicons name={a.correct ? "checkmark-circle" : "close-circle"} size={16} color={a.correct ? "#2ECC71" : "#FF4444"} />
                <Text style={[s.reviewQ, { color: colors.text }]}>
                  {i + 1}. {q.question}
                </Text>
              </View>
              <Text style={[s.reviewAnswer, { color: colors.textSecondary }]}>Tu respuesta: {a.given}</Text>
              {!a.correct && (
                <Text style={[s.reviewCorrect, { color: "#2ECC71" }]}>Correcta: {q.correctAnswer}</Text>
              )}
              <Text style={[s.reviewFeedback, { color: colors.textSecondary }]}>{a.feedback}</Text>
            </View>
          );
        })}

        {/* Return button */}
        <Pressable
          onPress={() => { cleanupAudio(); router.replace("/"); }}
          style={({ pressed }) => [s.homeBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <LinearGradient colors={[themeColor, selectedTheme.colorDark]} style={s.homeGrad}>
            <Ionicons name="home-outline" size={18} color="#fff" />
            <Text style={s.homeText}>Volver al inicio</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={() => { setPhase("setup"); setPassage(""); setManualPassage(""); setPassageTitle(""); setAudioBase64(null); setQuestions([]); setAnswers({}); setPlayStatus("idle"); setPlayCount(0); cleanupAudio(); }}
          style={({ pressed }) => [s.tryAgainBtn, { borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={[s.tryAgainText, { color: themeColor }]}>Nueva práctica</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },

  // Setup
  setupContent: { paddingHorizontal: 16, paddingTop: 20, gap: 14 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 2 },
  themeRow: { paddingVertical: 4, gap: 8 },
  themeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  themeChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeCard: { width: "47.5%", borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  typeLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  typeDesc: { fontSize: 11, fontFamily: "Inter_400Regular" },
  generateBtn: { borderRadius: 14, overflow: "hidden" },
  generateGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 15 },
  generateText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  passagePreview: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  passagePreviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  passagePreviewTitle: { fontSize: 14, fontFamily: "Inter_700Bold", flex: 1 },
  dualBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  dualBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  passageContext: { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  passagePreviewText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  pasteInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 120 },
  limitRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  limitLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  toggleText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  beginBtn: { borderRadius: 14, overflow: "hidden" },
  beginGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 17 },
  beginText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },

  // Listening
  listeningContent: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  contextCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  contextText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  dualVoiceRow: { alignItems: "center" },
  dualVoiceBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  dualVoiceTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  playerCard: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 14 },
  playerLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  playBtn: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  playerMeta: { flex: 1, gap: 3 },
  playerStatus: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  playerPlayCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  seekWrap: { gap: 4 },
  seekHitArea: { height: 44, justifyContent: "center" },   // 44pt min touch target; owns locationX
  seekTrack: { height: 6, borderRadius: 3, overflow: "visible", position: "relative" },
  seekFill: { position: "absolute", left: 0, top: 0, height: 6, borderRadius: 3 },
  seekThumb: { position: "absolute", top: -5, width: 16, height: 16, borderRadius: 8, marginLeft: -8, borderWidth: 2, elevation: 3, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  seekTimeRow: { flexDirection: "row", justifyContent: "space-between" },
  seekTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  speedLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  speedRow: { gap: 8, paddingVertical: 2 },
  speedBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  speedBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  togglePassageBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  togglePassageText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  passageCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  passageCardText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  glossaryHint: { flexDirection: "row", alignItems: "center", gap: 5, paddingTop: 8, borderTopWidth: 1 },
  glossaryHintText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  questionsBtn: { borderRadius: 14, overflow: "hidden" },
  questionsBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  questionsBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // Questions
  questionsContent: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  progressCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  progressLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressPips: { flexDirection: "row", gap: 6 },
  pip: { flex: 1, height: 6, borderRadius: 3 },
  miniPlayer: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, borderWidth: 1 },
  miniPlayBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  miniPlayerText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  miniPlayerSpeed: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  qCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  qTypeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  qTypeBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  qNumber: { fontSize: 12, fontFamily: "Inter_400Regular" },
  qText: { fontSize: 16, fontFamily: "Inter_400Regular", lineHeight: 24 },
  optionsContainer: { gap: 8 },
  optionBtn: { padding: 14, borderRadius: 10, borderWidth: 1 },
  optionText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  answerInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80 },
  feedbackCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  feedbackHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  feedbackResult: { fontSize: 15, fontFamily: "Inter_700Bold" },
  feedbackText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  correctAnswerRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  correctAnswerLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  correctAnswerText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  submitBtn: { borderRadius: 14, overflow: "hidden" },
  submitGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15 },
  submitText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  nextBtn: { borderRadius: 14, overflow: "hidden" },
  nextGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 15 },
  nextText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // Review
  reviewContent: { paddingHorizontal: 16, paddingTop: 24, gap: 14, alignItems: "stretch" },
  scoreRing: { alignSelf: "center", width: 120, height: 120, borderRadius: 60, borderWidth: 5, alignItems: "center", justifyContent: "center" },
  scoreNum: { fontSize: 30, fontFamily: "Inter_700Bold" },
  scoreLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  bandBadge: { alignSelf: "center", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  bandBadgeText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  reviewSectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 8 },
  reviewCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  reviewHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  reviewQ: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  reviewAnswer: { fontSize: 13, fontFamily: "Inter_400Regular" },
  reviewCorrect: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  reviewFeedback: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  homeBtn: { borderRadius: 14, overflow: "hidden" },
  homeGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  homeText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  tryAgainBtn: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  tryAgainText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
