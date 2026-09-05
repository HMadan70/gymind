// src/components/brand/Card.tsx
import { View, ViewProps, ViewStyle } from "react-native";
import { useTheme } from "../../context/ThemeContext";

type CardVariant = "hero" | "card" | "plain";

export function Card({
  variant = "card",
  bordered = true,
  style,
  children,
  ...rest
}: ViewProps & { variant?: CardVariant; bordered?: boolean; style?: ViewStyle }) {
  const { colors, shape } = useTheme();

  const radius =
    variant === "hero" ? shape.heroCutCorner : variant === "card" ? shape.cardCutCorner : {};

  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderWidth: bordered ? 1 : 0,
          borderColor: colors.border,
        },
        radius,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
