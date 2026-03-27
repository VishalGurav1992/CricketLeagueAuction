import json
import re
from pathlib import Path

import pandas as pd

CFG_PATH = Path(r"c:\Users\visha\CricketLeagueAuction\backend\config.json")
XLS_PATH = Path(r"c:\Users\visha\CricketLeagueAuction\spl.xlsx")


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
    if not s:
        return None
    return s


def find_col(df, candidates):
    col_map = {norm(c): c for c in df.columns}
    for key in candidates:
        k = norm(key)
        if k in col_map:
            return col_map[k]
    # fallback contains
    for c in df.columns:
        nc = norm(c)
        for key in candidates:
            if norm(key) in nc:
                return c
    return None


def main():
    cfg = json.loads(CFG_PATH.read_text(encoding="utf-8"))
    df = pd.read_excel(XLS_PATH)

    id_col = find_col(df, ["Column 1", "column1", "sr no", "serial", "id", "player id"])
    full_name_col = find_col(df, ["Full Name", "Name"])
    age_col = find_col(df, ["Age"])
    contact_col = find_col(df, ["Contact No", "Contact Number", "Mobile", "Phone"])
    village_col = find_col(df, ["Village", "Village ( Area in Siddar )"])
    role_col = find_col(df, ["Player Role", "Role"])
    batting_col = find_col(df, ["Batting Style"])
    bowling_col = find_col(df, ["Bowling style", "Bowling Style"])
    jersey_name_col = find_col(df, ["Jersey Name"])
    jersey_no_col = find_col(df, ["Jersey No", "Jersey Number"])

    if not id_col:
        raise RuntimeError("Could not find ID/serial column in spl.xlsx")

    row_by_id = {}
    for _, row in df.iterrows():
        pid = to_int(row.get(id_col))
        if not pid:
            continue
        row_by_id[pid] = row

    updated = 0
    untouched = 0

    for p in cfg.get("players", []):
        pid = to_int(p.get("id"))
        if not pid or pid not in row_by_id:
            untouched += 1
            continue

        row = row_by_id[pid]

        full_name = to_str(row.get(full_name_col)) if full_name_col else None
        age = to_int(row.get(age_col)) if age_col else None
        contact = to_str(row.get(contact_col)) if contact_col else None
        village = to_str(row.get(village_col)) if village_col else None
        role = to_str(row.get(role_col)) if role_col else None
        batting = to_str(row.get(batting_col)) if batting_col else None
        bowling = to_str(row.get(bowling_col)) if bowling_col else None
        jersey_name = to_str(row.get(jersey_name_col)) if jersey_name_col else None
        jersey_no = to_str(row.get(jersey_no_col)) if jersey_no_col else None

        if full_name:
            p["name"] = full_name
            p["full_name"] = full_name
        if age is not None:
            p["age"] = age
        if contact:
            p["mobile_number"] = contact
            p["contact_no"] = contact
        if village:
            p["village"] = village
        if role:
            p["role"] = role
            p["player_role"] = role
        if batting:
            p["batting_style"] = batting
        if bowling:
            p["bowling_style"] = bowling
        if jersey_name:
            p["jersey_name"] = jersey_name
        if jersey_no:
            p["jersey_no"] = jersey_no

        updated += 1

    CFG_PATH.write_text(
        json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    print(
        json.dumps(
            {
                "excel_rows": int(len(df)),
                "matched_by_id": int(len(row_by_id)),
                "players_updated": int(updated),
                "players_untouched": int(untouched),
                "id_column": id_col,
                "mapped_columns": {
                    "full_name": full_name_col,
                    "age": age_col,
                    "contact_no": contact_col,
                    "village": village_col,
                    "player_role": role_col,
                    "batting_style": batting_col,
                    "bowling_style": bowling_col,
                    "jersey_name": jersey_name_col,
                    "jersey_no": jersey_no_col,
                },
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
