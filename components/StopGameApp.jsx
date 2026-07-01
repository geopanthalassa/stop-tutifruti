"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  Plus, X, Play, RotateCcw, Check, Trophy, Clock, ChevronRight,
  Users, Wifi, Home, Copy, ArrowLeft, Bot,
} from "lucide-react";
import {
  createRoom, fetchRoom, joinRoom, updateRoomState,
  submitAnswer, toggleOverride, addTotals, subscribeRoom,
} from "../lib/gameRoom";
import { t, LANGUAGES, DEFAULT_CATEGORIES as LOCALIZED_CATEGORIES, CATEGORY_IDS } from "../lib/i18n";
import { botAnswerFor } from "../lib/botWordbank";

const ALL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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
// empty categories score 0; a category answered by exactly one player scores 20;
// categories answered by 2+ players score 10 (unique) or 5 (repeated) among valid entries
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
  return (
    <div className="flex flex-col items-center mb-6">
      <h1 className="font-display text-4xl tracking-tight" style={{ color: "#ffbe3d" }}>¡STOP!</h1>
      {subtitle && <p className="text-xs font-body mt-1" style={{ color: "#9497b8" }}>{subtitle}</p>}
    </div>
  );
}
function Card({ children }) {
  return <div className="rounded-2xl p-5 mb-4" style={{ background: "#1e2140", border: "1px solid #2c2f52" }}>{children}</div>;
}
function BackBar({ onBack, label }) {
  return (
    <button onClick={onBack} className="flex items-center gap-1 text-sm font-body mb-4" style={{ color: "#9497b8" }}>
      <ArrowLeft size={14} /> {label}
    </button>
  );
}
function PrimaryButton({ children, onClick, disabled, color = "#ff6452", icon }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-display text-lg disabled:opacity-40"
      style={{ background: color, color: "#14162b" }}>
      {icon} {children}
    </button>
  );
}
function LetterSpinner({ usedLetters, onLanded, lang }) {
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
      <div className="font-display flex items-center justify-center rounded-full"
        style={{ width: 120, height: 120, fontSize: 54, background: landed ? "#ff6452" : "#2c2f52", color: landed ? "#14162b" : "#ffbe3d" }}>
        {landed || display}
      </div>
      {!landed ? (
        <button onClick={spin} disabled={spinning}
          className="mt-5 flex items-center gap-2 rounded-xl px-6 py-3 font-display text-base disabled:opacity-50"
          style={{ background: "#ffbe3d", color: "#14162b" }}>
          <RotateCcw size={18} className={spinning ? "animate-spin" : ""} />
          {spinning ? t(lang, "spinning") : t(lang, "spinLetter")}
        </button>
      ) : (
        <button onClick={() => onLanded(landed)} className="mt-5 flex items-center gap-2 rounded-xl px-6 py-3 font-display text-base"
          style={{ background: "#37c9a1", color: "#14162b" }}>
          {t(lang, "confirm")} <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

// ============================================================
// APP ROOT
// ============================================================
export default function StopGameApp() {
  const [mode, setMode] = useState("menu");
  const [lang, setLang] = useState("es");
  return (
    <div className="font-body min-h-screen w-full" style={{ background: "#14162b", color: "#f2f1f7" }}>
      <div className="max-w-md mx-auto px-5 py-8">
        {mode === "menu" && <MenuScreen setMode={setMode} lang={lang} setLang={setLang} />}
        {mode === "local" && <LocalGame lang={lang} onExit={() => setMode("menu")} />}
        {mode === "online" && <OnlineGame lang={lang} onExit={() => setMode("menu")} />}
        {mode === "practice" && <PracticeGame lang={lang} onExit={() => setMode("menu")} />}
      </div>
    </div>
  );
}

function MenuScreen({ setMode, lang, setLang }) {
  return (
    <div>
      <Header subtitle={t(lang, "appSubtitle")} />
      <div className="flex gap-2 mb-4 justify-center">
        {LANGUAGES.map((l) => (
          <button key={l.code} onClick={() => setLang(l.code)}
            className="px-3 py-1 rounded-full text-xs font-body font-medium"
            style={{ background: lang === l.code ? "#ff6452" : "#2c2f52", color: lang === l.code ? "#14162b" : "#9497b8" }}>
            {l.label}
          </button>
        ))}
      </div>
      <Card>
        <div className="flex items-center gap-2 mb-2"><Home size={18} color="#37c9a1" /><h2 className="font-display text-lg">{t(lang, "menuLocalTitle")}</h2></div>
        <p className="text-sm font-body mb-3" style={{ color: "#9497b8" }}>{t(lang, "menuLocalDesc")}</p>
        <PrimaryButton onClick={() => setMode("local")} color="#37c9a1" icon={<Play size={18} />}>{t(lang, "menuLocalBtn")}</PrimaryButton>
      </Card>
      <Card>
        <div className="flex items-center gap-2 mb-2"><Wifi size={18} color="#ff6452" /><h2 className="font-display text-lg">{t(lang, "menuOnlineTitle")}</h2></div>
        <p className="text-sm font-body mb-3" style={{ color: "#9497b8" }}>{t(lang, "menuOnlineDesc")}</p>
        <PrimaryButton onClick={() => setMode("online")} color="#ff6452" icon={<Wifi size={18} />}>{t(lang, "menuOnlineBtn")}</PrimaryButton>
      </Card>
      <Card>
        <div className="flex items-center gap-2 mb-2"><Bot size={18} color="#ffbe3d" /><h2 className="font-display text-lg">{t(lang, "menuPracticeTitle")}</h2></div>
        <p className="text-sm font-body mb-3" style={{ color: "#9497b8" }}>{t(lang, "menuPracticeDesc")}</p>
        <PrimaryButton onClick={() => setMode("practice")} color="#ffbe3d" icon={<Bot size={18} />}>{t(lang, "menuPracticeBtn")}</PrimaryButton>
      </Card>
    </div>
  );
}

// ============================================================
// LOCAL MODE (pass-and-play, single device)
// ============================================================
function LocalGame({ lang, onExit }) {
  const [phase, setPhase] = useState("setup");
  const [players, setPlayers] = useState([{ id: 1, name: "" }, { id: 2, name: "" }]);
  const [categories, setCategories] = useState(LOCALIZED_CATEGORIES[lang]);
  const [newCategory, setNewCategory] = useState("");
  const [timeLimit, setTimeLimit] = useState(60);
  const [usedLetters, setUsedLetters] = useState([]);
  const [currentLetter, setCurrentLetter] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [currentAnswers, setCurrentAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [totals, setTotals] = useState({});
  const [disabledKeys, setDisabledKeys] = useState([]);
  const timerRef = useRef(null);
  const inputRefs = useRef([]);

  const addPlayer = () => setPlayers((p) => [...p, { id: Date.now(), name: "" }]);
  const removePlayer = (id) => setPlayers((p) => p.filter((pl) => pl.id !== id));
  const updatePlayerName = (id, name) => setPlayers((p) => p.map((pl) => (pl.id === id ? { ...pl, name } : pl)));
  const addCategory = () => {
    const c = newCategory.trim();
    if (c && !categories.includes(c)) { setCategories((cs) => [...cs, c]); setNewCategory(""); }
  };
  const removeCategory = (c) => setCategories((cs) => cs.filter((x) => x !== c));
  const readyPlayers = players.filter((p) => p.name.trim().length > 0);

  const startGame = () => {
    if (readyPlayers.length < 1 || categories.length < 1) return;
    const initTotals = {};
    readyPlayers.forEach((p) => (initTotals[p.id] = 0));
    setTotals(initTotals);
    setPhase("spin");
  };
  const onLetterLanded = (letter) => { setCurrentLetter(letter); setUsedLetters((u) => [...u, letter]); };
  const beginRound = () => {
    if (!currentLetter) return;
    setCurrentPlayerIdx(0); setCurrentAnswers({}); setTimeLeft(timeLimit); setPhase("playerTurn");
  };

  useEffect(() => {
    if (phase !== "playerTurn") return;
    if (timeLeft <= 0) { finishPlayerTurn(); return; }
    timerRef.current = setTimeout(() => setTimeLeft((tm) => tm - 1), 1000);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft]);

  const finishPlayerTurn = () => {
    clearTimeout(timerRef.current);
    const player = readyPlayers[currentPlayerIdx];
    setRounds((rs) => {
      const rIdx = rs.findIndex((r) => r.letter === currentLetter);
      let newRounds = [...rs];
      if (rIdx === -1) newRounds.push({ letter: currentLetter, answers: { [player.id]: currentAnswers } });
      else newRounds[rIdx] = { ...newRounds[rIdx], answers: { ...newRounds[rIdx].answers, [player.id]: currentAnswers } };
      return newRounds;
    });
    if (currentPlayerIdx + 1 < readyPlayers.length) {
      setCurrentPlayerIdx((i) => i + 1); setCurrentAnswers({}); setTimeLeft(timeLimit);
    } else setPhase("reveal");
  };

  const handleAnswerChange = (cat, val) => setCurrentAnswers((a) => ({ ...a, [cat]: val }));
  const getCurrentRound = () => rounds.find((r) => r.letter === currentLetter);
  const getAnswer = (round) => (playerId, cat) => round?.answers[playerId]?.[cat] || "";

  const roundScores = (() => {
    const round = getCurrentRound();
    if (!round || !currentLetter) return {};
    return scoreRound(categories, readyPlayers.map((p) => p.id), getAnswer(round), currentLetter, disabledKeys);
  })();

  useEffect(() => { if (phase === "reveal") setDisabledKeys([]); }, [phase]);

  const toggleInvalid = (playerId, cat) => {
    const key = `${playerId}-${cat}`;
    setDisabledKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const confirmRoundScores = () => {
    setTotals((tt) => {
      const nt = { ...tt };
      readyPlayers.forEach((p) => { nt[p.id] = (nt[p.id] || 0) + (roundScores[p.id] || 0); });
      return nt;
    });
    setCurrentLetter(null); setPhase("spin");
  };
  const endGame = () => setPhase("gameOver");
  const resetGame = () => {
    setPhase("setup"); setRounds([]); setUsedLetters([]); setCurrentLetter(null);
    setTotals({}); setCurrentPlayerIdx(0); setCurrentAnswers({}); setDisabledKeys([]);
  };

  const currentPlayer = readyPlayers[currentPlayerIdx];
  const sortedTotals = [...readyPlayers].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0));

  return (
    <div>
      <BackBar onBack={onExit} label={t(lang, "mainMenu")} />
      <Header subtitle={t(lang, "menuLocalTitle")} />

      {phase === "setup" && (
        <div>
          <Card>
            <div className="flex items-center gap-2 mb-3"><Users size={18} color="#ff6452" /><h2 className="font-display text-lg">{t(lang, "players")}</h2></div>
            <div className="space-y-2">
              {players.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2">
                  <input value={p.name} onChange={(e) => updatePlayerName(p.id, e.target.value)} placeholder={`${t(lang, "players")} ${i + 1}`}
                    className="flex-1 rounded-lg px-3 py-2 outline-none font-body text-sm"
                    style={{ background: "#14162b", border: "1px solid #2c2f52", color: "#f2f1f7" }} />
                  {players.length > 1 && (
                    <button onClick={() => removePlayer(p.id)} className="p-2 rounded-lg" style={{ background: "#2c2f52" }}>
                      <X size={14} color="#9497b8" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addPlayer} className="mt-3 flex items-center gap-1 text-sm font-body font-medium" style={{ color: "#37c9a1" }}>
              <Plus size={16} /> {t(lang, "addPlayer")}
            </button>
          </Card>
          <Card>
            <h2 className="font-display text-lg mb-3">{t(lang, "categories")}</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {categories.map((c) => (
                <span key={c} className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-body font-medium" style={{ background: "#2c2f52" }}>
                  {c}<button onClick={() => removeCategory(c)}><X size={12} color="#9497b8" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()}
                placeholder={t(lang, "newCategoryPlaceholder")} className="flex-1 rounded-lg px-3 py-2 outline-none font-body text-sm"
                style={{ background: "#14162b", border: "1px solid #2c2f52", color: "#f2f1f7" }} />
              <button onClick={addCategory} className="px-3 rounded-lg font-body text-sm font-medium" style={{ background: "#ff6452", color: "#14162b" }}>
                <Plus size={16} />
              </button>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg">{t(lang, "timePerTurn")}</h2>
              <span className="font-display text-lg" style={{ color: "#ffbe3d" }}>{timeLimit}s</span>
            </div>
            <input type="range" min="20" max="120" step="10" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))}
              className="w-full" style={{ accentColor: "#ff6452" }} />
          </Card>
          <PrimaryButton onClick={startGame} disabled={readyPlayers.length < 1 || categories.length < 1} icon={<Play size={20} />}>
            {t(lang, "startGame")}
          </PrimaryButton>
        </div>
      )}

      {phase === "spin" && (
        <div>
          <Card>
            {!currentLetter ? (
              <LetterSpinner usedLetters={usedLetters} onLanded={onLetterLanded} lang={lang} />
            ) : (
              <div className="flex flex-col items-center py-4">
                <div className="font-display flex items-center justify-center rounded-full" style={{ width: 120, height: 120, fontSize: 54, background: "#ff6452", color: "#14162b" }}>
                  {currentLetter}
                </div>
                <button onClick={beginRound} className="mt-5 flex items-center gap-2 rounded-xl px-6 py-3 font-display text-base" style={{ background: "#37c9a1", color: "#14162b" }}>
                  {t(lang, "beginRound")} <ChevronRight size={18} />
                </button>
              </div>
            )}
            {usedLetters.length > 0 && <p className="text-center text-xs font-body mt-1" style={{ color: "#9497b8" }}>{t(lang, "usedLetters")} {usedLetters.join(", ")}</p>}
          </Card>
          <Card>
            <div className="flex items-center gap-2 mb-2"><Trophy size={16} color="#ffbe3d" /><h3 className="font-display text-base">{t(lang, "scores")}</h3></div>
            {readyPlayers.map((p) => (
              <div key={p.id} className="flex justify-between text-sm font-body py-1">
                <span>{p.name}</span><span className="font-medium" style={{ color: "#ffbe3d" }}>{totals[p.id] || 0}</span>
              </div>
            ))}
          </Card>
          <button onClick={endGame} className="w-full text-center text-sm font-body py-2" style={{ color: "#9497b8" }}>{t(lang, "endGame")}</button>
        </div>
      )}

      {phase === "playerTurn" && currentPlayer && (
        <PlayerTurnBlock
          lang={lang} player={currentPlayer} playerIndex={currentPlayerIdx} totalPlayers={readyPlayers.length}
          letter={currentLetter} categories={categories} answers={currentAnswers} onChange={handleAnswerChange}
          timeLeft={timeLeft} timeLimit={timeLimit}
          onStart={() => { setTimeLeft(timeLimit); setCurrentAnswers({}); setTimeout(() => inputRefs.current[0]?.focus(), 50); }}
          onFinish={finishPlayerTurn} inputRefs={inputRefs}
        />
      )}

      {phase === "reveal" && currentLetter && (
        <RevealBlock lang={lang} letter={currentLetter} categories={categories} players={readyPlayers}
          round={getCurrentRound()} roundScores={roundScores} disabledKeys={disabledKeys} toggleInvalid={toggleInvalid} />
      )}
      {phase === "reveal" && currentLetter && (
        <PrimaryButton onClick={confirmRoundScores} icon={<ChevronRight size={18} />}>{t(lang, "confirmAndContinue")}</PrimaryButton>
      )}
      {phase === "gameOver" && <GameOverBlock lang={lang} sortedTotals={sortedTotals} totals={totals} onReset={resetGame} />}
    </div>
  );
}

function PlayerTurnBlock({ lang, player, playerIndex, totalPlayers, letter, categories, answers, onChange, timeLeft, timeLimit, onStart, onFinish, inputRefs }) {
  const [started, setStarted] = useState(false);
  useEffect(() => { setStarted(false); }, [player.id]);
  const pct = Math.max(0, (timeLeft / timeLimit) * 100);
  return (
    <Card>
      <p className="text-xs font-body mb-1" style={{ color: "#9497b8" }}>{t(lang, "turnOf")} {playerIndex + 1} {t(lang, "of")} {totalPlayers}</p>
      <h2 className="font-display text-2xl mb-2" style={{ color: "#ffbe3d" }}>{player.name}</h2>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-body" style={{ color: "#9497b8" }}>{t(lang, "letter")}</span>
        <span className="font-display rounded-lg px-3 py-1 text-xl" style={{ background: "#ff6452", color: "#14162b" }}>{letter}</span>
      </div>
      {!started ? (
        <PrimaryButton color="#37c9a1" icon={<Play size={18} />} onClick={() => { setStarted(true); onStart(); }}>{t(lang, "ready")}</PrimaryButton>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1 text-sm font-body" style={{ color: "#9497b8" }}><Clock size={14} /> {timeLeft}s</div>
            <button onClick={onFinish} disabled={!canCallStop(answers, categories)}
              className="text-xs font-body font-medium rounded-lg px-3 py-1 disabled:opacity-30"
              style={{ background: "#2c2f52", color: "#ff6452" }}>{t(lang, "stopBtn")}</button>
          </div>
          {!canCallStop(answers, categories) && (
            <p className="text-xs font-body mb-2" style={{ color: "#9497b8" }}>{t(lang, "stopHint")}</p>
          )}
          <div className="w-full h-2 rounded-full mb-4 overflow-hidden" style={{ background: "#2c2f52" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: timeLeft <= 10 ? "#ff6452" : "#37c9a1", transition: "width 1s linear" }} />
          </div>
          <div className="space-y-2">
            {categories.map((cat, i) => (
              <div key={cat}>
                <label className="text-xs font-body" style={{ color: "#9497b8" }}>{cat}</label>
                <input ref={(el) => (inputRefs.current[i] = el)} value={answers[cat] || ""} onChange={(e) => onChange(cat, e.target.value)}
                  className="w-full rounded-lg px-3 py-2 outline-none font-body text-sm" style={{ background: "#14162b", border: "1px solid #2c2f52", color: "#f2f1f7" }} />
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function RevealBlock({ lang, letter, categories, players, round, roundScores, disabledKeys, toggleInvalid }) {
  if (!round) return null;
  const disabled = disabledKeys || [];
  return (
    <>
      <Card>
        <h2 className="font-display text-xl mb-1" style={{ color: "#ffbe3d" }}>{t(lang, "resultsTitle")} {letter}</h2>
        <p className="text-xs font-body mb-4" style={{ color: "#9497b8" }}>{t(lang, "tapToInvalidate")}</p>
        {categories.map((cat) => (
          <div key={cat} className="mb-4">
            <p className="text-xs font-display uppercase mb-1" style={{ color: "#37c9a1" }}>{cat}</p>
            {players.map((p) => {
              const val = round.answers[p.id]?.[cat] || "";
              const norm = normalize(val);
              const validStart = norm.length > 0 && norm[0] === letter.toLowerCase();
              const key = `${p.id}-${cat}`;
              const isDisabled = disabled.includes(key);
              return (
                <button key={p.id} onClick={() => validStart && toggleInvalid(p.id, cat)}
                  className="w-full flex items-center justify-between text-sm font-body py-1" style={{ opacity: validStart && !isDisabled ? 1 : 0.4 }}>
                  <span>{p.name}: {val || "—"}</span>
                  {validStart && <Check size={14} color={isDisabled ? "#9497b8" : "#37c9a1"} />}
                </button>
              );
            })}
          </div>
        ))}
      </Card>
      <Card>
        <h3 className="font-display text-base mb-2">{t(lang, "roundPoints")}</h3>
        {players.map((p) => (
          <div key={p.id} className="flex justify-between text-sm font-body py-1">
            <span>{p.name}</span><span className="font-medium" style={{ color: "#ffbe3d" }}>+{roundScores[p.id] || 0}</span>
          </div>
        ))}
      </Card>
    </>
  );
}

function GameOverBlock({ lang, sortedTotals, totals, onReset }) {
  return (
    <div>
      <Card>
        <div className="flex flex-col items-center py-4">
          <Trophy size={40} color="#ffbe3d" />
          <h2 className="font-display text-2xl mt-2" style={{ color: "#ffbe3d" }}>{t(lang, "gameOverTitle")}</h2>
        </div>
        {sortedTotals.map((p, i) => (
          <div key={p.id} className="flex justify-between items-center rounded-lg px-3 py-2 mb-1 font-body text-sm" style={{ background: i === 0 ? "#2c2f52" : "transparent" }}>
            <span style={{ color: i === 0 ? "#ffbe3d" : "#f2f1f7" }}>{i === 0 ? "🏆 " : `${i + 1}. `}{p.name}</span>
            <span className="font-medium">{totals[p.id] || 0}</span>
          </div>
        ))}
      </Card>
      <PrimaryButton onClick={onReset} color="#37c9a1" icon={<RotateCcw size={18} />}>{t(lang, "playAgain")}</PrimaryButton>
    </div>
  );
}

// ============================================================
// PRACTICE MODE — vs local bots, no network needed
// ============================================================
function PracticeGame({ lang, onExit }) {
  const [phase, setPhase] = useState("setup");
  const [numBots, setNumBots] = useState(2);
  const [difficulty, setDifficulty] = useState("medium");
  const [categories, setCategories] = useState(LOCALIZED_CATEGORIES[lang]);
  const [timeLimit, setTimeLimit] = useState(60);
  const [usedLetters, setUsedLetters] = useState([]);
  const [currentLetter, setCurrentLetter] = useState(null);
  const [humanAnswers, setHumanAnswers] = useState({});
  const [botAnswers, setBotAnswers] = useState({}); // { botId: {cat: word|null} }
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
        const catId = CATEGORY_IDS[i]; // only default categories (matching index) have bot data
        if (!catId) return;
        if (Math.random() > successRate) return; // bot "doesn't think of one" in time
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

  const displayName = (id) => (id === "human" ? t(lang, "you").replace(/[()]/g, "") || "Vos" : `Bot ${id.replace("bot", "")}`);
  const fakePlayers = allIds.map((id) => ({ id, name: id === "human" ? (t(lang, "you").replace(/[()]/g, "").trim() || "Vos") : `Bot ${id.replace("bot", "")}` }));
  const sortedTotals = [...fakePlayers].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0));

  return (
    <div>
      <BackBar onBack={onExit} label={t(lang, "mainMenu")} />
      <Header subtitle={t(lang, "menuPracticeTitle")} />

      {phase === "setup" && (
        <div>
          <Card>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg">{t(lang, "numberOfBots")}</h2>
              <span className="font-display text-lg" style={{ color: "#ffbe3d" }}>{numBots}</span>
            </div>
            <input type="range" min="1" max="3" step="1" value={numBots} onChange={(e) => setNumBots(Number(e.target.value))}
              className="w-full" style={{ accentColor: "#ffbe3d" }} />
          </Card>
          <Card>
            <h2 className="font-display text-lg mb-2">{t(lang, "difficulty")}</h2>
            <div className="flex gap-2">
              {["easy", "medium", "hard"].map((d) => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className="flex-1 rounded-lg py-2 text-sm font-body font-medium"
                  style={{ background: difficulty === d ? "#ffbe3d" : "#2c2f52", color: difficulty === d ? "#14162b" : "#9497b8" }}>
                  {t(lang, `difficulty${d[0].toUpperCase()}${d.slice(1)}`)}
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="font-display text-lg mb-3">{t(lang, "categories")}</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <span key={c} className="rounded-full px-3 py-1 text-xs font-body font-medium" style={{ background: "#2c2f52" }}>{c}</span>
              ))}
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg">{t(lang, "timePerTurn")}</h2>
              <span className="font-display text-lg" style={{ color: "#ffbe3d" }}>{timeLimit}s</span>
            </div>
            <input type="range" min="20" max="120" step="10" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))}
              className="w-full" style={{ accentColor: "#ff6452" }} />
          </Card>
          <PrimaryButton onClick={startGame} color="#ffbe3d" icon={<Play size={20} />}>{t(lang, "startGame")}</PrimaryButton>
        </div>
      )}

      {phase === "spin" && (
        <div>
          <Card>
            {!currentLetter ? (
              <LetterSpinner usedLetters={usedLetters} onLanded={onLetterLanded} lang={lang} />
            ) : (
              <div className="flex flex-col items-center py-4">
                <div className="font-display flex items-center justify-center rounded-full" style={{ width: 120, height: 120, fontSize: 54, background: "#ff6452", color: "#14162b" }}>{currentLetter}</div>
                <button onClick={beginRound} className="mt-5 flex items-center gap-2 rounded-xl px-6 py-3 font-display text-base" style={{ background: "#37c9a1", color: "#14162b" }}>
                  {t(lang, "beginRound")} <ChevronRight size={18} />
                </button>
              </div>
            )}
            {usedLetters.length > 0 && <p className="text-center text-xs font-body mt-1" style={{ color: "#9497b8" }}>{t(lang, "usedLetters")} {usedLetters.join(", ")}</p>}
          </Card>
          <Card>
            <div className="flex items-center gap-2 mb-2"><Trophy size={16} color="#ffbe3d" /><h3 className="font-display text-base">{t(lang, "scores")}</h3></div>
            {fakePlayers.map((p) => (
              <div key={p.id} className="flex justify-between text-sm font-body py-1">
                <span>{p.name}</span><span className="font-medium" style={{ color: "#ffbe3d" }}>{totals[p.id] || 0}</span>
              </div>
            ))}
          </Card>
          <button onClick={endGame} className="w-full text-center text-sm font-body py-2" style={{ color: "#9497b8" }}>{t(lang, "endGame")}</button>
        </div>
      )}

      {phase === "playerTurn" && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-body" style={{ color: "#9497b8" }}>{t(lang, "letter")}</span>
            <span className="font-display rounded-lg px-3 py-1 text-xl" style={{ background: "#ff6452", color: "#14162b" }}>{currentLetter}</span>
          </div>
          {!started ? (
            <PrimaryButton color="#37c9a1" icon={<Play size={18} />} onClick={() => { setStarted(true); setTimeLeft(timeLimit); setTimeout(() => inputRefs.current[0]?.focus(), 50); }}>
              {t(lang, "ready")}
            </PrimaryButton>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1 text-sm font-body" style={{ color: "#9497b8" }}><Clock size={14} /> {timeLeft}s</div>
                <button onClick={finishRound} disabled={!canCallStop(humanAnswers, categories)}
                  className="text-xs font-body font-medium rounded-lg px-3 py-1 disabled:opacity-30"
                  style={{ background: "#2c2f52", color: "#ff6452" }}>{t(lang, "stopBtn")}</button>
              </div>
              {!canCallStop(humanAnswers, categories) && <p className="text-xs font-body mb-2" style={{ color: "#9497b8" }}>{t(lang, "stopHint")}</p>}
              <div className="w-full h-2 rounded-full mb-4 overflow-hidden" style={{ background: "#2c2f52" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.max(0, (timeLeft / timeLimit) * 100)}%`, background: timeLeft <= 10 ? "#ff6452" : "#37c9a1", transition: "width 1s linear" }} />
              </div>
              <div className="space-y-2">
                {categories.map((cat, i) => (
                  <div key={cat}>
                    <label className="text-xs font-body" style={{ color: "#9497b8" }}>{cat}</label>
                    <input ref={(el) => (inputRefs.current[i] = el)} value={humanAnswers[cat] || ""} onChange={(e) => handleAnswerChange(cat, e.target.value)}
                      className="w-full rounded-lg px-3 py-2 outline-none font-body text-sm" style={{ background: "#14162b", border: "1px solid #2c2f52", color: "#f2f1f7" }} />
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {phase === "reveal" && currentLetter && (
        <>
          <Card>
            <h2 className="font-display text-xl mb-1" style={{ color: "#ffbe3d" }}>{t(lang, "resultsTitle")} {currentLetter}</h2>
            <p className="text-xs font-body mb-4" style={{ color: "#9497b8" }}>{t(lang, "tapToInvalidate")}</p>
            {categories.map((cat) => (
              <div key={cat} className="mb-4">
                <p className="text-xs font-display uppercase mb-1" style={{ color: "#37c9a1" }}>{cat}</p>
                {fakePlayers.map((p) => {
                  const val = getAnswer(p.id, cat);
                  const norm = normalize(val);
                  const validStart = norm.length > 0 && norm[0] === currentLetter.toLowerCase();
                  const key = `${p.id}-${cat}`;
                  const isDisabled = disabledKeys.includes(key);
                  return (
                    <button key={p.id} onClick={() => validStart && toggleInvalid(p.id, cat)}
                      className="w-full flex items-center justify-between text-sm font-body py-1" style={{ opacity: validStart && !isDisabled ? 1 : 0.4 }}>
                      <span>{p.name}: {val || "—"}</span>
                      {validStart && <Check size={14} color={isDisabled ? "#9497b8" : "#37c9a1"} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </Card>
          <Card>
            <h3 className="font-display text-base mb-2">{t(lang, "roundPoints")}</h3>
            {fakePlayers.map((p) => (
              <div key={p.id} className="flex justify-between text-sm font-body py-1">
                <span>{p.name}</span><span className="font-medium" style={{ color: "#ffbe3d" }}>+{roundScores[p.id] || 0}</span>
              </div>
            ))}
          </Card>
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
  const [screen, setScreen] = useState("entry");
  const [myId] = useState(genId);
  const [myName, setMyName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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
    if (!myName.trim()) return;
    const code = genCode();
    try {
      const data = await createRoom(code, { hostId: myId, hostName: myName.trim(), categories: LOCALIZED_CATEGORIES[lang] });
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
          <label className="text-xs font-body" style={{ color: "#9497b8" }}>{t(lang, "yourName")}</label>
          <input value={myName} onChange={(e) => setMyName(e.target.value)} placeholder={t(lang, "namePlaceholder")}
            className="w-full rounded-lg px-3 py-2 mt-1 mb-4 outline-none font-body text-sm"
            style={{ background: "#14162b", border: "1px solid #2c2f52", color: "#f2f1f7" }} />
          <PrimaryButton onClick={createNewRoom} disabled={!myName.trim()} icon={<Plus size={18} />}>{t(lang, "createRoom")}</PrimaryButton>
        </Card>
        <Card>
          <label className="text-xs font-body" style={{ color: "#9497b8" }}>{t(lang, "roomCode")}</label>
          <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder={t(lang, "joinCodePlaceholder")} maxLength={4}
            className="w-full rounded-lg px-3 py-2 mt-1 mb-2 outline-none font-body text-sm tracking-widest text-center uppercase"
            style={{ background: "#14162b", border: "1px solid #2c2f52", color: "#f2f1f7" }} />
          {errorMsg && <p className="text-xs font-body mb-2" style={{ color: "#ff6452" }}>{errorMsg}</p>}
          <PrimaryButton onClick={joinExistingRoom} disabled={!myName.trim() || joinCode.trim().length < 4} color="#37c9a1" icon={<Wifi size={18} />}>
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
          <p className="text-xs font-body mb-1 text-center" style={{ color: "#9497b8" }}>{t(lang, "roomCode")}</p>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="font-display text-4xl tracking-widest" style={{ color: "#ffbe3d" }}>{roomCode}</span>
            <button onClick={() => { try { navigator.clipboard.writeText(roomCode); } catch {} }} className="p-2 rounded-lg" style={{ background: "#2c2f52" }}>
              <Copy size={14} color="#9497b8" />
            </button>
          </div>
          <p className="text-center text-xs font-body" style={{ color: "#9497b8" }}>{t(lang, "shareCode")}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-2"><Users size={16} color="#37c9a1" /><h3 className="font-display text-base">{t(lang, "players")} ({playerList.length})</h3></div>
          {playerList.map((p) => <p key={p.id} className="text-sm font-body py-1">{p.name}{p.id === myId ? ` ${t(lang, "you")}` : ""}</p>)}
        </Card>
        {isHost ? (
          <>
            <Card>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-base">{t(lang, "timePerRound")}</h3>
                <span className="font-display text-lg" style={{ color: "#ffbe3d" }}>{room?.time_limit}s</span>
              </div>
              <input type="range" min="20" max="120" step="10" value={room?.time_limit || 60}
                onChange={(e) => hostUpdateTimeLimit(Number(e.target.value))} className="w-full" style={{ accentColor: "#ff6452" }} />
            </Card>
            {!hostSpinning ? (
              <PrimaryButton onClick={() => setHostSpinning(true)} icon={<Play size={20} />}>{t(lang, "spinFirstLetter")}</PrimaryButton>
            ) : (
              <Card><LetterSpinner usedLetters={room?.used_letters || []} onLanded={hostLaunchRound} lang={lang} /></Card>
            )}
          </>
        ) : (
          <Card><p className="text-sm font-body text-center" style={{ color: "#9497b8" }}>{t(lang, "waitingHost")}</p></Card>
        )}
      </div>
    );
  }

  if (!room) return <div><BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} /><Card><p className="text-sm font-body text-center" style={{ color: "#9497b8" }}>{t(lang, "loadingRoom")}</p></Card></div>;

  if (room.phase === "gameover") {
    return (
      <div>
        <BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} />
        <Card>
          <div className="flex flex-col items-center py-4"><Trophy size={40} color="#ffbe3d" /><h2 className="font-display text-2xl mt-2" style={{ color: "#ffbe3d" }}>{t(lang, "gameOverTitle")}</h2></div>
          {sortedTotals.map((p, i) => (
            <div key={p.id} className="flex justify-between items-center rounded-lg px-3 py-2 mb-1 font-body text-sm" style={{ background: i === 0 ? "#2c2f52" : "transparent" }}>
              <span style={{ color: i === 0 ? "#ffbe3d" : "#f2f1f7" }}>{i === 0 ? "🏆 " : `${i + 1}. `}{p.name}</span>
              <span className="font-medium">{room.totals?.[p.id] || 0}</span>
            </div>
          ))}
        </Card>
        <PrimaryButton onClick={leaveRoom} color="#37c9a1" icon={<RotateCcw size={18} />}>{t(lang, "backToMenu")}</PrimaryButton>
      </div>
    );
  }

  if (!room.letter) {
    return <div><BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} /><Card><p className="text-sm font-body text-center" style={{ color: "#9497b8" }}>{t(lang, "waitingFirstLetter")}</p></Card></div>;
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
            <p className="text-sm font-body mb-2" style={{ color: "#9497b8" }}>{t(lang, "getReady")}</p>
            <div className="font-display flex items-center justify-center rounded-full" style={{ width: 100, height: 100, fontSize: 44, background: "#2c2f52", color: "#ffbe3d" }}>{secsToStart}</div>
            <p className="font-display text-2xl mt-4" style={{ color: "#ff6452" }}>{t(lang, "letter")} {room.letter}</p>
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
            <span className="text-sm font-body" style={{ color: "#9497b8" }}>{t(lang, "letter")}</span>
            <span className="font-display rounded-lg px-3 py-1 text-xl" style={{ background: "#ff6452", color: "#14162b" }}>{room.letter}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1 text-sm font-body" style={{ color: "#9497b8" }}><Clock size={14} /> {secsLeft}s</div>
            <button onClick={forceStopForAll} disabled={alreadySubmitted || !canCallStop(myAnswers, room.categories)}
              className="text-xs font-body font-medium rounded-lg px-3 py-1 disabled:opacity-30"
              style={{ background: "#2c2f52", color: "#ff6452" }}>{t(lang, "stopBtn")}</button>
          </div>
          <div className="w-full h-2 rounded-full mb-2 overflow-hidden" style={{ background: "#2c2f52" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: secsLeft <= 10 ? "#ff6452" : "#37c9a1", transition: "width 1s linear" }} />
          </div>
          {!alreadySubmitted && !canCallStop(myAnswers, room.categories) && (
            <p className="text-xs font-body mb-2" style={{ color: "#9497b8" }}>{t(lang, "stopHintAll")}</p>
          )}
          {alreadySubmitted ? (
            <p className="text-sm font-body text-center mt-2" style={{ color: "#37c9a1" }}>{t(lang, "alreadySubmitted")}</p>
          ) : (
            <>
              <div className="space-y-2 mb-4 mt-2">
                {room.categories.map((cat, i) => (
                  <div key={cat}>
                    <label className="text-xs font-body" style={{ color: "#9497b8" }}>{cat}</label>
                    <input ref={(el) => (inputRefs.current[i] = el)} value={myAnswers[cat] || ""}
                      onChange={(e) => setMyAnswers((a) => ({ ...a, [cat]: e.target.value }))}
                      className="w-full rounded-lg px-3 py-2 outline-none font-body text-sm" style={{ background: "#14162b", border: "1px solid #2c2f52", color: "#f2f1f7" }} />
                  </div>
                ))}
              </div>
              <PrimaryButton onClick={() => mySubmit()} color="#37c9a1" icon={<Check size={18} />}>{t(lang, "sendAnswers")}</PrimaryButton>
            </>
          )}
        </Card>
      </div>
    );
  }

  const roundScores = computeRoundScores();
  return (
    <div>
      <BackBar onBack={leaveRoom} label={t(lang, "exitRoom")} />
      <Card>
        <h2 className="font-display text-xl mb-1" style={{ color: "#ffbe3d" }}>{t(lang, "resultsTitle")} {room.letter}</h2>
        {room.stopped_by && <p className="text-xs font-body mb-1" style={{ color: "#ff6452" }}>{room.stopped_by} {t(lang, "stoppedRoundBy")}</p>}
        <p className="text-xs font-body mb-4" style={{ color: "#9497b8" }}>{t(lang, "tapToInvalidate")}</p>
        {room.categories.map((cat) => (
          <div key={cat} className="mb-4">
            <p className="text-xs font-display uppercase mb-1" style={{ color: "#37c9a1" }}>{cat}</p>
            {playerList.map((p) => {
              const val = getRoundAnswer(p.id, cat);
              const norm = normalize(val);
              const validStart = norm.length > 0 && norm[0] === room.letter.toLowerCase();
              const isDisabled = getOverrides().includes(`${p.id}-${cat}`);
              return (
                <button key={p.id} onClick={() => validStart && onToggleOverride(p.id, cat)}
                  className="w-full flex items-center justify-between text-sm font-body py-1" style={{ opacity: validStart && !isDisabled ? 1 : 0.4 }}>
                  <span>{p.name}: {val || "—"}</span>
                  {validStart && <Check size={14} color={isDisabled ? "#9497b8" : "#37c9a1"} />}
                </button>
              );
            })}
          </div>
        ))}
      </Card>
      <Card>
        <h3 className="font-display text-base mb-2">{t(lang, "roundPoints")}</h3>
        {playerList.map((p) => (
          <div key={p.id} className="flex justify-between text-sm font-body py-1">
            <span>{p.name}</span><span className="font-medium" style={{ color: "#ffbe3d" }}>+{roundScores[p.id] || 0}</span>
          </div>
        ))}
      </Card>
      {isHost ? (
        !hostSpinning ? (
          <>
            <PrimaryButton onClick={hostConfirmAndContinue} icon={<ChevronRight size={18} />}>{t(lang, "confirmAndSpinNext")}</PrimaryButton>
            <button onClick={hostEndGame} className="w-full text-center text-sm font-body py-2 mt-1" style={{ color: "#9497b8" }}>{t(lang, "endGame")}</button>
          </>
        ) : (
          <Card><LetterSpinner usedLetters={room.used_letters || []} onLanded={hostLaunchRound} lang={lang} /></Card>
        )
      ) : (
        <Card><p className="text-sm font-body text-center" style={{ color: "#9497b8" }}>{t(lang, "waitingOthers")}</p></Card>
      )}
    </div>
  );
}
