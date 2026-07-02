import { supabase } from "./supabaseClient";

const DEFAULT_CATEGORIES = ["Nombre", "Apellido", "Animal", "Fruta", "Color", "País", "Objeto", "Cosa"];

export async function createRoom(code, { hostId, hostName, categories = DEFAULT_CATEGORIES, timeLimit = 60 }) {
  const { data, error } = await supabase
    .from("game_rooms")
    .insert({
      code,
      categories,
      time_limit: timeLimit,
      players: { [hostId]: { name: hostName } },
      totals: { [hostId]: 0 },
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchRoom(code) {
  const { data, error } = await supabase.from("game_rooms").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  return data;
}

// atomic on the server (avoids two players joining at the same instant clobbering each other)
export async function joinRoom(code, playerId, playerName) {
  const { error } = await supabase.rpc("join_room", {
    p_code: code,
    p_player_id: playerId,
    p_name: playerName,
  });
  if (error) throw error;
  return fetchRoom(code);
}

// plain update: only the host calls these, so there's a single writer
export async function updateRoomState(code, patch) {
  const { error } = await supabase.from("game_rooms").update(patch).eq("code", code);
  if (error) throw error;
}

// atomic merge into the answers jsonb column — every player calls this independently
export async function submitAnswer(code, roundId, playerId, answers) {
  const { error } = await supabase.rpc("submit_answer", {
    p_code: code,
    p_key: `${roundId}:${playerId}`,
    p_value: answers,
  });
  if (error) throw error;
}

// atomic toggle inside the overrides jsonb column
export async function toggleOverride(code, roundId, itemKey) {
  const { error } = await supabase.rpc("toggle_override", {
    p_code: code,
    p_round_key: String(roundId),
    p_item: itemKey,
  });
  if (error) throw error;
}

export async function addTotals(code, deltas) {
  const { error } = await supabase.rpc("add_totals", { p_code: code, p_deltas: deltas });
  if (error) throw error;
}

// pushes the full row every time it changes — no polling needed
export function subscribeRoom(code, onChange) {
  const channel = supabase
    .channel(`room-${code}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "game_rooms", filter: `code=eq.${code}` },
      (payload) => onChange(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function sendChatMessage(code, message) {
  const { error } = await supabase.rpc("add_chat_message", { p_code: code, p_message: message });
  if (error) throw error;
}
