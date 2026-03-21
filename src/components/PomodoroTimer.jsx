import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

const MODES = {
  focus:      { label: "Focus",       duration: 25 * 60, color: "var(--accent)"  },
  short:      { label: "Short Break", duration:  5 * 60, color: "var(--accent3)" },
  long:       { label: "Long Break",  duration: 15 * 60, color: "var(--accent2)" },
};

const CIRCUMFERENCE = 2 * Math.PI * 96; // r=96

export default function PomodoroTimer() {
  const [mode, setMode]       = useState("focus");
  const [timeLeft, setTimeLeft] = useState(MODES.focus.duration);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [task, setTask]       = useState("");
  const [tasks, setTasks]     = useState(() => JSON.parse(localStorage.getItem("pomodoroTasks") || "[]"));
  const intervalRef = useRef(null);
  const audioRef    = useRef(null);

  const total = MODES[mode].duration;
  const progress = (timeLeft / total);
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            if (mode === "focus") setSessions((s) => s + 1);
            // Play sound
            try { new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3").play(); } catch {}
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, mode]);

  const switchMode = (m) => {
    setMode(m);
    setTimeLeft(MODES[m].duration);
    setRunning(false);
  };

  const reset = () => {
    setTimeLeft(MODES[mode].duration);
    setRunning(false);
  };

  const addTask = () => {
    if (!task.trim()) return;
    const updated = [{ text: task, done: false, id: Date.now() }, ...tasks];
    setTasks(updated);
    localStorage.setItem("pomodoroTasks", JSON.stringify(updated));
    setTask("");
  };

  const toggleTask = (id) => {
    const updated = tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t);
    setTasks(updated);
    localStorage.setItem("pomodoroTasks", JSON.stringify(updated));
  };

  const deleteTask = (id) => {
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    localStorage.setItem("pomodoroTasks", JSON.stringify(updated));
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">⏱️ Pomodoro Timer</div>
        <div className="card-sub">Stay focused with timed study sessions. 4 pomodoros = 1 long break.</div>

        <div className="pomodoro-wrap">
          {/* Mode buttons */}
          <div className="pomodoro-modes">
            {Object.entries(MODES).map(([key, val]) => (
              <button key={key} className={`mode-btn ${mode === key ? "active" : ""}`}
                style={mode === key ? { background: val.color, borderColor: val.color } : {}}
                onClick={() => switchMode(key)}>
                {val.label}
              </button>
            ))}
          </div>

          {/* Ring */}
          <div className="pomodoro-ring">
            <svg viewBox="0 0 220 220">
              <circle className="pomodoro-ring-bg" cx="110" cy="110" r="96" />
              <motion.circle
                className="pomodoro-ring-progress"
                cx="110" cy="110" r="96"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                style={{ stroke: MODES[mode].color }}
                transition={{ duration: 0.5 }}
              />
            </svg>
            <div className="pomodoro-time-label">
              <div className="pomodoro-time" style={{ color: MODES[mode].color }}>{fmt(timeLeft)}</div>
              <div className="pomodoro-mode">{MODES[mode].label}</div>
            </div>
          </div>

          {/* Controls */}
          <div className="pomodoro-controls">
            <button className="btn btn-ghost" onClick={reset}>↺ Reset</button>
            <button
              className="btn btn-primary"
              style={{ background: MODES[mode].color, minWidth: "100px" }}
              onClick={() => setRunning((r) => !r)}
            >
              {running ? "⏸ Pause" : "▶ Start"}
            </button>
          </div>

          {/* Session dots */}
          <div className="pomodoro-sessions">
            {[0,1,2,3].map((i) => (
              <div key={i} className={`session-dot ${i < sessions % 4 ? "done" : ""}`} />
            ))}
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "8px" }}>
            {sessions} session{sessions !== 1 ? "s" : ""} completed today
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="card">
        <div className="card-title">📋 Study Tasks</div>
        <div className="card-sub">Track what you want to accomplish during your study sessions.</div>

        <div className="row" style={{ marginBottom: "16px" }}>
          <input
            className="study-textarea"
            style={{ minHeight: "unset", padding: "11px 16px", borderRadius: "50px", flex: 1 }}
            placeholder="Add a task..."
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
          />
          <button className="btn btn-primary" onClick={addTask}>+ Add</button>
        </div>

        {tasks.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">✅</div>
            <div className="empty-text">No tasks yet. Add something to focus on!</div>
          </div>
        ) : (
          tasks.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 14px",
                background: "var(--surface2)",
                borderRadius: "var(--radius)",
                marginBottom: "8px",
                opacity: t.done ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}
            >
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggleTask(t.id)}
                style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "var(--accent3)" }}
              />
              <span style={{
                flex: 1,
                fontSize: "13px",
                textDecoration: t.done ? "line-through" : "none",
                color: t.done ? "var(--muted)" : "var(--text)"
              }}>
                {t.text}
              </span>
              <button
                onClick={() => deleteTask(t.id)}
                style={{
                  background: "none", border: "none", color: "var(--muted)",
                  cursor: "pointer", fontSize: "16px", lineHeight: 1,
                  transition: "color 0.2s"
                }}
                onMouseOver={(e) => e.target.style.color = "var(--danger)"}
                onMouseOut={(e) => e.target.style.color = "var(--muted)"}
              >
                ×
              </button>
            </motion.div>
          ))
        )}

        {tasks.length > 0 && (
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "8px" }}>
            {tasks.filter((t) => t.done).length} / {tasks.length} completed
          </div>
        )}
      </div>
    </div>
  );
}