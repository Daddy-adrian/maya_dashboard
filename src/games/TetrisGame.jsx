import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowDown, Gauge } from 'lucide-react';
import DynamicIslandHUD from '../components/DynamicIslandHUD';
import RoundCompleteSheet from '../components/RoundCompleteSheet';
import { useEngagement } from '../context/EngagementContext';
import { assetUrl } from '../utils/assets';
import { TAP_PROPS } from '../utils/motion';
import { playNearMiss, playTap, playTetrisClear, playTetrisDrop, playTetrisMove } from '../utils/sensory';
import { useGameMusic } from '../utils/useGameMusic';

const PRONOUN_FILES = [
  'i.jpeg',
  'he.jpeg', 'he_1.jpeg', 'he_2.jpeg', 'he_3.jpeg',
  'she.jpeg', 'she_1.jpeg', 'she_2.jpeg', 'she_3.jpeg',
  'it.jpeg', 'it_1.jpeg', 'it_2.jpeg',
  'we.jpeg', 'we_1.jpeg', 'we_2.jpeg', 'we_3.jpeg',
  'they.jpeg', 'they_1.jpeg', 'they_2.jpeg', 'they_3.jpeg',
  'you.jpeg'
];

const PACE_INTERVALS_MS = [Infinity, 5000, 3800, 2900, 2200, 1500, 1300, 1100, 950, 800, 650];
const ROUND_LENGTH = 15;
const PASTEL_BLOCKS = ['#FFD4E2', '#CBE8FF', '#C9F2DE', '#FFE8B6', '#DFD1FF', '#FFD8C2'];

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Unified Parameterized Tetris Engine for both Am / Is / Are (3-lane) and Have / Has (2-lane).
 */
