// Base64 to ArrayBuffer decoder
// Safe for React Native / Expo without external binary dependencies

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const lookup = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}

export function decode(base64: string): ArrayBuffer {
  // Strip data URI prefix if present (e.g. 'data:image/jpeg;base64,')
  let clean = base64.includes(',') ? base64.split(',')[1] : base64;
  
  // Normalize whitespace, newlines, and URL-safe characters
  clean = clean.replace(/[\r\n\s]/g, '').replace(/-/g, '+').replace(/_/g, '/');

  let bufferLength = clean.length * 0.75;
  const len = clean.length;
  let p = 0;

  if (clean[clean.length - 1] === '=') {
    bufferLength--;
    if (clean[clean.length - 2] === '=') {
      bufferLength--;
    }
  }

  const arraybuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arraybuffer);

  for (let i = 0; i < len; i += 4) {
    const encoded1 = lookup[clean.charCodeAt(i)];
    const encoded2 = lookup[clean.charCodeAt(i + 1)];
    const encoded3 = lookup[clean.charCodeAt(i + 2)];
    const encoded4 = lookup[clean.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  return arraybuffer;
}

