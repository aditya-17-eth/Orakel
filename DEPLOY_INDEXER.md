# Deploying the indexer

The indexer has no public HTTP endpoint. Run it as a worker/container with the
same backend-only environment values used locally.

## Before deploying

1. Run the SQL migration in `supabase/migrations/001_contract_events.sql`.
2. Set `RPC_URL`, `NETWORK_PASSPHRASE`, `CONTRACT_ID`, `SUPABASE_URL`, and
   `SUPABASE_SERVICE_ROLE_KEY` as the worker's secret environment variables.
3. Never use `NEXT_PUBLIC_` for the service-role key.

## Docker Compose

From the repository root:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f indexer
```

The Compose service restarts after a crash or host reboot and persists its
Stellar event cursor in the `indexer-state` Docker volume.

To check the dependencies manually:

```bash
docker compose exec indexer npm run status
```

## Hosted worker

Any container host can run `bots/shared/Dockerfile`. Configure it as a
long-running worker (not a web service), use the provided command
`npm run indexer`, and configure a persistent disk at `/app/data` so the
cursor survives deployments.
