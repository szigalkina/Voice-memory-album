import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

// Saves a file and returns its public URL. Vercel Blob when configured,
// otherwise local disk under .data/uploads served by /api/files.
export async function saveFile(
  folder: "audio" | "photos",
  ext: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`${folder}/${name}`, data, {
      access: "public",
      contentType,
    });
    return blob.url;
  }
  const dir = path.join(process.cwd(), ".data", "uploads", folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), data);
  return `/api/files/${folder}/${name}`;
}
