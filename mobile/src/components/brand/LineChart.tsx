// src/components/brand/LineChart.tsx
// Simple SVG polyline trend chart (body-weight, e1RM drilldown) — matches
// Gymind UI.dc.html's normalization: viewBox 300x90, y = 80 - ((v-min)/(max-min||1))*60.
import { View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

export function LineChart({ values, color, height = 90 }: { values: number[]; color: string; height?: number }) {
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values
    .map((v, i) => {
      const x = values.length > 1 ? (i / (values.length - 1)) * 300 : 150;
      const y = 80 - ((v - min) / (max - min || 1)) * 60;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <View style={{ width: "100%", height }}>
      <Svg width="100%" height={height} viewBox={`0 0 300 90`} preserveAspectRatio="none">
        <Polyline points={points} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
