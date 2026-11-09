import React, { useRef, useEffect, useState, useCallback } from "react";
import { Loader2, ZoomIn, ZoomOut, MoveHorizontal, Compass, Play, Pause, RotateCcw } from "lucide-react";
import { BeatBlinker } from "./BeatBlinker";
import type { SongGraph } from "../types/songGraph";

interface WaveformViewerProps {
  audioBuffer: AudioBuffer | null;
  songGraph: SongGraph | null;
  onsetEnvelope: number[];
  hopDurationSec: number;
  isProcessing?: boolean;
  zoomLevel: number;
  panOffsetSec: number;
  onZoomChange: (zoom: number) => void;
  onPanChange: (panSec: number) => void;
  onPlaybackTimeUpdate?: (timeSec: number) => void;
  externalSeekTime?: number | null;
  onPlaybackStateChange?: (state: { isPlaying: boolean; togglePlay: () => void; handleReset: () => void; autoTrack: boolean; toggleAutoTrack: () => void; playbackTime: number }) => void;
}

export const WaveformViewer: React.FC<WaveformViewerProps> = ({
  audioBuffer,
  songGraph,
  onsetEnvelope,
  hopDurationSec,
  isProcessing = false,
  zoomLevel,
  panOffsetSec,
  onZoomChange,
  onPanChange,
  onPlaybackTimeUpdate,
  externalSeekTime,
  onPlaybackStateChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [autoTrack, setAutoTrack] = useState(true);

  const startTimeRef = useRef<number>(0);
  const startOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const playbackTimeRef = useRef<number>(0);
  const audioBufferRef = useRef<AudioBuffer | null>(audioBuffer);
  const isProcessingRef = useRef<boolean>(isProcessing);

  const totalDuration = audioBuffer?.duration || 1;
  const visibleDuration = totalDuration / zoomLevel;
  const maxPanOffset = Math.max(0, totalDuration - visibleDuration);
  const currentPan = Math.min(panOffsetSec, maxPanOffset);

  const viewStartSec = currentPan;
  const viewEndSec = Math.min(totalDuration, viewStartSec + visibleDuration);
  const timeSignature = songGraph?.canonical.original_time_signature || "3/4";
  const bpm = songGraph?.canonical.original_tempo_bpm || 90;
  const beatsPerMeasure = timeSignature === "3/4" ? 3 : timeSignature === "6/8" ? 6 : 4;
  const beatIntervalSec = 60 / bpm;

  // Sync refs for smooth animation frame access
  const zoomLevelRef = useRef(zoomLevel);
  const visibleDurationRef = useRef(visibleDuration);
  const totalDurationRef = useRef(totalDuration);
  const autoTrackRef = useRef(autoTrack);
  const onPanChangeRef = useRef(onPanChange);
  const onPlaybackTimeUpdateRef = useRef(onPlaybackTimeUpdate);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    playbackTimeRef.current = playbackTime;
    audioBufferRef.current = audioBuffer;
    isProcessingRef.current = isProcessing;
    zoomLevelRef.current = zoomLevel;
    visibleDurationRef.current = visibleDuration;
    totalDurationRef.current = totalDuration;
    autoTrackRef.current = autoTrack;
    onPanChangeRef.current = onPanChange;
    onPlaybackTimeUpdateRef.current = onPlaybackTimeUpdate;
  });

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // External seek handler (e.g. clicking a line in LyricScroller)
  const prevExternalSeekRef = useRef<number | null>(null);
  useEffect(() => {
    if (externalSeekTime !== undefined && externalSeekTime !== null && externalSeekTime !== prevExternalSeekRef.current) {
      prevExternalSeekRef.current = externalSeekTime;
      const wasPlaying = isPlayingRef.current;
      if (isPlayingRef.current && sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
      startOffsetRef.current = externalSeekTime;
      setPlaybackTime(externalSeekTime);
      if (onPlaybackTimeUpdateRef.current) onPlaybackTimeUpdateRef.current(externalSeekTime);

      if (autoTrackRef.current && zoomLevelRef.current > 1) {
        const visDur = visibleDurationRef.current;
        const totDur = totalDurationRef.current;
        const maxPan = Math.max(0, totDur - visDur);
        const targetPan = Math.max(0, Math.min(maxPan, externalSeekTime - visDur / 2));
        onPanChangeRef.current(targetPan);
      }

      if (wasPlaying && audioContextRef.current && audioBufferRef.current) {
        const ctx = audioContextRef.current;
        const source = ctx.createBufferSource();
        source.buffer = audioBufferRef.current;
        source.connect(ctx.destination);
        source.start(0, externalSeekTime);
        sourceNodeRef.current = source;
        startTimeRef.current = ctx.currentTime - externalSeekTime;
        isPlayingRef.current = true;
        setIsPlaying(true);
      }
    }
  }, [externalSeekTime]);

  const togglePlay = useCallback(() => {
    const buffer = audioBufferRef.current;
    if (!buffer || isProcessingRef.current) return;

    if (isPlayingRef.current) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch (e) {}
        try { sourceNodeRef.current.disconnect(); } catch (e) {}
      }
      if (audioContextRef.current) {
        startOffsetRef.current = playbackTimeRef.current;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    } else {
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const offset = startOffsetRef.current >= buffer.duration ? 0 : startOffsetRef.current;
      source.start(0, offset);
      sourceNodeRef.current = source;
      startTimeRef.current = ctx.currentTime - offset;

      isPlayingRef.current = true;
      setIsPlaying(true);

      const updateProgress = () => {
        if (!isPlayingRef.current) return;

        const curTime = ctx.currentTime - startTimeRef.current;
        if (curTime >= buffer.duration) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          setPlaybackTime(0);
          playbackTimeRef.current = 0;
          startOffsetRef.current = 0;
          if (onPlaybackTimeUpdateRef.current) onPlaybackTimeUpdateRef.current(0);
        } else {
          setPlaybackTime(curTime);
          playbackTimeRef.current = curTime;
          if (onPlaybackTimeUpdateRef.current) onPlaybackTimeUpdateRef.current(curTime);

          if (autoTrackRef.current && zoomLevelRef.current > 1) {
            const visDur = visibleDurationRef.current;
            const totDur = totalDurationRef.current;
            const maxPan = Math.max(0, totDur - visDur);
            const targetPan = Math.max(0, Math.min(maxPan, curTime - visDur / 2));
            onPanChangeRef.current(targetPan);
          }

          animFrameRef.current = requestAnimationFrame(updateProgress);
        }
      };

      animFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (sourceNodeRef.current && isPlayingRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    setPlaybackTime(0);
    playbackTimeRef.current = 0;
    startOffsetRef.current = 0;
    if (onPlaybackTimeUpdateRef.current) onPlaybackTimeUpdateRef.current(0);
    if (zoomLevelRef.current > 1 && autoTrackRef.current) {
      onPanChangeRef.current(0);
    }
  }, []);

  // Register stable playback controls callback to parent
  useEffect(() => {
    if (onPlaybackStateChange) {
      onPlaybackStateChange({
        isPlaying,
        togglePlay,
        handleReset,
        autoTrack,
        toggleAutoTrack: () => setAutoTrack(!autoTrack),
        playbackTime
      });
    }
  }, [isPlaying, autoTrack, playbackTime, togglePlay, handleReset, onPlaybackStateChange]);

  // Global Spacebar shortcut for toggling Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && (e.target === document.body || (e.target as HTMLElement).tagName === "BODY")) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioBuffer || !canvasRef.current || isProcessing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const newTime = viewStartSec + ratio * visibleDuration;

    const wasPlaying = isPlayingRef.current;
    if (isPlayingRef.current && sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (err) {}
    }

    startOffsetRef.current = newTime;
    setPlaybackTime(newTime);
    playbackTimeRef.current = newTime;
    if (onPlaybackTimeUpdate) onPlaybackTimeUpdate(newTime);

    if (autoTrack && zoomLevel > 1) {
      const targetPan = Math.max(0, Math.min(maxPanOffset, newTime - visibleDuration / 2));
      onPanChange(targetPan);
    }

    if (wasPlaying && audioContextRef.current) {
      const ctx = audioContextRef.current;
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(0, newTime);
      sourceNodeRef.current = source;
      startTimeRef.current = ctx.currentTime - newTime;
      isPlayingRef.current = true;
      setIsPlaying(true);
    }
  };

  // Canvas Waveform & Beat Grid Overlay Renderer with Zoom Viewport
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const channelData = audioBuffer.getChannelData(0);

    const startSample = Math.floor((viewStartSec / totalDuration) * channelData.length);
    const endSample = Math.floor((viewEndSec / totalDuration) * channelData.length);
    const numViewSamples = Math.max(1, endSample - startSample);
    const step = Math.ceil(numViewSamples / width);

    // Draw Background
    ctx.fillStyle = "rgba(10, 12, 18, 0.95)";
    ctx.fillRect(0, 0, width, height);

    // Draw Waveform
    ctx.beginPath();
    ctx.strokeStyle = "rgba(6, 182, 212, 0.75)";
    ctx.lineWidth = 1.5;

    for (let i = 0; i < width; i++) {
      const sampleIdx = startSample + Math.floor(i * step);
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j += 2) {
        const val = channelData[sampleIdx + j] || 0;
        if (val < min) min = val;
        if (val > max) max = val;
      }
      const yMin = ((1 + min) / 2) * height;
      const yMax = ((1 + max) / 2) * height;
      ctx.moveTo(i, yMin);
      ctx.lineTo(i, yMax);
    }
    ctx.stroke();

    // Draw Onset Envelope within Zoom Window
    if (onsetEnvelope.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
      ctx.lineWidth = 1.5;
      let started = false;

      for (let i = 0; i < onsetEnvelope.length; i++) {
        const timeSec = i * hopDurationSec;
        if (timeSec >= viewStartSec && timeSec <= viewEndSec) {
          const x = ((timeSec - viewStartSec) / visibleDuration) * width;
          const y = height - onsetEnvelope[i] * (height * 0.45);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
    }

    // Draw Measure Downbeats & Beat Subdivisions on Canvas
    if (songGraph && songGraph.canonical.downbeats) {
      songGraph.canonical.downbeats.forEach((dbTime, idx) => {
        for (let b = 1; b <= beatsPerMeasure; b++) {
          const beatTime = dbTime + (b - 1) * beatIntervalSec;

          if (beatTime >= viewStartSec && beatTime <= viewEndSec) {
            const x = ((beatTime - viewStartSec) / visibleDuration) * width;

            if (b === 1) {
              ctx.beginPath();
              ctx.strokeStyle = "rgba(16, 185, 129, 0.9)";
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 4]);
              ctx.moveTo(x, 0);
              ctx.lineTo(x, height);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.fillStyle = "#10b981";
              ctx.font = "bold 12px sans-serif";
              ctx.fillText(`M${idx + 1}`, x + 4, 16);
            } else {
              ctx.beginPath();
              ctx.strokeStyle = "rgba(6, 182, 212, 0.45)";
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 4]);
              ctx.moveTo(x, 22);
              ctx.lineTo(x, height);
              ctx.stroke();
              ctx.setLineDash([]);

              if (zoomLevel >= 2) {
                ctx.fillStyle = "rgba(6, 182, 212, 0.85)";
                ctx.font = "10px monospace";
                ctx.fillText(`b${b}`, x + 3, 34);
              }
            }
          }
        }
      });
    }

    // Draw Playhead Line
    if (playbackTime >= viewStartSec && playbackTime <= viewEndSec) {
      const playheadX = ((playbackTime - viewStartSec) / visibleDuration) * width;
      ctx.beginPath();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2.5;
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [audioBuffer, songGraph, onsetEnvelope, hopDurationSec, playbackTime, viewStartSec, viewEndSec, visibleDuration, totalDuration, beatsPerMeasure, beatIntervalSec, zoomLevel]);

  return (
    <div className="glass-panel" style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Audio Waveform & Beat Grid Overlay</h3>

        {/* Clean Header Bar Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {/* Zoom Presets */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "var(--bg-secondary)", padding: "0.25rem", borderRadius: "var(--radius-sm)" }}>
            <button
              className="btn btn-secondary"
              onClick={() => onZoomChange(Math.max(1, zoomLevel / 2))}
              disabled={zoomLevel <= 1}
              style={{ padding: "0.25rem 0.4rem" }}
              title="Zoom Out (-)"
            >
              <ZoomOut size={14} />
            </button>

            {[1, 2, 4, 8, 16].map((lvl) => (
              <button
                key={lvl}
                className={`btn ${zoomLevel === lvl ? "btn-primary" : "btn-secondary"}`}
                onClick={() => onZoomChange(lvl)}
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
              >
                {lvl}x
              </button>
            ))}

            <button
              className="btn btn-secondary"
              onClick={() => onZoomChange(Math.min(32, zoomLevel * 2))}
              disabled={zoomLevel >= 32}
              style={{ padding: "0.25rem 0.4rem" }}
              title="Zoom In (+)"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          {zoomLevel > 1 && (
            <button
              className={`btn ${autoTrack ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setAutoTrack(!autoTrack)}
              style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
              title="Keep playhead centered in view during playback"
            >
              <Compass size={14} />
              {autoTrack ? "Auto-Follow ON" : "Auto-Follow OFF"}
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button className="btn btn-secondary" onClick={handleReset} style={{ padding: "0.4rem" }} disabled={isProcessing}>
              <RotateCcw size={16} />
            </button>
            <button className="btn btn-primary" onClick={togglePlay} disabled={!audioBuffer || isProcessing} style={{ padding: "0.4rem 1rem" }}>
              {isProcessing ? <Loader2 size={16} className="spin-icon" /> : isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isProcessing ? "Loading..." : isPlaying ? "Pause" : "Play"}
            </button>
            <span style={{ fontSize: "0.85rem", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
              {playbackTime.toFixed(2)}s / {(audioBuffer?.duration || 0).toFixed(2)}s
            </span>
          </div>
        </div>
      </div>

      {/* Visual Beat Blinker & Metronome HUD */}
      <BeatBlinker
        playbackTime={playbackTime}
        songGraph={songGraph}
        isPlaying={isPlaying}
        timeSignature={timeSignature}
      />

      {/* Canvas Viewport */}
      <div style={{ position: "relative", width: "100%", height: "140px" }}>
        <canvas
          ref={canvasRef}
          width={1000}
          height={140}
          onClick={handleCanvasClick}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "var(--radius-sm)",
            cursor: isProcessing ? "wait" : "pointer",
            display: "block"
          }}
        />

        {isProcessing && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(13, 15, 20, 0.75)",
            backdropFilter: "blur(4px)",
            borderRadius: "var(--radius-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            color: "var(--accent-cyan)",
            fontWeight: 600,
            fontSize: "0.9rem"
          }}>
            <Loader2 size={24} className="spin-icon" />
            <span>Analyzing Audio Signal & Extracting Beats/Chords...</span>
          </div>
        )}
      </div>

      {/* Horizontal Pan Scroller Slider when Zoomed In */}
      {zoomLevel > 1 && (
        <div style={{
          marginTop: "0.6rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          background: "var(--bg-secondary)",
          padding: "0.4rem 0.75rem",
          borderRadius: "var(--radius-sm)"
        }}>
          <MoveHorizontal size={16} color="var(--accent-cyan)" />
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
            Pan Scroller:
          </span>
          <input
            type="range"
            min={0}
            max={maxPanOffset}
            step={0.1}
            value={currentPan}
            onChange={(e) => {
              setAutoTrack(false);
              autoTrackRef.current = false;
              onPanChange(parseFloat(e.target.value));
            }}
            style={{ flex: 1, accentColor: "var(--accent-cyan)" }}
          />
          <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--accent-cyan)", whiteSpace: "nowrap" }}>
            View: {viewStartSec.toFixed(2)}s – {viewEndSec.toFixed(2)}s ({zoomLevel}x Zoom)
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ width: "12px", height: "3px", background: "var(--accent-cyan)", borderRadius: "2px" }} /> Raw Waveform
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ width: "12px", height: "3px", background: "var(--accent-amber)", borderRadius: "2px" }} /> Onset Energy Flux
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ width: "12px", height: "3px", background: "var(--accent-green)", borderRadius: "2px" }} /> Measure Downbeats (M1, M2...)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ width: "12px", height: "3px", background: "var(--accent-cyan)", opacity: 0.6, borderRadius: "2px" }} /> Beats (b2, b3...)
        </span>
      </div>
    </div>
  );
};
