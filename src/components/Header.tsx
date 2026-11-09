import React from "react";
import { Music, Upload, Sparkles, Search, Sun, Moon, Loader2, Sliders, Mic, ShieldCheck, CheckCircle2, FileCode } from "lucide-react";
import type { DSPParams } from "../types/songGraph";
import type { CanonicalTrackMetadata } from "../dsp/canonicalMetadataFetcher";

interface HeaderProps {
  title: string;
  artist: string;
  onTitleChange: (val: string) => void;
  onArtistChange: (val: string) => void;
  dspParams: DSPParams;
  onParamsChange: (params: DSPParams) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGpUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerateSynthetic: () => void;
  onOpenLrcModal: () => void;
  onOpenWhisperModal: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  isProcessing: boolean;
  isTuningPanelOpen: boolean;
  onToggleTuningPanel: () => void;
  canonicalMetadata?: CanonicalTrackMetadata | null;
  onFetchCanonicalMetadata?: () => void;
}

const TUNING_PRESETS = [
  { label: "Standard (EADGBE)", value: "EADGBE" },
  { label: "Half-Step Down (Eb Ab Db Gb Bb Eb)", value: "Eb Ab Db Gb Bb Eb" },
  { label: "Whole-Step Down (D G C F A D)", value: "D G C F A D" },
  { label: "Baritone (B E A D F# B)", value: "B E A D F# B" },
  { label: "Drop D (DADGBE)", value: "DADGBE" }
];

