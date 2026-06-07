import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { apiFetch, getApiUrl } from "@/lib/api";

export async function speakSpanishWord(text: string, cacheKey = "word"): Promise<void> {
  const res = await apiFetch(`${getApiUrl()}api/exam/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("TTS failed");
  const { audioBase64 } = (await res.json()) as { audioBase64?: string };
  if (!audioBase64) throw new Error("No audio");

  if (Platform.OS === "web") {
    const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new (globalThis as any).Audio(url) as HTMLAudioElement;
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
    return;
  }

  const path = (FileSystem.cacheDirectory ?? "") + `${cacheKey}_tts.mp3`;
  await FileSystem.writeAsStringAsync(path, audioBase64, { encoding: "base64" });
  const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
  sound.setOnPlaybackStatusUpdate((s) => {
    if (s.isLoaded && s.didJustFinish) sound.unloadAsync().catch(() => {});
  });
}
