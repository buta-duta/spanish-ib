import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  Alert,
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
import { useExam, type ExamSession } from "@/contexts/ExamContext";

function SessionCard({
  session,
  onPress,
  onDelete,
  isDark,
}: {
  session: ExamSession;
  onPress: () => void;
  onDelete: () => void;
  isDark: boolean;
}) {
  const colors = Colors[isDark ? "dark" : "light"];
  const themeData = getThemeById(session.themeId);
  const themeColor = themeData?.color ?? colors.tint;

  const getDuration = (): string => {
    if (!session.startedAt || !session.completedAt) return "—";
    const ms = session.completedAt - session.startedAt;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const getDate = (): string => {
    const d = new Date(session.startedAt);
    return d.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const userMessages = session.messages.filter((m) => m.role === "user").length;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sessionCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.sessionIcon, { backgroundColor: themeColor + "20" }]}>
        <Ionicons
          name={(themeData?.iconName as any) ?? "school-outline"}
          size={22}
          color={themeColor}
        />
      </View>
      <View style={styles.sessionInfo}>
        <Text style={[styles.sessionTheme, { color: colors.text }]}>
          {session.themeName}
        </Text>
        <Text style={[styles.sessionDate, { color: colors.textSecondary }]}>
          {getDate()} · {getDuration()} · {userMessages} respuestas
        </Text>
        {session.wasRepeated && (
          <Text style={styles.repeatedTag}>Tema repetido</Text>
        )}
      </View>
      <Pressable
        onPress={onDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
      >
        <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
      </Pressable>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const { sessions, loadSessions, deleteSession } = useExam();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    loadSessions();
  }, []);

  const handleDelete = (sessionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Eliminar sesión",
      "¿Estás seguro de que quieres eliminar esta sesión?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => deleteSession(sessionId),
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Historial
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Sin sesiones
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Tus sesiones de práctica aparecerán aquí
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: botPad + 20 },
          ]}
          renderItem={({ item }) => (
            <SessionCard
              session={item}
              isDark={isDark}
              onPress={() =>
                router.push({
                  pathname: "/summary",
                  params: { sessionId: item.id },
                })
              }
              onDelete={() => handleDelete(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
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
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  sessionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionInfo: { flex: 1 },
  sessionTheme: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 3,
  },
  sessionDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
  repeatedTag: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#E8884A",
  },
});
