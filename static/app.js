// State
let songs = [];
let currentSongIndex = -1;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0; // 0: off, 1: all, 2: one
let filteredSongs = [];

// Lyrics state
let lyricsLines = []; // Parsed lyrics with timestamps
let currentLyricIndex = -1; // Currently active lyric line

// Playlist state
let playlists = [];
let currentPlaylist = null; // null = library, or playlist object
let selectedSongForAdd = null;

// Audio enhancement state
let audioContext = null;
let sourceNode = null;
let gainNode = null;
let eqBands = [];
let eqEnabled = true;
let analyser = null;
let frequencyData = null;
let animationId = null;
let activeCanvases = new Set(); // Track which canvases are actively being visualized
let albumArtImage = new Image(); // Shared album art for all visualizations
let albumArtLoaded = false;
let currentSpectrumColor = 'custom';
let customSpectrumColors = ['#1db954', '#1ed760'];
let currentBarShape = 'bars';
let barSensitivity = 1.0;
let animationSpeed = 0.2;
let barIntensity = 64;
let barWidthSpacing = 2;
let barWidthMultiplier = 1.0;
let barShadow = 0;
let eqIntensity = 1.0;
let barReverse = false;
let directionMode = 'mirror-horizontal'; // 'left', 'right', 'mirror-vertical', 'mirror-horizontal'
let showBackgroundImage = true; // Toggle for album art background

// DOM Elements
const audio = document.getElementById('audio');
const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const volumeBtn = document.getElementById('volume-btn');
const volumeSlider = document.getElementById('volume');
const progressBar = document.getElementById('progress');
const progressFill = document.getElementById('progress-fill');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const currentTitleEl = document.getElementById('current-title');
const currentArtistEl = document.getElementById('current-artist');

// Download functionality
let downloadPollingInterval = null;
const albumArtEl = document.getElementById('album-art');
const songListEl = document.getElementById('song-list');
const searchInput = document.getElementById('search');
const songCountEl = document.getElementById('song-count');
const scanBtn = document.getElementById('scan-btn');

// Playlist elements
const newPlaylistBtn = document.getElementById('new-playlist-btn');
const createPlaylistModal = document.getElementById('create-playlist-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelPlaylistBtn = document.getElementById('cancel-playlist-btn');
const savePlaylistBtn = document.getElementById('save-playlist-btn');
const playlistNameInput = document.getElementById('playlist-name');
const playlistDescInput = document.getElementById('playlist-desc');
const addToPlaylistModal = document.getElementById('add-to-playlist-modal');
const closeAddModalBtn = document.getElementById('close-add-modal-btn');
const userPlaylistsEl = document.getElementById('user-playlists');
const playlistTitleEl = document.getElementById('playlist-title');

// Lyrics modal elements
const editLyricsModal = document.getElementById('edit-lyrics-modal');
const closeEditLyricsModalBtn = document.getElementById('close-edit-lyrics-modal-btn');
const cancelEditLyricsBtn = document.getElementById('cancel-edit-lyrics-btn');
const saveEditLyricsBtn = document.getElementById('save-edit-lyrics-btn');
const modalDeleteLyricsBtn = document.getElementById('modal-delete-lyrics-btn');
const modalLyricsEditor = document.getElementById('modal-lyrics-editor');

// Studio elements
const studioPanel = document.getElementById('studio-panel');
const studioToggleBtn = document.getElementById('studio-toggle-btn');
const closeStudioBtn = document.getElementById('close-studio-btn');
const resetEqBtn = document.getElementById('reset-eq-btn');

// Instrumental Zone elements
const instrumentalPanel = document.getElementById('instrumental-panel');
const instrumentalToggleBtn = document.getElementById('instrumental-toggle-btn');
const closeInstrumentalBtn = document.getElementById('close-instrumental-btn');
const instrumentalCanvas = document.getElementById('instrumental-canvas');
const instrumentalSongsList = document.getElementById('instrumental-songs-list');
const instrumentalSongCount = document.getElementById('instrumental-song-count');
const instrumentalNpTitle = document.getElementById('instrumental-np-title');
const instrumentalNpArtist = document.getElementById('instrumental-np-artist');

// Instrumental state
let currentInstrumentalFilter = { mood: 'all', genre: 'all' };
let instrumentalVisualizationStyle = 'particles';
let focusTimer = null;
let focusMinutes = 0;
let ambientSounds = { rain: 0, fire: 0, wind: 0 };

// Custom Alert/Confirm functions
function showAlert(message, title = 'Notice') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-alert-modal');
        const titleEl = document.getElementById('custom-alert-title');
        const messageEl = document.getElementById('custom-alert-message');
        const okBtn = document.getElementById('custom-alert-ok');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.classList.add('show');
        
        const handleOk = () => {
            modal.classList.remove('show');
            okBtn.removeEventListener('click', handleOk);
            resolve(true);
        };
        
        okBtn.addEventListener('click', handleOk);
    });
}

function showConfirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        const titleEl = document.getElementById('custom-confirm-title');
        const messageEl = document.getElementById('custom-confirm-message');
        const okBtn = document.getElementById('custom-confirm-ok');
        const cancelBtn = document.getElementById('custom-confirm-cancel');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.classList.add('show');
        
        const handleOk = () => {
            modal.classList.remove('show');
            cleanup();
            resolve(true);
        };
        
        const handleCancel = () => {
            modal.classList.remove('show');
            cleanup();
            resolve(false);
        };
        
        const cleanup = () => {
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
        };
        
        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

// Format date for display
function formatDate(timestamp) {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Initialize
init();

async function init() {
    initAudioContext();
    loadSongs();
    loadPlaylists();
    setupEventListeners();
    loadVolume();
    startHeartbeat();
    setupWindowCloseHandler();
    setupStudioControls();
    setupInstrumentalControls();
}

// Send heartbeat to server to indicate browser is still open
function startHeartbeat() {
    // Send initial heartbeat
    sendHeartbeat();
    
    // Send heartbeat every 5 seconds
    setInterval(sendHeartbeat, 5000);
}

async function sendHeartbeat() {
    try {
        await fetch('/api/heartbeat');
    } catch (error) {
        // Server might be shutting down, ignore errors
        console.debug('Heartbeat failed:', error);
    }
}

// Download functionality
let songsBeforeDownload = [];

function startDownload() {
    const url = document.getElementById('downloadUrl').value.trim();
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadStatus = document.getElementById('downloadStatus');
    const downloadMessage = document.getElementById('downloadMessage');
    
    if (!url) {
        alert('Please enter a valid URL');
        return;
    }
    
    if (!isValidUrl(url)) {
        alert('Please enter a valid YouTube or Spotify URL');
        return;
    }
    
    // Track current songs before download
    songsBeforeDownload = songs.map(s => s.id);
    
    // Disable icon and show status
    downloadBtn.style.pointerEvents = 'none';
    downloadBtn.classList.add('downloading');
    downloadStatus.style.display = 'block';
    downloadMessage.textContent = 'Starting download...';
    downloadMessage.className = 'download-message';
    
    // Start download
    fetch('/api/download', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Start polling for status
            startDownloadPolling();
        } else {
            showDownloadError(data.message);
        }
    })
    .catch(error => {
        showDownloadError('Failed to start download: ' + error.message);
    });
}

function startDownloadPolling() {
    if (downloadPollingInterval) {
        clearInterval(downloadPollingInterval);
    }
    
    // Increased from 1000ms to 2000ms to reduce polling overhead
    downloadPollingInterval = setInterval(checkDownloadStatus, 2000);
}

function checkDownloadStatus() {
    fetch('/api/download')
    .then(response => response.json())
    .then(status => {
        const progressBar = document.getElementById('downloadProgress');
        const downloadMessage = document.getElementById('downloadMessage');
        const downloadBtn = document.getElementById('downloadBtn');
        
        progressBar.style.width = status.progress + '%';
        
        if (status.error) {
            showDownloadError(status.error);
            return;
        }
        
        downloadMessage.textContent = status.message;
        
        if (!status.in_progress && status.progress === 100) {
            // Download completed successfully
            downloadMessage.textContent = 'Download completed! Refreshing library...';
            downloadMessage.className = 'download-message success';
            
            // Reset UI
            setTimeout(async () => {
                resetDownloadUI();
                
                // Store current playlist for later restoration
                const playlistToUpdate = currentPlaylist;
                
                // Refresh the song list
                await loadSongs();
                
                // If viewing a playlist, add the newly downloaded song to it
                if (playlistToUpdate && playlistToUpdate.id) {
                    // Find the newly downloaded song by comparing with pre-download song list
                    const newSongs = songs.filter(s => !songsBeforeDownload.includes(s.id));
                    if (newSongs.length > 0) {
                        const downloadedSong = newSongs[0];
                        await addSongToPlaylist(playlistToUpdate.id, downloadedSong.id);
                        downloadMessage.textContent = `Added to "${playlistToUpdate.name}"!`;
                    }
                }
                // Clear the tracking array
                songsBeforeDownload = [];
            }, 2000);
        }
    })
    .catch(error => {
        showDownloadError('Failed to check download status: ' + error.message);
    });
}

function showDownloadError(message) {
    const downloadMessage = document.getElementById('downloadMessage');
    downloadMessage.textContent = message;
    downloadMessage.className = 'download-message error';
    
    setTimeout(() => {
        resetDownloadUI();
    }, 5000);
}

function resetDownloadUI() {
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadStatus = document.getElementById('downloadStatus');
    const downloadUrl = document.getElementById('downloadUrl');
    
    downloadBtn.style.pointerEvents = 'auto';
    downloadBtn.classList.remove('downloading');
    downloadStatus.style.display = 'none';
    downloadUrl.value = '';
    
    if (downloadPollingInterval) {
        clearInterval(downloadPollingInterval);
        downloadPollingInterval = null;
    }
}

function isValidUrl(string) {
    try {
        const url = new URL(string);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return false;
        }
        
        // Check for supported platforms
        const hostname = url.hostname.toLowerCase();
        const supportedDomains = [
            'youtube.com',
            'youtu.be',
            'music.youtube.com',
            'www.youtube.com',
            'www.youtu.be',
            'open.spotify.com',
            'spotify.com',
            'soundcloud.com',
            'www.soundcloud.com'
        ];
        
        return supportedDomains.some(domain => 
            hostname === domain || hostname.endsWith('.' + domain)
        );
    } catch (_) {
        return false;
    }
}

// Setup handler to shutdown server when window closes
function setupWindowCloseHandler() {
    // Handle window/tab close
    window.addEventListener('beforeunload', function(e) {
        // Send synchronous shutdown request
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/shutdown', false); // synchronous request
        xhr.setRequestHeader('Content-Type', 'application/json');
        try {
            xhr.send();
        } catch (error) {
            console.debug('Shutdown request failed:', error);
        }
    });
    
    // Also handle visibility change (when tab is closed or browser minimized)
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
            // Page is hidden, send async shutdown with keepalive
            navigator.sendBeacon('/api/shutdown');
        }
    });
}


// Load songs from API
async function loadSongs() {
    try {
        songListEl.innerHTML = '<div class="loading">Loading music library...</div>';
        const response = await fetch('/api/songs');
        songs = await response.json();
        
        // Only update filteredSongs if we're in library view
        // If in playlist view, the playlist will handle its own song list
        if (!currentPlaylist) {
            filteredSongs = songs;
            renderSongList();
            updateSongCount();
        }
    } catch (error) {
        songListEl.innerHTML = '<div class="empty-state"><p>Failed to load songs</p></div>';
        console.error('Failed to load songs:', error);
    }
}

// Render song list
function renderSongList() {
    if (filteredSongs.length === 0) {
        songListEl.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <h3>No songs found</h3>
                <p>Add music files to your library folder or adjust your search</p>
            </div>
        `;
        return;
    }

    songListEl.innerHTML = filteredSongs.map((song, index) => `
        <div class="song-item${currentPlaylist ? ' draggable' : ''}" data-index="${index}" data-id="${song.id}"${currentPlaylist ? ' draggable="true"' : ''}>
            <div class="song-number">${index + 1}</div>
            <div class="song-details">
                <div class="song-name">${escapeHtml(song.title)}</div>
                <div class="song-meta">${escapeHtml(song.artist)}</div>
            </div>
            <div class="song-album">${escapeHtml(song.album)}</div>
            <div class="song-menu-dropdown">
                <button class="btn-song-menu" data-song-id="${song.id}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="1"/>
                        <circle cx="12" cy="5" r="1"/>
                        <circle cx="12" cy="19" r="1"/>
                    </svg>
                </button>
                <div class="song-dropdown-menu">
                    <div class="song-menu-item btn-add-to-playlist-menu" data-song-id="${song.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        <span>Add to Playlist</span>
                    </div>
                    ${currentPlaylist ? `
                    <div class="song-menu-item btn-remove-from-playlist" data-song-id="${song.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        <span>Remove from Playlist</span>
                    </div>
                    ` : ''}
                    <div class="song-menu-item btn-delete-song" data-song-id="${song.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        <span>Delete Song</span>
                    </div>
                    <div class="song-menu-item btn-share-song" data-song-id="${song.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="18" cy="5" r="3"/>
                            <circle cx="6" cy="12" r="3"/>
                            <circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                        <span>Share</span>
                    </div>
                    <div class="song-menu-divider"></div>
                    <div class="song-menu-item btn-edit-lyrics" data-song-id="${song.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        <span>Edit Lyrics</span>
                    </div>
                    <div class="song-menu-item btn-delete-lyrics" data-song-id="${song.id}" style="display: none;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                        <span>Delete Lyrics</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    // Add click listeners
    document.querySelectorAll('.song-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't trigger play if clicking on menu button or menu items
            if (e.target.closest('.song-menu-dropdown')) return;
            
            const index = parseInt(item.dataset.index);
            playSong(index);
        });
    });
    
    // Add drag-and-drop listeners if in playlist view
    if (currentPlaylist) {
        setupDragAndDrop();
    }

    updateActiveSong();
    updateSongLyricsMenuItems(); // Update lyrics menu options
}

// Play song by index
function playSong(index) {
    if (index < 0 || index >= filteredSongs.length) return;
    
    // If the same song is already playing, don't restart it
    if (index === currentSongIndex && !audio.paused) {
        return;
    }

    currentSongIndex = index;
    const song = filteredSongs[index];
    
    // Resume AudioContext if suspended
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    audio.src = `/api/stream/${song.id}`;
    audio.load();
    audio.play().catch(err => {
        console.error('Playback failed:', err);
    });
    isPlaying = true;
    
    updatePlayerInfo(song);
    updateActiveSong();
    updatePlayButton();
    updateLyricsIndicator(); // Check if current song has lyrics
    updateLyricsPageIfOpen(); // Update lyrics if lyrics page is open
}

