// client/src/utils/storage.js
const KEY_BIKES = "mp_bikes_v1";

export function loadBikes() {
  try {
    const raw = localStorage.getItem(KEY_BIKES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBikes(bikes) {
  localStorage.setItem(KEY_BIKES, JSON.stringify(bikes || []));
}

// ✅ helper: converte File -> base64 (dataURL) per salvataggio offline
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