export const Header: React.FC<HeaderProps> = ({
  title,
  artist,
  onTitleChange,
  onArtistChange,
  dspParams,
  onParamsChange,
  onFileUpload,
  onGpUpload,
  onGenerateSynthetic,
  onOpenLrcModal,
  onOpenWhisperModal,
  theme,
  onToggleTheme,
  isProcessing,
  isTuningPanelOpen,
  onToggleTuningPanel,
  canonicalMetadata,
  onFetchCanonicalMetadata
}) => {
  return (
    <header className="glass-panel" style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            background: "linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))",
            padding: "0.6rem",
            borderRadius: "var(--radius-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Music size={24} color="#fff" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                Guitarist SongGraph DSP Workbench
              </h1>
              {isProcessing && (
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.75rem",
                  background: "rgba(6, 182, 212, 0.15)",
                  color: "var(--accent-cyan)",
                  padding: "0.25rem 0.6rem",
                  borderRadius: "12px",
                  border: "1px solid rgba(6, 182, 212, 0.3)"
                }} className="pulse-loading">
                  <Loader2 size={14} className="spin-icon" />
                  <span>Processing Audio...</span>
                </div>
              )}
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Audio feature extraction algorithm tuner & beat/chord/lyric pipeline
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {/* Canonical Cross-Validation Verification Badge */}
          {canonicalMetadata && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              background: canonicalMetadata.sourceMatch.isVerifiedMatch ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
              border: canonicalMetadata.sourceMatch.isVerifiedMatch ? "1px solid #10b981" : "1px solid var(--accent-amber)",
              borderRadius: "14px",
              padding: "0.25rem 0.65rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: canonicalMetadata.sourceMatch.isVerifiedMatch ? "#10b981" : "var(--accent-amber)"
            }}>
              {canonicalMetadata.sourceMatch.isVerifiedMatch ? <CheckCircle2 size={14} /> : <ShieldCheck size={14} />}
              <span>
                {canonicalMetadata.sourceMatch.isVerifiedMatch
                  ? "Songsterr + MusicBrainz Verified Match"
                  : canonicalMetadata.sourceMatch.songsterrFound
                  ? "Songsterr Matched"
                  : "MusicBrainz Matched"}
              </span>
            </div>
          )}

          {onFetchCanonicalMetadata && (
            <button
              className="btn btn-secondary"
              onClick={onFetchCanonicalMetadata}
              style={{ fontSize: "0.75rem", padding: "0.4rem 0.65rem" }}
              title="Cross-check Songsterr API and MusicBrainz API to verify canonical tuning, capo, and time signature"
            >
              <ShieldCheck size={14} color="var(--accent-cyan)" /> Cross-Check APIs
            </button>
          )}

          <button
            className={`btn ${isTuningPanelOpen ? "btn-primary" : "btn-secondary"}`}
            onClick={onToggleTuningPanel}
            title="Toggle Tuning Sandbox Side Panel"
          >
            <Sliders size={16} /> Tuning Sandbox
          </button>

          <button
            className="btn btn-secondary"
            onClick={onOpenWhisperModal}
            disabled={isProcessing}
            title="Local Whisper Sung Lyric Listener"
          >
            <Mic size={16} color="var(--accent-purple)" /> Local Whisper Listener
          </button>

          <button
            className="btn btn-secondary"
            onClick={onToggleTheme}
            title="Toggle Light/Dark Theme"
            style={{ padding: "0.5rem" }}
          >
            {theme === "dark" ? <Sun size={18} color="var(--accent-amber)" /> : <Moon size={18} color="var(--accent-purple)" />}
          </button>

          <button
            className="btn btn-secondary"
            onClick={onOpenLrcModal}
            disabled={isProcessing}
            title="Fetch synced lyrics from LRCLIB.net"
          >
            <Search size={16} /> Fetch LRCLIB Lyrics
          </button>

          {/* Guitar Pro File Import (.gp, .gpx, .gp5) Button */}
          {onGpUpload && (
            <label className={`btn btn-secondary ${isProcessing ? "disabled" : ""}`} style={{ cursor: isProcessing ? "not-allowed" : "pointer", opacity: isProcessing ? 0.7 : 1 }} title="Import Guitar Pro tab file (.gp, .gpx, .gp5, .gp4) and convert to UMS SongGraph format">
              <FileCode size={16} color="var(--accent-amber)" />
              <span>Import GP (.gp)</span>
              <input
                type="file"
                accept=".gp,.gpx,.gp5,.gp4,.gp3,.ptb"
                onChange={onGpUpload}
                disabled={isProcessing}
                style={{ display: "none" }}
              />
            </label>
          )}

          <button
            className="btn btn-primary"
            onClick={onGenerateSynthetic}
            disabled={isProcessing}
            title="Generate a synthetic test track with strummed guitar chords"
          >
            {isProcessing ? <Loader2 size={16} className="spin-icon" /> : <Sparkles size={16} />}
            {isProcessing ? "Processing..." : "Demo Track (Waltz)"}
          </button>

          <label className={`btn btn-secondary ${isProcessing ? "disabled" : ""}`} style={{ cursor: isProcessing ? "not-allowed" : "pointer", opacity: isProcessing ? 0.7 : 1 }}>
            {isProcessing ? <Loader2 size={16} className="spin-icon" /> : <Upload size={16} />}
            {isProcessing ? "Loading..." : "Upload WAV Audio"}
            <input
              type="file"
              accept="audio/wav,audio/x-wav,audio/mp3,audio/*"
              onChange={onFileUpload}
              disabled={isProcessing}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "0.75rem",
        background: "var(--bg-secondary)",
        padding: "0.75rem",
        borderRadius: "var(--radius-sm)"
      }}>
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.2rem" }}>
            Song Title
          </label>
          <input
            className="input-field"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Title..."
          />
        </div>

        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.2rem" }}>
            Artist
          </label>
          <input
            className="input-field"
            value={artist}
            onChange={(e) => onArtistChange(e.target.value)}
            placeholder="Artist..."
          />
        </div>

        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.2rem" }}>
            Time Signature
          </label>
          <select
            className="input-field"
            value={dspParams.timeSignature}
            onChange={(e) => onParamsChange({ ...dspParams, timeSignature: e.target.value as any })}
          >
            <option value="3/4">3/4 (Waltz)</option>
            <option value="4/4">4/4 (Common)</option>
            <option value="6/8">6/8 (Ballad)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.2rem" }}>
            Guitar Tuning
          </label>
          <select
            className="input-field"
            value={TUNING_PRESETS.some(p => p.value === dspParams.tuning) ? dspParams.tuning : "custom"}
            onChange={(e) => {
              if (e.target.value !== "custom") {
                onParamsChange({ ...dspParams, tuning: e.target.value });
              }
            }}
          >
            {TUNING_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
            <option value="custom">Custom Tuning...</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.2rem" }}>
            Capo Position
          </label>
          <input
            type="number"
            className="input-field"
            value={dspParams.capo}
            min={0}
            max={12}
            onChange={(e) => onParamsChange({ ...dspParams, capo: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
      </div>
    </header>
  );
};
