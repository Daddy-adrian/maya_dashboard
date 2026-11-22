/**
 * PHONIX Remi: The CVC Word Builder
 * Single-player phonics card game with 52-card shuffled deck, 14-slot hand rack,
 * central table drop zone, smooth mouse/touch drag-and-drop, and rule validation.
 */

import { loadRemiCards, shuffleDeck, validateRemiSet } from '../data/remiData.js';

const HAND_SIZE = 14;

/**
 * Mounts PHONIX Remi into `container`.
 * @param {HTMLElement} container
 * @param {{ onBackToDashboard: () => void, announce: (msg: string) => void }} options
 * @returns {() => void} Cleanup function
 */
export function mountRemiGame(container, { onBackToDashboard, announce }) {
  let masterCards = [];
  let deck = [];
  let hand = Array(HAND_SIZE).fill(null);
  let tableSets = [];
  let selectedSlots = new Set();
  let feedback = { type: 'info', text: 'Select 3 or more matching cards, then drag them to the table!' };
  let isWinner = false;
  let invalidShakeSlots = new Set();
  let dragCleanup = null;

  function startNewGame() {
    deck = shuffleDeck(masterCards);
    hand = Array(HAND_SIZE).fill(null);
    for (let i = 0; i < HAND_SIZE && deck.length > 0; i += 1) {
      hand[i] = deck.pop();
    }
    tableSets = [];
    selectedSlots = new Set();
    invalidShakeSlots = new Set();
    isWinner = false;
    feedback = {
      type: 'info',
      text: 'Tap cards to group 3+ matching words, then drag them onto the table!'
    };
    render();
    announce('New PHONIX Remi game started. 14 cards dealt to your hand.');
  }

  function getHandCount() {
    return hand.filter(Boolean).length;
  }

  function drawFromDeck() {
    if (isWinner) return;
    const emptyIdx = hand.findIndex((slot) => slot === null);
    if (emptyIdx === -1) {
      feedback = { type: 'retry', text: 'Your hand is full (14/14). Play a set first!' };
      render();
      return;
    }
    if (deck.length === 0) {
      feedback = { type: 'retry', text: 'No cards left in the deck!' };
      render();
      return;
    }

    const drawn = deck.pop();
    hand[emptyIdx] = drawn;
    feedback = { type: 'info', text: `Drew "${drawn.word}" into slot ${emptyIdx + 1}.` };
    announce(`Drew ${drawn.word}. ${deck.length} cards left in deck.`);
    render();
  }

  function toggleSlotSelection(slotIndex) {
    if (!hand[slotIndex] || isWinner) return;
    if (selectedSlots.has(slotIndex)) {
      selectedSlots.delete(slotIndex);
    } else {
      selectedSlots.add(slotIndex);
    }
    render();
  }

  function attemptPlaySlots(slotIndices, targetSetId = null) {
    const uniqueSlots = [...new Set(slotIndices)].filter((i) => hand[i] !== null);
    const cards = uniqueSlots.map((i) => hand[i]);

    if (targetSetId) {
      const targetSet = tableSets.find((s) => s.id === targetSetId);
      if (!targetSet || cards.length === 0) return false;

      const combined = [...targetSet.cards, ...cards];
      const result = validateRemiSet(combined);

      if (!result.valid) {
        invalidShakeSlots = new Set(uniqueSlots);
        feedback = {
          type: 'retry',
          text: "Try again! That card doesn't match this set's vowel, ending, or first letter."
        };
        announce(feedback.text);
        render();
        setTimeout(() => {
          invalidShakeSlots.clear();
          container.querySelectorAll('.remi-card--shake').forEach((el) => {
            el.classList.remove('remi-card--shake');
          });
        }, 420);
        return false;
      }

      targetSet.cards = combined;
      targetSet.ruleLabel = result.rules[0] || targetSet.ruleLabel;

      for (const idx of uniqueSlots) {
        hand[idx] = null;
        selectedSlots.delete(idx);
      }

      if (getHandCount() === 0) {
        isWinner = true;
        feedback = { type: 'success', text: 'YOU WIN! PHONIX Master!' };
        announce('Congratulations! You win! PHONIX Master!');
      } else {
        feedback = { type: 'success', text: `Added to set! (${targetSet.ruleLabel})` };
        announce(feedback.text);
      }

      render();
      return true;
    }

    const result = validateRemiSet(cards);

    if (!result.valid) {
      invalidShakeSlots = new Set(uniqueSlots);
      feedback = { type: 'retry', text: result.message };
      announce(result.message);
      render();
      setTimeout(() => {
        invalidShakeSlots.clear();
        container.querySelectorAll('.remi-card--shake').forEach((el) => {
          el.classList.remove('remi-card--shake');
        });
      }, 420);
      return false;
    }

    // Lock valid set onto the table
    tableSets.push({
      id: `set-${Date.now()}-${tableSets.length}`,
      cards,
      ruleLabel: result.rules[0] || 'Valid Set'
    });

    for (const idx of uniqueSlots) {
      hand[idx] = null;
      selectedSlots.delete(idx);
    }

    if (getHandCount() === 0) {
      isWinner = true;
      feedback = { type: 'success', text: 'YOU WIN! PHONIX Master!' };
      announce('Congratulations! You win! PHONIX Master!');
    } else {
      feedback = { type: 'success', text: result.message };
      announce(result.message);
    }

    render();
    return true;
  }

  function findTargetSetAtPoint(x, y) {
    const setEls = container.querySelectorAll('.remi-locked-set[data-set-id]');
    for (const el of setEls) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return el;
      }
    }
    return null;
  }

  function setupPointerDrag(cardEl, slotIndex) {
    cardEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (!hand[slotIndex] || isWinner) return;

      const startX = e.clientX;
      const startY = e.clientY;
      let isDragging = false;
      let ghost = null;
      let dragSlots = [];

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (!isDragging && Math.hypot(dx, dy) > 8) {
          isDragging = true;
          dragSlots = selectedSlots.has(slotIndex) && selectedSlots.size > 0
            ? [...selectedSlots]
            : [slotIndex];

          ghost = createDragGhost(dragSlots.map((i) => hand[i]).filter(Boolean));
          document.body.appendChild(ghost);

          dragSlots.forEach((i) => {
            const el = container.querySelector(`[data-slot-index="${i}"] .remi-card`);
            if (el) el.classList.add('remi-card--dragging');
          });
        }

        if (isDragging && ghost) {
          ghost.style.transform = `translate3d(${moveEvent.clientX - 39}px, ${moveEvent.clientY - 52}px, 0)`;

          container.querySelectorAll('.remi-locked-set--dragover').forEach((el) => {
            el.classList.remove('remi-locked-set--dragover');
          });

          const hoveredSet = findTargetSetAtPoint(moveEvent.clientX, moveEvent.clientY);
          const dropZone = container.querySelector('#remi-table-dropzone');

          if (hoveredSet) {
            hoveredSet.classList.add('remi-locked-set--dragover');
            if (dropZone) dropZone.classList.remove('remi-table--dragover');
          } else if (dropZone) {
            const rect = dropZone.getBoundingClientRect();
            const over =
              moveEvent.clientX >= rect.left &&
              moveEvent.clientX <= rect.right &&
              moveEvent.clientY >= rect.top &&
              moveEvent.clientY <= rect.bottom;
            dropZone.classList.toggle('remi-table--dragover', over);
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

        const dropZone = container.querySelector('#remi-table-dropzone');
        if (dropZone) {
          dropZone.classList.remove('remi-table--dragover');
        }
        container.querySelectorAll('.remi-locked-set--dragover').forEach((el) => {
          el.classList.remove('remi-locked-set--dragover');
        });
        container.querySelectorAll('.remi-card--dragging').forEach((el) => {
          el.classList.remove('remi-card--dragging');
        });

        if (!isDragging) {
          toggleSlotSelection(slotIndex);
          return;
        }

        const targetSetEl = findTargetSetAtPoint(endEvent.clientX, endEvent.clientY);
        if (targetSetEl) {
          attemptPlaySlots(dragSlots, targetSetEl.dataset.setId);
          return;
        }

        if (dropZone) {
          const rect = dropZone.getBoundingClientRect();
          const droppedOnTable =
            endEvent.clientX >= rect.left &&
            endEvent.clientX <= rect.right &&
            endEvent.clientY >= rect.top &&
            endEvent.clientY <= rect.bottom;

          if (droppedOnTable) {
            attemptPlaySlots(dragSlots);
          }
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
    });
  }

  function createDragGhost(cards) {
    const ghost = document.createElement('div');
    ghost.className = 'remi-drag-ghost';
    const previewCard = cards[0];
    ghost.innerHTML = `
      <div class="remi-card remi-card--ghost">
        <img src="${previewCard.image}" alt="" class="remi-card__img">
        ${cards.length > 1 ? `<span class="remi-ghost-count">+${cards.length - 1}</span>` : ''}
      </div>
    `;
    return ghost;
  }

  function buildCardElement(card, slotIndex, { interactive = true } = {}) {
    const el = document.createElement(interactive ? 'button' : 'div');
    if (interactive) {
      el.type = 'button';
      el.setAttribute(
        'aria-pressed',
        String(selectedSlots.has(slotIndex))
      );
      el.setAttribute(
        'aria-label',
        `${card.isJoker ? 'Joker wild card' : `Word ${card.word}`}${selectedSlots.has(slotIndex) ? ', selected' : ''}`
      );
    }

    const isSelected = interactive && selectedSlots.has(slotIndex);
    const isShaking = interactive && invalidShakeSlots.has(slotIndex);
    el.className = `remi-card ${isSelected ? 'remi-card--selected' : ''} ${isShaking ? 'remi-card--shake' : ''}`;

    const img = document.createElement('img');
    img.src = card.image;
    img.alt = card.isJoker ? 'Joker' : card.word;
    img.className = 'remi-card__img';
    img.draggable = false;
    img.addEventListener('error', () => {
      img.style.display = 'none';
      const fallback = document.createElement('span');
      fallback.className = 'remi-card__fallback';
      fallback.textContent = card.isJoker ? '★' : card.word;
      el.appendChild(fallback);
    });

    el.appendChild(img);

    if (interactive) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleSlotSelection(slotIndex);
        }
      });
      setupPointerDrag(el, slotIndex);
    }

    return el;
  }

  function render() {
    const handCount = getHandCount();
    const canDraw = handCount < HAND_SIZE && deck.length > 0 && !isWinner;

    container.innerHTML = '';

    // Top Bar
    const topbar = document.createElement('div');
    topbar.className = 'game-topbar';
    topbar.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
        <button type="button" class="btn btn--secondary" id="remi-back-btn">← Dashboard</button>
        <h1 id="page-heading" class="game-topbar__title" tabindex="-1">
          🃏 PHONIX Remi: The CVC Word Builder
        </h1>
      </div>
      <div class="story-nav">
        <span class="spec-chip">Hand: ${handCount} / ${HAND_SIZE}</span>
        <span class="spec-chip">Sets on Table: ${tableSets.length}</span>
        <button type="button" class="btn btn--secondary" id="remi-new-game-btn">New Deal</button>
      </div>
    `;
    topbar.querySelector('#remi-back-btn').addEventListener('click', onBackToDashboard);
    topbar.querySelector('#remi-new-game-btn').addEventListener('click', startNewGame);
    container.appendChild(topbar);

    // Feedback Banner
    const fb = document.createElement('div');
    fb.className = `remi-feedback remi-feedback--${feedback.type}`;
    fb.setAttribute('role', 'status');
    fb.textContent = feedback.text;
    container.appendChild(fb);

    // Main Arena: Central Table Drop Zone + Side Deck Pile
    const arena = document.createElement('div');
    arena.className = 'remi-arena';

    // Central Table
    const tableZone = document.createElement('section');
    tableZone.id = 'remi-table-dropzone';
    tableZone.className = 'remi-table';
    tableZone.setAttribute('aria-label', 'Table play area for valid CVC word sets');

    if (isWinner) {
      const winCard = document.createElement('div');
      winCard.className = 'remi-win-banner';
      winCard.innerHTML = `
        <h2>🏆 YOU WIN! PHONIX Master!</h2>
        <p>You cleared all 14 cards in ${tableSets.length} valid phonics sets!</p>
        <div class="story-complete-card__actions">
          <button type="button" class="btn btn--success" id="remi-play-again-btn">Play Again</button>
          <button type="button" class="btn btn--secondary" id="remi-win-dash-btn">Back to Dashboard</button>
        </div>
      `;
      winCard.querySelector('#remi-play-again-btn').addEventListener('click', startNewGame);
      winCard.querySelector('#remi-win-dash-btn').addEventListener('click', onBackToDashboard);
      tableZone.appendChild(winCard);
    }

    if (tableSets.length === 0 && !isWinner) {
      const emptyHint = document.createElement('div');
      emptyHint.className = 'remi-table__empty';
      emptyHint.innerHTML = `
        <p><strong>Table Play Area</strong></p>
        <p>Drag 3 or more matching cards here (Same Vowel, Same Ending, or Same First Letter).</p>
      `;
      tableZone.appendChild(emptyHint);
    } else {
      const setsWrap = document.createElement('div');
      setsWrap.className = 'remi-table__sets';
      for (const setObj of tableSets) {
        const group = document.createElement('div');
        group.className = 'remi-locked-set';
        group.dataset.setId = setObj.id;

        const headerRow = document.createElement('div');
        headerRow.className = 'remi-locked-set__header';

        const ruleBadge = document.createElement('span');
        ruleBadge.className = 'remi-locked-set__rule';
        ruleBadge.textContent = setObj.ruleLabel;
        headerRow.appendChild(ruleBadge);

        if (selectedSlots.size > 0 && !isWinner) {
          const addBtn = document.createElement('button');
          addBtn.type = 'button';
          addBtn.className = 'remi-locked-set__add-btn';
          addBtn.textContent = '+ Add Selected';
          addBtn.addEventListener('click', () => {
            attemptPlaySlots([...selectedSlots], setObj.id);
          });
          headerRow.appendChild(addBtn);
        }

        group.appendChild(headerRow);

        const cardsRow = document.createElement('div');
        cardsRow.className = 'remi-locked-set__cards';
        setObj.cards.forEach((c) => {
          cardsRow.appendChild(buildCardElement(c, -1, { interactive: false }));
        });
        group.appendChild(cardsRow);
        setsWrap.appendChild(group);
      }
      tableZone.appendChild(setsWrap);
    }

    arena.appendChild(tableZone);

    // Side Deck Pile
    const deckAside = document.createElement('aside');
    deckAside.className = 'remi-deck-panel';
    deckAside.setAttribute('aria-label', 'Draw Deck');

    const deckBtn = document.createElement('button');
    deckBtn.type = 'button';
    deckBtn.className = 'remi-deck-btn';
    deckBtn.disabled = !canDraw;
    deckBtn.innerHTML = `
      <span class="remi-deck-btn__stack" aria-hidden="true">🃏</span>
      <span class="remi-deck-btn__title">Draw Card</span>
      <span class="remi-deck-btn__count">${deck.length} left</span>
    `;
    deckBtn.addEventListener('click', drawFromDeck);

    const deckHint = document.createElement('p');
    deckHint.className = 'remi-deck-hint';
    deckHint.textContent =
      handCount >= HAND_SIZE
        ? 'Hand full (14/14). Play a set to draw.'
        : deck.length === 0
          ? 'Deck is empty.'
          : 'Click to fill an empty slot.';

    deckAside.appendChild(deckBtn);
    deckAside.appendChild(deckHint);
    arena.appendChild(deckAside);

    container.appendChild(arena);

    // Action Bar for Selected Cards
    const actionBar = document.createElement('div');
    actionBar.className = 'remi-hand-actions';
    actionBar.innerHTML = `
      <span class="remi-hand-actions__status">
        Selected: <strong>${selectedSlots.size}</strong> card${selectedSlots.size === 1 ? '' : 's'}
      </span>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button type="button" class="btn btn--secondary" id="remi-clear-sel-btn" ${selectedSlots.size === 0 ? 'disabled' : ''}>
          Clear Selection
        </button>
        <button type="button" class="btn btn--primary" id="remi-play-sel-btn" ${selectedSlots.size === 0 || isWinner ? 'disabled' : ''}>
          Place Selected Set on Table
        </button>
      </div>
    `;
    actionBar.querySelector('#remi-clear-sel-btn').addEventListener('click', () => {
      selectedSlots.clear();
      render();
    });
    actionBar.querySelector('#remi-play-sel-btn').addEventListener('click', () => {
      attemptPlaySlots([...selectedSlots]);
    });
    container.appendChild(actionBar);

    // 14-Slot Horizontal Hand Rack
    const rackSection = document.createElement('section');
    rackSection.className = 'remi-hand-rack';
    rackSection.setAttribute('aria-label', 'Player 14-card hand rack');

    const rackGrid = document.createElement('div');
    rackGrid.className = 'remi-hand-grid';

    for (let i = 0; i < HAND_SIZE; i += 1) {
      const slot = document.createElement('div');
      slot.className = 'remi-hand-slot';
      slot.dataset.slotIndex = String(i);

      if (hand[i]) {
        slot.appendChild(buildCardElement(hand[i], i, { interactive: true }));
      } else {
        const empty = document.createElement('div');
        empty.className = 'remi-empty-slot';
        empty.setAttribute('aria-label', `Empty slot ${i + 1}`);
        empty.textContent = String(i + 1);
        slot.appendChild(empty);
      }

      rackGrid.appendChild(slot);
    }

    rackSection.appendChild(rackGrid);
    container.appendChild(rackSection);
  }

  // Load cards and start
  container.innerHTML = `<div class="loading-state" role="status"><p>Shuffling 52 PHONIX Remi cards…</p></div>`;
  loadRemiCards().then((cards) => {
    masterCards = cards;
    startNewGame();
  });

  return () => {
    if (typeof dragCleanup === 'function') dragCleanup();
  };
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
