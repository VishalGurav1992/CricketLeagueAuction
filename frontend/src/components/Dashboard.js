import React, { useState, useEffect, useRef } from "react";

export default function Dashboard({ teams, players, currentAuction, socket, auctionError }) {
  const [showCongratsPopup, setShowCongratsPopup] = useState(false);
  const [soldPlayerInfo, setSoldPlayerInfo] = useState(null);
  const [soundConfig, setSoundConfig] = useState(null);
  const audioRef = useRef(null);

  // Load sound configuration
  useEffect(() => {
    fetch('/sound-config.json')
      .then(response => response.json())
      .then(config => setSoundConfig(config))
      .catch(error => console.log('Sound config not found, using defaults'));
  }, []);

  // Calculate number of players per team
  const getTeamPlayerCount = (teamId) => {
    return players.filter(p => p.sold_to_team == teamId).length;
  };

  // Listen for player sold events
  useEffect(() => {
    if (!socket) return;

    socket.on("playerSold", (data) => {
      const { playerId, teamId, finalPrice } = data;
      const player = players.find(p => p.id == playerId);
      const team = teams.find(t => t.id == teamId);

      if (player && team) {
        setSoldPlayerInfo({
          player,
          team,
          finalPrice
        });
        setShowCongratsPopup(true);

        // Play sound effect
        if (audioRef.current && soundConfig?.sounds?.playerSold && soundConfig?.animations?.enableSounds) {
          audioRef.current.src = soundConfig.sounds.playerSold;
          audioRef.current.play().catch(e => console.log('Audio play failed:', e));
        }

        // Auto-hide popup after configured duration
        const duration = soundConfig?.animations?.celebrationDuration || 5000;
        setTimeout(() => {
          setShowCongratsPopup(false);
          setSoldPlayerInfo(null);
        }, duration);
      }
    });

    return () => {
      socket.off("playerSold");
    };
  }, [socket, players, teams, soundConfig]);

  return (
    <div
      className="dashboard-root"
      style={{
        flex: 1,
        minWidth: 0,
        height: "100vh",
        maxHeight: "100vh",
        overflow: "hidden",
        padding: 16,
        boxSizing: "border-box",
        background: "#f8f9fa",
        display: "flex",
        flexDirection: "column",
        gap: 12
      }}
    >
      <h1 className="dashboard-title" style={{ textAlign: "center", color: "#333", margin: 0, fontSize: "clamp(20px, 3.1vw, 34px)", lineHeight: 1.15 }}>
        Siddar Premier League Auction
      </h1>

      {auctionError && (
        <div style={{
          margin: "0 auto 20px",
          maxWidth: "600px",
          background: "#f8d7da",
          color: "#721c24",
          border: "1px solid #f5c6cb",
          borderRadius: "8px",
          padding: "15px",
          textAlign: "center",
          fontWeight: "bold"
        }}>
          {auctionError}
        </div>
      )}

      <div className="dashboard-content" style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 14 }}>
        {/* Teams Table */}
        <div style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
          <h2 style={{ color: "#333", margin: "0 0 10px", fontSize: "clamp(16px, 2vw, 24px)" }}>Teams</h2>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", background: "white", padding: 8, borderRadius: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#007bff", color: "white" }}>
                <th style={{ padding: "8px 6px", border: "1px solid #dee2e6", textAlign: "left", fontSize: "clamp(11px, 1vw, 14px)" }}>Team</th>
                <th style={{ padding: "8px 6px", border: "1px solid #dee2e6", textAlign: "right", fontSize: "clamp(11px, 1vw, 14px)" }}>Balance (₹)</th>
                <th style={{ padding: "8px 6px", border: "1px solid #dee2e6", textAlign: "right", fontSize: "clamp(11px, 1vw, 14px)" }}>Players</th>
              </tr>
            </thead>
            <tbody>
              {teams.map(team => (
                <tr key={team.id} style={{ backgroundColor: "white", borderBottom: "1px solid #dee2e6" }}>
                  <td style={{ padding: "6px", border: "1px solid #dee2e6" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <img
                        src={`http://localhost:5000${team.photo}`}
                        alt={team.name}
                        style={{ width: "clamp(22px, 2.2vw, 34px)", height: "clamp(22px, 2.2vw, 34px)", borderRadius: "50%", objectFit: "cover", border: "2px solid #007bff" }}
                      />
                      <span style={{ fontWeight: "bold", color: "#333", fontSize: "clamp(11px, 1.05vw, 15px)", lineHeight: 1.2 }}>{team.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "6px", border: "1px solid #dee2e6", textAlign: "right", fontWeight: "bold", color: "#28a745", fontSize: "clamp(11px, 1vw, 14px)" }}>
                    ₹{team.balance.toLocaleString()}
                  </td>
                  <td style={{ padding: "6px", border: "1px solid #dee2e6", textAlign: "right", color: "#666", fontSize: "clamp(11px, 1vw, 14px)" }}>
                    {getTeamPlayerCount(team.id)}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>

        {/* Current Auction Player */}
        <div style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
          <h2 style={{ color: "#333", margin: "0 0 10px", fontSize: "clamp(16px, 2vw, 24px)" }}>Current Auction</h2>
          {currentAuction.player ? (
            <div style={{
              flex: 1,
              minHeight: 0,
              background: "white",
              borderRadius: "12px",
              padding: "clamp(12px, 1.8vw, 24px)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              border: "2px solid #007bff",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 10,
              overflow: "hidden"
            }}>
              <div>
                <img
                  src={`http://localhost:5000${currentAuction.player.photo}`}
                  alt={currentAuction.player.name}
                  style={{
                    width: "clamp(80px, 11vw, 130px)",
                    height: "clamp(80px, 11vw, 130px)",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "4px solid #007bff"
                  }}
                />
              </div>
              <h2 style={{ color: "#333", margin: 0, fontSize: "clamp(18px, 2.2vw, 30px)", lineHeight: 1.2 }}>
                {currentAuction.player.name}
              </h2>
              <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{
                  background: "#e9ecef",
                  padding: "7px 14px",
                  borderRadius: "18px",
                  fontWeight: "bold",
                  color: "#495057",
                  fontSize: "clamp(11px, 1vw, 14px)"
                }}>
                  {currentAuction.player.role}
                </div>
                <div style={{
                  background: "#fff3cd",
                  padding: "7px 14px",
                  borderRadius: "18px",
                  fontWeight: "bold",
                  color: "#856404",
                  fontSize: "clamp(11px, 1vw, 14px)"
                }}>
                  Base: ₹{currentAuction.player.base_price.toLocaleString()}
                </div>
              </div>
              <div style={{ marginTop: 4 }}>
                <h3 style={{ color: "#333", margin: "0 0 4px", fontSize: "clamp(14px, 1.4vw, 20px)" }}>Current Bid</h3>
                <div style={{
                  fontSize: "clamp(26px, 4.2vw, 52px)",
                  fontWeight: "bold",
                  color: "#dc3545",
                  textShadow: "2px 2px 4px rgba(0,0,0,0.1)",
                  lineHeight: 1.05
                }}>
                  ₹{currentAuction.currentBid.toLocaleString()}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1,
              minHeight: 0,
              background: "white",
              borderRadius: "12px",
              padding: "clamp(12px, 2.2vw, 30px)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              textAlign: "center",
              color: "#666",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center"
            }}>
              <h3 style={{ margin: "0 0 10px", fontSize: "clamp(16px, 1.8vw, 24px)" }}>No player currently being auctioned</h3>
              <p style={{ margin: 0, fontSize: "clamp(12px, 1.1vw, 16px)" }}>Select a player in the Auctioneer Panel to start bidding</p>
            </div>
          )}
        </div>
      </div>

      {/* Congratulatory Popup */}
      {showCongratsPopup && soldPlayerInfo && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000
        }}>
          {/* Fire Flame Effect */}
          {soundConfig?.effects?.fireParticles && (
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: "none",
              overflow: "hidden"
            }}>
              {[...Array(25)].map((_, i) => (
                <div
                  key={`fire-${i}`}
                  style={{
                    position: "absolute",
                    width: `${6 + Math.random() * 8}px`,
                    height: `${20 + Math.random() * 30}px`,
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 50% 0%, rgba(255,255,255,0.9) 0%, rgba(255,200,0,0.85) 25%, rgba(255,90,0,0.55) 55%, rgba(170,40,0,0.2) 100%)`,
                    left: `${Math.random() * 95}%`,
                    bottom: `${-30 - Math.random() * 30}px`,
                    transform: `translateX(-50%) rotate(${Math.random() * 30 - 15}deg)`,
                    boxShadow: `0 0 ${10 + Math.random() * 15}px rgba(255,120,0,0.6)`,
                    animation: `realFire ${2 + Math.random()*1.4}s ease-out infinite`,
                    animationDelay: `${Math.random() * 1.5}s`,
                    opacity: 0.8
                  }}
                />
              ))}
            </div>
          )}

          {/* Emoji Rain Effect */}
          {soundConfig?.effects?.emojiRain && (
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: "none",
              overflow: "hidden"
            }}>
              {['🎉', '🏆', '⭐', '🎊', '💥', '🔥', '⚡', '💫'].map((emoji, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    fontSize: "24px",
                    left: `${10 + (i * 10)}%`,
                    top: "-50px",
                    animation: `emojiFall ${3 + Math.random() * 2}s linear infinite`,
                    animationDelay: `${Math.random() * 2}s`
                  }}
                >
                  {emoji}
                </div>
              ))}
            </div>
          )}

          <div style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "20px",
            padding: "40px",
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            maxWidth: "500px",
            width: "90%",
            position: "relative",
            transform: "scale(1)",
            opacity: 1,
            transition: "all 0.3s ease",
            zIndex: 1001
          }}>
            {/* Fireworks/confetti effect */}
            <div style={{
              position: "absolute",
              top: "-20px",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "40px",
              animation: "fireworkBounce 1s infinite"
            }}>
              🎉
            </div>

            <h1 style={{
              color: "white",
              fontSize: "36px",
              margin: "20px 0",
              textShadow: "2px 2px 4px rgba(0,0,0,0.3)"
            }}>
              PLAYER SOLD!
            </h1>

            <div style={{ margin: "30px 0" }}>
              <img
                src={`http://localhost:5000${soldPlayerInfo.player.photo}`}
                alt={soldPlayerInfo.player.name}
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  border: "4px solid white",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
                }}
              />
            </div>

            <h2 style={{
              color: "white",
              fontSize: "28px",
              margin: "15px 0",
              textShadow: "1px 1px 2px rgba(0,0,0,0.3)"
            }}>
              {soldPlayerInfo.player.name}
            </h2>

            <div style={{
              background: "rgba(255,255,255,0.2)",
              borderRadius: "25px",
              padding: "10px 20px",
              display: "inline-block",
              margin: "10px 0",
              fontWeight: "bold",
              color: "white"
            }}>
              {soldPlayerInfo.player.role}
            </div>

            <h3 style={{
              color: "#FFD700",
              fontSize: "32px",
              margin: "20px 0",
              textShadow: "2px 2px 4px rgba(0,0,0,0.5)"
            }}>
              ₹{soldPlayerInfo.finalPrice.toLocaleString()}
            </h3>

            <div style={{
              background: "rgba(255,255,255,0.9)",
              borderRadius: "15px",
              padding: "15px",
              margin: "20px 0"
            }}>
              <h3 style={{
                color: "#333",
                margin: "0",
                fontSize: "24px"
              }}>
                🎉 Congratulations {soldPlayerInfo.team.name}! 🎉
              </h3>
            </div>

            <div style={{
              position: "absolute",
              bottom: "-15px",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "30px",
              animation: "trophyBounce 1s infinite 0.5s"
            }}>
              🏆
            </div>
          </div>

          {/* Hidden audio element */}
          <audio ref={audioRef} preload="auto" />
        </div>
      )}

      {/* Global CSS animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fireParticle {
            0% {
              transform: translateY(0) scaleY(1);
              opacity: 0.8;
            }
            30% {
              opacity: 1;
            }
            100% {
              transform: translateY(-110vh) scaleY(1.8);
              opacity: 0;
            }
          }

          @keyframes emojiFall {
            0% {
              transform: translateY(-50px) rotate(0deg);
              opacity: 1;
            }
            100% {
              transform: translateY(100vh) rotate(360deg);
              opacity: 0;
            }
          }

          @keyframes fireworkBounce {
            0%, 20%, 50%, 80%, 100% {
              transform: translateX(-50%) translateY(0) scale(1);
            }
            40% {
              transform: translateX(-50%) translateY(-10px) scale(1.1);
            }
            60% {
              transform: translateX(-50%) translateY(-5px) scale(1.05);
            }
          }

          @keyframes trophyBounce {
            0%, 20%, 50%, 80%, 100% {
              transform: translateX(-50%) translateY(0) scale(1);
            }
            40% {
              transform: translateX(-50%) translateY(-10px) scale(1.1);
            }
            60% {
              transform: translateX(-50%) translateY(-5px) scale(1.05);
            }
          }

          @keyframes flamePulse {
            0% { opacity: 0.8; transform: scale(0.95); }
            50% { opacity: 1; transform: scale(1); }
            100% { opacity: 0.8; transform: scale(0.95); }
          }

          @media (max-width: 900px) {
            .dashboard-root {
              padding: 10px !important;
              gap: 8px !important;
            }

            .dashboard-title {
              font-size: clamp(16px, 5vw, 24px) !important;
            }

            .dashboard-content {
              grid-template-columns: 1fr !important;
              grid-template-rows: 0.95fr 1.05fr;
              gap: 8px !important;
            }
          }
        `
      }} />
    </div>
  );
}
