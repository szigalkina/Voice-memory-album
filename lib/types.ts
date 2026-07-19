// Shared client-side shapes (JSON-serialized rows from the API).
export interface Photo {
  id: string;
  entryId: string;
  blobUrl: string;
  createdAt: string;
}

export interface Entry {
  id: string;
  babyId: string;
  recordedAt: string;
  audioUrl: string;
  transcript: string | null;
  title: string | null;
  summary: string | null;
  quote: string | null;
  isMilestone: boolean;
  milestoneType: string | null;
  photoPrompt: string | null;
  inAlbum: boolean;
  status: "processing" | "ready" | "failed";
  photos: Photo[];
}

export interface Baby {
  id: string;
  name: string;
  birthdate: string;
}
