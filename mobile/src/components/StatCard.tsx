import { View, Text } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../constants/theme";

type StatCardProps = {
  label: string;
  value: string | number;
};

// Stat cards are uniform 18px rounded rects per the design source — not
// cut-corner. The cut corner is reserved for hero/feature containers.
export function StatCard({ label, value }: StatCardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 18,
        padding: 12,
        backgroundColor: colors.bgCard,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
      }}
    >
      <Text style={{ color: colors.textDim, fontSize: 10, fontFamily: fonts.bodyBold, letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 17, fontFamily: fonts.heading, marginTop: 2 }}>{value}</Text>
    </View>
  );
}
