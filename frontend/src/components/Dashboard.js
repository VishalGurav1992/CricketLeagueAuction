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
  const [viewportSize, setViewportSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 720,
  });
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

    const syncViewportSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };

    syncTitleWidth();
    syncViewportSize();
    window.addEventListener("resize", syncTitleWidth);
    window.addEventListener("resize", syncViewportSize);
    return () => {
      window.removeEventListener("resize", syncTitleWidth);
      window.removeEventListener("resize", syncViewportSize);
    };
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

  const isProjectorLayout = viewportSize.width <= 1280 || viewportSize.height <= 720;
  const rootPadding = isProjectorLayout ? 10 : 16;
  const rootGap = isProjectorLayout ? 8 : 12;
  const headerMinHeight = isProjectorLayout ? 40 : 52;
  const titleFontSize = isProjectorLayout ? "clamp(24px, 3.4vw, 42px)" : "clamp(33px, 4.8vw, 57px)";
  const titleLetterSpacing = isProjectorLayout ? "0.5px" : "1px";
  const togglePadding = isProjectorLayout ? "6px 10px" : "8px 12px";
  const toggleFontSize = isProjectorLayout ? "11px" : "12px";
  const tableHeaderFontSize = isProjectorLayout ? "clamp(14px, 1.25vw, 18px)" : "clamp(16px, 1.5vw, 21px)";
  const tableBodyFontSize = isProjectorLayout ? "clamp(15px, 1.3vw, 19px)" : "clamp(17px, 1.6vw, 23px)";
  const tableCellPadding = isProjectorLayout ? "5px" : "6px";
  const teamPanelPadding = isProjectorLayout ? 6 : 8;
  const auctionCardWidth = titleWidth ? Math.round(titleWidth) : viewportSize.width - (rootPadding * 2);
  const auctionNamePanelWidth = Math.max(120, Math.floor((auctionCardWidth * 1.35) / 3.45) - 24);
  const auctionPhotoSize = isProjectorLayout
    ? Math.min(auctionNamePanelWidth, 160)
    : Math.min(auctionNamePanelWidth, 230);
  const auctionPhotoBottom = `calc(8px + ${auctionPhotoSize}px + 10px)`;
  const auctionRoleFont = isProjectorLayout ? "clamp(17px, 2.2vw, 28px)" : "clamp(20px, 2.8vw, 34px)";
  const auctionNameFont = isProjectorLayout ? "clamp(24px, 2.9vw, 40px)" : "clamp(28px, 3.5vw, 50px)";
  const auctionMetricFont = isProjectorLayout ? "clamp(19px, 2.4vw, 32px)" : "clamp(22px, 3vw, 40px)";
  const auctionBidFont = isProjectorLayout ? "clamp(22px, 2.8vw, 36px)" : "clamp(24px, 3.4vw, 42px)";
  const teamPopupPadding = isProjectorLayout ? 6 : 10;
  const teamPopupGap = isProjectorLayout ? 4 : 6;
  const teamPopupButtonPadding = isProjectorLayout ? "5px 8px" : "6px 10px";
  const teamPopupButtonFont = isProjectorLayout ? "12px" : "14px";
  const teamPopupHeadingFont = isProjectorLayout ? "15px" : "17px";
  const teamCardGap = isProjectorLayout ? "4px" : "clamp(4px, 0.7vw, 8px)";
  const teamCardPadding = isProjectorLayout ? "4px 6px" : "6px 8px";
  const teamCardNameFont = isProjectorLayout ? "clamp(11px, 0.95vw, 14px)" : "clamp(12px, 1.05vw, 17px)";
  const teamHeaderNameFont = isProjectorLayout ? "clamp(15.84px, 1.368vw, 20.16px)" : "clamp(17.28px, 1.512vw, 24.48px)";
  const teamPlayerNameFont = isProjectorLayout ? "clamp(14px, 1.2vw, 17px)" : "clamp(15px, 1.3vw, 22px)";
  const teamPlayerMetaFont = isProjectorLayout ? "clamp(11px, 0.95vw, 13px)" : "clamp(12px, 1.05vw, 17px)";
  const teamCardMetaFont = isProjectorLayout ? "clamp(9px, 0.74vw, 11px)" : "clamp(10px, 0.84vw, 13px)";
  const teamCardBadgeSize = isProjectorLayout ? 20 : 24;
  const teamCardBadgeFont = isProjectorLayout ? "11px" : "clamp(11px, 0.9vw, 14px)";
  const teamCardImageSize = isProjectorLayout ? 20 : teamDetailImageSize + 6;
  const teamTableWidth = `${Math.round(Math.min(viewportSize.width * 0.98, viewportSize.width))}px`;
  const selectedTeamLogo = teams.find(
    (t) => String(t.name || "").toLowerCase() === String(selectedTeamDetails?.team_name || "").toLowerCase()
  )?.photo;

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
        padding: rootPadding,
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
        gap: rootGap
      }}
    >
      <div style={{ position: "relative", minHeight: headerMinHeight, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: isProjectorLayout ? 0 : 2 }}>
        <h1 ref={titleRef} className="dashboard-title" style={{
          textAlign: "center",
          color: "#ffffff",
          margin: 0,
          fontSize: titleFontSize,
          lineHeight: 1.05,
          letterSpacing: titleLetterSpacing,
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
            padding: togglePadding,
            fontSize: toggleFontSize,
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
        {/* Teams Cards - 3 columns x 2 rows */}
        <div style={{ flex: "0 0 60%", minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{
            flex: "0 1 auto",
            maxHeight: "100%",
            overflow: "hidden",
            width: teamTableWidth,
            minWidth: teamTableWidth,
            maxWidth: teamTableWidth,
            background: "linear-gradient(180deg, rgba(22,28,70,0.84) 0%, rgba(10,12,32,0.82) 100%)",
            padding: teamPanelPadding,
            borderRadius: 10,
            border: "1px solid rgba(225,195,120,0.6)",
            boxShadow: "0 10px 26px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
            backdropFilter: "blur(2px)"
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gridTemplateRows: "repeat(2, minmax(0, 1fr))",
              gap: teamCardGap,
              minHeight: 0
            }}>
              {teams.slice(0, 6).map((team) => (
                <div
                  key={team.id}
                  style={{
                    position: "relative",
                    background: "linear-gradient(180deg, rgba(22,28,70,0.98) 0%, rgba(10,12,32,0.98) 52%, rgba(7,9,24,0.98) 100%)",
                    border: "1px solid rgba(225,195,120,0.65)",
                    boxShadow: "0 10px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    overflow: "hidden",
                    padding: teamCardPadding,
                    minHeight: 0
                  }}
                >
                  <div style={{
                    position: "absolute",
                    left: 10,
                    right: 10,
                    top: 0,
                    height: 3,
                    background: "linear-gradient(90deg, rgba(236,213,144,0.45), rgba(255,245,205,0.72), rgba(236,213,144,0.45))"
                  }} />

                  <div style={{ display: "flex", alignItems: "center", gap: isProjectorLayout ? 6 : 8, minWidth: 0 }}>
                    <img
                      src={`http://localhost:5000${team.photo}`}
                      alt={team.name}
                      style={{
                        width: isProjectorLayout ? "clamp(34px, 2.8vw, 44px)" : "clamp(40px, 3.4vw, 56px)",
                        height: isProjectorLayout ? "clamp(34px, 2.8vw, 44px)" : "clamp(40px, 3.4vw, 56px)",
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "2px solid rgba(225,195,120,0.9)",
                        background: "#101432",
                        flex: "0 0 auto"
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        color: "#ffffff",
                        fontSize: tableBodyFontSize,
                        lineHeight: 1.08,
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}>
                        {team.name}
                      </div>
                      <div style={{
                        color: "#d7c48a",
                        fontSize: teamCardMetaFont,
                        marginTop: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}>
                        Owner: {team.owner_name || "-"}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    marginTop: isProjectorLayout ? 4 : 6,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: isProjectorLayout ? 4 : 6
                  }}>
                    <div style={{
                      border: "1px solid rgba(225,195,120,0.45)",
                      borderRadius: 6,
                      padding: isProjectorLayout ? "4px 6px" : "5px 7px",
                      background: "rgba(8,10,24,0.6)"
                    }}>
                      <div style={{ color: "#d7c48a", fontSize: tableHeaderFontSize, lineHeight: 1, fontWeight: "bold" }}>BALANCE</div>
                      <div style={{ color: "#f1e9cc", marginTop: 2, fontSize: tableBodyFontSize, lineHeight: 1.05, fontWeight: "bold" }}>
                        {Number(team.balance || 0).toLocaleString()}
                      </div>
                    </div>
                    <div style={{
                      border: "1px solid rgba(225,195,120,0.45)",
                      borderRadius: 6,
                      padding: isProjectorLayout ? "4px 6px" : "5px 7px",
                      background: "rgba(8,10,24,0.6)"
                    }}>
                      <div style={{ color: "#d7c48a", fontSize: tableHeaderFontSize, lineHeight: 1, fontWeight: "bold" }}>PLAYERS</div>
                      <div style={{ color: "#f1e9cc", marginTop: 2, fontSize: tableBodyFontSize, lineHeight: 1.05, fontWeight: "bold" }}>
                        {getTeamPlayerCount(team.id)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Auction Zone - 40% height */}
        <div style={{ flex: "0 0 40%", minHeight: 0, position: "relative" }}>
          {displayedAuction?.player && (
            <>
              {/* Auction Card */}
              <div
                key={`${displayedAuction.player.id}-${auctionCardAnimSeed}`}
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: "8px",
                  width: titleWidth ? `${Math.round(titleWidth)}px` : "100%",
                  transform: showAuctionCard ? "translateX(-50%) translateY(0) scale(1)" : "translateX(-50%) translateY(28px) scale(0.98)",
                  opacity: showAuctionCard ? 1 : 0,
                  transition: "transform 300ms ease, opacity 300ms ease",
                  animation: showAuctionCard ? "auctionCardIn 420ms cubic-bezier(0.16, 1, 0.3, 1)" : "none",
                  zIndex: 20,
                  pointerEvents: "none",
                  boxShadow: "0 18px 48px rgba(0,0,0,0.52)"
                }}
              >
                <img
                  src={`http://localhost:5000${displayedAuction.player.photo}`}
                  alt={displayedAuction.player.name}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: `-${auctionPhotoSize}px`,
                    transform: "translateX(-50%)",
                    width: `${auctionPhotoSize}px`,
                    height: `${auctionPhotoSize}px`,
                    borderRadius: 0,
                    objectFit: "cover",
                    border: "1.5px solid rgba(225,195,120,0.85)",
                    boxShadow: "0 0 0 1px rgba(225,195,120,0.35), 0 10px 22px rgba(0,0,0,0.45)",
                    background: "#101432",
                    zIndex: 21
                  }}
                />
                {/* Dark background content — clipped to trapezoid */}
                <div style={{
                  clipPath: "polygon(0% 0%, 100% 0%, 92% 100%, 8% 100%)",
                  background: "linear-gradient(180deg, rgba(22,28,70,0.98) 0%, rgba(10,12,32,0.98) 52%, rgba(7,9,24,0.98) 100%)",
                  padding: "0 10px 10px",
                  position: "relative"
                }}>
                  <div style={{
                    position: "absolute", left: 10, right: 10, top: 0, height: 5,
                    background: "linear-gradient(90deg, rgba(236,213,144,0.55), rgba(255,245,205,0.78), rgba(236,213,144,0.55))"
                  }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.35fr 1.05fr", gap: 8, alignItems: "stretch" }}>
                    <div style={{ background: "linear-gradient(180deg, rgba(26,30,66,0.95), rgba(12,14,36,0.95))", border: "1px solid rgba(214,186,116,0.65)", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                      <div style={{ fontSize: 11, letterSpacing: 0.8, fontWeight: "bold", color: "#d7c48a" }}>ROLE</div>
                      <div style={{ marginTop: 6, fontSize: auctionRoleFont, color: "#f1e9cc", lineHeight: 1, fontWeight: "bold", textAlign: "center" }}>
                        {displayedAuction.player.role}
                      </div>
                      <div style={{ marginTop: 10, fontSize: 11, letterSpacing: 0.8, fontWeight: "bold", color: "#d7c48a" }}>AGE</div>
                      <div style={{ marginTop: 4, fontSize: auctionMetricFont, color: "#f1e9cc", lineHeight: 1, fontWeight: "bold" }}>
                        {displayedAuction.player.age ?? "-"}
                      </div>
                    </div>
                    <div style={{ background: "linear-gradient(180deg, rgba(29,35,82,0.96), rgba(14,17,46,0.96))", border: "1px solid rgba(230,200,126,0.72)", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0 }}>
                      <div style={{ minWidth: 0, flex: 1, textAlign: "center" }}>
                        <div style={{ color: "#ffffff", fontSize: auctionNameFont, lineHeight: 1.05, fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {displayedAuction.player.name}
                        </div>
                      </div>
                    </div>
                    <div style={{ background: "linear-gradient(180deg, rgba(26,30,66,0.95), rgba(12,14,36,0.95))", border: "1px solid rgba(214,186,116,0.65)", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                      <div style={{ fontSize: 11, letterSpacing: 0.8, fontWeight: "bold", color: "#d7c48a" }}>CURRENT BID</div>
                      <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: "4px", justifyContent: "center" }}>
                        <div style={{ fontSize: auctionBidFont, color: "#f1e9cc", lineHeight: 1, fontWeight: "bold" }}>
                          {(displayedAuction.currentBid || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: "clamp(8px, 0.8vw, 12px)", color: "#f1e9cc", fontWeight: "500" }}>coins</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* SVG border overlay — sits on top, not clipped, follows trapezoid exactly */}
                <svg
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <polygon
                    points="0,0 100,0 92,100 8,100"
                    fill="none"
                    stroke="rgba(225,195,120,0.85)"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
            </>
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
          alignItems: "stretch",
          justifyContent: "stretch",
          zIndex: 900,
          animation: "teamDetailsBackdropIn 420ms ease-out"
        }}>
          <div
            key={`team-details-${selectedTeamDetails.team_name || selectedTeamDetails.owner_name || "selected"}`}
            style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "hidden",
            background: "linear-gradient(180deg, rgba(22,28,70,0.98) 0%, rgba(10,12,32,0.98) 100%)",
            border: "1px solid rgba(225,195,120,0.65)",
            borderRadius: 0,
            padding: teamPopupPadding,
            boxSizing: "border-box",
            boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
            display: "flex",
            flexDirection: "column",
            gap: teamPopupGap,
            animation: "teamDetailsModalIn 2200ms cubic-bezier(0.22, 1, 0.36, 1)"
          }}>
            <div style={{ position: "absolute", right: 10, top: 10, display: "flex", gap: 8 }}>
              <button
                onClick={handleSaveTeamDetailsPdf}
                style={{
                  border: "none",
                  borderRadius: 6,
                  padding: teamPopupButtonPadding,
                  background: "#1d6f42",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: teamPopupButtonFont,
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
                  padding: teamPopupButtonPadding,
                  background: "#8b1e1e",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: teamPopupButtonFont,
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden", paddingRight: 0 }}>
              <div style={{
                display: "grid",
                gridTemplateRows: "1fr 5fr",
                gap: teamCardGap,
                height: "100%"
              }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: teamCardGap,
                  minHeight: 0
                }}>
                  <div />
                  <div style={{
                    position: "relative",
                    padding: teamCardPadding,
                    minHeight: 0,
                    display: "grid",
                    gridTemplateRows: "80% 20%",
                    alignItems: "stretch",
                    gap: 0
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
                      {selectedTeamLogo ? (
                        <div style={{
                          height: "100%",
                          maxHeight: "100%",
                          aspectRatio: "1 / 1",
                          overflow: "hidden"
                        }}>
                          <img
                            src={`http://localhost:5000${selectedTeamLogo}`}
                            alt={selectedTeamDetails.team_name || "Team"}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        </div>
                      ) : (
                        <div style={{
                          height: "100%",
                          maxHeight: "100%",
                          aspectRatio: "1 / 1",
                          background: "transparent"
                        }} />
                      )}
                    </div>
                    <div style={{
                      width: "100%",
                      color: "#f1e9cc",
                      fontWeight: "bold",
                      fontSize: teamHeaderNameFont,
                      lineHeight: 1.05,
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}>
                      {selectedTeamDetails.team_name || "-"}
                    </div>
                  </div>
                  <div />
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gridTemplateRows: "repeat(5, minmax(0, 1fr))",
                  gap: teamCardGap,
                  minHeight: 0
                }}>
                {teamDetailRows.map((p, idx) => (
                  <div
                    key={p ? `team-detail-${p.id}` : `empty-${idx}`}
                    style={{
                      position: "relative",
                      background: p
                        ? "linear-gradient(180deg, rgba(22,28,70,0.98) 0%, rgba(10,12,32,0.98) 52%, rgba(7,9,24,0.98) 100%)"
                        : "linear-gradient(180deg, rgba(10,12,26,0.85) 0%, rgba(6,8,18,0.9) 100%)",
                      border: "1px solid rgba(225,195,120,0.65)",
                      boxShadow: "0 10px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
                      borderRadius: 10,
                      overflow: "hidden",
                      padding: teamCardPadding,
                      minHeight: 0
                    }}
                  >
                    <div style={{
                      position: "absolute",
                      left: 10,
                      right: 10,
                      top: 0,
                      height: 3,
                      background: "linear-gradient(90deg, rgba(236,213,144,0.45), rgba(255,245,205,0.72), rgba(236,213,144,0.45))"
                    }} />
                    <div style={{
                      position: "absolute",
                      left: 6,
                      top: 6,
                      minWidth: teamCardBadgeSize,
                      height: teamCardBadgeSize,
                      borderRadius: 10,
                      border: "1px solid rgba(225,195,120,0.7)",
                      color: "#f1e9cc",
                      fontWeight: "bold",
                      fontSize: teamCardBadgeFont,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(8,10,24,0.9)",
                      zIndex: 2
                    }}>
                      {idx + 1}
                    </div>

                    <div style={{ display: "flex", alignItems: "stretch", gap: isProjectorLayout ? 4 : 6, height: "100%", minHeight: 0 }}>

                      {p ? (
                        <div style={{
                          height: "100%",
                          minHeight: 0,
                          aspectRatio: "1 / 1",
                          borderRadius: 5,
                          border: "1px solid rgba(225,195,120,0.7)",
                          overflow: "hidden",
                          background: "#101432"
                        }}>
                          <img
                            src={`http://localhost:5000${p.photo}`}
                            alt={p.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block"
                            }}
                          />
                        </div>
                      ) : (
                        <div style={{
                          height: "100%",
                          minHeight: 0,
                          aspectRatio: "1 / 1",
                          borderRadius: 5,
                          border: "1px solid rgba(225,195,120,0.25)",
                          background: "rgba(4,5,12,0.8)"
                        }} />
                      )}

                      <div style={{ minWidth: 0, flex: 1, paddingTop: 2 }}>
                        <div style={{
                          color: "#ffffff",
                          fontSize: teamPlayerNameFont,
                          lineHeight: 1.12,
                          fontWeight: "bold",
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}>
                          {p?.name || "Empty Slot"}
                        </div>
                        <div style={{
                          color: "#d7c48a",
                          fontSize: teamPlayerMetaFont,
                          lineHeight: 1.12,
                          marginTop: 1,
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}>
                          {p ? `${p.role || "-"} | ${p.sold_status || "-"}` : "Unfilled"}
                        </div>
                        <div style={{
                          marginTop: 1,
                          color: "#f1e9cc",
                          fontSize: teamPlayerMetaFont,
                          lineHeight: 1.12,
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}>
                          {p ? `Price: ${p.sold_price ?? "-"} | Age: ${p.age ?? "-"}` : "Price: - | Age: -"}
                        </div>
                        <div style={{
                          marginTop: 1,
                          color: "#aeb7d6",
                          fontSize: teamPlayerMetaFont,
                          lineHeight: 1.1,
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}>
                          {p?.mobile_number || "Mobile: -"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              </div>
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

          @keyframes teamDetailsBackdropIn {
            0% {
              opacity: 0;
            }
            100% {
              opacity: 1;
            }
          }

          @keyframes teamDetailsModalIn {
            0% {
              opacity: 0;
              transform: translateY(22px) scale(0.965);
              filter: blur(1px);
            }
            60% {
              opacity: 1;
              transform: translateY(-2px) scale(1.006);
              filter: blur(0);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
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
