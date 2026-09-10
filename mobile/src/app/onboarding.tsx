import { View, Text, Pressable, TextInput, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../constants/theme";
import { useState } from "react";
import { router } from "expo-router";
import { API_URL } from "../constants/api";
import type { ThemeColors } from "../context/ThemeContext";
import { authFetch } from "../lib/session";
import { TrendingDown, TrendingUp, Equal, Check, type LucideIcon } from "lucide-react-native";

type FormData = {
  goal: string;
  experience_level: string;
  injuries: string;
  equipment: string[];
  dietary_restrictions: string[];
};

const GOAL_OPTIONS = [
  { value: "lose_weight", title: "Lose weight", subtitle: "Fat loss with muscle retention", icon: TrendingDown },
  { value: "build_muscle", title: "Build muscle", subtitle: "Hypertrophy & progressive overload", icon: TrendingUp },
  { value: "maintain", title: "Maintain", subtitle: "Stay consistent & healthy", icon: Equal },
];

// PLACEHOLDER copy — real design for steps 2-5 wasn't exported, swap if you have it.
// Experience level has no natural single-glyph icon, so it keeps its own
// dot-count meter (rendered as Views below, not text) rather than forcing
// an ill-fitting Lucide icon onto a concept the set doesn't represent well.
const EXPERIENCE_OPTIONS = [
  { value: "beginner", title: "Beginner", subtitle: "New to structured training", level: 1 },
  { value: "intermediate", title: "Intermediate", subtitle: "6+ months consistent training", level: 2 },
  { value: "advanced", title: "Advanced", subtitle: "Years of consistent training", level: 3 },
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
  icon: Icon,
  level,
  title,
  subtitle,
  selected,
  onPress,
  colors,
}: {
  icon?: LucideIcon;
  level?: number;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: selected ? colors.teal : colors.border,
        backgroundColor: selected ? colors.tealSoft : colors.bgCard,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          backgroundColor: selected ? colors.teal : colors.bgInset,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {Icon ? (
          <Icon size={20} color={colors.textPrimary} />
        ) : (
          <View style={{ flexDirection: "row", gap: 3 }}>
            {[1, 2, 3].map((dot) => (
              <View
                key={dot}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor:
                    dot <= (level ?? 0) ? colors.textPrimary : colors.textFaint,
                }}
              />
            ))}
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: 15 }}>
          {title}
        </Text>
        <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2, fontFamily: fonts.body }}>{subtitle}</Text>
      </View>

      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: selected ? colors.teal : colors.border,
          backgroundColor: selected ? colors.teal : "transparent",
        }}
      >
        {selected && (
          <View style={{ alignItems: "center", justifyContent: "center" }}>
            <Check size={14} color={colors.tealOn} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function Onboarding() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

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
      const res = await authFetch(`${API_URL}/users/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error("Failed to save profile");
      }

      router.replace("/(tabs)");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.bgBase, colors.bgBase, colors.gradientBottom]}
      locations={[0, 0.3, 0.7, 1]}
      style={{ flex: 1, paddingTop: insets.top + 16, paddingHorizontal: 22, paddingBottom: 22 }}
    >
      {/* Header row */}
      <View style={{ flexDirection: "row", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
        <Pressable onPress={goBack}>
          <Text style={{ color: colors.textPrimary, fontSize: 20 }}> ‹ </Text>
        </Pressable>

        <Text style={{ color: colors.textDim, fontSize: 12, fontFamily: fonts.bodyBold }}>STEP {step + 1} OF 5</Text>

        <Pressable onPress={() => router.replace("/(tabs)")}>
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: fonts.bodyMedium }}>Skip</Text>
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={{ flexDirection: "row", gap: 6, marginTop: 16, marginBottom: 22 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 99,
              backgroundColor: i <= step ? colors.teal : colors.border,
            }}
          />
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 26, fontFamily: fonts.heading, marginBottom: 8 }}>
          {STEP_TITLES[step]}
        </Text>
        <Text style={{ color: colors.textDim, fontSize: 14, marginBottom: 24, fontFamily: fonts.body }}>
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
                level={opt.level}
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
                    borderColor: selected ? colors.teal : colors.border,
                    backgroundColor: selected ? colors.tealSoft : colors.bgCard,
                  }}
                >
                  <Text style={{ color: selected ? colors.teal : colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: 13 }}>{item}</Text>
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
                    borderColor: selected ? colors.teal : colors.border,
                    backgroundColor: selected ? colors.tealSoft : colors.bgCard,
                  }}
                >
                  <Text style={{ color: selected ? colors.teal : colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: 13 }}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {error !== "" && <Text style={{ color: colors.danger, marginTop: 16, fontFamily: fonts.body }}>{error}</Text>}
      </ScrollView>

      {/* Bottom bar: back + Continue */}
      <View style={{ flexDirection: "row", gap: 12, paddingVertical: 20 }}>
        <Pressable
          onPress={goBack}
          style={{
            width: 52,
            height: 52,
            borderRadius: 18,
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
            borderRadius: 18,
            backgroundColor: canContinue() ? colors.teal : colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: canContinue() ? colors.tealOn : colors.textDim, fontFamily: fonts.bodyExtra, fontSize: 15 }}>
            {submitting ? "Saving..." : step === 4 ? "Finish" : "Continue"}
          </Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}
