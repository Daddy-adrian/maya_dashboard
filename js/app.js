/**
 * PHONIX Application Entry Point & View Router
 */

import { loadStories, loadProgress } from './data/storiesData.js';
import { renderDashboard, PHONIX_MODULES } from './components/Dashboard.js';
import { mountStoryGame } from './games/StoryGame.js';
import { mountRemiGame } from './games/RemiGame.js';
import { mountDirectionPigGame } from './games/DirectionPigGame.js';
import { mountAmIsAreTetrisGame } from './games/AmIsAreTetrisGame.js';
import { mountHaveHasTetrisGame } from './games/HaveHasTetrisGame.js';
import { mountOddOneOutGame } from './games/OddOneOutGame.js';
import { renderPlaceholderModule } from './games/PlaceholderGames.js';

const appRoot = document.getElementById('app-root');
const announcer = document.getElementById('app-announcer');

let stories = [];
let progress = loadProgress();
let activeCleanup = null;

function announce(message) {
  if (!announcer) return;
  announcer.textContent = '';
  requestAnimationFrame(() => {
    announcer.textContent = message;
  });
}

function focusPageHeading() {
  const heading = document.getElementById('page-heading');
  if (heading) {
    heading.focus();
  }
}

function cleanupActiveView() {
  if (typeof activeCleanup === 'function') {
    activeCleanup();
    activeCleanup = null;
  }
}

function showDashboard() {
  cleanupActiveView();
  document.title = 'PHONIX — English Phonics Learning Hub';
  renderDashboard(appRoot, {
    storiesCount: stories.length,
    progress,
    onOpenModule: openModule
  });
  focusPageHeading();
}

function openModule(moduleId, mode = null) {
  cleanupActiveView();

  if (moduleId === 'story-comprehension') {
    document.title = 'Story Comprehension | PHONIX';
    activeCleanup = mountStoryGame(appRoot, {
      stories,
      progress,
      onProgressChange: (updated) => {
        progress = updated;
      },
      onBackToDashboard: showDashboard,
      announce
    });
    focusPageHeading();
    return;
  }

  if (moduleId === 'cvc-rummikub') {
    document.title = 'PHONIX Remi: CVC Word Builder | PHONIX';
    activeCleanup = mountRemiGame(appRoot, {
      onBackToDashboard: showDashboard,
      announce
    });
    focusPageHeading();
    return;
  }

  if (moduleId === 'direction-pig') {
    document.title = 'Direction Pig | PHONIX';
    activeCleanup = mountDirectionPigGame(appRoot, {
      onBackToDashboard: showDashboard,
      announce
    });
    focusPageHeading();
    return;
  }

  if (moduleId === 'am-is-are') {
    document.title = 'Am / Is / Are | PHONIX';
    activeCleanup = mountAmIsAreTetrisGame(appRoot, {
      initialMode: mode || 'tetris',
      onBackToDashboard: showDashboard,
      announce
    });
    focusPageHeading();
    return;
  }

  if (moduleId === 'odd-one-out') {
    document.title = 'Odd One Out: Drag & Match | PHONIX';
    activeCleanup = mountOddOneOutGame(appRoot, {
      onBackToDashboard: showDashboard,
      announce
    });
    focusPageHeading();
    return;
  }

  if (moduleId === 'have-has-tetris') {
    document.title = 'Have / Has | PHONIX';
    activeCleanup = mountHaveHasTetrisGame(appRoot, {
      initialMode: mode || 'tetris',
      onBackToDashboard: showDashboard,
      announce
    });
    focusPageHeading();
    return;
  }

  const mod = PHONIX_MODULES.find((m) => m.id === moduleId);
  document.title = `${mod ? mod.title : 'Module'} | PHONIX`;
  renderPlaceholderModule(appRoot, {
    moduleId,
    onBackToDashboard: showDashboard
  });
  focusPageHeading();
}

async function init() {
  const loaded = await loadStories();
  stories = loaded.stories;
  showDashboard();
}

init();
