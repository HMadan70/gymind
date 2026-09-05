// src/components/brand/ProgressRing.tsx
// Circular progress indicator (calorie ring, e1RM ring, consistency ring,
// rest timer). Animates stroke-dashoffset smoothly per BRAND_GUIDE.md's
// motion principle ("progress rings/bars/timers always animate smoothly,
// 500-600ms, never jump").
import { useEffect } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { motion } from "../../constants/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ProgressRing({
  size,
  strokeWidth,
  progress, // 0-1
  trackColor,
  progressColor,
  linear = false, // true = no easing (rest timer countdown), false = ease
  children,
}: {
  size: number;
  strokeWidth: number;
  progress: number;
  trackColor: string;
  progressColor: string;
  linear?: boolean;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const animatedProgress = useSharedValue(clamped);

  useEffect(() => {
    animatedProgress.value = withTiming(clamped, {
      duration: linear ? 1000 : motion.progress,
    });
  }, [clamped]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}
