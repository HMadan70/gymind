import { useEffect } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../context/ThemeContext";

const API_URL = "http://localhost:8000";

export default function CheckOnboarding() {
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    async function check() {
      const token = await AsyncStorage.getItem("token");

      const response = await fetch(`${API_URL}/users/onboarding-check`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        router.replace("/");
      } else {
        router.replace("/onboarding");
      }
    }
    check();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bgBase }}>
      <Text style={{ color: colors.textPrimary }}>Checking your account...</Text>
    </View>
  );
}