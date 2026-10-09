-- ─────────────────────────────────────────────────────────────
-- CAPBALL player accounts: just a username and a password
--
-- Paste into Supabase → SQL Editor → Run. Safe to run again.
--
-- No email, no verification. A player picks a username and password and
-- the game keeps their save (kits, settings, records, tournaments) on the
-- server, so they can sign in on another phone and carry on.
--
-- Security model:
--  * Tables are locked (Row Level Security on, no policies); the public anon
--    key can only call the cb_account_* functions below.
--  * Passwords are stored as bcrypt hashes (pgcrypto); sessions as SHA-256
--    hashes of a random token the game keeps on the device.
--  * Ten wrong passwords in fifteen minutes locks that username for a while.
--  * There is no password reset (there's no email to send it to).
-- ─────────────────────────────────────────────────────────────

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.cb_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,          -- stored lower-case
  display_name text not null,             -- as they typed it
  pass_hash text not null,
  save_data jsonb not null default '{}'::jsonb,
  saved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.cb_account_sessions (
  token_hash text primary key,
  account_id uuid not null references public.cb_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table if not exists public.cb_account_failures (
  username text not null,
  at timestamptz not null default now()
);
create index if not exists cb_account_failures_by_name on public.cb_account_failures (username, at);

alter table public.cb_accounts enable row level security;
alter table public.cb_account_sessions enable row level security;
alter table public.cb_account_failures enable row level security;
revoke all on public.cb_accounts, public.cb_account_sessions, public.cb_account_failures from anon, authenticated;

-- ── helpers ──────────────────────────────────────────────────

create or replace function public.cb_account_hash(p_token text)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
$$;

create or replace function public.cb_account_check_name(p_username text)
returns text language plpgsql immutable set search_path = public as $$
declare v text := lower(trim(coalesce(p_username, '')));
begin
  if v !~ '^[a-z0-9_]{3,20}$' then raise exception 'bad-username' using errcode = 'P0001'; end if;
  return v;
end $$;

-- A fresh session for an account: returns the token the device keeps
create or replace function public.cb_account_new_session(p_account uuid)
returns text language plpgsql volatile set search_path = public, extensions as $$
declare v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into public.cb_account_sessions (token_hash, account_id) values (public.cb_account_hash(v_token), p_account);
  -- keep at most 10 sessions per account
  delete from public.cb_account_sessions
   where account_id = p_account
     and token_hash not in (select token_hash from public.cb_account_sessions where account_id = p_account order by last_seen desc limit 10);
  return v_token;
end $$;

create or replace function public.cb_account_by_token(p_token text)
returns public.cb_accounts language plpgsql volatile security definer set search_path = public as $$
declare a public.cb_accounts; v_hash text;
begin
  if p_token is null or length(p_token) < 20 or length(p_token) > 200 then raise exception 'signed-out' using errcode = 'P0001'; end if;
  v_hash := public.cb_account_hash(p_token);
  select acc.* into a from public.cb_account_sessions s join public.cb_accounts acc on acc.id = s.account_id where s.token_hash = v_hash;
  if a.id is null then raise exception 'signed-out' using errcode = 'P0001'; end if;
  update public.cb_account_sessions set last_seen = now() where token_hash = v_hash;
  return a;
end $$;

-- ── API ──────────────────────────────────────────────────────

create or replace function public.cb_account_signup(p_username text, p_password text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_name text; v_id uuid;
begin
  v_name := public.cb_account_check_name(p_username);
  if p_password is null or length(p_password) < 6 or length(p_password) > 72 then raise exception 'bad-password' using errcode = 'P0001'; end if;
  if exists (select 1 from public.cb_accounts where username = v_name) then raise exception 'username-taken' using errcode = 'P0001'; end if;
  insert into public.cb_accounts (username, display_name, pass_hash)
    values (v_name, trim(p_username), extensions.crypt(p_password, extensions.gen_salt('bf', 10)))
    returning id into v_id;
  return jsonb_build_object('token', public.cb_account_new_session(v_id), 'username', trim(p_username));
end $$;

create or replace function public.cb_account_login(p_username text, p_password text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_name text; a public.cb_accounts;
begin
  v_name := public.cb_account_check_name(p_username);
  if (select count(*) from public.cb_account_failures where username = v_name and at > now() - interval '15 minutes') >= 10 then
    raise exception 'too-many-tries' using errcode = 'P0001';
  end if;
  select * into a from public.cb_accounts where username = v_name;
  if a.id is null or a.pass_hash <> extensions.crypt(coalesce(p_password, ''), a.pass_hash) then
    -- Returned rather than raised, so the failed attempt is recorded (a raise would roll it back)
    insert into public.cb_account_failures (username) values (v_name);
    delete from public.cb_account_failures where at < now() - interval '1 day';
    return jsonb_build_object('error', 'wrong-login');
  end if;
  delete from public.cb_account_failures where username = v_name;
  return jsonb_build_object('token', public.cb_account_new_session(a.id), 'username', a.display_name);
end $$;

-- The player's saved game (empty object if they haven't saved yet)
create or replace function public.cb_account_load(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare a public.cb_accounts;
begin
  a := public.cb_account_by_token(p_token);
  return jsonb_build_object('username', a.display_name, 'data', a.save_data, 'savedAt', a.saved_at);
end $$;

create or replace function public.cb_account_save(p_token text, p_data jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare a public.cb_accounts;
begin
  a := public.cb_account_by_token(p_token);
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 400000 then
    raise exception 'bad-save' using errcode = 'P0001';
  end if;
  update public.cb_accounts set save_data = p_data, saved_at = now() where id = a.id;
  return jsonb_build_object('ok', true, 'savedAt', now());
end $$;

create or replace function public.cb_account_logout(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  delete from public.cb_account_sessions where token_hash = public.cb_account_hash(coalesce(p_token, ''));
  return jsonb_build_object('ok', true);
end $$;

-- Only the API is callable from the app; the helpers stay private.
revoke execute on function
  public.cb_account_hash(text), public.cb_account_check_name(text),
  public.cb_account_new_session(uuid), public.cb_account_by_token(text)
from public, anon, authenticated;
grant execute on function
  public.cb_account_signup(text, text),
  public.cb_account_login(text, text),
  public.cb_account_load(text),
  public.cb_account_save(text, jsonb),
  public.cb_account_logout(text)
to anon, authenticated;
