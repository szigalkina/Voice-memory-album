// A "processing" entry older than this is presumed dead: the serverless
// function that owned it can no longer be running (route maxDuration is 300s),
// so its status will never flip on its own. The UI offers retry instead of an
// eternal spinner.
export const STALE_PROCESSING_MS = 5 * 60 * 1000;

export function isStaleProcessing(
  status: string,
  recordedAtIso: string,
  now: number = Date.now()
): boolean {
  return (
    status === "processing" &&
    now - Date.parse(recordedAtIso) > STALE_PROCESSING_MS
  );
}
