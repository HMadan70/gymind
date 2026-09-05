// src/components/brand/BrandMark.tsx
// The logo mark: cut-corner square, teal->gold gradient, white pulse/
// heartbeat polyline (Gymind UI.dc.html lines 36-38, BRAND_GUIDE.md).
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Polyline } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";

export function BrandMark({ size = 52 }: { size?: number }) {
  const { colors } = useTheme();
  const iconSize = Math.round(size * 0.5);

  return (
    <LinearGradient
      colors={[colors.secondary, colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderTopLeftRadius: size * 0.31,
        borderTopRightRadius: size * 0.115,
        borderBottomRightRadius: size * 0.31,
        borderBottomLeftRadius: size * 0.115,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={iconSize} height={iconSize} viewBox="0 0 26 26">
        <Polyline
          points="2,15 8,15 11,6 15,20 18,11 24,11"
          fill="none"
          stroke="#fff"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </LinearGradient>
  );
}
