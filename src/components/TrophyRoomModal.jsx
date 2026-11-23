import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Trophy, X } from 'lucide-react';
import { SPRING_SHEET, SPRING_BOUNCY, TAP_PROPS } from '../utils/motion';
import { playTap } from '../utils/sensory';
import { useEngagement, STICKER_CATALOG } from '../context/EngagementContext';

/**
 * Trophy Room Sheet — Draggable Sticker Canvas
 */
export default function TrophyRoomModal({ open, onClose }) {
  const { engagement, updateStickerPosition } = useEngagement();
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const unlockedMap = new Map(STICKER_CATALOG.map((s) => [s.id, s]));

  return (
    <motion.div
      className="sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.section
        className="ios-sheet glass-light"
        style={{ maxWidth: 560 }}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={SPRING_SHEET}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="PHONIX Trophy Room"
      >
        <div className="ios-sheet__handle" aria-hidden="true" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trophy size={22} strokeWidth={2.2} color="#FF9500" />
            <h2>Trophy Room</h2>
          </div>
          <motion.button
            type="button"
            className="btn-pill"
            {...TAP_PROPS}
            onClick={() => {
              playTap();
              onClose();
            }}
            aria-label="Close Trophy Room"
          >
            <X size={16} strokeWidth={2.2} />
          </motion.button>
        </div>

        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Drag your unlocked stickers anywhere on your personal trophy board! ({engagement.unlockedStickers.length}/{STICKER_CATALOG.length} unlocked)
        </p>

        <div
          ref={canvasRef}
          style={{
            position: 'relative',
            width: '100%',
            height: 240,
            borderRadius: 22,
            background: 'linear-gradient(135deg, #FFFDF7 0%, #F3F6FF 100%)',
            border: '2px dashed rgba(28, 28, 30, 0.14)',
            overflow: 'hidden'
          }}
        >
          {engagement.placedStickers.map((placed) => {
            const meta = unlockedMap.get(placed.id);
            if (!meta) return null;
            return (
              <motion.div
                key={placed.id}
                drag
                dragConstraints={canvasRef}
                dragElastic={0.12}
                dragMomentum={false}
                initial={{ x: placed.x, y: placed.y, scale: 0.8 }}
                animate={{ scale: 1 }}
                whileDrag={{ scale: 1.25, zIndex: 10 }}
                transition={SPRING_BOUNCY}
                onDragEnd={(_, info) => {
                  playTap();
                  const w = canvasRef.current?.clientWidth || 300;
                  const h = canvasRef.current?.clientHeight || 240;
                  const nextX = Math.max(4, Math.min(w - 76, placed.x + info.offset.x));
                  const nextY = Math.max(4, Math.min(h - 68, placed.y + info.offset.y));
                  updateStickerPosition(placed.id, nextX, nextY);
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  cursor: 'grab',
                  userSelect: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.3rem 0.5rem',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.85)',
                  boxShadow: '0 6px 14px rgba(0,0,0,0.08)'
                }}
                title={meta.label}
              >
                <span style={{ fontSize: '2.1rem', lineHeight: 1 }}>{meta.emoji}</span>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {meta.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </motion.section>
    </motion.div>
  );
}
