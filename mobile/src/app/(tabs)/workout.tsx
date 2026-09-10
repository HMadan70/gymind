import { View, Text, Pressable, TextInput, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../constants/theme";
import { useState, useEffect, useCallback, useMemo } from "react";
import { API_URL } from "../../constants/api";
import { ConfirmModal } from "../../components/ConfirmModal";
import { Card } from "../../components/Card";
import { StatCard } from "../../components/StatCard";
import { ExerciseCardCollapsed } from "../../components/ExerciseCardCollapsed";
import { PlannedSetRow } from "../../components/PlannedSetRow";
import { LoggedSetRow } from "../../components/LoggedSetRow";
import { EditableSetRow } from "../../components/EditableSetRow";
import { Button } from "../../components/Button";
import { authFetch } from "../../lib/session";
import { useAsyncGuard, useAsyncGuardMap } from "../../lib/asyncGuard";
import { useDebouncedValue } from "../../lib/useDebounce";

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

// Mirrors EDIT_WINDOW_DAYS in backend/app/routes/workout_routes.py. The
// server is the authority — it returns 409 past this window — so this is
// only here to hide an affordance that would fail anyway.
const EDIT_WINDOW_DAYS = 7;

const isWithinEditWindow = (endedAt: string | null) => {
  // An unfinished session is still live, so it stays editable.
  if (!endedAt) return true;
  const ended = new Date(endedAt).getTime();
  if (Number.isNaN(ended)) return false;
  return Date.now() - ended <= EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
};

type EditableWorkoutSet = {
  id: number;
  setNumber: number;
  exerciseName: string;
  weightText: string;
  repsText: string;
};

type WorkoutDetailSet = {
  id: number;
  set_number: number;
  weight: number | null;
  reps: number | null;
  exercise?: { name?: string } | null;
};

let localEntrySequence = 0;
const createLocalEntryId = () => String(++localEntrySequence);

const formatWorkoutDate = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
 };

