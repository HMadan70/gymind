// src/components/ConfirmModal.tsx
import { useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { Card } from "./Card";

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmColor: string;
  confirmTextColor: string;
  onConfirm: () => void | Promise<void>;
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

  // Every current and future caller of this component gets this guard for
  // free - it used to have none at all. `inFlight` (a ref) is what actually
  // blocks a second tap: it mutates the instant the first tap is handled,
  // with no window for a fast double-tap to fire onConfirm twice before a
  // re-render could ever apply `disabled`. `isConfirming` (state) only
  // drives the visual dimmed/disabled look.
  const inFlight = useRef(false);
  const [isConfirming, setIsConfirming] = useState(false);

  if (!visible) return null;

  const handleConfirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      inFlight.current = false;
      setIsConfirming(false);
    }
  };

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
      <Card shape="modal" style={{ padding: 20, width: "100%", maxWidth: 340 }}>
        <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 18, marginBottom: 8 }}>
          {title}
        </Text>
        <Text style={{ color: colors.textDim, marginBottom: 20 }}>
          {description}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={onCancel}
            disabled={isConfirming}
            style={{
              flex: 1,
              backgroundColor: colors.bgInset,
              borderRadius: 8,
              padding: 12,
              alignItems: "center",
              opacity: isConfirming ? 0.5 : 1,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            disabled={isConfirming}
            style={{
              flex: 1,
              backgroundColor: confirmColor,
              borderRadius: 8,
              padding: 12,
              alignItems: "center",
              opacity: isConfirming ? 0.5 : 1,
            }}
          >
            <Text style={{ color: confirmTextColor, fontWeight: "600" }}>
              {isConfirming ? "Working…" : confirmLabel}
            </Text>
          </Pressable>
        </View>
      </Card>
    </View>
  );
}