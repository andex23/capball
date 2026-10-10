-- CAPBALL Play anytime. Run AFTER tournaments.sql and accounts.sql.
-- Only the game server may call these functions. Safe to run again.
create table if not exists public.cb_anytime_matches (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 config jsonb not null, state jsonb not null, version integer not null default 0,
 status text not null default 'waiting' check(status in ('waiting','active','complete')),
 tournament_id uuid references public.cb_tournaments(id), fixture_id text,
 home_team text, away_team text,
 due_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(tournament_id,fixture_id)
);
create table if not exists public.cb_anytime_players (
 match_id uuid not null references public.cb_anytime_matches(id) on delete cascade,
 team text not null check(team in ('team1','team2')),
 account_id uuid not null references public.cb_accounts(id),
 primary key(match_id,team), unique(match_id,account_id)
);
create index if not exists cb_anytime_account on public.cb_anytime_players(account_id);
create table if not exists public.cb_anytime_moves (
 match_id uuid not null references public.cb_anytime_matches(id) on delete cascade,
 request_id uuid not null, account_id uuid not null references public.cb_accounts(id),
 primary key(match_id,request_id)
);
alter table public.cb_anytime_matches enable row level security;
alter table public.cb_anytime_players enable row level security;
alter table public.cb_anytime_moves enable row level security;
revoke all on public.cb_anytime_matches,public.cb_anytime_players,public.cb_anytime_moves from public,anon,authenticated;

