import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { fetch } from "expo/fetch";
import React, { useEffect, useRef, useState } from "react";
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
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { getThemeById } from "@/constants/themes";
import { useIBTheme } from "@/contexts/ThemeContext";
import { useExam, type Message, generateMsgId } from "@/contexts/ExamContext";

function TypingIndicator({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
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
        <Animated.View
          key={i}
          style={[typingStyles.dot, { backgroundColor: color, opacity: dot }]}
        />
      ))}
    </View>
  );
}

const typingStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

function MessageBubble({ message, themeColor, isDark }: { message: Message; themeColor: string; isDark: boolean }) {
  const colors = Colors[isDark ? "dark" : "light"];
  const isUser = message.role === "user";

  return (
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
        <Text
          style={[
            bubbleStyles.text,
            { color: isUser ? "#fff" : colors.text },
          ]}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  container: { marginVertical: 4, paddingHorizontal: 16 },
  userContainer: { flexDirection: "row", justifyContent: "flex-end" },
  assistantContainer: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  text: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
});

export default function ExamScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const { selectedTheme } = useIBTheme();
  const { currentSession, addMessage, endSession } = useExam();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [sessionTurn, setSessionTurn] = useState(0);

  const inputRef = useRef<TextInput>(null);
  const initializedRef = useRef(false);
  const flatListRef = useRef<FlatList>(null);

  const themeData = selectedTheme || getThemeById("identidades")!;
  const themeColor = themeData.color;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

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

  const getApiUrl = () => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (domain) return `https://${domain}/`;
    return "http://localhost:80/";
  };

  const sendToAI = async (chatMessages: Message[]) => {
    setIsStreaming(true);
    setShowTyping(true);

    try {
      const apiMessages = chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(`${getApiUrl()}api/exam/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          messages: apiMessages,
          theme: themeData.id,
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
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: fullContent,
                  };
                  return updated;
                });
              }
            }
          } catch { }
        }
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

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText("");
    inputRef.current?.focus();

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

  const handleFinish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Terminar examen",
      "¿Deseas terminar esta sesión de práctica?",
      [
        { text: "Continuar", style: "cancel" },
        {
          text: "Terminar",
          style: "destructive",
          onPress: async () => {
            const session = await endSession();
            router.replace({
              pathname: "/summary",
              params: { sessionId: session?.id },
            });
          },
        },
      ]
    );
  };

  const reversedMessages = [...messages].reverse();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.themeIndicator, { backgroundColor: themeColor + "22" }]}>
            <Ionicons name={themeData.iconName as any} size={16} color={themeColor} />
          </View>
          <View>
            <Text style={[styles.headerTheme, { color: themeColor }]}>
              Tema actual
            </Text>
            <Text style={[styles.headerThemeName, { color: colors.text }]}>
              {themeData.name}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={handleFinish}
          style={({ pressed }) => [
            styles.finishBtn,
            { backgroundColor: colors.cardAlt, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.finishText, { color: colors.textSecondary }]}>
            Terminar
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} themeColor={themeColor} isDark={isDark} />
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
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />

        {/* Input area */}
        <View
          style={[
            styles.inputArea,
            {
              paddingBottom: botPad + 10,
              backgroundColor: colors.card,
              borderTopColor: colors.border,
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
                fontFamily: "Inter_400Regular",
              },
            ]}
            placeholder="Escribe tu respuesta en español..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            blurOnSubmit={false}
            editable={!isStreaming}
          />
          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || isStreaming}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                opacity: !inputText.trim() || isStreaming ? 0.4 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <LinearGradient
              colors={[themeColor, themeData.colorDark]}
              style={styles.sendBtnGradient}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  themeIndicator: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTheme: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  headerThemeName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  finishBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  finishText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    alignSelf: "flex-start",
    gap: 8,
    paddingLeft: 8,
  },
  typingAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    margin: 4,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    borderRadius: 22,
    overflow: "hidden",
  },
  sendBtnGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
