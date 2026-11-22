import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';
import { decode } from './base64';

export interface UploadImageOptions {
  bucket?: string;
  maxWidth?: number;
  quality?: number;
  upsert?: boolean;
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

