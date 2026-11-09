// Interfaces for the SongGraph schema as specified

export interface LayerA {
  chord: string | null;
  lyrics: string | null;
}

export interface MusicalEvent {
  beat_division: number;
  layer_a: LayerA;
}

export interface StrumPattern {
  pattern: string; // e.g. "D-D-D-" or "D-DU-DU"
  style: string;   // e.g. "Waltz", "Folk/Rock"
}

export interface Measure {
  measure_index: number;
  starts_line: boolean;
  strum_pattern?: StrumPattern | null;
  musical_events: MusicalEvent[];
}

export interface StructureBlock {
  block_name: string; // e.g. "Verse 1", "Chorus", "Intro"
  section_overrides?: any | null;
  measures: Measure[];
}

export interface CanonicalMetadata {
  title: string;
  artist: string;
  original_key: string;
  original_tempo_bpm: number;
  original_time_signature: string; // e.g. "3/4", "4/4"
  original_tuning: string;         // e.g. "EADGBE"
  original_capo: number;
  chord_basis?: string | null;
  downbeats: number[];              // timestamps of downbeats in seconds
}

export interface PerformanceMetadata {
  performance_key: string;
  performance_capo: number;
}

export interface SongGraph {
  canonical: CanonicalMetadata;
  performance: PerformanceMetadata;
  requires_agent_intervention: boolean;
  structure: StructureBlock[];
}

// DSP Parameter configuration
export interface DSPParams {
  onsetThreshold: number;       // 0.01 to 0.5 (sensitivity)
  minBpm: number;               // min tempo limit
  maxBpm: number;               // max tempo limit
  manualBpm: number | null;     // manual BPM override if set
  timeSignature: "3/4" | "4/4" | "6/8";
  fftSize: number;              // 512, 1024, 2048, 4096
  chordConfidence: number;      // 0.1 to 0.9
  chordSmoothingWindow: number; // median filter frame count (1-15)
  lyricTimeOffset: number;      // global offset in seconds for LRC alignment
  autoAlignLyrics: boolean;     // attempt auto snapping lyrics to measure starts
  strumSensitivity: number;     // 0.1 to 1.0
  tuning: string;               // e.g. "EADGBE"
  capo: number;                 // e.g. 0
  pickupBeats: number;          // 0, 1, 2, 3 pickup beats before Measure 1
  firstBeatOffsetSec: number;   // fine offset shift for the first downbeat in seconds
}

// LRCLIB Track interface
export interface LRCLibTrack {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string;
  syncedLyrics: string;
}

export interface LrcLine {
  timestampSec: number;
  text: string;
}
