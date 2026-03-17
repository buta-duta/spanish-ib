import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
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
import { PRACTICE_IMAGES, type PracticeImage } from "@/constants/practiceImages";

function getApiUrl() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/`;
  return "http://localhost:80/";
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Phase = "select" | "prep" | "exam";
type RecordingState = "idle" | "recording" | "processing" | "preview";
type Message = { id: string; role: "user" | "assistant"; content: string };

const PREP_SECONDS = 10 * 60; // 10 minutes
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
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 160),
        Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]))
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
function ImageCard({ img, themeColor, onPress }: { img: PracticeImage; themeColor: string; onPress: () => void }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const [loaded, setLoaded] = useState(false);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [imgStyles.card, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 }]}>
      <View style={imgStyles.imgWrapper}>
        {!loaded && <ActivityIndicator style={StyleSheet.absoluteFill} color={themeColor} />}
        <Image
          source={{ uri: img.url }}
          style={imgStyles.img}
          resizeMode="cover"
          onLoad={() => setLoaded(true)}
        />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.65)"]} style={imgStyles.imgGrad} />
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
  const [selectedThemeId, setSelectedThemeId] = useState(THEMES[0].id);
  const [selectedImage, setSelectedImage] = useState<PracticeImage | null>(null);

  // ── Prep timer ───────────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(PREP_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    setTimeLeft(PREP_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); beginExam(); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const skipPrep = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    beginExam();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

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
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])).start();
      Animated.loop(Animated.sequence([
        Animated.timing(ringOpacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0.1, duration: 700, useNativeDriver: true }),
      ])).start();
    } else {
      pulseAnim.stopAnimation();
      ringOpacity.stopAnimation();
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      Animated.timing(ringOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [recordingState]);

  const beginExam = () => {
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
      const path = (FileSystem.cacheDirectory ?? "") + "img_tts.mp3";
      await FileSystem.writeAsStringAsync(path, audioBase64, { encoding: "base64" });
      const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
      nativeSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) { setIsTTSPlaying(false); sound.unloadAsync().catch(() => {}); }
      });
    }
  }, []);

  const playTTS = useCallback(async (text: string, msgId?: string) => {
    try {
      if (msgId && imgAudioCache.has(msgId)) { await playAudioBase64(imgAudioCache.get(msgId)!); return; }
      setIsTTSPlaying(true);
      const res = await globalThis.fetch(`${getApiUrl()}api/exam/tts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
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
  }, [playAudioBase64]);

  // ── AI chat ───────────────────────────────────────────────────────────────────
  const sendToAI = useCallback(async (chatMessages: Message[]) => {
    if (!selectedImage) return;
    setIsStreaming(true);
    setShowTyping(true);

    try {
      const apiMessages = chatMessages.map((m) => ({ role: m.role, content: m.content }));
      const response = await (globalThis as any).fetch(`${getApiUrl()}api/exam/image-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          messages: apiMessages,
          theme: selectedImage.themeId,
          imageDescription: selectedImage.description,
          imageCaption: selectedImage.caption,
          sessionTurn,
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
                setMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: fullContent }]);
                assistantAdded = true;
              } else {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
                  return updated;
                });
              }
            }
          } catch { }
        }
      }

      if (fullContent) playTTS(fullContent, assistantMsgId);
    } catch {
      setShowTyping(false);
      setMessages((prev) => [...prev, { id: generateId(), role: "assistant", content: "Lo siento, hubo un error. Por favor intenta de nuevo." }]);
    } finally {
      setIsStreaming(false);
      setShowTyping(false);
      const hasUser = chatMessages.some((m) => m.role === "user");
      if (hasUser) setSessionTurn((t) => t + 1);
    }
  }, [selectedImage, sessionTurn, playTTS]);

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
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    await transcribeAndPreview(b64, "audio.webm");
  };

  // ── Recording (native) ───────────────────────────────────────────────────────
  const startRecordingNative = async () => {
    try {
      setMicError(null);
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, filename }),
      });
      if (!res.ok) throw new Error("Transcription failed");
      const { text } = await res.json();
      if (text?.trim()) { setTranscript(text.trim()); setRecordingState("preview"); }
      else setRecordingState("idle");
    } catch { setRecordingState("idle"); }
  };

  const handleMicPress = () => {
    if (isStreaming || isTTSPlaying) return;
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
    const userMsg: Message = { id: generateId(), role: "user", content: text };
    const currentMessages = [...messages];
    setMessages((prev) => [...prev, userMsg]);
    await sendToAI([...currentMessages, userMsg]);
  };

  const handleDeleteTranscript = () => { setTranscript(""); setRecordingState("idle"); };

  const handleExit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    nativeSoundRef.current?.unloadAsync().catch(() => {});
    nativeRecordingRef.current?.stopAndUnloadAsync().catch(() => {});
    if (webAudioRef.current) { webAudioRef.current.pause(); webAudioRef.current.src = ""; }
    router.replace("/");
  };

  const selectedTheme = THEMES.find((t) => t.id === selectedThemeId) ?? THEMES[0];
  const themeImages = PRACTICE_IMAGES.filter((img) => img.themeId === selectedThemeId);
  const themeColor = selectedTheme.color;

  // ── SELECT PHASE ──────────────────────────────────────────────────────────────
  if (phase === "select") {
    return (
      <View style={[sc.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={isDark ? ["#1A1030", "#0F1117"] : ["#F0EDFF", "#F5F6FA"]} style={StyleSheet.absoluteFill} />
        {/* Header */}
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

        {/* Theme tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sc.themeTabs} style={sc.themeTabsScroll}>
          {THEMES.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setSelectedThemeId(t.id)}
              style={[sc.themeTab, { borderColor: selectedThemeId === t.id ? t.color : colors.border, backgroundColor: selectedThemeId === t.id ? t.color + "18" : colors.card }]}
            >
              <Ionicons name={t.iconName as any} size={16} color={selectedThemeId === t.id ? t.color : colors.textSecondary} />
              <Text style={[sc.themeTabText, { color: selectedThemeId === t.id ? t.color : colors.textSecondary }]}>{t.nameShort}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Image grid */}
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
                    setPhase("prep");
                    setTimeout(startTimer, 100);
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
    const pct = timeLeft / PREP_SECONDS;
    const urgentColor = timeLeft < 60 ? "#FF4444" : timeLeft < 180 ? "#FF9900" : themeColor;
    return (
      <View style={[sc.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={isDark ? ["#1A1030", "#0F1117"] : ["#F0EDFF", "#F5F6FA"]} style={StyleSheet.absoluteFill} />
        {/* Header */}
        <View style={[sc.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <Pressable onPress={handleExit} style={({ pressed }) => [sc.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <View style={sc.headerCenter}>
            <Text style={[sc.headerTitle, { color: colors.text }]}>Tiempo de preparación</Text>
            <Text style={[sc.headerSub, { color: colors.textSecondary }]}>{selectedTheme.name}</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={[sc.prepContent, { paddingBottom: botPad + 24 }]} showsVerticalScrollIndicator={false}>
          {/* Image */}
          <View style={sc.prepImageWrapper}>
            <Image source={{ uri: selectedImage.url }} style={sc.prepImage} resizeMode="cover" />
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} style={sc.prepImageGrad} />
            <Text style={sc.prepImageCaption}>{selectedImage.caption}</Text>
          </View>

          {/* Timer */}
          <View style={[sc.timerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="timer-outline" size={22} color={urgentColor} />
            <View style={{ flex: 1 }}>
              <Text style={[sc.timerLabel, { color: colors.textSecondary }]}>Tiempo de preparación</Text>
              <Text style={[sc.timerValue, { color: urgentColor }]}>{formatTime(timeLeft)}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={[sc.timerTrack, { backgroundColor: colors.cardAlt }]}>
            <Animated.View style={[sc.timerFill, { backgroundColor: urgentColor, width: `${Math.round(pct * 100)}%` as any }]} />
          </View>

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

          {/* Skip button */}
          <Pressable onPress={skipPrep} style={({ pressed }) => [sc.skipPrepBtn, { opacity: pressed ? 0.85 : 1 }]}>
            <LinearGradient colors={[themeColor, selectedTheme.colorDark]} style={sc.skipPrepGrad}>
              <Ionicons name="play-skip-forward-outline" size={20} color="#fff" />
              <Text style={sc.skipPrepText}>⏭ Omitir preparación e iniciar examen</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── EXAM PHASE ────────────────────────────────────────────────────────────────
  const micDisabled = isStreaming || recordingState === "processing" || recordingState === "preview";
  const activeTheme = THEMES.find((t) => t.id === selectedImage?.themeId) ?? THEMES[0];
  const activeColor = activeTheme.color;

  return (
    <View style={[sc.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[sc.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={handleExit} style={({ pressed }) => [sc.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons name="close" size={20} color="#FF4444" />
        </Pressable>
        <View style={sc.headerCenter}>
          <Text style={[sc.headerTitle, { color: colors.text }]} numberOfLines={1}>{selectedImage?.caption ?? "Descripción de imagen"}</Text>
          <Text style={[sc.headerSub, { color: activeColor }]}>{activeTheme.name}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Thumbnail strip */}
      {selectedImage && (
        <View style={[sc.thumbStrip, { borderBottomColor: colors.border }]}>
          <Image source={{ uri: selectedImage.url }} style={sc.thumb} resizeMode="cover" />
          <Text style={[sc.thumbHint, { color: colors.textSecondary }]}>Imagen en práctica · describe y analiza lo que ves</Text>
        </View>
      )}

      {/* Chat */}
      <View style={{ flex: 1, minHeight: 0 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          extraData={messages.length}
          renderItem={({ item }) => (
            <View style={[sc.bubble, item.role === "user" ? sc.userBubble : sc.aiBubble, {
              backgroundColor: item.role === "user" ? activeColor : colors.card,
              borderColor: item.role === "user" ? "transparent" : colors.border,
            }]}>
              {item.role === "assistant" && (
                <View style={[sc.aiAvatar, { backgroundColor: activeColor + "22", borderColor: activeColor + "44" }]}>
                  <Ionicons name="school-outline" size={13} color={activeColor} />
                </View>
              )}
              <Text style={[sc.bubbleText, { color: item.role === "user" ? "#fff" : colors.text, maxWidth: "82%" }]}>
                {item.content}
              </Text>
            </View>
          )}
          ListFooterComponent={showTyping ? (
            <View style={[sc.bubble, sc.aiBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[sc.aiAvatar, { backgroundColor: activeColor + "22", borderColor: activeColor + "44" }]}>
                <Ionicons name="school-outline" size={13} color={activeColor} />
              </View>
              <TypingDots color={activeColor} />
            </View>
          ) : null}
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
                style={[sc.micBtn, { opacity: micDisabled ? 0.4 : 1 }]}
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
              {recordingState === "recording" ? "Grabando… toca para detener" : isStreaming ? "El examinador está respondiendo…" : isTTSPlaying ? "Escuchando respuesta…" : "Toca el micrófono para responder"}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },

  // Theme tabs
  themeTabsScroll: { maxHeight: 56 },
  themeTabs: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  themeTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
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
  prepImageCaption: { position: "absolute", bottom: 12, left: 12, right: 12, fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  timerCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, borderWidth: 1 },
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
  skipPrepBtn: { borderRadius: 14, overflow: "hidden", marginTop: 4 },
  skipPrepGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  skipPrepText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // Exam
  thumbStrip: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1 },
  thumb: { width: 54, height: 38, borderRadius: 6 },
  thumbHint: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
  bubble: { marginVertical: 4, marginHorizontal: 14, padding: 12, borderRadius: 16, borderWidth: 1, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  aiAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22, flexShrink: 1 },
  voiceArea: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1 },
  errBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FF444415", borderColor: "#FF444440", borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 8 },
  errText: { flex: 1, color: "#FF4444", fontSize: 12, fontFamily: "Inter_400Regular" },
  transcriptCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10 },
  transcriptLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 6 },
  transcriptInput: { fontSize: 14, fontFamily: "Inter_400Regular", borderWidth: 1, borderRadius: 8, padding: 8, minHeight: 60 },
  trashBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  trashText: { color: "#FF4444", fontSize: 13, fontFamily: "Inter_500Medium" },
  sendGrad: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  sendText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  micRow: { alignItems: "center", gap: 10 },
  micRing: { position: "absolute", width: 80, height: 80, borderRadius: 40, borderWidth: 2, top: -6, left: -6 },
  micBtn: { width: 68, height: 68, borderRadius: 34, overflow: "hidden" },
  micGrad: { width: 68, height: 68, alignItems: "center", justifyContent: "center" },
  micHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});
