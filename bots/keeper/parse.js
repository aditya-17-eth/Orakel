// Turn a crypto_price market's question into a machine decision.
//
// Real testnet questions look like:
//   "Will BTC/USD be at or above $64,000.00 at 2026-07-18 04:30:00 UTC?"
//   "Will ETH/USD be below $3,000 at 2026-07-19 12:00:00 UTC?"
//
// We extract the asset symbol, the comparator, and the USD threshold. The
// threshold is converted to the oracle's integer scale EXACTLY (string math,
// no float) so a decimals slip can never silently flip an outcome. Anything we
// cannot parse with confidence returns { confident: false } so the keeper
// alerts and skips rather than proposing on a guess.
//
// Outcome encoding matches the contract: Yes = 0, No = 1, Void = 2.

export const Outcome = Object.freeze({ YES: 0, NO: 1, VOID: 2 });

const QUESTION_RE = /Will\s+([A-Z0-9]{2,10})\/USD\s+be\s+(at or above|at or below|above|below)\s+\$([\d,]+(?:\.\d+)?)/i;

/** Comparator kinds derived from the question wording. */
const COMPARATORS = {
  'at or above': 'gte',
  'above': 'gt',
  'at or below': 'lte',
  'below': 'lt',
};

/**
 * Convert a USD amount string (e.g. "64,000.00") to the oracle's integer scale
 * for `decimals` places. Exact: no Number() on the whole value.
 */
export function usdToRaw(usdStr, decimals) {
  const clean = String(usdStr).replace(/,/g, '').trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) throw new Error(`unparseable USD amount: ${usdStr}`);
  const [intPart, fracPart = ''] = clean.split('.');
  if (fracPart.length > decimals) throw new Error(`USD amount has more precision than ${decimals} decimals`);
  const fracPadded = fracPart.padEnd(decimals, '0');
  return BigInt(intPart) * 10n ** BigInt(decimals) + BigInt(fracPadded || '0');
}

/**
 * Parse a market into a decision spec.
 * @returns {{confident:false, reason:string} | {confident:true, asset:string, comparator:string, thresholdUsd:string, decide:(rawPrice:bigint, decimals:number)=>0|1}}
 */
export function parseMarket(market) {
  if (market?.category !== 'crypto_price') {
    return { confident: false, reason: `not a crypto_price market (category=${market?.category})` };
  }
  const m = QUESTION_RE.exec(market?.question ?? '');
  if (!m) return { confident: false, reason: `question did not match the crypto_price template: "${market?.question}"` };

  const asset = m[1].toUpperCase();
  const comparator = COMPARATORS[m[2].toLowerCase()];
  const thresholdUsd = m[3];
  if (!comparator) return { confident: false, reason: `unknown comparator "${m[2]}"` };

  const decide = (rawPrice, decimals) => {
    const threshold = usdToRaw(thresholdUsd, decimals);
    const p = BigInt(rawPrice);
    let yes;
    switch (comparator) {
      case 'gte': yes = p >= threshold; break;
      case 'gt': yes = p > threshold; break;
      case 'lte': yes = p <= threshold; break;
      case 'lt': yes = p < threshold; break;
      default: throw new Error(`unhandled comparator ${comparator}`);
    }
    return yes ? Outcome.YES : Outcome.NO;
  };

  return { confident: true, asset, comparator, thresholdUsd, decide };
}

/** Flip Yes<->No for the LIE_MODE adversarial test. Void is left untouched. */
export function invertOutcome(outcome) {
  if (outcome === Outcome.YES) return Outcome.NO;
  if (outcome === Outcome.NO) return Outcome.YES;
  return outcome;
}
