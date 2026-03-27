import json
import re
from pathlib import Path

import pandas as pd
import sqlite3

CFG_PATH = Path(r"c:\Users\visha\CricketLeagueAuction\backend\config.json")
XLS_PATH = Path(r"c:\Users\visha\CricketLeagueAuction\spl.xlsx")
DB_PATH = Path(r"c:\Users\visha\CricketLeagueAuction\backend\auction.db")


def norm(text):
    return re.sub(r"\s+", " ", str(text or "")).strip().lower()


def to_int(value):
    if pd.isna(value):
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        if "." in s:
            return int(float(s))
        return int(s)
    except Exception:
        return None


def to_str(value):
    if pd.isna(value):
        return None
    s = str(value).strip()
    return s or None


def find_col(df, candidates):
    col_map = {norm(c): c for c in df.columns}
    for key in candidates:
        nk = norm(key)
        if nk in col_map:
            return col_map[nk]
    for c in df.columns:
        nc = norm(c)
        for key in candidates:
            if norm(key) in nc:
                return c
    return None


def apply_row(player, row, cols):
    full_name = to_str(row.get(cols["full_name"])) if cols["full_name"] else None
    age = to_int(row.get(cols["age"])) if cols["age"] else None
    contact = to_str(row.get(cols["contact_no"])) if cols["contact_no"] else None
    village = to_str(row.get(cols["village"])) if cols["village"] else None
    role = to_str(row.get(cols["player_role"])) if cols["player_role"] else None
    batting = to_str(row.get(cols["batting_style"])) if cols["batting_style"] else None
    bowling = to_str(row.get(cols["bowling_style"])) if cols["bowling_style"] else None
    jersey_name = to_str(row.get(cols["jersey_name"])) if cols["jersey_name"] else None
    jersey_no = to_str(row.get(cols["jersey_no"])) if cols["jersey_no"] else None

    if full_name:
        player["name"] = full_name
        player["full_name"] = full_name
    if age is not None:
        player["age"] = age
    if contact:
        player["mobile_number"] = contact
        player["contact_no"] = contact
    if village:
        player["village"] = village
    if role:
        player["role"] = role
        player["player_role"] = role
    if batting:
        player["batting_style"] = batting
    if bowling:
        player["bowling_style"] = bowling
    if jersey_name:
        player["jersey_name"] = jersey_name
    if jersey_no:
        player["jersey_no"] = jersey_no


def main():
    cfg = json.loads(CFG_PATH.read_text(encoding="utf-8"))
    df = pd.read_excel(XLS_PATH)

    cols = {
        "id": find_col(df, ["Column 1", "id", "serial"]),
        "full_name": find_col(df, ["Full Name"]),
        "age": find_col(df, ["Age"]),
        "contact_no": find_col(df, ["Contact No"]),
        "village": find_col(df, ["Village ( Area in Siddar )", "Village"]),
        "player_role": find_col(df, ["Player Role"]),
        "batting_style": find_col(df, ["Batting Style"]),
        "bowling_style": find_col(df, ["Bowling style", "Bowling Style"]),
        "jersey_name": find_col(df, ["Jersey Name"]),
        "jersey_no": find_col(df, ["Jersey No"]),
    }

    existing_ids = {to_int(x) for x in df[cols["id"]].dropna()} if cols["id"] else set()
    remaining_rows = [
        row for _, row in df.iterrows() if to_int(row.get(cols["id"])) is None
    ]
    target_players = [
        p for p in cfg["players"] if str(p.get("name", "")).startswith("Player ")
    ]
    target_players.sort(key=lambda p: int(p["id"]))

    if len(remaining_rows) < len(target_players):
        raise RuntimeError(
            f"Remaining row count {len(remaining_rows)} is less than target players {len(target_players)}"
        )

    unused_rows = remaining_rows[len(target_players) :]
    remaining_rows = remaining_rows[: len(target_players)]

    for player, row in zip(target_players, remaining_rows):
        apply_row(player, row, cols)

    CFG_PATH.write_text(
        json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    for p in target_players:
        cur.execute(
            """UPDATE players
               SET name = ?, role = ?, age = ?, mobile_number = ?
               WHERE id = ?""",
            (
                p.get("name"),
                p.get("role"),
                p.get("age"),
                p.get("mobile_number"),
                int(p.get("id")),
            ),
        )
    conn.commit()
    conn.close()

    print(
        json.dumps(
            {
                "updated_player_ids": [int(p["id"]) for p in target_players],
                "filled_from_rows_without_id": len(remaining_rows),
                "unassigned_extra_rows": [
                    to_str(r.get(cols["full_name"])) for r in unused_rows
                ],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
