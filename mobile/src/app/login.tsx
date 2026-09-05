import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../constants/theme";
import { API_URL } from "../constants/api";
import { ScreenBackground } from "../components/brand/ScreenBackground";
import { AnimatedScreen } from "../components/brand/AnimatedScreen";
import { BrandMark } from "../components/brand/BrandMark";
import { Field } from "../components/brand/Field";
import { Button } from "../components/brand/Button";

export default function Login() {
  const { colors } = useTheme();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenBackground>
      <AnimatedScreen>
        <ScrollView
          contentContainerStyle={{ paddingTop: 64, paddingHorizontal: 26, paddingBottom: 30, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <BrandMark size={52} />

          <Text
            style={{
              fontFamily: fonts.headingBold,
              fontSize: 28,
              color: colors.text,
              marginTop: 20,
              marginBottom: 6,
            }}
          >
            Welcome back
          </Text>
          <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 14, color: colors.textDim, marginBottom: 28 }}>
            Log in to keep your streak going.
          </Text>

          {error ? (
            <Text style={{ color: colors.danger, marginBottom: 12, fontFamily: fonts.bodyMedium }}>{error}</Text>
          ) : null}

          <View style={{ gap: 14 }}>
            <Field
              label="Email or username"
              placeholder="you@example.com"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
            />
            <Field
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            {/* Intentional deviation from the design (kept from pre-Brand-2.0
                decision, PROJECT_STATUS.md Section 17): "Forgot?" sits on its
                own row below the password field rather than inline with the
                PASSWORD label. */}
            <Pressable style={{ alignSelf: "flex-end" }}>
              <Text style={{ color: colors.primary, fontSize: 12, fontFamily: fonts.bodyBold }}>Forgot?</Text>
            </Pressable>
          </View>

          <Button
            title="Log in"
            onPress={handleSubmit}
            loading={submitting}
            style={{ marginTop: 22 }}
          />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 22 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ fontSize: 11, color: colors.textDim, fontFamily: fonts.bodyBold }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          {/* Intentional deviation (Section 17): visually present but inert —
              no OAuth wired up. */}
          <View style={{ gap: 10 }}>
            <Button title="Continue with Apple" onPress={() => {}} variant="outline" />
            <Button title="Continue with Google" onPress={() => {}} variant="outline" />
          </View>

          <View style={{ flex: 1 }} />

          <Pressable onPress={() => router.push("/register")} style={{ paddingTop: 24 }}>
            <Text style={{ color: colors.textDim, fontSize: 13, textAlign: "center", fontFamily: fonts.bodyRegular }}>
              New here?{" "}
              <Text style={{ color: colors.primary, fontFamily: fonts.bodyExtraBold }}>Create account</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </AnimatedScreen>
    </ScreenBackground>
  );
}
