// Decodes WAV files and parses audio file metadata (ID3 tags / Filename tags)

export interface AudioFileMetadata {
  title: string;
  artist: string;
}

/**
 * Extracts metadata (Title & Artist) from audio file ID3 tags or filename format ("Artist - Title.ext")
 */
export async function parseAudioFileMetadata(file: File): Promise<AudioFileMetadata> {
  const cleanName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension

  // 1. Try parsing filename pattern "Artist - Title" (e.g. "Dave Fenley - Grandpa")
  if (cleanName.includes(" - ")) {
    const parts = cleanName.split(" - ");
    if (parts.length >= 2) {
      return {
        artist: parts[0].trim(),
        title: parts.slice(1).join(" - ").trim()
      };
    }
  }

  // 2. Try reading ID3v2 tags from the beginning of the ArrayBuffer
  try {
    const buffer = await file.slice(0, 4096).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Check for "ID3" header (ID3v2)
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      let titleTag = "";
      let artistTag = "";

      const textDecoder = new TextDecoder("utf-8");

      for (let i = 10; i < bytes.length - 10; i++) {
        // ID3v2.3 / ID3v2.4 frame headers: TIT2 (Title), TPE1 (Artist)
        if (bytes[i] === 0x54 && bytes[i+1] === 0x49 && bytes[i+2] === 0x54 && bytes[i+3] === 0x32) { // TIT2
          const size = bytes[i+7];
          if (size > 0 && i + 10 + size < bytes.length) {
            titleTag = textDecoder.decode(bytes.subarray(i + 11, i + 10 + size)).replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
          }
        }
        if (bytes[i] === 0x54 && bytes[i+1] === 0x50 && bytes[i+2] === 0x45 && bytes[i+3] === 0x31) { // TPE1
          const size = bytes[i+7];
          if (size > 0 && i + 10 + size < bytes.length) {
            artistTag = textDecoder.decode(bytes.subarray(i + 11, i + 10 + size)).replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
          }
        }
      }

      if (titleTag || artistTag) {
        return {
          title: titleTag || cleanName,
          artist: artistTag || "Unknown Artist"
        };
      }
    }
  } catch (err) {
    console.warn("Could not parse ID3 binary tags from audio file:", err);
  }

  // 3. Default fallback
  return {
    title: cleanName,
    artist: "Unknown Artist"
  };
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const decodedData = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();
  return decodedData;
}

// Frequencies for notes
const NOTE_FREQS: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, Csharp4: 277.18, D4: 293.66, E4: 329.63, F4: 349.23, Fsharp4: 369.99,
  G4: 392.00, Gsharp4: 415.30, A4: 440.00, B4: 493.88
};

/**
 * Generates an authentic synthetic audio buffer of a song with guitar-like strummed chords
 * (Supports 3/4 Waltz like "Amazing Grace", 4/4 Folk/Rock, or 6/8 Ballad).
 */
export function createSyntheticAudioBuffer(
  _title: string = "Amazing Grace",
  bpm: number = 90,
  timeSignature: "3/4" | "4/4" | "6/8" = "3/4"
): AudioBuffer {
  const sampleRate = 44100;
  const beatsPerMeasure = timeSignature === "3/4" ? 3 : timeSignature === "6/8" ? 6 : 4;
  const secondsPerBeat = 60 / bpm;
  const secondsPerMeasure = secondsPerBeat * beatsPerMeasure;

  const numMeasures = 8;
  const totalDuration = secondsPerMeasure * numMeasures + 1.0;
  const numSamples = Math.floor(totalDuration * sampleRate);

  const offlineCtx = new OfflineAudioContext(1, numSamples, sampleRate);

  const chordSequence = timeSignature === "3/4"
    ? [
        { name: "G", notes: [NOTE_FREQS.G3, NOTE_FREQS.B3, NOTE_FREQS.D4, NOTE_FREQS.G4] },
        { name: "C", notes: [NOTE_FREQS.C3, NOTE_FREQS.E3, NOTE_FREQS.G3, NOTE_FREQS.C4] },
        { name: "G", notes: [NOTE_FREQS.G3, NOTE_FREQS.B3, NOTE_FREQS.D4, NOTE_FREQS.G4] },
        { name: "D", notes: [NOTE_FREQS.D3, NOTE_FREQS.Fsharp4, NOTE_FREQS.A4, NOTE_FREQS.D4] },
        { name: "G", notes: [NOTE_FREQS.G3, NOTE_FREQS.B3, NOTE_FREQS.D4, NOTE_FREQS.G4] },
        { name: "C", notes: [NOTE_FREQS.C3, NOTE_FREQS.E3, NOTE_FREQS.G3, NOTE_FREQS.C4] },
        { name: "G", notes: [NOTE_FREQS.G3, NOTE_FREQS.B3, NOTE_FREQS.D4, NOTE_FREQS.G4] },
        { name: "D", notes: [NOTE_FREQS.D3, NOTE_FREQS.Fsharp4, NOTE_FREQS.A4, NOTE_FREQS.D4] },
      ]
    : [
        { name: "G", notes: [NOTE_FREQS.G3, NOTE_FREQS.B3, NOTE_FREQS.D4] },
        { name: "Em", notes: [NOTE_FREQS.E3, NOTE_FREQS.G3, NOTE_FREQS.B3] },
        { name: "C", notes: [NOTE_FREQS.C3, NOTE_FREQS.E3, NOTE_FREQS.G3] },
        { name: "D", notes: [NOTE_FREQS.D3, NOTE_FREQS.Fsharp4, NOTE_FREQS.A4] },
        { name: "G", notes: [NOTE_FREQS.G3, NOTE_FREQS.B3, NOTE_FREQS.D4] },
        { name: "Em", notes: [NOTE_FREQS.E3, NOTE_FREQS.G3, NOTE_FREQS.B3] },
        { name: "C", notes: [NOTE_FREQS.C3, NOTE_FREQS.E3, NOTE_FREQS.G3] },
        { name: "D", notes: [NOTE_FREQS.D3, NOTE_FREQS.Fsharp4, NOTE_FREQS.A4] },
      ];

  const leadInSilence = 0.5;

  const buffer = offlineCtx.createBuffer(1, numSamples, sampleRate);
  const data = buffer.getChannelData(0);

  for (let m = 0; m < numMeasures; m++) {
    const chord = chordSequence[m % chordSequence.length];
    const measureStartTime = leadInSilence + m * secondsPerMeasure;

    for (let b = 0; b < beatsPerMeasure; b++) {
      const beatStartTime = measureStartTime + b * secondsPerBeat;
      const isDownbeat = b === 0;

      chord.notes.forEach((freq, stringIdx) => {
        const strumDelay = stringIdx * 0.015;
        const noteStart = beatStartTime + strumDelay;
        const startSample = Math.floor(noteStart * sampleRate);
        const durationSamples = Math.floor((isDownbeat ? secondsPerBeat * 1.2 : secondsPerBeat * 0.8) * sampleRate);

        for (let i = 0; i < durationSamples; i++) {
          const sampleIdx = startSample + i;
          if (sampleIdx >= numSamples) break;

          const t = i / sampleRate;
          const decay = Math.exp(-t * (isDownbeat ? 3.5 : 5.0));
          const val = (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(4 * Math.PI * freq * t)) * decay * (isDownbeat ? 0.25 : 0.15);
          data[sampleIdx] += val;
        }
      });
    }
  }

  return buffer;
}
