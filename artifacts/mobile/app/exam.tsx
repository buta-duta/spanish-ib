import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { apiFetch, expoApiFetch, getApiUrl } from "@/lib/api";
import { getThemeById } from "@/constants/themes";
import { useIBTheme } from "@/contexts/ThemeContext";
import { useExam, type Message, generateMsgId } from "@/contexts/ExamContext";
import { useProgress } from "@/contexts/ProgressContext";
import { WordModal, tokenizeText } from "@/components/WordModal";
import { detectEnglishWords } from "@/lib/detectEnglish";
import { draftToSession, isExamDraft, sessionToDraft } from "@/lib/examDraft";

type RecordingState = "idle" | "recording" | "preview" | "processing";

const TOTAL_TURNS = 8;

const audioCache = new Map<string, string>(); // msgId → base64 mp3

const tokenizeMessage = tokenizeText;

/** Speech-optimized preset — smaller uploads, works on Vercel body limits. */
const SPEECH_RECORDING_OPTIONS = {
  isMeteringEnabled: false,
  android: {
    extension: ".m4a",
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 96000,
  },
  ios: {
    extension: ".m4a",
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 96000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: Audio.RecordingOptionsPresets.LOW_QUALITY.web,
} as const;

// ─── Web audio helpers ────────────────────────────────────────────────────────

function getBestMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:audio/webm;base64,XXXXX" — strip the prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── Components ───────────────────────────────────────────────────────────────

function TypingIndicator({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, []);

  return (
    <View style={typingStyles.container}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View key={i} style={[typingStyles.dot, { backgroundColor: color, opacity: dot }]} />
      ))}
    </View>
  );
}

