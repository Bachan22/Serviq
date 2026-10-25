/**
 * Serviq Voice Amount Parser
 * Pure function parsing Hindi, Hinglish, and English spoken amounts into integer Rupee numbers.
 */

export const MIN_VOICE_AMOUNT = 50;
export const MAX_VOICE_AMOUNT = 20000;

// Devanagari digits to ASCII digits
const DEVANAGARI_DIGITS = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

// Word map: Devanagari, English, Romanized Hindi
const NUMBER_WORDS = {
  // 0 - 9
  zero: 0, शून्य: 0, shunya: 0, sifar: 0,
  one: 1, ek: 1, एक: 1,
  two: 2, do: 2, दो: 2,
  three: 3, teen: 3, tin: 3, तीन: 3,
  four: 4, chaar: 4, char: 4, चार: 4,
  five: 5, paanch: 5, panch: 5, पाँच: 5, पाच: 5,
  six: 6, chhah: 6, chhe: 6, che: 6, छह: 6, छः: 6,
  seven: 7, saat: 7, sat: 7, सात: 7,
  eight: 8, aath: 8, aat: 8, आठ: 8,
  nine: 9, nau: 9, no: 9, नौ: 9,

  // 10 - 19
  ten: 10, das: 10, दस: 10,
  eleven: 11, gyarah: 11, gyara: 11, ग्यारह: 11,
  twelve: 12, barah: 12, bara: 12, बारह: 12,
  thirteen: 13, terah: 13, tera: 13, तेरह: 13,
  fourteen: 14, chaudah: 14, chauda: 14, चौदह: 14,
  fifteen: 15, pandrah: 15, pandra: 15, पंद्रह: 15,
  sixteen: 16, solah: 16, sola: 16, सोलह: 16,
  seventeen: 17, satrah: 17, satra: 17, सत्रह: 17,
  eighteen: 18, atharah: 18, athara: 18, अठारह: 18,
  nineteen: 19, unnees: 19, unnis: 19, उन्नीस: 19,

  // 20 - 29
  twenty: 20, bees: 20, bis: 20, बीस: 20,
  ikkees: 21, ikkis: 21, इक्कीस: 21,
  baais: 22, bais: 22, बाइस: 22,
  teis: 23, teis: 23, तेईस: 23,
  chaubees: 24, chaubis: 24, चौबीस: 24,
  pachhees: 25, pachis: 25, पच्चीस: 25,
  chhabbees: 26, chhattis: 26, छब्बीस: 26,
  sattais: 27, सत्ताइस: 27,
  atthaais: 28, athais: 28, अट्ठाइस: 28,
  untees: 29, untis: 29, उनतीस: 29,

  // 30 - 39
  thirty: 30, tees: 30, tis: 30, तीस: 30,
  iktees: 31, iktis: 31, इकतीस: 31,
  battis: 32, बत्तीस: 32,
  tentees: 33, tentis: 33, तैंतीस: 33,
  chautees: 34, chautis: 34, चौंतीस: 34,
  paintees: 35, paintis: 35, पैंतीस: 35,
  chhattees: 36, chhattis: 36, छत्तीस: 36,
  saintees: 37, saintis: 37, सैंतीस: 37,
  adhtees: 38, adhtis: 38, अड़तीस: 38,
  untaalees: 39, untalis: 39, उनतालीस: 39,

  // 40 - 49
  forty: 40, chaalees: 40, chalis: 40, चालीस: 40,
  iktalis: 41, iktalis: 41, इकतालीस: 41,
  bayalis: 42, bayalis: 42, बयालीस: 42,
  taintalis: 43, taintalis: 43, तैंतालीस: 43,
  chavalis: 44, chavalis: 44, चवालीस: 44,
  paintalis: 45, paintalis: 45, पैंतालीस: 45,
  chhiyalis: 46, chhiyalis: 46, छियालीस: 46,
  saintalis: 47, saintalis: 47, सैंतालीस: 47,
  adhtalis: 48, adhtalis: 48, अड़तालीस: 48,
  unchaas: 49, unchas: 49, उनचास: 49,

  // 50 - 59
  fifty: 50, pachaas: 50, pachas: 50, पचास: 50,
  ikyavan: 51, ikyawan: 51, इक्यावन: 51,
  baavan: 52, baawan: 52, बावन: 52,
  tirepan: 53, tirepan: 53, तिरपन: 53,
  chauvan: 54, chauwan: 54, चौवन: 54,
  pachpan: 55, pachpan: 55, बचपन: 55, पचपन: 55,
  chhappan: 56, chhappan: 56, छप्पन: 56,
  sattaavan: 57, sattawan: 57, सत्तावन: 57,
  atthaavan: 58, atthawan: 58, अट्ठावन: 58,
  unsath: 59, unsath: 59, उनसठ: 59,

  // 60 - 69
  sixty: 60, saath: 60, sath: 60, साठ: 60,
  iksath: 61, iksath: 61, इकसठ: 61,
  baasath: 62, basath: 62, बासठ: 62,
  tiresath: 63, tresath: 63, तिरसठ: 63,
  chausath: 64, chausath: 64, चौंसठ: 64,
  painsath: 65, painsath: 65, पैंसठ: 65,
  chhiyasaath: 66, chhiyasath: 66, छियासठ: 66,
  sadsath: 67, sarsath: 67, सरसठ: 67,
  arhsath: 68, arhsath: 68, अड़सठ: 68,
  unhattar: 69, unhattar: 69, उनहत्तर: 69,

  // 70 - 79
  seventy: 70, sattar: 70, सत्तर: 70,
  ikhattar: 71, ikhattar: 71, इकहत्तर: 71,
  bahattar: 72, bahattar: 72, बहत्तर: 72,
  tihattar: 73, tihattar: 73, तिहत्तर: 73,
  chauhattar: 74, chauhattar: 74, चौहत्तर: 74,
  pachhattar: 75, pachhattar: 75, पचहत्तर: 75,
  chhihattar: 76, chhihattar: 76, छिहत्तर: 76,
  sathattar: 77, sathattar: 77, सतहत्तर: 77,
  athahattar: 78, athahattar: 78, अठहत्तर: 78,
  unyaasi: 79, unyasi: 79, unasi: 79, उन्यासी: 79,

  // 80 - 89
  eighty: 80, assi: 80, अस्सी: 80,
  ikyasi: 81, ikyasi: 81, इक्यासी: 81,
  bayasi: 82, bayasi: 82, बयासी: 82,
  tirasi: 83, tirasi: 83, तिरासी: 83,
  chaurasi: 84, chaurasi: 84, चौरासी: 84,
  pachasi: 85, pachasi: 85, पचासी: 85,
  chhiyasi: 86, chhiyasi: 86, छियासी: 86,
  satasi: 87, satasi: 87, सत्तासी: 87,
  athasi: 88, athasi: 88, अट्ठासी: 88,
  nawasi: 89, navasi: 89, नवाँसी: 89,

  // 90 - 99
  ninety: 90, nabbe: 90, nabbey: 90, नब्बे: 90,
  ikyanve: 91, ikyanwe: 91, इक्यानवे: 91,
  baanve: 92, baanwe: 92, बानवे: 92,
  tiranve: 93, tiranwe: 93, तिराने: 93,
  chauranve: 94, chauranwe: 94, चौरानवे: 94,
  pachaanve: 95, pachaanwe: 95, pachanve: 95, पचानवे: 95,
  chhiyanve: 96, chhiyanwe: 96, छियानवे: 96,
  sattanve: 97, sattanwe: 97, सत्तानवे: 97,
  atthanve: 98, atthanwe: 98, अट्ठानवे: 98,
  ninyanve: 99, ninyanwe: 99, निन्यानवे: 99,
};