// Update player info
function updatePlayerInfo(song) {
    currentTitleEl.textContent = song.title;
    currentArtistEl.textContent = song.artist;
    
    if (song.has_art) {
        albumArtEl.innerHTML = `<img src="/api/art/${song.id}" alt="Album Art">`;
    } else {
        albumArtEl.innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
        `;
    }
    
    // Update page title
    document.title = "DJ ALOK";
    
    // Update instrumental zone display
    updateInstrumentalDisplay();
}

// Update active song styling
function updateActiveSong() {
    document.querySelectorAll('.song-item').forEach((item, index) => {
        item.classList.remove('active', 'playing');
        if (index === currentSongIndex) {
            item.classList.add('active');
            if (isPlaying) {
                item.classList.add('playing');
            }
        }
    });
}

// Play/Pause toggle
function togglePlay() {
    if (!audio.src) {
        if (filteredSongs.length > 0) {
            playSong(0);
        }
        return;
    }

    if (isPlaying) {
        audio.pause();
        isPlaying = false;
    } else {
        // Resume AudioContext if suspended (required after user interaction)
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        audio.play();
        isPlaying = true;
    }
    
    updatePlayButton();
    updateActiveSong();
}

// Update play button icon
function updatePlayButton() {
    const icon = isPlaying 
        ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>'
        : '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    
    playBtn.innerHTML = icon;
    
    // Update vinyl spinning in instrumental zone if open
    if (instrumentalPanel && instrumentalPanel.classList.contains('show')) {
        const vinylRecord = document.getElementById('vinyl-record');
        if (vinylRecord) {
            if (isPlaying) {
                vinylRecord.classList.add('playing');
            } else {
                vinylRecord.classList.remove('playing');
            }
        }
    }
}

// Next song
function nextSong() {
    if (filteredSongs.length === 0) return;
    
    let nextIndex;
    if (isShuffle) {
        nextIndex = Math.floor(Math.random() * filteredSongs.length);
    } else {
        nextIndex = (currentSongIndex + 1) % filteredSongs.length;
    }
    
    playSong(nextIndex);
}

// Previous song
function prevSong() {
    if (filteredSongs.length === 0) return;
    
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
    } else {
        let prevIndex = currentSongIndex - 1;
        if (prevIndex < 0) {
            prevIndex = filteredSongs.length - 1;
        }
        playSong(prevIndex);
    }
}

// Toggle shuffle
function toggleShuffle() {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
}

// Toggle repeat
function toggleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    
    repeatBtn.classList.toggle('active', repeatMode > 0);
    
    const icon1 = repeatMode === 2 ? `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 1l4 4-4 4"/>
                <path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                <text x="12" y="17" font-size="8" fill="currentColor" text-anchor="middle">1</text>
            </svg>
        ` : `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 1l4 4-4 4"/>
                <path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
        `;
    
    repeatBtn.innerHTML = icon1;
}

// Toggle mute
function toggleMute() {
    audio.muted = !audio.muted;
    updateVolumeIcon();
}

// Update volume
function updateVolume() {
    audio.volume = volumeSlider.value / 100;
    updateVolumeIcon();
    updateVolumeSliderProgress();
    localStorage.setItem('volume', volumeSlider.value);
}

// Update volume slider progress bar
function updateVolumeSliderProgress() {
    const value = volumeSlider.value;
    volumeSlider.style.background = `linear-gradient(to right, #1db954 0%, #1db954 ${value}%, rgba(255, 255, 255, 0.1) ${value}%, rgba(255, 255, 255, 0.1) 100%)`;
}

// Update volume icon
function updateVolumeIcon() {
    const volume = audio.muted ? 0 : audio.volume;
    
    if (volume === 0) {
        volumeBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
        `;
    } else if (volume < 0.5) {
        volumeBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 9v6h4l5 5V4l-5 5H7z"/>
            </svg>
        `;
    } else {
        volumeBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
            </svg>
        `;
    }
}

// Load saved volume
function loadVolume() {
    const savedVolume = localStorage.getItem('volume');
    if (savedVolume) {
        volumeSlider.value = savedVolume;
        audio.volume = savedVolume / 100;
    }
    updateVolumeSliderProgress();
    updateVolumeIcon();
}

// Update progress
function updateProgress() {
    if (!audio.duration) return;
    
    const progress = (audio.currentTime / audio.duration) * 100;
    progressBar.value = progress;
    progressFill.style.width = progress + '%';
    
    currentTimeEl.textContent = formatTime(Math.floor(audio.currentTime));
    durationEl.textContent = formatTime(Math.floor(audio.duration));
}

// Seek
function seek(e) {
    if (!audio.duration) return;
    const value = e.target.value;
    const time = (value / 100) * audio.duration;
    audio.currentTime = time;
    progressBar.value = value;
}

// Search songs
function searchSongs() {
    const query = searchInput.value.toLowerCase().trim();
    
    if (query === '') {
        filteredSongs = songs;
    } else {
        filteredSongs = songs.filter(song =>
            song.title.toLowerCase().includes(query) ||
            song.artist.toLowerCase().includes(query) ||
            song.album.toLowerCase().includes(query)
        );
    }
    
    renderSongList();
    updateSongCount();
}

// Update song count
function updateSongCount() {
    const count = filteredSongs.length;
    songCountEl.textContent = `${count} song${count !== 1 ? 's' : ''}`;
}

// Rescan library
async function rescanLibrary() {
    try {
        scanBtn.style.opacity = '0.5';
        scanBtn.disabled = true;
        
        const response = await fetch('/api/scan', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
            await loadSongs();
        }
    } catch (error) {
        console.error('Failed to rescan library:', error);
    } finally {
        scanBtn.style.opacity = '1';
        scanBtn.disabled = false;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Logo click to home
    const logoHome = document.getElementById('logo-home');
    if (logoHome) logoHome.addEventListener('click', () => {
        closeLyricsPage();
        closeStudio();
    });
    
    // Home button click
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) homeBtn.addEventListener('click', () => {
        closeLyricsPage();
        closeStudio();
    });
    
    // Player controls
    playBtn.addEventListener('click', togglePlay);
    prevBtn.addEventListener('click', prevSong);
    nextBtn.addEventListener('click', nextSong);
    shuffleBtn.addEventListener('click', toggleShuffle);
    repeatBtn.addEventListener('click', toggleRepeat);
    volumeBtn.addEventListener('click', toggleMute);
    volumeSlider.addEventListener('input', updateVolume);
    progressBar.addEventListener('input', seek);
    scanBtn.addEventListener('click', rescanLibrary);
    
    // Download controls
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadUrl = document.getElementById('downloadUrl');
    if (downloadBtn && downloadUrl) {
        downloadBtn.addEventListener('click', startDownload);
        downloadUrl.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                startDownload();
            }
        });
    }
    
    // Lyrics controls
    const lyricsBtn = document.getElementById('lyrics-btn');
    const closeLyricsBtn = document.getElementById('close-lyrics-btn');
    const saveLyricsBtn = document.getElementById('save-lyrics-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    
    if (lyricsBtn) lyricsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openLyricsPage();
    });
    if (closeLyricsBtn) closeLyricsBtn.addEventListener('click', closeLyricsPage);
    if (saveLyricsBtn) saveLyricsBtn.addEventListener('click', saveLyrics);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);
    
    // Fullscreen visualizer controls
    const fullscreenVisualizerBtn = document.getElementById('fullscreen-visualizer-btn');
    const closeFullscreenVisualizerBtn = document.getElementById('close-fullscreen-visualizer-btn');
    if (fullscreenVisualizerBtn) fullscreenVisualizerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFullscreenVisualizer();
    });
    if (closeFullscreenVisualizerBtn) closeFullscreenVisualizerBtn.addEventListener('click', closeFullscreenVisualizer);
    
    // Audio events - throttle lyric updates to reduce CPU
    let lastLyricUpdate = 0;
    audio.addEventListener('timeupdate', () => {
        updateProgress();
        // Throttle lyric updates to every 200ms instead of every timeupdate
        const now = Date.now();
        if (now - lastLyricUpdate > 200) {
            updateCurrentLyric();
            lastLyricUpdate = now;
        }
    });
    audio.addEventListener('ended', () => {
        if (repeatMode === 2) {
            audio.currentTime = 0;
            audio.play();
        } else if (repeatMode === 1 || currentSongIndex < filteredSongs.length - 1 || isShuffle) {
            nextSong();
        } else {
            isPlaying = false;
            updatePlayButton();
            updateActiveSong();
        }
    });
    audio.addEventListener('play', () => {
        isPlaying = true;
        updatePlayButton();
        updateActiveSong();
    });
    audio.addEventListener('pause', () => {
        isPlaying = false;
        updatePlayButton();
        updateActiveSong();
    });
    audio.addEventListener('loadedmetadata', () => {
        durationEl.textContent = formatTime(Math.floor(audio.duration));
    });
    
    // Search
    searchInput.addEventListener('input', searchSongs);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        
        switch(e.key) {
            case ' ':
                e.preventDefault();
                togglePlay();
                break;
            case 'ArrowRight':
                e.preventDefault();
                nextSong();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                prevSong();
                break;
        }
    });
    
    // Playlist modal events
    newPlaylistBtn.addEventListener('click', openCreatePlaylistModal);
    closeModalBtn.addEventListener('click', closeCreatePlaylistModal);
    cancelPlaylistBtn.addEventListener('click', closeCreatePlaylistModal);
    savePlaylistBtn.addEventListener('click', createPlaylist);
    closeAddModalBtn.addEventListener('click', closeAddToPlaylistModal);
    
    // Lyrics modal events
    closeEditLyricsModalBtn.addEventListener('click', closeEditLyricsModal);
    cancelEditLyricsBtn.addEventListener('click', closeEditLyricsModal);
    saveEditLyricsBtn.addEventListener('click', saveLyricsFromModal);
    modalDeleteLyricsBtn.addEventListener('click', deleteLyricsFromModal);
    
    // Click outside modal to close
    createPlaylistModal.addEventListener('click', (e) => {
        if (e.target === createPlaylistModal) closeCreatePlaylistModal();
    });
    addToPlaylistModal.addEventListener('click', (e) => {
        if (e.target === addToPlaylistModal) closeAddToPlaylistModal();
    });
    editLyricsModal.addEventListener('click', (e) => {
        if (e.target === editLyricsModal) closeEditLyricsModal();
    });
    
    // Playlist name enter key
    playlistNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createPlaylist();
    });
    
    // Playlists dropdown toggle
    const playlistsDropdownBtn = document.getElementById('playlists-dropdown-btn');
    const playlistsDropdownMenu = document.getElementById('playlists-dropdown-menu');
    
    if (playlistsDropdownBtn && playlistsDropdownMenu) {
        playlistsDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playlistsDropdownMenu.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.playlists-dropdown')) {
                playlistsDropdownMenu.classList.remove('show');
            }
        });
    }
    
    // EQ Preset dropdown toggle
    const eqPresetDropdownBtn = document.getElementById('eq-preset-dropdown-btn');
    const eqPresetDropdownMenu = document.getElementById('eq-preset-dropdown-menu');
    
    if (eqPresetDropdownBtn && eqPresetDropdownMenu) {
        eqPresetDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            eqPresetDropdownMenu.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.eq-preset-dropdown')) {
                eqPresetDropdownMenu.classList.remove('show');
            }
        });
    }
    
    // Playlist menu dropdown toggle
    const playlistMenuBtn = document.getElementById('playlist-menu-btn');
    const playlistMenuDropdown = document.getElementById('playlist-menu-dropdown');
    
    if (playlistMenuBtn && playlistMenuDropdown) {
        playlistMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playlistMenuDropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.playlist-menu-dropdown')) {
                playlistMenuDropdown.classList.remove('show');
            }
        });
    }
    
    // Click handlers for all interactive elements
    document.addEventListener('click', (e) => {
        // Preset items click handler
        if (e.target.closest('.preset-item')) {
            const item = e.target.closest('.preset-item');
            const preset = item.dataset.preset;
            const dropdownMenu = document.getElementById('eq-preset-dropdown-menu');
            const currentPresetName = document.getElementById('current-eq-preset-name');
            
            // Close dropdown
            if (dropdownMenu) {
                dropdownMenu.classList.remove('show');
            }
            
            // Update active state
            document.querySelectorAll('.preset-item').forEach(p => p.classList.remove('active'));
            item.classList.add('active');
            
            // Update displayed name
            if (currentPresetName) {
                currentPresetName.textContent = item.textContent.trim();
            }
            
            // Apply preset
            setEQPreset(preset);
            updateStudioSliders();
            return;
        }
        
        // Playlist items (now in dropdown)
        if (e.target.closest('.playlist-item')) {
            const item = e.target.closest('.playlist-item');
            const playlistId = item.dataset.playlistId;
            const dropdownMenu = document.getElementById('playlists-dropdown-menu');
            if (dropdownMenu) {
                dropdownMenu.classList.remove('show');
            }
            if (playlistId === 'library') {
                viewLibrary();
            } else {
                viewPlaylist(playlistId);
            }
        }
        
        // Delete playlist button
        if (e.target.closest('.btn-delete-playlist')) {
            e.stopPropagation();
            const playlistId = e.target.closest('.playlist-item').dataset.playlistId;
            deletePlaylist(playlistId);
        }
        
        // Song menu button click
        if (e.target.closest('.btn-song-menu')) {
            e.stopPropagation();
            const btn = e.target.closest('.btn-song-menu');
            const dropdown = btn.nextElementSibling;
            
            // Close all other song menus
            document.querySelectorAll('.song-dropdown-menu.show').forEach(menu => {
                if (menu !== dropdown) menu.classList.remove('show');
            });
            
            dropdown.classList.toggle('show');
            return;
        }
        
        // Song menu items
        if (e.target.closest('.btn-add-to-playlist-menu')) {
            e.stopPropagation();
            const songId = e.target.closest('.btn-add-to-playlist-menu').dataset.songId;
            const dropdown = e.target.closest('.song-dropdown-menu');
            if (dropdown) dropdown.classList.remove('show');
            openAddToPlaylistModal(songId);
            return;
        }
        
        if (e.target.closest('.btn-delete-song')) {
            e.stopPropagation();
            const songId = e.target.closest('.btn-delete-song').dataset.songId;
            const dropdown = e.target.closest('.song-dropdown-menu');
            if (dropdown) dropdown.classList.remove('show');
            deleteSong(songId);
            return;
        }
        
        if (e.target.closest('.btn-remove-from-playlist')) {
            e.stopPropagation();
            const songId = e.target.closest('.btn-remove-from-playlist').dataset.songId;
            const dropdown = e.target.closest('.song-dropdown-menu');
            if (dropdown) dropdown.classList.remove('show');
            removeSongFromPlaylist(songId);
            return;
        }
        
        if (e.target.closest('.btn-share-song')) {
            e.stopPropagation();
            const songId = e.target.closest('.btn-share-song').dataset.songId;
            const dropdown = e.target.closest('.song-dropdown-menu');
            if (dropdown) dropdown.classList.remove('show');
            shareSong(songId);
            return;
        }
        
        if (e.target.closest('.btn-edit-lyrics')) {
            e.stopPropagation();
            const songId = e.target.closest('.btn-edit-lyrics').dataset.songId;
            const dropdown = e.target.closest('.song-dropdown-menu');
            if (dropdown) dropdown.classList.remove('show');
            editLyricsForSong(songId);
            return;
        }
        
        if (e.target.closest('.btn-delete-lyrics')) {
            e.stopPropagation();
            const songId = e.target.closest('.btn-delete-lyrics').dataset.songId;
            const dropdown = e.target.closest('.song-dropdown-menu');
            if (dropdown) dropdown.classList.remove('show');
            deleteLyricsForSong(songId);
            return;
        }
        
        // Close all song menus when clicking outside
        if (!e.target.closest('.song-menu-dropdown')) {
            document.querySelectorAll('.song-dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
        }
        
        // Add to playlist button on songs (old handler, keeping for compatibility)
        if (e.target.closest('.btn-add-to-playlist')) {
            e.stopPropagation();
            const songItem = e.target.closest('.song-item');
            const songId = songItem.dataset.id;
            openAddToPlaylistModal(songId);
        }
    });
}

// Utility functions
function formatTime(seconds) {
    if (isNaN(seconds) || seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== PLAYLIST FUNCTIONS ==========

// Load playlists from API
async function loadPlaylists() {
    try {
        const response = await fetch('/api/playlists');
        playlists = await response.json();
        renderPlaylists();
    } catch (error) {
        console.error('Failed to load playlists:', error);
    }
}

// Render playlists in sidebar
function renderPlaylists() {
    userPlaylistsEl.innerHTML = playlists.map(playlist => `
        <div class="playlist-item" data-playlist-id="${playlist.id}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
            </svg>
            <span>${escapeHtml(playlist.name)}</span>
            <button class="btn-delete-playlist" title="Delete playlist">×</button>
        </div>
    `).join('');
}

// Open create playlist modal
function openCreatePlaylistModal() {
    playlistNameInput.value = '';
    playlistDescInput.value = '';
    createPlaylistModal.classList.add('show');
    setTimeout(() => playlistNameInput.focus(), 100);
}

// Close create playlist modal
function closeCreatePlaylistModal() {
    createPlaylistModal.classList.remove('show');
}

// Create new playlist
async function createPlaylist() {
    const name = playlistNameInput.value.trim();
    if (!name) return;
    
    const description = playlistDescInput.value.trim();
    
    try {
        const response = await fetch('/api/playlists', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, description})
        });
        
        if (response.ok) {
            await loadPlaylists();
            closeCreatePlaylistModal();
        }
    } catch (error) {
        console.error('Failed to create playlist:', error);
        await showAlert('Failed to create playlist');
    }
}

// Delete playlist
async function deletePlaylist(playlistId) {
    if (!await showConfirm('Delete this playlist?')) return;
    
    try {
        const response = await fetch(`/api/playlists/${playlistId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            if (currentPlaylist && currentPlaylist.id === playlistId) {
                viewLibrary();
            }
            await loadPlaylists();
        }
    } catch (error) {
        console.error('Failed to delete playlist:', error);
        await showAlert('Failed to delete playlist');
    }
}

// Delete song
async function deleteSong(songId) {
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    
    if (!await showConfirm(`Are you sure you want to delete "${song.title}" from your library? This will permanently delete the file.`, 'Delete Song')) return;
    
    try {
        const response = await fetch(`/api/songs/delete/${songId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }
        
        // Remove from local songs array
        songs = songs.filter(s => s.id !== songId);
        filteredSongs = filteredSongs.filter(s => s.id !== songId);
        
        // If deleted song was playing, stop and clear
        if (currentSongIndex !== -1 && filteredSongs[currentSongIndex]?.id === songId) {
            audio.pause();
            currentSongIndex = -1;
            updatePlayButton();
            updateSongInfo();
        } else if (currentSongIndex >= filteredSongs.length) {
            // Adjust index if needed
            currentSongIndex = Math.max(0, filteredSongs.length - 1);
        }
        
        // Refresh the display
        renderSongList();
        updateActiveSong();
        
        // Show success message briefly
        const originalTitle = document.title;
        document.title = '✓ Song deleted';
        setTimeout(() => {
            document.title = originalTitle;
        }, 2000);
        
    } catch (error) {
        console.error('Failed to delete song:', error);
        await showAlert('Failed to delete song: ' + error.message, 'Error');
    }
}

// Share song
function shareSong(songId) {
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    
    const shareText = `${song.title} by ${song.artist}`;
    
    if (navigator.share) {
        navigator.share({
            title: song.title,
            text: shareText,
        }).catch(err => console.log('Share failed:', err));
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(shareText).then(() => {
            showAlert('Song info copied to clipboard!');
        }).catch(() => {
            showAlert('Could not share song');
        });
    }
}

// View library
function viewLibrary() {
    currentPlaylist = null;
    filteredSongs = songs;
    renderSongList();
    updateSongCount();
    playlistTitleEl.textContent = '';
    
    // Update current playlist name in navbar
    const currentPlaylistName = document.getElementById('current-playlist-name');
    if (currentPlaylistName) {
        currentPlaylistName.textContent = 'Library';
    }
    
    // Update active state
    document.querySelectorAll('.playlist-item').forEach(item => {
        item.classList.toggle('active', item.dataset.playlistId === 'library');
    });
}

// View playlist
async function viewPlaylist(playlistId) {
    try {
        const response = await fetch(`/api/playlists/${playlistId}`);
        currentPlaylist = await response.json();
        
        // Get songs for this playlist
        filteredSongs = currentPlaylist.song_ids
            .map(id => songs.find(s => s.id === id))
            .filter(s => s); // Filter out missing songs
        
        renderSongList();
        updateSongCount();
        playlistTitleEl.textContent = currentPlaylist.name;
        
        // Update current playlist name in navbar
        const currentPlaylistName = document.getElementById('current-playlist-name');
        if (currentPlaylistName) {
            currentPlaylistName.textContent = currentPlaylist.name;
        }
        
        // Update active state
        document.querySelectorAll('.playlist-item').forEach(item => {
            item.classList.toggle('active', item.dataset.playlistId === playlistId);
        });
    } catch (error) {
        console.error('Failed to load playlist:', error);
        await showAlert('Failed to load playlist', 'Error');
    }
}

// Open add to playlist modal
function openAddToPlaylistModal(songId) {
    selectedSongForAdd = songId;
    
    const playlistSelectList = document.getElementById('playlist-select-list');
    playlistSelectList.innerHTML = playlists.map(playlist => `
        <div class="playlist-select-item" data-playlist-id="${playlist.id}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
            </svg>
            <span>${escapeHtml(playlist.name)}</span>
        </div>
    `).join('');
    
    if (playlists.length === 0) {
        playlistSelectList.innerHTML = '<div class="empty-state"><p>No playlists yet. Create one first!</p></div>';
    }
    
    // Add click listeners
    document.querySelectorAll('.playlist-select-item').forEach(item => {
        item.addEventListener('click', () => {
            const playlistId = item.dataset.playlistId;
            addSongToPlaylist(playlistId, selectedSongForAdd);
        });
    });
    
    addToPlaylistModal.classList.add('show');
}

// Close add to playlist modal
function closeAddToPlaylistModal() {
    addToPlaylistModal.classList.remove('show');
    selectedSongForAdd = null;
}

// Add song to playlist
async function addSongToPlaylist(playlistId, songId) {
    try {
        const response = await fetch(`/api/playlists/${playlistId}/songs`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({song_ids: [songId]})
        });
        
        if (response.ok) {
            closeAddToPlaylistModal();
            // If viewing this playlist, refresh it
            if (currentPlaylist && currentPlaylist.id === playlistId) {
                await viewPlaylist(playlistId);
            }
        }
    } catch (error) {
        console.error('Failed to add song to playlist:', error);
        await showAlert('Failed to add song to playlist', 'Error');
    }
}

// Remove song from playlist
async function removeSongFromPlaylist(songId) {
    if (!currentPlaylist || !currentPlaylist.id) return;
    
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    
    if (!await showConfirm(`Remove "${song.title}" from "${currentPlaylist.name}"?`, 'Remove from Playlist')) return;
    
    try {
        const response = await fetch(`/api/playlists/${currentPlaylist.id}/songs/${songId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Refresh the playlist view
            await viewPlaylist(currentPlaylist.id);
        } else {
            await showAlert('Failed to remove song from playlist', 'Error');
        }
    } catch (error) {
        console.error('Failed to remove song from playlist:', error);
        await showAlert('Failed to remove song from playlist', 'Error');
    }
}

// Drag and drop for reordering songs in playlist
let draggedElement = null;
let draggedIndex = null;

function setupDragAndDrop() {
    const songItems = document.querySelectorAll('.song-item.draggable');
    
    songItems.forEach((item, index) => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
    });
}

function handleDragStart(e) {
    draggedElement = this;
    draggedIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== this) {
        const dropIndex = parseInt(this.dataset.index);
        
        // Reorder the filteredSongs array
        const draggedSong = filteredSongs[draggedIndex];
        filteredSongs.splice(draggedIndex, 1);
        filteredSongs.splice(dropIndex, 0, draggedSong);
        
        // Re-render the list
        renderSongList();
        
        // Save the new order to the backend
        savePlaylistOrder();
    }
    
    return false;
}

function handleDragEnd(e) {
    document.querySelectorAll('.song-item').forEach(item => {
        item.classList.remove('dragging', 'drag-over');
    });
    draggedElement = null;
    draggedIndex = null;
}

async function savePlaylistOrder() {
    if (!currentPlaylist || !currentPlaylist.id) return;
    
    const songIds = filteredSongs.map(song => song.id);
    
    try {
        const response = await fetch(`/api/playlists/${currentPlaylist.id}/songs`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({song_ids: songIds})
        });
        
        if (!response.ok) {
            console.error('Failed to save playlist order');
            await showAlert('Failed to save playlist order', 'Error');
        }
    } catch (error) {
        console.error('Failed to save playlist order:', error);
        await showAlert('Failed to save playlist order', 'Error');
    }
}

