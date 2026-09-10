// src/components/AuthImage.tsx
//
// <Image> for a photo endpoint that requires the app's bearer token. Plain
// <Image source={{uri}}> can't authenticate - RN has no equivalent of
// authFetch for image loads - so this attaches the header the same way
// authFetch does, via source.headers, which RN's Image does support for
// network images.
import { useEffect, useState } from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";
import { getToken } from "../lib/session";

export function AuthImage({
  uri,
  style,
}: {
  uri: string;
  style?: StyleProp<ImageStyle>;
}) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(setToken);
  }, []);

  if (!token) return null;

  return (
    <Image
      source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
      style={style}
    />
  );
}
