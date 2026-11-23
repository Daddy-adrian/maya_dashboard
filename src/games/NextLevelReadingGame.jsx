import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, ArrowRight, ArrowLeft, Check, Lock } from 'lucide-react';
import DynamicIslandHUD from '../components/DynamicIslandHUD';
import RoundCompleteSheet from '../components/RoundCompleteSheet';
import { useEngagement } from '../context/EngagementContext';
import { assetUrl } from '../utils/assets';
import { SPRING_SNAPPY, TAP_PROPS } from '../utils/motion';
import { playCorrect, playNearMiss, playTap, playPageTurn, setMusicDucked } from '../utils/sensory';
import { useGameMusic } from '../utils/useGameMusic';
import rawData from '../../stories/next_level_reading_stories.json';

const ACCESS_CODE = '1607';
const LETTERS = ['A', 'B', 'C'];

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomizeQuestions(list) {
  if (!Array.isArray(list)) return [];
  return list.map((q) => {
    const indexed = q.options.map((text, i) => ({ text, isCorrect: i === q.correctIndex }));
    const mixed = shuffle(indexed);
    return {
      ...q,
      options: mixed.map((m) => m.text),
      correctIndex: mixed.findIndex((m) => m.isCorrect)
    };
  });
}

function buildOrderedStories() {
  const arr = Array.isArray(rawData?.stories) ? rawData.stories : [];
  return [...arr]
    .filter((story) => story.id !== 11)
    .sort((a, b) => a.id - b.id)
    .map((story, index) => ({
      ...story,
      displayNum: index + 1,
      imagePath: `next_level_story_images/${story.id}.jpeg`,
      setA: randomizeQuestions(story.setA),
      setB: randomizeQuestions(story.setB)
    }));
}

function createEmptyQuiz(story) {
  const makeSetState = (qs) =>
    (qs || []).map(() => ({ solved: false, wrong: [], mistake: false }));
  return {
    setA: makeSetState(story?.setA),
    setB: makeSetState(story?.setB)
  };
}

