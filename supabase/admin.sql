-- ─────────────────────────────────────────────────────────────
-- CAPBALL admin console (needs accounts.sql, tournaments.sql, leaderboard.sql;
-- anytime.sql and lagos.sql are used when they're there)
--
-- Paste into Supabase → SQL Editor → Run. Safe to run again.
--
-- The console has its own logins (email + password), separate from game
-- accounts. The first time it's opened, it asks whoever is there to create
-- the first admin login; after that, setup is closed and only admins can
-- sign in (and add other admins from inside). Passwords are bcrypt hashes;
-- sessions are hashed random tokens that last 7 days. Every change made from
-- the console is written to cb_admin_log. Tables stay locked.
--
-- Forgot the password? Run, here:  delete from public.cb_admin_users;
-- and open the console again to create a new login.
-- ─────────────────────────────────────────────────────────────

-- An earlier version tied admins to game accounts; it's replaced
drop function if exists public.cb_admin(text, text, jsonb);
drop table if exists public.cb_admins;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cb_admin_log' and column_name = 'admin_name') then
    drop table public.cb_admin_log;
  end if;
end $$;

create table if not exists public.cb_admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,             -- stored lower-case
  pass_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cb_admin_sessions (
  token_hash text primary key,
  admin_id uuid not null references public.cb_admin_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table if not exists public.cb_admin_failures (
  email text not null,
  at timestamptz not null default now()
);
create index if not exists cb_admin_failures_by_email on public.cb_admin_failures (email, at);

create table if not exists public.cb_admin_log (
  id bigint generated always as identity primary key,
  admin_email text not null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists cb_admin_log_by_time on public.cb_admin_log (at desc);

alter table public.cb_admin_users enable row level security;
alter table public.cb_admin_sessions enable row level security;
alter table public.cb_admin_failures enable row level security;
alter table public.cb_admin_log enable row level security;
revoke all on public.cb_admin_users, public.cb_admin_sessions, public.cb_admin_failures, public.cb_admin_log from anon, authenticated;

-- ── helpers ──────────────────────────────────────────────────

create or replace function public.cb_admin_has(p_table text)
returns boolean language sql stable set search_path = public as $$
  select to_regclass('public.' || p_table) is not null
$$;

create or replace function public.cb_admin_pw_hash(p text)
returns text language sql volatile set search_path = public, extensions as $$
  select extensions.crypt(p, extensions.gen_salt('bf', 10))
$$;

create or replace function public.cb_admin_pw_ok(p text, h text)
returns boolean language sql stable set search_path = public, extensions as $$
  select h = extensions.crypt(coalesce(p, ''), h)
$$;

create or replace function public.cb_admin_new_token()
returns text language sql volatile set search_path = public, extensions as $$
  select encode(extensions.gen_random_bytes(32), 'hex')
$$;

create or replace function public.cb_admin_check_email(p text)
returns text language plpgsql immutable set search_path = public as $$
declare v text := lower(trim(coalesce(p, '')));
begin
  if v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v) > 120 then raise exception 'bad-email' using errcode = 'P0001'; end if;
  return v;
end $$;

create or replace function public.cb_admin_check_password(p text)
returns void language plpgsql immutable set search_path = public as $$
begin
  if p is null or length(p) < 10 or length(p) > 72 then raise exception 'weak-password' using errcode = 'P0001'; end if;
end $$;

create or replace function public.cb_admin_session(p_admin uuid)
returns text language plpgsql volatile set search_path = public as $$
declare v text := public.cb_admin_new_token();
begin
  insert into public.cb_admin_sessions (token_hash, admin_id) values (public.cb_account_hash(v), p_admin);
  delete from public.cb_admin_sessions where last_seen < now() - interval '7 days';
  return v;
end $$;

-- ── sign in ──────────────────────────────────────────────────

-- Does the console still need its first admin?
create or replace function public.cb_admin_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('setup', not exists (select 1 from public.cb_admin_users))
$$;

-- Create the first admin login. Only works while there is none.
create or replace function public.cb_admin_setup(p_email text, p_password text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_email text; v_id uuid;
begin
  lock table public.cb_admin_users in exclusive mode;
  if exists (select 1 from public.cb_admin_users) then raise exception 'setup-done' using errcode = 'P0001'; end if;
  v_email := public.cb_admin_check_email(p_email);
  perform public.cb_admin_check_password(p_password);
  insert into public.cb_admin_users (email, pass_hash) values (v_email, public.cb_admin_pw_hash(p_password)) returning id into v_id;
  insert into public.cb_admin_log (admin_email, action) values (v_email, 'setup');
  return jsonb_build_object('token', public.cb_admin_session(v_id), 'email', v_email);
end $$;

create or replace function public.cb_admin_login(p_email text, p_password text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); a public.cb_admin_users;
begin
  if (select count(*) from public.cb_admin_failures where email = v_email and at > now() - interval '15 minutes') >= 5 then
    raise exception 'too-many-tries' using errcode = 'P0001';
  end if;
  select * into a from public.cb_admin_users where email = v_email;
  if a.id is null or not public.cb_admin_pw_ok(p_password, a.pass_hash) then
    insert into public.cb_admin_failures (email) values (v_email);
    delete from public.cb_admin_failures where at < now() - interval '1 day';
    return jsonb_build_object('error', 'wrong-login');
  end if;
  delete from public.cb_admin_failures where email = v_email;
  return jsonb_build_object('token', public.cb_admin_session(a.id), 'email', a.email);
end $$;

create or replace function public.cb_admin_logout(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  delete from public.cb_admin_sessions where token_hash = public.cb_account_hash(coalesce(p_token, ''));
  return jsonb_build_object('ok', true);
end $$;

-- ── everything else: cb_admin(token, action, data) ───────────

create or replace function public.cb_admin(p_token text, p_action text, p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  me public.cb_admin_users;
  d jsonb := coalesce(p_data, '{}'::jsonb);
  v_hash text;
  v_id uuid;
  v_name text;
  v_q text;
  v_off int := least(greatest(coalesce((p_data->>'offset')::int, 0), 0), 100000);
  v_lim int := least(greatest(coalesce((p_data->>'limit')::int, 50), 1), 100);
  v_week text := to_char(now(), 'IYYY') || '-W' || to_char(now(), 'IW');
  out jsonb;
  extra jsonb := '{}'::jsonb;
  n int;
begin
  if p_token is null or length(p_token) < 20 or length(p_token) > 200 then raise exception 'signed-out' using errcode = 'P0001'; end if;
  v_hash := public.cb_account_hash(p_token);
  select u.* into me from public.cb_admin_sessions s join public.cb_admin_users u on u.id = s.admin_id
   where s.token_hash = v_hash and s.last_seen > now() - interval '7 days';
  if me.id is null then raise exception 'signed-out' using errcode = 'P0001'; end if;
  update public.cb_admin_sessions set last_seen = now() where token_hash = v_hash;

  -- Changes are logged (reads aren't); passwords never are
  if p_action in ('reset-password', 'sign-out', 'delete-player', 'close-tournament', 'delete-tournament', 'board-remove', 'add-admin', 'remove-admin', 'change-password') then
    insert into public.cb_admin_log (admin_email, action, detail) values (me.email, p_action, d - 'password' - 'current');
  end if;

  case p_action

  when 'me' then
    return jsonb_build_object('email', me.email);

  when 'overview' then
    out := jsonb_build_object(
      'players', (select count(*) from public.cb_accounts),
      'new24h', (select count(*) from public.cb_accounts where created_at > now() - interval '1 day'),
      'new7d', (select count(*) from public.cb_accounts where created_at > now() - interval '7 days'),
      'active24h', (select count(distinct account_id) from public.cb_account_sessions where last_seen > now() - interval '1 day'),
      'active7d', (select count(distinct account_id) from public.cb_account_sessions where last_seen > now() - interval '7 days'),
      'saves', (select count(*) from public.cb_accounts where saved_at is not null),
      'saved24h', (select count(*) from public.cb_accounts where saved_at > now() - interval '1 day'),
      'tournaments', (select count(*) from public.cb_tournaments),
      'openTournaments', (select count(*) from public.cb_tournaments where not closed),
      'results7d', (select count(*) from public.cb_results where reported_at > now() - interval '7 days'),
      'week', v_week,
      'boardWeek', (select count(*) from public.cb_board where period = v_week and played > 0),
      'signups', (
        select coalesce(jsonb_agg(jsonb_build_object('day', g.day::date, 'n', coalesce(c.n, 0)) order by g.day), '[]'::jsonb)
          from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') g(day)
          left join (select date_trunc('day', created_at) as day, count(*) as n from public.cb_accounts
                      where created_at > now() - interval '14 days' group by 1) c on c.day = g.day
      )
    );
    if public.cb_admin_has('cb_anytime_matches') then
      execute $q$ select jsonb_build_object(
        'anytime', count(*),
        'anytimeActive', count(*) filter (where status = 'active'),
        'anytimeWaiting', count(*) filter (where status = 'waiting')) from public.cb_anytime_matches $q$ into extra;
      out := out || extra;
    end if;
    if public.cb_admin_has('cb_lagos_owned') then
      execute $q$ select jsonb_build_object(
        'lagosPurchases', count(*) filter (where mode = 'live'),
        'lagosTestPurchases', count(*) filter (where mode = 'test'),
        'lagosBuyers', count(distinct player_id) filter (where mode = 'live')) from public.cb_lagos_owned $q$ into extra;
      out := out || extra;
    end if;
    return out;

  when 'players' then
    v_q := lower(trim(coalesce(d->>'q', '')));
    select coalesce(jsonb_agg(r), '[]'::jsonb) into out from (
      select a.id, a.display_name as name, a.created_at as "createdAt", a.saved_at as "savedAt",
             octet_length(a.save_data::text) as "saveBytes",
             (select max(s.last_seen) from public.cb_account_sessions s where s.account_id = a.id) as "lastSeen",
             (select count(*) from public.cb_account_sessions s where s.account_id = a.id) as sessions
        from public.cb_accounts a
       where v_q = '' or a.username like '%' || replace(replace(v_q, '%', ''), '_', '\_') || '%'
       order by case when d->>'sort' = 'new' then a.created_at end desc nulls last,
                (select max(s.last_seen) from public.cb_account_sessions s where s.account_id = a.id) desc nulls last,
                a.created_at desc
       offset v_off limit v_lim
    ) r;
    select count(*) into n from public.cb_accounts a
     where v_q = '' or a.username like '%' || replace(replace(v_q, '%', ''), '_', '\_') || '%';
    return jsonb_build_object('rows', out, 'total', n);

  when 'player' then
    v_id := (d->>'id')::uuid;
    select jsonb_build_object(
      'id', a.id, 'name', a.display_name, 'createdAt', a.created_at, 'savedAt', a.saved_at,
      'save', a.save_data,
      'sessions', (select coalesce(jsonb_agg(jsonb_build_object('createdAt', s.created_at, 'lastSeen', s.last_seen) order by s.last_seen desc), '[]'::jsonb)
                     from public.cb_account_sessions s where s.account_id = a.id),
      'board', (select coalesce(jsonb_agg(jsonb_build_object('period', b.period, 'played', b.played, 'won', b.won, 'goals', b.goals) order by b.period desc), '[]'::jsonb)
                  from public.cb_board b where b.account_id = a.id)
    ) into out from public.cb_accounts a where a.id = v_id;
    if out is null then raise exception 'not-found' using errcode = 'P0001'; end if;
    return out;

  when 'reset-password' then
    -- A player's game password
    v_id := (d->>'id')::uuid;
    if coalesce(length(d->>'password'), 0) < 6 or length(d->>'password') > 72 then
      raise exception 'bad-password' using errcode = 'P0001';
    end if;
    update public.cb_accounts set pass_hash = public.cb_admin_pw_hash(d->>'password') where id = v_id;
    if not found then raise exception 'not-found' using errcode = 'P0001'; end if;
    delete from public.cb_account_sessions where account_id = v_id;
    return jsonb_build_object('ok', true);

  when 'sign-out' then
    v_id := (d->>'id')::uuid;
    delete from public.cb_account_sessions where account_id = v_id;
    get diagnostics n = row_count;
    return jsonb_build_object('ok', true, 'sessions', n);

  when 'delete-player' then
    v_id := (d->>'id')::uuid;
    begin
      delete from public.cb_accounts where id = v_id;
    exception when foreign_key_violation then
      raise exception 'player-in-matches' using errcode = 'P0001';
    end;
    if not found then raise exception 'not-found' using errcode = 'P0001'; end if;
    return jsonb_build_object('ok', true);

  when 'tournaments' then
    select coalesce(jsonb_agg(r), '[]'::jsonb) into out from (
      select t.id, t.code, coalesce(t.setup->>'name', '') as name, coalesce(t.setup->>'format', t.setup->>'kind', '') as format,
             t.closed, t.created_at as "createdAt", t.updated_at as "updatedAt",
             (select count(*) from public.cb_seats s where s.tournament_id = t.id) as teams,
             (select count(*) from public.cb_seats s where s.tournament_id = t.id and s.token_hash is not null) as claimed,
             (select count(*) from public.cb_results r where r.tournament_id = t.id) as results
        from public.cb_tournaments t
       where coalesce(d->>'q', '') = '' or t.code ilike '%' || (d->>'q') || '%' or t.setup->>'name' ilike '%' || (d->>'q') || '%'
       order by t.updated_at desc
       offset v_off limit v_lim
    ) r;
    select count(*) into n from public.cb_tournaments;
    return jsonb_build_object('rows', out, 'total', n);

  when 'close-tournament' then
    update public.cb_tournaments set closed = true, updated_at = now() where id = (d->>'id')::uuid;
    if not found then raise exception 'not-found' using errcode = 'P0001'; end if;
    return jsonb_build_object('ok', true);

  when 'delete-tournament' then
    begin
      delete from public.cb_tournaments where id = (d->>'id')::uuid;
    exception when foreign_key_violation then
      raise exception 'tournament-in-use' using errcode = 'P0001';
    end;
    if not found then raise exception 'not-found' using errcode = 'P0001'; end if;
    return jsonb_build_object('ok', true);

  when 'board' then
    v_name := coalesce(nullif(d->>'period', ''), v_week);
    select coalesce(jsonb_agg(r), '[]'::jsonb) into out from (
      select row_number() over (order by b.won desc, b.goals desc, b.updated_at asc) as rank,
             b.account_id as id, acc.display_name as name, b.played, b.won, b.goals, b.updated_at as "updatedAt"
        from public.cb_board b join public.cb_accounts acc on acc.id = b.account_id
       where b.period = v_name
       order by b.won desc, b.goals desc, b.updated_at asc
       limit 100
    ) r;
    return jsonb_build_object('period', v_name, 'week', v_week, 'rows', out);

  when 'board-remove' then
    delete from public.cb_board where account_id = (d->>'id')::uuid and period = d->>'period';
    return jsonb_build_object('ok', true);

  when 'matches' then
    if not public.cb_admin_has('cb_anytime_matches') then return jsonb_build_object('rows', '[]'::jsonb, 'missing', true); end if;
    execute $q$ select coalesce(jsonb_agg(r), '[]'::jsonb) from (
      select m.code, m.status, m.version as turns, m.home_team as home, m.away_team as away,
             m.state->'score' as score, m.created_at as "createdAt", m.updated_at as "updatedAt",
             (select jsonb_agg(acc.display_name order by p.team) from public.cb_anytime_players p join public.cb_accounts acc on acc.id = p.account_id where p.match_id = m.id) as players
        from public.cb_anytime_matches m order by m.updated_at desc limit 60) r $q$ into out;
    return jsonb_build_object('rows', out);

  when 'admins' then
    select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email, 'addedAt', u.created_at,
             'lastSeen', (select max(s.last_seen) from public.cb_admin_sessions s where s.admin_id = u.id)) order by u.created_at), '[]'::jsonb)
      into out from public.cb_admin_users u;
    return jsonb_build_object('rows', out,
      'log', (select coalesce(jsonb_agg(l), '[]'::jsonb) from (
        select admin_email as admin, action, detail, at from public.cb_admin_log order by at desc limit 40) l));

  when 'add-admin' then
    v_name := public.cb_admin_check_email(d->>'email');
    perform public.cb_admin_check_password(d->>'password');
    if exists (select 1 from public.cb_admin_users where email = v_name) then raise exception 'email-taken' using errcode = 'P0001'; end if;
    insert into public.cb_admin_users (email, pass_hash) values (v_name, public.cb_admin_pw_hash(d->>'password'));
    return jsonb_build_object('ok', true);

  when 'remove-admin' then
    v_id := (d->>'id')::uuid;
    if v_id = me.id then raise exception 'not-yourself' using errcode = 'P0001'; end if;
    delete from public.cb_admin_users where id = v_id;
    return jsonb_build_object('ok', true);

  when 'change-password' then
    if not public.cb_admin_pw_ok(d->>'current', me.pass_hash) then raise exception 'wrong-current' using errcode = 'P0001'; end if;
    perform public.cb_admin_check_password(d->>'password');
    update public.cb_admin_users set pass_hash = public.cb_admin_pw_hash(d->>'password') where id = me.id;
    -- Sign out everywhere else
    delete from public.cb_admin_sessions where admin_id = me.id and token_hash <> v_hash;
    return jsonb_build_object('ok', true);

  else
    raise exception 'bad-action' using errcode = 'P0001';
  end case;
end $$;

revoke execute on function
  public.cb_admin_has(text), public.cb_admin_pw_hash(text), public.cb_admin_pw_ok(text, text),
  public.cb_admin_new_token(), public.cb_admin_check_email(text), public.cb_admin_check_password(text),
  public.cb_admin_session(uuid)
from public, anon, authenticated;
revoke execute on function
  public.cb_admin_status(), public.cb_admin_setup(text, text), public.cb_admin_login(text, text),
  public.cb_admin_logout(text), public.cb_admin(text, text, jsonb)
from public;
grant execute on function
  public.cb_admin_status(), public.cb_admin_setup(text, text), public.cb_admin_login(text, text),
  public.cb_admin_logout(text), public.cb_admin(text, text, jsonb)
to anon, authenticated;
