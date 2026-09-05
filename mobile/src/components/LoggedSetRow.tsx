import { View, Text, Pressable } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { setCircleBase } from "../constants/theme";

type LoggedSetRowProps = {
  index: number;
  weight: number;
  reps: number;
  onUncomplete: () => void;
};

export function LoggedSetRow({ index, weight, reps, onUncomplete }: LoggedSetRowProps) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
      <Text style={{ color: colors.textDim, width: 24 }}>{String(index + 1).padStart(2, "0")}</Text>
      <Text style={{ color: colors.textPrimary, flex: 1 }}>
        {weight} lb × {reps}
      </Text>
      <Pressable
        onPress={onUncomplete}
        style={{ ...setCircleBase, backgroundColor: colors.teal }}
      >
        <Text style={{ color: colors.tealOn }}>✓</Text>
      </Pressable>
    </View>
  );
}
