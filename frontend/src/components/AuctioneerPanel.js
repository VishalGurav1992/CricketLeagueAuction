import React, { useState, useEffect, useRef } from "react";
import { sellPlayer, selectPlayerForAuction, updateBid, markPlayerUnsold, relistPlayer, undoUnsold } from "../api";

export default function AuctioneerPanel({ teams, players, socket, setTeams, setPlayers, onShowTeams, onShowTeamDetails }) {
  const TEAM_MAX_PLAYERS = 15;
  const MIN_PLAYER_COST = 1000;
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [bid, setBid] = useState(0);
  const [message, setMessage] = useState("");
  const [selectionMode, setSelectionMode] = useState("auto");
  const [lastAction, setLastAction] = useState(null); // { type: 'sold'|'unsold', playerId, playerName, teamId?, price?, previousCategory? }
  const [pendingNextPlayerId, setPendingNextPlayerId] = useState(null);
  const [awaitingSellConfirmation, setAwaitingSellConfirmation] = useState(false);
  const [countdownValue, setCountdownValue] = useState(null);
  const [isAuctionComplete, setIsAuctionComplete] = useState(false);
  const [showLogo, setShowLogo] = useState(false);
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(false);
  const [leagueAudioEnabled, setLeagueAudioEnabled] = useState(false);
  const heartbeatEnabledRef = useRef(false);
  const leagueAudioEnabledRef = useRef(false);
  const bidClickCountRef = useRef(0);
  const heartbeatIntervalRef = useRef(null);
  const audioCtxRef = useRef(null);
  const heartbeatAudioRef = useRef(null);
  const leagueAudioRef = useRef(null);
  const soldAudioRef = useRef(null);
  const auctionCompleteAlertShownRef = useRef(false);

  const isExtraPlayer = (player) => {
    const playerId = Number(player?.id || 0);
    return playerId >= 83 && playerId <= 90;
  };

  const getPlayerCategory = (player) => {
    const category = String(player?.auction_category || "NEW").toUpperCase();
    if (category === "EXTRA PLAYER" || isExtraPlayer(player)) return "EXTRA PLAYER";
    if (category === "RELIST") return "RELIST";
    if (category === "UNSOLD") return "UNSOLD";
    return "NEW";
  };

  const splitByAutoSequence = (available) => {
    const newPlayers = available.filter((p) => getPlayerCategory(p) === "NEW");
    const extraPlayers = available.filter((p) => getPlayerCategory(p) === "EXTRA PLAYER");
    const relistPlayers = available.filter((p) => getPlayerCategory(p) === "RELIST");
    const unsoldPlayers = available.filter((p) => getPlayerCategory(p) === "UNSOLD");
    return { newPlayers, extraPlayers, relistPlayers, unsoldPlayers };
  };

  const getAuctionCategoryOrder = (player) => {
    const category = getPlayerCategory(player);
    if (category === "NEW") return 0;
    if (category === "EXTRA PLAYER") return 1;
    if (category === "RELIST") return 2;
    if (category === "UNSOLD") return 3;
    return 4;
  };

  const getAvailablePlayers = () => {
    return players
      .filter(p => !p.sold_to_team && String(p.role || "").toLowerCase() !== "captain")
      .sort((a, b) => {
        const categoryDiff = getAuctionCategoryOrder(a) - getAuctionCategoryOrder(b);
        if (categoryDiff !== 0) return categoryDiff;
        return Number(a.id) - Number(b.id);
      });
  };

  const getPlayerAuctionCategory = (player) => {
    const category = getPlayerCategory(player);
    if (category === "UNSOLD") return "UNSOLD";
    if (category === "RELIST") return "RELIST PLAYER";
    if (category === "EXTRA PLAYER") return "EXTRA PLAYER";
    return "NEW TO AUCTION";
  };

  // Pick next player: NEW (1-82) first, then EXTRA PLAYER (83-90), then RELIST, then UNSOLD.
  const pickNextPlayer = (excludeId) => {
    const available = getAvailablePlayers().filter(p => p.id != excludeId);
    const { newPlayers, extraPlayers, relistPlayers, unsoldPlayers } = splitByAutoSequence(available);
    const pool = newPlayers.length > 0
      ? newPlayers
      : (extraPlayers.length > 0 ? extraPlayers : (relistPlayers.length > 0 ? relistPlayers : unsoldPlayers));
    return pool.length > 0 ? String(pool[Math.floor(Math.random() * pool.length)].id) : null;
  };

  useEffect(() => {
    const teamsWithMaxPlayers = teams.filter((team) =>
      players.filter((player) => Number(player.sold_to_team) === Number(team.id)).length >= TEAM_MAX_PLAYERS
    ).length;
    const allTeamsFilled = teams.length > 0 && teamsWithMaxPlayers === teams.length;

    setIsAuctionComplete(allTeamsFilled);

    if (allTeamsFilled && !auctionCompleteAlertShownRef.current) {
      auctionCompleteAlertShownRef.current = true;
      setAwaitingSellConfirmation(false);
      setPendingNextPlayerId(null);
      setCountdownValue(null);
      setSelectedPlayer(null);
      setSelectedTeam(null);
      setBid(0);
      setMessage("Auction complete: all teams have 15 players.");
      window.alert("Auction complete: all teams now have 15 players each.");
    }

    if (!allTeamsFilled) {
      auctionCompleteAlertShownRef.current = false;
    }
  }, [teams, players]);

  // Keep selected player valid for the active mode.
  useEffect(() => {
    if (awaitingSellConfirmation) {
      return;
    }

    if (isAuctionComplete) {
      setSelectedPlayer(null);
      setBid(0);
      return;
    }

    const availablePlayers = getAvailablePlayers();

    if (!availablePlayers.length) {
      setSelectedPlayer(null);
      setBid(0);
      return;
    }

    const currentStillAvailable = selectedPlayer && availablePlayers.some(p => p.id == selectedPlayer);
    if (selectionMode === "manual") {
      if (!currentStillAvailable) {
        setSelectedPlayer(null);
      }
      return;
    }

    if (!currentStillAvailable) {
      const { newPlayers, extraPlayers, relistPlayers, unsoldPlayers } = splitByAutoSequence(availablePlayers);
      const pool = newPlayers.length > 0
        ? newPlayers
        : (extraPlayers.length > 0 ? extraPlayers : (relistPlayers.length > 0 ? relistPlayers : unsoldPlayers));
      if (pool.length > 0) {
        setSelectedPlayer(String(pool[Math.floor(Math.random() * pool.length)].id));
      } else {
        setSelectedPlayer(null);
      }
    }
  }, [players, selectedPlayer, selectionMode, awaitingSellConfirmation, isAuctionComplete]);

  // Reset heartbeat and click count when player changes
  useEffect(() => {
    stopHeartbeat();
    bidClickCountRef.current = 0;
  }, [selectedPlayer]);

  // Keep auctioneer selection in sync with the dashboard-selected player.
  useEffect(() => {
    if (!socket) return;

    const handlePlayerSelectedSync = (data) => {
      const playerId = data?.player?.id;
      if (playerId == null) return;
      setSelectedPlayer(String(playerId));
    };

    socket.on("playerSelected", handlePlayerSelectedSync);
    return () => {
      socket.off("playerSelected", handlePlayerSelectedSync);
    };
  }, [socket]);

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

  const getSellBalanceWarning = (teamId, finalBid) => {
    const team = teams.find((entry) => Number(entry.id) === Number(teamId));
    if (!team) return null;

    const currentPlayerCount = players.filter((player) => Number(player.sold_to_team) === Number(teamId)).length;
    const projectedPlayerCount = currentPlayerCount + 1;
    const remainingSlots = Math.max(0, TEAM_MAX_PLAYERS - projectedPlayerCount);
    const balanceAfterSale = Number(team.balance || 0) - Number(finalBid || 0);
    const minimumRequiredBalance = remainingSlots * MIN_PLAYER_COST;

    if (balanceAfterSale >= minimumRequiredBalance) {
      return null;
    }

    const shortfall = minimumRequiredBalance - balanceAfterSale;
    return {
      teamId: Number(team.id),
      teamName: team.name,
      currentPlayerCount,
      projectedPlayerCount,
      remainingSlots,
      finalBid: Number(finalBid || 0),
      balanceAfterSale,
      minimumRequiredBalance,
      shortfall,
      message: `${team.name} will have only Rs.${balanceAfterSale.toLocaleString('en-IN')} left after this sale, but needs at least Rs.${minimumRequiredBalance.toLocaleString('en-IN')} to complete the remaining ${remainingSlots} players. Shortfall: Rs.${shortfall.toLocaleString('en-IN')}. If you continue, the team might later need to sell its current top player.`
    };
  };

  const handleSell = async () => {
    if (isAuctionComplete) {
      setMessage("Auction already complete.");
      return;
    }
    if (!selectedPlayer || !selectedTeam || bid <= 0) return;
    const balanceWarning = getSellBalanceWarning(selectedTeam, bid);
    if (balanceWarning && socket) {
      socket.emit("teamBalanceWarning", balanceWarning);
    }
    const confirmationMessage = balanceWarning
      ? `${balanceWarning.message}\n\nDo you still want to sell this player?`
      : "Are you sure you want to sell this player?";
    const confirmed = window.confirm(confirmationMessage);
    if (!confirmed) return;
    stopHeartbeat();
    heartbeatEnabledRef.current = false;
    setHeartbeatEnabled(false);
    bidClickCountRef.current = 0;

    const nextPlayerId = selectionMode === "auto" ? pickNextPlayer(selectedPlayer) : null;

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

      playSoldSound();

      if (response.updatedTeam) {
        setTeams(prevTeams => prevTeams.map(t => t.id == response.updatedTeam.id ? response.updatedTeam : t));
      }
      if (response.updatedPlayer) {
        setPlayers(prevPlayers => prevPlayers.map(p => p.id == response.updatedPlayer.id ? response.updatedPlayer : p));
      }
      const soldPlayerName = players.find(p => p.id == playerIdToSell)?.name || `Player #${playerIdToSell}`;
      setLastAction({ type: 'sold', playerId: playerIdToSell, playerName: soldPlayerName, teamId: teamIdToSell, price: finalBid });
      setPendingNextPlayerId(nextPlayerId);
      setAwaitingSellConfirmation(true);
      setSelectedTeam(null);
      setMessage("Player sold! Confirm in Auctioneer Panel to continue.");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("Error selling player");
    }
  };

  const handleConfirmNextPlayer = () => {
    if (isAuctionComplete) {
      setMessage("Auction already complete.");
      return;
    }
    if (!awaitingSellConfirmation) return;

    if (socket) {
      socket.emit("startNextPlayerTransition", { seconds: 3, stepMs: 1250 });
    }

    setCountdownValue(3);
    setMessage("");

    let remaining = 3;
    const intervalId = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdownValue(remaining);
        return;
      }

      clearInterval(intervalId);
      setCountdownValue(null);
      setAwaitingSellConfirmation(false);
      const resolvedNextPlayerId = pendingNextPlayerId || (selectionMode === "auto" ? pickNextPlayer(selectedPlayer) : null);
      setSelectedPlayer(resolvedNextPlayerId);
      setPendingNextPlayerId(null);
      if (!resolvedNextPlayerId) {
        setBid(0);
      }
    }, 1250);
  };

  const handleUnsold = async () => {
    if (isAuctionComplete) {
      setMessage("Auction already complete.");
      return;
    }
    if (!selectedPlayer) return;
    const confirmed = window.confirm("Are you sure you want to mark this player as unsold?");
    if (!confirmed) return;
    stopHeartbeat();
    heartbeatEnabledRef.current = false;
    setHeartbeatEnabled(false);
    bidClickCountRef.current = 0;

    try {
      const response = await markPlayerUnsold(selectedPlayer);
      if (response?.error) {
        setMessage(response.error);
        setTimeout(() => setMessage(""), 3000);
        return;
      }

      if (response.updatedPlayer) {
        setPlayers(prevPlayers => prevPlayers.map(p => p.id == response.updatedPlayer.id ? response.updatedPlayer : p));
      }

      const unsoldPlayerName = players.find(p => p.id == selectedPlayer)?.name || `Player #${selectedPlayer}`;
      const prevCat = players.find(p => p.id == selectedPlayer)?.auction_category || 'NEW';
      setLastAction({ type: 'unsold', playerId: selectedPlayer, playerName: unsoldPlayerName, previousCategory: prevCat });

      const nextPlayerId = selectionMode === "auto" ? pickNextPlayer(selectedPlayer) : null;
      setPendingNextPlayerId(nextPlayerId);
      setAwaitingSellConfirmation(true);
      setSelectedTeam(null);

      setMessage("Player moved to unsold pool. Confirm in Auctioneer Panel to continue.");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("Error moving player to unsold pool");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleUndo = async () => {
    if (!lastAction) return;
    const undoActionLabel = lastAction.type === 'sold' ? 'sell' : 'unsold';
    const confirmed = window.confirm(`Are you sure you want to undo the last ${undoActionLabel} action for ${lastAction.playerName}?`);
    if (!confirmed) return;
    try {
      if (lastAction.type === 'sold') {
        const response = await relistPlayer(lastAction.playerId, { skipTeamBlock: true });
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

        const restoredPlayerId = String(lastAction.playerId);
        const restoredBid = Number(lastAction.price || 0);

        // Cancel any pending next-player transition and restore this player as active auction.
        setAwaitingSellConfirmation(false);
        setPendingNextPlayerId(null);
        setCountdownValue(null);
        setSelectedTeam(null);
        setSelectedPlayer(restoredPlayerId);
        setBid(restoredBid);

        await selectPlayerForAuction(restoredPlayerId);
        if (restoredBid > 0) {
          await updateBid(restoredBid);
        }

        setMessage(`Undo: ${lastAction.playerName} returned to auction pool.`);
      } else if (lastAction.type === 'unsold') {
        const response = await undoUnsold(lastAction.playerId, lastAction.previousCategory);
        if (response?.error) {
          setMessage(response.error);
          setTimeout(() => setMessage(""), 3000);
          return;
        }
        if (response.updatedPlayer) {
          setPlayers(prevPlayers => prevPlayers.map(p => p.id == response.updatedPlayer.id ? response.updatedPlayer : p));
        }
        setMessage(`Undo: ${lastAction.playerName} restored from unsold.`);
      }
      setLastAction(null);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage("Error undoing last action");
      setTimeout(() => setMessage(""), 3000);
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

  const toggleHeartbeat = () => {
    const next = !heartbeatEnabledRef.current;
    heartbeatEnabledRef.current = next;
    setHeartbeatEnabled(next);
    if (next) {
      // Create and play directly in the user gesture handler
      if (!heartbeatAudioRef.current) {
        heartbeatAudioRef.current = new Audio('/sounds/heartbeat.mp3');
        heartbeatAudioRef.current.loop = true;
        heartbeatAudioRef.current.volume = 0.85;
      }
      heartbeatAudioRef.current.currentTime = 0;
      heartbeatAudioRef.current.play();
    } else {
      stopHeartbeat();
    }
  };

  const stopLeagueAudio = () => {
    if (leagueAudioRef.current) {
      leagueAudioRef.current.pause();
      leagueAudioRef.current.currentTime = 0;
    }
  };

  const playSoldSound = () => {
    if (!soldAudioRef.current) {
      soldAudioRef.current = new Audio('/sounds/sold_sound.mp3');
      soldAudioRef.current.volume = 1;
    }
    soldAudioRef.current.currentTime = 0;
    soldAudioRef.current.play().catch(() => {});
  };

  const toggleLeagueAudio = () => {
    const next = !leagueAudioEnabledRef.current;
    leagueAudioEnabledRef.current = next;
    setLeagueAudioEnabled(next);

    if (next) {
      if (!leagueAudioRef.current) {
        leagueAudioRef.current = new Audio('/sounds/league_audio.mpeg');
        leagueAudioRef.current.loop = true;
        leagueAudioRef.current.volume = 0.7;
      }
      leagueAudioRef.current.currentTime = 0;
      leagueAudioRef.current.play().catch(() => {});
    } else {
      stopLeagueAudio();
    }
  };

  const playOneBeat = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    // S1 "LUB" - deep thump
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(200, now);
    o1.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    g1.gain.setValueAtTime(1.0, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    o1.connect(g1); g1.connect(ctx.destination);
    o1.start(now); o1.stop(now + 0.22);

    // S2 "dub" - softer echo 200ms later
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(160, now + 0.2);
    o2.frequency.exponentialRampToValueAtTime(40, now + 0.38);
    g2.gain.setValueAtTime(0.55, now + 0.2);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    o2.connect(g2); g2.connect(ctx.destination);
    o2.start(now + 0.2); o2.stop(now + 0.4);

    // Noise click at S1 attack for realism
    const bufSize = Math.ceil(ctx.sampleRate * 0.025);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1);
    const ns = ctx.createBufferSource();
    ns.buffer = buf;
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass'; nf.frequency.value = 300;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.35, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    ns.connect(nf); nf.connect(ng); ng.connect(ctx.destination);
    ns.start(now); ns.stop(now + 0.025);
  };

  const startHeartbeat = () => {
    if (!heartbeatEnabledRef.current) return;
    if (heartbeatAudioRef.current && !heartbeatAudioRef.current.paused) return;
    if (!heartbeatAudioRef.current) {
      heartbeatAudioRef.current = new Audio('/sounds/heartbeat.mp3');
      heartbeatAudioRef.current.loop = true;
      heartbeatAudioRef.current.volume = 0.85;
    }
    heartbeatAudioRef.current.currentTime = 0;
    heartbeatAudioRef.current.play().catch(() => {});
  };

  const stopHeartbeat = () => {
    if (heartbeatAudioRef.current) {
      heartbeatAudioRef.current.pause();
      heartbeatAudioRef.current.currentTime = 0;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopHeartbeat();
      stopLeagueAudio();
      if (soldAudioRef.current) {
        soldAudioRef.current.pause();
        soldAudioRef.current.currentTime = 0;
      }
    };
  }, []);

  const incrementBid = (amount) => {
    setBid(prevBid => prevBid + amount);
    bidClickCountRef.current += 1;
    if (bidClickCountRef.current > 5) {
      startHeartbeat();
    }
  };

  const decrementBid = (amount) => {
    setBid(prevBid => Math.max(0, prevBid - amount));
  };

  const handleTeamDetailsClick = (teamId) => {
    if (onShowTeamDetails) {
      onShowTeamDetails(teamId);
      return;
    }
    if (!socket) return;
    socket.emit("selectTeamForDashboard", { teamId });
  };

  return (
    <div style={{ flex: 1, padding: 20, background: "#f4f4f4", position: "relative", overflowY: "auto", maxHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Auctioneer Panel</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#222", borderRadius: 20, padding: "6px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}>
            <span style={{ color: "#f1e9cc", fontSize: 13, fontWeight: "bold", letterSpacing: 0.5 }}>🖼️ Show Logo</span>
            <div
              onClick={() => {
                const next = !showLogo;
                setShowLogo(next);
                if (socket) socket.emit("toggleLogoOverlay", { show: next });
              }}
              style={{
                width: 44, height: 24, borderRadius: 12, cursor: "pointer", position: "relative",
                background: showLogo ? "#7b2ff7" : "#555",
                transition: "background 0.25s",
                boxShadow: showLogo ? "0 0 8px rgba(123,47,247,0.7)" : "none"
              }}
            >
              <div style={{
                position: "absolute", top: 3, left: showLogo ? 23 : 3,
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                transition: "left 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)"
              }} />
            </div>
            <span style={{ color: showLogo ? "#a97dff" : "#888", fontSize: 12, fontWeight: "bold", minWidth: 24 }}>
              {showLogo ? "ON" : "OFF"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#222", borderRadius: 20, padding: "6px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}>
            <span style={{ color: "#f1e9cc", fontSize: 13, fontWeight: "bold", letterSpacing: 0.5 }}>❤️ Heartbeat</span>
            <div
              onClick={toggleHeartbeat}
              style={{
                width: 44, height: 24, borderRadius: 12, cursor: "pointer", position: "relative",
                background: heartbeatEnabled ? "#e53935" : "#555",
                transition: "background 0.25s",
                boxShadow: heartbeatEnabled ? "0 0 8px rgba(229,57,53,0.7)" : "none"
              }}
            >
              <div style={{
                position: "absolute", top: 3, left: heartbeatEnabled ? 23 : 3,
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                transition: "left 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)"
              }} />
            </div>
            <span style={{ color: heartbeatEnabled ? "#e53935" : "#888", fontSize: 12, fontWeight: "bold", minWidth: 24 }}>
              {heartbeatEnabled ? "ON" : "OFF"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#222", borderRadius: 20, padding: "6px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}>
            <span style={{ color: "#f1e9cc", fontSize: 13, fontWeight: "bold", letterSpacing: 0.5 }}>League Audio</span>
            <div
              onClick={toggleLeagueAudio}
              style={{
                width: 44, height: 24, borderRadius: 12, cursor: "pointer", position: "relative",
                background: leagueAudioEnabled ? "#198754" : "#555",
                transition: "background 0.25s",
                boxShadow: leagueAudioEnabled ? "0 0 8px rgba(25,135,84,0.7)" : "none"
              }}
            >
              <div style={{
                position: "absolute", top: 3, left: leagueAudioEnabled ? 23 : 3,
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                transition: "left 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)"
              }} />
            </div>
            <span style={{ color: leagueAudioEnabled ? "#198754" : "#888", fontSize: 12, fontWeight: "bold", minWidth: 24 }}>
              {leagueAudioEnabled ? "ON" : "OFF"}
            </span>
          </div>
        </div>
      </div>
      {message && <p style={{ color: message.includes("Error") ? "red" : "green", fontWeight: "bold" }}>{message}</p>}
      
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>Player Selection Mode:</label>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <button
            onClick={() => setSelectionMode("auto")}
            disabled={isAuctionComplete}
            style={{
              flex: 1,
              padding: "8px 10px",
              border: "none",
              borderRadius: "4px",
              color: "white",
              fontWeight: "bold",
              background: selectionMode === "auto" ? "#0d6efd" : "#6c757d"
            }}
          >
            Auto Sequence (Random)
          </button>
          <button
            onClick={() => setSelectionMode("manual")}
            disabled={isAuctionComplete}
            style={{
              flex: 1,
              padding: "8px 10px",
              border: "none",
              borderRadius: "4px",
              color: "white",
              fontWeight: "bold",
              background: selectionMode === "manual" ? "#198754" : "#6c757d"
            }}
          >
            Manual Selection
          </button>
        </div>

        {selectionMode === "manual" && (
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>Choose Player:</label>
            <select
              onChange={e => setSelectedPlayer(e.target.value || null)}
              value={selectedPlayer || ""}
              disabled={isAuctionComplete}
              style={{ width: "100%", padding: "8px" }}
            >
              <option value="">Select Player</option>
              {getAvailablePlayers().map((p) => {
                return (
                  <option key={p.id} value={p.id}>
                    #{p.id} - {p.name} ({getPlayerAuctionCategory(p)})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>
          Current Player ({selectionMode === "auto" ? "Auto Sequence" : "Manual Selection"}):
        </label>
        {selectedPlayer ? (
          <div style={{ width: "100%", padding: "10px", marginBottom: 10, background: "#fff", border: "1px solid #ced4da", borderRadius: "4px" }}>
            {(() => {
              const player = players.find(p => p.id == selectedPlayer);
              if (!player) return "Loading player...";
              return `#${player.id} - ${player.name} - ${getPlayerAuctionCategory(player)}`;
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
          disabled={isAuctionComplete}
          style={{ width: "100%", padding: "8px", marginBottom: 10 }}
        >
          <option value="">Select Team</option>
          {teams.map(t => {
            const currentPlayerObj = players.find(p => p.id == selectedPlayer);
            const isBlocked = !!currentPlayerObj?.relist_blocked_team_id &&
              Number(currentPlayerObj.relist_blocked_team_id) === Number(t.id);
            return (
              <option key={t.id} value={t.id} disabled={isBlocked}>
                {t.name} (Balance: ₹{t.balance}){isBlocked ? ' — BLOCKED' : ''}
              </option>
            );
          })}
        </select>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>Bid Amount:</label>
        <input 
          type="number" 
          placeholder="Bid Amount" 
          onChange={e => setBid(Number(e.target.value))} 
          value={bid || ""} 
          disabled={isAuctionComplete}
          style={{ width: "100%", padding: "8px", marginBottom: 10 }}
        />
        
        <div style={{ display: "flex", gap: "10px", marginBottom: 10 }}>
          <button 
            onClick={() => incrementBid(1000)} 
            disabled={isAuctionComplete}
            style={{ flex: 1, padding: "10px", background: "#28a745", color: "white", border: "none", borderRadius: "4px" }}
          >
            +₹1000
          </button>
          <button 
            onClick={() => incrementBid(2000)} 
            disabled={isAuctionComplete}
            style={{ flex: 1, padding: "10px", background: "#007bff", color: "white", border: "none", borderRadius: "4px" }}
          >
            +₹2000
          </button>
          <button 
            onClick={() => incrementBid(5000)} 
            disabled={isAuctionComplete}
            style={{ flex: 1, padding: "10px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px" }}
          >
            +₹5000
          </button>
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: 10 }}>
          <button 
            onClick={() => decrementBid(1000)} 
            disabled={isAuctionComplete}
            style={{ flex: 1, padding: "10px", background: "#6c757d", color: "white", border: "none", borderRadius: "4px" }}
          >
            -₹1000
          </button>
          <button 
            onClick={() => decrementBid(2000)} 
            disabled={isAuctionComplete}
            style={{ flex: 1, padding: "10px", background: "#495057", color: "white", border: "none", borderRadius: "4px" }}
          >
            -₹2000
          </button>
          <button 
            onClick={() => decrementBid(5000)} 
            disabled={isAuctionComplete}
            style={{ flex: 1, padding: "10px", background: "#343a40", color: "white", border: "none", borderRadius: "4px" }}
          >
            -₹5000
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button
          onClick={handleSell}
          disabled={!selectedPlayer || awaitingSellConfirmation || isAuctionComplete}
          style={{
            flex: 1,
            padding: "15px",
            background: selectedPlayer && !awaitingSellConfirmation ? "#dc3545" : "#9aa0a6",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "16px",
            fontWeight: "bold"
          }}
        >
          SELL PLAYER
        </button>
        <button
          onClick={handleUnsold}
          disabled={!selectedPlayer || awaitingSellConfirmation || isAuctionComplete}
          style={{
            flex: 1,
            padding: "15px",
            background: selectedPlayer && !awaitingSellConfirmation ? "#fd7e14" : "#9aa0a6",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "16px",
            fontWeight: "bold"
          }}
        >
          UNSOLD
        </button>
      </div>

      {awaitingSellConfirmation && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={handleConfirmNextPlayer}
            disabled={countdownValue !== null || isAuctionComplete}
            style={{
              width: "100%",
              padding: "12px",
              background: countdownValue !== null ? "#9aa0a6" : "#0d6efd",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: countdownValue !== null ? "not-allowed" : "pointer"
            }}
          >
            {countdownValue !== null
              ? `Starting next player in ${countdownValue}...`
              : "CONFIRM NEXT PLAYER"}
          </button>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={handleUndo}
          disabled={!lastAction}
          style={{
            width: "100%",
            padding: "11px",
            background: lastAction ? "#5a3e8b" : "#9aa0a6",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: lastAction ? "pointer" : "not-allowed"
          }}
        >
          {lastAction
            ? `↩ UNDO — ${lastAction.type === 'sold' ? 'Sold' : 'Unsold'}: ${lastAction.playerName}`
            : "↩ UNDO (no recent action)"}
        </button>
      </div>

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

      <div style={{ margin: "16px 0 10px" }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>Show Teams:</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
          {teams.slice(0, 6).map((team) => (
            <button
              key={`show-team-${team.id}`}
              onClick={() => {
                if (socket) {
                  socket.emit("showTeamFullscreen", { teamId: team.id });
                } else {
                  onShowTeams && onShowTeams(team.id);
                }
              }}
              style={{
                padding: "10px",
                background: "#0d6efd",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontWeight: "bold",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
              title={team.name}
            >
              {team.name}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            if (socket) {
              socket.emit("showTeamsOverlay");
            } else {
              onShowTeams && onShowTeams();
            }
          }}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "10px",
            background: "#198754",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          SHOW ALL TEAMS
        </button>
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
