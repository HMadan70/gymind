import { View, Text, Pressable, TextInput } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useState, useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../../constants/api";

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

// Single source of truth for the small circle at the end of each set
// row. Both the "logged" (filled/checked) and "not yet logged" (hollow)
// variants are built from this one base object so it is structurally
// impossible for two circles on screen to differ from each other -
// only the properties that are supposed to change by state do.
const SET_CIRCLE_BASE = {
  width: 28,
  height: 28,
  borderRadius: 14,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  marginLeft: "auto" as const,
};

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
  const { colors } = useTheme();
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
    console.log("past workouts response:", data);
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, padding: 16 }}>
      <View
        style={{
          borderRadius: 16,
          marginBottom: 12,
          marginTop: 16,
          flexDirection: "row",
          justifyContent: "flex-start",
          alignItems: "center",
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal, marginRight: 8 }} />
        <Text style={{ color: colors.teal, fontSize: 12, letterSpacing: 1 }}>
          {isRunning ? "SESSION LIVE" : elapsedSeconds > 0 ? "SESSION PAUSED" : "NOT STARTED"}
        </Text>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
          {workoutTitle}
        </Text>
        <Text style={{ color: colors.textPrimary, fontSize: 32, marginBottom: 16 }}>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, flex: 1 }}>
          <Text style={{ color: colors.textFaint, fontSize: 11, letterSpacing: 1 }}>VOLUME</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "bold" }}>{stats.volume}</Text>
        </View>

        <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, flex: 1 }}>
          <Text style={{ color: colors.textFaint, fontSize: 11, letterSpacing: 1 }}>SETS</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "bold" }}>
            {stats.completedSets}/{stats.plannedSets}
          </Text>
        </View>

        <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, flex: 1 }}>
          <Text style={{ color: colors.textFaint, fontSize: 11, letterSpacing: 1 }}>BEST E1RM</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "bold" }}>
            {Math.round(stats.e1rm)}
          </Text>
        </View>
      </View>

      {exercises.map((exercise) => {
        const totalSets = exercise.sets.length;
        const completedSets = exercise.sets.filter(isSetLogged).length;
        const isCollapsed = !!expandedExercises[exercise.id];
        const isQueued = isCollapsed && completedSets === 0;
        const isFullyCompleted = totalSets > 0 && completedSets === totalSets;
        const history = historyByExercise[exercise.id];
        const totalRows = Math.max(exercise.sets.length, history?.previous_sets.length || 0);
        const currentOrCompletedSetNumber = Math.min(completedSets, totalRows);

        if (isCollapsed) {
          return (
            <View
              key={exercise.id}
              style={{
                backgroundColor: colors.bgCard,
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <Pressable onPress={() => toggleExerciseExpanded(exercise.id)} style={{ flex: 1 }}>
                <Text style={{ color: isQueued ? colors.textFaint : colors.textPrimary, fontWeight: "bold" }}>
                  {exercise.name}
                </Text>
                {isQueued ? (
                  <Text style={{ color: colors.textFaint, fontSize: 12, letterSpacing: 1, marginTop: 4 }}>
                    {`QUEUED · ${totalSets} SET${totalSets === 1 ? "" : "S"}`}
                  </Text>
                ) : isFullyCompleted ? (
                  <Text style={{ color: colors.accent, fontSize: 12, letterSpacing: 1, marginTop: 4 }}>
                    {`COMPLETED · ${completedSets}/${totalSets} SET${totalSets === 1 ? "" : "S"}`}
                  </Text>
                ) : (
                  <Text style={{ color: colors.textFaint, fontSize: 12, letterSpacing: 1, marginTop: 4 }}>
                    {`IN PROGRESS · ${completedSets}/${totalSets} SET${totalSets === 1 ? "" : "S"}`}
                  </Text>
                )}
              </Pressable>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {isFullyCompleted ? (
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: colors.accent,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: colors.on, fontSize: 14 }}>✓</Text>
                  </View>
                ) : (
                  <Text style={{ color: colors.textFaint, fontSize: 20 }}>›</Text>
                )}

                <Pressable onPress={() => confirmRemoveExercise(exercise)} hitSlop={8}>
                  <Text style={{ color: colors.textFaint, fontSize: 16 }}>🗑</Text>
                </Pressable>
              </View>
            </View>
          );
        }

        return (
          <View
            key={exercise.id}
            style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 12 }}
          >
            <Pressable
              onPress={() => toggleExerciseExpanded(exercise.id)}
              style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "bold", flex: 1, marginRight: 8 }}>
                {exercise.name}
              </Text>

              <View style={{ backgroundColor: colors.tealSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: colors.teal, fontWeight: "bold" }}>
                  {currentOrCompletedSetNumber}/{totalRows}
                </Text>
              </View>
            </Pressable>

            {history && history.previous_sets.length > 0 && (
              <Text style={{ color: colors.textFaint, fontSize: 12, letterSpacing: 1, marginTop: 4 }}>
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
                    style={{ flexDirection: "row", alignItems: "center", marginTop: 8, opacity: 0.5 }}
                  >
                    <Text style={{ color: colors.textFaint, width: 24 }}>{String(index + 1).padStart(2, "0")}</Text>
                    <Text style={{ color: colors.textFaint }}>
                      {plannedWeight ?? "-"} lb × {plannedReps ?? "-"}
                    </Text>
                  </View>
                );
              }

              const isLogged = isSetLogged(set);

              if (isLogged) {
                return (
                  <View key={set.id} style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                    <Text style={{ color: colors.textDim, width: 24 }}>{String(index + 1).padStart(2, "0")}</Text>
                    <Text style={{ color: colors.textPrimary, flex: 1 }}>
                      {set.weight} lb × {set.reps}
                    </Text>
                    <Pressable
                      onPress={() => {
                        updateSet(exercise.id, set.id, { completed: false });
                        syncSet(exercise, { ...set, completed: false });
                      }}
                      style={{ ...SET_CIRCLE_BASE, backgroundColor: colors.accent }}
                    >
                      <Text style={{ color: colors.on }}>✓</Text>
                    </Pressable>
                  </View>
                );
              }

              return (
                <View key={set.id} style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                  <Text style={{ color: colors.textDim, width: 24 }}>{String(index + 1).padStart(2, "0")}</Text>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: colors.bgInset,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      marginRight: 8,
                      borderWidth: 1,
                      borderColor: colors.accent,
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
                      placeholderTextColor={colors.textFaint}
                      style={{ color: colors.textPrimary, width: 40 }}
                      keyboardType="decimal-pad"
                    />
                    <Text style={{ color: colors.textFaint, marginLeft: 4 }}>lb</Text>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: colors.bgInset,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      marginRight: 8,
                      borderWidth: 1,
                      borderColor: colors.accent,
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
                      placeholderTextColor={colors.textFaint}
                      style={{ color: colors.textPrimary, width: 40 }}
                      keyboardType="number-pad"
                    />
                    <Text style={{ color: colors.textFaint, marginLeft: 4 }}>rp</Text>
                  </View>

                  <Pressable
                    onPress={() => {
                      if (set.weight > 0 && set.reps > 0) {
                        updateSet(exercise.id, set.id, { completed: true });
                        syncSet(exercise, { ...set, completed: true });
                      }
                    }}
                    style={{
                      ...SET_CIRCLE_BASE,
                      backgroundColor: "transparent",
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  />
                </View>
              );
            })}

            <View style={{ flexDirection: "row", marginTop: 12, justifyContent: "space-between" }}>
              <Pressable onPress={() => addSet(exercise.id)} style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>+ SET</Text>
              </Pressable>

              <Pressable
                onPress={() => toggleExerciseExpanded(exercise.id)}
                style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}
              >
                <Text style={{ color: colors.teal, fontWeight: "600" }}>Done</Text>
              </Pressable>

              <Pressable onPress={() => openNoteEditor(exercise)} style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}>
                <Text
                  style={{
                    color: notesByExercise[exercise.id] ? colors.teal : colors.textPrimary,
                    fontWeight: "600",
                  }}
                >
                  NOTE
                </Text>
              </Pressable>
            </View>

            {openNoteFor === exercise.id && (
              <View style={{ marginTop: 8 }}>
                <TextInput
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  placeholder="Add a note..."
                  style={{
                    color: colors.textPrimary,
                    backgroundColor: colors.bgInset,
                    borderRadius: 8,
                    padding: 10,
                  }}
                />
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <Pressable
                    onPress={() => saveNote(exercise)}
                    style={{ flex: 1, backgroundColor: colors.teal, borderRadius: 8, padding: 8, alignItems: "center" }}
                  >
                    <Text style={{ color: colors.on }}>Save</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setOpenNoteFor(null)}
                    style={{ flex: 1, backgroundColor: colors.bgInset, borderRadius: 8, padding: 8, alignItems: "center" }}
                  >
                    <Text style={{ color: colors.textPrimary }}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        );
      })}

      {isPickerOpen && (
        <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <Text style={{ color: colors.textDim, fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>FAVORITES</Text>

          {favorites.length === 0 && <Text style={{ color: colors.textFaint, marginBottom: 8 }}>No favorites yet</Text>}

          {MUSCLE_GROUPS.map((group) => {
            const groupFavorites = favorites.filter((f) => f.muscle_group === group);
            if (groupFavorites.length === 0) return null;
            const isGroupExpanded = !!expandedGroups[group];

            return (
              <View key={group} style={{ marginBottom: 8 }}>
                <Pressable onPress={() => toggleGroupExpanded(group)}>
                  <Text style={{ color: colors.textDim, fontSize: 12, letterSpacing: 1 }}>
                    {isGroupExpanded ? "▾" : "▸"} {group.toUpperCase()}
                  </Text>
                </Pressable>

                {isGroupExpanded &&
                  groupFavorites.map((fav) => (
                    <View
                      key={fav.id}
                      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}
                    >
                      <Pressable onPress={() => selectExercise(fav)} style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary }}>{fav.name}</Text>
                      </Pressable>
                      <Pressable onPress={() => toggleFavorite(fav, true)}>
                        <Text style={{ color: colors.teal }}>★</Text>
                      </Pressable>
                    </View>
                  ))}
              </View>
            );
          })}




          <Text style={{ color: colors.textDim, fontSize: 12, letterSpacing: 1, marginTop: 12, marginBottom: 8 }}>
            SEARCH
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {MUSCLE_GROUPS.map((group) => (
              <Pressable
                key={group}
                onPress={() => toggleMuscleGroupFilter(group)}
                style={{
                  backgroundColor: activeMuscleGroup === group ? colors.teal : colors.bgInset,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: activeMuscleGroup === group ? colors.on : colors.textPrimary }}>
                  {group.charAt(0).toUpperCase() + group.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              searchExercises(text, activeMuscleGroup);
            }}
            placeholder="Search exercises..."
            style={{
              color: colors.textPrimary,
              backgroundColor: colors.bgInset,
              borderRadius: 8,
              padding: 10,
              marginBottom: 8,
            }}
          />

          {searchResults.map((result) => (
            <View
              key={result.id}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}
            >
              <Pressable onPress={() => selectExercise(result)} style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary }}>
                  {result.name} ({result.muscle_group})
                </Text>
              </Pressable>
              <Pressable onPress={() => toggleFavorite(result, false)}>
                <Text style={{ color: colors.textFaint }}>☆</Text>
              </Pressable>
            </View>
          ))}

          <Pressable
            onPress={() => {
              setIsPickerOpen(false);
              setSearchQuery("");
              setSearchResults([]);
              setActiveMuscleGroup(null);
            }}
            style={{ marginTop: 8 }}
          >
            <Text style={{ color: colors.textFaint }}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {!isPickerOpen && (
        <Pressable
          onPress={() => {
            setIsPickerOpen(true);
            fetchFavorites();
          }}
          style={{
            borderWidth: 1,
            borderColor: colors.teal,
            borderStyle: "dashed",
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text style={{ color: colors.textPrimary }}>+ ADD EXERCISE</Text>
        </Pressable>
      )}

      {!hasStarted && (
        <Pressable
          onPress={startSession}
          style={{ backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: "center" }}
        >
          <Text style={{ color: colors.on }}>Start Session</Text>
        </Pressable>
      )}

      {hasStarted && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => setIsRunning(!isRunning)}
            style={{ flex: 1, backgroundColor: colors.bgInset, borderRadius: 12, padding: 16, alignItems: "center" }}
          >
            <Text style={{ color: colors.textPrimary }}>{isRunning ? "Pause" : "Resume"}</Text>
          </Pressable>

          <Pressable
            onPress={() => setConfirmFinish(true)}
            style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: "center" }}
          >
            <Text style={{ color: colors.on }}>Finish Workout</Text>
          </Pressable>

          <Pressable
            onPress={resetWorkout}
            style={{ flex: 1, backgroundColor: colors.bgInset, borderRadius: 12, padding: 16, alignItems: "center" }}
          >
            <Text style={{ color: colors.textPrimary }}>Reset Workout</Text>
          </Pressable>
        </View>
      )}

