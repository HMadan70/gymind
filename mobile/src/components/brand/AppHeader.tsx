// src/components/brand/AppHeader.tsx
// Shared header for every main-app tab: greeting/eyebrow + screen title on
// the left, theme toggle dot on the right (Gymind UI.dc.html lines 189-197).
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Moon, Sun, Settings } from "lucide-react-native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../constants/theme";

// Settings has no spot in the Brand 2.0 design's 5-tab nav (Section 17 of
// PROJECT_STATUS.md flags "where does Profile/Settings live" as an open
// question) - showing it only on Home's header, next to the theme toggle,
// is this migration's assumption call; documented in PROJECT_STATUS.md.
export function AppHeader({
  title,
  eyebrow,
  showSettings = false,
}: {
  title: string;
  eyebrow?: string;
  showSettings?: boolean;
}) {
  const { colors, mode, setMode } = useTheme();
  const router = useRouter();
  const isDark = mode === "dark";
  const defaultEyebrow = new Date().getHours() < 12 ? "Good morning" : "Welcome back";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 58,
        paddingHorizontal: 20,
        paddingBottom: 6,
      }}
    >
      <View>
        <Text
          style={{
            fontSize: 12,
            color: colors.textDim,
            fontFamily: fonts.bodyExtraBold,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {eyebrow ?? defaultEyebrow}
        </Text>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: colors.text }}>{title}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {showSettings ? (
          <Pressable
            onPress={() => router.push("/settings")}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Settings size={18} color={colors.text} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => setMode(isDark ? "light" : "dark")}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isDark ? <Moon size={18} color={colors.text} /> : <Sun size={18} color={colors.text} />}
        </Pressable>
      </View>
    </View>
  );
}
