import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { extractTextFromPDF } from "../utils/pdfReader";

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

export default function AIChat({ lang = "en" }) {
  const [context, setContext] = useState("");
  const [contextSet, setContextSet] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const fileRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFile = async (file) => {
    if (!file) return;
    if (file.type === "application/pdf") {
      try {
        setFileLoading(true);
        const extracted = await extractTextFromPDF(file);
        setContext(extracted);
      } catch {
        setError("Could not read PDF. Please try another file.");
      } finally {
        setFileLoading(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => setContext(e.target.result);
      reader.readAsText(file);
    }
  };

  const setStudyContext = () => {
    if (!context.trim()) return;
    setContextSet(true);
    setMessages([{
      role: "ai",
      content: `Context loaded! I have read your study material (${context.split(" ").length} words). Ask me anything about it and I will answer in ${LANG_NAMES[lang] || "English"}!`
    }]);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const history = messages
        .filter((m) => m.role !== "ai" || messages.indexOf(m) > 0)
        .map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));

      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
              content: `You are a helpful study assistant. The student has provided the following study material as context:
---
${context.slice(0, 4000)}
---
Answer all questions based on this material. Be concise and educational. Always respond in ${LANG_NAMES[lang] || "English"}. Do not use bullet points, asterisks, emojis or markdown symbols — use plain text only.`
            },
            ...history,
            { role: "user", content: userMsg }
          ],
          temperature: 0.6,
        })
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "ai", content: data.choices[0].message.content }]);
    } catch {
      setMessages((m) => [...m, { role: "ai", content: "Sorry, I could not respond. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => { setMessages([]); setContextSet(false); setContext(""); setError(""); };

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(cleanForSpeech(text));
    u.lang = lang === "hi" ? "hi-IN" : lang === "ja" ? "ja-JP" : lang === "es" ? "es-ES" : lang === "fr" ? "fr-FR" : lang === "de" ? "de-DE" : "en-US";
    window.speechSynthesis.speak(u);
  };

  return (
    <div>
      {!contextSet ? (
        <div className="card">
          <div className="card-title">💬 Chat with Your Notes</div>
          <div className="card-sub">Upload PDF or TXT or paste your study material and ask any question about it.</div>

          <div className="upload-area" onClick={() => fileRef.current.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}>
            <div className="upload-icon">📄</div>
            <div className="upload-text">
              <strong>Click or drag</strong> to upload PDF or TXT<br />
              <span style={{ fontSize: "11px" }}>Supports .pdf and .txt files</span>
            </div>
            <input ref={fileRef} type="file" accept=".txt,.pdf" style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          <div className="divider">or paste text</div>

          <textarea className="study-textarea"
            placeholder="Paste your study notes or textbook content here..."
            value={context} onChange={(e) => setContext(e.target.value)} />

          {fileLoading && <p style={{ fontSize: "13px", color: "var(--accent)", marginTop: "8px" }}>📄 Reading PDF...</p>}
          {context && <div className="mt8"><span className="tag tag-green">✓ {context.split(" ").length} words loaded</span></div>}
          {error && <p style={{ color: "var(--danger)", fontSize: "13px", marginTop: "8px" }}>⚠️ {error}</p>}

          <div className="mt16">
            <button className="btn btn-primary" onClick={setStudyContext} disabled={!context.trim() || fileLoading}>
              💬 Start Chat →
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div className="card-title" style={{ marginBottom: 0 }}>💬 AI Chat</div>
            <div className="row">
              <span className="tag tag-green" style={{ fontSize: "11px" }}>
                {context.split(" ").length} words loaded
              </span>
              <button className="btn btn-ghost" style={{ padding: "6px 14px", fontSize: "12px" }} onClick={clearChat}>
                ✕ Clear
              </button>
            </div>
          </div>

          <div className="chat-messages">
            {messages.map((m, i) => (
              <motion.div key={i} className={`chat-msg ${m.role}`}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <div className="chat-avatar">{m.role === "ai" ? "🤖" : "👤"}</div>
                <div className="chat-bubble">
                  {m.content}
                  {m.role === "ai" && (
                    <button className="tts-btn" style={{ marginTop: "8px", display: "flex" }} onClick={() => speak(m.content)}>
                      🔊 Listen
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
            {loading && (
              <div className="chat-msg ai">
                <div className="chat-avatar">🤖</div>
                <div className="chat-bubble" style={{ color: "var(--muted)" }}>
                  <span className="spinner" style={{ borderTopColor: "var(--accent)" }} /> Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <input className="chat-input"
              placeholder={`Ask anything about your notes... (${LANG_NAMES[lang]})`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
            <button className="btn btn-primary" onClick={sendMessage} disabled={loading || !input.trim()}>
              Send →
            </button>
          </div>

          <div className="row mt16" style={{ flexWrap: "wrap" }}>
            {["Summarize this", "What are key points?", "Give me examples", "What should I focus on?"].map((q) => (
              <button key={q} className="btn btn-ghost" style={{ fontSize: "11px", padding: "6px 12px" }}
                onClick={() => setInput(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}