import { View, Text, Pressable, TextInput, ScrollView } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useState } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://localhost:8000";
const TOKEN_KEY = "token";

type FormData = {
  goal: string;
  experience_level: string;
  injuries: string;
  equipment: string[];
  dietary_restrictions: string[];
};

const GOAL_OPTIONS = [
  { value: "lose_weight", title: "Lose weight", subtitle: "Fat loss with muscle retention", icon: "↓" },
  { value: "build_muscle", title: "Build muscle", subtitle: "Hypertrophy & progressive overload", icon: "↑" },
  { value: "maintain", title: "Maintain", subtitle: "Stay consistent & healthy", icon: "≈" },
];

// PLACEHOLDER copy — real design for steps 2-5 wasn't exported, swap if you have it
const EXPERIENCE_OPTIONS = [
  { value: "beginner", title: "Beginner", subtitle: "New to structured training", icon: "●" },
  { value: "intermediate", title: "Intermediate", subtitle: "6+ months consistent training", icon: "●●" },
  { value: "advanced", title: "Advanced", subtitle: "Years of consistent training", icon: "●●●" },
];

const EQUIPMENT_OPTIONS = ["None (bodyweight)", "Dumbbells", "Barbell", "Machines", "Resistance bands"];
const DIETARY_OPTIONS = ["None", "Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Keto"];

const STEP_TITLES = [
  "What's your main goal?",
  "What's your experience level?",
  "Any injuries we should know about?",
  "What equipment do you have?",
  "Any dietary restrictions?",
];

const STEP_SUBTITLES = [
  "This shapes your plan. You can change it anytime.",
  "Helps us calibrate difficulty and progression.",
  "Optional — leave blank if none.",
  "Select all that apply.",
  "Select all that apply.",
];

// Reusable card for single-select steps (goal, experience) — same visual pattern
// you already built and confirmed against the design for step 1.
function OptionCard({
  icon,
  title,
  subtitle,
  selected,
  onPress,
  colors,
}: {
  icon: string;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.soft : colors.bgCard,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          backgroundColor: selected ? colors.accent : colors.bgInset,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.textPrimary }}> {icon} </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 16 }}>
          {title}
        </Text>
        <Text style={{ color: colors.textDim, fontSize: 13 }}>{subtitle}</Text>
      </View>

      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.accent : "transparent",
        }}
      >
        {selected && <Text style={{ color: colors.on, fontSize: 15 }}> ✓ </Text>}
      </View>
    </Pressable>
  );
}

export default function Onboarding() {
  const { colors } = useTheme();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState<FormData>({
    goal: "",
    experience_level: "",
    injuries: "",
    equipment: [],
    dietary_restrictions: [],
  });

  function toggleArrayItem(field: "equipment" | "dietary_restrictions", item: string) {
    setFormData((prev) => {
      const current = prev[field];
      const next = current.includes(item)
        ? current.filter((x) => x !== item)
        : [...current, item];
      return { ...prev, [field]: next };
    });
  }

  function canContinue() {
    if (step === 0) return formData.goal !== "";
    if (step === 1) return formData.experience_level !== "";
    if (step === 2) return true; // injuries optional
    if (step === 3) return formData.equipment.length > 0;
    if (step === 4) return formData.dietary_restrictions.length > 0;
    return false;
  }

  function goNext() {
    if (step < 4) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  }

  function goBack() {
    if (step > 0) {
      setStep(step - 1);
    } else {
      router.back();
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${API_URL}/users/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error("Failed to save profile");
      }

      // TODO: confirm this matches your real Home route
      router.replace("/");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, paddingTop: 60, paddingHorizontal: 20 }}>
      {/* Header row */}
      <View style={{ flexDirection: "row", gap: 6, justifyContent: "space-between", alignItems: "center" }}>
        <Pressable onPress={goBack}>
          <Text style={{ color: colors.textPrimary, fontSize: 20 }}> ‹ </Text>
        </Pressable>

        <Text style={{ color: colors.textDim, fontSize: 12 }}>STEP {step + 1} OF 5</Text>

        <Pressable onPress={() => router.replace("/")}>
          <Text style={{ color: colors.textPrimary }}>Skip</Text>
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={{ flexDirection: "row", gap: 6, marginTop: 16 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              backgroundColor: i <= step ? colors.accent : colors.border,
            }}
          />
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: "bold", marginTop: 24, marginBottom: 8 }}>
          {STEP_TITLES[step]}
        </Text>
        <Text style={{ color: colors.textDim, fontSize: 15, marginBottom: 24 }}>
          {STEP_SUBTITLES[step]}
        </Text>

        {/* Step 0: goal */}
        {step === 0 && (
          <View style={{ gap: 12 }}>
            {GOAL_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                icon={opt.icon}
                title={opt.title}
                subtitle={opt.subtitle}
                selected={formData.goal === opt.value}
                onPress={() => setFormData({ ...formData, goal: opt.value })}
                colors={colors}
              />
            ))}
          </View>
        )}

        {/* Step 1: experience */}
        {step === 1 && (
          <View style={{ gap: 12 }}>
            {EXPERIENCE_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                icon={opt.icon}
                title={opt.title}
                subtitle={opt.subtitle}
                selected={formData.experience_level === opt.value}
                onPress={() => setFormData({ ...formData, experience_level: opt.value })}
                colors={colors}
              />
            ))}
          </View>
        )}

        {/* Step 2: injuries */}
        {step === 2 && (
          <TextInput
            value={formData.injuries}
            onChangeText={(text) => setFormData({ ...formData, injuries: text })}
            placeholder="e.g. left knee, minor — leave blank if none"
            placeholderTextColor={colors.textFaint}
            multiline
            style={{
              backgroundColor: colors.bgCard,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              padding: 16,
              color: colors.textPrimary,
              minHeight: 100,
              textAlignVertical: "top",
            }}
          />
        )}

        {/* Step 3: equipment (multi-select chips) */}
        {step === 3 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {EQUIPMENT_OPTIONS.map((item) => {
              const selected = formData.equipment.includes(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => toggleArrayItem("equipment", item)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? colors.soft : colors.bgCard,
                  }}
                >
                  <Text style={{ color: selected ? colors.accent : colors.textPrimary }}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Step 4: dietary restrictions (multi-select chips) */}
        {step === 4 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {DIETARY_OPTIONS.map((item) => {
              const selected = formData.dietary_restrictions.includes(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => toggleArrayItem("dietary_restrictions", item)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? colors.soft : colors.bgCard,
                  }}
                >
                  <Text style={{ color: selected ? colors.accent : colors.textPrimary }}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {error !== "" && <Text style={{ color: colors.danger, marginTop: 16 }}>{error}</Text>}
      </ScrollView>

      {/* Bottom bar: back + Continue */}
      <View style={{ flexDirection: "row", gap: 12, paddingVertical: 20 }}>
        <Pressable
          onPress={goBack}
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 18 }}> ‹ </Text>
        </Pressable>

        <Pressable
          onPress={goNext}
          disabled={!canContinue() || submitting}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 16,
            backgroundColor: canContinue() ? colors.accent : colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.on, fontWeight: "bold", fontSize: 16 }}>
            {submitting ? "Saving..." : step === 4 ? "Finish" : "Continue"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}