export default function NextLevelReadingGame({ onExit }) {
  useGameMusic('story');
  const { awardXP, incrementQuest, maybeTriggerMysteryChest, announce } = useEngagement();

  // Passcode gate (1607)
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const [stories] = useState(buildOrderedStories);
  const [completedIds, setCompletedIds] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [step, setStep] = useState('story'); // 'story' | 'setA' | 'setB'
  const [direction, setDirection] = useState(1);
  const [activeSentence, setActiveSentence] = useState(-1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [combo, setCombo] = useState(0);
  const [banner, setBanner] = useState(null);
  const [quiz, setQuiz] = useState(() => createEmptyQuiz(stories[0]));
  const [showComplete, setShowComplete] = useState(false);

  const speakingRef = useRef(false);
  const speechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  // Preload next comic image in the background
  useEffect(() => {
    const next = stories[currentIdx + 1];
    if (next?.imagePath) {
      const img = new Image();
      img.src = assetUrl(next.imagePath);
    }
  }, [stories, currentIdx]);

  function stopSpeech() {
    speakingRef.current = false;
    setIsSpeaking(false);
    setActiveSentence(-1);
    setMusicDucked(false);
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
  }

  function handleUnlockSubmit(e) {
    e.preventDefault();
    if (pin.trim() === ACCESS_CODE) {
      playCorrect(3);
      setUnlocked(true);
      setPinError('');
    } else {
      playNearMiss();
      setPinError('Incorrect code. Try again.');
      setPin('');
    }
  }

  function selectStory(idx) {
    if (idx < 0 || idx >= stories.length) return;
    stopSpeech();
    playPageTurn();
    setDirection(idx >= currentIdx ? 1 : -1);
    setCurrentIdx(idx);
    setStep('story');
    setShowComplete(false);
    setBanner(null);
    setQuiz(createEmptyQuiz(stories[idx]));
  }

  function goToStep(nextStep) {
    stopSpeech();
    playPageTurn();
    const order = { story: 0, setA: 1, setB: 2 };
    setDirection(order[nextStep] >= order[step] ? 1 : -1);
    setStep(nextStep);
    setBanner(null);
  }

  function toggleReadAloud(story) {
    if (!speechSupported) return;
    if (isSpeaking) {
      stopSpeech();
      return;
    }
    window.speechSynthesis.cancel();
    speakingRef.current = true;
    setIsSpeaking(true);
    setMusicDucked(true);

    let idx = 0;
    const speakNext = () => {
      if (!speakingRef.current || idx >= story.sentences.length) {
        stopSpeech();
        return;
      }
      setActiveSentence(idx);
      const utter = new SpeechSynthesisUtterance(story.sentences[idx]);
      utter.lang = 'en-US';
      utter.rate = 0.88;
      utter.onend = () => {
        idx += 1;
        speakNext();
      };
      utter.onerror = () => stopSpeech();
      window.speechSynthesis.speak(utter);
    };
    speakNext();
  }

  function handleAnswer(setKey, qIdx, question, optIdx) {
    const qState = quiz[setKey][qIdx];
    if (!qState || qState.solved) return;

    if (optIdx === question.correctIndex) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      playCorrect(nextCombo);

      const nextSet = quiz[setKey].map((item, i) =>
        i === qIdx ? { ...item, solved: true } : item
      );
      const nextQuiz = { ...quiz, [setKey]: nextSet };
      setQuiz(nextQuiz);

      setBanner(nextCombo >= 3 ? { type: 'fire', text: '🔥 ON FIRE! 2x XP' } : null);
      announce('Correct!');

      const allASolved = nextQuiz.setA.every((x) => x.solved);
      const allBSolved = nextQuiz.setB.every((x) => x.solved);
      if (allASolved && allBSolved) {
        const hadMistake = [...nextQuiz.setA, ...nextQuiz.setB].some((x) => x.mistake);
        setCompletedIds((prev) => ({ ...prev, [stories[currentIdx].id]: true }));
        awardXP(hadMistake ? 30 : 50, 12);
        incrementQuest('q-story', 1);
        maybeTriggerMysteryChest(false);
        setShowComplete(true);
      }
    } else {
      setCombo(0);
      playNearMiss();
      const nextSet = quiz[setKey].map((item, i) =>
        i === qIdx
          ? {
              ...item,
              mistake: true,
              wrong: item.wrong.includes(optIdx) ? item.wrong : [...item.wrong, optIdx]
            }
          : item
      );
      setQuiz({ ...quiz, [setKey]: nextSet });
      setBanner({ type: 'coach', text: 'Almost! Think back to the story and try another choice.' });
      announce('Almost! Try another choice.');
    }
  }

  // Passcode Lock Screen
  if (!unlocked) {
    return (
      <div className="focus-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <DynamicIslandHUD progress={0} combo={0} statusBanner={null} onExit={onExit} />
        <div className="story-card-hig" style={{ maxWidth: 420, textAlign: 'center', alignItems: 'center', padding: '2rem 1.5rem' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: 'rgba(52, 199, 89, 0.14)',
              border: '1px solid rgba(52, 199, 89, 0.3)',
              display: 'grid',
              placeItems: 'center',
              color: '#1E7E45'
            }}
          >
            <Lock size={28} strokeWidth={2.2} />
          </div>
          <h2>Next Level Reading</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            This module is locked while media is being prepared. Enter the access code to preview.
          </p>
          <form onSubmit={handleUnlockSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''));
                setPinError('');
              }}
              placeholder="Enter 4-digit code"
              autoFocus
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                borderRadius: 14,
                border: `1.5px solid ${pinError ? 'var(--apple-red)' : 'var(--border-hairline)'}`,
                background: 'rgba(255, 255, 255, 0.9)',
                fontSize: '1.35rem',
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: '0.35em',
                fontFamily: 'inherit',
                color: 'var(--text-primary)'
              }}
              aria-label="4-digit access code"
            />
            {pinError && (
              <span style={{ color: 'var(--apple-red)', fontSize: '0.85rem', fontWeight: 700 }}>
                {pinError}
              </span>
            )}
            <button type="submit" className="btn-tactile btn-blue" style={{ width: '100%' }}>
              Unlock Next Level Reading
            </button>
            <button type="button" className="btn-pill" style={{ justifyContent: 'center' }} onClick={onExit}>
              Back to Home
            </button>
          </form>
        </div>
      </div>
    );
  }

  const story = stories[currentIdx];
  const allASolved = quiz.setA.length > 0 && quiz.setA.every((x) => x.solved);
  const allBSolved = quiz.setB.length > 0 && quiz.setB.every((x) => x.solved);
  const stepProgress = step === 'story' ? 0.25 : step === 'setA' ? 0.65 : allBSolved ? 1 : 0.85;

  return (
    <div className="focus-shell">
      <DynamicIslandHUD
        progress={stepProgress}
        combo={combo}
        statusBanner={banner}
        onExit={() => {
          stopSpeech();
          onExit();
        }}
      />

      <div className="game-stage-container">
        {!story ? (
          <div className="story-card-hig" style={{ textAlign: 'center' }}>Loading stories…</div>
        ) : (
          <>
            {/* 1-11 Quick Selector Strip */}
            <div className="story-strip-hig glass-light" role="region" tabIndex={0} aria-label="Next Level Comic Stories">
              {stories.map((s, idx) => {
                const isCur = idx === currentIdx;
                const isDone = Boolean(completedIds[s.id]);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`story-pill-hig tabular-nums ${isCur ? 'story-pill-hig--current' : ''} ${
                      isDone ? 'story-pill-hig--done' : ''
                    }`}
                    onClick={() => selectStory(idx)}
                  >
                    {s.displayNum}
                  </button>
                );
              })}
            </div>

            {/* Step Tabs */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { id: 'story', label: '📖 Story' },
                { id: 'setA', label: allASolved ? 'Set A ✓' : 'Set A' },
                { id: 'setB', label: allBSolved ? 'Set B ✓' : 'Set B' }
              ].map((tab) => (
                <motion.button
                  key={tab.id}
                  type="button"
                  className="btn-pill"
                  style={step === tab.id ? { background: 'var(--apple-blue)', color: '#fff', borderColor: 'transparent' } : {}}
                  {...TAP_PROPS}
                  onClick={() => goToStep(tab.id)}
                >
                  {tab.label}
                </motion.button>
              ))}
            </div>

            {/* Horizontal Card-Swipe Area */}
            <AnimatePresence mode="wait" custom={direction}>
              <motion.section
                key={`${story.id}-${step}`}
                custom={direction}
                initial={{ opacity: 0, x: direction * 42 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -42 }}
                transition={SPRING_SNAPPY}
                className="story-card-hig"
                style={{ maxWidth: 820 }}
              >
                {step === 'story' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1E7E45' }}>
                          Next Level Reading • Comic {story.displayNum} of {stories.length}
                        </span>
                        <h2 style={{ marginTop: 2 }}>{story.title}</h2>
                      </div>
                    </div>

                    {/* Full Comic Story Image (No writing beneath) */}
                    <div className="story-comic-frame">
                      <img
                        src={assetUrl(story.imagePath)}
                        alt={`Comic story ${story.displayNum}: ${story.title}`}
                        loading="eager"
                      />
                    </div>
                  </>
                ) : (
                  (() => {
                    const setKey = step === 'setA' ? 'setA' : 'setB';
                    const questions = story[setKey] || [];
                    const setStates = quiz[setKey] || [];
                    const setDone = setStates.length > 0 && setStates.every((x) => x.solved);

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h2>
                            {setKey === 'setA' ? 'Set A' : 'Set B'} — {story.title}
                          </h2>
                          {setDone && (
                            <span className="status-chip" style={{ color: 'var(--apple-green-dark)', background: 'rgba(52,199,89,0.16)' }}>
                              <Check size={15} strokeWidth={2.5} /> Done
                            </span>
                          )}
                        </div>

                        {questions.map((question, qIdx) => {
                          const qState = setStates[qIdx] || { solved: false, wrong: [], mistake: false };
                          return (
                            <div
                              key={qIdx}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.55rem',
                                padding: '0.85rem',
                                borderRadius: 18,
                                background: 'rgba(255, 255, 255, 0.55)',
                                border: '1px solid var(--border-hairline)'
                              }}
                            >
                              <div style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
                                {qIdx + 1}. {question.question}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {question.options.map((opt, optIdx) => {
                                  const isRight = qState.solved && optIdx === question.correctIndex;
                                  const isWrong = qState.wrong.includes(optIdx);
                                  return (
                                    <button
                                      key={optIdx}
                                      type="button"
                                      disabled={qState.solved || isWrong}
                                      onClick={() => handleAnswer(setKey, qIdx, question, optIdx)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.75rem 0.9rem',
                                        borderRadius: 14,
                                        border: `2px solid ${
                                          isRight ? '#34C759' : isWrong ? '#FF6B6B' : 'var(--border-hairline)'
                                        }`,
                                        background: isRight
                                          ? 'rgba(52, 199, 89, 0.14)'
                                          : isWrong
                                            ? 'rgba(255, 107, 107, 0.1)'
                                            : 'var(--bg-surface)',
                                        fontFamily: 'inherit',
                                        fontSize: '0.98rem',
                                        fontWeight: 600,
                                        textAlign: 'left',
                                        cursor: qState.solved || isWrong ? 'default' : 'pointer',
                                        color: 'var(--text-primary)'
                                      }}
                                    >
                                      <span
                                        style={{
                                          width: 30,
                                          height: 30,
                                          borderRadius: 9,
                                          display: 'grid',
                                          placeItems: 'center',
                                          background: isRight ? '#34C759' : 'var(--bg-subtle)',
                                          color: isRight ? '#fff' : 'var(--text-secondary)',
                                          flexShrink: 0,
                                          fontWeight: 800
                                        }}
                                      >
                                        {LETTERS[optIdx]}
                                      </span>
                                      <span>{opt}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </motion.section>
            </AnimatePresence>

            {/* Thumb-Zone Bottom Frosted Bar */}
            <div className="thumb-bar glass-light">
              {step === 'story' ? (
                <>
                  <motion.button
                    type="button"
                    className="btn-tactile btn-surface"
                    {...TAP_PROPS}
                    onClick={() => toggleReadAloud(story)}
                  >
                    {isSpeaking ? <VolumeX size={18} strokeWidth={2.2} /> : <Volume2 size={18} strokeWidth={2.2} />}
                    {isSpeaking ? 'Stop' : 'Read Aloud'}
                  </motion.button>
                  <motion.button
                    type="button"
                    className="btn-tactile btn-blue"
                    {...TAP_PROPS}
                    onClick={() => goToStep('setA')}
                  >
                    Next: Set A <ArrowRight size={18} strokeWidth={2.2} />
                  </motion.button>
                </>
              ) : step === 'setA' ? (
                <>
                  <motion.button
                    type="button"
                    className="btn-tactile btn-surface"
                    {...TAP_PROPS}
                    onClick={() => goToStep('story')}
                  >
                    <ArrowLeft size={18} strokeWidth={2.2} /> Back to Story
                  </motion.button>
                  <motion.button
                    type="button"
                    className="btn-tactile btn-blue"
                    {...TAP_PROPS}
                    onClick={() => goToStep('setB')}
                  >
                    Next: Set B <ArrowRight size={18} strokeWidth={2.2} />
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.button
                    type="button"
                    className="btn-tactile btn-surface"
                    {...TAP_PROPS}
                    onClick={() => goToStep('setA')}
                  >
                    <ArrowLeft size={18} strokeWidth={2.2} /> Back to Set A
                  </motion.button>
                  <motion.button
                    type="button"
                    className="btn-tactile btn-green"
                    disabled={currentIdx >= stories.length - 1}
                    {...TAP_PROPS}
                    onClick={() => selectStory(currentIdx + 1)}
                  >
                    Next Story <ArrowRight size={18} strokeWidth={2.2} />
                  </motion.button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {showComplete && (
          <RoundCompleteSheet
            title={`Story ${story?.id} Complete!`}
            subtitle={`Great reading on "${story?.title}" — all 4 questions solved!`}
            xpEarned={50}
            nextLabel={currentIdx < stories.length - 1 ? `Story ${stories[currentIdx + 1].id}` : 'Play Story 1 Again'}
            onNext={() => selectStory(currentIdx < stories.length - 1 ? currentIdx + 1 : 0)}
            onDashboard={() => {
              stopSpeech();
              onExit();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
