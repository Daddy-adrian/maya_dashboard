import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Flame,
  Shield,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
  Play,
  Check,
  Coins
} from 'lucide-react';
import { useEngagement, DAILY_GOAL_XP, loadDirectionPigSrs } from '../context/EngagementContext';
import { SPRING_SNAPPY, TAP_PROPS } from '../utils/motion';
import { playTap } from '../utils/sensory';
import TrophyRoomModal from './TrophyRoomModal';

export const PHONIX_MODULES = [
  {
    id: 'story-comprehension',
    title: 'Story Comprehension',
    icon: '📖',
    accent: '#007AFF',
    description: 'Read 28 illustrated stories with Karaoke Read Aloud and swipe through Set A & Set B.'
  },
  {
    id: 'cvc-rummikub',
    title: 'PHONIX Remi',
    icon: '🃏',
    accent: '#AF52DE',
    description: 'Build 3+ card CVC sets by Same Vowel, Same Ending, or Same First Letter.'
  },
  {
    id: 'direction-pig',
    title: 'Direction Pig',
    icon: '🐷',
    accent: '#FF9500',
    description: 'Fast-paced spatial prepositions with Bonus Recall spaced repetition.'
  },
  {
    id: 'odd-one-out',
    title: 'Odd One Out',
    icon: '🔍',
    accent: '#34C759',
    description: 'Drag & match 3 of 4 words or pictures and spotlight the Odd One Out.'
  },
  {
    id: 'am-is-are',
    title: 'Am / Is / Are',
    icon: '🧱',
    accent: '#007AFF',
    description: 'Catch falling pronoun cards in Tetris or solve 2-level Blank Space Sentences.',
    dualModes: true
  },
  {
    id: 'have-has-tetris',
    title: 'Have / Has',
    icon: '🧩',
    accent: '#FF6B6B',
    description: 'Master HAVE vs. HAS in 2-lane Tetris or 2-level Blank Space Sentences.',
    dualModes: true
  }
];

function getModuleCharge(lastPlayedTs) {
  if (!lastPlayedTs) return { bars: 2, needsRecharge: false };
  const hours = (Date.now() - lastPlayedTs) / (1000 * 60 * 60);
  if (hours >= 48) return { bars: 1, needsRecharge: true };
  if (hours >= 24) return { bars: 2, needsRecharge: false };
  return { bars: 3, needsRecharge: false };
}

