import { View, Text } from "react-native";
import { useTheme } from "../../context/ThemeContext";


export default function Progress() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bgBase }}>
      <Text style={{ color: colors.textPrimary }}>Progress</Text>
    </View>
  );
}