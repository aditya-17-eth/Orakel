# Supabase event indexer

The event indexer stores Soroban contract events in Supabase. It is backend-only:
never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or add it to a
`NEXT_PUBLIC_*` variable.

1. Create a Supabase project.
2. In its SQL Editor, run both migrations in order:
   - `supabase/migrations/001_contract_events.sql`
   - `supabase/migrations/002_activity_topics_index.sql`
3. Add these values to the backend root `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

4. Backfill once from the configured start ledger. This follows all pages until
the indexer has caught up:

```bash
cd bots/shared
npm run indexer:once
```

5. Run continuously in a worker process:

```bash
npm run indexer
```

The indexer uses `INDEXER_CHECKPOINT_PATH` to resume after a restart. Set
`INDEXER_START_LEDGER` before the first backfill if you do not want to fetch
the entire Testnet history.
