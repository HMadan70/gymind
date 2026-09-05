import { View, Text, Pressable, TextInput, ScrollView } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useWorkoutSession } from "../../context/WorkoutSessionContext";
import { useState, useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Trash2, ChevronDown, Check, Star, X } from "lucide-react-native";
import { API_URL } from "../../constants/api";
import { fonts } from "../../constants/theme";
import { ScreenBackground } from "../../components/brand/ScreenBackground";
import { AnimatedScreen } from "../../components/brand/AnimatedScreen";
import { AppHeader } from "../../components/brand/AppHeader";
import { Card } from "../../components/brand/Card";
import { Button } from "../../components/brand/Button";
import { Chip } from "../../components/brand/Chip";
import { Sheet } from "../../components/brand/Sheet";
import { CenterModal } from "../../components/brand/CenterModal";
import { PulseDot } from "../../components/brand/PulseDot";

type SetEntry = {
  id: string;
  weight: number;
  weightText?: string;
  reps: number;
  repsText?: string;
  completed: boolean;
};

// Single source of truth for "this set actually counts". The completed
// flag alone isn't enough: a set can carry completed:true while its
// weight/reps are still empty, and such a set must not be rendered as
// checked off or counted by any stat. Every counter and the set-row
// renderer go through this so the numbers on screen can never disagree
// with the rows on screen.
const isSetLogged = (set: SetEntry) => set.completed && set.weight > 0 && set.reps > 0;

type ExerciseEntry = {
  id: string;
  name: string;
  sets: SetEntry[];
  exerciseId?: number;
};

type ExerciseOption = {
  id: number;
  name: string;
  muscle_group: string;
};

type ExerciseHistorySet = {
  set_number: number;
  weight: number | null;
  reps: number | null;
};

type ExerciseHistory = {
  previous_sets: ExerciseHistorySet[];
  suggested_target_weight: number | null;
};

const MUSCLE_GROUPS = ["chest", "back", "legs", "shoulders", "arms", "core"];

