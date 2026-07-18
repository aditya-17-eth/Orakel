// Telegram notifier. Backs both alerts and the 10-minute bot heartbeats.
//
// Design rule (Section 4): a Telegram outage must NEVER crash a bot's main
// loop. sendTelegram therefore never throws — it logs and returns false on any
// failure (missing config, network error, non-2xx response).

import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from './config.js';

/**
 * Send a message to the configured Telegram chat.
 *
 * @param {string} msg
 * @param {object} [opts]
 * @param {'MarkdownV2'|'HTML'} [opts.parseMode]  optional formatting mode
 * @returns {Promise<boolean>} true if delivered, false otherwise (never throws)
 */
export async function sendTelegram(msg, opts = {}) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — skipping:', msg);
    return false;
  }

  const body = { chat_id: TELEGRAM_CHAT_ID, text: msg };
  if (opts.parseMode) body.parse_mode = opts.parseMode;

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[telegram] send failed: ${res.status} ${detail}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[telegram] send error:', err?.message ?? err);
    return false;
  }
}
