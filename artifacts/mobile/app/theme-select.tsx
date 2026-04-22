import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Modal,
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
import { THEMES } from "@/constants/themes";
import { EXAMINER_GUIDES } from "@/constants/examinerGuide";
import { useIBTheme } from "@/contexts/ThemeContext";
import { useExam } from "@/contexts/ExamContext";
import { CurriculumToggle } from "@/components/CurriculumToggle";
import { useCurriculum } from "@/contexts/CurriculumContext";

// ── Examiner Guide Modal ──────────────────────────────────────────────────────

function SectionHeader({ label, icon, color }: { label: string; icon: string; color: string }) {
  return (
    <View style={eg.sectionHeader}>
      <View style={[eg.sectionIconWrap, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={[eg.sectionTitle, { color }]}>{label}</Text>
    </View>
  );
}

function Bullet({ text, color }: { text: string; color: string }) {
  return (
    <View style={eg.bulletRow}>
      <View style={[eg.bulletDot, { backgroundColor: color }]} />
      <Text style={eg.bulletText}>{text}</Text>
    </View>
  );
}

function ExaminerGuideModal({
  themeId,
  themeColor,
  themeName,
  onClose,
  isDark,
}: {
  themeId: string;
  themeColor: string;
  themeName: string;
  onClose: () => void;
  isDark: boolean;
}) {
  const colors = Colors[isDark ? "dark" : "light"];
  const guide = EXAMINER_GUIDES[themeId];
  if (!guide) return null;
  const { sections } = guide;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[eg.modal, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[eg.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={[eg.modalThemeIcon, { backgroundColor: themeColor + "20" }]}>
            <Ionicons name="book-outline" size={20} color={themeColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[eg.modalTitle, { color: colors.text }]}>Qué buscan los examinadores</Text>
            <Text style={[eg.modalSub, { color: themeColor }]}>{themeName}</Text>
          </View>
          <Pressable onPress={onClose} style={({ pressed }) => [eg.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[eg.content, { paddingBottom: 48 }]} showsVerticalScrollIndicator={false}>
          {/* Intro */}
          <View style={[eg.introCard, { backgroundColor: themeColor + "12", borderColor: themeColor + "30" }]}>
            <Ionicons name="information-circle-outline" size={18} color={themeColor} style={{ marginTop: 1 }} />
            <Text style={[eg.introText, { color: colors.text }]}>{guide.intro}</Text>
          </View>

          {/* 1. Cultural Understanding */}
          <View style={[eg.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SectionHeader label="1. Comprensión cultural" icon="globe-outline" color={themeColor} />
            <Text style={[eg.cardBody, { color: colors.text }]}>{sections.culturalUnderstanding.description}</Text>
            <Text style={[eg.subLabel, { color: colors.textSecondary }]}>Ejemplos concretos:</Text>
            {sections.culturalUnderstanding.examples.map((ex, i) => (
              <Bullet key={i} text={ex} color={themeColor} />
            ))}
          </View>

          {/* 2. Recommended Tenses */}
          <View style={[eg.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SectionHeader label="2. Tiempos verbales recomendados" icon="time-outline" color={themeColor} />
            {sections.recommendedTenses.map((t, i) => (
              <View key={i} style={[eg.tenseRow, { borderColor: colors.border }]}>
                <Text style={[eg.tenseName, { color: themeColor }]}>{t.tense}</Text>
                <Text style={[eg.tenseReason, { color: colors.text }]}>{t.reason}</Text>
              </View>
            ))}
          </View>

          {/* 3. Connectives */}
          <View style={[eg.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SectionHeader label="3. Conectores de alto nivel" icon="link-outline" color={themeColor} />
            <Text style={[eg.cardBody, { color: colors.textSecondary }]}>Usa estas expresiones para demostrar rango lingüístico:</Text>
            <View style={eg.connWrap}>
              {sections.connectives.map((c, i) => (
                <View key={i} style={[eg.connChip, { backgroundColor: themeColor + "15", borderColor: themeColor + "35" }]}>
                  <Text style={[eg.connText, { color: themeColor }]}>{c}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 4. Focus of response */}
          <View style={[eg.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SectionHeader label="4. Enfoque de la respuesta" icon="flag-outline" color={themeColor} />
            {sections.focusOfResponse.map((f, i) => (
              <Bullet key={i} text={f} color={themeColor} />
            ))}
          </View>

          {/* 5. Common Mistakes */}
          <View style={[eg.card, { backgroundColor: "#FF444410", borderColor: "#FF444430" }]}>
            <SectionHeader label="5. Errores frecuentes (evítalos)" icon="warning-outline" color="#FF4444" />
            {sections.commonMistakes.map((m, i) => (
              <View key={i} style={eg.bulletRow}>
                <Ionicons name="close-circle-outline" size={14} color="#FF4444" style={{ marginTop: 2 }} />
                <Text style={[eg.bulletText, { color: Colors.dark.text }]}>{m}</Text>
              </View>
            ))}
          </View>

          {/* Band 6–7 tip */}
          <View style={[eg.bandCard, { backgroundColor: "#C9A84C15", borderColor: "#C9A84C40" }]}>
            <Ionicons name="star-outline" size={18} color="#C9A84C" />
            <Text style={[eg.bandText, { color: "#C9A84C" }]}>Para alcanzar Banda 6–7: ve más allá de la descripción. Analiza, evalúa y conecta con contextos culturales hispanohablantes.</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const eg = StyleSheet.create({
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: Platform.OS === "ios" ? 16 : 24, paddingBottom: 14, borderBottomWidth: 1 },
  modalThemeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 1 },
  closeBtn: { padding: 4 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  introCard: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  introText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  subLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  bulletRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, color: "#E0E0E0" },
  tenseRow: { borderTopWidth: 1, paddingTop: 8 },
  tenseName: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  tenseReason: { fontSize: 12, fontFamily: "Inter_400Regular" },
  connWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  connChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  connText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  bandCard: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  bandText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 19 },
});

// ── Theme Card ────────────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  isUsed,
  onPress,
  onGuidePress,
}: {
  theme: (typeof THEMES)[0];
  isUsed: boolean;
  onPress: () => void;
  onGuidePress: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.themeCard, { backgroundColor: colors.card, borderColor: isUsed ? theme.color + "44" : colors.border }]}
      >
        <View style={[styles.themeIcon, { backgroundColor: theme.color + "20" }]}>
          <Ionicons name={theme.iconName as any} size={28} color={theme.color} />
        </View>
        <View style={styles.themeInfo}>
          <View style={styles.themeNameRow}>
            <Text style={[styles.themeName, { color: colors.text }]}>{theme.name}</Text>
            {isUsed && (
              <View style={[styles.usedBadge, { backgroundColor: theme.color + "22", borderColor: theme.color + "44" }]}>
                <Ionicons name="checkmark" size={10} color={theme.color} />
                <Text style={[styles.usedText, { color: theme.color }]}>Practicado</Text>
              </View>
            )}
          </View>
          <Text style={[styles.themeDesc, { color: colors.textSecondary }]} numberOfLines={2}>{theme.description}</Text>
          <View style={styles.keywords}>
            {theme.keywords.slice(0, 3).map((kw) => (
              <View key={kw} style={[styles.keyword, { backgroundColor: theme.color + "15", borderColor: theme.color + "30" }]}>
                <Text style={[styles.keywordText, { color: theme.color }]}>{kw}</Text>
              </View>
            ))}
          </View>
          {/* Guide button */}
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onGuidePress(); }}
            style={({ pressed }) => [styles.guideBtn, { borderColor: theme.color + "50", backgroundColor: theme.color + "10", opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="book-outline" size={12} color={theme.color} />
            <Text style={[styles.guideBtnText, { color: theme.color }]}>Qué buscan los examinadores</Text>
          </Pressable>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ThemeSelectScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const { usedThemes, selectTheme, selectRandomTheme } = useIBTheme();
  const { startSession } = useExam();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [guideThemeId, setGuideThemeId] = useState<string | null>(null);
  const guideTheme = guideThemeId ? THEMES.find((t) => t.id === guideThemeId) : null;
  const { level, levelLabel } = useCurriculum();

  const handleSelectTheme = async (themeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const wasRepeated = usedThemes.includes(themeId);
    await selectTheme(themeId);
    const theme = THEMES.find((t) => t.id === themeId)!;
    startSession(themeId, theme.name, wasRepeated, level);
    router.push("/exam");
  };

  const handleRandom = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const theme = await selectRandomTheme();
    const wasRepeated = usedThemes.includes(theme.id);
    startSession(theme.id, theme.name, wasRepeated, level);
    router.push("/exam");
  };

  const remainingCount = THEMES.length - usedThemes.filter(t => t).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={isDark ? ["#1A1030", "#0F1117"] : ["#F0EDFF", "#F5F6FA"]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Elige un tema</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {remainingCount} temas sin practicar · {levelLabel}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <CurriculumToggle />
        {/* Random button */}
        <Pressable onPress={handleRandom} style={({ pressed }) => [styles.randomBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <LinearGradient colors={[colors.tint, colors.tintDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.randomBtnGradient}>
            <View style={styles.randomLeft}>
              <View style={styles.diceIcon}>
                <Ionicons name="shuffle-outline" size={24} color="#fff" />
              </View>
              <View>
                <Text style={styles.randomTitle}>Tema aleatorio</Text>
                <Text style={styles.randomSub}>Recomendado · sin repetir temas</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.8)" />
          </LinearGradient>
        </Pressable>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textSecondary }]}>o elige un tema específico</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>


        {/* Theme list */}
        <View style={styles.themeList}>
          {THEMES.map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              isUsed={usedThemes.includes(t.id)}
              onPress={() => handleSelectTheme(t.id)}
              onGuidePress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setGuideThemeId(t.id); }}
            />
          ))}
        </View>
      </ScrollView>

      {/* Examiner Guide Modal */}
      {guideTheme && (
        <ExaminerGuideModal
          themeId={guideTheme.id}
          themeColor={guideTheme.color}
          themeName={guideTheme.name}
          onClose={() => setGuideThemeId(null)}
          isDark={isDark}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  randomBtn: { borderRadius: 16, overflow: "hidden", marginBottom: 24 },
  randomBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 18, paddingHorizontal: 20 },
  randomLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  diceIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  randomTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  randomSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  modeToggle: { flexDirection: "row", borderRadius: 10, borderWidth: 1, padding: 3, gap: 3 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 8 },
  modeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  themeList: { gap: 10 },
  themeCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, borderWidth: 1 },
  themeIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", alignSelf: "flex-start", marginTop: 2 },
  themeInfo: { flex: 1, gap: 4 },
  themeNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  themeName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  usedBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  usedText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  themeDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  keywords: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  keyword: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  keywordText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  guideBtn: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, marginTop: 4 },
  guideBtnText: { fontSize: 11, fontFamily: "Inter_500Medium" },
});
