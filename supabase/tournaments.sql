-- ─────────────────────────────────────────────────────────────
-- CAPBALL online tournaments
--
-- Paste into Supabase → SQL Editor → Run. Safe to run again.
--
-- Security model (no sign-up needed):
--  * The tables are locked: Row Level Security is on with no policies,
--    so the public anon key cannot read or write them directly.
--  * Everything goes through the cb_* functions below, which check a
--    per-device secret ("device token"). Only its SHA-256 hash is stored.
--  * The device that creates a tournament is its host. A device that
--    claims a team's seat may report that team's results. Only the two
--    teams in a fixture (or the host) can report it, and only once.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.cb_tournaments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  setup jsonb not null,
  host_token_hash text not null,
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cb_seats (
  tournament_id uuid not null references public.cb_tournaments(id) on delete cascade,
  team_id text not null,
  token_hash text,
  claimed_at timestamptz,
  primary key (tournament_id, team_id)
);

create table if not exists public.cb_results (
  tournament_id uuid not null references public.cb_tournaments(id) on delete cascade,
  fixture_id text not null,
  home_team text not null,
  away_team text not null,
  home int not null check (home between 0 and 99),
  away int not null check (away between 0 and 99),
  pens_home int check (pens_home between 0 and 99),
  pens_away int check (pens_away between 0 and 99),
  reported_by text not null,
  reported_at timestamptz not null default now(),
  primary key (tournament_id, fixture_id)
);

-- Where two players meet for a live online match (the existing peer-to-peer room code)
create table if not exists public.cb_rooms (
  tournament_id uuid not null references public.cb_tournaments(id) on delete cascade,
  fixture_id text not null,
  room_code text not null,
  host_team text not null,
  created_at timestamptz not null default now(),
  primary key (tournament_id, fixture_id)
);

alter table public.cb_tournaments enable row level security;
alter table public.cb_seats enable row level security;
alter table public.cb_results enable row level security;
alter table public.cb_rooms enable row level security;
revoke all on public.cb_tournaments, public.cb_seats, public.cb_results, public.cb_rooms from anon, authenticated;

-- ── helpers ──────────────────────────────────────────────────

create or replace function public.cb_hash(p_token text)
returns text language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

create or replace function public.cb_check_token(p_token text)
returns void language plpgsql immutable set search_path = public as $$
begin
  if p_token is null or length(p_token) < 20 or length(p_token) > 100 then
    raise exception 'bad-token' using errcode = 'P0001';
  end if;
end $$;

create or replace function public.cb_find(p_code text)
returns public.cb_tournaments language plpgsql stable set search_path = public as $$
declare t public.cb_tournaments;
begin
  select * into t from public.cb_tournaments where code = upper(trim(p_code));
  if not found then raise exception 'not-found' using errcode = 'P0001'; end if;
  return t;
end $$;

-- Team ids that appear in a setup
create or replace function public.cb_team_ids(p_setup jsonb)
returns setof text language sql immutable set search_path = public as $$
  select x->>'id' from jsonb_array_elements(p_setup->'teams') x
$$;

-- ── public API ───────────────────────────────────────────────

