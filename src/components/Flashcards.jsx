import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { extractTextFromPDF } from "../utils/pdfReader";
import { saveToLibrary } from "./LibrarySidebar";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const LANG_NAMES = { en: "English", hi: "Hindi", es: "Spanish", fr: "French", de: "German", ja: "Japanese" };

function cleanForSpeech(text) {
  return text.replace(/[*#_~`>]/g, "").replace(/\p{Emoji}/gu, "").replace(/[•·●■□▪▫–—]/g, "").replace(/\d+\.\s/g, "").replace(/\n{2,}/g, ". ").replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim();
}

async function askGroq(prompt) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.7 })
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

export default function Flashcards({ lang = "en", loadedEntry, onEntrySaved }) {
  const [text, setText] = useState(() => JSON.parse(localStorage.getItem("flash_text") || '""'));
  const [cards, setCards] = useState(() => JSON.parse(localStorage.getItem("flash_cards") || "[]"));
  const [current, setCurrent] = useState(() => JSON.parse(localStorage.getItem("flash_current") || "0"));
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(() => JSON.parse(localStorage.getItem("flash_known") || "[]"));
  const [unknown, setUnknown] = useState(() => JSON.parse(localStorage.getItem("flash_unknown") || "[]"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveTitle, setSaveTitle] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef();

  useEffect(() => { localStorage.setItem("flash_text", JSON.stringify(text)); }, [text]);
  useEffect(() => { localStorage.setItem("flash_cards", JSON.stringify(cards)); }, [cards]);
  useEffect(() => { localStorage.setItem("flash_current", JSON.stringify(current)); }, [current]);
  useEffect(() => { localStorage.setItem("flash_known", JSON.stringify(known)); }, [known]);
  useEffect(() => { localStorage.setItem("flash_unknown", JSON.stringify(unknown)); }, [unknown]);

  useEffect(() => {
    if (!loadedEntry) return;
    if (loadedEntry.type === "flashcards") {
      setCards(loadedEntry.data.cards || []);
      setText(loadedEntry.data.text || "");
      setCurrent(0); setFlipped(false); setKnown([]); setUnknown([]);
    }
    if (loadedEntry.type === "notes") {
      setText(loadedEntry.data.text || "");
      setCards([]); setCurrent(0); setFlipped(false); setKnown([]); setUnknown([]);
    }
    onEntrySaved?.();
  }, [loadedEntry]);

  const handleFile = async (file) => {
    if (!file) return;
    if (file.type === "application/pdf") {
      try { setLoading(true); setText(await extractTextFromPDF(file)); }
      catch { setError("Could not read PDF."); }
      finally { setLoading(false); }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => setText(e.target.result);
      reader.readAsText(file);
    }
  };

  const generateCards = async () => {
    if (!text.trim()) { setError("Please add some study material first."); return; }
    setLoading(true); setError(""); setSaved(false);
    try {
      const raw = await askGroq(`Generate 10 flashcards from the following study material in ${LANG_NAMES[lang] || "English"}. Use plain text only, no emojis or symbols.
Return ONLY a valid JSON array, no markdown, no backticks:
[{ "front": "Term or question", "back": "Definition or answer" }]
Study material: ${text.slice(0, 3000)}`);
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setCards(parsed); setCurrent(0); setFlipped(false); setKnown([]); setUnknown([]);
    } catch { setError("Failed to generate flashcards. Please try again."); }
    finally { setLoading(false); }
  };

  const handleSave = () => {
    if (!saveTitle.trim()) return;
    saveToLibrary("flashcards", saveTitle, { text, cards });
    setSaved(true); setShowSaveInput(false); setSaveTitle("");
  };

  const next        = () => { setCurrent((c) => Math.min(c + 1, cards.length - 1)); setFlipped(false); };
  const prev        = () => { setCurrent((c) => Math.max(c - 1, 0)); setFlipped(false); };
  const markKnown   = () => { setKnown((k) => [...k, current]); if (current < cards.length - 1) next(); };
  const markUnknown = () => { setUnknown((u) => [...u, current]); if (current < cards.length - 1) next(); };
  const reset       = () => { setCurrent(0); setFlipped(false); setKnown([]); setUnknown([]); };
  const isDone      = current === cards.length - 1 && (known.includes(current) || unknown.includes(current));

  const speakCard = (txt) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(cleanForSpeech(txt));
    u.lang = lang === "hi" ? "hi-IN" : lang === "ja" ? "ja-JP" : lang === "es" ? "es-ES" : "en-US";
    window.speechSynthesis.speak(u);
  };

  return (
    <div>
      {!cards.length && (
        <div className="card">
          <div className="card-title">⚡ Flashcard Generator</div>
          <div className="card-sub">Upload PDF or TXT and AI creates flashcards in {LANG_NAMES[lang]}.</div>

          <div className="upload-area" onClick={() => fileRef.current.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}>
            <div className="upload-icon">📄</div>
            <div className="upload-text"><strong>Click or drag</strong> to upload PDF or TXT</div>
            <input ref={fileRef} type="file" accept=".txt,.pdf" style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          <div className="divider">or paste text</div>
          <textarea className="study-textarea" placeholder="Paste your study material here..."
            value={text} onChange={(e) => setText(e.target.value)} />

          {text && <div className="mt8"><span className="tag tag-green">✓ {text.split(" ").length} words</span></div>}

          <div className="row mt16">
            <button className="btn btn-primary" onClick={generateCards} disabled={loading || !text.trim()}>
              {loading ? <><span className="spinner" /> Generating...</> : "⚡ Generate Cards"}
            </button>
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: "13px", marginTop: "12px" }}>⚠️ {error}</p>}
        </div>
      )}

      {cards.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="row" style={{ marginBottom: "16px", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
            <div className="row">
              <span className="tag tag-green">✓ {known.length} Known</span>
              <span className="tag" style={{ background: "rgba(247,79,79,0.12)", color: "var(--danger)", border: "1px solid rgba(247,79,79,0.2)" }}>
                ✗ {unknown.length} Review
              </span>
            </div>
            <div className="row">
              {!saved && (
                <button className="btn btn-ghost" style={{ fontSize: "11px", padding: "6px 12px" }}
                  onClick={() => setShowSaveInput((s) => !s)}>
                  🗂️ Save Cards
                </button>
              )}
              {saved && <span className="tag tag-green">✅ Saved!</span>}
              <button className="btn btn-ghost" onClick={() => { setCards([]); setSaved(false); }}>← New Set</button>
            </div>
          </div>

          <AnimatePresence>
            {showSaveInput && (
              <motion.div className="save-input-row" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <input className="chat-input" placeholder="Give these flashcards a title..."
                  value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()} />
                <button className="btn btn-primary" style={{ fontSize: "12px" }} onClick={handleSave}>Save</button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="progress-bar-wrap" style={{ marginBottom: "18px" }}>
            <div className="progress-bar-label"><span>Progress</span><span>{current + 1} / {cards.length}</span></div>
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

          <div className="row" style={{ justifyContent: "center", marginBottom: "12px" }}>
            <button className="tts-btn" onClick={() => speakCard(flipped ? cards[current].back : cards[current].front)}>
              🔊 Read aloud
            </button>
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
              <div className="card-sub" style={{ margin: "8px 0 16px" }}>{known.length} known · {unknown.length} need review</div>
              <div className="row" style={{ justifyContent: "center" }}>
                <button className="btn btn-ghost" onClick={reset}>🔄 Restart</button>
                <button className="btn btn-primary" onClick={() => { setCards([]); setSaved(false); }}>📝 New Set</button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}