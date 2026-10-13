-- ─────────────────────────────────────────────────────────────
-- CAPBALL admin page (needs accounts.sql, tournaments.sql, leaderboard.sql;
-- anytime.sql and lagos.sql are used when they're there)
--
-- Paste into Supabase → SQL Editor → Run. Safe to run again.
--
-- The admin page at /admin signs in with a normal game account. Only accounts
-- listed in cb_admins get anything back: every call goes through cb_admin(),
-- which checks the session token belongs to an admin before doing anything,
-- and writes each change to cb_admin_log. Tables stay locked, as before.
--
-- Make yourself the first admin (once, here in the SQL editor, with your own
-- game username):
--
--   insert into public.cb_admins (account_id)
--   select id from public.cb_accounts where username = lower('YOUR_USERNAME')
--   on conflict do nothing;
-- ─────────────────────────────────────────────────────────────

create table if not exists public.cb_admins (
  account_id uuid primary key references public.cb_accounts(id) on delete cascade,
  added_at timestamptz not null default now()
);

create table if not exists public.cb_admin_log (
  id bigint generated always as identity primary key,
  admin_id uuid references public.cb_accounts(id) on delete set null,
  admin_name text not null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists cb_admin_log_by_time on public.cb_admin_log (at desc);

alter table public.cb_admins enable row level security;
alter table public.cb_admin_log enable row level security;
revoke all on public.cb_admins, public.cb_admin_log from anon, authenticated;

-- Does an optional table exist? (anytime.sql and lagos.sql may not have been run)
create or replace function public.cb_admin_has(p_table text)
returns boolean language sql stable set search_path = public as $$
  select to_regclass('public.' || p_table) is not null
$$;

-- One entry point for the admin page: cb_admin(token, action, data)
create or replace function public.cb_admin(p_token text, p_action text, p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  me public.cb_accounts;
  d jsonb := coalesce(p_data, '{}'::jsonb);
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
  me := public.cb_account_by_token(p_token);
  if not exists (select 1 from public.cb_admins where account_id = me.id) then
    raise exception 'not-admin' using errcode = 'P0001';
  end if;

  -- Changes are logged (reads aren't)
  if p_action in ('reset-password', 'sign-out', 'delete-player', 'close-tournament', 'delete-tournament', 'board-remove', 'grant-admin', 'revoke-admin') then
    insert into public.cb_admin_log (admin_id, admin_name, action, detail)
      values (me.id, me.display_name, p_action, d - 'password');
  end if;

  case p_action

  when 'me' then
    return jsonb_build_object('username', me.display_name);

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
             (select count(*) from public.cb_account_sessions s where s.account_id = a.id) as sessions,
             exists (select 1 from public.cb_admins x where x.account_id = a.id) as admin
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
      'admin', exists (select 1 from public.cb_admins x where x.account_id = a.id),
      'sessions', (select coalesce(jsonb_agg(jsonb_build_object('createdAt', s.created_at, 'lastSeen', s.last_seen) order by s.last_seen desc), '[]'::jsonb)
                     from public.cb_account_sessions s where s.account_id = a.id),
      'board', (select coalesce(jsonb_agg(jsonb_build_object('period', b.period, 'played', b.played, 'won', b.won, 'goals', b.goals) order by b.period desc), '[]'::jsonb)
                  from public.cb_board b where b.account_id = a.id)
    ) into out from public.cb_accounts a where a.id = v_id;
    if out is null then raise exception 'not-found' using errcode = 'P0001'; end if;
    return out;

  when 'reset-password' then
    v_id := (d->>'id')::uuid;
    if coalesce(length(d->>'password'), 0) < 6 or length(d->>'password') > 72 then
      raise exception 'bad-password' using errcode = 'P0001';
    end if;
    update public.cb_accounts set pass_hash = extensions.crypt(d->>'password', extensions.gen_salt('bf', 10)) where id = v_id;
    if not found then raise exception 'not-found' using errcode = 'P0001'; end if;
    -- Their other phones have to sign in again with the new password
    delete from public.cb_account_sessions where account_id = v_id;
    return jsonb_build_object('ok', true);

  when 'sign-out' then
    v_id := (d->>'id')::uuid;
    delete from public.cb_account_sessions where account_id = v_id;
    get diagnostics n = row_count;
    return jsonb_build_object('ok', true, 'sessions', n);

  when 'delete-player' then
    v_id := (d->>'id')::uuid;
    if v_id = me.id then raise exception 'not-yourself' using errcode = 'P0001'; end if;
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
    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.display_name, 'addedAt', x.added_at) order by x.added_at), '[]'::jsonb)
      into out from public.cb_admins x join public.cb_accounts a on a.id = x.account_id;
    return jsonb_build_object('rows', out,
      'log', (select coalesce(jsonb_agg(l), '[]'::jsonb) from (
        select admin_name as admin, action, detail, at from public.cb_admin_log order by at desc limit 40) l));

  when 'grant-admin' then
    insert into public.cb_admins (account_id)
      select id from public.cb_accounts where username = lower(trim(coalesce(d->>'username', '')))
      on conflict do nothing;
    get diagnostics n = row_count;
    if n = 0 and not exists (select 1 from public.cb_accounts where username = lower(trim(coalesce(d->>'username', '')))) then
      raise exception 'not-found' using errcode = 'P0001';
    end if;
    return jsonb_build_object('ok', true);

  when 'revoke-admin' then
    v_id := (d->>'id')::uuid;
    if (select count(*) from public.cb_admins) <= 1 then raise exception 'last-admin' using errcode = 'P0001'; end if;
    delete from public.cb_admins where account_id = v_id;
    return jsonb_build_object('ok', true);

  else
    raise exception 'bad-action' using errcode = 'P0001';
  end case;
end $$;

revoke execute on function public.cb_admin_has(text) from public, anon, authenticated;
revoke execute on function public.cb_admin(text, text, jsonb) from public;
grant execute on function public.cb_admin(text, text, jsonb) to anon, authenticated;
