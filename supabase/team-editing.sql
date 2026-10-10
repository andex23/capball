-- Run in Supabase SQL Editor after tournaments.sql. Safe to run again.
-- Seat holders may change their own team's identity, never fixtures or seats.
create or replace function public.cb_update_team(
  p_code text, p_team_id text, p_token text, p_config jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.cb_tournaments;
  me text;
  patch jsonb;
  entry record;
  role text;
begin
  perform public.cb_check_token(p_token);
  t := public.cb_find(p_code);
  me := public.cb_hash(p_token);
  perform 1 from public.cb_seats where tournament_id = t.id
    and team_id = p_team_id and token_hash = me for update;
  if not found then raise exception 'not-allowed' using errcode = 'P0001'; end if;
  -- Same lock order as seat claims/releases: seat first, tournament second.
  -- Serialize edits so simultaneous saves cannot overwrite each other.
  select * into t from public.cb_tournaments where id = t.id for update;
  if t.closed then raise exception 'closed' using errcode = 'P0001'; end if;
  if exists(select 1 from public.cb_rooms where tournament_id = t.id) then
    raise exception 'match-in-progress' using errcode = 'P0001';
  end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object'
    or octet_length(p_config::text) > 8192 then
    raise exception 'bad-setup' using errcode = 'P0001';
  end if;
  -- Ignore protected fields (id, cpu, difficulty and any tournament metadata).
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into patch
    from jsonb_each(p_config) where key = any(array[
      'name','primary','edge','textColor','skirtColor','badge','pattern','finish',
      'capText','showName','capNames','players','numbers']);
  for entry in select * from jsonb_each(patch) loop
    if entry.key = 'showName' then
      if jsonb_typeof(entry.value) <> 'boolean' then
        raise exception 'bad-setup' using errcode = 'P0001';
      end if;
    elsif entry.key in ('players','numbers') then
      if jsonb_typeof(entry.value) <> 'object' then
        raise exception 'bad-setup' using errcode = 'P0001';
      end if;
      for role in select jsonb_object_keys(entry.value) loop
        if not (role = any(array['gk','def1','def2','mid','atk1','atk2'])) then
          raise exception 'bad-setup' using errcode = 'P0001';
        end if;
        if entry.key = 'numbers' then
          if jsonb_typeof(entry.value->role) <> 'number'
            or (entry.value->>role) !~ '^[0-9]{1,2}$' then
            raise exception 'bad-setup' using errcode = 'P0001';
          end if;
        elsif jsonb_typeof(entry.value->role) <> 'string'
          or length(entry.value->>role) > 32 then
          raise exception 'bad-setup' using errcode = 'P0001';
        end if;
      end loop;
    elsif jsonb_typeof(entry.value) <> 'string'
      or length(entry.value #>> '{}') > 32 then
      raise exception 'bad-setup' using errcode = 'P0001';
    elsif entry.key = 'name' and (length(trim(entry.value #>> '{}')) = 0
      or length(entry.value #>> '{}') > 16) then
      raise exception 'bad-setup' using errcode = 'P0001';
    elsif entry.key in ('primary','edge','textColor','skirtColor') then
      if (entry.value #>> '{}') !~ '^#[0-9a-fA-F]{6}$'
        and not (entry.key in ('textColor','skirtColor') and entry.value = '""'::jsonb) then
        raise exception 'bad-setup' using errcode = 'P0001';
      end if;
    end if;
  end loop;
  update public.cb_tournaments set setup = jsonb_set(setup, '{teams}',
    (select jsonb_agg(case when team->>'id' = p_team_id then team || patch else team end order by ord)
      from jsonb_array_elements(t.setup->'teams') with ordinality as teams(team, ord))),
    updated_at = now() where id = t.id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.cb_update_team(text,text,text,jsonb) from public;
grant execute on function public.cb_update_team(text,text,text,jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
