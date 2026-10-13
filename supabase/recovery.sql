-- ─────────────────────────────────────────────────────────────
-- CAPBALL forgotten passwords (needs accounts.sql and admin.sql first)
--
-- Paste into Supabase → SQL Editor → Run. Safe to run again.
--
-- Two ways back in for a player who forgot their password:
--  * A recovery code: made for them when they sign up (or from their account
--    page later). Only a bcrypt hash is stored. Their username plus the code
--    sets a new password; the code is then used up and a new one is issued.
--  * A help request: they leave their username and how to reach them; it
--    shows in the admin console, where an admin checks it's really them and
--    resets the password.
-- ─────────────────────────────────────────────────────────────

alter table public.cb_accounts add column if not exists recovery_hash text;

create table if not exists public.cb_help_requests (
  id bigint generated always as identity primary key,
  username text not null,                 -- as typed, lower-case
  account_id uuid references public.cb_accounts(id) on delete set null,
  contact text not null,
  note text not null default '',
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  done_at timestamptz,
  done_by text
);
create index if not exists cb_help_requests_open on public.cb_help_requests (status, created_at desc);
alter table public.cb_help_requests enable row level security;
revoke all on public.cb_help_requests from anon, authenticated;

-- 12 characters from an alphabet without look-alikes, shown as XXXX-XXXX-XXXX
create or replace function public.cb_recovery_code()
returns text language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(12);
  out text := '';
begin
  for i in 0..11 loop
    out := out || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
    if i in (3, 7) then out := out || '-'; end if;
  end loop;
  return out;
end $$;

