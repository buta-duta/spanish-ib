import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { TappableText } from "@/components/WordModal";
import { apiFetch, getApiUrl } from "@/lib/api";

const SPEED_OPTIONS = [0.8, 1, 1.25, 1.5, 1.75, 2];

type Colors = { card: string; cardAlt: string; text: string; textSecondary: string; border: string };
type Status = "idle" | "loading" | "ready" | "playing" | "paused" | "ended";

// Self-contained TTS audio player for a single listening passage.
export function PassageAudioPlayer({
  text,
  accent,
  colors,
  cacheKey,
  onWordPress,
}: {
  text: string;
  accent: string;
  colors: Colors;
  cacheKey: string;
  onWordPress?: (word: string, ctx: string) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [speed, setSpeed] = useState(1);
  const [playCount, setPlayCount] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const audioRef = useRef<string | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const nativeSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current = null;
      }
      nativeSoundRef.current?.unloadAsync().catch(() => {});
      nativeSoundRef.current = null;
    };
  }, []);

  const ensureAudio = async (): Promise<string | null> => {
    if (audioRef.current) return audioRef.current;
    setStatus("loading");
    try {
      const res = await apiFetch(`${getApiUrl()}api/listening/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passage: text }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const data = await res.json();
      audioRef.current = data.audioBase64 as string;
      return audioRef.current;
    } catch {
      setStatus("idle");
      return null;
    }
  };

  const play = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const base64 = await ensureAudio();
    if (!base64) return;

    if (Platform.OS === "web") {
      if (!webAudioRef.current) {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const blobUrl = URL.createObjectURL(blob);
        const audio = new (window as any).Audio(blobUrl) as HTMLAudioElement;
        webAudioRef.current = audio;
        audio.playbackRate = speed;
        audio.onended = () => { URL.revokeObjectURL(blobUrl); webAudioRef.current = null; setStatus("ended"); };
        audio.onerror = () => { URL.revokeObjectURL(blobUrl); webAudioRef.current = null; setStatus("ready"); };
        setPlayCount((c) => c + 1);
      } else {
        webAudioRef.current.playbackRate = speed;
      }
      await webAudioRef.current.play();
      setStatus("playing");
    } else {
      try {
        if (!nativeSoundRef.current) {
          await Audio.setAudioModeAsync({ staysActiveInBackground: true, playsInSilentModeIOS: true });
          const path = (FileSystem.cacheDirectory ?? "") + `listening_${cacheKey}.mp3`;
          await FileSystem.writeAsStringAsync(path, base64, { encoding: "base64" });
          const { sound } = await Audio.Sound.createAsync({ uri: path });
          nativeSoundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((st) => {
            if (!st.isLoaded) return;
            if (st.didJustFinish) {
              nativeSoundRef.current = null;
              sound.unloadAsync().catch(() => {});
              setStatus("ended");
            }
          });
          setPlayCount((c) => c + 1);
        }
        await nativeSoundRef.current!.setStatusAsync({ shouldPlay: true, rate: speed, shouldCorrectPitch: true });
        setStatus("playing");
      } catch {
        setStatus("ready");
      }
    }
  };

  const pause = async () => {
    if (Platform.OS === "web") {
      webAudioRef.current?.pause();
    } else {
      await nativeSoundRef.current?.setStatusAsync({ shouldPlay: false });
    }
    setStatus("paused");
  };

  const changeSpeed = async (sp: number) => {
    setSpeed(sp);
    try {
      if (Platform.OS === "web") {
        if (webAudioRef.current) { webAudioRef.current.pause(); webAudioRef.current.currentTime = 0; }
      } else {
        await nativeSoundRef.current?.setStatusAsync({ shouldPlay: false, positionMillis: 0 }).catch(() => {});
      }
    } catch {}
    if (status === "playing" || status === "paused") setStatus("ready");
  };

  const isPlaying = status === "playing";

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.row}>
        <Pressable
          onPress={isPlaying ? pause : play}
          disabled={status === "loading"}
          style={({ pressed }) => [s.playBtn, { backgroundColor: accent, opacity: pressed || status === "loading" ? 0.75 : 1 }]}
        >
          {status === "loading" ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name={isPlaying ? "pause" : "play"} size={22} color="#fff" />
          )}
        </Pressable>
        <Pressable
          onPress={() => setShowTranscript((v) => !v)}
          style={[s.transcriptBtn, { borderColor: accent, backgroundColor: showTranscript ? accent : "transparent" }]}
        >
          <Text style={[s.transcriptIcon, { color: showTranscript ? "#fff" : accent }]}>
            {showTranscript ? "v" : "^"}
          </Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.statusText, { color: colors.text }]}>
            {status === "loading"
              ? "Generando audio…"
              : isPlaying
              ? "Reproduciendo"
              : status === "paused"
              ? "Pausado"
              : status === "ended"
              ? "Finalizado"
              : "Reproducir audio"}
          </Text>
          <Text style={[s.countText, { color: colors.textSecondary }]}>Reproducciones: {playCount}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.speedRow}>
        {SPEED_OPTIONS.map((sp) => (
          <Pressable
            key={sp}
            onPress={() => changeSpeed(sp)}
            style={[s.speedBtn, { backgroundColor: speed === sp ? accent : colors.cardAlt, borderColor: speed === sp ? accent : colors.border }]}
          >
            <Text style={[s.speedText, { color: speed === sp ? "#fff" : colors.textSecondary }]}>{sp}x</Text>
          </Pressable>
        ))}
      </ScrollView>
      {showTranscript && (
        <View style={[s.transcriptCard, { borderColor: colors.border, backgroundColor: colors.cardAlt }]}>
          <Text style={[s.transcriptLabel, { color: colors.textSecondary }]}>Transcripción</Text>
          {text.split("\n").filter(Boolean).map((para, idx) => (
            <TappableText
              key={idx}
              text={para}
              textStyle={[s.transcriptText, { color: colors.text }]}
              onWordPress={onWordPress ?? (() => {})}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  playBtn: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  transcriptBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  transcriptIcon: { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 20 },
  statusText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  countText: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  speedRow: { gap: 6 },
  speedBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  speedText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  transcriptCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  transcriptLabel: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.6 },
  transcriptText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
});
