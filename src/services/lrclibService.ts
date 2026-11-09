// Service to interact with the LRCLIB.net public API for timed lyrics

import type { LRCLibTrack } from "../types/songGraph";

const BASE_URL = "https://lrclib.net/api";

export async function searchLRCLib(query: string): Promise<LRCLibTrack[]> {
  try {
    const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      throw new Error(`LRCLIB search failed with status ${res.status}`);
    }
    const data = await res.json();
    return data as LRCLibTrack[];
  } catch (err) {
    console.error("LRCLIB Search error:", err);
    return [];
  }
}

export async function getLRCLibTrack(
  trackName: string,
  artistName: string,
  albumName?: string,
  duration?: number
): Promise<LRCLibTrack | null> {
  try {
    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName
    });
    if (albumName) params.append("album_name", albumName);
    if (duration) params.append("duration", duration.toString());

    const res = await fetch(`${BASE_URL}/get?${params.toString()}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`LRCLIB get failed with status ${res.status}`);
    }
    return (await res.json()) as LRCLibTrack;
  } catch (err) {
    console.error("LRCLIB Get error:", err);
    return null;
  }
}
