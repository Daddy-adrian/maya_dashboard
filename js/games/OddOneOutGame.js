/**
 * PHONIX Odd One Out: Drag & Match
 * Bidirectional 4-vs-3 matching across vowels_images/, pronoun/, and story_images/.
 */

const TOTAL_ROUNDS = 10;

const FALLBACK_ITEMS = [
  { id: 'cat', word: 'cat', image: './odd_one_out_img/cat.png', category: 'animals', vowel: 'a' },
  { id: 'hat', word: 'hat', image: './odd_one_out_img/hat.png', category: 'objects', vowel: 'a' },
  { id: 'bat', word: 'bat', image: './odd_one_out_img/bat.png', category: 'animals', vowel: 'a' },
  { id: 'bag', word: 'bag', image: './odd_one_out_img/bag.png', category: 'objects', vowel: 'a' },
  { id: 'dog', word: 'dog', image: './odd_one_out_img/dog.png', category: 'animals', vowel: 'o' },
  { id: 'log', word: 'log', image: './odd_one_out_img/log.png', category: 'objects', vowel: 'o' },
  { id: 'pig', word: 'pig', image: './odd_one_out_img/pig.png', category: 'animals', vowel: 'i' },
  { id: 'bug', word: 'bug', image: './odd_one_out_img/bug.png', category: 'animals', vowel: 'u' },
  { id: 'bus', word: 'bus', image: './odd_one_out_img/bus.png', category: 'transport', vowel: 'u' },
  { id: 'jet', word: 'jet', image: './odd_one_out_img/jet.png', category: 'transport', vowel: 'e' },
  { id: 'cup', word: 'cup', image: './odd_one_out_img/cup.png', category: 'objects', vowel: 'u' },
  { id: 'sun', word: 'sun', image: './odd_one_out_img/sun.png', category: 'objects', vowel: 'u' }
];

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function loadOddOneOutItems() {
  try {
    const res = await fetch('./odd_one_out_items.json', { cache: 'default' });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length >= 4) {
        return json;
      }
    }
  } catch {
    // Fall back cleanly
  }
  return FALLBACK_ITEMS;
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
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.07, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.2);
      });
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(175, now + 0.18);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  } catch {
    // Optional audio
  }
}