-- Full state for the hub: setup, results, seats (claimed or not, and whether
-- this device holds them), live rooms, and whether this device is host.
create or replace function public.cb_get_tournament(p_code text, p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t public.cb_tournaments; me text;
begin
  t := public.cb_find(p_code);
  me := case when p_token is null then null else public.cb_hash(p_token) end;
  return jsonb_build_object(
    'code', t.code,
    'setup', t.setup,
    'closed', t.closed,
    'updatedAt', t.updated_at,
    'isHost', me is not null and me = t.host_token_hash,
    'seats', coalesce((select jsonb_agg(jsonb_build_object(
        'teamId', s.team_id, 'claimed', s.token_hash is not null, 'mine', coalesce(me is not null and s.token_hash = me, false))
        order by s.team_id) from public.cb_seats s where s.tournament_id = t.id), '[]'::jsonb),
    'results', coalesce((select jsonb_agg(jsonb_build_object(
        'fixtureId', r.fixture_id, 'homeTeam', r.home_team, 'awayTeam', r.away_team,
        'home', r.home, 'away', r.away, 'pensHome', r.pens_home, 'pensAway', r.pens_away,
        'reportedAt', r.reported_at) order by r.reported_at) from public.cb_results r where r.tournament_id = t.id), '[]'::jsonb),
    'rooms', coalesce((select jsonb_agg(jsonb_build_object(
        'fixtureId', m.fixture_id, 'roomCode', m.room_code, 'hostTeam', m.host_team, 'createdAt', m.created_at))
        from public.cb_rooms m where m.tournament_id = t.id), '[]'::jsonb)
  );
end $$;

-- Create a tournament. p_setup is the game's tournament JSON; every human
-- (non-CPU) team gets an open seat. Returns the join code.
create or replace function public.cb_create_tournament(p_setup jsonb, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code text; v_id uuid; n int; tries int := 0;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  perform public.cb_check_token(p_token);
  if p_setup is null or jsonb_typeof(p_setup) <> 'object' or octet_length(p_setup::text) > 32768 then
    raise exception 'bad-setup' using errcode = 'P0001';
  end if;
  if (p_setup->>'format') not in ('knockout', 'league') then raise exception 'bad-setup' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_setup->'teams') <> 'array' then raise exception 'bad-setup' using errcode = 'P0001'; end if;
  n := jsonb_array_length(p_setup->'teams');
  if n < 3 or n > 8 then raise exception 'bad-setup' using errcode = 'P0001'; end if;
  if (select count(distinct id) from public.cb_team_ids(p_setup) id where id ~ '^[A-Za-z0-9_-]{1,24}$') <> n then
    raise exception 'bad-setup' using errcode = 'P0001';
  end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.cb_tournaments (code, setup, host_token_hash)
      values (v_code, p_setup, public.cb_hash(p_token)) returning id into v_id;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 10 then raise; end if;
    end;
  end loop;

  insert into public.cb_seats (tournament_id, team_id)
  select v_id, x->>'id' from jsonb_array_elements(p_setup->'teams') x
  where coalesce((x->>'cpu')::boolean, false) = false;

  return jsonb_build_object('code', v_code);
end $$;

-- Take a team's seat with this device. Re-claiming your own seat is fine.
create or replace function public.cb_claim_seat(p_code text, p_team_id text, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.cb_tournaments; s public.cb_seats; me text;
begin
  perform public.cb_check_token(p_token);
  t := public.cb_find(p_code);
  if t.closed then raise exception 'closed' using errcode = 'P0001'; end if;
  me := public.cb_hash(p_token);
  select * into s from public.cb_seats where tournament_id = t.id and team_id = p_team_id for update;
  if not found then raise exception 'no-seat' using errcode = 'P0001'; end if;
  if s.token_hash is not null and s.token_hash <> me then raise exception 'taken' using errcode = 'P0001'; end if;
  update public.cb_seats set token_hash = me, claimed_at = now() where tournament_id = t.id and team_id = p_team_id;
  update public.cb_tournaments set updated_at = now() where id = t.id;
  return jsonb_build_object('ok', true);
end $$;

-- Give a seat back (its holder), or free anyone's seat (the host).
create or replace function public.cb_release_seat(p_code text, p_team_id text, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.cb_tournaments; me text;
begin
  perform public.cb_check_token(p_token);
  t := public.cb_find(p_code);
  me := public.cb_hash(p_token);
  update public.cb_seats set token_hash = null, claimed_at = null
  where tournament_id = t.id and team_id = p_team_id and (token_hash = me or t.host_token_hash = me);
  if not found then raise exception 'not-allowed' using errcode = 'P0001'; end if;
  update public.cb_tournaments set updated_at = now() where id = t.id;
  return jsonb_build_object('ok', true);
end $$;

-- Report a fixture's result. The device must hold the seat of one of the
-- two teams, or be the host. League fixtures are checked against the
-- fixture list; cup ties are checked to be between real teams.
create or replace function public.cb_report_result(
  p_code text, p_token text, p_fixture_id text, p_home_team text, p_away_team text,
  p_home int, p_away int, p_pens_home int default null, p_pens_away int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.cb_tournaments; me text; v_by text; fx jsonb;
begin
  perform public.cb_check_token(p_token);
  t := public.cb_find(p_code);
  if t.closed then raise exception 'closed' using errcode = 'P0001'; end if;
  me := public.cb_hash(p_token);
  if p_fixture_id is null or length(p_fixture_id) > 12 then raise exception 'bad-fixture' using errcode = 'P0001'; end if;
  if p_home_team = p_away_team
     or p_home_team not in (select public.cb_team_ids(t.setup))
     or p_away_team not in (select public.cb_team_ids(t.setup)) then
    raise exception 'bad-fixture' using errcode = 'P0001';
  end if;
  if t.setup->>'format' = 'league' then
    select x into fx from jsonb_array_elements(t.setup->'fixtures') x where x->>'id' = p_fixture_id;
    if fx is null or fx->>'home' <> p_home_team or fx->>'away' <> p_away_team then
      raise exception 'bad-fixture' using errcode = 'P0001';
    end if;
  else
    -- A cup tie must have a winner
    if p_home = p_away and (p_pens_home is null or p_pens_away is null or p_pens_home = p_pens_away) then
      raise exception 'needs-winner' using errcode = 'P0001';
    end if;
  end if;
  if (p_pens_home is null) <> (p_pens_away is null) or (p_pens_home is not null and p_home <> p_away) then
    raise exception 'bad-score' using errcode = 'P0001';
  end if;

  select team_id into v_by from public.cb_seats
  where tournament_id = t.id and token_hash = me and team_id in (p_home_team, p_away_team) limit 1;
  if v_by is null then
    if t.host_token_hash = me then v_by := 'host';
    else raise exception 'not-your-fixture' using errcode = 'P0001'; end if;
  end if;

  begin
    insert into public.cb_results (tournament_id, fixture_id, home_team, away_team, home, away, pens_home, pens_away, reported_by)
    values (t.id, p_fixture_id, p_home_team, p_away_team, p_home, p_away, p_pens_home, p_pens_away, v_by);
  exception when unique_violation then
    raise exception 'already-reported' using errcode = 'P0001';
  end;
  delete from public.cb_rooms where tournament_id = t.id and fixture_id = p_fixture_id;
  update public.cb_tournaments set updated_at = now() where id = t.id;
  return jsonb_build_object('ok', true);
end $$;

-- Host only: wipe a wrongly reported result so the fixture can be replayed.
create or replace function public.cb_delete_result(p_code text, p_token text, p_fixture_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.cb_tournaments;
begin
  perform public.cb_check_token(p_token);
  t := public.cb_find(p_code);
  if t.host_token_hash <> public.cb_hash(p_token) then raise exception 'host-only' using errcode = 'P0001'; end if;
  delete from public.cb_results where tournament_id = t.id and fixture_id = p_fixture_id;
  update public.cb_tournaments set updated_at = now() where id = t.id;
  return jsonb_build_object('ok', true);
end $$;

-- Post (or clear, with p_room_code null) the live room for a fixture,
-- so the opponent can join it from the hub.
create or replace function public.cb_set_room(p_code text, p_token text, p_fixture_id text, p_team_id text, p_room_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.cb_tournaments;
begin
  perform public.cb_check_token(p_token);
  t := public.cb_find(p_code);
  if not exists (select 1 from public.cb_seats where tournament_id = t.id and team_id = p_team_id and token_hash = public.cb_hash(p_token)) then
    raise exception 'not-your-team' using errcode = 'P0001';
  end if;
  if p_room_code is null then
    delete from public.cb_rooms where tournament_id = t.id and fixture_id = p_fixture_id and host_team = p_team_id;
  else
    if length(p_room_code) > 16 or p_fixture_id is null or length(p_fixture_id) > 12 then
      raise exception 'bad-room' using errcode = 'P0001';
    end if;
    insert into public.cb_rooms (tournament_id, fixture_id, room_code, host_team)
    values (t.id, p_fixture_id, p_room_code, p_team_id)
    on conflict (tournament_id, fixture_id) do update set room_code = excluded.room_code, host_team = excluded.host_team, created_at = now();
  end if;
  update public.cb_tournaments set updated_at = now() where id = t.id;
  return jsonb_build_object('ok', true);
end $$;

-- Host only: end the tournament (no more seats or results).
create or replace function public.cb_close_tournament(p_code text, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.cb_tournaments;
begin
  perform public.cb_check_token(p_token);
  t := public.cb_find(p_code);
  if t.host_token_hash <> public.cb_hash(p_token) then raise exception 'host-only' using errcode = 'P0001'; end if;
  update public.cb_tournaments set closed = true, updated_at = now() where id = t.id;
  return jsonb_build_object('ok', true);
end $$;

-- Only the API functions are callable from the app; the helpers stay private.
revoke execute on function public.cb_hash(text), public.cb_check_token(text), public.cb_find(text), public.cb_team_ids(jsonb) from public, anon, authenticated;
grant execute on function
  public.cb_get_tournament(text, text),
  public.cb_create_tournament(jsonb, text),
  public.cb_claim_seat(text, text, text),
  public.cb_release_seat(text, text, text),
  public.cb_report_result(text, text, text, text, text, int, int, int, int),
  public.cb_delete_result(text, text, text),
  public.cb_set_room(text, text, text, text, text),
  public.cb_close_tournament(text, text)
to anon, authenticated;
