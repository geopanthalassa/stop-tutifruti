-- Run this once in your Supabase project's SQL editor.
-- Safe to re-run: uses "if not exists" / "or replace" where possible.
-- Adds room chat (safe to run even if game_rooms already exists from before).

alter table game_rooms add column if not exists chat jsonb not null default '[]'::jsonb;

create or replace function add_chat_message(p_code text, p_message jsonb)
returns void as $$
begin
  update game_rooms
  set chat = case
    when jsonb_array_length(chat) >= 50 then (chat - 0) || jsonb_build_array(p_message)
    else chat || jsonb_build_array(p_message)
  end
  where code = p_code;
end;
$$ language plpgsql;

create table if not exists game_rooms (
  code text primary key,
  categories jsonb not null default '[]'::jsonb,
  time_limit int not null default 60,
  used_letters jsonb not null default '[]'::jsonb,
  phase text not null default 'lobby',       -- lobby | active | gameover
  letter text,
  round_id int not null default 0,
  start_time bigint,                          -- epoch ms
  duration int,                                -- seconds
  stopped_by text,
  players jsonb not null default '{}'::jsonb,  -- { playerId: { name } }
  totals jsonb not null default '{}'::jsonb,   -- { playerId: score }
  answers jsonb not null default '{}'::jsonb,  -- { "roundId:playerId": { category: text } }
  overrides jsonb not null default '{}'::jsonb,-- { roundId: ["playerId-category", ...] }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table game_rooms enable row level security;

-- Casual party game, no auth: anyone with the anon key can read/write any room.
-- Rooms are short-lived and gated by a 4-character code, so this is an acceptable
-- v1 trade-off — tighten this if you ever add accounts or persistent history.
drop policy if exists "anon select rooms" on game_rooms;
create policy "anon select rooms" on game_rooms for select using (true);

drop policy if exists "anon insert rooms" on game_rooms;
create policy "anon insert rooms" on game_rooms for insert with check (true);

drop policy if exists "anon update rooms" on game_rooms;
create policy "anon update rooms" on game_rooms for update using (true);

-- keep updated_at fresh
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists game_rooms_updated_at on game_rooms;
create trigger game_rooms_updated_at
before update on game_rooms
for each row execute procedure set_updated_at();

-- enable Realtime pushes for this table
alter publication supabase_realtime add table game_rooms;

-- atomic: add a player without clobbering a concurrent join
create or replace function join_room(p_code text, p_player_id text, p_name text)
returns void as $$
begin
  update game_rooms
  set players = jsonb_set(players, array[p_player_id], jsonb_build_object('name', p_name), true),
      totals = case when totals ? p_player_id then totals else jsonb_set(totals, array[p_player_id], '0'::jsonb, true) end
  where code = p_code;
end;
$$ language plpgsql;

-- atomic: write one player's answers for a round without clobbering others submitting at the same time
create or replace function submit_answer(p_code text, p_key text, p_value jsonb)
returns void as $$
begin
  update game_rooms
  set answers = jsonb_set(answers, array[p_key], p_value, true)
  where code = p_code;
end;
$$ language plpgsql;

-- atomic: toggle one "playerId-category" flag inside overrides->roundId
create or replace function toggle_override(p_code text, p_round_key text, p_item text)
returns void as $$
declare
  current jsonb;
begin
  select coalesce(overrides -> p_round_key, '[]'::jsonb) into current from game_rooms where code = p_code;
  if current ? p_item then
    select coalesce(jsonb_agg(elem), '[]'::jsonb) into current
    from jsonb_array_elements_text(current) elem
    where elem <> p_item;
  else
    current := current || to_jsonb(array[p_item]);
  end if;
  update game_rooms set overrides = jsonb_set(overrides, array[p_round_key], current, true) where code = p_code;
end;
$$ language plpgsql;

-- atomic: add round-score deltas onto the running totals (host-only action, but atomic just in case)
create or replace function add_totals(p_code text, p_deltas jsonb)
returns void as $$
declare
  k text;
  v text;
begin
  for k, v in select * from jsonb_each_text(p_deltas)
  loop
    update game_rooms
    set totals = jsonb_set(totals, array[k], to_jsonb(coalesce((totals ->> k)::numeric, 0) + v::numeric))
    where code = p_code;
  end loop;
end;
$$ language plpgsql;

-- optional housekeeping: delete rooms untouched for more than a day
-- (run manually, or wire up as a Supabase cron job later)
-- delete from game_rooms where updated_at < now() - interval '1 day';
