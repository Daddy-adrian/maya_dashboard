import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setSensoryMuted } from '../utils/sensory';

const ENGAGEMENT_KEY = 'phonix_engagement_v1';
const STORY_PROGRESS_KEY = 'phonix_progress_v1';
const PIG_SRS_KEY = 'phonix_direction_pig_srs_v1';

export const DAILY_GOAL_XP = 100;

export const STICKER_CATALOG = [
  { id: 'star-cat', emoji: '🐱', label: 'Phonics Cat' },
  { id: 'rocket-pig', emoji: '🐷', label: 'Direction Pig' },
  { id: 'crown-gold', emoji: '👑', label: 'Word Master' },
  { id: 'rainbow-star', emoji: '🌈', label: 'Vowel Star' },
  { id: 'trophy-cup', emoji: '🏆', label: 'Champion' },
  { id: 'fire-bolt', emoji: '⚡', label: 'Speed Bolt' },
  { id: 'magic-joker', emoji: '🃏', label: 'Wild Joker' },
  { id: 'book-owl', emoji: '🦉', label: 'Story Owl' }
];

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function createDefaultQuests() {
  return [
    { id: 'q-story', moduleId: 'story-comprehension', title: 'Read 1 Story', icon: '📖', target: 1, progress: 0, claimed: false },
    { id: 'q-pig', moduleId: 'direction-pig', title: '5 Direction Pigs', icon: '🐷', target: 5, progress: 0, claimed: false },
    { id: 'q-tetris', moduleId: 'am-is-are', title: '10 Tetris Drops', icon: '🧱', target: 10, progress: 0, claimed: false },
    { id: 'q-ooo', moduleId: 'odd-one-out', title: '1 Odd One Out', icon: '🔍', target: 1, progress: 0, claimed: false }
  ];
}

function loadEngagement() {
  const today = getTodayStr();
  const defaults = {
    xp: 15, // Endowed Progress: 15% pre-filled daily goal
    coins: 25,
    streakDays: 1,
    streakFreezes: 1,
    lastPlayedDate: today,
    dailyXp: 15,
    dailyQuests: createDefaultQuests(),
    unlockedStickers: ['star-cat'],
    placedStickers: [{ id: 'star-cat', x: 60, y: 60 }],
    soundMuted: false,
    lastPlayedByModule: {}
  };

  try {
    const raw = localStorage.getItem(ENGAGEMENT_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const isNewDay = parsed.lastPlayedDate && parsed.lastPlayedDate !== today;

    let streakDays = parsed.streakDays || 1;
    let streakFreezes = parsed.streakFreezes ?? 1;
    if (isNewDay) {
      const prev = new Date(parsed.lastPlayedDate);
      const curr = new Date(today);
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streakDays += 1;
      } else if (diffDays > 1) {
        if (streakFreezes > 0) {
          streakFreezes -= 1;
        } else {
          streakDays = 1;
        }
      }
    }

    return {
      ...defaults,
      ...parsed,
      streakDays,
      streakFreezes,
      lastPlayedDate: today,
      dailyXp: isNewDay ? 15 : Math.max(15, parsed.dailyXp ?? 15),
      dailyQuests: isNewDay || !Array.isArray(parsed.dailyQuests) ? createDefaultQuests() : parsed.dailyQuests,
      lastPlayedByModule: parsed.lastPlayedByModule || {}
    };
  } catch {
    return defaults;
  }
}

export function loadStoryProgress() {
  try {
    const raw = localStorage.getItem(STORY_PROGRESS_KEY);
    if (!raw) return { completedStories: {}, lastStoryId: 1 };
    const parsed = JSON.parse(raw);
    return {
      completedStories: parsed?.completedStories && typeof parsed.completedStories === 'object'
        ? parsed.completedStories
        : {},
      lastStoryId: Number.isInteger(parsed?.lastStoryId) ? parsed.lastStoryId : 1
    };
  } catch {
    return { completedStories: {}, lastStoryId: 1 };
  }
}

