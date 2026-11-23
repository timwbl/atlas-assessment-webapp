export const QUESTION_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_EMBEDDED_QUESTION_IMAGE_BYTES = 1024 * 1024;

export function isQuestionImageSource(value: string): boolean {
  const src = value.trim();
  // Filenames and paths may contain spaces when encoded. A relative address must stay on ATLAS.
  if (src.startsWith("/") && !src.startsWith("//") && !/[\\\u0000-\u0020]/.test(src)) return true;

  if (src.startsWith("data:")) {
    const encoded = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(src)?.[2];
    if (!encoded || encoded.length % 4) return false;
    const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
    return encoded.length * 3 / 4 - padding <= MAX_EMBEDDED_QUESTION_IMAGE_BYTES;
  }

  if (!src.startsWith("https://")) return false;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}
