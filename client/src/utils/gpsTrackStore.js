const KEY = "mp_tracks_v1";

export function getTracks() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function getTrack(id) {
  return getTracks().find((t) => t.id === id) || null;
}

export function saveTrack(track) {
  const tracks = getTracks();
  tracks.unshift(track); // newest first
  localStorage.setItem(KEY, JSON.stringify(tracks));
  return track;
}

export function deleteTrack(id) {
  const tracks = getTracks().filter((t) => t.id !== id);
  localStorage.setItem(KEY, JSON.stringify(tracks));
}

export function clearTracks() {
  localStorage.removeItem(KEY);
}