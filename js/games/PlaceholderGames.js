/**
 * PHONIX Scaffolded Module Specs (Modules 2–6)
 * Provides clear game rules, short-vowel color specs, and data schemas
 * when a learner or teacher clicks any upcoming module on the Dashboard.
 */

const MODULE_SPECS = {
  'cvc-rummikub': {
    title: 'CVC Rummikub / Remi',
    icon: '🃏',
    summary:
      'A tile-melding phonics card game with 50 CVC cards color-coded by short vowel plus 2 Gold Jokers.',
    rules: [
      'Deck composition: 10 Red (short a), 10 Blue (short e), 10 Green (short i), 10 Orange (short o), 10 Purple (short u), and 2 Gold Jokers.',
      'Rhyme Set: 3+ cards sharing the same rime ending across different colors (e.g., cat, hat, mat or bug, mug, rug).',
      'Vowel Run: 3+ cards of the same short-vowel color family with distinct onsets/codas.',
      'Gold Jokers can substitute for any CVC card in a Rhyme Set or Vowel Run.'
    ],
    schema: `{
  "id": "cvc-01",
  "word": "cat",
  "vowel": "a",         // "a" | "e" | "i" | "o" | "u" | "joker"
  "color": "red",       // "red" | "blue" | "green" | "orange" | "purple" | "gold"
  "rime": "-at",
  "isJoker": false
}`
  },
  'odd-one-out': {
    title: 'Odd One Out',
    icon: '🔍',
    summary:
      'Critical thinking and phonemic discrimination across two distinct challenge modes.',
    rules: [
      'Mode A (Phrase-to-Picture Mismatch): Show an illustration alongside 3 short phrases — spot the phrase that does NOT match the picture.',
      'Mode B (Short-Vowel Sound / Color Odd-One-Out): Present 4 CVC cards where 3 share the same short vowel & color and 1 belongs to a different vowel family.'
    ],
    schema: `{
  "mode": "B",          // "A": Phrase mismatch | "B": Vowel sound/color
  "cards": [
    { "word": "bed", "vowel": "e", "color": "blue" },
    { "word": "red", "vowel": "e", "color": "blue" },
    { "word": "ten", "vowel": "e", "color": "blue" },
    { "word": "pin", "vowel": "i", "color": "green" }
  ],
  "oddIndex": 3
}`
  },
  'have-has-tetris': {
    title: 'Have / Has Tetris',
    icon: '🧱',
    summary:
      'Fast-paced arcade sorting game: steer falling subject blocks into the correct HAVE or HAS drop box.',
    rules: [
      'Two drop boxes at the bottom: HAVE [I, you, we, they] on the left and HAS [he, she, it] on the right.',
      'Subject blocks fall from the top; steer with Left / Right / Down arrow keys or on-screen touch buttons.',
      'Landing a block in the matching box scores points and speeds up the round; mismatches give a gentle rule reminder.'
    ],
    schema: `{
  "dropBoxes": {
    "HAVE": ["I", "you", "we", "they"],
    "HAS": ["he", "she", "it"]
  },
  "controls": ["ArrowLeft", "ArrowRight", "ArrowDown", "onScreenButtons"]
}`
  }
};

/**
 * Renders a scaffolded module specification view.
 * @param {HTMLElement} container
 * @param {{ moduleId: string, onBackToDashboard: () => void }} options
 */
export function renderPlaceholderModule(container, { moduleId, onBackToDashboard }) {
  const spec = MODULE_SPECS[moduleId];
  if (!spec) {
    onBackToDashboard();
    return;
  }

  container.innerHTML = '';

  const topbar = document.createElement('div');
  topbar.className = 'game-topbar';
  topbar.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
      <button type="button" class="btn btn--secondary" id="placeholder-back-btn">← Dashboard</button>
      <h1 id="page-heading" class="game-topbar__title" tabindex="-1">
        ${spec.icon} ${spec.title}
      </h1>
    </div>
    <span class="status-badge status-badge--scaffolded">Coming Soon / Scaffolded</span>
  `;
  topbar.querySelector('#placeholder-back-btn').addEventListener('click', onBackToDashboard);
  container.appendChild(topbar);

  const panel = document.createElement('section');
  panel.className = 'spec-panel';
  panel.innerHTML = `
    <p style="margin-top:0; font-size:1.05rem;">${spec.summary}</p>
    <div class="spec-grid">
      <div class="spec-box">
        <h2>Game Rules &amp; Mechanics</h2>
        <ul>
          ${spec.rules.map((r) => `<li>${r}</li>`).join('')}
        </ul>
      </div>
      <div class="spec-box">
        <h2>Planned Data Schema</h2>
        <pre class="schema-block"><code>${escapeHtml(spec.schema)}</code></pre>
      </div>
    </div>
  `;
  container.appendChild(panel);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
