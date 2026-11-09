import React, { useRef, useEffect } from "react";
import { MoveHorizontal } from "lucide-react";

interface ChromaVisualizerProps {
  chromaMatrix: number[][];
  chromaTimestampsSec: number[];
  audioDuration: number;
  zoomLevel: number;
  panOffsetSec: number;
  playbackTime?: number;
  onPanChange?: (panSec: number) => void;
  onSeekToTime?: (timeSec: number) => void;
}

const PITCH_LABELS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const ChromaVisualizer: React.FC<ChromaVisualizerProps> = ({
  chromaMatrix,
  chromaTimestampsSec,
  audioDuration,
  zoomLevel,
  panOffsetSec,
  playbackTime = 0,
  onPanChange,
  onSeekToTime
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const totalDuration = audioDuration || 1;
  const visibleDuration = totalDuration / zoomLevel;
  const maxPanOffset = Math.max(0, totalDuration - visibleDuration);
  const currentPan = Math.min(panOffsetSec, maxPanOffset);

  const viewStartSec = currentPan;
  const viewEndSec = Math.min(totalDuration, viewStartSec + visibleDuration);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || audioDuration <= 0 || !onSeekToTime) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const clickTime = viewStartSec + ratio * visibleDuration;
    onSeekToTime(clickTime);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || chromaMatrix.length === 0 || audioDuration <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const pitchHeight = height / 12;
    const numFrames = chromaMatrix.length;

    // Render frames within zoomed view window
    for (let f = 0; f < numFrames; f++) {
      const timeSec = chromaTimestampsSec[f] || 0;

      if (timeSec >= viewStartSec - 0.2 && timeSec <= viewEndSec + 0.2) {
        const x = ((timeSec - viewStartSec) / visibleDuration) * width;
        const frameWidth = Math.max(2, (width / numFrames) * zoomLevel);
        const chroma = chromaMatrix[f];

        for (let p = 0; p < 12; p++) {
          const val = chroma[p] || 0;
          const y = height - (p + 1) * pitchHeight;

          const hue = 260 - val * 180;
          const lightness = 10 + val * 55;
          ctx.fillStyle = `hsl(${hue}, 85%, ${lightness}%)`;
          ctx.fillRect(x, y, frameWidth + 0.5, pitchHeight);
        }
      }
    }

    // Draw Pitch Row Guides & Labels
    ctx.font = "bold 10px sans-serif";
    for (let p = 0; p < 12; p++) {
      const y = height - p * pitchHeight - 3;
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillText(PITCH_LABELS[p], 5, y);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.beginPath();
      ctx.moveTo(0, height - p * pitchHeight);
      ctx.lineTo(width, height - p * pitchHeight);
      ctx.stroke();
    }

    // Draw Red Vertical Playhead Line for complete consistency with Waveform Viewer
    if (playbackTime >= viewStartSec && playbackTime <= viewEndSec) {
      const playheadX = ((playbackTime - viewStartSec) / visibleDuration) * width;
      ctx.beginPath();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2.5;
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [chromaMatrix, chromaTimestampsSec, audioDuration, viewStartSec, viewEndSec, visibleDuration, zoomLevel, playbackTime]);

  return (
    <div className="glass-panel" style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>12-Pitch Class Chromagram Matrix Heatmap</h3>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          {zoomLevel > 1 ? `Synchronized ${zoomLevel}x Zoom View (${viewStartSec.toFixed(2)}s – ${viewEndSec.toFixed(2)}s)` : "C to B Pitch Classes (STFT Frequency-to-Pitch Mapping)"}
        </span>
      </div>

      <div style={{ position: "relative", width: "100%", height: "120px" }}>
        <canvas
          ref={canvasRef}
          width={1000}
          height={120}
          onClick={handleCanvasClick}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "var(--radius-sm)",
            display: "block",
            cursor: onSeekToTime ? "pointer" : "default"
          }}
        />
      </div>

      {/* Horizontal Pan Scroller Slider for Pitch Heatmap */}
      {zoomLevel > 1 && onPanChange && (
        <div style={{
          marginTop: "0.6rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          background: "var(--bg-secondary)",
          padding: "0.4rem 0.75rem",
          borderRadius: "var(--radius-sm)"
        }}>
          <MoveHorizontal size={16} color="var(--accent-purple)" />
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
            Pan Scroller:
          </span>
          <input
            type="range"
            min={0}
            max={maxPanOffset}
            step={0.1}
            value={currentPan}
            onChange={(e) => onPanChange(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: "var(--accent-purple)" }}
          />
          <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--accent-purple)", whiteSpace: "nowrap" }}>
            View: {viewStartSec.toFixed(2)}s – {viewEndSec.toFixed(2)}s ({zoomLevel}x Zoom)
          </span>
        </div>
      )}
    </div>
  );
};
