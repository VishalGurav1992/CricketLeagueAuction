const API_URL = "http://localhost:5000";

export async function getTeams() {
  const res = await fetch(`${API_URL}/teams`);
  return res.json();
}

export async function getPlayers() {
  const res = await fetch(`${API_URL}/players`);
  return res.json();
}

export async function getCurrentAuction() {
  const res = await fetch(`${API_URL}/auction/current`);
  return res.json();
}

export async function selectPlayerForAuction(playerId) {
  const res = await fetch(`${API_URL}/auction/select-player`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId })
  });
  return res.json();
}

export async function updateBid(bidAmount) {
  const res = await fetch(`${API_URL}/auction/update-bid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bidAmount })
  });
  return res.json();
}

export async function markPlayerUnsold(playerId) {
  const res = await fetch(`${API_URL}/auction/mark-unsold`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId })
  });
  return res.json();
}

export async function sellPlayer(playerId, teamId, finalPrice) {
  const res = await fetch(`${API_URL}/auction/sell`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, teamId, finalPrice })
  });
  return res.json();
}

export async function relistPlayer(playerId) {
  const res = await fetch(`${API_URL}/auction/relist-player`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId })
  });
  return res.json();
}
