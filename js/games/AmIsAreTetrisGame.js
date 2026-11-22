/**
 * PHONIX Am / Is / Are Tetris (Stage 1: Pronouns)
 * 16:9 playfield with multi-card 1.5s spawn pressure, active-card steering,
 * Slow/Normal speed toggle, and pause-on-mistake retry.
 */

import { mountTetrisLevel2, AM_IS_ARE_LEVELS } from './TetrisLevel2.js';

const PRONOUN_FILES = [
  'i.jpeg',
  'he.jpeg', 'he_1.jpeg', 'he_2.jpeg', 'he_3.jpeg',
  'she.jpeg', 'she_1.jpeg', 'she_2.jpeg', 'she_3.jpeg',
  'it.jpeg', 'it_1.jpeg', 'it_2.jpeg',
  'we.jpeg', 'we_1.jpeg', 'we_2.jpeg', 'we_3.jpeg',
  'they.jpeg', 'they_1.jpeg', 'they_2.jpeg', 'they_3.jpeg',
  'you.jpeg'
];

const BUCKETS = ['am', 'is', 'are'];
const ROUND_LENGTH = 15;
const PACE_INTERVALS_MS = [Infinity, 5000, 3800, 2900, 2200, 1500, 1300, 1100, 950, 800, 650];
const DEFAULT_PACE_LEVEL = 1;

function mapPronounAsset(filename) {
  const prefix = filename.replace(/\.jpeg$/i, '').split('_')[0].toLowerCase();
  let verb = 'is';
  let pronoun = 'It';

  if (prefix === 'i') {
    verb = 'am';
    pronoun = 'I';
  } else if (prefix === 'he' || prefix === 'she' || prefix === 'it') {
    verb = 'is';
    pronoun = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  } else if (prefix === 'we' || prefix === 'they' || prefix === 'you') {
    verb = 'are';
    pronoun = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }

  return {
    filename,
    image: `./pronoun/${filename}`,
    pronoun,
    verb,
    bucketIndex: BUCKETS.indexOf(verb)
  };
}

const ALL_CARDS = PRONOUN_FILES.map(mapPronounAsset);

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildRoundCards() {
  const shuffled = shuffle(ALL_CARDS).slice(0, ROUND_LENGTH);
  if (!shuffled.some((c) => c.verb === 'am')) {
    const iCard = ALL_CARDS.find((c) => c.verb === 'am');
    if (iCard) shuffled[Math.floor(Math.random() * shuffled.length)] = iCard;
  }
  return shuffle(shuffled);
}

function playTone(isCorrect) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (isCorrect) {
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
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.linearRampToValueAtTime(190, now + 0.22);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    }
  } catch {
    // Audio is optional
  }
}

/**
 * Mounts Am / Is / Are Tetris into `container`.
 * @param {HTMLElement} container
 * @param {{ onBackToDashboard: () => void, announce: (msg: string) => void }} options
 * @returns {() => void} Cleanup function
 */
