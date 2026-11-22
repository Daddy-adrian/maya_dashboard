import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Plus } from 'lucide-react';
import DynamicIslandHUD from '../components/DynamicIslandHUD';
import RoundCompleteSheet from '../components/RoundCompleteSheet';
import { useEngagement } from '../context/EngagementContext';
import { assetUrl } from '../utils/assets';
import { SPRING_SNAPPY, SPRING_BOUNCY, TAP_PROPS } from '../utils/motion';
import { playCardSwipe, playCorrect, playNearMiss, playTap } from '../utils/sensory';

const HAND_SIZE = 14;

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function validateRemiSet(cards) {
  if (!Array.isArray(cards) || cards.length < 3) {
    return { valid: false, rule: '', msg: 'Group at least 3 matching cards!' };
  }
  const regs = cards.filter((c) => !c.isJoker);
  if (regs.length <= 1) return { valid: true, rule: 'Joker Wild', msg: 'Joker wild set!' };
  const f = regs[0];
  if (regs.every((c) => c.ending === f.ending)) return { valid: true, rule: `Same Ending (-${f.ending})` };
  if (regs.every((c) => c.vowel === f.vowel)) return { valid: true, rule: `Same Vowel (${f.vowel})` };
  if (regs.every((c) => c.firstLetter === f.firstLetter)) return { valid: true, rule: `Same First (${f.firstLetter})` };
  return { valid: false, rule: '', msg: 'Match the same vowel, ending, or first letter!' };
}

