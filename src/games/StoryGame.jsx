import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import DynamicIslandHUD from '../components/DynamicIslandHUD';
import RoundCompleteSheet from '../components/RoundCompleteSheet';
import { useEngagement } from '../context/EngagementContext';
import { assetUrl } from '../utils/assets';
import { SPRING_SNAPPY, SPRING_BOUNCY, TAP_PROPS } from '../utils/motion';
import { playCorrect, playNearMiss, playTap, playPageTurn, setMusicDucked } from '../utils/sensory';
import { useGameMusic } from '../utils/useGameMusic';

const LETTERS = ['A', 'B', 'C'];

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomizeStoryChoices(story) {
  if (!story || !Array.isArray(story.questions)) return story;
  return {
    ...story,
    questions: story.questions.map((q) => {
      if (!Array.isArray(q.options)) return q;
      const indexed = q.options.map((text, i) => ({ text, isCorrect: i === q.correctIndex }));
      const mixed = shuffle(indexed);
      return {
        ...q,
        options: mixed.map((m) => m.text),
        correctIndex: mixed.findIndex((m) => m.isCorrect)
      };
    })
  };
}

export default function StoryGame({ onExit }) {
  useGameMusic('story');
  const { storyProgress, saveStoryDone, awardXP, incrementQuest, maybeTriggerMysteryChest, announce } = useEngagement();
  const [stories, setStories] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [step, setStep] = useState('story'); // 'story' | 'setA' | 'setB'
  const [direction, setDirection] = useState(1);
  const [activeSentence, setActiveSentence] = useState(-1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [combo, setCombo] = useState(0);
  const [banner, setBanner] = useState(null);
  const [quiz, setQuiz] = useState({
    setA: { solved: false, wrong: [], mistake: false },
    setB: { solved: false, wrong: [], mistake: false }
  });
  const [showComplete, setShowComplete] = useState(false);

  const speakingRef = useRef(false);
  const speechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  useEffect(() => {
    let active = true;
    async function load() {
      for (const path of ['stories.json', 'stories/gemini-code-1795344057315.json']) {
        try {
          const res = await fetch(assetUrl(path));
          if (!res.ok) continue;
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && active) {
            const randomized = shuffle(data).map(randomizeStoryChoices);
            setStories(randomized);
            setCurrentIdx(0);
            return;
          }
        } catch {
          // Try next
        }
      }
    }
    load();
    return () => {
      active = false;
      stopSpeech();
    };
  }, []);

  // Preload next story image
  useEffect(() => {
    const next = stories[currentIdx + 1];
    if (next?.image) {
      const img = new Image();
      img.src = assetUrl(next.image);
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

  function selectStory(idx) {
    if (idx < 0 || idx >= stories.length) return;
    stopSpeech();
    playPageTurn();
    setDirection(idx >= currentIdx ? 1 : -1);
    setCurrentIdx(idx);
    setStep('story');
    setShowComplete(false);
    setBanner(null);
    setQuiz({
      setA: { solved: false, wrong: [], mistake: false },
      setB: { solved: false, wrong: [], mistake: false }
    });
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

  function handleAnswer(setKey, question, optIdx) {
    const state = quiz[setKey];
    if (state.solved) return;

    if (optIdx === question.correctIndex) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      playCorrect(nextCombo);
      const nextQuiz = {
        ...quiz,
        [setKey]: { ...state, solved: true }
      };
      setQuiz(nextQuiz);

      if (nextCombo >= 3) {
        setBanner({ type: 'fire', text: '🔥 ON FIRE! 2x XP' });
      } else {
        setBanner(null);
      }

      announce(`Set ${question.set} correct!`);

      if (nextQuiz.setA.solved && nextQuiz.setB.solved) {
        const stars = !nextQuiz.setA.mistake && !nextQuiz.setB.mistake ? 2 : 1;
        saveStoryDone(stories[currentIdx].id, stars);
        awardXP(stars === 2 ? 40 : 25, 10);
        incrementQuest('q-story', 1);
        maybeTriggerMysteryChest(false);
        setShowComplete(true);
      }
    } else {
      setCombo(0);
      playNearMiss();
      setQuiz({
        ...quiz,
        [setKey]: {
          ...state,
          mistake: true,
          wrong: state.wrong.includes(optIdx) ? state.wrong : [...state.wrong, optIdx]
        }
      });
      setBanner({ type: 'coach', text: 'Almost! Think back to the story and try another choice.' });
      announce('Almost! Try another choice.');
    }
  }

  const story = stories[currentIdx];
  const stepProgress = step === 'story' ? 0.25 : step === 'setA' ? 0.65 : quiz.setB.solved ? 1 : 0.85;

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
            {/* 1-28 Quick Selector Strip */}
            <div className="story-strip-hig glass-light" aria-label="Stories 1 to 28">
              {stories.map((s, idx) => {
                const done = Boolean(storyProgress.completedStories?.[String(s.id)]);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`story-pill-hig tabular-nums ${
                      idx === currentIdx ? 'story-pill-hig--current' : ''
                    } ${done ? 'story-pill-hig--done' : ''}`}
                    onClick={() => selectStory(idx)}
                  >
                    {s.id}
                  </button>
                );
              })}
            </div>

            {/* Free Navigation Step Tabs */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { id: 'story', label: '📖 Story' },
                { id: 'setA', label: `Set A${quiz.setA.solved ? ' ✓' : ''}` },
                { id: 'setB', label: `Set B${quiz.setB.solved ? ' ✓' : ''}` }
              ].map((tab) => (
                <motion.button
                  key={tab.id}
                  type="button"
                  className={`btn-pill ${step === tab.id ? 'btn-blue' : ''}`}
                  style={step === tab.id ? { background: 'var(--apple-blue)', color: '#fff', borderColor: 'transparent' } : {}}
                  {...TAP_PROPS}
                  onClick={() => goToStep(tab.id)}
                >
                  {tab.label}
                </motion.button>
              ))}
            </div>

            {/* Card-Swipe Flow */}
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`${story.id}-${step}`}
                custom={direction}
                initial={{ x: direction * 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction * -60, opacity: 0 }}
                transition={SPRING_SNAPPY}
                className="story-card-hig"
              >
                {step === 'story' ? (
                  <>
                    <div className="story-img-frame">
                      <img
                        src={assetUrl(story.image)}
                        alt={`Story ${story.id}`}
                        loading="eager"
                        fetchPriority="high"
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      {story.sentences.map((sent, sIdx) => {
                        const isGlow = activeSentence === sIdx;
                        return (
                          <motion.button
                            key={sIdx}
                            type="button"
                            className={`story-sentence-btn ${isGlow ? 'story-sentence-btn--active' : ''}`}
                            animate={{ scale: isGlow ? 1.02 : 1 }}
                            transition={SPRING_BOUNCY}
                            onClick={() => {
                              playTap();
                              setActiveSentence(activeSentence === sIdx ? -1 : sIdx);
                            }}
                          >
                            {sent}
                          </motion.button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  (() => {
                    const q = step === 'setA' ? story.questions[0] : story.questions[1];
                    const qState = quiz[step];
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h2>Set {q.set}: Pick the matching sentence</h2>
                          {qState.solved && (
                            <span className="status-chip" style={{ color: 'var(--apple-green-dark)', background: 'rgba(52,199,89,0.16)' }}>
                              <Check size={15} strokeWidth={2.5} /> Correct
                            </span>
                          )}
                        </div>
                        {q.options.map((opt, optIdx) => {
                          const isRight = qState.solved && optIdx === q.correctIndex;
                          const isWrong = qState.wrong.includes(optIdx);
                          return (
                            <motion.button
                              key={optIdx}
                              type="button"
                              disabled={qState.solved}
                              className="btn-tactile btn-surface"
                              style={{
                                justifyContent: 'flex-start',
                                textAlign: 'left',
                                padding: '0.9rem 1rem',
                                background: isRight
                                  ? 'rgba(52, 199, 89, 0.18)'
                                  : isWrong
                                    ? 'rgba(255, 107, 107, 0.14)'
                                    : '#FFFFFF',
                                border: `2px solid ${
                                  isRight ? '#34C759' : isWrong ? '#FF6B6B' : 'rgba(28,28,30,0.09)'
                                }`
                              }}
                              {...TAP_PROPS}
                              onClick={() => handleAnswer(step, q, optIdx)}
                            >
                              <span
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 999,
                                  background: isRight ? '#34C759' : 'var(--bg-subtle)',
                                  color: isRight ? '#FFF' : 'var(--text-primary)',
                                  display: 'grid',
                                  placeItems: 'center',
                                  flexShrink: 0,
                                  fontSize: '0.85rem'
                                }}
                              >
                                {LETTERS[optIdx]}
                              </span>
                              <span>{opt}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </motion.div>
            </AnimatePresence>

            {/* Thumb-Zone Frosted-Glass Bottom Bar */}
            <div className="thumb-bar glass-light">
              {step === 'story' ? (
                <>
                  {speechSupported ? (
                    <motion.button
                      type="button"
                      className="btn-tactile btn-surface"
                      {...TAP_PROPS}
                      onClick={() => toggleReadAloud(story)}
                    >
                      {isSpeaking ? <VolumeX size={18} strokeWidth={2.2} /> : <Volume2 size={18} strokeWidth={2.2} />}
                      {isSpeaking ? 'Stop' : 'Read Aloud'}
                    </motion.button>
                  ) : (
                    <span />
                  )}
                  <motion.button
                    type="button"
                    className="btn-tactile btn-blue"
                    {...TAP_PROPS}
                    onClick={() => goToStep('setA')}
                  >
                    Next: Set A <ArrowRight size={18} strokeWidth={2.2} />
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.button
                    type="button"
                    className="btn-tactile btn-surface"
                    {...TAP_PROPS}
                    onClick={() => goToStep(step === 'setB' ? 'setA' : 'story')}
                  >
                    <ArrowLeft size={18} strokeWidth={2.2} />
                    {step === 'setB' ? 'Set A' : 'Story'}
                  </motion.button>
                  {step === 'setA' && (
                    <motion.button
                      type="button"
                      className="btn-tactile btn-blue"
                      {...TAP_PROPS}
                      onClick={() => goToStep('setB')}
                    >
                      Next: Set B <ArrowRight size={18} strokeWidth={2.2} />
                    </motion.button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {showComplete && story && (
          <RoundCompleteSheet
            title={`Story ${story.id} Complete!`}
            subtitle="Great reading! Both Set A and Set B nailed."
            xpEarned={!quiz.setA.mistake && !quiz.setB.mistake ? 40 : 25}
            nextLabel={currentIdx < stories.length - 1 ? `Story ${stories[currentIdx + 1].id}` : 'Play Story 1 Again'}
            onNext={() => selectStory(currentIdx < stories.length - 1 ? currentIdx + 1 : 0)}
            onDashboard={onExit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
