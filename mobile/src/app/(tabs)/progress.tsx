import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { useFocusEffect } from "expo-router";
import { ChevronLeft, Camera } from "lucide-react-native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../constants/theme";
import { authFetch } from "../../utils/api";
import { ScreenBackground } from "../../components/brand/ScreenBackground";
import { AnimatedScreen } from "../../components/brand/AnimatedScreen";
import { AppHeader } from "../../components/brand/AppHeader";
import { Card } from "../../components/brand/Card";
import { Button } from "../../components/brand/Button";
import { ProgressRing } from "../../components/brand/ProgressRing";
import { LineChart } from "../../components/brand/LineChart";
import { CenterModal } from "../../components/brand/CenterModal";

type MuscleGroupSummary = { muscle_group: string; best_e1rm: number };
type ExerciseOption = { id: number; name: string; muscle_group: string };
type Consistency = { days_trained: number; total_days: number };
type BodyWeightTrend = { unit: string | null; entries: { logged_at: string; weight: number }[] };

const MUSCLE_GROUPS = ["chest", "back", "legs", "shoulders", "arms", "core"];

export default function Progress() {
  const { colors } = useTheme();

  const [consistency, setConsistency] = useState<Consistency | null>(null);
  const [weightTrend, setWeightTrend] = useState<BodyWeightTrend>({ unit: null, entries: [] });
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroupSummary[]>([]);

  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [detailTrend, setDetailTrend] = useState<number[]>([]);
  const [detailLoaded, setDetailLoaded] = useState(false);

  const [isWeightLogOpen, setIsWeightLogOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [weightUnit, setWeightUnit] = useState<"lb" | "kg">("lb");

  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const [photoAttached, setPhotoAttached] = useState(false);

  const loadOverview = useCallback(() => {
    authFetch<Consistency>("/progress/consistency").then(setConsistency).catch(() => {});
    authFetch<BodyWeightTrend>("/progress/body-weight?days=90").then(setWeightTrend).catch(() => {});
    authFetch<MuscleGroupSummary[]>("/progress/muscle-groups").then(setMuscleGroups).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOverview();
    }, [loadOverview])
  );

  const bestByGroup = Object.fromEntries(muscleGroups.map((g) => [g.muscle_group, g.best_e1rm]));

  // /progress/e1rm is per-exercise, not per-muscle-group, so the group
  // drilldown fetches every exercise in that group and merges each
  // exercise's e1RM trend by date (taking the best value logged that day) -
  // approximating a muscle-group trend without a new backend endpoint.
  const openGroup = async (group: string) => {
    setSelectedGroup(group);
    setDetailLoaded(false);
    setDetailTrend([]);
    try {
      const exercises = await authFetch<ExerciseOption[]>(`/exercises?muscle_group=${group}`);
      const trends = await Promise.all(
        exercises.map((ex) =>
          authFetch<{ entries: { date: string; e1rm: number }[] }>(`/progress/e1rm?exercise_id=${ex.id}`).catch(
            () => ({ entries: [] })
          )
        )
      );
      const byDate = new Map<string, number>();
      trends.forEach((t) =>
        t.entries.forEach((e) => {
          const day = e.date.slice(0, 10);
          byDate.set(day, Math.max(byDate.get(day) ?? 0, e.e1rm));
        })
      );
      const sortedDates = [...byDate.keys()].sort();
      setDetailTrend(sortedDates.map((d) => byDate.get(d)!));
    } finally {
      setDetailLoaded(true);
    }
  };

  const saveWeight = async () => {
    const value = parseFloat(weightInput);
    if (!isNaN(value)) {
      await authFetch("/body-weight", { method: "POST", body: JSON.stringify({ weight: value, unit: weightUnit }) });
      loadOverview();
    }
    setIsWeightLogOpen(false);
    setWeightInput("");
  };

  const consistPct = consistency && consistency.total_days > 0 ? consistency.days_trained / consistency.total_days : 0;
  const latestWeight = weightTrend.entries.length > 0 ? weightTrend.entries[weightTrend.entries.length - 1] : null;
  const firstWeight = weightTrend.entries.length > 0 ? weightTrend.entries[0] : null;
  const trendingDown = latestWeight && firstWeight ? latestWeight.weight < firstWeight.weight : null;

  if (selectedGroup) {
    return (
      <ScreenBackground>
        <AppHeader title="Progress" />
        <AnimatedScreen screenKey={selectedGroup}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110 }}>
            <Pressable onPress={() => setSelectedGroup(null)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <ChevronLeft size={16} color={colors.textDim} />
              <Text style={{ color: colors.textDim, fontFamily: fonts.bodyBold, fontSize: 13 }}>Muscle groups</Text>
            </Pressable>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: colors.text, marginBottom: 14, textTransform: "capitalize" }}>
              {selectedGroup}
            </Text>
            {!detailLoaded ? null : detailTrend.length > 0 ? (
              <Card variant="card" style={{ padding: 18 }}>
                <Text style={{ fontSize: 11, fontFamily: fonts.bodyExtraBold, color: colors.textDim, textTransform: "uppercase", marginBottom: 10 }}>
                  Best e1RM trend
                </Text>
                <LineChart values={detailTrend} color={colors.primary} />
              </Card>
            ) : (
              <Text style={{ color: colors.textDim, fontSize: 13, textAlign: "center", paddingVertical: 30, fontFamily: fonts.bodyRegular }}>
                No logged sets for this group yet.
              </Text>
            )}
          </ScrollView>
        </AnimatedScreen>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <AppHeader title="Progress" />
      <AnimatedScreen>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110, gap: 16 }}>
          <Card variant="card" style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <ProgressRing size={56} strokeWidth={7} progress={consistPct} trackColor={colors.cardAlt} progressColor={colors.secondary} />
            <View>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text }}>
                {consistency ? `${consistency.days_trained}/${consistency.total_days}` : "—"}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textDim, fontFamily: fonts.bodyRegular }}>days trained</Text>
            </View>
          </Card>

          <Card variant="card" style={{ padding: 18 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text }}>Body weight</Text>
              <Pressable
                onPress={() => setIsWeightLogOpen(true)}
                style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
              >
                <Text style={{ fontSize: 11, fontFamily: fonts.bodyExtraBold, color: colors.primary }}>+ Log</Text>
              </Pressable>
            </View>
            <LineChart values={weightTrend.entries.map((e) => e.weight)} color={colors.secondary} />
            <Text style={{ fontSize: 11, color: colors.textDim, marginTop: 4, fontFamily: fonts.bodyRegular }}>
              {latestWeight ? `${latestWeight.weight} ${weightTrend.unit}` : "No entries yet"}
              {trendingDown !== null ? ` · trending ${trendingDown ? "down" : "up"}` : ""}
            </Text>
          </Card>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text }}>Progress photos</Text>
            <Pressable
              onPress={() => {
                setIsPhotoOpen(true);
                setPhotoAttached(false);
              }}
              style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Text style={{ fontSize: 11, fontFamily: fonts.bodyExtraBold, color: colors.primary }}>+ Add</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => {
              setIsPhotoOpen(true);
              setPhotoAttached(false);
            }}
            style={{
              width: 78,
              height: 96,
              borderRadius: 16,
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.textDim, fontSize: 22 }}>+</Text>
          </Pressable>

          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text }}>Muscle groups</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {MUSCLE_GROUPS.map((group) => (
              <Pressable key={group} onPress={() => openGroup(group)} style={{ width: "47%" }}>
                <Card variant="plain" style={{ borderRadius: 20, padding: 14 }}>
                  <Text style={{ fontSize: 11, fontFamily: fonts.bodyExtraBold, color: colors.textDim, textTransform: "uppercase" }}>
                    {group}
                  </Text>
                  <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.text, marginTop: 4 }}>
                    {bestByGroup[group] ? `${Math.round(bestByGroup[group])} lb` : "—"}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </AnimatedScreen>

      <CenterModal visible={isWeightLogOpen} onClose={() => setIsWeightLogOpen(false)} widthPct={78}>
        <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 15, marginBottom: 14 }}>Log body weight</Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          <TextInput
            value={weightInput}
            onChangeText={setWeightInput}
            placeholder="180"
            placeholderTextColor={colors.textDim}
            keyboardType="decimal-pad"
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.bg,
              color: colors.text,
              textAlign: "center",
              fontFamily: fonts.bodyMedium,
            }}
          />
          <Pressable
            onPress={() => setWeightUnit((u) => (u === "lb" ? "kg" : "lb"))}
            style={{ paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13 }}>{weightUnit}</Text>
          </Pressable>
        </View>
        <Button title="Save" onPress={saveWeight} />
      </CenterModal>

      <CenterModal visible={isPhotoOpen} onClose={() => setIsPhotoOpen(false)} widthPct={78}>
        {photoAttached ? (
          <View style={{ width: "100%", height: 140, borderRadius: 16, backgroundColor: colors.cardAlt, alignItems: "flex-end", justifyContent: "flex-end", padding: 8 }}>
            <Text style={{ fontSize: 9, fontFamily: "monospace", color: colors.text, backgroundColor: colors.card, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 }}>
              sample photo
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={() => setPhotoAttached(true)}
            style={{
              width: "100%",
              height: 140,
              borderRadius: 16,
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <Camera size={26} color={colors.textDim} />
            <Text style={{ fontSize: 11, color: colors.textDim, fontFamily: fonts.bodyBold }}>Tap to add photo</Text>
          </Pressable>
        )}
        <Text style={{ fontSize: 11, color: colors.textDim, marginTop: 12, textAlign: "center", fontFamily: fonts.bodyRegular }}>
          Photo uploads — coming soon, UI ready for it.
        </Text>
      </CenterModal>
    </ScreenBackground>
  );
}
