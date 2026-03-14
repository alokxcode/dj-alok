package main

import (
	"bufio"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/dhowden/tag"
)

//go:embed static/*
var staticFiles embed.FS

// Server handles HTTP requests
type Server struct {
	Port            int
	Library         *Library
	PlaylistManager *PlaylistManager
	lastHeartbeat   time.Time
	heartbeatMutex  sync.RWMutex
	shutdownChan    chan bool
}

// NewServer creates a new server instance
func NewServer(port int, library *Library, playlists *PlaylistManager) *Server {
	return &Server{
		Port:            port,
		Library:         library,
		PlaylistManager: playlists,
		lastHeartbeat:   time.Now(),
		shutdownChan:    make(chan bool, 1),
	}
}

// SetupRoutes configures all HTTP routes
func (s *Server) SetupRoutes() {
	// API routes
	http.HandleFunc("/api/songs", s.handleSongs)
	http.HandleFunc("/api/songs/delete/", s.handleDeleteSong)
	http.HandleFunc("/api/stream/", s.handleStream)
	http.HandleFunc("/api/art/", s.handleArt)
	http.HandleFunc("/api/scan", s.handleScan)
	http.HandleFunc("/api/heartbeat", s.handleHeartbeat)
	http.HandleFunc("/api/shutdown", s.handleShutdown)

	// Playlist routes
	http.HandleFunc("/api/playlists", s.handlePlaylists)
	http.HandleFunc("/api/playlists/", s.handlePlaylistDetail)

	// Download routes
	http.HandleFunc("/api/download", s.handleDownload)

	// Lyrics routes
	http.HandleFunc("/api/lyrics", s.handleLyrics)

	// Static files - serve from the "static" subdirectory
	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		log.Fatalf("failed to create static file system: %v", err)
	}
	http.Handle("/", http.FileServer(http.FS(staticFS)))

	// Start heartbeat monitor
	go s.monitorHeartbeat()
}

// handleShutdown receives explicit shutdown request from frontend
func (s *Server) handleShutdown(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	log.Println("Received shutdown request from browser")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "shutting down"})

	// Trigger shutdown immediately
	go func() {
		time.Sleep(100 * time.Millisecond) // Brief delay to send response
		select {
		case s.shutdownChan <- true:
		default:
		}
	}()
}

// handleHeartbeat receives heartbeat from frontend
func (s *Server) handleHeartbeat(w http.ResponseWriter, r *http.Request) {
	s.heartbeatMutex.Lock()
	s.lastHeartbeat = time.Now()
	s.heartbeatMutex.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// monitorHeartbeat checks for inactive frontend and triggers shutdown
func (s *Server) monitorHeartbeat() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		s.heartbeatMutex.RLock()
		timeSinceLastBeat := time.Since(s.lastHeartbeat)
		s.heartbeatMutex.RUnlock()

		// If no heartbeat for 15 seconds, assume browser is closed
		if timeSinceLastBeat > 15*time.Second {
			select {
			case s.shutdownChan <- true:
			default:
			}
			return
		}
	}
}

// ShutdownSignal returns the channel for shutdown notifications
func (s *Server) ShutdownSignal() <-chan bool {
	return s.shutdownChan
}

// Start starts the HTTP server (kept for backward compatibility)
func (s *Server) Start() error {
	s.SetupRoutes()
	return http.ListenAndServe(fmt.Sprintf(":%d", s.Port), nil)
}

// handleSongs returns the list of all songs
func (s *Server) handleSongs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	songs := s.Library.GetSongs()

	// Filter by search query if provided
	query := strings.ToLower(r.URL.Query().Get("q"))
	if query != "" {
		filtered := make([]Song, 0)
		for _, song := range songs {
			if strings.Contains(strings.ToLower(song.Title), query) ||
				strings.Contains(strings.ToLower(song.Artist), query) ||
				strings.Contains(strings.ToLower(song.Album), query) {
				filtered = append(filtered, song)
			}
		}
		songs = filtered
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(songs)
}

