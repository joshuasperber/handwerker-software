"use client";

export interface CompressOptions {
  /** Längste Kantenlänge in Pixeln, auf die das Bild herunterskaliert wird. */
  maxDimension?: number;
  /** JPEG-Qualität (0–1). */
  quality?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1920,
  quality: 0.8,
};

/**
 * Komprimiert ein Bild im Browser vor dem Upload, um Ladezeiten und
 * Datenvolumen zu reduzieren. Nicht-Bilder (z. B. PDF) und nicht
 * dekodierbare Formate werden unverändert zurückgegeben.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const { maxDimension, quality } = { ...DEFAULTS, ...options };

  // Nur Rasterbilder komprimieren. SVG/GIF und PDFs unverändert lassen.
  if (
    !file.type.startsWith("image/") ||
    file.type === "image/svg+xml" ||
    file.type === "image/gif"
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxDimension / longestEdge);

    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );

    if (!blob) return file;

    // Falls die Komprimierung größer wäre als das Original (z. B. kleine PNGs),
    // das Original behalten.
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    // Wenn die Dekodierung fehlschlägt (z. B. HEIC in manchen Browsern),
    // wird die Originaldatei hochgeladen.
    return file;
  }
}
