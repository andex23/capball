-- ─────────────────────────────────────────────────────────────
-- CAPBALL Cap Arena ad boards (needs admin.sql first)
--
-- Paste into Supabase → SQL Editor → Run. Safe to run again.
--
-- The text on the Cap Arena LED boards round the table and the ribbon round
-- the balcony. Anyone can read it (the game shows it); only a signed-in
-- admin console session can change it.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.cb_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.cb_settings enable row level security;
revoke all on public.cb_settings from anon, authenticated;

-- What the game reads: the ad boards, or null for the built-in ones
create or replace function public.cb_arena_ads()
returns jsonb language sql stable security definer set search_path = public as $$
  select value from public.cb_settings where key = 'arena_ads'
$$;

-- A clean list of board messages: 1 to 8, each 1 to 24 characters
create or replace function public.cb_ad_list(p jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare out jsonb := '[]'::jsonb; v text;
begin
  if p is null or jsonb_typeof(p) <> 'array' then raise exception 'bad-ads' using errcode = 'P0001'; end if;
  for v in select upper(trim(regexp_replace(x, '\s+', ' ', 'g'))) from jsonb_array_elements_text(p) x loop
    if v <> '' then
      if length(v) > 24 then raise exception 'ad-too-long' using errcode = 'P0001'; end if;
      out := out || to_jsonb(v);
    end if;
  end loop;
  if jsonb_array_length(out) < 1 or jsonb_array_length(out) > 8 then raise exception 'bad-ads' using errcode = 'P0001'; end if;
  return out;
end $$;

-- Admin console: read or change the ad boards
create or replace function public.cb_admin_ads(p_token text, p_action text, p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare me public.cb_admin_users; v_hash text; v jsonb;
begin
  if p_token is null or length(p_token) < 20 or length(p_token) > 200 then raise exception 'signed-out' using errcode = 'P0001'; end if;
  v_hash := public.cb_account_hash(p_token);
  select u.* into me from public.cb_admin_sessions s join public.cb_admin_users u on u.id = s.admin_id
   where s.token_hash = v_hash and s.last_seen > now() - interval '7 days';
  if me.id is null then raise exception 'signed-out' using errcode = 'P0001'; end if;
  update public.cb_admin_sessions set last_seen = now() where token_hash = v_hash;

  if p_action = 'get' then
    return jsonb_build_object('ads', (select value from public.cb_settings where key = 'arena_ads'),
                              'updatedAt', (select updated_at from public.cb_settings where key = 'arena_ads'));
  elsif p_action = 'set' then
    v := jsonb_build_object('boards', public.cb_ad_list(p_data->'boards'), 'ribbon', public.cb_ad_list(p_data->'ribbon'));
    insert into public.cb_settings (key, value) values ('arena_ads', v)
      on conflict (key) do update set value = excluded.value, updated_at = now();
    insert into public.cb_admin_log (admin_email, action, detail) values (me.email, 'arena-ads', v);
    return jsonb_build_object('ok', true, 'ads', v);
  elsif p_action = 'reset' then
    delete from public.cb_settings where key = 'arena_ads';
    insert into public.cb_admin_log (admin_email, action) values (me.email, 'arena-ads-reset');
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'bad-action' using errcode = 'P0001';
end $$;

revoke execute on function public.cb_ad_list(jsonb) from public, anon, authenticated;
revoke execute on function public.cb_arena_ads(), public.cb_admin_ads(text, text, jsonb) from public;
grant execute on function public.cb_arena_ads(), public.cb_admin_ads(text, text, jsonb) to anon, authenticated;
