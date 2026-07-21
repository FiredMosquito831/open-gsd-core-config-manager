/**
 * Native OS file/folder picker (Symptom D — "anything leveraging a path
 * should have a path picker with file explorer window opening").
 *
 * Browsers cannot leak absolute file-system paths to HTTP-served pages
 * (security rule, true even for `<input type=file>` and the File System
 * Access API), so the standard `npx`-launched-tool pattern is to surface the
 * picker SERVER-SIDE: spawn a real OS dialog process, wait for the chosen
 * absolute path, and return it to the SPA so the existing path inputs can be
 * pre-filled. This is the same approach MCP Inspector / Prisma Studio use.
 *
 * Backend selection uses ONLY available-tool probing, not `process.platform`
 * — keeps the code robust when the CLI is launched from WSL Linux but the
 * user wants the native *Windows* file explorer (because their project tree
 * is mounted under `/mnt/c/...`). In that environment `powershell.exe` is on
 * PATH via WSL interop and `System.Windows.Forms.OpenFileDialog` /
 * `FolderBrowserDialog` are the genuine Windows pickers the user expected in
 * the symptom report ("file explorer window opening").
 *
 * Every spawned picker runs OUT-OF-BAND via `child_process` — the Fastify
 * event loop is yielded while the modal is open, so concurrent `/api`
 * requests keep being served. (Unlike the previous `scan()` brick, the work
 * here is a single subprocess, not tens of thousands of sync fs ops).
 */
import { spawn } from 'node:child_process';
import { release } from 'node:os';

const WSL_RE = /microsoft/i;

function isWSL(): boolean {
  // WSL2 kernel release includes 'microsoft' in the version string.
  return WSL_RE.test(release());
}

/** Resolves to the trimmed standard output or `null` if the process exited non-zero or with no output. */
function runCommand(exe: string, args: readonly string[], opts: { cwd?: string } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    let out = '';
    let err = '';
    let child;
    try {
      child = spawn(exe, [...args], { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    } catch {
      resolve(null);
      return;
    }
    child.stdout?.on('data', (b: Buffer) => { out += b.toString('utf8'); });
    child.stderr?.on('data', (b: Buffer) => { err += b.toString('utf8'); });
    child.on('error', () => resolve(null));
    child.on('close', (code) => {
      if (code !== 0 || !out.trim()) resolve(null);
      else resolve(out.trim());
    });
  });
}

/**
 * Probe PATH for an executable by running a known 0-exit command.
 *
 * `--version` is intentionally the probe: every backend here (`powershell.exe`,
 * `osascript`, `zenity`, `kdialog`) exits 0 with `--version` (or at worst prints
 * a banner and exits non-zero, which correctly rules it out). It never blocks —
 * unlike `--help` on a GUI tool, which in some environments can pop a window.
 * The child inherits a closed stdin and piped stdio so a misbehaving backend
 * can't hang the helper.
 */
function probeCommand(exe: string, args: readonly string[]): Promise<boolean> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(exe, [...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      resolve(false);
      return;
    }
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

/** Best-effort "is this picker backend installed?" check, cached per backend name. */
const hasCommandCache = new Map<string, Promise<boolean>>();

/**
 * Per-executable probe arguments known to exit 0 when the tool is installed.
 *
 * Why this table instead of a generic `--version` probe: Windows PowerShell 5.1
 * (`powershell.exe`) does NOT accept `--version` (it exits non-zero), so a naive
 * probe would silently disable the picker on the one environment the user
 * actually needs it — WSL2 with the Windows file explorer reachable via
 * `powershell.exe` interop. Each probe here is a no-op that exits 0 if the
 * binary exists and can run: `-NonInteractive` keeps PowerShell from hanging
 * on a profile/prompt, `-NoProfile` skips slow profile load, `exit 0` is the
 * no-op. The GUI tools (`zenity`/`kdialog`) both support `--version`.
 */
const PROBE_ARGS: Record<string, readonly string[]> = {
  'powershell.exe': ['-NoProfile', '-NonInteractive', '-Command', 'exit 0'],
  osascript: ['-e', 'return'],
  zenity: ['--version'],
  kdialog: ['--version'],
};

function hasCommand(exe: string): Promise<boolean> {
  if (!hasCommandCache.has(exe)) {
    hasCommandCache.set(exe, probeCommand(exe, PROBE_ARGS[exe] ?? ['--version']));
  }
  return hasCommandCache.get(exe)!;
}

/**
 * Convert a returned path to the form the running Node process uses.
 *
 * - Windows path returned from a WSL-spawned `powershell.exe` (e.g. `C:\Users\…`)
 *   is translated to the POSIX form (`/mnt/c/Users/…`) using `wslpath`, so the
 *   Node CLI's `fs` and `path` APIs use the same absolute path the user picked.
 * - On Windows-native Node there is no translation needed.
 * - macOS / Linux dialogs already return POSIX paths.
 */
async function toServerPath(raw: string): Promise<string> {
  if (!raw) return raw;
  if (isWSL() && /^[A-Za-z]:[\\/]/.test(raw)) {
    const posix = await runCommand('wslpath', ['-u', raw]);
    if (posix) return posix;
  }
  return raw;
}

const FILE_DIALOG_PS = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = 'Select a GSD config file'
$dialog.Filter = 'JSON files (*.json)|*.json|All files (*.*)|*.*'
$dialog.Multiselect = $false
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.FileName
}`.trim();

const FOLDER_DIALOG_PS = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Select a folder to scan'
$dialog.ShowNewFolderButton = $false
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.SelectedPath
}`.trim();

