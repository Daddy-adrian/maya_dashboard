/**
 * PHONIX Direction Pig Game
 * Clean, distraction-free UI with:
 * - Immediate opposite-mode flip on wrong answer (same target, flipped Picture <-> Word)
 * - Spaced-repetition active recall re-queuing within the session + localStorage mastery tracking
 */

const DIRECTION_ITEMS = [
  { id: 'before_infront', image: './directions/pig_before_infront.jpeg', label: 'before / in front' },
  { id: 'behind', image: './directions/pig_behind.jpeg', label: 'behind / after' },
  { id: 'down', image: './directions/pig_down.jpeg', label: 'down' },
  { id: 'in_inside', image: './directions/pig_in_inside.jpeg', label: 'in / inside' },
  { id: 'left', image: './directions/pig_left.jpeg', label: 'left' },
  { id: 'next_by', image: './directions/pig_next_by.jpeg', label: 'next to / by' },
  { id: 'on', image: './directions/pig_on.jpeg', label: 'on' },
  { id: 'right', image: './directions/pig_right.jpeg', label: 'right' },
  { id: 'under', image: './directions/pig_under.jpeg', label: 'under' },
  { id: 'up', image: './directions/pig_up.jpeg', label: 'up' }
];

const SRS_STORAGE_KEY = 'phonix_direction_pig_srs_v1';

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function loadSrsState() {
  try {
    const raw = localStorage.getItem(SRS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveSrsState(state) {
  try {
    localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

function buildQuestion(target, mode) {
  const others = shuffle(DIRECTION_ITEMS.filter((item) => item.id !== target.id)).slice(0, 2);
  const options = shuffle([target, ...others]);
  return { target, options, mode };
}

function playSuccessChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    [523.25, 659.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.08, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.24);
    });
  } catch {
    // Optional audio
  }
}

/**
 * Mounts Direction Pig into `container`.
 * @param {HTMLElement} container
 * @param {{ onBackToDashboard: () => void, announce: (msg: string) => void }} options
 * @returns {() => void} Cleanup function
 */
export function mountDirectionPigGame(container, { onBackToDashboard, announce }) {
  let srsState = loadSrsState();
  let queue = [];
  let currentIdx = 0;
  let correctCount = 0;
  let sessionRecalls = {};
  let wrongIds = new Set();
  let hadMistakeThisRound = false;
  let roundSolved = false;
  let advanceTimer = null;

  const speechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  function clearAdvanceTimer() {
    if (advanceTimer !== null) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  }

  function buildSession() {
    clearAdvanceTimer();
    sessionRecalls = {};

    // Prioritize items with lower mastery streak / more lapses first, shuffled within tiers
    const orderedTargets = shuffle(DIRECTION_ITEMS).sort((a, b) => {
      const sa = srsState[a.id]?.streak ?? 0;
      const sb = srsState[b.id]?.streak ?? 0;
      if (sa !== sb) return sa - sb;
      const la = srsState[a.id]?.lapses ?? 0;
      const lb = srsState[b.id]?.lapses ?? 0;
      return lb - la;
    });

    queue = orderedTargets.map((target, idx) =>
      buildQuestion(target, idx % 2 === 0 ? 'picture-to-word' : 'word-to-picture')
    );

    currentIdx = 0;
    correctCount = 0;
    wrongIds = new Set();
    hadMistakeThisRound = false;
    roundSolved = false;
    render();
    announce('Started Direction Pig.');
  }

  function speakLabel(text) {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text.replaceAll('/', ' or '));
    utter.lang = 'en-US';
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  }

  function recordSrsResult(itemId, isCorrect) {
    const prev = srsState[itemId] || { streak: 0, lapses: 0 };
    if (isCorrect) {
      srsState[itemId] = {
        streak: prev.streak + 1,
        lapses: prev.lapses,
        lastSeen: Date.now()
      };
    } else {
      srsState[itemId] = {
        streak: 0,
        lapses: prev.lapses + 1,
        lastSeen: Date.now()
      };
    }
    saveSrsState(srsState);
  }

  function handlePick(chosenItem) {
    if (roundSolved) return;
    const currentQ = queue[currentIdx];

    if (chosenItem.id === currentQ.target.id) {
      roundSolved = true;
      if (!hadMistakeThisRound) {
        correctCount += 1;
        recordSrsResult(currentQ.target.id, true);
      }
      playSuccessChime();
      announce(`Correct! ${currentQ.target.label}.`);
      render();

      clearAdvanceTimer();
      advanceTimer = setTimeout(() => {
        advanceTimer = null;
        currentIdx += 1;
        wrongIds = new Set();
        hadMistakeThisRound = false;
        roundSolved = false;
        render();
      }, 750);
    } else {
      wrongIds.add(chosenItem.id);

      if (!hadMistakeThisRound) {
        hadMistakeThisRound = true;
        recordSrsResult(currentQ.target.id, false);

        // 1. Queue opposite-mode flip for the same target as the very next question
        const flippedMode =
          currentQ.mode === 'picture-to-word' ? 'word-to-picture' : 'picture-to-word';
        queue.splice(currentIdx + 1, 0, buildQuestion(currentQ.target, flippedMode));

        // 2. Spaced-repetition active recall 3 questions later (capped at 2 extra recalls per item/session)
        const countSoFar = sessionRecalls[currentQ.target.id] || 0;
        if (countSoFar < 2) {
          sessionRecalls[currentQ.target.id] = countSoFar + 1;
          const spacedIndex = Math.min(queue.length, currentIdx + 4);
          const recallMode = countSoFar % 2 === 0 ? currentQ.mode : flippedMode;
          queue.splice(spacedIndex, 0, buildQuestion(currentQ.target, recallMode));
        }
      }

      announce('Try again.');
      render();
    }
  }

  function render() {
    container.innerHTML = '';

    const isFinished = currentIdx >= queue.length;
    const totalQ = queue.length;
    const shownQ = isFinished ? totalQ : currentIdx + 1;
    const pct = totalQ > 0 ? Math.round(((isFinished ? totalQ : currentIdx) / totalQ) * 100) : 0;

    // Top Bar
    const topbar = document.createElement('div');
    topbar.className = 'game-topbar';
    topbar.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
        <button type="button" class="btn btn--secondary" id="dir-back-btn">← Dashboard</button>
        <h1 id="page-heading" class="game-topbar__title" tabindex="-1">
          🐷 Direction Pig
        </h1>
      </div>
      <div class="story-nav">
        <span class="spec-chip">${shownQ} / ${totalQ}</span>
        <span class="spec-chip">Correct: ${correctCount}</span>
        <button type="button" class="btn btn--secondary" id="dir-restart-btn">New Session</button>
      </div>
    `;
    topbar.querySelector('#dir-back-btn').addEventListener('click', () => {
      clearAdvanceTimer();
      if (speechSupported) window.speechSynthesis.cancel();
      onBackToDashboard();
    });
    topbar.querySelector('#dir-restart-btn').addEventListener('click', buildSession);
    container.appendChild(topbar);

    // Progress Bar
    const progWrap = document.createElement('div');
    progWrap.className = 'dir-progress-wrap';
    progWrap.innerHTML = `
      <div class="progress-bar" role="progressbar" aria-valuenow="${isFinished ? totalQ : currentIdx}" aria-valuemin="0" aria-valuemax="${totalQ}">
        <div class="progress-bar__fill" style="width: ${pct}%"></div>
      </div>
    `;
    container.appendChild(progWrap);

    if (isFinished) {
      const summary = document.createElement('section');
      summary.className = 'dir-summary';
      summary.innerHTML = `
        <h2>🎉 Great Recall!</h2>
        <p>You completed all <strong>${totalQ}</strong> cards with <strong>${correctCount}</strong> correct answers.</p>
        <div class="story-complete-card__actions">
          <button type="button" class="btn btn--success" id="dir-play-again-btn">Play Again</button>
          <button type="button" class="btn btn--secondary" id="dir-done-dash-btn">Back to Dashboard</button>
        </div>
      `;
      summary.querySelector('#dir-play-again-btn').addEventListener('click', buildSession);
      summary.querySelector('#dir-done-dash-btn').addEventListener('click', onBackToDashboard);
      container.appendChild(summary);
      return;
    }

    const q = queue[currentIdx];
    const stage = document.createElement('section');
    stage.className = 'dir-stage';
    stage.setAttribute('aria-label', `Question ${currentIdx + 1}`);

    // Clean, to-the-point Prompt Card (no mode badge or extra instructions)
    const promptCard = document.createElement('div');
    promptCard.className = 'dir-target-card';

    if (q.mode === 'picture-to-word') {
      promptCard.innerHTML = `
        <div class="dir-target-image-frame">
          <img src="${q.target.image}" alt="Direction Pig" loading="eager" fetchpriority="high">
        </div>
      `;
    } else {
      promptCard.innerHTML = `
        <div class="dir-target-word-row">
          <span class="dir-target-word">${q.target.label}</span>
          ${speechSupported ? '<button type="button" class="btn btn--secondary" id="dir-speak-btn" aria-label="Hear word">🔊</button>' : ''}
        </div>
      `;
      const speakBtn = promptCard.querySelector('#dir-speak-btn');
      if (speakBtn) {
        speakBtn.addEventListener('click', () => speakLabel(q.target.label));
      }
    }

    stage.appendChild(promptCard);

    // Choices Grid
    const choicesWrap = document.createElement('div');
    choicesWrap.className =
      q.mode === 'picture-to-word' ? 'dir-word-choices' : 'dir-image-choices';

    q.options.forEach((opt) => {
      const isCorrect = roundSolved && opt.id === q.target.id;
      const isWrong = wrongIds.has(opt.id);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `dir-choice-btn ${
        q.mode === 'word-to-picture' ? 'dir-choice-btn--image' : 'dir-choice-btn--word'
      } ${isCorrect ? 'dir-choice--correct' : ''} ${isWrong ? 'dir-choice--wrong' : ''}`;

      if (roundSolved) {
        btn.disabled = true;
      }

      if (q.mode === 'picture-to-word') {
        btn.textContent = opt.label;
      } else {
        btn.setAttribute('aria-label', opt.label);
        const img = document.createElement('img');
        img.src = opt.image;
        img.alt = opt.label;
        img.loading = 'eager';
        btn.appendChild(img);
      }

      btn.addEventListener('click', () => handlePick(opt));
      choicesWrap.appendChild(btn);
    });

    stage.appendChild(choicesWrap);
    container.appendChild(stage);
  }

  buildSession();

  return () => {
    clearAdvanceTimer();
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
  };
}