export default function RemiGame({ onExit }) {
  const { awardXP, maybeTriggerMysteryChest, announce } = useEngagement();
  const [masterDeck, setMasterDeck] = useState([]);
  const [deck, setDeck] = useState([]);
  const [hand, setHand] = useState(Array(HAND_SIZE).fill(null));
  const [tableSets, setTableSets] = useState([]);
  const [selected, setSelected] = useState([]);
  const [combo, setCombo] = useState(0);
  const [banner, setBanner] = useState(null);
  const [idleDeckPulse, setIdleDeckPulse] = useState(false);
  const [won, setWon] = useState(false);
  const [xpPop, setXpPop] = useState(null);

  const tableRef = useRef(null);
  const idleTimerRef = useRef(null);
  const didDragRef = useRef(false);

  const resetIdle = () => {
    setIdleDeckPulse(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIdleDeckPulse(true), 8000);
  };

  useEffect(() => {
    let active = true;
    fetch(assetUrl('remi_cards.json'))
      .then((r) => r.json())
      .then((raw) => {
        if (!active) return;
        const normalized = raw.map((item, idx) => ({
          uid: `remi-${idx}-${item.word}`,
          word: String(item.word).toLowerCase(),
          vowel: item.vowel,
          ending: item.ending,
          firstLetter: item.firstLetter,
          isJoker: Boolean(item.isJoker) || item.word === 'joker',
          image: assetUrl(`vowels_images/${item.isJoker ? 'joker' : item.word}.jpeg`)
        }));
        setMasterDeck(normalized);
        dealNew(normalized);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  function dealNew(source = masterDeck) {
    const shuffled = shuffle(source);
    const nextHand = Array(HAND_SIZE).fill(null);
    for (let i = 0; i < HAND_SIZE && shuffled.length > 0; i += 1) {
      nextHand[i] = shuffled.pop();
    }
    setDeck(shuffled);
    setHand(nextHand);
    setTableSets([]);
    setSelected([]);
    setCombo(0);
    setBanner(null);
    setWon(false);
    resetIdle();
  }

  function toggleSelect(slotIdx) {
    resetIdle();
    playTap();
    setSelected((prev) =>
      prev.includes(slotIdx) ? prev.filter((i) => i !== slotIdx) : [...prev, slotIdx]
    );
  }

  function drawCard() {
    resetIdle();
    const emptyIdx = hand.findIndex((c) => c === null);
    if (emptyIdx === -1 || deck.length === 0) return;
    playCardSwipe();
    const nextDeck = [...deck];
    const drawn = nextDeck.pop();
    const nextHand = [...hand];
    nextHand[emptyIdx] = drawn;
    setDeck(nextDeck);
    setHand(nextHand);
    setBanner(null);
  }

  function tryPlaySlots(slots, targetSetId = null) {
    resetIdle();
    const unique = [...new Set(slots)].filter((i) => hand[i] !== null);
    const cards = unique.map((i) => hand[i]);

    if (targetSetId) {
      const target = tableSets.find((s) => s.id === targetSetId);
      if (!target || cards.length === 0) return;
      const combined = [...target.cards, ...cards];
      const res = validateRemiSet(combined);
      if (!res.valid) {
        setCombo(0);
        playNearMiss();
        setBanner({ type: 'coach', text: res.msg });
        return;
      }
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      playCorrect(nextCombo);
      awardXP(15, 5);
      setXpPop('+15 XP');
      setTimeout(() => setXpPop(null), 900);
      setTableSets((prev) =>
        prev.map((s) => (s.id === targetSetId ? { ...s, cards: combined, rule: res.rule } : s))
      );
      removeSlots(unique);
      return;
    }

    const res = validateRemiSet(cards);
    if (!res.valid) {
      setCombo(0);
      playNearMiss();
      setBanner({ type: 'coach', text: res.msg });
      announce(res.msg);
      return;
    }

    const nextCombo = combo + 1;
    setCombo(nextCombo);
    playCorrect(nextCombo);
    awardXP(20, 8);
    setXpPop('+20 XP');
    setTimeout(() => setXpPop(null), 900);
    setBanner(nextCombo >= 3 ? { type: 'fire', text: '🔥 ON FIRE! 2x XP' } : null);
    setTableSets((prev) => [...prev, { id: `set-${Date.now()}`, cards, rule: res.rule }]);
    removeSlots(unique);
  }

  function removeSlots(indices) {
    const nextHand = [...hand];
    indices.forEach((i) => {
      nextHand[i] = null;
    });
    setHand(nextHand);
    setSelected([]);
    if (nextHand.every((c) => c === null)) {
      setWon(true);
      maybeTriggerMysteryChest(false);
    }
  }

  const remainingHand = hand.filter(Boolean).length;
  const progress = (HAND_SIZE - remainingHand) / HAND_SIZE;

  return (
    <div className="focus-shell">
      <DynamicIslandHUD progress={progress} combo={combo} statusBanner={banner} onExit={onExit} />

      <div className="game-stage-container" style={{ maxWidth: 1100 }}>
        {/* Table + Side Draw Deck */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '0.85rem', alignItems: 'stretch' }}>
          <div ref={tableRef} className="remi-table-hig">
            {xpPop && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.8 }}
                animate={{ opacity: 1, y: -10, scale: 1.1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'fixed',
                  top: '22%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 55,
                  background: '#34C759',
                  color: '#FFF',
                  padding: '0.4rem 0.9rem',
                  borderRadius: 999,
                  fontWeight: 800
                }}
              >
                {xpPop}
              </motion.div>
            )}

            {tableSets.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', alignSelf: 'center' }}>
                <p style={{ margin: 0, fontWeight: 700 }}>Drag or place 3+ matching cards here</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem' }}>Same Vowel • Same Ending • Same First Letter</p>
              </div>
            ) : (
              tableSets.map((setObj) => (
                <motion.div
                  key={setObj.id}
                  layout
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={SPRING_BOUNCY}
                  style={{
                    background: 'rgba(255, 255, 255, 0.78)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: 18,
                    padding: '0.55rem',
                    border: '1px solid rgba(46, 184, 100, 0.35)',
                    boxShadow: 'var(--shadow-ambient)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#248A3D' }}>{setObj.rule}</span>
                    {selected.length > 0 && (
                      <button
                        type="button"
                        className="btn-pill"
                        style={{ minHeight: 26, padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}
                        onClick={() => tryPlaySlots(selected, setObj.id)}
                      >
                        <Plus size={12} strokeWidth={2.5} /> Add
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {setObj.cards.map((c) => (
                      <div key={c.uid} className="remi-pic-card" style={{ width: 68, height: 92, cursor: 'default' }}>
                        <img src={c.image} alt={c.word} />
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Draw Deck */}
          <button
            type="button"
            disabled={remainingHand >= HAND_SIZE || deck.length === 0}
            className="btn-tactile btn-surface"
            style={{
              flexDirection: 'column',
              height: '100%',
              minHeight: 140,
              borderRadius: 24,
              border: idleDeckPulse && remainingHand < HAND_SIZE ? '2px solid var(--apple-blue)' : undefined
            }}
            onClick={drawCard}
          >
            <Layers size={28} strokeWidth={2.2} color="#007AFF" />
            <span>Draw</span>
            <span className="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {deck.length} left
            </span>
          </button>
        </div>

        {/* Action Strip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
            Selected: {selected.length} • Hand: {remainingHand}/{HAND_SIZE}
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <motion.button
              type="button"
              className="btn-pill"
              disabled={selected.length === 0}
              whileHover={selected.length > 0 ? { scale: 1.02 } : undefined}
              whileTap={selected.length > 0 ? { scale: 0.94 } : undefined}
              transition={SPRING_SNAPPY}
              onClick={() => {
                playTap();
                setSelected([]);
                setBanner(null);
              }}
            >
              Clear Selection
            </motion.button>
            <motion.button
              type="button"
              className="btn-pill"
              {...TAP_PROPS}
              onClick={() => {
                playTap();
                dealNew();
              }}
            >
              New Hand
            </motion.button>
            <motion.button
              type="button"
              className="btn-tactile btn-blue"
              disabled={selected.length < 3}
              whileHover={selected.length >= 3 ? { scale: 1.02 } : undefined}
              whileTap={selected.length >= 3 ? { scale: 0.94 } : undefined}
              transition={SPRING_SNAPPY}
              onClick={() => tryPlaySlots(selected)}
            >
              Place Set on Table
            </motion.button>
          </div>
        </div>

        {/* 14-Slot Horizontal Hand Rack with Framer Motion Drag */}
        <div className="remi-hand-rack-hig glass-light">
          <div className="remi-hand-grid-hig">
            {hand.map((card, idx) => (
              <div key={idx} style={{ minHeight: 104, display: 'flex' }}>
                {card ? (
                  <motion.button
                    type="button"
                    drag
                    dragSnapToOrigin
                    onDragStart={() => {
                      didDragRef.current = true;
                      resetIdle();
                      playCardSwipe();
                    }}
                    onDragEnd={(_, info) => {
                      setTimeout(() => {
                        didDragRef.current = false;
                      }, 60);
                      const rect = tableRef.current?.getBoundingClientRect();
                      if (
                        rect &&
                        info.point.x >= rect.left &&
                        info.point.x <= rect.right &&
                        info.point.y >= rect.top &&
                        info.point.y <= rect.bottom
                      ) {
                        const group = selected.includes(idx) ? selected : [idx];
                        tryPlaySlots(group);
                      }
                    }}
                    whileDrag={{ scale: 1.12, rotate: 2, zIndex: 40 }}
                    whileHover={{ y: -3 }}
                    transition={SPRING_SNAPPY}
                    className={`remi-pic-card ${selected.includes(idx) ? 'remi-pic-card--selected' : ''}`}
                    onClick={() => {
                      if (didDragRef.current) return;
                      toggleSelect(idx);
                    }}
                    aria-label={card.isJoker ? 'Joker wild card' : card.word}
                    aria-pressed={selected.includes(idx)}
                  >
                    <img src={card.image} alt={card.word} draggable={false} />
                  </motion.button>
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: 104,
                      borderRadius: 12,
                      border: '2px dashed rgba(28,28,30,0.12)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '0.82rem'
                    }}
                  >
                    {idx + 1}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {won && (
          <RoundCompleteSheet
            title="YOU WIN! PHONIX Master!"
            subtitle={`Cleared all 14 cards in ${tableSets.length} valid sets.`}
            xpEarned={80}
            nextLabel="Deal New Hand"
            onNext={() => dealNew()}
            onDashboard={onExit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
