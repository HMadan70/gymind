// src/components/brand/TabBar.tsx
// Custom floating bottom tab bar: cut-corner rounded rect, translucent/
// blurred background, small glowing rotated-diamond indicator that slides
// under the active tab (Gymind UI.dc.html nav, Design2/README.md "Navigation").
import { useEffect } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { BottomTabBarProps } from "expo-router/js-tabs";
import { Home, Dumbbell, Utensils, TrendingUp, Sparkles } from "lucide-react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../constants/theme";
import { Diamond } from "./Diamond";

const ICONS: Record<string, any> = {
  index: Home,
  workout: Dumbbell,
  nutrition: Utensils,
  progress: TrendingUp,
  coach: Sparkles,
};

const LABELS: Record<string, string> = {
  index: "Home",
  workout: "Train",
  nutrition: "Food",
  progress: "Progress",
  coach: "Coach",
};

// Only these 5 routes appear in the floating nav (settings is reached from
// elsewhere, matching the design's 5-tab nav — see README.md "Navigation").
const VISIBLE_ROUTES = ["index", "workout", "nutrition", "progress", "coach"];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { colors, mode } = useTheme();
  const visible = state.routes.filter((r) => VISIBLE_ROUTES.includes(r.name));
  const activeRoute = state.routes[state.index];
  const activeIdx = Math.max(
    0,
    visible.findIndex((r) => r.key === activeRoute.key)
  );

  const left = useSharedValue(activeIdx * (100 / visible.length) + 100 / visible.length / 2);

  useEffect(() => {
    left.value = withTiming(activeIdx * (100 / visible.length) + 100 / visible.length / 2, {
      duration: 350,
    });
  }, [activeIdx]);

  const indicatorStyle = useAnimatedStyle(() => ({
    left: `${left.value}%`,
  }));

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BlurView
        intensity={40}
        tint={mode === "dark" ? "dark" : "light"}
        style={[
          styles.bar,
          {
            borderColor: colors.border,
            backgroundColor: colors.navBg,
          },
        ]}
      >
        <Animated.View style={[styles.indicator, indicatorStyle]}>
          <Diamond size={9} color={colors.primary} />
        </Animated.View>
        {visible.map((route) => {
          const isActive = route.key === activeRoute.key;
          const Icon = ICONS[route.name] ?? Home;
          const tint = isActive ? colors.primary : colors.textDim;
          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              style={styles.tab}
            >
              <Icon size={20} color={tint} strokeWidth={2} />
              <Text style={{ fontSize: 10, fontFamily: fonts.bodyBold, color: tint, marginTop: 4 }}>
                {LABELS[route.name] ?? route.name}
              </Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 22,
  },
  bar: {
    height: 64,
    borderRadius: 30,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  indicator: {
    position: "absolute",
    bottom: 11,
    transform: [{ translateX: -4.5 }],
  },
  tab: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
