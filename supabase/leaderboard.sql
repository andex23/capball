-- ─────────────────────────────────────────────────────────────
-- CAPBALL leaderboard (needs accounts.sql first)
--
-- Paste into Supabase → SQL Editor → Run. Safe to run again.
--
-- Signed-in players post their totals: one row per player for each week
-- ('2026-W41') and one for all time ('all'). The table is locked; the app can
-- only post its own row (by session token) and read the top of the board.
-- Numbers come from the player's phone, so they're sanity-capped, not proof.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.cb_board (
  account_id uuid not null references public.cb_accounts(id) on delete cascade,
  period text not null,                 -- 'all' or an ISO week like '2026-W41'
  played int not null default 0,
  won int not null default 0,
  goals int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (account_id, period)
);
create index if not exists cb_board_by_wins on public.cb_board (period, won desc, goals desc);
alter table public.cb_board enable row level security;
revoke all on public.cb_board from anon, authenticated;

-- Post this player's numbers for a period (only ever goes up within a period)
create or replace function public.cb_board_post(p_token text, p_period text, p_played int, p_won int, p_goals int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare a public.cb_accounts; v_cap int;
begin
  a := public.cb_account_by_token(p_token);
  if p_period is null or (p_period <> 'all' and p_period !~ '^[0-9]{4}-W[0-9]{2}$') then
    raise exception 'bad-period' using errcode = 'P0001';
  end if;
  v_cap := case when p_period = 'all' then 100000 else 2000 end;
  if p_played is null or p_won is null or p_goals is null
     or p_played < 0 or p_won < 0 or p_goals < 0
     or p_won > p_played or p_played > v_cap or p_goals > p_played * 20 then
    raise exception 'bad-stats' using errcode = 'P0001';
  end if;
  insert into public.cb_board (account_id, period, played, won, goals)
    values (a.id, p_period, p_played, p_won, p_goals)
  on conflict (account_id, period) do update
    set played = greatest(cb_board.played, excluded.played),
        won = greatest(cb_board.won, excluded.won),
        goals = greatest(cb_board.goals, excluded.goals),
        updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- The top of the board for a period, by wins then goals
create or replace function public.cb_board_top(p_period text, p_limit int default 20)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by r.rank), '[]'::jsonb) from (
    select row_number() over (order by b.won desc, b.goals desc, b.updated_at asc) as rank,
           acc.display_name as name, b.played, b.won, b.goals
      from public.cb_board b join public.cb_accounts acc on acc.id = b.account_id
     where b.period = p_period and b.played > 0
     order by b.won desc, b.goals desc, b.updated_at asc
     limit least(greatest(coalesce(p_limit, 20), 1), 50)
  ) r
$$;

revoke execute on function public.cb_board_post(text, text, int, int, int), public.cb_board_top(text, int) from public;
grant execute on function public.cb_board_post(text, text, int, int, int), public.cb_board_top(text, int) to anon, authenticated;
