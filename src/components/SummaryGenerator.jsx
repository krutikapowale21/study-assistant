import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const LANG_NAMES = { en: "English", hi: "Hindi", es: "Spanish", fr: "French", de: "German", ja: "Japanese" };

function cleanForSpeech(text) {
  return text
    .replace(/[*#_~`>]/g, "")
    .replace(/\p{Emoji}/gu, "")
    .replace(/[•·●■□▪▫–—]/g, "")
    .replace(/\d+\.\s/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function askGroq(prompt) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.5 })
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

export default function SummaryGenerator({ lang = "en" }) {
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [weakTopics, setWeakTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingWeak, setLoadingWeak] = useState(false);
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [activeSection, setActiveSection] = useState("summary");
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setText(e.target.result);
    reader.readAsText(file);
  };

  const generateSummary = async () => {
    if (!text.trim()) { setError("Please add study material first."); return; }
    setLoading(true); setError(""); setSummary("");
    try {
      const raw = await askGroq(`Summarize the following study material clearly and concisely in ${LANG_NAMES[lang] || "English"}.

Structure your summary with:
1. Main Topic (1 sentence)
2. Key Points (5-7 bullet points)
3. Important Definitions (if any)
4. Quick Takeaway (2-3 sentences)

Use plain text only. No emojis, no markdown symbols, no asterisks.

Study material:
${text.slice(0, 4000)}`);
      setSummary(raw);
    } catch {
      setError("Failed to generate summary. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const detectWeakTopics = async () => {
    if (!text.trim()) { setError("Please add study material first."); return; }
    setLoadingWeak(true); setError(""); setWeakTopics([]);
    try {
      const history = JSON.parse(localStorage.getItem("quizHistory") || "[]");
      const historyText = history.length
        ? `Recent quiz performance: ${history.slice(0, 5).map(h => `${Math.round((h.score / h.total) * 100)}% (${h.difficulty})`).join(", ")}`
        : "No quiz history available.";

      const raw = await askGroq(`Based on the following study material and quiz performance, identify the top 5 weak topics the student should focus on.

${historyText}

Study material:
${text.slice(0, 3000)}

Return ONLY a valid JSON array, no markdown, no explanation:
[
  { "topic": "Topic name", "reason": "Why this is weak", "score": 35 }
]
where score is 0-100 (lower = weaker).`);

      const cleaned = raw.replace(/```json|```/g, "").trim();
      setWeakTopics(JSON.parse(cleaned));
      setActiveSection("weak");
    } catch {
      setError("Failed to detect weak topics. Please try again.");
    } finally {
      setLoadingWeak(false);
    }
  };

  const toggleTTS = () => {
    if (!window.speechSynthesis) { alert("Your browser does not support text to speech."); return; }
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(cleanForSpeech(summary));
    u.lang = lang === "hi" ? "hi-IN" : lang === "ja" ? "ja-JP" : lang === "es" ? "es-ES" : lang === "fr" ? "fr-FR" : lang === "de" ? "de-DE" : "en-US";
    u.rate = 0.9;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };

  const exportPDF = () => {
    const content = `
      <html>
      <head>
        <title>StudyAI Summary</title>
        <style>
          body { font-family: Georgia, serif; padding: 40px; max-width: 700px; margin: 0 auto; color: #1a1a2e; line-height: 1.8; }
          h1   { font-size: 24px; margin-bottom: 8px; color: #3b7ef0; }
          pre  { white-space: pre-wrap; font-family: Georgia, serif; font-size: 15px; }
          .meta { font-size: 12px; color: #888; margin-bottom: 24px; }
          .weak { margin-top: 32px; }
          .weak h2 { font-size: 18px; color: #e53e3e; }
          .weak-item { padding: 10px 0; border-bottom: 1px solid #eee; }
        </style>
      </head>
      <body>
        <h1>StudyAI — Summary</h1>
        <div class="meta">Generated on ${new Date().toLocaleDateString()} · Language: ${LANG_NAMES[lang]}</div>
        <pre>${summary}</pre>
        ${weakTopics.length ? `
        <div class="weak">
          <h2>Weak Topics to Focus On</h2>
          ${weakTopics.map(t => `
            <div class="weak-item">
              <strong>${t.topic}</strong> (${t.score}% mastery)<br/>
              <span style="color:#888">${t.reason}</span>
            </div>
          `).join("")}
        </div>` : ""}
      </body>
      </html>`;
    const win = window.open("", "_blank");
    win.document.write(content);
    win.document.close();
    win.print();
  };

  const getWeakColor = (score) => {
    if (score < 40) return "var(--danger)";
    if (score < 65) return "var(--accent2)";
    return "var(--accent3)";
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">📝 Summary & Weak Topics</div>
        <div className="card-sub">Generate an AI summary of your notes and detect which topics need more attention.</div>

        <div className="upload-area" onClick={() => fileRef.current.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}>
          <div className="upload-icon">📄</div>
          <div className="upload-text"><strong>Click or drag</strong> to upload TXT</div>
          <input ref={fileRef} type="file" className="upload-input" accept=".txt"
            onChange={(e) => handleFile(e.target.files[0])} />
        </div>

        <div className="divider">or paste text</div>

        <textarea className="study-textarea" placeholder="Paste your notes here..."
          value={text} onChange={(e) => setText(e.target.value)} />

        {text && <div className="mt8"><span className="tag tag-green">✓ {text.split(" ").length} words</span></div>}

        <div className="row mt16">
          <button className="btn btn-primary" onClick={generateSummary} disabled={loading || !text.trim()}>
            {loading ? <><span className="spinner" /> Summarizing...</> : "📝 Generate Summary"}
          </button>
          <button className="btn btn-ghost" onClick={detectWeakTopics} disabled={loadingWeak || !text.trim()}>
            {loadingWeak ? <><span className="spinner" style={{ borderTopColor: "var(--accent)" }} /> Analyzing...</> : "⚠️ Weak Topics"}
          </button>
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: "13px", marginTop: "12px" }}>⚠️ {error}</p>}
      </div>

      <AnimatePresence>
        {(summary || weakTopics.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="row" style={{ marginBottom: "12px" }}>
              {summary && (
                <button className={`btn ${activeSection === "summary" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setActiveSection("summary")}>
                  📝 Summary
                </button>
              )}
              {weakTopics.length > 0 && (
                <button className={`btn ${activeSection === "weak" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setActiveSection("weak")}>
                  ⚠️ Weak Topics
                </button>
              )}
            </div>

            {activeSection === "summary" && summary && (
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                  <div className="card-title" style={{ marginBottom: 0 }}>Summary</div>
                  <div className="row">
                    <button className={`tts-btn ${speaking ? "speaking" : ""}`} onClick={toggleTTS}>
                      {speaking ? "⏹ Stop" : "🔊 Listen"}
                    </button>
                    <button className="tts-btn" onClick={exportPDF}>📄 Export PDF</button>
                  </div>
                </div>
                <div className="summary-output">{summary}</div>
              </div>
            )}

            {activeSection === "weak" && weakTopics.length > 0 && (
              <div className="card">
                <div className="card-title">⚠️ Weak Topics — Focus Here</div>
                <div className="card-sub">Topics ranked by how much attention they need.</div>
                {weakTopics.map((t, i) => (
                  <motion.div key={i} className="weak-topic-item"
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                    <div style={{ fontSize: "18px" }}>
                      {t.score < 40 ? "🔴" : t.score < 65 ? "🟡" : "🟢"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="weak-topic-name" style={{ fontWeight: 600 }}>{t.topic}</div>
                      <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{t.reason}</div>
                    </div>
                    <div className="weak-bar-wrap">
                      <div className="progress-bar-label" style={{ marginBottom: "4px" }}>
                        <span></span>
                        <span className="weak-pct" style={{ color: getWeakColor(t.score) }}>{t.score}%</span>
                      </div>
                      <div className="weak-bar-track">
                        <motion.div className="weak-bar-fill"
                          style={{ background: getWeakColor(t.score) }}
                          initial={{ width: 0 }}
                          animate={{ width: `${t.score}%` }}
                          transition={{ duration: 1, delay: i * 0.1 }} />
                      </div>
                    </div>
                  </motion.div>
                ))}
                <div className="mt16">
                  <button className="tts-btn" onClick={exportPDF} disabled={!summary}>
                    📄 Export Full Report
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}