async function pickWithPowerShell(kind: 'file' | 'directory'): Promise<string | null> {
  // The same `System.Windows.Forms` dialog is reachable whether PowerShell is
  // the native Windows binary (`platform() === 'win32'`) OR the WSL interop
  // shim (`powershell.exe` on PATH inside WSL Linux). `wslpath` translation is
  // applied afterwards only on WSL.
  const script = kind === 'file' ? FILE_DIALOG_PS : FOLDER_DIALOG_PS;
  const raw = await runCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  if (!raw) return null;
  return toServerPath(raw);
}

async function pickOnMacOS(kind: 'file' | 'directory'): Promise<string | null> {
  const verb = kind === 'file' ? 'choose file' : 'choose folder';
  // osascript returns a POSIX path for files; for folders it returns an alias
  // like "Macintosh HD:Users:..." which `POSIX path of` converts to /Users/... .
  const script = `POSIX path of (${verb})`;
  return runCommand('osascript', ['-e', script]);
}

async function pickWithZenity(kind: 'file' | 'directory'): Promise<string | null> {
  const args = kind === 'directory' ? ['--file-selection', '--directory'] : ['--file-selection', '--file-filter=*.json'];
  return runCommand('zenity', args);
}

async function pickWithKDialog(kind: 'file' | 'directory'): Promise<string | null> {
  const args = kind === 'directory' ? ['--getexistingdirectory', '.'] : ['--getopenfilename', '.', '*.json'];
  return runCommand('kdialog', args);
}

let cachedBackend: 'powershell' | 'osascript' | 'zenity' | 'kdialog' | null | undefined;
async function chooseBackend(): Promise<'powershell' | 'osascript' | 'zenity' | 'kdialog' | null> {
  if (cachedBackend !== undefined) return cachedBackend;
  if (await hasCommand('powershell.exe')) cachedBackend = 'powershell';
  else if (await hasCommand('osascript')) cachedBackend = 'osascript';
  else if (await hasCommand('zenity')) cachedBackend = 'zenity';
  else if (await hasCommand('kdialog')) cachedBackend = 'kdialog';
  else cachedBackend = null;
  return cachedBackend;
}

/** Opens the OS file picker; resolves to a single absolute path on the running server's filesystem, or null when cancelled/none available. */
export async function pickFile(): Promise<string | null> {
  const backend = await chooseBackend();
  switch (backend) {
    case 'powershell': return pickWithPowerShell('file');
    case 'osascript': return pickOnMacOS('file');
    case 'zenity': return pickWithZenity('file');
    case 'kdialog': return pickWithKDialog('file');
    default: return null;
  }
}

/** Opens the OS folder picker; resolves to a single absolute directory path or null when cancelled/none available. */
export async function pickDirectory(): Promise<string | null> {
  const backend = await chooseBackend();
  switch (backend) {
    case 'powershell': return pickWithPowerShell('directory');
    case 'osascript': return pickOnMacOS('directory');
    case 'zenity': return pickWithZenity('directory');
    case 'kdialog': return pickWithKDialog('directory');
    default: return null;
  }
}

/** Returns the resolved backend name (for diagnostics on the GET /api/picker/status endpoint). */
export async function pickerBackendName(): Promise<string> {
  const backend = await chooseBackend();
  return backend ?? 'none';
}
