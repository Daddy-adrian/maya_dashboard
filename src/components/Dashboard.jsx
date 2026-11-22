import React, { useMemo, useState } from 'react';
import {
  Home,
  Compass,
  BookOpen,
  Layers,
  Gamepad2,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Flame,
  Coins,
  Check,
  Play,
  BadgeCheck,
  Lock
} from 'lucide-react';
import { useEngagement, DAILY_GOAL_XP, loadDirectionPigSrs } from '../context/EngagementContext';
import { assetUrl } from '../utils/assets';
import { playTap } from '../utils/sensory';
import TrophyRoomModal from './TrophyRoomModal';

export const PHONIX_MODULES = [
  {
    id: 'story-comprehension',
    handle: 'story.comprehension',
    title: 'Story Comprehension',
    subtitle: 'Reading Studio • 28 Stories',
    icon: '📖',
    previewImg: 'story_images/1.jpeg',
    previewBg: 'linear-gradient(135deg, #F8FAFC 0%, #EEF4FF 100%)',
    likes: 128,
    description: 'Read 28 illustrated stories with Karaoke Read Aloud and swipe through Set A & Set B.'
  },
  {
    id: 'next-level-reading',
    handle: 'next.level.reading',
    title: 'Next Level Reading',
    subtitle: 'Locked • 11 Comic Stories',
    icon: '🔒',
    previewImg: 'next_level_story_images/1.jpeg',
    previewBg: 'linear-gradient(135deg, #F3EFE4 0%, #E7F5EC 100%)',
    likes: 64,
    locked: true,
    description: '11 comic-book reading stories with Set A & Set B comprehension sets. Code required to unlock.'
  },
  {
    id: 'cvc-rummikub',
    handle: 'phonix.remi',
    title: 'PHONIX Remi',
    subtitle: 'Wooden Board • 3D Tiles',
    icon: '🃏',
    previewImg: 'vowels_images/joker.jpeg',
    previewBg: 'linear-gradient(135deg, #A47242 0%, #6B4423 100%)',
    likes: 94,
    description: 'Build 3+ tile CVC sets by Same Vowel, Same Ending, or Same First Letter on the wooden rack.'
  },
  {
    id: 'direction-pig',
    handle: 'direction.pig',
    title: 'Direction Pig',
    subtitle: 'Spatial Prepositions',
    icon: '🐷',
    previewImg: 'directions/pig_before_infront.jpeg',
    previewBg: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
    likes: 156,
    description: 'Fast-paced spatial prepositions with Bonus Recall spaced repetition.'
  },
  {
    id: 'odd-one-out',
    handle: 'odd.one.out.casino',
    title: 'Odd One Out',
    subtitle: 'Dark Casino Slot Machine',
    icon: '🎰',
    previewImg: 'odd_one_out_img/bag.jpeg',
    previewBg: 'linear-gradient(135deg, #161B29 0%, #0B0E14 100%)',
    likes: 203,
    description: 'Place 3 words into the slot machine, pull the lever, and chase the Gold Aura jackpot!'
  },
  {
    id: 'am-is-are',
    handle: 'tetris.am.is.are',
    title: 'Am / Is / Are',
    subtitle: 'Retro Pastel Tetris & Sentences',
    icon: '🧱',
    previewImg: 'pronoun/they.jpeg',
    previewBg: 'linear-gradient(135deg, #EBE5F5 0%, #DCEEFF 100%)',
    likes: 112,
    description: 'Catch falling pronoun blocks in Retro Pastel Tetris or solve 2-level Blank Space Sentences.',
    dualModes: true
  },
  {
    id: 'have-has-tetris',
    handle: 'tetris.have.has',
    title: 'Have / Has',
    subtitle: 'Retro Pastel Tetris & Sentences',
    icon: '🧩',
    previewImg: 'pronoun/she.jpeg',
    previewBg: 'linear-gradient(135deg, #FFE4EC 0%, #E7F7EE 100%)',
    likes: 89,
    description: 'Master HAVE vs. HAS in 2-lane Retro Pastel Tetris or 2-level Blank Space Sentences.',
    dualModes: true
  }
];