// ========== AUDIO ENHANCEMENT ==========

// Initialize Web Audio API for high-quality audio processing
function initAudioContext() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create gain node for volume control
        gainNode = audioContext.createGain();
        
        // Create analyser for frequency visualization
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256; // Reduced from 512 for better performance
        analyser.smoothingTimeConstant = 0.85; // Slightly higher for smoother visuals with less data
        const bufferLength = analyser.frequencyBinCount;
        frequencyData = new Uint8Array(bufferLength);
        
        // Create 10-band equalizer with professional frequency bands
        const frequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        
        frequencies.forEach(freq => {
            const filter = audioContext.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = 1.0;
            filter.gain.value = 0; // Default: no boost/cut
            eqBands.push(filter);
        });
        
        // Connect audio element to Web Audio API (only once!)
        if (!sourceNode) {
            sourceNode = audioContext.createMediaElementSource(audio);
            
            // Build audio processing chain: source -> analyser -> EQ bands -> gain -> destination
            let previousNode = sourceNode;
            previousNode.connect(analyser);
            eqBands.forEach(band => {
                previousNode.connect(band);
                previousNode = band;
            });
            previousNode.connect(gainNode);
            gainNode.connect(audioContext.destination);
        }
        
        // Apply quality enhancements
        applyAudioEnhancements();
        
        console.log('High-quality audio processing initialized');
    } catch (error) {
        console.error('Web Audio API not supported:', error);
        // Fallback: audio will play without enhancement
    }
}

// Apply audio enhancements for better quality
function applyAudioEnhancements() {
    if (!eqBands.length) return;
    
    // Preset: "Enhanced" - Subtle boosts for clarity and warmth
    const enhancements = [
        { freq: 32, gain: 2 },    // Sub-bass (body)
        { freq: 64, gain: 1 },    // Bass (warmth)
        { freq: 125, gain: 0 },   // Low-mid (neutral)
        { freq: 250, gain: -1 },  // Mid (reduce muddiness)
        { freq: 500, gain: 0 },   // Mid (neutral)
        { freq: 1000, gain: 1 },  // Upper-mid (clarity)
        { freq: 2000, gain: 2 },  // Presence (detail)
        { freq: 4000, gain: 1.5 },// Brilliance (sparkle)
        { freq: 8000, gain: 2 },  // Air (clarity)
        { freq: 16000, gain: 1 }  // Ultra-high (spaciousness)
    ];
    
    eqBands.forEach((band, index) => {
        if (eqEnabled && enhancements[index]) {
            band.gain.value = enhancements[index].gain;
        } else {
            band.gain.value = 0;
        }
    });
}

// Set custom EQ preset
function setEQPreset(preset) {
    if (!eqBands.length) return;
    
    const presets = {
        flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        enhanced: [2, 1, 0, -1, 0, 1, 2, 1.5, 2, 1],
        boom: [8, 6, 1, -1, 0, 3, 3, 1.5, 2, 1], // Enhanced with strong bass beats
        bass_boost: [6, 5, 3, 1, 0, 0, 0, 0, 0, 0],
        treble_boost: [0, 0, 0, 0, 0, 1, 2, 3, 4, 3],
        powerful: [5, 4, 2, 0, 1, 2.5, 3.5, 3, 3, 2], // Strong bass + enhanced vocal clarity
        vocal: [0, -1, -1, 1, 2, 3, 2, 1, 0, 0],
        rock: [4, 3, 1, 0, -1, 0, 1, 2, 3, 2],
        jazz: [2, 1, 1, 0, 0, 0, 1, 2, 2, 1],
        classical: [3, 2, 1, 0, 0, 0, 1, 2, 3, 2],
        electronic: [4, 3, 1, 0, -1, 0, 2, 3, 4, 3]
    };
    
    const gains = presets[preset] || presets.enhanced;
    
    eqBands.forEach((band, index) => {
        if (eqEnabled) {
            band.gain.value = gains[index];
        }
    });
}

// Toggle EQ on/off
function toggleEQ() {
    eqEnabled = !eqEnabled;
    applyAudioEnhancements();
}

// ========== DJ STUDIO FUNCTIONS ==========

function setupStudioControls() {
    // Toggle studio panel
    studioToggleBtn.addEventListener('click', toggleStudio);
    closeStudioBtn.addEventListener('click', closeStudio);
    
    // Toggle side panels button
    const togglePanelsBtn = document.getElementById('toggle-panels-btn');
    
    if (togglePanelsBtn) {
        togglePanelsBtn.addEventListener('click', () => {
            const leftPanel = document.querySelector('.studio-left-panel');
            const rightPanel = document.querySelector('.studio-right-panel');
            const leftButtonBar = document.querySelector('.studio-button-bar-left');
            const rightButtonBar = document.querySelector('.studio-button-bar');
            
            if (leftPanel && rightPanel) {
                const isHidden = leftPanel.classList.contains('hidden');
                
                if (isHidden) {
                    leftPanel.classList.remove('hidden');
                    rightPanel.classList.remove('hidden');
                    if (leftButtonBar) leftButtonBar.classList.remove('hidden');
                    if (rightButtonBar) rightButtonBar.classList.remove('hidden');
                    togglePanelsBtn.classList.remove('panels-hidden');
                } else {
                    leftPanel.classList.add('hidden');
                    rightPanel.classList.add('hidden');
                    if (leftButtonBar) leftButtonBar.classList.add('hidden');
                    if (rightButtonBar) rightButtonBar.classList.add('hidden');
                    togglePanelsBtn.classList.add('panels-hidden');
                }
            }
        });
    }
    
    // Reset EQ button
    resetEqBtn.addEventListener('click', resetEQ);
    
    // Preset buttons
    document.querySelectorAll('.studio-preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const preset = e.target.dataset.preset;
            applyStudioPreset(preset);
            // Update active state
            document.querySelectorAll('.studio-preset-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
    
    // Spectrum color buttons
    document.querySelectorAll('.spectrum-color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const color = e.target.dataset.color;
            currentSpectrumColor = color;
            // Update active state
            document.querySelectorAll('.spectrum-color-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
    
    // Custom color picker
    const applyCustomColorsBtn = document.getElementById('apply-custom-colors');
    if (applyCustomColorsBtn) {
        applyCustomColorsBtn.addEventListener('click', () => {
            const color1 = document.getElementById('custom-color-1').value;
            const color2 = document.getElementById('custom-color-2').value;
            
            // Set custom color mode
            currentSpectrumColor = 'custom';
            customSpectrumColors = [color1, color2];
            
            // Remove active state from preset buttons
            document.querySelectorAll('.spectrum-color-btn').forEach(b => b.classList.remove('active'));
        });
    }
    
    // Bar shape buttons
    document.querySelectorAll('.shape-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const shape = e.target.dataset.shape;
            currentBarShape = shape;
            // Update active state
            document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
    
    // Bar sensitivity control
    const sensitivitySlider = document.getElementById('bar-sensitivity');
    const sensitivityValue = document.getElementById('sensitivity-value');
    if (sensitivitySlider) {
        sensitivitySlider.addEventListener('input', (e) => {
            barSensitivity = parseFloat(e.target.value);
            sensitivityValue.textContent = `${barSensitivity.toFixed(1)}x`;
        });
    }
    
    // Animation speed control
    const animationSlider = document.getElementById('animation-speed');
    const animationValue = document.getElementById('animation-value');
    if (animationSlider) {
        animationSlider.addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            // Map 0.5-2 to animation fade values (0.1-0.4)
            animationSpeed = 0.1 + (speed - 0.5) * 0.2;
            animationValue.textContent = `${speed.toFixed(1)}x`;
        });
    }
    
    // Bar intensity control
    const intensitySlider = document.getElementById('bar-intensity');
    const intensityBarValue = document.getElementById('intensity-bar-value');
    if (intensitySlider) {
        intensitySlider.addEventListener('input', (e) => {
            barIntensity = parseInt(e.target.value);
            intensityBarValue.textContent = barIntensity;
        });
    }
    
    // Bar width spacing control
    const gapSlider = document.getElementById('bar-gap');
    const gapBarValue = document.getElementById('gap-bar-value');
    if (gapSlider) {
        gapSlider.addEventListener('input', (e) => {
            barWidthSpacing = parseInt(e.target.value);
            gapBarValue.textContent = `${barWidthSpacing}px`;
        });
    }
    
    // Bar width multiplier control
    const widthSlider = document.getElementById('bar-width');
    const widthBarValue = document.getElementById('width-bar-value');
    if (widthSlider) {
        widthSlider.addEventListener('input', (e) => {
            barWidthMultiplier = parseFloat(e.target.value);
            widthBarValue.textContent = `${barWidthMultiplier.toFixed(1)}x`;
        });
    }
    
    // Bar shadow control
    const shadowSlider = document.getElementById('bar-shadow');
    const shadowBarValue = document.getElementById('shadow-bar-value');
    if (shadowSlider) {
        shadowSlider.addEventListener('input', (e) => {
            barShadow = parseInt(e.target.value);
            shadowBarValue.textContent = barShadow;
        });
    }
    
    // Direction arrow buttons
    const arrowButtons = document.querySelectorAll('.arrow-btn');
    arrowButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const direction = e.target.dataset.direction;
            
            // Update active state
            arrowButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Handle direction
            if (direction === 'left') {
                barReverse = false;
                directionMode = 'left';
                console.log('Direction: Left (normal)');
            } else if (direction === 'right') {
                barReverse = true;
                directionMode = 'right';
                console.log('Direction: Right (reversed)');
            } else if (direction === 'up') {
                directionMode = 'mirror-vertical';
                console.log('Direction: Mirror Vertical');
            } else if (direction === 'horizontal') {
                directionMode = 'mirror-horizontal';
                console.log('Direction: Mirror Horizontal');
            }
        });
    });
    
    // Toggle background image button
    const toggleBackgroundBtn = document.getElementById('toggle-background');
    if (toggleBackgroundBtn) {
        toggleBackgroundBtn.addEventListener('click', () => {
            showBackgroundImage = !showBackgroundImage;
            toggleBackgroundBtn.classList.toggle('active', showBackgroundImage);
            console.log('Background image:', showBackgroundImage ? 'ON' : 'OFF');
        });
        // Set initial state
        toggleBackgroundBtn.classList.add('active');
    }
    
    // EQ intensity control
    const eqIntensitySlider = document.getElementById('eq-intensity');
    const eqIntensityValue = document.getElementById('eq-intensity-value');
    if (eqIntensitySlider) {
        eqIntensitySlider.addEventListener('input', (e) => {
            eqIntensity = parseFloat(e.target.value);
            eqIntensityValue.textContent = `${Math.round(eqIntensity * 100)}%`;
            // Re-apply current EQ values with new intensity
            for (let i = 0; i < 10; i++) {
                const slider = document.getElementById(`eq-${i}`);
                if (slider) {
                    updateEQBand(i, parseFloat(slider.value));
                }
            }
        });
    }
    
    // Reset all controls button
    const resetAllBtn = document.getElementById('reset-all-controls');
    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', () => {
            // Reset EQ
            resetEQ();
            
            // Reset sensitivity
            if (sensitivitySlider) {
                sensitivitySlider.value = 1;
                barSensitivity = 1.0;
                sensitivityValue.textContent = '1.0x';
            }
            
            // Reset animation
            if (animationSlider) {
                animationSlider.value = 1;
                animationSpeed = 0.2;
                animationValue.textContent = '1.0x';
            }
            
            // Reset intensity
            if (intensitySlider) {
                intensitySlider.value = 64;
                barIntensity = 64;
                intensityBarValue.textContent = '64';
            }
            
            // Reset bar width
            if (gapSlider) {
                gapSlider.value = 2;
                barWidthSpacing = 2;
                gapBarValue.textContent = '2px';
            }
            
            // Reset bar width multiplier
            if (widthSlider) {
                widthSlider.value = 1;
                barWidthMultiplier = 1.0;
                widthBarValue.textContent = '1.0x';
            }
            
            // Reset direction arrows
            barReverse = false;
            directionMode = 'left';
            const arrowLeft = document.getElementById('arrow-left');
            if (arrowLeft) {
                arrowButtons.forEach(b => b.classList.remove('active'));
                arrowLeft.classList.add('active');
            }
            
            // Reset EQ intensity
            const eqIntensitySlider = document.getElementById('eq-intensity');
            const eqIntensityValue = document.getElementById('eq-intensity-value');
            if (eqIntensitySlider) {
                eqIntensitySlider.value = 1;
                eqIntensity = 1.0;
                eqIntensityValue.textContent = '100%';
            }
        });
    }
    
    // Setup all EQ sliders
    for (let i = 0; i < 10; i++) {
        const slider = document.getElementById(`eq-${i}`);
        const valueDisplay = document.getElementById(`eq-value-${i}`);
        
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            valueDisplay.textContent = value > 0 ? `+${value}` : value;
            updateEQBand(i, value);
        });
    }
    
    // Settings button - toggle ambient lighting
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            ambientLightingEnabled = !ambientLightingEnabled;
            
            // Toggle visual state
            settingsBtn.classList.toggle('active');
            
            const studioEqualizer = document.querySelector('.studio-equalizer');
            if (studioEqualizer) {
                if (!ambientLightingEnabled) {
                    // Disable: reset lighting to zero
                    studioEqualizer.style.setProperty('--ambient-glow-scale', '0');
                    studioEqualizer.style.setProperty('--ambient-glow-intensity', '0');
                    studioEqualizer.style.setProperty('--ambient-glow-blur', '0px');
                } else {
                    // Re-enable: remove inline styles to let animation take over
                    studioEqualizer.style.removeProperty('--ambient-glow-scale');
                    studioEqualizer.style.removeProperty('--ambient-glow-intensity');
                    studioEqualizer.style.removeProperty('--ambient-glow-blur');
                }
            }
        });
    }
    
    // Lyrics position buttons
    const lyricsUpBtn = document.getElementById('lyrics-up-btn');
    const lyricsCenterBtn = document.getElementById('lyrics-center-btn');
    const lyricsDownBtn = document.getElementById('lyrics-down-btn');
    
    if (lyricsUpBtn && lyricsCenterBtn && lyricsDownBtn) {
        lyricsUpBtn.addEventListener('click', () => {
            lyricsPosition = 'up';
            lyricsUpBtn.classList.add('active');
            lyricsCenterBtn.classList.remove('active');
            lyricsDownBtn.classList.remove('active');
        });
        
        lyricsCenterBtn.addEventListener('click', () => {
            lyricsPosition = 'center';
            lyricsUpBtn.classList.remove('active');
            lyricsCenterBtn.classList.add('active');
            lyricsDownBtn.classList.remove('active');
        });
        
        lyricsDownBtn.addEventListener('click', () => {
            lyricsPosition = 'down';
            lyricsUpBtn.classList.remove('active');
            lyricsCenterBtn.classList.remove('active');
            lyricsDownBtn.classList.add('active');
        });
    }
    
    // Bar shape button - open color picker for lyrics
    const barShapeBtn = document.getElementById('bar-shape-btn');
    const lyricsColorPicker = document.getElementById('lyrics-color-picker');
    
    if (barShapeBtn && lyricsColorPicker) {
        barShapeBtn.addEventListener('click', () => {
            lyricsColorPicker.click();
        });
        
        lyricsColorPicker.addEventListener('change', (e) => {
            lyricsColor = e.target.value;
        });
    }
    
    // Screenshot button - toggle raining glass overlay
    const screenshotBtn = document.getElementById('screenshot-btn');
    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', () => {
            rainingGlassEnabled = !rainingGlassEnabled;
            screenshotBtn.classList.toggle('active');
            
            // Initialize rain drops if enabling
            if (rainingGlassEnabled && rainDrops.length === 0) {
                for (let i = 0; i < 20; i++) { // Reduced from 30 for better performance
                    rainDrops.push({
                        x: Math.random(),
                        y: Math.random(),
                        speed: 0.01 + Math.random() * 0.02,
                        size: 2 + Math.random() * 3
                    });
                }
            }
        });
    }
    
    // Fullscreen button - toggle 90s screen overlay
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            retro90sEnabled = !retro90sEnabled;
            fullscreenBtn.classList.toggle('active');
        });
    }
    
    // Lighting theme buttons
    const lightingThemes = {
        'green': '#1db954',
        'blue': '#1e90ff',
        'purple': '#9b59b6',
        'red': '#e74c3c',
        'orange': '#ff6b35',
        'cyan': '#00d9ff'
    };
    
    document.querySelectorAll('[data-lighting-theme]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const theme = e.currentTarget.dataset.lightingTheme;
            lightingThemeColor = lightingThemes[theme];
            
            // Update active state
            document.querySelectorAll('[data-lighting-theme]').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });
}

