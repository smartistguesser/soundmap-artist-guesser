import os
import json
import requests
from pathlib import Path
from dotenv import load_dotenv  # Import dotenv
import time

# Load environment variables
load_dotenv()

# Spotify API credentials
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")

print(f"CLIENT_ID: {CLIENT_ID}, CLIENT_SECRET: {CLIENT_SECRET}")

# Paths
ARTISTS_JSON_PATH = "./data/artists.json"
ICONS_FOLDER = "./data/icons"

# Create icons folder if it doesn't exist
Path(ICONS_FOLDER).mkdir(parents=True, exist_ok=True)

# Get Spotify API token
def get_spotify_token():
    url = "https://accounts.spotify.com/api/token"
    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET
    }
    response = requests.post(url, headers=headers, data=data)
    response.raise_for_status()
    return response.json()["access_token"]

# Fetch artist profile picture from Spotify
def fetch_artist_image(artist_name, token):
    url = "https://api.spotify.com/v1/search"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    params = {
        "q": artist_name,
        "type": "artist",
        "limit": 1
    }
    while True:
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 429:  # Rate limit hit
            retry_after = int(response.headers.get("Retry-After", 1))  # Default to 1 second if not provided
            print(f"Rate limit hit. Retrying after {retry_after} seconds...")
            time.sleep(retry_after)
        else:
            response.raise_for_status()
            break
    data = response.json()
    items = data.get("artists", {}).get("items", [])
    if items:
        return items[0].get("images", [{}])[0].get("url")  # Return the first image URL
    return None

# Download and save image
def download_image(url, save_path):
    response = requests.get(url)
    response.raise_for_status()
    with open(save_path, "wb") as f:
        f.write(response.content)

# Main function
def main():
    # Load artists from JSON
    with open(ARTISTS_JSON_PATH, "r", encoding="utf-8") as f:
        artists = json.load(f)

    # Get Spotify token
    token = get_spotify_token()

    # Fetch and save images
    for artist in artists:
        artist_name = artist.get("name")
        if not artist_name:
            continue

        # Check if the image already exists
        save_path = os.path.join(ICONS_FOLDER, f"{artist_name}.jpg")
        if os.path.exists(save_path):
            print(f"Image already exists for: {artist_name}, skipping...")
            continue

        print(f"Fetching image for: {artist_name}")
        try:
            image_url = fetch_artist_image(artist_name, token)
            if image_url:
                download_image(image_url, save_path)
                print(f"Saved: {save_path}")
            else:
                print(f"No image found for: {artist_name}")
        except Exception as e:
            print(f"Error fetching image for {artist_name}: {e}")

if __name__ == "__main__":
    main()