import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import Svg, { Circle, Polyline } from "react-native-svg";
import { ChevronLeft, TrendingUp, TrendingDown, X } from "lucide-react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../constants/theme";
import { API_URL } from "../../constants/api";
import { Card } from "../../components/Card";
import { authFetch } from "../../lib/session";

type Consistency = { days_trained: number; total_days: number };
type BodyWeightPoint = { weight: number; unit?: string; logged_at?: string | null; date?: string };
type MuscleGroup = { muscle_group: string; best_e1rm: number };
type Exercise = { id: number; name: string; muscle_group: string };
type E1rmEntry = { date: string; weight: number; reps: number; e1rm: number };

const CONSISTENCY_RADIUS = 23;
const CONSISTENCY_CIRCUMFERENCE = 2 * Math.PI * CONSISTENCY_RADIUS;

const CHART_WIDTH = 300;
const CHART_HEIGHT = 90;

// Trailing windows for the body-weight trend, passed straight to
// /progress/body-weight's ?days=. null = omit the param = full history.
const WEIGHT_RANGES: { label: string; days: number | null }[] = [
  { label: "4W", days: 28 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
  { label: "All", days: null },
];

const rangeLabelFor = (days: number | null) => {
  switch (days) {
    case 28:
      return "4 weeks";
    case 90:
      return "3 months";
    case 365:
      return "1 year";
    default:
      return "all time";
  }
};

/**
 * Maps a series of numbers onto the design's 300x90 chart box. Matches the
 * design source's own math (baseline y=80, 60px of vertical range) so a
 * flat series sits on the baseline instead of dividing by zero.
 */
const toPolylinePoints = (values: number[]) => {
  if (values.length === 0) return "";
  if (values.length === 1) return `0,20 ${CHART_WIDTH},20`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * CHART_WIDTH;
      const y = 80 - ((value - min) / span) * 60;
      return `${x},${y}`;
    })
    .join(" ");
};

