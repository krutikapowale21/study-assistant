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

export default function QuizGenerator({ lang = "en", loadedEntry, onEntrySaved }) {
  const [text, setText] = useState(() => JSON.parse(localStorage.getItem("quiz_text") || '""'));
  const [numQ, setNumQ] = useState(() => JSON.parse(localStorage.getItem("quiz_numq") || "5"));
  const [difficulty, setDifficulty] = useState(() => localStorage.getItem("quiz_difficulty") || "medium");
  const [quiz, setQuiz] = useState(() => JSON.parse(localStorage.getItem("quiz_questions") || "[]"));
  const [answers, setAnswers] = useState(() => JSON.parse(localStorage.getItem("quiz_answers") || "{}"));
  const [submitted, setSubmitted] = useState(() => JSON.parse(localStorage.getItem("quiz_submitted") || "false"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [speaking, setSpeaking] = useState(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef();

  // Persist to localStorage
  useEffect(() => { localStorage.setItem("quiz_text", JSON.stringify(text)); }, [text]);
  useEffect(() => { localStorage.setItem("quiz_questions", JSON.stringify(quiz)); }, [quiz]);
  useEffect(() => { localStorage.setItem("quiz_answers", JSON.stringify(answers)); }, [answers]);
  useEffect(() => { localStorage.setItem("quiz_submitted", JSON.stringify(submitted)); }, [submitted]);
  useEffect(() => { localStorage.setItem("quiz_numq", JSON.stringify(numQ)); }, [numQ]);
  useEffect(() => { localStorage.setItem("quiz_difficulty", difficulty); }, [difficulty]);

  // Load from library
  useEffect(() => {
    if (!loadedEntry) return;
    if (loadedEntry.type === "notes") {
      setText(loadedEntry.data.text || "");
      setQuiz([]); setAnswers({}); setSubmitted(false);
    }
    if (loadedEntry.type === "quiz") {
      setText(loadedEntry.data.text || "");
      setQuiz(loadedEntry.data.quiz || []);
      setAnswers({}); setSubmitted(false);
      setDifficulty(loadedEntry.data.difficulty || "medium");
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

  const generateQuiz = async () => {
    if (!text.trim()) { setError("Please add some study material first."); return; }
    setLoading(true); setError(""); setQuiz([]); setAnswers({}); setSubmitted(false); setSaved(false);
    try {
      const raw = await askGroq(`You are a quiz generator. Based on the following study material, generate exactly ${numQ} multiple choice questions at ${difficulty} difficulty. Generate questions and answers in ${LANG_NAMES[lang] || "English"}.
Return ONLY a valid JSON array, no markdown, no explanation, no backticks:
[{"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"A) ...","explanation":"..."}]
Study material: ${text.slice(0, 3000)}`);
      setQuiz(JSON.parse(raw.replace(/```json|```/g, "").trim()));
    } catch { setError("Failed to generate quiz. Try again."); }
    finally { setLoading(false); }
  };

  const handleSubmit = () => {
    if (Object.keys(answers).length < quiz.length) { setError("Please answer all questions."); return; }
    setSubmitted(true); setError("");
    const score = quiz.filter((q, i) => answers[i] === q.answer).length;
    const history = JSON.parse(localStorage.getItem("quizHistory") || "[]");
    history.unshift({ score, total: quiz.length, date: new Date().toLocaleDateString(), difficulty });
    localStorage.setItem("quizHistory", JSON.stringify(history.slice(0, 20)));
  };

  const handleSave = () => {
    if (!saveTitle.trim()) return;
    saveToLibrary("quiz", saveTitle, { text, quiz, difficulty });
    setSaved(true); setShowSaveInput(false); setSaveTitle("");
  };

  const handleSaveNotes = () => {
    if (!saveTitle.trim()) return;
    saveToLibrary("notes", saveTitle, { text });
    setSaved(true); setShowSaveInput(false); setSaveTitle("");
  };

  const speakQuestion = (t, idx) => {
    if (!window.speechSynthesis) return;
    if (speaking === idx) { window.speechSynthesis.cancel(); setSpeaking(null); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(cleanForSpeech(t));
    u.lang = lang === "hi" ? "hi-IN" : lang === "ja" ? "ja-JP" : lang === "es" ? "es-ES" : "en-US";
    u.onend = () => setSpeaking(null);
    window.speechSynthesis.speak(u);
    setSpeaking(idx);
  };

  const score = quiz.filter((q, i) => answers[i] === q.answer).length;
  const pct = quiz.length ? Math.round((score / quiz.length) * 100) : 0;

  return (
    <div>
      {!quiz.length && (
        <div className="card">
          <div className="card-title">🧠 AI Quiz Generator</div>
          <div className="card-sub">Upload PDF or TXT or paste notes — AI generates a quiz in {LANG_NAMES[lang]}.</div>

          <div className={`upload-area ${dragOver ? "drag-over" : ""}`}
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}>
            <div className="upload-icon">📄</div>
            <div className="upload-text"><strong>Click or drag</strong> to upload PDF or TXT</div>
            <input ref={fileRef} type="file" className="upload-input" accept=".txt,.pdf"
              onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          <div className="divider">or paste text</div>
          <textarea className="study-textarea" placeholder="Paste your study material here..."
            value={text} onChange={(e) => setText(e.target.value)} />

          {text && (
            <div className="row mt8" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <span className="tag tag-green">✓ {text.split(" ").length} words · {LANG_NAMES[lang]}</span>
              <button className="btn btn-ghost" style={{ fontSize: "11px", padding: "4px 12px" }}
                onClick={() => setShowSaveInput((s) => !s)}>
                🗂️ Save Notes
              </button>
            </div>
          )}

          {/* Save notes input */}
          <AnimatePresence>
            {showSaveInput && (
              <motion.div className="save-input-row" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <input className="chat-input" placeholder="Give these notes a title..."
                  value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveNotes()} />
                <button className="btn btn-primary" style={{ fontSize: "12px" }} onClick={handleSaveNotes}>Save</button>
              </motion.div>
            )}
          </AnimatePresence>

          {saved && <div className="mt8"><span className="tag tag-green">✅ Saved to library!</span></div>}

          <div className="row mt16">
            <select className="styled-select" value={numQ} onChange={(e) => setNumQ(Number(e.target.value))}>
              {[3,5,8,10,15,100].map(n => <option key={n} value={n}>{n} Questions</option>)}
            </select>
            <select className="styled-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <button className="btn btn-primary" onClick={generateQuiz} disabled={loading || !text.trim()}>
              {loading ? <><span className="spinner" /> Generating...</> : "✨ Generate Quiz"}
            </button>
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: "13px", marginTop: "12px" }}>⚠️ {error}</p>}
        </div>
      )}

      <AnimatePresence>
        {quiz.length > 0 && !submitted && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="row mt16" style={{ marginBottom: "16px", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <div className="row">
                <span className="tag tag-blue">{quiz.length} Questions</span>
                <span className="tag tag-gold">{difficulty}</span>
                <span className="tag tag-green">{LANG_NAMES[lang]}</span>
              </div>
              <div className="row">
                {!saved && (
                  <button className="btn btn-ghost" style={{ fontSize: "11px", padding: "6px 12px" }}
                    onClick={() => setShowSaveInput((s) => !s)}>
                    🗂️ Save Quiz
                  </button>
                )}
                {saved && <span className="tag tag-green">✅ Saved!</span>}
                <button className="btn btn-ghost" onClick={() => { setQuiz([]); setAnswers({}); setSubmitted(false); setSaved(false); }}>← New Quiz</button>
              </div>
            </div>

            <AnimatePresence>
              {showSaveInput && (
                <motion.div className="save-input-row" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <input className="chat-input" placeholder="Give this quiz a title..."
                    value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()} />
                  <button className="btn btn-primary" style={{ fontSize: "12px" }} onClick={handleSave}>Save</button>
                </motion.div>
              )}
            </AnimatePresence>

            {quiz.map((q, i) => (
              <motion.div key={i} className="quiz-question-card"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <div className="quiz-q-num">Question {i + 1} of {quiz.length}</div>
                  <button className={`tts-btn ${speaking === i ? "speaking" : ""}`}
                    style={{ padding: "4px 10px", fontSize: "11px" }}
                    onClick={() => speakQuestion(q.question, i)}>
                    {speaking === i ? "⏹" : "🔊"}
                  </button>
                </div>
                <div className="quiz-q-text">{q.question}</div>
                <div className="quiz-options">
                  {q.options.map((opt, j) => (
                    <button key={j} className="quiz-option"
                      style={answers[i] === opt ? { borderColor: "var(--accent)", background: "rgba(79,142,247,0.1)" } : {}}
                      onClick={() => !submitted && setAnswers((p) => ({ ...p, [i]: opt }))}>
                      {opt}
                    </button>
                  ))}
                </div>
              </motion.div>
            ))}

            <div className="row mt16">
              <button className="btn btn-ghost" onClick={() => { setQuiz([]); setAnswers({}); setSubmitted(false); }}>← Regenerate</button>
              <button className="btn btn-primary" onClick={handleSubmit} style={{ marginLeft: "auto" }}>Submit Quiz →</button>
            </div>
            {error && <p style={{ color: "var(--danger)", fontSize: "13px", marginTop: "8px" }}>⚠️ {error}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {submitted && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="card score-card">
              <div className="score-num">{pct}%</div>
              <div className="score-label">{score} / {quiz.length} correct</div>
              <div className="row" style={{ justifyContent: "center" }}>
                {pct >= 80 && <span className="tag tag-green">🎉 Excellent!</span>}
                {pct >= 50 && pct < 80 && <span className="tag tag-gold">👍 Good job!</span>}
                {pct < 50 && <span className="tag tag-blue">📖 Keep studying!</span>}
              </div>
            </div>
            {quiz.map((q, i) => (
              <div key={i} className="quiz-question-card">
                <div className="quiz-q-num">Question {i + 1}</div>
                <div className="quiz-q-text">{q.question}</div>
                <div className="quiz-options">
                  {q.options.map((opt, j) => (
                    <button key={j} disabled
                      className={`quiz-option ${opt === q.answer ? "correct" : answers[i] === opt && opt !== q.answer ? "wrong" : ""}`}>
                      {opt}
                    </button>
                  ))}
                </div>
                <div className="quiz-explanation">💡 {q.explanation}</div>
              </div>
            ))}
            <div className="row mt16">
              <button className="btn btn-primary" onClick={() => { setQuiz([]); setAnswers({}); setSubmitted(false); setSaved(false); }}>
                🔄 New Quiz
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}