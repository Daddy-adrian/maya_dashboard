/**
 * PHONIX Story Comprehension Game
 * Interactive 28-story reader with Read Aloud, Set A & Set B comprehension checks,
 * image preloading, and localStorage progress persistence.
 */

import { saveLastStoryId, saveStoryCompletion } from '../data/storiesData.js';

const CHOICE_LETTERS = ['A', 'B', 'C'];

/**
 * Mounts and manages the Story Comprehension game inside `container`.
 * @param {HTMLElement} container
 * @param {{ stories: Array<object>, progress: object, initialStoryId?: number, onProgressChange: (p: object) => void, onBackToDashboard: () => void, announce: (msg: string) => void }} options
 * @returns {() => void} Cleanup function (stops speech synthesis on unmount)
 */
export function mountStoryGame(
  container,
  { stories, progress, initialStoryId, onProgressChange, onBackToDashboard, announce }
) {
  let currentProgress = progress;
  let currentIndex = Math.max(
    0,
    stories.findIndex((s) => s.id === (initialStoryId ?? currentProgress.lastStoryId ?? 1))
  );
  if (currentIndex === -1) currentIndex = 0;

  let highlightedSentence = -1;
  let isSpeaking = false;
  let step = 'story'; // 'story' | 'setA' | 'setB'
  const speechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  // Per-story quiz state
  let quizState = createQuizState();

  function createQuizState() {
    return {
      setA: { solved: false, wrongIndices: new Set(), hadMistake: false, message: '' },
      setB: { solved: false, wrongIndices: new Set(), hadMistake: false, message: '' }
    };
  }

  function stopSpeech() {
    if (speechSupported && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    isSpeaking = false;
    highlightedSentence = -1;
  }

  function preloadNextImage(index) {
    const nextStory = stories[index + 1];
    if (!nextStory) return;
    const img = new Image();
    img.src = nextStory.image;
  }

  function selectStory(index) {
    if (index < 0 || index >= stories.length) return;
    stopSpeech();
    currentIndex = index;
    step = 'story';
    quizState = createQuizState();
    saveLastStoryId(stories[currentIndex].id);
    render();
    announce(`Loaded Story ${stories[currentIndex].id} of ${stories.length}.`);
  }

  function goToStep(nextStep) {
    stopSpeech();
    step = nextStep;
    render();
  }

  function readStoryAloud(story) {
    if (!speechSupported) return;
    if (isSpeaking) {
      stopSpeech();
      updateSentenceHighlights();
      updateSpeakButton();
      return;
    }

    window.speechSynthesis.cancel();
    isSpeaking = true;
    updateSpeakButton();

    let sIdx = 0;
    const speakNext = () => {
      if (!isSpeaking || sIdx >= story.sentences.length) {
        isSpeaking = false;
        highlightedSentence = -1;
        updateSentenceHighlights();
        updateSpeakButton();
        return;
      }

      highlightedSentence = sIdx;
      updateSentenceHighlights();

      const utter = new SpeechSynthesisUtterance(story.sentences[sIdx]);
      utter.lang = 'en-US';
      utter.rate = 0.88;
      utter.onend = () => {
        sIdx += 1;
        speakNext();
      };
      utter.onerror = () => {
        isSpeaking = false;
        highlightedSentence = -1;
        updateSentenceHighlights();
        updateSpeakButton();
      };

      window.speechSynthesis.speak(utter);
    };

    speakNext();
  }

  function updateSentenceHighlights() {
    const items = container.querySelectorAll('.sentence-item');
    items.forEach((el, idx) => {
      el.classList.toggle('sentence-item--highlighted', idx === highlightedSentence);
    });
  }

  function updateSpeakButton() {
    const btn = container.querySelector('#read-aloud-btn');
    if (!btn) return;
    btn.textContent = isSpeaking ? '⏹ Stop Reading' : '🔊 Read Aloud';
    btn.setAttribute('aria-pressed', String(isSpeaking));
  }

  function handleAnswer(setKey, question, choiceIdx) {
    const state = quizState[setKey];
    if (state.solved) return;

    if (choiceIdx === question.correctIndex) {
      state.solved = true;
      state.message = 'Great job! That matches the story.';
      announce(`Set ${question.set} correct!`);

      if (quizState.setA.solved && quizState.setB.solved) {
        const stars = !quizState.setA.hadMistake && !quizState.setB.hadMistake ? 2 : 1;
        currentProgress = saveStoryCompletion(stories[currentIndex].id, stars);
        onProgressChange(currentProgress);
        announce(`Story ${stories[currentIndex].id} completed! Earned ${stars} stars.`);
      }
    } else {
      state.hadMistake = true;
      state.wrongIndices.add(choiceIdx);
      state.message = 'Almost! Read the story again and try another choice.';
      announce(`Set ${question.set} not quite right. Try another choice.`);
    }

    render();
  }

  function render() {
    const story = stories[currentIndex];
    const isLastStory = currentIndex === stories.length - 1;
    const bothSolved = quizState.setA.solved && quizState.setB.solved;
    const completedMap = currentProgress.completedStories || {};
    const totalCompleted = Object.keys(completedMap).length;
    const totalStars = Object.values(completedMap).reduce((sum, e) => sum + (e?.stars || 0), 0);

    preloadNextImage(currentIndex);

    container.innerHTML = '';

    // Top Navigation Bar
    const topbar = document.createElement('div');
    topbar.className = 'game-topbar';
    topbar.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
        <button type="button" class="btn btn--secondary" id="back-dashboard-btn">
          ← Dashboard
        </button>
        <h1 id="page-heading" class="game-topbar__title" tabindex="-1">
          Story ${story.id} of ${stories.length}
        </h1>
      </div>
      <div class="story-nav">
        <button type="button" class="btn btn--secondary" id="prev-story-btn" ${currentIndex === 0 ? 'disabled' : ''}>
          ← Prev
        </button>
        <label for="story-jump-select" class="visually-hidden">Jump to story</label>
        <select id="story-jump-select" class="story-select">
          ${stories
            .map((s, idx) => {
              const done = completedMap[String(s.id)] ? ' ✓' : '';
              return `<option value="${idx}" ${idx === currentIndex ? 'selected' : ''}>Story ${s.id}${done}</option>`;
            })
            .join('')}
        </select>
        <button type="button" class="btn btn--secondary" id="next-story-btn" ${isLastStory ? 'disabled' : ''}>
          Next →
        </button>
      </div>
    `;
    container.appendChild(topbar);

    topbar.querySelector('#back-dashboard-btn').addEventListener('click', () => {
      stopSpeech();
      onBackToDashboard();
    });
    topbar.querySelector('#prev-story-btn').addEventListener('click', () => selectStory(currentIndex - 1));
    topbar.querySelector('#next-story-btn').addEventListener('click', () => selectStory(currentIndex + 1));
    topbar.querySelector('#story-jump-select').addEventListener('change', (e) => {
      selectStory(Number(e.target.value));
    });

    // Quick 1-28 Story Strip
    const strip = document.createElement('nav');
    strip.className = 'story-strip';
    strip.setAttribute('aria-label', 'Story selector 1 to 28');
    stories.forEach((s, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isCurrent = idx === currentIndex;
      const isDone = Boolean(completedMap[String(s.id)]);
      btn.className = `story-pill ${isCurrent ? 'story-pill--current' : ''} ${isDone ? 'story-pill--done' : ''}`;
      btn.textContent = String(s.id);
      btn.setAttribute('aria-label', `Story ${s.id}${isDone ? ', completed' : ''}`);
      if (isCurrent) btn.setAttribute('aria-current', 'page');
      btn.addEventListener('click', () => selectStory(idx));
      strip.appendChild(btn);
    });
    container.appendChild(strip);

    // Step Switcher (Story | Set A | Set B) for free navigation back and forth
    const stepTabs = document.createElement('div');
    stepTabs.className = 'ooo-mode-bar';
    stepTabs.setAttribute('role', 'tablist');
    stepTabs.setAttribute('aria-label', 'Story steps');
    [
      { id: 'story', label: '📖 Story' },
      { id: 'setA', label: `Set A${quizState.setA.solved ? ' ✓' : ''}` },
      { id: 'setB', label: `Set B${quizState.setB.solved ? ' ✓' : ''}` }
    ].forEach((tab) => {
      const tBtn = document.createElement('button');
      tBtn.type = 'button';
      tBtn.role = 'tab';
      tBtn.ariaSelected = String(step === tab.id);
      tBtn.className = `btn ${step === tab.id ? 'btn--primary' : 'btn--secondary'}`;
      tBtn.textContent = tab.label;
      tBtn.addEventListener('click', () => goToStep(tab.id));
      stepTabs.appendChild(tBtn);
    });
    container.appendChild(stepTabs);

    // Main Stage: Single-step flow (Story -> Set A -> Set B)
    const stage = document.createElement('div');
    stage.className = 'story-single-stage';

    if (step === 'story') {
      const storyCard = document.createElement('section');
      storyCard.className = 'illustration-card';
      storyCard.setAttribute('aria-label', `Story ${story.id} illustration and text`);

      const frame = document.createElement('div');
      frame.className = 'illustration-frame';

      const img = document.createElement('img');
      img.src = story.image;
      img.alt = `Illustration for PHONIX Story ${story.id}`;
      img.loading = 'eager';
      img.setAttribute('fetchpriority', 'high');

      img.addEventListener('error', () => {
        frame.innerHTML = `
          <div class="illustration-fallback">
            <span class="illustration-fallback__num">Story ${story.id}</span>
            <p>Illustration unavailable (${story.image})</p>
          </div>
        `;
      });

      frame.appendChild(img);
      storyCard.appendChild(frame);

      const readingBox = document.createElement('div');
      readingBox.className = 'story-reading-box';

      const readingHeader = document.createElement('div');
      readingHeader.className = 'story-reading-box__header';
      readingHeader.innerHTML = `<h2>Read the Story</h2>`;

      if (speechSupported) {
        const speakBtn = document.createElement('button');
        speakBtn.type = 'button';
        speakBtn.id = 'read-aloud-btn';
        speakBtn.className = 'btn btn--secondary';
        speakBtn.textContent = isSpeaking ? '⏹ Stop Reading' : '🔊 Read Aloud';
        speakBtn.setAttribute('aria-pressed', String(isSpeaking));
        speakBtn.addEventListener('click', () => readStoryAloud(story));
        readingHeader.appendChild(speakBtn);
      }

      readingBox.appendChild(readingHeader);

      const sentenceList = document.createElement('ul');
      sentenceList.className = 'sentences-list';
      story.sentences.forEach((sentence, idx) => {
        const li = document.createElement('li');
        const sBtn = document.createElement('button');
        sBtn.type = 'button';
        sBtn.className = `sentence-item ${idx === highlightedSentence ? 'sentence-item--highlighted' : ''}`;
        sBtn.textContent = sentence;
        sBtn.setAttribute('aria-label', `Highlight sentence ${idx + 1}: ${sentence}`);
        sBtn.addEventListener('click', () => {
          highlightedSentence = highlightedSentence === idx ? -1 : idx;
          updateSentenceHighlights();
        });
        li.appendChild(sBtn);
        sentenceList.appendChild(li);
      });

      readingBox.appendChild(sentenceList);
      storyCard.appendChild(readingBox);

      const stepFooter = document.createElement('div');
      stepFooter.className = 'story-step-footer';
      stepFooter.innerHTML = `
        <button type="button" class="btn btn--primary" id="story-to-setA-btn">
          Next: Set A →
        </button>
      `;
      stepFooter.querySelector('#story-to-setA-btn').addEventListener('click', () => goToStep('setA'));
      storyCard.appendChild(stepFooter);

      stage.appendChild(storyCard);
      container.appendChild(stage);
      return;
    }

    // Set A or Set B (Story is hidden while answering)
    const activeKey = step;
    const question = activeKey === 'setA' ? story.questions[0] : story.questions[1];
    const qState = quizState[activeKey];

    if (question) {
      const qCard = document.createElement('article');
      qCard.className = `question-card ${qState.solved ? 'question-card--solved' : ''}`;

      const qHeader = document.createElement('div');
      qHeader.className = 'question-card__header';
      qHeader.innerHTML = `
        <h2 class="question-card__title">Set ${question.set}: Pick the matching sentence</h2>
        ${qState.solved ? '<span class="status-badge status-badge--playable">✓ Correct</span>' : ''}
      `;
      qCard.appendChild(qHeader);

      const choicesList = document.createElement('div');
      choicesList.className = 'choices-list';

      question.options.forEach((opt, optIdx) => {
        const cBtn = document.createElement('button');
        cBtn.type = 'button';
        const isCorrectPicked = qState.solved && optIdx === question.correctIndex;
        const isWrongPicked = qState.wrongIndices.has(optIdx);

        cBtn.className = `choice-btn ${isCorrectPicked ? 'choice-btn--correct' : ''} ${isWrongPicked ? 'choice-btn--wrong' : ''}`;
        if (qState.solved) {
          cBtn.disabled = true;
        }

        cBtn.innerHTML = `
          <span class="choice-btn__letter" aria-hidden="true">${CHOICE_LETTERS[optIdx] || optIdx + 1}</span>
          <span>${escapeHtml(opt)}</span>
        `;

        cBtn.addEventListener('click', () => handleAnswer(activeKey, question, optIdx));
        choicesList.appendChild(cBtn);
      });

      qCard.appendChild(choicesList);

      if (qState.message) {
        const fb = document.createElement('div');
        fb.className = `feedback-banner ${qState.solved ? 'feedback-banner--success' : 'feedback-banner--retry'}`;
        fb.setAttribute('role', 'status');
        fb.textContent = qState.message;
        qCard.appendChild(fb);
      }

      const stepFooter = document.createElement('div');
      stepFooter.className = 'story-step-footer';

      const backToStoryBtn = document.createElement('button');
      backToStoryBtn.type = 'button';
      backToStoryBtn.className = 'btn btn--secondary';
      backToStoryBtn.textContent = '← Read Story Again';
      backToStoryBtn.addEventListener('click', () => goToStep('story'));
      stepFooter.appendChild(backToStoryBtn);

      if (activeKey === 'setA' && qState.solved) {
        const toSetBBtn = document.createElement('button');
        toSetBBtn.type = 'button';
        toSetBBtn.className = 'btn btn--primary';
        toSetBBtn.textContent = 'Next: Set B →';
        toSetBBtn.addEventListener('click', () => goToStep('setB'));
        stepFooter.appendChild(toSetBBtn);
      } else if (activeKey === 'setB') {
        const toSetABtn = document.createElement('button');
        toSetABtn.type = 'button';
        toSetABtn.className = 'btn btn--secondary';
        toSetABtn.textContent = '← Back to Set A';
        toSetABtn.addEventListener('click', () => goToStep('setA'));
        stepFooter.appendChild(toSetABtn);
      }

      qCard.appendChild(stepFooter);
      stage.appendChild(qCard);
    }

    // Completion Banner after Set B is solved
    if (step === 'setB' && bothSolved) {
      const doneCard = document.createElement('article');
      doneCard.className = 'story-complete-card';

      if (isLastStory) {
        doneCard.innerHTML = `
          <h2>🎉 All 28 Stories Complete!</h2>
          <p>
            Amazing reading! You completed ${totalCompleted} of ${stories.length} stories
            and earned ⭐ ${totalStars} stars.
          </p>
          <div class="story-complete-card__actions">
            <button type="button" class="btn btn--success" id="restart-stories-btn">Play Story 1 Again</button>
            <button type="button" class="btn btn--secondary" id="summary-dashboard-btn">Return to PHONIX Dashboard</button>
          </div>
        `;
        doneCard.querySelector('#restart-stories-btn').addEventListener('click', () => selectStory(0));
        doneCard.querySelector('#summary-dashboard-btn').addEventListener('click', () => {
          stopSpeech();
          onBackToDashboard();
        });
      } else {
        doneCard.innerHTML = `
          <h2>⭐ Story ${story.id} Complete!</h2>
          <p>Both Set A and Set B are correct. Ready for the next story?</p>
          <div class="story-complete-card__actions">
            <button type="button" class="btn btn--success" id="advance-next-btn">
              Next Story (${stories[currentIndex + 1].id}) →
            </button>
            <button type="button" class="btn btn--secondary" id="complete-dashboard-btn">
              Back to Dashboard
            </button>
          </div>
        `;
        doneCard.querySelector('#advance-next-btn').addEventListener('click', () => selectStory(currentIndex + 1));
        doneCard.querySelector('#complete-dashboard-btn').addEventListener('click', () => {
          stopSpeech();
          onBackToDashboard();
        });
      }

      stage.appendChild(doneCard);
    }

    container.appendChild(stage);
  }

  render();
  return stopSpeech;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
