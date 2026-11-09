// Combines DSP components, LRCLIB data, and metadata into the final SongGraph JSON structure

import type { SongGraph, DSPParams, LrcLine, StructureBlock, Measure, MusicalEvent } from "../types/songGraph";
import { detectBeats } from "./beatTracker";
import { extractChromagram } from "./chromaExtractor";
import { detectChords } from "./chordDetector";
import { analyzeStrumPattern } from "./strumAnalyzer";
import { mapLyricsToMeasures } from "./lyricAligner";

export interface PipelineOutput {
  songGraph: SongGraph;
  onsetEnvelope: number[];
  hopDurationSec: number;
  chromaMatrix: number[][];
  chromaTimestampsSec: number[];
}

export function buildSongGraph(
  audioBuffer: AudioBuffer,
  params: DSPParams,
  lrcLines: LrcLine[] = [],
  metadata: { title: string; artist: string; capo?: number; tuning?: string }
): PipelineOutput {
  const beatResult = detectBeats(audioBuffer, params);
  const { estimatedBpm, downbeats, onsetEnvelope, hopDurationSec } = beatResult;

  const chromaResult = extractChromagram(audioBuffer, params.fftSize);
  const { chromaMatrix, timestampsSec: chromaTimestampsSec } = chromaResult;

  const chordResult = detectChords(chromaResult, params);
  const { detectedChords, estimatedKey } = chordResult;

  const beatsPerMeasure = params.timeSignature === "3/4" ? 3 : params.timeSignature === "6/8" ? 6 : 4;
  const lyricMeasures = mapLyricsToMeasures(
    lrcLines,
    downbeats,
    beatsPerMeasure,
    params.lyricTimeOffset,
    params.autoAlignLyrics
  );

  const measures: Measure[] = [];

  for (let m = 0; m < downbeats.length; m++) {
    const mStartSec = downbeats[m];
    const mEndSec = m + 1 < downbeats.length ? downbeats[m + 1] : mStartSec + (60 / estimatedBpm) * beatsPerMeasure;

    const strum = analyzeStrumPattern(params.timeSignature, onsetEnvelope, hopDurationSec, mStartSec, mEndSec);
    const lyricM = lyricMeasures[m] || { measureIndex: m + 1, startsLine: false, events: [] };
    const events: MusicalEvent[] = [];

    for (let b = 1; b <= beatsPerMeasure; b++) {
      const beatSec = mStartSec + ((b - 1) * (60 / estimatedBpm));

      let beatChord: string | null = null;
      let minDiff = 999;
      for (let c of detectedChords) {
        const diff = Math.abs(c.timestampSec - beatSec);
        if (diff < minDiff) {
          minDiff = diff;
          beatChord = c.chord;
        }
      }

      const lyricEvent = lyricM.events ? lyricM.events.find(e => Math.round(e.beat_division) === b) : null;
      const lyrics = lyricEvent ? lyricEvent.layer_a.lyrics : null;

      const previousBeatChord: string | null = b > 1 ? events[events.length - 1]?.layer_a.chord : null;
      const displayChord: string | null = (b === 1 || (beatChord !== null && beatChord !== previousBeatChord)) ? beatChord : null;

      events.push({
        beat_division: b * 1.0,
        layer_a: {
          chord: displayChord,
          lyrics: lyrics
        }
      });
    }

    measures.push({
      measure_index: m + 1,
      starts_line: lyricM.startsLine,
      strum_pattern: m === 0 || m % 4 === 0 ? strum : null,
      musical_events: events
    });
  }

  const structure: StructureBlock[] = [];
  const measuresPerBlock = 4;
  let currentBlockIndex = 1;

  for (let i = 0; i < measures.length; i += measuresPerBlock) {
    const blockMeasures = measures.slice(i, i + measuresPerBlock);
    structure.push({
      block_name: `Verse ${currentBlockIndex}`,
      section_overrides: null,
      measures: blockMeasures
    });
    currentBlockIndex++;
  }

  const songGraph: SongGraph = {
    canonical: {
      title: metadata.title || "Amazing Grace",
      artist: metadata.artist || "John Newton",
      original_key: estimatedKey || "G",
      original_tempo_bpm: estimatedBpm,
      original_time_signature: params.timeSignature,
      original_tuning: metadata.tuning || "EADGBE",
      original_capo: metadata.capo || 0,
      chord_basis: null,
      downbeats: downbeats
    },
    performance: {
      performance_key: estimatedKey || "G",
      performance_capo: metadata.capo || 0
    },
    requires_agent_intervention: false,
    structure: structure.length > 0 ? structure : [
      {
        block_name: "Verse 1",
        section_overrides: null,
        measures: []
      }
    ]
  };

  return {
    songGraph,
    onsetEnvelope,
    hopDurationSec,
    chromaMatrix,
    chromaTimestampsSec
  };
}
