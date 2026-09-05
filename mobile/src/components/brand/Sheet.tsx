// src/components/brand/Sheet.tsx
// Bottom sheet: flat-bottomed, slides up from the bottom (BRAND_GUIDE.md
// shape/motion — sheetUp, 300ms).
import { useEffect } from "react";
import { Modal, Pressable, View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { motion } from "../../constants/theme";

export function Sheet({
  visible,
  onClose,
  children,
  maxHeightPct = 70,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightPct?: number;
}) {
  const { colors, shape } = useTheme();
  const translateY = useSharedValue(400);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: motion.sheetUp });
    }
  }, [visible]);

  const handleClose = () => {
    translateY.value = withTiming(400, { duration: motion.sheetUp }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Animated.View
          style={[
            {
              maxHeight: `${maxHeightPct}%`,
              backgroundColor: colors.bg,
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 24,
            },
            shape.sheetTop,
            styles.sheet,
            animatedStyle,
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 999,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: 14,
              }}
            />
            {children}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
  },
});
