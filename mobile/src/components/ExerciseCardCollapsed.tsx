// src/components/ExerciseCard.tsx
import { View, Text, Pressable } from "react-native";
import { useTheme } from "../context/ThemeContext";

type ExerciseCardCollapsedProps = {
  name: string;
  isQueued: boolean;
  isFullyCompleted: boolean;
  totalSets: number;
  completedSets: number;
  onToggleExpand: () => void;
  onRemove: () => void;
};

export function ExerciseCardCollapsed({
  name,
  isQueued,
  isFullyCompleted,
  totalSets,
  completedSets,
  onToggleExpand,
  onRemove,
}: ExerciseCardCollapsedProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.bgCard,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
      }}
    >
      <Pressable onPress={onToggleExpand} style={{ flex: 1 }}>
        <Text style={{ color: isQueued ? colors.textFaint : colors.textPrimary, fontWeight: "bold" }}>
          {name}
        </Text>
        {isQueued ? (
          <Text style={{ color: colors.textFaint, fontSize: 12, letterSpacing: 1, marginTop: 4 }}>
            {`QUEUED · ${totalSets} SET${totalSets === 1 ? "" : "S"}`}
          </Text>
        ) : isFullyCompleted ? (
          <Text style={{ color: colors.teal, fontSize: 12, letterSpacing: 1, marginTop: 4 }}>
            {`COMPLETED · ${completedSets}/${totalSets} SET${totalSets === 1 ? "" : "S"}`}
          </Text>
        ) : (
          <Text style={{ color: colors.textFaint, fontSize: 12, letterSpacing: 1, marginTop: 4 }}>
            {`IN PROGRESS · ${completedSets}/${totalSets} SET${totalSets === 1 ? "" : "S"}`}
          </Text>
        )}
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {isFullyCompleted ? (
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: colors.teal,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.tealOn, fontSize: 14 }}>✓</Text>
          </View>
        ) : (
          <Text style={{ color: colors.textFaint, fontSize: 20 }}>›</Text>
        )}

        <Pressable onPress={onRemove} hitSlop={8}>
          <Text style={{ color: colors.textFaint, fontSize: 16 }}>🗑</Text>
        </Pressable>
      </View>
    </View>
  );
}