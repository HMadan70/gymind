import { View, Text, Pressable, TextInput, ScrollView } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useState } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChevronLeft } from "lucide-react-native";
import { API_URL } from "../constants/api";
import { fonts } from "../constants/theme";
import { ScreenBackground } from "../components/brand/ScreenBackground";
import { AnimatedScreen } from "../components/brand/AnimatedScreen";
import { Chip } from "../components/brand/Chip";
import { Button } from "../components/brand/Button";

const TOKEN_KEY = "token";

type FormData = {
  goal: string;
  experience_level: string;
  injuries: string;
  equipment: string[];
  dietary_restrictions: string[];
};

const GOAL_OPTIONS = [
  { value: "lose_weight", title: "Lose weight", subtitle: "Fat loss with muscle retention" },
  { value: "build_muscle", title: "Build muscle", subtitle: "Hypertrophy & progressive overload" },
  { value: "maintain", title: "Maintain", subtitle: "Stay consistent & healthy" },
];

const EXPERIENCE_OPTIONS = [
  { value: "beginner", title: "Beginner", subtitle: "New to structured training" },
  { value: "intermediate", title: "Intermediate", subtitle: "6+ months consistent training" },
  { value: "advanced", title: "Advanced", subtitle: "Years of consistent training" },
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

// Single-select card (goal, experience) — dot indicator matches
// Gymind UI.dc.html's goalOptions cardStyle/dotStyle.
function OptionCard({
  title,
  subtitle,
  selected,
  onPress,
  showDot,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  showDot?: boolean;
}) {
  const { colors } = useTheme();
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
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primarySoft : colors.card,
      }}
    >
      {showDot ? (
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: selected ? colors.primary : colors.cardAlt,
            borderWidth: 2,
            borderColor: selected ? colors.primary : colors.border,
          }}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 15 }}>{title}</Text>
        <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2, fontFamily: fonts.bodyRegular }}>
          {subtitle}
        </Text>
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
      const next = current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
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

      router.replace("/");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const continuable = canContinue();

  return (
    <ScreenBackground>
      <View style={{ flex: 1, paddingTop: 64, paddingHorizontal: 22, paddingBottom: 22 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            onPress={goBack}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              alignItems: "center",
              justifyContent: "center",
              opacity: step === 0 ? 0 : 1,
            }}
          >
            <ChevronLeft size={16} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: colors.cardAlt, overflow: "hidden" }}>
            <View
              style={{
                height: "100%",
                borderRadius: 999,
                backgroundColor: colors.primary,
                width: `${((step + 1) / 5) * 100}%`,
              }}
            />
          </View>
          <Text style={{ fontSize: 12, color: colors.textDim, fontFamily: fonts.bodyBold }}>
            {["Goal", "Level", "Injuries", "Equipment", "Diet"][step]}
          </Text>
          <Pressable onPress={() => router.replace("/")}>
            <Text style={{ color: colors.textDim, fontSize: 12, fontFamily: fonts.bodyBold }}>Skip</Text>
          </Pressable>
        </View>

        <AnimatedScreen screenKey={step} style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 26, color: colors.text, marginTop: 22, marginBottom: 8 }}>
              {STEP_TITLES[step]}
            </Text>
            <Text style={{ color: colors.textDim, fontSize: 14, marginBottom: 24, fontFamily: fonts.bodyRegular }}>
              {STEP_SUBTITLES[step]}
            </Text>

            {step === 0 && (
              <View style={{ gap: 12 }}>
                {GOAL_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt.value}
                    title={opt.title}
                    subtitle={opt.subtitle}
                    selected={formData.goal === opt.value}
                    onPress={() => setFormData({ ...formData, goal: opt.value })}
                    showDot
                  />
                ))}
              </View>
            )}

            {step === 1 && (
              <View style={{ gap: 12 }}>
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt.value}
                    title={opt.title}
                    subtitle={opt.subtitle}
                    selected={formData.experience_level === opt.value}
                    onPress={() => setFormData({ ...formData, experience_level: opt.value })}
                  />
                ))}
              </View>
            )}

            {step === 2 && (
              <TextInput
                value={formData.injuries}
                onChangeText={(text) => setFormData({ ...formData, injuries: text })}
                placeholder="e.g. left knee, minor — leave blank if none"
                placeholderTextColor={colors.textDim}
                multiline
                style={{
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 20,
                  padding: 16,
                  color: colors.text,
                  minHeight: 140,
                  textAlignVertical: "top",
                  fontFamily: fonts.bodyRegular,
                  fontSize: 14,
                }}
              />
            )}

            {step === 3 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {EQUIPMENT_OPTIONS.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={formData.equipment.includes(item)}
                    onPress={() => toggleArrayItem("equipment", item)}
                  />
                ))}
              </View>
            )}

            {step === 4 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {DIETARY_OPTIONS.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={formData.dietary_restrictions.includes(item)}
                    onPress={() => toggleArrayItem("dietary_restrictions", item)}
                  />
                ))}
              </View>
            )}

            {error !== "" && (
              <Text style={{ color: colors.danger, marginTop: 16, fontFamily: fonts.bodyMedium }}>{error}</Text>
            )}
          </ScrollView>
        </AnimatedScreen>

        <View style={{ paddingTop: 16 }}>
          <Button
            title={submitting ? "Saving..." : step === 4 ? "Let's go" : "Continue"}
            onPress={goNext}
            disabled={!continuable || submitting}
            loading={submitting}
          />
        </View>
      </View>
    </ScreenBackground>
  );
}
