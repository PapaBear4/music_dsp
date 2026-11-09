// Template matching chord detection, temporal smoothing, and key estimation

import type { ChromagramResult } from "./chromaExtractor";
import type { DSPParams } from "../types/songGraph";

export const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const KRUMHANSL_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KRUMHANSL_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 2.69, 3.34, 3.17, 2.43];

export interface ChordTemplate {
  name: string;
  vector: number[];
}

export function generateChordTemplates(): ChordTemplate[] {
  const templates: ChordTemplate[] = [];

  for (let root = 0; root < 12; root++) {
    const rootName = PITCH_NAMES[root];

    const majVec = new Array(12).fill(0);
    majVec[root] = 1.0;
    majVec[(root + 4) % 12] = 0.8;
    majVec[(root + 7) % 12] = 0.8;
    templates.push({ name: rootName, vector: normalizeVec(majVec) });

    const minVec = new Array(12).fill(0);
    minVec[root] = 1.0;
    minVec[(root + 3) % 12] = 0.8;
    minVec[(root + 7) % 12] = 0.8;
    templates.push({ name: `${rootName}m`, vector: normalizeVec(minVec) });

    const dom7Vec = new Array(12).fill(0);
    dom7Vec[root] = 1.0;
    dom7Vec[(root + 4) % 12] = 0.7;
    dom7Vec[(root + 7) % 12] = 0.7;
    dom7Vec[(root + 10) % 12] = 0.6;
    templates.push({ name: `${rootName}7`, vector: normalizeVec(dom7Vec) });
  }

  return templates;
}

function normalizeVec(vec: number[]): number[] {
  let sum = 0;
  for (let v of vec) sum += v * v;
  const norm = Math.sqrt(sum) || 1.0;
  return vec.map(v => v / norm);
}

export interface DetectedChordFrame {
  timestampSec: number;
  chord: string;
  confidence: number;
}

export interface ChordDetectionResult {
  detectedChords: DetectedChordFrame[];
  estimatedKey: string;
}

export function detectChords(
  chromaResult: ChromagramResult,
  params: DSPParams
): ChordDetectionResult {
  const { chromaMatrix, timestampsSec } = chromaResult;
  const templates = generateChordTemplates();
  const rawChords: { chord: string; conf: number }[] = [];

  for (let f = 0; f < chromaMatrix.length; f++) {
    const chroma = chromaMatrix[f];
    let maxSim = -1;
    let bestChord = "N.C.";

    for (let t = 0; t < templates.length; t++) {
      let dot = 0;
      for (let c = 0; c < 12; c++) {
        dot += chroma[c] * templates[t].vector[c];
      }
      if (dot > maxSim) {
        maxSim = dot;
        bestChord = templates[t].name;
      }
    }

    if (maxSim < params.chordConfidence) {
      bestChord = "N.C.";
    }

    rawChords.push({ chord: bestChord, conf: maxSim });
  }

  const windowSize = Math.max(1, params.chordSmoothingWindow || 5);
  const halfWin = Math.floor(windowSize / 2);
  const detectedChords: DetectedChordFrame[] = [];

  for (let i = 0; i < rawChords.length; i++) {
    const start = Math.max(0, i - halfWin);
    const end = Math.min(rawChords.length - 1, i + halfWin);

    const counts: Record<string, number> = {};
    let maxCount = 0;
    let smoothedChord = rawChords[i].chord;

    for (let j = start; j <= end; j++) {
      const c = rawChords[j].chord;
      counts[c] = (counts[c] || 0) + 1;
      if (counts[c] > maxCount) {
        maxCount = counts[c];
        smoothedChord = c;
      }
    }

    detectedChords.push({
      timestampSec: timestampsSec[i],
      chord: smoothedChord === "N.C." ? "" : smoothedChord,
      confidence: rawChords[i].conf
    });
  }

  const globalChroma = new Array(12).fill(0);
  for (let f = 0; f < chromaMatrix.length; f++) {
    for (let c = 0; c < 12; c++) {
      globalChroma[c] += chromaMatrix[f][c];
    }
  }

  let bestKey = "G";
  let maxCorr = -999;

  for (let root = 0; root < 12; root++) {
    let majCorr = 0;
    for (let i = 0; i < 12; i++) {
      majCorr += globalChroma[(root + i) % 12] * KRUMHANSL_MAJOR[i];
    }
    if (majCorr > maxCorr) {
      maxCorr = majCorr;
      bestKey = PITCH_NAMES[root];
    }

    let minCorr = 0;
    for (let i = 0; i < 12; i++) {
      minCorr += globalChroma[(root + i) % 12] * KRUMHANSL_MINOR[i];
    }
    if (minCorr > maxCorr) {
      maxCorr = minCorr;
      bestKey = `${PITCH_NAMES[root]}m`;
    }
  }

  return {
    detectedChords,
    estimatedKey: bestKey
  };
}
