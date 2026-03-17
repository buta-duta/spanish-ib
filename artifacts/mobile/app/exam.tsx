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
  canRegenerate,
}: {
  message: Message;
  themeColor: string;
  isDark: boolean;
  isLast: boolean;
  onRegenerate: () => void;
  canRegenerate: boolean;
}) {
  const colors = Colors[isDark ? "dark" : "light"];
  const isUser = message.role === "user";

  return (
    <View>
      <View
        style={[
          bubbleStyles.container,
          isUser ? bubbleStyles.userContainer : bubbleStyles.assistantContainer,
        ]}
      >
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
        <Pressable
          onPress={onRegenerate}
          style={({ pressed }) => [bubbleStyles.regenBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="refresh-outline" size={13} color={themeColor} />
          <Text style={[bubbleStyles.regenText, { color: themeColor }]}>Otra pregunta</Text>
        </Pressable>
      )}
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  container: { marginVertical: 4, paddingHorizontal: 16 },
  userContainer: { flexDirection: "row", justifyContent: "flex-end" },
  assistantContainer: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  text: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  regenBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginLeft: 52, marginTop: 4, marginBottom: 4, alignSelf: "flex-start",
  },
  regenText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});

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

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
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
      soundRef.current?.unloadAsync().catch(() => {});
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

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

  const sendToAI = async (chatMessages: Message[], regenerate = false) => {
    setIsStreaming(true);
    setShowTyping(true);

    try {
      const apiMessages = chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await expoFetch(`${getApiUrl()}api/exam/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          messages: apiMessages,
          theme: themeData.id,
          sessionTurn,
          regenerate,
        }),
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
                const newMsg: Message = {
                  id: generateMsgId(),
                  role: "assistant",
                  content: fullContent,
                  timestamp: Date.now(),
                };
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

      if (fullContent) {
        playTTS(fullContent);
      }
    } catch (error) {
      setShowTyping(false);
      const errMsg: Message = {
        id: generateMsgId(),
        role: "assistant",
        content: "Lo siento, hubo un error. Por favor intenta de nuevo.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsStreaming(false);
      setShowTyping(false);
      setSessionTurn((prev) => prev + 1);
    }
  };

  const playTTS = async (text: string) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setIsTTSPlaying(true);

      const response = await globalThis.fetch(`${getApiUrl()}api/exam/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error("TTS failed");
      const { audioBase64 } = await response.json();

      let soundUri: string;
      if (Platform.OS === "web") {
        soundUri = `data:audio/mp3;base64,${audioBase64}`;
      } else {
        const path = (FileSystem.cacheDirectory ?? "") + "exam_tts.mp3";
        await FileSystem.writeAsStringAsync(path, audioBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        soundUri = path;
      }

      const { sound } = await Audio.Sound.createAsync({ uri: soundUri }, { shouldPlay: true });
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsTTSPlaying(false);
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch {
      setIsTTSPlaying(false);
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso requerido", "Necesitamos acceso al micrófono para continuar.");
        return;
      }

      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
        setIsTTSPlaying(false);
      }

      if (Platform.OS !== "web") {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      }

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;

      setRecordingState("recording");
      setShowSilentHint(false);

      silentHintTimerRef.current = setTimeout(() => setShowSilentHint(true), 3500);
    } catch (error) {
      Alert.alert("Error de micrófono", "No se pudo iniciar la grabación. Por favor verifica los permisos.");
    }
  };

  const stopRecording = async () => {
    if (silentHintTimerRef.current) clearTimeout(silentHintTimerRef.current);
    setShowSilentHint(false);

    const recording = recordingRef.current;
    if (!recording) return;

    setRecordingState("processing");

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) {
        setRecordingState("idle");
        return;
      }

      let audioBase64: string;
      if (Platform.OS === "web") {
        const res = await globalThis.fetch(uri);
        const blob = await res.blob();
        const ab = await blob.arrayBuffer();
        const bytes = new Uint8Array(ab);
        let binary = "";
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        audioBase64 = btoa(binary);
      } else {
        audioBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const transcribeRes = await globalThis.fetch(`${getApiUrl()}api/exam/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64 }),
      });

      if (!transcribeRes.ok) throw new Error("Transcription failed");
      const { text } = await transcribeRes.json();

      if (text && text.trim()) {
        setTranscript(text.trim());
        setRecordingState("preview");
        if (Platform.OS !== "web") {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        }
      } else {
        setRecordingState("idle");
        Alert.alert(
          "Sin voz detectada",
          "No se escuchó nada. ¿Intenta de nuevo?",
          [{ text: "OK" }]
        );
      }
    } catch {
      setRecordingState("idle");
      Alert.alert("Error", "No se pudo procesar el audio. Por favor intenta de nuevo.");
    }
  };

  const handleMicToggle = async () => {
    if (isStreaming) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (recordingState === "recording") {
      await stopRecording();
    } else if (recordingState === "idle") {
      await startRecording();
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
    const userMsg: Message = {
      id: generateMsgId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

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

  const handleNewSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Nueva sesión",
      "¿Quieres reiniciar la sesión con un nuevo tema?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Reiniciar",
          style: "destructive",
          onPress: () => {
            setMessages([]);
            setSessionTurn(0);
            setTranscript("");
            setRecordingState("idle");
            initializedRef.current = false;
            setTimeout(() => {
              initializedRef.current = true;
              sendToAI([]);
            }, 100);
          },
        },
      ]
    );
  };

  const handleExit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Salir de la sesión",
      "¿Estás seguro de que quieres salir?",
      [
        { text: "Continuar practicando", style: "cancel" },
        {
          text: "Salir",
          style: "destructive",
          onPress: async () => {
            recordingRef.current?.stopAndUnloadAsync().catch(() => {});
            soundRef.current?.unloadAsync().catch(() => {});
            router.replace("/");
          },
        },
      ]
    );
  };

  const handleFinish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Terminar examen",
      "¿Deseas terminar esta sesión y ver tu resumen?",
      [
        { text: "Continuar", style: "cancel" },
        {
          text: "Ver resumen",
          style: "default",
          onPress: async () => {
            soundRef.current?.unloadAsync().catch(() => {});
            recordingRef.current?.stopAndUnloadAsync().catch(() => {});
            const session = await endSession();
            router.replace({ pathname: "/summary", params: { sessionId: session?.id } });
          },
        },
      ]
    );
  };

  const lastMsgIsAssistant = messages.length > 0 && messages[messages.length - 1].role === "assistant";
  const canRegenerate = lastMsgIsAssistant && !isStreaming && recordingState === "idle";
  const reversedMessages = [...messages].reverse();

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
          <Pressable
            onPress={handleNewSession}
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            hitSlop={8}
          >
            <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={handleFinish}
            style={({ pressed }) => [styles.finishBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.finishText, { color: colors.textSecondary }]}>Terminar</Text>
          </Pressable>
          <Pressable
            onPress={handleExit}
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: "#FF4444" + "18", borderColor: "#FF4444" + "40", opacity: pressed ? 0.7 : 1 }]}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color="#FF4444" />
          </Pressable>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.progressTrack, { backgroundColor: colors.cardAlt }]}>
          <Animated.View
            style={[styles.progressFill, { backgroundColor: themeColor, width: `${Math.round(progressFraction * 100)}%` as any }]}
          />
        </View>
        <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
          {remaining > 0
            ? `${remaining} pregunta${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""} • ~${timeEstimate} min restantes`
            : "Sesión completa — puedes terminar cuando quieras"}
        </Text>
      </View>

      {/* Message list */}
      <FlatList
        ref={flatListRef}
        data={reversedMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <MessageBubble
            message={item}
            themeColor={themeColor}
            isDark={isDark}
            isLast={index === 0}
            onRegenerate={handleRegenerateQuestion}
            canRegenerate={canRegenerate}
          />
        )}
        inverted={messages.length > 0}
        ListHeaderComponent={
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

      {/* Voice input area */}
      <View style={[styles.voiceArea, { paddingBottom: botPad + 16, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {/* Transcript preview */}
        {recordingState === "preview" && (
          <View style={[styles.transcriptCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.transcriptLabel, { color: colors.textSecondary }]}>Tu respuesta:</Text>
            <Text style={[styles.transcriptText, { color: colors.text }]}>{transcript}</Text>
            <View style={styles.transcriptActions}>
              <Pressable
                onPress={handleDeleteTranscript}
                style={({ pressed }) => [styles.transcriptDeleteBtn, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="trash-outline" size={16} color="#FF4444" />
                <Text style={styles.transcriptDeleteText}>Borrar</Text>
              </Pressable>
              <Pressable
                onPress={handleSendTranscript}
                style={({ pressed }) => [styles.transcriptSendBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <LinearGradient colors={[themeColor, themeData.colorDark]} style={styles.transcriptSendGrad}>
                  <Text style={styles.transcriptSendText}>Enviar</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        )}

        {/* Mic button */}
        <View style={styles.micRow}>
          <Pressable
            onPress={handleMicToggle}
            disabled={isStreaming || recordingState === "processing" || recordingState === "preview"}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          >
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Animated.View style={[styles.micRing, { borderColor: "#FF4444", opacity: ringOpacity }]} />
              <LinearGradient
                colors={recordingState === "recording" ? ["#FF4444", "#CC2222"] : [themeColor, themeData.colorDark]}
                style={styles.micBtn}
              >
                <Ionicons
                  name={recordingState === "recording" ? "stop" : recordingState === "processing" ? "hourglass-outline" : "mic"}
                  size={36}
                  color="#fff"
                />
              </LinearGradient>
            </Animated.View>
          </Pressable>

          {isTTSPlaying && (
            <View style={[styles.ttsBadge, { backgroundColor: themeColor + "22", borderColor: themeColor + "44" }]}>
              <Ionicons name="volume-high-outline" size={14} color={themeColor} />
              <Text style={[styles.ttsBadgeText, { color: themeColor }]}>Hablando...</Text>
            </View>
          )}
        </View>

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
            : "Toca para hablar"}
        </Text>

        {/* Hint below mic */}
        {recordingState === "idle" && !isStreaming && (
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
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
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
  typingBubble: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginVertical: 4,
    borderRadius: 18, borderBottomLeftRadius: 4,
    borderWidth: 1, alignSelf: "flex-start",
    gap: 8, paddingLeft: 8,
  },
  typingAvatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, margin: 4,
  },
  voiceArea: {
    paddingHorizontal: 24, paddingTop: 16,
    borderTopWidth: 1, alignItems: "center",
  },
  transcriptCard: {
    width: "100%", borderRadius: 16, borderWidth: 1,
    padding: 14, marginBottom: 16,
  },
  transcriptLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  transcriptText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22, marginBottom: 12 },
  transcriptActions: { flexDirection: "row", gap: 10 },
  transcriptDeleteBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, borderRadius: 12, borderWidth: 1, paddingVertical: 10,
  },
  transcriptDeleteText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#FF4444" },
  transcriptSendBtn: { flex: 2, borderRadius: 12, overflow: "hidden" },
  transcriptSendGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10,
  },
  transcriptSendText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  micRow: { alignItems: "center", justifyContent: "center", marginBottom: 12, position: "relative" },
  micRing: {
    position: "absolute", width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, top: -8, left: -8,
  },
  micBtn: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  statusLabel: { fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 4 },
  micHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  ttsBadge: {
    position: "absolute", right: -100, top: 28,
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  ttsBadgeText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