// handleDeleteSong deletes a song file from the library
func (s *Server) handleDeleteSong(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract song ID from URL
	id := strings.TrimPrefix(r.URL.Path, "/api/songs/delete/")
	if id == "" {
		http.Error(w, "Song ID required", http.StatusBadRequest)
		return
	}

	song := s.Library.GetSongByID(id)
	if song == nil {
		http.Error(w, "Song not found", http.StatusNotFound)
		return
	}

	// Delete the actual file
	err := os.Remove(song.Path)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to delete file: %v", err), http.StatusInternalServerError)
		return
	}

	// Remove from library
	s.Library.mutex.Lock()
	newSongs := make([]Song, 0)
	for _, s := range s.Library.Songs {
		if s.ID != id {
			newSongs = append(newSongs, s)
		}
	}
	s.Library.Songs = newSongs
	s.Library.mutex.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Song deleted successfully"})
}

// handleStream streams audio file
func (s *Server) handleStream(w http.ResponseWriter, r *http.Request) {
	// Extract song ID from URL
	id := strings.TrimPrefix(r.URL.Path, "/api/stream/")
	if id == "" {
		http.Error(w, "Song ID required", http.StatusBadRequest)
		return
	}

	song := s.Library.GetSongByID(id)
	if song == nil {
		http.Error(w, "Song not found", http.StatusNotFound)
		return
	}

	// Open audio file
	file, err := os.Open(song.Path)
	if err != nil {
		http.Error(w, "Failed to open file", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	// Get file info
	stat, err := file.Stat()
	if err != nil {
		http.Error(w, "Failed to stat file", http.StatusInternalServerError)
		return
	}

	// Set appropriate content type
	contentType := getContentType(song.Format)
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", stat.Size()))

	// Handle range requests for seeking
	rangeHeader := r.Header.Get("Range")
	if rangeHeader != "" {
		http.ServeContent(w, r, song.FileName, stat.ModTime(), file)
		return
	}

	// Stream the file
	io.Copy(w, file)
}

// handleArt returns album artwork
func (s *Server) handleArt(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/art/")
	if id == "" {
		http.Error(w, "Song ID required", http.StatusBadRequest)
		return
	}

	song := s.Library.GetSongByID(id)
	if song == nil || !song.HasArt {
		http.Error(w, "Art not found", http.StatusNotFound)
		return
	}

	file, err := os.Open(song.Path)
	if err != nil {
		http.Error(w, "Failed to open file", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	metadata, err := tag.ReadFrom(file)
	if err != nil || metadata.Picture() == nil {
		http.Error(w, "Art not found", http.StatusNotFound)
		return
	}

	picture := metadata.Picture()
	w.Header().Set("Content-Type", picture.MIMEType)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Write(picture.Data)
}

// handleScan rescans the music library
func (s *Server) handleScan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	log.Println("Rescanning music library...")
	if err := s.Library.Scan(); err != nil {
		http.Error(w, "Scan failed", http.StatusInternalServerError)
		return
	}

	log.Printf("Scan complete. Found %d songs", len(s.Library.Songs))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"count":   len(s.Library.Songs),
	})
}

// handlePlaylists handles GET and POST for playlists
func (s *Server) handlePlaylists(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		playlists := s.PlaylistManager.GetAll()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(playlists)

	case http.MethodPost:
		var req struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		if req.Name == "" {
			http.Error(w, "Name is required", http.StatusBadRequest)
			return
		}

		playlist, err := s.PlaylistManager.Create(req.Name, req.Description)
		if err != nil {
			http.Error(w, "Failed to create playlist", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(playlist)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handlePlaylistDetail handles operations on specific playlists
func (s *Server) handlePlaylistDetail(w http.ResponseWriter, r *http.Request) {
	// Parse URL: /api/playlists/{id} or /api/playlists/{id}/songs or /api/playlists/{id}/songs/{songId}
	path := strings.TrimPrefix(r.URL.Path, "/api/playlists/")
	parts := strings.Split(path, "/")

	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, "Playlist ID required", http.StatusBadRequest)
		return
	}

	playlistID := parts[0]

	// Check if it's a songs operation
	if len(parts) >= 2 && parts[1] == "songs" {
		s.handlePlaylistSongs(w, r, playlistID, parts[2:])
		return
	}

	// Handle playlist CRUD
	switch r.Method {
	case http.MethodGet:
		playlist, err := s.PlaylistManager.Get(playlistID)
		if err != nil {
			http.Error(w, "Playlist not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(playlist)

	case http.MethodPut:
		var req struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		playlist, err := s.PlaylistManager.Update(playlistID, req.Name, req.Description)
		if err != nil {
			http.Error(w, "Failed to update playlist", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(playlist)

	case http.MethodDelete:
		if err := s.PlaylistManager.Delete(playlistID); err != nil {
			http.Error(w, "Failed to delete playlist", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"success": true})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handlePlaylistSongs handles adding/removing songs from playlists
func (s *Server) handlePlaylistSongs(w http.ResponseWriter, r *http.Request, playlistID string, parts []string) {
	switch r.Method {
	case http.MethodPost:
		// Add songs to playlist
		var req struct {
			SongIDs []string `json:"song_ids"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		if err := s.PlaylistManager.AddSongs(playlistID, req.SongIDs); err != nil {
			http.Error(w, "Failed to add songs", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"success": true})

	case http.MethodDelete:
		// Remove specific song from playlist
		if len(parts) == 0 || parts[0] == "" {
			http.Error(w, "Song ID required", http.StatusBadRequest)
			return
		}

		songID := parts[0]
		if err := s.PlaylistManager.RemoveSong(playlistID, songID); err != nil {
			http.Error(w, "Failed to remove song", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"success": true})

	case http.MethodPut:
		// Reorder songs in playlist
		var req struct {
			SongIDs []string `json:"song_ids"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		if err := s.PlaylistManager.Reorder(playlistID, req.SongIDs); err != nil {
			http.Error(w, "Failed to reorder songs", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"success": true})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// getContentType returns the appropriate content type for an audio format
func getContentType(format string) string {
	switch format {
	case "mp3":
		return "audio/mpeg"
	case "flac":
		return "audio/flac"
	case "wav":
		return "audio/wav"
	case "m4a":
		return "audio/mp4"
	case "ogg":
		return "audio/ogg"
	default:
		return "application/octet-stream"
	}
}

// DownloadRequest represents a download request
type DownloadRequest struct {
	URL string `json:"url"`
}

// DownloadResponse represents the download response
type DownloadResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	SongID  string `json:"song_id,omitempty"`
}

// DownloadStatus represents download progress
type DownloadStatus struct {
	InProgress bool   `json:"in_progress"`
	Progress   int    `json:"progress"`
	Message    string `json:"message"`
	Error      string `json:"error,omitempty"`
}

var downloadStatus = DownloadStatus{}
var downloadMutex sync.RWMutex

// handleDownload processes YouTube/Spotify download requests
func (s *Server) handleDownload(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		return
	}

	if r.Method == "GET" {
		// Return current download status
		downloadMutex.RLock()
		status := downloadStatus
		downloadMutex.RUnlock()
		json.NewEncoder(w).Encode(status)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req DownloadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		json.NewEncoder(w).Encode(DownloadResponse{
			Success: false,
			Message: "Invalid request format",
		})
		return
	}

	if req.URL == "" {
		json.NewEncoder(w).Encode(DownloadResponse{
			Success: false,
			Message: "URL is required",
		})
		return
	}

	// Check if already downloading
	downloadMutex.RLock()
	inProgress := downloadStatus.InProgress
	downloadMutex.RUnlock()

	if inProgress {
		json.NewEncoder(w).Encode(DownloadResponse{
			Success: false,
			Message: "Another download is already in progress",
		})
		return
	}

	// Start download in background
	go s.downloadSong(req.URL)

	json.NewEncoder(w).Encode(DownloadResponse{
		Success: true,
		Message: "Download started",
	})
}

// downloadSong downloads a song from YouTube/Spotify URL
func (s *Server) downloadSong(url string) {
	downloadMutex.Lock()
	downloadStatus = DownloadStatus{
		InProgress: true,
		Progress:   0,
		Message:    "Starting download...",
	}
	downloadMutex.Unlock()

	defer func() {
		downloadMutex.Lock()
		downloadStatus.InProgress = false
		downloadMutex.Unlock()
	}()

	// Update status
	updateStatus := func(progress int, message string, err string) {
		downloadMutex.Lock()
		downloadStatus.Progress = progress
		downloadStatus.Message = message
		downloadStatus.Error = err
		downloadMutex.Unlock()
	}

	updateStatus(0, "Starting download...", "")

	// Create downloads directory
	downloadDir := filepath.Join(s.Library.MusicFolder, "Downloads")
	if err := os.MkdirAll(downloadDir, 0755); err != nil {
		updateStatus(0, "", fmt.Sprintf("Failed to create download directory: %v", err))
		return
	}

	// Get user's home directory for yt-dlp path
	homeDir, err := os.UserHomeDir()
	if err != nil {
		updateStatus(0, "", fmt.Sprintf("Failed to get user home directory: %v", err))
		return
	}

	ytdlpPath := filepath.Join(homeDir, ".local", "bin", "yt-dlp")

	// Check if user-installed yt-dlp exists, otherwise use system version
	if _, err := os.Stat(ytdlpPath); os.IsNotExist(err) {
		ytdlpPath = "yt-dlp"
	}

	// Convert YouTube Music URLs to regular YouTube URLs
	processedURL := url
	if strings.Contains(url, "music.youtube.com") {
		processedURL = strings.Replace(url, "music.youtube.com", "youtube.com", 1)
		updateStatus(0, "Converting YouTube Music URL...", "")
	}

	// Use yt-dlp to download the audio with progress reporting
	// Include video ID in filename to avoid conflicts when songs have the same title
	cmd := exec.Command(ytdlpPath,
		"--extract-audio",
		"--audio-format", "mp3",
		"--audio-quality", "0",
		"--output", filepath.Join(downloadDir, "%(title)s-%(id)s.%(ext)s"),
		"--no-playlist",
		"--embed-metadata",
		"--add-metadata",
		"--embed-thumbnail", // Embed thumbnail as album art in MP3
		"--newline",         // Force progress on new lines for easier parsing
		"--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
		"--no-check-certificate",
		"--prefer-free-formats",
		"--ignore-errors",
		processedURL,
	)

	// Create pipes for stdout and stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		updateStatus(0, "", fmt.Sprintf("Failed to create stdout pipe: %v", err))
		return
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		updateStatus(0, "", fmt.Sprintf("Failed to create stderr pipe: %v", err))
		return
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		updateStatus(0, "", fmt.Sprintf("Failed to start download: %v", err))
		return
	}

	// Regular expressions for parsing yt-dlp output
	downloadRegex := regexp.MustCompile(`\[download\]\s+([0-9.]+)%`)
	speedRegex := regexp.MustCompile(`at\s+([0-9.]+[KMG]iB/s)`)
	etaRegex := regexp.MustCompile(`ETA\s+([0-9:]+)`)

	var outputLines []string
	var lastProgress int

	// Read output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			outputLines = append(outputLines, line)
			log.Println("yt-dlp:", line)

			// Parse download progress
			if matches := downloadRegex.FindStringSubmatch(line); len(matches) > 1 {
				if progress, err := strconv.ParseFloat(matches[1], 64); err == nil {
					progressInt := int(progress)
					// Use actual progress percentage directly (0-100%)
					if progressInt > lastProgress {
						lastProgress = progressInt

						// Extract speed and ETA
						speed := ""
						eta := ""
						if speedMatches := speedRegex.FindStringSubmatch(line); len(speedMatches) > 1 {
							speed = speedMatches[1]
						}
						if etaMatches := etaRegex.FindStringSubmatch(line); len(etaMatches) > 1 {
							eta = etaMatches[1]
						}

						message := fmt.Sprintf("Downloading: %d%%", progressInt)
						if speed != "" {
							message += fmt.Sprintf(" at %s", speed)
						}
						if eta != "" {
							message += fmt.Sprintf(" (ETA: %s)", eta)
						}

						updateStatus(progressInt, message, "")
					}
				}
			}

			// Detect post-processing
			if strings.Contains(line, "[ExtractAudio]") || strings.Contains(line, "[ffmpeg]") {
				// Only show converting if download reached 100%
				if lastProgress >= 100 {
					updateStatus(100, "Converting to MP3...", "")
				}
			}
		}
	}()

	// Read stderr for errors
	var errorOutput strings.Builder
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			log.Println("yt-dlp error:", line)
			errorOutput.WriteString(line + "\n")
		}
	}()

	// Wait for command to finish
	err = cmd.Wait()
	if err != nil {
		outputStr := errorOutput.String() + strings.Join(outputLines, "\n")
		var errorMessage string

		// Provide more user-friendly error messages
		if strings.Contains(outputStr, "Sign in to confirm you're not a bot") {
			errorMessage = "YouTube is blocking downloads. Try using a regular YouTube URL instead of YouTube Music, or try again later."
		} else if strings.Contains(outputStr, "Video unavailable") {
			errorMessage = "Video is unavailable or private. Please check the URL and try again."
		} else if strings.Contains(outputStr, "Signature extraction failed") {
			errorMessage = "YouTube has updated their protection. Try a different URL or try again later."
		} else if strings.Contains(outputStr, "HTTP Error 403") {
			errorMessage = "Access denied by YouTube. The video might be region-blocked or age-restricted."
		} else if strings.Contains(outputStr, "HTTP Error 404") {
			errorMessage = "Video not found. Please check the URL."
		} else {
			errorMessage = fmt.Sprintf("Download failed: %v", err)
		}

		updateStatus(0, "", errorMessage)
		return
	}

	updateStatus(100, "Scanning library...", "")

	// Rescan the library to include the new song
	if err := s.Library.Scan(); err != nil {
		updateStatus(0, "", fmt.Sprintf("Failed to rescan library: %v", err))
		return
	}

	// Try to fetch lyrics from YouTube
	updateStatus(100, "Fetching lyrics...", "")
	s.fetchAndSaveLyrics(processedURL, downloadDir)

	updateStatus(100, "Download completed successfully!", "")
	log.Printf("Successfully downloaded song from: %s", url)
}

// fetchAndSaveLyrics attempts to fetch lyrics from YouTube/YouTube Music using yt-dlp
func (s *Server) fetchAndSaveLyrics(url string, downloadDir string) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Printf("Failed to get home directory for lyrics fetch: %v", err)
		return
	}

	ytdlpPath := filepath.Join(homeDir, ".local", "bin", "yt-dlp")
	if _, err := os.Stat(ytdlpPath); os.IsNotExist(err) {
		ytdlpPath = "yt-dlp"
	}

	// Get the list of MP3 files before fetching lyrics
	existingMp3s, _ := filepath.Glob(filepath.Join(downloadDir, "*.mp3"))
	existingMap := make(map[string]bool)
	for _, f := range existingMp3s {
		existingMap[f] = true
	}

	var lyrics string

	// Check if it's YouTube Music - try to get description which often contains lyrics
	if strings.Contains(url, "music.youtube.com") {
		log.Printf("Detected YouTube Music URL, attempting to fetch lyrics from description...")
		descCmd := exec.Command(ytdlpPath,
			"--get-description",
			"--no-warnings",
			url,
		)

		descOutput, err := descCmd.Output()
		if err == nil && len(descOutput) > 0 {
			description := strings.TrimSpace(string(descOutput))
			// Check if description contains lyrics-like content
			if len(description) > 100 && strings.Contains(strings.ToLower(description), "\n") {
				// Format description as simple lyrics (no timestamps for YouTube Music)
				lyrics = description
				log.Printf("Found lyrics in YouTube Music description")
			}
		}
	}

	// If no lyrics from description, try subtitles (for regular YouTube videos)
	if lyrics == "" {
		log.Printf("Attempting to fetch lyrics from subtitles...")
		tempOutput := filepath.Join(downloadDir, "temp_lyrics")
		subsCmd := exec.Command(ytdlpPath,
			"--skip-download",
			"--write-auto-subs",
			"--write-subs",
			"--sub-langs", "en.*,en",
			"--sub-format", "srv3",
			"--output", tempOutput,
			"--no-warnings",
			url,
		)

		if err := subsCmd.Run(); err == nil {
			// Look for subtitle files
			srtFiles, err := filepath.Glob(tempOutput + "*.srv3")
			if err != nil || len(srtFiles) == 0 {
				srtFiles, _ = filepath.Glob(tempOutput + "*.srt")
			}

			if len(srtFiles) > 0 {
				// Read and parse the subtitle file
				lyricsContent, err := os.ReadFile(srtFiles[0])
				if err == nil {
					// Parse SRT/SRV3 format to extract lyrics with timestamps
					lyrics = s.parseSubtitles(string(lyricsContent))
					log.Printf("Found lyrics in subtitles")
				}
				// Clean up subtitle file
				os.Remove(srtFiles[0])
			}
		}
	}

	if lyrics == "" {
		log.Printf("No lyrics found for this track")
		return
	}

	// Find the newly downloaded MP3 file (the one that wasn't there before)
	allMp3s, err := filepath.Glob(filepath.Join(downloadDir, "*.mp3"))
	if err != nil {
		log.Printf("Could not scan for MP3 files")
		return
	}

	var newMp3 string
	for _, f := range allMp3s {
		if !existingMap[f] {
			newMp3 = f
			break
		}
	}

	if newMp3 == "" {
		log.Printf("Could not find newly downloaded MP3 file")
		return
	}

	// Save lyrics for the song
	data, err := loadLyrics()
	if err != nil {
		log.Printf("Failed to load lyrics data: %v", err)
		return
	}

	data.Lyrics[newMp3] = lyrics
	if err := saveLyrics(data); err != nil {
		log.Printf("Failed to save lyrics: %v", err)
		return
	}

	log.Printf("Successfully fetched and saved lyrics for: %s", filepath.Base(newMp3))
}

// parseSubtitles extracts lyrics text with timestamps from subtitle format
func (s *Server) parseSubtitles(content string) string {
	lines := strings.Split(content, "\n")
	var result strings.Builder
	var lastTimestamp string

	for i := 0; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])

		// Skip empty lines and sequence numbers
		if line == "" || (len(line) < 10 && !strings.Contains(line, ":")) {
			continue
		}

		// Check if this is a timestamp line (SRT format: 00:00:10,500 --> 00:00:13,500)
		if strings.Contains(line, "-->") {
			parts := strings.Split(line, "-->")
			if len(parts) == 2 {
				timestamp := strings.TrimSpace(parts[0])
				// Convert timestamp to simple format [MM:SS.ms]
				timestamp = strings.Replace(timestamp, ",", ".", 1)
				if len(timestamp) > 6 {
					timestamp = timestamp[3:] // Remove hours if present (00:MM:SS)
				}
				lastTimestamp = "[" + timestamp + "]"
			}
			continue
		}

		// This is lyrics text
		if line != "" && lastTimestamp != "" && !strings.HasPrefix(line, "[") {
			// Remove HTML tags if any
			line = regexp.MustCompile(`<[^>]*>`).ReplaceAllString(line, "")
			if line != "" {
				result.WriteString(lastTimestamp + " " + line + "\n")
			}
		}
	}

	return result.String()
}

