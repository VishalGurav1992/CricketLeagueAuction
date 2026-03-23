import React, { useState, useEffect } from "react";
import { sellPlayer, selectPlayerForAuction, updateBid } from "../api";

export default function AuctioneerPanel({ teams, players, socket, setTeams, setPlayers }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [bid, setBid] = useState(0);
  const [message, setMessage] = useState("");

  // Auto-update bid amount when player is selected
  useEffect(() => {
    if (selectedPlayer) {
      const player = players.find(p => p.id == selectedPlayer);
      if (player) {
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
    try {
      const response = await sellPlayer(selectedPlayer, selectedTeam, bid);
      if (response.updatedTeam) {
        setTeams(prevTeams => prevTeams.map(t => t.id == response.updatedTeam.id ? response.updatedTeam : t));
      }
      if (response.updatedPlayer) {
        setPlayers(prevPlayers => prevPlayers.map(p => p.id == response.updatedPlayer.id ? response.updatedPlayer : p));
      }
      setMessage("Player sold! Updates coming in real-time...");
      setSelectedPlayer(null);
      setSelectedTeam(null);
      setBid(0);
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

  return (
    <div style={{ flex: 1, padding: 20, background: "#f4f4f4" }}>
      <h2>Auctioneer Panel</h2>
      {message && <p style={{ color: message.includes("Error") ? "red" : "green", fontWeight: "bold" }}>{message}</p>}
      
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>Select Player:</label>
        <select 
          onChange={e => setSelectedPlayer(e.target.value)} 
          value={selectedPlayer || ""}
          style={{ width: "100%", padding: "8px", marginBottom: 10 }}
        >
          <option value="">Select Player</option>
          {players.filter(p => !p.sold_to_team).map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.role}) - Base: ₹{p.base_price}</option>
          ))}
        </select>
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
      </div>

      <button 
        onClick={handleSell} 
        style={{ 
          width: "100%", 
          padding: "15px", 
          background: "#dc3545", 
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
