// src/components/brand/PulseDot.tsx
// Small status dot with a soft pulsing scale animation when active
// (Gymind UI.dc.html `softPulse` keyframe: scale 1 <-> 1.05, 1.2-1.6s loop).
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

export function PulseDot({
  color,
  size = 9,
  active = false,
}: {
  color: string;
  size?: number;
  active?: boolean;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!active) {
    return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
  }

  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, animatedStyle]}
    />
  );
}
