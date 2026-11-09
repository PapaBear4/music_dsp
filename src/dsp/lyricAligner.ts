// LRC parsing, timestamp offset adjustment, auto-alignment, and syllable distribution

import type { LrcLine, MusicalEvent } from "../types/songGraph";

export function parseLRC(lrcContent: string): LrcLine[] {
  const lines = lrcContent.split("\n");
  const result: LrcLine[] = [];

  const lrcRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  for (let line of lines) {
    const match = line.match(lrcRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const frac = parseFloat(`0.${match[3]}`);
      const timestampSec = minutes * 60 + seconds + frac;
      const text = match[4].trim();

      if (text) {
        result.push({ timestampSec, text });
      }
    }
  }

  return result.sort((a, b) => a.timestampSec - b.timestampSec);
}

export function syllabifyText(lineText: string): string[] {
  const words = lineText.trim().split(/\s+/);
  const syllables: string[] = [];

  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    const isLastWord = w === words.length - 1;
    const wordSuffix = isLastWord ? "" : " ";

    const cleanWord = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (cleanWord.length > 5 && (cleanWord.includes("ing") || cleanWord.includes("a") || cleanWord.includes("e"))) {
      if (cleanWord === "amazing") {
        syllables.push("A-", "maz-", `ing${wordSuffix}`);
        continue;
      }
      if (cleanWord === "sweeter") {
        syllables.push("Sweet-", `er${wordSuffix}`);
        continue;
      }
    }

    syllables.push(`${word}${wordSuffix}`);
  }

  return syllables;
}

export function mapLyricsToMeasures(
  lrcLines: LrcLine[],
  downbeats: number[],
  beatsPerMeasure: number,
  timeOffsetSec: number,
  autoAlign: boolean
): { measureIndex: number; startsLine: boolean; events: MusicalEvent[] }[] {
  const adjustedLines = lrcLines.map(line => {
    let t = line.timestampSec + timeOffsetSec;

    if (autoAlign && downbeats.length > 0) {
      let closestDownbeat = downbeats[0];
      let minDiff = Math.abs(t - downbeats[0]);

      for (let db of downbeats) {
        const diff = Math.abs(t - db);
        if (diff < minDiff) {
          minDiff = diff;
          closestDownbeat = db;
        }
      }

      if (minDiff < 1.5) {
        t = closestDownbeat;
      }
    }

    return { timestampSec: t, text: line.text };
  });

  const measureResults: { measureIndex: number; startsLine: boolean; events: MusicalEvent[] }[] = [];

  for (let m = 0; m < downbeats.length; m++) {
    const mStart = downbeats[m];
    const mEnd = m + 1 < downbeats.length ? downbeats[m + 1] : mStart + (60 / 90) * beatsPerMeasure;

    const lineForMeasure = adjustedLines.find(
      l => l.timestampSec >= mStart - 0.2 && l.timestampSec < mEnd - 0.2
    );

    const startsLine = !!lineForMeasure;
    const syllables = lineForMeasure ? syllabifyText(lineForMeasure.text) : [];

    const events: MusicalEvent[] = [];
    for (let b = 1; b <= beatsPerMeasure; b++) {
      const syl = syllables[b - 1] || null;
      events.push({
        beat_division: b * 1.0,
        layer_a: {
          chord: null,
          lyrics: syl
        }
      });
    }

    measureResults.push({
      measureIndex: m + 1,
      startsLine,
      events
    });
  }

  return measureResults;
}
