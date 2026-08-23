const DEFAULT_MAX_DIMENSION = 400;

/** Liest ein Bild ein und skaliert es client-seitig zu einem Blob. */
export function fileToImageBlob(
  file: File,
  options?: { maxDimension?: number; mimeType?: string; quality?: number }
): Promise<Blob> {
  const maxDimension = options?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const mimeType = options?.mimeType ?? "image/png";
  const quality = options?.quality ?? 0.9;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas nicht verfügbar"));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Bildkomprimierung fehlgeschlagen"));
            resolve(blob);
          },
          mimeType,
          quality
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
