import React from 'react';
import { ChevronLeft, Flame, Sparkles, AlertCircle } from 'lucide-react';
import { playTap } from '../utils/sensory';

/**
 * Floating Cream Progress HUD for full-bleed Focus Mode games.
 * Minimal, glitch-free transitions.
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
      <div
        className={`dynamic-island ${isFire ? 'dynamic-island--fire' : ''} ${
          isCoach ? 'dynamic-island--coach' : ''
        }`}
      >
        <div className="dynamic-island__row">
          <button
            type="button"
            className="dynamic-island__exit"
            onClick={() => {
              try {
                playTap();
              } catch {
                // Ignore audio errors so Exit always works
              }
              if (typeof onExit === 'function') onExit();
            }}
            aria-label="Exit to Dashboard"
          >
            <ChevronLeft size={16} strokeWidth={2.2} />
            Exit
          </button>

          <div
            className="dynamic-island__progress"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="dynamic-island__progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div
            className="dynamic-island__combo tabular-nums"
            aria-label={`Combo streak ${combo}`}
          >
            <Flame size={16} strokeWidth={2.2} />
            <span>x{combo}</span>
          </div>
        </div>

        {statusBanner && (
          <div
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
          </div>
        )}
      </div>
    </div>
  );
}
