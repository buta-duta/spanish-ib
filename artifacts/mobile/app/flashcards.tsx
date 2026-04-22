import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useFlashcards, type Flashcard } from "@/contexts/FlashcardContext";

const ACCENT = "#8E44AD";
const ACCENT_DARK = "#7D3C98";

type ScreenMode = "list" | "practice";

// ── Single flip card component ────────────────────────────────────────────────
function FlipCard({
  card,
  colors,
  onDelete,
  compact,
}: {
  card: Flashcard;
  colors: typeof Colors.dark;
  onDelete?: (id: string) => void;
  compact?: boolean;
}) {
  const flipAnim = useRef(new Animated.Value(0)).current;
  const [flipped, setFlipped] = useState(false);

  const flip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(flipAnim, {
      toValue: flipped ? 0 : 1,
      useNativeDriver: true,
      tension: 60,
      friction: 9,
    }).start();
    setFlipped((f) => !f);
  };

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] });

  const cardH = compact ? 120 : 180;

  return (
    <Pressable onPress={flip} style={{ position: "relative", height: cardH }}>
      {/* Front */}
      <Animated.View
        style={[
          fc.face,
          {
            height: cardH,
            backgroundColor: colors.card,
            borderColor: ACCENT + "60",
            opacity: frontOpacity,
            transform: [{ perspective: 1200 }, { rotateY: frontRotate }],
          },
        ]}
      >
        <View style={[fc.langBadge, { backgroundColor: ACCENT + "20" }]}>
          <Text style={[fc.langText, { color: ACCENT }]}>ES</Text>
        </View>
        <Text style={[fc.frontWord, { color: colors.text }]}>{card.word}</Text>
        {!!card.phonetic && (
          <Text style={[fc.frontPhonetic, { color: ACCENT }]}>/{card.phonetic}/</Text>
        )}
        <View style={[fc.tapHint, { borderColor: colors.border }]}>
          <Ionicons name="sync-outline" size={12} color={colors.textSecondary} />
          <Text style={[fc.tapHintText, { color: colors.textSecondary }]}>Toca para voltear</Text>
        </View>
        {onDelete && (
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onDelete(card.id); }}
            style={fc.deleteBtn}
            hitSlop={10}
          >
            <Ionicons name="trash-outline" size={16} color="#E74C3C80" />
          </Pressable>
        )}
      </Animated.View>

      {/* Back */}
      <Animated.View
        style={[
          fc.face,
          {
            height: cardH,
            backgroundColor: ACCENT + "15",
            borderColor: ACCENT + "60",
            opacity: backOpacity,
            transform: [{ perspective: 1200 }, { rotateY: backRotate }],
          },
        ]}
      >
        <View style={[fc.langBadge, { backgroundColor: colors.card }]}>
          <Text style={[fc.langText, { color: colors.textSecondary }]}>EN</Text>
        </View>
        {!!card.partOfSpeech && (
          <Text style={[fc.backPos, { color: ACCENT }]}>{card.partOfSpeech}</Text>
        )}
        <Text style={[fc.backMeaning, { color: colors.text }]} numberOfLines={compact ? 3 : 5}>
          {card.meaning}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const fc = StyleSheet.create({
  face: {
    position: "absolute",
    width: "100%",
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    backfaceVisibility: "hidden",
  },
  langBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  langText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  frontWord: { fontSize: 28, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 6 },
  frontPhonetic: { fontSize: 15, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  tapHint: {
    position: "absolute",
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  tapHintText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  deleteBtn: {
    position: "absolute",
    top: 10,
    right: 12,
    padding: 4,
  },
  backPos: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  backMeaning: { fontSize: 16, fontFamily: "Inter_500Medium", lineHeight: 24, textAlign: "center" },
});

// ── Practice card (full screen) ───────────────────────────────────────────────
function PracticeCard({
  card,
  colors,
  index,
  total,
}: {
  card: Flashcard;
  colors: typeof Colors.dark;
  index: number;
  total: number;
}) {
  const flipAnim = useRef(new Animated.Value(0)).current;
  const [flipped, setFlipped] = useState(false);

  const flip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(flipAnim, {
      toValue: flipped ? 0 : 1,
      useNativeDriver: true,
      tension: 55,
      friction: 8,
    }).start();
    setFlipped((f) => !f);
  };

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] });

  return (
    <Pressable onPress={flip} style={{ width: "100%", height: 280 }}>
      {/* Front */}
      <Animated.View
        style={[
          pc.face,
          {
            backgroundColor: colors.card,
            borderColor: ACCENT + "80",
            opacity: frontOpacity,
            transform: [{ perspective: 1200 }, { rotateY: frontRotate }],
          },
        ]}
      >
        <View style={[pc.counter, { backgroundColor: colors.cardAlt }]}>
          <Text style={[pc.counterText, { color: colors.textSecondary }]}>{index + 1} / {total}</Text>
        </View>
        <View style={[pc.badge, { backgroundColor: ACCENT + "20" }]}>
          <Text style={[pc.badgeText, { color: ACCENT }]}>Español</Text>
        </View>
        <Text style={[pc.word, { color: colors.text }]}>{card.word}</Text>
        {!!card.phonetic && (
          <Text style={[pc.phonetic, { color: ACCENT }]}>/{card.phonetic}/</Text>
        )}
        <View style={[pc.tapHint, { borderColor: colors.border }]}>
          <Ionicons name="sync-outline" size={14} color={colors.textSecondary} />
          <Text style={[pc.tapHintText, { color: colors.textSecondary }]}>Toca para ver el significado</Text>
        </View>
      </Animated.View>

      {/* Back */}
      <Animated.View
        style={[
          pc.face,
          {
            backgroundColor: ACCENT + "18",
            borderColor: ACCENT + "80",
            opacity: backOpacity,
            transform: [{ perspective: 1200 }, { rotateY: backRotate }],
          },
        ]}
      >
        <View style={[pc.counter, { backgroundColor: ACCENT + "25" }]}>
          <Text style={[pc.counterText, { color: ACCENT }]}>{index + 1} / {total}</Text>
        </View>
        <View style={[pc.badge, { backgroundColor: colors.card }]}>
          <Text style={[pc.badgeText, { color: colors.textSecondary }]}>English</Text>
        </View>
        {!!card.partOfSpeech && (
          <Text style={[pc.pos, { color: ACCENT }]}>{card.partOfSpeech}</Text>
        )}
        <Text style={[pc.meaning, { color: colors.text }]}>{card.meaning}</Text>
        <Pressable
          onPress={flip}
          style={[pc.flipBack, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="sync-outline" size={14} color={colors.textSecondary} />
          <Text style={[pc.flipBackText, { color: colors.textSecondary }]}>Ver palabra</Text>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

const pc = StyleSheet.create({
  face: {
    position: "absolute",
    width: "100%",
    height: 280,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backfaceVisibility: "hidden",
  },
  counter: { position: "absolute", top: 14, right: 14, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  counterText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  badge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8 },
  badgeText: { fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  word: { fontSize: 36, fontFamily: "Inter_700Bold", textAlign: "center" },
  phonetic: { fontSize: 17, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  pos: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  meaning: { fontSize: 18, fontFamily: "Inter_500Medium", lineHeight: 26, textAlign: "center" },
  tapHint: {
    position: "absolute",
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  tapHintText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  flipBack: {
    position: "absolute",
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  flipBackText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function FlashcardsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { cards, removeCard, clearAll } = useFlashcards();
  const [mode, setMode] = useState<ScreenMode>("list");
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [practiceCards, setPracticeCards] = useState<Flashcard[]>([]);

  const startPractice = (shuffle = false) => {
    let deck = [...cards];
    if (shuffle) {
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    setPracticeCards(deck);
    setPracticeIdx(0);
    setMode("practice");
  };

  const confirmDelete = (id: string) => {
    if (Platform.OS === "web") {
      removeCard(id);
      return;
    }
    Alert.alert("Eliminar flashcard", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => removeCard(id) },
    ]);
  };

  const confirmClear = () => {
    if (Platform.OS === "web") {
      clearAll();
      return;
    }
    Alert.alert("Borrar todo", "¿Eliminar todas las flashcards?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar todo", style: "destructive", onPress: clearAll },
    ]);
  };

  const bgColors: [string, string] = isDark ? ["#180B22", "#0F1117"] : ["#F5EEF8", "#F5F6FA"];

  // ── Practice mode ──────────────────────────────────────────────────────────
  if (mode === "practice") {
    const current = practiceCards[practiceIdx];
    if (!current) {
      setMode("list");
      return null;
    }

    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={[s.header, { paddingTop: topPad + 12 }]}>
          <Pressable onPress={() => setMode("list")} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[s.headerTitle, { color: colors.text, flex: 1 }]}>Práctica</Text>
          <View style={[s.countBadge, { backgroundColor: ACCENT + "20", borderColor: ACCENT + "40" }]}>
            <Text style={[s.countBadgeText, { color: ACCENT }]}>
              {practiceIdx + 1}/{practiceCards.length}
            </Text>
          </View>
        </View>

        <View style={[s.practiceContent, { paddingBottom: botPad + 20 }]}>
          {/* Progress bar */}
          <View style={[s.progressBar, { backgroundColor: colors.cardAlt }]}>
            <View
              style={[
                s.progressFill,
                { backgroundColor: ACCENT, width: `${((practiceIdx + 1) / practiceCards.length) * 100}%` as any },
              ]}
            />
          </View>

          {/* Flip card */}
          <PracticeCard
            card={current}
            colors={colors}
            index={practiceIdx}
            total={practiceCards.length}
          />

          {/* Navigation */}
          <View style={s.navRow}>
            <Pressable
              onPress={() => setPracticeIdx((i) => Math.max(0, i - 1))}
              disabled={practiceIdx === 0}
              style={({ pressed }) => [
                s.navBtn,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: practiceIdx === 0 ? 0.4 : pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
              <Text style={[s.navBtnText, { color: colors.text }]}>Anterior</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (practiceIdx < practiceCards.length - 1) {
                  setPracticeIdx((i) => i + 1);
                } else {
                  setMode("list");
                }
              }}
              style={({ pressed }) => [s.navBtn, { backgroundColor: ACCENT, borderColor: ACCENT, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={[s.navBtnText, { color: "#fff" }]}>
                {practiceIdx < practiceCards.length - 1 ? "Siguiente" : "Finalizar"}
              </Text>
              <Ionicons name={practiceIdx < practiceCards.length - 1 ? "chevron-forward" : "checkmark"} size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── List mode ───────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 12 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerLabel, { color: ACCENT }]}>IB Spanish B</Text>
          <Text style={[s.headerTitle, { color: colors.text }]}>Mis flashcards</Text>
        </View>
        <View style={[s.countBadge, { backgroundColor: ACCENT + "20", borderColor: ACCENT + "40" }]}>
          <Text style={[s.countBadgeText, { color: ACCENT }]}>{cards.length} palabras</Text>
        </View>
      </View>

      {cards.length === 0 ? (
        /* Empty state */
        <View style={s.emptyState}>
          <Text style={s.emptyEmoji}>📚</Text>
          <Text style={[s.emptyTitle, { color: colors.text }]}>Sin flashcards todavía</Text>
          <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>
            Toca cualquier palabra en el glosario y presiona "Añadir a flashcards" para guardarla aquí.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: botPad + 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Practice buttons */}
          <View style={s.practiceRow}>
            <Pressable
              onPress={() => startPractice(false)}
              style={({ pressed }) => [s.practiceBtn, { backgroundColor: ACCENT, opacity: pressed ? 0.8 : 1 }]}
            >
              <LinearGradient colors={[ACCENT, ACCENT_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.practiceBtnGrad}>
                <Ionicons name="school-outline" size={18} color="#fff" />
                <Text style={s.practiceBtnText}>Practicar</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={() => startPractice(true)}
              style={({ pressed }) => [
                s.shuffleBtn,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="shuffle-outline" size={18} color={ACCENT} />
              <Text style={[s.shuffleBtnText, { color: ACCENT }]}>Mezclar</Text>
            </Pressable>
          </View>

          {/* Cards grid */}
          <View style={s.cardsGrid}>
            {cards.map((card) => (
              <View key={card.id} style={s.cardWrapper}>
                <FlipCard
                  card={card}
                  colors={colors}
                  onDelete={confirmDelete}
                  compact
                />
              </View>
            ))}
          </View>

          {/* Clear all */}
          <Pressable
            onPress={confirmClear}
            style={({ pressed }) => [s.clearBtn, { borderColor: "#E74C3C50", opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="trash-outline" size={16} color="#E74C3C" />
            <Text style={s.clearBtnText}>Borrar todas las flashcards</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 2 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  countBadge: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  countBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyEmoji: { fontSize: 56, marginBottom: 4 },
  emptyTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySubtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  practiceRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  practiceBtn: { flex: 1, borderRadius: 14, overflow: "hidden" },
  practiceBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  practiceBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  shuffleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1 },
  shuffleBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cardWrapper: { width: "47.5%" },
  clearBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  clearBtnText: { color: "#E74C3C", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  practiceContent: { flex: 1, paddingHorizontal: 20, gap: 24 },
  progressBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  navRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  navBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16, borderWidth: 1 },
  navBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
