/**
 * Serviq Voice Service Keywords Configuration
 * Maps Hindi, Hinglish, and English spoken phrases to standard service categories.
 */

export const SERVICE_KEYWORD_MAPPINGS = [
  {
    service: 'AC repair',
    keywords: [
      'ac', 'air conditioner', 'cooling', 'cool', 'thanda nahi', 'thanda nahi karta',
      'ac theek', 'ac servicing', 'gas leak', 'gas charge', 'compressor',
      'एसी', 'ठंडा नहीं', 'एयर कंडीशनर',
    ],
  },
  {
    service: 'Plumbing',
    keywords: [
      'plumber', 'plumbing', 'nal', 'nal theek', 'paani leak', 'pani leak',
      'water leak', 'tap', 'pipe', 'leakage', 'flush', 'washbasin', 'drain',
      'नल', 'पानी लीक', 'प्लम्बर', 'पाइप',
    ],
  },
  {
    service: 'Electrical',
    keywords: [
      'electrician', 'electrical', 'bijli', 'light', 'fan', 'pankha', 'switch',
      'wiring', 'mcb', 'fuse', 'short circuit', 'current', 'bulb', 'inverter',
      'बिजली', 'पंखा', 'लाइट', 'इलेक्ट्रीशियन', 'स्विच',
    ],
  },
  {
    service: 'Cleaning',
    keywords: [
      'clean', 'cleaning', 'safai', 'safayi', 'deep cleaning', 'bathroom cleaning',
      'kitchen cleaning', 'house cleaning', 'pocha', 'jhadu', 'dusting',
      'सफाई', 'क्लीनिंग', 'झाड़ू', 'पोछा',
    ],
  },
  {
    service: 'Painting',
    keywords: [
      'paint', 'painting', 'painter', 'rang', 'rangai', 'putty', 'whitewash',
      'wall paint', 'colour', 'color', 'रंग', 'पेंटिंग', 'पेंट',
    ],
  },
  {
    service: 'Carpentry',
    keywords: [
      'carpenter', 'carpentry', 'lakdi', 'wood', 'furniture', 'badhai', 'barhai',
      'door', 'darwaza', 'handle', 'lock', 'khidki', 'table', 'chair',
      'बढ़ई', 'लकड़ी', 'कारपेंटर', 'दरवाजा',
    ],
  },
  {
    service: 'Cooking',
    keywords: [
      'cook', 'cooking', 'chef', 'khana', 'khana banana', 'rasoi', 'roti',
      'sabzi', 'meal', 'tiffin', 'महाराज', 'खाना', 'रसोई', 'कुक',
    ],
  },
];

/**
 * Match spoken text against keyword rules.
 * @param {string} text - Spoken transcript
 * @returns {string|null} Matched canonical service name or null
 */
export function matchServiceFromVoiceText(text) {
  if (!text || typeof text !== 'string') return null;
  const normalized = text.toLowerCase();

  for (const mapping of SERVICE_KEYWORD_MAPPINGS) {
    for (const kw of mapping.keywords) {
      // Word boundary match or exact substring match
      const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s|[^a-zA-Z0-9\u0900-\u097F])${escapedKw}($|\\s|[^a-zA-Z0-9\u0900-\u097F])`, 'i');
      if (regex.test(normalized)) {
        return mapping.service;
      }
    }
  }

  return null;
}