<Pressable
  onPress={() => setIsPastWorkoutsOpen(true)}
  style={{
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  }}
>
  <Text style={{ color: colors.textDim, fontSize: 12, letterSpacing: 1 }}>
    PAST WORKOUTS {pastWorkouts.length > 0 ? `(${pastWorkouts.length})` : ""}
  </Text>
  <Text style={{ color: colors.textFaint, fontSize: 16 }}>›</Text>
</Pressable>

{isPastWorkoutsOpen && (
  <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 12 }}>
    {pastWorkouts.length === 0 ? (
      <Text style={{ color: colors.textFaint }}>No past workouts yet</Text>
    ) : (
      pastWorkouts.map((workout) => (
        <View
          key={workout.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 8,
          }}
        >
          <View>
            <Text style={{ color: colors.textPrimary }}>{formatWorkoutDate(workout.started_at)}</Text>
            <Text style={{ color: colors.textFaint, fontSize: 12 }}>
              {workout.ended_at ? "Finished" : "Not finished"}
            </Text>
          </View>
          <Pressable onPress={() => setPendingWorkoutDeletion(workout.id)} hitSlop={8}>
            <Text style={{ color: colors.textFaint, fontSize: 16 }}>🗑</Text>
          </Pressable>
        </View>
      ))
    )}
  </View>
)}


      {pendingRemoval && (
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
          <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 20, width: "100%", maxWidth: 340 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 18, marginBottom: 8 }}>
              Remove exercise?
            </Text>
            <Text style={{ color: colors.textDim, marginBottom: 20 }}>
              This removes "{pendingRemoval.name}" and its logged sets from this session.
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setPendingRemoval(null)}
                style={{ flex: 1, backgroundColor: colors.bgInset, borderRadius: 8, padding: 12, alignItems: "center" }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  removeExercise(pendingRemoval.id);
                  setPendingRemoval(null);
                }}
                style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 8, padding: 12, alignItems: "center" }}
              >
                <Text style={{ color: colors.on, fontWeight: "600" }}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

  {confirmFinish && (
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
    <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 20, width: "100%", maxWidth: 340 }}>
      <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 18, marginBottom: 8 }}>
        Finish this workout?
      </Text>
      <Text style={{ color: colors.textDim, marginBottom: 20 }}>
        This marks the session as complete and stops the timer.
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => setConfirmFinish(false)}
          style={{ flex: 1, backgroundColor: colors.bgInset, borderRadius: 8, padding: 12, alignItems: "center" }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={finishWorkout}
          style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 8, padding: 12, alignItems: "center" }}
        >
          <Text style={{ color: colors.on, fontWeight: "600" }}>Finish</Text>
        </Pressable>
      </View>
    </View>
  </View>
)}

