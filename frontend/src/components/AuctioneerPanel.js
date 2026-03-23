import React, { useState, useEffect } from "react";
import { sellPlayer, selectPlayerForAuction, updateBid } from "../api";

export default function AuctioneerPanel({ teams, players, socket, setTeams, setPlayers }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [bid, setBid] = useState(0);
  const [message, setMessage] = useState("");

  const getAvailablePlayers = () => {
    return players
      .filter(p => !p.sold_to_team)
      .sort((a, b) => Number(a.id) - Number(b.id));
  };

  // Auto-pick the first available player if current selection is missing/invalid.
  useEffect(() => {
    const availablePlayers = getAvailablePlayers();

    if (!availablePlayers.length) {
      setSelectedPlayer(null);
      setBid(0);
      return;
    }

    const currentStillAvailable = selectedPlayer && availablePlayers.some(p => p.id == selectedPlayer);
    if (!currentStillAvailable) {
      setSelectedPlayer(String(availablePlayers[0].id));
    }
  }, [players, selectedPlayer]);

  // Auto-update bid amount when player is selected
  useEffect(() => {
    if (selectedPlayer) {
      const player = players.find(p => p.id == selectedPlayer);
      if (player) {
        if (player.sold_to_team) return;
        setBid(player.base_price);
        // Notify backend that this player is selected for auction
        selectPlayerForAuction(selectedPlayer);
      }
    } else {
      setBid(0);
    }
  }, [selectedPlayer, players]);

  // Update bid on backend when bid changes
  useEffect(() => {
    if (selectedPlayer && bid > 0) {
      updateBid(bid);
    }
  }, [bid, selectedPlayer]);

  const handleSell = async () => {
    if (!selectedPlayer || !selectedTeam || bid <= 0) return;

    const availablePlayers = getAvailablePlayers();
    const currentIndex = availablePlayers.findIndex(p => p.id == selectedPlayer);
    const nextPlayerId = (currentIndex >= 0 && currentIndex < availablePlayers.length - 1)
      ? String(availablePlayers[currentIndex + 1].id)
      : null;

    const playerIdToSell = selectedPlayer;
    const teamIdToSell = selectedTeam;
    const finalBid = bid;

    try {
      const response = await sellPlayer(playerIdToSell, teamIdToSell, finalBid);
      if (response?.error) {
        setMessage(response.error);
        setTimeout(() => setMessage(""), 3000);
        return;
      }

      if (response.updatedTeam) {
        setTeams(prevTeams => prevTeams.map(t => t.id == response.updatedTeam.id ? response.updatedTeam : t));
      }
      if (response.updatedPlayer) {
        setPlayers(prevPlayers => prevPlayers.map(p => p.id == response.updatedPlayer.id ? response.updatedPlayer : p));
      }
      setSelectedPlayer(nextPlayerId);
      setSelectedTeam(null);
      if (!nextPlayerId) {
        setBid(0);
      }
      setMessage("Player sold! Updates coming in real-time...");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("Error selling player");
    }
  };

  const handleReset = async () => {
    if (window.confirm("Are you sure you want to reset the database? This will erase all auction progress.")) {
      try {
        await fetch("http://localhost:5000/reset", { method: "POST" });
        setMessage("Database reset successfully! Updates coming in real-time...");
        setTimeout(() => setMessage(""), 3000);
      } catch (error) {
        setMessage("Error resetting database");
      }
    }
  };

  const incrementBid = (amount) => {
    setBid(prevBid => prevBid + amount);
  };

  const decrementBid = (amount) => {
    setBid(prevBid => Math.max(0, prevBid - amount));
  };

  const handleTeamDetailsClick = (teamId) => {
    if (!socket) return;
    socket.emit("selectTeamForDashboard", { teamId });
  };

  return (
    <div style={{ flex: 1, padding: 20, background: "#f4f4f4" }}>
      <h2>Auctioneer Panel</h2>
      {message && <p style={{ color: message.includes("Error") ? "red" : "green", fontWeight: "bold" }}>{message}</p>}
      
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>Current Player (Auto Sequence):</label>
        {selectedPlayer ? (
          <div style={{ width: "100%", padding: "10px", marginBottom: 10, background: "#fff", border: "1px solid #ced4da", borderRadius: "4px" }}>
            {(() => {
              const player = players.find(p => p.id == selectedPlayer);
              return player
                ? `${player.name} (${player.role}) - Base: ₹${player.base_price}`
                : "Loading player...";
            })()}
          </div>
        ) : (
          <div style={{ width: "100%", padding: "10px", marginBottom: 10, background: "#fff", border: "1px solid #ced4da", borderRadius: "4px", color: "#666" }}>
            All players have been auctioned.
          </div>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>Select Team:</label>
        <select 
          onChange={e => setSelectedTeam(e.target.value)} 
          value={selectedTeam || ""}
          style={{ width: "100%", padding: "8px", marginBottom: 10 }}
        >
          <option value="">Select Team</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>{t.name} (Balance: ₹{t.balance})</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>Bid Amount:</label>
        <input 
          type="number" 
          placeholder="Bid Amount" 
          onChange={e => setBid(Number(e.target.value))} 
          value={bid || ""} 
          style={{ width: "100%", padding: "8px", marginBottom: 10 }}
        />
        
        <div style={{ display: "flex", gap: "10px", marginBottom: 10 }}>
          <button 
            onClick={() => incrementBid(1000)} 
            style={{ flex: 1, padding: "10px", background: "#007bff", color: "white", border: "none", borderRadius: "4px" }}
          >
            +₹1000
          </button>
          <button 
            onClick={() => incrementBid(2000)} 
            style={{ flex: 1, padding: "10px", background: "#28a745", color: "white", border: "none", borderRadius: "4px" }}
          >
            +₹2000
          </button>
          <button 
            onClick={() => incrementBid(5000)} 
            style={{ flex: 1, padding: "10px", background: "#ffc107", color: "black", border: "none", borderRadius: "4px" }}
          >
            +₹5000
          </button>
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: 10 }}>
          <button 
            onClick={() => decrementBid(1000)} 
            style={{ flex: 1, padding: "10px", background: "#6c757d", color: "white", border: "none", borderRadius: "4px" }}
          >
            -₹1000
          </button>
          <button 
            onClick={() => decrementBid(2000)} 
            style={{ flex: 1, padding: "10px", background: "#495057", color: "white", border: "none", borderRadius: "4px" }}
          >
            -₹2000
          </button>
          <button 
            onClick={() => decrementBid(5000)} 
            style={{ flex: 1, padding: "10px", background: "#343a40", color: "white", border: "none", borderRadius: "4px" }}
          >
            -₹5000
          </button>
        </div>
      </div>

      <button 
        onClick={handleSell} 
        disabled={!selectedPlayer}
        style={{ 
          width: "100%", 
          padding: "15px", 
          background: selectedPlayer ? "#dc3545" : "#9aa0a6", 
          color: "white", 
          border: "none", 
          borderRadius: "4px", 
          fontSize: "16px", 
          fontWeight: "bold",
          marginBottom: 20
        }}
      >
        SELL PLAYER
      </button>

      <hr />
      <div style={{ margin: "16px 0" }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>Show Team Details On Dashboard:</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
          {teams.map(t => (
            <button
              key={`details-${t.id}`}
              onClick={() => handleTeamDetailsClick(t.id)}
              style={{ padding: "10px", background: "#1f3b73", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <button 
        style={{ 
          width: "100%", 
          background: "red", 
          color: "white", 
          padding: "10px", 
          border: "none", 
          borderRadius: "4px" 
        }} 
        onClick={handleReset}
      >
        Reset Database
      </button>
    </div>
  );
}
