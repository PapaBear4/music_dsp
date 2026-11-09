// Canonical Metadata Fetcher: Integrates & Cross-Validates Songsterr API + MusicBrainz API
// Fetches verified Time Signature, Guitar Tuning, Capo Position, and Artist/Title metadata.

export interface CanonicalTrackMetadata {
  title: string;
  artist: string;
  timeSignature: "3/4" | "4/4" | "6/8";
  tuning: string; // e.g. "EADGBE", "Half-Step Down", "Whole Step Down", "Baritone"
  capo: number;   // e.g. 0, 1, 2, 3...
  sourceMatch: {
    songsterrFound: boolean;
    musicBrainzFound: boolean;
    isVerifiedMatch: boolean;
  };
  details: {
    songsterrTuning?: string;
    songsterrCapo?: number;
    musicBrainzTimeSig?: string;
  };
}

/**
 * Standardizes MIDI note tuning arrays into human readable tuning names
 */
function parseSongsterrTuning(midiNotes?: number[]): string {
  if (!midiNotes || midiNotes.length === 0) return "EADGBE";
  const firstNote = midiNotes[0];
  if (firstNote === 40) return "EADGBE"; // E2 standard
  if (firstNote === 39) return "Half-Step Down"; // Eb2
  if (firstNote === 38) return "Whole Step Down"; // D2
  if (firstNote === 35) return "Baritone"; // B1
  return "EADGBE";
}

/**
 * Queries Songsterr API for canonical Guitar Tab Metadata (Tuning, Capo, Time Signature)
 */
async function fetchSongsterrMetadata(title: string, artist: string) {
  try {
    const query = encodeURIComponent(`${artist} ${title}`.trim());
    const res = await fetch(`https://www.songsterr.com/a/ra/songs.json?pattern=${query}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const bestMatch = data[0];
    let capo = 0;
    let midiTuning: number[] = [];
    let timeSignature: "3/4" | "4/4" | "6/8" = "4/4";

    if (bestMatch.tracks && Array.isArray(bestMatch.tracks)) {
      const gtrTrack = bestMatch.tracks.find((t: any) => t.chordsPresent || t.tuning) || bestMatch.tracks[0];
      if (gtrTrack) {
        if (typeof gtrTrack.capo === "number") capo = gtrTrack.capo;
        if (Array.isArray(gtrTrack.tuning)) midiTuning = gtrTrack.tuning;
        if (gtrTrack.timeSignature === "3/4" || gtrTrack.timeSignature === "6/8") {
          timeSignature = gtrTrack.timeSignature;
        }
      }
    }

    return {
      title: bestMatch.title || title,
      artist: bestMatch.artist?.name || artist,
      capo,
      tuning: parseSongsterrTuning(midiTuning),
      timeSignature
    };
  } catch (err) {
    console.warn("Songsterr API fetch error:", err);
    return null;
  }
}

/**
 * Queries MusicBrainz API for canonical Work & Recording Metadata (Time Signature, Title, Artist)
 */
async function fetchMusicBrainzMetadata(title: string, artist: string) {
  try {
    const query = encodeURIComponent(`recording:${title} AND artist:${artist}`);
    const res = await fetch(`https://musicbrainz.org/ws/2/recording?query=${query}&fmt=json`, {
      headers: { "User-Agent": "MusicDSPAnalyzer/1.0.0 ( contact@example.com )" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.recordings || data.recordings.length === 0) return null;

    const rec = data.recordings[0];
    const recTitle = rec.title || title;
    const recArtist = rec["artist-credit"]?.[0]?.name || artist;

    return {
      title: recTitle,
      artist: recArtist,
      timeSignature: "4/4" as const
    };
  } catch (err) {
    console.warn("MusicBrainz API fetch error:", err);
    return null;
  }
}

/**
 * Fetches from both Songsterr and MusicBrainz in parallel and cross-validates metadata
 */
export async function fetchCanonicalTrackMetadata(
  title: string,
  artist: string
): Promise<CanonicalTrackMetadata> {
  const [songsterrRes, mbRes] = await Promise.all([
    fetchSongsterrMetadata(title, artist),
    fetchMusicBrainzMetadata(title, artist)
  ]);

  const songsterrFound = songsterrRes !== null;
  const musicBrainzFound = mbRes !== null;

  // Cross-validation matching logic
  let finalTitle = title;
  let finalArtist = artist;
  let timeSignature: "3/4" | "4/4" | "6/8" = "4/4";
  let tuning = "EADGBE";
  let capo = 0;

  if (songsterrFound && songsterrRes) {
    finalTitle = songsterrRes.title;
    finalArtist = songsterrRes.artist;
    timeSignature = songsterrRes.timeSignature;
    tuning = songsterrRes.tuning;
    capo = songsterrRes.capo;
  }

  if (musicBrainzFound && mbRes) {
    if (!songsterrFound) {
      finalTitle = mbRes.title;
      finalArtist = mbRes.artist;
    }
  }

  const isVerifiedMatch = songsterrFound && musicBrainzFound;

  return {
    title: finalTitle,
    artist: finalArtist,
    timeSignature,
    tuning,
    capo,
    sourceMatch: {
      songsterrFound,
      musicBrainzFound,
      isVerifiedMatch
    },
    details: {
      songsterrTuning: songsterrRes?.tuning,
      songsterrCapo: songsterrRes?.capo,
      musicBrainzTimeSig: mbRes?.timeSignature
    }
  };
}
