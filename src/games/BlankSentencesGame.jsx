import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DynamicIslandHUD from '../components/DynamicIslandHUD';
import RoundCompleteSheet from '../components/RoundCompleteSheet';
import { useEngagement } from '../context/EngagementContext';
import { SPRING_SNAPPY, TAP_PROPS } from '../utils/motion';
import { playCorrect, playNearMiss, playTap } from '../utils/sensory';

const AM_IS_ARE_LEVELS = {
  pronouns: [
    { text: 'I _____ with a cat.', answer: 'am' },
    { text: 'I _____ not sad.', answer: 'am' },
    { text: 'I _____ hot in the sun.', answer: 'am' },
    { text: 'He _____ wet, but not sad.', answer: 'is' },
    { text: 'She _____ on the bus.', answer: 'is' },
    { text: 'It _____ on the bed.', answer: 'is' },
    { text: 'It _____ in a web.', answer: 'is' },
    { text: 'We _____ hot in the sun.', answer: 'are' },
    { text: 'They _____ in the bus.', answer: 'are' },
    { text: 'You _____ with me.', answer: 'are' }
  ],
  subjects: [
    { text: 'The cat _____ in the bag.', answer: 'is' },
    { text: 'The dog _____ on the bed.', answer: 'is' },
    { text: 'The sun _____ hot.', answer: 'is' },
    { text: 'The bus _____ big.', answer: 'is' },
    { text: 'The bug _____ in the web.', answer: 'is' },
    { text: 'The pot _____ hot.', answer: 'is' },
    { text: 'One kid _____ before the sun.', answer: 'is' },
    { text: 'Ten kids _____ before the sun.', answer: 'are' },
    { text: 'The cat and dog _____ wet.', answer: 'are' },
    { text: 'The man and kid _____ on the bus.', answer: 'are' },
    { text: 'Two kids _____ in the mud.', answer: 'are' },
    { text: 'A red hat and a bag _____ on the bed.', answer: 'are' }
  ]
};

