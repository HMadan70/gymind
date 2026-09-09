import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { X } from "lucide-react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../constants/theme";
import { API_URL } from "../../constants/api";
import { Card } from "../../components/Card";
import { authFetch } from "../../lib/session";

type Food = {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  // null = shared USDA reference food, set = this user's own custom food
  user_id?: number | null;
  // computed per-request by the API from user_favorite_foods, not stored
  is_favorited?: boolean;
};

type NutritionLog = {
  id: number;
  food_id: number;
  quantity_grams: number;
  logged_at: string | null;
  food: { name: string; calories: number; protein: number; carbs: number; fat: number } | null;
};

type Totals = { calories: number; protein: number; carbs: number; fat: number };

const RING_RADIUS = 62;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const EMPTY_TOTALS: Totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

const isToday = (iso: string | null | undefined) => {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

export default function Nutrition() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [logs, setLogs] = useState<NutritionLog[]>([]);
  // Today's totals come from GET /nutrition/summary rather than being
  // reduced from `logs` here. The server bounds the day in UTC; a local
  // isToday() filter disagrees with it either side of midnight, which put
  // this ring and Home's out of step against the same daily target.
  const [consumed, setConsumed] = useState<Totals>(EMPTY_TOTALS);
  const [targets, setTargets] = useState<{
    target_calories: number | null;
    target_protein: number | null;
    target_carbs: number | null;
    target_fat: number | null;
  } | null>(null);
  const [loadError, setLoadError] = useState("");

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [foodSearch, setFoodSearch] = useState("");
  const [foodResults, setFoodResults] = useState<Food[]>([]);
  const [favoriteFoods, setFavoriteFoods] = useState<Food[]>([]);
  const [pickedFood, setPickedFood] = useState<Food | null>(null);
  const [quantityText, setQuantityText] = useState("100");
  const [isSaving, setIsSaving] = useState(false);

  // Editing an already-logged entry (quantity only — same shape as
  // Workout's set editor, which edits weight/reps but never which
  // exercise the set belongs to).
  const [editingLog, setEditingLog] = useState<NutritionLog | null>(null);
  const [editQuantityText, setEditQuantityText] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Custom-food creation. Same shared/private model the exercises table
  // uses: POST /foods stores the row against the user, and GET /foods
  // already returns shared USDA rows and the user's own together, so a
  // created food shows up in the very next search with no extra wiring.
  const [isCreatingFood, setIsCreatingFood] = useState(false);
  const [draftFood, setDraftFood] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  const [createError, setCreateError] = useState("");

  const loadNutrition = useCallback(async () => {
    setLoadError("");
    try {
      const [logsResponse, targetsResponse, summaryResponse] = await Promise.all([
        authFetch(`${API_URL}/nutrition`),
        authFetch(`${API_URL}/nutrition/targets`),
        // No ?date= — the server defaults to today, which is what the ring
        // shows. Home reads the same endpoint, so both screens agree.
        authFetch(`${API_URL}/nutrition/summary`),
      ]);
      if (logsResponse.ok) setLogs(await logsResponse.json());
      if (targetsResponse.ok) setTargets(await targetsResponse.json());
      if (summaryResponse.ok) {
        const summary = await summaryResponse.json();
        setConsumed({
          calories: summary?.total_calories ?? 0,
          protein: summary?.total_protein ?? 0,
          carbs: summary?.total_carbs ?? 0,
          fat: summary?.total_fat ?? 0,
        });
      }
      if (!logsResponse.ok && !targetsResponse.ok) setLoadError("Could not load nutrition data.");
    } catch {
      setLoadError("Could not reach the server.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNutrition();
    }, [loadNutrition])
  );

  const searchFoods = async (query: string) => {
    setFoodSearch(query);
    if (query.trim().length === 0) {
      setFoodResults([]);
      return;
    }
    try {
      const response = await authFetch(`${API_URL}/foods?search=${encodeURIComponent(query)}`);
      if (response.ok) setFoodResults((await response.json()).slice(0, 25));
    } catch {
      setFoodResults([]);
    }
  };

  // Mirrors workout.tsx's fetchFavorites()/toggleFavorite() for exercises.
  const fetchFavoriteFoods = async () => {
    try {
      const response = await authFetch(`${API_URL}/foods?favorites_only=true`);
      if (response.ok) setFavoriteFoods(await response.json());
    } catch {
      setFavoriteFoods([]);
    }
  };

  const toggleFoodFavorite = async (food: Food) => {
    const isFavorited = !!food.is_favorited;
    try {
      await authFetch(`${API_URL}/foods/${food.id}/favorite`, {
        method: isFavorited ? "DELETE" : "POST",
      });
      // Flip it locally so the star responds immediately, then re-read the
      // favourites list from the server as the source of truth.
      setFoodResults((prev) =>
        prev.map((f) => (f.id === food.id ? { ...f, is_favorited: !isFavorited } : f))
      );
      fetchFavoriteFoods();
    } catch {
      setLoadError("Could not update that favorite.");
    }
  };

  const logFood = async () => {
    if (!pickedFood) return;
    const grams = Number(quantityText);
    if (!quantityText || Number.isNaN(grams) || grams <= 0) return;
    setIsSaving(true);
    try {
      const response = await authFetch(`${API_URL}/nutrition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food_id: pickedFood.id, quantity_grams: grams }),
      });
      if (response.ok) {
        closePicker();
        loadNutrition();
      } else {
        setLoadError("Could not log that food.");
      }
    } catch {
      setLoadError("Could not reach the server.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeLog = async (logId: number) => {
    try {
      await authFetch(`${API_URL}/nutrition/${logId}`, { method: "DELETE" });
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch {
      setLoadError("Could not remove that entry.");
    }
  };

  const openLogEditor = (log: NutritionLog) => {
    setEditingLog(log);
    setEditQuantityText(String(log.quantity_grams ?? ""));
    setEditError("");
  };

  const saveLogEdit = async () => {
    if (!editingLog) return;
    const grams = Number(editQuantityText);
    if (!editQuantityText.trim() || Number.isNaN(grams) || grams <= 0) {
      setEditError("Enter a quantity.");
      return;
    }
    setIsSavingEdit(true);
    setEditError("");
    try {
      const response = await authFetch(`${API_URL}/nutrition/${editingLog.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // food_id and logged_at must both be sent back unchanged: the
        // endpoint replaces all three fields, and omitting logged_at makes
        // it default to now — which would silently drag a past entry into
        // today just for changing its quantity.
        body: JSON.stringify({
          food_id: editingLog.food_id,
          quantity_grams: grams,
          logged_at: editingLog.logged_at,
        }),
      });
      if (!response.ok) {
        setEditError("Could not save that change.");
        return;
      }
      setEditingLog(null);
      loadNutrition();
    } catch {
      setEditError("Could not reach the server.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const startCreatingFood = () => {
    // Carry the search term across as the name — the user has already
    // typed what they were looking for.
    setDraftFood({ name: foodSearch.trim(), calories: "", protein: "", carbs: "", fat: "" });
    setCreateError("");
    setIsCreatingFood(true);
  };

  const createFood = async () => {
    const { name, calories, protein, carbs, fat } = draftFood;
    if (name.trim().length === 0) {
      setCreateError("Give the food a name.");
      return;
    }
    const numbers = { calories, protein, carbs, fat };
    for (const [field, value] of Object.entries(numbers)) {
      if (value.trim() === "" || Number.isNaN(Number(value))) {
        setCreateError(`Enter a number for ${field}.`);
        return;
      }
    }

    setIsSaving(true);
    setCreateError("");
    try {
      const response = await authFetch(`${API_URL}/foods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          calories: Number(calories),
          protein: Number(protein),
          carbs: Number(carbs),
          fat: Number(fat),
        }),
      });
      if (!response.ok) {
        setCreateError("Could not save that food.");
        return;
      }
      // Drop straight into the quantity step with the food just created,
      // so creating and logging is one continuous flow.
      const created: Food = await response.json();
      setIsCreatingFood(false);
      setPickedFood(created);
    } catch {
      setCreateError("Could not reach the server.");
    } finally {
      setIsSaving(false);
    }
  };

  const closePicker = () => {
    setIsPickerOpen(false);
    setFoodSearch("");
    setFoodResults([]);
    setPickedFood(null);
    setQuantityText("100");
    setIsCreatingFood(false);
    setCreateError("");
  };

  const calorieTarget = targets?.target_calories ?? null;
  const caloriePct =
    calorieTarget && calorieTarget > 0 ? Math.min(1, consumed.calories / calorieTarget) : 0;

  const macroBars = [
    { label: "Protein", consumed: consumed.protein, target: targets?.target_protein ?? null, color: colors.teal },
    { label: "Carbs", consumed: consumed.carbs, target: targets?.target_carbs ?? null, color: colors.gold },
    { label: "Fat", consumed: consumed.fat, target: targets?.target_fat ?? null, color: colors.danger },
  ];

  const recentLogs = [...logs].sort(
    (a, b) => new Date(b.logged_at ?? 0).getTime() - new Date(a.logged_at ?? 0).getTime()
  );
  // The ring counts today only, so the list is split the same way rather
  // than showing one undifferentiated history under a "today" ring.
  const todaysEntries = recentLogs.filter((log) => isToday(log.logged_at));

  // Recent history: previous days, each with its own macro totals, newest
  // day first. Built from the logs already loaded for the ring, so this
  // adds no extra request — see the note on GET /nutrition's missing date
  // range in the task report.
  const HISTORY_DAYS = 7;
  const recentDays = (() => {
    const byDay = new Map<string, { date: Date; entries: NutritionLog[]; totals: Totals }>();

    for (const log of recentLogs) {
      if (!log.logged_at || isToday(log.logged_at)) continue;
      const date = new Date(log.logged_at);
      if (Number.isNaN(date.getTime())) continue;

      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      let day = byDay.get(key);
      if (!day) {
        day = { date, entries: [], totals: { ...EMPTY_TOTALS } };
        byDay.set(key, day);
      }
      day.entries.push(log);

      if (log.food) {
        const factor = (log.quantity_grams || 0) / 100;
        day.totals = {
          calories: day.totals.calories + (log.food.calories || 0) * factor,
          protein: day.totals.protein + (log.food.protein || 0) * factor,
          carbs: day.totals.carbs + (log.food.carbs || 0) * factor,
          fat: day.totals.fat + (log.food.fat || 0) * factor,
        };
      }
    }

    return [...byDay.values()]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, HISTORY_DAYS);
  })();

  // One logged-food row. Shared by the Today list and each history day so
  // the two can't drift apart visually.
  const renderLogRow = (log: NutritionLog) => {
    const factor = (log.quantity_grams || 0) / 100;
    const kcal = Math.round((log.food?.calories || 0) * factor);
    return (
      <View
        key={log.id}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderRadius: 18,
          backgroundColor: colors.bgCard,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 12,
          paddingHorizontal: 14,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.bgInset,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.textFaint, fontSize: 15, fontFamily: fonts.bodyExtra }}>
            {(log.food?.name ?? "?").trim().charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ color: colors.textPrimary, fontSize: 13, fontFamily: fonts.bodyBold }}>
            {log.food?.name ?? "Food"}
          </Text>
          <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2, fontFamily: fonts.body }}>
            {Math.round(log.quantity_grams)}g · {kcal} kcal
          </Text>
        </View>

        {/* Edit + remove, same pairing the Past Workouts rows use. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => openLogEditor(log)} hitSlop={8}>
            <Text style={{ color: colors.teal, fontSize: 13, fontFamily: fonts.bodyBold }}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={() => removeLog(log.id)}
            hitSlop={8}
            style={{
              width: 26,
              height: 26,
              borderRadius: 99,
              backgroundColor: colors.bgInset,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.textDim, fontSize: 13 }}>×</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const formatDayLabel = (date: Date) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const sameDay =
      date.getFullYear() === yesterday.getFullYear() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getDate() === yesterday.getDate();
    if (sameDay) return "Yesterday";
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.bgBase, colors.bgBase, colors.gradientBottom]}
      locations={[0, 0.3, 0.7, 1]}
      style={{ flex: 1 }}
    >
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 6 }}>
        <Text style={{ color: colors.textDim, fontSize: 12, letterSpacing: 0.72, fontFamily: fonts.bodyBold }}>
          TODAY
        </Text>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontFamily: fonts.heading }}>Nutrition</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loadError !== "" && (
          <Text style={{ color: colors.danger, fontSize: 12, fontFamily: fonts.body }}>{loadError}</Text>
        )}

        {/* Calorie ring + macro bars */}
        <Card
          shape="hero"
          style={{ padding: 22, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}
        >
          <View style={{ width: 150, height: 150 }}>
            <Svg width={150} height={150} viewBox="0 0 150 150">
              <Circle cx={75} cy={75} r={RING_RADIUS} fill="none" stroke={colors.bgInset} strokeWidth={14} />
              <Circle
                cx={75}
                cy={75}
                r={RING_RADIUS}
                fill="none"
                stroke={colors.teal}
                strokeWidth={14}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - caloriePct)}
                transform="rotate(-90 75 75)"
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
              <Text style={{ color: colors.textPrimary, fontSize: 28, fontFamily: fonts.heading }}>
                {Math.round(consumed.calories)}
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 11, fontFamily: fonts.bodyBold }}>
                {calorieTarget ? `of ${Math.round(calorieTarget)} kcal` : "kcal today"}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 18, marginTop: 10, width: "100%" }}>
            {macroBars.map((macro) => {
              const pct =
                macro.target && macro.target > 0 ? Math.min(1, macro.consumed / macro.target) : 0;
              return (
                <View key={macro.label} style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ color: colors.textDim, fontSize: 11, fontFamily: fonts.bodyBold }}>
                      {macro.label}
                    </Text>
                    <Text style={{ color: colors.textDim, fontSize: 11, fontFamily: fonts.bodyBold }}>
                      {Math.round(macro.consumed)}/{macro.target ? Math.round(macro.target) : "—"}g
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 6,
                      borderRadius: 99,
                      backgroundColor: colors.bgInset,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        borderRadius: 99,
                        backgroundColor: macro.color,
                        width: `${pct * 100}%`,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Actions */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => {
              setIsPickerOpen(true);
              fetchFavoriteFoods();
            }}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 16,
              backgroundColor: colors.teal,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.tealOn, fontSize: 13, fontFamily: fonts.bodyExtra }}>+ Log food</Text>
          </Pressable>

          <View
            accessibilityLabel="Photo attachment is not available yet"
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 16,
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.textDim, fontSize: 13, fontFamily: fonts.bodyBold }}>Attach photo</Text>
          </View>
        </View>

        {/* Logged foods */}
        {recentLogs.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 30, paddingHorizontal: 10 }}>
            <View
              style={{
                width: "100%",
                height: 80,
                borderRadius: 16,
                backgroundColor: colors.bgInset,
                marginBottom: 14,
              }}
            />
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: fonts.bodyBold }}>
              No meals logged yet
            </Text>
            <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 4, fontFamily: fonts.body }}>
              {'Tap "Log food" to add your first meal.'}
            </Text>
          </View>
        ) : (
          <>
            {/* Today — the entries the ring above is counting. */}
            {todaysEntries.length > 0 && (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text
                    style={{
                      color: colors.textDim,
                      fontSize: 11,
                      letterSpacing: 0.55,
                      fontFamily: fonts.bodyExtra,
                    }}
                  >
                    TODAY
                  </Text>
                  <Text style={{ color: colors.textFaint, fontSize: 11, fontFamily: fonts.body }}>
                    {todaysEntries.length} {todaysEntries.length === 1 ? "entry" : "entries"}
                  </Text>
                </View>
                {todaysEntries.map(renderLogRow)}
              </View>
            )}

            {/* Recent history — previous days with their own macro totals. */}
            {recentDays.length > 0 && (
              <View style={{ gap: 14 }}>
                <Text
                  style={{
                    color: colors.textDim,
                    fontSize: 11,
                    letterSpacing: 0.55,
                    fontFamily: fonts.bodyExtra,
                  }}
                >
                  RECENT DAYS
                </Text>

                {recentDays.map((day) => (
                  <View key={day.date.toISOString()} style={{ gap: 10 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: fonts.bodyBold }}>
                        {formatDayLabel(day.date)}
                      </Text>
                      <Text style={{ color: colors.textDim, fontSize: 11, fontFamily: fonts.body }}>
                        {Math.round(day.totals.calories)} kcal · {Math.round(day.totals.protein)}p{" "}
                        {Math.round(day.totals.carbs)}c {Math.round(day.totals.fat)}f
                      </Text>
                    </View>
                    {day.entries.map(renderLogRow)}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Food picker */}
      {isPickerOpen && (
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
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontFamily: fonts.heading }}>
                {isCreatingFood ? "New food" : "Log food"}
              </Text>
              <Pressable onPress={closePicker} hitSlop={8}>
                <X size={18} color={colors.textFaint} />
              </Pressable>
            </View>

            {isCreatingFood ? (
              <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
                <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 14, fontFamily: fonts.body }}>
                  Macros per 100g — the same basis as the food database.
                </Text>

                <Text style={{ color: colors.textDim, fontSize: 11, letterSpacing: 0.55, marginBottom: 6, fontFamily: fonts.bodyExtra }}>
                  NAME
                </Text>
                <TextInput
                  value={draftFood.name}
                  onChangeText={(text) => setDraftFood({ ...draftFood, name: text })}
                  placeholder="e.g. Mum's lasagne"
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

                {([
                  ["calories", "CALORIES (KCAL)"],
                  ["protein", "PROTEIN (G)"],
                  ["carbs", "CARBS (G)"],
                  ["fat", "FAT (G)"],
                ] as const).map(([field, label]) => (
                  <View key={field} style={{ marginBottom: 14 }}>
                    <Text style={{ color: colors.textDim, fontSize: 11, letterSpacing: 0.55, marginBottom: 6, fontFamily: fonts.bodyExtra }}>
                      {label}
                    </Text>
                    <TextInput
                      value={draftFood[field]}
                      onChangeText={(text) => {
                        if (!/^\d*\.?\d*$/.test(text)) return;
                        setDraftFood({ ...draftFood, [field]: text });
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
                      }}
                    />
                  </View>
                ))}

                {createError !== "" && (
                  <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 10, fontFamily: fonts.body }}>
                    {createError}
                  </Text>
                )}

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => setIsCreatingFood(false)}
                    style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.bgInset, alignItems: "center" }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: fonts.bodySemi }}>Back</Text>
                  </Pressable>
                  <Pressable
                    onPress={createFood}
                    style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.teal, alignItems: "center" }}
                  >
                    <Text style={{ color: colors.tealOn, fontSize: 14, fontFamily: fonts.bodySemi }}>
                      {isSaving ? "Saving…" : "Create food"}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : pickedFood ? (
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontFamily: fonts.bodyBold }}>
                  {pickedFood.name}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2, marginBottom: 14, fontFamily: fonts.body }}>
                  {Math.round(pickedFood.calories)} kcal per 100g
                </Text>

                <Text style={{ color: colors.textDim, fontSize: 11, letterSpacing: 0.55, marginBottom: 6, fontFamily: fonts.bodyExtra }}>
                  QUANTITY (G)
                </Text>
                <TextInput
                  value={quantityText}
                  onChangeText={(text) => {
                    if (!/^\d*\.?\d*$/.test(text)) return;
                    setQuantityText(text);
                  }}
                  keyboardType="decimal-pad"
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
                  }}
                />

                <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 10, fontFamily: fonts.body }}>
                  {Math.round((pickedFood.calories * (Number(quantityText) || 0)) / 100)} kcal total
                </Text>

                <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                  <Pressable
                    onPress={() => setPickedFood(null)}
                    style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.bgInset, alignItems: "center" }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: fonts.bodySemi }}>Back</Text>
                  </Pressable>
                  <Pressable
                    onPress={logFood}
                    style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.teal, alignItems: "center" }}
                  >
                    <Text style={{ color: colors.tealOn, fontSize: 14, fontFamily: fonts.bodySemi }}>
                      {isSaving ? "Saving…" : "Add to log"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View>
                <TextInput
                  value={foodSearch}
                  onChangeText={searchFoods}
                  placeholder="Search foods…"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 14,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    fontSize: 14,
                    color: colors.textPrimary,
                    backgroundColor: colors.bgCard,
                    marginBottom: 10,
                  }}
                />
                <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                  {foodSearch.trim().length === 0 ? (
                    // Favourites stand in for search results before the
                    // user types anything, same as the exercise picker
                    // leading with its FAVORITES section.
                    favoriteFoods.length > 0 ? (
                      <View>
                        <Text
                          style={{
                            color: colors.textDim,
                            fontSize: 11,
                            letterSpacing: 0.55,
                            marginBottom: 8,
                            fontFamily: fonts.bodyExtra,
                          }}
                        >
                          FAVORITES
                        </Text>
                        {favoriteFoods.map((food) => (
                          <Pressable
                            key={food.id}
                            onPress={() => setPickedFood(food)}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              paddingVertical: 10,
                              borderBottomWidth: 1,
                              borderBottomColor: colors.border,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: fonts.bodyBold }}>
                                {food.name}
                              </Text>
                              <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2, fontFamily: fonts.body }}>
                                {Math.round(food.calories)} kcal / 100g
                              </Text>
                            </View>
                            <Pressable onPress={() => toggleFoodFavorite({ ...food, is_favorited: true })} hitSlop={8}>
                              <Text style={{ color: colors.teal }}>★</Text>
                            </Pressable>
                          </Pressable>
                        ))}
                      </View>
                    ) : (
                      <Text style={{ color: colors.textFaint, fontSize: 12, fontFamily: fonts.body }}>
                        Start typing to search the food database.
                      </Text>
                    )
                  ) : foodResults.length === 0 ? (
                    <Text style={{ color: colors.textFaint, fontSize: 12, fontFamily: fonts.body }}>
                      {`No foods matched "${foodSearch}".`}
                    </Text>
                  ) : (
                    foodResults.map((food) => (
                      <Pressable
                        key={food.id}
                        onPress={() => setPickedFood(food)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          paddingVertical: 10,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: fonts.bodyBold }}>
                            {food.name}
                          </Text>
                          <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2, fontFamily: fonts.body }}>
                            {Math.round(food.calories)} kcal / 100g
                          </Text>
                        </View>
                        {/* user_id set = this user's own custom food */}
                        {food.user_id != null && (
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 99,
                              backgroundColor: colors.tealSoft,
                            }}
                          >
                            <Text style={{ color: colors.teal, fontSize: 10, fontFamily: fonts.bodyExtra }}>YOURS</Text>
                          </View>
                        )}
                        {/* Same ★/☆ treatment as the exercise picker. */}
                        <Pressable onPress={() => toggleFoodFavorite(food)} hitSlop={8}>
                          <Text style={{ color: food.is_favorited ? colors.teal : colors.textFaint }}>
                            {food.is_favorited ? "★" : "☆"}
                          </Text>
                        </Pressable>
                      </Pressable>
                    ))
                  )}
                </ScrollView>

                {/* Escape hatch when the database doesn't have it — same
                    shape as the search-then-create flow the exercise
                    picker's structure implies. */}
                <Pressable
                  onPress={startCreatingFood}
                  style={{
                    marginTop: 12,
                    paddingVertical: 12,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                    borderColor: colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.teal, fontSize: 13, fontFamily: fonts.bodyBold }}>
                    {foodSearch.trim().length > 0 ? `+ Add "${foodSearch.trim()}" as a new food` : "+ Add a custom food"}
                  </Text>
                </Pressable>
              </View>
            )}
          </Card>
        </View>
      )}

      {/* Edit a logged entry — quantity only, same as Workout's set editor
          which edits the numbers but not which exercise the set is on. */}
      {editingLog !== null && (
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
                marginBottom: 4,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontFamily: fonts.heading }}>
                Edit entry
              </Text>
              <Pressable onPress={() => setEditingLog(null)} hitSlop={8}>
                <X size={18} color={colors.textFaint} />
              </Pressable>
            </View>

            <Text
              numberOfLines={2}
              style={{ color: colors.textDim, fontSize: 12, marginBottom: 14, fontFamily: fonts.body }}
            >
              {editingLog.food?.name ?? "Food"}
            </Text>

            <Text
              style={{
                color: colors.textDim,
                fontSize: 11,
                letterSpacing: 0.55,
                marginBottom: 6,
                fontFamily: fonts.bodyExtra,
              }}
            >
              QUANTITY (G)
            </Text>
            <TextInput
              value={editQuantityText}
              onChangeText={(text) => {
                if (!/^\d*\.?\d*$/.test(text)) return;
                setEditQuantityText(text);
              }}
              keyboardType="decimal-pad"
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
              }}
            />

            <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 10, fontFamily: fonts.body }}>
              {Math.round(((editingLog.food?.calories ?? 0) * (Number(editQuantityText) || 0)) / 100)} kcal total
            </Text>

            {editError !== "" && (
              <Text style={{ color: colors.danger, fontSize: 12, marginTop: 10, fontFamily: fonts.body }}>
                {editError}
              </Text>
            )}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <Pressable
                onPress={() => setEditingLog(null)}
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
                onPress={saveLogEdit}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: colors.teal,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.tealOn, fontSize: 14, fontFamily: fonts.bodySemi }}>
                  {isSavingEdit ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </View>
          </Card>
        </View>
      )}
    </LinearGradient>
  );
}
