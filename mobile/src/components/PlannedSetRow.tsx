import { View, Text } from "react-native";
import { useTheme } from "../context/ThemeContext";

type PlannedSetRowProps = {
  index: number;
  plannedWeight?: number;
  plannedReps?: number;
};

export function PlannedSetRow({ index, plannedWeight, plannedReps }: PlannedSetRowProps) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, opacity: 0.5 }}>
      <Text style={{ color: colors.textFaint, width: 24 }}>{String(index + 1).padStart(2, "0")}</Text>
      <Text style={{ color: colors.textFaint }}>
        {plannedWeight ?? "-"} lb × {plannedReps ?? "-"}
      </Text>
    </View>
  );
}