// Lyrics storage structure
type LyricsData struct {
	Lyrics map[string]string `json:"lyrics"` // key: song path, value: lyrics text
}

var (
	lyricsFile  = "lyrics.json"
	lyricsMutex sync.RWMutex
)

// loadLyrics reads lyrics from the JSON file
func loadLyrics() (*LyricsData, error) {
	lyricsMutex.RLock()
	defer lyricsMutex.RUnlock()

	data := &LyricsData{
		Lyrics: make(map[string]string),
	}

	file, err := os.ReadFile(lyricsFile)
	if err != nil {
		if os.IsNotExist(err) {
			return data, nil // Return empty data if file doesn't exist
		}
		return nil, err
	}

	if err := json.Unmarshal(file, data); err != nil {
		return nil, err
	}

	return data, nil
}

// saveLyrics writes lyrics to the JSON file
func saveLyrics(data *LyricsData) error {
	lyricsMutex.Lock()
	defer lyricsMutex.Unlock()

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(lyricsFile, jsonData, 0644)
}

// handleLyrics handles GET and POST requests for lyrics
func (s *Server) handleLyrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		// Get lyrics for a specific song
		songPath := r.URL.Query().Get("path")
		if songPath == "" {
			http.Error(w, "Missing song path", http.StatusBadRequest)
			return
		}

		data, err := loadLyrics()
		if err != nil {
			log.Printf("Error loading lyrics: %v", err)
			http.Error(w, "Failed to load lyrics", http.StatusInternalServerError)
			return
		}

		lyrics := data.Lyrics[songPath]
		response := map[string]string{
			"lyrics": lyrics,
			"path":   songPath,
		}

		json.NewEncoder(w).Encode(response)

	case http.MethodPost:
		// Save lyrics for a specific song
		var req struct {
			Path   string `json:"path"`
			Lyrics string `json:"lyrics"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if req.Path == "" {
			http.Error(w, "Missing song path", http.StatusBadRequest)
			return
		}

		data, err := loadLyrics()
		if err != nil {
			log.Printf("Error loading lyrics: %v", err)
			http.Error(w, "Failed to load lyrics", http.StatusInternalServerError)
			return
		}

		if req.Lyrics == "" {
			// Delete lyrics if empty
			delete(data.Lyrics, req.Path)
		} else {
			// Save lyrics
			data.Lyrics[req.Path] = req.Lyrics
		}

		if err := saveLyrics(data); err != nil {
			log.Printf("Error saving lyrics: %v", err)
			http.Error(w, "Failed to save lyrics", http.StatusInternalServerError)
			return
		}

		response := map[string]string{
			"status": "success",
			"path":   req.Path,
		}

		json.NewEncoder(w).Encode(response)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
