import os

# Path to the directory containing the .jpg files
icons_dir = "/data/icons"

# Iterate through all files in the directory
for filename in os.listdir(icons_dir):
    # Check if the file is a .jpg file
    if filename.endswith(".jpg"):
        # Create the new filename by replacing spaces with underscores
        new_filename = filename.replace(" ", "_")
        
        # Get the full paths for the old and new filenames
        old_path = os.path.join(icons_dir, filename)
        new_path = os.path.join(icons_dir, new_filename)
        
        # Rename the file
        os.rename(old_path, new_path)
        print(f"Renamed: {filename} -> {new_filename}")

print("Filename normalization complete.")