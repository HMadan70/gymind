// src/components/brand/Chip.tsx
// True pill-shaped tap target (equipment/diet multi-select, quick-prompt
// chips, badges) — see Button.tsx for why large CTA buttons are NOT pills.
import { Pressable, Text } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../constants/theme";

export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primarySoft : colors.card,
      }}
    >
      <Text
        style={{
          color: selected ? colors.primary : colors.text,
          fontFamily: fonts.bodyBold,
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
