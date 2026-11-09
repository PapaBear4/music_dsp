import React from "react";
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut, Compass } from "lucide-react";

interface FloatingDAWControlBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  playbackTime: number;
  totalDuration: number;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  autoTrack: boolean;
  onToggleAutoTrack: () => void;
  isProcessing?: boolean;
}

export const FloatingDAWControlBar: React.FC<FloatingDAWControlBarProps> = ({
  isPlaying,
  onTogglePlay,
  onReset,
  playbackTime,
  totalDuration,
  zoomLevel,
  onZoomChange,
  autoTrack,
  onToggleAutoTrack,
  isProcessing = false
}) => {
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(1);
    const paddedSecs = parseFloat(secs) < 10 ? `0${secs}` : secs;
    return `${mins < 10 ? `0${mins}` : mins}:${paddedSecs}`;
  };

  return (
    <div style={{
      position: "fixed",
      bottom: "1rem",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 99999,
      background: "rgba(15, 23, 42, 0.92)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: "1px solid rgba(6, 182, 212, 0.5)",
      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(6, 182, 212, 0.25)",
      borderRadius: "24px",
      padding: "0.35rem 0.85rem",
      display: "flex",
      alignItems: "center",
      gap: "0.6rem"
    }}>
      {/* Reset Button */}
      <button
        className="btn btn-secondary"
        onClick={onReset}
        disabled={isProcessing}
        style={{ padding: "0.3rem", borderRadius: "50%", minWidth: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center" }}
        title="Reset Playhead (00:00)"
      >
        <RotateCcw size={14} />
      </button>

      {/* Play / Pause Toggle Button */}
      <button
        className="btn btn-primary"
        onClick={onTogglePlay}
        disabled={isProcessing}
        style={{
          padding: "0.3rem 0.85rem",
          borderRadius: "16px",
          background: isPlaying
            ? "linear-gradient(135deg, #10b981, #059669)"
            : "linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))",
          boxShadow: isPlaying ? "0 0 10px rgba(16, 185, 129, 0.5)" : "0 0 10px rgba(6, 182, 212, 0.4)",
          fontSize: "0.8rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: "0.35rem"
        }}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        <span>{isPlaying ? "Pause" : "Play"}</span>
      </button>

      {/* Time Display */}
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.75rem",
        color: "var(--text-primary)",
        whiteSpace: "nowrap"
      }}>
        {formatTime(playbackTime)} / {formatTime(totalDuration)}
      </span>

      <div style={{ width: "1px", height: "18px", background: "rgba(255, 255, 255, 0.2)" }} />

      {/* Zoom Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.2rem", background: "rgba(255, 255, 255, 0.06)", padding: "0.15rem 0.35rem", borderRadius: "14px" }}>
        <button
          className="btn btn-secondary"
          onClick={() => onZoomChange(Math.max(1, zoomLevel / 2))}
          disabled={zoomLevel <= 1}
          style={{ padding: "0.15rem 0.3rem", borderRadius: "50%", minWidth: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center" }}
          title="Zoom Out"
        >
          <ZoomOut size={12} />
        </button>

        {[1, 2, 4, 8, 16].map((lvl) => (
          <button
            key={lvl}
            className={`btn ${zoomLevel === lvl ? "btn-primary" : "btn-secondary"}`}
            onClick={() => onZoomChange(lvl)}
            style={{ padding: "0.1rem 0.4rem", fontSize: "0.7rem", borderRadius: "10px", minWidth: "24px" }}
          >
            {lvl}x
          </button>
        ))}

        <button
          className="btn btn-secondary"
          onClick={() => onZoomChange(Math.min(32, zoomLevel * 2))}
          disabled={zoomLevel >= 32}
          style={{ padding: "0.15rem 0.3rem", borderRadius: "50%", minWidth: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center" }}
          title="Zoom In"
        >
          <ZoomIn size={12} />
        </button>
      </div>

      {/* Auto-Follow Toggle when Zoomed In */}
      {zoomLevel > 1 && (
        <button
          className={`btn ${autoTrack ? "btn-primary" : "btn-secondary"}`}
          onClick={onToggleAutoTrack}
          style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem", borderRadius: "12px", display: "flex", alignItems: "center", gap: "0.25rem" }}
          title="Keep playhead centered in view during playback"
        >
          <Compass size={12} />
          <span>{autoTrack ? "Auto-Follow" : "Manual Pan"}</span>
        </button>
      )}
    </div>
  );
};
