package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Playlist represents a user-created playlist
type Playlist struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	SongIDs     []string  `json:"song_ids"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// PlaylistManager manages all playlists
type PlaylistManager struct {
	playlists   map[string]*Playlist
	playlistDir string
	mutex       sync.RWMutex
}

// NewPlaylistManager creates a new playlist manager
func NewPlaylistManager() *PlaylistManager {
	homeDir, _ := os.UserHomeDir()
	playlistDir := filepath.Join(homeDir, ".config", "music-player", "playlists")

	// Create directory if it doesn't exist
	os.MkdirAll(playlistDir, 0755)

	pm := &PlaylistManager{
		playlists:   make(map[string]*Playlist),
		playlistDir: playlistDir,
	}

	// Load existing playlists
	pm.loadPlaylists()

	return pm
}

// loadPlaylists loads all playlists from disk
func (pm *PlaylistManager) loadPlaylists() error {
	files, err := os.ReadDir(pm.playlistDir)
	if err != nil {
		return err
	}

	for _, file := range files {
		if filepath.Ext(file.Name()) == ".json" {
			data, err := os.ReadFile(filepath.Join(pm.playlistDir, file.Name()))
			if err != nil {
				continue
			}

			var playlist Playlist
			if err := json.Unmarshal(data, &playlist); err != nil {
				continue
			}

			pm.playlists[playlist.ID] = &playlist
		}
	}

	return nil
}

// savePlaylists saves a playlist to disk
func (pm *PlaylistManager) savePlaylist(playlist *Playlist) error {
	data, err := json.MarshalIndent(playlist, "", "  ")
	if err != nil {
		return err
	}

	filename := filepath.Join(pm.playlistDir, playlist.ID+".json")
	return os.WriteFile(filename, data, 0644)
}

// GetAll returns all playlists
func (pm *PlaylistManager) GetAll() []*Playlist {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	playlists := make([]*Playlist, 0, len(pm.playlists))
	for _, p := range pm.playlists {
		playlists = append(playlists, p)
	}

	return playlists
}

// Get returns a specific playlist by ID
func (pm *PlaylistManager) Get(id string) (*Playlist, error) {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	playlist, exists := pm.playlists[id]
	if !exists {
		return nil, fmt.Errorf("playlist not found")
	}

	return playlist, nil
}

// Create creates a new playlist
func (pm *PlaylistManager) Create(name, description string) (*Playlist, error) {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	// Generate ID from timestamp
	id := fmt.Sprintf("pl_%d", time.Now().UnixNano())

	playlist := &Playlist{
		ID:          id,
		Name:        name,
		Description: description,
		SongIDs:     []string{},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	pm.playlists[id] = playlist

	if err := pm.savePlaylist(playlist); err != nil {
		delete(pm.playlists, id)
		return nil, err
	}

	return playlist, nil
}

// Update updates an existing playlist
func (pm *PlaylistManager) Update(id, name, description string) (*Playlist, error) {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	playlist, exists := pm.playlists[id]
	if !exists {
		return nil, fmt.Errorf("playlist not found")
	}

	if name != "" {
		playlist.Name = name
	}
	if description != "" {
		playlist.Description = description
	}
	playlist.UpdatedAt = time.Now()

	if err := pm.savePlaylist(playlist); err != nil {
		return nil, err
	}

	return playlist, nil
}

// Delete removes a playlist
func (pm *PlaylistManager) Delete(id string) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	if _, exists := pm.playlists[id]; !exists {
		return fmt.Errorf("playlist not found")
	}

	// Delete file
	filename := filepath.Join(pm.playlistDir, id+".json")
	if err := os.Remove(filename); err != nil && !os.IsNotExist(err) {
		return err
	}

	delete(pm.playlists, id)
	return nil
}

// AddSongs adds songs to a playlist
func (pm *PlaylistManager) AddSongs(id string, songIDs []string) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	playlist, exists := pm.playlists[id]
	if !exists {
		return fmt.Errorf("playlist not found")
	}

	// Add songs, avoiding duplicates
	for _, songID := range songIDs {
		exists := false
		for _, existingID := range playlist.SongIDs {
			if existingID == songID {
				exists = true
				break
			}
		}
		if !exists {
			playlist.SongIDs = append(playlist.SongIDs, songID)
		}
	}

	playlist.UpdatedAt = time.Now()

	return pm.savePlaylist(playlist)
}

// RemoveSong removes a song from a playlist
func (pm *PlaylistManager) RemoveSong(id, songID string) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	playlist, exists := pm.playlists[id]
	if !exists {
		return fmt.Errorf("playlist not found")
	}

	// Remove song
	newSongIDs := []string{}
	for _, sid := range playlist.SongIDs {
		if sid != songID {
			newSongIDs = append(newSongIDs, sid)
		}
	}
	playlist.SongIDs = newSongIDs
	playlist.UpdatedAt = time.Now()

	return pm.savePlaylist(playlist)
}

// Reorder reorders songs in a playlist
func (pm *PlaylistManager) Reorder(id string, songIDs []string) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	playlist, exists := pm.playlists[id]
	if !exists {
		return fmt.Errorf("playlist not found")
	}

	playlist.SongIDs = songIDs
	playlist.UpdatedAt = time.Now()

	return pm.savePlaylist(playlist)
}
