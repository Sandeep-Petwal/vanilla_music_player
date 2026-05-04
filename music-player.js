const audio = document.getElementById("audioPlayer");
const app = document.getElementById("app");
const loadBtn = document.getElementById("loadBtn");
const folderInput = document.getElementById("folderInput");
const searchInput = document.getElementById("searchInput");
const songList = document.getElementById("songList");
const noResults = document.getElementById("noResults");
const listHeader = document.getElementById("listHeader");
const emptyState = document.getElementById("emptyState");
const player = document.getElementById("player");
const disc = document.getElementById("disc");
const discCover = document.getElementById("discCover");
const artworkImage = document.getElementById("artworkImage");
const artworkFallback = document.getElementById("artworkFallback");
const trackTitle = document.getElementById("trackTitle");
const trackSub = document.getElementById("trackSub");
const progressBar = document.getElementById("progressBar");
const progressFill = document.getElementById("progressFill");
const timeElapsed = document.getElementById("timeElapsed");
const timeDuration = document.getElementById("timeDuration");
const playBtn = document.getElementById("playBtn");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const repeatBtn = document.getElementById("repeatBtn");
const volumeSlider = document.getElementById("volumeSlider");
const volumeValue = document.getElementById("volumeValue");
const bgGlow = document.getElementById("bgGlow");
const statsBar = document.getElementById("statsBar");
const minimalToggle = document.getElementById("minimalToggle");
const mobileViewToggle = document.getElementById("mobileViewToggle");
const dropOverlay = document.getElementById("dropOverlay");

const SEEK_STEP = 10;
const VOLUME_WHEEL_STEP = 2;
const RESTART_THRESHOLD = 3;
const STORAGE_KEYS = {
  volume: "vanilla-player-volume",
  minimal: "vanilla-player-minimal"
};

const state = {
  allSongs: [],
  filteredSongs: [],
  currentIndex: -1,
  isPlaying: false,
  isShuffle: false,
  isRepeat: false,
  isMinimal: false,
  dragDepth: 0,
  metadataBatch: 0,
  currentAudioUrl: "",
  songId: 0
};

const FALLBACK_THUMBNAIL = `
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8"></circle>
    <path d="M10 15V8l6-1v7"></path>
  </svg>
`;

audio.volume = getStoredVolume();
volumeSlider.value = String(Math.round(audio.volume * 100));
updateVolumeLabel();

state.isMinimal = localStorage.getItem(STORAGE_KEYS.minimal) === "true";
applyMinimalMode();
updateLibraryText();

loadBtn.addEventListener("click", () => folderInput.click());

folderInput.addEventListener("change", (event) => {
  const files = Array.from(event.target.files || []);
  loadSongsFromFiles(files);
  folderInput.value = "";
});

playBtn.addEventListener("click", togglePlay);
nextBtn.addEventListener("click", () => changeSong(1));
prevBtn.addEventListener("click", () => previousSong());

shuffleBtn.addEventListener("click", () => {
  state.isShuffle = !state.isShuffle;
  shuffleBtn.classList.toggle("active", state.isShuffle);
});

repeatBtn.addEventListener("click", () => {
  state.isRepeat = !state.isRepeat;
  repeatBtn.classList.toggle("active", state.isRepeat);
});

minimalToggle.addEventListener("click", () => {
  toggleMinimalMode();
});

mobileViewToggle.addEventListener("click", () => {
  toggleMinimalMode();
});

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  state.filteredSongs = query
    ? state.allSongs.filter((song) => matchesSearch(song, query))
    : [...state.allSongs];
  renderList();
  updateLibraryText();
});

volumeSlider.addEventListener("input", () => {
  setVolume(Number(volumeSlider.value));
});

volumeSlider.addEventListener("wheel", (event) => {
  event.preventDefault();
  const direction = Math.sign(event.deltaY);
  setVolume(Number(volumeSlider.value) - direction * VOLUME_WHEEL_STEP);
}, { passive: false });

progressBar.addEventListener("click", (event) => {
  updateProgressFromPointer(event.clientX);
});

