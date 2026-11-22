import React, { useState } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Gift, Sparkles } from 'lucide-react';
import { SPRING_BOUNCY, SPRING_SHEET, TAP_PROPS } from '../utils/motion';
import { playJackpot, playTap } from '../utils/sensory';
import { useEngagement } from '../context/EngagementContext';

/**
 * Slot-Machine Variable-Ratio Mystery Star Chest Bottom Sheet.
 */
export default function MysteryChestModal() {
  const { chestPending, openMysteryChestReward, closeChest } = useEngagement();
  const [stage, setStage] = useState('closed'); // 'closed' | 'shaking' | 'opened'
  const [reward, setReward] = useState(null);

  if (!chestPending) return null;

  const handleOpen = () => {
    if (stage !== 'closed') return;
    setStage('shaking');
    playTap();

    setTimeout(() => {
      const won = openMysteryChestReward();
      setReward(won);
      setStage('opened');
      playJackpot();
      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#FFCC00', '#007AFF', '#34C759', '#FF9500', '#AF52DE']
      });
    }, 420);
  };

  const handleDismiss = () => {
    playTap();
    setStage('closed');
    setReward(null);
    closeChest();
  };

  return (
    <motion.div
      className="sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        className="ios-sheet glass-light"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={SPRING_SHEET}
        role="dialog"
        aria-modal="true"
        aria-label="Mystery Star Chest"
      >
        <div className="ios-sheet__handle" aria-hidden="true" />
        <span className="recharge-pill" style={{ background: 'rgba(255, 204, 0, 0.22)', color: '#8A5A00' }}>
          <Sparkles size={14} strokeWidth={2.2} /> {chestPending.reason}
        </span>

        {stage !== 'opened' ? (
          <>
            <h2>Mystery Star Chest!</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 600 }}>
              Tap the chest to unlock bonus XP, coins, or a collectible sticker!
            </p>
            <motion.button
              type="button"
              onClick={handleOpen}
              animate={
                stage === 'shaking'
                  ? { rotate: [-10, 12, -14, 14, -8, 8, 0], scale: [1, 1.12, 1.15, 1.08] }
                  : { rotate: [-2, 2, -2], y: [0, -5, 0] }
              }
              transition={
                stage === 'shaking'
                  ? { duration: 0.42 }
                  : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
              }
              style={{
                width: 116,
                height: 116,
                borderRadius: 28,
                border: 'none',
                background: 'linear-gradient(135deg, #FFCC00 0%, #FF9500 100%)',
                boxShadow: '0 14px 32px rgba(255, 149, 0, 0.35)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                color: '#FFFFFF'
              }}
              aria-label="Open Mystery Star Chest"
            >
              <Gift size={56} strokeWidth={2.2} />
            </motion.button>
          </>
        ) : (
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={SPRING_BOUNCY}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem', width: '100%' }}
          >
            <h2>Jackpot Unlocked!</h2>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span className="status-chip tabular-nums" style={{ background: '#FFF9DB', color: '#8A5A00' }}>
                ⚡ +{reward?.bonusXp} XP
              </span>
              <span className="status-chip tabular-nums" style={{ background: '#EBF5FF', color: '#0055B3' }}>
                🪙 +{reward?.bonusCoins} Coins
              </span>
            </div>
            {reward?.newSticker && (
              <div
                style={{
                  padding: '0.75rem 1.2rem',
                  borderRadius: 20,
                  background: 'rgba(175, 82, 222, 0.12)',
                  border: '1.5px solid rgba(175, 82, 222, 0.35)',
                  fontWeight: 700
                }}
              >
                <div style={{ fontSize: '2.4rem' }}>{reward.newSticker.emoji}</div>
                <div>New Sticker: {reward.newSticker.label}!</div>
              </div>
            )}
            <motion.button
              type="button"
              className="btn-tactile btn-green"
              style={{ width: '100%' }}
              {...TAP_PROPS}
              onClick={handleDismiss}
            >
              Collect Rewards
            </motion.button>
          </motion.div>
        )}
      </motion.section>
    </motion.div>
  );
}