function pickSmartDistractor(targets, allItems) {
  const targetIds = new Set(targets.map((t) => t.id));
  const candidates = allItems.filter((item) => !targetIds.has(item.id));

  const targetVowels = new Set(targets.map((t) => t.vowel).filter(Boolean));
  const targetCats = new Set(targets.map((t) => t.category).filter(Boolean));

  // Prefer a distractor sharing vowel or category for meaningful challenge
  const smartPool = candidates.filter(
    (c) => (c.vowel && targetVowels.has(c.vowel)) || targetCats.has(c.category)
  );
  const pool = smartPool.length > 0 ? smartPool : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Mounts Odd One Out: Drag & Match into `container`.
 * @param {HTMLElement} container
 * @param {{ onBackToDashboard: () => void, announce: (msg: string) => void }} options
 * @returns {() => void} Cleanup function
 */
export function mountOddOneOutGame(container, { onBackToDashboard, announce }) {
  let allItems = [];
  let modeSetting = 'mixed'; // 'mixed' | 'words-to-pictures' | 'pictures-to-words'
  let roundNum = 0;
  let score = 0;
  let currentRound = null;
  let selectedDragId = null;
  let wrongFlashTargetId = null;
  let wrongFlashDragId = null;
  let autoAdvanceTimer = null;

  function clearAdvanceTimer() {
    if (autoAdvanceTimer !== null) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
  }

  function startSession() {
    clearAdvanceTimer();
    roundNum = 1;
    score = 0;
    buildRound();
    announce('Started Odd One Out: Drag and Match.');
  }

  function resolveRoundMode() {
    if (modeSetting === 'words-to-pictures') return 'words-to-pictures';
    if (modeSetting === 'pictures-to-words') return 'pictures-to-words';
    return roundNum % 2 === 1 ? 'words-to-pictures' : 'pictures-to-words';
  }

  function buildRound() {
    clearAdvanceTimer();
    selectedDragId = null;
    wrongFlashTargetId = null;
    wrongFlashDragId = null;

    const targets = shuffle(allItems).slice(0, 3);
    const distractor = pickSmartDistractor(targets, allItems);
    const mode = resolveRoundMode();

    currentRound = {
      mode,
      targets: shuffle(targets),
      draggables: shuffle([...targets, distractor]),
      distractorId: distractor.id,
      matchedMap: {}, // targetId -> item
      placedIds: new Set(),
      hadMistake: false,
      completed: false
    };

    render();
  }

  function nextRound() {
    clearAdvanceTimer();
    if (roundNum >= TOTAL_ROUNDS) {
      roundNum = TOTAL_ROUNDS + 1;
      render();
      announce(`Game complete! Final score: ${score}.`);
      return;
    }
    roundNum += 1;
    buildRound();
  }

  function attemptMatch(dragItemId, targetId) {
    if (!currentRound || currentRound.completed) return;
    if (currentRound.matchedMap[targetId] || currentRound.placedIds.has(dragItemId)) return;

    if (dragItemId === targetId) {
      const matchedItem = currentRound.draggables.find((d) => d.id === dragItemId);
      currentRound.matchedMap[targetId] = matchedItem;
      currentRound.placedIds.add(dragItemId);
      selectedDragId = null;
      playTone(true);
      announce(`Matched ${matchedItem.word}!`);

      if (Object.keys(currentRound.matchedMap).length === 3) {
        currentRound.completed = true;
        score += currentRound.hadMistake ? 5 : 10;
        announce('All 3 matched! Odd one out found.');
        render();

        clearAdvanceTimer();
        autoAdvanceTimer = setTimeout(() => {
          autoAdvanceTimer = null;
          nextRound();
        }, 1500);
        return;
      }

      render();
    } else {
      currentRound.hadMistake = true;
      wrongFlashTargetId = targetId;
      wrongFlashDragId = dragItemId;
      selectedDragId = null;
      playTone(false);
      announce('Not a match. Try another spot.');
      render();

      setTimeout(() => {
        wrongFlashTargetId = null;
        wrongFlashDragId = null;
        container.querySelectorAll('.ooo-shake').forEach((el) => {
          el.classList.remove('ooo-shake', 'ooo-wrong');
        });
      }, 450);
    }
  }

  function setupPointerDrag(dragEl, item) {
    dragEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (!currentRound || currentRound.completed || currentRound.placedIds.has(item.id)) return;

      const startX = e.clientX;
      const startY = e.clientY;
      let isDragging = false;
      let ghost = null;

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (!isDragging && Math.hypot(dx, dy) > 8) {
          isDragging = true;
          ghost = dragEl.cloneNode(true);
          ghost.classList.add('ooo-drag-ghost');
          ghost.style.width = `${dragEl.offsetWidth}px`;
          document.body.appendChild(ghost);
          dragEl.classList.add('ooo-dragging');
        }

        if (isDragging && ghost) {
          ghost.style.transform = `translate3d(${moveEvent.clientX - dragEl.offsetWidth / 2}px, ${moveEvent.clientY - 36}px, 0)`;

          container.querySelectorAll('.ooo-target--dragover').forEach((el) => {
            el.classList.remove('ooo-target--dragover');
          });
          const hovered = findTargetAtPoint(moveEvent.clientX, moveEvent.clientY);
          if (hovered) {
            hovered.classList.add('ooo-target--dragover');
          }
        }
      };

      const onEnd = (endEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);

        if (ghost) {
          ghost.remove();
          ghost = null;
        }
        dragEl.classList.remove('ooo-dragging');
        container.querySelectorAll('.ooo-target--dragover').forEach((el) => {
          el.classList.remove('ooo-target--dragover');
        });

        if (!isDragging) {
          selectedDragId = selectedDragId === item.id ? null : item.id;
          render();
          return;
        }

        const targetEl = findTargetAtPoint(endEvent.clientX, endEvent.clientY);
        if (targetEl && targetEl.dataset.targetId) {
          attemptMatch(item.id, targetEl.dataset.targetId);
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
    });
  }

  function findTargetAtPoint(x, y) {
    const targets = container.querySelectorAll('.ooo-target[data-target-id]');
    for (const el of targets) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return el;
      }
    }
    return null;
  }

  function render() {
    container.innerHTML = '';

    const isFinished = roundNum > TOTAL_ROUNDS;
    const shownRound = isFinished ? TOTAL_ROUNDS : roundNum;
    const pct = Math.round(((isFinished ? TOTAL_ROUNDS : roundNum - 1) / TOTAL_ROUNDS) * 100);

    // Top Bar
    const topbar = document.createElement('div');
    topbar.className = 'game-topbar';
    topbar.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
        <button type="button" class="btn btn--secondary" id="ooo-back-btn">← Dashboard</button>
        <h1 id="page-heading" class="game-topbar__title" tabindex="-1">
          🔍 Odd One Out: Drag &amp; Match
        </h1>
      </div>
      <div class="story-nav">
        <span class="spec-chip">Round ${shownRound} / ${TOTAL_ROUNDS}</span>
        <span class="spec-chip">Score: ${score}</span>
        <button type="button" class="btn btn--secondary" id="ooo-restart-btn">Restart</button>
      </div>
    `;
    topbar.querySelector('#ooo-back-btn').addEventListener('click', () => {
      clearAdvanceTimer();
      onBackToDashboard();
    });
    topbar.querySelector('#ooo-restart-btn').addEventListener('click', startSession);
    container.appendChild(topbar);

    // Mode Selector & Progress Bar
    const modeBar = document.createElement('div');
    modeBar.className = 'ooo-mode-bar';
    const modes = [
      { id: 'mixed', label: 'Mixed (Both)' },
      { id: 'words-to-pictures', label: '4 Words → 3 Pictures' },
      { id: 'pictures-to-words', label: '4 Pictures → 3 Words' }
    ];
    modes.forEach((m) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn ${modeSetting === m.id ? 'btn--primary' : 'btn--secondary'}`;
      btn.textContent = m.label;
      btn.addEventListener('click', () => {
        if (modeSetting !== m.id) {
          modeSetting = m.id;
          startSession();
        }
      });
      modeBar.appendChild(btn);
    });
    container.appendChild(modeBar);

    const progWrap = document.createElement('div');
    progWrap.className = 'dir-progress-wrap';
    progWrap.innerHTML = `
      <div class="progress-bar" role="progressbar" aria-valuenow="${isFinished ? TOTAL_ROUNDS : roundNum - 1}" aria-valuemin="0" aria-valuemax="${TOTAL_ROUNDS}">
        <div class="progress-bar__fill" style="width: ${pct}%"></div>
      </div>
    `;
    container.appendChild(progWrap);

    if (isFinished) {
      const summary = document.createElement('section');
      summary.className = 'dir-summary';
      summary.innerHTML = `
        <h2>🎉 All 10 Rounds Complete!</h2>
        <p>Final Score: <strong>${score} / ${TOTAL_ROUNDS * 10}</strong></p>
        <div class="story-complete-card__actions">
          <button type="button" class="btn btn--success" id="ooo-play-again-btn">Play Again</button>
          <button type="button" class="btn btn--secondary" id="ooo-done-dash-btn">Back to Dashboard</button>
        </div>
      `;
      summary.querySelector('#ooo-play-again-btn').addEventListener('click', startSession);
      summary.querySelector('#ooo-done-dash-btn').addEventListener('click', onBackToDashboard);
      container.appendChild(summary);
      return;
    }

    const r = currentRound;

    // 3 Drop Zone Targets
    const targetsSection = document.createElement('section');
    targetsSection.className = 'ooo-targets-grid';
    targetsSection.setAttribute('aria-label', '3 Target Drop Zones');

    r.targets.forEach((target) => {
      const matched = r.matchedMap[target.id];
      const isWrong = wrongFlashTargetId === target.id;
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.dataset.targetId = target.id;
      slot.className = `ooo-target ${matched ? 'ooo-target--matched' : ''} ${
        isWrong ? 'ooo-wrong ooo-shake' : ''
      }`;

      if (r.mode === 'words-to-pictures') {
        slot.innerHTML = `
          <div class="ooo-target__media">
            <img src="${target.image}" alt="${target.word}" loading="eager">
          </div>
          <div class="ooo-target__slot-box">
            ${matched ? `<span class="ooo-matched-pill">${matched.word} ✓</span>` : '<span class="ooo-slot-hint">Drop word here</span>'}
          </div>
        `;
      } else {
        slot.innerHTML = `
          <div class="ooo-target__word-prompt">${target.word}</div>
          <div class="ooo-target__slot-box ooo-target__slot-box--img">
            ${matched ? `<img src="${matched.image}" alt="${matched.word}" class="ooo-matched-img">` : '<span class="ooo-slot-hint">Drop picture here</span>'}
          </div>
        `;
      }

      slot.addEventListener('click', () => {
        if (selectedDragId && !matched) {
          attemptMatch(selectedDragId, target.id);
        }
      });

      targetsSection.appendChild(slot);
    });

    container.appendChild(targetsSection);

    // 4 Draggable Items Tray
    const traySection = document.createElement('section');
    traySection.className = 'ooo-tray-grid';
    traySection.setAttribute('aria-label', '4 Draggable Items');

    r.draggables.forEach((item) => {
      const isPlaced = r.placedIds.has(item.id);
      const isOddOneOut = r.completed && !isPlaced && item.id === r.distractorId;
      const isSelected = selectedDragId === item.id;
      const isWrong = wrongFlashDragId === item.id;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = `ooo-drag-item ${
        r.mode === 'words-to-pictures' ? 'ooo-drag-item--word' : 'ooo-drag-item--pic'
      } ${isPlaced ? 'ooo-drag-item--placed' : ''} ${
        isSelected ? 'ooo-drag-item--selected' : ''
      } ${isOddOneOut ? 'ooo-drag-item--odd' : ''} ${
        isWrong ? 'ooo-wrong ooo-shake' : ''
      }`;

      if (isPlaced) {
        card.disabled = true;
      }

      if (r.mode === 'words-to-pictures') {
        card.innerHTML = `
          <span>${item.word}</span>
          ${isOddOneOut ? '<span class="ooo-odd-badge">The Odd One Out!</span>' : ''}
        `;
      } else {
        card.setAttribute('aria-label', item.word);
        card.innerHTML = `
          <img src="${item.image}" alt="${item.word}" draggable="false" loading="eager">
          ${isOddOneOut ? '<span class="ooo-odd-badge">The Odd One Out!</span>' : ''}
        `;
      }

      if (!isPlaced && !r.completed) {
        setupPointerDrag(card, item);
      }

      traySection.appendChild(card);
    });

    container.appendChild(traySection);

    if (r.completed) {
      const nextWrap = document.createElement('div');
      nextWrap.className = 'ooo-next-wrap';
      nextWrap.innerHTML = `
        <button type="button" class="btn btn--success" id="ooo-next-btn">
          ${roundNum >= TOTAL_ROUNDS ? 'See Summary →' : 'Next Round →'}
        </button>
      `;
      nextWrap.querySelector('#ooo-next-btn').addEventListener('click', nextRound);
      container.appendChild(nextWrap);
    }
  }

  container.innerHTML = `<div class="loading-state" role="status"><p>Loading Odd One Out…</p></div>`;
  loadOddOneOutItems().then((items) => {
    allItems = items;
    startSession();
  });

  return () => {
    clearAdvanceTimer();
  };
}
