import { View, Text, Pressable } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { setCircleBase } from "../constants/theme";
import { Check } from "lucide-react-native";

type LoggedSetRowProps = {
  index: number;
  weight: number;
  reps: number;
  onUncomplete: () => void;
  // True while this specific set's sync request is in flight - blocks a
  // second tap synchronously (see src/lib/asyncGuard.ts), not just visually.
  disabled?: boolean;
};

export function LoggedSetRow({ index, weight, reps, onUncomplete, disabled = false }: LoggedSetRowProps) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
      <Text style={{ color: colors.textDim, width: 24 }}>{String(index + 1).padStart(2, "0")}</Text>
      <Text style={{ color: colors.textPrimary, flex: 1 }}>
        {weight} lb × {reps}
      </Text>
      <Pressable
        onPress={onUncomplete}
        disabled={disabled}
        style={{ ...setCircleBase, backgroundColor: colors.teal, opacity: disabled ? 0.5 : 1 }}
      >
        <Check size={16} color={colors.tealOn} />
      </Pressable>
    </View>
  );
}
