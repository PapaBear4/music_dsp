import React, { useState } from "react";
import { Code, Copy, Download, Check } from "lucide-react";
import type { SongGraph } from "../types/songGraph";

interface SongGraphViewerProps {
  songGraph: SongGraph | null;
}

export const SongGraphViewer: React.FC<SongGraphViewerProps> = ({ songGraph }) => {
  const [copied, setCopied] = useState(false);

  if (!songGraph) return null;

  const jsonString = JSON.stringify(songGraph, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filename = `${songGraph.canonical.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_songgraph.json`;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Code size={18} color="var(--accent-purple)" />
          <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Generated SongGraph JSON Output</h3>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-secondary" onClick={handleCopy} style={{ fontSize: "0.8rem" }}>
            {copied ? <Check size={14} color="var(--accent-green)" /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy JSON"}
          </button>
          <button className="btn btn-primary" onClick={handleDownload} style={{ fontSize: "0.8rem" }}>
            <Download size={14} /> Download .json
          </button>
        </div>
      </div>

      <pre style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--bg-card-border)",
        borderRadius: "var(--radius-sm)",
        padding: "1rem",
        maxHeight: "350px",
        overflowY: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: "0.8rem",
        color: "var(--accent-cyan)",
        lineHeight: 1.4
      }}>
        {jsonString}
      </pre>
    </div>
  );
};
