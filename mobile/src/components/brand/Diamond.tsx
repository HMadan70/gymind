// src/components/brand/Diamond.tsx
// The recurring accent motif: a small rotated square, used as a corner mark
// on hero cards and as the active-tab indicator (BRAND_GUIDE.md).
import { View } from "react-native";

export function Diamond({
  size = 13,
  color,
  outline = false,
  style,
}: {
  size?: number;
  color: string;
  outline?: boolean;
  style?: object;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: 3,
          transform: [{ rotate: "45deg" }],
          backgroundColor: outline ? "transparent" : color,
          borderWidth: outline ? 1.5 : 0,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}