create or replace function public.cb_recovery_clean(p text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(upper(coalesce(p, '')), '[^A-Z0-9]', '', 'g')
$$;

-- Signed in: does this account have a recovery code?
create or replace function public.cb_account_recovery_status(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare a public.cb_accounts;
begin
  a := public.cb_account_by_token(p_token);
  return jsonb_build_object('has', a.recovery_hash is not null);
end $$;

-- Signed in: make a new recovery code (the old one stops working). Shown once.
create or replace function public.cb_account_recovery_new(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare a public.cb_accounts; v text;
begin
  a := public.cb_account_by_token(p_token);
  v := public.cb_recovery_code();
  update public.cb_accounts set recovery_hash = public.cb_admin_pw_hash(public.cb_recovery_clean(v)) where id = a.id;
  return jsonb_build_object('code', v);
end $$;

-- Signed out: username + recovery code + new password. Signs in, and hands
-- back a fresh code (the one used is spent).
create or replace function public.cb_account_recover(p_username text, p_code text, p_password text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_name text; v_key text; a public.cb_accounts; v_new text;
begin
  v_name := public.cb_account_check_name(p_username);
  v_key := 'recover:' || v_name;
  if (select count(*) from public.cb_account_failures where username = v_key and at > now() - interval '1 hour') >= 5 then
    raise exception 'too-many-tries' using errcode = 'P0001';
  end if;
  if p_password is null or length(p_password) < 6 or length(p_password) > 72 then raise exception 'bad-password' using errcode = 'P0001'; end if;
  select * into a from public.cb_accounts where username = v_name;
  if a.id is null or a.recovery_hash is null or not public.cb_admin_pw_ok(public.cb_recovery_clean(p_code), a.recovery_hash) then
    insert into public.cb_account_failures (username) values (v_key);
    return jsonb_build_object('error', 'wrong-code');
  end if;
  delete from public.cb_account_failures where username in (v_key, v_name);
  v_new := public.cb_recovery_code();
  update public.cb_accounts
     set pass_hash = public.cb_admin_pw_hash(p_password),
         recovery_hash = public.cb_admin_pw_hash(public.cb_recovery_clean(v_new))
   where id = a.id;
  -- Anyone else signed in with the old password is signed out
  delete from public.cb_account_sessions where account_id = a.id;
  return jsonb_build_object('token', public.cb_account_new_session(a.id), 'username', a.display_name, 'code', v_new);
end $$;

-- Signed out: ask an admin for help. Always answers the same way, so it
-- can't be used to find out which usernames exist.
create or replace function public.cb_help_request(p_username text, p_contact text, p_note text default '')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_name text := lower(trim(coalesce(p_username, ''))); v_contact text := trim(coalesce(p_contact, '')); v_id uuid;
begin
  if v_name !~ '^[a-z0-9_]{3,20}$' then raise exception 'bad-username' using errcode = 'P0001'; end if;
  if length(v_contact) < 3 or length(v_contact) > 120 then raise exception 'bad-contact' using errcode = 'P0001'; end if;
  -- Spam limits: a few open requests per username, and a cap per hour overall
  if (select count(*) from public.cb_help_requests where username = v_name and status = 'open') >= 3
     or (select count(*) from public.cb_help_requests where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'too-many-requests' using errcode = 'P0001';
  end if;
  select id into v_id from public.cb_accounts where username = v_name;
  insert into public.cb_help_requests (username, account_id, contact, note)
    values (v_name, v_id, v_contact, left(trim(coalesce(p_note, '')), 400));
  return jsonb_build_object('ok', true);
end $$;

-- Admin console: list help requests, mark them done, or delete them
create or replace function public.cb_admin_help(p_token text, p_action text, p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare me public.cb_admin_users; v_hash text; d jsonb := coalesce(p_data, '{}'::jsonb);
begin
  if p_token is null or length(p_token) < 20 or length(p_token) > 200 then raise exception 'signed-out' using errcode = 'P0001'; end if;
  v_hash := public.cb_account_hash(p_token);
  select u.* into me from public.cb_admin_sessions s join public.cb_admin_users u on u.id = s.admin_id
   where s.token_hash = v_hash and s.last_seen > now() - interval '7 days';
  if me.id is null then raise exception 'signed-out' using errcode = 'P0001'; end if;
  update public.cb_admin_sessions set last_seen = now() where token_hash = v_hash;

  if p_action = 'list' then
    return jsonb_build_object(
      'open', (select count(*) from public.cb_help_requests where status = 'open'),
      'rows', (select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select h.id, h.username, h.contact, h.note, h.status, h.created_at as "createdAt", h.done_at as "doneAt", h.done_by as "doneBy",
               h.account_id as "accountId", acc.display_name as "accountName",
               (acc.recovery_hash is not null) as "hasCode"
          from public.cb_help_requests h left join public.cb_accounts acc on acc.id = h.account_id
         where coalesce(d->>'status', 'open') = 'all' or h.status = coalesce(d->>'status', 'open')
         order by h.created_at desc limit 100) r));
  elsif p_action = 'done' then
    update public.cb_help_requests set status = 'done', done_at = now(), done_by = me.email where id = (d->>'id')::bigint;
    insert into public.cb_admin_log (admin_email, action, detail) values (me.email, 'help-done', jsonb_build_object('id', d->>'id'));
    return jsonb_build_object('ok', true);
  elsif p_action = 'delete' then
    delete from public.cb_help_requests where id = (d->>'id')::bigint;
    insert into public.cb_admin_log (admin_email, action, detail) values (me.email, 'help-delete', jsonb_build_object('id', d->>'id'));
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'bad-action' using errcode = 'P0001';
end $$;

revoke execute on function public.cb_recovery_code(), public.cb_recovery_clean(text) from public, anon, authenticated;
revoke execute on function
  public.cb_account_recovery_status(text), public.cb_account_recovery_new(text),
  public.cb_account_recover(text, text, text), public.cb_help_request(text, text, text),
  public.cb_admin_help(text, text, jsonb)
from public;
grant execute on function
  public.cb_account_recovery_status(text), public.cb_account_recovery_new(text),
  public.cb_account_recover(text, text, text), public.cb_help_request(text, text, text),
  public.cb_admin_help(text, text, jsonb)
to anon, authenticated;