const typingStyles = StyleSheet.create({
  container: { flexDirection: "row", gap: 4, paddingHorizontal: 14, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

function MessageBubble({
  message,
  themeColor,
  isDark,
  isLast,
  onRegenerate,
  onSkip,
  canRegenerate,
  onWordPress,
  onReplay,
}: {
  message: Message;
  themeColor: string;
  isDark: boolean;
  isLast: boolean;
  onRegenerate: () => void;
  onSkip: () => void;
  canRegenerate: boolean;
  onWordPress: (word: string, context: string) => void;
  onReplay: () => void;
}) {
  const colors = Colors[isDark ? "dark" : "light"];
  const isUser = message.role === "user";
  const isEnglishTip = message.kind === "english-tip";
  const tokens = React.useMemo(() => tokenizeMessage(message.content), [message.content]);

  return (
    <View>
      <View style={[bubbleStyles.container, isUser ? bubbleStyles.userContainer : bubbleStyles.assistantContainer]}>
        {!isUser && (
          <View
            style={[
              bubbleStyles.avatar,
              {
                backgroundColor: isEnglishTip ? "#C9A84C22" : themeColor + "22",
                borderColor: isEnglishTip ? "#C9A84C44" : themeColor + "44",
              },
            ]}
          >
            <Ionicons
              name={isEnglishTip ? "bulb-outline" : "school-outline"}
              size={14}
              color={isEnglishTip ? "#C9A84C" : themeColor}
            />
          </View>
        )}
        <View
          style={[
            bubbleStyles.bubble,
            isUser
              ? { backgroundColor: themeColor, borderBottomRightRadius: 4 }
              : isEnglishTip
              ? { backgroundColor: "#C9A84C18", borderColor: "#C9A84C50", borderWidth: 1, borderBottomLeftRadius: 4 }
              : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
            { maxWidth: "82%" },
          ]}
        >
          {isUser ? (
            <Text style={[bubbleStyles.text, { color: "#fff" }]}>{message.content}</Text>
          ) : (
            <Text style={[bubbleStyles.text, { color: colors.text }]}>
              {tokens.map((t) =>
                t.clean.length >= 2 ? (
                  <Text
                    key={t.idx}
                    suppressHighlighting={false}
                    onPress={() => onWordPress(t.clean, message.content)}
                    style={{ color: colors.text }}
                  >
                    {t.display}
                  </Text>
                ) : (
                  <Text key={t.idx} style={{ color: colors.text }}>{t.display}</Text>
                )
              )}
            </Text>
          )}
        </View>
      </View>
      {/* Replay button — examiner messages only (not English tips) */}
      {!isUser && !isEnglishTip && (
        <Pressable
          onPress={onReplay}
          style={({ pressed }) => [bubbleStyles.replayRow, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Ionicons name="volume-medium-outline" size={13} color={themeColor} />
          <Text style={[bubbleStyles.replayText, { color: themeColor }]}>Reproducir otra vez</Text>
        </Pressable>
      )}
      {!isUser && !isEnglishTip && isLast && canRegenerate && (
        <View style={bubbleStyles.actionRow}>
          <Pressable
            onPress={onRegenerate}
            style={({ pressed }) => [bubbleStyles.regenBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="refresh-outline" size={13} color={themeColor} />
            <Text style={[bubbleStyles.regenText, { color: themeColor }]}>Otra pregunta</Text>
          </Pressable>
          <Pressable
            onPress={onSkip}
            style={({ pressed }) => [bubbleStyles.skipBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={bubbleStyles.skipText}>Saltar →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  container: { marginVertical: 4, paddingHorizontal: 16 },
  userContainer: { flexDirection: "row", justifyContent: "flex-end" },
  assistantContainer: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  text: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, marginLeft: 52, marginTop: 4, marginBottom: 4 },
  regenBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  regenText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  skipBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: "#88888820", borderWidth: 1, borderColor: "#88888840" },
  skipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#888888" },
  replayRow: { flexDirection: "row", alignItems: "center", gap: 5, marginLeft: 52, marginTop: 3, marginBottom: 1 },
  replayText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ExamScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const { resume: resumeParam } = useLocalSearchParams<{ resume?: string }>();
  const isResume = resumeParam === "1";
  const { selectedTheme } = useIBTheme();
  const {
    currentSession,
    addMessage,
    endSession,
    restoreSession,
    replaceMessages,
    updateLastAssistantContent,
  } = useExam();
  const progress = useProgress();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [sessionTurn, setSessionTurn] = useState(0);

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [showSilentHint, setShowSilentHint] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [wordPopup, setWordPopup] = useState<{ word: string; context: string } | null>(null);

  // Native recording refs (expo-av)
  const nativeRecordingRef = useRef<Audio.Recording | null>(null);
  // Web recording refs (MediaRecorder)
  const webMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const webAudioChunksRef = useRef<Blob[]>([]);
  const webMimeTypeRef = useRef<string>("audio/webm");
  // TTS refs
  const nativeSoundRef = useRef<Audio.Sound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);

  const silentHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const initializedRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const sessionTurnRef = useRef(0);
  const sendLockRef = useRef(false);

  const persistDraft = useCallback(() => {
    if (!currentSession || !progress.loaded) return;
    const draft = sessionToDraft(
      { ...currentSession, messages: messagesRef.current },
      sessionTurnRef.current,
    );
    void progress.saveModuleSnapshot("exam", "in-progress", draft as unknown as Record<string, unknown>);
  }, [currentSession, progress.loaded, progress.saveModuleSnapshot]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    sessionTurnRef.current = sessionTurn;
  }, [sessionTurn]);

  useEffect(() => {
    if (!currentSession || !progress.loaded || !initializedRef.current) return;
    persistDraft();
  }, [messages, sessionTurn, currentSession, progress.loaded, persistDraft]);

  const themeData = selectedTheme || getThemeById("identidades")!;
  const themeColor = themeData.color;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const progressFraction = Math.min(sessionTurn / TOTAL_TURNS, 1);
  const currentQuestion = Math.min(sessionTurn + 1, TOTAL_TURNS);
  const remaining = Math.max(0, TOTAL_TURNS - sessionTurn);
  const timeEstimate = Math.round(remaining * 1.5);

  useEffect(() => {
    return () => {
      if (silentHintTimerRef.current) clearTimeout(silentHintTimerRef.current);
      nativeSoundRef.current?.unloadAsync().catch(() => {});
      nativeRecordingRef.current?.stopAndUnloadAsync().catch(() => {});
      webMediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current.src = "";
      }
      if (messagesRef.current.length > 0) {
        persistDraft();
      }
    };
  }, [persistDraft]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  // Pulse animation when recording
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

  // ── AI chat ──────────────────────────────────────────────────────────────────

  const sendToAI = async (chatMessages: Message[], regenerate = false, skip = false) => {
    if (sendLockRef.current) return;
    sendLockRef.current = true;
    setIsStreaming(true);
    setShowTyping(true);

    try {
      const apiMessages = chatMessages
        .filter((m) => m.kind !== "english-tip")
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await expoApiFetch(`${getApiUrl()}api/exam/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          messages: apiMessages,
          theme: themeData.id,
          sessionTurn: sessionTurnRef.current,
          regenerate,
          skip,
          practiceFocus: currentSession?.practiceFocus,
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
                assistantMsgId = generateMsgId();
                setShowTyping(false);
                const newMsg: Message = {
                  id: assistantMsgId,
                  role: "assistant",
                  content: fullContent,
                  timestamp: Date.now(),
                };
                setMessages((prev) => {
                  const next = [...prev, newMsg];
                  messagesRef.current = next;
                  return next;
                });
                addMessage({ id: assistantMsgId, role: "assistant", content: fullContent });
                assistantAdded = true;
              } else {
                setMessages((prev) => {
                  const updated = [...prev];
                  const idx = updated.length - 1;
                  updated[idx] = { ...updated[idx], content: fullContent };
                  messagesRef.current = updated;
                  return updated;
                });
              }
            }
          } catch { }
        }
      }

      if (fullContent) {
        updateLastAssistantContent(fullContent);
        playTTS(fullContent, assistantMsgId);
      }
    } catch {
      setShowTyping(false);
      const errMsg: Message = {
        id: generateMsgId(),
        role: "assistant",
        content: "Lo siento, hubo un error. Por favor intenta de nuevo.",
        timestamp: Date.now(),
      };
      setMessages((prev) => {
        const next = [...prev, errMsg];
        messagesRef.current = next;
        return next;
      });
      addMessage({ id: errMsg.id, role: "assistant", content: errMsg.content });
    } finally {
      sendLockRef.current = false;
      setIsStreaming(false);
      setShowTyping(false);
      const hasUserMessage = chatMessages.some((m) => m.role === "user");
      if (hasUserMessage && !regenerate && !skip) {
        setSessionTurn((prev) => {
          const next = prev + 1;
          sessionTurnRef.current = next;
          return next;
        });
      }
      persistDraft();
    }
  };

  useEffect(() => {
    if (!progress.loaded || initializedRef.current) return;

    const snap = progress.getModuleSnapshot("exam");
    if (isResume && isExamDraft(snap?.data)) {
      const draft = snap.data;
      const session = draftToSession(draft);
      restoreSession(session);
      setMessages(draft.messages);
      messagesRef.current = draft.messages;
      setSessionTurn(draft.sessionTurn);
      sessionTurnRef.current = draft.sessionTurn;
      initializedRef.current = true;
      const last = draft.messages[draft.messages.length - 1];
      if (last?.role === "user") {
        void sendToAI(draft.messages);
      }
      return;
    }

    if (currentSession && currentSession.messages.length > 0) {
      const turn =
        currentSession.sessionTurn ??
        currentSession.messages.filter((m) => m.role === "user" && m.kind !== "english-tip").length;
      setMessages(currentSession.messages);
      messagesRef.current = currentSession.messages;
      setSessionTurn(turn);
      sessionTurnRef.current = turn;
      initializedRef.current = true;
      return;
    }

    initializedRef.current = true;
    void sendToAI([]);
  }, [progress.loaded, isResume]);

  // ── TTS ───────────────────────────────────────────────────────────────────────

  const playAudioBase64 = async (audioBase64: string) => {
    if (Platform.OS === "web") {
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current.src = "";
        webAudioRef.current = null;
      }
      setIsTTSPlaying(true);
      const audio = new (window as any).Audio(`data:audio/mp3;base64,${audioBase64}`) as HTMLAudioElement;
      webAudioRef.current = audio;
      audio.onended = () => { setIsTTSPlaying(false); webAudioRef.current = null; };
      audio.onerror = () => setIsTTSPlaying(false);
      await audio.play();
    } else {
      if (nativeSoundRef.current) {
        await nativeSoundRef.current.unloadAsync().catch(() => {});
        nativeSoundRef.current = null;
      }
      setIsTTSPlaying(true);
      await Audio.setAudioModeAsync({ staysActiveInBackground: true, playsInSilentModeIOS: true, allowsRecordingIOS: false });
      const path = (FileSystem.cacheDirectory ?? "") + "exam_tts.mp3";
      await FileSystem.writeAsStringAsync(path, audioBase64, { encoding: "base64" });
      const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
      nativeSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsTTSPlaying(false);
          sound.unloadAsync().catch(() => {});
        }
      });
    }
  };

  const playTTS = async (text: string, msgId?: string) => {
    try {
      // Check cache first
      if (msgId && audioCache.has(msgId)) {
        await playAudioBase64(audioCache.get(msgId)!);
        return;
      }

      // Stop any current TTS
      if (Platform.OS === "web") {
        if (webAudioRef.current) {
          webAudioRef.current.pause();
          webAudioRef.current.src = "";
          webAudioRef.current = null;
        }
      } else {
        if (nativeSoundRef.current) {
          await nativeSoundRef.current.unloadAsync().catch(() => {});
          nativeSoundRef.current = null;
        }
      }

      setIsTTSPlaying(true);

      const res = await apiFetch(`${getApiUrl()}api/exam/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("TTS request failed");
      const { audioBase64 } = await res.json();
      if (!audioBase64) throw new Error("No audio data");

      // Cache for instant replay
      if (msgId) audioCache.set(msgId, audioBase64);

      await playAudioBase64(audioBase64);
    } catch (e) {
      console.error("TTS error:", e);
      setIsTTSPlaying(false);
    }
  };

  // ── Recording: Web ────────────────────────────────────────────────────────────

  const startRecordingWeb = async () => {
    try {
      setMicError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setMicError("Tu navegador no soporta grabación de audio. Prueba Chrome o Firefox.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const mimeType = getBestMimeType();
      webMimeTypeRef.current = mimeType;
      webAudioChunksRef.current = [];

      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          webAudioChunksRef.current.push(e.data);
        }
      };

      recorder.start(250); // collect every 250ms
      webMediaRecorderRef.current = recorder;

      setRecordingState("recording");
      setShowSilentHint(false);
      silentHintTimerRef.current = setTimeout(() => setShowSilentHint(true), 3500);
    } catch (err: any) {
      console.error("Web recording start error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setMicError("Permiso de micrófono denegado. Permite el acceso en tu navegador y recarga la página.");
      } else if (err.name === "NotFoundError") {
        setMicError("No se encontró un micrófono. Conecta uno e intenta de nuevo.");
      } else {
        setMicError("Error al acceder al micrófono: " + (err.message || err.name));
      }
      setRecordingState("idle");
    }
  };

  const stopRecordingWeb = async () => {
    if (silentHintTimerRef.current) clearTimeout(silentHintTimerRef.current);
    setShowSilentHint(false);

    const recorder = webMediaRecorderRef.current;
    if (!recorder) { setRecordingState("idle"); return; }

    setRecordingState("processing");

    try {
      // Wait for recording to stop and all chunks to be available
      await new Promise<void>((resolve, reject) => {
        recorder.onstop = () => resolve();
        recorder.onerror = (e) => reject(e);
        recorder.stop();
        recorder.stream.getTracks().forEach((t) => t.stop());
      });

      webMediaRecorderRef.current = null;

      const chunks = webAudioChunksRef.current;
      if (!chunks.length) {
        setRecordingState("idle");
        Alert.alert("Sin audio", "No se capturó audio. Intenta de nuevo.");
        return;
      }

      const mimeType = webMimeTypeRef.current || "audio/webm";
      const blob = new Blob(chunks, { type: mimeType });

      if (blob.size < 1000) {
        setRecordingState("idle");
        Alert.alert("Audio muy corto", "Habla más tiempo e intenta de nuevo.");
        return;
      }

      const audioBase64 = await blobToBase64(blob);
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      await transcribeAndPreview(audioBase64, `audio.${ext}`);
    } catch (err) {
      console.error("Web stop recording error:", err);
      setRecordingState("idle");
      Alert.alert("Error", "No se pudo procesar el audio.");
    }
  };

  // ── Recording: Native ─────────────────────────────────────────────────────────

  const startRecordingNative = async () => {
    try {
      setMicError(null);
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        setMicError("Permiso de micrófono requerido. Actívalo en Configuración.");
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: true });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(SPEECH_RECORDING_OPTIONS);
      await recording.startAsync();
      nativeRecordingRef.current = recording;

      setRecordingState("recording");
      setShowSilentHint(false);
      silentHintTimerRef.current = setTimeout(() => setShowSilentHint(true), 3500);
    } catch (err: any) {
      console.error("Native recording start error:", err);
      setMicError("Error al iniciar grabación: " + (err.message || ""));
      setRecordingState("idle");
    }
  };

  const stopRecordingNative = async () => {
    if (silentHintTimerRef.current) clearTimeout(silentHintTimerRef.current);
    setShowSilentHint(false);

    const recording = nativeRecordingRef.current;
    if (!recording) { setRecordingState("idle"); return; }

    setRecordingState("processing");

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      nativeRecordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: true });

      if (!uri) { setRecordingState("idle"); return; }

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64" as any,
      });
      const ext = uri.split(".").pop() || "m4a";

      await transcribeAndPreview(audioBase64, `audio.${ext}`);
    } catch (err: any) {
      console.error("Native stop recording error:", err);
      setRecordingState("idle");
      Alert.alert("Error", "No se pudo procesar el audio.");
    }
  };

  // ── Shared transcription step ─────────────────────────────────────────────────

  const transcribeAndPreview = async (audioBase64: string, filename = "audio.m4a") => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);

      const res = await apiFetch(`${getApiUrl()}api/exam/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, filename }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        let detail = "";
        try {
          const errJson = await res.json();
          detail = errJson?.openai?.message || errJson?.error || "";
        } catch {
          detail = await res.text();
        }
        if (res.status === 413) {
          throw new Error("La grabación es demasiado larga. Intenta una respuesta más corta.");
        }
        throw new Error(detail || `Error del servidor (${res.status})`);
      }

      const { text } = await res.json();

      if (text && text.trim().length > 0) {
        setTranscript(text.trim());
        setRecordingState("preview");
      } else {
        setRecordingState("idle");
        Alert.alert(
          "Sin voz detectada",
          "No se detectó habla en el audio. Habla más cerca del micrófono e intenta de nuevo."
        );
      }
    } catch (err: any) {
      console.error("Transcription error:", err);
      setRecordingState("idle");
      const msg =
        err?.name === "AbortError"
          ? "La conexión tardó demasiado. Comprueba el WiFi o prueba datos móviles."
          : err?.message?.includes("Network request failed") ||
              err?.message?.includes("Failed to fetch")
            ? "Sin conexión al servidor. En WiFi, asegúrate de tener internet y que la app esté actualizada."
            : err?.message || "No se pudo convertir el audio a texto.";
      Alert.alert("Error de transcripción", msg);
    }
  };

  // ── Mic toggle ────────────────────────────────────────────────────────────────

  const handleMicToggle = async () => {
    if (isStreaming) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMicError(null);

    if (recordingState === "recording") {
      if (Platform.OS === "web") {
        await stopRecordingWeb();
      } else {
        await stopRecordingNative();
      }
    } else if (recordingState === "idle") {
      // Stop TTS if playing
      if (Platform.OS === "web" && webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current.src = "";
        webAudioRef.current = null;
        setIsTTSPlaying(false);
      } else if (nativeSoundRef.current) {
        await nativeSoundRef.current.stopAsync().catch(() => {});
        setIsTTSPlaying(false);
      }

      if (Platform.OS === "web") {
        await startRecordingWeb();
      } else {
        await startRecordingNative();
      }
    }
  };

  const handleDeleteTranscript = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTranscript("");
    setRecordingState("idle");
  };

  const handleSendTranscript = async () => {
    const text = transcript.trim();
    if (!text || isStreaming || sendLockRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTranscript("");
    setRecordingState("idle");

    const userMsg = addMessage({ role: "user", content: text });
    const withUser = [...messagesRef.current, userMsg];
    messagesRef.current = withUser;
    setMessages(withUser);
    persistDraft();

    const englishWords = detectEnglishWords(text);
    if (englishWords.length > 0) {
      try {
        const res = await apiFetch(`${getApiUrl()}api/exam/english-feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, englishWords }),
        });
        if (res.ok) {
          const { content } = (await res.json()) as { content: string };
          const tipMsg = addMessage({ role: "assistant", content, kind: "english-tip" });
          const withTip = [...messagesRef.current, tipMsg];
          messagesRef.current = withTip;
          setMessages(withTip);
          persistDraft();
        }
      } catch {
        // Non-blocking — examiner reply still proceeds
      }
    }

    await sendToAI(messagesRef.current);
  };

  const handleRegenerateQuestion = useCallback(async () => {
    if (isStreaming || sendLockRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const withoutLastAI = [...messagesRef.current];
    while (
      withoutLastAI.length > 0 &&
      withoutLastAI[withoutLastAI.length - 1].role === "assistant"
    ) {
      withoutLastAI.pop();
    }
    messagesRef.current = withoutLastAI;
    setMessages(withoutLastAI);
    replaceMessages(withoutLastAI);
    persistDraft();
    await sendToAI(withoutLastAI, true);
  }, [isStreaming, persistDraft, replaceMessages]);

  const handleSkipQuestion = useCallback(async () => {
    if (isStreaming || sendLockRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSessionTurn((prev) => {
      const next = Math.min(prev + 1, TOTAL_TURNS);
      sessionTurnRef.current = next;
      return next;
    });
    const skipMsg: Message = {
      id: generateMsgId(),
      role: "user",
      content: "[El estudiante quiere saltar esta pregunta y continuar con otra diferente.]",
      timestamp: Date.now(),
    };
    await sendToAI([...messagesRef.current, skipMsg], false, true);
  }, [isStreaming]);

  const doNewSession = () => {
    void progress.clearModuleSnapshot("exam");
    messagesRef.current = [];
    sessionTurnRef.current = 0;
    setMessages([]);
    setSessionTurn(0);
    setTranscript("");
    setRecordingState("idle");
    setMicError(null);
    initializedRef.current = false;
    setTimeout(() => {
      initializedRef.current = true;
      void sendToAI([]);
    }, 100);
  };

  const doExit = async () => {
    nativeRecordingRef.current?.stopAndUnloadAsync().catch(() => {});
    nativeSoundRef.current?.unloadAsync().catch(() => {});
    webMediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    if (webAudioRef.current) { webAudioRef.current.pause(); webAudioRef.current.src = ""; }
    persistDraft();
    router.replace("/");
  };

  const handleNewSession = () => {
    if (Platform.OS === "web") { doNewSession(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Nueva sesión", "¿Quieres reiniciar la sesión con un nuevo tema?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Reiniciar", style: "destructive", onPress: doNewSession },
    ]);
  };

  const handleExit = () => {
    if (Platform.OS === "web") { doExit(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Salir de la sesión", "¿Estás seguro de que quieres salir?", [
      { text: "Continuar practicando", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: doExit },
    ]);
  };

  const doFinish = async () => {
    nativeSoundRef.current?.unloadAsync().catch(() => {});
    nativeRecordingRef.current?.stopAndUnloadAsync().catch(() => {});
    webMediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    if (webAudioRef.current) { webAudioRef.current.pause(); webAudioRef.current.src = ""; }
    await progress.clearModuleSnapshot("exam");
    const session = await endSession();
    router.replace({ pathname: "/summary", params: { sessionId: session?.id } });
  };

  const handleFinish = () => {
    if (Platform.OS === "web") { doFinish(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Terminar examen", "¿Deseas terminar esta sesión y ver tu resumen?", [
      { text: "Continuar", style: "cancel" },
      { text: "Ver resumen", onPress: doFinish },
    ]);
  };

  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const lastMsgIsAssistant =
    lastMsg?.role === "assistant" && lastMsg.kind !== "english-tip";
  const canRegenerate = lastMsgIsAssistant && !isStreaming && recordingState === "idle";

  const handleReplayMessage = async (msgId: string, content: string) => {
    if (isStreaming) return;
    await playTTS(content, msgId);
  };

  const micDisabled = isStreaming || recordingState === "processing" || recordingState === "preview";

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.themeIndicator, { backgroundColor: themeColor + "22" }]}>
            <Ionicons name={themeData.iconName as any} size={16} color={themeColor} />
          </View>
          <View>
            <Text style={[styles.headerTheme, { color: themeColor }]}>SPANISH B • TEMA ACTUAL</Text>
            <Text style={[styles.headerThemeName, { color: colors.text }]}>{themeData.name}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={handleNewSession} style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable onPress={handleFinish} style={({ pressed }) => [styles.finishBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.finishText, { color: colors.textSecondary }]}>Terminar</Text>
          </Pressable>
          <Pressable onPress={handleExit} style={({ pressed }) => [styles.iconBtn, { backgroundColor: "#FF4444" + "18", borderColor: "#FF4444" + "40", opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="close" size={18} color="#FF4444" />
          </Pressable>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.progressTrack, { backgroundColor: colors.cardAlt }]}>
          <View style={[styles.progressFill, { backgroundColor: themeColor, width: `${Math.round(progressFraction * 100)}%` as any }]} />
        </View>
        <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
          {remaining > 0
            ? `Pregunta ${currentQuestion} de ${TOTAL_TURNS} • ~${timeEstimate} min restantes`
            : "Sesión completa — puedes terminar cuando quieras"}
        </Text>
      </View>

      {/* Message list */}
      <View style={{ flex: 1, minHeight: 0 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          extraData={{ count: messages.length, canRegenerate }}
          renderItem={({ item, index }) => (
            <MessageBubble
              message={item}
              themeColor={themeColor}
              isDark={isDark}
              isLast={index === messages.length - 1}
              onReplay={() => handleReplayMessage(item.id, item.content)}
              onRegenerate={handleRegenerateQuestion}
              onSkip={handleSkipQuestion}
              canRegenerate={canRegenerate}
              onWordPress={(word, context) => setWordPopup({ word, context })}
            />
          )}
          ListFooterComponent={
            showTyping ? (
              <View style={[styles.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.typingAvatar, { backgroundColor: themeColor + "22", borderColor: themeColor + "44" }]}>
                  <Ionicons name="school-outline" size={14} color={themeColor} />
                </View>
                <TypingIndicator color={themeColor} />
              </View>
            ) : null
          }
          contentContainerStyle={styles.listContent}
        />
      </View>

      {/* Voice input area */}
      <View style={[styles.voiceArea, { paddingBottom: botPad + 16, backgroundColor: colors.card, borderTopColor: colors.border }]}>

        {/* Mic error banner */}
        {micError && (
          <View style={[styles.errorBanner, { backgroundColor: "#FF4444" + "15", borderColor: "#FF4444" + "40" }]}>
            <Ionicons name="warning-outline" size={15} color="#FF4444" />
            <Text style={styles.errorBannerText} numberOfLines={3}>{micError}</Text>
          </View>
        )}

        {/* Transcript preview card */}
        {recordingState === "preview" && (
          <View style={[styles.transcriptCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.transcriptLabel, { color: colors.textSecondary }]}>Tu respuesta (editable):</Text>
            <TextInput
              style={[styles.transcriptText, styles.transcriptInput, { color: colors.text, borderColor: colors.border }]}
              value={transcript}
              onChangeText={setTranscript}
              multiline
              scrollEnabled={false}
              autoCorrect={false}
              spellCheck={false}
            />
            <View style={styles.transcriptActions}>
              <Pressable onPress={handleDeleteTranscript} style={({ pressed }) => [styles.transcriptDeleteBtn, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}>
                <Ionicons name="trash-outline" size={16} color="#FF4444" />
                <Text style={styles.transcriptDeleteText}>Borrar</Text>
              </Pressable>
              <Pressable onPress={handleSendTranscript} style={({ pressed }) => [styles.transcriptSendBtn, { opacity: pressed ? 0.8 : 1 }]}>
                <LinearGradient colors={[themeColor, themeData.colorDark]} style={styles.transcriptSendGrad}>
                  <Text style={styles.transcriptSendText}>Enviar</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        )}

        {/* Mic button */}
        <Pressable
          onPress={handleMicToggle}
          disabled={micDisabled}
          style={({ pressed }) => [{ opacity: micDisabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
        >
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Animated.View style={[styles.micRing, { borderColor: "#FF4444", opacity: ringOpacity }]} />
            <LinearGradient
              colors={recordingState === "recording" ? ["#FF4444", "#CC2222"] : [themeColor, themeData.colorDark]}
              style={styles.micBtn}
            >
              <Ionicons
                name={
                  recordingState === "recording" ? "stop" :
                  recordingState === "processing" ? "hourglass-outline" : "mic"
                }
                size={36}
                color="#fff"
              />
            </LinearGradient>
          </Animated.View>
        </Pressable>

        {/* Status label */}
        <Text style={[styles.statusLabel, { color: recordingState === "recording" ? "#FF4444" : colors.textSecondary }]}>
          {recordingState === "recording" && !showSilentHint
            ? "Escuchando..."
            : recordingState === "recording" && showSilentHint
            ? "Puedes empezar a hablar"
            : recordingState === "processing"
            ? "Procesando voz..."
            : recordingState === "preview"
            ? "Revisa tu respuesta arriba"
            : isStreaming
            ? "El examinador está respondiendo..."
            : isTTSPlaying
            ? "El examinador está hablando..."
            : "Toca para hablar"}
        </Text>

        {isTTSPlaying && (
          <View style={[styles.ttsBadge, { backgroundColor: themeColor + "18", borderColor: themeColor + "40" }]}>
            <Ionicons name="volume-high-outline" size={14} color={themeColor} />
            <Text style={[styles.ttsBadgeText, { color: themeColor }]}>
              Toca el micrófono para interrumpir
            </Text>
          </View>
        )}

        {recordingState === "idle" && !isStreaming && !isTTSPlaying && !micError && (
          <Text style={[styles.micHint, { color: colors.textSecondary }]}>
            Toca el micrófono para responder · Toca una palabra para definirla
          </Text>
        )}
      </View>

      {/* Word explanation modal */}
      {wordPopup && (
        <WordModal
          word={wordPopup.word}
          context={wordPopup.context}
          onClose={() => setWordPopup(null)}
          themeColor={themeColor}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  themeIndicator: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerTheme: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 1 },
  headerThemeName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  finishBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  finishText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  progressContainer: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  progressTrack: { height: 5, borderRadius: 3, overflow: "hidden", marginBottom: 6 },
  progressFill: { height: "100%", borderRadius: 3 },
  progressLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  listContent: { paddingTop: 12, paddingBottom: 8 },
  typingBubble: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginVertical: 4, borderRadius: 18, borderBottomLeftRadius: 4, borderWidth: 1, alignSelf: "flex-start", gap: 8, paddingLeft: 8 },
  typingAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, margin: 4 },
  voiceArea: { paddingHorizontal: 24, paddingTop: 16, borderTopWidth: 1, alignItems: "center", gap: 10 },
  errorBanner: { width: "100%", flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  errorBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#FF4444", lineHeight: 18 },
  transcriptCard: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 14 },
  transcriptLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  transcriptText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22, marginBottom: 12 },
  transcriptInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, minHeight: 60 },
  transcriptActions: { flexDirection: "row", gap: 10 },
  transcriptDeleteBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, borderWidth: 1, paddingVertical: 10 },
  transcriptDeleteText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#FF4444" },
  transcriptSendBtn: { flex: 2, borderRadius: 12, overflow: "hidden" },
  transcriptSendGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  transcriptSendText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  micRing: { position: "absolute", width: 96, height: 96, borderRadius: 48, borderWidth: 3, top: -8, left: -8 },
  micBtn: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  statusLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  micHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  ttsBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  ttsBadgeText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
