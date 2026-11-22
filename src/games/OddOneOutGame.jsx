import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import DynamicIslandHUD from '../components/DynamicIslandHUD';
import RoundCompleteSheet from '../components/RoundCompleteSheet';
import { useEngagement } from '../context/EngagementContext';
import { assetUrl } from '../utils/assets';
import { SPRING_SNAPPY, TAP_PROPS } from '../utils/motion';
import { playCardSwipe, playCorrect, playJackpot, playNearMiss, playTap } from '../utils/sensory';

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
  const [done, setDone] = useState(false);

  // Slot machine states
  const [leverPulled, setLeverPulled] = useState(false);
  const [spinningReels, setSpinningReels] = useState([false, false, false]);
  const [reelDisplay, setReelDisplay] = useState([null, null, null]);
  const [reelResults, setReelResults] = useState([null, null, null]); // null | 'gold' | 'red'
  const [phase, setPhase] = useState('placing'); // 'placing' | 'spinning' | 'evaluated'

  const slotRefs = useRef({});
  const timersRef = useRef([]);
  const intervalsRef = useRef([]);
  const didDragRef = useRef(false);

  const clearAllTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
    intervalsRef.current.forEach((id) => clearInterval(id));
    intervalsRef.current = [];
  };

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
      clearAllTimers();
    };
  }, []);

  function createRound(pool, nextRoundNum, setting) {
    clearAllTimers();
    const targets = shuffle(pool).slice(0, 3);
    const distractor = pickDistractor(targets, pool);
    const mode =
      setting === 'mixed'
        ? nextRoundNum % 2 === 1
          ? 'words-to-pictures'
          : 'pictures-to-words'
        : setting;

    const orderedTargets = shuffle(targets);
    setRound({
      mode,
      targets: orderedTargets,
      draggables: shuffle([...targets, distractor]),
      distractorId: distractor.id,
      placed: {}, // { [targetId]: draggableItem }
      mistake: false,
      completed: false
    });
    setReelDisplay(orderedTargets);
    setSpinningReels([false, false, false]);
    setReelResults([null, null, null]);
    setLeverPulled(false);
    setPhase('placing');
    setSelectedId(null);
    setBanner(null);
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

  function placeItemInSlot(dragId, targetId) {
    if (!round || phase !== 'placing') return;
    const item = round.draggables.find((d) => d.id === dragId);
    if (!item) return;

    playTap();
    setRound((prev) => {
      if (!prev) return prev;
      const nextPlaced = { ...prev.placed };
      // If this draggable was already in another slot, remove it from there
      for (const key of Object.keys(nextPlaced)) {
        if (nextPlaced[key]?.id === dragId) {
          delete nextPlaced[key];
        }
      }
      nextPlaced[targetId] = item;
      return { ...prev, placed: nextPlaced };
    });
    setSelectedId(null);
    setBanner(null);
  }

  function removeFromSlot(targetId) {
    if (!round || phase !== 'placing') return;
    if (!round.placed[targetId]) return;
    playTap();
    setRound((prev) => {
      if (!prev) return prev;
      const nextPlaced = { ...prev.placed };
      delete nextPlaced[targetId];
      return { ...prev, placed: nextPlaced };
    });
  }

  function handleDragEnd(itemId, point) {
    if (phase !== 'placing') return;
    for (const [tId, el] of Object.entries(slotRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) {
        placeItemInSlot(itemId, tId);
        return;
      }
    }
  }

  function pullHandle() {
    if (!round || phase !== 'placing') return;
    const placedCount = Object.keys(round.placed).length;
    if (placedCount < 3) {
      playNearMiss();
      setBanner({
        type: 'coach',
        text: `Fill all 3 slots first (${placedCount}/3), then pull the handle!`
      });
      return;
    }

    clearAllTimers();
    setPhase('spinning');
    setLeverPulled(true);
    setReelResults([null, null, null]);
    setBanner(null);
    setSpinningReels([true, true, true]);
    playCardSwipe();

    // Spring the handle back up after 320ms
    timersRef.current.push(
      setTimeout(() => {
        setLeverPulled(false);
      }, 320)
    );

    const spinPool = items.length >= 4 ? items : round.draggables;
    const stopTimes = [680, 960, 1240];

    // Spin each reel through random items from the pool, then land back on its target
    round.targets.forEach((target, reelIdx) => {
      const iv = setInterval(() => {
        const randItem = spinPool[Math.floor(Math.random() * spinPool.length)];
        setReelDisplay((prev) => {
          const next = [...prev];
          next[reelIdx] = randItem;
          return next;
        });
      }, 85);
      intervalsRef.current.push(iv);

      const stopTimer = setTimeout(() => {
        clearInterval(iv);
        playTap();
        setReelDisplay((prev) => {
          const next = [...prev];
          next[reelIdx] = target;
          return next;
        });
        setSpinningReels((prev) => {
          const next = [...prev];
          next[reelIdx] = false;
          return next;
        });
      }, stopTimes[reelIdx]);
      timersRef.current.push(stopTimer);
    });

    // Evaluate all 3 slots right after the 3rd reel lands back in place
    const evalTimer = setTimeout(() => {
      const results = round.targets.map((t) => {
        const placedItem = round.placed[t.id];
        return placedItem && placedItem.id === t.id ? 'gold' : 'red';
      });
      setReelResults(results);
      setPhase('evaluated');

      const allCorrect = results.every((r) => r === 'gold');
      if (allCorrect) {
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        playJackpot();
        const pts = round.mistake ? 5 : 10;
        setScore((s) => s + pts);
        awardXP(pts + 8, 4);
        setRound((prev) => (prev ? { ...prev, completed: true } : prev));
        setBanner(
          nextCombo >= 3
            ? { type: 'fire', text: 'JACKPOT! All 3 matched — 2x XP!' }
            : { type: 'fire', text: 'JACKPOT! All 3 matched!' }
        );
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#E6B400', '#FFE066', '#FFFFFF', '#007AFF']
        });

        timersRef.current.push(
          setTimeout(() => {
            if (roundNum >= TOTAL_ROUNDS) {
              setDone(true);
              incrementQuest('q-ooo', 1);
              maybeTriggerMysteryChest(false);
            } else {
              const next = roundNum + 1;
              setRoundNum(next);
              createRound(items, next, modeSetting);
            }
          }, 1500)
        );
      } else {
        setCombo(0);
        playNearMiss();
        setRound((prev) => (prev ? { ...prev, mistake: true } : prev));
        setBanner({
          type: 'coach',
          text: 'Red aura! Clearing all 3 slots — try again!'
        });

        // Show gold/red auras briefly, then reset all 3 slots so user starts over all 3
        timersRef.current.push(
          setTimeout(() => {
            setRound((prev) => (prev ? { ...prev, placed: {} } : prev));
            setReelResults([null, null, null]);
            setPhase('placing');
            setSelectedId(null);
          }, 1350)
        );
      }
    }, stopTimes[2] + 180);

    timersRef.current.push(evalTimer);
  }

  const placedIds = round ? Object.values(round.placed).map((item) => item.id) : [];
  const allThreeFilled = placedIds.length === 3;
  const isWin = phase === 'evaluated' && reelResults.every((r) => r === 'gold');
  const isFail = phase === 'evaluated' && reelResults.some((r) => r === 'red');

  return (
    <div className="focus-shell focus-shell--casino">
      <DynamicIslandHUD
        progress={done ? 1 : (roundNum - 1) / TOTAL_ROUNDS}
        combo={combo}
        statusBanner={banner}
        onExit={onExit}
      />

      <div className="game-stage-container" style={{ maxWidth: 960 }}>
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
                  ? {
                      background: 'linear-gradient(135deg, #F2BE22, #D49B00)',
                      color: '#2B1B00',
                      borderColor: 'rgba(255, 240, 180, 0.65)'
                    }
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
            {/* Apple Glass Casino Slot Machine */}
            <div className="slot-machine-wrap">
              <div className="slot-cabinet">
                <div className="slot-marquee">
                  <div className="slot-marquee__lights" aria-hidden="true">
                    {[0, 1, 2].map((b) => (
                      <span
                        key={b}
                        className={`slot-bulb ${
                          isWin
                            ? 'slot-bulb--win'
                            : isFail
                              ? 'slot-bulb--fail'
                              : allThreeFilled
                                ? 'slot-bulb--ready'
                                : ''
                        }`}
                      />
                    ))}
                  </div>
                  <span>ODD ONE OUT • ROUND {roundNum} / {TOTAL_ROUNDS}</span>
                  <div className="slot-marquee__lights" aria-hidden="true">
                    {[0, 1, 2].map((b) => (
                      <span
                        key={b}
                        className={`slot-bulb ${
                          isWin
                            ? 'slot-bulb--win'
                            : isFail
                              ? 'slot-bulb--fail'
                              : allThreeFilled
                                ? 'slot-bulb--ready'
                                : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* 3 Slot Machine Reels */}
                <div className="slot-reels-bezel">
                  {round.targets.map((target, idx) => {
                    const placedItem = round.placed[target.id];
                    const shownItem = reelDisplay[idx] || target;
                    const isSpinning = spinningReels[idx];
                    const result = reelResults[idx]; // null | 'gold' | 'red'

                    return (
                      <div
                        key={target.id}
                        ref={(el) => {
                          slotRefs.current[target.id] = el;
                        }}
                        className={`slot-reel ${
                          result === 'gold' ? 'slot-reel--gold' : result === 'red' ? 'slot-reel--red' : ''
                        }`}
                        onClick={() => {
                          if (phase !== 'placing') return;
                          if (selectedId) {
                            placeItemInSlot(selectedId, target.id);
                          } else if (placedItem) {
                            removeFromSlot(target.id);
                          }
                        }}
                      >
                        {/* Spinning Reel Window */}
                        <div className={`slot-reel-window ${isSpinning ? 'slot-reel-window--spinning' : ''}`}>
                          {round.mode === 'words-to-pictures' ? (
                            <img
                              src={shownItem.image}
                              alt={shownItem.word}
                              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                          ) : (
                            <span
                              className="slot-reel-word"
                              style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}
                            >
                              {shownItem.word}
                            </span>
                          )}
                        </div>

                        {/* Placed Word / Picture Drop Slot */}
                        <button
                          type="button"
                          className={`slot-drop-box ${placedItem ? 'slot-drop-box--filled' : ''} ${
                            result === 'gold'
                              ? 'slot-drop-box--gold'
                              : result === 'red'
                                ? 'slot-drop-box--red'
                                : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (phase !== 'placing') return;
                            if (selectedId) {
                              placeItemInSlot(selectedId, target.id);
                            } else if (placedItem) {
                              removeFromSlot(target.id);
                            }
                          }}
                        >
                          {placedItem ? (
                            round.mode === 'words-to-pictures' ? (
                              <span>
                                {placedItem.word}
                                {result === 'gold' ? ' ✓' : result === 'red' ? ' ✕' : ''}
                              </span>
                            ) : (
                              <img
                                src={placedItem.image}
                                alt={placedItem.word}
                                style={{ height: 42, maxWidth: '100%', objectFit: 'contain' }}
                              />
                            )
                          ) : (
                            <span>{round.mode === 'words-to-pictures' ? 'Drop word' : 'Drop picture'}</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Casino Lever Handle */}
              <div className="slot-handle-mount">
                <button
                  type="button"
                  className="slot-handle-btn"
                  disabled={phase !== 'placing'}
                  onClick={pullHandle}
                  aria-label="Pull slot machine handle to spin"
                >
                  <div className="slot-handle-socket" aria-hidden="true" />
                  <div className="slot-lever-rig">
                    <div
                      className={`slot-lever-knob ${allThreeFilled && phase === 'placing' ? 'slot-lever-knob--ready' : ''} ${
                        leverPulled ? 'slot-lever-knob--pulled' : ''
                      }`}
                    >
                      PULL
                    </div>
                    <div className={`slot-lever-shaft ${leverPulled ? 'slot-lever-shaft--pulled' : ''}`} />
                  </div>
                </button>
                <span className="slot-handle-caption">
                  {phase === 'spinning' ? 'Spinning…' : allThreeFilled ? 'Pull Handle' : `${placedIds.length}/3 Filled`}
                </span>
              </div>
            </div>

            {/* 4 Draggable Items Tray */}
            <div
              className="slot-tray-dark"
              style={{
                borderRadius: 24,
                padding: '0.9rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: '0.75rem'
              }}
            >
              {round.draggables.map((item) => {
                const isPlaced = placedIds.includes(item.id);
                const isOddFinale = round.completed && !isPlaced && item.id === round.distractorId;
                const isSelected = selectedId === item.id;

                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    disabled={isPlaced || phase !== 'placing'}
                    drag={!isPlaced && phase === 'placing'}
                    dragSnapToOrigin
                    onDragStart={() => {
                      didDragRef.current = true;
                      playCardSwipe();
                    }}
                    onDragEnd={(_, info) => {
                      setTimeout(() => {
                        didDragRef.current = false;
                      }, 60);
                      handleDragEnd(item.id, info.point);
                    }}
                    whileDrag={{ scale: 1.08, zIndex: 40 }}
                    transition={SPRING_SNAPPY}
                    onClick={() => {
                      if (didDragRef.current || isPlaced || phase !== 'placing') return;
                      playTap();
                      setSelectedId(isSelected ? null : item.id);
                    }}
                    style={{
                      background: isOddFinale ? 'rgba(255, 249, 219, 0.95)' : 'rgba(255, 255, 255, 0.84)',
                      border: `2px solid ${
                        isOddFinale
                          ? '#E6B400'
                          : isSelected
                            ? 'var(--apple-blue)'
                            : 'rgba(255, 255, 255, 0.95)'
                      }`,
                      borderRadius: 18,
                      padding: round.mode === 'words-to-pictures' ? '0.85rem 0.5rem' : '0.45rem',
                      minHeight: round.mode === 'words-to-pictures' ? 68 : 140,
                      opacity: isPlaced ? 0.25 : 1,
                      cursor: isPlaced || phase !== 'placing' ? 'default' : 'grab',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      fontSize: '1.15rem',
                      color: 'var(--text-primary)',
                      touchAction: 'none',
                      boxShadow: isOddFinale
                        ? '0 0 22px rgba(230, 180, 0, 0.4)'
                        : '0 0 0 1px rgba(15, 23, 42, 0.05), var(--shadow-ambient)'
                    }}
                  >
                    {round.mode === 'words-to-pictures' ? (
                      <span>{item.word}</span>
                    ) : (
                      <img
                        src={item.image}
                        alt={item.word}
                        draggable={false}
                        style={{ maxWidth: '100%', maxHeight: 112, objectFit: 'contain', pointerEvents: 'none' }}
                      />
                    )}
                    {isOddFinale && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.18rem 0.55rem',
                          borderRadius: 999,
                          background: '#E6B400',
                          color: '#FFFFFF'
                        }}
                      >
                        ✨ Odd One Out!
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
            subtitle={`Jackpot! You scored ${score} / ${TOTAL_ROUNDS * 10} points.`}
            xpEarned={score + 20}
            nextLabel="Play 10 More"
            onNext={() => startSession(modeSetting)}
            onDashboard={onExit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
