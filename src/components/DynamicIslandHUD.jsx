import React from 'react';
import { ChevronLeft, Flame, Sparkles, AlertCircle, Volume2, VolumeX } from 'lucide-react';
import { useEngagement } from '../context/EngagementContext';
import { playTap } from '../utils/sensory';

/**
 * Floating Cream Progress HUD for full-bleed Focus Mode games.
 * Includes instant Exit, progress bar, combo badge, and in-game Sound/Music mute toggle.
 */
export default function DynamicIslandHUD({
  progress = 0, // 0..1
  combo = 0,
  statusBanner = null, // { type: 'fire' | 'coach' | 'bonus', text: string } | null
  onExit
}) {
  const { engagement, toggleMute } = useEngagement();
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

          <button
            type="button"
            className="dynamic-island__exit"
            style={{ padding: '0.32rem 0.45rem' }}
            onClick={toggleMute}
            aria-label={engagement.soundMuted ? 'Unmute music and sounds' : 'Mute music and sounds'}
            title={engagement.soundMuted ? 'Unmute' : 'Mute'}
          >
            {engagement.soundMuted ? (
              <VolumeX size={15} strokeWidth={2.2} />
            ) : (
              <Volume2 size={15} strokeWidth={2.2} />
            )}
          </button>
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