progressBar.addEventListener("pointerdown", (event) => {
  if (!audio.duration) {
    return;
  }

  event.preventDefault();
  updateProgressFromPointer(event.clientX);

  const move = (moveEvent) => updateProgressFromPointer(moveEvent.clientX);
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
});

audio.addEventListener("loadedmetadata", () => {
  timeDuration.textContent = formatTime(audio.duration);
});

audio.addEventListener("timeupdate", () => {
  if (!audio.duration) {
    return;
  }

  const progress = (audio.currentTime / audio.duration) * 100;
  progressFill.style.width = `${progress}%`;
  progressBar.setAttribute("aria-valuenow", String(Math.round(progress)));
  timeElapsed.textContent = formatTime(audio.currentTime);
  timeDuration.textContent = formatTime(audio.duration);
});

audio.addEventListener("play", () => setPlaying(true));
audio.addEventListener("pause", () => setPlaying(false));

audio.addEventListener("ended", () => {
  if (state.isRepeat) {
    audio.currentTime = 0;
    audio.play().catch(() => setPlaying(false));
    return;
  }

  changeSong(1);
});

document.addEventListener("keydown", (event) => {
  if (shouldIgnoreShortcut(event)) {
    return;
  }

  const isGreaterKey = event.key === ">" || (event.code === "Period" && event.shiftKey);
  const isLessKey = event.key === "<" || (event.code === "Comma" && event.shiftKey);

  if (event.code === "Space") {
    event.preventDefault();
    togglePlay();
    return;
  }

  if (isGreaterKey) {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      changeSong(1, { forceAdjacent: true });
    } else {
      seekBy(SEEK_STEP);
    }
    return;
  }

  if (isLessKey) {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      changeSong(-1, { forceAdjacent: true });
    } else {
      seekBy(-SEEK_STEP);
    }
    return;
  }

  if (event.code === "ArrowRight") {
    event.preventDefault();
    changeSong(1);
    return;
  }

  if (event.code === "ArrowLeft") {
    event.preventDefault();
    previousSong();
    return;
  }

  if (event.code === "ArrowUp") {
    event.preventDefault();
    setVolume(Number(volumeSlider.value) + VOLUME_WHEEL_STEP);
    return;
  }

  if (event.code === "ArrowDown") {
    event.preventDefault();
    setVolume(Number(volumeSlider.value) - VOLUME_WHEEL_STEP);
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  document.addEventListener(eventName, (event) => {
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    state.dragDepth += eventName === "dragenter" ? 1 : 0;
    showDropOverlay(true);
  });
});

document.addEventListener("dragleave", (event) => {
  if (!hasDraggedFiles(event)) {
    return;
  }

  state.dragDepth = Math.max(0, state.dragDepth - 1);
  if (state.dragDepth === 0) {
    showDropOverlay(false);
  }
});

document.addEventListener("drop", async (event) => {
  if (!hasDraggedFiles(event)) {
    return;
  }

  event.preventDefault();
  state.dragDepth = 0;
  showDropOverlay(false);

  const songs = await extractSongsFromDrop(event.dataTransfer);
  if (!songs.length) {
    alert("No MP3 files were found in that drop.");
    return;
  }

  initializeSongs(songs);
});

function loadSongsFromFiles(files) {
  const songs = files
    .filter((file) => isMp3File(file.name))
    .map((file) => createSong(file, file.webkitRelativePath || file.name));

  if (!songs.length) {
    alert("No MP3 files were found in that folder.");
    return;
  }

  initializeSongs(songs);
}

function initializeSongs(songs) {
  cleanupSongResources(state.allSongs);
  revokeCurrentAudioUrl();

  state.allSongs = sortSongs(songs);
  state.filteredSongs = [...state.allSongs];
  state.currentIndex = -1;
  state.metadataBatch += 1;

  searchInput.value = "";
  emptyState.style.display = "none";
  player.style.display = "flex";
  bgGlow.classList.add("active");

  renderList();
  updateLibraryText();
  updateStatsBar();
  loadSong(0);
  hydrateMetadataQueue(state.allSongs, state.metadataBatch);
}

