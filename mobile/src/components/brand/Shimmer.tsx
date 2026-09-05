// src/components/brand/Shimmer.tsx
// Decorative diagonal sweep used on the Home "Best e1RM" stat card
// (Gymind UI.dc.html `shimmerSweep`: background-position -150% -> 250%, 3.2s).
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { hexWithAlpha } from "../../utils/color";

export function Shimmer() {
  const { colors } = useTheme();
  const x = useSharedValue(-1);

  useEffect(() => {
    x.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, []);

  // RN transforms need numeric px, not CSS %, so the sweep range is a fixed
  // pixel span wide enough to clear any stat-card width at this app's sizes.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * 220 }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]} pointerEvents="none">
      <LinearGradient
        colors={["transparent", hexWithAlpha(colors.primary, 0.18), hexWithAlpha(colors.secondary, 0.18), "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.3 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}
