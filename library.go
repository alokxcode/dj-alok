package main

import (
	"crypto/md5"
	"encoding/hex"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/dhowden/tag"
)

// Song represents a music track
type Song struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Artist    string `json:"artist"`
	Album     string `json:"album"`
	Year      int    `json:"year"`
	Duration  int    `json:"duration"` // in seconds
	Path      string `json:"path"`
	FileName  string `json:"filename"`
	Format    string `json:"format"`
	HasArt    bool   `json:"has_art"`
	DateAdded int64  `json:"date_added"` // Unix timestamp
}

// Library manages the music collection
type Library struct {
	MusicFolder string
	Songs       []Song
	mutex       sync.RWMutex
}

// NewLibrary creates a new library instance
func NewLibrary(musicFolder string) *Library {
	return &Library{
		MusicFolder: musicFolder,
		Songs:       make([]Song, 0),
	}
}

// Scan scans the music folder for audio files
func (l *Library) Scan() error {
	l.mutex.Lock()
	defer l.mutex.Unlock()

	l.Songs = make([]Song, 0)
	supportedExts := map[string]bool{
		".mp3":  true,
		".flac": true,
		".wav":  true,
		".m4a":  true,
		".ogg":  true,
	}

	err := filepath.Walk(l.MusicFolder, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip files we can't access
		}

		if info.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if !supportedExts[ext] {
			return nil
		}

		song := l.extractMetadata(path)
		if song != nil {
			l.Songs = append(l.Songs, *song)
		}

		return nil
	})

	// Sort by artist, then album, then title
	sort.Slice(l.Songs, func(i, j int) bool {
		if l.Songs[i].Artist != l.Songs[j].Artist {
			return l.Songs[i].Artist < l.Songs[j].Artist
		}
		if l.Songs[i].Album != l.Songs[j].Album {
			return l.Songs[i].Album < l.Songs[j].Album
		}
		return l.Songs[i].Title < l.Songs[j].Title
	})

	return err
}

// extractMetadata extracts metadata from an audio file
func (l *Library) extractMetadata(path string) *Song {
	file, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer file.Close()

	metadata, err := tag.ReadFrom(file)

	fileName := filepath.Base(path)
	ext := strings.ToLower(filepath.Ext(path))

	// Get file info for date added
	fileInfo, statErr := os.Stat(path)
	dateAdded := time.Now().Unix()
	if statErr == nil {
		dateAdded = fileInfo.ModTime().Unix()
	}

	song := &Song{
		ID:        generateID(path),
		Path:      path,
		FileName:  fileName,
		Format:    strings.TrimPrefix(ext, "."),
		Title:     fileName, // Default to filename
		Artist:    "Unknown Artist",
		Album:     "Unknown Album",
		DateAdded: dateAdded,
	}

	// Extract metadata if available
	if err == nil && metadata != nil {
		if title := metadata.Title(); title != "" {
			song.Title = title
		}
		if artist := metadata.Artist(); artist != "" {
			song.Artist = artist
		}
		if album := metadata.Album(); album != "" {
			song.Album = album
		}
		song.Year = metadata.Year()

		// Check for album art
		if metadata.Picture() != nil {
			song.HasArt = true
		}
	}

	return song
}

// GetSongs returns all songs (thread-safe)
func (l *Library) GetSongs() []Song {
	l.mutex.RLock()
	defer l.mutex.RUnlock()
	return l.Songs
}

// GetSongByID returns a song by ID (thread-safe)
func (l *Library) GetSongByID(id string) *Song {
	l.mutex.RLock()
	defer l.mutex.RUnlock()

	for i := range l.Songs {
		if l.Songs[i].ID == id {
			return &l.Songs[i]
		}
	}
	return nil
}

// generateID generates a unique ID for a file path
func generateID(path string) string {
	hash := md5.Sum([]byte(path))
	return hex.EncodeToString(hash[:])
}
