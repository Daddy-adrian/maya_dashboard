/**
 * PHONIX Story Data Loader, Validator, and Progress Persistence
 */

const STORAGE_KEY = 'phonix_progress_v1';

const FALLBACK_STORIES = [
  {
    id: 1,
    image: 'story_images/1.jpeg',
    sentences: ['I have a cat.', 'The cat is in bag.', 'I see the cat.'],
    questions: [
      {
        set: 'A',
        options: ['The cat is in a bag.', 'The cat is on a log.', 'The cat is in a pot.'],
        correctIndex: 0
      },
      {
        set: 'B',
        options: ['A dog is in a bag.', 'A pig is in a bag.', 'A pet is in a bag.'],
        correctIndex: 2
      }
    ]
  }
];

/**
 * Validates and normalizes an array of story objects.
 * @param {unknown} raw
 * @returns {Array<object>}
 */
export function validateStories(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Stories data must be a non-empty array.');
  }

  return raw
    .map((item, idx) => {
      const id = Number.isInteger(item?.id) ? item.id : idx + 1;
      const rawImage = typeof item?.image === 'string' && item.image.trim()
        ? item.image.trim()
        : `story_images/${id}.jpeg`;
      const image = rawImage.startsWith('./') ? rawImage : `./${rawImage.replace(/^\/+/, '')}`;

      const sentences = Array.isArray(item?.sentences)
        ? item.sentences.filter((s) => typeof s === 'string' && s.trim().length > 0)
        : [];

      const questions = Array.isArray(item?.questions)
        ? item.questions
            .filter((q) => q && Array.isArray(q.options) && q.options.length === 3)
            .map((q, qIdx) => ({
              set: typeof q.set === 'string' ? q.set : qIdx === 0 ? 'A' : 'B',
              options: q.options.map((opt) => String(opt)),
              correctIndex: Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex <= 2
                ? q.correctIndex
                : 0
            }))
        : [];

      return { id, image, sentences, questions };
    })
    .filter((story) => story.sentences.length > 0 && story.questions.length >= 2)
    .sort((a, b) => a.id - b.id);
}

/**
 * Loads ./stories.json with automatic fallback to bundled JSON path or minimal offline story.
 * @returns {Promise<{ stories: Array<object>, source: string }>}
 */
export async function loadStories() {
  const candidates = ['./stories.json', './stories/gemini-code-1795344057315.json'];

  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: 'default' });
      if (!response.ok) continue;
      const json = await response.json();
      const stories = validateStories(json);
      if (stories.length > 0) {
        return { stories, source: url };
      }
    } catch {
      // Try next candidate or fall back cleanly
    }
  }

  return { stories: validateStories(FALLBACK_STORIES), source: 'fallback' };
}

/**
 * Loads saved learner progress from localStorage.
 * @returns {{ completedStories: Record<string, { stars: number, updatedAt: number }>, lastStoryId: number }}
 */
export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { completedStories: {}, lastStoryId: 1 };
    }
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

/**
 * Saves completion state for a story ID.
 * @param {number} storyId
 * @param {number} stars
 */
export function saveStoryCompletion(storyId, stars) {
  const progress = loadProgress();
  const key = String(storyId);
  const prevStars = progress.completedStories[key]?.stars ?? 0;

  progress.completedStories[key] = {
    stars: Math.max(prevStars, stars),
    updatedAt: Date.now()
  };
  progress.lastStoryId = storyId;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota / privacy mode errors gracefully
  }
  return progress;
}

/**
 * Updates the last visited story ID in localStorage.
 * @param {number} storyId
 */
export function saveLastStoryId(storyId) {
  const progress = loadProgress();
  progress.lastStoryId = storyId;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Resets saved progress.
 */
export function resetProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
