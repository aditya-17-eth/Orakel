-- Accelerates server-side wallet activity queries using JSONB topic matching.
create index if not exists contract_events_topics_gin_idx
  on public.contract_events using gin (topics jsonb_path_ops);
