const express = require('express');
const cors = require('cors');
const db = require('./db');
const fs = require('fs');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use('/images', express.static('images')); // serve images

// Global variable to track current auction player
let currentAuctionPlayer = null;
let currentBid = 0;

const loadConfig = () => JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

const getCaptainAssignments = (config) => {
  const assignments = new Map();
  config.teams.forEach((team) => {
    if (team.captain_player_id != null) {
      assignments.set(Number(team.captain_player_id), Number(team.id));
    }
  });
  return assignments;
};

const seedDatabaseFromConfig = (config) => {
  const captainAssignments = getCaptainAssignments(config);

  config.teams.forEach(team => {
    db.run("INSERT OR REPLACE INTO teams (id, name, balance, photo, owner_name) VALUES (?, ?, ?, ?, ?)",
      [team.id, team.name, team.balance, team.photo, team.owner_name ?? null]);
  });

  config.players.forEach(player => {
    const playerId = Number(player.id);
    const soldToTeam = captainAssignments.get(playerId) ?? null;
    const role = captainAssignments.has(playerId) ? 'Captain' : player.role;
    db.run(
      "INSERT OR REPLACE INTO players (id, name, role, base_price, sold_to_team, photo, age, mobile_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [player.id, player.name, role, player.base_price, soldToTeam, player.photo, player.age ?? null, player.mobile_number ?? null]
    );
  });
};

const initializeDatabase = () => {
  const config = loadConfig();

  db.get(
    `SELECT
      (SELECT COUNT(*) FROM teams) AS teamCount,
      (SELECT COUNT(*) FROM players) AS playerCount,
      (SELECT COUNT(*) FROM auction_history) AS historyCount,
      (SELECT COUNT(*) FROM players WHERE sold_to_team IS NOT NULL) AS assignedCount`,
    [],
    (err, stats) => {
      if (err) {
        console.error(err.message);
        return;
      }

      db.serialize(() => {
        if (stats.teamCount === 0 && stats.playerCount === 0) {
          seedDatabaseFromConfig(config);
          return;
        }

        if (stats.historyCount === 0 && stats.assignedCount === 0) {
          seedDatabaseFromConfig(config);
        }
      });
    }
  );
};

initializeDatabase();

const fetchTeamDetails = (teamId, callback) => {
  db.get("SELECT id, name, owner_name FROM teams WHERE id = ?", [teamId], (teamErr, teamRow) => {
    if (teamErr) return callback(teamErr);
    if (!teamRow) return callback(new Error("Team not found"));

    db.all(
      `SELECT p.id, p.name, p.role, p.age, p.mobile_number, p.base_price, p.sold_to_team,
              p.photo, ah.final_price
       FROM players p
       LEFT JOIN auction_history ah ON ah.player_id = p.id
       WHERE p.sold_to_team = ?
       ORDER BY p.id ASC`,
      [teamId],
      (playersErr, rows) => {
        if (playersErr) return callback(playersErr);

        const players = rows.map((row) => ({
          id: row.id,
          photo: row.photo,
          name: row.name,
          role: row.role,
          age: row.age,
          mobile_number: row.mobile_number,
          sold_status: row.role === "Captain" ? "CAPTAIN_PICK" : "SOLD",
          sold_price: row.role === "Captain" ? "NIL" : (row.final_price != null ? row.final_price : row.base_price)
        }));

        callback(null, {
          team_id: teamRow.id,
          owner_name: teamRow.owner_name,
          team_name: teamRow.name,
          players
        });
      }
    );
  });
};

