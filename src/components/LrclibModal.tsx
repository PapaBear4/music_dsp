import React, { useState, useEffect } from "react";
import { Search, X, Check, FileText } from "lucide-react";
import type { LRCLibTrack } from "../types/songGraph";
import { searchLRCLib } from "../services/lrclibService";

interface LrclibModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLrc: (lrcContent: string, trackInfo?: { title: string; artist: string }) => void;
  initialQuery?: string;
}

export const LrclibModal: React.FC<LrclibModalProps> = ({
  isOpen,
  onClose,
  onSelectLrc,
  initialQuery = ""
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState<LRCLibTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rawLrcText, setRawLrcText] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "paste">("search");

  // Sync search input query and automatically fetch results whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const q = initialQuery.trim();
      setQuery(q);
      if (q) {
        setIsLoading(true);
        searchLRCLib(q).then((results) => {
          setSearchResults(results);
          setIsLoading(false);
        });
      }
    }
  }, [isOpen, initialQuery]);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsLoading(true);
    const results = await searchLRCLib(query);
    setSearchResults(results);
    setIsLoading(false);
  };

  const handlePasteSubmit = () => {
    if (rawLrcText.trim()) {
      onSelectLrc(rawLrcText);
      onClose();
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      backdropFilter: "blur(6px)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
      padding: "1rem"
    }}>
      <div className="glass-panel" style={{
        width: "100%",
        maxWidth: "640px",
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-primary)",
        border: "1px solid var(--bg-card-border)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>LRCLIB Synced Lyrics Integration</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: "0.3rem" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <button
            className={`btn ${activeTab === "search" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("search")}
            style={{ flex: 1 }}
          >
            <Search size={16} /> Search LRCLIB.net
          </button>
          <button
            className={`btn ${activeTab === "paste" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("paste")}
            style={{ flex: 1 }}
          >
            <FileText size={16} /> Manual LRC Paste
          </button>
        </div>

        {activeTab === "search" ? (
          <>
            <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
              <input
                className="input-field"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search song title or artist (e.g. Amazing Grace)..."
              />
              <button className="btn btn-primary" type="submit" disabled={isLoading}>
                {isLoading ? "Searching..." : "Search"}
              </button>
            </form>

            <div style={{ flex: 1, overflowY: "auto", minHeight: "200px", paddingRight: "0.25rem" }}>
              {searchResults.length === 0 && !isLoading && (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: "2rem" }}>
                  No synced lyrics found for "<code>{query}</code>". Try adjusting song title or artist.
                </div>
              )}

              {isLoading && (
                <div style={{ textAlign: "center", color: "var(--accent-cyan)", padding: "2rem" }}>
                  Searching LRCLIB.net for "<code>{query}</code>"...
                </div>
              )}

              {searchResults.map((track) => (
                <div
                  key={track.id}
                  style={{
                    background: "var(--bg-secondary)",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-sm)",
                    marginBottom: "0.5rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{track.trackName || track.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      {track.artistName} {track.albumName ? `• ${track.albumName}` : ""}
                    </div>
                    {track.syncedLyrics ? (
                      <span style={{ fontSize: "0.7rem", color: "var(--accent-green)" }}>✓ Synced LRC Available</span>
                    ) : (
                      <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>Plain Lyrics Only</span>
                    )}
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}
                    onClick={() => {
                      const content = track.syncedLyrics || track.plainLyrics || "";
                      onSelectLrc(content, { title: track.trackName || track.name, artist: track.artistName });
                      onClose();
                    }}
                  >
                    <Check size={14} /> Select
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
            <textarea
              className="input-field"
              value={rawLrcText}
              onChange={(e) => setRawLrcText(e.target.value)}
              placeholder="Paste LRC content here, e.g.:&#10;[00:00.50] Amazing grace! how sweet the sound&#10;[00:04.20] That saved a wretch like me!..."
              rows={10}
              style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}
            />
            <button className="btn btn-primary" onClick={handlePasteSubmit} disabled={!rawLrcText.trim()}>
              Apply Pasted LRC Lyrics
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
