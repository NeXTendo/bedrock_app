import { supabase } from './supabase';

export async function getPrivateImageUrl(
  pathOrUrl: string,
  bucket = 'report-photos',
  expiresIn = 3600
): Promise<string> {
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
