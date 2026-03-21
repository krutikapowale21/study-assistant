import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function ProgressTracker() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const h = JSON.parse(localStorage.getItem("quizHistory") || "[]");
    setHistory(h);
  }, []);

  const clearHistory = () => {
    localStorage.removeItem("quizHistory");
    setHistory([]);
  };

  const totalQuizzes  = history.length;
  const totalCorrect  = history.reduce((s, h) => s + h.score, 0);
  const totalQuestions= history.reduce((s, h) => s + h.total, 0);
  const avgScore      = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const bestScore     = history.length ? Math.max(...history.map((h) => Math.round((h.score / h.total) * 100))) : 0;

  const diffStats = ["easy", "medium", "hard"].map((d) => {
    const filtered = history.filter((h) => h.difficulty === d);
    const avg = filtered.length
      ? Math.round(filtered.reduce((s, h) => s + (h.score / h.total) * 100, 0) / filtered.length)
      : 0;
    return { label: d, count: filtered.length, avg };
  });

  // Last 7 quiz scores for trend
  const trend = history.slice(0, 7).reverse();

  return (
    <div>
      <div className="card">
        <div className="card-title">📊 Your Progress</div>
        <div className="card-sub">Track your quiz performance and improvement over time.</div>

        {/* Stats */}
        <div className="progress-stats">
          <div className="stat-box">
            <div className="stat-box-val">{totalQuizzes}</div>
            <div className="stat-box-label">Quizzes Taken</div>
          </div>
          <div className="stat-box">
            <div className="stat-box-val" style={{ color: "var(--accent3)" }}>{avgScore}%</div>
            <div className="stat-box-label">Avg Score</div>
          </div>
          <div className="stat-box">
            <div className="stat-box-val" style={{ color: "var(--accent2)" }}>{bestScore}%</div>
            <div className="stat-box-label">Best Score</div>
          </div>
        </div>

        {/* Difficulty breakdown */}
        <div className="mt16">
          <div className="card-sub" style={{ marginBottom: "12px" }}>Performance by Difficulty</div>
          {diffStats.map((d) => (
            <div key={d.label} className="progress-bar-wrap">
              <div className="progress-bar-label">
                <span style={{ textTransform: "capitalize" }}>{d.label} ({d.count} quizzes)</span>
                <span>{d.avg}%</span>
              </div>
              <div className="progress-bar-track">
                <motion.div
                  className="progress-bar-fill"
                  style={{
                    width: `${d.avg}%`,
                    background: d.label === "easy"
                      ? "linear-gradient(90deg, var(--accent3), #3de87a)"
                      : d.label === "medium"
                      ? "linear-gradient(90deg, var(--accent), #6faaf7)"
                      : "linear-gradient(90deg, var(--accent2), #f7a84f)"
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${d.avg}%` }}
                  transition={{ duration: 1, delay: 0.2 }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Trend */}
        {trend.length > 1 && (
          <div className="mt24">
            <div className="card-sub" style={{ marginBottom: "12px" }}>Recent Trend (last {trend.length} quizzes)</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "80px" }}>
              {trend.map((h, i) => {
                const pct = Math.round((h.score / h.total) * 100);
                return (
                  <motion.div
                    key={i}
                    title={`${pct}%`}
                    style={{
                      flex: 1,
                      background: pct >= 70 ? "var(--accent3)" : pct >= 50 ? "var(--accent)" : "var(--danger)",
                      borderRadius: "6px 6px 0 0",
                      opacity: 0.85,
                    }}
                    initial={{ height: 0 }}
                    animate={{ height: `${pct}%` }}
                    transition={{ duration: 0.8, delay: i * 0.08 }}
                  />
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              {trend.map((_, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "10px", color: "var(--muted)" }}>
                  #{i + 1}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Quiz History</div>
          {history.length > 0 && (
            <button className="btn btn-ghost" style={{ fontSize: "12px", padding: "6px 14px" }} onClick={clearHistory}>
              🗑️ Clear
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📝</div>
            <div className="empty-text">No quizzes taken yet.<br />Head to the Quiz tab to get started!</div>
          </div>
        ) : (
          history.map((h, i) => (
            <motion.div
              key={i}
              className="history-item"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div>
                <div style={{ fontSize: "13px", marginBottom: "2px" }}>
                  Quiz #{history.length - i}
                  <span className={`tag ${h.difficulty === "easy" ? "tag-green" : h.difficulty === "hard" ? "tag-gold" : "tag-blue"}`}
                    style={{ marginLeft: "8px", fontSize: "10px" }}>
                    {h.difficulty}
                  </span>
                </div>
                <div className="history-date">{h.date}</div>
              </div>
              <div className="history-score">
                {h.score}/{h.total} — {Math.round((h.score / h.total) * 100)}%
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}