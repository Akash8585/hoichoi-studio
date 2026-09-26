import { access, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function r2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_URL
  );
}

export function isObjectStorageConfigured() {
  return r2Configured();
}

let cachedClient: S3Client | null = null;

function getR2Client() {
  if (!r2Configured()) {
    throw new Error("R2 is not configured");
  }
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return cachedClient;
}

function publicBaseUrl() {
  return (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
}

export function mediaKey(fileName: string) {
  const clean = fileName.replace(/^\/+/, "").replace(/\.\./g, "");
  return clean.startsWith("generated/") ? clean : `generated/${clean}`;
}

export function assertWithinLimit(bytes: number, maxBytes: number, kind: string) {
  if (bytes > maxBytes) {
    throw new Error(
      `${kind} exceeds MVP size limit (${bytes} > ${maxBytes} bytes)`
    );
  }
}

export async function putMediaObject(input: {
  fileName: string;
  body: Buffer | string;
  contentType: string;
  maxBytes: number;
}): Promise<{ url: string; bytes: number; key: string }> {
  const key = mediaKey(input.fileName);
  const body =
    typeof input.body === "string" ? Buffer.from(input.body, "utf8") : input.body;
  assertWithinLimit(body.byteLength, input.maxBytes, key);

  if (r2Configured()) {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: body,
        ContentType: input.contentType,
      })
    );
    return {
      url: `${publicBaseUrl()}/${key}`,
      bytes: body.byteLength,
      key,
    };
  }

  const relative = key.replace(/^generated\//, "");
  const dir = path.join(process.cwd(), "public", "generated");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, relative), body);
  return {
    url: `/generated/${relative}`,
    bytes: body.byteLength,
    key,
  };
}

function keyFromStoredUrl(url: string): string | null {
  try {
    if (url.startsWith("/generated/")) {
      return mediaKey(url.slice(1));
    }
    if (r2Configured()) {
      const base = publicBaseUrl();
      if (url.startsWith(`${base}/`)) {
        return mediaKey(url.slice(base.length + 1));
      }
    }
    const u = new URL(url);
    const maybe = u.pathname.replace(/^\/+/, "");
    if (maybe.startsWith("generated/")) return mediaKey(maybe);
  } catch {
    // ignore
  }
  return null;
}

export async function deleteMediaByUrl(url?: string | null) {
  if (!url) return;
  const key = keyFromStoredUrl(url);
  if (!key) return;

  try {
    if (r2Configured() && !url.startsWith("/")) {
      await getR2Client().send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET!,
          Key: key,
        })
      );
      return;
    }

    const relative = key.replace(/^generated\//, "");
    const filePath = path.join(process.cwd(), "public", "generated", relative);
    await unlink(filePath).catch(() => undefined);
  } catch {
    // best-effort cleanup
  }
}

export async function mediaUrlReachable(
  url?: string | null,
  opts?: { skipNetwork?: boolean }
): Promise<boolean> {
  if (!url) return false;

  if (url.startsWith("/")) {
    const filePath = path.join(process.cwd(), "public", url);
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  if (opts?.skipNetwork) return true;

  try {
    const head = await fetch(url, { method: "HEAD" });
    if (head.ok) return true;
    const get = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
    });
    return get.ok || get.status === 206;
  } catch {
    return false;
  }
}
