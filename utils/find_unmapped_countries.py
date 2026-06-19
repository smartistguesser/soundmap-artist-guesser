import json

# Path to the JSON file and the COUNTRY_CONTINENT mapping
json_file_path = "/data/artists.json"

COUNTRY_CONTINENT = {
    "AM": "ASIA", "AR": "SOUTH_AMERICA", "AU": "OCEANIA", "BB": "NORTH_AMERICA", "BE": "EUROPE",
    "BR": "SOUTH_AMERICA", "CA": "NORTH_AMERICA", "CD": "AFRICA", "CL": "SOUTH_AMERICA", "CO": "SOUTH_AMERICA",
    "DE": "EUROPE", "DK": "EUROPE", "DZ": "AFRICA", "ES": "EUROPE", "FR": "EUROPE",
    "GB": "EUROPE", "GH": "AFRICA", "HR": "EUROPE", "HT": "NORTH_AMERICA", "ID": "ASIA",
    "IE": "EUROPE", "IS": "EUROPE", "IT": "EUROPE", "JM": "NORTH_AMERICA", "JP": "ASIA",
    "KG": "ASIA", "KR": "ASIA", "MX": "NORTH_AMERICA", "NG": "AFRICA", "NL": "EUROPE",
    "NO": "EUROPE", "NP": "ASIA", "NZ": "OCEANIA", "PH": "ASIA", "PK": "ASIA",
    "PR": "NORTH_AMERICA", "RO": "EUROPE", "RU": "EUROPE", "SE": "EUROPE", "TR": "ASIA",
    "TZ": "AFRICA", "UA": "EUROPE", "US": "NORTH_AMERICA", "UY": "SOUTH_AMERICA", "VE": "SOUTH_AMERICA",
    "VN": "ASIA", "ZA": "AFRICA", "CL": "SOUTH_AMERICA", "BR": "SOUTH_AMERICA", "AR": "SOUTH_AMERICA",
    "CZ": "EUROPE", "IL": "ASIA", "MA": "AFRICA", "PL": "EUROPE", "TH": "ASIA"
}

# Load the JSON data
with open(json_file_path, "r") as file:
    artists = json.load(file)

# Extract all unique country codes from the artists
country_codes = {artist["country"] for artist in artists if "country" in artist}

# Find unmapped country codes
unmapped_countries = country_codes - COUNTRY_CONTINENT.keys()

# Output the results
print(f"Found {len(unmapped_countries)} unmapped country codes:")
for code in sorted(unmapped_countries):
    print(code)