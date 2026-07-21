import { apiFetch } from './client';

/** Reports whether a native OS picker backend is installed and which one. */
export interface PickerStatus {
  supported: boolean;
  /** Backend name, e.g. "powershell" | "osascript" | "zenity" | "kdialog" | "none". */
  backend: string;
}

export function pickerStatus() {
  return apiFetch<PickerStatus>('/api/picker/status');
}

/**
 * Open the native OS file dialog and return the chosen absolute path, or null
 * if the user cancelled / no backend is available. Rejects on transport errors
 * via the shared `apiFetch` mechanism.
 */
export function pickFile() {
  return apiFetch<{ path: string }>('/api/picker/file', { method: 'POST' })
    .then((r) => r.path)
    .catch(() => null);
}

/**
 * Open the native OS folder dialog and return the chosen absolute directory
 * path, or null if the user cancelled / no backend is available.
 */
export function pickDirectory() {
  return apiFetch<{ path: string }>('/api/picker/directory', { method: 'POST' })
    .then((r) => r.path)
    .catch(() => null);
}