function toggleStudio() {
    const isOpen = studioPanel.classList.toggle('show');
    studioToggleBtn.classList.toggle('active', isOpen);
    if (isOpen) {
        // Update sliders to show current preset values
        updateStudioSliders();
        // Start frequency visualization
        startFrequencyVisualization();
    } else {
        // Stop frequency visualization when closing
        stopFrequencyVisualization();
    }
}

function closeStudio() {
    studioPanel.classList.remove('show');
    studioToggleBtn.classList.remove('active');
    // Stop frequency visualization
    stopFrequencyVisualization();
}

// ========== INSTRUMENTAL ZONE FUNCTIONS ==========

function setupInstrumentalControls() {
    // Toggle instrumental panel
    instrumentalToggleBtn.addEventListener('click', toggleInstrumental);
    closeInstrumentalBtn.addEventListener('click', closeInstrumental);
}

function toggleInstrumental() {
    const isOpen = instrumentalPanel.classList.toggle('show');
    instrumentalToggleBtn.classList.toggle('active', isOpen);
    
    if (isOpen) {
        // Close studio if open
        if (studioPanel.classList.contains('show')) {
            closeStudio();
        }
        
        // Update poster and vinyl
        updateInstrumentalDisplay();
    }
}

function closeInstrumental() {
    instrumentalPanel.classList.remove('show');
    instrumentalToggleBtn.classList.remove('active');
}

function updateInstrumentalDisplay() {
    const vinylRecord = document.getElementById('vinyl-record');
    const posterImage = document.getElementById('poster-image');
    
    if (currentSongIndex >= 0 && filteredSongs[currentSongIndex]) {
        const song = filteredSongs[currentSongIndex];
        
        // Update poster on vinyl
        if (song.has_art) {
            posterImage.innerHTML = `<img src="/api/art/${song.id}" alt="Album Art">`;
        } else {
            posterImage.innerHTML = `
                <svg width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.5">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
            `;
        }
        
        // Update vinyl spinning
        if (isPlaying) {
            vinylRecord.classList.add('playing');
        } else {
            vinylRecord.classList.remove('playing');
        }
    } else {
        posterImage.innerHTML = `
            <svg width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.5">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
        `;
        vinylRecord.classList.remove('playing');
    }
}

// Fullscreen visualizer functions
let previousViewState = null;

function toggleFullscreenVisualizer() {
    const fullscreenView = document.getElementById('fullscreen-visualizer-view');
    const playlist = document.querySelector('.playlist');
    const lyricsView = document.getElementById('lyrics-view');
    const studioPanel = document.getElementById('studio-panel');
    const fullscreenBtn = document.getElementById('fullscreen-visualizer-btn');
    
    const isOpen = fullscreenView.style.display !== 'none';
    
    if (!isOpen) {
        // Save current view state
        previousViewState = {
            playlistVisible: playlist.style.display !== 'none',
            lyricsVisible: lyricsView.style.display === 'block',
            studioVisible: studioPanel.classList.contains('show')
        };
        
        // Show fullscreen visualizer
        fullscreenView.style.display = 'flex';
        playlist.style.display = 'none';
        lyricsView.style.display = 'none';
        studioPanel.classList.remove('show');
        fullscreenBtn.classList.add('active');
        
        // Start visualization on fullscreen canvas
        startFullscreenVisualization();
    } else {
        closeFullscreenVisualizer();
    }
}

function closeFullscreenVisualizer() {
    const fullscreenView = document.getElementById('fullscreen-visualizer-view');
    const playlist = document.querySelector('.playlist');
    const lyricsView = document.getElementById('lyrics-view');
    const studioPanel = document.getElementById('studio-panel');
    const fullscreenBtn = document.getElementById('fullscreen-visualizer-btn');
    
    fullscreenView.style.display = 'none';
    fullscreenBtn.classList.remove('active');
    
    // Restore previous view state
    if (previousViewState) {
        if (previousViewState.studioVisible) {
            studioPanel.classList.add('show');
            playlist.style.display = 'none';
            lyricsView.style.display = 'none';
        } else if (previousViewState.lyricsVisible) {
            lyricsView.style.display = 'block';
            playlist.style.display = 'none';
            studioPanel.classList.remove('show');
        } else {
            playlist.style.display = 'block';
            lyricsView.style.display = 'none';
            studioPanel.classList.remove('show');
        }
        previousViewState = null;
    } else {
        // Default to playlist if no previous state
        playlist.style.display = 'block';
    }
    
    // Stop fullscreen visualization
    stopFullscreenVisualization();
}

let fullscreenAnimationId = null;

function startFullscreenVisualization() {
    if (!analyser || !frequencyData) return;
    
    const canvas = document.getElementById('fullscreen-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Limit to 30fps for performance
    let lastFrameTime = 0;
    const targetFrameTime = 1000 / 30;
    
    function draw(currentTime) {
        // Check if fullscreen view is still open
        const fullscreenView = document.getElementById('fullscreen-visualizer-view');
        if (!fullscreenView || fullscreenView.style.display === 'none') {
            stopFullscreenVisualization();
            return;
        }
        
        fullscreenAnimationId = requestAnimationFrame(draw);
        
        // Throttle to 30fps
        const elapsed = currentTime - lastFrameTime;
        if (elapsed < targetFrameTime) {
            return;
        }
        
        lastFrameTime = currentTime - (elapsed % targetFrameTime);
        
        analyser.getByteFrequencyData(frequencyData);
        renderVisualizationToCanvas(canvas, ctx, frequencyData);
    }
    
    draw();
}

function stopFullscreenVisualization() {
    if (fullscreenAnimationId) {
        cancelAnimationFrame(fullscreenAnimationId);
        fullscreenAnimationId = null;
    }
}

// Helper functions for color conversion
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 29, g: 185, b: 84 };
}

function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    
    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

