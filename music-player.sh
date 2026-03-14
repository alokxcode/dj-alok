#!/bin/bash

# Music Player Launcher Script

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Default music folder
MUSIC_FOLDER="${HOME}/Music"

# Check if music folder exists
if [ ! -d "$MUSIC_FOLDER" ]; then
    zenity --error --text="Music folder not found: $MUSIC_FOLDER\nPlease update config.json" 2>/dev/null || \
    notify-send "Music Player Error" "Music folder not found: $MUSIC_FOLDER" 2>/dev/null || \
    echo "Error: Music folder not found: $MUSIC_FOLDER"
    exit 1
fi

# Ensure DISPLAY is set for GUI applications
export DISPLAY="${DISPLAY:-:0}"

# Start the music player with native window
"$DIR/music-player" -music "$MUSIC_FOLDER" >> /tmp/music-player.log 2>&1
