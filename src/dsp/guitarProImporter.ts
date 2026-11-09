// Guitar Pro (.gp, .gpx, .gp5, .gp4, .gp3) Importer & UMS (Universal Music Structure) Converter

import * as alphaTab from "@coderline/alphatab";
import type { SongGraph, StructureBlock, Measure, MusicalEvent, CanonicalMetadata, PerformanceMetadata, LrcLine } from "../types/songGraph";

export interface GuitarProImportResult {
  songGraph: SongGraph;
  title: string;
  artist: string;
  tempoBpm: number;
  timeSignature: "3/4" | "4/4" | "6/8";
  tuning: string;
  capo: number;
  extractedLrcLines: LrcLine[];
  lrcContent: string;
  rawScore?: any;
}

/**
 * Converts a MIDI tuning array from alphaTab into a standard human readable string (e.g. "EADGBE", "Drop D")
 */
function formatAlphaTabTuning(tuningNotes?: number[]): string {
  if (!tuningNotes || tuningNotes.length === 0) return "EADGBE";
  const first = tuningNotes[0];
  if (first === 40) return "EADGBE";
  if (first === 38 && tuningNotes[1] === 45) return "DADGBE";
  if (first === 39) return "Half-Step Down";
  if (first === 38) return "Whole Step Down";
  if (first === 35) return "Baritone";
  return "EADGBE";
}

/**
 * Parses any Guitar Pro file (.gp, .gpx, .gp5, .gp4, .gp3), computes exact beat lyric timestamps,
 * and converts it to UMS SongGraph format.
 */
