import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, View, ViewStyle } from "react-native";

function AnimatedPlayStopIcon({ playing, size, color }: { playing: boolean; size: number; color: string }) {
  const anim = useRef(new Animated.Value(playing ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: playing ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [playing, anim]);

  const playOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const stopOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const playScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] });
  const stopScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.Text
        style={{
          position: "absolute",
          opacity: playOpacity,
          transform: [{ scale: playScale }],
          fontSize: size * 0.48,
          fontFamily: "Inter_700Bold",
          color,
          lineHeight: size * 0.52,
        }}
      >
        {">"}
      </Animated.Text>
      <Animated.Text
        style={{
          position: "absolute",
          opacity: stopOpacity,
          transform: [{ scale: stopScale }],
          fontSize: size * 0.34,
          fontFamily: "Inter_700Bold",
          color,
          letterSpacing: -1,
          lineHeight: size * 0.4,
        }}
      >
        {"||"}
      </Animated.Text>
    </View>
  );
}

export function PlayStopButton({
  playing,
  loading,
  disabled,
  onPress,
  size = 46,
  color = "#fff",
  backgroundColor,
  style,
}: {
  playing: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  size?: number;
  color?: string;
  backgroundColor: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { width: size, height: size, borderRadius: size / 2, backgroundColor, opacity: pressed || disabled || loading ? 0.75 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <AnimatedPlayStopIcon playing={playing} size={size * 0.55} color={color} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: "center", justifyContent: "center" },
});
