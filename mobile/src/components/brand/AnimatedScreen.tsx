// src/components/brand/AnimatedScreen.tsx
// The `screenIn` entrance used on every screen/tab switch (BRAND_GUIDE.md
// motion principles): rise-and-fade, ~425ms, cubic-bezier(.2,.8,.2,1).
import { useEffect } from "react";
import { ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { motion } from "../../constants/theme";

const EASING = Easing.bezier(0.2, 0.8, 0.2, 1);

export function AnimatedScreen({
  children,
  style,
  screenKey,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  screenKey?: string | number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.screenIn, easing: EASING });
  }, [screenKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 14 },
      { scale: 0.985 + progress.value * 0.015 },
    ],
  }));

  return <Animated.View style={[{ flex: 1 }, style, animatedStyle]}>{children}</Animated.View>;
}
