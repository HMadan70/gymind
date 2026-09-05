// src/components/brand/AppHeader.tsx
// Shared header for every main-app tab: greeting/eyebrow + screen title on
// the left, theme toggle dot on the right (Gymind UI.dc.html lines 189-197).
import React from "react";
import { View, Text, Pressable } from "react-native";
import { Moon, Sun } from "lucide-react-native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../constants/theme";

export function AppHeader({ title, eyebrow }: { title: string; eyebrow?: string }) {
  const { colors, mode, setMode } = useTheme();
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
  );
}