export default function Dashboard({ onOpenModule }) {
  const { engagement, storyProgress, toggleMute } = useEngagement();
  const [trophyOpen, setTrophyOpen] = useState(false);
  const [likedIds, setLikedIds] = useState({});
  const [savedIds, setSavedIds] = useState({});

  const dailyPct = Math.min(100, Math.round((engagement.dailyXp / DAILY_GOAL_XP) * 100));
  const ringRadius = 15;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - dailyPct / 100);

  const quickPlayTarget = useMemo(() => {
    const srs = loadDirectionPigSrs();
    const hasDuePig = Object.values(srs).some((item) => item && (item.streak === 0 || item.lapses > 0));
    if (hasDuePig) {
      return {
        moduleId: 'direction-pig',
        mode: null,
        label: 'Direction Pig'
      };
    }

    const completedCount = Object.keys(storyProgress.completedStories || {}).length;
    if (completedCount < 28) {
      return {
        moduleId: 'story-comprehension',
        mode: null,
        label: 'Story Comprehension'
      };
    }

    const leastRecent = [...PHONIX_MODULES].sort(
      (a, b) => (engagement.lastPlayedByModule[a.id] || 0) - (engagement.lastPlayedByModule[b.id] || 0)
    )[0];

    return {
      moduleId: leastRecent.id,
      mode: leastRecent.dualModes ? 'tetris' : null,
      label: leastRecent.title
    };
  }, [engagement.lastPlayedByModule, storyProgress.completedStories]);

  const toggleLike = (id) => {
    playTap();
    setLikedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSave = (id) => {
    playTap();
    setSavedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="ig-shell">
      {/* Left Instagram Navigation Sidebar */}
      <aside className="ig-sidebar" aria-label="Primary Navigation">
        <div className="ig-logo">PHONIX</div>

        <nav className="ig-nav">
          <button type="button" className="ig-nav-item ig-nav-item--active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Home size={22} strokeWidth={2.3} />
            <span>Home</span>
          </button>
          <button
            type="button"
            className="ig-nav-item"
            onClick={() => {
              playTap();
              onOpenModule(quickPlayTarget.moduleId, quickPlayTarget.mode);
            }}
          >
            <Compass size={22} strokeWidth={2} />
            <span>Quick Play</span>
          </button>
          <button
            type="button"
            className="ig-nav-item"
            onClick={() => {
              playTap();
              onOpenModule('story-comprehension', null);
            }}
          >
            <BookOpen size={22} strokeWidth={2} />
            <span>Stories</span>
          </button>
          <button
            type="button"
            className="ig-nav-item"
            onClick={() => {
              playTap();
              onOpenModule('next-level-reading', null);
            }}
          >
            <Lock size={21} strokeWidth={2} />
            <span>Next Level</span>
          </button>
          <button
            type="button"
            className="ig-nav-item"
            onClick={() => {
              playTap();
              onOpenModule('cvc-rummikub', null);
            }}
          >
            <Layers size={22} strokeWidth={2} />
            <span>Remi</span>
          </button>
          <button
            type="button"
            className="ig-nav-item"
            onClick={() => {
              playTap();
              onOpenModule('odd-one-out', null);
            }}
          >
            <Sparkles size={22} strokeWidth={2} />
            <span>Casino Slots</span>
          </button>
          <button
            type="button"
            className="ig-nav-item"
            onClick={() => {
              playTap();
              onOpenModule('am-is-are', 'tetris');
            }}
          >
            <Gamepad2 size={22} strokeWidth={2} />
            <span>Retro Tetris</span>
          </button>
          <button
            type="button"
            className="ig-nav-item"
            onClick={() => {
              playTap();
              setTrophyOpen(true);
            }}
          >
            <Trophy size={22} strokeWidth={2} />
            <span>Trophies</span>
          </button>
        </nav>

        <div className="ig-sidebar-footer">
          <button type="button" className="ig-nav-item" onClick={toggleMute}>
            {engagement.soundMuted ? <VolumeX size={21} strokeWidth={2} /> : <Volume2 size={21} strokeWidth={2} />}
            <span>{engagement.soundMuted ? 'Sound Off' : 'Sound On'}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Header (shown on smaller screens) */}
      <header className="ig-mobile-header">
        <span className="ig-logo" style={{ fontSize: '1.35rem', padding: 0 }}>PHONIX</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="ig-mini-stat tabular-nums">
            <Flame size={15} color="#FF9500" fill="#FF9500" /> {engagement.streakDays}
          </span>
          <span className="ig-mini-stat tabular-nums">
            <Coins size={15} color="#D9A404" /> {engagement.coins}
          </span>
          <button type="button" className="ig-icon-btn" onClick={() => setTrophyOpen(true)} aria-label="Trophies">
            <Trophy size={20} />
          </button>
          <button type="button" className="ig-icon-btn" onClick={toggleMute} aria-label="Toggle Sound">
            {engagement.soundMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </header>

      {/* Center Instagram Feed Column */}
      <main id="main-content" className="ig-feed-col">
        {/* Instagram Stories Strip (Daily Micro-Quests) */}
        <section className="ig-stories-bar" aria-label="Daily Quests Stories">
          {engagement.dailyQuests.map((quest) => {
            const done = quest.progress >= quest.target;
            return (
              <button
                key={quest.id}
                type="button"
                className="ig-story-item"
                onClick={() => {
                  playTap();
                  onOpenModule(quest.moduleId, quest.moduleId === 'am-is-are' ? 'tetris' : null);
                }}
              >
                <div className={`ig-story-ring ${done ? 'ig-story-ring--done' : 'ig-story-ring--active'}`}>
                  <div className="ig-story-avatar">
                    <span aria-hidden="true">{quest.icon}</span>
                    {done && (
                      <span className="ig-story-check" aria-label="Completed">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </div>
                <span className="ig-story-label">{quest.title}</span>
                <span className="ig-story-count tabular-nums">
                  {quest.progress}/{quest.target}
                </span>
              </button>
            );
          })}
        </section>

        {/* Instagram Feed Posts (All 6 Games) */}
        <section className="ig-posts-list" aria-label="PHONIX Games Feed">
          {PHONIX_MODULES.map((mod) => {
            const liked = Boolean(likedIds[mod.id]);
            const saved = Boolean(savedIds[mod.id]);
            return (
              <article key={mod.id} className="ig-post">
                {/* Post Header */}
                <div className="ig-post__header">
                  <div className="ig-post__author">
                    <div className="ig-post__avatar-ring">
                      <div className="ig-post__avatar">{mod.icon}</div>
                    </div>
                    <div>
                      <div className="ig-post__handle">
                        <span>{mod.handle}</span>
                        <BadgeCheck size={14} color="#0095F6" fill="#0095F6" stroke="#FFFFFF" strokeWidth={2} />
                      </div>
                      <div className="ig-post__sub">{mod.subtitle}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ig-play-link"
                    onClick={() => {
                      playTap();
                      onOpenModule(mod.id, mod.dualModes ? 'tetris' : null);
                    }}
                  >
                    Play
                  </button>
                </div>

                {/* Post Media Frame (clickable to launch game) */}
                <button
                  type="button"
                  className="ig-post__media"
                  style={{ background: mod.previewBg }}
                  onClick={() => {
                    playTap();
                    onOpenModule(mod.id, mod.dualModes ? 'tetris' : null);
                  }}
                  aria-label={`Play ${mod.title}`}
                >
                  <img src={assetUrl(mod.previewImg)} alt={mod.title} loading="lazy" />
                  <span className="ig-post__media-badge">
                    <Play size={13} fill="#FFFFFF" color="#FFFFFF" />
                    {mod.title}
                  </span>
                </button>

                {/* Post Action Icons Bar */}
                <div className="ig-post__actions">
                  <div className="ig-post__actions-left">
                    <button
                      type="button"
                      className="ig-icon-btn"
                      onClick={() => toggleLike(mod.id)}
                      aria-label={liked ? 'Unlike' : 'Like'}
                    >
                      <Heart
                        size={22}
                        strokeWidth={2}
                        color={liked ? '#FF3040' : '#1D1D1F'}
                        fill={liked ? '#FF3040' : 'none'}
                      />
                    </button>
                    <button
                      type="button"
                      className="ig-icon-btn"
                      onClick={() => {
                        playTap();
                        onOpenModule(mod.id, mod.dualModes ? 'tetris' : null);
                      }}
                      aria-label="Open game"
                    >
                      <MessageCircle size={22} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      className="ig-icon-btn"
                      onClick={() => {
                        playTap();
                        onOpenModule(mod.id, mod.dualModes ? 'tetris' : null);
                      }}
                      aria-label="Launch"
                    >
                      <Send size={21} strokeWidth={2} />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="ig-icon-btn"
                    onClick={() => toggleSave(mod.id)}
                    aria-label={saved ? 'Unsave' : 'Save'}
                  >
                    <Bookmark
                      size={22}
                      strokeWidth={2}
                      color="#1D1D1F"
                      fill={saved ? '#1D1D1F' : 'none'}
                    />
                  </button>
                </div>

                {/* Likes & Caption */}
                <div className="ig-post__body">
                  <div className="ig-post__likes tabular-nums">
                    {mod.likes + (liked ? 1 : 0)} likes
                  </div>
                  <p className="ig-post__caption">
                    <strong>{mod.handle}</strong> {mod.description}
                  </p>

                  {/* Action Buttons */}
                  <div className="ig-post__cta-row">
                    {mod.dualModes ? (
                      <>
                        <button
                          type="button"
                          className="ig-btn-primary"
                          onClick={() => {
                            playTap();
                            onOpenModule(mod.id, 'tetris');
                          }}
                        >
                          Play Tetris
                        </button>
                        <button
                          type="button"
                          className="ig-btn-secondary"
                          onClick={() => {
                            playTap();
                            onOpenModule(mod.id, 'sentences');
                          }}
                        >
                          Blank Sentences
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="ig-btn-primary"
                        onClick={() => {
                          playTap();
                          onOpenModule(mod.id, null);
                        }}
                      >
                        {mod.locked ? 'Unlock with Code' : 'Open Game'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </main>

      {/* Right Instagram "Profile & Suggested Games" Sidebar */}
      <aside className="ig-right-rail" aria-label="Progress and Quick Access">
        {/* Profile + Daily Ring */}
        <div className="ig-profile-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="ig-profile-avatar">
              <svg width="46" height="46" viewBox="0 0 38 38" aria-hidden="true">
                <circle cx="19" cy="19" r={ringRadius} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="3.5" />
                <circle
                  cx="19"
                  cy="19"
                  r={ringRadius}
                  fill="none"
                  stroke="#0095F6"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  transform="rotate(-90 19 19)"
                />
              </svg>
              <span className="ig-profile-pct tabular-nums">{dailyPct}%</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>maya_phonix</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'flex', gap: 10 }}>
                <span className="tabular-nums">🔥 {engagement.streakDays} streak</span>
                <span className="tabular-nums">🪙 {engagement.coins}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="ig-play-link"
            onClick={() => {
              playTap();
              onOpenModule(quickPlayTarget.moduleId, quickPlayTarget.mode);
            }}
          >
            Quick Play
          </button>
        </div>

        {/* Suggested for you (1-click jump to any game) */}
        <div className="ig-suggested-head">
          <span>Suggested for you</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>All {PHONIX_MODULES.length} Games</span>
        </div>

        <div className="ig-suggested-list">
          {PHONIX_MODULES.map((mod) => (
            <div key={mod.id} className="ig-suggested-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div className="ig-suggested-icon">{mod.icon}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="ig-suggested-title">{mod.title}</div>
                  <div className="ig-suggested-sub">{mod.subtitle}</div>
                </div>
              </div>
              <button
                type="button"
                className="ig-play-link"
                onClick={() => {
                  playTap();
                  onOpenModule(mod.id, mod.dualModes ? 'tetris' : null);
                }}
              >
                Play
              </button>
            </div>
          ))}
        </div>

        <div className="ig-footer-note">
          PHONIX English Learning Studio • Session resets on refresh
        </div>
      </aside>

      <TrophyRoomModal open={trophyOpen} onClose={() => setTrophyOpen(false)} />
    </div>
  );
}