{isPastWorkoutsOpen && (
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
    <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 20, width: "100%", maxWidth: 340, maxHeight: "70%" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 18 }}>Past Workouts</Text>
        <Pressable onPress={() => setIsPastWorkoutsOpen(false)}>
          <Text style={{ color: colors.textFaint, fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>

      {pastWorkouts.length === 0 ? (
        <Text style={{ color: colors.textFaint }}>No past workouts yet</Text>
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
              <Text style={{ color: colors.textPrimary }}>{formatWorkoutDate(workout.started_at)}</Text>
              <Text style={{ color: colors.textFaint, fontSize: 12 }}>
                {workout.ended_at ? "Finished" : "Not finished"}
              </Text>
            </View>
            <Pressable onPress={() => setPendingWorkoutDeletion(workout.id)} hitSlop={8}>
              <Text style={{ color: colors.textFaint, fontSize: 16 }}>🗑</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  </View>
)}
  {pendingWorkoutDeletion !== null && (
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
    <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 20, width: "100%", maxWidth: 340 }}>
      <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 18, marginBottom: 8 }}>
        Delete this workout?
      </Text>
      <Text style={{ color: colors.textDim, marginBottom: 20 }}>
        This permanently deletes the whole session and every set logged in it.
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => setPendingWorkoutDeletion(null)}
          style={{ flex: 1, backgroundColor: colors.bgInset, borderRadius: 8, padding: 12, alignItems: "center" }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => deletePastWorkout(pendingWorkoutDeletion)}
          style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 8, padding: 12, alignItems: "center" }}
        >
          <Text style={{ color: colors.on, fontWeight: "600" }}>Delete</Text>
        </Pressable>
      </View>
    </View>
  </View>
)}
    </View>
    
  );
}