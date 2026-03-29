import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { fetch as expoFetch } from "expo/fetch";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
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
import { PRACTICE_IMAGES, type PracticeImage } from "@/constants/practiceImages";
import { THEMES } from "@/constants/themes";

function getApiUrl() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/`;
  if (Platform.OS === "web") return "/";
  return "http://localhost:5000/";
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Phase = "select" | "prep" | "exam" | "feedback";
type RecordingState = "idle" | "recording" | "processing" | "preview";
type Message = { id: string; role: "user" | "assistant"; content: string; timestamp?: number };
type WordData = { phonetic: string; meaning: string; partOfSpeech: string } | null;
type CriterionScore = { score: number; label: string; feedback: string };
type FeedbackData = {
  criterionA: CriterionScore;
  criterionB: CriterionScore;
  criterionC: CriterionScore;
  criterionD?: CriterionScore;
  estimatedBand: string;
  strengths: string[];
  improvements: string[];
  encouragement: string;
};

// ── Constants ──────────────────────────────────────────────────────────────────
const PREP_SECONDS = 10 * 60;
const EXAM_DURATION_OPTIONS = [1, 2, 3, 5, 7, 10]; // minutes
const generateId = () => Math.random().toString(36).slice(2);
const imgAudioCache = new Map<string, string>();

function getBestMimeType(): string {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const t of types) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "audio/webm";
}

// ── Typing dots ────────────────────────────────────────────────────────────────
function TypingDots({ color }: { color: string }) {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      )
    );
    Animated.parallel(anims).start();
  }, []);
  return (
    <View style={{ flexDirection: "row", gap: 4, padding: 10 }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, opacity: d }} />
      ))}
    </View>
  );
}

// ── Image card (selection grid) ────────────────────────────────────────────────
function ImageCard({
  img,
  themeColor,
  onPress,
}: {
  img: PracticeImage;
  themeColor: string;
  onPress: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const uri = errored ? img.fallbackUrl : img.url;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        imgStyles.card,
        { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={imgStyles.imgWrapper}>
        {!loaded && <ActivityIndicator style={StyleSheet.absoluteFill} color={themeColor} />}
        <Image
          source={{ uri }}
          style={imgStyles.img}
          resizeMode="cover"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (!errored) { setErrored(true); setLoaded(false); }
          }}
        />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} style={imgStyles.imgGrad} />
        <Text style={imgStyles.imgCaption} numberOfLines={2}>{img.caption}</Text>
      </View>
    </Pressable>
  );
}

const imgStyles = StyleSheet.create({
  card: { borderRadius: 12, overflow: "hidden", borderWidth: 1 },
  imgWrapper: { width: "100%", height: 130, position: "relative" },
  img: { width: "100%", height: "100%" },
  imgGrad: { ...StyleSheet.absoluteFillObject, top: "40%" },
  imgCaption: { position: "absolute", bottom: 8, left: 8, right: 8, fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

// ── Word explanation modal (F30) ───────────────────────────────────────────────
function WordModal({
  word,
  data,
  loading,
  onClose,
  onPlayTTS,
}: {
  word: string;
  data: WordData;
  loading: boolean;
  onClose: () => void;
  onPlayTTS: (text: string, id?: string) => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={wm.overlay} onPress={onClose}>
        <Pressable style={[wm.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
          <View style={wm.wordRow}>
            <Text style={[wm.word, { color: colors.text }]}>{word}</Text>
            {data && (
              <Pressable onPress={() => onPlayTTS(word)} style={wm.speakBtn}>
                <Ionicons name="volume-high" size={18} color="#C9A84C" />
              </Pressable>
            )}
          </View>
          {loading ? (
            <ActivityIndicator color="#C9A84C" style={{ marginTop: 12 }} />
          ) : data ? (
            <>
              <Text style={[wm.phonetic, { color: "#C9A84C" }]}>{data.phonetic}</Text>
              <Text style={[wm.pos, { color: colors.textSecondary }]}>{data.partOfSpeech}</Text>
              <Text style={[wm.meaning, { color: colors.text }]}>{data.meaning}</Text>
            </>
          ) : (
            <Text style={[wm.meaning, { color: colors.textSecondary }]}>No se pudo cargar la explicación.</Text>
          )}
          <Pressable onPress={onClose} style={[wm.closeBtn, { borderColor: colors.border }]}>
            <Text style={[wm.closeTxt, { color: colors.textSecondary }]}>Cerrar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
const wm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  card: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 20, gap: 6 },
  wordRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  word: { fontSize: 22, fontFamily: "Inter_700Bold" },
  speakBtn: { padding: 6 },
  phonetic: { fontSize: 15, fontFamily: "Inter_400Regular" },
  pos: { fontSize: 12, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.8 },
  meaning: { fontSize: 16, fontFamily: "Inter_400Regular", lineHeight: 22, marginTop: 4 },
  closeBtn: { marginTop: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  closeTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});

// ── Score bar (feedback phase) ─────────────────────────────────────────────────
function ScoreBar({ score, color }: { score: number; color: string }) {
  const pct = Math.min(Math.max(score / 10, 0), 1);
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden", marginTop: 6 }}>
      <View style={{ width: `${Math.round(pct * 100)}%` as any, height: "100%", borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

// ── Tappable AI message text (F30) ─────────────────────────────────────────────
function TappableText({
  content,
  textStyle,
  onWordPress,
}: {
  content: string;
  textStyle: object;
  onWordPress: (word: string, context: string) => void;
}) {
  const words = content.split(/(\s+)/);
  return (
    <Text style={textStyle}>
      {words.map((chunk, i) => {
        if (/^\s+$/.test(chunk)) return chunk;
        const clean = chunk.replace(/[¿¡.,;:!?()"""«»]/g, "");
        if (!clean) return chunk;
        return (
          <Text
            key={i}
            onPress={() => onWordPress(clean, content)}
          >
            {chunk}
          </Text>
        );
      })}
    </Text>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function ImagePracticeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // ── Phase state ──────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("select");
  const [level, setLevel] = useState<"b" | "ab_initio">("b");
  const [selectedThemeId, setSelectedThemeId] = useState(THEMES[0].id);
  const [selectedImage, setSelectedImage] = useState<PracticeImage | null>(null);

  // ── Prep timer (F29) ─────────────────────────────────────────────────────────
  const [prepStarted, setPrepStarted] = useState(false);
  const [prepTimeLeft, setPrepTimeLeft] = useState(PREP_SECONDS);
  const prepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPrepTimer = () => {
    setPrepStarted(true);
    setPrepTimeLeft(PREP_SECONDS);
    prepTimerRef.current = setInterval(() => {
      setPrepTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(prepTimerRef.current!);
          beginExam();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const skipPrep = () => {
    if (prepTimerRef.current) clearInterval(prepTimerRef.current);
    beginExam();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // ── Exam timer (F33) ─────────────────────────────────────────────────────────
  const [examSeconds, setExamSeconds] = useState(5 * 60); // user-configurable
  const [examTimeLeft, setExamTimeLeft] = useState(5 * 60);
  const [examTimerRunning, setExamTimerRunning] = useState(false);
  const [examTimeUp, setExamTimeUp] = useState(false);
  const examTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startExamTimer = useCallback(() => {
    if (examTimerRunning) return;
    setExamTimerRunning(true);
    examTimerRef.current = setInterval(() => {
      setExamTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(examTimerRef.current!);
          setExamTimeUp(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [examTimerRunning]);

  // ── Exam chat state ──────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [sessionTurn, setSessionTurn] = useState(0);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);

  // ── Recording state ──────────────────────────────────────────────────────────
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [micError, setMicError] = useState<string | null>(null);

  // ── Word modal (F30) ─────────────────────────────────────────────────────────
  const [wordPopup, setWordPopup] = useState<{ word: string; ctx: string } | null>(null);
  const [wordData, setWordData] = useState<WordData>(null);
  const [wordLoading, setWordLoading] = useState(false);

  // ── Feedback (F32) ───────────────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // ── Image full-screen modal (F31) ────────────────────────────────────────────
  const [imgModalVisible, setImgModalVisible] = useState(false);
  const imgModalOpacity = useRef(new Animated.Value(0)).current;
  const imgModalScale = useRef(new Animated.Value(0.88)).current;

  const openImageModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImgModalVisible(true);
    Animated.parallel([
      Animated.timing(imgModalOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(imgModalScale, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 220 }),
    ]).start();
  };

  const closeImageModal = () => {
    Animated.parallel([
      Animated.timing(imgModalOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(imgModalScale, { toValue: 0.88, duration: 180, useNativeDriver: true }),
    ]).start(() => setImgModalVisible(false));
  };

  // ── Image error tracking ─────────────────────────────────────────────────────
  const [imageErrored, setImageErrored] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const nativeRecordingRef = useRef<Audio.Recording | null>(null);
  const nativeSoundRef = useRef<Audio.Sound | null>(null);
  const webMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const webAudioChunksRef = useRef<Blob[]>([]);
  const webMimeTypeRef = useRef<string>("audio/webm");
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const initializedRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  useEffect(() => {
    if (recordingState === "recording") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      ringOpacity.stopAnimation();
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      Animated.timing(ringOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [recordingState]);

  const beginExam = () => {
    setExamTimeLeft(examSeconds);
    setPhase("exam");
  };

  useEffect(() => {
    if (phase === "exam" && !initializedRef.current && selectedImage) {
      initializedRef.current = true;
      sendToAI([]);
    }
  }, [phase, selectedImage]);

  // ── TTS ───────────────────────────────────────────────────────────────────────
  const playAudioBase64 = useCallback(async (audioBase64: string) => {
    if (Platform.OS === "web") {
      if (webAudioRef.current) { webAudioRef.current.pause(); webAudioRef.current.src = ""; webAudioRef.current = null; }
      setIsTTSPlaying(true);
      const audio = new (window as any).Audio(`data:audio/mp3;base64,${audioBase64}`) as HTMLAudioElement;
      webAudioRef.current = audio;
      audio.onended = () => { setIsTTSPlaying(false); webAudioRef.current = null; };
      audio.onerror = () => setIsTTSPlaying(false);
      await audio.play();
    } else {
      if (nativeSoundRef.current) { await nativeSoundRef.current.unloadAsync().catch(() => {}); nativeSoundRef.current = null; }
      setIsTTSPlaying(true);
      await Audio.setAudioModeAsync({ staysActiveInBackground: true, playsInSilentModeIOS: true, allowsRecordingIOS: false });
      const path = (FileSystem.cacheDirectory ?? "") + "img_tts.mp3";
      await FileSystem.writeAsStringAsync(path, audioBase64, { encoding: "base64" });
      const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
      nativeSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) { setIsTTSPlaying(false); sound.unloadAsync().catch(() => {}); }
      });
    }
  }, []);

  const playTTS = useCallback(
    async (text: string, msgId?: string) => {
      try {
        if (msgId && imgAudioCache.has(msgId)) { await playAudioBase64(imgAudioCache.get(msgId)!); return; }
        setIsTTSPlaying(true);
        const res = await globalThis.fetch(`${getApiUrl()}api/exam/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error("TTS failed");
        const { audioBase64 } = await res.json();
        if (!audioBase64) throw new Error("No audio");
        if (msgId) imgAudioCache.set(msgId, audioBase64);
        await playAudioBase64(audioBase64);
      } catch (e) {
        console.error("TTS error:", e);
        setIsTTSPlaying(false);
      }
    },
    [playAudioBase64]
  );

  // ── Word translation (F30) ───────────────────────────────────────────────────
  const handleWordPress = async (word: string, ctx: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWordPopup({ word, ctx });
    setWordData(null);
    setWordLoading(true);
    try {
      const res = await globalThis.fetch(`${getApiUrl()}api/exam/word`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, context: ctx }),
      });
      if (!res.ok) throw new Error("word api error");
      setWordData(await res.json());
    } catch {
      setWordData(null);
    } finally {
      setWordLoading(false);
    }
  };

  // ── AI chat ───────────────────────────────────────────────────────────────────
  const sendToAI = useCallback(
    async (chatMessages: Message[], rephrase = false, skip = false) => {
      if (!selectedImage) return;
      setIsStreaming(true);
      setShowTyping(true);

      try {
        const apiMessages = chatMessages.map((m) => ({ role: m.role, content: m.content }));
        const response = await expoFetch(`${getApiUrl()}api/exam/image-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({
            messages: apiMessages,
            theme: selectedImage.themeId,
            imageDescription: selectedImage.description,
            imageCaption: selectedImage.caption,
            sessionTurn,
            rephrase,
            skip,
          }),
        });

        if (!response.ok) throw new Error("Failed to get response");
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let fullContent = "";
        let buffer = "";
        let assistantAdded = false;
        let assistantMsgId = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                if (!assistantAdded) {
                  assistantMsgId = generateId();
                  setShowTyping(false);
                  setMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: fullContent, timestamp: Date.now() }]);
                  assistantAdded = true;
                  // Start exam timer on first AI message (F33)
                  startExamTimer();
                } else {
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
                    return updated;
                  });
                }
              }
            } catch {}
          }
        }

        // Auto-play TTS for the AI response when streaming is complete
        if (fullContent && assistantMsgId) {
          playTTS(fullContent, assistantMsgId);
        }
      } catch {
        setShowTyping(false);
        setMessages((prev) => [
          ...prev,
          { id: generateId(), role: "assistant", content: "Lo siento, hubo un error. Por favor intenta de nuevo." },
        ]);
      } finally {
        setIsStreaming(false);
        setShowTyping(false);
        const hasUser = chatMessages.some((m) => m.role === "user");
        if (hasUser) setSessionTurn((t) => t + 1);
      }
    },
    [selectedImage, sessionTurn, playTTS, startExamTimer]
  );

  // ── Question controls (F31) ──────────────────────────────────────────────────
  const handleRepeat = (msg: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playTTS(msg.content, msg.id);
  };

  const handleRephrase = () => {
    if (isStreaming || examTimeUp) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendToAI(messages, true, false);
  };

  const handleSkipQuestion = () => {
    if (isStreaming || examTimeUp) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendToAI(messages, false, true);
  };

  // ── Recording (web) ──────────────────────────────────────────────────────────
  const startRecordingWeb = async () => {
    try {
      setMicError(null);
      if (!navigator.mediaDevices?.getUserMedia) { setMicError("Tu navegador no soporta grabación."); return; }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getBestMimeType();
      webMimeTypeRef.current = mimeType;
      const mr = new MediaRecorder(stream, { mimeType });
      webAudioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) webAudioChunksRef.current.push(e.data); };
      mr.start(250);
      webMediaRecorderRef.current = mr;
      setRecordingState("recording");
    } catch { setMicError("No se pudo acceder al micrófono."); }
  };

  const stopRecordingWeb = async () => {
    const mr = webMediaRecorderRef.current;
    if (!mr || mr.state === "inactive") return;
    setRecordingState("processing");
    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      mr.stop();
      mr.stream.getTracks().forEach((t) => t.stop());
    });
    const blob = new Blob(webAudioChunksRef.current, { type: webMimeTypeRef.current });
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const b64 = btoa(binary);
    await transcribeAndPreview(b64, "audio.webm");
  };

  // ── Recording (native) ────────────────────────────────────────────────────────
  const startRecordingNative = async () => {
    try {
      setMicError(null);
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      nativeRecordingRef.current = recording;
      setRecordingState("recording");
    } catch { setMicError("No se pudo acceder al micrófono."); }
  };

  const stopRecordingNative = async () => {
    const rec = nativeRecordingRef.current;
    if (!rec) return;
    setRecordingState("processing");
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      nativeRecordingRef.current = null;
      if (!uri) return;
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
      const ext = uri.split(".").pop() || "m4a";
      await transcribeAndPreview(b64, `audio.${ext}`);
    } catch { setRecordingState("idle"); }
  };

  const transcribeAndPreview = async (audioBase64: string, filename: string) => {
    try {
      const res = await globalThis.fetch(`${getApiUrl()}api/exam/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, filename }),
      });
      if (!res.ok) throw new Error("Transcription failed");
      const { text } = await res.json();
      if (text?.trim()) { setTranscript(text.trim()); setRecordingState("preview"); }
      else setRecordingState("idle");
    } catch { setRecordingState("idle"); }
  };

  const handleMicPress = () => {
    if (isStreaming || isTTSPlaying || examTimeUp) return;
    if (recordingState === "idle") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Platform.OS === "web" ? startRecordingWeb() : startRecordingNative();
    } else if (recordingState === "recording") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Platform.OS === "web" ? stopRecordingWeb() : stopRecordingNative();
    }
  };

  const handleSendTranscript = async () => {
    const text = transcript.trim();
    if (!text || isStreaming) return;
    setTranscript("");
    setRecordingState("idle");
    const userMsg: Message = { id: generateId(), role: "user", content: text, timestamp: Date.now() };
    const currentMessages = [...messages];
    setMessages((prev) => [...prev, userMsg]);
    if (!examTimeUp) {
      await sendToAI([...currentMessages, userMsg]);
    }
  };

  const handleDeleteTranscript = () => { setTranscript(""); setRecordingState("idle"); };

  // ── Feedback generation (F32) ─────────────────────────────────────────────────
  const generateFeedback = useCallback(async () => {
    if (!selectedImage || feedbackLoading) return;
    setFeedbackLoading(true);
    setPhase("feedback");
    try {
      const res = await globalThis.fetch(`${getApiUrl()}api/exam/image-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          imageCaption: selectedImage.caption,
          theme: selectedImage.themeId,
          level,
        }),
      });
      if (!res.ok) throw new Error("feedback failed");
      setFeedback(await res.json());
    } catch {
      setFeedback(null);
    } finally {
      setFeedbackLoading(false);
    }
  }, [selectedImage, messages, feedbackLoading, level]);

  // ── Exit with confirmation (F34) ──────────────────────────────────────────────
  const cleanupAudio = () => {
    if (prepTimerRef.current) clearInterval(prepTimerRef.current);
    if (examTimerRef.current) clearInterval(examTimerRef.current);
    nativeSoundRef.current?.unloadAsync().catch(() => {});
    nativeRecordingRef.current?.stopAndUnloadAsync().catch(() => {});
    if (webAudioRef.current) { webAudioRef.current.pause(); webAudioRef.current.src = ""; }
  };

  const handleExit = () => {
    if (phase === "select") { router.back(); return; }
    if (Platform.OS === "web") {
      if (window.confirm("¿Quieres terminar la práctica?")) {
        cleanupAudio();
        router.replace("/");
      }
    } else {
      Alert.alert(
        "Terminar práctica",
        "¿Quieres terminar la práctica?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Sí, terminar",
            style: "destructive",
            onPress: () => { cleanupAudio(); router.replace("/"); },
          },
        ]
      );
    }
  };

  const selectedTheme = THEMES.find((t) => t.id === selectedThemeId) ?? THEMES[0];
  const themeImages = PRACTICE_IMAGES.filter((img) => img.themeId === selectedThemeId);
  const themeColor = selectedTheme.color;
  const activeTheme = THEMES.find((t) => t.id === selectedImage?.themeId) ?? THEMES[0];
  const activeColor = activeTheme.color;

  const imageUri = imageErrored ? (selectedImage?.fallbackUrl ?? selectedImage?.url) : selectedImage?.url;
  const examUrgentColor = examTimeLeft < 60 ? "#FF4444" : examTimeLeft < 120 ? "#FF9900" : activeColor;
  const micDisabled = isStreaming || recordingState === "processing" || recordingState === "preview" || examTimeUp;

  // ── SELECT PHASE ──────────────────────────────────────────────────────────────
  if (phase === "select") {
    return (
      <View style={[sc.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={isDark ? ["#1A1030", "#0F1117"] : ["#F0EDFF", "#F5F6FA"]} style={StyleSheet.absoluteFill} />
        <View style={[sc.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [sc.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <View style={sc.headerCenter}>
            <Text style={[sc.headerTitle, { color: colors.text }]}>Descripción de imagen</Text>
            <Text style={[sc.headerSub, { color: colors.textSecondary }]}>Elige un tema y luego una imagen</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sc.themeTabs} style={sc.themeTabsScroll}>
          {THEMES.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setSelectedThemeId(t.id)}
              style={[
                sc.themeTab,
                {
                  borderColor: selectedThemeId === t.id ? t.color : colors.border,
                  backgroundColor: selectedThemeId === t.id ? t.color + "18" : colors.card,
                },
              ]}
            >
              <Ionicons name={t.iconName as any} size={16} color={selectedThemeId === t.id ? t.color : colors.textSecondary} />
              <Text style={[sc.themeTabText, { color: selectedThemeId === t.id ? t.color : colors.textSecondary }]}>{t.nameShort}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={sc.imageGrid} showsVerticalScrollIndicator={false}>
          <Text style={[sc.sectionLabel, { color: colors.textSecondary }]}>Selecciona una imagen para practicar</Text>
          <View style={sc.grid}>
            {themeImages.map((img) => (
              <View key={img.id} style={sc.gridCell}>
                <ImageCard
                  img={img}
                  themeColor={themeColor}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setSelectedImage(img);
                    setImageErrored(false);
                    setPhase("prep");
                  }}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── PREP PHASE ────────────────────────────────────────────────────────────────
  if (phase === "prep" && selectedImage) {
    const pct = prepTimeLeft / PREP_SECONDS;
    const urgentColor = prepTimeLeft < 60 ? "#FF4444" : prepTimeLeft < 180 ? "#FF9900" : themeColor;
    return (
      <View style={[sc.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={isDark ? ["#1A1030", "#0F1117"] : ["#F0EDFF", "#F5F6FA"]} style={StyleSheet.absoluteFill} />
        <View style={[sc.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <Pressable onPress={handleExit} style={({ pressed }) => [sc.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="close" size={22} color="#FF4444" />
          </Pressable>
          <View style={sc.headerCenter}>
            <Text style={[sc.headerTitle, { color: colors.text }]}>Tiempo de preparación</Text>
            <Text style={[sc.headerSub, { color: colors.textSecondary }]}>{level === "ab_initio" ? "Ab Initio" : "Spanish B"} • {selectedTheme.name}</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={[sc.prepContent, { paddingBottom: botPad + 24 }]} showsVerticalScrollIndicator={false}>
          {/* Image — tap to expand */}
          <Pressable onPress={openImageModal} style={sc.prepImageWrapper}>
            <Image
              source={{ uri: imageUri ?? selectedImage.url }}
              style={sc.prepImage}
              resizeMode="cover"
              onError={() => setImageErrored(true)}
            />
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} style={sc.prepImageGrad} />
            <Text style={sc.prepImageCaption}>{selectedImage.caption}</Text>
            <View style={sc.prepImageZoomBadge}>
              <Ionicons name="expand-outline" size={14} color="#fff" />
            </View>
          </Pressable>

          {/* Timer card — only when started */}
          {prepStarted && (
            <>
              <View style={[sc.timerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="timer-outline" size={22} color={urgentColor} />
                <View style={{ flex: 1 }}>
                  <Text style={[sc.timerLabel, { color: colors.textSecondary }]}>Tiempo de preparación</Text>
                  <Text style={[sc.timerValue, { color: urgentColor }]}>{formatTime(prepTimeLeft)}</Text>
                </View>
              </View>
              <View style={[sc.timerTrack, { backgroundColor: colors.cardAlt }]}>
                <Animated.View
                  style={[sc.timerFill, { backgroundColor: urgentColor, width: `${Math.round(pct * 100)}%` as any }]}
                />
              </View>
            </>
          )}

          {/* Instructions */}
          <View style={[sc.instructCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[sc.instructTitle, { color: colors.text }]}>Cómo prepararte</Text>
            {[
              "Observa la imagen con atención — personas, acciones, entorno",
              "Identifica el tema principal y cómo se relaciona con " + selectedTheme.name,
              "Prepara vocabulario específico del tema",
              "Piensa en datos culturales o sociales relevantes",
              "Considera distintas perspectivas sobre lo que ves",
            ].map((tip, i) => (
              <View key={i} style={sc.tipRow}>
                <View style={[sc.tipNum, { backgroundColor: themeColor + "20" }]}>
                  <Text style={[sc.tipNumText, { color: themeColor }]}>{i + 1}</Text>
                </View>
                <Text style={[sc.tipText, { color: colors.text }]}>{tip}</Text>
              </View>
            ))}
          </View>

          {/* Exam duration selector */}
          {!prepStarted && (
            <View style={[sc.durationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={sc.durationHeader}>
                <Ionicons name="hourglass-outline" size={18} color={themeColor} />
                <Text style={[sc.durationTitle, { color: colors.text }]}>Tiempo de examen</Text>
              </View>
              <View style={sc.durationRow}>
                {EXAM_DURATION_OPTIONS.map((mins) => {
                  const secs = mins * 60;
                  const active = examSeconds === secs;
                  return (
                    <Pressable
                      key={mins}
                      onPress={() => setExamSeconds(secs)}
                      style={[
                        sc.durationBtn,
                        {
                          backgroundColor: active ? themeColor : colors.cardAlt,
                          borderColor: active ? themeColor : colors.border,
                        },
                      ]}
                    >
                      <Text style={[sc.durationBtnText, { color: active ? "#fff" : colors.textSecondary }]}>
                        {mins}m
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Start timer button (F29) */}
          {!prepStarted ? (
            <Pressable onPress={startPrepTimer} style={({ pressed }) => [sc.startTimerBtn, { opacity: pressed ? 0.85 : 1 }]}>
              <LinearGradient colors={[themeColor, selectedTheme.colorDark]} style={sc.startTimerGrad}>
                <Ionicons name="play-circle-outline" size={22} color="#fff" />
                <Text style={sc.startTimerText}>Iniciar 10 minutos de preparación</Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable onPress={skipPrep} style={({ pressed }) => [sc.skipPrepBtn, { opacity: pressed ? 0.85 : 1 }]}>
              <LinearGradient colors={[themeColor, selectedTheme.colorDark]} style={sc.skipPrepGrad}>
                <Ionicons name="play-skip-forward-outline" size={20} color="#fff" />
                <Text style={sc.skipPrepText}>Iniciar examen ahora</Text>
              </LinearGradient>
            </Pressable>
          )}
        </ScrollView>

        {/* Image full-screen modal (F31) */}
        <Modal transparent visible={imgModalVisible} onRequestClose={closeImageModal} statusBarTranslucent>
          <Animated.View style={[sc.imgModalOverlay, { opacity: imgModalOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeImageModal} />
            <Animated.View style={{ transform: [{ scale: imgModalScale }], width: "92%", maxWidth: 500 }}>
              <Image
                source={{ uri: imageUri ?? selectedImage.url }}
                style={sc.imgModalImage}
                resizeMode="contain"
              />
              <Text style={sc.imgModalCaption}>{selectedImage.caption}</Text>
            </Animated.View>
            <Pressable onPress={closeImageModal} style={sc.imgModalClose}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </Animated.View>
        </Modal>
      </View>
    );
  }

  // ── FEEDBACK PHASE (F32) ──────────────────────────────────────────────────────
  if (phase === "feedback") {
    const criteria = feedback
      ? [feedback.criterionA, feedback.criterionB, feedback.criterionC, feedback.criterionD].filter((c): c is CriterionScore => c !== undefined)
      : [];

    // Compute per-question response times and answer lengths
    const timingRows: { label: string; seconds: number; words: number }[] = [];
    let qNum = 0;
    for (let i = 0; i < messages.length - 1; i++) {
      const a = messages[i];
      const u = messages[i + 1];
      if (a.role === "assistant" && u.role === "user" && a.timestamp && u.timestamp) {
        qNum++;
        const secs = Math.round((u.timestamp - a.timestamp) / 1000);
        const words = u.content.trim().split(/\s+/).filter(Boolean).length;
        timingRows.push({ label: `Pregunta ${qNum}`, seconds: secs, words });
      }
    }
    const avgTime = timingRows.length > 0
      ? Math.round(timingRows.reduce((s, r) => s + r.seconds, 0) / timingRows.length)
      : null;
    const avgWords = timingRows.length > 0
      ? Math.round(timingRows.reduce((s, r) => s + r.words, 0) / timingRows.length)
      : null;
    const bandColors: Record<string, string> = {
      A: "#9B59B6", B: "#2ECC71", C: "#3498DB", D: "#E67E22",
    };
    const bandKeys = ["A", "B", "C", "D"];

    return (
      <View style={[sc.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={isDark ? ["#1A1030", "#0F1117"] : ["#F0EDFF", "#F5F6FA"]} style={StyleSheet.absoluteFill} />
        <View style={[sc.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={{ width: 44 }} />
          <View style={sc.headerCenter}>
            <Text style={[sc.headerTitle, { color: colors.text }]}>Resultados IB</Text>
            <Text style={[sc.headerSub, { color: activeColor }]}>{level === "ab_initio" ? "Ab Initio" : "Spanish B"} • {selectedImage?.caption ?? ""}</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={[sc.feedbackContent, { paddingBottom: botPad + 32 }]} showsVerticalScrollIndicator={false}>
          {/* Image thumbnail */}
          {selectedImage && (
            <Pressable onPress={openImageModal} style={sc.fbThumbWrapper}>
              <Image source={{ uri: imageUri ?? selectedImage.url }} style={sc.fbThumb} resizeMode="cover" />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.65)"]} style={StyleSheet.absoluteFillObject} />
              <Text style={sc.fbThumbCaption}>{selectedImage.caption}</Text>
              <View style={sc.prepImageZoomBadge}>
                <Ionicons name="expand-outline" size={14} color="#fff" />
              </View>
            </Pressable>
          )}

          {feedbackLoading ? (
            <View style={sc.fbLoadingBox}>
              <ActivityIndicator size="large" color={activeColor} />
              <Text style={[sc.fbLoadingText, { color: colors.textSecondary }]}>Analizando tu examen oral…</Text>
              <Text style={[sc.fbLoadingSubText, { color: colors.textSecondary }]}>Evaluando criterios IB A · B · C · D</Text>
            </View>
          ) : feedback ? (
            <>
              {/* Band pill */}
              <View style={sc.bandPillRow}>
                <View style={[sc.bandPill, { backgroundColor: activeColor + "22", borderColor: activeColor }]}>
                  <Text style={[sc.bandPillText, { color: activeColor }]}>Banda estimada: {feedback.estimatedBand}</Text>
                </View>
              </View>

              {/* Criteria */}
              {criteria.map((c, i) => (
                <View key={i} style={[sc.criterionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={sc.criterionHeader}>
                    <View style={[sc.criterionBadge, { backgroundColor: bandColors[bandKeys[i]] + "22" }]}>
                      <Text style={[sc.criterionBadgeText, { color: bandColors[bandKeys[i]] }]}>Criterio {bandKeys[i]}</Text>
                    </View>
                    <Text style={[sc.criterionLabel, { color: colors.text }]}>{c.label}</Text>
                    <Text style={[sc.criterionScore, { color: bandColors[bandKeys[i]] }]}>{c.score}/10</Text>
                  </View>
                  <ScoreBar score={c.score} color={bandColors[bandKeys[i]]} />
                  <Text style={[sc.criterionFeedback, { color: colors.textSecondary }]}>{c.feedback}</Text>
                </View>
              ))}

              {/* Strengths */}
              <View style={[sc.listCard, { backgroundColor: colors.card, borderColor: "#2ECC7140" }]}>
                <Text style={[sc.listCardTitle, { color: "#2ECC71" }]}>Fortalezas</Text>
                {feedback.strengths.map((s, i) => (
                  <View key={i} style={sc.listRow}>
                    <Ionicons name="checkmark-circle" size={15} color="#2ECC71" />
                    <Text style={[sc.listRowText, { color: colors.text }]}>{s}</Text>
                  </View>
                ))}
              </View>

              {/* Improvements */}
              <View style={[sc.listCard, { backgroundColor: colors.card, borderColor: "#FF9900" + "40" }]}>
                <Text style={[sc.listCardTitle, { color: "#FF9900" }]}>Áreas de mejora</Text>
                {feedback.improvements.map((imp, i) => (
                  <View key={i} style={sc.listRow}>
                    <Ionicons name="arrow-up-circle" size={15} color="#FF9900" />
                    <Text style={[sc.listRowText, { color: colors.text }]}>{imp}</Text>
                  </View>
                ))}
              </View>

              {/* Encouragement */}
              {feedback.encouragement && (
                <View style={[sc.encourageCard, { backgroundColor: activeColor + "15", borderColor: activeColor + "40" }]}>
                  <Ionicons name="star" size={18} color={activeColor} />
                  <Text style={[sc.encourageText, { color: activeColor }]}>{feedback.encouragement}</Text>
                </View>
              )}
            </>
          ) : (
            <View style={sc.fbLoadingBox}>
              <Text style={[sc.fbLoadingText, { color: colors.textSecondary }]}>No se pudo generar el feedback.</Text>
            </View>
          )}

          {/* Timing stats */}
          {timingRows.length > 0 && (
            <View style={[sc.listCard, { backgroundColor: colors.card, borderColor: "#3498DB40" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Ionicons name="timer-outline" size={16} color="#3498DB" />
                <Text style={[sc.listCardTitle, { color: "#3498DB", marginBottom: 0 }]}>Tiempos de respuesta</Text>
              </View>
              {timingRows.map((r, i) => (
                <View key={i} style={[sc.listRow, { justifyContent: "space-between" }]}>
                  <Text style={[sc.listRowText, { color: colors.textSecondary, flex: 1 }]}>{r.label}</Text>
                  <Text style={[sc.listRowText, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
                    {r.seconds}s · {r.words} palabras
                  </Text>
                </View>
              ))}
              {avgTime !== null && (
                <View style={[sc.listRow, { justifyContent: "space-between", marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Text style={[sc.listRowText, { color: colors.text, fontFamily: "Inter_600SemiBold", flex: 1 }]}>Promedio</Text>
                  <Text style={[sc.listRowText, { color: "#3498DB", fontFamily: "Inter_600SemiBold" }]}>
                    {avgTime}s · {avgWords} palabras
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Back to home */}
          <Pressable
            onPress={() => { cleanupAudio(); router.replace("/"); }}
            style={({ pressed }) => [sc.fbHomeBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient colors={[activeColor, activeTheme.colorDark]} style={sc.fbHomeGrad}>
              <Ionicons name="home-outline" size={18} color="#fff" />
              <Text style={sc.fbHomeText}>Volver al inicio</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>

        {/* Image full-screen modal (F31) */}
        {selectedImage && (
          <Modal transparent visible={imgModalVisible} onRequestClose={closeImageModal} statusBarTranslucent>
            <Animated.View style={[sc.imgModalOverlay, { opacity: imgModalOpacity }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={closeImageModal} />
              <Animated.View style={{ transform: [{ scale: imgModalScale }], width: "92%", maxWidth: 500 }}>
                <Image
                  source={{ uri: imageUri ?? selectedImage.url }}
                  style={sc.imgModalImage}
                  resizeMode="contain"
                />
                <Text style={sc.imgModalCaption}>{selectedImage.caption}</Text>
              </Animated.View>
              <Pressable onPress={closeImageModal} style={sc.imgModalClose}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
            </Animated.View>
          </Modal>
        )}
      </View>
    );
  }

  // ── EXAM PHASE ────────────────────────────────────────────────────────────────
  const lastAiMsg = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <View style={[sc.container, { backgroundColor: colors.background }]}>
      {/* Word modal (F30) */}
      {wordPopup && (
        <WordModal
          word={wordPopup.word}
          data={wordData}
          loading={wordLoading}
          onClose={() => { setWordPopup(null); setWordData(null); }}
          onPlayTTS={playTTS}
        />
      )}

      {/* Header with exam timer (F33) */}
      <View style={[sc.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={handleExit} style={({ pressed }) => [sc.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons name="close" size={20} color="#FF4444" />
        </Pressable>
        <View style={sc.headerCenter}>
          <Text style={[sc.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {selectedImage?.caption ?? "Descripción de imagen"}
          </Text>
          {examTimerRunning && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
              <Ionicons name="timer-outline" size={12} color={examUrgentColor} />
              <Text style={[sc.headerSub, { color: examUrgentColor }]}>
                {examTimeUp ? "Tiempo agotado" : formatTime(examTimeLeft)}
              </Text>
            </View>
          )}
          {!examTimerRunning && (
            <Text style={[sc.headerSub, { color: activeColor }]}>{activeTheme.name}</Text>
          )}
        </View>
        {/* End session button (F34) */}
        <Pressable
          onPress={generateFeedback}
          style={[sc.endBtn, { backgroundColor: activeColor + "20", borderColor: activeColor + "50" }]}
        >
          <Text style={[sc.endBtnText, { color: activeColor }]}>Ver resultados</Text>
        </Pressable>
      </View>

      {/* Exam time-up banner (F33) */}
      {examTimeUp && (
        <View style={[sc.timeUpBanner, { backgroundColor: "#FF4444", }]}>
          <Ionicons name="timer-outline" size={15} color="#fff" />
          <Text style={sc.timeUpText}>Tiempo del examen agotado — tu respuesta actual se puede enviar</Text>
        </View>
      )}

      {/* Thumbnail strip with image visible throughout (F27) */}
      {selectedImage && (
        <View style={[sc.thumbStrip, { borderBottomColor: colors.border }]}>
          <Pressable onPress={openImageModal} style={sc.thumbPressable}>
            <Image
              source={{ uri: imageUri ?? selectedImage.url }}
              style={sc.thumb}
              resizeMode="cover"
              onError={() => setImageErrored(true)}
            />
            <View style={sc.thumbExpandIcon}>
              <Ionicons name="expand-outline" size={11} color="#fff" />
            </View>
          </Pressable>
          <Text style={[sc.thumbHint, { color: colors.textSecondary }]}>
            Toca cualquier palabra del examinador para traducirla
          </Text>
        </View>
      )}

      {/* Chat */}
      <View style={{ flex: 1, minHeight: 0 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          extraData={messages.length}
          renderItem={({ item, index }) => {
            const isLast = index === messages.length - 1;
            return (
              <View style={{ marginVertical: 4, marginHorizontal: 14 }}>
                <View
                  style={[
                    sc.bubble,
                    item.role === "user" ? sc.userBubble : sc.aiBubble,
                    {
                      backgroundColor: item.role === "user" ? activeColor : colors.card,
                      borderColor: item.role === "user" ? "transparent" : colors.border,
                    },
                  ]}
                >
                  {item.role === "assistant" && (
                    <View style={[sc.aiAvatar, { backgroundColor: activeColor + "22", borderColor: activeColor + "44" }]}>
                      <Ionicons name="school-outline" size={13} color={activeColor} />
                    </View>
                  )}
                  {item.role === "assistant" ? (
                    <TappableText
                      content={item.content}
                      textStyle={[sc.bubbleText, { color: colors.text, maxWidth: "82%" }]}
                      onWordPress={handleWordPress}
                    />
                  ) : (
                    <Text style={[sc.bubbleText, { color: "#fff", maxWidth: "82%" }]}>{item.content}</Text>
                  )}
                </View>

                {/* Controls — only on assistant messages */}
                {item.role === "assistant" && (
                  <View style={sc.msgFooter}>
                    {/* Audio play button */}
                    <Pressable
                      onPress={() => handleRepeat(item)}
                      disabled={isStreaming}
                      style={({ pressed }) => [
                        sc.audioBtn,
                        {
                          backgroundColor: activeColor + "18",
                          borderColor: activeColor + "50",
                          opacity: pressed || isStreaming ? 0.6 : 1,
                        },
                      ]}
                    >
                      {isTTSPlaying ? (
                        <ActivityIndicator size="small" color={activeColor} style={{ width: 16, height: 16 }} />
                      ) : (
                        <Ionicons name="play-circle-outline" size={16} color={activeColor} />
                      )}
                      <Text style={[sc.audioBtnText, { color: activeColor }]}>
                        {isTTSPlaying ? "Reproduciendo…" : "Escuchar"}
                      </Text>
                    </Pressable>

                    {/* Rephrase — only on last AI message */}
                    {isLast && !isStreaming && !examTimeUp && (
                      <Pressable
                        onPress={handleRephrase}
                        style={({ pressed }) => [sc.qBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
                        <Text style={[sc.qBtnText, { color: colors.textSecondary }]}>Reformular</Text>
                      </Pressable>
                    )}
                    {/* Skip — only on last AI message */}
                    {isLast && !isStreaming && !examTimeUp && (
                      <Pressable
                        onPress={handleSkipQuestion}
                        style={({ pressed }) => [sc.qBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Ionicons name="play-skip-forward-outline" size={13} color={colors.textSecondary} />
                        <Text style={[sc.qBtnText, { color: colors.textSecondary }]}>Omitir</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          }}
          ListFooterComponent={
            showTyping ? (
              <View style={{ marginHorizontal: 14, marginVertical: 4 }}>
                <View style={[sc.bubble, sc.aiBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[sc.aiAvatar, { backgroundColor: activeColor + "22", borderColor: activeColor + "44" }]}>
                    <Ionicons name="school-outline" size={13} color={activeColor} />
                  </View>
                  <TypingDots color={activeColor} />
                </View>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingVertical: 12 }}
        />
      </View>

      {/* Voice input area */}
      <View style={[sc.voiceArea, { paddingBottom: botPad + 12, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {micError && (
          <View style={sc.errBanner}>
            <Ionicons name="warning-outline" size={14} color="#FF4444" />
            <Text style={sc.errText} numberOfLines={2}>{micError}</Text>
          </View>
        )}

        {/* Transcript preview */}
        {recordingState === "preview" && (
          <View style={[sc.transcriptCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[sc.transcriptLabel, { color: colors.textSecondary }]}>Tu respuesta:</Text>
            <TextInput
              style={[sc.transcriptInput, { color: colors.text, borderColor: colors.border }]}
              value={transcript}
              onChangeText={setTranscript}
              multiline
              scrollEnabled={false}
              autoCorrect={false}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <Pressable onPress={handleDeleteTranscript} style={[sc.trashBtn, { borderColor: colors.border }]}>
                <Ionicons name="trash-outline" size={15} color="#FF4444" />
                <Text style={sc.trashText}>Borrar</Text>
              </Pressable>
              <Pressable onPress={handleSendTranscript} style={{ flex: 1 }}>
                <LinearGradient colors={[activeColor, activeTheme.colorDark]} style={sc.sendGrad}>
                  <Ionicons name="send" size={15} color="#fff" />
                  <Text style={sc.sendText}>Enviar respuesta</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        )}

        {/* Mic */}
        {recordingState !== "preview" && (
          <View style={sc.micRow}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Animated.View style={[sc.micRing, { borderColor: activeColor, opacity: ringOpacity }]} />
              <Pressable
                onPress={handleMicPress}
                disabled={micDisabled}
                style={[sc.micBtn, { opacity: micDisabled && !examTimeUp ? 0.4 : examTimeUp ? 0 : 1 }]}
              >
                <LinearGradient
                  colors={recordingState === "recording" ? ["#FF4444", "#CC2222"] : [activeColor, activeTheme.colorDark]}
                  style={sc.micGrad}
                >
                  {recordingState === "processing" ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name={recordingState === "recording" ? "stop" : "mic"} size={28} color="#fff" />
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>
            <Text style={[sc.micHint, { color: colors.textSecondary }]}>
              {examTimeUp
                ? ""
                : recordingState === "recording"
                ? "Grabando… toca para detener"
                : isStreaming
                ? "El examinador está respondiendo…"
                : isTTSPlaying
                ? "Escuchando respuesta…"
                : "Toca el micrófono para responder"}
            </Text>
          </View>
        )}
      </View>

      {/* Image full-screen modal (F31) */}
      {selectedImage && (
        <Modal transparent visible={imgModalVisible} onRequestClose={closeImageModal} statusBarTranslucent>
          <Animated.View style={[sc.imgModalOverlay, { opacity: imgModalOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeImageModal} />
            <Animated.View style={{ transform: [{ scale: imgModalScale }], width: "92%", maxWidth: 500 }}>
              <Image
                source={{ uri: imageUri ?? selectedImage.url }}
                style={sc.imgModalImage}
                resizeMode="contain"
              />
              <Text style={sc.imgModalCaption}>{selectedImage.caption}</Text>
            </Animated.View>
            <Pressable onPress={closeImageModal} style={sc.imgModalClose}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },

  // End session button (F34)
  endBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  endBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Time-up banner (F33)
  timeUpBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  timeUpText: { flex: 1, color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Theme tabs
  themeTabsScroll: { maxHeight: 56 },
  themeTabs: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  themeTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  themeTabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Image grid
  imageGrid: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  sectionLabel: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridCell: { width: "48%" },

  // Prep
  prepContent: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  prepImageWrapper: { borderRadius: 14, overflow: "hidden", height: 220, position: "relative" },
  prepImage: { width: "100%", height: "100%" },
  prepImageGrad: { ...StyleSheet.absoluteFillObject, top: "50%" },
  prepImageCaption: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  timerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  timerLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  timerValue: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 2 },
  timerTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  timerFill: { height: "100%", borderRadius: 3 },
  instructCard: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 12 },
  instructTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  tipRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  tipNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  tipNumText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  tipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  // Exam duration selector
  durationCard: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 12 },
  durationHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  durationTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  durationRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  durationBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  durationBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Start timer / skip buttons (F29)
  startTimerBtn: { borderRadius: 14, overflow: "hidden", marginTop: 4 },
  startTimerGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
  },
  startTimerText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  skipPrepBtn: { borderRadius: 14, overflow: "hidden", marginTop: 4 },
  skipPrepGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  skipPrepText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // Exam
  thumbStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  thumb: { width: 54, height: 38, borderRadius: 6 },
  thumbHint: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
  bubble: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  aiAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22, flexShrink: 1 },

  // Question controls (F31)
  msgFooter: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    marginLeft: 4,
    flexWrap: "wrap",
    alignItems: "center",
  },
  audioBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  audioBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  qBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  qBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  // Voice area
  voiceArea: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1 },
  errBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FF444415",
    borderColor: "#FF444440",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  errText: { flex: 1, color: "#FF4444", fontSize: 12, fontFamily: "Inter_400Regular" },
  transcriptCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10 },
  transcriptLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 6 },
  transcriptInput: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    minHeight: 60,
  },
  trashBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  trashText: { color: "#FF4444", fontSize: 13, fontFamily: "Inter_500Medium" },
  sendGrad: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sendText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  micRow: { alignItems: "center", gap: 10 },
  micRing: { position: "absolute", width: 80, height: 80, borderRadius: 40, borderWidth: 2, top: -6, left: -6 },
  micBtn: { width: 68, height: 68, borderRadius: 34, overflow: "hidden" },
  micGrad: { width: 68, height: 68, alignItems: "center", justifyContent: "center" },
  micHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },

  // Feedback phase (F32)
  feedbackContent: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  fbThumbWrapper: { borderRadius: 14, overflow: "hidden", height: 160, position: "relative" },
  fbThumb: { width: "100%", height: "100%" },
  fbThumbCaption: {
    position: "absolute",
    bottom: 10,
    left: 12,
    right: 12,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  fbLoadingBox: { alignItems: "center", gap: 12, paddingVertical: 48 },
  fbLoadingText: { fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  fbLoadingSubText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  bandPillRow: { alignItems: "center" },
  bandPill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  bandPillText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  criterionCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 4 },
  criterionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  criterionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  criterionBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  criterionLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  criterionScore: { fontSize: 18, fontFamily: "Inter_700Bold" },
  criterionFeedback: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginTop: 6 },
  listCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  listCardTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 2 },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  listRowText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  encourageCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  encourageText: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  fbHomeBtn: { borderRadius: 14, overflow: "hidden", marginTop: 8 },
  fbHomeGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  fbHomeText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },

  // Image full-screen modal (F31)
  imgModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  imgModalImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 14,
  },
  imgModalCaption: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginTop: 12,
    opacity: 0.85,
    paddingHorizontal: 8,
  },
  imgModalClose: {
    position: "absolute",
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  prepImageZoomBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbPressable: { position: "relative" },
  thumbExpandIcon: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
