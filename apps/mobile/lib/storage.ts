import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';
import { decode } from './base64';

export interface UploadImageOptions {
  bucket?: string;
  maxWidth?: number;
  quality?: number;
  upsert?: boolean;
}

export async function getPrivateImageUrl(
  pathOrUrl: string,
  bucket = 'report-photos',
  expiresIn = 3600
): Promise<string> {
  if (/^(file|content):\/\//i.test(pathOrUrl)) return pathOrUrl;

  const marker = `/storage/v1/object/public/${bucket}/`;
  const signedMarker = `/storage/v1/object/sign/${bucket}/`;
  let objectPath = pathOrUrl;

  if (/^https?:\/\//i.test(pathOrUrl)) {
    const markerIndex = pathOrUrl.includes(signedMarker)
      ? pathOrUrl.indexOf(signedMarker)
      : pathOrUrl.indexOf(marker);
    if (markerIndex < 0) {
      throw new Error('Image URL does not belong to the expected storage bucket');
    }
    const prefix = pathOrUrl.includes(signedMarker) ? signedMarker : marker;
    objectPath = decodeURIComponent(pathOrUrl.slice(markerIndex + prefix.length).split('?')[0]);
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Uploads an image from a local device URI to Supabase Storage.
 * Avoids FormData entirely to prevent "Unsupported FormDataPart implementation"
 * errors in modern Expo / React Native runtimes.
 */
export async function uploadImageAsync(
  uri: string,
  fileName: string,
  options: UploadImageOptions = {}
): Promise<{ path: string }> {
  const {
    bucket = 'report-photos',
    maxWidth = 1200,
    quality = 0.7,
    upsert = false,
  } = options;

  // 1. Resize, compress and extract base64 representation
  const actions = maxWidth ? [{ resize: { width: maxWidth } }] : [];
  const manipulated = await manipulateAsync(
    uri,
    actions,
    { compress: quality, format: SaveFormat.JPEG, base64: true }
  );

  if (!manipulated.base64) {
    throw new Error('Image manipulation failed to generate base64 data');
  }

  // 2. Decode base64 to binary ArrayBuffer
  const arrayBuffer = decode(manipulated.base64);

  // 3. Upload ArrayBuffer directly to Supabase Storage with explicit MIME type
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert,
    });

  if (error) {
    throw error;
  }

  return { path: data.path };
}

