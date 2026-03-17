import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { fetch as expoFetch } from "expo/fetch";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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
import { getThemeById } from "@/constants/themes";
import { useIBTheme } from "@/contexts/ThemeContext";
import { useExam, type Message, generateMsgId } from "@/contexts/ExamContext";

type RecordingState = "idle" | "recording" | "preview" | "processing";

const TOTAL_TURNS = 8;

function getApiUrl() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/`;
  return "http://localhost:80/";
}

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
}: {
  message: Message;
  themeColor: string;
  isDark: boolean;
  isLast: boolean;
  onRegenerate: () => void;
  onSkip: () => void;
  canRegenerate: boolean;
}) {
  const colors = Colors[isDark ? "dark" : "light"];
  const isUser = message.role === "user";

  return (
    <View>
      <View style={[bubbleStyles.container, isUser ? bubbleStyles.userContainer : bubbleStyles.assistantContainer]}>
        {!isUser && (
          <View style={[bubbleStyles.avatar, { backgroundColor: themeColor + "22", borderColor: themeColor + "44" }]}>
            <Ionicons name="school-outline" size={14} color={themeColor} />
          </View>
        )}
        <View
          style={[
            bubbleStyles.bubble,
            isUser
              ? { backgroundColor: themeColor, borderBottomRightRadius: 4 }
              : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
            { maxWidth: "82%" },
          ]}
        >
          <Text style={[bubbleStyles.text, { color: isUser ? "#fff" : colors.text }]}>
            {message.content}
          </Text>
        </View>
      </View>
      {!isUser && isLast && canRegenerate && (
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
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ExamScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const { selectedTheme } = useIBTheme();
  const { currentSession, addMessage, endSession } = useExam();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [sessionTurn, setSessionTurn] = useState(0);

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [showSilentHint, setShowSilentHint] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

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

  const themeData = selectedTheme || getThemeById("identidades")!;
  const themeColor = themeData.color;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const progressFraction = Math.min(sessionTurn / TOTAL_TURNS, 1);
  const remaining = Math.max(0, TOTAL_TURNS - sessionTurn);
  const timeEstimate = Math.round(remaining * 1.5);

  useEffect(() => {
    if (currentSession?.messages && !initializedRef.current) {
      setMessages(currentSession.messages);
      initializedRef.current = true;
    }
  }, [currentSession?.messages]);

  useEffect(() => {
    if (messages.length === 0 && !initializedRef.current) {
      initializedRef.current = true;
      sendToAI([]);
    }
  }, []);

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
    };
  }, []);

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
    setIsStreaming(true);
    setShowTyping(true);

    try {
      const apiMessages = chatMessages.map((m) => ({ role: m.role, content: m.content }));

      const response = await expoFetch(`${getApiUrl()}api/exam/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ messages: apiMessages, theme: themeData.id, sessionTurn, regenerate, skip }),
      });

      if (!response.ok) throw new Error("Failed to get response");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";
      let assistantAdded = false;

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
                setShowTyping(false);
                const newMsg: Message = { id: generateMsgId(), role: "assistant", content: fullContent, timestamp: Date.now() };
                setMessages((prev) => [...prev, newMsg]);
                addMessage({ role: "assistant", content: fullContent });
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

      if (fullContent) playTTS(fullContent);
    } catch {
      setShowTyping(false);
      const errMsg: Message = { id: generateMsgId(), role: "assistant", content: "Lo siento, hubo un error. Por favor intenta de nuevo.", timestamp: Date.now() };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsStreaming(false);
      setShowTyping(false);
      // Only count a turn when the student actually answered (has user messages),
      // not on the initial AI greeting, not on regeneration, and not on skip (skip pre-increments manually)
      const hasUserMessage = chatMessages.some((m) => m.role === "user");
      if (hasUserMessage && !regenerate && !skip) {
        setSessionTurn((prev) => prev + 1);
      }
    }
  };

  // ── TTS ───────────────────────────────────────────────────────────────────────

  const playTTS = async (text: string) => {
    try {
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

      const res = await globalThis.fetch(`${getApiUrl()}api/exam/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("TTS request failed");
      const { audioBase64 } = await res.json();
      if (!audioBase64) throw new Error("No audio data");

      if (Platform.OS === "web") {
        // Use HTML Audio element — most reliable on web
        const audio = new (window as any).Audio(`data:audio/mp3;base64,${audioBase64}`) as HTMLAudioElement;
        webAudioRef.current = audio;
        audio.onended = () => {
          setIsTTSPlaying(false);
          webAudioRef.current = null;
        };
        audio.onerror = () => setIsTTSPlaying(false);
        await audio.play();
      } else {
        // Native: write to filesystem then play
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
      await transcribeAndPreview(audioBase64);
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

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
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
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });

      if (!uri) { setRecordingState("idle"); return; }

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64" as any,
      });

      await transcribeAndPreview(audioBase64);
    } catch (err: any) {
      console.error("Native stop recording error:", err);
      setRecordingState("idle");
      Alert.alert("Error", "No se pudo procesar el audio.");
    }
  };

  // ── Shared transcription step ─────────────────────────────────────────────────

  const transcribeAndPreview = async (audioBase64: string) => {
    try {
      const res = await globalThis.fetch(`${getApiUrl()}api/exam/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64 }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Transcription failed: ${res.status} ${body}`);
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
      Alert.alert("Error de transcripción", "No se pudo convertir el audio a texto. Intenta de nuevo.");
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
    if (!text || isStreaming) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTranscript("");
    setRecordingState("idle");

    const currentMessages = [...messages];
    const userMsg: Message = { id: generateMsgId(), role: "user", content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    addMessage({ role: "user", content: text });
    await sendToAI([...currentMessages, userMsg]);
  };

  const handleRegenerateQuestion = useCallback(async () => {
    if (isStreaming) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const withoutLastAI = [...messages];
    while (withoutLastAI.length > 0 && withoutLastAI[withoutLastAI.length - 1].role === "assistant") {
      withoutLastAI.pop();
    }
    setMessages(withoutLastAI);
    await sendToAI(withoutLastAI, true);
  }, [messages, isStreaming]);

  const handleSkipQuestion = useCallback(async () => {
    if (isStreaming) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Count this as a used turn then ask a fresh unrelated question
    setSessionTurn((prev) => Math.min(prev + 1, TOTAL_TURNS));
    // Send the skip signal only to the API — don't show it as a visible bubble
    const skipMsg: Message = {
      id: generateMsgId(),
      role: "user",
      content: "[El estudiante quiere saltar esta pregunta y continuar con otra diferente.]",
      timestamp: Date.now(),
    };
    await sendToAI([...messages, skipMsg], false, true);
  }, [messages, isStreaming]);

  const doNewSession = () => {
    setMessages([]);
    setSessionTurn(0);
    setTranscript("");
    setRecordingState("idle");
    setMicError(null);
    initializedRef.current = false;
    setTimeout(() => { initializedRef.current = true; sendToAI([]); }, 100);
  };

  const doExit = async () => {
    nativeRecordingRef.current?.stopAndUnloadAsync().catch(() => {});
    nativeSoundRef.current?.unloadAsync().catch(() => {});
    webMediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    if (webAudioRef.current) { webAudioRef.current.pause(); webAudioRef.current.src = ""; }
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

  const lastMsgIsAssistant = messages.length > 0 && messages[messages.length - 1].role === "assistant";
  const canRegenerate = lastMsgIsAssistant && !isStreaming && recordingState === "idle";

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
            <Text style={[styles.headerTheme, { color: themeColor }]}>Tema actual</Text>
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
            ? `${remaining} pregunta${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""} • ~${timeEstimate} min restantes`
            : "Sesión completa — puedes terminar cuando quieras"}
        </Text>
      </View>

      {/* Message list */}
      <View style={{ flex: 1, minHeight: 0 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <MessageBubble
              message={item}
              themeColor={themeColor}
              isDark={isDark}
              isLast={index === messages.length - 1}
              onRegenerate={handleRegenerateQuestion}
              onSkip={handleSkipQuestion}
              canRegenerate={canRegenerate}
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
            Toca el micrófono para responder
          </Text>
        )}
      </View>
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
