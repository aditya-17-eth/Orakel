# Orakel backend handoff

## Scope

This handoff covers backend, Supabase, and indexer work only. The separately
owned frontend in `web/` and Telegram work were intentionally not changed.

## What was implemented

- A browser-independent Stellar/Soroban shared backend layer in `bots/shared`.
- Runtime configuration loading from the backend root `.env` file.
- A Supabase event store for this contract's Soroban events.
- A cursor-based Testnet event indexer that:
  - retrieves only events for `CONTRACT_ID`;
  - writes idempotently to Supabase;
  - persists its cursor locally or in the supplied Docker volume;
  - recovers automatically when Stellar Testnet has pruned the requested start
    ledger;
  - catches up through all available event pages with `npm run indexer:once`;
  - continues polling with `npm run indexer`.
- A status command that checks configuration, Supabase access/schema, and
  Stellar RPC access: `npm run status`.
- A production portfolio/activity query layer:
  - `getPortfolio()` reads positions, LP shares, prices, and claimable values
    from Soroban, with bounded market pagination and concurrency limits.
  - `getWalletActivity()` reads only the authenticated wallet's indexed
    activity events with a stable cursor.
  - user wallets are validated as Stellar G-addresses before any query.
- Resolution/evidence timeline queries combining on-chain market metadata with
  indexed lifecycle events and safe Pinata criteria links.
- Server-side trading leaderboard aggregation from buy/sell event volume.
- Testnet-only XLM faucet requests through Stellar Friendbot with an atomic
  Supabase cooldown and failure-slot release.
- Docker and Docker Compose files for a restart-safe, long-running worker.
- Environment examples and setup/deployment documentation.

## Database

Run `supabase/migrations/001_contract_events.sql` in the Supabase SQL Editor.
It creates `public.contract_events` with:

- `contract_id` and `event_id` as a unique event identity;
- ledger, transaction hash, event name, decoded topics/data, and close time;
- indexes for recent-ledger and event-name queries;
- row-level security enabled, with access limited to the server-side
  `service_role`.

The `SUPABASE_SERVICE_ROLE_KEY` is backend-only. Never expose it in browser
code or through a `NEXT_PUBLIC_*` environment variable.

## Required environment values

Place these in the backend root `.env` file. Do not commit this file.

```env
RPC_URL=https://soroban-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
CONTRACT_ID=<stellar-contract-id>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>

# Optional indexer settings
INDEXER_START_LEDGER=1
INDEXER_POLL_MS=5000
INDEXER_CHECKPOINT_PATH=.orakel-indexer-checkpoint.json
```

`INDEXER_START_LEDGER=1` is safe: the indexer moves forward automatically if
the Testnet RPC has pruned that history.

## Operations

From `bots/shared`:

```bash
npm test
npm run status
npm run indexer:once
npm run indexer
```

For an always-on worker with Docker, from the repository root:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f indexer
```

Use either Docker or the direct terminal process, not both.

## Frontend integration contract

The frontend should query `public.contract_events` through a server-side API
route or its backend service. It must not use the service-role key in the
browser. A basic verification query is:

```sql
select *
from public.contract_events
order by ledger desc
limit 50;
```

## Files added or changed

- `bots/shared/config.js` — runtime config and validation.
- `bots/shared/db.js` — Supabase admin client and idempotent event writes.
- `bots/shared/events.js` — decoding, pagination, and cursor checkpoints.
- `bots/shared/indexer.js` — event indexing and Testnet retention recovery.
- `bots/shared/scripts/indexer.js` — CLI entry point.
- `bots/shared/scripts/status.js` — dependency health/status check.
- `supabase/migrations/001_contract_events.sql` — database schema.
- `supabase/migrations/002_activity_topics_index.sql` — wallet activity query index.
- `supabase/migrations/003_leaderboard_faucet.sql` — leaderboard SQL function and faucet cooldown.
- `bots/shared/portfolio.js` — on-chain portfolio reads and valuation.
- `bots/shared/activity.js` — server-side wallet activity query.
- `bots/shared/timeline.js` — resolution timeline and evidence link.
- `bots/shared/leaderboard.js` — trading-volume leaderboard query.
- `bots/shared/faucet.js` — rate-limited Testnet Friendbot integration.
- `bots/shared/Dockerfile` and `docker-compose.yml` — worker deployment.
- `SUPABASE_SETUP.md` and `DEPLOY_INDEXER.md` — setup/operations guides.

## Validation completed

- `npm test` passes: 13 tests.
- The Docker Compose configuration validates successfully.
- Indexer configuration validation, Testnet retention recovery, and database
  schema setup were exercised during local setup.

## Remaining release work

- Commit and push this backend branch.
- Deploy the Docker worker to a persistent host before relying on it outside a
  developer machine.
- Test a real contract action and confirm its event appears in Supabase.
- Add production monitoring/alerts and a backup/retention policy.
- Complete an independent security review before any Mainnet migration.

## Portfolio/activity API contract

The frontend should call server-side routes that wrap these shared functions:

```js
const portfolio = await getPortfolio({ wallet, offset: 0, limit: 25 });
const activity = await getWalletActivity({ wallet, limit: 50, cursor });
```

The response amounts are strings containing 7-decimal token base units. Format
them only at the UI boundary. Never accept a wallet address from a session
without validating it, and never expose the Supabase service-role key.
