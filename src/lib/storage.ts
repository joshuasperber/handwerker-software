import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

/** Häufiger Tippfehler in Vercel: S3_ACCES_KEY statt S3_ACCESS_KEY */
function getS3AccessKey(): string {
  return process.env.S3_ACCESS_KEY ?? process.env.S3_ACCES_KEY ?? "";
}

function getS3SecretKey(): string {
  return process.env.S3_SECRET_KEY ?? "";
}

export class StorageUploadError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "StorageUploadError";
  }
}

function getS3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? "us-east-1";

  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: !!endpoint,
    credentials: {
      accessKeyId: getS3AccessKey(),
      secretAccessKey: getS3SecretKey(),
    },
  });
}

/**
 * Stellt sicher, dass der Bucket existiert. Praktisch für lokale MinIO-Setups,
 * bei denen der Bucket nicht automatisch angelegt wird. Fehler werden bewusst
 * verschluckt – fehlende Rechte (z. B. bei verwalteten Anbietern) sollen den
 * Upload nicht blockieren, falls der Bucket bereits existiert.
 */
async function ensureBucketExists(client: S3Client, bucket: string): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch {
      // Bucket existiert evtl. bereits oder Anbieter erlaubt kein Anlegen –
      // der nachfolgende PutObject-Aufruf liefert ggf. eine klare Fehlermeldung.
    }
  }
}

export async function uploadFile(
  file: Buffer,
  fileName: string,
  mimeType: string,
  folder = "uploads"
): Promise<{ key: string; url: string }> {
  if (!isStorageConfigured()) {
    throw new StorageUploadError(
      "S3 nicht konfiguriert. In Vercel S3_ACCESS_KEY und S3_SECRET_KEY setzen (nicht S3_ACCES_KEY)."
    );
  }

  const bucket = process.env.S3_BUCKET ?? "handwerker-uploads";
  const key = `${folder}/${uuidv4()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  try {
    const client = getS3Client();
    await ensureBucketExists(client, bucket);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file,
        ContentType: mimeType,
      })
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unbekannter Fehler";
    throw new StorageUploadError(
      `S3-Upload fehlgeschlagen (${detail}). Endpoint, Bucket und Zugangsdaten prüfen.`,
      err
    );
  }

  const publicUrl = process.env.S3_PUBLIC_URL
    ? `${process.env.S3_PUBLIC_URL}/${key}`
    : key;

  return { key, url: publicUrl };
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const bucket = process.env.S3_BUCKET ?? "handwerker-uploads";
  const client = getS3Client();

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn }
  );
}

export function isStorageConfigured(): boolean {
  return !!(getS3AccessKey() && getS3SecretKey());
}

/** Lädt eine Datei als Buffer aus dem Bucket; null bei Fehler/fehlender Datei. */
export async function downloadFile(key: string): Promise<Buffer | null> {
  try {
    const bucket = process.env.S3_BUCKET ?? "handwerker-uploads";
    const client = getS3Client();
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    const bytes = await res.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch {
    return null;
  }
}

export async function deleteFile(key: string): Promise<void> {
  const bucket = process.env.S3_BUCKET ?? "handwerker-uploads";
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key })
  );
}
