import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChevronLeft, LogOut, Moon, Sun } from "lucide-react-native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../constants/theme";
import { ScreenBackground } from "../../components/brand/ScreenBackground";
import { AnimatedScreen } from "../../components/brand/AnimatedScreen";
import { Card } from "../../components/brand/Card";

export default function Settings() {
  const { colors, mode, setMode } = useTheme();
  const router = useRouter();
  const isDark = mode === "dark";

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    router.replace("/login");
  };

  return (
    <ScreenBackground>
      <AnimatedScreen>
        <View style={{ paddingTop: 64, paddingHorizontal: 20, gap: 16 }}>
          <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <ChevronLeft size={18} color={colors.textDim} />
            <Text style={{ color: colors.textDim, fontFamily: fonts.bodyBold, fontSize: 13 }}>Back</Text>
          </Pressable>

          <Text style={{ fontFamily: fonts.headingBold, fontSize: 24, color: colors.text }}>Settings</Text>

          <Card
            variant="card"
            style={{ padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {isDark ? <Moon size={18} color={colors.text} /> : <Sun size={18} color={colors.text} />}
              <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 14 }}>
                {isDark ? "Dark mode" : "Light mode"}
              </Text>
            </View>
            <Pressable
              onPress={() => setMode(isDark ? "light" : "dark")}
              style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}
            >
              <Text style={{ color: colors.primary, fontFamily: fonts.bodyExtraBold, fontSize: 12 }}>Toggle</Text>
            </Pressable>
          </Card>

          <Pressable onPress={logout}>
            <Card
              variant="card"
              style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <LogOut size={18} color={colors.danger} />
              <Text style={{ color: colors.danger, fontFamily: fonts.bodyBold, fontSize: 14 }}>Log out</Text>
            </Card>
          </Pressable>
        </View>
      </AnimatedScreen>
    </ScreenBackground>
  );
}