-- Called while holding the match row lock. Completion and competition result
-- are one transaction, including deadline forfeits discovered on a later visit.
create or replace function public.cb_anytime_finish(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare m public.cb_anytime_matches; loser text; winner text; h int; a int;
begin
 select * into m from public.cb_anytime_matches where id=p_id for update;
 if m.status='active' and m.due_at is not null and m.due_at<=now() then
  loser:=m.state->>'activeTeam'; winner:=case when loser='team1' then 'team2' else 'team1' end;
  m.state:=m.state || jsonb_build_object('complete',true,'winner',winner,'forfeited',loser,'finishReason','deadline');
  update public.cb_anytime_matches set state=m.state,version=version+1,updated_at=now() where id=p_id;
 end if;
 if coalesce((m.state->>'complete')::boolean,false) then
  update public.cb_anytime_matches set status='complete',due_at=null where id=p_id;
  if m.tournament_id is not null then
   h:=(m.state#>>'{score,team1}')::int; a:=(m.state#>>'{score,team2}')::int;
   if m.state ? 'forfeited' then
    h:=case when m.state->>'winner'='team1' then 3 else 0 end;
    a:=case when m.state->>'winner'='team2' then 3 else 0 end;
   end if;
   insert into public.cb_results(tournament_id,fixture_id,home_team,away_team,home,away,pens_home,pens_away,reported_by)
   values(m.tournament_id,m.fixture_id,m.home_team,m.away_team,h,a,
    case when (m.state->>'shootout')::boolean and not(m.state ? 'forfeited') then (m.state#>>'{penaltyScores,team1}')::int end,
    case when (m.state->>'shootout')::boolean and not(m.state ? 'forfeited') then (m.state#>>'{penaltyScores,team2}')::int end,'anytime-server')
   on conflict(tournament_id,fixture_id) do nothing;
   update public.cb_tournaments set updated_at=now() where id=m.tournament_id;
  end if;
 end if;
end $$;

create or replace function public.cb_anytime_view(p_id uuid,p_account uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('code',m.code,'config',m.config,'state',m.state,'version',m.version,
 'status',m.status,'dueAt',m.due_at,'updatedAt',m.updated_at,
 'tournamentCode',(select code from public.cb_tournaments where id=m.tournament_id),
 'myTeam',p.team) from public.cb_anytime_matches m join public.cb_anytime_players p on p.match_id=m.id
 where m.id=p_id and p.account_id=p_account
$$;

create or replace function public.cb_anytime_service(p_action text,p_token text,p_code text default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public as $$
declare acc public.cb_accounts; m public.cb_anytime_matches; t public.cb_tournaments;
 role text; mine text; opponent text; item record; hours int; result jsonb:='[]';
begin
 acc:=public.cb_account_by_token(p_token);
 if p_action='list' then
  for item in select x.id from public.cb_anytime_matches x join public.cb_anytime_players p on p.match_id=x.id
   where p.account_id=acc.id order by x.updated_at desc limit 100 loop
   perform public.cb_anytime_finish(item.id);
   result:=result || jsonb_build_array(public.cb_anytime_view(item.id,acc.id) #- '{state,lastTurn}');
  end loop;
  return result;
 end if;
 if p_action='fixture-context' then
  t:=public.cb_find(p_code);
  -- Expire overdue fixtures before rebuilding the next league round/bracket.
  for item in select id from public.cb_anytime_matches where tournament_id=t.id and status='active' and due_at<=now() order by id loop
   perform public.cb_anytime_finish(item.id);
  end loop;
  return public.cb_get_tournament(p_code,p_data->>'deviceToken');
 end if;
 if p_action in ('create','fixture') then
  if p_action='fixture' then
   t:=public.cb_find(p_code);
   if t.closed or t.setup->>'playMode' is distinct from 'anytime' then raise exception 'closed'; end if;
   -- Server derives fixture and team from the shared draw; device token proves
   -- the caller holds that seat before it is bound permanently to an account.
   role:=p_data->>'role';
   mine:=case when role='team1' then p_data->>'home' else p_data->>'away' end;
   if not exists(select 1 from public.cb_seats where tournament_id=t.id and team_id=mine and token_hash=public.cb_hash(p_data->>'deviceToken')) then raise exception 'not-your-team'; end if;
   insert into public.cb_anytime_matches(code,config,state,tournament_id,fixture_id,home_team,away_team)
    values(p_data->>'code',p_data->'config',p_data->'state',t.id,p_data->>'fixtureId',p_data->>'home',p_data->>'away')
    on conflict(tournament_id,fixture_id) do nothing;
   select * into m from public.cb_anytime_matches where tournament_id=t.id and fixture_id=p_data->>'fixtureId' for update;
  else
   if (select count(*) from public.cb_anytime_players p join public.cb_anytime_matches x on x.id=p.match_id where p.account_id=acc.id and x.status<>'complete')>=50 then raise exception 'too-many-matches'; end if;
   insert into public.cb_anytime_matches(code,config,state) values(p_data->>'code',p_data->'config',p_data->'state') returning * into m;
   role:='team1';
  end if;
  if exists(select 1 from public.cb_anytime_players where match_id=m.id and team=role and account_id<>acc.id) then raise exception 'taken'; end if;
  if exists(select 1 from public.cb_anytime_players where match_id=m.id and team<>role and account_id=acc.id) then raise exception 'different-account-needed'; end if;
  insert into public.cb_anytime_players values(m.id,role,acc.id) on conflict do nothing;
  if p_action='fixture' and m.status='waiting' then
   update public.cb_anytime_matches set config=jsonb_set(config,array['teams',role],p_data->'config'->'teams'->role) where id=m.id;
  end if;
 elsif p_action='join' then
  select * into m from public.cb_anytime_matches where code=upper(trim(p_code)) for update;
  if m.id is null then raise exception 'not-found'; end if;
  if m.tournament_id is not null then raise exception 'use-tournament'; end if;
  select team into role from public.cb_anytime_players where match_id=m.id and account_id=acc.id;
  if role is null then
   if m.status<>'waiting' then raise exception 'taken'; end if;
   insert into public.cb_anytime_players values(m.id,'team2',acc.id);
   update public.cb_anytime_matches set config=jsonb_set(config,'{teams,team2}',p_data->'team') where id=m.id;
  end if;
 else
  select * into m from public.cb_anytime_matches where code=upper(trim(p_code)) for update;
  if m.id is null then raise exception 'not-found'; end if;
  select team into role from public.cb_anytime_players where match_id=m.id and account_id=acc.id;
  if role is null then raise exception 'not-a-player'; end if;
  perform public.cb_anytime_finish(m.id);
  select * into m from public.cb_anytime_matches where id=m.id;
  if p_action in ('prepare','commit') then
   if exists(select 1 from public.cb_anytime_moves where match_id=m.id and request_id=(p_data->>'requestId')::uuid and account_id=acc.id) then
    return public.cb_anytime_view(m.id,acc.id) || '{"alreadyApplied":true}'::jsonb;
   end if;
   if m.status<>'active' then raise exception 'match-not-active'; end if;
   if m.version<>(p_data->>'version')::int then raise exception 'stale-turn'; end if;
   if m.state->>'activeTeam'<>role then raise exception 'not-your-turn'; end if;
   if p_action='commit' then
    update public.cb_anytime_matches set state=p_data->'state',version=version+1,updated_at=now(),
     due_at=case when (config->>'deadlineHours')::int>0 then now()+make_interval(hours=>(config->>'deadlineHours')::int) end where id=m.id;
    insert into public.cb_anytime_moves values(m.id,(p_data->>'requestId')::uuid,acc.id);
    perform public.cb_anytime_finish(m.id);
   end if;
  elsif p_action='resign' and m.status<>'complete' then
   opponent:=case when role='team1' then 'team2' else 'team1' end;
   update public.cb_anytime_matches set state=state || jsonb_build_object('complete',true,'winner',opponent,'forfeited',role,'finishReason','resigned'),version=version+1,updated_at=now() where id=m.id;
   perform public.cb_anytime_finish(m.id);
  elsif p_action not in ('get','resign') then raise exception 'bad-action';
  end if;
  return public.cb_anytime_view(m.id,acc.id);
 end if;
 -- Both accounts must accept the match before any turn deadline begins.
 if m.status='waiting' and (select count(*) from public.cb_anytime_players where match_id=m.id)=2 then
  hours:=(m.config->>'deadlineHours')::int;
  update public.cb_anytime_matches set status='active',version=version+1,updated_at=now(),due_at=case when hours>0 then now()+make_interval(hours=>hours) end where id=m.id;
 end if;
 perform public.cb_anytime_finish(m.id);
 return public.cb_anytime_view(m.id,acc.id);
end $$;
revoke all on function public.cb_anytime_finish(uuid),public.cb_anytime_view(uuid,uuid),public.cb_anytime_service(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.cb_anytime_service(text,text,text,jsonb) to service_role;
notify pgrst,'reload schema';

-- Existing live result APIs must not allow a browser to invent, replace or
-- delete a server-resolved anytime competition result.
create or replace function public.cb_anytime_result_guard()
returns trigger language plpgsql set search_path=public as $$
declare tid uuid; mode text;
begin
 tid:=case when TG_OP='DELETE' then OLD.tournament_id else NEW.tournament_id end;
 select setup->>'playMode' into mode from public.cb_tournaments where id=tid;
 if mode='anytime' and (TG_OP='DELETE' or TG_OP='UPDATE' or NEW.reported_by<>'anytime-server') then
  raise exception 'server-results-only';
 end if;
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end $$;
drop trigger if exists cb_anytime_results_guard on public.cb_results;
create trigger cb_anytime_results_guard before insert or update or delete on public.cb_results
 for each row execute function public.cb_anytime_result_guard();
revoke all on function public.cb_anytime_result_guard() from public,anon,authenticated;

-- Hub refreshes also settle expired turns, so the next round can open.
create or replace function public.cb_get_tournament(p_code text, p_token text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare t public.cb_tournaments; me text; item record;
begin
  t := public.cb_find(p_code);
  for item in select id from public.cb_anytime_matches where tournament_id=t.id and status='active' and due_at<=now() order by id loop
    perform public.cb_anytime_finish(item.id);
  end loop;
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


notify pgrst,'reload schema';

-- A seat cannot change hands underneath an unfinished saved match.
create or replace function public.cb_anytime_seat_guard()
returns trigger language plpgsql set search_path=public as $$
begin
 if OLD.token_hash is not null and OLD.token_hash is distinct from NEW.token_hash
  and exists(select 1 from public.cb_anytime_matches where tournament_id=OLD.tournament_id
    and status<>'complete' and (home_team=OLD.team_id or away_team=OLD.team_id)) then
  raise exception 'match-in-progress';
 end if;
 return NEW;
end $$;
drop trigger if exists cb_anytime_seats_guard on public.cb_seats;
create trigger cb_anytime_seats_guard before update of token_hash on public.cb_seats
 for each row execute function public.cb_anytime_seat_guard();
revoke all on function public.cb_anytime_seat_guard() from public,anon,authenticated;
notify pgrst,'reload schema';
