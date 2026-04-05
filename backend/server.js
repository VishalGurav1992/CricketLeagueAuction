const express = require('express');
const cors = require('cors');
const db = require('./db');
const fs = require('fs');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const PDFDocument = require('pdfkit');

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

const getConfigTeamMap = () => {
  const config = loadConfig();
  return new Map((config.teams || []).map((t) => [Number(t.id), t]));
};

const getConfigPlayerMap = () => {
  const config = loadConfig();
  return new Map((config.players || []).map((p) => [Number(p.id), p]));
};

const hydratePlayerFromConfig = (playerRow) => {
  if (!playerRow) return playerRow;
  const cfgPlayer = getConfigPlayerMap().get(Number(playerRow.id));
  if (!cfgPlayer) return playerRow;

  return {
    ...playerRow,
    name: cfgPlayer.name || playerRow.name,
    role: cfgPlayer.role || playerRow.role,
    age: cfgPlayer.age ?? playerRow.age,
    mobile_number: cfgPlayer.mobile_number || playerRow.mobile_number,
    photo: cfgPlayer.photo || playerRow.photo,
    village: cfgPlayer.village ?? null,
    batting_style: cfgPlayer.batting_style ?? null,
    bowling_style: cfgPlayer.bowling_style ?? null,
    jersey_name: cfgPlayer.jersey_name ?? null,
    jersey_no: cfgPlayer.jersey_no ?? null,
    contact_no: cfgPlayer.contact_no ?? cfgPlayer.mobile_number ?? null
  };
};

const getCaptainAssignments = (config) => {
  const assignments = new Map();
  config.teams.forEach((team) => {
    if (team.captain_player_id != null) {
      assignments.set(Number(team.captain_player_id), Number(team.id));
    }
  });
  return assignments;
};

const getOwnerPlayerAssignments = (config) => {
  const assignments = new Map();
  config.teams.forEach((team) => {
    if (team.owner_player_id != null) {
      assignments.set(Number(team.owner_player_id), Number(team.id));
    }
  });
  return assignments;
};

const seedDatabaseFromConfig = (config) => {
  const captainAssignments = getCaptainAssignments(config);
  const ownerPlayerAssignments = getOwnerPlayerAssignments(config);

  config.teams.forEach(team => {
    db.run("INSERT OR REPLACE INTO teams (id, name, balance, photo, owner_name, photoowner) VALUES (?, ?, ?, ?, ?, ?)",
      [team.id, team.name, team.balance, team.photo, team.owner_name ?? null, team.photoowner ?? null]);
  });

  config.players.forEach(player => {
    const playerId = Number(player.id);
    const soldToTeam = captainAssignments.get(playerId) ?? ownerPlayerAssignments.get(playerId) ?? null;
    const role = captainAssignments.has(playerId) ? 'Captain' : player.role;
    const auctionCategory = player.auction_category || 'NEW';
    db.run(
      "INSERT OR REPLACE INTO players (id, name, role, base_price, sold_to_team, auction_category, photo, age, mobile_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [player.id, player.name, role, player.base_price, soldToTeam, auctionCategory, player.photo, player.age ?? null, player.mobile_number ?? null]
    );
  });
};

// Robust sync function to ensure all players from config are in the database
const syncPlayersFromConfigToDatabase = (config, callback) => {
  const captainAssignments = getCaptainAssignments(config);
  const ownerPlayerAssignments = getOwnerPlayerAssignments(config);
  let completedInserts = 0;
  const totalPlayers = config.players.length;
  let hasError = false;

  if (totalPlayers === 0) {
    return callback(null, { synced: 0 });
  }

  config.players.forEach(player => {
    const playerId = Number(player.id);
    const soldToTeam = captainAssignments.get(playerId) ?? ownerPlayerAssignments.get(playerId) ?? null;
    const role = captainAssignments.has(playerId) ? 'Captain' : player.role;
    const auctionCategory = player.auction_category || 'NEW';

    db.run(
      "INSERT OR REPLACE INTO players (id, name, role, base_price, sold_to_team, auction_category, photo, age, mobile_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [player.id, player.name, role, player.base_price, soldToTeam, auctionCategory, player.photo, player.age ?? null, player.mobile_number ?? null],
      function(err) {
        if (err && !hasError) {
          hasError = true;
          return callback(err);
        }
        completedInserts++;
        if (completedInserts === totalPlayers) {
          callback(null, { synced: totalPlayers });
        }
      }
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

        // Keep team metadata in sync with config.
        // Before auction starts (no history), also align balances with config.
        const shouldSyncBalances = Number(stats.historyCount || 0) === 0;
        config.teams.forEach((team) => {
          if (shouldSyncBalances) {
            db.run(
              "UPDATE teams SET name = ?, balance = ?, photo = ?, owner_name = ?, photoowner = ? WHERE id = ?",
              [team.name, team.balance, team.photo, team.owner_name ?? null, team.photoowner ?? null, team.id]
            );
          } else {
            db.run(
              "UPDATE teams SET name = ?, photo = ?, owner_name = ?, photoowner = ? WHERE id = ?",
              [team.name, team.photo, team.owner_name ?? null, team.photoowner ?? null, team.id]
            );
          }
        });
      });
    }
  );
};

