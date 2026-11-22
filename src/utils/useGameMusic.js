import { useEffect } from 'react';
import { startGameMusic, stopGameMusic, unlockAudioOnGesture } from './sensory';

/**
 * Starts a themed background music loop while a game is mounted
 * and stops it cleanly when returning to the Dashboard.
 */
export function useGameMusic(theme) {
  useEffect(() => {
    startGameMusic(theme);
    const unlock = () => unlockAudioOnGesture();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      stopGameMusic();
    };
  }, [theme]);
}