// Routes
app.get('/teams', (req, res) => {
  db.all("SELECT * FROM teams", [], (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

app.get('/players', (req, res) => {
  db.all("SELECT * FROM players", [], (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

app.get('/auction/current', (req, res) => {
  if (!currentAuctionPlayer) {
    return res.json({ player: null, currentBid: 0 });
  }
  
  db.get("SELECT * FROM players WHERE id = ?", [currentAuctionPlayer], (err, player) => {
    if (err) return res.status(500).json(err);
    res.json({ player, currentBid });
  });
});

app.post('/auction/select-player', (req, res) => {
  const { playerId } = req.body;
  currentAuctionPlayer = playerId;
  
  db.get("SELECT * FROM players WHERE id = ?", [playerId], (err, player) => {
    if (err) return res.status(500).json(err);
    currentBid = player.base_price;
    
    // Broadcast player selection to all connected clients
    io.emit('playerSelected', { player, currentBid });
    
    res.json({ message: "Player selected for auction", player, currentBid });
  });
});

app.post('/auction/update-bid', (req, res) => {
  const { bidAmount } = req.body;
  currentBid = bidAmount;
  
  // Broadcast bid update to all connected clients
  io.emit('bidUpdated', { currentBid });
  
  res.json({ message: "Bid updated", currentBid });
});

app.post('/auction/sell', (req, res) => {
  const { playerId, teamId, finalPrice } = req.body;

  // Check team balance before auction completion
  db.get("SELECT * FROM teams WHERE id = ?", [teamId], (err, team) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    db.get("SELECT COUNT(*) AS playerCount FROM players WHERE sold_to_team = ?", [teamId], (err, playerCountRow) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const currentPlayerCount = playerCountRow?.playerCount || 0;
      if (currentPlayerCount >= 15) {
        io.emit('auctionError', {
          message: `Team ${team.name} already has the maximum 15 players.`,
          teamId,
          playerCount: currentPlayerCount
        });
        return res.status(400).json({ error: "Team has reached maximum player limit" });
      }

      if (team.balance < finalPrice) {
        io.emit('auctionError', {
          message: `Team ${team.name} does not have enough balance for this bid. Current balance: ₹${team.balance.toLocaleString()}`,
          teamId,
          balance: team.balance
        });
        return res.status(400).json({ error: "Insufficient balance" });
      }

      db.serialize(() => {
        db.run("UPDATE players SET sold_to_team = ? WHERE id = ?", [teamId, playerId], function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          db.run("UPDATE teams SET balance = balance - ? WHERE id = ?", [finalPrice, teamId], function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }

            db.run("INSERT INTO auction_history (player_id, team_id, final_price) VALUES (?, ?, ?)",
              [playerId, teamId, finalPrice], function(err) {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }

                // Reset current auction state
                currentAuctionPlayer = null;
                currentBid = 0;

                // Create updated team object with new balance
                const updatedTeam = { ...team, balance: team.balance - finalPrice };

                db.get("SELECT * FROM players WHERE id = ?", [playerId], (err, player) => {
                  if (err) {
                    return res.status(500).json({ error: err.message });
                  }

                  io.emit('playerSold', {
                    playerId,
                    teamId,
                    finalPrice,
                    team: updatedTeam,
                    player
                  });

                  // Emit refresh event to update all clients
                  io.emit('refresh');

                  res.json({ message: "Player sold successfully!", updatedTeam, updatedPlayer: player });
                });
              });
          });
        });
      });
    });
  });
});

server.listen(5000, () => console.log("Backend running on http://localhost:5000"));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('selectTeamForDashboard', (data) => {
    const teamId = Number(data?.teamId);
    if (!teamId) return;

    fetchTeamDetails(teamId, (err, details) => {
      if (err) {
        socket.emit('auctionError', { message: err.message || 'Unable to fetch team details' });
        return;
      }
      io.emit('teamDetailsSelected', details);
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Reset DB to original config.json
app.post('/reset', (req, res) => {
  const config = loadConfig();

  // Clear existing data
  db.run("DELETE FROM teams");
  db.run("DELETE FROM players");
  db.run("DELETE FROM auction_history");

  seedDatabaseFromConfig(config);

  // Reset current auction state
  currentAuctionPlayer = null;
  currentBid = 0;

  // Broadcast reset event to all connected clients
  io.emit('databaseReset', { message: "Database has been reset!" });

  res.json({ message: "Database reset to original state!" });
});