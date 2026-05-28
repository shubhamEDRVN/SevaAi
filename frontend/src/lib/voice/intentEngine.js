/**
 * Lightweight local intent engine to bypass Gemini for common complaints.
 */

const patterns = {
  water: /water|pipe|leak|drainage|sewage|plumb|tap/i,
  electricity: /light|electric|power|wire|bulb|streetlight/i,
  waste: /garbage|trash|waste|dustbin|sweep|clean/i,
  road: /road|pothole|street|highway|pavement/i,
  health: /health|hospital|doctor|medicine|mosquito|dengue|malaria/i
};

export function detectLocalIntent(text) {
  if (!text) return null;
  
  for (const [department, regex] of Object.entries(patterns)) {
    if (regex.test(text)) {
      return {
        intent: 'complaint',
        department,
        confidence: 0.9,
        shouldUseGemini: false
      };
    }
  }
  
  return {
    intent: 'unknown',
    department: null,
    confidence: 0.1,
    shouldUseGemini: true
  };
}
