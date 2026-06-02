import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
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

export async function uploadFile(
  file: Buffer,
  fileName: string,
  mimeType: string,
  folder = "uploads"
): Promise<{ key: string; url: string }> {
  const bucket = process.env.S3_BUCKET ?? "handwerker-uploads";
  const key = `${folder}/${uuidv4()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  const client = getS3Client();

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

export async function deleteFile(key: string): Promise<void> {
  const bucket = process.env.S3_BUCKET ?? "handwerker-uploads";
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key })
  );
}
