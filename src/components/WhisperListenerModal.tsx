import React, { useEffect, useState } from "react";
import { Mic, Sparkles, X, Check, Loader2, Clock, Cpu } from "lucide-react";
import type { WhisperTranscriptionResult } from "../dsp/whisperListener";
import { transcribeSungLyricsWithWhisper } from "../dsp/whisperListener";

interface WhisperListenerModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioBuffer: AudioBuffer | null;
  onApplyLyrics: (lrcContent: string, suggestedOffsetSec?: number) => void;
}

export const WhisperListenerModal: React.FC<WhisperListenerModalProps> = ({
  isOpen,
  onClose,
  audioBuffer,
  onApplyLyrics
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<WhisperTranscriptionResult | null>(null);

  // Automatically trigger whisper.cpp WASM analysis whenever modal is opened
  useEffect(() => {
    if (isOpen && audioBuffer && !result && !isAnalyzing) {
      setIsAnalyzing(true);
      setProgress(15);
      setStatusMessage("Running whisper.cpp WASM Neural ASR Engine...");

      transcribeSungLyricsWithWhisper(audioBuffer, (p, msg) => {
        setProgress(p);
        setStatusMessage(msg);
      }).then((output) => {
        setResult(output);
        setIsAnalyzing(false);
      }).catch((err) => {
        console.error("whisper.cpp WASM error:", err);
        setIsAnalyzing(false);
      });
    }
  }, [isOpen, audioBuffer, result, isAnalyzing]);

  if (!isOpen) return null;

  const handleStartWhisperListener = async () => {
    if (!audioBuffer) return;
    setIsAnalyzing(true);
    setProgress(15);
    setStatusMessage("Running whisper.cpp WASM Neural ASR Engine...");
    setResult(null);

    try {
      const output = await transcribeSungLyricsWithWhisper(audioBuffer, (p, msg) => {
        setProgress(p);
        setStatusMessage(msg);
      });
      setResult(output);
    } catch (err: any) {
      alert("whisper.cpp WASM error: " + (err.message || err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApplyLyrics(result.lrcContent, result.calculatedOffsetSec);
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
        maxWidth: "600px",
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-primary)",
        border: "1px solid var(--bg-card-border)"
      }}>
        {/* Modal Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Sparkles size={20} color="var(--accent-purple)" />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>whisper.cpp WASM Sung-Lyric ASR Listener</h3>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: "0.3rem" }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
          Automated in-browser WebAssembly neural speech recognition. Transcribes sung lyrics and calculates exact phrase timestamps locally.
        </p>

        <div style={{
          background: "var(--bg-secondary)",
          padding: "0.75rem",
          borderRadius: "var(--radius-sm)",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.8rem",
          color: "var(--accent-cyan)"
        }}>
          <Cpu size={16} />
          <span><strong>whisper.cpp WASM Engine:</strong> Active & Running 100% Offline in WebAssembly.</span>
        </div>

        {/* Re-analyze Action Button */}
        <button
          className="btn btn-primary"
          onClick={handleStartWhisperListener}
          disabled={isAnalyzing || !audioBuffer}
          style={{ marginBottom: "1rem", padding: "0.6rem" }}
        >
          {isAnalyzing ? <Loader2 size={16} className="spin-icon" /> : <Mic size={16} />}
          {isAnalyzing ? "Analyzing Audio with whisper.cpp WASM..." : "Re-Run whisper.cpp WASM Analysis"}
        </button>

        {/* Progress Indicator */}
        {isAnalyzing && (
          <div style={{ background: "var(--bg-secondary)", padding: "0.75rem", borderRadius: "var(--radius-sm)", marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.3rem" }}>
              <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>{statusMessage}</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{progress}%</span>
            </div>
            <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))", transition: "width 0.2s ease" }} />
            </div>
          </div>
        )}

        {/* Results Preview */}
        {result && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.75rem", overflowY: "auto" }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              padding: "0.6rem 0.85rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.8rem",
              color: "var(--accent-green)"
            }}>
              <span style={{ fontWeight: 600 }}>✓ Transcribed {result.lrcLines.length} Sung Lyric Segments</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>
                <Clock size={12} style={{ display: "inline", marginRight: "3px" }} />
                Suggested Start: +{result.calculatedOffsetSec.toFixed(2)}s
              </span>
            </div>

            <textarea
              className="input-field"
              value={result.lrcContent}
              readOnly
              rows={6}
              style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", flex: 1 }}
            />

            <button className="btn btn-primary" onClick={handleApply} style={{ padding: "0.6rem" }}>
              <Check size={16} /> Apply whisper.cpp Lyrics & Auto-Align Offset
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
