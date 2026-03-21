import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

async function askGroq(prompt) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

export default function Flashcards() {
  const [text, setText] = useState("");
  const [cards, setCards] = useState([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [known, setKnown] = useState([]);
  const [unknown, setUnknown] = useState([]);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setText(e.target.result);
    reader.readAsText(file);
  };

  const generateCards = async () => {
    if (!text.trim()) { setError("Please add some study material first."); return; }
    setLoading(true);
    setError("");
    try {
      const raw = await askGroq(`Generate 10 flashcards from the following study material. Each card should have a concise question/term on the front and a clear answer/definition on the back.

Return ONLY a valid JSON array, no markdown, no backticks, no explanation:
[
  { "front": "Term or question", "back": "Definition or answer" }
]

Study material:
${text.slice(0, 3000)}`);

      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      setCards(parsed);
      setCurrent(0);
      setFlipped(false);
      setKnown([]);
      setUnknown([]);
    } catch {
      setError("Failed to generate flashcards. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const next = () => { setCurrent((c) => Math.min(c + 1, cards.length - 1)); setFlipped(false); };
  const prev = () => { setCurrent((c) => Math.max(c - 1, 0)); setFlipped(false); };
  const markKnown = () => { setKnown((k) => [...k, current]); if (current < cards.length - 1) next(); };
  const markUnknown = () => { setUnknown((u) => [...u, current]); if (current < cards.length - 1) next(); };
  const reset = () => { setCurrent(0); setFlipped(false); setKnown([]); setUnknown([]); };
  const isDone = current === cards.length - 1 && (known.includes(current) || unknown.includes(current));

  return (
    <div>
      {!cards.length && (
        <div className="card">
          <div className="card-title">⚡ Flashcard Generator</div>
          <div className="card-sub">Paste your notes and AI will create flashcards you can flip through and study.</div>

          <textarea
            className="study-textarea"
            placeholder="Paste your study material here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="row mt16">
            <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
              📎 Upload TXT
              <input ref={fileRef} type="file" accept=".txt" style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files[0])} />
            </label>
            <button className="btn btn-primary" onClick={generateCards} disabled={loading || !text.trim()}>
              {loading ? <><span className="spinner" /> Generating...</> : "⚡ Generate Cards"}
            </button>
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: "13px", marginTop: "12px" }}>⚠️ {error}</p>}
        </div>
      )}

      {cards.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="row" style={{ marginBottom: "16px", justifyContent: "space-between" }}>
            <div className="row">
              <span className="tag tag-green">✓ {known.length} Known</span>
              <span className="tag" style={{ background: "rgba(247,79,79,0.15)", color: "var(--danger)", border: "1px solid rgba(247,79,79,0.2)" }}>
                ✗ {unknown.length} Review
              </span>
            </div>
            <button className="btn btn-ghost" onClick={() => setCards([])}>← New Set</button>
          </div>

          <div className="progress-bar-wrap" style={{ marginBottom: "20px" }}>
            <div className="progress-bar-label">
              <span>Progress</span>
              <span>{current + 1} / {cards.length}</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${((current + 1) / cards.length) * 100}%` }} />
            </div>
          </div>

          <div className="flashcard-scene" onClick={() => setFlipped((f) => !f)}>
            <div className={`flashcard-inner ${flipped ? "flipped" : ""}`}>
              <div className="flashcard-face flashcard-front">
                <div className="flashcard-tag">Question / Term</div>
                <div className="flashcard-text">{cards[current].front}</div>
                <div className="flashcard-hint">👆 Click to reveal answer</div>
              </div>
              <div className="flashcard-face flashcard-back">
                <div className="flashcard-tag">Answer</div>
                <div className="flashcard-text">{cards[current].back}</div>
              </div>
            </div>
          </div>

          <div className="flashcard-nav">
            <button className="btn btn-ghost" onClick={prev} disabled={current === 0}>← Prev</button>
            <span className="flashcard-counter">{current + 1} / {cards.length}</span>
            <button className="btn btn-ghost" onClick={next} disabled={current === cards.length - 1}>Next →</button>
          </div>

          <div className="row" style={{ justifyContent: "center", gap: "12px" }}>
            <button className="btn btn-danger" onClick={markUnknown}>✗ Need Review</button>
            <button className="btn btn-success" onClick={markKnown}>✓ Got It!</button>
          </div>

          {isDone && known.length + unknown.length === cards.length && (
            <motion.div className="card" style={{ marginTop: "20px", textAlign: "center" }}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎉</div>
              <div className="card-title">Round Complete!</div>
              <div className="card-sub" style={{ margin: "8px 0 16px" }}>
                {known.length} known · {unknown.length} need review
              </div>
              <div className="row" style={{ justifyContent: "center" }}>
                <button className="btn btn-ghost" onClick={reset}>🔄 Restart</button>
                <button className="btn btn-primary" onClick={() => setCards([])}>📝 New Set</button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
