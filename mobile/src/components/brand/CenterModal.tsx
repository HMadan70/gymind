// src/components/brand/CenterModal.tsx
// Centered modal: uniform rounded rect, pops in from center (popIn, 300ms) —
// distinct from Sheet's slide-up, per BRAND_GUIDE.md "never both use the
// same motion."
import { useEffect } from "react";
import { Modal, Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { motion } from "../../constants/theme";

export function CenterModal({
  visible,
  onClose,
  children,
  widthPct = 80,
  dismissable = true,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  widthPct?: number;
  dismissable?: boolean;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withTiming(1, { duration: motion.popIn });
      opacity.value = withTiming(1, { duration: motion.popIn });
    } else {
      scale.value = 0.85;
      opacity.value = 0;
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={dismissable ? onClose : undefined}
      >
        <Animated.View
          style={[
            {
              width: `${widthPct}%`,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 24,
              padding: 24,
            },
            animatedStyle,
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>{children}</Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});
