package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"syscall"
	"time"
)

// Config holds application configuration
type Config struct {
	MusicFolder string `json:"music_folder"`
	Port        int    `json:"port"`
	AutoScan    bool   `json:"auto_scan"`
}

func main() {
	// Command line flags
	configPath := flag.String("config", "config.json", "Path to config file")
	port := flag.Int("port", 8080, "Server port")
	musicFolder := flag.String("music", "", "Music folder path")
	webMode := flag.Bool("web", false, "Run in web browser mode instead of native window")
	flag.Parse()

	// Load or create config
	config := loadConfig(*configPath, *port, *musicFolder)

	// Validate music folder
	if config.MusicFolder == "" {
		log.Fatal("Music folder not specified. Use -music flag or config.json")
	}

	if _, err := os.Stat(config.MusicFolder); os.IsNotExist(err) {
		log.Fatalf("Music folder does not exist: %s", config.MusicFolder)
	}

	// Initialize music library
	library := NewLibrary(config.MusicFolder)
	log.Printf("Scanning music library: %s", config.MusicFolder)
	if err := library.Scan(); err != nil {
		log.Fatalf("Failed to scan library: %v", err)
	}
	log.Printf("Found %d songs", len(library.Songs))

	// Initialize playlist manager
	playlists := NewPlaylistManager()
	log.Printf("Loaded %d playlists", len(playlists.GetAll()))

	url := fmt.Sprintf("http://localhost:%d", config.Port)

	// Check if server is already running
	if isServerRunning(config.Port) {
		log.Printf("Server already running on port %d, opening new browser window", config.Port)
		openBrowser(url)
		return
	}

	// Start HTTP server with proper lifecycle management
	server := NewServer(config.Port, library, playlists)
	shutdownChan := make(chan bool, 1)

	// Setup signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Start server in goroutine
	httpServer := &http.Server{Addr: fmt.Sprintf(":%d", config.Port)}
	server.SetupRoutes()

	go func() {
		log.Printf("Starting server on http://localhost:%d", config.Port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for server to start
	time.Sleep(500 * time.Millisecond)

	if *webMode {
		// Open in browser
		log.Printf("Opening in browser: %s", url)
		openBrowser(url)

		// Monitor for shutdown signals
		go func() {
			select {
			case <-sigChan:
				log.Println("Received interrupt signal")
				shutdownChan <- true
			case <-server.ShutdownSignal():
				log.Println("Browser closed, shutting down server")
				shutdownChan <- true
			}
		}()

		// Wait for shutdown signal
		<-shutdownChan
		log.Println("Shutting down gracefully...")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(ctx); err != nil {
			log.Printf("Error during shutdown: %v", err)
		}
		log.Println("Server stopped")
		os.Exit(0)
	} else {
		// Try to open in native window mode
		if err := openNativeWindow(url); err != nil {
			log.Printf("Failed to open native window: %v", err)
			log.Printf("Falling back to browser mode")
			openBrowser(url)
		}
		select {} // Keep running in native mode
	}
}

// isServerRunning checks if the server is already running on the given port
func isServerRunning(port int) bool {
	timeout := time.Second
	client := http.Client{Timeout: timeout}
	resp, err := client.Get(fmt.Sprintf("http://localhost:%d/api/songs", port))
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// openNativeWindow tries to open the app in a native window using available tools
func openNativeWindow(url string) error {
	// Try electron if available
	if exec.Command("which", "electron").Run() == nil {
		log.Println("Opening in native window...")
		cmd := exec.Command("electron", "--app="+url, "--disable-gpu")
		return cmd.Run()
	}

	// Try to create a minimal HTML wrapper and open with xdg-open
	return fmt.Errorf("no native window support available")
}

// openBrowser opens URL in default browser or app mode
func openBrowser(url string) {
	var cmd *exec.Cmd
	var browserName string

	// Create a separate user data directory for the music player instance
	homeDir, _ := os.UserHomeDir()
	userDataDir := homeDir + "/.config/music-player-app"

	iconPath := "/opt/pt/music.png"

	// Try system-installed Chrome/Chromium FIRST (better app mode support than Flatpak)
	if exec.Command("which", "google-chrome").Run() == nil {
		cmd = exec.Command("google-chrome",
			"--app="+url,
			"--class=DJ ALOK",
			"--name=DJ ALOK",
			"--app-icon="+iconPath,
			"--user-data-dir="+userDataDir,
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-sync",
			"--window-size=1200,2200")
		browserName = "google-chrome"
	} else if exec.Command("which", "chromium").Run() == nil {
		cmd = exec.Command("chromium",
			"--app="+url,
			"--class=DJ ALOK",
			"--name=DJ ALOK",
			"--app-icon="+iconPath,
			"--user-data-dir="+userDataDir,
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-sync",
			"--window-size=1200,800")
		browserName = "chromium"
	} else if exec.Command("which", "chromium-browser").Run() == nil {
		cmd = exec.Command("chromium-browser",
			"--app="+url,
			"--class=DJ ALOK",
			"--name=DJ ALOK",
			"--app-icon="+iconPath,
			"--user-data-dir="+userDataDir,
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-sync",
			"--window-size=1200,800")
		browserName = "chromium-browser"
	} else if exec.Command("which", "brave-browser").Run() == nil {
		cmd = exec.Command("brave-browser",
			"--app="+url,
			"--class=DJ ALOK",
			"--name=DJ ALOK",
			"--app-icon="+iconPath,
			"--user-data-dir="+userDataDir,
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-sync",
			"--window-size=1200,800")
		browserName = "brave-browser"
	}

	// Try Flatpak browsers as fallback
	if cmd == nil && exec.Command("flatpak", "list").Run() == nil {
		if exec.Command("flatpak", "info", "com.google.Chrome").Run() == nil {
			cmd = exec.Command("flatpak", "run", "com.google.Chrome",
				"--app="+url,
				"--class=DJ ALOK",
				"--name=DJ ALOK",
				"--user-data-dir="+userDataDir,
				"--window-size=1200,800")
			browserName = "flatpak chrome"
		} else if exec.Command("flatpak", "info", "org.chromium.Chromium").Run() == nil {
			cmd = exec.Command("flatpak", "run", "org.chromium.Chromium",
				"--app="+url,
				"--class=DJ ALOK",
				"--name=DJ ALOK",
				"--user-data-dir="+userDataDir,
				"--window-size=1200,800")
			browserName = "flatpak chromium"
		} else if exec.Command("flatpak", "info", "com.brave.Browser").Run() == nil {
			cmd = exec.Command("flatpak", "run", "com.brave.Browser",
				"--app="+url,
				"--class=DJ ALOK",
				"--name=DJ ALOK",
				"--user-data-dir="+userDataDir,
				"--window-size=1200,800")
			browserName = "flatpak brave"
		}
	}

	// Firefox and xdg-open as last resort
	if cmd == nil {
		if exec.Command("which", "firefox").Run() == nil {
			cmd = exec.Command("firefox", "--new-window", url)
			browserName = "firefox"
		} else if exec.Command("which", "xdg-open").Run() == nil {
			cmd = exec.Command("xdg-open", url)
			browserName = "xdg-open"
		}
	}

	if cmd != nil {
		log.Printf("Opening music player in %s...", browserName)
		// Detach the browser process from this application
		if err := cmd.Start(); err != nil {
			log.Printf("Failed to open browser with %s: %v", browserName, err)
			log.Printf("Please open manually: %s", url)
		} else {
			// Detach completely
			go cmd.Wait()
			log.Printf("Browser launched successfully")
		}
	} else {
		log.Printf("No browser found. Please open manually: %s", url)
	}
}

// loadConfig loads configuration from file or creates default
func loadConfig(path string, port int, musicFolder string) Config {
	config := Config{
		Port:     port,
		AutoScan: true,
	}

	// Try to load from file
	if data, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(data, &config); err != nil {
			log.Printf("Warning: Failed to parse config: %v", err)
		}
	}

	// Override with command line flags
	if port != 8080 {
		config.Port = port
	}
	if musicFolder != "" {
		config.MusicFolder = musicFolder
	}

	// Save config
	if data, err := json.MarshalIndent(config, "", "  "); err == nil {
		os.WriteFile(path, data, 0644)
	}

	return config
}
