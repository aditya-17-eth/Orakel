// Manual end-to-end smoke check for bots/shared against a live network.
//
// Requires (at minimum) RPC_URL and CONTRACT_ID. Optionally KEEPER_SECRET (any
// *_SECRET works — pass its name as arg 1), TELEGRAM_BOT_TOKEN/CHAT_ID.
//
//   RPC_URL=... CONTRACT_ID=... KEEPER_SECRET=S... node scripts/smoke.js
//   node scripts/smoke.js WATCHER_SECRET   # use a different key env
//
// Exercises all four capabilities: loadKeypair, simulate (free read),
// pollEvents (event stream), sendTelegram (alert). Does NOT submit a write.

import { config, loadKeypair, simulate, pollEvents, sendTelegram } from '../index.js';

const keyEnv = process.argv[2] ?? 'KEEPER_SECRET';

async function step(label, fn) {
  process.stdout.write(`\n▶ ${label}\n`);
  try {
    await fn();
    process.stdout.write('  ✓ ok\n');
  } catch (err) {
    process.stdout.write(`  ✗ ${err?.message ?? err}\n`);
  }
}

console.log(`RPC_URL     = ${config.RPC_URL}`);
console.log(`CONTRACT_ID = ${config.CONTRACT_ID}`);

await step(`loadKeypair(${keyEnv})`, async () => {
  const kp = loadKeypair(keyEnv);
  console.log(`  public key: ${kp.publicKey()}`);
});

await step('simulate market_count', async () => {
  const count = await simulate(config.CONTRACT_ID, 'market_count', []);
  console.log(`  market_count = ${count}`);
});

await step('pollEvents(latest - 5000)', async () => {
  const { sequence } = await config.server.getLatestLedger();
  const from = Math.max(1, sequence - 5000);
  const { events, latestLedger, nextLedger } = await pollEvents(from);
  console.log(`  ledgers ${from}..${latestLedger}: ${events.length} events, nextLedger=${nextLedger}`);
  for (const ev of events.slice(0, 5)) console.log(`    - ${ev.name} @ ledger ${ev.ledger}`);
});

await step('sendTelegram', async () => {
  const ok = await sendTelegram('shared smoke ok');
  console.log(`  delivered: ${ok}`);
});

console.log('\nsmoke complete');
