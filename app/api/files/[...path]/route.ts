import { promises as fs } from "fs";
import path from "path";
import { mediaResponse } from "@/lib/http";

const TYPES: Record<string, string> = {
  webm: "audio/webm",
  mp4: "audio/mp4",
  m4a: "audio/mp4",
  wav: "audio/wav",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const parts = (await params).path;
  const base = path.join(process.cwd(), ".data", "uploads");
  const filePath = path.resolve(base, ...parts);
  if (!filePath.startsWith(base + path.sep)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).slice(1);
    return mediaResponse(
      data,
      TYPES[ext] ?? "application/octet-stream",
      req.headers.get("range")
    );
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
