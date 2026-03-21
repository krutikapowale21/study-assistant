import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Library Storage Helpers ────────────────────────────────────
export function saveToLibrary(type, title, data) {
  const library = JSON.parse(localStorage.getItem("studyLibrary") || "[]");
  const entry = {
    id: Date.now(),
    type,       // "notes" | "quiz" | "flashcards" | "summary"
    title,
    data,
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
  library.unshift(entry);
  localStorage.setItem("studyLibrary", JSON.stringify(library.slice(0, 50)));
  return entry;
}

export function getLibrary() {
  return JSON.parse(localStorage.getItem("studyLibrary") || "[]");
}

export function deleteFromLibrary(id) {
  const library = getLibrary().filter((e) => e.id !== id);
  localStorage.setItem("studyLibrary", JSON.stringify(library));
}

// ── Type config ────────────────────────────────────────────────
const TYPE_CONFIG = {
  notes:      { icon: "📄", color: "var(--accent)",  label: "Notes"      },
  quiz:       { icon: "🧠", color: "var(--accent2)", label: "Quiz"       },
  flashcards: { icon: "⚡", color: "var(--accent3)", label: "Flashcards" },
  summary:    { icon: "📝", color: "var(--accent)",  label: "Summary"    },
};

// ── Library Sidebar ────────────────────────────────────────────
export default function LibrarySidebar({ open, onClose, onLoad }) {
  const [library, setLibrary] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (open) setLibrary(getLibrary());
  }, [open]);

  const handleDelete = (id) => {
    deleteFromLibrary(id);
    setLibrary(getLibrary());
    if (preview?.id === id) setPreview(null);
  };

  const filtered = library.filter((e) => {
    const matchFilter = filter === "all" || e.type === filter;
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const handleLoad = (entry) => {
    onLoad(entry);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.div
            className="sidebar"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="sidebar-header">
              <div className="sidebar-title">
                <span>📚</span> Study Library
              </div>
              <button className="sidebar-close" onClick={onClose}>✕</button>
            </div>

            {/* Search */}
            <div className="sidebar-search">
              <input
                className="sidebar-search-input"
                placeholder="Search saved content..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Filter tabs */}
            <div className="sidebar-filters">
              {["all", "notes", "quiz", "flashcards", "summary"].map((f) => (
                <button
                  key={f}
                  className={`sidebar-filter-btn ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "All" : TYPE_CONFIG[f].icon + " " + TYPE_CONFIG[f].label}
                </button>
              ))}
            </div>

            {/* Count */}
            <div className="sidebar-count">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            </div>

            {/* List */}
            <div className="sidebar-list">
              {filtered.length === 0 ? (
                <div className="sidebar-empty">
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>📭</div>
                  <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                    {library.length === 0
                      ? "Nothing saved yet.\nUse the save buttons in each tab!"
                      : "No results found."}
                  </div>
                </div>
              ) : (
                filtered.map((entry) => (
                  <motion.div
                    key={entry.id}
                    className={`sidebar-item ${preview?.id === entry.id ? "active" : ""}`}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    layout
                  >
                    <div className="sidebar-item-top" onClick={() => setPreview(preview?.id === entry.id ? null : entry)}>
                      <div className="sidebar-item-icon"
                        style={{ background: TYPE_CONFIG[entry.type]?.color + "22", color: TYPE_CONFIG[entry.type]?.color }}>
                        {TYPE_CONFIG[entry.type]?.icon}
                      </div>
                      <div className="sidebar-item-info">
                        <div className="sidebar-item-title">{entry.title}</div>
                        <div className="sidebar-item-meta">
                          <span className="sidebar-item-type" style={{ color: TYPE_CONFIG[entry.type]?.color }}>
                            {TYPE_CONFIG[entry.type]?.label}
                          </span>
                          · {entry.date} · {entry.time}
                        </div>
                      </div>
                    </div>

                    {/* Preview */}
                    <AnimatePresence>
                      {preview?.id === entry.id && (
                        <motion.div
                          className="sidebar-preview"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <div className="sidebar-preview-content">
                            {entry.type === "notes" && (
                              <p>{entry.data.text?.slice(0, 200)}...</p>
                            )}
                            {entry.type === "summary" && (
                              <p>{entry.data.summary?.slice(0, 200)}...</p>
                            )}
                            {entry.type === "quiz" && (
                              <p>{entry.data.quiz?.length} questions · {entry.data.difficulty}</p>
                            )}
                            {entry.type === "flashcards" && (
                              <p>{entry.data.cards?.length} flashcards</p>
                            )}
                          </div>
                          <div className="sidebar-preview-actions">
                            <button className="btn btn-primary" style={{ fontSize: "12px", padding: "7px 16px" }}
                              onClick={() => handleLoad(entry)}>
                              ↩ Load
                            </button>
                            <button className="btn btn-ghost" style={{ fontSize: "12px", padding: "7px 16px" }}
                              onClick={() => handleDelete(entry.id)}>
                              🗑️ Delete
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))
              )}
            </div>

            {/* Clear all */}
            {library.length > 0 && (
              <div className="sidebar-footer">
                <button className="btn btn-ghost" style={{ fontSize: "12px", width: "100%" }}
                  onClick={() => { localStorage.removeItem("studyLibrary"); setLibrary([]); setPreview(null); }}>
                  🗑️ Clear Entire Library
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}