import { View, Text, Pressable, TextInput } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useState, useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type SetEntry = {
  id: string;
  weight: number;
  weightText?: string;
  reps: number;
  completed: boolean;
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

    const totalSets = allSets.length;
    const completedSets = allSets.filter((set) => set.completed).length;

    // An unfilled set (weight or reps still 0/undefined) shouldn't count
    // toward the best e1RM - it's not a real lift yet.
    const e1rm = allSets.reduce((best, set) => {
      if (!set.weight || !set.reps) return best;
      const estimated1RM = set.weight * (1 + set.reps / 30);
      return estimated1RM > best ? estimated1RM : best;
    }, 0);

    return { volume, totalSets, completedSets, e1rm };
  }, [exercises]);

  const addExercise = (name: string, exerciseId?: number) => {
    const newExercise: ExerciseEntry = { id: Date.now().toString(), name, sets: [], exerciseId };
    setExercises([...exercises, newExercise]);
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
    const newSet: SetEntry = { id: Date.now().toString(), weight: 0, weightText: "0", reps: 0, completed: false };
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
      `http://localhost:8000/exercises?search=${query}${muscleGroup ? `&muscle_group=${muscleGroup}` : ""}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    setSearchResults(data);
  };

  const fetchFavorites = async () => {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`http://localhost:8000/exercises?favorites_only=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    setFavorites(data);
  };

  const toggleFavorite = async (option: ExerciseOption, isFavorited: boolean) => {
    const token = await AsyncStorage.getItem("token");
    await fetch(`http://localhost:8000/exercises/${option.id}/favorite`, {
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

  const selectExercise = (option: ExerciseOption) => {
    addExercise(option.name, option.id);
    setIsPickerOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setActiveMuscleGroup(null);
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

      <View style={{ borderRadius: 16, marginBottom: 12, marginTop: 16, flexDirection: "row", justifyContent: "flex-start", alignItems: "center" }}>

        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginRight: 8 }} />

        <Text style={{color: colors.accent, fontSize: 12, letterSpacing: 1}}>{isRunning ? "SESSION LIVE" : elapsedSeconds > 0 ? "SESSION PAUSED" : "NOT STARTED"}</Text>

      </View>


      <View style={{ flexDirection: "row", justifyContent: "space-between"}}>

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
        <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "bold" }}>{stats.completedSets}/{stats.totalSets}</Text>
      </View>

      <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, flex: 1 }}>
        <Text style={{ color: colors.textFaint, fontSize: 11, letterSpacing: 1 }}>BEST E1RM</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "bold" }}>{Math.round(stats.e1rm)}</Text>
      </View>

    </View>


    {exercises.map((exercise) => {
       const totalSets = exercise.sets.length;
       const completedSets = exercise.sets.filter((set) => set.completed).length;
       const isCollapsed = !!expandedExercises[exercise.id];
       const isQueued = isCollapsed && completedSets === 0;
       const isFullyCompleted = totalSets > 0 && completedSets === totalSets;

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
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {exercise.exerciseId !== undefined ? (
                <Text
                  style={{
                    color: colors.textPrimary,
                    flex: 1,
                    marginRight: 8,
                    backgroundColor: colors.bgInset,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  {exercise.name}
                </Text>
              ) : (
                <TextInput
                  value={exercise.name}
                  onChangeText={(text) => updateExercise(exercise.id, { name: text })}
                  style={{
                    color: colors.textPrimary,
                    flex: 1,
                    marginRight: 8,
                    backgroundColor: colors.bgInset,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                />
              )}

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ color: colors.textPrimary }}>
                 {completedSets}/{totalSets}
                </Text>
                <Pressable onPress={() => removeExercise(exercise.id)}>
                  <Text style={{ color: colors.textFaint }}>✕</Text>
                </Pressable>
              </View>
            </View>

            {exercise.sets.map((set, index) => (
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
                  }}
                >
                  <TextInput
                    value={set.weightText !== undefined ? set.weightText : String(set.weight)}
                    onChangeText={(text) => {
                      if (!/^\d*\.?\d*$/.test(text)) return;
                      updateSet(exercise.id, set.id, {
                        weightText: text,
                        ...(text !== "" && !text.endsWith(".") ? { weight: Number(text) } : {}),
                      });
                    }}
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
                  }}
                >
                  <TextInput
                    value={String(set.reps)}
                    onChangeText={(text) => updateSet(exercise.id, set.id, { reps: Number(text) })}
                    style={{ color: colors.textPrimary, width: 40 }}
                    keyboardType="number-pad"
                  />
                  <Text style={{ color: colors.textFaint, marginLeft: 4 }}>rp</Text>
                </View>

                <Pressable
                  onPress={() => updateSet(exercise.id, set.id, { completed: !set.completed })}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: set.completed ? colors.accent : "transparent",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {set.completed && <Text style={{ color: colors.on }}>✓</Text>}
                </Pressable>
              </View>
            ))}

            <Pressable onPress={() => addSet(exercise.id)} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textPrimary }}>+ Add Set</Text>
            </Pressable>

            <Pressable
              onPress={() => toggleExerciseExpanded(exercise.id)}
              style={{
                marginTop: 8,
                backgroundColor: colors.bgInset,
                borderRadius: 8,
                padding: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.textPrimary }}>Done</Text>
            </Pressable>
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
                      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}
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
            borderColor: colors.accent,
            borderStyle: "dashed",
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text style={{ color: colors.textPrimary }}>Add Exercise</Text>
        </Pressable>
      )}

      {!hasStarted && (
        <Pressable
          onPress={() => {
            setIsRunning(true);
            setHasStarted(true);
          }}
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