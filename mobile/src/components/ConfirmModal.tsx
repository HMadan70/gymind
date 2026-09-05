// src/components/ConfirmModal.tsx
import { View, Text, Pressable } from "react-native";
import { useTheme } from "../context/ThemeContext";

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmColor: string;
  confirmTextColor: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  visible,
  title,
  description,
  confirmLabel,
  confirmColor,
  confirmTextColor,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
      }}
    >
      <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 20, width: "100%", maxWidth: 340 }}>
        <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 18, marginBottom: 8 }}>
          {title}
        </Text>
        <Text style={{ color: colors.textDim, marginBottom: 20 }}>
          {description}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={onCancel}
            style={{ flex: 1, backgroundColor: colors.bgInset, borderRadius: 8, padding: 12, alignItems: "center" }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            style={{ flex: 1, backgroundColor: confirmColor, borderRadius: 8, padding: 12, alignItems: "center" }}
          >
            <Text style={{ color: confirmTextColor, fontWeight: "600" }}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}