function renderList() {
  songList.innerHTML = "";
  noResults.style.display = state.filteredSongs.length === 0 && state.allSongs.length > 0 ? "block" : "none";
  songList.appendChild(noResults);

  state.filteredSongs.forEach((song, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "song-item";
    item.dataset.songId = String(song.id);

    if (state.allSongs[state.currentIndex]?.id === song.id) {
      item.classList.add("active");
      if (!state.isPlaying) {
        item.classList.add("paused");
      }
    }

    item.innerHTML = getSongItemMarkup(song, index);
    item.addEventListener("click", () => {
      const realIndex = state.allSongs.findIndex((candidate) => candidate.id === song.id);
      if (realIndex === state.currentIndex) {
        togglePlay();
        return;
      }

      loadSong(realIndex, true);
    });

    songList.appendChild(item);
  });
}

function getSongItemMarkup(song, index) {
  const meta = getSongMeta(song);
  const artwork = song.artworkUrl
    ? `<img src="${song.artworkUrl}" alt="${escapeHtml(song.title)} artwork">`
    : FALLBACK_THUMBNAIL;

  return `
    <span class="song-num">${String(index + 1).padStart(2, "0")}</span>
    <span class="playing-anim" aria-hidden="true"><span></span><span></span><span></span></span>
    <span class="song-thumb">${artwork}</span>
    <span class="song-info">
      <span class="song-title">${escapeHtml(song.title)}</span>
      <span class="song-meta">${escapeHtml(meta)}</span>
    </span>
  `;
}

function updateRenderedSong(song) {
  const item = songList.querySelector(`[data-song-id="${song.id}"]`);
  if (item) {
    const index = state.filteredSongs.findIndex((candidate) => candidate.id === song.id);
    if (index !== -1) {
      item.innerHTML = getSongItemMarkup(song, index);
    }
  }

  if (state.allSongs[state.currentIndex]?.id === song.id) {
    updateTrackDisplay(song);
  }

  updateLibraryText();
}

async function loadSong(index, autoplay = false) {
  if (index < 0 || index >= state.allSongs.length) {
    return;
  }

  state.currentIndex = index;
  const song = state.allSongs[index];
  revokeCurrentAudioUrl();
  state.currentAudioUrl = URL.createObjectURL(song.file);
  audio.src = state.currentAudioUrl;
  audio.currentTime = 0;
  progressFill.style.width = "0%";
  progressBar.setAttribute("aria-valuenow", "0");
  timeElapsed.textContent = "0:00";
  timeDuration.textContent = "0:00";

  updateTrackDisplay(song);
  updateActiveItem();
  ensureMetadata(song);

  if (autoplay) {
    try {
      await audio.play();
    } catch (error) {
      console.warn("Playback could not start automatically.", error);
      setPlaying(false);
    }
  } else {
    audio.load();
    setPlaying(false);
  }
}

function updateTrackDisplay(song) {
  trackTitle.textContent = song.title;
  trackSub.textContent = getSongMeta(song).toUpperCase();

  if (song.artworkUrl) {
    artworkImage.src = song.artworkUrl;
    artworkImage.alt = `${song.title} artwork`;
    discCover.classList.add("has-artwork");
    artworkFallback.hidden = true;
  } else {
    artworkImage.removeAttribute("src");
    discCover.classList.remove("has-artwork");
    artworkFallback.hidden = false;
  }
}

