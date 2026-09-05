// src/components/Button.tsx
import { Pressable, Text } from "react-native";
import { useTheme } from "../context/ThemeContext";

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

  const sizeStyles = {
    sm: { padding: 12, borderRadius: 8 },
    lg: { padding: 16, borderRadius: 12 },
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
      <Text style={{ color: variantStyles.textColor, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}