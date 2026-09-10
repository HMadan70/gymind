// src/components/Button.tsx
import { Pressable, Text } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../constants/theme";

type ButtonVariant = "primary" | "danger" | "secondary";
type ButtonSize = "sm" | "lg";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant: ButtonVariant;
  size?: ButtonSize; // defaults to "sm"
  disabled?: boolean;
  flex?: boolean; // true = flex: 1 (side-by-side pairs), false/undefined = width: "100%"
};

export function Button({
  label,
  onPress,
  variant,
  size = "sm",
  disabled = false,
  flex = false,
}: ButtonProps) {
  const { colors } = useTheme();

  const variantStyles = {
    primary: { background: colors.teal, textColor: colors.tealOn },
    danger: { background: colors.coral, textColor: colors.coralOn },
    secondary: { background: colors.bgInset, textColor: colors.textPrimary },
  }[variant];

  // lg matches the design source's primary button: 16px pad, 18px radius,
  // 15px label at weight 800.
  const sizeStyles = {
    sm: { padding: 12, borderRadius: 8, fontSize: 14, fontFamily: fonts.bodySemi },
    lg: { padding: 16, borderRadius: 18, fontSize: 15, fontFamily: fonts.bodyExtra },
  }[size];

  const background = disabled ? colors.border : variantStyles.background;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{
        backgroundColor: background,
        borderRadius: sizeStyles.borderRadius,
        padding: sizeStyles.padding,
        alignItems: "center",
        ...(flex ? { flex: 1 } : { width: "100%" }),
      }}
    >
      <Text style={{ color: variantStyles.textColor, fontFamily: sizeStyles.fontFamily, fontSize: sizeStyles.fontSize }}>
        {label}
      </Text>
    </Pressable>
  );
}