import os
import shutil
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(r"c:\Users\visha\CricketLeagueAuction\backend\images\player_photo")
BACKUP_ROOT = Path(
    r"c:\Users\visha\CricketLeagueAuction\backend\images\player_photo_backup"
)
SUPPORTED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".jfif"}


def read_image_unicode(path: Path):
    data = np.fromfile(str(path), dtype=np.uint8)
    if data.size == 0:
        return None
    return cv2.imdecode(data, cv2.IMREAD_COLOR)


def write_image_unicode(path: Path, img):
    ext = path.suffix.lower() if path.suffix else ".jpg"
    params = []
    if ext in {".jpg", ".jpeg", ".jfif"}:
        params = [int(cv2.IMWRITE_JPEG_QUALITY), 95]
    ok, enc = cv2.imencode(ext, img, params)
    if not ok:
        return False
    enc.tofile(str(path))
    return True


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def crop_face_only(image, face):
    h, w = image.shape[:2]
    fx, fy, fw, fh = [int(v) for v in face]

    # Tight headshot crop with a small margin around face.
    top = int(fy - 0.25 * fh)
    bottom = int(fy + 1.2 * fh)
    top = clamp(top, 0, h - 2)
    bottom = clamp(bottom, top + 2, h)

    crop_h = bottom - top
    desired_w = int(crop_h * 0.9)
    min_w = int(1.15 * fw)
    crop_w = max(desired_w, min_w)
    crop_w = clamp(crop_w, 2, w)

    face_cx = fx + fw // 2
    left = int(face_cx - crop_w // 2)
    left = clamp(left, 0, w - crop_w)
    right = left + crop_w

    cropped = image[top:bottom, left:right]
    if cropped.size == 0:
        return None

    # Preserve original dimensions so existing UI sizing remains stable.
    return cv2.resize(cropped, (w, h), interpolation=cv2.INTER_CUBIC)


def main():
    if not ROOT.exists():
        print(f"Folder not found: {ROOT}")
        return

    BACKUP_ROOT.mkdir(parents=True, exist_ok=True)

    cascade = cv2.CascadeClassifier(
        str(Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml")
    )
    if cascade.empty():
        print("Failed to load Haar cascade.")
        return

    files = [
        p for p in ROOT.iterdir() if p.is_file() and p.suffix.lower() in SUPPORTED_EXT
    ]
    cropped_count = 0
    skipped_no_face = []
    failed = []

    for file_path in files:
        source_path = BACKUP_ROOT / file_path.name
        if not source_path.exists():
            source_path = file_path

        img = read_image_unicode(source_path)
        if img is None:
            failed.append(f"read-failed: {file_path.name}")
            continue

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(40, 40),
            flags=cv2.CASCADE_SCALE_IMAGE,
        )

        if len(faces) == 0:
            skipped_no_face.append(file_path.name)
            continue

        # Use largest detected face.
        face = max(faces, key=lambda r: r[2] * r[3])
        processed = crop_face_only(img, face)
        if processed is None:
            failed.append(f"crop-failed: {file_path.name}")
            continue

        backup_target = BACKUP_ROOT / file_path.name
        if not backup_target.exists():
            shutil.copy2(file_path, backup_target)

        if not write_image_unicode(file_path, processed):
            failed.append(f"write-failed: {file_path.name}")
            continue

        cropped_count += 1

    print(f"Total supported images: {len(files)}")
    print(f"Cropped successfully: {cropped_count}")
    print(f"Skipped (no face): {len(skipped_no_face)}")
    print(f"Failed: {len(failed)}")

    if skipped_no_face:
        print("No-face samples:")
        for name in skipped_no_face[:20]:
            print(f"  - {name}")

    if failed:
        print("Failures:")
        for item in failed[:20]:
            print(f"  - {item}")


if __name__ == "__main__":
    main()
