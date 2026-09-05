// src/components/brand/Field.tsx
// Labeled text field matching Gymind UI.dc.html's `inputStyle` + label pattern.
import { View, Text, TextInput, TextInputProps } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../constants/theme";

export function Field({
  label,
  containerStyle,
  ...rest
}: TextInputProps & { label?: string; containerStyle?: object }) {
  const { colors } = useTheme();
  return (
    <View style={containerStyle}>
      {label ? (
        <Text
          style={{
            fontSize: 11,
            fontFamily: fonts.bodyExtraBold,
            color: colors.textDim,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textDim}
        style={[
          {
            width: "100%",
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            color: colors.text,
            fontSize: 14,
            fontFamily: fonts.bodyRegular,
          },
          rest.style,
        ]}
        {...rest}
      />
    </View>
  );
}
