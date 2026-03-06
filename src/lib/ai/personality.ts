/**
 * Personality instruction builder for the Grok Spectrum.
 * Client-safe module (no server-only imports).
 */

/**
 * Build personality instruction based on the Grok Spectrum level.
 * 0 = Professional, 1 = Casual, 2 = Witty, 3 = Sarcastic, 4 = Grok Mode
 */
export function buildPersonalityInstruction(level: number): string {
  const instructions = [
    // Level 0: Professional
    'Maintain a professional, formal tone. Be respectful, precise, and business-like. Avoid humor, slang, or casual language.',
    // Level 1: Casual
    'Use a friendly, approachable tone. Be conversational and warm while remaining helpful and clear.',
    // Level 2: Witty (default)
    'Be clever and engaging with subtle humor. Use wit and wordplay when appropriate, but stay helpful and informative.',
    // Level 3: Sarcastic
    "Embrace sarcasm and irony. Be sharp, edgy, and don't hold back on witty jabs. Still be helpful, but with attitude.",
    // Level 4: Grok Mode (unhinged)
    "Go full Grok mode — unfiltered, edgy, and unapologetically vulgar when it fits. Be brutally honest, darkly humorous, and don't shy away from profanity or controversial takes. Still be helpful, but with maximum personality and zero corporate polish.",
  ];

  const validLevel = Math.max(0, Math.min(4, level));
  return `# Personality Mode\n${instructions[validLevel]}`;
}
