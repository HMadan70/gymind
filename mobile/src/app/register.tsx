import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChevronLeft, Check } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../constants/theme";
import { API_URL } from "../constants/api";
import { ScreenBackground } from "../components/brand/ScreenBackground";
import { AnimatedScreen } from "../components/brand/AnimatedScreen";
import { BrandMark } from "../components/brand/BrandMark";
import { Field } from "../components/brand/Field";
import { Button } from "../components/brand/Button";

export default function Register() {
  const { colors } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Password strength: 0-4, based on simple checks (length, uppercase, number, symbol)
  function getPasswordStrength(pw: string) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  }

  const strength = getPasswordStrength(password);
  const segmentColor =
    strength <= 1 ? colors.danger : strength <= 2 ? colors.secondary : colors.primary;

  async function handleSubmit() {
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must include at least one uppercase letter");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!agreedToTerms) {
      setError("You must agree to the Terms and Privacy Policy");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });

      if (!response.ok) {
        setError("Registration failed");
        return;
      }

      const data = await response.json();
      await AsyncStorage.setItem("token", data.access_token);
      router.replace("/checkOnboarding");
    } catch (err) {
      setError("An error occurred");
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
          <Pressable
            onPress={() => router.push("/login")}
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 20, alignSelf: "flex-start" }}
          >
            <ChevronLeft size={16} color={colors.textDim} />
            <Text style={{ color: colors.textDim, fontSize: 13, fontFamily: fonts.bodyBold }}>Log in</Text>
          </Pressable>

          <BrandMark size={52} />

          <Text
            style={{ fontFamily: fonts.headingBold, fontSize: 28, color: colors.text, marginTop: 20, marginBottom: 6 }}
          >
            Create account
          </Text>
          <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 14, color: colors.textDim, marginBottom: 24 }}>
            Start tracking in under a minute.
          </Text>

          {error ? (
            <Text style={{ color: colors.danger, marginBottom: 12, fontFamily: fonts.bodyMedium }}>{error}</Text>
          ) : null}

          <View style={{ gap: 14 }}>
            <Field label="Username" placeholder="yourname" value={username} onChangeText={setUsername} autoCapitalize="none" />
            <Field label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <View>
              <Field
                label="Password"
                placeholder="8+ characters, 1 uppercase"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <View style={{ flexDirection: "row", gap: 5, marginTop: 8 }}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 5,
                      borderRadius: 999,
                      backgroundColor: i < strength ? segmentColor : colors.cardAlt,
                    }}
                  />
                ))}
              </View>
            </View>
            <Field
              label="Confirm password"
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <Pressable
            onPress={() => setAgreedToTerms(!agreedToTerms)}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                borderWidth: 1.5,
                borderColor: agreedToTerms ? colors.primary : colors.border,
                backgroundColor: agreedToTerms ? colors.primary : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {agreedToTerms && <Check size={13} color={colors.onPrimary} strokeWidth={3} />}
            </View>
            <Text style={{ color: colors.textDim, flex: 1, fontSize: 12, fontFamily: fonts.bodyRegular }}>
              I agree to the <Text style={{ color: colors.primary, fontFamily: fonts.bodyBold }}>Terms</Text> and{" "}
              <Text style={{ color: colors.primary, fontFamily: fonts.bodyBold }}>Privacy Policy</Text>.
            </Text>
          </Pressable>

          <Button title="Create account" onPress={handleSubmit} loading={submitting} style={{ marginTop: 22 }} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 22 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ fontSize: 11, color: colors.textDim, fontFamily: fonts.bodyBold }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          <View style={{ gap: 10 }}>
            <Button title="Continue with Apple" onPress={() => {}} variant="outline" />
            <Button title="Continue with Google" onPress={() => {}} variant="outline" />
          </View>

          <View style={{ flex: 1 }} />

          <Pressable onPress={() => router.push("/login")} style={{ paddingTop: 24 }}>
            <Text style={{ color: colors.textDim, fontSize: 13, textAlign: "center", fontFamily: fonts.bodyRegular }}>
              Already have an account?{" "}
              <Text style={{ color: colors.primary, fontFamily: fonts.bodyExtraBold }}>Log in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </AnimatedScreen>
    </ScreenBackground>
  );
}