// Multipliers
const MULTIPLIERS = {
  hundred: 100, sau: 100, so: 100, सौ: 100,
  thousand: 1000, hazaar: 1000, hazar: 1000, हजार: 1000, हज़ार: 1000,
  lakh: 100000, lac: 100000, लाख: 100000,
  crore: 10000000, करोड़: 10000000,
};

// Special compound Hindi units
const SPECIAL_COMPOUNDS = [
  { match: /(^|\s)(dedh\s+hazaar|derh\s+hazaar|डेढ़\s+हज़ार|डेढ़\s+हजार)($|\s)/i, value: 1500 },
  { match: /(^|\s)(dhai\s+hazaar|ढाई\s+हज़ार|ढाई\s+हजार)($|\s)/i, value: 2500 },
  { match: /(^|\s)(dedh\s+sau|derh\s+sau|डेढ़\s+सौ)($|\s)/i, value: 1500 }, // in case or 150
  { match: /(^|\s)(dhai\s+sau|ढाई\s+सौ)($|\s)/i, value: 250 },
];

/**
 * Replace Devanagari numerals in string with Arabic digits (०-९ -> 0-9)
 */
function replaceDevanagariNumerals(str) {
  return str.replace(/[०-९]/g, (ch) => DEVANAGARI_DIGITS[ch] || ch);
}

/**
 * Clean & normalize transcript
 */
function cleanTranscript(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = replaceDevanagariNumerals(raw.trim());
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').toLowerCase();
  return cleaned;
}

/**
 * Parse an isolated segment into an integer Rupee amount
 */
