import { View, Text, Pressable, TextInput } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { setCircleBase } from "../constants/theme";

type EditableSetRowProps = {
  index: number;
  weightText: string;
  repsText: string;
  onChangeWeightText: (text: string) => void;
  onChangeRepsText: (text: string) => void;
  canComplete: boolean;
  onComplete: () => void;
};

export function EditableSetRow({
  index,
  weightText,
  repsText,
  onChangeWeightText,
  onChangeRepsText,
  canComplete,
  onComplete,
}: EditableSetRowProps) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
      <Text style={{ color: colors.textDim, width: 24 }}>{String(index + 1).padStart(2, "0")}</Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.bgInset,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          marginRight: 8,
          borderWidth: 1,
          borderColor: colors.teal,
        }}
      >
        <TextInput
          value={weightText}
          onChangeText={onChangeWeightText}
          placeholder="0"
          placeholderTextColor={colors.textFaint}
          style={{ color: colors.textPrimary, width: 40 }}
          keyboardType="decimal-pad"
        />
        <Text style={{ color: colors.textFaint, marginLeft: 4 }}>lb</Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.bgInset,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          marginRight: 8,
          borderWidth: 1,
          borderColor: colors.teal,
        }}
      >
        <TextInput
          value={repsText}
          onChangeText={onChangeRepsText}
          placeholder="0"
          placeholderTextColor={colors.textFaint}
          style={{ color: colors.textPrimary, width: 40 }}
          keyboardType="number-pad"
        />
        <Text style={{ color: colors.textFaint, marginLeft: 4 }}>rp</Text>
      </View>

      <Pressable
        onPress={() => {
          if (canComplete) onComplete();
        }}
        style={{
          ...setCircleBase,
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />
    </View>
  );
}
