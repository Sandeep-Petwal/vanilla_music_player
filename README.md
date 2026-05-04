# Vanilla Music Player

Vanilla Music Player is a simple web-based music player for local MP3 folders. It runs as a lightweight static app and focuses on clean playback, metadata artwork, keyboard shortcuts, and an uncluttered interface.

## Features

- Load a local music folder from the browser
- Drag and drop a folder directly into the player
- Show track artwork from MP3 metadata when available
- Search songs by title, artist, album, or path
- Minimal playlist toggle for a cleaner listening view
- Responsive layout for desktop and mobile
- Shuffle, repeat, progress seeking, and volume control
- Mouse wheel volume adjustment with small steps

## Files

- `MusicPlayer.html` - app markup and SEO metadata
- `music-player.css` - layout, theme, responsive styles
- `music-player.js` - player logic, metadata parsing, shortcuts

## How To Use

1. Open `MusicPlayer.html` in a modern browser.
2. Click `Open Music Folder` and select a folder that contains MP3 files.
3. You can also drag and drop a music folder directly onto the page.
4. Click any song to play it.

## Shortcuts

- `Space` - play or pause
- `<` - seek backward 10 seconds
- `>` - seek forward 10 seconds
- `Ctrl + <` - previous song
- `Ctrl + >` - next song
- `Arrow Left` - previous song
- `Arrow Right` - next song
- `Arrow Up` - volume up
- `Arrow Down` - volume down

## Notes

- Best experience is in a Chromium-based browser because folder access and drag-and-drop folder handling rely on browser file APIs.
- Metadata artwork depends on the MP3 file containing embedded cover art.