// Shared rendering function for both studio and fullscreen visualizations
function renderVisualizationToCanvas(canvas, ctx, frequencyData) {
    // Color themes
    const colorThemes = {
        green: {
            hueStart: 120,
            hueRange: 40,
            saturation: 80,
            lightness: 50
        },
        neon: {
            hueStart: 280,
            hueRange: 80,
            saturation: 100,
            lightness: 60
        },
        cyberpunk: {
            hueStart: 280,
            hueRange: 60,
            saturation: 90,
            lightness: 55
        },
        fire: {
            hueStart: 0,
            hueRange: 60,
            saturation: 100,
            lightness: 50
        },
        ocean: {
            hueStart: 180,
            hueRange: 60,
            saturation: 80,
            lightness: 50
        },
        rainbow: {
            hueStart: 0,
            hueRange: 360,
            saturation: 90,
            lightness: 50
        },
        sunset: {
            hueStart: 20,
            hueRange: 40,
            saturation: 85,
            lightness: 55
        },
        ice: {
            hueStart: 190,
            hueRange: 30,
            saturation: 75,
            lightness: 65
        },
        lava: {
            hueStart: 10,
            hueRange: 30,
            saturation: 95,
            lightness: 45
        },
        forest: {
            hueStart: 100,
            hueRange: 50,
            saturation: 70,
            lightness: 45
        },
        purple: {
            hueStart: 270,
            hueRange: 40,
            saturation: 85,
            lightness: 55
        },
        gold: {
            hueStart: 40,
            hueRange: 20,
            saturation: 90,
            lightness: 55
        }
    };
    
    if (showBackgroundImage && albumArtLoaded && albumArtImage.complete) {
        // Calculate dimensions to cover canvas while maintaining aspect ratio
        const canvasAspect = canvas.width / canvas.height;
        const imgAspect = albumArtImage.width / albumArtImage.height;
        
        // Zoom factor - increase to zoom in more
        const zoomFactor = 2.0;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (canvasAspect > imgAspect) {
            drawWidth = canvas.width * zoomFactor;
            drawHeight = (canvas.width / imgAspect) * zoomFactor;
            offsetX = -(drawWidth - canvas.width) / 2;
            offsetY = (canvas.height - drawHeight) / 2;
        } else {
            drawHeight = canvas.height * zoomFactor;
            drawWidth = (canvas.height * imgAspect) * zoomFactor;
            offsetX = (canvas.width - drawWidth) / 2;
            offsetY = -(drawHeight - canvas.height) / 2;
        }
        
        // Draw image
        ctx.drawImage(albumArtImage, offsetX, offsetY, drawWidth, drawHeight);
        
        // Add overlay effect for enhanced colors and contrast
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = 'rgba(128, 128, 128, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
        
        // Add dark overlay for better visibility of spectrum
        ctx.fillStyle = 'rgba(10, 10, 10, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add blur/fade effect from left edge - more pronounced
        const blurWidth = canvas.width * 0.4; // 40% of canvas width
        const leftGradient = ctx.createLinearGradient(0, 0, blurWidth, 0);
        leftGradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        leftGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)');
        leftGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = leftGradient;
        ctx.fillRect(0, 0, blurWidth, canvas.height);
        
        // Add blur/fade effect from right edge - more pronounced
        const rightGradient = ctx.createLinearGradient(canvas.width - blurWidth, 0, canvas.width, 0);
        rightGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        rightGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)');
        rightGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
        ctx.fillStyle = rightGradient;
        ctx.fillRect(canvas.width - blurWidth, 0, blurWidth, canvas.height);
    } else {
        // Clear canvas with dark background if no album art
        ctx.fillStyle = `rgba(10, 10, 10, 0.8)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Get theme based on current color selection
    let theme;
    if (currentSpectrumColor === 'custom') {
        // Parse custom colors to HSL
        const color1RGB = hexToRgb(customSpectrumColors[0]);
        const color2RGB = hexToRgb(customSpectrumColors[1]);
        const color1HSL = rgbToHsl(color1RGB.r, color1RGB.g, color1RGB.b);
        const color2HSL = rgbToHsl(color2RGB.r, color2RGB.g, color2RGB.b);
        
        theme = {
            hueStart: color1HSL.h,
            hueRange: Math.abs(color2HSL.h - color1HSL.h),
            saturation: (color1HSL.s + color2HSL.s) / 2,
            lightness: (color1HSL.l + color2HSL.l) / 2
        };
    } else if (colorThemes[currentSpectrumColor]) {
        theme = colorThemes[currentSpectrumColor];
    } else {
        // Fallback to custom colors
        const color1RGB = hexToRgb(customSpectrumColors[0]);
        const color2RGB = hexToRgb(customSpectrumColors[1]);
        const color1HSL = rgbToHsl(color1RGB.r, color1RGB.g, color1RGB.b);
        const color2HSL = rgbToHsl(color2RGB.r, color2RGB.g, color2RGB.b);
        
        theme = {
            hueStart: color1HSL.h,
            hueRange: Math.abs(color2HSL.h - color1HSL.h),
            saturation: (color1HSL.s + color2HSL.s) / 2,
            lightness: (color1HSL.l + color2HSL.l) / 2
        };
    }
    
    // Use global studio settings
    const barCount = barIntensity;
    const availableWidth = canvas.width * 0.98;
    let barWidth = ((availableWidth / barCount) - barWidthSpacing) * barWidthMultiplier;
        
        // For wave shape, collect all points first
        if (currentBarShape === 'wave') {
            ctx.shadowBlur = barShadow;
            ctx.shadowColor = `hsla(${theme.hueStart}, 100%, ${theme.lightness + 20}%, 0.8)`;
            
            ctx.beginPath();
            for (let i = 0; i < barCount; i++) {
                const actualIndex = barReverse ? (barCount - 1 - i) : i;
                const dataIndex = Math.floor(actualIndex * (frequencyData.length / barCount));
                const value = frequencyData[dataIndex];
                const barHeight = (value / 255) * canvas.height * barSensitivity;
                
                const x = (i * (barWidth + barWidthSpacing)) + (canvas.width * 0.01) + barWidth / 2;
                const y = canvas.height - barHeight;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            // Create gradient for wave
            const waveGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            waveGradient.addColorStop(0, `hsla(${theme.hueStart}, ${theme.saturation}%, ${theme.lightness + 10}%, 0.9)`);
            waveGradient.addColorStop(0.5, `hsla(${theme.hueStart + theme.hueRange / 2}, ${theme.saturation}%, ${theme.lightness}%, 0.8)`);
            waveGradient.addColorStop(1, `hsla(${theme.hueStart + theme.hueRange}, ${theme.saturation}%, ${theme.lightness - 10}%, 0.7)`);
            
            ctx.strokeStyle = waveGradient;
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.stroke();
            
            return; // Skip regular bar drawing
        }
        
        // Draw frequency bars
        for (let i = 0; i < barCount; i++) {
            // Skip half bars in mirror-horizontal mode (will draw both halves below)
            if (directionMode === 'mirror-horizontal' && i >= barCount / 2) {
                continue;
            }
            
            const actualIndex = barReverse ? (barCount - 1 - i) : i;
            const dataIndex = Math.floor(actualIndex * (frequencyData.length / barCount));
            const value = frequencyData[dataIndex];
            const barHeight = (value / 255) * canvas.height * barSensitivity;
            
            let x = (i * (barWidth + barWidthSpacing)) + (canvas.width * 0.01);
            let y = canvas.height - barHeight;
            
            // Calculate positions for mirror-horizontal mode
            let xRight = 0;
            if (directionMode === 'mirror-horizontal') {
                // Left half position stays as x
                // Calculate right half position - mirror from the right edge
                xRight = canvas.width - (i * (barWidth + barWidthSpacing)) - barWidth - (canvas.width * 0.01);
            }
            
            // Handle vertical mirroring for mirror-vertical mode
            if (directionMode === 'mirror-vertical') {
                // Don't change y here, will handle in drawing
            } else if (directionMode === 'bottom-up') {
                y = canvas.height - barHeight;
            }
            
            // Calculate hue based on position and theme (use actualIndex so colors reverse with data)
            const hue = theme.hueStart + (actualIndex / barCount) * theme.hueRange;
            
            // Create gradient for each bar
            const gradient = ctx.createLinearGradient(0, y, 0, canvas.height);
            gradient.addColorStop(0, `hsla(${hue}, ${theme.saturation}%, ${theme.lightness + 10}%, 0.9)`);
            gradient.addColorStop(0.5, `hsla(${hue}, ${theme.saturation}%, ${theme.lightness}%, 0.7)`);
            gradient.addColorStop(1, `hsla(${hue}, ${theme.saturation}%, ${theme.lightness - 10}%, 0.5)`);
            
            ctx.fillStyle = gradient;
            
            // Apply enhanced glow effect with brighter, more saturated color
            ctx.shadowBlur = barShadow;
            ctx.shadowColor = `hsla(${hue}, 100%, ${theme.lightness + 20}%, 0.8)`;
            
            // Draw different shapes based on currentBarShape
            switch (currentBarShape) {
                case 'bars':
                    // Standard rectangular bars
                    if (directionMode === 'mirror-vertical') {
                        // Draw from top and bottom edges toward center
                        const topY = 0;
                        const bottomY = canvas.height;
                        ctx.fillRect(x, topY, barWidth, barHeight / 2);
                        ctx.fillRect(x, bottomY - barHeight / 2, barWidth, barHeight / 2);
                    } else if (directionMode === 'mirror-horizontal') {
                        // Draw from left and right edges toward center
                        ctx.fillRect(x, y, barWidth, barHeight);
                        ctx.fillRect(xRight, y, barWidth, barHeight);
                    } else {
                        ctx.fillRect(x, y, barWidth, barHeight);
                    }
                    break;
                    
                case 'rounded':
                    // Rounded top bars
                    if (directionMode === 'mirror-vertical') {
                        const topY = 0;
                        const bottomY = canvas.height;
                        const halfHeight = barHeight / 2;
                        const radius = Math.min(8, barWidth / 2);
                        // Top half
                        ctx.beginPath();
                        ctx.moveTo(x, topY);
                        ctx.lineTo(x + barWidth, topY);
                        ctx.lineTo(x + barWidth, topY + halfHeight - radius);
                        ctx.arcTo(x + barWidth, topY + halfHeight, x + barWidth - radius, topY + halfHeight, radius);
                        ctx.lineTo(x + radius, topY + halfHeight);
                        ctx.arcTo(x, topY + halfHeight, x, topY + halfHeight - radius, radius);
                        ctx.closePath();
                        ctx.fill();
                        // Bottom half
                        ctx.beginPath();
                        ctx.moveTo(x, bottomY);
                        ctx.lineTo(x + barWidth, bottomY);
                        ctx.lineTo(x + barWidth, bottomY - halfHeight + radius);
                        ctx.arcTo(x + barWidth, bottomY - halfHeight, x + barWidth - radius, bottomY - halfHeight, radius);
                        ctx.lineTo(x + radius, bottomY - halfHeight);
                        ctx.arcTo(x, bottomY - halfHeight, x, bottomY - halfHeight + radius, radius);
                        ctx.closePath();
                        ctx.fill();
                    } else if (directionMode === 'mirror-horizontal') {
                        const radius = Math.min(8, barWidth / 2);
                        // Left side
                        ctx.beginPath();
                        ctx.moveTo(x, canvas.height);
                        ctx.lineTo(x, y + radius);
                        ctx.arcTo(x, y, x + radius, y, radius);
                        ctx.lineTo(x + barWidth - radius, y);
                        ctx.arcTo(x + barWidth, y, x + barWidth, y + radius, radius);
                        ctx.lineTo(x + barWidth, canvas.height);
                        ctx.closePath();
                        ctx.fill();
                        // Right side
                        ctx.beginPath();
                        ctx.moveTo(xRight, canvas.height);
                        ctx.lineTo(xRight, y + radius);
                        ctx.arcTo(xRight, y, xRight + radius, y, radius);
                        ctx.lineTo(xRight + barWidth - radius, y);
                        ctx.arcTo(xRight + barWidth, y, xRight + barWidth, y + radius, radius);
                        ctx.lineTo(xRight + barWidth, canvas.height);
                        ctx.closePath();
                        ctx.fill();
                    } else {
                        const radius = Math.min(8, barWidth / 2);
                        ctx.beginPath();
                        ctx.moveTo(x, canvas.height);
                        ctx.lineTo(x, y + radius);
                        ctx.arcTo(x, y, x + radius, y, radius);
                        ctx.lineTo(x + barWidth - radius, y);
                        ctx.arcTo(x + barWidth, y, x + barWidth, y + radius, radius);
                        ctx.lineTo(x + barWidth, canvas.height);
                        ctx.closePath();
                        ctx.fill();
                    }
                    break;
                    
                case 'circles':
                    // Circles at bar tops
                    if (directionMode === 'mirror-vertical') {
                        const topY = 0;
                        const bottomY = canvas.height;
                        const halfHeight = barHeight / 2;
                        const circleRadius = barWidth / 2;
                        // Top circle and line
                        ctx.beginPath();
                        ctx.arc(x + circleRadius, topY + halfHeight - circleRadius, circleRadius, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillRect(x + circleRadius - 1, topY, 2, halfHeight - circleRadius);
                        // Bottom circle and line
                        ctx.beginPath();
                        ctx.arc(x + circleRadius, bottomY - halfHeight + circleRadius, circleRadius, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillRect(x + circleRadius - 1, bottomY - halfHeight + circleRadius, 2, halfHeight - circleRadius);
                    } else if (directionMode === 'mirror-horizontal') {
                        const circleRadius = barWidth / 2;
                        const circleY = y + circleRadius;
                        // Left side
                        ctx.beginPath();
                        ctx.arc(x + circleRadius, circleY, circleRadius, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillRect(x + circleRadius - 1, circleY, 2, canvas.height - circleY);
                        // Right side
                        ctx.beginPath();
                        ctx.arc(xRight + circleRadius, circleY, circleRadius, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillRect(xRight + circleRadius - 1, circleY, 2, canvas.height - circleY);
                    } else {
                        const circleRadius = barWidth / 2;
                        const circleY = y + circleRadius;
                        ctx.beginPath();
                        ctx.arc(x + circleRadius, circleY, circleRadius, 0, Math.PI * 2);
                        ctx.fill();
                        // Draw connecting line
                        ctx.fillRect(x + circleRadius - 1, circleY, 2, canvas.height - circleY);
                    }
                    break;
                    
                case 'lines':
                    // Vertical thin lines
                    const lineWidth = 2;
                    if (directionMode === 'mirror-vertical') {
                        const topY = 0;
                        const bottomY = canvas.height;
                        const halfHeight = barHeight / 2;
                        ctx.fillRect(x + (barWidth - lineWidth) / 2, topY, lineWidth, halfHeight);
                        ctx.fillRect(x + (barWidth - lineWidth) / 2, bottomY - halfHeight, lineWidth, halfHeight);
                    } else if (directionMode === 'mirror-horizontal') {
                        // Left side
                        ctx.fillRect(x + (barWidth - lineWidth) / 2, y, lineWidth, barHeight);
                        // Right side
                        ctx.fillRect(xRight + (barWidth - lineWidth) / 2, y, lineWidth, barHeight);
                    } else {
                        ctx.fillRect(x + (barWidth - lineWidth) / 2, y, lineWidth, barHeight);
                    }
                    break;
                    
                case 'dots':
                    // Dots stacked vertically
                    const dotSize = Math.min(6, barWidth);
                    const dotSpacing = dotSize + 4;
                    if (directionMode === 'mirror-vertical') {
                        const topY = 0;
                        const bottomY = canvas.height;
                        const halfHeight = barHeight / 2;
                        const dotsCount = Math.max(1, Math.floor(halfHeight / dotSpacing));
                        // Top dots
                        for (let d = 0; d < dotsCount; d++) {
                            const dotY = topY + (d * dotSpacing) + dotSize / 2;
                            ctx.beginPath();
                            ctx.arc(x + barWidth / 2, dotY, dotSize / 2, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        // Bottom dots
                        for (let d = 0; d < dotsCount; d++) {
                            const dotY = bottomY - (d * dotSpacing) - dotSize / 2;
                            ctx.beginPath();
                            ctx.arc(x + barWidth / 2, dotY, dotSize / 2, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    } else if (directionMode === 'mirror-horizontal') {
                        const dotsCount = Math.max(1, Math.floor(barHeight / dotSpacing));
                        // Left side
                        for (let d = 0; d < dotsCount; d++) {
                            const dotY = canvas.height - (d * dotSpacing) - dotSize / 2;
                            ctx.beginPath();
                            ctx.arc(x + barWidth / 2, dotY, dotSize / 2, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        // Right side
                        for (let d = 0; d < dotsCount; d++) {
                            const dotY = canvas.height - (d * dotSpacing) - dotSize / 2;
                            ctx.beginPath();
                            ctx.arc(xRight + barWidth / 2, dotY, dotSize / 2, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    } else {
                        const dotsCount = Math.max(1, Math.floor(barHeight / dotSpacing));
                        for (let d = 0; d < dotsCount; d++) {
                            const dotY = canvas.height - (d * dotSpacing) - dotSize / 2;
                            ctx.beginPath();
                            ctx.arc(x + barWidth / 2, dotY, dotSize / 2, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                    break;
                    
                case 'blocks':
                    // Stacked blocks from bottom
                    const blockSize = Math.min(barWidth, 12);
                    const blockGap = 2;
                    if (directionMode === 'mirror-vertical') {
                        const topY = 0;
                        const bottomY = canvas.height;
                        const halfHeight = barHeight / 2;
                        const blocksCount = Math.max(1, Math.floor(halfHeight / (blockSize + blockGap)));
                        // Top blocks
                        for (let b = 0; b < blocksCount; b++) {
                            const blockY = topY + (b * (blockSize + blockGap));
                            ctx.fillRect(x, blockY, barWidth, blockSize);
                        }
                        // Bottom blocks
                        for (let b = 0; b < blocksCount; b++) {
                            const blockY = bottomY - ((b + 1) * (blockSize + blockGap));
                            ctx.fillRect(x, blockY, barWidth, blockSize);
                        }
                    } else if (directionMode === 'mirror-horizontal') {
                        const blocksCount = Math.max(1, Math.floor(barHeight / (blockSize + blockGap)));
                        // Left side
                        for (let b = 0; b < blocksCount; b++) {
                            const blockY = canvas.height - ((b + 1) * (blockSize + blockGap));
                            ctx.fillRect(x, blockY, barWidth, blockSize);
                        }
                        // Right side
                        for (let b = 0; b < blocksCount; b++) {
                            const blockY = canvas.height - ((b + 1) * (blockSize + blockGap));
                            ctx.fillRect(xRight, blockY, barWidth, blockSize);
                        }
                    } else {
                        const blocksCount = Math.max(1, Math.floor(barHeight / (blockSize + blockGap)));
                        for (let b = 0; b < blocksCount; b++) {
                            const blockY = canvas.height - ((b + 1) * (blockSize + blockGap));
                            ctx.fillRect(x, blockY, barWidth, blockSize);
                        }
                    }
                    break;
                    
                case 'mirror':
                    // Mirrored bars from center
                    if (directionMode === 'mirror-horizontal') {
                        // Mirror-horizontal: draw from left and right edges
                        const centerY = canvas.height / 2;
                        const halfHeight = barHeight / 2;
                        // Left side
                        ctx.fillRect(x, centerY - halfHeight, barWidth, halfHeight);
                        ctx.fillRect(x, centerY, barWidth, halfHeight);
                        // Right side
                        ctx.fillRect(xRight, centerY - halfHeight, barWidth, halfHeight);
                        ctx.fillRect(xRight, centerY, barWidth, halfHeight);
                    } else {
                        // Normal mirror or mirror-vertical: draw from center
                        const centerY = canvas.height / 2;
                        const halfHeight = barHeight / 2;
                        // Draw upper half
                        ctx.fillRect(x, centerY - halfHeight, barWidth, halfHeight);
                        // Draw lower half
                        ctx.fillRect(x, centerY, barWidth, halfHeight);
                    }
                    break;
                    
                case 'flames':
                    // Flame-like triangular shapes
                    if (directionMode === 'mirror-vertical') {
                        const topY = 0;
                        const bottomY = canvas.height;
                        const halfHeight = barHeight / 2;
                        // Top flame
                        ctx.beginPath();
                        ctx.moveTo(x + barWidth / 2, topY);
                        ctx.lineTo(x, topY + halfHeight);
                        ctx.lineTo(x + barWidth, topY + halfHeight);
                        ctx.closePath();
                        ctx.fill();
                        // Bottom flame
                        ctx.beginPath();
                        ctx.moveTo(x + barWidth / 2, bottomY);
                        ctx.lineTo(x, bottomY - halfHeight);
                        ctx.lineTo(x + barWidth, bottomY - halfHeight);
                        ctx.closePath();
                        ctx.fill();
                    } else if (directionMode === 'mirror-horizontal') {
                        // Left flame
                        ctx.beginPath();
                        ctx.moveTo(x + barWidth / 2, y);
                        ctx.lineTo(x, canvas.height);
                        ctx.lineTo(x + barWidth, canvas.height);
                        ctx.closePath();
                        ctx.fill();
                        // Right flame
                        ctx.beginPath();
                        ctx.moveTo(xRight + barWidth / 2, y);
                        ctx.lineTo(xRight, canvas.height);
                        ctx.lineTo(xRight + barWidth, canvas.height);
                        ctx.closePath();
                        ctx.fill();
                    } else {
                        ctx.beginPath();
                        ctx.moveTo(x + barWidth / 2, y);
                        ctx.lineTo(x, canvas.height);
                        ctx.lineTo(x + barWidth, canvas.height);
                        ctx.closePath();
                        ctx.fill();
                    }
                    break;
                    
                case 'arches':
                    // Semi-circular arches
                    if (directionMode === 'mirror-vertical') {
                        const topY = 0;
                        const bottomY = canvas.height;
                        const halfHeight = barHeight / 2;
                        // Top arch
                        ctx.beginPath();
                        ctx.arc(x + barWidth / 2, topY + halfHeight, barWidth / 2, Math.PI, 0, true);
                        ctx.fill();
                        // Bottom arch
                        ctx.beginPath();
                        ctx.arc(x + barWidth / 2, bottomY - halfHeight, barWidth / 2, 0, Math.PI, true);
                        ctx.fill();
                    } else if (directionMode === 'mirror-horizontal') {
                        // Left arch
                        ctx.beginPath();
                        ctx.arc(x + barWidth / 2, canvas.height - barWidth / 2, barWidth / 2, Math.PI, 0, true);
                        ctx.fillRect(x, canvas.height - barWidth / 2, barWidth, barHeight - barWidth / 2);
                        ctx.fill();
                        // Right arch
                        ctx.beginPath();
                        ctx.arc(xRight + barWidth / 2, canvas.height - barWidth / 2, barWidth / 2, Math.PI, 0, true);
                        ctx.fillRect(xRight, canvas.height - barWidth / 2, barWidth, barHeight - barWidth / 2);
                        ctx.fill();
                    } else {
                        ctx.beginPath();
                        ctx.arc(x + barWidth / 2, canvas.height - barWidth / 2, barWidth / 2, Math.PI, 0, true);
                        ctx.fillRect(x, canvas.height - barWidth / 2, barWidth, barHeight - barWidth / 2);
                        ctx.fill();
                    }
                    break;
                    
                case 'diamonds':
                    // Diamond shapes stacked
                    const diamondSize = Math.min(barWidth, 10);
                    const diamondSpacing = diamondSize + 3;
                    if (directionMode === 'mirror-vertical') {
                        const topY = 0;
                        const bottomY = canvas.height;
                        const halfHeight = barHeight / 2;
                        const diamondsCount = Math.max(1, Math.floor(halfHeight / diamondSpacing));
                        // Top diamonds
                        for (let d = 0; d < diamondsCount; d++) {
                            const dy = topY + d * diamondSpacing + diamondSize / 2;
                            ctx.beginPath();
                            ctx.moveTo(x + barWidth / 2, dy - diamondSize / 2);
                            ctx.lineTo(x + barWidth / 2 + diamondSize / 2, dy);
                            ctx.lineTo(x + barWidth / 2, dy + diamondSize / 2);
                            ctx.lineTo(x + barWidth / 2 - diamondSize / 2, dy);
                            ctx.closePath();
                            ctx.fill();
                        }
                        // Bottom diamonds
                        for (let d = 0; d < diamondsCount; d++) {
                            const dy = bottomY - d * diamondSpacing - diamondSize / 2;
                            ctx.beginPath();
                            ctx.moveTo(x + barWidth / 2, dy - diamondSize / 2);
                            ctx.lineTo(x + barWidth / 2 + diamondSize / 2, dy);
                            ctx.lineTo(x + barWidth / 2, dy + diamondSize / 2);
                            ctx.lineTo(x + barWidth / 2 - diamondSize / 2, dy);
                            ctx.closePath();
                            ctx.fill();
                        }
                    } else if (directionMode === 'mirror-horizontal') {
                        const diamondsCount = Math.max(1, Math.floor(barHeight / diamondSpacing));
                        // Left diamonds
                        for (let d = 0; d < diamondsCount; d++) {
                            const dy = canvas.height - d * diamondSpacing - diamondSize / 2;
                            ctx.beginPath();
                            ctx.moveTo(x + barWidth / 2, dy - diamondSize / 2);
                            ctx.lineTo(x + barWidth / 2 + diamondSize / 2, dy);
                            ctx.lineTo(x + barWidth / 2, dy + diamondSize / 2);
                            ctx.lineTo(x + barWidth / 2 - diamondSize / 2, dy);
                            ctx.closePath();
                            ctx.fill();
                        }
                        // Right diamonds
                        for (let d = 0; d < diamondsCount; d++) {
                            const dy = canvas.height - d * diamondSpacing - diamondSize / 2;
                            ctx.beginPath();
                            ctx.moveTo(xRight + barWidth / 2, dy - diamondSize / 2);
                            ctx.lineTo(xRight + barWidth / 2 + diamondSize / 2, dy);
                            ctx.lineTo(xRight + barWidth / 2, dy + diamondSize / 2);
                            ctx.lineTo(xRight + barWidth / 2 - diamondSize / 2, dy);
                            ctx.closePath();
                            ctx.fill();
                        }
                    } else {
                        const diamondsCount = Math.max(1, Math.floor(barHeight / diamondSpacing));
                        for (let d = 0; d < diamondsCount; d++) {
                            const dy = canvas.height - d * diamondSpacing - diamondSize / 2;
                            ctx.beginPath();
                            ctx.moveTo(x + barWidth / 2, dy - diamondSize / 2);
                            ctx.lineTo(x + barWidth / 2 + diamondSize / 2, dy);
                            ctx.lineTo(x + barWidth / 2, dy + diamondSize / 2);
                            ctx.lineTo(x + barWidth / 2 - diamondSize / 2, dy);
                            ctx.closePath();
                            ctx.fill();
                        }
                    }
                    break;
                    
                case 'pyramids':
                    // Stacked triangular pyramids
                    const pyramidSize = Math.min(barWidth, 12);
                    const pyramidGap = 2;
                    if (directionMode === 'mirror-vertical') {
                        const topY = 0;
                        const bottomY = canvas.height;
                        const halfHeight = barHeight / 2;
                        const pyramidsCount = Math.max(1, Math.floor(halfHeight / (pyramidSize + pyramidGap)));
                        // Top pyramids
                        for (let p = 0; p < pyramidsCount; p++) {
                            const py = topY + p * (pyramidSize + pyramidGap);
                            ctx.beginPath();
                            ctx.moveTo(x + barWidth / 2, py);
                            ctx.lineTo(x, py + pyramidSize);
                            ctx.lineTo(x + barWidth, py + pyramidSize);
                            ctx.closePath();
                            ctx.fill();
                        }
                        // Bottom pyramids
                        for (let p = 0; p < pyramidsCount; p++) {
                            const py = bottomY - (p + 1) * (pyramidSize + pyramidGap);
                            ctx.beginPath();
                            ctx.moveTo(x + barWidth / 2, py + pyramidSize);
                            ctx.lineTo(x, py);
                            ctx.lineTo(x + barWidth, py);
                            ctx.closePath();
                            ctx.fill();
                        }
                    } else if (directionMode === 'mirror-horizontal') {
                        const pyramidsCount = Math.max(1, Math.floor(barHeight / (pyramidSize + pyramidGap)));
                        // Left pyramids
                        for (let p = 0; p < pyramidsCount; p++) {
                            const py = canvas.height - (p + 1) * (pyramidSize + pyramidGap);
                            ctx.beginPath();
                            ctx.moveTo(x + barWidth / 2, py);
                            ctx.lineTo(x, py + pyramidSize);
                            ctx.lineTo(x + barWidth, py + pyramidSize);
                            ctx.closePath();
                            ctx.fill();
                        }
                        // Right pyramids
                        for (let p = 0; p < pyramidsCount; p++) {
                            const py = canvas.height - (p + 1) * (pyramidSize + pyramidGap);
                            ctx.beginPath();
                            ctx.moveTo(xRight + barWidth / 2, py);
                            ctx.lineTo(xRight, py + pyramidSize);
                            ctx.lineTo(xRight + barWidth, py + pyramidSize);
                            ctx.closePath();
                            ctx.fill();
                        }
                    } else {
                        const pyramidsCount = Math.max(1, Math.floor(barHeight / (pyramidSize + pyramidGap)));
                        for (let p = 0; p < pyramidsCount; p++) {
                            const py = canvas.height - (p + 1) * (pyramidSize + pyramidGap);
                            ctx.beginPath();
                            ctx.moveTo(x + barWidth / 2, py);
                            ctx.lineTo(x, py + pyramidSize);
                            ctx.lineTo(x + barWidth, py + pyramidSize);
                            ctx.closePath();
                            ctx.fill();
                        }
                    }
                    break;
                    
                case 'rings':
                    // Concentric rings/circles
                    const ringSize = Math.min(barWidth / 2, 8);
                    const ringSpacing = ringSize * 2 + 2;
                    if (directionMode === 'mirror-vertical') {
                        const topY = 0;
                        const bottomY = canvas.height;
                        const halfHeight = barHeight / 2;
                        const ringsCount = Math.max(1, Math.floor(halfHeight / ringSpacing));
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = gradient;
                        // Top rings
                        for (let r = 0; r < ringsCount; r++) {
                            const ry = topY + r * ringSpacing + ringSize;
                            ctx.beginPath();
                            ctx.arc(x + barWidth / 2, ry, ringSize, 0, Math.PI * 2);
                            ctx.stroke();
                        }
                        // Bottom rings
                        for (let r = 0; r < ringsCount; r++) {
                            const ry = bottomY - r * ringSpacing - ringSize;
                            ctx.beginPath();
                            ctx.arc(x + barWidth / 2, ry, ringSize, 0, Math.PI * 2);
                            ctx.stroke();
                        }
                    } else if (directionMode === 'mirror-horizontal') {
                        const ringsCount = Math.max(1, Math.floor(barHeight / ringSpacing));
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = gradient;
                        // Left rings
                        for (let r = 0; r < ringsCount; r++) {
                            const ry = canvas.height - r * ringSpacing - ringSize;
                            ctx.beginPath();
                            ctx.arc(x + barWidth / 2, ry, ringSize, 0, Math.PI * 2);
                            ctx.stroke();
                        }
                        // Right rings
                        for (let r = 0; r < ringsCount; r++) {
                            const ry = canvas.height - r * ringSpacing - ringSize;
                            ctx.beginPath();
                            ctx.arc(xRight + barWidth / 2, ry, ringSize, 0, Math.PI * 2);
                            ctx.stroke();
                        }
                    } else {
                        const ringsCount = Math.max(1, Math.floor(barHeight / ringSpacing));
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = gradient;
                        for (let r = 0; r < ringsCount; r++) {
                            const ry = canvas.height - r * ringSpacing - ringSize;
                            ctx.beginPath();
                            ctx.arc(x + barWidth / 2, ry, ringSize, 0, Math.PI * 2);
                            ctx.stroke();
                        }
                    }
                    break;
                    
                case 'hexagons':
                    // Hexagonal shapes
                    const hexSize = Math.min(barWidth / 2, 7);
                    const hexSpacing = hexSize * 2 + 3;
                    if (directionMode === 'mirror-vertical') {
                        const topY = 0;
                        const bottomY = canvas.height;
                        const halfHeight = barHeight / 2;
                        const hexCount = Math.max(1, Math.floor(halfHeight / hexSpacing));
                        // Top hexagons
                        for (let h = 0; h < hexCount; h++) {
                            const hy = topY + h * hexSpacing + hexSize;
                            ctx.beginPath();
                            for (let j = 0; j < 6; j++) {
                                const angle = (Math.PI / 3) * j;
                                const hx = x + barWidth / 2 + hexSize * Math.cos(angle);
                                const py = hy + hexSize * Math.sin(angle);
                                if (j === 0) ctx.moveTo(hx, py);
                                else ctx.lineTo(hx, py);
                            }
                            ctx.closePath();
                            ctx.fill();
                        }
                        // Bottom hexagons
                        for (let h = 0; h < hexCount; h++) {
                            const hy = bottomY - h * hexSpacing - hexSize;
                            ctx.beginPath();
                            for (let j = 0; j < 6; j++) {
                                const angle = (Math.PI / 3) * j;
                                const hx = x + barWidth / 2 + hexSize * Math.cos(angle);
                                const py = hy + hexSize * Math.sin(angle);
                                if (j === 0) ctx.moveTo(hx, py);
                                else ctx.lineTo(hx, py);
                            }
                            ctx.closePath();
                            ctx.fill();
                        }
                    } else if (directionMode === 'mirror-horizontal') {
                        const hexCount = Math.max(1, Math.floor(barHeight / hexSpacing));
                        // Left hexagons
                        for (let h = 0; h < hexCount; h++) {
                            const hy = canvas.height - h * hexSpacing - hexSize;
                            ctx.beginPath();
                            for (let j = 0; j < 6; j++) {
                                const angle = (Math.PI / 3) * j;
                                const hx = x + barWidth / 2 + hexSize * Math.cos(angle);
                                const py = hy + hexSize * Math.sin(angle);
                                if (j === 0) ctx.moveTo(hx, py);
                                else ctx.lineTo(hx, py);
                            }
                            ctx.closePath();
                            ctx.fill();
                        }
                        // Right hexagons
                        for (let h = 0; h < hexCount; h++) {
                            const hy = canvas.height - h * hexSpacing - hexSize;
                            ctx.beginPath();
                            for (let j = 0; j < 6; j++) {
                                const angle = (Math.PI / 3) * j;
                                const hx = xRight + barWidth / 2 + hexSize * Math.cos(angle);
                                const py = hy + hexSize * Math.sin(angle);
                                if (j === 0) ctx.moveTo(hx, py);
                                else ctx.lineTo(hx, py);
                            }
                            ctx.closePath();
                            ctx.fill();
                        }
                    } else {
                        const hexCount = Math.max(1, Math.floor(barHeight / hexSpacing));
                        for (let h = 0; h < hexCount; h++) {
                            const hy = canvas.height - h * hexSpacing - hexSize;
                            ctx.beginPath();
                            for (let j = 0; j < 6; j++) {
                                const angle = (Math.PI / 3) * j;
                                const hx = x + barWidth / 2 + hexSize * Math.cos(angle);
                                const py = hy + hexSize * Math.sin(angle);
                                if (j === 0) ctx.moveTo(hx, py);
                                else ctx.lineTo(hx, py);
                            }
                            ctx.closePath();
                            ctx.fill();
                        }
                    }
                    break;
                    
                case 'lightning':
                    // Zigzag lightning bolts
                    const segments = Math.max(4, Math.floor(barHeight / 20));
                    const segmentHeight = barHeight / segments;
                    const zigzagWidth = barWidth * 0.4;
                    if (directionMode === 'mirror-vertical') {
                        const topY = 0;
                        const bottomY = canvas.height;
                        const halfHeight = barHeight / 2;
                        const topSegments = Math.max(4, Math.floor(halfHeight / 20));
                        const bottomSegments = Math.max(4, Math.floor(halfHeight / 20));
                        // Top lightning
                        ctx.beginPath();
                        ctx.moveTo(x + barWidth / 2, topY);
                        for (let s = 0; s < topSegments; s++) {
                            const yPos = topY + (s + 1) * (halfHeight / topSegments);
                            const xOffset = (s % 2 === 0) ? zigzagWidth : -zigzagWidth;
                            ctx.lineTo(x + barWidth / 2 + xOffset, yPos);
                        }
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = gradient;
                        ctx.stroke();
                        // Bottom lightning
                        ctx.beginPath();
                        ctx.moveTo(x + barWidth / 2, bottomY);
                        for (let s = 0; s < bottomSegments; s++) {
                            const yPos = bottomY - (s + 1) * (halfHeight / bottomSegments);
                            const xOffset = (s % 2 === 0) ? zigzagWidth : -zigzagWidth;
                            ctx.lineTo(x + barWidth / 2 + xOffset, yPos);
                        }
                        ctx.stroke();
                    } else if (directionMode === 'mirror-horizontal') {
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = gradient;
                        // Left lightning
                        ctx.beginPath();
                        ctx.moveTo(x + barWidth / 2, canvas.height);
                        for (let s = 0; s < segments; s++) {
                            const yPos = canvas.height - (s + 1) * segmentHeight;
                            const xOffset = (s % 2 === 0) ? zigzagWidth : -zigzagWidth;
                            ctx.lineTo(x + barWidth / 2 + xOffset, yPos);
                        }
                        ctx.stroke();
                        // Right lightning
                        ctx.beginPath();
                        ctx.moveTo(xRight + barWidth / 2, canvas.height);
                        for (let s = 0; s < segments; s++) {
                            const yPos = canvas.height - (s + 1) * segmentHeight;
                            const xOffset = (s % 2 === 0) ? zigzagWidth : -zigzagWidth;
                            ctx.lineTo(xRight + barWidth / 2 + xOffset, yPos);
                        }
                        ctx.stroke();
                    } else {
                        ctx.beginPath();
                        ctx.moveTo(x + barWidth / 2, canvas.height);
                        for (let s = 0; s < segments; s++) {
                            const yPos = canvas.height - (s + 1) * segmentHeight;
                            const xOffset = (s % 2 === 0) ? zigzagWidth : -zigzagWidth;
                            ctx.lineTo(x + barWidth / 2 + xOffset, yPos);
                        }
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = gradient;
                        ctx.stroke();
                    }
                    break;
                    
                case 'neon':
                    // Segmented neon tube effect
                    const neonSegmentSize = 8;
                    const neonGap = 3;
                    const neonSegments = Math.max(1, Math.floor(barHeight / (neonSegmentSize + neonGap)));
                    if (directionMode === 'mirror-vertical') {
                        const topY = 0;
                        const bottomY = canvas.height;
                        const halfHeight = barHeight / 2;
                        const segCount = Math.max(1, Math.floor(halfHeight / (neonSegmentSize + neonGap)));
                        // Top neon segments
                        for (let n = 0; n < segCount; n++) {
                            const ny = topY + n * (neonSegmentSize + neonGap);
                            ctx.fillRect(x + 2, ny, barWidth - 4, neonSegmentSize);
                        }
                        // Bottom neon segments
                        for (let n = 0; n < segCount; n++) {
                            const ny = bottomY - (n + 1) * (neonSegmentSize + neonGap);
                            ctx.fillRect(x + 2, ny, barWidth - 4, neonSegmentSize);
                        }
                    } else if (directionMode === 'mirror-horizontal') {
                        // Left neon segments
                        for (let n = 0; n < neonSegments; n++) {
                            const ny = canvas.height - (n + 1) * (neonSegmentSize + neonGap);
                            ctx.fillRect(x + 2, ny, barWidth - 4, neonSegmentSize);
                        }
                        // Right neon segments
                        for (let n = 0; n < neonSegments; n++) {
                            const ny = canvas.height - (n + 1) * (neonSegmentSize + neonGap);
                            ctx.fillRect(xRight + 2, ny, barWidth - 4, neonSegmentSize);
                        }
                    } else {
                        for (let n = 0; n < neonSegments; n++) {
                            const ny = canvas.height - (n + 1) * (neonSegmentSize + neonGap);
                            ctx.fillRect(x + 2, ny, barWidth - 4, neonSegmentSize);
                        }
                    }
                    break;
            }
        }
    
    // Glass overlay effect - full canvas with blur
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'blur(45px)';
    
    // Full canvas gradient overlay
    const fullGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    fullGradient.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    fullGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
    fullGradient.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
    ctx.fillStyle = fullGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add frosted glass noise effect
    for (let i = 0; i < 100; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.03})`;
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 3;
        ctx.fillRect(x, y, size, size);
    }
    
    ctx.filter = 'none';
    ctx.restore();
    
    // Rainy glass overlay effect - sophisticated wet glass texture
    if (rainingGlassEnabled) {
        ctx.save();
        
        // Frosted glass base layer with subtle gradient
        const frostGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        frostGradient.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
        frostGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
        frostGradient.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
        ctx.fillStyle = frostGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Larger water droplets with realistic glass refraction
        rainDrops.forEach(drop => {
            const x = drop.x * canvas.width;
            const y = drop.y * canvas.height;
            const radius = drop.size * 6;
            
            // Outer glow/water edge
            const outerGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            outerGradient.addColorStop(0, 'rgba(200, 230, 255, 0.15)');
            outerGradient.addColorStop(0.7, 'rgba(200, 230, 255, 0.08)');
            outerGradient.addColorStop(1, 'rgba(200, 230, 255, 0)');
            
            ctx.fillStyle = outerGradient;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner droplet with highlight
            const innerGradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius * 0.7);
            innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
            innerGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
            innerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = innerGradient;
            ctx.beginPath();
            ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
            ctx.fill();
            
            // Bright highlight spot
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.beginPath();
            ctx.arc(x - radius * 0.4, y - radius * 0.4, radius * 0.25, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Bokeh-style light diffusion circles
        for (let i = 0; i < 15; i++) {
            const bx = Math.random() * canvas.width;
            const by = Math.random() * canvas.height;
            const br = 10 + Math.random() * 20;
            
            const bokehGradient = ctx.createRadialGradient(bx, by, 0, bx, by, br);
            bokehGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
            bokehGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.06)');
            bokehGradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.03)');
            bokehGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = bokehGradient;
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Subtle vertical streak pattern
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 30; i++) {
            const sx = (i / 30) * canvas.width + (Math.random() - 0.5) * 40;
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx + (Math.random() - 0.5) * 10, canvas.height);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    // 90s screen overlay effect
    if (retro90sEnabled) {
        ctx.save();
        
        // Scanlines
        for (let i = 0; i < canvas.height; i += 4) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(0, i, canvas.width, 2);
        }
        
        // Vignette
        const vignetteGradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, canvas.width * 0.7
        );
        vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        ctx.fillStyle = vignetteGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Color aberration effect
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = 'rgba(255, 0, 0, 0.03)';
        ctx.fillRect(2, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 255, 255, 0.03)';
        ctx.fillRect(-2, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
        
        // Subtle noise
        for (let i = 0; i < 50; i++) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.1})`;
            ctx.fillRect(
                Math.random() * canvas.width,
                Math.random() * canvas.height,
                1, 1
            );
        }
        
        ctx.restore();
    }
    
    // Draw current lyrics line on canvas
    const activeLyricsLine = document.querySelector('.lyrics-line.active');
    if (activeLyricsLine && activeLyricsLine.textContent.trim()) {
        const lyricsText = activeLyricsLine.textContent.trim();
        
        // Setup text styling
        ctx.save();
        
        // Calculate font size based on canvas height
        const fontSize = Math.max(32, Math.min(56, canvas.height * 0.07));
        ctx.font = `bold ${fontSize}px 'Arial Black', 'Impact', 'Helvetica', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Position text based on lyricsPosition variable
        const textX = canvas.width / 2;
        let textY;
        if (lyricsPosition === 'up') {
            textY = canvas.height * 0.20;
        } else if (lyricsPosition === 'down') {
            textY = canvas.height * 0.85;
        } else {
            textY = canvas.height / 2;
        }
        
        // Draw text
        ctx.fillStyle = lyricsColor;
        ctx.fillText(lyricsText, textX, textY);
        
        ctx.restore();
    }
}

