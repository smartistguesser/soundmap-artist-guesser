#!/usr/bin/env python3

import json
from pathlib import Path


def normalize_name(name: str) -> str:
    """Convert artist name to the icon filename format."""
    return name.replace(" ", "_")


def main():
    root_dir = Path(__file__).resolve().parent.parent
    artists_path = root_dir / "data" / "artists.json"
    icons_dir = root_dir / "data" / "icons"

    # Load artists
    with open(artists_path, "r", encoding="utf-8") as f:
        artists = json.load(f)

    # Remove entries with updated=False
    original_count = len(artists)
    artists = [artist for artist in artists if artist.get("updated", False)]
    removed_entries = original_count - len(artists)

    # Save filtered artists.json
    with open(artists_path, "w", encoding="utf-8") as f:
        json.dump(artists, f, indent=2, ensure_ascii=False)

    print(f"Removed {removed_entries} entries from artists.json.")

    # Build set of valid icon filenames
    valid_icons = {
        f"{normalize_name(artist['name'])}.jpg"
        for artist in artists
        if artist.get("name")
    }

    # Delete orphaned icons
    removed_icons = 0
    for icon_path in icons_dir.glob("*.jpg"):
        if icon_path.name not in valid_icons:
            print(f"Deleting orphaned icon: {icon_path.name}")
            icon_path.unlink()
            removed_icons += 1

    print(f"Removed {removed_icons} orphaned icons.")
    print(f"{len(artists)} artists remain.")


if __name__ == "__main__":
    main()