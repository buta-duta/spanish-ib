import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";

import Colors from "@/constants/colors";

export type WordInfo = { phonetic: string; meaning: string; partOfSpeech: string };

// Module-level caches — persist across screen renders
export const wordExplainCache = new Map<string, WordInfo>();

function getApiUrl() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/`;
  return "http://localhost:80/";
}

// ── WordModal ─────────────────────────────────────────────────────────────────
export function WordModal({
  word,
  context,
  themeColor,
  onClose,
}: {
  word: string;
  context: string;
  themeColor: string;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WordInfo | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }).start();
    const cached = wordExplainCache.get(word.toLowerCase());
    if (cached) { setData(cached); setLoading(false); return; }
    globalThis.fetch(`${getApiUrl()}api/exam/word`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, context: context.slice(0, 300) }),
    })
      .then((r) => r.json())
      .then((d: WordInfo) => { wordExplainCache.set(word.toLowerCase(), d); setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [word]);

  const playWord = async () => {
    if (ttsLoading) return;
    setTtsLoading(true);
    try {
      const res = await globalThis.fetch(`${getApiUrl()}api/exam/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: word }),
      });
      const { audioBase64 } = await res.json();
      if (Platform.OS === "web") {
        const audio = new (globalThis as any).Audio(`data:audio/mp3;base64,${audioBase64}`);
        audio.play();
      } else {
        const path = (FileSystem.cacheDirectory ?? "") + "word_tts.mp3";
        await FileSystem.writeAsStringAsync(path, audioBase64, { encoding: "base64" as any });
        const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
        sound.setOnPlaybackStatusUpdate((s) => { if (s.isLoaded && s.didJustFinish) sound.unloadAsync(); });
      }
    } catch { } finally { setTtsLoading(false); }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={wStyles.overlay} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <Animated.View style={[wStyles.card, { backgroundColor: colors.card, borderColor: colors.border, transform: [{ scale: scaleAnim }] }]}>
            <View style={wStyles.cardHeader}>
              <Text style={[wStyles.wordText, { color: colors.text }]}>{word}</Text>
              <Pressable onPress={onClose} style={({ pressed }) => [wStyles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            {loading ? (
              <ActivityIndicator color={themeColor} style={{ marginVertical: 20 }} />
            ) : data ? (
              <>
                <View style={wStyles.phoneticRow}>
                  <Text style={[wStyles.phonetic, { color: themeColor }]}>/{data.phonetic}/</Text>
                  <Pressable onPress={playWord} style={({ pressed }) => [wStyles.ttsBtn, { backgroundColor: themeColor + "20", opacity: pressed ? 0.6 : 1 }]}>
                    {ttsLoading
                      ? <ActivityIndicator size="small" color={themeColor} />
                      : <Ionicons name="volume-medium-outline" size={18} color={themeColor} />}
                  </Pressable>
                </View>
                {!!data.partOfSpeech && (
                  <Text style={[wStyles.pos, { color: colors.textSecondary }]}>{data.partOfSpeech}</Text>
                )}
                <View style={[wStyles.divider, { backgroundColor: colors.border }]} />
                <Text style={[wStyles.meaning, { color: colors.text }]}>{data.meaning}</Text>
              </>
            ) : (
              <Text style={{ color: colors.textSecondary, textAlign: "center", paddingVertical: 12 }}>No disponible</Text>
            )}
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── TappableText helpers ──────────────────────────────────────────────────────
export function cleanWord(token: string): string {
  return token.replace(/^[¿¡«"'([\s]+|[.,;:!?»"')[\]\s]+$/g, "").toLowerCase().trim();
}

export function tokenizeText(text: string): Array<{ display: string; clean: string; idx: number }> {
  return text.split(/(\s+)/).map((part, idx) => ({
    display: part,
    clean: /^\s+$/.test(part) ? "" : cleanWord(part),
    idx,
  }));
}

// ── TappableText component ─────────────────────────────────────────────────────
export function TappableText({
  text,
  textStyle,
  onWordPress,
}: {
  text: string;
  textStyle?: object;
  onWordPress: (word: string, context: string) => void;
}) {
  const tokens = tokenizeText(text);
  return (
    <Text style={textStyle}>
      {tokens.map((t) =>
        t.clean.length >= 2 ? (
          <Text
            key={t.idx}
            suppressHighlighting={false}
            onPress={() => onWordPress(t.clean, text)}
            style={textStyle}
          >
            {t.display}
          </Text>
        ) : (
          <Text key={t.idx} style={textStyle}>{t.display}</Text>
        )
      )}
    </Text>
  );
}

const wStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: 300, borderRadius: 22, borderWidth: 1, padding: 22, shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  wordText: { fontSize: 30, fontFamily: "Inter_700Bold", flex: 1 },
  closeBtn: { padding: 4 },
  phoneticRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  phonetic: { fontSize: 16, fontFamily: "Inter_400Regular", flex: 1, fontStyle: "italic" },
  ttsBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  pos: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  divider: { height: 1, marginBottom: 10 },
  meaning: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
});
