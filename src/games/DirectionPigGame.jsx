import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import DynamicIslandHUD from '../components/DynamicIslandHUD';
import RoundCompleteSheet from '../components/RoundCompleteSheet';
import { useEngagement, loadDirectionPigSrs } from '../context/EngagementContext';
import { assetUrl } from '../utils/assets';
import { SPRING_SNAPPY, TAP_PROPS } from '../utils/motion';
import { playCorrect, playNearMiss, playTap } from '../utils/sensory';

const SRS_KEY = 'phonix_direction_pig_srs_v1';

const DIRECTION_ITEMS = [
  { id: 'before_infront', image: 'directions/pig_before_infront.jpeg', label: 'before / in front' },
  { id: 'behind', image: 'directions/pig_behind.jpeg', label: 'behind / after' },
  { id: 'down', image: 'directions/pig_down.jpeg', label: 'down' },
  { id: 'in_inside', image: 'directions/pig_in_inside.jpeg', label: 'in / inside' },
  { id: 'left', image: 'directions/pig_left.jpeg', label: 'left' },
  { id: 'next_by', image: 'directions/pig_next_by.jpeg', label: 'next to / by' },
  { id: 'on', image: 'directions/pig_on.jpeg', label: 'on' },
  { id: 'right', image: 'directions/pig_right.jpeg', label: 'right' },
  { id: 'under', image: 'directions/pig_under.jpeg', label: 'under' },
  { id: 'up', image: 'directions/pig_up.jpeg', label: 'up' }
];

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQ(target, mode, isBonusRecall = false) {
  const others = shuffle(DIRECTION_ITEMS.filter((i) => i.id !== target.id)).slice(0, 2);
  return {
    uid: `${target.id}-${mode}-${Math.random().toString(36).slice(2, 7)}`,
    target,
    options: shuffle([target, ...others]),
    mode,
    isBonusRecall
  };
}

