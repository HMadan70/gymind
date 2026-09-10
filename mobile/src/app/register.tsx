import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../constants/theme";
import { API_URL } from "../constants/api";
import Mark from "../assets/mark.svg";
import { Check } from "lucide-react-native";
import { Button } from "../components/Button";
import { signIn } from "../lib/session";
import { useAsyncGuard } from "../lib/asyncGuard";

export default function Register() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const submitGuard = useAsyncGuard();

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
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthLabel = password.length > 0 ? strengthLabels[strength] : "";

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

    await submitGuard.run(async () => {
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
        await signIn(data.access_token);
        router.replace("/checkOnboarding");
      } catch {
        setError("An error occurred");
      }
    });
  }

  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.bgBase, colors.bgBase, colors.gradientBottom]}
      locations={[0, 0.3, 0.7, 1]}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 26, paddingBottom: 30, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

      <Link href="/login" style={{ marginBottom: 20 }}>
        <Text style={{ color: colors.textDim, fontSize: 13, fontFamily: fonts.body }}>‹ Log in</Text>
      </Link>

      <Mark width={52} height={52} style={{ marginBottom: 20 }} />

      <Text style={{ color: colors.textPrimary, fontSize: 28, marginBottom: 6, fontFamily: fonts.heading }}>
        Create your account
      </Text>
      <Text style={{ color: colors.textDim, fontSize: 14, marginBottom: 24, fontFamily: fonts.body }}>
        Two minutes, then straight into onboarding.
      </Text>

      {error ? <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}

      <Text style={{ fontSize: 11, fontFamily: fonts.bodyExtra, color: colors.textDim, letterSpacing: 0.55, marginBottom: 6 }}>USERNAME</Text>
      <TextInput
        placeholder="alex.mercer"
        placeholderTextColor={colors.textFaint}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        style={{ width: "100%", borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.bgCard, marginBottom: 14 }}
      />

      <Text style={{ fontSize: 11, fontFamily: fonts.bodyExtra, color: colors.textDim, letterSpacing: 0.55, marginBottom: 6 }}>EMAIL</Text>
      <TextInput
        placeholder="alex.mercer@email.com"
        placeholderTextColor={colors.textFaint}
        value={email}
        onChangeText={setEmail}
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

      {/* Password strength meter — 4 segments, filled based on score */}
      <View style={{ flexDirection: "row", gap: 5, marginTop: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 99,
              backgroundColor: i < strength ? colors.teal : colors.border,
            }}
          />
        ))}
      </View>
      {strengthLabel !== "" && (
        <Text style={{ color: colors.textDim, fontSize: 13, marginTop: 6, fontFamily: fonts.body }}>
          {strengthLabel}
          {strength < 4 ? " — add more variety for max strength." : ""}
        </Text>
      )}

      <Text style={{ fontSize: 11, fontFamily: fonts.bodyExtra, color: colors.textDim, letterSpacing: 0.55, marginTop: 14, marginBottom: 6 }}>
        CONFIRM PASSWORD
      </Text>
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
          placeholder="Confirm password"
          placeholderTextColor={colors.textFaint}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirmPassword}
          style={{ flex: 1, paddingVertical: 14, fontSize: 14, color: colors.textPrimary }}
        />
        <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
          <Text style={{ color: colors.textDim, fontSize: 13, fontFamily: fonts.bodyMedium }}>{showConfirmPassword ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>

      {/* Terms checkbox */}
      <Pressable
        onPress={() => setAgreedToTerms(!agreedToTerms)}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20, marginBottom: 24 }}
      >
        <View style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: agreedToTerms ? colors.teal : colors.border,
          backgroundColor: agreedToTerms ? colors.teal : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {agreedToTerms && <Check size={13} color={colors.tealOn} />}
        </View>
        <Text style={{ color: colors.textDim, flex: 1, fontSize: 13, fontFamily: fonts.body }}>
          I agree to the <Text style={{ color: colors.teal, fontFamily: fonts.bodyBold }}>Terms</Text> and{" "}
          <Text style={{ color: colors.teal, fontFamily: fonts.bodyBold }}>Privacy Policy</Text>.
        </Text>
      </Pressable>

      <View style={{ marginTop: 22 }}>
        <Button
          label={submitGuard.pending ? "Creating account…" : "Create account"}
          onPress={handleSubmit}
          variant="primary"
          size="lg"
          disabled={submitGuard.pending}
        />
      </View>

      <View style={{ flex: 1 }} />

      <Link href="/login" style={{ paddingTop: 16, alignSelf: "center" }}>
        <Text style={{ color: colors.textDim, fontSize: 13, fontFamily: fonts.body }}>
          Already have an account? <Text style={{ color: colors.teal, fontFamily: fonts.bodyExtra }}>Log in</Text>
        </Text>
      </Link>
      </ScrollView>
    </LinearGradient>
  );
}
