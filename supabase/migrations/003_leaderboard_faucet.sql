create table if not exists public.faucet_requests (
  wallet text primary key,
  last_requested_at timestamptz not null
);

alter table public.faucet_requests enable row level security;
revoke all on table public.faucet_requests from anon, authenticated;
grant all on table public.faucet_requests to service_role;

create or replace function public.claim_faucet_slot(p_wallet text, p_cooldown_seconds integer)
returns table(allowed boolean, next_available_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare current_time timestamptz := now();
begin
  insert into public.faucet_requests(wallet, last_requested_at)
  values (p_wallet, current_time)
  on conflict (wallet) do update
    set last_requested_at = excluded.last_requested_at
    where public.faucet_requests.last_requested_at <= current_time - make_interval(secs => p_cooldown_seconds);
  if found then
    return query select true, current_time;
  else
    return query select false, (select last_requested_at + make_interval(secs => p_cooldown_seconds) from public.faucet_requests where wallet = p_wallet);
  end if;
end;
$$;

create or replace function public.release_faucet_slot(p_wallet text)
returns void language sql security definer set search_path = public
as $$ delete from public.faucet_requests where wallet = p_wallet; $$;

revoke all on function public.claim_faucet_slot(text, integer) from public, anon, authenticated;
revoke all on function public.release_faucet_slot(text) from public, anon, authenticated;
grant execute on function public.claim_faucet_slot(text, integer) to service_role;
grant execute on function public.release_faucet_slot(text) to service_role;

create or replace function public.get_trading_leaderboard(p_contract_id text, p_limit integer default 50)
returns table(rank bigint, wallet text, volume numeric, trades bigint, markets bigint)
language sql security definer set search_path = public
as $$
  with activity as (
    select
      topics ->> 2 as wallet,
      case when name = 'buy' then (data ->> 1)::numeric else (data ->> 2)::numeric end as volume,
      topics ->> 1 as market_id
    from public.contract_events
    where contract_id = p_contract_id
      and name in ('buy', 'sell')
      and jsonb_array_length(topics) >= 3
  ), ranked as (
    select wallet, sum(volume) as volume, count(*)::bigint as trades, count(distinct market_id)::bigint as markets
    from activity where wallet is not null group by wallet
  )
  select row_number() over (order by volume desc, wallet asc) as rank, wallet, volume, trades, markets
  from ranked order by volume desc, wallet asc limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.get_trading_leaderboard(text, integer) from public, anon, authenticated;
grant execute on function public.get_trading_leaderboard(text, integer) to service_role;
