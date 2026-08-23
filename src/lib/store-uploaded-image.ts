import { isStorageConfigured, uploadFile } from "@/lib/storage";

const DEFAULT_MAX_DATA_URL_LENGTH = 1_500_000;

export class ImageStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageStoreError";
  }
}

/** Speichert ein komprimiertes Bild in S3 oder als Data-URL-Fallback. */
export async function storeUploadedImage(opts: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folder: string;
  maxDataUrlLength?: number;
}): Promise<string> {
  if (isStorageConfigured()) {
    const uploaded = await uploadFile(
      opts.buffer,
      opts.fileName,
      opts.mimeType,
      opts.folder
    );
    return uploaded.key;
  }

  const mime = opts.mimeType || "image/png";
  const stored = `data:${mime};base64,${opts.buffer.toString("base64")}`;
  if (stored.length > (opts.maxDataUrlLength ?? DEFAULT_MAX_DATA_URL_LENGTH)) {
    throw new ImageStoreError(
      "Bild ist zu groß und Datei-Speicher (S3) ist nicht konfiguriert."
    );
  }
  return stored;
}
