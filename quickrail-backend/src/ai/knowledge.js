import { query } from '../db/pool.js';

const normalize = (value) => String(value || '')
  .toLocaleLowerCase()
  .normalize('NFKC')
  .replace(/[’‘]/g, "'")
  .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const words = (value) => new Set(normalize(value).split(/\s+/).filter((w) => w.length > 2));

/**
 * Retrieve a stored greeting/FAQ response. This module only returns text:
 * it never executes booking, payment, PNR, or cancellation actions.
 */
export async function findKnowledgeReply(message) {
  const input = normalize(message);
  if (!input || input.length > 300) return null;

  const result = await query(
    `SELECT phrases, keywords, response
       FROM quickrail_knowledge_base
      WHERE status = 'active'`
  );

  const inputWords = words(input);
  let best = null;
  let bestScore = 0;

  for (const row of result.rows) {
    const phrases = Array.isArray(row.phrases) ? row.phrases : [];
    const keywords = Array.isArray(row.keywords) ? row.keywords : [];
    let score = 0;

    for (const rawPhrase of phrases) {
      const phrase = normalize(rawPhrase);
      if (!phrase) continue;
      if (input === phrase) score = Math.max(score, 100);
      else if (phrase.length >= 4 && input.includes(phrase)) score = Math.max(score, 88);
      else if (phrase.length >= 5 && phrase.includes(input) && input.length >= 5) score = Math.max(score, 72);
    }

    if (score < 70) {
      const matched = keywords.filter((word) => inputWords.has(normalize(word)));
      if (matched.length >= 2) score = Math.max(score, 40 + Math.min(matched.length, 5));
    }

    if (score > bestScore) {
      best = row.response;
      bestScore = score;
    }
  }

  // Exact or phrase-level matches only; avoid guessing an answer from weak keyword overlap.
  return bestScore >= 70 ? best : null;
}
