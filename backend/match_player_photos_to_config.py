import json
import re
from pathlib import Path
import sqlite3
import difflib

CONFIG_PATH = Path(r"c:\Users\visha\CricketLeagueAuction\backend\config.json")
PHOTO_DIR = Path(r"c:\Users\visha\CricketLeagueAuction\backend\images\player_photo")
DB_PATH = Path(r"c:\Users\visha\CricketLeagueAuction\backend\auction.db")
SUPPORTED = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".jfif"}


def normalize(text: str) -> str:
    text = str(text or "").lower()
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def tokens(text: str):
    return [t for t in normalize(text).split() if t]


def aliases_for_file(path: Path):
    stem = path.stem
    aliases = {stem}
    if " - " in stem:
        parts = stem.split(" - ")
        aliases.add(parts[-1])
        aliases.add(parts[0])
    aliases = {normalize(a) for a in aliases if normalize(a)}
    return aliases


def score_match(player_name: str, file_path: Path):
    pname = normalize(player_name)
    ptokens_list = tokens(player_name)
    ptokens = set(ptokens_list)
    aliases = aliases_for_file(file_path)
    stem_norm = normalize(file_path.stem)

    best = None
    for alias in aliases | {stem_norm}:
        atokens_list = [t for t in alias.split() if t]
        atokens = set(atokens_list)
        score = 10_000
        if alias == pname:
            score = 0
        elif pname in alias:
            score = 100 + (len(alias) - len(pname))
        elif alias in pname:
            score = 150 + (len(pname) - len(alias))
        elif ptokens and atokens:
            overlap = len(ptokens & atokens)
            if overlap >= max(2, min(len(ptokens), len(atokens))):
                score = 300 - overlap * 20 + abs(len(atokens) - len(ptokens)) * 5

        if score >= 1000 and ptokens_list and atokens_list:
            similarity = difflib.SequenceMatcher(None, pname, alias).ratio()
            first_ok = (
                ptokens_list[0][:4] == atokens_list[0][:4]
                if ptokens_list[0] and atokens_list[0]
                else False
            )
            last_ok = ptokens_list[-1] == atokens_list[-1]
            last_similar = (
                difflib.SequenceMatcher(
                    None, ptokens_list[-1], atokens_list[-1]
                ).ratio()
                >= 0.88
            )
            if similarity >= 0.93 and first_ok and last_ok:
                score = 450 - similarity * 100
            elif similarity >= 0.95 and first_ok and last_similar:
                score = 470 - similarity * 100
            elif (
                similarity >= 0.9
                and last_ok
                and len(ptokens & atokens)
                >= max(1, min(len(ptokens), len(atokens)) - 1)
            ):
                score = 520 - similarity * 100
        if best is None or score < best:
            best = score

    if best is None or best >= 1000:
        return None

    stem = file_path.stem.lower()
    penalty = 0
    if "screenshot" in stem:
        penalty += 40
    if "whatsapp image" in stem:
        penalty += 20
    if "img_" in stem:
        penalty += 10
    penalty += max(0, len(file_path.stem) - 24) * 0.2
    penalty += 0 if file_path.suffix.lower() in {".jpg", ".jpeg"} else 5
    return best + penalty


def relative_photo_path(path: Path) -> str:
    relative = path.relative_to(PHOTO_DIR).as_posix()
    return f"/images/player_photo/{relative}"


def main():
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    files = [
        p for p in PHOTO_DIR.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED
    ]

    matched = 0
    unmatched = []

    for player in config.get("players", []):
        name = player.get("name")
        if not name:
            unmatched.append({"id": player.get("id"), "name": name or ""})
            continue

        scored = []
        for file_path in files:
            score = score_match(name, file_path)
            if score is not None:
                scored.append((score, file_path))

        if not scored:
            unmatched.append({"id": player.get("id"), "name": name})
            continue

        scored.sort(key=lambda item: (item[0], len(item[1].name), item[1].name.lower()))
        best_path = scored[0][1]
        player["photo"] = relative_photo_path(best_path)
        matched += 1

    CONFIG_PATH.write_text(
        json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    for player in config.get("players", []):
        cur.execute(
            "UPDATE players SET photo = ? WHERE id = ?",
            (player.get("photo"), int(player.get("id"))),
        )
    conn.commit()
    conn.close()

    print(
        json.dumps(
            {
                "players_total": len(config.get("players", [])),
                "matched": matched,
                "unmatched": len(unmatched),
                "unmatched_players": unmatched[:25],
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
