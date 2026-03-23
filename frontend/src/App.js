import React, { useEffect, useState } from "react";
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

  // Listen for real-time updates from server
  useEffect(() => {
    if (!socket) return;

    socket.on("playerSold", async (data) => {
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
    });

    socket.on("databaseReset", async (data) => {
      // Refresh teams and players when database is reset
      setTeams(await getTeams());
      setPlayers(await getPlayers());
      setCurrentAuction({ player: null, currentBid: 0 });
      setAuctionError(null);
    });

    socket.on("auctionError", (data) => {
      const message = data?.message || "Auction error occurred";
      if (/maximum\s+15\s+players/i.test(message)) {
        window.alert("Maximum players reached for this team.");
        return;
      }

      setAuctionError(message);
      setTimeout(() => setAuctionError(null), 5000);
    });

    socket.on("playerSelected", (data) => {
      // Update current auction when player is selected
      setCurrentAuction(data);
    });

    socket.on("bidUpdated", (data) => {
      // Update current bid when bid changes
      setCurrentAuction(prev => ({ ...prev, currentBid: data.currentBid }));
    });

    socket.on("teamDetailsSelected", (data) => {
      setSelectedTeamDetails(data || null);
    });

    // Refresh data when refresh event is received
    socket.on("refresh", async () => {
      setTeams(await getTeams());
      setPlayers(await getPlayers());
      setCurrentAuction(await getCurrentAuction());
    });

    return () => {
      socket.off("playerSold");
      socket.off("databaseReset");
      socket.off("playerSelected");
      socket.off("bidUpdated");
      socket.off("teamDetailsSelected");
      socket.off("refresh");
    };
  }, [socket]);

  return (
    <div>
      {isDashboardMode ? (
        <Dashboard teams={teams} players={players} currentAuction={currentAuction} socket={socket} auctionError={auctionError} selectedTeamDetails={selectedTeamDetails} onCloseTeamDetails={() => setSelectedTeamDetails(null)} />
      ) : isAuctioneerMode ? (
        <AuctioneerPanel teams={teams} players={players} socket={socket} setTeams={setTeams} setPlayers={setPlayers} />
      ) : (
        <div style={{ display: "flex", flexDirection: "row" }}>
          <Dashboard teams={teams} players={players} currentAuction={currentAuction} socket={socket} auctionError={auctionError} selectedTeamDetails={selectedTeamDetails} onCloseTeamDetails={() => setSelectedTeamDetails(null)} />
          <AuctioneerPanel teams={teams} players={players} socket={socket} setTeams={setTeams} setPlayers={setPlayers} />
        </div>
      )}
    </div>
  );
}

export default App;
