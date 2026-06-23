import json

# Path to the JSON file
json_file_path = "data/artists.json"

# Load the JSON data
with open(json_file_path, "r") as file:
    artists = json.load(file)

# Find artists without the "updated" attribute
artists_without_updated = [artist for artist in artists if "updated" not in artist]

# Print the results
print(f"Found {len(artists_without_updated)} artists without the 'updated' attribute.")
for artist in artists_without_updated:
    print(artist)