import React, { useState, useEffect, useRef } from "react";

export default function Dashboard({ teams, players, currentAuction, socket, auctionError, selectedTeamDetails, onCloseTeamDetails }) {
  const [showCongratsPopup, setShowCongratsPopup] = useState(false);
  const [soldPlayerInfo, setSoldPlayerInfo] = useState(null);
  const [soundConfig, setSoundConfig] = useState(null);
  const [isBackgroundEnabled, setIsBackgroundEnabled] = useState(true);
  const [displayedAuction, setDisplayedAuction] = useState(null);
  const [showAuctionCard, setShowAuctionCard] = useState(false);
  const [auctionCardAnimSeed, setAuctionCardAnimSeed] = useState(0);
  const [titleWidth, setTitleWidth] = useState(null);
  const audioRef = useRef(null);
  const hideAuctionTimerRef = useRef(null);
  const activeAuctionPlayerIdRef = useRef(null);
  const titleRef = useRef(null);

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

  useEffect(() => {
    if (hideAuctionTimerRef.current) {
      clearTimeout(hideAuctionTimerRef.current);
      hideAuctionTimerRef.current = null;
    }

    if (currentAuction?.player) {
      const nextPlayerId = currentAuction.player.id;
      const isNewSelection = nextPlayerId !== activeAuctionPlayerIdRef.current;

      activeAuctionPlayerIdRef.current = nextPlayerId;
      setDisplayedAuction(currentAuction);

      if (isNewSelection) {
        // Re-mount card for a deterministic entry animation on each new selection.
        setAuctionCardAnimSeed(prev => prev + 1);
      }

      setShowAuctionCard(true);
      return;
    }

    activeAuctionPlayerIdRef.current = null;
    setShowAuctionCard(false);
    hideAuctionTimerRef.current = setTimeout(() => {
      setDisplayedAuction(null);
    }, 320);
  }, [currentAuction]);

  useEffect(() => {
    return () => {
      if (hideAuctionTimerRef.current) {
        clearTimeout(hideAuctionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const syncTitleWidth = () => {
      if (titleRef.current) {
        setTitleWidth(titleRef.current.getBoundingClientRect().width);
      }
    };

    syncTitleWidth();
    window.addEventListener("resize", syncTitleWidth);
    return () => window.removeEventListener("resize", syncTitleWidth);
  }, []);

  const teamDetailPlayers = selectedTeamDetails?.players || [];
  const TEAM_MAX_PLAYERS = 15;
  const teamDetailRows = [
    ...teamDetailPlayers,
    ...Array(Math.max(0, TEAM_MAX_PLAYERS - teamDetailPlayers.length)).fill(null)
  ];
  // Always size for 15 rows since we always show 15
  const teamDetailFontSize = "14px";
  const teamDetailCellPadding = "2px 4px";
  const teamDetailImageSize = 18;
  const teamDetailRowHeight = `calc((96vh - 190px) / ${TEAM_MAX_PLAYERS})`;

  const getTeamDetailsPdfFileName = () => {
    const teamName = (selectedTeamDetails?.team_name || "team-details")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const dateStamp = new Date().toISOString().slice(0, 10);
    return `${teamName || "team-details"}-${dateStamp}.pdf`;
  };

  const toAbsolutePhotoUrl = (photoPath) => {
    if (!photoPath) return "";
    if (/^https?:\/\//i.test(photoPath)) return photoPath;
    return `http://localhost:5000${photoPath}`;
  };

  const fetchImageAsDataUrl = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const createTeamDetailsPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default;

    const photoDataUrls = await Promise.all(
      teamDetailRows.map((p) => p ? fetchImageAsDataUrl(toAbsolutePhotoUrl(p.photo)) : Promise.resolve(null))
    );

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const heading = `Team Details - ${selectedTeamDetails?.team_name || "-"}`;
    const subHeading = `Owner: ${selectedTeamDetails?.owner_name || "-"}`;

    doc.setFontSize(15);
    doc.text(heading, 36, 34);
    doc.setFontSize(11);
    doc.text(subHeading, 36, 54);

    autoTable(doc, {
      startY: 68,
      head: [["#", "Photo", "Name", "Role", "Sold Status", "Sold Price", "Age", "Mobile Number"]],
      body: teamDetailRows.map((p, idx) => [
        String(idx + 1),
        "",
        p ? (p.name || "-") : "",
        p ? (p.role || "-") : "",
        p ? (p.sold_status || "-") : "",
        p ? (p.sold_price ?? "-") : "",
        p ? (p.age ?? "-") : "",
        p ? (p.mobile_number || "-") : ""
      ]),
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 46 }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index >= teamDetailPlayers.length && data.column.index > 0) {
          data.cell.styles.fillColor = [8, 10, 22];
          data.cell.styles.textColor = [8, 10, 22];
        }
      },
      styles: {
        fontSize: 10,
        cellPadding: 4,
        overflow: "linebreak",
        minCellHeight: 28,
        valign: "middle"
      },
      headStyles: {
        fillColor: [31, 38, 89],
        textColor: [248, 244, 223]
      },
      theme: "grid",
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 1) return;
        if (data.row.index >= teamDetailPlayers.length) return;
        const imageDataUrl = photoDataUrls[data.row.index];
        if (!imageDataUrl) return;

        const size = Math.min(data.cell.height - 6, 22);
        const x = data.cell.x + (data.cell.width - size) / 2;
        const y = data.cell.y + (data.cell.height - size) / 2;
        try {
          doc.addImage(imageDataUrl, "JPEG", x, y, size, size);
        } catch {
          // Ignore invalid image formats for individual rows.
        }
      }
    });

    return doc;
  };

  const handleSaveTeamDetailsPdf = async () => {
    if (!selectedTeamDetails) return;
    try {
      const doc = await createTeamDetailsPdf();
      doc.save(getTeamDetailsPdfFileName());
    } catch (err) {
      alert("Unable to generate PDF right now.");
    }
  };


  return (
    <div
      className="dashboard-root"
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        height: "100vh",
        maxHeight: "100vh",
        overflow: "hidden",
        padding: 16,
        boxSizing: "border-box",
        backgroundColor: "#f8f9fa",
        backgroundImage: isBackgroundEnabled
          ? "url('/pictures/background.JPG')"
          : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        display: "flex",
        flexDirection: "column",
        gap: 12
      }}
    >
      <div style={{ position: "relative", minHeight: 52, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 2 }}>
        <h1 ref={titleRef} className="dashboard-title" style={{
          textAlign: "center",
          color: "#ffffff",
          margin: 0,
          fontSize: "clamp(33px, 4.8vw, 57px)",
          lineHeight: 1.05,
          letterSpacing: "1px",
          fontWeight: 900,
          textTransform: "uppercase",
          textShadow: "0 1px 0 #d8be7a, 0 2px 0 #bba062, 0 3px 0 #8d7646, 0 10px 18px rgba(0,0,0,0.55)"
        }}>
          Siddar Premier League Auction 2026
        </h1>
        <button
          onClick={() => setIsBackgroundEnabled(prev => !prev)}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            border: "none",
            borderRadius: "999px",
            padding: "8px 12px",
            fontSize: "12px",
            fontWeight: "bold",
            cursor: "pointer",
            background: isBackgroundEnabled ? "#198754" : "#6c757d",
            color: "white",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
          }}
        >
          {isBackgroundEnabled ? "Background: ON" : "Background: OFF"}
        </button>
      </div>

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

      <div className="dashboard-content" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {/* Teams Table - 60% height */}
        <div style={{ flex: "0 0 60%", minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{
            flex: "0 1 auto",
            maxHeight: "100%",
            overflowX: "hidden",
            overflowY: "auto",
            width: titleWidth ? `${Math.round(titleWidth)}px` : "100%",
            maxWidth: "100%",
            background: "linear-gradient(180deg, rgba(22,28,70,0.62) 0%, rgba(10,12,32,0.58) 100%)",
            padding: 8,
            borderRadius: 10,
            border: "1px solid rgba(225,195,120,0.6)",
            boxShadow: "0 10px 26px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
            backdropFilter: "blur(2px)"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "rgba(17,22,56,0.55)", color: "#f1e9cc" }}>
                <th style={{ padding: "8px 6px", border: "1px solid rgba(225,195,120,0.45)", textAlign: "left", fontSize: "clamp(16px, 1.5vw, 21px)", letterSpacing: 0.5 }}>Team</th>
                <th style={{ padding: "8px 6px", border: "1px solid rgba(225,195,120,0.45)", textAlign: "right", fontSize: "clamp(16px, 1.5vw, 21px)", letterSpacing: 0.5 }}>Balance (Coins)</th>
                <th style={{ padding: "8px 6px", border: "1px solid rgba(225,195,120,0.45)", textAlign: "right", fontSize: "clamp(16px, 1.5vw, 21px)", letterSpacing: 0.5 }}>Players</th>
              </tr>
            </thead>
            <tbody>
              {teams.map(team => (
                <tr key={team.id} style={{ backgroundColor: "rgba(10,12,32,0.28)", borderBottom: "1px solid rgba(225,195,120,0.35)" }}>
                  <td style={{ padding: "6px", border: "1px solid rgba(225,195,120,0.35)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <img
                        src={`http://localhost:5000${team.photo}`}
                        alt={team.name}
                        style={{ width: "clamp(22px, 2.2vw, 34px)", height: "clamp(22px, 2.2vw, 34px)", borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(225,195,120,0.9)" }}
                      />
                      <span style={{ fontWeight: "bold", color: "#f8f4df", fontSize: "clamp(17px, 1.6vw, 23px)", lineHeight: 1.2, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{team.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "6px", border: "1px solid rgba(225,195,120,0.35)", textAlign: "right", fontWeight: "bold", color: "#f1e9cc", fontSize: "clamp(17px, 1.5vw, 21px)", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                    {team.balance.toLocaleString()}
                  </td>
                  <td style={{ padding: "6px", border: "1px solid rgba(225,195,120,0.35)", textAlign: "right", color: "#f1e9cc", fontSize: "clamp(17px, 1.5vw, 21px)", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                    {getTeamPlayerCount(team.id)}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
        {/* Auction Zone - 40% height */}
        <div style={{ flex: "0 0 40%", minHeight: 0, position: "relative" }}>
          {displayedAuction?.player && (
            <div
              key={`${displayedAuction.player.id}-${auctionCardAnimSeed}`}
              style={{
                position: "absolute",
                left: "50%",
                bottom: "8px",
                width: "min(980px, calc(100% - 24px))",
                borderRadius: "14px",
                padding: "0 10px 10px",
                background: "linear-gradient(180deg, rgba(22,28,70,0.98) 0%, rgba(10,12,32,0.98) 52%, rgba(7,9,24,0.98) 100%)",
                border: "1px solid rgba(225,195,120,0.78)",
                boxShadow: "0 18px 48px rgba(0,0,0,0.52), inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.04)",
                transform: showAuctionCard ? "translateX(-50%) translateY(0) scale(1)" : "translateX(-50%) translateY(28px) scale(0.98)",
                opacity: showAuctionCard ? 1 : 0,
                transition: "transform 300ms ease, opacity 300ms ease",
                animation: showAuctionCard ? "auctionCardIn 420ms cubic-bezier(0.16, 1, 0.3, 1)" : "none",
                zIndex: 20,
                pointerEvents: "none"
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 10,
                  right: 10,
                  top: 0,
                  height: 5,
                  borderTopLeftRadius: 10,
                  borderTopRightRadius: 10,
                  background: "linear-gradient(90deg, rgba(236,213,144,0.55), rgba(255,245,205,0.78), rgba(236,213,144,0.55))"
                }}
              />
              <img
                src={`http://localhost:5000${displayedAuction.player.photo}`}
                alt={displayedAuction.player.name}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "-93px",
                  transform: "translateX(-50%)",
                  width: "94px",
                  height: "94px",
                  borderRadius: "12px",
                  objectFit: "cover",
                  border: "4px solid #d5bf7e",
                  boxShadow: "0 0 0 3px rgba(22,25,53,0.95), 0 10px 22px rgba(0,0,0,0.45)",
                  background: "#101432"
                }}
              />
              <div style={{
                display: "grid",
                gridTemplateColumns: "1.05fr 1.35fr 1.05fr",
                gap: 8,
                alignItems: "stretch"
              }}>
                <div style={{
                  background: "linear-gradient(180deg, rgba(26,30,66,0.95), rgba(12,14,36,0.95))",
                  border: "1px solid rgba(214,186,116,0.65)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center"
                }}>
                  <div style={{ fontSize: 11, letterSpacing: 0.8, fontWeight: "bold", color: "#d7c48a" }}>ROLE</div>
                  <div style={{ marginTop: 6, fontSize: "clamp(20px, 2.8vw, 34px)", color: "#f1e9cc", lineHeight: 1, fontWeight: "bold", textAlign: "center" }}>
                    {displayedAuction.player.role}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, letterSpacing: 0.8, fontWeight: "bold", color: "#d7c48a" }}>AGE</div>
                  <div style={{ marginTop: 4, fontSize: "clamp(22px, 3vw, 40px)", color: "#f1e9cc", lineHeight: 1, fontWeight: "bold" }}>
                    {displayedAuction.player.age ?? "-"}
                  </div>
                </div>

                <div style={{
                  background: "linear-gradient(180deg, rgba(29,35,82,0.96), rgba(14,17,46,0.96))",
                  border: "1px solid rgba(230,200,126,0.72)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 0
                }}>
                  <div style={{ minWidth: 0, flex: 1, textAlign: "center" }}>
                    <div style={{ color: "#ffffff", fontSize: "clamp(28px, 3.5vw, 50px)", lineHeight: 1.05, fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {displayedAuction.player.name}
                    </div>
                  </div>
                </div>

                <div style={{
                  background: "linear-gradient(180deg, rgba(26,30,66,0.95), rgba(12,14,36,0.95))",
                  border: "1px solid rgba(214,186,116,0.65)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center"
                }}>
                  <div style={{ fontSize: 11, letterSpacing: 0.8, fontWeight: "bold", color: "#d7c48a" }}>CURRENT BID</div>
                  <div style={{ marginTop: 6, fontSize: "clamp(24px, 3.4vw, 42px)", color: "#f1e9cc", lineHeight: 1, fontWeight: "bold" }}>
                    ₹{(displayedAuction.currentBid || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedTeamDetails && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 900
        }}>
          <div style={{
            width: "min(1200px, calc(100% - 24px))",
            height: "96vh",
            overflow: "hidden",
            background: "linear-gradient(180deg, rgba(22,28,70,0.98) 0%, rgba(10,12,32,0.98) 100%)",
            border: "1px solid rgba(225,195,120,0.65)",
            borderRadius: 12,
            padding: 10,
            boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 6
          }}>
            <div style={{ position: "absolute", right: 10, top: 10, display: "flex", gap: 8 }}>
              <button
                onClick={handleSaveTeamDetailsPdf}
                style={{
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 10px",
                  background: "#1d6f42",
                  color: "white",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                Save PDF
              </button>
              <button
                onClick={() => onCloseTeamDetails && onCloseTeamDetails()}
                style={{
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 10px",
                  background: "#8b1e1e",
                  color: "white",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
            <div style={{ color: "#f1e9cc", fontWeight: "bold", marginBottom: 2, paddingRight: 72, flex: "0 0 auto", lineHeight: 1.1 }}>
              Owner: {selectedTeamDetails.owner_name || "-"} | Team: {selectedTeamDetails.team_name || "-"}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", color: "#f8f4df", tableLayout: "fixed", fontSize: teamDetailFontSize, lineHeight: 1 }}>
                <thead>
                  <tr style={{ background: "rgba(17,22,56,0.6)" }}>
                    <th style={{ width: "4%", padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.35)", textAlign: "center", whiteSpace: "nowrap" }}>#</th>
                    <th style={{ width: "6%", padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.35)", textAlign: "left", whiteSpace: "nowrap" }}>Photo</th>
                    <th style={{ width: "18%", padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.35)", textAlign: "left", whiteSpace: "nowrap" }}>Name</th>
                    <th style={{ width: "13%", padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.35)", textAlign: "left", whiteSpace: "nowrap" }}>Role</th>
                    <th style={{ width: "14%", padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.35)", textAlign: "left", whiteSpace: "nowrap" }}>Sold Status</th>
                    <th style={{ width: "13%", padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.35)", textAlign: "right", whiteSpace: "nowrap" }}>Sold Price</th>
                    <th style={{ width: "7%", padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.35)", textAlign: "right", whiteSpace: "nowrap" }}>Age</th>
                    <th style={{ width: "25%", padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.35)", textAlign: "left", whiteSpace: "nowrap" }}>Mobile Number</th>
                  </tr>
                </thead>
                <tbody>
                {teamDetailRows.map((p, idx) => (
                  <tr key={p ? `team-detail-${p.id}` : `empty-${idx}`} style={{ height: teamDetailRowHeight, background: p ? undefined : "rgba(5,6,16,0.7)" }}>
                    <td style={{ padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.25)", textAlign: "center", color: "#f1e9cc", fontWeight: "bold" }}>{idx + 1}</td>
                    <td style={{ padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.25)" }}>
                      {p && <img
                        src={`http://localhost:5000${p.photo}`}
                        alt={p.name}
                        style={{ width: teamDetailImageSize, height: teamDetailImageSize, objectFit: "cover", borderRadius: 4, border: "1px solid rgba(225,195,120,0.6)" }}
                      />}
                    </td>
                    <td style={{ padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.25)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p?.name ?? ""}</td>
                    <td style={{ padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.25)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p?.role ?? ""}</td>
                    <td style={{ padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.25)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p?.sold_status ?? ""}</td>
                    <td style={{ padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.25)", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p != null ? (p.sold_price ?? "-") : ""}</td>
                    <td style={{ padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.25)", textAlign: "right", whiteSpace: "nowrap" }}>{p != null ? (p.age ?? "-") : ""}</td>
                    <td style={{ padding: teamDetailCellPadding, border: "1px solid rgba(225,195,120,0.25)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p?.mobile_number ?? ""}</td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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

          @keyframes auctionCardIn {
            0% {
              opacity: 0;
              transform: translateX(-50%) translateY(34px) scale(0.94);
              filter: blur(2px);
            }
            60% {
              opacity: 1;
              transform: translateX(-50%) translateY(-4px) scale(1.02);
              filter: blur(0);
            }
            100% {
              opacity: 1;
              transform: translateX(-50%) translateY(0) scale(1);
              filter: blur(0);
            }
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
              gap: 8px !important;
            }
          }
        `
      }} />
    </div>
  );
}
