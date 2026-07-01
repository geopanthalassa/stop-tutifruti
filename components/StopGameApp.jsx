"use client";
import React, { useState, useRef, useEffect, useContext, createContext } from "react";
import {
  Plus, X, Play, RotateCcw, Check, Trophy, Clock, ChevronRight,
  Users, Wifi, Copy, ArrowLeft, Bot, Sun, Moon,
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

// pastel "chalk" colors — cycled per category so each one reads like it was
// underlined by hand with a different piece of colored chalk
const PASTELS = ["#e07a8b", "#4f9dde", "#5cb37c", "#e0a83e", "#9b7fd4", "#e0715c", "#3fb6b0", "#c98fc9"];
function catColor(i) { return PASTELS[i % PASTELS.length]; }

// ---------- themes ----------
const LIGHT = {
  name: "light",
  bg: "#f3ecd2", card: "#faf6e6", grid: "#c3d4e0",
  text: "#221f18", ink: "#2b4c7e", red: "#b5352f", muted: "#8c8267",
  chalk: "#b8860b", green: "#3f7d5c", inputBg: "#ffffff",
};
const DARK = {
  name: "dark",
  bg: "#16241c", card: "#1f3327", grid: "#33513f",
  text: "#eef5ee", ink: "#bfe3ff", red: "#ff8f82", muted: "#9fbfab",
  chalk: "#ffd166", green: "#8fe0b8", inputBg: "#243b2d",
};

const ThemeContext = createContext({ colors: LIGHT, theme: "light", toggle: () => {} });
function useColors() { return useContext(ThemeContext).colors; }

const FONT_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
.font-display { font-family: 'Kalam', cursive; }
.font-body { font-family: 'Inter', sans-serif; }
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
      <button onClick={toggle} className="p-2 rounded-full" style={{ color: C.text, border: `1px solid ${C.grid}` }}>
        {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
      </button>
    </div>
  );
}
function Card({ children }) {
  const C = useColors();
  return (
    <div className="relative mb-4" style={{
      background: C.card, borderRadius: 3, padding: "20px 18px 20px 30px",
      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent 23px, ${C.grid} 24px)`,
      boxShadow: "0 1px 0 rgba(0,0,0,0.08), 0 3px 10px rgba(0,0,0,0.15)",
    }}>
      <div className="absolute left-5 top-0 bottom-0" style={{ width: 2, background: C.red, opacity: 0.55 }} />
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
      className="w-full flex items-center justify-center gap-2 rounded-md py-3 font-display text-xl disabled:opacity-40"
      style={{ background: C[colorKey], color: C.name === "light" ? C.card : "#0e160f", boxShadow: "0 2px 0 rgba(0,0,0,0.2)" }}>
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
          className="mt-5 flex items-center gap-2 rounded-md px-6 py-3 font-display text-lg disabled:opacity-50"
          style={{ background: C.chalk, color: C.name === "light" ? C.card : "#0e160f" }}>
          <RotateCcw size={18} className={spinning ? "animate-spin" : ""} />
          {spinning ? t(lang, "spinning") : t(lang, "spinLetter")}
        </button>
      ) : (
        <button onClick={() => onLanded(landed)} className="mt-5 flex items-center gap-2 rounded-md px-6 py-3 font-display text-lg"
          style={{ background: C.green, color: C.name === "light" ? C.card : "#0e160f" }}>
          {t(lang, "confirm")} <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}
// shared category editor — used when creating an online room and in practice setup
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
      <div className="flex flex-wrap gap-2 mb-3">
        {categories.map((c, i) => (
          <span key={c} className="flex items-center gap-1 text-sm font-body font-medium pb-0.5"
            style={{ color: C.text, borderBottom: `3px solid ${catColor(i)}` }}>
            {c}
            <button onClick={() => remove(c)}><X size={12} color={C.muted} /></button>
          </span>
        ))}
      </div>

      {categories.length < MAX_CATEGORIES ? (
        <>
          <div className="flex gap-2 mb-2">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder={t(lang, "newCategoryPlaceholder")} className="flex-1 rounded px-3 py-2 outline-none font-body text-sm"
              style={{ background: C.inputBg, border: `1px solid ${C.grid}`, color: C.text }} />
            <button onClick={() => add()} className="px-3 rounded font-body text-sm font-medium" style={{ background: C.red, color: C.name === "light" ? C.card : "#0e160f" }}>
              <Plus size={16} />
            </button>
          </div>
          <button onClick={() => setShowSuggestions((s) => !s)} className="text-xs font-body font-medium mb-2" style={{ color: C.ink }}>
            {t(lang, "suggestions")}
          </button>
          {showSuggestions && (
            <div className="flex flex-wrap gap-2 mb-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => add(s)}
                  className="text-xs font-body px-2 py-1 rounded-full"
                  style={{ background: C.inputBg, border: `1px solid ${C.grid}`, color: C.text }}>
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

// ============================================================
// APP ROOT
// ============================================================
export default function StopGameApp() {
  const [mode, setMode] = useState("menu");
  const [lang, setLang] = useState("es");
  const [theme, setTheme] = useState("light");
  const colors = theme === "light" ? LIGHT : DARK;
  const toggle = () => setTheme((th) => (th === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ colors, theme, toggle }}>
      <div className="font-body min-h-screen w-full" style={{
        background: colors.bg, color: colors.text,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent 27px, ${colors.grid} 28px)`,
      }}>
        <style>{FONT_STYLE}</style>
        <div className="max-w-md mx-auto px-5 py-8">
          {mode === "menu" && <MenuScreen setMode={setMode} lang={lang} setLang={setLang} />}
          {mode === "online" && <OnlineGame lang={lang} onExit={() => setMode("menu")} />}
          {mode === "practice" && <PracticeGame lang={lang} onExit={() => setMode("menu")} />}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

function MenuScreen({ setMode, lang, setLang }) {
  const C = useColors();
  return (
    <div>
      <Header subtitle={t(lang, "appSubtitle")} />
      <div className="flex gap-2 mb-4 justify-center flex-wrap">
        {LANGUAGES.map((l) => (
          <button key={l.code} onClick={() => setLang(l.code)}
            className="px-3 py-1 rounded-full text-xs font-body font-medium border"
            style={{ borderColor: C.ink, background: lang === l.code ? C.ink : "transparent", color: lang === l.code ? C.card : C.ink }}>
            {l.label}
          </button>
        ))}
      </div>
      <Card>
        <div className="flex items-center gap-2 mb-2"><Wifi size={18} color={C.red} /><h2 className="font-display text-2xl">{t(lang, "menuOnlineTitle")}</h2></div>
        <p className="text-sm font-body mb-3" style={{ color: C.muted }}>{t(lang, "menuOnlineDesc")}</p>
        <PrimaryButton onClick={() => setMode("online")} colorKey="red" icon={<Wifi size={18} />}>{t(lang, "menuOnlineBtn")}</PrimaryButton>
      </Card>
      <Card>
        <div className="flex items-center gap-2 mb-2"><Bot size={18} color={C.chalk} /><h2 className="font-display text-2xl">{t(lang, "menuPracticeTitle")}</h2></div>
        <p className="text-sm font-body mb-3" style={{ color: C.muted }}>{t(lang, "menuPracticeDesc")}</p>
        <PrimaryButton onClick={() => setMode("practice")} colorKey="chalk" icon={<Bot size={18} />}>{t(lang, "menuPracticeBtn")}</PrimaryButton>
      </Card>
    </div>
  );
}

function PlayerTurnBlock({ lang, categories, answers, onChange, timeLeft, timeLimit, onFinish, inputRefs }) {
  const C = useColors();
  const pct = Math.max(0, (timeLeft / timeLimit) * 100);
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 text-sm font-body" style={{ color: C.muted }}><Clock size={14} /> {timeLeft}s</div>
        <button onClick={onFinish} disabled={!canCallStop(answers, categories)}
          className="text-sm font-display rounded-md px-3 py-1 disabled:opacity-30"
          style={{ background: C.red, color: C.name === "light" ? C.card : "#0e160f" }}>{t(lang, "stopBtn")}</button>
      </div>
      {!canCallStop(answers, categories) && <p className="text-xs font-body mb-2" style={{ color: C.muted }}>{t(lang, "stopHint")}</p>}
      <div className="w-full h-2 rounded-full mb-4 overflow-hidden" style={{ background: C.grid }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: timeLeft <= 10 ? C.red : C.green, transition: "width 1s linear" }} />
      </div>
      <div className="space-y-2">
        {categories.map((cat, i) => (
          <div key={cat}>
            <label className="text-xs font-body font-semibold pb-0.5" style={{ color: C.text, borderBottom: `2px solid ${catColor(i)}` }}>{cat}</label>
            <input ref={(el) => (inputRefs.current[i] = el)} value={answers[cat] || ""} onChange={(e) => onChange(cat, e.target.value)}
              className="w-full rounded px-3 py-2 mt-1 outline-none font-body text-sm"
              style={{ background: C.inputBg, border: `1px solid ${C.grid}`, color: C.text }} />
          </div>
        ))}
      </div>
    </>
  );
}

