import React from "react";
import { Sliders, RefreshCw, Clock, Music2, Mic, PlaySquare, X } from "lucide-react";
import type { DSPParams } from "../types/songGraph";

interface DSPParameterPanelProps {
  params: DSPParams;
  onChange: (params: DSPParams) => void;
  onReset: () => void;
  onClose?: () => void;
  detectedKey?: string;
  detectedBpm?: number;
}

export const DSPParameterPanel: React.FC<DSPParameterPanelProps> = ({
  params,
  onChange,
  onReset,
  onClose,
  detectedKey,
  detectedBpm
}) => {
  return (
    <div className="glass-panel" style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "1rem"
    }}>
      {/* Side Panel Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Sliders size={18} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Tuning Sandbox</h3>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button className="btn btn-secondary" onClick={onReset} style={{ fontSize: "0.75rem", padding: "0.3rem 0.5rem" }} title="Reset to Defaults">
            <RefreshCw size={13} /> Reset
          </button>
          {onClose && (
            <button className="btn btn-secondary" onClick={onClose} style={{ padding: "0.3rem" }} title="Close Side Panel">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Detected Info Badges */}
      {(detectedBpm || detectedKey) && (
        <div style={{
          display: "flex",
          gap: "0.5rem",
          background: "var(--bg-secondary)",
          padding: "0.5rem 0.75rem",
          borderRadius: "var(--radius-sm)",
          fontSize: "0.75rem"
        }}>
          {detectedBpm && (
            <span style={{ color: "var(--accent-green)", fontWeight: 600 }}>
              BPM: {detectedBpm}
            </span>
          )}
          {detectedBpm && detectedKey && <span style={{ color: "var(--text-secondary)" }}>•</span>}
          {detectedKey && (
            <span style={{ color: "var(--accent-purple)", fontWeight: 600 }}>
              Key: {detectedKey}
            </span>
          )}
        </div>
      )}

      {/* Scrollable Control Stack */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        overflowY: "auto",
        paddingRight: "0.2rem",
        flex: 1
      }}>
        {/* Onset & Tempo Tuning Box */}
        <div style={{ background: "var(--bg-secondary)", padding: "0.85rem", borderRadius: "var(--radius-sm)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem", color: "var(--accent-cyan)", fontWeight: 600, fontSize: "0.85rem" }}>
            <Clock size={16} /> Onset & Beat Detection
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
              <span>Onset Sensitivity</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>{params.onsetThreshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.01}
              max={0.4}
              step={0.01}
              value={params.onsetThreshold}
              onChange={(e) => onChange({ ...params, onsetThreshold: parseFloat(e.target.value) })}
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div>
              <label style={{ fontSize: "0.7rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.2rem" }}>
                Min BPM ({params.minBpm})
              </label>
              <input
                type="range"
                min={40}
                max={140}
                value={params.minBpm}
                onChange={(e) => onChange({ ...params, minBpm: parseInt(e.target.value, 10) })}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.7rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.2rem" }}>
                Max BPM ({params.maxBpm})
              </label>
              <input
                type="range"
                min={120}
                max={240}
                value={params.maxBpm}
                onChange={(e) => onChange({ ...params, maxBpm: parseInt(e.target.value, 10) })}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div style={{ marginTop: "0.5rem" }}>
            <label style={{ fontSize: "0.7rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.2rem" }}>
              Manual BPM Override (Leave 0 for auto)
            </label>
            <input
              type="number"
              className="input-field"
              value={params.manualBpm || 0}
              placeholder="Auto"
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                onChange({ ...params, manualBpm: v > 0 ? v : null });
              }}
            />
          </div>
        </div>

        {/* Pickup Measure & First Downbeat Grid Shift */}
        <div style={{ background: "var(--bg-secondary)", padding: "0.85rem", borderRadius: "var(--radius-sm)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem", color: "var(--accent-green)", fontWeight: 600, fontSize: "0.85rem" }}>
            <PlaySquare size={16} /> Pickup & Downbeat Grid Shift
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ fontSize: "0.7rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.2rem" }}>
              Pickup Measure Beats (Before M1)
            </label>
            <select
              className="input-field"
              value={params.pickupBeats || 0}
              onChange={(e) => onChange({ ...params, pickupBeats: parseInt(e.target.value, 10) })}
            >
              <option value={0}>0 Beats (No Pickup)</option>
              <option value={1}>1 Beat Pickup (Amazing Grace)</option>
              <option value={2}>2 Beats Pickup</option>
              <option value={3}>3 Beats Pickup</option>
            </select>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
              <span>First Downbeat Shift</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-green)" }}>
                {params.firstBeatOffsetSec > 0 ? `+${params.firstBeatOffsetSec.toFixed(2)}s` : `${params.firstBeatOffsetSec.toFixed(2)}s`}
              </span>
            </div>
            <input
              type="range"
              min={-5.0}
              max={5.0}
              step={0.05}
              value={params.firstBeatOffsetSec || 0}
              onChange={(e) => onChange({ ...params, firstBeatOffsetSec: parseFloat(e.target.value) })}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* Pitch & Chord Extraction Tuning Box */}
        <div style={{ background: "var(--bg-secondary)", padding: "0.85rem", borderRadius: "var(--radius-sm)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem", color: "var(--accent-purple)", fontWeight: 600, fontSize: "0.85rem" }}>
            <Music2 size={16} /> Chroma & Chord Detection
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ fontSize: "0.7rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.2rem" }}>
              FFT Window Size
            </label>
            <select
              className="input-field"
              value={params.fftSize}
              onChange={(e) => onChange({ ...params, fftSize: parseInt(e.target.value, 10) })}
            >
              <option value={1024}>1024 (Fast / Low Pitch Res)</option>
              <option value={2048}>2048 (Balanced Standard)</option>
              <option value={4096}>4096 (High Pitch Res)</option>
            </select>
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
              <span>Chord Confidence Threshold</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-purple)" }}>{params.chordConfidence.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={0.9}
              step={0.05}
              value={params.chordConfidence}
              onChange={(e) => onChange({ ...params, chordConfidence: parseFloat(e.target.value) })}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
              <span>Smoothing Window</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-purple)" }}>{params.chordSmoothingWindow} frames</span>
            </div>
            <input
              type="range"
              min={1}
              max={15}
              step={2}
              value={params.chordSmoothingWindow}
              onChange={(e) => onChange({ ...params, chordSmoothingWindow: parseInt(e.target.value, 10) })}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* Extended Lyric Offset & Syllable Alignment Box */}
        <div style={{ background: "var(--bg-secondary)", padding: "0.85rem", borderRadius: "var(--radius-sm)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem", color: "var(--accent-amber)", fontWeight: 600, fontSize: "0.85rem" }}>
            <Mic size={16} /> Lyric Alignment Offset
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", marginBottom: "0.3rem" }}>
              <span>Global Lyric Offset</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <input
                  type="number"
                  step="0.1"
                  className="input-field"
                  value={params.lyricTimeOffset}
                  onChange={(e) => onChange({ ...params, lyricTimeOffset: parseFloat(e.target.value) || 0 })}
                  style={{ width: "75px", padding: "0.15rem 0.4rem", fontSize: "0.75rem", textAlign: "right", fontFamily: "var(--font-mono)" }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--accent-amber)" }}>sec</span>
              </div>
            </div>

            {/* Slider with expanded +/- 60s range */}
            <input
              type="range"
              min={-60.0}
              max={60.0}
              step={0.1}
              value={params.lyricTimeOffset}
              onChange={(e) => onChange({ ...params, lyricTimeOffset: parseFloat(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--accent-amber)" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
            <input
              type="checkbox"
              id="autoAlignCheck"
              checked={params.autoAlignLyrics}
              onChange={(e) => onChange({ ...params, autoAlignLyrics: e.target.checked })}
              style={{ accentColor: "var(--accent-amber)", width: "16px", height: "16px" }}
            />
            <label htmlFor="autoAlignCheck" style={{ fontSize: "0.75rem", cursor: "pointer" }}>
              Auto-align line starts to downbeats
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
