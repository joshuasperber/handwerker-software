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

function getS3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? "us-east-1";

  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: !!endpoint,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
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
  const bucket = process.env.S3_BUCKET ?? "handwerker-uploads";
  const key = `${folder}/${uuidv4()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

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
  return !!(process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
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
