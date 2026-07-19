// Serve a buffer with HTTP Range support. Safari (especially iOS) refuses to
// play <audio>/<video> from endpoints that answer only 200 — it probes with
// Range requests and needs 206 + Content-Range back.
export function mediaResponse(
  data: Buffer,
  contentType: string,
  rangeHeader: string | null
): Response {
  const total = data.length;
  const base = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  if (rangeHeader) {
    const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    const start = m?.[1] ? parseInt(m[1], 10) : 0;
    let end = m?.[2] ? parseInt(m[2], 10) : total - 1;
    if (Number.isNaN(start) || start >= total || (m?.[2] && end < start)) {
      return new Response(null, {
        status: 416,
        headers: { ...base, "Content-Range": `bytes */${total}` },
      });
    }
    end = Math.min(end, total - 1);
    return new Response(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: {
        ...base,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: { ...base, "Content-Length": String(total) },
  });
}