function updateActiveItem() {
  songList.querySelectorAll(".song-item").forEach((item) => {
    item.classList.remove("active", "paused");
  });

  const activeSong = state.allSongs[state.currentIndex];
  if (!activeSong) {
    return;
  }

  const activeItem = songList.querySelector(`[data-song-id="${activeSong.id}"]`);
  if (activeItem) {
    activeItem.classList.add("active");
    if (!state.isPlaying) {
      activeItem.classList.add("paused");
    }
    activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function setPlaying(nextState) {
  state.isPlaying = nextState;
  disc.classList.toggle("playing", nextState);
  playIcon.style.display = nextState ? "none" : "block";
  pauseIcon.style.display = nextState ? "block" : "none";
  updateActiveItem();
}

function togglePlay() {
  if (state.currentIndex === -1) {
    return;
  }

  if (audio.paused) {
    audio.play().catch((error) => {
      console.warn("Playback could not start.", error);
      setPlaying(false);
    });
  } else {
    audio.pause();
  }
}

function previousSong() {
  if (!state.allSongs.length) {
    return;
  }

  if (audio.currentTime > RESTART_THRESHOLD) {
    audio.currentTime = 0;
    return;
  }

  changeSong(-1);
}

function changeSong(direction, options = {}) {
  if (!state.allSongs.length) {
    return;
  }

  const { forceAdjacent = false } = options;
  let nextIndex;

  if (state.isShuffle && !forceAdjacent) {
    do {
      nextIndex = Math.floor(Math.random() * state.allSongs.length);
    } while (state.allSongs.length > 1 && nextIndex === state.currentIndex);
  } else {
    nextIndex = (state.currentIndex + direction + state.allSongs.length) % state.allSongs.length;
  }

  loadSong(nextIndex, true);
}

function seekBy(seconds) {
  if (!audio.duration) {
    return;
  }

  const nextTime = Math.min(audio.duration, Math.max(0, audio.currentTime + seconds));
  audio.currentTime = nextTime;
}

function updateProgressFromPointer(clientX) {
  if (!audio.duration) {
    return;
  }

  const rect = progressBar.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  audio.currentTime = ratio * audio.duration;
}

function setVolume(volume) {
  const normalized = Math.max(0, Math.min(100, Math.round(volume)));
  volumeSlider.value = String(normalized);
  audio.volume = normalized / 100;
  localStorage.setItem(STORAGE_KEYS.volume, String(normalized));
  updateVolumeLabel();
}

function updateVolumeLabel() {
  volumeValue.textContent = `${Math.round(audio.volume * 100)}%`;
}

function toggleMinimalMode() {
  state.isMinimal = !state.isMinimal;
  localStorage.setItem(STORAGE_KEYS.minimal, String(state.isMinimal));
  applyMinimalMode();
}

function applyMinimalMode() {
  app.classList.toggle("list-collapsed", state.isMinimal);
  minimalToggle.setAttribute("aria-pressed", String(state.isMinimal));
  minimalToggle.setAttribute("aria-label", state.isMinimal ? "Expand playlist" : "Collapse playlist");
  mobileViewToggle.textContent = state.isMinimal ? "Playlist" : "Now Playing";
  mobileViewToggle.setAttribute("aria-label", state.isMinimal ? "Open playlist" : "Open player");
}

function updateLibraryText() {
  if (!state.allSongs.length) {
    listHeader.textContent = "READY FOR YOUR MUSIC FOLDER";
    return;
  }

  const query = searchInput.value.trim();
  listHeader.textContent = query
    ? `${state.filteredSongs.length} RESULTS`
    : `${state.allSongs.length} SONGS`;
}

function updateStatsBar() {
  if (!state.allSongs.length) {
    statsBar.textContent = "Drop a folder anywhere to load your music.";
    return;
  }

  statsBar.textContent = `${state.allSongs.length} tracks loaded | < and > seek 10s | Ctrl + < or Ctrl + > changes songs`;
}

function createSong(file, relativePath) {
  const parsed = parseNameParts(file.name.replace(/\.mp3$/i, ""));
  return {
    id: ++state.songId,
    file,
    relativePath,
    title: parsed.title,
    artist: parsed.artist || "Local Track",
    album: "",
    artworkUrl: "",
    metadataLoaded: false,
    metadataPromise: null
  };
}

function parseNameParts(name) {
  const parts = name.split(/\s*[-_]\s*/);
  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(" - ").trim()
    };
  }

  return {
    artist: "",
    title: name.trim()
  };
}

function getSongMeta(song) {
  const pieces = [];
  if (song.artist) {
    pieces.push(song.artist);
  }
  if (song.album) {
    pieces.push(song.album);
  }
  return pieces.join(" / ") || "Local Track";
}

function matchesSearch(song, query) {
  return [
    song.title,
    song.artist,
    song.album,
    song.relativePath
  ].join(" ").toLowerCase().includes(query);
}

function sortSongs(songs) {
  return [...songs].sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { sensitivity: "base" }));
}

async function hydrateMetadataQueue(songs, batchId) {
  for (const song of songs) {
    if (state.metadataBatch !== batchId) {
      return;
    }
    await ensureMetadata(song);
  }
}

