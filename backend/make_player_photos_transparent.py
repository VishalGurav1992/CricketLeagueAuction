from pathlib import Path

from rembg import remove

ROOT = Path(r"c:\Users\visha\CricketLeagueAuction\backend\images\player_photo")
SUPPORTED_EXT = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".jfif",
    ".JPG",
    ".JPEG",
    ".PNG",
}


def main():
    if not ROOT.exists():
        print(f"Folder not found: {ROOT}")
        return

    files = [p for p in ROOT.iterdir() if p.is_file() and p.suffix in SUPPORTED_EXT]

    converted = 0
    failed = []

    for src in files:
        try:
            input_bytes = src.read_bytes()
            output_bytes = remove(input_bytes)

            out_path = src.with_suffix(".png")
            out_path.write_bytes(output_bytes)
            converted += 1
        except Exception as e:
            failed.append(f"{src.name}: {e}")

    print(f"Total supported images: {len(files)}")
    print(f"Transparent PNG saved: {converted}")
    print(f"Failed: {len(failed)}")
    if failed:
        print("Failure samples:")
        for item in failed[:20]:
            print(f"  - {item}")


if __name__ == "__main__":
    main()
