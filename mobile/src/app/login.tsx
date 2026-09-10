import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../constants/theme";
import { API_URL } from "../constants/api";
import { signIn } from "../lib/session";
import Mark from "../assets/mark.svg";
import { Button } from "../components/Button";
import { useAsyncGuard } from "../lib/asyncGuard";

export default function Login() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const submitGuard = useAsyncGuard();

  async function handleSubmit() {
    setError("");
    await submitGuard.run(async () => {
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
        await signIn(data.access_token);
        router.replace("/checkOnboarding");
      } catch {
        setError("Could not reach the server");
      }
    });
  }

  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.bgBase, colors.bgBase, colors.gradientBottom]}
      locations={[0, 0.3, 0.7, 1]}
      style={{ flex: 1, paddingTop: insets.top + 16, paddingHorizontal: 26, paddingBottom: 30 }}
    >

      <Mark width={52} height={52} style={{ marginBottom: 20 }} />

      <Text style={{ color: colors.textPrimary, fontSize: 28, marginBottom: 6, fontFamily: fonts.heading }}>Welcome back</Text>

      <Text style={{ color: colors.textDim, fontSize: 14, marginBottom: 28, fontFamily: fonts.body }}>Log your next session in seconds.</Text>

      {error ? <Text style={{ color: colors.danger, marginBottom: 12, fontFamily: fonts.body }}>{error}</Text> : null}

      <Text style={{ fontSize: 11, fontFamily: fonts.bodyExtra, color: colors.textDim, letterSpacing: 0.55, marginBottom: 6 }}>EMAIL OR USERNAME</Text>
      <TextInput
        placeholder="Email or username"
        placeholderTextColor={colors.textFaint}
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        style={{ width: "100%", borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.bgCard, marginBottom: 14 }}
      />

      <Text style={{ fontSize: 11, fontFamily: fonts.bodyExtra, color: colors.textDim, letterSpacing: 0.55, marginBottom: 6 }}>PASSWORD</Text>
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        paddingHorizontal: 16,
        backgroundColor: colors.bgCard,
      }}>
        <TextInput
          placeholder="Password"
          placeholderTextColor={colors.textFaint}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={{ flex: 1, paddingVertical: 14, fontSize: 14, color: colors.textPrimary }}
        />
        <Pressable onPress={() => setShowPassword(!showPassword)}>
          <Text style={{ color: colors.textDim, fontSize: 13, fontFamily: fonts.bodyMedium }}>{showPassword ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 22 }}>
        <Button
          label={submitGuard.pending ? "Logging in…" : "Log In"}
          onPress={handleSubmit}
          variant="primary"
          size="lg"
          disabled={submitGuard.pending}
        />
      </View>

      <View style={{ flex: 1 }} />

      <Link href="/register" style={{ paddingTop: 16, alignSelf: "center" }}>
        <Text style={{ color: colors.textDim, fontSize: 13, fontFamily: fonts.body }}>
          {"Don't have an account? "}<Text style={{ color: colors.teal, fontFamily: fonts.bodyExtra }}>Sign up</Text>
        </Text>
      </Link>

    </LinearGradient>
  );
}
