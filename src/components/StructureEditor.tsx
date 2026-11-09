import React from "react";
import { Layers } from "lucide-react";
import type { SongGraph, Measure } from "../types/songGraph";

interface StructureEditorProps {
  songGraph: SongGraph | null;
  onUpdateSongGraph: (updated: SongGraph) => void;
}

export const StructureEditor: React.FC<StructureEditorProps> = ({
  songGraph,
  onUpdateSongGraph
}) => {
  if (!songGraph) return null;

  const handleChordChange = (blockIdx: number, measureIdx: number, eventIdx: number, newChord: string) => {
    const updated = JSON.parse(JSON.stringify(songGraph)) as SongGraph;
    const m = updated.structure[blockIdx].measures[measureIdx];
    m.musical_events[eventIdx].layer_a.chord = newChord || null;
    onUpdateSongGraph(updated);
  };

  const handleLyricChange = (blockIdx: number, measureIdx: number, eventIdx: number, newLyric: string) => {
    const updated = JSON.parse(JSON.stringify(songGraph)) as SongGraph;
    const m = updated.structure[blockIdx].measures[measureIdx];
    m.musical_events[eventIdx].layer_a.lyrics = newLyric || null;
    onUpdateSongGraph(updated);
  };

  return (
    <div className="glass-panel" style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Layers size={18} color="var(--accent-green)" />
          <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Extracted Musical Structure & Measure Grid</h3>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          Interactive Measure & Syllable Override Matrix
        </span>
      </div>

      {songGraph.structure.map((block, bIdx) => (
        <div key={bIdx} style={{ marginBottom: "1.25rem" }}>
          <div style={{
            fontSize: "0.9rem",
            fontWeight: 700,
            color: "var(--accent-cyan)",
            marginBottom: "0.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}>
            <span>{block.block_name}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 400 }}>
              ({block.measures.length} measures)
            </span>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "0.75rem"
          }}>
            {block.measures.map((measure: Measure, mIdx: number) => (
              <div
                key={measure.measure_index}
                style={{
                  background: "var(--bg-secondary)",
                  border: measure.starts_line ? "1px solid var(--accent-amber)" : "1px solid var(--bg-card-border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.75rem"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                    Measure {measure.measure_index}
                  </span>
                  {measure.strum_pattern && (
                    <span style={{
                      fontSize: "0.65rem",
                      background: "rgba(139, 92, 246, 0.2)",
                      color: "var(--accent-purple)",
                      padding: "0.15rem 0.4rem",
                      borderRadius: "4px",
                      fontFamily: "var(--font-mono)"
                    }}>
                      {measure.strum_pattern.pattern} ({measure.strum_pattern.style})
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.3rem" }}>
                  {measure.musical_events.map((evt, eIdx) => (
                    <div
                      key={eIdx}
                      style={{
                        flex: 1,
                        background: "rgba(0, 0, 0, 0.2)",
                        borderRadius: "4px",
                        padding: "0.3rem",
                        textAlign: "center"
                      }}
                    >
                      <span style={{ fontSize: "0.6rem", color: "var(--text-secondary)", display: "block" }}>
                        Beat {evt.beat_division}
                      </span>

                      <input
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          color: "var(--accent-purple)",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          textAlign: "center"
                        }}
                        value={evt.layer_a.chord || ""}
                        placeholder="--"
                        onChange={(e) => handleChordChange(bIdx, mIdx, eIdx, e.target.value)}
                      />

                      <input
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          color: "var(--accent-amber)",
                          fontSize: "0.75rem",
                          textAlign: "center"
                        }}
                        value={evt.layer_a.lyrics || ""}
                        placeholder="--"
                        onChange={(e) => handleLyricChange(bIdx, mIdx, eIdx, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
