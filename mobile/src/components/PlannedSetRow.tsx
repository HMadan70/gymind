import { View, Text, Pressable } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { setCircleBase } from "../constants/theme";

type PlannedSetRowProps = {
  index: number;
  plannedWeight?: number;
  plannedReps?: number;
  // Present only when both plannedWeight and plannedReps are real,
  // loggable numbers - tapping the circle logs this set with exactly
  // those values in one step, rather than requiring "+ SET" then typing
  // in the same numbers already shown on this row. Omitted (no circle)
  // when there's nothing valid to log yet.
  onComplete?: () => void;
  disabled?: boolean;
};

export function PlannedSetRow({ index, plannedWeight, plannedReps, onComplete, disabled = false }: PlannedSetRowProps) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
      <Text style={{ color: colors.textFaint, width: 24, opacity: 0.5 }}>{String(index + 1).padStart(2, "0")}</Text>
      <Text style={{ color: colors.textFaint, opacity: 0.5, flex: 1 }}>
        {plannedWeight ?? "-"} lb × {plannedReps ?? "-"}
      </Text>

      {onComplete && (
        <Pressable
          onPress={() => {
            if (!disabled) onComplete();
          }}
          disabled={disabled}
          style={{
            ...setCircleBase,
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: colors.border,
            opacity: disabled ? 0.5 : 1,
          }}
        />
      )}
    </View>
  );
}
