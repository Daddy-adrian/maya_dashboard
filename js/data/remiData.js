/**
 * PHONIX Remi Data Loader, Deck Shuffler, and Phonics Set Validator
 */

const FALLBACK_REMI_CARDS = [
  { word: 'bag', vowel: 'a', ending: 'ag', firstLetter: 'b', isJoker: false },
  { word: 'bat', vowel: 'a', ending: 'at', firstLetter: 'b', isJoker: false },
  { word: 'cap', vowel: 'a', ending: 'ap', firstLetter: 'c', isJoker: false },
  { word: 'cat', vowel: 'a', ending: 'at', firstLetter: 'c', isJoker: false },
  { word: 'fan', vowel: 'a', ending: 'an', firstLetter: 'f', isJoker: false },
  { word: 'hat', vowel: 'a', ending: 'at', firstLetter: 'h', isJoker: false },
  { word: 'jam', vowel: 'a', ending: 'am', firstLetter: 'j', isJoker: false },
  { word: 'man', vowel: 'a', ending: 'an', firstLetter: 'm', isJoker: false },
  { word: 'map', vowel: 'a', ending: 'ap', firstLetter: 'm', isJoker: false },
  { word: 'sad', vowel: 'a', ending: 'ad', firstLetter: 's', isJoker: false },
  { word: 'mat', vowel: 'a', ending: 'at', firstLetter: 'm', isJoker: false },
  { word: 'bed', vowel: 'e', ending: 'ed', firstLetter: 'b', isJoker: false },
  { word: 'jet', vowel: 'e', ending: 'et', firstLetter: 'j', isJoker: false },
  { word: 'leg', vowel: 'e', ending: 'eg', firstLetter: 'l', isJoker: false },
  { word: 'net', vowel: 'e', ending: 'et', firstLetter: 'n', isJoker: false },
  { word: 'pen', vowel: 'e', ending: 'en', firstLetter: 'p', isJoker: false },
  { word: 'pet', vowel: 'e', ending: 'et', firstLetter: 'p', isJoker: false },
  { word: 'red', vowel: 'e', ending: 'ed', firstLetter: 'r', isJoker: false },
  { word: 'ten', vowel: 'e', ending: 'en', firstLetter: 't', isJoker: false },
  { word: 'web', vowel: 'e', ending: 'eb', firstLetter: 'w', isJoker: false },
  { word: 'wet', vowel: 'e', ending: 'et', firstLetter: 'w', isJoker: false },
  { word: 'big', vowel: 'i', ending: 'ig', firstLetter: 'b', isJoker: false },
  { word: 'dig', vowel: 'i', ending: 'ig', firstLetter: 'd', isJoker: false },
  { word: 'hit', vowel: 'i', ending: 'it', firstLetter: 'h', isJoker: false },
  { word: 'kid', vowel: 'i', ending: 'id', firstLetter: 'k', isJoker: false },
  { word: 'lip', vowel: 'i', ending: 'ip', firstLetter: 'l', isJoker: false },
  { word: 'pig', vowel: 'i', ending: 'ig', firstLetter: 'p', isJoker: false },
  { word: 'pin', vowel: 'i', ending: 'in', firstLetter: 'p', isJoker: false },
  { word: 'sit', vowel: 'i', ending: 'it', firstLetter: 's', isJoker: false },
  { word: 'win', vowel: 'i', ending: 'in', firstLetter: 'w', isJoker: false },
  { word: 'zip', vowel: 'i', ending: 'ip', firstLetter: 'z', isJoker: false },
  { word: 'dog', vowel: 'o', ending: 'og', firstLetter: 'd', isJoker: false },
  { word: 'hop', vowel: 'o', ending: 'op', firstLetter: 'h', isJoker: false },
  { word: 'hot', vowel: 'o', ending: 'ot', firstLetter: 'h', isJoker: false },
  { word: 'log', vowel: 'o', ending: 'og', firstLetter: 'l', isJoker: false },
  { word: 'mop', vowel: 'o', ending: 'op', firstLetter: 'm', isJoker: false },
  { word: 'nod', vowel: 'o', ending: 'od', firstLetter: 'n', isJoker: false },
  { word: 'pop', vowel: 'o', ending: 'op', firstLetter: 'p', isJoker: false },
  { word: 'pot', vowel: 'o', ending: 'ot', firstLetter: 'p', isJoker: false },
  { word: 'top', vowel: 'o', ending: 'op', firstLetter: 't', isJoker: false },
  { word: 'bug', vowel: 'u', ending: 'ug', firstLetter: 'b', isJoker: false },
  { word: 'bus', vowel: 'u', ending: 'us', firstLetter: 'b', isJoker: false },
  { word: 'cup', vowel: 'u', ending: 'up', firstLetter: 'c', isJoker: false },
  { word: 'cut', vowel: 'u', ending: 'ut', firstLetter: 'c', isJoker: false },
  { word: 'fun', vowel: 'u', ending: 'un', firstLetter: 'f', isJoker: false },
  { word: 'hug', vowel: 'u', ending: 'ug', firstLetter: 'h', isJoker: false },
  { word: 'mud', vowel: 'u', ending: 'ud', firstLetter: 'm', isJoker: false },
  { word: 'nut', vowel: 'u', ending: 'ut', firstLetter: 'n', isJoker: false },
  { word: 'run', vowel: 'u', ending: 'un', firstLetter: 'r', isJoker: false },
  { word: 'sun', vowel: 'u', ending: 'un', firstLetter: 's', isJoker: false },
  { word: 'joker', vowel: 'joker', ending: 'joker', firstLetter: 'joker', isJoker: true },
  { word: 'joker', vowel: 'joker', ending: 'joker', firstLetter: 'joker', isJoker: true }
];