export default function DirectionPigGame({ onExit }) {
  const { awardXP, incrementQuest, maybeTriggerMysteryChest, announce } = useEngagement();
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [wrongIds, setWrongIds] = useState([]);
  const [hadMistake, setHadMistake] = useState(false);
  const [solved, setSolved] = useState(false);
  const [banner, setBanner] = useState(null);
  const recallsRef = useRef({});
  const timerRef = useRef(null);

  const speechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  function startSession() {
    if (timerRef.current) clearTimeout(timerRef.current);
    recallsRef.current = {};
    const srs = loadDirectionPigSrs();
    const ordered = shuffle(DIRECTION_ITEMS).sort((a, b) => {
      const sa = srs[a.id]?.streak ?? 0;
      const sb = srs[b.id]?.streak ?? 0;
      if (sa !== sb) return sa - sb;
      return (srs[b.id]?.lapses ?? 0) - (srs[a.id]?.lapses ?? 0);
    });
    const initial = ordered.map((t, i) =>
      buildQ(t, i % 2 === 0 ? 'picture-to-word' : 'word-to-picture', false)
    );
    setQueue(initial);
    setIdx(0);
    setScore(0);
    setCombo(0);
    setWrongIds([]);
    setHadMistake(false);
    setSolved(false);
    setBanner(null);

    // Preload all 10 images
    DIRECTION_ITEMS.forEach((item) => {
      const pre = new Image();
      pre.src = assetUrl(item.image);
    });
  }

  useEffect(() => {
    startSession();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (speechSupported) window.speechSynthesis.cancel();
    };
  }, []);

  const current = queue[idx];
  const isFinished = queue.length > 0 && idx >= queue.length;

  useEffect(() => {
    if (current?.isBonusRecall) {
      setBanner({ type: 'bonus', text: '⚡ Bonus Recall — 2x XP!' });
    } else if (combo >= 3) {
      setBanner({ type: 'fire', text: '🔥 ON FIRE! 2x XP' });
    } else {
      setBanner(null);
    }
  }, [idx, current?.isBonusRecall]);

  function saveSrs(itemId, isCorrect) {
    const srs = loadDirectionPigSrs();
    const prev = srs[itemId] || { streak: 0, lapses: 0 };
    srs[itemId] = isCorrect
      ? { streak: prev.streak + 1, lapses: prev.lapses, lastSeen: Date.now() }
      : { streak: 0, lapses: prev.lapses + 1, lastSeen: Date.now() };
    try {
      localStorage.setItem(SRS_KEY, JSON.stringify(srs));
    } catch {
      // Ignore
    }
  }

  function handlePick(opt) {
    if (solved || !current) return;

    if (opt.id === current.target.id) {
      setSolved(true);
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      playCorrect(nextCombo);
      incrementQuest('q-pig', 1);

      if (!hadMistake) {
        setScore((s) => s + 1);
        saveSrs(current.target.id, true);
        awardXP(current.isBonusRecall ? 20 : 10, 2);
      } else {
        awardXP(5, 1);
      }

      announce(`Correct! ${current.target.label}`);
      timerRef.current = setTimeout(() => {
        const nextIdx = idx + 1;
        setIdx(nextIdx);
        setWrongIds([]);
        setHadMistake(false);
        setSolved(false);
        if (nextIdx >= queue.length) {
          maybeTriggerMysteryChest(false);
        }
      }, 620);
    } else {
      setCombo(0);
      playNearMiss();
      setWrongIds((prev) => (prev.includes(opt.id) ? prev : [...prev, opt.id]));

      if (!hadMistake) {
        setHadMistake(true);
        saveSrs(current.target.id, false);
        const flippedMode = current.mode === 'picture-to-word' ? 'word-to-picture' : 'picture-to-word';

        setQueue((prev) => {
          const next = [...prev];
          // 1. Immediate opposite-mode flip next
          next.splice(idx + 1, 0, buildQ(current.target, flippedMode, true));
          // 2. Spaced-repetition active recall 3 questions later (max 2 per item)
          const count = recallsRef.current[current.target.id] || 0;
          if (count < 2) {
            recallsRef.current[current.target.id] = count + 1;
            const spacedIdx = Math.min(next.length, idx + 4);
            next.splice(spacedIdx, 0, buildQ(current.target, count % 2 === 0 ? current.mode : flippedMode, true));
          }
          return next;
        });
      }
      setBanner({ type: 'coach', text: 'Almost! Look closely and try again.' });
    }
  }

  const progress = queue.length > 0 ? idx / queue.length : 0;

  return (
    <motion.div layoutId="module-card-direction-pig" className="focus-shell">
      <DynamicIslandHUD progress={progress} combo={combo} statusBanner={banner} onExit={onExit} />

      <div className="game-stage-container" style={{ justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          {current && !isFinished && (
            <motion.div
              key={current.uid}
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -28, opacity: 0 }}
              transition={{ ...SPRING_SNAPPY, duration: 0.18 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.15rem', width: '100%' }}
            >
              {/* Clean Prompt Card (no extra instructions) */}
              <div className="story-card-hig" style={{ maxWidth: 540, alignItems: 'center', textAlign: 'center' }}>
                {current.mode === 'picture-to-word' ? (
                  <div className="story-img-frame" style={{ maxWidth: 320, aspectRatio: '1 / 1' }}>
                    <img src={assetUrl(current.target.image)} alt="Direction Pig" loading="eager" />
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
                    <span style={{ fontSize: 'clamp(1.8rem, 3.6vw, 2.5rem)', fontWeight: 800 }}>
                      {current.target.label}
                    </span>
                    {speechSupported && (
                      <motion.button
                        type="button"
                        className="btn-pill"
                        {...TAP_PROPS}
                        onClick={() => {
                          playTap();
                          window.speechSynthesis.cancel();
                          const u = new SpeechSynthesisUtterance(current.target.label.replaceAll('/', ' or '));
                          u.lang = 'en-US';
                          window.speechSynthesis.speak(u);
                        }}
                        aria-label="Hear direction"
                      >
                        <Volume2 size={18} strokeWidth={2.2} />
                      </motion.button>
                    )}
                  </div>
                )}
              </div>

              {/* 3 Shuffled Choices */}
              <div
                style={{
                  width: '100%',
                  maxWidth: current.mode === 'picture-to-word' ? 580 : 760,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '0.8rem'
                }}
              >
                {current.options.map((opt) => {
                  const isRight = solved && opt.id === current.target.id;
                  const isWrong = wrongIds.includes(opt.id);
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      disabled={solved}
                      className="btn-tactile btn-surface"
                      animate={isWrong ? { x: [-5, 5, -4, 4, 0] } : { x: 0 }}
                      transition={SPRING_SNAPPY}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.94 }}
                      style={{
                        minHeight: current.mode === 'picture-to-word' ? 66 : 160,
                        padding: current.mode === 'picture-to-word' ? '0.85rem' : '0.45rem',
                        fontSize: '1.15rem',
                        borderRadius: 20,
                        background: isRight
                          ? 'rgba(52, 199, 89, 0.2)'
                          : isWrong
                            ? 'rgba(255, 107, 107, 0.16)'
                            : '#FFFFFF',
                        border: `2.5px solid ${isRight ? '#34C759' : isWrong ? '#FF6B6B' : 'rgba(28,28,30,0.08)'}`
                      }}
                      onClick={() => handlePick(opt)}
                    >
                      {current.mode === 'picture-to-word' ? (
                        opt.label
                      ) : (
                        <img
                          src={assetUrl(opt.image)}
                          alt={opt.label}
                          style={{ maxWidth: '100%', maxHeight: 145, objectFit: 'contain', borderRadius: 12 }}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isFinished && (
          <RoundCompleteSheet
            title="Awesome Recall!"
            subtitle={`${score} nailed on the first try across ${queue.length} cards!`}
            xpEarned={score * 10 + 15}
            nextLabel="Next Challenge"
            onNext={startSession}
            onDashboard={onExit}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
