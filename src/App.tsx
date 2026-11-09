import React, { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "./components/Header";
import { WaveformViewer } from "./components/WaveformViewer";
import { ChromaVisualizer } from "./components/ChromaVisualizer";
import { LyricScroller } from "./components/LyricScroller";
import { DSPParameterPanel } from "./components/DSPParameterPanel";
import { StructureEditor } from "./components/StructureEditor";
import { SongGraphViewer } from "./components/SongGraphViewer";
import { LrclibModal } from "./components/LrclibModal";
import { WhisperListenerModal } from "./components/WhisperListenerModal";
import { FloatingDAWControlBar } from "./components/FloatingDAWControlBar";
import type { DSPParams, SongGraph, LrcLine } from "./types/songGraph";
import { decodeAudioFile, createSyntheticAudioBuffer, parseAudioFileMetadata } from "./dsp/audioDecoder";
import { buildSongGraph } from "./dsp/songGraphBuilder";
import { parseLRC } from "./dsp/lyricAligner";
import { transcribeSungLyricsWithWhisper } from "./dsp/whisperListener";
import { fetchCanonicalTrackMetadata, type CanonicalTrackMetadata } from "./dsp/canonicalMetadataFetcher";

import { importGuitarProFile } from "./dsp/guitarProImporter";

const DEFAULT_DSP_PARAMS: DSPParams = {
  onsetThreshold: 0.12,
  minBpm: 60,
  maxBpm: 180,
  manualBpm: null,
  timeSignature: "3/4",
  fftSize: 2048,
  chordConfidence: 0.35,
  chordSmoothingWindow: 5,
  lyricTimeOffset: 0.0,
  autoAlignLyrics: true,
  strumSensitivity: 0.5,
  tuning: "EADGBE",
  capo: 0,
  pickupBeats: 0,
  firstBeatOffsetSec: 0.0
};

export function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [title, setTitle] = useState("Amazing Grace");
  const [artist, setArtist] = useState("John Newton");
  const [dspParams, setDspParams] = useState<DSPParams>(DEFAULT_DSP_PARAMS);

  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  // Canonical Cross-Validated Metadata (Songsterr + MusicBrainz)
  const [canonicalMetadata, setCanonicalMetadata] = useState<CanonicalTrackMetadata | null>(null);

  // Dual Separate Lyric Tracks: Imported LRC vs Whisper-Heard WASM
  const [importedLrcLines, setImportedLrcLines] = useState<LrcLine[]>([]);
  const [whisperLrcLines, setWhisperLrcLines] = useState<LrcLine[]>([]);
  const [activeLyricSource, setActiveLyricSource] = useState<"imported" | "whisper">("whisper");

  const [songGraph, setSongGraph] = useState<SongGraph | null>(null);

  const [onsetEnvelope, setOnsetEnvelope] = useState<number[]>([]);
  const [hopDurationSec, setHopDurationSec] = useState<number>(0.01);
  const [chromaMatrix, setChromaMatrix] = useState<number[][]>([]);
  const [chromaTimestampsSec, setChromaTimestampsSec] = useState<number[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isLrcModalOpen, setIsLrcModalOpen] = useState(false);
  const [isWhisperModalOpen, setIsWhisperModalOpen] = useState(false);
  const [isTuningPanelOpen, setIsTuningPanelOpen] = useState(true);

  // Synchronized Zoom, Pan, and Playback position state
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffsetSec, setPanOffsetSec] = useState<number>(0);
  const [playbackTime, setPlaybackTime] = useState<number>(0);
  const [seekTime, setSeekTime] = useState<number | null>(null);

  // Registered Playback Controls from WaveformViewer
  const [playbackControls, setPlaybackControls] = useState<{
    isPlaying: boolean;
    togglePlay: () => void;
    handleReset: () => void;
    autoTrack: boolean;
    toggleAutoTrack: () => void;
    playbackTime: number;
  } | null>(null);

  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Master DSP computation trigger with non-blocking async execution
  const runPipeline = useCallback((
    buffer: AudioBuffer,
    params: DSPParams,
    lyrics: LrcLine[],
    meta: { title: string; artist: string }
  ) => {
    setIsProcessing(true);

    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const output = buildSongGraph(buffer, params, lyrics, {
            title: meta.title,
            artist: meta.artist,
            capo: params.capo,
            tuning: params.tuning
          });

          setSongGraph(output.songGraph);
          setOnsetEnvelope(output.onsetEnvelope);
          setHopDurationSec(output.hopDurationSec);
          setChromaMatrix(output.chromaMatrix);
          setChromaTimestampsSec(output.chromaTimestampsSec);
        } catch (err) {
          console.error("DSP Pipeline error:", err);
        } finally {
          setIsProcessing(false);
        }
      }, 16);
    });
  }, []);

  // Canonical Cross-Validation Fetcher (Songsterr API + MusicBrainz API)
  const fetchAndVerifyCanonical = useCallback(async (targetTitle: string, targetArtist: string) => {
    const verified = await fetchCanonicalTrackMetadata(targetTitle, targetArtist);
    setCanonicalMetadata(verified);

    if (verified.sourceMatch.songsterrFound || verified.sourceMatch.musicBrainzFound) {
      setDspParams((prev) => {
        const updated = {
          ...prev,
          timeSignature: verified.timeSignature,
          tuning: verified.tuning,
          capo: verified.capo
        };
        if (audioBuffer) {
          const activeLines = activeLyricSource === "whisper" ? whisperLrcLines : importedLrcLines;
          runPipeline(audioBuffer, updated, activeLines, { title: verified.title, artist: verified.artist });
        }
        return updated;
      });
    }
  }, [audioBuffer, activeLyricSource, whisperLrcLines, importedLrcLines, runPipeline]);

  // Initial song setup with automatic whisper.cpp WASM transcription
  useEffect(() => {
    const synBuffer = createSyntheticAudioBuffer("Amazing Grace", 90, "3/4");
    setAudioBuffer(synBuffer);

    transcribeSungLyricsWithWhisper(synBuffer, undefined, { title: "Amazing Grace", artist: "John Newton" }).then((whisperResult) => {
      setWhisperLrcLines(whisperResult.lrcLines);
      const paramsWithOffset = { ...DEFAULT_DSP_PARAMS, lyricTimeOffset: whisperResult.calculatedOffsetSec };
      setDspParams(paramsWithOffset);
      runPipeline(synBuffer, paramsWithOffset, whisperResult.lrcLines, { title: "Amazing Grace", artist: "John Newton" });
    });
  }, [runPipeline]);

  // Debounced parameter slider handler for ultra-smooth 60fps UI performance
  const handleParamsChange = (newParams: DSPParams) => {
    setDspParams(newParams);
    if (audioBuffer) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        const activeLines = activeLyricSource === "whisper" ? whisperLrcLines : importedLrcLines;
        runPipeline(audioBuffer, newParams, activeLines, { title, artist });
      }, 120);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    // Clear previous song's lyric states immediately upon loading new song
    setWhisperLrcLines([]);
    setImportedLrcLines([]);

    setTimeout(async () => {
      try {
        const meta = await parseAudioFileMetadata(file);
        setTitle(meta.title);
        setArtist(meta.artist);

        const decoded = await decodeAudioFile(file);
        setAudioBuffer(decoded);
        setZoomLevel(1);
        setPanOffsetSec(0);
        setPlaybackTime(0);
        setSeekTime(0);

        const whisperResult = await transcribeSungLyricsWithWhisper(decoded, undefined, { title: meta.title, artist: meta.artist });
        setWhisperLrcLines(whisperResult.lrcLines);
        setActiveLyricSource("whisper");
        const updatedParams = { ...dspParams, lyricTimeOffset: whisperResult.calculatedOffsetSec };
        setDspParams(updatedParams);
        runPipeline(decoded, updatedParams, whisperResult.lrcLines, { title: meta.title, artist: meta.artist });

        // Trigger Option A (Songsterr) & Option B (MusicBrainz) Cross-Validation
        fetchAndVerifyCanonical(meta.title, meta.artist);
      } catch (err) {
        alert("Failed to decode WAV audio file: " + err);
        setIsProcessing(false);
      }
    }, 20);
  };

  const handleGpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const gpResult = await importGuitarProFile(file);
      setTitle(gpResult.title);
      setArtist(gpResult.artist);

      const updatedParams: DSPParams = {
        ...dspParams,
        timeSignature: gpResult.timeSignature,
        tuning: gpResult.tuning,
        capo: gpResult.capo,
        manualBpm: gpResult.tempoBpm
      };
      setDspParams(updatedParams);
      setSongGraph(gpResult.songGraph);

      if (gpResult.extractedLrcLines.length > 0) {
        setImportedLrcLines(gpResult.extractedLrcLines);
        setActiveLyricSource("imported");
      }

      if (audioBuffer) {
        const activeLines = gpResult.extractedLrcLines.length > 0 ? gpResult.extractedLrcLines : (activeLyricSource === "whisper" ? whisperLrcLines : importedLrcLines);
        runPipeline(audioBuffer, updatedParams, activeLines, { title: gpResult.title, artist: gpResult.artist });
      }
    } catch (err) {
      alert("Failed to parse Guitar Pro file: " + err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateSynthetic = () => {
    setIsProcessing(true);
    // Clear previous song's lyric states immediately upon loading new song
    setWhisperLrcLines([]);
    setImportedLrcLines([]);

    setTimeout(async () => {
      const bpm = dspParams.manualBpm || 90;
      const synBuffer = createSyntheticAudioBuffer(title, bpm, dspParams.timeSignature);
      setAudioBuffer(synBuffer);
      setZoomLevel(1);
      setPanOffsetSec(0);
      setPlaybackTime(0);
      setSeekTime(0);

      const whisperResult = await transcribeSungLyricsWithWhisper(synBuffer, undefined, { title, artist });
      setWhisperLrcLines(whisperResult.lrcLines);
      setActiveLyricSource("whisper");
      const updatedParams = { ...dspParams, lyricTimeOffset: whisperResult.calculatedOffsetSec };
      setDspParams(updatedParams);
      runPipeline(synBuffer, updatedParams, whisperResult.lrcLines, { title, artist });
    }, 20);
  };

  const handleSelectLrc = (lrcContent: string, trackInfo?: { title: string; artist: string }) => {
    const parsed = parseLRC(lrcContent);
    setImportedLrcLines(parsed);
    setActiveLyricSource("imported");
    if (trackInfo) {
      if (trackInfo.title) setTitle(trackInfo.title);
      if (trackInfo.artist) setArtist(trackInfo.artist);
    }
    const finalT = trackInfo?.title || title;
    const finalA = trackInfo?.artist || artist;
    if (audioBuffer) {
      runPipeline(audioBuffer, dspParams, parsed, { title: finalT, artist: finalA });
    }
    fetchAndVerifyCanonical(finalT, finalA);
  };

  const handleApplyWhisperLyrics = (lrcContent: string, suggestedOffsetSec?: number) => {
    const parsed = parseLRC(lrcContent);
    setWhisperLrcLines(parsed);
    setActiveLyricSource("whisper");
    let updatedParams = dspParams;
    if (suggestedOffsetSec !== undefined) {
      updatedParams = { ...dspParams, lyricTimeOffset: suggestedOffsetSec };
      setDspParams(updatedParams);
    }
    if (audioBuffer) {
      runPipeline(audioBuffer, updatedParams, parsed, { title, artist });
    }
  };

  const handleAdoptWhisperLyrics = () => {
    setActiveLyricSource("whisper");
    if (audioBuffer) {
      runPipeline(audioBuffer, dspParams, whisperLrcLines, { title, artist });
    }
  };

  const handleAdoptImportedLyrics = () => {
    setActiveLyricSource("imported");
    if (audioBuffer) {
      runPipeline(audioBuffer, dspParams, importedLrcLines, { title, artist });
    }
  };

  const handleSeekToTime = (timeSec: number) => {
    setSeekTime(timeSec);
    setPlaybackTime(timeSec);
  };

  return (
    <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "1.5rem 1rem 5rem 1rem" }}>
      <Header
        title={title}
        artist={artist}
        onTitleChange={(t) => {
          setTitle(t);
          if (songGraph) setSongGraph({ ...songGraph, canonical: { ...songGraph.canonical, title: t } });
        }}
        onArtistChange={(a) => {
          setArtist(a);
          if (songGraph) setSongGraph({ ...songGraph, canonical: { ...songGraph.canonical, artist: a } });
        }}
        dspParams={dspParams}
        onParamsChange={handleParamsChange}
        onFileUpload={handleFileUpload}
        onGpUpload={handleGpUpload}
        onGenerateSynthetic={handleGenerateSynthetic}
        onOpenLrcModal={() => setIsLrcModalOpen(true)}
        onOpenWhisperModal={() => setIsWhisperModalOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        isProcessing={isProcessing}
        isTuningPanelOpen={isTuningPanelOpen}
        onToggleTuningPanel={() => setIsTuningPanelOpen(!isTuningPanelOpen)}
        canonicalMetadata={canonicalMetadata}
        onFetchCanonicalMetadata={() => fetchAndVerifyCanonical(title, artist)}
      />

      {/* Main Content & Side Panel Split Layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isTuningPanelOpen ? "minmax(0, 1fr) 340px" : "minmax(0, 1fr)",
        gap: "1.5rem",
        alignItems: "start"
      }}>
        {/* Left Column: Visualizers & Output */}
        <div style={{ minWidth: 0 }}>
          <WaveformViewer
            audioBuffer={audioBuffer}
            songGraph={songGraph}
            onsetEnvelope={onsetEnvelope}
            hopDurationSec={hopDurationSec}
            isProcessing={isProcessing}
            zoomLevel={zoomLevel}
            panOffsetSec={panOffsetSec}
            onZoomChange={(lvl) => setZoomLevel(lvl)}
            onPanChange={(panSec) => setPanOffsetSec(panSec)}
            onPlaybackTimeUpdate={(t) => setPlaybackTime(t)}
            externalSeekTime={seekTime}
            onPlaybackStateChange={(st) => setPlaybackControls(st)}
          />

          <ChromaVisualizer
            chromaMatrix={chromaMatrix}
            chromaTimestampsSec={chromaTimestampsSec}
            audioDuration={audioBuffer?.duration || 0}
            zoomLevel={zoomLevel}
            panOffsetSec={panOffsetSec}
            playbackTime={playbackTime}
            onPanChange={(panSec) => setPanOffsetSec(panSec)}
            onSeekToTime={handleSeekToTime}
          />

          {/* DUAL SEPARATE LYRIC PANES (Imported LRC vs Whisper-Heard WASM) */}
          <LyricScroller
            importedLrcLines={importedLrcLines}
            whisperLrcLines={whisperLrcLines}
            activeSource={activeLyricSource}
            playbackTime={playbackTime}
            onSeekToTime={handleSeekToTime}
            onOpenLrcModal={() => setIsLrcModalOpen(true)}
            onOpenWhisperModal={() => setIsWhisperModalOpen(true)}
            onAdoptWhisperLyrics={handleAdoptWhisperLyrics}
            onAdoptImportedLyrics={handleAdoptImportedLyrics}
            lyricTimeOffset={dspParams.lyricTimeOffset}
            zoomLevel={zoomLevel}
            panOffsetSec={panOffsetSec}
            audioDuration={audioBuffer?.duration || 0}
            isProcessing={isProcessing}
          />

          <StructureEditor
            songGraph={songGraph}
            onUpdateSongGraph={(updated) => setSongGraph(updated)}
          />

          <SongGraphViewer songGraph={songGraph} />
        </div>

        {/* Right Column: Algorithm Parameter Tuning Side Panel */}
        {isTuningPanelOpen && (
          <aside style={{ position: "sticky", top: "1rem" }}>
            <DSPParameterPanel
              params={dspParams}
              onChange={handleParamsChange}
              onReset={() => handleParamsChange(DEFAULT_DSP_PARAMS)}
              onClose={() => setIsTuningPanelOpen(false)}
              detectedKey={songGraph?.canonical.original_key}
              detectedBpm={songGraph?.canonical.original_tempo_bpm}
            />
          </aside>
        )}
      </div>

      <LrclibModal
        isOpen={isLrcModalOpen}
        onClose={() => setIsLrcModalOpen(false)}
        onSelectLrc={handleSelectLrc}
        initialQuery={`${artist} ${title}`}
      />

      <WhisperListenerModal
        isOpen={isWhisperModalOpen}
        onClose={() => setIsWhisperModalOpen(false)}
        audioBuffer={audioBuffer}
        onApplyLyrics={handleApplyWhisperLyrics}
      />

      {/* Ultra-Slim Fixed Floating DAW Control Dock */}
      {playbackControls && (
        <FloatingDAWControlBar
          isPlaying={playbackControls.isPlaying}
          onTogglePlay={playbackControls.togglePlay}
          onReset={playbackControls.handleReset}
          playbackTime={playbackTime}
          totalDuration={audioBuffer?.duration || 0}
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
          autoTrack={playbackControls.autoTrack}
          onToggleAutoTrack={playbackControls.toggleAutoTrack}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
}
export default App;
