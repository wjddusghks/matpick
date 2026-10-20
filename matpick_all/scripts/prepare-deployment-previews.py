"""Run locally to prepare committed display images; never removes originals."""
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "client/public"
MANIFEST = ROOT / "client/src/data/generated/restaurant-image-previews.json"


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8-sig"))
    created = reused = 0
    for source in sorted((PUBLIC / "card-data").rglob("*")):
        if not source.is_file() or source.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        url = "/" + source.relative_to(PUBLIC).as_posix()
        if url in manifest and (PUBLIC / manifest[url].lstrip("/")).is_file():
            continue
        relative = source.relative_to(PUBLIC / "card-data").with_suffix(".webp")
        target = PUBLIC / "restaurant-image-previews" / relative
        if target.is_file():
            reused += 1
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(source) as original:
                image = ImageOps.exif_transpose(original).convert("RGB")
                is_main = "main" in source.stem or "cover" in source.stem
                image.thumbnail((960, 1280) if is_main else (512, 768), Image.Resampling.LANCZOS)
                image.save(target, format="WEBP", quality=82 if is_main else 76, method=4)
            created += 1
        manifest[url] = "/" + target.relative_to(PUBLIC).as_posix()
    missing = [url for url, preview in manifest.items()
               if not (PUBLIC / preview.lstrip("/")).is_file()]
    if missing:
        raise RuntimeError(f"{len(missing)} mapped previews missing")
    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")
    print(json.dumps({"mapped": len(manifest), "created": created, "reused": reused}))


if __name__ == "__main__":
    main()
