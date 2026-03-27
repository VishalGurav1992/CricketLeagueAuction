const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const cfgPath = path.join(__dirname, 'config.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

let configPhotoPathsUpdated = 0;
for (const p of cfg.players || []) {
  const oldPhoto = String(p.photo || '');
  if (!oldPhoto) continue;
  const pngPhoto = oldPhoto.replace(/\.[^./]+$/i, '.png');
  if (pngPhoto === oldPhoto) continue;
  const diskPath = path.join(__dirname, pngPhoto.replace(/^\//, ''));
  if (fs.existsSync(diskPath)) {
    p.photo = pngPhoto;
    configPhotoPathsUpdated += 1;
  }
}

fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

const db = new sqlite3.Database(path.join(__dirname, 'auction.db'));
let dbRowsTouched = 0;

db.serialize(() => {
  const stmt = db.prepare('UPDATE players SET photo = ? WHERE id = ?');
  for (const p of cfg.players || []) {
    if (!p.photo) continue;
    stmt.run([p.photo, Number(p.id)]);
    dbRowsTouched += 1;
  }

  stmt.finalize(() => {
    db.get('SELECT COUNT(*) AS c FROM players WHERE lower(photo) LIKE "%.png"', [], (err, row) => {
      if (err) {
        console.error(err.message);
        process.exitCode = 1;
      } else {
        console.log(JSON.stringify({ configPhotoPathsUpdated, dbRowsTouched, dbPngPhotoCount: row.c }, null, 2));
      }
      db.close();
    });
  });
});