export default function Workout() {
  const { colors, shapes } = useTheme();
  const insets = useSafeAreaInsets();
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
  // Generic label: there's no workout plan/template model in the backend
  // yet, so there's no real name to read. Was a useState with no setter,
  // i.e. a constant in disguise.
  const workoutTitle = "Today's Workout";
  const [pendingRemoval, setPendingRemoval] = useState<ExerciseEntry | null>(null);

  const [workoutId, setWorkoutId] = useState<number | null>(null);
  const [historyByExercise, setHistoryByExercise] = useState<Record<string, ExerciseHistory>>({});
  const [notesByExercise, setNotesByExercise] = useState<Record<string, string>>({});
  const [openNoteFor, setOpenNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [pastWorkouts, setPastWorkouts] = useState<{ id: number; started_at: string; ended_at: string | null }[]>([]);
  const [loadError, setLoadError] = useState("");
  const [isPastWorkoutsOpen, setIsPastWorkoutsOpen] = useState(false);
  const [pendingWorkoutDeletion, setPendingWorkoutDeletion] = useState<number | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState<number | null>(null);
  const [editingSets, setEditingSets] = useState<EditableWorkoutSet[]>([]);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Duplicate-submission guards - see src/lib/asyncGuard.ts. One per
  // distinct action; the *Map variants are keyed per-row so completing one
  // set or favouriting one exercise never blocks a different one.
  const startSessionGuard = useAsyncGuard();
  const finishWorkoutGuard = useAsyncGuard();
  const deleteWorkoutGuard = useAsyncGuard();
  const saveEditGuard = useAsyncGuard();
  const saveNoteGuard = useAsyncGuard();
  const favoriteGuard = useAsyncGuardMap<number>();
  const setSyncGuard = useAsyncGuardMap<string>();

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
    const newExercise: ExerciseEntry = { id: createLocalEntryId(), name, sets: [], exerciseId };
    setExercises([...exercises, newExercise]);
    return newExercise.id;
  };

  const addSet = (exerciseId: string) => {
    const newSet: SetEntry = {
      id: createLocalEntryId(),
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

  const searchExercises = useCallback(async (query: string, muscleGroup: string | null) => {
    if (query.length === 0 && !muscleGroup) {
      setSearchResults([]);
      return;
    }
    const response = await authFetch(
      `${API_URL}/exercises?search=${query}${muscleGroup ? `&muscle_group=${muscleGroup}` : ""}`,
    );
    const data = await response.json();
    setSearchResults(data);
  }, []);

  // Debounced so typing "chick" fires one request instead of five - the
  // effect below reacts to the settled value, not every keystroke.
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 400);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void searchExercises(debouncedSearchQuery, activeMuscleGroup);
  }, [debouncedSearchQuery, activeMuscleGroup, searchExercises]);

  const fetchFavorites = async () => {
    try {
      const response = await authFetch(`${API_URL}/exercises?favorites_only=true`);
      if (!response.ok) throw new Error("load failed");
      setFavorites(await response.json());
    } catch {
      // Non-critical: the exercise picker's search still works without
      // favourites, so this fails silently rather than blocking the sheet.
    }
  };

  const fetchPastWorkouts = async () => {
    try {
      const response = await authFetch(`${API_URL}/workouts`);
      if (!response.ok) throw new Error("load failed");
      setPastWorkouts(await response.json());
      setLoadError("");
    } catch {
      setLoadError("Couldn't load your workout history.");
    }
  };

 const deletePastWorkout = async (id: number) => {
    await deleteWorkoutGuard.run(async () => {
      await authFetch(`${API_URL}/workouts/${id}`, {
        method: "DELETE",
      });
      setPastWorkouts((prev) => prev.filter((w) => w.id !== id));
      setPendingWorkoutDeletion(null);
    });
  };

  const openWorkoutEditor = async (workoutId: number) => {
    setEditingWorkoutId(workoutId);
    setEditingSets([]);
    setEditError("");
    setIsLoadingEdit(true);
    try {
      const response = await authFetch(`${API_URL}/workouts/${workoutId}`);
      if (!response.ok) throw new Error("load failed");
      const data = await response.json();
      const sets: EditableWorkoutSet[] = (data.sets ?? [])
        .map((s: WorkoutDetailSet) => ({
          id: s.id,
          setNumber: s.set_number,
          exerciseName: s.exercise?.name ?? "Exercise",
          weightText: s.weight === null || s.weight === undefined ? "" : String(s.weight),
          repsText: s.reps === null || s.reps === undefined ? "" : String(s.reps),
        }))
        .sort(
          (a: EditableWorkoutSet, b: EditableWorkoutSet) =>
            a.exerciseName.localeCompare(b.exerciseName) || a.setNumber - b.setNumber
        );
      setEditingSets(sets);
    } catch {
      setEditError("Could not load this workout.");
    } finally {
      setIsLoadingEdit(false);
    }
  };

  const closeWorkoutEditor = () => {
    setEditingWorkoutId(null);
    setEditingSets([]);
    setEditError("");
  };

  const updateEditingSet = (setId: number, updates: Partial<EditableWorkoutSet>) => {
    setEditingSets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, ...updates } : s))
    );
  };

  const saveWorkoutEdits = async () => {
    if (editingWorkoutId === null) return;
    await saveEditGuard.run(async () => {
      setEditError("");
      try {
        for (const set of editingSets) {
          const weight = Number(set.weightText);
          const reps = Number(set.repsText);
          // Skip rows the user left blank/invalid rather than writing a 0
          // over a real logged value.
          if (!set.weightText || !set.repsText || Number.isNaN(weight) || Number.isNaN(reps)) {
            continue;
          }
          const response = await authFetch(
            `${API_URL}/workouts/${editingWorkoutId}/sets/${set.id}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ weight, reps }),
            }
          );
          if (!response.ok) {
            // 409 = outside the server's edit window; surface its message.
            const detail = await response.json().catch(() => null);
            throw new Error(detail?.detail || "save failed");
          }
        }
        closeWorkoutEditor();
      } catch (error) {
        setEditError(error instanceof Error ? error.message : "Could not save changes.");
      }
    });
  };

  const toggleFavorite = async (option: ExerciseOption, isFavorited: boolean) => {
    await favoriteGuard.run(option.id, async () => {
      await authFetch(`${API_URL}/exercises/${option.id}/favorite`, {
        method: isFavorited ? "DELETE" : "POST",
      });
      fetchFavorites();
    });
  };

  const toggleMuscleGroupFilter = (group: string) => {
    const next = activeMuscleGroup === group ? null : group;
    setActiveMuscleGroup(next);
  };

  const fetchExerciseHistory = async (localExerciseId: string, realExerciseId: number) => {
    const response = await authFetch(`${API_URL}/exercises/${realExerciseId}/history`);
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
    await startSessionGuard.run(async () => {
      setIsRunning(true);
      setHasStarted(true);
      const response = await authFetch(`${API_URL}/workouts`, {
        method: "POST",
      });
      const data = await response.json();
      setWorkoutId(data.id);
    });
  };

  const openNoteEditor = (exercise: ExerciseEntry) => {
    setOpenNoteFor(exercise.id);
    setNoteDraft(notesByExercise[exercise.id] || "");
  };

  const saveNote = async (exercise: ExerciseEntry) => {
    await saveNoteGuard.run(async () => {
      if (workoutId !== null && exercise.exerciseId !== undefined) {
        await authFetch(`${API_URL}/workouts/${workoutId}/exercises/${exercise.exerciseId}/note`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ note: noteDraft }),
        });
      }
      setNotesByExercise((prev) => ({ ...prev, [exercise.id]: noteDraft }));
      setOpenNoteFor(null);
    });
  };

  const finishWorkout = async () => {
    await finishWorkoutGuard.run(async () => {
      setIsRunning(false);
      if (workoutId === null) return;
      await authFetch(`${API_URL}/workouts/${workoutId}`, {
        method: "PUT",
      });
      setConfirmFinish(false);
      fetchPastWorkouts();
    });
  };

  const syncSet = async (exercise: ExerciseEntry, set: SetEntry) => {
    if (workoutId === null || exercise.exerciseId === undefined) return;
    await setSyncGuard.run(set.id, async () => {
      try {
        const response = await authFetch(`${API_URL}/workouts/${workoutId}/sets`, {
          method: "POST",
          headers: {
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
    });
  };

  // Converts a history-derived "planned" row (rendered when an exercise
  // has fewer real sets than its previous session did - see totalRows
  // below) into a real, completed SetEntry pre-filled with exactly the
  // weight/reps already shown on that row. Without this, those rows were
  // PlannedSetRow - a plain View with no touch handler at all - so
  // tapping them did nothing and the only way to log a set on a
  // freshly-added exercise was "+ SET" followed by typing in numbers.
  //
  // Guarded on a stable `exercise.id`+`index` key rather than the new
  // set's id, which doesn't exist until this runs - a fast double-tap on
  // the same row, before React re-renders it as a real (non-planned)
  // set, would otherwise call this twice and create two sets. See
  // src/lib/asyncGuard.ts's module comment on why a ref-backed guard,
  // not just a `disabled` prop, is required for that race. syncSet above
  // applies its own guard too, keyed by the new set's id once it exists -
  // the two keys never collide, so nesting them here is safe.
  const completePlannedSet = async (exercise: ExerciseEntry, index: number, weight: number, reps: number) => {
    await setSyncGuard.run(`planned-${exercise.id}-${index}`, async () => {
      const newSet: SetEntry = {
        id: createLocalEntryId(),
        weight,
        weightText: String(weight),
        reps,
        repsText: String(reps),
        completed: true,
      };
      const updatedSets = [...exercise.sets, newSet];
      setExercises(exercises.map((ex) => (ex.id === exercise.id ? { ...ex, sets: updatedSets } : ex)));
      // Pass the locally-built exercise (with newSet already appended)
      // rather than the stale `exercise` closure - syncSet computes
      // set_number via exercise.sets.indexOf(set), which needs the set
      // to actually be in that array.
      await syncSet({ ...exercise, sets: updatedSets }, newSet);
    });
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
    // Initial synchronization with the server is the purpose of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPastWorkouts();
  }, []);

  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.bgBase, colors.bgBase, colors.gradientBottom]}
      locations={[0, 0.3, 0.7, 1]}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 32, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
      <Card
        shape="hero"
        style={{
          padding: 20,
          marginBottom: 14,
          marginTop: 16,
          borderWidth: 1,
          borderColor: colors.border,
          position: "relative",
        }}
      >
        {/* Diamond corner mark — the recurring accent motif on hero cards */}
        <View
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 12,
            height: 12,
            backgroundColor: colors.gold,
            transform: [{ rotate: "45deg" }],
          }}
        />

        <View style={{ flexDirection: "row", justifyContent: "flex-start", alignItems: "center" }}>
          <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: colors.teal, marginRight: 8 }} />
          <Text style={{ color: colors.textDim, fontSize: 12, fontFamily: fonts.bodyExtra, letterSpacing: 0.72 }}>
            {isRunning ? "SESSION LIVE" : elapsedSeconds > 0 ? "SESSION PAUSED" : "NOT STARTED"}
          </Text>
        </View>

        {/* Spacing lives on the row, not duplicated on each child: the
            status line above and this title/timer row are two separate
            blocks, so they get the 14 this screen uses between blocks. */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: 14,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 24, fontFamily: fonts.heading }}>
            {workoutTitle}
          </Text>
          <Text style={{ color: colors.textPrimary, fontSize: 40, fontFamily: fonts.heading, letterSpacing: 0.8 }}>
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </Text>
        </View>
      </Card>

    <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
      <StatCard label="VOLUME" value={stats.volume} />
      <StatCard label="SETS" value={`${stats.completedSets}/${stats.plannedSets}`} />
      <StatCard label="BEST E1RM" value={Math.round(stats.e1rm)} />
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
    <ExerciseCardCollapsed
      key={exercise.id}
      name={exercise.name}
      isQueued={isQueued}
      isFullyCompleted={isFullyCompleted}
      totalSets={totalSets}
      completedSets={completedSets}
      onToggleExpand={() => toggleExerciseExpanded(exercise.id)}
      onRemove={() => confirmRemoveExercise(exercise)}
    />
  );
}
        return (
          <Card
            key={exercise.id}
            shape="secondary"
            style={{ padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border }}
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
                // Only offer one-tap logging when both numbers are real -
                // there's nothing valid to log from "- lb × -".
                const canLogPlanned = (plannedWeight ?? 0) > 0 && (plannedReps ?? 0) > 0;
                return (
                  <PlannedSetRow
                    key={`planned-${index}`}
                    index={index}
                    plannedWeight={plannedWeight ?? undefined}
                    plannedReps={plannedReps ?? undefined}
                    disabled={setSyncGuard.isPending(`planned-${exercise.id}-${index}`)}
                    onComplete={
                      canLogPlanned
                        ? () => completePlannedSet(exercise, index, plannedWeight as number, plannedReps as number)
                        : undefined
                    }
                  />
                );
              }

              const isLogged = isSetLogged(set);

              if (isLogged) {
                return (
                  <LoggedSetRow
                    key={set.id}
                    index={index}
                    weight={set.weight}
                    reps={set.reps}
                    disabled={setSyncGuard.isPending(set.id)}
                    onUncomplete={() => {
                      updateSet(exercise.id, set.id, { completed: false });
                      syncSet(exercise, { ...set, completed: false });
                    }}
                  />
                );
              }

              return (
                <EditableSetRow
                  key={set.id}
                  index={index}
                  weightText={set.weightText ?? ""}
                  repsText={set.repsText ?? ""}
                  onChangeWeightText={(text) => {
                    if (!/^\d*\.?\d*$/.test(text)) return;
                    const updates: Partial<SetEntry> = { weightText: text };
                    if (text === "") {
                      updates.weight = 0;
                    } else if (!text.endsWith(".")) {
                      updates.weight = Number(text);
                    }
                    updateSet(exercise.id, set.id, updates);
                  }}
                  onChangeRepsText={(text) => {
                    if (!/^\d*$/.test(text)) return;
                    updateSet(exercise.id, set.id, {
                      repsText: text,
                      reps: text === "" ? 0 : Number(text),
                    });
                  }}
                  canComplete={set.weight > 0 && set.reps > 0}
                  disabled={setSyncGuard.isPending(set.id)}
                  onComplete={() => {
                    updateSet(exercise.id, set.id, { completed: true });
                    syncSet(exercise, { ...set, completed: true });
                  }}
                />
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
                    disabled={saveNoteGuard.pending}
                    style={{
                      flex: 1,
                      backgroundColor: colors.teal,
                      borderRadius: 8,
                      padding: 8,
                      alignItems: "center",
                      opacity: saveNoteGuard.pending ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: colors.tealOn, fontWeight: "700" }}>
                      {saveNoteGuard.pending ? "Saving…" : "Save"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setOpenNoteFor(null)}
                    disabled={saveNoteGuard.pending}
                    style={{
                      flex: 1,
                      backgroundColor: colors.bgInset,
                      borderRadius: 8,
                      padding: 8,
                      alignItems: "center",
                      opacity: saveNoteGuard.pending ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary }}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Card>
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
                      <Pressable
                        onPress={() => toggleFavorite(fav, true)}
                        disabled={favoriteGuard.isPending(fav.id)}
                        style={{ opacity: favoriteGuard.isPending(fav.id) ? 0.5 : 1 }}
                      >
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
                <Text style={{ color: activeMuscleGroup === group ? colors.tealOn : colors.textPrimary }}>
                  {group.charAt(0).toUpperCase() + group.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
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
              <Pressable
                onPress={() => toggleFavorite(result, false)}
                disabled={favoriteGuard.isPending(result.id)}
                style={{ opacity: favoriteGuard.isPending(result.id) ? 0.5 : 1 }}
              >
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
            borderWidth: 1.5,
            borderColor: colors.border,
            borderStyle: "dashed",
            padding: 16,
            ...shapes.secondaryCard,
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <Text style={{ color: colors.textDim, fontFamily: fonts.bodyBold, fontSize: 13 }}>+ Add exercise</Text>
        </Pressable>
      )}

      {!hasStarted && (
        <Button
          label={startSessionGuard.pending ? "Starting…" : "Start Session"}
          onPress={startSession}
          variant="primary"
          size="lg"
          disabled={startSessionGuard.pending}
        />
      )}

      {hasStarted && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            label={isRunning ? "Pause" : "Resume"}
            onPress={() => setIsRunning(!isRunning)}
            variant="secondary"
            size="lg"
            flex
          />

          <Button
            label="Finish Workout"
            onPress={() => setConfirmFinish(true)}
            variant="primary"
            size="lg"
            flex
          />

          <Button label="Reset Workout" onPress={resetWorkout} variant="secondary" size="lg" flex />
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
    {loadError !== "" ? (
      <View style={{ alignItems: "flex-start", gap: 8 }}>
        <Text style={{ color: colors.danger, fontSize: 13 }}>{loadError}</Text>
        <Pressable onPress={fetchPastWorkouts}>
          <Text style={{ color: colors.teal, fontWeight: "700" }}>Retry</Text>
        </Pressable>
      </View>
    ) : pastWorkouts.length === 0 ? (
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
      </ScrollView>

      <ConfirmModal
  visible={pendingRemoval !== null}
  title="Remove exercise?"
  description={`This removes "${pendingRemoval?.name}" and its logged sets from this session.`}
  confirmLabel="Remove"
  confirmColor={colors.coral}
  confirmTextColor={colors.coralOn}
  onCancel={() => setPendingRemoval(null)}
  onConfirm={() => {
    removeExercise(pendingRemoval!.id);
    setPendingRemoval(null);
  }}
/>
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
        <Button
          label="Cancel"
          onPress={() => setConfirmFinish(false)}
          variant="secondary"
          size="sm"
          disabled={finishWorkoutGuard.pending}
          flex
        />
        <Button
          label={finishWorkoutGuard.pending ? "Finishing…" : "Finish"}
          onPress={finishWorkout}
          variant="primary"
          size="sm"
          disabled={finishWorkoutGuard.pending}
          flex
        />
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
          <X size={18} color={colors.textFaint} />
        </Pressable>
      </View>

      {loadError !== "" ? (
        <View style={{ alignItems: "flex-start", gap: 8 }}>
          <Text style={{ color: colors.danger, fontSize: 13 }}>{loadError}</Text>
          <Pressable onPress={fetchPastWorkouts}>
            <Text style={{ color: colors.teal, fontWeight: "700" }}>Retry</Text>
          </Pressable>
        </View>
      ) : pastWorkouts.length === 0 ? (
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              {/* Edit is only offered inside the 7-day window the server
                  enforces; older sessions stay view/delete only. */}
              {isWithinEditWindow(workout.ended_at) && (
                <Pressable onPress={() => openWorkoutEditor(workout.id)} hitSlop={8}>
                  <Text style={{ color: colors.teal, fontSize: 13, fontFamily: fonts.bodyBold }}>Edit</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setPendingWorkoutDeletion(workout.id)} hitSlop={8}>
                <Text style={{ color: colors.textFaint, fontSize: 16 }}>🗑</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  </View>
)}

{editingWorkoutId !== null && (
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
    <Card shape="modal" style={{ padding: 20, width: "100%", maxWidth: 360, maxHeight: "80%" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontFamily: fonts.heading }}>Edit workout</Text>
        <Pressable onPress={closeWorkoutEditor} hitSlop={8}>
          <X size={18} color={colors.textFaint} />
        </Pressable>
      </View>
      <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 14, fontFamily: fonts.body }}>
        Sets stay editable for {EDIT_WINDOW_DAYS} days after a session finishes.
      </Text>

      {isLoadingEdit ? (
        <Text style={{ color: colors.textFaint, fontFamily: fonts.body }}>Loading…</Text>
      ) : editingSets.length === 0 ? (
        <Text style={{ color: colors.textFaint, fontFamily: fonts.body }}>No sets logged in this workout.</Text>
      ) : (
        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          {editingSets.map((set, index) => {
            const isFirstOfExercise =
              index === 0 || editingSets[index - 1].exerciseName !== set.exerciseName;
            return (
              <View key={set.id}>
                {isFirstOfExercise && (
                  <Text
                    style={{
                      color: colors.textDim,
                      fontSize: 11,
                      letterSpacing: 0.55,
                      marginTop: index === 0 ? 0 : 14,
                      fontFamily: fonts.bodyExtra,
                    }}
                  >
                    {set.exerciseName.toUpperCase()}
                  </Text>
                )}
                <EditableSetRow
                  index={set.setNumber - 1}
                  weightText={set.weightText}
                  repsText={set.repsText}
                  showComplete={false}
                  onChangeWeightText={(text) => {
                    if (!/^\d*\.?\d*$/.test(text)) return;
                    updateEditingSet(set.id, { weightText: text });
                  }}
                  onChangeRepsText={(text) => {
                    if (!/^\d*$/.test(text)) return;
                    updateEditingSet(set.id, { repsText: text });
                  }}
                />
              </View>
            );
          })}
        </ScrollView>
      )}

      {editError !== "" && (
        <Text style={{ color: colors.danger, fontSize: 12, marginTop: 12, fontFamily: fonts.body }}>
          {editError}
        </Text>
      )}

      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <Button label="Cancel" onPress={closeWorkoutEditor} variant="secondary" size="sm" flex />
        <Button
          label={saveEditGuard.pending ? "Saving…" : "Save"}
          onPress={saveWorkoutEdits}
          variant="primary"
          size="sm"
          disabled={saveEditGuard.pending || isLoadingEdit || editingSets.length === 0}
          flex
        />
      </View>
    </Card>
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
        <Button
          label="Cancel"
          onPress={() => setPendingWorkoutDeletion(null)}
          variant="secondary"
          size="sm"
          disabled={deleteWorkoutGuard.pending}
          flex
        />
        <Button
          label={deleteWorkoutGuard.pending ? "Deleting…" : "Delete"}
          onPress={() => pendingWorkoutDeletion !== null && deletePastWorkout(pendingWorkoutDeletion)}
          variant="danger"
          size="sm"
          disabled={deleteWorkoutGuard.pending}
          flex
        />
      </View>
    </View>
  </View>
)}
    </LinearGradient>

  );
}