function parseSegment(text) {
  if (!text) return null;

  // 1. Direct compound forms
  if (/\b(dedh\s+sau|derh\s+sau|डेढ़\s+सौ)\b/i.test(text)) {
    return 150;
  }
  if (/\b(dhai\s+sau|ढाई\s+सौ)\b/i.test(text)) {
    return 250;
  }
  if (/\b(dedh\s+hazaar|derh\s+hazaar|डेढ़\s+हज़ार|डेढ़\s+हजार)\b/i.test(text)) {
    return 1500;
  }
  if (/\b(dhai\s+hazaar|ढाई\s+hazar|ढाई\s+हज़ार|ढाई\s+हजार)\b/i.test(text)) {
    return 2500;
  }

  // Check for "saade / sadhe <number> sau / hazaar"
  const saadeSauMatch = text.match(/\b(saade|sadhe|sarhe|साढ़े)\s+([a-z\u0900-\u097F]+)\s+(sau|so|सौ)\b/i);
  if (saadeSauMatch) {
    const baseWord = saadeSauMatch[2].toLowerCase();
    const baseNum = NUMBER_WORDS[baseWord];
    if (baseNum != null) {
      return baseNum * 100 + 50;
    }
  }

  const saadeHazaarMatch = text.match(/\b(saade|sadhe|sarhe|साढ़े)\s+([a-z\u0900-\u097F]+)\s+(hazaar|hazar|हज़ार|हजार|thousand)\b/i);
  if (saadeHazaarMatch) {
    const baseWord = saadeHazaarMatch[2].toLowerCase();
    const baseNum = NUMBER_WORDS[baseWord];
    if (baseNum != null) {
      return baseNum * 1000 + 500;
    }
  }

  // 2. Direct pure digits with optional currency signs/fillers (e.g., "₹360", "Rs 360", "360", "360 rupaye")
  const digitRegex = /(?:₹|rs\.?|inr)?\s*(\d{2,6})\s*(?:rupaye|rupees|rupya|rs|inr|\/-)?/gi;
  const digitMatches = [...text.matchAll(digitRegex)];
  if (digitMatches.length > 0) {
    // If digits found, return the last numeric match value
    const lastNumStr = digitMatches[digitMatches.length - 1][1];
    const val = parseInt(lastNumStr, 10);
    if (!isNaN(val)) return val;
  }

  // 3. Word-based number parsing (e.g., "three hundred sixty", "teen sau saath", "do hazaar paanch sau")
  const tokens = text
    .replace(/[₹,.\/\\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let currentTotal = 0;
  let currentGroup = 0;
  let hasFoundNumber = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].toLowerCase();

    // Check if token is raw digits
    if (/^\d+$/.test(token)) {
      const num = parseInt(token, 10);
      currentGroup += num;
      hasFoundNumber = true;
      continue;
    }

    // Check if token is in NUMBER_WORDS
    if (NUMBER_WORDS[token] !== undefined) {
      currentGroup += NUMBER_WORDS[token];
      hasFoundNumber = true;
      continue;
    }

    // Check if token is in MULTIPLIERS
    if (MULTIPLIERS[token] !== undefined) {
      const mult = MULTIPLIERS[token];
      if (currentGroup === 0) {
        currentGroup = 1;
      }
      if (mult >= 1000) {
        currentTotal += currentGroup * mult;
        currentGroup = 0;
      } else {
        currentGroup = currentGroup * mult;
      }
      hasFoundNumber = true;
      continue;
    }

    // Ignore filler words
    if (['rupaye', 'rupees', 'rupee', 'rs', 'inr', 'ka', 'mein', 'me', 'approx', 'around', 'chalega', 'bas', 'and', 'only', 'bhi', 'to'].includes(token)) {
      continue;
    }
  }

  if (hasFoundNumber) {
    const total = currentTotal + currentGroup;
    return total;
  }

  return null;
}

/**
 * Main function: parse spoken amount
 * @param {string} text - Spoken transcript
 * @returns {{ valid: boolean, value: number|null, formatted: string|null, heard: string, reason?: string, message?: string }}
 */
export function parseSpokenAmount(text) {
  const heard = (text || '').trim();
  if (!heard) {
    return {
      valid: false,
      value: null,
      formatted: null,
      heard: '',
      reason: 'EMPTY',
      message: 'Please say the price again, for example: teen sau saath',
    };
  }

  const cleaned = cleanTranscript(heard);

  // If there are words indicating correction (e.g. "nahi", "ya", "not", "par ab", "instead"), split by these clauses
  // and take the last valid number
  const clauses = cleaned.split(/\b(?:nahi|ya|or|par|lekin|instead|actually|nahin)\b/i);
  let parsedValue = null;

  for (let i = clauses.length - 1; i >= 0; i--) {
    const segVal = parseSegment(clauses[i]);
    if (segVal !== null) {
      parsedValue = segVal;
      break;
    }
  }

  if (parsedValue === null) {
    // Try on full text
    parsedValue = parseSegment(cleaned);
  }

  if (parsedValue === null || isNaN(parsedValue)) {
    return {
      valid: false,
      value: null,
      formatted: null,
      heard,
      reason: 'NOT_A_NUMBER',
      message: 'Please say the price again, for example: teen sau saath',
    };
  }

  // Validate range
  if (parsedValue < MIN_VOICE_AMOUNT || parsedValue > MAX_VOICE_AMOUNT) {
    return {
      valid: false,
      value: parsedValue,
      formatted: `₹${parsedValue}`,
      heard,
      reason: 'OUT_OF_RANGE',
      message: `Please say the price again between ₹${MIN_VOICE_AMOUNT} and ₹${MAX_VOICE_AMOUNT}. For example: teen sau saath`,
    };
  }

  return {
    valid: true,
    value: Math.round(parsedValue),
    formatted: `₹${Math.round(parsedValue)}`,
    heard,
  };
}
