import React, { useMemo } from "react";
import { Activity, Clock, Disc } from "lucide-react";
import type { SongGraph } from "../types/songGraph";

interface BeatBlinkerProps {
  playbackTime: number;
  songGraph: SongGraph | null;
  isPlaying: boolean;
  timeSignature: string;
}

export const BeatBlinker: React.FC<BeatBlinkerProps> = ({
  playbackTime,
  songGraph,
  isPlaying,
  timeSignature
}) => {
  const downbeats = songGraph?.canonical.downbeats || [];
  const bpm = songGraph?.canonical.original_tempo_bpm || 90;
  const beatsPerMeasure = timeSignature === "3/4" ? 3 : timeSignature === "6/8" ? 6 : 4;
  const beatIntervalSec = 60 / bpm;

  // Calculate current measure, beat number, and pulse flash intensity
  const beatState = useMemo(() => {
    if (downbeats.length === 0 || !isPlaying) {
      return {
        currentMeasure: 1,
        currentBeat: 1,
        isDownbeat: false,
        flashOpacity: 0.2,
        isNearBeat: false
      };
    }

    // Find current measure index based on downbeats
    let measureIdx = 0;
    for (let i = 0; i < downbeats.length; i++) {
      if (playbackTime >= downbeats[i]) {
        measureIdx = i;
      } else {
        break;
      }
    }

    const measureStartSec = downbeats[measureIdx] || 0;
    const timeInMeasure = Math.max(0, playbackTime - measureStartSec);
    const beatInMeasure = Math.floor(timeInMeasure / beatIntervalSec);
    const currentBeat = Math.min(beatsPerMeasure, Math.max(1, beatInMeasure + 1));
    const isDownbeat = currentBeat === 1;

    // Pulse decay flash intensity within 150ms of beat hit
    const beatTimeSec = measureStartSec + (currentBeat - 1) * beatIntervalSec;
    const timeSinceBeat = Math.max(0, playbackTime - beatTimeSec);
    const isNearBeat = timeSinceBeat < 0.15;
    const flashOpacity = isNearBeat ? 1.0 - timeSinceBeat / 0.15 : 0.2;

    return {
      currentMeasure: measureIdx + 1,
      currentBeat,
      isDownbeat,
      flashOpacity,
      isNearBeat
    };
  }, [playbackTime, downbeats, bpm, beatIntervalSec, beatsPerMeasure, isPlaying]);

  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: "1px solid var(--bg-card-border)",
      borderRadius: "var(--radius-sm)",
      padding: "0.6rem 1rem",
      marginBottom: "0.75rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: "1rem"
    }}>
      {/* Beat LED Blinker & Measure Counter */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {/* Main LED Flasher Ring */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            background: beatState.isNearBeat
              ? beatState.isDownbeat ? "#10b981" : "#06b6d4"
              : "rgba(255, 255, 255, 0.1)",
            boxShadow: beatState.isNearBeat
              ? beatState.isDownbeat
                ? "0 0 16px #10b981, 0 0 30px #10b981"
                : "0 0 12px #06b6d4, 0 0 24px #06b6d4"
              : "none",
            transition: "all 0.05s ease-out"
          }} />
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: beatState.isDownbeat ? "var(--accent-green)" : "var(--accent-cyan)" }}>
            {beatState.isDownbeat ? "DOWNBEAT" : `BEAT ${beatState.currentBeat}`}
          </span>
        </div>

        {/* Measure & Beat Numbers Display */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "rgba(0, 0, 0, 0.3)",
          padding: "0.3rem 0.75rem",
          borderRadius: "var(--radius-sm)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.85rem"
        }}>
          <Disc size={15} color="var(--accent-purple)" />
          <span>MEASURE <strong style={{ color: "var(--accent-green)" }}>{beatState.currentMeasure}</strong></span>
          <span style={{ color: "var(--text-secondary)" }}>•</span>
          <span>BEAT <strong style={{ color: "var(--accent-cyan)" }}>{beatState.currentBeat}</strong> / {beatsPerMeasure}</span>
        </div>
      </div>

      {/* Beat Subdivision Indicator Dots */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        {Array.from({ length: beatsPerMeasure }).map((_, idx) => {
          const beatNum = idx + 1;
          const isActive = beatState.currentBeat === beatNum && isPlaying;
          const isDown = beatNum === 1;

          return (
            <div
              key={beatNum}
              style={{
                width: isDown ? "36px" : "28px",
                height: "26px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                background: isActive
                  ? isDown ? "#10b981" : "#06b6d4"
                  : "rgba(255, 255, 255, 0.06)",
                color: isActive ? "#000" : "var(--text-secondary)",
                boxShadow: isActive ? (isDown ? "0 0 10px #10b981" : "0 0 8px #06b6d4") : "none",
                transition: "all 0.08s ease"
              }}
            >
              {beatNum}
            </div>
          );
        })}
      </div>

      {/* BPM & Timing Info HUD */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <Activity size={15} color="var(--accent-amber)" />
          <strong style={{ color: "var(--text-primary)" }}>{bpm} BPM</strong> ({timeSignature})
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <Clock size={15} color="var(--accent-cyan)" />
          <span>{(beatIntervalSec * 1000).toFixed(0)} ms / beat</span>
        </span>
      </div>
    </div>
  );
};
