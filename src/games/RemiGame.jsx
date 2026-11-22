import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Plus } from 'lucide-react';
import DynamicIslandHUD from '../components/DynamicIslandHUD';
import RoundCompleteSheet from '../components/RoundCompleteSheet';
import { useEngagement } from '../context/EngagementContext';
import { assetUrl } from '../utils/assets';
import { SPRING_SNAPPY, SPRING_BOUNCY, TAP_PROPS } from '../utils/motion';
import { playWoodClack, playTileSlide, playCorrect, playNearMiss, playTap } from '../utils/sensory';
import { useGameMusic } from '../utils/useGameMusic';

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
  useGameMusic('remi');
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
    playWoodClack();
    setSelected((prev) =>
      prev.includes(slotIdx) ? prev.filter((i) => i !== slotIdx) : [...prev, slotIdx]
    );
  }

  function drawCard() {
    resetIdle();
    const emptyIdx = hand.findIndex((c) => c === null);
    if (emptyIdx === -1 || deck.length === 0) return;
    playTileSlide();
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

  const topRowSlots = [0, 1, 2, 3, 4, 5, 6];
  const bottomRowSlots = [7, 8, 9, 10, 11, 12, 13];

  const renderHandSlot = (idx) => {
    const card = hand[idx];
    return (
      <div key={idx} style={{ display: 'flex' }}>
        {card ? (
          <motion.button
            type="button"
            drag
            dragSnapToOrigin
            onDragStart={() => {
              didDragRef.current = true;
              resetIdle();
              playWoodClack();
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
            whileDrag={{ scale: 1.1, rotate: 2, zIndex: 40 }}
            transition={SPRING_SNAPPY}
            className={`rummikub-tile ${selected.includes(idx) ? 'rummikub-tile--selected' : ''}`}
            onClick={() => {
              if (didDragRef.current) return;
              toggleSelect(idx);
            }}
            aria-label={card.isJoker ? 'Joker wild tile' : card.word}
            aria-pressed={selected.includes(idx)}
          >
            <div className="rummikub-tile__dish">
              <img src={card.image} alt={card.word} draggable={false} />
            </div>
            <span className="rummikub-tile__stamp">PHONIX</span>
          </motion.button>
        ) : (
          <div className="rummikub-empty-slot">{idx + 1}</div>
        )}
      </div>
    );
  };

  return (
    <div className="focus-shell focus-shell--rummikub">
      <DynamicIslandHUD progress={progress} combo={combo} statusBanner={banner} onExit={onExit} />

      <div className="game-stage-container" style={{ maxWidth: 1020 }}>
        {/* Royal Blue Felt Table + Side Ivory Draw Stack */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 128px', gap: '0.85rem', alignItems: 'stretch' }}>
          <div ref={tableRef} className="remi-table-hig">
            <div className="remi-table-watermark" aria-hidden="true">
              PHONIX Remi
            </div>

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
                  background: '#2EB864',
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
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.84)', alignSelf: 'center' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>Drag or place 3+ matching tiles onto the board</p>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.88rem', color: 'rgba(255,255,255,0.68)' }}>
                  Same Vowel • Same Ending • Same First Letter
                </p>
              </div>
            ) : (
              tableSets.map((setObj) => (
                <div key={setObj.id} className="remi-table-set">
                  <div className="remi-table-set__meta">
                    <span className="remi-table-set__rule">{setObj.rule}</span>
                    {selected.length > 0 && (
                      <button
                        type="button"
                        className="btn-pill"
                        style={{ minHeight: 24, padding: '0.12rem 0.5rem', fontSize: '0.72rem' }}
                        onClick={() => tryPlaySlots(selected, setObj.id)}
                      >
                        <Plus size={12} strokeWidth={2.5} /> Add
                      </button>
                    )}
                  </div>
                  <div className="remi-table-set__tiles">
                    {setObj.cards.map((c) => (
                      <div key={c.uid} className="rummikub-tile rummikub-tile--table">
                        <div className="rummikub-tile__dish">
                          <img src={c.image} alt={c.word} />
                        </div>
                        <span className="rummikub-tile__stamp">PHONIX</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Carved Wooden Draw Tile Button */}
          <button
            type="button"
            disabled={remainingHand >= HAND_SIZE || deck.length === 0}
            className="rummikub-draw-stack"
            style={{
              borderColor: idleDeckPulse && remainingHand < HAND_SIZE ? '#FFD54F' : undefined
            }}
            onClick={drawCard}
          >
            <Layers size={28} strokeWidth={2.2} color="#FFF8EE" />
            <span>Draw Tile</span>
            <span className="tabular-nums" style={{ fontSize: '0.8rem', color: 'rgba(255, 248, 238, 0.85)' }}>
              {deck.length} left
            </span>
          </button>
        </div>

        {/* Action Strip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span className="tabular-nums" style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>
            Selected: {selected.length} • Rack: {remainingHand}/{HAND_SIZE}
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <motion.button
              type="button"
              className="btn-pill"
              disabled={selected.length === 0}
              whileTap={selected.length > 0 ? { scale: 0.96 } : undefined}
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
              className="btn-tactile btn-green"
              disabled={selected.length < 3}
              whileTap={selected.length >= 3 ? { scale: 0.96 } : undefined}
              onClick={() => tryPlaySlots(selected)}
            >
              Place Set on Board
            </motion.button>
          </div>
        </div>

        {/* 2-Tier Wooden Rummikub Tile Board (7 Top + 7 Bottom = 14 Tiles) */}
        <div className="rummikub-wood-rack">
          <div className="rummikub-wood-shelf">{topRowSlots.map(renderHandSlot)}</div>
          <div className="rummikub-wood-shelf">{bottomRowSlots.map(renderHandSlot)}</div>
          <div className="rummikub-wood-brand" aria-hidden="true">
            PHONIX Remi
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
