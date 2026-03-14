#!/bin/bash

# Music Player Installation Script

echo "Installing Music Player..."

# Get installation directory
INSTALL_DIR="$HOME/.local/share/music-player"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"

# Create directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"
mkdir -p "$DESKTOP_DIR"

# Copy binary and static files
echo "Copying files..."
cp -r . "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/music-player"
chmod +x "$INSTALL_DIR/music-player.sh"

# Create symlink in bin
ln -sf "$INSTALL_DIR/music-player" "$BIN_DIR/music-player"

# Copy desktop file
sed "s|/home/alok/alokxcode/music player|$INSTALL_DIR|g" music-player.desktop > "$DESKTOP_DIR/music-player.desktop"
chmod +x "$DESKTOP_DIR/music-player.desktop"

# Update desktop database
if command -v update-desktop-database > /dev/null; then
    update-desktop-database "$DESKTOP_DIR"
fi

echo ""
echo "✓ Installation complete!"
echo ""
echo "You can now:"
echo "  1. Run from terminal: music-player -music ~/Music"
echo "  2. Run launcher script: $INSTALL_DIR/music-player.sh"
echo "  3. Search for 'Music Player' in your application menu"
echo ""
