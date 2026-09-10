import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import Svg, { Circle } from "react-native-svg";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../constants/theme";
import { API_URL } from "../../constants/api";
import { Card } from "../../components/Card";
import { authFetch } from "../../lib/session";

type PastWorkout = { id: number; started_at: string; ended_at: string | null };

type NutritionTotals = { calories: number; protein: number; carbs: number; fat: number };

const RING_RADIUS = 27;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const greetingForNow = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "GOOD MORNING";
  if (hour < 18) return "GOOD AFTERNOON";
  return "GOOD EVENING";
};

const isSameDay = (iso: string | null | undefined, reference: Date) => {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
};

export default function Home() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [consistency, setConsistency] = useState<{ days_trained: number; total_days: number } | null>(null);
  const [nutrition, setNutrition] = useState<NutritionTotals | null>(null);
  const [calorieTarget, setCalorieTarget] = useState<number | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<PastWorkout | null>(null);
  const [lastFinishedWorkout, setLastFinishedWorkout] = useState<PastWorkout | null>(null);
  const [bestE1rm, setBestE1rm] = useState<number | null>(null);
  const [bodyWeight, setBodyWeight] = useState<{ weight: number; unit: string } | null>(null);

  const loadHome = useCallback(async () => {
    const get = async (path: string) => {
      const response = await authFetch(`${API_URL}${path}`);
      if (!response.ok) throw new Error(path);
      return response.json();
    };

    // Each card degrades on its own — one dead endpoint shouldn't blank
    // the whole screen, so these settle independently.
    const [
      consistencyResult,
      summaryResult,
      targetsResult,
      workoutsResult,
      muscleGroupsResult,
      bodyWeightResult,
    ] = await Promise.allSettled([
      get("/progress/consistency"),
      get("/nutrition/summary"),
      get("/nutrition/targets"),
      get("/workouts"),
      get("/progress/muscle-groups"),
      get("/body-weight"),
    ]);

    if (consistencyResult.status === "fulfilled") setConsistency(consistencyResult.value);

    // /nutrition/summary now takes an optional ?date=, defaulting to
    // today, so the server totals the day directly — this used to pull
    // every log ever and filter/reduce them here just to get today's.
    if (summaryResult.status === "fulfilled") {
      const summary = summaryResult.value;
      setNutrition({
        calories: summary?.total_calories ?? 0,
        protein: summary?.total_protein ?? 0,
        carbs: summary?.total_carbs ?? 0,
        fat: summary?.total_fat ?? 0,
      });
    }

    if (targetsResult.status === "fulfilled") {
      setCalorieTarget(targetsResult.value?.target_calories ?? null);
    }

    if (workoutsResult.status === "fulfilled") {
      const workouts = workoutsResult.value as PastWorkout[];
      setActiveWorkout(workouts.find((w) => w.ended_at === null) ?? null);
      const finished = workouts
        .filter((w) => w.ended_at !== null)
        .sort((a, b) => new Date(b.ended_at!).getTime() - new Date(a.ended_at!).getTime());
      setLastFinishedWorkout(finished[0] ?? null);
    }

    if (muscleGroupsResult.status === "fulfilled") {
      // No "best e1RM overall" endpoint exists; /progress/muscle-groups
      // already returns the best per group, so the overall best is the
      // max of those rather than a new backend route.
      const groups = muscleGroupsResult.value as { best_e1rm: number }[];
      setBestE1rm(groups.length ? Math.max(...groups.map((g) => g.best_e1rm)) : null);
    }

    if (bodyWeightResult.status === "fulfilled") {
      const logs = bodyWeightResult.value as { weight: number; unit: string; logged_at: string | null }[];
      const latest = [...logs].sort(
        (a, b) => new Date(b.logged_at ?? 0).getTime() - new Date(a.logged_at ?? 0).getTime()
      )[0];
      setBodyWeight(latest ? { weight: latest.weight, unit: latest.unit } : null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, [loadHome])
  );

  const trainedToday = isSameDay(lastFinishedWorkout?.ended_at ?? null, new Date());

  const coachTeaser = "Coach is being rebuilt.";

  const caloriePct =
    nutrition && calorieTarget && calorieTarget > 0
      ? Math.min(1, nutrition.calories / calorieTarget)
      : 0;

  const calorieSummary = nutrition
    ? calorieTarget
      ? `${Math.round(nutrition.calories)} / ${Math.round(calorieTarget)} kcal · ${Math.round(nutrition.protein)}p ${Math.round(nutrition.carbs)}c ${Math.round(nutrition.fat)}f`
      : `${Math.round(nutrition.calories)} kcal logged today`
    : "No food logged yet today";

  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.bgBase, colors.bgBase, colors.gradientBottom]}
      locations={[0, 0.3, 0.7, 1]}
      style={{ flex: 1 }}
    >
      {/* Header: greeting + theme toggle */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 6,
        }}
      >
        <View>
          <Text
            style={{
              color: colors.textDim,
              fontSize: 12,
              letterSpacing: 0.72,
              fontFamily: fonts.bodyBold,
            }}
          >
            {greetingForNow()}
          </Text>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontFamily: fonts.heading }}>
            Home
          </Text>
        </View>

        {/* Settings is no longer a tab, so this is its entry point. */}
        <Pressable
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={{
            width: 44,
            height: 44,
            borderRadius: 99,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.bgCard,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 16, color: colors.textDim }}>⚙</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 40, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Consistency pill. The design calls for an "X-day streak", but
            no endpoint returns a consecutive-day streak — /progress/consistency
            returns days-trained-in-a-window, so it's labelled for what it
            actually is rather than passed off as a streak. */}
        {consistency && (
          <View
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 99,
              backgroundColor: colors.tealSoft,
            }}
          >
            <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: colors.teal }} />
            <Text style={{ color: colors.teal, fontSize: 12, fontFamily: fonts.bodyExtra }}>
              {consistency.days_trained} of {consistency.total_days} days trained
            </Text>
          </View>
        )}

        {/* Coach teaser — hero shape, brand gradient, diamond accent */}
        <Pressable onPress={() => router.push("/coach")}>
          <LinearGradient
            colors={[colors.gold, colors.teal]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderTopLeftRadius: 30,
              borderTopRightRadius: 12,
              borderBottomRightRadius: 30,
              borderBottomLeftRadius: 12,
              padding: 20,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                top: 16,
                right: 18,
                width: 13,
                height: 13,
                borderRadius: 3,
                backgroundColor: "rgba(255,255,255,0.35)",
                transform: [{ rotate: "45deg" }],
              }}
            />
            <Text
              style={{
                color: "#ffffff",
                fontSize: 11,
                letterSpacing: 0.88,
                opacity: 0.85,
                fontFamily: fonts.bodyExtra,
              }}
            >
              COACH
            </Text>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 17,
                marginTop: 6,
                lineHeight: 23,
                fontFamily: fonts.heading,
              }}
            >
              {coachTeaser}
            </Text>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 12,
                marginTop: 12,
                opacity: 0.9,
                fontFamily: fonts.bodyBold,
              }}
            >
              Ask something →
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Nutrition — calorie ring + macro summary */}
        <Pressable onPress={() => router.push("/nutrition")}>
          <Card
            shape="hero"
            style={{
              padding: 18,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
            }}
          >
            <View style={{ width: 66, height: 66 }}>
              <Svg width={66} height={66} viewBox="0 0 66 66">
                <Circle cx={33} cy={33} r={RING_RADIUS} fill="none" stroke={colors.bgInset} strokeWidth={8} />
                <Circle
                  cx={33}
                  cy={33}
                  r={RING_RADIUS}
                  fill="none"
                  stroke={colors.teal}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={RING_CIRCUMFERENCE * (1 - caloriePct)}
                  transform="rotate(-90 33 33)"
                />
              </Svg>
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
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: fonts.bodyExtra }}>
                  {Math.round(caloriePct * 100)}%
                </Text>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontFamily: fonts.bodyBold }}>
                Nutrition today
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2, fontFamily: fonts.body }}>
                {calorieSummary}
              </Text>
            </View>
          </Card>
        </Pressable>

        {/* Workout — today's plan + Start/Resume reflecting real session state */}
        <Pressable onPress={() => router.push("/workout")}>
          <Card
            shape="hero"
            style={{ padding: 20, borderWidth: 1, borderColor: colors.border }}
          >
            <View
              style={{
                position: "absolute",
                top: 16,
                right: 18,
                width: 13,
                height: 13,
                borderRadius: 3,
                backgroundColor: colors.tealSoft,
                borderWidth: 1.5,
                borderColor: colors.teal,
                transform: [{ rotate: "45deg" }],
              }}
            />
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontFamily: fonts.bodyBold }}>
              {activeWorkout ? "Session in progress" : "Today's Workout"}
            </Text>
            <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 4, fontFamily: fonts.body }}>
              {activeWorkout
                ? "You have an unfinished session."
                : trainedToday
                  ? "You already trained today — nice work."
                  : "Nothing logged yet today."}
            </Text>

            <View
              style={{
                alignSelf: "flex-start",
                marginTop: 14,
                paddingVertical: 10,
                paddingHorizontal: 18,
                borderRadius: 99,
                backgroundColor: colors.teal,
              }}
            >
              <Text style={{ color: colors.tealOn, fontSize: 13, fontFamily: fonts.bodyExtra }}>
                {activeWorkout ? "Resume" : "Start session"}
              </Text>
            </View>
          </Card>
        </Pressable>

        {/* Best e1RM + Body weight */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.bgCard,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 10,
              borderBottomRightRadius: 22,
              borderBottomLeftRadius: 10,
              padding: 14,
            }}
          >
            <Text
              style={{
                color: colors.textDim,
                fontSize: 11,
                letterSpacing: 0.55,
                fontFamily: fonts.bodyBold,
              }}
            >
              BEST E1RM
            </Text>
            <Text style={{ color: colors.textPrimary, fontSize: 20, marginTop: 4, fontFamily: fonts.heading }}>
              {bestE1rm !== null ? `${Math.round(bestE1rm)} lb` : "—"}
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.bgCard,
              borderRadius: 20,
              padding: 14,
            }}
          >
            <Text
              style={{
                color: colors.textDim,
                fontSize: 11,
                letterSpacing: 0.55,
                fontFamily: fonts.bodyBold,
              }}
            >
              BODY WEIGHT
            </Text>
            <Text style={{ color: colors.textPrimary, fontSize: 20, marginTop: 4, fontFamily: fonts.heading }}>
              {bodyWeight ? `${bodyWeight.weight} ${bodyWeight.unit}` : "—"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