initializeDatabase();

const fetchTeamDetails = (teamId, callback) => {
  db.get("SELECT id, name, owner_name, photoowner FROM teams WHERE id = ?", [teamId], (teamErr, teamRow) => {
    if (teamErr) return callback(teamErr);
    if (!teamRow) return callback(new Error("Team not found"));

    const configTeam = getConfigTeamMap().get(Number(teamRow.id));
    const effectiveTeamName = configTeam?.name || teamRow.name;
    const effectiveOwnerName = configTeam?.owner_name || teamRow.owner_name;
    const effectiveOwnerPhoto = configTeam?.photoowner || teamRow.photoowner || null;

    db.all(
      `SELECT p.id, p.name, p.role, p.age, p.mobile_number, p.base_price, p.sold_to_team,
              p.photo,
              (
                SELECT ah2.final_price
                FROM auction_history ah2
                WHERE ah2.player_id = p.id
                ORDER BY ah2.id DESC
                LIMIT 1
              ) AS final_price
       FROM players p
       WHERE p.sold_to_team = ?
       ORDER BY p.id ASC`,
      [teamId],
      (playersErr, rows) => {
        if (playersErr) return callback(playersErr);

        const configPlayerMap = getConfigPlayerMap();
        const players = rows.map((row) => {
          const cfgPlayer = configPlayerMap.get(Number(row.id));
          return {
            id: row.id,
            photo: cfgPlayer?.photo || row.photo,
            name: cfgPlayer?.name || row.name,
            role: cfgPlayer?.role || row.role,
            age: cfgPlayer?.age ?? row.age,
            mobile_number: cfgPlayer?.mobile_number || row.mobile_number,
            batting_style: cfgPlayer?.batting_style ?? null,
            bowling_style: cfgPlayer?.bowling_style ?? null,
            jersey_no: cfgPlayer?.jersey_no ?? null,
            sold_status: row.role === "Captain" ? "CAPTAIN_PICK" : "SOLD",
            sold_price: row.role === "Captain" ? "NIL" : (row.final_price != null ? row.final_price : row.base_price)
          };
        });

        callback(null, {
          team_id: teamRow.id,
          owner_name: effectiveOwnerName,
          photoowner: effectiveOwnerPhoto,
          team_name: effectiveTeamName,
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
    const configTeamMap = getConfigTeamMap();
    const hydrated = rows.map((row) => {
      const cfg = configTeamMap.get(Number(row.id));
      if (!cfg) return row;
      return {
        ...row,
        name: cfg.name,
        owner_name: cfg.owner_name,
        photo: cfg.photo,
        photoowner: cfg.photoowner,
        captain_player_id: cfg.captain_player_id ?? null,
        owner_player_id: cfg.owner_player_id ?? null
      };
    });
    res.json(hydrated);
  });
});

app.get('/players', (req, res) => {
  db.all("SELECT * FROM players", [], (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows.map(hydratePlayerFromConfig));
  });
});

app.get('/auction/current', (req, res) => {
  if (!currentAuctionPlayer) {
    return res.json({ player: null, currentBid: 0 });
  }
  
  db.get("SELECT * FROM players WHERE id = ?", [currentAuctionPlayer], (err, player) => {
    if (err) return res.status(500).json(err);
    res.json({ player: hydratePlayerFromConfig(player), currentBid });
  });
});

app.post('/auction/select-player', (req, res) => {
  const { playerId } = req.body;
  currentAuctionPlayer = playerId;
  
  db.get("SELECT * FROM players WHERE id = ?", [playerId], (err, player) => {
    if (err) return res.status(500).json(err);
    currentBid = player.base_price;
    const hydratedPlayer = hydratePlayerFromConfig(player);
    
    // Broadcast player selection to all connected clients
    io.emit('playerSelected', { player: hydratedPlayer, currentBid });
    
    res.json({ message: "Player selected for auction", player: hydratedPlayer, currentBid });
  });
});

app.post('/auction/update-bid', (req, res) => {
  const { bidAmount } = req.body;
  currentBid = bidAmount;
  
  // Broadcast bid update to all connected clients
  io.emit('bidUpdated', { currentBid });
  
  res.json({ message: "Bid updated", currentBid });
});

app.post('/auction/mark-unsold', (req, res) => {
  const playerId = Number(req.body?.playerId);
  if (!playerId) {
    return res.status(400).json({ error: "Invalid playerId" });
  }

  db.get("SELECT * FROM players WHERE id = ?", [playerId], (playerErr, player) => {
    if (playerErr) {
      return res.status(500).json({ error: playerErr.message });
    }
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }
    if (String(player.role || "").toLowerCase() === "captain") {
      return res.status(400).json({ error: "Captain cannot be marked unsold" });
    }

    db.run("UPDATE players SET auction_category = 'UNSOLD' WHERE id = ?", [playerId], function(updateErr) {
      if (updateErr) {
        return res.status(500).json({ error: updateErr.message });
      }

      if (Number(currentAuctionPlayer) === Number(playerId)) {
        currentAuctionPlayer = null;
        currentBid = 0;
      }

      db.get("SELECT * FROM players WHERE id = ?", [playerId], (fetchErr, updatedPlayer) => {
        if (fetchErr) {
          return res.status(500).json({ error: fetchErr.message });
        }

        io.emit('playerUnsold', { playerId, player: updatedPlayer });
        io.emit('refresh');
        res.json({ message: "Player moved to unsold pool", updatedPlayer });
      });
    });
  });
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

    db.get("SELECT relist_blocked_team_id FROM players WHERE id = ?", [playerId], (blockCheckErr, playerCheck) => {
      if (blockCheckErr) return res.status(500).json({ error: blockCheckErr.message });
      if (playerCheck?.relist_blocked_team_id && Number(playerCheck.relist_blocked_team_id) === Number(teamId)) {
        const errMsg = `${team.name} released this player and cannot bid on them again.`;
        io.emit('auctionError', { message: errMsg, teamId });
        return res.status(400).json({ error: errMsg });
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
        db.run("UPDATE players SET sold_to_team = ?, relist_blocked_team_id = NULL WHERE id = ?", [teamId, playerId], function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          db.run("UPDATE teams SET balance = balance - ? WHERE id = ?", [finalPrice, teamId], function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }

            db.run("DELETE FROM auction_history WHERE player_id = ?", [playerId], (deleteHistoryErr) => {
              if (deleteHistoryErr) {
                return res.status(500).json({ error: deleteHistoryErr.message });
              }

              db.run("INSERT INTO auction_history (player_id, team_id, final_price) VALUES (?, ?, ?)",
                [playerId, teamId, finalPrice], function(err) {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }

                // Reset current auction state
                currentAuctionPlayer = null;
                currentBid = 0;

                // Keep response metadata consistent with config while updating live balance.
                const cfgTeam = getConfigTeamMap().get(Number(teamId));
                const updatedTeam = {
                  ...team,
                  name: cfgTeam?.name || team.name,
                  owner_name: cfgTeam?.owner_name || team.owner_name,
                  photo: cfgTeam?.photo || team.photo,
                  photoowner: cfgTeam?.photoowner || team.photoowner,
                  balance: team.balance - finalPrice
                };

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
    }); // close relist blocked check
  });
});

app.post('/auction/relist-player', (req, res) => {
  const playerId = Number(req.body?.playerId);
  const skipTeamBlock = Boolean(req.body?.skipTeamBlock);
  if (!playerId) {
    return res.status(400).json({ error: "Invalid playerId" });
  }

  db.get("SELECT * FROM players WHERE id = ?", [playerId], (playerErr, player) => {
    if (playerErr) {
      return res.status(500).json({ error: playerErr.message });
    }
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }
    if (!player.sold_to_team) {
      return res.status(400).json({ error: "Player is already unsold" });
    }
    if (String(player.role || "").toLowerCase() === "captain") {
      return res.status(400).json({ error: "Captain cannot be relisted" });
    }

    const ownerPlayerAssignments = getOwnerPlayerAssignments(loadConfig());
    if (ownerPlayerAssignments.has(Number(playerId))) {
      return res.status(400).json({ error: "Owner player cannot be relisted" });
    }

    const soldTeamId = Number(player.sold_to_team);

    db.get("SELECT * FROM teams WHERE id = ?", [soldTeamId], (teamErr, team) => {
      if (teamErr) {
        return res.status(500).json({ error: teamErr.message });
      }
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }

      db.get(
        "SELECT final_price FROM auction_history WHERE player_id = ? ORDER BY id DESC LIMIT 1",
        [playerId],
        (historyErr, historyRow) => {
          if (historyErr) {
            return res.status(500).json({ error: historyErr.message });
          }

          const refundAmount = Number(historyRow?.final_price ?? player.base_price ?? 0);
          const blockedTeamId = skipTeamBlock ? null : soldTeamId;
          const restoredCategory = skipTeamBlock ? 'NEW' : 'RELIST';

          db.serialize(() => {
            db.run("UPDATE players SET sold_to_team = NULL, auction_category = ?, relist_blocked_team_id = ? WHERE id = ?", [restoredCategory, blockedTeamId, playerId], function(updatePlayerErr) {
              if (updatePlayerErr) {
                return res.status(500).json({ error: updatePlayerErr.message });
              }

              db.run("DELETE FROM auction_history WHERE player_id = ?", [playerId], function(deleteHistoryErr) {
                if (deleteHistoryErr) {
                  return res.status(500).json({ error: deleteHistoryErr.message });
                }

                db.run("UPDATE teams SET balance = balance + ? WHERE id = ?", [refundAmount, soldTeamId], function(updateTeamErr) {
                  if (updateTeamErr) {
                    return res.status(500).json({ error: updateTeamErr.message });
                  }

                  if (Number(currentAuctionPlayer) === Number(playerId)) {
                    currentAuctionPlayer = null;
                    currentBid = 0;
                  }

                  db.get("SELECT * FROM teams WHERE id = ?", [soldTeamId], (teamFetchErr, updatedTeamRow) => {
                    if (teamFetchErr) {
                      return res.status(500).json({ error: teamFetchErr.message });
                    }

                    const cfgTeam = getConfigTeamMap().get(Number(soldTeamId));
                    const updatedTeam = {
                      ...updatedTeamRow,
                      name: cfgTeam?.name || updatedTeamRow.name,
                      owner_name: cfgTeam?.owner_name || updatedTeamRow.owner_name,
                      photo: cfgTeam?.photo || updatedTeamRow.photo,
                      photoowner: cfgTeam?.photoowner || updatedTeamRow.photoowner
                    };

                    db.get("SELECT * FROM players WHERE id = ?", [playerId], (playerFetchErr, updatedPlayer) => {
                      if (playerFetchErr) {
                        return res.status(500).json({ error: playerFetchErr.message });
                      }

                      io.emit('playerRelisted', {
                        playerId,
                        teamId: soldTeamId,
                        refundedAmount: refundAmount,
                        team: updatedTeam,
                        player: updatedPlayer
                      });
                      io.emit('refresh');

                      res.json({
                        message: "Player moved back to auction pool",
                        refundedAmount: refundAmount,
                        updatedTeam,
                        updatedPlayer
                      });
                    });
                  });
                });
              });
            });
          });
        }
      );
    });
  });
});

app.post('/auction/undo-unsold', (req, res) => {
  const playerId = Number(req.body?.playerId);
  if (!playerId) return res.status(400).json({ error: 'Invalid playerId' });

  db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, player) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    if (player.sold_to_team) return res.status(400).json({ error: 'Player is already sold to a team' });

    db.run("UPDATE players SET auction_category = 'NEW', relist_blocked_team_id = NULL WHERE id = ?", [playerId], function(updateErr) {
      if (updateErr) return res.status(500).json({ error: updateErr.message });

      db.get('SELECT * FROM players WHERE id = ?', [playerId], (fetchErr, updatedPlayer) => {
        if (fetchErr) return res.status(500).json({ error: fetchErr.message });
        io.emit('refresh');
        res.json({ message: 'Unsold action undone', updatedPlayer });
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
    const requestId = data?.requestId ?? null;
    if (!teamId) return;

    fetchTeamDetails(teamId, (err, details) => {
      if (err) {
        socket.emit('auctionError', { message: err.message || 'Unable to fetch team details' });
        return;
      }
      io.emit('teamDetailsSelected', { ...details, requestId });
    });
  });

  socket.on('showTeamsOverlay', () => {
    io.emit('showTeamsOverlay');
  });

  socket.on('showTeamFullscreen', (data) => {
    const teamId = Number(data?.teamId);
    if (!teamId) return;
    io.emit('showTeamFullscreen', { teamId });
  });

  socket.on('hideTeamsOverlay', () => {
    io.emit('hideTeamsOverlay');
  });

  socket.on('teamBalanceWarning', (data) => {
    io.emit('teamBalanceWarning', data);
  });

  socket.on('startNextPlayerTransition', (data) => {
    const seconds = Number(data?.seconds) > 0 ? Number(data.seconds) : 3;
    const stepMs = Number(data?.stepMs) > 0 ? Number(data.stepMs) : 1250;
    io.emit('startNextPlayerTransition', { seconds, stepMs });
  });

  socket.on('toggleLogoOverlay', (data) => {
    io.emit('toggleLogoOverlay', { show: !!data?.show });
  });

  socket.on('startAuction', () => {
    io.emit('startAuction');
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Reset DB to original config.json
app.post('/reset', (req, res) => {
  const config = loadConfig();

  // Clear existing data and resync all players from config
  db.serialize(() => {
    db.run("DELETE FROM auction_history");
    db.run("DELETE FROM players");
    db.run("DELETE FROM teams", () => {
      // After deletion, resync teams and players from config
      config.teams.forEach(team => {
        db.run("INSERT INTO teams (id, name, balance, photo, owner_name, photoowner) VALUES (?, ?, ?, ?, ?, ?)",
          [team.id, team.name, team.balance, team.photo, team.owner_name ?? null, team.photoowner ?? null]);
      });

      // Use robust sync function to ensure all players are inserted
      syncPlayersFromConfigToDatabase(config, (err, result) => {
        if (err) {
          console.error("Error syncing players during reset:", err);
          io.emit('resetError', { message: "Error during database reset", error: err.message });
          return res.status(500).json({ error: "Failed to reset database", details: err.message });
        }

        // Reset current auction state
        currentAuctionPlayer = null;
        currentBid = 0;

        console.log(`Database reset complete. Synced ${result.synced} players from config.json`);

        // Broadcast reset event to all connected clients
        io.emit('databaseReset', { message: "Database has been reset!", playersSynced: result.synced });

        res.json({ message: "Database reset to original state!", playersSynced: result.synced });
      });
    });
  });
});

app.post('/auction/export-remaining-players-pdf', (req, res) => {
  db.all(
    `SELECT id, name, role, base_price, auction_category, age, mobile_number
     FROM players
     WHERE sold_to_team IS NULL
       AND LOWER(COALESCE(role, '')) <> 'captain'
     ORDER BY id ASC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const remainingPlayers = (rows || []).map((row) => hydratePlayerFromConfig(row));
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:]/g, '-').replace(/\..+$/, '');
      const fileName = `remaining-players-${timestamp}.pdf`;
      const outputPath = path.join(__dirname, '..', fileName);

      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      doc.font('Helvetica-Bold').fontSize(18).text('SPL Auction - Remaining Players Report');
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(10).text(`Generated: ${now.toLocaleString('en-IN')}`);
      doc.moveDown(0.8);

      if (remainingPlayers.length === 0) {
        doc.font('Helvetica').fontSize(12).text('No remaining players found.');
      } else {
        doc.font('Helvetica-Bold').fontSize(11).text('ID   Name                           Role                 Category       Mobile          Age');
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(10);

        remainingPlayers.forEach((player) => {
          const id = String(player.id ?? '-').padEnd(4, ' ');
          const name = String(player.name || '-').slice(0, 30).padEnd(30, ' ');
          const role = String(player.role || '-').slice(0, 20).padEnd(20, ' ');
          const category = String(player.auction_category || '-').slice(0, 14).padEnd(14, ' ');
          const mobile = String(player.mobile_number || '-').slice(0, 14).padEnd(14, ' ');
          const age = String(player.age ?? '-');

          doc.text(`${id} ${name} ${role} ${category} ${mobile} ${age}`);

          // Keep content readable across pages.
          if (doc.y > 760) {
            doc.addPage();
            doc.font('Helvetica-Bold').fontSize(11).text('ID   Name                           Role                 Category       Mobile          Age');
            doc.moveDown(0.2);
            doc.font('Helvetica').fontSize(10);
          }
        });
      }

      doc.end();

      stream.on('finish', () => {
        res.json({
          message: 'Remaining players PDF created',
          fileName,
          filePath: outputPath,
          count: remainingPlayers.length
        });
      });

      stream.on('error', (streamErr) => {
        res.status(500).json({ error: streamErr.message || 'Failed to write PDF file' });
      });
    }
  );
});