const HAVE_HAS_LEVELS = {
  pronouns: [
    { text: 'I _____ a cat.', answer: 'have' },
    { text: 'I _____ a red hat.', answer: 'have' },
    { text: 'I _____ a wet leg.', answer: 'have' },
    { text: 'You _____ a map.', answer: 'have' },
    { text: 'We _____ fun with the jam.', answer: 'have' },
    { text: 'They _____ a big bus.', answer: 'have' },
    { text: 'He _____ a big dog.', answer: 'has' },
    { text: 'She _____ a red pen.', answer: 'has' },
    { text: 'It _____ a wet leg.', answer: 'has' },
    { text: 'It _____ two zips.', answer: 'has' }
  ],
  subjects: [
    { text: 'The bag _____ two zips.', answer: 'has' },
    { text: 'The man _____ a map.', answer: 'has' },
    { text: 'The kid _____ a cup.', answer: 'has' },
    { text: 'The cat _____ a red hat.', answer: 'has' },
    { text: 'The dog _____ a wet leg.', answer: 'has' },
    { text: 'One kid _____ a pet.', answer: 'has' },
    { text: 'Ten kids _____ a pet.', answer: 'have' },
    { text: 'Two kids _____ a red pen.', answer: 'have' },
    { text: 'The man and kid _____ a map.', answer: 'have' },
    { text: 'The cat and dog _____ fun.', answer: 'have' }
  ]
};

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function BlankSentencesGame({ mode = 'am_is_are', onExit }) {
  const isAmIsAre = mode === 'am_is_are';
  const options = isAmIsAre ? ['am', 'is', 'are'] : ['have', 'has'];
  const levels = isAmIsAre ? AM_IS_ARE_LEVELS : HAVE_HAS_LEVELS;
  const grammarRule = isAmIsAre
    ? '"I" → am  |  "he, she, it" → is  |  "you, we, they" → are'
    : '"he, she, it" → has  |  "I, you, we, they" → have';

  const { awardXP, maybeTriggerMysteryChest } = useEngagement();
  const [levelKey, setLevelKey] = useState('pronouns');
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [wrong, setWrong] = useState([]);
  const [mistake, setMistake] = useState(false);
  const [solved, setSolved] = useState(false);
  const [banner, setBanner] = useState(null);
  const timerRef = useRef(null);

  function startLevel(key) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLevelKey(key);
    setQuestions(shuffle(levels[key]).slice(0, 10).map((q, i) => ({ ...q, uid: `${key}-${i}-${Math.random()}` })));
    setIdx(0);
    setScore(0);
    setCombo(0);
    setWrong([]);
    setMistake(false);
    setSolved(false);
    setBanner(null);
  }

  useEffect(() => {
    startLevel('pronouns');
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [mode]);

  const current = questions[idx];
  const isDone = questions.length > 0 && idx >= questions.length;

  function handlePick(choice) {
    if (solved || !current) return;
    if (choice === current.answer) {
      setSolved(true);
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      playCorrect(nextCombo);

      if (!mistake) {
        setScore((s) => s + 1);
        awardXP(12, 3);
      } else if (!current.isRepeat) {
        // Followed by the exact same sentence so learner practices it cleanly
        setQuestions((prev) => {
          const next = [...prev];
          next.splice(idx + 1, 0, { ...current, isRepeat: true, uid: `${current.uid}-rep` });
          return next;
        });
      }

      setBanner(nextCombo >= 3 ? { type: 'fire', text: '🔥 ON FIRE! 2x XP' } : null);
      timerRef.current = setTimeout(() => {
        const nextIdx = idx + 1;
        setIdx(nextIdx);
        setWrong([]);
        setMistake(false);
        setSolved(false);
        if (nextIdx >= questions.length) {
          maybeTriggerMysteryChest(false);
        }
      }, 750);
    } else {
      setCombo(0);
      setMistake(true);
      setWrong((prev) => (prev.includes(choice) ? prev : [...prev, choice]));
      playNearMiss();
      setBanner({ type: 'coach', text: grammarRule });
    }
  }

  return (
    <div className="focus-shell">
      <DynamicIslandHUD
        progress={questions.length > 0 ? idx / questions.length : 0}
        combo={combo}
        statusBanner={banner}
        onExit={onExit}
      />

      <div className="game-stage-container" style={{ justifyContent: 'space-between' }}>
        {/* 2-Level Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
          {[
            { id: 'pronouns', label: 'Level 1: Pronouns' },
            { id: 'subjects', label: 'Level 2: Subjects' }
          ].map((lvl) => (
            <motion.button
              key={lvl.id}
              type="button"
              className="btn-pill"
              style={
                levelKey === lvl.id
                  ? { background: 'var(--apple-blue)', color: '#FFF', borderColor: 'transparent' }
                  : {}
              }
              {...TAP_PROPS}
              onClick={() => {
                playTap();
                startLevel(lvl.id);
              }}
            >
              {lvl.label}
            </motion.button>
          ))}
        </div>

        {/* Vertical Swipe Sentence Card */}
        <AnimatePresence mode="wait">
          {current && !isDone && (
            <motion.div
              key={current.uid}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -30, opacity: 0 }}
              transition={SPRING_SNAPPY}
              className="story-card-hig"
              style={{ maxWidth: 680, textAlign: 'center', padding: '2.25rem 1.5rem' }}
            >
              <p style={{ margin: 0, fontSize: 'clamp(1.65rem, 3.2vw, 2.4rem)', fontWeight: 800, lineHeight: 1.45 }}>
                {current.text.split('_____')[0]}
                <span
                  style={{
                    display: 'inline-block',
                    minWidth: 96,
                    padding: '0.1rem 0.65rem',
                    marginInline: '0.25rem',
                    borderRadius: 12,
                    background: solved ? 'rgba(52, 199, 89, 0.2)' : 'rgba(0, 122, 255, 0.12)',
                    color: solved ? '#248A3D' : '#007AFF',
                    borderBottom: `4px solid ${solved ? '#34C759' : '#007AFF'}`
                  }}
                >
                  {solved ? current.answer : '_____'}
                </span>
                {current.text.split('_____')[1]}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thumb-Zone Pill Word Buttons */}
        <div className="thumb-bar glass-light" style={{ justifyContent: 'center', gap: '0.85rem' }}>
          {options.map((opt) => {
            const isRight = solved && current?.answer === opt;
            const isWrong = wrong.includes(opt);
            return (
              <motion.button
                key={opt}
                type="button"
                disabled={solved || isDone}
                className="btn-tactile btn-surface"
                animate={isWrong ? { x: [-5, 5, -4, 4, 0] } : { x: 0 }}
                {...TAP_PROPS}
                style={{
                  minWidth: 112,
                  flex: 1,
                  borderRadius: 9999,
                  fontSize: '1.3rem',
                  background: isRight
                    ? 'rgba(52, 199, 89, 0.2)'
                    : isWrong
                      ? 'rgba(255, 107, 107, 0.16)'
                      : '#FFFFFF',
                  border: `2.5px solid ${isRight ? '#34C759' : isWrong ? '#FF6B6B' : 'rgba(28,28,30,0.09)'}`
                }}
                onClick={() => handlePick(opt)}
              >
                {opt}
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {isDone && (
          <RoundCompleteSheet
            title={levelKey === 'pronouns' ? 'Level 1 Complete!' : 'Level 2 Complete!'}
            subtitle={`${score} nailed out of ${questions.length} sentences!`}
            xpEarned={score * 12 + 15}
            nextLabel={levelKey === 'pronouns' ? 'Next: Level 2 (Subjects)' : 'Play Again'}
            onNext={() => startLevel(levelKey === 'pronouns' ? 'subjects' : 'pronouns')}
            onDashboard={onExit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
