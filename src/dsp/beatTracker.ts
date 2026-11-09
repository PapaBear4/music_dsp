// Spectral Flux Onset Detection and Autocorrelation Beat Tracking with Dynamic Peak Phase Locking

import type { DSPParams } from "../types/songGraph";

export interface BeatTrackerResult {
  estimatedBpm: number;
  downbeats: number[];      // Timestamps (seconds) of measure downbeats (beat 1)
  beats: number[];          // Timestamps (seconds) of all beats (beats 1, 2, 3...)
  onsetEnvelope: number[];  // Normalized spectral flux envelope across time frames
  hopDurationSec: number;   // Duration of each frame hop in seconds
}

export function detectBeats(audioBuffer: AudioBuffer, params: DSPParams): BeatTrackerResult {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const fftSize = params.fftSize || 2048;
  const hopSize = fftSize / 2; // 50% overlap for 2x faster onset calculation
  const numFrames = Math.floor((channelData.length - fftSize) / hopSize);

  if (numFrames <= 0) {
    return { estimatedBpm: params.manualBpm || 90, downbeats: [0], beats: [0], onsetEnvelope: [], hopDurationSec: 0.01 };
  }

  const hopDurationSec = hopSize / sampleRate;
  const onsetEnvelope: number[] = new Float32Array(numFrames) as any;
  const prevMagSpectrum = new Float32Array(fftSize / 2);

  // Pre-calculate Hanning window
  const window = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  // Pre-calculate Sine & Cosine tables for bin sampling
  const numBins = fftSize / 2;
  const binStep = 8;
  const sampleStride = 16;
  const numSamplesPerFrame = Math.floor(fftSize / sampleStride);

  const cosTable: Float32Array[] = [];
  const sinTable: Float32Array[] = [];

  for (let k = 0; k < numBins; k += binStep) {
    const angleStep = (2 * Math.PI * k) / fftSize;
    const cosArr = new Float32Array(numSamplesPerFrame);
    const sinArr = new Float32Array(numSamplesPerFrame);
    for (let idx = 0; idx < numSamplesPerFrame; idx++) {
      const n = idx * sampleStride;
      const angle = angleStep * n;
      cosArr[idx] = Math.cos(angle);
      sinArr[idx] = Math.sin(angle);
    }
    cosTable[k] = cosArr;
    sinTable[k] = sinArr;
  }

  // Process frames for spectral flux
  for (let f = 0; f < numFrames; f++) {
    const frameOffset = f * hopSize;
    let flux = 0;

    for (let k = 0; k < numBins; k += binStep) {
      const cosArr = cosTable[k];
      const sinArr = sinTable[k];
      let real = 0;
      let imag = 0;

      for (let idx = 0; idx < numSamplesPerFrame; idx++) {
        const n = idx * sampleStride;
        const sample = channelData[frameOffset + n] * window[n];
        real += sample * cosArr[idx];
        imag -= sample * sinArr[idx];
      }

      const mag = Math.sqrt(real * real + imag * imag);
      const diff = mag - prevMagSpectrum[k];
      if (diff > 0) {
        flux += diff;
      }
      prevMagSpectrum[k] = mag;
    }

    onsetEnvelope[f] = flux;
  }

  // Normalize onset envelope
  let maxFlux = 0.00001;
  for (let i = 0; i < numFrames; i++) {
    if (onsetEnvelope[i] > maxFlux) maxFlux = onsetEnvelope[i];
  }
  for (let i = 0; i < numFrames; i++) {
    onsetEnvelope[i] = onsetEnvelope[i] / maxFlux;
  }

  // Autocorrelation Tempo Estimation with Mean-Subtraction & Log-Gaussian Tempo Prior
  let estimatedBpm = params.manualBpm || 90;

  if (!params.manualBpm) {
    const subFactor = 2;
    const subFrames = Math.floor(numFrames / subFactor);
    const subEnvelope = new Float32Array(subFrames);

    let sumEnv = 0;
    for (let i = 0; i < subFrames; i++) {
      const val = onsetEnvelope[i * subFactor];
      subEnvelope[i] = val;
      sumEnv += val;
    }
    const meanEnv = sumEnv / subFrames;
    for (let i = 0; i < subFrames; i++) {
      subEnvelope[i] -= meanEnv;
    }

    const subHopDuration = hopDurationSec * subFactor;
    const minLag = Math.max(1, Math.floor((60 / params.maxBpm) / subHopDuration));
    const maxLag = Math.floor((60 / params.minBpm) / subHopDuration);

    let maxWeightedCorr = -999999;
    let bestLag = Math.floor((60 / 90) / subHopDuration);

    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      const count = subFrames - lag;
      for (let i = 0; i < count; i += 2) {
        corr += subEnvelope[i] * subEnvelope[i + lag];
      }
      corr /= (count / 2);

      const lagBpm = 60 / (lag * subHopDuration);
      const octaveDiff = Math.log2(lagBpm / 105);
      const priorWeight = Math.exp(-0.5 * (octaveDiff * octaveDiff) / 0.4);
      const weightedCorr = corr * priorWeight;

      if (weightedCorr > maxWeightedCorr) {
        maxWeightedCorr = weightedCorr;
        bestLag = lag;
      }
    }

    estimatedBpm = Math.round(60 / (bestLag * subHopDuration));
    if (estimatedBpm < params.minBpm) estimatedBpm = params.minBpm;
    if (estimatedBpm > params.maxBpm) estimatedBpm = params.maxBpm;
  }

  const beatsPerMeasure = params.timeSignature === "3/4" ? 3 : params.timeSignature === "6/8" ? 6 : 4;
  const beatIntervalSec = 60 / estimatedBpm;

  // Find first onset transient
  let firstOnsetFrame = 0;
  for (let i = 0; i < Math.min(numFrames, Math.floor(2.0 / hopDurationSec)); i++) {
    if (onsetEnvelope[i] > params.onsetThreshold * 1.2) {
      firstOnsetFrame = i;
      break;
    }
  }

  // Initial downbeat position
  let initialTimeSec = (firstOnsetFrame * hopDurationSec) + (params.firstBeatOffsetSec || 0);

  if (params.pickupBeats && params.pickupBeats > 0) {
    const pickupShift = (beatsPerMeasure - params.pickupBeats) * beatIntervalSec;
    initialTimeSec += pickupShift;
  }

  const totalDurationSec = audioBuffer.duration;
  const beats: number[] = [];
  const downbeats: number[] = [];

  // Pickup beats
  if (params.pickupBeats && params.pickupBeats > 0) {
    const pickupStart = initialTimeSec - (params.pickupBeats * beatIntervalSec);
    for (let p = 0; p < params.pickupBeats; p++) {
      const pTime = Math.max(0, pickupStart + (p * beatIntervalSec));
      beats.push(Math.round(pTime * 100) / 100);
    }
  }

  // Dynamic Onset Peak Phase Locking Loop (prevents measure drift across the song)
  let currentBeatTime = Math.max(0, initialTimeSec);
  let beatCounter = 0;
  const searchWindowSec = beatIntervalSec * 0.35; // +/- 35% search radius

  while (currentBeatTime < totalDurationSec - 0.1) {
    // Search local neighborhood in onsetEnvelope for exact transient peak
    const centerFrame = Math.floor(currentBeatTime / hopDurationSec);
    const searchRadiusFrames = Math.floor(searchWindowSec / hopDurationSec);
    const startFrame = Math.max(0, centerFrame - searchRadiusFrames);
    const endFrame = Math.min(numFrames - 1, centerFrame + searchRadiusFrames);

    let maxPeakVal = -1;
    let maxPeakFrame = centerFrame;

    for (let f = startFrame; f <= endFrame; f++) {
      if (onsetEnvelope[f] > maxPeakVal) {
        maxPeakVal = onsetEnvelope[f];
        maxPeakFrame = f;
      }
    }

    // Phase-lock if a clear onset peak exists nearby, otherwise use projected time
    let actualBeatTime = currentBeatTime;
    if (maxPeakVal > params.onsetThreshold * 0.8) {
      actualBeatTime = maxPeakFrame * hopDurationSec;
    }

    const roundedTime = Math.round(actualBeatTime * 100) / 100;
    beats.push(roundedTime);

    if (beatCounter % beatsPerMeasure === 0) {
      downbeats.push(roundedTime);
    }

    beatCounter++;
    // Advance next beat relative to phase-locked actual beat time to eliminate cumulative drift
    currentBeatTime = actualBeatTime + beatIntervalSec;
  }

  return {
    estimatedBpm,
    downbeats,
    beats,
    onsetEnvelope,
    hopDurationSec
  };
}
