import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";

export default function Coach() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top,
        backgroundColor: colors.bgBase,
      }}
    >
      <View style={{ paddingHorizontal: 20, paddingVertical: 18 }}>
        <Text
          accessibilityRole="header"
          style={{
            color: colors.textPrimary,
            fontFamily: fonts.heading,
            fontSize: 28,
          }}
        >
          Coach
        </Text>
        <Text
          style={{
            marginTop: 8,
            color: colors.textDim,
            fontFamily: fonts.body,
            fontSize: 15,
          }}
        >
          Coach is being rebuilt.
        </Text>
      </View>
    </View>
  );
}
