import { View, Text } from "react-native";
import { useTheme } from "../context/ThemeContext";

type StatCardProps = {
  label: string;
  value: string | number;
};

export function StatCard({ label, value }: StatCardProps) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, flex: 1 }}>
      <Text style={{ color: colors.textFaint, fontSize: 11, letterSpacing: 1 }}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "bold" }}>{value}</Text>
    </View>
  );
}