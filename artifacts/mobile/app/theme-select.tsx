import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef } from "react";
import {
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
import { THEMES } from "@/constants/themes";
import { useIBTheme } from "@/contexts/ThemeContext";
import { useExam } from "@/contexts/ExamContext";

function ThemeCard({
  theme,
  isUsed,
  onPress,
}: {
  theme: (typeof THEMES)[0];
  isUsed: boolean;
  onPress: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.themeCard,
          {
            backgroundColor: colors.card,
            borderColor: isUsed ? theme.color + "44" : colors.border,
          },
        ]}
      >
        <View
          style={[styles.themeIcon, { backgroundColor: theme.color + "20" }]}
        >
          <Ionicons
            name={theme.iconName as any}
            size={28}
            color={theme.color}
          />
        </View>
        <View style={styles.themeInfo}>
          <View style={styles.themeNameRow}>
            <Text style={[styles.themeName, { color: colors.text }]}>
              {theme.name}
            </Text>
            {isUsed && (
              <View
                style={[styles.usedBadge, { backgroundColor: theme.color + "22", borderColor: theme.color + "44" }]}
              >
                <Ionicons name="checkmark" size={10} color={theme.color} />
                <Text style={[styles.usedText, { color: theme.color }]}>
                  Practicado
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.themeDesc, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {theme.description}
          </Text>
          <View style={styles.keywords}>
            {theme.keywords.slice(0, 3).map((kw) => (
              <View
                key={kw}
                style={[
                  styles.keyword,
                  { backgroundColor: theme.color + "15", borderColor: theme.color + "30" },
                ]}
              >
                <Text style={[styles.keywordText, { color: theme.color }]}>
                  {kw}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>
    </Animated.View>
  );
}

export default function ThemeSelectScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const { usedThemes, selectTheme, selectRandomTheme } = useIBTheme();
  const { startSession } = useExam();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSelectTheme = async (themeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const wasRepeated = usedThemes.includes(themeId);
    await selectTheme(themeId);
    const theme = THEMES.find((t) => t.id === themeId)!;
    startSession(themeId, theme.name, wasRepeated);
    router.push("/exam");
  };

  const handleRandom = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const theme = await selectRandomTheme();
    const wasRepeated = usedThemes.includes(theme.id);
    startSession(theme.id, theme.name, wasRepeated);
    router.push("/exam");
  };

  const remainingCount = THEMES.length - usedThemes.filter(t => t).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ["#1A1030", "#0F1117"] : ["#F0EDFF", "#F5F6FA"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Elige un tema
          </Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {remainingCount} temas sin practicar
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Random button */}
        <Pressable
          onPress={handleRandom}
          style={({ pressed }) => [
            styles.randomBtn,
            { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <LinearGradient
            colors={[colors.tint, colors.tintDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.randomBtnGradient}
          >
            <View style={styles.randomLeft}>
              <View style={styles.diceIcon}>
                <Ionicons name="shuffle-outline" size={24} color="#fff" />
              </View>
              <View>
                <Text style={styles.randomTitle}>Tema aleatorio</Text>
                <Text style={styles.randomSub}>
                  Recomendado · sin repetir temas
                </Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.8)" />
          </LinearGradient>
        </Pressable>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textSecondary }]}>
            o elige un tema específico
          </Text>
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
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  randomBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
  },
  randomBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  randomLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  diceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  randomTitle: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  randomSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  themeList: { gap: 10 },
  themeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  themeIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  themeInfo: { flex: 1 },
  themeNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  themeName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  usedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  usedText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  themeDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginBottom: 8,
  },
  keywords: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  keyword: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  keywordText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});
