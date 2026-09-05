import { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Image } from "react-native";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { X, Minus, Plus, Camera } from "lucide-react-native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../constants/theme";
import { authFetch, uploadPhoto } from "../../utils/api";
import { API_URL } from "../../constants/api";
import { ScreenBackground } from "../../components/brand/ScreenBackground";
import { AnimatedScreen } from "../../components/brand/AnimatedScreen";
import { AppHeader } from "../../components/brand/AppHeader";
import { Card } from "../../components/brand/Card";
import { Button } from "../../components/brand/Button";
import { ProgressRing } from "../../components/brand/ProgressRing";
import { Sheet } from "../../components/brand/Sheet";

type Food = { id: number; name: string; calories: number; protein: number; carbs: number; fat: number };
type NutritionLog = {
  id: number;
  quantity_grams: number;
  logged_at: string;
  photo_url: string | null;
  food: Food;
};
type Targets = {
  target_calories: number | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fat: number | null;
};

export default function Nutrition() {
  const { colors } = useTheme();

  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [targets, setTargets] = useState<Targets | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [foodSearch, setFoodSearch] = useState("");
  const [foodResults, setFoodResults] = useState<Food[]>([]);
  const [pickedFood, setPickedFood] = useState<Food | null>(null);
  const [foodQty, setFoodQty] = useState(100);

  const loadLogs = useCallback(() => {
    authFetch<NutritionLog[]>("/nutrition").then(setLogs).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
      authFetch<Targets>("/nutrition/targets").then(setTargets).catch(() => {});
    }, [loadLogs])
  );

  const searchFoods = (query: string) => {
    setFoodSearch(query);
    if (query.length === 0) {
      setFoodResults([]);
      return;
    }
    authFetch<Food[]>(`/foods?search=${encodeURIComponent(query)}`).then(setFoodResults).catch(() => {});
  };

  const closeAddFood = () => {
    setIsAddOpen(false);
    setFoodSearch("");
    setFoodResults([]);
    setPickedFood(null);
    setFoodQty(100);
  };

  const confirmAddFood = async () => {
    if (!pickedFood) return;
    await authFetch("/nutrition", {
      method: "POST",
      body: JSON.stringify({ food_id: pickedFood.id, quantity_grams: foodQty }),
    });
    closeAddFood();
    loadLogs();
  };

  const removeLog = async (id: number) => {
    await authFetch(`/nutrition/${id}`, { method: "DELETE" });
    setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  // Attaches a photo to one specific logged meal - the design's generic
  // top-level "Attach photo" button had no meal to attach to (its own
  // photoOpen/photoAttached state wasn't tied to any log entry either,
  // just a UI demo), so this migration moved the affordance onto each
  // meal row's thumbnail instead, where there's an actual log_id for
  // POST /nutrition/{id}/photo to target. Documented in PROJECT_STATUS.md.
  const pickAndAttachPhoto = async (logId: number) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (result.canceled || result.assets.length === 0) return;

    const updated = await uploadPhoto<NutritionLog>(`/nutrition/${logId}/photo`, result.assets[0].uri);
    setLogs((prev) => prev.map((l) => (l.id === logId ? { ...l, photo_url: updated.photo_url } : l)));
  };

  const totals = logs.reduce(
    (acc, log) => {
      const factor = log.quantity_grams / 100;
      acc.calories += log.food.calories * factor;
      acc.protein += log.food.protein * factor;
      acc.carbs += log.food.carbs * factor;
      acc.fat += log.food.fat * factor;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const calTarget = targets?.target_calories ?? 0;
  const calPct = calTarget > 0 ? Math.min(100, Math.round((totals.calories / calTarget) * 100)) : 0;

  const macros = [
    { label: "Protein", consumed: totals.protein, target: targets?.target_protein ?? 0, color: colors.primary },
    { label: "Carbs", consumed: totals.carbs, target: targets?.target_carbs ?? 0, color: colors.secondary },
    { label: "Fat", consumed: totals.fat, target: targets?.target_fat ?? 0, color: colors.danger },
  ];

  return (
    <ScreenBackground>
      <AppHeader title="Nutrition" />
      <AnimatedScreen>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110, gap: 16 }}>
          <Card variant="hero" style={{ padding: 22, alignItems: "center" }}>
            <ProgressRing size={150} strokeWidth={14} progress={calPct / 100} trackColor={colors.cardAlt} progressColor={colors.primary}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 28, color: colors.text }}>
                {Math.round(totals.calories)}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textDim, fontFamily: fonts.bodyBold }}>
                of {calTarget || "—"} kcal
              </Text>
            </ProgressRing>

            <View style={{ flexDirection: "row", gap: 18, marginTop: 10, width: "100%" }}>
              {macros.map((m) => {
                const pct = m.target > 0 ? Math.min(100, Math.round((m.consumed / m.target) * 100)) : 0;
                return (
                  <View key={m.label} style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, fontFamily: fonts.bodyBold, color: colors.textDim }}>{m.label}</Text>
                      <Text style={{ fontSize: 11, fontFamily: fonts.bodyBold, color: colors.textDim }}>
                        {Math.round(m.consumed)}/{Math.round(m.target)}g
                      </Text>
                    </View>
                    <View style={{ height: 6, borderRadius: 999, backgroundColor: colors.cardAlt, overflow: "hidden" }}>
                      <View style={{ height: "100%", borderRadius: 999, backgroundColor: m.color, width: `${pct}%` }} />
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>

          <Button title="+ Log food" onPress={() => setIsAddOpen(true)} />

          {logs.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 30 }}>
              <View
                style={{
                  width: "100%",
                  height: 80,
                  borderRadius: 16,
                  backgroundColor: colors.cardAlt,
                  marginBottom: 14,
                }}
              />
              <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 14 }}>No meals logged yet</Text>
              <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 4, fontFamily: fonts.bodyRegular }}>
                Tap "Log food" to add your first meal.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {logs.map((log) => (
                <Card key={log.id} variant="plain" style={{ borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Pressable onPress={() => pickAndAttachPhoto(log.id)}>
                    {log.photo_url ? (
                      <Image
                        source={{ uri: `${API_URL}${log.photo_url}` }}
                        style={{ width: 44, height: 44, borderRadius: 12 }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          backgroundColor: colors.cardAlt,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Camera size={16} color={colors.textDim} />
                      </View>
                    )}
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13 }}>{log.food.name}</Text>
                    <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2, fontFamily: fonts.bodyRegular }}>
                      {log.quantity_grams}g · {Math.round((log.food.calories * log.quantity_grams) / 100)} kcal
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => removeLog(log.id)}
                    style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.cardAlt, alignItems: "center", justifyContent: "center" }}
                  >
                    <X size={13} color={colors.textDim} />
                  </Pressable>
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      </AnimatedScreen>

      <Sheet visible={isAddOpen} onClose={closeAddFood} maxHeightPct={75}>
        <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 16, marginBottom: 10 }}>Log food</Text>
        {!pickedFood ? (
          <>
            <TextInput
              value={foodSearch}
              onChangeText={searchFoods}
              placeholder="Search foods..."
              placeholderTextColor={colors.textDim}
              style={{
                color: colors.text,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                padding: 12,
                marginBottom: 12,
                fontFamily: fonts.bodyRegular,
              }}
            />
            <ScrollView style={{ maxHeight: 360 }}>
              {foodResults.map((food) => (
                <Pressable
                  key={food.id}
                  onPress={() => {
                    setPickedFood(food);
                    setFoodQty(100);
                  }}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13 }}>{food.name}</Text>
                  <Text style={{ color: colors.textDim, fontSize: 11, fontFamily: fonts.bodyBold }}>
                    {Math.round(food.calories)} kcal/100g
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : (
          <View>
            <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 15, marginBottom: 12 }}>
              {pickedFood.name}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <Pressable
                onPress={() => setFoodQty((q) => Math.max(10, q - 10))}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cardAlt, alignItems: "center", justifyContent: "center" }}
              >
                <Minus size={16} color={colors.text} />
              </Pressable>
              <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.headingBold, fontSize: 20, color: colors.text }}>
                {foodQty}g
              </Text>
              <Pressable
                onPress={() => setFoodQty((q) => q + 10)}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cardAlt, alignItems: "center", justifyContent: "center" }}
              >
                <Plus size={16} color={colors.text} />
              </Pressable>
            </View>
            <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 16, fontFamily: fonts.bodyRegular }}>
              ≈ {Math.round((pickedFood.calories * foodQty) / 100)} kcal
            </Text>
            <Button title="Add to log" onPress={confirmAddFood} />
          </View>
        )}
      </Sheet>
    </ScreenBackground>
  );
}
