import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { TappableText } from "@/components/WordModal";
import { PlayStopButton } from "@/components/PlayStopButton";
import { fetchListeningTts } from "@/lib/listeningTts";

const SPEED_OPTIONS = [0.8, 1, 1.25, 1.5, 1.75, 2];

type Colors = { card: string; cardAlt: string; text: string; textSecondary: string; border: string };
type Status = "idle" | "loading" | "ready" | "playing" | "paused" | "ended" | "error";

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
  const loadGenRef = useRef(0);

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

  const loadAudio = useCallback(async () => {
    if (!text.trim()) return;
    const gen = ++loadGenRef.current;
    audioRef.current = null;
    setPlayCount(0);
    setStatus("loading");
    if (webAudioRef.current) { webAudioRef.current.pause(); webAudioRef.current = null; }
    if (nativeSoundRef.current) { await nativeSoundRef.current.unloadAsync().catch(() => {}); nativeSoundRef.current = null; }

    const data = await fetchListeningTts(text);
    if (gen !== loadGenRef.current) return;
    if (!data?.audioBase64) {
      setStatus("error");
      return;
    }
    audioRef.current = data.audioBase64;
    setStatus("ready");
  }, [text]);

  useEffect(() => {
    loadAudio();
  }, [loadAudio, cacheKey]);

  const stopPlayback = async () => {
    if (Platform.OS === "web") {
      webAudioRef.current?.pause();
    } else {
      await nativeSoundRef.current?.setStatusAsync({ shouldPlay: false }).catch(() => {});
    }
    setStatus("ready");
  };

  const play = async () => {
    if (status === "loading" || status === "error") return;
    if (status === "playing") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await stopPlayback();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const base64 = audioRef.current;
    if (!base64) {
      await loadAudio();
      if (!audioRef.current) return;
    }
    const audio = audioRef.current!;

    if (Platform.OS === "web") {
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current.currentTime = 0;
        webAudioRef.current.playbackRate = speed;
        setPlayCount((c) => c + 1);
        await webAudioRef.current.play();
        setStatus("playing");
        return;
      }
      const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const blobUrl = URL.createObjectURL(blob);
      const el = new (window as any).Audio(blobUrl) as HTMLAudioElement;
      webAudioRef.current = el;
      el.playbackRate = speed;
      el.onended = () => { URL.revokeObjectURL(blobUrl); webAudioRef.current = null; setStatus("ended"); };
      el.onerror = () => { URL.revokeObjectURL(blobUrl); webAudioRef.current = null; setStatus("ready"); };
      setPlayCount((c) => c + 1);
      await el.play();
      setStatus("playing");
    } else {
      try {
        if (nativeSoundRef.current) {
          await nativeSoundRef.current.setStatusAsync({
            shouldPlay: true,
            positionMillis: 0,
            rate: speed,
            shouldCorrectPitch: true,
          });
          setPlayCount((c) => c + 1);
          setStatus("playing");
          return;
        }
        await Audio.setAudioModeAsync({ staysActiveInBackground: true, playsInSilentModeIOS: true });
        const path = (FileSystem.cacheDirectory ?? "") + `listening_${cacheKey}.mp3`;
        await FileSystem.writeAsStringAsync(path, audio, { encoding: "base64" });
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
        await sound.playAsync();
        setStatus("playing");
      } catch {
        setStatus("ready");
      }
    }
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
    if (status === "playing") setStatus("ready");
  };

  const isPlaying = status === "playing";

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.row}>
        {status === "error" ? (
          <Pressable
            onPress={loadAudio}
            style={[s.playBtn, { backgroundColor: accent }]}
          >
            <Ionicons name="refresh" size={22} color="#fff" />
          </Pressable>
        ) : (
          <PlayStopButton
            playing={isPlaying}
            loading={status === "loading"}
            disabled={status === "loading"}
            onPress={play}
            size={46}
            color="#fff"
            backgroundColor={accent}
          />
        )}
        <View style={s.meta}>
          <Text style={[s.statusText, { color: colors.text }]}>
            {status === "loading"
              ? "Generando audio…"
              : status === "error"
              ? "Error al generar audio"
              : isPlaying
              ? "Reproduciendo"
              : status === "ended"
              ? "Finalizado"
              : "Reproducir audio"}
          </Text>
          <Text style={[s.countText, { color: colors.textSecondary }]}>Reproducciones: {playCount}</Text>
        </View>
        <Pressable
          onPress={() => setShowTranscript((v) => !v)}
          style={[
            s.transcriptPill,
            {
              borderColor: accent,
              backgroundColor: showTranscript ? accent + "18" : colors.cardAlt,
            },
          ]}
        >
          <Text style={[s.transcriptPillText, { color: accent }]}>Transcript</Text>
          <Text style={[s.transcriptCaret, { color: accent }]}>{showTranscript ? "v" : "^"}</Text>
        </Pressable>
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
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  playBtn: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  meta: { flex: 1 },
  transcriptPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  transcriptPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  transcriptCaret: { fontSize: 11, fontFamily: "Inter_700Bold", lineHeight: 13 },
  statusText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  countText: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  speedRow: { gap: 6 },
  speedBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  speedText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  transcriptCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  transcriptLabel: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.6 },
  transcriptText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
});
