let deferredPrompt = null;

export function setInstallPrompt(event) {
  deferredPrompt = event;
}

export function canInstall() {
  return !!deferredPrompt;
}

export async function triggerInstall() {
  if (!deferredPrompt) return false;

  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;

  return choice?.outcome === "accepted";
}

export function clearInstallPrompt() {
  deferredPrompt = null;
}