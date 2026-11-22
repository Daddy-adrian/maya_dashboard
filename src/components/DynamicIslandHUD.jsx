import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Flame, Sparkles, AlertCircle } from 'lucide-react';
import { SPRING_SNAPPY, SPRING_BOUNCY } from '../utils/motion';
import { playTap } from '../utils/sensory';

/**
 * Floating Apple Dynamic Island HUD for full-bleed Focus Mode games.
 * Morphs via Framer Motion `layout` on combos (3+), coaching tips, or SRS bonus recalls.
 */
export default function DynamicIslandHUD({
  progress = 0, // 0..1
  combo = 0,
  statusBanner = null, // { type: 'fire' | 'coach' | 'bonus', text: string } | null
  onExit
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  const isFire = statusBanner?.type === 'fire' || combo >= 3;
  const isCoach = statusBanner?.type === 'coach';

  return (
    <div className="dynamic-island-wrap">
      <motion.div
        layout
        transition={SPRING_SNAPPY}
        className={`dynamic-island glass-dark ${isFire ? 'dynamic-island--fire' : ''} ${
          isCoach ? 'dynamic-island--coach' : ''
        }`}
      >
        <div className="dynamic-island__row">
          <motion.button
            type="button"
            className="dynamic-island__exit"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              playTap();
              onExit();
            }}
            aria-label="Exit to Dashboard"
          >
            <ChevronLeft size={16} strokeWidth={2.2} />
            Exit
          </motion.button>

          <div
            className="dynamic-island__progress"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <motion.div
              className="dynamic-island__progress-fill"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={SPRING_SNAPPY}
            />
          </div>

          <motion.div
            key={combo}
            initial={{ scale: combo > 0 ? 1.35 : 1 }}
            animate={{ scale: 1 }}
            transition={SPRING_BOUNCY}
            className="dynamic-island__combo tabular-nums"
            aria-label={`Combo streak ${combo}`}
          >
            <Flame size={16} strokeWidth={2.2} />
            <span>x{combo}</span>
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          {statusBanner && (
            <motion.div
              key={`${statusBanner.type}-${statusBanner.text}`}
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={SPRING_SNAPPY}
              className={`dynamic-island__banner dynamic-island__banner--${statusBanner.type}`}
              role="status"
            >
              {statusBanner.type === 'fire' && (
                <Sparkles size={14} strokeWidth={2.2} style={{ verticalAlign: '-2px', marginRight: 5 }} />
              )}
              {statusBanner.type === 'coach' && (
                <AlertCircle size={14} strokeWidth={2.2} style={{ verticalAlign: '-2px', marginRight: 5 }} />
              )}
              {statusBanner.text}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
