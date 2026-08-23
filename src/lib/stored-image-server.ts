import { isDataImage, isHttpImage, mimeFromStoredName } from "@/lib/stored-image";
import { downloadFile } from "@/lib/storage";

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

const MAX_REMOTE_IMAGE_BYTES = 2_000_000;

function bytesType(mime: string, stored: string): "png" | "jpg" {
  const lower = `${mime} ${stored}`.toLowerCase();
  return lower.includes("png") ? "png" : "jpg";
}

async function fetchHttpImage(
  url: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    if (!mime.startsWith("image/")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_REMOTE_IMAGE_BYTES) return null;
    return { buffer, mime };
  } catch {
    return null;
  }
}

export async function loadStoredImage(
  stored: string | null | undefined
): Promise<{ buffer: Buffer; mime: string } | null> {
  if (!stored?.trim()) return null;
  const raw = stored.trim();

  if (isDataImage(raw)) {
    const parsed = parseDataUrl(raw);
    return parsed ? { buffer: parsed.buffer, mime: parsed.mime } : null;
  }

  if (isHttpImage(raw)) {
    return fetchHttpImage(raw);
  }

  const buffer = await downloadFile(raw);
  if (!buffer) return null;
  return { buffer, mime: mimeFromStoredName(raw) };
}

export async function resolveStoredImageToDataUrl(
  stored: string | null | undefined
): Promise<string | null> {
  if (!stored?.trim()) return null;
  const raw = stored.trim();
  if (isDataImage(raw)) return raw;
  const loaded = await loadStoredImage(raw);
  if (!loaded) return null;
  return `data:${loaded.mime};base64,${loaded.buffer.toString("base64")}`;
}

export async function resolveStoredImageBytes(
  stored: string | null | undefined
): Promise<{ bytes: Uint8Array; type: "png" | "jpg" } | null> {
  const loaded = await loadStoredImage(stored);
  if (!loaded) return null;
  return {
    bytes: new Uint8Array(loaded.buffer),
    type: bytesType(loaded.mime, stored ?? ""),
  };
}

export async function storedImageResponse(stored: string | null): Promise<Response> {
  if (!stored) return new Response(null, { status: 404 });

  if (isHttpImage(stored)) {
    return Response.redirect(stored, 302);
  }

  const loaded = await loadStoredImage(stored);
  if (!loaded) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(loaded.buffer), {
    headers: {
      "Content-Type": loaded.mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
