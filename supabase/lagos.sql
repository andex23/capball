-- Counterball in Lagos Life: caps players have bought.
-- Run once in the Supabase SQL editor. Only the game's server (service role)
-- can read or write this; players never touch it directly.

create table if not exists public.cb_lagos_owned (
  purchase_id text primary key,
  mode text not null check (mode in ('test', 'live')),
  player_id text not null,
  product_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists cb_lagos_owned_player on public.cb_lagos_owned (mode, player_id);
alter table public.cb_lagos_owned enable row level security;
revoke all on public.cb_lagos_owned from anon, authenticated;

-- 'grant' records a verified purchase (once per purchase); both actions return
-- the product ids the player owns.
create or replace function public.cb_lagos_service(p_action text, p_mode text, p_player text, p_product text default null, p_purchase text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_mode not in ('test', 'live') or coalesce(p_player, '') = '' then
    raise exception 'bad-request';
  end if;
  if p_action = 'grant' then
    if coalesce(p_product, '') = '' or coalesce(p_purchase, '') = '' then
      raise exception 'bad-request';
    end if;
    insert into cb_lagos_owned (purchase_id, mode, player_id, product_id)
    values (p_purchase, p_mode, p_player, p_product)
    on conflict (purchase_id) do nothing;
  elsif p_action <> 'list' then
    raise exception 'bad-request';
  end if;
  return coalesce(
    (select jsonb_agg(distinct product_id) from cb_lagos_owned where mode = p_mode and player_id = p_player),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.cb_lagos_service(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.cb_lagos_service(text, text, text, text, text) to service_role;

-- Each Lagos Life player's game save (kits, career, records, earned caps),
-- so progress follows the player to any phone, not the phone.
create table if not exists public.cb_lagos_saves (
  mode text not null check (mode in ('test', 'live')),
  player_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (mode, player_id)
);
alter table public.cb_lagos_saves enable row level security;
revoke all on public.cb_lagos_saves from anon, authenticated;

create or replace function public.cb_lagos_save_service(p_action text, p_mode text, p_player text, p_data jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved jsonb;
begin
  if p_mode not in ('test', 'live') or coalesce(p_player, '') = '' then
    raise exception 'bad-request';
  end if;
  if p_action = 'put' then
    if p_data is null or octet_length(p_data::text) > 400000 then
      raise exception 'bad-request';
    end if;
    insert into cb_lagos_saves (mode, player_id, data, updated_at)
    values (p_mode, p_player, p_data, now())
    on conflict (mode, player_id) do update set data = excluded.data, updated_at = now();
    return jsonb_build_object('ok', true);
  elsif p_action = 'get' then
    select data into saved from cb_lagos_saves where mode = p_mode and player_id = p_player;
    return jsonb_build_object('ok', true, 'data', saved);
  end if;
  raise exception 'bad-request';
end;
$$;

revoke all on function public.cb_lagos_save_service(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.cb_lagos_save_service(text, text, text, jsonb) to service_role;

-- Staked (betting) friend matches: what each player's phone says happened.
-- One report per player per match, never changed. The server pays out only
-- when the reports agree, or when a player reports their own loss.
create table if not exists public.cb_lagos_reports (
  mode text not null check (mode in ('test', 'live')),
  match_id text not null,
  player_id text not null,
  winner text not null,
  created_at timestamptz not null default now(),
  primary key (mode, match_id, player_id)
);
alter table public.cb_lagos_reports enable row level security;
revoke all on public.cb_lagos_reports from anon, authenticated;

create or replace function public.cb_lagos_report_service(p_mode text, p_match text, p_player text, p_winner text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_mode not in ('test', 'live') or coalesce(p_match, '') = '' or coalesce(p_player, '') = '' or coalesce(p_winner, '') = '' then
    raise exception 'bad-request';
  end if;
  insert into cb_lagos_reports (mode, match_id, player_id, winner)
  values (p_mode, p_match, p_player, p_winner)
  on conflict (mode, match_id, player_id) do nothing;
  return coalesce(
    (select jsonb_agg(jsonb_build_object('player', player_id, 'winner', winner) order by created_at)
       from cb_lagos_reports where mode = p_mode and match_id = p_match),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.cb_lagos_report_service(text, text, text, text) from public, anon, authenticated;
grant execute on function public.cb_lagos_report_service(text, text, text, text) to service_role;
