import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QuizGenerator from "./components/QuizGenerator";
import Flashcards from "./components/Flashcards";
import ProgressTracker from "./components/ProgressTracker";
import PomodoroTimer from "./components/PomodoroTimer";
import "./App.css";

const TABS = [
  { id: "quiz",     icon: "🧠", label: "Quiz"      },
  { id: "flash",    icon: "⚡", label: "Flashcards" },
  { id: "progress", icon: "📊", label: "Progress"   },
  { id: "pomodoro", icon: "⏱️", label: "Pomodoro"   },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("quiz");

  return (
    <div className="app">
      {/* Background */}
      <div className="bg-grid" />
      <div className="bg-glow" />

      {/* Header */}
      <motion.header
        className="header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="logo">
          <span className="logo-icon">📚</span>
          <span className="logo-text">StudyAI</span>
        </div>
        <p className="logo-sub">Your AI-powered study companion</p>
      </motion.header>

      {/* Tabs */}
      <motion.nav
        className="tabs"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div className="tab-indicator" layoutId="indicator" />
            )}
          </button>
        ))}
      </motion.nav>

      {/* Content */}
      <main className="main">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.35 }}
            className="tab-content"
          >
            {activeTab === "quiz"     && <QuizGenerator />}
            {activeTab === "flash"    && <Flashcards />}
            {activeTab === "progress" && <ProgressTracker />}
            {activeTab === "pomodoro" && <PomodoroTimer />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}