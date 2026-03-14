#!/bin/bash
# Setup script to ensure yt-dlp is available

# Add local bin to PATH if not already there
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    export PATH="$PATH:$HOME/.local/bin"
fi

# Check yt-dlp version
if command -v yt-dlp &> /dev/null; then
    echo "yt-dlp version: $(yt-dlp --version)"
    echo "yt-dlp path: $(which yt-dlp)"
else
    echo "yt-dlp not found in PATH"
    echo "Installing yt-dlp..."
    pip3 install --user --upgrade yt-dlp
fi

# Make sure PATH is in .bashrc for future sessions
if ! grep -q "$HOME/.local/bin" ~/.bashrc; then
    echo 'export PATH="$PATH:$HOME/.local/bin"' >> ~/.bashrc
    echo "Added local bin to .bashrc"
fi

echo "Setup complete!"