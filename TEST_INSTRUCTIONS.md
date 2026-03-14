# Application Lifecycle Fix - Test Instructions

## Problem Fixed
The application would continue running in the background even after closing the browser window, preventing it from reopening when launched again.

## Solution Implemented
1. **Heartbeat Monitoring**: The frontend now sends heartbeat signals to the server every 5 seconds
2. **Auto-Shutdown**: The server monitors heartbeats and automatically shuts down 15 seconds after the last heartbeat (indicating the browser was closed)
3. **Smart Restart**: When launching the app, it first checks if a server is already running:
   - If running: Opens a new browser window without starting a duplicate server
   - If not running: Starts the server and opens the browser

## How to Test

### Test 1: Normal Operation
1. Run: `./music-player -web`
2. The browser should open with the music player
3. Verify the app works normally

### Test 2: Auto-Shutdown on Browser Close
1. Run: `./music-player -web`
2. Wait for the browser to open
3. **Close the browser window** (not just the tab)
4. Wait 15-20 seconds
5. Check if process is still running: `pgrep -f music-player`
6. **Expected**: No processes found (server shut down automatically)

### Test 3: Reopen After Shutdown
1. After Test 2, run: `./music-player -web` again
2. **Expected**: Browser opens successfully with the music player

### Test 4: Multiple Launch Attempts (While Running)
1. Run: `./music-player -web`
2. Without closing the browser, run: `./music-player -web` again
3. **Expected**: A new browser window opens, no duplicate server started

## Technical Details

### Changes Made:
1. **main.go**:
   - Added `isServerRunning()` function to check if server is already active
   - Added proper signal handling and graceful shutdown
   - Server now listens to shutdown signals from heartbeat monitor

2. **server.go**:
   - Added heartbeat endpoint `/api/heartbeat`
   - Added heartbeat monitoring goroutine
   - Server tracks last heartbeat time and triggers shutdown after 15 seconds of inactivity

3. **app.js**:
   - Added `startHeartbeat()` function
   - Sends heartbeat every 5 seconds while browser is open

### Why 15 Seconds?
- Frontend sends heartbeat every 5 seconds
- Server allows 3 missed heartbeats before shutdown (5s × 3 = 15s)
- This ensures the server doesn't shut down due to temporary network issues
