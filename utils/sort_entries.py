#!/usr/bin/env python3

import json
from pathlib import Path

# Order in which genres should appear
GENRE_ORDER = [
    "Pop",
    "HipHop",
    "Indie",
    "Rock",
    "R&B",
]


def main():
    root_dir = Path(__file__).resolve().parent.parent
    artists_path = root_dir / "data" / "artists.json"

    # Load artists
    with open(artists_path, "r", encoding="utf-8") as f:
        artists = json.load(f)

    sorted_artists = []

    # Sort each genre separately by popularity
    for genre in GENRE_ORDER:
        genre_artists = [
            artist for artist in artists
            if artist.get("genre") == genre
        ]

        genre_artists.sort(key=lambda artist: artist.get("popularity", float("inf")))

        sorted_artists.extend(genre_artists)

    # Append any artists with unknown genres (alphabetically by genre, then popularity)
    remaining = [
        artist for artist in artists
        if artist.get("genre") not in GENRE_ORDER
    ]

    remaining.sort(
        key=lambda artist: (
            artist.get("genre", ""),
            artist.get("popularity", float("inf"))
        )
    )

    sorted_artists.extend(remaining)

    # Save the sorted list
    with open(artists_path, "w", encoding="utf-8") as f:
        json.dump(sorted_artists, f, indent=2, ensure_ascii=False)

    print(f"Sorted {len(sorted_artists)} artists.")


if __name__ == "__main__":
    main()