function RevealList({ lang, letter, categories, players, getAnswer, disabledKeys, toggleInvalid, stoppedByLabel }) {
  const C = useColors();
  return (
    <Card>
      <h2 className="font-display text-2xl mb-1" style={{ color: C.red }}>{t(lang, "resultsTitle")} {letter}</h2>
      {stoppedByLabel && <p className="text-xs font-body mb-1" style={{ color: C.red }}>{stoppedByLabel}</p>}
      <p className="text-xs font-body mb-4" style={{ color: C.muted }}>{t(lang, "tapToInvalidate")}</p>
      {categories.map((cat, i) => (
        <div key={cat} className="mb-4">
          <p className="font-display text-lg inline-block pb-0.5 mb-1" style={{ color: C.text, borderBottom: `3px solid ${catColor(i)}` }}>{cat}</p>
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
    </Card>
  );
}

function RoundPointsCard({ lang, players, roundScores }) {
  const C = useColors();
  return (
    <Card>
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
          <div key={p.id} className="flex justify-between items-center rounded px-3 py-2 mb-1 font-body text-sm" style={{ background: i === 0 ? C.inputBg : "transparent" }}>
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
// PRACTICE MODE — vs local bots, no network needed
// ============================================================
function PracticeGame({ lang, onExit }) {
  const C = useColors();
  const [phase, setPhase] = useState("setup");
  const [numBots, setNumBots] = useState(2);
  const [difficulty, setDifficulty] = useState("medium");
  const [categories, setCategories] = useState(LOCALIZED_CATEGORIES[lang]);
  const [timeLimit, setTimeLimit] = useState(60);
  const [usedLetters, setUsedLetters] = useState([]);
  const [currentLetter, setCurrentLetter] = useState(null);
  const [humanAnswers, setHumanAnswers] = useState({});
  const [botAnswers, setBotAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [started, setStarted] = useState(false);
  const [totals, setTotals] = useState({ human: 0 });
  const [disabledKeys, setDisabledKeys] = useState([]);
  const timerRef = useRef(null);
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
    setHumanAnswers({}); setBotAnswers({}); setTimeLeft(timeLimit); setStarted(false); setPhase("playerTurn");
  };

  useEffect(() => {
    if (phase !== "playerTurn" || !started) return;
    if (timeLeft <= 0) { finishRound(); return; }
    timerRef.current = setTimeout(() => setTimeLeft((tm) => tm - 1), 1000);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft, started]);

  const finishRound = () => {
    clearTimeout(timerRef.current);
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
    setTotals({ human: 0 }); setDisabledKeys([]);
  };

  const youLabel = t(lang, "you").replace(/[()]/g, "").trim() || "Vos";
  const fakePlayers = allIds.map((id) => ({ id, name: id === "human" ? youLabel : `Bot ${id.replace("bot", "")}` }));
  const sortedTotals = [...fakePlayers].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0));

  return (
    <div>
      <BackBar onBack={onExit} label={t(lang, "mainMenu")} />
      <Header subtitle={t(lang, "menuPracticeTitle")} />

      {phase === "setup" && (
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
                  className="flex-1 rounded py-2 text-sm font-body font-medium border"
                  style={{ borderColor: C.ink, background: difficulty === d ? C.ink : "transparent", color: difficulty === d ? C.card : C.ink }}>
                  {t(lang, `difficulty${d[0].toUpperCase()}${d.slice(1)}`)}
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="font-display text-xl mb-3" style={{ color: C.ink }}>{t(lang, "categories")}</h2>
            <CategoryEditor lang={lang} categories={categories} setCategories={setCategories} />
          </Card>
          <Card>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-xl" style={{ color: C.ink }}>{t(lang, "timePerTurn")}</h2>
              <span className="font-display text-xl" style={{ color: C.red }}>{timeLimit}s</span>
            </div>
            <input type="range" min="20" max="120" step="10" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} className="w-full" />
          </Card>
          <PrimaryButton onClick={startGame} colorKey="chalk" disabled={categories.length < 1} icon={<Play size={20} />}>{t(lang, "startGame")}</PrimaryButton>
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
                <button onClick={beginRound} className="mt-5 flex items-center gap-2 rounded-md px-6 py-3 font-display text-lg" style={{ background: C.green, color: C.name === "light" ? C.card : "#0e160f" }}>
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
          </Card>
          <button onClick={endGame} className="w-full text-center text-sm font-body py-2" style={{ color: C.muted }}>{t(lang, "endGame")}</button>
        </div>
      )}

      {phase === "playerTurn" && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-body" style={{ color: C.muted }}>{t(lang, "letter")}</span>
            <span className="font-display rounded px-3 py-1 text-2xl" style={{ background: C.red, color: C.name === "light" ? C.card : "#0e160f" }}>{currentLetter}</span>
          </div>
          {!started ? (
            <PrimaryButton colorKey="green" icon={<Play size={18} />} onClick={() => { setStarted(true); setTimeLeft(timeLimit); setTimeout(() => inputRefs.current[0]?.focus(), 50); }}>
              {t(lang, "ready")}
            </PrimaryButton>
          ) : (
            <PlayerTurnBlock lang={lang} categories={categories} answers={humanAnswers} onChange={handleAnswerChange}
              timeLeft={timeLeft} timeLimit={timeLimit} onFinish={finishRound} inputRefs={inputRefs} />
          )}
        </Card>
      )}

      {phase === "reveal" && currentLetter && (
        <>
          <RevealList lang={lang} letter={currentLetter} categories={categories} players={fakePlayers}
            getAnswer={getAnswer} disabledKeys={disabledKeys} toggleInvalid={toggleInvalid} />
          <RoundPointsCard lang={lang} players={fakePlayers} roundScores={roundScores} />
          <PrimaryButton onClick={confirmRoundScores} icon={<ChevronRight size={18} />}>{t(lang, "confirmAndContinue")}</PrimaryButton>
        </>
      )}

      {phase === "gameOver" && <GameOverBlock lang={lang} sortedTotals={sortedTotals} totals={totals} onReset={resetGame} />}
    </div>
  );
}

// ============================================================
// ONLINE MODE — Supabase table + Realtime push (no polling)
// ============================================================
function OnlineGame({ lang, onExit }) {
  const C = useColors();
  const [screen, setScreen] = useState("entry");
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
    if (!room?.letter || !room?.round_id || !room?.start_time || !room?.duration) return;
    const overNow = now >= room.start_time + room.duration * 1000;
    if (overNow && submittedRound !== room.round_id) {
      submitAnswer(roomCode, room.round_id, myId, myAnswers).then(() => setSubmittedRound(room.round_id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, room?.round_id, room?.duration, submittedRound]);

  const createNewRoom = async () => {
    if (!myName.trim() || newRoomCategories.length < 1) return;
    const code = genCode();
    try {
      const data = await createRoom(code, { hostId: myId, hostName: myName.trim(), categories: newRoomCategories });
      setRoom(data); setRoomCode(code); setIsHost(true); setScreen("lobby");
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
      setRoom(data); setRoomCode(code); setIsHost(false); setScreen("lobby");
    } catch (e) { setErrorMsg(t(lang, "roomNotFound")); }
  };

  const hostUpdateTimeLimit = async (val) => {
    setRoom((r) => ({ ...r, time_limit: val }));
    await updateRoomState(roomCode, { time_limit: val });
  };

  const hostLaunchRound = async (letter) => {
    setHostSpinning(false);
    await updateRoomState(roomCode, {
      phase: "active", letter, start_time: Date.now() + 3000, duration: room.time_limit,
      round_id: (room.round_id || 0) + 1, used_letters: [...(room.used_letters || []), letter], stopped_by: null,
    });
  };

  const mySubmit = async (answers) => {
    if (!room?.round_id) return;
    await submitAnswer(roomCode, room.round_id, myId, answers ?? myAnswers);
    setSubmittedRound(room.round_id);
  };

  const forceStopForAll = async () => {
    await mySubmit();
    const elapsed = Math.max(1, Math.ceil((Date.now() - room.start_time) / 1000));
    if (elapsed >= room.duration) return;
    await updateRoomState(roomCode, { duration: elapsed, stopped_by: myName });
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
    const reveal = room?.letter && now >= room.start_time + room.duration * 1000;
    if (reveal) await addTotals(roomCode, computeRoundScores());
    await updateRoomState(roomCode, { phase: "gameover" });
  };
  const leaveRoom = () => {
    unsubRef.current && unsubRef.current();
    setScreen("entry"); setRoomCode(null); setRoom(null); setMyAnswers({}); setSubmittedRound(null); setIsHost(false);
  };

  const playerList = Object.entries(room?.players || {}).map(([id, v]) => ({ id, name: v.name }));
  const sortedTotals = [...playerList].sort((a, b) => (room?.totals?.[b.id] || 0) - (room?.totals?.[a.id] || 0));

  if (screen === "entry") {
    return (
      <div>
        <BackBar onBack={onExit} label={t(lang, "mainMenu")} />
        <Header subtitle={t(lang, "menuOnlineTitle")} />
        <Card>
          <label className="text-xs font-body" style={{ color: C.muted }}>{t(lang, "yourName")}</label>
          <input value={myName} onChange={(e) => setMyName(e.target.value)} placeholder={t(lang, "namePlaceholder")}
            className="w-full rounded px-3 py-2 mt-1 mb-4 outline-none font-body text-sm" style={{ background: C.inputBg, border: `1px solid ${C.grid}`, color: C.text }} />
          <h3 className="font-display text-lg mb-2" style={{ color: C.ink }}>{t(lang, "categories")}</h3>
          <div className="mb-4"><CategoryEditor lang={lang} categories={newRoomCategories} setCategories={setNewRoomCategories} /></div>
          <PrimaryButton onClick={createNewRoom} disabled={!myName.trim() || newRoomCategories.length < 1} icon={<Plus size={18} />}>{t(lang, "createRoom")}</PrimaryButton>
        </Card>
        <Card>
          <label className="text-xs font-body" style={{ color: C.muted }}>{t(lang, "roomCode")}</label>
          <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder={t(lang, "joinCodePlaceholder")} maxLength={4}
            className="w-full rounded px-3 py-2 mt-1 mb-2 outline-none font-body text-sm tracking-widest text-center uppercase"
            style={{ background: C.inputBg, border: `1px solid ${C.grid}`, color: C.text }} />
          {errorMsg && <p className="text-xs font-body mb-2" style={{ color: C.red }}>{errorMsg}</p>}
          <PrimaryButton onClick={joinExistingRoom} disabled={!myName.trim() || joinCode.trim().length < 4} colorKey="green" icon={<Wifi size={18} />}>
            {t(lang, "joinRoom")}
          </PrimaryButton>
        </Card>
      </div>
    );
  }

  if (screen === "lobby") {
    return (
      <div>
        <BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} />
        <Header subtitle={t(lang, "lobbyTitle")} />
        <Card>
          <p className="text-xs font-body mb-1 text-center" style={{ color: C.muted }}>{t(lang, "roomCode")}</p>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="font-display text-5xl tracking-widest" style={{ color: C.red }}>{roomCode}</span>
            <button onClick={() => { try { navigator.clipboard.writeText(roomCode); } catch {} }} className="p-2 rounded" style={{ background: C.inputBg, border: `1px solid ${C.grid}` }}>
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
        {isHost ? (
          <>
            <Card>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-xl" style={{ color: C.ink }}>{t(lang, "timePerRound")}</h3>
                <span className="font-display text-xl" style={{ color: C.red }}>{room?.time_limit}s</span>
              </div>
              <input type="range" min="20" max="120" step="10" value={room?.time_limit || 60} onChange={(e) => hostUpdateTimeLimit(Number(e.target.value))} className="w-full" />
            </Card>
            {!hostSpinning ? (
              <PrimaryButton onClick={() => setHostSpinning(true)} icon={<Play size={20} />}>{t(lang, "spinFirstLetter")}</PrimaryButton>
            ) : (
              <Card><LetterSpinner usedLetters={room?.used_letters || []} onLanded={hostLaunchRound} lang={lang} /></Card>
            )}
          </>
        ) : (
          <Card><p className="text-sm font-body text-center" style={{ color: C.muted }}>{t(lang, "waitingHost")}</p></Card>
        )}
      </div>
    );
  }

  if (!room) return <div><BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} /><Card><p className="text-sm font-body text-center" style={{ color: C.muted }}>{t(lang, "loadingRoom")}</p></Card></div>;

  if (room.phase === "gameover") {
    return (
      <div>
        <BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} />
        <Card>
          <div className="flex flex-col items-center py-4"><Trophy size={40} color={C.chalk} /><h2 className="font-display text-3xl mt-2" style={{ color: C.red }}>{t(lang, "gameOverTitle")}</h2></div>
          {sortedTotals.map((p, i) => (
            <div key={p.id} className="flex justify-between items-center rounded px-3 py-2 mb-1 font-body text-sm" style={{ background: i === 0 ? C.inputBg : "transparent" }}>
              <span style={{ color: i === 0 ? C.red : C.text }}>{i === 0 ? "🏆 " : `${i + 1}. `}{p.name}</span>
              <span className="font-display text-lg">{room.totals?.[p.id] || 0}</span>
            </div>
          ))}
        </Card>
        <PrimaryButton onClick={leaveRoom} colorKey="green" icon={<RotateCcw size={18} />}>{t(lang, "backToMenu")}</PrimaryButton>
      </div>
    );
  }

  if (!room.letter) {
    return <div><BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} /><Card><p className="text-sm font-body text-center" style={{ color: C.muted }}>{t(lang, "waitingFirstLetter")}</p></Card></div>;
  }

  const getReady = now < room.start_time;
  const playing = !getReady && now < room.start_time + room.duration * 1000;
  const secsToStart = Math.max(0, Math.ceil((room.start_time - now) / 1000));
  const secsLeft = Math.max(0, Math.ceil((room.start_time + room.duration * 1000 - now) / 1000));
  const pct = Math.max(0, (secsLeft / room.duration) * 100);

  if (getReady) {
    return (
      <div>
        <BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} />
        <Card>
          <div className="flex flex-col items-center py-6">
            <p className="text-sm font-body mb-2" style={{ color: C.muted }}>{t(lang, "getReady")}</p>
            <div className="flex items-center justify-center font-display" style={{ width: 100, height: 100, fontSize: 44, borderRadius: 999, border: `3px dashed ${C.ink}`, color: C.red }}>{secsToStart}</div>
            <p className="font-display text-3xl mt-4" style={{ color: C.ink }}>{t(lang, "letter")} {room.letter}</p>
          </div>
        </Card>
      </div>
    );
  }

  if (playing) {
    const alreadySubmitted = submittedRound === room.round_id;
    return (
      <div>
        <BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} />
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-body" style={{ color: C.muted }}>{t(lang, "letter")}</span>
            <span className="font-display rounded px-3 py-1 text-2xl" style={{ background: C.red, color: C.name === "light" ? C.card : "#0e160f" }}>{room.letter}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1 text-sm font-body" style={{ color: C.muted }}><Clock size={14} /> {secsLeft}s</div>
            <button onClick={forceStopForAll} disabled={alreadySubmitted || !canCallStop(myAnswers, room.categories)}
              className="text-sm font-display rounded-md px-3 py-1 disabled:opacity-30"
              style={{ background: C.red, color: C.name === "light" ? C.card : "#0e160f" }}>{t(lang, "stopBtn")}</button>
          </div>
          <div className="w-full h-2 rounded-full mb-2 overflow-hidden" style={{ background: C.grid }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: secsLeft <= 10 ? C.red : C.green, transition: "width 1s linear" }} />
          </div>
          {!alreadySubmitted && !canCallStop(myAnswers, room.categories) && (
            <p className="text-xs font-body mb-2" style={{ color: C.muted }}>{t(lang, "stopHintAll")}</p>
          )}
          {alreadySubmitted ? (
            <p className="text-sm font-body text-center mt-2" style={{ color: C.green }}>{t(lang, "alreadySubmitted")}</p>
          ) : (
            <>
              <div className="space-y-2 mb-4 mt-2">
                {room.categories.map((cat, i) => (
                  <div key={cat}>
                    <label className="text-xs font-body font-semibold pb-0.5" style={{ color: C.text, borderBottom: `2px solid ${catColor(i)}` }}>{cat}</label>
                    <input ref={(el) => (inputRefs.current[i] = el)} value={myAnswers[cat] || ""}
                      onChange={(e) => setMyAnswers((a) => ({ ...a, [cat]: e.target.value }))}
                      className="w-full rounded px-3 py-2 mt-1 outline-none font-body text-sm" style={{ background: C.inputBg, border: `1px solid ${C.grid}`, color: C.text }} />
                  </div>
                ))}
              </div>
              <PrimaryButton onClick={() => mySubmit()} colorKey="green" icon={<Check size={18} />}>{t(lang, "sendAnswers")}</PrimaryButton>
            </>
          )}
        </Card>
      </div>
    );
  }

  const roundScores = computeRoundScores();
  const stoppedByLabel = room.stopped_by ? `${room.stopped_by} ${t(lang, "stoppedRoundBy")}` : null;
  return (
    <div>
      <BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} />
      <RevealList lang={lang} letter={room.letter} categories={room.categories} players={playerList}
        getAnswer={getRoundAnswer} disabledKeys={getOverrides()} toggleInvalid={onToggleOverride} stoppedByLabel={stoppedByLabel} />
      <RoundPointsCard lang={lang} players={playerList} roundScores={roundScores} />
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