function startFrequencyVisualization(targetCanvas = null) {
    if (!analyser || !frequencyData) return;
    
    const canvas = targetCanvas || document.getElementById('frequency-canvas');
    if (!canvas) return;
    
    // Add this canvas to the active set
    activeCanvases.add(canvas);
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Function to update album art background (use global variables)
    function updateAlbumArtBackground() {
        albumArtLoaded = false;
        if (currentSongIndex !== -1 && filteredSongs[currentSongIndex]) {
            const currentSong = filteredSongs[currentSongIndex];
            if (currentSong.has_art) {
                albumArtImage = new Image();
                albumArtImage.crossOrigin = 'anonymous';
                albumArtImage.onload = () => {
                    albumArtLoaded = true;
                };
                albumArtImage.src = `/api/art/${currentSong.id}`;
            }
        }
    }
    
    // Only set up event listener once (not per canvas)
    if (!audio.albumArtListenerSet) {
        // Initial load
        updateAlbumArtBackground();
        
        // Listen for song changes to update background
        audio.addEventListener('loadedmetadata', updateAlbumArtBackground);
        audio.albumArtListenerSet = true;
    }
    
    // Limit frame rate to 30fps for better performance
    let lastFrameTime = 0;
    const targetFrameTime = 1000 / 30; // 30fps instead of 60fps
    let frameCount = 0;
    
    function draw(currentTime) {
        // Check if studio is still open, if not stop the animation
        const studioPanel = document.getElementById('studio-panel');
        if (!studioPanel || !studioPanel.classList.contains('show')) {
            stopFrequencyVisualization();
            return;
        }
        
        // If music is not playing, skip expensive rendering to save CPU
        // Only render a static background frame
        if (!audio || audio.paused) {
            // Draw static background only once when paused
            if (!canvas.pausedFrameDrawn) {
                const ctx = canvas.getContext('2d');
                if (showBackgroundImage && albumArtLoaded && albumArtImage.complete) {
                    // Draw album art background
                    const canvasAspect = canvas.width / canvas.height;
                    const imgAspect = albumArtImage.width / albumArtImage.height;
                    const zoomFactor = 2.0;
                    
                    let drawWidth, drawHeight, offsetX, offsetY;
                    if (canvasAspect > imgAspect) {
                        drawWidth = canvas.width * zoomFactor;
                        drawHeight = (canvas.width / imgAspect) * zoomFactor;
                        offsetX = -(drawWidth - canvas.width) / 2;
                        offsetY = (canvas.height - drawHeight) / 2;
                    } else {
                        drawHeight = canvas.height * zoomFactor;
                        drawWidth = (canvas.height * imgAspect) * zoomFactor;
                        offsetX = (canvas.width - drawWidth) / 2;
                        offsetY = -(drawHeight - canvas.height) / 2;
                    }
                    
                    ctx.drawImage(albumArtImage, offsetX, offsetY, drawWidth, drawHeight);
                    ctx.globalCompositeOperation = 'overlay';
                    ctx.fillStyle = 'rgba(128, 128, 128, 0.4)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.fillStyle = 'rgba(10, 10, 10, 0.7)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                } else {
                    // Just dark background
                    ctx.fillStyle = 'rgba(10, 10, 10, 0.8)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                canvas.pausedFrameDrawn = true;
            }
            animationId = requestAnimationFrame(draw);
            return; // Don't do expensive FFT analysis or bar rendering when paused
        }
        
        // Clear the paused flag when playing
        canvas.pausedFrameDrawn = false;
        
        animationId = requestAnimationFrame(draw);
        
        // Throttle to 30fps
        const elapsed = currentTime - lastFrameTime;
        if (elapsed < targetFrameTime) {
            return; // Skip this frame
        }
        
        lastFrameTime = currentTime - (elapsed % targetFrameTime);
        frameCount++;
        
        analyser.getByteFrequencyData(frequencyData);
        renderVisualizationToCanvas(canvas, ctx, frequencyData);
        
        // Update ambient lighting every 2nd frame (15fps) for additional savings
        if (frameCount % 2 === 0) {
            updateAmbientLighting(frequencyData);
        }
    }
    
    draw();
}

function stopFrequencyVisualization() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

// Beat detection state
let lastBassLevel = 0;
let lastBeatTime = 0;
let recentBeatEnergy = [];
let noiseFloor = 0.1;
let adaptiveThreshold = 0.15;
let previousSpectrum = new Array(256).fill(0);
let scaleVelocity = 0;
let currentScale = 1;
let beatIntensityDecay = 0;
let ambientLightingEnabled = true;
let lyricsPosition = 'center'; // 'up', 'center', 'down'
let lyricsColor = '#ffffff'; // Default white color
let rainingGlassEnabled = false;
let retro90sEnabled = false;
let rainDrops = [];
let lightingThemeColor = '#1db954'; // Default green

// Update ambient studio lighting based on frequency data
function updateAmbientLighting(frequencyData) {
    // Don't update if studio panel is not visible
    const studioPanel = document.getElementById('studio-panel');
    if (!studioPanel || !studioPanel.classList.contains('show')) return;
    
    if (!frequencyData || !ambientLightingEnabled) return;
    
    // Calculate energy from different frequency bands with heavy bass focus
    const subBass = frequencyData.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
    const bass = frequencyData.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
    const lowMid = frequencyData.slice(20, 60).reduce((a, b) => a + b, 0) / 40;
    const mid = frequencyData.slice(60, 120).reduce((a, b) => a + b, 0) / 60;
    const treble = frequencyData.slice(120, 200).reduce((a, b) => a + b, 0) / 80;
    const highFreq = frequencyData.slice(200, 256).reduce((a, b) => a + b, 0) / 56;
    
    // Normalize values (0-1)
    const subBassIntensity = subBass / 255;
    const bassIntensity = bass / 255;
    const lowMidIntensity = lowMid / 255;
    const midIntensity = mid / 255;
    const trebleIntensity = treble / 255;
    const highFreqIntensity = highFreq / 255;
    
    // Spectral flux calculation (change in spectrum over time)
    let spectralFlux = 0;
    for (let i = 0; i < 50; i++) { // Focus on low-mid frequencies for beats
        const diff = Math.max(0, frequencyData[i] - previousSpectrum[i]);
        spectralFlux += diff;
        previousSpectrum[i] = frequencyData[i];
    }
    spectralFlux = spectralFlux / (50 * 255); // Normalize
    
    // Update noise floor (minimum energy level) - slowly adapt
    noiseFloor = noiseFloor * 0.995 + Math.min(bassIntensity, subBassIntensity) * 0.005;
    
    // Calculate bass delta for beat detection
    const bassDelta = bassIntensity - lastBassLevel;
    
    // Advanced beat detection criteria
    const currentTime = Date.now();
    const timeSinceLastBeat = currentTime - lastBeatTime;
    const minBeatInterval = 100; // Minimum 100ms between beats (more responsive)
    
    // More sensitive beat detection using both delta and spectral flux
    const hasSharpTransient = bassDelta > adaptiveThreshold * 0.7 && spectralFlux > 0.05;
    const aboveNoiseFloor = bassIntensity > (noiseFloor + 0.08);
    const enoughTimePassed = timeSinceLastBeat > minBeatInterval;
    const isActualBeat = hasSharpTransient && aboveNoiseFloor && enoughTimePassed;
    
    // Beat flash intensity with decay
    if (isActualBeat) {
        beatIntensityDecay = Math.min(1.0, bassDelta * 25 + spectralFlux * 15);
        lastBeatTime = currentTime;
        
        // Add velocity burst for scale
        scaleVelocity += beatIntensityDecay * 0.2;
        
        // Track recent beat energy for adaptive threshold
        recentBeatEnergy.push(bassDelta);
        if (recentBeatEnergy.length > 12) {
            recentBeatEnergy.shift();
        }
        
        // Adjust adaptive threshold based on recent beats
        const avgBeatEnergy = recentBeatEnergy.reduce((a, b) => a + b, 0) / recentBeatEnergy.length;
        adaptiveThreshold = Math.max(0.06, Math.min(0.22, avgBeatEnergy * 0.7));
    }
    
    // Faster decay of beat intensity for more visible flashing
    beatIntensityDecay *= 0.82;
    
    lastBassLevel = bassIntensity;
    
    // Calculate overall intensity with better frequency separation
    let overallIntensity = (
        subBassIntensity * 0.40 + 
        bassIntensity * 0.30 + 
        lowMidIntensity * 0.15 + 
        midIntensity * 0.10 + 
        trebleIntensity * 0.04 +
        highFreqIntensity * 0.01
    );
    
    // Smoothly amplify intensity
    overallIntensity = Math.pow(overallIntensity, 0.6) * 1.6;
    
    // Add beat boost with smooth decay
    overallIntensity = Math.min(1.0, overallIntensity + beatIntensityDecay * 2.2);
    
    // Map intensity to opacity with higher floor and ceiling
    const glowIntensity = 0.2 + (overallIntensity * 0.8);
    
    // More extreme dynamic hue shift based on frequency
    const hueShift = (trebleIntensity * 50) + (beatIntensityDecay * 70);
    
    // Massive saturation and lightness boost on beats
    const beatBoost = beatIntensityDecay * 80;
    
    // Dynamic scale with momentum physics for smooth, natural motion
    const targetScale = 0.4 + (subBassIntensity * 0.7) + (bassIntensity * 0.5) + (lowMidIntensity * 0.2);
    
    // Apply velocity and damping for elastic feel
    const scaleDiff = targetScale - currentScale;
    scaleVelocity += scaleDiff * 0.3; // Spring force
    scaleVelocity *= 0.75; // Damping
    currentScale += scaleVelocity;
    currentScale = Math.max(0.3, Math.min(2.0, currentScale));
    
    // Add beat burst to scale
    const lightingScale = currentScale + (beatIntensityDecay * 0.7);
    
    // Secondary layer: smoother, different response for depth
    const secondaryBase = 0.5 + (bassIntensity * 0.6) + (midIntensity * 0.3);
    const secondaryScale = Math.min(1.5, secondaryBase + (beatIntensityDecay * 0.4));
    
    // Dynamic blur with more dramatic transitions
    const baseBlur = 50 + (overallIntensity * 100);
    const blurAmount = baseBlur + (beatIntensityDecay * 80);
    
    // Enhanced side lighting with stereo field - more dramatic
    const leftIntensity = (subBassIntensity * 0.6 + bassIntensity * 0.4 + lowMidIntensity * 0.3) * (0.8 + beatIntensityDecay * 1.2);
    const rightIntensity = (bassIntensity * 0.5 + midIntensity * 0.4 + trebleIntensity * 0.3) * (0.8 + beatIntensityDecay * 1.2);
    
    // Rotation effect on beats with more dramatic movement
    const rotationAngle = beatIntensityDecay * 12;
    
    // More dramatic pulsing animation
    const pulseScale = 1 + (Math.sin(Date.now() / 150) * 0.08 * overallIntensity);
    
    // Update CSS custom properties with extreme amplification
    const root = document.documentElement;
    root.style.setProperty('--ambient-glow-intensity', glowIntensity.toFixed(3));
    root.style.setProperty('--ambient-glow-scale', (lightingScale * pulseScale).toFixed(3));
    root.style.setProperty('--ambient-glow-scale-secondary', (secondaryScale * pulseScale).toFixed(3));
    root.style.setProperty('--ambient-glow-blur', `${blurAmount}px`);
    root.style.setProperty('--ambient-glow-rotation', `${rotationAngle}deg`);
    root.style.setProperty('--ambient-side-left', leftIntensity.toFixed(3));
    root.style.setProperty('--ambient-side-right', rightIntensity.toFixed(3));
    
    // Convert hex theme color to RGB then to HSL for lighting
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        } : null;
    };
    
    const rgbToHsl = (r, g, b) => {
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return [h * 360, s * 100, l * 100];
    };
    
    const rgb = hexToRgb(lightingThemeColor);
    const [themeHue, themeSat, themeLight] = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : [142, 76, 36];
    
    // Apply hue shift from frequency analysis
    const dynamicHue = (themeHue + hueShift) % 360;
    
    // More dramatic color layers with higher saturation and contrast
    root.style.setProperty('--ambient-glow-color', 
        `hsla(${dynamicHue}, ${Math.min(100, themeSat * 1.3 + beatBoost)}%, ${Math.min(85, themeLight * 1.4 + beatBoost * 1.2)}%, ${0.4 + overallIntensity * 0.6})`);
    root.style.setProperty('--ambient-glow-secondary', 
        `hsla(${(dynamicHue + 60) % 360}, ${Math.min(100, themeSat * 1.25 + beatBoost)}%, ${Math.min(80, themeLight * 1.3 + beatBoost * 1.1)}%, ${0.35 + overallIntensity * 0.5})`);
    root.style.setProperty('--ambient-glow-tertiary', 
        `hsla(${(dynamicHue + 120) % 360}, ${Math.min(100, themeSat * 1.2 + beatBoost * 0.8)}%, ${Math.min(75, themeLight * 1.2 + beatBoost)}%, ${0.3 + overallIntensity * 0.4})`);
}

