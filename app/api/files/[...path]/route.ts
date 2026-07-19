import { promises as fs } from "fs";
import path from "path";

const TYPES: Record<string, string> = {
  webm: "audio/webm",
  mp4: "audio/mp4",
  m4a: "audio/mp4",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _req: Request,
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
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