export default function Dashboard({ onOpenModule }) {
  const { engagement, storyProgress, toggleMute } = useEngagement();
  const [trophyOpen, setTrophyOpen] = useState(false);

  const dailyPct = Math.min(100, Math.round((engagement.dailyXp / DAILY_GOAL_XP) * 100));
  const ringRadius = 15;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - dailyPct / 100);

  // Zero-Decision Quick Play selector:
  // 1) Due Direction Pig SRS items (lapses > 0 or streak === 0)
  // 2) Next unfinished Story
  // 3) Least recently played module
  const quickPlayTarget = useMemo(() => {
    const srs = loadDirectionPigSrs();
    const hasDuePig = Object.values(srs).some((item) => item && (item.streak === 0 || item.lapses > 0));
    if (hasDuePig) {
      return {
        moduleId: 'direction-pig',
        mode: null,
        label: 'Direction Pig — Bonus Recall',
        sub: 'Review due spatial words to lock them into long-term memory.'
      };
    }

    const completedCount = Object.keys(storyProgress.completedStories || {}).length;
    if (completedCount < 28) {
      return {
        moduleId: 'story-comprehension',
        mode: null,
        label: `Story Comprehension — Story ${Math.min(28, completedCount + 1)}`,
        sub: `${completedCount}/28 stories complete. Keep your reading streak alive!`
      };
    }

    const leastRecent = [...PHONIX_MODULES].sort(
      (a, b) => (engagement.lastPlayedByModule[a.id] || 0) - (engagement.lastPlayedByModule[b.id] || 0)
    )[0];

    return {
      moduleId: leastRecent.id,
      mode: leastRecent.dualModes ? 'tetris' : null,
      label: leastRecent.title,
      sub: 'Recommended next phonics challenge.'
    };
  }, [engagement.lastPlayedByModule, storyProgress.completedStories]);

  return (
    <div>
      {/* Sticky Frosted-Glass Top Status Bar */}
      <header className="dash-topbar glass-light">
        <div className="dash-topbar__inner">
          <div className="dash-brand">
            <span className="dash-wordmark">PHONIX</span>
            <div
              className="status-chip tabular-nums"
              title={`Streak Freeze Shields: ${engagement.streakFreezes}`}
              style={{ color: '#D95B00' }}
            >
              <Flame size={17} strokeWidth={2.2} fill="#FF9500" color="#FF9500" />
              <span>{engagement.streakDays}</span>
              <Shield size={14} strokeWidth={2.2} color="#007AFF" />
            </div>
          </div>

          <div className="dash-status-pills">
            {/* Daily Goal Ring (15% Endowed Progress) */}
            <div className="status-chip tabular-nums" title={`Daily Goal: ${engagement.dailyXp}/${DAILY_GOAL_XP} XP`}>
              <svg width="34" height="34" viewBox="0 0 38 38" aria-hidden="true">
                <circle cx="19" cy="19" r={ringRadius} fill="none" stroke="rgba(28,28,30,0.1)" strokeWidth="4" />
                <circle
                  cx="19"
                  cy="19"
                  r={ringRadius}
                  fill="none"
                  stroke="#34C759"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  transform="rotate(-90 19 19)"
                />
              </svg>
              <span>{dailyPct}%</span>
            </div>

            <div className="status-chip tabular-nums" aria-label={`${engagement.coins} coins`}>
              <Coins size={16} strokeWidth={2.2} color="#FF9500" />
              <span>{engagement.coins}</span>
            </div>

            <motion.button
              type="button"
              className="btn-pill"
              {...TAP_PROPS}
              onClick={() => {
                playTap();
                setTrophyOpen(true);
              }}
              aria-label="Open Trophy Room"
            >
              <Trophy size={16} strokeWidth={2.2} color="#FF9500" />
              <span>Trophies</span>
            </motion.button>

            <motion.button
              type="button"
              className="btn-pill"
              {...TAP_PROPS}
              onClick={toggleMute}
              aria-label={engagement.soundMuted ? 'Unmute sounds' : 'Mute sounds'}
            >
              {engagement.soundMuted ? (
                <VolumeX size={16} strokeWidth={2.2} />
              ) : (
                <Volume2 size={16} strokeWidth={2.2} />
              )}
            </motion.button>
          </div>
        </div>
      </header>

      <main id="main-content" className="dash-main">
        {/* Instagram-Style Daily Story Rings */}
        <section aria-label="Daily Micro-Quests">
          <div className="story-rings-strip">
            {engagement.dailyQuests.map((quest) => {
              const done = quest.progress >= quest.target;
              return (
                <motion.button
                  key={quest.id}
                  type="button"
                  className="story-ring-item"
                  {...TAP_PROPS}
                  onClick={() => {
                    playTap();
                    onOpenModule(quest.moduleId, quest.moduleId === 'am-is-are' ? 'tetris' : null);
                  }}
                >
                  <div className={`story-ring-outer ${done ? 'story-ring-outer--done' : 'story-ring-outer--active'}`}>
                    <div className="story-ring-inner">
                      <span aria-hidden="true">{quest.icon}</span>
                      {done && (
                        <span className="story-ring-check" aria-label="Completed">
                          <Check size={13} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="story-ring-label">
                    {quest.title}
                    <br />
                    <span className="tabular-nums" style={{ color: done ? '#248A3D' : '#8E8E93' }}>
                      {quest.progress}/{quest.target}
                    </span>
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Zero-Decision Quick Play Hero Card */}
        <section className="quick-play-hero">
          <div>
            <div className="quick-play-hero__eyebrow">
              <Zap size={14} strokeWidth={2.2} color="#007AFF" />
              Continue Your Streak
            </div>
            <h1>{quickPlayTarget.label}</h1>
            <p>{quickPlayTarget.sub}</p>
          </div>
          <motion.button
            type="button"
            className="btn-tactile btn-green"
            style={{ fontSize: '1.08rem', padding: '0.8rem 1.65rem' }}
            {...TAP_PROPS}
            onClick={() => {
              playTap();
              onOpenModule(quickPlayTarget.moduleId, quickPlayTarget.mode);
            }}
          >
            <Play size={18} strokeWidth={2.2} fill="#FFFFFF" />
            Quick Play
          </motion.button>
        </section>

        {/* 6 App Store Module Cards */}
        <section className="app-modules-grid" aria-label="PHONIX Learning Modules">
          {PHONIX_MODULES.map((mod) => {
            const charge = getModuleCharge(engagement.lastPlayedByModule[mod.id]);
            return (
              <article
                key={mod.id}
                className="hig-module-card"
              >
                <div className="hig-module-card__top">
                  <div className="hig-module-icon" aria-hidden="true">
                    {mod.icon}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div className="energy-bars" title="Memory charge">
                      {[1, 2, 3].map((bar) => (
                        <span
                          key={bar}
                          className={`energy-bar ${
                            bar <= charge.bars
                              ? charge.needsRecharge
                                ? 'energy-bar--low'
                                : 'energy-bar--filled'
                              : ''
                          }`}
                          style={{ height: 5 + bar * 3.5 }}
                        />
                      ))}
                    </div>
                    {charge.needsRecharge && (
                      <span className="recharge-pill">Needs Recharge ⚡</span>
                    )}
                  </div>
                </div>

                <h2 className="hig-module-card__title">{mod.title}</h2>
                <p className="hig-module-card__desc">{mod.description}</p>

                <div className="hig-module-card__actions">
                  {mod.dualModes ? (
                    <>
                      <motion.button
                        type="button"
                        className="btn-tactile btn-blue"
                        style={{ flex: 1 }}
                        {...TAP_PROPS}
                        onClick={() => {
                          playTap();
                          onOpenModule(mod.id, 'tetris');
                        }}
                      >
                        Play Tetris
                      </motion.button>
                      <motion.button
                        type="button"
                        className="btn-tactile btn-surface"
                        style={{ flex: 1 }}
                        {...TAP_PROPS}
                        onClick={() => {
                          playTap();
                          onOpenModule(mod.id, 'sentences');
                        }}
                      >
                        Blank Sentences
                      </motion.button>
                    </>
                  ) : (
                    <motion.button
                      type="button"
                      className="btn-tactile btn-blue"
                      style={{ width: '100%' }}
                      {...TAP_PROPS}
                      onClick={() => {
                        playTap();
                        onOpenModule(mod.id, null);
                      }}
                    >
                      Open
                    </motion.button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </main>

      <TrophyRoomModal open={trophyOpen} onClose={() => setTrophyOpen(false)} />
    </div>
  );
}