export function loadDirectionPigSrs() {
  try {
    const raw = localStorage.getItem(PIG_SRS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const EngagementContext = createContext(null);

export function EngagementProvider({ children }) {
  const [state, setState] = useState(loadEngagement);
  const [storyProgress, setStoryProgress] = useState(loadStoryProgress);
  const [chestPending, setChestPending] = useState(null); // { reason: string } | null

  useEffect(() => {
    setSensoryMuted(state.soundMuted);
    try {
      localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state]);

  const announce = useCallback((msg) => {
    const el = document.getElementById('app-announcer');
    if (!el) return;
    el.textContent = '';
    requestAnimationFrame(() => {
      el.textContent = msg;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setState((prev) => ({ ...prev, soundMuted: !prev.soundMuted }));
  }, []);

  const markModulePlayed = useCallback((moduleId) => {
    setState((prev) => ({
      ...prev,
      lastPlayedByModule: {
        ...prev.lastPlayedByModule,
        [moduleId]: Date.now()
      }
    }));
  }, []);

  const awardXP = useCallback((amount, coinsDelta = 0) => {
    setState((prev) => ({
      ...prev,
      xp: prev.xp + amount,
      dailyXp: prev.dailyXp + amount,
      coins: prev.coins + coinsDelta
    }));
  }, []);

  const incrementQuest = useCallback((questId, delta = 1) => {
    let triggeredQuestChest = false;
    setState((prev) => {
      const updatedQuests = prev.dailyQuests.map((q) => {
        if (q.id !== questId) return q;
        const nextProg = Math.min(q.target, q.progress + delta);
        if (nextProg >= q.target && !q.claimed) {
          triggeredQuestChest = true;
          return { ...q, progress: nextProg, claimed: true };
        }
        return { ...q, progress: nextProg };
      });
      return { ...prev, dailyQuests: updatedQuests };
    });
    if (triggeredQuestChest) {
      setChestPending({ reason: 'Daily Quest Complete!' });
    }
  }, []);

  const maybeTriggerMysteryChest = useCallback((guaranteed = false) => {
    if (guaranteed || Math.random() < 0.4) {
      setChestPending({ reason: guaranteed ? 'Daily Quest Reward!' : 'Mystery Star Chest!' });
    }
  }, []);

  const openMysteryChestReward = useCallback(() => {
    const bonusXp = [25, 40, 60, 75, 100][Math.floor(Math.random() * 5)];
    const bonusCoins = [15, 25, 35, 50][Math.floor(Math.random() * 4)];
    let newSticker = null;

    setState((prev) => {
      const locked = STICKER_CATALOG.filter((s) => !prev.unlockedStickers.includes(s.id));
      let nextUnlocked = prev.unlockedStickers;
      let nextPlaced = prev.placedStickers;

      if (locked.length > 0) {
        newSticker = locked[Math.floor(Math.random() * locked.length)];
        nextUnlocked = [...prev.unlockedStickers, newSticker.id];
        nextPlaced = [
          ...prev.placedStickers,
          { id: newSticker.id, x: 40 + (nextPlaced.length * 42) % 240, y: 40 + (nextPlaced.length * 34) % 160 }
        ];
      }

      return {
        ...prev,
        xp: prev.xp + bonusXp,
        dailyXp: prev.dailyXp + bonusXp,
        coins: prev.coins + bonusCoins,
        unlockedStickers: nextUnlocked,
        placedStickers: nextPlaced
      };
    });

    return { bonusXp, bonusCoins, newSticker };
  }, []);

  const closeChest = useCallback(() => {
    setChestPending(null);
  }, []);

  const updateStickerPosition = useCallback((stickerId, x, y) => {
    setState((prev) => ({
      ...prev,
      placedStickers: prev.placedStickers.map((s) =>
        s.id === stickerId ? { ...s, x, y } : s
      )
    }));
  }, []);

  const saveStoryDone = useCallback((storyId, stars) => {
    setStoryProgress((prev) => {
      const key = String(storyId);
      const prevStars = prev.completedStories[key]?.stars ?? 0;
      const next = {
        completedStories: {
          ...prev.completedStories,
          [key]: { stars: Math.max(prevStars, stars), updatedAt: Date.now() }
        },
        lastStoryId: storyId
      };
      try {
        localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  return (
    <EngagementContext.Provider
      value={{
        engagement: state,
        storyProgress,
        chestPending,
        announce,
        toggleMute,
        markModulePlayed,
        awardXP,
        incrementQuest,
        maybeTriggerMysteryChest,
        openMysteryChestReward,
        closeChest,
        updateStickerPosition,
        saveStoryDone
      }}
    >
      {children}
    </EngagementContext.Provider>
  );
}

export function useEngagement() {
  const ctx = useContext(EngagementContext);
  if (!ctx) throw new Error('useEngagement must be used within EngagementProvider');
  return ctx;
}
