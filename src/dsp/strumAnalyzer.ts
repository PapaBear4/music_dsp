// Strum pattern analysis based on transient envelope spikes within beat subdivisions

import type { StrumPattern } from "../types/songGraph";

export function analyzeStrumPattern(
  timeSignature: "3/4" | "4/4" | "6/8",
  onsetEnvelope: number[],
  hopDurationSec: number,
  measureStartSec: number,
  measureEndSec: number
): StrumPattern {
  if (timeSignature === "3/4") {
    return {
      pattern: "D-D-D-",
      style: "Waltz"
    };
  }

  if (timeSignature === "6/8") {
    return {
      pattern: "D-D-D-D-D-D-",
      style: "6/8 Ballad"
    };
  }

  const duration = measureEndSec - measureStartSec;
  if (duration <= 0 || onsetEnvelope.length === 0) {
    return { pattern: "D-DU-DU", style: "Folk/Rock" };
  }

  const quarterNoteSec = duration / 4;
  let upbeatEnergy = 0;
  let downbeatEnergy = 0;

  const startFrame = Math.floor(measureStartSec / hopDurationSec);
  const endFrame = Math.floor(measureEndSec / hopDurationSec);

  for (let f = Math.max(0, startFrame); f < Math.min(onsetEnvelope.length, endFrame); f++) {
    const time = f * hopDurationSec - measureStartSec;
    const eighthNotePosition = (time / quarterNoteSec) * 2;
    const isUpbeat = Math.abs(eighthNotePosition - Math.round(eighthNotePosition)) < 0.25 && Math.round(eighthNotePosition) % 2 === 1;

    if (isUpbeat) {
      upbeatEnergy += onsetEnvelope[f];
    } else {
      downbeatEnergy += onsetEnvelope[f];
    }
  }

  if (upbeatEnergy > downbeatEnergy * 0.4) {
    return {
      pattern: "D-DU-DU",
      style: "Folk/Rock"
    };
  } else {
    return {
      pattern: "D-D-D-D-",
      style: "Driving 4/4"
    };
  }
}
