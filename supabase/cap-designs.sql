-- ─────────────────────────────────────────────────────────────
-- CAPBALL ready-made cap names and wording (needs admin.sql and arena-ads.sql)
--
-- Paste into Supabase → SQL Editor → Run. Safe to run again.
--
-- The admin console can rename any ready-made cap, change the words printed
-- on it, or hide it from the list. Anyone can read the changes (the game
-- shows them); only a signed-in admin console session can make them.
-- ─────────────────────────────────────────────────────────────

create or replace function public.cb_cap_designs()
returns jsonb language sql stable security definer set search_path = public as $$
  select value from public.cb_settings where key = 'cap_designs'
$$;

-- Clean changes: { key: { name, main, sub, hidden } }
create or replace function public.cb_cap_clean(p jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare out jsonb := '{}'::jsonb; k text; v jsonb; one jsonb; t text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'bad-caps' using errcode = 'P0001'; end if;
  for k, v in select * from jsonb_each(p) loop
    if k !~ '^[a-z0-9]{2,20}$' or jsonb_typeof(v) <> 'object' then raise exception 'bad-caps' using errcode = 'P0001'; end if;
    one := '{}'::jsonb;
    t := trim(regexp_replace(coalesce(v->>'name', ''), '\s+', ' ', 'g'));
    if length(t) > 20 then raise exception 'cap-name-long' using errcode = 'P0001'; end if;
    if t <> '' then one := one || jsonb_build_object('name', t); end if;
    t := trim(regexp_replace(coalesce(v->>'main', ''), '\s+', ' ', 'g'));
    if length(t) > 16 then raise exception 'cap-word-long' using errcode = 'P0001'; end if;
    if t <> '' then one := one || jsonb_build_object('main', t); end if;
    t := trim(regexp_replace(coalesce(v->>'sub', ''), '\s+', ' ', 'g'));
    if length(t) > 22 then raise exception 'cap-word-long' using errcode = 'P0001'; end if;
    if t <> '' then one := one || jsonb_build_object('sub', t); end if;
    if (v->>'hidden')::boolean is true then one := one || jsonb_build_object('hidden', true); end if;
    if one <> '{}'::jsonb then out := out || jsonb_build_object(k, one); end if;
  end loop;
  if (select count(*) from jsonb_object_keys(out)) > 40 then raise exception 'bad-caps' using errcode = 'P0001'; end if;
  return out;
end $$;

create or replace function public.cb_admin_caps(p_token text, p_action text, p_data jsonb default '{}'::jsonb)
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
    return jsonb_build_object('caps', (select value from public.cb_settings where key = 'cap_designs'),
                              'updatedAt', (select updated_at from public.cb_settings where key = 'cap_designs'));
  elsif p_action = 'set' then
    v := public.cb_cap_clean(p_data->'caps');
    insert into public.cb_settings (key, value) values ('cap_designs', v)
      on conflict (key) do update set value = excluded.value, updated_at = now();
    insert into public.cb_admin_log (admin_email, action, detail) values (me.email, 'cap-designs', v);
    return jsonb_build_object('ok', true, 'caps', v);
  end if;
  raise exception 'bad-action' using errcode = 'P0001';
end $$;

revoke execute on function public.cb_cap_clean(jsonb) from public, anon, authenticated;
revoke execute on function public.cb_cap_designs(), public.cb_admin_caps(text, text, jsonb) from public;
grant execute on function public.cb_cap_designs(), public.cb_admin_caps(text, text, jsonb) to anon, authenticated;
