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

// Load config.json and populate DB
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

db.serialize(() => {
  // Insert teams
  config.teams.forEach(team => {
    db.run("INSERT OR IGNORE INTO teams (id, name, balance, photo) VALUES (?, ?, ?, ?)", 
      [team.id, team.name, team.balance, team.photo]);
  });

  // Insert players
  config.players.forEach(player => {
    db.run("INSERT OR IGNORE INTO players (id, name, role, base_price, sold_to_team, photo) VALUES (?, ?, ?, ?, NULL, ?)", 
      [player.id, player.name, player.role, player.base_price, player.photo]);
  });
});

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

server.listen(5000, () => console.log("Backend running on http://localhost:5000"));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Reset DB to original config.json
app.post('/reset', (req, res) => {
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

  // Clear existing data
  db.run("DELETE FROM teams");
  db.run("DELETE FROM players");
  db.run("DELETE FROM auction_history");

  // Reinsert teams
  config.teams.forEach(team => {
    db.run("INSERT INTO teams (id, name, balance, photo) VALUES (?, ?, ?, ?)", 
      [team.id, team.name, team.balance, team.photo]);
  });

  // Reinsert players
  config.players.forEach(player => {
    db.run("INSERT INTO players (id, name, role, base_price, sold_to_team, photo) VALUES (?, ?, ?, ?, NULL, ?)", 
      [player.id, player.name, player.role, player.base_price, player.photo]);
  });

  // Reset current auction state
  currentAuctionPlayer = null;
  currentBid = 0;

  // Broadcast reset event to all connected clients
  io.emit('databaseReset', { message: "Database has been reset!" });

  res.json({ message: "Database reset to original state!" });
});