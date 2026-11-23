import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Home, Sparkles } from 'lucide-react';
import { SPRING_SHEET, TAP_PROPS } from '../utils/motion';
import { playTap } from '../utils/sensory';

/**
 * Zero-Stopping-Cue Bottom Sheet for Round Completion.
 * Celebrates progress and provides a "Next Challenge ->" CTA
 * with a 5-second radial auto-advance ring (pauses on interaction, guarded against double-fire).
 */
export default function RoundCompleteSheet({
  title = 'Awesome Effort!',
  subtitle,
  xpEarned = 30,
  nextLabel = 'Next Challenge',
  onNext,
  onDashboard,
  autoAdvanceSeconds = 5
}) {
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(autoAdvanceSeconds);
  const firedRef = useRef(false);

  const triggerNextOnce = () => {
    if (firedRef.current || !onNext) return;
    firedRef.current = true;
    onNext();
  };

  useEffect(() => {
    if (paused || !onNext) return undefined;
    if (remaining <= 0) {
      triggerNextOnce();
      return undefined;
    }
    const timer = setTimeout(() => {
      setRemaining((r) => r - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [paused, remaining, onNext]);

  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - remaining / autoAdvanceSeconds);

  return (
    <motion.div
      className="sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={() => setPaused(true)}
    >
      <motion.section
        className="ios-sheet glass-light"
        initial={{ y: 80, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={SPRING_SHEET}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="ios-sheet__handle" aria-hidden="true" />
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #34C759, #FFCC00)',
            display: 'grid',
            placeItems: 'center',
            color: '#FFFFFF',
            boxShadow: '0 8px 20px rgba(52, 199, 89, 0.3)'
          }}
        >
          <Sparkles size={30} strokeWidth={2.2} />
        </div>

        <h2 style={{ fontSize: '1.55rem' }}>{title}</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 600 }}>
          {subtitle}
        </p>

        <div
          className="status-chip tabular-nums"
          style={{
            background: 'rgba(255, 204, 0, 0.18)',
            color: '#8F6400',
            borderColor: 'rgba(255, 204, 0, 0.45)',
            fontSize: '1rem',
            padding: '0.45rem 1rem'
          }}
        >
          +{xpEarned} XP Earned
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%' }}>
          {onNext && (
            <motion.button
              type="button"
              className="btn-tactile btn-blue"
              style={{ width: '100%', fontSize: '1.05rem', boxShadow: '0 6px 20px rgba(0, 122, 255, 0.32), 0 5px 0 rgba(0, 0, 0, 0.16)' }}
              {...TAP_PROPS}
              onClick={() => {
                playTap();
                triggerNextOnce();
              }}
            >
              <span>{nextLabel}</span>
              <ArrowRight size={18} strokeWidth={2.2} />
              {!paused && (
                <svg width="28" height="28" viewBox="0 0 30 30" aria-hidden="true" style={{ marginLeft: 4 }}>
                  <circle cx="15" cy="15" r={radius} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                  <circle
                    cx="15"
                    cy="15"
                    r={radius}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    transform="rotate(-90 15 15)"
                    style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                  />
                </svg>
              )}
            </motion.button>
          )}

          <button
            type="button"
            className="btn-pill"
            style={{ justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--text-secondary)' }}
            onClick={() => {
              playTap();
              onDashboard();
            }}
          >
            <Home size={16} strokeWidth={2.2} />
            Dashboard
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}