export default function TetrisGame({ mode = 'am_is_are', onExit }) {
  useGameMusic('tetris');
  const isAmIsAre = mode === 'am_is_are';
  const buckets = isAmIsAre ? ['am', 'is', 'are'] : ['have', 'has'];
  const grammarRule = isAmIsAre
    ? '"I" → am  |  "he, she, it" → is  |  "you, we, they" → are'
    : '"he, she, it" → has  |  "I, you, we, they" → have';

  const { awardXP, incrementQuest, maybeTriggerMysteryChest } = useEngagement();

  const [paceLevel, setPaceLevel] = useState(1); // Default 1
  const [speedMode, setSpeedMode] = useState('slow'); // 'slow' | 'normal'
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [banner, setBanner] = useState(null);
  const [pulseBucket, setPulseBucket] = useState(null);
  const [activeCards, setActiveCards] = useState([]);
  const [phase, setPhase] = useState('playing'); // 'playing' | 'retry' | 'done'
  const [fieldHeight, setFieldHeight] = useState(400);

  const stateRef = useRef({
    roundCards: [],
    spawned: 0,
    resolved: 0,
    active: [],
    retryCard: null,
    phase: 'playing',
    paceLevel: 1,
    speedMode: 'slow',
    spawnElapsed: 0,
    combo: 0
  });
  const playfieldRef = useRef(null);
  const rafRef = useRef(null);
  const swipeStartRef = useRef(null);

  useEffect(() => {
    const el = playfieldRef.current;
    if (!el) return undefined;
    const updateH = () => {
      if (el.clientHeight > 0) setFieldHeight(el.clientHeight);
    };
    updateH();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateH);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateH);
    return () => window.removeEventListener('resize', updateH);
  }, []);

  useEffect(() => {
    stateRef.current.paceLevel = paceLevel;
  }, [paceLevel]);

  useEffect(() => {
    stateRef.current.speedMode = speedMode;
  }, [speedMode]);

  function buildCards() {
    const mapped = PRONOUN_FILES.map((file) => {
      const prefix = file.replace(/\.jpeg$/i, '').split('_')[0].toLowerCase();
      const pronoun = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      let verb;
      if (isAmIsAre) {
        verb = prefix === 'i' ? 'am' : prefix === 'he' || prefix === 'she' || prefix === 'it' ? 'is' : 'are';
      } else {
        verb = prefix === 'he' || prefix === 'she' || prefix === 'it' ? 'has' : 'have';
      }
      return {
        image: assetUrl(`pronoun/${file}`),
        pronoun,
        verb,
        bucketIndex: buckets.indexOf(verb)
      };
    });

    const picked = shuffle(mapped).slice(0, ROUND_LENGTH);
    if (isAmIsAre && !picked.some((c) => c.verb === 'am')) {
      const iCard = mapped.find((c) => c.verb === 'am');
      if (iCard) picked[Math.floor(Math.random() * picked.length)] = iCard;
    }
    // Avoid back-to-back identical pronouns where possible
    for (let i = 1; i < picked.length; i += 1) {
      if (picked[i].pronoun === picked[i - 1].pronoun) {
        const swapIdx = picked.findIndex(
          (c, j) => j > i && c.pronoun !== picked[i - 1].pronoun
        );
        if (swapIdx !== -1) {
          [picked[i], picked[swapIdx]] = [picked[swapIdx], picked[i]];
        }
      }
    }
    picked.forEach((c) => {
      const pre = new Image();
      pre.src = c.image;
    });
    return picked;
  }

  function spawnOne() {
    const s = stateRef.current;
    if (s.spawned >= s.roundCards.length) return;
    const card = s.roundCards[s.spawned];
    const pastelColor = PASTEL_BLOCKS[s.spawned % PASTEL_BLOCKS.length];
    s.spawned += 1;
    s.active.push({
      uid: `tc-${s.spawned}-${Date.now()}`,
      card,
      pastelColor,
      lane: Math.floor(Math.random() * buckets.length),
      progressY: 0,
      fast: false,
      mistake: false
    });
  }

  function getControlled() {
    const s = stateRef.current;
    if (s.phase === 'retry' && s.retryCard) return s.retryCard;
    if (s.active.length === 0) return null;
    return s.active.reduce((low, item) => (item.progressY > low.progressY ? item : low));
  }

  function resolveSuccess(item) {
    const s = stateRef.current;
    s.active = s.active.filter((c) => c.uid !== item.uid);
    s.retryCard = null;
    s.resolved += 1;
    setResolvedCount(s.resolved);
    setPulseBucket(null);

    if (!item.mistake) {
      s.combo += 1;
      setCombo(s.combo);
      setScore((sc) => sc + 1);
      const isFever = s.combo >= 5;
      awardXP(isFever ? 20 : 10, isFever ? 4 : 2);
      setBanner(
        isFever
          ? { type: 'fire', text: `🔥 FEVER MODE! ${item.card.pronoun} ${item.card.verb} (2x XP)` }
          : { type: 'fire', text: `${item.card.pronoun} ${item.card.verb}!` }
      );
    } else {
      awardXP(5, 1);
      setBanner({ type: 'fire', text: `${item.card.pronoun} ${item.card.verb}!` });
    }

    playTetrisClear(Math.max(1, s.combo));
    incrementQuest('q-tetris', 1);

    if (s.resolved >= s.roundCards.length && s.active.length === 0) {
      s.phase = 'done';
      setPhase('done');
      setActiveCards([]);
      maybeTriggerMysteryChest(false);
      return;
    }

    s.phase = 'playing';
    setPhase('playing');
    if (s.active.length === 0 && s.spawned < s.roundCards.length) {
      s.spawnElapsed = 0;
      spawnOne();
    }
    setActiveCards([...s.active]);
  }

  function handleLand(item) {
    const s = stateRef.current;
    if (item.lane === item.card.bucketIndex) {
      resolveSuccess(item);
      return;
    }

    // Gentle pause-on-mistake with Dynamic Island grammar rule + pulsing green target bucket
    item.mistake = true;
    s.combo = 0;
    setCombo(0);
    s.phase = 'retry';
    s.retryCard = item;
    setPhase('retry');
    setPulseBucket(item.card.bucketIndex);
    playNearMiss();
    setBanner({ type: 'coach', text: `Almost! ${grammarRule}` });
    setActiveCards([...s.active]);
  }

  function moveControlled(delta) {
    const s = stateRef.current;
    const ctrl = getControlled();
    if (!ctrl || (s.phase !== 'playing' && s.phase !== 'retry')) return;
    const next = Math.max(0, Math.min(buckets.length - 1, ctrl.lane + delta));
    if (next !== ctrl.lane) {
      playTetrisMove();
      ctrl.lane = next;
      setActiveCards([...s.active]);
      if (s.phase === 'retry' && ctrl.lane === ctrl.card.bucketIndex) {
        resolveSuccess(ctrl);
      }
    }
  }

  function setControlledLane(laneIdx) {
    const s = stateRef.current;
    const ctrl = getControlled();
    if (!ctrl || (s.phase !== 'playing' && s.phase !== 'retry')) return;
    if (s.phase === 'playing' && ctrl.lane === laneIdx) {
      playTetrisDrop();
      ctrl.fast = true;
      return;
    }
    playTetrisMove();
    ctrl.lane = laneIdx;
    setActiveCards([...s.active]);
    if (s.phase === 'retry' && ctrl.lane === ctrl.card.bucketIndex) {
      resolveSuccess(ctrl);
    }
  }

  function triggerDrop() {
    const s = stateRef.current;
    const ctrl = getControlled();
    if (!ctrl) return;
    if (s.phase === 'retry') {
      if (ctrl.lane === ctrl.card.bucketIndex) resolveSuccess(ctrl);
      return;
    }
    if (s.phase === 'playing') {
      playTetrisDrop();
      ctrl.fast = true;
    }
  }

  function startNewRound() {
    const s = stateRef.current;
    s.roundCards = buildCards();
    s.spawned = 0;
    s.resolved = 0;
    s.active = [];
    s.retryCard = null;
    s.phase = 'playing';
    s.spawnElapsed = 0;
    s.combo = 0;

    setScore(0);
    setCombo(0);
    setResolvedCount(0);
    setBanner(null);
    setPulseBucket(null);
    setPhase('playing');

    spawnOne();
    setActiveCards([...s.active]);
  }

  useEffect(() => {
    startNewRound();

    let last = performance.now();
    const tick = (now) => {
      const s = stateRef.current;
      const dt = Math.min(now - last, 100);
      last = now;

      if (s.phase === 'playing') {
        const interval = PACE_INTERVALS_MS[s.paceLevel] ?? 5000;
        if (s.spawned < s.roundCards.length && Number.isFinite(interval)) {
          s.spawnElapsed += dt;
          if (s.spawnElapsed >= interval) {
            s.spawnElapsed -= interval;
            spawnOne();
          }
        }

        const fallDur = s.speedMode === 'slow' ? 7500 : 5200;
        let landed = null;
        for (const item of s.active) {
          item.progressY += dt / (item.fast ? 220 : fallDur);
          if (item.progressY >= 1 && !landed) {
            item.progressY = 1;
            landed = item;
          }
        }

        if (landed) {
          handleLand(landed);
        } else {
          setActiveCards([...s.active]);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const onKey = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveControlled(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveControlled(1);
      } else if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        triggerDrop();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKey);
    };
  }, [mode]);

  const controlled = getControlled();
  const activeLane = controlled ? controlled.lane : 0;
  const isFever = combo >= 5;
  const fieldH = fieldHeight;
  const cardH = Math.min(186, Math.max(108, Math.round(fieldH * 0.42)));

  function handleFieldPointerDown(e) {
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  }

  function handleFieldPointerUp(e) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) {
      moveControlled(dx > 0 ? 1 : -1);
    } else if (dy > 32 && Math.abs(dy) > Math.abs(dx)) {
      triggerDrop();
    }
  }

  return (
    <div className="focus-shell focus-shell--pastel-tetris">
      <DynamicIslandHUD
        progress={resolvedCount / ROUND_LENGTH}
        combo={combo}
        statusBanner={banner}
        onExit={onExit}
      />

      <div className="tetris-arena-hig">
        {/* Spawn Speed Slider (Left on Desktop, Compact Bar on Mobile/Tablet) */}
        <aside className="hig-module-card tetris-speed-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <Gauge size={15} strokeWidth={2.2} aria-hidden="true" />
            <span>Speed:</span>
            <span className="tabular-nums" style={{ fontSize: '0.95rem', fontWeight: 800, color: '#7A63C9' }}>
              {paceLevel}
            </span>
          </div>
          <div className="tetris-speed-panel__slider-wrap" style={{ width: '100%' }}>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={paceLevel}
              onChange={(e) => {
                setPaceLevel(Number(e.target.value));
                e.target.blur();
              }}
              style={{ width: '100%', accentColor: '#9B84E8', cursor: 'pointer' }}
              aria-label="Spawn speed 0 to 10"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>
          <motion.button
            type="button"
            className="btn-pill tetris-speed-panel__mode-btn"
            style={{ width: '100%', justifyContent: 'center' }}
            {...TAP_PROPS}
            onClick={() => {
              playTap();
              setSpeedMode((m) => (m === 'slow' ? 'normal' : 'slow'));
            }}
          >
            {speedMode === 'slow' ? 'Slow' : 'Normal'}
          </motion.button>
        </aside>

        {/* Pastel 3D Tetris Playfield + Buckets + Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', minInlineSize: 0 }}>
          <div className="tetris-board-frame">
            <div
              ref={playfieldRef}
              className={`tetris-playfield-hig ${isFever ? 'tetris-playfield-hig--fever' : ''}`}
              style={{ gridTemplateColumns: `repeat(${buckets.length}, 1fr)` }}
              onPointerDown={handleFieldPointerDown}
              onPointerUp={handleFieldPointerUp}
            >
              {buckets.map((verb, laneIdx) => (
                <button
                  key={verb}
                  type="button"
                  className={`tetris-lane-hig tetris-lane-hig--${laneIdx} ${
                    laneIdx === activeLane ? 'tetris-lane-hig--active' : ''
                  }`}
                  onClick={() => setControlledLane(laneIdx)}
                  aria-label={`Move to ${verb} lane`}
                />
              ))}

              {/* Stacked Pastel 3D Tetris Bricks showing resolved progress */}
              {resolvedCount > 0 && (
                <div className="tetris-pastel-stack" aria-hidden="true">
                  {Array.from({ length: resolvedCount * 2 }).map((_, i) => (
                    <span
                      key={i}
                      className="tetris-pastel-brick"
                      style={{ background: PASTEL_BLOCKS[i % PASTEL_BLOCKS.length] }}
                    />
                  ))}
                </div>
              )}

              {activeCards.map((item) => {
                const isCtrl = controlled?.uid === item.uid;
                const maxTop = Math.max(0, fieldH - cardH - 14);
                const topPx = item.progressY * maxTop;
                const leftPct = (item.lane + 0.5) * (100 / buckets.length);
                return (
                  <div
                    key={item.uid}
                    className={`tetris-falling-hig ${isCtrl ? 'tetris-falling-hig--controlled' : ''}`}
                    style={{
                      left: `${leftPct}%`,
                      height: `${cardH}px`,
                      transform: `translate(-50%, ${topPx}px)`,
                      background: item.pastelColor || '#DFD1FF'
                    }}
                  >
                    <span style={{ fontSize: 'clamp(0.62rem, 0.55rem + 0.35vw, 0.86rem)', fontWeight: 800, color: '#362F4B' }}>
                      {item.card.pronoun}
                    </span>
                    <img src={item.card.image} alt={item.card.pronoun} />
                  </div>
                );
              })}
            </div>

            {/* Pastel 3D Beveled Bottom Buckets */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${buckets.length}, 1fr)`, gap: '0.6rem' }}>
              {buckets.map((verb, idx) => (
                <button
                  key={verb}
                  type="button"
                  className={`tetris-bucket-hig tetris-bucket-hig--${idx} ${
                    idx === activeLane ? 'tetris-bucket-hig--active' : ''
                  } ${pulseBucket === idx ? 'tetris-bucket-hig--pulse' : ''}`}
                  onClick={() => setControlledLane(idx)}
                >
                  {verb}
                </button>
              ))}
            </div>
          </div>

          {/* Pastel 3D Thumb-Zone Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
            <motion.button type="button" className="btn-tactile tetris-pastel-btn" {...TAP_PROPS} onClick={() => moveControlled(-1)}>
              <ChevronLeft size={20} strokeWidth={2.2} /> Left
            </motion.button>
            <motion.button type="button" className="btn-tactile tetris-pastel-btn--drop" {...TAP_PROPS} onClick={triggerDrop}>
              <ArrowDown size={20} strokeWidth={2.2} /> Drop
            </motion.button>
            <motion.button type="button" className="btn-tactile tetris-pastel-btn" {...TAP_PROPS} onClick={() => moveControlled(1)}>
              Right <ChevronRight size={20} strokeWidth={2.2} />
            </motion.button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {phase === 'done' && (
          <RoundCompleteSheet
            title="Awesome Effort!"
            subtitle={`${score} nailed out of ${ROUND_LENGTH} pronoun drops!`}
            xpEarned={score * 10 + 15}
            nextLabel="Play Again"
            onNext={startNewRound}
            onDashboard={onExit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
