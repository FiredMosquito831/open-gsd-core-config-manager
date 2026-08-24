/**
 * cli-main.ts — the actual Commander/bootstrap logic for the `bin` entry.
 *
 * Split out of `cli.ts` so it is loaded via a DYNAMIC `import()` rather than
 * a static one (see `cli.ts`'s header comment for why: this file's import
 * graph transitively reaches the frozen `packages/config-io/src/validate.ts`,
 * which uses TypeScript's `import X = require(...)` form — a plain `require`
 * call that only works once `globalThis.require` has been shimmed, which
 * `cli.ts` does BEFORE dynamically importing this file).
 */
import { Command } from 'commander';
import { bootstrap, registerSignalHandlers } from './bootstrap.js';
import { createOutput } from './output.js';

/**
 * Frozen flag set for Phase 2 (see 02-06-PLAN.md's `<scope_note_cli_flags>`):
 * `--port <number>` and `--no-open`. `--scan <dir>` is deliberately NOT
 * declared here — it is deferred to Phase 3 alongside DISC-03.
 */
interface RawCliOptions {
  port?: string;
  open: boolean;
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const out = createOutput();

  const program = new Command();
  program
    .name('gsd-config-manager')
    .option('--port <number>', 'port to bind (default: OS-assigned)')
    // Declaring `--no-open` alone makes `opts.open` default to `true`,
    // becoming `false` only when the flag is explicitly passed — do not
    // also declare a positive `--open`.
    .option('--no-open', 'do not automatically open the browser')
    .parse(argv);

  const rawOpts = program.opts<RawCliOptions>();

  let port: number | undefined;
  if (rawOpts.port !== undefined) {
    if (!/^\d+$/.test(rawOpts.port)) {
      out.startupError(`invalid --port value: ${rawOpts.port}`);
      process.exit(1);
    }
    const parsed = Number(rawOpts.port);
    if (parsed > 65_535) {
      out.startupError(`invalid --port value: ${rawOpts.port}`);
      process.exit(1);
    }
    port = parsed;
  }

  try {
    const handle = await bootstrap({ port, open: rawOpts.open }, { out });
    registerSignalHandlers(handle);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EADDRINUSE' && port !== undefined) {
      out.portInUse(port);
    } else {
      out.startupError(err instanceof Error ? err.message : String(err));
    }
    process.exit(1);
  }
}
