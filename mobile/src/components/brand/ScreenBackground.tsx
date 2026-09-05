// src/components/brand/ScreenBackground.tsx
// Ambient background: 3 large soft glow blobs drifting slowly behind screen
// content (BRAND_GUIDE.md "Motion principles" / Gymind UI.dc.html floatBlob).
// RN has no CSS blur-filter equivalent for an arbitrary shape, so each blob
// is approximated as concentric circles of falling opacity (a manual radial
// falloff) rather than a single flat-blurred circle.
import { useEffect } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { hexWithAlpha } from "../../utils/color";

function RadialGlow({ color, size }: { color: string; size: number }) {
  const rings = [
    { scale: 1, alpha: 0.1 },
    { scale: 0.78, alpha: 0.16 },
    { scale: 0.56, alpha: 0.24 },
    { scale: 0.36, alpha: 0.32 },
  ];
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {rings.map((r, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: (size - size * r.scale) / 2,
            left: (size - size * r.scale) / 2,
            width: size * r.scale,
            height: size * r.scale,
            borderRadius: (size * r.scale) / 2,
            backgroundColor: hexWithAlpha(color, r.alpha),
          }}
        />
      ))}
    </View>
  );
}

// Loops a shared value through a 3-step keyframe cycle (matching floatBlob's
// 0% / 33% / 66% / 100% steps, which return to the start value).
function useLoop(steps: number[], durationMs: number) {
  const value = useSharedValue(steps[0]);
  useEffect(() => {
    const segmentMs = durationMs / (steps.length - 1);
    const rest = steps.slice(1).map((v) =>
      withTiming(v, { duration: segmentMs, easing: Easing.inOut(Easing.ease) })
    );
    value.value = withRepeat(withSequence(...rest), -1, false);
  }, [durationMs]);
  return value;
}

function Blob({
  color,
  size,
  style,
  durationMs,
  reverse,
}: {
  color: string;
  size: number;
  style: ViewStyle;
  durationMs: number;
  reverse?: boolean;
}) {
  const dir = reverse ? -1 : 1;
  const tx = useLoop([0, -18, 10, 0], durationMs);
  const ty = useLoop([0, 14, -10, 0], durationMs);
  const rot = useLoop([0, 6, -5, 0], durationMs);
  const scale = useLoop([1, 1.08, 0.96, 1], durationMs);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dir * tx.value },
      { translateY: ty.value },
      { rotate: `${rot.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[{ position: "absolute" }, style, animatedStyle]} pointerEvents="none">
      <RadialGlow color={color} size={size} />
    </Animated.View>
  );
}

export function ScreenBackground({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }, style]}>
      <Blob color={colors.primary} size={240} style={{ top: -70, right: -70 }} durationMs={16000} />
      <Blob
        color={colors.secondary}
        size={220}
        style={{ bottom: 60, left: -80 }}
        durationMs={19000}
        reverse
      />
      <Blob color={colors.primary} size={150} style={{ top: "38%", left: "38%" }} durationMs={22000} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    overflow: "hidden",
  },
});
