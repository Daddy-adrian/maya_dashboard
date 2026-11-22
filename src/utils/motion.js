/**
 * Framer Motion Spring Presets (Apple HIG Physics)
 */

export const SPRING_SNAPPY = {
  type: 'spring',
  stiffness: 480,
  damping: 32,
  mass: 0.8
};

export const SPRING_BOUNCY = {
  type: 'spring',
  stiffness: 320,
  damping: 18,
  mass: 1.0
};

export const SPRING_SHEET = {
  type: 'spring',
  stiffness: 300,
  damping: 32,
  mass: 0.9
};

export const TAP_PROPS = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.94 },
  transition: SPRING_SNAPPY
};