function normalizeCards(raw) {
  return raw.map((item, idx) => {
    const word = String(item?.word ?? 'cat').toLowerCase().trim();
    const isJoker = Boolean(item?.isJoker) || word === 'joker';
    const vowel = isJoker ? 'joker' : String(item?.vowel ?? word[1] ?? '').toLowerCase();
    const ending = isJoker ? 'joker' : String(item?.ending ?? word.slice(1)).toLowerCase();
    const firstLetter = isJoker ? 'joker' : String(item?.firstLetter ?? word[0] ?? '').toLowerCase();

    return {
      uid: `card-${idx}-${word}`,
      word,
      vowel,
      ending,
      firstLetter,
      isJoker,
      image: `./vowels_images/${isJoker ? 'joker' : word}.jpeg`
    };
  });
}

/**
 * Loads ./remi_cards.json with automatic fallback to the built-in 52-card deck.
 * @returns {Promise<Array<object>>}
 */
export async function loadRemiCards() {
  try {
    const res = await fetch('./remi_cards.json', { cache: 'default' });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        return normalizeCards(json);
      }
    }
  } catch {
    // Fall back cleanly if fetch fails
  }
  return normalizeCards(FALLBACK_REMI_CARDS);
}

/**
 * Fisher-Yates shuffle returning a new array.
 * @param {Array<object>} cards
 * @returns {Array<object>}
 */
export function shuffleDeck(cards) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Validates a set of cards against PHONIX Remi rules:
 * - At least 3 cards
 * - Jokers can stand in for any card
 * - All non-joker cards must share at least one of:
 *   Rule A: Same Vowel
 *   Rule B: Same Ending
 *   Rule C: Same First Letter
 *
 * @param {Array<object>} cards
 * @returns {{ valid: boolean, rules: string[], message: string }}
 */
export function validateRemiSet(cards) {
  if (!Array.isArray(cards) || cards.length < 3) {
    return {
      valid: false,
      rules: [],
      message: 'Select at least 3 cards to place a set on the table.'
    };
  }

  const regulars = cards.filter((c) => !c.isJoker);
  if (regulars.length <= 1) {
    return {
      valid: true,
      rules: ['Joker Wild'],
      message: 'Great! Joker wild set locked on the table.'
    };
  }

  const first = regulars[0];
  const sameVowel = regulars.every((c) => c.vowel === first.vowel);
  const sameEnding = regulars.every((c) => c.ending === first.ending);
  const sameFirst = regulars.every((c) => c.firstLetter === first.firstLetter);

  const rules = [];
  if (sameEnding) rules.push(`Same Ending (-${first.ending})`);
  if (sameVowel) rules.push(`Same Vowel (${first.vowel})`);
  if (sameFirst) rules.push(`Same First Letter (${first.firstLetter})`);

  if (rules.length > 0) {
    return {
      valid: true,
      rules,
      message: `Nice! Valid set: ${rules[0]}.`
    };
  }

  return {
    valid: false,
    rules: [],
    message: "Try again! These cards don't match by vowel, ending, or first letter."
  };
}
