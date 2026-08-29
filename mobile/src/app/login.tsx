import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { Link, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../context/ThemeContext";
import Mark from "../assets/mark.svg";

const API_URL = "http://localhost:8000";

export default function Login() {
  const { colors } = useTheme();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      if (!response.ok) {
        setError("Invalid email/username or password");
        return;
      }

      const data = await response.json();
      await AsyncStorage.setItem("token", data.access_token);
      router.replace("/");
    } catch (err) {
      setError("Could not reach the server");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, paddingTop: 60, paddingHorizontal: 20 }}>

      <Mark width={72} height={72}> </Mark>

      <Text style={{ color: colors.textPrimary, fontSize: 32, marginTop: 24, marginBottom: 8, fontWeight: "bold" }}>Welcome back</Text>

      <Text style={{ color: colors.textDim, fontSize: 15, marginBottom: 24 }}>Log your next session in seconds.</Text>

      {error ? <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}

      <Text style={{ fontSize: 12, color: colors.textDim, letterSpacing: 1, marginBottom: 8 }}>EMAIL OR USERNAME</Text>
      <TextInput
        placeholder="Email or username"
        placeholderTextColor={colors.textFaint}
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        style={{ width: "100%", borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.textPrimary, marginBottom: 12 }}
      />

      <Text style={{ fontSize: 12, color: colors.textDim, letterSpacing: 1, marginBottom: 8 }}>PASSWORD</Text>
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 12,
      }}>
        <TextInput
          placeholder="Password"
          placeholderTextColor={colors.textFaint}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={{ flex: 1, paddingVertical: 12, color: colors.textPrimary }}
        />
        <Pressable onPress={() => setShowPassword(!showPassword)}>
          <Text style={{ color: colors.textDim }}>{showPassword ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 8, marginBottom: 20 }}>
        <Text style={{ color: colors.accent }}>Forgot?</Text>
      </View>

      <Pressable
        onPress={handleSubmit}
        style={{ backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, width: "100%", alignItems: "center" }}
      >
        <Text style={{ color: colors.on, fontWeight: "600" }}>Log In</Text>
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 24 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ color: colors.textDim, marginHorizontal: 12 }}>OR</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
        <Pressable
          onPress={() => {}}
          style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundColor: colors.bgCard }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>Apple</Text>
        </Pressable>
        <Pressable
          onPress={() => {}}
          style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundColor: colors.bgCard }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>Google</Text>
        </Pressable>
      </View>

      <Link href="/register" style={{ marginTop: 16 }}>
        <Text style={{ color: colors.textDim }}>
          Don't have an account? <Text style={{ color: colors.accent }}>Sign up</Text>
        </Text>
      </Link>

    </View>
  );
}