function applyStudioPreset(preset) {
    setEQPreset(preset);
    updateStudioSliders();
}

// ============================================
// Lyrics Functions
// ============================================

let lyricsEditMode = false;

async function openLyricsPage() {
    const lyricsView = document.getElementById('lyrics-view');
    const playlistEl = document.querySelector('.playlist');
    const studioPanel = document.getElementById('studio-panel');
    const lyricsBtn = document.getElementById('lyrics-btn');
    
    // If lyrics is already open, close it
    if (lyricsView && lyricsView.style.display === 'flex') {
        closeLyricsPage();
        return;
    }
    
    // Close studio if it's open using the proper close function
    if (studioPanel && studioPanel.classList.contains('show')) {
        closeStudio();
    }
    
    // Hide playlist, show lyrics
    if (playlistEl) playlistEl.style.display = 'none';
    if (lyricsView) lyricsView.style.display = 'flex';
    
    // Add active class to lyrics button
    if (lyricsBtn) lyricsBtn.classList.add('active');
    
    // If a song is playing, load its lyrics
    if (currentSongIndex !== -1 && filteredSongs[currentSongIndex]) {
        const song = filteredSongs[currentSongIndex];
        
        // Load and display lyrics
        await loadAndDisplayLyrics();
    }
    
    lyricsEditMode = false;
}

function closeLyricsPage() {
    const lyricsView = document.getElementById('lyrics-view');
    const playlistEl = document.querySelector('.playlist');
    const lyricsBtn = document.getElementById('lyrics-btn');
    
    // Hide lyrics
    if (lyricsView) lyricsView.style.display = 'none';
    
    // Always show playlist when closing lyrics (studio is separate overlay)
    if (playlistEl) playlistEl.style.display = 'flex';
    
    // Remove active class from lyrics button
    if (lyricsBtn) lyricsBtn.classList.remove('active');
    
    lyricsEditMode = false;
    
    // Clear cached container to prevent memory leaks
    cachedLyricsContainer = null;
    lastScrollTarget = -1;
    
    // Reset to display mode
    document.getElementById('lyrics-display').style.display = 'flex';
    document.getElementById('lyrics-editor-container').style.display = 'none';
}

async function updateLyricsPageIfOpen() {
    const lyricsView = document.getElementById('lyrics-view');
    
    // Only update if lyrics page is currently open
    if (!lyricsView || lyricsView.style.display !== 'flex') {
        return;
    }
    
    if (currentSongIndex === -1 || !filteredSongs[currentSongIndex]) {
        return;
    }
    
    const song = filteredSongs[currentSongIndex];
    
    // If in edit mode, don't update to avoid losing unsaved changes
    if (lyricsEditMode) {
        return;
    }
    
    // Update lyrics content
    await loadAndDisplayLyrics();
}

// Parse LRC format lyrics: [mm:ss.xx]Lyric text
function parseLRC(lrcText) {
    const lines = lrcText.split('\n');
    const parsed = [];
    const lrcRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)$/;
    
    for (const line of lines) {
        const match = line.match(lrcRegex);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0;
            const time = minutes * 60 + seconds + milliseconds / 1000;
            const text = match[4].trim();
            
            if (text) {
                parsed.push({ time, text });
            }
        } else if (line.trim() && !line.startsWith('[')) {
            // Non-timestamped line - add as plain text at the end
            parsed.push({ time: -1, text: line.trim() });
        }
    }
    
    // Sort by time
    parsed.sort((a, b) => {
        if (a.time === -1) return 1;
        if (b.time === -1) return -1;
        return a.time - b.time;
    });
    
    return parsed;
}

