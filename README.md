# Music Player

A fast, minimalist music player for Linux built with Go and vanilla HTML/CSS/JS.

## Features

- 🎵 **Fast Performance** - Built with Go for lightning-fast audio streaming
- 🎨 **Minimalist UI** - Clean, premium dark theme with zero clutter
- 🔍 **Smart Search** - Instant search across songs, artists, and albums
- 🎧 **Full Playback Control** - Play/pause, skip, shuffle, repeat modes
- 🖼️ **Album Art** - Displays embedded album artwork
- ⚡ **Multi-Format Support** - MP3, FLAC, WAV, M4A, OGG
- 📁 **Auto Library Scanning** - Automatically indexes your music collection
- ⌨️ **Keyboard Shortcuts** - Space to play/pause, arrows to skip

## Requirements

- Go 1.16 or higher
- Linux (or any OS with Go support)
- A folder with your music files

## Installation

1. **Clone or download** this project

2. **Install Go dependencies:**
```bash
go mod init music-player
go get github.com/dhowden/tag
```

3. **Configure your music folder:**

Edit `config.json` or use the command line flag:
```json
{
  "music_folder": "/path/to/your/music",
  "port": 8080,
  "auto_scan": true
}
```

## Usage

### Option 1: Quick Start (Launcher Script)
```bash
./music-player.sh
```
This automatically starts the server and opens your browser.

### Option 2: Direct Binary
```bash
./music-player -music ~/Music
```
Then open http://localhost:8080 in your browser.

### Option 3: Install System-Wide
```bash
./install.sh
```
After installation:
- Run from terminal: `music-player -music ~/Music`
- Find "Music Player" in your application menu
- Or run: `~/.local/share/music-player/music-player.sh`

## Access

The app automatically opens in your browser at:
```
http://localhost:8080
```

## Keyboard Shortcuts

- `Space` - Play/Pause
- `→` - Next song
- `←` - Previous song
- `/` - Focus search

## Project Structure

```
music-player/
├── main.go          # Entry point & configuration
├── library.go       # Music library scanner & metadata extraction
├── server.go        # HTTP server & API endpoints
├── config.json      # Configuration file
├── static/
│   ├── index.html   # UI structure
│   ├── style.css    # Premium minimalist theme
│   └── app.js       # Player logic
└── README.md
```

## API Endpoints

- `GET /api/songs` - Get all songs (supports `?q=search` query)
- `GET /api/stream/{id}` - Stream audio file
- `GET /api/art/{id}` - Get album artwork
- `POST /api/scan` - Rescan music library

## Technology Stack

- **Backend:** Go (stdlib + dhowden/tag for metadata)
- **Frontend:** Pure HTML5/CSS3/JavaScript (no frameworks)
- **Audio:** Native HTML5 Audio API

## Features in Detail

### Audio Playback
- Seamless streaming with range request support for seeking
- Automatic next song playback
- Shuffle and repeat modes (off/all/one)
- Volume control with persistence

### Library Management
- Recursive folder scanning
- Automatic metadata extraction (ID3 tags)
- Album art extraction and caching
- Sorting by artist, album, and title

### User Interface
- Responsive grid layout
- Search with real-time filtering
- Visual feedback for current song
- Progress bar with seek support
- Clean, distraction-free design

## Performance

- **Startup:** Sub-second for libraries under 1000 songs
- **Search:** Instant client-side filtering
- **Streaming:** Zero-latency playback with HTTP range requests
- **Memory:** ~10-50MB depending on library size

## License

MIT License - Feel free to use and modify!

## Tips

1. **Large Libraries:** The player handles thousands of songs efficiently
2. **Formats:** Ensure your audio files have proper ID3 tags for best experience
3. **Artwork:** Embed album art in your files for display
4. **Organization:** The player automatically sorts by Artist → Album → Title

## Troubleshooting

**No songs showing up?**
- Check that `music_folder` path is correct
- Ensure files are in supported formats
- Click the refresh button to rescan

**Audio not playing?**
- Check browser console for errors
- Verify file permissions
- Try a different browser (Chrome/Firefox recommended)

**Port already in use?**
- Change port in config.json or use `-port` flag

---

**Built with ❤️ for music lovers who appreciate simplicity and speed**
