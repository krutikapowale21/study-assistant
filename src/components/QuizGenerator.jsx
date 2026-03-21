import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

export default function QuizGenerator() {
  const [text, setText] = useState("");
  const [numQ, setNumQ] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [quiz, setQuiz] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  // ── Read PDF text using FileReader (plain text extraction)
  const handleFile = (file) => {
    if (!file) return;
    if (file.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = (e) => setText(e.target.result);
      reader.readAsText(file);
    } else {
      // For PDF: read as base64 and send to Claude
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result.split(",")[1];
        extractPDFText(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const extractPDFText = async (base64) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              { type: "text", text: "Extract and return all the text content from this document. Return only the text, no commentary." }
            ]
          }]
        })
      });
      const data = await res.json();
      setText(data.content[0].text);
    } catch {
      setError("Could not read PDF. Please paste text manually.");
    } finally {
      setLoading(false);
    }
  };

  const generateQuiz = async () => {
    if (!text.trim()) { setError("Please add some study material first."); return; }
    setLoading(true);
    setError("");
    setQuiz([]);
    setAnswers({});
    setSubmitted(false);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a quiz generator. Based on the following study material, generate exactly ${numQ} multiple choice questions at ${difficulty} difficulty.

Return ONLY a valid JSON array, no markdown, no explanation. Format:
[
  {
    "question": "Question text here",
    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
    "answer": "A) option1",
    "explanation": "Brief explanation why this is correct"
  }
]

Study material:
${text.slice(0, 3000)}`
          }]
        })
      });
      const data = await res.json();
      const raw = data.content[0].text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(raw);
      setQuiz(parsed);
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
    if (Object.keys(answers).length < quiz.length) {
      setError("Please answer all questions before submitting.");
      return;
    }
    setSubmitted(true);
    setError("");
    // Save to progress
    const score = quiz.filter((q, i) => answers[i] === q.answer).length;
    const history = JSON.parse(localStorage.getItem("quizHistory") || "[]");
    history.unshift({ score, total: quiz.length, date: new Date().toLocaleDateString(), difficulty });
    localStorage.setItem("quizHistory", JSON.stringify(history.slice(0, 20)));
  };

  const score = quiz.filter((q, i) => answers[i] === q.answer).length;
  const pct = quiz.length ? Math.round((score / quiz.length) * 100) : 0;

  return (
    <div>
      {/* Input Card */}
      {!quiz.length && (
        <div className="card">
          <div className="card-title">🧠 AI Quiz Generator</div>
          <div className="card-sub">Upload a PDF or paste your study notes — AI will generate a quiz instantly.</div>

          {/* Upload */}
          <div
            className={`upload-area ${dragOver ? "drag-over" : ""}`}
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          >
            <div className="upload-icon">📄</div>
            <div className="upload-text">
              <strong>Click or drag</strong> to upload PDF or TXT<br />
              <span style={{ fontSize: "11px" }}>Max 10MB</span>
            </div>
            <input ref={fileRef} type="file" className="upload-input" accept=".pdf,.txt"
              onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          <div className="divider">or paste text</div>

          <textarea
            className="study-textarea"
            placeholder="Paste your notes, textbook content, or any study material here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          {text && (
            <div className="mt8">
              <span className="tag tag-green">✓ {text.split(" ").length} words loaded</span>
            </div>
          )}

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

      {/* Quiz */}
      <AnimatePresence>
        {quiz.length > 0 && !submitted && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="row mt16" style={{ marginBottom: "16px" }}>
              <span className="tag tag-blue">{quiz.length} Questions</span>
              <span className="tag tag-gold">{difficulty}</span>
              <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={() => setQuiz([])}>
                ← New Quiz
              </button>
            </div>

            {quiz.map((q, i) => (
              <motion.div
                key={i}
                className="quiz-question-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="quiz-q-num">Question {i + 1} of {quiz.length}</div>
                <div className="quiz-q-text">{q.question}</div>
                <div className="quiz-options">
                  {q.options.map((opt, j) => (
                    <button
                      key={j}
                      className={`quiz-option ${answers[i] === opt ? "selected" : ""}`}
                      style={answers[i] === opt ? { borderColor: "var(--accent)", background: "rgba(79,142,247,0.1)" } : {}}
                      onClick={() => handleAnswer(i, opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </motion.div>
            ))}

            <div className="row mt16">
              <button className="btn btn-ghost" onClick={() => setQuiz([])}>← Regenerate</button>
              <button className="btn btn-primary" onClick={handleSubmit} style={{ marginLeft: "auto" }}>
                Submit Quiz →
              </button>
            </div>
            {error && <p style={{ color: "var(--danger)", fontSize: "13px", marginTop: "8px" }}>⚠️ {error}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
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
                    <button
                      key={j}
                      disabled
                      className={`quiz-option ${opt === q.answer ? "correct" : answers[i] === opt && opt !== q.answer ? "wrong" : ""}`}
                    >
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