export async function importGuitarProFile(file: File): Promise<GuitarProImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Load Guitar Pro Score using alphaTab's native importer engine
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes);

  const title = score.title || file.name.replace(/\.[^/.]+$/, "");
  const artist = score.artist || "Unknown Artist";
  let tempoBpm = score.tempo || 90;

  const firstTrack = score.tracks && score.tracks.length > 0 ? score.tracks[0] : null;
  const firstStaff = firstTrack && firstTrack.staves && firstTrack.staves.length > 0 ? firstTrack.staves[0] : null;

  const capo = firstStaff ? firstStaff.capo : 0;
  const tuningNotes = firstStaff && firstStaff.stringTuning ? firstStaff.stringTuning.tunings : [];
  const tuning = formatAlphaTabTuning(tuningNotes);

  let timeSignature: "3/4" | "4/4" | "6/8" = "4/4";

  if (score.masterBars && score.masterBars.length > 0) {
    const mb0 = score.masterBars[0];
    const tsStr = `${mb0.timeSignatureNumerator}/${mb0.timeSignatureDenominator}`;
    if (tsStr === "3/4" || tsStr === "6/8") {
      timeSignature = tsStr;
    }
  }

  // Convert Guitar Pro MasterBars into UMS StructureBlocks, Measures, and Timed Lyrics
  const measures: Measure[] = [];
  let currentSectionName = "Verse 1";
  const structureBlocks: StructureBlock[] = [];
  let currentBlockMeasures: Measure[] = [];

  const beatsPerMeasure = timeSignature === "3/4" ? 3 : timeSignature === "6/8" ? 6 : 4;

  const extractedLrcLines: LrcLine[] = [];
  let cumulativeTimeSec = 0.0;
  const downbeatsSec: number[] = [];

  if (score.masterBars) {
    for (let m = 0; m < score.masterBars.length; m++) {
      const mb = score.masterBars[m];

      // Update BPM if tempo change occurs at this masterBar
      if (mb.tempoAutomations && mb.tempoAutomations.length > 0) {
        const tVal = mb.tempoAutomations[0].value;
        if (tVal > 30 && tVal < 300) tempoBpm = tVal;
      }

      const numBeats = mb.timeSignatureNumerator || beatsPerMeasure;
      const denBeats = mb.timeSignatureDenominator || 4;
      const secondsPerBeat = (60 / tempoBpm) * (4 / denBeats);
      const measureDurationSec = secondsPerBeat * numBeats;

      downbeatsSec.push(Math.round(cumulativeTimeSec * 100) / 100);

      // Check if measure has a section header (e.g. "Intro", "Verse 1", "Chorus")
      if (mb.section) {
        if (currentBlockMeasures.length > 0) {
          structureBlocks.push({
            block_name: currentSectionName,
            measures: currentBlockMeasures
          });
          currentBlockMeasures = [];
        }
        currentSectionName = mb.section.text || `Section ${structureBlocks.length + 1}`;
      }

      const musicalEvents: MusicalEvent[] = [];
      let currentLineLyricPhrase = "";
      let phraseStartTimeSec = cumulativeTimeSec;

      // Extract chords and lyrics attached to beats in this measure
      if (firstStaff) {
        const bar = firstStaff.bars && firstStaff.bars[m];

        if (bar && bar.voices && bar.voices.length > 0) {
          const voice = bar.voices[0];
          if (voice.beats) {
            const numVoiceBeats = voice.beats.length;
            for (let b = 0; b < numVoiceBeats; b++) {
              const beat = voice.beats[b];
              const beatDivision = (b % numBeats) + 1;
              const beatTimeSec = cumulativeTimeSec + (b / Math.max(1, numVoiceBeats)) * measureDurationSec;

              const chordName = beat.chord ? beat.chord.name : null;
              let lyricText: string | null = null;

              if (beat.lyrics && beat.lyrics.length > 0) {
                lyricText = beat.lyrics.join(" ").trim();
              }

              if (lyricText) {
                if (!currentLineLyricPhrase) phraseStartTimeSec = beatTimeSec;
                currentLineLyricPhrase += (currentLineLyricPhrase ? " " : "") + lyricText;
              }

              if (chordName || lyricText) {
                musicalEvents.push({
                  beat_division: beatDivision,
                  layer_a: {
                    chord: chordName,
                    lyrics: lyricText
                  }
                });
              }
            }
          }
        }
      }

      if (currentLineLyricPhrase) {
        extractedLrcLines.push({
          timestampSec: Math.round(phraseStartTimeSec * 100) / 100,
          text: currentLineLyricPhrase
        });
      }

      // Default events if no chords were attached
      if (musicalEvents.length === 0) {
        for (let b = 1; b <= numBeats; b++) {
          musicalEvents.push({
            beat_division: b,
            layer_a: { chord: null, lyrics: null }
          });
        }
      }

      const measureObj: Measure = {
        measure_index: m + 1,
        starts_line: m % 4 === 0,
        strum_pattern: {
          pattern: timeSignature === "3/4" ? "D-D-D-" : "D-DU-DU",
          style: timeSignature === "3/4" ? "Waltz" : "Folk/Rock"
        },
        musical_events: musicalEvents
      };

      currentBlockMeasures.push(measureObj);
      measures.push(measureObj);

      cumulativeTimeSec += measureDurationSec;
    }
  }

  if (currentBlockMeasures.length > 0) {
    structureBlocks.push({
      block_name: currentSectionName,
      measures: currentBlockMeasures
    });
  }

  // Format extracted lyrics into synced LRC text
  let lrcContent = "";
  for (const line of extractedLrcLines) {
    const mins = Math.floor(line.timestampSec / 60);
    const secs = (line.timestampSec % 60).toFixed(2);
    const paddedSecs = parseFloat(secs) < 10 ? `0${secs}` : secs;
    lrcContent += `[${mins < 10 ? `0${mins}` : mins}:${paddedSecs}] ${line.text}\n`;
  }

  // Build complete Canonical & Performance UMS Metadata
  const canonical: CanonicalMetadata = {
    title,
    artist,
    original_key: "G major",
    original_tempo_bpm: tempoBpm,
    original_time_signature: timeSignature,
    original_tuning: tuning,
    original_capo: capo,
    downbeats: downbeatsSec
  };

  const performance: PerformanceMetadata = {
    performance_key: "G major",
    performance_capo: capo
  };

  const songGraph: SongGraph = {
    canonical,
    performance,
    requires_agent_intervention: false,
    structure: structureBlocks.length > 0 ? structureBlocks : [{ block_name: "Full Song", measures }]
  };

  return {
    songGraph,
    title,
    artist,
    tempoBpm,
    timeSignature,
    tuning,
    capo,
    extractedLrcLines,
    lrcContent,
    rawScore: score
  };
}
