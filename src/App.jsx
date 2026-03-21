import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QuizGenerator from "./components/QuizGenerator";
import Flashcards from "./components/Flashcards";
import ProgressTracker from "./components/ProgressTracker";
import PomodoroTimer from "./components/PomodoroTimer";
import AIChat from "./components/AIChat";
import SummaryGenerator from "./components/SummaryGenerator";
import LibrarySidebar from "./components/LibrarySidebar";
import "./App.css";

const TABS = [
  { id: "quiz",     icon: "🧠", label: "Quiz"      },
  { id: "flash",    icon: "⚡", label: "Flashcards" },
  { id: "chat",     icon: "💬", label: "AI Chat"    },
  { id: "summary",  icon: "📝", label: "Summary"    },
  { id: "progress", icon: "📊", label: "Progress"   },
  { id: "pomodoro", icon: "⏱️", label: "Pomodoro"   },
];

const LANGS = [
  { code: "en", label: "🇬🇧 EN" },
  { code: "hi", label: "🇮🇳 HI" },
  { code: "es", label: "🇪🇸 ES" },
  { code: "fr", label: "🇫🇷 FR" },
  { code: "de", label: "🇩🇪 DE" },
  { code: "ja", label: "🇯🇵 JA" },
];

function useStreak() {
  const [streak, setStreak] = useState(1);
  useEffect(() => {
    const today = new Date().toDateString();
    const stored = parseInt(localStorage.getItem("studyStreak") || "0");
    const storedDate = localStorage.getItem("lastStudyDate");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (storedDate === today) {
      setStreak(stored || 1);
    } else if (storedDate === yesterday.toDateString()) {
      const n = stored + 1;
      localStorage.setItem("studyStreak", String(n));
      localStorage.setItem("lastStudyDate", today);
      setStreak(n);
    } else {
      localStorage.setItem("studyStreak", "1");
      localStorage.setItem("lastStudyDate", today);
      setStreak(1);
    }
  }, []);
  return streak;
}

export default function App() {
  const [activeTab, setActiveTab] = useState("quiz");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") !== "false");
  const [lang, setLang] = useState(() => localStorage.getItem("studyLang") || "en");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [loadedEntry, setLoadedEntry] = useState(null);
  const streak = useStreak();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  useEffect(() => { localStorage.setItem("studyLang", lang); }, [lang]);

  // When user loads an entry from library — switch to correct tab
  const handleLibraryLoad = (entry) => {
    setLoadedEntry(entry);
    if (entry.type === "notes")      setActiveTab("quiz");
    if (entry.type === "quiz")       setActiveTab("quiz");
    if (entry.type === "flashcards") setActiveTab("flash");
    if (entry.type === "summary")    setActiveTab("summary");
  };

  return (
    <div className="app">
      <div className="bg-grid" />
      <div className="bg-glow" />

      {/* Library Sidebar */}
      <LibrarySidebar
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onLoad={handleLibraryLoad}
      />

      {/* Header */}
      <motion.header className="header"
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="header-top">
          <motion.div className="streak-badge" whileHover={{ scale: 1.08 }} title="Study streak">
            🔥 {streak} day{streak !== 1 ? "s" : ""}
          </motion.div>

          <div className="logo">
            <span className="logo-icon">📚</span>
            <span className="logo-text">StudyAI</span>
          </div>

          <div className="header-controls">
            {/* Library button */}
            <button className="library-btn" onClick={() => setLibraryOpen(true)} title="Open library">
              🗂️
            </button>
            <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <button className="theme-toggle" onClick={() => setDarkMode((d) => !d)}>
              {darkMode ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
        <p className="logo-sub">Your AI-powered study companion</p>
      </motion.header>

      {/* Tabs */}
      <motion.nav className="tabs"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
        {TABS.map((tab) => (
          <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}>
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {activeTab === tab.id && <motion.div className="tab-indicator" layoutId="indicator" />}
          </button>
        ))}
      </motion.nav>

      {/* Content */}
      <main className="main">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.35 }} className="tab-content">
            {activeTab === "quiz"     && <QuizGenerator lang={lang} loadedEntry={loadedEntry} onEntrySaved={() => setLoadedEntry(null)} />}
            {activeTab === "flash"    && <Flashcards lang={lang} loadedEntry={loadedEntry} onEntrySaved={() => setLoadedEntry(null)} />}
            {activeTab === "chat"     && <AIChat lang={lang} />}
            {activeTab === "summary"  && <SummaryGenerator lang={lang} loadedEntry={loadedEntry} onEntrySaved={() => setLoadedEntry(null)} />}
            {activeTab === "progress" && <ProgressTracker />}
            {activeTab === "pomodoro" && <PomodoroTimer />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}