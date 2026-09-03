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

  // The screen previously never talked to POST /workouts at all - `exercises`
  // was purely local state with no real backend session behind it. The new
  // per-exercise NOTE feature needs a real workout_id to PUT against, so a
  // session is now actually created on the backend when the user presses
  // Start Session, and its id is kept here.
  const [workoutId, setWorkoutId] = useState<number | null>(null);

  // Prior-session data per exercise, keyed by the exercise's local id (not
  // the backend exercise_id), fetched once when the exercise is added.
  const [historyByExercise, setHistoryByExercise] = useState<Record<string, ExerciseHistory>>({});

  // Per-exercise note text, keyed by local exercise id. Populated
  // optimistically right after a successful save rather than re-fetched
  // from GET /workouts/{id} - within a single continuous session (this
  // screen has no "resume a prior session" flow) that GET would always
  // come back empty immediately after the session starts anyway, so local
  // state already reflects exactly what the backend has.
  const [notesByExercise, setNotesByExercise] = useState<Record<string, string>>({});
  const [openNoteFor, setOpenNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  // Session stats (total volume, set count, best e1RM) are entirely
  // derivable from `exercises` - they're not new information, just a
  // recalculation of data already in state. useMemo (not useState) is
  // the right tool here: it recomputes automatically whenever `exercises`
  // changes and is skipped on renders where it hasn't, with no risk of
  // this "second copy" of the data drifting out of sync the way a
  // separately-managed useState value could if we forgot to update it
  // after every addSet/updateSet/removeSet call.
  const stats = useMemo(() => {
    const allSets = exercises.flatMap((exercise) => exercise.sets);

    const volume = allSets.reduce((sum, set) => sum + (set.weight || 0) * (set.reps || 0), 0);

    // Denominator is planned sets across the whole workout - each
    // exercise padded out to its planned row count, the same number the
    // exercise badge uses - not just the rows created so far. That's what
    // the design's "11/14" represents. The numerator counts only genuinely
    // logged sets (see isSetLogged), so it can't outrun what's on screen.
    const plannedSets = exercises.reduce((total, exercise) => {
      const exerciseHistory = historyByExercise[exercise.id];
      return total + Math.max(exercise.sets.length, exerciseHistory?.previous_sets.length || 3);
    }, 0);

    const completedSets = allSets.filter(isSetLogged).length;

    // An unfilled set (weight or reps still 0/undefined) shouldn't count
    // toward the best e1RM - it's not a real lift yet.
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
    // Text fields start empty (not "0") so an untouched set renders as a
    // blank input with a "0" placeholder rather than looking like a real
    // entered value. The numeric weight/reps stay 0 for the stats math.
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
      await fetch(
        `${API_URL}/workouts/${workoutId}/exercises/${exercise.exerciseId}/note`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ note: noteDraft }),
        }
      );
    }
    setNotesByExercise((prev) => ({ ...prev, [exercise.id]: noteDraft }));
    setOpenNoteFor(null);
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
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginRight: 8 }}
        />
        <Text style={{ color: colors.accent, fontSize: 12, letterSpacing: 1 }}>
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
          <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "bold" }}>
            {stats.volume}
          </Text>
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
        // Row count includes not-yet-created "planned" slots, padded to the
        // prior session's set count (or 3 if there's no history yet) - this
        // is also the badge's denominator, and the numerator is whichever
        // set the user is currently on (completedSets + 1), capped at that
        // total once every set is done.
        const totalRows = Math.max(exercise.sets.length, history?.previous_sets.length || 3);
        const currentOrCompletedSetNumber = Math.min(completedSets, totalRows);

        if (isCollapsed) {
          return (
            <View
              key={exercise.id}
              style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 12 }}
            >
              <Pressable
                onPress={() => toggleExerciseExpanded(exercise.id)}
                style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}
              >
                <View style={{ flex: 1 }}>
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
                </View>

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
              </Pressable>
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

              <View
                style={{
                  backgroundColor: colors.soft,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: colors.accent, fontWeight: "bold" }}>
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
                // This session's own most recent real reps value (from
                // the last logged or currently-active set) drives the
                // preview - today's actual working reps, not last
                // session's - and only falls back to history's last
                // known rep count if nothing has been logged/entered
                // in this session at all.
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
                    <Text style={{ color: colors.textFaint, width: 24 }}>
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                    <Text style={{ color: colors.textFaint }}>
                      {plannedWeight ?? "-"} lb × {plannedReps ?? "-"}
                    </Text>
                  </View>
                );
              }

              // A set only counts as "logged" once it actually has real
              // weight and reps - completed:true on a still-zeroed set
              // (e.g. tapped complete before typing anything) must not
              // render as a "0 lb × 0 rp" checked-off row.
              const isLogged = isSetLogged(set);

              if (isLogged) {
                return (
                  <View key={set.id} style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                    <Text style={{ color: colors.textDim, width: 24 }}>
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                    <Text style={{ color: colors.textPrimary, flex: 1 }}>
                      {set.weight} lb × {set.reps}
                    </Text>
                    <Pressable
                      onPress={() => updateSet(exercise.id, set.id, { completed: false })}
                      style={{
                        ...SET_CIRCLE_BASE,
                        backgroundColor: colors.accent,
                      }}
                    >
                      <Text style={{ color: colors.on }}>✓</Text>
                    </Pressable>
                  </View>
                );
              }

              return (
                <View key={set.id} style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                  <Text style={{ color: colors.textDim, width: 24 }}>
                    {String(index + 1).padStart(2, "0")}
                  </Text>

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
                      // Only a set with real values can be checked off -
                      // otherwise completed:true would sit in state while
                      // the row still renders unchecked, which is exactly
                      // what made the badge and SETS stat over-count.
                      if (set.weight > 0 && set.reps > 0) {
                        updateSet(exercise.id, set.id, { completed: true });
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
              <Pressable onPress={() => addSet(exercise.id)} style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ color: colors.textPrimary }}>+ SET</Text>
              </Pressable>

              <Pressable
                onPress={() => openNoteEditor(exercise)}
                style={{ flex: 1, alignItems: "center", justifyContent: "space-between" }}
              >
                <Text style={{ color: notesByExercise[exercise.id] ? colors.accent : colors.textPrimary }}>
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
                    style={{
                      flex: 1,
                      backgroundColor: colors.accent,
                      borderRadius: 8,
                      padding: 8,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: colors.on }}>Save</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setOpenNoteFor(null)}
                    style={{
                      flex: 1,
                      backgroundColor: colors.bgInset,
                      borderRadius: 8,
                      padding: 8,
                      alignItems: "center",
                    }}
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
          <Text style={{ color: colors.textDim, fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>
            FAVORITES
          </Text>

          {favorites.length === 0 && (
            <Text style={{ color: colors.textFaint, marginBottom: 8 }}>No favorites yet</Text>
          )}

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
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 4,
                      }}
                    >
                      <Pressable onPress={() => selectExercise(fav)} style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary }}>{fav.name}</Text>
                      </Pressable>
                      <Pressable onPress={() => toggleFavorite(fav, true)}>
                        <Text style={{ color: colors.accent }}>★</Text>
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
                  backgroundColor: activeMuscleGroup === group ? colors.accent : colors.bgInset,
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
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 8,
              }}
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
            borderColor: colors.accent,
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
            onPress={() => {
              setIsRunning(false);
              console.log("finish session");
            }}
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
    </View>
  );
}