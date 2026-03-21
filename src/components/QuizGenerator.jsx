import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const LANG_NAMES = { en: "English", hi: "Hindi", es: "Spanish", fr: "French", de: "German", ja: "Japanese" };

async function askGroq(prompt) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.7 })
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

export default function QuizGenerator({ lang = "en" }) {
  const [text, setText] = useState("");
  const [numQ, setNumQ] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [quiz, setQuiz] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [speaking, setSpeaking] = useState(null);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setText(e.target.result);
    reader.readAsText(file);
  };

  const generateQuiz = async () => {
    if (!text.trim()) { setError("Please add some study material first."); return; }
    setLoading(true); setError(""); setQuiz([]); setAnswers({}); setSubmitted(false);
    try {
      const raw = await askGroq(`You are a quiz generator. Based on the following study material, generate exactly ${numQ} multiple choice questions at ${difficulty} difficulty. Generate the questions and answers in ${LANG_NAMES[lang] || "English"}.

Return ONLY a valid JSON array, no markdown, no explanation, no backticks:
[
  {
    "question": "Question text",
    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
    "answer": "A) option1",
    "explanation": "Brief explanation"
  }
]

Study material:
${text.slice(0, 3000)}`);
      const cleaned = raw.replace(/```json|```/g, "").trim();
      setQuiz(JSON.parse(cleaned));
    } catch {
      setError("Failed to generate quiz. Check your API key or try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (qIdx, option) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: option }));
  };

  const handleSubmit = () => {
    if (Object.keys(answers).length < quiz.length) { setError("Please answer all questions."); return; }
    setSubmitted(true); setError("");
    const score = quiz.filter((q, i) => answers[i] === q.answer).length;
    const history = JSON.parse(localStorage.getItem("quizHistory") || "[]");
    history.unshift({ score, total: quiz.length, date: new Date().toLocaleDateString(), difficulty });
    localStorage.setItem("quizHistory", JSON.stringify(history.slice(0, 20)));
  };

  const speakQuestion = (text, idx) => {
    if (!window.speechSynthesis) return;
    if (speaking === idx) { window.speechSynthesis.cancel(); setSpeaking(null); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
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
          <div className="card-sub">Upload a TXT file or paste notes — AI generates a quiz in {LANG_NAMES[lang]}.</div>

          <div className={`upload-area ${dragOver ? "drag-over" : ""}`}
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}>
            <div className="upload-icon">📄</div>
            <div className="upload-text"><strong>Click or drag</strong> to upload TXT</div>
            <input ref={fileRef} type="file" className="upload-input" accept=".txt"
              onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          <div className="divider">or paste text</div>

          <textarea className="study-textarea" placeholder="Paste your study material here..."
            value={text} onChange={(e) => setText(e.target.value)} />

          {text && <div className="mt8"><span className="tag tag-green">✓ {text.split(" ").length} words · {LANG_NAMES[lang]}</span></div>}

          <div className="row mt16">
            <select className="styled-select" value={numQ} onChange={(e) => setNumQ(Number(e.target.value))}>
              {[3,5,8,10,15].map(n => <option key={n} value={n}>{n} Questions</option>)}
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
            <div className="row mt16" style={{ marginBottom: "16px" }}>
              <span className="tag tag-blue">{quiz.length} Questions</span>
              <span className="tag tag-gold">{difficulty}</span>
              <span className="tag tag-green">{LANG_NAMES[lang]}</span>
              <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={() => setQuiz([])}>← New Quiz</button>
            </div>

            {quiz.map((q, i) => (
              <motion.div key={i} className="quiz-question-card"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
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
                      onClick={() => handleAnswer(i, opt)}>
                      {opt}
                    </button>
                  ))}
                </div>
              </motion.div>
            ))}

            <div className="row mt16">
              <button className="btn btn-ghost" onClick={() => setQuiz([])}>← Regenerate</button>
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
              <button className="btn btn-primary" onClick={() => { setQuiz([]); setAnswers({}); setSubmitted(false); }}>
                🔄 New Quiz
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}