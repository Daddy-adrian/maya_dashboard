/**
 * PHONIX Dashboard Component
 * Displays all 6 PHONIX modules, progress summary, and short-vowel color specs.
 */

export const PHONIX_MODULES = [
  {
    id: 'story-comprehension',
    title: 'Story Comprehension',
    icon: '📖',
    status: 'playable',
    statusLabel: 'Playable Now',
    description:
      'Read 28 illustrated short-vowel stories with Read Aloud support and answer two-part comprehension checks (Set A & Set B).',
    specs: ['28 Stories', 'Set A & Set B Quiz', 'Read Aloud + Stars'],
    actionLabel: 'Play Story Game'
  },
  {
    id: 'cvc-rummikub',
    title: 'PHONIX Remi: CVC Word Builder',
    icon: '🃏',
    status: 'playable',
    statusLabel: 'Playable Now',
    description:
      'Build 3+ card CVC sets by Same Vowel, Same Ending, or Same First Letter from a 52-card deck (50 CVC words + 2 Jokers).',
    specs: ['52-Card Deck', '14-Card Hand Rack', 'Drag & Drop Sets'],
    actionLabel: 'Play PHONIX Remi'
  },
  {
    id: 'direction-pig',
    title: 'Direction Pig',
    icon: '🐷',
    status: 'playable',
    statusLabel: 'Playable Now',
    description:
      'Practice 10 spatial prepositions (on, under, left, right, behind, and more) in alternating Picture → Word and Word → Picture rounds.',
    specs: ['10 Directions', 'Picture ↔ Word Modes', '10-Question Session'],
    actionLabel: 'Play Direction Pig'
  },
  {
    id: 'odd-one-out',
    title: 'Odd One Out: Drag & Match',
    icon: '🔍',
    status: 'playable',
    statusLabel: 'Playable Now',
    description:
      'Match 3 of 4 words or pictures to their pairs and spot the Odd One Out across 10 rounds.',
    specs: ['4 Words → 3 Pictures', '4 Pictures → 3 Words', 'Drag or Tap'],
    actionLabel: 'Play Odd One Out'
  },
  {
    id: 'am-is-are',
    title: 'Am / Is / Are',
    icon: '🧱',
    status: 'playable',
    statusLabel: 'Playable Now',
    description:
      'Practice am, is, and are with falling pronoun cards in Tetris or school-book fill-in-the-blank sentences.',
    specs: ['Tetris Mode', 'Blank Space Sentences', 'Pronouns & Stories'],
    actions: [
      { label: 'Play Tetris', mode: 'tetris', primary: true },
      { label: 'Blank Sentences', mode: 'sentences', primary: false }
    ]
  },
  {
    id: 'have-has-tetris',
    title: 'Have / Has',
    icon: '🧱',
    status: 'playable',
    statusLabel: 'Playable Now',
    description:
      'Practice have and has with falling pronoun cards in Tetris or school-book fill-in-the-blank sentences.',
    specs: ['Tetris Mode', 'Blank Space Sentences', '0–10 Spawn Speed'],
    actions: [
      { label: 'Play Tetris', mode: 'tetris', primary: true },
      { label: 'Blank Sentences', mode: 'sentences', primary: false }
    ]
  }
];

/**
 * Renders the PHONIX Dashboard into the target container.
 * @param {HTMLElement} container
 * @param {{ storiesCount: number, progress: { completedStories: Record<string, { stars: number }>, lastStoryId: number }, onOpenModule: (moduleId: string) => void }} options
 */
export function renderDashboard(container, { storiesCount, progress, onOpenModule }) {
  const completedEntries = Object.values(progress.completedStories || {});
  const completedCount = completedEntries.length;
  const totalStars = completedEntries.reduce((sum, entry) => sum + (entry?.stars || 0), 0);
  const maxStars = storiesCount * 2;
  const pct = storiesCount > 0 ? Math.round((completedCount / storiesCount) * 100) : 0;

  container.innerHTML = '';

  // Hero & Progress Summary
  const hero = document.createElement('section');
  hero.className = 'dashboard-hero';
  hero.innerHTML = `
    <div>
      <h1 id="page-heading" tabindex="-1">Welcome to PHONIX</h1>
      <p>
        Build confident early English reading skills with color-coded short vowels,
        illustrated stories, and interactive phonics games.
      </p>
    </div>
    <div class="progress-summary" aria-label="Story Comprehension progress">
      <div class="progress-summary__label">
        <span>Story Progress</span>
        <span>${completedCount} / ${storiesCount} (${pct}%)</span>
      </div>
      <div class="progress-bar" role="progressbar" aria-valuenow="${completedCount}" aria-valuemin="0" aria-valuemax="${storiesCount}">
        <div class="progress-bar__fill" style="width: ${pct}%"></div>
      </div>
      <div class="progress-summary__stars">
        ⭐ ${totalStars} / ${maxStars} Stars Earned
      </div>
    </div>
  `;
  container.appendChild(hero);

  // Modules Grid
  const grid = document.createElement('section');
  grid.className = 'modules-grid';
  grid.setAttribute('aria-label', 'PHONIX Learning Modules');

  for (const mod of PHONIX_MODULES) {
    const isPlayable = mod.status === 'playable';
    const card = document.createElement('article');
    card.className = `module-card ${isPlayable ? 'module-card--active' : ''}`;

    const specsHtml = mod.specs
      .map((s) => `<span class="spec-chip">${escapeHtml(s)}</span>`)
      .join('');

    const extraInfo = isPlayable
      ? `<span class="spec-chip">${completedCount}/${storiesCount} done</span>`
      : '';

    const actions = Array.isArray(mod.actions)
      ? mod.actions
      : [{ label: mod.actionLabel, mode: null, primary: isPlayable }];

    const actionsHtml = actions
      .map(
        (act) => `
          <button type="button" class="btn ${act.primary ? 'btn--primary' : 'btn--secondary'}" data-module-id="${mod.id}" ${act.mode ? `data-mode="${act.mode}"` : ''}>
            ${escapeHtml(act.label)}
          </button>
        `
      )
      .join('');

    card.innerHTML = `
      <div class="module-card__header">
        <span class="module-card__icon" aria-hidden="true">${mod.icon}</span>
        <span class="status-badge ${isPlayable ? 'status-badge--playable' : 'status-badge--scaffolded'}">
          ${escapeHtml(mod.statusLabel)}
        </span>
      </div>
      <h2 class="module-card__title">${escapeHtml(mod.title)}</h2>
      <p class="module-card__desc">${escapeHtml(mod.description)}</p>
      <div class="module-card__meta">
        ${specsHtml}
        ${extraInfo}
      </div>
      <div class="module-card__footer" style="flex-wrap:wrap;">
        ${actionsHtml}
      </div>
    `;

    card.querySelectorAll('button[data-module-id]').forEach((btn) => {
      btn.addEventListener('click', () => onOpenModule(mod.id, btn.dataset.mode || null));
    });

    grid.appendChild(card);
  }

  container.appendChild(grid);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
