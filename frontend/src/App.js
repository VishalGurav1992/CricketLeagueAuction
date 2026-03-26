import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Dashboard from "./components/Dashboard";
import AuctioneerPanel from "./components/AuctioneerPanel";
import { getTeams, getPlayers, getCurrentAuction } from "./api";

function App() {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [currentAuction, setCurrentAuction] = useState({ player: null, currentBid: 0 });
  const [auctionError, setAuctionError] = useState(null);
  const [selectedTeamDetails, setSelectedTeamDetails] = useState(null);
  const [showTeamsOverlay, setShowTeamsOverlay] = useState(false);
  const [requestedFullscreenTeamId, setRequestedFullscreenTeamId] = useState(null);
  const [fullscreenRequestNonce, setFullscreenRequestNonce] = useState(0);
  const selectedTeamIdRef = useRef(null);
  const selectedTeamDetailsRef = useRef(null);
  const teamsRef = useRef([]);

  // Determine which mode to run in (dashboard or auctioneer)
  const mode = process.env.REACT_APP_MODE || "both";
  const isDashboardMode = mode === "dashboard";
  const isAuctioneerMode = mode === "auctioneer";

  useEffect(() => {
    // Initialize Socket.io connection
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    async function fetchData() {
      setTeams(await getTeams());
      setPlayers(await getPlayers());
      setCurrentAuction(await getCurrentAuction());
    }
    fetchData();
  }, []);

  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  useEffect(() => {
    selectedTeamDetailsRef.current = selectedTeamDetails;
  }, [selectedTeamDetails]);

  useEffect(() => {
    selectedTeamIdRef.current = selectedTeamDetails?.team_id ?? null;
    if (!selectedTeamIdRef.current && selectedTeamDetails?.team_name) {
      const match = teamsRef.current.find(
        (t) => String(t.name || "").toLowerCase() === String(selectedTeamDetails.team_name || "").toLowerCase()
      );
      selectedTeamIdRef.current = match?.id ?? null;
    }
  }, [selectedTeamDetails, teams]);

  // Listen for real-time updates from server
  useEffect(() => {
    if (!socket) return;

    const handlePlayerSold = async (data) => {
      // Immediate local update of teams without waiting for API full refresh
      if (data?.team) {
        setTeams(prevTeams => {
          const newTeams = [...prevTeams];
          const index = newTeams.findIndex(t => t.id == data.team.id);
          if (index !== -1) {
            newTeams[index] = data.team;
          }
          return newTeams;
        });
      } else {
        setTeams(await getTeams());
      }

      // Update local player data directly if available
      if (data?.player) {
        setPlayers(prevPlayers => {
          const newPlayers = [...prevPlayers];
          const index = newPlayers.findIndex(p => p.id == data.player.id);
          if (index !== -1) {
            newPlayers[index] = data.player;
          }
          return newPlayers;
        });
      } else {
        setPlayers(prevPlayers => prevPlayers.map(p => p.id === data.playerId ? { ...p, sold_to_team: data.teamId } : p));
      }

      // On sell, clear current auction immediately so dashboard returns to teams-only view.
      setCurrentAuction({ player: null, currentBid: 0 });

      // If we still don't have a local team update, refresh from server
      if (!data?.team) {
        setTeams(await getTeams());
      }

      // Keep Team Details popup fresh after each sale.
      if (selectedTeamIdRef.current) {
        socket.emit("selectTeamForDashboard", { teamId: Number(selectedTeamIdRef.current) });
      }
    };

    const handlePlayerRelisted = async () => {
      if (selectedTeamIdRef.current) {
        socket.emit("selectTeamForDashboard", { teamId: Number(selectedTeamIdRef.current) });
      }
    };

    const handleDatabaseReset = async () => {
      // Refresh teams and players when database is reset
      setTeams(await getTeams());
      setPlayers(await getPlayers());
      setCurrentAuction({ player: null, currentBid: 0 });
      setAuctionError(null);
      setSelectedTeamDetails(null);
    };

    const handleAuctionError = (data) => {
      const message = data?.message || "Auction error occurred";
      if (/maximum\s+15\s+players/i.test(message)) {
        window.alert("Maximum players reached for this team.");
        return;
      }

      setAuctionError(message);
      setTimeout(() => setAuctionError(null), 5000);
    };

    const handlePlayerSelected = (data) => {
      // Update current auction when player is selected
      setCurrentAuction(data);
    };

    const handleBidUpdated = (data) => {
      // Update current bid when bid changes
      setCurrentAuction(prev => ({ ...prev, currentBid: data.currentBid }));
    };

    const handleTeamDetailsSelected = (data) => {
      if (!data) {
        setSelectedTeamDetails(null);
        return;
      }

      let resolvedTeamId = data.team_id ?? null;
      if (!resolvedTeamId && data.team_name) {
        const match = teamsRef.current.find(
          (t) => String(t.name || "").toLowerCase() === String(data.team_name || "").toLowerCase()
        );
        resolvedTeamId = match?.id ?? null;
      }

      setSelectedTeamDetails({ ...data, team_id: resolvedTeamId });
    };

    // Refresh data when refresh event is received
    const handleRefresh = async () => {
      setTeams(await getTeams());
      setPlayers(await getPlayers());
      setCurrentAuction(await getCurrentAuction());
    };

    const handleShowTeamsOverlay = () => {
      setShowTeamsOverlay(true);
      setRequestedFullscreenTeamId(null);
    };

    const handleHideTeamsOverlay = () => {
      setShowTeamsOverlay(false);
    };

    const handleShowTeamFullscreen = (data) => {
      const teamId = Number(data?.teamId);
      if (!teamId) return;
      setShowTeamsOverlay(false);
      setRequestedFullscreenTeamId(teamId);
      setFullscreenRequestNonce(prev => prev + 1);
    };

    socket.on("playerSold", handlePlayerSold);
    socket.on("playerRelisted", handlePlayerRelisted);
    socket.on("databaseReset", handleDatabaseReset);
    socket.on("auctionError", handleAuctionError);
    socket.on("playerSelected", handlePlayerSelected);
    socket.on("bidUpdated", handleBidUpdated);
    socket.on("teamDetailsSelected", handleTeamDetailsSelected);
    socket.on("refresh", handleRefresh);
    socket.on("showTeamsOverlay", handleShowTeamsOverlay);
    socket.on("hideTeamsOverlay", handleHideTeamsOverlay);
    socket.on("showTeamFullscreen", handleShowTeamFullscreen);

    return () => {
      socket.off("playerSold", handlePlayerSold);
      socket.off("playerRelisted", handlePlayerRelisted);
      socket.off("databaseReset", handleDatabaseReset);
      socket.off("auctionError", handleAuctionError);
      socket.off("playerSelected", handlePlayerSelected);
      socket.off("bidUpdated", handleBidUpdated);
      socket.off("teamDetailsSelected", handleTeamDetailsSelected);
      socket.off("refresh", handleRefresh);
      socket.off("showTeamsOverlay", handleShowTeamsOverlay);
      socket.off("hideTeamsOverlay", handleHideTeamsOverlay);
      socket.off("showTeamFullscreen", handleShowTeamFullscreen);
    };
  }, [socket]);

  const handleShowTeamsRequest = (teamId) => {
    const numericTeamId = Number(teamId);
    if (numericTeamId) {
      setShowTeamsOverlay(false);
      setRequestedFullscreenTeamId(numericTeamId);
      setFullscreenRequestNonce(prev => prev + 1);
      return;
    }

    setRequestedFullscreenTeamId(null);
    setShowTeamsOverlay(true);
  };

  return (
    <div>
      {isDashboardMode ? (
        <Dashboard teams={teams} players={players} currentAuction={currentAuction} socket={socket} auctionError={auctionError} selectedTeamDetails={selectedTeamDetails} onCloseTeamDetails={() => setSelectedTeamDetails(null)} showTeamsOverlay={showTeamsOverlay} onCloseTeamsOverlay={() => setShowTeamsOverlay(false)} onShowTeams={() => handleShowTeamsRequest()} onShowTeamFullscreen={handleShowTeamsRequest} requestedFullscreenTeamId={requestedFullscreenTeamId} fullscreenRequestNonce={fullscreenRequestNonce} />
      ) : isAuctioneerMode ? (
        <AuctioneerPanel teams={teams} players={players} socket={socket} setTeams={setTeams} setPlayers={setPlayers} onShowTeams={handleShowTeamsRequest} />
      ) : (
        <div style={{ display: "flex", flexDirection: "row" }}>
          <Dashboard teams={teams} players={players} currentAuction={currentAuction} socket={socket} auctionError={auctionError} selectedTeamDetails={selectedTeamDetails} onCloseTeamDetails={() => setSelectedTeamDetails(null)} showTeamsOverlay={showTeamsOverlay} onCloseTeamsOverlay={() => setShowTeamsOverlay(false)} onShowTeams={() => handleShowTeamsRequest()} onShowTeamFullscreen={handleShowTeamsRequest} requestedFullscreenTeamId={requestedFullscreenTeamId} fullscreenRequestNonce={fullscreenRequestNonce} />
          <AuctioneerPanel teams={teams} players={players} socket={socket} setTeams={setTeams} setPlayers={setPlayers} onShowTeams={handleShowTeamsRequest} />
        </div>
      )}
    </div>
  );
}

export default App;