export default function Progress() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [consistency, setConsistency] = useState<Consistency | null>(null);
  const [bodyWeights, setBodyWeights] = useState<BodyWeightPoint[]>([]);
  // /progress/body-weight normalises every entry to one unit and reports
  // which, at the top level — the entries themselves carry no unit.
  const [weightUnit, setWeightUnit] = useState<string | null>(null);
  // Trailing window passed to /progress/body-weight as ?days=. null = no
  // param, i.e. the endpoint's default of the full history.
  const [rangeDays, setRangeDays] = useState<number | null>(null);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [loadError, setLoadError] = useState("");

  // "+ Log" weight entry
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [unitDraft, setUnitDraft] = useState<"lb" | "kg">("lb");
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [weightError, setWeightError] = useState("");

  // Drilldown: muscle group -> its exercises -> one exercise's e1RM trend.
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupExercises, setGroupExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [e1rmEntries, setE1rmEntries] = useState<E1rmEntry[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const loadProgress = useCallback(async () => {
    setLoadError("");
    try {
      const get = async (path: string) => {
        const response = await authFetch(`${API_URL}${path}`);
        if (!response.ok) throw new Error(path);
        return response.json();
      };

      const [consistencyResult, muscleGroupResult] = await Promise.allSettled([
        get("/progress/consistency"),
        get("/progress/muscle-groups"),
      ]);

      if (consistencyResult.status === "fulfilled") setConsistency(consistencyResult.value);
      if (muscleGroupResult.status === "fulfilled") setMuscleGroups(muscleGroupResult.value);

      if (consistencyResult.status === "rejected" && muscleGroupResult.status === "rejected") {
        setLoadError("Could not load progress data.");
      }
    } catch {
      setLoadError("Could not reach the server.");
    }
  }, []);

  // Body weight is fetched separately from the rest of the screen because
  // it's the only part that reloads when the range chips change — pulling
  // consistency and muscle groups again on every chip tap would be waste.
  const loadBodyWeight = useCallback(async (days: number | null) => {
    try {
      const response = await authFetch(
        `${API_URL}/progress/body-weight${days ? `?days=${days}` : ""}`
      );
      if (!response.ok) return;
      const payload = await response.json();
      // Endpoint shape isn't pinned down by a response_model, so accept
      // either a bare list or a wrapper with an entries/points array.
      const points: BodyWeightPoint[] = Array.isArray(payload)
        ? payload
        : payload?.entries ?? payload?.points ?? [];
      setBodyWeights(points);
      if (!Array.isArray(payload) && typeof payload?.unit === "string") {
        setWeightUnit(payload.unit);
      }
    } catch {
      // leave the previous trend on screen rather than blanking the card
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProgress();
    }, [loadProgress])
  );

  // Runs on mount and on every range change.
  useEffect(() => {
    // Synchronize the selected range with its server-backed series.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBodyWeight(rangeDays);
  }, [rangeDays, loadBodyWeight]);

  // Opens the weight entry sheet, defaulting the unit to whatever the user
  // is currently tracking in so they don't have to re-pick it each time.
  const openWeightLogger = () => {
    setUnitDraft(weightUnit === "kg" ? "kg" : "lb");
    setWeightInput("");
    setWeightError("");
    setIsWeightModalOpen(true);
  };

  const saveBodyWeight = async () => {
    const weight = Number(weightInput);
    if (!weightInput.trim() || Number.isNaN(weight) || weight <= 0) {
      setWeightError("Enter a weight.");
      return;
    }
    setIsSavingWeight(true);
    setWeightError("");
    try {
      const response = await authFetch(`${API_URL}/body-weight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight, unit: unitDraft }),
      });
      if (!response.ok) {
        setWeightError("Could not save that entry.");
        return;
      }
      setIsWeightModalOpen(false);
      // Re-read the trend so the chart and "latest" line include the new
      // point (and re-normalise if the unit just changed).
      loadBodyWeight(rangeDays);
    } catch {
      setWeightError("Could not reach the server.");
    } finally {
      setIsSavingWeight(false);
    }
  };

  const openGroup = async (group: string) => {
    setSelectedGroup(group);
    setSelectedExercise(null);
    setE1rmEntries([]);
    setGroupExercises([]);
    setIsLoadingDetail(true);
    try {
      const response = await authFetch(
        `${API_URL}/exercises?muscle_group=${encodeURIComponent(group)}`
      );
      if (response.ok) setGroupExercises(await response.json());
    } catch {
      // leave the list empty; the detail view renders its own empty state
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const openExercise = async (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setE1rmEntries([]);
    setIsLoadingDetail(true);
    try {
      const response = await authFetch(`${API_URL}/progress/e1rm?exercise_id=${exercise.id}`);
      if (response.ok) {
        const payload = await response.json();
        setE1rmEntries(payload?.entries ?? []);
      }
    } catch {
      setE1rmEntries([]);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedGroup(null);
    setSelectedExercise(null);
    setGroupExercises([]);
    setE1rmEntries([]);
  };

  const weightValues = bodyWeights
    .map((point) => Number(point.weight))
    .filter((value) => !Number.isNaN(value));
  const latestWeight = bodyWeights.length ? bodyWeights[bodyWeights.length - 1] : null;

  // Change across the selected window: last minus first. Deliberately not
  // colour-coded good/bad — whether "up" is progress depends on the user's
  // goal (cut vs bulk), which this card has no business assuming.
  const weightDelta =
    weightValues.length > 1 ? weightValues[weightValues.length - 1] - weightValues[0] : null;
  const weightDeltaLabel =
    weightDelta === null
      ? "not enough data yet"
      : Math.abs(weightDelta) < 0.05
        ? "no change"
        : `${Math.abs(weightDelta).toFixed(1)} ${weightUnit ?? "lb"}`;
  // null when there's no direction to show (no data, or change below the
  // 0.05 "no change" threshold above) - callers render the icon only when
  // this is non-null, so the two stay in sync with the label automatically.
  const weightDeltaDirection: "up" | "down" | null =
    weightDelta === null || Math.abs(weightDelta) < 0.05
      ? null
      : weightDelta > 0
        ? "up"
        : "down";

  const weightHigh = weightValues.length ? Math.max(...weightValues) : null;
  const weightLow = weightValues.length ? Math.min(...weightValues) : null;

  // Short axis labels for the first and last point actually plotted, so the
  // line has a readable time span instead of being an anonymous squiggle.
  const toDate = (iso: string | null | undefined) => {
    if (!iso) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const rangeStartDate = toDate(bodyWeights[0]?.logged_at ?? bodyWeights[0]?.date);
  const rangeEndDate = toDate(
    bodyWeights[bodyWeights.length - 1]?.logged_at ?? bodyWeights[bodyWeights.length - 1]?.date
  );
  // Include the year once the window straddles a year boundary — otherwise
  // a point from last August renders as a bare "Aug 3" and reads as recent.
  const spansYears =
    rangeStartDate && rangeEndDate && rangeStartDate.getFullYear() !== rangeEndDate.getFullYear();
  const axisDate = (date: Date | null) =>
    !date
      ? ""
      : date.toLocaleDateString(
          undefined,
          spansYears ? { month: "short", year: "numeric" } : { month: "short", day: "numeric" }
        );
  const rangeStartLabel = axisDate(rangeStartDate);
  const rangeEndLabel = axisDate(rangeEndDate);

  const consistencyPct =
    consistency && consistency.total_days > 0
      ? Math.min(1, consistency.days_trained / consistency.total_days)
      : 0;

  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.bgBase, colors.bgBase, colors.gradientBottom]}
      locations={[0, 0.3, 0.7, 1]}
      style={{ flex: 1 }}
    >
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 6 }}>
        <Text style={{ color: colors.textDim, fontSize: 12, letterSpacing: 0.72, fontFamily: fonts.bodyBold }}>
          YOUR TRENDS
        </Text>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontFamily: fonts.heading }}>Progress</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {loadError !== "" && (
          <Text style={{ color: colors.danger, fontSize: 12, fontFamily: fonts.body }}>{loadError}</Text>
        )}

        {selectedGroup === null ? (
          <>
            {/* Consistency ring */}
            <Card
              shape="secondary"
              style={{
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Svg width={56} height={56} viewBox="0 0 56 56">
                <Circle cx={28} cy={28} r={CONSISTENCY_RADIUS} fill="none" stroke={colors.bgInset} strokeWidth={7} />
                <Circle
                  cx={28}
                  cy={28}
                  r={CONSISTENCY_RADIUS}
                  fill="none"
                  stroke={colors.gold}
                  strokeWidth={7}
                  strokeLinecap="round"
                  strokeDasharray={CONSISTENCY_CIRCUMFERENCE}
                  strokeDashoffset={CONSISTENCY_CIRCUMFERENCE * (1 - consistencyPct)}
                  transform="rotate(-90 28 28)"
                />
              </Svg>
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontFamily: fonts.bodyBold }}>
                  {consistency ? `${consistency.days_trained}/${consistency.total_days}` : "—"}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 11, fontFamily: fonts.body }}>days trained</Text>
              </View>
            </Card>

            {/* Body weight trend */}
            <Card shape="secondary" style={{ padding: 18, borderWidth: 1, borderColor: colors.border }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: fonts.bodyBold }}>
                  Body weight
                </Text>
                {/* "+ Log" pill — specified in the design source's body
                    weight card header (openWeightLog). */}
                <Pressable
                  onPress={openWeightLogger}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Log body weight"
                  style={{
                    backgroundColor: colors.tealSoft,
                    borderRadius: 99,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ color: colors.teal, fontSize: 11, fontFamily: fonts.bodyExtra }}>+ Log</Text>
                </Pressable>
              </View>

              {/* Range chips — same pill treatment as the muscle-group
                  filters on Workout and the lb/kg chips below. */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {WEIGHT_RANGES.map((range) => {
                  const selected = rangeDays === range.days;
                  return (
                    <Pressable
                      key={range.label}
                      onPress={() => setRangeDays(range.days)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: selected ? colors.teal : colors.border,
                        backgroundColor: selected ? colors.tealSoft : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? colors.teal : colors.textDim,
                          fontSize: 11,
                          fontFamily: fonts.bodyExtra,
                        }}
                      >
                        {range.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {weightValues.length === 0 ? (
                <Text style={{ color: colors.textFaint, fontSize: 12, paddingVertical: 20, fontFamily: fonts.body }}>
                  {rangeDays === null
                    ? "No body-weight entries yet."
                    : "No entries in this range."}
                </Text>
              ) : (
                <>
                  {/* High/low give the line a vertical scale; the chart maps
                      min..max onto a fixed band, so without them the shape
                      is unreadable in absolute terms. */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ color: colors.textFaint, fontSize: 10, fontFamily: fonts.body }}>
                      High {weightHigh?.toFixed(1)} {weightUnit ?? "lb"}
                    </Text>
                    <Text style={{ color: colors.textFaint, fontSize: 10, fontFamily: fonts.body }}>
                      Low {weightLow?.toFixed(1)} {weightUnit ?? "lb"}
                    </Text>
                  </View>

                  <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
                    <Polyline
                      points={toPolylinePoints(weightValues)}
                      fill="none"
                      stroke={colors.gold}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>

                  {/* Date axis: first and last plotted point. */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2, marginBottom: 8 }}>
                    <Text style={{ color: colors.textFaint, fontSize: 10, fontFamily: fonts.body }}>
                      {rangeStartLabel}
                    </Text>
                    <Text style={{ color: colors.textFaint, fontSize: 10, fontFamily: fonts.body }}>
                      {rangeEndLabel}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: fonts.bodyBold }}>
                      {latestWeight ? `${latestWeight.weight} ${weightUnit ?? "lb"}` : "—"}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      {weightDeltaDirection === "up" && (
                        <TrendingUp size={12} color={colors.textDim} />
                      )}
                      {weightDeltaDirection === "down" && (
                        <TrendingDown size={12} color={colors.textDim} />
                      )}
                      <Text style={{ color: colors.textDim, fontSize: 11, fontFamily: fonts.body }}>
                        {weightDeltaLabel}
                        {weightDelta !== null && ` over ${rangeLabelFor(rangeDays)}`}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </Card>

            {/* Progress photos — visual only. No progress_photos table or
                upload endpoint exists, so the tiles are inert placeholders
                rather than a broken feature. */}
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: fonts.bodyBold }}>
                Progress photos
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                <View
                  accessibilityLabel="Photo tracking is not available yet"
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
                </View>
                <View style={{ justifyContent: "center", paddingLeft: 4 }}>
                  <Text style={{ color: colors.textFaint, fontSize: 11, fontFamily: fonts.body }}>
                    {"Photo tracking isn't available yet."}
                  </Text>
                </View>
              </ScrollView>
            </View>

            {/* Muscle groups */}
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: fonts.bodyBold }}>
              Muscle groups
            </Text>
            {muscleGroups.length === 0 ? (
              <Text style={{ color: colors.textFaint, fontSize: 12, fontFamily: fonts.body }}>
                Log some sets to see your strength by muscle group.
              </Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {muscleGroups.map((group) => (
                  <Pressable
                    key={group.muscle_group}
                    onPress={() => openGroup(group.muscle_group)}
                    style={{
                      width: "48%",
                      borderRadius: 20,
                      padding: 14,
                      backgroundColor: colors.bgCard,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textDim,
                        fontSize: 11,
                        letterSpacing: 0.55,
                        fontFamily: fonts.bodyExtra,
                      }}
                    >
                      {group.muscle_group.toUpperCase()}
                    </Text>
                    <Text style={{ color: colors.textPrimary, fontSize: 18, marginTop: 4, fontFamily: fonts.heading }}>
                      {group.best_e1rm ? `${Math.round(group.best_e1rm)} lb` : "—"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : (
          /* Detail: exercises in a group, then one exercise's e1RM trend */
          <>
            <Pressable
              onPress={selectedExercise ? () => setSelectedExercise(null) : closeDetail}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 12 }}
            >
              <ChevronLeft size={14} color={colors.textDim} />
              <Text style={{ color: colors.textDim, fontSize: 13, fontFamily: fonts.bodyBold }}>
                {selectedExercise ? selectedGroup : "Muscle groups"}
              </Text>
            </Pressable>

            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 22,
                marginBottom: 14,
                textTransform: "capitalize",
                fontFamily: fonts.heading,
              }}
            >
              {selectedExercise ? selectedExercise.name : selectedGroup}
            </Text>

            {isLoadingDetail ? (
              <Text style={{ color: colors.textFaint, fontSize: 13, fontFamily: fonts.body }}>Loading…</Text>
            ) : selectedExercise ? (
              e1rmEntries.length === 0 ? (
                <Text style={{ color: colors.textDim, fontSize: 13, textAlign: "center", paddingVertical: 30, fontFamily: fonts.body }}>
                  No logged sets for this exercise yet.
                </Text>
              ) : (
                <Card shape="secondary" style={{ padding: 18, borderWidth: 1, borderColor: colors.border }}>
                  <Text
                    style={{
                      color: colors.textDim,
                      fontSize: 11,
                      letterSpacing: 0.55,
                      marginBottom: 8,
                      fontFamily: fonts.bodyExtra,
                    }}
                  >
                    BEST E1RM TREND
                  </Text>
                  <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
                    <Polyline
                      points={toPolylinePoints(e1rmEntries.map((entry) => entry.e1rm))}
                      fill="none"
                      stroke={colors.teal}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                  <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 6, fontFamily: fonts.body }}>
                    Best {Math.round(Math.max(...e1rmEntries.map((e) => e.e1rm)))} lb across{" "}
                    {e1rmEntries.length} logged {e1rmEntries.length === 1 ? "set" : "sets"}
                  </Text>
                </Card>
              )
            ) : groupExercises.length === 0 ? (
              <Text style={{ color: colors.textDim, fontSize: 13, textAlign: "center", paddingVertical: 30, fontFamily: fonts.body }}>
                No exercises found for this group.
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                {groupExercises.map((exercise) => (
                  <Pressable
                    key={exercise.id}
                    onPress={() => openExercise(exercise)}
                    style={{
                      borderRadius: 20,
                      padding: 14,
                      backgroundColor: colors.bgCard,
                      borderWidth: 1,
                      borderColor: colors.border,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: fonts.bodyBold }}>
                      {exercise.name}
                    </Text>
                    <Text style={{ color: colors.textFaint, fontSize: 16 }}>›</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Body weight entry sheet — same modal Card + input + Cancel/Save
          shape as Nutrition's food picker. */}
      {isWeightModalOpen && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <Card shape="modal" style={{ padding: 20, width: "100%", maxWidth: 360 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontFamily: fonts.heading }}>
                Log body weight
              </Text>
              <Pressable onPress={() => setIsWeightModalOpen(false)} hitSlop={8}>
                <X size={18} color={colors.textFaint} />
              </Pressable>
            </View>

            <Text
              style={{
                color: colors.textDim,
                fontSize: 11,
                letterSpacing: 0.55,
                marginBottom: 6,
                fontFamily: fonts.bodyExtra,
              }}
            >
              WEIGHT
            </Text>
            <TextInput
              value={weightInput}
              onChangeText={(text) => {
                if (!/^\d*\.?\d*$/.test(text)) return;
                setWeightInput(text);
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textFaint}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                paddingVertical: 14,
                paddingHorizontal: 16,
                fontSize: 14,
                color: colors.textPrimary,
                backgroundColor: colors.bgCard,
                marginBottom: 14,
              }}
            />

            <Text
              style={{
                color: colors.textDim,
                fontSize: 11,
                letterSpacing: 0.55,
                marginBottom: 6,
                fontFamily: fonts.bodyExtra,
              }}
            >
              UNIT
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 4 }}>
              {(["lb", "kg"] as const).map((unit) => {
                const selected = unitDraft === unit;
                return (
                  <Pressable
                    key={unit}
                    onPress={() => setUnitDraft(unit)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: selected ? colors.teal : colors.border,
                      backgroundColor: selected ? colors.tealSoft : colors.bgCard,
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? colors.teal : colors.textPrimary,
                        fontSize: 13,
                        fontFamily: fonts.bodyBold,
                      }}
                    >
                      {unit}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {weightError !== "" && (
              <Text style={{ color: colors.danger, fontSize: 12, marginTop: 10, fontFamily: fonts.body }}>
                {weightError}
              </Text>
            )}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <Pressable
                onPress={() => setIsWeightModalOpen(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: colors.bgInset,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: fonts.bodySemi }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveBodyWeight}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: colors.teal,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.tealOn, fontSize: 14, fontFamily: fonts.bodySemi }}>
                  {isSavingWeight ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </View>
          </Card>
        </View>
      )}
    </LinearGradient>
  );
}
