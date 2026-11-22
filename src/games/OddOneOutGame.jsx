import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DynamicIslandHUD from '../components/DynamicIslandHUD';
import RoundCompleteSheet from '../components/RoundCompleteSheet';
import { useEngagement } from '../context/EngagementContext';
import { assetUrl } from '../utils/assets';
import { SPRING_SNAPPY, SPRING_BOUNCY, TAP_PROPS } from '../utils/motion';
import { playCardSwipe, playCorrect, playNearMiss, playTap } from '../utils/sensory';

const TOTAL_ROUNDS = 10;

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickDistractor(targets, pool) {
  const ids = new Set(targets.map((t) => t.id));
  const cands = pool.filter((i) => !ids.has(i.id));
  const vowels = new Set(targets.map((t) => t.vowel).filter(Boolean));
  const cats = new Set(targets.map((t) => t.category).filter(Boolean));
  const smart = cands.filter((c) => (c.vowel && vowels.has(c.vowel)) || cats.has(c.category));
  const list = smart.length > 0 ? smart : cands;
  return list[Math.floor(Math.random() * list.length)];
}

export default function OddOneOutGame({ onExit }) {
  const { awardXP, incrementQuest, maybeTriggerMysteryChest } = useEngagement();
  const [items, setItems] = useState([]);
  const [modeSetting, setModeSetting] = useState('mixed'); // 'mixed' | 'words-to-pictures' | 'pictures-to-words'
  const [roundNum, setRoundNum] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [banner, setBanner] = useState(null);
  const [round, setRound] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [wrongFlash, setWrongFlash] = useState(null);
  const [done, setDone] = useState(false);

  const slotRefs = useRef({});
  const timerRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetch(assetUrl('odd_one_out_items.json'))
      .then((r) => r.json())
      .then((data) => {
        if (!active || !Array.isArray(data)) return;
        const normalized = data.map((d) => ({ ...d, image: assetUrl(d.image) }));
        setItems(normalized);
        createRound(normalized, 1, 'mixed');
      })
      .catch(() => {});
    return () => {
      active = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function createRound(pool, nextRoundNum, setting) {
    if (timerRef.current) clearTimeout(timerRef.current);
    const targets = shuffle(pool).slice(0, 3);
    const distractor = pickDistractor(targets, pool);
    const mode =
      setting === 'mixed'
        ? nextRoundNum % 2 === 1
          ? 'words-to-pictures'
          : 'pictures-to-words'
        : setting;

    setRound({
      mode,
      targets: shuffle(targets),
      draggables: shuffle([...targets, distractor]),
      distractorId: distractor.id,
      matched: {},
      placedIds: [],
      mistake: false,
      completed: false
    });
    setSelectedId(null);
    setWrongFlash(null);
  }

  function startSession(nextMode = modeSetting) {
    setModeSetting(nextMode);
    setRoundNum(1);
    setScore(0);
    setCombo(0);
    setBanner(null);
    setDone(false);
    if (items.length >= 4) createRound(items, 1, nextMode);
  }

  function tryMatch(dragId, targetId) {
    if (!round || round.completed) return;
    if (round.matched[targetId] || round.placedIds.includes(dragId)) return;

    if (dragId === targetId) {
      const item = round.draggables.find((d) => d.id === dragId);
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      playCorrect(nextCombo);
      const nextMatched = { ...round.matched, [targetId]: item };
      const nextPlaced = [...round.placedIds, dragId];
      const allDone = Object.keys(nextMatched).length === 3;

      setRound({
        ...round,
        matched: nextMatched,
        placedIds: nextPlaced,
        completed: allDone
      });
      setSelectedId(null);
      setBanner(nextCombo >= 3 ? { type: 'fire', text: '🔥 ON FIRE! 2x XP' } : null);

      if (allDone) {
        const pts = round.mistake ? 5 : 10;
        setScore((s) => s + pts);
        awardXP(pts + 5, 3);

        timerRef.current = setTimeout(() => {
          if (roundNum >= TOTAL_ROUNDS) {
            setDone(true);
            incrementQuest('q-ooo', 1);
            maybeTriggerMysteryChest(false);
          } else {
            const next = roundNum + 1;
            setRoundNum(next);
            createRound(items, next, modeSetting);
          }
        }, 1200);
      }
    } else {
      setCombo(0);
      playNearMiss();
      setRound({ ...round, mistake: true });
      setWrongFlash({ dragId, targetId });
      setSelectedId(null);
      setBanner({ type: 'coach', text: 'Not quite! Try matching to another picture or word.' });
      setTimeout(() => setWrongFlash(null), 420);
    }
  }

  function handleDragEnd(itemId, point) {
    for (const [tId, el] of Object.entries(slotRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) {
        tryMatch(itemId, tId);
        return;
      }
    }
  }

  return (
    <motion.div layoutId="module-card-odd-one-out" className="focus-shell">
      <DynamicIslandHUD
        progress={done ? 1 : (roundNum - 1) / TOTAL_ROUNDS}
        combo={combo}
        statusBanner={banner}
        onExit={onExit}
      />

      <div className="game-stage-container">
        {/* Mode Switcher */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'mixed', label: 'Mixed (Both)' },
            { id: 'words-to-pictures', label: '4 Words → 3 Pictures' },
            { id: 'pictures-to-words', label: '4 Pictures → 3 Words' }
          ].map((m) => (
            <motion.button
              key={m.id}
              type="button"
              className="btn-pill"
              style={
                modeSetting === m.id
                  ? { background: 'var(--apple-blue)', color: '#FFF', borderColor: 'transparent' }
                  : {}
              }
              {...TAP_PROPS}
              onClick={() => {
                playTap();
                startSession(m.id);
              }}
            >
              {m.label}
            </motion.button>
          ))}
        </div>

        {round && (
          <>
            {/* 3 Target Drop Zones */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '0.85rem'
              }}
            >
              {round.targets.map((t) => {
                const matched = round.matched[t.id];
                const isWrong = wrongFlash?.targetId === t.id;
                return (
                  <motion.button
                    key={t.id}
                    ref={(el) => {
                      slotRefs.current[t.id] = el;
                    }}
                    type="button"
                    animate={{
                      opacity: round.completed ? 0.55 : 1,
                      x: isWrong ? [-5, 5, -4, 4, 0] : 0
                    }}
                    transition={SPRING_SNAPPY}
                    onClick={() => {
                      if (selectedId && !matched) tryMatch(selectedId, t.id);
                    }}
                    style={{
                      background: matched ? 'rgba(52, 199, 89, 0.14)' : '#FFFFFF',
                      border: `2.5px solid ${
                        matched ? '#34C759' : isWrong ? '#FF6B6B' : 'rgba(28, 28, 30, 0.09)'
                      }`,
                      borderRadius: 22,
                      padding: '0.75rem',
                      boxShadow: 'var(--shadow-ambient)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.6rem',
                      cursor: 'pointer',
                      fontFamily: 'inherit'
                    }}
                  >
                    {round.mode === 'words-to-pictures' ? (
                      <>
                        <div
                          style={{
                            width: '100%',
                            height: 175,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--bg-subtle)',
                            borderRadius: 16,
                            padding: 6,
                            overflow: 'hidden'
                          }}
                        >
                          <img
                            src={t.image}
                            alt={t.word}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                        </div>
                        <div
                          style={{
                            width: '100%',
                            minHeight: 46,
                            borderRadius: 12,
                            border: '2px dashed rgba(28,28,30,0.16)',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 800,
                            color: matched ? '#248A3D' : 'var(--text-muted)'
                          }}
                        >
                          {matched ? `${matched.word} ✓` : 'Drop word'}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, padding: '0.3rem 0' }}>{t.word}</div>
                        <div
                          style={{
                            width: '100%',
                            height: 150,
                            borderRadius: 14,
                            border: '2px dashed rgba(28,28,30,0.16)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 6,
                            overflow: 'hidden'
                          }}
                        >
                          {matched ? (
                            <img
                              src={matched.image}
                              alt={matched.word}
                              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.88rem' }}>
                              Drop picture
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* 4 Draggable Items Tray */}
            <div
              className="glass-light"
              style={{
                borderRadius: 24,
                padding: '0.9rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: '0.75rem'
              }}
            >
              {round.draggables.map((item) => {
                const isPlaced = round.placedIds.includes(item.id);
                const isOddFinale = round.completed && !isPlaced && item.id === round.distractorId;
                const isSelected = selectedId === item.id;
                const isWrong = wrongFlash?.dragId === item.id;

                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    disabled={isPlaced}
                    drag={!isPlaced && !round.completed}
                    dragSnapToOrigin
                    onDragStart={() => playCardSwipe()}
                    onDragEnd={(_, info) => handleDragEnd(item.id, info.point)}
                    whileDrag={{ scale: 1.12, rotate: 2, zIndex: 40 }}
                    animate={
                      isOddFinale
                        ? { scale: 1.12, y: -6 }
                        : isWrong
                          ? { x: [-5, 5, -4, 4, 0] }
                          : { scale: 1, y: 0 }
                    }
                    transition={isOddFinale ? SPRING_BOUNCY : SPRING_SNAPPY}
                    onClick={() => {
                      if (!isPlaced && !round.completed) {
                        playTap();
                        setSelectedId(isSelected ? null : item.id);
                      }
                    }}
                    style={{
                      background: isOddFinale ? '#FFF9DB' : '#FFFFFF',
                      border: `2.5px solid ${
                        isOddFinale
                          ? '#FFCC00'
                          : isSelected
                            ? '#007AFF'
                            : isWrong
                              ? '#FF6B6B'
                              : 'rgba(28, 28, 30, 0.1)'
                      }`,
                      borderRadius: 18,
                      padding: round.mode === 'words-to-pictures' ? '0.85rem 0.5rem' : '0.45rem',
                      minHeight: round.mode === 'words-to-pictures' ? 70 : 155,
                      opacity: isPlaced ? 0.2 : 1,
                      cursor: isPlaced ? 'default' : 'grab',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      fontFamily: 'inherit',
                      fontWeight: 800,
                      fontSize: '1.2rem',
                      touchAction: 'none',
                      boxShadow: isOddFinale ? '0 10px 26px rgba(255, 204, 0, 0.4)' : 'var(--shadow-ambient)'
                    }}
                  >
                    {round.mode === 'words-to-pictures' ? (
                      <span>{item.word}</span>
                    ) : (
                      <img
                        src={item.image}
                        alt={item.word}
                        draggable={false}
                        style={{ maxWidth: '100%', maxHeight: 125, objectFit: 'contain', pointerEvents: 'none' }}
                      />
                    )}
                    {isOddFinale && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.55rem',
                          borderRadius: 999,
                          background: '#FF9500',
                          color: '#FFFFFF'
                        }}
                      >
                        ✨ The Odd One Out!
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {done && (
          <RoundCompleteSheet
            title="All 10 Rounds Complete!"
            subtitle={`Awesome matching! You scored ${score} / ${TOTAL_ROUNDS * 10} points.`}
            xpEarned={score + 20}
            nextLabel="Play 10 More"
            onNext={() => startSession(modeSetting)}
            onDashboard={onExit}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
