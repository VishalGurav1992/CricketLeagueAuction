const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./auction.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    balance INTEGER,
    photo TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    role TEXT,
    base_price INTEGER,
    sold_to_team INTEGER,
    photo TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS auction_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER,
    team_id INTEGER,
    final_price INTEGER
  )`);
});

module.exports = db;
