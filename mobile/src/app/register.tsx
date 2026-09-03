import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { Link, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../context/ThemeContext";
import { API_URL } from "../constants/api";
import Mark from "../assets/mark.svg";

export default function Register() {
  const { colors } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");

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
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, paddingTop: 60, paddingHorizontal: 20 }}>

      <Link href="/login" style={{ marginBottom: 24 }}>
        <Text style={{ color: colors.textDim }}>‹ Log in</Text>
      </Link>

      <Mark width={72} height={72} />

      <Text style={{ color: colors.textPrimary, fontSize: 32, marginTop: 24, marginBottom: 8, fontWeight: "bold" }}>
        Create your account
      </Text>
      <Text style={{ color: colors.textDim, fontSize: 15, marginBottom: 24 }}>
        Two minutes, then straight into onboarding.
      </Text>

      {error ? <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}

      <Text style={{ fontSize: 12, color: colors.textDim, letterSpacing: 1, marginBottom: 8 }}>USERNAME</Text>
      <TextInput
        placeholder="alex.mercer"
        placeholderTextColor={colors.textFaint}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        style={{ width: "100%", borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.textPrimary, marginBottom: 16 }}
      />

      <Text style={{ fontSize: 12, color: colors.textDim, letterSpacing: 1, marginBottom: 8 }}>EMAIL</Text>
      <TextInput
        placeholder="alex.mercer@email.com"
        placeholderTextColor={colors.textFaint}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        style={{ width: "100%", borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.textPrimary, marginBottom: 16 }}
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

      {/* Password strength meter — 4 segments, filled based on score */}
      <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i < strength ? colors.accent : colors.border,
            }}
          />
        ))}
      </View>
      {strengthLabel !== "" && (
        <Text style={{ color: colors.textDim, fontSize: 13, marginTop: 6 }}>
          {strengthLabel}
          {strength < 4 ? " — add more variety for max strength." : ""}
        </Text>
      )}

      <Text style={{ fontSize: 12, color: colors.textDim, letterSpacing: 1, marginTop: 16, marginBottom: 8 }}>
        CONFIRM PASSWORD
      </Text>
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
          placeholder="Confirm password"
          placeholderTextColor={colors.textFaint}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirmPassword}
          style={{ flex: 1, paddingVertical: 12, color: colors.textPrimary }}
        />
        <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
          <Text style={{ color: colors.textDim }}>{showConfirmPassword ? "Hide" : "Show"}</Text>
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
          borderColor: agreedToTerms ? colors.accent : colors.border,
          backgroundColor: agreedToTerms ? colors.accent : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {agreedToTerms && <Text style={{ color: colors.on, fontSize: 13 }}>✓</Text>}
        </View>
        <Text style={{ color: colors.textDim, flex: 1 }}>
          I agree to the <Text style={{ color: colors.accent }}>Terms</Text> and{" "}
          <Text style={{ color: colors.accent }}>Privacy Policy</Text>.
        </Text>
      </Pressable>

      <Pressable
        onPress={handleSubmit}
        style={{ backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, width: "100%", alignItems: "center" }}
      >
        <Text style={{ color: colors.on, fontWeight: "600" }}>Create account</Text>
      </Pressable>

      <Link href="/login" style={{ marginTop: 16, alignSelf: "center" }}>
        <Text style={{ color: colors.textDim }}>
          Already have an account? <Text style={{ color: colors.accent }}>Log in</Text>
        </Text>
      </Link>
    </View>
  );
}