function displayLyrics(lyricsText, hasTimestamps) {
    const lyricsContainer = document.getElementById('lyrics-text');
    const lyricsDisplay = document.getElementById('lyrics-display');
    const emptyState = lyricsDisplay.querySelector('.lyrics-empty-state');
    
    if (!lyricsText || !lyricsText.trim()) {
        lyricsContainer.style.display = 'none';
        emptyState.style.display = 'block';
        lyricsDisplay.classList.remove('has-synced-lyrics');
        lyricsLines = [];
        return;
    }
    
    if (hasTimestamps) {
        // Display time-synced lyrics with Spotify-like layout
        lyricsContainer.innerHTML = '';
        lyricsContainer.classList.add('synced');
        lyricsDisplay.classList.add('has-synced-lyrics');
        
        // Add top spacer for centering first line
        const topSpacer = document.createElement('div');
        topSpacer.className = 'lyrics-spacer';
        lyricsContainer.appendChild(topSpacer);
        
        // Add all lyric lines
        lyricsLines.forEach((line, index) => {
            const lineDiv = document.createElement('div');
            lineDiv.className = 'lyrics-line future';
            lineDiv.textContent = line.text;
            lineDiv.dataset.index = index;
            lineDiv.dataset.time = line.time;
            
            // Allow clicking to seek to that time
            if (line.time >= 0) {
                lineDiv.addEventListener('click', () => {
                    if (audio.readyState >= 2) {
                        audio.currentTime = line.time;
                    }
                });
            }
            
            lyricsContainer.appendChild(lineDiv);
        });
        
        // Add bottom spacer for centering last line
        const bottomSpacer = document.createElement('div');
        bottomSpacer.className = 'lyrics-spacer';
        lyricsContainer.appendChild(bottomSpacer);
    } else {
        // Display plain text lyrics
        lyricsContainer.classList.remove('synced');
        lyricsDisplay.classList.remove('has-synced-lyrics');
        lyricsContainer.classList.remove('synced');
        lyricsContainer.textContent = lyricsText;
    }
    
    lyricsContainer.style.display = 'block';
    emptyState.style.display = 'none';
}

async function loadAndDisplayLyrics() {
    if (currentSongIndex === -1 || !filteredSongs[currentSongIndex]) {
        return;
    }
    
    const song = filteredSongs[currentSongIndex];
    const lyricsDisplay = document.getElementById('lyrics-display');
    const lyricsText = document.getElementById('lyrics-text');
    const emptyState = lyricsDisplay.querySelector('.lyrics-empty-state');
    
    try {
        const response = await fetch(`/api/lyrics?path=${encodeURIComponent(song.path)}`);
        if (response.ok) {
            const data = await response.json();
            
            if (data.lyrics && data.lyrics.trim()) {
                // Check if lyrics contain LRC timestamps
                const hasLRC = /\[\d{2}:\d{2}/.test(data.lyrics);
                
                if (hasLRC) {
                    lyricsLines = parseLRC(data.lyrics);
                    displayLyrics(data.lyrics, true);
                    currentLyricIndex = -1;
                } else {
                    lyricsLines = [];
                    displayLyrics(data.lyrics, false);
                }
            } else {
                lyricsText.style.display = 'none';
                emptyState.style.display = 'block';
                lyricsLines = [];
            }
        }
    } catch (error) {
        console.error('Error loading lyrics:', error);
        lyricsText.style.display = 'none';
        emptyState.style.display = 'block';
        lyricsLines = [];
    }
}

// Cache for lyric container to reduce DOM queries
let cachedLyricsContainer = null;
let lastScrollTarget = -1;
let scrollAnimationId = null;

// Update active lyric line based on current playback time (Spotify-style) - OPTIMIZED
function updateCurrentLyric() {
    if (lyricsLines.length === 0 || currentSongIndex === -1) {
        return;
    }
    
    const currentTime = audio.currentTime;
    let activeIndex = -1;
    
    // Binary search for current active line (much faster than linear for large lists)
    let left = 0, right = lyricsLines.length - 1;
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (lyricsLines[mid].time < 0) {
            right = mid - 1;
        } else if (lyricsLines[mid].time <= currentTime) {
            activeIndex = mid;
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    
    // Only update if changed
    if (activeIndex !== currentLyricIndex) {
        currentLyricIndex = activeIndex;
        
        // Cache lyrics container query
        if (!cachedLyricsContainer) {
            cachedLyricsContainer = document.getElementById('lyrics-text');
        }
        const lyricsContainer = cachedLyricsContainer;
        if (!lyricsContainer) return;
        
        const lines = lyricsContainer.querySelectorAll('.lyrics-line');
        
        // Update only changed lines
        lines.forEach((line, index) => {
            let newClassName = 'lyrics-line';
            const lineTime = parseFloat(line.dataset.time);
            
            if (lineTime < 0) {
                newClassName += ' future';
            } else if (index === activeIndex) {
                newClassName += ' active';
            } else if (index < activeIndex) {
                newClassName += ' past';
            } else {
                newClassName += ' future';
            }
            
            // Only update if changed
            if (line.className !== newClassName) {
                line.className = newClassName;
            }
        });
        
        // Scroll management - only when needed
        if (activeIndex !== lastScrollTarget && activeIndex >= 0) {
            lastScrollTarget = activeIndex;
            const activeLine = lines[activeIndex];
            if (activeLine) {
                const container = document.getElementById('lyrics-display');
                if (container) {
                    // Use native smooth scroll (simpler, better performance)
                    activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }
}

function enterEditMode() {
    if (currentSongIndex === -1 || !filteredSongs[currentSongIndex]) {
        return;
    }
    
    const song = filteredSongs[currentSongIndex];
    const lyricsDisplay = document.getElementById('lyrics-display');
    const lyricsEditorContainer = document.getElementById('lyrics-editor-container');
    const lyricsEditor = document.getElementById('lyrics-editor');
    const lyricsText = document.getElementById('lyrics-text');
    
    // Get current lyrics - if time-synced, reconstruct from lyricsLines
    if (lyricsLines.length > 0) {
        // Reconstruct LRC format or plain text
        let reconstructed = '';
        lyricsLines.forEach(line => {
            if (line.time >= 0) {
                const minutes = Math.floor(line.time / 60);
                const seconds = Math.floor(line.time % 60);
                const milliseconds = Math.floor((line.time % 1) * 100);
                reconstructed += `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}]${line.text}\n`;
            } else {
                reconstructed += `${line.text}\n`;
            }
        });
        lyricsEditor.value = reconstructed;
    } else {
        lyricsEditor.value = lyricsText.textContent || '';
    }
    
    // Switch to edit mode
    lyricsDisplay.style.display = 'none';
    lyricsEditorContainer.style.display = 'flex';
    lyricsEditMode = true;
    
    // Focus editor
    setTimeout(() => lyricsEditor.focus(), 100);
}

function cancelEdit() {
    const lyricsDisplay = document.getElementById('lyrics-display');
    const lyricsEditorContainer = document.getElementById('lyrics-editor-container');
    
    // Switch back to display mode
    lyricsDisplay.style.display = 'flex';
    lyricsEditorContainer.style.display = 'none';
    lyricsEditMode = false;
}

async function saveLyrics() {
    if (currentSongIndex === -1 || !filteredSongs[currentSongIndex]) {
        return;
    }
    
    const song = filteredSongs[currentSongIndex];
    const lyricsEditor = document.getElementById('lyrics-editor');
    const lyrics = lyricsEditor.value.trim();
    
    try {
        const response = await fetch('/api/lyrics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                path: song.path,
                lyrics: lyrics
            })
        });
        
        if (response.ok) {
            console.log('Lyrics saved successfully');
            await loadAndDisplayLyrics();
            updateLyricsIndicator();
            cancelEdit();
        } else {
            await showAlert('Failed to save lyrics. Please try again.', 'Error');
        }
    } catch (error) {
        console.error('Error saving lyrics:', error);
        await showAlert('Error saving lyrics. Please try again.', 'Error');
    }
}

// Update active lyric line based on current playback time
function updateCurrentLyric() {
    if (lyricsLines.length === 0 || currentSongIndex === -1) {
        return;
    }
    
    const currentTime = audio.currentTime;
    let activeIndex = -1;
    
    // Find the current active line
    for (let i = lyricsLines.length - 1; i >= 0; i--) {
        if (lyricsLines[i].time >= 0 && currentTime >= lyricsLines[i].time) {
            activeIndex = i;
            break;
        }
    }
    
    // Only update if changed
    if (activeIndex !== currentLyricIndex) {
        currentLyricIndex = activeIndex;
        
        // Update all line classes
        const lyricsContainer = document.getElementById('lyrics-text');
        const lines = lyricsContainer.querySelectorAll('.lyrics-line');
        
        lines.forEach((line, index) => {
            const lineTime = parseFloat(line.dataset.time);
            if (lineTime < 0) {
                // Non-timestamped line
                line.className = 'lyrics-line future';
            } else if (index === activeIndex) {
                line.className = 'lyrics-line active';
                
                // Only scroll if the active line is near the bottom of the visible area
                const container = line.closest('.lyrics-display');
                if (container) {
                    const lineRect = line.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    const lineBottom = lineRect.bottom;
                    const containerBottom = containerRect.bottom;
                    const threshold = containerRect.height * 0.7; // Scroll when line is 70% down
                    
                    // Only scroll if line is below the threshold
                    if (lineBottom > containerRect.top + threshold) {
                        // Custom smooth and slow scroll animation
                        const targetPosition = line.offsetTop - (containerRect.height * 0.3);
                        const startPosition = container.scrollTop;
                        const distance = targetPosition - startPosition;
                        const duration = 3500; // 3500ms for ultra-smooth animation
                        let startTime = null;
                        
                        function smoothScroll(currentTime) {
                            if (!startTime) startTime = currentTime;
                            const elapsed = currentTime - startTime;
                            const progress = Math.min(elapsed / duration, 1);
                            
                            // Ease-in-out quintic function for ultra-smooth start and end
                            const easeProgress = progress < 0.5
                                ? 16 * progress * progress * progress * progress * progress
                                : 1 - Math.pow(-2 * progress + 2, 5) / 2;
                            
                            container.scrollTop = startPosition + (distance * easeProgress);
                            
                            if (progress < 1) {
                                requestAnimationFrame(smoothScroll);
                            } else {
                                // Ensure final position is set precisely for smooth end
                                container.scrollTop = targetPosition;
                            }
                        }
                        
                        requestAnimationFrame(smoothScroll);
                    }
                }
            } else if (index < activeIndex) {
                line.className = 'lyrics-line past';
            } else {
                line.className = 'lyrics-line future';
            }
        });
    }
}

async function deleteLyrics() {
    if (currentSongIndex === -1 || !filteredSongs[currentSongIndex]) {
        return;
    }
    
    if (!await showConfirm('Are you sure you want to delete these lyrics?', 'Delete Lyrics')) {
        return;
    }
    
    const song = filteredSongs[currentSongIndex];
    
    try {
        const response = await fetch('/api/lyrics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                path: song.path,
                lyrics: '' // Empty string deletes the lyrics
            })
        });
        
        if (response.ok) {
            console.log('Lyrics deleted successfully');
            await loadAndDisplayLyrics();
            updateLyricsIndicator();
        } else {
            await showAlert('Failed to delete lyrics. Please try again.', 'Error');
        }
    } catch (error) {
        console.error('Error deleting lyrics:', error);
        await showAlert('Error deleting lyrics. Please try again.', 'Error');
    }
}

// Edit lyrics for a specific song (from context menu) - Opens modal
async function editLyricsForSong(songId) {
    // Find the song by ID
    const song = filteredSongs.find(s => s.id === songId);
    if (!song) return;
    
    const modal = document.getElementById('edit-lyrics-modal');
    const modalTitle = document.getElementById('edit-lyrics-modal-title');
    const modalEditor = document.getElementById('modal-lyrics-editor');
    const deleteBtn = document.getElementById('modal-delete-lyrics-btn');
    
    // Update modal title
    modalTitle.textContent = `Edit Lyrics - ${song.title}`;
    
    // Store current song ID for saving later
    modal.dataset.songId = songId;
    
    // Load existing lyrics
    try {
        const response = await fetch(`/api/lyrics?path=${encodeURIComponent(song.path)}`);
        if (response.ok) {
            const data = await response.json();
            if (data.lyrics && data.lyrics.trim()) {
                modalEditor.value = data.lyrics;
                deleteBtn.style.display = 'block';
            } else {
                modalEditor.value = '';
                deleteBtn.style.display = 'none';
            }
        } else {
            modalEditor.value = '';
            deleteBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading lyrics:', error);
        modalEditor.value = '';
        deleteBtn.style.display = 'none';
    }
    
    // Show modal
    modal.classList.add('show');
    setTimeout(() => modalEditor.focus(), 100);
}

// Delete lyrics for a specific song (from context menu)
async function deleteLyricsForSong(songId) {
    // Find the song by ID
    const song = filteredSongs.find(s => s.id === songId);
    if (!song) return;
    
    if (!await showConfirm('Are you sure you want to delete these lyrics?', 'Delete Lyrics')) {
        return;
    }
    
    try {
        const response = await fetch('/api/lyrics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                path: song.path,
                lyrics: '' // Empty string deletes the lyrics
            })
        });
        
        if (response.ok) {
            console.log('Lyrics deleted successfully');
            
            // If this is the current song, update the display
            const songIndex = filteredSongs.findIndex(s => s.id === songId);
            if (currentSongIndex === songIndex) {
                await loadAndDisplayLyrics();
                updateLyricsIndicator();
            }
            
            // Update the song list to hide delete button
            await updateSongLyricsMenuItems();
        } else {
            await showAlert('Failed to delete lyrics. Please try again.', 'Error');
        }
    } catch (error) {
        console.error('Error deleting lyrics:', error);
        await showAlert('Error deleting lyrics. Please try again.', 'Error');
    }
}

// Close lyrics edit modal
function closeEditLyricsModal() {
    editLyricsModal.classList.remove('show');
    modalLyricsEditor.value = '';
}

// Save lyrics from modal
async function saveLyricsFromModal() {
    const songId = editLyricsModal.dataset.songId;
    const song = filteredSongs.find(s => s.id === songId);
    if (!song) return;
    
    const lyrics = modalLyricsEditor.value.trim();
    
    try {
        const response = await fetch('/api/lyrics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                path: song.path,
                lyrics: lyrics
            })
        });
        
        if (response.ok) {
            console.log('Lyrics saved successfully');
            
            // If this is the current song, update the lyrics page if open
            const songIndex = filteredSongs.findIndex(s => s.id === songId);
            if (currentSongIndex === songIndex) {
                await loadAndDisplayLyrics();
                updateLyricsIndicator();
            }
            
            // Update the song list menu items
            await updateSongLyricsMenuItems();
            
            // Close modal
            closeEditLyricsModal();
        } else {
            await showAlert('Failed to save lyrics. Please try again.', 'Error');
        }
    } catch (error) {
        console.error('Error saving lyrics:', error);
        await showAlert('Error saving lyrics. Please try again.', 'Error');
    }
}

// Delete lyrics from modal
async function deleteLyricsFromModal() {
    const songId = editLyricsModal.dataset.songId;
    const song = filteredSongs.find(s => s.id === songId);
    if (!song) return;
    
    if (!await showConfirm('Are you sure you want to delete these lyrics?', 'Delete Lyrics')) {
        return;
    }
    
    try {
        const response = await fetch('/api/lyrics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                path: song.path,
                lyrics: '' // Empty string deletes the lyrics
            })
        });
        
        if (response.ok) {
            console.log('Lyrics deleted successfully');
            
            // If this is the current song, update the display
            const songIndex = filteredSongs.findIndex(s => s.id === songId);
            if (currentSongIndex === songIndex) {
                await loadAndDisplayLyrics();
                updateLyricsIndicator();
            }
            
            // Update the song list menu items
            await updateSongLyricsMenuItems();
            
            // Close modal
            closeEditLyricsModal();
        } else {
            await showAlert('Failed to delete lyrics. Please try again.', 'Error');
        }
    } catch (error) {
        console.error('Error deleting lyrics:', error);
        await showAlert('Error deleting lyrics. Please try again.', 'Error');
    }
}

// Update song menu items to show/hide delete lyrics option
async function updateSongLyricsMenuItems() {
    for (const song of filteredSongs) {
        try {
            const response = await fetch(`/api/lyrics?path=${encodeURIComponent(song.path)}`);
            if (response.ok) {
                const data = await response.json();
                const deleteBtn = document.querySelector(`.btn-delete-lyrics[data-song-id="${song.id}"]`);
                if (deleteBtn) {
                    if (data.lyrics && data.lyrics.trim()) {
                        deleteBtn.style.display = 'flex';
                    } else {
                        deleteBtn.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            console.error('Error checking lyrics:', error);
        }
    }
}

async function updateLyricsIndicator() {
    const lyricsBtn = document.getElementById('lyrics-btn');
    if (!lyricsBtn) return;
    
    if (currentSongIndex === -1 || !filteredSongs[currentSongIndex]) {
        lyricsBtn.classList.remove('has-lyrics');
        return;
    }
    
    const song = filteredSongs[currentSongIndex];
    
    try {
        const response = await fetch(`/api/lyrics?path=${encodeURIComponent(song.path)}`);
        if (response.ok) {
            const data = await response.json();
            if (data.lyrics && data.lyrics.trim()) {
                lyricsBtn.classList.add('has-lyrics');
            } else {
                lyricsBtn.classList.remove('has-lyrics');
            }
        }
    } catch (error) {
        console.error('Error checking lyrics:', error);
        lyricsBtn.classList.remove('has-lyrics');
    }
}


function updateStudioSliders() {
    for (let i = 0; i < eqBands.length; i++) {
        const slider = document.getElementById(`eq-${i}`);
        const valueDisplay = document.getElementById(`eq-value-${i}`);
        const currentValue = eqBands[i].gain.value;
        
        slider.value = currentValue;
        valueDisplay.textContent = currentValue > 0 ? `+${currentValue}` : currentValue;
    }
}

function updateEQBand(index, value) {
    if (eqBands[index] && eqEnabled) {
        eqBands[index].gain.value = value * eqIntensity;
    }
}

function resetEQ() {
    for (let i = 0; i < 10; i++) {
        const slider = document.getElementById(`eq-${i}`);
        const valueDisplay = document.getElementById(`eq-value-${i}`);
        
        slider.value = 0;
        valueDisplay.textContent = '0';
        updateEQBand(i, 0);
    }
}


