// src/lib/photos.ts
//
// Shared helpers for the two basic-upload photo features (meal photos on
// Nutrition, progress photos on Progress). Picking is photo-library only -
// no camera capture yet, kept out to match this feature's "basic upload"
// scope rather than build a take-or-choose picker sheet the app has no
// existing pattern for (it avoids native Alert/action-sheets everywhere
// else in favour of its own themed modals).
import * as ImagePicker from "expo-image-picker";
import { authFetch } from "./session";

export type PickedPhoto = ImagePicker.ImagePickerAsset;

/** Opens the photo library. Returns null if the user cancelled or denied permission. */
export async function pickPhoto(): Promise<PickedPhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0];
}

/**
 * Uploads a picked photo as multipart/form-data. Callers pass the full
 * endpoint path (e.g. `/nutrition/42/photo` or `/progress-photos`) - this
 * has no opinion on which resource it's attached to.
 *
 * Built as FormData with a {uri, name, type} object rather than a Blob:
 * that's the React Native fetch convention (there is no browser File/Blob
 * backing a local asset URI here), and it's what lets fetch set its own
 * multipart boundary - the caller must not set a Content-Type header.
 */
export async function uploadPhoto(url: string, photo: PickedPhoto): Promise<Response> {
  const filename = photo.fileName ?? `photo-${Date.now()}.jpg`;
  const type = photo.mimeType ?? "image/jpeg";

  // React Native's documented FormData convention for a local file is this
  // two-argument call with {uri, name, type} embedded in the value itself -
  // not the three-argument browser append(name, blob, filename) signature.
  // The TS lib types model only the browser signature (value: string |
  // Blob), so this needs an escape hatch; FormDataValue below names
  // exactly what RN actually accepts instead of widening to `any`.
  type FormDataValue = { uri: string; name: string; type: string };
  const formData = new FormData();
  formData.append("photo", { uri: photo.uri, name: filename, type } as FormDataValue as unknown as Blob);

  return authFetch(url, { method: "POST", body: formData });
}
