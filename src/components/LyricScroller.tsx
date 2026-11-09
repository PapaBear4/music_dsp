import React, { useRef, useMemo, useState } from "react";
import { FileText, Search, LayoutList, AlignLeft, Sparkles, Check, Mic, Loader2, Cpu, Layers } from "lucide-react";
import type { LrcLine } from "../types/songGraph";

interface LyricScrollerProps {
  importedLrcLines: LrcLine[];
  whisperLrcLines: LrcLine[];
  playbackTime: number;
  onSeekToTime: (timeSec: number) => void;
  onOpenLrcModal: () => void;
  onOpenWhisperModal?: () => void;
  onAdoptWhisperLyrics?: () => void;
  onAdoptImportedLyrics?: () => void;
  activeSource: "imported" | "whisper";
  lyricTimeOffset: number;
  zoomLevel?: number;
  panOffsetSec?: number;
  audioDuration?: number;
  isProcessing?: boolean;
}

export const LyricScroller: React.FC<LyricScrollerProps> = ({
  importedLrcLines,
  whisperLrcLines,
  playbackTime,
  onSeekToTime,
  onOpenLrcModal,
  onOpenWhisperModal,
  onAdoptWhisperLyrics,
  onAdoptImportedLyrics,
  activeSource,
  lyricTimeOffset,
  zoomLevel = 1,
  panOffsetSec = 0,
  audioDuration = 0,
  isProcessing = false
}) => {
  const [viewMode, setViewMode] = useState<"horizontal" | "vertical">("horizontal");
  const [activePaneTab, setActivePaneTab] = useState<"stacked" | "both" | "imported" | "whisper">("stacked");

  const containerRefA = useRef<HTMLDivElement | null>(null);
  const containerRefB = useRef<HTMLDivElement | null>(null);
  const activeLineRefA = useRef<HTMLDivElement | null>(null);
  const activeLineRefB = useRef<HTMLDivElement | null>(null);

  const totalDuration = audioDuration || 1;
  const visibleDuration = totalDuration / zoomLevel;
  const maxPanOffset = Math.max(0, totalDuration - visibleDuration);
  const currentPan = Math.min(panOffsetSec, maxPanOffset);
  const viewStartSec = currentPan;
  const viewEndSec = Math.min(totalDuration, viewStartSec + visibleDuration);

  // Adjusted timestamp calculations
  const adjustedImported = useMemo(() => {
    return importedLrcLines.map((line) => ({
      ...line,
      adjustedTimeSec: Math.max(0, line.timestampSec + lyricTimeOffset)
    }));
  }, [importedLrcLines, lyricTimeOffset]);

  const adjustedWhisper = useMemo(() => {
    return whisperLrcLines.map((line) => ({
      ...line,
      adjustedTimeSec: Math.max(0, line.timestampSec + lyricTimeOffset)
    }));
  }, [whisperLrcLines, lyricTimeOffset]);

  // Find active line indices
  const activeIndexA = useMemo(() => {
    if (adjustedImported.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < adjustedImported.length; i++) {
      if (playbackTime >= adjustedImported[i].adjustedTimeSec - 0.15) idx = i;
      else break;
    }
    return idx;
  }, [adjustedImported, playbackTime]);

  const activeIndexB = useMemo(() => {
    if (adjustedWhisper.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < adjustedWhisper.length; i++) {
      if (playbackTime >= adjustedWhisper[i].adjustedTimeSec - 0.15) idx = i;
      else break;
    }
    return idx;
  }, [adjustedWhisper, playbackTime]);

  const formatTimestamp = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(2);
    const paddedSecs = parseFloat(secs) < 10 ? `0${secs}` : secs;
    return `${mins < 10 ? `0${mins}` : mins}:${paddedSecs}`;
  };

  // Render Horizontal Ribbon Track with timestamps placed BELOW pills for 100% exact onset alignment
  const renderRibbonTrack = (lines: (LrcLine & { adjustedTimeSec: number })[], activeIdx: number, accentColor: string) => {
    return (
      <div style={{
        position: "relative",
        background: "var(--bg-secondary)",
        border: "1px solid var(--bg-card-border)",
        borderRadius: "var(--radius-sm)",
        height: "115px",
        overflow: "hidden",
        padding: "0.5rem"
      }}>
        {activeIdx >= 0 && lines[activeIdx] && (
          <div style={{
            background: `rgba(6, 182, 212, 0.15)`,
            border: `1px solid ${accentColor}`,
            padding: "0.35rem 0.75rem",
            borderRadius: "var(--radius-sm)",
            marginBottom: "0.4rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.8rem"
          }}>
            <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{lines[activeIdx].text}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: accentColor, fontWeight: 700 }}>
              {formatTimestamp(lines[activeIdx].adjustedTimeSec)}
            </span>
          </div>
        )}

        <div style={{
          position: "relative",
          width: "100%",
          height: "60px",
          background: "rgba(10, 12, 18, 0.85)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden"
        }}>
          {lines.map((line, idx) => {
            const isActive = idx === activeIdx;
            const timeSec = line.adjustedTimeSec;
            if (timeSec >= viewStartSec - 5 && timeSec <= viewEndSec + 5) {
              const leftPercent = ((timeSec - viewStartSec) / visibleDuration) * 100;
              return (
                <div
                  key={idx}
                  onClick={() => onSeekToTime(timeSec)}
                  style={{
                    position: "absolute",
                    left: `${leftPercent}%`,
                    top: "4px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    zIndex: isActive ? 10 : 2,
                    cursor: "pointer"
                  }}
                  title={`Click to seek to [${formatTimestamp(timeSec)}]`}
                >
                  {/* Lyric Words Pill - Left edge starts EXACTLY at onset timestamp */}
                  <div style={{
                    whiteSpace: "nowrap",
                    background: isActive ? accentColor : "rgba(30, 41, 59, 0.85)",
                    color: isActive ? "#000" : "var(--text-primary)",
                    border: isActive ? "1px solid #fff" : `1px solid ${accentColor}`,
                    borderRadius: "12px",
                    padding: "0.15rem 0.6rem",
                    fontSize: isActive ? "0.75rem" : "0.68rem",
                    fontWeight: isActive ? 700 : 500,
                    boxShadow: isActive ? `0 0 10px ${accentColor}` : "none"
                  }}>
                    {line.text}
                  </div>

                  {/* Sub-Tag Timestamp Centered Below Pill */}
                  <span style={{
                    fontSize: "0.58rem",
                    fontFamily: "var(--font-mono)",
                    color: isActive ? accentColor : "var(--text-secondary)",
                    marginTop: "2px",
                    paddingLeft: "2px",
                    fontWeight: 600,
                    opacity: 0.9
                  }}>
                    {formatTimestamp(timeSec)}
                  </span>
                </div>
              );
            }
            return null;
          })}

          {playbackTime >= viewStartSec && playbackTime <= viewEndSec && (
            <div style={{
              position: "absolute",
              left: `${((playbackTime - viewStartSec) / visibleDuration) * 100}%`,
              top: 0,
              bottom: 0,
              width: "2.5px",
              background: "#ef4444",
              zIndex: 20,
              pointerEvents: "none"
            }} />
          )}
        </div>
      </div>
    );
  };

  const renderVerticalTrack = (
    lines: (LrcLine & { adjustedTimeSec: number })[],
    activeIdx: number,
    accentColor: string,
    containerRefObj: React.RefObject<HTMLDivElement | null>,
    activeLineRefObj: React.RefObject<HTMLDivElement | null>
  ) => {
    return (
      <div
        ref={containerRefObj}
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--bg-card-border)",
          borderRadius: "var(--radius-sm)",
          height: "180px",
          overflowY: "auto",
          padding: "0.75rem",
          position: "relative"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {lines.map((line, idx) => {
            const isActive = idx === activeIdx;
            const isPast = idx < activeIdx;
            return (
              <div
                key={idx}
                ref={isActive ? activeLineRefObj : null}
                onClick={() => onSeekToTime(line.adjustedTimeSec)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.45rem 0.75rem",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  background: isActive ? `rgba(6, 182, 212, 0.15)` : "transparent",
                  borderLeft: isActive ? `3px solid ${accentColor}` : "3px solid transparent",
                  opacity: isPast ? 0.55 : 1
                }}
              >
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.7rem",
                  color: isActive ? accentColor : "var(--text-secondary)",
                  fontWeight: isActive ? 700 : 400,
                  minWidth: "55px"
                }}>
                  {formatTimestamp(line.adjustedTimeSec)}
                </span>
                <span style={{
                  fontSize: isActive ? "0.95rem" : "0.85rem",
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  flex: 1
                }}>
                  {line.text}
                </span>
                {isActive && (
                  <span style={{ fontSize: "0.6rem", fontWeight: 700, color: accentColor }}>NOW</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-panel" style={{ marginBottom: "1.5rem" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <FileText size={18} color="var(--accent-amber)" />
          <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Lyric Alignment Workspace (LRC vs Whisper Overlay)</h3>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {/* Pane Mode Switcher */}
          <div style={{ display: "flex", gap: "0.2rem", background: "var(--bg-secondary)", padding: "0.2rem", borderRadius: "var(--radius-sm)" }}>
            <button
              className={`btn ${activePaneTab === "stacked" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActivePaneTab("stacked")}
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
              title="Stack LRC and Whisper ribbons vertically on top of one another to compare timing alignment"
            >
              <Layers size={13} color="var(--accent-amber)" /> Stacked Overlay View
            </button>
            <button
              className={`btn ${activePaneTab === "both" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActivePaneTab("both")}
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem" }}
            >
              Side-by-Side
            </button>
            <button
              className={`btn ${activePaneTab === "imported" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActivePaneTab("imported")}
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem" }}
            >
              LRC Only
            </button>
            <button
              className={`btn ${activePaneTab === "whisper" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActivePaneTab("whisper")}
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem" }}
            >
              Whisper Only
            </button>
          </div>

          {/* View Mode Switcher */}
          {activePaneTab !== "stacked" && (
            <div style={{ display: "flex", gap: "0.2rem", background: "var(--bg-secondary)", padding: "0.2rem", borderRadius: "var(--radius-sm)" }}>
              <button
                className={`btn ${viewMode === "horizontal" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setViewMode("horizontal")}
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.55rem" }}
              >
                <AlignLeft size={13} /> Ribbon
              </button>
              <button
                className={`btn ${viewMode === "vertical" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setViewMode("vertical")}
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.55rem" }}
              >
                <LayoutList size={13} /> List
              </button>
            </div>
          )}
        </div>
      </div>

      {/* STACKED OVERLAY VIEW MODE (LRC and Whisper Ribbons stacked on top of one another) */}
      {activePaneTab === "stacked" ? (
        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--bg-card-border)",
          borderRadius: "var(--radius-sm)",
          padding: "0.85rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem"
        }}>
          {/* Active Prompt Header Stack */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div style={{
              background: "rgba(6, 182, 212, 0.12)",
              border: "1px solid var(--accent-cyan)",
              padding: "0.4rem 0.75rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.8rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{ fontWeight: 700, color: "var(--accent-cyan)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <FileText size={14} /> Imported LRC:
              </span>
              <span style={{ fontWeight: 600, color: "var(--text-primary)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "60%" }}>
                {activeIndexA >= 0 && adjustedImported[activeIndexA] ? adjustedImported[activeIndexA].text : "—"}
              </span>
              {onAdoptImportedLyrics && activeSource !== "imported" && (
                <button className="btn btn-primary" onClick={onAdoptImportedLyrics} style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem" }}>
                  Use LRC
                </button>
              )}
            </div>

            <div style={{
              background: "rgba(139, 92, 246, 0.12)",
              border: "1px solid var(--accent-purple)",
              padding: "0.4rem 0.75rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.8rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{ fontWeight: 700, color: "var(--accent-purple)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Sparkles size={14} /> Whisper WASM:
              </span>
              <span style={{ fontWeight: 600, color: "var(--text-primary)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "60%" }}>
                {activeIndexB >= 0 && adjustedWhisper[activeIndexB] ? adjustedWhisper[activeIndexB].text : "—"}
              </span>
              {onAdoptWhisperLyrics && activeSource !== "whisper" && (
                <button className="btn btn-primary" onClick={onAdoptWhisperLyrics} style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem" }}>
                  Use Whisper
                </button>
              )}
            </div>
          </div>

          {/* Unified Timeline Stack Container */}
          <div style={{
            position: "relative",
            width: "100%",
            background: "rgba(10, 12, 18, 0.95)",
            border: "1px solid var(--bg-card-border)",
            borderRadius: "var(--radius-sm)",
            padding: "0.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            overflow: "hidden"
          }}>
            {/* ROW 1: Imported LRC Ribbon */}
            <div style={{ position: "relative", width: "100%", height: "55px" }}>
              <div style={{ position: "absolute", left: "0", top: "0", fontSize: "0.65rem", fontWeight: 700, color: "var(--accent-cyan)", zIndex: 12 }}>
                LRC
              </div>
              {adjustedImported.map((line, idx) => {
                const isActive = idx === activeIndexA;
                const timeSec = line.adjustedTimeSec;
                if (timeSec >= viewStartSec - 5 && timeSec <= viewEndSec + 5) {
                  const leftPercent = ((timeSec - viewStartSec) / visibleDuration) * 100;
                  return (
                    <div
                      key={idx}
                      onClick={() => onSeekToTime(timeSec)}
                      style={{
                        position: "absolute",
                        left: `${leftPercent}%`,
                        top: "2px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        zIndex: isActive ? 10 : 2,
                        cursor: "pointer"
                      }}
                      title={`Click to seek to [${formatTimestamp(timeSec)}]`}
                    >
                      <div style={{
                        whiteSpace: "nowrap",
                        background: isActive ? "var(--accent-cyan)" : "rgba(6, 182, 212, 0.25)",
                        color: isActive ? "#000" : "var(--text-primary)",
                        border: isActive ? "1px solid #fff" : "1px solid var(--accent-cyan)",
                        borderRadius: "12px",
                        padding: "0.15rem 0.55rem",
                        fontSize: isActive ? "0.72rem" : "0.65rem",
                        fontWeight: isActive ? 700 : 500,
                        boxShadow: isActive ? "0 0 10px var(--accent-cyan)" : "none"
                      }}>
                        {line.text}
                      </div>

                      <span style={{
                        fontSize: "0.58rem",
                        fontFamily: "var(--font-mono)",
                        color: isActive ? "var(--accent-cyan)" : "var(--text-secondary)",
                        marginTop: "2px",
                        paddingLeft: "2px",
                        fontWeight: 600,
                        opacity: 0.9
                      }}>
                        {formatTimestamp(timeSec)}
                      </span>
                    </div>
                  );
                }
                return null;
              })}
            </div>

            {/* Middle Alignment Grid Divider Line */}
            <div style={{ width: "100%", height: "1px", background: "rgba(255, 255, 255, 0.1)" }} />

            {/* ROW 2: Whisper-Heard WASM Ribbon */}
            <div style={{ position: "relative", width: "100%", height: "55px" }}>
              <div style={{ position: "absolute", left: "0", top: "0", fontSize: "0.65rem", fontWeight: 700, color: "var(--accent-purple)", zIndex: 12 }}>
                WHISPER
              </div>
              {isProcessing ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--accent-purple)", fontSize: "0.75rem", padding: "0.5rem" }}>
                  <Loader2 size={14} className="spin-icon" />
                  <span>Transcribing Sung Audio with whisper.cpp WASM...</span>
                </div>
              ) : (
                adjustedWhisper.map((line, idx) => {
                  const isActive = idx === activeIndexB;
                  const timeSec = line.adjustedTimeSec;
                  if (timeSec >= viewStartSec - 5 && timeSec <= viewEndSec + 5) {
                    const leftPercent = ((timeSec - viewStartSec) / visibleDuration) * 100;
                    return (
                      <div
                        key={idx}
                        onClick={() => onSeekToTime(timeSec)}
                        style={{
                          position: "absolute",
                          left: `${leftPercent}%`,
                          top: "2px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          zIndex: isActive ? 10 : 2,
                          cursor: "pointer"
                        }}
                        title={`Click to seek to [${formatTimestamp(timeSec)}]`}
                      >
                        <div style={{
                          whiteSpace: "nowrap",
                          background: isActive ? "var(--accent-purple)" : "rgba(139, 92, 246, 0.25)",
                          color: isActive ? "#fff" : "var(--text-primary)",
                          border: isActive ? "1px solid #fff" : "1px solid var(--accent-purple)",
                          borderRadius: "12px",
                          padding: "0.15rem 0.55rem",
                          fontSize: isActive ? "0.72rem" : "0.65rem",
                          fontWeight: isActive ? 700 : 500,
                          boxShadow: isActive ? "0 0 10px var(--accent-purple)" : "none"
                        }}>
                          {line.text}
                        </div>

                        <span style={{
                          fontSize: "0.58rem",
                          fontFamily: "var(--font-mono)",
                          color: isActive ? "var(--accent-purple)" : "var(--text-secondary)",
                          marginTop: "2px",
                          paddingLeft: "2px",
                          fontWeight: 600,
                          opacity: 0.9
                        }}>
                          {formatTimestamp(timeSec)}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })
              )}
            </div>

            {/* Shared Red Playhead Cursor Line Sweeping Across BOTH Ribbons */}
            {playbackTime >= viewStartSec && playbackTime <= viewEndSec && (
              <div style={{
                position: "absolute",
                left: `${((playbackTime - viewStartSec) / visibleDuration) * 100}%`,
                top: 0,
                bottom: 0,
                width: "2.5px",
                background: "#ef4444",
                zIndex: 30,
                pointerEvents: "none"
              }} />
            )}
          </div>
        </div>
      ) : (
        /* DUAL PANES / SINGLE PANE VIEW MODES */
        <div style={{
          display: "grid",
          gridTemplateColumns: activePaneTab === "both" ? "1fr 1fr" : "1fr",
          gap: "1rem"
        }}>
          {/* PANE 1: IMPORTED / LRCLIB LYRIC TRACK */}
          {(activePaneTab === "both" || activePaneTab === "imported") && (
            <div style={{
              background: "rgba(6, 182, 212, 0.04)",
              border: activeSource === "imported" ? "2px solid var(--accent-cyan)" : "1px solid var(--bg-card-border)",
              borderRadius: "var(--radius-sm)",
              padding: "0.75rem"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <FileText size={15} color="var(--accent-cyan)" />
                  <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-cyan)" }}>
                    Imported LRC Track
                  </h4>
                  {activeSource === "imported" && (
                    <span style={{ fontSize: "0.65rem", background: "var(--accent-cyan)", color: "#000", fontWeight: 700, padding: "0.1rem 0.4rem", borderRadius: "10px" }}>
                      ACTIVE
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.4rem" }}>
                  {onAdoptImportedLyrics && activeSource !== "imported" && (
                    <button className="btn btn-primary" onClick={onAdoptImportedLyrics} style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
                      <Check size={12} /> Use LRC
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={onOpenLrcModal} style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
                    <Search size={12} /> Fetch LRC
                  </button>
                </div>
              </div>

              {adjustedImported.length === 0 ? (
                <div style={{ background: "var(--bg-secondary)", padding: "1rem", borderRadius: "var(--radius-sm)", textAlign: "center", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  No LRC file imported yet. Click "Fetch LRC" to load from LRCLIB.net.
                </div>
              ) : viewMode === "horizontal" ? (
                renderRibbonTrack(adjustedImported, activeIndexA, "var(--accent-cyan)")
              ) : (
                renderVerticalTrack(adjustedImported, activeIndexA, "var(--accent-cyan)", containerRefA, activeLineRefA)
              )}
            </div>
          )}

          {/* PANE 2: WHISPER-HEARD WASM LYRIC TRACK */}
          {(activePaneTab === "both" || activePaneTab === "whisper") && (
            <div style={{
              background: "rgba(139, 92, 246, 0.04)",
              border: activeSource === "whisper" ? "2px solid var(--accent-purple)" : "1px solid var(--bg-card-border)",
              borderRadius: "var(--radius-sm)",
              padding: "0.75rem",
              position: "relative"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Sparkles size={15} color="var(--accent-purple)" />
                  <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-purple)" }}>
                    Whisper-Heard Track (WASM)
                  </h4>
                  {activeSource === "whisper" && (
                    <span style={{ fontSize: "0.65rem", background: "var(--accent-purple)", color: "#fff", fontWeight: 700, padding: "0.1rem 0.4rem", borderRadius: "10px" }}>
                      ACTIVE
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.4rem" }}>
                  {onAdoptWhisperLyrics && activeSource !== "whisper" && (
                    <button className="btn btn-primary" onClick={onAdoptWhisperLyrics} style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
                      <Check size={12} /> Use Whisper
                    </button>
                  )}
                  {onOpenWhisperModal && (
                    <button className="btn btn-secondary" onClick={onOpenWhisperModal} style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
                      <Mic size={12} color="var(--accent-purple)" /> Details
                    </button>
                  )}
                </div>
              </div>

              {isProcessing ? (
                <div style={{
                  background: "var(--bg-secondary)",
                  padding: "1rem",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.6rem",
                  color: "var(--accent-purple)",
                  fontSize: "0.8rem",
                  fontWeight: 600
                }}>
                  <Loader2 size={16} className="spin-icon" />
                  <Cpu size={16} />
                  <span>whisper.cpp WASM Transcribing Sung Lyrics... (~1.2s execution)</span>
                </div>
              ) : adjustedWhisper.length === 0 ? (
                <div style={{ background: "var(--bg-secondary)", padding: "1rem", borderRadius: "var(--radius-sm)", textAlign: "center", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  No Whisper lyrics transcribed yet.
                </div>
              ) : viewMode === "horizontal" ? (
                renderRibbonTrack(adjustedWhisper, activeIndexB, "var(--accent-purple)")
              ) : (
                renderVerticalTrack(adjustedWhisper, activeIndexB, "var(--accent-purple)", containerRefB, activeLineRefB)
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