async function ensureMetadata(song) {
  if (song.metadataLoaded) {
    return song;
  }

  if (song.metadataPromise) {
    return song.metadataPromise;
  }

  song.metadataPromise = (async () => {
    try {
      const metadata = await parseMp3Metadata(song.file);
      if (metadata.title) {
        song.title = metadata.title;
      }
      if (metadata.artist) {
        song.artist = metadata.artist;
      }
      if (metadata.album) {
        song.album = metadata.album;
      }
      if (metadata.artwork && !song.artworkUrl) {
        song.artworkUrl = URL.createObjectURL(new Blob([metadata.artwork.bytes], { type: metadata.artwork.mime }));
      }
    } catch (error) {
      console.warn(`Metadata parsing failed for ${song.file.name}.`, error);
    } finally {
      song.metadataLoaded = true;
      song.metadataPromise = null;
      updateRenderedSong(song);
    }
    return song;
  })();

  return song.metadataPromise;
}

async function parseMp3Metadata(file) {
  const header = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (header.length < 10 || decodeAscii(header.slice(0, 3)) !== "ID3") {
    return {};
  }

  const version = header[3];
  if (version < 3 || version > 4) {
    return {};
  }

  const flags = header[5];
  const tagSize = readSyncSafeInt(header, 6);
  const tagBuffer = new Uint8Array(await file.slice(0, 10 + tagSize).arrayBuffer());
  let tagBytes = tagBuffer.slice(10, 10 + tagSize);

  if (flags & 0x80) {
    tagBytes = removeUnsynchronisation(tagBytes);
  }

  let offset = 0;
  if (flags & 0x40) {
    if (version === 4) {
      offset += readSyncSafeInt(tagBytes, 0);
    } else {
      offset += 4 + readUInt32(tagBytes, 0);
    }
  }

  const metadata = {};
  while (offset + 10 <= tagBytes.length) {
    const frameId = decodeAscii(tagBytes.slice(offset, offset + 4));
    if (!frameId.trim() || /^(\u0000)+$/.test(frameId)) {
      break;
    }

    const frameSize = version === 4
      ? readSyncSafeInt(tagBytes, offset + 4)
      : readUInt32(tagBytes, offset + 4);

    if (!frameSize || offset + 10 + frameSize > tagBytes.length) {
      break;
    }

    const frameData = tagBytes.slice(offset + 10, offset + 10 + frameSize);
    if (frameId === "TIT2") {
      metadata.title = decodeTextFrame(frameData);
    } else if (frameId === "TPE1") {
      metadata.artist = decodeTextFrame(frameData);
    } else if (frameId === "TALB") {
      metadata.album = decodeTextFrame(frameData);
    } else if (frameId === "APIC" && !metadata.artwork) {
      metadata.artwork = decodeApicFrame(frameData);
    }

    offset += 10 + frameSize;
  }

  return metadata;
}

function decodeTextFrame(frameData) {
  if (!frameData.length) {
    return "";
  }

  const encoding = frameData[0];
  const body = frameData.slice(1);
  return decodeText(body, encoding).replace(/\u0000/g, "").trim();
}

function decodeApicFrame(frameData) {
  if (!frameData.length) {
    return null;
  }

  const encoding = frameData[0];
  let offset = 1;
  const mimeEnd = frameData.indexOf(0, offset);
  if (mimeEnd === -1) {
    return null;
  }

  const mime = decodeAscii(frameData.slice(offset, mimeEnd)) || "image/jpeg";
  offset = mimeEnd + 1;
  offset += 1;

  const terminatorLength = encoding === 1 || encoding === 2 ? 2 : 1;
  const descriptionEnd = findTerminator(frameData, offset, encoding);
  offset = descriptionEnd + terminatorLength;

  const bytes = frameData.slice(offset);
  if (!bytes.length) {
    return null;
  }

  return { mime, bytes };
}

