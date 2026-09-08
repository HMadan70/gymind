import { View, ViewProps, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { shapeTokens } from "../constants/theme";

type CardShape = "hero" | "secondary" | "bottomSheet" | "modal";

type CardProps = ViewProps & {
  shape: CardShape;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

const shapeMap = {
  hero: shapeTokens.heroCard,
  secondary: shapeTokens.secondaryCard,
  bottomSheet: shapeTokens.bottomSheet,
  modal: shapeTokens.modal,
} as const;

export function Card({ shape, style, children, ...rest }: CardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        { backgroundColor: colors.bgCard },
        shapeMap[shape],
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}