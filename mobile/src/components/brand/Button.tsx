// src/components/brand/Button.tsx
// NOTE: BRAND_GUIDE.md's prose says tap targets are "fully rounded (pill)",
// but the literal Gymind UI.dc.html markup uses a finite 16-18px radius on
// every large CTA button (login/register/onboarding submit, workout
// start/pause/resume) - only small badges/chips/the tab-bar indicator are
// true pills (999). Followed the .dc.html literal value here since fidelity
// to that file is the explicit spec; see Chip.tsx for the true-pill cases.
import { Pressable, Text, ActivityIndicator, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../constants/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
  fullWidth = true,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "secondary"
      ? colors.secondary
      : variant === "danger"
      ? colors.danger
      : variant === "outline"
      ? colors.card
      : "transparent";

  const textColor =
    variant === "primary" || variant === "secondary" || variant === "danger"
      ? colors.onPrimary
      : variant === "outline"
      ? colors.text
      : colors.textDim;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          width: fullWidth ? "100%" : undefined,
          paddingVertical: 16,
          paddingHorizontal: 24,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: colors.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={{ color: textColor, fontFamily: fonts.bodyExtraBold, fontSize: 15 }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