function decodeText(bytes, encoding) {
  try {
    if (encoding === 0) {
      return new TextDecoder("latin1").decode(bytes);
    }

    if (encoding === 3) {
      return new TextDecoder("utf-8").decode(bytes);
    }

    if (encoding === 2) {
      return new TextDecoder("utf-16be").decode(bytes);
    }

    if (encoding === 1) {
      if (bytes.length >= 2) {
        if (bytes[0] === 0xff && bytes[1] === 0xfe) {
          return new TextDecoder("utf-16le").decode(bytes.slice(2));
        }
        if (bytes[0] === 0xfe && bytes[1] === 0xff) {
          return new TextDecoder("utf-16be").decode(bytes.slice(2));
        }
      }
      return new TextDecoder("utf-16le").decode(bytes);
    }
  } catch (error) {
    console.warn("Text decoding failed.", error);
  }

  return "";
}

function removeUnsynchronisation(bytes) {
  const output = [];
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 0xff && bytes[index + 1] === 0x00) {
      output.push(0xff);
      index += 1;
      continue;
    }
    output.push(bytes[index]);
  }
  return new Uint8Array(output);
}

function findTerminator(bytes, start, encoding) {
  if (encoding === 1 || encoding === 2) {
    for (let index = start; index < bytes.length - 1; index += 2) {
      if (bytes[index] === 0x00 && bytes[index + 1] === 0x00) {
        return index;
      }
    }
    return bytes.length;
  }

  const index = bytes.indexOf(0x00, start);
  return index === -1 ? bytes.length : index;
}

function readSyncSafeInt(bytes, offset) {
  return ((bytes[offset] & 0x7f) << 21)
    | ((bytes[offset + 1] & 0x7f) << 14)
    | ((bytes[offset + 2] & 0x7f) << 7)
    | (bytes[offset + 3] & 0x7f);
}

function readUInt32(bytes, offset) {
  return ((bytes[offset] << 24) >>> 0)
    + (bytes[offset + 1] << 16)
    + (bytes[offset + 2] << 8)
    + bytes[offset + 3];
}

function decodeAscii(bytes) {
  return String.fromCharCode(...bytes);
}

function cleanupSongResources(songs) {
  songs.forEach((song) => {
    if (song.artworkUrl) {
      URL.revokeObjectURL(song.artworkUrl);
    }
  });
}

function revokeCurrentAudioUrl() {
  if (!state.currentAudioUrl) {
    return;
  }

  URL.revokeObjectURL(state.currentAudioUrl);
  state.currentAudioUrl = "";
}

function getStoredVolume() {
  const stored = Number(localStorage.getItem(STORAGE_KEYS.volume));
  if (Number.isFinite(stored)) {
    return Math.max(0, Math.min(100, stored)) / 100;
  }
  return 0.8;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function shouldIgnoreShortcut(event) {
  const target = event.target;
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target?.isContentEditable;
}

function hasDraggedFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}

function showDropOverlay(isVisible) {
  dropOverlay.classList.toggle("active", isVisible);
}

async function extractSongsFromDrop(dataTransfer) {
  const items = Array.from(dataTransfer?.items || []);
  const entries = items
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean);

  if (entries.length) {
    const songs = [];
    for (const entry of entries) {
      const nestedSongs = await walkEntry(entry);
      songs.push(...nestedSongs);
    }
    return sortSongs(songs);
  }

  return sortSongs(
    Array.from(dataTransfer?.files || [])
      .filter((file) => isMp3File(file.name))
      .map((file) => createSong(file, file.webkitRelativePath || file.name))
  );
}

async function walkEntry(entry, prefix = "") {
  if (entry.isFile) {
    const file = await getFileFromEntry(entry);
    return isMp3File(file.name) ? [createSong(file, `${prefix}${file.name}`)] : [];
  }

  if (!entry.isDirectory) {
    return [];
  }

  const reader = entry.createReader();
  const children = [];
  while (true) {
    const batch = await readDirectoryEntries(reader);
    if (!batch.length) {
      break;
    }
    children.push(...batch);
  }

  const songs = [];
  for (const child of children) {
    const nestedSongs = await walkEntry(child, `${prefix}${entry.name}/`);
    songs.push(...nestedSongs);
  }
  return songs;
}

function getFileFromEntry(entry) {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readDirectoryEntries(reader) {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
}

function isMp3File(name) {
  return /\.mp3$/i.test(name);
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => (
    {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[character]
  ));
}
