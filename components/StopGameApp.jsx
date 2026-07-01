"use client";
import React, { useState, useRef, useEffect, useContext, createContext } from "react";
import {
  Plus, X, Play, RotateCcw, Check, Trophy, Clock, ChevronRight,
  Users, Wifi, Copy, ArrowLeft, Bot, Sun, Moon, Sparkles,
} from "lucide-react";
import {
  createRoom, fetchRoom, joinRoom, updateRoomState,
  submitAnswer, toggleOverride, addTotals, subscribeRoom,
} from "../lib/gameRoom";
import { t, LANGUAGES, DEFAULT_CATEGORIES as LOCALIZED_CATEGORIES, CATEGORY_IDS, SUGGESTED_CATEGORIES } from "../lib/i18n";
import { botAnswerFor } from "../lib/botWordbank";

const ALL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CATEGORIES = 15;

// pastel ribbon colors — cycled per category so each one reads like a
// different piece of washi tape / highlighter was used for it
const PASTELS = ["#ffb3c1", "#a8ddd0", "#a9cdf2", "#ffe08a", "#d3b8f0", "#ffc19e", "#a0e8d8", "#f2b8d4"];
function catColor(i) { return PASTELS[i % PASTELS.length]; }
function chipStyle(i) {
  return {
    background: catColor(i), color: "#2f2a22",
    borderRadius: "12px 12px 12px 2px",
    transform: `rotate(${i % 3 === 0 ? -2 : i % 3 === 1 ? 1.5 : -1}deg)`,
    boxShadow: "1px 3px 5px rgba(0,0,0,0.2)",
    fontWeight: 700,
  };
}

// ---------- themes ----------
const LIGHT = {
  name: "light",
  bg: "#ffffff", card: "#ffffff", rule: "#a9c9ea", margin: "#d9433a",
  text: "#2b2b2b", ink: "#4a72b5", red: "#ff9a8b", muted: "#8c8577",
  chalk: "#ffd97d", green: "#8fd4b3", inputBg: "#ffffff", ring: "#b9b2a3",
};
const DARK = {
  name: "dark",
  bg: "#20232d", card: "#292d3a", rule: "#3d5578", margin: "#c96a62",
  text: "#f4f1ea", ink: "#9fc4ea", red: "#ff9a8b", muted: "#9098b0",
  chalk: "#ffd97d", green: "#8fe0b8", inputBg: "#333850", ring: "#565c72",
};

const ThemeContext = createContext({ colors: LIGHT, theme: "light", toggle: () => {} });
function useColors() { return useContext(ThemeContext).colors; }

