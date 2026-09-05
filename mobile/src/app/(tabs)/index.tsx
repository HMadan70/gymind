import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import { useTheme } from "../../context/ThemeContext";
import { useWorkoutSession } from "../../context/WorkoutSessionContext";
import { fonts } from "../../constants/theme";
import { authFetch } from "../../utils/api";
import { ScreenBackground } from "../../components/brand/ScreenBackground";
import { AnimatedScreen } from "../../components/brand/AnimatedScreen";
import { AppHeader } from "../../components/brand/AppHeader";
import { Card } from "../../components/brand/Card";
import { Diamond } from "../../components/brand/Diamond";
import { ProgressRing } from "../../components/brand/ProgressRing";
import { PulseDot } from "../../components/brand/PulseDot";
import { Shimmer } from "../../components/brand/Shimmer";

function fmtElapsed(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Consecutive-day training streak, counted backward from today (or from
// yesterday if today has no finished session yet, so a streak in progress
// doesn't drop to 0 before the day is over). Not directly backed by any
// endpoint - Design2/README.md flags the streak pill as "not yet wired to
// any backend field," so this derives it client-side from GET /workouts
// (the same finished-session data /progress/consistency uses server-side)
// rather than adding a new backend field for it. Documented as an
// assumption in PROJECT_STATUS.md.
function computeStreak(finishedDates: Set<string>): number {
  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
  const cursor = new Date();
  if (!finishedDates.has(toDateStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (finishedDates.has(toDateStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function Home() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useWorkoutSession();

  const [streak, setStreak] = useState(0);
  const [calConsumed, setCalConsumed] = useState(0);
  const [calTarget, setCalTarget] = useState(0);
  const [bestE1rm, setBestE1rm] = useState<number | null>(null);
  const [bodyWeight, setBodyWeight] = useState<{ weight: number; unit: string } | null>(null);

  useEffect(() => {
    authFetch<{ id: number; started_at: string; ended_at: string | null }[]>("/workouts")
      .then((workouts) => {
        const finishedDates = new Set(
          workouts.filter((w) => w.ended_at).map((w) => new Date(w.started_at).toISOString().slice(0, 10))
        );
        setStreak(computeStreak(finishedDates));
      })
      .catch(() => {});

    authFetch<{ total_calories: number }>("/nutrition/summary")
      .then((s) => setCalConsumed(Math.round(s.total_calories)))
      .catch(() => {});

    authFetch<{ target_calories: number | null }>("/nutrition/targets")
      .then((t) => setCalTarget(t.target_calories ?? 0))
      .catch(() => {});

    authFetch<{ muscle_group: string; best_e1rm: number }[]>("/progress/muscle-groups")
      .then((groups) => {
        if (groups.length === 0) return;
        setBestE1rm(Math.max(...groups.map((g) => g.best_e1rm)));
      })
      .catch(() => {});

    authFetch<{ weight: number; unit: string }[]>("/body-weight")
      .then((logs) => {
        if (logs.length > 0) setBodyWeight(logs[0]);
      })
      .catch(() => {});
  }, []);

  const calPct = calTarget > 0 ? Math.min(100, Math.round((calConsumed / calTarget) * 100)) : 0;

  const workoutCtaTitle = session.hasStarted ? "Session in progress" : "Today's session";
  const workoutCtaSub = session.hasStarted ? `${fmtElapsed(session.elapsedSeconds)} elapsed` : "Ready when you are";
  const workoutCtaBtn = session.hasStarted ? "Resume" : "Start";

  return (
    <ScreenBackground>
      <AppHeader title="Overview" showSettings />
      <AnimatedScreen>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110, gap: 14 }}>
          <View
            style={{
              flexDirection: "row",
              alignSelf: "flex-start",
              alignItems: "center",
              gap: 8,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: colors.primarySoft,
            }}
          >
            <PulseDot color={colors.primary} size={7} active />
            <Text style={{ fontSize: 12, fontFamily: fonts.bodyExtraBold, color: colors.primary }}>
              {streak > 0 ? `${streak}-day streak` : "Start your streak today"}
            </Text>
          </View>

          <Pressable onPress={() => router.push("/coach")}>
            <Card
              variant="hero"
              bordered={false}
              style={{ padding: 0, overflow: "hidden" }}
            >
              <LinearGradient
                colors={[colors.secondary, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 20 }}
              >
                <Diamond
                  size={13}
                  color="rgba(255,255,255,0.35)"
                  style={{ position: "absolute", top: 16, right: 18 }}
                />
                <Text style={{ fontSize: 11, fontFamily: fonts.bodyExtraBold, color: "#fff", opacity: 0.85, letterSpacing: 1, textTransform: "uppercase" }}>
                  Coach
                </Text>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: "#fff", marginTop: 6, lineHeight: 23 }}>
                  You crushed leg day yesterday — want a lighter recovery push session today?
                </Text>
                <Text style={{ marginTop: 12, fontSize: 12, fontFamily: fonts.bodyBold, color: "#fff", opacity: 0.9 }}>
                  Ask something →
                </Text>
              </LinearGradient>
            </Card>
          </Pressable>

          <Pressable onPress={() => router.push("/nutrition")}>
            <Card variant="hero" style={{ padding: 18, flexDirection: "row", alignItems: "center", gap: 16 }}>
              <ProgressRing size={66} strokeWidth={8} progress={calPct / 100} trackColor={colors.cardAlt} progressColor={colors.primary}>
                <Text style={{ fontSize: 13, fontFamily: fonts.bodyExtraBold, color: colors.text }}>{calPct}%</Text>
              </ProgressRing>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text }}>Nutrition today</Text>
                <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 2, fontFamily: fonts.bodyRegular }}>
                  {calConsumed} of {calTarget || "—"} kcal
                </Text>
              </View>
            </Card>
          </Pressable>

          <Pressable onPress={() => router.push("/workout")}>
            <Card variant="hero" style={{ padding: 20 }}>
              <Diamond
                size={13}
                color={colors.primary}
                outline
                style={{ position: "absolute", top: 16, right: 18 }}
              />
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text }}>{workoutCtaTitle}</Text>
              <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 4, fontFamily: fonts.bodyRegular }}>
                {workoutCtaSub}
              </Text>
              <View
                style={{
                  marginTop: 14,
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 18,
                  borderRadius: 999,
                  backgroundColor: colors.primary,
                }}
              >
                <Text style={{ fontFamily: fonts.bodyExtraBold, fontSize: 13, color: colors.onPrimary }}>
                  {workoutCtaBtn}
                </Text>
                <ArrowRight size={14} color={colors.onPrimary} />
              </View>
            </Card>
          </Pressable>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <Card variant="card" style={{ flex: 1, padding: 14, overflow: "hidden" }}>
              <Shimmer />
              <Text style={{ fontSize: 11, color: colors.textDim, fontFamily: fonts.bodyBold, textTransform: "uppercase" }}>
                Best e1RM
              </Text>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: colors.text, marginTop: 4 }}>
                {bestE1rm ? `${Math.round(bestE1rm)} lb` : "—"}
              </Text>
            </Card>
            <Card variant="plain" style={{ flex: 1, borderRadius: 20, padding: 14 }}>
              <Text style={{ fontSize: 11, color: colors.textDim, fontFamily: fonts.bodyBold, textTransform: "uppercase" }}>
                Body weight
              </Text>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: colors.text, marginTop: 4 }}>
                {bodyWeight ? `${bodyWeight.weight} ${bodyWeight.unit}` : "—"}
              </Text>
            </Card>
          </View>
        </ScrollView>
      </AnimatedScreen>
    </ScreenBackground>
  );
}
