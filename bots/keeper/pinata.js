// Pin a JSON evidence bundle to IPFS via Pinata, returning its CID.
//
// The evidence bundle is the auditable record behind every proposal: it lets a
// human (or the watcher) reproduce the keeper's decision. Unlike Telegram,
// pinning failure is NOT swallowed — proposing without a pinned evidence CID
// would undermine the dispute model, so the caller treats a throw here as
// "skip this market, retry next loop".

import { PINATA_JWT } from '../shared/config.js';

const PINATA_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

export class PinataError extends Error {
  constructor(message, { cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'PinataError';
  }
}

/**
 * Pin `bundle` as JSON. Returns the IPFS CID string.
 * @param {object} bundle
 * @param {string} name  a human label for the pin
 */
export async function pinEvidence(bundle, name = 'orakel-evidence') {
  if (!PINATA_JWT) throw new PinataError('PINATA_JWT is not configured — cannot pin evidence.');

  let res;
  try {
    res = await fetch(PINATA_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${PINATA_JWT}` },
      body: JSON.stringify({ pinataMetadata: { name }, pinataContent: bundle }),
    });
  } catch (err) {
    throw new PinataError(`pin request failed: ${err?.message ?? err}`, { cause: err });
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new PinataError(`pin rejected: ${res.status} ${detail}`);
  }
  const data = await res.json().catch(() => ({}));
  const cid = data.IpfsHash ?? data.cid;
  if (!cid) throw new PinataError('pin succeeded but no CID was returned.');
  return cid;
}
