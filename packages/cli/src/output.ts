/**
 * Terminal output module — the 02-UI-SPEC.md CLI copywriting contract
 * (Output Structure, Text Styling, Color, Copywriting Contract sections).
 *
 * No dependency is added here: 02-UI-SPEC.md mandates hand-written ANSI
 * codes and hand-written Unicode symbols with an ASCII fallback — explicitly
 * no icon package (`chalk`, etc.) and no color library.
 *
 * `createOutput(stream, env)` takes its stream/env as injected parameters
 * (rather than reading `process.stdout`/`process.env` at module scope) so
 * the copy is unit-testable — mirrors `resolveGlobalDefaultsPath(env)` in
 * `packages/config-io/src/discovery.ts`.
 *
 * Plain mode (no ANSI escapes, ASCII symbol fallbacks) is on whenever
 * `stream.isTTY` is falsy OR `env.NO_COLOR` is set (the no-color.org
 * convention) — this is also what makes `test/server/helpers/spawn-cli.ts`
 * deterministic, since it always sets `NO_COLOR=1` on the spawned child.
 *
 * Accent color (bold+cyan) is reserved EXCLUSIVELY for the printed,
 * copyable/clickable URL string — never any other line, word, or symbol.
 *
 * This module never prints the launch token on its own — the token only
 * ever appears embedded inside the URL string it is handed.
 */

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
} as const;

/** Hand-written Unicode symbols (02-UI-SPEC.md's terminal "icon library") with their ASCII fallbacks. */
const SYMBOLS = {
  success: { unicode: '✓', ascii: '[OK]' }, // ✓
  error: { unicode: '✗', ascii: '[FAIL]' }, // ✗
  warning: { unicode: '⚠', ascii: '[WARN]' }, // ⚠
  pointer: { unicode: '➜', ascii: '->' },
} as const;

export interface OutputPort {
  /** Printed once, after a successful bind: bold title, blank line, the accent-colored Local URL, and the dim "Press Ctrl+C to stop" hint. */
  banner(url: string): void;
  /** `--no-open` was passed: dim hint pointing at the Local URL already printed by `banner`. */
  noOpenHint(): void;
  /** `open()` threw (headless/WSL/no default browser): warning line plus the manual-open instruction, URL accented. */
  openFailed(url: string): void;
  /** `EADDRINUSE` on an explicitly-passed `--port`: error line naming the port, plus the next-step line. */
  portInUse(port: number): void;
  /** Any other unexpected startup failure: generic error-symbol failure line. */
  startupError(message: string): void;
  /** SIGINT/SIGTERM received: leading blank line, then the warning-symbol "Shutting down…" line. Printed BEFORE `app.close()` resolves. */
  shuttingDown(): void;
  /** Printed only AFTER `app.close()` resolves: the success-symbol confirmation line. */
  stopped(): void;
  /** Generic warning-symbol sink line — used for the D-12 non-fatal snapshot-recording-failure warning. */
  warnLine(message: string): void;
}

export function createOutput(
  stream: NodeJS.WritableStream & { isTTY?: boolean } = process.stdout,
  env: NodeJS.ProcessEnv = process.env,
): OutputPort {
  const plain = !stream.isTTY || Boolean(env.NO_COLOR);

  function sym(key: keyof typeof SYMBOLS): string {
    return plain ? SYMBOLS[key].ascii : SYMBOLS[key].unicode;
  }

  function style(code: string, text: string): string {
    return plain ? text : `${code}${text}${ANSI.reset}`;
  }

  function bold(text: string): string {
    return style(ANSI.bold, text);
  }

  function dim(text: string): string {
    return style(ANSI.dim, text);
  }

  /** The one reserved accent treatment (bold+cyan) — the printed URL only. */
  function accent(text: string): string {
    return plain ? text : `${ANSI.bold}${ANSI.cyan}${text}${ANSI.reset}`;
  }

  function success(text: string): string {
    return style(ANSI.green, text);
  }

  function error(text: string): string {
    return style(ANSI.red, text);
  }

  function warning(text: string): string {
    return style(ANSI.yellow, text);
  }

  function write(line: string): void {
    stream.write(`${line}\n`);
  }

  return {
    banner(url) {
      write(bold('GSD Config Manager'));
      write('');
      write(`  ${sym('pointer')}  Local:   ${accent(url)}`);
      write(dim(`  ${sym('pointer')}  Press Ctrl+C to stop`));
    },

    noOpenHint() {
      write(dim(`  ${sym('pointer')}  Browser auto-open disabled (--no-open) — open the Local URL above to continue`));
    },

    openFailed(url) {
      write(warning(`${sym('warning')}  Could not open your browser automatically.`));
      write(`   Open this URL manually to continue: ${accent(url)}`);
    },

    portInUse(port) {
      write(error(`${sym('error')}  Port ${port} is already in use.`));
      write('   Run again without --port for an automatically assigned free port, or choose a different --port <number>.');
    },

    startupError(message) {
      write(error(`${sym('error')}  GSD Config Manager failed to start: ${message}`));
    },

    shuttingDown() {
      write('');
      write(warning(`${sym('warning')}  Shutting down…`));
    },

    stopped() {
      write(success(`${sym('success')}  Server stopped. Port released, no changes lost.`));
    },

    warnLine(message) {
      write(warning(`${sym('warning')}  ${message}`));
    },
  };
}