const formatWorkoutDate = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export default function Workout() {
  const { colors, shape } = useTheme();
  const { setSession } = useWorkoutSession();
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExerciseOption[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [activeMuscleGroup, setActiveMuscleGroup] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<ExerciseOption[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [workoutTitle] = useState("Push Day A");
  const [pendingRemoval, setPendingRemoval] = useState<ExerciseEntry | null>(null);

  const [workoutId, setWorkoutId] = useState<number | null>(null);
  const [historyByExercise, setHistoryByExercise] = useState<Record<string, ExerciseHistory>>({});
  const [notesByExercise, setNotesByExercise] = useState<Record<string, string>>({});
  const [openNoteFor, setOpenNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [pastWorkouts, setPastWorkouts] = useState<{ id: number; started_at: string; ended_at: string | null }[]>([]);
  const [isPastWorkoutsOpen, setIsPastWorkoutsOpen] = useState(false);
  const [pendingWorkoutDeletion, setPendingWorkoutDeletion] = useState<number | null>(null);

  const stats = useMemo(() => {
    const allSets = exercises.flatMap((exercise) => exercise.sets);

    const volume = allSets.reduce((sum, set) => sum + (set.weight || 0) * (set.reps || 0), 0);

    const plannedSets = exercises.reduce((total, exercise) => {
      const exerciseHistory = historyByExercise[exercise.id];
      return total + Math.max(exercise.sets.length, exerciseHistory?.previous_sets.length || 0);
    }, 0);

    const completedSets = allSets.filter(isSetLogged).length;

    const e1rm = allSets.reduce((best, set) => {
      if (!set.weight || !set.reps) return best;
      const estimated1RM = set.weight * (1 + set.reps / 30);
      return estimated1RM > best ? estimated1RM : best;
    }, 0);

    return { volume, plannedSets, completedSets, e1rm };
  }, [exercises, historyByExercise]);

  const addExercise = (name: string, exerciseId?: number) => {
    const newExercise: ExerciseEntry = { id: Date.now().toString(), name, sets: [], exerciseId };
    setExercises([...exercises, newExercise]);
    return newExercise.id;
  };

  const updateExercise = (exerciseId: string, updates: Partial<ExerciseEntry>) => {
    setExercises(
      exercises.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        return { ...exercise, ...updates };
      })
    );
  };

  const addSet = (exerciseId: string) => {
    const newSet: SetEntry = {
      id: Date.now().toString(),
      weight: 0,
      weightText: "",
      reps: 0,
      repsText: "",
      completed: false,
    };
    setExercises(
      exercises.map((exercise) => {
        if (exercise.id === exerciseId) {
          return { ...exercise, sets: [...exercise.sets, newSet] };
        }
        return exercise;
      })
    );
  };

  const updateSet = (exerciseId: string, setId: string, updates: Partial<SetEntry>) => {
    setExercises(
      exercises.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((set) => {
            if (set.id !== setId) return set;
            return { ...set, ...updates };
          }),
        };
      })
    );
  };

  const removeSet = (exerciseId: string, setId: string) => {
    setExercises(
      exercises.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        return { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) };
      })
    );
  };

  const removeExercise = (exerciseId: string) => {
    setExercises(exercises.filter((exercise) => exercise.id !== exerciseId));
  };

  const confirmRemoveExercise = (exercise: ExerciseEntry) => {
    setPendingRemoval(exercise);
  };

  const resetWorkout = () => {
    setExercises([]);
    setElapsedSeconds(0);
    setIsRunning(false);
    setHasStarted(false);
    setWorkoutId(null);
    setHistoryByExercise({});
    setNotesByExercise({});
    setOpenNoteFor(null);
  };

  const toggleExerciseExpanded = (exerciseId: string) => {
    setExpandedExercises((prev) => ({ ...prev, [exerciseId]: !prev[exerciseId] }));
  };

  const toggleGroupExpanded = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const searchExercises = async (query: string, muscleGroup: string | null) => {
    if (query.length === 0 && !muscleGroup) {
      setSearchResults([]);
      return;
    }
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(
      `${API_URL}/exercises?search=${query}${muscleGroup ? `&muscle_group=${muscleGroup}` : ""}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    setSearchResults(data);
  };

  const fetchFavorites = async () => {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${API_URL}/exercises?favorites_only=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    setFavorites(data);
  };

  const fetchPastWorkouts = async () => {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${API_URL}/workouts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    setPastWorkouts(data);
  };

  const deletePastWorkout = async (id: number) => {
    const token = await AsyncStorage.getItem("token");
    await fetch(`${API_URL}/workouts/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setPastWorkouts((prev) => prev.filter((w) => w.id !== id));
    setPendingWorkoutDeletion(null);
  };

  const toggleFavorite = async (option: ExerciseOption, isFavorited: boolean) => {
    const token = await AsyncStorage.getItem("token");
    await fetch(`${API_URL}/exercises/${option.id}/favorite`, {
      method: isFavorited ? "DELETE" : "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchFavorites();
  };

  const toggleMuscleGroupFilter = (group: string) => {
    const next = activeMuscleGroup === group ? null : group;
    setActiveMuscleGroup(next);
    searchExercises(searchQuery, next);
  };

  const fetchExerciseHistory = async (localExerciseId: string, realExerciseId: number) => {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${API_URL}/exercises/${realExerciseId}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    setHistoryByExercise((prev) => ({ ...prev, [localExerciseId]: data }));
  };

  const selectExercise = (option: ExerciseOption) => {
    const localId = addExercise(option.name, option.id);
    fetchExerciseHistory(localId, option.id);
    setIsPickerOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setActiveMuscleGroup(null);
  };

  const startSession = async () => {
    setIsRunning(true);
    setHasStarted(true);
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${API_URL}/workouts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    setWorkoutId(data.id);
  };

  const openNoteEditor = (exercise: ExerciseEntry) => {
    setOpenNoteFor(exercise.id);
    setNoteDraft(notesByExercise[exercise.id] || "");
  };

  const saveNote = async (exercise: ExerciseEntry) => {
    if (workoutId !== null && exercise.exerciseId !== undefined) {
      const token = await AsyncStorage.getItem("token");
      await fetch(`${API_URL}/workouts/${workoutId}/exercises/${exercise.exerciseId}/note`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note: noteDraft }),
      });
    }
    setNotesByExercise((prev) => ({ ...prev, [exercise.id]: noteDraft }));
    setOpenNoteFor(null);
  };

  const finishWorkout = async () => {
    setIsRunning(false);
    setConfirmFinish(false);
    if (workoutId === null) return;
    const token = await AsyncStorage.getItem("token");
    await fetch(`${API_URL}/workouts/${workoutId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchPastWorkouts();
  };

  const syncSet = async (exercise: ExerciseEntry, set: SetEntry) => {
    if (workoutId === null || exercise.exerciseId === undefined) return;
    const token = await AsyncStorage.getItem("token");
    try {
      const response = await fetch(`${API_URL}/workouts/${workoutId}/sets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          exercise_id: exercise.exerciseId,
          set_number: exercise.sets.indexOf(set) + 1,
          weight: set.weight,
          reps: set.reps,
        }),
      });
      if (!response.ok) throw new Error("save failed");
    } catch {
      // If the save fails, un-check the set so it doesn't sit checked
      // locally while the backend never actually received it.
      updateSet(exercise.id, set.id, { completed: false });
    }
  };

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  useEffect(() => {
    fetchPastWorkouts();
  }, []);

  // Publishes session status to WorkoutSessionContext so Home's Workout CTA
  // card can show Start/Resume without this screen's own state model
  // changing at all - see WorkoutSessionContext.tsx.
  useEffect(() => {
    setSession({ hasStarted, isRunning, elapsedSeconds });
  }, [hasStarted, isRunning, elapsedSeconds]);

  const sessionStatusLabel = isRunning ? "SESSION LIVE" : elapsedSeconds > 0 ? "SESSION PAUSED" : "NOT STARTED";
  const sessionDotColor = isRunning ? colors.primary : elapsedSeconds > 0 ? colors.secondary : colors.textDim;

  return (
    <ScreenBackground>
      <AppHeader title="Workout" />
      <AnimatedScreen>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110, gap: 14 }}>
          <Card variant="hero" style={{ padding: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <PulseDot color={sessionDotColor} active={isRunning} size={9} />
                <Text style={{ fontSize: 12, fontFamily: fonts.bodyExtraBold, letterSpacing: 0.7, color: colors.textDim }}>
                  {sessionStatusLabel}
                </Text>
              </View>
              {hasStarted && (
                <Pressable onPress={() => setConfirmFinish(true)}>
                  <Text style={{ fontSize: 12, fontFamily: fonts.bodyExtraBold, color: colors.danger }}>Finish</Text>
                </Pressable>
              )}
            </View>

            <Text style={{ fontSize: 11, color: colors.textDim, fontFamily: fonts.bodyBold, marginTop: 10 }}>
              {workoutTitle}
            </Text>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 40, color: colors.text, letterSpacing: 0.5 }}>
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </Text>

            {!hasStarted && <Button title="Start session" onPress={startSession} style={{ marginTop: 12 }} />}
            {hasStarted && isRunning && (
              <Button title="Pause" onPress={() => setIsRunning(false)} variant="outline" style={{ marginTop: 12 }} />
            )}
            {hasStarted && !isRunning && (
              <Button title="Resume" onPress={() => setIsRunning(true)} style={{ marginTop: 12 }} />
            )}
            {hasStarted && (
              <Pressable onPress={resetWorkout} style={{ marginTop: 10, alignSelf: "center" }}>
                <Text style={{ color: colors.textDim, fontSize: 12, fontFamily: fonts.bodyBold }}>Reset workout</Text>
              </Pressable>
            )}
          </Card>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Card variant="plain" style={{ flex: 1, borderRadius: 18, padding: 12, alignItems: "center" }}>
              <Text style={{ fontSize: 10, color: colors.textDim, fontFamily: fonts.bodyBold, textTransform: "uppercase" }}>
                Volume
              </Text>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.text, marginTop: 2 }}>
                {stats.volume.toLocaleString()}
              </Text>
            </Card>
            <Card variant="plain" style={{ flex: 1, borderRadius: 18, padding: 12, alignItems: "center" }}>
              <Text style={{ fontSize: 10, color: colors.textDim, fontFamily: fonts.bodyBold, textTransform: "uppercase" }}>
                Sets
              </Text>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.text, marginTop: 2 }}>
                {stats.completedSets}/{stats.plannedSets}
              </Text>
            </Card>
            <Card variant="plain" style={{ flex: 1, borderRadius: 18, padding: 12, alignItems: "center" }}>
              <Text style={{ fontSize: 10, color: colors.textDim, fontFamily: fonts.bodyBold, textTransform: "uppercase" }}>
                Best e1RM
              </Text>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.text, marginTop: 2 }}>
                {stats.e1rm ? Math.round(stats.e1rm) : "—"}
              </Text>
            </Card>
          </View>

          {exercises.map((exercise) => {
            const totalSets = exercise.sets.length;
            const completedSets = exercise.sets.filter(isSetLogged).length;
            const isCollapsed = !!expandedExercises[exercise.id];
            const isQueued = isCollapsed && completedSets === 0;
            const isFullyCompleted = totalSets > 0 && completedSets === totalSets;
            const history = historyByExercise[exercise.id];
            const totalRows = Math.max(exercise.sets.length, history?.previous_sets.length || 0);
            const statusColor = isFullyCompleted ? colors.primary : completedSets > 0 ? colors.secondary : colors.textDim;
            const statusLabel = isQueued
              ? `QUEUED · ${totalSets} SET${totalSets === 1 ? "" : "S"}`
              : isFullyCompleted
              ? `COMPLETED · ${completedSets}/${totalSets} SET${totalSets === 1 ? "" : "S"}`
              : `IN PROGRESS · ${completedSets}/${totalSets} SET${totalSets === 1 ? "" : "S"}`;

            if (isCollapsed) {
              return (
                <Card key={exercise.id} variant="card" style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor }} />
                    <Pressable onPress={() => toggleExerciseExpanded(exercise.id)} style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 14 }}>
                        {exercise.name}
                      </Text>
                      <Text
                        style={{
                          color: colors.textDim,
                          fontSize: 11,
                          fontFamily: fonts.bodyBold,
                          letterSpacing: 0.4,
                          marginTop: 2,
                          textTransform: "uppercase",
                        }}
                      >
                        {statusLabel}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => confirmRemoveExercise(exercise)} hitSlop={8}>
                      <Trash2 size={16} color={colors.textDim} />
                    </Pressable>
                  </View>
                </Card>
              );
            }

            return (
              <Card key={exercise.id} variant="card" style={{ padding: 16 }}>
                <Pressable
                  onPress={() => toggleExerciseExpanded(exercise.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 14 }}>
                      {exercise.name}
                    </Text>
                    <Text
                      style={{
                        color: colors.textDim,
                        fontSize: 11,
                        fontFamily: fonts.bodyBold,
                        letterSpacing: 0.4,
                        marginTop: 2,
                        textTransform: "uppercase",
                      }}
                    >
                      {statusLabel}
                    </Text>
                  </View>
                  <Pressable onPress={() => confirmRemoveExercise(exercise)} hitSlop={8}>
                    <Trash2 size={16} color={colors.textDim} />
                  </Pressable>
                  <ChevronDown size={18} color={colors.textDim} style={{ transform: [{ rotate: "180deg" }] }} />
                </Pressable>

                {history && history.previous_sets.length > 0 && (
                  <Text
                    style={{
                      color: colors.textDim,
                      fontSize: 11,
                      fontFamily: fonts.bodyBold,
                      letterSpacing: 0.4,
                      marginTop: 10,
                      textTransform: "uppercase",
                    }}
                  >
                    {`PREV ${history.previous_sets[0].weight}×${history.previous_sets
                      .map((set) => set.reps)
                      .join("·")} · TGT ${history.suggested_target_weight}`}
                  </Text>
                )}

                {Array.from({ length: totalRows }).map((_, index) => {
                  const set = exercise.sets[index];
                  const previousSets = history?.previous_sets ?? [];
                  const lastKnownReps =
                    previousSets.length > 0 ? previousSets[previousSets.length - 1].reps : undefined;

                  if (!set) {
                    const plannedWeight = history?.suggested_target_weight;
                    let sessionReps: number | undefined;
                    for (let i = exercise.sets.length - 1; i >= 0; i--) {
                      if (exercise.sets[i].reps > 0) {
                        sessionReps = exercise.sets[i].reps;
                        break;
                      }
                    }
                    const plannedReps = sessionReps ?? lastKnownReps;
                    return (
                      <View
                        key={`planned-${index}`}
                        style={{ flexDirection: "row", alignItems: "center", marginTop: 10, opacity: 0.5 }}
                      >
                        <Text style={{ color: colors.textDim, width: 24, fontFamily: fonts.bodyBold, fontSize: 13 }}>
                          {String(index + 1).padStart(2, "0")}
                        </Text>
                        <Text style={{ color: colors.textDim, fontFamily: fonts.bodyRegular, fontSize: 13 }}>
                          {plannedWeight ?? "—"} lb × {plannedReps ?? "—"}
                        </Text>
                      </View>
                    );
                  }

                  const isLogged = isSetLogged(set);

                  if (isLogged) {
                    return (
                      <View key={set.id} style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                        <Text style={{ color: colors.textDim, width: 24, fontFamily: fonts.bodyBold, fontSize: 13 }}>
                          {String(index + 1).padStart(2, "0")}
                        </Text>
                        <Text style={{ color: colors.text, flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13 }}>
                          {set.weight} lb × {set.reps}
                        </Text>
                        <Pressable
                          onPress={() => {
                            updateSet(exercise.id, set.id, { completed: false });
                            syncSet(exercise, { ...set, completed: false });
                          }}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            backgroundColor: colors.primary,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Check size={15} color={colors.onPrimary} strokeWidth={3} />
                        </Pressable>
                      </View>
                    );
                  }

                  return (
                    <View key={set.id} style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 6 }}>
                      <Text style={{ color: colors.textDim, width: 24, fontFamily: fonts.bodyBold, fontSize: 13 }}>
                        {String(index + 1).padStart(2, "0")}
                      </Text>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: colors.bg,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <TextInput
                          value={set.weightText ?? ""}
                          onChangeText={(text) => {
                            if (!/^\d*\.?\d*$/.test(text)) return;
                            const updates: Partial<SetEntry> = { weightText: text };
                            if (text === "") {
                              updates.weight = 0;
                            } else if (!text.endsWith(".")) {
                              updates.weight = Number(text);
                            }
                            updateSet(exercise.id, set.id, updates);
                          }}
                          placeholder="0"
                          placeholderTextColor={colors.textDim}
                          style={{ color: colors.text, width: 36, fontSize: 12, fontFamily: fonts.bodyMedium }}
                          keyboardType="decimal-pad"
                        />
                        <Text style={{ color: colors.textDim, marginLeft: 3, fontSize: 11 }}>lb</Text>
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: colors.bg,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <TextInput
                          value={set.repsText ?? ""}
                          onChangeText={(text) => {
                            if (!/^\d*$/.test(text)) return;
                            updateSet(exercise.id, set.id, {
                              repsText: text,
                              reps: text === "" ? 0 : Number(text),
                            });
                          }}
                          placeholder="0"
                          placeholderTextColor={colors.textDim}
                          style={{ color: colors.text, width: 32, fontSize: 12, fontFamily: fonts.bodyMedium }}
                          keyboardType="number-pad"
                        />
                        <Text style={{ color: colors.textDim, marginLeft: 3, fontSize: 11 }}>rp</Text>
                      </View>

                      <Pressable
                        onPress={() => {
                          if (set.weight > 0 && set.reps > 0) {
                            updateSet(exercise.id, set.id, { completed: true });
                            syncSet(exercise, { ...set, completed: true });
                          }
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          borderWidth: 1.5,
                          borderColor: colors.border,
                          marginLeft: "auto",
                        }}
                      />
                    </View>
                  );
                })}

                <View style={{ flexDirection: "row", marginTop: 14, justifyContent: "space-between" }}>
                  <Pressable onPress={() => addSet(exercise.id)} style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}>
                    <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13 }}>+ Set</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleExerciseExpanded(exercise.id)}
                    style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}
                  >
                    <Text style={{ color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 13 }}>Done</Text>
                  </Pressable>
                  <Pressable onPress={() => openNoteEditor(exercise)} style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}>
                    <Text
                      style={{
                        color: notesByExercise[exercise.id] ? colors.secondary : colors.text,
                        fontFamily: fonts.bodyBold,
                        fontSize: 13,
                      }}
                    >
                      {notesByExercise[exercise.id] ? "✎ Note" : "+ Note"}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}

          <Pressable
            onPress={() => {
              setIsPickerOpen(true);
              fetchFavorites();
            }}
            style={[
              {
                borderWidth: 1.5,
                borderColor: colors.border,
                borderStyle: "dashed",
                padding: 16,
                alignItems: "center",
              },
              shape.cardCutCorner,
            ]}
          >
            <Text style={{ color: colors.textDim, fontFamily: fonts.bodyBold, fontSize: 13 }}>+ Add exercise</Text>
          </Pressable>

          <Pressable
            onPress={() => setIsPastWorkoutsOpen(true)}
            style={{ marginTop: 6 }}
          >
            <Card variant="card" style={{ padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.textDim, fontSize: 12, fontFamily: fonts.bodyBold, letterSpacing: 0.4 }}>
                PAST WORKOUTS {pastWorkouts.length > 0 ? `(${pastWorkouts.length})` : ""}
              </Text>
              <ChevronDown size={16} color={colors.textDim} style={{ transform: [{ rotate: "-90deg" }] }} />
            </Card>
          </Pressable>
        </ScrollView>
      </AnimatedScreen>

      {/* Exercise picker — bottom sheet (favorites, muscle-group filter, search) */}
      <Sheet visible={isPickerOpen} onClose={() => { setIsPickerOpen(false); setSearchQuery(""); setSearchResults([]); setActiveMuscleGroup(null); }}>
        <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 16, marginBottom: 12 }}>Add exercise</Text>
        <ScrollView style={{ maxHeight: 420 }}>
          <Text style={{ color: colors.textDim, fontSize: 11, fontFamily: fonts.bodyExtraBold, letterSpacing: 0.5, marginBottom: 8 }}>
            FAVORITES
          </Text>
          {favorites.length === 0 && (
            <Text style={{ color: colors.textDim, marginBottom: 8, fontSize: 13 }}>No favorites yet</Text>
          )}
          {MUSCLE_GROUPS.map((group) => {
            const groupFavorites = favorites.filter((f) => f.muscle_group === group);
            if (groupFavorites.length === 0) return null;
            const isGroupExpanded = !!expandedGroups[group];
            return (
              <View key={group} style={{ marginBottom: 8 }}>
                <Pressable onPress={() => toggleGroupExpanded(group)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <ChevronDown
                    size={13}
                    color={colors.textDim}
                    style={{ transform: [{ rotate: isGroupExpanded ? "0deg" : "-90deg" }] }}
                  />
                  <Text style={{ color: colors.textDim, fontSize: 12, fontFamily: fonts.bodyBold, letterSpacing: 0.4 }}>
                    {group.toUpperCase()}
                  </Text>
                </Pressable>
                {isGroupExpanded &&
                  groupFavorites.map((fav) => (
                    <View
                      key={fav.id}
                      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, paddingLeft: 19 }}
                    >
                      <Pressable onPress={() => selectExercise(fav)} style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 13, fontFamily: fonts.bodyMedium }}>{fav.name}</Text>
                      </Pressable>
                      <Pressable onPress={() => toggleFavorite(fav, true)} hitSlop={8}>
                        <Star size={15} color={colors.secondary} fill={colors.secondary} />
                      </Pressable>
                    </View>
                  ))}
              </View>
            );
          })}

          <Text style={{ color: colors.textDim, fontSize: 11, fontFamily: fonts.bodyExtraBold, letterSpacing: 0.5, marginTop: 12, marginBottom: 8 }}>
            SEARCH
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {MUSCLE_GROUPS.map((group) => (
              <Chip
                key={group}
                label={group.charAt(0).toUpperCase() + group.slice(1)}
                selected={activeMuscleGroup === group}
                onPress={() => toggleMuscleGroupFilter(group)}
              />
            ))}
          </View>
          <TextInput
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              searchExercises(text, activeMuscleGroup);
            }}
            placeholder="Search exercises..."
            placeholderTextColor={colors.textDim}
            style={{
              color: colors.text,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              padding: 12,
              marginBottom: 8,
              fontFamily: fonts.bodyRegular,
            }}
          />
          {searchResults.map((result) => (
            <View
              key={result.id}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 }}
            >
              <Pressable onPress={() => selectExercise(result)} style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontFamily: fonts.bodyMedium }}>
                  {result.name} <Text style={{ color: colors.textDim, fontSize: 11 }}>({result.muscle_group})</Text>
                </Text>
              </Pressable>
              <Pressable onPress={() => toggleFavorite(result, false)} hitSlop={8}>
                <Star size={15} color={colors.textDim} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </Sheet>

      {/* Exercise note — bottom sheet */}
      <Sheet visible={openNoteFor !== null} onClose={() => setOpenNoteFor(null)}>
        <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 16, marginBottom: 10 }}>Exercise note</Text>
        <TextInput
          value={noteDraft}
          onChangeText={setNoteDraft}
          placeholder="Cue to remember, machine setting, etc."
          placeholderTextColor={colors.textDim}
          multiline
          style={{
            color: colors.text,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 12,
            minHeight: 100,
            fontFamily: fonts.bodyRegular,
            textAlignVertical: "top",
          }}
        />
        <Button
          title="Save note"
          onPress={() => {
            const exercise = exercises.find((e) => e.id === openNoteFor);
            if (exercise) saveNote(exercise);
          }}
          style={{ marginTop: 12 }}
        />
      </Sheet>

      {/* Past workouts */}
      <CenterModal visible={isPastWorkoutsOpen} onClose={() => setIsPastWorkoutsOpen(false)} widthPct={88}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 16 }}>Past workouts</Text>
          <Pressable onPress={() => setIsPastWorkoutsOpen(false)} hitSlop={8}>
            <X size={18} color={colors.textDim} />
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: 380 }}>
          {pastWorkouts.length === 0 ? (
            <Text style={{ color: colors.textDim, fontSize: 13 }}>No past workouts yet</Text>
          ) : (
            pastWorkouts.map((workout) => (
              <View
                key={workout.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View>
                  <Text style={{ color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 13 }}>
                    {formatWorkoutDate(workout.started_at)}
                  </Text>
                  <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                    {workout.ended_at ? "Finished" : "Not finished"}
                  </Text>
                </View>
                <Pressable onPress={() => setPendingWorkoutDeletion(workout.id)} hitSlop={8}>
                  <Trash2 size={16} color={colors.textDim} />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </CenterModal>

      {/* Remove exercise confirm */}
      <CenterModal visible={pendingRemoval !== null} onClose={() => setPendingRemoval(null)}>
        <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 18, marginBottom: 8 }}>Remove exercise?</Text>
        <Text style={{ color: colors.textDim, marginBottom: 20, fontSize: 13, fontFamily: fonts.bodyRegular }}>
          This removes "{pendingRemoval?.name}" and its logged sets from this session.
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title="Cancel" onPress={() => setPendingRemoval(null)} variant="outline" style={{ flex: 1 }} fullWidth={false} />
          <Button
            title="Remove"
            onPress={() => {
              if (pendingRemoval) removeExercise(pendingRemoval.id);
              setPendingRemoval(null);
            }}
            variant="danger"
            style={{ flex: 1 }}
            fullWidth={false}
          />
        </View>
      </CenterModal>

      {/* Finish workout confirm */}
      <CenterModal visible={confirmFinish} onClose={() => setConfirmFinish(false)}>
        <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 18, marginBottom: 8 }}>Finish this workout?</Text>
        <Text style={{ color: colors.textDim, marginBottom: 20, fontSize: 13, fontFamily: fonts.bodyRegular }}>
          This marks the session as complete and stops the timer.
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title="Cancel" onPress={() => setConfirmFinish(false)} variant="outline" style={{ flex: 1 }} fullWidth={false} />
          <Button title="Finish" onPress={finishWorkout} style={{ flex: 1 }} fullWidth={false} />
        </View>
      </CenterModal>

      {/* Delete past workout confirm */}
      <CenterModal visible={pendingWorkoutDeletion !== null} onClose={() => setPendingWorkoutDeletion(null)}>
        <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 18, marginBottom: 8 }}>Delete this workout?</Text>
        <Text style={{ color: colors.textDim, marginBottom: 20, fontSize: 13, fontFamily: fonts.bodyRegular }}>
          This permanently deletes the whole session and every set logged in it.
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title="Cancel" onPress={() => setPendingWorkoutDeletion(null)} variant="outline" style={{ flex: 1 }} fullWidth={false} />
          <Button
            title="Delete"
            onPress={() => pendingWorkoutDeletion !== null && deletePastWorkout(pendingWorkoutDeletion)}
            variant="danger"
            style={{ flex: 1 }}
            fullWidth={false}
          />
        </View>
      </CenterModal>
    </ScreenBackground>
  );
}
