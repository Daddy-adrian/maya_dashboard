/**
 * Blank Space Sentences (2 Levels: Level 1 = Pronouns, Level 2 = Subjects)
 * Every word in every sentence comes strictly from stories/gemini-code-1795344057315.json.
 */

export const AM_IS_ARE_LEVELS = {
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

export const HAVE_HAS_LEVELS = {
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
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.08, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.22);
    });
  } catch {
    // Optional audio
  }
}

/**
 * Mounts 2-level Blank Space Sentences inside `container`.
 * @param {HTMLElement} container
 * @param {{ title: string, options: string[], levels: { pronouns: Array<{text: string, answer: string}>, subjects: Array<{text: string, answer: string}> }, onSwitchToTetris: () => void, onBackToDashboard: () => void, announce: (msg: string) => void }} config
 * @returns {() => void} Cleanup function
 */
export function mountTetrisLevel2(
  container,
  { title, options, levels, onSwitchToTetris, onBackToDashboard, announce }
) {
  const isHaveHas = options.includes('have');
  let activeLevel = 'pronouns'; // 'pronouns' | 'subjects'
  let sessionQuestions = [];
  let qIndex = 0;
  let score = 0;
  let wrongChoices = new Set();
  let hadMistake = false;
  let solved = false;
  let feedbackText = '';
  let advanceTimer = null;

  function clearAdvanceTimer() {
    if (advanceTimer !== null) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  }

  function startLevel(levelKey) {
    clearAdvanceTimer();
    activeLevel = levelKey;
    sessionQuestions = shuffle(levels[levelKey]).slice(0, 10);
    qIndex = 0;
    score = 0;
    wrongChoices = new Set();
    hadMistake = false;
    solved = false;
    feedbackText = '';
    render();
    announce(`Started ${levelKey === 'pronouns' ? 'Level 1: Pronouns' : 'Level 2: Subjects'}.`);
  }

  function handleChoice(choice) {
    if (solved) return;
    const current = sessionQuestions[qIndex];

    if (choice === current.answer) {
      solved = true;
      if (!hadMistake) {
        score += 1;
      } else if (!current.isRepeat) {
        sessionQuestions.splice(qIndex + 1, 0, { ...current, isRepeat: true });
      }
      feedbackText = '';
      playSuccessChime();
      announce(`Correct! ${current.text.replace('_____', current.answer)}`);
      render();

      clearAdvanceTimer();
      advanceTimer = setTimeout(() => {
        advanceTimer = null;
        qIndex += 1;
        wrongChoices = new Set();
        hadMistake = false;
        solved = false;
        feedbackText = '';
        render();
      }, 900);
    } else {
      hadMistake = true;
      wrongChoices.add(choice);
      feedbackText = isHaveHas
        ? '"he, she, it" → has   |   "I, you, we, they" → have'
        : '"I" → am   |   "he, she, it" → is   |   "you, we, they" → are';
      announce(feedbackText);
      render();
    }
  }

  function render() {
    container.innerHTML = '';

    const isDone = qIndex >= sessionQuestions.length;
    const shownNum = isDone ? sessionQuestions.length : qIndex + 1;
    const pct = Math.round(((isDone ? sessionQuestions.length : qIndex) / sessionQuestions.length) * 100);

    // Top Bar
    const topbar = document.createElement('div');
    topbar.className = 'game-topbar';
    topbar.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
        <button type="button" class="btn btn--secondary" id="l2-back-btn">← Dashboard</button>
        <h1 id="page-heading" class="game-topbar__title" tabindex="-1">
          📖 ${title} — Sentences
        </h1>
      </div>
      <div class="story-nav">
        <span class="spec-chip">Question: ${shownNum} / ${sessionQuestions.length}</span>
        <span class="spec-chip">Score: ${score}</span>
        <button type="button" class="btn btn--secondary" id="l2-restart-btn">Play Tetris</button>
      </div>
    `;
    topbar.querySelector('#l2-back-btn').addEventListener('click', () => {
      clearAdvanceTimer();
      onBackToDashboard();
    });
    topbar.querySelector('#l2-restart-btn').addEventListener('click', () => {
      clearAdvanceTimer();
      onSwitchToTetris();
    });
    container.appendChild(topbar);

    // Level Selector Bar (Level 1: Pronouns | Level 2: Subjects)
    const levelBar = document.createElement('div');
    levelBar.className = 'ooo-mode-bar';
    levelBar.innerHTML = `
      <button type="button" class="btn ${activeLevel === 'pronouns' ? 'btn--primary' : 'btn--secondary'}" id="l2-lvl1-btn">
        Level 1: Pronouns
      </button>
      <button type="button" class="btn ${activeLevel === 'subjects' ? 'btn--primary' : 'btn--secondary'}" id="l2-lvl2-btn">
        Level 2: Subjects
      </button>
    `;
    levelBar.querySelector('#l2-lvl1-btn').addEventListener('click', () => startLevel('pronouns'));
    levelBar.querySelector('#l2-lvl2-btn').addEventListener('click', () => startLevel('subjects'));
    container.appendChild(levelBar);

    const progWrap = document.createElement('div');
    progWrap.className = 'dir-progress-wrap';
    progWrap.innerHTML = `
      <div class="progress-bar" role="progressbar" aria-valuenow="${isDone ? sessionQuestions.length : qIndex}" aria-valuemin="0" aria-valuemax="${sessionQuestions.length}">
        <div class="progress-bar__fill" style="width: ${pct}%"></div>
      </div>
    `;
    container.appendChild(progWrap);

    if (isDone) {
      const summary = document.createElement('section');
      summary.className = 'dir-summary';
      summary.innerHTML = `
        <h2>🎉 ${activeLevel === 'pronouns' ? 'Level 1 (Pronouns)' : 'Level 2 (Subjects)'} Complete!</h2>
        <p>
          Score: <strong>${score} / ${sessionQuestions.length}</strong>
        </p>
        <div class="story-complete-card__actions">
          ${activeLevel === 'pronouns'
            ? '<button type="button" class="btn btn--success" id="l2-next-lvl-btn">Next: Level 2 (Subjects) →</button>'
            : '<button type="button" class="btn btn--success" id="l2-play-again-btn">Play Level 2 Again</button>'}
          <button type="button" class="btn btn--secondary" id="l2-tetris-btn">Play Tetris</button>
          <button type="button" class="btn btn--secondary" id="l2-dash-btn">Back to Dashboard</button>
        </div>
      `;
      const nextLvlBtn = summary.querySelector('#l2-next-lvl-btn');
      if (nextLvlBtn) {
        nextLvlBtn.addEventListener('click', () => startLevel('subjects'));
      }
      const playAgainBtn = summary.querySelector('#l2-play-again-btn');
      if (playAgainBtn) {
        playAgainBtn.addEventListener('click', () => startLevel('subjects'));
      }
      summary.querySelector('#l2-tetris-btn').addEventListener('click', () => {
        clearAdvanceTimer();
        onSwitchToTetris();
      });
      summary.querySelector('#l2-dash-btn').addEventListener('click', () => {
        clearAdvanceTimer();
        onBackToDashboard();
      });
      container.appendChild(summary);
      return;
    }

    const current = sessionQuestions[qIndex];
    const parts = current.text.split('_____');

    const card = document.createElement('section');
    card.className = 'l2-card';
    card.setAttribute('aria-label', `Fill in the blank question ${qIndex + 1}`);

    card.innerHTML = `
      <span class="status-badge status-badge--playable">
        ${activeLevel === 'pronouns' ? 'Level 1: Pronouns' : 'Level 2: Subjects'}
      </span>
      <p class="l2-sentence">
        ${parts[0]}<span class="l2-blank ${solved ? 'l2-blank--filled' : ''}">${solved ? current.answer : '_____'}</span>${parts[1] || ''}
      </p>
      ${feedbackText ? `<div class="l2-feedback" role="status">${feedbackText}</div>` : ''}
      <div class="l2-choices" role="group" aria-label="Choose the missing word"></div>
    `;

    const choicesWrap = card.querySelector('.l2-choices');
    options.forEach((opt) => {
      const isCorrect = solved && opt === current.answer;
      const isWrong = wrongChoices.has(opt);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn l2-choice-btn ${isCorrect ? 'l2-choice--correct' : ''} ${isWrong ? 'l2-choice--wrong' : ''}`;
      btn.textContent = opt;
      if (solved) btn.disabled = true;
      btn.addEventListener('click', () => handleChoice(opt));
      choicesWrap.appendChild(btn);
    });

    container.appendChild(card);
  }

  startLevel('pronouns');
  return clearAdvanceTimer;
}