const FONT_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Baloo+2:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
.font-display { font-family: 'Baloo 2', cursive; font-weight: 700; }
.font-body { font-family: 'Inter', sans-serif; }
.font-title {
  font-family: 'Permanent Marker', cursive;
  color: #1c1a16;
  text-shadow:
    -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 2px 0 #fff,
    0 -3px 0 #fff, 0 3px 0 #fff, -3px 0 0 #fff, 3px 0 0 #fff;
}
`;

function normalize(s) {
  return (s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function genId() { return Math.random().toString(36).slice(2, 10); }
function genCode() {
  let c = "";
  for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}
function isNearlyComplete(val) { return normalize(val).length >= 3; }
function canCallStop(answers, categories) {
  if (categories.length === 0) return false;
  const filled = categories.filter((c) => isNearlyComplete(answers[c])).length;
  return filled >= Math.max(1, Math.ceil(categories.length * 0.8));
}
function scoreRound(categories, playerIds, getAnswer, letter, disabledKeys = []) {
  const scores = {};
  playerIds.forEach((id) => (scores[id] = 0));
  const L = (letter || "").toLowerCase();
  categories.forEach((cat) => {
    const written = playerIds.filter((id) => normalize(getAnswer(id, cat)).length > 0);
    if (written.length === 0) return;
    if (written.length === 1) {
      const id = written[0];
      const val = normalize(getAnswer(id, cat));
      const key = `${id}-${cat}`;
      if (val[0] === L && !disabledKeys.includes(key)) scores[id] += 20;
      return;
    }
    const validIds = written.filter((id) => {
      const val = normalize(getAnswer(id, cat));
      return val[0] === L && !disabledKeys.includes(`${id}-${cat}`);
    });
    const counts = {};
    validIds.forEach((id) => { const v = normalize(getAnswer(id, cat)); counts[v] = (counts[v] || 0) + 1; });
    validIds.forEach((id) => { const v = normalize(getAnswer(id, cat)); scores[id] += counts[v] > 1 ? 5 : 10; });
  });
  return scores;
}

// ============================================================
// SHARED UI PIECES
// ============================================================
function ruledBg(C, size) {
  return {
    backgroundColor: C.card,
    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent ${size - 1}px, ${C.rule} ${size}px)`,
  };
}
// jagged "torn page" top edge
function tornEdgePath(teeth = 26, amp = 7) {
  const pts = [];
  for (let i = 0; i <= teeth; i++) {
    const x = (i / teeth) * 100;
    const y = i % 2 === 0 ? 0 : amp;
    pts.push(`${x}% ${y}px`);
  }
  pts.push("100% 100%", "0% 100%");
  return `polygon(${pts.join(",")})`;
}
// the spiral-ring binding strip running down the left edge of the page
function SpiralBinding() {
  const C = useColors();
  return (
    <div
      className="hidden sm:block flex-shrink-0"
      style={{
        width: 26,
        backgroundImage: `radial-gradient(circle, transparent 6px, ${C.ring} 6px, ${C.ring} 9px, transparent 9px)`,
        backgroundSize: "100% 30px",
        backgroundRepeat: "repeat-y",
        backgroundPosition: "center top",
      }}
    />
  );
}
function Header({ subtitle }) {
  const { theme, toggle } = useContext(ThemeContext);
  const C = useColors();
  return (
    <div className="flex items-start justify-between mb-6">
      <div style={{ width: 32 }} />
      <div className="flex flex-col items-center flex-1">
        <h1 className="font-display text-5xl" style={{ color: C.red, transform: "rotate(-1deg)" }}>¡STOP!</h1>
        {subtitle && <p className="text-xs font-body mt-1" style={{ color: C.muted }}>{subtitle}</p>}
      </div>
      <button onClick={toggle} className="p-2 rounded-full" style={{ color: C.text, border: `1px solid ${C.rule}` }}>
        {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
      </button>
    </div>
  );
}
function Card({ children, className = "" }) {
  const C = useColors();
  return (
    <div className={`mb-4 ${className}`} style={{
      ...ruledBg(C, 24), borderRadius: 12, padding: "20px",
      boxShadow: "0 1px 0 rgba(0,0,0,0.05), 0 6px 18px rgba(0,0,0,0.12)",
      border: `1px solid ${C.rule}`,
    }}>
      {children}
    </div>
  );
}
function BackBar({ onBack, label }) {
  const C = useColors();
  return (
    <button onClick={onBack} className="flex items-center gap-1 text-sm font-body mb-4" style={{ color: C.muted }}>
      <ArrowLeft size={14} /> {label}
    </button>
  );
}
function PrimaryButton({ children, onClick, disabled, colorKey = "red", icon }) {
  const C = useColors();
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-display text-xl disabled:opacity-40"
      style={{ background: C[colorKey], color: "#2f2a22", boxShadow: "0 3px 0 rgba(0,0,0,0.18)" }}>
      {icon} {children}
    </button>
  );
}
function LetterSpinner({ usedLetters, onLanded, lang }) {
  const C = useColors();
  const [display, setDisplay] = useState("A");
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(null);
  const spin = () => {
    if (spinning) return;
    const available = ALL_LETTERS.filter((l) => !usedLetters.includes(l));
    const pool = available.length > 0 ? available : ALL_LETTERS;
    const target = pool[Math.floor(Math.random() * pool.length)];
    setSpinning(true);
    let ticks = 0;
    const totalTicks = 16;
    const step = () => {
      ticks++;
      setDisplay(ALL_LETTERS[Math.floor(Math.random() * ALL_LETTERS.length)]);
      if (ticks >= totalTicks) { setDisplay(target); setLanded(target); setSpinning(false); }
      else setTimeout(step, 70 + ticks * 4);
    };
    step();
  };
  return (
    <div className="flex flex-col items-center py-4">
      <div className="flex items-center justify-center font-display"
        style={{ width: 120, height: 120, fontSize: 54, borderRadius: 999, border: `3px dashed ${C.ink}`, color: landed ? C.red : C.ink }}>
        {landed || display}
      </div>
      {!landed ? (
        <button onClick={spin} disabled={spinning}
          className="mt-5 flex items-center gap-2 rounded-xl px-6 py-3 font-display text-lg disabled:opacity-50"
          style={{ background: C.chalk, color: "#2f2a22" }}>
          <RotateCcw size={18} className={spinning ? "animate-spin" : ""} />
          {spinning ? t(lang, "spinning") : t(lang, "spinLetter")}
        </button>
      ) : (
        <button onClick={() => onLanded(landed)} className="mt-5 flex items-center gap-2 rounded-xl px-6 py-3 font-display text-lg"
          style={{ background: C.green, color: "#2f2a22" }}>
          {t(lang, "confirm")} <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}
function CategoryEditor({ lang, categories, setCategories }) {
  const C = useColors();
  const [newCat, setNewCat] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const add = (value) => {
    const c = (value ?? newCat).trim();
    if (c && categories.length < MAX_CATEGORIES && !categories.includes(c)) {
      setCategories([...categories, c]);
      setNewCat("");
    }
  };
  const remove = (c) => setCategories(categories.filter((x) => x !== c));
  const suggestions = (SUGGESTED_CATEGORIES[lang] || SUGGESTED_CATEGORIES.es).filter((s) => !categories.includes(s));

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        {categories.map((c, i) => (
          <span key={c} className="flex items-center gap-1 text-sm font-body px-3 py-1.5" style={chipStyle(i)}>
            {c}
            <button onClick={() => remove(c)}><X size={12} color="#2f2a22" /></button>
          </span>
        ))}
      </div>

      {categories.length < MAX_CATEGORIES ? (
        <>
          <div className="flex gap-2 mb-2">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder={t(lang, "newCategoryPlaceholder")} className="flex-1 rounded-lg px-3 py-2 outline-none font-body text-sm"
              style={{ background: C.inputBg, border: `1px solid ${C.rule}`, color: C.text }} />
            <button onClick={() => add()} className="px-3 rounded-lg font-body text-sm font-medium" style={{ background: C.red, color: "#2f2a22" }}>
              <Plus size={16} />
            </button>
          </div>
          <button onClick={() => setShowSuggestions((s) => !s)} className="text-xs font-body font-medium mb-2" style={{ color: C.ink }}>
            {t(lang, "suggestions")}
          </button>
          {showSuggestions && (
            <div className="flex flex-wrap gap-2 mb-2">
              {suggestions.map((s, i) => (
                <button key={s} onClick={() => add(s)} className="text-xs font-body px-2.5 py-1 rounded-lg opacity-90"
                  style={{ background: catColor(i), color: "#2f2a22", fontWeight: 600 }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-xs font-body" style={{ color: C.muted }}>{t(lang, "maxCategories")}</p>
      )}
      <p className="text-xs font-body mt-1" style={{ color: C.muted }}>{t(lang, "categoriesHint")}</p>
    </div>
  );
}
function focusNext(inputRefs, i) {
  const next = inputRefs.current[i + 1];
  if (next) next.focus();
}

// ============================================================
// APP ROOT — the whole app sits on an open notebook: grid-ruled page(s)
// with a visible spiral binding. Wide screens get more breathing room,
// not just a wider single column.
// ============================================================
export default function StopGameApp() {
  const [mode, setMode] = useState("menu");
  const [lang, setLang] = useState("es");
  const [theme, setTheme] = useState("light");
  const colors = theme === "light" ? LIGHT : DARK;
  const toggle = () => setTheme((th) => (th === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ colors, theme, toggle }}>
      <div className="font-body min-h-screen w-full flex justify-center py-4 sm:py-8" style={{ background: theme === "light" ? "#eef1f4" : "#14161d", color: colors.text }}>
        <style>{FONT_STYLE}</style>
        <div className="flex w-full max-w-6xl shadow-2xl" style={{ clipPath: tornEdgePath(), background: colors.bg }}>
          <SpiralBinding />
          <div className="flex-1 min-w-0 relative px-5 sm:px-10 pt-6 pb-10" style={ruledBg(colors, 30)}>
            {/* red margin rule, like a real notebook page */}
            <div className="hidden sm:block absolute top-0 bottom-0" style={{ left: 56, width: 2, background: colors.margin, opacity: 0.6 }} />
            <div className="max-w-md sm:max-w-2xl lg:max-w-5xl mx-auto">
              {mode === "menu" && <MenuScreen setMode={setMode} lang={lang} setLang={setLang} />}
              {mode === "online" && <OnlineGame lang={lang} onExit={() => setMode("menu")} />}
              {mode === "practice" && <PracticeGame lang={lang} onExit={() => setMode("menu")} />}
            </div>
          </div>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

// a real sticky note: folded corner, drop shadow, slight rotation, centered content
function PostItCard({ children, color, rotate = -1.5, className = "" }) {
  const bg = color || "#fff6c9";
  return (
    <div className={`relative text-center ${className}`} style={{
      background: bg, padding: "24px 20px", transform: `rotate(${rotate}deg)`,
      boxShadow: "3px 6px 14px rgba(0,0,0,0.25)", borderRadius: "2px",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0, width: 0, height: 0,
        borderStyle: "solid", borderWidth: "0 20px 20px 0",
        borderColor: `transparent rgba(0,0,0,0.16) transparent transparent`,
      }} />
      {children}
    </div>
  );
}

const AKA_NAMES = ["Tutti Frutti", "Basta", "Bachillerato", "Alto el Lápiz", "Stadt, Land, Fluss", "Párame la Mano"];

const DECORATIONS = [
  { kind: "note", top: "2%", left: "2%", color: "#ffd3dc", rot: -14, size: 46 },
  { kind: "emoji", e: "✏️", top: "6%", left: "92%", size: 46, rot: 16 },
  { kind: "note", top: "22%", left: "94%", color: "#a8ddd0", rot: 10 },
  { kind: "emoji", e: "🍓", top: "36%", left: "2%", size: 40, rot: -8 },
  { kind: "note", top: "50%", left: "95%", color: "#a9cdf2", rot: -8 },
  { kind: "emoji", e: "🌍", top: "64%", left: "1%", size: 42, rot: 6 },
  { kind: "note", top: "78%", left: "93%", color: "#ffe08a", rot: 12 },
  { kind: "emoji", e: "⭐", top: "12%", left: "48%", size: 26, rot: 0 },
  { kind: "emoji", e: "🦒", top: "90%", left: "6%", size: 38, rot: -10 },
];

function CoverDecorations() {
  const { theme } = useContext(ThemeContext);
  return (
    <div className="hidden md:block absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {DECORATIONS.map((d, i) =>
        d.kind === "emoji" ? (
          <span key={i} style={{ position: "absolute", top: d.top, left: d.left, fontSize: d.size, transform: `rotate(${d.rot}deg)`, opacity: theme === "light" ? 0.28 : 0.2 }}>{d.e}</span>
        ) : (
          <span key={i} style={{
            position: "absolute", top: d.top, left: d.left, width: 34, height: 34, background: d.color,
            transform: `rotate(${d.rot}deg)`, opacity: theme === "light" ? 0.55 : 0.35, boxShadow: "1px 2px 4px rgba(0,0,0,0.2)",
          }} />
        )
      )}
    </div>
  );
}

function useGuideExamples(lang) {
  const cats = [
    { id: "country", letter: "A" }, { id: "name", letter: "B" }, { id: "animal", letter: "C" },
    { id: "fruit", letter: "D" }, { id: "color", letter: "F" }, { id: "object", letter: "M" },
  ];
  return cats.map(({ id, letter }, i) => {
    const idx = CATEGORY_IDS.indexOf(id);
    const catLabel = LOCALIZED_CATEGORIES[lang]?.[idx] || id;
    const word = botAnswerFor(lang, id, letter) || botAnswerFor("es", id, letter) || "…";
    return { catLabel, letter, word, i };
  });
}

function MenuScreen({ setMode, lang, setLang }) {
  const C = useColors();
  const guide = useGuideExamples(lang);
  const rules = t(lang, "howToPlay").split("\n");

  return (
    <div className="relative">
      <CoverDecorations />
      <div className="relative flex justify-end mb-2">
        <HeaderThemeToggle />
      </div>

      <div className="relative text-center mb-3 py-4">
        <h1 className="font-title text-6xl sm:text-7xl lg:text-8xl inline-block" style={{ transform: "rotate(-2deg)" }}>
          ¡STOP!
        </h1>
        <p className="font-display text-xl mt-1" style={{ color: C.ink }}>{t(lang, "appSubtitle")}</p>
        <p className="text-xs font-body mt-3" style={{ color: C.muted }}>{t(lang, "akaLabel")}</p>
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {AKA_NAMES.map((n, i) => (
            <span key={n} className="text-xs font-body px-2.5 py-1 rounded-full" style={{ background: catColor(i), color: "#2f2a22", fontWeight: 600 }}>{n}</span>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-8 justify-center flex-wrap relative">
        {LANGUAGES.map((l) => (
          <button key={l.code} onClick={() => setLang(l.code)}
            className="px-3 py-1 rounded-full text-xs font-body font-medium border"
            style={{ borderColor: C.ink, background: lang === l.code ? C.ink : "transparent", color: lang === l.code ? "#fff" : C.ink }}>
            {l.label}
          </button>
        ))}
      </div>

      <div className="sm:grid sm:grid-cols-2 sm:gap-8 relative mb-10 max-w-2xl mx-auto">
        <PostItCard color="#ffb3c1" rotate={-2}>
          <div className="flex flex-col items-center gap-2 mb-2"><Wifi size={20} color="#2f2a22" /><h2 className="font-display text-2xl" style={{ color: "#2f2a22" }}>{t(lang, "menuOnlineTitle")}</h2></div>
          <p className="text-sm font-body mb-4" style={{ color: "#4a4438" }}>{t(lang, "menuOnlineDesc")}</p>
          <button onClick={() => setMode("online")} className="w-full flex items-center justify-center gap-2 rounded-lg py-3 font-display text-lg" style={{ background: "#fff", color: "#2f2a22", boxShadow: "0 2px 0 rgba(0,0,0,0.15)" }}>
            <Wifi size={18} /> {t(lang, "menuOnlineBtn")}
          </button>
        </PostItCard>
        <PostItCard color="#ffe08a" rotate={2}>
          <div className="flex flex-col items-center gap-2 mb-2"><Bot size={20} color="#2f2a22" /><h2 className="font-display text-2xl" style={{ color: "#2f2a22" }}>{t(lang, "menuPracticeTitle")}</h2></div>
          <p className="text-sm font-body mb-4" style={{ color: "#4a4438" }}>{t(lang, "menuPracticeDesc")}</p>
          <button onClick={() => setMode("practice")} className="w-full flex items-center justify-center gap-2 rounded-lg py-3 font-display text-lg" style={{ background: "#fff", color: "#2f2a22", boxShadow: "0 2px 0 rgba(0,0,0,0.15)" }}>
            <Bot size={18} /> {t(lang, "menuPracticeBtn")}
          </button>
        </PostItCard>
      </div>

      <div className="lg:grid lg:grid-cols-5 lg:gap-8 relative max-w-4xl mx-auto">
        <div className="lg:col-span-3">
          <PostItCard color="#a9cdf2" rotate={-1}>
            <h3 className="font-display text-2xl mb-3" style={{ color: "#2f2a22" }}>{t(lang, "howToPlayTitle")}</h3>
            <div className="space-y-2 text-left max-w-md mx-auto">
              {rules.map((line, i) => (
                <p key={i} className="text-sm font-body leading-relaxed" style={{ color: "#2f2a22" }}>{line}</p>
              ))}
            </div>
          </PostItCard>
        </div>
        <div className="lg:col-span-2">
          <PostItCard color="#a8ddd0" rotate={1.5}>
            <h3 className="font-display text-2xl mb-3" style={{ color: "#2f2a22" }}>{t(lang, "categories")}</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {guide.map((g) => (
                <span key={g.catLabel} className="text-xs font-body px-2.5 py-1.5" style={chipStyle(g.i)}>
                  {g.letter} · {g.catLabel}: {g.word}
                </span>
              ))}
            </div>
          </PostItCard>
        </div>
      </div>
    </div>
  );
}

function HeaderThemeToggle() {
  const { theme, toggle } = useContext(ThemeContext);
  const C = useColors();
  return (
    <button onClick={toggle} className="p-2 rounded-full" style={{ color: C.text, border: `1px solid ${C.rule}` }}>
      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}

function AnswerGrid({ categories, answers, onChange, inputRefs }) {
  const C = useColors();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {categories.map((cat, i) => (
        <div key={cat}>
          <span className="inline-block text-xs font-body px-2.5 py-1 mb-1" style={chipStyle(i)}>{cat}</span>
          <input
            ref={(el) => (inputRefs.current[i] = el)}
            value={answers[cat] || ""}
            onChange={(e) => onChange(cat, e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext(inputRefs, i); } }}
            className="w-full rounded-lg px-3 py-2 outline-none font-body text-sm"
            style={{ background: C.inputBg, border: `1px solid ${C.rule}`, color: C.text }}
          />
        </div>
      ))}
    </div>
  );
}

// letter + timer + STOP, meant to sit as a slim sidebar next to the answer grid on wide screens
function RoundStatusPanel({ lang, letter, elapsedSecs, canStop, onStop, hintKey }) {
  const C = useColors();
  return (
    <Card className="lg:sticky lg:top-8">
      <p className="text-xs font-body mb-1" style={{ color: C.muted }}>{t(lang, "letter")}</p>
      <div className="font-display flex items-center justify-center rounded-xl mb-3"
        style={{ width: 84, height: 84, fontSize: 40, background: C.red, color: "#2f2a22" }}>
        {letter}
      </div>
      <div className="flex items-center gap-1 text-sm font-body mb-3" style={{ color: C.muted }}>
        <Clock size={14} /> {elapsedSecs}s
      </div>
      <button onClick={onStop} disabled={!canStop}
        className="w-full font-display text-xl rounded-xl py-3 disabled:opacity-30"
        style={{ background: C.red, color: "#2f2a22", boxShadow: "0 3px 0 rgba(0,0,0,0.18)" }}>
        {t(lang, "stopBtn")}
      </button>
      {!canStop && <p className="text-xs font-body mt-2" style={{ color: C.muted }}>{t(lang, hintKey)}</p>}
    </Card>
  );
}

function RevealList({ lang, letter, categories, players, getAnswer, disabledKeys, toggleInvalid, stoppedByLabel }) {
  const C = useColors();
  return (
    <Card>
      <h2 className="font-display text-2xl mb-1" style={{ color: C.red }}>{t(lang, "resultsTitle")} {letter}</h2>
      {stoppedByLabel && <p className="text-xs font-body mb-1" style={{ color: C.red }}>{stoppedByLabel}</p>}
      <p className="text-xs font-body mb-4" style={{ color: C.muted }}>{t(lang, "tapToInvalidate")}</p>
      <div className="sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-x-6">
        {categories.map((cat, i) => (
          <div key={cat} className="mb-4">
            <span className="inline-block text-sm font-body px-2.5 py-1 mb-1" style={chipStyle(i)}>{cat}</span>
            <div className="max-h-56 overflow-y-auto pr-1">
              {players.map((p) => {
                const val = getAnswer(p.id, cat);
                const norm = normalize(val);
                const validStart = norm.length > 0 && norm[0] === letter.toLowerCase();
                const key = `${p.id}-${cat}`;
                const isDisabled = disabledKeys.includes(key);
                return (
                  <button key={p.id} onClick={() => validStart && toggleInvalid(p.id, cat)}
                    className="w-full flex items-center justify-between text-sm font-body py-1" style={{ opacity: validStart && !isDisabled ? 1 : 0.4 }}>
                    <span>{p.name}: {val || "—"}</span>
                    {validStart && <Check size={14} color={isDisabled ? C.muted : C.green} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RoundPointsCard({ lang, players, roundScores }) {
  const C = useColors();
  return (
    <Card className="lg:sticky lg:top-8">
      <h3 className="font-display text-xl mb-2" style={{ color: C.ink }}>{t(lang, "roundPoints")}</h3>
      {players.map((p) => (
        <div key={p.id} className="flex justify-between text-sm font-body py-1">
          <span>{p.name}</span><span className="font-display text-lg" style={{ color: C.red }}>+{roundScores[p.id] || 0}</span>
        </div>
      ))}
    </Card>
  );
}

function GameOverBlock({ lang, sortedTotals, totals, onReset }) {
  const C = useColors();
  return (
    <div>
      <Card>
        <div className="flex flex-col items-center py-4">
          <Trophy size={40} color={C.chalk} />
          <h2 className="font-display text-3xl mt-2" style={{ color: C.red }}>{t(lang, "gameOverTitle")}</h2>
        </div>
        {sortedTotals.map((p, i) => (
          <div key={p.id} className="flex justify-between items-center rounded-lg px-3 py-2 mb-1 font-body text-sm" style={{ background: i === 0 ? C.bg : "transparent" }}>
            <span style={{ color: i === 0 ? C.red : C.text }}>{i === 0 ? "🏆 " : `${i + 1}. `}{p.name}</span>
            <span className="font-display text-lg">{totals[p.id] || 0}</span>
          </div>
        ))}
      </Card>
      <PrimaryButton onClick={onReset} colorKey="green" icon={<RotateCcw size={18} />}>{t(lang, "playAgain")}</PrimaryButton>
    </div>
  );
}

// ============================================================
// PRACTICE MODE
// ============================================================
function PracticeGame({ lang, onExit }) {
  const C = useColors();
  const [phase, setPhase] = useState("setup");
  const [numBots, setNumBots] = useState(2);
  const [difficulty, setDifficulty] = useState("medium");
  const [categories, setCategories] = useState(LOCALIZED_CATEGORIES[lang]);
  const [usedLetters, setUsedLetters] = useState([]);
  const [currentLetter, setCurrentLetter] = useState(null);
  const [humanAnswers, setHumanAnswers] = useState({});
  const [botAnswers, setBotAnswers] = useState({});
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [bestTime, setBestTime] = useState(null);
  const [lastElapsed, setLastElapsed] = useState(null);
  const [lastIsRecord, setLastIsRecord] = useState(false);
  const [totals, setTotals] = useState({ human: 0 });
  const [disabledKeys, setDisabledKeys] = useState([]);
  const tickRef = useRef(null);
  const inputRefs = useRef([]);

  const successRate = { easy: 0.55, medium: 0.8, hard: 0.95 }[difficulty];
  const botIds = Array.from({ length: numBots }, (_, i) => `bot${i + 1}`);
  const allIds = ["human", ...botIds];

  const startGame = () => {
    const initTotals = { human: 0 };
    botIds.forEach((b) => (initTotals[b] = 0));
    setTotals(initTotals);
    setPhase("spin");
  };
  const onLetterLanded = (letter) => { setCurrentLetter(letter); setUsedLetters((u) => [...u, letter]); };
  const beginRound = () => {
    if (!currentLetter) return;
    setHumanAnswers({}); setBotAnswers({}); setElapsed(0); setStarted(false); setPhase("playerTurn");
  };

  useEffect(() => {
    if (phase !== "playerTurn" || !started) return;
    tickRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(tickRef.current);
  }, [phase, started]);

  const finishRound = () => {
    clearInterval(tickRef.current);
    const finalElapsed = elapsed;
    const isRecord = bestTime !== null && finalElapsed < bestTime;
    setLastElapsed(finalElapsed);
    setLastIsRecord(isRecord);
    setBestTime((prev) => (prev === null || finalElapsed < prev ? finalElapsed : prev));

    const generated = {};
    botIds.forEach((b) => {
      generated[b] = {};
      categories.forEach((cat, i) => {
        const catId = CATEGORY_IDS[i];
        if (!catId) return;
        if (Math.random() > successRate) return;
        const word = botAnswerFor(lang, catId, currentLetter);
        if (word) generated[b][cat] = word;
      });
    });
    setBotAnswers(generated);
    setPhase("reveal");
  };

  const handleAnswerChange = (cat, val) => setHumanAnswers((a) => ({ ...a, [cat]: val }));
  const getAnswer = (id, cat) => (id === "human" ? humanAnswers[cat] || "" : botAnswers[id]?.[cat] || "");

  const roundScores = (() => {
    if (!currentLetter || phase !== "reveal") return {};
    return scoreRound(categories, allIds, getAnswer, currentLetter, disabledKeys);
  })();

  useEffect(() => { if (phase === "reveal") setDisabledKeys([]); }, [phase]);
  const toggleInvalid = (id, cat) => {
    const key = `${id}-${cat}`;
    setDisabledKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const confirmRoundScores = () => {
    setTotals((tt) => {
      const nt = { ...tt };
      allIds.forEach((id) => { nt[id] = (nt[id] || 0) + (roundScores[id] || 0); });
      return nt;
    });
    setCurrentLetter(null); setPhase("spin");
  };
  const endGame = () => setPhase("gameOver");
  const resetGame = () => {
    setPhase("setup"); setUsedLetters([]); setCurrentLetter(null); setHumanAnswers({}); setBotAnswers({});
    setTotals({ human: 0 }); setDisabledKeys([]); setBestTime(null); setElapsed(0);
  };

  const youLabel = t(lang, "you").replace(/[()]/g, "").trim() || "Vos";
  const fakePlayers = allIds.map((id) => ({ id, name: id === "human" ? youLabel : `Bot ${id.replace("bot", "")}` }));
  const sortedTotals = [...fakePlayers].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0));

  return (
    <div>
      <BackBar onBack={onExit} label={t(lang, "mainMenu")} />
      <Header subtitle={t(lang, "menuPracticeTitle")} />

      {phase === "setup" && (
        <div className="lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
          <div>
            <Card>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-xl" style={{ color: C.ink }}>{t(lang, "numberOfBots")}</h2>
                <span className="font-display text-xl" style={{ color: C.red }}>{numBots}</span>
              </div>
              <input type="range" min="1" max="3" step="1" value={numBots} onChange={(e) => setNumBots(Number(e.target.value))} className="w-full" />
            </Card>
            <Card>
              <h2 className="font-display text-xl mb-2" style={{ color: C.ink }}>{t(lang, "difficulty")}</h2>
              <div className="flex gap-2">
                {["easy", "medium", "hard"].map((d) => (
                  <button key={d} onClick={() => setDifficulty(d)}
                    className="flex-1 rounded-lg py-2 text-sm font-body font-medium border"
                    style={{ borderColor: C.ink, background: difficulty === d ? C.ink : "transparent", color: difficulty === d ? "#fff" : C.ink }}>
                    {t(lang, `difficulty${d[0].toUpperCase()}${d.slice(1)}`)}
                  </button>
                ))}
              </div>
            </Card>
          </div>
          <div>
            <Card>
              <h2 className="font-display text-xl mb-3" style={{ color: C.ink }}>{t(lang, "categories")}</h2>
              <CategoryEditor lang={lang} categories={categories} setCategories={setCategories} />
            </Card>
          </div>
          <div className="lg:col-span-2">
            <p className="text-xs font-body text-center mb-3" style={{ color: C.muted }}>{t(lang, "noTimeLimitHint")}</p>
            <PrimaryButton onClick={startGame} colorKey="chalk" disabled={categories.length < 1} icon={<Play size={20} />}>{t(lang, "startGame")}</PrimaryButton>
          </div>
        </div>
      )}

      {phase === "spin" && (
        <div>
          <Card>
            {!currentLetter ? (
              <LetterSpinner usedLetters={usedLetters} onLanded={onLetterLanded} lang={lang} />
            ) : (
              <div className="flex flex-col items-center py-4">
                <div className="flex items-center justify-center font-display" style={{ width: 120, height: 120, fontSize: 54, borderRadius: 999, border: `3px dashed ${C.ink}`, color: C.red }}>{currentLetter}</div>
                <button onClick={beginRound} className="mt-5 flex items-center gap-2 rounded-xl px-6 py-3 font-display text-lg" style={{ background: C.green, color: "#2f2a22" }}>
                  {t(lang, "beginRound")} <ChevronRight size={18} />
                </button>
              </div>
            )}
            {usedLetters.length > 0 && <p className="text-center text-xs font-body mt-1" style={{ color: C.muted }}>{t(lang, "usedLetters")} {usedLetters.join(", ")}</p>}
          </Card>
          <Card>
            <div className="flex items-center gap-2 mb-2"><Trophy size={16} color={C.chalk} /><h3 className="font-display text-xl" style={{ color: C.ink }}>{t(lang, "scores")}</h3></div>
            {fakePlayers.map((p) => (
              <div key={p.id} className="flex justify-between text-sm font-body py-1">
                <span>{p.name}</span><span className="font-display text-lg" style={{ color: C.red }}>{totals[p.id] || 0}</span>
              </div>
            ))}
            {bestTime !== null && (
              <p className="text-xs font-body mt-2" style={{ color: C.muted }}>{t(lang, "bestTime")}: {bestTime}s</p>
            )}
          </Card>
          <button onClick={endGame} className="w-full text-center text-sm font-body py-2" style={{ color: C.muted }}>{t(lang, "endGame")}</button>
        </div>
      )}

      {phase === "playerTurn" && !started && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-body" style={{ color: C.muted }}>{t(lang, "letter")}</span>
            <span className="font-display rounded-lg px-3 py-1 text-2xl" style={{ background: C.red, color: "#2f2a22" }}>{currentLetter}</span>
          </div>
          <PrimaryButton colorKey="green" icon={<Play size={18} />} onClick={() => { setStarted(true); setTimeout(() => inputRefs.current[0]?.focus(), 50); }}>
            {t(lang, "ready")}
          </PrimaryButton>
        </Card>
      )}

      {phase === "playerTurn" && started && (
        <div className="lg:flex lg:gap-5 lg:items-start">
          <div className="lg:w-64 lg:flex-shrink-0">
            <RoundStatusPanel lang={lang} letter={currentLetter} elapsedSecs={elapsed}
              canStop={canCallStop(humanAnswers, categories)} onStop={finishRound} hintKey="stopHint" />
          </div>
          <div className="lg:flex-1">
            <Card>
              <AnswerGrid categories={categories} answers={humanAnswers} onChange={handleAnswerChange} inputRefs={inputRefs} />
            </Card>
          </div>
        </div>
      )}

      {phase === "reveal" && currentLetter && (
        <>
          {lastIsRecord && (
            <Card>
              <div className="flex items-center gap-2" style={{ color: C.green }}>
                <Sparkles size={18} /> <p className="font-display text-lg">{t(lang, "newRecord")}</p>
              </div>
            </Card>
          )}
          {lastElapsed !== null && (
            <p className="text-xs font-body text-center mb-2" style={{ color: C.muted }}>{t(lang, "yourTime")}: {lastElapsed}s</p>
          )}
          <div className="lg:flex lg:gap-5 lg:items-start">
            <div className="lg:flex-1"><RevealList lang={lang} letter={currentLetter} categories={categories} players={fakePlayers}
              getAnswer={getAnswer} disabledKeys={disabledKeys} toggleInvalid={toggleInvalid} /></div>
            <div className="lg:w-64 lg:flex-shrink-0"><RoundPointsCard lang={lang} players={fakePlayers} roundScores={roundScores} /></div>
          </div>
          <PrimaryButton onClick={confirmRoundScores} icon={<ChevronRight size={18} />}>{t(lang, "confirmAndContinue")}</PrimaryButton>
        </>
      )}

      {phase === "gameOver" && <GameOverBlock lang={lang} sortedTotals={sortedTotals} totals={totals} onReset={resetGame} />}
    </div>
  );
}

// ============================================================
// ONLINE MODE
// ============================================================
function OnlineGame({ lang, onExit }) {
  const C = useColors();
  const [inRoom, setInRoom] = useState(false);
  const [myId] = useState(genId);
  const [myName, setMyName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [newRoomCategories, setNewRoomCategories] = useState(LOCALIZED_CATEGORIES[lang]);

  const [room, setRoom] = useState(null);
  const [myAnswers, setMyAnswers] = useState({});
  const [submittedRound, setSubmittedRound] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [hostSpinning, setHostSpinning] = useState(false);

  const unsubRef = useRef(null);
  const inputRefs = useRef([]);

  useEffect(() => {
    const tmr = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tmr);
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    unsubRef.current = subscribeRoom(roomCode, (row) => setRoom(row));
    return () => unsubRef.current && unsubRef.current();
  }, [roomCode]);

  useEffect(() => {
    if (room?.round_id && submittedRound !== room.round_id) setMyAnswers({});
  }, [room?.round_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (room?.phase === "reveal" && room?.round_id && submittedRound !== room.round_id) {
      submitAnswer(roomCode, room.round_id, myId, myAnswers).then(() => setSubmittedRound(room.round_id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.phase, room?.round_id]);

  const createNewRoom = async () => {
    if (!myName.trim() || newRoomCategories.length < 1) return;
    const code = genCode();
    try {
      const data = await createRoom(code, { hostId: myId, hostName: myName.trim(), categories: newRoomCategories });
      setRoom(data); setRoomCode(code); setIsHost(true); setInRoom(true);
    } catch (e) { setErrorMsg("No se pudo crear la sala. Revisá tu conexión a Supabase."); }
  };

  const joinExistingRoom = async () => {
    if (!myName.trim() || joinCode.trim().length < 4) return;
    const code = joinCode.trim().toUpperCase();
    try {
      const existing = await fetchRoom(code);
      if (!existing) { setErrorMsg(t(lang, "roomNotFound")); return; }
      setErrorMsg("");
      const data = await joinRoom(code, myId, myName.trim());
      setRoom(data); setRoomCode(code); setIsHost(false); setInRoom(true);
    } catch (e) { setErrorMsg(t(lang, "roomNotFound")); }
  };

  const hostLaunchRound = async (letter) => {
    setHostSpinning(false);
    await updateRoomState(roomCode, {
      phase: "active", letter, start_time: Date.now(),
      round_id: (room.round_id || 0) + 1, used_letters: [...(room.used_letters || []), letter], stopped_by: null,
    });
  };

  const mySubmit = async (answers) => {
    if (!room?.round_id) return;
    await submitAnswer(roomCode, room.round_id, myId, answers ?? myAnswers);
    setSubmittedRound(room.round_id);
  };

  const callStop = async () => {
    await mySubmit();
    await updateRoomState(roomCode, { phase: "reveal", stopped_by: myName });
  };

  const getRoundAnswer = (pid, cat) => room?.answers?.[`${room.round_id}:${pid}`]?.[cat] || "";
  const getOverrides = () => room?.overrides?.[String(room?.round_id)] || [];

  const computeRoundScores = () => {
    if (!room?.letter) return {};
    const pids = Object.keys(room.players || {});
    return scoreRound(room.categories, pids, getRoundAnswer, room.letter, getOverrides());
  };

  const onToggleOverride = async (pid, cat) => {
    const val = normalize(getRoundAnswer(pid, cat));
    if (!val || val[0] !== room.letter.toLowerCase()) return;
    await toggleOverride(roomCode, room.round_id, `${pid}-${cat}`);
  };

  const hostConfirmAndContinue = async () => {
    await addTotals(roomCode, computeRoundScores());
    setHostSpinning(true);
  };
  const hostEndGame = async () => {
    if (room?.phase === "reveal") await addTotals(roomCode, computeRoundScores());
    await updateRoomState(roomCode, { phase: "gameover" });
  };
  const leaveRoom = () => {
    unsubRef.current && unsubRef.current();
    setInRoom(false); setRoomCode(null); setRoom(null); setMyAnswers({}); setSubmittedRound(null); setIsHost(false);
  };

  const playerList = Object.entries(room?.players || {}).map(([id, v]) => ({ id, name: v.name }));
  const sortedTotals = [...playerList].sort((a, b) => (room?.totals?.[b.id] || 0) - (room?.totals?.[a.id] || 0));

  if (!inRoom) {
    return (
      <div>
        <BackBar onBack={onExit} label={t(lang, "mainMenu")} />
        <Header subtitle={t(lang, "menuOnlineTitle")} />
        <div className="lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
          <Card>
            <label className="text-xs font-body" style={{ color: C.muted }}>{t(lang, "yourName")}</label>
            <input value={myName} onChange={(e) => setMyName(e.target.value)} placeholder={t(lang, "namePlaceholder")}
              className="w-full rounded-lg px-3 py-2 mt-1 mb-4 outline-none font-body text-sm" style={{ background: C.inputBg, border: `1px solid ${C.rule}`, color: C.text }} />
            <h3 className="font-display text-lg mb-2" style={{ color: C.ink }}>{t(lang, "categories")}</h3>
            <div className="mb-4"><CategoryEditor lang={lang} categories={newRoomCategories} setCategories={setNewRoomCategories} /></div>
            <PrimaryButton onClick={createNewRoom} disabled={!myName.trim() || newRoomCategories.length < 1} icon={<Plus size={18} />}>{t(lang, "createRoom")}</PrimaryButton>
          </Card>
          <Card>
            <label className="text-xs font-body" style={{ color: C.muted }}>{t(lang, "roomCode")}</label>
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder={t(lang, "joinCodePlaceholder")} maxLength={4}
              className="w-full rounded-lg px-3 py-2 mt-1 mb-2 outline-none font-body text-sm tracking-widest text-center uppercase"
              style={{ background: C.inputBg, border: `1px solid ${C.rule}`, color: C.text }} />
            {errorMsg && <p className="text-xs font-body mb-2" style={{ color: C.red }}>{errorMsg}</p>}
            <PrimaryButton onClick={joinExistingRoom} disabled={!myName.trim() || joinCode.trim().length < 4} colorKey="green" icon={<Wifi size={18} />}>
              {t(lang, "joinRoom")}
            </PrimaryButton>
          </Card>
        </div>
      </div>
    );
  }

  if (!room) {
    return <div><BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} /><Card><p className="text-sm font-body text-center" style={{ color: C.muted }}>{t(lang, "loadingRoom")}</p></Card></div>;
  }

  if (room.phase === "lobby") {
    return (
      <div>
        <BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} />
        <Header subtitle={t(lang, "lobbyTitle")} />
        <div className="lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
          <Card>
            <p className="text-xs font-body mb-1 text-center" style={{ color: C.muted }}>{t(lang, "roomCode")}</p>
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="font-display text-5xl tracking-widest" style={{ color: C.red }}>{roomCode}</span>
              <button onClick={() => { try { navigator.clipboard.writeText(roomCode); } catch {} }} className="p-2 rounded-lg" style={{ background: C.inputBg, border: `1px solid ${C.rule}` }}>
                <Copy size={14} color={C.muted} />
              </button>
            </div>
            <p className="text-center text-xs font-body" style={{ color: C.muted }}>{t(lang, "shareCode")}</p>
          </Card>
          <Card>
            <div className="flex items-center gap-2 mb-2"><Users size={16} color={C.ink} /><h3 className="font-display text-xl" style={{ color: C.ink }}>{t(lang, "players")} ({playerList.length})</h3></div>
            <div className="max-h-64 overflow-y-auto pr-1">
              {playerList.map((p) => <p key={p.id} className="text-sm font-body py-1">{p.name}{p.id === myId ? ` ${t(lang, "you")}` : ""}</p>)}
            </div>
          </Card>
        </div>
        {isHost ? (
          !hostSpinning ? (
            <PrimaryButton onClick={() => setHostSpinning(true)} icon={<Play size={20} />}>{t(lang, "spinFirstLetter")}</PrimaryButton>
          ) : (
            <Card><LetterSpinner usedLetters={room?.used_letters || []} onLanded={hostLaunchRound} lang={lang} /></Card>
          )
        ) : (
          <Card><p className="text-sm font-body text-center" style={{ color: C.muted }}>{t(lang, "waitingHost")}</p></Card>
        )}
      </div>
    );
  }

  if (room.phase === "gameover") {
    return (
      <div>
        <BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} />
        <Card>
          <div className="flex flex-col items-center py-4"><Trophy size={40} color={C.chalk} /><h2 className="font-display text-3xl mt-2" style={{ color: C.red }}>{t(lang, "gameOverTitle")}</h2></div>
          {sortedTotals.map((p, i) => (
            <div key={p.id} className="flex justify-between items-center rounded-lg px-3 py-2 mb-1 font-body text-sm" style={{ background: i === 0 ? C.bg : "transparent" }}>
              <span style={{ color: i === 0 ? C.red : C.text }}>{i === 0 ? "🏆 " : `${i + 1}. `}{p.name}</span>
              <span className="font-display text-lg">{room.totals?.[p.id] || 0}</span>
            </div>
          ))}
        </Card>
        <PrimaryButton onClick={leaveRoom} colorKey="green" icon={<RotateCcw size={18} />}>{t(lang, "backToMenu")}</PrimaryButton>
      </div>
    );
  }

  if (room.phase === "active") {
    if (!room.letter) {
      return <div><BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} /><Card><p className="text-sm font-body text-center" style={{ color: C.muted }}>{t(lang, "waitingFirstLetter")}</p></Card></div>;
    }
    const elapsedSecs = room.start_time ? Math.max(0, Math.floor((now - room.start_time) / 1000)) : 0;
    return (
      <div>
        <BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} />
        <div className="lg:flex lg:gap-5 lg:items-start">
          <div className="lg:w-64 lg:flex-shrink-0">
            <RoundStatusPanel lang={lang} letter={room.letter} elapsedSecs={elapsedSecs}
              canStop={canCallStop(myAnswers, room.categories)} onStop={callStop} hintKey="stopHintAll" />
          </div>
          <div className="lg:flex-1">
            <Card>
              <AnswerGrid categories={room.categories} answers={myAnswers} onChange={(cat, val) => setMyAnswers((a) => ({ ...a, [cat]: val }))} inputRefs={inputRefs} />
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const roundScores = computeRoundScores();
  const stoppedByLabel = room.stopped_by ? `${room.stopped_by} ${t(lang, "stoppedRoundBy")}` : null;
  return (
    <div>
      <BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} />
      <div className="lg:flex lg:gap-5 lg:items-start">
        <div className="lg:flex-1"><RevealList lang={lang} letter={room.letter} categories={room.categories} players={playerList}
          getAnswer={getRoundAnswer} disabledKeys={getOverrides()} toggleInvalid={onToggleOverride} stoppedByLabel={stoppedByLabel} /></div>
        <div className="lg:w-64 lg:flex-shrink-0"><RoundPointsCard lang={lang} players={playerList} roundScores={roundScores} /></div>
      </div>
      {isHost ? (
        !hostSpinning ? (
          <>
            <PrimaryButton onClick={hostConfirmAndContinue} icon={<ChevronRight size={18} />}>{t(lang, "confirmAndSpinNext")}</PrimaryButton>
            <button onClick={hostEndGame} className="w-full text-center text-sm font-body py-2 mt-1" style={{ color: C.muted }}>{t(lang, "endGame")}</button>
          </>
        ) : (
          <Card><LetterSpinner usedLetters={room.used_letters || []} onLanded={hostLaunchRound} lang={lang} /></Card>
        )
      ) : (
        <Card><p className="text-sm font-body text-center" style={{ color: C.muted }}>{t(lang, "waitingOthers")}</p></Card>
      )}
    </div>
  );
}
