const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./auction.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    balance INTEGER,
    photo TEXT,
    owner_name TEXT,
    photoowner TEXT
  )`);

  db.run("ALTER TABLE teams ADD COLUMN owner_name TEXT", (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error(err.message);
    }
  });

  db.run("ALTER TABLE teams ADD COLUMN photoowner TEXT", (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error(err.message);
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    role TEXT,
    base_price INTEGER,
    sold_to_team INTEGER,
    auction_category TEXT,
    photo TEXT,
    age INTEGER,
    mobile_number TEXT
  )`);

  db.run("ALTER TABLE players ADD COLUMN auction_category TEXT", (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error(err.message);
    }
  });

  db.run("ALTER TABLE players ADD COLUMN age INTEGER", (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error(err.message);
    }
  });

  db.run("ALTER TABLE players ADD COLUMN mobile_number TEXT", (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error(err.message);
    }
  });

  db.run("UPDATE players SET auction_category = 'NEW' WHERE auction_category IS NULL", (err) => {
    if (err) {
      console.error(err.message);
    }
  });

  db.run("ALTER TABLE players ADD COLUMN relist_blocked_team_id INTEGER", (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error(err.message);
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS auction_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER,
    team_id INTEGER,
    final_price INTEGER
  )`);
});

module.exports = db;
