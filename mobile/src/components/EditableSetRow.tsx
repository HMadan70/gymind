import { View, Text, Pressable, TextInput } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { setCircleBase } from "../constants/theme";

type EditableSetRowProps = {
  index: number;
  weightText: string;
  repsText: string;
  onChangeWeightText: (text: string) => void;
  onChangeRepsText: (text: string) => void;
  canComplete?: boolean;
  onComplete?: () => void;
  // Live logging shows the tick circle that marks a set done. Editing a
  // past workout reuses the same row for weight/reps, but there's
  // nothing to complete there, so the circle is omitted.
  showComplete?: boolean;
  // True while this specific set's sync request is in flight - blocks a
  // second tap synchronously (see src/lib/asyncGuard.ts), not just visually.
  disabled?: boolean;
};

export function EditableSetRow({
  index,
  weightText,
  repsText,
  onChangeWeightText,
  onChangeRepsText,
  canComplete = false,
  onComplete,
  showComplete = true,
  disabled = false,
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

      {showComplete && (
        <Pressable
          onPress={() => {
            if (canComplete && onComplete && !disabled) onComplete();
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
