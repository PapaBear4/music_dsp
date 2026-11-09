// Computes 12-pitch-class STFT Chromagram matrix over time frames with optimized lookup tables

export interface ChromagramResult {
  chromaMatrix: number[][]; // Array of 12-element pitch class vectors per frame
  timestampsSec: number[];  // Timestamp of each frame in seconds
  hopDurationSec: number;
}

export function extractChromagram(
  audioBuffer: AudioBuffer,
  fftSize: number = 2048,
  hopSize: number = 1024 // Increased hop size for 2x faster frame calculation
): ChromagramResult {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = Math.floor((channelData.length - fftSize) / hopSize);

  if (numFrames <= 0) {
    return { chromaMatrix: [], timestampsSec: [], hopDurationSec: 0.01 };
  }

  const hopDurationSec = hopSize / sampleRate;
  const chromaMatrix: number[][] = [];
  const timestampsSec: number[] = [];

  // Pre-calculate frequency to pitch-class bin mapping for frequencies 55Hz (A1) to 2000Hz (C7)
  const numBins = fftSize / 2;
  const binToPitchClass = new Int8Array(numBins);

  for (let k = 0; k < numBins; k++) {
    const freq = (k * sampleRate) / fftSize;
    if (freq >= 55 && freq <= 2000) {
      const midi = 69 + 12 * Math.log2(freq / 440);
      const pitchClass = (Math.floor(Math.round(midi)) % 12 + 12) % 12;
      binToPitchClass[k] = pitchClass;
    } else {
      binToPitchClass[k] = -1;
    }
  }

  // Pre-calculate Hanning Window
  const window = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  // Pre-calculate Sine / Cosine Lookup Table for fast energy estimation
  // Sampling stride step = 8 for high performance
  const sampleStride = 8;
  const numSamplesPerFrame = Math.floor(fftSize / sampleStride);
  const cosTable: Float32Array[] = [];
  const sinTable: Float32Array[] = [];

  for (let k = 1; k < numBins; k += 2) {
    if (binToPitchClass[k] !== -1) {
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
  }

  // Process frames
  for (let f = 0; f < numFrames; f++) {
    const frameOffset = f * hopSize;
    const chroma = new Float32Array(12);

    for (let k = 1; k < numBins; k += 2) {
      const pc = binToPitchClass[k];
      if (pc !== -1) {
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
        chroma[pc] += mag;
      }
    }

    // Normalize chroma vector
    let sum = 0;
    for (let c = 0; c < 12; c++) sum += chroma[c] * chroma[c];
    const norm = Math.sqrt(sum) || 1.0;

    const normalizedVector: number[] = new Array(12);
    for (let c = 0; c < 12; c++) {
      normalizedVector[c] = chroma[c] / norm;
    }

    chromaMatrix.push(normalizedVector);
    timestampsSec.push(f * hopDurationSec);
  }

  return {
    chromaMatrix,
    timestampsSec,
    hopDurationSec
  };
}