export function mountAmIsAreTetrisGame(container, { initialMode = 'tetris', onBackToDashboard, announce }) {
  let roundCards = [];
  let spawnedCount = 0;
  let resolvedCount = 0;
  let activeCards = []; // [{ uid, card, lane, progressY, fastDropping, hadMistake }]
  let retryCard = null;
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  let speedMode = 'slow'; // 'slow' (7.5s) | 'normal' (5.2s)
  let paceLevel = DEFAULT_PACE_LEVEL; // 0 (no pressure) .. 10 (fastest)
  let phase = 'playing'; // 'playing' | 'retry' | 'done'
  let bucketFlash = null; // { lane: number, type: 'correct' | 'wrong', text: string }
  let spawnElapsedMs = 0;
  let rafId = null;
  let lastFrameTime = 0;
  let flashClearTimer = null;
  let level2Cleanup = null;

  function clearTimers() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (flashClearTimer !== null) {
      clearTimeout(flashClearTimer);
      flashClearTimer = null;
    }
    if (typeof level2Cleanup === 'function') {
      level2Cleanup();
      level2Cleanup = null;
    }
  }

  function getFallDurationMs() {
    return speedMode === 'slow' ? 7500 : 5200;
  }

  function getControlledCard() {
    if (phase === 'retry' && retryCard) return retryCard;
    if (activeCards.length === 0) return null;
    // Lowest card (highest progressY) is always the one being steered
    return activeCards.reduce((lowest, item) =>
      item.progressY > lowest.progressY ? item : lowest
    );
  }

  function startNewRound() {
    clearTimers();
    roundCards = buildRoundCards();
    spawnedCount = 0;
    resolvedCount = 0;
    activeCards = [];
    retryCard = null;
    score = 0;
    streak = 0;
    bestStreak = 0;
    bucketFlash = null;
    spawnElapsedMs = 0;
    phase = 'playing';

    spawnNextCard();
    render();
    startLoop();
    announce('Started Am, Is, Are Tetris! 15 cards.');
  }

  function spawnNextCard() {
    if (spawnedCount >= roundCards.length) return false;
    const card = roundCards[spawnedCount];
    const uid = `tcard-${spawnedCount}-${Date.now()}`;
    spawnedCount += 1;

    activeCards.push({
      uid,
      card,
      lane: Math.floor(Math.random() * 3),
      progressY: 0,
      fastDropping: false,
      hadMistake: false
    });
    return true;
  }

  function startLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    lastFrameTime = performance.now();

    const tick = (now) => {
      if (phase !== 'playing') return;
      const dt = Math.min(now - lastFrameTime, 100);
      lastFrameTime = now;

      // Spawn next card at the current 0-10 pace level (0 = only when board is clear)
      const intervalMs = PACE_INTERVALS_MS[paceLevel] ?? 1500;
      if (spawnedCount < roundCards.length && Number.isFinite(intervalMs)) {
        spawnElapsedMs += dt;
        if (spawnElapsedMs >= intervalMs) {
          spawnElapsedMs -= intervalMs;
          spawnNextCard();
          renderPlayfieldCards();
          updateTopChips();
        }
      }

      const fallDuration = getFallDurationMs();
      let landedItem = null;

      for (const item of activeCards) {
        const dur = item.fastDropping ? 220 : fallDuration;
        item.progressY += dt / dur;
        if (item.progressY >= 1 && !landedItem) {
          item.progressY = 1;
          landedItem = item;
        }
      }

      updateAllCardPositions();

      if (landedItem) {
        handleLanding(landedItem);
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  }

  function updateAllCardPositions() {
    const playfield = container.querySelector('#tetris-playfield');
    if (!playfield) return;

    const fieldHeight = playfield.clientHeight;
    const controlled = getControlledCard();

    for (const item of activeCards) {
      const el = container.querySelector(`[data-card-uid="${item.uid}"]`);
      if (!el) continue;
      const cardHeight = el.offsetHeight || 126;
      const maxTop = Math.max(0, fieldHeight - cardHeight - 12);
      const topPx = item.progressY * maxTop;
      const leftPct = item.lane * 33.3333 + 16.6667;

      el.style.left = `${leftPct}%`;
      el.style.transform = `translate(-50%, ${topPx}px)`;
      el.classList.toggle('tetris-falling-card--controlled', controlled?.uid === item.uid);
    }

    highlightActiveLane(controlled ? controlled.lane : 1);
  }

  function highlightActiveLane(laneIdx) {
    container.querySelectorAll('.tetris-lane').forEach((el, idx) => {
      el.classList.toggle('tetris-lane--active', idx === laneIdx);
    });
    container.querySelectorAll('.tetris-bucket').forEach((el, idx) => {
      el.classList.toggle('tetris-bucket--active', idx === laneIdx);
    });
  }

  function moveLane(delta) {
    const controlled = getControlledCard();
    if (!controlled || (phase !== 'playing' && phase !== 'retry')) return;

    const next = Math.max(0, Math.min(2, controlled.lane + delta));
    if (next !== controlled.lane) {
      controlled.lane = next;
      updateAllCardPositions();
      if (phase === 'retry') {
        checkRetryLane();
      }
    }
  }

  function setLane(lane) {
    const controlled = getControlledCard();
    if (!controlled || (phase !== 'playing' && phase !== 'retry') || lane < 0 || lane > 2) return;

    controlled.lane = lane;
    updateAllCardPositions();
    if (phase === 'retry') {
      checkRetryLane();
    }
  }

  function triggerDrop() {
    if (phase === 'retry') {
      checkRetryLane();
      return;
    }
    const controlled = getControlledCard();
    if (phase === 'playing' && controlled) {
      controlled.fastDropping = true;
    }
  }

  function checkRetryLane() {
    if (!retryCard) return;
    if (retryCard.lane === retryCard.card.bucketIndex) {
      resolveCardSuccess(retryCard);
    } else {
      const chosenVerb = BUCKETS[retryCard.lane];
      bucketFlash = {
        lane: retryCard.lane,
        type: 'wrong',
        text: `${retryCard.card.pronoun} ${retryCard.card.verb} (not ${retryCard.card.pronoun} ${chosenVerb}) — move to ${retryCard.card.verb}!`
      };
      render();
    }
  }

  function handleLanding(item) {
    if (item.lane === item.card.bucketIndex) {
      resolveCardSuccess(item);
      return;
    }

    // Wrong bucket: pause all falling & spawning until the learner moves it to the right bucket
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    item.hadMistake = true;
    streak = 0;
    phase = 'retry';
    retryCard = item;

    const chosenVerb = BUCKETS[item.lane];
    bucketFlash = {
      lane: item.lane,
      type: 'wrong',
      text: `${item.card.pronoun} ${item.card.verb} (not ${item.card.pronoun} ${chosenVerb}) — move to ${item.card.verb}!`
    };
    playTone(false);
    announce(`Oops! ${item.card.pronoun} ${item.card.verb}. Move the card to ${item.card.verb}.`);
    render();
  }

  function resolveCardSuccess(item) {
    activeCards = activeCards.filter((c) => c.uid !== item.uid);
    retryCard = null;
    resolvedCount += 1;

    if (!item.hadMistake) {
      score += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    }

    bucketFlash = {
      lane: item.lane,
      type: 'correct',
      text: `${item.card.pronoun} ${item.card.verb}!`
    };
    playTone(true);
    announce(`Correct! ${item.card.pronoun} ${item.card.verb}.`);

    if (flashClearTimer !== null) clearTimeout(flashClearTimer);
    flashClearTimer = setTimeout(() => {
      flashClearTimer = null;
      bucketFlash = null;
      const fbEl = container.querySelector('.tetris-feedback');
      if (fbEl && phase === 'playing') {
        fbEl.className = 'tetris-feedback';
        fbEl.textContent = 'Move the falling pronoun card into am, is, or are!';
      }
      container.querySelectorAll('.tetris-bucket--correct').forEach((b) => {
        b.classList.remove('tetris-bucket--correct');
      });
    }, 900);

    if (resolvedCount >= roundCards.length && activeCards.length === 0) {
      clearTimers();
      phase = 'done';
      render();
      announce(`Round complete! Score ${score} out of ${roundCards.length}.`);
      return;
    }

    phase = 'playing';
    if (activeCards.length === 0 && spawnedCount < roundCards.length) {
      spawnElapsedMs = 0;
      spawnNextCard();
    }

    render();
    startLoop();
  }

  function onKeyDown(e) {
    if (phase !== 'playing' && phase !== 'retry') return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveLane(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveLane(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      triggerDrop();
    }
  }

  window.addEventListener('keydown', onKeyDown);

  function updateTopChips() {
    const cardChip = container.querySelector('#tetris-card-chip');
    if (cardChip) {
      cardChip.textContent = `Card: ${Math.min(spawnedCount, roundCards.length)} / ${roundCards.length}`;
    }
  }

  function renderPlayfieldCards() {
    const playfield = container.querySelector('#tetris-playfield');
    if (!playfield) return;

    playfield.querySelectorAll('.tetris-falling-card').forEach((el) => el.remove());

    for (const item of activeCards) {
      const fallingCard = document.createElement('div');
      fallingCard.className = 'tetris-falling-card';
      fallingCard.dataset.cardUid = item.uid;
      fallingCard.innerHTML = `
        <span class="tetris-falling-card__label">${item.card.pronoun}</span>
        <img src="${item.card.image}" alt="${item.card.pronoun}" loading="eager">
      `;
      playfield.appendChild(fallingCard);
    }

    updateAllCardPositions();
  }

  function render() {
    container.innerHTML = '';

    const shownCardNum = phase === 'done' ? roundCards.length : Math.min(spawnedCount, roundCards.length);

    // Top Bar
    const topbar = document.createElement('div');
    topbar.className = 'game-topbar';
    topbar.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
        <button type="button" class="btn btn--secondary" id="tetris-back-btn">← Dashboard</button>
        <h1 id="page-heading" class="game-topbar__title" tabindex="-1">
          🧱 Am / Is / Are Tetris
        </h1>
      </div>
      <div class="story-nav">
        <span class="spec-chip" id="tetris-card-chip">Card: ${shownCardNum} / ${roundCards.length}</span>
        <span class="spec-chip">Score: ${score}</span>
        <span class="spec-chip">Streak: ${streak}</span>
        <button type="button" class="btn btn--secondary" id="tetris-speed-btn">
          Speed: ${speedMode === 'slow' ? 'Slow' : 'Normal'}
        </button>
        <button type="button" class="btn btn--secondary" id="tetris-restart-btn">Restart</button>
      </div>
    `;
    topbar.querySelector('#tetris-back-btn').addEventListener('click', () => {
      clearTimers();
      window.removeEventListener('keydown', onKeyDown);
      onBackToDashboard();
    });
    topbar.querySelector('#tetris-speed-btn').addEventListener('click', () => {
      speedMode = speedMode === 'slow' ? 'normal' : 'slow';
      const btn = topbar.querySelector('#tetris-speed-btn');
      if (btn) btn.textContent = `Speed: ${speedMode === 'slow' ? 'Slow' : 'Normal'}`;
    });
    topbar.querySelector('#tetris-restart-btn').addEventListener('click', startNewRound);
    container.appendChild(topbar);

    if (phase === 'done') {
      const accuracy = Math.round((score / roundCards.length) * 100);
      const summary = document.createElement('section');
      summary.className = 'dir-summary';
      summary.innerHTML = `
        <h2>🎉 Round Complete!</h2>
        <p>
          Score: <strong>${score} / ${roundCards.length}</strong> (${accuracy}% accuracy)
          &bull; Best Streak: <strong>${bestStreak}</strong>
        </p>
        <div class="story-complete-card__actions">
          <button type="button" class="btn btn--success" id="tetris-play-again-btn">Play Again</button>
          <button type="button" class="btn btn--secondary" id="tetris-done-dash-btn">Back to Dashboard</button>
        </div>
      `;
      summary.querySelector('#tetris-play-again-btn').addEventListener('click', startNewRound);
      summary.querySelector('#tetris-done-dash-btn').addEventListener('click', () => {
        clearTimers();
        window.removeEventListener('keydown', onKeyDown);
        onBackToDashboard();
      });
      container.appendChild(summary);
      return;
    }

    const controlled = getControlledCard();
    const activeLane = controlled ? controlled.lane : 1;

    // Big Feedback Strip
    const fbBar = document.createElement('div');
    fbBar.className = `tetris-feedback ${
      bucketFlash ? `tetris-feedback--${bucketFlash.type}` : ''
    }`;
    fbBar.setAttribute('role', 'status');
    fbBar.textContent = bucketFlash
      ? bucketFlash.text
      : 'Move the falling pronoun card into am, is, or are!';
    container.appendChild(fbBar);

    // Arena: Left Spawn Pace Slider + 16:9 Tetris Board
    const arena = document.createElement('div');
    arena.className = 'tetris-arena';

    const pacePanel = document.createElement('aside');
    pacePanel.className = 'tetris-pace-panel';
    pacePanel.setAttribute('aria-label', 'Spawn speed control');
    pacePanel.innerHTML = `
      <label for="tetris-pace-slider" class="tetris-pace-label">Spawn Speed</label>
      <span class="tetris-pace-value" id="tetris-pace-value">${paceLevel}</span>
      <input
        id="tetris-pace-slider"
        class="tetris-pace-slider"
        type="range"
        min="0"
        max="10"
        step="1"
        value="${paceLevel}"
        aria-label="Spawn speed from 0 to 10"
      >
      <div class="tetris-pace-ticks">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    `;
    const slider = pacePanel.querySelector('#tetris-pace-slider');
    const valueEl = pacePanel.querySelector('#tetris-pace-value');
    slider.addEventListener('input', (e) => {
      paceLevel = Number(e.target.value);
      valueEl.textContent = String(paceLevel);
    });
    slider.addEventListener('change', () => {
      slider.blur();
    });
    arena.appendChild(pacePanel);

    // 16:9 Tetris Board
    const board = document.createElement('section');
    board.className = 'tetris-board';
    board.setAttribute('aria-label', 'Am Is Are Tetris Playfield');

    const playfield = document.createElement('div');
    playfield.id = 'tetris-playfield';
    playfield.className = 'tetris-playfield';

    BUCKETS.forEach((verb, laneIdx) => {
      const lane = document.createElement('button');
      lane.type = 'button';
      lane.className = `tetris-lane ${laneIdx === activeLane ? 'tetris-lane--active' : ''}`;
      lane.setAttribute('aria-label', `Move card to ${verb} column`);
      lane.addEventListener('click', () => setLane(laneIdx));
      playfield.appendChild(lane);
    });

    board.appendChild(playfield);

    // 3 Bottom Buckets
    const bucketsRow = document.createElement('div');
    bucketsRow.className = 'tetris-buckets';

    BUCKETS.forEach((verb, laneIdx) => {
      const isFlashed = bucketFlash && bucketFlash.lane === laneIdx;
      const bucket = document.createElement('button');
      bucket.type = 'button';
      bucket.className = `tetris-bucket ${laneIdx === activeLane ? 'tetris-bucket--active' : ''} ${
        isFlashed ? `tetris-bucket--${bucketFlash.type}` : ''
      }`;
      bucket.textContent = verb;
      bucket.setAttribute('aria-label', `Bucket ${verb}`);
      bucket.addEventListener('click', () => {
        if (phase === 'playing') {
          if (activeLane === laneIdx) {
            triggerDrop();
          } else {
            setLane(laneIdx);
          }
        } else if (phase === 'retry') {
          setLane(laneIdx);
        }
      });
      bucketsRow.appendChild(bucket);
    });

    board.appendChild(bucketsRow);
    arena.appendChild(board);
    container.appendChild(arena);

    // On-Screen Controls
    const controls = document.createElement('div');
    controls.className = 'tetris-controls';
    controls.innerHTML = `
      <button type="button" class="btn btn--secondary tetris-ctrl-btn" id="tetris-left-btn" aria-label="Move Left">
        ◀ Left
      </button>
      <button type="button" class="btn btn--primary tetris-ctrl-btn" id="tetris-drop-btn" aria-label="Drop Card">
        ▼ Drop
      </button>
      <button type="button" class="btn btn--secondary tetris-ctrl-btn" id="tetris-right-btn" aria-label="Move Right">
        Right ▶
      </button>
    `;
    controls.querySelector('#tetris-left-btn').addEventListener('click', () => moveLane(-1));
    controls.querySelector('#tetris-drop-btn').addEventListener('click', triggerDrop);
    controls.querySelector('#tetris-right-btn').addEventListener('click', () => moveLane(1));
    container.appendChild(controls);

    renderPlayfieldCards();
  }

  function openSentencesMode() {
    clearTimers();
    window.removeEventListener('keydown', onKeyDown);
    phase = 'level2';
    level2Cleanup = mountTetrisLevel2(container, {
      title: 'Am / Is / Are',
      options: BUCKETS,
      levels: AM_IS_ARE_LEVELS,
      onSwitchToTetris: () => {
        window.addEventListener('keydown', onKeyDown);
        startNewRound();
      },
      onBackToDashboard,
      announce
    });
  }

  function showModePicker() {
    clearTimers();
    container.innerHTML = `
      <div class="game-topbar">
        <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
          <button type="button" class="btn btn--secondary" id="picker-back-btn">← Dashboard</button>
          <h1 id="page-heading" class="game-topbar__title" tabindex="-1">🧱 Am / Is / Are</h1>
        </div>
      </div>
      <section class="modules-grid" aria-label="Choose game mode">
        <article class="module-card module-card--active">
          <div class="module-card__header">
            <span class="module-card__icon" aria-hidden="true">🧱</span>
            <span class="status-badge status-badge--playable">Mode 1</span>
          </div>
          <h2 class="module-card__title">Tetris</h2>
          <p class="module-card__desc">Steer falling pronoun picture cards into the am, is, or are buckets.</p>
          <div class="module-card__footer">
            <button type="button" class="btn btn--primary" id="pick-tetris-btn">Play Tetris</button>
          </div>
        </article>
        <article class="module-card module-card--active">
          <div class="module-card__header">
            <span class="module-card__icon" aria-hidden="true">📖</span>
            <span class="status-badge status-badge--playable">Mode 2</span>
          </div>
          <h2 class="module-card__title">Blank Space Sentences</h2>
          <p class="module-card__desc">Choose am, is, or are to complete short school-book sentences.</p>
          <div class="module-card__footer">
            <button type="button" class="btn btn--primary" id="pick-sentences-btn">Play Sentences</button>
          </div>
        </article>
      </section>
    `;
    container.querySelector('#picker-back-btn').addEventListener('click', () => {
      clearTimers();
      window.removeEventListener('keydown', onKeyDown);
      onBackToDashboard();
    });
    container.querySelector('#pick-tetris-btn').addEventListener('click', startNewRound);
    container.querySelector('#pick-sentences-btn').addEventListener('click', openSentencesMode);
  }

  if (initialMode === 'sentences') {
    openSentencesMode();
  } else {
    startNewRound();
  }

  return () => {
    clearTimers();
    window.removeEventListener('keydown', onKeyDown);
  };
}
